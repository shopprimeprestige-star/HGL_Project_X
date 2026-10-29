/** ── PROVE: L'ABBINAMENTO CON MANYCHAT E CLOUD (pari.ts) ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T3.
 *  I casi del PIANO §c1 (i 12 elencati più i limiti: `failed`, `canale`,
 *  `duplicato_di`, finestra opaca, uno a uno, il più vicino).
 *  I contratti stanno in `src/crm/ponte/tipi.ts` (`mod["ponte/tipi"]`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  Le regole 1-4 (lato CRM) le applica l'SQL di `ponte_wa_candidati` (T1);
 *  qui le applica `ammessoCome`, la stessa regola scritta in TypeScript, così
 *  ogni caso passa da riga CRM → candidato → `abbinaPari` come in produzione.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */

const BASE = 1761730000; // secondi
const iso = (s) => new Date(s * 1000).toISOString();
const NUM = "393331234567";
const META = "10412345678901"; // phone_number_id inventato

export async function provePontePari(mod, { c, gruppo }) {
  const P = mod["ponte/pari"];
  const T = mod["ponte/tipi"];
  if (!P) return; // il modulo entra nel pacchetto quando esiste

  gruppo("PONTE WHATSAPP · L'ABBINAMENTO (compito T3)");

  // ── normalizzaTesto ──
  c("normalizza: minuscole, spazi e a capo ridotti, bordi tolti", "ciao mondo ok", P.normalizzaTesto("  Ciao  MONDO\n\n ok "));
  c("normalizza: tolti gli invisibili (200B-200D, FEFF, 2060)", "ciao", P.normalizzaTesto("c\u200Bi\u200Ca\u200D\uFEFFo\u2060"));
  c("normalizza: NFKC (legature, larghezza piena)", "fine a", P.normalizzaTesto("ﬁne Ａ"));
  c("normalizza: null e non stringhe → vuoto", ["", ""], [P.normalizzaTesto(null), P.normalizzaTesto(undefined)]);

  // ── eOpaco ──
  const LINK = "https://manybot-files.s3.eu-central-1.amazonaws.com/123/wa/2026/10/29/abc.jpg";
  c(
    "opaco: modello, senza testo, link ManyChat, segnaposto; testo no",
    ["modello", "media", "media", "media", null, null, null],
    [
      P.eOpaco("[template:promemoria_1]"),
      P.eOpaco("[messaggio senza testo]"),
      P.eOpaco(LINK),
      P.eOpaco("{{last_input}} {{x}}"),
      P.eOpaco("ciao"),
      P.eOpaco(null),
      P.eOpaco("https://esempio.it/a.jpg"),
    ],
  );

  // ── l'abbinamento, dalla riga CRM al pari ──
  /** Una riga di `whatsapp_messages` (ManyChat di serie). */
  const crm = (o) => {
    const dir = o.dir ?? "inbound";
    const altro = o.altro ?? "manychat";
    const cliente = o.cliente ?? `+${NUM}`;
    return {
      id: o.id,
      direction: dir,
      from_number: dir === "inbound" ? cliente : altro,
      to_number: dir === "inbound" ? altro : cliente,
      body: o.body ?? null,
      canale: o.canale === undefined ? "manychat" : o.canale,
      status: o.status ?? (dir === "inbound" ? "delivered" : "sent"),
      duplicato_di: o.duplicato_di ?? null,
      created_at: iso(o.t),
    };
  };
  /** Una riga del ponte (`RigaDaAbbinare`). */
  const riga = (o) => ({ k: T.chiaveMessaggio(o.n ?? NUM, o.id), n: o.n ?? NUM, d: o.d ?? "in", t: o.t, x: o.x, m: o.m ?? null });
  /** Il giro vero: candidati per richiesta (regole 1-4), poi `abbinaPari`. */
  const abbina = (righe, tabella) => {
    const candidati = [];
    for (const r of righe) {
      const richiesta = { k: r.k, n: r.n, d: r.d, t: r.t };
      for (const x of tabella) {
        if (P.ammessoCome(x, richiesta))
          candidati.push({ k: r.k, id: x.id, created_at: x.created_at, direction: x.direction, body: x.body == null ? null : x.body.slice(0, T.BODY_CANDIDATI), canale: x.canale });
      }
    }
    return P.abbinaPari(righe, candidati).map((p) => `${p.k.split(":")[2]}=${p.crm}`).sort();
  };

  c("1. stesso testo in 5 s → pari", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "Ciao, a che ora?" })], [crm({ id: "c1", t: BASE + 5, body: "Ciao, a che ora?" })]));
  c("2. stesso testo a 4 minuti → nuovo", [], abbina([riga({ id: "a", t: BASE, x: "Ciao" })], [crm({ id: "c1", t: BASE + 240, body: "Ciao" })]));
  c("3. due «Ok», uno solo nel CRM → uno pari (il più vicino), uno nuovo", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "Ok" }), riga({ id: "b", t: BASE + 30, x: "Ok" })], [crm({ id: "c1", t: BASE + 3, body: "Ok" })]));
  c("3b. l'ordine dei messaggi in ingresso non cambia l'esito", ["a=c1"], abbina([riga({ id: "b", t: BASE + 30, x: "Ok" }), riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 3, body: "Ok" })]));
  c(
    "4. modello [template:x] e modello uscito a +40 s → pari",
    ["a=c1"],
    abbina([riga({ id: "a", d: "out", t: BASE + 40, x: "📋 Ti ricordo l'appuntamento" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]),
  );
  c("5. modello e modello uscito a +3 minuti → nuovo", [], abbina([riga({ id: "a", d: "out", t: BASE + 180, x: "📋 Ti ricordo" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]));
  //  Guasto 2: un [template:…] non nasconde più un messaggio vero scritto a mano.
  //  Casi reali di produzione: il giro esce dal ponte come testo semplice già compilato, 1-2 s dopo.
  c("4m. caso reale: [template:consulenza_conferma] e testo semplice a +1 s → pari", ["a=c1"], abbina([riga({ id: "a", d: "out", t: BASE + 1, x: "Gentile Goran, la Sua consulenza è confermata" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:consulenza_conferma_1]" })]));
  c("4n. caso reale: [template:hgl_ricontatto] e testo semplice a +2 s → pari", ["a=c1"], abbina([riga({ id: "a", d: "out", t: BASE + 2, x: "Buongiorno, la ricontattiamo per la consulenza" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:hgl_ricontatto]" })]));
  c("4o. [template:x] e testo semplice: a 15 s pari, a 16 s nuovo", [["a=c1"], []], [
    abbina([riga({ id: "a", d: "out", t: BASE + 15, x: "Ciao" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:x]" })]),
    abbina([riga({ id: "a", d: "out", t: BASE + 16, x: "Ciao" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:x]" })]),
  ]);
  c("4p. [template:x] e un testo scritto a mano a +60 s → nuovo (resta visibile)", [], abbina([riga({ id: "a", d: "out", t: BASE + 60, x: "Ci vediamo domani allora" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]));
  c("4b. modello [template:x] e un testo scritto a mano a +40 s → nuovo (resta visibile)", [], abbina([riga({ id: "a", d: "out", t: BASE + 40, x: "Ti ricordo l'appuntamento" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]));
  c("4c. modello [template:x] e una foto mandata a mano → nuovo", [], abbina([riga({ id: "a", d: "out", t: BASE + 10, x: "📷 Foto", m: "foto" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]));
  c(
    "4d. modello e testo a mano vicini: il modello prende il [template:x], il testo resta",
    ["b=c1"],
    abbina([riga({ id: "a", d: "out", t: BASE + 20, x: "Arrivo tra poco" }), riga({ id: "b", d: "out", t: BASE + 30, x: "📋 Ti ricordo" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]),
  );
  c("4e. modello senza testo visibile e [template:x] → pari", ["a=c1"], abbina([riga({ id: "a", d: "out", t: BASE + 20, x: P.MODELLO_NASCOSTO, m: "altro" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]));
  c("4f. modello senza testo visibile e un testo uscito dal CRM → pari (non ha niente da mostrare)", ["a=c1"], abbina([riga({ id: "a", d: "out", t: BASE + 20, x: P.MODELLO_NASCOSTO, m: "altro" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "A domani!" })]));
  c("4g. modello senza testo visibile oltre 120 s → nuovo", [], abbina([riga({ id: "a", d: "out", t: BASE + 121, x: P.MODELLO_NASCOSTO, m: "altro" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "A domani!" })]));
  c("4h. un modello con testo e lo stesso testo nel CRM → pari (la marca non conta)", ["a=c1"], abbina([riga({ id: "a", d: "out", t: BASE + 3, x: "📋 Scegli un orario" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "Scegli un orario" })]));
  c("4j. invio nascosto (fanout ManyChat) e [template:x] → pari", ["a=c1"], abbina([riga({ id: "a", d: "out", t: BASE + 30, x: P.INVIO_NASCOSTO, m: "altro" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "[template:promemoria]" })]));
  c("4k. invio nascosto e un testo uscito dal CRM → pari", ["a=c1"], abbina([riga({ id: "a", d: "out", t: BASE + 2, x: P.INVIO_NASCOSTO, m: "altro" })], [crm({ id: "c1", dir: "outbound", t: BASE, body: "Ciao, a domani" })]));
  c("4l. invio nascosto senza nulla nel CRM → nuovo (resta visibile)", [], abbina([riga({ id: "a", d: "out", t: BASE, x: P.INVIO_NASCOSTO, m: "altro" })], [crm({ id: "c1", t: BASE, body: "ciao" })]));
  c("4i. un testo che il cliente comincia con 📋 non è un modello in entrata", [], abbina([riga({ id: "a", t: BASE + 3, x: "📋 lista" })], [crm({ id: "c1", t: BASE, body: "[template:x]" })]));
  c("6. media di ManyChat e «📷 Foto» → pari", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "📷 Foto", m: "foto" })], [crm({ id: "c1", t: BASE + 4, body: LINK })]));
  c("7. media di ManyChat e un testo → nuovo", [], abbina([riga({ id: "a", t: BASE, x: "ecco la foto" })], [crm({ id: "c1", t: BASE + 4, body: LINK })]));
  c("8. numero del CRM senza «+» (righe vecchie) → pari", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "Grazie" })], [crm({ id: "c1", t: BASE + 2, body: "Grazie", cliente: NUM })]));
  c(
    "9. phone_number_id dal lato non cliente → mai usato (entrata e uscita Cloud)",
    [],
    abbina(
      [riga({ id: "a", n: META, t: BASE, x: "Grazie" }), riga({ id: "b", n: META, d: "out", t: BASE, x: "Prego" })],
      [crm({ id: "c1", t: BASE + 2, body: "Grazie", altro: META, canale: null }), crm({ id: "c2", dir: "outbound", t: BASE + 2, body: "Prego", altro: META, canale: null })],
    ),
  );
  c("10. direzioni opposte → nuovo", [], abbina([riga({ id: "a", d: "out", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 2, body: "Ok" })]));
  const lungo = "parola ".repeat(500).trim(); // 3499 caratteri
  c("11. testo lungo troncato a 2000 da ManyChat → pari", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: lungo })], [crm({ id: "c1", t: BASE + 6, body: lungo.slice(0, 2000) })]));
  c("12. maiuscole e spazi diversi → pari", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "Va  BENE\nalle 15" })], [crm({ id: "c1", t: BASE + 3, body: " va bene alle 15 " })]));

  // ── i limiti delle regole ──
  c("un candidato failed non è mai pari", [], abbina([riga({ id: "a", d: "out", t: BASE, x: "Ok" })], [crm({ id: "c1", dir: "outbound", t: BASE + 2, body: "Ok", status: "failed" })]));
  c("una riga del ponte (canale baileys) non è mai candidata", [], abbina([riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 2, body: "Ok", canale: "baileys" })]));
  c("una riga con duplicato_di non è mai candidata", [], abbina([riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 2, body: "Ok", duplicato_di: "x" })]));
  c("Cloud (canale vuoto) vale come ManyChat", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 2, body: "Ok", canale: null, altro: META })]));
  c("numero diverso → mai (nessun confronto sulle ultime 9 cifre)", [], abbina([riga({ id: "a", n: "413331234567", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 2, body: "Ok" })]));
  c("testo uguale a 180 s → pari, a 181 s → nuovo", [["a=c1"], []], [
    abbina([riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE - 180, body: "Ok" })]),
    abbina([riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 181, body: "Ok" })]),
  ]);
  c("opaco a 120 s → pari, a 150 s → nuovo (finestra opaca)", [["a=c1"], []], [
    abbina([riga({ id: "a", t: BASE, x: "🎤 Vocale", m: "vocale" })], [crm({ id: "c1", t: BASE + 120, body: "[messaggio senza testo]" })]),
    abbina([riga({ id: "a", t: BASE, x: "🎤 Vocale", m: "vocale" })], [crm({ id: "c1", t: BASE + 150, body: "[messaggio senza testo]" })]),
  ]);
  c("segnaposto {{…}} e un vocale → pari", ["a=c1"], abbina([riga({ id: "a", t: BASE, x: "🎤 Vocale", m: "vocale" })], [crm({ id: "c1", t: BASE + 9, body: "{{last_input_text}}" })]));
  c("modello in entrata non fa da pari a un'entrata", [], abbina([riga({ id: "a", t: BASE, x: "ciao" })], [crm({ id: "c1", t: BASE + 2, body: "[template:x]" })]));
  c("un'uscita fatta di media non fa da pari a un'uscita (solo il modello è opaco in uscita)", [], abbina([riga({ id: "a", d: "out", t: BASE, x: "📷 Foto", m: "foto" })], [crm({ id: "c1", dir: "outbound", t: BASE + 2, body: LINK })]));
  c("il più vicino fra due candidati", ["a=c2"], abbina([riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 50, body: "Ok" }), crm({ id: "c2", t: BASE - 10, body: "Ok" })]));
  c("a parità di distanza, il più vecchio", ["a=c2"], abbina([riga({ id: "a", t: BASE, x: "Ok" })], [crm({ id: "c1", t: BASE + 10, body: "Ok" }), crm({ id: "c2", t: BASE - 10, body: "Ok" })]));
  c(
    "due «Ok» e due «Ok» nel CRM → due pari distinti",
    ["a=c1", "b=c2"],
    abbina([riga({ id: "a", t: BASE, x: "Ok" }), riga({ id: "b", t: BASE + 30, x: "Ok" })], [crm({ id: "c1", t: BASE + 2, body: "Ok" }), crm({ id: "c2", t: BASE + 33, body: "Ok" })]),
  );
  c("un candidato restituito per un'altra chiave non vale", [], P.abbinaPari([riga({ id: "a", t: BASE, x: "Ok" })], [{ k: "bw:1:altro", id: "c1", created_at: iso(BASE), direction: "inbound", body: "Ok", canale: "manychat" }]));
  c("nessuna riga o nessun candidato → nessun pari", [[], []], [P.abbinaPari([], []), P.abbinaPari([riga({ id: "a", t: BASE, x: "Ok" })], [])]);
}
