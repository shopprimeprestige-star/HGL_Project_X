/** ── LE REGISTRAZIONI GRANDI VANNO SU GOOGLE DRIVE ─────────────────────────
 *
 *  Richiesta del committente (13/10/2026): «fa micro registrazioni da un
 *  minuto: fai che registra tutto in un'unica soluzione, al massimo salva su
 *  Google Drive se non riesce a salvare su Supabase» — e poi «usa Google
 *  Drive» al posto del piano a pagamento di Supabase.
 *
 *  ⚠️ PERCHÉ SI SPEZZAVA. Il piano gratuito di Supabase accetta file fino a
 *   50 MB: il registratore chiudeva una parte a 40 MB per non perdere niente
 *   (shop/ritmo-registrazione). Misurato il 13/10: una consulenza di 41 minuti
 *   in 16 parti da circa due minuti e mezzo.
 *
 *  Adesso, con Google Drive collegato (Impostazioni → Meetly), la consulenza è
 *  UN file: si registra intera e a fine consulenza va dove ci sta — su
 *  Supabase se sta sotto il suo tetto, altrimenti su Drive, caricata dal
 *  browser a blocchi direttamente su Google (il sito non la vede passare: il
 *  server consegna solo il permesso di caricare quel file).
 *
 *  Qui ci sono le regole, provate senza browser né rete.
 *  ───────────────────────────────────────────────────────────────────────── */
import { SOGLIA_MASSIMA, sogliaParte } from "./ritmo-registrazione";

const MB = 1024 * 1024;
/** Il tetto per file del piano gratuito di Supabase, quando il secchio non ne
 *  dichiara uno suo (lo si legge come 0). */
export const TETTO_GRATUITO = 50 * MB;
/** Un blocco del caricamento su Drive: Google vuole multipli di 256 KB. */
export const BLOCCO_DRIVE = 16 * MB;

/** Quanto può pesare una parte prima di chiuderla e aprirne un'altra. Con
 *  Drive collegato la consulenza è un file solo (fino al massimo che si tiene
 *  in memoria); senza, vale il tetto dell'archivio come prima. */
export function sogliaDellaParte(p: { tetto: number; drive: boolean }): number {
  return p.drive ? SOGLIA_MASSIMA : sogliaParte(p.tetto);
}

/** Dove va un file a fine registrazione. */
export function doveVa(p: { peso: number; tetto: number; drive: boolean }): "supabase" | "drive" {
  const tetto = Number(p.tetto) > 0 ? Number(p.tetto) : TETTO_GRATUITO;
  //  Un margine del 5%: un file che sfiora il tetto lo supera per poco a
  //  caricamento finito, ed è il rifiuto più costoso che ci sia.
  if (Number(p.peso) <= tetto * 0.95) return "supabase";
  return p.drive ? "drive" : "supabase";
}

/** I blocchi in cui si carica un file su Drive: [da, a] compresi. */
export function blocchiDrive(peso: number, blocco = BLOCCO_DRIVE): Array<[number, number]> {
  const tot = Math.max(0, Math.floor(Number(peso) || 0));
  const passo = Math.max(256 * 1024, Math.floor(blocco / (256 * 1024)) * 256 * 1024);
  const out: Array<[number, number]> = [];
  for (let da = 0; da < tot; da += passo) out.push([da, Math.min(tot, da + passo) - 1]);
  return out;
}

/** L'intestazione che dice a Google quale pezzo sta arrivando. */
export const intervallo = (da: number, a: number, tot: number): string => `bytes ${da}-${a}/${tot}`;

/** Il link con cui la registrazione compare in archivio. */
export const linkDrive = (id: string): string => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;

/** L'id del file, se il link è di Drive ("" altrimenti). */
export function idDrive(url: string | null | undefined): string {
  const m = /^https:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/.exec(String(url || ""));
  return m ? decodeURIComponent(m[1]) : "";
}

/** L'indirizzo da mettere in una cornice per guardarla dentro il pannello. */
export const anteprimaDrive = (id: string): string =>
  `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
