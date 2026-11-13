/** ── PROVE: «HA UN MESSAGGIO DEL PONTE?» (commessa 2026-11-13-chat-baileys, T2) ──
 *  Funzione condivisa fra l'elenco «WhatsApp Baileys» e la terza opzione sul
 *  lead (scelta-whatsapp.ts): un'unica regola, per non avere due risposte che
 *  si disallineano. Qui solo i casi dei valori del campo, puri. */

export function proveIdeePonteChat(mod, { c, gruppo }) {
  gruppo("PONTE CHAT: «HA UN MESSAGGIO DEL PONTE?»");
  const P = mod["chatwa/ponteChat"];

  c("true: ha un messaggio del ponte", true, P.haMessaggioPonte({ ha_messaggio_ponte: true }));
  c("false: non ne ha", false, P.haMessaggioPonte({ ha_messaggio_ponte: false }));
  c("null: non ne ha", false, P.haMessaggioPonte({ ha_messaggio_ponte: null }));
  c("assente (campo mancante): non ne ha", false, P.haMessaggioPonte({}));
  c("contatto null: non ne ha", false, P.haMessaggioPonte(null));
  c("contatto undefined: non ne ha", false, P.haMessaggioPonte(undefined));
}
