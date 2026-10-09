/** ─────────────────────────────────────────────────────────────────────────
 *  UN LEAD DEL MODULO META, TRADOTTO IN UNA RIGA DEI CONTATTI ARRIVATI
 *
 *  PERCHÉ STA IN UN FILE SUO
 *  Le porte da cui un lead di Meta può entrare sono due — il webhook, che lo
 *  riceve appena viene compilato, e il recupero periodico, che va a ripescare
 *  quelli che il webhook non ha visto — e devono produrre LA STESSA RIGA. Due
 *  traduzioni diverse dello stesso modulo vogliono dire lo stesso cliente
 *  scritto in due modi, e ci si accorge il giorno in cui uno dei due arriva
 *  senza telefono.
 *
 *  QUI NON C'È NESSUNA CHIAMATA DI RETE: si entra con quello che ha risposto
 *  Meta e si esce con la riga da scrivere. Così si può provare per davvero,
 *  con moduli veri, senza toccare né Meta né il database.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Una risposta del modulo: `name` è il nome del campo, `values` le risposte. */
export interface VoceModulo {
  name: string;
  values: string[];
}

/** Il lead come lo restituisce la Graph API. */
export interface LeadMeta {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: VoceModulo[];
}

/** Quello che sappiamo dal webhook prima ancora di scaricare il lead. */
export interface IndizioMeta {
  ad_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
  form_id?: string;
}

/** ── LA CHIAVE CHE IMPEDISCE I DOPPIONI ───────────────────────────────────
 *  Lo stesso lead può arrivare due volte: una dal webhook e una dal recupero
 *  periodico che non sa cosa il webhook ha già preso. Il numero che Meta dà al
 *  lead è l'unica cosa che resta uguale fra i due, e finisce in `external_id`:
 *  prima di scrivere si guarda lì. */
export const idEsterno = (leadId: string) => `meta_lead:${leadId}`;

/** Toglie accenti, maiuscole e punteggiatura: i campi di un modulo scritto a
 *  mano si chiamano «Qual è la tua città?», non «city». */
const normalizza = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Le risposte, indicizzate per nome normalizzato. */
export function rispostePerNome(lead: LeadMeta): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of lead.field_data ?? []) {
    const chiave = normalizza(f.name ?? "");
    const valore = (f.values ?? []).find((v) => v && v.trim());
    if (chiave && valore) m.set(chiave, valore.trim());
  }
  return m;
}

export interface Trovato {
  /** Il nome normalizzato del campo da cui è uscito il valore. */
  chiave: string;
  valore: string;
}

/** ── TROVARE UN CAMPO CHE NON SI CHIAMA COME TI ASPETTI ───────────────────
 *  Meta usa nomi fissi solo per le domande di serie (`email`, `phone_number`).
 *  Le domande scritte a mano arrivano com'erano scritte — «Numero di telefono
 *  (cellulare)», «Qual è la tua email?» — e cercarle per nome esatto vuol dire
 *  un lead senza numero di telefono, cioè un lead che non si può chiamare.
 *  Quindi: prima il nome esatto (se c'è, è quello giusto), poi il primo campo
 *  che CONTIENE una delle parole.
 *
 *  ⚠️ LE DUE LISTE SONO SEPARATE APPOSTA. Cercare per somiglianza le stesse
 *   parole che si cercano per nome esatto sembra innocuo e non lo è: «name»
 *   sta dentro «first_name», quindi un modulo con nome e cognome separati
 *   finirebbe col credere che «first_name» sia il nome completo, e il cognome
 *   sparirebbe. Per somiglianza si cercano solo le parole che da sole non
 *   possono appartenere a un altro campo.
 *
 *  `esclusi` sono i campi già usati: un modulo che chiede «Nome e cognome» in
 *  una casella sola ha UN campo, e quel campo non può essere allo stesso tempo
 *  il nome completo e il nome di battesimo. */
export function trova(
  risposte: Map<string, string>,
  esclusi: Set<string>,
  chiavi: string[],
  simili: string[] = chiavi,
): Trovato | null {
  for (const k of chiavi) {
    if (esclusi.has(k)) continue;
    const v = risposte.get(k);
    if (v) return { chiave: k, valore: v };
  }
  for (const k of simili) {
    for (const [nome, valore] of risposte) {
      if (!esclusi.has(nome) && nome.includes(k) && valore) return { chiave: nome, valore };
    }
  }
  return null;
}

/** La stessa ricerca, quando non importa da quale campo sia uscito il valore. */
export function scegli(risposte: Map<string, string>, ...chiavi: string[]): string | null {
  return trova(risposte, new Set<string>(), chiavi)?.valore ?? null;
}

/** «Mario Rossi Junior» → nome «Mario», cognome «Rossi Junior». */
export function spezzaNome(intero: string): { nome: string; cognome: string } {
  const pezzi = intero.trim().split(/\s+/).filter(Boolean);
  if (pezzi.length === 0) return { nome: "—", cognome: "—" };
  if (pezzi.length === 1) return { nome: pezzi[0], cognome: "—" };
  return { nome: pezzi[0], cognome: pezzi.slice(1).join(" ") };
}

/** ── LA RIGA DA SCRIVERE IN `public_leads` ────────────────────────────────
 *  ⚠️ `assigned_to_user_id` NON si compila, ed è il punto più importante di
 *   tutto il file. «Nuovi contatti» mostra soltanto le righe con quel campo
 *   vuoto — è la definizione stessa della pagina: contatti ancora di nessuno.
 *   Scrivendoci dentro il proprietario dell'account, come si faceva, il lead
 *   entrava nel database e non compariva da nessuna parte: arrivato, invisibile
 *   e mai richiamato. Il consulente ce lo mette la pagina, quando qualcuno lo
 *   prende in carico.
 *  ⚠️ I campi obbligatori non possono restare vuoti: a database sono NOT NULL,
 *   e un modulo Meta può legittimamente non chiedere la città. Il trattino
 *   lungo è il segno che quel dato non è stato chiesto, e si legge a colpo
 *   d'occhio in elenco. */
export function schedaDaLead(lead: LeadMeta, indizio: IndizioMeta = {}): Record<string, unknown> {
  const risposte = rispostePerNome(lead);
  const usati = new Set<string>();

  //  Prima il nome intero: se il modulo chiede «Nome e cognome» in una casella
  //  sola, quella casella è l'unica che parla del nome e va tolta di mezzo
  //  prima di cercare il nome di battesimo.
  const intero = trova(
    risposte,
    usati,
    ["full_name", "nome_completo", "nome_e_cognome", "nome_cognome", "name"],
    ["nome_e_cognome", "nome_completo", "full_name"],
  );
  if (intero) usati.add(intero.chiave);

  const daSolo = trova(risposte, usati, ["first_name", "nome"]);
  if (daSolo) usati.add(daSolo.chiave);
  const suo = trova(risposte, usati, ["last_name", "cognome"]);
  if (suo) usati.add(suo.chiave);

  let nome = daSolo?.valore ?? null;
  let cognome = suo?.valore ?? null;
  if (!nome && intero) ({ nome, cognome } = spezzaNome(intero.valore));
  if (!cognome && intero) cognome = spezzaNome(intero.valore).cognome;

  const email = scegli(risposte, "email", "e_mail", "mail");
  const telefono = scegli(risposte, "phone_number", "telefono", "cellulare", "phone", "numero");
  const citta = scegli(risposte, "city", "citta", "comune", "provincia");

  const quando = lead.created_time ? Date.parse(lead.created_time) : Date.now();

  return {
    nome: nome || "—",
    cognome: cognome || "—",
    email: email || "—",
    telefono: telefono || "—",
    citta: citta || "—",
    pain_points: [],
    status: "nuovo",
    utm_source: "meta",
    utm_medium: "paid",
    utm_campaign: lead.campaign_name ?? null,
    ad_id: lead.ad_id ?? indizio.ad_id ?? null,
    adset_id: lead.adset_id ?? indizio.adgroup_id ?? null,
    campaign_id: lead.campaign_id ?? indizio.campaign_id ?? null,
    ad_name: lead.ad_name ?? null,
    creative_name: null,
    external_id: idEsterno(lead.id),
    event_id: `leadgen_${lead.id}`,
    first_channel: "meta",
    last_channel: "meta",
    journey_type: "meta_lead_form",
    touch_history: [
      { ch: "meta", ts: Number.isFinite(quando) ? quando : Date.now(), utm_source: "meta", utm_campaign: lead.campaign_name ?? null },
    ],
    touch_count: 1,
  };
}

/** Di quelli trovati, quali non sono già dentro. L'elenco `giaDentro` sono gli
 *  `external_id` letti dal database: il confronto si fa lì e non sul telefono,
 *  perché la stessa persona può compilare due moduli diversi e sono due lead
 *  veri, mentre lo stesso lead scaricato due volte è un doppione. */
export function soloNuovi(leads: LeadMeta[], giaDentro: Iterable<string>): LeadMeta[] {
  const dentro = new Set(giaDentro);
  const visti = new Set<string>();
  const fuori: LeadMeta[] = [];
  for (const l of leads) {
    const id = idEsterno(l.id);
    if (dentro.has(id) || visti.has(id)) continue;   // anche i doppioni dentro la stessa risposta
    visti.add(id);
    fuori.push(l);
  }
  return fuori;
}
