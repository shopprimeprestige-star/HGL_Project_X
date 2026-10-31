/** ── PROVE: CHAT WHATSAPP · UN FILTRO PER OGNI STATO DEL LEAD, E WHATSAPP NATIVO SEMPRE ──
 *
 *  Commessa 2026-10-30-filtri-stati-wa. Moduli puri `chatwa/perStato`, `chatwa/cercaChat`
 *  (`passaFiltro`) e `chatwa/apriWhatsapp` (`tastoWhatsappNativo`), più prove di testo sul
 *  cablaggio. Dati inventati, numeri 333000xxx: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatPerStato(mod, { c, gruppo, radice }) {
  const P = mod["chatwa/perStato"];
  const F = mod["chatwa/cercaChat"];
  const W = mod["chatwa/apriWhatsapp"];
  const T = mod["types"] ?? null;

  const chat = (fine, stato, extra = {}) => ({
    phone: `+39333000${fine}`,
    lead: stato ? { data: { stato, ...extra } } : null,
  });
  const tel = (lista) => lista.map((x) => x.phone.slice(-3));
  const lista = [
    chat("001", "da_spostare"),
    chat("002", "no_show"),
    chat("003", "non_fatto"), // stessa etichetta di no_show: un filtro solo
    chat("004", "in_attesa_acconto", { consulenteId: "c1" }),
    chat("005", "attesa_whatsapp"), // ha già la sua pastiglia
    chat("006", "da_chiamare"), // ha già la sua pastiglia
    chat("007", "non_risponde"),
    chat("008", null), // senza scheda
    chat("009", "stato_che_non_esiste"), // sporco: fuori
    chat("010", "da_spostare", { consulenteId: "c1" }),
    chat("011", "sta_valutando"),
  ];

  gruppo("CHAT PER STATO · QUALI STATI, IN QUALE ORDINE");
  c("niente stato duplicato: «Cliente assente» (no_show/non_fatto) è un filtro solo", 1,
    P.STATI_PER_STATO.filter((s) => ["no_show", "non_fatto"].includes(s)).length);
  c("Attesa WhatsApp e Da chiamare hanno già la loro pastiglia: non si ripetono", [false, false],
    [P.STATI_PER_STATO.includes("attesa_whatsapp"), P.STATI_PER_STATO.includes("da_chiamare")]);
  c("gli altri stati ci sono tutti (es. da riprogrammare, attesa acconto, in valutazione, appuntamento fissato)", [true, true, true, true],
    ["da_spostare", "in_attesa_acconto", "sta_valutando", "appuntamento_fissato"].map((s) => P.STATI_PER_STATO.includes(s)));
  const conti = P.contaPerStato(lista);
  c("solo gli stati che hanno almeno una chat, nell'ordine del CRM, con la loro etichetta",
    [["non_risponde", "Non risponde", 1], ["in_attesa_acconto", "Attesa acconto", 1], ["sta_valutando", "In valutazione", 1], ["non_fatto", "Cliente assente", 2], ["da_spostare", "Da riprogrammare", 2]]
      .sort((a, b) => P.STATI_PER_STATO.indexOf(a[0]) - P.STATI_PER_STATO.indexOf(b[0])),
    conti.voci.map((v) => [v.stato, v.etichetta, v.n]));
  c("il totale conta le chat con uno stato di questo gruppo (non attesa/da chiamare, non senza scheda)", 7, conti.tutti);
  c("elenco vuoto: nessuna voce, totale zero", [[], 0], (() => { const x = P.contaPerStato([]); return [x.voci, x.tutti]; })());

  gruppo("CHAT PER STATO · CHI ENTRA E CHI NO");
  const entra = (filtro, l = lista) => tel(l.filter((x) => F.passaFiltro(x, filtro)));
  c("«Da riprogrammare»: solo i suoi", ["001", "010"], entra("stato:da_spostare"));
  c("«Cliente assente» prende sia no_show sia non_fatto", ["002", "003"], entra("stato:non_fatto"));
  c("anche scritto col valore gemello (no_show) vale lo stesso filtro", ["002", "003"], entra("stato:no_show"));
  c("«Per stato» (tutti): ogni chat con uno stato del gruppo", ["001", "002", "003", "004", "007", "010", "011"], entra("per-stato"));
  c("uno stato senza chat: nessuna", [], entra("stato:segreteria"));
  c("uno stato inventato: nessuna (non lascia passare tutto)", [], entra("stato:boh"));
  c("senza scheda: mai", false, F.passaFiltro(chat("008", null), "stato:da_spostare"));
  c("le pastiglie di prima non cambiano", [true, true, true], [
    F.passaFiltro(chat("1", "attesa_whatsapp"), "attesa-whatsapp"),
    F.passaFiltro(chat("2", "da_chiamare"), "da-chiamare"),
    F.passaFiltro(chat("3", null), "unknown"),
  ]);
  c("Attesa WhatsApp e Da chiamare restano nelle loro pastiglie e non in «Per stato»", [false, false],
    [F.passaFiltro(chat("5", "attesa_whatsapp"), "per-stato"), F.passaFiltro(chat("6", "da_chiamare"), "per-stato")]);

  gruppo("CHAT PER STATO · COMBINATO COL CONSULENTE, CONTEGGI");
  const delConsulente = (x) => x.lead?.data?.consulenteId === "c1";
  const soloC1 = lista.filter(delConsulente);
  c("col consulente c1: «Da riprogrammare» ne ha una sola", ["010"], entra("stato:da_spostare", soloC1));
  c("…e i conti seguono il consulente", [["in_attesa_acconto", 1], ["da_spostare", 1]]
    .sort((a, b) => P.STATI_PER_STATO.indexOf(a[0]) - P.STATI_PER_STATO.indexOf(b[0])),
    P.contaPerStato(soloC1).voci.map((v) => [v.stato, v.n]));
  c("il totale col consulente", 2, P.contaPerStato(soloC1).tutti);
  c("un consulente senza chat: stato vuoto sincero (nessuna voce)", 0, P.contaPerStato(lista.filter((x) => x.lead?.data?.consulenteId === "zz")).voci.length);

  gruppo("CHAT PER STATO · RICONOSCERE IL FILTRO");
  c("riconosce «per-stato» e «stato:…», non gli altri", [true, true, false, false],
    ["per-stato", "stato:da_spostare", "all", "da-chiamare"].map((f) => P.eFiltroPerStato(f)));
  c("il filtro di uno stato è «stato:» + il valore canonico", ["stato:da_spostare", "stato:non_fatto"],
    [P.filtroDelloStato("da_spostare"), P.filtroDelloStato("no_show")]);

  const vuote = P.contaPerStato([chat("1", "da_spostare")]).voci;
  c("lo stato scelto che si svuota resta in fila, a zero, al suo posto", [["da_spostare", 1], ["sta_valutando", 0]],
    P.vociConScelto(vuote, "stato:sta_valutando").map((v) => [v.stato, v.n]).sort((a, b) => P.STATI_PER_STATO.indexOf(a[0]) - P.STATI_PER_STATO.indexOf(b[0])));
  c("…ma «per-stato», un altro filtro o uno stato inventato non aggiungono niente", [1, 1, 1], ["per-stato", "all", "stato:boh"].map((f) => P.vociConScelto(vuote, f).length));
  c("…e lo stato scelto che ha chat non si duplica", 1, P.vociConScelto(vuote, "stato:da_spostare").length);

  gruppo("WHATSAPP NATIVO · IL LINK C'È SEMPRE");
  const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36";
  const UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
  const num = "+39 333 000 0001";
  for (const [nome, ua] of [["iPhone", UA_IPHONE], ["Android", UA_ANDROID], ["computer", UA_MAC]]) {
    const chiusa = W.tastoWhatsappNativo(num, ua, { aperta: false });
    const aperta = W.tastoWhatsappNativo(num, ua, { aperta: true });
    const ignota = W.tastoWhatsappNativo(num, ua, undefined);
    c(`${nome}: finestra chiusa → link presente e in evidenza`, [true, true], [!!chiusa?.href, chiusa?.evidente]);
    c(`${nome}: finestra aperta → link presente, discreto`, [true, false], [!!aperta?.href, aperta?.evidente]);
    c(`${nome}: finestra non calcolata → link presente, discreto`, [true, false], [!!ignota?.href, ignota?.evidente]);
  }
  c("il link porta al numero giusto", true, W.tastoWhatsappNativo(num, UA_MAC, { aperta: false }).href.startsWith("https://wa.me/393330000001"));
  c("Android: intent con ripiego su wa.me", true, W.tastoWhatsappNativo(num, UA_ANDROID, { aperta: false }).href.startsWith("intent://send/?phone=393330000001"));
  c("il testo (promemoria) arriva nel link", true, W.tastoWhatsappNativo(num, UA_MAC, { aperta: false }, "Ciao Mario").href.endsWith("?text=Ciao%20Mario"));
  c("numero troppo corto o vuoto: nessun link (non si inventa)", [null, null, null],
    [W.tastoWhatsappNativo("123", UA_MAC, { aperta: false }), W.tastoWhatsappNativo("", UA_MAC, { aperta: false }), W.tastoWhatsappNativo(null, UA_MAC, { aperta: false })]);

  gruppo("CHAT PER STATO · CABLAGGIO NELLA PAGINA");
  const elenco = readFileSync(join(radice, "src/crm/chatwa/ElencoChat.tsx"), "utf8");
  //  30/10/2026 (filtri a gruppi): «Per stato» diventa la sezione ripiegata «Altri stati (N)» del gruppo «Fase del lead», dopo le
  //   due voci «Attesa WhatsApp» e «Per ora no»; i conti tengono conto di consulente e degli altri filtri accesi (a faccette).
  const pannello = readFileSync(join(radice, "src/crm/chatwa/PannelloFiltri.tsx"), "utf8");
  //  31/10/2026 (pannello più semplice): gli altri stati stanno in «Altri filtri», chiuso, in fondo al pannello.
  c("gli altri stati stanno in «Altri filtri», dopo il consulente", true,
    pannello.indexOf('id="filtri-altri"') > pannello.indexOf('titolo="Consulente"') && /voceDelloStato\(s\.stato\)/.test(pannello));
  c("l'elenco degli stati si calcola sulle chat del solo consulente (31/10/2026: filtri esclusivi) e usa gli stessi conti", true,
    /contaPerStato\(\s*api\.chats\.filter\(\(c\) =>\s*passaFiltri\(\s*c,\s*\{ \.\.\.FILTRI_VUOTI, consulente: filtri\.consulente \},\s*stelleDi,?\s*\),?\s*\),?\s*\)/.test(elenco) && /conta\("fase", `stato:\$\{v\.stato\}`\)/.test(elenco));
  c("lo stato scelto resta visibile anche se si svuota (il filtro non resta acceso senza vedersi)", true, /vociConScelto\(stati\.voci, filtri\.fase \?\? ""\)/.test(elenco));
  const conv = readFileSync(join(radice, "src/crm/chatwa/Conversazione.tsx"), "utf8");
  c("chat aperta: il tasto WhatsApp non dipende più dalla finestra chiusa", false, /attiva\.finestra\?\.aperta === false && linkWaChat/.test(conv));
  c("chat aperta: usa tastoWhatsappNativo", true, /tastoWhatsappNativo\(/.test(conv));
  const casella = readFileSync(join(radice, "src/crm/chatwa/Casella.tsx"), "utf8");
  c("casella bloccata (solo modelli): il tasto «Apri in WhatsApp» c'è", true, /linkWa/.test(casella) && /Apri in WhatsApp/.test(casella));
  const riga = readFileSync(join(radice, "src/crm/chatwa/RigaChat.tsx"), "utf8");
  c("la riga con la finestra chiusa ha già il suo bollino WhatsApp (invariato)", true, /linkApriWhatsapp\(/.test(riga));
}
