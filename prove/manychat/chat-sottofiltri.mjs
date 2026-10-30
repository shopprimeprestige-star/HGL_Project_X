/** ── PROVE: CHAT WHATSAPP · «DA CHIAMARE» CON SOTTOFILTRI, CORNETTA, CAMBIO STATO DALLA RIGA ──
 *
 *  Commessa 2026-10-28-chat-da-chiamare. Modulo puro `chatwa/daChiamare` (insieme, ordine, conteggi)
 *  e prove di testo sul cablaggio. Dati inventati, numeri 333000xxx. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatSottofiltri(mod, { c, gruppo }) {
  const D = mod["chatwa/daChiamare"];
  //  29/10/2026: la pastiglia della finestra di 24 ore nelle righe di «Da chiamare».
  c("finestra aperta → verde «Si può scrivere»", [true, "Si può scrivere"],
    (() => { const x = D.pastigliaFinestra({ aperta: true, frase: "" }); return [x.aperta, x.testo]; })());
  c("finestra chiusa → rossa «Finestra chiusa»", [false, "Finestra chiusa"],
    (() => { const x = D.pastigliaFinestra({ aperta: false, frase: "" }); return [x.aperta, x.testo]; })());
  c("senza dati sulla finestra: nessuna pastiglia", null, D.pastigliaFinestra(undefined));
  const chat = (fine, stato, statoDal, extra = {}) => ({
    phone: `+39333000${fine}`,
    lead: stato ? { data: { stato, statoDal, ...extra } } : null,
  });
  const tel = (lista) => lista.map((x) => x.phone.slice(-3));

  const lista = [
    chat("001", "segreteria", "2026-10-20T10:00:00Z"),
    chat("002", "da_chiamare", "2026-10-25T10:00:00Z"),
    chat("003", "non_risponde", "2026-10-22T10:00:00Z"),
    chat("004", "da_chiamare", "2026-10-21T10:00:00Z"),
    chat("005", "attesa_whatsapp", "2026-10-01T10:00:00Z"), // aspetta la risposta: fuori
    chat("006", "richiamo", "2026-10-23T10:00:00Z"),
    chat("007", "ci_ricontatta_lui", "2026-10-19T10:00:00Z"),
    chat("008", null), // senza scheda: fuori
    chat("009", "appuntamento_fissato", "2026-10-10T10:00:00Z"), // fuori
    chat("010", "non_risponde", "2026-10-18T10:00:00Z"),
    chat("011", "non_risponde", undefined), // senza data: in fondo al suo stato
  ];

  gruppo("CHAT DA CHIAMARE · INSIEME, ORDINE, CONTEGGI");
  c("i cinque stati, nessun altro (né attesa_whatsapp, né chat senza scheda)", 8,
    D.chatDaChiamare(lista, "tutti").length);
  c("«Tutti»: un elenco solo, per stato (da_chiamare, non_risponde, segreteria, richiamo, ci_ricontatta_lui) e dentro ogni stato dal più vecchio",
    ["004", "002", "010", "003", "011", "001", "006", "007"], tel(D.chatDaChiamare(lista, "tutti")));
  c("un chip mostra solo il suo stato, dal più vecchio", ["010", "003", "011"],
    tel(D.chatDaChiamare(lista, "non_risponde")));
  c("chip senza chat: elenco vuoto", [], D.chatDaChiamare(lista, "ci_ricontatta_lui").slice(1));
  c("conteggi per chip e totale", { tutti: 8, da_chiamare: 2, non_risponde: 3, segreteria: 1, richiamo: 1, ci_ricontatta_lui: 1 },
    D.contaSottofiltri(lista));
  c("elenco vuoto: tutti a zero", 0, D.contaSottofiltri([]).tutti);
  const copia = lista.map((x) => x.phone);
  D.chatDaChiamare(lista, "tutti");
  c("non muta l'ingresso", copia, lista.map((x) => x.phone));
  c("data illeggibile = come senza data (in fondo)", ["001", "002"],
    tel(D.chatDaChiamare([chat("002", "segreteria", "boh"), chat("001", "segreteria", "2026-10-01T00:00:00Z")], "segreteria")));
  c("i sette stati del cambio rapido, nell'ordine d'uso",
    ["non_risponde", "segreteria", "richiamo", "ci_ricontatta_lui", "appuntamento_fissato", "annullato", "da_chiamare"],
    [...D.STATI_CAMBIO_RAPIDO]);

  // ── Gli stati offerti dalla riga: chi è già "da chiamare" li ha tutti e 7, anche se `statiPer`
  //  (lead del modulo, non importato) ne ammette solo alcuni.
  const SETTE = [...D.STATI_CAMBIO_RAPIDO];
  const pochi = new Set(["appuntamento_fissato", "ci_ricontatta_lui", "annullato"]);
  gruppo("CHAT DA CHIAMARE · GLI STATI DEL MENU DELLA RIGA");
  c("lead del modulo (statiPer ristretto) già in uno stato di chiamata: tutti e 7",
    SETTE, D.statiMenuRiga("da_chiamare", pochi));
  for (const st of ["non_risponde", "segreteria", "richiamo", "ci_ricontatta_lui", "attesa_whatsapp", "da_contattare"])
    c(`…anche se lo stato attuale è ${st}`, 7, D.statiMenuRiga(st, pochi).length);
  c("lead in altro stato (es. consulenza fissata): resta la regola statiPer", ["ci_ricontatta_lui", "appuntamento_fissato", "annullato"].sort(),
    D.statiMenuRiga("appuntamento_fissato", pochi).sort());
  c("importato: statiPer ammette tutto, restano i 7", 7, D.statiMenuRiga("richiamo", new Set(SETTE)).length);

  // ── Il cablaggio (prove di testo) ───────────────────────────────────────────────────────────
  const leggi = (f) => readFileSync(join(process.cwd(), "src/crm/chatwa", f), "utf8");
  const riga = leggi("RigaChat.tsx");
  const elenco = leggi("ElencoChat.tsx");
  const hook = leggi("useChatWa.ts");
  const tipi = leggi("tipi.ts");
  const cerca = leggi("cercaChat.ts");

  gruppo("CHAT DA CHIAMARE · CABLAGGIO");
  c("pillola «Da chiamare» fra le pillole, col numero", true,
    //  30/10/2026: la pillola è la 3ª cella della griglia 2×2 (VOCI_GRIGLIA, filtri.ts); il suo numero è a faccette.
    /"da-chiamare"/.test(tipi) && /VOCI_GRIGLIA/.test(elenco) && mod["chatwa/filtri"].VOCI_GRIGLIA[2].valore === "da-chiamare" && /contaSottofiltri\(/.test(elenco));
  c("la pillola filtra con lo stesso insieme del modulo puro", true, /statoChiamata\(c\) !== null/.test(cerca));
  c("una riga di chip dei sottofiltri solo con la pillola accesa, a zero nascosti", true,
    /filtri\.coda === "da-chiamare"/.test(elenco) && /conti\[x\.v\] > 0/.test(elenco) && /aria-pressed=\{sottoAttivo === x\.v\}/.test(elenco));
  c("un elenco solo ordinato per stato (chatDaChiamare), niente scheda per stato", true,
    /chatDaChiamare\(/.test(elenco) && !/titolo-da-chiamare/.test(elenco));
  c("cornetta: tel: del numero, accessibile «Chiama <nome>», fuori dal bottone della riga", true,
    /href=\{`tel:\$\{/.test(riga) && /aria-label=\{`Chiama \$\{nome\}`\}/.test(riga) && /numeroDaComporre\(/.test(riga));
  c("cornetta: non apre la chat (stopPropagation) e ha 44 px di tocco", true,
    /e\.stopPropagation\(\)/.test(riga.slice(riga.indexOf("tel:") - 400, riga.indexOf("tel:") + 400)) && /h-11 w-11/.test(riga));
  c("cornetta su ogni riga con scheda (non solo Da chiamare)", true, /c\.lead && telefono/.test(riga));
  c("cambio stato dalla riga: la finestra condivisa del CRM (FinestraStati), con i sette stati", true,
    /FinestraStati/.test(riga) && /statiMenuRiga\(/.test(riga));
  c("…e salva col meccanismo condiviso: onCambiaStato → cambiaStatoLead → updateLead (nessun supabase in riga)", true,
    /onCambiaStato\?\.\(c\.lead, s\)/.test(riga) && /onCambiaStato=\{/.test(elenco) && /cambiaStatoLead/.test(hook) &&
    /updateLead\(lead\.id, patchEsito\(lead\.data, newStatus\)\)/.test(hook) && !/supabase/.test(riga));
  c("cambia stato: finestre dei campi extra e chiusure vinte come nel resto del CRM", true,
    /intercettaChiusura\(lead, newStatus\)/.test(hook) && /apriStatoRapido\(lead, newStatus\)/.test(hook));
  c("toast con «Annulla» che rimette stato, statoDal e statoPrecedente (annulla: true)", true,
    /label: "Annulla"/.test(hook) && /\{ annulla: true \}/.test(hook) && /statoPrecedenteIl: lead\.data\.statoPrecedenteIl/.test(hook));
  c("l'intestazione della chat usa lo stesso salvataggio", true, /cambiaStato: \(s: LeadStatus\) => Promise<void>/.test(tipi) && /cambiaStatoLead: \(lead: Lead/.test(tipi));
  c("niente codice morto della vecchia fascia (modo «chiamare», «oltre 10 ore» in riga, api.daChiamare)", false,
    /"chiamare"/.test(riga) || /oltre 10 ore/.test(riga) || /daChiamare:\s*ChatItem\[\]/.test(tipi) || /\bdaChiamare,$/m.test(hook));
  c("pillole e chip a 44 px sul telefono (h-11), 28 px dal desktop", false, /"h-10 shrink-0/.test(elenco));
  //  30/10/2026: CAMBIA VOLUTAMENTE. Prima le pillole scorrevano di lato; ora (richiesta del titolare) la griglia 2×2 e i chip
  //   di «Stato della chiamata» vanno a capo: nessuno scorrimento orizzontale in tutto il blocco filtri.
  c("telefono: niente file che scorrono di lato, nessuno scorrimento orizzontale della pagina", true,
    !/overflow-x-auto/.test(elenco) && /flex flex-wrap/.test(elenco) && /grid grid-cols-2/.test(elenco) && /min-w-0/.test(riga));
}
