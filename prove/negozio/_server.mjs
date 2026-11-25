/** ── AIUTI PER LE PROVE DEI SERVER DEL CMS (T09) ───────────────────────────
 *  Guardia finta, richieste finte, porte. Il nome inizia per «_»: `negozio.mjs` non lo chiama come prova.
 *  ⚠️ Dati sempre inventati. */
export const guardiaOk = (nome = "Titolare Prova") => async () => ({ ok: true, nome });
export const guardiaNo = (stato) => async () => ({
  ok: false,
  risposta: new Response(JSON.stringify({ ok: false }), { status: stato, headers: { "Content-Type": "application/json" } }),
});
export const ADESSO = "2026-11-20T12:00:00.000Z";
/** Le porte base: `log` raccoglie i codici, `d` si passa al modulo (con `extra` si aggiunge o si cambia qualcosa). */
export function porte({ db, guardia = guardiaOk(), ...extra } = {}) {
  const log = [];
  return { log, d: { guardia, db, adesso: () => new Date(ADESSO), log: (c) => log.push(c), ...extra } };
}
export const post = (corpo) =>
  new Request("https://sito.test/api/crm/negozio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
export const get = (q) => new Request(`https://sito.test/api/crm/negozio?${q}`);
/** `{stato, corpo}` di una risposta. */
export const leggi = async (r) => ({ stato: r.status, corpo: await r.json() });
/** Le chiamate che scrivono in modo diretto (tutto tranne `select` e `rpc`). */
export const scrittureDirette = (db, tabelle) =>
  db.registro.filter((q) => q.tab && (!tabelle || tabelle.includes(q.tab)) && q.op !== "select").map((q) => `${q.tab}.${q.op}`);
