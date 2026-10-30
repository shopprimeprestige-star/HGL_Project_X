/** ── PONTE WHATSAPP · INVIO A MANO: LE REGOLE PURE ───────────────────────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T2 (PIANO.md §3.2). Le
 *  regole che il server (rotte e porte, T5) e la chat (T6, T4) condividono:
 *  chi può mettere un testo in coda e in che ordine si rifiuta, la frase di ogni
 *  motivo, gli stati visti dal browser, il riprova, la vista della coda senza
 *  doppioni e la lettura dei tre corpi JSON.
 *
 *  Tutto puro: nessun database, nessun orologio (l'ora arriva da fuori),
 *  nessuna eccezione sui dati storti (si risponde «no», mai si lancia).
 *
 *  ⚠️ «Ha già una chat» e STOP NON si leggono qui: li dà la funzione SQL
 *   `ponte_wa_invio_fatti` (`FattiInvio`). Qui si decide, non si legge.
 *  ⚠️ Niente testo dei messaggi né numeri nei log: questo file non scrive log.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  LIMITI_INVIO,
  MOTIVI_INVIO,
  type CorpoEsito,
  type CorpoPrendi,
  type FattiInvio,
  type MotivoInvio,
  type MotivoRifiuto,
  type RichiestaBrowser,
  type RigaCoda,
  type StatoCoda,
} from "./invio-tipi";
import { normalizzaTesto } from "./pari";
import { CANALE_PONTE, LIMITI, TS_MINIMO, chiaveMessaggio, cifre } from "./tipi";

const L = LIMITI_INVIO;
const MIN_MS = 60_000;
/** Un'eco più vecchia del prelievo di così è di un altro messaggio. */
const TOLLERANZA_ECO_MS = 60_000;

// ── Piccoli aiuti ─────────────────────────────────────────────────────────

const oggetto = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHIAVE = /^[A-Za-z0-9_-]+$/;
const ID_WA = /^[A-Za-z0-9_.-]{1,128}$/;

/** Una metà di coppia surrogata senza l'altra metà. */
const SURROGATA_SOLA = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Senza `\u0000` e con le surrogate isolate cambiate in `�` (Postgres
 *  rifiuta entrambi nel testo). NON taglia: oltre il limite è un rifiuto. */
const pulisci = (v: string): string => v.split("\u0000").join("").replace(SURROGATA_SOLA, "�");

/** I caratteri come li conta Postgres (`char_length`): punti di codice, non
 *  unità UTF-16. Se le unità sono più del doppio del limite, i punti lo
 *  superano di certo: niente da spezzare. */
function lungo(testo: string): boolean {
  if (testo.length > 2 * L.caratteri) return true;
  return [...testo].length > L.caratteri;
}

const ms = (iso: string | null | undefined): number =>
  typeof iso === "string" ? Date.parse(iso) : NaN;

// ── Il numero ─────────────────────────────────────────────────────────────

/** Solo cifre, 8-15; altrimenti `null`. Accetta «+», spazi, trattini e parentesi
 *  nel numero scritto a mano; un gruppo (`…@g.us`), un `@lid`, delle lettere o
 *  un percorso NON passano (non si estraggono le cifre da un identificativo). */
export function normalizzaNumero(x: unknown): string | null {
  if (typeof x !== "string") return null;
  if (/[^\d\s+().-]/.test(x)) return null;
  const n = cifre(x);
  return n.length >= 8 && n.length <= 15 ? n : null;
}

// ── Il ponte è collegato adesso? ──────────────────────────────────────────

/** Stessa regola di `avvisoPonte`: `stato` `collegato` e battito entro
 *  `ponteFrescoMs` (un battito «nel futuro» per l'orologio indietro è fresco);
 *  poi l'interruttore del Mac. Un ponte che non dichiara `invii_attivi` (versione
 *  vecchia) NON invia: si legge come spento. */
export function ponteCollegato(
  ponte: { stato: string; aggiornato_il: string; invii_attivi?: boolean } | null,
  adesso: Date,
): { ok: true } | { ok: false; motivo: "ponte_non_collegato" | "invii_spenti" } {
  const battito = ms(ponte?.aggiornato_il);
  const ora = adesso.getTime();
  if (!ponte || ponte.stato !== "collegato" || !Number.isFinite(battito) || !Number.isFinite(ora)) {
    return { ok: false, motivo: "ponte_non_collegato" };
  }
  if (ora - battito > L.ponteFrescoMs) return { ok: false, motivo: "ponte_non_collegato" };
  if (ponte.invii_attivi !== true) return { ok: false, motivo: "invii_spenti" };
  return { ok: true };
}

// ── Chi può accodare ──────────────────────────────────────────────────────

/** In ordine: testo vuoto → testo lungo → numero non valido → ponte non
 *  collegato / invii spenti → STOP → mai scritto → limite giornaliero → coda
 *  piena. Il primo che scatta vince. */
export function controllaAccodamento(i: {
  testo: string;
  numero: string;
  fatti: FattiInvio;
  adesso: Date;
}): { ok: true } | { ok: false; motivo: MotivoRifiuto } {
  const no = (motivo: MotivoRifiuto) => ({ ok: false as const, motivo });
  const testo = typeof i.testo === "string" ? i.testo : "";
  if (testo.trim() === "") return no("testo_vuoto");
  if (lungo(testo)) return no("testo_lungo");
  if (normalizzaNumero(i.numero) === null) return no("numero_non_valido");

  const f: Partial<FattiInvio> = oggetto(i.fatti) ? i.fatti : {};
  const ponte =
    f.ponte_stato && f.ponte_battito
      ? {
          stato: f.ponte_stato,
          aggiornato_il: f.ponte_battito,
          invii_attivi: f.invii_attivi === true,
        }
      : null;
  const coll = ponteCollegato(ponte, i.adesso);
  if (!coll.ok) return no(coll.motivo);
  if (f.stop === true) return no("stop");
  if (f.entrata !== true) return no("mai_scritto");
  if ((f.ultime24h ?? 0) >= L.alGiorno) return no("limite_giornaliero");
  if ((f.in_coda ?? 0) >= L.inCodaMax) return no("coda_piena");
  return { ok: true };
}

// ── Le frasi ──────────────────────────────────────────────────────────────

/** Il tasto di conferma di un invio incerto (vale per la bolla e per la rotta). */
export const FRASE_CONFERMA_INCERTO =
  "Potrebbe essere già partito. Guarda il telefono. Riprovare lo stesso?";

const FRASI: Record<MotivoInvio | MotivoRifiuto, string> = {
  mai_scritto: "Questo cliente non ci ha mai scritto: non posso mandargli un messaggio libero.",
  stop: "Questo cliente ha chiesto di non essere più contattato.",
  scaduto: `Non è partito entro ${L.scadenzaMin} minuti: il Mac era spento o occupato.`,
  non_collegato: "WhatsApp non era collegato sul Mac: il messaggio non è partito.",
  numero_non_valido: "Il numero di telefono non è valido.",
  testo_non_valido: `Il testo non è valido: scrivi da 1 a ${L.caratteri} caratteri.`,
  limite_ponte: "Hai raggiunto il limite di messaggi dal telefono: riprova più tardi.",
  esito_incerto: "Non so se è partito: guarda sul telefono prima di riprovare.",
  errore_invio: "Il messaggio non è partito per un problema di invio. Puoi riprovare.",
  testo_vuoto: "Scrivi un messaggio prima di inviare.",
  testo_lungo: `Il messaggio è troppo lungo: al massimo ${L.caratteri} caratteri.`,
  ponte_non_collegato: "WhatsApp sul Mac non risponde in questo momento: riprova tra poco.",
  invii_spenti: "L'invio dal telefono non è attivo sul Mac.",
  limite_giornaliero: `Hai già mandato ${L.alGiorno} messaggi dal telefono nelle ultime ${L.giornoOre} ore: riprova più tardi.`,
  coda_piena: `Ci sono già ${L.inCodaMax} messaggi in attesa: aspetta che partano.`,
  non_autorizzato: "Non hai il permesso di mandare questo messaggio.",
  non_riprovabile: "Questo messaggio non si può rimandare. Guarda sul telefono se è già partito.",
};

const FRASE_GENERICA = "Il messaggio non è partito.";

/** La frase per il titolare, senza gergo. Un motivo che non conosce → frase generica. */
export function fraseMotivo(m: MotivoInvio | MotivoRifiuto | string | null | undefined): string {
  return typeof m === "string" && Object.hasOwn(FRASI, m)
    ? FRASI[m as MotivoInvio | MotivoRifiuto]
    : FRASE_GENERICA;
}

// ── Gli stati ─────────────────────────────────────────────────────────────

/** Il riprova (D10): `stop` e `mai_scritto` mai; `esito_incerto` solo con la
 *  conferma di una persona; ogni altro `non_inviato` sì; le altre fasi no.
 *  Un `non_inviato` senza motivo si legge come `errore_invio`. */
function regolaRiprova(
  stato: StatoCoda,
  motivo: string | null,
): { ok: true; serveConferma: boolean } | { ok: false; motivo: "non_riprovabile" } {
  if (stato !== "non_inviato") return { ok: false, motivo: "non_riprovabile" };
  if (motivo === "stop" || motivo === "mai_scritto")
    return { ok: false, motivo: "non_riprovabile" };
  return { ok: true, serveConferma: motivo === "esito_incerto" };
}

/** Come il prelievo svuoterebbe la riga: `in_attesa` oltre `scadenzaMin` →
 *  scaduta; `in_invio` oltre `incertoMin` → esito incerto. Per la sola lettura:
 *  se il Mac è spento il prelievo non gira e la riga resterebbe «in invio». */
function faseVista(riga: RigaCoda, adesso: Date): { stato: StatoCoda; motivo: string | null } {
  const ora = adesso.getTime();
  if (riga.stato === "in_attesa") {
    const da = ms(riga.created_at);
    if (Number.isFinite(da) && Number.isFinite(ora) && ora - da > L.scadenzaMin * MIN_MS) {
      return { stato: "non_inviato", motivo: "scaduto" };
    }
  }
  if (riga.stato === "in_invio") {
    const da = ms(riga.preso_il ?? riga.created_at);
    if (Number.isFinite(da) && Number.isFinite(ora) && ora - da > L.incertoMin * MIN_MS) {
      return { stato: "non_inviato", motivo: "esito_incerto" };
    }
  }
  if (riga.stato === "non_inviato")
    return { stato: "non_inviato", motivo: riga.motivo ?? "errore_invio" };
  return { stato: riga.stato, motivo: null };
}

/** La riga come la vede la chat: fase, motivo, frase, se si può riprovare e se
 *  l'esito è incerto. */
export function statoVisibile(
  riga: RigaCoda,
  adesso: Date,
): {
  fase: StatoCoda;
  motivo: string | null;
  frase: string;
  puoRiprovare: boolean;
  incerto: boolean;
} {
  const v = faseVista(riga, adesso);
  const frase =
    v.stato === "non_inviato"
      ? fraseMotivo(v.motivo)
      : v.stato === "inviato"
        ? "Inviato dal telefono"
        : "In invio dal telefono…";
  return {
    fase: v.stato,
    motivo: v.motivo,
    frase,
    puoRiprovare: regolaRiprova(v.stato, v.motivo).ok,
    incerto: v.stato === "non_inviato" && v.motivo === "esito_incerto",
  };
}

export function puoRiprovare(
  riga: RigaCoda,
): { ok: true; serveConferma: boolean } | { ok: false; motivo: "non_riprovabile" } {
  return regolaRiprova(riga.stato, riga.motivo);
}

// ── La coda senza doppioni ────────────────────────────────────────────────

/** Le righe da mostrare, dal più vecchio. Toglie: le `inviato` la cui riga
 *  `bw:<numero>:<id>` è già fra i messaggi, e quelle in vista da più di
 *  `nascostoDopoS` secondi; le `non_inviato · esito_incerto` (anche quelle che
 *  lo diventano a vista) per cui è arrivata l'eco del ponte con lo stesso testo
 *  dopo il prelievo (era partito). Un'eco toglie UNA sola riga: lo stesso testo
 *  mandato due volte, con una sola eco, lascia una bolla. */
export function vistaCoda(
  righe: RigaCoda[],
  messaggi: {
    wa_message_id: string | null;
    direction: string;
    body: string | null;
    created_at: string;
    canale: string | null;
  }[],
  adesso: Date,
): RigaCoda[] {
  const ora = adesso.getTime();
  const chiavi = new Set(messaggi.map((m) => m.wa_message_id).filter((k): k is string => !!k));
  const proprie = new Set(
    righe
      .filter((r) => r.stato === "inviato" && r.wa_message_id)
      .map((r) => chiaveMessaggio(r.numero, r.wa_message_id as string)),
  );
  //  L'eco di una riga `inviato` ha già la sua riga: non serve a togliere altro.
  const eco = messaggi
    .filter(
      (m) =>
        m.direction === "outbound" &&
        m.canale === CANALE_PONTE &&
        !(m.wa_message_id && proprie.has(m.wa_message_id)),
    )
    .map((m) => ({ testo: normalizzaTesto(m.body), t: ms(m.created_at), usata: false }));

  const ordinate = [...righe].sort((a, b) => ms(a.created_at) - ms(b.created_at));
  const fuori = new Set<RigaCoda>();
  for (const r of ordinate) {
    if (r.stato === "inviato") {
      const dal = ms(r.inviato_il ?? r.created_at);
      const vecchia =
        Number.isFinite(dal) && Number.isFinite(ora) && ora - dal > L.nascostoDopoS * 1000;
      if ((r.wa_message_id && chiavi.has(chiaveMessaggio(r.numero, r.wa_message_id))) || vecchia)
        fuori.add(r);
      continue;
    }
    const v = faseVista(r, adesso);
    if (v.stato === "non_inviato" && v.motivo === "esito_incerto") {
      const da = ms(r.preso_il ?? r.created_at) - TOLLERANZA_ECO_MS;
      const testo = normalizzaTesto(r.testo);
      const trovata = eco.find((e) => !e.usata && e.testo === testo && e.t >= da);
      if (trovata) {
        trovata.usata = true;
        fuori.add(r);
      }
    }
  }
  return ordinate.filter((r) => !fuori.has(r));
}

// ── La lettura dei corpi JSON ─────────────────────────────────────────────

/** Il corpo della rotta del browser. `testo` si ripulisce ma NON si taglia: oltre
 *  i 2000 caratteri è `testo_lungo`. Una forma storta (azione, chiave, id) è
 *  `corpo_non_valido`. */
export function leggiRichiestaBrowser(
  json: unknown,
): { ok: true; r: RichiestaBrowser } | { ok: false; motivo: MotivoRifiuto | "corpo_non_valido" } {
  const no = (motivo: MotivoRifiuto | "corpo_non_valido") => ({ ok: false as const, motivo });
  if (!oggetto(json)) return no("corpo_non_valido");
  if (json.azione === "accoda") {
    const chiave = json.chiave;
    if (
      typeof chiave !== "string" ||
      chiave.length < L.chiaveMin ||
      chiave.length > L.chiaveMax ||
      !CHIAVE.test(chiave)
    ) {
      return no("corpo_non_valido");
    }
    const testo = typeof json.testo === "string" ? pulisci(json.testo) : "";
    if (testo.trim() === "") return no("testo_vuoto");
    if (lungo(testo)) return no("testo_lungo");
    const numero = normalizzaNumero(json.numero);
    if (numero === null) return no("numero_non_valido");
    return { ok: true, r: { azione: "accoda", numero, testo, chiave } };
  }
  if (json.azione === "riprova") {
    if (typeof json.id !== "string" || !UUID.test(json.id)) return no("corpo_non_valido");
    return {
      ok: true,
      r:
        json.confermaIncerto === true
          ? { azione: "riprova", id: json.id, confermaIncerto: true }
          : { azione: "riprova", id: json.id },
    };
  }
  return no("corpo_non_valido");
}

/** Il `prendi` del Mac: nient'altro che `{v:1, tipo:"prendi"}` (l'utente viene
 *  sempre dal database, mai dal corpo). `null` = corpo non valido. */
export function leggiPrendi(json: unknown): CorpoPrendi | null {
  return oggetto(json) && json.v === 1 && json.tipo === "prendi" ? { v: 1, tipo: "prendi" } : null;
}

/** L'`esito` del Mac. `inviato` vuole un `wa_id` valido (serve a comporre la
 *  chiave `bw:`); `errore` porta il motivo, se è della lista, altrimenti
 *  `errore_invio`. Il `ts` (secondi UNIX interi fra `TS_MINIMO` e adesso + 10
 *  minuti) se non torna si SCARTA e l'esito resta: perderlo sarebbe peggio, il
 *  Mac lo ritenterebbe all'infinito e il server usa comunque la sua ora.
 *  `null` = corpo non valido. */
export function leggiEsito(json: unknown, adesso: Date): CorpoEsito | null {
  if (!oggetto(json) || json.v !== 1 || json.tipo !== "esito") return null;
  if (typeof json.id !== "string" || !UUID.test(json.id)) return null;
  if (json.esito === "errore") {
    const m = json.motivo;
    const motivo =
      typeof m === "string" && (MOTIVI_INVIO as readonly string[]).includes(m) ? m : "errore_invio";
    return { v: 1, tipo: "esito", id: json.id, esito: "errore", motivo };
  }
  if (json.esito !== "inviato") return null;
  if (typeof json.wa_id !== "string" || !ID_WA.test(json.wa_id)) return null;
  const e: CorpoEsito = { v: 1, tipo: "esito", id: json.id, esito: "inviato", wa_id: json.wa_id };
  const massimo = Math.floor(adesso.getTime() / 1000) + LIMITI.tsOltreMinuti * 60;
  if (
    typeof json.ts === "number" &&
    Number.isInteger(json.ts) &&
    json.ts >= TS_MINIMO &&
    json.ts <= massimo
  )
    e.ts = json.ts;
  return e;
}
