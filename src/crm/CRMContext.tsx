import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { assicuraCapienza } from "./capienza";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
//  La durata di serie di una consulenza: una sola per tutto il CRM.
import { DURATA_PREDEFINITA } from "./invito";
import { intestazioniCRM, useAuth, useConsulenteCollegato } from "./AuthContext";
import {
  applyAutoStatus,
  eChiusuraVinta,
  migliorConsulente,
  type AdSpending,
  type Consultant,
  type ConsultantData,
  type Lead,
  type LeadData,
} from "./types";
import { STATI_CONSULENZA, eConversione, ricavoLordo } from "./kpi-calcoli";
//  Chi fa le consulenze si chiede lì: vedi la testata di quel file per il perché
//  la stessa domanda non si riscrive in ogni punto che sceglie una persona.
import { soloConsulenti } from "./chi-fa-la-consulenza";
import { risolviModifica, type Modifica } from "./patch-scheda";
import { leadRevenue, shouldDispatchLeadToAds } from "./lead-analytics";
//  «Ha già una stanza Meetly?»: unica definizione, vedi crm/whatsapp.
import { codiceStanzaDi, haStanzaNostra, impostaLinkPreventivi } from "./whatsapp";
import { linkPerOgniCliente } from "./preventivi/link-nei-messaggi";
import { copiaAttendibile, filoDellArchivio, fondiSchede } from "./copia-archivio";
//  Chi ha PRESO l'appuntamento (≠ chi ha toccato lo stato per ultimo, ≠ chi lo
//  farà): la regola sta lì e si prova senza browser.
import { patchChiFissa } from "./chi-ha-fissato";
//  «L'appuntamento si è spostato?» — la regola sta a parte perché si prova:
//  vedi crm/spostamento-meet.ts e proveDelloSpostamento in prove/prove.mjs.
import { anteprimaDaRifare, consulenzaSpostata } from "./spostamento-meet";

interface CRMContextValue {
  leads: Lead[];
  consultants: Consultant[];
  adSpending: AdSpending[];
  loading: boolean;
  reload: () => Promise<void>;
  // leads
  createLead: (data: LeadData) => Promise<Lead | null>;
  /** ── RESTITUISCE SE HA SALVATO DAVVERO ──────────────────────────────────
   *  ⚠️ Era `Promise<void>`, e questa riga da sola è costata un collaudo: chi
   *   scriveva `await updateLead(...)` e subito dopo un toast «salvato» stava
   *   promettendo una cosa che nessuno aveva verificato, perché in caso di
   *   errore qui dentro si scriveva una riga in console e si tornava indietro
   *   con la stessa promessa risolta del caso riuscito. Tre schermate diverse
   *   si erano già pagate una rilettura della riga dal database pur di sapere
   *   com'era andata (CRM.importa, ChiusuraDialog, le note di MeetGiornalieri).
   *   Ora la risposta c'è: `false` = NON è stato scritto niente, e chi maneggia
   *   soldi deve guardarla. Chi non la guarda continua a funzionare come prima
   *   — un valore restituito in più non rompe nessun chiamante. */
  /*  ── ⚠️ LA MODIFICA PUÒ ESSERE UNA FUNZIONE ──────────────────────────
      `updateLead` rilegge la riga dall'archivio prima di fondere, quindi la
      scheda intera non riporta più indietro il lavoro di un collega. Ma chi
      scrive un SOTTO-oggetto — `{ installazione: { ...l.data.installazione,
      priorita: true } }` — lo compone PRIMA, sulla copia che il browser ha in
      memoria: la rilettura trova la riga fresca e ci mette sopra un oggetto
      costruito su dati vecchi, e il tecnico scritto da un collega un minuto
      prima sparisce. Passando una funzione il pezzo si compone DOPO la
      rilettura, con davanti la scheda vera. Vedi crm/patch-scheda. */
  updateLead: (id: string, data: Modifica<LeadData>) => Promise<boolean>;
  /** ── DICE SE LA RIGA È SPARITA DAVVERO ──────────────────────────────────
   *  ⚠️ Era `Promise<void>`: esattamente il difetto che la riga qui sopra si è
   *   già pagata. In caso di errore si scriveva una riga in console e si
   *   tornava indietro con la stessa promessa risolta del caso riuscito, così
   *   chi premeva il cestino non poteva distinguere «tolto» da «il database ha
   *   detto di no» — e visto che qui NON esiste nessun cestino da cui
   *   ripescare, l'unico modo di accorgersene era ricaricare la pagina e
   *   ritrovarsi davanti la persona che si era appena letto «eliminata».
   *   Adesso: `true` = nell'archivio quella riga non c'è più; `false` = c'è
   *   ancora, e il motivo è già andato a schermo — come fa `createConsultant`
   *   da quando aggiungere una persona poteva fallire in silenzio. Chi il
   *   valore non lo guarda continua a funzionare come prima. */
  deleteLead: (id: string) => Promise<boolean>;
  // consultants
  createConsultant: (data: ConsultantData) => Promise<Consultant | null>;
  updateConsultant: (id: string, data: Partial<ConsultantData>) => Promise<void>;
  /** Il gesto del cestino, tutto intero: revoca l'accesso e poi spegne o
   *  elimina. Non esiste più una cancellazione «nuda» — vedi qui sotto. */
  rimuoviConsulente: (id: string) => Promise<EsitoRimozione>;
  /** Il consulente a cui tocca il prossimo lead (meno chiamate oggi, poi priorità). */
  prossimoConsulente: () => Consultant | null;
  // ad spending
  createAdSpending: (data: AdSpending["data"]) => Promise<void>;
  deleteAdSpending: (id: string) => Promise<void>;
}

const CRMContext = createContext<CRMContextValue | null>(null);

/* ═══════════════════════════════════════════════════════════════════════════
   TOGLIERE UNA PERSONA DAL CRM
   ═════════════════════════════════════════════════════════════════════════ */

/** ── QUELLO CHE UNA PERSONA SI LASCIA DIETRO ───────────────────────────────
 *  Si conta su TUTTO lo storico, non sul periodo scelto nella pagina: il
 *  filtro delle date decide che cosa si sta guardando, non che cosa esiste.
 *  Contando solo il periodo, un consulente fermo da due mesi risulterebbe
 *  «senza niente» e verrebbe cancellato con addosso i numeri dell'anno scorso.
 *
 *  L'attribuzione è `lead.data.consulenteId`, l'unico campo che questo CRM usa
 *  per dire di chi è una scheda (lo stesso di kpi-calcoli e kpi-setter): se
 *  cambia lì, cambia anche qui, o i numeri della conferma non sarebbero quelli
 *  della tabella. */
export interface StoricoConsulente {
  lead: number;
  consulenze: number;
  clienti: number;
  fatturato: number;
  /** La domanda che decide fra spegnere e cancellare davvero. */
  haStoria: boolean;
}

const STORICO_VUOTO: StoricoConsulente = {
  lead: 0,
  consulenze: 0,
  clienti: 0,
  fatturato: 0,
  haStoria: false,
};

export function storicoConsulente(leads: Lead[], id: string): StoricoConsulente {
  //  ⚠️ Senza id si esce subito: `undefined === undefined` farebbe combaciare
  //  tutte le schede non assegnate e la conferma direbbe numeri di nessuno.
  if (!id) return STORICO_VUOTO;
  const suoi = (Array.isArray(leads) ? leads : []).filter((l) => l?.data?.consulenteId === id);
  const clienti = suoi.filter((l) => eConversione(l));
  return {
    lead: suoi.length,
    consulenze: suoi.filter((l) => STATI_CONSULENZA.includes(String(l.data?.stato ?? ""))).length,
    clienti: clienti.length,
    fatturato: clienti.reduce((s, l) => s + ricavoLordo(l), 0),
    haStoria: suoi.length > 0,
  };
}

/** Che cosa è successo davvero: «spento» non è «eliminato», e chi ha premuto
 *  deve leggerlo scritto — sono due cose diverse. */
export type ModoRimozione = "spento" | "eliminato";

export interface EsitoRimozione {
  ok: boolean;
  modo?: ModoRimozione;
  /** Il motivo del no, con le parole del server: è quello che va a schermo. */
  motivo?: string;
  /** È andata bene, ma NON come diceva la conferma appena letta: si è premuto
   *  «Elimina definitivamente» e il database ha rivelato dei lead che questa
   *  pagina non aveva, quindi la persona è stata spenta. Va detto a schermo —
   *  un gesto che fa una cosa diversa da quella annunciata, e tace, è peggio di
   *  un errore. */
  avviso?: string;
}

/** L'avviso di «lead non eliminato», uno solo a schermo. L'`id` fisso serve
 *  alle eliminazioni di gruppo: venti righe rifiutate di fila per lo stesso
 *  motivo — quasi sempre la rete o i permessi — lascerebbero venti avvisi
 *  identici impilati uno sull'altro, e il messaggio si legge peggio proprio
 *  quando è più importante. Con l'id, sonner aggiorna quello che c'è già; a
 *  dire QUANTE non sono passate è la pagina, che se le ritrova ancora
 *  selezionate. */
const AVVISO_ELIMINA = "lead-non-eliminato";

/** ── L'IDENTIFICATIVO CON CUI META RICONOSCE UN EVENTO ────────────────────
 *  Serve alla deduplica: due invii con lo stesso `event_id` e lo stesso nome
 *  evento sono lo STESSO fatto, e Meta ne conta uno.
 *
 *  ⚠️ QUI SI GENERAVA UN NUMERO A CASO A OGNI CHIAMATA, e così la deduplica
 *   non poteva funzionare nemmeno volendo: lo stesso acquisto rimandato —
 *   perché la vendita era stata riaperta, o perché la prima volta la rete era
 *   caduta — arrivava a Meta con un identificativo mai visto, cioè come un
 *   secondo acquisto. Un identificativo casuale è utile solo se lo si
 *   CONSERVA; generarlo e buttarlo via è il contrario di ciò che serve.
 *   Adesso è l'id del lead: stabile per sempre, uguale a ogni invio, e quindi
 *   la rete di sicurezza di Meta lavora insieme alla nostra (`adsPurchaseIl`).
 *  Resta prioritario `tracking.event_id`, quando c'è: è quello con cui il
 *  pixel del browser ha già annunciato lo stesso fatto, e cambiarlo qui
 *  spezzerebbe la deduplica fra pixel e server, che è la ragione per cui quel
 *  campo esiste. */
function buildCrmEventId(lead: Lead): string {
  if (lead.data.tracking?.event_id) return lead.data.tracking.event_id;
  return `crm-lead-${lead.id}`;
}

export function CRMProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  //  Chi sta lavorando adesso, per firmare i cambi di stato: vedi `statoDa` in
  //  crm/types. `null` quando si entra con email e password senza scegliere un
  //  nome — e in quel caso non si firma niente.
  const consulenteCollegato = useConsulenteCollegato();
  const [leads, setLeads] = useState<Lead[]>([]);
  /*  ── ⚠️ L'ELENCO SEMPRE FRESCO, NON QUELLO DEL DISEGNO IN CORSO ────────
      Segnalazione del committente: «quando cambio stato del lead lo devo fare
      due volte prima che cambi».
      Era questo. `updateLead` partiva da `leads`, cioè dall'elenco catturato
      nel disegno in cui la funzione è nata. Due salvataggi ravvicinati sullo
      stesso lead — e ce ne sono: cambiare stato fa nascere la stanza della
      consulenza, che salva il link un istante dopo — leggevano ENTRAMBI
      l'elenco di PRIMA: il secondo scriveva sul database i dati vecchi più il
      suo campo, e lo stato appena scelto tornava indietro. Al secondo
      tentativo non c'era più niente da salvare dopo, e allora restava.
      Il riferimento cambia valore SUBITO, senza aspettare il disegno
      successivo: chi salva legge sempre l'ultima verità. */
  const leadsRef = useRef<Lead[]>([]);
  leadsRef.current = leads;
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  //  Stesso motivo del riferimento qui sopra: il nome del consulente serve
  //  mentre si deposita un biglietto, che succede dopo un salvataggio — quando
  //  il valore catturato al disegno può già essere vecchio.
  const consultantsRef = useRef<Consultant[]>([]);
  consultantsRef.current = consultants;
  const [adSpending, setAdSpending] = useState<AdSpending[]>([]);
  const [loading, setLoading] = useState(false);

  const dispatchToCapi = useCallback(async (body: Record<string, unknown>) => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capi`;
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        keepalive: true,
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.warn("CAPI dispatch failed", error);
    }
  }, []);

  const dispatchLeadToAds = useCallback(
    async (lead: Lead) => {
      if (!user || typeof window === "undefined" || !shouldDispatchLeadToAds(lead)) return;
      const t = lead.data.tracking;
      await dispatchToCapi({
        event_name: "Lead",
        event_id: buildCrmEventId(lead),
        event_source_url: window.location.href,
        admin_user_id: user.id,
        user_data: {
          email: lead.data.email,
          phone: lead.data.telefono,
          first_name: lead.data.nome,
          last_name: lead.data.cognome,
          city: lead.data.citta,
          fbp: t?.fbp,
          fbc: t?.fbc,
          ttclid: t?.ttclid,
          external_id: t?.external_id,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
        custom_data: {
          value: 1,
          currency: "EUR",
          content_name: "crm_lead",
          ad_id: t?.ad_id,
          adset_id: t?.adset_id,
          campaign_id: t?.campaign_id,
          ad_name: t?.ad_name,
          creative_name: t?.creative_name,
          utm_source: t?.utm_source,
          utm_campaign: t?.utm_campaign,
        },
      });
    },
    [user, dispatchToCapi],
  );

  // Offline Conversion API: invia evento Purchase a Meta CAPI quando un lead
  // diventa "venduto" o "acconto", con il valore reale del CRM.
  const dispatchPurchaseToAds = useCallback(
    async (lead: Lead, value: number) => {
      if (!user || typeof window === "undefined" || !shouldDispatchLeadToAds(lead)) return;
      if (!value || value <= 0) return;
      const t = lead.data.tracking;
      await dispatchToCapi({
        event_name: "Purchase",
        event_id: `${buildCrmEventId(lead)}-purchase`,
        event_source_url: window.location.href,
        admin_user_id: user.id,
        source: t?.source,
        user_data: {
          email: lead.data.email,
          phone: lead.data.telefono,
          first_name: lead.data.nome,
          last_name: lead.data.cognome,
          city: lead.data.citta,
          fbp: t?.fbp,
          fbc: t?.fbc,
          ttclid: t?.ttclid,
          external_id: t?.external_id,
        },
        custom_data: {
          value,
          currency: "EUR",
          //  ── ⚠️ QUI ANDAVA `payment.prodotto`, E NON DOVEVA ────────────
          //   Sulla carta quel campo è «il prodotto». Nei dati veri di questo
          //   CRM contiene gli appunti della consulenza, e uno dei valori oggi
          //   in archivio è: «53 anni marittimo 16 x 26 x 19 90% densità … ha
          //   malattia a lavoro per il video … 2 IMPIANTI».
          //   Questa chiamata manda l'evento a Meta INSIEME a email, telefono,
          //   nome, cognome e città della stessa persona: significava spedire a
          //   una piattaforma pubblicitaria età, mestiere, misure della testa e
          //   uno stato di salute, agganciati a un'identità. È vietato dalle
          //   condizioni di Meta ed è un dato particolare ai sensi del GDPR —
          //   la categoria che richiede un consenso esplicito che qui nessuno
          //   ha raccolto.
          //   ⚠️ QUESTO CAMPO SERVE A RAGGRUPPARE LE CONVERSIONI, non a
          //    descrivere il singolo cliente: un'etichetta fissa fa esattamente
          //    il suo mestiere. Se un giorno serviranno più categorie, si
          //    scelgano da un elenco chiuso — mai da un campo scritto a mano.
          content_name: "protesi capillare",
          ad_id: t?.ad_id,
          adset_id: t?.adset_id,
          campaign_id: t?.campaign_id,
          ad_name: t?.ad_name,
          creative_name: t?.creative_name,
          utm_source: t?.utm_source,
          utm_campaign: t?.utm_campaign,
        },
      });
    },
    [user, dispatchToCapi],
  );

  /*  ── ⚠️ L'ARCHIVIO NON STA IN UNA RISPOSTA SOLA ────────────────────────
      Il server restituisce al massimo mille righe per richiesta. Finché le
      schede erano poche non si vedeva; superate le mille, le altre non
      sarebbero mai arrivate nel browser — e una scheda che non è nell'elenco
      in memoria è una scheda che non si può salvare (vedi `updateLead`), non
      si può cercare e non conta nelle statistiche. Un archivio che cresce
      avrebbe cominciato a perdere pezzi in silenzio, dai più vecchi.
      Qui si chiede a blocchi finché il server non ne dà meno di un blocco
      pieno: è l'unico modo per essere sicuri di averle tutte. */
  const BLOCCO = 1000;
  /*  ── LA COPIA DELL'ARCHIVIO, PER NON RISCARICARLO OGNI VOLTA ───────────
      Segnalazione del committente: «la dashboard del CRM è molto lenta».
      Misurato: 1.033 schede, 1,17 MB, riscaricate per intero a ogni apertura
      — e fino all'ultimo blocco la pagina non disegnava niente. Le regole
      stanno in crm/copia-archivio, provate senza browser. */
  /*  ⚠️ LA COPIA PORTA IL NOME DI CHI L'HA FATTA. Due consulenti che si danno
      il cambio sullo stesso computer sono due archivi diversi: senza il nome
      nella chiave, il secondo aprirebbe il CRM con le schede del primo. */
  const chiaveCopia = user ? `hg_crm_archivio:${user.id}` : "";
  const leggiCopia = useCallback((): Lead[] | null => {
    if (!chiaveCopia) return null;
    try {
      const grezzo = sessionStorage.getItem(chiaveCopia);
      if (!grezzo) return null;
      const j = JSON.parse(grezzo) as { schede?: Lead[] };
      return Array.isArray(j?.schede) && j.schede.length ? j.schede : null;
    } catch {
      return null;
    }
  }, [chiaveCopia]);
  const scriviCopia = useCallback(
    (schede: Lead[]) => {
      if (!chiaveCopia) return;
      try {
        sessionStorage.setItem(chiaveCopia, JSON.stringify({ schede, at: Date.now() }));
      } catch {
        /* memoria piena: si continua senza copia, costa solo un'attesa */
      }
    },
    [chiaveCopia],
  );

  const tutteLeSchede = useCallback(async (): Promise<{ data: unknown[] | null }> => {
    const tutte: unknown[] = [];
    for (let da = 0; ; da += BLOCCO) {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(da, da + BLOCCO - 1);
      if (error) {
        console.error("[CRM] archivio non letto per intero", error);
        //  Meglio quello che si è già preso che niente: la pagina lavora su
        //  quello e lo dice il log, invece di aprirsi vuota.
        return { data: tutte.length ? tutte : null };
      }
      const blocco = data ?? [];
      tutte.push(...blocco);
      if (blocco.length < BLOCCO) break;
    }
    return { data: tutte };
  }, []);

  const reload = useCallback(async () => {
    if (!user) {
      setLeads([]);
      setConsultants([]);
      setAdSpending([]);
      return;
    }
    /*  ── PRIMA SI DISEGNA, POI SI AGGIORNA ────────────────────────────
        La copia della scheda si mostra SUBITO: il CRM si apre con l'archivio
        davanti invece che con una rotella, e nel frattempo si chiede al
        server solo quello che è cambiato. */
    const copia = leggiCopia();
    if (copia) {
      setLeads(copia);
      setLoading(false);
    } else setLoading(true);

    const [c, a] = await Promise.all([
      supabase.from("crm_consultants").select("*").order("created_at", { ascending: false }),
      supabase.from("crm_ad_spending").select("*").order("created_at", { ascending: false }),
    ]);
    if (c.data) setConsultants(c.data as unknown as Consultant[]);
    if (a.data) setAdSpending(a.data as unknown as AdSpending[]);

    let schede: Lead[] | null = null;
    if (copia) {
      const filo = filoDellArchivio(copia as never);
      //  Il cambiato dopo + il conteggio: due domande piccole al posto di 1,17 MB.
      const [nuove, conto] = await Promise.all([
        filo
          ? supabase
              .from("crm_leads")
              .select("*")
              .gt("updated_at", filo)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as unknown[] }),
        supabase.from("crm_leads").select("id", { count: "exact", head: true }),
      ]);
      const fuse = fondiSchede(copia as never, (nuove.data ?? []) as never) as unknown as Lead[];
      /*  ⚠️ SE LA DOMANDA È FALLITA NON CI SI FIDA DELLA COPIA: una rete che
          cade mentre si chiede «cos'è cambiato» lascerebbe in mano una copia
          vecchia che sembra fresca. Meglio l'attesa del riscaricamento. */
      const chiestoBene = !(nuove as { error?: unknown })?.error;
      if (
        chiestoBene &&
        copiaAttendibile({
          quante: fuse.length,
          sulServer: (conto as { count?: number | null })?.count ?? null,
        })
      ) {
        schede = fuse;
        if ((nuove.data ?? []).length)
          console.log(`[CRM] archivio aggiornato: ${(nuove.data ?? []).length} schede cambiate`);
      } else {
        //  Il conteggio non combacia: qualcuno ha eliminato (o la copia è
        //  incompleta). Si riscarica tutto, che è la cosa lenta ma giusta.
        console.log("[CRM] la copia non combacia col server: riscarico l'archivio");
      }
    }
    if (!schede) {
      setLoading(true);
      const l = await tutteLeSchede();
      if (l.data) schede = l.data as unknown as Lead[];
    }
    if (schede) {
      setLeads(schede);
      scriviCopia(schede);
    }
    setLoading(false);
  }, [user, tutteLeSchede, leggiCopia, scriviCopia]);

  /*  ── ⚠️ I LINK CHE MANCANO SI RECUPERANO, NON SI ASPETTANO ─────────────
      Segnalazione del committente: «continua a dire "Link: te lo mando poco
      prima"; fai che genera il link e lo mette lì».
      La stanza nasce al salvataggio di una scheda, quindi gli appuntamenti
      fissati PRIMA di quel meccanismo non ce l'hanno — e nessuno li salverà
      più: sono già fissati. Il promemoria usciva col ripiego, e qualcuno
      doveva ricordarsi di mandare il link a mano.
      Qui, appena l'archivio è in mano, si guardano gli appuntamenti da oggi
      in avanti senza stanza e gliela si dà. Uno alla volta e in fondo alla
      coda: è un recupero, non una cosa che qualcuno sta aspettando.
      ⚠️ Solo il futuro: dare una stanza a una consulenza di marzo non serve a
       nessuno e farebbe centinaia di richieste per niente.
      ⚠️ Una volta per apertura della pagina: `fatto` impedisce che un
       ricaricamento dell'elenco lo rifaccia da capo. */
  const recuperoFatto = useRef(false);
  useEffect(() => {
    if (recuperoFatto.current || loading || !leads.length) return;
    const oggi = new Date();
    const iso = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
    const senzaStanza = leads.filter((l) => {
      const d = l?.data;
      if (!d?.dataMeeting || !d?.oraMeeting) return false;
      if (String(d.dataMeeting).slice(0, 10) < iso) return false;
      return !haStanzaNostra(d);
    });
    if (!senzaStanza.length) return;
    recuperoFatto.current = true;
    void (async () => {
      console.log(`[CRM] ${senzaStanza.length} appuntamenti senza stanza: preparo i link`);
      for (const l of senzaStanza.slice(0, 60)) {
        await assicuraStanza(l);
        //  Un respiro fra uno e l'altro: è lavoro di sfondo e non deve
        //  rubare la rete a chi sta usando il CRM adesso.
        await new Promise((r) => setTimeout(r, 300));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, loading]);

  /*  ── ⚠️ I PREVENTIVI DI CIASCUNO, LETTI UNA VOLTA SOLA ─────────────────
      Richiesta del committente: il messaggio a chi sta decidendo deve portare
      il suo preventivo vero, e più link se ne ha più d'uno.
      Il messaggio si compone mentre si DISEGNA una riga di elenco — «Da fare
      oggi» ne disegna decine — e lì non si può chiedere niente a un archivio:
      sarebbe una lettura per riga, cioè la strada che il 27/09/2026 ha portato
      il sito a sbattere contro il tetto giornaliero delle richieste. Perciò si
      legge QUI, una volta per apertura del CRM e in sottofondo, e si deposita
      il risultato già pronto (`impostaLinkPreventivi`).
      ⚠️ NON BLOCCA NIENTE: finché non è arrivato, i messaggi escono senza la
       riga del preventivo (il segnaposto è facoltativo e si porta via la sua
       riga). Un messaggio senza link è incompleto; un CRM che aspetta una
       lettura per disegnarsi è rotto.
      ⚠️ Solo le colonne che servono: `select("*")` su quella tabella porta
       dietro i preventivi interi — upsell, note, tempi — per usarne quattro
       campi. */
  const preventiviLetti = useRef(false);
  useEffect(() => {
    if (preventiviLetti.current || loading || !leads.length) return;
    preventiviLetti.current = true;
    void (async () => {
      try {
        const { data } = await (
          supabase as unknown as {
            from(t: string): {
              select(c: string): {
                order(
                  c: string,
                  o: { ascending: boolean },
                ): {
                  limit(n: number): Promise<{ data: unknown[] | null }>;
                };
              };
            };
          }
        )
          .from("quote_requests")
          .select("quote_ref,telefono,status,created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        const origine = typeof window !== "undefined" ? window.location.origin : "";
        impostaLinkPreventivi(
          linkPerOgniCliente(
            (data ?? []) as { quote_ref?: string | null }[],
            leadsRef.current.map((l) => ({
              id: l.id,
              quoteRef: l.data?.quoteRef,
              telefono: l.data?.telefono,
            })),
            origine,
          ),
        );
        /*  ⚠️ E SI RIDISEGNA UNA VOLTA. I messaggi si compongono mentre si
            disegna, quindi quelli già a schermo sono stati composti un istante
            prima che questi link arrivassero: senza questa riga il preventivo
            compare solo cambiando schermata. Si rinnova l'identità dell'elenco
            — stesse schede, stesso contenuto — che è il segnale che tutte le
            pagine del CRM già ascoltano.
            ⚠️ Non fa un giro: questo effetto parte una volta sola
            (`preventiviLetti`). */
        setLeads((l) => l.slice());
      } catch {
        //  Nessun preventivo depositato: i messaggi escono senza quella riga.
      }
    })();
  }, [leads.length, loading]);

  useEffect(() => {
    reload();
  }, [reload]);

  /*  ── ⚠️ QUANTE PERSONE STANNO IN UNA FASCIA, LETTO UNA VOLTA SOLA ──────
      Richiesta del committente: «fai che posso cambiare il numero dalle
      impostazioni».
      Il calcolo degli orari liberi è sincrono e non può leggere il database a
      ogni riga di calendario: il numero vive in un registro in memoria dentro
      crm/booking-utils, e questa è l'unica chiamata che lo riempie. Finché non
      arriva vale il predefinito — tre — che è il comportamento di sempre.
      Sta qui perché è l'avvio del CRM: ogni schermata che disegna
      disponibilità sta dentro questo contesto. */
  useEffect(() => {
    void assicuraCapienza().catch(() => {
      /* vale il predefinito: mai lasciare l'agenda senza capienza */
    });
  }, []);

  /*  ── LA COPIA DI SICUREZZA, UNA VOLTA AL GIORNO ────────────────────────
      La copia completa del CRM esisteva già ma era solo un pulsante: nessuno
      la faceva. In archivio ci sono più di mille schede cliente e tutte le
      trattative, e su Supabase non c'è il ripristino a un istante preciso —
      una cancellazione sbagliata è definitiva.
      Si deposita all'apertura del CRM: la prima della giornata la fa, le altre
      non fanno niente (decide il server, che sa quando è stata l'ultima). Nei
      giorni in cui non lavora nessuno non c'è neanche niente di nuovo da
      salvare.
      ⚠️ NON SI ASPETTA E NON SI DICE NIENTE: è una rete di sicurezza, non
       un'operazione dell'utente. Se fallisce si riproverà domani, e intanto il
       CRM si apre come sempre. Lo stato («ultima copia: …») si legge in
       Impostazioni, che è dove uno va a cercarlo.
      ⚠️ UNA VOLTA PER SCHEDA DEL BROWSER: senza questo segno, ogni rientro
       nel CRM (che rimonta il contesto) sarebbe un'altra richiesta. */
  useEffect(() => {
    if (!user) return;
    try {
      if (sessionStorage.getItem("hg_copia_chiesta") === "1") return;
      sessionStorage.setItem("hg_copia_chiesta", "1");
    } catch {
      /* memoria bloccata: al massimo si chiede due volte */
    }
    void (async () => {
      try {
        await fetch("/api/crm/copia-automatica", {
          method: "POST",
          headers: await intestazioniCRM({ "Content-Type": "application/json" }),
        });
      } catch {
        /* rete: si riprova alla prossima apertura */
      }
    })();
  }, [user]);

  const createLead = async (data: LeadData) => {
    if (!user) return null;
    const finalData = applyAutoStatus(data);
    const { data: row, error } = await supabase
      .from("crm_leads")
      .insert({ user_id: user.id, data: finalData as never })
      .select()
      .single();
    if (error) {
      console.error(error);
      return null;
    }
    const lead = row as unknown as Lead;
    setLeads((prev) => [lead, ...prev]);
    void dispatchLeadToAds(lead);
    return lead;
  };

  /** ── QUANTE VOLTE SI RIPROVA QUANDO QUALCUN ALTRO SCRIVE INSIEME A NOI ──
   *  Tre: due postazioni che salvano la stessa scheda nello stesso secondo
   *  capitano; tre volte di fila non capita, e se capitasse vorrebbe dire che
   *  qualcosa scrive in continuazione — meglio dirlo che restare in un giro. */
  const TENTATIVI_SALVATAGGIO = 3;

  const updateLead = async (
    id: string,
    modifica: Modifica<LeadData>,
    tentativo = 0,
  ): Promise<boolean> => {
    /*  ── ⚠️ LA VERITÀ È L'ARCHIVIO, NON LA COPIA CHE ABBIAMO A SCHERMO ────
        Segnalazione del committente: «si sistema quel difetto, problema di
        salvataggio».

        QUI SI PARTIVA DALLA COPIA IN MEMORIA (`leadsRef`) e si scriveva
        `{...copia, ...modifica}` — cioè la SCHEDA INTERA, ricostruita su
        quello che il browser aveva letto l'ultima volta. Finché quella copia
        è fresca funziona; appena non lo è, salvare un campo RIPORTA INDIETRO
        tutti gli altri. Non è teoria: provando l'importazione dei contatti di
        ritorno sono spariti stato, note e contatori modificati un minuto
        prima — nessun errore, nessuna riga in console, il lavoro dell'altro
        semplicemente non c'era più. Sono i «non si salva» che tornano da
        mesi, ed è sempre stato questo.
        E i modi per avere una copia vecchia sono tanti: due postazioni sulla
        stessa lista, una finestra lasciata aperta mentre l'elenco si
        ricaricava, una scheda aperta da un collegamento diretto, una modifica
        arrivata dal server (il link del meet, un esito segnato da un'altra
        schermata).

        Adesso si rilegge SEMPRE la riga prima di comporre il salvataggio. Una
        lettura in più costa una manciata di millisecondi ed è la stessa
        scelta già fatta, per le stesse ragioni, nella finestra della chiusura
        (crm/ChiusuraDialog): là valeva l'intero importo di una vendita.
        ⚠️ E se la scheda non c'è davvero più, si esce dicendolo: prima questa
         uscita era muta e prometteva lo stesso «salvato». */
    const { data: riga, error: erroreLettura } = await supabase
      .from("crm_leads")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (erroreLettura) {
      console.error("[CRM] scheda non rileggibile prima del salvataggio", erroreLettura);
      return false;
    }
    const current = (riga as unknown as Lead) || undefined;
    if (!current) {
      console.warn("[CRM] salvataggio a vuoto: questa scheda non è più in archivio", id);
      return false;
    }
    /** Com'era la riga quando l'abbiamo letta. È la firma con cui si scrive:
     *  vedi la scrittura condizionata più sotto. */
    const vistoIl = (riga as unknown as { updated_at?: string } | null)?.updated_at;
    //  La copia a schermo si allinea comunque: una scheda ripresa così deve
    //  comparire, o la pagina continuerebbe a non vederla.
    if (!leadsRef.current.some((x) => x.id === id)) {
      leadsRef.current = [current, ...leadsRef.current];
    }
    //  ⚠️ `statoScelto` = questa modifica porta uno stato dentro, cioè qualcuno
    //   l'ha scelto adesso. Serve a `applyAutoStatus` per NON riportare a
    //   «Acconto incassato» una scheda che una persona ha appena mandato da
    //   un'altra parte (il perché per esteso sta là). Si decide qui e non nelle
    //   venti schermate che salvano: qui ci passano tutte.
    /*  ── ⚠️ IL PEZZO SI COMPONE ADESSO, NON PRIMA ─────────────────────
        Con una funzione, la modifica si costruisce QUI — dopo la rilettura,
        con davanti `current.data`, cioè la scheda vera. È l'unico modo di
        fondere dentro un sotto-oggetto (`installazione`, `payment`) senza
        cancellarne i fratelli: componendolo sulla copia a schermo, la
        rilettura non serve a niente perché l'oggetto vecchio è già dentro il
        pezzo da scrivere. Vedi crm/patch-scheda.
        ⚠️ E si ricompone a ogni tentativo: se la scheda cambia mentre la
         salviamo, il giro successivo rilegge e richiama la funzione sul
         valore nuovo — che è tutto il senso di passarla. */
    const patch = risolviModifica(modifica, current.data);
    let merged = applyAutoStatus({ ...current.data, ...patch } as LeadData, {
      statoScelto: patch.stato !== undefined,
    });
    //  ── DA DOVE VENIVA QUESTO LEAD ──────────────────────────────────────────
    //   Ogni cambio di stato lascia dietro di sé quello di prima. Serve al tasto
    //   "torna indietro" della pagina Oggi: segnare "cliente assente" al posto
    //   di "da riprogrammare" è un errore che si fa col telefono in mano, e
    //   senza questa riga l'unico rimedio è ricordarsi a memoria dove stava.
    //   Si scrive QUI, nell'unico punto da cui passano tutte le modifiche: in
    //   qualunque altro posto sarebbe una traccia parziale, vera solo per le
    //   schermate che si sono ricordate di scriverla.
    //   Un solo passo indietro, non una pila: chi sbaglia se ne accorge subito,
    //   e una cronologia lunga qui diventerebbe un modo per disfare cose vecchie
    //   senza capire cosa si sta disfando.
    /*  ── ⚠️ CHI ANNULLA SA DA QUANDO ─────────────────────────────────────
        Di norma un cambio di stato lascia dietro quello di prima e l'istante
        in cui è avvenuto. Ma quando si ANNULLA un esito — il tasto «Torna
        indietro» della coda di chiamata — la scheda non sta cambiando stato:
        sta tornando quello che era, e con lei devono tornare anche la data e
        lo stato precedente di allora. Senza questa eccezione un esito segnato
        per sbaglio e annullato tre secondi dopo lasciava scritto «in questo
        stato da oggi» su una scheda che ci stava da due settimane — e i
        filtri «da quando» (crm/quando-stato) raccontavano il contrario di
        quello che era successo.
        Chi passa `statoPrecedenteIl` lo sta dichiarando apposta: comanda lui. */
    if (merged.stato !== current.data.stato && patch.statoPrecedenteIl === undefined) {
      merged = {
        ...merged,
        statoPrecedente: current.data.stato,
        statoPrecedenteIl: new Date().toISOString(),
        //  ⚠️ CHI l'ha messo, non solo quando. Serve al setter per ritrovare
        //   gli appuntamenti che ha fissato lui: `consulenteId` dice chi FARÀ
        //   la consulenza, non chi l'ha presa. Vedi `statoDa` in crm/types.
        //   Senza consulente collegato (ingresso con email e password) non si
        //   scrive niente: meglio «non si sa» che un id inventato.
        ...(consulenteCollegato?.id ? { statoDa: consulenteCollegato.id } : {}),
      };
    }
    /*  ── ⚠️ CHI HA PRESO L'APPUNTAMENTO, UNA VOLTA SOLA ───────────────────
        Segnalazione del committente: «il setter dopo che fissa le consulenze
        non può più vedere la lista di quello che ha fissato».
        `statoDa` qui sopra si RISCRIVE a ogni cambio di stato: appena il
        consulente segna «non si è presentato», quella consulenza risulta sua e
        il setter che l'aveva presa la perde di vista. Questo campo si scrive
        nel momento in cui la scheda diventa un appuntamento e non si tocca
        più — la regola, con il perché, sta in crm/chi-ha-fissato. */
    merged = {
      ...merged,
      ...patchChiFissa({
        prima: current.data,
        statoNuovo: merged.stato,
        chi: consulenteCollegato?.id,
      }),
    };
    /*  ── ⚠️ «CI RICONTATTA LUI»: LA DATA IN CUI L'HA DETTO È OGGI ────────
        Richiesta del committente: «aggiungi come stato ci ricontatta lui, e
        segna in dinamico la data di quando lo ha detto, quella di oggi,
        SEMPRE, e quando dice che ricontatta».
        Le due date rispondono a due domande diverse e servono tutte e due:
         · `ciRicontattaDettoIl` — quando l'ha detto. Non si chiede a nessuno:
           è il giorno in cui si preme il tasto, e si riscrive OGNI volta che
           lo stato viene messo, perché se lo ripete a distanza di un mese
           quella di un mese fa non vuol più dire niente;
         · `dataRicontatto` — entro quando ha detto che si fa vivo, che è
           quella che lo riporta in coda se passa in silenzio (la chiede la
           finestra, vedi quando-per-stato).
        ⚠️ SI SCRIVE QUI, nell'unico punto da cui passano tutte le modifiche:
         gli stati si mettono da sei schermate diverse (la coda dei lead
         importati, la scheda, l'agenda, la ricerca, il riquadro di oggi, le
         trattative) e una data scritta in una di quelle sarebbe una data che
         manca nelle altre cinque.
        ⚠️ SOLO QUANDO LO STATO FA PARTE DELLA MODIFICA: salvare un numero di
         telefono su una scheda che è già in questo stato non vuol dire che
         l'abbia ridetto oggi. */
    if (patch.stato === "ci_ricontatta_lui") {
      /*  ⚠️ IL GIORNO LOCALE, non `toISOString()`: alle 00:30 italiane l'ora
          universale è ancora il giorno prima, e la scheda direbbe che l'ha
          detto ieri. Qui conta il giorno in cui si è telefonato, e si scrive
          nella stessa forma delle altre date del CRM (AAAA-MM-GG). */
      const d = new Date();
      const oggi = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      merged = { ...merged, ciRicontattaDettoIl: oggi };
    }
    // Doppia data attribuzione: appena il lead diventa convertito per la prima
    // volta, registra `convertedAt` (ISO). Le KPI di chiusura/fatturato
    // useranno questo campo invece di `created_at`.
    //  ⚠️ L'ELENCO ERA SCRITTO A MANO E SI FERMAVA AL VECCHIO "venduto". Con le
    //   tre chiusure nuove — che sono l'unico modo in cui oggi si vince un lead —
    //   nessuna vendita registrava più `convertedAt` (quindi le vendite tornavano
    //   attribuite al giorno di INGRESSO del lead, cioè al mese sbagliato) e
    //   nessuna faceva più partire il Purchase verso Meta: la campagna che le
    //   aveva portate risultava senza incassi, e il ROAS su cui si decide quanto
    //   spendere andava a zero da solo. Si legge da `eChiusuraVinta`, che è
    //   l'elenco unico di types.ts, così una quarta chiusura non va ritrovata qui.
    const convertito = (s?: string) => eChiusuraVinta(s) || s === "concluso";
    const wasConv = convertito(current.data.stato);
    const isConv = convertito(merged.stato);
    if (!wasConv && isConv && !merged.convertedAt) {
      merged = { ...merged, convertedAt: new Date().toISOString() };
    }
    /*  ── L'ACQUISTO SI ANNUNCIA UNA VOLTA SOLA ───────────────────────────
        La soglia «prima non era vinto, adesso sì» dice che è successo un
        fatto, non che quel fatto sia NUOVO: una vendita riaperta e richiusa la
        riattraversa, e senza questa memoria partiva un secondo acquisto dello
        stesso importo (vedi `adsPurchaseIl` in crm/types).
        ⚠️ La data si scrive INSIEME allo stato, nella stessa riga di
         archivio, e non dopo aver visto com'è andato l'invio. Sembra il
         contrario di quello che si vorrebbe — così un invio fallito non viene
         più ritentato — ma è la scelta onesta: `dispatchToCapi` ingoia gli
         errori e non riprova già oggi, quindi l'unico «ritentativo» che
         esisteva era proprio il doppio conteggio che stiamo togliendo. Meglio
         un acquisto che manca, e che si vede perché la campagna resta a zero,
         di uno che c'è due volte e gonfia il ROAS su cui si decide la spesa. */
    const primoAnnuncio = !wasConv && isConv && !merged.adsPurchaseIl;
    if (primoAnnuncio) {
      merged = { ...merged, adsPurchaseIl: new Date().toISOString() };
    }
    /*  ── ⚠️ SI SCRIVE SOLO SE NESSUNO HA SCRITTO NEL FRATTEMPO ───────────
        Fra la rilettura qui sopra e questa riga passano dei millisecondi, e in
        quei millisecondi un collega può salvare la stessa scheda. Senza
        guardia la nostra scheda intera coprirebbe la sua — lo stesso difetto
        di prima, solo molto più raro e quindi molto più difficile da credere.
        `updated_at` si muove da solo a ogni scrittura (lo fa il database:
        verificato), quindi vale come firma della versione che abbiamo letto:
        se non combacia più, la riga non viene toccata, la risposta torna
        vuota, e si RIFÀ TUTTO sul valore nuovo — la modifica si applica a
        quello che c'è adesso, che è l'unica cosa sensata da fare.
        ⚠️ `.select("id")` non è un lusso: senza, una `update` che non tocca
         nessuna riga risponde «tutto bene». È la stessa trappola documentata
         su `deleteLead` qui sotto. */
    let scrittura = supabase
      .from("crm_leads")
      .update({ data: merged as never })
      .eq("id", id);
    if (vistoIl) scrittura = scrittura.eq("updated_at", vistoIl);
    const { data: scritte, error } = await scrittura.select("id");
    if (error) {
      //  Il messaggio serve: «non salvato» senza il perché ha fatto perdere
      //  un pomeriggio a capire se fosse la rete, i permessi o un campo.
      console.error("[CRM] salvataggio rifiutato dall'archivio:", error.message, error);
      return false;
    }
    if (!scritte || scritte.length === 0) {
      if (tentativo + 1 >= TENTATIVI_SALVATAGGIO) {
        console.error(
          "[CRM] salvataggio non riuscito: la scheda continua a cambiare sotto di noi",
          id,
        );
        return false;
      }
      console.warn(
        `[CRM] la scheda è cambiata mentre la salvavo: rifaccio la modifica sul valore nuovo (tentativo ${tentativo + 2})`,
        id,
      );
      return updateLead(id, modifica, tentativo + 1);
    }
    const updatedLead: Lead = { ...current, data: merged };
    //  Anche il riferimento si aggiorna adesso: un secondo salvataggio che
    //  parte prima del disegno successivo deve trovare già questo.
    leadsRef.current = leadsRef.current.map((x) => (x.id === id ? updatedLead : x));
    //  Se la scheda era stata ripresa dall'archivio non è nell'elenco a
    //  schermo: si aggiunge, o la pagina continuerebbe a non vederla.
    setLeads((prev) =>
      prev.some((x) => x.id === id)
        ? prev.map((x) => (x.id === id ? updatedLead : x))
        : [updatedLead, ...prev],
    );

    //  Offline Conversion: il Purchase parte alla PRIMA vittoria di questo
    //  lead e mai più (`primoAnnuncio`, calcolato sopra insieme alla data che
    //  lo ricorda). Una vendita corretta, riaperta o richiusa non ne fa
    //  partire un altro.
    if (primoAnnuncio) {
      void dispatchPurchaseToAds(updatedLead, leadRevenue(updatedLead));
    }
    //  ⚠️ `current.data` è la scheda com'era PRIMA di questo salvataggio:
    //   serve a sapere se l'appuntamento si è spostato, che è una domanda che
    //   si può fare solo qui — dopo, quel valore non esiste più da nessuna
    //   parte.
    void curaLaStanza(current.data, updatedLead);
    return true;
  };

  /*  ── ⚠️ L'APPUNTAMENTO PORTA CON SÉ IL SUO LINK, SEMPRE ────────────────
      Richiesta del committente: «fai che il messaggio di notifica del meet
      abbia il link di Meetly, quindi lo genera prima».

      Il link nei messaggi non si inventa al momento dell'invio: si legge da
      `linkMeeting`, il campo della scheda. E quel campo veniva riempito in UN
      posto solo — il salvataggio dalla finestra del lead — quindi ogni altra
      strada per fissare una consulenza (la coda del setter, lo spostamento di
      un appuntamento, una scheda importata) lasciava la scheda senza stanza.
      Il messaggio partiva col ripiego «il link te lo mando poco prima», e
      qualcuno doveva ricordarsi di mandarlo davvero.

      Qui si sta nell'UNICO punto da cui passano tutte le modifiche di una
      scheda: appena una consulenza ha giorno e ora e non ha ancora una
      stanza, la stanza nasce e il link si scrive. Chi compone un messaggio,
      da qualunque schermata, lo trova già lì.

      ⚠️ Non blocca e non parla: se il server non risponde, la scheda resta
       salvata e il messaggio esce col ripiego di prima — come oggi. E non si
       ripete: al secondo giro `haStanzaNostra` è vero e non si chiama nessuno.
      ⚠️ La stanza è di chi FARÀ la consulenza (`consulenteId`), non di chi sta
       salvando: un setter che fissa per un consulente non è il padrone di
       casa. Vedi `conduco` in api.crm.meeting-session. */
  /** Il nome di chi farà la consulenza, per il biglietto. Vuoto se non lo si
   *  sa: sul biglietto una riga in meno è meglio di «con undefined». */
  const nomeDelConsulente = (id?: string | null): string | undefined => {
    const c = consultantsRef.current.find((x) => x.id === String(id || ""));
    return String(c?.data?.nome || "").trim() || undefined;
  };

  /** Il biglietto dell'anteprima, ridisegnato coi dati di adesso e depositato
   *  sotto il codice della stanza. Silenzioso e non bloccante: sta dentro un
   *  salvataggio che l'utente ha chiesto per altro.
   *  ⚠️ Caricato a richiesta: il disegno si porta dietro i caratteri e il logo,
   *   ed è peso che non deve stare addosso a ogni apertura del CRM. */
  const rifaiAnteprima = async (l: Lead, codice: string) => {
    if (!codice) return;
    try {
      const m = await import("./anteprima-link");
      await m.depositaAnteprimaPerLead(l, codice, nomeDelConsulente(l.data?.consulenteId));
    } catch (e) {
      console.warn("[CRM] anteprima del link non aggiornata (il link funziona lo stesso)", e);
    }
  };

  /*  ── ⚠️ SPOSTARE UN APPUNTAMENTO RIFÀ IL LINK ──────────────────────────
      Richiesta del committente: «se sposto un appuntamento a un cliente,
      l'anteprima la cambia: genera un nuovo link di Meetly, con la nuova
      anteprima aggiornata con il nuovo giorno e orario».

      Ridisegnare l'immagine e basta non si vede: l'anteprima sta sotto un
      indirizzo che dipende dal CODICE della stanza, e i server di WhatsApp la
      tengono in cache per giorni. Il messaggio già mandato continua a mostrare
      le 15:00 anche dopo che l'appuntamento è passato alle 18. L'unica cosa
      che quei server rileggono è un link che non hanno mai visto.

      Quindi uno spostamento conia un codice nuovo, scrive il link nuovo sulla
      scheda e deposita il biglietto col giorno nuovo. Il link vecchio NON
      muore: rinvia a quello nuovo (vedi api.crm.meeting-session e il commento
      in crm/spostamento-meet.ts).

      ⚠️ Solo se una stanza c'era GIÀ: se non c'era, questo non è uno
       spostamento — è il primo appuntamento, e la stanza la crea
       `assicuraStanza` qui sotto, con il suo link già nuovo. */
  const curaLaStanza = async (prima: LeadData, l: Lead) => {
    const d = l.data;
    if (eChiusuraVinta(d.stato) || d.stato === "concluso") return;
    if (!haStanzaNostra(d)) {
      await assicuraStanza(l);
      return;
    }
    if (consulenzaSpostata(prima, d)) {
      await rigeneraStanza(l);
      return;
    }
    //  Stessa stanza, stesso link, ma il biglietto dice una cosa diversa (è il
    //  caso della sola durata cambiata): si riscrive il file. Chi apre il link
    //  da adesso in poi lo vede giusto; chi ce l'ha già in chat no, e per
    //  quello servirebbe un link nuovo — che per un quarto d'ora in più non
    //  vale la pena di bruciare.
    if (anteprimaDaRifare(prima, d)) {
      const codice = codiceStanzaDi(d);
      if (codice) await rifaiAnteprima(l, codice);
    }
  };

  /** Conia un codice nuovo per questa consulenza, scrive il link sulla scheda
   *  e rifà il biglietto. Il vecchio codice resta raggiungibile: lo rinvia qui
   *  il server. */
  const rigeneraStanza = async (l: Lead) => {
    const d = l.data;
    try {
      const r = (await fetch("/api/crm/meeting-session", {
        method: "POST",
        headers: await intestazioniCRM({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          leadId: l.id,
          consultantId: d.consulenteId || "",
          quando: `${d.dataMeeting}T${d.oraMeeting}`,
          durata: d.durataMeeting || DURATA_PREDEFINITA,
          rigenera: true,
        }),
      }).then((x) => x.json())) as { ok?: boolean; link?: string; code?: string };
      if (!r?.ok || !r.link) return;
      console.log("[CRM] appuntamento spostato: link nuovo", r.code);
      //  ⚠️ Prima il link, poi il biglietto: se il salvataggio non riesce, un
      //   biglietto depositato sotto un codice che nessuno ha in mano non
      //   serve a niente.
      if (r.link !== d.linkMeeting) await updateLead(l.id, { linkMeeting: r.link });
      await rifaiAnteprima({ ...l, data: { ...d, linkMeeting: r.link } }, String(r.code || ""));
    } catch (e) {
      console.warn("[CRM] link della consulenza non rifatto dopo lo spostamento", e);
    }
  };

  const assicuraStanza = async (l: Lead) => {
    const d = l.data;
    if (haStanzaNostra(d) || !d.dataMeeting || !d.oraMeeting) return;
    //  A consulenza vinta la stanza non serve più a nessuno.
    if (eChiusuraVinta(d.stato) || d.stato === "concluso") return;
    try {
      const r = (await fetch("/api/crm/meeting-session", {
        method: "POST",
        headers: await intestazioniCRM({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          leadId: l.id,
          consultantId: d.consulenteId || "",
          quando: `${d.dataMeeting}T${d.oraMeeting}`,
          durata: d.durataMeeting || DURATA_PREDEFINITA,
        }),
      }).then((x) => x.json())) as { ok?: boolean; link?: string; code?: string };
      if (r?.ok && r.link && r.link !== d.linkMeeting) {
        await updateLead(l.id, { linkMeeting: r.link });
        //  ⚠️ E il biglietto nasce con la stanza. Finché non lo faceva, la
        //   maggior parte dei link partiva con la scheda generica del sito al
        //   posto del biglietto col nome e il giorno: la passata delle
        //   anteprime recuperava l'arretrato, ma solo col CRM aperto.
        await rifaiAnteprima({ ...l, data: { ...d, linkMeeting: r.link } }, String(r.code || ""));
      }
    } catch (e) {
      console.warn("[CRM] stanza della consulenza non creata (il messaggio uscirà senza link)", e);
    }
  };

  /** ── IL CESTINO DI UNA PERSONA, E NON SI TORNA INDIETRO ────────────────────
   *  Qui non c'è nessun «annulla» come per il salto in coda, e non c'è nemmeno
   *  lo spegnimento che salva i consulenti dalla cancellazione: la riga se ne va
   *  e con lei la sua storia. Per questo l'unica cosa che questa funzione deve a
   *  chi la chiama è la verità su com'è finita — la conferma la chiede la
   *  pagina, prima. */
  const deleteLead = async (id: string): Promise<boolean> => {
    //  Senza sessione non si toglierebbe niente e nessuno lo direbbe: si
    //  finirebbe nel ramo «zero righe» qui sotto, che è la risposta sbagliata
    //  alla domanda giusta — parlerebbe di qualcun altro che l'ha già tolta.
    if (!user) {
      toast.error("Lead non eliminato", {
        id: AVVISO_ELIMINA,
        description: "Sessione scaduta: esci e rientra, poi riprova.",
      });
      return false;
    }
    //  ⚠️ `.select("id")` NON è un lusso: `delete()` da solo risponde «tutto
    //   bene» anche quando non ha toccato NESSUNA riga. Succede in due casi —
    //   la regola di riga che rifiuta (`admin_delete_leads`: auth.uid() =
    //   user_id) e la riga che qualcun altro ha già eliminato — e la vecchia
    //   versione li infilava tutti e due nel ramo riuscito: la persona spariva
    //   dall'elenco a schermo, si leggeva «eliminato», e al ricaricamento
    //   successivo era di nuovo al suo posto. Chiedendo indietro le righe
    //   tolte, «zero» diventa una risposta che si può leggere.
    const { data: tolte, error } = await supabase
      .from("crm_leads")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      console.error(error);
      toast.error("Lead non eliminato", { id: AVVISO_ELIMINA, description: error.message });
      return false;
    }
    if (!tolte || tolte.length === 0) {
      //  Zero righe e nessun errore: o non c'era già più, o il database si è
      //  rifiutato. Vogliono risposte opposte — nel primo caso la riga va tolta
      //  anche da qui, nel secondo deve RESTARE a schermo, o si guarda un
      //  elenco che promette un'eliminazione mai avvenuta. Quale delle due lo
      //  sa solo il database, e glielo si può chiedere perché la regola di
      //  lettura è la stessa di quella di cancellazione: se questa riga è
      //  arrivata fin dentro il nostro elenco, questa domanda sa rispondere.
      const { data: rimasta } = await supabase
        .from("crm_leads")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (rimasta) {
        toast.error("Lead non eliminato", {
          id: AVVISO_ELIMINA,
          description:
            "Il database ha rifiutato la cancellazione. La scheda è ancora al suo posto: ricarica la pagina e riprova.",
        });
        return false;
      }
      //  Non c'è più: l'ha tolta qualcun altro mentre guardavamo. Il risultato è
      //  quello che si voleva, quindi si prosegue come per un'eliminazione
      //  riuscita — sfilarla dall'elenco è la stessa cura che `rimuoviConsulente`
      //  usa sul 404, se no resta a schermo un nome su cui il cestino
      //  fallirebbe per sempre.
    }
    //  ── PERCHÉ SI TOGLIE ANCHE DA QUI, E NON SI RICARICA TUTTO ──────────────
    //   `leads` è l'unica copia che guardano tutte le schermate (coda di oggi,
    //   lead importati, KPI): togliendola qui si aggiornano da sole, nello
    //   stesso istante. Un `reload` per ogni cestino sarebbe l'intera tabella
    //   riscaricata per una riga in meno — e in un'eliminazione a gruppi,
    //   riscaricata venti volte.
    setLeads((prev) => prev.filter((x) => x.id !== id));
    return true;
  };

  const createConsultant = async (data: ConsultantData) => {
    //  ── QUANDO NON SI AGGIUNGE, BISOGNA SAPERE PERCHÉ ───────────────────────
    //   Qui si usciva due volte in silenzio — senza sessione, e quando il
    //   database rifiutava la scrittura — lasciando solo una riga nella console
    //   che nessuno guarda. A schermo non succedeva niente: la finestra restava
    //   aperta, la persona non compariva, e non c'era modo di capire se fosse
    //   colpa della rete, dei permessi o di un campo sbagliato.
    if (!user) {
      toast.error("Sessione scaduta: esci e rientra, poi riprova.");
      return null;
    }
    const { data: row, error } = await supabase
      .from("crm_consultants")
      .insert({ user_id: user.id, data: data as never })
      .select()
      .single();
    if (error) {
      console.error(error);
      toast.error("Persona non aggiunta", { description: error.message });
      return null;
    }
    const c = row as unknown as Consultant;
    setConsultants((prev) => [c, ...prev]);
    return c;
  };

  /*  ── ⚠️ STESSO TRATTAMENTO DELLE SCHEDE, E PER PIÙ SOLDI ────────────────
      Anche qui si partiva dalla copia in memoria e si riscriveva la persona
      INTERA: con un elenco non fresco, cambiare una percentuale riportava
      indietro tutto il resto. Su queste righe adesso ci stanno il listino del
      consulente, i suoi sconti e quanto viene pagato (vedi `ambito-listino`):
      una riscrittura all'indietro qui non è un fastidio, è un compenso o un
      prezzo sbagliato che nessuno vede finché non arriva la fattura.
      La regola è identica a `updateLead` — si rilegge, si scrive solo se
      nessuno ha scritto nel frattempo, e se qualcuno l'ha fatto si rifà la
      modifica sul valore nuovo — e identica deve restare: sono la stessa
      domanda («chi comanda, la mia copia o l'archivio?»), e due risposte
      diverse nello stesso file sono un invito a copiare quella sbagliata. */
  const updateConsultant = async (
    id: string,
    patch: Partial<ConsultantData>,
    tentativo = 0,
  ): Promise<void> => {
    const { data: riga, error: erroreLettura } = await supabase
      .from("crm_consultants")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (erroreLettura) {
      console.error("[CRM] persona non rileggibile prima del salvataggio", erroreLettura);
      toast.error("Modifica non salvata", { description: erroreLettura.message });
      return;
    }
    const current = (riga as unknown as Consultant) || undefined;
    if (!current) {
      console.warn("[CRM] salvataggio a vuoto: questa persona non è più in archivio", id);
      toast.error("Modifica non salvata", {
        description: "Questa persona non è più in archivio: ricarica la pagina.",
      });
      return;
    }
    const vistoIl = (riga as unknown as { updated_at?: string } | null)?.updated_at;
    const merged = { ...current.data, ...patch } as ConsultantData;
    let scrittura = supabase
      .from("crm_consultants")
      .update({ data: merged as never })
      .eq("id", id);
    if (vistoIl) scrittura = scrittura.eq("updated_at", vistoIl);
    const { data: scritte, error } = await scrittura.select("id");
    if (error) {
      console.error(
        "[CRM] salvataggio della persona rifiutato dall'archivio:",
        error.message,
        error,
      );
      toast.error("Modifica non salvata", { description: error.message });
      return;
    }
    if (!scritte || scritte.length === 0) {
      if (tentativo + 1 >= TENTATIVI_SALVATAGGIO) {
        console.error("[CRM] la persona continua a cambiare sotto di noi", id);
        toast.error("Modifica non salvata", {
          description:
            "Qualcun altro sta modificando questa persona adesso. Riprova fra un istante.",
        });
        return;
      }
      console.warn("[CRM] la persona è cambiata mentre la salvavo: rifaccio la modifica", id);
      return updateConsultant(id, patch, tentativo + 1);
    }
    setConsultants((prev) =>
      prev.some((x) => x.id === id)
        ? prev.map((x) => (x.id === id ? { ...x, data: merged } : x))
        : [{ ...current, data: merged }, ...prev],
    );
  };

  /** ── IL CESTINO, PER INTERO ────────────────────────────────────────────────
   *
   *  PERCHÉ NON ESISTE PIÙ UNA CANCELLAZIONE NUDA
   *  Prima qui c'era `deleteConsultant`: una riga cancellata e basta, con
   *  l'errore scritto solo in console. Faceva due danni invisibili.
   *
   *  1) LA STORIA DIVENTAVA ANONIMA. I lead NON si cancellano con la persona:
   *     restano con `consulenteId` puntato a una riga che non c'è più, e
   *     `calcolaMetricheConsulenti` li raccoglie sotto «Sconosciuto». Due
   *     persone cancellate = due righe «Sconosciuto» indistinguibili, per
   *     sempre, e nessuna scheda da aprire. Per questo, se c'è storico, qui NON
   *     si cancella: si SPEGNE. Il campo `attivo` esiste già ed è esattamente
   *     questo — non riceve più lead, i suoi numeri restano leggibili col suo
   *     nome. La cancellazione vera resta possibile solo per chi non ha mai
   *     avuto un lead: lì non c'è niente da rendere anonimo.
   *
   *  2) LA PORTA RESTAVA APERTA. `consultant_pins` sparisce da sola col vincolo
   *     ON DELETE CASCADE, ma l'elenco dei PRESENTATORI vive in
   *     `app_config.presenters` — un JSON che nessun vincolo tocca. La persona
   *     continuava quindi a entrare in videoconsulenza col suo PIN, come
   *     presentatore di un consulente che in anagrafica non esisteva più.
   *     Per questo la revoca fa parte del gesto, e non è un secondo tasto.
   *
   *  ⚠️ PERCHÉ QUI NON SI SCRIVE PIÙ NIENTE. La prima versione di questa
   *  funzione revocava dal server e poi spegneva o cancellava dal browser. Il
   *  no del server c'era davvero — ma valeva solo per chi seguiva la strada
   *  disegnata. Nel CRM la sessione Supabase del browser è SEMPRE quella del
   *  proprietario dei dati, anche quando a lavorare è un setter entrato col PIN
   *  (lo dice l'intestazione di AuthContext: è l'unico modo perché l'RLS lasci
   *  passare qualcosa), quindi le regole di riga di `crm_consultants` non
   *  distinguono un setter da un admin e la cancellazione sarebbe passata lo
   *  stesso. Adesso il gesto è UNA chiamata a `/api/crm/consulente-pin`
   *  (`rimuovi:true`): là dentro c'è `guardiaCRM(..., "consulenti")`, la regola
   *  dell'ultima chiave (`altriConLeChiavi`), il conteggio vero dei lead e le
   *  due scritture. Qui resta solo l'elenco a schermo e quello che si legge.
   *
   *  Il conto dei lead lo fa il server per la stessa ragione: quello di questa
   *  pagina vede solo i lead che si è caricata, e una pagina aperta da un'ora
   *  può non avere quelli assegnati nel frattempo. Sbagliare in un verso costa
   *  un interruttore da riaccendere; sbagliare nell'altro è irreversibile. */
  const rimuoviConsulente = async (id: string): Promise<EsitoRimozione> => {
    const fallito = (titolo: string, motivo: string): EsitoRimozione => {
      //  ⚠️ Mai un'uscita muta: questa funzione cancella dati, e un «non è
      //  successo niente» senza motivo è il modo in cui si preme tre volte.
      toast.error(titolo, { description: motivo });
      return { ok: false, motivo };
    };

    const c = consultants.find((x) => x.id === id);
    if (!c) {
      return fallito(
        "Non c'è più niente da togliere",
        "Questa persona non è più in anagrafica: ricarica la pagina.",
      );
    }

    //  Quello che questa pagina CREDE di sapere. Serve solo a due cose: dire se
    //  la risposta del server ha smentito ciò che l'utente ha appena letto nella
    //  conferma, e niente altro. La decisione non si prende qui.
    const storia = storicoConsulente(leads, id);

    // ── UNA CHIAMATA SOLA, E LA FA IL SERVER ─────────────────────────────────
    const risposta = await fetch("/api/crm/consulente-pin", {
      method: "POST",
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      //  `haStoria` viaggia solo come veto: se questa pagina ha visto dei lead
      //  suoi, il server non la cancella nemmeno se il suo conteggio dice zero.
      //  Non può ottenere niente in più — solo l'azione più prudente delle due.
      body: JSON.stringify({ consultantId: id, rimuovi: true, haStoria: storia.haStoria }),
    }).catch(() => null);
    const r = (risposta ? await risposta.json().catch(() => null) : null) as {
      ok?: boolean;
      reason?: string;
      modo?: ModoRimozione;
      lead?: number;
    } | null;

    if (!r?.ok) {
      //  ── QUALCUN ALTRO L'HA GIÀ TOLTA ──────────────────────────────────────
      //   Il 404 della rotta vuol dire che in anagrafica quella riga non c'è
      //   più: la nostra copia è vecchia. Va tolta anche da qui, o resta a
      //   schermo un nome su cui il cestino continuerà a fallire per sempre.
      if (risposta?.status === 404) {
        setConsultants((prev) => prev.filter((x) => x.id !== id));
        return fallito(
          "Era già stata tolta da un'altra scheda",
          "Non è più in anagrafica e l'ho fatta sparire anche da qui. Il suo PIN è caduto insieme alla scheda, ma controlla in Impostazioni che non sia rimasta fra i presentatori: quell'elenco lo ripulisce solo la revoca.",
        );
      }
      return fallito(
        "Non ho tolto nessuno",
        r?.reason ||
          "Il server non ha risposto. Riprova fra un momento e ricarica la pagina per vedere com'è finita.",
      );
    }

    //  ⚠️ Un `ok` senza `modo` è una risposta che non sappiamo leggere, e qui
    //  non si tira a indovinare: dire «eliminato» quando il server ha spento è
    //  peggio del silenzio. Si chiede di ricaricare e si dice perché.
    if (r.modo !== "spento" && r.modo !== "eliminato") {
      void reload();
      return fallito(
        "Non ho capito com'è finita",
        "Il server ha risposto che è andata bene ma non ha detto se l'ha spenta o eliminata. Ho ricaricato l'elenco: controlla la sua riga prima di rifare il gesto.",
      );
    }

    if (r.modo === "eliminato") {
      setConsultants((prev) => prev.filter((x) => x.id !== id));
      return { ok: true, modo: "eliminato" };
    }

    const merged = { ...c.data, attivo: false } as ConsultantData;
    setConsultants((prev) => prev.map((x) => (x.id === id ? { ...x, data: merged } : x)));
    //  L'unico caso in cui è successa una cosa diversa da quella annunciata:
    //  la conferma diceva «elimina definitivamente» perché questa pagina non
    //  aveva i suoi lead, e il server — che li ha contati tutti — l'ha spenta.
    //  Va detto, o resta a schermo una persona che si crede cancellata.
    const avviso =
      !storia.haStoria && (r.lead ?? 0) > 0
        ? `Aveva ${r.lead} lead che questa pagina non aveva ancora caricato: invece di eliminarla l'ho spenta, così i suoi numeri restano leggibili col suo nome.`
        : undefined;
    return { ok: true, modo: "spento", avviso };
  };

  const createAdSpending = async (data: AdSpending["data"]) => {
    if (!user) return;
    const { data: row, error } = await supabase
      .from("crm_ad_spending")
      .insert({ user_id: user.id, data: data as never })
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    setAdSpending((prev) => [row as unknown as AdSpending, ...prev]);
  };

  const deleteAdSpending = async (id: string) => {
    const { error } = await supabase.from("crm_ad_spending").delete().eq("id", id);
    if (error) {
      console.error(error);
      return;
    }
    setAdSpending((prev) => prev.filter((x) => x.id !== id));
  };

  /*  ═══ ⚠️ IL VALORE DEL CONTESTO NON DEVE CAMBIARE PER NIENTE ═══════════
      Segnalazione del committente: «su Chrome il CRM va male».

      Qui c'era un oggetto scritto a mano dentro `value={{ … }}`: React lo
      ricostruiva a OGNI disegno di questo componente, e un oggetto nuovo vuol
      dire, per React, «il contesto è cambiato» — quindi si ridisegnavano tutte
      e cinquantanove le schermate che leggono `useCRM()`, anche quando non era
      cambiato un solo dato. E questo componente si ridisegna anche per cose
      che non lo riguardano: il battito di AuthContext ogni minuto, un
      caricamento che finisce, la lettura dei consulenti. Tutto il CRM si
      ridisegnava una volta al minuto, per niente.

      Adesso il valore si ricostruisce solo quando cambia davvero uno dei
      quattro dati che contiene.

      ⚠️ E LE FUNZIONI NON POSSONO ESSERE QUELLE DI PRIMA. Se mettessimo qui
       dentro `updateLead` & co. — che React ricrea a ogni disegno — il valore
       cambierebbe lo stesso a ogni disegno e non avremmo guadagnato niente.
       Quindi si consegnano involucri STABILI, creati una volta sola, che al
       momento della chiamata vanno a prendere la versione più fresca da un
       riferimento. Non è solo più veloce: toglie di mezzo tutta la famiglia di
       guasti da "funzione vecchia" — quella per cui si salvava una scheda e si
       riscriveva sopra lo stato di dieci secondi prima (il difetto segnalato
       come «devo cambiare lo stato due volte»). Le funzioni chiamate sono
       sempre e solo quelle dell'ultimo disegno. */
  const funzioni = useRef({
    reload,
    createLead,
    updateLead,
    deleteLead,
    createConsultant,
    updateConsultant,
    rimuoviConsulente,
    createAdSpending,
    deleteAdSpending,
    //  ⚠️ SI SCEGLIE FRA CHI FA LE CONSULENZE, non fra tutta l'anagrafica.
    //  Questo è il turno che il pulsante «Prendi in carico» propone da solo:
    //  senza il filtro, il giro toccava anche a driver e installatori — e
    //  siccome loro non hanno chiamate all'attivo (`callOggi` a zero) erano
    //  proprio quelli che il criterio «tocca a chi ne ha fatte meno»
    //  sceglieva per primi. Il posto che decide chi fa consulenze è uno solo
    //  (crm/chi-fa-la-consulenza), e finché nessuno è segnato restituisce
    //  tutti: il giro di oggi non cambia di una riga.
    prossimoConsulente: () => migliorConsulente(soloConsulenti(consultants)),
  });
  //  Si aggiornano a ogni disegno, PRIMA che qualcuno possa chiamarle: gli
  //  involucri qui sotto leggono sempre da qui.
  funzioni.current = {
    reload,
    createLead,
    updateLead,
    deleteLead,
    createConsultant,
    updateConsultant,
    rimuoviConsulente,
    createAdSpending,
    deleteAdSpending,
    prossimoConsulente: () => migliorConsulente(soloConsulenti(consultants)),
  };
  const stabili = useMemo(
    () => ({
      reload: (...a: Parameters<typeof reload>) => funzioni.current.reload(...a),
      createLead: (...a: Parameters<typeof createLead>) => funzioni.current.createLead(...a),
      updateLead: (...a: Parameters<typeof updateLead>) => funzioni.current.updateLead(...a),
      deleteLead: (...a: Parameters<typeof deleteLead>) => funzioni.current.deleteLead(...a),
      createConsultant: (...a: Parameters<typeof createConsultant>) =>
        funzioni.current.createConsultant(...a),
      updateConsultant: (...a: Parameters<typeof updateConsultant>) =>
        funzioni.current.updateConsultant(...a),
      rimuoviConsulente: (...a: Parameters<typeof rimuoviConsulente>) =>
        funzioni.current.rimuoviConsulente(...a),
      createAdSpending: (...a: Parameters<typeof createAdSpending>) =>
        funzioni.current.createAdSpending(...a),
      deleteAdSpending: (...a: Parameters<typeof deleteAdSpending>) =>
        funzioni.current.deleteAdSpending(...a),
      prossimoConsulente: () => funzioni.current.prossimoConsulente(),
    }),
    [],
  );
  const valore = useMemo(
    () => ({ leads, consultants, adSpending, loading, ...stabili }),
    [leads, consultants, adSpending, loading, stabili],
  );

  return <CRMContext.Provider value={valore}>{children}</CRMContext.Provider>;
}

export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error("useCRM must be used inside CRMProvider");
  return ctx;
}
