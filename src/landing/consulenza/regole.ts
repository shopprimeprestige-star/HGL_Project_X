/** ── LE REGOLE DELLA CONSULENZA A UN TOCCO (barra, pannello, box, pop-up) ──
 *  Funzioni pure, senza schermo e senza `window`: le prove le guardano una per
 *  una (`prove/prove.mjs`, «CONSULENZA A UN TOCCO»). I componenti non decidono
 *  niente da soli: chiedono qui.
 *
 *  ⚠️ Nel lead finiscono solo la voce scelta, il testo di «Altro» (tagliato) e
 *  la provenienza. Mai nome, telefono o testo libero negli eventi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { PROBLEMI, type IdProblema } from "@/landing/testi-sito";

export type Provenienza = "stock" | "consulenza";
export type PuntoIngresso = "barra" | "pannello" | "box" | "popup" | "home";

export interface SceltaConsulenza {
  problema: IdProblema | null;
  /** Solo se il problema è «altro»: due parole scritte dalla persona. */
  problemaAltro?: string;
  provenienza: Provenienza;
  punto: PuntoIngresso;
  /** Nome della protesi guardata, se c'è. */
  prodotto?: string;
}

/** Quanto può essere lungo un testo libero (o un nome di protesi) nel lead. */
export const MAX_TESTO_LIBERO = 120;
/** Il pop-up del mouse non parte nei primi secondi: un tremolio non è un'uscita. */
export const SECONDI_MINIMI_USCITA = 5;
/** Sul telefono, e per chi non esce col mouse, il pop-up aspetta questo tempo. */
export const SECONDI_POPUP = 40;

/** Pulisce il percorso: minuscolo, senza barra finale. «/» resta «/». */
function normalizza(pathname: string): string {
  const p = (pathname || "/").split(/[?#]/)[0].toLowerCase();
  return p.length > 1 ? p.replace(/\/+$/, "") : "/";
}

const eSotto = (p: string, radice: string) => p === radice || p.startsWith(`${radice}/`);

/** `/shop*` è stock, tutto il resto è consulenza (`/shopping` non è lo shop). */
export function provenienzaDaPercorso(pathname: string): Provenienza {
  return eSotto(normalizza(pathname), "/shop") ? "stock" : "consulenza";
}

/** Pagine dove conta solo pagare, o dove la barra non c'entra: mai. */
const SENZA_BARRA = [
  "/shop/carrello",
  "/shop/checkout",
  "/crm",
  "/meetly",
  "/videochiamata",
  "/preventivo",
  "/invito",
  "/consulente",
  "/presenta",
  "/presentatore",
  "/regia",
  "/webinar",
  "/slide",
  "/media",
  "/api",
];

/** La barra si vede se non è stata chiusa con la X e la pagina la ammette. */
export function barraVisibile(pathname: string, chiusaInSessione: boolean): boolean {
  if (chiusaInSessione) return false;
  const p = normalizza(pathname);
  return !SENZA_BARRA.some((r) => eSotto(p, r));
}

export interface StatoPopup {
  /** L'interruttore di `testi-sito.ts` (o `?prova_popup=1`, solo per le prove). */
  attivo: boolean;
  pathname: string;
  giaMostrato: boolean;
  pannelloAperto: boolean;
  moduloAperto: boolean;
  motivo: "uscita" | "40s";
  /** Secondi passati sulla scheda. */
  secondi: number;
  telefono: boolean;
}

/** Il pop-up «Cosa non ti convince?»: spento di base, una volta, solo sulle schede. */
export function popupPuoPartire(s: StatoPopup): boolean {
  if (!s.attivo || s.giaMostrato || s.pannelloAperto || s.moduloAperto) return false;
  const p = normalizza(s.pathname);
  if (!p.startsWith("/shop/prodotto/")) return false;
  if (s.motivo === "40s") return s.secondi >= SECONDI_POPUP;
  //  Uscita col mouse: non esiste sul telefono, e mai al primo caricamento.
  return !s.telefono && s.secondi >= SECONDI_MINIMI_USCITA;
}

/** Dallo shop il problema è obbligatorio; sulla consulenza no (modulo corto). */
export function problemaObbligatorio(p: Provenienza): boolean {
  return p === "stock";
}

/** Una riga sola, senza invii né spazi doppi, al massimo `MAX_TESTO_LIBERO`. */
export function pulisciTesto(t: unknown): string {
  if (typeof t !== "string") return "";
  //  I caratteri di controllo (invio, tabulazione, nulli) diventano spazi.
  const senzaControlli = Array.from(t, (ch) => {
    const codice = ch.charCodeAt(0);
    return codice < 32 || codice === 127 ? " " : ch;
  }).join("");
  return senzaControlli.replace(/\s+/g, " ").trim().slice(0, MAX_TESTO_LIBERO).trim();
}

/** Cosa si aggiunge al lead. Giro 1: tutto nell'elenco dei problemi (`pain_points`). */
export function campiLead(s: SceltaConsulenza | null): { painPoints: string[] } {
  if (!s) return { painPoints: [] };
  const righe: string[] = [];
  const voce = PROBLEMI.find((p) => p.id === s.problema);
  if (voce) {
    righe.push(`Problema: ${voce.etichetta}`);
    const altro = voce.id === "altro" ? pulisciTesto(s.problemaAltro) : "";
    if (altro) righe.push(`Problema (altro): ${altro}`);
  }
  if (s.provenienza === "stock" || s.provenienza === "consulenza")
    righe.push(`Provenienza: ${s.provenienza}`);
  if (["barra", "pannello", "box", "popup", "home"].includes(s.punto))
    righe.push(`Ingresso: ${s.punto}`);
  const protesi = pulisciTesto(s.prodotto);
  if (protesi) righe.push(`Protesi: ${protesi}`);
  return { painPoints: righe };
}
