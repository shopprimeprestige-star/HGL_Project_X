/** ── PROVE: IL SERVIZIO SUL MAC: LA CACHE DEI NUMERI FUORI DAL CRM ──
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p3-ponte-storico (idea 5).
 *  I messaggi dei numeri che il CRM non conosce restano sul Mac in una cache
 *  cifrata (AES-256-GCM, file 600, nomi dei file senza numeri), al più 90
 *  giorni; quando il numero diventa noto la sua cronologia va in fila come
 *  storico e la cache la dimentica. La rete non si usa mai (`invia` finto).
 *  Dati inventati (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const T0 = Date.UTC(2026, 9, 30, 12, 0, 0);
const S0 = T0 / 1000;
const GIORNO = 86_400;
const C1 = "393330000001";
const C2 = "393330000002";
const C3 = "393330000003";
const permessi = (p) => statSync(p).mode & 0o777;
const msg = (id, numero, ts = S0 - 3600, extra = {}) => ({
  id,
  numero,
  dir: "in",
  ts,
  testo: `testo segreto ${id}`,
  tipo: "testo",
  ...extra,
});

function orologio() {
  let t = T0;
  const o = () => t;
  o.vai = (ms) => (t += ms);
  return o;
}

export async function provePonteServizioCache(_mod, { c, gruppo, radice }) {
  const src = (f) => pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src", f)).href;
  const K = await import(src("cache.mjs"));
  const L = await import(src("lotti.mjs"));
  const base = mkdtempSync(join(tmpdir(), "ponte-cache-"));
  let n = 0;
  const nuova = () => join(base, `c${n++}`);

  try {
    gruppo("PONTE WHATSAPP · IL SERVIZIO: CACHE DEI NUMERI FUORI DAL CRM (p3)");

    c("la cache tiene 90 giorni", 90, K.CACHE.giorni);

    // ── La chiave: 32 byte casuali, file 600, la stessa a ogni avvio ──
    {
      const p = join(base, "chiave-cache");
      const k1 = K.chiaveCache(p);
      c("chiave: 32 byte, file con permessi 600", [32, 0o600], [k1.length, permessi(p)]);
      c("chiave: al secondo avvio si rilegge la stessa", true, K.chiaveCache(p).equals(k1));
      writeFileSync(p, "corta");
      const k2 = K.chiaveCache(p);
      c(
        "chiave rovinata → se ne fa una nuova (la cache vecchia diventa illeggibile)",
        [32, false],
        [k2.length, k2.equals(k1)],
      );
    }

    // ── Scrivere, rileggere, cifrare ──
    {
      const cart = nuova();
      const chiave = K.chiaveCache(join(base, "k1"));
      const ora = orologio();
      const cache = K.creaCache({ cartella: cart, chiave, orologio: ora });
      c("cartella della cache con permessi 700", 0o700, permessi(cart));
      const r = cache.metti(
        [
          msg("A1", C1),
          msg("A2", C1, S0 - 7200),
          msg("B1", C2, S0 - 60, { dir: "out", stato: "read" }),
        ],
        { [C1]: "Fornitore Finto", [C3]: "Altro" },
      );
      c("metti: messaggi tenuti e nessuno rifiutato", { messi: 3, rifiutati: 0 }, r);
      const file = readdirSync(cart);
      c(
        "un file per numero, permessi 600, nessun temporaneo",
        [2, [0o600, 0o600], []],
        [
          file.length,
          file.map((f) => permessi(join(cart, f))),
          file.filter((f) => f.includes(".tmp-")),
        ],
      );
      c(
        "i nomi dei file non contengono il numero",
        [],
        file.filter((f) => f.includes("3933300")),
      );
      const grezzo = file.map((f) => readFileSync(join(cart, f)).toString("latin1")).join("|");
      c(
        "dentro i file nessun numero, testo o nome in chiaro (cifrati)",
        [],
        ["3933300", "segreto", "Fornitore", "testo"].filter((x) => grezzo.includes(x)),
      );
      c("numeri() li elenca, in ordine", [C1, C2], cache.numeri());
      c(
        "prendi(): i messaggi in ordine di orario e il nome",
        { messaggi: [msg("A2", C1, S0 - 7200), msg("A1", C1)], nomi: { [C1]: "Fornitore Finto" } },
        cache.prendi(C1),
      );
      c(
        "prendi(): l'uscita tiene lo stato, senza nome → nomi vuoti",
        { messaggi: [msg("B1", C2, S0 - 60, { dir: "out", stato: "read" })], nomi: {} },
        cache.prendi(C2),
      );
      c("prendi() di un numero assente → null", null, cache.prendi(C3));

      cache.metti([msg("A1", C1), msg("A3", C1, S0 - 10)], { [C1]: "Nome Nuovo" });
      c(
        "lo stesso id due volte resta uno; il nome nuovo vince",
        [["A2", "A1", "A3"], "Nome Nuovo"],
        [cache.prendi(C1).messaggi.map((m) => m.id), cache.prendi(C1).nomi[C1]],
      );

      const dopo = K.creaCache({ cartella: cart, chiave, orologio: ora });
      c(
        "dopo un riavvio la cache si rilegge dal disco",
        [[C1, C2], 3],
        [dopo.numeri(), dopo.prendi(C1).messaggi.length],
      );
      c(
        "contatori: solo numeri",
        { numeri: 2, messaggi: 4, illeggibili: 0, rifiutati: 0 },
        dopo.contatori(),
      );

      dopo.togli(C1);
      c(
        "togli(): il numero sparisce dalla cache e dal disco",
        [[C2], 1],
        [dopo.numeri(), readdirSync(cart).length],
      );

      const altra = K.creaCache({
        cartella: cart,
        chiave: K.chiaveCache(join(base, "k-altra")),
        orologio: ora,
      });
      c(
        "con un'altra chiave i file non si leggono: si tolgono e si contano",
        [[], 1, 0],
        [altra.numeri(), altra.contatori().illeggibili, readdirSync(cart).length],
      );
    }

    // ── I 90 giorni ──
    {
      const cart = nuova();
      const ora = orologio();
      const cache = K.creaCache({
        cartella: cart,
        chiave: K.chiaveCache(join(base, "k2")),
        orologio: ora,
      });
      const r = cache.metti(
        [
          msg("V1", C1, S0 - 91 * GIORNO),
          msg("V2", C1, S0 - 89 * GIORNO),
          msg("V3", C2, S0 - 100 * GIORNO),
        ],
        {},
      );
      c(
        "i messaggi più vecchi di 90 giorni non entrano",
        [{ messi: 1, rifiutati: 0 }, [C1]],
        [r, cache.numeri()],
      );
      ora.vai(2 * GIORNO * 1000);
      c(
        "pulisci(): dopo 90 giorni il messaggio si toglie; il numero vuoto sparisce dal disco",
        [1, [], []],
        [cache.pulisci(), cache.numeri(), readdirSync(cart)],
      );
    }

    // ── I limiti ──
    {
      const cart = nuova();
      const cache = K.creaCache({
        cartella: cart,
        chiave: K.chiaveCache(join(base, "k3")),
        orologio: orologio(),
        limiti: { maxNumeri: 2, maxPerNumero: 3 },
      });
      const r = cache.metti(
        [
          msg("1", C1, S0 - 50),
          msg("2", C1, S0 - 40),
          msg("3", C1, S0 - 30),
          msg("4", C1, S0 - 20),
          msg("5", C2),
          msg("6", C3),
        ],
        {},
      );
      c(
        "oltre il tetto di numeri i nuovi non entrano (si contano)",
        [[C1, C2], 1],
        [cache.numeri(), r.rifiutati],
      );
      c(
        "per numero si tengono i più recenti",
        ["2", "3", "4"],
        cache.prendi(C1).messaggi.map((m) => m.id),
      );
      c(
        "righe non valide (numero, id) non entrano",
        [0, [C1, C2]],
        [cache.metti([msg("x", "abc"), msg("a b", C1), null], {}).messi, cache.numeri()],
      );
    }

    // ── Il controllo: quando il numero diventa noto, la cronologia va in fila ──
    {
      const ora = orologio();
      const cache = K.creaCache({
        cartella: nuova(),
        chiave: K.chiaveCache(join(base, "k4")),
        orologio: ora,
      });
      const fila = L.creaFila({ cartella: nuova(), orologio: ora });
      cache.metti([msg("P1", C1), msg("P2", C1, S0 - 30), msg("Q1", C2)], { [C1]: "Ora Cliente" });
      const corpi = [];
      const invia = async (corpo) => {
        corpi.push(corpo);
        return { stato: 200, corpo: { ok: true, noti: [C1, "393339999999"] } };
      };
      const e = await K.controllaCache({ cache, fila, invia });
      c(
        "controllo: chiede al CRM solo i numeri (tipo noti), mai i testi",
        [{ v: 1, tipo: "noti", numeri: [C1, C2] }],
        corpi,
      );
      c("controllo: conteggi", { chiesti: 2, noti: 1, promossi: 2, stato: 200 }, e);
      const v = fila.prossimo();
      c(
        "il numero diventato noto va in fila come storico, con il nome",
        ["storico", ["P1", "P2"], { [C1]: "Ora Cliente" }],
        [v?.origine, v?.lotto.messaggi.map((m) => m.id), v?.lotto.nomi],
      );
      c("e la cache lo dimentica; un numero non chiesto non conta", [C2], cache.numeri());

      const nessuno = await K.controllaCache({
        cache,
        fila,
        invia: async () => ({ stato: 400, corpo: { ok: false, errore: "corpo_non_valido" } }),
      });
      c(
        "CRM che non conosce la richiesta (400) → niente promosso, la cache resta",
        [{ chiesti: 0, noti: 0, promossi: 0, stato: 400 }, [C2]],
        [nessuno, cache.numeri()],
      );
      const rete = await K.controllaCache({
        cache,
        fila,
        invia: async () => ({ stato: null, corpo: null }),
      });
      c("rete assente → stato 0, la cache resta", [0, [C2]], [rete.stato, cache.numeri()]);

      const vuota = K.creaCache({
        cartella: nuova(),
        chiave: K.chiaveCache(join(base, "k5")),
        orologio: ora,
      });
      let chiamate = 0;
      await K.controllaCache({
        cache: vuota,
        fila,
        invia: async () => (chiamate++, { stato: 200, corpo: { ok: true, noti: [] } }),
      });
      c("cache vuota → nessuna richiesta", 0, chiamate);

      const molti = K.creaCache({
        cartella: nuova(),
        chiave: K.chiaveCache(join(base, "k6")),
        orologio: ora,
      });
      molti.metti(
        Array.from({ length: 450 }, (_, i) => msg(`M${i}`, `39333${String(i).padStart(7, "0")}`)),
        {},
      );
      const lunghezze = [];
      await K.controllaCache({
        cache: molti,
        fila,
        invia: async (corpo) => (
          lunghezze.push(corpo.numeri.length),
          { stato: 200, corpo: { ok: true, noti: [] } }
        ),
      });
      c("i numeri si chiedono a gruppi di 200 (il limite della rotta)", [200, 200, 50], lunghezze);
    }

    // ── Fila piena: la cronologia resta in cache e si ritenta ──
    {
      const ora = orologio();
      const cache = K.creaCache({
        cartella: nuova(),
        chiave: K.chiaveCache(join(base, "k7")),
        orologio: ora,
      });
      const fila = L.creaFila({ cartella: nuova(), orologio: ora, limiti: { maxFile: 0 } });
      cache.metti([msg("F1", C1)], {});
      const e = await K.controllaCache({
        cache,
        fila,
        invia: async () => ({ stato: 200, corpo: { ok: true, noti: [C1] } }),
      });
      c(
        "fila piena → niente promosso, il numero resta in cache",
        [0, true, [C1]],
        [e.promossi, e.piena, cache.numeri()],
      );
    }

    // ── La fila consegna alla cache i non noti (vivi scaduti e storico) ──
    {
      const ora = orologio();
      const consegnati = [];
      const fila = L.creaFila({
        cartella: nuova(),
        orologio: ora,
        fuoriRubrica: (m, nomi) => consegnati.push({ ids: m.map((x) => x.id), nomi }),
      });
      fila.aggiungi("storico", [msg("S1", C1), msg("S2", C2)], { [C1]: "Uno", [C2]: "Due" });
      const e = fila.esito(fila.prossimo(), {
        stato: 200,
        corpo: { ok: true, fuori_rubrica: 1, non_noti: ["S2"] },
      });
      c(
        "storico: i non noti vanno alla cache (col loro nome), il lotto si cancella",
        [{ azione: "cancellato" }, [{ ids: ["S2"], nomi: { [C2]: "Due" } }], 0],
        [{ azione: e.azione }, consegnati, fila.contatori().in_coda],
      );

      consegnati.length = 0;
      fila.aggiungi("vivo", [msg("V1", C3)], {}, { prontoIl: T0 });
      let azione = null;
      for (let i = 0; i < 20 && azione !== "scaduto"; i++) {
        const v = fila.prossimo();
        if (v) azione = fila.esito(v, { stato: 200, corpo: { ok: true, non_noti: ["V1"] } }).azione;
        ora.vai(60_000);
      }
      c(
        "vivo: dopo i 10 minuti il non noto va alla cache (prima no)",
        ["scaduto", [{ ids: ["V1"], nomi: {} }]],
        [azione, consegnati],
      );

      const rotta = L.creaFila({
        cartella: nuova(),
        orologio: ora,
        fuoriRubrica: () => {
          throw new Error("disco pieno");
        },
      });
      rotta.aggiungi("storico", [msg("Z1", C1)], {});
      c(
        "se la cache fallisce la fila va avanti lo stesso",
        "cancellato",
        rotta.esito(rotta.prossimo(), { stato: 200, corpo: { ok: true, non_noti: ["Z1"] } }).azione,
      );
    }

    c(
      "la cache non tocca la cartella di casa né la rete da sola",
      [false, false],
      (() => {
        const t = readFileSync(join(radice, "strumenti/ponte-whatsapp/src/cache.mjs"), "utf8");
        return [/homedir|process\.env\.HOME|tmpdir/.test(t), /\bfetch\b/.test(t)];
      })(),
    );
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
