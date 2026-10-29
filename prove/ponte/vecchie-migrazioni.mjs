/** ── PROVE: LE DUE LETTURE UNA TANTUM (M2/M3) CHIUSE AL PONTE ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T2.
 *  Creato VUOTO dal compito T0: lo riempie solo il suo compito, e non serve
 *  toccare `prove/prove.mjs` o `prove/ponte.mjs` (il collegamento c'è già).
 *  I contratti stanno in `src/crm/ponte/tipi.ts` (`mod["ponte/tipi"]`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Impronta (sha-256) delle due migrazioni com'erano prima del ponte (commit T0
 *  1b01db3). Tolte le righe aggiunte da T2, il resto deve tornare identico:
 *  cosi' si prova «nient'altro» senza dipendere dalla storia di git. */
const ORIGINALI = {
  "20261023120100_manychat_giro.sql": "9d6dd3330eaf3556d1267c59a416569648b9332095adcdade025983ff23e37dc",
  "20261023120200_manychat_cron.sql": "04f0622017ba3c6fcd12bc862c83016e87c049e93f15bdd73bb41aa6fa09a95d",
};
const FILTRO = "       AND w.canale IS DISTINCT FROM 'baileys'";
const COMMENTO = [
  "-- Esclude i messaggi del ponte WhatsApp (canale 'baileys'): sono storico, non",
  "-- risposte a un invio, e rilanciando questo blocco non devono sbloccare il freno.",
];

export async function provePonteVecchieMigrazioni(_mod, { c, gruppo, radice }) {
  gruppo("PONTE · LE DUE LETTURE UNA TANTUM (M2, M3) ESCLUDONO IL CANALE «baileys»");
  for (const [nome, impronta] of Object.entries(ORIGINALI)) {
    const p = join(radice, "supabase/migrations", nome);
    c(`${nome}: esiste`, true, existsSync(p));
    if (!existsSync(p)) continue;
    const righe = readFileSync(p, "utf8").split("\n");
    // l'UPDATE di riempimento: dalla riga «UPDATE public.manychat_invii i» al «;»
    const da = righe.findIndex((r) => r.startsWith("UPDATE public.manychat_invii i"));
    const a = righe.findIndex((r, k) => k > da && r.trimEnd().endsWith(";"));
    const blocco = righe.slice(da, a + 1);
    c(`${nome}: l'UPDATE c'è`, true, da >= 0 && a > da);
    c(
      `${nome}: la JOIN con whatsapp_messages ha il filtro, una volta sola`,
      1,
      blocco.filter((r) => r === FILTRO).length,
    );
    // il filtro sta dentro la JOIN, prima di «WHERE», accanto al «direction = 'inbound'»
    const iFiltro = blocco.indexOf(FILTRO);
    c(
      `${nome}: il filtro viene dopo direction = 'inbound' e prima del WHERE`,
      true,
      blocco[iFiltro - 1]?.trim() === "AND w.direction = 'inbound'" && !blocco.slice(0, iFiltro).some((r) => /^\s*WHERE\b/.test(r)),
    );
    c(
      `${nome}: sopra l'UPDATE c'è la riga di commento che dice perche'`,
      COMMENTO,
      righe.slice(da - COMMENTO.length, da),
    );
    // tolte le tre righe aggiunte, il file è quello di prima (stessa impronta)
    const tolto = righe
      .filter((r) => r !== FILTRO && !COMMENTO.includes(r))
      .join("\n");
    c(
      `${nome}: tolte le righe aggiunte, il resto è identico a prima`,
      impronta,
      createHash("sha256").update(tolto).digest("hex"),
    );
  }
}
