/** ── QUANTO HA SPESO — IL NUMERO SULLA RIGA E LA FINESTRA CHE LO APRE ──────
 *
 *  Richiesta del committente: sulle pose completate deve esserci, GIÀ DA FUORI,
 *  quanto quel cliente ha speso in tutto fino a oggi, e un pulsante che apre
 *  una finestra dove si scrive cosa ha comprato — titolo e importo — voce per
 *  voce. Le manutenzioni entrano nel conto.
 *
 *  ── PERCHÉ IL NUMERO STA FUORI E NON DENTRO LA SCHEDA ─────────────────────
 *  Perché la domanda si fa mentre si guarda l'elenco: «questo quanto ci ha
 *  lasciato?» viene in mente davanti al nome, non dopo aver aperto tre
 *  finestre. Un numero che per vederlo bisogna cercarlo non viene guardato, e
 *  allora tanto vale non calcolarlo.
 *
 *  ── IL CONTO NON SI FA QUI ────────────────────────────────────────────────
 *  Le tre voci — vendita, acquisti, manutenzioni fatte — le mette insieme
 *  `crm/acquisti.ts`, che spiega anche perché un ritorno ancora da fare NON
 *  entra nel totale. Qui si disegna e si scrive, e basta: se il criterio
 *  cambiasse, deve cambiare in un posto solo o la riga e la finestra
 *  comincerebbero a dire due cifre diverse sulla stessa persona.
 *
 *  ── ⚠️ SI SCRIVE UNA VOCE PER VOLTA, E SI LEGGE LA RISPOSTA ───────────────
 *  Ogni «Aggiungi» è un salvataggio suo, e `updateLead` torna `false` anche
 *  senza errore di rete. Qui si registrano dei soldi: una conferma su una
 *  scrittura mai avvenuta è il modo più veloce di perdere una riga di cassa
 *  senza che nessuno se ne accorga. */
import { useMemo, useState } from "react";
import {
  ChevronRight,
  Plus,
  Receipt,
  Repeat,
  ShoppingBag,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCRM } from "./CRMContext";
import {
  acquistiDi,
  conAcquisto,
  prezzoDellaVendita,
  senzaAcquisto,
  spesaDelCliente,
} from "./acquisti";
import { FinestraCosti } from "./FinestraCosti";
import { totaleCostiPratica } from "./costi-pratica";
import { posaFatta } from "./types";
import { ETICHETTA_STATO_MANUTENZIONE, manutenzioniDi } from "./manutenzione/regole";
import type { Lead, StatoManutenzione } from "./types";
import { dataBreve, eur } from "./ui";
import { CampoFinestra, Finestra, KpiFinestra, NotaFinestra, SezioneFinestra } from "./ui/Finestra";

function nomeDi(l: Lead): string {
  return `${l.data?.nome || ""} ${l.data?.cognome || ""}`.trim() || "Senza nome";
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL PULSANTE — è il numero, non un'icona accanto al numero
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ IL TOTALE È IL BERSAGLIO. Un numero scritto e, di fianco, una matita da
 *  premere sono due cose da guardare per un gesto solo; e su una riga già piena
 *  di comandi la matita diventa il quinto pulsantino identico agli altri
 *  quattro. Qui si preme il numero — che è anche quello che si stava
 *  guardando — e si apre l'elenco che lo compone. */
export function SpesaTotale({ lead, className }: { lead: Lead; className?: string }) {
  const [aperta, setAperta] = useState(false);
  const [costiAperti, setCostiAperti] = useState(false);
  const spesa = spesaDelCliente(lead);
  const costi = totaleCostiPratica(lead.data);
  const netto = spesa.totale - costi;
  /** ── ⚠️ A POSA FATTA QUESTO BLOCCO DICE TUTTO DA SOLO ──────────────────
   *  Richiesta del committente: quando l'ordine è completato deve restare
   *  soltanto «Speso in tutto», con i costi e il netto sotto.
   *  La ragione è la ridondanza che si vedeva sulla riga: accanto a questo
   *  badge c'era il riquadro dell'incasso che, a saldo chiuso, ripeteva la
   *  stessa cifra — «già versato 650», «totale 650», «resta 0» — cioè tre
   *  caselle per dire quello che qui era già scritto in una.
   *  Da qui in poi, su una posa fatta, il denaro lo racconta questo blocco e i
   *  punti di montaggio che ce l'hanno accanto spengono l'altro (vedi
   *  CRM.installazioni.index e crm/SchedaCliente).
   *  ⚠️ Sulle pose ancora da fare resta il badge compatto di sempre: là il
   *   numero che serve è quanto manca all'incasso, e quello lo dice l'altro
   *   riquadro. */
  const conConto = posaFatta(lead.data);

  const titolo = `${nomeDi(lead)} ha speso ${eur(spesa.totale)} in tutto · vendita ${eur(
    spesa.vendita,
  )}${spesa.acquisti > 0 ? ` · acquisti ${eur(spesa.acquisti)}` : ""}${
    spesa.manutenzioni > 0 ? ` · manutenzioni ${eur(spesa.manutenzioni)}` : ""
  } · tocca per lo storico`;

  //  ⚠️ Le finestre si montano SOLO da aperte: qui le righe sono centinaia, e
  //  una finestra per riga tenuta chiusa è lavoro pagato a ogni ridisegno.
  const finestre = (
    <>
      {aperta && <FinestraSpesa lead={lead} onChiudi={() => setAperta(false)} />}
      <FinestraCosti lead={lead} aperta={costiAperti} onCambio={setCostiAperti} />
    </>
  );

  if (!conConto) {
    /** ⚠️ IL TOTALE È IL BERSAGLIO. Un numero scritto e, di fianco, una matita
     *  da premere sono due cose da guardare per un gesto solo; e su una riga
     *  già piena di comandi la matita diventa il quinto pulsantino identico
     *  agli altri quattro. Qui si preme il numero — che è anche quello che si
     *  stava guardando — e si apre l'elenco che lo compone. */
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            //  Le righe delle installazioni si aprono al tocco: senza questo si
            //  aprirebbe anche la scheda del cliente dietro la finestra.
            e.stopPropagation();
            setAperta(true);
          }}
          aria-haspopup="dialog"
          title={titolo}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-left leading-tight transition hover:brightness-95",
            className,
          )}
        >
          <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-700 opacity-80" aria-hidden />
          <span className="flex flex-col">
            <span className="text-[10px] font-medium uppercase leading-tight tracking-wide text-emerald-800/70">
              Speso in tutto
            </span>
            <span className="text-[14px] font-bold leading-tight tabular-nums text-emerald-800">
              {eur(spesa.totale)}
            </span>
          </span>
        </button>
        {finestre}
      </>
    );
  }

  /* ── ⚠️ IL CONTO DELLA POSA FATTA: IN RIGA, COL COLORE CHE INFORMA ─────
     Larga e bassa invece che stretta e alta: era tre righe impilate, alta il
     doppio della riga del cliente accanto, e in un elenco dove ogni riga è una
     posa quell'altezza si moltiplica per venti.

     ⚠️ E IL COLORE DICE CHE COSA È QUEL NUMERO, invece di tingere tutto di
      verde. Verde = soldi entrati, rosso = soldi usciti, e il netto prende il
      colore del suo segno. Il fondo resta bianco e le etichette grigie: in un
      elenco di venti pose tre colori pieni affiancati fanno una tavolozza, e
      una tavolozza non si legge. Solo la cella che conta — il netto — ha una
      velatura del suo colore.
     È la stessa regola, con gli stessi colori, della fascia dei soldi che le
     sta accanto (crm/InstallationScheduleDialog): due fasce sulla stessa riga
     non possono avere due vocabolari di colore.

     ⚠️ DUE CELLE SI PREMONO E UNA NO: il totale apre lo storico, i costi si
      scrivono, il netto si guarda soltanto. Un numero che è anche un pulsante
      si preme per sbaglio proprio mentre lo si legge. */
  return (
    <>
      <div
        className={cn(
          "flex w-fit shrink-0 items-stretch divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-card leading-tight",
          className,
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            //  Le righe delle installazioni si aprono al tocco: senza questo si
            //  aprirebbe anche la scheda del cliente dietro la finestra.
            e.stopPropagation();
            setAperta(true);
          }}
          aria-haspopup="dialog"
          title={titolo}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left transition hover:bg-slate-50"
        >
          <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
          <span className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500">
              Speso in tutto
            </span>
            <span className="text-[14px] font-semibold leading-tight tabular-nums text-emerald-700">
              {eur(spesa.totale)}
            </span>
          </span>
        </button>

        {/*  I costi: quando non ce ne sono lo dice con un trattino, invece di
            mostrare uno zero — «€ 0,00» su una pratica in cui nessuno li ha
            ancora scritti è una bugia che sembra un dato. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCostiAperti(true);
          }}
          aria-haspopup="dialog"
          title={`Scrivi i costi avuti su ${nomeDi(lead)}`}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-left transition hover:bg-slate-50"
        >
          <span className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500">
              Costi
            </span>
            <span className="text-[14px] font-semibold leading-tight tabular-nums text-rose-700">
              {costi > 0 ? eur(costi) : "—"}
            </span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        </button>

        <span
          className={cn(
            "flex shrink-0 flex-col justify-center whitespace-nowrap px-3.5 py-1.5",
            netto < 0 ? "bg-rose-50" : "bg-emerald-50",
          )}
          title="Quello che il cliente ha lasciato in tutto, meno i costi scritti su questa pratica. L'IVA non è scorporata e le spese fisse del mese non ci sono: il margine vero sta nella pagina dei numeri."
        >
          <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-slate-500">
            Netto
          </span>
          <span
            className={cn(
              "text-[18px] font-bold leading-tight tabular-nums",
              //  Un netto negativo non si nasconde e non si ferma a zero:
              //  quella pratica ha perso denaro, ed è la cosa più utile che
              //  questa fascia possa dire.
              netto < 0 ? "text-rose-700" : "text-emerald-700",
            )}
          >
            {eur(netto)}
          </span>
        </span>
      </div>
      {finestre}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA LINEA DEL TEMPO — tre archivi diversi, una lettura sola
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ TUTTO INSIEME E NON TRE ELENCHI ────────────────────────────────
 *  Quello che è successo a un cliente sta in tre posti diversi per ottime
 *  ragioni loro: l'impianto è un fatto che capita una volta (`installazione`),
 *  gli acquisti sono righe libere (`acquistiDettaglio`), le manutenzioni sono
 *  una cosa che continua per anni (`manutenzione.appuntamenti`). Ma chi apre
 *  questa finestra non ha in testa tre archivi: ha in testa UNA persona e la
 *  domanda «cosa è successo con lui, e in che ordine».
 *
 *  ⚠️ NON SI SOMMA NIENTE QUI DENTRO. I totali restano quelli di
 *   `crm/acquisti.ts` — compreso il criterio per cui un ritorno FISSATO non è
 *   denaro speso. Se questa funzione si mettesse anche a contare, la striscia
 *   in cima e l'elenco qui sotto potrebbero un giorno dire due cifre diverse
 *   sulla stessa persona, ed è esattamente la cosa che fa perdere fiducia a
 *   tutti e due i numeri.
 *
 *  ⚠️ CHI NON HA DATA VA IN FONDO, non in cima. Ordinando per stringa vuota
 *   una riga senza data risalirebbe prima di tutte — cioè la voce di cui si sa
 *   MENO aprirebbe la storia del cliente. */
interface VoceStorico {
  id: string;
  /** ISO YYYY-MM-DD, oppure "" quando quel fatto non ha una data */
  quando: string;
  genere: "impianto" | "acquisto" | "manutenzione";
  titolo: string;
  nota?: string;
  importo: number;
  /** solo per le manutenzioni: dice se è stata fatta, saltata o è ancora da fare */
  stato?: StatoManutenzione;
  /** solo gli acquisti si tolgono da qui: l'impianto e le manutenzioni si
   *  correggono dove si registrano, non da una finestra di lettura */
  togliId?: string;
}

function storicoDi(lead: Lead): VoceStorico[] {
  const voci: VoceStorico[] = [];

  //  1 · L'IMPIANTO. C'è solo se è stato consegnato: un impianto programmato
  //  non è ancora successo, e in una storia non ci va.
  const inst = lead.data.installazione;
  const consegnato = String(inst?.completataIl ?? "").trim();
  if (consegnato) {
    const id = String(inst?.idImpianto ?? "").trim();
    voci.push({
      id: "impianto",
      quando: consegnato,
      genere: "impianto",
      titolo: "Impianto consegnato",
      nota: id ? `ID ${id}` : undefined,
      importo: prezzoDellaVendita(lead),
    });
  }

  //  2 · GLI ACQUISTI, così come sono stati scritti.
  for (const a of acquistiDi(lead)) {
    voci.push({
      id: `acquisto:${a.id}`,
      quando: String(a.data ?? ""),
      genere: "acquisto",
      titolo: a.prodotto,
      importo: Number(a.importo) || 0,
      togliId: a.id,
    });
  }

  //  3 · LE MANUTENZIONI, TUTTE — anche saltate e ancora da fare. Mostrare le
  //  sole fatte darebbe un cliente modello di uno che ha saltato tre ritorni su
  //  quattro, ed è proprio il contrario di quello che si sta cercando quando si
  //  apre la storia di qualcuno.
  //  La data buona è quella in cui è stata FATTA davvero, quando c'è: una
  //  manutenzione fissata a marzo ed eseguita a maggio, in una linea del tempo,
  //  è successa a maggio.
  for (const m of manutenzioniDi(lead.data)) {
    voci.push({
      id: `manutenzione:${m.id}`,
      quando: String(m.fattaIl ?? m.data ?? ""),
      genere: "manutenzione",
      titolo: "Manutenzione",
      nota: m.note ? String(m.note) : undefined,
      importo: Number(m.importo) || 0,
      stato: m.stato,
    });
  }

  //  Dal più recente. Le voci senza data restano in coda (vedi la nota sopra).
  return voci.sort((a, b) => {
    if (!a.quando && !b.quando) return 0;
    if (!a.quando) return 1;
    if (!b.quando) return -1;
    return b.quando.localeCompare(a.quando);
  });
}

const ASPETTO: Record<
  VoceStorico["genere"],
  { icona: typeof Wrench; anello: string; testo: string }
> = {
  impianto: { icona: Wrench, anello: "bg-sky-100", testo: "text-sky-700" },
  acquisto: { icona: ShoppingBag, anello: "bg-amber-100", testo: "text-amber-700" },
  manutenzione: { icona: Repeat, anello: "bg-emerald-100", testo: "text-emerald-700" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA FINESTRA — l'elenco, il totale, e la riga per aggiungerne una
   ═════════════════════════════════════════════════════════════════════════ */

function FinestraSpesa({ lead, onChiudi }: { lead: Lead; onChiudi: () => void }) {
  const { updateLead } = useCRM();
  const [titolo, setTitolo] = useState("");
  const [importo, setImporto] = useState("");
  const [salvando, setSalvando] = useState(false);

  //  Si legge dal lead a ogni ridisegno e non da una copia in stato: dopo il
  //  salvataggio il contesto rimanda giù la scheda aggiornata, e una copia
  //  presa all'apertura mostrerebbe l'elenco di prima.
  const voci = acquistiDi(lead);
  const spesa = spesaDelCliente(lead);
  //  ⚠️ La linea del tempo si ricalcola quando la scheda cambia e non a ogni
  //   tasto premuto nei due campi qui sotto: si scrive col cliente davanti, e
  //   rifare l'ordinamento a ogni lettera è lavoro pagato per niente.
  const storico = useMemo(() => storicoDi(lead), [lead]);
  const quanteFatte = manutenzioniDi(lead.data).filter((m) => m.stato === "fatta").length;
  const cifra = Number(String(importo).replace(",", "."));
  const puoAggiungere = !salvando && Number.isFinite(cifra) && cifra > 0;

  const aggiungi = async () => {
    if (!puoAggiungere) return;
    setSalvando(true);
    //  ⚠️ SI SCRIVONO ENTRAMBI I CAMPI. `acquisti` è il CONTATORE che le
    //   pagine vecchie leggono da sole (contaAcquisti in types.ts): scrivere
    //   solo il dettaglio lascerebbe il numero fermo a ieri sulla scheda del
    //   cliente e nella giornata dell'installatore. La regola di allineamento
    //   è quella che StoricoAcquisti applica già da sempre.
    const righe = conAcquisto(lead, { titolo, importo: cifra });
    const ok = await updateLead(lead.id, {
      acquistiDettaglio: righe,
      acquisti: righe.length,
    });
    setSalvando(false);
    if (!ok) {
      toast.error("Non è stato salvato", {
        description: "La scheda in archivio è rimasta com'era: riprova.",
      });
      return;
    }
    //  I campi si svuotano solo a scrittura avvenuta: se fallisce, quello che
    //  era stato digitato è ancora lì e si riprova senza ridigitarlo.
    setTitolo("");
    setImporto("");
  };

  const togli = async (id: string, quale: string) => {
    if (salvando) return;
    setSalvando(true);
    const rimaste = senzaAcquisto(lead, id);
    const ok = await updateLead(lead.id, {
      acquistiDettaglio: rimaste,
      acquisti: rimaste.length,
    });
    setSalvando(false);
    if (!ok) {
      toast.error("Non è stato tolto: riprova.");
      return;
    }
    toast.success(`Tolto «${quale}»`);
  };

  return (
    <Finestra
      aperta
      onCambio={(v) => {
        if (!v) onChiudi();
      }}
      titolo="Storico cliente"
      contesto={`${nomeDi(lead)} · ${eur(spesa.totale)} in tutto`}
      icona={Receipt}
      larghezza="md"
      classeCorpo="flex flex-col gap-3"
      azioni={
        <Button variant="outline" onClick={onChiudi}>
          Chiudi
        </Button>
      }
    >
      {/*  ── I TRE NUMERI, PRIMA DI TUTTO IL RESTO ─────────────────────────
          Chi apre questa finestra ha in testa una domanda sola, e cambia
          poco: «quanto mi ha lasciato», «quante volte è tornato», «cosa ha
          preso». Stanno in cima, grandi, prima di qualunque elenco: se per
          rispondere bisogna leggere una lista, la risposta non si legge. */}
      <div className="grid grid-cols-3 gap-2">
        <KpiFinestra
          etichetta="Speso in tutto"
          valore={eur(spesa.totale)}
          nota="impianto, acquisti e ritorni"
          forte
        />
        <KpiFinestra
          etichetta="Manutenzioni"
          valore={String(quanteFatte)}
          nota={quanteFatte > 0 ? `${eur(spesa.manutenzioni)} fatturati` : "nessun ritorno fatto"}
        />
        <KpiFinestra
          etichetta="Acquisti"
          valore={String(voci.length)}
          nota={voci.length > 0 ? eur(spesa.acquisti) : "niente dopo l'impianto"}
        />
      </div>

      {/*  ── DA COSA È FATTO IL TOTALE ──────────────────────────────────────
          Tre righe e non un numero solo: «ha speso 1.450 €» senza il dettaglio
          non si può controllare, e il primo che non torna fa perdere fiducia a
          tutti gli altri. */}
      <SezioneFinestra titolo="Il conto" nota="Come si arriva a quel totale.">
        <div className="flex flex-col gap-1 text-[12.5px]">
          <Riga etichetta="L'impianto" valore={spesa.vendita} />
          <Riga etichetta="Acquisti registrati" valore={spesa.acquisti} />
          <Riga etichetta="Manutenzioni fatte" valore={spesa.manutenzioni} />
          <div className="mt-1 flex items-baseline justify-between border-t border-border pt-1.5 font-semibold">
            <span>In tutto</span>
            <span className="tabular-nums">{eur(spesa.totale)}</span>
          </div>
        </div>
        {/*  ⚠️ IL PREVISTO SI DICE, MA FUORI DAL TOTALE. Un ritorno già
            fissato con un prezzo sopra non è denaro speso: sommarlo direbbe
            che il cliente ha lasciato dei soldi che potrebbe non lasciare mai
            (il perché per esteso sta in crm/acquisti.ts). */}
        {spesa.attese > 0 && (
          <NotaFinestra>
            Ci sono {eur(spesa.attese)} su ritorni già fissati ma non ancora fatti: non sono in
            questo totale, perché non sono ancora stati spesi.
          </NotaFinestra>
        )}
      </SezioneFinestra>

      {/*  ── COSA È SUCCESSO, IN ORDINE ─────────────────────────────────────
          Un elenco solo, dal più recente: l'impianto, quello che ha comprato
          dopo e ogni ritorno. Il colore dell'icona dice di che si tratta senza
          bisogno di leggere; l'importo sta a destra, incolonnato, perché è la
          colonna che l'occhio scorre. */}
      <SezioneFinestra
        titolo="Cosa è successo"
        nota="Dall'ultima cosa alla prima: impianto, acquisti e ritorni insieme."
      >
        {storico.length === 0 ? (
          <p className="text-[12px] leading-snug text-muted-foreground">
            Ancora niente da raccontare. La prima voce si scrive qui sotto.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {storico.map((v) => {
              const look = ASPETTO[v.genere];
              const Icona = look.icona;
              //  Un ritorno ancora da fare non è denaro speso: l'importo si
              //  mostra lo stesso — serve sapere quanto costerà — ma sbiadito,
              //  perché non è nella colonna dei soldi entrati.
              const speso = v.genere !== "manutenzione" || v.stato === "fatta";
              return (
                <li key={v.id} className="flex items-center gap-2.5 py-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      look.anello,
                    )}
                  >
                    <Icona className={cn("h-3.5 w-3.5", look.testo)} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{v.titolo}</span>
                      {/*  Lo stato si scrive solo quando NON è «fatta»: una
                          riga su tre con scritto «fatta» accanto è rumore, e
                          quello che si cerca in un colpo d'occhio è la volta
                          che è saltata. */}
                      {v.stato && v.stato !== "fatta" && (
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-1.5 py-px text-[10px] font-semibold",
                            v.stato === "saltata"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {ETICHETTA_STATO_MANUTENZIONE[v.stato]}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {v.quando ? dataBreve(v.quando) : "senza data"}
                      {v.nota ? ` · ${v.nota}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[13px] font-semibold tabular-nums",
                      speso ? "" : "text-muted-foreground",
                    )}
                  >
                    {v.importo > 0 ? eur(v.importo) : "—"}
                  </span>
                  {/*  Si toglie solo quello che si è scritto DA QUI. L'impianto
                      e i ritorni si correggono dove si registrano: un cestino
                      in una finestra di lettura, accanto a righe che vengono da
                      altri archivi, è un modo di cancellare per sbaglio una
                      posa. */}
                  {v.togliId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-1.5 text-muted-foreground hover:text-rose-600"
                      disabled={salvando}
                      onClick={() => void togli(v.togliId as string, v.titolo)}
                      title={`Togli «${v.titolo}» dal conto`}
                      aria-label={`Togli ${v.titolo}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="w-8 shrink-0" aria-hidden />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SezioneFinestra>

      {/*  ── AGGIUNGERNE UNA ────────────────────────────────────────────────
          Due campi e un pulsante, sulla stessa riga: si registra col cliente
          davanti, e ogni campo in più è un motivo per rimandare a dopo — cioè
          per non scriverlo mai. La data è oggi e non si chiede: chi registra
          in ritardo è un caso raro, e per lui c'è la scheda. */}
      <SezioneFinestra titolo="Aggiungi">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <CampoFinestra etichetta="Cosa ha comprato" className="min-w-0 flex-1">
            <Input
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Secondo impianto, taglio, prodotti…"
              disabled={salvando}
              //  ⌥ Invio salva: si scrive col cliente davanti e staccare la
              //  mano dalla tastiera per cercare il pulsante costa più del
              //  gesto stesso.
              onKeyDown={(e) => {
                if (e.key === "Enter") void aggiungi();
              }}
            />
          </CampoFinestra>
          <CampoFinestra etichetta="Importo" className="sm:w-28">
            <Input
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              inputMode="decimal"
              placeholder="€"
              disabled={salvando}
              onKeyDown={(e) => {
                if (e.key === "Enter") void aggiungi();
              }}
            />
          </CampoFinestra>
          <Button
            className="shrink-0"
            disabled={!puoAggiungere}
            onClick={() => void aggiungi()}
            title={
              puoAggiungere
                ? "Aggiunge la voce al conto di questo cliente"
                : "Serve un importo maggiore di zero"
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {salvando ? "Salvo…" : "Aggiungi"}
          </Button>
        </div>
      </SezioneFinestra>
    </Finestra>
  );
}

/** Una riga del conto. Lo zero si scrive lo stesso — «acquisti 0 €» dice che
 *  quella voce esiste e che nessuno ci ha ancora messo niente, mentre una riga
 *  che sparisce si legge come «qui non si può registrare». */
function Riga({ etichetta, valore }: { etichetta: string; valore: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={valore > 0 ? "" : "text-muted-foreground"}>{etichetta}</span>
      <span className={cn("tabular-nums", valore > 0 ? "" : "text-muted-foreground")}>
        {eur(valore)}
      </span>
    </div>
  );
}
