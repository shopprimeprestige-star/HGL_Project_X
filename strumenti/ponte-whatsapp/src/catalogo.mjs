/** ── PONTE WHATSAPP · IL CATALOGO DEI MEDIA ──────────────────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T5 (PIANO c2.1, D4).
 *  Per ogni media visto (in diretta o nello storico) il Mac tiene un file con quello che serve per
 *  scaricarlo DOPO, se il titolare preme «Mostra» sul segnaposto. Mai nel database (D4): i dati per
 *  decifrare stanno solo qui.
 *   · un file per media, `<sha256 della chiave>.json` (nessun numero nel nome), cartella 700, file 600,
 *     scrittura atomica (file temporaneo + rename). Nessuna cifratura (D4): protegge il fatto che la
 *     cartella è esclusa dai backup (`tmutil` in `installa.sh`) e che stanno accanto ad `auth/`;
 *   · SEGRETI: solo `mediaKey`, `directPath`, `host`. L'`url` non si salva (un campo `url` passato per
 *     sbaglio, come ogni campo sconosciuto, viene ignorato); il resto è operativo: chiave `bw:…`,
 *     categoria, mime canonico, peso, orario, e per ridisegnare la bolla nome/durata/dimensioni/miniatura;
 *   · scadenza 30 giorni dal MESSAGGIO (potatura all'avvio e una volta al giorno), tetto 5.000 voci:
 *     oltre il tetto escono prima le `catalogato` (le più vecchie), poi, solo se non basta, le `in_coda`;
 *   · coda e catalogo sono lo STESSO record: `stato` = `catalogato` (da scaricare solo se richiesto) o
 *     `in_coda` (da scaricare da solo, con `guasti` e `prossimo_il` per l'attesa; lo gestisce `immagini.mjs`);
 *   · SCRITTURE ASINCRONE E A GRUPPI: `aggiungi` tocca solo la memoria e programma una scrittura entro 2 s
 *     (a gruppi da 32 file, con `fs/promises`); un nuovo storico può portare migliaia di messaggi in pochi
 *     secondi e un file alla volta, nel gestore dell'evento, bloccherebbe il ciclo e i keepalive del socket.
 *     Un lavoro `in_coda` si scrive subito (ma sempre in modo asincrono): se il Mac si ferma non si perde.
 *     `ferma()` svuota il buffer: va chiamata in chiusura (SIGTERM/SIGINT) PRIMA di uscire;
 *   · scrittura idempotente: lo storico si ripresenta, una voce già nota non si riscrive e uno storico
 *     non riporta mai a `catalogato` una voce `in_coda`.
 *  ⚠️ CARTELLA DEDICATA. Al caricamento `carica()` cancella ogni file che non riconosce (rotti, di nome strano,
 *     residui `.tmp`, qualunque file estraneo): la cartella passata a `creaCatalogo` non si condivide con altro. Quella
 *     di serie è `media/catalogo` (dentro la cartella dati del ponte, accanto ad `auth/`; la passa `index.mjs`); mai la
 *     cartella dati stessa né una che contiene altro.
 *  Il file è nostro ma si ricontrolla alla lettura: rotti, di nome strano, residui `.tmp`, scaduti → via.
 *
 *  ⚠️ Qui passano dati di clienti: il `registro` riceve solo codici fissi e conteggi, mai chiavi, nomi
 *  né testi di errore del disco. Nessuna rete, nessun socket.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createHash } from "node:crypto";
import * as fsReale from "node:fs/promises";
import { join } from "node:path";
import { MIME_PER_CATEGORIA } from "./firma.mjs";

export const LIMITI_CATALOGO = {
  giorni: 30,
  maxVoci: 5000,
  /** dopo quanto si scrive ciò che si è visto (un gruppo solo per tutto lo storico di 2 secondi) */
  bufferMs: 2000,
  /** la potatura di ogni giorno */
  potaMs: 24 * 3_600_000,
  /** file scritti insieme in un gruppo */
  gruppo: 32,
};

const GIORNO_MS = 86_400_000;
const CHIAVE_VALIDA = /^bw:\d{8,15}:[A-Za-z0-9_.-]{1,128}$/;
const FILE_VOCE = /^[0-9a-f]{64}\.json$/;
const BASE64_32 = /^[A-Za-z0-9+/]{43}=$/;
//  Copie di `hostValido` e `percorsoValido` di immagini.mjs (stesse difese, file indipendente).
const HOST_WHATSAPP = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.whatsapp\.net$/;
const PERCORSO_VALIDO = /^\/(?!\/)[A-Za-z0-9._~\-/?=&%+]*$/;
/** come il CHECK della tabella: un JPEG in base64, e basta (finisce in `data:image/jpeg;base64,`) */
const MINIATURA = /^\/9j\/[A-Za-z0-9+/]*={0,2}$/;
const STATI = ["catalogato", "in_coda"];

const oggetto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const intero = (x, min) => (Number.isInteger(x) && x >= min ? x : undefined);
const nomeDi = (chiave) => `${createHash("sha256").update(chiave).digest("hex")}.json`;
const hostValido = (h) => typeof h === "string" && h.length <= 253 && HOST_WHATSAPP.test(h);
const percorsoValido = (p) => typeof p === "string" && p.length <= 1024 && PERCORSO_VALIDO.test(p) && !p.includes("..") && !/%2e|%2f|%5c/i.test(p);

/** I campi facoltativi: ognuno restituisce il valore ripulito, o undefined se non è valido. */
const FACOLTATIVI = {
  byte: (x) => intero(x, 1),
  nome: (x) => (typeof x === "string" && x ? Array.from(x).slice(0, 120).join("") : undefined),
  durata_s: (x) => intero(x, 1),
  larghezza: (x) => intero(x, 1),
  altezza: (x) => intero(x, 1),
  miniatura: (x) => (typeof x === "string" && x.length <= 12_000 && MINIATURA.test(x) ? x : undefined),
};

/** I campi della coda: li aggiorna `immagini.mjs` con `imposta`. */
const DI_CODA = {
  stato: (x) => (STATI.includes(x) ? x : undefined),
  guasti: (x) => (Number.isInteger(x) && x >= 0 && x < 100 ? x : undefined),
  prossimo_il: (x) => (typeof x === "number" && Number.isFinite(x) ? x : undefined),
  caricato: (x) => (x === true ? true : undefined),
  richiesto: (x) => (x === true ? true : undefined),
};

/** Una voce (di `aggiungi` o letta da disco) → `{ voce }` ripulita, oppure `{ motivo }`. Solo i campi noti. */
function pulisci(d) {
  if (!oggetto(d) || typeof d.chiave !== "string" || !CHIAVE_VALIDA.test(d.chiave)) return { motivo: "non_valida" };
  if (!Number.isInteger(d.ts) || d.ts < 1) return { motivo: "non_valida" };
  const stato = d.stato ?? "catalogato";
  if (!STATI.includes(stato)) return { motivo: "non_valida" };
  if (!Object.hasOwn(MIME_PER_CATEGORIA, d.categoria)) return { motivo: "non_valida" };
  let chiaveMedia = d.mediaKey;
  if (typeof chiaveMedia === "string") {
    if (!BASE64_32.test(chiaveMedia) || Buffer.from(chiaveMedia, "base64").length !== 32) return { motivo: "non_valida" };
  } else if (chiaveMedia instanceof Uint8Array && chiaveMedia.length === 32) chiaveMedia = Buffer.from(chiaveMedia).toString("base64");
  else return { motivo: "non_valida" };
  if (!percorsoValido(d.directPath) || !hostValido(d.host)) return { motivo: "non_valida" };
  if (!MIME_PER_CATEGORIA[d.categoria].includes(d.mime)) return { motivo: "mime_non_ammesso" };
  const voce = { v: 2, chiave: d.chiave, ts: d.ts, categoria: d.categoria, mime: d.mime, mediaKey: chiaveMedia, directPath: d.directPath, host: d.host, stato };
  for (const [campo, valida] of Object.entries({ ...FACOLTATIVI, ...DI_CODA })) {
    if (campo === "stato" || d[campo] === undefined) continue;
    const valore = valida(d[campo]);
    if (valore !== undefined) voce[campo] = valore;
  }
  return { voce };
}

/** Il catalogo.
 *
 *  `opzioni`: `cartella` (es. `media/catalogo`); `registro(codice, dettagli?)`; `orologio`, `pianifica`,
 *  `annulla`, `fs` (le prove li sostituiscono); `maxVoci`.
 *
 *  Uscita: `{ avvia, aggiungi, leggi, voci, imposta, togli, pota, svuota, ferma, conteggio }`.
 *   - `await avvia()` → `{ caricate, scadute, corrotte }`: PRIMA di collegare il socket (finché non è
 *     avviato `aggiungi` rifiuta con `non_avviato`: scriverebbe sopra voci che non ha ancora letto);
 *   - `aggiungi(voce)` → `{ ok: true }` | `{ ok: true, gia: true }` | `{ ok: false, motivo }` con motivo
 *     `non_valida | mime_non_ammesso | vecchia | non_avviato | fermato`. Non lancia mai, non tocca il disco;
 *   - `leggi(chiave)` → copia della voce (con `mediaKey` Buffer da 32 byte) | null; `voci(stato?)` → copie;
 *   - `imposta(chiave, campi)` → `{ ok }`: solo `stato, guasti, prossimo_il, caricato, richiesto`;
 *   - `togli(chiave)` (404/410, liberata del tutto) → `{ ok: true }`;
 *   - `pota()` → `{ scadute, eccesso }`; `svuota()` scrive ora ciò che è in attesa; `ferma()` = svuota +
 *     cancella i timer (chiusura); `conteggio()` → `{ voci, in_coda, catalogato }`. */
export function creaCatalogo({ cartella, registro = () => {}, orologio = Date.now, pianifica = setTimeout, annulla = clearTimeout, fs = fsReale, maxVoci = LIMITI_CATALOGO.maxVoci }) {
  const L = LIMITI_CATALOGO;
  /** chiave → voce (con la `mediaKey` in base64, com'è su disco) */
  const indice = new Map();
  /** nome del file → voce da scrivere, o null da cancellare; si svuota a ogni giro */
  const attesa = new Map();
  let avviato = null;
  let pronto = false;
  let fermato = false;
  let timer = null;
  let timerMs = Infinity;
  let timerPota = null;
  /** i giri di scrittura uno dopo l'altro: due insieme scriverebbero lo stesso file due volte */
  let giro = Promise.resolve();

  const scadenzaDi = (ts) => ts * 1000 + L.giorni * GIORNO_MS;
  const copia = (v) => ({ ...v, mediaKey: Buffer.from(v.mediaKey, "base64") });

  function programma(ms) {
    if (fermato || (timer && timerMs <= ms)) return;
    annulla(timer);
    timerMs = ms;
    timer = pianifica(() => {
      timer = null;
      timerMs = Infinity;
      void svuota();
    }, ms);
    timer?.unref?.();
  }

  function metti(voce) {
    indice.set(voce.chiave, voce);
    attesa.set(nomeDi(voce.chiave), voce);
    //  un lavoro in coda si scrive subito (asincrono); un media solo visto, con comodo
    programma(voce.stato === "in_coda" ? 0 : L.bufferMs);
  }

  function rimuovi(chiave) {
    if (!indice.delete(chiave)) return;
    attesa.set(nomeDi(chiave), null);
  }

  /** Oltre il tetto: prima le `catalogato` più vecchie, poi (solo se non basta) le `in_coda` più vecchie. */
  function applicaTetto() {
    let eccesso = indice.size - maxVoci;
    const tolte = Math.max(0, eccesso);
    for (const stato of STATI) {
      if (eccesso <= 0) break;
      const vecchie = [...indice.values()]
        .filter((v) => v.stato === stato)
        .sort((a, b) => a.ts - b.ts)
        .slice(0, eccesso);
      for (const v of vecchie) rimuovi(v.chiave);
      eccesso -= vecchie.length;
    }
    return tolte;
  }

  async function scrivi1(nome, voce) {
    const finale = join(cartella, nome);
    if (voce === null) return fs.rm(finale, { force: true });
    const temporaneo = `${finale}.tmp-${process.pid}`;
    try {
      await fs.writeFile(temporaneo, JSON.stringify(voce), { mode: 0o600 });
      await fs.rename(temporaneo, finale);
    } catch (errore) {
      await fs.rm(temporaneo, { force: true }).catch(() => {});
      throw errore;
    }
  }

  async function scriviTutto() {
    applicaTetto();
    if (attesa.size === 0) return;
    const lotto = [...attesa];
    attesa.clear();
    let guasti = 0;
    for (let i = 0; i < lotto.length; i += L.gruppo) {
      await Promise.all(
        lotto.slice(i, i + L.gruppo).map(([nome, voce]) =>
          scrivi1(nome, voce).catch(() => {
            guasti++;
          }),
        ),
      );
    }
    //  shortcut: una scrittura fallita (disco pieno) non si ritenta da sola; la voce resta in memoria e si
    //  riscrive alla prossima modifica o al prossimo avvio la perde; si cambia se il disco si riempie spesso.
    if (guasti) registro("catalogo_disco_non_scrivibile", { file: guasti });
  }

  /** Scrive ora ciò che è in attesa. Non lancia mai. */
  function svuota() {
    annulla(timer);
    timer = null;
    timerMs = Infinity;
    const questo = giro.then(scriviTutto);
    giro = questo.catch(() => {});
    return giro;
  }

  function pota() {
    let scadute = 0;
    const adesso = orologio();
    for (const v of [...indice.values()]) {
      if (adesso >= scadenzaDi(v.ts)) {
        rimuovi(v.chiave);
        scadute++;
      }
    }
    return { scadute, eccesso: applicaTetto() };
  }

  function programmaPota() {
    if (fermato) return;
    timerPota = pianifica(() => {
      pota();
      void svuota();
      programmaPota();
    }, L.potaMs);
    timerPota?.unref?.();
  }

  async function carica() {
    const conti = { caricate: 0, scadute: 0, corrotte: 0 };
    await fs.mkdir(cartella, { recursive: true, mode: 0o700 });
    await fs.chmod(cartella, 0o700).catch(() => {}); // cartella non nostra: si va avanti
    let nomi = [];
    try {
      nomi = await fs.readdir(cartella);
    } catch {
      registro("catalogo_illeggibile");
    }
    for (let i = 0; i < nomi.length; i += L.gruppo) {
      await Promise.all(
        nomi.slice(i, i + L.gruppo).map(async (nome) => {
          const percorso = join(cartella, nome);
          let voce = null;
          if (FILE_VOCE.test(nome)) {
            try {
              const r = pulisci(JSON.parse(await fs.readFile(percorso, "utf8")));
              if (r.voce && nomeDi(r.voce.chiave) === nome) voce = r.voce;
            } catch {
              voce = null;
            }
          }
          if (!voce) {
            await fs.rm(percorso, { force: true }).catch(() => {});
            if (!nome.includes(".tmp-")) conti.corrotte++;
            return;
          }
          await fs.chmod(percorso, 0o600).catch(() => {});
          indice.set(voce.chiave, voce);
          conti.caricate++;
        }),
      );
    }
    if (conti.corrotte) registro("catalogo_voci_corrotte", { file: conti.corrotte });
    return conti;
  }

  function avvia() {
    avviato ??= (async () => {
      const conti = await carica();
      pronto = true;
      const p = pota();
      conti.scadute = p.scadute;
      programmaPota();
      await svuota();
      return conti;
    })();
    return avviato;
  }

  function aggiungi(dati) {
    if (fermato) return { ok: false, motivo: "fermato" };
    if (!pronto) return { ok: false, motivo: "non_avviato" };
    const r = pulisci(dati);
    if (!r.voce) return { ok: false, motivo: r.motivo };
    const voce = r.voce;
    if (orologio() >= scadenzaDi(voce.ts)) return { ok: false, motivo: "vecchia" };
    const gia = indice.get(voce.chiave);
    if (gia) {
      //  lo storico si ripresenta: una voce nota non si riscrive, e una in coda non torna a «solo catalogata»
      if (gia.stato === "in_coda" || voce.stato === "catalogato") return { ok: true, gia: true };
      metti({ ...gia, ...voce });
      return { ok: true };
    }
    metti(voce);
    return { ok: true };
  }

  function imposta(chiave, campi) {
    const gia = indice.get(chiave);
    if (fermato || !gia || !oggetto(campi)) return { ok: false, motivo: fermato ? "fermato" : "assente" };
    const nuovi = {};
    for (const [campo, valida] of Object.entries(DI_CODA)) {
      if (campi[campo] === undefined) continue;
      const valore = valida(campi[campo]);
      if (valore === undefined) return { ok: false, motivo: "non_valida" };
      nuovi[campo] = valore;
    }
    metti({ ...gia, ...nuovi });
    return { ok: true };
  }

  function togli(chiave) {
    if (typeof chiave === "string" && indice.has(chiave)) {
      rimuovi(chiave);
      programma(L.bufferMs);
    }
    return { ok: true };
  }

  async function ferma() {
    fermato = true;
    annulla(timerPota);
    timerPota = null;
    await svuota();
  }

  return {
    avvia,
    aggiungi,
    leggi: (chiave) => (indice.has(chiave) ? copia(indice.get(chiave)) : null),
    voci: (stato) => [...indice.values()].filter((v) => stato === undefined || v.stato === stato).map(copia),
    imposta,
    togli,
    pota,
    svuota,
    ferma,
    conteggio() {
      const in_coda = [...indice.values()].filter((v) => v.stato === "in_coda").length;
      return { voci: indice.size, in_coda, catalogato: indice.size - in_coda };
    },
  };
}
