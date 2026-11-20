/*  ── LE DECISIONI DEL PROVIDER, SENZA REACT ───────────────────────────────────────
    Shop R1 · T27 · PIANO D10, D12, D14, D15. Qui sta tutto ciò che si può sbagliare: dove il banner si vede, quando
    togliere un consenso vuol dire «revoca», in che ordine partono configurazione, controllo dell'amministratore, script e
    PageView. Il componente (`ProviderTracciamento.tsx`) lo collega alla pagina; le prove lo provano con un mondo finto.

    ⚠️ Nessuno script prima del sì, e nessuno senza aver saputo che non è un amministratore: nel browser l'amministratore
       vale «sì» finché `sessionStorage.lp_admin_skip` non è «0» (T26), quindi si aspetta `initAdminCheck()` e SOLO DOPO
       si richiama `applicaConsenso`.
    ⚠️ `applicaConsenso` si richiama a OGNI cambio di pagina, anche senza consenso e senza configurazione: dentro c'è il
       `<meta name="referrer">` che si mette e si toglie secondo la pagina (T26). */
import { puoCaricare, type Consenso } from "@/lib/consenso";
import { bannerAmmesso, percorsoAmmesso } from "@/lib/tracciamento/ammesse";
import type { Caricatore, ConfigPubblica } from "@/lib/tracciamento/carica";

/** L'evento con cui il link «Gestisci cookie» chiede al provider di riaprire la scelta. */
export const EVENTO_APRI_COOKIE = "hgl:cookie-apri";

/** Il banner si disegna? Solo dove le pagine sono ammesse, solo a chi NON è un amministratore (e quando lo si sa), solo a scelta
 *  da fare (o riaperta). `consenso` nullo = non ancora letta: niente lampo per chi ha già scelto. */
export function mostraBanner(p: {
  percorso: string;
  ricerca: string;
  inCornice: boolean;
  admin: boolean | null;
  consenso: Consenso | null;
  riaperto: boolean;
}): boolean {
  if (p.admin !== false || !p.consenso) return false;
  return bannerAmmesso(p.percorso, p.ricerca, p.inCornice, false) && (!p.consenso.scelto || p.riaperto);
}

/** Togliere un consenso (anche una categoria sola) vuol dire cancellare i cookie delle piattaforme e ricaricare. Dare un consenso, no. */
export function serveRevoca(prima: Consenso, dopo: Consenso): boolean {
  return (prima.statistiche && !dopo.statistiche) || (prima.marketing && !dopo.marketing);
}

/** `Referrer-Policy` delle pagine NON ammesse (ordine, CRM, preventivo, videochiamata, `?watch`…): il loro indirizzo porta codici e non deve
 *  uscire verso altri siti. ⚠️ `strict-origin` e NON `no-referrer`: del referrer resta solo l'origine del sito (mai percorso né query), ma YouTube
 *  la pretende dagli incorporamenti (senza, il lettore risponde «errore 153» e il video non parte: /web, /webinar, /slide, /presenta). Stessa regola di pixel e banner; la ricerca può essere un testo o l'oggetto della rotta (contano le chiavi). */
export function politicaReferrer(percorso: string, ricerca: string | Record<string, unknown>): Record<string, string> | undefined {
  const testo = typeof ricerca === "string" ? ricerca : new URLSearchParams(Object.keys(ricerca ?? {}).map((k) => [k, ""])).toString();
  return percorsoAmmesso(percorso, testo, false) ? undefined : { "Referrer-Policy": "strict-origin" };
}

export type PorteControllo = {
  caricatore: Caricatore;
  leggi: () => Consenso;
  pagina: () => { percorso: string; ricerca: string; inCornice: boolean };
  /** `initAdminCheck` vero: dopo la risposta `lp_admin_skip` è scritto. */
  admin: () => Promise<boolean>;
  /** La configurazione pubblica dei pixel (`null` se non c'è). */
  config: () => Promise<ConfigPubblica | null>;
  /** `emettiEvento("PageView")`: l'`event_id`, o `null` se non è partito. */
  pageView: () => string | null;
};

export function creaControllo(p: PorteControllo) {
  let admin: Promise<boolean> | null = null;
  let config: ConfigPubblica | null = null;
  let inCorso: Promise<ConfigPubblica | null> | null = null;
  let ultimaVista = "";
  let noto = p.leggi();

  /** È un amministratore? Si chiede una volta; se non si riesce a sapere vale «sì» (nel dubbio non si traccia). */
  const verificaAdmin = () => (admin ??= p.admin().catch(() => true));

  /** La configurazione si chiede una volta; se non arriva si riprova alla prossima pagina. */
  function prendiConfig(): Promise<ConfigPubblica | null> {
    if (config) return Promise.resolve(config);
    inCorso ??= p
      .config()
      .catch(() => null)
      .then((c) => {
        inCorso = null;
        config = c ?? null;
        return config;
      });
    return inCorso;
  }

  async function valuta(): Promise<void> {
    try {
      const consenso = p.leggi();
      // sempre, anche senza consenso e senza configurazione: toglie o mette il meta del referrer, e su una pagina non ammessa spegne gli script già dentro
      p.caricatore.applicaConsenso(consenso, config);
      const pg = p.pagina();
      if (!percorsoAmmesso(pg.percorso, pg.ricerca, pg.inCornice)) return;
      if (!(["meta", "tiktok", "google"] as const).some((x) => puoCaricare(x, consenso))) return; // senza il sì non si chiede niente a nessuno
      if (await verificaAdmin()) return;
      const cfg = await prendiConfig();
      if (!cfg) return;
      p.caricatore.applicaConsenso(p.leggi(), cfg); // dopo l'amministratore: da qui `lp_admin_skip` dice «0»
      const ora = p.pagina();
      const chiave = `${ora.percorso}${ora.ricerca}`;
      if (chiave !== ultimaVista && p.pageView() !== null) ultimaVista = chiave;
    } catch {
      /* un controllo che non riesce non rompe la pagina: gli script non partono */
    }
  }

  /** La scelta è cambiata (evento `hgl:consenso`): togliere un consenso revoca; darlo carica e rifà il PageView di questa pagina. */
  async function consensoCambiato(dopo: Consenso): Promise<void> {
    const prima = noto;
    noto = dopo;
    if (serveRevoca(prima, dopo)) {
      p.caricatore.revoca();
      return;
    }
    // shortcut: da «solo statistiche» a «marketing» Google riceve il PageView due volte per la stessa pagina; si cambia se GA4 lo conta male.
    ultimaVista = "";
    await valuta();
  }

  return { valuta, consensoCambiato, verificaAdmin };
}
