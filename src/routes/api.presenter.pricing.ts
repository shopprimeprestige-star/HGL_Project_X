/** Listino del preventivo, scritto dall'hub Impostazioni di Meetly.
 *  GET                 -> { pricing: { prices, was, disabled } }
 *  POST { pricing }    -> salva e RILEGGE, restituendo ciò che è finito nel database
 *  app_config.key = 'quote_pricing' — la stessa riga che legge il configuratore
 *  (api.public.pricing) e quindi il cliente.
 *
 *  ── PERCHÉ PASSA DAL SERVER ───────────────────────────────────────────────
 *  Il presentatore non ha una sessione Supabase: dal browser la scrittura su
 *  `app_config` verrebbe rifiutata dalle regole di riga senza dire granché.
 *  Qui si usa il service role, ma solo dopo la `guardia`: cambiare il listino è
 *  cambiare la cifra che un cliente pagante vede a schermo.
 *
 *  ── SI RILEGGE PRIMA DI RISPONDERE ────────────────────────────────────────
 *  La risposta non è "non ho ricevuto errori": è il contenuto vero della riga
 *  dopo la scrittura. Il pannello lo confronta con quello che voleva salvare, e
 *  solo se combacia scrive "salvato".
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardiaP, sessioneDaRichiesta } from "./api.presenter.consultant";
/*  ── ⚠️ OGNI CONSULENTE HA IL SUO LISTINO ─────────────────────────────────
    Richiesta del committente: «fai che tutte le modifiche del listino che
    faccio io come consulente si salvano al consulente, e gli altri consulenti
    hanno le loro modifiche».
    Qui c'era UNA riga per tutti: due consulenti che ritoccavano i prezzi si
    sovrascrivevano a vicenda, e l'ultimo che salvava decideva le cifre che
    vedevano i clienti di entrambi. Le regole stanno in shop/ambito-listino. */
import { idAmbito } from "@/shop/ambito-listino";
import { grezzoListino, scriviListino } from "@/crm/listino-di-chi.server";
//  La virgola dei decimali si legge in un solo posto, quello dei coupon: due
//  letture diverse dello stesso "450,73" sono due importi diversi.
import { euroDaValore } from "./api.presenter.coupons";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

interface Listino {
  prices: Record<string, number>;
  was: Record<string, number>;
  disabled: Record<string, boolean>;
  /** Se gli sconti sulle personalizzazioni si presentano come sconti (prezzo
   *  barrato accanto alla voce) o se il prezzo scontato è semplicemente IL
   *  prezzo. Non cambia di un euro quello che il cliente paga.
   *  ⚠️ Acceso quando manca: le configurazioni salvate prima di questo
   *   interruttore devono comportarsi come hanno sempre fatto. */
  upsellSconti: boolean;
  /** Sezioni e parti fisse spente (vedi `spente` in shop/quote-menu). */
  spente: Record<string, boolean>;
  /** Quanto paga dopo, e per quanti mesi (vedi `manutenzione` in
   *  shop/quote-menu). Assente = i valori di casa. */
  manutenzione: { prezzo?: number; mesi?: number };
  /** Quanto si lascia oggi per aprire la pratica (vedi `acconto` in
   *  shop/quote-menu). Assente = quello di casa.
   *  ⚠️ Zero è un valore legittimo — «non si chiede acconto» — e va distinto
   *   dall'assenza del campo: per questo è facoltativo e non «0 di ripiego». */
  acconto?: number;
  /** L'acconto di una singola soluzione: `{ "patch-standard": 50 }`. Assente
   *  per una base = vale `acconto`. Vedi `accontoDi` in shop/quote-menu. */
  accontoPerBase?: Record<string, number>;
  /** Il modello della causale del bonifico (vedi shop/causale-bonifico).
   *  Vuoto = quella di casa. */
  causale: string;
  /** Cosa è già spuntato all'apertura del preventivo (vedi `preselezionate` in
   *  shop/quote-menu). ⚠️ Qui `false` NON è come "assente": vuol dire «togli
   *  la spunta anche se è di serie», e va scritto a database come gli altri. */
  preselezionate: Record<string, boolean>;
  /** Le stesse spunte, ma decise per singola soluzione base. Chiave esterna:
   *  l'id della soluzione (`patch-standard`, `invisible-derm`, `trapianto`). */
  preselezionatePerBase: Record<string, Record<string, boolean>>;
}

const VUOTO: Listino = {
  prices: {}, was: {}, disabled: {}, upsellSconti: true, spente: {},
  preselezionate: {}, preselezionatePerBase: {}, manutenzione: {}, accontoPerBase: {}, causale: "",
};

/** ── LA TABELLA CHE I TIPI GENERATI NON CONOSCONO ──────────────────────────
 *  `app_config` è nata dopo l'ultima generazione dei tipi Supabase
 *  (integrations/supabase/types.ts): senza un appiglio, un banale `.eq("key",…)`
 *  non compila. Qui la porta è UNA, dichiara solo le due operazioni che servono,
 *  e il giorno in cui i tipi verranno rigenerati si cancella questo blocco senza
 *  toccare una riga di query. */
type ErroreDb = { message: string } | null;
interface Config {
  select: (colonne: string) => {
    eq: (
      colonna: string,
      valore: string,
    ) => {
      maybeSingle: () => PromiseLike<{ data: { value?: string | null } | null; error: ErroreDb }>;
    };
  };
  upsert: (
    valori: Record<string, unknown>,
    opzioni: { onConflict: string },
  ) => PromiseLike<{ error: ErroreDb }>;
}
const config = (): Config =>
  (supabaseAdmin as unknown as { from: (t: string) => Config }).from("app_config");

/** Il listino di chi sta chiedendo: il suo, se ce l'ha, altrimenti quello di
 *  casa. Torna anche `suo`, perché il pannello deve poter dire a chiare
 *  lettere quale dei due si sta modificando. */
async function leggi(consulente: string): Promise<Listino & { suo: boolean }> {
  const { valore, suo } = await grezzoListino(consulente);
  try {
    const p = JSON.parse(valore ?? "{}") as Partial<Listino>;
    return {
      prices: p.prices ?? {},
      was: p.was ?? {},
      disabled: p.disabled ?? {},
      upsellSconti: p.upsellSconti !== false,
      spente: p.spente ?? {},
      preselezionate: p.preselezionate ?? {},
      preselezionatePerBase: p.preselezionatePerBase ?? {},
      manutenzione: p.manutenzione ?? {},
      //  Assente = quello di casa: i listini salvati prima di oggi non hanno
      //  questo campo e devono continuare a chiedere quello che chiedevano.
      ...(typeof p.acconto === "number" ? { acconto: p.acconto } : {}),
      //  ⚠️ Si tengono solo i numeri veri: una stringa o un `null` finito qui
      //   dentro farebbe ricadere quella soluzione sull'acconto generale senza
      //   dirlo, ed è il genere di cosa che si scopre dal cliente.
      accontoPerBase: Object.fromEntries(
        Object.entries(p.accontoPerBase ?? {}).filter(
          ([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0,
        ),
      ),
      causale: typeof p.causale === "string" ? p.causale : "",
      suo,
    };
  } catch {
    return { ...VUOTO, suo };
  }
}

/** Chi sta chiedendo. Vuoto = chiavi di casa (codice consulente generale o
 *  accesso del proprietario): quelli modificano la riga condivisa, cioè il
 *  listino di partenza di tutti quelli che non ne hanno ancora uno loro. */
async function chiSta(request: Request): Promise<string> {
  const s = await sessioneDaRichiesta(request);
  return s && s.via === "pin" ? idAmbito(s.id) : "";
}

/** Gli importi arrivano già in numero, ma possono arrivare anche come testo
 *  digitato ("450,73"): si leggono con la stessa funzione dei coupon. Un valore
 *  illeggibile NON diventa zero — zero nel preventivo si legge "GRATIS" — ma
 *  fa fallire tutta la scrittura, con scritto quale voce è. */
function ripulisci(v: unknown): { listino: Listino; guaste: string[] } {
  const dentro = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof Listino, unknown>>;
  const guaste: string[] = [];
  //  Spento solo se lo si chiede per esteso: un campo mancante, o arrivato
  //  storto, non deve poter spegnere i prezzi barrati di tutto il listino.
  const out: Listino = {
    prices: {},
    was: {},
    disabled: {},
    accontoPerBase: {},
    upsellSconti: (dentro as { upsellSconti?: unknown }).upsellSconti !== false,
    spente: {},
    manutenzione: {},
    preselezionate: {},
    preselezionatePerBase: {},
    //  ⚠️ Una causale di soli spazi non è una causale: si tratta come «non
    //   impostata», e vale quella di casa.
    causale: String((dentro as { causale?: unknown }).causale ?? "").trim().slice(0, 160),
  };

  Object.entries((dentro.prices ?? {}) as Record<string, unknown>).forEach(([id, val]) => {
    const n = euroDaValore(val);
    if (n == null) guaste.push(id);
    else out.prices[id] = n;
  });
  Object.entries((dentro.was ?? {}) as Record<string, unknown>).forEach(([id, val]) => {
    const n = euroDaValore(val);
    //  Il barrato è facoltativo: 0 vuol dire "nessun prezzo pieno" ed è un
    //  valore legittimo, non un errore.
    out.was[id] = n == null ? 0 : n;
  });
  Object.entries((dentro.disabled ?? {}) as Record<string, unknown>).forEach(([id, val]) => {
    if (val) out.disabled[id] = true;
  });
  //  Si scrive solo ciò che è SPENTO: un elenco di «acceso: true» crescerebbe
  //  a ogni pubblicazione di una sezione nuova, e nessuno saprebbe più quali
  //  righe contano.
  Object.entries((dentro.spente ?? {}) as Record<string, unknown>).forEach(([id, val]) => {
    if (val) out.spente[id] = true;
  });
  //  ⚠️ QUI SI SCRIVONO ANCHE I `false`, al contrario di `spente`. Un id
  //   assente vuol dire «come di serie», e di serie alcune voci sono spuntate:
  //   scartare i `false` renderebbe impossibile TOGLIERE una spunta di serie —
  //   la si toglieva dal pannello e tornava al salvataggio dopo. Si scartano
  //   solo i valori che non sono né vero né falso.
  Object.entries((dentro.preselezionate ?? {}) as Record<string, unknown>).forEach(([id, val]) => {
    if (val === true) out.preselezionate[id] = true;
    else if (val === false) out.preselezionate[id] = false;
  });
  //  Le stesse spunte, una mappa per soluzione base. Stessa regola: `false`
  //  vuol dire «togli», quindi si scrive; tutto il resto si scarta. Una
  //  soluzione rimasta senza scelte non lascia una mappa vuota in giro.
  Object.entries((dentro.preselezionatePerBase ?? {}) as Record<string, unknown>).forEach(
    ([base, mappa]) => {
      const dentroBase = (mappa && typeof mappa === "object" ? mappa : {}) as Record<string, unknown>;
      const pulita: Record<string, boolean> = {};
      Object.entries(dentroBase).forEach(([id, val]) => {
        if (val === true) pulita[id] = true;
        else if (val === false) pulita[id] = false;
      });
      if (Object.keys(pulita).length) out.preselezionatePerBase[base] = pulita;
    },
  );
  //  ── QUANTO PAGA DOPO ─────────────────────────────────────────────────
  //   Prezzo e mesi si leggono con lo stesso metro degli altri importi, la
  //   virgola dei decimali compresa. Un valore illeggibile non diventa zero —
  //   zero qui vorrebbe dire «l'assistenza è gratis», la promessa più cara che
  //   questo pannello possa fare per sbaglio — semplicemente non si scrive, e
  //   allora vale quello di casa.
  const man = (dentro.manutenzione ?? {}) as { prezzo?: unknown; mesi?: unknown };
  const prezzo = euroDaValore(man.prezzo);
  if (prezzo != null) out.manutenzione.prezzo = prezzo;
  const mesi = Number(man.mesi);
  if (Number.isFinite(mesi) && mesi > 0 && mesi <= 240) out.manutenzione.mesi = Math.round(mesi);
  //  ── L'ACCONTO ────────────────────────────────────────────────────────
  //   Stesso metro degli altri importi. Campo vuoto = non si scrive, e allora
  //   vale quello di casa; `0` invece si scrive, perché vuol dire «non si
  //   chiede acconto» ed è una decisione, non un campo lasciato in bianco.
  const acc = euroDaValore((dentro as { acconto?: unknown }).acconto);
  if (acc != null) out.acconto = acc;
  //  ── E L'ACCONTO DI UNA SINGOLA SOLUZIONE ─────────────────────────────
  //   Stesso metro: una cifra illeggibile NON diventa zero (zero vuol dire
  //   «non si chiede acconto» ed è una decisione), semplicemente non si
  //   scrive — e quella soluzione torna all'acconto generale.
  const perBase = (dentro as { accontoPerBase?: unknown }).accontoPerBase;
  out.accontoPerBase = {};
  if (perBase && typeof perBase === "object") {
    for (const [id, v] of Object.entries(perBase as Record<string, unknown>)) {
      const n = euroDaValore(v);
      if (n != null) out.accontoPerBase[String(id)] = n;
    }
  }
  return { listino: out, guaste };
}

export const Route = createFileRoute("/api/presenter/pricing")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      //  Lettura aperta come /api/public/pricing: sono gli stessi prezzi che il
      //  configuratore mostra al cliente, non c'è niente da proteggere.
      GET: async ({ request }) => json({ pricing: await leggi(await chiSta(request)) }),

      POST: async ({ request }) => {
        //  ── NON BASTA ESSERE ENTRATI ────────────────────────────────────
        //  Il listino è la cifra che un cliente pagante vede a schermo: un
        //  consulente lo APPLICA, non lo decide. Serve il permesso `listino`.
        const no = await guardiaP(request, cors, "listino");
        if (no) return no;
        const mio = await chiSta(request);
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          /* corpo illeggibile: sotto diventa "listino mancante" */
        }
        if (!body.pricing || typeof body.pricing !== "object")
          return json({ ok: false, reason: "listino mancante" }, 400);

        const { listino, guaste } = ripulisci(body.pricing);
        if (guaste.length)
          return json(
            { ok: false, reason: `valori non validi: ${guaste.slice(0, 5).join(", ")}` },
            400,
          );
        if (Object.keys(listino.prices).length === 0)
          return json({ ok: false, reason: "nessun prezzo da salvare" }, 400);

        //  ⚠️ Si scrive SEMPRE nella propria riga, anche quando si è letto da
        //   quella di casa: la prima volta il listino del consulente nasce come
        //   copia di quello che aveva davanti, e da lì in poi è suo — non
        //   segue più i ritocchi fatti al listino di casa, nemmeno sulle voci
        //   che non ha mai toccato. È il senso di «ognuno ha il suo».
        //   Tornare a scrivere sulla riga condivisa perché è da lì che si era
        //   letto vorrebbe dire cambiare i prezzi a tutti i colleghi.
        const error = await scriviListino(mio, JSON.stringify(listino));
        if (error) return json({ ok: false, reason: error.message }, 400);

        return json({ ok: true, pricing: await leggi(mio) });
      },
    },
  },
});
