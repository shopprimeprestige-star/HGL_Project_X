/** ── INVIO DAL TELEFONO (PONTE) · LE REGOLE DELLA CHAT, SENZA SCHERMO ────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compiti T6 (dati) e T4 (disegno).
 *  Qui sta tutto ciò che si può decidere senza React né database: chi vede il
 *  tasto «Scrivi dal telefono», le bolle della coda nella conversazione, il
 *  conto dei messaggi restanti, ogni quanto si rilegge la coda, la chiave del
 *  tentativo e la frase di un rifiuto. `usaInvioPonte.ts` lo chiama, le prove
 *  lo provano a un orario fisso.
 *
 *  ⚠️ La coda NON entra mai in `api.messaggi`: quelli alimentano «Da rispondere»
 *   e il ripiego sulle 24 ore, e una bolla in coda non è una risposta. Si
 *   mescola solo al momento di disegnare (`unisciConCoda`).
 *  ⚠️ Le regole vere (ordine dei rifiuti, stati, vista senza doppioni) sono in
 *   `ponte/invio.ts`: qui si chiamano, non si riscrivono. Il server ricontrolla
 *   comunque tutto: ciò che decide il browser serve a non mostrare un tasto
 *   inutile, non a proteggere.
 *  ⚠️ Nessun log: questo file non scrive niente. */
import {
  controllaAccodamento,
  fraseMotivo,
  normalizzaNumero,
  statoVisibile,
  vistaCoda,
} from "../ponte/invio";
import {
  LIMITI_INVIO,
  type ApiPonteInvio,
  type BollaCoda,
  type FattiInvio,
  type RigaCoda,
} from "../ponte/invio-tipi";
import type { RigaStatoPonte } from "./avvisoPonte";
import type { WaMessageRow } from "./tipi";

const L = LIMITI_INVIO;
const HOUR_MS = 3_600_000;

const ms = (iso: string | null | undefined): number =>
  typeof iso === "string" ? Date.parse(iso) : NaN;

// ── La coda dentro la conversazione ───────────────────────────────────────

/** Prefisso dell'id di una riga della coda messa fra i messaggi: non può
 *  coincidere con l'id di un messaggio vero (uuid). */
export const ID_CODA = "coda:";

/** Una bolla della coda vestita da messaggio in uscita, solo per ordinarla e
 *  disegnarla. Senza id WhatsApp: non è ancora (o non è mai stata) una riga vera. */
export function messaggioDaCoda(b: BollaCoda): WaMessageRow {
  return {
    id: `${ID_CODA}${b.id}`,
    user_id: "",
    lead_id: null,
    direction: "outbound",
    from_number: "",
    to_number: "",
    body: b.testo,
    status: b.fase === "inviato" ? "sent" : b.fase === "non_inviato" ? "failed" : "queued",
    wa_message_id: null,
    error_message: null,
    created_at: b.quando,
    delivered_at: null,
    read_at: null,
  };
}

/** I messaggi della chat con le bolle della coda al loro posto, per orario.
 *  Non muta l'ingresso. A parità di orario il messaggio vero resta prima. Una
 *  data illeggibile manda la bolla in fondo. Coda vuota → gli stessi messaggi. */
export function unisciConCoda(messaggi: WaMessageRow[], coda: BollaCoda[]): WaMessageRow[] {
  if (coda.length === 0) return messaggi;
  const fuori = [...messaggi];
  const ordinate = [...coda].sort((a, b) => {
    const d = ms(a.quando) - ms(b.quando);
    return Number.isFinite(d) ? d : 0;
  });
  for (const b of ordinate) {
    const t = ms(b.quando);
    let pos = fuori.length;
    if (Number.isFinite(t)) {
      while (pos > 0 && ms(fuori[pos - 1].created_at) > t) pos--;
    }
    fuori.splice(pos, 0, messaggioDaCoda(b));
  }
  return fuori;
}

// ── Chi può scrivere dal telefono ─────────────────────────────────────────

/** Le sole cifre del numero della chat (`+39 333…`), o `null` se non è un numero. */
export function numeroDellaChat(telefono: string | null | undefined): string | null {
  return normalizzaNumero(telefono ?? "");
}

/** «Ha già una chat»: un messaggio in entrata fra quelli caricati (qualunque
 *  canale, anche `baileys`) o l'ultima entrata scritta sul contatto. */
export function entrataDelCliente(
  messaggi: { direction: string }[],
  contatto: { ultimo_in_entrata_il?: string | null } | null,
): boolean {
  return messaggi.some((m) => m.direction === "inbound") || !!contatto?.ultimo_in_entrata_il;
}

/** Le righe come le vede la chat (una `in_attesa` vecchia è scaduta). */
const fase = (r: RigaCoda, adesso: Date) => statoVisibile(r, adesso).fase;

/** Righe ancora aperte (`in_attesa` o `in_invio`), come le vede la chat. */
export function righeAperte(righe: RigaCoda[], adesso: Date): number {
  return righe.filter((r) => {
    const f = fase(r, adesso);
    return f === "in_attesa" || f === "in_invio";
  }).length;
}

/** Messaggi ancora possibili nelle prossime 24 ore: il tetto meno i prelievi
 *  (`preso_il`) delle ultime 24 ore. Come li conta il server. */
export function restantiOggi(righe: RigaCoda[], adesso: Date): number {
  const da = adesso.getTime() - L.giornoOre * HOUR_MS;
  const presi = righe.filter((r) => ms(r.preso_il) > da).length;
  return Math.max(0, L.alGiorno - presi);
}

/** I fatti che il server darebbe, ricavati da ciò che il browser sa già. */
export function fattiDelBrowser(i: {
  ponte: RigaStatoPonte | null;
  messaggi: { direction: string }[];
  contatto: { ultimo_in_entrata_il?: string | null } | null;
  stop: boolean;
  righe: RigaCoda[];
  adesso: Date;
}): FattiInvio {
  const da = i.adesso.getTime() - L.giornoOre * HOUR_MS;
  return {
    entrata: entrataDelCliente(i.messaggi, i.contatto),
    stop: i.stop,
    ponte_stato: i.ponte?.stato ?? null,
    ponte_battito: i.ponte?.aggiornato_il ?? null,
    //  Un ponte che non dichiara l'interruttore (versione vecchia) non invia.
    invii_attivi: i.ponte?.contatori?.invii_attivi === 1,
    ultime24h: i.righe.filter((r) => ms(r.preso_il) > da).length,
    in_coda: righeAperte(i.righe, i.adesso),
  };
}

/** Il tasto si vede solo se tutto torna. `leggibile` = la coda si è potuta
 *  leggere: con la tabella assente (migrazione non applicata) o un errore il
 *  tasto non compare, mai un errore a schermo. Il testo non conta qui (lo si
 *  controlla quando si invia): si prova con un testo qualunque. */
export function puoScrivere(i: {
  leggibile: boolean;
  numero: string | null;
  ponte: RigaStatoPonte | null;
  messaggi: { direction: string }[];
  contatto: { ultimo_in_entrata_il?: string | null } | null;
  stop: boolean;
  righe: RigaCoda[];
  adesso: Date;
}): ApiPonteInvio["puo"] {
  if (!i.leggibile) return { ok: false, motivo: "ponte_non_collegato" };
  const r = controllaAccodamento({
    testo: "x",
    numero: i.numero ?? "",
    fatti: fattiDelBrowser(i),
    adesso: i.adesso,
  });
  return r.ok ? { ok: true } : { ok: false, motivo: r.motivo };
}

// ── Le bolle di una chat ──────────────────────────────────────────────────

/** Le righe di QUESTA chat come bolle: senza doppioni con la riga vera
 *  (`vistaCoda`), con la fase, la frase e il riprova che la chat mostra. */
export function bolleDellaChat(
  righe: RigaCoda[],
  numero: string | null,
  messaggi: WaMessageRow[],
  adesso: Date,
): BollaCoda[] {
  if (!numero) return [];
  const sue = righe.filter((r) => r.numero === numero);
  return vistaCoda(
    sue,
    messaggi.map((m) => ({
      wa_message_id: m.wa_message_id,
      direction: m.direction,
      body: m.body,
      created_at: m.created_at,
      canale: m.canale ?? null,
    })),
    adesso,
  ).map((r) => {
    const v = statoVisibile(r, adesso);
    return {
      id: r.id,
      testo: r.testo,
      fase: v.fase,
      quando: r.created_at,
      frase: v.frase,
      incerto: v.incerto,
      puoRiprovare: v.puoRiprovare,
    };
  });
}

/** Ogni quanto rileggere la coda: 3 s finché c'è qualcosa in volo o un
 *  «inviato» ancora in vista, 30 s altrimenti. */
export function prossimaLettura(righe: RigaCoda[], adesso: Date): number {
  const ora = adesso.getTime();
  const attiva = righe.some((r) => {
    if (r.stato === "in_attesa" || r.stato === "in_invio") return true;
    if (r.stato !== "inviato") return false;
    const dal = ms(r.inviato_il ?? r.created_at);
    return Number.isFinite(dal) && ora - dal <= L.nascostoDopoS * 1000;
  });
  return attiva ? 3_000 : 30_000;
}

// ── L'invio ───────────────────────────────────────────────────────────────

/** Il tentativo in corso: finché numero e testo sono gli stessi la chiave non cambia. */
export interface Tentativo {
  numero: string;
  testo: string;
  chiave: string;
}

/** Una chiave nuova: 32 caratteri esadecimali, senza trattini (la rotta chiede 8-64 di `[A-Za-z0-9_-]`). */
export function nuovaChiave(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** La chiave per questo tocco: la stessa del tentativo precedente se numero e
 *  testo non sono cambiati (il tocco ripetuto non mette due messaggi in coda),
 *  altrimenti una nuova. */
export function chiaveDelTentativo(
  prima: Tentativo | null,
  numero: string,
  testo: string,
  genera: () => string = nuovaChiave,
): Tentativo {
  if (prima && prima.numero === numero && prima.testo === testo) return prima;
  return { numero, testo, chiave: genera() };
}

/** Cosa dire dopo una risposta della rotta. `ok` = il messaggio è in coda. Una
 *  frase del server (già senza gergo) si mostra così com'è; altrimenti una frase
 *  fissa. Mai il testo di un errore tecnico. */
export function esitoRichiesta(
  stato: number,
  json: unknown,
): { ok: true } | { ok: false; frase: string } {
  const j = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  if (stato >= 200 && stato < 300 && j?.ok === true) return { ok: true };
  if (typeof j?.frase === "string" && j.frase.trim() !== "" && j.frase.length <= 200)
    return { ok: false, frase: j.frase };
  if (stato === 503)
    return { ok: false, frase: "L'invio dal telefono non è ancora pronto. Riprova più tardi." };
  if (stato === 401 || stato === 403)
    return { ok: false, frase: "Accesso scaduto: ricarica la pagina e riprova." };
  return { ok: false, frase: fraseMotivo(null) };
}
