/** ── EDITOR PRODOTTI · E7 · IL GUSCIO DELLA SCHEDA (SchedaProdotto.tsx) ──────
 *  Dopo la divisione in riquadri (E5, E6) il guscio tiene lo stato, il salvataggio e le scritture, e compone la pagina. Qui si prova:
 *  · SORGENTE: dimensioni (guscio < 1100 righe, file nuovi < 450), parole vietate e nessun `fetch(` in TUTTA `prodotti/`, il guscio usa i
 *    riquadri e non ne ha più copie, un solo tasto pieno, la barra fissa, le scritture sulla variante «Unica» (creazione, SKU, costo),
 *    il passaggio alle opzioni (la Unica si disattiva, non si cancella), il ripiego di «Vai» quando manca il campo;
 *  · DISEGNO (`rendiComponente`, react-dom/server: gli effetti non girano, quindi si legge la prima schermata): testata, ordine dei riquadri,
 *    costo e margine dai dati del server, costo spento senza migrazione, riquadri che spariscono con le opzioni e con Invisible Derm, barra
 *    fissa con «Mancano N cose», pubblicato con e senza modifiche, un solo tasto pieno, nessun id doppio.
 *  Le ancore delle prove vecchie (`scheda-sorgente.mjs`, `pagina-negozio.mjs`) NON si toccano: restano verdi da sole. Dati inventati, nessuna rete. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { buildSync } from "esbuild";
import { trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const conta = (s, re) => (s.match(re) ?? []).length;
const righe = (s) => s.split("\n").length;

/** Tutti i file `.ts`/`.tsx` di una cartella, sottocartelle comprese (percorsi assoluti). */
const filesDi = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? filesDi(p) : /\.tsx?$/.test(n) ? [p] : [];
      })
    : [];

/** I tag `<Button …>` di un sorgente (dal `<Button` al `>` che chiude il tag: il `>` di `=>` non conta). */
function tagBottoni(src) {
  const out = [];
  for (const m of src.matchAll(/<Button\b/g)) {
    let i = m.index + 7;
    let graffe = 0;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") graffe++;
      else if (ch === "}") graffe--;
      else if (ch === ">" && graffe === 0 && src[i - 1] !== "=") break;
    }
    out.push({ inizio: m.index, testo: src.slice(m.index, i + 1) });
  }
  return out;
}

/** Impacchetta un modulo `src` (anche `.tsx`) e lo carica: serve a provare le funzioni pure e i gestori degli eventi senza un browser. */
const caricaBundle = (percorso, radice) => {
  const r = buildSync({ entryPoints: [percorso], bundle: true, format: "esm", write: false, jsx: "automatic", loader: { ".tsx": "tsx" }, alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
/** Dispiega un albero React senza disegnarlo: chiama i componenti-funzione (senza hook) e raccoglie gli elementi veri (input, div…). */
function dispiega(n, out = []) {
  if (n == null || typeof n === "boolean" || typeof n === "string" || typeof n === "number") return out;
  if (Array.isArray(n)) return (n.forEach((x) => dispiega(x, out)), out);
  if (typeof n.type === "function") return dispiega(n.type(n.props), out);
  out.push(n);
  return dispiega(n.props?.children, out);
}

const ISTANTE = "2026-11-25T10:00:00.000Z";
const prodotto = (extra = {}) => ({
  id: "p1", sku: "HG-T01", slug: "lace-front", nome: "Lace Front Swiss", tipo: "patch", stato: "bozza", origine: null, prezzoCent: 2000,
  marca: null, rigaPresentazione: null, descrizioneBreve: "Una patch inventata.", descrizioneLunga: null, perChi: null, caratteristiche: [],
  passi: [], confezione: [], avvertenze: [], faq: [], resoConsentito: null, resoGiorni: null, boxConsulenza: false, correlatoId: null,
  canali: { sito: true, meta: false, google: false, tiktok: false }, seoTitolo: null, seoDescrizione: null, seoMediaId: null, gtin: null, mpn: null,
  categoriaGoogle: null, pesoG: null, classeSpedizione: null, fornitore: null, schedaTecnicaPath: null, noteInterne: null, notaTitolare: null,
  bozzaModifiche: null, bozzaModificataIl: null, idCodice: null, creatoIl: ISTANTE, aggiornatoIl: ISTANTE, pubblicatoIl: null, ...extra,
});
const variante = (extra = {}) => ({
  id: "v1", prodottoId: "p1", sku: "HG-T01", nome: "Unica", opzioni: {}, prezzoCent: null, giacenza: 10, pesoG: null, attiva: true, gtin: null, ordine: 1, ...extra,
});
const foto = () => ({
  id: "m1", prodottoId: "p1", categoriaId: null, varianteId: null, slot: "principale", sottoRuolo: null, tipo: "foto", path480: "prova/a-480.webp",
  path960: "prova/a-960.webp", path1600: "prova/a-1600.webp", pathVideo: null, pathCopertina: null, durataS: null, alt: "Una patch su fondo bianco",
  testoParlato: null, sottotitoliOk: false, muto: false, ritraePersone: false, liberatoriaOk: false, valoreOpzione: null, ordine: 1, rimossoIl: null,
});
const scheda = (extra = {}) => ({
  prodotto: prodotto(), versione: ISTANTE, varianti: [variante()], media: [], principaleId: null, categorie: [],
  storico: [{ id: "s1", entita: "prodotto", entita_id: "p1", campo: "nome", prima: "x", dopo: "y", chi: "Giulia Esempio", creato_il: ISTANTE }],
  controllo: { bloccanti: [], informativi: [] }, costi: { v1: 1040 }, costoDisponibile: true, ...extra,
});
const negozio = { prodotti: [], scheda: async () => ({ ok: false }), esegui: async () => ({ ok: true, dati: {} }), categorie: async () => ({ ok: true, dati: { categorie: [] } }), interruttori: async () => ({ ok: false }), aggiorna: async () => {} };
const STUB = (nome) => `import React from "react"; export const ${nome} = () => React.createElement("p", null, "STUB-${nome}");`;
const FINTI = { "./EditorMedia": STUB("EditorMedia"), "./EditorVarianti": STUB("EditorVarianti") };

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E7 · IL GUSCIO DELLA SCHEDA (25/11/2026)");
  const dir = join(radice, "src/crm/ecommerce/prodotti");
  const fileGuscio = join(dir, "SchedaProdotto.tsx");
  const guscio = existsSync(fileGuscio) ? readFileSync(fileGuscio, "utf8") : "";
  const k = senzaCommenti(guscio);

  // ════ DIMENSIONI ════
  c("il guscio sta sotto le 1100 righe", true, righe(guscio) < 1100);
  const nuovi = [...filesDi(join(dir, "scheda")), ...filesDi(join(dir, "importa")), join(dir, "semplice-puro.ts"), join(dir, "riquadri-puro.ts"), join(dir, "SchedaNuova.tsx")].filter(existsSync);
  const lunghi = nuovi.filter((f) => righe(readFileSync(f, "utf8")) >= 450).map((f) => relative(dir, f));
  c("ogni file nuovo di prodotti/ (scheda/, importa/, puri, SchedaNuova) sta sotto le 450 righe", [], lunghi);

  // ════ PAROLE VIETATE E RETE, IN TUTTA prodotti/ ════
  //  Tre usi legittimi esistevano già in file che questo compito non tocca (le percentuali del ritaglio foto, la chiave tolta da un oggetto, il
  //  caricamento dei file con il permesso firmato): sono elencati qui UNO per uno, così una parola nuova in quei file o in un file nuovo è rossa.
  const NOTI = {
    "EditorMedia.tsx": [/\*\s*100\b/, /\bfetch\(/],
    "scheda-pura.ts": [/\bdelete\b/],
    "Categorie.tsx": [/\bfetch\(/],
  };
  const VIETATE = [/compareAt/i, /prezzo\s+barrato/i, /\brating\b/i, /best\s*seller/i, /\bstelle\b/i, /sconto/i, /\bdelete\b/, /Elimina/, /parseFloat/, /\*\s*100\b/, /\bfetch\(/];
  const tutti = filesDi(dir);
  const colpevoli = [];
  for (const f of tutti) {
    const t = senzaCommenti(readFileSync(f, "utf8"));
    const nome = relative(dir, f);
    for (const v of VIETATE) if (v.test(t) && !(NOTI[nome] ?? []).some((n) => n.source === v.source)) colpevoli.push(`${nome}: ${v}`);
  }
  c("nessuna parola vietata e nessun fetch( in nessun file di prodotti/ (commenti esclusi; solo i tre usi già esistenti, elencati)", [], colpevoli);
  c("gli usi già esistenti sono ancora lì (se spariscono si toglie l'eccezione)", [], Object.entries(NOTI).flatMap(([nome, re]) => re.filter((r) => !r.test(senzaCommenti(readFileSync(join(dir, nome), "utf8")))).map((r) => `${nome}: ${r}`)));

  // ════ IL GUSCIO USA I RIQUADRI ════
  const IMPORTATI = ["PaginaScheda", "Banner", "TestataScheda", "AvvisiScheda", "FinestraAnteprima", "FinestraArchivia", "RiquadroVarianti", "RiquadroTitolo", "RiquadroFoto", "RiquadroPrezzo", "RiquadroGiacenza", "RiquadroSpedizione", "RiquadroSeo", "RiquadroContenuto", "ColonnaLaterale", "PrimaDiPubblicare"];
  c("il guscio usa i riquadri di scheda/ e il kit Polaris", IMPORTATI.map(() => true), IMPORTATI.map((n) => new RegExp(`<${n}\\b`).test(k) || new RegExp(`import[^;]*\\b${n}\\b[^;]*from "\\./scheda/`).test(k)));
  c("il guscio non ha più copie dei pezzi spostati (Sezione, VoceLink, Campo, Caratteristiche, Domande)", [false, false, false, false, false], ["Sezione", "VoceLink", "Campo", "Caratteristiche", "Domande"].map((n) => new RegExp(`function ${n}\\(`).test(k)));
  c("«Vai» ripiega se il campo non c'è: f-sku per «varianti» senza opzioni, poi il pannello del riquadro", [true, true], [/"f-sku"/.test(k), /`pan-\$\{/.test(k)]);

  // ════ LA TESTATA E LA BARRA ════
  const testata = senzaCommenti(readFileSync(join(dir, "scheda/TestataScheda.tsx"), "utf8"));
  c("testata: «← Prodotti» (freccia + «Prodotti»), titolo, badge di stato, «Ultima modifica di …»", [true, true, true, true], [/ArrowLeft/.test(testata), /Prodotti\s*<\/Button>/.test(testata), /<BadgeStato\b/.test(testata), /Ultima modifica di/.test(testata)]);
  c("testata: il tasto pieno e quelli di contorno arrivano dal guscio (lì stanno le loro regole)", [true, true], [/principale=\{[\s\S]{0,300}void pubblica\(\)/.test(k), /prima=\{[\s\S]{0,400}apriAnteprima/.test(k)]);
  c("barra fissa sul telefono: fixed, in basso, nascosta dal computer", true, /fixed inset-x-0 bottom-0[^"]*md:hidden|md:hidden[^"]*fixed inset-x-0 bottom-0/.test(k));
  c("barra: quando «Pubblica» è spento per colpa dei controlli dice «Mancano N cose» e porta al pannello", [true, true], [/Mancano|mancano/.test(k) && /setPannello\(true\)/.test(k), /prima-di-pubblicare/.test(k)]);
  // un solo tasto pieno: i `<Button>` senza `variant` del guscio sono solo i due «Pubblica» (uno per il computer, uno per il telefono); le finestre sono schermate a parte
  const pieni = tagBottoni(k).filter((b) => !/variant=/.test(b.testo));
  c("un solo tasto pieno per schermata: nel guscio i tasti pieni sono due (computer e telefono) e fanno tutti «Pubblica»", [2, 2], [pieni.length, pieni.filter((b) => /void pubblica\(\)/.test(b.testo)).length]);
  c("i due tasti pieni non si vedono insieme: uno solo dal computer, l'altro solo sul telefono", true, pieni.some((b) => /hidden md:/.test(b.testo)) && /md:hidden[\s\S]{0,1200}void pubblica\(\)/.test(k));
  const giacenza = senzaCommenti(readFileSync(join(dir, "scheda/RiquadroGiacenza.tsx"), "utf8"));
  c("la quantità si conferma uscendo dal gruppo quantità+motivo: il guscio passa `confermaQuantita` al riquadro Giacenza", [true, true], [/onBlur=/.test(giacenza) && /confermaQuantita/.test(giacenza), /confermaQuantita=\{confermaQuantita\}/.test(k)]);
  c("la striscia «Hai modifiche non pubblicate» ha il suo «Pubblica le modifiche» di contorno", true, /Hai modifiche non pubblicate[\s\S]{0,900}variant="outline"[\s\S]{0,300}void pubblica\(\)/.test(k));

  // ════ LA VARIANTE «UNICA»: COSTO, SKU, CREAZIONE, PASSAGGIO ALLE OPZIONI ════
  c("legge costi e costoDisponibile dalla scheda (assente = spento)", [true, true], [/scheda\.costi|\.costi\b/.test(k), /costoDisponibile\s*===\s*true/.test(k)]);
  c("il costo si scrive sulla Unica con variante_salva e `costoCent`, sempre da scrivi()", [true, true], [/"variante_salva"/.test(k) && /costoCent/.test(k), conta(k, /negozioRef\.current\.esegui\(/g) === 1]);
  c("il costo passa da centDaEuro (mai parseFloat) e un costo che non è una cifra non parte", [true, false], [/centDaEuro\(/.test(k), /parseFloat/.test(k)]);
  c("crea la Unica se manca (nome «Unica», senza opzioni, SKU del prodotto) e la riaccende se spenta", [true, true, true], [/nome:\s*"Unica"/.test(k), /statoUnica\(/.test(k), /"variante_attiva"[\s\S]{0,200}attiva:\s*true/.test(k)]);
  c("in bozza il salvataggio allinea lo SKU della Unica a quello del prodotto, sul pubblicato no", true, /pubblicatoIl[\s\S]{0,400}sku/.test(k) || /sku[\s\S]{0,400}pubblicatoIl/.test(k));
  c("passando alle opzioni la Unica NON si cancella e il guscio non la spegne da solo (lo fa EditorVarianti, E8): nessuna variante_attiva a false qui", [false, false], [/variante_(elimina|cancella|rimuovi)/.test(k), /"variante_attiva"[\s\S]{0,200}attiva:\s*false/.test(k)]);
  c("la quantità si scrive come movimento registrato (giacenza_imposta), quando si esce dal campo", [true, true], [/"giacenza_imposta"/.test(k), /confermaQuantita/.test(k)]);
  c("il costo e lo SKU della Unica viaggiano nel salvataggio automatico (un solo posto che scrive)", true, /creaAutosalva(<[^>]*>)?\(/.test(k) && /costo/.test(k.slice(k.indexOf("creaAutosalva<"), k.indexOf("creaAutosalva<") + 2500)));
  c("il «Prezzo di base» sta dentro EditorVarianti (E8): il guscio passa `prezzoBase` solo con le opzioni, legato al prezzo del modulo e al tasto «Applica» (una sola volta)", [true, true, true, 1], [/prezzoBase=\{/.test(k), /testo:\s*modulo\.prezzo/.test(k) && /azione:\s*pubblicato \? azionePrezzo/.test(k), /modalita === "opzioni" && !senzaPrezzo/.test(k), conta(k, /void applicaPrezzo\(\)/g)]);
  c("costi e costoDisponibile arrivano all'editor delle varianti", true, /<EditorVarianti[\s\S]{0,900}costi=\{dati\.costi\}[\s\S]{0,200}costoDisponibile=\{costoDisp\}[\s\S]{0,200}prezzoBase=/.test(k) && !/propsNuoveVarianti/.test(k));


  // ════ LA QUANTITÀ: QUANDO SI SCRIVE E COSA (correzioni di E7) ════
  const fileGiac = join(dir, "scheda/giacenza-puro.ts");
  const G = existsSync(fileGiac) ? await caricaBundle(fileGiac, radice) : {};
  const ha = (n) => typeof G[n] === "function";
  c("giacenza-puro.ts esporta testoQuantita, movimentoDaScrivere, fuocoEsceDalGruppo", [true, true, true], ["testoQuantita", "movimentoDaScrivere", "fuocoEsceDalGruppo"].map(ha));
  if (ha("movimentoDaScrivere")) {
    c("campo NON toccato: segue il magazzino (arriva un ordine, 10 → 7: il campo dice 7)", ["7", "10"], [G.testoQuantita({ letta: 7, testo: "10", toccata: false }), G.testoQuantita({ letta: 7, testo: "10", toccata: true })]);
    c("campo non toccato col testo vecchio («10», il magazzino è 7): NON si scrive niente", null, G.movimentoDaScrivere({ letta: 7, testo: "10", toccata: false, motivo: null }));
    c("toccato, 10 → 12: carico di 12 (il motivo si propone dal verso)", { valore: 12, motivo: "carico" }, G.movimentoDaScrivere({ letta: 10, testo: "12", toccata: true, motivo: null }));
    c("toccato, 10 → 4 con motivo scelto «reso»: vale la scelta, non la proposta", { valore: 4, motivo: "reso" }, G.movimentoDaScrivere({ letta: 10, testo: "4", toccata: true, motivo: "reso" }));
    c("toccato ma uguale al magazzino, o non è un intero: niente", [null, null, null], [G.movimentoDaScrivere({ letta: 10, testo: "10", toccata: true, motivo: null }), G.movimentoDaScrivere({ letta: 10, testo: "12,5", toccata: true, motivo: null }), G.movimentoDaScrivere({ letta: 10, testo: "", toccata: true, motivo: null })]);
    const gruppo = { contains: (n) => n === "motivo" || n === "quantita" };
    c("il fuoco passa al motivo (dentro il gruppo): non esce; va altrove o fuori dalla pagina: esce", [false, true, true], [G.fuocoEsceDalGruppo(gruppo, "motivo"), G.fuocoEsceDalGruppo(gruppo, "altro"), G.fuocoEsceDalGruppo(gruppo, null)]);
  }
  // il riquadro vero: i gestori, chiamati con eventi finti (niente browser)
  const fileRiq = join(dir, "scheda/RiquadroGiacenza.tsx");
  if (existsSync(fileRiq)) {
    const R = await caricaBundle(fileRiq, radice);
    let scritture = 0;
    const albero = dispiega(R.RiquadroGiacenza({ modulo: { sku: "HG-T01", gtin: "" }, cambia: () => {}, errori: {}, avvisi: {}, modalita: "semplice", invisibleDerm: false, nuovo: false, skuBloccato: false, giacenzaAttuale: 10, quantita: "10", cambiaQuantita: () => {}, motivo: "carico", cambiaMotivo: () => {}, soglia: null, confermaQuantita: () => { scritture++; } }));
    const gruppoEl = albero.find((e) => typeof e.props?.onBlur === "function");
    const campo = albero.find((e) => e.type === "input" && e.props.id === "f-giacenza");
    c("riquadro Giacenza: un contenitore ascolta l'uscita del fuoco (onBlur) e il campo quantità non scrive da solo", [true, true], [!!gruppoEl, !!campo && campo.props.onBlur === undefined]);
    if (gruppoEl && campo) {
      const motivoEl = {};
      const contenitore = { contains: (n) => n === motivoEl || n === campo };
      gruppoEl.props.onBlur({ currentTarget: contenitore, relatedTarget: motivoEl });
      c("dalla quantità al menu «Motivo»: NON parte il movimento (così «Reso» si può scegliere)", 0, scritture);
      gruppoEl.props.onBlur({ currentTarget: contenitore, relatedTarget: {} });
      c("il fuoco esce dal gruppo: parte una volta", 1, scritture);
      gruppoEl.props.onBlur({ currentTarget: contenitore, relatedTarget: null });
      c("il fuoco esce dalla pagina (relatedTarget nullo): parte", 2, scritture);
      let sfocato = 0;
      campo.props.onKeyDown?.({ key: "Enter", currentTarget: { blur: () => sfocato++ }, preventDefault() {} });
      campo.props.onKeyDown?.({ key: "a", currentTarget: { blur: () => sfocato++ }, preventDefault() {} });
      c("Invio nel campo toglie il fuoco (un solo percorso: lo stesso dell'uscita); un altro tasto no", 1, sfocato);
    }
  }
  c("il guscio: il campo segue il magazzino finché non lo si tocca, la scrittura parte solo dopo un tocco e il segno si azzera prima di scrivere", [true, true, true], [/testoQuantita\(/.test(k), /movimentoDaScrivere\(/.test(k), /setScritta\(null\)[\s\S]{0,300}"giacenza_imposta"/.test(k)]);
  c("quantità con la Unica assente: una frase («salva prima il prodotto»), non il silenzio", true, /salva prima il prodotto/i.test(k));

  // ════ L'APERTURA DI UNA BOZZA SCRIVE; QUELLA DI UN PUBBLICATO MAI ════
  const corpoRiparo = k.slice(k.indexOf("const riparata = useRef"), k.indexOf("[]); // eslint-disable-line"));
  c("la riparazione della Unica all'apertura parte solo per una BOZZA e non per il vecchio catalogo (sorgente)", [true, true], [/prodotto0\.stato !== "bozza"/.test(corpoRiparo), /prodotto0\.origine === "codice"/.test(corpoRiparo)]);
  c("se la riparazione fallisce rilegge e mostra l'errore solo se la Unica manca ancora (un'altra persona può averla già creata)", true, /await rileggi\(\)[\s\S]{0,400}statoUnica\(viva\.current\.varianti[\s\S]{0,300}setEsito/.test(corpoRiparo));
  c("lo SKU della Unica si allinea solo se il prodotto non è mai stato pubblicato (sorgente)", true, /if \(\s*unica &&\s*!v\.prodotto\.pubblicatoIl &&\s*unica\.sku !== sku\s*\)/.test(k));

  // ════ IL DISEGNO ════
  const file = join(dir, "SchedaProdotto.tsx");
  const vedi = async (sch, extra = {}) => (await rendiComponente(radice, file, "SchedaAperta", { scheda: sch, negozio, apri: () => {}, ricarica: () => {}, ...extra }, { finti: FINTI })).html;
  const ordine = (h, ids) => ids.map((i) => h.indexOf(`id="sez-${i}"`));
  const crescente = (a) => a.every((x, i) => x >= 0 && (i === 0 || x > a[i - 1]));
  const idDoppi = (h) => {
    const visti = new Map();
    for (const m of h.matchAll(/\sid="([^"]+)"/g)) visti.set(m[1], (visti.get(m[1]) ?? 0) + 1);
    return [...visti].filter(([, n]) => n > 1).map(([id]) => id);
  };
  /** Le etichette dei bottoni pieni (classe `bg-primary` esatta: l'interruttore ha solo `data-[state=checked]:bg-primary`). */
  const pieniNelDisegno = (h) => [...h.matchAll(/<button\b[^>]*>/g)].filter((m) => /\sclass="([^"]*)"/.exec(m[0])?.[1].split(/\s+/).includes("bg-primary"));
  const tastoPubblica = (h, testo) => [...h.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]).filter((b) => leggibile(b) === testo);
  const spento = (b) => /\sdisabled=""/.test(b.slice(0, b.indexOf(">")));

  if (!guscio.includes("export function SchedaAperta")) {
    c("SchedaAperta è esportata (serve a disegnare la prima schermata)", true, false);
    return;
  }

  // 1 · un prodotto semplice in bozza, dal vivo: costo 10,40 e prezzo 20,00
  const h1 = await vedi(scheda());
  c("semplice · i quindici riquadri ci sono, nell'ordine della SPEC (principale: titolo, foto, prezzo, giacenza, spedizione, varianti, SEO, caratteristiche, uso, reso)", true, crescente(ordine(h1, ["titolo", "foto", "prezzo", "giacenza", "spedizione", "varianti", "seo", "caratteristiche", "uso", "reso"])));
  c("semplice · colonna laterale: Stato, Prima di pubblicare, Dove si vede, Organizzazione, Dati per i cataloghi, Note", true, crescente([h1.indexOf('id="sez-stato"'), h1.indexOf('id="prima-di-pubblicare"'), h1.indexOf('id="sez-canali"'), h1.indexOf('id="sez-organizzazione"'), h1.indexOf('id="sez-cataloghi"'), h1.indexOf('id="sez-note"')]));
  c("semplice · testata: ← Prodotti, titolo, badge «Bozza», «Ultima modifica di Giulia Esempio»", [true, true, true, true], [conta(h1, />\s*Prodotti\s*<\/button>/g) >= 1, /<h1[^>]*>Lace Front Swiss<\/h1>/.test(h1), leggibile(h1).includes("Bozza"), leggibile(h1).includes("Ultima modifica di Giulia Esempio")]);
  c("semplice · il costo scritto sul server (10,40) e il margine «Margine 48 %, utile 9,60 €»", [true, true], [/<input[^>]*id="f-costo"[^>]*value="10,40"|<input[^>]*value="10,40"[^>]*id="f-costo"/.test(h1), leggibile(h1).includes("Margine 48 %, utile 9,60 €")]);
  c("semplice · la quantità viene dalla Unica (10) e lo SKU dal prodotto", [true, true, true], [/<input[^>]*id="f-giacenza"[^>]*value="10"|<input[^>]*value="10"[^>]*id="f-giacenza"/.test(h1), leggibile(h1).includes("In magazzino ora: 10."), /<input[^>]*id="f-sku"[^>]*value="HG-T01"|<input[^>]*value="HG-T01"[^>]*id="f-sku"/.test(h1)]);
  c("semplice · gli editor di foto e varianti stanno dentro i loro riquadri", true, h1.indexOf("STUB-EditorMedia") > h1.indexOf('id="sez-foto"') && h1.indexOf("STUB-EditorVarianti") > h1.indexOf('id="sez-varianti"'));
  c("semplice · nessun id doppio nella pagina", [], idDoppi(h1));
  c("semplice · «Prima di pubblicare» c'è una volta sola e dice cosa manca (la foto, la categoria)", [1, true, true], [conta(h1, /id="prima-di-pubblicare"/g), /foto principale/i.test(leggibile(h1)), /categoria/i.test(leggibile(h1))]);
  c("semplice · barra fissa: «Mancano N cose» e «Pubblica» spento (la barra e la testata)", [true, true, true], [/Mancano \d+ cose|Manca 1 cosa/.test(leggibile(h1)), tastoPubblica(h1, "Pubblica").length === 2, tastoPubblica(h1, "Pubblica").every(spento)]);
  c("semplice · un solo tasto pieno per schermata: due in tutto, uno per il computer e uno per il telefono", 2, pieniNelDisegno(h1).length);
  //  «da confermare» è una parola vietata della vetrina ma nel CRM è l'etichetta di una caratteristica (già in E5): qui non conta
  c("semplice · nessuna parola vietata nel testo che si legge", [], trovaParoleVietate(leggibile(h1)).filter((p) => p !== "da confermare"));

  // 2 · senza la migrazione il costo è spento con la sua frase, e un server vecchio (campo assente) fa lo stesso
  for (const [nome, extra] of [["costoDisponibile: false", { costoDisponibile: false, costi: {} }], ["campo assente (server vecchio)", { costoDisponibile: undefined, costi: undefined }]]) {
    const h = await vedi(scheda(extra));
    c(`senza migrazione (${nome}) · costo spento con la frase, nessun margine`, [true, true, false], [leggibile(h).includes("Per il costo serve un aggiornamento del database."), /<input[^>]*id="f-costo"[^>]*\sdisabled=""|<input[^>]*\sdisabled=""[^>]*id="f-costo"/.test(h), /Margine/.test(h)]);
  }

  // 3 · con le opzioni: spariscono Prezzo, Giacenza, Spedizione; resta il prezzo di base dentro Varianti
  const conOpzioni = scheda({ varianti: [variante({ attiva: false }), variante({ id: "v2", sku: "HG-T01-NERO", nome: "Nero", opzioni: { Colore: "Nero" } }), variante({ id: "v3", sku: "HG-T01-BIONDO", nome: "Biondo", opzioni: { Colore: "Biondo" } })] });
  const h3 = await vedi(conOpzioni);
  c("con le opzioni · Prezzo, Giacenza e Spedizione non ci sono, Varianti sì", [false, false, false, true], ["prezzo", "giacenza", "spedizione", "varianti"].map((i) => h3.includes(`id="sez-${i}"`)));
  c("con le opzioni · il guscio non disegna un secondo «Prezzo di base» (c'è solo quello dell'editor)", 0, conta(h3, /id="f-prezzo"/g));
  c("con le opzioni · nessun id doppio", [], idDoppi(h3));

  // 4 · Invisible Derm: niente prezzo, ma l'avviso sui prezzi nelle descrizioni
  const h4 = await vedi(scheda({ prodotto: prodotto({ nome: "Invisible Derm", slug: "invisible-derm", sku: "HG-ID" }), varianti: [variante({ sku: "HG-ID" })] }));
  c("Invisible Derm · il riquadro Prezzo non c'è, la Giacenza sì, e l'avviso «Non scrivere prezzi nelle descrizioni» sta nel Titolo", [false, true, true], [h4.includes('id="sez-prezzo"'), h4.includes('id="sez-giacenza"'), leggibile(h4).includes("Non scrivere prezzi nelle descrizioni") && h4.indexOf("Non scrivere prezzi") < h4.indexOf('id="f-nome"')]);

  // 5 · pubblicato: SKU e indirizzo bloccati, «Applica il nuovo prezzo», «Pubblica le modifiche» spento senza modifiche
  const pubblicato = scheda({ prodotto: prodotto({ stato: "pubblicato", pubblicatoIl: ISTANTE }), media: [foto()], categorie: ["c1"] });
  const h5 = await vedi(pubblicato);
  c("pubblicato · badge «Pubblicato», SKU e indirizzo bloccati, prezzo che si applica subito col suo tasto", [true, true, true, true], [leggibile(h5).includes("Pubblicato"), /<input[^>]*id="f-sku"[^>]*\sdisabled=""|<input[^>]*\sdisabled=""[^>]*id="f-sku"/.test(h5), /<input[^>]*id="f-slug"[^>]*\sdisabled=""|<input[^>]*\sdisabled=""[^>]*id="f-slug"/.test(h5), leggibile(h5).includes("si applica subito") && leggibile(h5).includes("Applica il nuovo prezzo")]);
  c("pubblicato senza modifiche · «Pubblica le modifiche» c'è e è spento; niente striscia", [true, true, false], [tastoPubblica(h5, "Pubblica le modifiche").length >= 1, tastoPubblica(h5, "Pubblica le modifiche").every(spento), /Hai modifiche non pubblicate/.test(h5)]);
  const h6 = await vedi(scheda({ ...pubblicato, prodotto: prodotto({ stato: "pubblicato", pubblicatoIl: ISTANTE, bozzaModifiche: { nome: "Lace Front Swiss 2" }, bozzaModificataIl: ISTANTE }) }));
  c("pubblicato con una bozza di modifica · la striscia c'è, «Pubblica le modifiche» si accende (testata, barra, striscia)", [true, 3, true], [/Hai modifiche non pubblicate/.test(h6), tastoPubblica(h6, "Pubblica le modifiche").length, tastoPubblica(h6, "Pubblica le modifiche").every((b) => !spento(b))]);
  c("pubblicato con bozza · un solo tasto pieno per schermata (due in tutto: computer e telefono)", 2, pieniNelDisegno(h6).length);
  c("pubblicato con bozza · nessun id doppio", [], idDoppi(h6));

  const fotoPub = h5.slice(h5.indexOf('id="sez-foto"'), h5.indexOf('id="sez-prezzo"'));
  c("pubblicato · il riquadro Foto dice «si applica subito» (come la vecchia scheda); in bozza no", [true, false], [fotoPub.includes("si applica subito"), h1.slice(h1.indexOf('id="sez-foto"'), h1.indexOf('id="sez-prezzo"')).includes("si applica subito")]);
  c("la frase «Costo e tempi di spedizione si impostano insieme alla cassa…» c'è, una volta, nel riquadro Reso (anche con le opzioni)", [1, true, 1], [conta(leggibile(h1), /Costo e tempi di spedizione si impostano insieme alla cassa: non servono per pubblicare adesso\./g), h1.indexOf('id="f-spedizione"') > h1.indexOf('id="sez-reso"'), conta(leggibile(h3), /Costo e tempi di spedizione si impostano insieme alla cassa/g)]);

  // 6 · il vecchio catalogo: «Rendi mio» e Pubblica spento
  const h7 = await vedi(scheda({ prodotto: prodotto({ origine: "codice" }) }));
  c("vecchio catalogo · avviso «Questo articolo viene dal vecchio catalogo» con «Usa questo prodotto»", [true, true], [leggibile(h7).includes("viene dal vecchio catalogo"), leggibile(h7).includes("Usa questo prodotto")]);

  // 7 · archiviato: badge e frase
  const h8 = await vedi(scheda({ prodotto: prodotto({ stato: "archiviato" }), media: [foto()], categorie: ["c1"] }));
  c("archiviato · badge «Archiviato», «Pubblica» spento e il pannello lo dice", [true, true, true], [leggibile(h8).includes("Archiviato"), tastoPubblica(h8, "Pubblica").every(spento), leggibile(h8).includes("Il prodotto è archiviato: rimettilo in bozza per pubblicarlo.")]);

  // 8 · tutto a posto: «Pubblica» si accende e niente «Mancano»
  const pronto = scheda({ media: [foto()], categorie: ["c1"], prodotto: prodotto({ canali: { sito: true, meta: false, google: false, tiktok: false } }) });
  const h9 = await vedi(pronto);
  c("tutto a posto · «Pubblica» acceso (testata e barra), nessun «Mancano», il pannello dice «Tutto a posto»", [true, false, true], [tastoPubblica(h9, "Pubblica").length === 2 && tastoPubblica(h9, "Pubblica").every((b) => !spento(b)), /Mancano \d+ cose|Manca 1 cosa/.test(leggibile(h9)), leggibile(h9).includes("Tutto a posto: puoi pubblicare.")]);

  // Il disegno non fa mai rete
  c("il guscio non importa dal server né dal vecchio Avviso", [false, false], [/from\s+["'][^"']*\.server["']/.test(k), /\bAvviso\b/.test(k)]);
}
