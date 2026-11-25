/*  ── LA FIRMA DEL WEBHOOK DI STRIPE (R2 · T44 · D45) ────────────────────────────────────────────────
    `Stripe-Signature: t=<secondi>,v1=<HMAC-SHA256 di "t.corpo">[,v1=…]`.
    · si firmano i BYTE del corpo (`arrayBuffer()`): `text()` toglierebbe un BOM e la firma non tornerebbe;
    · il confronto lo fa `crypto.subtle.verify("HMAC", …)` (tempo costante): nessun ciclo a mano, nessun confronto fra testi;
    · `t` solo cifre; età massima 300 s, nel passato E nel futuro (`vecchia`/`futura`); uno o più `v1`, basta uno giusto (rotazione del segreto);
    · prima conta la firma, poi l'età: `vecchia` vuol dire «autentica ma vecchia», `sbagliata` vuol dire «non l'ha firmata Stripe»;
    · non lancia mai e non legge l'ambiente: il segreto arriva come argomento, letto da chi chiama al momento della richiesta.
    `adesso` è in MILLISECONDI (`Date.now()`), come il resto del negozio. */

export type EsitoFirma = "ok" | "assente" | "malformata" | "vecchia" | "futura" | "sbagliata";

/** Quanti `v1` si provano al massimo: Stripe ne manda uno o due; un'intestazione con migliaia di voci non deve costare migliaia di HMAC. */
const MAX_V1 = 5;
const codifica = new TextEncoder();

/** `hex` (64 segni) → byte, `null` se non è esadecimale. */
function daEsadecimale(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex) || hex.length > 128) return null;
  const byte = new Uint8Array(hex.length / 2);
  for (let i = 0; i < byte.length; i++) byte[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return byte;
}

export async function verificaFirma(
  corpoGrezzo: Uint8Array,
  intestazione: unknown,
  segreto: string,
  adesso: number,
  tolleranzaS = 300,
): Promise<EsitoFirma> {
  try {
    if (typeof intestazione !== "string" || intestazione.trim() === "") return "assente";

    let t: string | null = null;
    const firme: Uint8Array<ArrayBuffer>[] = [];
    let voci = 0;
    for (const voce of intestazione.split(",")) {
      if (++voci > 10_000) break; // un'intestazione smisurata non si legge tutta
      const i = voce.indexOf("=");
      if (i < 0) continue;
      const nome = voce.slice(0, i).trim();
      const valore = voce.slice(i + 1).trim();
      if (nome === "t") {
        if (t !== null) return "malformata"; // due `t`: non si sceglie
        t = valore;
      } else if (nome === "v1" && firme.length < MAX_V1) {
        const byte = daEsadecimale(valore);
        if (byte) firme.push(byte);
      }
    }
    if (t === null || !/^\d{1,12}$/.test(t) || firme.length === 0) return "malformata";

    if (typeof segreto !== "string" || segreto === "") return "sbagliata";
    const chiave = await crypto.subtle.importKey("raw", codifica.encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const prefisso = codifica.encode(`${t}.`);
    const messaggio = new Uint8Array(prefisso.length + corpoGrezzo.length);
    messaggio.set(prefisso, 0);
    messaggio.set(corpoGrezzo, prefisso.length);
    let giusta = false;
    for (const firma of firme) {
      if (await crypto.subtle.verify("HMAC", chiave, firma, messaggio)) giusta = true; // si provano tutte: stessa durata
    }
    if (!giusta) return "sbagliata";

    // l'età, in secondi; `!(… <= …)` perché con `adesso` non numerico il confronto deve fallire, non passare
    const differenza = Number(t) - adesso / 1000;
    if (!(Math.abs(differenza) <= tolleranzaS)) return differenza < 0 ? "vecchia" : differenza > 0 ? "futura" : "sbagliata";
    return "ok";
  } catch {
    return "sbagliata"; // mai un'eccezione, mai «ok» per sbaglio
  }
}
