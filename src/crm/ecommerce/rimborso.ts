/** ── IL RIMBORSO ────────────────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, Rilascio 2 (T47; PIANO-R2 D55, SPEC 7.4 n. 5). Modulo PURO: niente React, niente database.
 *
 *  Quanto si può ancora rimborsare e se una richiesta è ammissibile. La stessa regola del SQL (`shop_rimborso_prenota`: pagato meno i
 *  rimborsi `richiesto` E `riuscito`, centesimi interi): qui serve a dire la frase giusta PRIMA; il database la fa rispettare sotto blocco,
 *  anche con due clic insieme. Soldi in centesimi, interi. */
import { statoPagamentoDi } from "./pagamento";
import { euro } from "./pagina";
import type { Ordine } from "./ordine";

/** Un rimborso dell'ordine come lo legge il server da `shop_rimborsi` (importo in centesimi). */
export interface RimborsoRiga {
  importoCent: number;
  stato: "richiesto" | "riuscito" | "fallito" | string;
}

/** Motivo: 5..500 caratteri (SPEC 7.4 n. 5). */
export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const eOggetto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const eCentesimi = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const euroDa = (cent: number): string => euro(cent / 100);

/** Quanto è stato pagato, in centesimi: `pagato_importo` (come il SQL; senza, 0). */
const pagatoCent = (o: Pick<Ordine, "pagatoImporto">): number =>
  o.pagatoImporto !== null && Number.isFinite(o.pagatoImporto)
    ? Math.round(o.pagatoImporto * 100)
    : 0;

/** L'elenco dei rimborsi è leggibile? Un array in cui OGNI voce ha uno stato noto e un importo intero > 0. Contesto mancante o sporco = non leggibile:
 *  chi decide cose sui soldi (massimo, riattivare un annullo) deve FALLIRE CHIUSO, mai trattarlo come «nessun rimborso». */
export function rimborsiLeggibili(rimborsi: unknown): rimborsi is RimborsoRiga[] {
  return (
    Array.isArray(rimborsi) &&
    rimborsi.every(
      (r) =>
        eOggetto(r) &&
        (r.stato === "richiesto" || r.stato === "riuscito" || r.stato === "fallito") &&
        eCentesimi(r.importoCent) &&
        r.importoCent > 0,
    )
  );
}

/** C'è un rimborso richiesto o riuscito? (blocca la riattivazione di un ordine annullato). `false` anche se l'elenco non si legge: controllare prima con `rimborsiLeggibili`. */
export const haRimborsoAttivo = (rimborsi: unknown): boolean =>
  rimborsiLeggibili(rimborsi) &&
  rimborsi.some((r) => r.stato === "richiesto" || r.stato === "riuscito");

/** Quanto resta da rimborsare: pagato − (rimborsi richiesti + riusciti), mai sotto zero. 0 se l'ordine non passa da Stripe o non è pagato,
 *  e 0 se l'elenco dei rimborsi non si legge (fallisce chiuso). Un rimborso `fallito` libera la cifra. */
export function massimoRimborsabileCent(o: Ordine, rimborsi: unknown): number {
  if (o.statoPagamento === null || !rimborsiLeggibili(rimborsi)) return 0;
  const s = statoPagamentoDi(o);
  if (s !== "pagato" && s !== "rimborsato_in_parte" && s !== "rimborsato") return 0;
  let impegnato = 0;
  for (const r of rimborsi)
    if (r.stato === "richiesto" || r.stato === "riuscito") impegnato += r.importoCent;
  return Math.max(0, pagatoCent(o) - impegnato);
}

export type EsitoRimborso =
  | { ok: true; importoCent: number; motivo: string; chiaveRichiesta: string }
  | { ok: false; errore: string };
const no = (errore: string): EsitoRimborso => ({ ok: false, errore });

/** Una richiesta di rimborso è ammissibile? `richiesta` = `{importoCent, motivo, chiaveRichiesta, conferma}` come arriva dalla pagina.
 *  Non lancia, non muta niente. Il primo difetto trovato dà la frase. */
export function controllaRimborso(richiesta: unknown, o: Ordine, rimborsi: unknown): EsitoRimborso {
  if (!eOggetto(richiesta)) return no("Richiesta non valida.");
  if (o.statoPagamento === null)
    return no("Questo ordine non ha un pagamento Stripe: un rimborso da qui non è possibile.");
  const s = statoPagamentoDi(o);
  if (s !== "pagato" && s !== "rimborsato_in_parte")
    return no(
      s === "rimborsato"
        ? "L'ordine è già rimborsato per intero: non c'è niente da rimborsare."
        : "L'ordine non risulta pagato: non c'è niente da rimborsare.",
    );
  if (!rimborsiLeggibili(rimborsi))
    return no(
      "Non riesco a leggere i rimborsi già fatti su questo ordine: ricarica la pagina e riprova.",
    );
  const massimo = massimoRimborsabileCent(o, rimborsi);
  if (massimo <= 0) return no("Non resta niente da rimborsare su questo ordine.");

  const importo = richiesta.importoCent;
  if (!eCentesimi(importo) || importo <= 0)
    return no(
      "L'importo del rimborso deve essere un numero intero di centesimi, maggiore di zero.",
    );
  if (importo > massimo)
    return no(
      `Puoi rimborsare al massimo ${euroDa(massimo)} (quanto è stato pagato, meno i rimborsi già richiesti o fatti).`,
    );

  const motivo = typeof richiesta.motivo === "string" ? richiesta.motivo.trim() : "";
  if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX)
    return no(`Scrivi il motivo del rimborso: da ${MOTIVO_MIN} a ${MOTIVO_MAX} caratteri.`);
  if (richiesta.conferma !== true) return no("Conferma il rimborso: non si può annullare.");
  const chiave = richiesta.chiaveRichiesta;
  if (typeof chiave !== "string" || !UUID.test(chiave))
    return no("Manca la chiave della richiesta di rimborso: ricarica la pagina e riprova.");
  return { ok: true, importoCent: importo, motivo, chiaveRichiesta: chiave };
}
