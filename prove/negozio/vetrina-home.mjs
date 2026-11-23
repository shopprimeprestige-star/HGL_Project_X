/** ── VETRINA V1 · T76 · LA VETRINA DELLA HOME E L'HERO (D78, D96; criteri V1-H2) ─
 *  `src/shop/cms/vetrina-home.ts`: quali prodotti vanno in «Da qui si parte» (fino a 6 patch, in ordine alfabetico, meno di 2 = la vetrina
 *  non si monta), quante colonne, e come è fatto l'hero (una o due colonne, ritratto sì o no). Dati inventati, nessuna rete.
 *  Si prova ogni caso del piano: 0, 1, 2, 6, 7 e più patch; patch senza foto o senza prezzo; Invisible Derm (anche se fosse una «patch»);
 *  ordine alfabetico (maiuscole, accenti, numeri, parità di nome); ordine dell'ingresso ininfluente; firmatario non confermato. */
import { CATALOGO, CATALOGO_SENZA_FOTO, CATALOGO_UNA_FOTO, INVISIBLE_DERM, SCENARIO_50, trovaParoleVietate } from "./_dati-vetrina.mjs";

const copia = (x) => structuredClone(x);
const patchCon = (nome, slug, extra = {}) => ({ ...copia(CATALOGO.find((p) => p.slug === "patch-prova-delta")), nome, slug, ...extra });

export async function prove(mod, { c, gruppo }) {
  gruppo("VETRINA V1 · T76 · LA VETRINA DELLA HOME E L'HERO (23/11/2026)");
  const H = mod["shop/cms/vetrina-home"];
  const K = mod["shop/cms/vetrina-card"];
  c("il modulo esporta le funzioni del contratto e il tetto della vetrina", ["MAX_VETRINA", "colonneVetrina", "pianoHero", "scegliVetrina"], Object.keys(H).sort());
  c("il tetto della vetrina è 6 (D78)", 6, H.MAX_VETRINA);

  // ── scegliVetrina: sul catalogo di prova ──
  const v = H.scegliVetrina(CATALOGO);
  c("catalogo di prova: le 5 patch, in ordine alfabetico del nome", ["patch-prova-alfa", "patch-prova-beta", "patch-prova-delta", "patch-prova-epsilon", "patch-prova-gamma"], v.map((k) => k.slug));
  c("mai Invisible Derm, mai cura, mai kit", [], v.filter((k) => /derm|shampoo|balsamo|kit/.test(k.slug)));
  c("le voci sono le card leggere (stesso risultato di cardDaPubblico)", v, v.map((k) => K.cardDaPubblico(CATALOGO.find((p) => p.slug === k.slug))));
  c("la copia JSON è uguale (il loader la manda al browser)", v, JSON.parse(JSON.stringify(v)));
  c("tutte le voci hanno foto e prezzo (senza, il prodotto non è in vetrina)", [], v.filter((k) => !k.foto || k.prezzoCent === null));
  c("una patch tutta esaurita resta in vetrina (D78 dice «patch pubblicate»: la card porta alla scheda)", true, v.some((k) => k.slug === "patch-prova-epsilon" && !k.disponibile));
  c("il primo è «Patch di prova Alfa»: il primo alfabetico del catalogo di prova", "Patch di prova Alfa", v[0].nome);

  // ── quanti ──
  const trePatch = CATALOGO.filter((p) => ["patch-prova-alfa", "patch-prova-beta", "patch-prova-gamma"].includes(p.slug));
  c("0 patch (elenco vuoto) → null: la vetrina non si monta", null, H.scegliVetrina([]));
  c("1 patch sola → null", null, H.scegliVetrina([CATALOGO[0]]));
  c("1 patch con tutto il resto del catalogo (cura, kit, Invisible Derm) → null", null, H.scegliVetrina([CATALOGO[0], ...CATALOGO.filter((p) => p.tipo !== "patch")]));
  c("2 patch → 2 voci", 2, H.scegliVetrina([CATALOGO[0], CATALOGO[1]]).length);
  c("3 patch → 3 voci", 3, H.scegliVetrina(trePatch).length);
  const molte = SCENARIO_50.filter((p) => p.tipo === "patch");
  c("25 patch → 6 voci (il tetto)", 6, H.scegliVetrina(molte).length);
  c("25 patch → le prime 6 per nome", ["prodotto-prova-01", "prodotto-prova-03", "prodotto-prova-05", "prodotto-prova-07", "prodotto-prova-09", "prodotto-prova-11"], H.scegliVetrina(molte).map((k) => k.slug));
  const sette = ["A", "B", "C", "D", "E", "F", "G"].map((l) => patchCon(`Patch ${l}`, `patch-${l.toLowerCase()}`));
  c("esattamente 6 patch → 6; 7 patch → le prime 6 (la settima non c'è)", [6, 6, ["patch-a", "patch-b", "patch-c", "patch-d", "patch-e", "patch-f"]], [H.scegliVetrina(sette.slice(0, 6)).length, H.scegliVetrina(sette).length, H.scegliVetrina(sette).map((k) => k.slug)]);
  c("5 patch e un'altra senza foto → 5 (quella senza foto non conta nemmeno per il minimo)", 5, H.scegliVetrina([...CATALOGO.filter((p) => p.tipo === "patch"), patchCon("Zeta", "zeta", { media: [] })]).length);

  // ── chi non può starci ──
  c("senza nessuna foto (nessun prodotto ha il riquadro) → null", null, H.scegliVetrina(CATALOGO_SENZA_FOTO));
  c("con la sola foto principale le 5 patch ci sono", 5, H.scegliVetrina(CATALOGO_UNA_FOTO).length);
  c("una patch senza foto principale (solo la scala) salta, le altre restano", ["patch-a", "patch-b"], H.scegliVetrina([patchCon("Patch A", "patch-a"), patchCon("Patch B", "patch-b"), patchCon("Patch 0 senza foto", "patch-0", { media: copia(patchCon("x", "x").media.filter((m) => m.slot === "scala")) })]).map((k) => k.slug));
  c("una patch senza prezzo (dato storto) salta", ["patch-a", "patch-b"], H.scegliVetrina([patchCon("Patch A", "patch-a"), patchCon("Patch B", "patch-b"), patchCon("Patch 0 senza prezzo", "patch-0", { prezzoDaCent: null })]).map((k) => k.slug));
  const dermPatch = { ...copia(INVISIBLE_DERM), tipo: "patch" };
  c("Invisible Derm, anche se il tipo fosse «patch», non entra mai", ["patch-a", "patch-b"], H.scegliVetrina([dermPatch, patchCon("Patch A", "patch-a"), patchCon("Patch B", "patch-b")]).map((k) => k.slug));
  c("Invisible Derm con un prezzo arrivato per errore: non entra e il prezzo non esce", [["patch-a", "patch-b"], false], (() => {
    const storta = { ...copia(dermPatch), acquistabile: true, prezzoDaCent: 12300 };
    const r = H.scegliVetrina([storta, patchCon("Patch A", "patch-a"), patchCon("Patch B", "patch-b")]);
    return [r.map((k) => k.slug), JSON.stringify(r).includes("12300")];
  })());
  c("una patch con il nome di Invisible Derm (e basta) non entra", ["patch-a", "patch-b"], H.scegliVetrina([patchCon("Invisible Derm 2", "protocollo-nuovo"), patchCon("Patch A", "patch-a"), patchCon("Patch B", "patch-b")]).map((k) => k.slug));
  c("2 patch di cui una è Invisible Derm → null", null, H.scegliVetrina([dermPatch, patchCon("Patch A", "patch-a")]));

  // ── l'ordine ──
  const alla = (nomi) => H.scegliVetrina(nomi.map((n, i) => patchCon(n, `p-${i}-${n.toLowerCase().replace(/\W+/g, "-")}`))).map((k) => k.nome);
  c("alfabetico senza badare alle maiuscole", ["Alfa", "beta", "Gamma", "zeta"], alla(["zeta", "Gamma", "beta", "Alfa"]));
  c("alfabetico senza badare agli accenti (l'accento non spinge in fondo)", ["Alfa", "Àncora", "Beta", "Zeta"], alla(["Zeta", "Beta", "Àncora", "Alfa"]));
  c("i numeri si ordinano come numeri («2» prima di «10»)", ["Patch 2", "Patch 10", "Patch 11"], alla(["Patch 11", "Patch 2", "Patch 10"]));
  c("l'ordine dell'ingresso non conta", true, JSON.stringify(H.scegliVetrina([...CATALOGO].reverse())) === JSON.stringify(H.scegliVetrina(CATALOGO)));
  c("l'ordine dell'ingresso non conta nemmeno oltre il tetto", true, JSON.stringify(H.scegliVetrina([...molte].reverse())) === JSON.stringify(H.scegliVetrina(molte)));
  const gemelle = [patchCon("Stessa", "z-ultima"), patchCon("Stessa", "a-prima"), patchCon("Stessa", "m-meta")];
  c("due nomi uguali: decide l'indirizzo, sempre lo stesso ordine", ["a-prima", "m-meta", "z-ultima"], H.scegliVetrina(gemelle).map((k) => k.slug));
  const stessoNome = [patchCon("alfa", "z-minuscola"), patchCon("Alfa", "a-maiuscola"), patchCon("Àlfa", "m-accento")];
  c("nomi uguali a parte maiuscole e accenti: sono pari, decide l'indirizzo", ["a-maiuscola", "m-accento", "z-minuscola"], H.scegliVetrina(stessoNome).map((k) => k.slug));
  c("…anche con l'ingresso girato", ["a-prima", "m-meta", "z-ultima"], H.scegliVetrina([...gemelle].reverse()).map((k) => k.slug));

  // ── ingressi storti ──
  c("ingressi che non sono elenchi → null", [null, null, null, null], [H.scegliVetrina(null), H.scegliVetrina(undefined), H.scegliVetrina("patch"), H.scegliVetrina({})]);
  c("voci rotte nell'elenco si saltano (non lanciano)", ["patch-a", "patch-b"], H.scegliVetrina([null, 5, {}, { tipo: "patch" }, patchCon("Patch A", "patch-a"), patchCon("Patch B", "patch-b")]).map((k) => k.slug));
  const prima = JSON.stringify(CATALOGO);
  H.scegliVetrina(CATALOGO);
  c("l'ingresso non cambia (e i dati congelati non fanno lanciare)", prima, JSON.stringify(CATALOGO));
  c("nessuna parola vietata nell'uscita", [], trovaParoleVietate(JSON.stringify(v)));

  // ── colonneVetrina (SPEC: 2 sul telefono; 4 prodotti = 4 colonne, 5-6 = 3) ──
  c("0 e 1 prodotti: nessuna colonna (non si monta)", [null, null], [H.colonneVetrina(0), H.colonneVetrina(1)]);
  c("2 prodotti: 2 colonne ovunque", { telefono: 2, computer: 2 }, H.colonneVetrina(2));
  c("3 prodotti: 3 colonne sul computer", { telefono: 2, computer: 3 }, H.colonneVetrina(3));
  c("4 prodotti: 4 colonne sul computer", { telefono: 2, computer: 4 }, H.colonneVetrina(4));
  c("5 prodotti: 3 colonne sul computer", { telefono: 2, computer: 3 }, H.colonneVetrina(5));
  c("6 prodotti: 3 colonne sul computer", { telefono: 2, computer: 3 }, H.colonneVetrina(6));
  c("il telefono ha sempre 2 colonne", [2, 2, 2, 2, 2], [2, 3, 4, 5, 6].map((n) => H.colonneVetrina(n).telefono));
  c("oltre il tetto (7) il risultato è quello del tetto: 3 colonne", { telefono: 2, computer: 3 }, H.colonneVetrina(7));
  c("numero storto (NaN, decimale, testo, negativo, infinito) → null", [null, null, null, null, null], [NaN, 4.5, "4", -3, Infinity].map(H.colonneVetrina));
  c("le colonne di tutte le vetrine possibili: ogni riga è piena o quasi (nessun prodotto solo in fondo)", [], [2, 3, 4, 5, 6].filter((n) => n % H.colonneVetrina(n).computer === 1));

  // ── pianoHero (D96) ──
  const FOTO = "https://prova.test/shop-media/slot-hero.webp";
  const RITRATTO = "https://prova.test/shop-media/slot-titolare.webp";
  const P = (heroFoto, titolareFoto, firmatario) => H.pianoHero({ heroFoto, titolareFoto, firmatario });
  c("tutto presente: due colonne, ritratto e nome", { colonne: 2, ritratto: true, nome: "Firma di prova" }, P(FOTO, RITRATTO, "Firma di prova"));
  c("il nome si legge senza spazi attorno", "Firma di prova", P(FOTO, RITRATTO, "  Firma di prova \n").nome);
  c("senza foto dell'hero: una colonna centrata (il ritratto resta)", { colonne: 1, ritratto: true, nome: "Firma di prova" }, P(null, RITRATTO, "Firma di prova"));
  c("foto dell'hero vuota, di soli spazi o con segnaposto: una colonna", [1, 1, 1, 1], [P("", RITRATTO, "F").colonne, P("   ", RITRATTO, "F").colonne, P("{{da caricare}}", RITRATTO, "F").colonne, P(undefined, RITRATTO, "F").colonne]);
  c("senza ritratto: spariscono ritratto e nome (resta la riga dello studio)", { colonne: 2, ritratto: false, nome: null }, P(FOTO, null, "Firma di prova"));
  c("senza firmatario: spariscono ritratto e nome", { colonne: 2, ritratto: false, nome: null }, P(FOTO, RITRATTO, null));
  c("firmatario vuoto o di soli spazi: spariscono", [false, false, null, null], [P(FOTO, RITRATTO, "").ritratto, P(FOTO, RITRATTO, "  ").ritratto, P(FOTO, RITRATTO, "").nome, P(FOTO, RITRATTO, "  ").nome]);
  c("firmatario non confermato (segnaposto) non si mostra mai", [false, null, false, null], [P(FOTO, RITRATTO, "{{da confermare: nome}}").ritratto, P(FOTO, RITRATTO, "{{da confermare: nome}}").nome, P(FOTO, RITRATTO, "Mario {{cognome}}").ritratto, P(FOTO, RITRATTO, "Mario {{cognome}}").nome]);
  c("ritratto con la foto vuota o con segnaposto: non si disegna", [false, false, false], [P(FOTO, "", "F").ritratto, P(FOTO, "  ", "F").ritratto, P(FOTO, "{{x}}", "F").ritratto]);
  c("niente di niente: una colonna, nessun ritratto, nessun nome", { colonne: 1, ritratto: false, nome: null }, P(null, null, null));
  c("senza nemmeno l'oggetto: come niente di niente", { colonne: 1, ritratto: false, nome: null }, H.pianoHero(undefined));
  c("valori che non sono testo (numero, oggetto, vero) valgono come assenti", { colonne: 1, ritratto: false, nome: null }, P(5, { src: RITRATTO }, true));
  c("il nome non porta mai parole vietate o segnaposto", [], trovaParoleVietate(JSON.stringify(P(FOTO, RITRATTO, "Firma di prova"))));
}
