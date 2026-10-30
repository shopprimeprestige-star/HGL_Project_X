/** ── LA LOGICA DELLE ROTTE DEL RIQUADRO E DEL CAMBIO A MANO ────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 4 (Dev B). Le rotte
 *  `api.crm.manychat.ts` e `api.crm.contatto-wa.ts` sono sottili: leggono la
 *  richiesta, passano da `guardiaCRM` e chiamano questo modulo, che NON conosce
 *  né il database né `fetch`. Il database arriva da `pannello.server.ts`, il
 *  client di ManyChat da `api.ts`: così si prova tutto con un ManyChat finto e
 *  un database finto (`prove/manychat/pannello.mjs`).
 *
 *  Il contratto con il browser è in `client-crm.ts` (tabella in testa).
 *
 *  ⚠️ NIENTE DI QUI DENTRO MANDA UN MESSAGGIO. Le prove di collegamento e di
 *   creazione contatto fanno solo letture e, al più, `createSubscriber`.
 *  ⚠️ NESSUN NUMERO DI TELEFONO nelle risposte, nei problemi del giro, nei
 *   log. Il numero del titolare per la prova di creazione non si salva da
 *   nessuna parte: qui non c'è nemmeno una porta per farlo.
 *  ⚠️ I tetti si possono solo ABBASSARE: qualunque valore si riporta alle
 *   costanti di `quando.ts` (lo fa anche l'SQL, qui è la prima difesa).
 *
 *  Commessa 2026-10-25 (compito P): in più due interruttori (lead nuovo, giorno
 *  del meet), uno per ogni stato con un messaggio, la data della frase del
 *  consenso nel modulo Meta (`controlli.fraseModulo`), l'indirizzo della sede, il
 *  tetto dei lead nuovi e la riga «Foglio Google».
 *  ⚠️ «Lead nuovo» non si accende senza la data della frase (`controllaComando`):
 *   senza, `consensoModulo` non vale per nessuno.
 *  ⚠️ Nessun nome, numero o id del foglio: il riquadro vede solo ora ed esito.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Consultant, ContattoWa, LeadData } from "../types";
import { aRoma } from "../promemoria/formati";
import type { ClientManychat } from "./api";
import type {
  CanaleManychat,
  CollegamentoManychat,
  ConfigManychat,
  FoglioManychat,
  FraseModulo,
  GiroManychat,
  ProblemaGiro,
  ProvaASecco,
  ProvaCreazione,
  RigaCollegamento,
  RigaProva,
  StatoManychat,
} from "./client-crm";
import {
  STATI_CONTATTO,
  applicaCambio,
  cambioAMano,
  istanteDiRoma,
  type CambioContatto,
  type StatoContatto,
} from "./contatto";
import { decisioniDelGiro, righeDiProva, sceltaDaConfig } from "./giro";
import { TETTO_RICONTATTI, TETTO_TOTALE, tettiDelGiorno, type SchedaQuando } from "./quando";
import {
  STATI_ARRIVATI,
  TIPI_AUTOMATICI,
  TIPI_NEI_TETTI,
  numeroWa,
  type InvioPerFreno,
} from "./regole";
import { TETTO_RIGHE_GIORNO } from "../sheets/ingresso";
import {
  MODELLI_FLUSSO,
  MODELLI_FLUSSO_SEQUENZE,
  STATI_ACCENDIBILI,
  STATI_RIQUADRO,
  TETTO_LEAD_NUOVI,
  leggiGiornoFrase,
  leggiIndirizzo,
  quandoBreve,
  statiDiRiga,
} from "./vista-pannello";

/* ═══════════════════════════════════════════════════════════════════════════
   1. LA CONFIGURAZIONE (`manychat_config`, riga unica)
   ═════════════════════════════════════════════════════════════════════════ */

/** La riga di `manychat_config` come arriva dal database (`select *`: se una
 *  colonna manca, qui è `undefined`). */
export interface RigaConfig {
  user_id?: string | null;
  canale?: string | null;
  acceso?: boolean | null;
  promemoria?: boolean | null;
  ricontatti?: boolean | null;
  tetti?: unknown;
  flussi?: unknown;
  prima_accensione?: string | null;
  ultima_accensione?: string | null;
  fermato_motivo?: string | null;
  /** colonne della migrazione S2 (`20261025120100_manychat_sequenze.sql`): se
   *  mancano sono `undefined` e le sequenze restano chiuse */
  lead_nuovo?: boolean | null;
  giorno_meet?: boolean | null;
  lead_nuovo_dal?: string | null;
  stati?: unknown;
  indirizzo_sede?: string | null;
  /** l'ultimo «Collegamento ok» e l'esito della prova di creazione contatto
   *  (colonna della migrazione `20261023120150_manychat_pannello.sql`) */
  controlli?: unknown;
}

const comeIntero = (v: unknown, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.floor(v)))
    : undefined;

/** Il tetto scelto nel riquadro, mai sopra la costante. */
function tettiDaDb(v: unknown): ConfigManychat["tetti"] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const t: ConfigManychat["tetti"] = {};
  const r = comeIntero(o.ricontatti, TETTO_RICONTATTI);
  const tot = comeIntero(o.totale, TETTO_TOTALE);
  const ln = comeIntero(o.leadNuovi, TETTO_LEAD_NUOVI);
  if (r !== undefined) t.ricontatti = r;
  if (ln !== undefined) t.leadNuovi = ln;
  if (tot !== undefined) t.totale = tot;
  return t;
}

/** Gli stati accesi: solo nomi veri (mai «Ricontatto fissato», che è `ricontatti`)
 *  con un'ora che si legge. */
function statiDaDb(v: unknown): Record<string, string> {
  const fuori: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v))
    for (const [stato, il] of Object.entries(v as Record<string, unknown>))
      if (
        (STATI_ACCENDIBILI as string[]).includes(stato) &&
        typeof il === "string" &&
        Number.isFinite(Date.parse(il))
      )
        fuori[stato] = il;
  return fuori;
}

function flussiDaDb(v: unknown): Record<string, string> {
  const f: Record<string, string> = {};
  if (v && typeof v === "object")
    for (const [nome, ns] of Object.entries(v as Record<string, unknown>))
      if (typeof ns === "string" && ns.trim()) f[nome] = ns.trim();
  return f;
}

/** La configurazione è di un'ALTRA installazione? (`user_id` già scritto e
 *  diverso da quello della sessione.) Vera = la rotta risponde 403 e non scrive:
 *  altrimenti `scriviConfig` riscriverebbe `user_id`. Una riga senza `user_id`
 *  (mai scritta) non è di nessun altro. */
export function configDiAltraInstallazione(
  riga: Pick<RigaConfig, "user_id"> | null | undefined,
  userId: string,
): boolean {
  return !!riga?.user_id && riga.user_id !== userId;
}

/** La riga del database → la configurazione che vede il riquadro. Senza riga:
 *  canale `cloud` e tutto spento (la porta resta come prima). */
export function configDaRiga(
  r: RigaConfig | null | undefined,
  /** senza riga lo dice il server (sa se le colonne di S2 ci sono); con la riga
   *  si vede dalle colonne */
  sequenze?: boolean,
): ConfigManychat {
  return {
    canale: r?.canale === "manychat" ? "manychat" : "cloud",
    acceso: r?.acceso === true,
    promemoria: r?.promemoria === true,
    ricontatti: r?.ricontatti === true,
    leadNuovo: r?.lead_nuovo === true,
    giornoMeet: r?.giorno_meet === true,
    leadNuovoDal: r?.lead_nuovo_dal ?? null,
    stati: statiDaDb(r?.stati),
    indirizzoSede: r?.indirizzo_sede?.trim() || null,
    sequenze: sequenze ?? r?.lead_nuovo !== undefined,
    tetti: tettiDaDb(r?.tetti),
    flussi: flussiDaDb(r?.flussi),
    primaAccensione: r?.prima_accensione ?? null,
    ultimaAccensione: r?.ultima_accensione ?? null,
    fermatoMotivo: r?.fermato_motivo ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. I COMANDI (POST /api/crm/manychat)
   ═════════════════════════════════════════════════════════════════════════ */

/** Gli interruttori che il riquadro sa girare, con la colonna di `manychat_config`. */
const INTERRUTTORI = {
  acceso: "acceso",
  promemoria: "promemoria",
  ricontatti: "ricontatti",
  leadNuovo: "lead_nuovo",
  giornoMeet: "giorno_meet",
} as const;
type NomeInterruttore = keyof typeof INTERRUTTORI;

export type ComandoConfig =
  | {
      tipo: "interruttori";
      valori: Partial<Record<NomeInterruttore, boolean>>;
    }
  | { tipo: "tetti"; valori: { ricontatti?: number; totale?: number; leadNuovi?: number } }
  | { tipo: "flussi"; valori: Record<string, string> }
  | { tipo: "canale"; valore: CanaleManychat }
  | { tipo: "stati"; valori: Record<string, boolean> }
  | { tipo: "indirizzo_sede"; valore: string };

export type Comando =
  | ComandoConfig
  | { tipo: "frase_modulo"; giorno: string }
  | { tipo: "prova_a_secco" }
  | { tipo: "prova_collegamento" }
  | { tipo: "prova_creazione_contatto"; telefono: string };

export type LettoComando = { ok: true; comando: Comando } | { ok: false; errore: string };

const NS_VALIDO = /^[A-Za-z0-9_.:-]{1,120}$/;
const MODELLO_VALIDO = /^[A-Za-z0-9_]{1,64}$/;
/** shortcut: al massimo 30 modelli con un flusso; ce ne sono 3 più quelli della
 *  chat e del webinar. Alzare se un giorno non bastano. */
const MAX_FLUSSI = 30;

const no = (errore: string): LettoComando => ({ ok: false, errore });

/** Legge e controlla il corpo: UN comando per volta, con i tipi giusti. Tutto
 *  quello che non si riconosce è un 400 (la frase è per chi scrive la rotta,
 *  il riquadro mostra la sua). */
export function leggiComando(body: unknown): LettoComando {
  if (!body || typeof body !== "object" || Array.isArray(body)) return no("Richiesta non valida.");
  const b = body as Record<string, unknown>;
  //  La prova di creazione porta due chiavi (`azione` e `telefono`): il numero
  //  lo controlla `provaCreazione`, qui basta che ci sia ed entri in un testo.
  if (b.azione === "prova_creazione_contatto") {
    if (typeof b.telefono !== "string" || !b.telefono.trim() || b.telefono.length > 40)
      return no("Scrivi il tuo numero con il prefisso, ad esempio +39 333 1234567.");
    return { ok: true, comando: { tipo: "prova_creazione_contatto", telefono: b.telefono } };
  }
  const chiavi = Object.keys(b).filter((k) => b[k] !== undefined);
  if (chiavi.length !== 1) return no("Un comando per volta.");
  const chiave = chiavi[0];
  const v = b[chiave];

  if (chiave === "canale") {
    return v === "cloud" || v === "manychat"
      ? { ok: true, comando: { tipo: "canale", valore: v } }
      : no("Il canale è «cloud» o «manychat».");
  }

  if (chiave === "interruttori") {
    const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
    if (!o) return no("Interruttori non validi.");
    const valori: Partial<Record<NomeInterruttore, boolean>> = {};
    for (const k of Object.keys(INTERRUTTORI) as NomeInterruttore[]) {
      if (o[k] === undefined) continue;
      if (typeof o[k] !== "boolean") return no("Gli interruttori sono acceso o spento.");
      valori[k] = o[k] as boolean;
    }
    return Object.keys(valori).length
      ? { ok: true, comando: { tipo: "interruttori", valori } }
      : no("Nessun interruttore da cambiare.");
  }

  if (chiave === "tetti") {
    const o = (v && typeof v === "object" ? v : null) as Record<string, unknown> | null;
    if (!o) return no("Tetti non validi.");
    const valori: { ricontatti?: number; totale?: number; leadNuovi?: number } = {};
    for (const k of ["ricontatti", "totale", "leadNuovi"] as const) {
      if (o[k] === undefined) continue;
      const n = o[k];
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1)
        return no("Un tetto è un numero intero, da 1 in su.");
      valori[k] = n;
    }
    return Object.keys(valori).length
      ? { ok: true, comando: { tipo: "tetti", valori } }
      : no("Nessun tetto da cambiare.");
  }

  if (chiave === "flussi") {
    const o = (v && typeof v === "object" && !Array.isArray(v) ? v : null) as Record<
      string,
      unknown
    > | null;
    if (!o || Object.keys(o).length === 0) return no("Flussi non validi.");
    if (Object.keys(o).length > MAX_FLUSSI) return no("Troppi flussi.");
    const valori: Record<string, string> = {};
    for (const [modello, ns] of Object.entries(o)) {
      if (!MODELLO_VALIDO.test(modello)) return no("Nome del modello non valido.");
      if (typeof ns !== "string") return no("L'identificativo del flusso è un testo.");
      const pulito = ns.trim();
      if (pulito !== "" && !NS_VALIDO.test(pulito))
        return no("Identificativo del flusso non valido: niente spazi, al massimo 120 caratteri.");
      valori[modello] = pulito;
    }
    return { ok: true, comando: { tipo: "flussi", valori } };
  }

  if (chiave === "stati") {
    const o = (v && typeof v === "object" && !Array.isArray(v) ? v : null) as Record<
      string,
      unknown
    > | null;
    if (!o || Object.keys(o).length === 0) return no("Stati non validi.");
    const valori: Record<string, boolean> = {};
    for (const [stato, acceso] of Object.entries(o)) {
      if (stato === "da_ricontattare")
        return no("«Ricontatto fissato» si accende con «Ricontatti dei consulenti».");
      if (!(STATI_ACCENDIBILI as string[]).includes(stato)) return no("Stato sconosciuto.");
      if (typeof acceso !== "boolean") return no("Gli stati sono accesi o spenti.");
      valori[stato] = acceso;
    }
    return { ok: true, comando: { tipo: "stati", valori } };
  }

  if (chiave === "fraseModulo") {
    const giorno = (v as { giorno?: unknown } | null)?.giorno;
    if (
      typeof giorno !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(giorno) ||
      !istanteDiRoma(giorno, "00:00")
    )
      return no("Scegli il giorno in cui hai aggiunto la frase al modulo.");
    return { ok: true, comando: { tipo: "frase_modulo", giorno } };
  }

  if (chiave === "indirizzoSede") {
    if (typeof v !== "string") return no("L'indirizzo è un testo.");
    const letto = leggiIndirizzo(v);
    return letto.ok
      ? { ok: true, comando: { tipo: "indirizzo_sede", valore: letto.valore } }
      : no(letto.errore);
  }

  if (chiave === "azione") {
    if (v === "prova_a_secco") return { ok: true, comando: { tipo: "prova_a_secco" } };
    if (v === "prova_collegamento") return { ok: true, comando: { tipo: "prova_collegamento" } };
    return no("Azione sconosciuta.");
  }

  return no("Comando sconosciuto.");
}

/** Le colonne da scrivere in `manychat_config` per un comando. Funzione pura:
 *  `prima` è la riga di adesso (o `null`), `adesso` l'ora del server.
 *
 *  Le date di accensione:
 *   · `prima_accensione` — la PRIMA volta che qualcosa si accende; non si sposta
 *     più (la «prima settimana» a 10 ricontatti non riparte con uno
 *     spegni-accendi);
 *   · `ultima_accensione` — ogni volta che si accende il generale o i
 *     ricontatti: le date di ricontatto più vecchie non partono mai. Il
 *     promemoria non la sposta (non c'entra con le date dei ricontatti).
 *  Riaccendere ciò che è già acceso non scrive niente. */
export function patchDaComando(
  prima: RigaConfig | null | undefined,
  c: ComandoConfig,
  adesso: Date,
): Record<string, unknown> {
  const ora = adesso.toISOString();
  const attuale = configDaRiga(prima);

  if (c.tipo === "canale") return { canale: c.valore };

  if (c.tipo === "tetti") {
    const r = c.valori.ricontatti ?? attuale.tetti.ricontatti;
    const tot = c.valori.totale ?? attuale.tetti.totale;
    const ln = c.valori.leadNuovi ?? attuale.tetti.leadNuovi;
    return {
      tetti: {
        ...(r !== undefined ? { ricontatti: Math.min(TETTO_RICONTATTI, r) } : {}),
        ...(tot !== undefined ? { totale: Math.min(TETTO_TOTALE, tot) } : {}),
        ...(ln !== undefined ? { leadNuovi: Math.min(TETTO_LEAD_NUOVI, ln) } : {}),
      },
    };
  }

  if (c.tipo === "indirizzo_sede")
    return c.valore === (attuale.indirizzoSede ?? "") ? {} : { indirizzo_sede: c.valore || null };

  //  Un interruttore per stato: accendere scrive l'ora (le schede in quello stato
  //  da prima non ricevono niente), spegnere la toglie. Riaccendere ciò che è già
  //  acceso non sposta l'ora. Gli stati con la stessa etichetta si muovono insieme.
  if (c.tipo === "stati") {
    const stati = { ...attuale.stati };
    let cambiato = false;
    for (const [stato, acceso] of Object.entries(c.valori)) {
      const riga = STATI_RIQUADRO.find((r) => (statiDiRiga(r) as string[]).includes(stato));
      for (const k of riga ? statiDiRiga(riga) : [stato]) {
        if (acceso && !stati[k]) stati[k] = ora;
        else if (!acceso && stati[k]) delete stati[k];
        else continue;
        cambiato = true;
      }
    }
    return cambiato ? { stati } : {};
  }

  if (c.tipo === "flussi") {
    const f = { ...attuale.flussi };
    for (const [modello, ns] of Object.entries(c.valori)) {
      if (ns) f[modello] = ns;
      else delete f[modello];
    }
    return { flussi: f };
  }

  const p: Record<string, unknown> = {};
  const accesi: string[] = [];
  for (const k of Object.keys(INTERRUTTORI) as NomeInterruttore[]) {
    const nuovo = c.valori[k];
    if (nuovo === undefined || nuovo === attuale[k]) continue;
    p[INTERRUTTORI[k]] = nuovo;
    if (!nuovo) continue;
    //  Le date di accensione dei ricontatti e della prima settimana non c'entrano
    //  con le sequenze nuove; «Lead nuovo» ha la sua (`lead_nuovo_dal`).
    if (k === "leadNuovo") p.lead_nuovo_dal = ora;
    else if (k !== "giornoMeet") accesi.push(k);
  }
  if (accesi.length) {
    if (!attuale.primaAccensione) p.prima_accensione = ora;
    if (accesi.includes("acceso") || accesi.includes("ricontatti")) p.ultima_accensione = ora;
    if (accesi.includes("acceso")) p.fermato_motivo = null;
  }
  return p;
}

/** Un comando rifiutato prima di scrivere: lo stato HTTP e la frase per chi legge. */
export interface Rifiuto {
  stato: number;
  errore: string;
}

const FRASE_S2 =
  "Manca l'aggiornamento del database (le sequenze WhatsApp): questo comando non si può ancora salvare.";
const FRASE_SENZA_FRASE =
  "Prima segna la data della frase nel modulo Meta: senza, i consensi dei moduli non valgono e «Lead nuovo» non può partire.";

/** Il comando ha bisogno delle colonne della migrazione S2? */
function richiedeSequenze(c: Comando): boolean {
  if (c.tipo === "interruttori")
    return c.valori.leadNuovo !== undefined || c.valori.giornoMeet !== undefined;
  if (c.tipo === "tetti") return c.valori.leadNuovi !== undefined;
  return c.tipo === "stati" || c.tipo === "indirizzo_sede";
}

/** Le regole che la rotta applica PRIMA di scrivere (il browser le anticipa, non
 *  le decide):
 *   · i comandi nuovi chiedono le colonne di S2 (503 se mancano);
 *   · «Lead nuovo» non si accende senza la data della frase (422): senza, nessun
 *     consenso dal modulo vale. Spegnere non chiede niente;
 *   · la data della frase non è nel futuro (422). */
export function controllaComando(
  prima: RigaConfig | null | undefined,
  c: Comando,
  adesso: Date,
  sequenze: boolean,
): Rifiuto | null {
  if (!sequenze && richiedeSequenze(c)) return { stato: 503, errore: FRASE_S2 };
  if (c.tipo === "interruttori" && c.valori.leadNuovo === true) {
    const giaAcceso = prima?.lead_nuovo === true;
    if (!giaAcceso && !fraseModuloDa(prima?.controlli))
      return { stato: 422, errore: FRASE_SENZA_FRASE };
  }
  if (c.tipo === "frase_modulo") {
    const g = leggiGiornoFrase(c.giorno, adesso);
    if (!g.ok) return { stato: 422, errore: g.errore };
  }
  return null;
}

/** La frase del consenso nel modulo Meta, com'è in `controlli.fraseModulo`: il
 *  giorno è l'inizio di quel giorno a Roma, perché i moduli valgono dal giorno in
 *  poi. `segnatoIl` dice quando il titolare l'ha scritta. */
export function fraseDaGiorno(giorno: string, chi: string, adesso: Date): FraseModulo {
  const inizio = istanteDiRoma(giorno, "00:00");
  if (!inizio) throw new Error("giorno della frase non valido");
  return {
    il: inizio.toISOString(),
    da: chi.trim().slice(0, 60) || "sconosciuto",
    segnatoIl: adesso.toISOString(),
  };
}

/** La frase salvata in `controlli`; `null` = non segnata (o scritta male: un dato
 *  rotto vale come nessun dato, mai come un consenso). */
export function fraseModuloDa(controlli: unknown): FraseModulo | null {
  const f = (controlli as { fraseModulo?: unknown } | null | undefined)?.fraseModulo;
  const o = (f && typeof f === "object" ? f : null) as Record<string, unknown> | null;
  const il = Date.parse(String(o?.il ?? ""));
  if (!o || typeof o.il !== "string" || !Number.isFinite(il) || typeof o.da !== "string")
    return null;
  const segnato = Date.parse(String(o.segnatoIl ?? ""));
  return {
    il: new Date(il).toISOString(),
    da: o.da,
    ...(Number.isFinite(segnato) ? { segnatoIl: new Date(segnato).toISOString() } : {}),
  };
}

/** Le porte per riscrivere `controlli`: leggerlo, salvarlo tutto (vero se salvato) e,
 *  se c'è la migrazione S2, unire UNA parte lato SQL. */
export interface PorteControlli {
  leggi(): Promise<unknown>;
  salva(controlli: Record<string, unknown>): Promise<boolean>;
  /** `manychat_controlli_unisci`: `controlli || patch` in un solo UPDATE, senza
   *  riscrivere il resto. Vero se ha scritto; falso se la riga non c'è o la
   *  funzione manca (S2 non applicata): allora si ricade su `salva`. Facoltativa. */
  unisci?(patch: Record<string, unknown>): Promise<boolean>;
}

/** Le chiavi di `dopo` che sono nuove o diverse da `prima`; `null` se `dopo` ha
 *  tolto una chiave (una patch non sa togliere: si salva tutto). */
function chiaviCambiate(
  prima: unknown,
  dopo: Record<string, unknown>,
): Record<string, unknown> | null {
  const p = (prima && typeof prima === "object" && !Array.isArray(prima) ? prima : {}) as Record<
    string,
    unknown
  >;
  if (Object.keys(p).some((k) => !(k in dopo))) return null;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dopo))
    if (JSON.stringify(v) !== JSON.stringify(p[k])) patch[k] = v;
  return patch;
}

/** Cambia UNA parte di `controlli` partendo dal valore di ADESSO, riletto subito
 *  prima di scrivere: le prove di collegamento aspettano ManyChat per secondi, e
 *  riscrivere il `controlli` letto all'inizio farebbe tornare indietro la data
 *  della frase segnata da un'altra scheda nel frattempo (se era stata posticipata,
 *  tornerebbe quella anteriore e i moduli senza frase varrebbero come consenso).
 *  Con S2 la scrittura è `controlli || patch` lato SQL, con le sole chiavi che
 *  cambiano: la finestra fra lettura e scrittura non riscrive le altre. Senza S2
 *  (o se la patch non basta) si ricade sulla rilettura + scrittura intera, con la
 *  finestra di pochi millisecondi di prima. */
export async function aggiornaControlli(
  porte: PorteControlli,
  cambia: (fresco: unknown) => Record<string, unknown>,
): Promise<boolean> {
  const fresco = await porte.leggi();
  const nuovo = cambia(fresco);
  const patch = porte.unisci ? chiaviCambiate(fresco, nuovo) : null;
  if (porte.unisci && patch && Object.keys(patch).length > 0 && (await porte.unisci(patch)))
    return true;
  return porte.salva(nuovo);
}

export function controlliDopoFrase(prima: unknown, frase: FraseModulo): Record<string, unknown> {
  const p = (prima && typeof prima === "object" ? prima : {}) as Record<string, unknown>;
  return { ...p, fraseModulo: frase };
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LO STATO PER IL RIQUADRO (GET /api/crm/manychat, senza chiamare ManyChat)
   ═════════════════════════════════════════════════════════════════════════ */

/** «Mario R.»: il nome e l'iniziale del cognome. Mai il cognome intero, mai un
 *  numero (se il nome ne contiene uno, si scarta). */
export function abbreviaNome(nome?: string | null, cognome?: string | null): string {
  const pulito = (t?: string | null) =>
    String(t ?? "")
      .split(/\s+/)
      .filter((x) => x && !/\d/.test(x));
  const n = pulito(nome)[0];
  const co = pulito(cognome)[0];
  if (!n) return "Contatto";
  return co ? `${n} ${co[0].toUpperCase()}.` : n;
}

/** Il testo di un motivo, senza numeri di telefono. */
const senzaNumeri = (t: string) => t.replace(/\+?\d[\d\s().-]{4,}\d/g, "…");

/** I codici che il registro tiene nel campo `motivo`, in parole. */
const FRASI_MOTIVO: Record<string, string> = {
  prenotato_scaduto: "esito incerto: il giro si è interrotto prima della risposta di ManyChat",
  rifiuto_contatto: "numero non su WhatsApp o contatto non creabile",
  da_collegare: "contatto ManyChat da collegare",
  flusso_mancante: "il flusso del modello non è collegato",
  stop: "il numero ha chiesto di non ricevere messaggi",
  pausa_contatto: "pausa per contatto: un invio a questo numero meno di due minuti fa",
  gia_preso: "già preso da un altro giro",
  blocco: "ManyChat ha bloccato l'invio",
  incerto: "esito incerto",
};

function fraseMotivo(motivo: string | null | undefined, stato: string): string {
  const m = String(motivo ?? "").trim();
  if (!m)
    return stato === "incerto"
      ? "esito incerto"
      : stato === "fallito"
        ? "invio non riuscito"
        : "saltato";
  const frase = FRASI_MOTIVO[m] ?? m.replace(/_/g, " ");
  return senzaNumeri(frase).slice(0, 140);
}

/** Una riga del registro `manychat_invii`, quanto serve al riquadro. */
export interface RigaInvio {
  lead_id?: string | null;
  tipo: string;
  stato: string;
  motivo?: string | null;
  prenotato_il: string;
  risposta_il?: string | null;
}

export interface RigaGiro {
  ultimo_giro_il?: string | null;
  ultima_risposta_il?: string | null;
  prossimo_ricontatto_dopo?: string | null;
  /** libero: il giro ci può scrivere `problemi` (vedi `problemiDalGiro`) */
  stato?: unknown;
}

export interface DatiStato {
  /** le tabelle di M1 esistono? */
  migrazione: boolean;
  chiave: boolean;
  segreto: boolean;
  config: RigaConfig | null;
  giro: RigaGiro | null;
  /** gli invii di ieri e di oggi (promemoria, ricontatto, conferma) */
  invii: RigaInvio[];
  /** gli ultimi invii non riusciti (fallito, saltato, incerto), i più recenti */
  problemi: RigaInvio[];
  /** `inviato_il` dell'ultimo messaggio automatico partito */
  ultimoInvioIl: string | null;
  /** nome e cognome delle schede nominate, per abbreviarli */
  nomi: Record<string, { nome?: string | null; cognome?: string | null }>;
  /** le colonne di S2 ci sono? (senza riga lo sa solo il server); se manca si
   *  guarda la riga */
  sequenze?: boolean;
  /** il registro del foglio: solo ora ed esito, mai nomi né numeri */
  foglio?: {
    migrazione: boolean;
    segreto: boolean;
    ricevuti: { ricevuto_il: string; esito: string }[];
  };
}

/** La riga «Foglio Google»: i conti di oggi (giorno di Roma) e l'ultima riga. */
function foglioDa(f: DatiStato["foglio"], oggi: string): FoglioManychat {
  const giorno = (iso: string) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? aRoma(new Date(t)).giorno : null;
  };
  const righe = (f?.ricevuti ?? []).filter((r) => Number.isFinite(Date.parse(r.ricevuto_il)));
  const ultima = righe.reduce<(typeof righe)[number] | null>(
    (a, b) => (!a || Date.parse(b.ricevuto_il) > Date.parse(a.ricevuto_il) ? b : a),
    null,
  );
  return {
    migrazione: f?.migrazione === true,
    segretoPresente: f?.segreto === true,
    ultimo: ultima
      ? {
          il: new Date(ultima.ricevuto_il).toISOString(),
          esito: ESITI_FOGLIO.includes(ultima.esito) ? ultima.esito : "altro",
        }
      : null,
    righeOggi: righe.filter((r) => giorno(r.ricevuto_il) === oggi).length,
    tetto: TETTO_RIGHE_GIORNO,
  };
}

/** I tipi di cui il riquadro racconta i problemi: quelli automatici di `regole.ts`
 *  (la copia di una volta non c'è più, altrimenti i tipi nuovi non si vedrebbero). */
const eTipoAutomatico = (t: unknown): t is ProblemaGiro["tipo"] =>
  (TIPI_AUTOMATICI as string[]).includes(String(t));
const MAX_PROBLEMI = 20;

const LEAD_NUOVI = ["primo_contatto", "richiamo_24h", "ritorno", "casi_reali"];

/** Gli esiti di `sheets_ingressi` che il riquadro può mostrare; ogni altro valore
 *  diventa «altro» (nello stato non passa mai un testo del database). */
const ESITI_FOGLIO = [
  "in_corso",
  "nuovo",
  "ritorno_da_segnare",
  "ritorno",
  "gia_presente",
  "scartata",
];

/** Le righe che il giro scrive in `manychat_giro.stato.problemi`
 *  (`{ il, nome, tipo, motivo }`): le sole che non stanno nel registro (un
 *  «manca il consenso» non è un invio). Quelle rotte si scartano; il nome si
 *  abbrevia di nuovo e il motivo si ripulisce dai numeri. */
function problemiDalGiro(stato: unknown): ProblemaGiro[] {
  const elenco = (stato as { problemi?: unknown } | null)?.problemi;
  if (!Array.isArray(elenco)) return [];
  const fuori: ProblemaGiro[] = [];
  for (const x of elenco) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (
      typeof o.il !== "string" ||
      !Number.isFinite(Date.parse(o.il)) ||
      !eTipoAutomatico(o.tipo) ||
      typeof o.motivo !== "string" ||
      !o.motivo.trim()
    )
      continue;
    const parole = typeof o.nome === "string" ? o.nome.split(/\s+/) : [];
    fuori.push({
      il: new Date(o.il).toISOString(),
      nome: abbreviaNome(parole[0], parole.slice(1).join(" ")),
      tipo: o.tipo as ProblemaGiro["tipo"],
      motivo: senzaNumeri(o.motivo.trim()).slice(0, 140),
    });
  }
  return fuori;
}

/** L'ultimo collegamento salvato, con la riga della creazione contatto SEMPRE
 *  aggiornata (la prova di creazione cambia solo quella riga). `null` = mai
 *  controllato. */
function collegamentoSalvato(controlli: unknown): CollegamentoManychat | null {
  const c = (controlli && typeof controlli === "object" ? controlli : {}) as {
    collegamento?: { controllatoIl?: unknown; righe?: unknown };
    creazione?: unknown;
  };
  const col = c.collegamento;
  if (!col || typeof col.controllatoIl !== "string" || !Array.isArray(col.righe)) return null;
  const righe = (col.righe as RigaCollegamento[]).filter(
    (r) => r && typeof r.id === "string" && r.id !== "creazione_contatti",
  );
  return {
    controllatoIl: col.controllatoIl,
    righe: [...righe, rigaCreazione(creazioneDa(c.creazione))],
  };
}

export type EsitoCreazione = { esito: "ok" | "negata"; il: string };

export function creazioneDa(v: unknown): EsitoCreazione | null {
  const o = v as { esito?: unknown; il?: unknown } | null;
  if (!o || (o.esito !== "ok" && o.esito !== "negata") || typeof o.il !== "string") return null;
  return { esito: o.esito, il: o.il };
}

/** Tutto quello che il riquadro legge in una volta, SENZA chiamare ManyChat. */
export function costruisciStato(d: DatiStato, adesso: Date): StatoManychat {
  const config = configDaRiga(d.config, d.sequenze);
  const oggi = aRoma(adesso).giorno;
  const giornoDi = (iso?: string | null) => {
    const t = Date.parse(String(iso ?? ""));
    return Number.isFinite(t) ? aRoma(new Date(t)).giorno : null;
  };
  const arrivato = (i: RigaInvio) => (STATI_ARRIVATI as string[]).includes(i.stato);
  //  Tutto quello che conta nel tetto del giorno (`TIPI_NEI_TETTI`: la conferma no).
  const dioggi = d.invii.filter((i) => (TIPI_NEI_TETTI as string[]).includes(i.tipo));
  const dioggiArrivati = dioggi.filter((i) => arrivato(i) && giornoDi(i.prenotato_il) === oggi);

  const dalRegistro: ProblemaGiro[] = d.problemi
    .filter((i) => eTipoAutomatico(i.tipo))
    .map((i) => {
      const n = i.lead_id ? d.nomi[i.lead_id] : undefined;
      return {
        il: new Date(i.prenotato_il).toISOString(),
        nome: abbreviaNome(n?.nome, n?.cognome),
        tipo: i.tipo as ProblemaGiro["tipo"],
        motivo: fraseMotivo(i.motivo, i.stato),
      };
    })
    .filter((p) => Number.isFinite(Date.parse(p.il)));
  const problemi = [...dalRegistro, ...problemiDalGiro(d.giro?.stato)]
    .sort((a, b) => Date.parse(b.il) - Date.parse(a.il))
    .slice(0, MAX_PROBLEMI);

  const giro: GiroManychat = {
    ultimoGiroIl: d.giro?.ultimo_giro_il ?? null,
    ultimaRispostaIl: d.giro?.ultima_risposta_il ?? null,
    ultimoInvioIl: d.ultimoInvioIl,
    prossimoRicontattoDopo: d.giro?.prossimo_ricontatto_dopo ?? null,
    oggi: {
      promemoria: dioggiArrivati.filter((i) => i.tipo === "promemoria").length,
      ricontatti: dioggiArrivati.filter((i) => i.tipo === "ricontatto").length,
      leadNuovi: dioggiArrivati.filter((i) => LEAD_NUOVI.includes(i.tipo)).length,
      totale: dioggiArrivati.length,
      risposte: dioggi.filter((i) => giornoDi(i.risposta_il) === oggi).length,
    },
    problemi,
  };

  return {
    adesso: adesso.toISOString(),
    migrazione: d.migrazione,
    chiavePresente: d.chiave,
    segretoRitornoPresente: d.segreto,
    config,
    giro,
    collegamento: collegamentoSalvato(d.config?.controlli),
    fraseModulo: fraseModuloDa(d.config?.controlli),
    foglio: foglioDa(d.foglio, oggi),
  };
}

/** Quello che si salva in `controlli` dopo una «Prova di collegamento»: le
 *  righe SENZA la creazione (si compone a ogni lettura). */
export function controlliDopoCollegamento(
  prima: unknown,
  col: CollegamentoManychat,
): Record<string, unknown> {
  const p = (prima && typeof prima === "object" ? prima : {}) as Record<string, unknown>;
  return {
    ...p,
    collegamento: {
      controllatoIl: col.controllatoIl,
      righe: col.righe.filter((r) => r.id !== "creazione_contatti"),
    },
  };
}

export function controlliDopoCreazione(
  prima: unknown,
  esito: EsitoCreazione,
): Record<string, unknown> {
  const p = (prima && typeof prima === "object" ? prima : {}) as Record<string, unknown>;
  return { ...p, creazione: esito };
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA PROVA DI COLLEGAMENTO («Collegamento ok»)
   ═════════════════════════════════════════════════════════════════════════ */

/** I campi del contatto che il CRM scrive: devono esistere in ManyChat. Le
 *  prime sette servono sempre (conferma, chat, webinar); le altre quattro ai
 *  due flussi nuovi. I NOMI dei campi non sono segreti. */
export const CAMPI_SEMPRE = [
  "crm_v1",
  "crm_v2",
  "crm_v3",
  "crm_v4",
  "crm_invio_id",
  "crm_lead_id",
  "crm_telefono",
];
export const CAMPI_DEI_FLUSSI_NUOVI = [
  "crm_nome",
  "crm_ora_meet",
  "crm_link_meet",
  "crm_consulente",
];

export interface IngressoCollegamento {
  canale: CanaleManychat;
  interruttori: { promemoria: boolean; ricontatti: boolean };
  /** gli interruttori nuovi: senza (le colonne di S2 mancano) i flussi nuovi non
   *  compaiono fra le righe */
  sequenze?: { leadNuovo: boolean; giornoMeet: boolean; stati: Record<string, string> };
  flussi: Record<string, string>;
  creazione: EsitoCreazione | null;
  adesso: Date;
}

const riga = (id: string, esito: RigaCollegamento["esito"], testo: string): RigaCollegamento => ({
  id,
  esito,
  testo,
});

function rigaCreazione(c: EsitoCreazione | null): RigaCollegamento {
  if (!c)
    return riga(
      "creazione_contatti",
      "da_verificare",
      "Creazione di contatti: da verificare con «Prova creazione contatto».",
    );
  if (c.esito === "ok")
    return riga(
      "creazione_contatti",
      "ok",
      `Creazione di contatti: ok (provata il ${quandoBreve(c.il)}).`,
    );
  return riga(
    "creazione_contatti",
    "errore",
    "ManyChat non permette di creare contatti dal numero (permesso «import wa_id»): chiedi al supporto di ManyChat.",
  );
}

/** I flussi che la prova controlla: i tre modelli noti, quelli delle sequenze (se
 *  il database le ha) e gli altri collegati. */
const modelliDaControllare = (flussi: Record<string, string>, conSequenze: boolean) => {
  const noti = [...MODELLI_FLUSSO, ...(conSequenze ? MODELLI_FLUSSO_SEQUENZE : [])].map(
    (m) => m.modello,
  );
  return [...noti, ...Object.keys(flussi).filter((m) => !noti.includes(m))];
};

/** Il flusso di questo modello deve esserci perché un interruttore acceso lo usa? */
function flussoServe(modello: string, i: IngressoCollegamento): boolean {
  if (modello === "consulenza_conferma_presenza") return i.canale === "manychat";
  if (modello === "hgl_promemoria_meet") return i.interruttori.promemoria;
  const s = i.sequenze;
  if (
    modello === "hgl_primo_contatto" ||
    modello === "hgl_richiamo_24h" ||
    modello === "hgl_ritorno" ||
    modello === "hgl_casi_reali"
  )
    return !!s?.leadNuovo;
  //  Il promemoria 24 ore prima è spento (titolare, 28/10): il suo flusso non serve.
  if (modello === "hgl_meet_domani") return false;
  if (modello === "hgl_meet_oggi" || modello === "hgl_meet_adesso")
    return !!s?.giornoMeet;
  //  I modelli per stato: serve se uno degli stati che lo usano è acceso («Ricontatto
  //  fissato» è l'interruttore dei ricontatti).
  return STATI_RIQUADRO.some(
    (r) =>
      r.modello === modello &&
      (r.legatoA ? i.interruttori[r.legatoA] : statiDiRiga(r).some((k) => !!s?.stati[k])),
  );
}

/** «Prova di collegamento»: chiede a ManyChat «chi sei?», i flussi e i campi.
 *  Solo letture (GET): nessun `sendFlow`, nessun campo scritto, nessun contatto
 *  creato.
 *
 *  ⚠️ Manda SEMPRE una riga per ogni `id` obbligatorio del server (contratto in
 *   `client-crm.ts`, `ID_COLLEGAMENTO`): `chiave`, `is_pro`, `flusso:<modello>`
 *   per i tre modelli, `campi_crm`, `creazione_contatti`. Se la chiave manca o
 *   ManyChat non risponde le altre domande non si fanno, e quelle righe valgono
 *   «da verificare» con la ragione. `segreto_ritorno` e `ultima_risposta` le
 *   compone il browser da `segretoRitornoPresente` e `giro.ultimaRispostaIl`. */
export async function statoCollegamento(
  client: ClientManychat | null,
  i: IngressoCollegamento,
): Promise<CollegamentoManychat> {
  const righe: RigaCollegamento[] = [];
  const nonControllate = (perche: string) => {
    righe.push(riga("is_pro", "da_verificare", `Non controllato: ${perche}.`));
    for (const m of modelliDaControllare(i.flussi, !!i.sequenze))
      righe.push(riga(`flusso:${m}`, "da_verificare", `Non controllato: ${perche}.`));
    righe.push(riga("campi_crm", "da_verificare", `Non controllato: ${perche}.`));
  };

  if (!client) {
    righe.push(
      riga(
        "chiave",
        "errore",
        "Manca la chiave di ManyChat (MANYCHAT_API_KEY fra i segreti del sito).",
      ),
    );
    nonControllate("manca la chiave");
  } else {
    const chi = await client.chiSei();
    if (chi.esito === "blocco") {
      righe.push(riga("chiave", "errore", "ManyChat rifiuta la chiave."));
      nonControllate("ManyChat rifiuta la chiave");
    } else if (chi.esito !== "ok") {
      righe.push(riga("chiave", "da_verificare", "ManyChat non ha risposto: riprova fra poco."));
      nonControllate("ManyChat non ha risposto");
    } else {
      righe.push(riga("chiave", "ok", "ManyChat accetta la chiave."));
      righe.push(
        chi.dati?.isPro
          ? riga("is_pro", "ok", "Il piano di ManyChat è Pro.")
          : riga(
              "is_pro",
              "errore",
              "Il piano di ManyChat non è Pro: senza, l'API e le richieste esterne non funzionano.",
            ),
      );
      righe.push(...(await righeFlussi(client, i)));
      righe.push(await rigaCampi(client, i));
    }
  }

  righe.push(rigaCreazione(i.creazione));
  return { controllatoIl: i.adesso.toISOString(), righe };
}

async function righeFlussi(
  client: ClientManychat,
  i: IngressoCollegamento,
): Promise<RigaCollegamento[]> {
  const r = await client.flussi();
  const modelli = modelliDaControllare(i.flussi, !!i.sequenze);
  if (r.esito !== "ok" || !r.dati) {
    const bloccato = r.esito === "blocco";
    return modelli.map((m) =>
      riga(
        `flusso:${m}`,
        bloccato ? "errore" : "da_verificare",
        bloccato
          ? "ManyChat non fa leggere i flussi."
          : "Non sono riuscito a leggere i flussi di ManyChat.",
      ),
    );
  }
  const perNs = new Map(r.dati.map((f) => [f.ns, f.nome]));
  const note = new Map(
    [...MODELLI_FLUSSO, ...MODELLI_FLUSSO_SEQUENZE].map((m) => [m.modello, m.etichetta]),
  );
  const nuovi = new Set(MODELLI_FLUSSO_SEQUENZE.map((m) => m.modello));
  return modelli.map((modello) => {
    const etichetta = note.get(modello) ?? modello;
    const id = `flusso:${modello}`;
    const ns = i.flussi[modello];
    if (ns) {
      const nome = perNs.get(ns);
      return nome !== undefined
        ? riga(id, "ok", `${etichetta}: collegato al flusso «${nome || "senza nome"}».`)
        : riga(
            id,
            "errore",
            `${etichetta}: il flusso non esiste in ManyChat (controlla l'identificativo).`,
          );
    }
    //  Nessun flusso scelto: è un problema solo se quel messaggio deve partire.
    const serve = flussoServe(modello, i);
    //  La mattina col link è un'aggiunta con ripiego: mai rossa, mai «da verificare».
    if (modello === "hgl_meet_oggi_link")
      return riga(id, "non_serve", `${etichetta}: senza, la mattina parte senza il link.`);
    //  I flussi nuovi, a interruttore spento, sono grigi: non un dubbio, non un errore.
    if (!serve && nuovi.has(modello))
      return riga(id, "non_serve", `${etichetta}: serve quando lo accendi.`);
    return riga(
      id,
      serve ? "errore" : "da_verificare",
      serve
        ? `${etichetta}: manca il flusso, il messaggio non può partire.`
        : `${etichetta}: nessun flusso collegato.`,
    );
  });
}

async function rigaCampi(
  client: ClientManychat,
  i: IngressoCollegamento,
): Promise<RigaCollegamento> {
  const r = await client.campi();
  if (r.esito !== "ok" || !r.dati)
    return riga(
      "campi_crm",
      r.esito === "blocco" ? "errore" : "da_verificare",
      "Non sono riuscito a leggere i campi di ManyChat.",
    );
  const presenti = new Set(r.dati);
  const richiesti = [
    ...CAMPI_SEMPRE,
    ...(i.interruttori.promemoria || i.interruttori.ricontatti ? CAMPI_DEI_FLUSSI_NUOVI : []),
  ];
  const mancano = richiesti.filter((c) => !presenti.has(c));
  return mancano.length
    ? riga("campi_crm", "errore", `In ManyChat mancano i campi: ${mancano.join(", ")}.`)
    : riga("campi_crm", "ok", "I campi crm_* ci sono tutti in ManyChat.");
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. LA PROVA CREAZIONE CONTATTO
   ═════════════════════════════════════════════════════════════════════════ */

export type EsitoProvaCreazione =
  | { stato: 400; errore: string }
  | {
      stato: 200;
      risposta: ProvaCreazione;
      /** cosa ricordare per il «Collegamento ok»; `null` = niente di nuovo */
      registra: "ok" | "negata" | null;
    };

const NOME_DI_PROVA = "Prova";

/** Crea il contatto del titolare DENTRO ManyChat (nome «Prova», numero) per
 *  vedere se ManyChat lo permette. Non manda nessun messaggio, non scrive
 *  campi e non salva il numero nel CRM. Se il contatto c'è già non ne crea un
 *  altro (e non conta come «creazione provata»). */
export async function provaCreazione(
  client: ClientManychat | null,
  telefono: unknown,
): Promise<EsitoProvaCreazione> {
  const cifre = numeroWa(typeof telefono === "string" ? telefono : String(telefono ?? ""));
  if (!cifre)
    return {
      stato: 400,
      errore: "Scrivi il tuo numero di cellulare con il prefisso, ad esempio +39 333 1234567.",
    };
  const ris = (
    esito: ProvaCreazione["esito"],
    messaggio: string,
    registra: "ok" | "negata" | null = null,
  ) => ({ stato: 200, risposta: { esito, messaggio }, registra }) as const;

  if (!client)
    return ris("errore", "Manca la chiave di ManyChat (MANYCHAT_API_KEY fra i segreti del sito).");

  const trovato = await client.trovaContatto(cifre);
  if (trovato.esito === "blocco")
    return ris("errore", "ManyChat rifiuta la chiave o la richiesta.");
  if (trovato.esito !== "ok")
    return ris(
      "errore",
      "ManyChat non ha risposto: riprova fra poco. Non è stato creato niente di certo.",
    );
  if (trovato.dati)
    return ris(
      "ok",
      "Il tuo numero è già un contatto di ManyChat: la ricerca per numero funziona. La creazione di un contatto nuovo non è stata provata.",
    );

  const creato = await client.creaContatto(NOME_DI_PROVA, cifre);
  if (creato.esito === "ok")
    return ris(
      "ok",
      "Fatto: ManyChat ha creato il contatto di prova. Non è partito nessun messaggio.",
      "ok",
    );
  if (creato.esito === "rifiuto_contatto")
    return ris(
      "negata",
      "ManyChat ha rifiutato di creare il contatto. Spesso manca il permesso «import wa_id»: chiedilo al supporto di ManyChat.",
      "negata",
    );
  if (creato.esito === "blocco")
    return ris(
      "errore",
      "ManyChat ha rifiutato la richiesta (chiave senza diritti o canale scollegato).",
    );
  return ris(
    "errore",
    "ManyChat non ha risposto: non so se il contatto è stato creato. Controlla in ManyChat prima di riprovare.",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. LA PROVA A SECCO
   ═════════════════════════════════════════════════════════════════════════ */

export interface DatiSecco {
  config: ConfigManychat;
  schede: SchedaQuando[];
  consulenti: Pick<Consultant, "id" | "data">[];
  /** il registro degli ultimi giorni, per i freni */
  invii: InvioPerFreno[];
  /** `manychat_giro.prossimo_ricontatto_dopo` */
  prossimoDopo: Date | null;
  /** `controlli.fraseModulo.il`: da quando vale il consenso del modulo Meta
   *  (assente = nessuna data segnata, il modulo non vale per nessuno) */
  fraseModuloDal?: string | null;
  /** ultime 9 cifre → ISO dell'ultimo messaggio del cliente, per i meet di domani
   *  (il giorno prima parte solo se gratis); assente = nessuno ha la finestra aperta */
  ultimeEntrate?: Record<string, string>;
}

/** shortcut: le righe della prova si fermano a 100; con più schede il resto si
 *  vede dalla scheda. Alzare se serve. */
const MAX_RIGHE_PROVA = 100;

const nomeDi = (d: Partial<LeadData>) => abbreviaNome(d.nome, d.cognome);

/** Chi verrebbe scritto adesso e perché, con le STESSE funzioni pure che usa il
 *  giro (`decisioniDelGiro`: promemoria, giorno del meet, lead nuovi, ricontatti
 *  a data, messaggi per stato; al massimo 2 invii per giro e uno solo col ritmo,
 *  `righeDiProva`). Non scrive e non chiama: non riceve né database né rete. Gli
 *  interruttori non contano: serve proprio a vedere cosa succederebbe PRIMA di
 *  accendere (`sceltaDaConfig` con `prova = true`). */
export function provaASecco(d: DatiSecco, adesso: Date): ProvaASecco {
  const tetti = tettiDelGiorno(d.config.tetti, d.config.primaAccensione, adesso);
  const scelta = sceltaDaConfig(
    { ...d.config, fraseModuloDal: d.fraseModuloDal ?? null },
    adesso,
    true,
  );
  const voci = decisioniDelGiro(
    d.schede,
    adesso,
    {
      consulenti: d.consulenti,
      invii: d.invii,
      tetti,
      prossimoDopo: d.prossimoDopo,
      ultimeEntrate: d.ultimeEntrate,
    },
    scelta,
  );
  const righe: RigaProva[] = righeDiProva(voci, (s) => nomeDi(s.data));
  return { adesso: adesso.toISOString(), righe: righe.slice(0, MAX_RIGHE_PROVA) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. IL CAMBIO A MANO DEL SECONDO STATO (POST /api/crm/contatto-wa)
   ═════════════════════════════════════════════════════════════════════════ */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LettoCambio =
  | { ok: true; leadId: string; stato: StatoContatto }
  | { ok: false; errore: string };

/** Il corpo: SOLO `leadId` e `stato`. Chi cambia e di quale installazione si
 *  parla lo sa il server dalla sessione: se il browser li manda, si ignorano. */
export function leggiCambioContatto(body: unknown): LettoCambio {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.leadId !== "string" || !UUID.test(b.leadId))
    return { ok: false, errore: "Scheda non valida." };
  if (typeof b.stato !== "string" || !(STATI_CONTATTO as string[]).includes(b.stato))
    return { ok: false, errore: "Stato del contatto non valido." };
  return { ok: true, leadId: b.leadId, stato: b.stato as StatoContatto };
}

export interface PorteContatto {
  /** la scheda per id, di QUALUNQUE installazione (il controllo è qui sotto) */
  leggiScheda(
    leadId: string,
  ): Promise<{ user_id: string | null; data: Partial<LeadData> | null } | null>;
  /** scrive (`dal`) o azzera (`null`) `whatsapp_contacts.non_scrivere_dal` per quel numero */
  scriviBlocco(userId: string, cifre: string, dal: Date | null): Promise<void>;
  /** la funzione SQL `contatto_wa_aggiorna` (con `p_user_id` nel WHERE) */
  aggiorna(
    userId: string,
    leadId: string,
    cambio: CambioContatto,
  ): Promise<"ok" | "nessuna_riga" | "manca_migrazione">;
  /** il secondo stato com'è nel database dopo la scrittura */
  rileggi(userId: string, leadId: string): Promise<ContattoWa | null>;
  avviso(codice: string): void;
}

export interface IngressoContatto {
  /** l'installazione della SESSIONE (`g.chi.adminUserId`) */
  userId: string;
  leadId: string;
  stato: StatoContatto;
  /** chi cambia: il nome della SESSIONE */
  chi: string;
  /** il permesso «impostazioni» della sessione */
  puoTogliereStop: boolean;
  adesso: Date;
}

export interface RispostaRotta {
  stato: number;
  corpo: Record<string, unknown>;
}

/** Un cambio a mano. Con `supabaseAdmin` la RLS non vale, quindi:
 *   1. la scheda DEVE essere dell'installazione della sessione (403 se no);
 *   2. togliere STOP è del solo permesso «impostazioni» (`cambioAMano`);
 *   3. STOP a mano scrive anche `non_scrivere_dal` (così nessun canale scrive
 *      più a quel numero), e toglierlo lo azzera. IL BLOCCO SI SCRIVE PRIMA
 *      dello stato: se il secondo passo cade, il numero è già al sicuro (o già
 *      sbloccato, come voleva chi ha tolto STOP) e il tentativo si può
 *      ripetere;
 *   4. lo stato lo scrive la funzione SQL, con `p_user_id` nel WHERE. */
export async function cambioContatto(
  porte: PorteContatto,
  i: IngressoContatto,
): Promise<RispostaRotta> {
  const scheda = await porte.leggiScheda(i.leadId);
  if (!scheda) return { stato: 404, corpo: { error: "Scheda non trovata: ricarica la pagina." } };
  if (!scheda.user_id || scheda.user_id !== i.userId)
    return { stato: 403, corpo: { error: "Questa scheda non è di questa installazione." } };

  const prima = scheda.data?.contattoWa;
  const esito = cambioAMano(prima, i.stato, i.chi, i.adesso, i.puoTogliereStop);
  if (!esito.ok) return { stato: 403, corpo: { error: esito.messaggio, codice: esito.errore } };

  const cifre = numeroWa(scheda.data?.telefono);

  //  METTERE STOP: il blocco del numero PRIMA dello stato. Se il secondo passo
  //  cade, il numero è già al sicuro e il tentativo si ripete.
  if (esito.mettiStop) {
    if (cifre) await porte.scriviBlocco(i.userId, cifre, i.adesso);
    else porte.avviso("stop_senza_numero");
  }

  const scritto = await porte.aggiorna(i.userId, i.leadId, esito.cambio);
  if (scritto === "manca_migrazione")
    return {
      stato: 503,
      corpo: { error: "Manca l'aggiornamento del database: il cambio non è stato salvato." },
    };
  if (scritto === "nessuna_riga")
    return {
      stato: 409,
      corpo: { error: "La scheda è cambiata mentre salvavi: ricarica e riprova." },
    };

  //  TOGLIERE STOP: all'ORDINE OPPOSTO. Il numero si sblocca solo dopo che lo
  //  stato è salvato: se il salvataggio non riesce (503, 409), il numero resta
  //  bloccato come prima. Se è l'azzeramento a cadere, resta bloccato (il guasto
  //  sicuro) e lo si dice, col solo codice nei log.
  let avviso: string | undefined;
  if (esito.togliStop) {
    if (!cifre) porte.avviso("stop_senza_numero");
    else {
      try {
        await porte.scriviBlocco(i.userId, cifre, null);
      } catch (e) {
        const code = (e as { code?: unknown } | null)?.code;
        porte.avviso(`blocco_non_tolto:${typeof code === "string" ? code : "?"}`);
        avviso =
          "Lo stato è cambiato, ma il numero risulta ancora bloccato per gli invii: riprova fra poco o avvisa chi gestisce il sito.";
      }
    }
  }

  const dopo = (await porte.rileggi(i.userId, i.leadId)) ?? applicaCambio(prima, esito.cambio);
  return { stato: 200, corpo: { contattoWa: dopo, ...(avviso ? { avviso } : {}) } };
}
