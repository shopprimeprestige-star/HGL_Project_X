/** ── VETRINA V1 · T79 · IL CARRELLO NUOVO: LE DECISIONI SENZA SCHERMO (D89, D83) ────────────────────────
 *  Funzioni pure: niente React, niente rete, niente memoria del browser. Le usano `RigaCarrelloShop`/`RiepilogoOrdine` (T89),
 *  `BarraCarrello` (T84a) e `PaginaCarrello` (T98). Il motore resta quello di oggi (`useCart`, `useRivalidaCarrello`, `rivalida`,
 *  `ripulisciRighe`, `totaleDaRighe`): qui si decide solo COSA mostrare.
 *
 *  ⚠️ LA FINESTRA DEI PREZZI È CHIUSA (D89, V1-T9). Le righe del carrello vengono dalla memoria del browser, dove chiunque può
 *   aver cambiato un prezzo. `righeVista(lines, stato)` lavora sulle `lines` DOPO `replaceLines` del gancio (che le riscrive con
 *   prezzo e nome del server) e mostra una cifra SOLO con `stato === "ok"`: con `controllo` ogni prezzo e il totale sono «…»,
 *   con `non_verificabile` (o uno stato sconosciuto) sono «—». Mai la cifra ricordata dal browser.
 *  ⚠️ Le righe del catalogo vecchio (senza `sku`) e quelle di Invisible Derm (che nello shop non ha mai un prezzo) non si vedono
 *   mai: si contano in `nascoste` e si tolgono con la frase di R2 (`MSG_RIMOSSE`, «alcuni prodotti non sono più disponibili»).
 *  ⚠️ I soldi si sommano in CENTESIMI interi; il testo della cifra lo fa chi disegna, con il suo formattatore (`testoPrezzo`). */
import type { StatoCarrello } from "../useRivalidaCarrello";
import type { TariffaCarrello } from "../cassa/tariffa-carrello";
import { riempi, TESTI_SHOP } from "../../landing/testi-shop";
import type { RigaCarrello, SnapRiga } from "./carrello";
import { MSG_RIMOSSE } from "./cassa";
import type { SrcFoto } from "./modello";
import { eInvisibleDerm } from "./pubblico";

/* ── i prezzi: una cifra, o l'attesa, o niente ─────────────────────────── */

/** `cifra` = dal server, in centesimi · `attesa` = si sta controllando («…») · `assente` = non si sa («—»). */
export type PrezzoVista = { tipo: "cifra"; cent: number } | { tipo: "attesa" } | { tipo: "assente" };

/** I due segni al posto della cifra. Non sono parole: i testi veri stanno in `src/landing/testi-shop.ts`. */
export const SEGNO_ATTESA = "…";
export const SEGNO_ASSENTE = "—";

const intero = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const testo = (x: unknown): x is string => typeof x === "string" && x.trim() !== "";

/** Una cifra si mostra solo con `ok` e se è un intero valido. Chiuso, mai aperto: ogni altro stato non mostra niente. */
function prezzoVista(cent: number | null, stato: unknown): PrezzoVista {
  if (stato === "controllo") return { tipo: "attesa" };
  if (stato === "ok" && cent !== null) return { tipo: "cifra", cent };
  return { tipo: "assente" };
}

/** Il testo di un prezzo: la cifra la scrive `formatta` (centesimi → «289,00 €»), gli altri due casi sono i segni. */
export function testoPrezzo(prezzo: PrezzoVista, formatta: (cent: number) => string): string {
  return prezzo.tipo === "cifra" ? formatta(prezzo.cent) : prezzo.tipo === "attesa" ? SEGNO_ATTESA : SEGNO_ASSENTE;
}

/* ── le righe da mostrare ──────────────────────────────────────────────── */

export interface RigaVista {
  key: string;
  sku: string;
  nome: string;
  varianteNome: string | null;
  slug: string;
  foto: SrcFoto | null;
  qty: number;
  /** Prezzo di un pezzo. */
  unitario: PrezzoVista;
  /** Prezzo della riga (pezzo × quantità). */
  riga: PrezzoVista;
}
export interface VistaCarrello {
  righe: RigaVista[];
  totale: PrezzoVista;
  /** Righe che non si vedono (catalogo vecchio, Invisible Derm, righe rovinate). Il carrello vuoto si decide su `righe`, non sul conteggio del carrello. */
  nascoste: number;
  /** La frase «alcuni prodotti non sono più disponibili» se c'è qualcosa di nascosto E il carrello sta per essere ripulito; con `non_verificabile` niente (le righe sono ancora lì). */
  frase: string | null;
}

type RigaBuona = RigaCarrello & { sku: string; snap: SnapRiga };

/** La riga si può disegnare? Nuova (con `sku`), quantità intera ≥ 1, nome e indirizzo veri, non Invisible Derm. Tutto il resto no, senza lanciare. */
function daMostrare(l: unknown): RigaBuona | null {
  if (typeof l !== "object" || l === null) return null;
  const r = l as Partial<RigaCarrello>;
  const s = r.snap as Partial<SnapRiga> | null | undefined;
  if (!testo(r.key) || !testo(r.sku) || !intero(r.qty) || r.qty < 1) return null;
  if (typeof s !== "object" || s === null || !testo(s.nome) || !testo(s.slug)) return null;
  if (eInvisibleDerm(s.nome, s.slug)) return null;
  return r as RigaBuona;
}

const centValido = (n: unknown): number | null => (intero(n) && n >= 0 ? n : null);

/** Le righe del carrello che si disegnano (stesse regole di `righeVista`), com'erano: servono a chi conta le righe viste (eventi). */
export function righeMostrabili(lines: readonly unknown[]): RigaCarrello[] {
  return (Array.isArray(lines) ? lines : []).flatMap((l) => daMostrare(l) ?? []);
}

/** Le righe del carrello come si disegnano. Non cambia l'elenco ricevuto. */
export function righeVista(lines: readonly unknown[], stato: StatoCarrello): VistaCarrello {
  const elenco = Array.isArray(lines) ? lines : [];
  const righe: RigaVista[] = [];
  let somma: number | null = 0; // `null` = almeno una riga senza cifra valida: il totale non si sa
  for (const l of elenco) {
    const r = daMostrare(l);
    if (!r) continue;
    const unit = centValido(r.snap.prezzoCent);
    const cent = unit !== null && Number.isSafeInteger(unit * r.qty) ? unit * r.qty : null;
    somma = somma !== null && cent !== null && Number.isSafeInteger(somma + cent) ? somma + cent : null;
    righe.push({
      key: r.key,
      sku: r.sku,
      nome: r.snap.nome,
      varianteNome: typeof r.snap.varianteNome === "string" ? r.snap.varianteNome : null,
      slug: r.snap.slug,
      foto: typeof r.snap.foto === "object" ? r.snap.foto : null,
      qty: r.qty,
      unitario: prezzoVista(unit, stato),
      riga: prezzoVista(cent, stato),
    });
  }
  const nascoste = elenco.length - righe.length;
  return { righe, totale: prezzoVista(somma, stato), nascoste, frase: stato === "non_verificabile" ? null : fraseRipulite(nascoste) };
}

/* ── il riepilogo: prodotti · spedizione · totale (V1-K4) ──────────────── */

export interface Riepilogo {
  prodotti: PrezzoVista;
  spedizione: PrezzoVista;
  totale: PrezzoVista;
}

/** La spedizione è la tariffa del SERVER (la stessa della cassa), nessuna soglia di gratuità, nessuna cifra scritta qui.
 *  Il totale è una cifra solo se lo sono prodotti e spedizione; se uno dei due non si sa mai («—») il totale non si sa; altrimenti «…».
 *  Mai un totale senza spedizione, mai «da calcolare». */
export function riepilogo(vista: VistaCarrello, tariffa: Pick<TariffaCarrello, "stato" | "costoCent"> | null | undefined): Riepilogo {
  const spedizione: PrezzoVista =
    tariffa?.stato === "ok" && centValido(tariffa.costoCent) !== null
      ? { tipo: "cifra", cent: tariffa.costoCent as number }
      : tariffa?.stato === "attesa"
        ? { tipo: "attesa" }
        : { tipo: "assente" };
  const { totale: prodotti } = vista;
  const somma = prodotti.tipo === "cifra" && spedizione.tipo === "cifra" ? prodotti.cent + spedizione.cent : null;
  const totale: PrezzoVista =
    prodotti.tipo === "assente" || spedizione.tipo === "assente"
      ? { tipo: "assente" }
      : prodotti.tipo === "attesa" || spedizione.tipo === "attesa" || somma === null || !Number.isSafeInteger(somma)
        ? { tipo: "attesa" }
        : { tipo: "cifra", cent: somma };
  return { prodotti, spedizione, totale };
}

/* ── gli avvisi: cosa è cambiato nel carrello ───────────────────────────── */

export interface AvvisoRiga {
  key: string;
  tipo: "tolta" | "quantita";
  testo: string;
}

/** La frase di R2 se è stata tolta almeno una riga; niente altrimenti. Una frase sola, singolare o plurale che sia. */
export function fraseRipulite(n: unknown): string | null {
  return typeof n === "number" && n > 0 ? MSG_RIMOSSE : null;
}

/** Confronta le righe di PRIMA con quelle di DOPO la ripulitura del server. Ogni riga nuova (con il suo nome) tolta →
 *  avviso con il nome; quantità portata a meno → avviso con il numero (il totale di `righeVista` usa già la nuova quantità).
 *  Le righe tolte senza un nome da dire (catalogo vecchio, Invisible Derm, nome rovinato) non hanno un avviso loro: si contano in
 *  `ripulite`, per la frase generale (`fraseRipulite`). */
export function avvisiRiga(prima: readonly unknown[], dopo: readonly unknown[]): { avvisi: AvvisoRiga[]; ripulite: number } {
  const rimaste = new Map<string, number>();
  for (const l of Array.isArray(dopo) ? dopo : []) {
    const r = l as Partial<RigaCarrello> | null;
    if (r && typeof r === "object" && typeof r.key === "string" && intero(r.qty)) rimaste.set(r.key, r.qty);
  }
  const avvisi: AvvisoRiga[] = [];
  let ripulite = 0;
  for (const l of Array.isArray(prima) ? prima : []) {
    if (typeof l !== "object" || l === null) continue;
    const r = l as Partial<RigaCarrello>;
    const resta = typeof r.key === "string" ? rimaste.get(r.key) : undefined;
    if (resta === undefined) {
      const nome = r.snap?.nome;
      if (typeof r.key === "string" && testo(r.sku) && testo(nome) && !eInvisibleDerm(nome, r.snap?.slug)) {
        avvisi.push({ key: r.key, tipo: "tolta", testo: riempi(TESTI_SHOP.carrello.nonDisponibile, { nome }) });
      } else ripulite++;
    } else if (typeof r.key === "string" && intero(r.qty) && resta >= 1 && resta < r.qty) {
      avvisi.push({ key: r.key, tipo: "quantita", testo: riempi(TESTI_SHOP.carrello.quantitaRidotta, { n: resta }) });
    }
  }
  return { avvisi, ripulite };
}

/* ── la barra fissa «Totale · Vai alla cassa» (V1-K1) ───────────────────── */

/** La cassa di oggi (R2): il bottone del carrello nuovo porta qui (V1-K6). */
export const PERCORSO_CASSA = "/shop/checkout";

/** `righe` = quante righe si VEDONO (`vista.righe.length`); `nascondiConBottone` = il bottone del riepilogo è a schermo.
 *  La barra c'è solo con righe e senza il bottone del riepilogo; nascosta porta `inert` (mai raggiungibile con Tab). Dato mancante = non nascosta. */
export function barraCarrello(p?: { righe?: unknown; nascondiConBottone?: unknown } | null): { visibile: boolean; inert: boolean; href: string } {
  const conRighe = typeof p?.righe === "number" && Number.isInteger(p.righe) && p.righe > 0;
  const visibile = conRighe && p?.nascondiConBottone !== true;
  return { visibile, inert: !visibile, href: PERCORSO_CASSA };
}

/* ── il carrello vuoto (V1-K5) ──────────────────────────────────────────── */

export interface IngressoVuoto {
  id: "patch" | "cura";
  testo: string;
  href: string;
  /** Uno solo è `pieno`: gli altri `contorno`. */
  aspetto: "pieno" | "contorno";
}

/** Dove portano i due ingressi. «Patch pronte» è la prima categoria del documento (§3.4).
 *  shortcut: «Cura e manutenzione» non ha una categoria sua nel documento (§3.4 ne ha sei); porta alla prima di cura, «shampoo-e-balsami».
 *  Si cambia qui (e nel bottone della home, T91) quando il titolare dice dove deve andare. */
export const HREF_PATCH_PRONTE = "/shop/c/patch-pronte";
export const HREF_CURA = "/shop/c/shampoo-e-balsami";

/** Due ingressi (pieno + contorno) e il link alla consulenza, che apre il flusso che esiste (non è un indirizzo). SOLO nel carrello vuoto:
 *  con righe nessun invito alla consulenza. Ogni chiamata dà oggetti nuovi. */
export function ingressiCarrelloVuoto(): { titolo: string; testo: string; ingressi: IngressoVuoto[]; consulenza: { testo: string; azione: "consulenza" } } {
  const t = TESTI_SHOP.carrello;
  return {
    titolo: t.vuotoTitolo,
    testo: t.vuotoTesto,
    ingressi: [
      { id: "patch", testo: t.vuotoBottone1, href: HREF_PATCH_PRONTE, aspetto: "pieno" },
      { id: "cura", testo: t.vuotoBottone2, href: HREF_CURA, aspetto: "contorno" },
    ],
    consulenza: { testo: t.vuotoLink, azione: "consulenza" },
  };
}
