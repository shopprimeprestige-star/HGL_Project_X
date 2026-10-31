/** ── L'INVITO AL MEET, DALLA BARRA IN CIMA ALLE CHAT (31/10/2026) ───────────
 *  Richiesta del titolare: dalla barra «Meet alle 10:30 · Mirko» un tasto genera il messaggio con
 *  il link per entrare e lo manda: se la finestra di 24 ore è aperta dalla chat del CRM, se è
 *  chiusa apre WhatsApp (wa.me) col testo già scritto. Qui le regole, pure e provate in
 *  prove/idee/invito-meet.mjs; il disegno è in BarraProssimoMeet.tsx.
 *
 *  LE REGOLE:
 *  - Il testo: «Ciao {nome}, la tua consulenza con Hair Genius Labs è alle {ora}: {consulente} ti
 *    aspetta. Entra da qui: {link}». Il link è quello personale che usano gli altri messaggi
 *    (`linkPerCliente`). Nessun testo esistente va bene per un invito mandato a mano: `hgl_meet_adesso`
 *    dice «inizia adesso», `hgl_meet_oggi_link` promette di ricordarlo dopo.
 *  - Senza link non si può invitare; senza telefono valido nemmeno; con STOP del cliente nemmeno.
 *  - «Già inviato oggi»: lo dice il registro di questo dispositivo (`registraInvito`) oppure l'ultimo
 *    messaggio della chat, se è nostro, di oggi, e contiene il link. Il tasto allora lo dice e,
 *    per rimandare, chiede conferma.
 *  - Finestra non nota (`finestra` assente) = chiusa: meglio WhatsApp che un invio rifiutato.
 *  ── COL LINK O SENZA, PER CONSULENTE (31/10/2026, commessa invito-senza-link) ──
 *  Ogni consulente sceglie nella sua scheda (Anagrafica → Invito al meet) se l'invito parte col
 *  link di Meetly oppure SENZA link: allora il testo lo promette («Tra poco ti mando qui il link
 *  per entrare») e il link lo manda lui a mano, in un secondo messaggio. La scelta sta in
 *  `crm_consultants.data.invitoMeet` (JSON già esistente, scrittura sicura di `updateConsultant`):
 *  nessuna migrazione. Senza scelta salvata, o con un valore strano, vale il link: è il
 *  comportamento di prima e il più sicuro. Senza link il tasto NON si spegne se il link manca.
 *  Valgono solo per l'invito a mano: i modelli automatici di Meta, col link come variabile, non cambiano. */
import type { LeadData } from "../types";
import { linkPerCliente } from "../manychat/testi";
import { nomePerModello } from "../promemoria/formati";
import { linkWaMe } from "./apriWhatsapp";

/** Quel che serve della chat del meet (così vale per `ChatItem` e per le chat finte delle prove). */
export interface ChatPerInvito {
  phone: string;
  leadId?: string | null;
  lead?: { id?: string; data?: Partial<LeadData> | null } | null;
  finestra?: { aperta: boolean } | null;
  stop?: boolean;
  lastMessage?: { direction: string; body: string | null; created_at: string } | null;
}

/** Come parte l'invito di un consulente: col link di Meetly (di serie) o senza link. */
export type ModoInvito = "meetly" | "senza";

/** La scelta salvata nei dati del consulente; tutto ciò che non è «senza» vale «meetly». */
export const modoInvito = (dati: { invitoMeet?: unknown } | null | undefined): ModoInvito =>
  dati?.invitoMeet === "senza" ? "senza" : "meetly";

/** La scelta del consulente di un meet. Consulente assente o non più in archivio = col link. */
export const modoDelConsulente = (
  consulenti: { id: string; data?: { invitoMeet?: unknown } | null }[],
  consulenteId: string | null | undefined,
): ModoInvito => modoInvito(consulenti.find((x) => x.id === consulenteId)?.data);

/** La frase che, nell'invito senza link, promette il link: serve anche a riconoscere l'invito
 *  nella chat (il link lì non c'è). */
export const SEGNO_SENZA_LINK = "Tra poco ti mando qui il link per entrare";

/** Il promemoria per chi ha mandato un invito senza link. */
export const PROMEMORIA_LINK = "Ricordati di mandare il link";

export interface InvitoPreparato {
  testo: string;
  /** Il link del meet; `null` nell'invito senza link. */
  link: string | null;
  /** Cosa cercare nell'ultimo messaggio della chat per dire «già inviato oggi»: il link o la frase che lo promette. */
  segno: string;
  /** L'invito promette il link e non lo contiene: dopo l'invio va ricordato di mandarlo. */
  senzaLink: boolean;
}

/** Il testo dell'invito, o il motivo (breve, per il tasto) per cui non si può fare. */
export function preparaInvito(
  chat: ChatPerInvito,
  ora: string,
  consulente: string | null,
  modo: ModoInvito = "meetly",
): { ok: true; invito: InvitoPreparato } | { ok: false; motivo: string } {
  if (chat.stop) return { ok: false, motivo: "Il cliente ha chiesto STOP" };
  if (!linkWaMe(chat.phone)) return { ok: false, motivo: "Manca il telefono" };
  //  Senza link il link non serve: non si cerca nemmeno (e quindi non può mancare).
  const link =
    modo === "senza" ? null : linkPerCliente(chat.lead?.data ?? {}, chat.leadId ?? chat.lead?.id ?? null);
  if (modo !== "senza" && !link) return { ok: false, motivo: "Manca il link del meet" };
  //  Nel saluto basta il primo nome («Giulia», non «Giulia Verdi»).
  const nome = nomePerModello(chat.lead?.data?.nome)?.split(/\s+/)[0];
  const chi = consulente ? `${consulente} ti aspetta` : "ti aspettiamo";
  const inizio = `Ciao${nome ? ` ${nome}` : ""}, la tua consulenza con Hair Genius Labs è alle ${ora}: ${chi}.`;
  if (!link) {
    return {
      ok: true,
      invito: { testo: `${inizio} ${SEGNO_SENZA_LINK}.`, link: null, segno: SEGNO_SENZA_LINK, senzaLink: true },
    };
  }
  return { ok: true, invito: { testo: `${inizio} Entra da qui: ${link}`, link, segno: link, senzaLink: false } };
}

/** Come parte l'invito: dal CRM (finestra aperta) o da WhatsApp (chiusa o non nota). */
export const stradaInvito = (chat: ChatPerInvito): "crm" | "whatsapp" =>
  chat.finestra?.aperta === true ? "crm" : "whatsapp";

/** ── IL REGISTRO DEGLI INVITI (sul dispositivo) ────────────────────────────
 *  telefono → `{ giorno, alle, via }`. Un invito per telefono: quello di oggi sostituisce il vecchio.
 *  shortcut: sta nel localStorage del dispositivo, quindi un altro consulente o un altro telefono
 *  non lo vede (lo vede però l'ultimo messaggio della chat, se l'invio è partito dal CRM); da
 *  portare su una colonna del database se serve a più persone. */
export interface VoceInvito {
  giorno: string;
  /** «10:05», ora locale di quando è stato fatto. */
  alle: string;
  via: "crm" | "whatsapp";
}
export type RegistroInviti = Record<string, VoceInvito>;

export const CHIAVE_INVITI = "hgl.invitiMeet.v1";

/** Legge il registro da un testo; qualunque cosa rotta vale «vuoto». */
export function leggiRegistro(grezzo: string | null | undefined): RegistroInviti {
  try {
    const v = JSON.parse(grezzo ?? "{}") as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const fuori: RegistroInviti = {};
    for (const [tel, x] of Object.entries(v as Record<string, Partial<VoceInvito>>)) {
      if (
        x &&
        typeof x.giorno === "string" &&
        /^\d{2}:\d{2}$/.test(String(x.alle)) &&
        (x.via === "crm" || x.via === "whatsapp")
      )
        fuori[tel] = { giorno: x.giorno, alle: x.alle as string, via: x.via };
    }
    return fuori;
  } catch {
    return {};
  }
}

/** Il registro con l'invito di adesso; tiene solo quelli di `oggi` (non cresce all'infinito). */
export function registraInvito(
  prima: RegistroInviti,
  telefono: string,
  oggi: string,
  alle: string,
  via: "crm" | "whatsapp",
): RegistroInviti {
  const resto = Object.fromEntries(Object.entries(prima).filter(([, v]) => v.giorno === oggi));
  return { ...resto, [telefono]: { giorno: oggi, alle, via } };
}

/** L'invito di oggi già fatto a questa chat, o `null`. `segno` è quel che riconosce l'invito nell'ultimo
 *  messaggio nostro: il link, o (senza link) la frase che lo promette. `oraLocale` serve a leggere
 *  l'ora di quel messaggio: `(iso) => "10:05"`. */
export function invitoDiOggi(
  chat: ChatPerInvito,
  registro: RegistroInviti,
  oggi: string,
  segno: string,
  oraLocale: (iso: string) => string,
  giornoLocale: (iso: string) => string,
): VoceInvito | null {
  const voce = registro[chat.phone];
  if (voce && voce.giorno === oggi) return voce;
  const m = chat.lastMessage;
  if (m && m.direction === "outbound" && segno && m.body?.includes(segno) && giornoLocale(m.created_at) === oggi)
    return { giorno: oggi, alle: oraLocale(m.created_at), via: "crm" };
  return null;
}
