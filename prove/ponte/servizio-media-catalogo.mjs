/** ── PROVE: IL SERVIZIO SUL MAC: IL CATALOGO DEI MEDIA ──
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T5 (PIANO c2.1, D4, condizioni 4-5 del revisore).
 *  Prova `strumenti/ponte-whatsapp/src/catalogo.mjs`: un file per media visto, cartella 700 e file 600,
 *  scadenza 30 giorni dal messaggio, tetto 5.000 voci (escono prima le `catalogato`, mai prima le
 *  `in_coda`), scritture ASINCRONE e A GRUPPI (mai un file per volta nel gestore dello storico),
 *  svuotamento del buffer in chiusura (SIGTERM), `url` mai scritto, scrittura idempotente.
 *  Disco vero in una cartella temporanea; timer e orologio finti. Dati inventati.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const T0 = Date.UTC(2026, 9, 31, 12, 0, 0);
const S0 = T0 / 1000;
const GIORNO = 86_400;
const permessi = (p) => statSync(p).mode & 0o777;
const nomeFile = (chiave) => `${createHash("sha256").update(chiave).digest("hex")}.json`;
const MEDIAKEY = Buffer.alloc(32, 7);

/** Una voce valida; ogni prova cambia solo quello che le serve. */
const voce = (n, extra = {}) => ({
  chiave: `bw:393330000001:3EB0${String(n).padStart(4, "0")}`,
  ts: S0 - 3600 - n,
  categoria: "foto",
  mime: "image/jpeg",
  byte: 4000,
  mediaKey: MEDIAKEY,
  directPath: `/v/t62/x${n}.enc`,
  host: "mmg.whatsapp.net",
  stato: "catalogato",
  ...extra,
});

/** Orologio e timer finti: nulla gira da solo, si decide la prova. */
function finti() {
  let t = T0;
  const timer = [];
  const o = () => t;
  o.vai = (ms) => (t += ms);
  const pianifica = (fn, ms) => {
    const h = { fn, ms, annullato: false, unref() {} };
    timer.push(h);
    return h;
  };
  const annulla = (h) => {
    if (h) h.annullato = true;
  };
  const tutti = () => timer.filter((h) => !h.annullato);
  //  `vivi`: i timer del buffer (la potatura di ogni giorno, da 24 h, è a parte)
  const vivi = () => tutti().filter((h) => h.ms !== 24 * 3_600_000);
  return { orologio: o, pianifica, annulla, timer, tutti, vivi };
}

/** `fs/promises` che conta le scritture e i rinominamenti, per provare i gruppi e l'idempotenza. */
function fsConta() {
  const n = { scritture: 0, rimozioni: 0, picco: 0, inCorso: 0 };
  return {
    n,
    fs: {
      ...fsp,
      writeFile: async (...a) => {
        n.scritture++;
        n.inCorso++;
        n.picco = Math.max(n.picco, n.inCorso);
        try {
          return await fsp.writeFile(...a);
        } finally {
          n.inCorso--;
        }
      },
      rm: async (...a) => {
        n.rimozioni++;
        return fsp.rm(...a);
      },
    },
  };
}

export async function provePonteServizioMediaCatalogo(_mod, { c, gruppo, radice }) {
  const src = (f) => pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src", f)).href;
  const K = await import(src("catalogo.mjs"));
  const base = mkdtempSync(join(tmpdir(), "ponte-catalogo-"));
  let k = 0;
  const nuova = () => join(base, `c${k++}`);
  const nomi = (cartella) => readdirSync(cartella).filter((f) => f.endsWith(".json")).sort();
  /** un catalogo già avviato, con orologio e timer finti */
  async function crea(extra = {}) {
    const cartella = extra.cartella ?? nuova();
    const f = finti();
    const reg = [];
    const cat = K.creaCatalogo({ cartella, orologio: f.orologio, pianifica: f.pianifica, annulla: f.annulla, registro: (x) => reg.push(x), ...extra });
    await cat.avvia();
    return { cat, f, cartella, reg };
  }

  try {
    gruppo("PONTE WHATSAPP · IL SERVIZIO: CATALOGO DEI MEDIA (T5)");

    c("limiti di serie: 30 giorni, 5.000 voci, buffer 2 s", [30, 5000, 2000], [K.LIMITI_CATALOGO.giorni, K.LIMITI_CATALOGO.maxVoci, K.LIMITI_CATALOGO.bufferMs]);
    const sorgente = readFileSync(join(radice, "strumenti/ponte-whatsapp/src/catalogo.mjs"), "utf8");
    c("nessuna chiamata sincrona al disco (writeFileSync, renameSync, rmSync…)", [], sorgente.match(/\b\w+Sync\(/g) ?? []);
    c("il catalogo non parla di rete né di Baileys", [], sorgente.match(/\bfetch\(|baileys|WebSocket/gi) ?? []);

    // ── Cartella 700, file 600 ────────────────────────────────────────────
    {
      const { cat, cartella } = await crea();
      c("la cartella nasce 700", 0o700, permessi(cartella));
      cat.aggiungi(voce(1));
      await cat.svuota();
      const f = nomi(cartella);
      c("un file per voce, nome = impronta della chiave (nessun numero nel nome)", [nomeFile(voce(1).chiave)], f);
      c("il file è 600", 0o600, permessi(join(cartella, f[0])));
      const d = JSON.parse(readFileSync(join(cartella, f[0]), "utf8"));
      c("nel file: la mediaKey in base64, host e directPath, stato; v: 2", [MEDIAKEY.toString("base64"), "mmg.whatsapp.net", "/v/t62/x1.enc", "catalogato", 2], [d.mediaKey, d.host, d.directPath, d.stato, d.v]);
      c("nessun file temporaneo resta in cartella", [], readdirSync(cartella).filter((x) => x.includes(".tmp")));
      await cat.ferma();
    }
    {
      //  Una cartella che esiste già, troppo aperta, e un file troppo aperto: si stringono.
      const cartella = nuova();
      mkdirSync(cartella, { mode: 0o755 });
      chmodSync(cartella, 0o755);
      const prima = voce(2);
      writeFileSync(join(cartella, nomeFile(prima.chiave)), JSON.stringify({ ...prima, mediaKey: MEDIAKEY.toString("base64"), v: 2 }), { mode: 0o644 });
      chmodSync(join(cartella, nomeFile(prima.chiave)), 0o644);
      const { cat } = await crea({ cartella });
      c("avvio: una cartella 755 diventa 700 e un file 644 diventa 600", [0o700, 0o600], [permessi(cartella), permessi(join(cartella, nomeFile(prima.chiave)))]);
      c("avvio: la voce del disco si ritrova", prima.chiave, cat.leggi(prima.chiave)?.chiave);
      await cat.ferma();
    }

    // ── Scritture asincrone e a gruppi ────────────────────────────────────
    {
      const conta = fsConta();
      const { cat, f, cartella } = await crea({ fs: conta.fs });
      for (let i = 0; i < 300; i++) cat.aggiungi(voce(i));
      c("aggiungi non tocca il disco: dopo 300 aggiunte il file non c'è ancora", [0, 0], [nomi(cartella).length, conta.n.scritture]);
      c("…e le 300 voci dello storico fanno UN SOLO timer da 2 s", [1, 2000], [f.vivi().length, f.vivi()[0]?.ms]);
      f.vivi()[0].fn();
      await cat.svuota();
      c("scaduto il buffer: 300 file, scritti tutti", [300, 300], [nomi(cartella).length, conta.n.scritture]);
      c("scritti a gruppi: mai più di 32 scritture insieme, ma più di una alla volta", [true, true], [conta.n.picco <= 32, conta.n.picco > 1]);
      await cat.ferma();
    }
    {
      //  Un lavoro appena accodato (`in_coda`) si scrive subito, non dopo 2 s: se il Mac si ferma non si perde.
      const { cat, f, cartella } = await crea();
      cat.aggiungi(voce(1, { stato: "in_coda" }));
      c("in_coda: timer a 0 ms (subito, ma comunque asincrono)", [1, 0], [f.vivi().length, f.vivi()[0]?.ms]);
      c("…il file non è scritto dentro la chiamata", 0, nomi(cartella).length);
      f.vivi()[0].fn();
      await cat.svuota();
      c("…ed è scritto appena il ciclo gira", 1, nomi(cartella).length);
      //  Un catalogato già in attesa con 2 s non fa aspettare l'in_coda arrivato dopo.
      const g = await crea();
      g.cat.aggiungi(voce(1));
      g.cat.aggiungi(voce(2, { stato: "in_coda" }));
      c("un in_coda dopo un catalogato accorcia l'attesa a 0 (un solo timer vivo)", [1, 0], [g.f.vivi().length, g.f.vivi()[0]?.ms]);
      await cat.ferma();
      await g.cat.ferma();
    }

    // ── Chiusura (SIGTERM): il buffer si svuota ───────────────────────────
    {
      const { cat, f, cartella } = await crea();
      for (let i = 0; i < 5; i++) cat.aggiungi(voce(i));
      c("prima della chiusura i file non ci sono", 0, nomi(cartella).length);
      await cat.ferma();
      c("ferma(): il buffer è sul disco prima di tornare", 5, nomi(cartella).length);
      c("…e nessun timer resta vivo (nemmeno la potatura di ogni giorno)", 0, f.tutti().length);
      c("dopo ferma() il catalogo non accetta più nulla", { ok: false, motivo: "fermato" }, cat.aggiungi(voce(99)));
      await cat.ferma();
      c("ferma() due volte non rompe", 5, nomi(cartella).length);
    }

    // ── Voci vecchie, scadenza ─────────────────────────────────────────────
    {
      const { cat, f, cartella } = await crea();
      const vecchia = voce(1, { ts: S0 - 31 * GIORNO });
      c("più di 30 giorni: saltata, senza scrivere", [{ ok: false, motivo: "vecchia" }, 0, 0], [cat.aggiungi(vecchia), f.vivi().length, cat.conteggio().voci]);
      c("esattamente 29 giorni: entra", { ok: true }, cat.aggiungi(voce(2, { ts: S0 - 29 * GIORNO })));
      await cat.svuota();
      c("…e la vecchia non ha mai avuto un file", [nomeFile(voce(2).chiave)], nomi(cartella));
      f.orologio.vai(2 * GIORNO * 1000);
      c("pota(): dopo 2 giorni la voce di 29 ne ha 31 e esce, file compreso", [1, 0], [cat.pota().scadute, (await cat.svuota(), nomi(cartella).length)]);
      await cat.ferma();
    }
    {
      //  La potatura gira all'avvio e una volta al giorno (timer da 24 h).
      const cartella = nuova();
      const a = await crea({ cartella });
      a.cat.aggiungi(voce(1, { ts: S0 - 20 * GIORNO }));
      await a.cat.ferma();
      const f2 = finti();
      f2.orologio.vai(15 * GIORNO * 1000);
      const cat = K.creaCatalogo({ cartella, orologio: f2.orologio, pianifica: f2.pianifica, annulla: f2.annulla });
      const r = await cat.avvia();
      c("all'avvio: una voce che nel frattempo ha 35 giorni viene tolta", [0, 1, 0], [cat.conteggio().voci, r.scadute, nomi(cartella).length]);
      const giorno = f2.tutti().find((h) => h.ms === 24 * 3_600_000);
      c("all'avvio si programma la potatura di ogni giorno", true, !!giorno);
      await cat.ferma();
      c("…e ferma() la cancella", 0, f2.tutti().length);
    }

    // ── Il segreto: l'url non si scrive mai ───────────────────────────────
    {
      const { cat, cartella } = await crea();
      const r = cat.aggiungi({ ...voce(1), url: "https://mmg.whatsapp.net/v/t62/x.enc?token=SEGRETO", fileSha256: "xx", ordinario: "boh" });
      await cat.svuota();
      const grezzo = readFileSync(join(cartella, nomi(cartella)[0]), "utf8");
      c("un `url` passato per sbaglio non viene scritto, né nessun campo ignoto", [true, false, false, false], [r.ok, /url/i.test(grezzo), /SEGRETO/.test(grezzo), /ordinario|fileSha256/.test(grezzo)]);
      c("…e nemmeno in memoria", [false, false], [Object.hasOwn(cat.leggi(voce(1).chiave), "url"), Object.hasOwn(cat.leggi(voce(1).chiave), "ordinario")]);
      await cat.ferma();
    }

    // ── Idempotenza: lo storico si ripresenta ─────────────────────────────
    {
      const conta = fsConta();
      const { cat, f } = await crea({ fs: conta.fs });
      cat.aggiungi(voce(1));
      await cat.svuota();
      const dopoPrima = conta.n.scritture;
      const r = cat.aggiungi(voce(1));
      c("la stessa voce due volte: gia_presente, nessun nuovo timer, nessuna scrittura", [{ ok: true, gia: true }, 0, 1], [r, f.vivi().length, dopoPrima]);
      await cat.svuota();
      c("…il disco non si tocca", dopoPrima, conta.n.scritture);
      //  Un catalogato non declassa un in_coda; un in_coda promuove un catalogato.
      cat.aggiungi(voce(2, { stato: "in_coda" }));
      cat.aggiungi(voce(2, { stato: "catalogato" }));
      c("lo storico che ripresenta una voce in_coda non la riporta a catalogato", "in_coda", cat.leggi(voce(2).chiave).stato);
      cat.aggiungi(voce(3));
      cat.aggiungi(voce(3, { stato: "in_coda" }));
      c("una voce catalogata che poi viene accodata passa a in_coda", "in_coda", cat.leggi(voce(3).chiave).stato);
      c("conteggio per stato", { voci: 3, in_coda: 2, catalogato: 1 }, cat.conteggio());
      await cat.ferma();
    }

    // ── Voci non valide: scartate, mai un'eccezione ───────────────────────
    {
      const { cat } = await crea();
      const no = (x) => cat.aggiungi(x);
      c("non valide → {ok:false}, non lancia: chiave, categoria, mime, mediaKey, directPath, host", Array(6).fill(false), [
        no(voce(1, { chiave: "ciao" })).ok,
        no(voce(1, { categoria: "sticker" })).ok,
        no(voce(1, { mime: "text/html" })).ok,
        no(voce(1, { mediaKey: Buffer.alloc(16) })).ok,
        no(voce(1, { directPath: "//evil.example/x" })).ok,
        no(voce(1, { host: "evil.example.com" })).ok,
      ]);
      c("mime di un'altra famiglia (un pdf come foto) → mime_non_ammesso", { ok: false, motivo: "mime_non_ammesso" }, no(voce(1, { mime: "application/pdf" })));
      c("null, stringa, oggetto vuoto → non_valida", Array(3).fill({ ok: false, motivo: "non_valida" }), [no(null), no("x"), no({})]);
      c("ts non intero / assente, stato strano → non_valida", Array(3).fill(false), [no(voce(1, { ts: "ieri" })).ok, no(voce(1, { ts: undefined })).ok, no(voce(1, { stato: "boh" })).ok]);
      c("la mediaKey può arrivare anche già in base64", { ok: true }, no(voce(9, { mediaKey: MEDIAKEY.toString("base64") })));
      c("nulla di tutto ciò è entrato (tranne la voce 9)", 1, cat.conteggio().voci);
      //  I campi facoltativi non validi si perdono, la voce resta.
      cat.aggiungi(voce(5, { miniatura: "<script>alert(1)</script>", nome: "x".repeat(500), durata_s: -4, larghezza: "boh", altezza: 480 }));
      const v = cat.leggi(voce(5).chiave);
      c("miniatura non base64-jpeg → tolta; nome tagliato a 120; durata/larghezza non valide → tolte; altezza buona resta", [false, 120, false, false, 480], [Object.hasOwn(v, "miniatura"), v.nome.length, Object.hasOwn(v, "durata_s"), Object.hasOwn(v, "larghezza"), v.altezza]);
      cat.aggiungi(voce(6, { miniatura: "/9j/4AAQSkZJRg==", nome: "ricetta.pdf", durata_s: 12, larghezza: 640, altezza: 480, categoria: "documento", mime: "application/pdf" }));
      const w = cat.leggi(voce(6).chiave);
      c("campi buoni conservati (miniatura jpeg, nome, durata, dimensioni)", ["/9j/4AAQSkZJRg==", "ricetta.pdf", 12, 640, 480], [w.miniatura, w.nome, w.durata_s, w.larghezza, w.altezza]);
      await cat.ferma();
    }

    // ── Tetto: prima le catalogato, poi le in_coda ────────────────────────
    {
      const { cat, cartella } = await crea({ maxVoci: 5 });
      //  3 in_coda MOLTO vecchie e 4 catalogato più nuove: escono le 2 catalogato più vecchie, non le in_coda.
      for (let i = 0; i < 3; i++) cat.aggiungi(voce(10 + i, { stato: "in_coda", ts: S0 - 25 * GIORNO - i }));
      for (let i = 0; i < 4; i++) cat.aggiungi(voce(20 + i, { ts: S0 - 2 * GIORNO - i * 100 }));
      await cat.svuota();
      const chiavi = [10, 11, 12, 20, 21, 22, 23].map((n) => voce(n).chiave);
      c("tetto 5: restano le 3 in_coda e le 2 catalogato più nuove", [true, true, true, true, true, false, false], chiavi.map((x) => cat.leggi(x) !== null));
      c("…i file sono 5, e quelli espulsi non hanno mai avuto un file", [5, [10, 11, 12, 20, 21].map((n) => nomeFile(voce(n).chiave)).sort()], [nomi(cartella).length, nomi(cartella)]);
      //  Se restano solo in_coda, escono le più vecchie in_coda.
      for (let i = 0; i < 3; i++) cat.aggiungi(voce(30 + i, { stato: "in_coda", ts: S0 - 1000 - i }));
      await cat.svuota();
      const restate = [10, 11, 12, 20, 21, 30, 31, 32].filter((n) => cat.leggi(voce(n).chiave));
      c("5 in_coda e nessuna catalogato oltre il tetto: via le in_coda più vecchie", [30, 31, 32, 10, 11].sort(), restate.length === 5 ? restate.sort() : restate);
      c("conteggio finale = tetto", 5, cat.conteggio().voci);
      await cat.ferma();
    }
    {
      //  Il tetto vero è 5.000 e vale anche per un nuovo storico di 5.200 messaggi in un colpo.
      const conta = fsConta();
      const { cat, cartella } = await crea({ fs: conta.fs });
      for (let i = 0; i < 5200; i++) cat.aggiungi(voce(i, { ts: S0 - 3600 - i * 10 }));
      await cat.svuota();
      c("5.200 voci di storico → 5.000 in memoria e su disco", [5000, 5000], [cat.conteggio().voci, nomi(cartella).length]);
      c("…le 200 più vecchie non sono mai state scritte", [true, false], [cat.leggi(voce(0).chiave) !== null, cat.leggi(voce(5199).chiave) !== null]);
      c("…e scritte (5.000 scritture, non 5.200)", 5000, conta.n.scritture);
      await cat.ferma();
    }

    // ── Togliere una voce (404/410) ───────────────────────────────────────
    {
      const { cat, cartella } = await crea();
      cat.aggiungi(voce(1));
      cat.aggiungi(voce(2));
      await cat.svuota();
      cat.togli(voce(1).chiave);
      c("togli: sparisce subito dalla memoria", [null, 1], [cat.leggi(voce(1).chiave), cat.conteggio().voci]);
      await cat.svuota();
      c("…e il file va via al giro dopo", [nomeFile(voce(2).chiave)], nomi(cartella));
      //  Togliere una voce ancora nel buffer: non si scrive mai.
      const conta = fsConta();
      const g = await crea({ fs: conta.fs });
      g.cat.aggiungi(voce(3));
      g.cat.togli(voce(3).chiave);
      await g.cat.svuota();
      c("aggiunta e tolta prima del buffer: nessuna scrittura", [0, 0], [conta.n.scritture, nomi(g.cartella).length]);
      c("togliere una voce che non c'è non rompe", { ok: true }, cat.togli("bw:393330000001:NONESISTE"));
      await cat.ferma();
      await g.cat.ferma();
    }

    // ── Aggiornare una voce (T6: tentativi, attesa, stato) ────────────────
    {
      const { cat, f, cartella } = await crea();
      cat.aggiungi(voce(1));
      await cat.svuota();
      const r = cat.imposta(voce(1).chiave, { stato: "in_coda", guasti: 2, prossimo_il: T0 + 900_000, url: "https://x", categoria: "video" });
      const v = cat.leggi(voce(1).chiave);
      c("imposta: cambia stato, guasti, prossimo_il; ignora url e campi d'identità (categoria)", [true, "in_coda", 2, T0 + 900_000, false, "foto"], [r.ok, v.stato, v.guasti, v.prossimo_il, Object.hasOwn(v, "url"), v.categoria]);
      c("imposta in_coda → scrittura subito (timer 0)", 0, f.vivi()[0]?.ms);
      await cat.svuota();
      const d = JSON.parse(readFileSync(join(cartella, nomi(cartella)[0]), "utf8"));
      c("…e sul disco", ["in_coda", 2], [d.stato, d.guasti]);
      c("imposta su una chiave sconosciuta o con valori strani → ok:false", [false, false], [cat.imposta("bw:393330000001:NO", { guasti: 1 }).ok, cat.imposta(voce(1).chiave, { guasti: -3 }).ok]);
      c("…e lo stato non è cambiato", 2, cat.leggi(voce(1).chiave).guasti);
      await cat.ferma();
    }

    // ── Riavvio: il disco riprende, il resto va via ───────────────────────
    {
      const cartella = nuova();
      const a = await crea({ cartella });
      a.cat.aggiungi(voce(1, { stato: "in_coda" }));
      a.cat.aggiungi(voce(2));
      await a.cat.ferma();
      //  rovinati a mano: JSON rotto, nome sbagliato, chiave che non corrisponde al nome, residuo .tmp, mediaKey corta
      writeFileSync(join(cartella, `${"a".repeat(64)}.json`), "{non json");
      writeFileSync(join(cartella, "strano.json"), JSON.stringify({ v: 2 }));
      writeFileSync(join(cartella, `${nomeFile(voce(1).chiave)}.tmp-123`), "x");
      writeFileSync(join(cartella, `${"b".repeat(64)}.json`), JSON.stringify({ ...voce(3), mediaKey: MEDIAKEY.toString("base64"), v: 2 }));
      writeFileSync(join(cartella, nomeFile(voce(4).chiave)), JSON.stringify({ ...voce(4), mediaKey: "AAAA", v: 2 }));
      const b = await crea({ cartella });
      c("al riavvio: le due buone tornano, con il loro stato", [2, "in_coda", "catalogato"], [b.cat.conteggio().voci, b.cat.leggi(voce(1).chiave)?.stato, b.cat.leggi(voce(2).chiave)?.stato]);
      c("…la mediaKey ritorna Buffer da 32 byte", [true, 32], [Buffer.isBuffer(b.cat.leggi(voce(1).chiave).mediaKey), b.cat.leggi(voce(1).chiave).mediaKey.length]);
      await b.cat.svuota();
      c("…rotti, di nome strano, residui .tmp e chiave che non torna col nome: spariti dal disco", [nomeFile(voce(1).chiave), nomeFile(voce(2).chiave)].sort(), readdirSync(cartella).sort());
      c("…e il registro dice solo quanti, mai quali", true, b.reg.every((x) => typeof x === "string" || (typeof x === "object")) && !JSON.stringify(b.reg).includes("393330000001"));
      await b.cat.ferma();
    }

    // ── Un disco che non scrive non rompe il servizio ─────────────────────
    {
      const rotto = { ...fsp, writeFile: async () => { throw Object.assign(new Error("ENOSPC: /Users/x/segreto"), { code: "ENOSPC" }); } };
      const { cat, reg } = await crea({ fs: rotto });
      cat.aggiungi(voce(1));
      let lanciato = false;
      try {
        await cat.svuota();
      } catch {
        lanciato = true;
      }
      c("scrittura che fallisce: non lancia, la voce resta in memoria", [false, 1], [lanciato, cat.conteggio().voci]);
      c("…il registro ha un codice fisso, senza il testo dell'errore", [true, false], [reg.includes("catalogo_disco_non_scrivibile"), JSON.stringify(reg).includes("segreto")]);
      await cat.ferma();
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
