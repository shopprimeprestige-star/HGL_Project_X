/** ── I DATI DEL BONIFICO PER IL MESSAGGIO «IBAN PER L'ACCONTO» ──────────────
 *
 *  Richiesta del titolare (31/10/2026): in Attesa acconto, un messaggio da
 *  cliccare nella chat con importo dell'acconto, causale, IBAN e intestatario
 *  presi in dinamico. Qui le regole PURE (niente React né rete): da una risposta
 *  di `/api/public/quote` escono l'acconto e la causale; il giro in rete lo fa
 *  `useDatiAcconto`. Prove: prove/idee/messaggio-iban.mjs.
 *
 *  ── L'ACCONTO ────────────────────────────────────────────────────────────
 *  È quello che il cliente ha visto sul SUO preventivo, calcolato come lo
 *  calcola la pagina (routes/preventivo.tsx): l'acconto della soluzione scelta
 *  (`accontoDi`, listino fotografato quando il preventivo è nato) e mai più del
 *  totale. Un preventivo nato prima della fotografia vale cento euro, come
 *  `listinoDiUnDocumentoVecchio` (shop/condizioni-preventivo).
 *  ⚠️ Importo non trovato (preventivo illeggibile, totale a zero, acconto a
 *   zero) = `null`, mai un numero di ripiego: il segnaposto resta e la casella
 *   lo segnala.
 *
 *  ── LA CAUSALE ───────────────────────────────────────────────────────────
 *  Con un preventivo è la STESSA che il cliente ha letto sulla pagina del
 *  preventivo («Conferma ordine - IDXXXXX», o il modello del listino / scritto
 *  a mano per quel documento): è quella che la fattura d'acconto riporta
 *  (FinestraFattura), e il bonifico si lega al documento solo se combaciano
 *  parola per parola. Una causale nuova con il nome avrebbe diviso in due il
 *  filo che lega versamento e fattura.
 *  Senza preventivo («Acconto Nome Cognome») resta un ripiego per riconoscere
 *  chi ha pagato; ma senza preventivo manca anche l'importo, quindi di fatto
 *  l'operatore completa a mano.
 *  ─────────────────────────────────────────────────────────────────────── */
import { causaleDi } from "@/shop/causale-bonifico";
import { formatPrice } from "@/shop/catalog";
import { leggiCondizioni, listinoDiUnDocumentoVecchio } from "@/shop/condizioni-preventivo";
import { accontoDi } from "@/shop/quote-menu";

export interface DatiAcconto {
  /** Euro da chiedere; `null` se non si è trovato (il segnaposto resta). */
  acconto: number | null;
  /** La causale del bonifico; vuota se non si è potuta costruire. */
  causale: string;
}

const testo = (v: unknown): string => String(v ?? "").trim();

/** Acconto e causale da una risposta di `/api/public/quote?ref=…`. `null` se la
 *  risposta non è un preventivo leggibile. La risposta arriva dalla rete: si legge
 *  campo per campo, senza fidarsi di nessuno. */
export function accontoDaPreventivo(risposta: unknown): DatiAcconto | null {
  const j = risposta as {
    ok?: unknown;
    quote?: {
      quote_ref?: unknown;
      nome?: unknown;
      cognome?: unknown;
      total?: unknown;
      base_system?: { id?: unknown } | null;
    } | null;
    condizioni?: unknown;
    causale?: unknown;
  } | null;
  const q = j?.quote;
  if (!j || j.ok !== true || !q || typeof q !== "object") return null;

  const cond = leggiCondizioni(typeof j.condizioni === "string" ? j.condizioni : null);
  const totale = Number(q.total);
  const baseId = testo(q.base_system?.id);
  const suo = accontoDi(cond ? cond.listino : listinoDiUnDocumentoVecchio({}), baseId || undefined);
  const acconto =
    Number.isFinite(totale) && totale > 0 && Number.isFinite(suo) && suo > 0
      ? Math.min(suo, totale)
      : null;

  const numero = testo(q.quote_ref);
  const causale = numero
    ? causaleDi({
        //  Il modello scritto a mano per quel preventivo vince su quello del listino di allora.
        modello: testo(j.causale) || testo(cond?.listino?.causale),
        numero,
        nome: [testo(q.nome), testo(q.cognome)].filter(Boolean).join(" "),
        totale: Number.isFinite(totale) ? formatPrice(totale) : "",
      })
    : "";
  return { acconto, causale };
}

/** La causale di ripiego senza preventivo: «Acconto Mario Rossi». Vuota senza nome. */
export function causaleSenzaPreventivo(nome?: string | null, cognome?: string | null): string {
  const chi = [testo(nome), testo(cognome)].filter(Boolean).join(" ");
  return chi ? `Acconto ${chi}` : "";
}
