/** ── IL CONTO DI UNA PRATICA, IN UN POSTO SOLO ─────────────────────────────
 *
 *  Richiesta del committente: «fai che posso cambiare l'importo che ha pagato
 *  da qui, acconto, sconti, costi ecc ecc, e aggiungi una voce per farlo».
 *
 *  ── PERCHÉ ESISTE ────────────────────────────────────────────────────────
 *  I numeri di una pratica si scrivevano in tre momenti diversi — registrando
 *  la vendita, incassando il saldo, registrando la posa — e ognuno di quei tre
 *  momenti è una PORTA: si apre quando succede qualcosa. Ma i numeri sbagliati
 *  non aspettano che succeda qualcosa: l'acconto preso in mano e mai segnato,
 *  lo sconto fatto a voce, il corriere pagato la settimana dopo. Per correggerli
 *  bisognava far finta che stesse succedendo un'altra cosa — riaprire la
 *  chiusura, rifare l'incasso — e chi non voleva rischiare lasciava il numero
 *  sbagliato lì.
 *  Questa finestra non registra niente: CORREGGE. Si apre dal menu «…» di una
 *  posa e mostra il conto com'è, per intero, modificabile.
 *
 *  ── ⚠️ NON INVENTA UN SECONDO MODO DI CONTARE ────────────────────────────
 *  Ogni cifra qui è un campo che il resto del CRM legge già: `prezzoTotale` e
 *  `prezzoFinaleVendita` (il listino e il prezzo chiuso), `accontoPagato`,
 *  `incassoTracciato`/`incassoContanti`, `payment.costi.altri`. Il margine, le
 *  tasse e le KPI si aggiornano da soli perché guardano quei campi — non c'è
 *  nessun conto nuovo da tenere allineato.
 *
 *  ── ⚠️ I TRE COSTI FISSI NON SI TOCCANO DA QUI ───────────────────────────
 *  Impianto, installatore e parrucchiere hanno già la loro finestra
 *  (crm/FinestraCosti), e due moduli che scrivono gli stessi tre campi sono il
 *  modo più rapido per averne uno che dimentica una regola. Qui si vedono
 *  sommati, con il tasto che apre quella finestra.
 *
 *  ── ⚠️ SI SALVA A MANO, TUTTO INSIEME ────────────────────────────────────
 *  Niente salvataggio a ogni tasto: si scrivono soldi, e una cifra parziale —
 *  «1», «12», «120» — finirebbe in archivio e nel margine senza che nessuno
 *  l'abbia confermata. Una `updateLead` sola: due di fila partono dalla stessa
 *  copia vecchia e la seconda cancella quello che ha scritto la prima.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCRM } from "./CRMContext";
import { divisioneMovimento } from "./canale-incasso";
import {
  altriCosti,
  giaIncassato,
  nuovoIdVoce,
  prezzoScontato,
  prezzoVendita,
  saldoAllaConsegna,
  totaleCostiPratica,
} from "./costi-pratica";
import { leggiEuro, scriviEuro } from "./euro";
import { contoIva, modoDaBooleano } from "./iva";
import type { Lead, LeadData, PaymentInfo, VoceCosto } from "./types";
import { eur } from "./ui";
import {
  CampoFinestra,
  CLASSE_CAMPO,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
} from "./ui/Finestra";

const nomeDi = (l: Lead) => `${l.data?.nome || ""} ${l.data?.cognome || ""}`.trim() || "Senza nome";

/** Riga di costo mentre la si scrive: l'importo è TESTO, non un numero.
 *  ⚠️ Rileggerlo a ogni tasto con `leggiEuro` e riscriverlo con `scriviEuro`
 *   impedisce di battere la virgola — «12,» diventa «12» sotto le dita. */
type RigaCosto = { id: string; titolo: string; testo: string };

export function FinestraConto({
  lead,
  aperta,
  onCambio,
  onApriCostiFissi,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** apre la finestra dei tre costi fissi, che qui non si toccano */
  onApriCostiFissi?: () => void;
}) {
  const { updateLead } = useCRM();
  const [prezzo, setPrezzo] = useState("");
  const [sconto, setSconto] = useState("");
  const [incassato, setIncassato] = useState("");
  /** Il taglio fra tracciato e contante SUL TOTALE incassato. Due caselle che
   *  si riempiono a vicenda: quello che si batte in una diventa il resto
   *  nell'altra, quindi non possono contraddirsi. "" = non dichiarato, che è
   *  diverso da zero (zero vuol dire «tutto tracciato»). */
  const [contanti, setContanti] = useState("");
  const [tracciato, setTracciato] = useState("");
  const [costi, setCosti] = useState<RigaCosto[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aperta) return;
    //  Si riparte SEMPRE da quello che c'è in archivio: una modifica lasciata a
    //  metà nell'apertura precedente — magari su un altro cliente, sulla stessa
    //  riga riusata — è il modo più silenzioso di scrivere una cifra sbagliata.
    const p = lead.data.payment;
    const chiuso = prezzoVendita(lead);
    const listino = Number(p?.prezzoTotale ?? 0) || 0;
    /*  ── IL PREZZO DI PARTENZA ─────────────────────────────────────────────
        Il listino se c'è (una pratica scontata lo tiene), altrimenti il prezzo
        chiuso; e sulle pratiche d'archivio senza prezzo si ricava da cassa e
        residuo, che è la stessa cifra di ripiego di `incassaSaldo`. Due letture
        diverse dello stesso prezzo vorrebbero dire due prezzi. */
    const versato = giaIncassato(lead);
    const partenza =
      listino > 0 ? listino : chiuso > 0 ? chiuso : versato + saldoAllaConsegna(lead);
    setPrezzo(partenza > 0 ? scriviEuro(partenza) : "");
    //  Lo sconto non è un campo in archivio: è la distanza fra i due prezzi.
    //  Si ricava, così la finestra si riapre dicendo la stessa cosa che ha
    //  salvato — e due cifre uguali non sono uno sconto.
    setSconto(chiuso > 0 && partenza > chiuso ? scriviEuro(partenza - chiuso) : "");
    setIncassato(versato > 0 ? scriviEuro(versato) : "");
    const inMano = p?.incassoContanti;
    setContanti(inMano === undefined ? "" : scriviEuro(Number(inMano) || 0));
    setTracciato(
      inMano === undefined ? "" : scriviEuro(Math.max(0, versato - (Number(inMano) || 0))),
    );
    setCosti(
      altriCosti(lead.data).map((v) => ({
        id: v.id,
        titolo: v.titolo,
        testo: v.importo > 0 ? scriviEuro(v.importo) : "",
      })),
    );
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperta, lead.id]);

  /* ── I CONTI, UNA VOLTA SOLA ──────────────────────────────────────────── */
  const listino = Math.max(0, leggiEuro(prezzo));
  const scontato = Math.min(Math.max(0, leggiEuro(sconto)), listino);
  const chiuso = prezzoScontato(listino, scontato);
  /*  ⚠️ NON SI TAGLIA A QUELLO CHE DOVEVA PAGARE. Un cliente che ha versato
      più del dovuto esiste (un acconto su un prezzo poi sceso, un arrotondamento
      per eccesso), e limitare la cifra mentre la si scrive vorrebbe dire
      cambiare di nascosto un numero che qualcuno sta guardando. Il residuo,
      quello sì, non va sotto zero: «−70 € da incassare» non vuol dire niente. */
  const inCassa = Math.max(0, leggiEuro(incassato));
  const resta = Math.max(0, chiuso - inCassa);
  const dichiarato = contanti.trim() !== "";
  const canale =
    divisioneMovimento(inCassa, dichiarato ? leggiEuro(contanti) : undefined) ??
    ({ tracciato: inCassa, contanti: 0 } as const);
  const righePulite: VoceCosto[] = costi
    .map((r) => ({ id: r.id, titolo: r.titolo.trim(), importo: Math.max(0, leggiEuro(r.testo)) }))
    //  Le righe senza titolo E senza importo si buttano: sono i «+» premuti per
    //  sbaglio, e salvarle vorrebbe dire una voce vuota che a ogni riapertura
    //  torna lì a chiedere cosa fosse.
    .filter((r) => r.titolo !== "" || r.importo > 0);
  const costiTotali = totaleCostiPratica({
    payment: { ...lead.data.payment, costi: { ...lead.data.payment?.costi, altri: righePulite } },
  });
  const costiFissi = costiTotali - righePulite.reduce((s, r) => s + r.importo, 0);
  /*  ⚠️ IL MARGINE SI CONTA COME LO CONTA LA PAGINA KPI, scheda per scheda:
      prezzo chiuso, meno l'IVA che ci sta dentro, meno tutti i costi. NON
      toglie la pubblicità, che è una spesa del mese e non di un cliente: per
      questo l'etichetta lo dice, invece di far credere che sia l'utile. */
  const modo = modoDaBooleano(lead.data.payment?.costi?.ivaInclusa !== false);
  const conto = contoIva(chiuso, modo);
  const margine = chiuso - conto.imposta - costiTotali;

  /*  ── LE DUE CASELLE CHE NON POSSONO CONTRADDIRSI ─────────────────────── */
  const restoDi = (testo: string) =>
    scriviEuro(Math.max(0, inCassa - Math.min(Math.max(0, leggiEuro(testo)), inCassa)));
  const scriviContanti = (v: string) => {
    setContanti(v);
    setTracciato(v.trim() === "" ? "" : restoDi(v));
  };
  const scriviTracciato = (v: string) => {
    setTracciato(v);
    setContanti(v.trim() === "" ? "" : restoDi(v));
  };
  const scriviQuote = (inMano: string) => {
    setContanti(inMano);
    setTracciato(inMano.trim() === "" ? "" : restoDi(inMano));
  };

  const salva = async () => {
    if (salvando) return;
    setSalvando(true);
    /*  ── UN SOLO PACCHETTO ───────────────────────────────────────────────
        `updateLead` sostituisce `payment` per intero: si riparte da quello che
        c'è e si riscrive solo ciò che questa finestra governa. Lo stato del
        pagamento non si scrive a mano — lo ricalcola `applyAutoStatus` dentro
        `updateLead`, come per ogni altra scrittura in cassa. */
    /*  ── ⚠️ SI RIPARTE DA QUELLO CHE C'È IN ARCHIVIO ADESSO ───────────
        `payment` si riscrive per intero, quindi comporlo sulla copia che il
        browser ha in memoria vuol dire riportare indietro tutto ciò che un
        collega ci ha scritto dentro nel frattempo — un incasso registrato in
        cassa da un'altra postazione, una riga di costo. Qui dentro si
        scrivono soldi: la modifica si compone su `attuale`, cioè sulla riga
        appena riletta dall'archivio (vedi crm/patch-scheda). */
    const componi = (attuale: LeadData): PaymentInfo => ({
      ...(attuale.payment ?? {}),
      //  ⚠️ DUE CIFRE, DUE CAMPI: il listino e il prezzo chiuso. Scriverne una
      //   sola vorrebbe dire non sapere più quanto si è scontato — ed è l'unica
      //   cosa che, riaprendo questa finestra, permette di rileggere lo sconto.
      ...(listino > 0 ? { prezzoTotale: listino } : {}),
      prezzoFinaleVendita: chiuso,
      accontoPagato: inCassa,
      saldoRimanente: resta,
      //  ⚠️ Si scrivono SOLO se qualcuno ha dichiarato: su una pratica dove
      //   nessuno ha detto niente, «tutto tracciato» sarebbe una dichiarazione
      //   mai fatta, e le schede vecchie non devono cambiare per il fatto di
      //   essere state aperte.
      ...(dichiarato
        ? { incassoTracciato: canale.tracciato, incassoContanti: canale.contanti }
        : {}),
      costi: { ...(attuale.payment?.costi ?? {}), altri: righePulite },
    });
    const ok = await updateLead(lead.id, (attuale) => ({ payment: componi(attuale) }));
    setSalvando(false);
    if (!ok) {
      //  ⚠️ La conferma si dà DOPO aver guardato la risposta: `updateLead`
      //   torna `false` quando in archivio non è stato scritto niente, e qui
      //   dentro si scrivono soldi. Un «salvato ✓» su una scrittura mai
      //   avvenuta è il modo più veloce per perderli senza accorgersene.
      toast.error("Conto NON salvato", {
        description: "La scheda in archivio è rimasta com'era. Riprova.",
      });
      return;
    }
    onCambio(false);
    toast.success(`Conto aggiornato · ${nomeDi(lead)}`, {
      description: `Prezzo ${eur(chiuso)}${scontato > 0 ? ` (sconto ${eur(scontato)})` : ""} · incassati ${eur(inCassa)} · restano ${eur(resta)}.`,
    });
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      larghezza="md"
      icona={Wallet}
      titolo="Il conto della pratica"
      contesto={`${nomeDi(lead)} · si corregge quello che è già stato scritto`}
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button variant="ghost" onClick={() => onCambio(false)} disabled={salvando}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={salvando}>
            {salvando ? "Salvo…" : "Salva il conto"}
          </Button>
        </>
      }
    >
      <SezioneFinestra titolo="Quanto costa e quanto è entrato" classeCorpo="p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoFinestra etichetta="Prezzo della pratica (€)" nota="Quello concordato, prima dello sconto">
            <Input
              value={prezzo}
              onChange={(e) => setPrezzo(e.target.value)}
              inputMode="decimal"
              placeholder="€"
              disabled={salvando}
            />
          </CampoFinestra>
          <CampoFinestra etichetta="Sconto fatto (€)" nota="Quanto gli hai tolto sul prezzo">
            <Input
              value={sconto}
              onChange={(e) => setSconto(e.target.value)}
              inputMode="decimal"
              placeholder="nessuno sconto"
              disabled={salvando}
            />
          </CampoFinestra>
        </div>
        <CampoFinestra
          etichetta="Incassato finora (€)"
          nota="Tutto quello che ha pagato fino a oggi: acconto e saldo insieme"
        >
          <Input
            value={incassato}
            onChange={(e) => setIncassato(e.target.value)}
            inputMode="decimal"
            placeholder="€"
            disabled={salvando}
          />
        </CampoFinestra>

        {/*  La frase di controllo: è quella che si rilegge prima di salvare, e
            tre numeri in riga si confrontano meglio di tre campi. */}
        <NotaFinestra tono={resta > 0 ? "attenzione" : undefined}>
          Prezzo chiuso {eur(chiuso)}
          {scontato > 0 ? ` (listino ${eur(listino)}, sconto ${eur(scontato)})` : ""} — incassati{" "}
          {eur(inCassa)}
          {resta > 0 ? `, restano ${eur(resta)} da prendere.` : ", non resta niente da prendere."}
        </NotaFinestra>
      </SezioneFinestra>

      {/* ── ⚠️ COM'È ENTRATO ──────────────────────────────────────────────
          Riguarda il TOTALE incassato, non un singolo versamento: la parte in
          contanti può stare nell'acconto, nel saldo o in tutti e due, e legarla
          a un solo momento vorrebbe dire non poterla dichiarare. */}
      {inCassa > 0 && (
        <SezioneFinestra
          titolo="Come sono entrati"
          nota="Facoltativo: serve a sapere quale parte è passata dalla banca"
          classeCorpo="p-4 space-y-2"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                di cui tracciato (€)
              </span>
              <Input
                inputMode="decimal"
                value={tracciato}
                onChange={(e) => scriviTracciato(e.target.value)}
                placeholder="facoltativo"
                disabled={salvando}
                className={cn(CLASSE_CAMPO, "h-9 w-[7.5rem] text-[14px] tabular-nums")}
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                di cui in contanti (€)
              </span>
              <Input
                inputMode="decimal"
                value={contanti}
                onChange={(e) => scriviContanti(e.target.value)}
                placeholder="facoltativo"
                disabled={salvando}
                className={cn(CLASSE_CAMPO, "h-9 w-[7.5rem] text-[14px] tabular-nums")}
              />
            </label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              <Pillola
                attiva={dichiarato && canale.contanti === 0}
                onClick={() => scriviQuote("0")}
                titolo="Bonifico, carta o POS: tutto tracciato"
              >
                tutto tracciato
              </Pillola>
              <Pillola
                attiva={dichiarato && canale.contanti === inCassa}
                onClick={() => scriviQuote(scriviEuro(inCassa))}
                titolo="Tutto in mano, niente dalla banca"
              >
                tutto contanti
              </Pillola>
              {dichiarato && (
                <Pillola onClick={() => scriviQuote("")} titolo="Torna a non dichiararlo">
                  non lo dico
                </Pillola>
              )}
            </div>
          </div>
          <p className="text-[11.5px] text-slate-600">
            {dichiarato ? (
              <>
                Di {eur(inCassa)} incassati: <span className="font-medium">{eur(canale.tracciato)}</span>{" "}
                tracciati (bonifico, carta o POS) e{" "}
                <span className="font-medium">{eur(canale.contanti)}</span> in contanti.
              </>
            ) : (
              <>Non dichiarato: la scheda non dice quale parte è passata dalla banca.</>
            )}
          </p>
        </SezioneFinestra>
      )}

      {/* ── I COSTI ───────────────────────────────────────────────────────── */}
      <SezioneFinestra
        titolo="Costi di questa pratica"
        nota="Si sottraggono dal profitto"
        classeCorpo="p-4 space-y-2"
        azioni={
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11.5px]" onClick={aggiungi}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Aggiungi
          </Button>
        }
      >
        {costi.length === 0 ? (
          <p className="text-[11.5px] text-slate-600">
            Corriere, rimborso benzina, un ritocco: quello che hai speso per questo cliente.
          </p>
        ) : (
          costi.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <Input
                value={r.titolo}
                onChange={(e) => cambia(r.id, { titolo: e.target.value })}
                placeholder="Corriere, rimborso, ritocco…"
                disabled={salvando}
                className={cn(CLASSE_CAMPO, "h-9 min-w-0 flex-1 text-[14px]")}
              />
              <Input
                value={r.testo}
                onChange={(e) => cambia(r.id, { testo: e.target.value })}
                inputMode="decimal"
                placeholder="€"
                disabled={salvando}
                className={cn(CLASSE_CAMPO, "h-9 w-24 shrink-0 text-[14px] tabular-nums")}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 shrink-0 px-2 text-muted-foreground hover:text-rose-600"
                onClick={() => togli(r.id)}
                disabled={salvando}
                title={`Togli «${r.titolo || "questa voce"}»`}
                aria-label="Togli questa voce"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}

        {/*  ⚠️ I TRE COSTI FISSI SI VEDONO MA NON SI TOCCANO: hanno la loro
            finestra, e due moduli che scrivono gli stessi tre campi sono il
            modo più rapido per averne uno che dimentica una regola. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
          <p className="text-[11.5px] text-slate-600">
            Impianto, installatore e parrucchiere: <span className="font-medium">{eur(costiFissi)}</span>
            {onApriCostiFissi ? " — si cambiano nella finestra dei costi." : ""}
          </p>
          {onApriCostiFissi && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11.5px]"
              onClick={() => {
                onCambio(false);
                onApriCostiFissi();
              }}
            >
              Apri i costi
            </Button>
          )}
        </div>

        <p className="text-[11.5px] text-slate-600">
          Costi della pratica <span className="font-medium">{eur(costiTotali)}</span> — resta{" "}
          <span className={cn("font-medium", margine < 0 ? "text-rose-700" : "text-emerald-700")}>
            {eur(margine)}
          </span>{" "}
          di margine, IVA esclusa. Non conta la pubblicità, che è una spesa del mese.
        </p>
      </SezioneFinestra>
    </Finestra>
  );

  function cambia(id: string, dati: Partial<RigaCosto>) {
    setCosti((righe) => righe.map((r) => (r.id === id ? { ...r, ...dati } : r)));
  }
  function togli(id: string) {
    setCosti((righe) => righe.filter((r) => r.id !== id));
  }
  function aggiungi() {
    setCosti((righe) => [...righe, { id: nuovoIdVoce(), titolo: "", testo: "" }]);
  }
}
