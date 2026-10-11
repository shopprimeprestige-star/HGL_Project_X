/** ACCESSO AL CRM COL PIN DEL CONSULENTE ────────────────────────────────────
 *  Si sceglie il proprio nome dall'elenco e si digita il PIN: nessuna email,
 *  nessuna password. È lo stesso gesto che i consulenti fanno già in Meetly
 *  per entrare come presentatori, con lo stesso PIN (tabella consultant_pins,
 *  rispecchiata in app_config.presenters da /api/crm/consulente-pin).
 *
 *  PERCHÉ QUI SI GENERA UNA VERA SESSIONE SUPABASE
 *  Il CRM legge i dati direttamente da Supabase e le regole di riga li filtrano
 *  sull'utente autenticato. Un PIN che si limitasse ad accendere un interruttore
 *  nell'interfaccia aprirebbe un CRM perfettamente vuoto: zero trattative, zero
 *  consulenti, e nessun errore a spiegare il perché. Quindi il PIN, verificato
 *  qui col service role, si trasforma in un magic-link Supabase per l'utente
 *  PROPRIETARIO dei dati (crm_consultants.user_id): il client lo scambia con
 *  supabase.auth.verifyOtp e ottiene una sessione autentica, esattamente come
 *  fa già /api/magic. Conseguenza da tenere presente: chi entra col PIN opera
 *  con i permessi del proprietario dei dati: la distinzione fra consulenti è
 *  di interfaccia.
 *
 *  IL PIN NON ESCE MAI DA QUI. Viaggia una sola volta, dal tastierino a questa
 *  rotta; l'elenco dei consulenti non lo contiene, la risposta nemmeno.
 *
 *  GET                          -> { ok, consulenti: [{ id, nome, iniziali }] }
 *  GET ?token=...               -> { ok, consulente, ruolo, concessi, permessi }
 *                                  il livello di ADESSO di chi ha quel token
 *  POST { consultantId, pin }   -> { ok, tokenHash, consulente, token, permessi, ruolo }
 *  DELETE ?token=...            -> chiude la sessione consulente
 *
 *  ── E DA QUI IN POI ANCHE IL CONTROLLO DEI PERMESSI ───────────────────────
 *  Questo file è due cose insieme, come già api.presenter.consultant: la rotta
 *  di accesso e il MODULO che le altre rotte /api/crm/* usano per sapere chi
 *  sta chiamando e che cosa gli è concesso (`guardiaCRM`). Sta qui e non in un
 *  file nuovo per un motivo pratico: una rotta nuova non compila finché
 *  l'albero delle rotte non viene rigenerato, e questa esiste già.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
//  Quanto vive una sessione aperta col PIN: due scadenze, e il perché di
//  tutte e due (crm/sessione-pin).
import { daRinfrescare, statoSessione } from "@/crm/sessione-pin";
import {
  MOTIVO_PERMESSO,
  PERMESSO_DI_SCHEDA,
  accessoDaElenco,
  accessoPieno,
  risolviAccesso,
  type Accesso,
  type Permesso,
} from "@/crm/permessi";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

//  Stesso prefisso di /api/consulente/login: la sessione consulente è una sola
//  cosa sola in tutta l'applicazione, che la si apra dal CRM o dall'area mobile.
const PREFISSO_SESSIONE = "csess:";
const PREFISSO_TENTATIVI = "accpin:";

//  ── QUANTO SI PUÒ SBAGLIARE ──────────────────────────────────────────────
//  Un PIN di quattro cifre sono diecimila combinazioni: senza un freno, un
//  programma le prova tutte in pochi minuti. Cinque tentativi, poi si aspetta;
//  e ogni blocco successivo dura il doppio del precedente, così un attacco
//  paziente diventa comunque impraticabile mentre il consulente che ha solo
//  sbagliato a digitare perde al massimo cinque minuti.
const SOGLIA = 5;
const FINESTRA_MS = 15 * 60_000;
const BLOCCO_BASE_MS = 5 * 60_000;
const BLOCCO_MAX_MS = 30 * 60_000;

interface Tentativi {
  n: number;
  liv: number;
  fino?: string;
  at: string;
}

/** Il conteggio si tiene per consulente E per indirizzo: il primo protegge il
 *  singolo PIN, il secondo impedisce di girare fra tutti i nomi dell'elenco
 *  provando 1234 su ciascuno. */
const ipDi = (request: Request): string => {
  const raw =
    request.headers.get("cf-connecting-ip") ||
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0] ||
    "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.:]/g, "")
    .slice(0, 45);
};

async function leggiTentativi(chiavi: string[]): Promise<Map<string, Tentativi>> {
  const m = new Map<string, Tentativi>();
  if (!chiavi.length) return m;
  const { data } = await supabaseAdmin.from("app_config").select("key,value").in("key", chiavi);
  //  app_config non compare nei tipi generati di Supabase: la riga si descrive
  //  qui, come già fanno le altre rotte che la usano.
  for (const r of (data ?? []) as unknown as { key: string; value: string | null }[]) {
    try {
      const t = JSON.parse(r.value || "{}") as Partial<Tentativi>;
      m.set(r.key, {
        n: Number(t.n) || 0,
        liv: Number(t.liv) || 0,
        fino: t.fino,
        at: String(t.at ?? ""),
      });
    } catch {
      // riga illeggibile: vale come "nessun tentativo registrato"
    }
  }
  return m;
}

const attesaDi = (t?: Tentativi): number => {
  if (!t?.fino) return 0;
  const ms = Date.parse(t.fino) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 0;
};

async function scriviTentativi(chiave: string, t: Tentativi) {
  await supabaseAdmin
    .from("app_config")
    .upsert(
      { key: chiave, value: JSON.stringify(t), updated_at: new Date().toISOString() } as never,
      { onConflict: "key" },
    );
}

/** Registra un errore e restituisce quanti tentativi restano prima del blocco
 *  (0 se il blocco è appena scattato). */
async function registraErrore(chiave: string, prec: Tentativi | undefined): Promise<Tentativi> {
  const ora = Date.now();
  //  Gli errori sparsi in una giornata non devono sommarsi fra loro: conta solo
  //  la raffica, cioè quello che succede entro un quarto d'ora.
  const recente = !!prec?.at && ora - Date.parse(prec.at) < FINESTRA_MS;
  let n = (recente ? prec!.n : 0) + 1;
  let liv = recente ? prec!.liv : 0;
  let fino: string | undefined;
  if (n >= SOGLIA) {
    liv = Math.min(liv + 1, 6);
    fino = new Date(ora + Math.min(BLOCCO_BASE_MS * 2 ** (liv - 1), BLOCCO_MAX_MS)).toISOString();
    //  Azzerato il contatore: passata l'attesa si ricomincia da cinque tentativi
    //  buoni, ma il blocco successivo sarà più lungo (liv non torna indietro).
    n = 0;
  }
  const t: Tentativi = { n, liv, fino, at: new Date(ora).toISOString() };
  await scriviTentativi(chiave, t);
  return t;
}

async function azzeraTentativi(chiavi: string[]) {
  if (chiavi.length) await supabaseAdmin.from("app_config").delete().in("key", chiavi);
}

const inizialiDi = (nome: string): string =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

function nuovoToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const tokenPulito = (v: unknown): string => {
  const t = String(v ?? "")
    .trim()
    .toLowerCase();
  return /^[a-f0-9]{32,128}$/.test(t) ? t : "";
};

const minuti = (sec: number) => (sec >= 60 ? `${Math.ceil(sec / 60)} minuti` : `${sec} secondi`);

/* ═══════════════════════════════════════════════════════════════════════════
   IL CONTROLLO CHE USANO LE ALTRE ROTTE /api/crm/*

   NASCONDERE UNA VOCE DI MENU NON È UN PERMESSO. Chi conosce l'indirizzo di una
   rotta la chiama lo stesso, con `curl`, e a quel punto l'unica cosa fra lui e i
   dati è quello che c'è scritto qui sotto. Il controllo vive DOVE STANNO I DATI.

   DUE MODI DI PRESENTARSI, E UNA PRECEDENZA CHE CONTA:
    1. il token della sessione consulente ('csess:<token>', quello che nasce dal
       PIN qui sopra): comanda LUI, e i permessi si rileggono dal database a
       ogni richiesta — toglierne uno deve avere effetto subito, anche su chi è
       già dentro;
    2. in mancanza, la sessione Supabase nell'intestazione Authorization, cioè
       chi è entrato con email e password: i suoi permessi si ricavano da
       `user_settings` (is_admin = accesso pieno, altrimenti dalle schede concesse).

   ⚠️ LIMITE DICHIARATO, E NON RISOLVIBILE DA QUESTO FILE. Il PIN qui sopra
   genera una sessione Supabase DEL TITOLARE (è l'unico modo perché l'RLS lasci
   passare i dati: vedi l'intestazione). Quindi un consulente già entrato, se
   omette di proposito il proprio token e manda solo quella sessione, viene
   riconosciuto come proprietario. Chiuderlo davvero richiede un utente Supabase per
   consulente e regole di riga per consulente — un intervento sul livello dati,
   fuori da queste rotte. Fino ad allora il controllo qui sotto vale contro
   l'errore e contro chi arriva da fuori, non contro il consulente che manomette
   la propria richiesta.
   ═════════════════════════════════════════════════════════════════════════ */

export interface ChiamanteCRM {
  /** "proprietario" = sessione Supabase dell'account che possiede i dati;
   *  "consulente" = token nato dal PIN. Non è un LIVELLO (admin/consulente/
   *  setter): è da dove arriva la prova di identità. Si chiamava "titolare",
   *  parola che adesso non esiste più da nessuna parte e che qui confondeva due
   *  cose diverse — chi sei e che cosa puoi. */
  tipo: "proprietario" | "consulente";
  /** Vuoto per chi entra con email e password. */
  consultantId: string;
  adminUserId: string;
  nome: string;
  accesso: Accesso;
}

/** Il token della sessione consulente, ovunque il client lo abbia messo. */
function tokenDaRichiesta(request: Request, inLinea?: unknown): string {
  const diretto = tokenPulito(inLinea);
  if (diretto) return diretto;
  const intestazione = tokenPulito(request.headers.get("x-crm-token"));
  if (intestazione) return intestazione;
  //  Anche nella query, perché alcune chiamate sono GET e non hanno corpo.
  return tokenPulito(new URL(request.url).searchParams.get("token"));
}

interface SessioneConsulente {
  consultantId: string;
  adminUserId: string;
  at: string;
  /** Quando è nata: regge la scadenza assoluta (vedi crm/sessione-pin). */
  creataIl?: string;
}

/*  ⚠️ LE DURATE NON STANNO PIÙ QUI: stanno in crm/sessione-pin con il
    ragionamento che le ha scelte (inattività e vecchiaia) e con le prove. Un
    numero scritto in due posti è un numero che un giorno dice due cose. */

async function leggiSessioneConsulente(token: string): Promise<SessioneConsulente | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", PREFISSO_SESSIONE + token)
    .limit(1);
  const value = (data as { value?: string | null }[] | null)?.[0]?.value;
  if (!value) return null;
  let s: Partial<SessioneConsulente>;
  try {
    s = JSON.parse(value) as Partial<SessioneConsulente>;
  } catch {
    return null;
  }
  if (!s.consultantId || !s.at) return null;
  /*  ── DUE SCADENZE, NON UNA ────────────────────────────────────────────
      Dodici ore di INATTIVITÀ (protegge la postazione lasciata accesa) e
      sette giorni dall'ingresso comunque vada (impedisce che un gettone
      rubato diventi una chiave eterna: è l'unica scadenza che chi lo usa non
      può rimandare). La regola — e il perché di tutte e due — sta in
      crm/sessione-pin, dove si prova senza database. */
  if (statoSessione(s) !== "viva") {
    await supabaseAdmin
      .from("app_config")
      .delete()
      .eq("key", PREFISSO_SESSIONE + token);
    return null;
  }
  /*  ── ⚠️ LE DODICI ORE SI CONTANO DALL'ULTIMA VOLTA, NON DALL'INGRESSO ──
      Segnalazione del committente: «ogni tanto dice che non riesce ad accedere
      al CRM col PIN». Una delle due cause stava qui: la scadenza partiva
      dall'istante dell'ingresso e non si spostava più. Chi entrava alle otto
      del mattino veniva buttato fuori alle otto di sera MENTRE STAVA
      LAVORANDO, senza che niente glielo avesse detto — e l'altra causa (il
      gettone di Supabase, vedi crm/AuthContext) somigliava talmente a questa
      che le due si confondevano.
      Adesso la finestra scorre: ogni volta che questa sessione lavora, la sua
      ora si sposta avanti. Dodici ore di INATTIVITÀ la chiudono, dodici ore di
      lavoro no.
      ⚠️ NON A OGNI RICHIESTA: sarebbe una scrittura in archivio per ogni clic
       (e questo sito si è già fermato una volta per il tetto giornaliero del
       piano). Si rinfresca al massimo ogni mezz'ora, che su una finestra di
       dodici ore non cambia niente.
      ⚠️ E NON SI ASPETTA: la risposta non deve rallentare per una scrittura
       che riguarda il futuro. Se non riesce, pazienza — si riproverà al giro
       dopo. */
  if (daRinfrescare(s)) {
    //  ⚠️ La data di NASCITA si conserva (e si scrive la prima volta che una
    //   riga vecchia lavora): senza, spostando l'ultimo lavoro si perderebbe
    //   l'unica informazione su cui si regge la scadenza assoluta.
    const aggiornata = JSON.stringify({
      ...s,
      creataIl: s.creataIl || s.at,
      at: new Date().toISOString(),
    });
    void supabaseAdmin
      .from("app_config")
      .update({ value: aggiornata, updated_at: new Date().toISOString() } as never)
      .eq("key", PREFISSO_SESSIONE + token)
      .then(undefined, () => {
        /* si riprova al giro dopo */
      });
  }
  return {
    consultantId: s.consultantId,
    adminUserId: s.adminUserId ?? "",
    at: s.at,
  };
}

/** Chi sta chiamando, e che cosa può. `null` = nessuno di riconoscibile. */
export async function chiamanteCRM(
  request: Request,
  tokenInLinea?: unknown,
): Promise<ChiamanteCRM | null> {
  // ── 1. LA SESSIONE NATA DAL PIN ──────────────────────────────────────────
  const sessione = await leggiSessioneConsulente(tokenDaRichiesta(request, tokenInLinea));
  if (sessione) {
    //  I permessi non stanno nella sessione ma nella riga del PIN: una revoca
    //  fatta adesso deve valere adesso, non alla prossima entrata.
    const { data } = await supabaseAdmin
      .from("consultant_pins")
      .select("permissions, admin_user_id")
      .eq("consultant_id", sessione.consultantId)
      .eq("active", true)
      .limit(1);
    const pin = data?.[0];
    //  Accesso revocato mentre era dentro: la sessione non vale più niente.
    if (!pin) return null;

    const { data: righe } = await supabaseAdmin
      .from("crm_consultants")
      .select("data")
      .eq("id", sessione.consultantId)
      .limit(1);
    const d = ((righe ?? []) as { data?: { nome?: string; attivo?: boolean } }[])[0]?.data ?? {};
    if (d.attivo === false) return null;

    //  ⚠️ `d` NON serve solo per il nome: lì dentro ci sono i MESTIERI, e da
    //  quelli dipende metà di ciò che questa persona può fare (crm/permessi.ts).
    //  Senza passarlo, chi fa il consulente si vedrebbe rifiutare preventivi e
    //  incassi dalla guardia pur avendo la spunta accesa — e in scheda
    //  risulterebbe che ce l'ha. Due verità opposte sulla stessa persona.
    const accesso = risolviAccesso(pin.permissions, d);

    //  ── IL PROPRIETARIO CHE ENTRA COL PIN, E FIN DOVE VALE ───────────────
    //   BLOCCO ALLA NASCITA, e va spiegato perché sembra una scorciatoia e non
    //   lo è. Le righe dei PIN create prima dei livelli non ne hanno nessuno, e
    //   il ripiego è — giustamente — il meno potente. Ma il proprietario dei
    //   dati entra col PIN come tutti: veniva quindi trattato da setter, e
    //   assegnare un PIN o un permesso richiede "consulenti". Risultato:
    //   nessuno poteva più assegnare niente, nemmeno a se stesso, e il CRM
    //   restava chiuso a chiave dall'interno.
    //
    //   Serve quindi una via per ricominciare, e passa dalla sessione Supabase
    //   che la stessa richiesta porta con sé.
    //
    //   ⚠️ E VALE SOLO FINCHÉ IL CRM È DAVVERO CHIUSO A CHIAVE. Qui c'era un
    //   difetto che annullava in silenzio TUTTI i permessi lato server:
    //   l'accesso col PIN apre una sessione Supabase DEL PROPRIETARIO (è
    //   l'unico modo perché l'RLS lasci passare i dati), e il browser la manda
    //   in ogni chiamata insieme al token. Quella sessione quindi NON prova
    //   niente su chi sta bussando: è identica per tutti, e il ramo si
    //   accendeva sempre, per chiunque — un setter veniva riconosciuto come
    //   proprietario e `guardiaCRM` gli diceva sempre di sì.
    //
    //   Restringerlo alle sole righe MUTE non bastava, ed è il motivo di questa
    //   riscrittura: nel database di produzione le righe senza livello CI SONO
    //   (sono quelle create prima che i livelli esistessero), e ognuna di esse
    //   sarebbe rimasta un super admin lato server pur vedendosi «Setter» nella
    //   scheda e nel menu. Due verità opposte sulla stessa persona, e quella
    //   che comanda è la più permissiva.
    //
    //   Il ripiego si lega quindi alla CONDIZIONE che lo giustifica — nessuno,
    //   in questa installazione, può più assegnare permessi — e non alla
    //   singola riga muta. Appena esiste UN admin (bastano dieci secondi dalla
    //   scheda) il ripiego si spegne da solo per tutti, senza migrazioni.
    //   Il proprietario non resta mai fuori comunque: «Accesso titolare», con
    //   email e password, non passa da qui e dà accesso pieno.
    if (!accesso.dichiarato) {
      const proprietario = sessione.adminUserId || pin.admin_user_id || "";
      if (!(await esisteChiPuoAssegnare(proprietario))) {
        const forse = await proprietarioDaJwt(request);
        //  Tre condizioni, tutte necessarie: la sessione Supabase dev'essere
        //  dell'account che possiede QUESTI dati (un JWT di un'altra
        //  installazione non eleva nessuno), e dev'essere di uno che le chiavi
        //  ce le ha davvero — elevare a un livello che comunque non può
        //  assegnare permessi non sbloccherebbe niente e allargherebbe e basta.
        if (forse && forse.adminUserId === proprietario && forse.accesso.puo("consulenti")) {
          return {
            //  Resta un CONSULENTE: l'identità è quella del token, ed è ciò che
            //  fa funzionare i filtri «solo i miei» e la protezione anti
            //  lockout. Cambia solo che cosa può, e solo per sbloccare.
            tipo: "consulente",
            consultantId: sessione.consultantId,
            adminUserId: proprietario,
            nome: String(d.nome ?? "").trim() || "Consulente",
            accesso: forse.accesso,
          };
        }
      }
    }

    return {
      tipo: "consulente",
      consultantId: sessione.consultantId,
      adminUserId: sessione.adminUserId || pin.admin_user_id || "",
      nome: String(d.nome ?? "").trim() || "Consulente",
      accesso,
    };
  }

  // ── 2. LA SESSIONE SUPABASE (email e password) ───────────────────────────
  return (await proprietarioDaJwt(request)) ?? null;
}

/** ── C'È ANCORA QUALCUNO CON LE CHIAVI? ────────────────────────────────────
 *  La domanda che decide se il ripiego qui sopra ha ancora un motivo di esistere:
 *  esiste, fra gli accessi ATTIVI di questa installazione, almeno una persona
 *  che può assegnare PIN e permessi? Se sì il CRM non è chiuso dall'interno e
 *  nessuno va elevato; se no siamo nello stato in cui era prima dei livelli, e
 *  qualcuno deve poter ricominciare.
 *  In caso di errore di lettura si risponde SÌ: «non lo so» deve valere come
 *  «non elevare nessuno», mai come «apri tutto». */
async function esisteChiPuoAssegnare(adminUserId: string): Promise<boolean> {
  if (!adminUserId) return true;
  const { data, error } = await supabaseAdmin
    .from("consultant_pins")
    .select("permissions")
    .eq("admin_user_id", adminUserId)
    .eq("active", true);
  if (error) return true;
  return ((data ?? []) as { permissions: unknown }[]).some((r) =>
    risolviAccesso(r.permissions).puo("consulenti"),
  );
}

/** Chi è, letto dalla sola sessione Supabase. `null` se non c'è o non è di un
 *  amministratore riconosciuto. Estratta perché serve in due punti: qui e nel
 *  ramo del PIN, dove risolve il blocco alla nascita descritto sopra. */
async function proprietarioDaJwt(request: Request): Promise<ChiamanteCRM | null> {
  const intestazione = request.headers.get("authorization") || "";
  const jwt = /^bearer /i.test(intestazione) ? intestazione.slice(7).trim() : "";
  if (!jwt) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  const utente = data?.user?.id;
  if (error || !utente) return null;

  const { data: riga } = await supabaseAdmin
    .from("user_settings")
    .select("is_admin, scheme_access, display_name")
    .eq("user_id", utente)
    .maybeSingle();
  const impostazioni = riga as {
    is_admin?: boolean;
    scheme_access?: string[] | null;
    display_name?: string | null;
  } | null;
  const nome = String(impostazioni?.display_name ?? data.user?.email ?? "").trim() || "Admin";

  if (impostazioni?.is_admin) {
    return {
      tipo: "proprietario",
      consultantId: "",
      adminUserId: utente,
      nome,
      accesso: accessoPieno(),
    };
  }

  //  Account senza spunta di amministratore: i suoi permessi sono quelli delle
  //  schede che gli sono state concesse, tradotte una a una. È il comportamento
  //  che aveva già — non gli si toglie niente di ciò che usava ieri.
  const schede = Array.isArray(impostazioni?.scheme_access) ? impostazioni.scheme_access : [];
  const elenco: Permesso[] = [];
  for (const s of schede) {
    const p = PERMESSO_DI_SCHEDA[String(s)];
    if (p && !elenco.includes(p)) elenco.push(p);
  }
  return {
    tipo: "proprietario",
    consultantId: "",
    adminUserId: utente,
    nome,
    //  "consulente" e non "admin": un account senza la spunta non deve ereditare
    //  le chiavi di casa solo perché ha una sessione Supabase. Il livello qui è
    //  poco più di un'etichetta — comanda `elenco`, che `accessoDaElenco`
    //  trasforma in un sì/no esplicito per ogni permesso — ma se un giorno
    //  comandasse, deve comandare verso il basso.
    accesso: accessoDaElenco("consulente", elenco),
  };
}

/** 401 (non so chi sei) e 403 (so chi sei, e non puoi) sono due cose diverse:
 *  la prima chiede di rientrare, la seconda di chiedere a un admin. Dirle con
 *  lo stesso codice manda l'interfaccia a mostrare "sessione scaduta" a chi ha
 *  semplicemente meno permessi, e quella persona riproverà per sempre. */
export function nonAutenticatoCRM(
  intestazioni: Record<string, string>,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "auth",
      reason: "Serve l'accesso al CRM: rientra col tuo PIN.",
      ...extra,
    }),
    {
      status: 401,
      headers: { ...intestazioni, "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}

export function vietatoCRM(
  intestazioni: Record<string, string>,
  permesso: Permesso,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "permesso",
      permesso,
      reason: MOTIVO_PERMESSO[permesso],
      ...extra,
    }),
    {
      status: 403,
      headers: { ...intestazioni, "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
}

/** LA GUARDIA, IN DUE RIGHE.
 *
 *      const g = await guardiaCRM(request, cors, "consulenti");
 *      if (!g.ok) return g.risposta;
 *      // g.chi.accesso.puo(...) per le decisioni più fini
 *
 *  `permesso: null` significa "basta essere entrati". `extra` serve a tenere la
 *  forma che il client si aspetta (list: []), così una pagina senza diritti
 *  resta vuota invece di rompersi. */
export async function guardiaCRM(
  request: Request,
  intestazioni: Record<string, string>,
  permesso: Permesso | null,
  opzioni: { tokenInLinea?: unknown; extra?: Record<string, unknown> } = {},
): Promise<{ ok: true; chi: ChiamanteCRM } | { ok: false; risposta: Response }> {
  const chi = await chiamanteCRM(request, opzioni.tokenInLinea);
  if (!chi) return { ok: false, risposta: nonAutenticatoCRM(intestazioni, opzioni.extra) };
  if (permesso && !chi.accesso.puo(permesso)) {
    return { ok: false, risposta: vietatoCRM(intestazioni, permesso, opzioni.extra) };
  }
  return { ok: true, chi };
}

/** ── CHE COSA PUÒ, ADESSO ──────────────────────────────────────────────────
 *  Lo chiede il browser che ha già una sessione consulente, per riallineare il
 *  menu senza far uscire e rientrare la persona: i permessi vivono nella riga
 *  del PIN, non nella sessione, quindi una promozione fatta un minuto fa si
 *  legge qui. Si risponde SOLO a chi porta il token, che è il segreto stesso
 *  della sessione: non si può chiedere il livello di un altro.
 *
 *  I motivi del "no" sono gli stessi dell'area mobile, e sono frasi da mostrare:
 *  chi le legge deve capire se rientrare o chiedere a un admin. */
async function livelloDiSessione(token: string): Promise<Record<string, unknown>> {
  const sessione = await leggiSessioneConsulente(token);
  if (!sessione) return { ok: false, motivo: "Sessione scaduta: rientra col tuo PIN." };

  const { data } = await supabaseAdmin
    .from("consultant_pins")
    .select("permissions")
    .eq("consultant_id", sessione.consultantId)
    .eq("active", true)
    .limit(1);
  const pin = data?.[0];
  if (!pin) return { ok: false, motivo: "Accesso revocato dall'amministratore." };

  const { data: righe } = await supabaseAdmin
    .from("crm_consultants")
    .select("data")
    .eq("id", sessione.consultantId)
    .limit(1);
  const d = ((righe ?? []) as { data?: { nome?: string; attivo?: boolean } }[])[0]?.data ?? {};
  if (d.attivo === false) return { ok: false, motivo: "Accesso disattivato dall'amministratore." };

  const nome = String(d.nome ?? "").trim();
  //  Coi mestieri: è questa la risposta che il browser rilegge ogni minuto, ed
  //  è il motivo per cui accendere una spunta nella scheda apre il menu alla
  //  persona senza farla uscire e rientrare.
  const accesso = risolviAccesso(pin.permissions, d);
  return {
    ok: true,
    consulente: { id: sessione.consultantId, nome, iniziali: inizialiDi(nome) },
    ruolo: accesso.ruolo,
    //  Sempre almeno `lead.propri`: un elenco vuoto non esce da qui, ed è il
    //  motivo per cui il browser può trattare "vuoto" come "risposta sbagliata"
    //  invece che come "niente di niente".
    concessi: accesso.elenco,
    permessi: accesso.legacy,
  };
}

export const Route = createFileRoute("/api/crm/accesso")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      //  ── L'ELENCO CHE SI VEDE NELLA SCHERMATA DI ACCESSO ─────────────────
      //  Solo nome e iniziali: chi non ha un PIN attivo non compare, e il PIN
      //  di chi compare non esce da qui in nessuna forma.
      //  Con `?token=` la domanda è un'altra — «io che sto già dentro, adesso
      //  che cosa posso?» — e si risponde con il livello riletto dal database.
      GET: async ({ request }) => {
        const token = tokenPulito(new URL(request.url).searchParams.get("token"));
        if (token) return json(await livelloDiSessione(token));

        const { data: pins } = await supabaseAdmin
          .from("consultant_pins")
          .select("consultant_id")
          .eq("active", true);
        const ids = [...new Set((pins ?? []).map((p) => p.consultant_id))];
        if (!ids.length) return json({ ok: true, consulenti: [] });

        const { data: righe } = await supabaseAdmin
          .from("crm_consultants")
          .select("id,data")
          .in("id", ids);

        const consulenti = ((righe ?? []) as { id: string; data: unknown }[])
          .map((r) => {
            const d = (r.data ?? {}) as { nome?: string; attivo?: boolean };
            return { id: r.id, nome: String(d.nome ?? "").trim(), attivo: d.attivo !== false };
          })
          //  Un consulente disattivato resta in archivio per lo storico, ma non
          //  deve comparire fra i nomi su cui si può bussare.
          .filter((c) => c.attivo && c.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome, "it"))
          .map((c) => ({ id: c.id, nome: c.nome, iniziali: inizialiDi(c.nome) }));

        return json({ ok: true, consulenti });
      },

      POST: async ({ request }) => {
        let b: { consultantId?: string; pin?: string } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          /* corpo illeggibile = credenziali mancanti */
        }
        const id = String(b.consultantId ?? "").trim();
        const pin = String(b.pin ?? "").trim();
        if (!id) return json({ ok: false, motivo: "Scegli prima il consulente." });
        if (!/^\d{4,8}$/.test(pin)) return json({ ok: false, motivo: "Il PIN ha da 4 a 8 cifre." });

        const ip = ipDi(request);
        const chiavi = [PREFISSO_TENTATIVI + id, ...(ip ? [`${PREFISSO_TENTATIVI}ip:${ip}`] : [])];
        const stato = await leggiTentativi(chiavi);
        const attesa = Math.max(...chiavi.map((k) => attesaDi(stato.get(k))), 0);
        if (attesa > 0) {
          return json({
            ok: false,
            motivo: `Troppi tentativi. Riprova fra ${minuti(attesa)}.`,
            attesaSec: attesa,
          });
        }

        //  Il confronto è per consulente E PIN insieme: cercare il solo PIN
        //  aprirebbe la porta del collega a chi ne indovina uno qualsiasi.
        //  consultant_pins conserva il codice in chiaro, quindi basta l'uguale.
        const { data: pins } = await supabaseAdmin
          .from("consultant_pins")
          .select("consultant_id, admin_user_id, permissions")
          .eq("consultant_id", id)
          .eq("pin", pin)
          .eq("active", true)
          .limit(1);
        const riga = pins?.[0];

        if (!riga) {
          const dopo = await Promise.all(chiavi.map((k) => registraErrore(k, stato.get(k))));
          const bloccato = Math.max(...dopo.map((t) => attesaDi(t)), 0);
          if (bloccato > 0) {
            return json({
              ok: false,
              motivo: `Troppi tentativi. Riprova fra ${minuti(bloccato)}.`,
              attesaSec: bloccato,
            });
          }
          //  Vale il contatore messo peggio: se l'indirizzo è già a quattro
          //  errori, dire "ne restano quattro" perché quel consulente è al primo
          //  sarebbe una promessa che il blocco successivo smentisce subito.
          const rimasti = Math.max(Math.min(...dopo.map((t) => SOGLIA - t.n)), 0);
          return json({
            ok: false,
            motivo: `PIN errato. ${rimasti === 1 ? "Resta 1 tentativo" : `Restano ${rimasti} tentativi`} prima del blocco.`,
            rimasti,
          });
        }

        const { data: righe } = await supabaseAdmin
          .from("crm_consultants")
          .select("id, data")
          .eq("id", id)
          .eq("user_id", riga.admin_user_id)
          .limit(1);
        const consulente = righe?.[0];
        if (!consulente) return json({ ok: false, motivo: "PIN errato." });

        const d = (consulente.data ?? {}) as { nome?: string; attivo?: boolean };
        if (d.attivo === false)
          return json({ ok: false, motivo: "Accesso disattivato dall'amministratore." });

        //  ── DA PIN A SESSIONE VERA ────────────────────────────────────────
        //  L'utente proprietario dei dati è quello indicato dal consulente: il
        //  magic-link si genera per lui, e sarà la sua sessione a far passare le
        //  regole di riga. CRM_ADMIN_EMAIL resta come rete di sicurezza per le
        //  installazioni in cui l'utente non ha email in anagrafica.
        const { data: proprietario } = await supabaseAdmin.auth.admin.getUserById(
          riga.admin_user_id,
        );
        const email = proprietario?.user?.email || process.env.CRM_ADMIN_EMAIL || "";
        if (!email) {
          return json({
            ok: false,
            motivo:
              "Accesso non configurato: l'account proprietario del CRM non ha un indirizzo email.",
          });
        }

        const { data: link, error: erroreLink } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
        });
        const tokenHash = link?.properties?.hashed_token;
        if (erroreLink || !tokenHash) {
          return json({ ok: false, motivo: "Accesso non riuscito, riprovare fra poco." }, 500);
        }

        //  Oltre alla sessione Supabase si apre anche quella del consulente: è
        //  il token che l'area mobile e le rotte /api/consulente/* già usano per
        //  sapere di chi sono i lead, e averlo qui evita di far digitare il PIN
        //  una seconda volta al cambio di schermata.
        const token = nuovoToken();
        await supabaseAdmin.from("app_config").upsert(
          {
            key: PREFISSO_SESSIONE + token,
            value: JSON.stringify({
              consultantId: consulente.id,
              adminUserId: riga.admin_user_id,
              //  L'ultimo lavoro si sposta avanti mentre si lavora; la nascita
              //  no: è quella che fa scadere la sessione dopo sette giorni
              //  comunque vada (vedi crm/sessione-pin).
              at: new Date().toISOString(),
              creataIl: new Date().toISOString(),
            }),
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "key" },
        );

        await azzeraTentativi(chiavi);

        const nome = String(d.nome ?? "").trim();
        //  I permessi si consegnano già risolti: il browser non deve rifare il
        //  ragionamento (mestieri + deroghe) né conoscerne le regole. Sono qui
        //  per NASCONDERE ciò che non serve — chi comanda davvero è la guardia
        //  qui sopra, a ogni chiamata.
        //  `d` sono i dati del consulente che questa rotta ha già letto: dentro
        //  ci sono i mestieri, e senza di essi la persona entrerebbe con meno
        //  di quello che le spetta finché il primo riallineamento non arriva.
        const accesso = risolviAccesso(riga.permissions, d);
        return json({
          ok: true,
          tokenHash,
          token,
          consulente: { id: consulente.id, nome, iniziali: inizialiDi(nome) },
          ruolo: accesso.ruolo,
          concessi: accesso.elenco,
          permessi: accesso.legacy,
        });
      },

      DELETE: async ({ request }) => {
        const token = tokenPulito(new URL(request.url).searchParams.get("token"));
        if (token)
          await supabaseAdmin
            .from("app_config")
            .delete()
            .eq("key", PREFISSO_SESSIONE + token);
        return json({ ok: true });
      },
    },
  },
});
