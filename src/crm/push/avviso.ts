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

/** ── UNA NOTIFICA PER NUMERO OGNI 180 SECONDI (30/10/2026) ──────────────────
 *  Lo stesso messaggio del cliente può arrivare da due strade (ManyChat e il
 *  ponte del Mac, o il webhook di Meta): la porta `push_avviso_porta` lascia
 *  passare un avviso per numero in questa finestra, che è quella in cui il
 *  ponte riconosce lo stesso messaggio (`FINESTRA_PARI_S`). La notifica dice
 *  solo il nome, quindi un secondo messaggio dentro la finestra non porta
 *  niente di nuovo: la notifica di prima è ancora lì. */
export const FINESTRA_AVVISO_S = 180;

/** A chi va: il titolare (iscrizione senza consulente) e il consulente del
 *  lead. Un lead senza consulente (o un numero senza scheda): solo il titolare. */
export function destinatari<T extends { consulente_id?: string | null }>(
  lista: T[],
  consulenteId: string | null | undefined,
): T[] {
  return lista.filter(
    (i) => !i.consulente_id || (!!consulenteId && i.consulente_id === consulenteId),
  );
}

/** Le porte di `avvisaRisposta` (le vere in `invio.server.ts`). */
export interface PorteAvviso<T extends { consulente_id?: string | null }> {
  /** le chiavi VAPID ci sono */
  acceso(): boolean;
  /** `push_avviso_porta`: vero = si avvisa. Può lanciare (migrazione assente). */
  porta(userId: string, chiave: string): Promise<boolean>;
  /** nome e consulente della scheda (dal lead, o dal numero in rubrica). Può lanciare. */
  scheda(
    userId: string,
    leadId: string | null,
    telefono: string,
  ): Promise<{ nome: string | null; consulenteId: string | null } | null>;
  iscrizioni(userId: string): Promise<T[]>;
  invia(userId: string, avviso: AvvisoPush, lista: T[]): Promise<unknown>;
}

/** Un messaggio in entrata vero: porta → scheda → destinatari → invio.
 *  ⚠️ NON LANCIA MAI: un guasto qui non deve far perdere il messaggio. Una
 *   porta guasta (migrazione non applicata) lascia passare: meglio due
 *   notifiche che nessuna. */
export async function avvisaRisposta<T extends { consulente_id?: string | null }>(
  porte: PorteAvviso<T>,
  p: { userId: string; telefono: string; leadId?: string | null; nomeProfilo?: string | null },
): Promise<"spento" | "gia_avvisato" | "nessuno" | "inviato" | "errore"> {
  try {
    if (!porte.acceso() || !p.userId) return "spento";
    const chiave = chiaveTelefono(p.telefono);
    if (chiave && !(await porte.porta(p.userId, chiave).catch(() => true))) return "gia_avvisato";
    const scheda = await porte.scheda(p.userId, p.leadId ?? null, p.telefono).catch(() => null);
    const lista = destinatari(await porte.iscrizioni(p.userId), scheda?.consulenteId);
    if (lista.length === 0) return "nessuno";
    await porte.invia(
      p.userId,
      avvisoWhatsapp({
        telefono: p.telefono,
        nomeScheda: scheda?.nome,
        nomeProfilo: p.nomeProfilo,
      }),
      lista,
    );
    return "inviato";
  } catch {
    return "errore";
  }
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
