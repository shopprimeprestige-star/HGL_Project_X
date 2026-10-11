/** ── LA GIORNATA DEL TECNICO ───────────────────────────────────────────────
 *
 *  A COSA SERVE
 *  È la pagina che si apre PRIMA di uscire: per ogni installazione l'indirizzo
 *  con la mappa, chi ci va, a che ora e — in evidenza — l'importo da ritirare
 *  alla consegna.
 *  L'elenco completo e la coda "da programmare" stanno nell'altra pagina
 *  (/CRM/installazioni): qui c'è solo ciò che serve per lavorare oggi.
 *
 *  IL GIORNO SI SCEGLIE
 *  Prima erano due blocchi fissi, "Oggi" e "Domani". Adesso il giorno si sceglie
 *  come nell'elenco (Oggi · Domani · Questa settimana · una data), ma con
 *  "Oggi" si continua a vedere ANCHE domani: il lavoro del giorno dopo si
 *  prepara la sera prima, e togliere quel blocco avrebbe tolto il motivo per
 *  cui questa pagina esiste.
 *  Fra i giorni comanda l'imminenza, non il calendario: oggi in cima, poi ciò
 *  che è rimasto indietro, poi quello che arriva.
 *
 *  I COMANDI SONO GLI STESSI DELL'ELENCO
 *  Stato del materiale, posa completata, saldo incassato, acquisti del cliente:
 *  qui non ce n'è una seconda versione. Sono gli stessi componenti di
 *  crm/InstallationScheduleDialog.tsx che si vedono nella riga dell'elenco e
 *  dentro la scheda del cliente — chi impara a usarli in un posto li sa già
 *  usare negli altri due.
 *
 *  NIENTE CHECKLIST DELLA BORSA, NIENTE PACCHI
 *  L'elenco dei materiali è stato tolto da tutto il ramo delle
 *  installazioni: quattro voci fisse che nessuno spuntava mai (il dato salvato
 *  resta, vedi la nota su ChecklistMateriali). E le pratiche da spedire non
 *  compaiono qui: non occupano un tecnico e non hanno un orario, quindi non
 *  entrano nei conteggi della giornata.
 *
 *  IL DENARO SI CHIAMA COL SUO NOME
 *  Alla consegna si ritira il SALDO, cioè l'importo da incassare rimasto in
 *  attesa: la parola "acconto" in questa pagina non serve a nessuno — quei soldi
 *  sono in cassa da settimane e il tecnico non li deve ritirare.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCRM } from "@/crm/CRMContext";
import { Button } from "@/components/ui/button";
import { LeadDialog } from "@/crm/LeadDialog";
import { ContatoreAcquisti } from "@/crm/StoricoAcquisti";
import type { Lead, LeadData } from "@/crm/types";
import { formatDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { BarraAzioni, Chip, ChipStato, Pagina, Scheda, Titolo, Vuoto, eur } from "@/crm/ui";
//  Il pulsante con dentro la miniatura del portafoglio del cliente. Sta anche
//  qui — ed è il posto in cui conta di più: questa è la schermata che il tecnico
//  tiene aperta col telefono in mano mentre fa il giro, e le foto le carica
//  proprio da qui, subito dopo la posa. Un segno che si vede in «Installazioni»
//  e sparisce nella giornata insegnerebbe che il dato non c'è.
import { SegnoMedia } from "@/crm/portfolio/Visore";
import {
  AzioniInstallazione,
  BadgeOggi,
  ImportoConsegna,
  InstallationScheduleDialog,
  SegnoAccompagnatore,
  SegnoDriver,
  SegnoNote,
  SelettoreGiorno,
  StatoInstallazione,
  giornoISO,
  giorniScelti,
  nomeAccompagnatore,
  nomeCompleto,
  nomeDriver,
  nomeTecnico,
  ordinaGruppi,
  posaCompletata,
  raggruppaPerGiorno,
  totaleDaIncassare,
  type SceltaGiorno,
} from "@/crm/InstallationScheduleDialog";
//  Il cartellino della priorità: lo stesso dell'elenco delle installazioni.
import { SegnoPriorita } from "@/crm/PrioritaPosa";
//  Il riepilogo di consegna: si stampa o si salva in PDF (crm/ricevuta).
import { TastoRicevuta } from "@/crm/ricevuta";
//  La fattura: bozza o emissione, dalla riga (crm/fatture).
import { TastoFattura } from "@/crm/fatture/TastoFattura";
import { aDomicilio, indirizzoScritto, soloPose } from "@/crm/spedizione";
//  ── IL RITORNO DEL CLIENTE ────────────────────────────────────────────────
//   Le manutenzioni stanno in un blocco SOTTO le pose, mai mescolate: non hanno
//   indirizzo, non hanno un importo da ritirare e non fanno uscire nessuno.
//   Il perché per esteso sta su ManutenzioniDelGiorno.
import {
  BottoneManutenzione,
  ManutenzioniDelGiorno,
} from "@/crm/manutenzione/PannelloManutenzioni";
import { ManutenzioneDialog } from "@/crm/manutenzione/ManutenzioneDialog";
import { CalendarClock, House, MapPin, Wrench } from "lucide-react";

export const Route = createFileRoute("/CRM/installazioni/oggi")({
  component: InstallazioniOggiPage,
});

function InstallazioniOggiPage() {
  const { leads, consultants, updateLead } = useCRM();

  const [scelta, setScelta] = useState<SceltaGiorno>("oggi");
  const [dataScelta, setDataScelta] = useState("");
  const [leadAperto, setLeadAperto] = useState<Lead | null>(null);
  const [schedaAperta, setSchedaAperta] = useState(false);
  const [leadDaProgrammare, setLeadDaProgrammare] = useState<Lead | null>(null);
  const [programmaAperto, setProgrammaAperto] = useState(false);

  const apriScheda = (l: Lead) => {
    setLeadAperto(l);
    setSchedaAperta(true);
  };
  const apriProgrammazione = (l: Lead) => {
    setLeadDaProgrammare(l);
    setProgrammaAperto(true);
  };
  //  La finestra del ritorno è UNA per tutta la pagina, come quella della
  //  programmazione: montarne una per scheda vorrebbe dire venti dialoghi
  //  chiusi in memoria in una giornata piena.
  const [leadManutenzione, setLeadManutenzione] = useState<Lead | null>(null);
  const [manutenzioneAperta, setManutenzioneAperta] = useState(false);
  const apriManutenzione = (l: Lead) => {
    setLeadManutenzione(l);
    setManutenzioneAperta(true);
  };

  //  Solo le pose vere: i pacchi da spedire non hanno un orario e non occupano
  //  un tecnico, quindi non entrano né nell'elenco né nei conteggi del giorno.
  const programmate = useMemo(
    () => soloPose(leads.filter((l) => !!l.data.installazione?.dataInstallazione)),
    [leads],
  );

  /** I giorni da mostrare. Su "Oggi" si aggiunge domani: è il giorno che si
   *  prepara stasera, e vederlo qui evita di aprire la pagina due volte. */
  const giorni = useMemo(
    () => (scelta === "oggi" ? [giornoISO(0), giornoISO(1)] : giorniScelti(scelta, dataScelta)),
    [scelta, dataScelta],
  );

  const conteggi = useMemo(() => {
    const quanti = (elenco: string[] | null) =>
      elenco === null
        ? programmate.length
        : programmate.filter((l) => elenco.includes(l.data.installazione?.dataInstallazione || ""))
            .length;
    return {
      oggi: quanti([giornoISO(0)]),
      domani: quanti([giornoISO(1)]),
      settimana: quanti(giorniScelti("settimana", "")),
      tutte: programmate.length,
    };
  }, [programmate]);

  const visibili = useMemo(() => {
    if (giorni === null) return programmate;
    const set = new Set(giorni);
    return programmate.filter((l) => set.has(l.data.installazione?.dataInstallazione || ""));
  }, [programmate, giorni]);

  //  L'ordine dei blocchi è quello dell'imminenza (oggi · in ritardo · in
  //  arrivo · fatte): con "Tutte" o con una settimana davanti, l'ordine di
  //  arrivo dei dati metterebbe una posa di sei mesi fa sopra quella di stasera.
  const gruppi = useMemo(() => ordinaGruppi(raggruppaPerGiorno(visibili)), [visibili]);

  const totale = totaleDaIncassare(visibili);

  return (
    <Pagina>
      {/*  I due numeri della giornata stanno nella riga sotto il titolo, non in
          una banda di riquadri: erano quattro riquadri per dire quello che qui
          sta in mezza riga, e prima di vedere una posa si attraversavano due
          bande di interfaccia. */}
      <Titolo
        testo="Giornata dell'installatore"
        nota={
          <>
            {visibili.length} {visibili.length === 1 ? "posa" : "pose"} ·{" "}
            <span className={cn("font-semibold tabular-nums", totale > 0 && "text-amber-700")}>
              {eur(totale)}
            </span>{" "}
            da ritirare alla consegna
          </>
        }
        icona={CalendarClock}
        azioni={
          <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
            <Link to="/CRM/installazioni">
              <Wrench className="mr-1 h-3.5 w-3.5" /> Tutte le installazioni
            </Link>
          </Button>
        }
      />

      <BarraAzioni>
        <SelettoreGiorno
          scelta={scelta}
          onScelta={setScelta}
          dataScelta={dataScelta}
          onDataScelta={setDataScelta}
          conteggi={conteggi}
        />
      </BarraAzioni>

      {gruppi.length === 0 ? (
        <Vuoto
          titolo="Nessuna installazione da preparare"
          testo="Nei giorni selezionati non c'è niente in programma."
          icona={Wrench}
          azione={
            <Button asChild size="sm" variant="outline">
              <Link to="/CRM/installazioni">Apri l&apos;elenco delle installazioni</Link>
            </Button>
          }
        />
      ) : (
        gruppi.map((g) => {
          const totaleGiorno = totaleDaIncassare(g.items);
          const oggi = g.giorno === giornoISO(0);
          return (
            <section key={g.giorno} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold">
                  {formatDate(g.giorno)}
                  {oggi && <BadgeOggi />}
                </h2>
                <p className="text-[11.5px] text-muted-foreground">
                  {g.items.length} {g.items.length === 1 ? "installazione" : "installazioni"} ·{" "}
                  {totaleGiorno > 0
                    ? `${eur(totaleGiorno)} da incassare alla consegna`
                    : "nessun importo da ritirare"}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {g.items.map((l) => (
                  <SchedaGiornata
                    key={l.id}
                    lead={l}
                    tecnico={nomeTecnico(l, consultants)}
                    //  I due nomi si risolvono qui, dove i consulenti ci sono
                    //  già: la scheda ne riceve due e non deve cercare nessuno.
                    driver={nomeDriver(l, consultants)}
                    accompagnatore={nomeAccompagnatore(l, consultants)}
                    oggi={oggi}
                    onApri={apriScheda}
                    onProgramma={apriProgrammazione}
                    onManutenzione={apriManutenzione}
                    onSalvaAcquisti={(patch) => updateLead(l.id, patch)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {/*  ── I RITORNI DI QUESTI GIORNI ─────────────────────────────────────
          Sotto le pose e in un blocco suo: sono mezz'ora in sede, non una
          trasferta. Compare solo se ce n'è davvero qualcuno — una scheda vuota
          in fondo a ogni giornata sarebbe rumore fisso. */}
      <ManutenzioniDelGiorno
        leads={leads}
        consulenti={consultants}
        giorni={giorni}
        onApri={apriScheda}
      />

      <LeadDialog open={schedaAperta} onOpenChange={setSchedaAperta} lead={leadAperto} />
      <InstallationScheduleDialog
        open={programmaAperto}
        onOpenChange={setProgrammaAperto}
        lead={leadDaProgrammare}
      />
      <ManutenzioneDialog
        open={manutenzioneAperta}
        onOpenChange={setManutenzioneAperta}
        lead={leadManutenzione}
      />
    </Pagina>
  );
}

/** La scheda di una singola installazione: tutto quello che serve per uscire
 *  di casa e non tornare indietro.
 *
 *  I comandi (stato, saldo, completata, acquisti) sono gli stessi
 *  componenti dell'elenco: qui cambia solo la disposizione, perché questa pagina
 *  si legge in piedi con il telefono in mano e non seduti davanti a un elenco. */
function SchedaGiornata({
  lead,
  tecnico,
  driver,
  accompagnatore,
  oggi,
  onApri,
  onProgramma,
  onManutenzione,
  onSalvaAcquisti,
}: {
  lead: Lead;
  tecnico: string;
  /** chi dà il passaggio, "" se ci va da solo: la mattina della posa è la prima
   *  cosa da sapere, perché sono due persone che escono */
  driver: string;
  /** chi va a posare INSIEME all'installatore, "" se posa da solo. È l'altra
   *  metà della squadra della giornata, e questa è la schermata su cui quella
   *  giornata si legge la mattina: qui più che altrove il nome mancante voleva
   *  dire una persona in meno alla partenza. */
  accompagnatore: string;
  /** le installazioni di oggi si distinguono a colpo d'occhio da quelle da preparare */
  oggi: boolean;
  onApri: (l: Lead) => void;
  onProgramma: (l: Lead) => void;
  /** apre la procedura del ritorno: si usa a posa finita, con il cliente
   *  ancora davanti — è il solo momento in cui fissarlo costa dieci secondi */
  onManutenzione: (l: Lead) => void;
  //  `Promise<unknown>`: qui si passa direttamente `updateLead`, che ora
  //  restituisce se ha salvato davvero. Vedi PannelloSede per il perché.
  onSalvaAcquisti: (patch: Partial<LeadData>) => void | Promise<unknown>;
}) {
  const inst = lead.data.installazione;
  //  ── DOVE SI VA ──────────────────────────────────────────────────────────
  //   Su una posa a domicilio l'indirizzo scritto è LA cosa che serve: la città
  //   da sola manda il tecnico in centro senza via né civico. Se non è ancora
  //   stato scritto si ripiega sulla città, che è quello che questa scheda ha
  //   sempre mostrato, e la mancanza si vede dalla scheda «A domicilio».
  const casa = aDomicilio(lead);
  const scritto = indirizzoScritto(lead);
  //  ⚠️ SU UNA POSA A DOMICILIO IL RIPIEGO SULLA CITTÀ VA DETTO. Prima la città
  //  compariva al posto dell'indirizzo senza nessun segno: il tecnico leggeva
  //  "Milano", apriva la mappa e partiva per il centro di una città. Adesso il
  //  ripiego resta — è tutto quello che l'archivio ha — ma si vede che è un
  //  ripiego, e dove si rimedia.
  const soloCitta = casa && !scritto;
  const indirizzo = (casa ? scritto : "") || String(lead.data.citta || "").trim();
  const mappa = indirizzo
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${nomeCompleto(lead)} ${indirizzo}`,
      )}`
    : null;

  return (
    <Scheda
      className={cn(oggi && "border-sky-300 ring-1 ring-sky-200")}
      titolo={
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onApri(lead)}
            className="truncate text-left hover:underline"
          >
            {nomeCompleto(lead)}
          </button>
          {oggi && <BadgeOggi />}
          {/*  Le note del cliente si leggono PRIMA di suonare al campanello:
              "cane in giardino", "citofono rotto, chiamare". Passando sopra il
              foglietto sul computer, toccandolo sul telefono. Compare solo se
              qualcosa c'è davvero da leggere. */}
          {/*  ── «DA ANTICIPARE», ANCHE NELLA GIORNATA ──────────────────
              Il cartellino c'era nell'elenco delle pose e nelle spedizioni, e
              non qui: chi lavora la giornata — cioè chi ha il cliente davanti —
              era l'unico a non sapere che quella posa era stata portata avanti
              a mano, né che giorno aveva chiesto il cliente.
              ⚠️ Qui compare solo il SEGNO, non il pulsante: una posa in
               programma per oggi non si può anticipare più di così, e un
               comando che non cambia niente in una schermata che si legge in
               piedi davanti al portone è solo un bersaglio da sbagliare. */}
          <SegnoPriorita lead={lead} />
          <SegnoNote lead={lead} />
          <SegnoDriver nome={driver} />
          {/*  E CHI VA A POSARE INSIEME: stessa fila, subito dopo il driver.
              Su questa schermata la squadra della giornata si legge senza
              aprire niente, e con il solo segno del driver mancava proprio la
              persona che sul posto lavora accanto all'installatore. */}
          <SegnoAccompagnatore nome={accompagnatore} />
          {/*  IL PORTAFOGLIO DEL CLIENTE — ultimo della fila, come nelle altre
              tre schermate: è l'unico segno con un'immagine dentro, e messo
              prima farebbe cominciare la scheda con un rettangolo invece che
              col nome. Qui il riquadro vuoto (tratteggiato, con un «+») serve
              più che altrove: è da questa schermata che il tecnico carica le
              foto appena finita la posa, quando ce l'ha ancora davanti. */}
          <SegnoMedia lead={lead} />
        </span>
      }
      nota={[tecnico, inst?.durataInstallazione ? `${inst.durataInstallazione} min` : null]
        .filter(Boolean)
        .join(" · ")}
      azioni={
        <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[12.5px] font-semibold tabular-nums">
          {inst?.orarioInstallazione || "—:—"}
        </span>
      }
      classeCorpo="space-y-3 p-3"
    >
      {/*  Gli stessi comandi della riga dell'elenco: lo stato si cambia da qui,
          senza aprire la scheda del cliente. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ChipStato stato={lead.data.stato} />
        <StatoInstallazione lead={lead} />
        {/*  Si esce: va detto qui, dove il tecnico guarda prima di partire.
            ⚠️ QUI C'ERA ANCHE LA PASTIGLIA DEL "TIPO DI POSA", ed era la stessa
            domanda con una seconda risposta: ETICHETTA_TIPO stampa "taxi" come
            «A domicilio» e "indipendente" come «In sede». Su una pratica a
            domicilio si leggeva «A domicilio» due volte a un centimetro di
            distanza; su una pratica con il tipo rimasto indietro si leggeva
            «A domicilio» su una posa che si fa in sede — e chi legge non ha
            modo di sapere quale delle due pastiglie sia quella vera.
            Il dove lo dice UNA riga sola, quella che decide anche la scheda
            «A domicilio», l'indirizzo e il costo del viaggio. Il tipo resta
            scritto in scheda e si sceglie da lì (il modo di consegna lo
            riallinea): qui non aggiungeva niente che non fosse già detto. */}
        {casa && (
          <Chip tono="neutro" icona={House}>
            A domicilio
          </Chip>
        )}
        <ContatoreAcquisti lead={lead} onSalva={onSalvaAcquisti} />
      </div>

      {/* L'IMPORTO DELLA CONSEGNA — la ragione per cui il tecnico legge questa
          scheda prima di suonare al campanello. */}
      <ImportoConsegna lead={lead} className="w-full" />

      {/*  La riga del dove compare anche quando l'indirizzo NON c'è, se si va a
          domicilio: è l'unico caso in cui il vuoto è l'informazione più
          importante della scheda — significa che nessuno sa dove mandare il
          tecnico, e tacerlo lo fa partire lo stesso. */}
      {(indirizzo || soloCitta) && (
        <div className="flex items-start gap-2">
          <MapPin
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              soloCitta ? "text-amber-600" : "text-muted-foreground",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className={cn("text-[12.5px] font-medium", soloCitta && "text-amber-700")}>
              {indirizzo || "Indirizzo non indicato"}
              {soloCitta &&
                (indirizzo
                  ? " · solo la città: l'indirizzo non è ancora scritto"
                  : " · scrivilo nella scheda «A domicilio»")}
            </div>
            {mappa && (
              <a
                href={mappa}
                target="_blank"
                rel="noreferrer"
                className="text-[11.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Apri in Google Maps
              </a>
            )}
          </div>
        </div>
      )}

      {/*  ⚠️ QUI "Completa" NON si spegne per l'indirizzo mancante, ed è
          voluto: nell'elenco e nella scheda «A domicilio» il campo per
          scriverlo è a un clic, quindi il blocco ha un rimedio; qui no —
          questa pagina si legge in piedi, davanti al portone, a lavoro
          finito. Spegnere il comando che registra una posa già fatta,
          senza offrire il modo di sbloccarlo, non protegge nessun dato: fa
          solo restare aperta una pratica chiusa. La mancanza si vede sopra,
          in ambra, ed è lì che va letta. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <AzioniInstallazione lead={lead} onApri={onApri} onProgramma={onProgramma} />
        {/*  ── IL RITORNO SI FISSA QUI, NON DOMANI ─────────────────────────
            Appena la posa è segnata «Fatta», questa scheda è l'ultima cosa che
            si guarda con il cliente ancora davanti: è l'unico istante in cui
            fissare la manutenzione costa dieci secondi invece di tre telefonate.
            Prima che la posa sia chiusa il pulsante non c'è — non c'è ancora
            niente da far tornare. */}
        {posaCompletata(lead) && <BottoneManutenzione lead={lead} onFissa={onManutenzione} />}
        {/*  ── IL FOGLIO, DOVE SERVE DAVVERO ───────────────────────────────
            Questa è la schermata che si guarda con il cliente ANCORA DAVANTI,
            subito dopo aver segnato la posa: è l'unico istante in cui il
            riepilogo si stampa e si consegna a mano invece di finire in una
            chat il giorno dopo. */}
        {posaCompletata(lead) && <TastoRicevuta lead={lead} esteso />}
        {/*  La fattura: qui il cliente è ancora davanti, ed è il momento in cui
            si salda. Come nell'elenco, non aspetta la posa completata. */}
        <TastoFattura lead={lead} esteso />
      </div>

      {inst?.noteInstallazione && (
        <p className="border-l-2 border-amber-500/40 pl-2 text-[11.5px] text-muted-foreground">
          <span className="font-medium">Note:</span> {inst.noteInstallazione}
        </p>
      )}
    </Scheda>
  );
}
