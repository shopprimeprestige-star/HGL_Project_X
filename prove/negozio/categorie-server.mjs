/** ── NEGOZIO · T09 · IL SERVER DELLE CATEGORIE ─────────────────────────────
 *  `src/crm/negozio/categorie.server.ts`: `GET ?categorie`, `categoria_salva`, `categoria_ordina`, `categoria_visibile`.
 *  Lo slug è unico e si blocca dopo la prima pubblicazione; ogni cambio lascia una riga in `shop_storico` (solo INSERT:
 *  il registro non si aggiorna); il confronto di versione (`aggiornato_il`) dà 409; mai `delete`, mai `upsert`. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, categoriaProva, uuid, ISTANTE } from "./dati.mjs";
import { porte, post, get, leggi, guardiaNo, scrittureDirette, ADESSO } from "./_server.mjs";

const C1 = uuid(0x100), C2 = uuid(0x101), C3 = uuid(0x102);
/** Tre categorie: visibile con un pubblicato, nascosta con solo una bozza, già pubblicata una volta. */
const tabelle = () => {
  const t = tabelleProva();
  t.shop_categorie = [
    categoriaProva({ id: C1, slug: "categoria-prova", nome: "Categoria di prova", ordine: 1 }),
    categoriaProva({ id: C2, slug: "vuota", nome: "Vuota", ordine: 2, visibile: false }),
    categoriaProva({ id: C3, slug: "gia-uscita", nome: "Già uscita", ordine: 3, visibile: true, pubblicata_il: ISTANTE }),
  ];
  t.shop_prodotti_categorie = [
    { prodotto_id: uuid(0x200), categoria_id: C1 }, // pubblicato
    { prodotto_id: uuid(0x201), categoria_id: C1 }, // bozza: non conta
    { prodotto_id: uuid(0x201), categoria_id: C2 },
  ];
  return t;
};

export async function prove(mod, { c, gruppo, radice }) {
  const K = mod["negozio/categorie.server"];
  gruppo("NEGOZIO · IL SERVER DELLE CATEGORIE (20/11/2026)");
  const esegui = async (corpo, opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: tabelle() });
    const p = porte({ db, ...opz.porte });
    return { db, log: p.log, ...(await leggi(opz.get ? await K.gestisciGET(get(corpo), p.d) : await K.gestisciPOST(post(corpo), p.d))) };
  };
  const cat = (db, id) => db.tabelle.shop_categorie.find((x) => x.id === id);

  // ── la guardia ──
  for (const stato of [401, 403]) {
    const g = await esegui("categorie", { get: true, porte: { guardia: guardiaNo(stato) } });
    const p = await esegui({ azione: "categoria_salva", nome: "X" }, { porte: { guardia: guardiaNo(stato) } });
    c(`guardia negata (${stato}) in lettura e in scrittura: zero chiamate al database`, [stato, stato, 0, 0], [g.stato, p.stato, g.db.chiamate, p.db.chiamate]);
  }

  // ── l'elenco ──
  const l = await esegui("categorie", { get: true });
  const elenco = l.corpo.categorie ?? [];
  c("GET ?categorie: tre righe nell'ordine, con il numero di prodotti PUBBLICATI (la bozza non conta)", [200, [C1, C2, C3], [1, 0, 0]], [l.stato, elenco.map((x) => x.id), elenco.map((x) => x.quanti)]);
  c("…«nascosta dal sito» se non è visibile o non ha prodotti pubblicati; lo slug è bloccato solo dopo la prima uscita", [[false, true, true], [false, false, true]], [elenco.map((x) => x.nascosta), elenco.map((x) => x.slugBloccato)]);
  c("…porta la versione (aggiornato_il) per il confronto, e non porta campi interni", [ISTANTE, false], [elenco[0]?.versione, "aggiornato_il" in (elenco[0] ?? {})]);
  const altro = await esegui("prodotti", { get: true });
  c("GET senza ?categorie → 400 e nessuna chiamata", [400, 0], [altro.stato, altro.db.chiamate]);

  // ── creare ──
  const n = await esegui({ azione: "categoria_salva", nome: "Nuova categoria", frase: "Una frase." });
  const nuova = n.db.tabelle.shop_categorie.find((x) => x.nome === "Nuova categoria");
  c("crea: lo slug viene dal nome, non è visibile, va in fondo all'elenco", [200, true, "nuova-categoria", false, 4], [n.stato, n.corpo.ok, nuova?.slug, nuova?.visibile, nuova?.ordine]);
  c("…risponde con la categoria (id e versione)", [nuova?.id, true], [n.corpo.categoria?.id, typeof n.corpo.categoria?.versione === "string"]);
  c("…lo storico ha una riga per campo con chi e quando, prima vuoto", ["categoria", true, "Titolare Prova", null], ((s) => [s?.entita, n.db.tabelle.shop_storico.every((r) => r.entita_id === nuova?.id && r.chi === "Titolare Prova"), s?.chi, s?.prima])(n.db.tabelle.shop_storico.find((r) => r.campo === "nome")));
  const dop = await esegui({ azione: "categoria_salva", nome: "Altra", slug: "categoria-prova" });
  c("slug già usato → 409 slug_occupato, niente scritto", [409, "slug_occupato", 3, 0], [dop.stato, dop.corpo.motivo, dop.db.tabelle.shop_categorie.length, dop.db.tabelle.shop_storico.length]);
  const corsa = await esegui({ azione: "categoria_salva", nome: "Veloce", slug: "veloce" }, { db: fintoDb({ tabelle: tabelle(), prima: { "shop_categorie.insert": (t) => t.shop_categorie.push(categoriaProva({ id: uuid(0x1ff), slug: "veloce", nome: "Arrivata prima" })) } }) });
  c("slug preso da un altro nell'istante dell'inserimento (23505) → 409 slug_occupato, non un errore tecnico", [409, "slug_occupato"], [corsa.stato, corsa.corpo.motivo]);
  for (const [nome, corpo] of [["slug con spazi e maiuscole", { nome: "A", slug: "Slug Con Spazi" }], ["senza nome", { nome: "  " }], ["nome oltre il tetto", { nome: "x".repeat(61) }], ["tipo sconosciuto", { nome: "A", tipo: "boh" }], ["frase troppo lunga", { nome: "A", frase: "x".repeat(201) }], ["titolo SEO oltre 60", { nome: "A", seoTitolo: "x".repeat(61) }], ["descrizione SEO oltre 155", { nome: "A", seoDescrizione: "x".repeat(156) }], ["nome non testo", { nome: 5 }]]) {
    const r = await esegui({ azione: "categoria_salva", ...corpo });
    c(`crea con ${nome} → 400, niente scritto`, [400, 3, 0], [r.stato, r.db.tabelle.shop_categorie.length, r.db.scritture.length]);
  }

  // ── modificare, con la versione ──
  const m = await esegui({ azione: "categoria_salva", id: C1, nome: "Nuovo nome", versione: ISTANTE });
  c("modifica con la versione giusta → ok, il nome cambia, la versione va avanti", [200, "Nuovo nome", ADESSO], [m.stato, cat(m.db, C1).nome, cat(m.db, C1).aggiornato_il]);
  c("…lo storico ha UNA riga: campo nome, prima e dopo, chi", [[{ entita: "categoria", entita_id: C1, campo: "nome", prima: "Categoria di prova", dopo: "Nuovo nome", chi: "Titolare Prova" }]],
    [m.db.tabelle.shop_storico.map(({ entita, entita_id, campo, prima, dopo, chi }) => ({ entita, entita_id, campo, prima, dopo, chi }))]);
  c("…la risposta porta la versione RILETTA dal database (qui con altri decimali, come PostgREST), non quella calcolata dal server", "2026-11-20T12:00:00.123456+00:00",
    (await esegui({ azione: "categoria_salva", id: C1, nome: "Riletta", versione: ISTANTE }, { db: fintoDb({ tabelle: tabelle(), prima: { "shop_categorie.select": (t) => { const r = t.shop_categorie.find((x) => x.id === C1); if (r.aggiornato_il === ADESSO) r.aggiornato_il = "2026-11-20T12:00:00.123456+00:00"; } } }) })).corpo.categoria?.versione);
  const forma = await esegui({ azione: "categoria_salva", id: C1, nome: "Altra forma", versione: "2026-11-20T11:00:00+01:00" });
  c("la versione si confronta per ISTANTE: la stessa ora scritta con +01:00 (invece di Z) è quella giusta", [200, "Altra forma"], [forma.stato, cat(forma.db, C1).nome]);
  const diversa = await esegui({ azione: "categoria_salva", id: C1, nome: "Altra forma", versione: "2026-11-20T10:00:01.000Z" });
  c("…un istante diverso di un secondo → 409", 409, diversa.stato);
  const nonData = await esegui({ azione: "categoria_salva", id: C1, nome: "X", versione: "ieri" });
  c("…una versione che non è una data → 400, nessuna chiamata", [400, 0], [nonData.stato, nonData.db.chiamate]);
  const v = await esegui({ azione: "categoria_salva", id: C1, nome: "Cambio", versione: "2026-11-19T00:00:00.000Z" });
  c("versione vecchia → 409 conflitto, la categoria non cambia, nessuna riga di storico", [409, "conflitto", "Categoria di prova", 0], [v.stato, v.corpo.motivo, cat(v.db, C1).nome, v.db.tabelle.shop_storico.length]);
  const sv = await esegui({ azione: "categoria_salva", id: C1, nome: "Cambio" });
  c("modifica senza versione → 400, niente scritto", [400, "Categoria di prova", 0], [sv.stato, cat(sv.db, C1).nome, sv.db.scritture.length]);
  const nt = await esegui({ azione: "categoria_salva", id: uuid(0x1aa), nome: "X", versione: ISTANTE });
  c("categoria che non c'è → 404", [404, "non_trovato"], [nt.stato, nt.corpo.motivo]);
  const ni = await esegui({ azione: "categoria_salva", id: "abc", nome: "X", versione: ISTANTE });
  c("id che non è un UUID → 400, nessuna chiamata", [400, 0], [ni.stato, ni.db.chiamate]);
  const uguale = await esegui({ azione: "categoria_salva", id: C1, nome: "Categoria di prova", versione: ISTANTE });
  c("salvare senza cambiare niente → ok, nessuna scrittura", [200, 0, 0], [uguale.stato, uguale.db.scritture.length, uguale.db.tabelle.shop_storico.length]);
  const vuoto = await esegui({ azione: "categoria_salva", id: C3, frase: "", seoTitolo: null, versione: ISTANTE });
  c("frase e SEO vuoti → diventano «nessuno» (null), non testo vuoto", [null, null], [cat(vuoto.db, C3).frase, cat(vuoto.db, C3).seo_titolo]);

  // ── lo slug ──
  const sl = await esegui({ azione: "categoria_salva", id: C2, slug: "ora-si", versione: ISTANTE });
  c("slug di una categoria mai pubblicata: si può cambiare", ["ora-si"], [cat(sl.db, C2).slug]);
  const sb = await esegui({ azione: "categoria_salva", id: C3, slug: "cambiato", versione: ISTANTE });
  c("slug dopo la prima pubblicazione → rifiutato (slug_bloccato), con la frase", [409, "slug_bloccato", "gia-uscita", true], [sb.stato, sb.corpo.motivo, cat(sb.db, C3).slug, /indirizzo/i.test(sb.corpo.frase)]);
  const stesso = await esegui({ azione: "categoria_salva", id: C3, slug: "gia-uscita", nome: "Già uscita bis", versione: ISTANTE });
  c("…rimandare lo stesso slug non è un cambio: il resto si salva", [200, "Già uscita bis"], [stesso.stato, cat(stesso.db, C3).nome]);
  const rub = await esegui({ azione: "categoria_salva", id: C2, slug: "categoria-prova", versione: ISTANTE });
  c("slug di un'altra categoria → 409 slug_occupato", [409, "slug_occupato"], [rub.stato, rub.corpo.motivo]);

  // ── visibile ──
  const vi = await esegui({ azione: "categoria_visibile", id: C2, visibile: true, versione: ISTANTE });
  c("rendere visibile → visibile, pubblicata_il = adesso (la prima volta), storico", [true, ADESSO, "visibile", false, true], [cat(vi.db, C2).visibile, cat(vi.db, C2).pubblicata_il, vi.db.tabelle.shop_storico[0]?.campo, vi.db.tabelle.shop_storico[0]?.prima, vi.db.tabelle.shop_storico[0]?.dopo]);
  c("…la risposta porta la versione riletta (quella nuova) per il clic successivo", ADESSO, vi.corpo.versione);
  const vi2 = await esegui({ azione: "categoria_visibile", id: C3, visibile: false, versione: ISTANTE });
  c("nasconderla non cancella la data della prima pubblicazione", [false, ISTANTE], [cat(vi2.db, C3).visibile, cat(vi2.db, C3).pubblicata_il]);
  const vi3 = await esegui({ azione: "categoria_visibile", id: C2, visibile: true, versione: "2026-01-01T00:00:00.000Z" });
  c("visibile con versione vecchia → 409, non cambia", [409, false], [vi3.stato, cat(vi3.db, C2).visibile]);
  const vi4 = await esegui({ azione: "categoria_visibile", id: C2, visibile: "sì", versione: ISTANTE });
  c("visibile che non è vero/falso → 400", [400, 0], [vi4.stato, vi4.db.scritture.length]);
  const vi5 = await esegui({ azione: "categoria_visibile", id: C1, visibile: true, versione: ISTANTE });
  c("già visibile → ok, nessuna scrittura", [200, 0], [vi5.stato, vi5.db.scritture.length]);

  // ── ordinare ──
  const o = await esegui({ azione: "categoria_ordina", ids: [C3, C2, C1] });
  c("ordina: l'ordine 1..n segue l'elenco; lo storico ha una riga per ogni categoria spostata", [[3, 2, 1], [C3, C1].sort()], [[cat(o.db, C1).ordine, cat(o.db, C2).ordine, cat(o.db, C3).ordine], o.db.tabelle.shop_storico.filter((r) => r.campo === "ordine").map((r) => r.entita_id).sort()]);
  c("…la categoria che non si sposta non si riscrive", 2, o.db.scritture.filter((q) => q.tab === "shop_categorie").length);
  const o1 = await esegui({ azione: "categoria_ordina", ids: [C1, C2] });
  c("elenco incompleto (ne manca una) → 409: la lista è cambiata, niente scritto", [409, "conflitto", 0], [o1.stato, o1.corpo.motivo, o1.db.scritture.length]);
  const o2 = await esegui({ azione: "categoria_ordina", ids: [C1, C2, uuid(0x1bb)] });
  c("una categoria che non c'è → 409, niente scritto", [409, 0], [o2.stato, o2.db.scritture.length]);
  for (const [nome, ids] of [["doppioni", [C1, C1, C2]], ["non UUID", [C1, C2, "x"]], ["vuoto", []], ["non una lista", "tutte"], ["troppe", Array.from({ length: 101 }, (_, i) => uuid(i + 1))]]) {
    const r = await esegui({ azione: "categoria_ordina", ids });
    c(`ordina con ${nome} → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }

  // ── guasti, migrazione, registri ──
  const mm = await esegui("categorie", { get: true, db: fintoDb({ tabelle: tabelle(), mancante: true }) });
  const mp = await esegui({ azione: "categoria_salva", nome: "X" }, { db: fintoDb({ tabelle: tabelle(), mancante: true, codiceMancante: "PGRST205" }) });
  c("S1 non applicata → 409 motivo «migrazione» in lettura e in scrittura", [[409, "migrazione"], [409, "migrazione"]], [[mm.stato, mm.corpo.motivo], [mp.stato, mp.corpo.motivo]]);
  const gs = await esegui({ azione: "categoria_salva", id: C1, nome: "Nuovo", versione: ISTANTE }, { db: fintoDb({ tabelle: tabelle(), errori: { "shop_storico.insert": { error: { code: "XX001", message: "x" } } } }) });
  c("lo storico non si scrive: la categoria è salvata lo stesso, la risposta lo dice, nel log solo il codice", [200, "Nuovo", false, ["storico XX001"]], [gs.stato, cat(gs.db, C1).nome, gs.corpo.storico, gs.log]);
  c("…avvisoStorico c'è anche per categoria_salva; con lo storico scritto non c'è", [true, undefined], [typeof gs.corpo.avvisoStorico === "string", m.corpo.avvisoStorico]);
  const ge = await esegui({ azione: "categoria_salva", id: C1, nome: "Nuovo", versione: ISTANTE }, { db: fintoDb({ tabelle: tabelle(), errori: { "shop_categorie.update": { error: { code: "XX002", message: "PROVA riga intera" } } } }) });
  c("errore del database → 500 con frase generica, log col solo codice", [500, "interno", ["aggiorna XX002"], false], [ge.stato, ge.corpo.motivo, ge.log, /PROVA|XX002/.test(JSON.stringify(ge.corpo))]);
  for (const [nome, corpo] of [["JSON rotto", "{no"], ["lista", "[]"], ["azione sconosciuta", { azione: "categoria_boh" }]]) {
    const r = await esegui(corpo);
    c(`corpo storto (${nome}) → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }
  const tutto = await Promise.all([
    esegui({ azione: "categoria_salva", nome: "Una" }), esegui({ azione: "categoria_ordina", ids: [C2, C1, C3] }), esegui({ azione: "categoria_visibile", id: C2, visibile: true, versione: ISTANTE }),
  ]);
  c("nessuna di queste azioni cancella o fa upsert (il finto lancerebbe sul delete)", [200, 200, 200], tutto.map((t) => t.stato));
  c("lo storico e le categorie: solo select, insert, update", true, tutto.every((t) => scrittureDirette(t.db).every((x) => /\.(insert|update)$/.test(x))));
  const sorg = readFileSync(join(radice, "src/crm/negozio/categorie.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il sorgente non contiene .upsert( né ON CONFLICT", [], [".upsert(", "ON CONFLICT", "onConflict"].filter((t) => sorg.includes(t)));
  // `delete` ammesso SOLO sul legame prodotto-categoria: ogni occorrenza di `.delete(` in tutto src/crm/negozio è su quella tabella
  const conDelete = readdirSync(join(radice, "src/crm/negozio")).filter((f) => f.endsWith(".ts")).flatMap((f) => {
    const t = readFileSync(join(radice, "src/crm/negozio", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    return [...t.matchAll(/\.delete\(/g)].map((m) => ({ f, sulLegame: /from\("shop_prodotti_categorie"\)\s*$/.test(t.slice(0, m.index)) }));
  });
  c("`.delete(` compare una volta sola in src/crm/negozio, e subito dopo from(\"shop_prodotti_categorie\")", [[{ f: "categorie.server.ts", sulLegame: true }]], [conDelete]);
  for (const nome of ["constructor", "toString", "categoria_boh", "", undefined, null, 5, "categoria_ordina "]) {
    const db = fintoDb({ tabelle: tabelle() });
    let errore = null;
    try { await K.eseguiCategorie(nome, { ids: [C1, C2, C3], nome: "X" }, "Chi", porte({ db }).d); } catch (e) { errore = e; }
    c(`eseguiCategorie(${JSON.stringify(nome)}) → rifiuto esplicito 400 azione_sconosciuta, niente ripiego su «ordina» (database mai toccato)`, [400, "azione_sconosciuta", 0], [errore?.stato, errore?.motivo, db.chiamate]);
  }
  for (const nome of ["constructor", "toString", "__proto__", "hasOwnProperty", "categoria_salva "]) {
    const r = await esegui({ azione: nome, id: C1 });
    c(`azione «${nome}» → 400 azione_sconosciuta (elenco chiuso, non un oggetto che eredita), nessuna chiamata`, [400, "azione_sconosciuta", 0], [r.stato, r.corpo.motivo, r.db.chiamate]);
  }
  c("le azioni del modulo", ["categoria_foto", "categoria_ordina", "categoria_salva", "categoria_visibile", "prodotto_categorie"], [...K.AZIONI_CATEGORIE].sort());

  // ── le categorie di un prodotto: prodotto_categorie ──
  const P_PUB = uuid(0x200), P_BOZZA = uuid(0x201);
  const legami = (db, p) => db.tabelle.shop_prodotti_categorie.filter((l) => l.prodotto_id === p).map((l) => l.categoria_id).sort();
  const prod = (db, p) => db.tabelle.shop_prodotti.find((x) => x.id === p);
  const pc = (prodottoId, categorie, versione = ISTANTE) => ({ azione: "prodotto_categorie", prodottoId, categorie, versione });
  c("la guardia viene prima anche qui (401): nessuna chiamata", [401, 0], await (async () => { const r = await esegui(pc(P_BOZZA, [C1]), { porte: { guardia: guardiaNo(401) } }); return [r.stato, r.db.chiamate]; })());

  const ag = await esegui(pc(P_PUB, [C1, C3]));
  c("aggiunta: il prodotto pubblicato ha C1 e C3", [200, true, [C1, C3].sort()], [ag.stato, ag.corpo.cambiato, legami(ag.db, P_PUB)]);
  c("…lo storico ha UNA riga: campo categorie, prima e dopo come elenchi di slug, chi", [[{ entita: "prodotto", entita_id: P_PUB, campo: "categorie", prima: ["categoria-prova"], dopo: ["categoria-prova", "gia-uscita"], chi: "Titolare Prova" }]],
    [ag.db.tabelle.shop_storico.map(({ entita, entita_id, campo, prima, dopo, chi }) => ({ entita, entita_id, campo, prima, dopo, chi }))]);
  c("…la versione del prodotto va avanti (serve al confronto)", ADESSO, prod(ag.db, P_PUB).aggiornato_il);
  const ri = await esegui(pc(P_BOZZA, [C1]));
  c("rimozione: la bozza resta solo con C1, lo storico dice prima [C1, C2] e dopo [C1]", [[C1], [["categoria-prova", "vuota"], ["categoria-prova"]]], [legami(ri.db, P_BOZZA), [ri.db.tabelle.shop_storico[0]?.prima, ri.db.tabelle.shop_storico[0]?.dopo]]);
  c("…il legame degli altri prodotti non si tocca", [C1], legami(ri.db, P_PUB));
  const sp = await esegui(pc(P_PUB, [C2]));
  c("sostituzione (via C1, dentro C2) su un pubblicato: si può, resta con una categoria", [200, [C2]], [sp.stato, legami(sp.db, P_PUB)]);
  const og = await esegui(pc(P_PUB, [C2, C3]));
  const reg = og.db.registro.filter((q) => q.tab === "shop_prodotti_categorie" && ["insert", "delete"].includes(q.op)).map((q) => q.op);
  c("si aggiunge PRIMA di togliere: un pubblicato non resta mai senza categoria nemmeno a metà", ["insert", "delete"], reg);
  const senza = await esegui(pc(P_PUB, []));
  c("pubblicato che resterebbe senza categoria → 409 categoria_mancante, niente scritto, legami intatti", [409, "categoria_mancante", [C1], 0, 0], [senza.stato, senza.corpo.motivo, legami(senza.db, P_PUB), senza.db.scritture.length, senza.db.tabelle.shop_storico.length]);
  const bz0 = await esegui(pc(P_BOZZA, []));
  c("una bozza può restare senza categorie (le ha tolte tutte, con lo storico)", [200, [], 1], [bz0.stato, legami(bz0.db, P_BOZZA), bz0.db.tabelle.shop_storico.length]);
  const stessoInsieme = await esegui(pc(P_BOZZA, [C2, C1]));
  c("lo stesso insieme (in altro ordine) → ok «non cambiato», nessuna scrittura", [200, false, 0], [stessoInsieme.stato, stessoInsieme.corpo.cambiato, stessoInsieme.db.scritture.length]);
  const vecchia = await esegui(pc(P_BOZZA, [C1], "2026-01-01T00:00:00.000Z"));
  c("versione vecchia → 409 conflitto, legami e prodotto intatti", [409, "conflitto", [C1, C2].sort(), 0], [vecchia.stato, vecchia.corpo.motivo, legami(vecchia.db, P_BOZZA), vecchia.db.scritture.length]);
  const corsa2 = await esegui(pc(P_BOZZA, [C1]), { db: fintoDb({ tabelle: tabelle(), prima: { "shop_prodotti.update": (t) => { t.shop_prodotti.find((x) => x.id === uuid(0x201)).aggiornato_il = "2026-11-20T11:00:00.000Z"; } } }) });
  c("qualcuno cambia il prodotto un istante prima dello scambio → 409, i legami non si toccano", [409, [C1, C2].sort()], [corsa2.stato, legami(corsa2.db, P_BOZZA)]);
  const ine = await esegui(pc(P_BOZZA, [C1, uuid(0x1cc)]));
  c("una categoria che non esiste → 404 categoria_inesistente, niente scritto", [404, "categoria_inesistente", 0], [ine.stato, ine.corpo.motivo, ine.db.scritture.length]);
  const pni = await esegui(pc(uuid(0x1dd), [C1]));
  c("prodotto che non esiste → 404", [404, "non_trovato"], [pni.stato, pni.corpo.motivo]);
  for (const [nome, corpo] of [["senza versione", { azione: "prodotto_categorie", prodottoId: P_BOZZA, categorie: [C1] }], ["categorie non una lista", pc(P_BOZZA, "C1")], ["doppioni", pc(P_BOZZA, [C1, C1])], ["id non UUID", pc(P_BOZZA, ["x"])], ["prodottoId non UUID", pc("t01", [C1])], ["oltre 20", pc(P_BOZZA, Array.from({ length: 21 }, (_, i) => uuid(i + 1)))]]) {
    const r = await esegui(corpo);
    c(`prodotto_categorie ${nome} → 400, nessuna chiamata al database`, [400, 0], [r.stato, r.db.chiamate]);
  }
  c("…la risposta porta la versione riletta del prodotto", ADESSO, ri.corpo.versione);
  c("…e dichiara che lo storico è scritto (nessun avviso)", [true, undefined], [ri.corpo.storico, ri.corpo.avvisoStorico]);
  const sf = await esegui(pc(P_BOZZA, [C1]), { db: fintoDb({ tabelle: tabelle(), errori: { "shop_storico.insert": { error: { code: "XX004", message: "x" } } } }) });
  c("storico non scritto: i legami sono cambiati lo stesso, la risposta dice storico:false, nel log solo il codice", [[C1], false, ["storico XX004"]], [legami(sf.db, P_BOZZA), sf.corpo.storico, sf.log]);
  c("…e porta una frase per il pannello (avvisoStorico), senza codici né dettagli", [true, false], [typeof sf.corpo.avvisoStorico === "string" && /storico/i.test(sf.corpo.avvisoStorico), /XX004/.test(JSON.stringify(sf.corpo))]);
  const mg = await esegui(pc(P_BOZZA, [C1]), { db: fintoDb({ tabelle: tabelle(), mancante: true }) });
  c("S1 non applicata → 409 migrazione", [409, "migrazione"], [mg.stato, mg.corpo.motivo]);
  const dl = fintoDb({ tabelle: tabelle() });
  let lancio = null;
  try { await dl.from("shop_prodotti").delete().eq("id", P_PUB); } catch (e) { lancio = e.message; }
  let senzaFiltri = null;
  try { await dl.from("shop_prodotti_categorie").delete(); await dl.from("shop_prodotti_categorie").delete().then(() => {}); } catch (e) { senzaFiltri = e.message; }
  c("il finto cancella solo dal legame (e solo con un filtro): prodotti no", [true, true], [/cancella/.test(lancio ?? ""), /senza filtri/.test(senzaFiltri ?? "")]);

  // ── la foto della categoria: categoria_foto ──
  // tre misure, come le foto dei prodotti (T08): 480, 960 e 1600 px; foto_path riceve la 960
  const PATH = "foto/abcdefghijkl.webp", PATH2 = "foto/mnopqrstuvwx.jpg";
  const PATH480 = "foto/aaaaaaaaaaaa.webp", PATH1600 = "foto/cccccccccccc.webp", PATH2_480 = "foto/dddddddddddd.jpg", PATH2_1600 = "foto/eeeeeeeeeeee.jpg";
  const cf = (extra = {}) => ({ azione: "categoria_foto", categoriaId: C1, path480: PATH480, path960: PATH, path1600: PATH1600, alt: "Scaffale con tre patch di prova", versione: ISTANTE, ...extra });
  const media = (db) => db.tabelle.shop_media.filter((m) => m.categoria_id === C1);
  const g0 = await esegui(cf(), { porte: { guardia: guardiaNo(403) } });
  c("categoria_foto: guardia negata (403) → nessuna chiamata", [403, 0], [g0.stato, g0.db.chiamate]);
  const f1 = await esegui(cf());
  c("foto: la categoria ha il percorso nuovo (è la colonna che le viste pubbliche leggono)", [200, true, PATH, ADESSO], [f1.stato, f1.corpo.ok, cat(f1.db, C1).foto_path, cat(f1.db, C1).aggiornato_il]);
  c("…e una riga in shop_media (slot principale, della categoria, con il testo alternativo e il percorso)", [1, "principale", "foto", PATH, "Scaffale con tre patch di prova", null], ((m) => [media(f1.db).length, m?.slot, m?.tipo, m?.path_960, m?.alt, m?.rimosso_il])(media(f1.db)[0]));
  c("…con TUTTE E TRE le misure nella riga di shop_media", [PATH480, PATH, PATH1600], ((m) => [m?.path_480, m?.path_960, m?.path_1600])(media(f1.db)[0]));
  c("…la risposta porta id, slug e la versione riletta", [C1, "categoria-prova", ADESSO], [f1.corpo.categoria?.id, f1.corpo.categoria?.slug, f1.corpo.categoria?.versione]);
  c("…lo storico ha UNA riga: campo foto, prima vuoto, dopo il percorso, chi", [[{ entita: "categoria", entita_id: C1, campo: "foto", prima: null, dopo: PATH, chi: "Titolare Prova" }]],
    [f1.db.tabelle.shop_storico.map(({ entita, entita_id, campo, prima, dopo, chi }) => ({ entita, entita_id, campo, prima, dopo, chi }))]);
  const sost = fintoDb({ tabelle: tabelle() });
  await K.gestisciPOST(post(cf()), porte({ db: sost }).d);
  const f2 = await esegui(cf({ path480: PATH2_480, path960: PATH2, path1600: PATH2_1600, alt: "Altra foto di prova", versione: ADESSO }), { db: sost });
  c("seconda foto: la prima si «rimuove» (rimosso_il, mai cancellata), la nuova è l'unica attiva", [2, 1, ADESSO, PATH2], [media(sost).length, media(sost).filter((m) => !m.rimosso_il).length, media(sost).find((m) => m.path_960 === PATH)?.rimosso_il, cat(sost, C1).foto_path]);
  c("…la nuova ha le sue tre misure (foto_path = la 960)", [PATH2_480, PATH2, PATH2_1600], ((m) => [m?.path_480, m?.path_960, m?.path_1600])(media(sost).find((m) => !m.rimosso_il)));
  c("…lo storico dice com'era prima (il vecchio percorso)", [PATH, PATH2], [sost.tabelle.shop_storico[1]?.prima, sost.tabelle.shop_storico[1]?.dopo]);
  const storti = [["con ..", "foto/../altro.webp"], ["di un video", "video/abcdefghijkl.mp4"], ["di una copertina", "copertina/abcdefghijkl.jpg"], ["con il nome del file", "foto/capelli-mario.jpg"], ["troppo corto", "foto/abc.webp"], ["con i segni sbagliati (maiuscole)", "foto/ABCDEFGHIJKL.webp"], ["con indirizzo", "https://sito.test/foto/abcdefghijkl.webp"], ["che non è testo", 5], ["mancante", undefined]];
  const casiPercorso = ["path480", "path960", "path1600"].flatMap((k) => storti.map(([nome, v]) => [`${k} ${nome}`, { [k]: v }]));
  for (const [nome, extra] of [...casiPercorso,
    ["senza testo alternativo", { alt: undefined }], ["testo alternativo vuoto", { alt: "   " }], ["testo alternativo oltre 125", { alt: "x".repeat(126) }], ["testo alternativo non testo", { alt: 5 }], ["testo con un prezzo accanto a Invisible Derm", { alt: "Invisible Derm a 3.900 euro" }], ["categoria non UUID", { categoriaId: "x" }], ["senza versione", { versione: undefined }]]) {
    const r = await esegui(cf(extra));
    c(`foto con ${nome} → 400, niente scritto, nessuna chiamata`, [400, 0, 0], [r.stato, r.db.scritture.length, r.db.chiamate]);
  }
  const av = await esegui(cf({ alt: "Il kit premium di prova" }));
  c("testo con una parola da non usare: si salva ma la risposta avvisa", [200, true], [av.stato, Array.isArray(av.corpo.avvisi) && av.corpo.avvisi.length > 0 && /premium/.test(av.corpo.avvisi[0])]);
  const pulito = await esegui(cf());
  c("testo pulito: nessun avviso", [], pulito.corpo.avvisi);
  const fv = await esegui(cf({ versione: "2026-01-01T00:00:00.000Z" }));
  c("versione vecchia → 409, niente scritto", [409, "conflitto", 0], [fv.stato, fv.corpo.motivo, fv.db.scritture.length]);
  const fn = await esegui(cf({ categoriaId: uuid(0x1ee) }));
  c("categoria che non c'è → 404", [404, "non_trovato"], [fn.stato, fn.corpo.motivo]);
  const fcorsa = await esegui(cf(), { db: fintoDb({ tabelle: tabelle(), prima: { "shop_categorie.update": (t) => { t.shop_categorie.find((x) => x.id === C1).aggiornato_il = "2026-11-20T11:00:00.000Z"; } } }) });
  c("categoria cambiata un istante prima dello scambio → 409, nessuna riga in shop_media", [409, 0], [fcorsa.stato, media(fcorsa.db).length]);
  const fm = await esegui(cf(), { db: fintoDb({ tabelle: tabelle(), mancante: true }) });
  c("S1 non applicata → 409 migrazione", [409, "migrazione"], [fm.stato, fm.corpo.motivo]);
}
