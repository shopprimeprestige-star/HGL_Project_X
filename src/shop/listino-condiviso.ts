/** ─────────────────────────────────────────────────────────────────────────
 *  IL LISTINO E GLI SCONTI — la parte che non è schermo
 *
 *  PERCHÉ ESISTE QUESTO FILE
 *  Le cifre del preventivo si configuravano in due posti (il gestionale e
 *  Meetly) e la formula del totale viveva dentro una pagina del CRM. Adesso le
 *  impostazioni stanno tutte dentro Meetly, ma il calcolo NON può stare dentro
 *  un componente: due copie della stessa aritmetica sono due totali diversi il
 *  giorno in cui qualcuno ne tocca una sola.
 *
 *  Qui dentro non c'è nessuna JSX e nessuna chiamata di rete: solo i numeri,
 *  come si leggono, come si scrivono e quanto fanno. Chi disegna sta altrove
 *  (shop/SettingsListino.tsx, shop/SettingsSconti.tsx), chi scrive sul database
 *  sta sul server (routes/api.presenter.pricing.ts, api.presenter.coupons.ts).
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  BASE_SOLUTIONS,
  TRANSPLANT_ID,
  preselezione,
  buildMenu,
  pricingRows,
  sectionsFor,
  type PricingOverrides,
  type PricingRow,
} from "@/shop/quote-menu";

/* ═══════════════════════════════════════════════════════════════════════════
   0. LEGGERE E SCRIVERE UN IMPORTO IN ITALIANO
   ═════════════════════════════════════════════════════════════════════════ */

/** Da testo a numero. Si accetta la virgola perché è così che si scrivono i
 *  prezzi in italiano: un "164,67" letto male diventerebbe 164 in silenzio.
 *  Si accetta anche il punto delle migliaia ("1.250"), ma solo quando è
 *  inequivocabile — tre cifre dopo ogni punto — così "164.67" resta 164,67 e
 *  non diventa sedicimila euro. I negativi non sono un prezzo: valgono come
 *  valore non valido, e il campo lo dice invece di salvarli.
 *
 *  È la stessa lettura che fa il server in `euroDaValore`
 *  (routes/api.presenter.coupons.ts): le due devono restare gemelle, altrimenti
 *  un importo accettato qui verrebbe scartato là. */
export function numeroDaTesto(t: string): number | null {
  let s = t.trim().replace(/[€\s]/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Da numero a testo modificabile: virgola decimale, niente zeri inutili. */
export function testoDaNumero(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return String(n).replace(".", ",");
}

/** I posti sono persone, non centesimi: si arrotondano. */
export function interoDaTesto(t: string): number | null {
  const n = numeroDaTesto(t);
  return n == null ? null : Math.round(n);
}

/** Quanto pesa una cifra su un'altra, detta come si dice a voce a un cliente.
 *  Sotto l'1% la percentuale non significa niente: si scrive a parole. */
export function percentuale(parte: number, totale: number): string {
  if (!(totale > 0) || !(parte > 0)) return "—";
  const p = (parte / totale) * 100;
  if (p < 1) return "meno dell'1%";
  return `${p >= 10 ? Math.round(p) : p.toFixed(1).replace(".", ",")}%`;
}

/** €450,73 quando i centesimi ci sono, €450 quando non ci sono: mostrare
 *  sempre ",00" su un elenco di sconti tondi è rumore. Serve nei riquadri di
 *  sintesi; dove si mostra una cifra COME LA VEDE IL CLIENTE si usa invece
 *  `formatPrice` del catalogo, centesimi compresi. */
export function euroCorto(v: unknown): string {
  const n = Number(v) || 0;
  return `€${n.toLocaleString("it-IT", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. LE VOCI A LISTINO
   ═════════════════════════════════════════════════════════════════════════ */

/** L'elenco piatto delle voci a listino: nomi, gruppi e prezzi di partenza
 *  arrivano da shop/quote-menu, cioè dallo stesso file che costruisce il
 *  preventivo. Nessun secondo catalogo da tenere allineato a mano. */
export const RIGHE: PricingRow[] = pricingRows();

/** Le soluzioni base nel preventivo si scrivono senza il "+" davanti (sono il
 *  punto di partenza, non un'aggiunta): serve saperlo per l'anteprima. */
export const IDS_BASE = new Set(BASE_SOLUTIONS.map((b) => b.id));

/** Le quantità che il cliente può scegliere nel configuratore. */
export const QUANTITA = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Lo stato di una voce mentre la si modifica: importi come TESTO, perché è il
 *  testo che si sta scrivendo — trasformarlo in numero a ogni tasto significa
 *  cancellare la virgola appena digitata. */
export interface Voce {
  prezzo: string;
  pieno: string;
  nascosta: boolean;
}

export type Listino = Record<string, Voce>;

export function vociDaListino(ov: PricingOverrides): Listino {
  const prezzi = ov.prices ?? {};
  const pieni = ov.was ?? {};
  const nascoste = ov.disabled ?? {};
  const out: Listino = {};
  RIGHE.forEach((r) => {
    //  Il prezzo pieno salvato a 0 significa "nessun barrato" e vince sul
    //  valore di catalogo: è la stessa regola di `wasOr` in quote-menu.
    const pienoSalvato = pieni[r.id];
    const pieno =
      pienoSalvato != null ? (pienoSalvato > 0 ? pienoSalvato : null) : (r.wasPrice ?? null);
    out[r.id] = {
      prezzo: testoDaNumero(prezzi[r.id] ?? r.price),
      pieno: r.hasWas ? testoDaNumero(pieno) : "",
      nascosta: !!nascoste[r.id],
    };
  });
  return out;
}

/** Il listino da scrivere: stessa forma di prima (prices / was / disabled),
 *  perché è quella che legge `buildMenu`. */
export function listinoDaVoci(voci: Listino): PricingOverrides {
  const prices: Record<string, number> = {};
  const was: Record<string, number> = {};
  const disabled: Record<string, boolean> = {};
  RIGHE.forEach((r) => {
    const v = voci[r.id];
    if (!v) return;
    const p = numeroDaTesto(v.prezzo);
    if (p != null) prices[r.id] = p;
    if (r.hasWas) {
      const w = numeroDaTesto(v.pieno);
      was[r.id] = w != null && w > 0 ? w : 0; // 0 = nessun prezzo barrato
    }
    if (v.nascosta) disabled[r.id] = true;
  });
  return { prices, was, disabled };
}

export const stessoImporto = (a: string, b: string) =>
  (numeroDaTesto(a) ?? -1) === (numeroDaTesto(b) ?? -1);

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL PRIMA → DOPO
   ═════════════════════════════════════════════════════════════════════════ */

/** Un cambio da confermare, raccontato come si racconterebbe a voce. Lo usano
 *  sia il listino sia gli sconti: un solo modo di dire "prima → dopo". */
export interface Cambio {
  campo: string;
  prima: string;
  dopo: string;
  /** il motivo per cui vale la pena guardarlo due volte */
  avviso?: string;
}

export interface VoceModificata {
  riga: PricingRow;
  cambi: Cambio[];
  prezzo: number;
  pieno: number | null;
  nascosta: boolean;
}

/** L'avviso su un cambio di prezzo. Non sono regole di stile: sono i tre modi
 *  in cui un prezzo sbagliato è arrivato davanti a un cliente — lo zero di
 *  troppo, lo zero mancante, e la voce diventata gratis per errore. */
export function avvisoPrezzo(prima: number | null, dopo: number | null): string | undefined {
  if (prima == null || dopo == null) return undefined;
  if (prima > 0 && dopo === 0) return "diventa GRATIS per tutti";
  if (prima === 0 && dopo > 0) return "non è più inclusa nel prezzo";
  if (prima > 0 && dopo >= prima * 5) return `moltiplicato per ${Math.round(dopo / prima)}`;
  if (dopo > 0 && prima >= dopo * 5) return `diviso per ${Math.round(prima / dopo)}`;
  if (Math.abs(dopo - prima) >= 1000) return "salto di oltre 1.000 €";
  return undefined;
}

/** Le voci toccate e non ancora salvate, con il racconto di cosa cambierebbe.
 *  `formatta` arriva da fuori (formatPrice del catalogo) per non legare questo
 *  file al modo in cui il preventivo scrive gli importi. */
export function vociModificate(
  salvato: Listino,
  bozza: Listino,
  formatta: (n: number) => string,
): VoceModificata[] {
  const out: VoceModificata[] = [];
  RIGHE.forEach((r) => {
    const a = salvato[r.id];
    const b = bozza[r.id];
    if (!a || !b) return;
    const cambi: Cambio[] = [];
    if (!stessoImporto(a.prezzo, b.prezzo)) {
      const prima = numeroDaTesto(a.prezzo);
      const dopo = numeroDaTesto(b.prezzo);
      cambi.push({
        campo: "Prezzo",
        prima: prima == null ? "—" : formatta(prima),
        dopo: dopo == null ? "—" : formatta(dopo),
        avviso: avvisoPrezzo(prima, dopo),
      });
    }
    if (r.hasWas && !stessoImporto(a.pieno, b.pieno)) {
      const prima = numeroDaTesto(a.pieno);
      const dopo = numeroDaTesto(b.pieno);
      cambi.push({
        campo: "Prezzo pieno barrato",
        prima: prima == null ? "nessuno" : formatta(prima),
        dopo: dopo == null ? "nessuno" : formatta(dopo),
      });
    }
    if (a.nascosta !== b.nascosta) {
      cambi.push({
        campo: "Presenza nel preventivo",
        prima: a.nascosta ? "nascosta" : "visibile",
        dopo: b.nascosta ? "nascosta" : "visibile",
        avviso: b.nascosta ? "il cliente non potrà più sceglierla" : undefined,
      });
    }
    if (cambi.length)
      out.push({
        riga: r,
        cambi,
        prezzo: numeroDaTesto(b.prezzo) ?? 0,
        pieno: numeroDaTesto(b.pieno),
        nascosta: b.nascosta,
      });
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. IL PREVENTIVO TIPO — il totale vero, con gli sconti che partono da soli
   ═════════════════════════════════════════════════════════════════════════ */

/** Gli sconti in vigore adesso, cioè quelli che il cliente si trova applicati
 *  senza chiedere niente: i codici "sempre attivi" e lo sconto per quantità. */
export interface ScontiVigenti {
  auto: { code: string; etichetta: string | null; eur: number }[];
  quantita: Record<string, number>;
}

export interface VoceCalcolo {
  nome: string;
  eur: number;
}

export interface PreventivoTipo {
  baseId: string;
  baseNome: string;
  quantita: number;
  /** le voci che compongono UN impianto */
  voci: VoceCalcolo[];
  perImpianto: number;
  /** l'analisi del colore si paga una volta sola, non per impianto */
  analisi: number;
  /** il totale di listino: è la cifra barrata nel riepilogo del cliente */
  lordo: number;
  sconti: VoceCalcolo[];
  /** già limitato al lordo, come fa il preventivo (non si scende sotto zero) */
  sconto: number;
  totale: number;
}

/** ── LA STESSA ARITMETICA DEL PREVENTIVO ───────────────────────────────────
 *  Ricalcata su routes/preventivo.tsx: configurazione di partenza (le scelte
 *  preselezionate, tutte senza sovrapprezzo), simulazione spenta, installazione
 *  accesa, analisi del colore "da casa". È la schermata che il cliente vede
 *  appena apre il link: se il numero qui è sbagliato, è sbagliato anche lì.
 *  Il trapianto è un prodotto a sé: niente installazione e niente analisi. */
export function calcolaPreventivoTipo(
  listino: PricingOverrides,
  sconti: ScontiVigenti,
  baseId: string,
  quantita: number,
): PreventivoTipo {
  const menu = buildMenu(listino);
  const base = menu.base.find((b) => b.id === baseId) ?? menu.base[0] ?? null;
  const trapianto = base?.id === TRANSPLANT_ID;

  const voci: VoceCalcolo[] = [];
  if (base) voci.push({ nome: base.name, eur: base.price });
  //  ⚠️ Le voci spuntate sono quelle che il preventivo spunta DAVVERO — decise
  //   nel pannello Listino, non la combinazione scritta nel codice. Con
  //   `DEFAULT_SELECTED` il preventivo tipo prometteva un totale che il cliente
  //   non avrebbe più visto appena si cambiava una preselezione.
  const spuntate = preselezione(listino, base?.id);
  sectionsFor(menu.sections, base?.id ?? "")
    .flatMap((s) => s.items)
    .filter((i) => spuntate.includes(i.id))
    .forEach((i) => voci.push({ nome: i.name, eur: i.price }));
  if (!trapianto && menu.installation)
    voci.push({ nome: menu.installation.name, eur: menu.installation.price });

  const perImpianto = voci.reduce((s, v) => s + v.eur, 0);
  const remoto = menu.fitting.find((f) => f.id === "remoto") ?? menu.fitting[0];
  const analisi = trapianto ? 0 : (remoto?.price ?? 0);
  const lordo = perImpianto * quantita + analisi;

  const righeSconto: VoceCalcolo[] = sconti.auto.map((a) => ({
    nome: `Video testimonianza (${a.code})`,
    eur: a.eur,
  }));
  const perQuantita = Number(sconti.quantita[String(quantita)]) || 0;
  if (perQuantita > 0)
    righeSconto.push({ nome: `Sconto quantità (${quantita} impianti)`, eur: perQuantita });
  const sconto = Math.min(
    righeSconto.reduce((s, v) => s + v.eur, 0),
    lordo,
  );

  return {
    baseId: base?.id ?? "",
    baseNome: base?.name ?? "—",
    quantita,
    voci,
    perImpianto,
    analisi,
    lordo,
    sconti: righeSconto,
    sconto,
    totale: Math.max(0, lordo - sconto),
  };
}

/** Le basi selezionabili con il listino dato: serve al selettore del
 *  preventivo tipo, ed evita a chi disegna di importare `buildMenu`. */
export function basiDisponibili(listino: PricingOverrides) {
  return buildMenu(listino).base.map((b) => ({ id: b.id, name: b.name }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA RICERCA DEL LISTINO DEVE TROVARE ANCHE QUELLO CHE NON È UNA VOCE
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ «NON C'È L'OPZIONE» QUANDO L'OPZIONE C'È ──────────────────────────
 *  Segnalazione del committente: «non riesco a modificare il prezzo dopo 15
 *  mesi, non c'è opzione su listino».
 *  C'era, ed era al suo posto. Ma la casella di ricerca del pannello cerca solo
 *  fra le ottanta voci del listino, e l'assistenza dopo la consegna non è una
 *  voce: è un riquadro a parte. Chi scriveva «manutenzione» leggeva «nessuna
 *  voce con questi filtri» — cioè il programma gli rispondeva che quella cosa
 *  non esisteva. Un campo che esiste e che la ricerca dichiara assente è
 *  peggio di un campo che manca davvero: il secondo lo chiedi, il primo smetti
 *  di cercarlo.
 *
 *  ⚠️ LE PAROLE SONO QUELLE CHE UNO DIGITA, non quelle che abbiamo scritto noi
 *   nel titolo del riquadro. Nessuno cerca «l'assistenza dopo la consegna»:
 *   si cerca «manutenzione», «450», «15 mesi», «rigenerazione». Ci sono anche
 *   i due numeri VIGENTI, così chi ricorda la cifra e non il nome la trova.
 *  ⚠️ Si risponde da due lettere in su: con una sola lettera qualunque riquadro
 *   si accenderebbe, e un evidenziatore che si accende sempre non indica più
 *   niente. */
export function parlaDiManutenzione(
  cerca: string,
  valori: { prezzo?: string | number; mesi?: string | number } = {},
): boolean {
  const ripulisci = (t: string) =>
    String(t ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const q = ripulisci(cerca);
  if (q.length < 2) return false;
  const parole = ripulisci(
    [
      "assistenza dopo la consegna manutenzione rigenerazione sostituzione impianto",
      "quanto paga dopo mesi ogni garanzia seguito nel tempo",
      valori.prezzo ?? "",
      valori.mesi ?? "",
    ].join(" "),
  );
  return parole.includes(q);
}
