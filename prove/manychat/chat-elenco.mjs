/** ── PROVE: CHAT WHATSAPP · LA RICERCA DELL'ELENCO ───────────────────────────────────────────
 *
 *  Commessa 2026-10-28, PIANO.md T8 (correzione del revisore). `chatwa/cercaChat.ts`: il riquadro
 *  «Da rispondere» obbedisce alla ricerca ma NON alla pastiglia. Dati inventati. */

export async function proveChatElenco(mod, { c, gruppo }) {
  const { combaciaRicerca } = mod["chatwa/cercaChat"];
  const scheda = (nome, cognome) => ({ data: { nome, cognome } });
  const conScheda = { phone: "+39000111222", lead: scheda("Maria", "Rossi"), contact: { display_name: null } };
  const senzaScheda = { phone: "+39000333444", lead: null, contact: { display_name: "Marco da ManyChat" } };

  gruppo("CHAT ELENCO · LA RICERCA (T8)");
  c("ricerca vuota o di soli spazi: combacia tutto", [true, true, true], [
    combaciaRicerca(conScheda, ""), combaciaRicerca(senzaScheda, "   "), combaciaRicerca({ phone: "+39" }, ""),
  ]);
  c("nome della scheda, senza badare alle maiuscole", [true, true], [
    combaciaRicerca(conScheda, "MAR"), combaciaRicerca(conScheda, "maria rossi"),
  ]);
  c("numero", [true, false], [combaciaRicerca(conScheda, "0001112"), combaciaRicerca(conScheda, "999")]);
  c("numero senza scheda: si trova per nome salvato (display_name)", [true, false], [
    combaciaRicerca(senzaScheda, "marco"), combaciaRicerca(senzaScheda, "luigi"),
  ]);
  c("spazi ai bordi della ricerca non contano", true, combaciaRicerca(senzaScheda, "  marco "));
  c("lead e contatto assenti: non lancia, combacia solo col numero", [false, true], [
    combaciaRicerca({ phone: "+39777" }, "mar"), combaciaRicerca({ phone: "+39777" }, "777"),
  ]);
  c("scheda con nome o cognome vuoti: non lancia", false,
    combaciaRicerca({ phone: "+39", lead: { data: { nome: null, cognome: undefined } } }, "x"));

  // Lo scenario del revisore: pastiglia «Con lead» + ricerca «mar». Il riquadro filtra SOLO con la
  // ricerca, quindi il senza scheda che aspetta (nome «Marco») resta; `visibili` lo toglierebbe.
  const inAttesa = [conScheda, senzaScheda];
  const pastigliaConLead = (x) => !!x.lead;
  c("riquadro con ricerca «mar» e pastiglia «Con lead»: il senza scheda resta", 2,
    inAttesa.filter((x) => combaciaRicerca(x, "mar")).length);
  c("(la pastiglia da sola lo toglierebbe: è il difetto corretto)", 1,
    inAttesa.filter((x) => combaciaRicerca(x, "mar") && pastigliaConLead(x)).length);
}
