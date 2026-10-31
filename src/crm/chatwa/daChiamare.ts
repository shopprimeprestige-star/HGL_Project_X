/** ── «DA CHIAMARE»: IN ATTESA SU WHATSAPP DA PIÙ DI 10 ORE ───────────────────
 *
 *  Richiesta del titolare (28/10/2026), corretta subito dopo: non tutti quelli
 *  che hanno ricevuto il primo messaggio, ma «solo quelli che rimangono in
 *  attesa WhatsApp per più di 10 ore di fila» si spostano nella scheda «Da
 *  chiamare» della chat, con il tasto per telefonare sopra la chat.
 *
 *  ⚠️ AGGIORNATA IL 30/10/2026: vale «la palla è al cliente» (vedi sotto,
 *  `calcolaDaChiamare`): l'attesa si misura dal NOSTRO ultimo messaggio, non
 *  solo dall'ingresso nello stato, e le eco non sono risposte.
 *
 *  LA REGOLA DI BASE (pura, provata in prove/prove.mjs, proveDelDaChiamare):
 *   · il lead è «in attesa WhatsApp» come nel resto del CRM: stato
 *     `attesa_whatsapp`, oppure il tasto WhatsApp premuto e nessun cambio di
 *     stato da allora (`inAttesaWhatsapp`, crm/importa/attesa-whatsapp);
 *   · l'attesa è cominciata almeno 10 ore fa: dall'ora in cui è stato messo lo
 *     stato (`statoPrecedenteIl`), o da quando è partito il messaggio
 *     (`whatsappInviatoIl`);
 *   · da allora il cliente non ha scritto (altrimenti è «Da rispondere»);
 *   · niente STOP sul numero.
 *  Esce da sola quando lo stato cambia (fissato, non risponde, richiamo…) o
 *  quando il cliente scrive.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "@/crm/types";
import { inAttesaWhatsapp } from "@/crm/importa/attesa-whatsapp";
import { CONFRONTO_CARATTERI } from "../ponte/tipi";
import { normalizzaTesto } from "../ponte/pari";
import { ultimoDellaChat } from "./stato";

/** ── QUANDO SI PASSA A «DA CHIAMARE»: ALLA CHIUSURA DELLA FINESTRA (31/10/2026) ──
 *  Richiesta del titolare: non più dopo 10 ore fisse. L'ultimo messaggio è nostro, il cliente
 *  non risponde e si chiude la finestra delle 24 ore (24 ore dall'ultimo messaggio del cliente).
 *  Se la finestra era già chiusa quando abbiamo scritto (primo contatto, modello a pagamento),
 *  al cliente si lasciano 24 ore dal nostro ultimo messaggio: altrimenti passerebbe a «Da
 *  chiamare» un istante dopo il primo messaggio. */
export const ORE_PRIMA_DI_CHIAMARE = 24;
const FINESTRA_MS = 24 * 3600_000;

/** L'istante da cui il lead in attesa passa a «Da chiamare». `inizio`: il nostro ultimo
 *  messaggio (o l'ingresso nello stato); `entrata`: l'ultimo messaggio del cliente, prima di
 *  `inizio` (0 o NaN se non ha mai scritto). Pura. */
export function scadenzaAttesa(inizio: number, entrata: number): number {
  const chiude = Number.isFinite(entrata) && entrata > 0 ? entrata + FINESTRA_MS : NaN;
  //  Finestra ancora aperta quando abbiamo scritto: si passa quando si chiude.
  if (Number.isFinite(chiude) && chiude > inizio) return chiude;
  return inizio + ORE_PRIMA_DI_CHIAMARE * 3600_000;
}

/** Un'eco arriva entro un minuto DOPO il messaggio nostro che ripete. */
export const ECO_ENTRO_MS = 60_000;

/** Un messaggio della conversazione. `body`, `from_number` e `to_number` servono
 *  solo al riconoscimento dell'eco, in memoria: mai nei log. */
export type MessaggioAttesa = {
  direction: string;
  created_at: string;
  canale?: string | null;
  duplicato_di?: string | null;
  /** Eliminato dal telefono (revoche del ponte): non è mai stato un messaggio nostro valido. */
  eliminato_il?: string | null;
  from_number?: string | null;
  to_number?: string | null;
  body?: string | null;
  /** `failed` = non è partito: il cliente non l'ha mai visto, non è una nostra risposta. */
  status?: string | null;
};
type Messaggio = MessaggioAttesa;

export interface DaChiamare {
  si: boolean;
  /** da quando è in attesa (ISO) */
  dal: string | null;
}

const NO: DaChiamare = { si: false, dal: null };

/** Da quando questo lead è in attesa su WhatsApp, o `null` se non lo è. */
export function inAttesaDal(d?: Partial<LeadData> | null): string | null {
  if (!d) return null;
  const valido = (x: unknown) => (Number.isFinite(Date.parse(String(x ?? ""))) ? String(x) : null);
  //  `statoDal` è l'ora che scrive il server quando mette lo stato (ManyChat):
  //  ripiego se manca quella del CRM. Senza nessuna delle tre non si sa da
  //  quando aspetta, e non si inventa: resta fuori.
  if (d.stato === "attesa_whatsapp")
    return valido(d.statoPrecedenteIl) ?? valido(d.statoDal) ?? valido(d.whatsappInviatoIl);
  return inAttesaWhatsapp(d) ? valido(d.whatsappInviatoIl) : null;
}

const ultime9 = (t?: string | null): string =>
  String(t ?? "")
    .replace(/\D/g, "")
    .slice(-9);
const ms = (x: unknown): number => {
  const t = Date.parse(String(x ?? ""));
  return Number.isFinite(t) ? t : NaN;
};

/** ── LE ECO NON SONO RISPOSTE (30/10/2026) ──────────────────────────────────
 *  Con ManyChat in coesistenza con l'app, un messaggio che il titolare scrive
 *  dal telefono torna indietro come riga IN ENTRATA di ManyChat, col suo stesso
 *  testo, pochi secondi dopo. Non è il cliente. Eco = riga inbound/manychat
 *  col testo uguale a un nostro outbound dello stesso numero, arrivata entro
 *  `ECO_ENTRO_MS` DOPO di lui. Le righe con `duplicato_di` non contano. Pura.
 *  Restituisce le righe eco: il loro istante serve anche a scartare il valore
 *  della rubrica `ultimo_in_entrata_il`, scritto nello stesso momento. */
export function righeEco(messaggi: readonly Messaggio[]): Set<Messaggio> {
  const testo = (m: Messaggio) => normalizzaTesto(m.body).slice(0, CONFRONTO_CARATTERI);
  const nostri = messaggi.filter(
    (m) =>
      m.direction === "outbound" &&
      !m.duplicato_di &&
      !m.eliminato_il &&
      testo(m) &&
      Number.isFinite(ms(m.created_at)),
  );
  const out = new Set<Messaggio>();
  for (const e of messaggi) {
    if (e.direction !== "inbound" || e.canale !== "manychat" || e.duplicato_di) continue;
    const te = ms(e.created_at);
    const t = testo(e);
    if (!t || !Number.isFinite(te)) continue;
    //  Stesso numero: se una delle due righe non lo dice, vale la conversazione
    //  già scelta da chi chiama.
    const stesso = (n: Messaggio) => {
      const a = ultime9(e.from_number);
      const b = ultime9(n.to_number);
      return !a || !b || a === b;
    };
    if (
      nostri.some((n) => {
        const dopo = te - ms(n.created_at);
        return dopo >= 0 && dopo <= ECO_ENTRO_MS && testo(n) === t && stesso(n);
      })
    )
      out.add(e);
  }
  return out;
}

/** ── LA PALLA È AL CLIENTE (30/10/2026) ─────────────────────────────────────
 *  Un lead in attesa WhatsApp va in «Da chiamare» se:
 *   · l'ULTIMO messaggio della conversazione è NOSTRO, da qualunque canale
 *     (ManyChat, scritto dal telefono col ponte, Cloud API);
 *   · si è chiusa la finestra delle 24 ore (`scadenzaAttesa`, 31/10/2026: non più 10 ore);
 *   · il cliente non ha scritto dopo (le eco e i doppioni non sono lui);
 *   · niente STOP.
 *  L'attesa comincia al più recente fra l'ingresso nello stato (`inAttesaDal`)
 *  e il nostro ultimo messaggio: chi risponde una volta e poi tace dopo un
 *  NOSTRO messaggio non resta in attesa per sempre.
 *  Senza messaggi nostri caricati vale la regola di prima: dall'ingresso nello
 *  stato, se il cliente non ha scritto da allora (anche solo per la rubrica).
 *  Pura: la usano il cron (patchDaChiamare) e la chat. */
export function calcolaDaChiamare(p: {
  /** la scheda del lead della chat (senza scheda non c'è attesa) */
  dati?: Partial<LeadData> | null;
  /** i messaggi di quel numero (quelli caricati: il cron legge gli ultimi 7 giorni) */
  messaggi: Messaggio[];
  stop?: boolean;
  /** l'ultimo messaggio del cliente secondo la rubrica: vale anche se i
   *  messaggi caricati non arrivano così indietro (non se è un'eco) */
  ultimaEntrataIl?: string | null;
  /** L'ultimo messaggio della chat secondo il contatto (`ultimo_messaggio_*`, scritto dal trigger
   *  per ogni canale): serve quando i messaggi caricati non arrivano così indietro. */
  ultimoMessaggio?: { il?: string | null; direzione?: string | null } | null;
  adesso: Date;
}): DaChiamare {
  if (p.stop) return NO;
  //  Lo stato «Da chiamare» (28/10/2026): ci è già arrivato, non si aspetta altro.
  const giaDaChiamare = p.dati?.stato === "da_chiamare";
  const dal = giaDaChiamare
    ? (p.dati?.statoPrecedenteIl ?? p.dati?.statoDal ?? null)
    : inAttesaDal(p.dati);
  if (!dal || !Number.isFinite(Date.parse(dal))) return NO;
  const eco = righeEco(p.messaggi);
  const eEco = (t: number) => [...eco].some((e) => Math.abs(ms(e.created_at) - t) <= ECO_ENTRO_MS);
  let ultimoNostro = NaN;
  let ultimaEntrata = ms(p.ultimaEntrataIl);
  //  Il valore della rubrica scritto dall'eco non è il cliente.
  if (Number.isFinite(ultimaEntrata) && eEco(ultimaEntrata)) ultimaEntrata = NaN;
  let ultimaEntrataMsg = NaN;
  const piu = (a: number, b: number) => (Number.isFinite(a) ? Math.max(a, b) : b);
  for (const m of p.messaggi) {
    const t = ms(m.created_at);
    if (!Number.isFinite(t) || m.duplicato_di || m.eliminato_il) continue;
    //  Un nostro invio non partito non è una risposta: il cliente non l'ha ricevuto.
    if (m.direction === "outbound" && m.status === "failed") continue;
    if (m.direction === "outbound") ultimoNostro = piu(ultimoNostro, t);
    else if (m.direction === "inbound" && !eco.has(m)) ultimaEntrataMsg = piu(ultimaEntrataMsg, t);
  }
  const entrata = Math.max(ultimaEntrata || 0, ultimaEntrataMsg || 0);
  //  ── L'ULTIMA PAROLA È DEL CLIENTE (30/10/2026) ───────────────────────────
  //  Se il contatto dice che l'ultimo messaggio della chat è in entrata (e non è un'eco), il
  //  cliente aspetta noi: non è «Da chiamare» a prescindere da quanto tempo è passato e da quanti
  //  nostri messaggi stanno oltre i 7 giorni caricati. Senza questo dato vale il confronto sotto.
  const ult = ms(p.ultimoMessaggio?.il);
  if (
    p.ultimoMessaggio?.direzione === "inbound" &&
    Number.isFinite(ult) &&
    !eEco(ult) &&
    (!Number.isFinite(ultimoNostro) || ult > ultimoNostro)
  )
    return NO;
  //  Se l'ultimo messaggio è del cliente, la palla è nostra («Da rispondere»).
  if (Number.isFinite(ultimoNostro) && entrata > ultimoNostro) return NO;
  const inizio = Math.max(Date.parse(dal), Number.isFinite(ultimoNostro) ? ultimoNostro : 0);
  if (entrata > inizio) return NO;
  if (!giaDaChiamare && p.adesso.getTime() < scadenzaAttesa(inizio, entrata)) return NO;
  return { si: true, dal: inizio === Date.parse(dal) ? dal : new Date(inizio).toISOString() };
}

/** Il numero della scheda nel formato delle chat («+39…»), o "" se non si sa
 *  dire. Serve a far comparire in «Da chiamare» anche chi è stato scritto dal
 *  WhatsApp del telefono e nel CRM non ha ancora una chat. */
export function telefonoE164(t?: string | null): string {
  let c = String(t ?? "").replace(/[^\d+]/g, "");
  if (c.startsWith("00")) c = `+${c.slice(2)}`;
  const cifre = c.replace(/\D/g, "");
  if (cifre.length < 8) return "";
  if (c.startsWith("+")) return `+${cifre}`;
  //  Un cellulare italiano scritto senza prefisso (3xx…, 9-10 cifre).
  if (/^3\d{8,9}$/.test(cifre)) return `+39${cifre}`;
  if (cifre.startsWith("39") && cifre.length >= 11) return `+${cifre}`;
  return "";
}

/** ── LA PILLOLA «DA CHIAMARE» E I SUOI SOTTOFILTRI (28/10/2026) ──────────────
 *  Le chat collegate a un lead il cui stato è uno di questi cinque, in questo
 *  ordine. `attesa_whatsapp` NON c'è: quelli aspettano la risposta del cliente.
 *  Tutto puro, provato in prove/manychat/chat-sottofiltri.mjs. */
export const STATI_SOTTOFILTRI = [
  "da_chiamare",
  "non_risponde",
  "segreteria",
  "richiamo",
  "ci_ricontatta_lui",
] as const;
/** Un numero senza scheda con l'ultimo messaggio più vecchio di così NON è «Da chiamare»
 *  (decisione del titolare, 30/10/2026): resta nella lista «Sconosciuti» e in «Tutte». */
export const GIORNI_SCONOSCIUTI_DA_CHIAMARE = 60;
export type StatoChiamata = (typeof STATI_SOTTOFILTRI)[number];
export type Sottofiltro = "tutti" | StatoChiamata;

/** Gli stati che si scelgono dalla riga (non serve aprire la chat), nell'ordine in cui si usano. */
export const STATI_CAMBIO_RAPIDO = [
  "non_risponde",
  "segreteria",
  "richiamo",
  "ci_ricontatta_lui",
  "appuntamento_fissato",
  "annullato", // «Non interessato»
  "da_chiamare",
] as const;

interface ChatConStato {
  /** finestra di 24 ore (per i numeri senza scheda) */
  finestra?: { aperta: boolean } | null;
  stop?: boolean;
  schedaAmbigua?: boolean;
  /** Se la chat aspetta noi (`c.daRispondere`) NON è «Da chiamare»: una chat o l'una o l'altra. */
  daRispondere?: { attesa?: boolean } | null;
  /** L'ultimo messaggio (per i numeri senza scheda): letto in pagina e/o salvato sul contatto. */
  lastMessage?: { direction: string; body: string | null; created_at: string } | null;
  contact?: {
    ultimo_messaggio_il?: string | null;
    ultimo_messaggio_anteprima?: string | null;
    ultimo_messaggio_direzione?: string | null;
  } | null;
  lead?: {
    data?: {
      stato?: string | null;
      statoDal?: string | null;
      statoPrecedenteIl?: string | null;
    } | null;
  } | null;
}

/** Lo stato di chiamata della chat, o `null` se lo stato è un altro.
 *  ── I NUMERI SENZA SCHEDA (30/10/2026) ───────────────────────────────────
 *  Richiesta del titolare: anche chi non ha la scheda, quando la finestra di
 *  24 ore si chiude, va «da chiamare»; se la setter fissa la consulenza crea
 *  la scheda (la riga ha già «Crea scheda» e «Abbina»). Mai con lo STOP, mai
 *  se i numeri hanno più schede (lì si abbina prima), mai a finestra aperta
 *  o non calcolata. */
export function statoChiamata(c: ChatConStato, adesso: number = Date.now()): StatoChiamata | null {
  //  ── DA RISPONDERE VINCE (regola del titolare, 30/10/2026) ───────────────────
  //  Se l'ultimo messaggio è del cliente la palla è nostra: resta in «Da rispondere», anche a
  //  finestra chiusa e anche dopo giorni. Mai in «Da chiamare» per il solo passare del tempo.
  if (c.daRispondere?.attesa) return null;
  if (!c.lead) {
    if (!(c.finestra?.aperta === false && !c.stop && !c.schedaAmbigua)) return null;
    //  Senza scheda la finestra chiusa non basta: se l'ultimo messaggio è del cliente non lo si
    //  manda a chiamare (tocca rispondere); si chiama chi ha avuto l'ultima parola da parte nostra.
    //  Ultimo messaggio ignoto (nessun dato): come prima.
    const ultimo = ultimoDellaChat(c.lastMessage ?? null, c.contact ?? null);
    if (ultimo?.direction === "inbound") return null;
    //  Chat ferma da più di 60 giorni (qualunque direzione): resta fra gli «Sconosciuti», non si chiama.
    //  Senza data non si sa: come prima. shortcut: `adesso` di default è l'ora del telefono; la
    //  lista lo passa se serve un'ora fissa, cambiarla se l'orologio del telefono diventa un problema.
    const t = Date.parse(String(ultimo?.created_at ?? ""));
    if (Number.isFinite(t) && adesso - t > GIORNI_SCONOSCIUTI_DA_CHIAMARE * 86_400_000) return null;
    return "da_chiamare";
  }
  const s = String(c.lead?.data?.stato ?? "");
  return (STATI_SOTTOFILTRI as readonly string[]).includes(s) ? (s as StatoChiamata) : null;
}

/** Quante chat per sottofiltro; «tutti» è la somma. I chip a zero li nasconde chi disegna. */
export function contaSottofiltri(chats: ChatConStato[]): Record<Sottofiltro, number> {
  const n: Record<Sottofiltro, number> = {
    tutti: 0,
    da_chiamare: 0,
    non_risponde: 0,
    segreteria: 0,
    richiamo: 0,
    ci_ricontatta_lui: 0,
  };
  for (const c of chats) {
    const s = statoChiamata(c);
    if (!s) continue;
    n[s]++;
    n.tutti++;
  }
  return n;
}

/** Dal cambio di stato (ISO) per ordinare; senza data valida = «non si sa», in fondo al suo stato. */
const quandoCambiato = (c: ChatConStato): number => {
  const d = c.lead?.data;
  const t = Date.parse(String(d?.statoDal ?? d?.statoPrecedenteIl ?? ""));
  return Number.isFinite(t) ? t : Infinity;
};

/** Le chat del sottofiltro. «tutti» = un elenco solo, ordinato per stato (nell'ordine di
 *  `STATI_SOTTOFILTRI`) e dentro ogni stato dal cambio di stato più vecchio al più nuovo.
 *  Non muta l'ingresso; la parità resta com'era (sort stabile). */
export function chatDaChiamare<T extends ChatConStato>(chats: T[], sotto: Sottofiltro): T[] {
  return chats
    .filter((c) => {
      const s = statoChiamata(c);
      return s !== null && (sotto === "tutti" || s === sotto);
    })
    .sort((a, b) => {
      const per =
        STATI_SOTTOFILTRI.indexOf(statoChiamata(a)!) - STATI_SOTTOFILTRI.indexOf(statoChiamata(b)!);
      if (per) return per;
      const x = quandoCambiato(a);
      const y = quandoCambiato(b);
      return x === y ? 0 : x < y ? -1 : 1;
    });
}

/** Gli stati che la riga offre per il cambio rapido. La regola del CRM (`statiPer`) a un lead non
 *  «importato» (quelli del modulo) ne ammette pochi, ma chi è GIÀ in uno stato di chiamata (o in
 *  attesa WhatsApp / da contattare) sta lavorando proprio quella telefonata: deve poter scegliere
 *  tutti e sette. Per gli altri stati resta `statiPer`, che qui arriva come `ammessi`. */
export function statiMenuRiga(
  statoAttuale: string | null | undefined,
  ammessi: ReadonlySet<string>,
): (typeof STATI_CAMBIO_RAPIDO)[number][] {
  const inChiamata =
    (STATI_SOTTOFILTRI as readonly string[]).includes(String(statoAttuale)) ||
    statoAttuale === "attesa_whatsapp" ||
    statoAttuale === "da_contattare";
  return STATI_CAMBIO_RAPIDO.filter((s) => inChiamata || ammessi.has(s));
}

/** La pastiglia della finestra di 24 ore nelle righe di «Da chiamare» (29/10/2026).
 *  Senza dati sulla finestra niente pastiglia (meglio niente che un verde falso). */
export function pastigliaFinestra(
  f: { aperta: boolean; frase: string } | undefined | null,
): { aperta: boolean; testo: string; titolo: string } | null {
  if (!f) return null;
  return f.aperta
    ? { aperta: true, testo: "Si può scrivere", titolo: f.frase || "Finestra di 24 ore aperta" }
    : {
        aperta: false,
        testo: "Finestra chiusa",
        titolo: f.frase || "Passate 24 ore: serve un modello approvato",
      };
}
