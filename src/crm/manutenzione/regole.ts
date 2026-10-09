/** ─────────────────────────────────────────────────────────────────────────
 *  LE REGOLE DELLA MANUTENZIONE — ogni quanto torna, e a che punto è
 *
 *  PERCHÉ ESISTE UN FILE SOLO DI REGOLE
 *  Le stesse tre domande si fanno in quattro posti diversi — la procedura
 *  guidata, il segno sulla riga, la lente delle installazioni, la giornata del
 *  tecnico — e sono: «quando torna?», «è in ritardo?», «quale delle sue
 *  manutenzioni sto guardando?». Rispondere in ognuno di quei posti significa
 *  quattro risposte che un giorno divergono, e la divergenza qui è cara: una
 *  pagina dice che il cliente è a posto e un'altra che è indietro di due
 *  settimane. Qui non c'è React, non ci sono scritture, non c'è niente da
 *  montare: solo funzioni pure che si possono leggere tutte insieme.
 *
 *  ⚠️ QUESTO FILE NON TOCCA booking-utils.ts E NON LO SOSTITUISCE.
 *  Gli orari liberi li calcola sempre e solo `booking-utils`, con le sue regole
 *  (giorni lavorativi, fasce, pause, indisponibilità, impegni presi, tempo per
 *  la strada) — e da lì passano anche le manutenzioni: `getBusyIntervals` e
 *  `indicizzaOccupato` leggono `manutenzioniDi` di questo file e tolgono l'ora di
 *  ogni ritorno FISSATO dall'agenda di chi lo esegue. Qui non c'è nessun
 *  secondo calcolo degli slot: c'era, come toppa dichiarata, finché di là
 *  mancava la riga, ed è stato cancellato appena la riga è arrivata.
 *  ───────────────────────────────────────────────────────────────────────── */

import type {
  AppuntamentoManutenzione,
  Lead,
  LeadData,
  ManutenzioneInfo,
  OrigineManutenzione,
  StatoManutenzione,
  TipoManutenzione,
} from "../types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. OGNI QUANTO — la cadenza, che il progetto aveva già scritto altrove
   ═════════════════════════════════════════════════════════════════════════ */

/** ── LE TRE CADENZE, E DA DOVE VENGONO ────────────────────────────────────
 *  Non sono inventate: routes/slide.tsx lo dice al cliente in consulenza —
 *  «ogni due o quattro settimane si rifissa», quindici giorni per chi ha il
 *  sudore acido, trenta per tutti gli altri — e la FAQ pubblica traduce la
 *  stessa cosa in «circa una volta al mese». Quindi gli estremi sono 15 e 30, e
 *  in mezzo c'è il caso che in consulenza si sente più spesso (tre settimane).
 *  Tre voci e non un campo libero: chi ha appena finito una posa e ha il cliente
 *  davanti deve toccare una pastiglia, non scrivere un numero — e un numero
 *  scritto a mano finisce prima o poi per essere 7 o 90, cioè non una cadenza
 *  ma un errore di battitura che nessuno ricontrolla. */
export const CADENZE_GIORNI = [15, 21, 30] as const;

/** ── PERCHÉ TRENTA E NON QUINDICI ─────────────────────────────────────────
 *  È il valore che il progetto dichiara al cliente («circa una volta al mese»),
 *  ed è anche il meno invadente: chi ha bisogno di tornare ogni due settimane lo
 *  sa già — glielo abbiamo spiegato in consulenza, si riconosce dal sudore — e
 *  chi lo sa lo cambia con un tocco. Partire da quindici avrebbe invece fissato
 *  a tutti il doppio degli appuntamenti, cioè avrebbe riempito l'agenda con una
 *  scelta che nessuno ha fatto. */
export const CADENZA_PREDEFINITA = 30;

/** Quanto dura una manutenzione, in minuti.
 *  È lo stesso valore di ripiego che booking-utils usa per una posa senza durata
 *  dichiarata, ed è una domanda IN MENO nella procedura: chi la fissa ha il
 *  cliente davanti e non deve scegliere anche i minuti. Se un giorno servisse
 *  distinguerle, il campo per farlo c'è già (AppuntamentoManutenzione.durata) e
 *  qui resta solo il valore di partenza. */
export const DURATA_MANUTENZIONE = 60;

/** Quanti giorni prima una manutenzione si considera «in arrivo».
 *  Una settimana: è il tempo che serve a chiamare il cliente e trovargli un
 *  posto senza fargli fretta. Più stretto non si fa in tempo, più largo e la
 *  lente si riempie di roba che non si può ancora lavorare. */
export const GIORNI_IN_ARRIVO = 7;

/** ── CICLO O INTERVENTO SINGOLO ───────────────────────────────────────────
 *  L'unica porta da cui si legge questa distinzione. Sta accanto alla cadenza
 *  perché è la domanda che viene PRIMA di essa: se è un intervento singolo, la
 *  cadenza non si chiede, non si scrive e non serve a niente.
 *  ⚠️ Il ripiego è "ciclo" e non "singolo". Tutte le righe scritte prima che
 *   questa scelta esistesse sono nate dentro un ciclo — la procedura chiedeva la
 *   cadenza e basta — quindi è l'unica lettura che non cambia il comportamento
 *   di una sola scheda d'archivio. Con il ripiego opposto, ogni manutenzione già
 *   in elenco smetterebbe di generare la successiva quando la si segna fatta:
 *   un intero parco clienti che esce dal giro senza che nessuno l'abbia deciso e
 *   senza un errore da nessuna parte. */
export function tipoDi(a?: AppuntamentoManutenzione | null): TipoManutenzione {
  return a?.tipo === "singolo" ? "singolo" : "ciclo";
}

/** Vero se, chiudendo questo ritorno, ne deve nascere un altro. È scritto come
 *  domanda e non come `tipo === "ciclo"` sparso nei file: chi legge `azioni.ts`
 *  deve poter capire la conseguenza senza dedurla dal nome di un tipo. */
export function generaIlSuccessivo(a?: AppuntamentoManutenzione | null): boolean {
  return tipoDi(a) === "ciclo";
}

/** La cadenza di QUESTO cliente. Il ripiego non viene mai scritto in scheda:
 *  resta una lettura, così il giorno in cui il valore di partenza cambia non
 *  c'è nessuna riga da correggere in archivio (stessa disciplina dei mestieri
 *  in kpi-setter.ts). */
export function cadenzaDi(d?: Pick<LeadData, "manutenzione"> | null): number {
  const n = Number(d?.manutenzione?.cadenzaGiorni);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : CADENZA_PREDEFINITA;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LE DATE — lette con prudenza, perché arrivano da un JSON
   ═════════════════════════════════════════════════════════════════════════ */

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Oggi in ISO locale.
 *  NON `toISOString()`: lavora in UTC e fino alle 2 di notte italiane
 *  restituisce ieri — una manutenzione di oggi risulterebbe in ritardo proprio
 *  nelle ore in cui si prepara la giornata dopo. È la stessa `giornoISO` del
 *  modulo installazioni, riscritta qui per non far dipendere un file di regole
 *  pure da un file che importa React e sonner. */
export function oggiISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Una data ISO più N giorni. Data illeggibile → "" (non "oggi": una data che
 *  non si sa leggere non è una data, e inventarla sposterebbe un appuntamento
 *  senza che nessuno se ne accorga). */
export function piuGiorni(iso: string, giorni: number): string {
  if (!RE_DATA.test(iso || "")) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + giorni);
  return oggiISO(d);
}

/** Quanti giorni mancano a una data (negativo = è passata). `null` se la data
 *  non si legge: chi chiama deve poter distinguere «non lo so» da «zero». */
export function giorniA(iso: string, da: string = oggiISO()): number | null {
  if (!RE_DATA.test(iso || "") || !RE_DATA.test(da || "")) return null;
  const a = new Date(`${iso}T00:00:00`).getTime();
  const b = new Date(`${da}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

//  Qui NON c'è nessuna conversione «09:30 → minuti»: gli orari li confronta
//  booking-utils, che è l'unico posto in cui si decide se due cose si
//  accavallano. Ce n'era una, quando le manutenzioni non entravano ancora nel
//  suo conto; è sparita insieme alla toppa.

/* ═══════════════════════════════════════════════════════════════════════════
   3. LEGGERE LO STORICO DI UN CLIENTE
   ═════════════════════════════════════════════════════════════════════════ */

/** Le manutenzioni di un cliente, sempre come elenco leggibile e ordinato per
 *  data (la più vicina prima).
 *  ⚠️ Non si dà per scontato che il campo sia un elenco: arriva da un JSON, e in
 *   questo CRM è già successo che un campo dichiarato `Pausa[]` fosse un oggetto
 *   (vedi `pauseDelGiorno` in booking-utils). Una riga senza `data` viene
 *   scartata: senza giorno non appartiene a nessuna scadenza e farebbe solo
 *   comparire "Invalid Date" in mezzo all'elenco. */
export function manutenzioniDi(
  d?: Pick<LeadData, "manutenzione"> | null,
): AppuntamentoManutenzione[] {
  const grezzo = d?.manutenzione?.appuntamenti as unknown;
  if (!Array.isArray(grezzo)) return [];
  return (grezzo as AppuntamentoManutenzione[])
    .filter((a) => a && typeof a === "object" && RE_DATA.test(String(a.data || "")))
    .slice()
    .sort((a, b) =>
      a.data === b.data
        ? String(a.creataIl || "").localeCompare(String(b.creataIl || ""))
        : a.data < b.data
          ? -1
          : 1,
    );
}

/** Aperta = ancora da onorare. Fatta e saltata sono finite, e la differenza fra
 *  loro conta per lo storico ma non per il lavoro di oggi. */
export function aperta(a: AppuntamentoManutenzione): boolean {
  return a.stato === "da_fissare" || a.stato === "fissata";
}

/** La prossima manutenzione ancora aperta: quella con la data più vicina,
 *  comprese quelle già scadute — un appuntamento di due settimane fa che nessuno
 *  ha chiuso È la prossima cosa da fare per quel cliente, non un pezzo di
 *  archivio. `null` se non ce n'è nessuna. */
export function prossimaManutenzione(
  d?: Pick<LeadData, "manutenzione"> | null,
): AppuntamentoManutenzione | null {
  return manutenzioniDi(d).find(aperta) ?? null;
}

/** Quante ne ha saltate, in tutto. È il numero che dice se un cliente sta
 *  scivolando via: uno che ne salta tre di fila non è un cliente distratto, è un
 *  cliente che stiamo perdendo. */
export function quanteSaltate(d?: Pick<LeadData, "manutenzione"> | null): number {
  return manutenzioniDi(d).filter((a) => a.stato === "saltata").length;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. A CHE PUNTO È — un segnale solo, letto da tutti allo stesso modo
   ═════════════════════════════════════════════════════════════════════════ */

/** ── I SEI MODI IN CUI UNA MANUTENZIONE PUÒ STARE ─────────────────────────
 *  Sono uno solo per riga e si escludono a vicenda, così il colore e la parola
 *  li decide una funzione sola:
 *   · "lontana"    → c'è, ma non è ancora lavoro di questa settimana;
 *   · "in_arrivo"  → entro sette giorni: si chiama il cliente adesso;
 *   · "oggi"       → è oggi;
 *   · "in_ritardo" → il giorno è passato e nessuno l'ha chiusa. NON vuol dire
 *     «saltata»: vuol dire che non sappiamo com'è andata, ed è precisamente la
 *     riga da guardare per prima;
 *   · "fatta" / "saltata" → i due esiti, scritti da una persona. */
export type SegnaleManutenzione =
  | "lontana"
  | "in_arrivo"
  | "oggi"
  | "in_ritardo"
  | "fatta"
  | "saltata";

export function segnaleDi(
  a: AppuntamentoManutenzione,
  oggi: string = oggiISO(),
): SegnaleManutenzione {
  if (a.stato === "fatta") return "fatta";
  if (a.stato === "saltata") return "saltata";
  const mancano = giorniA(a.data, oggi);
  //  Data illeggibile su una riga aperta: si tratta come lavoro da guardare, mai
  //  come "lontana". Nascondere una riga che non si sa leggere è il modo più
  //  veloce di perderla per sempre.
  if (mancano === null) return "in_ritardo";
  if (mancano < 0) return "in_ritardo";
  if (mancano === 0) return "oggi";
  return mancano <= GIORNI_IN_ARRIVO ? "in_arrivo" : "lontana";
}

/** Le parole del segnale. Stanno qui e non nei componenti perché la stessa
 *  manutenzione compare nella lente, nella giornata del tecnico e nel segno
 *  sulla riga: tre frasi diverse per lo stesso stato si leggono come tre stati
 *  diversi. */
export const ETICHETTA_SEGNALE: Record<SegnaleManutenzione, string> = {
  lontana: "In programma",
  in_arrivo: "In arrivo",
  oggi: "Oggi",
  in_ritardo: "In ritardo",
  fatta: "Fatta",
  saltata: "Saltata",
};

/** Serve lavoro adesso? È la regola con cui si contano le pastiglie e si
 *  ordinano gli elenchi: un numero che comprende anche le manutenzioni fra tre
 *  mesi non cala mai, e un numero che non cala mai smette di essere guardato —
 *  è la stessa lezione già imparata sulle lenti delle installazioni. */
export function daSeguire(a: AppuntamentoManutenzione, oggi: string = oggiISO()): boolean {
  const s = segnaleDi(a, oggi);
  return s === "in_ritardo" || s === "oggi" || s === "in_arrivo";
}

/** L'ordine con cui le righe si guardano: prima quello che è già in ritardo,
 *  poi oggi, poi quello che arriva, e in fondo il resto. A parità, la data più
 *  vicina prima. */
const PESO_SEGNALE: Record<SegnaleManutenzione, number> = {
  in_ritardo: 0,
  oggi: 1,
  in_arrivo: 2,
  lontana: 3,
  saltata: 4,
  fatta: 5,
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. LE RIGHE DA MOSTRARE — un cliente, la sua prossima manutenzione
   ═════════════════════════════════════════════════════════════════════════ */

/** Una riga dell'elenco: il cliente e la manutenzione da guardare per lui.
 *  Non è "una manutenzione": è «questo cliente, a che punto sta». Un cliente con
 *  otto ritorni alle spalle deve occupare UNA riga, altrimenti la lente diventa
 *  un registro storico invece che una lista di cose da fare. */
export interface RigaManutenzione {
  lead: Lead;
  appuntamento: AppuntamentoManutenzione;
  segnale: SegnaleManutenzione;
  /** giorni che mancano (negativo = passati), `null` se la data non si legge */
  mancano: number | null;
}

/** Costruisce le righe da un elenco di lead.
 *  `soloDaSeguire` è il taglio della lente: acceso mostra ciò su cui si può
 *  agire adesso (in ritardo, oggi, entro sette giorni), spento mostra tutti i
 *  clienti che hanno un ritorno in programma. */
export function righeManutenzione(
  leads: Lead[],
  { soloDaSeguire = false, oggi = oggiISO() }: { soloDaSeguire?: boolean; oggi?: string } = {},
): RigaManutenzione[] {
  const righe: RigaManutenzione[] = [];
  for (const l of Array.isArray(leads) ? leads : []) {
    //  Scheda arrivata a metà da un'importazione: si salta PRIMA di leggerla.
    //  Una riga senza `data` farebbe morire la pagina intera, ed è già successo.
    if (!l?.data) continue;
    const app = prossimaManutenzione(l.data);
    if (!app) continue;
    const segnale = segnaleDi(app, oggi);
    if (soloDaSeguire && !daSeguire(app, oggi)) continue;
    righe.push({ lead: l, appuntamento: app, segnale, mancano: giorniA(app.data, oggi) });
  }
  return righe.sort((a, b) => {
    const p = PESO_SEGNALE[a.segnale] - PESO_SEGNALE[b.segnale];
    if (p !== 0) return p;
    return a.appuntamento.data < b.appuntamento.data
      ? -1
      : a.appuntamento.data > b.appuntamento.data
        ? 1
        : 0;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. QUANDO CADE LA PROSSIMA
   ═════════════════════════════════════════════════════════════════════════ */

/** Il giorno da cui si conta la cadenza: l'ultimo ritorno davvero avvenuto,
 *  altrimenti il giorno della posa, altrimenti oggi.
 *  ⚠️ Si conta dal ritorno VERO (`fattaIl`) e non da quello previsto: un cliente
 *   che si presenta con quattro giorni di ritardo ha l'impianto rifissato QUEL
 *   giorno, e far partire il conto dalla data promessa gli anticiperebbe tutti i
 *   ritorni successivi di quattro giorni — un errore che si accumula. */
export function ultimoRitorno(d?: Pick<LeadData, "manutenzione" | "installazione"> | null): string {
  const fatte = manutenzioniDi(d).filter((a) => a.stato === "fatta");
  const ultima = fatte[fatte.length - 1];
  const daFatta = ultima ? ultima.fattaIl || ultima.data : "";
  if (RE_DATA.test(daFatta)) return daFatta;
  const posa = d?.installazione?.completataIl || d?.installazione?.dataInstallazione || "";
  return RE_DATA.test(String(posa)) ? String(posa) : oggiISO();
}

/** La data da proporre per il prossimo ritorno: ultimo ritorno + cadenza.
 *  ⚠️ Mai nel passato. Su un cliente ripescato dopo mesi il conto darebbe una
 *   data già scaduta, e la procedura guidata proporrebbe di fissare un
 *   appuntamento indietro nel tempo: in quel caso la risposta giusta è «il prima
 *   possibile», cioè oggi — poi sono gli orari liberi a dire quand'è davvero. */
export function dataProposta(
  d?: Pick<LeadData, "manutenzione" | "installazione"> | null,
  cadenza: number = cadenzaDi(d),
  oggi: string = oggiISO(),
): string {
  const calcolata = piuGiorni(ultimoRitorno(d), cadenza);
  if (!calcolata) return piuGiorni(oggi, cadenza) || oggi;
  return calcolata < oggi ? oggi : calcolata;
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. COMPORRE — le scritture nascono qui, ma qui non si scrive niente
   ═════════════════════════════════════════════════════════════════════════ */

/** Id stabile. Stessa forma usata in blocchi.ts, task-manuali.tsx e nel motore
 *  delle notifiche: `randomUUID` dove c'è, altrimenti un ripiego che non
 *  collide in pratica. */
export function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Un promemoria: una data attesa e basta. Non occupa nessuna agenda — è la sua
 *  ragione di esistere.
 *  ⚠️ `tipo` si passa quando il promemoria nasce da un ritorno che era SINGOLO:
 *   il seguito di un intervento fuori giro resta fuori giro. Senza, un cliente
 *   che ha saltato un intervento una tantum si ritroverebbe dentro un ciclo che
 *   non ha mai chiesto — cioè la porta di servizio da cui «e basta» diventa «per
 *   sempre». Assente = ciclo, che è il ripiego di tutto il file. */
export function nuovoPromemoria(
  data: string,
  origine: OrigineManutenzione,
  note?: string,
  tipo?: TipoManutenzione,
): AppuntamentoManutenzione {
  return {
    id: nuovoId(),
    stato: "da_fissare",
    data,
    origine,
    ...(tipo === "singolo" ? { tipo } : {}),
    ...(note?.trim() ? { note: note.trim() } : {}),
    creataIl: new Date().toISOString(),
  };
}

/** ── L'ELENCO AGGIORNATO, SENZA DOPPIONI ──────────────────────────────────
 *  Sostituisce la riga con lo stesso id, oppure la aggiunge in fondo.
 *  Si passa SEMPRE da qui e mai da un `push` a mano: `updateLead` sostituisce il
 *  campo intero, quindi una scrittura che dimentica le righe precedenti non dà
 *  nessun errore — cancella semplicemente lo storico del cliente, e nessuno se
 *  ne accorge finché non lo si va a cercare mesi dopo. */
export function conManutenzione(
  info: ManutenzioneInfo | undefined,
  app: AppuntamentoManutenzione,
  cadenza?: number,
): ManutenzioneInfo {
  const elenco = Array.isArray(info?.appuntamenti) ? info.appuntamenti.slice() : [];
  const i = elenco.findIndex((x) => x && x.id === app.id);
  if (i >= 0) elenco[i] = app;
  else elenco.push(app);
  return {
    ...info,
    ...(cadenza && cadenza > 0 ? { cadenzaGiorni: Math.round(cadenza) } : {}),
    appuntamenti: elenco,
  };
}

/** Toglie una riga dall'elenco: serve solo a disfare un errore (l'«Annulla» del
 *  messaggio e la manutenzione fissata sul cliente sbagliato). Non è il modo di
 *  dire che una manutenzione non si farà — per quello c'è "saltata", che resta
 *  scritta e conta. */
export function senzaManutenzione(
  info: ManutenzioneInfo | undefined,
  id: string,
): ManutenzioneInfo {
  const elenco = Array.isArray(info?.appuntamenti) ? info.appuntamenti : [];
  return { ...info, appuntamenti: elenco.filter((x) => x && x.id !== id) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. LE PAROLE — le stesse in ogni schermata
   ═════════════════════════════════════════════════════════════════════════ */

/** Il verbo giusto per lo stato: serve ai messaggi e ai riepiloghi, che devono
 *  dire la stessa cosa con le stesse parole. */
export const ETICHETTA_STATO_MANUTENZIONE: Record<StatoManutenzione, string> = {
  da_fissare: "Promemoria",
  fissata: "Appuntamento fissato",
  fatta: "Fatta",
  saltata: "Saltata",
};

/** Le due strade, dette come si dicono al cliente. Stanno qui accanto agli stati
 *  perché la stessa parola compare nella procedura, nel riepilogo e nel
 *  messaggio che conferma il salvataggio: tre formulazioni diverse per la stessa
 *  scelta si leggono come tre scelte diverse. */
export const ETICHETTA_TIPO_MANUTENZIONE: Record<TipoManutenzione, string> = {
  ciclo: "Ciclo di ritorni",
  singolo: "Intervento singolo",
};
