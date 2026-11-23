/** ── VETRINA V1 · T78 · I BLOCCHI DELLA SCHEDA: QUALI E IN CHE ORDINE ────────
 *  `src/shop/cms/vetrina-scheda.ts`. Criteri V1-S5 (blocchi sotto l'acquisto, «Scheda tecnica» solo con righe confermate) e
 *  V1-T8 (il box «Non è il prodotto giusto per te?» sta DOPO le FAQ e solo sulle patch; il pop-up d'uscita solo su una patch con
 *  il carrello vuoto). Dati inventati (`_dati-vetrina.mjs`). Il disegno è di T88a/T88b/T97b: qui si prova solo la DECISIONE. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_SENZA_FOTO, INVISIBLE_DERM, TARIFFA_ASSENTE, TARIFFA_OK, TESTI_CONFERMATI_PIENI, trovaParoleVietate } from "./_dati-vetrina.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["shop/cms/vetrina-scheda"];
  gruppo("VETRINA V1 · T78 · BLOCCHI DELLA SCHEDA (23/11/2026)");

  const per = (slug) => CATALOGO.find((p) => p.slug === slug);
  const alfa = per("patch-prova-alfa"); // patch, correlato = shampoo, box
  const beta = per("patch-prova-beta"); // patch, correlato = balsamo
  const gamma = per("patch-prova-gamma"); // patch, nessun correlato
  const shampoo = per("shampoo-prova"); // cura
  const kit = per("kit-prova");
  const ctx = (extra = {}) => ({ testi: TESTI_CONFERMATI_PIENI, tariffa: TARIFFA_OK, cassa: "vecchia", carrelloVuoto: true, ...extra });
  const ids = (p, extra) => S.bloccheScheda(p, ctx(extra)).map((b) => b.id);
  const copia = (x) => structuredClone(x);

  // ── l'ordine ──
  const ORDINE = ["galleria", "acquisto", "colore", "confezione", "comeSiUsa", "schedaTecnica", "faq", "box", "tiServeAnche"];
  c("patch con tutto: galleria, acquisto, colore, confezione, come si usa, scheda tecnica, FAQ, box, «Ti serve anche»", ORDINE, ids(alfa));
  c("il box sta DOPO le FAQ (V1-T8) e dopo la scheda tecnica", [true, true], (() => { const i = ids(alfa); return [i.indexOf("box") > i.indexOf("faq"), i.indexOf("box") > i.indexOf("schedaTecnica")]; })());
  c("«Ti serve anche» sta in fondo, dopo il box", "tiServeAnche", ids(alfa).at(-1));
  c("il blocco d'acquisto viene subito dopo la galleria, prima di ogni sezione", ["galleria", "acquisto"], ids(alfa).slice(0, 2));
  c("nessun blocco recensioni (non esistono in questa commessa)", [], CATALOGO.flatMap((p) => ids(p)).filter((i) => /recension|stelle/i.test(i)));
  c("nessun box fra il prezzo e il bottone: il box non è mai il secondo né il terzo blocco", [], CATALOGO.filter((p) => ids(p).indexOf("box") !== -1 && ids(p).indexOf("box") < 3).map((p) => p.slug));
  c("ogni blocco compare al massimo una volta, per ogni prodotto e ogni contesto", [], (() => {
    const male = [];
    for (const p of CATALOGO) for (const e of [{}, { carrelloVuoto: false }, { tariffa: TARIFFA_ASSENTE }]) {
      const i = ids(p, e);
      if (new Set(i).size !== i.length) male.push(p.slug);
    }
    return male;
  })());
  c("l'ordine è sempre una sotto-sequenza di quello fisso (per tutto il catalogo)", [], CATALOGO.filter((p) => { const i = ids(p).map((x) => ORDINE.indexOf(x)); return i.includes(-1) || i.some((v, k) => k > 0 && v <= i[k - 1]); }).map((p) => p.slug));

  // ── colore: solo patch ──
  c("il colore c'è sulle patch", [true, true, true], [alfa, beta, gamma].map((p) => ids(p).includes("colore")));
  c("il colore non c'è su cura, kit e Invisible Derm", [false, false, false], [shampoo, kit, INVISIBLE_DERM].map((p) => ids(p).includes("colore")));

  // ── box: dopo FAQ, solo patch con `boxConsulenza` ──
  c("patch con `boxConsulenza`: il box c'è", true, ids(alfa).includes("box"));
  c("patch senza `boxConsulenza`: niente box", false, ids({ ...alfa, boxConsulenza: false }).includes("box"));
  c("MAI sulla cura: neppure con `boxConsulenza` vero", false, ids({ ...shampoo, boxConsulenza: true }).includes("box"));
  c("MAI sul kit: neppure con `boxConsulenza` vero", false, ids({ ...kit, boxConsulenza: true }).includes("box"));
  c("MAI su un prodotto che non si compra (Invisible Derm): il box parla proprio di lui", false, ids({ ...INVISIBLE_DERM, tipo: "patch", boxConsulenza: true }).includes("box"));
  c("`boxConsulenza` non vero (null, 1, «sì») non basta: serve `true`", [false, false, false], [null, 1, "sì"].map((v) => ids({ ...alfa, boxConsulenza: v }).includes("box")));
  c("il box dipende dal prodotto, non dal carrello: c'è anche col carrello pieno", true, ids(alfa, { carrelloVuoto: false }).includes("box"));
  c("la cura e il kit, in tutto il catalogo, non hanno mai il box", [], CATALOGO.filter((p) => p.tipo !== "patch" && ids({ ...p, boxConsulenza: true }).includes("box")).map((p) => p.slug));

  // ── «Ti serve anche»: una sola card, mai Invisible Derm ──
  const blocchi = S.bloccheScheda(alfa, ctx());
  c("«Ti serve anche»: una sola card, quella del correlato", [1, "shampoo-prova"], (() => { const b = blocchi.filter((x) => x.id === "tiServeAnche"); return [b.length, b[0].correlato.slug]; })());
  c("senza correlato: nessun blocco", false, ids(gamma).includes("tiServeAnche"));
  const conCorrelato = (correlato) => ids({ ...alfa, correlato }).includes("tiServeAnche");
  const card = (extra) => ({ slug: "balsamo-prova", nome: "Balsamo di prova", prezzoDaCent: 1690, foto: null, ...extra });
  c("correlato normale con prezzo: sì", true, conCorrelato(card()));
  c("MAI Invisible Derm, riconosciuto dal nome", false, conCorrelato(card({ nome: "Invisible Derm di prova", slug: "altro" })));
  c("MAI Invisible Derm, riconosciuto dallo slug", false, conCorrelato(card({ nome: "Un prodotto", slug: "invisible-derm-prova" })));
  c("MAI Invisible Derm, anche scritto «Invisible-Derm» o «InvisibleDerm»", [false, false], ["Invisible-Derm Protocol", "InvisibleDerm"].map((nome) => conCorrelato(card({ nome }))));
  c("un prodotto che contiene il nome ma non comincia così («Solvente per Invisible Derm») non è Invisible Derm", true, conCorrelato(card({ nome: "Solvente per Invisible Derm", slug: "solvente" })));
  c("senza prezzo (`prezzoDaCent` null): niente card, la card ha «Aggiungi»", false, conCorrelato(card({ prezzoDaCent: null })));
  c("il correlato non può essere il prodotto stesso", false, conCorrelato(card({ slug: alfa.slug, nome: alfa.nome })));
  c("tutto il catalogo e tutti i contesti: «Ti serve anche» mai Invisible Derm e al più una volta", [], (() => {
    const male = [];
    for (const p of CATALOGO) for (const e of [{}, { carrelloVuoto: false }]) {
      const b = S.bloccheScheda(p, ctx(e)).filter((x) => x.id === "tiServeAnche");
      if (b.length > 1 || b.some((x) => /^\s*invisib/i.test(x.correlato.nome) || /^invisible-derm/i.test(x.correlato.slug))) male.push(p.slug);
    }
    return male;
  })());
  c("Invisible Derm ha la sua scheda: nessun correlato da proporre nei dati, nessun blocco", false, ids(INVISIBLE_DERM).includes("tiServeAnche"));

  // ── scheda tecnica: solo le righe confermate ──
  const righe = (p) => S.bloccheScheda(p, ctx()).find((b) => b.id === "schedaTecnica")?.righe;
  c("le righe vere passano così come sono", alfa.caratteristiche, righe(alfa));
  const sporca = { ...alfa, caratteristiche: [
    { etichetta: "Peso", valore: "da confermare" },
    { etichetta: "Materiale", valore: "Valore vero" },
    { etichetta: "Misura", valore: "{{misura}}" },
    { etichetta: "Base", valore: "Da Confermare: 10 cm" },
    { etichetta: "Da confermare", valore: "Lace" },
    { etichetta: "", valore: "senza etichetta" },
    { etichetta: "Senza valore", valore: "   " },
    { etichetta: "Colore base", valore: "Nero" },
  ] };
  c("nessuna riga «da confermare» (in qualunque forma), né segnaposto {{…}}, né riga vuota", [{ etichetta: "Materiale", valore: "Valore vero" }, { etichetta: "Colore base", valore: "Nero" }], righe(sporca));
  c("se nessuna riga è confermata, la scheda tecnica non si monta (nessuna tabella vuota)", false, ids({ ...alfa, caratteristiche: [{ etichetta: "Peso", valore: "da confermare" }] }).includes("schedaTecnica"));
  c("nessuna caratteristica: nessun blocco", false, ids({ ...alfa, caratteristiche: [] }).includes("schedaTecnica"));
  c("tutto il catalogo, anche sporco: nessuna parola vietata nelle righe (da confermare, {{…})", [], (() => {
    const male = [];
    for (const p of [...CATALOGO, sporca]) male.push(...trovaParoleVietate(JSON.stringify(righe(p) ?? [])).map((x) => `${p.slug}: ${x}`));
    return male;
  })());
  c("la lista dei blocchi non porta mai «da confermare» né {{, qualunque prodotto", [], (() => {
    const male = [];
    for (const p of [...CATALOGO, sporca]) for (const e of [{}, { carrelloVuoto: false }, { tariffa: TARIFFA_ASSENTE }]) male.push(...trovaParoleVietate(JSON.stringify(S.bloccheScheda(p, ctx(e)))).map((x) => `${p.slug}: ${x}`));
    return male;
  })());

  // ── confezione, come si usa, FAQ ──
  c("«Nella confezione» per patch e cura, «Cosa contiene» per il kit (elenco di testo, D81)", ["confezione", "confezione", "cosaContiene"], [alfa, shampoo, kit].map((p) => S.bloccheScheda(p, ctx()).find((b) => b.id === "confezione").titolo));
  c("la confezione porta le voci del prodotto", alfa.confezione, S.bloccheScheda(alfa, ctx()).find((b) => b.id === "confezione").voci);
  c("senza voci di confezione: nessun blocco", false, ids({ ...alfa, confezione: [] }).includes("confezione"));
  c("senza passi: niente «Come si usa»", false, ids({ ...alfa, passi: [] }).includes("comeSiUsa"));
  c("senza domande: niente FAQ (e il box resta dopo la scheda tecnica)", [false, true], (() => { const i = ids({ ...alfa, faq: [] }); return [i.includes("faq"), i.indexOf("box") > i.indexOf("schedaTecnica")]; })());
  c("il kit non ha colore né box e ha l'elenco di cosa contiene", ["galleria", "acquisto", "confezione", "comeSiUsa", "schedaTecnica", "faq"], ids(kit));
  c("la cura: confezione, come si usa, scheda tecnica, FAQ, niente box né «Ti serve anche»", ["galleria", "acquisto", "confezione", "comeSiUsa", "schedaTecnica", "faq"], ids(shampoo));

  // ── galleria e acquisto ──
  c("senza nessuna foto utilizzabile: nessun blocco galleria (il resto resta)", [false, true], (() => { const i = ids(CATALOGO_SENZA_FOTO.find((p) => p.slug === alfa.slug)); return [i.includes("galleria"), i.includes("acquisto")]; })());
  c("l'acquisto c'è sempre, anche su Invisible Derm, ma dice che non si compra", [true, false], (() => { const b = S.bloccheScheda(INVISIBLE_DERM, ctx()).find((x) => x.id === "acquisto"); return [!!b, b.acquistabile]; })());
  c("patch normale: acquistabile", true, S.bloccheScheda(alfa, ctx()).find((x) => x.id === "acquisto").acquistabile);
  c("riga «Spedizione» solo con una tariffa", [true, false, false], [TARIFFA_OK, TARIFFA_ASSENTE, null].map((tariffa) => S.bloccheScheda(alfa, ctx({ tariffa })).find((x) => x.id === "acquisto").rigaSpedizione));
  c("riga «Spedizione» mai su Invisible Derm (non si compra)", false, S.bloccheScheda(INVISIBLE_DERM, ctx()).find((x) => x.id === "acquisto").rigaSpedizione);
  c("tariffa non valida (stato strano, undefined): nessuna riga", [false, false], [{ stato: "boh" }, undefined].map((tariffa) => S.bloccheScheda(alfa, ctx({ tariffa })).find((x) => x.id === "acquisto").rigaSpedizione));
  c("il contesto può mancare del tutto o essere parziale: nessun errore, nessun pop-up", [true, false], (() => { const a = S.bloccheScheda(alfa, undefined).length > 0; return [a, S.bloccheScheda(alfa, {}).some((b) => b.id === "popup")]; })());
  c("il pop-up non è un blocco della pagina (si monta a parte, `popupPuoMontarsi`)", [], CATALOGO.flatMap((p) => ids(p)).filter((i) => /popup/i.test(i)));
  c("non modifica il prodotto (anche congelato) e dà un elenco nuovo ogni volta", [true, true], (() => {
    const a = S.bloccheScheda(alfa, ctx()), b = S.bloccheScheda(alfa, ctx());
    return [a !== b, JSON.stringify(a) === JSON.stringify(b)];
  })());

  // ── popupPuoMontarsi: solo patch, carrello vuoto ──
  c("patch con il carrello vuoto: il pop-up può montarsi", true, S.popupPuoMontarsi(alfa, true));
  c("patch con il carrello NON vuoto: no (V1-T8)", false, S.popupPuoMontarsi(alfa, false));
  c("carrello non ancora letto (undefined, null): no, nel dubbio non si disturba", [false, false], [S.popupPuoMontarsi(alfa, undefined), S.popupPuoMontarsi(alfa, null)]);
  c("carrello «vuoto» ma non vero (0, «sì»): no, serve `true`", [false, false], [S.popupPuoMontarsi(alfa, 0), S.popupPuoMontarsi(alfa, "sì")]);
  c("cura e kit: mai, nemmeno a carrello vuoto", [false, false], [shampoo, kit].map((p) => S.popupPuoMontarsi(p, true)));
  c("Invisible Derm (non si compra) non lo monta, nemmeno se segnato come patch", false, S.popupPuoMontarsi({ ...INVISIBLE_DERM, tipo: "patch" }, true));
  c("tutto il catalogo: il pop-up sta solo sulle patch che si comprano, col carrello vuoto", [], CATALOGO.filter((p) => S.popupPuoMontarsi(p, true) !== (p.tipo === "patch" && p.acquistabile)).map((p) => p.slug));
  c("tutto il catalogo con il carrello pieno: mai", [], CATALOGO.filter((p) => S.popupPuoMontarsi(p, false)).map((p) => p.slug));
  c("prodotto assente: no, senza errori", [false, false], [S.popupPuoMontarsi(null, true), S.popupPuoMontarsi(undefined, true)]);

  // ── il file: puro e senza frasi ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-scheda.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("riconosce Invisible Derm con `eInvisibleDerm` di pubblico.ts (una regola sola, D40)", true, /import\s*\{[^}]*\beInvisibleDerm\b[^}]*\}\s*from\s*"\.\/pubblico"/.test(senzaCommenti));
  c("nessuna frase scritta nel codice (le parole stanno in testi-shop.ts)", [], (senzaCommenti.match(/"[^"\n]*"/g) ?? []).filter((x) => /\s/.test(x.slice(1, -1)) && !/^"(?:\.\/|@\/)/.test(x)));
  c("niente tempo, caso, rete, schermo", [], ["Date", "setTimeout", "fetch", "window", "document", "Math.random", "console"].filter((k) => new RegExp(`(?<![\\w.])${k.replace(".", "\\.")}(?![\\w])`).test(senzaCommenti)));
}
