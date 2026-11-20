/** ── NEGOZIO · T09 · IL SERVER DEGLI INTERRUTTORI ──────────────────────────
 *  `src/crm/negozio/interruttori.server.ts`: `GET ?interruttori` e `interruttore_imposta` (`catalogo_sito`: codice|cms,
 *  `giacenza_bassa`: intero). Passa SOLO da `shop_impostazione_imposta` (confronto-e-scambio sul valore atteso, riga di
 *  storico scritta dal database). D26: `cms` solo se il cancello dice sì; `codice` sempre. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, prodottoProva, varianteProva, mediaProva, uuid } from "./dati.mjs";
import { porte, post, get, leggi, guardiaNo, scrittureDirette } from "./_server.mjs";

const P2 = uuid(0x202), P3 = uuid(0x203);
/** Due prodotti pubblicati con la foto principale (più la bozza di sempre). */
const duePubblicati = (extra = {}) => {
  const t = tabelleProva();
  t.shop_prodotti.push(prodottoProva({ id: P2, sku: "PROVA-003", slug: "terzo" }));
  t.shop_media.push(mediaProva({ id: uuid(0x402), prodotto_id: P2 }));
  return { ...t, ...extra };
};
const conCms = (t) => ({ ...t, shop_impostazioni: t.shop_impostazioni.map((r) => (r.chiave === "catalogo_sito" ? { ...r, valore: "cms" } : r)) });
const FATTI_R1 = () => ({ bannerPresente: true });
const FATTI_TUTTI = () => ({ bannerPresente: true, pagamentoIncassa: true, spedizioneResi: true, emailConferma: true, migrazioneOrdini: true });

export async function prove(mod, { c, gruppo, radice }) {
  const I = mod["negozio/interruttori.server"];
  gruppo("NEGOZIO · IL SERVER DEGLI INTERRUTTORI (20/11/2026)");
  const esegui = async (corpo, opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: opz.tabelle ?? duePubblicati() });
    const p = porte({ db, fattiEsterni: FATTI_R1, ...opz.porte });
    const r = opz.get ? await I.gestisciGET(get(corpo), p.d) : await I.gestisciPOST(post(corpo), p.d);
    return { db, log: p.log, ...(await leggi(r)) };
  };
  const imposta = (chiave, valore, atteso) => ({ azione: "interruttore_imposta", chiave, valore, atteso });
  const valoreDi = (db, chiave) => db.tabelle.shop_impostazioni.find((r) => r.chiave === chiave)?.valore;

  // ── la guardia ──
  for (const stato of [401, 403]) {
    const g = await esegui("interruttori", { get: true, porte: { guardia: guardiaNo(stato) } });
    const p = await esegui(imposta("catalogo_sito", "codice", "cms"), { porte: { guardia: guardiaNo(stato) } });
    c(`guardia negata (${stato}) in lettura e in scrittura: zero chiamate al database e al cancello`, [stato, stato, 0, 0], [g.stato, p.stato, g.db.chiamate, p.db.chiamate]);
  }

  // ── la lettura ──
  const l = await esegui("interruttori", { get: true });
  c("GET ?interruttori: i due valori e le condizioni del cancello", [200, "codice", 3, 7, false], [l.stato, l.corpo.interruttori?.catalogo_sito?.valore, l.corpo.interruttori?.giacenza_bassa?.valore, l.corpo.condizioni?.righe?.length, l.corpo.condizioni?.puoAprire]);
  c("…nel R1 (2 pubblicati con foto, banner presente) le prime due e il banner sono vere, le altre quattro non valutabili", [["catalogo_reale", "foto_vere", "banner_consenso"], 4], [l.corpo.condizioni.righe.filter((x) => x.ok).map((x) => x.chiave), l.corpo.condizioni.righe.filter((x) => !x.valutabile).length]);
  const sf = await esegui("interruttori", { get: true, tabelle: (() => { const t = duePubblicati(); t.shop_media = t.shop_media.map((m) => (m.prodotto_id === P2 ? { ...m, rimosso_il: "2026-11-20T09:00:00.000Z" } : m)); return t; })() });
  c("una foto principale rimossa non conta: il prodotto è «senza foto»", [false, false], [sf.corpo.condizioni.righe.find((x) => x.chiave === "foto_vere").ok, sf.corpo.condizioni.righe.find((x) => x.chiave === "catalogo_reale").ok]);
  const pers = await esegui("interruttori", { get: true, tabelle: (() => { const t = duePubblicati(); t.shop_media = t.shop_media.map((m) => (m.prodotto_id === P2 ? { ...m, ritrae_persone: true, liberatoria_ok: false } : m)); return t; })() });
  c("una foto principale con una persona senza liberatoria non conta (il pubblico non la vede)", false, pers.corpo.condizioni.righe.find((x) => x.chiave === "foto_vere").ok);
  const bz = await esegui("interruttori", { get: true, tabelle: (() => { const t = duePubblicati(); t.shop_prodotti.push(prodottoProva({ id: P3, sku: "PROVA-004", slug: "quarto", stato: "archiviato" })); return t; })() });
  c("un archiviato non conta fra i pubblicati", true, bz.corpo.condizioni.righe.find((x) => x.chiave === "foto_vere").ok);
  const altro = await esegui("categorie", { get: true });
  // T32 (18): chiudere non deve mai dipendere dalle condizioni. Se le query del cancello falliscono, lo stato aperto/chiuso arriva lo stesso.
  for (const tab of ["shop_prodotti", "shop_media"]) {
    const gc = await esegui("interruttori", { get: true, db: fintoDb({ tabelle: conCms(tabelleProva()), errori: { [`${tab}.select`]: { error: { code: "57P01", message: "PROVA condizioni" } } } }) });
    c(`GET ?interruttori con la lettura di ${tab} in errore: 200, l'interruttore c'è, condizioni senza righe e «non si apre»`, [200, "cms", 0, false, true],
      [gc.stato, gc.corpo.interruttori?.catalogo_sito?.valore, gc.corpo.condizioni?.righe?.length, gc.corpo.condizioni?.puoAprire, typeof gc.corpo.condizioni?.avviso === "string"]);
    c("…e nella risposta non esce il testo dell'errore", false, JSON.stringify(gc.corpo).includes("PROVA condizioni"));
  }
  const gl = await esegui("interruttori", { get: true, db: fintoDb({ tabelle: conCms(tabelleProva()), errori: { "shop_impostazioni.select": { error: { code: "57P01", message: "PROVA lettura" } } } }) });
  c("se a fallire è la lettura dell'interruttore stesso, la risposta resta un errore (non si inventa uno stato)", true, gl.stato >= 500);
  c("GET senza ?interruttori → 400, nessuna chiamata", [400, 0], [altro.stato, altro.db.chiamate]);

  // ── aprire: D26 ──
  const a = await esegui(imposta("catalogo_sito", "cms", "codice"));
  c("cms con il cancello chiuso (R1) → 409 «cancello» con l'elenco di ciò che manca, il valore non cambia", [409, false, "cancello", "codice"], [a.stato, a.corpo.ok, a.corpo.motivo, valoreDi(a.db, "catalogo_sito")]);
  c("…la risposta porta le righe del cancello e la frase nomina quel che manca", [7, true, true], [a.corpo.condizioni?.righe?.length, /cassa/.test(a.corpo.frase), /pagamento|spedizion|email/i.test(a.corpo.frase)]);
  c("…nessuna scrittura, nessuna chiamata alla funzione di scambio", [0, []], [a.db.scritture.length, a.db.registro.filter((q) => q.nome === "shop_impostazione_imposta").length ? ["chiamata"] : []]);
  const uno = await esegui(imposta("catalogo_sito", "cms", "codice"), { tabelle: tabelleProva(), porte: { fattiEsterni: FATTI_TUTTI } });
  c("tutto vero ma un solo pubblicato con foto → rifiutato", [409, "cancello", "codice"], [uno.stato, uno.corpo.motivo, valoreDi(uno.db, "catalogo_sito")]);
  const nb = await esegui(imposta("catalogo_sito", "cms", "codice"), { porte: { fattiEsterni: () => ({ ...FATTI_TUTTI(), bannerPresente: false }) } });
  c("tutto vero ma il banner no → rifiutato", [409, "cancello"], [nb.stato, nb.corpo.motivo]);
  const ok = await esegui(imposta("catalogo_sito", "cms", "codice"), { porte: { fattiEsterni: FATTI_TUTTI } });
  c("tutte le condizioni vere (come sarà col rilascio della cassa) → cms", [200, true, "cms", true], [ok.stato, ok.corpo.ok, valoreDi(ok.db, "catalogo_sito"), ok.corpo.cambiato]);
  c("…lo storico ha UNA riga (la scrive la funzione SQL): chiave, prima, dopo, chi", [[{ entita: "impostazione", entita_id: "catalogo_sito", campo: "valore", prima: "codice", dopo: "cms", chi: "Titolare Prova" }]],
    [ok.db.tabelle.shop_storico.map(({ entita, entita_id, campo, prima, dopo, chi }) => ({ entita, entita_id, campo, prima, dopo, chi }))]);
  c("…nel registro: la sola scrittura è la funzione shop_impostazione_imposta", [["shop_impostazione_imposta"], []], [ok.db.registro.filter((q) => q.op === "rpc").map((q) => q.nome), scrittureDirette(ok.db)]);

  // ── chiudere: sempre ──
  const ch = await esegui(imposta("catalogo_sito", "codice", "cms"), { tabelle: conCms(tabelleProva()) });
  c("tornare a «codice» si può sempre, anche con il catalogo vuoto e senza banner", [200, "codice", 1], [ch.stato, valoreDi(ch.db, "catalogo_sito"), ch.db.tabelle.shop_storico.length]);
  const chb = await esegui(imposta("catalogo_sito", "codice", "cms"), { tabelle: conCms(tabelleProva()), porte: { fattiEsterni: () => ({ bannerPresente: false }) } });
  c("…senza nemmeno chiedere i fatti del cancello", 200, chb.stato);
  let chiesti = 0;
  await esegui(imposta("catalogo_sito", "codice", "cms"), { tabelle: conCms(tabelleProva()), porte: { fattiEsterni: () => { chiesti++; return {}; } } });
  c("…il cancello non viene nemmeno valutato per chiudere", 0, chiesti);

  // ── il valore atteso ──
  const vec = await esegui(imposta("catalogo_sito", "codice", "cms"));
  c("valore atteso vecchio (qualcuno ha già cambiato) → 409 conflitto, con il valore vero, niente scritto", [409, "conflitto", "codice", 0], [vec.stato, vec.corpo.motivo, vec.corpo.valore, vec.db.scritture.length]);
  const cor = await esegui(imposta("catalogo_sito", "cms", "codice"), { porte: { fattiEsterni: FATTI_TUTTI }, db: fintoDb({ tabelle: duePubblicati(), prima: { "rpc.shop_impostazione_imposta": (t) => { t.shop_impostazioni[0].valore = "cms"; } } }) });
  c("cambiato da un altro un attimo prima dello scambio (la funzione risponde false) → 409, non «ok»", [409, "conflitto"], [cor.stato, cor.corpo.motivo]);
  const senza = await esegui({ azione: "interruttore_imposta", chiave: "catalogo_sito", valore: "cms" });
  c("senza il valore atteso → 400, nessuna chiamata", [400, 0], [senza.stato, senza.db.chiamate]);
  const uguale = await esegui(imposta("catalogo_sito", "codice", "codice"));
  c("stesso valore → ok «non cambiato», nessuna scrittura, nessuna riga di storico", [200, false, 0, 0], [uguale.stato, uguale.corpo.cambiato, uguale.db.scritture.length, uguale.db.tabelle.shop_storico.length]);
  const manca = await esegui(imposta("catalogo_sito", "cms", "codice"), { tabelle: { ...duePubblicati(), shop_impostazioni: [] }, porte: { fattiEsterni: FATTI_TUTTI } });
  c("interruttore che non esiste nel database (seme mancante) → 404, non lo crea", [404, 0], [manca.stato, manca.db.tabelle.shop_impostazioni.length]);

  // ── giacenza bassa e valori storti ──
  const g = await esegui(imposta("giacenza_bassa", 5, 3));
  c("giacenza_bassa 3 → 5, nello storico", [200, 5, 1, 3, 5], [g.stato, valoreDi(g.db, "giacenza_bassa"), g.db.tabelle.shop_storico.length, g.db.tabelle.shop_storico[0]?.prima, g.db.tabelle.shop_storico[0]?.dopo]);
  c("…il cancello non c'entra: nessuna lettura di prodotti", false, g.db.registro.some((q) => q.tab === "shop_prodotti"));
  c("giacenza_bassa 0 si può (nessun avviso)", 200, (await esegui(imposta("giacenza_bassa", 0, 3))).stato);
  for (const [nome, corpo] of [
    ["catalogo_sito «boh»", imposta("catalogo_sito", "boh", "codice")], ["catalogo_sito vero", imposta("catalogo_sito", true, "codice")], ["catalogo_sito numero", imposta("catalogo_sito", 1, "codice")],
    ["atteso «boh»", imposta("catalogo_sito", "cms", "boh")], ["atteso nullo", imposta("catalogo_sito", "cms", null)],
    ["giacenza_bassa «5» (testo)", imposta("giacenza_bassa", "5", 3)], ["giacenza_bassa negativa", imposta("giacenza_bassa", -1, 3)], ["giacenza_bassa decimale", imposta("giacenza_bassa", 2.5, 3)], ["giacenza_bassa enorme", imposta("giacenza_bassa", 100000, 3)], ["giacenza_bassa con atteso storto", imposta("giacenza_bassa", 5, "x")],
    ["chiave sconosciuta", imposta("cassa_sito", "stripe", "codice")], ["chiave non testo", imposta(5, "cms", "codice")],
  ]) {
    const r = await esegui(corpo);
    c(`${nome} → 400, nessuna chiamata, niente scritto`, [400, 0, 0], [r.stato, r.db.chiamate, r.db.scritture.length]);
  }

  // ── migrazione, guasti, corpo storto, registri ──
  const mm = await esegui("interruttori", { get: true, db: fintoDb({ tabelle: duePubblicati(), mancante: true }) });
  const mp = await esegui(imposta("catalogo_sito", "codice", "cms"), { db: fintoDb({ tabelle: duePubblicati(), mancante: true }) });
  c("S1 non applicata → 409 motivo «migrazione» in lettura e in scrittura", [[409, "migrazione"], [409, "migrazione"]], [[mm.stato, mm.corpo.motivo], [mp.stato, mp.corpo.motivo]]);
  const gu = await esegui(imposta("catalogo_sito", "codice", "cms"), { tabelle: conCms(tabelleProva()), db: fintoDb({ tabelle: conCms(tabelleProva()), errori: { "rpc.shop_impostazione_imposta": { error: { code: "XX003", message: "PROVA riga intera" } } } }) });
  c("errore della funzione → 500 generico, log col solo codice", [500, ["scambio XX003"], false], [gu.stato, gu.log, /PROVA|XX003/.test(JSON.stringify(gu.corpo))]);
  for (const [nome, corpo] of [["JSON rotto", "{no"], ["lista", "[]"], ["azione sconosciuta", { azione: "interruttore_boh" }]]) {
    const r = await esegui(corpo);
    c(`corpo storto (${nome}) → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }
  for (const nome of ["constructor", "toString", "__proto__"]) {
    const a1 = await esegui({ azione: nome, chiave: "catalogo_sito", valore: "codice", atteso: "cms" });
    const a2 = await esegui(imposta(nome, "codice", "cms"));
    c(`azione e chiave «${nome}» → 400, nessuna chiamata`, [[400, "azione_sconosciuta", 0], [400, "valore", 0]], [[a1.stato, a1.corpo.motivo, a1.db.chiamate], [a2.stato, a2.corpo.motivo, a2.db.chiamate]]);
  }
  for (const nome of ["constructor", "toString", "interruttore_boh", "", undefined, null, 5, "interruttore_imposta "]) {
    const db = fintoDb({ tabelle: duePubblicati() });
    let errore = null;
    try { await I.eseguiInterruttori(nome, { chiave: "giacenza_bassa", valore: 5, atteso: 3 }, "Chi", { ...porte({ db }).d, fattiEsterni: FATTI_R1 }); } catch (e) { errore = e; }
    c(`eseguiInterruttori(${JSON.stringify(nome)}) → rifiuto esplicito 400 azione_sconosciuta, l'interruttore non cambia (database mai toccato)`, [400, "azione_sconosciuta", 0], [errore?.stato, errore?.motivo, db.chiamate]);
  }
  const sorg = readFileSync(join(radice, "src/crm/negozio/interruttori.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il sorgente non scrive mai direttamente: niente .insert( .update( .upsert( .delete(", [], [".insert(", ".update(", ".upsert(", ".delete("].filter((t) => sorg.includes(t)));
  c("…e passa da shop_impostazione_imposta", true, sorg.includes("shop_impostazione_imposta"));
  c("le azioni del modulo", ["interruttore_imposta"], [...I.AZIONI_INTERRUTTORI]);
}
