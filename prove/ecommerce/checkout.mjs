/** ── E-COMMERCE · T1 · IL CHECKOUT NON PERDE GLI ORDINI ────────────────────
 *  Il bug: `insert().select("order_ref")` da anonimo chiede una policy SELECT che per `anon`
 *  non esiste → errore RLS → `catch {}` che mostrava «Ordine confermato» e svuotava il carrello,
 *  con l'ordine mai salvato. Qui si prova (1) la logica pura di `src/shop/invio-ordine.ts` con un
 *  database finto e (2) il testo di `shop.checkout.tsx`, che deve usarla. Nessuna rete, nessun dato vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formProva, itemsProva } from "./dati.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function prove(mod, { c, gruppo, radice }) {
  const M = mod["shop/invio-ordine"];
  const src = readFileSync(join(radice, "src/routes/shop.checkout.tsx"), "utf8");

  gruppo("E-COMMERCE · CHECKOUT: L'ORDINE NON SI PERDE (17/11/2026)");

  //  ── l'identificativo ──
  let n = 0;
  const uuidFinto = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  c("uuidNuovo: forma di UUID v4", true, UUID.test(M.uuidNuovo()));
  c("uuidNuovo: due chiamate, due valori", true, M.uuidNuovo() !== M.uuidNuovo());
  c("uuidNuovo: senza randomUUID ripiega su getRandomValues, sempre UUID v4", true,
    UUID.test(M.uuidNuovo({ getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = 7 * i + 3; return a; } })));
  c("uuidNuovo: senza crypto non lancia, resta UUID v4", true, UUID.test(M.uuidNuovo(null)));

  //  ── il tentativo: stesso carrello = stessi id; carrello o dati cambiati = id nuovi ──
  const base = { form: formProva(), items: itemsProva(), subtotal: 20, shipping: 4.9, total: 24.9 };
  const firma = M.firmaOrdine(base);
  c("la firma di due ordini uguali è uguale", firma, M.firmaOrdine({ ...base, form: formProva(), items: itemsProva() }));
  c("la firma cambia se cambia la quantità", true, firma !== M.firmaOrdine({ ...base, items: [{ ...itemsProva()[0], qty: 2 }], subtotal: 40 }));
  c("la firma cambia se si aggiunge un prodotto", true, firma !== M.firmaOrdine({ ...base, items: itemsProva([{ product_id: "due", name: "Due", slug: null, qty: 1, unit_price: 5, variant: null }]) }));
  c("la firma cambia se cambia la variante", true, firma !== M.firmaOrdine({ ...base, items: [{ ...itemsProva()[0], variant: { colore: "nero" } }] }));
  c("la firma cambia se cambia un dato del cliente", true, firma !== M.firmaOrdine({ ...base, form: formProva({ cap: "00001" }) }));
  c("la firma cambia se cambia la nota", true, firma !== M.firmaOrdine({ ...base, form: formProva({ note: "citofono rotto" }) }));
  c("la firma cambia se cambia la spedizione o il totale", true,
    firma !== M.firmaOrdine({ ...base, shipping: 0, total: 20 }));

  const t1 = M.tentativoPer(null, firma, 1_000_000, uuidFinto);
  c("primo tentativo: id UUID, riferimento HG-…", [true, true], [UUID.test(t1.id), /^HG-[0-9A-Z]{1,6}$/.test(t1.orderRef)]);
  const t2 = M.tentativoPer(t1, firma, 2_000_000, uuidFinto);
  c("stesso carrello dopo un errore: stesso id e stesso riferimento", [t1.id, t1.orderRef], [t2.id, t2.orderRef]);
  const t3 = M.tentativoPer(t2, M.firmaOrdine({ ...base, items: [{ ...itemsProva()[0], qty: 3 }], subtotal: 60 }), 3_000_000, uuidFinto);
  c("carrello cambiato: id nuovo", true, t3.id !== t1.id);
  c("carrello cambiato: riferimento nuovo", true, t3.orderRef !== t1.orderRef);
  const t4 = M.tentativoPer(t3, M.firmaOrdine({ ...base, form: formProva({ telefono: "+39 300 000 0009" }) }), 4_000_000, uuidFinto);
  c("dati del cliente cambiati: id nuovo", true, t4.id !== t3.id);

  //  ── la riga che parte verso il database ──
  const riga = M.rigaOrdine(t1, base);
  c("la riga porta l'id e il riferimento del tentativo", [t1.id, t1.orderRef], [riga.id, riga.order_ref]);
  c("la riga ha esattamente i campi del checkout di prima, più l'id", 
    ["cap", "citta", "cognome", "email", "id", "indirizzo", "items", "nome", "note", "order_ref", "shipping", "status", "subtotal", "telefono", "total"],
    Object.keys(riga).sort());
  c("niente created_at nella riga (la policy lo vuole = adesso)", false, "created_at" in riga);
  c("stato «nuovo»; nota vuota → null", ["nuovo", null], [riga.status, riga.note]);
  c("i valori numerici passano com'erano", [20, 4.9, 24.9], [riga.subtotal, riga.shipping, riga.total]);

  //  ── l'esito: si legge il CODICE dell'errore, mai il testo ──
  const manda = (risposta) => async () => (risposta instanceof Error ? Promise.reject(risposta) : risposta);
  c("nessun errore → salvato", "salvato", await M.inviaOrdine(riga, manda({ error: null })));
  c("23505 → già salvato (il primo invio era andato a buon fine)", "salvato", await M.inviaOrdine(riga, manda({ error: { code: "23505", message: "boh" } })));
  c("23505 col testo di un altro messaggio → salvato", "salvato", await M.inviaOrdine(riga, manda({ error: { code: "23505", message: "qualunque cosa" } })));
  c("errore RLS (42501) → errore", "errore", await M.inviaOrdine(riga, manda({ error: { code: "42501", message: "new row violates row-level security policy" } })));
  c("testo «duplicate key» ma codice diverso → errore (conta il codice)", "errore", await M.inviaOrdine(riga, manda({ error: { code: "42501", message: "duplicate key value violates unique constraint (23505)" } })));
  c("errore senza codice, col testo «duplicate key» → errore", "errore", await M.inviaOrdine(riga, manda({ error: { message: "duplicate key value violates unique constraint" } })));
  c("errore di rete come valore (codice vuoto) → errore", "errore", await M.inviaOrdine(riga, manda({ error: { code: "", message: "TypeError: Failed to fetch" } })));
  c("la chiamata lancia (timeout/rete) → errore, non eccezione", "errore", await M.inviaOrdine(riga, manda(new Error("timeout"))));
  c("risposta vuota/illeggibile → errore", "errore", await M.inviaOrdine(riga, async () => undefined));
  c("401/403 (PGRST301) → errore", "errore", await M.inviaOrdine(riga, manda({ error: { code: "PGRST301", message: "JWT" } })));

  //  ── la sequenza che ha fatto i doppioni: timeout, poi nuovo invio ──
  //  Un «database» finto con la chiave primaria: il primo invio SALVA ma la risposta si perde
  //  (timeout); il secondo, con lo stesso id, trova la chiave già presa (23505) → conferma.
  const righeSalvate = [];
  const inviiVisti = [];
  let primo = true;
  const dbFinto = async (r) => {
    inviiVisti.push(r.id);
    if (righeSalvate.some((x) => x.id === r.id)) return { error: { code: "23505", message: "duplicate key" } };
    righeSalvate.push(r);
    if (primo) { primo = false; throw new Error("timeout dopo il salvataggio"); }
    return { error: null };
  };
  let tent = M.tentativoPer(null, firma, 5_000_000, uuidFinto);
  const e1 = await M.inviaOrdine(M.rigaOrdine(tent, base), dbFinto);
  tent = M.tentativoPer(tent, firma, 6_000_000, uuidFinto);
  const e2 = await M.inviaOrdine(M.rigaOrdine(tent, base), dbFinto);
  c("timeout poi 409: il primo è «errore», il secondo conferma", ["errore", "salvato"], [e1, e2]);
  c("i due invii portavano lo STESSO id", true, inviiVisti.length === 2 && inviiVisti[0] === inviiVisti[1]);
  c("nel database c'è UN ordine solo (niente doppione)", 1, righeSalvate.length);

  //  Errore definitivo (RLS), il cliente cambia il carrello, nuovo invio: deve essere un ordine NUOVO,
  //  non un 23505 scambiato per «già salvato».
  const salvate2 = [];
  const visti2 = [];
  let rifiuta = true;
  const db2 = async (r) => {
    visti2.push(r.id);
    if (rifiuta) { rifiuta = false; return { error: { code: "42501", message: "rls" } }; }
    if (salvate2.some((x) => x.id === r.id)) return { error: { code: "23505", message: "duplicate key" } };
    salvate2.push(r);
    return { error: null };
  };
  let ta = M.tentativoPer(null, firma, 7_000_000, uuidFinto);
  const x1 = await M.inviaOrdine(M.rigaOrdine(ta, base), db2);
  const cambiato = { ...base, items: [{ ...itemsProva()[0], qty: 2 }], subtotal: 40, shipping: 0, total: 40 };
  ta = M.tentativoPer(ta, M.firmaOrdine(cambiato), 8_000_000, uuidFinto);
  const x2 = await M.inviaOrdine(M.rigaOrdine(ta, cambiato), db2);
  c("errore definitivo, poi carrello cambiato: errore, poi salvato", ["errore", "salvato"], [x1, x2]);
  c("i due invii avevano id diversi", true, visti2[0] !== visti2[1]);
  c("l'ordine salvato è quello col carrello cambiato", [40], salvate2.map((r) => r.total));

  //  ── il testo del messaggio al cliente ──
  c("il messaggio è in italiano, invita a riprovare e dice che il carrello c'è ancora",
    true, /riprova/i.test(M.MESSAGGIO_ERRORE_ORDINE) && /carrello/i.test(M.MESSAGGIO_ERRORE_ORDINE));
  c("il messaggio non promette un ordine confermato", false, /confermat|ricevut/i.test(M.MESSAGGIO_ERRORE_ORDINE));
  c("il messaggio è breve (≤ 140 caratteri)", true, M.MESSAGGIO_ERRORE_ORDINE.length <= 140);

  //  ── il testo di shop.checkout.tsx: deve usare tutto questo ──
  c("niente `.select(` sul checkout (era il bug: pretendeva di rileggere la riga)", false, /\.select\(/.test(src));
  c("niente `created_at` nel checkout", false, /created_at/.test(src));
  c("niente `catch {}` muto che conferma comunque", false, /catch\s*\{\s*(\/\/[^\n]*\n\s*)*[^}]*setOrderId/.test(src));
  c("id e riferimento non si generano nel gestore: tentativo in un useRef, tramite tentativoPer",
    [true, true], [/useRef</.test(src), /tentativoPer\(/.test(src)]);
  c("il checkout non genera id/riferimento da sé (niente randomUUID, niente Date.now)", false, /randomUUID|Date\.now\(/.test(src));
  c("l'invio passa da inviaOrdine e rigaOrdine", [true, true], [/inviaOrdine\(/.test(src), /rigaOrdine\(/.test(src)]);
  c("l'esito non si legge dal testo dell'errore (niente `.message` nel checkout)", false, /\.message/.test(src));
  const rami = src.match(/if \(esito === "salvato"\) \{([\s\S]*?)\n\s{4}\} else \{([\s\S]*?)\n\s{4}\}/);
  c("c'è un ramo «salvato» e uno «errore»", true, !!rami);
  if (rami) {
    c("ramo salvato: conferma e svuota il carrello", [true, true], [/setOrderId\(/.test(rami[1]), /clear\(\)/.test(rami[1])]);
    c("ramo errore: avviso, niente conferma, niente carrello svuotato", [true, false, false], [/setErrore\(/.test(rami[2]), /setOrderId\(/.test(rami[2]), /clear\(\)/.test(rami[2])]);
  }
  c("clear() e setOrderId( compaiono una volta sola", [1, 1], [(src.match(/\bclear\(\)/g) || []).length, (src.match(/setOrderId\(/g) || []).length]);
  c("l'avviso è role=\"alert\" e mostra il messaggio condiviso", [true, true], [/role="alert"/.test(src), /MESSAGGIO_ERRORE_ORDINE/.test(src)]);
  c("lo stato resta «nuovo» (lo decide rigaOrdine, qui non si sovrascrive)", false, /status:/.test(src));
  const modulo = readFileSync(join(radice, "src/shop/invio-ordine.ts"), "utf8");
  c("il modulo legge il codice 23505, non il testo", [true, false], [/"23505"/.test(modulo), /\.message/.test(modulo)]);
  c("il modulo non importa Supabase né React (resta puro)", false, /from\s+["'](@\/integrations|@supabase|react)/.test(modulo));
}
