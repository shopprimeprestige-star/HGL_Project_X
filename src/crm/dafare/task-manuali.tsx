/** ── LE COSE SCRITTE A MANO ────────────────────────────────────────────────
 *
 *  Il pezzo di «Da fare oggi» che non nasce da un lead: «ordinare le basi»,
 *  «richiamare il commercialista», «portare il POS alla posa delle 15».
 *  Sono righe che qualcuno scrive, spunta e butta via — nient'altro.
 *
 *  ── DOVE VIVONO, E PERCHÉ PROPRIO LÌ ──────────────────────────────────────
 *  In `app_config`, chiave `crm_dafare_task`, come JSON. È la stessa tabella e
 *  lo stesso modo dei blocchi di disponibilità (crm/blocchi.ts), dei testi
 *  WhatsApp e del listino del preventivo: una riga chiave/valore per ogni
 *  configurazione che non merita una tabella sua.
 *
 *  Le tre alternative, e perché no:
 *   · una TABELLA NUOVA sarebbe la casa giusta, ma vuole una migrazione, e una
 *     migrazione non si scrive dentro una pagina — arriverebbe in produzione
 *     senza che nessuno l'abbia lanciata, e la pagina si aprirebbe vuota per
 *     sempre senza dire perché;
 *   · dentro `LeadData` no: una cosa da fare non appartiene a nessun cliente, e
 *     appiccicarla al primo lead che capita la fa sparire quando quella scheda
 *     viene archiviata;
 *   · nel browser (localStorage) no, ed è l'errore che sembra più innocuo: chi
 *     scrive la lista la mattina dal telefono e apre il computer alle nove non
 *     la trova più. Una cosa da fare che esiste su un solo dispositivo non è
 *     una cosa da fare, è un appunto.
 *
 *  ── UNA LISTA SOLA PER TUTTO IL CENTRO, CON IL NOME DI CHI HA SCRITTO ─────
 *  Non una lista per persona. Due ragioni, e la prima è di onestà: la regola di
 *  riga di `app_config` è «chiunque sia entrato legge e scrive tutto», quindi
 *  una chiave per utente NON sarebbe privata — sembrerebbe soltanto. La
 *  seconda è che qui dentro le cose da fare si passano di mano davvero: chi
 *  risponde al telefono segna «richiamare il fornitore» e la fa chi è libero.
 *  Ogni riga porta quindi il nome di chi l'ha scritta (`diNome`) e la pagina
 *  offre la lente «solo le mie»: separare si può, nascondere no.
 *
 *  ── QUANDO VA FATTA: UN GIORNO, E UN'ORA SE SERVE ─────────────────────────
 *  Una cosa da fare ha sempre un GIORNO (`data`) e facoltativamente un'ORA
 *  (`ora`). Prima il giorno era sempre oggi — non perché lo si fosse deciso,
 *  ma perché la pagina non lo chiedeva: si poteva scrivere «richiamare il
 *  fornitore» solo per adesso, e chi voleva ricordarselo lunedì se lo scriveva
 *  su un foglio. Un promemoria che sa dire soltanto «oggi» costringe a tenerne
 *  un secondo altrove, ed è così che le cose si perdono davvero.
 *
 *  Le tre risposte che reggono tutto il resto, scritte qui perché sono regole
 *  di dominio e non di disegno:
 *
 *   1. UNA RIGA PER DOMANI NON SI VEDE OGGI. La pagina si chiama «Da fare
 *      oggi» e una lista di oggi che contiene domani non è una lista di oggi —
 *      è lo stesso principio per cui l'arretrato dei lead è dietro un
 *      interruttore. Ma non sparisce di nascosto: alla scrittura la pagina
 *      conferma per esteso dov'è finita, e un interruttore con il CONTEGGIO
 *      («Nei prossimi giorni · 3») la fa riapparire in un clic. Nascondere si
 *      può, non dire quanto si sta nascondendo no.
 *
 *   2. UNA SCADUTA E NON FATTA RESTA IN CIMA, CON LA SUA DATA VERA. Non viene
 *      spostata a oggi da sola: la data che qualcuno aveva scelto è
 *      un'informazione, e riscriverla di nascosto cancella l'unica prova che
 *      quella cosa è in ritardo. Compare quindi in cima, nel gruppo «Rimasto
 *      indietro», dicendo da quanto («era per ieri», «5 giorni fa») e quante
 *      volte è già stata rimandata. Perché il mucchio non diventi illeggibile
 *      ha una via d'uscita che costa un clic — il gesto `sposta` qui sotto,
 *      cioè i pulsanti «Oggi / Domani» sulla riga — e non una scomparsa
 *      automatica: la sparizione da sola è la cosa che fa smettere di fidarsi
 *      di una lista.
 *
 *   3. SPUNTATA RESTA BARRATA FINO A MEZZANOTTE, POI ESCE DALLA LISTA. Vedere
 *      quello che si è fatto è metà del motivo per cui si tiene una lista, ma
 *      solo nella giornata in cui lo si è fatto: le spuntate dei giorni scorsi
 *      restavano in «Rimasto indietro» per un mese intero, e il gruppo che
 *      doveva gridare «questo non l'ha fatto nessuno» era pieno di roba fatta.
 *      La regola sta in crm/dafare/righe.tsx (una riga sola, `fattaIl`); qui il
 *      dato si conserva comunque un mese, perché lo storico è un'altra domanda.
 *
 *  ⚠️ CHI SALVA PER ULTIMO VINCE. Il valore è un JSON solo: due persone che
 *   scrivono nello stesso istante si sovrascrivono, e una delle due righe
 *   sparisce senza un errore. Non si può togliere del tutto senza una tabella
 *   vera, ma si può ridurre la finestra da minuti a millisecondi, ed è quello
 *   che fa `applicaGesto` qui sotto: NON salva mai la lista che sta a schermo —
 *   rilegge dal server, applica il singolo gesto (aggiungi / spunta / elimina)
 *   e riscrive. Chi tocca questo file non torni a passare la lista intera: è
 *   esattamente il modo in cui si cancellano le cose scritte dai colleghi.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { oggiIso, soloData } from "@/crm/ui";
import { dataPulita, giorniFra, istanteDi, oraPulita } from "./quando";

/** Una cosa da fare scritta a mano. */
export interface TaskManuale {
  /** Chiave stabile: è quella con cui si spunta e si elimina, e l'unica cosa
   *  che permette a due postazioni di parlare della stessa riga. */
  id: string;
  /** Che cosa c'è da fare, con le parole di chi l'ha scritta. */
  testo: string;
  /** Il giorno in cui va ricordata, "2026-08-15". Sempre presente: una cosa da
   *  fare senza un giorno non finisce in nessuna giornata, e quindi non si fa
   *  mai. Lo sceglie chi scrive — «oggi», «domani», una data — e di ripiego è
   *  oggi, perché è quello che si intende nove volte su dieci. */
  data: string;
  /** L'ora, "15:30". Facoltativa, e resta facoltativa: quasi tutto quello che
   *  si scrive a mano è «in giornata», e obbligare a scegliere un orario finto
   *  farebbe suonare promemoria per cose che non hanno un momento. Quando c'è,
   *  la riga si comporta in tutto e per tutto come un richiamo fissato a un
   *  lead — stesso conto alla rovescia, stessa soglia, stessa campanella. */
  ora?: string;
  /** Spuntata. Resta nella lista fino a fine giornata: vedere quello che si è
   *  già fatto è metà del motivo per cui si tiene una lista. */
  fatta?: boolean;
  /** ISO del momento in cui è stata spuntata. */
  fattaIl?: string;
  /** Chi l'ha scritta: l'id del consulente collegato col PIN, altrimenti
   *  l'id dell'utente Supabase. Serve alla lente «solo le mie». */
  di?: string;
  /** Il nome da mostrare. Si salva insieme all'id perché una riga vecchia deve
   *  restare leggibile anche se quella persona non è più fra i consulenti. */
  diNome?: string;
  /** ISO di quando è nata: serve a ordinare le righe senza ora. */
  creata: string;
  /** Il PRIMO giorno per cui era stata scritta, quando è stata spostata almeno
   *  una volta. Serve a non far dire una bugia alla riga: una cosa rimandata
   *  tre volte a domani, senza questo campo, sembra nata oggi ed è la storia
   *  opposta di quella vera. */
  nataPer?: string;
  /** ── A CHI TOCCA ────────────────────────────────────────────────────────
   *  `di` dice chi l'ha SCRITTA, e non è la stessa domanda: chi risponde al
   *  telefono segna «richiamare il fornitore» e la fa un altro. Senza questo
   *  campo l'unico modo di assegnare una cosa era scriverla dentro al testo
   *  («Marco: richiamare…»), che nessun filtro può leggere.
   *  Vuoto = di nessuno in particolare, e la fa chi è libero: resta il modo
   *  normale di lavorare qui dentro, non un ripiego. */
  aId?: string;
  aNome?: string;
  /** ── PER QUALE CLIENTE ──────────────────────────────────────────────────
   *  La scheda a cui la cosa si riferisce, quando ce n'è una: «portare il POS
   *  alla posa di Rossi». Si tiene anche il NOME perché la riga deve restare
   *  leggibile se quella scheda viene archiviata — stessa ragione di `diNome`. */
  perId?: string;
  perNome?: string;
  /** ── OCCUPA L'AGENDA ────────────────────────────────────────────────────
   *  Una cosa da fare che si prende un pezzo di giornata: una posa, una
   *  riunione, un giro in banca. Se è accesa, quel tempo NON si può più
   *  prenotare — si scrive un blocco vero della disponibilità (crm/blocchi),
   *  e `bloccoId` è il filo che tiene insieme le due cose: cancellando la
   *  riga si toglie anche il blocco, se no il calendario resta chiuso per una
   *  cosa che non esiste più.
   *  ⚠️ Senza ora non occupa niente: «in giornata» non è un pezzo di agenda. */
  occupaAgenda?: boolean;
  /** Quanto dura, in minuti. Serve solo se occupa l'agenda. */
  durata?: number;
  bloccoId?: string;
  /** Quante volte è stata spostata PIÙ AVANTI. Non è statistica: è il segnale
   *  più affidabile che quella cosa non verrà fatta mai, e va sotto gli occhi
   *  di chi la sta rimandando la quarta volta. Anticipare una riga non conta —
   *  chi la tira avanti la sta facendo prima, non evitando. */
  rimandi?: number;
}

export const CHIAVE_DAFARE = "crm_dafare_task";

/** ── PERCHÉ `app_config` SI DESCRIVE A MANO ────────────────────────────────
 *  La tabella è arrivata con una migrazione a parte e non compare nei tipi
 *  generati di Supabase: senza questa descrizione ogni chiamata sarebbe un
 *  errore di compilazione. È la stessa scelta, con le stesse parole, già fatta
 *  in crm/blocchi.ts e in routes/CRM.whatsapp.tsx — se un giorno i tipi
 *  verranno rigenerati, questi tre cast si tolgono insieme. */
const dbConfig = supabase as unknown as {
  from: (t: string) => {
    select: (s: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { value?: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      v: Record<string, unknown>,
      o: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ── QUELLO CHE ARRIVA DAL DATABASE NON SI CREDE SULLA PAROLA ──────────────
 *  Il valore è un JSON scritto da noi, ma anche da una versione futura di
 *  questa pagina e — in teoria — da chiunque abbia accesso alla tabella. Una
 *  riga storta non deve poter far sparire la pagina: si ripara quel che si può
 *  e si butta solo ciò che non ha più senso (una riga senza testo non è una
 *  cosa da fare, è una casella vuota da spuntare). */
function normalizzaTask(grezzo: unknown): TaskManuale | null {
  if (!grezzo || typeof grezzo !== "object") return null;
  const r = grezzo as Record<string, unknown>;
  const testo = String(r.testo ?? "").trim();
  if (!testo) return null;
  //  Una data illeggibile diventa OGGI e non «nessun giorno»: una riga senza
  //  giorno non entrerebbe in nessuna giornata, cioè sparirebbe dalla pagina
  //  restando nel database — il modo più silenzioso di perdere una cosa da
  //  fare. Oggi è al massimo un fastidio, e si sposta in un clic.
  const data = dataPulita(r.data) || oggiIso();
  const rimandi = Number(r.rimandi);
  return {
    id: typeof r.id === "string" && r.id ? r.id : nuovoId(),
    //  Un limite c'è, ed è generoso: serve solo a impedire che un incollaggio
    //  accidentale di mezzo documento renda illeggibile la riga (e il JSON).
    testo: testo.slice(0, 500),
    data,
    ora: oraPulita(r.ora) || undefined,
    fatta: r.fatta === true,
    fattaIl: typeof r.fattaIl === "string" ? r.fattaIl : undefined,
    di: typeof r.di === "string" && r.di ? r.di : undefined,
    diNome: typeof r.diNome === "string" && r.diNome ? r.diNome : undefined,
    creata: typeof r.creata === "string" && r.creata ? r.creata : new Date().toISOString(),
    //  La data d'origine si tiene solo se è una data vera E se è diversa da
    //  quella attuale: «rimandata dal 15 agosto» su una riga che è ancora del
    //  15 agosto è una frase che fa perdere tempo a chi la legge.
    nataPer:
      dataPulita(r.nataPer) && dataPulita(r.nataPer) !== data ? dataPulita(r.nataPer) : undefined,
    rimandi:
      Number.isFinite(rimandi) && rimandi > 0 ? Math.min(Math.floor(rimandi), 99) : undefined,
    aId: typeof r.aId === "string" && r.aId ? r.aId : undefined,
    aNome: typeof r.aNome === "string" && r.aNome ? r.aNome.slice(0, 80) : undefined,
    perId: typeof r.perId === "string" && r.perId ? r.perId : undefined,
    perNome: typeof r.perNome === "string" && r.perNome ? r.perNome.slice(0, 80) : undefined,
    //  ⚠️ Occupa l'agenda solo se c'è davvero un'ora: una riga «in giornata»
    //   che si dichiara occupata toglierebbe tempo che nessuno sa quale sia.
    occupaAgenda: r.occupaAgenda === true && !!oraPulita(r.ora),
    durata: Number.isFinite(Number(r.durata)) && Number(r.durata) > 0
      ? Math.min(Math.round(Number(r.durata)), 12 * 60)
      : undefined,
    bloccoId: typeof r.bloccoId === "string" && r.bloccoId ? r.bloccoId : undefined,
  };
}

/** ── LA LISTA NON CRESCE ALL'INFINITO ──────────────────────────────────────
 *  Sta tutta in una riga di database e si rilegge a ogni gesto: senza una
 *  potatura, dopo un anno sarebbero migliaia di righe spuntate da trasferire
 *  ogni volta per mostrarne otto.
 *  Si tiene un mese: abbastanza per «cos'ho fatto la settimana scorsa», troppo
 *  poco per pesare. Le righe NON spuntate non si buttano mai, per vecchie che
 *  siano — una cosa da fare che nessuno ha fatto è precisamente quella che non
 *  deve sparire da sola.
 *  ⚠️ Conservare non è mostrare: una riga spuntata resta QUI un mese ma esce
 *   dall'elenco a schermo la sera stessa (regola 3 in cima al file, applicata
 *   in crm/dafare/righe.tsx). I due numeri sono diversi apposta — la lista
 *   risponde a «cosa devo fare», l'archivio a «cosa è stato fatto». */
const GIORNI_DI_MEMORIA = 31;

function daPotare(t: TaskManuale, oggi: string): boolean {
  if (!t.fatta) return false;
  const limite = new Date(`${oggi}T00:00:00`);
  limite.setDate(limite.getDate() - GIORNI_DI_MEMORIA);
  //  ⚠️ Il mese si conta dal giorno della SPUNTA, non da quello per cui la riga
  //   era stata scritta — è la stessa scelta, e le stesse due parole, di
  //   `fattaIl` in crm/dafare/righe.tsx. Contandolo da `data` succedeva questo:
  //   una cosa scritta per il mese scorso e mai fatta (che nella lista resta
  //   per sempre, ed è giusto) veniva potata dalla scrittura STESSA che la
  //   spuntava — cioè spariva dallo schermo nell'istante in cui la si segnava
  //   fatta, invece di restare barrata fino a stasera. La sparizione al momento
  //   della spunta è precisamente ciò che fa dubitare di aver salvato, e fa
  //   riscrivere la stessa riga il giorno dopo.
  //   Le righe vecchie senza `fattaIl` ripiegano sulla loro data, che è l'unica
  //   cosa che si sa di loro.
  return (soloData(t.fattaIl) || t.data) < oggiIso(limite);
}

export function leggiTaskDaJson(testo: string | null | undefined): TaskManuale[] {
  if (!testo) return [];
  try {
    const parsed = JSON.parse(testo) as unknown;
    const lista = Array.isArray(parsed)
      ? parsed
      : ((parsed as { task?: unknown[] } | null)?.task ?? []);
    if (!Array.isArray(lista)) return [];
    return lista.map(normalizzaTask).filter((t): t is TaskManuale => t !== null);
  } catch {
    //  Configurazione illeggibile: meglio una lista vuota che una pagina
    //  bianca. ⚠️ Il primo salvataggio riscrive il campo per intero, cioè
    //  quello che non si è riusciti a leggere va perso davvero: per questo il
    //  chiamante deve DIRLO a schermo invece di ripartire in silenzio.
    return [];
  }
}

/* ── LETTURA E SCRITTURA ──────────────────────────────────────────────────── */

/** Com'è andata, detto per intero: chi chiama deve poter distinguere «non
 *  c'era niente» da «non sono riuscito a leggere», perché la seconda si
 *  racconta all'utente e la prima no. */
export interface EsitoTask {
  ok: boolean;
  lista: TaskManuale[];
  /** Il messaggio del server, quello che finisce dentro il toast. */
  errore?: string;
}

export async function caricaTask(): Promise<EsitoTask> {
  const { data, error } = await dbConfig
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_DAFARE)
    .maybeSingle();
  //  La risposta si LEGGE: una lettura fallita restituiva una lista vuota
  //  identica a «non hai ancora scritto niente», e la differenza fra le due è
  //  tutta — nella seconda si può scrivere, nella prima si sta per riscrivere
  //  sopra il lavoro di qualcun altro.
  if (error) return { ok: false, lista: [], errore: error.message };
  return { ok: true, lista: leggiTaskDaJson(data?.value) };
}

async function scrivi(lista: TaskManuale[]): Promise<string | null> {
  const { error } = await dbConfig.from("app_config").upsert(
    {
      key: CHIAVE_DAFARE,
      //  `v: 1` non è decorazione: il giorno in cui la forma cambia, questo
      //  numero è l'unica cosa che permette di riconoscere il vecchio formato
      //  invece di scartarlo.
      value: JSON.stringify({ v: 1, task: lista }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  return error ? error.message : null;
}

/** I quattro gesti possibili su una lista di cose da fare. Sono un tipo e non
 *  quattro funzioni perché passano tutti dalla stessa strada — rileggi,
 *  applica, riscrivi — e averne una sola significa che quella strada è giusta o
 *  sbagliata una volta sola. */
export type Gesto =
  | { tipo: "aggiungi"; task: TaskManuale }
  | { tipo: "spunta"; id: string; fatta: boolean }
  | { tipo: "elimina"; id: string }
  /** Cambia il giorno e/o l'ora. `ora: ""` toglie l'ora e riporta la riga fra
   *  quelle «quando capita»: è un gesto voluto e frequente (l'appuntamento con
   *  se stessi salta, la cosa resta), non un modo per svuotare un campo. */
  | { tipo: "sposta"; id: string; data: string; ora: string };

function applica(lista: TaskManuale[], gesto: Gesto): TaskManuale[] {
  switch (gesto.tipo) {
    case "aggiungi":
      return [...lista, gesto.task];
    case "spunta":
      return lista.map((t) =>
        t.id === gesto.id
          ? {
              ...t,
              fatta: gesto.fatta,
              //  L'ora della spunta si cancella quando si toglie la spunta: una
              //  riga «da fare» che si porta dietro l'ora in cui era fatta fa
              //  dubitare di tutte le altre.
              fattaIl: gesto.fatta ? new Date().toISOString() : undefined,
            }
          : t,
      );
    case "elimina":
      return lista.filter((t) => t.id !== gesto.id);
    case "sposta":
      return lista.map((t) => {
        if (t.id !== gesto.id) return t;
        //  La data è già stata controllata da `applicaGesto` prima di leggere
        //  il server: qui il ripiego sulla vecchia serve solo a rendere questa
        //  funzione innocua anche se un domani la chiamasse qualcun altro.
        const nuova = dataPulita(gesto.data) || t.data;
        //  Rimandare è portare AVANTI. Anticipare, o correggere l'ora dentro
        //  lo stesso giorno, non è un rinvio e non deve sporcare il conto: è
        //  proprio il numero dei rinvii che dice quali cose non si faranno mai.
        const rimandata = nuova > t.data;
        return {
          ...t,
          data: nuova,
          ora: oraPulita(gesto.ora) || undefined,
          nataPer: rimandata ? t.nataPer || t.data : t.nataPer,
          rimandi: rimandata ? (t.rimandi ?? 0) + 1 : t.rimandi,
        };
      });
  }
}

/** ── IL SOLO MODO DI SCRIVERE ──────────────────────────────────────────────
 *  Rilegge dal server, applica UN gesto, riscrive. Vedi la nota in cima al
 *  file: passare la lista che sta a schermo cancellerebbe tutto quello che i
 *  colleghi hanno scritto nel frattempo.
 *  Restituisce la lista come è rimasta sul server, così chi chiama aggiorna lo
 *  schermo con la verità e non con la propria previsione. */
export async function applicaGesto(gesto: Gesto): Promise<EsitoTask> {
  //  ⚠️ La data si controlla PRIMA di toccare il server, e il rifiuto si dice:
  //  un gesto «sposta» con una data che non esiste ("2026-02-31" passa
  //  qualunque controllo di forma) tornerebbe indietro con la lista intatta e
  //  lo schermo identico, cioè un pulsante che non fa niente e non spiega
  //  perché. Meglio un errore in faccia che un comando muto.
  if (gesto.tipo === "sposta" && !dataPulita(gesto.data)) {
    return { ok: false, lista: [], errore: `Data non valida: «${gesto.data}»` };
  }
  const letta = await caricaTask();
  //  ⚠️ Se la lettura non riesce NON si scrive: sovrascrivere una lista che
  //  non si è riusciti a leggere è il modo più rapido di svuotarla del tutto.
  if (!letta.ok) return letta;

  const oggi = oggiIso();
  const dopo = applica(letta.lista, gesto).filter((t) => !daPotare(t, oggi));
  const errore = await scrivi(dopo);
  //  A schermo cambia solo se il database ha detto di sì: una spunta che
  //  rimane spuntata dopo un salvataggio fallito è una bugia che si scopre
  //  domani, quando la cosa da fare ricompare.
  if (errore) return { ok: false, lista: letta.lista, errore };
  return { ok: true, lista: dopo };
}

/** Costruisce una riga nuova. Sta qui e non nella pagina perché la forma di un
 *  task (id, data di ripiego, autore) deve essere una sola: la stessa riga la
 *  scriveranno domani la pagina, una scorciatoia da tastiera e magari il
 *  telefono. */
export function nuovoTask(campi: {
  testo: string;
  data?: string;
  ora?: string;
  di?: string;
  diNome?: string;
  aId?: string;
  aNome?: string;
  perId?: string;
  perNome?: string;
  occupaAgenda?: boolean;
  durata?: number;
  bloccoId?: string;
}): TaskManuale {
  return {
    id: nuovoId(),
    testo: campi.testo.trim().slice(0, 500),
    //  Senza data è OGGI, e resta il ripiego anche adesso che il giorno si può
    //  scegliere: chi scrive di corsa non deve compilare un campo per dire
    //  l'unica cosa già ovvia. Una data che non esiste vale come nessuna data —
    //  meglio la riga di oggi, che si vede e si sposta, di una riga datata
    //  «31 febbraio» che non comparirebbe in nessuna giornata.
    data: dataPulita(campi.data) || oggiIso(),
    ora: oraPulita(campi.ora) || undefined,
    di: campi.di || undefined,
    diNome: campi.diNome || undefined,
    aId: campi.aId || undefined,
    aNome: campi.aNome || undefined,
    perId: campi.perId || undefined,
    perNome: campi.perNome || undefined,
    //  Stessa regola della lettura: senza ora non si occupa niente.
    occupaAgenda: !!campi.occupaAgenda && !!oraPulita(campi.ora),
    durata: campi.occupaAgenda && campi.durata ? campi.durata : undefined,
    bloccoId: campi.bloccoId || undefined,
    creata: new Date().toISOString(),
  };
}

/** ── DI CHI È LA PALLA ────────────────────────────────────────────────────
 *  Se qualcuno l'ha assegnata, è di quella persona; altrimenti resta di chi
 *  l'ha scritta. ⚠️ In un posto solo: «solo le mie», il conteggio in cima e il
 *  raggruppamento per persona rispondevano alla stessa domanda in tre modi, e
 *  bastava assegnare una riga perché i tre numeri smettessero di coincidere.
 */
export function padroneDelTask(t: Pick<TaskManuale, "aId" | "di">): string {
  return String(t.aId || t.di || "").trim();
}

/* ── QUANDO UNA COSA SCRITTA A MANO DIVENTA UN AVVISO ─────────────────────── */

/** Comodità: il momento di una riga scritta a mano. */
export function istanteTask(t: TaskManuale): number | null {
  return istanteDi(t.data, t.ora);
}

/** Un avviso pronto da consegnare, nella forma che usa già il resto del CRM
 *  (titolo, corpo, chiave che non si ripete, dove porta il clic).
 *  I nomi dei campi sono quelli di `EventoCrm` (crm/notifications/eventi-crm)
 *  ed è voluto: il giorno in cui il motore imparerà a conoscere le cose scritte
 *  a mano, questi oggetti ci entrano dentro senza tradurre niente — serve solo
 *  la voce nel catalogo. Vedi la nota «serve da altri» della pagina. */
export interface AvvisoTask {
  tipo: string;
  chiave: string;
  titolo: string;
  corpo: string;
  destinazione: string;
  gravita: "info" | "warning" | "critical";
}

/** Il `kind` con cui questi avvisi finiscono nella campanella. Vive qui, in una
 *  costante sola, perché è anche la chiave con cui si riconoscono i doppioni. */
export const TIPO_AVVISO_TASK = "task_manuale";

/** ── L'UNICA REGOLA SU «QUANDO È ORA» ──────────────────────────────────────
 *  Vale per lo schermo e per la campanella insieme, di proposito: se la riga si
 *  accendesse a un minuto e l'avviso partisse a un altro, l'utente avrebbe due
 *  orologi diversi per la stessa cosa e smetterebbe di credere a entrambi.
 *
 *  La finestra è di cinque minuti dopo l'ora, non di uno, ed è la stessa scelta
 *  già fatta nel motore delle notifiche: se la scheda è in secondo piano il
 *  browser rallenta i timer, e con una finestra stretta l'avviso più importante
 *  sarebbe proprio quello che si perde. */
const FINESTRA_AVVISO_MS = 5 * 60_000;

/** ── E QUANDO L'ORA È PASSATA DA UN PEZZO ──────────────────────────────────
 *  Questi tre numeri NON sono scelti qui: sono copiati uno per uno da
 *  `richiamo_scaduto` in crm/notifications/eventi-crm.ts, che è la regola con
 *  cui il CRM sollecita da sempre un richiamo promesso a un cliente e non
 *  fatto. Il motivo è tutto nella coerenza: in questa pagina una nota scritta a
 *  mano per le 15 e un richiamo fissato per le 15 stanno una sotto l'altra, e
 *  se una tacesse per sempre dopo cinque minuti mentre l'altra ricorda ogni
 *  mattina, l'utente imparerebbe due sistemi invece di uno.
 *   · dalle 8 e non a mezzanotte: chi lascia il CRM aperto la notte non deve
 *     ricevere il ripasso della giornata alle 00:01;
 *   · una volta al giorno, non a ogni giro d'orologio;
 *   · e non oltre una settimana — «oltre una settimana non è più un
 *     promemoria, è un rimprovero quotidiano», parole del motore. Da lì in poi
 *     quelle righe si recuperano dalla lista, dove restano in cima. */
const ORA_MINIMA_SOLLECITO = 8;
const GIORNI_MASSIMI_SOLLECITO = 7;

/** ── DUE AVVISI, PERCHÉ SONO DUE MOMENTI DIVERSI ───────────────────────────
 *  «È il momento» si dice una volta, all'ora esatta, ed è critico come
 *  l'appuntamento che inizia adesso: chi si è scritto un orario preciso lo ha
 *  fatto perché quella cosa non poteva slittare.
 *  «È in ritardo» si dice quando quel momento è passato e la cosa è ancora lì,
 *  una volta al giorno finché c'è. Sono gli stessi due tempi con cui il CRM
 *  tratta un lead: «appuntamento fra 15 minuti» e poi «appuntamento passato
 *  senza esito», «richiamo fissato» e poi «richiamo scaduto».
 *  Vale per le righe SENZA ora esattamente quanto per quelle con l'ora: una
 *  cosa scritta per martedì e non fatta è in ritardo anche se nessuno aveva
 *  detto a che ora.
 *  Le righe già spuntate non producono niente, in nessuno dei due casi. */
export function avvisiTaskAdesso(lista: TaskManuale[], ora: Date): AvvisoTask[] {
  const adesso = ora.getTime();
  const oggi = oggiIso(ora);
  const fuori: AvvisoTask[] = [];
  for (const t of lista) {
    if (t.fatta) continue;

    /* ── 1. È IL MOMENTO ─────────────────────────────────────────────────── */
    const istante = istanteTask(t);
    if (t.data === oggi && istante !== null) {
      const mancano = istante - adesso;
      if (mancano <= 0 && mancano > -FINESTRA_AVVISO_MS) {
        fuori.push({
          tipo: TIPO_AVVISO_TASK,
          //  Una volta sola per task e per giorno: l'indice unico su
          //  (user_id, dedupe_key) fa il resto anche fra postazioni diverse.
          //  ⚠️ La chiave contiene la DATA, e non è un dettaglio: una riga
          //   spostata a domani deve poter suonare di nuovo domani. Se la
          //   chiave fosse il solo id, rimandare una cosa vorrebbe dire farla
          //   tacere per sempre.
          chiave: `dafare:${t.id}:${t.data}`,
          titolo: "È il momento",
          corpo: `${t.testo} · ore ${oraPulita(t.ora)}`,
          destinazione: "/CRM/dafare",
          gravita: "critical",
        });
      }
    }

    /* ── 2. È IN RITARDO ─────────────────────────────────────────────────── */
    //  ⚠️ DUE CASI, UN AVVISO SOLO, ED È UNA CORREZIONE. Prima si sollecitava
    //   soltanto dal GIORNO dopo: una cosa scritta per oggi alle 15 e non
    //   fatta taceva fino al mattino successivo, mentre un richiamo promesso a
    //   un cliente per le 15 e non fatto sollecita dalle 15:01
    //   (`richiamo_scaduto` in crm/notifications/eventi-crm.ts). Nella stessa
    //   pagina, una sotto l'altra, le due righe dicevano «è ora» allo stesso
    //   modo e poi si comportavano in due modi diversi — ed è il genere di
    //   differenza che non si impara mai, si subisce e basta.
    //   Il ritardo dello stesso giorno si conta dopo la finestra dell'annuncio,
    //   non dal minuto esatto: dentro quei cinque minuti l'ha appena detto
    //   «È il momento», e ripeterlo subito con parole diverse è rumore.
    const giorniDiRitardo = giorniFra(t.data, oggi);
    const oraGiaPassata =
      t.data === oggi && istante !== null && adesso - istante > FINESTRA_AVVISO_MS;
    const dopoLeOtto = ora.getHours() >= ORA_MINIMA_SOLLECITO;
    const daSollecitare =
      giorniDiRitardo !== null &&
      giorniDiRitardo >= 1 &&
      giorniDiRitardo <= GIORNI_MASSIMI_SOLLECITO;
    if (dopoLeOtto && (oraGiaPassata || daSollecitare)) {
      fuori.push({
        tipo: TIPO_AVVISO_TASK,
        //  La chiave porta OGGI e non la data della riga: è così che diventa
        //  «una volta al giorno finché non la fai», che è esattamente la
        //  disciplina di `rich:<lead>:<oggi>` del motore.
        chiave: `dafare-tardi:${t.id}:${oggi}`,
        titolo: "È in ritardo",
        //  Le tre frasi sono, parola per parola, quelle di `richiamo_scaduto`:
        //  chi legge la campanella non deve accorgersi che dietro c'erano due
        //  pezzi di codice diversi.
        corpo: `${t.testo} · ${
          giorniDiRitardo === 0
            ? `era per le ${oraPulita(t.ora)}`
            : giorniDiRitardo === 1
              ? "era per ieri"
              : `in ritardo di ${giorniDiRitardo} g`
        }`,
        destinazione: "/CRM/dafare",
        //  Non critico: è in ritardo, non sta iniziando. Il rosso pieno si
        //  tiene per le cose che stanno succedendo adesso, altrimenti smette
        //  di voler dire qualcosa.
        gravita: "warning",
      });
    }
  }
  return fuori;
}

/** ── L'AVVISO PARTE DALLA PAGINA CHE HAI APERTA, QUALUNQUE DELLE DUE SIA ────
 *  ⚠️ QUESTO HOOK È NATO DA UN GUASTO, e il guasto era questo: la scrittura
 *   nella campanella viveva dentro routes/CRM.dafare.tsx e basta. Ma le note
 *   scritte a mano sono UNA lista sola (stessa riga di `app_config`) e da
 *   quando la coda del setter le mostra e le scrive anche lei
 *   (routes/CRM.importa.tsx, sotto-scheda «Oggi»), chi passa la mattina al
 *   telefono sta su QUELL'ALTRA pagina — cioè su quella che non avvisava. La
 *   nota si vedeva in tutte e due, il promemoria arrivava in una: la promessa
 *   «stessa lista, stesso posto» era vera per l'elenco e falsa proprio nel
 *   momento in cui serve, che è quando l'ora arriva e non stai guardando.
 *
 *  Sta QUI, dentro il file che possiede già `avvisiTaskAdesso` e il client di
 *  Supabase, e non copiato nelle due pagine: due copie della stessa scrittura
 *  vogliono dire due `dedupe_key` che un giorno divergono, e il doppione nella
 *  campanella è il modo più veloce per far spegnere le notifiche a chi le usa.
 *
 *  L'id dell'utente ARRIVA DALL'ALTO e non si legge qui da `useAuth`: quel
 *  contesto importa già da questo ramo di file, e chiederglielo di qui
 *  chiuderebbe il cerchio degli import — è la stessa ragione per cui i
 *  conteggi delle pose stanno in CRMSidebar e non in crm/ui.
 *
 *  Le due difese contro la ripetizione restano quelle di prima e sono due
 *  perché rispondono a due domande diverse:
 *   · `annunciate` — le chiavi già tentate in QUESTA scheda del browser: senza,
 *     si riproverebbe la stessa scrittura a ogni scatto dell'orologio, cioè
 *     quattro volte al minuto per riga;
 *   · l'indice unico su (user_id, dedupe_key) nel database, che è la difesa
 *     vera: vale fra ricariche di pagina, fra postazioni diverse e — da adesso
 *     — fra le due schermate aperte insieme, che è il caso normale del setter.
 *  ⚠️ LA RISPOSTA DEL SERVER SI LEGGE. Un errore ingoiato qui è un promemoria
 *   che non suona e nessuno che lo sappia; il codice 23505 però NON è un
 *   guasto, è il doppione previsto — qualcun altro (o l'altra scheda) ha già
 *   annunciato la stessa cosa. Il guasto vero si dice UNA volta per sessione:
 *   un toast ogni quindici secondi su una scrittura di sfondo coprirebbe lo
 *   schermo e insegnerebbe a ignorare i toast, compresi quelli che contano. */
export function useAvvisiTask(lista: TaskManuale[], adesso: number, userId?: string): void {
  const annunciate = useRef<Set<string>>(new Set());
  const guastoDetto = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const daDire = avvisiTaskAdesso(lista, new Date(adesso)).filter(
      (a) => !annunciate.current.has(a.chiave),
    );
    if (daDire.length === 0) return;
    for (const a of daDire) annunciate.current.add(a.chiave);
    void (async () => {
      for (const a of daDire) {
        const { error } = await supabase.from("notifications").insert({
          user_id: userId,
          kind: a.tipo,
          severity: a.gravita,
          title: a.titolo,
          body: a.corpo,
          link: a.destinazione,
          dedupe_key: a.chiave,
        });
        if (error && error.code !== "23505" && !guastoDetto.current) {
          guastoDetto.current = true;
          toast.error("Il promemoria non è finito nella campanella", {
            description: error.message,
          });
        }
      }
    })();
  }, [adesso, lista, userId]);
}
