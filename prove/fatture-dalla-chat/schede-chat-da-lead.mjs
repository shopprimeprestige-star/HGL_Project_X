/** ── FATTURE DALLA CHAT · T8 · schedeChat DA leads (PIANO §0bis.2) ─────────
 *  `schedaChatDaLead`/`schedeChatDaLeads` non sono ancora nell'elenco `MODULI`
 *  di prove/prove.mjs (riservato a T0): si impacchetta qui con esbuild, stesso
 *  schema già usato da `candidati.mjs` (T1) per `candidati.ts`. Si verifica
 *  CONTRO LA FORMULA SCRITTA NEL PIANO, non contro quello che il codice fa:
 *  `importoScheda` = l'acconto se > 0, altrimenti il prezzo finale SOLO se la
 *  scheda è «pagata per intero» (`haPagamentoSenzaFattura`, import non
 *  reinventato), altrimenti null. */
import { createRequire } from "node:module";
import { join } from "node:path";

async function impacchetta(radice, percorso) {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const testo = esbuild.buildSync({
    entryPoints: [join(radice, percorso)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  }).outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(testo).toString("base64")}`);
}

const lead = (id, data) => ({
  id,
  user_id: "u1",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  data,
});

export async function prove(_mod, { c, gruppo, radice }) {
  const K = await impacchetta(radice, "src/crm/fatture/dalla-chat/schede-chat-da-lead.ts");

  gruppo("DALLA CHAT · T8 · schedaChatDaLead");

  c(
    "nome/cognome/CF/telefono come schedaDaLead (ultime 9 cifre)",
    { nome: "Mario", cognome: "Rossi", codiceFiscale: "RSSMRA80A01H501A", telefono: "331234567" },
    (() => {
      const s = K.schedaChatDaLead(
        lead("l1", {
          nome: "Mario",
          cognome: "Rossi",
          codiceFiscale: "RSSMRA80A01H501A",
          telefono: "+39 333 1234567",
        }),
      );
      return {
        nome: s.nome,
        cognome: s.cognome,
        codiceFiscale: s.codiceFiscale,
        telefono: s.telefono,
      };
    })(),
  );

  c(
    "acconto > 0 → importoScheda è l'acconto (anche se è già pagato per intero)",
    [150, 400],
    [
      K.schedaChatDaLead(lead("l2", { payment: { accontoPagato: 150 } })).importoScheda,
      K.schedaChatDaLead(
        lead("l3", { payment: { accontoPagato: 400, statoPagamento: "pagato_interamente" } }),
      ).importoScheda,
    ],
  );

  c(
    "acconto 0/assente ma pagato per intero → il prezzo finale di vendita",
    700,
    K.schedaChatDaLead(
      lead("l4", {
        payment: { statoPagamento: "pagato_interamente", prezzoFinaleVendita: 700 },
      }),
    ).importoScheda,
  );

  c(
    "pagato per intero ma senza nessun prezzo registrato → null (non zero, non inventato)",
    null,
    K.schedaChatDaLead(
      lead("l5", { payment: { statoPagamento: "pagato_interamente", prezzoFinaleVendita: 0 } }),
    ).importoScheda,
  );

  c(
    "nessun pagamento → importoScheda null",
    [null, null],
    [
      K.schedaChatDaLead(lead("l6", {})).importoScheda,
      K.schedaChatDaLead(lead("l7", { payment: { statoPagamento: "nessun_pagamento" } }))
        .importoScheda,
    ],
  );

  gruppo("DALLA CHAT · T8 · schedeChatDaLeads");
  c(
    "una mappa idRiga→SchedaChat, una voce per lead con id",
    ["l1", "l2"],
    Object.keys(
      K.schedeChatDaLeads([lead("l1", { nome: "Mario" }), lead("l2", { nome: "Anna" })]),
    ).sort(),
  );
  c(
    "un lead senza id non entra nella mappa (difesa, non dovrebbe succedere)",
    0,
    Object.keys(K.schedeChatDaLeads([{ data: { nome: "Senza id" } }])).length,
  );
}
