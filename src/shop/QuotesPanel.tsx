// ── PREVENTIVI ATTIVI ───────────────────────────────────────────────────────
//  Il pannello che il consulente apre dalla barra: qui stanno TUTTI i preventivi
//  già creati, si cercano per nome/telefono/email/numero, si vede a colpo d'occhio
//  se le condizioni sono ancora valide, e si modificano senza uscire dalla pagina.
//
//  Cosa si può fare su ogni riga, senza aprirla:
//   · cambiare la quantità di impianti;
//   · applicare uno sconto aggiuntivo;
//   · RIAPRIRE le condizioni scadute decidendo per quanti giorni valgono;
//   · copiare il link da mandare al cliente;
//   · aprire il preventivo a schermo intero;
//   · ELIMINARLO, con una conferma che dice di chi è, quanto vale e che cosa
//     sparisce insieme a lui — compresa l'anteprima che il cliente potrebbe
//     essersi già visto arrivare su WhatsApp.
//
//  Il CODICE CONSULENTE è l'unica chiave che autorizza una modifica, e resta
//  mascherato mentre lo si digita: si può usare davanti al cliente in
//  videochiamata senza mostrarlo. Viene ricordato finché il pannello resta
//  aperto, così non va ridigitato a ogni preventivo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Search, FileText, Copy, ExternalLink, Clock, CheckCircle2, Film, MessageCircle, Trash2, StickyNote, AlertTriangle, PauseCircle, PlayCircle, Eye, EyeOff, Hash } from "lucide-react";
import { toast } from "sonner";
import { promoDeadline } from "@/shop/quote-menu";
import { getLiveId, setPresenterPage } from "@/shop/live";
import { setLookup } from "@/shop/lookup";
import { copyLink } from "@/shop/copied";
import { linkPreventivo } from "@/shop/quote-link";
//  Il numero di un preventivo e la causale del suo bonifico: che cosa si può
//  scrivere, e che frase ne esce. Le regole stanno lì, provate.
import { normalizzaNumero, perchéNonVa } from "@/shop/numero-preventivo";
import { MODELLO_DI_CASA as CAUSALE_DI_CASA, causaleDi } from "@/shop/causale-bonifico";

interface QRow {
  quote_ref: string; nome: string; cognome: string; email: string; telefono: string;
  total: number; qty: number; created_at: string;
  /** quello che il cliente ha scritto lui nel modulo (allergie, patologie, note) */
  problemi?: string | null; eta?: number | null;
  /** «sostituito» = questo preventivo è stato rifatto e non vale più: il suo
   *  link porta a quello nuovo (api.presenter.quote-revise). Serve QUI, in
   *  questo elenco, perché è la lista da cui si telefona: due righe dello stesso
   *  cliente con due cifre diverse, e nessun segno che dica quale è quella
   *  buona, è il modo più veloce per dire al telefono il prezzo sbagliato. */
  status?: string | null;
}
interface QNote { at: string; by: string; text: string }
interface QEdit { qty?: number; extraEur?: number; promoUntil?: string; note?: string; by?: string; at?: string; notes?: QNote[] }

const input = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none";
const lab = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45";
const eur = (n: number) => (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/** Numero pronto per WhatsApp: solo cifre, prefisso italiano se manca. */
function waNumero(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("39") && d.length >= 11) return d;
  if (d.length >= 9 && d.length <= 10) return "39" + d;
  return d;
}

const giorno = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });

/** Fino a quando valgono le condizioni: la data riaperta dal consulente vince
 *  su quella calcolata alla creazione. */
function validUntil(row: QRow, edit?: QEdit): Date {
  if (edit?.promoUntil) return new Date(edit.promoUntil);
  return promoDeadline(row.created_at);
}

/** Il totale VERO: quello a database non cambia mai, perché le modifiche
 *  (quantità e sconto aggiuntivo) vivono a parte. La formula sta qui, in un
 *  posto solo, perché adesso la legge anche la conferma di cancellazione: due
 *  formule gemelle avrebbero finito per mostrare una cifra nella riga e
 *  un'altra nel riquadro, e chi legge il riquadro sta decidendo se buttare via
 *  proprio quella cifra. */
function totaleDi(row: QRow, edit?: QEdit): number {
  const qta = edit?.qty ?? row.qty ?? 1;
  const perUnit = (Number(row.total) || 0) / Math.max(1, row.qty || 1);
  return Math.max(0, perUnit * qta - (Number(edit?.extraEur) || 0));
}

export function QuotesPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<QRow[]>([]);
  const [edits, setEdits] = useState<Record<string, QEdit>>({});
  const [busy, setBusy] = useState(false);
  /** "tutte" | "valide" | "scadute" — filtro sullo stato delle condizioni */
  const [filtro, setFiltro] = useState<"tutte" | "valide" | "scadute">("tutte");
  /** scheda: trattative in corso oppure sospese */
  const [scheda, setScheda] = useState<"attivi" | "sospesi">("attivi");
  const [sospesi, setSospesi] = useState<Set<string>>(new Set());
  /** I preventivi annullati il cui vecchio documento è stato spento: chi apre
   *  quel link trova solo l'avviso col numero valido. */
  const [muti, setMuti] = useState<Set<string>>(new Set());
  /** preventivi che hanno almeno una registrazione della videochiamata */
  const [conVideo, setConVideo] = useState<Set<string>>(new Set());
  /** ── DI CHI SONO ─────────────────────────────────────────────────────
   *  Con tre consulenti sullo stesso archivio, "tutti i preventivi" non è una
   *  vista utile: ognuno cerca i propri. */
  const [owners, setOwners] = useState<Record<string, { id: string; nome: string }>>({});
  const [chiFiltro, setChiFiltro] = useState<string>("");
  const [scelti, setScelti] = useState<Set<string>>(new Set());   // selezione multipla
  const [canc, setCanc] = useState(false);
  /** Il chiavistello della cancellazione. Sta in un riferimento e non in uno
   *  stato perché deve valere NELL'ISTANTE del secondo clic, non al ridisegno
   *  successivo: `canc` serve a spegnere il tasto e a scriverci sopra
   *  «Elimino…», questo serve a non far partire due richieste. Vedi
   *  `eliminaOra`. */
  const invioInCorso = useRef(false);
  /** ── QUELLO CHE STA PER ESSERE CANCELLATO ─────────────────────────────
   *  Non i numeri: le RIGHE intere. Il riquadro di conferma deve poter dire
   *  «il preventivo di Marco Rossi, 4.850 €», perché IDP7P765 e IDP7P675 si
   *  distinguono solo rileggendoli due volte, e chi ha cliccato la riga
   *  sbagliata se ne accorge dal nome e dalla cifra — finché il riquadro è
   *  aperto costa zero, un secondo dopo non si torna indietro.
   *  `null` = nessuna conferma aperta. */
  const [daEliminare, setDaEliminare] = useState<QRow[] | null>(null);
  /** Se il riquadro di conferma deve chiedere anche il PIN. Deciso UNA volta,
   *  all'apertura, e non ricavato dal PIN mentre lo si scrive: la prima cifra
   *  digitata avrebbe fatto sparire il campo da sotto le dita. */
  const [pinRichiesto, setPinRichiesto] = useState(false);
  const [note, setNote] = useState<string | null>(null);   // riga con le note aperte
  const [testo, setTesto] = useState("");
  /** ── IL PIN SI CHIEDE QUANDO SERVE ────────────────────────────────────
   *  Prima stava in un campo sempre presente nella barra: si dimenticava di
   *  compilarlo e le azioni sembravano non rispondere. Ora l'azione parte, e
   *  se serve autorizzarla si apre un riquadro che spiega COSA sta per
   *  succedere. Una volta digitato resta per tutta la sessione del pannello,
   *  quindi non lo si ridigita a ogni riga. */
  const [chiave, setChiave] = useState("");
  const [pin, setPin] = useState<{ titolo: string; dettaglio: string; esegui: (code: string) => Promise<void> } | null>(null);
  const conAutorizzazione = (titolo: string, dettaglio: string, esegui: (code: string) => Promise<void>) => {
    if (chiave.trim()) { void esegui(chiave.trim()); return; }
    setPin({ titolo, dettaglio, esegui });
  };
  const [salvo, setSalvo] = useState(false);
  /*  ── NUMERO E CAUSALE DI UN PREVENTIVO ────────────────────────────────
      Richiesta del committente: «fai che posso cambiare l'ID del preventivo e
      la causale». Stanno insieme perché sono la stessa cosa vista da due
      parti: il numero è come il documento si chiama, la causale è come lo
      chiama il cliente quando paga — e la seconda cita il primo. */
  const [ritocco, setRitocco] = useState<string | null>(null);
  const [numeroNuovo, setNumeroNuovo] = useState("");
  const [causaleNuova, setCausaleNuova] = useState("");
  const [causaleDiOra, setCausaleDiOra] = useState("");

  // Ogni ricerca ha un numero: chi torna in ritardo viene scartato, altrimenti
  // una risposta lenta di due lettere fa ci sovrascrive quella giusta.
  const genRef = useRef(0);
  const load = useCallback((q: string) => {
    const mia = ++genRef.current;
    setBusy(true);
    fetch(`/api/presenter/quotes?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(async (j) => {
        if (mia !== genRef.current) return;
        const list = (j.list as QRow[]) ?? [];
        setRows(list);
        setSospesi(new Set(((j.suspended as string[]) ?? []).map((x) => x.toUpperCase())));
        setMuti(new Set(((j.soloAvviso as string[]) ?? []).map((x) => x.toUpperCase())));
        if (!list.length) { setEdits({}); return; }
        // le modifiche di tutte le righe in UNA sola chiamata
        try {
          const e = await fetch(`/api/presenter/quote-edit?refs=${encodeURIComponent(list.map((r) => r.quote_ref).join(","))}`)
            .then((r) => r.json());
          if (mia !== genRef.current) return;
          if (e?.error) { toast.error("Stato delle modifiche non disponibile"); return; }
          setEdits((e?.edits as Record<string, QEdit>) ?? {});
        } catch { toast.error("Stato delle modifiche non disponibile"); }
      })
      .catch(() => { if (mia === genRef.current) toast.error("Elenco non raggiungibile"); })
      .finally(() => { if (mia === genRef.current) setBusy(false); });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(term), term ? 300 : 0);
    return () => clearTimeout(t);
  }, [term, load]);

  // quali preventivi hanno una registrazione: una sola chiamata, all'apertura
  useEffect(() => {
    fetch("/api/presenter/quote-owner")
      .then((r) => r.json())
      .then((j) => setOwners((j?.owners as Record<string, { id: string; nome: string }>) ?? {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/presenter/recordings")
      .then((r) => r.json())
      .then((j) => setConVideo(new Set(((j.refs as string[]) ?? []).map((x) => x.toUpperCase()))))
      .catch(() => {});
  }, []);

  //  ── ESC CHIUDE UNA COSA SOLA, LA PIÙ IN ALTO ──────────────────────────
  //   Prima chiudeva sempre il pannello: chi si tirava indietro da un riquadro
  //   aperto perdeva anche la ricerca che stava facendo, e tirarsi indietro da
  //   una cancellazione è esattamente il momento in cui non va punito nessuno.
  //   Con una cancellazione già partita ESC non fa niente: la richiesta è per
  //   strada e chiudere il riquadro darebbe l'idea di averla fermata.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (daEliminare) { if (!canc) setDaEliminare(null); return; }
      if (pin) { setPin(null); return; }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, daEliminare, canc, pin]);

  // Finché questa schermata è aperta il cliente vede l'avviso: sa che ti stai
  // muovendo e non resta davanti a una pagina immobile.
  useEffect(() => { setLookup(true); return () => setLookup(false); }, []);

  const visibili = useMemo(() => {
    const conConsulente = chiFiltro
      ? rows.filter((r) => (owners[r.quote_ref.toUpperCase()]?.id || "") === chiFiltro)
      : rows;
    const inScheda = conConsulente.filter((r) => sospesi.has(r.quote_ref.toUpperCase()) === (scheda === "sospesi"));
    if (filtro === "tutte") return inScheda;
    const ora = Date.now();
    return inScheda.filter((r) => {
      const valida = validUntil(r, edits[r.quote_ref]).getTime() >= ora;
      return filtro === "valide" ? valida : !valida;
    });
  }, [rows, edits, filtro, scheda, sospesi, chiFiltro, owners]);

  //  La rotta non si rimonta cambiando solo la parte dopo il "?": senza questo
  //  avviso il pannello si chiudeva e la pagina restava quella di prima.
  const apri = (ref: string) => {
    onClose();
    // Se l'ospite della videochiamata era su un'altra schermata va portato qui,
    // altrimenti resta sulle slide mentre tu apri il preventivo.
    if (getLiveId()) setPresenterPage("/preventivo");
    navigate({ to: "/preventivo", search: { id: ref } as never });
    window.dispatchEvent(new CustomEvent("hg:open-quote", { detail: ref }));
  };
  /** Apre la registrazione della consulenza legata a questo preventivo. */
  const vediRegistrazione = async (ref: string) => {
    try {
      const j = await fetch(`/api/presenter/recordings?quoteRef=${encodeURIComponent(ref)}`).then((r) => r.json());
      const rec = ((j.recordings as { url: string }[]) ?? [])[0];
      if (!rec?.url) { toast.error("Nessuna registrazione per questo preventivo"); return; }
      window.open(rec.url, "_blank", "noopener");
    } catch { toast.error("Archivio non raggiungibile"); }
  };
  //  Ogni link che esce da qui apre la sessione del consulente per QUEL
  //  preventivo: chi lo riceve non atterra su una pagina scollegata, e quando
  //  lo apri anche tu vi trovate sulla stessa cosa nello stesso momento.
  const linkOf = (ref: string) => linkPreventivo(ref);
  /** Scrive al cliente su WhatsApp con il link del suo preventivo gia dentro. */
  const whatsapp = (r: QRow) => {
    const n = waNumero(r.telefono);
    if (!n) { toast.error("Questo preventivo non ha un numero di telefono"); return; }
    const testo = `Ciao ${r.nome || ""}, ecco il tuo preventivo ${r.quote_ref}: ${linkOf(r.quote_ref)}`.replace(/\s+/g, " ").trim();
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(testo)}`, "_blank", "noopener");
  };
  /** ── SELEZIONE CON MAIUSC ─────────────────────────────────────────────
   *  Come in qualunque elenco: si spunta il primo, si tiene MAIUSC e si spunta
   *  l'ultimo — tutto quello che sta in mezzo viene preso. Selezionare venti
   *  preventivi uno a uno era la parte più lenta della cancellazione. */
  //  L'ancora dell'intervallo NON viene ricordata: si ricava dalla selezione
  //  corrente, prendendo la riga selezionata più vicina a quella toccata. Così
  //  funziona anche se il pannello si ridisegna fra un clic e l'altro — cosa
  //  che accade, perché l'elenco si aggiorna da solo.
  const toggleSel = (ref: string, i: number, shift = false) => {
    setScelti((p) => {
      const n = new Set(p);
      if (shift && n.size) {
        let ancora = -1, dist = Infinity;
        visibili.forEach((r, k) => {
          if (k === i || !n.has(r.quote_ref)) return;
          const d = Math.abs(k - i);
          if (d < dist) { dist = d; ancora = k; }
        });
        if (ancora >= 0) {
          const da = Math.min(ancora, i), a = Math.max(ancora, i);
          const accendi = !n.has(ref);
          for (let k = da; k <= a; k++) {
            const r = visibili[k]?.quote_ref;
            if (!r) continue;
            if (accendi) n.add(r); else n.delete(r);
          }
          return n;
        }
      }
      if (n.has(ref)) n.delete(ref); else n.add(ref);
      return n;
    });
  };

  /** ── CHIEDERE, PRIMA DI CANCELLARE ────────────────────────────────────
   *  Apre soltanto il riquadro: da qui non parte nessuna richiesta, e infatti
   *  questa funzione non sa nemmeno che esiste un PIN.
   *
   *  ⚠️ NON passa da `conAutorizzazione`, e non è una dimenticanza. Quella
   *  funzione non è una conferma, è una richiesta di PIN: se il PIN è già in
   *  memoria — e basta averne digitato uno prima, magari per salvare una nota —
   *  esegue e basta, senza mostrare niente. Appesa lì, la conferma sarebbe
   *  stata scritta nel codice e invisibile a schermo: un solo clic sul cestino
   *  avrebbe cancellato un preventivo. Una cosa irreversibile si conferma
   *  SEMPRE; il PIN, se serve ancora, si chiede dentro lo stesso riquadro. */
  const chiediConferma = (righe: QRow[]) => {
    //  Niente righe da nominare, niente riquadro — ma nemmeno un clic che non
    //  fa niente e non dice niente: capita se l'elenco si è aggiornato sotto
    //  una selezione, e chi ha premuto deve sapere perché non è successo nulla.
    if (!righe.length) { toast.error("Quei preventivi non sono più nell'elenco: rifai la ricerca"); return; }
    setPinRichiesto(!chiave.trim());
    setDaEliminare(righe);
  };

  /** Le righe dietro una selezione multipla. Si parte da quelle CARICATE, non
   *  dai numeri spuntati: il riquadro deve nominare una per una le persone che
   *  sta per cancellare, e si cancella esattamente quello che il riquadro ha
   *  nominato — niente di più. */
  const righeScelte = () => rows.filter((r) => scelti.has(r.quote_ref));

  const eliminaOra = async (refs: string[], code: string) => {
    //  ── UNA VOLTA SOLA, ANCHE SE IL TASTO VIENE PREMUTO DUE VOLTE ──────
    //   `canc` è uno stato di React, e fra due pressioni ravvicinate — un
    //   doppio clic, o il tasto Invio tenuto giù, che il browser ripete da
    //   solo decine di volte al secondo — la schermata può non essersi ancora
    //   ridisegnata: la funzione ripartirebbe con `canc` ancora falso e la
    //   richiesta uscirebbe due volte. La seconda non troverebbe più niente da
    //   cancellare, ma le due si accavallerebbero sugli elenchi condivisi
    //   (sospesi, proprietari, registrazioni), che il server legge e riscrive
    //   interi: l'ultima a scrivere rimetterebbe dentro quello che la prima
    //   aveva appena tolto. Questo chiavistello non passa dallo stato e vale
    //   nell'istante in cui lo si chiude.
    if (!refs.length || invioInCorso.current) return;
    invioInCorso.current = true;
    setCanc(true);
    try {
      const j = await (await fetch("/api/presenter/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", refs, code }),
      })).json();
      //  Quanti ne ha TROVATI e cancellati il server, che non è quanti gliene
      //  abbiamo chiesti: se il numero non arriva (server più vecchio) si
      //  ripiega su quelli chiesti, com'era prima.
      const fatti = typeof j?.deleted === "number" ? j.deleted : refs.length;
      //  ── UN RIFIUTO SI DICE PER INTERO ────────────────────────────────
      //   Il server sa perché ha detto di no («Un lead lo cancella solo chi
      //   gestisce l'archivio») e quel motivo va a schermo così com'è: senza,
      //   il consulente riprova all'infinito una cosa che non gli spetta.
      if (!j?.ok) {
        const pinRifiutato = j?.error === "auth" || j?.reason === "codice non valido";
        //  PIN sbagliato: si butta via, e il riquadro — che resta aperto —
        //  torna a mostrare il campo. Senza questa seconda riga il campo non
        //  ricompariva e il tasto restava spento per sempre: un vicolo cieco
        //  con la conferma ancora davanti agli occhi.
        if (pinRifiutato) { setChiave(""); setPinRichiesto(true); }
        toast.error(
          pinRifiutato ? "PIN non riconosciuto"
          : typeof j?.reason === "string" && j.reason ? j.reason
          : "Eliminazione non riuscita",
          { duration: 12000 },
        );
        //  ── E POI SI RIGUARDA L'ELENCO LO STESSO ──────────────────────
        //   Qui non si toglie una riga di propria iniziativa: si richiede
        //   l'elenco al server e si mostra quello che risponde. Con un
        //   rifiuto secco — permesso mancante, PIN sbagliato — torna tutto
        //   com'era, che è esattamente quello che deve succedere. Ma «non
        //   riuscito» vuol dire anche «riuscito a metà»: il server risponde
        //   `ok:false` pure quando il preventivo è sparito davvero e a
        //   restare indietro è una pulizia laterale. Senza questa riga il
        //   consulente vedrebbe ancora la riga di un preventivo che non
        //   esiste più e continuerebbe a ripremere su un fantasma.
        if (fatti > 0) setScelti((p) => { const n = new Set(p); refs.forEach((r) => n.delete(r)); return n; });
        load(term);
        return;
      }
      //  Tolti dalla selezione quelli appena passati dal server: se ne stavi
      //  cancellando uno dalla sua riga, la selezione che avevi in corso non
      //  c'entra niente e resta com'era.
      setScelti((p) => { const n = new Set(p); refs.forEach((r) => n.delete(r)); return n; });
      setDaEliminare(null);
      //  ── SI DICE QUELLO CHE È SUCCESSO, NON QUELLO CHE SI ERA CHIESTO ──
      //   «Preventivo eliminato» dopo aver eliminato zero preventivi era la
      //   bugia più facile da raccontare: capita quando quel numero non è più
      //   in archivio — qualcun altro l'ha già tolto, oppure il tasto è
      //   partito due volte. Il lavoro di pulizia è stato fatto lo stesso, e
      //   il risultato per il cliente è quello giusto, ma chi ha premuto deve
      //   sapere che non è stata la sua pressione a farlo.
      const avvisi = Array.isArray(j.avvisi) ? (j.avvisi as string[]).join("; ") : "";
      if (fatti === 0) {
        toast.warning("Non c'era più niente da eliminare", {
          description: refs.length === 1
            ? "Quel preventivo non era più in archivio. L'elenco è stato aggiornato."
            : "Quei preventivi non erano più in archivio. L'elenco è stato aggiornato.",
        });
      } else if (fatti < refs.length) {
        toast.warning(`Eliminati ${fatti} preventivi su ${refs.length}`, {
          description: "Gli altri non erano più in archivio. L'elenco è stato aggiornato.",
        });
      } else {
        toast.success(fatti === 1 ? "Preventivo eliminato" : `${fatti} preventivi eliminati`,
          avvisi ? { description: avvisi, duration: 12000 } : undefined);
      }
      load(term);
    } catch {
      //  ⚠️ Qui c'era scritto «il preventivo NON è stato eliminato», ed era una
      //  cosa che da questa parte non si può sapere: la connessione può essere
      //  caduta anche DOPO che la richiesta era arrivata e il lavoro era fatto.
      //  Dire con certezza la cosa sbagliata è peggio che ammettere il dubbio,
      //  perché fa ripremere convinti — quindi si ammette il dubbio e si
      //  ricarica l'elenco, che è l'unico modo di sapere com'è andata.
      toast.error("Errore di rete durante l'eliminazione", {
        description: "Non si sa se la richiesta sia arrivata: l'elenco è stato ricaricato, controlla se il preventivo c'è ancora.",
        duration: 12000,
      });
      load(term);
    }
    finally { invioInCorso.current = false; setCanc(false); }
  };
  /** Aggiunge una nota di consulenza al preventivo. Resta interna: il cliente
   *  non la vede mai, né sulla sua pagina né nel PDF. */
  const aggiungiNota = (ref: string) => {
    if (!testo.trim()) return;
    conAutorizzazione("Aggiungere la nota?", "Resta interna: il cliente non la vede mai.", (code) => notaOra(ref, code));
  };
  const notaOra = async (ref: string, code: string) => {
    setSalvo(true);
    try {
      const j = await (await fetch("/api/presenter/quote-edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, code, addNote: testo }),
      })).json();
      if (!j?.ok) { if (j?.reason === "codice non valido") setChiave(""); toast.error(j?.reason === "codice non valido" ? "PIN non riconosciuto" : "Nota non salvata"); return; }
      setEdits((p) => ({ ...p, [ref]: j.edit as QEdit }));
      //  ── LA NOTA VA ANCHE SULLA SCHEDA DEL CRM ─────────────────────────
      //   Una cosa detta in consulenza serve a chi richiamerà quel cliente fra
      //   una settimana, e quella persona guarda il CRM, non i preventivi.
      //   Tenerla in un posto solo significa perderla proprio quando serve.
      try {
        const lead = JSON.parse(localStorage.getItem("hg_lead_corrente") || "null") as { id?: string } | null;
        if (lead?.id) {
          void fetch("/api/crm/lead-sync", {
            method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: lead.id, quoteRef: ref, note: `Preventivo ${ref}: ${testo}` }),
          });
        }
      } catch { /* la nota sul preventivo è comunque salvata */ }
      setTesto("");
      toast.success("Nota aggiunta", { description: "Salvata sul preventivo e sulla scheda del cliente." });
    } catch { toast.error("Errore di rete"); }
    finally { setSalvo(false); }
  };
  /** Sposta una o più trattative fra "in corso" e "sospese". Il preventivo non
   *  viene toccato: cambia solo dove compare nell'elenco di lavoro. */
  /** Apre (o chiude) il riquadro «numero e causale» di una riga, e va a
   *  leggere la causale che quel preventivo ha adesso: senza, si riscriverebbe
   *  al buio sopra una frase che magari andava benissimo. */
  const apriRitocco = async (ref: string) => {
    if (ritocco === ref) { setRitocco(null); return; }
    setRitocco(ref);
    setNumeroNuovo(ref);
    setCausaleNuova("");
    setCausaleDiOra("");
    try {
      const j = await (await fetch(`/api/public/quote?ref=${encodeURIComponent(ref)}`)).json();
      const attuale = typeof j?.causale === "string" ? j.causale : "";
      setCausaleDiOra(attuale);
      setCausaleNuova(attuale);
    } catch { /* si lascia vuoto: vuol dire «come da listino» */ }
  };

  const salvaCausale = (ref: string) => {
    conAutorizzazione(
      "Cambiare la causale di questo preventivo?",
      "È la riga che il cliente copia nel bonifico. Vale da subito, anche sul link che ha già in mano.",
      (code) => causaleOra(ref, code),
    );
  };
  const causaleOra = async (ref: string, code: string) => {
    setSalvo(true);
    try {
      const j = await (await fetch("/api/presenter/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "causale", ref, causale: causaleNuova.trim(), code }),
      })).json();
      if (!j?.ok) { if (j?.reason === "codice non valido") setChiave(""); toast.error(j?.reason || "Causale non salvata"); return; }
      setCausaleDiOra(causaleNuova.trim());
      toast.success(causaleNuova.trim() ? "Causale cambiata" : "Causale rimessa come da listino");
    } catch { toast.error("Errore di rete"); }
    finally { setSalvo(false); }
  };

  const salvaNumero = (ref: string) => {
    const male = perchéNonVa(numeroNuovo);
    if (male) { toast.error(male); return; }
    conAutorizzazione(
      `Cambiare il numero in ${normalizzaNumero(numeroNuovo)}?`,
      "Il link che hai già mandato continua a funzionare e porta qui. Quello che è già stato stampato — fatture emesse, bonifici già fatti — cita il numero vecchio.",
      (code) => numeroOra(ref, code),
    );
  };
  const numeroOra = async (ref: string, code: string) => {
    setSalvo(true);
    try {
      const j = await (await fetch("/api/presenter/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rinumera", ref, nuovo: normalizzaNumero(numeroNuovo), code }),
      })).json();
      if (!j?.ok) { if (j?.reason === "codice non valido") setChiave(""); toast.error(j?.reason || "Numero non cambiato"); return; }
      toast.success(`Adesso è ${j.ref}`, {
        description: j.schede ? "Anche la scheda del cliente punta al numero nuovo." : "Il link vecchio continua a funzionare.",
      });
      setRitocco(null);
      load(term);
    } catch { toast.error("Errore di rete"); }
    finally { setSalvo(false); }
  };

  const sospendi = (refs: string[], on: boolean) => {
    if (!refs.length) return;
    conAutorizzazione(
      on ? (refs.length === 1 ? "Sospendere questa trattativa?" : `Sospendere ${refs.length} trattative?`)
         : (refs.length === 1 ? "Rimettere in corso?" : `Rimettere in corso ${refs.length} trattative?`),
      on ? "Escono dall'elenco di lavoro e restano nella scheda Sospese. I preventivi non vengono toccati."
         : "Tornano nell'elenco di lavoro, com'erano.",
      (code) => sospendiOra(refs, on, code),
    );
  };
  const sospendiOra = async (refs: string[], on: boolean, code: string) => {
    try {
      const j = await (await fetch("/api/presenter/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", refs, code, on }),
      })).json();
      if (!j?.ok) { if (j?.reason === "codice non valido") setChiave(""); toast.error(j?.reason === "codice non valido" ? "PIN non riconosciuto" : "Operazione non riuscita"); return; }
      setSospesi(new Set(((j.suspended as string[]) ?? []).map((x) => x.toUpperCase())));
      setScelti(new Set());
      toast.success(on
        ? `${refs.length === 1 ? "Trattativa sospesa" : `${refs.length} trattative sospese`}`
        : `${refs.length === 1 ? "Trattativa riattivata" : `${refs.length} trattative riattivate`}`);
    } catch { toast.error("Errore di rete"); }
  };
  /** ── COSA TROVA CHI APRE IL LINK DI UN PREVENTIVO ANNULLATO ───────────
   *  Due modi, e si sceglie qui.
   *  · mostra  → trova il documento che ricorda, con sopra l'avviso rosso.
   *  · avviso  → trova solo l'avviso, col numero valido e il pulsante.
   *  Il primo è quello di partenza ed è giusto quasi sempre: chi riapre un
   *  link salvato in chat si aspetta di ritrovare quello che ha letto. Il
   *  secondo serve quando quel documento è diventato un'arma in mano a chi
   *  tratta — un prezzo di prima più basso, condizioni che non si applicano
   *  più. */
  const cambiaVisibilita = (ref: string, spegni: boolean) => {
    conAutorizzazione(
      spegni ? "Nascondere il vecchio preventivo?" : "Rimostrare il vecchio preventivo?",
      spegni
        ? "Chi apre quel link troverà solo l'avviso che il preventivo è annullato, con il numero di quello valido e il pulsante per aprirlo. Il documento vecchio non sarà più leggibile."
        : "Chi apre quel link tornerà a leggere il preventivo vecchio, con sopra l'avviso che non è più valido.",
      (code) => cambiaVisibilitaOra(ref, spegni, code),
    );
  };
  const cambiaVisibilitaOra = async (ref: string, spegni: boolean, code: string) => {
    try {
      const j = await (await fetch("/api/presenter/quotes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "solo-avviso", refs: [ref], code, on: spegni }),
      })).json();
      if (!j?.ok) { if (j?.reason === "codice non valido") setChiave(""); toast.error("Operazione non riuscita"); return; }
      setMuti(new Set(((j.soloAvviso as string[]) ?? []).map((x) => x.toUpperCase())));
      toast.success(spegni ? "Il vecchio preventivo non è più leggibile" : "Il vecchio preventivo torna leggibile");
    } catch { toast.error("Errore di rete"); }
  };

  const copiaLink = (ref: string) => copyLink(linkPreventivo(ref), `Link del preventivo ${ref} copiato`);

  return (
    <div data-hg-noptr className="fixed inset-0 z-[300] flex flex-col bg-[#050f24]/97 backdrop-blur print:hidden">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <FileText className="h-5 w-5 text-brand" />
        <h2 className="text-base font-semibold text-white">Preventivi attivi</h2>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/55">{visibili.length}</span>
        <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-white/10 px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} autoFocus
            placeholder="Cerca per cognome, telefono, email o numero preventivo (es. ID7P765)"
            className="w-full rounded-xl border border-white/15 bg-white/[0.06] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-brand focus:outline-none" />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {/* ── DUE SCHEDE ────────────────────────────────────────────────
              "Sospese" non è un cestino: è dove finisce una trattativa che si
              è fermata. Il preventivo resta intero e si rimette in corso con
              un clic — quindi la parola giusta è sospesa, non persa. */}
          <div className="flex items-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] p-0.5">
            {([["attivi", "In corso"], ["sospesi", "Sospese"]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => { setScheda(k); setScelti(new Set()); }}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${scheda === k ? "bg-brand text-white" : "text-white/60 hover:bg-white/10"}`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] p-0.5">
            {([["tutte", "Tutte"], ["valide", "Condizioni valide"], ["scadute", "Condizioni scadute"]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${
                  filtro === k ? (k === "scadute" ? "bg-red-500/80 text-white" : k === "valide" ? "bg-emerald-500/80 text-[#052e16]" : "bg-white/15 text-white")
                  : "text-white/60 hover:bg-white/10"}`}>{t}</button>
            ))}
          </div>
          {/* ── DI CHI SONO ─────────────────────────────────────────────────
              Compare solo se in archivio c'è più di un consulente: con uno
              solo sarebbe un pulsante che non filtra niente. */}
          {(() => {
            const cons = [...new Map(Object.values(owners).filter((o) => o.id).map((o) => [o.id, o])).values()];
            if (cons.length < 2) return null;
            return (
              <div className="flex items-center gap-0.5 rounded-lg border border-white/12 bg-white/[0.04] p-0.5">
                <button type="button" onClick={() => setChiFiltro("")}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${!chiFiltro ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10"}`}>
                  Tutti
                </button>
                {cons.map((c) => (
                  <button key={c.id} type="button" onClick={() => setChiFiltro(chiFiltro === c.id ? "" : c.id)}
                    className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition ${chiFiltro === c.id ? "bg-brand text-white" : "text-white/60 hover:bg-white/10"}`}>
                    {c.nome || "Senza nome"}
                  </button>
                ))}
              </div>
            );
          })()}
          {visibili.length > 0 && (
            <button type="button"
              onClick={() => setScelti(scelti.size === visibili.length ? new Set() : new Set(visibili.map((r) => r.quote_ref)))}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60 hover:bg-white/10">
              {scelti.size === visibili.length ? "Deseleziona tutti" : "Seleziona tutti"}
            </button>
          )}
          <span className="ml-auto text-[11px] text-white/30">Le modifiche si fanno aprendo il preventivo.</span>
        </div>

        {/* ── SELEZIONE MULTIPLA ────────────────────────────────────────────
            Compare solo quando c'è qualcosa di selezionato. La cancellazione è
            irreversibile e riguarda dati di clienti veri: passa dallo stesso
            riquadro di conferma del cestino di riga — che elenca per nome chi
            sta per sparire — e chiede la chiave se non è già stata data.
            Mai un clic solo. */}
        {scelti.size > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/[0.07] px-3 py-2">
            <span className="text-[12.5px] font-semibold text-white">{scelti.size} selezionat{scelti.size === 1 ? "o" : "i"}</span>
            <button type="button" onClick={() => setScelti(new Set())} className="text-[11.5px] text-white/45 underline decoration-white/20 underline-offset-2 hover:text-white">annulla</button>
            <span className="hidden text-[11px] text-white/30 sm:inline">MAIUSC + clic per selezionare un intervallo</span>
            <button type="button" onClick={() => sospendi([...scelti], scheda === "attivi")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-medium text-white/85 transition hover:bg-white/10">
              {scheda === "attivi" ? <><PauseCircle className="h-3.5 w-3.5" /> Sospendi</> : <><PlayCircle className="h-3.5 w-3.5 text-emerald-300" /> Rimetti in corso</>}
            </button>
            <button type="button" onClick={() => chiediConferma(righeScelte())} disabled={canc}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-[12.5px] font-semibold text-red-100 hover:bg-red-500/25 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> {canc ? "Elimino…" : "Elimina"}
            </button>
          </div>
        )}
      </div>

      {/* ── AUTORIZZAZIONE ────────────────────────────────────────────────
          Compare solo quando serve, dice cosa sta per succedere e sparisce.
          Il codice resta valido finché il pannello è aperto: si digita una
          volta sola, non a ogni riga. */}
      {pin && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setPin(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-5 shadow-2xl">
            <p className="text-[15px] font-bold text-white">{pin.titolo}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{pin.dettaglio}</p>
            {/* `e.repeat` esclude le battute che il browser genera da solo
                tenendo premuto Invio: senza, una pressione lunga manderebbe la
                stessa azione decine di volte. */}
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">PIN consulente</span>
              <input type="password" autoFocus value={chiave} onChange={(e) => setChiave(e.target.value)} autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.repeat && chiave.trim()) { const p2 = pin; setPin(null); void p2.esegui(chiave.trim()); } }}
                placeholder="••••"
                className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-center text-[16px] tracking-[0.4em] text-white placeholder:tracking-normal placeholder:text-white/25 focus:border-brand focus:outline-none" />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { const p2 = pin; setPin(null); void p2.esegui(chiave.trim()); }} disabled={!chiave.trim()}
                className="flex-1 rounded-xl bg-brand py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-40">Conferma</button>
              <button type="button" onClick={() => setPin(null)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-medium text-white/65 hover:bg-white/5 hover:text-white">Annulla</button>
            </div>
            <p className="mt-3 text-[11px] text-white/30">È il PIN con cui entri nel tuo account presentatore.</p>
          </div>
        </div>
      )}

      {/* ── LA CONFERMA DI UNA COSA CHE NON SI DISFA ──────────────────────
          Non chiede «sei sicuro?»: quella è una domanda che si preme senza
          leggerla. Chiede se eliminare il preventivo DI QUALCUNO, con il suo
          nome, il suo numero e la sua cifra — le tre cose che permettono di
          accorgersi di aver preso la riga sbagliata mentre c'è ancora tempo.
          Poi dice dove va a finire, con parole di cose e non di tabelle,
          compresa l'unica che il cliente potrebbe già avere in mano. */}
      {daEliminare && (() => {
        const uno = daEliminare.length === 1 ? daEliminare[0] : null;
        const refs = daEliminare.map((r) => r.quote_ref);
        const conRegistrazione = daEliminare.some((r) => conVideo.has(r.quote_ref.toUpperCase()));
        const via = () => { if (!canc && chiave.trim()) void eliminaOra(refs, chiave.trim()); };
        return (
          <div className="fixed inset-0 z-[330] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !canc) setDaEliminare(null); }}>
            <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#0b1730] p-5 shadow-2xl">
              <p className="text-[15px] font-bold text-white">
                {uno
                  ? `Eliminare il preventivo di ${[uno.nome, uno.cognome].filter(Boolean).join(" ").trim() || "questo cliente"}?`
                  : `Eliminare ${daEliminare.length} preventivi?`}
              </p>
              {uno ? (
                <p className="mt-1.5 text-[12.5px] text-white/55">
                  {uno.quote_ref} · <span className="font-semibold text-white/85">{eur(totaleDi(uno, edits[uno.quote_ref]))}</span>
                  {" · creato il "}{new Date(uno.created_at).toLocaleDateString("it-IT")}
                </p>
              ) : (
                /* Anche in blocco, uno per uno: un numero — «12 selezionati» —
                   non permette a nessuno di accorgersi che lì dentro c'è un
                   cliente che non doveva esserci. */
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  {daEliminare.map((r) => (
                    <li key={r.quote_ref} className="flex items-baseline gap-2 text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-white/85">{[r.nome, r.cognome].filter(Boolean).join(" ").trim() || "Senza nome"}</span>
                      <span className="flex-shrink-0 text-white/40">{r.quote_ref}</span>
                      <span className="flex-shrink-0 font-semibold text-white/70">{eur(totaleDi(r, edits[r.quote_ref]))}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* ⚠️ QUESTA FRASE È UN IMPEGNO PRESO CON CHI PREME, e chi lo
                  mantiene è il server: /api/presenter/quotes (action:"delete")
                  toglie anche la chiave `anteprima:preventivo:<REF>` e il file
                  `anteprime/preventivo-<REF>.jpg`, che sta in un deposito
                  PUBBLICO e porta scritti nome, cognome e totale — e prima di
                  rispondere «fatto» va a controllare che quel file non ci sia
                  più davvero; se c'è ancora, non cancella nemmeno il
                  preventivo e lo dice. Se un giorno quella parte sparisse, qui
                  resterebbe scritta una cosa falsa: il consulente crederebbe
                  di aver tolto il dato del cliente e l'immagine continuerebbe
                  a rispondere a chiunque abbia il link. Cancellare a metà un
                  dato personale è peggio che non cancellarlo, perché nessuno
                  va più a controllare. */}
              <p className="mt-3 rounded-xl border border-red-400/25 bg-red-500/[0.08] px-3 py-2.5 text-[12.5px] leading-relaxed text-white/75">
                Spariscono per sempre {uno ? "il preventivo" : "i preventivi"}, le condizioni riaperte e le note di
                consulenza. Il link smette di funzionare: se l'hai già mandato su WhatsApp, al posto dell'anteprima
                con il nome e il totale il cliente troverà la scheda generica dello studio.
                {conRegistrazione && " La registrazione della videochiamata invece resta in archivio."}
              </p>

              {/* Se il PIN è già stato dato in questa sessione non si richiede:
                  il passaggio che conta è questo riquadro, non ridigitare
                  quattro cifre davanti al cliente in videochiamata.
                  ⚠️ La riga sotto al campo non è un abbellimento: chi è entrato
                  dal link del presentatore un PIN personale può non averlo mai
                  avuto, e senza quella riga si troverebbe davanti a un campo
                  che non sa riempire e a un tasto spento. Il codice consulente
                  — quello dentro il suo link — vale qui esattamente come un
                  PIN, ed è giusto che ci sia scritto. */}
              {pinRichiesto ? (
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">PIN consulente</span>
                  <input type="password" autoFocus value={chiave} onChange={(e) => setChiave(e.target.value)} autoComplete="off"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.repeat) via(); }} placeholder="••••"
                    className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-center text-[16px] tracking-[0.4em] text-white placeholder:tracking-normal placeholder:text-white/25 focus:border-brand focus:outline-none" />
                  <span className="mt-1.5 block text-[11px] text-white/30">Il PIN con cui entri, oppure il codice consulente.</span>
                </label>
              ) : (
                <p className="mt-3 text-[11px] text-white/30">Autorizzato con il PIN già inserito in questa sessione.</p>
              )}

              {/* Annulla è il primo che la mano incontra ed è quello neutro;
                  quello che elimina sta dall'altra parte, dice ELIMINA e non
                  «OK», ed è l'unica cosa rossa piena di tutto il pannello. */}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setDaEliminare(null)} disabled={canc}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-medium text-white/65 transition hover:bg-white/5 hover:text-white disabled:opacity-40">
                  Annulla
                </button>
                <button type="button" onClick={via} disabled={canc || !chiave.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45">
                  <Trash2 className="h-4 w-4" />
                  {/* Mentre la richiesta è per strada il tasto è spento e LO DICE:
                      un tasto spento e muto si legge come «non ha funzionato» e
                      si ripreme. */}
                  {canc ? "Elimino…" : "Elimina"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {busy && <p className="py-6 text-center text-sm text-white/45">Cerco…</p>}
        {!busy && visibili.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-10 text-center text-sm text-white/45">
            {term ? "Nessun preventivo corrisponde alla ricerca."
              : scheda === "sospesi" ? "Nessuna trattativa sospesa. Quelle che metti in pausa compaiono qui."
              : filtro === "scadute" ? "Nessun preventivo con le condizioni scadute."
              : filtro === "valide" ? "Nessun preventivo con le condizioni ancora valide."
              : "Nessun preventivo ancora creato."}
          </p>
        )}
        <div className="space-y-2">
          {visibili.map((r, idx) => {
            const ed = edits[r.quote_ref];
            const fino = validUntil(r, ed);
            const attivo = fino.getTime() >= Date.now();
            const originale = promoDeadline(r.created_at);
            const riaperto = !!ed?.promoUntil && Math.abs(fino.getTime() - originale.getTime()) > 36e5;
            const qta = ed?.qty ?? r.qty ?? 1;
            // il totale a database non cambia mai: le modifiche vivono a parte,
            // quindi qui va ricostruito, altrimenti il pannello mostra un prezzo
            // che sulla pagina del preventivo non esiste più.
            const totale = totaleDi(r, ed);
            const modificato = Math.abs(totale - (Number(r.total) || 0)) > 0.005;
            //  Rifatto: resta nell'elenco — è successo, e cancellarlo dalla
            //  vista non lo farebbe non essere successo — ma smorzato e con
            //  scritto sopra che cos'è, così non lo si scambia per quello vivo.
            const sostituito = String(r.status ?? "") === "sostituito";
            return (
              <div key={r.quote_ref} className={`overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-white/20 ${sostituito ? "opacity-55" : ""}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                  <input type="checkbox" checked={scelti.has(r.quote_ref)} readOnly
                    onClick={(e) => toggleSel(r.quote_ref, idx, e.shiftKey)}
                    title="Seleziona · tieni MAIUSC per prendere tutto l'intervallo"
                    className="h-4 w-4 flex-shrink-0 cursor-pointer accent-[#3b82f6]" />
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand/15 text-[11px] font-bold text-brand">
                    {(r.nome?.[0] || "?").toUpperCase()}{(r.cognome?.[0] || "").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                      <span className="truncate">{r.nome} {r.cognome}</span>
                      {sostituito && (
                        <span className="flex-shrink-0 rounded-md border border-white/20 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white/55">
                          sostituito
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-white/45">
                      {r.quote_ref} · {new Date(r.created_at).toLocaleDateString("it-IT")}{r.telefono ? ` · ${r.telefono}` : ""}{qta > 1 ? ` · ${qta} impianti` : ""}
                    </span>
                  </span>
                  {/* ── SCADENZA ─────────────────────────────────────────
                      Se le condizioni sono state riaperte si vedono ENTRAMBE le
                      date: la vecchia barrata in rosso e la nuova in verde. Si
                      capisce a colpo d'occhio che quel preventivo è stato
                      rimesso in gioco, e da quando. */}
                  <span className="flex flex-shrink-0 items-center gap-1.5 text-[10.5px] font-semibold">
                    {riaperto && (
                      <span className="text-red-300/70 line-through decoration-red-400/70">{giorno(originale)}</span>
                    )}
                    <span className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 ${
                      attivo ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-red-400/40 bg-red-500/10 text-red-200"
                    }`}>
                      {attivo ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {attivo ? `fino al ${giorno(fino)}` : `scaduto il ${giorno(fino)}`}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-right text-sm font-bold text-white">
                    {eur(totale)}
                    {modificato && <span className="block text-[10px] font-medium text-white/40 line-through">{eur(r.total)}</span>}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1">
                    {conVideo.has(r.quote_ref.toUpperCase()) && (
                      <button type="button" onClick={() => vediRegistrazione(r.quote_ref)} title="Vedi la registrazione della videochiamata"
                        className="rounded-lg border border-brand/40 bg-brand/10 p-1.5 text-brand hover:bg-brand/20"><Film className="h-3.5 w-3.5" /></button>
                    )}
                    {waNumero(r.telefono) && (
                      <button type="button" onClick={() => whatsapp(r)} title={`Scrivi a ${r.nome || "questo cliente"} su WhatsApp con il link del preventivo`}
                        className="rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 p-1.5 text-[#6ee7a0] hover:bg-[#25D366]/20"><MessageCircle className="h-3.5 w-3.5" /></button>
                    )}
                    {/* ── COSA VEDE CHI APRE IL LINK VECCHIO ──────────────
                        Compare SOLO sui preventivi rifatti, perché solo lì la
                        domanda esiste: su un preventivo vivo non c'è niente da
                        nascondere. L'occhio dice lo stato attuale — aperto, il
                        cliente legge ancora il documento; sbarrato, legge solo
                        l'avviso — e il colore lo distingue senza doverci
                        passare sopra col dito. */}
                    {sostituito && (
                      <button type="button"
                        onClick={() => cambiaVisibilita(r.quote_ref, !muti.has(r.quote_ref.toUpperCase()))}
                        title={muti.has(r.quote_ref.toUpperCase())
                          ? "Chi apre questo link vede solo l'avviso di annullamento · premi per rimostrare il vecchio preventivo"
                          : "Chi apre questo link legge ancora il vecchio preventivo · premi per lasciare solo l'avviso"}
                        className={`rounded-lg border p-1.5 transition ${
                          muti.has(r.quote_ref.toUpperCase())
                            ? "border-rose-400/45 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        }`}>
                        {muti.has(r.quote_ref.toUpperCase()) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button type="button" onClick={() => copiaLink(r.quote_ref)} title="Copia il link da mandare al cliente"
                      className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => sospendi([r.quote_ref], scheda === "attivi")}
                      title={scheda === "attivi" ? "Sospendi questa trattativa: esce dall'elenco di lavoro, il preventivo resta" : "Rimetti questa trattativa fra quelle in corso"}
                      className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white">
                      {scheda === "attivi" ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5 text-emerald-300" />}
                    </button>
                    <button type="button" onClick={() => { setNote(note === r.quote_ref ? null : r.quote_ref); setTesto(""); }}
                      title="Note di consulenza e informazioni dichiarate dal cliente"
                      className={`rounded-lg border p-1.5 transition ${
                        note === r.quote_ref ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                        : (ed?.notes?.length || r.problemi) ? "border-amber-400/30 bg-amber-400/10 text-amber-200/80 hover:bg-amber-400/20"
                        : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}><StickyNote className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void apriRitocco(r.quote_ref)}
                      title="Cambia il numero del preventivo e la causale del bonifico"
                      className={`rounded-lg border p-1.5 transition ${
                        ritocco === r.quote_ref
                          ? "border-brand/50 bg-brand/15 text-white"
                          : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}><Hash className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => apri(r.quote_ref)} title="Apri il preventivo"
                      className="rounded-lg border border-brand/40 bg-brand/15 p-1.5 text-white hover:bg-brand/25"><ExternalLink className="h-3.5 w-3.5" /></button>
                    {/* ── ELIMINA ────────────────────────────────────────
                        Discreto per scelta: nessun bordo, nessun fondino,
                        rosso solo quando ci passi sopra. Cancellare non è un
                        gesto di tutti i giorni e non può pesare quanto copiare
                        un link, che invece si fa dieci volte al giorno. Sta in
                        fondo e staccato dagli altri, perché il tasto che gli
                        sta accanto — «Apri» — è quello che si preme di più:
                        due bersagli attaccati sono un errore che aspetta.
                        Da qui non parte niente: apre solo la conferma. */}
                    <button type="button" onClick={() => chiediConferma([r])}
                      title={`Elimina il preventivo di ${[r.nome, r.cognome].filter(Boolean).join(" ").trim() || "questo cliente"}`}
                      className="ml-1 rounded-lg border border-transparent p-1.5 text-white/25 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>

                {/* ── SCHEDA INTERNA ────────────────────────────────────────
                    Quello che il cliente ha dichiarato e quello che ci siamo
                    detti al telefono. Non compare mai sulla sua pagina né nel
                    PDF: serve a noi, prima di richiamarlo. */}
                {/* ── NUMERO E CAUSALE ──────────────────────────────────
                    Richiesta del committente: «fai che posso cambiare l'ID
                    del preventivo e la causale».
                    ⚠️ Due comandi separati e non un «salva» unico: cambiare il
                     numero muove tutto quello che sta attaccato al documento e
                     lascia un rimando dal vecchio, cambiare la causale è una
                     riga di testo. Premere un solo pulsante per due cose così
                     diverse vorrebbe dire farne una senza volerlo. */}
                {ritocco === r.quote_ref && (
                  <div className="space-y-3 border-t border-white/[0.07] bg-black/20 px-3 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Numero del preventivo</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <input
                          value={numeroNuovo}
                          onChange={(e) => setNumeroNuovo(normalizzaNumero(e.target.value))}
                          spellCheck={false}
                          className="w-[190px] rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 font-mono text-[13px] tracking-wider text-white focus:border-brand focus:outline-none"
                        />
                        <button type="button" onClick={() => salvaNumero(r.quote_ref)}
                          disabled={salvo || normalizzaNumero(numeroNuovo) === r.quote_ref.toUpperCase() || !!perchéNonVa(numeroNuovo)}
                          className="rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
                          Cambia numero
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11.5px] leading-snug text-white/45">
                        {perchéNonVa(numeroNuovo) || (
                          <>Il link che hai già mandato continua a funzionare e porta qui. Quello che è già stato
                          stampato — fatture emesse, bonifici già fatti — cita il numero vecchio.</>
                        )}
                      </p>
                    </div>

                    <div className="border-t border-white/[0.07] pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Causale del bonifico</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <input
                          value={causaleNuova}
                          onChange={(e) => setCausaleNuova(e.target.value)}
                          placeholder={CAUSALE_DI_CASA}
                          className="min-w-[240px] flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 font-mono text-[12.5px] text-white placeholder:text-white/25 focus:border-brand focus:outline-none"
                        />
                        <button type="button" onClick={() => salvaCausale(r.quote_ref)}
                          disabled={salvo || causaleNuova.trim() === causaleDiOra.trim()}
                          className="rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
                          {causaleNuova.trim() ? "Cambia causale" : "Rimetti quella del listino"}
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11.5px] leading-snug text-white/45">
                        Il cliente copierà: «{causaleDi({
                          modello: causaleNuova,
                          numero: normalizzaNumero(numeroNuovo) || r.quote_ref,
                          nome: [r.nome, r.cognome].filter(Boolean).join(" ").trim(),
                          totale: eur(totaleDi(r, ed)),
                        })}». Puoi usare <b className="font-mono text-white/65">{"{numero}"}</b>,{" "}
                        <b className="font-mono text-white/65">{"{nome}"}</b>,{" "}
                        <b className="font-mono text-white/65">{"{totale}"}</b>. Vuoto = quella del listino.
                      </p>
                    </div>
                  </div>
                )}
                {note === r.quote_ref && (
                  <div className="border-t border-white/[0.07] bg-black/20 px-3 py-3">
                    {r.problemi && (
                      <div className="mb-3 flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">Dichiarato dal cliente</p>
                          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">{r.problemi}</p>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Note di consulenza</p>
                    {(ed?.notes ?? []).length === 0 ? (
                      <p className="mt-1.5 text-[12.5px] text-white/40">Nessuna nota. Scrivi qui cosa vi siete detti: serve a chi riprenderà in mano questo preventivo.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {(ed?.notes ?? []).map((n, i) => (
                          <li key={`${n.at}-${i}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{n.text}</p>
                            <p className="mt-1 text-[11px] text-white/35">{new Date(n.at).toLocaleString("it-IT")}{n.by ? ` · ${n.by}` : ""}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 space-y-2">
                      <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={2}
                        placeholder="Es. allergie dichiarate, colore concordato, richiamare dopo il 20"
                        className="w-full resize-y rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-white/30 focus:border-brand focus:bg-white/[0.08] focus:outline-none" />
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => aggiungiNota(r.quote_ref)} disabled={salvo || !testo.trim()}
                          className="rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
                          {salvo ? "Salvo…" : "Aggiungi nota"}
                        </button>
                        <span className="text-[11px] text-white/30">Visibile solo a noi.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
