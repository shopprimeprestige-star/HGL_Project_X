/**
 * Template WhatsApp pronti per Meta Business Manager.
 *
 * Meta usa PLACEHOLDER POSIZIONALI: {{1}}, {{2}}, {{3}}, ...
 * (le "named variables" non sono supportate dal flusso standard di approvazione,
 * quindi qui usiamo solo numerici, che è ciò che Meta richiede di default.)
 *
 * Il CRM invia i parametri in ORDINE come array, esattamente come Meta si aspetta.
 */

export interface MetaTemplateParam {
  /** Posizione 1-based del placeholder nel body ({{1}}, {{2}}, ...) */
  index: number;
  /** Chiave logica usata internamente dal CRM per popolare il valore */
  key:
    | "lead_name"
    | "consultant_name"
    | "appointment_date"
    | "appointment_time"
    | "appointment_day"
    | "visit_date"
    | "visit_time"
    | "recontact_date"
    | "recontact_time"
    | "meet_link"
    | "address";
  /** Descrizione human-readable per documentazione/Meta sample */
  description: string;
  /** Valore d'esempio per la review Meta */
  example: string;
}

export interface MetaTemplate {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING";
  /** Body con placeholder {{1}}, {{2}}, ... */
  body: string;
  /** Parametri in ordine (index 1..N) */
  params: MetaTemplateParam[];
}

type ParamKey = MetaTemplateParam["key"];

const DESCR: Record<ParamKey, { description: string; example: string }> = {
  lead_name: { description: "Nome del lead", example: "Mario" },
  consultant_name: { description: "Nome del consulente", example: "Luca" },
  appointment_date: { description: "Data appuntamento (DD/MM/YYYY)", example: "12/05/2026" },
  appointment_time: { description: "Ora appuntamento (HH:MM)", example: "15:30" },
  appointment_day: {
    description: "Giorno parlato, es. venerdì 23 ottobre",
    example: "venerdì 23 ottobre",
  },
  visit_date: { description: "Data visita in sede (DD/MM/YYYY)", example: "15/05/2026" },
  visit_time: { description: "Ora visita in sede (HH:MM)", example: "10:00" },
  recontact_date: { description: "Data ricontatto (DD/MM/YYYY)", example: "20/05/2026" },
  recontact_time: { description: "Ora ricontatto (HH:MM)", example: "11:00" },
  meet_link: { description: "Link Google Meet", example: "https://meet.google.com/abc-defg-hij" },
  address: { description: "Indirizzo della sede", example: "Via Esempio 1, Roma" },
};

function tpl(
  name: string,
  category: MetaTemplate["category"],
  bodyTemplate: string,
  keys: ParamKey[],
  language = "it",
): MetaTemplate {
  // Sostituisco {{key}} con {{1}}, {{2}}, ... in base all'ordine in `keys`
  let body = bodyTemplate;
  keys.forEach((k, i) => {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, "g");
    body = body.replace(re, `{{${i + 1}}}`);
  });
  const params: MetaTemplateParam[] = keys.map((k, i) => ({
    index: i + 1,
    key: k,
    description: DESCR[k].description,
    example: DESCR[k].example,
  }));
  return { name, language, category, body, params };
}

// Firma: contiene {{consultant_name}} che diventerà l'ultimo placeholder numerico.
const FIRMA = "\n\nA presto,\n{{consultant_name}}\nHair Genius Labs";

export const META_TEMPLATES: MetaTemplate[] = [
  tpl(
    "appuntamento_conferma",
    "UTILITY",
    `Gentile {{lead_name}}, Le confermo l'analisi tecnica gratuita prevista per il {{appointment_date}} alle ore {{appointment_time}}. A breve riceverà il link per collegarsi.${FIRMA}`,
    ["lead_name", "appointment_date", "appointment_time", "consultant_name"],
  ),
  tpl(
    "ringraziamento_vendita",
    "UTILITY",
    `Gentile {{lead_name}}, La ringraziamo per la fiducia accordataci. A breve La contatteremo per organizzare i prossimi step della Sua installazione Bio-Mimetic.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "acconto_ricevuto",
    "UTILITY",
    `Gentile {{lead_name}}, abbiamo ricevuto correttamente il Suo acconto. Procediamo subito con l'ordine del Suo Bio-Mimetic e La aggiorneremo sulle tempistiche di installazione.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "promemoria_acconto",
    "UTILITY",
    `Gentile {{lead_name}}, Le scrivo per ricordarLe che siamo in attesa dell'acconto per poter bloccare la data della Sua installazione. Resto a Sua disposizione per qualsiasi chiarimento.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "conferma_sede",
    "UTILITY",
    `Gentile {{lead_name}}, La aspettiamo presso la nostra sede il giorno {{visit_date}} alle ore {{visit_time}}. L'indirizzo è: Via degli Scipioni 132, Roma. Per qualsiasi necessità non esiti a contattarmi.${FIRMA}`,
    ["lead_name", "visit_date", "visit_time", "consultant_name"],
  ),
  tpl(
    "gestire_in_chat",
    "UTILITY",
    `Gentile {{lead_name}}, può scrivermi qui in chat tutte le Sue domande. Le risponderò personalmente nel più breve tempo possibile.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "follow_up_valutazione",
    "MARKETING",
    `Gentile {{lead_name}}, La contatto per sapere se ha avuto modo di valutare la nostra proposta. Resto a Sua completa disposizione per qualsiasi dubbio.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "promemoria_ricontatto",
    "UTILITY",
    `Gentile {{lead_name}}, come d'accordo La ricontatto il {{recontact_date}} alle {{recontact_time}}. Mi confermi pure se l'orario è di Suo gradimento.${FIRMA}`,
    ["lead_name", "recontact_date", "recontact_time", "consultant_name"],
  ),
  tpl(
    "fissa_meet",
    "MARKETING",
    `Gentile {{lead_name}}, riusciamo a fissare insieme la Sua analisi tecnica gratuita? Mi indichi pure un giorno e un orario di Sua preferenza.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "no_show_recover",
    "UTILITY",
    `Gentile {{lead_name}}, oggi non siamo riusciti a collegarci come previsto. Possiamo riprogrammare? Mi indichi pure un nuovo orario di Suo gradimento.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "ringraziamento_neutro",
    "UTILITY",
    `Gentile {{lead_name}}, La ringrazio comunque per il Suo tempo.`,
    ["lead_name"],
  ),
  tpl(
    "ringraziamento_finale",
    "UTILITY",
    `Gentile {{lead_name}}, La ringraziamo ancora per averci scelto. Per qualsiasi necessità futura siamo sempre a Sua disposizione.${FIRMA}`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "promemoria_meet",
    "UTILITY",
    `Gentile {{lead_name}},\n\nLe ricordo che il nostro appuntamento è confermato per il {{appointment_date}} alle ore {{appointment_time}}.\n\nLink per collegarsi: {{meet_link}}\n\nLe chiediamo cortesemente di trovarsi in un luogo tranquillo, con una buona connessione internet e con Sua moglie/compagno se possibile.${FIRMA}`,
    ["lead_name", "appointment_date", "appointment_time", "meet_link", "consultant_name"],
  ),
  //  ⚠️ LA CONFERMA AUTOMATICA DELLA CONSULENZA (commessa 2026-10-22): la
  //   manda il cron, una volta sola, subito dopo la prenotazione. Testo
  //   volutamente neutro: niente «gratuita», «offerta», capelli o prezzi —
  //   Meta riclassificherebbe MARKETING, e non è un messaggio sanitario. Se
  //   Meta chiede di cambiarlo, si cambia qui e si rifà la prova.
  tpl(
    "consulenza_conferma_presenza",
    "UTILITY",
    `Gentile {{lead_name}}, la Sua consulenza con Hair Genius Labs è fissata per {{appointment_day}} alle ore {{appointment_time}}.\n\nPer collegarsi: {{meet_link}}\n\nPer confermare la Sua presenza risponda SÌ a questo messaggio.\n\nHair Genius Labs`,
    ["lead_name", "appointment_day", "appointment_time", "meet_link"],
  ),
];

/** ── I MODELLI DI MANYCHAT (commessa 2026-10-25) ──────────────────────────
 *  Gli stessi testi approvati in ManyChat (MODELLI-MANYCHAT.md), con le
 *  variabili nell'ordine dei campi `crm_v1…crm_v4`. Il CRM li manda da solo
 *  (giro, sequenze, messaggi per stato); qui servono a «Prova i modelli».
 *  ⚠️ Non stanno in META_TEMPLATES: quella lista è dei modelli della Cloud API
 *   (Contatti WhatsApp, esportazione per Meta) e non va toccata. */
export const MODELLI_MANYCHAT: MetaTemplate[] = [
  tpl(
    "hgl_primo_contatto",
    "MARKETING",
    `Gentile {{lead_name}}, sono il team di Hair Genius Labs: abbiamo ricevuto la Sua richiesta di informazioni, grazie.\n\nCi occupiamo di soluzioni non chirurgiche per la perdita dei capelli: la patch cutanea e Invisible Derm. Nella prima consulenza gratuita, online in videochiamata, Filippo Le spiegherà entrambe e quale è più adatta alla Sua situazione.\n\nPer fissarla, preferisce la mattina o la sera?`,
    ["lead_name"],
  ),
  tpl(
    "hgl_richiamo_24h",
    "MARKETING",
    `Gentile {{lead_name}}, Le avevamo scritto per la Sua richiesta a Hair Genius Labs.\n\nSe desidera fissare la consulenza gratuita online, ci risponda pure qui indicando se preferisce la mattina o la sera: Le proponiamo subito un orario.\n\nHair Genius Labs`,
    ["lead_name"],
  ),
  tpl(
    "hgl_meet_domani",
    "UTILITY",
    `Gentile {{lead_name}}, Le ricordiamo che domani, {{appointment_day}}, alle ore {{appointment_time}} ha la Sua consulenza online con Hair Genius Labs.\n\nLa seguirà {{consultant_name}}. Se ha un imprevisto, ci risponda qui e troviamo un altro orario.`,
    ["lead_name", "appointment_day", "appointment_time", "consultant_name"],
  ),
  tpl(
    "hgl_meet_oggi",
    "UTILITY",
    `Gentile {{lead_name}}, Le ricordiamo che oggi alle ore {{appointment_time}} ha la Sua consulenza online con Hair Genius Labs.\n\nLa seguirà {{consultant_name}}. Poco prima dell'inizio riceverà il link per collegarsi.\n\nSe ha un imprevisto, ci risponda qui e troviamo un altro orario.`,
    ["lead_name", "appointment_time", "consultant_name"],
  ),
  tpl(
    "hgl_promemoria_meet",
    "UTILITY",
    `Gentile {{lead_name}}, Le ricordo la Sua consulenza online con Hair Genius Labs di oggi alle ore {{appointment_time}}, tra circa 25 minuti.\n\nPer collegarsi: {{meet_link}}\n\nLa seguirà {{consultant_name}}. Se può, si colleghi da un posto tranquillo e con una buona connessione.\n\nHair Genius Labs`,
    ["lead_name", "appointment_time", "meet_link", "consultant_name"],
  ),
  tpl(
    "hgl_meet_adesso",
    "UTILITY",
    `Gentile {{lead_name}}, la Sua consulenza con Hair Genius Labs inizia adesso e {{consultant_name}} La sta aspettando.\n\nEntri da qui: {{meet_link}}\n\nSe ha difficoltà a collegarsi, ci risponda a questo messaggio.`,
    ["lead_name", "consultant_name", "meet_link"],
  ),
  tpl(
    "hgl_ricontatto_consulenza",
    "MARKETING",
    `Gentile {{lead_name}}, sono {{consultant_name}}, consulente di Hair Genius Labs.\n\nEravamo rimasti che mi avrebbe fatto sapere: ha deciso come procedere, o Le servono altri chiarimenti?\n\nMi risponda pure qui, sono a Sua disposizione.`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "hgl_meet_da_fissare",
    "UTILITY",
    `Gentile {{lead_name}}, sono {{consultant_name}}, consulente di Hair Genius Labs. Come d'accordo, La ricontatto per fissare la Sua consulenza online.\n\nPreferisce la mattina o la sera? Le proponiamo subito un orario.`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "hgl_richiamo_concordato",
    "UTILITY",
    `Gentile {{lead_name}}, come d'accordo La chiameremo oggi alle ore {{recontact_time}} da Hair Genius Labs.\n\nSe l'orario non Le va più bene, ci risponda qui e lo spostiamo.`,
    ["lead_name", "recontact_time"],
  ),
  tpl(
    "hgl_non_risponde",
    "UTILITY",
    `Gentile {{lead_name}}, abbiamo provato a chiamarLa da Hair Genius Labs per la Sua richiesta di informazioni, senza riuscire a raggiungerLa.\n\nCi indica qui un momento comodo per sentirci? Va bene anche un orario serale.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_cliente_assente",
    "UTILITY",
    `Gentile {{lead_name}}, oggi non siamo riusciti a vederci per la Sua consulenza online con Hair Genius Labs.\n\nNessun problema: ci risponda qui e Le proponiamo un nuovo orario, mattina o sera come preferisce.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_da_riprogrammare",
    "UTILITY",
    `Gentile {{lead_name}}, sono {{consultant_name}}, consulente di Hair Genius Labs. La ricontatto per fissare il nuovo orario della Sua consulenza online.\n\nPreferisce la mattina o la sera?`,
    ["lead_name", "consultant_name"],
  ),
  tpl(
    "hgl_promemoria_sede",
    "UTILITY",
    `Gentile {{lead_name}}, Le ricordiamo l'appuntamento in sede con Hair Genius Labs di {{appointment_day}} alle ore {{visit_time}}.\n\nIndirizzo: {{address}}\n\nSe ha un imprevisto, ci risponda qui e troviamo un altro orario.`,
    ["lead_name", "appointment_day", "visit_time", "address"],
  ),
  tpl(
    "hgl_sede_disdetta",
    "UTILITY",
    `Gentile {{lead_name}}, abbiamo registrato la disdetta del Suo appuntamento in sede con Hair Genius Labs.\n\nQuando vuole, ci risponda qui e fissiamo una nuova data.`,
    ["lead_name"],
  ),
  tpl(
    "hgl_ultimo_tentativo",
    "MARKETING",
    `Gentile {{lead_name}}, abbiamo provato più volte a contattarLa da Hair Genius Labs per la Sua richiesta, senza riuscirci.\n\nSe è ancora interessato, ci risponda qui: altrimenti non La disturberemo più.`,
    ["lead_name"],
  ),
];

export function findMetaTemplate(name: string): MetaTemplate | undefined {
  return (
    META_TEMPLATES.find((t) => t.name === name) ?? MODELLI_MANYCHAT.find((t) => t.name === name)
  );
}

/** Genera il contenuto TXT pronto da copiare/incollare in Meta Business Manager. */
export function buildMetaTemplatesTxt(): string {
  const lines: string[] = [];
  lines.push("===============================================================");
  lines.push("  TEMPLATE WHATSAPP — PRONTI PER META BUSINESS MANAGER");
  lines.push("  Hair Genius Labs · placeholder POSIZIONALI {{1}} {{2}} ...");
  lines.push("===============================================================");
  lines.push("");
  lines.push("ISTRUZIONI:");
  lines.push("1. Vai su https://business.facebook.com/wa/manage/message-templates/");
  lines.push("2. Clicca 'Crea template' per ciascuna voce qui sotto.");
  lines.push("3. Imposta NAME, CATEGORY e LANGUAGE come indicato.");
  lines.push("4. Incolla il BODY: i placeholder {{1}}, {{2}}, ... sono già numerici come richiede Meta.");
  lines.push("5. Aggiungi i SAMPLE VALUES nello stesso ordine indicato.");
  lines.push("");

  META_TEMPLATES.forEach((t, i) => {
    lines.push("---------------------------------------------------------------");
    lines.push(`#${(i + 1).toString().padStart(2, "0")}  ${t.name}`);
    lines.push("---------------------------------------------------------------");
    lines.push(`NAME       : ${t.name}`);
    lines.push(`CATEGORY   : ${t.category}`);
    lines.push(`LANGUAGE   : ${t.language}`);
    lines.push("");
    lines.push("BODY:");
    lines.push(t.body);
    lines.push("");
    if (t.params.length > 0) {
      lines.push("PLACEHOLDERS:");
      t.params.forEach((p) => {
        lines.push(`  {{${p.index}}} = ${p.description}`);
      });
      lines.push("");
      lines.push("SAMPLE VALUES (per la review Meta, in ordine):");
      t.params.forEach((p) => {
        lines.push(`  {{${p.index}}} → ${p.example}`);
      });
      lines.push("");
    } else {
      lines.push("PLACEHOLDERS: nessuno");
      lines.push("");
    }
  });

  lines.push("===============================================================");
  lines.push("  FINE — totale template: " + META_TEMPLATES.length);
  lines.push("===============================================================");
  return lines.join("\n");
}
