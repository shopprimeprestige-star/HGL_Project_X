/** ── NEGOZIO · RILASCIO 2 · T58 · LA CASSA NUOVA, LATO BROWSER (PURO) ───────────────────────────────
 *  `src/shop/cassa/cassa-client.ts` (PIANO-R2 §3.1, T58, D47, D50, D60, D61). Nessun React, nessuna rete: si prova con porte finte.
 *   · il corpo della richiesta ha solo SKU e quantità (mai prezzi di riga) più il totale che il cliente ha visto;
 *   · stesso contenuto = stesso `tentativo`; qualunque dato cambiato = tentativo nuovo (mai riusarlo con dati diversi);
 *   · ogni risposta del server diventa una frase e, se serve, un errore ACCANTO AL CAMPO; `prezzi_cambiati` porta i totali nuovi e NON rinvia;
 *   · l'indirizzo che porta a Stripe è solo `https://checkout.stripe.com/…`;
 *   · il loader: con il catalogo `codice` la cassa non si chiede; un rifiuto o un timeout → cassa vecchia.
 *  Dati inventati: nessun cliente vero. */

const UUID_A = "00000000-0000-4000-8000-00000000000a";
const UUID_B = "00000000-0000-4000-8000-00000000000b";

const modulo = (extra = {}) => ({
  nome: "Prova", cognome: "Finto", email: "prova@esempio.test", telefono: "3331234567",
  indirizzo: "Via Finta 1", citta: "Cittàfinta", cap: "00100", provincia: "RM", note: "",
  vuoleFattura: false, tipo: "privato", denominazione: "", cf: "", piva: "", sdi: "", pec: "",
  termini: true, privacy: true, sito_web: "",
  ...extra,
});
const riga = (sku, qty = 1, prezzoCent = 2890) => ({ productId: sku, qty, key: sku, sku, snap: { nome: "Prodotto di prova", slug: "prodotto-di-prova", prezzoCent, foto: null, varianteNome: null } });

export async function prove(mod, { c, gruppo }) {
  gruppo("SHOP R2 · T58 · LA CASSA NUOVA, LATO BROWSER (PURO) (22/11/2026)");
  const K = mod["shop/cassa/cassa-client"];
  c("il modulo src/shop/cassa/cassa-client.ts esiste", true, !!K);
  if (!K) return;

  // ── il corpo ──
  const base = { modulo: modulo(), righe: [{ sku: "PROVA-001-A", qty: 2 }], totaleAttesoCent: 6270, permesso: "p.token", tentativo: UUID_A, consensoMarketing: false, attribuzione: {}, versione: "2026-11" };
  const b = K.corpoCassa(base);
  c("corpo: righe = solo SKU e quantità", [{ sku: "PROVA-001-A", qty: 2 }], b.righe);
  c("corpo: il totale atteso è quello visto dal cliente, in centesimi", 6270, b.totaleAttesoCent);
  c("corpo: contatti e spedizione come da contratto §3.1 (nazione IT, provincia)", [{ nome: "Prova", cognome: "Finto", email: "prova@esempio.test", telefono: "3331234567" }, { indirizzo: "Via Finta 1", citta: "Cittàfinta", cap: "00100", provincia: "RM", nazione: "IT" }], [b.contatti, b.spedizione]);
  c("corpo: le due caselle di legge e la versione", { termini: true, privacy: true, versione: "2026-11" }, b.consensi);
  c("corpo: la trappola parte vuota", "", b.sito_web);
  c("corpo: senza fattura niente chiave `fattura`", false, "fattura" in b);
  c("corpo: note vuote non partono", false, "note" in b);
  const testoCorpo = JSON.stringify(b);
  c("corpo: nessun prezzo di riga (né `prezzo`, né `unit_price`, né `prezzoCent`)", false, /prezzo|price|unit_/i.test(testoCorpo));
  c("corpo: il permesso e il tentativo ci sono", ["p.token", UUID_A], [b.permesso, b.tentativo]);
  c("corpo: note scritte partono", "citofono rotto", K.corpoCassa({ ...base, modulo: modulo({ note: "citofono rotto" }) }).note);
  c("corpo: il consenso di marketing parte com'è (vero solo se vero)", [false, true], [b.consensoMarketing, K.corpoCassa({ ...base, consensoMarketing: true }).consensoMarketing]);
  c("corpo: l'attribuzione passa", { utm_source: "prova" }, K.corpoCassa({ ...base, attribuzione: { utm_source: "prova" } }).attribuzione);
  // fattura
  const fp = K.corpoCassa({ ...base, modulo: modulo({ vuoleFattura: true, tipo: "privato", denominazione: "Prova Finto", cf: "RSSMRA80A01H501U", piva: "12345678903", sdi: "ABCDEFG" }) }).fattura;
  c("fattura privato: tipo, denominazione e codice fiscale; P.IVA e SDI non partono", { tipo: "privato", denominazione: "Prova Finto", cf: "RSSMRA80A01H501U" }, fp);
  const fa = K.corpoCassa({ ...base, modulo: modulo({ vuoleFattura: true, tipo: "azienda", denominazione: "Ditta Finta Srl", piva: "12345678903", sdi: "ABCDEFG", pec: "", cf: "RSSMRA80A01H501U" }) }).fattura;
  c("fattura azienda: ragione sociale, P.IVA, SDI (la PEC vuota non parte, il CF di un privato non parte)", { tipo: "azienda", denominazione: "Ditta Finta Srl", piva: "12345678903", sdi: "ABCDEFG" }, fa);
  c("fattura: i campi si ripuliscono dagli spazi ai bordi", "Ditta Finta Srl", K.corpoCassa({ ...base, modulo: modulo({ vuoleFattura: true, tipo: "azienda", denominazione: "  Ditta Finta Srl  ", piva: "1" }) }).fattura.denominazione);

  // ── righe dal carrello ──
  c("righe dal carrello: solo quelle con SKU, SKU e quantità", [{ sku: "A", qty: 2 }, { sku: "B", qty: 1 }], K.righeDaCarrello([riga("A", 2), { productId: "t01", qty: 1, key: "t01" }, riga("B", 1)]));

  // ── tentativo ──
  const f1 = K.firmaCassa(b);
  c("firma: il permesso e il tentativo non contano (si rinnovano senza cambiare il contenuto)", f1, K.firmaCassa({ ...b, permesso: "altro.token", tentativo: UUID_B }));
  c("firma: un campo cambiato la cambia", true, K.firmaCassa(K.corpoCassa({ ...base, modulo: modulo({ cap: "00101" }) })) !== f1);
  c("firma: una quantità cambiata la cambia", true, K.firmaCassa(K.corpoCassa({ ...base, righe: [{ sku: "PROVA-001-A", qty: 3 }] })) !== f1);
  c("firma: un totale atteso diverso la cambia", true, K.firmaCassa(K.corpoCassa({ ...base, totaleAttesoCent: 6271 })) !== f1);
  c("firma: una casella di legge tolta la cambia", true, K.firmaCassa(K.corpoCassa({ ...base, modulo: modulo({ termini: false }) })) !== f1);
  let n = 0;
  const uuid = () => (n++ === 0 ? UUID_A : UUID_B);
  const t1 = K.tentativoCassa(null, f1, uuid);
  c("tentativo: il primo nasce con un id e la firma", [UUID_A, f1], [t1.id, t1.firma]);
  c("tentativo: stesso contenuto → LO STESSO tentativo (nessun uuid nuovo)", [UUID_A, 1], [K.tentativoCassa(t1, f1, uuid).id, n]);
  const t2 = K.tentativoCassa(t1, K.firmaCassa(K.corpoCassa({ ...base, totaleAttesoCent: 7000 })), uuid);
  c("tentativo: contenuto diverso → tentativo NUOVO", UUID_B, t2.id);

  // ── l'attesa del permesso (il server rifiuta se ha meno di 3 s o più di 30 minuti) ──
  const S = 1000, MIN = 60 * S, T = 1_700_000_000_000;
  c("permesso: appena preso → si aspetta fino ai 3 s (più un margine)", true, K.attesaPermesso(T, T + 500) > 2500 && K.attesaPermesso(T, T + 500) <= 4000);
  c("permesso: dopo 4 s → nessuna attesa", 0, K.attesaPermesso(T, T + 4 * S));
  c("permesso: dopo 20 minuti → nessuna attesa", 0, K.attesaPermesso(T, T + 20 * MIN));
  c("permesso: dopo 29 minuti → da rinnovare", "rinnova", K.attesaPermesso(T, T + 29 * MIN));
  c("permesso: mai preso → da rinnovare", "rinnova", K.attesaPermesso(null, T));

  // ── le risposte del server ──
  const R = K.leggiRisposta;
  c("risposta ok con l'indirizzo di Stripe → si va", { tipo: "vai", url: "https://checkout.stripe.com/c/pay/cs_test_x" }, R(200, { ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_x" }));
  c("risposta ok con un indirizzo che non è di Stripe → errore, mai un rinvio", "errore", R(200, { ok: true, url: "https://sito-falso.test/checkout.stripe.com/" }).tipo);
  c("risposta ok con `http://` → errore", "errore", R(200, { ok: true, url: "http://checkout.stripe.com/c/pay/x" }).tipo);
  c("risposta ok senza indirizzo (la trappola risponde così) → errore", "errore", R(200, { ok: true }).tipo);
  c("risposta ok con un indirizzo che finge: checkout.stripe.com.altro.test → errore", "errore", R(200, { ok: true, url: "https://checkout.stripe.com.altro.test/x" }).tipo);
  const v = R(400, { ok: false, motivo: "valore", frase: "Controlla i campi segnati e riprova.", campi: { cf: "Il codice fiscale non sembra giusto.", cap: "Il CAP ha cinque cifre." } });
  c("valore → i campi con la loro frase", ["campi", { cf: "Il codice fiscale non sembra giusto.", cap: "Il CAP ha cinque cifre." }], [v.tipo, v.campi]);
  c("valore: l'errore di `cf` si associa al campo `cf`", "Il codice fiscale non sembra giusto.", K.separaCampi(v.campi).perCampo.cf);
  const sep = K.separaCampi({ nome: "Scrivi il tuo nome.", versione: "Ricarica la pagina e riprova.", righe: "Il carrello non è valido.", fattura: "I dati per la fattura non sono validi." });
  c("separaCampi: i campi del modulo restano accanto al campo, gli altri vanno in cima", [{ nome: "Scrivi il tuo nome." }, ["Ricarica la pagina e riprova.", "Il carrello non è valido.", "I dati per la fattura non sono validi."]], [sep.perCampo, sep.generali]);
  c("separaCampi: nessun campo scelto dal server può rompere l'oggetto (`__proto__`)", [], Object.keys(K.separaCampi(JSON.parse('{"__proto__":"x"}')).perCampo));
  const pc = R(409, { ok: false, motivo: "prezzi_cambiati", frase: "I prezzi sono cambiati.", totaleCent: 6500, spedizioneCent: 490 });
  c("prezzi_cambiati → i totali nuovi (e il rinvio NON parte da solo)", ["prezzi", 6500, 490, false], [pc.tipo, pc.totaleCent, pc.spedizioneCent, "url" in pc]);
  c("prezzi_cambiati con totali storti → errore, mai un totale inventato", "errore", R(409, { ok: false, motivo: "prezzi_cambiati", frase: "x", totaleCent: "6500", spedizioneCent: -1 }).tipo);
  const nd = R(409, { ok: false, motivo: "non_disponibile", frase: "Non disponibile.", righe: [{ sku: "PROVA-001-A", frase: "Questo prodotto non è disponibile." }, { sku: 5 }] });
  c("non_disponibile → le righe con la frase (quelle storte si scartano)", ["righe", [{ sku: "PROVA-001-A", frase: "Questo prodotto non è disponibile." }]], [nd.tipo, nd.righe]);
  c("cassa_chiusa → «Il negozio sta per aprire» (la frase è nostra, non del server)", ["chiusa", "Il negozio sta per aprire: riprova tra poco."], (() => { const x = R(503, { ok: false, motivo: "cassa_chiusa", frase: "qualunque cosa" }); return [x.tipo, x.frase]; })());
  c("permesso → da rinnovare", "permesso", R(403, { ok: false, motivo: "permesso", frase: "Ricarica la pagina e riprova." }).tipo);
  const td = R(409, { ok: false, motivo: "tentativo_diverso", frase: "Già usata." });
  c("tentativo_diverso → errore e tentativo da buttare", ["errore", true], [td.tipo, td.nuovoTentativo]);
  c("non_riproponibile → errore e tentativo da buttare", true, R(409, { ok: false, motivo: "non_riproponibile", frase: "x" }).nuovoTentativo);
  const tr = R(429, { ok: false, motivo: "troppe_richieste", frase: "Troppi tentativi in poco tempo: riprova più tardi." });
  c("troppe_richieste → errore, il tentativo si tiene", ["errore", false, "Troppi tentativi in poco tempo: riprova più tardi."], [tr.tipo, tr.nuovoTentativo, tr.frase]);
  c("guasto (500) → errore, il tentativo si tiene (un clic in più riusa la stessa sessione)", ["errore", false], (() => { const x = R(500, { ok: false, motivo: "guasto", frase: "Non siamo riusciti ad aprire il pagamento: riprova tra poco." }); return [x.tipo, x.nuovoTentativo]; })());
  c("risposta che non è JSON / non è un oggetto → errore con una frase nostra", ["errore", true], (() => { const x = R(502, null); return [x.tipo, typeof x.frase === "string" && x.frase.length > 10]; })());
  c("una frase del server lunga più di 300 segni non si mostra: ne vale una nostra", true, R(500, { ok: false, motivo: "guasto", frase: "x".repeat(400) }).frase.length < 200);

  // ── i totali ──
  c("totali: subtotale + spedizione del server", { spedizioneCent: 490, totaleCent: 6270 }, K.calcolaTotali(5780, { stato: "ok", costoCent: 490, confermata: false, corriere: null, tempi: null, frase: null }));
  c("totali: spedizione assente → nessun totale inventato", null, K.calcolaTotali(5780, { stato: "assente" }));
  c("totali: tariffa non ancora letta → nessun totale", null, K.calcolaTotali(5780, null));
  c("totali: costo storto (negativo, frazione) → nessun totale", [null, null], [K.calcolaTotali(5780, { stato: "ok", costoCent: -1 }), K.calcolaTotali(5780, { stato: "ok", costoCent: 4.9 })]);
  c("totali: spedizione gratuita (0) è un costo valido", { spedizioneCent: 0, totaleCent: 5780 }, K.calcolaTotali(5780, { stato: "ok", costoCent: 0 }));

  // ── il loader ──
  const finto = (esito) => { const x = { chiamate: 0, leggi: () => { x.chiamate++; return esito(); } }; return x; };
  const mai = () => new Promise(() => {});
  const scatta = () => Promise.resolve("tempo");
  const f0 = finto(async () => "stripe");
  c("loader: con il catalogo `codice` la cassa NON si chiede, ed è la vecchia", ["vecchia", 0], [await K.cassaPerLoader("codice", f0.leggi), f0.chiamate]);
  c("loader: cms + il server dice stripe → stripe", "stripe", await K.cassaPerLoader("cms", finto(async () => "stripe").leggi));
  c("loader: cms + il server dice vecchia → vecchia", "vecchia", await K.cassaPerLoader("cms", finto(async () => "vecchia").leggi));
  c("loader: cms + il server RIFIUTA → cassa vecchia", "vecchia", await K.cassaPerLoader("cms", finto(async () => { throw new Error("giù"); }).leggi));
  c("loader: cms + la lettura lancia subito → cassa vecchia", "vecchia", await K.cassaPerLoader("cms", () => { throw new Error("x"); }));
  c("loader: cms + il server NON risponde (timeout) → cassa vecchia", "vecchia", await K.cassaPerLoader("cms", finto(mai).leggi, scatta));
  c("loader: il tetto è di pochi secondi", true, K.TETTO_CASSA_MS >= 1000 && K.TETTO_CASSA_MS <= 5000);
  c("loader: una risposta strana (non «stripe» esatto) → cassa vecchia", ["vecchia", "vecchia", "vecchia"], [await K.cassaPerLoader("cms", async () => "Stripe"), await K.cassaPerLoader("cms", async () => ({})), await K.cassaPerLoader("cms", async () => null)]);
  c("loader: il tetto passa ad `attendi` in millisecondi", K.TETTO_CASSA_MS, await (async () => { let visto = 0; await K.cassaPerLoader("cms", mai, (ms) => ((visto = ms), Promise.resolve("tempo"))); return visto; })());

  // ── `?annullato=1`: si legge, si mostra il messaggio e si toglie dall'indirizzo (ammesse.ts non si tocca) ──
  c("senzaAnnullato esiste", "function", typeof K.senzaAnnullato);
  if (typeof K.senzaAnnullato === "function") {
    c("senzaAnnullato: toglie solo `annullato`", "/shop/checkout", K.senzaAnnullato("/shop/checkout", "?annullato=1", ""));
    c("senzaAnnullato: le altre chiavi (utm, click id) restano, nello stesso ordine", "/shop/checkout?utm_source=prova&fbclid=1", K.senzaAnnullato("/shop/checkout", "?utm_source=prova&annullato=1&fbclid=1", ""));
    c("senzaAnnullato: senza `annullato` l'indirizzo non cambia (nemmeno il `#…`)", "/shop/checkout?utm_source=prova#in-fondo", K.senzaAnnullato("/shop/checkout", "?utm_source=prova", "#in-fondo"));
    c("senzaAnnullato: ricerca vuota → solo il percorso", "/shop/checkout", K.senzaAnnullato("/shop/checkout", "", ""));
    c("senzaAnnullato: `annullato` con qualunque valore si toglie", "/shop/checkout", K.senzaAnnullato("/shop/checkout", "?annullato=si", ""));
  }
}
