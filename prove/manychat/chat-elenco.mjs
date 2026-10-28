/** ── PROVE: CHAT WHATSAPP · LA RICERCA DELL'ELENCO ───────────────────────────────────────────
 *
 *  Commessa 2026-10-28, PIANO.md T8 (correzione del revisore). `chatwa/cercaChat.ts`: il riquadro
 *  «Da rispondere» obbedisce alla ricerca ma NON alla pastiglia. Dati inventati. */

import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  // ── LE PILLOLE FILTRANO ANCHE I RIQUADRI (guasto del 28/10: «Non letti», «Con lead», «Sconosciuti»
  //  non cambiavano l'elenco, perché «Da rispondere», «Da chiamare» e le «vecchie» le ignoravano
  //  e quasi tutte le chat stanno lì sopra). Numeri 333000xxx finti.
  const { passaFiltro } = mod["chatwa/cercaChat"];
  const letta = { phone: "+39333000001", lead: scheda("Anna", "Bianchi"), unread: 0 };
  const nonLetta = { phone: "+39333000002", lead: null, unread: 2 };
  const nonLettaConLead = { phone: "+39333000003", lead: scheda("Luca", "Verdi"), unread: 1 };
  const tutte = [letta, nonLetta, nonLettaConLead];
  const con = (f) => tutte.filter((x) => passaFiltro(x, f)).map((x) => x.phone.slice(-1));
  gruppo("CHAT ELENCO · LE PILLOLE FILTRANO (guasto del 28/10)");
  c("«Tutte»: nessuna esce", ["1", "2", "3"], con("all"));
  c("«Non letti»: solo con messaggi non letti", ["2", "3"], con("unread"));
  c("«Con lead»: solo con la scheda", ["1", "3"], con("with-lead"));
  c("«Sconosciuti»: solo senza scheda", ["2"], con("unknown"));

  const radice = process.cwd();
  const elenco = readFileSync(join(radice, "src/crm/chatwa/ElencoChat.tsx"), "utf8");
  const sorgenteUsaFiltro = (nome) => new RegExp(`const ${nome} = perPastiglia\\(`).test(elenco);
  c("ElencoChat: «Da rispondere» obbedisce alla pastiglia", true, sorgenteUsaFiltro("inAttesaTutti"));
  c("ElencoChat: «Da chiamare» obbedisce alla pastiglia", true, sorgenteUsaFiltro("daChiamare"));
  c("ElencoChat: le «vecchie» obbediscono alla pastiglia", true, sorgenteUsaFiltro("vecchie"));
}
