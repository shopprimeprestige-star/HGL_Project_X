/** ── PROVE: RITOCCHI ALLA CHAT (30/10/2026, commessa 2026-10-30-chat-ritocchi) ─────────────────────
 *  1. sottofiltri di «Da chiamare» come le pillole (una riga che scorre, 44 px, più leggera)
 *  2. cornetta e stato anche sulle chat senza nome/scheda; lo stato crea la scheda
 *  3. niente «Abbina a una scheda» in riga: resta «Crea scheda»
 *  4. riquadro «Senza scheda (N)» in cima
 *  5. pillola «Clienti» (stessa definizione dei KPI: `eConversione`)
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveSottofiltriScorrevoli(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  gruppo("CHAT RITOCCHI 1: SOTTOFILTRI DI «DA CHIAMARE» COME LE PILLOLE");
  const blocco = elenco.slice(elenco.indexOf('filtri.coda === "da-chiamare" && ('));
  const sotto = blocco.slice(0, blocco.indexOf("role=\"status\""));
  c("stessa riga scorrevole delle pillole principali (una costante sola)", true,
    (elenco.match(/\{RIGA_SCORREVOLE\}|RIGA_SCORREVOLE,|className=\{RIGA_SCORREVOLE|cn\(RIGA_SCORREVOLE/g) ?? []).length >= 2 &&
      /const RIGA_SCORREVOLE =[\s\S]{0,120}overflow-x-auto overscroll-x-contain/.test(elenco));
  c("i sottofiltri non vanno più a capo", false, /flex-wrap/.test(sotto));
  const tasto = elenco.slice(elenco.indexOf("const sottoTasto"), elenco.indexOf("/** Il tasto di un chip"));
  c("tasti da 44 px sul telefono, il numero accanto, acceso = aria-pressed", true,
    /h-11/.test(tasto) && /aria-pressed=\{sottoAttivo === x\.v\}/.test(sotto) && /conti\[x\.v\]/.test(sotto) && /sottoTasto\(/.test(sotto));
  c("più leggeri: testo piccolo (t-nota), solo linea sotto, nessun pieno primario", true,
    /t-nota/.test(tasto) && /border-b-2/.test(tasto) && !/bg-primary/.test(tasto));
  c("«Quando richiamare» (Scaduti/Oggi/Domani…) diventa una riga uguale, senza il menu a tendina", true,
    /Quando richiamare/.test(sotto) && !/<select/.test(sotto) && /aria-pressed=\{quandoAttivo === x\.v\}/.test(sotto));
}

export function proveCreaSchedaDaChat(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const S = mod["chatwa/schedaDaChat"];
  gruppo("CHAT RITOCCHI 2: LA SCHEDA NASCE DAL NUMERO");
  const d = S.schedaDaChat({ phone: "+393331112222", contact: { display_name: "Anna Verdi" } }, new Date("2026-10-30T10:00:00Z"));
  c("col numero della chat, nome del contatto, origine fuori da ADV, stato di partenza", ["+393331112222", "Anna Verdi", "Organico", "da_contattare", "2026-10-30T10:00:00.000Z"],
    [d.telefono, d.nome, d.fonte, d.stato, d.createdAt]);
  const senza = S.schedaDaChat({ phone: "+393331112222", contact: null }, new Date("2026-10-30T10:00:00Z"));
  c("senza nome salvato: nome vuoto (si vede il numero), mai «null»", ["", ""], [senza.nome, senza.cognome]);
  c("origine «WhatsApp» scritta nelle note, per chi apre la scheda", ["WhatsApp", "Origine: WhatsApp"], [S.ORIGINE_SCHEDA_DA_CHAT, d.note]);

  const riga = leggi("src/crm/chatwa/RigaChat.tsx");
  const hook = leggi("src/crm/chatwa/useChatWa.ts");
  const tipi = leggi("src/crm/chatwa/tipi.ts");
  const pagina = leggi("src/crm/chatwa/PaginaChat.tsx");
  c("la cornetta non dipende più dalla scheda", false, /c\.lead && telefono/.test(riga));
  c("la cornetta c'è con un numero da comporre", true, /\{telefono && \(/.test(riga) && /href=\{`tel:\$\{telefono\}`\}/.test(riga));
  c("il tasto stato c'è anche senza scheda (non con più schede)", true, /puoiCambiareStato/.test(riga) && /!ambigua/.test(riga));
  c("senza scheda la scelta crea la scheda (onCreaSchedaConStato)", true, /onCreaSchedaConStato\?\.\(s\)/.test(riga));
  c("l'hook crea la scheda e poi cambia stato con lo stesso salvataggio del CRM", true,
    /creaSchedaConStato/.test(hook) && /createLead\(schedaDaChat\(/.test(hook) && /await cambiaStatoLead\(/.test(hook));
  c("un secondo tocco mentre salva non crea due schede", true, /inCreazione/.test(hook));
  c("il contratto dell'api lo dichiara", true, /creaSchedaConStato: \(chat: ChatItem, s: LeadStatus\) => Promise<void>/.test(tipi));
  c("l'elenco lo passa alla riga", true, /onCreaSchedaConStato=\{/.test(leggi("src/crm/chatwa/ElencoChat.tsx")));
  void pagina;
}

export function proveNienteAbbinaInRiga(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  gruppo("CHAT RITOCCHI 3: «ABBINA» NON È PIÙ IN RIGA");
  const riga = leggi("src/crm/chatwa/RigaChat.tsx");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  const conv = leggi("src/crm/chatwa/Conversazione.tsx");
  const tipi = leggi("src/crm/chatwa/tipi.ts");
  c("la riga non ha il tasto «Abbina a una scheda»", false, /Abbina a una scheda|onAbbina/.test(riga));
  c("l'elenco non passa onAbbina", false, /onAbbina/.test(elenco));
  c("l'elenco non lo chiede nelle sue props", false, /ElencoChatProps[\s\S]{0,200}onAbbina/.test(tipi));
  c("resta «Crea scheda», corto, con l'icona, da 44 px sul telefono", true,
    />\s*<UserPlus[^>]*\/>\s*Crea scheda\s*</.test(riga) && /h-11/.test(riga.slice(riga.lastIndexOf("Crea scheda") - 700, riga.lastIndexOf("Crea scheda"))));
  c("l'abbinamento resta nel menu ⋮ della conversazione aperta", true, /onSelect=\{\(\) => onAbbina\(attiva\)\}/.test(conv) && /Abbina a una scheda/.test(conv));
  c("nell'intestazione della chat non c'è un tasto «Abbina» a vista", false,
    /<Button[^>]*onClick=\{\(\) => onAbbina/.test(conv));
}

export function proveRiquadroSenzaScheda(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const Q = mod["chatwa/senzaScheda"];
  gruppo("CHAT RITOCCHI 4: RIQUADRO «SENZA SCHEDA» IN CIMA");
  const ora = (iso) => ({ created_at: iso });
  const chat = (phone, o = {}) => ({
    phone, lead: null, senzaScheda: true, schedaAmbigua: false, lastMessage: ora(o.ultimo ?? "2026-10-30T09:00:00Z"), contact: null, ...o,
  });
  const a = chat("+39100", { ultimo: "2026-10-28T09:00:00Z" });
  const b = chat("+39200", { ultimo: "2026-10-30T09:00:00Z" });
  const conScheda = chat("+39300", { lead: { id: "l", data: {} }, senzaScheda: false });
  const ambigua = chat("+39400", { senzaScheda: false, schedaAmbigua: true });
  const vuota = chat("+39500", { lastMessage: null });
  c("senza scheda e con messaggi: sì; con scheda, ambigua o senza messaggi: no", [true, true, false, false, false],
    [a, b, conScheda, ambigua, vuota].map(Q.eSenzaSchedaConMessaggi));
  c("chat vecchie ma con data sul contatto contano", true, Q.eSenzaSchedaConMessaggi(chat("+39600", { lastMessage: null, contact: { last_message_at: "2025-01-01T10:00:00Z" } })));
  c("nel riquadro: la più recente per prima", ["+39200", "+39100"], Q.chatSenzaScheda([a, conScheda, b, ambigua, vuota]).map((x) => x.phone));
  c("appena ha una scheda esce dal riquadro", ["+39200"], Q.chatSenzaScheda([{ ...a, lead: { id: "n", data: {} }, senzaScheda: false }, b]).map((x) => x.phone));

  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  c("l'elenco «Tutte» ha il riquadro «Senza scheda (N)» sopra tutto (le altre viste restano com'erano: i numeri di «Da rispondere» devono essere quelli del pulsante)", true,
    /Senza scheda \(\{senzaSchedaCon\.length\}\)/.test(elenco) && elenco.indexOf("titolo-senza-scheda") < elenco.indexOf("titolo-in-scadenza"));
  c("una chat una volta sola: sotto il riquadro non si ripetono", true, /!inSenzaSchedaTel\.has\(c\.phone\)/.test(elenco));
  c("nelle viste «Da rispondere» e «Da chiamare» il riquadro non c'è", true, /const senzaSchedaCon = tutte \?/.test(elenco));
  c("«Seleziona tutto» comprende anche le chat del riquadro", true, /\.\.\.senzaSchedaCon,/.test(elenco));
}
