/** ── PROVE: CHAT WHATSAPP · LA CASELLA E I MODELLI ───────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), PIANO.md T10 (D16). Le regole
 *  dei modelli fuori finestra, senza schermo: quali stanno «in evidenza» (non
 *  chiedono dati), con che valori partono, e quando l'invio è permesso.
 *  Dati inventati: nessun numero, nessun nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo }`. */

export function proveChatCasella(mod, { c, gruppo }) {
  const M = mod["chatwa/modelli-casella"];
  const T = mod["wa-meta-templates"];
  const modello = (nome) => T.findMetaTemplate(nome);

  gruppo("CHAT · CASELLA · MODELLI IN EVIDENZA (D16)");
  c("hgl_primo_contatto non chiede dati", true, M.senzaDati(modello("hgl_primo_contatto")));
  c("hgl_richiamo_24h non chiede dati", true, M.senzaDati(modello("hgl_richiamo_24h")));
  c("hgl_ultimo_tentativo non chiede dati", true, M.senzaDati(modello("hgl_ultimo_tentativo")));
  c("lead + consulente soli: senza dati", true, M.senzaDati(modello("hgl_meet_da_fissare")));
  c("chiede la data/ora: con dati", false, M.senzaDati(modello("hgl_meet_oggi")));
  c("chiede l'indirizzo: con dati", false, M.senzaDati(modello("hgl_promemoria_sede")));
  {
    const tutti = [
      modello("hgl_meet_oggi"),
      modello("hgl_primo_contatto"),
      modello("hgl_promemoria_sede"),
      modello("hgl_ultimo_tentativo"),
      modello("hgl_richiamo_24h"),
    ];
    const { inEvidenza, altri } = M.dividiModelli(tutti);
    c(
      "in evidenza i senza dati, nell'ordine dato",
      ["hgl_primo_contatto", "hgl_ultimo_tentativo", "hgl_richiamo_24h"],
      inEvidenza.map((t) => t.name),
    );
    c(
      "gli altri sotto, nell'ordine dato",
      ["hgl_meet_oggi", "hgl_promemoria_sede"],
      altri.map((t) => t.name),
    );
    c("nessun modello perso", 5, inEvidenza.length + altri.length);
    c("lista vuota: niente", { inEvidenza: [], altri: [] }, M.dividiModelli([]));
  }

  gruppo("CHAT · CASELLA · VALORI DI PARTENZA (mai gli esempi di Meta)");
  c(
    "nome e consulente precompilati, gli altri vuoti",
    ["Giulia", "", "", "Luca"],
    M.valoriIniziali(modello("hgl_meet_domani"), { nomeLead: "Giulia", nomeConsulente: "Luca" }),
  );
  c(
    "senza nome: campo vuoto, non «Mario»",
    [""],
    M.valoriIniziali(modello("hgl_primo_contatto"), { nomeLead: "", nomeConsulente: "" }),
  );
  c(
    "spazi attorno al nome tolti",
    ["Giulia"],
    M.valoriIniziali(modello("hgl_primo_contatto"), { nomeLead: "  Giulia ", nomeConsulente: "" }),
  );
  c(
    "nessun valore di esempio finisce nei valori",
    false,
    M.valoriIniziali(modello("hgl_promemoria_meet"), { nomeLead: "", nomeConsulente: "" }).some(
      (v) => v !== "",
    ),
  );

  gruppo("CHAT · CASELLA · QUANDO L'INVIO È PERMESSO");
  {
    const t = modello("hgl_meet_oggi"); // lead_name, appointment_time, consultant_name
    c(
      "tutto pieno: ok, valori ripuliti",
      { ok: true, valori: ["Giulia", "18:00", "Luca"] },
      M.controllaModello(t, ["Giulia ", " 18:00", "Luca"], "manychat"),
    );
    const manca = M.controllaModello(t, ["Giulia", "", "Luca"], "manychat");
    c("un valore vuoto: no", false, manca.ok);
    c("dice quale manca", true, /Ora appuntamento/.test(manca.motivo ?? ""));
    c("solo spazi: vuoto", false, M.controllaModello(t, ["Giulia", "   ", "Luca"], "manychat").ok);
    c(
      "a capo nel valore: no (Meta lo rifiuta)",
      false,
      M.controllaModello(t, ["Giu\nlia", "18:00", "Luca"], "manychat").ok,
    );
    c(
      "tabulazione nel valore: no",
      false,
      M.controllaModello(t, ["Giulia", "18\t00", "Luca"], "manychat").ok,
    );
    c(
      "quattro spazi di fila: no",
      false,
      M.controllaModello(t, ["Giulia", "18:00", "Lu    ca"], "manychat").ok,
    );
    c(
      "tre spazi di fila: ok",
      true,
      M.controllaModello(t, ["Giulia", "18:00", "Lu   ca"], "manychat").ok,
    );
    c(
      "meno valori del modello: no (mai un undefined verso il server)",
      false,
      M.controllaModello(t, ["Giulia"], "manychat").ok,
    );
  }
  {
    // cinque variabili finte: ManyChat ne accetta 4
    const cinque = {
      ...modello("hgl_meet_oggi"),
      params: [1, 2, 3, 4, 5].map((i) => ({
        index: i,
        key: "lead_name",
        description: `Campo ${i}`,
        example: "x",
      })),
    };
    const v = ["a", "b", "c", "d", "e"];
    c("ManyChat: oltre 4 variabili, no", false, M.controllaModello(cinque, v, "manychat").ok);
    c("Cloud API: il limite di ManyChat non vale", true, M.controllaModello(cinque, v, "cloud").ok);
    c(
      "canale non letto: il limite di ManyChat non vale (decide il server)",
      true,
      M.controllaModello(cinque, v, null).ok,
    );
  }
}
