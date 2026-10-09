/** ── DOVE VIVONO LE FATTURE ────────────────────────────────────────────────
 *
 *  Tutto in `app_config`, la tabella chiave/valore che questo CRM usa già per
 *  i preventivi modificati, le cose da fare e il listino. Tre famiglie di
 *  chiavi:
 *
 *    fattura_azienda            → i dati di chi emette, uno solo
 *    fattura:2026-0001          → una fattura EMESSA, immutabile
 *    fattura_bozza:<idLead>     → la bozza in corso per quel cliente, una sola
 *
 *  ── ⚠️ PERCHÉ NON UNA TABELLA VERA ────────────────────────────────────────
 *  Perché crearla vuol dire una migrazione su un database di PRODUZIONE, e
 *  `supabase db push` applica tutte le migrazioni in sospeso — non solo la
 *  propria. Su un archivio con dentro le vendite di un'azienda non è una cosa
 *  che si fa di iniziativa propria. Il giorno in cui si vuole una tabella, la
 *  forma dei dati è già quella giusta (vedi tipi.ts) e a spostarli basta una
 *  lettura e una scrittura.
 *
 *  ── ⚠️ LA CHIAVE È IL NUMERO, ED È QUELLO CHE PROTEGGE LA SERIE ───────────
 *  `key` è la chiave primaria di `app_config`. Scrivere due volte
 *  `fattura:2026-0007` non crea due righe: la seconda sovrascrive la prima.
 *  Per questo la numerazione NON si fida di un contatore a parte — si legge
 *  l'ultimo numero davvero presente e si va avanti da lì. Un contatore
 *  scollegato dall'archivio, prima o poi, ne salta uno o ne ripete uno, e un
 *  numero ripetuto in una serie di fatture è un problema del commercialista,
 *  non un fastidio dell'interfaccia.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabase } from "@/integrations/supabase/client";
import { AZIENDA_VUOTA, comeBozza, type DatiAzienda, type Fattura } from "./tipi";

/** ── L'ARCHIVIO VISTO DA CHI CI SCRIVE ─────────────────────────────────────
 *  Quattro gesti, e nient'altro. Esiste perché questo archivio adesso lo tocca
 *  anche il SERVER: la fattura si emette dal preventivo, cioè da una pagina
 *  pubblica che non può scrivere su `app_config` (RLS), e quella scrittura
 *  passa da una rotta con la chiave di servizio.
 *
 *  ⚠️ E ALLORA LA NUMERAZIONE DEVE ESSERE UNA SOLA. Riscriverla nella rotta —
 *   venti righe, sembra poco — vorrebbe dire due funzioni che decidono qual è
 *   il prossimo numero di fattura. Il giorno in cui divergono non si vede
 *   niente a schermo: escono due fatture con lo STESSO numero, una dal CRM e
 *   una dal preventivo, e il problema lo scopre il commercialista mesi dopo.
 *   Quindi il conto sta scritto una volta e prende in prestito un archivio:
 *   il browser gli passa il suo, il server il proprio. */
export interface ArchivioDb {
  leggi: (key: string) => Promise<string | null>;
  leggiPrefisso: (prefisso: string) => Promise<{ key: string; value: string }[]>;
  /** torna il messaggio d'errore, oppure null se è andata */
  scrivi: (key: string, value: string) => Promise<string | null>;
  elimina: (key: string) => Promise<string | null>;
}

/** Costruisce l'archivio sopra un client Supabase, quale che sia: quello del
 *  browser o `supabaseAdmin`. ⚠️ Il cast è il solito — i tipi generati non
 *  conoscono `app_config` — ed è confinato qui invece di essere sparso. */
export function archivioSu(client: unknown): ArchivioDb {
  const c = client as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: { value?: string } | null }>;
        };
        like: (
          k: string,
          v: string,
        ) => Promise<{
          data: { key: string; value?: string }[] | null;
          error: { message: string } | null;
        }>;
      };
      upsert: (
        v: { key: string; value: string },
        o: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
      delete: () => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  return {
    leggi: async (key) => {
      const { data } = await c.from("app_config").select("value").eq("key", key).maybeSingle();
      return data?.value ?? null;
    },
    leggiPrefisso: async (prefisso) => {
      /*  ── ⚠️ L'UNDERSCORE VA PROTETTO ────────────────────────────────────
          In SQL `_` dentro un LIKE non è un underscore: è un JOLLY che vale
          un carattere qualunque. Le chiavi di questo archivio ne sono piene —
          `fattura_bozza:`, `fattura_forn:`, `costi_mese:` — quindi
          «fattura_forn:%» pesca anche «fatturaXforn:%», e domani un nome
          scelto senza saperlo finirebbe nell'elenco sbagliato.
          Verificato in produzione: oggi nessuna chiave collide, e questo è il
          momento giusto per chiudere la porta — perché il chiamante più
          delicato è la NUMERAZIONE DELLE FATTURE, che legge le emesse per
          decidere il prossimo numero. Una riga di troppo là dentro non dà un
          errore: dà due fatture con lo stesso numero, e se ne accorge il
          commercialista mesi dopo.
          `\` è il carattere di protezione predefinito di Postgres. */
      const protetto = prefisso.replace(/[\\%_]/g, (ch) => `\\${ch}`);
      const { data, error } = await c
        .from("app_config")
        .select("key,value")
        .like("key", `${protetto}%`);
      //  ⚠️ Una lettura fallita NON deve somigliare a «non c'è niente»: chi
      //   numera le fatture deve poter distinguere i due casi, o assegnerà un
      //   numero già usato. Si rilancia, e chi chiama decide.
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ key: r.key, value: String(r.value ?? "") }));
    },
    scrivi: async (key, value) => {
      const { error } = await c.from("app_config").upsert({ key, value }, { onConflict: "key" });
      return error?.message ?? null;
    },
    elimina: async (key) => {
      const { error } = await c.from("app_config").delete().eq("key", key);
      return error?.message ?? null;
    },
  };
}

/** L'archivio del browser: è quello che usano le schermate del CRM. */
/** L'archivio del browser. ⚠️ Esportato perché lo usano anche le spese fisse
 *  del mese (crm/costi-mese): scrivere un secondo accesso a `app_config` accanto
 *  a questo vorrebbe dire due modi di leggere la stessa tabella. */
export const archivio = archivioSu(supabase);

/** ⚠️ IL SOLITO INGANNO SUI TIPI, e per il solito motivo: i tipi generati di
 *  Supabase in questo repo non conoscono `app_config` (vedi la stessa cosa in
 *  crm/dafare/task-manuali). Si dichiara qui la forma che serve invece di
 *  spargere `any` per il file. */
const db = supabase as unknown as {
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
      like: (
        k: string,
        v: string,
      ) => Promise<{
        data: { key: string; value?: string }[] | null;
        error: { message: string } | null;
      }>;
    };
    upsert: (
      v: { key: string; value: string },
      o: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

const CHIAVE_AZIENDA = "fattura_azienda";
const PREFISSO_EMESSA = "fattura:";
const PREFISSO_BOZZA = "fattura_bozza:";

export const chiaveBozza = (leadId: string) => `${PREFISSO_BOZZA}${leadId}`;

/** Il numero come si scrive: «0007», quattro cifre. Serve anche a far ordinare
 *  le chiavi alfabeticamente nell'ordine giusto — senza lo zero davanti, la
 *  10 verrebbe prima della 9. */
export const numeroScritto = (n: number) => String(Math.max(0, n)).padStart(4, "0");

/** Il nome per esteso di una fattura emessa: «2026/0007» oppure «2026/A/0007». */
export function etichettaNumero(f: Fattura): string {
  if (f.stato !== "emessa") return "bozza";
  return [f.anno, f.serie || null, numeroScritto(f.numero)].filter(Boolean).join("/");
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. CHI EMETTE
   ═════════════════════════════════════════════════════════════════════════ */

export async function leggiAzienda(): Promise<DatiAzienda> {
  const { data } = await db
    .from("app_config")
    .select("value")
    .eq("key", CHIAVE_AZIENDA)
    .maybeSingle();
  if (!data?.value) return { ...AZIENDA_VUOTA };
  try {
    //  ⚠️ Si fondono i campi con quelli vuoti invece di fidarsi del salvato: un
    //   dato scritto prima che un campo esistesse tornerebbe `undefined` e
    //   finirebbe stampato nell'XML come "undefined". Meglio vuoto, che il
    //   modulo sa segnalare.
    return { ...AZIENDA_VUOTA, ...(JSON.parse(data.value) as Partial<DatiAzienda>) };
  } catch {
    return { ...AZIENDA_VUOTA };
  }
}

export async function salvaAzienda(a: DatiAzienda): Promise<string | null> {
  const { error } = await db
    .from("app_config")
    .upsert({ key: CHIAVE_AZIENDA, value: JSON.stringify(a) }, { onConflict: "key" });
  return error?.message ?? null;
}

/** ── I CAMPI SENZA I QUALI NON SI EMETTE ──────────────────────────────────
 *  Restituisce l'elenco di quelli che mancano, in italiano, pronto da mostrare.
 *  ⚠️ Vuoto NON vuol dire «la fattura è corretta»: vuol dire che nessuno dei
 *   campi che lo SDI rifiuta di sicuro è rimasto in bianco. La correttezza
 *   fiscale la stabilisce il commercialista sulla prima fattura vera, e questa
 *   funzione non è un sostituto di quel controllo. */
export function mancanzeAzienda(a: DatiAzienda): string[] {
  const out: string[] = [];
  if (!a.denominazione.trim()) out.push("la ragione sociale");
  if (!a.partitaIva.trim()) out.push("la partita IVA");
  if (!a.codiceFiscale.trim()) out.push("il codice fiscale");
  if (!a.indirizzo.trim()) out.push("l'indirizzo della sede");
  if (!a.cap.trim()) out.push("il CAP");
  if (!a.comune.trim()) out.push("il comune");
  if (!a.provincia.trim()) out.push("la provincia");
  //  ⚠️ Il REA è facoltativo nell'XML, ma A METÀ fa scartare il file: se c'è
  //   l'ufficio ci deve essere anche il numero, e viceversa.
  if (!!a.reaUfficio.trim() !== !!a.reaNumero.trim())
    out.push("il REA per intero (ufficio e numero, o nessuno dei due)");
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LE FATTURE
   ═════════════════════════════════════════════════════════════════════════ */

function leggiUna(riga: { key: string; value?: string }): Fattura | null {
  try {
    const f = JSON.parse(String(riga.value ?? "")) as Fattura;
    return f && typeof f === "object" && f.id ? f : null;
  } catch {
    //  Una riga illeggibile non deve abbattere l'elenco intero: si salta, e le
    //  altre si vedono. Un elenco vuoto per colpa di una riga rotta è il modo
    //  più rapido di far credere che le fatture siano sparite.
    return null;
  }
}

/** Tutte le fatture emesse, dalla più recente. */
export async function leggiEmesse(): Promise<{ ok: boolean; lista: Fattura[]; errore?: string }> {
  const { data, error } = await db
    .from("app_config")
    .select("key,value")
    .like("key", `${PREFISSO_EMESSA}%`);
  if (error) return { ok: false, lista: [], errore: error.message };
  const lista = (data ?? []).map(leggiUna).filter((f): f is Fattura => !!f);
  //  Per anno e numero decrescenti: l'ultima emessa è quella che si cerca.
  lista.sort((a, b) => b.anno - a.anno || b.numero - a.numero);
  return { ok: true, lista };
}

/** Tutte le bozze in giro, dalla più recente. */
export async function leggiBozze(): Promise<{ ok: boolean; lista: Fattura[]; errore?: string }> {
  const { data, error } = await db
    .from("app_config")
    .select("key,value")
    .like("key", `${PREFISSO_BOZZA}%`);
  if (error) return { ok: false, lista: [], errore: error.message };
  const lista = (data ?? []).map(leggiUna).filter((f): f is Fattura => !!f);
  lista.sort((a, b) => String(b.creataIl).localeCompare(String(a.creataIl)));
  return { ok: true, lista };
}

/** ── LA BOZZA DI QUESTA PERSONA ────────────────────────────────────────────
 *  Si cerca prima con la chiave della scheda, e se non c'è si cerca per EMAIL
 *  fra tutte le bozze.
 *
 *  ⚠️ IL SECONDO GIRO ESISTE PERCHÉ LE BOZZE NASCONO IN DUE POSTI. Dal CRM si
 *   parte da una scheda e la chiave è il suo id; dal configuratore del
 *   preventivo la scheda non esiste ancora — c'è solo la persona che si sta
 *   intestando il documento — e la chiave è la sua email. Senza questa ricerca,
 *   il consulente che ha raccolto codice fiscale e residenza davanti al cliente
 *   se li ritroverebbe solo nell'elenco delle fatture, e riaprendo la scheda
 *   ricomincerebbe da campi vuoti: li ribatterebbe, e la seconda volta un
 *   codice fiscale si copia peggio.
 *  ⚠️ E serve anche a NON CREARE DUE BOZZE per lo stesso cliente: trovandola,
 *   la finestra la riprende e la risalva sulla sua chiave. */
export async function leggiBozzaDi(leadId: string, email?: string): Promise<Fattura | null> {
  const { data } = await db
    .from("app_config")
    .select("value")
    .eq("key", chiaveBozza(leadId))
    .maybeSingle();
  const sua = data?.value ? leggiUna({ key: "", value: data.value }) : null;
  if (sua) return sua;

  const pulita = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!pulita) return null;
  const tutte = await leggiBozze();
  if (!tutte.ok) return null;
  return (
    tutte.lista.find(
      (f) => (f.cliente.pec || "").toLowerCase() === pulita || f.emailOrigine === pulita,
    ) ?? null
  );
}

export async function salvaBozza(f: Fattura): Promise<string | null> {
  const { error } = await db
    .from("app_config")
    .upsert({ key: chiaveBozza(f.leadId), value: JSON.stringify(f) }, { onConflict: "key" });
  return error?.message ?? null;
}

export async function eliminaBozza(leadId: string): Promise<string | null> {
  const { error } = await db.from("app_config").delete().eq("key", chiaveBozza(leadId));
  return error?.message ?? null;
}

/** ── IL PROSSIMO NUMERO LIBERO ─────────────────────────────────────────────
 *  Il più grande fra due cose: quello che dicono le impostazioni (il punto da
 *  cui partire per non scavallare le fatture che il commercialista ha già
 *  emesso) e l'ultimo davvero presente in archivio più uno.
 *
 *  ⚠️ SI CONTA SOLO L'ANNO CORRENTE: la numerazione riparte ogni anno, ed è
 *   anche il motivo per cui l'anno sta nella chiave.
 *  ⚠️ E SI RILEGGE L'ARCHIVIO OGNI VOLTA, invece di tenersi un contatore: un
 *   contatore scollegato dalle righe vere prima o poi salta un numero o ne
 *   ripete uno, e i buchi in una serie di fatture li deve spiegare qualcuno. */
export async function prossimoNumeroSu(
  archivioScelto: ArchivioDb,
  a: DatiAzienda,
  anno: number,
): Promise<{ ok: boolean; numero: number; errore?: string }> {
  let lista: Fattura[];
  try {
    lista = (await archivioScelto.leggiPrefisso(PREFISSO_EMESSA))
      .map(leggiUna)
      .filter((f): f is Fattura => !!f);
  } catch (e) {
    //  ⚠️ SE L'ARCHIVIO NON SI LEGGE NON SI NUMERA. Tirare a indovinare qui vuol
    //   dire emettere una fattura con un numero già usato, e una volta uscita
    //   non si corregge più: si annulla con una nota di credito.
    return {
      ok: false,
      numero: 0,
      errore: e instanceof Error ? e.message : "archivio illeggibile",
    };
  }
  const diQuestAnno = lista.filter((f) => f.anno === anno && f.serie === (a.serie || ""));
  const ultimo = diQuestAnno.reduce((m, f) => Math.max(m, f.numero), 0);
  const daImpostazioni = a.annoNumerazione === anno ? Math.max(1, a.primoNumero) : 1;
  return { ok: true, numero: Math.max(ultimo + 1, daImpostazioni) };
}

/** Il prossimo numero, dall'archivio del browser. */
export const prossimoNumero = (a: DatiAzienda, anno: number) => prossimoNumeroSu(archivio, a, anno);

/** ── L'EMISSIONE ───────────────────────────────────────────────────────────
 *  Assegna numero e data, scrive la riga definitiva e toglie la bozza.
 *
 *  ⚠️ L'ORDINE È: PRIMA LA FATTURA, POI LA BOZZA. Se cade la rete in mezzo,
 *   restano una fattura emessa e una bozza da buttare — fastidioso e visibile.
 *   Al contrario resterebbero zero fatture e nessuna bozza, cioè il lavoro
 *   sparito senza traccia.
 *  ⚠️ E LA BOZZA CANCELLATA NON FA FALLIRE NIENTE: la fattura c'è, ed è quello
 *   che conta. La bozza rimasta si vede nell'elenco e si toglie a mano. */
export async function emettiSu(
  archivioScelto: ArchivioDb,
  f: Fattura,
  a: DatiAzienda,
  /** ⚠️ IL GIORNO DELL'INCASSO, non «oggi». La data di una fattura immediata è
   *  quella dell'operazione, e per un acconto l'operazione è il momento in cui
   *  i soldi sono arrivati — non quello in cui ci si siede a compilarla. Chi
   *  incassa il 28 ed emette il 30 mette 28.
   *  ⚠️ E DA QUESTA DATA DIPENDE ANCHE L'ANNO DELLA NUMERAZIONE: un incasso del
   *   30 dicembre fatturato il 3 gennaio resta una fattura dell'anno vecchio, e
   *   prende il numero di quella serie. Prendere l'anno dall'orologio avrebbe
   *   aperto la numerazione nuova con un documento che non le appartiene. */
  dataIncasso: string,
): Promise<{ ok: boolean; fattura?: Fattura; errore?: string }> {
  const oggi = dataIncasso;
  const anno = Number(oggi.slice(0, 4)) || new Date().getFullYear();
  const n = await prossimoNumeroSu(archivioScelto, a, anno);
  if (!n.ok) return { ok: false, errore: n.errore || "non riesco a leggere le fatture già emesse" };

  const emessa: Fattura = {
    ...f,
    stato: "emessa",
    numero: n.numero,
    anno,
    serie: a.serie || "",
    data: oggi,
    dataPagamento: oggi,
    id: `${anno}-${numeroScritto(n.numero)}`,
    emessaIl: new Date().toISOString(),
  };
  const chiave = `${PREFISSO_EMESSA}${emessa.id}${a.serie ? `-${a.serie}` : ""}`;
  const errore = await archivioScelto.scrivi(chiave, JSON.stringify(emessa));
  if (errore) return { ok: false, errore };
  await archivioScelto.elimina(chiaveBozza(f.leadId));
  return { ok: true, fattura: emessa };
}

/** L'emissione dall'archivio del browser: è quella che usa il CRM. */
export const emetti = (f: Fattura, a: DatiAzienda, dataIncasso: string) =>
  emettiSu(archivio, f, a, dataIncasso);

/** ── ELIMINARE UNA FATTURA EMESSA = RIMETTERLA IN BOZZA ──────────────────
 *  Richiesta del committente: eliminando una fattura, i dati non devono
 *  sparire — deve tornare una bozza già compilata, pronta da correggere e
 *  riemettere.
 *
 *  ── ⚠️ PERCHÉ NON È SOLO «UN CESTINO PIÙ GENTILE» ────────────────────────
 *  Perché il motivo vero per cui si elimina una fattura emessa è che è
 *  SBAGLIATA: una cifra storta, il cliente intestato male, la data dell'incasso
 *  presa dall'orologio invece che dal bonifico. Prima di oggi quel gesto
 *  buttava via anche le venti cose giuste — codice fiscale, residenza, codice
 *  destinatario, righe, causale — e la fattura corretta si ribatteva da capo.
 *  Ribattere un codice fiscale è il modo più comune di scriverne uno diverso
 *  dal primo, ed è un documento scartato dallo SDI giorni dopo.
 *
 *  ── ⚠️ PRIMA SI POSA LA BOZZA, POI SI TOGLIE LA FATTURA ──────────────────
 *  Lo stesso ordine di `emettiSu`, e per lo stesso motivo. Se la rete cade in
 *  mezzo restano la fattura E la sua bozza: fastidioso, ma visibile e
 *  rimediabile in due clic. All'incontrario resterebbero zero fatture e zero
 *  bozze, cioè il lavoro sparito senza che nessuno se ne accorga.
 *
 *  ── ⚠️ E QUELLO CHE QUESTA FUNZIONE *NON* PUÒ DISFARE ────────────────────
 *  Il numero. Togliendolo restano due casi diversi, e li racconta la finestra
 *  di conferma (routes/CRM.fatture) prima di arrivare qui:
 *   · era L'ULTIMA → il numero torna libero e lo prende la prossima;
 *   · era IN MEZZO → resta un buco nella serie, che il commercialista dovrà
 *     spiegare.
 *  E se il documento era già stato trasmesso allo SDI, qui si perde solo la
 *  nostra copia: all'Agenzia esiste ancora, e si annulla con una nota di
 *  credito. Nessuna bozza rimette a posto quello. */
export async function rimettiInBozza(f: Fattura): Promise<string | null> {
  const chiave = `${PREFISSO_EMESSA}${f.id}${f.serie ? `-${f.serie}` : ""}`;

  //  ⚠️ SENZA SCHEDA NON C'È DOVE POSARLA. Le bozze stanno una per cliente,
  //   sotto la chiave della sua scheda: con `leadId` vuoto la chiave sarebbe
  //   «fattura_bozza:» — cioè il prefisso stesso, una riga che finirebbe
  //   nell'elenco di tutte le bozze e che la prossima fattura senza scheda
  //   sovrascriverebbe. Meglio l'eliminazione secca di una bozza che si pesta
  //   i piedi con le altre; la finestra lo dice prima di farlo.
  if (!puoTornareInBozza(f)) return archivio.elimina(chiave);

  //  ⚠️ IL POSTO DEVE ESSERE LIBERO, E UNA LETTURA FALLITA NON È «È LIBERO».
  //   Di bozze per cliente ne esiste UNA: se ce n'è già una aperta — un saldo
  //   che qualcuno sta preparando — posarci sopra questa la cancellerebbe in
  //   silenzio. Quindi non si elimina niente e si dice perché. È lo stesso
  //   motivo per cui `leggiPrefisso` rilancia invece di tornare vuoto: qui
  //   «non ho potuto leggere» e «non c'è niente» portano a due gesti opposti.
  const { data, error } = await db
    .from("app_config")
    .select("value")
    .eq("key", chiaveBozza(f.leadId))
    .maybeSingle();
  if (error) return `non riesco a controllare le bozze di questo cliente (${error.message})`;
  if (data?.value)
    return "c'è già una bozza aperta per questo cliente: emettila o buttala, poi riprova";

  const nonScritta = await salvaBozza(comeBozza(f));
  if (nonScritta) return nonScritta;

  return archivio.elimina(chiave);
}

/** Vero se questa fattura ha una scheda cliente a cui agganciare la bozza —
 *  cioè se eliminandola i dati tornano invece di sparire. La finestra di
 *  conferma lo chiede per dire la cosa giusta PRIMA, non dopo. */
export function puoTornareInBozza(f: Fattura): boolean {
  return !!String(f.leadId ?? "").trim();
}

/** Vero se questa è l'ULTIMA della sua serie, cioè se cancellandola il numero
 *  torna libero invece di lasciare un buco. Serve alla finestra di conferma per
 *  dire quale delle due cose sta per succedere. */
export function eUltimaDellaSerie(f: Fattura, emesse: Fattura[]): boolean {
  const stessaSerie = emesse.filter((x) => x.anno === f.anno && x.serie === f.serie);
  return stessaSerie.every((x) => x.numero <= f.numero);
}

/** ── RISCRIVERE UNA FATTURA GIÀ EMESSA ────────────────────────────────────
 *  ⚠️ SERVE PER UNA COSA SOLA: registrare quando è arrivato il pagamento. Non è
 *   un modo per correggere una fattura — numero, data e importi di un documento
 *   in una serie non si riscrivono, si annullano con una nota di credito. Chi
 *   la usa per altro sta facendo un danno che si vede solo dal commercialista.
 *  La chiave si ricostruisce dall'id, che non cambia: si sovrascrive quella
 *  riga, non se ne crea una seconda. */
export async function salvaEmessa(f: Fattura): Promise<string | null> {
  return archivio.scrivi(
    `${PREFISSO_EMESSA}${f.id}${f.serie ? `-${f.serie}` : ""}`,
    JSON.stringify(f),
  );
}

/** ── I DATI DELL'AZIENDA, DA UN ARCHIVIO QUALUNQUE ────────────────────────
 *  Serve al server, che emette dal preventivo e deve leggere le stesse
 *  impostazioni del CRM — aliquota, sezionale, numero di partenza. */
export async function leggiAziendaSu(archivioScelto: ArchivioDb): Promise<DatiAzienda> {
  const grezzo = await archivioScelto.leggi(CHIAVE_AZIENDA);
  if (!grezzo) return { ...AZIENDA_VUOTA };
  try {
    return { ...AZIENDA_VUOTA, ...(JSON.parse(grezzo) as Partial<DatiAzienda>) };
  } catch {
    return { ...AZIENDA_VUOTA };
  }
}
