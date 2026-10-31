/** ── PROVE: RITOCCHI ALLA CHAT (30/10/2026, commessa 2026-10-30-chat-ritocchi) ─────────────────────
 *  1. sottofiltri di «Da chiamare» come le pillole (una riga che scorre, 44 px, più leggera)
 *  2. cornetta e stato anche sulle chat senza nome/scheda; lo stato crea la scheda
 *  3. niente «Abbina a una scheda» in riga: resta «Crea scheda»
 *  4. (tolto il 31/10/2026: «Tutte» è identica a WhatsApp, gli sconosciuti stanno nell'elenco unico)
 *  5. pillola «Clienti» (stessa definizione dei KPI: `eConversione`)
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveSottofiltriScorrevoli(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  gruppo("CHAT RITOCCHI 1: SOTTOFILTRI DI «DA CHIAMARE» COME LE PILLOLE");
  c("filtri rapidi: uno alla volta (si parte da FILTRI_VUOTI, il consulente resta)", true,
    /commuta\(\{ \.\.\.FILTRI_VUOTI, consulente: filtri\.consulente \}, v\.campo, v\.valore\)/.test(elenco) &&
      !/setFiltri\(commuta\(filtri, v\.campo, v\.valore\)\)/.test(elenco));
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

export function proveClienti(mod, { c, gruppo, radice }) {
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const F = mod["chatwa/filtri"];
  gruppo("CHAT RITOCCHI 5: PILLOLA «CLIENTI» (STESSA DEFINIZIONE DEI KPI)");
  const K = mod["kpi-calcoli"];
  const chat = (data) => ({ phone: "+39" + Math.random(), lead: data ? { id: "x", data } : null, finestra: null });
  const casi = {
    "acconto incassato (importo)": { stato: "da_contattare", payment: { accontoPagato: 200 } },
    "nel nostro centro": { stato: "posa_in_sede" },
    "a domicilio": { stato: "posa_a_domicilio" },
    "da spedire": { stato: "posa_da_spedire" },
    "vecchio «venduto»": { stato: "venduto" },
    "acconto (stato)": { stato: "acconto" },
    "in sede con la spunta dell'acconto": { stato: "viene_in_sede", accontoVieneInSede: true },
  };
  const fc = { ...F.FILTRI_VUOTI, tipo: "cliente" };
  const nessuno = () => 0;
  for (const [nome, data] of Object.entries(casi)) {
    c(`cliente: ${nome}`, [true, true], [F.passaFiltri(chat(data), fc, nessuno), K.eConversione({ data })]);
  }
  for (const [nome, data] of Object.entries({
    "da contattare": { stato: "da_contattare" },
    "appuntamento fissato": { stato: "appuntamento_fissato" },
    "promessa di acconto, soldi no": { stato: "viene_in_sede", accontoVieneInSede: false, payment: { accontoPagato: 0 } },
    annullato: { stato: "annullato" },
  })) c(`non cliente: ${nome}`, false, F.passaFiltri(chat(data), fc, nessuno));
  c("senza scheda non è cliente", false, F.passaFiltri(chat(null), fc, nessuno));
  c("«Clienti» è nella riga rapida e nel pannello, dopo «Sconosciuti» (che resta: è il filtro del pannello)",
    ["Da rispondere", "Da chiamare", "Con stelle", "Sconosciuti", "Clienti"], F.VOCI_RIGA.map((v) => v.nome));
  c("è nel gruppo «Tipo di contatto»: una sola scelta fra Con scheda, Senza scheda, Clienti",
    { tipo: "cliente" }, { tipo: F.commuta(F.commuta(F.FILTRI_VUOTI, "tipo", "senza-scheda"), "tipo", "cliente").tipo });
  c("si ricorda e si legge dal salvataggio", "cliente", F.leggiFiltri(F.scriviFiltriSessione(fc), null).tipo);
  c("l'etichetta sul riepilogo", "Clienti", F.etichetteAccese(fc, () => "")[0].etichetta);
  c("conta come le altre voci (a faccette)", 1, F.contaVoce([chat(casi["nel nostro centro"]), chat({ stato: "da_contattare" })], F.FILTRI_VUOTI, nessuno, "tipo", "cliente"));
  c("riusa eConversione del CRM, non una regola nuova", true, /eConversione/.test(leggi("src/crm/chatwa/filtri.ts")));
}
