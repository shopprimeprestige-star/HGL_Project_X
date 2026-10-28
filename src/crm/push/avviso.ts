/** ── CHE COSA DICE LA NOTIFICA ──────────────────────────────────────────────
 *  Decisione del titolare (28/10/2026): sullo schermo bloccato SOLO il nome,
 *  mai il testo del messaggio. Lo schermo bloccato lo vede chiunque abbia il
 *  telefono in mano, e i clienti a volte scrivono della loro situazione.
 *  Il formato è quello che legge `public/sw.js` (titolo, corpo, chiave,
 *  destinazione). La `chiave` è il numero: tre messaggi della stessa persona
 *  fanno UNA notifica che si aggiorna, non tre. */
import { chiaveTelefono } from "../telefono-doppio";

export interface AvvisoPush {
  titolo: string;
  corpo: string;
  chiave: string;
  destinazione: string;
}

export function avvisoWhatsapp(p: {
  telefono: string;
  /** nome e cognome della scheda, se c'è */
  nomeScheda?: string | null;
  /** il nome del profilo WhatsApp / ManyChat */
  nomeProfilo?: string | null;
}): AvvisoPush {
  const pulito = (t?: string | null) =>
    String(t ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
  const chi = pulito(p.nomeScheda) || pulito(p.nomeProfilo) || "Un numero nuovo";
  return {
    titolo: "WhatsApp",
    corpo: `${chi} ti ha scritto`,
    chiave: `wa:${chiaveTelefono(p.telefono) || "?"}`,
    destinazione: "/CRM/whatsapp",
  };
}

/** Le chiavi VAPID dalle variabili del server. `null` se mancano: le notifiche
 *  restano spente e la pagina lo dice, senza errori. */
export function chiaviDaAmbiente(env: Record<string, string | undefined>) {
  const pubblica = String(env.VAPID_PUBLIC_KEY ?? "").trim();
  const privata = String(env.VAPID_PRIVATE_KEY ?? "").trim();
  if (!pubblica || !privata) return null;
  const soggetto =
    String(env.VAPID_SUBJECT ?? "").trim() ||
    (env.CRM_ADMIN_EMAIL ? `mailto:${env.CRM_ADMIN_EMAIL}` : "https://hair-genius-hub.hair");
  return { pubblica, privata, soggetto };
}

/** ── SOLO I SERVIZI PUSH VERI ───────────────────────────────────────────────
 *  Il server fa una richiesta all'indirizzo dell'iscrizione: senza questo
 *  controllo chiunque fosse dentro il CRM potrebbe fargli chiamare un
 *  indirizzo qualsiasi. Si accettano solo HTTPS verso i servizi di Apple,
 *  Google, Mozilla e Microsoft. */
const SERVIZI_PUSH = [
  /(^|\.)push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export function iscrizioneValida(
  x: unknown,
): { endpoint: string; p256dh: string; auth: string } | null {
  const o = (x ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof o.endpoint === "string" ? o.endpoint.trim() : "";
  const p256dh = typeof o.keys?.p256dh === "string" ? o.keys.p256dh.trim() : "";
  const auth = typeof o.keys?.auth === "string" ? o.keys.auth.trim() : "";
  if (
    !endpoint ||
    endpoint.length > 1000 ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) ||
    !/^[A-Za-z0-9_-]{16,30}$/.test(auth)
  )
    return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    return null;
  if (!SERVIZI_PUSH.some((r) => r.test(url.hostname))) return null;
  return { endpoint, p256dh, auth };
}
