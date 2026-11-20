/** ── NEGOZIO · T01 · LA PROVA DEL FINTO DATABASE ───────────────────────────
 *  Tutte le prove del negozio parlano con `_finto-db.mjs`: se il finto sbaglia, mentono tutte.
 *  Qui si controlla che faccia quello che fa il database vero (PostgREST + le funzioni SQL di S1):
 *  filtri, errori di tabella assente, regole al database (unico, CHECK), e le tre funzioni `rpc`
 *  (giacenza mai sotto zero, confronto-e-scambio dell'interruttore). Dati inventati (`dati.mjs`). */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fintoDb, ERRORI_SQL, MOTIVI, SLOT } from "./_finto-db.mjs";
import { tabelleProva, uuid, varianteProva, prodottoProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · IL FINTO DATABASE (20/11/2026)");
  const V1 = uuid(0x300);

  // ── letture ──
  const db = fintoDb({ tabelle: tabelleProva() });
  const tutti = await db.from("shop_prodotti").select("sku").order("sku");
  c("select con colonne: arrivano solo quelle", [{ sku: "PROVA-001" }, { sku: "PROVA-002" }], tutti.data);
  c("la risposta ha error nullo", null, tutti.error);
  c("eq", ["PROVA-002"], (await db.from("shop_prodotti").select("sku").eq("stato", "bozza")).data.map((r) => r.sku));
  c("neq", ["PROVA-001"], (await db.from("shop_prodotti").select("sku").neq("stato", "bozza")).data.map((r) => r.sku));
  c("in", ["PROVA-001", "PROVA-002"], (await db.from("shop_prodotti").select("sku").in("stato", ["bozza", "pubblicato"]).order("sku")).data.map((r) => r.sku));
  c("is null", 2, (await db.from("shop_prodotti").select("id").is("bozza_modifiche", null)).data.length);
  c("or con is.null ed eq", 2, (await db.from("shop_prodotti").select("id").or("bozza_modifiche.is.null,stato.eq.bozza")).data.length);
  c("or con in(a,b): la virgola dentro la parentesi non spezza", 2, (await db.from("shop_prodotti").select("id").or("stato.in.(bozza,pubblicato),sku.eq.XX")).data.length);
  c("order discendente + limit", ["PROVA-002"], (await db.from("shop_prodotti").select("sku").order("sku", { ascending: false }).limit(1)).data.map((r) => r.sku));
  c("range (inclusivo come PostgREST)", ["PROVA-002"], (await db.from("shop_prodotti").select("sku").order("sku").range(1, 5)).data.map((r) => r.sku));
  const conta = await db.from("shop_prodotti").select("id", { count: "exact", head: true }).eq("stato", "bozza");
  c("count + head: niente righe, il numero giusto", [null, 1], [conta.data, conta.count]);
  c("maybeSingle: nessuna riga → null senza errore", [null, null], ((r) => [r.data, r.error])(await db.from("shop_prodotti").select("*").eq("sku", "NO").maybeSingle()));
  c("maybeSingle: due righe → errore PGRST116", "PGRST116", (await db.from("shop_prodotti").select("*").maybeSingle()).error?.code);
  c("single: nessuna riga → errore PGRST116", "PGRST116", (await db.from("shop_prodotti").select("*").eq("sku", "NO").single()).error?.code);
  c("single: una riga → la riga, non una lista", "PROVA-001", (await db.from("shop_prodotti").select("*").eq("sku", "PROVA-001").single()).data.sku);
  const copia = (await db.from("shop_prodotti").select("*").eq("sku", "PROVA-001").single()).data;
  copia.nome = "cambiato fuori";
  c("le righe lette sono copie: cambiarle non tocca il database", "Prodotto di prova", db.tabelle.shop_prodotti[0].nome);
  let lancio = null;
  try { await db.from("shop_prodotti").select("*, shop_varianti(*)"); } catch (e) { lancio = e.message; }
  c("select con relazioni: il finto non finge, lancia", true, /relazion/.test(lancio ?? ""));
  c("un filtro sconosciuto in or: lancia, non indovina", true, await db.from("shop_prodotti").select("id").or("sku.like.P%").then(() => false, () => true));

  // ── scritture ──
  const w = fintoDb({ tabelle: tabelleProva() });
  const ins = await w.from("shop_categorie").insert({ slug: "nuova", nome: "Nuova" }).select("id, slug").single();
  c("insert: la riga prende un id e torna indietro con select", ["nuova", true], [ins.data.slug, typeof ins.data.id === "string"]);
  c("insert di un elenco", 2, ((await w.from("shop_categorie").insert([{ slug: "a", nome: "A" }, { slug: "b", nome: "B" }]).select("id")).data.length));
  c("slug doppio: errore 23505 e niente scritto", ["23505", 4], [(await w.from("shop_categorie").insert({ slug: "nuova", nome: "Doppia" })).error?.code, w.tabelle.shop_categorie.length]);
  c("sku doppio sulle varianti: 23505", "23505", (await w.from("shop_varianti").insert(varianteProva({ id: uuid(0x399) })).then((r) => r.error?.code)));
  c("un valore vuoto non confligge con un altro vuoto (id_codice null)", null, (await w.from("shop_prodotti").insert(prodottoProva({ id: uuid(0x2f0), sku: "PROVA-9", slug: "p-9", id_codice: null }))).error);
  c("giacenza negativa: errore 23514 (CHECK)", "23514", (await w.from("shop_varianti").insert(varianteProva({ id: uuid(0x398), sku: "PROVA-X", giacenza: -1 }))).error?.code);
  c("prezzo negativo: errore 23514 (CHECK)", "23514", (await w.from("shop_varianti").update({ prezzo_cent: -5 }).eq("id", V1)).error?.code);
  c("update con eq: tocca solo quella riga", [1, "Nuovo nome"], ((r) => [r.data.length, r.data[0].nome])(await w.from("shop_prodotti").update({ nome: "Nuovo nome" }).eq("sku", "PROVA-001").select("nome")));
  c("update che non trova niente: nessun errore (come PostgREST)", [null, 0], ((r) => [r.error, r.data.length])(await w.from("shop_prodotti").update({ nome: "x" }).eq("sku", "NO").select("id")));
  c("update su uno sku già preso: 23505", "23505", (await w.from("shop_prodotti").update({ sku: "PROVA-002" }).eq("sku", "PROVA-001")).error?.code);
  const up = fintoDb({ tabelle: tabelleProva() });
  await up.from("shop_impostazioni").upsert({ chiave: "catalogo_sito", valore: "cms" }, { onConflict: "chiave" });
  await up.from("shop_impostazioni").upsert({ chiave: "nuova_chiave", valore: 1 }, { onConflict: "chiave" });
  c("upsert: aggiorna la riga che c'è, aggiunge quella che manca", ["cms", 3], [up.tabelle.shop_impostazioni[0].valore, up.tabelle.shop_impostazioni.length]);
  await up.from("shop_impostazioni").upsert({ chiave: "catalogo_sito", valore: "codice" }, { onConflict: "chiave", ignoreDuplicates: true });
  c("upsert con ignoreDuplicates: la riga che c'è non si riscrive", "cms", up.tabelle.shop_impostazioni[0].valore);
  let cancella = null;
  try { await w.from("shop_prodotti").delete().eq("sku", "PROVA-001"); } catch (e) { cancella = e.message; }
  c("delete: il finto lancia (nel negozio non si cancella)", true, /cancella/.test(cancella ?? ""));

  // ── tabella assente (migrazione S1 non applicata) ──
  const senza = fintoDb({ tabelle: tabelleProva(), mancante: true });
  const r0 = await senza.from("shop_impostazioni").select("valore").eq("chiave", "catalogo_sito");
  c("migrazione non applicata: 42P01 e nessun dato", ["42P01", null], [r0.error?.code, r0.data]);
  c("…vale anche per scrivere", "42P01", (await senza.from("shop_categorie").insert({ slug: "a", nome: "A" })).error?.code);
  c("…e per le funzioni SQL: PGRST202 (come PostgREST)", "PGRST202", (await senza.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 1, p_motivo: "carico" })).error?.code);
  c("il codice dell'errore si sceglie (PGRST205 come lo dà PostgREST)", "PGRST205",
    (await fintoDb({ tabelle: tabelleProva(), mancante: true, codiceMancante: "PGRST205" }).from("shop_prodotti").select("id")).error?.code);
  const parziale = fintoDb({ tabelle: tabelleProva(), mancante: ["shop_media"] });
  c("mancante solo qualche tabella: le altre funzionano", ["42P01", null], [(await parziale.from("shop_media").select("id")).error?.code, (await parziale.from("shop_prodotti").select("id")).error]);
  const sc = fintoDb({ tabelle: { tracking_config: [{ id: 1, meta_pixel_id: "000" }] }, senzaColonne: { tracking_config: ["google_ga4_id"] } });
  c("colonna che manca (S3 non applicata): 42703 in lettura", "42703", (await sc.from("tracking_config").select("meta_pixel_id, google_ga4_id")).error?.code);
  c("…e PGRST204 in scrittura", "PGRST204", (await sc.from("tracking_config").insert({ meta_pixel_id: "1", google_ga4_id: "G-X" })).error?.code);
  c("…le colonne vecchie funzionano", [null, 1], ((r) => [r.error, r.data.length])(await sc.from("tracking_config").select("meta_pixel_id")));

  // ── errori e prima (altri utenti) ──
  const er = fintoDb({ tabelle: tabelleProva(), errori: { "shop_prodotti.select": { error: { code: "XX000", message: "guasto" } } } });
  c("errore programmato su «tabella.operazione»", ["XX000", null], ((r) => [r.error.code, r.data])(await er.from("shop_prodotti").select("id")));
  const rete = fintoDb({ tabelle: tabelleProva(), errori: { "shop_prodotti.select": { lancia: new Error("rete") } } });
  c("errore di rete programmato: la chiamata lancia", "rete", await rete.from("shop_prodotti").select("id").then(() => "", (e) => e.message));
  const pr = fintoDb({ tabelle: tabelleProva(), prima: { "shop_prodotti.update": (t) => { t.shop_prodotti[0].stato = "archiviato"; } } });
  await pr.from("shop_prodotti").update({ nome: "x" }).eq("stato", "pubblicato");
  c("«prima»: un altro scrive un attimo prima, l'update non trova più la riga", "Prodotto di prova", pr.tabelle.shop_prodotti[0].nome);

  // ── registro ──
  const rg = fintoDb({ tabelle: tabelleProva() });
  await rg.from("shop_prodotti").select("id");
  await rg.from("shop_prodotti").update({ nome: "y" }).eq("sku", "PROVA-001");
  await rg.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 1, p_motivo: "carico" });
  await rg.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: -99, p_motivo: "rettifica" });
  c("registro: 4 chiamate in ordine, con il nome", ["shop_prodotti.select", "shop_prodotti.update", "rpc.shop_giacenza_muovi", "rpc.shop_giacenza_muovi"], rg.registro.map((x) => x.chiave));
  c("le scritture sono quelle che hanno scritto davvero (la rpc rifiutata non conta)", ["shop_prodotti.update", "rpc.shop_giacenza_muovi"], rg.scritture.map((x) => x.chiave));
  c("chiamate = tutte", 4, rg.chiamate);

  // ── funzione SQL: giacenza ──
  const g = fintoDb({ tabelle: tabelleProva() });
  const giac = () => g.tabelle.shop_varianti.find((v) => v.id === V1).giacenza;
  const m1 = await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: -2, p_motivo: "rettifica", p_nota: "conteggio", p_chi: "Prova", p_ordine_ref: null });
  c("muovi -2 da 5: torna 3, nessun errore", [3, null, 3], [m1.data, m1.error, giac()]);
  c("…e scrive il movimento con la giacenza di dopo", [{ variante_id: V1, delta: -2, giacenza_dopo: 3, motivo: "rettifica", nota: "conteggio", chi: "Prova", ordine_ref: null }],
    g.tabelle.shop_giacenza_movimenti.map(({ id, creato_il, ...resto }) => resto));
  const m2 = await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: -4, p_motivo: "rettifica" });
  c("muovi -4 da 3: errore «giacenza_negativa», niente cambia", ["giacenza_negativa", 3, 1], [m2.error?.message, giac(), g.tabelle.shop_giacenza_movimenti.length]);
  c("…fino a zero sì", [0, 0], [(await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: -3, p_motivo: "ordine" })).data, giac()]);
  await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 10, p_motivo: "carico" });
  await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: -4, p_motivo: "ordine" });
  c("due chiamate in sequenza: la somma è giusta", 6, giac());
  const insieme = fintoDb({ tabelle: tabelleProva() });
  const esiti = await Promise.all([1, 2, 3, 4, 5, 6, 7].map(() => insieme.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: -1, p_motivo: "ordine" })));
  c("sette richieste una dopo l'altra (il finto ha un solo filo: NON dimostra la corsa) per 5 pezzi: ne passano 5, due ricevono l'errore, mai sotto zero", [5, 2, 0], [esiti.filter((e) => !e.error).length, esiti.filter((e) => e.error?.message === "giacenza_negativa").length, insieme.tabelle.shop_varianti.find((v) => v.id === V1).giacenza]);
  c("motivo sconosciuto: errore 23514", "23514", (await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 1, p_motivo: "regalo" })).error?.code);
  c("variante che non c'è: «variante_inesistente», codice P0002 (no_data_found)", ["variante_inesistente", "P0002"],
    ((e) => [e.message, e.code])((await g.rpc("shop_giacenza_muovi", { p_variante: uuid(0x999), p_delta: 1, p_motivo: "carico" })).error));
  c("giacenza negativa: «giacenza_negativa», codice 23514 (check_violation)", ["giacenza_negativa", "23514"],
    ((e) => [e.message, e.code])((await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: -999, p_motivo: "ordine" })).error));
  c("delta nullo: «giacenza_delta_vuoto», codice 22023 (e non «delta_non_valido»)", ["giacenza_delta_vuoto", "22023"],
    ((e) => [e.message, e.code])((await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: null, p_motivo: "carico" })).error));
  c("delta non intero: errore di tipo 22P02", "22P02", (await g.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 1.5, p_motivo: "carico" })).error?.code);
  // 1. delta zero e «imposta» al valore di adesso: niente movimento, niente scrittura, torna la giacenza
  const zero = fintoDb({ tabelle: tabelleProva() });
  const z1 = await zero.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 0, p_motivo: "rettifica", p_chi: "Prova" });
  const z2 = await zero.rpc("shop_giacenza_imposta", { p_variante: V1, p_nuovo: 5, p_motivo: "rettifica", p_chi: "Prova" });
  c("delta 0 e «imposta» uguale all'attuale: torna la giacenza, nessun movimento, nessuna scrittura", [5, 5, 0, 0], [z1.data, z2.data, zero.tabelle.shop_giacenza_movimenti.length, zero.scritture.length]);
  c("delta 0 con il motivo sbagliato non dà errore (come S1: ritorna prima di scrivere)", [5, null], ((r) => [r.data, r.error])(await zero.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 0, p_motivo: "regalo" })));
  c("delta 0 su una variante che non c'è: «variante_inesistente»", "variante_inesistente", (await zero.rpc("shop_giacenza_muovi", { p_variante: uuid(0x999), p_delta: 0, p_motivo: "carico" })).error?.message);
  // 4. chi: vuoto → «sconosciuto», al massimo 80 segni
  const chi = fintoDb({ tabelle: tabelleProva() });
  for (const x of [undefined, "", "   ", "A".repeat(100), "  Prova  "]) await chi.rpc("shop_giacenza_muovi", { p_variante: V1, p_delta: 1, p_motivo: "carico", p_chi: x });
  c("«chi» dei movimenti: vuoto → «sconosciuto», oltre 80 segni si taglia, gli spazi attorno si tolgono", ["sconosciuto", "sconosciuto", "sconosciuto", "A".repeat(80), "Prova"], chi.tabelle.shop_giacenza_movimenti.map((m) => m.chi));
  const gi = fintoDb({ tabelle: tabelleProva() });
  const i1 = await gi.rpc("shop_giacenza_imposta", { p_variante: V1, p_nuovo: 9, p_motivo: "rettifica", p_chi: "Prova" });
  c("imposta 9 da 5: il delta lo calcola il finto (+4)", [9, 4, 9], [i1.data, gi.tabelle.shop_giacenza_movimenti[0].delta, gi.tabelle.shop_varianti.find((v) => v.id === V1).giacenza]);
  c("imposta un valore negativo o nullo: «giacenza_negativa», 23514", [["giacenza_negativa", "23514"], ["giacenza_negativa", "23514"]],
    [(await gi.rpc("shop_giacenza_imposta", { p_variante: V1, p_nuovo: -1, p_motivo: "rettifica" })).error, (await gi.rpc("shop_giacenza_imposta", { p_variante: V1, p_nuovo: null, p_motivo: "rettifica" })).error].map((e) => [e.message, e.code]));
  c("imposta su una variante che non c'è: «variante_inesistente»", "variante_inesistente", (await gi.rpc("shop_giacenza_imposta", { p_variante: uuid(0x999), p_nuovo: 1, p_motivo: "rettifica" })).error?.message);

  // ── funzione SQL: interruttore (confronto-e-scambio) ──
  const s = fintoDb({ tabelle: tabelleProva() });
  const valore = () => s.tabelle.shop_impostazioni.find((x) => x.chiave === "catalogo_sito").valore;
  const sbagliato = await s.rpc("shop_impostazione_imposta", { p_chiave: "catalogo_sito", p_atteso: "cms", p_nuovo: "codice", p_chi: "Prova" });
  c("valore atteso sbagliato: false, non scrive né il valore né lo storico", [false, "codice", 0, 0], [sbagliato.data, valore(), s.tabelle.shop_storico.length, s.scritture.length]);
  const giusto = await s.rpc("shop_impostazione_imposta", { p_chiave: "catalogo_sito", p_atteso: "codice", p_nuovo: "cms", p_chi: "Prova" });
  c("valore atteso giusto: true, cambia e scrive lo storico", [true, "cms", [{ entita: "impostazione", entita_id: "catalogo_sito", campo: "valore", prima: "codice", dopo: "cms", chi: "Prova" }]],
    [giusto.data, valore(), s.tabelle.shop_storico.map(({ id, creato_il, ...resto }) => resto)]);
  c("la seconda persona con lo stesso «atteso» trova già cambiato: false", false, (await s.rpc("shop_impostazione_imposta", { p_chiave: "catalogo_sito", p_atteso: "codice", p_nuovo: "cms", p_chi: "Altra" })).data);
  c("nuovo uguale all'atteso: false, niente storico", [false, 1], [(await s.rpc("shop_impostazione_imposta", { p_chiave: "catalogo_sito", p_atteso: "cms", p_nuovo: "cms", p_chi: "Prova" })).data, s.tabelle.shop_storico.length]);
  c("chiave che non c'è: false", false, (await s.rpc("shop_impostazione_imposta", { p_chiave: "boh", p_atteso: 1, p_nuovo: 2, p_chi: "Prova" })).data);
  await s.rpc("shop_impostazione_imposta", { p_chiave: "giacenza_bassa", p_atteso: 3, p_nuovo: 5, p_chi: "Prova" });
  c("vale anche per i numeri (3 → 5)", 5, s.tabelle.shop_impostazioni.find((x) => x.chiave === "giacenza_bassa").valore);
  // 3. il confronto è fra JSON (come jsonb): l'ordine delle chiavi non conta; atteso o nuovo nulli → false
  const j = fintoDb({ tabelle: { shop_impostazioni: [{ chiave: "oggetto", valore: { a: 1, b: { c: 2, d: [1, 2] } }, aggiornato_il: "x", aggiornato_da: null }] } });
  const jv = () => j.tabelle.shop_impostazioni[0].valore;
  c("chiavi in ordine diverso: l'atteso combacia lo stesso", [true, { z: 1 }], [(await j.rpc("shop_impostazione_imposta", { p_chiave: "oggetto", p_atteso: { b: { d: [1, 2], c: 2 }, a: 1 }, p_nuovo: { z: 1 }, p_chi: "Prova" })).data, jv()]);
  c("nuovo uguale all'atteso con le chiavi in ordine diverso: false, niente storico", [false, 1], [(await j.rpc("shop_impostazione_imposta", { p_chiave: "oggetto", p_atteso: { z: 1, y: 2 }, p_nuovo: { y: 2, z: 1 }, p_chi: "Prova" })).data, j.tabelle.shop_storico.length]);
  c("un elenco in ordine diverso NON è lo stesso valore", false, (await j.rpc("shop_impostazione_imposta", { p_chiave: "oggetto", p_atteso: [2, 1], p_nuovo: 3, p_chi: "Prova" })).data);
  c("atteso nullo o nuovo nullo: false, non scrive", [false, false, { z: 1 }], [(await j.rpc("shop_impostazione_imposta", { p_chiave: "oggetto", p_atteso: null, p_nuovo: 3, p_chi: "Prova" })).data, (await j.rpc("shop_impostazione_imposta", { p_chiave: "oggetto", p_atteso: { z: 1 }, p_nuovo: null, p_chi: "Prova" })).data, jv()]);
  // 4. «chi» anche qui
  await j.rpc("shop_impostazione_imposta", { p_chiave: "oggetto", p_atteso: { z: 1 }, p_nuovo: 1, p_chi: "" });
  await j.rpc("shop_impostazione_imposta", { p_chiave: "oggetto", p_atteso: 1, p_nuovo: 2, p_chi: "B".repeat(95) });
  c("interruttore: «chi» vuoto → «sconosciuto», oltre 80 segni si taglia (valore e storico)", [["sconosciuto", "B".repeat(80)], "B".repeat(80)], [j.tabelle.shop_storico.slice(-2).map((x) => x.chi), j.tabelle.shop_impostazioni[0].aggiornato_da]);
  c("una funzione che non esiste: errore PGRST202", "PGRST202", (await s.rpc("shop_non_esiste", {})).error?.code);

  // ── 5. «scritture»: solo se è stata toccata almeno una riga ──
  const sc2 = fintoDb({ tabelle: tabelleProva() });
  await sc2.from("shop_prodotti").update({ nome: "x" }).eq("sku", "NO");
  await sc2.from("shop_prodotti").insert([]);
  await sc2.from("shop_impostazioni").upsert({ chiave: "catalogo_sito", valore: "cms" }, { onConflict: "chiave", ignoreDuplicates: true });
  c("update senza righe, insert vuoto, upsert tutto ignorato: nessuna scrittura", 0, sc2.scritture.length);
  await sc2.from("shop_prodotti").update({ nome: "y" }).eq("sku", "PROVA-001");
  c("un update che tocca una riga conta", ["shop_prodotti.update"], sc2.scritture.map((x) => x.chiave));
  c("le chiamate sono comunque tutte nel registro", 4, sc2.chiamate);

  // ── 6. i DEFAULT di S1 e i CHECK di shop_media ──
  const d = fintoDb({ tabelle: tabelleProva() });
  await d.from("shop_varianti").insert({ prodotto_id: uuid(0x200), sku: "PROVA-D" });
  await d.from("shop_prodotti").insert({ sku: "PROVA-D", slug: "prova-d", nome: "D", tipo: "cura" });
  await d.from("shop_categorie").insert({ slug: "d", nome: "D" });
  const nuovaVar = d.tabelle.shop_varianti.at(-1), nuovoProd = d.tabelle.shop_prodotti.at(-1), nuovaCat = d.tabelle.shop_categorie.at(-1);
  c("variante nuova: giacenza 0, attiva, nome vuoto, opzioni vuote", [0, true, "", {}], [nuovaVar.giacenza, nuovaVar.attiva, nuovaVar.nome, nuovaVar.opzioni]);
  c("prodotto nuovo: bozza, prezzo 0, caratteristiche vuote, nessuna consulenza", ["bozza", 0, [], false], [nuovoProd.stato, nuovoProd.prezzo_cent, nuovoProd.caratteristiche, nuovoProd.box_consulenza]);
  c("categoria nuova: non visibile, tipo «categoria»", [false, "categoria"], [nuovaCat.visibile, nuovaCat.tipo]);
  const m0 = { prodotto_id: uuid(0x200), slot: "foto2" };
  const media = async (extra) => (await d.from("shop_media").insert({ ...m0, ...extra })).error?.code ?? null;
  c("media valida: passa, con tipo «foto» e senza persone di default", [null, "foto", false], [await media({}), d.tabelle.shop_media.at(-1).tipo, d.tabelle.shop_media.at(-1).ritrae_persone]);
  c("media: slot sconosciuto, sotto-ruolo sconosciuto, tipo sconosciuto, durata negativa → 23514", Array(4).fill("23514"),
    [await media({ slot: "foto9" }), await media({ sotto_ruolo: "boh" }), await media({ tipo: "audio" }), await media({ durata_s: -1 })]);
  c("media: né prodotto né categoria, oppure tutti e due → 23514", ["23514", "23514"], [await media({ prodotto_id: null }), await media({ categoria_id: uuid(0x100) })]);
  c("media di una categoria (senza prodotto) → passa", null, await media({ prodotto_id: null, categoria_id: uuid(0x100) }));
  c("media con variante ma slot diverso da «campione» → 23514; con «campione» passa", ["23514", null], [await media({ variante_id: V1 }), await media({ slot: "campione", variante_id: V1 })]);
  c("tutti gli slot di S1 sono ammessi", [], (await Promise.all(SLOT.map(async (slot) => [slot, await media({ slot, variante_id: slot === "campione" ? V1 : null })]))).filter(([, e]) => e));

  // ── 7. una funzione assente è PGRST202; 8. `eq(col, null)` non trova niente ──
  c("rpc di una funzione che non c'è: PGRST202", "PGRST202", (await fintoDb({ tabelle: tabelleProva() }).rpc("shop_non_esiste", {})).error?.code);
  c("eq(col, null) non trova niente (`= NULL` non è mai vero); is(col, null) sì", [0, 2], [(await db.from("shop_prodotti").select("id").eq("bozza_modifiche", null)).data.length, (await db.from("shop_prodotti").select("id").is("bozza_modifiche", null)).data.length]);

  // ── prova incrociata: i nomi del finto ci sono davvero nel testo di S1 ──
  const percorsoS1 = join(radice, "supabase/migrations/20261120120000_shop_catalogo.sql");
  if (!existsSync(percorsoS1)) {
    console.log("  SALTATA  prova incrociata finto ↔ S1: la migrazione S1 (T02) non è ancora in questo ramo; gira appena si unisce");
  } else {
    const sql = readFileSync(percorsoS1, "utf8").replace(/--.*$/gm, "");
    for (const [nome, { errcode }] of Object.entries(ERRORI_SQL))
      c(`S1 contiene «RAISE EXCEPTION '${nome}' … ERRCODE = '${errcode}'»`, true, new RegExp(`RAISE EXCEPTION '${nome}'\\s+USING ERRCODE = '${errcode}'`).test(sql));
    c("S1 ammette gli stessi motivi di movimento del finto", true, MOTIVI.every((m) => sql.includes(`'${m}'`)) && /motivo\s+text NOT NULL CHECK \(motivo IN \(([^)]*)\)/.exec(sql)?.[1].split(",").length === MOTIVI.length);
    c("S1 ammette gli stessi slot del finto (e di modello.ts)", [true, true], [
      SLOT.every((s) => sql.includes(`'${s}'`)) && /slot\s+text NOT NULL CHECK \(slot IN \(([^)]*)\)/.exec(sql)?.[1].split(",").length === SLOT.length,
      JSON.stringify(SLOT) === JSON.stringify(mod["shop/cms/modello"].SLOT),
    ]);
    c("S1 scrive «chi» come il finto: vuoto → «sconosciuto», 80 segni", true, /left\(COALESCE\(NULLIF\(btrim\(p_chi\), ''\), 'sconosciuto'\), 80\)/.test(sql));
    c("S1 ha le tre funzioni con gli argomenti che il finto si aspetta", true, [
      /FUNCTION public\.shop_giacenza_muovi\(\s*p_variante\s+uuid,\s*p_delta\s+integer,\s*p_motivo\s+text,\s*p_nota\s+text,\s*p_chi\s+text,\s*p_ordine_ref\s+text/,
      /FUNCTION public\.shop_giacenza_imposta\(\s*p_variante\s+uuid,\s*p_nuovo\s+integer,\s*p_motivo\s+text,\s*p_chi\s+text/,
      /FUNCTION public\.shop_impostazione_imposta\(\s*p_chiave\s+text,\s*p_atteso\s+jsonb,\s*p_nuovo\s+jsonb,\s*p_chi\s+text/,
    ].every((r) => r.test(sql)));
  }
}
