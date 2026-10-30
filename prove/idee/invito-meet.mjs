/** ── PROVE: L'INVITO AL MEET DALLA BARRA IN CIMA ALLE CHAT (31/10/2026) ───────
 *  Regole in src/crm/chatwa/invito-meet.ts; il tasto è in BarraProssimoMeet.tsx e l'invio in
 *  useInvitoMeet.ts. Finestra aperta → invio dalla chat del CRM (stessa strada della casella);
 *  chiusa → link wa.me col testo giusto; già inviato oggi → il tasto lo dice; manca link/telefono →
 *  spento con il motivo. Il disegno si prova sul sorgente. Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveInvitoMeet(mod, { c, gruppo, radice }) {
  const I = mod["chatwa/invito-meet"];
  const W = mod["chatwa/apriWhatsapp"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  const LINK = "https://meet.example.test/stanza-prova";
  const chat = (o = {}) => ({
    phone: o.phone === undefined ? "+393331110000" : o.phone,
    leadId: "l1",
    finestra: o.finestra,
    stop: o.stop,
    lastMessage: o.lastMessage ?? null,
    lead: { id: "l1", data: { nome: "Giulia Verdi", linkMeeting: o.link === undefined ? LINK : o.link } },
  });
  const ora = (iso) => iso.slice(11, 16);
  const giorno = (iso) => iso.slice(0, 10);

  gruppo("INVITO AL MEET · IL TESTO");
  const p = I.preparaInvito(chat(), "10:30", "Mirko");
  c("col link, telefono e consulente: pronto", true, p.ok);
  c(
    "il testo è l'invito col tu, l'ora, il consulente e il link",
    `Ciao Giulia, la tua consulenza con Hair Genius Labs è alle 10:30: Mirko ti aspetta. Entra da qui: ${LINK}`,
    p.invito?.testo,
  );
  c("senza consulente: «ti aspettiamo»", true, /10:30: ti aspettiamo\. Entra da qui/.test(I.preparaInvito(chat(), "10:30", null).invito.testo));
  c("manca il link: spento col motivo", "Manca il link del meet", I.preparaInvito(chat({ link: "chiamo io" }), "10:30", "Mirko").motivo);
  c("manca il telefono: spento col motivo", "Manca il telefono", I.preparaInvito(chat({ phone: "" }), "10:30", "Mirko").motivo);
  c("telefono troppo corto: come mancante", false, I.preparaInvito(chat({ phone: "+39 12" }), "10:30", "Mirko").ok);
  c("il cliente ha scritto STOP: spento", false, I.preparaInvito(chat({ stop: true }), "10:30", "Mirko").ok);

  gruppo("INVITO AL MEET · LA STRADA");
  c("finestra aperta: dal CRM", "crm", I.stradaInvito(chat({ finestra: { aperta: true } })));
  c("finestra chiusa: WhatsApp", "whatsapp", I.stradaInvito(chat({ finestra: { aperta: false } })));
  c("finestra non nota: WhatsApp (meglio di un invio rifiutato)", "whatsapp", I.stradaInvito(chat()));
  const wa = W.linkWaMe("+393331110000", p.invito.testo);
  c("a finestra chiusa il link wa.me porta il testo giusto, codificato", true, wa.startsWith("https://wa.me/393331110000?text=") && decodeURIComponent(wa.split("?text=")[1]) === p.invito.testo);
  c("su Android passa da WhatsApp Business col ripiego wa.me", true, /^intent:\/\/send\//.test(W.linkApriWhatsapp("+393331110000", "Mozilla Android", p.invito.testo)));

  gruppo("INVITO AL MEET · GIÀ INVIATO OGGI");
  const OGGI = "2026-10-31";
  const vuoto = {};
  c("mai mandato: niente", null, I.invitoDiOggi(chat(), vuoto, OGGI, LINK, ora, giorno));
  const reg = I.registraInvito(vuoto, "+393331110000", OGGI, "10:05", "crm");
  c("registrato oggi: lo dice con l'ora", "10:05", I.invitoDiOggi(chat(), reg, OGGI, LINK, ora, giorno)?.alle);
  c("registrato ieri: non conta", null, I.invitoDiOggi(chat(), I.registraInvito(vuoto, "+393331110000", "2026-10-30", "10:05", "crm"), OGGI, LINK, ora, giorno));
  c("un altro telefono non conta", null, I.invitoDiOggi(chat({ phone: "+393339998888" }), reg, OGGI, LINK, ora, giorno));
  const nostro = { direction: "outbound", body: `ciao ${LINK}`, created_at: "2026-10-31T09:40:00Z" };
  c("l'ultimo messaggio è nostro, di oggi, col link: già inviato", "09:40", I.invitoDiOggi(chat({ lastMessage: nostro }), vuoto, OGGI, LINK, ora, giorno)?.alle);
  c("ultimo messaggio del cliente: non conta", null, I.invitoDiOggi(chat({ lastMessage: { ...nostro, direction: "inbound" } }), vuoto, OGGI, LINK, ora, giorno));
  c("ultimo messaggio nostro senza il link: non conta", null, I.invitoDiOggi(chat({ lastMessage: { ...nostro, body: "ok a dopo" } }), vuoto, OGGI, LINK, ora, giorno));
  c("ultimo messaggio nostro di ieri: non conta", null, I.invitoDiOggi(chat({ lastMessage: { ...nostro, created_at: "2026-10-30T09:40:00Z" } }), vuoto, OGGI, LINK, ora, giorno));
  const dopo = I.registraInvito({ "+39111": { giorno: "2026-10-29", alle: "09:00", via: "crm" } }, "+39222", OGGI, "10:05", "whatsapp");
  c("il registro butta i giorni vecchi (non cresce)", ["+39222"], Object.keys(dopo));
  c("registro rotto o di forma sbagliata: vuoto", {}, I.leggiRegistro("{rotto"));
  c("registro con voci storte: scartate", {}, I.leggiRegistro('{"+39":{"giorno":1,"alle":"x","via":"boh"}}'));
  c("registro buono: riletto uguale", reg, I.leggiRegistro(JSON.stringify(reg)));

  gruppo("INVITO AL MEET · IL TASTO E L'INVIO (sorgente)");
  const barra = senzaCommenti(leggi("src/crm/chatwa/BarraProssimoMeet.tsx"));
  const hook = senzaCommenti(leggi("src/crm/chatwa/useInvitoMeet.ts"));
  c("il tasto pieno ha l'etichetta «Invia invito»", true, /Invia invito/.test(barra));
  c("il tasto è alto almeno 44 px su ogni schermo", true, /inline-flex min-h-11/.test(barra));
  c("la parte a sinistra apre ancora la chat (tasto fratello, non annidato)", true, /onClick=\{onApri\}/.test(barra) && /<\/button>\s*<div className="shrink-0[^"]*">\s*<TastoInvito/.test(barra));
  c("a finestra chiusa è un link che si apre in una scheda nuova, senza opener", true, /<a\s[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/.test(barra));
  c("si disabilita durante l'invio e lo dice allo screen reader", true, /disabled=\{inviando\}/.test(barra) && /aria-busy=\{inviando\}/.test(barra));
  c("senza link o telefono il tasto è spento e scrive il motivo", true, /disabled className=\{TASTO_SPENTO\}[\s\S]*?\{preparato\.motivo\}/.test(barra));
  c("già mandato: «Rimanda» con l'ora", true, /"Rimanda"/.test(barra) && /alle \$\{fatto\.alle\}/.test(barra));
  c("nessuna emoji, nessuna righetta colorata", false, /\p{Extended_Pictographic}|border-l-/u.test(barra));
  c("l'invio va alla stessa strada della casella, col telefono, il testo e la scheda", true, /fetch\("\/api\/whatsapp-send"/.test(hook) && /JSON\.stringify\(\{ to: telefono, body: testo, leadId \}\)/.test(hook));
  c("una chiamata alla volta (doppio tocco)", true, /inCorso\.current \|\| strada !== "crm"/.test(hook) && /inCorso\.current = true/.test(hook));
  c("toast «Invito inviato» solo se è partito", true, /esito === "ok"[\s\S]*?toast\.success\("Invito inviato"\)/.test(hook));
  c("rimandare chiede conferma", true, /Rimandarlo\?/.test(hook));
  c("se il server dice «oltre le 24 ore» si passa a WhatsApp", true, /fuori_finestra[\s\S]*?setForzaWa\(true\)/.test(hook));
  c("non tocca i file della prestazione né il prossimo-meet", true, !/invito-meet|useInvitoMeet/.test(leggi("src/crm/chatwa/useChatWa.ts") + leggi("src/crm/chatwa/RigaChat.tsx") + leggi("src/crm/chatwa/prossimo-meet.ts")));
}
