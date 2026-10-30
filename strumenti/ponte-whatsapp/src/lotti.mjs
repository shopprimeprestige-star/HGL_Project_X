/** ── PONTE WHATSAPP · LA FILA, I LOTTI, I RITENTATIVI ──────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T5 (PIANO §a4, §b2).
 *  Puro più disco: la fila sta in una cartella (`fila/` sotto lo stato del
 *  ponte), un file per lotto, e si cancella SOLO dopo la risposta 200. Il
 *  tempo arriva da `orologio` e la rete da `fetch`: le prove li sostituiscono.
 *
 *    fila/storico/  lotti dello storico (`messaging-history.set`)
 *    fila/vivo/     lotti dei messaggi vivi (`messages.upsert`), pronti dopo
 *                   `ATTESA_PARI_SECONDI`; passano sempre prima dello storico
 *    fila/scartati/ lotti rifiutati (400, 413 su un messaggio solo, file
 *                   rotti): contengono testi di clienti, si cancellano dopo
 *                   14 giorni (`pulisciScartati`). Un 500 NON scarta mai: la
 *                   rotta lo dà per ogni errore del database (anche migrazione
 *                   mancante o Supabase giù) e lo storico arriva una volta sola
 *
 *  Ogni file: `{ lotto: LottoPonte, prossimo_il, primo_invio_il, tentativi,
 *  errori500, primo500_il, attese_lunghe }` (tempi in ms). Scrittura atomica: file temporaneo + `rename`.
 *
 *  Come si usa (T6): `aggiungi` quando arrivano messaggi; un giro che chiede
 *  `prossimo()`, lo spedisce con `spedisci` e passa la risposta a `esito`;
 *  `prossimaSveglia()` dice quando ripassare. Una spedizione alla volta.
 *
 *  I non noti (D7): i vivi rimandati in `non_noti` si ritentano per 10
 *  minuti, poi, come quelli dello storico, passano a `fuoriRubrica(messaggi,
 *  nomi)` (la cache sul Mac, `cache.mjs`, p3 30/10) prima di uscire dalla fila.
 *
 *  ⚠️ Qui passano testi e numeri: nessun `console.*`. I contatori sono numeri.
 *  ───────────────────────────────────────────────────────────────────────── */
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Ritmo e limiti (§a4, §b2). `messaggiStorico`/`messaggiVivo` = `LIMITI`
 *  di `src/crm/ponte/tipi.ts`; `lottoByte` resta sotto i 256 KB del server. */
export const RITMO = {
  messaggiStorico: 50,
  messaggiVivo: 200,
  lottoByte: 200 * 1024,
  /** pausa fra due lotti di storico; raddoppia su 429/5xx/rete fino al tetto */
  pausaStorico: 3000,
  pausaMassima: 30_000,
  /** lotti buoni di fila per tornare alla pausa di partenza */
  buoniPerTornare: 10,
  /** 429, 5xx, rete: attese del lotto, poi resta sull'ultima */
  ritentativi: [5000, 15_000, 60_000, 300_000],
  /** 401 e 503 (chiave o server non configurati): fino a 10 minuti */
  attesaChiave: [60_000, 120_000, 300_000, 600_000],
  /** tre 500 sullo stesso lotto → si divide a metà (lotto avvelenato), ma
   *  solo se dal primo di quei 500 un altro lotto o il battito ha avuto 200:
   *  allora il database funziona e il guaio è davvero quel lotto */
  erroriPerDividere: 3,
  /** il messaggio avvelenato da solo resta in fila: 1 h, 2 h, 4 h… fino a 24 h */
  attesaAvvelenato: 3_600_000,
  attesaAvvelenatoMassima: 86_400_000,
  /** vivi rimandati come `non_noti`: si ritentano ogni 60 s per 10 minuti */
  attesaNonNoti: 60_000,
  tenutaNonNoti: 600_000,
  /** oltre, lo storico non entra più (stato `coda_piena`); i vivi sì */
  maxFile: 2000,
  maxByte: 500 * 1024 * 1024,
  scadenzaScartati: 14 * 86_400_000,
};

const ORIGINI = ["storico", "vivo"];
const ATTESA_PARI_MS = 30_000;

const pesoJson = (x) => Buffer.byteLength(JSON.stringify(x));

/** Le voci di `nomi` dei soli numeri dei messaggi. */
function nomiDi(messaggi, nomi) {
  const fuori = {};
  for (const m of messaggi) if (nomi?.[m.numero] && !(m.numero in fuori)) fuori[m.numero] = nomi[m.numero];
  return fuori;
}

const lottoDi = (origine, messaggi, nomi) => ({ v: 1, tipo: "lotto", origine, messaggi, nomi: nomiDi(messaggi, nomi) });

/** Messaggi → `LottoPonte[]`: al più 50 (storico) o 200 (vivi) messaggi e
 *  `RITMO.lottoByte` byte ciascuno. I vivi si ordinano per chat (stabile),
 *  così i messaggi di uno stesso cliente viaggiano insieme. */
export function impacchetta(origine, messaggi, nomi = {}) {
  const max = origine === "storico" ? RITMO.messaggiStorico : RITMO.messaggiVivo;
  const lista = origine === "vivo" ? [...messaggi].sort((a, b) => (a.numero < b.numero ? -1 : a.numero > b.numero ? 1 : 0)) : [...messaggi];
  const vuoto = pesoJson(lottoDi(origine, [], {}));
  const lotti = [];
  let corrente = [];
  let peso = vuoto;
  for (const m of lista) {
    // il messaggio, la virgola, e il suo nome se non c'è già
    const nuovoNome = nomi?.[m.numero] && !corrente.some((x) => x.numero === m.numero);
    const p = pesoJson(m) + 1 + (nuovoNome ? pesoJson({ [m.numero]: nomi[m.numero] }) : 0);
    if (corrente.length && (corrente.length >= max || peso + p > RITMO.lottoByte)) {
      lotti.push(lottoDi(origine, corrente, nomi));
      corrente = [];
      peso = vuoto;
    }
    corrente.push(m);
    peso += p;
  }
  if (corrente.length) lotti.push(lottoDi(origine, corrente, nomi));
  return lotti;
}

/** Un lotto in due metà (la prima ha il messaggio in più). */
function dividi(lotto) {
  const meta = Math.ceil(lotto.messaggi.length / 2);
  return [lotto.messaggi.slice(0, meta), lotto.messaggi.slice(meta)].map((m) => lottoDi(lotto.origine, m, lotto.nomi));
}

/** Il file ha la forma che scriviamo noi? */
function datiValidi(d, origine) {
  return (
    d &&
    typeof d === "object" &&
    d.lotto?.origine === origine &&
    Array.isArray(d.lotto.messaggi) &&
    d.lotto.messaggi.length > 0 &&
    d.lotto.messaggi.every((m) => m && typeof m.id === "string" && typeof m.numero === "string") &&
    Number.isFinite(d.prossimo_il)
  );
}

/** La fila su disco.
 *
 *  `opzioni`: `cartella` (obbligatoria), `orologio` (ms, di serie
 *  `Date.now`), `attesaPariMs` (di serie 30 s, da `ATTESA_PARI_SECONDI`),
 *  `limiti` (per le prove: `{ maxFile, maxByte }`), `fuoriRubrica(messaggi,
 *  nomi)` (riceve i messaggi dei numeri che il CRM non conosce; se lancia, la
 *  fila va avanti lo stesso). */
export function creaFila({ cartella, orologio = Date.now, attesaPariMs = ATTESA_PARI_MS, limiti = {}, fuoriRubrica = () => {} }) {
  const maxFile = limiti.maxFile ?? RITMO.maxFile;
  const maxByte = limiti.maxByte ?? RITMO.maxByte;
  const dir = { storico: join(cartella, "storico"), vivo: join(cartella, "vivo"), scartati: join(cartella, "scartati") };
  for (const d of [cartella, ...Object.values(dir)]) mkdirSync(d, { recursive: true, mode: 0o700 });

  /** nome del file → { origine, dati, byte }: la fila in memoria, specchio del disco */
  const indice = new Map();
  const inVolo = new Set();
  let progressivo = 0;
  const ritmo = { pausa: RITMO.pausaStorico, buoni: 0, ultimo: -Infinity };
  /** l'ultimo 200 dal server (un lotto o il battito, `segnalaBuono`), in ms */
  let ultimoBuono = -Infinity;
  const conti = { scartati: 0, non_noti_scaduti: 0, divisi: 0 };

  function nuovoNome(origine) {
    let nome;
    do nome = `${String(orologio()).padStart(13, "0")}-${String(progressivo++ % 1e6).padStart(6, "0")}-${origine}.json`;
    while (indice.has(nome));
    return nome;
  }

  function scrivi(nome, origine, dati) {
    const testo = JSON.stringify(dati);
    const finale = join(dir[origine], nome);
    const temporaneo = `${finale}.tmp-${process.pid}`;
    writeFileSync(temporaneo, testo, { mode: 0o600 });
    renameSync(temporaneo, finale);
    indice.set(nome, { origine, dati, byte: Buffer.byteLength(testo) });
  }

  /** Passa i non noti alla cache: prima di togliere il lotto dal disco. */
  function allaCache(messaggi, nomi) {
    try {
      fuoriRubrica(messaggi, nomiDi(messaggi, nomi));
    } catch {
      // la cache non è la fila: un suo errore non ferma gli invii
    }
  }

  function togli(nome, origine) {
    rmSync(join(dir[origine], nome), { force: true });
    indice.delete(nome);
  }

  /** Sposta un file in `scartati/` con la data di adesso (per i 14 giorni). */
  function scarta(nome, origine, motivo) {
    const dest = join(dir.scartati, `${String(orologio()).padStart(13, "0")}-${motivo}-${nome}`);
    renameSync(join(dir[origine], nome), dest);
    const s = orologio() / 1000;
    utimesSync(dest, s, s);
    indice.delete(nome);
    conti.scartati++;
  }

  // Al via: si rilegge il disco; i temporanei lasciati a metà si tolgono, i
  // file rotti vanno in scartati/ e il resto prosegue.
  for (const origine of ORIGINI) {
    for (const nome of readdirSync(dir[origine]).sort()) {
      if (nome.includes(".tmp-")) {
        rmSync(join(dir[origine], nome), { force: true });
        continue;
      }
      if (!nome.endsWith(".json")) continue;
      let dati = null;
      try {
        dati = JSON.parse(readFileSync(join(dir[origine], nome), "utf8"));
      } catch {
        dati = null;
      }
      if (datiValidi(dati, origine)) indice.set(nome, { origine, dati, byte: statSync(join(dir[origine], nome)).size });
      else {
        indice.set(nome, { origine, dati: null, byte: 0 });
        scarta(nome, origine, "corrotto");
      }
    }
  }

  const byte = () => [...indice.values()].reduce((s, v) => s + v.byte, 0);
  const piena = () => indice.size >= maxFile || byte() >= maxByte;

  /** Mette in fila dei `MessaggioPonte` (e i loro `nomi`). Lo storico non
   *  entra se la fila è piena (stato `coda_piena`); i vivi entrano sempre.
   *  `prontoIl` (ms) per i vivi: di serie adesso + `attesaPariMs`. */
  function aggiungi(origine, messaggi, nomi = {}, { prontoIl } = {}) {
    if (!ORIGINI.includes(origine)) throw new Error("origine_non_valida");
    const pronto = prontoIl ?? (origine === "vivo" ? orologio() + attesaPariMs : orologio());
    let accettati = 0;
    let lotti = 0;
    for (const lotto of impacchetta(origine, messaggi, nomi)) {
      if (origine === "storico" && piena()) return { accettati, lotti, piena: true };
      scrivi(nuovoNome(origine), origine, { lotto, prossimo_il: pronto, primo_invio_il: null, tentativi: 0, errori500: 0 });
      accettati += lotto.messaggi.length;
      lotti++;
    }
    return { accettati, lotti, piena: false };
  }

  /** Il prossimo lotto da spedire, o null. Prima i vivi pronti; poi lo
   *  storico, uno alla volta e solo se è passata la pausa dall'ultima
   *  risposta dello storico (il ritmo vale da risposta a richiesta). */
  function prossimo() {
    const adesso = orologio();
    const pronti = (origine) => [...indice.entries()].filter(([n, v]) => v.origine === origine && !inVolo.has(n) && v.dati.prossimo_il <= adesso).map(([n]) => n).sort();
    const storicoInVolo = [...inVolo].some((n) => indice.get(n)?.origine === "storico");
    let nome = pronti("vivo")[0];
    if (!nome && !storicoInVolo && adesso >= ritmo.ultimo + ritmo.pausa) nome = pronti("storico")[0];
    if (!nome) return null;
    const v = indice.get(nome);
    if (v.dati.primo_invio_il === null) v.dati.primo_invio_il = adesso;
    inVolo.add(nome);
    return { nome, origine: v.origine, lotto: v.dati.lotto };
  }

  /** Quando ripassare (ms): il primo `prossimo_il` utile, o null a fila vuota. */
  function prossimaSveglia() {
    let min = null;
    for (const [n, v] of indice) {
      if (inVolo.has(n)) continue;
      const t = v.origine === "storico" ? Math.max(v.dati.prossimo_il, ritmo.ultimo + ritmo.pausa) : v.dati.prossimo_il;
      if (min === null || t < min) min = t;
    }
    return min;
  }

  /** Divide il lotto (413 o tre 500 col database vivo); col 413 un
   *  messaggio solo va in scartati/ (troppo grande lo resta per sempre). */
  function dividiOScarta(nome, v, motivo) {
    if (v.dati.lotto.messaggi.length <= 1) {
      scarta(nome, v.origine, motivo);
      return "scartato";
    }
    for (const lotto of dividi(v.dati.lotto)) {
      scrivi(nuovoNome(v.origine), v.origine, { lotto, prossimo_il: orologio(), primo_invio_il: v.dati.primo_invio_il, tentativi: 0, errori500: 0 });
    }
    togli(nome, v.origine);
    conti.divisi++;
    return "diviso";
  }

  function rimanda(nome, v, attese) {
    v.dati.prossimo_il = orologio() + attese[Math.min(v.dati.tentativi, attese.length - 1)];
    v.dati.tentativi++;
    scrivi(nome, v.origine, v.dati);
  }

  /** Applica la risposta del server (`{ stato, corpo }` di `spedisci`;
   *  `stato` null = rete) al lotto `voce` avuto da `prossimo()`.
   *  Restituisce `{ azione, stato?, pausaStorico }`: `azione` fra
   *  `cancellato`, `tenuto` (non_noti), `scaduto` (non_noti oltre 10 minuti),
   *  `diviso`, `scartato`, `ritenta`; `stato: 'errore'` su 401/503. */
  function esito(voce, { stato, corpo } = {}) {
    const adesso = orologio();
    inVolo.delete(voce.nome);
    const v = indice.get(voce.nome);
    if (!v) return { azione: "assente", pausaStorico: ritmo.pausa };
    const storico = v.origine === "storico";
    let azione;
    let statoPonte;
    let errore = false;

    if (stato === 200) {
      ultimoBuono = adesso;
      const ids = Array.isArray(corpo?.non_noti) ? new Set(corpo.non_noti.filter((x) => typeof x === "string")) : new Set();
      const tenere = v.dati.lotto.messaggi.filter((m) => ids.has(m.id));
      if (tenere.length === 0 || storico) {
        // storico: i non noti non si ritentano, vanno nella cache sul Mac (p3)
        if (tenere.length) allaCache(tenere, v.dati.lotto.nomi);
        togli(voce.nome, v.origine);
        azione = "cancellato";
      } else if (adesso - (v.dati.primo_invio_il ?? adesso) < RITMO.tenutaNonNoti) {
        // D7: il numero non è (ancora) del CRM; ManyChat può crearlo a momenti
        v.dati.lotto = lottoDi(v.origine, tenere, v.dati.lotto.nomi);
        v.dati.prossimo_il = adesso + RITMO.attesaNonNoti;
        v.dati.tentativi = 0;
        v.dati.errori500 = 0;
        scrivi(voce.nome, v.origine, v.dati);
        azione = "tenuto";
      } else {
        // non è del CRM: nella cache sul Mac (p3), mai in scartati/ (R10)
        allaCache(tenere, v.dati.lotto.nomi);
        togli(voce.nome, v.origine);
        conti.non_noti_scaduti += tenere.length;
        azione = "scaduto";
      }
    } else if (stato === 413) {
      azione = dividiOScarta(voce.nome, v, "troppo_grande");
    } else if (stato === 400) {
      scarta(voce.nome, v.origine, "rifiutato");
      azione = "scartato";
    } else if (stato === 401 || stato === 503) {
      rimanda(voce.nome, v, RITMO.attesaChiave);
      azione = "ritenta";
      statoPonte = "errore";
    } else if (stato === 500) {
      errore = true;
      v.dati.errori500++;
      v.dati.primo500_il ??= adesso;
      const databaseVivo = ultimoBuono > v.dati.primo500_il;
      const troppi = v.dati.errori500 >= RITMO.erroriPerDividere;
      if (troppi && databaseVivo && v.dati.lotto.messaggi.length > 1) azione = dividiOScarta(voce.nome, v, "errore_500");
      else if (troppi && databaseVivo) {
        // il messaggio avvelenato, da solo: in fila con un'attesa lunga, mai buttato
        const volte = v.dati.attese_lunghe ?? 0;
        v.dati.attese_lunghe = volte + 1;
        v.dati.prossimo_il = adesso + Math.min(RITMO.attesaAvvelenato * 2 ** Math.min(volte, 10), RITMO.attesaAvvelenatoMassima);
        scrivi(voce.nome, v.origine, v.dati);
        azione = "ritenta";
      } else {
        // nessun 200 da quando il lotto fallisce: il database è giù, si aspetta
        rimanda(voce.nome, v, RITMO.ritentativi);
        azione = "ritenta";
      }
    } else {
      // 429, altri 5xx, rete, e ogni risposta inattesa: si ritenta, non si butta
      errore = stato === null || stato === 429 || stato >= 500;
      rimanda(voce.nome, v, RITMO.ritentativi);
      azione = "ritenta";
    }

    if (storico) {
      ritmo.ultimo = adesso;
      if (stato === 200) {
        ritmo.buoni++;
        if (ritmo.buoni >= RITMO.buoniPerTornare) {
          ritmo.pausa = RITMO.pausaStorico;
          ritmo.buoni = 0;
        }
      } else if (errore) {
        ritmo.pausa = Math.min(ritmo.pausa * 2, RITMO.pausaMassima);
        ritmo.buoni = 0;
      }
    }
    return statoPonte ? { azione, stato: statoPonte, pausaStorico: ritmo.pausa } : { azione, pausaStorico: ritmo.pausa };
  }

  /** Solo numeri, per il battito e per il log. */
  function contatori() {
    let in_coda = 0;
    let lotti_storico = 0;
    let lotti_vivo = 0;
    for (const v of indice.values()) {
      in_coda += v.dati.lotto.messaggi.length;
      if (v.origine === "storico") lotti_storico++;
      else lotti_vivo++;
    }
    let scartati = 0;
    try {
      scartati = readdirSync(dir.scartati).length;
    } catch {
      scartati = 0;
    }
    return { in_coda, lotti_storico, lotti_vivo, scartati, non_noti_scaduti: conti.non_noti_scaduti, divisi: conti.divisi, piena: piena() };
  }

  /** Cancella i file di `scartati/` più vecchi di 14 giorni; dice quanti. */
  function pulisciScartati() {
    const limite = orologio() - RITMO.scadenzaScartati;
    let tolti = 0;
    for (const nome of readdirSync(dir.scartati)) {
      const p = join(dir.scartati, nome);
      try {
        if (statSync(p).mtimeMs < limite) {
          rmSync(p, { force: true, recursive: true });
          tolti++;
        }
      } catch {
        // sparito nel frattempo: niente da fare
      }
    }
    return tolti;
  }

  /** Un 200 arrivato da fuori della fila (il battito): il database risponde. */
  function segnalaBuono() {
    ultimoBuono = orologio();
  }

  return { aggiungi, prossimo, esito, segnalaBuono, prossimaSveglia, contatori, pulisciScartati };
}

/** Spedisce un corpo (lotto o battito) alla rotta del CRM.
 *  Restituisce `{ stato, corpo }`: `stato` null se la rete non risponde (o
 *  scade il tempo, o c'è un redirect: il token non segue altri indirizzi);
 *  `corpo` null se la risposta non è JSON. Non scrive niente nei log. */
export async function spedisci({ url, token, corpo, fetch = globalThis.fetch, timeoutMs = 30_000 }) {
  let risposta;
  try {
    risposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-HGL-Token": token },
      body: JSON.stringify(corpo),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { stato: null, corpo: null };
  }
  let letto = null;
  try {
    letto = JSON.parse(await risposta.text());
  } catch {
    letto = null;
  }
  return { stato: risposta.status, corpo: letto };
}
