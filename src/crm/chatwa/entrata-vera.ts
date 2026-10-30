/** ── LA FINESTRA DI 24 ORE SI APRE SOLO CON UN MESSAGGIO VERO (30/10/2026) ─────
 *
 *  Una reazione, uno sticker o una posizione ManyChat li salva come inbound con
 *  body «[messaggio senza testo]» (`manychat/risposta.ts`) e aggiorna lo stesso
 *  `ultimo_in_entrata_il` del contatto. Ma per ManyChat NON riaprono la finestra:
 *  il testo libero parte, il CRM scrive «sent» e su WhatsApp non arriva mai.
 *  Vale come per `p8_controllo_notte.sql`: body vuoto o «[messaggio senza testo]»
 *  non è un messaggio del cliente. Foto e vocali (link ai media) sì: sono veri.
 *
 *  ⚠️ `ultimo_in_entrata_il` NON si tocca: «Da rispondere», le bozze e i push lo
 *   usano giustamente anche per una reazione. Cambia solo il calcolo della
 *   FINESTRA, qui, senza migrazioni: l'anteprima del contatto
 *   (`ultimo_in_entrata_anteprima`, scritta insieme all'ora) dice se l'ultima entrata
 *   era senza testo; in quel caso la vera ultima entrata si cerca fra i messaggi.
 *  Puro, con le letture passate da fuori (prove in prove/manychat/porta.mjs e
 *  prove/manychat/finestra-reazioni.mjs).
 *  ───────────────────────────────────────────────────────────────────────── */
import { CANALE_PONTE } from "../ponte/tipi";
import { ETICHETTA_ILLEGGIBILE } from "./media";

const SENZA_TESTO = "[messaggio senza testo]";

/** Un body in entrata è un messaggio vero? Vuoto, assente o «[messaggio senza testo]» no. */
export function eEntrataVera(body: string | null | undefined): boolean {
  const t = String(body ?? "").trim();
  return t !== "" && t !== SENZA_TESTO;
}

/** L'anteprima del contatto dice che l'ultima entrata era senza testo? Anche scritta con
 *  l'etichetta della bolla (`anteprimaIn`). Anteprima assente (righe vecchie): non si sa, no. */
export function anteprimaSenzaTesto(anteprima: string | null | undefined): boolean {
  if (anteprima === null || anteprima === undefined) return false;
  const t = anteprima.trim();
  return !eEntrataVera(t) || t === ETICHETTA_ILLEGGIBILE;
}

/** Quanto serve di una riga di `whatsapp_contacts`. */
export interface RigaEntrata {
  phone_e164?: string | null;
  ultimo_in_entrata_il?: string | null;
  ultimo_in_entrata_anteprima?: string | null;
}

/** Quanto serve di una riga di `whatsapp_messages`. */
export interface MessaggioEntrata {
  from_number?: string | null;
  direction?: string | null;
  body?: string | null;
  created_at?: string | null;
  canale?: string | null;
}

const ms = (t: string | null | undefined) => Date.parse(String(t ?? ""));

/** Le ultime 9 cifre di un numero (la rubrica lo ha con e senza «+»); vuoto se è troppo corto.
 *  Come `ultimeNoveCifre` di manychat/regole, che qui non si importa: trascina mezzo CRM. */
function nove(telefono: string | null | undefined): string {
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  return cifre.length >= 9 ? cifre.slice(-9) : "";
}

/** L'ultima entrata che vale per la finestra (ISO), o `null`.
 *  Ultima entrata con testo → quella. Senza testo → il messaggio vero più recente fra `messaggi`
 *  (solo in entrata, non del ponte). Nessuno → `null`: finestra chiusa, parte il modello. */
export function entrataPerFinestra(
  contatto: RigaEntrata | null | undefined,
  messaggi: MessaggioEntrata[] = [],
): string | null {
  const colonna = contatto?.ultimo_in_entrata_il ?? null;
  if (!colonna || !anteprimaSenzaTesto(contatto?.ultimo_in_entrata_anteprima)) return colonna;
  let meglio: string | null = null;
  let quando = -Infinity;
  for (const m of messaggi) {
    if (m.direction !== "inbound" || m.canale === CANALE_PONTE || !eEntrataVera(m.body)) continue;
    const t = ms(m.created_at);
    if (Number.isFinite(t) && t > quando) {
      quando = t;
      meglio = m.created_at as string;
    }
  }
  return meglio;
}

/** Le righe dei contatti con `ultimo_in_entrata_il` portato all'ultima entrata VERA.
 *  I messaggi si leggono (UNA volta, con `leggiMessaggi`) solo per i contatti la cui ultima
 *  entrata è senza testo. Lettura che fallisce → quei contatti restano senza finestra:
 *  nel dubbio parte il modello, che arriva sempre. */
export async function entrateVere<T extends RigaEntrata>(
  righe: T[],
  leggiMessaggi: (telefoni: string[]) => Promise<MessaggioEntrata[]>,
): Promise<T[]> {
  const dubbie = righe.filter(
    (r) => r.ultimo_in_entrata_il && anteprimaSenzaTesto(r.ultimo_in_entrata_anteprima),
  );
  if (dubbie.length === 0) return righe;
  let messaggi: MessaggioEntrata[] = [];
  try {
    messaggi = await leggiMessaggi([...new Set(dubbie.map((r) => String(r.phone_e164 ?? "")))]);
  } catch {
    messaggi = [];
  }
  return righe.map((r) => {
    if (!dubbie.includes(r)) return r;
    const suo = nove(r.phone_e164);
    const suoi = messaggi.filter((m) => suo !== "" && nove(m.from_number) === suo);
    return { ...r, ultimo_in_entrata_il: entrataPerFinestra(r, suoi) };
  });
}
