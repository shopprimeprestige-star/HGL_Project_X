/** ── I LEAD SALTATI — LA REGOLA, IN UN POSTO SOLO ──────────────────────────
 *
 *  «Salta» in /CRM/importa vuol dire: questa persona adesso non la chiamo, ma
 *  non è successo niente che valga la pena scrivere sulla sua scheda. Trovato
 *  occupato, numero che squilla mentre entra l'altra chiamata, uno che si
 *  richiama solo di sera.
 *
 *  ── COS'ERA, E PERCHÉ NON BASTAVA ─────────────────────────────────────────
 *  Era un `Set` di id dentro la pagina (`inFondo`): il saltato scendeva in
 *  fondo al giro e ci restava finché la pagina non veniva ricaricata. Cioè il
 *  salto durava quanto una scheda del browser aperta — un F5, un cambio
 *  schermata, la sera che si chiude tutto, e i saltati tornavano in cima come
 *  se nessuno li avesse mai toccati. E valeva per QUEL browser: il collega che
 *  lavorava la stessa lista dall'altra postazione li richiamava lo stesso.
 *
 *  ── DOVE VIVE ADESSO, E PERCHÉ PROPRIO LÌ ─────────────────────────────────
 *  Su due campi della scheda (`LeadData.saltatoIl`, `LeadData.saltatoDa`),
 *  scritti con lo stesso `updateLead` di tutti gli altri campi.
 *  Le altre due strade erano:
 *   · `localStorage` — si scriveva in mezza riga, ed è esattamente il difetto
 *     che si sta togliendo: resta nel browser di chi ha premuto. Il committente
 *     ha chiesto il contrario a chiare lettere («se salta un setter, il salto
 *     lo vede anche l'altro»);
 *   · una riga di `app_config` con dentro l'elenco degli id saltati — è come il
 *     CRM salva le COSE CHE NON HANNO UNA SCHEDA (i blocchi di disponibilità,
 *     i task scritti a mano, i testi WhatsApp: vedi crm/blocchi.ts e
 *     crm/dafare/task-manuali.tsx). Questi ce l'hanno, una scheda. Un elenco di
 *     id a parte è un secondo elenco da tenere allineato al primo: sopravvive
 *     alla scheda cancellata, a quella venduta, a quella riassegnata, e nessuno
 *     lo ripulisce mai perché nessuno lo guarda. È la stessa ragione per cui in
 *     questa pagina la coda si CALCOLA e non si tiene: due elenchi che dicono
 *     la stessa cosa prima o poi ne dicono due diverse.
 *  Sulla scheda, invece, il salto viaggia con la persona: se la scheda sparisce
 *  sparisce con lei, se cambia mano se la porta dietro. E `crm_leads.data` è
 *  una colonna JSON — due campi nuovi non chiedono nessuna migrazione e nessun
 *  permesso in più di quelli che servono già a segnare un esito.
 *
 *  ⚠️ IL SALTO NON È UN ESITO. Non tocca lo stato, non conta un tentativo, non
 *   entra nei KPI: chi era «Da contattare» resta «Da contattare» e il giorno in
 *   cui rientra in coda è come se non fosse passato nulla. Se un giorno servisse
 *   sapere «quante volte è stato saltato», è un campo nuovo — non si travesta
 *   questo da contatore.
 *
 *  ⚠️ CHI È SALTATO NON È IN CODA, MA NON È SPARITO. Esce dal giro delle
 *   telefonate (è tutto il senso del gesto) e compare nella scheda «Lead
 *   saltati» della stessa pagina, che dice sempre da quanto tempo è lì. Resta
 *   inoltre nell'elenco di /CRM/avanzamento, che guarda `importato` e non
 *   questi campi: una seconda rete, per il giorno in cui nessuno apre la scheda
 *   dei saltati.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead, LeadData } from "@/crm/types";
import { giorniDaOggi, soloData } from "@/crm/ui";

/** Vero se questa scheda è stata messa da parte e nessuno l'ha ancora rimessa
 *  in coda. La domanda si fa QUI e non con un `!!l.data?.saltatoIl` sparso per
 *  la pagina: il giorno in cui «saltato» vorrà dire qualcosa di più (per
 *  esempio «saltato e non ancora scaduto»), cambia una riga sola. */
export function eSaltato(l: Lead | null | undefined): boolean {
  return !!String(l?.data?.saltatoIl || "").trim();
}

/** Da quanti giorni sta lì: 0 = oggi, 1 = ieri, e così via.
 *  `NaN` quando la data non si riesce a leggere — capita con gli archivi
 *  importati, e «non lo so» non è «oggi»: chi conta i saltati dimenticati deve
 *  poterlo escludere invece di ritrovarselo dentro come se fosse appena
 *  successo (è la stessa scelta, e la stessa funzione, di `giorniDaOggi`). */
export function giorniDiAttesa(l: Lead): number {
  const giorno = soloData(l?.data?.saltatoIl);
  if (!giorno) return Number.NaN;
  const g = giorniDaOggi(giorno);
  //  La data del salto è nel passato, quindi `giorniDaOggi` la dà negativa: qui
  //  serve il numero come lo direbbe una persona («da tre giorni»). Un orologio
  //  avanti di qualche ora — succede fra postazioni — non deve produrre «da -1
  //  giorni», che non vuol dire niente.
  return Number.isNaN(g) ? Number.NaN : Math.max(0, -g);
}

/** Oltre questa attesa il saltato non è più «lo richiamo dopo»: è una persona
 *  che nessuno sta lavorando. Tre giorni sono il tempo in cui un contatto di
 *  una lista si raffredda — dopo non si ricorda più di aver lasciato il numero
 *  (è la stessa ragione per cui la coda ordina anche per data di ingresso). */
export const SALTATO_DA_TROPPO = 3;

/** Saltato e dimenticato: serve al numero che si accende in cima alla pagina.
 *  Una data illeggibile NON conta come dimenticata — non si accende un allarme
 *  su un dato che non si sa leggere. */
export function eDimenticato(l: Lead): boolean {
  const g = giorniDiAttesa(l);
  return !Number.isNaN(g) && g >= SALTATO_DA_TROPPO;
}

/** Da quanto è lì, detto come lo direbbe una persona. Sta qui e non nella
 *  scheda perché la stessa frase serve anche al riquadro d'avviso della coda:
 *  scritta due volte, un giorno conterebbe i giorni in due modi. */
export function attesaLeggibile(l: Lead): string {
  const g = giorniDiAttesa(l);
  if (Number.isNaN(g)) return "saltato, data da controllare";
  if (g === 0) return "saltato oggi";
  if (g === 1) return "saltato ieri";
  return `saltato ${g} giorni fa`;
}

/** L'ordine della scheda dei saltati: PRIMA I PIÙ VECCHI.
 *  È l'ordine che risponde alla domanda per cui quella scheda esiste — «chi sta
 *  lì da troppo tempo?» — invece di quella a cui risponde già la coda. Chi ha
 *  la data illeggibile va in fondo: non si sa quando è stato saltato, quindi
 *  non può stare né fra gli urgenti né in mezzo agli altri.  */
export function ordinaSaltati(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const ga = giorniDiAttesa(a);
    const gb = giorniDiAttesa(b);
    if (Number.isNaN(ga) && Number.isNaN(gb)) return 0;
    if (Number.isNaN(ga)) return 1;
    if (Number.isNaN(gb)) return -1;
    return gb - ga;
  });
}

/** La modifica da salvare per METTERE DA PARTE una scheda.
 *  Nessuno la compone a mano nelle pagine: due punti che scrivono gli stessi
 *  due campi sono due punti che un giorno ne scrivono uno solo. */
export function patchSalto(chi?: string | null): Partial<LeadData> {
  return {
    saltatoIl: new Date().toISOString(),
    //  Il nome di chi ha premuto solo se c'è: una stringa vuota in archivio si
    //  legge come «saltato da nessuno», che è peggio di non scrivere niente.
    saltatoDa: String(chi || "").trim() || undefined,
  };
}

/** La modifica da salvare per RIMETTERE IN CODA.
 *  ⚠️ I campi si azzerano a `undefined` e non a stringa vuota: `updateLead`
 *   salva l'oggetto intero come JSON, e in JSON una chiave `undefined` non
 *   viene scritta — la scheda torna esattamente com'era prima del salto, senza
 *   lasciarsi dietro un campo vuoto che il prossimo che legge deve interpretare.
 *   Con la stringa vuota resterebbe scritto «è stato saltato, ma quando non si
 *   sa», che è proprio il dato che manda in confusione la scheda dei saltati. */
export const PATCH_RIENTRO: Partial<LeadData> = {
  saltatoIl: undefined,
  saltatoDa: undefined,
};
