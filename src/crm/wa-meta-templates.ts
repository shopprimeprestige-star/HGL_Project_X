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
    | "visit_date"
    | "visit_time"
    | "recontact_date"
    | "recontact_time"
    | "meet_link";
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
  visit_date: { description: "Data visita in sede (DD/MM/YYYY)", example: "15/05/2026" },
  visit_time: { description: "Ora visita in sede (HH:MM)", example: "10:00" },
  recontact_date: { description: "Data ricontatto (DD/MM/YYYY)", example: "20/05/2026" },
  recontact_time: { description: "Ora ricontatto (HH:MM)", example: "11:00" },
  meet_link: { description: "Link Google Meet", example: "https://meet.google.com/abc-defg-hij" },
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
];

export function findMetaTemplate(name: string): MetaTemplate | undefined {
  return META_TEMPLATES.find((t) => t.name === name);
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
