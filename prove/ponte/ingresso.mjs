/** ── PROVE: L'INGRESSO DELLA ROTTA (ingresso.ts) ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T3.
 *  `leggiLotto`, `leggiBattito` e `gestisciRichiesta` con porte finte: un
 *  piccolo database in memoria che fa quello che promettono le tre funzioni
 *  SQL (§e.5), abbastanza per vedere idempotenza e pari tardivi.
 *  30/10 «tutte le chat»: D7 tolta (ogni numero entra, `non_noti` sempre vuoto,
 *  `noti` non si consulta più) e D9 cambiata (`e` vale anche per le entrate
 *  vive senza pari; `promuovi` dopo ogni lotto vivo e ogni battito).
 *  I contratti stanno in `src/crm/ponte/tipi.ts` (`mod["ponte/tipi"]`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */

const SEGRETO = "s".repeat(32);
const ADESSO = new Date("2026-10-29T12:00:00Z");
const ORA = Math.floor(ADESSO.getTime() / 1000);
const NUM = "393331234567";
const ALTRO = "393339876543";
const UTENTE = "00000000-0000-4000-8000-000000000001";
/** Tutte le chiamate di `avviso` di tutte le porte finte, per la prova dei log. */
const tuttiAvvisi = [];

/** Un messaggio valido (§b2). */
const msg = (o = {}) => ({ id: "3EB0A1", numero: NUM, dir: "in", ts: ORA - 60, testo: "Ciao", tipo: "testo", ...o });
const lotto = (messaggi, o = {}) => ({ v: 1, tipo: "lotto", origine: "vivo", messaggi, ...o });

/** Una richiesta «vera» (Request di Node). */
function richiesta(corpo, { token = SEGRETO } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-HGL-Token"] = token;
  return new Request("https://esempio.invalid/api/public/ponte-whatsapp", {
    method: "POST",
    headers,
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

/** Le porte finte e il loro database. */
function finte(o = {}) {
  const db = {
    noti: new Set(o.noti ?? [NUM]),
    crm: o.crm ?? [],
    messaggi: new Map(), // k → { riga, duplicato_di }
    contatti: new Map(), // cifre → { origine, nome }
    stato: null,
  };
  const chiamate = { utente: 0, noti: [], candidati: [], scrivi: [], recenti: [], battito: [], promuovi: [] };
  const avvisi = [];
  const presi = () => new Set([...db.messaggi.values()].map((m) => m.duplicato_di).filter(Boolean));
  const P = o.P;
  const porte = {
    async utente() {
      chiamate.utente++;
      if (o.rompi === "utente") throw { code: "08006" };
      return o.utente === undefined ? UTENTE : o.utente;
    },
    //  Dal 30/10 la porta `noti` non esiste più (D7 tolta): questa finta c'è solo
    //  per accorgersi se qualcuno la richiama (`chiamate.noti` deve restare vuoto).
    async noti(u, numeri) {
      chiamate.noti.push({ u, numeri });
      return numeri.filter((n) => db.noti.has(n));
    },
    async candidati(u, righe) {
      chiamate.candidati.push({ u, righe });
      if (o.rompi === "candidati") throw { code: o.codice ?? "XX000" };
      const presa = presi();
      const out = [];
      for (const r of righe)
        for (const x of db.crm)
          if (!presa.has(x.id) && P.ammessoCome(x, r))
            out.push({ k: r.k, id: x.id, created_at: x.created_at, direction: x.direction, body: x.body, canale: x.canale });
      return out;
    },
    async scrivi(u, s) {
      chiamate.scrivi.push({ u, s: JSON.parse(JSON.stringify(s)) });
      if (o.rompi === "scrivi") throw { code: o.codice ?? "XX000" };
      const esito = { nuovi: 0, gia_presenti: 0, doppioni: 0, pari_persi: 0, contatti_nuovi: 0, risposto: 0 };
      const pari = new Map(s.pari.map((p) => [p.k, p.crm]));
      for (const r of s.righe) {
        if (db.messaggi.has(r.k)) {
          esito.gia_presenti++;
          continue;
        }
        let dup = pari.get(r.k) ?? null;
        if (dup && presi().has(dup)) (dup = null), esito.pari_persi++;
        db.messaggi.set(r.k, { riga: r, duplicato_di: dup });
        pari.delete(r.k);
        esito.nuovi++;
        if (dup) esito.doppioni++;
        if (!db.contatti.has(r.n)) db.contatti.set(r.n, { origine: "baileys", nome: s.nomi[r.n] ?? null }), esito.contatti_nuovi++;
        if (r.e) esito.risposto++;
      }
      for (const [k, crm] of pari) {
        const m = db.messaggi.get(k);
        if (!m || m.duplicato_di) continue;
        if (presi().has(crm)) {
          esito.pari_persi++;
          continue;
        }
        m.duplicato_di = crm;
        esito.doppioni++;
      }
      return esito;
    },
    async promuovi(u, attesaS) {
      chiamate.promuovi.push({ u, attesaS });
      if (o.rompi === "promuovi") throw { code: o.codice ?? "XX000" };
      return { promosse: o.promosse ?? 0, saltate: 0 };
    },
    async recentiDelPonte(u, dal) {
      chiamate.recenti.push({ u, dal: dal.toISOString() });
      return [...db.messaggi.values()]
        .filter((m) => !m.duplicato_di && m.riga.t * 1000 >= dal.getTime())
        .map(({ riga: { k, n, d, t, x, m } }) => ({ k, n, d, t, x, m }));
    },
    async battito(u, b) {
      chiamate.battito.push({ u, b });
      if (o.rompi === "battito") throw { code: "XX000" };
      db.stato = b;
    },
    avviso(codice, conteggi) {
      avvisi.push(conteggi === undefined ? [codice] : [codice, conteggi]);
      tuttiAvvisi.push([codice, conteggi]);
    },
  };
  return { porte, db, chiamate, avvisi };
}

export async function provePonteIngresso(mod, { c, gruppo }) {
  const I = mod["ponte/ingresso"];
  const P = mod["ponte/pari"];
  const T = mod["ponte/tipi"];
  if (!I || !P) return; // i moduli entrano nel pacchetto quando esistono

  //  Nessuna riga di log fuori da `porte.avviso`: si intercetta `console`.
  const scritte = [];
  const originali = {};
  for (const k of ["log", "info", "warn", "error", "debug"]) {
    originali[k] = console[k];
    console[k] = (...a) => scritte.push(a);
  }
  const vai = async (porte, corpo, o = {}) => {
    const r = await I.gestisciRichiesta(porte, { request: o.request ?? richiesta(corpo, o), segreto: "segreto" in o ? o.segreto : SEGRETO, adesso: o.adesso ?? ADESSO });
    return { stato: r.status, json: await r.json(), tipo: r.headers.get("content-type"), cache: r.headers.get("cache-control") };
  };
  const risultati = [];
  const prova = (nome, atteso, letto) => risultati.push([nome, atteso, letto]);
  try {
    // ── leggiLotto: ripulitura e scarti (§b2) ──
    {
      const L = (m, o) => I.leggiLotto(lotto(m, o), ADESSO);
      const l = L([msg({ testo: "ci\u0000ao a\ud800b \udc00 ok 😀" })], { nomi: { [NUM]: "Gi\u0000ulia\ud800" } });
      prova("testo con \\u0000 e surrogate isolate → passa ripulito (la coppia vera resta)", "ciao a\uFFFDb \uFFFD ok 😀", l?.messaggi[0]?.testo);
      prova("anche i nomi si ripuliscono", { [NUM]: "Giulia\uFFFD" }, l?.nomi);
      const t4000 = L([msg({ testo: "a".repeat(3999) + "😀" + "b" })])?.messaggi[0]?.testo;
      prova("testo tagliato a 4000 senza spezzare una emoji", "a".repeat(3999), t4000);
      prova("nome tagliato a 80, vuoto o non stringa → via", { [NUM]: "n".repeat(80) }, L([msg()], { nomi: { [NUM]: "n".repeat(90), [ALTRO]: "  ", "39abc": "x", "393330000000": 5 } })?.nomi);
      const casi = [
        msg({ id: "a b" }),
        msg({ id: "x".repeat(129) }),
        msg({ id: "" }),
        msg({ numero: "+393331234567" }),
        msg({ numero: "120363012345678901" }), // un gruppo (18 cifre)
        msg({ numero: "1234567" }),
        msg({ dir: "su" }),
        msg({ ts: ORA + 0.5 }),
        msg({ ts: T.TS_MINIMO - 1 }),
        msg({ ts: ORA + 11 * 60 }),
        msg({ ts: "1761730000" }),
        msg({ testo: "   " }),
        msg({ testo: 5 }),
        msg({ tipo: "gif" }),
        "non un oggetto",
      ];
      const s = L(casi);
      prova("righe non valide: scartate e contate, il lotto non cade", { messaggi: 0, scartati: casi.length, ricevuti: casi.length }, { messaggi: s?.messaggi.length, scartati: s?.scartati, ricevuti: s?.ricevuti });
      prova("ts fino a adesso + 10 minuti passa, il minimo pure", [2, 0], [L([msg({ ts: ORA + 600 }), msg({ id: "b", ts: T.TS_MINIMO })])?.messaggi.length, L([msg({ ts: ORA + 600 })])?.scartati]);
      prova("stesso messaggio due volte nel lotto → uno, l'altro scartato", [1, 1], (() => { const x = L([msg(), msg()]); return [x?.messaggi.length, x?.scartati]; })());
      prova("stato: in → ignorato; out senza stato → sent; out read → read; out sconosciuto → sent", [undefined, "sent", "read", "sent"], L([msg(), msg({ id: "b", dir: "out" }), msg({ id: "c", dir: "out", stato: "read" }), msg({ id: "d", dir: "out", stato: "played" })])?.messaggi.map((m) => m.stato));
      prova("id con . _ - passa", 1, L([msg({ id: "3EB0_a.b-c" })])?.messaggi.length);
      const no = [
        null,
        [],
        "x",
        { ...lotto([msg()]), v: 2 },
        { ...lotto([msg()]), tipo: "altro" },
        lotto([msg()], { origine: "boh" }),
        lotto([]),
        lotto("x"),
        lotto(Array.from({ length: 201 }, (_, i) => msg({ id: `m${i}` }))),
        lotto(Array.from({ length: 51 }, (_, i) => msg({ id: `m${i}` })), { origine: "storico" }),
      ];
      prova("corpo non valido → null (400): v, tipo, origine, vuoto, 201 vivi, 51 di storico", no.map(() => null), no.map((x) => I.leggiLotto(x, ADESSO)));
      prova("200 vivi e 50 di storico passano", [200, 50], [
        I.leggiLotto(lotto(Array.from({ length: 200 }, (_, i) => msg({ id: `m${i}` }))), ADESSO)?.messaggi.length,
        I.leggiLotto(lotto(Array.from({ length: 50 }, (_, i) => msg({ id: `m${i}` })), { origine: "storico" }), ADESSO)?.messaggi.length,
      ]);
      prova("più di 200 nomi: si tengono i primi 200", 200, Object.keys(L([msg()], { nomi: Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`39333${String(i).padStart(7, "0")}`, "N"])) })?.nomi ?? {}).length);
    }

    // ── leggiBattito (§b3) ──
    {
      const b = I.leggiBattito({
        v: 1,
        tipo: "battito",
        stato: "collegato",
        collegato_dal: "2026-10-29T10:00:00.000Z",
        ultimo_messaggio_il: "non una data",
        storico: { fatto: true, avanzamento: 100, Brutta: 1, testo: "x", infinito: Infinity },
        in_coda: 3,
        scartati: 1,
        contatori: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`chiave_${String.fromCharCode(97 + i)}`, i])),
        versione: "7".repeat(50),
        qr: "non deve passare",
      });
      prova("battito: date, storico a soli numeri (booleano 1/0), versione ≤ 40", {
        stato: "collegato",
        collegato_dal: "2026-10-29T10:00:00.000Z",
        ultimo_messaggio_il: null,
        storico: { fatto: 1, avanzamento: 100 },
        versione: "7".repeat(40),
      }, b && { stato: b.stato, collegato_dal: b.collegato_dal, ultimo_messaggio_il: b.ultimo_messaggio_il, storico: b.storico, versione: b.versione });
      prova("battito: contatori al più 22 chiavi, in_coda e scartati dentro", [22, 3, 1], [Object.keys(b?.contatori ?? {}).length, b?.contatori.in_coda, b?.contatori.scartati]);
      prova("battito: solo i sei campi (il QR non passa mai)", ["collegato_dal", "contatori", "stato", "storico", "ultimo_messaggio_il", "versione"], Object.keys(b ?? {}).sort());
      prova("battito: stato fuori lista → errore", "errore", I.leggiBattito({ v: 1, tipo: "battito", stato: "boh" })?.stato);
      prova("battito minimo: tutto vuoto", { stato: "fermo", collegato_dal: null, ultimo_messaggio_il: null, storico: {}, contatori: {}, versione: null }, I.leggiBattito({ v: 1, tipo: "battito", stato: "fermo", storico: "x", contatori: [1, 2] }));
      prova("battito con v sbagliato → null", [null, null], [I.leggiBattito({ v: 2, tipo: "battito", stato: "fermo" }), I.leggiBattito(null)]);
    }

    // ── gestisciRichiesta: protezione (§b1) ──
    {
      const f = finte({ P });
      const r = await vai(f.porte, lotto([msg()]), { segreto: undefined });
      prova("segreto assente → 503 non_configurato", [503, { ok: false, errore: "non_configurato" }], [r.stato, r.json]);
      const r31 = await vai(f.porte, lotto([msg()]), { segreto: "s".repeat(31), token: "s".repeat(31) });
      prova("segreto di 31 caratteri → 503, anche con la chiave giusta", [503, "non_configurato"], [r31.stato, r31.json.errore]);
      prova("…e nel log solo il codice segreto_corto; niente database", [true, 0], [f.avvisi.some(([k]) => k === "segreto_corto"), f.chiamate.utente]);

      let letto = false;
      const finta = { method: "POST", headers: new Headers({ "X-HGL-Token": "t".repeat(32) }), get body() { letto = true; throw new Error("letto"); } };
      const r401 = await vai(f.porte, null, { request: finta });
      prova("chiave sbagliata → 401 e il corpo non si legge", [401, "non_autorizzato", false], [r401.stato, r401.json.errore, letto]);
      const rNo = await vai(f.porte, lotto([msg()]), { token: null });
      prova("chiave assente → 401", 401, rNo.stato);
      prova("intestazioni: JSON e no-store", ["application/json", "no-store"], [r401.tipo, r401.cache]);

      const grande = await vai(f.porte, "x".repeat(T.LIMITI.corpoByte + 1));
      prova("256 KB + 1 → 413", [413, "troppo_grande"], [grande.stato, grande.json.errore]);
      const giusto = await vai(f.porte, "x".repeat(T.LIMITI.corpoByte));
      prova("256 KB esatti non sono troppo grandi (JSON rotto → 400)", [400, "corpo_non_valido"], [giusto.stato, giusto.json.errore]);
      prova("201 messaggi → 400", 400, (await vai(f.porte, lotto(Array.from({ length: 201 }, (_, i) => msg({ id: `m${i}` }))))).stato);
      prova("storico da 51 → 400", 400, (await vai(f.porte, lotto(Array.from({ length: 51 }, (_, i) => msg({ id: `m${i}` })), { origine: "storico" }))).stato);
      prova("tipo sconosciuto → 400", 400, (await vai(f.porte, { v: 1, tipo: "boh" })).stato);
      prova("fino qui niente scritto", [0, 0], [f.chiamate.scrivi.length, f.db.messaggi.size]);
    }
    {
      const senza = finte({ P, utente: null });
      const r = await vai(senza.porte, lotto([msg()]));
      prova("senza manychat_config → 503 non_configurato, niente scritto", [503, "non_configurato", 0], [r.stato, r.json.errore, senza.chiamate.scrivi.length]);
      const rotto = finte({ P, rompi: "utente" });
      prova("utente che lancia → 500 database", [500, "database"], await vai(rotto.porte, lotto([msg()])).then((x) => [x.stato, x.json.errore]));
    }

    // ── il giro del lotto ──
    {
      const f = finte({ P });
      const corpo = { ...lotto([msg({ testo: "Va bene, grazie" }), msg({ id: "B2", dir: "out", ts: ORA - 30, testo: "📷 Foto", tipo: "foto", stato: "read" })], { nomi: { [NUM]: "Giulia", [ALTRO]: "Fornitore" } }), user_id: "11111111-1111-4111-8111-111111111111" };
      const r = await vai(f.porte, corpo);
      prova("lotto vivo → 200 con i conteggi", [200, { ok: true, ricevuti: 2, nuovi: 2, gia_presenti: 0, doppioni: 0, scartati: 0, fuori_rubrica: 0, non_noti: [] }], [r.stato, r.json]);
      const s = f.chiamate.scrivi[0]?.s;
      prova(
        "p_righe come il contratto: chiave bw:, in → delivered, out → stato, media_type, effetto (e) sull'entrata viva senza pari (D9) e sull'uscita viva (D8)",
        [
          { k: `bw:${NUM}:3EB0A1`, n: NUM, d: "in", t: ORA - 60, x: "Va bene, grazie", e: true, m: null, s: "delivered" },
          { k: `bw:${NUM}:B2`, n: NUM, d: "out", t: ORA - 30, x: "📷 Foto", e: true, m: "foto", s: "read" },
        ],
        s?.righe,
      );
      prova("p_nomi: i nomi dei numeri del lotto, per intero (se salvarli lo decide l'SQL: E7)", { [NUM]: "Giulia" }, s?.nomi);
      prova("l'utente è quello del server, mai quello del corpo", [UTENTE], [...new Set([...f.chiamate.candidati, ...f.chiamate.scrivi, ...f.chiamate.recenti, ...f.chiamate.promuovi].map((x) => x.u))]);
      prova("D7 tolta: il giro del lotto non chiama mai noti", 0, f.chiamate.noti.length);
      prova("dopo un lotto vivo, il controllo tardivo degli ultimi 60 minuti", new Date(ADESSO.getTime() - 60 * 60e3).toISOString(), f.chiamate.recenti[0]?.dal);
      const prima = f.db.messaggi.size;
      const r2 = await vai(f.porte, corpo);
      prova("lotto ripetuto → stesso database, già presenti", [prima, 200, 0, 2], [f.db.messaggi.size, r2.stato, r2.json.nuovi, r2.json.gia_presenti]);
    }
    {
      //  D7 TOLTA (30/10, «tutte le chat»): un numero che il CRM non conosce entra
      //  come ogni altro, in entrata e in uscita, e nasce un contatto senza scheda.
      const f = finte({ P, noti: [] });
      const corpo = lotto([msg({ numero: ALTRO }), msg({ id: "B2", numero: ALTRO, dir: "out" })], { nomi: { [ALTRO]: "Fornitore" } });
      const r = await vai(f.porte, corpo);
      prova("vivo in e out di un numero sconosciuto → scritti, nessun non_noti, contatto nuovo", [200, [], 2, 2, 1, 0], [r.stato, r.json.non_noti, r.json.nuovi, f.db.messaggi.size, f.db.contatti.size, r.json.fuori_rubrica]);
      prova("…cercando i candidati anche per lui (2 righe) e senza consultare noti", [2, 0], [f.chiamate.candidati[0]?.righe.length, f.chiamate.noti.length]);
      prova("…il contatto è del ponte e il nome arriva all'SQL (che per gli sconosciuti non lo salva)", [["baileys"], { [ALTRO]: "Fornitore" }], [[f.db.contatti.get(ALTRO)?.origine], f.chiamate.scrivi[0]?.s.nomi]);
      const r2 = await vai(f.porte, corpo);
      prova("lo stesso lotto di nuovo: niente di nuovo, ancora nessun non_noti", [[], 0, 2], [r2.json.non_noti, r2.json.nuovi, r2.json.gia_presenti]);
    }
    {
      //  Un contatto creato dal ponte non cambia niente: la rotta non guarda la rubrica.
      const f = finte({ P, noti: [] });
      f.db.contatti.set(ALTRO, { origine: "baileys", nome: null });
      const r = await vai(f.porte, lotto([msg({ numero: ALTRO })]));
      prova("un contatto con origine baileys: il numero entra lo stesso, noti mai consultata", [[], 1, 0], [r.json.non_noti, r.json.nuovi, f.chiamate.noti.length]);
    }
    {
      const f = finte({ P, noti: [NUM] });
      const r = await vai(f.porte, lotto([msg(), msg({ id: "X9", numero: ALTRO }), msg({ id: "z z" })], { origine: "storico" }));
      //  Dal 30/10 anche lo storico di un numero sconosciuto entra: niente più
      //  fuori_rubrica né non_noti (un ponte vecchio li ignora comunque).
      prova("storico: tutti scritti (anche lo sconosciuto), fuori_rubrica 0, non_noti vuoto, scartati contati", { ricevuti: 3, nuovi: 2, fuori_rubrica: 0, non_noti: [], scartati: 1 }, { ricevuti: r.json.ricevuti, nuovi: r.json.nuovi, fuori_rubrica: r.json.fuori_rubrica, non_noti: r.json.non_noti, scartati: r.json.scartati });
      prova("storico: nessun effetto (e falso per ogni riga, in e out), nessun controllo tardivo, nessuna promozione", [[false, false], 0, 0], [f.chiamate.scrivi[0]?.s.righe.map((x) => x.e), f.chiamate.recenti.length, f.chiamate.promuovi.length]);
      const f2 = finte({ P, noti: [] });
      const r2 = await vai(f2.porte, lotto([msg()], { origine: "storico" }));
      prova("storico di un numero sconosciuto → 200, scritto, mai marcato", [200, 0, 1, 1, false], [r2.stato, r2.json.fuori_rubrica, r2.json.nuovi, f2.chiamate.scrivi.length, f2.chiamate.scrivi[0]?.s.righe[0].e]);
      const f3 = finte({ P });
      const r3 = await vai(f3.porte, lotto([msg({ id: "a b" })]));
      prova("lotto vuoto dopo gli scarti → 200 a zero", [200, 1, 0, 0], [r3.stato, r3.json.scartati, r3.json.nuovi, f3.chiamate.scrivi.length]);
    }
    {
      //  D9 cambiata: «e» vale anche per le entrate, solo vive e senza pari, entro 7 giorni.
      const crm = [{ id: "c2", direction: "inbound", from_number: `+${NUM}`, to_number: "manychat", body: "Ok", canale: "manychat", status: "delivered", duplicato_di: null, created_at: new Date((ORA - 50) * 1000).toISOString() }];
      const f = finte({ P, crm, noti: [] });
      await vai(f.porte, lotto([
        msg({ id: "i1", ts: ORA - 60, testo: "Ok" }), // ha il pari ManyChat
        msg({ id: "i2", ts: ORA - 70, testo: "domanda libera", numero: ALTRO }), // sconosciuto, senza pari
        msg({ id: "i3", ts: ORA - 8 * 86400, testo: "di otto giorni fa", numero: ALTRO }), // troppo vecchia
        msg({ id: "o1", dir: "out", ts: ORA - 20, testo: "risposta dal telefono", numero: ALTRO }), // D8
      ]));
      prova("vivo: entrata col pari no, entrata senza pari sì (anche sconosciuta), entrata di 8 giorni no, uscita sì", { i1: false, i2: true, i3: false, o1: true },
        Object.fromEntries((f.chiamate.scrivi[0]?.s.righe ?? []).map((x) => [x.k.split(":")[2], x.e])));
      const g = finte({ P });
      await vai(g.porte, lotto([msg({ id: "s1" }), msg({ id: "s2", dir: "out" })], { origine: "storico" }));
      prova("storico: e falso per entrata e uscita, qualunque sia la data", [false, false], g.chiamate.scrivi[0]?.s.righe.map((x) => x.e));
    }
    {
      //  D8: effetto solo per vivo + out + senza pari + entro 7 giorni.
      const crm = [{ id: "c1", direction: "outbound", from_number: "manychat", to_number: `+${NUM}`, body: "[template:promemoria]", canale: "manychat", status: "sent", duplicato_di: null, created_at: new Date((ORA - 100) * 1000).toISOString() }];
      const f = finte({ P, crm });
      const r = await vai(f.porte, lotto([
        msg({ id: "o1", dir: "out", ts: ORA - 80, testo: "📋 Ti ricordo" }),
        msg({ id: "o2", dir: "out", ts: ORA - 8 * 86400, testo: "vecchio" }),
        msg({ id: "o3", dir: "out", ts: ORA - 6 * 86400, testo: "recente" }),
      ]));
      prova("effetto: col pari no, oltre 7 giorni no, entro 7 giorni sì", { o1: false, o2: false, o3: true }, Object.fromEntries((f.chiamate.scrivi[0]?.s.righe ?? []).map((x) => [x.k.split(":")[2], x.e])));
      prova("il pari va in p_pari e torna in doppioni", [[{ k: `bw:${NUM}:o1`, crm: "c1" }], 1], [f.chiamate.scrivi[0]?.s.pari, r.json.doppioni]);
    }
    {
      //  Controllo tardivo (§c1.8): il pari arriva dopo, il battito lo trova.
      const f = finte({ P });
      await vai(f.porte, lotto([msg({ testo: "Arrivo alle 5" })]));
      f.db.crm.push({ id: "c9", direction: "inbound", from_number: `+${NUM}`, to_number: "manychat", body: "arrivo alle 5", canale: "manychat", status: "delivered", duplicato_di: null, created_at: new Date((ORA - 55) * 1000).toISOString() });
      const r = await vai(f.porte, { v: 1, tipo: "battito", stato: "collegato", storico: { fatto: true } });
      prova("battito → 200 con i pari tardivi riconciliati", [200, { ok: true, riconciliati: 1 }], [r.stato, r.json]);
      prova("il battito scrive lo stato ripulito", { stato: "collegato", storico: { fatto: 1 } }, f.db.stato && { stato: f.db.stato.stato, storico: f.db.stato.storico });
      const ult = f.chiamate.scrivi.at(-1)?.s;
      prova("il controllo tardivo scrive solo p_pari", { righe: [], pari: [{ k: `bw:${NUM}:3EB0A1`, crm: "c9" }], nomi: {} }, ult);
      prova("la riga del ponte ora è un doppione", "c9", f.db.messaggi.get(`bw:${NUM}:3EB0A1`)?.duplicato_di);
      const r2 = await vai(f.porte, { v: 1, tipo: "battito", stato: "collegato" });
      prova("al battito dopo niente da riconciliare, niente scritto", [0, f.chiamate.scrivi.length], [r2.json.riconciliati, f.chiamate.scrivi.length]);
      prova("battito con v sbagliato → 400", 400, (await vai(f.porte, { v: 2, tipo: "battito", stato: "collegato" })).stato);
    }
    {
      //  p3 (30/10): la richiesta «noti» del ponte. Entrano solo cifre, escono
      //  solo quelle che il CRM conosce; nessuna scrittura.
      const N = (numeri, o = {}) => ({ v: 1, tipo: "noti", numeri, ...o });
      prova("leggiNoti: solo cifre 8-15, senza ripetizioni", [NUM, ALTRO], I.leggiNoti(N([NUM, ALTRO, NUM, "+393331234567", "abc", 5, "120363012345678901"])));
      const no = [null, N([]), N("x"), N([NUM], { v: 2 }), { ...N([NUM]), tipo: "lotto" }, N(Array.from({ length: 201 }, (_, i) => `39333${String(i).padStart(7, "0")}`))];
      prova("leggiNoti: corpo non valido → null (vuoto, v, tipo, 201 numeri)", no.map(() => null), no.map((x) => I.leggiNoti(x)));
      prova("leggiNoti: 200 numeri passano", 200, I.leggiNoti(N(Array.from({ length: 200 }, (_, i) => `39333${String(i).padStart(7, "0")}`)))?.length);
      //  30/10: D7 tolta, il CRM «conosce» ogni numero. La richiesta risponde con
      //  tutti i numeri chiesti (ripuliti) senza interrogare il database: il Mac
      //  mette in fila come storico tutta la sua cache.
      const f = finte({ P, noti: [NUM] });
      const r = await vai(f.porte, N([NUM, ALTRO, NUM, "abc"]));
      prova("noti → 200 con TUTTI i numeri chiesti (ripuliti, senza ripetizioni), niente scritto né riconciliato", [200, { ok: true, noti: [NUM, ALTRO] }, 0, 0, 0], [r.stato, r.json, f.chiamate.scrivi.length, f.chiamate.recenti.length, f.chiamate.battito.length]);
      prova("noti: nessuna porta del database consultata (nemmeno l'utente)", [0, 0, 0], [f.chiamate.noti.length, f.chiamate.candidati.length, f.chiamate.promuovi.length]);
      const r2 = await vai(f.porte, N(["abc"]));
      prova("noti con sole righe non valide → 200 vuoto", [200, []], [r2.stato, r2.json.noti]);
      prova("noti con v sbagliato → 400", 400, (await vai(f.porte, N([NUM], { v: 2 }))).stato);
      prova("noti senza chiave → 401", 401, (await vai(f.porte, N([NUM]), { token: "sbagliata".repeat(4) })).stato);
      const g = finte({ P, rompi: "utente" });
      prova("noti con il database giù → 200 lo stesso (non lo usa)", 200, (await vai(g.porte, N([NUM]))).stato);
      prova("noti nel log: solo i conteggi chiesti e noti", [["noti", { chiesti: 2, noti: 2 }]], f.avvisi.filter(([k]) => k === "noti").slice(0, 1).map(([k, n]) => [k, n]));
    }
    {
      //  D9: la promozione dopo ogni lotto vivo e ogni battito, mai dopo lo storico.
      const f = finte({ P, promosse: 2 });
      await vai(f.porte, lotto([msg()]));
      prova("dopo un lotto vivo: promuovi con l'utente del server e 120 secondi di attesa", [[{ u: UTENTE, attesaS: T.PROMOZIONE_ATTESA_S }], 120], [structuredClone(f.chiamate.promuovi), T.PROMOZIONE_ATTESA_S]);
      prova("…dopo i pari (il controllo tardivo viene prima) e se promuove nel log c'è «promosse» col conteggio", [true, [["promosse", { n: 2 }]]], [f.chiamate.recenti.length === 1, f.avvisi.filter(([k]) => k === "promosse")]);
      const b = await vai(f.porte, { v: 1, tipo: "battito", stato: "collegato" });
      prova("dopo un battito: promuovi di nuovo (anche con nulla da riconciliare)", [200, 2], [b.stato, f.chiamate.promuovi.length]);
      await vai(f.porte, lotto([msg({ id: "S1" })], { origine: "storico" }));
      prova("dopo lo storico: nessuna promozione", 2, f.chiamate.promuovi.length);
      const g = finte({ P });
      await vai(g.porte, lotto([msg()]));
      prova("promuovi che non promuove niente: nessun avviso «promosse»", 0, g.avvisi.filter(([k]) => k === "promosse").length);
      const h = finte({ P, rompi: "promuovi", codice: "PGRST202" });
      const rh = await vai(h.porte, lotto([msg()]));
      const bh = await vai(h.porte, { v: 1, tipo: "battito", stato: "collegato" });
      prova("promuovi che lancia (migrazione non applicata): lotto e battito restano 200, nel log funzioni_assenti", [200, 1, 200, true], [rh.stato, rh.json.nuovi, bh.stato, h.avvisi.some(([k]) => k === "funzioni_assenti")]);
      const k = finte({ P, rompi: "promuovi", codice: "57014" });
      const rk = await vai(k.porte, lotto([msg()]));
      prova("promuovi che fallisce per altro: 200 e codice «database» nel log", [200, true], [rk.stato, k.avvisi.some(([x]) => x === "database")]);
      //  Il controllo tardivo che esce presto (nessuna riga) non salta la promozione.
      const v = finte({ P });
      await vai(v.porte, { v: 1, tipo: "battito", stato: "collegato" });
      prova("battito senza nessuna riga recente: la promozione gira lo stesso", 1, v.chiamate.promuovi.length);
    }
    {
      const f = finte({ P, rompi: "scrivi", codice: "PGRST202" });
      const r = await vai(f.porte, lotto([msg()]));
      prova("errore del database → 500 database, nel log solo il codice funzioni_assenti", [500, "database", true], [r.stato, r.json.errore, f.avvisi.some(([k]) => k === "funzioni_assenti")]);
      const g = finte({ P, rompi: "battito" });
      prova("battito che non si scrive → 500", 500, (await vai(g.porte, { v: 1, tipo: "battito", stato: "collegato" })).stato);
      //  Il controllo tardivo che fallisce non fa ritentare un lotto già scritto.
      const h = finte({ P });
      const orig = h.porte.recentiDelPonte;
      h.porte.recentiDelPonte = async () => { throw { code: "57014" }; };
      const rh = await vai(h.porte, lotto([msg()]));
      prova("controllo tardivo che fallisce dopo un lotto scritto → 200 (e codice nel log)", [200, 1, true], [rh.stato, rh.json.nuovi, h.avvisi.some(([k]) => k === "database")]);
      h.porte.recentiDelPonte = orig;
    }
  } finally {
    for (const k of Object.keys(originali)) console[k] = originali[k];
  }

  gruppo("PONTE WHATSAPP · L'INGRESSO DELLA ROTTA (compito T3)");
  for (const [nome, atteso, letto] of risultati) c(nome, atteso, letto);
  c("nessuna riga di console durante le prove dell'ingresso", [], scritte);
  c(
    "nei log solo codici della lista chiusa e contatori numerici",
    [],
    tuttiAvvisi.filter(([k, n]) => !T.CODICI_AVVISO.includes(k) || (n !== undefined && (typeof n !== "object" || Object.entries(n).some(([ch, v]) => !/^[a-z_]+$/.test(ch) || typeof v !== "number")))),
  );
  c("nei log nessun numero, id, testo o nome", false, /3933|3EB0|Giulia|Fornitore|Ciao|bw:/.test(JSON.stringify(tuttiAvvisi)));
  c("gli avvisi ci sono (lotto, battito, noti, promosse)", [true, true, true, true], ["lotto", "battito", "noti", "promosse"].map((k) => tuttiAvvisi.some(([x]) => x === k)));
}
