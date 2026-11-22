/** ── NEGOZIO · RILASCIO 2 · T58 · GLI EVENTI DELLA CASSA NUOVA (D60) ──────────────────────────────────
 *  `src/shop/cassa/cassa-client.ts` (`eventoSpedizione`, `eventoPagamento`, `rinviaAStripe`), con un `emettiEvento` FINTO e un orologio FINTO:
 *   · `AddShippingInfo`: UNA volta per carrello e sessione, quando l'indirizzo è completo e valido, non prima;
 *   · `AddPaymentInfo`: alla pressione di «Paga ora», `content_ids` = gli SKU e valore in centesimi;
 *   · il rinvio a Stripe ASPETTA `scarica()` ma non oltre 800 ms (la navigazione non deve uccidere l'invio al server);
 *   · senza consenso (l'emissione risponde `null`) nessun evento e il pagamento PARTE LO STESSO.
 *  Dati inventati. */

const riga = (sku, qty = 1, prezzoCent = 2890) => ({ productId: sku, qty, key: sku, sku, snap: { nome: "Prodotto di prova", slug: "prodotto-di-prova", prezzoCent, foto: null, varianteNome: null } });
const modulo = (extra = {}) => ({ nome: "Prova", cognome: "Finto", email: "prova@esempio.test", telefono: "3331234567", indirizzo: "Via Finta 1", citta: "Cittàfinta", cap: "00100", provincia: "RM", note: "", vuoleFattura: false, tipo: "privato", denominazione: "", cf: "", piva: "", sdi: "", pec: "", termini: false, privacy: false, sito_web: "", ...extra });
const archivio = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), m }; };

export async function prove(mod, { c, gruppo }) {
  gruppo("SHOP R2 · T58 · GLI EVENTI DELLA CASSA NUOVA (22/11/2026)");
  const K = mod["shop/cassa/cassa-client"];
  c("il modulo src/shop/cassa/cassa-client.ts esiste", true, !!K);
  if (!K) return;

  // ── AddShippingInfo ──
  const righe = [riga("PROVA-001-A", 2), riga("PROVA-004-A", 1, 3500)];
  const nuovo = () => { const x = { emessi: [], ritorno: "id", emetti: (n, d) => (x.emessi.push([n, d]), x.ritorno) }; return x; };
  c("indirizzo completo: indirizzo, città, CAP e provincia giusti", true, K.indirizzoCompleto(modulo()));
  c("indirizzo incompleto: manca ciascuno dei quattro → no", [false, false, false, false], [K.indirizzoCompleto(modulo({ indirizzo: "" })), K.indirizzoCompleto(modulo({ citta: " " })), K.indirizzoCompleto(modulo({ cap: "" })), K.indirizzoCompleto(modulo({ provincia: "" }))]);
  c("indirizzo con CAP di 4 cifre o provincia inventata → non valido, niente evento", [false, false], [K.indirizzoCompleto(modulo({ cap: "0010" })), K.indirizzoCompleto(modulo({ provincia: "XX" }))]);

  const a = nuovo(), arc = archivio();
  c("AddShippingInfo: con l'indirizzo ancora incompleto NON si emette (e niente si scrive in sessione)", [false, 0, 0], [K.eventoSpedizione({ emetti: a.emetti, archivio: arc }, modulo({ cap: "00" }), righe), a.emessi.length, arc.m.size]);
  c("AddShippingInfo: con l'indirizzo completo si emette", true, K.eventoSpedizione({ emetti: a.emetti, archivio: arc }, modulo(), righe));
  c("AddShippingInfo: nome, SKU di tutte le righe, valore in centesimi, pezzi", ["AddShippingInfo", { contentIds: ["PROVA-001-A", "PROVA-004-A"], contentType: "product", valueCent: 9280, numItems: 3 }], a.emessi[0]);
  c("AddShippingInfo: la seconda volta (stesso carrello, stessa sessione) NON si rimanda", [false, 1], [K.eventoSpedizione({ emetti: a.emetti, archivio: arc }, modulo({ citta: "Altra" }), righe), a.emessi.length]);
  c("AddShippingInfo: un carrello diverso è un'altra volta", [true, 2], [K.eventoSpedizione({ emetti: a.emetti, archivio: arc }, modulo(), [riga("PROVA-001-A", 3)]), a.emessi.length]);
  c("AddShippingInfo: senza archivio di sessione conta come prima volta (meglio uno in più che nessuno)", true, K.eventoSpedizione({ emetti: nuovo().emetti, archivio: null }, modulo(), righe));
  c("AddShippingInfo: carrello senza righe valide → niente", false, K.eventoSpedizione({ emetti: nuovo().emetti, archivio: archivio() }, modulo(), []));
  const senza = nuovo(); senza.ritorno = null;
  c("AddShippingInfo: senza consenso (l'emissione risponde null) non è un evento emesso e non si rompe niente", false, (() => { try { return K.eventoSpedizione({ emetti: senza.emetti, archivio: archivio() }, modulo(), righe); } catch { return "lanciato"; } })());
  c("AddShippingInfo: se emettere LANCIA, la funzione non lancia (il pagamento non dipende dal tracciamento)", false, (() => { try { return K.eventoSpedizione({ emetti: () => { throw new Error("x"); }, archivio: archivio() }, modulo(), righe); } catch { return "lanciato"; } })());

  // ── AddPaymentInfo ──
  const p = nuovo();
  K.eventoPagamento({ emetti: p.emetti }, righe);
  c("AddPaymentInfo: alla pressione, con gli SKU e il valore in centesimi", [["AddPaymentInfo", { contentIds: ["PROVA-001-A", "PROVA-004-A"], contentType: "product", valueCent: 9280, numItems: 3 }]], p.emessi);
  K.eventoPagamento({ emetti: p.emetti }, righe);
  c("AddPaymentInfo: a ogni pressione (non è una «prima volta»: ogni tentativo di pagare lo è)", 2, p.emessi.length);
  c("AddPaymentInfo: se emettere lancia, non lancia", "ok", (() => { try { K.eventoPagamento({ emetti: () => { throw new Error("x"); } }, righe); return "ok"; } catch { return "lanciato"; } })());
  c("AddPaymentInfo: non porta né prezzi di riga né dati del cliente", true, !/nome|email|telefono|indirizzo|prezzo/i.test(JSON.stringify(p.emessi[0][1])));

  // ── il rinvio aspetta scarica(), con un tetto di 800 ms ──
  c("il tetto è di 800 ms", 800, K.TETTO_SCARICA_MS);
  const orologio = () => {
    const x = { attese: [], attendi: (ms) => new Promise((r) => x.attese.push({ ms, r })) };
    return x;
  };
  const respira = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

  // scarica che non finisce mai: si va a Stripe solo quando scatta il tetto
  {
    const o = orologio(); const vai = []; let rispondi;
    const fatto = K.rinviaAStripe("https://checkout.stripe.com/c/pay/x", { scarica: () => new Promise((r) => (rispondi = r)), attendi: o.attendi, naviga: (u) => vai.push(u) });
    await respira();
    c("rinvio: finché `scarica()` non finisce e il tetto non scatta, NON si naviga", [0, [800]], [vai.length, o.attese.map((x) => x.ms)]);
    o.attese[0].r();
    await fatto;
    c("rinvio: scatta il tetto di 800 ms → si naviga all'indirizzo di Stripe", ["https://checkout.stripe.com/c/pay/x"], vai);
  }
  // scarica che finisce prima del tetto
  {
    const o = orologio(); const vai = []; let rispondi;
    const fatto = K.rinviaAStripe("https://checkout.stripe.com/c/pay/y", { scarica: () => new Promise((r) => (rispondi = r)), attendi: o.attendi, naviga: (u) => vai.push(u) });
    await respira();
    rispondi();
    await fatto;
    c("rinvio: `scarica()` finisce prima del tetto → si naviga subito, senza aspettare l'orologio", [1, 1], [vai.length, o.attese.length]);
  }
  // scarica che fallisce
  {
    const o = orologio(); const vai = [];
    await K.rinviaAStripe("https://checkout.stripe.com/c/pay/z", { scarica: () => Promise.reject(new Error("x")), attendi: o.attendi, naviga: (u) => vai.push(u) });
    c("rinvio: `scarica()` che FALLISCE non ferma il pagamento", 1, vai.length);
  }
  // scarica che lancia subito
  {
    const o = orologio(); const vai = [];
    await K.rinviaAStripe("https://checkout.stripe.com/c/pay/z", { scarica: () => { throw new Error("x"); }, attendi: o.attendi, naviga: (u) => vai.push(u) });
    c("rinvio: `scarica()` che LANCIA subito non ferma il pagamento", 1, vai.length);
  }
  // scarica assente (nessun invio in volo, o API senza `scarica`)
  {
    const o = orologio(); const vai = [];
    await K.rinviaAStripe("https://checkout.stripe.com/c/pay/w", { attendi: o.attendi, naviga: (u) => vai.push(u) });
    c("rinvio: senza `scarica` si naviga subito", [1, 0], [vai.length, o.attese.length]);
  }
  // senza consenso: emettere dà null, scarica finisce subito, il pagamento parte lo stesso
  {
    const o = orologio(); const vai = []; const x = nuovo(); x.ritorno = null;
    K.eventoPagamento({ emetti: x.emetti }, righe);
    await K.rinviaAStripe("https://checkout.stripe.com/c/pay/v", { scarica: async () => {}, attendi: o.attendi, naviga: (u) => vai.push(u) });
    c("senza consenso (emissione null): il pagamento parte lo stesso", [1, 1], [vai.length, x.emessi.length]);
  }
  // l'indirizzo che non è di Stripe non si segue nemmeno qui
  {
    const vai = [];
    await K.rinviaAStripe("https://sito-falso.test/", { attendi: () => Promise.resolve(), naviga: (u) => vai.push(u) });
    c("rinvio: un indirizzo che non è di Stripe non si segue (seconda difesa)", 0, vai.length);
  }
}
