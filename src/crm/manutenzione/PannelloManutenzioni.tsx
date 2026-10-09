/** ─────────────────────────────────────────────────────────────────────────
 *  DOVE SI VEDE LA MANUTENZIONE
 *
 *  TRE POSTI, TRE DOMANDE DIVERSE
 *   · `SegnoManutenzione` — sulla riga di un cliente: «questo qui torna, e
 *     quando». Due parole e un colore, mai una pastiglia grande come un
 *     pulsante: è un'informazione, non un comando.
 *   · `BottoneManutenzione` — sulla riga di una posa COMPLETATA: è l'unico
 *     momento in cui il gesto ha senso, e infatti compare solo lì. Su una posa
 *     ancora da fare non c'è niente da fissare — il cliente non ha l'impianto.
 *   · `PannelloManutenzioni` — la lente: tutti i clienti che devono tornare,
 *     ordinati per urgenza, con i tre gesti che servono (fissa · fatta ·
 *     saltata).
 *
 *  L'ORDINE È QUELLO DELL'IMMINENZA, NON DEL CALENDARIO
 *  In ritardo in cima, poi oggi, poi la settimana, e in fondo quello che c'è ma
 *  non è ancora lavoro. È lo stesso criterio dell'elenco delle installazioni, e
 *  per la stessa ragione: un elenco ordinato per data metterebbe i ritorni di
 *  gennaio davanti a quelli di stasera.
 *
 *  UNA RIGA = UN CLIENTE, NON UNA MANUTENZIONE
 *  Un cliente con otto ritorni alle spalle occupa una riga sola, quella della
 *  prossima. Lo storico si legge nella sua scheda: qui c'è una lista di cose da
 *  fare, e un registro storico in mezzo la renderebbe illeggibile dopo due mesi.
 *  Le manutenzioni saltate però si CONTANO sulla riga — «2 saltate» accanto al
 *  nome — perché quel numero è l'unico segnale che un cliente sta scivolando via.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { BellRing, CalendarCheck, CalendarClock, Check, Repeat, X } from "lucide-react";
import type { Consultant, Lead } from "../types";
import { Chip, Scheda, Vuoto, type Tono } from "../ui";
import { useAzioniManutenzione } from "./azioni";
import { ManutenzioneDialog } from "./ManutenzioneDialog";
import {
  ETICHETTA_SEGNALE,
  daSeguire,
  //  La stessa parola che la procedura mostra al primo passo e nel riepilogo:
  //  è tutta la ragione per cui questa costante esiste (vedi regole.ts).
  ETICHETTA_TIPO_MANUTENZIONE,
  generaIlSuccessivo,
  oggiISO,
  prossimaManutenzione,
  quanteSaltate,
  righeManutenzione,
  segnaleDi,
  tipoDi,
  type RigaManutenzione,
  type SegnaleManutenzione,
} from "./regole";

/** Il colore di un segnale. Sono i toni del CRM (crm/ui.tsx), cioè
 *  SIGNIFICATI e non colori: «in ritardo» prende il tono di ciò che è andato
 *  storto, «in arrivo» quello di ciò a cui manca un'azione, «oggi» quello del
 *  lavoro del giorno. Un secondo vocabolario di colori solo per le manutenzioni
 *  avrebbe fatto sembrare diverse due cose che sono uguali. */
const TONO_SEGNALE: Record<SegnaleManutenzione, Tono> = {
  in_ritardo: "persa",
  oggi: "da_lavorare",
  in_arrivo: "in_sospeso",
  lontana: "neutro",
  fatta: "vinta",
  saltata: "persa",
};

/** Quanto manca, detto come si direbbe a voce. */
function quandoLeggibile(riga: RigaManutenzione): string {
  const { mancano, appuntamento } = riga;
  if (mancano === null) return formatDate(appuntamento.data);
  if (mancano === 0) return "oggi";
  if (mancano === 1) return "domani";
  if (mancano > 0) return `fra ${mancano} giorni`;
  return `${-mancano} ${-mancano === 1 ? "giorno" : "giorni"} fa`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL SEGNO SULLA RIGA
   ═════════════════════════════════════════════════════════════════════════ */

/** Compare solo se c'è davvero un ritorno aperto: un segno che c'è sempre
 *  smette di essere guardato dopo mezza giornata. */
export function SegnoManutenzione({ lead, className }: { lead: Lead; className?: string }) {
  const app = prossimaManutenzione(lead.data);
  if (!app) return null;
  const segnale = segnaleDi(app);
  return (
    <Chip
      tono={TONO_SEGNALE[segnale]}
      punto
      icona={Repeat}
      className={className}
      title={
        app.stato === "fissata"
          ? `Manutenzione fissata per il ${formatDate(app.data)}${app.ora ? ` alle ${app.ora}` : ""}`
          : `Promemoria: torna intorno al ${formatDate(app.data)}. Non occupa nessuna agenda`
      }
    >
      {`Manutenzione ${ETICHETTA_SEGNALE[segnale].toLowerCase()}`}
    </Chip>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL PULSANTE SULLA POSA COMPLETATA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL MOMENTO GIUSTO È UNO SOLO ────────────────────────────────────────
 *  Appena la posa è segnata completata, il cliente è ancora lì. Il pulsante sta
 *  quindi accanto al segno «Fatta» della posa, e non dentro un menu: un gesto
 *  che va fatto adesso non si mette dietro un tocco in più.
 *  Se una manutenzione c'è già, il pulsante non si ripete — al suo posto si vede
 *  il segno, che dice quando torna. */
export function BottoneManutenzione({
  lead,
  onFissa,
  className,
}: {
  lead: Lead;
  onFissa: (l: Lead) => void;
  className?: string;
}) {
  if (prossimaManutenzione(lead.data))
    return <SegnoManutenzione lead={lead} className={className} />;
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn("h-7 text-[11.5px]", className)}
      onClick={() => onFissa(lead)}
      title="Fissa il ritorno per la manutenzione: il cliente è qui adesso"
    >
      <Repeat className="mr-1 h-3.5 w-3.5" /> Manutenzione
    </Button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA LENTE
   ═════════════════════════════════════════════════════════════════════════ */

/** I gruppi, nell'ordine in cui si guardano. Il titolo dice il gesto, la nota
 *  dice chi ci finisce dentro: un gruppo senza spiegazione si legge a caso e poi
 *  non si capisce perché manca una riga. */
const GRUPPI: { segnale: SegnaleManutenzione; titolo: string; nota: string }[] = [
  {
    segnale: "in_ritardo",
    titolo: "In ritardo",
    nota: "Il giorno è passato e nessuno ha detto com'è andata: si chiude a mano, fatta o saltata",
  },
  { segnale: "oggi", titolo: "Oggi", nota: "Tornano oggi" },
  {
    segnale: "in_arrivo",
    titolo: "Entro sette giorni",
    nota: "Si chiamano adesso: c'è ancora tempo per trovargli un posto",
  },
  {
    segnale: "lontana",
    titolo: "Più avanti",
    nota: "Ci sono, ma non sono lavoro di questa settimana",
  },
];

export function PannelloManutenzioni({
  leads,
  consulenti,
  onApri,
}: {
  leads: Lead[];
  consulenti: Consultant[];
  onApri: (l: Lead) => void;
}) {
  const [daFissare, setDaFissare] = useState<Lead | null>(null);
  const [appAperto, setAppAperto] = useState<RigaManutenzione["appuntamento"] | null>(null);
  const [finestraAperta, setFinestraAperta] = useState(false);

  const righe = useMemo(() => righeManutenzione(leads), [leads]);
  const perGruppo = useMemo(() => {
    const mappa = new Map<SegnaleManutenzione, RigaManutenzione[]>();
    for (const r of righe) {
      const elenco = mappa.get(r.segnale);
      if (elenco) elenco.push(r);
      else mappa.set(r.segnale, [r]);
    }
    return mappa;
  }, [righe]);

  const apriFinestra = (riga: RigaManutenzione) => {
    setDaFissare(riga.lead);
    setAppAperto(riga.appuntamento);
    setFinestraAperta(true);
  };

  if (righe.length === 0) {
    return (
      <Vuoto
        titolo="Nessuna manutenzione in programma"
        testo="Il ritorno si fissa dalla riga di una posa completata, quando il cliente è ancora lì: il pulsante «Manutenzione» sta accanto al segno «Fatta»."
        icona={Repeat}
      />
    );
  }

  return (
    <>
      {GRUPPI.map((g) => {
        const elenco = perGruppo.get(g.segnale) ?? [];
        //  Un gruppo vuoto non si disegna: quattro schede di cui tre vuote fanno
        //  sembrare rotta la pagina, e allungano la strada fino alla prima riga
        //  vera.
        if (elenco.length === 0) return null;
        return (
          <Scheda
            key={g.segnale}
            icona={g.segnale === "in_ritardo" ? CalendarClock : Repeat}
            titolo={g.titolo}
            nota={g.nota}
            azioni={
              <Chip tono={TONO_SEGNALE[g.segnale]} punto>
                {elenco.length}
              </Chip>
            }
            className={cn(g.segnale === "in_ritardo" && "border-rose-300 ring-1 ring-rose-200")}
            senzaPadding
            classeCorpo="divide-y divide-border"
          >
            {elenco.map((r) => (
              <RigaManutenzioneCliente
                key={r.lead.id}
                riga={r}
                consulenti={consulenti}
                onApri={onApri}
                onFissa={apriFinestra}
              />
            ))}
          </Scheda>
        );
      })}

      <ManutenzioneDialog
        lead={daFissare}
        appuntamento={appAperto}
        open={finestraAperta}
        onOpenChange={setFinestraAperta}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA RIGA — CHI · QUANDO · CHI LA FA · I TRE GESTI
   ═════════════════════════════════════════════════════════════════════════ */

function RigaManutenzioneCliente({
  riga,
  consulenti,
  onApri,
  onFissa,
}: {
  riga: RigaManutenzione;
  consulenti: Consultant[];
  onApri: (l: Lead) => void;
  onFissa: (r: RigaManutenzione) => void;
}) {
  const { segnaFatta, segnaSaltata } = useAzioniManutenzione();
  const { lead, appuntamento: app, segnale } = riga;
  const nome = `${lead.data.nome ?? ""} ${lead.data.cognome ?? ""}`.trim() || "Senza nome";
  const nomeDi = (id?: string | null) =>
    id ? consulenti.find((c) => c.id === id)?.data.nome || "" : "";
  const chi = nomeDi(app.consulenteId);
  //  ── CHI ALTRO CI VA, DETTO NELL'ELENCO ─────────────────────────────────
  //   Un ritorno con un accompagnatore o un driver impegna due o tre agende,
  //   non una. Chi legge questa riga per riempire il resto della giornata deve
  //   vederlo senza aprire niente: senza, un pomeriggio che vale per tre persone
  //   si legge come un pomeriggio che ne vale una. È la stessa ragione per cui
  //   sulle pose esistono `SegnoDriver` e il segno dell'accompagnatore.
  const conLui = [nomeDi(app.accompagnatoreId), nomeDi(app.driverId)].filter(Boolean);
  const saltate = quanteSaltate(lead.data);
  const fissata = app.stato === "fissata";
  //  Un intervento singolo si segna sulla riga: quando lo si chiude, dopo non
  //  nasce niente — e chi preme «Fatta» deve saperlo prima, non scoprirlo dal
  //  messaggio.
  const singolo = tipoDi(app) === "singolo";
  /*  ── QUANDO SI PUÒ DIRE COM'È ANDATA ───────────────────────────────────
   *   Due condizioni, e sono tutte e due necessarie:
   *    · dev'essere un APPUNTAMENTO. Su un promemoria non c'è niente da
   *      chiudere — al cliente non abbiamo promesso nessun giorno, quindi non
   *      può averlo «saltato»: lì il gesto è uno solo, fissarlo;
   *    · dev'essere già arrivato a scadenza (oggi o passato). Chiedere «è
   *      tornato?» per un appuntamento fra tre settimane è un pulsante che si
   *      preme solo per sbaglio, e per sbaglio chiude una manutenzione vera. */
  const chiudibile = fissata && daSeguire(app, oggiISO()) && segnale !== "in_arrivo";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 hover:bg-muted/40">
      <div className="min-w-0 flex-1 basis-[12rem]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onApri(lead)}
            className="truncate text-[13px] font-semibold leading-tight hover:underline"
          >
            {nome}
          </button>
          <Chip tono={TONO_SEGNALE[segnale]} punto>
            {ETICHETTA_SEGNALE[segnale]}
          </Chip>
          {/*  ── QUANTE NE HA SALTATE ─────────────────────────────────────
              Non è un dettaglio storico: tre di fila vogliono dire che il
              cliente sta uscendo, ed è l'unico posto in cui quel numero si
              vede senza aprire la scheda. */}
          {saltate > 0 && (
            <Chip tono="persa" title="Manutenzioni saltate da quando ha l'impianto">
              {saltate} {saltate === 1 ? "saltata" : "saltate"}
            </Chip>
          )}
          {/*  Il segno c'è solo sull'intervento singolo e non sul ciclo: il
              ciclo è il caso normale, e una pastiglia su ogni riga smette di
              essere guardata. Qui invece dice una conseguenza — dopo questo non
              nasce nient'altro. */}
          {singolo && (
            <Chip tono="neutro" title="Un ritorno e basta: dopo questo non ne nasce nessun altro">
              {ETICHETTA_TIPO_MANUTENZIONE.singolo}
            </Chip>
          )}
        </div>
        <div className="truncate text-[11.5px] leading-snug text-muted-foreground">
          {/*  Il «quando» è il dato della riga, quindi è colorato dove si legge:
              rosso se è passato, scuro se è un appuntamento vero, ambra se è
              ancora un promemoria — cioè se manca un passaggio. */}
          <span
            className={cn(
              "font-medium",
              segnale === "in_ritardo"
                ? "text-rose-700"
                : fissata
                  ? "text-foreground"
                  : "text-amber-700",
            )}
          >
            {quandoLeggibile(riga)}
            {fissata && app.ora ? ` · ${formatDate(app.data)} alle ${app.ora}` : ""}
          </span>
          {" · "}
          {fissata ? (
            //  «con Marco e Luca»: chi affianca e chi va a prendere il cliente
            //  stanno accanto a chi esegue, perché sono agende bloccate anche
            //  loro. Niente nomi = ci pensa lui, che è il caso normale.
            `${chi || "chi lo esegue: da assegnare"}${conLui.length ? ` · con ${conLui.join(" e ")}` : ""}`
          ) : (
            <span className="text-amber-700">
              solo promemoria per il {formatDate(app.data)}: non occupa nessuna agenda
            </span>
          )}
          {lead.data.telefono && ` · ${lead.data.telefono}`}
        </div>
        {app.note && (
          <div className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium">Note:</span> {app.note}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/*  L'AZIONE PIENA È UNA SOLA: finché non è fissata, il gesto è fissarla;
            quando lo è, il gesto è dire com'è andata. Due pulsanti pieni
            accanto costringono a leggerli tutti e due ogni volta. */}
        {chiudibile ? (
          <>
            <Button
              size="sm"
              className="h-7 text-[11.5px]"
              onClick={() => void segnaFatta(lead, app)}
              title={
                generaIlSuccessivo(app)
                  ? "Il cliente è tornato: si segna fatta e nasce il promemoria del prossimo ritorno"
                  : "Il cliente è tornato: si segna fatta e finisce qui — era un intervento singolo, non nasce nessun ritorno successivo"
              }
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Fatta
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11.5px]"
              onClick={() => void segnaSaltata(lead, app)}
              title="Non è venuto: resta scritta, e il cliente torna in elenco da richiamare oggi"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Saltata
            </Button>
          </>
        ) : null}
        <Button
          size="sm"
          variant={chiudibile ? "ghost" : "default"}
          className="h-7 text-[11.5px]"
          onClick={() => onFissa(riga)}
          title={fissata ? "Sposta giorno e ora" : "Il cliente ha confermato: dagli giorno e ora"}
        >
          {fissata ? (
            <>
              <CalendarClock className="mr-1 h-3.5 w-3.5" /> Sposta
            </>
          ) : (
            <>
              <CalendarCheck className="mr-1 h-3.5 w-3.5" /> Fissa
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. IL BLOCCO DELLA GIORNATA — le manutenzioni di oggi, mai fra le pose
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ UN BLOCCO A PARTE E NON UNA RIGA IN MEZZO ALLE POSE ───────────
 *  La giornata del tecnico è la pagina che si legge PRIMA di uscire, e ogni
 *  riga che ci sta dentro è una posa: ha un indirizzo, un importo da ritirare,
 *  un materiale. Una manutenzione non ha niente di tutto questo — è mezz'ora in
 *  sede — e mescolarla alle pose vorrebbe dire riga per riga chiedersi «e questa
 *  cos'è?». Sta sotto, in un blocco suo, con la sua intestazione: si vede, si
 *  conta, e non si confonde con il lavoro che porta fuori il tecnico. */
export function ManutenzioniDelGiorno({
  leads,
  consulenti,
  giorni,
  onApri,
}: {
  leads: Lead[];
  consulenti: Consultant[];
  /** i giorni ISO che la pagina sta mostrando; `null` = tutti */
  giorni: string[] | null;
  onApri: (l: Lead) => void;
}) {
  const [daFissare, setDaFissare] = useState<Lead | null>(null);
  const [appAperto, setAppAperto] = useState<RigaManutenzione["appuntamento"] | null>(null);
  const [finestraAperta, setFinestraAperta] = useState(false);

  const righe = useMemo(() => {
    const tutte = righeManutenzione(leads);
    if (giorni === null) return tutte;
    const set = new Set(giorni);
    //  Solo gli APPUNTAMENTI veri entrano nella giornata: un promemoria non ha
    //  un'ora e non è lavoro di quel giorno — è una telefonata da fare, e la sua
    //  casa è la lente delle manutenzioni.
    return tutte.filter((r) => r.appuntamento.stato === "fissata" && set.has(r.appuntamento.data));
  }, [leads, giorni]);

  if (righe.length === 0) return null;

  return (
    <>
      <Scheda
        icona={Repeat}
        titolo="Manutenzioni"
        nota="Ritorni in sede: non sono pose, non hanno un importo da ritirare"
        azioni={
          <Chip tono="neutro" punto>
            {righe.length}
          </Chip>
        }
        senzaPadding
        classeCorpo="divide-y divide-border"
      >
        {/*  Niente riga di vuoto: se non ce n'è nessuna la scheda non si
            disegna affatto (il `return null` qui sopra). Una scheda vuota in
            fondo a ogni giornata sarebbe rumore fisso su una pagina che si
            legge in piedi. */}
        {righe.map((r) => (
          <RigaManutenzioneCliente
            key={r.lead.id}
            riga={r}
            consulenti={consulenti}
            onApri={onApri}
            onFissa={(scelta) => {
              setDaFissare(scelta.lead);
              setAppAperto(scelta.appuntamento);
              setFinestraAperta(true);
            }}
          />
        ))}
      </Scheda>

      <ManutenzioneDialog
        lead={daFissare}
        appuntamento={appAperto}
        open={finestraAperta}
        onOpenChange={setFinestraAperta}
      />
    </>
  );
}

/** Quante manutenzioni chiedono un gesto adesso: è il numero della pastiglia
 *  nella banda delle installazioni. Comprende ciò che è in ritardo, oggi ed
 *  entro sette giorni — NON i ritorni fra tre mesi, che ci sono ma non si
 *  possono lavorare: un numero che non cala mai smette di essere guardato. */
export function quanteDaSeguire(leads: Lead[]): number {
  return righeManutenzione(leads, { soloDaSeguire: true }).length;
}

/** L'icona della manutenzione, esportata perché la usano anche le pagine (la
 *  pastiglia della lente e il vuoto): due icone diverse per la stessa cosa la
 *  fanno sembrare due cose. */
export const IconaManutenzione = Repeat;
export const IconaPromemoria = BellRing;
