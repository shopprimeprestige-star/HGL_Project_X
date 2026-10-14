/** ── PROVA C2 · LA RICHIESTA DEL MODULO CORTO (regole pure) ────────────────
 *  `src/landing/sito/richiesta.ts`: controlli del modulo, colonne del lead,
 *  riserva in `pain_points`, consenso, errori da ritentare.
 *  ───────────────────────────────────────────────────────────────────────── */
import { carica, leggi, nuovaProva } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("richiesta del modulo corto");
const R = await carica("src/landing/sito/richiesta.ts", "richiesta");
const T = await carica("src/landing/testi-sito.ts", "testi-sito");

const vuoto = { nome: "", telefono: "", fascia: "", problema: null, problemaAltro: "", consensoWhatsapp: false };
const ok = { nome: "Prova", telefono: "333 1234567", fascia: "pomeriggio", problema: null, problemaAltro: "", consensoWhatsapp: false };

/* ── telefonoValido: 12 casi ───────────────────────────────────────────── */
const casi = [
  ["333 1234567", true],
  ["+39 333 1234567", true],
  ["3331234567", true],
  ["0039 333 1234567", false], // 13 cifre: la regola di oggi non lo accetta
  ["39 333 1234567", true],
  ["06 1234567", true], // 9 cifre
  ["12345", false],
  ["", false],
  ["abc", false],
  ["333-12-345-67", true],
  ["33312345678901", false],
  ["telefono 12", false],
];
for (const [raw, atteso] of casi) c(`telefonoValido(${JSON.stringify(raw)})`, atteso, R.telefonoValido(raw));

//  La stessa regola, letta dal sorgente di BookingFunnel: stesse risposte su molti ingressi.
{
  const sorgente = leggi("src/landing/booking/BookingFunnel.tsx");
  const m = sorgente.match(/const telOk =\s*([\s\S]*?);\n/);
  vero("trovo la regola del telefono in BookingFunnel.tsx", !!m);
  const regola = new Function("telDigits", `return ${m ? m[1] : "false"};`);
  const ingressi = [...casi.map((x) => x[0]), "39", "391234567", "3912345678", "39123456789", "391234567890", "3912345678901", "+39 02 12345678", "1234567890", "12345678901", "123456789", "12345678"];
  const diversi = ingressi.filter((raw) => regola(raw.trim().replace(/\D/g, "")) !== R.telefonoValido(raw));
  c("stessa regola di BookingFunnel su tutti gli ingressi", [], diversi);
}

/* ── telefonoDaInviare: come lo salva il modulo lungo ──────────────────── */
//  Sempre «+39» e le sole cifre. Il taglio del 39 guarda le CIFRE, non la stringa con gli spazi:
//  391/392/393/397 sono cellulari veri (WindTre) e iniziano per «39».
for (const [raw, atteso] of [
  ["333 1234567", "+39 3331234567"],
  ["+39 333 1234567", "+39 3331234567"],
  ["  3331234567 ", "+39 3331234567"],
  ["0039 333 1234567", "+39 3331234567"],
  ["39 333 1234567", "+39 3331234567"],
  ["333-123-4567", "+39 3331234567"],
  ["06 1234567", "+39 061234567"],
  ["+39 06 1234567", "+39 061234567"],
  ["", ""],
  ["abc", ""],
  //  I tre casi segnalati dal revisore
  ["393 1234567", "+39 3931234567"],
  ["+39 393 1234567", "+39 3931234567"],
  ["392 555 1234", "+39 3925551234"],
]) c(`telefonoDaInviare(${JSON.stringify(raw)})`, atteso, R.telefonoDaInviare(raw));
//  Tutti i prefissi mobili italiani (320…399), con e senza +39, 0039, 39, spazi e trattini.
{
  const sbagliati = [];
  for (let p = 320; p <= 399; p++) {
    const nudo = `${p}1234567`;
    const atteso = `+39 ${nudo}`;
    const varianti = [nudo, `${p} 1234567`, `${p} 123 4567`, `${p}-123-4567`, `+39 ${nudo}`, `+39 ${p} 1234567`, `+39${nudo}`, `0039${nudo}`, `0039 ${p} 1234567`, `39${nudo}`, `39 ${p} 1234567`, ` ${p} 1234567 `];
    for (const v of varianti) {
      if (R.telefonoDaInviare(v) !== atteso) sbagliati.push([v, R.telefonoDaInviare(v)]);
      //  Il modulo accetta anche «0039…» (telefonoValido, come il modulo lungo, vuole il numero senza).
      const errori = R.controllaModulo({ nome: "x", telefono: v, fascia: "sera", problema: null, problemaAltro: "", consensoWhatsapp: false }, { problemaObbligatorio: false });
      if (errori.telefono) sbagliati.push([v, "il modulo lo rifiuta"]);
    }
  }
  c("tutti i prefissi mobili 320-399, in tutte le forme: numero giusto e valido", [], sbagliati);
}

/* ── controllaModulo ───────────────────────────────────────────────────── */
c("tutto vuoto, Protocol → 3 errori con le frasi del Copywriter", {
  nome: "Scrivi il tuo nome.",
  telefono: "Controlla il numero: servono solo cifre.",
  fascia: "Scegli una fascia.",
}, R.controllaModulo(vuoto, { problemaObbligatorio: false }));
c("tutto vuoto, shop → 4 errori (anche il problema)", {
  nome: "Scrivi il tuo nome.",
  telefono: "Controlla il numero: servono solo cifre.",
  fascia: "Scegli una fascia.",
  problema: "Scegli il problema principale.",
}, R.controllaModulo(vuoto, { problemaObbligatorio: true }));
c("dati giusti, Protocol senza problema → nessun errore", {}, R.controllaModulo(ok, { problemaObbligatorio: false }));
c("dati giusti, shop senza problema → solo il problema", { problema: "Scegli il problema principale." }, R.controllaModulo(ok, { problemaObbligatorio: true }));
c("shop con problema scelto → nessun errore", {}, R.controllaModulo({ ...ok, problema: "tenuta" }, { problemaObbligatorio: true }));
c("shop con «Altro» senza testo → va bene (la riga è facoltativa)", {}, R.controllaModulo({ ...ok, problema: "altro" }, { problemaObbligatorio: true }));
c("0039 + 8 cifre → rifiutato (non diventa valido per sbaglio)", "Controlla il numero: servono solo cifre.", R.controllaModulo({ ...ok, telefono: "0039 12345678" }, { problemaObbligatorio: false }).telefono);
c("8 cifre → rifiutato", "Controlla il numero: servono solo cifre.", R.controllaModulo({ ...ok, telefono: "12345678" }, { problemaObbligatorio: false }).telefono);
c("nome di soli spazi → errore", "Scrivi il tuo nome.", R.controllaModulo({ ...ok, nome: "   " }, { problemaObbligatorio: false }).nome);
c("la casella del consenso non dà mai errori", {}, R.controllaModulo({ ...ok, consensoWhatsapp: false }, { problemaObbligatorio: false }));

/* ── colonneSito ───────────────────────────────────────────────────────── */
{
  const s = { origine: "stock", punto: "barra", prodotto: "Thin Skin 0.03mm V-looped" };
  c("Tenuta da shop", {
    origine: "stock",
    punto_ingresso: "barra",
    problema_principale: "Tenuta: si stacca presto",
    problema_altro: null,
    fascia_oraria: "pomeriggio",
    prodotto_stock: "Thin Skin 0.03mm V-looped",
  }, R.colonneSito({ ...ok, problema: "tenuta" }, s));
  const lungo = "x".repeat(300);
  const a = R.colonneSito({ ...ok, problema: "altro", problemaAltro: lungo }, s);
  c("Altro → problema_principale «Altro»", "Altro", a.problema_principale);
  c("Altro → testo tagliato a 120", 120, a.problema_altro.length);
  const b = R.colonneSito({ ...ok, problema: "altro", problemaAltro: "  due\nparole\t qui  " }, s);
  c("Altro → una riga, senza invii", "due parole qui", b.problema_altro);
  c("Altro senza testo → problema_altro nullo", null, R.colonneSito({ ...ok, problema: "altro", problemaAltro: "  " }, s).problema_altro);
  c("senza problema → entrambi nulli", [null, null], [R.colonneSito(ok, s).problema_principale, R.colonneSito(ok, s).problema_altro]);
  c("il testo di «Altro» viene ignorato se la voce non è «Altro»", null, R.colonneSito({ ...ok, problema: "tenuta", problemaAltro: "ciao" }, s).problema_altro);
  c("consulenza → prodotto_stock nullo anche se passato", null, R.colonneSito(ok, { origine: "consulenza", punto: "protocol", prodotto: "Qualcosa" }).prodotto_stock);
  c("stock senza prodotto → nullo", null, R.colonneSito(ok, { origine: "stock", punto: "pannello" }).prodotto_stock);
  c("prodotto lungo tagliato a 120", 120, R.colonneSito(ok, { origine: "stock", punto: "box", prodotto: lungo }).prodotto_stock.length);
  c("punto «protocol» passa", "protocol", R.colonneSito(ok, { origine: "consulenza", punto: "protocol" }).punto_ingresso);
  for (const f of ["mattina", "pomeriggio", "sera"]) c(`fascia ${f}`, f, R.colonneSito({ ...ok, fascia: f }, s).fascia_oraria);
}

/* ── Elenco dei problemi: con colonne e di riserva ─────────────────────── */
{
  const s = { origine: "stock", punto: "barra", prodotto: "Thin Skin 0.03mm V-looped" };
  const tenuta = R.colonneSito({ ...ok, problema: "tenuta", fascia: "sera" }, s);
  c("con le colonne: solo l'etichetta", ["Tenuta: si stacca presto"], R.painPointsConColonne(tenuta));
  c("con le colonne e «Altro»: la parola Altro (il testo sta in problema_altro)", ["Altro"], R.painPointsConColonne(R.colonneSito({ ...ok, problema: "altro", problemaAltro: "x y" }, s)));
  c("con le colonne senza problema: vuoto", [], R.painPointsConColonne(R.colonneSito(ok, s)));
  c("riserva: formato del giro 1 + Richiamo", [
    "Problema: Tenuta: si stacca presto",
    "Provenienza: stock",
    "Ingresso: barra",
    "Protesi: Thin Skin 0.03mm V-looped",
    "Richiamo: sera",
  ], R.painPointsDiRiserva(tenuta));
  c("riserva con «Altro»", [
    "Problema: Altro: scrivilo tu",
    "Problema (altro): mi si stacca al mare",
    "Provenienza: consulenza",
    "Ingresso: protocol",
    "Richiamo: mattina",
  ], R.painPointsDiRiserva(R.colonneSito({ ...ok, problema: "altro", problemaAltro: "mi si stacca al mare", fascia: "mattina" }, { origine: "consulenza", punto: "protocol" })));
  c("riserva senza problema (Protocol)", ["Provenienza: consulenza", "Ingresso: protocol", "Richiamo: pomeriggio"], R.painPointsDiRiserva(R.colonneSito(ok, { origine: "consulenza", punto: "protocol" })));
}

/* ── Landing «Tre soluzioni»: il punto d'origine e il motivo (`interesse`) ─ */
{
  const sorgente = leggi("src/landing/sito/richiesta.ts");
  vero("PuntoSito ammette «soluzioni» (e conserva gli altri)", /export type PuntoSito = PuntoIngresso \| "protocol" \| "catalogo" \| "blog" \| "soluzioni";/.test(sorgente));
  const s = { origine: "consulenza", punto: "soluzioni" };
  c("punto «soluzioni» passa nelle colonne", "soluzioni", R.colonneSito(ok, s).punto_ingresso);
  c("l'etichetta delle tre voci", { trapianto: "Trapianto", "invisible-derm": "Invisible Derm", "non-so": "Non so quale" }, R.ETICHETTE_INTERESSE);
  //  Quando S3 avrà `TESTI_SOLUZIONI.interesse` nel suo file, le due devono coincidere: la prova si accende da sola.
  if (T.TESTI_SOLUZIONI?.interesse) c("le etichette sono quelle di TESTI_SOLUZIONI.interesse", T.TESTI_SOLUZIONI.interesse, R.ETICHETTE_INTERESSE);
  const col = R.colonneSito({ ...ok, problema: "tenuta" }, s);
  const senza = R.colonneSito(ok, s);
  c("con le colonne, senza interesse: come oggi", ["Tenuta: si stacca presto"], R.painPointsConColonne(col));
  c("con le colonne, interesse undefined: come oggi", ["Tenuta: si stacca presto"], R.painPointsConColonne(col, undefined));
  c("con le colonne, trapianto: la riga in fondo", ["Tenuta: si stacca presto", "Interesse: Trapianto"], R.painPointsConColonne(col, "trapianto"));
  c("con le colonne, invisible-derm", ["Tenuta: si stacca presto", "Interesse: Invisible Derm"], R.painPointsConColonne(col, "invisible-derm"));
  c("con le colonne, non-so", ["Tenuta: si stacca presto", "Interesse: Non so quale"], R.painPointsConColonne(col, "non-so"));
  c("con le colonne, nessun problema (la landing non li chiede): solo la riga", ["Interesse: Trapianto"], R.painPointsConColonne(senza, "trapianto"));
  c("riserva, senza interesse: come oggi", ["Provenienza: consulenza", "Ingresso: soluzioni", "Richiamo: pomeriggio"], R.painPointsDiRiserva(senza));
  c("riserva, interesse undefined: come oggi", R.painPointsDiRiserva(senza), R.painPointsDiRiserva(senza, undefined));
  c("riserva, con interesse: la riga in fondo, dopo il richiamo", ["Provenienza: consulenza", "Ingresso: soluzioni", "Richiamo: pomeriggio", "Interesse: Invisible Derm"], R.painPointsDiRiserva(senza, "invisible-derm"));
  c("riserva con problema e interesse: la riga resta ultima", "Interesse: Trapianto", R.painPointsDiRiserva(col, "trapianto").at(-1));
  //  Un valore che non è una delle tre voci non scrive niente (e non pesca nelle proprietà dell'oggetto).
  for (const strano of ["altro", "", "constructor", "__proto__", "toString", 5, null, {}, ["trapianto"], "Trapianto", " trapianto"]) {
    c(`interesse ${JSON.stringify(strano)}: nessuna riga (colonne)`, ["Tenuta: si stacca presto"], R.painPointsConColonne(col, strano));
    c(`interesse ${JSON.stringify(strano)}: nessuna riga (riserva)`, R.painPointsDiRiserva(col), R.painPointsDiRiserva(col, strano));
  }
}

/* ── Consenso WhatsApp ─────────────────────────────────────────────────── */
c("casella non spuntata → nessuna chiave", {}, R.campiConsenso({ ...ok, consensoWhatsapp: false }));
c("casella spuntata → true + versione", { consenso_whatsapp: true, consenso_whatsapp_versione: T.VERSIONE_CONSENSO_WA }, R.campiConsenso({ ...ok, consensoWhatsapp: true }));
c("la versione è quella del contratto", "wa-sito-2026-10-14", T.VERSIONE_CONSENSO_WA);
vero("il testo della casella è annotato accanto alla versione", /Ok a ricevere promemoria su WhatsApp/.test(leggi("src/landing/testi-sito.ts")));

/* ── Differenze ammesse col modulo lungo ───────────────────────────────── */
c("DIFFERENZE_AMMESSE", [
  "id",
  "chiave_orario_hash",
  "origine",
  "punto_ingresso",
  "problema_principale",
  "problema_altro",
  "fascia_oraria",
  "prodotto_stock",
  "consenso_whatsapp",
  "consenso_whatsapp_versione",
], [...R.DIFFERENZE_AMMESSE]);
{
  const sorgente = leggi("src/landing/sito/richiesta.ts");
  for (const k of R.DIFFERENZE_AMMESSE) vero(`DIFFERENZE_AMMESSE: «${k}» ha il suo motivo in un commento`, new RegExp(`//[^\\n]*\\b${k}\\b|/\\*[\\s\\S]*?\\b${k}\\b[\\s\\S]*?\\*/`).test(sorgente));
}

/* ── Errori ────────────────────────────────────────────────────────────── */
for (const code of ["PGRST204", "42703", "23514"]) c(`erroreDaRitentare(${code})`, true, R.erroreDaRitentare(code));
for (const code of ["23505", "42501", "PGRST202", "", undefined, "08006"]) c(`erroreDaRitentare(${JSON.stringify(code)}) = no`, false, R.erroreDaRitentare(code));
c("giaSalvato(23505)", true, R.giaSalvato("23505"));
for (const code of ["PGRST204", "", undefined]) c(`giaSalvato(${JSON.stringify(code)}) = no`, false, R.giaSalvato(code));

/* ── Il file non parla di finestra, né salva niente ────────────────────── */
{
  const src = leggi("src/landing/sito/richiesta.ts");
  vero("richiesta.ts è puro: niente window, document, supabase, localStorage", !/\b(window|document|localStorage|sessionStorage)\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")) && !/supabase/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));
}

finisci();
