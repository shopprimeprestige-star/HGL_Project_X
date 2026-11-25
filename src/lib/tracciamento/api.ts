/* eslint-disable @typescript-eslint/no-explicit-any -- la finestra è quella vera nel browser e una finta nelle prove */
/*  ── L'API DEL BROWSER PER GLI EVENTI ───────────────────────────────────────────
    Shop R1 · T26 · PIANO §3.4, D13, D14, D16, D18. Le pagine chiamano solo questo:

      emettiEvento("AddToCart", {…})  → l'`event_id` usato, oppure `null` e NIENTE (consenso mancante, pagina non
                                          ammessa, amministratore, script sospesi, nome non ammesso, dati vuoti);
      emettiSoloContatore(nome, {…})  → solo il conteggio interno (`lp_events`), nessuna piattaforma.

    Lo STESSO `event_id` va a Meta (`eventID`), TikTok (`event_id`) e al server (`/api/public/evento`): così
    le piattaforme tolgono i doppioni. Il server riceve solo `percorso` e le sole chiavi di query ammesse (D14): l'indirizzo
    lo ricostruisce lui (D16). Google riceve, su OGNI evento, l'indirizzo ripulito e il referrer ridotto all'origine (`gtag('set', …)` del caricatore).
    ⚠️ Il server si chiama SOLO con il consenso marketing e solo per i nomi che il mittente accetta (`nomeAmmesso`):
       `Lead` accende i pixel del browser ma non passa di lì (resta su `capi`).
    ⚠️ Sul server (senza `window`) e senza consenso questo modulo non fa niente. */
import { puoCaricare, leggiConsenso, type Consenso } from "../consenso";
import { queryPulita } from "./ammesse";
import { creaCaricatore, type Caricatore, type PorteCarica } from "./carica";
import { costruisciEvento, type DatiEvento } from "./eventi";
import { nomeAmmesso, type NomeEvento } from "./nomi";

export type PorteApi = {
  finestra: { location: PorteCarica["finestra"]["location"] & { origin: string }; [chiave: string]: any };
  fetch: (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
  adesso: () => number;
  caricatore: Caricatore;
  consenso: () => Consenso;
  /** Scrive un conteggio interno in `lp_events`. */
  contatore: (nome: string, payload: Record<string, string | number | boolean>) => void;
};

/** I nomi che Meta conosce come standard; gli altri vanno come «custom». */
const STANDARD_META = ["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Contact", "Subscribe", "Lead"];
/** Il permesso dura 10 minuti: lo si rinnova un minuto prima. */
const TENUTA_PERMESSO_MS = 9 * 60 * 1000;

export function creaApi(porte: PorteApi) {
  const { finestra } = porte;
  const pendenti = new Set<Promise<unknown>>();
  let permesso: { finoA: number; p: Promise<string | null> } | null = null;

  /** Il permesso, tenuto in memoria e rinnovato; `null` se il server non lo dà. */
  function prendiPermesso(): Promise<string | null> {
    const ora = porte.adesso();
    if (permesso && ora < permesso.finoA) return permesso.p;
    const p = (async () => {
      const r = await porte.fetch("/api/public/evento-permesso", { method: "GET", cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      return typeof j?.permesso === "string" ? j.permesso : null;
    })().catch(() => null);
    const mio = { finoA: ora + TENUTA_PERMESSO_MS, p };
    permesso = mio;
    void p.then((t) => {
      if (!t && permesso === mio) permesso = null;
    });
    return p;
  }

  async function inviaAlServer(nome: string, eventId: string, dati: DatiEvento | undefined) {
    const token = await prendiPermesso();
    if (!token) return;
    const r = await porte.fetch("/api/public/evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        nome,
        eventId,
        permesso: token,
        percorso: finestra.location.pathname,
        query: queryPulita(finestra.location.search),
        dati: dati ?? {},
        consenso: true, // un'attestazione: il browser non arriva qui senza consenso, ma il server non può verificarlo (D16)
      }),
    });
    // shortcut: un permesso scaduto (401) non si riprova su questo evento, si butta e basta; si cambia se i 401 diventano frequenti.
    if (r.status === 401) permesso = null;
  }

  function emettiEvento(nome: NomeEvento, dati?: DatiEvento): string | null {
    try {
      if (!porte.caricatore.puoAgire()) return null;
      const c = porte.consenso();
      if (!c.scelto) return null;
      const st = porte.caricatore.caricati();
      const aMeta = st.meta && puoCaricare("meta", c);
      const aTikTok = st.tiktok && puoCaricare("tiktok", c);
      const aGoogle = st.google && puoCaricare("google", c);
      const alServer = puoCaricare("meta", c) && nomeAmmesso(nome);
      if (!aMeta && !aTikTok && !aGoogle && !alServer) return null;
      const ev = costruisciEvento(nome, dati);
      if (!ev) return null;
      const id = ev.meta!.eventId;
      const prova = (f: () => void) => {
        try {
          f();
        } catch {
          /* uno script che non risponde non ferma gli altri */
        }
      };
      if (aMeta) prova(() => finestra.fbq(STANDARD_META.includes(ev.meta!.nome) ? "track" : "trackCustom", ev.meta!.nome, ev.meta!.parametri, { eventID: id }));
      if (aTikTok && ev.tiktok) {
        // shortcut: il PageView di TikTok parte con `page()`, che non porta un event_id (niente deduplica per quello solo), si cambia se TikTok lo permette.
        prova(() => (nome === "PageView" ? finestra.ttq.page() : finestra.ttq.track(ev.tiktok!.nome, ev.tiktok!.parametri, { event_id: id })));
      }
      if (aGoogle) {
        // ogni evento di Google porta l'indirizzo pulito: lo ha impostato il caricatore con `gtag('set', …)` e lo aggiorna qui a ogni navigazione
        prova(() => {
          porte.caricatore.sincronizzaIndirizzo();
          finestra.gtag("event", ev.ga4.nome, ev.ga4.parametri);
        });
      }
      if (alServer) {
        const invio = inviaAlServer(nome, id, dati).catch(() => {});
        pendenti.add(invio);
        void invio.then(() => pendenti.delete(invio));
      }
      return id;
    } catch {
      return null;
    }
  }

  function emettiSoloContatore(nome: string, payload?: Record<string, unknown>): void {
    if (typeof nome !== "string" || !nome.trim()) return;
    const pulito: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(payload ?? {})) {
      if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean" || (typeof v === "string" && v.length <= 100)) pulito[k] = v;
    }
    try {
      porte.contatore(nome, pulito);
    } catch {
      /* un conteggio perso non rompe la pagina */
    }
  }

  return { emettiEvento, emettiSoloContatore, /** per le prove: aspetta gli invii al server in corso */ scarica: async () => void (await Promise.allSettled([...pendenti])) };
}

/* ── il singleton del browser ─────────────────────────────────────────────── */

type Api = ReturnType<typeof creaApi>;
let caricatoreReale: Caricatore | null = null;
let istanza: Api | null = null;

/** Solo «0» (già verificato: non è un amministratore) lascia parlare; «1» o ancora sconosciuto = amministratore, come `isAdminLogged`. */
const adminNoto = () => {
  try {
    return window.sessionStorage.getItem("lp_admin_skip") !== "0";
  } catch {
    return true;
  }
};

/** Il caricatore degli script di questa pagina (uno solo: lo condividono il provider e l'API). `null` sul server. */
export function daiCaricatore(): Caricatore | null {
  if (typeof window === "undefined") return null;
  caricatoreReale ??= creaCaricatore({
    documento: document,
    finestra: window as any,
    admin: adminNoto,
    inCornice: () => window.self !== window.top,
  });
  return caricatoreReale;
}

function api(): Api | null {
  const caricatore = daiCaricatore();
  if (!caricatore) return null;
  istanza ??= creaApi({
    finestra: window as any,
    fetch: (u, i) => window.fetch(u, i),
    adesso: () => Date.now(),
    caricatore,
    consenso: () => leggiConsenso(window.localStorage),
    // import dinamico: il modulo di tracciamento porta con sé il client del database, che qui non deve pesare
    contatore: (nome, payload) => void import("@/landing/booking/tracking").then((m) => m.trackEvent(nome, null, payload)),
  });
  return istanza;
}

export function emettiEvento(nome: NomeEvento, dati?: DatiEvento): string | null {
  return api()?.emettiEvento(nome, dati) ?? null;
}

export function emettiSoloContatore(nome: string, payload?: Record<string, unknown>): void {
  api()?.emettiSoloContatore(nome, payload);
}

/** Aspetta gli invii al server in corso (la cassa lo chiede prima di portare il cliente a Stripe: la navigazione li ucciderebbe). Sul server, o senza invii, risolve subito. */
export const scaricaEventi = () => api()?.scarica() ?? Promise.resolve();
