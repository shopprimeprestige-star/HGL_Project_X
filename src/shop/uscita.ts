/** ── ESCI DAVVERO DALLA CONSULENZA ─────────────────────────────────────────
 *
 *  Segnalazione del committente (13/10/2026): chi esce da Meetly resta nella
 *  lista, nelle camere («camera spenta») e nella sala d'attesa, e il suo link
 *  resta valido per chiunque.
 *
 *  ── LA SERRATURA ─────────────────────────────────────────────────────────
 *  `pid`, `dev` e il gettone del link viaggiano in `hello` a TUTTA la stanza:
 *  non provano chi sei. Quello che lo prova è un SEGRETO che crea il browser
 *  (`crypto.getRandomValues`, 32 byte) e tiene in `localStorage` accanto a
 *  `dev`. Sul server resta solo la sua impronta SHA-256 (`segretoH`), e il
 *  server non lo restituisce mai.
 *   · Una bussata su una riga che ha un'impronta diversa NON si fonde e non
 *     scrive niente: 403, senza dire com'è la riga.
 *   · Una riga senza impronta (nata prima del rilascio, o da «fai entrare») la
 *     adotta il primo che bussa.
 *   · «Esci» vale solo con il segreto della riga.
 *   · Il link lo chiude solo il TITOLARE (la prima bussata accettata del giro)
 *     e solo se il gettone è quello con cui era entrato: chi bussa col gettone
 *     di un altro (lo ha sentito in `hello`) ha una riga sua, ma il suo Esci
 *     non chiude il link di nessuno.
 *
 *  ── IL REGISTRO DEI LINK ─────────────────────────────────────────────────
 *  Nessuna migrazione: una riga di `app_config` PER PERSONA,
 *  `link_ospiti:<codice>:<gettone>` = { giro, chiusi[], titolare? }. Il link
 *  senza `k` è il giro «0». Chiudere SPOSTA il giro in `chiusi` con la data
 *  (non si cancella niente); «Invita di nuovo» apre un giro nuovo casuale.
 *  ⚠️ Tutte le scritture passano da `scriviConRilettura`: scrive, rilegge e,
 *   se il cambio non c'è (un'altra scrittura l'ha coperto), riprova. Dopo tre
 *   tentativi dice di no — mai un «fatto» finto.
 *
 *  ⚠️ QUI NON C'È SUPABASE: l'archivio arriva da fuori (`Archivio`), così le
 *   stesse funzioni che le rotte chiamano si provano con un archivio finto che
 *   sbaglia a comando — vedi proveDellUscitaVera. */
import { chiaveSessione } from "@/shop/chiave-sessione";
import {
  BASE_SALA,
  bussa,
  chiTocca,
  leggiSala,
  righeDi,
  scriviSala,
  segnaUscito,
  statoDi,
  type PersonaInAttesa,
} from "@/shop/sala-attesa";

/** Le intestazioni che la rotta pubblica accetta. ⚠️ `x-sala-segreto` ci deve
 *  stare: la GET lo manda, e senza di lui il controllo preliminare del browser
 *  la rifiuta (pagina su un'altra origine) e l'ospite resta «sconosciuto». */
export const SEGRETO_INTESTAZIONE = "x-sala-segreto";
export const INTESTAZIONI_SALA = `Content-Type, ${SEGRETO_INTESTAZIONE}`;

export const BASE_LINK = "link_ospiti";
/** Il giro di un link senza `k`. */
export const GIRO_BASE = "0";

export interface Archivio {
  leggi(chiave: string): Promise<string | null>;
  /** Torna il messaggio d'errore, o "" se è andata. */
  scrivi(chiave: string, valore: string): Promise<string>;
}

const testo = (v: unknown): string => String(v ?? "").trim();
/** Come `pulito` in chi-dal-link: lo stesso gettone, la stessa forma. */
const gettonePulito = (v: unknown): string =>
  testo(v).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);

export const chiaveSala = (code: unknown): string => chiaveSessione(BASE_SALA, code);
export const chiaveLink = (code: unknown, gettone: unknown): string =>
  `${chiaveSessione(BASE_LINK, code)}:${gettonePulito(gettone)}`;

/** ── L'IMPRONTA DEL SEGRETO ────────────────────────────────────────────────
 *  SHA-256 in esadecimale (`crypto.subtle` c'è anche nei Worker). Un segreto
 *  di forma sbagliata vale «nessun segreto». */
export async function improntaSegreto(segreto: unknown): Promise<string> {
  const s = testo(segreto);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(s)) return "";
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** ── DUE SCHEDE: CHI CHIUDE IL LINK ────────────────────────────────────────
 *  Chiude il link solo l'ultima scheda viva dello stesso browser. */
export const chiudeIlLink = (p: { altreSchedeVive: boolean }): boolean => !p.altreSchedeVive;

/** ── SCRIVERE E CONTROLLARE ────────────────────────────────────────────────
 *  `cambia` riceve quello che c'è adesso e torna il nuovo testo (o null se non
 *  c'è niente da cambiare); `verifica` dice se il cambio si vede. */
export async function scriviConRilettura(
  a: Archivio,
  chiave: string,
  cambia: (letto: string | null) => string | null,
  verifica: (letto: string | null) => boolean,
  tentativi = 3,
): Promise<boolean> {
  for (let i = 0; i < tentativi; i++) {
    const letto = await a.leggi(chiave);
    const nuovo = cambia(letto);
    if (nuovo === null) return verifica(letto);
    if (await a.scrivi(chiave, nuovo)) continue;
    if (verifica(await a.leggi(chiave))) return true;
  }
  return false;
}

/* ═══ IL REGISTRO DEI LINK ════════════════════════════════════════════════ */

export interface RegistroLink {
  /** Il giro valido adesso. "" = il link è chiuso e nessuno ne ha uno nuovo. */
  giro: string;
  /** I giri chiusi, con la data: non si cancellano mai. */
  chiusi: { giro: string; at: number }[];
  /** Impronta di chi ha bussato per primo in questo giro. */
  titolare?: string;
}

export function leggiRegistro(grezzo?: string | null): RegistroLink {
  try {
    const v = JSON.parse(grezzo || "") as Partial<RegistroLink>;
    if (!v || typeof v !== "object") throw new Error("vuoto");
    const chiusi = (Array.isArray(v.chiusi) ? v.chiusi : [])
      .map((x) => ({ giro: testo(x?.giro), at: Number(x?.at) || 0 }))
      .filter((x) => x.giro);
    return {
      giro: typeof v.giro === "string" ? testo(v.giro) : GIRO_BASE,
      chiusi,
      ...(testo(v.titolare) ? { titolare: testo(v.titolare) } : {}),
    };
  } catch {
    return { giro: GIRO_BASE, chiusi: [] };
  }
}
export const scriviRegistro = (r: RegistroLink): string => JSON.stringify(r);

/** Il giro scritto in un link: senza `k` è «0». Stessa ripulita di
 *  `giroDalLink` (chi-dal-link): minuscole e cifre, 32 al massimo. */
export const giroDelLink = (k?: string | null): string =>
  testo(k).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32) || GIRO_BASE;

export const linkValido = (r: RegistroLink, k?: string | null): boolean =>
  !!r.giro && giroDelLink(k) === r.giro;

/** Chiude il giro corrente: lo SPOSTA in `chiusi`, non lo cancella. Il titolare
 *  resta scritto: serve a `uscitiVerificati` per dire chi è davvero uscito. */
export function chiudiLink(r: RegistroLink, adesso = Date.now()): RegistroLink {
  if (!r.giro) return r;
  return { giro: "", chiusi: [...r.chiusi, { giro: r.giro, at: adesso }], ...(r.titolare ? { titolare: r.titolare } : {}) };
}

/** Un giro nuovo e casuale (mai ricavato dal gettone o dall'ora). */
export function giroCasuale(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** «Invita di nuovo»: chiude il giro corrente (se aperto) e ne apre uno nuovo.
 *  Azzera il titolare: lo diventa la prima bussata del giro nuovo. */
export function nuovoGiro(r: RegistroLink, adesso = Date.now(), giro = giroCasuale()): RegistroLink {
  const chiusi = r.giro ? [...r.chiusi, { giro: r.giro, at: adesso }] : r.chiusi;
  return { giro, chiusi };
}

/** La prima bussata accettata del giro diventa titolare del link. */
export function prendiTitolo(r: RegistroLink, segretoH: string): RegistroLink {
  return r.giro && !r.titolare && segretoH ? { ...r, titolare: segretoH } : r;
}

/* ═══ LE TRE RISPOSTE ═════════════════════════════════════════════════════ */

export interface Trattata {
  status: number;
  body: Record<string, unknown>;
}
const no403: Trattata = { status: 403, body: { ok: false } };
const noLink: Trattata = { status: 403, body: { ok: false, reason: "link" } };

async function leggiLaSala(a: Archivio, sess: string) {
  return leggiSala(await a.leggi(chiaveSala(sess)));
}

/** Il titolare del link è chi ha bussato per primo: lo si scrive una volta. */
async function segnaTitolare(a: Archivio, sess: string, chi: string, segretoH: string) {
  const g = gettonePulito(chi);
  if (!g || !segretoH) return;
  await scriviConRilettura(
    a,
    chiaveLink(sess, g),
    (letto) => {
      const r = leggiRegistro(letto);
      const nuovo = prendiTitolo(r, segretoH);
      return nuovo === r ? null : scriviRegistro(nuovo);
    },
    (letto) => {
      const r = leggiRegistro(letto);
      return !!r.titolare || !r.giro;
    },
  );
}

export interface Bussata {
  sess?: string;
  pid?: string;
  nome?: string;
  dev?: string;
  persona?: string;
  chi?: string;
  segreto?: string;
  /** Il giro del link con cui bussa (`?k=`). */
  k?: string;
}

/** POST «busso». Torna lo stato di CHI chiede, mai quello di un altro. */
export async function trattaBussata(a: Archivio, b: Bussata, adesso = Date.now()): Promise<Trattata> {
  const sess = testo(b.sess);
  const pid = testo(b.pid);
  if (!sess || !pid) return { status: 400, body: { ok: false, reason: "manca la stanza" } };
  const dev = testo(b.dev);
  const segretoH = await improntaSegreto(b.segreto);
  const prima = await leggiLaSala(a, sess);
  //  ⚠️ PRIMA di ogni scorciatoia, «già ammesso» compreso: chi conosce solo
  //   `dev` o `pid` di un altro non scopre né eredita il suo stato.
  const di = chiTocca(prima, { pid, dev, segretoH }, adesso);
  if (di === "altrui") return no403;
  //  ⚠️ SECONDA SERRATURA: un link chiuso non fa bussare, anche se chi lo apre
  //   salta il controllo della pagina (`trattaLink`). Risposta neutra.
  const gettone = gettonePulito(b.chi);
  if (gettone && !linkValido(leggiRegistro(await a.leggi(chiaveLink(sess, gettone))), b.k)) return noLink;
  const chi = { pid, dev, segretoH };
  const stato = statoDi(prima, chi, adesso);
  const adottabile = !!segretoH && prima.some((p) => !p.segretoH && (p.pid === pid || (dev && p.dev === dev)));
  /*  Se la decisione c'è già non si riscrive la riga (vedi la storia in
      api.public.sala-attesa): al massimo la si fa propria, una volta. */
  if (stato === "ammesso" || stato === "rifiutato") {
    if (adottabile) {
      const adotta = (letto: string | null) =>
        scriviSala(
          leggiSala(letto).map((p) =>
            !p.segretoH && (p.pid === pid || (dev && p.dev === dev)) ? { ...p, segretoH } : p,
          ),
        );
      await scriviConRilettura(a, chiaveSala(sess), adotta, (l) => righeDi(leggiSala(l), chi, adesso).length > 0);
    }
    await segnaTitolare(a, sess, b.chi ?? "", segretoH);
    return { status: 200, body: { ok: true, stato } };
  }
  const dopo = bussa(
    prima,
    { pid, dev, nome: testo(b.nome), persona: testo(b.persona), chi: gettonePulito(b.chi), segretoH },
    adesso,
  );
  const errore = await a.scrivi(chiaveSala(sess), scriviSala(dopo));
  if (errore) return { status: 500, body: { ok: false, reason: errore } };
  await segnaTitolare(a, sess, b.chi ?? "", segretoH);
  return { status: 200, body: { ok: true, stato: statoDi(dopo, chi, adesso) } };
}

/** GET «com'è andata?». Senza il segreto giusto di un altro non si sa niente. */
export async function trattaStato(
  a: Archivio,
  q: { sess?: string; pid?: string; dev?: string; segreto?: string },
  adesso = Date.now(),
): Promise<Trattata> {
  const sess = testo(q.sess);
  const pid = testo(q.pid);
  if (!sess || !pid) return { status: 400, body: { ok: false, reason: "manca la stanza" } };
  const segretoH = await improntaSegreto(q.segreto);
  const persone = await leggiLaSala(a, sess);
  return { status: 200, body: { ok: true, stato: statoDi(persone, { pid, dev: testo(q.dev), segretoH }, adesso) } };
}

export interface Uscita {
  sess?: string;
  pid?: string;
  dev?: string;
  segreto?: string;
  chi?: string;
  k?: string;
  /** Vero se questa è l'ultima scheda viva di questo browser. */
  ultima?: boolean;
}

/** POST «esco». Con `ultima:false` non tocca niente. */
export async function trattaEsci(a: Archivio, b: Uscita, adesso = Date.now()): Promise<Trattata> {
  const sess = testo(b.sess);
  const pid = testo(b.pid);
  const dev = testo(b.dev);
  if (!sess || (!pid && !dev)) return { status: 400, body: { ok: false, reason: "manca la stanza" } };
  const segretoH = await improntaSegreto(b.segreto);
  const chi = { pid, dev, segretoH };
  const sue = righeDi(await leggiLaSala(a, sess), chi, adesso);
  //  Riga non trovata, o di un altro, o senza segreto: 403 e niente scritto.
  if (!sue.length) return no403;
  if (b.ultima !== true) return { status: 200, body: { ok: true, chiuso: false } };

  const segnata = await scriviConRilettura(
    a,
    chiaveSala(sess),
    (letto) => scriviSala(segnaUscito(leggiSala(letto), chi, adesso)),
    (letto) => {
      const mie = righeDi(leggiSala(letto), chi, adesso);
      return mie.length > 0 && mie.every((p) => !!p.uscito);
    },
  );
  if (!segnata) return { status: 409, body: { ok: false } };

  //  Il link lo chiude solo il titolare, e solo col gettone con cui era entrato.
  const gettone = gettonePulito(b.chi);
  if (!gettone || !sue.some((p) => p.chi === gettone)) return { status: 200, body: { ok: true, chiuso: false } };
  const chiave = chiaveLink(sess, gettone);
  const reg = leggiRegistro(await a.leggi(chiave));
  if (reg.titolare !== segretoH || !linkValido(reg, b.k)) return { status: 200, body: { ok: true, chiuso: false } };
  const giro = reg.giro;
  const chiuso = await scriviConRilettura(
    a,
    chiave,
    (letto) => {
      const r = leggiRegistro(letto);
      return r.giro === giro ? scriviRegistro(chiudiLink(r, adesso)) : null;
    },
    (letto) => leggiRegistro(letto).giro !== giro,
  );
  if (!chiuso) return { status: 409, body: { ok: false } };
  return { status: 200, body: { ok: true, chiuso: true } };
}

/** ── IL GETTONE DI UN USCITO VALE SOLO SE È IL TITOLARE DEL LINK ──────────
 *  Il gettone viaggia nel `hello` a tutta la stanza: B può bussare con quello
 *  di A ed uscire, e la sua riga «uscito» porta `chi` = A. Il consulente
 *  vedrebbe il nome di A col tasto «Invita di nuovo», che chiude il link di A
 *  mentre A è dentro. Qui `chi` resta solo alle righe il cui segreto è quello
 *  del titolare scritto nel registro; alle altre si toglie (nome digitato,
 *  niente tasto). */
export async function uscitiVerificati(
  a: Archivio,
  sess: string,
  righe: PersonaInAttesa[],
): Promise<PersonaInAttesa[]> {
  return Promise.all(
    righe.map(async (p) => {
      const g = gettonePulito(p.chi);
      if (!g) return { ...p, chi: "" };
      const titolare = leggiRegistro(await a.leggi(chiaveLink(sess, g))).titolare;
      return titolare && titolare === p.segretoH ? p : { ...p, chi: "" };
    }),
  );
}

/** GET «questo link vale ancora?». Un link senza nome (senza gettone) non si
 *  chiude mai: chiuderebbe tutti. Non dice altro che sì o no. */
export async function trattaLink(a: Archivio, q: { sess?: string; chi?: string; k?: string }): Promise<Trattata> {
  const sess = testo(q.sess);
  if (!sess) return { status: 400, body: { ok: false, reason: "manca la stanza" } };
  const g = gettonePulito(q.chi);
  if (!g) return { status: 200, body: { ok: true, valido: true } };
  const reg = leggiRegistro(await a.leggi(chiaveLink(sess, g)));
  return { status: 200, body: { ok: true, valido: linkValido(reg, q.k) } };
}

/** POST «Invita di nuovo» (solo il consulente): chiude il giro corrente e ne
 *  apre uno nuovo, casuale. Il giro lo sceglie UNA volta: i tentativi di
 *  `scriviConRilettura` riscrivono lo stesso. */
export async function trattaReinvito(
  a: Archivio,
  q: { sess?: string; chi?: string },
  adesso = Date.now(),
): Promise<Trattata> {
  const sess = testo(q.sess);
  const g = gettonePulito(q.chi);
  if (!sess || !g) return { status: 400, body: { ok: false, reason: "manca la persona" } };
  const giro = giroCasuale();
  const fatto = await scriviConRilettura(
    a,
    chiaveLink(sess, g),
    (letto) => scriviRegistro(nuovoGiro(leggiRegistro(letto), adesso, giro)),
    (letto) => leggiRegistro(letto).giro === giro,
  );
  return fatto ? { status: 200, body: { ok: true, giro } } : { status: 409, body: { ok: false } };
}
