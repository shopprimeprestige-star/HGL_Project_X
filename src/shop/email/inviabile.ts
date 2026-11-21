/** ── EMAIL DELLO SHOP · QUANDO UN MESSAGGIO SI PUÒ MANDARE (R2 · T49 · D53) ───────────────────────────
 *  Modulo PURO. La regola, nell'ordine: acceso ⇒ testi non vuoti ⇒ nessun `{{` ⇒ approvato sull'impronta di OGGI
 *  ⇒ solo le variabili `{x}` della chiave. È la stessa regola del database (`{{` = segnaposto, mai variabile: l'elenco
 *  delle variabili sta SOLO qui, mai in due posti). Vale anche per «invia ora» (`manuale`): forzare non basta. */
import { VARIABILI_PER_CHIAVE, type EsitoInviabile, type MotivoNonInviabile, type NomeVariabile } from "./tipi";

/** Il sha-256 esadecimale di un testo. Scritto qui (sincrono) perché `crypto.subtle` è asincrono e la regola deve restare una funzione semplice.
 *  Provato contro `node:crypto` nelle prove. */
function sha256Hex(testo: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const dati = new TextEncoder().encode(testo);
  const lunghezza = Math.ceil((dati.length + 9) / 64) * 64;
  const m = new Uint8Array(lunghezza);
  m.set(dati);
  m[dati.length] = 0x80;
  const v = new DataView(m.buffer);
  v.setUint32(lunghezza - 8, Math.floor((dati.length * 8) / 0x100000000));
  v.setUint32(lunghezza - 4, (dati.length * 8) >>> 0);
  const w = new Array<number>(64);
  const ruota = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let blocco = 0; blocco < lunghezza; blocco += 64) {
    for (let i = 0; i < 16; i++) w[i] = v.getUint32(blocco + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = ruota(w[i - 15], 7) ^ ruota(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = ruota(w[i - 2], 17) ^ ruota(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (ruota(e, 6) ^ ruota(e, 11) ^ ruota(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((ruota(a, 2) ^ ruota(a, 13) ^ ruota(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/** L'impronta di un modello, uguale a quella del database: sha-256 esadecimale di «oggetto, a capo, testo». */
export function impronta(oggetto: string, testo: string): string {
  return sha256Hex(`${oggetto}\n${testo}`);
}

/** Tutto ciò che sta tra graffe singole nel testo, nell'ordine di comparsa e senza doppioni. Con `{{x}}` dà `x` (la doppia graffa la blocca `messaggioInviabile`). */
export function variabiliUsate(testo: string): string[] {
  return [...new Set([...testo.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]))];
}

/** Dopo aver tolto le variabili ammesse, nel testo non deve restare nemmeno una graffa. */
function haVariabiliSconosciute(testo: string, ammesse: readonly NomeVariabile[]): boolean {
  const resto = testo.replace(/\{([^{}]*)\}/g, (tutto, nome: string) => ((ammesse as readonly string[]).includes(nome) ? "" : tutto));
  return /[{}]/.test(resto);
}

/** Si può mandare questo messaggio? Mai un'eccezione: un modello malformato è semplicemente «non inviabile». */
export function messaggioInviabile(modello: unknown): EsitoInviabile {
  const no = (motivo: MotivoNonInviabile): EsitoInviabile => ({ ok: false, motivo });
  const m = (typeof modello === "object" && modello !== null ? modello : {}) as Record<string, unknown>;
  if (m.acceso !== true) return no("spento");
  const { oggetto, testo } = m;
  if (typeof oggetto !== "string" || typeof testo !== "string" || oggetto.trim() === "" || testo.trim() === "") return no("vuoto");
  if (oggetto.includes("{{") || testo.includes("{{")) return no("segnaposto");
  const chiave = typeof m.chiave === "string" && Object.hasOwn(VARIABILI_PER_CHIAVE, m.chiave) ? (m.chiave as keyof typeof VARIABILI_PER_CHIAVE) : null;
  if (!chiave) return no("non_approvato");
  if (typeof m.approvato_hash !== "string" || m.approvato_hash !== impronta(oggetto, testo)) return no("non_approvato");
  const ammesse = VARIABILI_PER_CHIAVE[chiave];
  if (haVariabiliSconosciute(oggetto, ammesse) || haVariabiliSconosciute(testo, ammesse)) return no("variabile_sconosciuta");
  return { ok: true };
}
