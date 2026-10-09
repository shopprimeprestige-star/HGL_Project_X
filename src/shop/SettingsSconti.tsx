/** ─────────────────────────────────────────────────────────────────────────
 *  IMPOSTAZIONI DI MEETLY · scheda SCONTI (coupon + quantità + durata promo)
 *
 *  PERCHÉ QUESTA SCHEDA È STATA RIFATTA E NON SOLO SPOSTATA
 *  Gli sconti si configuravano in DUE posti che scrivevano sulla stessa cosa:
 *  qui dentro e nella pagina /CRM/sconti del gestionale (tabella
 *  `discount_codes`, e `app_config` con chiave 'qty_discounts'). Il gestionale
 *  ha vinto su un punto solo, ma decisivo: qui i campi si salvavano DA SOLI
 *  appena perdevano il fuoco. Si sfiorava un importo, si usciva dal campo, e il
 *  prezzo davanti al cliente era cambiato senza che nessuno avesse premuto
 *  niente. La pagina del CRM sparisce, ma quello che sapeva fare resta:
 *
 *   · SI SALVA SOLO DOPO AVER CONFERMATO — ogni riga tiene le modifiche in
 *     sospeso, dice quante sono, e prima di scrivere mostra il prima → dopo.
 *   · "SALVATO" SIGNIFICA RILETTO — il server rimanda indietro l'elenco vero
 *     dopo la scrittura, e qui si confronta con quello che si voleva salvare.
 *   · OGNI SCONTO PORTA LA SUA PERCENTUALE — calcolata sul totale di listino
 *     del preventivo tipo, che è il modo in cui uno sconto si racconta a voce.
 *   · IL COSTO DEI CODICI "SEMPRE ATTIVI" È SCRITTO — si sommano a ogni
 *     preventivo senza che nessuno digiti niente: se valgono quanto un
 *     preventivo intero, qui c'è scritto in rosso.
 *   · SI VEDE COME LO LEGGE IL CLIENTE — il riquadro dei posti già compilato,
 *     con {left}, {total} e {code} sostituiti.
 *   · ELIMINARE CHIEDE CONFERMA — prima bastava un clic, e il codice spariva.
 *
 *  E resta quello che il gestionale non aveva: la durata delle promozioni e le
 *  soglie di quantità libere (non solo da 2 a 9).
 *
 *  I DECIMALI: i campi in euro sono di TESTO e accettano la virgola (450,73).
 *  A leggerli ci pensa il server con `euroDaValore`. Niente `type="number"`:
 *  rifiuta la virgola e cambia valore con la rotellina del mouse.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
  Plus,
  RotateCcw,
  Save,
  Ticket,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/shop/catalog";
import { BASE_SOLUTIONS, type PricingOverrides } from "@/shop/quote-menu";
import {
  QUANTITA,
  basiDisponibili,
  calcolaPreventivoTipo,
  euroCorto,
  interoDaTesto,
  numeroDaTesto,
  percentuale,
  testoDaNumero,
  type Cambio,
  type ScontiVigenti,
} from "@/shop/listino-condiviso";
import { SchedaPreventivoTipo } from "@/shop/SettingsPreventivoTipo";
import {
  Avviso,
  BottoneChiaro,
  BottonePieno,
  CAMPO,
  ElencoCambi,
  ETICHETTA,
  FinestraScura,
  NotaFinestra,
  Numero,
  Pastiglia,
  Riquadro,
  Segmento,
  StatoSalvataggio,
  useAvvisoModificheNonSalvate,
} from "@/shop/settings-ui";

/* ═══════════════════════════════════════════════════════════════════════════
   0. I DATI — un codice sconto e la sua bozza
   ═════════════════════════════════════════════════════════════════════════ */

/** I testi di riserva sono gli stessi che usa il preventivo quando i campi sono
 *  vuoti: l'anteprima deve mostrare ciò che il cliente leggerà davvero, non un
 *  trattino al posto del testo di default. */
const TITOLO_POSTI_DEFAULT = "Posti video testimonianza";
const TESTO_POSTI_DEFAULT =
  "Restano solo {left} posti{total} riservati alla video testimonianza con il codice {code}.";

//  La garanzia decisa codice per codice: il tipo e la mappa stanno in un file
//  suo, perché li legge anche il configuratore del preventivo.
import { leggiMappa, type GaranziaCodice, type MappaGaranzie } from "./garanzia-codici";
//  Le parole del limite si scrivono in un posto solo: qui si mostra l'anteprima
//  con la STESSA funzione che le stamperà sul preventivo.
import { limiteInParole } from "./promo-garanzia";

export interface CodiceSconto {
  id: string;
  code: string;
  label: string | null;
  discount_eur: number;
  stock_total: number | null;
  stock_left: number | null;
  active: boolean;
  created_at: string;
  auto_apply: boolean;
  apply_message: string | null;
  scarcity_title: string | null;
  scarcity_text: string | null;
}

/** Tutto testo, anche i numeri: è quello che si sta scrivendo nel campo. */
interface Bozza {
  sconto: string;
  etichetta: string;
  postiTotali: string;
  postiRimasti: string;
  attivo: boolean;
  sempre: boolean;
  messaggio: string;
  titoloPosti: string;
  testoPosti: string;
}

const bozzaDa = (r: CodiceSconto): Bozza => ({
  sconto: testoDaNumero(Number(r.discount_eur) || 0),
  etichetta: r.label ?? "",
  postiTotali: r.stock_total == null ? "" : String(r.stock_total),
  postiRimasti: r.stock_left == null ? "" : String(r.stock_left),
  attivo: r.active,
  sempre: r.auto_apply,
  messaggio: r.apply_message ?? "",
  titoloPosti: r.scarcity_title ?? "",
  testoPosti: r.scarcity_text ?? "",
});

const valoriDa = (b: Bozza) => ({
  discount_eur: numeroDaTesto(b.sconto) ?? 0,
  label: b.etichetta.trim() || null,
  stock_total: b.postiTotali.trim() === "" ? null : interoDaTesto(b.postiTotali),
  stock_left: b.postiRimasti.trim() === "" ? null : interoDaTesto(b.postiRimasti),
  active: b.attivo,
  auto_apply: b.sempre,
  apply_message: b.messaggio.trim() || null,
  scarcity_title: b.titoloPosti.trim() || null,
  scarcity_text: b.testoPosti.trim() || null,
});

const testoDa = (v: string | null) => v ?? "";
const numeroTesto = (v: number | null) => (v == null ? "nessun limite" : String(v));

/** Il prima → dopo di una riga, scritto come lo si direbbe a voce. Serve anche
 *  a verificare il salvataggio: se dopo la scrittura non cambia più niente tra
 *  la riga riletta e la bozza, allora è davvero salvato. */
function cambiDi(riga: CodiceSconto, b: Bozza): Cambio[] {
  const v = valoriDa(b);
  const out: Cambio[] = [];
  const prima = Number(riga.discount_eur) || 0;
  if (v.discount_eur !== prima)
    out.push({
      campo: "Valore dello sconto",
      prima: formatPrice(prima),
      dopo: formatPrice(v.discount_eur),
      avviso:
        v.discount_eur === 0
          ? "a zero il codice non toglie più niente"
          : prima > 0 && v.discount_eur >= prima * 5
            ? `moltiplicato per ${Math.round(v.discount_eur / prima)}`
            : undefined,
    });
  if (v.active !== riga.active)
    out.push({
      campo: "Stato",
      prima: riga.active ? "attivo" : "spento",
      dopo: v.active ? "attivo" : "spento",
      avviso: v.active ? undefined : "smetterà di funzionare anche per chi lo ha già ricevuto",
    });
  if (v.auto_apply !== riga.auto_apply)
    out.push({
      campo: "Quando si applica",
      prima: riga.auto_apply ? "da solo, a ogni preventivo" : "solo se digitato",
      dopo: v.auto_apply ? "da solo, a ogni preventivo" : "solo se digitato",
      avviso: v.auto_apply ? "finirà su ogni preventivo, senza che nessuno lo chieda" : undefined,
    });
  if (v.stock_total !== riga.stock_total)
    out.push({
      campo: "Posti totali",
      prima: numeroTesto(riga.stock_total),
      dopo: numeroTesto(v.stock_total),
    });
  if (v.stock_left !== riga.stock_left)
    out.push({
      campo: "Posti rimasti",
      prima: numeroTesto(riga.stock_left),
      dopo: numeroTesto(v.stock_left),
      avviso: v.stock_left === 0 ? "a zero posti il codice non si applica più" : undefined,
    });
  if ((v.label ?? "") !== testoDa(riga.label))
    out.push({
      campo: "Etichetta interna",
      prima: testoDa(riga.label) || "—",
      dopo: v.label ?? "—",
    });
  if ((v.apply_message ?? "") !== testoDa(riga.apply_message))
    out.push({
      campo: "Messaggio al cliente",
      prima: testoDa(riga.apply_message) || "quello di serie",
      dopo: v.apply_message ?? "quello di serie",
    });
  if ((v.scarcity_title ?? "") !== testoDa(riga.scarcity_title))
    out.push({
      campo: "Titolo del riquadro posti",
      prima: testoDa(riga.scarcity_title) || "quello di serie",
      dopo: v.scarcity_title ?? "quello di serie",
    });
  if ((v.scarcity_text ?? "") !== testoDa(riga.scarcity_text))
    out.push({
      campo: "Testo del riquadro posti",
      prima: testoDa(riga.scarcity_text) || "quello di serie",
      dopo: v.scarcity_text ?? "quello di serie",
    });
  return out;
}

/** Il riquadro dei posti come lo leggerà il cliente: stessa sostituzione dei
 *  segnaposto che fa `scarcityFrom` nella pagina del preventivo. */
function anteprimaPosti(b: Bozza, code: string): { titolo: string; testo: string } | null {
  const rimasti = b.postiRimasti.trim() === "" ? null : interoDaTesto(b.postiRimasti);
  if (rimasti == null) return null; // senza posti dichiarati il riquadro non compare
  const totali = b.postiTotali.trim() === "" ? null : interoDaTesto(b.postiTotali);
  return {
    titolo: b.titoloPosti.trim() || TITOLO_POSTI_DEFAULT,
    testo: (b.testoPosti.trim() || TESTO_POSTI_DEFAULT)
      .replace(/\{left\}/g, String(rimasti))
      .replace(/\{total\}/g, totali ? ` su ${totali}` : "")
      .replace(/\{code\}/g, code || "CODICE"),
  };
}

/** Data in cui scadrebbe una promozione creata oggi con N giorni utili: stessa
 *  regola del catalogo (weekend non contati, mai scadenza nel weekend). */
function anteprimaScadenza(n: number): string {
  if (!(n >= 1 && n <= 120)) return "—";
  const d = new Date();
  let restanti = n;
  while (restanti > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) restanti--;
  }
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

/** Cosa sta per essere scritto e va confermato prima. */
type Conferma =
  | { tipo: "codice"; riga: CodiceSconto; cambi: Cambio[] }
  | { tipo: "elimina"; riga: CodiceSconto }
  | { tipo: "quantita"; cambi: Cambio[] };

const NUOVO_VUOTO: Bozza & { codice: string } = {
  codice: "",
  sconto: "",
  etichetta: "",
  postiTotali: "",
  postiRimasti: "",
  attivo: true,
  sempre: false,
  messaggio: "",
  titoloPosti: "",
  testoPosti: "",
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. LA SCHEDA
   ═════════════════════════════════════════════════════════════════════════ */

export function SettingsSconti({ chiaveRicarica = 0 }: { chiaveRicarica?: number }) {
  const [codici, setCodici] = useState<CodiceSconto[]>([]);
  const [bozze, setBozze] = useState<Record<string, Bozza>>({});
  const [qtySalvato, setQtySalvato] = useState<Record<string, string>>({});
  const [qtyBozza, setQtyBozza] = useState<Record<string, string>>({});
  const [listino, setListino] = useState<PricingOverrides>({});

  const [promoDays, setPromoDays] = useState("2");
  const [promoSalvati, setPromoSalvati] = useState("2");
  const [salvandoPromo, setSalvandoPromo] = useState(false);

  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvatoAlle, setSalvatoAlle] = useState<Date | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);
  const [nuovoAperto, setNuovoAperto] = useState(false);
  const [nuovo, setNuovo] = useState({ ...NUOVO_VUOTO });
  const [testiAperti, setTestiAperti] = useState<Set<string>>(new Set());
  const [nuovaQ, setNuovaQ] = useState("");
  const [nuovoD, setNuovoD] = useState("");

  const [baseId, setBaseId] = useState<string>(BASE_SOLUTIONS[0].id);
  const [quantita, setQuantita] = useState(1);

  /* ── LETTURA ──────────────────────────────────────────────────────────── */
  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      const [coupon, prezzi] = await Promise.all([
        fetch("/api/presenter/coupons").then((r) => r.json()) as Promise<{
          codes?: CodiceSconto[];
          qty?: Record<string, number>;
          promoDays?: number;
          garanzie?: MappaGaranzie;
        }>,
        fetch("/api/presenter/pricing")
          .then((r) => r.json())
          .then((j) => (j.pricing ?? {}) as PricingOverrides),
      ]);
      const righe = coupon.codes ?? [];
      setCodici(righe);
      setBozze(Object.fromEntries(righe.map((r) => [r.id, bozzaDa(r)])));
      //  ⚠️ Si ripassa da `leggiMappa` anche se arriva già come oggetto: quella
      //   funzione normalizza i codici in maiuscolo e i valori mancanti, ed è
      //   l'unica che sa qual è il ripiego giusto (mostra = sì).
      setGaranzie(leggiMappa(JSON.stringify(coupon.garanzie ?? {})));
      const testi: Record<string, string> = {};
      Object.entries(coupon.qty ?? {}).forEach(([q, v]) => {
        if (v != null) testi[q] = testoDaNumero(Number(v));
      });
      setQtySalvato(testi);
      setQtyBozza(testi);
      if (coupon.promoDays) {
        setPromoDays(String(coupon.promoDays));
        setPromoSalvati(String(coupon.promoDays));
      }
      setListino(prezzi);
      setErrore(null);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Sconti non leggibili");
    }
    setCaricamento(false);
  }, []);
  useEffect(() => {
    carica();
  }, [carica, chiaveRicarica]);

  /** La mappa delle garanzie, com'è in archivio. La riga la legge da qui e la
   *  riscrive salvando: una sola verità a schermo. */
  const [garanzie, setGaranzie] = useState<MappaGaranzie>({});

  /** ⚠️ SI SCRIVE UNA VOCE SOLA, non la mappa intera: due schede aperte sullo
   *  stesso pannello, salvando tutto, si cancellerebbero le modifiche a vicenda
   *  senza dire niente. La rotta rilegge, cambia quella voce e riscrive. */
  const salvaGaranzia = async (codice: string, g: GaranziaCodice | null) => {
    const risposta = (await post(
      g
        ? {
            action: "garanzia",
            code: codice,
            mostra: g.mostra,
            importo: g.importo,
            //  I limiti viaggiano sempre, anche vuoti: così togliere una data
            //  la toglie davvero, invece di lasciare quella di prima scritta in
            //  archivio e mostrata al cliente.
            posti: g.posti ?? null,
            postiTotali: g.postiTotali ?? null,
            scadenza: g.scadenza ?? "",
            titolo: g.titolo ?? "",
          }
        : { action: "garanzia", code: codice, rimuovi: true },
    )) as { ok?: boolean; garanzie?: MappaGaranzie; reason?: string };
    if (!risposta?.ok) {
      toast.error("Garanzia NON salvata", { description: risposta?.reason });
      return;
    }
    setGaranzie(risposta.garanzie ?? {});
    toast.success(
      g === null
        ? `${codice}: la garanzia torna a quella di listino`
        : g.mostra
          ? `${codice}: la garanzia si vede${g.importo ? "" : ", al prezzo di listino"}`
          : `${codice}: la garanzia non si vede`,
    );
  };

  const post = async (payload: Record<string, unknown>) =>
    fetch("/api/presenter/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

  /* ── COSA CAMBIEREBBE, SE SI SALVASSE ─────────────────────────────────── */
  const cambiPerRiga = useMemo(() => {
    const out: Record<string, Cambio[]> = {};
    codici.forEach((r) => {
      const b = bozze[r.id];
      if (b) out[r.id] = cambiDi(r, b);
    });
    return out;
  }, [codici, bozze]);

  /** Le soglie di quantità toccate: si guarda l'unione delle chiavi, perché una
   *  soglia può essere stata aggiunta o tolta, non solo cambiata di valore. */
  const cambiQuantita = useMemo<Cambio[]>(() => {
    const chiavi = Array.from(new Set([...Object.keys(qtySalvato), ...Object.keys(qtyBozza)])).sort(
      (a, b) => Number(a) - Number(b),
    );
    const out: Cambio[] = [];
    chiavi.forEach((q) => {
      const prima = numeroDaTesto(qtySalvato[q] ?? "") ?? 0;
      const dopo = numeroDaTesto(qtyBozza[q] ?? "") ?? 0;
      if (prima !== dopo)
        out.push({
          campo: `${q} impianti`,
          prima: prima > 0 ? formatPrice(prima) : "nessuno sconto",
          dopo: dopo > 0 ? formatPrice(dopo) : "nessuno sconto",
        });
    });
    return out;
  }, [qtySalvato, qtyBozza]);

  const inSospeso =
    Object.values(cambiPerRiga).reduce((s, c) => s + c.length, 0) + cambiQuantita.length;
  useAvvisoModificheNonSalvate(inSospeso);

  /* ── IL PREVENTIVO TIPO, CON GLI SCONTI DELLA BOZZA ───────────────────── */
  //  Si guarda la bozza e non il salvato: la domanda è "se salvo, quanto paga
  //  il cliente". Il filtro sui posti è lo stesso del server, altrimenti qui
  //  comparirebbe uno sconto che nel preventivo non parte.
  const vigenti = useMemo<ScontiVigenti>(() => {
    const auto = codici
      .map((r) => ({ r, b: bozze[r.id] }))
      .filter(({ b }) => b && b.attivo && b.sempre)
      .map(({ r, b }) => ({
        code: r.code,
        etichetta: b.etichetta || null,
        eur: numeroDaTesto(b.sconto) ?? 0,
        rimasti: b.postiRimasti.trim() === "" ? null : interoDaTesto(b.postiRimasti),
      }))
      .filter((a) => a.eur > 0 && (a.rimasti === null || a.rimasti > 0))
      .map(({ code, etichetta, eur }) => ({ code, etichetta, eur }));
    const mappa: Record<string, number> = {};
    Object.keys(qtyBozza).forEach((q) => {
      const v = numeroDaTesto(qtyBozza[q] ?? "");
      if (v && v > 0) mappa[q] = v;
    });
    return { auto, quantita: mappa };
  }, [codici, bozze, qtyBozza]);

  const calcolo = useMemo(
    () => calcolaPreventivoTipo(listino, vigenti, baseId, quantita),
    [listino, vigenti, baseId, quantita],
  );
  const basi = useMemo(() => basiDisponibili(listino), [listino]);

  /** Il totale di listino a ogni quantità: è il denominatore onesto delle
   *  percentuali degli sconti quantità (a 3 impianti il totale è un altro).
   *  Si ricalcola solo quando cambiano listino, soluzione o soglie. */
  const lordoPer = useMemo(() => {
    const m: Record<string, number> = {};
    const chiavi = new Set<string>([
      ...QUANTITA.map(String),
      ...Object.keys(qtyBozza),
      ...Object.keys(qtySalvato),
    ]);
    chiavi.forEach((q) => {
      const n = Number(q);
      if (Number.isFinite(n) && n > 0)
        m[q] = calcolaPreventivoTipo(listino, { auto: [], quantita: {} }, baseId, n).lordo;
    });
    return m;
  }, [listino, baseId, qtyBozza, qtySalvato]);

  const scontoAutomatico = vigenti.auto.reduce((s, a) => s + a.eur, 0);
  /** Il totale su cui si calcolano TUTTE le percentuali della scheda: un solo
   *  denominatore, altrimenti due percentuali vicine parlerebbero di due totali
   *  diversi senza dirlo. */
  const riferimento = calcolo.lordo;
  /** Il preventivo più piccolo possibile (un impianto): serve solo all'avviso,
   *  perché è lì che uno sconto automatico fa il danno maggiore. */
  const minimo = lordoPer["1"] ?? 0;

  const automatici = codici.filter((r) => r.auto_apply);
  const manuali = codici.filter((r) => !r.auto_apply);
  const sogliePresenti = Object.keys(qtyBozza).sort((a, b) => Number(a) - Number(b));
  const quantitaAttive = sogliePresenti.filter(
    (q) => (numeroDaTesto(qtyBozza[q] ?? "") ?? 0) > 0,
  ).length;

  /* ── SCRITTURA ────────────────────────────────────────────────────────── */

  /** Salva UNA riga e poi la RILEGGE dall'elenco che il server rimanda: se
   *  quello che è tornato non combacia con la bozza, non si dice "salvato". */
  const salvaCodice = async (riga: CodiceSconto) => {
    const b = bozze[riga.id];
    if (!b) return;
    setSalvataggio(true);
    setErrore(null);
    try {
      const j = (await post({ action: "update", id: riga.id, values: valoriDa(b) })) as {
        ok?: boolean;
        reason?: string;
        codes?: CodiceSconto[];
      };
      if (!j.ok) {
        setErrore(
          `Codice ${riga.code} NON salvato: ${j.reason ?? "errore del server"}. Le modifiche sono ancora qui.`,
        );
        toast.error("Non salvato: le modifiche sono ancora qui.");
        return;
      }
      const elenco = j.codes ?? [];
      const riletta = elenco.find((r) => r.id === riga.id);
      if (!riletta || cambiDi(riletta, b).length > 0) {
        setErrore(
          `Il codice ${riga.code} non risulta salvato come richiesto. Riprova: le modifiche sono ancora qui.`,
        );
        toast.error("Salvataggio non confermato: controlla il codice.");
        return;
      }
      setCodici(elenco);
      setBozze(Object.fromEntries(elenco.map((r) => [r.id, bozzaDa(r)])));
      setSalvatoAlle(new Date());
      setConferma(null);
      toast.success(`Codice ${riletta.code} aggiornato`);
    } catch (e) {
      setErrore(`Codice ${riga.code}: ${e instanceof Error ? e.message : "errore di rete"}.`);
      toast.error("Non salvato: le modifiche sono ancora qui.");
    } finally {
      setSalvataggio(false);
    }
  };

  const eliminaCodice = async (riga: CodiceSconto) => {
    setSalvataggio(true);
    try {
      const j = (await post({ action: "delete", id: riga.id })) as {
        ok?: boolean;
        codes?: CodiceSconto[];
      };
      if (!j.ok) {
        //  Anche qui il motivo lo scrive il server: senza permesso sul listino
        //  la risposta dice quale manca, e nasconderlo fa cercare un guasto.
        const motivo =
          typeof (j as { reason?: unknown }).reason === "string"
            ? (j as { reason: string }).reason
            : `Codice ${riga.code} non eliminato.`;
        setErrore(motivo);
        toast.error(motivo);
        return;
      }
      const elenco = j.codes ?? [];
      setCodici(elenco);
      setBozze(Object.fromEntries(elenco.map((r) => [r.id, bozzaDa(r)])));
      setConferma(null);
      setSalvatoAlle(new Date());
      toast.success(`Codice ${riga.code} eliminato`);
    } catch (e) {
      //  La finestra resta aperta apposta: se non si sa se è stato eliminato,
      //  chiuderla farebbe credere di sì.
      setErrore(
        `Codice ${riga.code} non eliminato: ${e instanceof Error ? e.message : "errore di rete"}.`,
      );
      toast.error("Eliminazione non riuscita.");
    } finally {
      setSalvataggio(false);
    }
  };

  const salvaQuantita = async () => {
    setSalvataggio(true);
    setErrore(null);
    try {
      //  Si manda anche lo zero delle soglie tolte: il server tiene solo i
      //  valori maggiori di zero, ed è così che una soglia si cancella.
      const daScrivere: Record<string, string> = {};
      Object.keys(qtyBozza).forEach((q) => {
        daScrivere[q] = qtyBozza[q] ?? "";
      });
      const j = (await post({ action: "qty", qty: daScrivere })) as {
        ok?: boolean;
        qty?: Record<string, number>;
      };
      if (!j.ok) {
        //  ── IL MOTIVO VERO, NON "non salvati" ────────────────────────────
        //   Il server risponde 403 con scritto quale permesso manca quando chi
        //   sta modificando non può toccare il listino. Ingoiare quel testo e
        //   dire solo "non salvati" manda a cercare un guasto che non c'è: si
        //   riprova, si ricarica, si cambia browser — e il prezzo resta quello
        //   di prima senza che nessuno capisca perché.
        const motivo =
          typeof (j as { reason?: unknown }).reason === "string"
            ? (j as { reason: string }).reason
            : "Sconti per quantità NON salvati. Le modifiche sono ancora qui.";
        setErrore(motivo);
        toast.error(motivo);
        return;
      }
      const riletti = j.qty ?? {};
      const combacia = Object.keys(qtyBozza).every((q) => {
        const voluto = numeroDaTesto(qtyBozza[q] ?? "") ?? 0;
        return (Number(riletti[q]) || 0) === voluto;
      });
      if (!combacia) {
        setErrore("Gli sconti per quantità non risultano salvati come richiesto. Riprova.");
        toast.error("Salvataggio non confermato.");
        return;
      }
      const testi: Record<string, string> = {};
      Object.entries(riletti).forEach(([q, v]) => {
        testi[q] = testoDaNumero(Number(v));
      });
      setQtySalvato(testi);
      setQtyBozza(testi);
      setConferma(null);
      setSalvatoAlle(new Date());
      toast.success("Sconti per quantità aggiornati");
    } catch (e) {
      setErrore(`Sconti per quantità: ${e instanceof Error ? e.message : "errore di rete"}.`);
      toast.error("Non salvati: le modifiche sono ancora qui.");
    } finally {
      setSalvataggio(false);
    }
  };

  const creaCodice = async () => {
    const codice = nuovo.codice.trim().toUpperCase();
    if (!codice) {
      toast.error("Serve un codice.");
      return;
    }
    setSalvataggio(true);
    try {
      const j = (await post({
        action: "create",
        code: codice,
        label: nuovo.etichetta,
        //  L'importo va al server come testo: là `euroDaValore` legge la virgola.
        discount_eur: nuovo.sconto,
        //  I POSTI no: il server li legge con `Number()`, che su "1.500" darebbe
        //  1,5 posti e su "20 posti" darebbe NaN. Si arrotondano qui, con la
        //  stessa lettura usata in modifica, e si manda un intero o niente.
        stock_total: interoDaTesto(nuovo.postiTotali),
        //  "Rimanenti" vuoto significa "tutti quelli dichiarati": è la lettura
        //  naturale, e il server fa esattamente questo (stock_left ?? total).
        stock_left: interoDaTesto(nuovo.postiRimasti),
        auto_apply: nuovo.sempre,
        apply_message: nuovo.messaggio,
        scarcity_title: nuovo.titoloPosti,
        scarcity_text: nuovo.testoPosti,
      })) as { ok?: boolean; reason?: string; codes?: CodiceSconto[] };
      if (!j.ok) {
        toast.error(
          j.reason === "duplicate"
            ? "Esiste già un codice con questo nome."
            : (j.reason ?? "Errore"),
        );
        return;
      }
      const elenco = j.codes ?? [];
      setCodici(elenco);
      setBozze(Object.fromEntries(elenco.map((r) => [r.id, bozzaDa(r)])));
      setNuovo({ ...NUOVO_VUOTO });
      setNuovoAperto(false);
      setSalvatoAlle(new Date());
      toast.success(`Codice ${codice} creato`);
    } catch (e) {
      //  Senza questo ramo una rete caduta lasciava la finestra aperta e muta:
      //  si ripremeva "Crea" credendo di non aver premuto.
      setErrore(
        `Codice ${codice} non creato: ${e instanceof Error ? e.message : "errore di rete"}.`,
      );
      toast.error("Codice non creato.");
    } finally {
      setSalvataggio(false);
    }
  };

  const salvaPromoDays = async () => {
    setSalvandoPromo(true);
    try {
      const j = (await post({ action: "promoDays", promoDays: Number(promoDays) })) as {
        ok?: boolean;
        promoDays?: number;
      };
      if (j.ok) {
        setPromoSalvati(String(j.promoDays ?? promoDays));
        toast.success("Durata delle promozioni aggiornata");
      } else toast.error("Valore non valido (da 1 a 120 giorni)");
    } catch {
      //  Senza il `finally` una rete caduta lasciava il bottone su "…" per
      //  sempre: sembrava che stesse ancora salvando.
      toast.error("Durata non salvata: riprova.");
    } finally {
      setSalvandoPromo(false);
    }
  };

  const aggiorna = (id: string, patch: Partial<Bozza>) =>
    setBozze((b) => ({ ...b, [id]: { ...b[id], ...patch } }));

  /** I riquadri in cima portano al blocco che contano: la scheda è lunga, e un
   *  numero che dice "tre codici automatici" senza portarci è solo un numero.
   *  Era così anche nella pagina del gestionale. */
  const vaiA = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const aggiungiSoglia = () => {
    //  Una soglia è un numero di impianti: sotto 1 non vuol dire niente, e
    //  `parseInt` da solo lascerebbe passare lo zero (la stringa "0" è "vera").
    const n = parseInt(nuovaQ, 10);
    if (!Number.isFinite(n) || n < 1 || !nuovoD.trim()) return;
    setQtyBozza({ ...qtyBozza, [String(n)]: nuovoD });
    setNuovaQ("");
    setNuovoD("");
  };
  const togliSoglia = (q: string) => {
    //  Non si cancella la chiave: si azzera. Una chiave sparita dalla bozza non
    //  verrebbe mandata al server, e la soglia resterebbe scritta nel database.
    setQtyBozza({ ...qtyBozza, [q]: "0" });
  };

  /* ── LA SCHEDA ────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-white/55">
          Quando si toglie qualcosa dal totale, e quanto vale in percentuale.
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatoSalvataggio
            quanti={inSospeso}
            salvatoAlle={salvatoAlle}
            caricamento={caricamento}
          />
          <button
            type="button"
            onClick={() => setNuovoAperto(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" /> Nuovo codice
          </button>
        </div>
      </div>

      {errore && <Avviso tono="grave">{errore}</Avviso>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          etichetta="Preventivo tipo"
          valore={euroCorto(calcolo.lordo)}
          nota={`Totale di listino · ${calcolo.quantita} ${
            calcolo.quantita === 1 ? "impianto" : "impianti"
          }`}
        />
        <Numero
          etichetta="Tolto a ogni preventivo"
          valore={euroCorto(scontoAutomatico)}
          nota={
            scontoAutomatico > 0
              ? `${percentuale(scontoAutomatico, riferimento)} del totale, senza digitare niente`
              : "Nessuno sconto parte da solo"
          }
          tono={scontoAutomatico > 0 ? "sospeso" : "neutro"}
          onClick={() => vaiA("sconti-automatici")}
        />
        <Numero
          etichetta="Sconti per quantità"
          valore={quantitaAttive}
          nota="Partono da soli con più impianti"
          onClick={() => vaiA("sconti-quantita")}
        />
        <Numero
          etichetta="Codici da digitare"
          valore={manuali.filter((r) => r.active).length}
          nota="Valgono solo se qualcuno li scrive"
          onClick={() => vaiA("sconti-manuali")}
        />
      </div>

      {/* ── L'UNICO AVVISO DELLA SCHEDA ────────────────────────────────────
          Lo sconto che parte da solo si applica a QUALUNQUE preventivo, anche
          al più piccolo: il caso peggiore — e quindi quello da sorvegliare — è
          un impianto solo, non la quantità scelta qui sotto per l'anteprima. */}
      {scontoAutomatico >= minimo && minimo > 0 ? (
        <Avviso tono="grave">
          Gli sconti che partono da soli ({formatPrice(scontoAutomatico)}) valgono quanto o più di
          un preventivo da un impianto ({formatPrice(minimo)}): quel cliente vedrebbe zero. Spegnine
          qualcuno qui sotto.
        </Avviso>
      ) : scontoAutomatico > minimo * 0.25 && minimo > 0 ? (
        <Avviso>
          Ogni preventivo parte già scontato di {formatPrice(scontoAutomatico)} —{" "}
          {percentuale(scontoAutomatico, minimo)} su un preventivo da un impianto — senza che
          nessuno lo chieda. Controlla che sia voluto.
        </Avviso>
      ) : null}

      {/* ── 1. QUELLI CHE PARTONO DA SOLI ──────────────────────────────── */}
      <Riquadro
        id="sconti-automatici"
        icona={Zap}
        titolo="Si applicano da soli, a ogni preventivo"
        nota="Nessuno li digita: il cliente vede già il prezzo scontato. Se sono più di uno, si sommano."
        senzaPadding
      >
        {caricamento ? (
          <p className="px-4 pb-4 text-center text-[12.5px] text-white/50">Caricamento…</p>
        ) : automatici.length === 0 ? (
          <p className="px-4 pb-4 text-center text-[12.5px] text-white/50">
            Nessun codice automatico: oggi ogni preventivo parte dal prezzo pieno.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {automatici.map((r) => (
              <RigaCodice
                key={r.id}
                riga={r}
                bozza={bozze[r.id]}
                garanzia={garanzie[r.code.toUpperCase()] ?? null}
                onGaranzia={(g) => void salvaGaranzia(r.code, g)}
                cambi={cambiPerRiga[r.id] ?? []}
                lordo={riferimento}
                testiAperti={testiAperti.has(r.id)}
                onTesti={() =>
                  setTestiAperti((s) => {
                    const n = new Set(s);
                    if (n.has(r.id)) n.delete(r.id);
                    else n.add(r.id);
                    return n;
                  })
                }
                onCambio={(patch) => aggiorna(r.id, patch)}
                onAnnulla={() => setBozze((b) => ({ ...b, [r.id]: bozzaDa(r) }))}
                onSalva={() =>
                  setConferma({ tipo: "codice", riga: r, cambi: cambiPerRiga[r.id] ?? [] })
                }
                onElimina={() => setConferma({ tipo: "elimina", riga: r })}
              />
            ))}
          </div>
        )}
      </Riquadro>

      {/* ── 2. QUELLI LEGATI ALLA QUANTITÀ ─────────────────────────────── */}
      <Riquadro
        id="sconti-quantita"
        icona={Package}
        titolo="Si applicano quando il cliente sceglie più impianti"
        nota="Partono da soli alla quantità indicata e si sommano ai codici. Vuoto o zero = nessuno sconto."
        azioni={
          cambiQuantita.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setQtyBozza(qtySalvato)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-white/10"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Annulla
              </button>
              <button
                type="button"
                onClick={() => setConferma({ tipo: "quantita", cambi: cambiQuantita })}
                className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-110"
              >
                <Save className="h-3.5 w-3.5" /> Rivedi e salva
              </button>
            </>
          ) : (
            <span className="text-[11px] text-white/40">Nessuna modifica in sospeso</span>
          )
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sogliePresenti.length === 0 && (
            <p className="text-[12px] text-white/40">Nessuna soglia. Aggiungine una qui sotto.</p>
          )}
          {sogliePresenti.map((q) => {
            const valore = numeroDaTesto(qtyBozza[q] ?? "") ?? 0;
            const prima = numeroDaTesto(qtySalvato[q] ?? "") ?? 0;
            const totale = lordoPer[q] ?? 0;
            const cambiato = valore !== prima;
            return (
              <div
                key={q}
                className={`rounded-xl border px-3 py-2.5 ${
                  cambiato
                    ? "border-amber-400/45 bg-amber-400/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-white">{q} impianti</span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={qtyBozza[q] ?? ""}
                      aria-label={`Sconto per ${q} impianti`}
                      placeholder="0"
                      onChange={(e) => setQtyBozza({ ...qtyBozza, [q]: e.target.value })}
                      className="h-8 w-24 rounded-lg border border-white/15 bg-white/5 pr-6 text-right text-[13px] font-semibold tabular-nums text-white focus:border-brand focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-white/40">
                      €
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => togliSoglia(q)}
                    title="Azzera questa soglia"
                    className="rounded-md border border-white/10 p-1.5 text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-white/45">
                  {valore > 0 ? (
                    <>
                      <strong className="text-emerald-300">{percentuale(valore, totale)}</strong> su{" "}
                      {formatPrice(totale)} · il cliente paga{" "}
                      {formatPrice(Math.max(0, totale - valore))}
                    </>
                  ) : (
                    <>
                      A {q} impianti il totale resta {formatPrice(totale)}
                    </>
                  )}
                  {cambiato && (
                    <span className="text-amber-300">
                      {" "}
                      · era {prima > 0 ? formatPrice(prima) : "nessuno sconto"}
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        {/* riga aggiungi: le soglie sono libere, non solo quelle del listino */}
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3">
          <label className="block">
            <span className={ETICHETTA}>Da N impianti</span>
            <input
              type="text"
              inputMode="numeric"
              value={nuovaQ}
              onChange={(e) => setNuovaQ(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="es. 3"
              className="w-28 rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white focus:border-brand focus:outline-none"
            />
          </label>
          <label className="block">
            <span className={ETICHETTA}>Sconto €</span>
            <input
              type="text"
              inputMode="decimal"
              value={nuovoD}
              onChange={(e) => setNuovoD(e.target.value)}
              placeholder="es. 450,73"
              className="w-28 rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white focus:border-brand focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={aggiungiSoglia}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            + Aggiungi
          </button>
          <span className="text-[11px] text-white/40">
            Si aggiunge alla bozza: diventa vero solo dopo "Rivedi e salva".
          </span>
        </div>
      </Riquadro>

      {/* ── 3. QUELLI CHE VANNO DIGITATI ───────────────────────────────── */}
      <Riquadro
        id="sconti-manuali"
        icona={Ticket}
        titolo="Si applicano solo se qualcuno digita il codice"
        nota="Finché nessuno lo scrive nel configuratore, il cliente vede il totale pieno."
        senzaPadding
      >
        {caricamento ? (
          <p className="px-4 pb-4 text-center text-[12.5px] text-white/50">Caricamento…</p>
        ) : manuali.length === 0 ? (
          <div className="px-4 pb-4 text-center">
            <p className="text-[12.5px] text-white/50">
              Nessun codice da digitare. Un codice serve quando il prezzo dedicato va dato a una
              persona sola: la video testimonianza, una promozione, un caso particolare.
            </p>
            <button
              type="button"
              onClick={() => setNuovoAperto(true)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/10"
            >
              <Plus className="h-3.5 w-3.5" /> Crea il primo codice
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {manuali.map((r) => (
              <RigaCodice
                key={r.id}
                riga={r}
                bozza={bozze[r.id]}
                garanzia={garanzie[r.code.toUpperCase()] ?? null}
                onGaranzia={(g) => void salvaGaranzia(r.code, g)}
                cambi={cambiPerRiga[r.id] ?? []}
                lordo={riferimento}
                testiAperti={testiAperti.has(r.id)}
                onTesti={() =>
                  setTestiAperti((s) => {
                    const n = new Set(s);
                    if (n.has(r.id)) n.delete(r.id);
                    else n.add(r.id);
                    return n;
                  })
                }
                onCambio={(patch) => aggiorna(r.id, patch)}
                onAnnulla={() => setBozze((b) => ({ ...b, [r.id]: bozzaDa(r) }))}
                onSalva={() =>
                  setConferma({ tipo: "codice", riga: r, cambi: cambiPerRiga[r.id] ?? [] })
                }
                onElimina={() => setConferma({ tipo: "elimina", riga: r })}
              />
            ))}
          </div>
        )}
      </Riquadro>

      {/* ── 4. QUANTO DURA UNA PROMOZIONE ──────────────────────────────────
          Quanti giorni UTILI dopo oggi resta valido il prezzo di un preventivo
          nuovo. Sabato e domenica non contano e la scadenza non ci cade mai: un
          cliente non può disporre un bonifico nel fine settimana, e una
          scadenza che cade lì è una scadenza finta. */}
      <Riquadro
        icona={Clock}
        titolo="Durata delle promozioni"
        nota={
          <>
            Per quanti giorni resta valido il prezzo scontato di un preventivo nuovo. Sabato e
            domenica non si contano e la scadenza non cade mai nel fine settimana.{" "}
            <b className="text-white/70">2 giorni = 48 ore.</b>
          </>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={ETICHETTA}>Giorni</span>
            <input
              inputMode="numeric"
              value={promoDays}
              onChange={(e) => setPromoDays(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="w-24 rounded border border-white/15 bg-white/5 px-2 py-1 text-sm text-white focus:border-brand focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={salvaPromoDays}
            disabled={salvandoPromo || !promoDays || promoDays === promoSalvati}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {salvandoPromo ? "…" : "Salva durata"}
          </button>
          <span className="text-xs text-white/45">
            Un preventivo creato oggi scadrebbe{" "}
            <b className="font-medium text-white/70">{anteprimaScadenza(Number(promoDays) || 0)}</b>
          </span>
        </div>
      </Riquadro>

      <SchedaPreventivoTipo
        calcolo={calcolo}
        basi={basi}
        onBase={setBaseId}
        onQuantita={setQuantita}
        nota={
          <p className="text-[11.5px] text-white/45">
            I prezzi arrivano dalla scheda <strong className="text-white/70">Listino</strong>. I
            posti dei codici non si scalano da soli: quando un cliente usa il codice, il numero dei
            rimasti va abbassato qui. Se più codici hanno dei posti, nel preventivo del cliente
            compare un riquadro solo.
          </p>
        }
      />

      {/* ── LE FINESTRE ────────────────────────────────────────────────── */}
      <FinestraNuovoCodice
        aperta={nuovoAperto}
        onChiudi={() => setNuovoAperto(false)}
        nuovo={nuovo}
        onCambio={(patch) => setNuovo({ ...nuovo, ...patch })}
        lordo={riferimento}
        salvataggio={salvataggio}
        onCrea={creaCodice}
      />

      <FinestraScura
        aperta={conferma?.tipo === "codice"}
        onChiudi={() => setConferma(null)}
        bloccante
        icona={Ticket}
        titolo="Conferma le modifiche al codice"
        larghezza="sm"
        contesto={
          conferma?.tipo === "codice"
            ? `${conferma.riga.code} · ${conferma.cambi.length} ${
                conferma.cambi.length === 1 ? "valore" : "valori"
              }`
            : undefined
        }
        azioni={
          <>
            <BottoneChiaro onClick={() => setConferma(null)} disabled={salvataggio}>
              Torna a controllare
            </BottoneChiaro>
            <BottonePieno
              onClick={() => conferma?.tipo === "codice" && salvaCodice(conferma.riga)}
              disabled={salvataggio}
            >
              {salvataggio ? "Salvataggio…" : "Salva il codice"}
            </BottonePieno>
          </>
        }
      >
        {conferma?.tipo === "codice" && (
          <ElencoCambi cambi={conferma.cambi}>
            {(bozze[conferma.riga.id]?.sempre ?? false) &&
              (bozze[conferma.riga.id]?.attivo ?? false) && (
                <NotaFinestra tono="attenzione" icona={Zap}>
                  Da salvato, questo codice si applicherà a <strong>ogni preventivo</strong>: −
                  {formatPrice(numeroDaTesto(bozze[conferma.riga.id]?.sconto ?? "") ?? 0)}, cioè{" "}
                  {percentuale(
                    numeroDaTesto(bozze[conferma.riga.id]?.sconto ?? "") ?? 0,
                    riferimento,
                  )}{" "}
                  del preventivo tipo.
                </NotaFinestra>
              )}
          </ElencoCambi>
        )}
      </FinestraScura>

      <FinestraScura
        aperta={conferma?.tipo === "quantita"}
        onChiudi={() => setConferma(null)}
        bloccante
        icona={Package}
        titolo="Conferma gli sconti per quantità"
        larghezza="sm"
        contesto={
          conferma?.tipo === "quantita"
            ? `${conferma.cambi.length} ${
                conferma.cambi.length === 1 ? "quantità" : "quantità diverse"
              } da aggiornare`
            : undefined
        }
        azioni={
          <>
            <BottoneChiaro onClick={() => setConferma(null)} disabled={salvataggio}>
              Torna a controllare
            </BottoneChiaro>
            <BottonePieno onClick={salvaQuantita} disabled={salvataggio}>
              {salvataggio ? "Salvataggio…" : "Salva gli sconti"}
            </BottonePieno>
          </>
        }
      >
        {conferma?.tipo === "quantita" && (
          <ElencoCambi cambi={conferma.cambi}>
            <NotaFinestra icona={Package}>
              Partono da soli: il cliente che sceglie quella quantità vede già il totale scontato.
            </NotaFinestra>
          </ElencoCambi>
        )}
      </FinestraScura>

      <FinestraScura
        aperta={conferma?.tipo === "elimina"}
        onChiudi={() => setConferma(null)}
        bloccante
        icona={Trash2}
        titolo="Elimina il codice"
        larghezza="sm"
        contesto={conferma?.tipo === "elimina" ? conferma.riga.code : undefined}
        azioni={
          <>
            <BottoneChiaro onClick={() => setConferma(null)} disabled={salvataggio}>
              Annulla
            </BottoneChiaro>
            <BottonePieno
              tono="rosso"
              onClick={() => conferma?.tipo === "elimina" && eliminaCodice(conferma.riga)}
              disabled={salvataggio}
            >
              {salvataggio ? "Eliminazione…" : "Elimina definitivamente"}
            </BottonePieno>
          </>
        }
      >
        {conferma?.tipo === "elimina" && (
          <div className="space-y-2.5">
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              Il codice <strong>{conferma.riga.code}</strong> sparisce per sempre: chi lo ha già
              ricevuto lo vedrà rifiutato dal configuratore. Se ti serve solo sospenderlo, chiudi
              questa finestra e mettilo su <strong>spento</strong>.
            </NotaFinestra>
            <p className="text-[12px] text-white/60">
              Valore: {formatPrice(Number(conferma.riga.discount_eur) || 0)}
              {conferma.riga.label ? ` · ${conferma.riga.label}` : ""}
            </p>
          </div>
        )}
      </FinestraScura>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. I PEZZI
   ═════════════════════════════════════════════════════════════════════════ */

/** Una riga di codice sconto: quanto vale, quando parte, cosa legge il cliente. */
function RigaCodice({
  riga,
  bozza,
  cambi,
  lordo,
  testiAperti,
  onTesti,
  onCambio,
  onAnnulla,
  onSalva,
  onElimina,
  garanzia,
  onGaranzia,
}: {
  riga: CodiceSconto;
  bozza?: Bozza;
  cambi: Cambio[];
  /** totale di listino del preventivo tipo: il denominatore della percentuale */
  lordo: number;
  testiAperti: boolean;
  onTesti: () => void;
  onCambio: (patch: Partial<Bozza>) => void;
  onAnnulla: () => void;
  onSalva: () => void;
  onElimina: () => void;
  /** ── LA GARANZIA DI QUESTO CODICE ──────────────────────────────────────
   *  `null` = questo codice non dice niente, e allora sul preventivo vale il
   *  listino. Vive in `app_config` e non fra le colonne del codice: il perché
   *  sta in cima a shop/garanzia-codici. */
  garanzia: GaranziaCodice | null;
  /** ⚠️ SI SALVA SUBITO, e non passa dalla conferma «prima → dopo» come gli
   *   altri campi. È voluto: quelli sono colonne della stessa riga e si
   *   scrivono in un colpo, questa è un'altra tabella. Farla entrare nella
   *   macchina dei cambi avrebbe voluto dire un salvataggio che scrive in due
   *   posti e può riuscire a metà — e «salvato» smetterebbe di voler dire una
   *   cosa sola. */
  onGaranzia: (g: GaranziaCodice | null) => void;
}) {
  if (!bozza) return null;
  const valore = numeroDaTesto(bozza.sconto) ?? 0;
  const rimasti = bozza.postiRimasti.trim() === "" ? null : interoDaTesto(bozza.postiRimasti);
  const esaurito = rimasti != null && rimasti <= 0;
  const inSospeso = cambi.length > 0;
  const posti = anteprimaPosti(bozza, riga.code);
  const messaggio =
    bozza.messaggio.trim() || `Prezzo video testimonianza attivo: risparmi ${formatPrice(valore)}`;

  //  Una riga sola che risponde a "quando si applica": è la frase che il
  //  consulente ripete al cliente, e deve essere sempre vera.
  const quando = !bozza.attivo
    ? "Spento: non si applica in nessun caso."
    : esaurito
      ? "Posti esauriti: non si applica più, nemmeno digitandolo."
      : bozza.sempre
        ? "Si applica da solo a ogni preventivo, senza che nessuno lo digiti."
        : "Si applica solo quando il codice viene scritto nel configuratore.";

  return (
    <div
      className={`space-y-2.5 px-3 py-3 ${inSospeso ? "bg-amber-400/[0.08]" : ""} ${
        !bozza.attivo ? "opacity-70" : ""
      }`}
    >
      {/* intestazione: il codice, quanto vale, quanto pesa */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-brand/15 px-2 py-1 font-mono text-[12.5px] font-bold text-brand">
          {riga.code}
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-white">
          −{formatPrice(valore)}
        </span>
        <span className="text-[12px] text-white/50">
          {valore > 0 ? (
            <>
              <strong className="text-white/80">{percentuale(valore, lordo)}</strong> del preventivo
              tipo
            </>
          ) : (
            "non toglie niente dal totale"
          )}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {esaurito && <Pastiglia tono="brutto">posti esauriti</Pastiglia>}
          {rimasti != null && !esaurito && (
            <Pastiglia tono="sospeso">
              {rimasti} {rimasti === 1 ? "posto rimasto" : "posti rimasti"}
            </Pastiglia>
          )}
          {rimasti == null && <Pastiglia>senza limite di posti</Pastiglia>}
          {inSospeso && <Pastiglia tono="sospeso">{cambi.length} da salvare</Pastiglia>}
        </div>
      </div>

      <p className="text-[11.5px] text-white/45">{quando}</p>

      {/* i due interruttori che decidono "quando" */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Segmento
          attivo={bozza.attivo}
          onClick={() => onCambio({ attivo: !bozza.attivo })}
          titolo="Un codice spento non si applica mai"
        >
          {bozza.attivo ? "Attivo" : "Spento"}
        </Segmento>
        <Segmento
          attivo={bozza.sempre}
          onClick={() => onCambio({ sempre: !bozza.sempre })}
          titolo="Sempre attivo = si applica da solo a ogni preventivo, senza digitarlo"
        >
          Sempre attivo
        </Segmento>
        {riga.auto_apply !== bozza.sempre && (
          <span className="text-[11px] font-medium text-amber-300">
            {bozza.sempre
              ? "diventerà automatico dopo il salvataggio"
              : "smetterà di essere automatico dopo il salvataggio"}
          </span>
        )}
      </div>

      {/* i numeri */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <CampoRiga etichetta="Sconto (€)">
          <input
            type="text"
            inputMode="decimal"
            value={bozza.sconto}
            onChange={(e) => onCambio({ sconto: e.target.value })}
            className={`${CAMPO} text-right font-semibold tabular-nums`}
          />
        </CampoRiga>
        <CampoRiga etichetta="Posti totali" nota="vuoto = illimitato">
          <input
            type="text"
            inputMode="numeric"
            value={bozza.postiTotali}
            placeholder="illimitato"
            onChange={(e) => onCambio({ postiTotali: e.target.value })}
            className={`${CAMPO} text-right tabular-nums`}
          />
        </CampoRiga>
        <CampoRiga etichetta="Posti rimasti" nota="si abbassa a mano">
          <input
            type="text"
            inputMode="numeric"
            value={bozza.postiRimasti}
            placeholder="illimitato"
            onChange={(e) => onCambio({ postiRimasti: e.target.value })}
            className={`${CAMPO} text-right tabular-nums`}
          />
        </CampoRiga>
        <CampoRiga etichetta="Etichetta interna" nota="il cliente non la vede">
          <input
            value={bozza.etichetta}
            placeholder="Promo lancio"
            onChange={(e) => onCambio({ etichetta: e.target.value })}
            className={CAMPO}
          />
        </CampoRiga>
      </div>

      {/* ── LA GARANZIA DEI 450 € ──────────────────────────────────────────
          Richiesta del committente: ogni codice decide se il riquadro della
          garanzia compare sul preventivo, e a che cifra.
          ⚠️ TRE STATI, NON DUE. «Non impostata» non è «non mostrarla»: il primo
           lascia decidere al listino, il secondo la toglie. Con un
           interruttore solo, un codice appena creato avrebbe nascosto la
           garanzia a tutti i suoi preventivi senza che nessuno l'avesse
           chiesto.
          ⚠️ E si salva SUBITO, fuori dalla conferma degli altri campi: quelli
           sono colonne della stessa riga, questa è un'altra tabella. Vedi la
           nota su `onGaranzia`. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
        <span className="text-[11.5px] font-medium text-white/70">Garanzia sul preventivo</span>
        <Segmento
          attivo={!garanzia}
          onClick={() => onGaranzia(null)}
          titolo="Questo codice non decide niente: vale il prezzo di listino"
        >
          Come da listino
        </Segmento>
        <Segmento
          attivo={!!garanzia && garanzia.mostra}
          onClick={() => onGaranzia({ mostra: true, importo: garanzia?.importo ?? 0 })}
          titolo="Il riquadro compare, alla cifra che scrivi qui accanto"
        >
          Mostrala
        </Segmento>
        <Segmento
          attivo={!!garanzia && !garanzia.mostra}
          onClick={() => onGaranzia({ mostra: false, importo: garanzia?.importo ?? 0 })}
          titolo="Sui preventivi con questo codice il riquadro non compare"
        >
          Non mostrarla
        </Segmento>
        {garanzia?.mostra && (
          <label className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-white/50">€</span>
            <input
              type="text"
              inputMode="decimal"
              value={garanzia.importo ? testoDaNumero(garanzia.importo) : ""}
              placeholder="di listino"
              onChange={(e) =>
                onGaranzia({ ...garanzia, mostra: true, importo: numeroDaTesto(e.target.value) ?? 0 })
              }
              className={`${CAMPO} w-28 text-right tabular-nums`}
            />
          </label>
        )}
      </div>

      {/* ── ⚠️ QUANTO È LIMITATA L'OFFERTA ────────────────────────────────
          Richiesta del committente: «posso impostare importo fisso sulla
          garanzia 15 mesi e dice esplicitamente poi sulla garanzia che è
          limitata con i posti e data».
          Compare solo quando una CIFRA c'è: senza cifra non è un'offerta, è il
          prezzo di listino, e non c'è niente da limitare.
          ⚠️ I due campi sono facoltativi e uno solo basta. Lasciandoli vuoti il
           preventivo NON scrive che l'offerta è limitata: una scarsità
           dichiarata e non dimostrata fa perdere fiducia più in fretta di un
           prezzo alto, e questa è la ragione per cui `limiteInParole` (in
           shop/promo-garanzia) torna vuoto invece di inventare una frase. */}
      {garanzia?.mostra && garanzia.importo > 0 && (
        <div className="space-y-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3">
          <p className="text-[11.5px] font-semibold text-emerald-200">
            Offerta sulla garanzia · quanto è limitata
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="text-[11.5px] text-white/60">Posti rimasti</span>
              <input
                type="text"
                inputMode="numeric"
                value={garanzia.posti == null ? "" : String(garanzia.posti)}
                placeholder="nessun limite"
                onChange={(e) =>
                  onGaranzia({
                    ...garanzia,
                    posti: e.target.value.trim() === "" ? null : (interoDaTesto(e.target.value) ?? null),
                  })
                }
                className={`${CAMPO} w-28 text-right tabular-nums`}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-[11.5px] text-white/60">su</span>
              <input
                type="text"
                inputMode="numeric"
                value={garanzia.postiTotali == null ? "" : String(garanzia.postiTotali)}
                placeholder="totali"
                onChange={(e) =>
                  onGaranzia({
                    ...garanzia,
                    postiTotali:
                      e.target.value.trim() === "" ? null : (interoDaTesto(e.target.value) ?? null),
                  })
                }
                className={`${CAMPO} w-24 text-right tabular-nums`}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-[11.5px] text-white/60">Valida fino al</span>
              <input
                type="date"
                value={garanzia.scadenza ?? ""}
                onChange={(e) => onGaranzia({ ...garanzia, scadenza: e.target.value || undefined })}
                className={`${CAMPO} w-40`}
              />
            </label>
          </div>
          <label className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-white/60">Come si chiama</span>
            <input
              type="text"
              value={garanzia.titolo ?? ""}
              placeholder="Offerta riservata"
              onChange={(e) => onGaranzia({ ...garanzia, titolo: e.target.value || undefined })}
              className={`${CAMPO} flex-1 min-w-[12rem]`}
            />
          </label>
          {/*  Come lo leggerà il cliente: la stessa funzione del preventivo, non
               una seconda scrittura che col tempo dice un'altra cosa. */}
          <p className="text-[11px] text-white/45">
            Sul preventivo:{" "}
            <b className="font-semibold text-emerald-200">
              {garanzia.titolo || "Offerta riservata"}
            </b>
            {limiteInParole(garanzia)
              ? ` · ${limiteInParole(garanzia)}`
              : " · nessun limite dichiarato"}
          </p>
        </div>
      )}

      {/* i testi che legge il cliente, chiusi finché non servono */}
      <button
        type="button"
        onClick={onTesti}
        className="flex items-center gap-1 text-[11.5px] font-medium text-white/50 hover:text-white"
      >
        {testiAperti ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        Testi mostrati al cliente
      </button>

      {testiAperti && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="grid gap-2 lg:grid-cols-3">
            <CampoRiga
              etichetta="Messaggio all'applicazione"
              nota={bozza.sempre ? "non compare: si applica da solo" : undefined}
            >
              <input
                value={bozza.messaggio}
                placeholder="Prezzo video testimonianza attivo!"
                onChange={(e) => onCambio({ messaggio: e.target.value })}
                className={`${CAMPO} ${bozza.sempre ? "opacity-60" : ""}`}
              />
            </CampoRiga>
            <CampoRiga etichetta="Titolo del riquadro posti">
              <input
                value={bozza.titoloPosti}
                placeholder={TITOLO_POSTI_DEFAULT}
                onChange={(e) => onCambio({ titoloPosti: e.target.value })}
                className={CAMPO}
              />
            </CampoRiga>
            <CampoRiga etichetta="Testo del riquadro posti" nota="{left} · {total} · {code}">
              <input
                value={bozza.testoPosti}
                placeholder={TESTO_POSTI_DEFAULT}
                onChange={(e) => onCambio({ testoPosti: e.target.value })}
                className={CAMPO}
              />
            </CampoRiga>
          </div>

          {/* l'anteprima: è quello che finisce davanti al cliente */}
          <div className="space-y-2 rounded-lg bg-slate-900 p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              Come lo legge il cliente
            </p>
            {/*  Il messaggio all'applicazione compare SOLO per i codici digitati:
                un codice che parte da solo non ha un momento in cui "si applica",
                e nel riepilogo resta la sola riga con l'importo. */}
            {bozza.sempre ? (
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2">
                <span className="text-[12px] text-emerald-300">
                  Video testimonianza ({riga.code})
                </span>
                <span className="text-[12px] font-semibold text-emerald-300">
                  −{formatPrice(valore)}
                </span>
              </div>
            ) : (
              <p className="text-[12px] font-medium text-emerald-300">✓ {messaggio}</p>
            )}
            {posti ? (
              <div className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2">
                <p className="text-[12px] font-semibold text-amber-200">{posti.titolo}</p>
                <p className="text-[11.5px] text-white/70">{posti.testo}</p>
              </div>
            ) : (
              <p className="text-[11.5px] text-white/40">
                Senza posti dichiarati il riquadro della disponibilità non compare.
              </p>
            )}
          </div>
        </div>
      )}

      {/* il salvataggio: esplicito, e solo di questa riga */}
      <div className="flex flex-wrap items-center gap-2">
        {inSospeso ? (
          <>
            <span className="text-[11.5px] font-medium text-amber-200">
              {cambi.length} {cambi.length === 1 ? "modifica non salvata" : "modifiche non salvate"}
            </span>
            <button
              type="button"
              onClick={onAnnulla}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Annulla
            </button>
            <button
              type="button"
              onClick={onSalva}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-110"
            >
              <Save className="h-3.5 w-3.5" /> Rivedi e salva
            </button>
          </>
        ) : (
          <span className="text-[11.5px] text-white/40">Tutto salvato</span>
        )}
        <button
          type="button"
          onClick={onElimina}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] text-rose-300 transition-colors hover:bg-rose-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" /> Elimina
        </button>
      </div>
    </div>
  );
}

/** Etichetta + campo, misura unica per tutta la scheda. */
function CampoRiga({
  etichetta,
  nota,
  children,
}: {
  etichetta: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-baseline gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">
          {etichetta}
        </span>
        {nota && <span className="text-[11px] text-white/30">{nota}</span>}
      </span>
      {children}
    </label>
  );
}

/** La finestra del codice nuovo. Sta in una finestra e non in fondo alla scheda
 *  perché creare un codice è un'eccezione, non il lavoro di tutti i giorni. */
function FinestraNuovoCodice({
  aperta,
  onChiudi,
  nuovo,
  onCambio,
  lordo,
  salvataggio,
  onCrea,
}: {
  aperta: boolean;
  onChiudi: () => void;
  nuovo: Bozza & { codice: string };
  onCambio: (patch: Partial<Bozza & { codice: string }>) => void;
  lordo: number;
  salvataggio: boolean;
  onCrea: () => void;
}) {
  const valore = numeroDaTesto(nuovo.sconto) ?? 0;
  return (
    <FinestraScura
      aperta={aperta}
      onChiudi={onChiudi}
      icona={Plus}
      titolo="Nuovo codice sconto"
      contesto="Il codice non si potrà più cambiare: chi lo ha ricevuto smetterebbe di poterlo usare"
      azioni={
        <>
          <BottoneChiaro onClick={onChiudi} disabled={salvataggio}>
            Annulla
          </BottoneChiaro>
          <BottonePieno onClick={onCrea} disabled={salvataggio || !nuovo.codice.trim()}>
            {salvataggio ? "Creazione…" : "Crea il codice"}
          </BottonePieno>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoRiga etichetta="Codice" nota="lo scrive il cliente, in maiuscolo">
            <input
              value={nuovo.codice}
              placeholder="ESTATE30"
              onChange={(e) => onCambio({ codice: e.target.value.toUpperCase() })}
              className={`${CAMPO} uppercase`}
            />
          </CampoRiga>
          <CampoRiga
            etichetta="Sconto (€)"
            nota={
              valore > 0 && lordo > 0
                ? `${percentuale(valore, lordo)} del preventivo tipo`
                : "quanto viene tolto dal totale"
            }
          >
            <input
              type="text"
              inputMode="decimal"
              value={nuovo.sconto}
              placeholder="450,73"
              onChange={(e) => onCambio({ sconto: e.target.value })}
              className={`${CAMPO} text-right tabular-nums`}
            />
          </CampoRiga>
          <CampoRiga etichetta="Posti totali" nota="vuoto = nessun limite">
            <input
              type="text"
              inputMode="numeric"
              value={nuovo.postiTotali}
              placeholder="20"
              onChange={(e) => onCambio({ postiTotali: e.target.value })}
              className={`${CAMPO} text-right tabular-nums`}
            />
          </CampoRiga>
          <CampoRiga etichetta="Posti rimasti" nota="vuoto = quanti sono i totali">
            <input
              type="text"
              inputMode="numeric"
              value={nuovo.postiRimasti}
              placeholder="= posti totali"
              onChange={(e) => onCambio({ postiRimasti: e.target.value })}
              className={`${CAMPO} text-right tabular-nums`}
            />
          </CampoRiga>
          <CampoRiga etichetta="Etichetta interna" nota="serve a voi, il cliente non la vede">
            <input
              value={nuovo.etichetta}
              placeholder="Promo lancio"
              onChange={(e) => onCambio({ etichetta: e.target.value })}
              className={CAMPO}
            />
          </CampoRiga>
          <CampoRiga etichetta="Messaggio all'applicazione" nota="vuoto = quello di serie">
            <input
              value={nuovo.messaggio}
              placeholder="Prezzo video testimonianza attivo!"
              onChange={(e) => onCambio({ messaggio: e.target.value })}
              className={CAMPO}
            />
          </CampoRiga>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CampoRiga etichetta="Titolo del riquadro posti" nota="vuoto = quello di serie">
            <input
              value={nuovo.titoloPosti}
              placeholder={TITOLO_POSTI_DEFAULT}
              onChange={(e) => onCambio({ titoloPosti: e.target.value })}
              className={CAMPO}
            />
          </CampoRiga>
          <CampoRiga etichetta="Testo del riquadro posti" nota="{left} · {total} · {code}">
            <input
              value={nuovo.testoPosti}
              placeholder={TESTO_POSTI_DEFAULT}
              onChange={(e) => onCambio({ testoPosti: e.target.value })}
              className={CAMPO}
            />
          </CampoRiga>
        </div>

        <button
          type="button"
          onClick={() => onCambio({ sempre: !nuovo.sempre })}
          aria-pressed={nuovo.sempre}
          className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
            nuovo.sempre
              ? "border-amber-400/45 bg-amber-400/10"
              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
          }`}
        >
          <Zap
            className={`mt-0.5 h-4 w-4 shrink-0 ${nuovo.sempre ? "text-amber-300" : "text-white/40"}`}
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-white">
              Sempre attivo, senza digitarlo
            </span>
            <span className="block text-[11.5px] text-white/50">
              Si applica da solo a ogni preventivo. Da usare solo per una promozione che vale per
              tutti.
            </span>
          </span>
        </button>

        {nuovo.sempre && valore > 0 && (
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            Ogni preventivo partirà scontato di {formatPrice(valore)} — {percentuale(valore, lordo)}{" "}
            del preventivo tipo — senza che nessuno lo chieda.
          </NotaFinestra>
        )}

        <NotaFinestra icona={Ticket}>
          I posti non si scalano da soli: quando un cliente usa il codice, il numero dei rimasti va
          abbassato a mano da questa scheda.
        </NotaFinestra>
      </div>
    </FinestraScura>
  );
}
