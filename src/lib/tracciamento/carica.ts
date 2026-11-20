/* eslint-disable @typescript-eslint/no-explicit-any -- le porte (documento e finestra) sono finte nelle prove e vere nel browser: qui si toccano solo i pochi nomi elencati sotto */
/*  ── IL CARICATORE DEGLI SCRIPT DI META, TIKTOK E GOOGLE ────────────────────────
    Shop R1 · T26 · PIANO D10, D12, D13, D14, §3.4. Inserisce SOLTANTO gli script che il consenso permette, mai
    due volte lo stesso; li prepara con le impostazioni che evitano dati non voluti; li spegne quando si va in
    una pagina non ammessa; e alla revoca ripulisce i cookie.

    ⚠️ Nessuno script prima della scelta. «Non scelto» e «solo necessari» non inseriscono niente.
    ⚠️ Un pixel già caricato non si scarica: per questo `sospendi()` lo mette a tacere e la navigazione verso
       una pagina non ammessa RICARICA la pagina (senza script, perché la pagina non è ammessa); la revoca
       ricarica anch'essa. La ricarica non perde il modulo di consulenza: `BookingFunnel` lo persiste.
    ⚠️ Gli ID arrivano dalla configurazione pubblica ma finiscono in un indirizzo: si controlla la FORMA di ognuno
       e, se non torna, quella piattaforma non si carica (nessun codice dentro gli indirizzi). */
import { modoGoogle, puoCaricare, type Consenso } from "../consenso";
import { percorsoAmmesso } from "./ammesse";

export type ConfigPubblica = {
  meta: { pixelId: string } | null;
  tiktok: { pixelId: string } | null;
  google: { ga4Id: string | null; adsId: string | null; adsLabelAcquisto: string | null } | null;
};

export type PorteCarica = {
  documento: { cookie: string; createElement(tag: string): any; head: { appendChild(n: any): unknown } };
  finestra: { location: { hostname: string; pathname: string; search: string; reload(): void }; localStorage?: { removeItem(k: string): void }; [chiave: string]: any };
  /** Un amministratore già riconosciuto non si traccia (come `isAdminLogged`). */
  admin?: () => boolean;
  /** La pagina è dentro un iframe (l'anteprima del CMS)? */
  inCornice?: () => boolean;
};

export type Caricatore = {
  applicaConsenso(c: Consenso | null | undefined, config: ConfigPubblica | null | undefined): void;
  sospendi(): void;
  revoca(): void;
  sospeso(): boolean;
  caricati(): { meta: boolean; tiktok: boolean; google: boolean };
  /** Gli script possono parlare adesso? (non sospeso, non admin, non in cornice, pagina ammessa) */
  puoAgire(): boolean;
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
    if (primaVolta) finestra.gtag("js", new Date());
    if (ga4) finestra.gtag("config", ga4, { send_page_view: false, allow_google_signals: m, allow_ad_personalization_signals: m });
    if (!m) finestra.gtag("set", "ads_data_redaction", true);
    else {
      if (!primaVolta) finestra.gtag("set", "ads_data_redaction", false);
      if (ads) finestra.gtag("config", ads);
    }
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

  return {
    applicaConsenso(c, config) {
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
      if (!stato.tiktok && puoCaricare("tiktok", c) && valido(ID_TIKTOK, config.tiktok?.pixelId)) caricaTikTok(config.tiktok!.pixelId);
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
    },

    sospendi,

    revoca() {
      sospeso = true;
      const nomi = new Set(COOKIE_NOTI);
      try {
        for (const parte of String(documento.cookie || "").split(";")) {
          const nome = parte.split("=")[0].trim();
          if (/^(_ga_|_gcl_)/.test(nome)) nomi.add(nome);
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
      try {
        finestra.localStorage?.removeItem("lp_external_id");
      } catch {
        /* archivio bloccato */
      }
      ricarica();
    },

    sospeso: () => sospeso,
    caricati: () => ({ ...stato }),
    puoAgire,
  };
}
