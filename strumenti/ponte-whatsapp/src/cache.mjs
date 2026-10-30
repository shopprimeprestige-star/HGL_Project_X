/** ── PONTE WHATSAPP · LA CACHE DEI NUMERI FUORI DAL CRM ─────────────────────
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p3-ponte-storico (idea 5).
 *  Un numero che il CRM non conosce (D7) non entra nel CRM. Prima i suoi
 *  messaggi si buttavano; adesso restano qui, sul Mac, e quando il numero
 *  diventa noto (una scheda, un contatto di ManyChat) la sua cronologia va in
 *  fila come `storico` (niente notifiche né «risposto»: D8 vale solo per i vivi).
 *
 *    cache/<32 cifre esadecimali>.bin   un file per numero, permessi 600
 *    chiave-cache                       32 byte casuali, permessi 600
 *
 *  Il nome del file è un HMAC del numero: dal nome non si risale al numero.
 *  Il contenuto `{ numero, nome, messaggi }` è cifrato con AES-256-GCM
 *  (iv 12 byte | tag 16 byte | dati). Si tengono solo i messaggi degli ultimi
 *  `CACHE.giorni` (orario vero di WhatsApp); `pulisci()` toglie il resto.
 *  shortcut: la chiave sta in un file accanto alla cache (600, fuori dal
 *   repo e da iCloud): protegge dalle copie della sola cache, non da chi legge
 *   tutto il profilo; se serve di più, portarla nel Portachiavi di macOS.
 *
 *  `controllaCache` chiede al CRM (corpo `noti`, solo cifre) quali numeri
 *  conosce adesso e mette in fila la loro cronologia. La rete arriva da fuori
 *  (`invia`), il tempo da `orologio`: le prove li sostituiscono.
 *
 *  ⚠️ Qui passano numeri, nomi e testi: nessun `console.*`, nessun log. I
 *   contatori sono numeri. Niente WhatsApp: solo disco.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const CACHE = {
  /** i messaggi più vecchi (orario di WhatsApp) non si tengono */
  giorni: 90,
  /** shortcut: oltre questi numeri i nuovi non entrano (si contano in
   *  `rifiutati`); se il battito li mostra spesso, togliere i più vecchi */
  maxNumeri: 5000,
  /** per numero si tengono i messaggi più recenti */
  maxPerNumero: 1000,
  /** numeri per richiesta `noti`: `LIMITI.numeri` di `src/crm/ponte/tipi.ts` */
  perRichiesta: 200,
};

const NUMERO = /^\d{8,15}$/;
const ID = /^[A-Za-z0-9_.-]{1,128}$/;
const AAD = Buffer.from("hgl-ponte-cache-v1");
const GIORNO_S = 86_400;

/** Scrittura atomica (temporaneo + rename) con permessi 600. */
function scriviAtomico(percorso, dati) {
  const temporaneo = `${percorso}.tmp-${process.pid}`;
  writeFileSync(temporaneo, dati, { mode: 0o600 });
  renameSync(temporaneo, percorso);
}

/** La chiave della cache: 32 byte da `percorso`. Se il file MANCA o ha una
 *  lunghezza sbagliata se ne crea una nuova (la cache vecchia diventa
 *  illeggibile e `creaCache` la toglie). Ogni altro errore di lettura
 *  (permesso momentaneo, una cartella al posto del file) LANCIA: chi chiama
 *  salta la cache per quel giro, e la chiave buona non si perde. I permessi
 *  si riportano a 600. */
export function chiaveCache(percorso) {
  let letta = null;
  try {
    letta = readFileSync(percorso);
  } catch (e) {
    if (e?.code !== "ENOENT") throw e;
  }
  if (letta?.length === 32) {
    chmodSync(percorso, 0o600);
    return letta;
  }
  const nuova = randomBytes(32);
  scriviAtomico(percorso, nuova);
  return nuova;
}

/** Un messaggio come lo scrive `estrai.mjs` (`MessaggioPonte`), o null. */
function valido(m) {
  return m &&
    typeof m === "object" &&
    typeof m.id === "string" &&
    ID.test(m.id) &&
    typeof m.numero === "string" &&
    NUMERO.test(m.numero) &&
    Number.isInteger(m.ts)
    ? m
    : null;
}

/** La cache su disco.
 *
 *  `opzioni`: `cartella` e `chiave` (32 byte, `chiaveCache`) obbligatorie;
 *  `orologio` (ms, di serie `Date.now`); `limiti` (per le prove:
 *  `{ maxNumeri, maxPerNumero }`).
 *  Uscita: `{ metti, numeri, prendi, togli, pulisci, contatori }`. */
export function creaCache({ cartella, chiave, orologio = Date.now, limiti = {} }) {
  const maxNumeri = limiti.maxNumeri ?? CACHE.maxNumeri;
  const maxPerNumero = limiti.maxPerNumero ?? CACHE.maxPerNumero;
  const chiaveCifra = Buffer.from(
    hkdfSync("sha256", chiave, Buffer.alloc(0), "hgl-ponte-cache-cifra", 32),
  );
  const chiaveNome = Buffer.from(
    hkdfSync("sha256", chiave, Buffer.alloc(0), "hgl-ponte-cache-nome", 32),
  );
  mkdirSync(cartella, { recursive: true, mode: 0o700 });
  chmodSync(cartella, 0o700);

  /** numero → { file, messaggi }: solo quanti, i testi restano sul disco */
  const indice = new Map();
  /** `errori` = scritture fallite (disco pieno, permessi): il battito le mostra */
  const conti = { illeggibili: 0, rifiutati: 0, errori: 0 };

  const fileDi = (numero) =>
    join(
      cartella,
      `${createHmac("sha256", chiaveNome).update(numero).digest("hex").slice(0, 32)}.bin`,
    );
  const limite = () => Math.floor(orologio() / 1000) - CACHE.giorni * GIORNO_S;

  function cifra(voce) {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", chiaveCifra, iv);
    c.setAAD(AAD);
    const dati = Buffer.concat([c.update(JSON.stringify(voce), "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), dati]);
  }

  /** Il contenuto di un file, o null se non si legge (chiave diversa, rotto). */
  function decifra(percorso) {
    try {
      const b = readFileSync(percorso);
      const d = createDecipheriv("aes-256-gcm", chiaveCifra, b.subarray(0, 12));
      d.setAAD(AAD);
      d.setAuthTag(b.subarray(12, 28));
      const voce = JSON.parse(
        Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"),
      );
      return voce && NUMERO.test(voce.numero) && Array.isArray(voce.messaggi) ? voce : null;
    } catch {
      return null;
    }
  }

  /** Scrive la voce (o cancella il file se non ha più messaggi). Non lancia:
   *  una scrittura fallita si conta in `errori` e restituisce false. */
  function salva(voce) {
    const file = fileDi(voce.numero);
    try {
      if (!voce.messaggi.length) {
        rmSync(file, { force: true });
        indice.delete(voce.numero);
        return true;
      }
      scriviAtomico(file, cifra(voce));
      indice.set(voce.numero, { file, messaggi: voce.messaggi.length });
      return true;
    } catch {
      conti.errori++;
      rmSync(`${file}.tmp-${process.pid}`, { force: true });
      return false;
    }
  }

  // Al via: si rilegge la cartella; i temporanei e i file illeggibili si tolgono.
  for (const nome of readdirSync(cartella)) {
    const p = join(cartella, nome);
    if (!nome.endsWith(".bin")) {
      rmSync(p, { force: true, recursive: true });
      continue;
    }
    const voce = decifra(p);
    if (!voce || fileDi(voce.numero) !== p) {
      rmSync(p, { force: true });
      conti.illeggibili++;
      continue;
    }
    indice.set(voce.numero, { file: p, messaggi: voce.messaggi.length });
  }

  /** Aggiunge messaggi (`MessaggioPonte[]`) e i loro `nomi` (cifre → nome).
   *  Lo stesso id una volta sola, in ordine di orario, solo gli ultimi
   *  `CACHE.giorni`, al più `maxPerNumero` per numero. Restituisce
   *  `{ messi, rifiutati }` (rifiutati = oltre il tetto di numeri). */
  function metti(messaggi, nomi = {}) {
    const dal = limite();
    const perNumero = new Map();
    for (const m of Array.isArray(messaggi) ? messaggi : []) {
      if (!valido(m) || m.ts < dal) continue;
      if (!perNumero.has(m.numero)) perNumero.set(m.numero, []);
      perNumero.get(m.numero).push(m);
    }
    let messi = 0;
    let rifiutati = 0;
    for (const [numero, nuovi] of perNumero) {
      const vecchia = indice.has(numero) ? decifra(fileDi(numero)) : null;
      if (!vecchia && indice.size >= maxNumeri) {
        rifiutati += nuovi.length;
        continue;
      }
      const perId = new Map(
        (vecchia?.messaggi ?? []).filter((m) => m.ts >= dal).map((m) => [m.id, m]),
      );
      const prima = perId.size;
      for (const m of nuovi) perId.set(m.id, m);
      const tutti = [...perId.values()]
        .sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(-maxPerNumero);
      const nome =
        typeof nomi?.[numero] === "string" && nomi[numero] ? nomi[numero] : (vecchia?.nome ?? null);
      if (salva({ numero, nome, messaggi: tutti })) messi += perId.size - prima;
    }
    conti.rifiutati += rifiutati;
    return { messi, rifiutati };
  }

  /** La cronologia di un numero: `{ messaggi, nomi }` pronta per
   *  `fila.aggiungi("storico", …)`, o null. */
  function prendi(numero) {
    if (!indice.has(numero)) return null;
    const voce = decifra(fileDi(numero));
    if (!voce) return null;
    return { messaggi: voce.messaggi, nomi: voce.nome ? { [numero]: voce.nome } : {} };
  }

  function togli(numero) {
    rmSync(fileDi(numero), { force: true });
    indice.delete(numero);
  }

  /** Toglie i messaggi più vecchi di `CACHE.giorni`; dice quanti. */
  function pulisci() {
    const dal = limite();
    let tolti = 0;
    for (const numero of [...indice.keys()]) {
      const voce = decifra(fileDi(numero));
      if (!voce) {
        togli(numero);
        conti.illeggibili++;
        continue;
      }
      const tenuti = voce.messaggi.filter((m) => m.ts >= dal);
      if (tenuti.length === voce.messaggi.length) continue;
      tolti += voce.messaggi.length - tenuti.length;
      salva({ ...voce, messaggi: tenuti });
    }
    return tolti;
  }

  /** Solo numeri, per il battito e per il log. */
  function contatori() {
    let messaggi = 0;
    for (const v of indice.values()) messaggi += v.messaggi;
    return {
      numeri: indice.size,
      messaggi,
      illeggibili: conti.illeggibili,
      rifiutati: conti.rifiutati,
      errori: conti.errori,
    };
  }

  return { metti, numeri: () => [...indice.keys()].sort(), prendi, togli, pulisci, contatori };
}

/** Chiede al CRM quali numeri della cache conosce adesso (`RichiestaNoti`, a
 *  gruppi di `CACHE.perRichiesta`) e mette in fila come `storico` la loro
 *  cronologia; la cache la dimentica solo quando è tutta in fila. Una
 *  risposta che non è 200 (rete, CRM di prima che risponde 400) ferma il
 *  giro: si riprova al prossimo. Restituisce solo numeri:
 *  `{ chiesti, noti, promossi, stato, piena? }` (`stato` 0 = rete). */
export async function controllaCache({ cache, fila, invia }) {
  const tutti = cache.numeri();
  const esito = { chiesti: 0, noti: 0, promossi: 0, stato: 200 };
  for (let i = 0; i < tutti.length; i += CACHE.perRichiesta) {
    const numeri = tutti.slice(i, i + CACHE.perRichiesta);
    const r = await invia({ v: 1, tipo: "noti", numeri });
    if (r?.stato !== 200 || !Array.isArray(r.corpo?.noti)) {
      esito.stato = r?.stato ?? 0;
      return esito;
    }
    esito.chiesti += numeri.length;
    const chiesti = new Set(numeri);
    for (const n of r.corpo.noti) {
      if (!chiesti.has(n)) continue;
      esito.noti++;
      const voce = cache.prendi(n);
      if (!voce) continue;
      // con la fila piena la cronologia resta qui (lo storico è idempotente nel CRM)
      if (fila.aggiungi("storico", voce.messaggi, voce.nomi).piena)
        return { ...esito, piena: true };
      cache.togli(n);
      esito.promossi += voce.messaggi.length;
    }
  }
  return esito;
}
