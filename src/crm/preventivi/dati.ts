/** ── PREVENTIVI · I DATI, PRIMA DELLA GRAFICA ──────────────────────────────
 *
 *  PERCHÉ UN FILE A PARTE
 *  La pagina dei preventivi mostra IMPORTI e DATE DI SCADENZA, e le sbaglia in
 *  un modo solo: calcolandole in due posti diversi. Qui c'è un calcolo solo per
 *  ogni domanda — quanto vale, fino a quando vale, a chi è intestato, a chi
 *  corrisponde nel CRM — e la pagina si limita a disegnarlo.
 *
 *  ⚠️ LE TRE COSE CHE NON SI RISCRIVONO MAI QUI
 *   1. la SCADENZA nasce da `promoDeadline` (shop/quote-menu), la stessa
 *      funzione che stampa la data sul preventivo del cliente — salta i weekend
 *      in entrambe le direzioni. Un secondo conto vorrebbe dire telefonare
 *      dicendo un giorno mentre il cliente ne legge un altro;
 *   2. il TOTALE ricostruito usa la stessa identica formula di
 *      `totaleDi` in shop/QuotesPanel.tsx. Due formule gemelle finiscono per
 *      mostrare una cifra qui e un'altra là, e da tutte e due si telefona;
 *   3. gli STATI DEL LEAD non si traducono in stati del preventivo. Sono due
 *      vocabolari diversi e restano due (vedi `incoerenzaDi`).
 *  ───────────────────────────────────────────────────────────────────────── */

import { supabase } from "@/integrations/supabase/client";
import { promoDeadline } from "@/shop/quote-menu";
import { giorniDaOggi, normalizza, oggiIso, soloCifre, type Tono } from "@/crm/ui";
import { STATI_VINTI, type Lead, type LeadStatus } from "@/crm/types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. LA RIGA A DATABASE
   ═════════════════════════════════════════════════════════════════════════ */

export interface Upsell {
  id: string;
  name: string;
  price: number;
}

/** La forma di `quote_requests` letta con `select("*")`.
 *  ⚠️ La tabella NON sta nei tipi generati di Supabase (stessa nota in
 *   api.presenter.quotes.ts). È un'omissione della generazione, non un dato
 *   senza forma: la forma vera è questa, ed è da qui che la legge tutto il
 *   resto della pagina. Come ci si parla è scritto subito sotto. */
export interface RigaPreventivo {
  id: string;
  created_at: string;
  quote_ref: string;
  nome: string;
  cognome: string | null;
  email: string;
  telefono: string;
  eta: number | null;
  grey_pct: number | null;
  color_code: string | null;
  problemi: string | null;
  note: string | null;
  base_choice: string | null;
  upsells: Upsell[] | null;
  discount_code: string | null;
  discount_eur: number;
  total: number;
  status: string;
  qty: number | null;
  fitting_mode: string | null;
  timeline_start: string | null;
  timeline_steps: Record<string, boolean> | null;
}

/* ── COME SI PARLA CON QUESTE DUE TABELLE ──────────────────────────────────
   `quote_requests` e `app_config` NON sono nei tipi generati di Supabase: sono
   nate dopo l'ultima rigenerazione. Finora questa pagina se la cavava con un
   `as never` su ogni scrittura — che non è una scorciatoia innocua: spegne il
   controllo sull'INTERO oggetto scritto, quindi un campo sbagliato o un nome di
   colonna storpiato sarebbe passato senza una parola, e sono colonne che
   contengono importi e scadenze.

   Qui si fa come in routes/CRM.tsx (`dbPreventivi`, con lo stesso commento): si
   descrive la sola catena di chiamate che serve, e i dati restano tipizzati.
   ⚠️ Il giorno in cui i tipi verranno rigenerati, questo blocco si toglie e non
    resta niente da correggere altrove. */

type ErroreDb = { message: string } | null;
type Risposta<T> = PromiseLike<{ data: T; error: ErroreDb }>;

interface TabellaGrezza {
  select(colonne: string): {
    order(
      colonna: string,
      opzioni: { ascending: boolean },
    ): { limit(n: number): Risposta<RigaPreventivo[] | null> };
    eq(
      colonna: string,
      valore: string,
    ): { maybeSingle(): Risposta<{ value?: string | null } | null> };
  };
  update(patch: Record<string, unknown>): {
    eq(colonna: string, valore: string): PromiseLike<{ error: ErroreDb }>;
  };
  upsert(
    riga: Record<string, unknown>,
    opzioni: { onConflict: string },
  ): PromiseLike<{ error: ErroreDb }>;
}

export const dbPreventivi = supabase as unknown as {
  from(tabella: "quote_requests" | "app_config"): TabellaGrezza;
};

/** ── LE MODIFICHE FATTE DOPO ───────────────────────────────────────────────
 *  Il preventivo a database non viene MAI riscritto: quantità aggiornata,
 *  sconto aggiuntivo, condizioni riaperte e note di consulenza vivono a parte,
 *  in `app_config['quote_edit:<REF>']`, e si leggono da
 *  /api/presenter/quote-edit?refs=…
 *
 *  ⚠️ È il pezzo che questa pagina prima IGNORAVA, e non era un dettaglio: se
 *   il consulente ha riaperto le condizioni, l'elenco scriveva «scaduto» a un
 *   cliente che sul suo telefono legge una data valida — e il totale grezzo a
 *   un cliente che ne vede un altro. Due schermate dello stesso preventivo con
 *   due cifre e due date diverse, e da questa si telefona. */
export interface ModificaPreventivo {
  qty?: number;
  extraEur?: number;
  codes?: { code: string; eur: number; label?: string }[];
  promoUntil?: string;
  note?: string;
  notes?: { at: string; by: string; text: string }[];
  by?: string;
  at?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. GLI STATI DEL PREVENTIVO
   ═════════════════════════════════════════════════════════════════════════ */

/** I valori sono quelli scritti a database (minuscoli, con lo spazio): non si
 *  toccano, altrimenti i preventivi già salvati diventerebbero di uno stato che
 *  non esiste. Qui si decidono solo l'etichetta e il TONO, e il tono segue la
 *  stessa regola del resto del CRM: sky = tocca a noi adesso, ambra = manca un
 *  passaggio, emerald = fatto, rose = perso.
 *
 *  ⚠️ QUESTI CINQUE NON SONO I `LeadStatus`, e non vanno mai confusi con loro:
 *   descrivono il DOCUMENTO (è stato mandato? accettato?), non la persona. La
 *   scheda del cliente ha i suoi venti stati, con le tre chiusure vinte e
 *   «Irreperibile». Convertire gli uni negli altri scavalcherebbe
 *   ChiusuraDialog — vedi `incoerenzaDi` più sotto. */
export const STATI: { valore: string; etichetta: string; tono: Tono }[] = [
  { valore: "nuovo", etichetta: "Nuovo", tono: "da_lavorare" },
  { valore: "contattato", etichetta: "Contattato", tono: "in_corso" },
  { valore: "acconto ricevuto", etichetta: "Acconto ricevuto", tono: "in_sospeso" },
  { valore: "confermato", etichetta: "Confermato", tono: "vinta" },
  { valore: "perso", etichetta: "Perso", tono: "persa" },
];

/** ── LO STATO CHE NESSUNO SCEGLIE ──────────────────────────────────────────
 *  «Sostituito» non sta fra i cinque qui sopra ed è voluto: non è una decisione
 *  che si prende dalla tendina, è quello che diventa un preventivo quando il
 *  consulente lo modifica e ne nasce uno nuovo al suo posto
 *  (api.presenter.quote-revise). Metterlo fra le voci scegliibili vorrebbe dire
 *  permettere di dichiarare morto a mano un documento che nessuno ha
 *  sostituito, e il cui link continuerebbe ad aprirsi.
 *  L'etichetta invece serve, perché la riga a schermo c'è: senza, in tabella
 *  resterebbe la parola grezza del database. */
export const SOSTITUITO = "sostituito";
const ALTRI_STATI: { valore: string; etichetta: string; tono: Tono }[] = [
  { valore: SOSTITUITO, etichetta: "Sostituito", tono: "neutro" },
];

export const perStato = (v: string) =>
  STATI.find((s) => s.valore === v) ?? ALTRI_STATI.find((s) => s.valore === v);

/** Accettato = il cliente ha detto sì con i soldi. Da qui in poi la scadenza
 *  del prezzo non conta più: non c'è niente da rincorrere. */
export const ACCETTATI = new Set(["acconto ricevuto", "confermato"]);
/** Chiusi = accettati + persi + sostituiti: escono dalla coda delle scadenze.
 *  Un preventivo sostituito non ha più una scadenza da rincorrere — quella è
 *  passata a quello che ha preso il suo posto, ed è là che si telefona. */
export const CHIUSI = new Set([...ACCETTATI, "perso", SOSTITUITO]);

/** I passaggi del percorso mostrati al cliente su /percorso.
 *  Le chiavi sono le stesse che legge quella pagina (`percorso.tsx` →
 *  `timeline_steps`): rinominarne una qui significherebbe spuntare un passaggio
 *  che il cliente non vedrà mai spuntato. */
export const PASSAGGI: [string, string][] = [
  ["selfie", "Selfie"],
  ["video", "Video 360°"],
  ["colore", "Analisi colore"],
  ["produzione", "Produzione"],
  ["installazione", "Installazione"],
];

/* ═══════════════════════════════════════════════════════════════════════════
   3. QUANTO VALE E FINO A QUANDO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL TOTALE VERO ────────────────────────────────────────────────────────
 *  ⚠️ È la formula IDENTICA a `totaleDi` di shop/QuotesPanel.tsx, riga per
 *   riga, e deve restarlo: le due schermate mostrano gli stessi preventivi e
 *   chi telefona guarda ora l'una ora l'altra. Se un domani quella cambia,
 *   cambia anche questa — il grep è «perUnita».
 *
 *  ⚠️ E NON È ESATTA AL CENTESIMO IN DUE CASI.
 *   Il conto che vede il CLIENTE (`withEdit` in routes/preventivo.tsx) parte da
 *   `gross`, dal prezzo dell'analisi in sede e dalla tabella degli sconti
 *   quantità: tre valori che in `quote_requests` NON ci sono. Quindi qui non si
 *   inventa un terzo totale: si applica quel che si può (quantità e sconto del
 *   consulente) e, quando il conto non può tornare, la cifra si dichiara
 *   APPROSSIMATA a schermo (vedi `totaleApprossimato`). Una cifra marcata come
 *   incerta si va a controllare; una cifra sbagliata e sicura si dice al
 *   telefono. */
export function totaleDi(q: RigaPreventivo, e?: ModificaPreventivo | null): number {
  const qta = e?.qty ?? q.qty ?? 1;
  const perUnita = (Number(q.total) || 0) / Math.max(1, q.qty || 1);
  return Math.max(0, perUnita * qta - (Number(e?.extraEur) || 0));
}

/** ── QUANDO LA CIFRA QUI SOPRA NON È QUELLA DEL PREVENTIVO VERO ────────────
 *  Due casi, e il secondo era dichiarato certo mentre non lo è:
 *
 *   1. CODICE SCONTO AGGIUNTO DOPO. Il valore è nella tabella dei codici, non
 *      in `quote_requests`: da qui non lo si sa togliere.
 *
 *   2. QUANTITÀ CAMBIATA DAL CONSULENTE. Qui si moltiplica per la quantità
 *      TUTTO il per-unità ricavato da `total` — compreso il costo dell'analisi
 *      nel nostro centro (`fitting_mode: "sede"`, €95), che si paga UNA volta
 *      e non una per impianto: `withEdit` lo tiene fuori dalla moltiplicazione
 *      (`const fisso = prev.fittingPrice`), qui non lo si può separare perché
 *      il prezzo dell'opzione non sta nella riga. In più `withEdit` RIFÀ lo
 *      sconto quantità dalla sua tabella, che da qui non si legge. Risultato:
 *      su un preventivo passato da 1 a 2 impianti con analisi in sede questa
 *      pagina diceva una cifra e il telefono del cliente ne diceva un'altra,
 *      senza un segno che invitasse a controllare.
 *
 *  ⚠️ Il rimedio è il segno «≈», non un secondo conto: correggere `totaleDi`
 *   qui lo farebbe divergere da `totaleDi` di shop/QuotesPanel.tsx, e le due
 *   schermate mostrano gli stessi preventivi a chi telefona. La cifra esatta
 *   sta su una pagina sola — quella del preventivo — e il segno ci manda. */
export const totaleApprossimato = (q: RigaPreventivo, e?: ModificaPreventivo | null): boolean => {
  if ((e?.codes?.length ?? 0) > 0) return true;
  return typeof e?.qty === "number" && e.qty !== (q.qty ?? 1);
};

/** Fino a quando valgono le condizioni. La data RIAPERTA dal consulente vince
 *  su quella calcolata alla creazione: è quella che il cliente ha davanti. */
export function scadenzaDi(q: RigaPreventivo, e?: ModificaPreventivo | null): Date {
  if (e?.promoUntil) {
    const d = new Date(e.promoUntil);
    //  Una data illeggibile in configurazione non deve diventare «scaduto nel
    //  1970»: si torna al conto originale, che è sempre valido.
    if (!Number.isNaN(d.getTime())) return d;
  }
  return promoDeadline(q.created_at);
}

/** Le condizioni sono state riaperte davvero (non è solo la stessa data
 *  riscritta): un'ora di tolleranza copre gli arrotondamenti di fuso. */
export function eRiaperto(q: RigaPreventivo, e?: ModificaPreventivo | null): boolean {
  if (!e?.promoUntil) return false;
  const nuova = new Date(e.promoUntil).getTime();
  if (Number.isNaN(nuova)) return false;
  return Math.abs(nuova - promoDeadline(q.created_at).getTime()) > 36e5;
}

/** La scadenza detta come si dice a voce. «14 ago» costringe a guardare il
 *  calendario; «scade domani» dice già cosa fare. */
export function quandoScade(g: number): string {
  if (Number.isNaN(g)) return "scadenza da controllare";
  if (g < 0) return `scaduto da ${-g} ${-g === 1 ? "giorno" : "giorni"}`;
  if (g === 0) return "scade oggi";
  if (g === 1) return "scade domani";
  return `scade fra ${g} giorni`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. A CHI È INTESTATO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL COGNOME DEI PREVENTIVI VECCHI ──────────────────────────────────────
 *  Il cognome ha la sua colonna dai preventivi v3 in poi. Sui più vecchi era
 *  finito in coda alle note («Cognome: Rossi»): si recupera, così anche
 *  l'archivio storico dice a chi è intestato.
 *  ⚠️ Togliere questa riga fa tornare mezzo archivio «Senza nome», e non se ne
 *   accorge nessuno finché qualcuno non cerca un cliente del 2024. */
export function cognomeDi(q: RigaPreventivo): string {
  const suo = q.cognome?.trim();
  if (suo) return suo;
  return q.note?.startsWith("Cognome:") ? q.note.replace("Cognome:", "").trim() : "";
}

export function intestatarioDi(q: RigaPreventivo): string {
  return [q.nome, cognomeDi(q)].filter(Boolean).join(" ").trim() || "Senza nome";
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. IL FILO CON LA SCHEDA DEL CLIENTE
   ═════════════════════════════════════════════════════════════════════════ */

/** ── COME SI ARRIVA DAL PREVENTIVO AL LEAD ─────────────────────────────────
 *  Su `quote_requests` NON c'è nessun `lead_id`: il filo è dall'altra parte,
 *  sulla scheda, in `lead.data.quoteRef` — lo scrive api.crm.lead-sync quando
 *  il consulente conferma il preventivo o salva una nota.
 *
 *  Due strade, in quest'ordine, e la seconda non è un ripiego di comodo:
 *   1. `quoteRef` esatto (maiuscole normalizzate). È il legame vero;
 *   2. le ULTIME 9 CIFRE del telefono. Serve a tutti i preventivi nati fuori
 *      dalla consulenza — il cliente che compila da solo, il consulente che
 *      apre /preventivo a mano — dove `quoteRef` non è mai stato scritto su
 *      nessuna scheda. È lo stesso confronto che fa già la ricerca globale
 *      (`apriPreventivo` in routes/CRM.tsx): nove cifre saltano prefissi e
 *      spazi senza confondere due numeri diversi.
 *
 *  ⚠️ Un telefono può stare su PIÙ schede (stesso numero di famiglia, doppioni
 *   di import). In quel caso si preferisce chi ha già un `quoteRef`, poi la
 *   scheda aggiornata più di recente: agganciare la scheda sbagliata vuol dire
 *   guardare lo stato di un'altra persona. Quando i candidati restano più di
 *   uno il dubbio si dichiara (`incerto`), invece di sceglierne uno a caso. */
export interface AggancioLead {
  lead: Lead;
  /** come è stato trovato: cambia quanto ci si può fidare */
  via: "riferimento" | "telefono";
  /** più schede con lo stesso numero: si mostra, ma si dice che è un'ipotesi */
  incerto: boolean;
}

export interface IndiceLead {
  perRiferimento: Map<string, Lead>;
  perCifre: Map<string, Lead[]>;
}

export function indicizzaLead(leads: Lead[] | null | undefined): IndiceLead {
  const perRiferimento = new Map<string, Lead>();
  const perCifre = new Map<string, Lead[]>();
  for (const l of leads ?? []) {
    const d = l?.data;
    if (!d) continue;
    const rif = String(d.quoteRef ?? "")
      .trim()
      .toUpperCase();
    //  Il primo che si presenta vince: se due schede dichiarano lo stesso
    //  preventivo una delle due è un doppione, e sceglierne una a rotazione
    //  farebbe «ballare» lo stato del cliente a ogni ricarica.
    if (rif && !perRiferimento.has(rif)) perRiferimento.set(rif, l);
    const cifre = soloCifre(d.telefono).slice(-9);
    if (cifre.length >= 6) {
      const gruppo = perCifre.get(cifre);
      if (gruppo) gruppo.push(l);
      else perCifre.set(cifre, [l]);
    }
  }
  return { perRiferimento, perCifre };
}

export function agganciaLead(q: RigaPreventivo, indice: IndiceLead): AggancioLead | null {
  const rif = (q.quote_ref || "").trim().toUpperCase();
  const diretto = rif ? indice.perRiferimento.get(rif) : undefined;
  if (diretto) return { lead: diretto, via: "riferimento", incerto: false };

  const cifre = soloCifre(q.telefono).slice(-9);
  if (cifre.length < 6) return null;
  const gruppo = indice.perCifre.get(cifre);
  if (!gruppo || gruppo.length === 0) return null;
  //  Prima chi ha già un preventivo collegato (è la scheda «viva» di quel
  //  numero), poi la più recente.
  const ordinati = [...gruppo].sort((a, b) => {
    const ra = a.data?.quoteRef ? 1 : 0;
    const rb = b.data?.quoteRef ? 1 : 0;
    if (ra !== rb) return rb - ra;
    return String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
  });
  return { lead: ordinati[0], via: "telefono", incerto: gruppo.length > 1 };
}

/** ── I PREVENTIVI DI UNA PERSONA ───────────────────────────────────────────
 *  Due domande in una: il riferimento dichiarato sulla scheda e il numero di
 *  telefono. Stava dentro il pannello della scheda (crm/preventivi/DelLead);
 *  adesso lo legge anche la finestra della fattura, e due letture diverse
 *  della stessa domanda sono due risposte diverse sullo stesso cliente.
 *  ⚠️ Si chiede a database e non si filtra in memoria: l'elenco completo dei
 *   preventivi, dentro le trattative, non c'è. */
export async function leggiPreventiviDelLead(
  lead: Lead | null | undefined,
  max = 10,
): Promise<RigaPreventivo[]> {
  const rif = String(lead?.data?.quoteRef ?? "").trim().toUpperCase();
  const cifre = soloCifre(lead?.data?.telefono).slice(-9);
  if (!rif && cifre.length < 6) return [];
  const { data } = await dbPreventivi
    .from("quote_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(400);
  return ((data ?? []) as RigaPreventivo[])
    .filter((q) => {
      if (rif && String(q.quote_ref ?? "").trim().toUpperCase() === rif) return true;
      //  ⚠️ Senza abbastanza cifre non si aggancia NIENTE: con quattro cifre in
      //   comune si attribuirebbe a questo cliente mezzo archivio.
      return cifre.length >= 6 && soloCifre(q.telefono).slice(-9) === cifre;
    })
    .slice(0, max);
}

/** ── QUALE PREVENTIVO CITA LA FATTURA ──────────────────────────────────────
 *
 *  Misurato in archivio: su 71 preventivi solo 19 hanno il legame dichiarato
 *  (`quoteRef` sulla scheda). La finestra della fattura guardava SOLO quel
 *  campo, quindi per tre preventivi su quattro la fattura usciva **senza il
 *  numero del preventivo** — e da lì in poi niente lega più il bonifico del
 *  cliente al documento commerciale: è esattamente il filo che la causale
 *  serve a tenere.
 *
 *  L'elenco dei preventivi se la cavava già, perché ripiega sulle ultime nove
 *  cifre del telefono. Qui si usa la stessa regola, in un posto solo, e si
 *  dice anche COME si è arrivati al preventivo — perché una fattura che cita
 *  il documento sbagliato è peggio di una senza numero, e chi la emette deve
 *  poter cambiare la scelta.
 *
 *  ⚠️ I SOSTITUITI SI SCARTANO: un preventivo rifatto non è più il documento
 *   di quella trattativa, e citarlo vorrebbe dire mandare il cliente a un
 *   prezzo che non vale più. Se restano solo sostituiti si prende comunque il
 *   più recente — meglio un numero vecchio che nessun numero.
 *  ⚠️ NON SI INDOVINA QUANDO NON SI SA: senza riferimento e senza telefono
 *   utile non si cita niente, come oggi. */
export interface PreventivoCitato {
  q: RigaPreventivo;
  /** `riferimento` = legame dichiarato sulla scheda · `telefono` = ipotesi. */
  via: "riferimento" | "telefono";
  /** Quanti altri preventivi di questa persona ci sono: se più d'uno, chi
   *  emette deve poter scegliere. */
  quanti: number;
}

export function preventivoDaCitare(
  lead: Lead | null | undefined,
  righe: RigaPreventivo[] | null | undefined,
): PreventivoCitato | null {
  const tutte = (righe ?? []).filter(Boolean);
  if (!tutte.length) return null;
  const rif = String(lead?.data?.quoteRef ?? "").trim().toUpperCase();
  const suo = rif ? tutte.find((q) => String(q.quote_ref ?? "").trim().toUpperCase() === rif) : undefined;
  if (suo) return { q: suo, via: "riferimento", quanti: tutte.length };
  const cifre = soloCifre(lead?.data?.telefono).slice(-9);
  if (cifre.length < 6) return null;
  const perTelefono = tutte
    .filter((q) => soloCifre(q.telefono).slice(-9) === cifre)
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  if (!perTelefono.length) return null;
  const vivi = perTelefono.filter((q) => String(q.status ?? "") !== SOSTITUITO);
  return { q: (vivi[0] ?? perTelefono[0]), via: "telefono", quanti: perTelefono.length };
}

/** ── QUANDO LE DUE VERITÀ NON COINCIDONO ───────────────────────────────────
 *  Il preventivo dice «Confermato» e la scheda è ancora «In valutazione», o il
 *  contrario. Qui si RESTITUISCE LA FRASE, non si sistema niente.
 *
 *  ⚠️ E non è pigrizia. Riscrivere il `LeadStatus` da un menu a cinque voci
 *   scavalcherebbe ChiusuraDialog, che le tre chiusure vinte le scrive INSIEME
 *   all'acconto e al modo di consegna in un salvataggio solo: uno stato scritto
 *   qui e i soldi scritti dopo sono un lead verde con la cassa vuota. Si mostra
 *   l'incoerenza — e accanto c'è la pastiglia con cui sistemarla passando dalla
 *   finestra giusta. */
const VINTI = new Set<string>(STATI_VINTI as string[]);

/** La scheda risulta già venduta. Si legge da `STATI_VINTI` (types.ts) e non da
 *  un elenco scritto qui: le chiusure vinte sono tre più i due stati storici, e
 *  il giorno che diventino quattro questa riga non va ritrovata. */
export const eLeadVinto = (lead: Lead | null | undefined): boolean =>
  !!lead?.data?.stato && VINTI.has(lead.data.stato);

export function incoerenzaDi(statoPreventivo: string, lead: Lead | null): string | null {
  const statoLead = lead?.data?.stato as LeadStatus | undefined;
  if (!statoLead) return null;
  const preventivoOk = ACCETTATI.has(statoPreventivo);
  const schedaOk = VINTI.has(statoLead);
  if (preventivoOk && !schedaOk)
    return "Il preventivo risulta accettato ma la scheda del cliente no: la vendita non è ancora registrata.";
  if (schedaOk && !preventivoOk)
    return "La scheda del cliente risulta venduta ma questo preventivo no: se è quello giusto, segnalo accettato.";
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. LA VOCE — il preventivo già deciso
   ═════════════════════════════════════════════════════════════════════════ */

export interface Voce {
  q: RigaPreventivo;
  edit: ModificaPreventivo | null;
  intestatario: string;
  cognome: string;
  autoreId: string;
  autore: string;
  /** il totale da mostrare: quello ricostruito con le modifiche */
  totale: number;
  /** il totale a database, se diverso da quello sopra (si mostra barrato) */
  totaleOriginale: number | null;
  approssimato: boolean;
  scadenzaIso: string;
  /** la scadenza di partenza, quando le condizioni sono state riaperte */
  scadenzaOriginaleIso: string | null;
  /** giorni alla scadenza: negativo = già scaduto, NaN = data illeggibile */
  giorni: number;
  accettato: boolean;
  chiuso: boolean;
  /** più piccolo = più in alto: chi scade, chi è scaduto, chi non aspetta più */
  fascia: number;
  aggancio: AggancioLead | null;
  incoerenza: string | null;
  cerca: string;
  cifre: string;
}

export function costruisciVoce(
  q: RigaPreventivo,
  proprietari: Record<string, { id: string; nome: string }>,
  modifiche: Record<string, ModificaPreventivo>,
  indice: IndiceLead,
): Voce {
  const ref = (q.quote_ref || "").toUpperCase();
  const p = proprietari[ref];
  const edit = modifiche[ref] ?? null;
  const cognome = cognomeDi(q);
  const intestatario = [q.nome, cognome].filter(Boolean).join(" ").trim() || "Senza nome";

  const totale = totaleDi(q, edit);
  const grezzo = Number(q.total) || 0;
  const scadenza = scadenzaDi(q, edit);
  const riaperto = eRiaperto(q, edit);
  const scadenzaIso = oggiIso(scadenza);
  const accettato = ACCETTATI.has(q.status);
  const chiuso = CHIUSI.has(q.status);
  const giorni = giorniDaOggi(scadenzaIso);
  const aggancio = agganciaLead(q, indice);

  return {
    q,
    edit,
    intestatario,
    cognome,
    autoreId: p?.id || "",
    autore: p?.nome || "",
    totale,
    totaleOriginale: Math.abs(totale - grezzo) > 0.005 ? grezzo : null,
    approssimato: totaleApprossimato(q, edit),
    scadenzaIso,
    scadenzaOriginaleIso: riaperto ? oggiIso(promoDeadline(q.created_at)) : null,
    giorni,
    accettato,
    chiuso,
    //  Tre fasce, nell'ordine in cui si lavora: chi scade, chi è scaduto (si
    //  può ancora rifare l'offerta), chi non aspetta più nulla.
    //  ⚠️ Una data illeggibile (NaN) NON è «scaduta»: finirebbe in cima alla
    //   coda del lavoro senza esserci. Sta con chi ha ancora tempo.
    fascia: chiuso ? 2 : giorni < 0 ? 1 : 0,
    aggancio,
    incoerenza: incoerenzaDi(q.status, aggancio?.lead ?? null),
    cerca: normalizza(`${intestatario} ${q.email ?? ""} ${ref} ${q.base_choice ?? ""}`),
    cifre: soloCifre(q.telefono),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. LE VISTE
   ═════════════════════════════════════════════════════════════════════════ */

export const VISTE = [
  { chiave: "tutti", etichetta: "Tutti", titolo: "Tutti i preventivi dell'archivio" },
  {
    chiave: "scadenza",
    etichetta: "In scadenza",
    titolo: "Il prezzo scade entro due giorni: sono le telefonate di oggi",
  },
  {
    chiave: "scaduti",
    etichetta: "Scaduti",
    titolo: "Il prezzo non è più valido: si rifà l'offerta o si riaprono le condizioni",
  },
  {
    chiave: "accettati",
    etichetta: "Accettati",
    titolo: "Acconto ricevuto o confermato",
  },
] as const;

export type Vista = (typeof VISTE)[number]["chiave"];

/** Quanti giorni prima si comincia a chiamare. Due: sotto, il cliente non ha
 *  materialmente il tempo di disporre un bonifico. */
export const GIORNI_IN_SCADENZA = 2;

export function inVista(v: Voce, vista: Vista): boolean {
  if (vista === "scadenza") return !v.chiuso && v.giorni >= 0 && v.giorni <= GIORNI_IN_SCADENZA;
  if (vista === "scaduti") return !v.chiuso && v.giorni < 0;
  if (vista === "accettati") return v.accettato;
  return true;
}
