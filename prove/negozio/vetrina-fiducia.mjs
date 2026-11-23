/** ── VETRINA V1 · T76 · LE VOCI DI FIDUCIA (D87; criteri V1-H2, V1-T6) ───────────
 *  `src/shop/cms/vetrina-fiducia.ts`: `vociFiducia` dà SOLO le voci vere (spedizione, reso, WhatsApp, pagamenti, studio, consulenza);
 *  `montaBlocco` (la riga sotto il bottone della scheda e del carrello) e `montaFascia` (la fascia della home) dicono se si montano e con
 *  quali voci. Regole del piano: zero voci → il blocco non si monta; una voce sola → la fascia non si monta.
 *  Dati inventati di `_dati-vetrina.mjs`, nessuna rete. Si prova: ogni fonte da sola, tutte insieme, nessuna; la tariffa non confermata
 *  (mai corriere né tempi), il reso del prodotto contro quello del titolare, il testo del titolare svuotato o con segnaposto. */
import { join } from "node:path";
import { build } from "esbuild";
import { TARIFFA_ASSENTE, TARIFFA_OK, TESTI_CONFERMATI_PIENI, TESTI_CONFERMATI_VUOTI, trovaParoleVietate } from "./_dati-vetrina.mjs";

const carica = async (radice, percorso) => {
  const r = await build({ entryPoints: [join(radice, percorso)], bundle: true, write: false, format: "esm", alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const NBSP = " ";
const CASSA_SICURA = { cassa: "stripe", sicuro: true, metodi: ["Carta", "PayPal"] };
const CASSA_VECCHIA = { cassa: "vecchia", sicuro: false, metodi: [] };
const PATCH = { reso: { consentito: true, giorni: 14 } };
const CURA = { reso: { consentito: false, giorni: null } };
const KIT = { reso: { consentito: null, giorni: null } };

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T76 · LE VOCI DI FIDUCIA (23/11/2026)");
  const F = mod["shop/cms/vetrina-fiducia"];
  const { TESTI_SHOP } = await carica(radice, "src/landing/testi-shop.ts");
  c("il modulo esporta le tre funzioni del contratto e i testi provvisori", ["TESTI_FIDUCIA_PROVVISORI", "montaBlocco", "montaFascia", "vociFiducia"], Object.keys(F).sort());
  const id = (voci) => voci.map((v) => v.id);
  const testo = (voci, i) => voci.find((v) => v.id === i)?.testo;
  const STUDIO = TESTI_SHOP.fascia.studio;
  const CONSULENZA = TESTI_SHOP.fascia.consulenza;

  // ── nessuna fonte: restano le due costanti confermate ──
  const nulla = F.vociFiducia({});
  c("senza niente: solo «studio» e «consulenza» (le due costanti confermate), con i testi del copy", [{ id: "studio", testo: STUDIO }, { id: "consulenza", testo: CONSULENZA }], nulla);
  c("senza nemmeno l'oggetto: lo stesso", nulla, F.vociFiducia());
  c("con tutto vuoto o assente: lo stesso (tariffa assente, testi vuoti, cassa vecchia)", nulla, F.vociFiducia({ tariffa: TARIFFA_ASSENTE, testi: TESTI_CONFERMATI_VUOTI, prodotto: KIT, cassa: CASSA_VECCHIA }));
  c("con tutto null: lo stesso", nulla, F.vociFiducia({ tariffa: null, testi: null, prodotto: null, cassa: null }));
  c("i testi di studio e consulenza sono quelli del documento, senza indirizzo", ["Studio a Roma", "Consulenza gratuita, online"], [STUDIO, CONSULENZA]);

  // ── spedizione (D87: tariffa confermata → costo e tempi; altrimenti solo il costo, mai corriere né tempi) ──
  const sp = (tariffa) => F.vociFiducia({ tariffa });
  c("tariffa confermata: costo e tempi (la frase del server, in minuscolo dopo la virgola)", `Spedizione: 4,90${NBSP}€, consegna di prova in 2-4 giorni.`, testo(sp(TARIFFA_OK), "spedizione"));
  c("…con la frase vera del server («Consegna in 2-4 giorni lavorativi dopo la preparazione»)", `Spedizione: 4,90${NBSP}€, consegna in 2-4 giorni lavorativi dopo la preparazione.`, testo(sp({ ...TARIFFA_OK, frase: "Consegna in 2-4 giorni lavorativi dopo la preparazione" }), "spedizione"));
  c("il corriere non esce mai, nemmeno con la tariffa confermata", false, JSON.stringify(sp(TARIFFA_OK)).includes("Corriere di prova"));
  const nonConfermata = { stato: "ok", costoCent: 490, confermata: false, corriere: null, tempi: null, frase: null };
  c("tariffa non confermata: solo il costo", `Spedizione: 4,90${NBSP}€.`, testo(sp(nonConfermata), "spedizione"));
  const nonConfermataConDati = { stato: "ok", costoCent: 490, confermata: false, corriere: "Corriere inventato", tempi: { min: 1, max: 2 }, frase: "Consegna in 1-2 giorni" };
  c("tariffa non confermata con corriere e tempi nel dato (storto): si ignorano, solo il costo", [`Spedizione: 4,90${NBSP}€.`, false, false], [testo(sp(nonConfermataConDati), "spedizione"), JSON.stringify(sp(nonConfermataConDati)).includes("inventato"), JSON.stringify(sp(nonConfermataConDati)).includes("1-2")]);
  c("tariffa confermata ma senza tempi (frase null): solo il costo", `Spedizione: 4,90${NBSP}€.`, testo(sp({ ...TARIFFA_OK, tempi: null, frase: null }), "spedizione"));
  c("frase vuota o di soli spazi: solo il costo", [`Spedizione: 4,90${NBSP}€.`, `Spedizione: 4,90${NBSP}€.`], [testo(sp({ ...TARIFFA_OK, frase: "" }), "spedizione"), testo(sp({ ...TARIFFA_OK, frase: "  " }), "spedizione")]);
  c("il costo è quello del server in centesimi (1290 → 12,90)", `Spedizione: 12,90${NBSP}€, consegna di prova in 2-4 giorni.`, testo(sp({ ...TARIFFA_OK, costoCent: 1290 }), "spedizione"));
  c("costo zero: si scrive lo zero vero (la tariffa lo dice), mai una parola inventata", `Spedizione: 0,00${NBSP}€, consegna di prova in 2-4 giorni.`, testo(sp({ ...TARIFFA_OK, costoCent: 0 }), "spedizione"));
  c("tariffa assente → nessuna voce di spedizione", false, id(sp(TARIFFA_ASSENTE)).includes("spedizione"));
  c("tariffa null o mancante → nessuna voce di spedizione", [false, false], [id(sp(null)).includes("spedizione"), id(sp(undefined)).includes("spedizione")]);
  c("tariffa con costo storto (null, negativo, decimale, testo, NaN) → nessuna voce", [false, false, false, false, false], [null, -1, 4.9, "490", NaN].map((costoCent) => id(sp({ ...TARIFFA_OK, costoCent })).includes("spedizione")));
  c("tariffa con uno stato sconosciuto → nessuna voce", false, id(sp({ ...TARIFFA_OK, stato: "forse" })).includes("spedizione"));

  // ── reso (D87: dato del prodotto o testo del titolare) ──
  const rs = (extra) => testo(F.vociFiducia(extra), "reso");
  c("solo il testo del titolare (nessun prodotto, come nella fascia della home): è la voce, parola per parola", "Testo di prova sul reso.", rs({ testi: TESTI_CONFERMATI_PIENI }));
  c("il testo del titolare si legge senza spazi attorno", "Reso come da regola.", rs({ testi: { reso: "  Reso come da regola.  " } }));
  c("solo il dato del prodotto (consentito, 14 giorni): la frase provvisoria con i giorni", "Reso entro 14 giorni", rs({ prodotto: PATCH }));
  c("un giorno solo: «giorno»", "Reso entro 1 giorno", rs({ prodotto: { reso: { consentito: true, giorni: 1 } } }));
  c("prodotto e testo insieme: vince il testo del titolare (le sue parole)", "Testo di prova sul reso.", rs({ prodotto: PATCH, testi: TESTI_CONFERMATI_PIENI }));
  c("reso NON consentito dal prodotto: nessuna voce, nemmeno con il testo del titolare (sarebbe falso per questo prodotto)", undefined, rs({ prodotto: CURA, testi: TESTI_CONFERMATI_PIENI }));
  c("reso non consentito e nessun testo: nessuna voce", undefined, rs({ prodotto: CURA }));
  c("reso «non deciso» (null) senza testo: nessuna voce", undefined, rs({ prodotto: KIT }));
  c("reso «non deciso» (null) con il testo del titolare: il testo", "Testo di prova sul reso.", rs({ prodotto: KIT, testi: TESTI_CONFERMATI_PIENI }));
  c("consentito ma senza giorni, senza testo: nessuna voce (mai giorni inventati)", undefined, rs({ prodotto: { reso: { consentito: true, giorni: null } } }));
  c("giorni storti (0, negativi, decimali, testo, NaN): nessuna voce", [undefined, undefined, undefined, undefined, undefined], [0, -3, 14.5, "14", NaN].map((giorni) => rs({ prodotto: { reso: { consentito: true, giorni } } })));
  c("testo del titolare svuotato o con segnaposto: non conta", [undefined, undefined, undefined], [rs({ testi: { reso: "" } }), rs({ testi: { reso: "   " } }), rs({ testi: { reso: "{{da confermare: giorni}}" } })]);
  c("prodotto senza il campo reso (dato storto): nessun errore, nessuna voce", undefined, rs({ prodotto: {} }));

  // ── assistenza WhatsApp ──
  const wa = (testi) => testo(F.vociFiducia({ testi }), "whatsapp");
  c("testo WhatsApp confermato: la frase con il testo del titolare", "Scrivici su WhatsApp: Contatto WhatsApp di prova.", wa(TESTI_CONFERMATI_PIENI));
  c("senza testo WhatsApp, vuoto o con segnaposto: nessuna voce", [undefined, undefined, undefined, undefined], [wa({}), wa({ assistenza_whatsapp: "" }), wa({ assistenza_whatsapp: "{{numero}}" }), wa({ assistenza_whatsapp: null })]);
  c("l'assistenza generica (altra chiave) non fa nascere la voce WhatsApp", undefined, wa({ assistenza: "Scrivici a una casella." }));

  // ── pagamenti accettati (solo con «sicuro» vero e metodi) ──
  const pg = (cassa) => testo(F.vociFiducia({ cassa }), "pagamenti");
  c("cassa sicura con due metodi: «Pagamenti accettati: Carta, PayPal»", "Pagamenti accettati: Carta, PayPal", pg(CASSA_SICURA));
  c("cassa non sicura (oggi, in V1): nessuna voce", undefined, pg({ ...CASSA_SICURA, sicuro: false }));
  c("cassa vecchia: nessuna voce", undefined, pg(CASSA_VECCHIA));
  c("sicura ma senza metodi: nessuna voce", [undefined, undefined, undefined], [pg({ ...CASSA_SICURA, metodi: [] }), pg({ ...CASSA_SICURA, metodi: undefined }), pg({ ...CASSA_SICURA, metodi: "Carta" })]);
  c("sicura ma metodi tutti vuoti: nessuna voce", undefined, pg({ ...CASSA_SICURA, metodi: ["", "  ", 5, null] }));
  c("i metodi vuoti si saltano, gli altri restano", "Pagamenti accettati: Carta", pg({ ...CASSA_SICURA, metodi: ["", "Carta", "  "] }));
  c("«sicuro» deve essere proprio vero (testo, numero, non bastano)", [undefined, undefined], [pg({ ...CASSA_SICURA, sicuro: "true" }), pg({ ...CASSA_SICURA, sicuro: 1 })]);
  c("cassa null o mancante: nessuna voce", [undefined, undefined], [pg(null), pg(undefined)]);
  c("la voce dei pagamenti non dice «sicuro» né «garantito»", [], trovaParoleVietate(pg(CASSA_SICURA)).concat(/sicur/i.test(pg(CASSA_SICURA)) ? ["sicur"] : []));

  // ── studio e consulenza: costanti confermate, modificabili, vuoto = nascosta ──
  const fa = (fascia) => F.vociFiducia({ fascia });
  c("testo di studio cambiato dal CRM: si usa quello", "Studio nuovo", testo(fa({ studio: "Studio nuovo" }), "studio"));
  c("testo di studio svuotato: la voce sparisce", [false, true], [id(fa({ studio: "" })).includes("studio"), id(fa({ studio: "" })).includes("consulenza")]);
  c("testo di studio di soli spazi: sparisce", false, id(fa({ studio: "   " })).includes("studio"));
  c("testo di consulenza svuotato: sparisce, resta lo studio", ["studio"], id(fa({ consulenza: "" })));
  c("testo con segnaposto: sparisce (mai «{{»)", ["consulenza"], id(fa({ studio: "Studio {{indirizzo}}" })));
  c("valore non testo (numero, null, undefined): vale il testo di partenza", [STUDIO, STUDIO, STUDIO], [testo(fa({ studio: 5 }), "studio"), testo(fa({ studio: undefined }), "studio"), testo(fa({ studio: null }), "studio")]);
  c("studio e consulenza svuotati insieme: nessuna voce", [], F.vociFiducia({ fascia: { studio: "", consulenza: "" } }));

  // ── tutte insieme: l'ordine ──
  const tutte = F.vociFiducia({ tariffa: TARIFFA_OK, testi: TESTI_CONFERMATI_PIENI, prodotto: PATCH, cassa: CASSA_SICURA });
  c("tutte le fonti: sei voci, in quest'ordine", ["studio", "spedizione", "reso", "pagamenti", "whatsapp", "consulenza"], id(tutte));
  c("nessuna voce due volte", tutte.length, new Set(id(tutte)).size);
  c("ogni voce ha un testo vero (non vuoto, già ripulito)", [], tutte.filter((v) => typeof v.testo !== "string" || v.testo !== v.testo.trim() || v.testo === ""));
  c("la copia JSON è uguale (si manda al browser)", tutte, JSON.parse(JSON.stringify(tutte)));
  c("nessuna parola vietata, nessun segnaposto, nessun «da confermare» in nessuna voce", [], trovaParoleVietate(JSON.stringify(tutte)));

  // ── montaBlocco: la riga sotto il bottone (scheda e carrello): spedizione, reso, pagamenti, WhatsApp ──
  c("blocco: zero voci → non si monta (null)", null, F.montaBlocco([]));
  c("blocco: studio e consulenza non sono voci del blocco → non si monta", null, F.montaBlocco(nulla));
  c("blocco: una voce (spedizione) → si monta con quella", ["spedizione"], id(F.montaBlocco(F.vociFiducia({ tariffa: TARIFFA_OK }))));
  c("blocco: due voci (spedizione, reso) → le due", ["spedizione", "reso"], id(F.montaBlocco(F.vociFiducia({ tariffa: TARIFFA_OK, prodotto: PATCH }))));
  c("blocco: tutte → spedizione, reso, pagamenti, WhatsApp (senza studio e consulenza)", ["spedizione", "reso", "pagamenti", "whatsapp"], id(F.montaBlocco(tutte)));
  c("blocco: ogni voce è la stessa di vociFiducia (nessun testo cambia)", tutte.filter((v) => ["spedizione", "reso", "pagamenti", "whatsapp"].includes(v.id)), F.montaBlocco(tutte));
  c("blocco: ingressi che non sono elenchi → null", [null, null, null], [F.montaBlocco(null), F.montaBlocco(undefined), F.montaBlocco("x")]);
  c("blocco: le voci rotte si saltano", ["whatsapp"], id(F.montaBlocco([null, 4, {}, { id: "whatsapp" }, { id: "whatsapp", testo: "" }, { id: "whatsapp", testo: "Ciao" }, { id: "inventata", testo: "Boh" }])));

  // ── montaFascia: la fascia della home: studio, spedizione, reso, consulenza; sotto 2 voci non si monta ──
  c("fascia: zero voci → non si monta", null, F.montaFascia([]));
  c("fascia: una voce sola (solo lo studio) → non si monta", null, F.montaFascia(F.vociFiducia({ fascia: { consulenza: "" } })));
  c("fascia: una voce sola (solo la consulenza) → non si monta", null, F.montaFascia(F.vociFiducia({ fascia: { studio: "" } })));
  c("fascia: due voci (studio e consulenza, quelle di oggi) → si monta", ["studio", "consulenza"], id(F.montaFascia(nulla)));
  c("fascia: tre voci (con la spedizione) → studio, spedizione, consulenza", ["studio", "spedizione", "consulenza"], id(F.montaFascia(F.vociFiducia({ tariffa: TARIFFA_OK }))));
  c("fascia: tutte → studio, spedizione, reso, consulenza (pagamenti e WhatsApp stanno sulla scheda, non sulla home)", ["studio", "spedizione", "reso", "consulenza"], id(F.montaFascia(tutte)));
  c("fascia: una sola voce di fascia con altre non di fascia → non si monta (contano solo quelle della fascia)", null, F.montaFascia([{ id: "spedizione", testo: "Spedizione: 4,90" }, { id: "whatsapp", testo: "Scrivici" }, { id: "pagamenti", testo: "Carta" }]));
  c("fascia: due voci di fascia più altre → si monta con le sole di fascia", ["studio", "spedizione"], id(F.montaFascia([{ id: "studio", testo: "S" }, { id: "spedizione", testo: "P" }, { id: "whatsapp", testo: "W" }])));
  c("fascia: le voci rotte non contano (due rotte + una vera = una → non si monta)", null, F.montaFascia([null, { id: "studio", testo: "" }, { id: "consulenza", testo: "  " }, { id: "reso", testo: "Reso" }]));
  c("fascia: ingressi che non sono elenchi → null", [null, null], [F.montaFascia(null), F.montaFascia(undefined)]);

  // ── i quattro stati del piano, dal dato al montaggio ──
  const montaggio = (dati) => { const v = F.vociFiducia(dati); return [!!F.montaBlocco(v), !!F.montaFascia(v)]; };
  c("oggi in V1 (nessuna conferma, reso non deciso): blocco no, fascia sì (studio e consulenza)", [false, true], montaggio({ tariffa: TARIFFA_ASSENTE, testi: TESTI_CONFERMATI_VUOTI, prodotto: KIT, cassa: CASSA_VECCHIA }));
  c("oggi in V1 ma con il reso scritto nel prodotto (patch): blocco sì (una voce), fascia sì", [true, true], montaggio({ tariffa: TARIFFA_ASSENTE, testi: TESTI_CONFERMATI_VUOTI, prodotto: PATCH, cassa: CASSA_VECCHIA }));
  c("con tutto confermato: blocco sì, fascia sì", [true, true], montaggio({ tariffa: TARIFFA_OK, testi: TESTI_CONFERMATI_PIENI, prodotto: PATCH, cassa: CASSA_SICURA }));

  // ── ripulitura e purezza ──
  const bruti = Object.freeze({ tariffa: Object.freeze({ ...TARIFFA_OK }), testi: Object.freeze({ ...TESTI_CONFERMATI_PIENI }), prodotto: Object.freeze(PATCH), cassa: Object.freeze({ ...CASSA_SICURA, metodi: Object.freeze([...CASSA_SICURA.metodi]) }), fascia: Object.freeze({ studio: "S" }) });
  c("l'ingresso non cambia (congelato: modificarlo lancerebbe)", 6, F.vociFiducia(bruti).length);
  c("testo del titolare con parentesi graffe (un segnaposto che resta): la voce non si disegna", [undefined, undefined], [testo(F.vociFiducia({ testi: { reso: "Reso {giorni} giorni" } }), "reso"), testo(F.vociFiducia({ testi: { assistenza_whatsapp: "{numero}" } }), "whatsapp")]);
  c("i testi provvisori non portano parole vietate", [], trovaParoleVietate(JSON.stringify(F.TESTI_FIDUCIA_PROVVISORI)));
  c("nessuna combinazione di fonti produce parole vietate o segnaposto", [], (() => {
    const T = [TARIFFA_OK, TARIFFA_ASSENTE, nonConfermata, null];
    const X = [TESTI_CONFERMATI_PIENI, TESTI_CONFERMATI_VUOTI, null];
    const P = [PATCH, CURA, KIT, null];
    const C = [CASSA_SICURA, CASSA_VECCHIA, null];
    return T.flatMap((tariffa) => X.flatMap((testi) => P.flatMap((prodotto) => C.flatMap((cassa) => trovaParoleVietate(JSON.stringify(F.vociFiducia({ tariffa, testi, prodotto, cassa })))))));
  })());
}
