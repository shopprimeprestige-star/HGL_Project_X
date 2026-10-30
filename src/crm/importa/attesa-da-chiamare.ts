/** ── DA «ATTESA WHATSAPP» A «DA CHIAMARE», DA SOLO ──────────────────────────
 *
 *  Richiesta del titolare (28/10/2026): «fai che cambia stato Attesa WhatsApp
 *  in Da chiamare» quando resta in attesa più di 10 ore. Lo fa il server ogni
 *  15 minuti (hooks/attesa-da-chiamare), anche a CRM chiuso.
 *
 *  Chi si sposta (30/10/2026, «la palla è al cliente»): stato `attesa_whatsapp`
 *  il cui ULTIMO messaggio è nostro (qualunque canale) da almeno 10 ore, senza un
 *  messaggio del cliente dopo (le eco non contano), senza STOP sul numero. Stessa
 *  regola della chat: crm/chatwa/daChiamare, `calcolaDaChiamare`.
 *  ⚠️ Solo chi è nello STATO «Attesa WhatsApp»: il solo tasto WhatsApp premuto
 *   (senza stato) non cambia la scheda di nessuno.
 *  ⚠️ La modifica tocca solo lo stato e la sua storia (stato di prima e ora):
 *   il resto della scheda resta com'è. Il server la scrive solo se la scheda
 *   non è cambiata nel frattempo (vedi la rotta).
 *  ───────────────────────────────────────────────────────────────────────── */
import { LEAD_STATUS_LABEL, type LeadData, type LeadStatus } from "@/crm/types";
import { calcolaDaChiamare, type MessaggioAttesa } from "@/crm/chatwa/daChiamare";
import { aRoma } from "@/crm/promemoria/formati";
import { conNota } from "@/crm/manychat/prenota-scheda";

export interface ContattoWa {
  /** l'ultimo messaggio del cliente */
  ultimoInEntrataIl?: string | null;
  /** STOP: ha chiesto di non essere contattato */
  stop?: boolean;
}

/** Le ultime nove cifre: la stessa impronta del numero usata in tutto il CRM. */
export const nove = (t?: string | null): string =>
  String(t ?? "")
    .replace(/\D/g, "")
    .slice(-9);

/** La modifica da scrivere sulla scheda, o `null` se non va spostata.
 *  `messaggi`: quelli di QUEL numero (ultimi 7 giorni); senza, vale la regola
 *  di prima (dall'ingresso nello stato). */
export function patchDaChiamare(
  d: Partial<LeadData> | null | undefined,
  contatto: ContattoWa | null | undefined,
  adesso: Date,
  messaggi: MessaggioAttesa[] = [],
): Partial<LeadData> | null {
  if (!d || d.stato !== "attesa_whatsapp") return null;
  const esito = calcolaDaChiamare({
    dati: d,
    messaggi,
    stop: contatto?.stop ?? false,
    ultimaEntrataIl: contatto?.ultimoInEntrataIl ?? null,
    adesso,
  });
  if (!esito.si) return null;
  const ora = adesso.toISOString();
  return {
    stato: "da_chiamare",
    statoPrecedente: "attesa_whatsapp",
    statoPrecedenteIl: ora,
    statoDal: ora,
  };
}

/** ── E INDIETRO: CHI SCRIVE TORNA IN «ATTESA WHATSAPP» (29-30/10/2026) ──────
 *  Richiesta del titolare: se il lead è in uno stato «da setter» e scrive, si
 *  riapre la finestra delle 24 ore e la scheda torna da sola in «Attesa
 *  WhatsApp», così si vede subito e si risponde.
 *  ⚠️ ELENCO CHIUSO: solo questi quattro stati cambiano. Tutto il resto (Non
 *   interessato, Richiamo concordato, Appuntamento fissato/rifissato, Ci
 *   ricontatta lui, Perditempo e ogni stato dopo la consulenza) resta com'è
 *   anche se il cliente scrive. Un nuovo stato NON entra qui da solo.
 *  Vale se l'ultimo messaggio del cliente è arrivato DOPO l'ingresso nello
 *  stato ed entro le ultime 24 ore (finestra aperta); mai con lo STOP.
 *  «Messaggio del cliente» = `ultimo_in_entrata_il` della rubrica (ManyChat,
 *  dopo i controlli su eco e doppioni) più le entrate del ponte e del webhook
 *  Cloud API firmato (`unisciEntrate`, più sotto): i messaggi nostri non contano. Le chiamate WhatsApp in entrata non arrivano da nessuna
 *  fonte (il ponte le scarta, il webhook Cloud non legge `calls`): non contano. */
export const STATI_CHE_TORNANO_IN_ATTESA = [
  "da_contattare",
  "non_risponde",
  "segreteria",
  "da_chiamare",
] as const satisfies readonly LeadStatus[];

const FINESTRA_MS = 24 * 3600_000;
const due = (n: number) => String(n).padStart(2, "0");

/** «30/10 alle 00:09», ora di Roma. */
function quandoARoma(iso: number): string {
  const r = aRoma(new Date(iso));
  const [, mese, giorno] = r.giorno.split("-");
  return `${giorno}/${mese} alle ${due(Math.floor(r.minuti / 60))}:${due(r.minuti % 60)}`;
}

/** `modificataIl`: l'`updated_at` della riga, solo come ripiego quando la scheda
 *  non ha `statoDal` né `statoPrecedenteIl` (schede vecchie o importate): senza
 *  una data d'ingresso non si saprebbe dire se ha scritto DOPO. */
export function patchRitornoAttesa(
  d: Partial<LeadData> | null | undefined,
  contatto: ContattoWa | null | undefined,
  adesso: Date,
  modificataIl?: string | null,
): Partial<LeadData> | null {
  if (!d || !contatto || contatto.stop) return null;
  const stato = d.stato as string | undefined;
  if (!stato || !(STATI_CHE_TORNANO_IN_ATTESA as readonly string[]).includes(stato)) return null;
  const entrata = Date.parse(contatto.ultimoInEntrataIl ?? "");
  if (!Number.isFinite(entrata)) return null;
  if (adesso.getTime() - entrata > FINESTRA_MS) return null;
  const date = (xs: unknown[]) =>
    xs.map((x) => Date.parse(String(x ?? ""))).filter((x) => Number.isFinite(x));
  let dal = date([d.statoDal, d.statoPrecedenteIl]);
  if (dal.length === 0) dal = date([modificataIl]);
  //  Senza nessuna data non si sa se ha scritto DOPO: si lascia com'è.
  if (dal.length === 0 || entrata <= Math.max(...dal)) return null;
  const ora = adesso.toISOString();
  const riga = `Tornato in Attesa WhatsApp: ha scritto il ${quandoARoma(entrata)} (era: ${LEAD_STATUS_LABEL[stato as LeadStatus] ?? stato})`;
  return {
    stato: "attesa_whatsapp",
    statoPrecedente: stato as LeadStatus,
    statoPrecedenteIl: ora,
    statoDal: ora,
    note: conNota(d.note, riga),
  };
}

/** ── TUTTI I MESSAGGI DEL CLIENTE CONTANO (30/10/2026) ──────────────────────
 *  Richiesta del titolare: per il ritorno in «Attesa WhatsApp» vale anche un
 *  messaggio arrivato dal canale diretto di Meta (webhook Cloud API) o dal
 *  collegamento col QR code (ponte, canale «baileys»), non solo da ManyChat.
 *  Si uniscono qui: la rubrica (`ultimo_in_entrata_il`, che scrive solo
 *  ManyChat, e lo STOP) e le righe IN ENTRATA di `whatsapp_messages` delle
 *  ultime 24 ore. Per numero vince il messaggio più recente; lo STOP della
 *  rubrica vale sempre.
 *  ⚠️ Le righe del ponte che hanno già un pari (`duplicato_di`) non contano due
 *   volte, e i messaggi nostri (outbound) non contano mai: si scartano qui.
 *  ⚠️ `ultimo_in_entrata_il` NON si tocca: lo usano altre regole (risposte al
 *   promemoria), che restano com'erano. */
export interface RigaContatto {
  user_id: string;
  phone_e164: string | null;
  ultimo_in_entrata_il: string | null;
  non_scrivere_dal: string | null;
}
export interface RigaMessaggio {
  user_id: string | null;
  from_number: string | null;
  direction: string | null;
  created_at: string | null;
  duplicato_di?: string | null;
  /** `manychat`, `baileys` (ponte) o vuoto (webhook Cloud API) */
  canale?: string | null;
}
/** Quali righe di `whatsapp_messages` contano. ManyChat NO: è già nella rubrica
 *  (`ultimo_in_entrata_il`, scritta dopo i controlli su eco e doppioni). Il
 *  ponte SÌ (la sua rotta è protetta dalla sua chiave). Il webhook Cloud API
 *  (canale vuoto) SOLO per chi ha l'App Secret: senza, il webhook accetta anche
 *  messaggi non firmati e un estraneo potrebbe spostare le schede. */
export function rigaConta(m: RigaMessaggio, conFirma: ReadonlySet<string>): boolean {
  if (m.direction !== "inbound" || m.duplicato_di || !m.user_id) return false;
  if (m.canale === "baileys") return true;
  if (m.canale == null || m.canale === "") return conFirma.has(m.user_id);
  return false;
}

export function unisciEntrate(
  contatti: RigaContatto[],
  messaggi: RigaMessaggio[],
  conFirma: ReadonlySet<string> = new Set(),
): Map<string, ContattoWa> {
  const out = new Map<string, ContattoWa>();
  const piuRecente = (a?: string | null, b?: string | null) => {
    const ta = Date.parse(a ?? "");
    const tb = Date.parse(b ?? "");
    if (!Number.isFinite(ta)) return Number.isFinite(tb) ? b! : null;
    if (!Number.isFinite(tb)) return a!;
    return tb > ta ? b! : a!;
  };
  for (const c of contatti) {
    const n = nove(c.phone_e164);
    if (!n) continue;
    const k = `${c.user_id}|${n}`;
    const prima = out.get(k);
    out.set(k, {
      ultimoInEntrataIl: piuRecente(prima?.ultimoInEntrataIl, c.ultimo_in_entrata_il),
      stop: !!prima?.stop || !!c.non_scrivere_dal,
    });
  }
  for (const m of messaggi) {
    if (!rigaConta(m, conFirma)) continue;
    const n = nove(m.from_number);
    if (!n) continue;
    const k = `${m.user_id}|${n}`;
    const prima = out.get(k);
    out.set(k, {
      ultimoInEntrataIl: piuRecente(prima?.ultimoInEntrataIl, m.created_at),
      stop: !!prima?.stop,
    });
  }
  return out;
}
