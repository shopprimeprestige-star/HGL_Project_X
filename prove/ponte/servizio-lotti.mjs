/** ── PROVE: IL SERVIZIO SUL MAC: FILA, LOTTI, RITENTATIVI ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T5.
 *  Prova le parti pure del servizio che non sono l'estrazione:
 *  `lotti.mjs` (fila su disco, due code, ritmo, ritentativi, divisione),
 *  `riconnessione.mjs` (tabella del §a3), `config.mjs` (config.env), più la
 *  catena di fornitura (lockfile) e il .gitignore delle credenziali.
 *  La fila sta in una cartella temporanea; l'orologio è finto; la rete non
 *  si usa mai (il `fetch` è finto). Dati inventati (prefisso 39 333 000…).
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const T0 = Date.UTC(2026, 9, 29, 12, 0, 0);
const msg = (i, numero = "393330000001", extra = {}) => ({ id: `ID${String(i).padStart(4, "0")}`, numero, dir: "in", ts: 1792000000 + i, testo: `messaggio ${i}`, tipo: "testo", ...extra });
const molti = (n, numero) => Array.from({ length: n }, (_, i) => msg(i, numero));
const file = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : []);

/** Un orologio finto da far avanzare a mano. */
function orologio() {
  let t = T0;
  const o = () => t;
  o.vai = (ms) => (t += ms);
  o.a = (ms) => (t = T0 + ms);
  return o;
}

export async function provePonteServizioLotti(mod, { c, gruppo, radice }) {
  const src = (f) => pathToFileURL(join(radice, "strumenti/ponte-whatsapp/src", f)).href;
  const L = await import(src("lotti.mjs"));
  const R = await import(src("riconnessione.mjs"));
  const C = await import(src("config.mjs"));
  const T = mod["ponte/tipi"];
  const base = mkdtempSync(join(tmpdir(), "ponte-fila-"));
  let n = 0;
  const nuovaCartella = () => join(base, `f${n++}`);

  try {
    gruppo("PONTE WHATSAPP · IL SERVIZIO: LOTTI (compito T5)");

    //  Impacchettare: 50 per lo storico, 200 per i vivi, 200 KB.
    c("i limiti dei lotti sono quelli di tipi.ts", [T.LIMITI.messaggiStorico, T.LIMITI.messaggi, true], [L.RITMO.messaggiStorico, L.RITMO.messaggiVivo, L.RITMO.lottoByte < T.LIMITI.corpoByte]);
    const st = L.impacchetta("storico", molti(120), { "393330000001": "Cliente Prova" });
    c("storico da 120 → lotti da 50, 50, 20", [50, 50, 20], st.map((l) => l.messaggi.length));
    c("il lotto ha la forma di LottoPonte", { v: 1, tipo: "lotto", origine: "storico", nomi: { "393330000001": "Cliente Prova" } }, { v: st[0].v, tipo: st[0].tipo, origine: st[0].origine, nomi: st[0].nomi });
    c("vivi da 450 → lotti da 200, 200, 50", [200, 200, 50], L.impacchetta("vivo", molti(450), {}).map((l) => l.messaggi.length));
    const grossi = Array.from({ length: 50 }, (_, i) => msg(i, "393330000001", { testo: "x".repeat(4000) }));
    const pesanti = L.impacchetta("vivo", [...grossi, ...grossi.map((m, i) => ({ ...m, id: `B${i}` }))], {});
    c("nessun lotto supera 200 KB", true, pesanti.every((l) => Buffer.byteLength(JSON.stringify(l)) <= L.RITMO.lottoByte));
    c("e nessun messaggio si perde nel dividere per peso", 100, pesanti.reduce((s, l) => s + l.messaggi.length, 0));
    const misti = L.impacchetta("vivo", [msg(1, "393330000002"), msg(2, "393330000001"), msg(3, "393330000002")], { "393330000001": "A", "393330000002": "B", "393330000003": "C" });
    c("i vivi di una stessa chat stanno vicini nel lotto", ["393330000001", "393330000002", "393330000002"], misti[0].messaggi.map((m) => m.numero));
    c("nomi solo dei numeri del lotto", { "393330000001": "A", "393330000002": "B" }, misti[0].nomi);
    c("niente messaggi → niente lotti", [], L.impacchetta("storico", [], {}));

    //  Scrittura su disco e riavvio.
    {
      const cart = nuovaCartella();
      const ora = orologio();
      const f = L.creaFila({ cartella: cart, orologio: ora });
      c("aggiungi storico: due lotti scritti", { accettati: 60, lotti: 2, piena: false }, f.aggiungi("storico", molti(60), {}));
      c("i file stanno in fila/storico/", 2, file(join(cart, "storico")).length);
      c("cartelle con permessi 700", ["700", "700", "700"], ["storico", "vivo", "scartati"].map((d) => (statSync(join(cart, d)).mode & 0o777).toString(8)));
      c("file con permessi 600", "600", (statSync(join(cart, "storico", file(join(cart, "storico"))[0])).mode & 0o777).toString(8));
      c("nessun file temporaneo rimasto (scrittura atomica)", [], readdirSync(join(cart, "storico")).filter((x) => !x.endsWith(".json")));
      const primo = f.prossimo();
      c("il primo lotto è il più vecchio (50 messaggi)", 50, primo?.lotto.messaggi.length);
      c("mentre un lotto di storico è in volo non ne parte un altro", null, f.prossimo());
      c("un 500 non cancella il lotto", "ritenta", f.esito(primo, { stato: 500, corpo: { ok: false, errore: "database" } }).azione);
      c("il lotto è ancora sul disco", 2, file(join(cart, "storico")).length);
      const f2 = L.creaFila({ cartella: cart, orologio: ora });
      ora.vai(60_000);
      const dopo = f2.prossimo();
      c("dopo un «riavvio» la fila si rilegge dal disco", [50, "ID0000"], [dopo?.lotto.messaggi.length, dopo?.lotto.messaggi[0].id]);
      c("contatori: messaggi in coda", 60, f2.contatori().in_coda);
      c("200 → il lotto si cancella", "cancellato", f2.esito(dopo, { stato: 200, corpo: { ok: true, non_noti: [] } }).azione);
      c("e sul disco ne resta uno", 1, file(join(cart, "storico")).length);
      c("senza risposta il lotto resta (rete)", "ritenta", f2.esito(f2.prossimo() ?? (ora.vai(3000), f2.prossimo()), { stato: null, corpo: null }).azione);
      c("ancora sul disco", 1, file(join(cart, "storico")).length);
    }

    //  File corrotto in fila.
    {
      const cart = nuovaCartella();
      const ora = orologio();
      L.creaFila({ cartella: cart, orologio: ora }).aggiungi("vivo", [msg(1)], {}, { prontoIl: T0 });
      writeFileSync(join(cart, "vivo", "0000000000000-000000-vivo.json"), "{ non è json");
      writeFileSync(join(cart, "vivo", "0000000000001-000000-vivo.json"), JSON.stringify({ lotto: { messaggi: "no" } }));
      writeFileSync(join(cart, "vivo", "0000000000002-000000-vivo.json.tmp-1"), "mezzo");
      const f = L.creaFila({ cartella: cart, orologio: ora });
      c("file corrotti → spostati in scartati/", 2, file(join(cart, "scartati")).length);
      c("il temporaneo lasciato a metà si toglie", false, existsSync(join(cart, "vivo", "0000000000002-000000-vivo.json.tmp-1")));
      c("il resto prosegue", "ID0001", f.prossimo()?.lotto.messaggi[0].id);
    }

    //  413 dimezza, 400 scarta.
    {
      const cart = nuovaCartella();
      const ora = orologio();
      const f = L.creaFila({ cartella: cart, orologio: ora });
      f.aggiungi("vivo", molti(10), {}, { prontoIl: T0 });
      c("413 → diviso", "diviso", f.esito(f.prossimo(), { stato: 413, corpo: null }).azione);
      const a = f.prossimo();
      const b = f.prossimo();
      c("in due metà da 5", [5, 5], [a?.lotto.messaggi.length, b?.lotto.messaggi.length]);
      c("400 → scartati/, non si ritenta", "scartato", f.esito(a, { stato: 400, corpo: { ok: false, errore: "corpo_non_valido" } }).azione);
      c("il lotto scartato è in scartati/", 1, file(join(cart, "scartati")).length);
      f.aggiungi("vivo", [msg(99)], {}, { prontoIl: T0 });
      f.esito(b, { stato: 200, corpo: { ok: true, non_noti: [] } });
      c("413 su un messaggio solo → scartati/", "scartato", f.esito(f.prossimo(), { stato: 413, corpo: null }).azione);
      c("fila vuota", [0, 2], [f.contatori().in_coda, f.contatori().scartati]);
    }

    //  401 e 503: errore, si aspetta fino a 10 minuti.
    {
      const ora = orologio();
      const f = L.creaFila({ cartella: nuovaCartella(), orologio: ora });
      f.aggiungi("vivo", [msg(1)], {}, { prontoIl: T0 });
      const e = f.esito(f.prossimo(), { stato: 401, corpo: { ok: false, errore: "non_autorizzato" } });
      c("401 → ritenta con stato errore", { azione: "ritenta", stato: "errore" }, { azione: e.azione, stato: e.stato });
      ora.vai(59_000);
      c("non prima dell'attesa", null, f.prossimo());
      let massimo = 0;
      for (let i = 0; i < 8; i++) {
        let v = null;
        let atteso = 0;
        while (!(v = f.prossimo())) (ora.vai(1000), (atteso += 1000));
        massimo = Math.max(massimo, atteso);
        f.esito(v, { stato: 503, corpo: { ok: false, errore: "non_configurato" } });
      }
      c("l'attesa sale ma non supera 10 minuti", true, massimo > 60_000 && massimo <= 600_000);
    }

    //  Il database giù (migrazione mancante, Supabase fermo): 500 per ore.
    //  Nessun 200 da nessuna parte → non si divide e non si scarta niente:
    //  lo storico arriva una volta sola e non si può buttare.
    {
      const cart = nuovaCartella();
      const ora = orologio();
      const f = L.creaFila({ cartella: cart, orologio: ora });
      f.aggiungi("storico", molti(80), {});
      f.aggiungi("vivo", molti(20, "393330000002").map((m) => ({ ...m, id: `V${m.id}` })), {}, { prontoIl: T0 });
      let risposte = 0;
      while (ora() - T0 < 6 * 3_600_000) {
        const v = f.prossimo();
        if (!v) {
          ora.vai(10_000);
          continue;
        }
        risposte++;
        f.esito(v, { stato: 500, corpo: { ok: false, errore: "database" } });
      }
      const k = f.contatori();
      c("500 per 6 ore senza un 200: ritentato davvero", true, risposte > 20);
      c("e nessun messaggio scartato o diviso: tutti e 100 in coda", { in_coda: 100, scartati: 0, divisi: 0 }, { in_coda: k.in_coda, scartati: k.scartati, divisi: k.divisi });
      c("scartati/ vuota anche su disco", 0, file(join(cart, "scartati")).length);
      f.segnalaBuono(); // il database torna: il battito riceve 200
      let passati = 0;
      for (let i = 0; i < 2000 && f.contatori().in_coda > 0; i++) {
        const v = f.prossimo();
        if (!v) {
          ora.vai(10_000);
          continue;
        }
        passati += v.lotto.messaggi.length;
        f.esito(v, { stato: 200, corpo: { ok: true, non_noti: [] } });
      }
      c("quando il database torna passano tutti", 100, passati);
    }

    //  Il lotto avvelenato: un 500 permanente su un messaggio fra cento,
    //  mentre il resto (altri lotti, il battito ogni 60 s) riceve 200.
    {
      const cart = nuovaCartella();
      const ora = orologio();
      const f = L.creaFila({ cartella: cart, orologio: ora });
      f.aggiungi("storico", molti(100), {});
      const veleno = "ID0031";
      const passati = new Set();
      const tentativiSingolo = [];
      let battito = T0;
      for (let giri = 0; giri < 20000 && ora() - T0 < 3 * 86_400_000; giri++) {
        if (ora() - battito >= 60_000) {
          battito = ora();
          f.segnalaBuono();
        }
        const v = f.prossimo();
        if (!v) {
          // al prossimo lotto pronto o al prossimo battito, il primo dei due
          ora.a(Math.max(ora() + 1, Math.min(f.prossimaSveglia() ?? Infinity, battito + 60_000)) - T0);
          continue;
        }
        if (v.lotto.messaggi.some((m) => m.id === veleno)) {
          if (v.lotto.messaggi.length === 1) tentativiSingolo.push(ora());
          f.esito(v, { stato: 500, corpo: { ok: false, errore: "database" } });
        } else {
          v.lotto.messaggi.forEach((m) => passati.add(m.id));
          f.esito(v, { stato: 200, corpo: { ok: true, non_noti: [] } });
        }
      }
      c("con dei 200 in mezzo si divide fino al singolo: 99 passano", 99, passati.size);
      c("il messaggio avvelenato non è passato", false, passati.has(veleno));
      c("ma resta in fila, da solo, e non in scartati/", { in_coda: 1, scartati: 0 }, { in_coda: f.contatori().in_coda, scartati: file(join(cart, "scartati")).length });
      const salti = tentativiSingolo.slice(1).map((t, i) => t - tentativiSingolo[i]);
      const lunghi = salti.slice(2);
      c("il singolo si ritenta: prima 3 volte, poi a lungo", true, tentativiSingolo.length >= 6);
      c("le attese lunghe vanno da 1 ora a 24 ore", true, lunghi.length > 0 && lunghi[0] >= 3_600_000 && lunghi.every((x) => x >= 3_600_000 && x <= 86_400_000 + 60_000));
      c("e arrivano al tetto di 24 ore", true, lunghi.some((x) => x >= 86_400_000));
    }

    //  Due code: i vivi non aspettano lo storico; l'attesa dei 30 s.
    {
      const ora = orologio();
      const f = L.creaFila({ cartella: nuovaCartella(), orologio: ora, attesaPariMs: 30_000 });
      f.aggiungi("storico", molti(10), {});
      const s = f.prossimo();
      f.esito(s, { stato: 503, corpo: null }); // storico fermo per un po'
      f.aggiungi("vivo", [msg(500, "393330000002")], {});
      c("un vivo non parte prima dei 30 s di attesa del pari", null, f.prossimo());
      ora.vai(30_000);
      const v = f.prossimo();
      c("dopo 30 s il vivo parte, anche se lo storico è fermo", "vivo", v?.origine);
      f.esito(v, { stato: 200, corpo: { ok: true, non_noti: [] } });
      f.aggiungi("storico", molti(5, "393330000003"), {});
      f.aggiungi("vivo", [msg(501, "393330000002")], {}, { prontoIl: ora() });
      c("con un vivo pronto, il vivo passa per primo", "vivo", f.prossimo()?.origine);
      c("la prossima sveglia è un orario in ms", "number", typeof f.prossimaSveglia());
    }

    //  I non noti: in fila 60 s alla volta, al massimo 10 minuti.
    {
      const cart = nuovaCartella();
      const ora = orologio();
      const f = L.creaFila({ cartella: cart, orologio: ora });
      f.aggiungi("vivo", [msg(1), msg(2, "393330000002")], {}, { prontoIl: T0 });
      const e = f.esito(f.prossimo(), { stato: 200, corpo: { ok: true, non_noti: ["ID0002"] } });
      c("200 con non_noti → tenuto solo quello", { azione: "tenuto", in_coda: 1 }, { azione: e.azione, in_coda: f.contatori().in_coda });
      ora.vai(59_000);
      c("non si ritenta prima di 60 s", null, f.prossimo());
      ora.vai(1000);
      const r = f.prossimo();
      c("dopo 60 s si ritenta con il solo non noto", ["ID0002"], r?.lotto.messaggi.map((m) => m.id));
      f.esito(r, { stato: 200, corpo: { ok: true, non_noti: ["ID0002"] } });
      let esito = null;
      for (let i = 0; i < 20 && !esito; i++) {
        ora.vai(60_000);
        const v = f.prossimo();
        if (!v) continue;
        const x = f.esito(v, { stato: 200, corpo: { ok: true, non_noti: ["ID0002"] } });
        if (x.azione !== "tenuto") esito = { azione: x.azione, dopoMinuti: (ora() - T0) / 60_000 };
      }
      c("dopo 10 minuti dal primo invio sparisce", { azione: "scaduto", dopoMinuti: 10 }, esito);
      c("e non resta su disco né in scartati/ (non è del CRM)", [0, 0], [file(join(cart, "vivo")).length, file(join(cart, "scartati")).length]);
      f.aggiungi("storico", [msg(9)], {});
      c("per lo storico non_noti non trattiene niente", "cancellato", f.esito(f.prossimo(), { stato: 200, corpo: { ok: true, non_noti: ["ID0009"] } }).azione);
    }

    //  Il ritmo dello storico: 3 s, doppio dopo un 429, torna dopo 10 buoni.
    {
      const ora = orologio();
      const f = L.creaFila({ cartella: nuovaCartella(), orologio: ora });
      f.aggiungi("storico", molti(50 * 15), {});
      const bene = { stato: 200, corpo: { ok: true, non_noti: [] } };
      f.esito(f.prossimo(), bene);
      ora.vai(2999);
      c("storico: niente prima di 3 s", null, f.prossimo());
      ora.vai(1);
      const b = f.prossimo();
      c("storico: il secondo lotto a 3 s", true, b !== null);
      f.esito(b, bene);
      ora.vai(3000);
      const terzo = f.prossimo();
      c("storico: il terzo a 3 s", true, terzo !== null);
      const e = f.esito(terzo, { stato: 429, corpo: null });
      c("429 → la pausa raddoppia (6 s)", 6000, e.pausaStorico);
      ora.vai(5999);
      c("dopo un 429 niente prima di 6 s", null, f.prossimo());
      ora.vai(1);
      const quarto = f.prossimo();
      c("a 6 s riparte", true, quarto !== null);
      let pausa = f.esito(quarto, { stato: 502, corpo: null }).pausaStorico;
      c("un 5xx la raddoppia ancora (12 s)", 12000, pausa);
      for (let i = 0; i < 3; i++) {
        ora.vai(30_000);
        pausa = f.esito(f.prossimo(), { stato: 503, corpo: null }).pausaStorico;
      }
      c("503 nella pausa dello storico non raddoppia (aspetta già)", 12000, pausa);
      for (let i = 0; i < 3; i++) {
        ora.vai(60_000);
        pausa = f.esito(f.prossimo(), { stato: 500, corpo: null }).pausaStorico;
      }
      c("la pausa ha un tetto di 30 s", 30000, pausa);
      const pause = [];
      for (let i = 0; i < 10; i++) {
        let v;
        while (!(v = f.prossimo())) ora.vai(500);
        pause.push(f.esito(v, bene).pausaStorico);
      }
      c("dopo 10 lotti buoni torna a 3 s", [30000, 3000], [pause[8], pause[9]]);
    }

    //  Coda piena: si ferma lo storico, i vivi continuano.
    {
      const ora = orologio();
      const f = L.creaFila({ cartella: nuovaCartella(), orologio: ora, limiti: { maxFile: 3 } });
      c("oltre il limite di file lo storico non entra", { accettati: 150, lotti: 3, piena: true }, f.aggiungi("storico", molti(200), {}));
      c("ma i vivi sì", { accettati: 1, lotti: 1, piena: false }, f.aggiungi("vivo", [msg(1)], {}));
      c("la fila dice di essere piena", true, f.contatori().piena);
      c("limiti di serie: 2000 file e 500 MB", [2000, 500 * 1024 * 1024], [L.RITMO.maxFile, L.RITMO.maxByte]);
    }

    //  scartati/ si svuota dopo 14 giorni.
    {
      const cart = nuovaCartella();
      const ora = orologio();
      const f = L.creaFila({ cartella: cart, orologio: ora });
      mkdirSync(join(cart, "scartati"), { recursive: true });
      writeFileSync(join(cart, "scartati", "vecchio.json"), "{}");
      writeFileSync(join(cart, "scartati", "nuovo.json"), "{}");
      const vecchio = new Date(T0 - 15 * 86_400_000);
      utimesSync(join(cart, "scartati", "vecchio.json"), vecchio, vecchio);
      const recente = new Date(T0 - 13 * 86_400_000);
      utimesSync(join(cart, "scartati", "nuovo.json"), recente, recente);
      c("pulisciScartati toglie i file oltre 14 giorni", 1, f.pulisciScartati());
      c("e tiene gli altri", ["nuovo.json"], readdirSync(join(cart, "scartati")));
      f.aggiungi("vivo", [msg(1)], {}, { prontoIl: T0 });
      f.esito(f.prossimo(), { stato: 400, corpo: null });
      const appena = readdirSync(join(cart, "scartati")).find((x) => x !== "nuovo.json");
      c("uno scartato adesso ha la data di adesso (non quella del lotto)", true, Math.abs(statSync(join(cart, "scartati", appena)).mtimeMs - T0) < 5000);
    }

    //  La spedizione: fetch finto, mai la rete.
    {
      const chiamate = [];
      const finto = (risposta) => async (url, init) => {
        chiamate.push({ url, init });
        if (risposta instanceof Error) throw risposta;
        return { status: risposta.status, text: async () => risposta.corpo };
      };
      const lotto = L.impacchetta("vivo", [msg(1)], {})[0];
      const token = "t".repeat(64);
      const r = await L.spedisci({ url: "https://crm.example.test/api/public/ponte-whatsapp", token, corpo: lotto, fetch: finto({ status: 200, corpo: '{"ok":true,"non_noti":[]}' }) });
      c("spedisci: stato e corpo letti", { stato: 200, corpo: { ok: true, non_noti: [] } }, r);
      const ch = chiamate[0];
      c("POST con X-HGL-Token e JSON, senza seguire redirect", ["POST", token, "application/json", "error", true], [ch.init.method, ch.init.headers["X-HGL-Token"], ch.init.headers["Content-Type"], ch.init.redirect, ch.init.body === JSON.stringify(lotto)]);
      c("rete assente → stato null", { stato: null, corpo: null }, await L.spedisci({ url: "https://crm.example.test/x", token, corpo: lotto, fetch: finto(new Error("ECONNREFUSED 393330000001")) }));
      c("corpo non JSON → corpo null", { stato: 502, corpo: null }, await L.spedisci({ url: "https://crm.example.test/x", token, corpo: lotto, fetch: finto({ status: 502, corpo: "<html>" }) }));
    }

    gruppo("PONTE WHATSAPP · IL SERVIZIO: RICONNESSIONE (compito T5)");
    const mezzo = () => 0.5; // nessuna variazione casuale
    const d = (codice, storia) => {
      const x = R.decidi(codice, storia ?? R.STORIA_VUOTA, mezzo);
      return { scollega: x.scollega, attesaMs: x.attesaMs, stato: x.stato };
    };
    c("515 dopo l'abbinamento → ricrea subito", { scollega: false, attesaMs: 0, stato: "in_collegamento" }, d(515));
    c("515 una seconda volta → attesa come la rete", 5000, d(515, { ...R.STORIA_VUOTA, riavvio: 1 }).attesaMs);
    c("401 → nuova sessione (QR)", { scollega: true, attesaMs: 0, stato: "sessione_scaduta" }, d(401));
    c("440 → 10 minuti, poi 1 ora", [600_000, 3_600_000, 3_600_000], [d(440).attesaMs, d(440, { ...R.STORIA_VUOTA, sostituita: 1 }).attesaMs, d(440, { ...R.STORIA_VUOTA, sostituita: 5 }).attesaMs]);
    c("440 → stato sostituita", "sostituita", d(440).stato);
    c("403 e 500 → 30 minuti, errore, notifica", [{ scollega: false, attesaMs: 1_800_000, stato: "errore" }, true, 1_800_000], [d(403), R.decidi(403, R.STORIA_VUOTA, mezzo).notifica, d(500).attesaMs]);
    let storia = R.STORIA_VUOTA;
    const rete = [];
    for (let i = 0; i < 7; i++) {
      const x = R.decidi(428, storia, mezzo);
      rete.push([x.attesaMs, x.stato]);
      storia = x.storia;
    }
    c(
      "rete: 5 s, 15 s, 45 s, 2 min, 5 min (tetto); rete_assente dal terzo",
      [[5000, "in_collegamento"], [15000, "in_collegamento"], [45000, "rete_assente"], [120000, "rete_assente"], [300000, "rete_assente"], [300000, "rete_assente"], [300000, "rete_assente"]],
      rete,
    );
    c("variazione casuale entro ±20 %", [4000, 6000], [R.decidi(408, R.STORIA_VUOTA, () => 0).attesaMs, R.decidi(408, R.STORIA_VUOTA, () => 0.9999999).attesaMs <= 6000 ? 6000 : -1]);
    c("codice sconosciuto o assente → come la rete", [5000, 5000], [d(null).attesaMs, d(999).attesaMs]);
    c("tutti gli stati sono della lista chiusa", true, [515, 401, 440, 403, 500, 408, null].every((k) => T.STATI_PONTE.includes(R.decidi(k, R.STORIA_VUOTA, mezzo).stato)));
    c("mai un ciclo stretto: solo 515 (una volta) e 401 ricreano subito", true, [408, 428, 503, 440, 403, 500, null].every((k) => R.decidi(k, R.STORIA_VUOTA, mezzo).attesaMs >= 4000));
    c("codiceChiusura legge il Boom di Baileys", [401, 515, null, null], [R.codiceChiusura({ error: { output: { statusCode: 401 } } }), R.codiceChiusura({ error: { output: { statusCode: 515 } } }), R.codiceChiusura({ error: new Error("x") }), R.codiceChiusura(undefined)]);

    gruppo("PONTE WHATSAPP · IL SERVIZIO: config.env (compito T5)");
    const token = "a1".repeat(32);
    const buono = `# commento\nPONTE_URL=https://crm.example.test/api/public/ponte-whatsapp\nPONTE_TOKEN="${token}"\nSTORICO_GIORNI=0\nexport ATTESA_PARI_SECONDI=30\n`;
    c("config valida", { ok: true, config: { url: "https://crm.example.test/api/public/ponte-whatsapp", token, storicoGiorni: 0, attesaPariSecondi: 30, invii: 0 } }, C.analizzaConfig(buono));
    c("valori di serie: storico intero, 30 s", { storicoGiorni: 0, attesaPariSecondi: 30 }, (({ storicoGiorni, attesaPariSecondi }) => ({ storicoGiorni, attesaPariSecondi }))(C.analizzaConfig(`PONTE_URL=https://a.test\nPONTE_TOKEN=${token}`).config));
    c("URL http → url_non_https", "url_non_https", C.analizzaConfig(`PONTE_URL=http://crm.example.test\nPONTE_TOKEN=${token}`).errore);
    c("URL con credenziali → url_non_valido", "url_non_valido", C.analizzaConfig(`PONTE_URL=https://u:p@crm.example.test\nPONTE_TOKEN=${token}`).errore);
    c("URL assente → manca_url", "manca_url", C.analizzaConfig(`PONTE_TOKEN=${token}`).errore);
    c("token assente → manca_token", "manca_token", C.analizzaConfig("PONTE_URL=https://a.test").errore);
    c("token di 31 caratteri → token_corto", "token_corto", C.analizzaConfig(`PONTE_URL=https://a.test\nPONTE_TOKEN=${"b".repeat(31)}`).errore);
    c("STORICO_GIORNI non numerico → valore_non_valido", "valore_non_valido", C.analizzaConfig(`PONTE_URL=https://a.test\nPONTE_TOKEN=${token}\nSTORICO_GIORNI=tanti`).errore);
    const corto = C.analizzaConfig(`PONTE_URL=https://a.test\nPONTE_TOKEN=${"segreto".repeat(4)}`);
    c("il messaggio d'errore non contiene il token", false, JSON.stringify(corto).includes("segreto"));
    const cart = join(base, "config");
    mkdirSync(cart);
    const env = join(cart, "config.env");
    writeFileSync(env, buono, { mode: 0o644 });
    chmodSync(env, 0o644);
    const largo = C.leggiConfig(env);
    c("config.env con permessi larghi → permessi_larghi", "permessi_larghi", largo.errore);
    c("con una parola chiara: chmod 600", true, /chmod 600/.test(largo.messaggio));
    chmodSync(env, 0o600);
    c("con permessi 600 si legge", true, C.leggiConfig(env).ok);
    c("file assente → manca_file", "manca_file", C.leggiConfig(join(cart, "non-ce.env")).errore);

    gruppo("PONTE WHATSAPP · IL SERVIZIO: CATENA DI FORNITURA E .gitignore (compito T5)");
    const cartella = join(radice, "strumenti/ponte-whatsapp");
    const pkg = JSON.parse(readFileSync(join(cartella, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(join(cartella, "package-lock.json"), "utf8"));
    c("package.json: Baileys esatto, qrcode esatto, type module, start", ["7.0.0-rc14", true, "module", "node src/index.mjs"], [pkg.dependencies["@whiskeysockets/baileys"], /^\d+\.\d+\.\d+$/.test(pkg.dependencies.qrcode), pkg.type, pkg.scripts.start]);
    c("nessuna dipendenza con ^ o ~", true, Object.values(pkg.dependencies).every((v) => /^\d/.test(v)));
    c("lockfile: @whiskeysockets/baileys 7.0.0-rc14", "7.0.0-rc14", lock.packages?.["node_modules/@whiskeysockets/baileys"]?.version);
    c("lockfile: la radice chiede le stesse versioni", pkg.dependencies, lock.packages?.[""]?.dependencies);
    const nomi = Object.keys(lock.packages ?? {});
    c("nessun pacchetto «baileys» omonimo", [], nomi.filter((k) => /(^|\/)baileys$/.test(k) && k !== "node_modules/@whiskeysockets/baileys"));
    c("tutto dal registro npm (niente git, niente tarball altrove)", [], Object.entries(lock.packages ?? {}).filter(([k, v]) => k && v.resolved && !v.resolved.startsWith("https://registry.npmjs.org/")).map(([k]) => k));
    c("ogni pacchetto ha la sua impronta (integrity)", [], Object.entries(lock.packages ?? {}).filter(([k, v]) => k && !v.link && !v.integrity).map(([k]) => k));
    const gi = readFileSync(join(radice, ".gitignore"), "utf8").split("\n").map((r) => r.trim());
    const righe = ["strumenti/ponte-whatsapp/auth*/", "creds.json", "app-state-sync-*", "config.env", "*.qr.png", "qr.png", "fila/"];
    c(".gitignore ha le righe del §a1", righe, righe.filter((r) => gi.includes(r)));
    let tracciati = null;
    try {
      tracciati = execFileSync("git", ["ls-files"], { cwd: radice, encoding: "utf8" }).split("\n");
    } catch {
      tracciati = null; // fuori da git (copia del codice): la prova del .gitignore basta
    }
    if (tracciati) {
      const sospetti = tracciati.filter((f) => /(^|\/)(creds\.json|config\.env|qr\.png|[^/]*\.qr\.png)$|(^|\/)app-state-sync-|^strumenti\/ponte-whatsapp\/(auth[^/]*|fila|node_modules)\//.test(f));
      c("nessuna credenziale, QR, fila o node_modules del ponte nel repo", [], sospetti);
    }

    //  Le parti pure non scrivono log e non parlano con WhatsApp (le guardie
    //  di tutto il servizio, con index.mjs e collega.mjs, sono di T6).
    const pure = ["estrai.mjs", "lotti.mjs", "riconnessione.mjs", "config.mjs"];
    const testi = pure.map((f) => readFileSync(join(cartella, "src", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""));
    c("parti pure: nessun console.* (testi e numeri non vanno nei log)", [], pure.filter((_, i) => /\bconsole\./.test(testi[i])));
    const vietati = ["sendMessage", "readMessages", "sendReceipt", "sendPresenceUpdate", "groupCreate", "updateProfile", "relayMessage", "chatModify"];
    c("parti pure: nessuna chiamata che scrive su WhatsApp", [], vietati.filter((v) => testi.some((t) => t.includes(v))));
    c("parti pure: nessun import di Baileys", [], pure.filter((_, i) => /baileys/i.test(testi[i])));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
