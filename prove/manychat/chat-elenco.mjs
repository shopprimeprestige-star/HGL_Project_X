/** ── PROVE: CHAT WHATSAPP · LA RICERCA DELL'ELENCO ───────────────────────────────────────────
 *
 *  Commessa 2026-10-28, PIANO.md T8 (correzione del revisore). `chatwa/cercaChat.ts`: il riquadro
 *  «Da rispondere» obbedisce alla ricerca; dal 28/10 (guasto delle pillole) anche alla pastiglia. Dati inventati. */

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
  c("numero scritto come si legge (con spazi) o solo in parte: si trovano le cifre", [true, true, false],
    [combaciaRicerca(conScheda, "+39 000 111"), combaciaRicerca(conScheda, "000-111-222"), combaciaRicerca(conScheda, "000 999")]);
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
  c("(la pastiglia «Con lead» da sola lo toglie: ora vale anche per il riquadro)", 1,
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

  // ── LE STELLE SALGONO IN CIMA (28/10): 3, 2, 1, poi le altre nell'ordine di prima.
  const { ordinaPerStelle } = mod["chatwa/cercaChat"];
  const stelle = { "+39333000011": 1, "+39333000013": 3, "+39333000014": 2 };
  const di = (p) => stelle[p] ?? 0;
  const ordine = [
    { phone: "+39333000010" }, { phone: "+39333000011" }, { phone: "+39333000012" },
    { phone: "+39333000013" }, { phone: "+39333000014" },
  ];
  gruppo("CHAT ELENCO · L'ORDINE PER STELLE");
  c("3 stelle, poi 2, poi 1, poi le altre nell'ordine di prima",
    ["3", "4", "1", "0", "2"], ordinaPerStelle(ordine, di).map((x) => x.phone.slice(-1)));
  c("senza stelle l'ordine non cambia (anche «Da rispondere»: il più vecchio resta sopra)",
    ["+39333000022", "+39333000021"],
    ordinaPerStelle([{ phone: "+39333000022" }, { phone: "+39333000021" }], () => 0).map((x) => x.phone));
  c("a parità di stelle resta l'ordine di prima", ["2", "1"],
    ordinaPerStelle([{ phone: "+39333000002" }, { phone: "+39333000001" }], () => 2).map((x) => x.phone.slice(-1)));
  const copia = ordine.map((x) => x.phone);
  ordinaPerStelle(ordine, di);
  c("non muta l'ingresso", copia, ordine.map((x) => x.phone));
  const elencoSrc = readFileSync(join(process.cwd(), "src/crm/chatwa/ElencoChat.tsx"), "utf8");
  c("ElencoChat: ogni riquadro passa da ordinaPerStelle", true,
    (elencoSrc.match(/perStelle\(/g) ?? []).length >= 3);

  const radice = process.cwd();
  const elenco = readFileSync(join(radice, "src/crm/chatwa/ElencoChat.tsx"), "utf8");
  //  30/10/2026: la «pastiglia» è l'insieme dei filtri a gruppi (`passa` = `passaFiltri`); ogni riquadro parte da `trovate`
  //   (filtri + ricerca) e passa da `fuoriScadenza`. Provato a fondo in prove/idee/filtri-chat.mjs.
  const sorgenteUsaFiltro = (nome) => new RegExp(`const ${nome} = perStelle\\(fuoriScadenza\\.filter`).test(elenco);
  c("ElencoChat: tutto parte da chat che passano filtri e ricerca", true, /const trovate = api\.chats\.filter\(\(c\) => passa\(c\) && combaciaRicerca\(c, ricerca\)\)/.test(elenco) && /const passa = \(c: ChatItem\) => passaFiltri\(c, filtri, stelleDi\)/.test(elenco));
  c("ElencoChat: «Da rispondere» obbedisce ai filtri", true, sorgenteUsaFiltro("inAttesa"));
  c("ElencoChat: le «vecchie» obbediscono ai filtri", true, sorgenteUsaFiltro("vecchie"));

  // ── IL NUMERO LEGGIBILE (28/10): +39 3xx xxx xxxx. Numeri finti 333000xxx.
  const { numeroLeggibile } = mod["chatwa/formati"];
  gruppo("CHAT ELENCO · IL NUMERO LEGGIBILE");
  c("cellulare italiano a 10 cifre: +39 3xx xxx xxxx", "+39 333 000 1234", numeroLeggibile("+393330001234"));
  c("cellulare italiano a 9 cifre: +39 3xx xxx xxx", "+39 333 000 123", numeroLeggibile("+39333000123"));
  c("scritto con spazi o senza +: stesso risultato", "+39 333 000 1234", numeroLeggibile("39 333-000-1234"));
  c("fisso italiano: +39 0x… a gruppi", "+39 06 1234 5678", numeroLeggibile("+390612345678"));
  c("estero: +prefisso e gruppi da 3", "+44 790 000 0000", numeroLeggibile("+447900000000"));
  c("vuoto o troppo corto: com'è, senza lanciare", ["", "+39", "12"], [numeroLeggibile(""), numeroLeggibile("+39"), numeroLeggibile("12")]);
  c("null e undefined non lanciano", ["", ""], [numeroLeggibile(null), numeroLeggibile(undefined)]);
  const convSrc = readFileSync(join(process.cwd(), "src/crm/chatwa/Conversazione.tsx"), "utf8");
  c("l'intestazione della chat mostra il numero leggibile sotto il nome", true, /numeroLeggibile\(attiva\.phone\)/.test(convSrc));
}
