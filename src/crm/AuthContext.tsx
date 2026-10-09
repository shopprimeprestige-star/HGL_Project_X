/** CHI È ENTRATO NEL CRM ─────────────────────────────────────────────────────
 *  Due identità sovrapposte, e servono entrambe:
 *
 *  · `user` è la sessione Supabase, quella che le regole di riga guardano per
 *    decidere quali trattative esistono. Senza, il CRM si apre vuoto.
 *  · `consulente` è la PERSONA che ha digitato il PIN nella schermata di
 *    accesso. La sessione Supabase è sempre quella del proprietario dei dati —
 *    è l'unico modo perché l'RLS lasci passare qualcosa — quindi da sola non
 *    saprebbe dire chi dei consulenti sta lavorando, e i filtri "solo i miei"
 *    resterebbero senza soggetto.
 *
 *  Le due identità nascono insieme in /api/crm/accesso (PIN → magic-link) e
 *  muoiono insieme in signOut: un consulente senza sessione Supabase sarebbe un
 *  fantasma che vede schermate vuote, e va ripulito all'avvio.
 */
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
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ConsultantPermissions } from "@/crm/types";
import {
  PERMESSI_RUOLO,
  RUOLO_MINIMO,
  accessoDaElenco,
  accessoPieno,
  ruoloDaScritta,
  type Accesso,
  type Permesso,
  type RuoloCRM,
} from "@/crm/permessi";

export interface ConsulenteCollegato {
  id: string;
  nome: string;
  iniziali: string;
  /** Token di sessione consulente: vale per le rotte /api/consulente/*. */
  token: string;
  permessi?: ConsultantPermissions;
  /** Il livello e l'elenco disteso dei permessi, come li ha risolti il server.
   *  Servono a NASCONDERE quello che non gli serve — non a difendere: il
   *  rifiuto vero lo dà `guardiaCRM` su ogni rotta. */
  ruolo?: RuoloCRM;
  concessi?: Permesso[];
}

/** Quello che /api/crm/accesso restituisce: tutto opzionale, perché il corpo
 *  arriva dalla rete e non c'è nessuna garanzia che sia quello atteso. */
interface RispostaAccesso {
  ok?: boolean;
  motivo?: string;
  attesaSec?: number;
  tokenHash?: string;
  token?: string;
  consulente?: { id: string; nome: string; iniziali: string };
  permessi?: ConsultantPermissions;
  ruolo?: RuoloCRM;
  concessi?: Permesso[];
}

/** Esito dell'accesso col PIN. `attesaSec` compare solo quando il server ha
 *  chiuso l'accesso per troppi tentativi: serve al tastierino per mostrare il
 *  conto alla rovescia invece di un pulsante che continua a fallire. */
export interface EsitoPin {
  ok: boolean;
  motivo?: string;
  attesaSec?: number;
}

interface AuthContextValue {
  user: User | null;
  consulente: ConsulenteCollegato | null;
  loading: boolean;
  /** Che cosa può fare chi sta guardando lo schermo. Chi è entrato con email e
   *  password ha tutto; chi è entrato col PIN ha quello che gli danno i suoi
   *  MESTIERI — più le chiavi di casa, se un admin gliele ha date (vedi
   *  crm/permessi.ts). L'elenco arriva già risolto dal server: qui non si
   *  ricalcola niente. */
  accesso: Accesso;
  accediConPin: (consultantId: string, pin: string) => Promise<EsitoPin>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CHIAVE_CONSULENTE = "hg_crm_consulente";
//  Chiave di src/crm/consulente-sessione.ts. Ci si scrive dentro perché
//  l'identità è la stessa: chi entra nel CRM col proprio PIN è lo stesso che
//  l'area mobile /consulente riconosce, e non ha senso fargli digitare due
//  volte lo stesso codice per passare dall'una all'altra.
const CHIAVE_AREA_CONSULENTE = "hg_consulente";

function daArchivio(): ConsulenteCollegato | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHIAVE_CONSULENTE);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<ConsulenteCollegato>;
    if (!c.id || !c.token) return null;
    return {
      id: c.id,
      nome: c.nome ?? "",
      iniziali: c.iniziali ?? "?",
      token: c.token,
      permessi: c.permessi,
      //  ⚠️ QUI DENTRO CI SONO ANCORA I NOMI VECCHI. Questa riga è stata scritta
      //  da una sessione aperta ieri, e può dire "titolare" o "responsabile":
      //  senza tradurla, un livello che non riconosciamo diventerebbe il ripiego
      //  e chiuderebbe mezzo menu a chi le chiavi ce le ha. `undefined` quando
      //  non si capisce: chi legge sa già che vale RUOLO_MINIMO.
      ruolo: ruoloDaScritta(c.ruolo) ?? undefined,
      concessi: Array.isArray(c.concessi) ? c.concessi : undefined,
    };
  } catch {
    return null;
  }
}

/** Un elenco di permessi ridotto a stringa confrontabile: arriva dal server in
 *  un ordine che non è detto sia il nostro, e un confronto ingenuo direbbe
 *  «cambiato» a ogni battito, riscrivendo lo stato senza motivo. */
const firmaConcessi = (e?: Permesso[]): string => (e ? [...e].sort().join(",") : "");

function archivia(c: ConsulenteCollegato | null) {
  if (typeof window === "undefined") return;
  try {
    if (c) {
      window.localStorage.setItem(CHIAVE_CONSULENTE, JSON.stringify(c));
      window.localStorage.setItem(
        CHIAVE_AREA_CONSULENTE,
        JSON.stringify({
          token: c.token,
          id: c.id,
          nome: c.nome,
          permessi: c.permessi,
          ruolo: c.ruolo,
          concessi: c.concessi,
        }),
      );
    } else {
      window.localStorage.removeItem(CHIAVE_CONSULENTE);
      window.localStorage.removeItem(CHIAVE_AREA_CONSULENTE);
    }
  } catch {
    // Archiviazione negata (navigazione privata, quota piena): l'accesso resta
    // valido in memoria fino alla chiusura della scheda.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  //  Si parte sempre da null e si legge l'archivio solo dopo, a sessione
  //  confermata: leggerlo già al primo disegno darebbe due pagine diverse fra
  //  server e browser, e comunque un nome senza sessione non serve a nulla.
  const [consulente, setConsulente] = useState<ConsulenteCollegato | null>(null);
  const [loading, setLoading] = useState(true);

  const impostaConsulente = useCallback((c: ConsulenteCollegato | null) => {
    archivia(c);
    setConsulente(c);
  }, []);

  useEffect(() => {
    // Setup listener BEFORE getSession (per Supabase best practice)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Caduta la sessione Supabase, il consulente collegato non ha più dati da
      // vedere: tenerlo scritto significherebbe mostrare il suo nome sopra
      // schermate vuote.
      if (!session) impostaConsulente(null);
    });

    // Magic-link: se l'URL contiene ?token_hash=...&type=magiclink (arrivo da /api/magic),
    // scambia il token per una sessione reale, poi ripulisce l'URL.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (tokenHash && type) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: type as "magiclink" })
        .then(({ data, error }) => {
          if (!error) setUser(data.session?.user ?? null);
          if (data?.session) setConsulente(daArchivio());
          else impostaConsulente(null);
          // rimuove i parametri sensibili dall'URL senza ricaricare
          window.history.replaceState({}, "", window.location.pathname);
          setLoading(false);
        });
      return () => sub.subscription.unsubscribe();
    }

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      // Chi ha ricaricato la pagina ritrova il proprio nome, ma solo se la
      // sessione Supabase è sopravvissuta: le due identità stanno insieme.
      if (data.session) setConsulente(daArchivio());
      else impostaConsulente(null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [impostaConsulente]);

  /** ── I PERMESSI CAMBIANO MENTRE LA PERSONA STA LAVORANDO ─────────────────
   *  Il problema, detto com'è: livello e permessi arrivano nel browser UNA
   *  VOLTA, al momento del PIN, e da lì restano fermi nel localStorage. Chi
   *  veniva promosso ad ADMIN dalla scheda continuava a vedere il menu di
   *  prima — il server gli avrebbe già risposto di sì, ma la barra laterale non
   *  lo sapeva — e l'unico rimedio era uscire e rientrare. Chi non lo sapeva
   *  concludeva che «il permesso non ha funzionato», e lo assegnava di nuovo.
   *
   *  Qui i permessi si RICHIEDONO: all'avvio, ogni volta che si torna su questa
   *  scheda del browser, e comunque una volta al minuto. È una richiesta
   *  piccolissima e il token ce l'abbiamo già.
   *  ⚠️ Ed è anche la strada da cui passa un MESTIERE acceso o spento: la rotta
   *  ricalcola l'elenco leggendo i mestieri della persona (api.crm.accesso), e
   *  la scheda del consulente promette a chiare lettere che vale «subito, entro
   *  un minuto». Quella promessa è questa riga: se un giorno il battito
   *  sparisce, sparisce anche il senso della frase scritta nella scheda.
   *
   *  Che cosa NON fa, di proposito: non fa uscire nessuno. Se la risposta non
   *  arriva, o dice di no, si tiene quello che c'è — la rete che cade per dieci
   *  secondi non deve buttare fuori chi sta lavorando; a chi è stato revocato
   *  davvero ci pensa la guardia sul server, che risponde 401 alla prima cosa
   *  che chiede. */
  const rifConsulente = useRef<ConsulenteCollegato | null>(null);
  useEffect(() => {
    rifConsulente.current = consulente;
  }, [consulente]);

  const token = consulente?.token;
  useEffect(() => {
    if (!token) return;
    let vivo = true;

    const chiedi = async () => {
      //  A scheda nascosta non si chiede niente: al ritorno ci pensa il
      //  visibilitychange qui sotto, che è lo stesso momento in cui la persona
      //  torna a guardare il menu.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      let r: RispostaAccesso | null = null;
      try {
        const x = await fetch(`/api/crm/accesso?token=${encodeURIComponent(token)}`);
        r = (await x.json()) as RispostaAccesso;
      } catch {
        return; // rete assente: si tiene quello che c'è
      }
      if (!vivo || !r?.ok) return;
      //  ELENCO ASSENTE O VUOTO ≠ «NIENTE DI NIENTE»: è una risposta a cui non
      //  crediamo (il server mette sempre almeno `lead.propri`), e sovrascriverci
      //  sopra i permessi buoni taglierebbe il menu a chi ce l'ha giusto.
      if (!Array.isArray(r.concessi) || r.concessi.length === 0) return;
      const prec = rifConsulente.current;
      //  Nel frattempo può essere uscito, o essere entrata un'altra persona.
      if (!prec || prec.token !== token) return;
      const ruolo = ruoloDaScritta(r.ruolo) ?? RUOLO_MINIMO;
      const uguale =
        prec.ruolo === ruolo && firmaConcessi(prec.concessi) === firmaConcessi(r.concessi);
      if (uguale) return;
      impostaConsulente({
        ...prec,
        ruolo,
        concessi: r.concessi,
        permessi: r.permessi ?? prec.permessi,
      });
    };

    void chiedi();
    const alRitorno = () => void chiedi();
    window.addEventListener("focus", alRitorno);
    document.addEventListener("visibilitychange", alRitorno);
    const battito = window.setInterval(alRitorno, 60_000);
    return () => {
      vivo = false;
      window.removeEventListener("focus", alRitorno);
      document.removeEventListener("visibilitychange", alRitorno);
      window.clearInterval(battito);
    };
  }, [token, impostaConsulente]);

  /** ── DAL PIN ALLA SESSIONE ────────────────────────────────────────────────
   *  Il PIN parte da qui e si ferma sul server: /api/crm/accesso lo verifica col
   *  service role e restituisce un magic-link già pronto, che viene scambiato
   *  subito con una sessione Supabase autentica. Nel browser non resta il PIN,
   *  resta la sessione — revocabile, e con una scadenza. */
  const accediConPin = useCallback(
    async (consultantId: string, pin: string): Promise<EsitoPin> => {
      let risposta: RispostaAccesso | null = null;
      try {
        const r = await fetch("/api/crm/accesso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consultantId, pin }),
        });
        risposta = (await r.json()) as RispostaAccesso;
      } catch {
        return { ok: false, motivo: "Connessione non riuscita, riprovare." };
      }

      if (!risposta?.ok || !risposta.tokenHash || !risposta.consulente) {
        return {
          ok: false,
          motivo: risposta?.motivo ?? "Accesso non riuscito.",
          attesaSec: risposta?.attesaSec,
        };
      }

      // Prima l'identità, poi la sessione: quando il listener di Supabase
      // sveglia il CRM, il nome di chi è entrato deve essere già disponibile.
      const chi: ConsulenteCollegato = {
        id: risposta.consulente.id,
        nome: risposta.consulente.nome,
        iniziali: risposta.consulente.iniziali,
        token: risposta.token ?? "",
        permessi: risposta.permessi,
        //  Anche qui la risposta si traduce: un worker non ancora aggiornato
        //  risponderebbe con i nomi vecchi, e un livello non riconosciuto
        //  varrebbe il ripiego proprio a chi ha appena digitato il PIN giusto.
        ruolo: ruoloDaScritta(risposta.ruolo) ?? undefined,
        concessi: Array.isArray(risposta.concessi) ? risposta.concessi : undefined,
      };
      impostaConsulente(chi);

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: risposta.tokenHash,
        type: "magiclink",
      });
      if (error || !data.session) {
        impostaConsulente(null);
        return { ok: false, motivo: "Accesso non riuscito, riprovare." };
      }
      setUser(data.session.user);
      return { ok: true };
    },
    [impostaConsulente],
  );

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/CRM` },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const token = consulente?.token;
    impostaConsulente(null);
    // La riga di sessione sul server si chiude senza aspettare la risposta:
    // uscire dall'interfaccia non deve dipendere dalla rete. Se la chiamata non
    // arriva, il token scade comunque da solo dopo dodici ore.
    if (token) {
      void fetch(`/api/crm/accesso?token=${encodeURIComponent(token)}`, { method: "DELETE" }).catch(
        () => {},
      );
    }
    await supabase.auth.signOut();
  };

  /** ── CHI STA GUARDANDO, E COSA PUÒ ────────────────────────────────────────
   *  Senza consulente collegato si è entrati con email e password: è il
   *  proprietario dei dati, e ha tutto. Con il PIN valgono i permessi che il
   *  server ha già risolto e consegnato — qui non si rifà il ragionamento, o
   *  esisterebbero due tabelle di regole da tenere allineate. Vale a maggior
   *  ragione da quando metà del permesso viene dai MESTIERI, che stanno in una
   *  tabella che questo file non legge nemmeno: l'elenco arriva fatto.
   *  Una risposta vecchia senza `concessi` (archivio scritto prima di questa
   *  versione) vale come il livello più basso: si rientra e si aggiorna. */
  const accesso = useMemo<Accesso>(() => {
    if (!consulente) return accessoPieno();
    //  Il livello è già tradotto e ripulito da `daArchivio`/`accediConPin`: qui
    //  resta solo il ripiego, che è e deve restare il livello più basso.
    const ruolo = consulente.ruolo ?? RUOLO_MINIMO;
    //  ── ELENCO ASSENTE ≠ ELENCO VUOTO ──────────────────────────────────────
    //   accessoDaElenco mette esplicitamente a NO ogni permesso che non trova
    //   nell'elenco. Va benissimo quando l'elenco c'è: è il modo di dire "questi
    //   sì, gli altri no". Ma una sessione salvata PRIMA che i permessi
    //   esistessero quell'elenco non ce l'ha — e "assente" veniva letto come
    //   "vuoto", cioè come "niente di niente". Risultato: anche un admin si
    //   ritrovava mezzo menu, perché ogni voce risultava vietata.
    //   Quando l'elenco manca vale il livello: è la sola lettura onesta di un
    //   dato che non è stato scritto. Il ripiego resta il livello più basso, così
    //   una sessione senza livello NON diventa mai un admin per errore.
    const elenco = Array.isArray(consulente.concessi) ? consulente.concessi : null;
    if (!elenco || elenco.length === 0) return accessoDaElenco(ruolo, PERMESSI_RUOLO[ruolo]);
    return accessoDaElenco(ruolo, elenco);
  }, [consulente]);

  return (
    <AuthContext.Provider
      value={{ user, consulente, loading, accesso, accediConPin, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Il consulente che ha digitato il PIN, per i filtri "solo i miei" e per le
 *  schermate che devono mostrare il nome di chi sta lavorando. `null` quando si
 *  è entrati con email e password, senza scegliere un nome. */
export function useConsulenteCollegato(): ConsulenteCollegato | null {
  return useAuth().consulente;
}

/** «Può?», dovunque serva nell'interfaccia. Nasconde, non difende. */
export function usePuo(): (p: Permesso) => boolean {
  return useAuth().accesso.puo;
}

/** ── COME SI PRESENTA UNA CHIAMATA ALLE ROTTE /api/crm/* ───────────────────
 *  Il server deve poter sapere CHI chiede, e da due strade diverse:
 *   · `x-crm-token`   il token della sessione consulente, nato dal PIN. Quando
 *                     c'è comanda lui, perché è l'unico che dice quale delle
 *                     persone dello studio sta lavorando;
 *   · `Authorization` la sessione Supabase, cioè chi è entrato con email e
 *                     password.
 *  Non è una funzione dentro il contesto perché serve anche fuori da React (un
 *  effetto, un gestore di eventi), e il token si legge dallo stesso archivio in
 *  cui questo file lo ha scritto. */
/** ── ⚠️ IL GETTONE DEVE ESSERE ANCORA BUONO QUANDO ARRIVA ──────────────────
 *
 *  Segnalazione del committente: «quando provo ad aggiungere consulenze o
 *  altro, ogni tanto dice che non riesce ad accedere al CRM col PIN; aggiorno
 *  la pagina e va. Perché fa così?».
 *
 *  Perché il gettone di Supabase dura UN'ORA e si rinnova da solo con un
 *  orologio del browser. Quell'orologio però non è affidabile come sembra:
 *  in una scheda lasciata dietro le altre i tempi vengono strozzati, e con il
 *  computer che va in sospensione (il portatile chiuso a pranzo) non scatta
 *  affatto. Al risveglio il gettone è già scaduto da un pezzo: la prima cosa
 *  che si preme parte con quello vecchio, il server risponde «serve l'accesso
 *  al CRM» — ed è vero, in quell'istante. Ricaricando la pagina il programma
 *  riparte, rinnova subito, e tutto torna a funzionare: da fuori sembra un
 *  guasto a caso, ed è sempre lo stesso.
 *
 *  Qui si smette di sperare nell'orologio: PRIMA di ogni chiamata si guarda
 *  quanto manca alla scadenza e, se è vicina o passata, si rinnova e si
 *  aspetta. Costa una richiesta ogni cinquanta minuti e toglie di mezzo il
 *  caso per cui si ricaricava la pagina.
 *
 *  ⚠️ IL MARGINE NON È ZERO: fra il momento in cui si prepara la richiesta e
 *   quello in cui il server la legge passano rete e code. Un gettone che scade
 *   fra dieci secondi è un gettone già scaduto.
 *  ⚠️ SE IL RINNOVO NON RIESCE SI MANDA QUELLO CHE C'È: il server dirà di
 *   rientrare, che a quel punto è la cosa giusta da dire — la sessione è morta
 *   davvero. */
const MARGINE_GETTONE_S = 120;

async function gettoneBuono(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    const sess = data.session;
    if (!sess?.access_token) return "";
    const scade = Number(sess.expires_at || 0); // secondi, non millesimi
    const fraQuanto = scade - Math.floor(Date.now() / 1000);
    if (scade && fraQuanto > MARGINE_GETTONE_S) return sess.access_token;
    //  Vicino alla scadenza (o già scaduto): si rinnova e si ASPETTA. È
    //  l'attesa che toglie di mezzo il «ricarica la pagina».
    const { data: nuova } = await supabase.auth.refreshSession();
    return nuova.session?.access_token || sess.access_token;
  } catch {
    return "";
  }
}

export async function intestazioniCRM(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...extra };
  const chi = daArchivio();
  if (chi?.token) out["x-crm-token"] = chi.token;
  const jwt = await gettoneBuono();
  if (jwt) out.Authorization = `Bearer ${jwt}`;
  return out;
}

/** ── LA CHIAMATA AL CRM CHE NON SI ARRENDE AL PRIMO «NO» ───────────────────
 *  Stessa segnalazione, seconda metà: il gettone può scadere anche FRA la
 *  preparazione della richiesta e la risposta del server (una rete lenta, una
 *  coda, il computer che si è appena svegliato). Allora si rinnova e si
 *  riprova UNA volta sola, senza dire niente a nessuno: per chi sta lavorando
 *  non è successo niente.
 *  ⚠️ UNA VOLTA SOLA, e solo sul 401 di autenticazione: se la sessione è morta
 *   davvero, riprovare in eterno vorrebbe dire una finestra che si pianta
 *   invece di dire «rientra».
 *  ⚠️ NON SI RIPROVA UN'OPERAZIONE CHE PUÒ AVER SCRITTO: il 401 arriva dalla
 *   guardia, cioè PRIMA di qualunque scrittura (vedi api.crm.accesso). Un 500 a
 *   metà scrittura non passa di qui. */
export async function fetchCRM(url: string, init: RequestInit = {}): Promise<Response> {
  const conGettone = async () => ({
    ...init,
    headers: { ...(await intestazioniCRM()), ...((init.headers as Record<string, string>) ?? {}) },
  });
  const risposta = await fetch(url, await conGettone());
  if (risposta.status !== 401) return risposta;
  try {
    await supabase.auth.refreshSession();
  } catch {
    return risposta;
  }
  console.warn("[CRM] gettone scaduto a metà strada: rinnovato e riprovato una volta");
  return fetch(url, await conGettone());
}
