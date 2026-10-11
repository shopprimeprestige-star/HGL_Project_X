/** ── PIÙ PERSONE NELLA STESSA CONSULENZA ───────────────────────────────────
 *
 *  Richiesta del committente: «gli slot dove aggiungo più persone in un'unica
 *  consulenza, il link che genera lo genera uguale per tutti e 3 e tutti e 3
 *  hanno accesso». E, sul comportamento generale: «se entra solo 1 rimane così
 *  com'è».
 *
 *  ── COM'ERA ──────────────────────────────────────────────────────────────
 *  La stanza nasce dalla coppia lead + consulente (crm/stanza-consulenza): tre
 *  persone prenotate nella stessa ora sono tre lead, quindi tre stanze e tre
 *  link diversi. Entravano in tre consulenze separate, il consulente ne
 *  conduceva una sola, e gli altri due restavano in una stanza vuota.
 *
 *  ── LA REGOLA ────────────────────────────────────────────────────────────
 *  Stesso consulente + stesso momento = **stessa consulenza**, quindi stessa
 *  stanza e stesso link. La fascia oraria è già il modo in cui il CRM permette
 *  di mettere più persone insieme (crm/capienza): qui si fa solo in modo che
 *  quella decisione arrivi fino al link.
 *
 *  ⚠️ IL LINK GIÀ MANDATO VINCE SU TUTTO. Se un lead ha già una stanza, quella
 *   resta la sua: è l'unica cosa che il cliente ha in mano, ed è già partita
 *   per WhatsApp. Il raggruppamento vale per chi una stanza non ce l'ha
 *   ancora. Questa regola non è negoziabile — violarla è il guasto peggiore
 *   che questo programma abbia avuto (vedi crm/stanza-consulenza).
 *  ⚠️ SENZA UN ORARIO NON SI RAGGRUPPA: una consulenza aperta al volo, senza
 *   appuntamento, non ha una fascia a cui appartenere. Raggruppare «tutte
 *   quelle senza orario» vorrebbe dire mettere nella stessa stanza due clienti
 *   che non si conoscono.
 *  ⚠️ E NON SI RAGGRUPPANO CONSULENTI DIVERSI: due colleghi alla stessa ora
 *   sono due consulenze, come è sempre stato.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Una persona attesa in questa consulenza. Il minimo per riconoscerla
 *  all'ingresso e per scrivere il suo nome sul suo riquadro. */
export interface PersonaAttesa {
  /** L'id della sua scheda: è il legame con il CRM (e con il suo preventivo). */
  leadId: string;
  nome: string;
  cognome?: string;
}

/** La base delle chiavi in `app_config`. */
export const BASE_FASCIA = "fascia";
export const BASE_ATTESI = "attesi";

/** Quante persone al massimo in una consulenza. La capienza delle fasce si
 *  imposta nel CRM (oggi tre); qui c'è solo un tetto di sicurezza, perché
 *  questa lista finisce in una schermata e in una riga di configurazione. */
export const MAX_ATTESI = 8;

const testo = (v: unknown): string => String(v ?? "").trim();

/** ── QUANDO DUE APPUNTAMENTI SONO LA STESSA CONSULENZA ─────────────────────
 *  L'orario ridotto al MINUTO: due prenotazioni sulla stessa fascia arrivano
 *  con la stessa ora d'inizio, ma i secondi e il modo di scrivere la data
 *  possono differire (`2026-09-30T15:00:00Z` e `2026-09-30T15:00:00.000Z`).
 *  Stringa vuota = non è un orario, e allora non si raggruppa niente. */
export function minutoDi(quando: unknown): string {
  const t = Date.parse(testo(quando));
  if (!Number.isFinite(t)) return "";
  return new Date(Math.floor(t / 60_000) * 60_000).toISOString().slice(0, 16);
}

/** La chiave che dice «quale stanza serve questa fascia». Vuota quando non c'è
 *  niente da raggruppare: senza consulente o senza orario ognuno sta per sé. */
export function chiaveFascia(consultantId: unknown, quando: unknown): string {
  const cid = testo(consultantId).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const min = minutoDi(quando);
  return cid && min ? `${BASE_FASCIA}:${cid}:${min}` : "";
}

/** La chiave dell'elenco di chi è atteso in una stanza. */
export const chiaveAttesi = (code: unknown): string =>
  `${BASE_ATTESI}:${testo(code).toLowerCase().replace(/[^a-z0-9-]/g, "")}`;

/** ── L'ELENCO DEGLI ATTESI ─────────────────────────────────────────────────
 *  Si aggiunge senza doppioni (la stessa scheda può salvare l'appuntamento
 *  dieci volte) e si aggiorna il nome, che nel frattempo può essere stato
 *  corretto sulla scheda.
 *  ⚠️ L'ORDINE È QUELLO DI ARRIVO: è l'ordine in cui il cliente vedrà i nomi
 *   da scegliere, e cambiarlo a ogni salvataggio vorrebbe dire un elenco che
 *   balla sotto le dita di chi sta per toccarlo. */
export function unisciAttesi(
  lista: PersonaAttesa[] | null | undefined,
  persona: PersonaAttesa,
): PersonaAttesa[] {
  const id = testo(persona.leadId);
  if (!id) return [...(lista ?? [])];
  const nome = testo(persona.nome);
  const cognome = testo(persona.cognome);
  const fuori = [...(lista ?? [])];
  const i = fuori.findIndex((p) => testo(p.leadId) === id);
  const voce: PersonaAttesa = { leadId: id, nome: nome || "Cliente", ...(cognome ? { cognome } : {}) };
  if (i >= 0) fuori[i] = voce;
  else fuori.push(voce);
  return fuori.slice(0, MAX_ATTESI);
}

export function leggiAttesi(grezzo?: string | null): PersonaAttesa[] {
  if (!grezzo) return [];
  try {
    const v = JSON.parse(grezzo) as { persone?: unknown };
    const dentro = Array.isArray(v?.persone) ? v.persone : Array.isArray(v) ? v : [];
    const out: PersonaAttesa[] = [];
    for (const x of dentro as Partial<PersonaAttesa>[]) {
      const leadId = testo(x?.leadId);
      if (!leadId) continue;
      out.push({ leadId, nome: testo(x?.nome) || "Cliente", ...(testo(x?.cognome) ? { cognome: testo(x?.cognome) } : {}) });
    }
    return out.slice(0, MAX_ATTESI);
  } catch {
    return [];
  }
}

export const scriviAttesi = (persone: PersonaAttesa[]): string => JSON.stringify({ persone });

/** ── COME SI CHIAMA UNA PERSONA DAVANTI ALLE ALTRE ─────────────────────────
 *  Nella schermata «chi sei?» i tre nomi li leggono tutti e tre. Il nome di
 *  battesimo e l'iniziale bastano a riconoscersi, e non consegnano il cognome
 *  di un cliente a chi gli sta seduto accanto. Al consulente, invece, arriva
 *  il nome intero: è il suo cliente. */
export const nomeBreve = (p: PersonaAttesa): string =>
  `${testo(p.nome)}${testo(p.cognome) ? ` ${testo(p.cognome).charAt(0).toUpperCase()}.` : ""}`.trim();

/** ── IL GETTONE CHE VIAGGIA NEL LINK ───────────────────────────────────────
 *  Chi entra dice «sono io» scegliendo un nome. Quel «io» non può essere l'id
 *  della scheda: finirebbe nell'indirizzo della pagina e nella memoria del
 *  browser di un cliente, ed è la chiave con cui si aprono le sue cose nel
 *  CRM. Qui se ne ricava un gettone corto, stabile e buono SOLO dentro questa
 *  stanza — fuori non apre niente. */
export const gettoneDi = (p: PersonaAttesa): string =>
  `p${testo(p.leadId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase()}`;

/** Chi è, dato il gettone. `null` quando non è di questa stanza. */
export const attesoDalGettone = (
  lista: PersonaAttesa[] | null | undefined,
  gettone: unknown,
): PersonaAttesa | null =>
  (lista ?? []).find((p) => gettoneDi(p) === testo(gettone).toLowerCase()) ?? null;

/** ── UNA PERSONA SOLA: TUTTO COM'ERA ───────────────────────────────────────
 *  È la richiesta esplicita del committente. Con un solo atteso non si chiede
 *  niente a nessuno: si entra con il proprio nome. Con due o più si sceglie.
 *  Con zero (link aperto senza appuntamento) si scrive il nome, come sempre. */
export const consulenzaDiGruppo = (lista: PersonaAttesa[] | null | undefined): boolean =>
  (lista ?? []).length >= 2;

/* ═══════════════════════════════════════════════════════════════════════════
   UNA FASCIA PER UNO SOLO, OPPURE APERTA
   ───────────────────────────────────────────────────────────────────────────
   Richiesta del committente: «quando fisso un appuntamento, se seleziono una
   data posso selezionare se bloccarla per solo quella persona oppure se rimane
   aperta. Quando già assegno una persona aperta a un orario, poi quell'orario
   per tutti gli altri che aggiungo di default è aperto, fino a 3».

   ── PERCHÉ NON BASTAVA LA CAPIENZA ────────────────────────────────────────
   La capienza (crm/booking-utils) è UN numero per tutte le fasce: o tutte
   tengono tre persone, o nessuna. Manca la cosa che si fa davvero in agenda —
   «questa mezz'ora la tengo per lui e basta» — e finora l'unico modo era
   abbassare la capienza a uno per tutti.

   ── DOVE VIVE, E PERCHÉ PROPRIO LÌ ────────────────────────────────────────
   Sulla riga della FASCIA (`fascia:<consulente>:<minuto>`), quella che già
   esiste per tenere insieme le persone della stessa ora.
   ⚠️ NON SULLA SCHEDA DEL LEAD, ed è la scelta che evita il guasto peggiore:
    se il blocco vivesse sul lead, il giorno in cui quell'appuntamento viene
    spostato o cancellato l'ora resterebbe chiusa per sempre, senza nessuno
    dentro e senza nessun modo di capire perché. Sulla fascia, quando l'ultima
    persona se ne va se ne va anche il motivo per cui era chiusa.
   ⚠️ E LA RIGA HA GIÀ UN INQUILINO — `code`, il codice della stanza Meetly —
    che NON si deve perdere: chi scrive il modo rilegge e conserva.

   ── LE PAROLE ─────────────────────────────────────────────────────────────
   «solo» e «aperta», non un booleano `esclusiva`: fra sei mesi `esclusiva:
   false` su una fascia piena si legge male, mentre «aperta» si legge da sola.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ModoFascia = "aperta" | "solo";

/** Il modo scritto nella riga della fascia.
 *  ⚠️ ASSENTE = "aperta", e non è una svista: tutte le fasce nate prima che
 *   questa scelta esistesse tenevano fino alla capienza, e il ripiego deve
 *   lasciare l'agenda esattamente com'era. */
export function leggiModoFascia(valore?: string | null): ModoFascia {
  if (!valore) return "aperta";
  try {
    const j = JSON.parse(valore) as { modo?: unknown } | null;
    return j && j.modo === "solo" ? "solo" : "aperta";
  } catch {
    //  Riga illeggibile: si torna al comportamento di sempre. Una fascia che
    //  non si sa leggere non deve CHIUDERSI da sola — sarebbe un'ora persa
    //  senza che nessuno l'abbia decisa.
    return "aperta";
  }
}

/** Il codice della stanza già scritto nella riga, se c'è. */
export function codiceDellaRiga(valore?: string | null): string {
  if (!valore) return "";
  try {
    return testo((JSON.parse(valore) as { code?: unknown } | null)?.code);
  } catch {
    return "";
  }
}

/** Il nuovo contenuto della riga, conservando quello che c'era.
 *  ⚠️ Si conserva `code`: è il link che i clienti di quella fascia hanno già
 *   in mano, e perderlo vorrebbe dire mandarli in una stanza vuota. */
export function scriviModoFascia(prima: string | null | undefined, modo: ModoFascia): string {
  const code = codiceDellaRiga(prima);
  return JSON.stringify({ ...(code ? { code } : {}), modo });
}

/** Quante persone stanno in questa fascia: una se è «solo», altrimenti la
 *  capienza generale. */
export function postiDellaFascia(p: { modo?: ModoFascia; capienza?: number }): number {
  const cap = Math.max(1, Math.round(Number(p.capienza) || 1));
  return p.modo === "solo" ? 1 : cap;
}

/** C'è ancora posto in questa fascia?
 *  ⚠️ RISPONDE SOLO SUL NUMERO, e per questo non la usa più chi disegna gli
 *   orari: «c'è posto» non vuol dire «si può scegliere», perché un'ora può
 *   essere coperta da una consulenza di un ALTRO orario pur avendo posto.
 *   Quella domanda la risponde `statoDellaFascia` qui sotto. Questa resta per
 *   chi deve sapere solo se il contatore è arrivato in fondo. */
export function fasciaLibera(p: {
  presi?: number;
  modo?: ModoFascia;
  capienza?: number;
  inPausa?: boolean;
}): boolean {
  if (p.inPausa) return false;
  return (Number(p.presi) || 0) < postiDellaFascia(p);
}

/** ── SI PUÒ ANCORA CHIUDERLA? ─────────────────────────────────────────────
 *  Chiudere una fascia dove c'è già più di una persona vorrebbe dire buttare
 *  fuori qualcuno che ha già il link in mano: non si fa. Aprirla invece si può
 *  sempre — non toglie niente a nessuno. */
export function siPuoChiudere(presi?: number): boolean {
  return (Number(presi) || 0) <= 1;
}

/** ── LA SPUNTA «SOLO UNA PERSONA», DOVUNQUE SI FISSI UN APPUNTAMENTO ───────
 *
 *  Richiesta del committente: «quando importo lead mi dà solo l'opzione di 3
 *  persone su quello slot; invece deve esserci una spunta che, cliccandola,
 *  blocca quello slot per una persona sola. E mettilo in tutto il CRM».
 *
 *  La regola c'era già — una fascia può essere «solo» o «aperta», e il server
 *  la fa rispettare anche al cliente che si prenota dal link pubblico — ma si
 *  poteva dire soltanto dalla scheda del cliente: da tutte le altre schermate
 *  che fissano un appuntamento (la coda dei lead importati, l'agenda, il
 *  cambio di stato veloce) quell'ora restava aperta fino a tre, e nessuno
 *  poteva dire altrimenti.
 *
 *  Qui c'è la sola decisione che la spunta deve prendere, scritta una volta per
 *  tutte le schermate: com'è messa, se si può toccare, e che cosa dire se non
 *  si può.
 *
 *  ⚠️ CON DUE PERSONE DENTRO NON SI CHIUDE PIÙ. Chiudere vorrebbe dire buttare
 *   fuori qualcuno che ha già il link in mano (`siPuoChiudere`): la spunta si
 *   spegne e DICE PERCHÉ, invece di non fare niente quando la si preme.
 *  ⚠️ CON UNA PERSONA SOLA SI PUÒ ANCORA: è il caso vero — fisso
 *   l'appuntamento e nello stesso gesto decido che quell'ora è sua.
 *  ⚠️ APRIRE SI PUÒ SEMPRE: togliere la spunta non toglie niente a nessuno. */
export interface SpuntaSoloUno {
  /** La spunta è messa: quell'ora è tenuta per una persona sola. */
  spuntata: boolean;
  /** Si può cambiare? */
  attiva: boolean;
  /** Quanti posti ha quell'ora adesso: 1 se è chiusa, la capienza se è aperta. */
  posti: number;
  /** Che cosa si legge accanto alla spunta. */
  nota: string;
}

export function spuntaSoloUno(p: {
  modo?: ModoFascia;
  presi?: number;
  capienza?: number;
}): SpuntaSoloUno {
  const presi = Math.max(0, Number(p.presi) || 0);
  const capienza = Math.max(1, Math.round(Number(p.capienza) || 1));
  const spuntata = p.modo === "solo";
  const posti = postiDellaFascia({ modo: p.modo, capienza });
  //  Si può sempre RIAPRIRE: il divieto riguarda solo il chiudere.
  const attiva = spuntata || siPuoChiudere(presi);
  if (!attiva)
    return {
      spuntata,
      attiva,
      posti,
      nota: `In quest'ora ci sono già ${presi} persone: non si può più tenere per una sola.`,
    };
  if (spuntata)
    return {
      spuntata,
      attiva,
      posti,
      nota: "Quest'ora è sua: nessun altro ci si può prenotare, neanche dal link pubblico.",
    };
  return {
    spuntata,
    attiva,
    posti,
    nota: `Quest'ora resta aperta: ci si possono aggiungere altre persone, fino a ${capienza}.`,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   COM'È MESSA QUESTA MEZZ'ORA — quattro risposte, non due
   ───────────────────────────────────────────────────────────────────────────
   Segnalazione del committente: «quando devo spostare una consulenza mi dà
   disponibilità che sono già occupate, e non mi dà gli slot 1/3 2/3 sugli
   orari. Se uno slot — esempio 9:45 — è occupato ed è 1/3, le 10:00 non devono
   essere disponibili a prescindere: l'orario lo deve dare ma sbarrato, non
   cliccabile».

   ⚠️ IL CUORE: «INSIEME» NON VUOL DIRE «NELLO STESSO MOMENTO».
   Due persone finiscono nella STESSA consulenza — stessa stanza, stesso link —
   solo se hanno lo stesso consulente e **lo stesso minuto di inizio**: è così
   che nasce la chiave `fascia:<consulente>:<minuto>` e il link condiviso.
   Il conto di prima invece contava chiunque si SOVRAPPONESSE: le 10:00, che si
   accavallano alla consulenza delle 9:45, risultavano «1/3, c'è ancora posto».
   Ma prenotandole non si aggiunge una persona a quella consulenza: se ne crea
   una SECONDA, sovrapposta, con un altro link — e alle 10:00 il consulente è
   già impegnato. Da fuori: «mi dà disponibilità già occupate».

   Perciò le risposte sono quattro:
    · `libero`  → non c'è nessuno: si sceglie;
    · `insieme` → c'è qualcuno ALLA STESSA ORA e la fascia è aperta: si sceglie
      sapendo con chi (è l'arancione, il «1/3»);
    · `pieno`   → la fascia è piena, o è tenuta per una persona sola ed è già
      presa: rosso, non si sceglie;
    · `coperto` → c'è una consulenza di un ALTRO orario che ci passa sopra (o è
      una pausa, o un impegno esclusivo): si mostra sbarrato e non si sceglie.
   ⚠️ Sbarrato e non nascosto, ed è una richiesta esplicita: un'ora che sparisce
    dall'elenco fa venire il dubbio che manchi per un errore del programma.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StatoSlot = "libero" | "insieme" | "pieno" | "coperto";

/** Un impegno già preso, in minuti dalla mezzanotte. */
export interface ImpegnoPreso {
  da: number;
  a: number;
  chi?: string;
  /** false = impegno ESCLUSIVO (posa, ritorno, visita): copre e basta. */
  consulenza?: boolean;
}

export interface EsitoSlot {
  stato: StatoSlot;
  /** Quante consulenze ci sono in questa fascia, alla STESSA ora. */
  presi: number;
  /** Quante ce ne stanno: la capienza, o 1 se la fascia è tenuta per uno solo. */
  posti: number;
  /** Con chi si sarebbe insieme, o chi copre l'orario. */
  chi?: string;
  /** Fino a quando è occupato (minuti dalla mezzanotte), per dire «fino alle». */
  fino?: number;
  /** L'ora d'inizio di ciò che copre: serve alla frase «coperto da quella delle 9:45». */
  copertoDa?: number;
}

export function statoDellaFascia(p: {
  /** Inizio della mezz'ora che si sta valutando (minuti dalla mezzanotte). */
  inizio: number;
  durata: number;
  occupati?: ImpegnoPreso[] | null;
  modo?: ModoFascia;
  capienza?: number;
  inPausa?: boolean;
}): EsitoSlot {
  const posti = postiDellaFascia({ modo: p.modo, capienza: p.capienza });
  const fine = p.inizio + Math.max(1, Number(p.durata) || 1);
  if (p.inPausa) return { stato: "coperto", presi: 0, posti };

  let presi = 0;
  let chiInsieme: string | undefined;
  let fineMax = 0;
  //  Il primo che copre da un'altra ora: è quello di cui si scrive il perché.
  let copre: ImpegnoPreso | undefined;

  for (const o of p.occupati ?? []) {
    if (!(p.inizio < o.a && fine > o.da)) continue; // non si tocca: non conta
    //  ⚠️ Un impegno esclusivo (posa, ritorno, visita in sede) non si somma e
    //   non si condivide: copre, punto. Non c'è capienza che tenga.
    if (o.consulenza === false) {
      if (!copre || o.da < copre.da) copre = o;
      continue;
    }
    if (o.da === p.inizio) {
      //  Stessa ora: è gente con cui si sta INSIEME, e si conta.
      presi += 1;
      if (o.a > fineMax) fineMax = o.a;
      if (!chiInsieme) chiInsieme = o.chi;
    } else if (!copre || o.da < copre.da) {
      //  Ora diversa ma sovrapposta: copre. Non si somma e non si sceglie.
      copre = o;
    }
  }

  if (copre) return { stato: "coperto", presi, posti, chi: copre.chi, fino: copre.a, copertoDa: copre.da };
  if (presi === 0) return { stato: "libero", presi: 0, posti };
  if (presi >= posti) return { stato: "pieno", presi, posti, chi: chiInsieme, fino: fineMax || undefined };
  return { stato: "insieme", presi, posti, chi: chiInsieme, fino: fineMax || undefined };
}

/** Si può scegliere questa mezz'ora? Una riga, perché la domanda si fa ovunque
 *  e la risposta deve essere la stessa in tutte le schermate. */
export const slotScegliibile = (e: EsitoSlot): boolean =>
  e.stato === "libero" || e.stato === "insieme";
