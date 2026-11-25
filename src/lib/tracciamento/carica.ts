/* eslint-disable @typescript-eslint/no-explicit-any -- le porte (documento e finestra) sono finte nelle prove e vere nel browser: qui si toccano solo i pochi nomi elencati sotto */
/*  ── IL CARICATORE DEGLI SCRIPT DI META, TIKTOK E GOOGLE ────────────────────────
    Shop R1 · T26 · PIANO D10, D12, D13, D14, §3.4. Inserisce SOLTANTO gli script che il consenso permette, mai
    due volte lo stesso; li prepara con le impostazioni che evitano dati non voluti; li spegne quando si va in
    una pagina non ammessa; e alla revoca ripulisce i cookie.

    ⚠️ Nessuno script prima della scelta. «Non scelto» e «solo necessari» non inseriscono niente.
    ⚠️ Un pixel già caricato non si scarica: per questo `sospendi()` lo mette a tacere e la navigazione verso
       una pagina non ammessa RICARICA la pagina (senza script, perché la pagina non è ammessa); la revoca
       ricarica anch'essa. La ricarica non perde il modulo di consulenza: `BookingFunnel` lo persiste.
    ⚠️ I pixel, da soli, seguono i cambi di pagina delle app a pagina singola (`pushState`, `popstate`) e mandano il
       PageView con l'indirizzo COMPLETO, saltando il nostro filtro. Tre difese: (1) Meta si ferma con
       `fbq.disablePushState = true`; (2) `pushState`/`replaceState` sono sorvegliati: verso una pagina non ammessa, con
       script caricati, si spegne tutto e si naviga con una pagina nuova SENZA che l'indirizzo cambi sotto i pixel;
       (3) un ascoltatore di `popstate` (indietro/avanti), in fase di cattura e registrato PRIMA di caricare qualunque
       script (quindi prima di quelli dei pixel), sospende e ricarica se la nuova pagina non è ammessa.
    ⚠️ TikTok: non risulta (non ho potuto verificarlo) un'opzione documentata per fermare il suo tracciamento automatico
       della cronologia, e `disableCookie` non ferma gli invii. Quindi il pixel di TikTok NEL BROWSER resta spento
       (`tiktokNelBrowser`, falso se non detto): gli eventi arrivano a TikTok dal server (Events API, `mittente.ts`),
       con l'indirizzo ricostruito. Si riaccende con una riga quando c'è un'opzione verificata.
    ⚠️ Gli ID arrivano dalla configurazione pubblica ma finiscono in un indirizzo: si controlla la FORMA di ognuno
       e, se non torna, quella piattaforma non si carica (nessun codice dentro gli indirizzi). */
import { modoGoogle, puoCaricare, type Consenso } from "../consenso";
import { percorsoAmmesso, referrerPulito, urlPulito } from "./ammesse";

export type ConfigPubblica = {
  meta: { pixelId: string } | null;
  tiktok: { pixelId: string } | null;
  google: { ga4Id: string | null; adsId: string | null; adsLabelAcquisto: string | null } | null;
};

export type PorteCarica = {
  documento: { cookie: string; referrer?: string; createElement(tag: string): any; querySelector?(selettore: string): any; head: { appendChild(n: any): unknown } };
  finestra: {
    location: { hostname: string; pathname: string; search: string; origin?: string; reload(): void; assign?(url: string): void };
    localStorage?: { removeItem(k: string): void };
    history?: { pushState: (...a: any[]) => void; replaceState: (...a: any[]) => void };
    addEventListener?: (tipo: string, f: () => void, cattura?: boolean) => void;
    [chiave: string]: any;
  };
  /** Un amministratore già riconosciuto non si traccia (come `isAdminLogged`). */
  admin?: () => boolean;
  /** La pagina è dentro un iframe (l'anteprima del CMS)? */
  inCornice?: () => boolean;
  /** Carica il pixel di TikTok nel browser? Spento di default: vedi sopra (nessuna opzione verificata contro l'auto-tracciamento della cronologia). */
  tiktokNelBrowser?: boolean;
};

export type Caricatore = {
  applicaConsenso(c: Consenso | null | undefined, config: ConfigPubblica | null | undefined): void;
  sospendi(): void;
  revoca(): void;
  sospeso(): boolean;
  caricati(): { meta: boolean; tiktok: boolean; google: boolean };
  /** Gli script possono parlare adesso? (non sospeso, non admin, non in cornice, pagina ammessa) */
  puoAgire(): boolean;
  /** Dice a Google l'indirizzo PULITO di questa pagina e il referrer ridotto all'origine (`set`), se sono cambiati: vale per ogni evento che segue. */
  sincronizzaIndirizzo(): void;
};

const ID_META = /^\d{5,20}$/;
const ID_TIKTOK = /^[A-Z0-9]{10,30}$/;
const ID_GA4 = /^G-[A-Z0-9]{4,20}$/;
const ID_ADS = /^AW-\d{5,15}$/;
const valido = (re: RegExp, v: unknown): v is string => typeof v === "string" && re.test(v);

const TUTTO_NEGATO = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const SCRIPT_META = "https://connect.facebook.net/en_US/fbevents.js";
const SCRIPT_TIKTOK = "https://analytics.tiktok.com/i18n/pixel/events.js";
const METODI_TIKTOK = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];

/** I cookie noti delle piattaforme (D12) e quello nostro. I `_ga_<ID>` e i `_gcl_*` si trovano dal nome. */
const COOKIE_NOTI = ["_fbp", "_fbc", "_ga", "_gid", "_ttp", "_gcl_au", "_gcl_aw", "_gcl_dc", "lp_external_id"];

/** Dove può stare un cookie: sull'host, su `host`, su `.host` e su ogni dominio padre (almeno due parti). `undefined` = senza `domain`. */
function dominiPossibili(host: string): (string | undefined)[] {
  const h = String(host || "").toLowerCase();
  if (!h || !h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":")) return [undefined];
  const parti = h.split(".");
  const padri = parti.map((_, i) => parti.slice(i)).filter((p) => p.length >= 2).map((p) => `.${p.join(".")}`);
  return [...new Set<string | undefined>([undefined, h, `.${h}`, ...padri])];
}

export function creaCaricatore(porte: PorteCarica): Caricatore {
  const { documento, finestra } = porte;
  const stato = { meta: false, tiktok: false, google: false };
  let sospeso = false;
  let modoGoogleUsato = "";
  let googleMarketing = false;
  let ultimoIndirizzo = "";
  const idGoogle: string[] = [];

  const aggiungiScript = (src: string) => {
    const s = documento.createElement("script");
    s.async = true;
    s.src = src;
    documento.head.appendChild(s);
  };
  const paginaAmmessa = () => percorsoAmmesso(finestra.location.pathname, finestra.location.search, !!porte.inCornice?.());
  const puoAgire = () => !sospeso && !porte.admin?.() && paginaAmmessa();

  function caricaMeta(id: string) {
    const f = finestra;
    if (!f.fbq) {
      // il codice di avvio di Meta: mette in coda le chiamate finché lo script non arriva
      const n: any = function () {
        // eslint-disable-next-line prefer-rest-params
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      f.fbq = n;
      if (!f._fbq) f._fbq = n;
    }
    f.fbq.disablePushState = true; // Meta non segue `pushState` da solo: i PageView li emette il provider, con l'indirizzo pulito
    f.fbq("set", "autoConfig", false, id); // prima di `init`: niente abbinamento automatico dai campi dei moduli
    f.fbq("init", id); // senza dati utente: l'abbinamento avanzato lo fa il server con l'hash
    aggiungiScript(SCRIPT_META); // il PageView non parte da qui: lo emette il provider (D19)
    stato.meta = true;
  }

  function caricaTikTok(id: string) {
    const f = finestra;
    f.TiktokAnalyticsObject = "ttq";
    const t: any = (f.ttq = f.ttq || []);
    for (const m of METODI_TIKTOK) t[m] = (...a: unknown[]) => t.push([m, ...a]);
    t._i = t._i || {};
    t._i[id] = [];
    t._t = t._t || {};
    t._t[id] = Date.now();
    aggiungiScript(`${SCRIPT_TIKTOK}?sdkid=${id}&lib=ttq`); // niente `page()` automatico: lo emette il provider
    stato.tiktok = true;
  }

  function caricaGoogle(g: NonNullable<ConfigPubblica["google"]>, c: Consenso) {
    const f = finestra;
    const ga4 = valido(ID_GA4, g.ga4Id) ? g.ga4Id : null;
    const ads = valido(ID_ADS, g.adsId) ? g.adsId : null;
    const principale = ga4 ?? ads;
    if (!principale) return;
    f.dataLayer = f.dataLayer || [];
    if (!f.gtag) {
      f.gtag = function () {
        // eslint-disable-next-line prefer-rest-params
        f.dataLayer.push(arguments); // Google vuole gli `arguments`, non un array
      };
    }
    f.gtag("consent", "default", { ...TUTTO_NEGATO }); // PRIMA dello script: tutto negato
    aggiungiScript(`https://www.googletagmanager.com/gtag/js?id=${principale}`);
    stato.google = true;
    idGoogle.push(...[ga4, ads].filter((x): x is string => !!x));
    impostaGoogle(c, ga4, ads, true);
  }

  /** `update` del consenso e, quando cambia il marketing, le impostazioni di GA4 e di Ads. */
  function impostaGoogle(c: Consenso, ga4: string | null, ads: string | null, primaVolta: boolean) {
    const modo = modoGoogle(c);
    const chiave = JSON.stringify(modo);
    if (!primaVolta && chiave === modoGoogleUsato) return;
    modoGoogleUsato = chiave;
    finestra.gtag("consent", "update", modo);
    const m = c.marketing === true;
    if (!primaVolta && m === googleMarketing) return;
    googleMarketing = m;
    if (primaVolta) {
      sincronizzaIndirizzo(); // prima di ogni `config` e di ogni evento: tutti portano l'indirizzo pulito
      finestra.gtag("js", new Date());
    }
    if (ga4) finestra.gtag("config", ga4, { send_page_view: false, allow_google_signals: m, allow_ad_personalization_signals: m });
    if (!m) finestra.gtag("set", "ads_data_redaction", true);
    else {
      if (!primaVolta) finestra.gtag("set", "ads_data_redaction", false);
      if (ads) finestra.gtag("config", ads);
    }
  }

  function origineSito(): string {
    return finestra.location.origin || `https://${finestra.location.hostname}`;
  }

  function sincronizzaIndirizzo() {
    if (!stato.google || sospeso) return;
    const origine = origineSito();
    const pulito = urlPulito(origine, finestra.location.pathname, finestra.location.search);
    if (!pulito || pulito === ultimoIndirizzo) return;
    // il primo referrer è quello vero (ridotto all'origine); poi, in navigazione interna, la pagina di prima era sul sito
    const referrer = ultimoIndirizzo ? origine : referrerPulito(documento.referrer, origine);
    ultimoIndirizzo = pulito;
    finestra.gtag("set", { page_location: pulito, page_referrer: referrer });
  }

  function sospendi() {
    sospeso = true;
    try {
      if (stato.google) {
        finestra.gtag("consent", "update", { ...TUTTO_NEGATO });
        for (const id of idGoogle) finestra[`ga-disable-${id}`] = true;
      }
      if (stato.meta) finestra.fbq("consent", "revoke");
      if (stato.tiktok) finestra.ttq.disableCookie();
    } catch {
      /* uno script che non risponde non ferma gli altri */
    }
  }

  function ricarica() {
    try {
      finestra.location.reload();
    } catch {
      /* niente da fare */
    }
  }

  /** Su una pagina non ammessa il referrer completo non deve uscire verso altri siti (è una pagina con codici
   *  nell'indirizzo): un `<meta name="referrer" content="strict-origin">` messo e tolto secondo la pagina (esce solo
   *  l'origine, mai il percorso; con `no-referrer` YouTube rifiuta i lettori, errore 153). Non c'è bisogno
   *  di consenso né di script: il provider lo richiama a ogni cambio di rotta (dentro `applicaConsenso`). */
  function proteggiReferrer() {
    try {
      let meta = documento.querySelector?.("#hgl-referrer");
      if (!paginaAmmessa()) {
        if (!meta) {
          meta = documento.createElement("meta");
          meta.id = "hgl-referrer";
          meta.name = "referrer";
          documento.head.appendChild(meta);
        }
        meta.content = "strict-origin";
      } else if (meta) {
        meta.remove?.();
      }
    } catch {
      /* il documento non lo permette: niente */
    }
  }

  /** Guardia del router: `pushState` e `replaceState` verso una pagina non ammessa, con script caricati, → si spegne tutto e
   *  si naviga con una pagina nuova (senza script) PRIMA che l'indirizzo cambi sotto i pixel. */
  function installaGuardia() {
    const h = finestra.history;
    if (!h) return;
    for (const metodo of ["pushState", "replaceState"] as const) {
      const originale = h[metodo];
      if (typeof originale !== "function") continue;
      h[metodo] = function (this: unknown, ...a: any[]) {
        const url = a[2];
        if (url != null && (stato.meta || stato.tiktok || stato.google)) {
          let dest: URL | null = null;
          try {
            dest = new URL(String(url), `${origineSito()}${finestra.location.pathname}${finestra.location.search}`);
          } catch {
            dest = null;
          }
          if (dest && dest.origin === origineSito() && !percorsoAmmesso(dest.pathname, dest.search, !!porte.inCornice?.())) {
            sospendi();
            try {
              finestra.location.assign?.(dest.href);
            } catch {
              /* niente da fare: gli script sono già a tacere */
            }
            return;
          }
        }
        return originale.apply(this, a);
      };
    }
  }
  installaGuardia();

  /** Indietro/avanti: l'indirizzo è GIÀ cambiato quando arriva `popstate`, quindi si ascolta in fase di cattura e prima
   *  di qualunque script dei pixel (registrato qui, alla creazione): se la nuova pagina non è ammessa, si spegne tutto e si ricarica. */
  function ascoltaPopstate() {
    try {
      finestra.addEventListener?.(
        "popstate",
        () => {
          if (!(stato.meta || stato.tiktok || stato.google) || porte.admin?.()) return;
          if (!paginaAmmessa()) {
            sospendi();
            ricarica();
          }
        },
        true,
      );
    } catch {
      /* ambiente senza eventi */
    }
  }
  ascoltaPopstate();

  return {
    applicaConsenso(c, config) {
      proteggiReferrer(); // a ogni cambio di rotta, anche senza consenso e senza script
      if (sospeso || !c || !config || porte.admin?.()) return;
      if (!paginaAmmessa()) {
        // in navigazione interna verso una pagina non ammessa con gli script già dentro: si spegne e si ricarica
        if (stato.meta || stato.tiktok || stato.google) {
          sospendi();
          ricarica();
        }
        return;
      }
      if (!stato.meta && puoCaricare("meta", c) && valido(ID_META, config.meta?.pixelId)) caricaMeta(config.meta!.pixelId);
      if (porte.tiktokNelBrowser && !stato.tiktok && puoCaricare("tiktok", c) && valido(ID_TIKTOK, config.tiktok?.pixelId)) caricaTikTok(config.tiktok!.pixelId);
      if (puoCaricare("google", c) && config.google) {
        if (!stato.google) caricaGoogle(config.google, c);
        else
          impostaGoogle(
            c,
            valido(ID_GA4, config.google.ga4Id) ? config.google.ga4Id : null,
            valido(ID_ADS, config.google.adsId) ? config.google.adsId : null,
            false,
          );
      }
      sincronizzaIndirizzo();
    },

    sospendi,

    revoca() {
      sospendi(); // prima di tutto: gli script già dentro smettono di mandare, poi si ripulisce e si ricarica
      const nomi = new Set(COOKIE_NOTI);
      try {
        for (const parte of String(documento.cookie || "").split(";")) {
          const nome = parte.split("=")[0].trim();
          if (/^(_ga_|_gcl_|_gac_)/.test(nome)) nomi.add(nome); // anche i `_gac_<ID>` di Google Ads
        }
      } catch {
        /* cookie illeggibili: si cancellano comunque quelli noti */
      }
      const domini = dominiPossibili(finestra.location.hostname);
      for (const nome of nomi) {
        for (const d of domini) {
          try {
            documento.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/${d ? `; domain=${d}` : ""}`;
          } catch {
            /* cookie bloccati */
          }
        }
      }
      // l'identificativo del dispositivo e la storia dei contatti (30 giorni): ognuno per conto suo, uno bloccato non ferma l'altro
      for (const chiave of ["lp_external_id", "lp_touch_history"]) {
        try {
          finestra.localStorage?.removeItem(chiave);
        } catch {
          /* archivio bloccato */
        }
      }
      ricarica();
    },

    sospeso: () => sospeso,
    caricati: () => ({ ...stato }),
    puoAgire,
    sincronizzaIndirizzo,
  };
}
