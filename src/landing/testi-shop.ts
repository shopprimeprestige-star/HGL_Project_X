/** ── TESTI DELLO SHOP (vetrina V1) ───────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, V1 · T72 (PIANO-V1 D75, D77). Parola per parola dalla sezione 3 del documento
 *  `20-sito/2026-11-20-shop-completo.md` (§3.2-§3.6, §3.13, §3.14), per le sole pagine V1. Nessun componente scrive una parola:
 *  legge da qui (prova V1-T16: `prove/negozio/testi-shop.mjs`, confronto con `_testi-documento.json`).
 *  Si modificano dal CRM solo i testi di PAGINA (`CAMPI_TESTO_SHOP`); bottoni, etichette, errori e testi per chi non vede
 *  restano costanti (decisione del capo progetto, domanda 4).
 *  ⚠️ Le frasi che il documento lascia con un segnaposto aperto NON stanno qui: la riga di rischio e il contatto del 500 diventano
 *  voci di fiducia vere (D87) o i testi confermati `shop.conf.*`. Non si aggiungono qui finché il titolare non risponde.
 *  ⚠️ Mai: indirizzo dello studio, cifre di Invisible Derm, parole vietate (SPEC §12.4.1 n. 11).
 *  `{campo}` = valore messo da chi usa il testo (`riempi`). `[a]…[/a]` = la sola parola in accento (RichText). */

import { CHIAVI_TESTI, type ChiaveTesto } from "@/shop/cms/testi-confermati";
import type { SlotId } from "@/landing/testi-invisible-derm";

/** Una regola sola per «sì» delle liberatorie: quella della landing. */
export { liberatoriaOk } from "@/landing/testi-invisible-derm";

/** Mette i valori al posto dei segnaposto `{nome}`; uno senza valore resta com'è (si vede, mai «undefined»). */
export function riempi(testo: string, valori: Record<string, string | number | null | undefined>): string {
  return testo.replace(/\{(\w+)\}/g, (tutto, k: string) => {
    const v = Object.hasOwn(valori, k) ? valori[k] : undefined;
    return v === undefined || v === null ? tutto : String(v);
  });
}

export type CategoriaTesti = {
  slug: string;
  nome: string;
  titolo: string;
  frase: string;
  metaTitolo: string;
  metaDescrizione: string;
};

/** Le sei categorie del documento §3.4, nell'ordine del documento. Per «Colle e remover» e «Spazzole» la frase è quella
 *  accorciata (D97): l'intera vale solo dopo la scheda del fornitore. */
const CATEGORIE: CategoriaTesti[] = [
  {
    slug: "patch-pronte",
    nome: "Patch pronte",
    titolo: "Patch pronte, per risolvere senza attese.",
    frase: "Per chi ha già deciso di usare una patch classica e vuole scegliere con calma colore e misura.",
    metaTitolo: "Patch capillari pronte, scegli colore e misura",
    metaDescrizione: "Patch capillari pronte, da uno studio di Roma che le applica. Colore, misura e base: scegli con le nostre guide, o chiedici aiuto prima.",
  },
  {
    slug: "shampoo-e-balsami",
    nome: "Shampoo e balsami",
    titolo: "Shampoo e balsami per la patch",
    frase: "Pensati per lavare e tenere in ordine i capelli della patch.",
    metaTitolo: "Shampoo e balsami per patch capillari",
    metaDescrizione: "Shampoo e balsami per la cura della patch capillare. Come si usano e cosa fa ciascuno, spiegato da chi le applica.",
  },
  {
    slug: "districanti",
    nome: "Districanti",
    titolo: "Districanti per la patch",
    frase: "Per sciogliere i nodi dei capelli della patch quando li pettini.",
    metaTitolo: "Districanti per patch capillari",
    metaDescrizione: "Spray e oli districanti per i capelli della patch. Cosa fanno e come si usano, dalla scheda di ogni prodotto.",
  },
  {
    slug: "colle-e-remover",
    nome: "Colle e remover",
    titolo: "Colle e remover",
    frase: "Per fissare la patch e per toglierla.",
    metaTitolo: "Colle e remover per patch capillari",
    metaDescrizione: "Colle e solventi per applicare e rimuovere la patch. Compatibilità e uso indicati prodotto per prodotto.",
  },
  {
    slug: "spazzole",
    nome: "Spazzole",
    titolo: "Spazzole e pettini",
    frase: "Per pettinare la patch.",
    metaTitolo: "Spazzole per patch capillari",
    metaDescrizione: "Spazzole e pettini adatti ai capelli della patch, scelti e spiegati da uno studio di Roma.",
  },
  {
    slug: "kit",
    nome: "Kit",
    titolo: "Kit di cura",
    frase: "Più prodotti insieme: guarda cosa contiene ciascun kit.",
    metaTitolo: "Kit di cura per patch capillari",
    metaDescrizione: "Kit di cura per la patch: shampoo, balsamo, districante. Il contenuto è scritto nella scheda.",
  },
];

/** Tutti i testi che vengono dal documento. Un testo che il documento non dà NON va qui: va in `TESTI_PROVVISORI`. */
export const TESTI_SHOP = {
  header: {
    patch: "Patch pronte",
    cura: "Cura",
    consulenza: "Consulenza gratuita",
    carrello: "Carrello ({n})",
    carrelloAria: "Carrello, {n} prodotti",
    ricerca: "Cerca: colla, shampoo, colore…",
  },
  footer: {
    riga: "Hair Genius Labs · Roma",
    ragioneSociale: "HAIR GENIUS LABS SRLS · P.IVA 18486531009",
    colonnaShop: "Lo shop",
    colonnaLegale: "Legale",
    termini: "Termini di vendita",
    privacy: "Privacy",
    cookie: "Cookie",
    copyright: "© {anno} Hair Genius Labs. Tutti i diritti riservati.",
  },
  popup: {
    titolo: "Prima di andare",
    testo: "Non sai quale patch scegliere? Ti aiutiamo noi, prima che tu ordini. Una videochiamata, gratis.",
    bottone: "Consulenza gratuita",
    rifiuto: "No, grazie",
  },
  err404: {
    titolo: "Questa pagina non c'è.",
    testo: "Può darsi che il prodotto non sia più in vendita o che il link sia vecchio.",
    bottone: "Patch pronte",
    link: "Cura",
  },
  // Il contatto del documento non è ancora deciso: la pagina lo mostra solo se `assistenza` è un testo confermato (D87).
  err500: {
    titolo: "C'è un problema da parte nostra.",
    testo: "Il carrello è al sicuro. Riprova tra poco.",
  },
  hero: {
    eyebrow: "HAIR GENIUS SHOP · ROMA",
    h1: "[a]PATCH[/a] capillari pronte, da chi le applica.",
    sottotitolo: "Scegli, ordina, ricevi. Se non sai quale scegliere, chiedilo prima: la consulenza è gratuita e online.",
    cta1: "Patch pronte",
    cta2: "Cura e manutenzione",
    riga: "Applichiamo patch a Roma ogni giorno.",
    // `{nome}` = il testo confermato `firmatario` (D96); senza, ritratto e nome spariscono e resta la riga.
    didascalia: "{nome}, Hair Genius Labs",
  },
  fascia: {
    studio: "Studio a Roma",
    consulenza: "Consulenza gratuita, online",
  },
  vetrina: {
    titolo: "Da qui si parte",
    // Il documento lascia scegliere fra due; finché non ci sono dati veri di vendita vale «Le nostre patch pronte» (D78).
    sottotitolo: "Le nostre patch pronte",
    link: "Vedi tutte le patch pronte →",
  },
  categorie: CATEGORIE,
  categoria: {
    filtri: {
      colore: "Colore",
      misura: "Misura",
      base: "Base",
      disponibile: "Disponibile",
      filtra: "Filtra ({n})",
      azzera: "Azzera filtri",
    },
    vuoto: "Con questi filtri non c'è niente. Togline uno e riprova.",
    bloccoTitolo: "Non sai quale scegliere?",
    bloccoTesto: "Una videochiamata con noi, gratis, e ti diciamo cosa serve davvero.",
    bloccoLink: "Consulenza gratuita →",
  },
  card: {
    prontaConsegna: "Pronta consegna",
    aggiungi: "Aggiungi",
    scegli: "Scegli",
  },
  scheda: {
    spedizione: "Spedizione: {costo}, {tempi}.",
    varianti: { colore: "Colore", misura: "Misura", lunghezza: "Lunghezza", base: "Base" },
    sceltaVariante: "{colore} · {misura}",
    esaurito: "Esaurito",
    aggiungi: "Aggiungi al carrello",
    aggiunto: "Aggiunto",
    nelCarrello: "{nome} è nel carrello",
    vaiAlCarrello: "Vai al carrello",
    coloreTitolo: "Il colore, alla luce del giorno",
    coloreTesto: "A schermo i colori possono cambiare. Nelle foto vedi il campione alla luce del giorno, vicino a una base vera.",
    coloreLink: "Guarda come si abbina il colore",
    coloreChiusura: "Hai dubbi tra due tonalità? Scrivici, scegliamo insieme.",
    confezione: "Nella confezione",
    comeSiUsa: "Come si usa",
    schedaTecnica: "Scheda tecnica",
    faq: "Domande frequenti",
    boxTitolo: "Non è il prodotto giusto per te?",
    boxTesto:
      "Succede. Se la tua patch si stacca presto, si vede o si annoda, il problema di solito non è il colore: serve un'altra strada. Si chiama Invisible Derm Protocol®: un sistema su misura, sottile e naturale. Il costo lo vedi in consulenza.",
    boxBottone: "Parlane con noi, gratis",
    tiServeAnche: "Ti serve anche",
  },
  carrello: {
    titolo: "Il tuo carrello",
    sottotitolo: "Controlla e vai alla cassa. Non paghi niente finché non lo decidi tu.",
    prodotti: "Prodotti",
    spedizione: "Spedizione",
    totale: "Totale",
    ivaInclusa: "IVA inclusa",
    togli: "Togli",
    tiServeAnche: "Ti serve anche: {nome}",
    vaiAllaCassa: "Vai alla cassa",
    continua: "Continua a guardare",
    vuotoTitolo: "Il carrello è vuoto.",
    vuotoTesto: "Da qui puoi partire: scegli una patch o qualcosa per tenerla bene.",
    vuotoBottone1: "Patch pronte",
    vuotoBottone2: "Cura e manutenzione",
    vuotoLink: "Non sai cosa scegliere? Consulenza gratuita",
    quantitaRidotta: "Di questo prodotto ne abbiamo {n}. Abbiamo portato la quantità a {n}.",
    nonDisponibile: "“{nome}” non è più disponibile. L'abbiamo tolto dal carrello.",
  },
  microtesti: {
    ricercaVuota: "Non troviamo “{testo}”. Prova con un'altra parola, o chiedici aiuto.",
    connessionePersa: "Sembra che la connessione si sia interrotta. Controlla e riprova: il carrello è com'era.",
    attesaPagina: "Un attimo…",
    attesaCarrello: "Aggiungiamo al carrello…",
  },
  meta: {
    home: {
      titolo: "Patch capillari pronte e cura per la patch | Hair Genius",
      descrizione: "Patch capillari pronte e prodotti per la cura, da uno studio di Roma che le applica. Non sai cosa scegliere? Consulenza gratuita online.",
    },
    scheda: {
      titolo: "{nome} | Hair Genius Shop",
      descrizione: "{riga}. {frase}. Da uno studio di Roma che applica patch.",
    },
    carrello: { titolo: "Il tuo carrello | Hair Genius Shop" },
  },
};

/** ── TESTI PROVVISORI ────────────────────────────────────────────────────────
 *  Servono alle pagine V1 ma il documento non li dà (PIANO-V1 T72: non si inventano in silenzio). Sono scelti senza parole
 *  vietate e brevi, e sono elencati in lavagna per il copywriter, che li conferma o li sostituisce QUI, in un punto solo. */
export const TESTI_PROVVISORI = {
  card: {
    scopri: "Scopri", // bottone di contorno di Invisible Derm in card e ricerca: nessuna cifra, nessun «Aggiungi»
    nColori: "{n} colori",
    da: "Da {prezzo}", // davanti al prezzo quando le varianti costano cifre diverse («Da 289,00 €»): provvisoria, per il copywriter
  },
  guscio: {
    vaiAlContenuto: "Vai al contenuto",
    apriMenu: "Apri il menu",
    chiudiMenu: "Chiudi il menu",
    cerca: "Cerca",
    carrelloAriaUno: "Carrello, 1 prodotto", // il documento dà solo il plurale («Carrello, {n} prodotti»)
    logoAlt: "Hair Genius Labs", // il nome del marchio, come nella landing
  },
  cerca: {
    titolo: "Risultati per “{testo}”",
    metaTitolo: "Cerca | Hair Genius Shop",
  },
  filtri: {
    titolo: "Filtri",
    mostra: "Mostra {n} prodotti",
  },
  galleria: {
    ingrandisci: "Ingrandisci la foto",
    numero: "Foto {n} di {m}",
    precedente: "Foto precedente",
    successiva: "Foto successiva",
    chiudi: "Chiudi la foto",
  },
  scheda: {
    cosaContiene: "Cosa contiene", // kit: elenco di testo (D81)
    avvertenze: "Avvertenze",
    trascrizione: "Leggi il testo del video", // lo stesso testo già approvato per la landing
    anteprimaStriscia: "Anteprima: questo prodotto non è in vendita.",
    anteprimaRiquadro: "Mostra cosa è nascosto", // titolo del riquadro ambra (D94)
    // Messaggio accanto alla scelta mancante quando si preme «Aggiungi» (V1-S3). Il documento lo lascia al copywriter («tipo "Scegli il colore."»):
    // provvisorio: il copywriter lo sostituisce QUI. La chiave `scheda.scegli.<opzione>` è quella che dà `messaggioMancante` (T78).
    scegli: {
      colore: "Scegli il colore.",
      misura: "Scegli la misura.",
      lunghezza: "Scegli la lunghezza.",
      base: "Scegli la base.",
    },
  },
  carrello: {
    quantita: "Quantità",
    diminuisci: "Diminuisci la quantità",
    aumenta: "Aumenta la quantità",
    annuncio: "{nome}: quantità {n}", // la regione che lo dice a chi non vede la riga (T89)
  },
  errore: { riprova: "Riprova" },
};

/** Modello della descrizione (alt) della foto di una categoria (documento §3.14). Le foto dei prodotti hanno la loro nel CMS. */
export const ALT_MODELLI_SHOP = {
  categoria: "{categoria}: {n} prodotti in fila su fondo chiaro",
};

/** ── SLOT MEDIA (D95: solo quelli usati da V1) ───────────────────────────────
 *  Le foto delle categorie e dei prodotti vengono dal CMS, non da qui. Chiavi `shop.*`, bucket `landing-media`. */
export const SLOT_SHOP: SlotId[] = [
  { chiave: "shop.heroFoto", label: "Hero dello shop · foto, 4:5, 1200 × 1500", tipo: "image" },
  { chiave: "shop.titolareFoto", label: "Hero dello shop · ritratto del titolare, quadrata 1:1 ≥ 800 px, sguardo in basso a destra", tipo: "image" },
  { chiave: "shop.pacco", label: "Scheda · «Nella confezione», foto della confezione chiusa, 4:3", tipo: "image" },
  { chiave: "shop.coloriFoto", label: "Scheda patch · «Il colore, alla luce del giorno», anello colori, 4:3", tipo: "image" },
  { chiave: "shop.coloriVideo", label: "Scheda patch · video «come si abbina il colore», 4:5", tipo: "video" },
  { chiave: "shop.coloriPoster", label: "Scheda patch · copertina del video dei colori, 4:5", tipo: "image" },
  { chiave: "shop.curaVideo", label: "Schede cura e kit · video «cosa serve per tenerla bene», 4:5", tipo: "video" },
  { chiave: "shop.curaPoster", label: "Schede cura e kit · copertina del video della cura, 4:5", tipo: "image" },
  { chiave: "shop.condivisione", label: "Immagine di condivisione della home, 1200 × 630 (senza: si usa la foto dell'hero)", tipo: "image" },
];

/** Descrizioni (alt) modificabili dal CRM: chiave `<slot>.alt` → valore di partenza. Documento §3.14. Un video e la sua
 *  copertina hanno la stessa descrizione (come nella landing). */
const ALT_COLORI_VIDEO = "Video: come si abbina il colore di una patch alla luce del giorno";
// Provvisoria: il documento non dà la descrizione del video della cura (elencata in lavagna per il copywriter).
const ALT_CURA_VIDEO = "Video: cosa serve per tenere in ordine una patch";
export const ALT_SHOP: Record<string, string> = {
  "shop.heroFoto.alt": "Patch capillare pronta su un supporto, vista dall'alto, con l'attaccatura in primo piano",
  "shop.titolareFoto.alt": "{nome} di Hair Genius Labs in studio, a Roma", // `{nome}` = `firmatario`; senza nome il ritratto non si disegna
  "shop.pacco.alt": "La confezione dell'ordine, chiusa, con l'etichetta Hair Genius Labs",
  "shop.coloriFoto.alt": "Anello colori con i campioni alla luce del giorno, vicino alla pelle",
  "shop.coloriVideo.alt": ALT_COLORI_VIDEO,
  "shop.coloriPoster.alt": ALT_COLORI_VIDEO,
  "shop.curaVideo.alt": ALT_CURA_VIDEO,
  "shop.curaPoster.alt": ALT_CURA_VIDEO,
};

/** ── CAMPI DELL'EDITOR (sezione «Shop» della pagina landing del CRM, D75) ────
 *  Solo i testi di pagina (≈ 22), i sei testi confermati e i campi di servizio. Un testo svuotato nasconde la riga. */
export type CampoTestoShop = { chiave: string; label: string; tipo: "text" | "textarea"; default: string; hint?: string };

const T = TESTI_SHOP;
const TESTI_PAGINA: CampoTestoShop[] = [
  { chiave: "shop.hero.eyebrow", label: "Home · sopratitolo", tipo: "text", default: T.hero.eyebrow },
  { chiave: "shop.hero.h1", label: "Home · titolo (una sola parola in accento: [a]parola[/a])", tipo: "textarea", default: T.hero.h1 },
  { chiave: "shop.hero.sottotitolo", label: "Home · sottotitolo", tipo: "textarea", default: T.hero.sottotitolo },
  { chiave: "shop.hero.cta1", label: "Home · bottone pieno", tipo: "text", default: T.hero.cta1 },
  { chiave: "shop.hero.cta2", label: "Home · bottone di contorno", tipo: "text", default: T.hero.cta2 },
  { chiave: "shop.hero.riga", label: "Home · riga sotto il ritratto", tipo: "text", default: T.hero.riga },
  { chiave: "shop.hero.didascalia", label: "Home · didascalia del ritratto", tipo: "text", default: T.hero.didascalia, hint: "{nome} è il nome scritto in «Firmatario» qui sotto. Senza quel nome, ritratto e didascalia non compaiono." },
  { chiave: "shop.fascia.studio", label: "Home · fascia di fiducia, studio", tipo: "text", default: T.fascia.studio },
  { chiave: "shop.fascia.consulenza", label: "Home · fascia di fiducia, consulenza", tipo: "text", default: T.fascia.consulenza },
  { chiave: "shop.vetrina.titolo", label: "Home · vetrina, titolo", tipo: "text", default: T.vetrina.titolo },
  { chiave: "shop.vetrina.sottotitolo", label: "Home · vetrina, sottotitolo", tipo: "text", default: T.vetrina.sottotitolo },
  { chiave: "shop.vetrina.link", label: "Home · vetrina, link finale", tipo: "text", default: T.vetrina.link },
  { chiave: "shop.cat.blocco.titolo", label: "Categorie · blocco finale, titolo", tipo: "text", default: T.categoria.bloccoTitolo },
  { chiave: "shop.cat.blocco.testo", label: "Categorie · blocco finale, testo", tipo: "textarea", default: T.categoria.bloccoTesto },
  { chiave: "shop.cat.blocco.link", label: "Categorie · blocco finale, link", tipo: "text", default: T.categoria.bloccoLink },
  { chiave: "shop.carrello.vuoto.titolo", label: "Carrello vuoto · titolo", tipo: "text", default: T.carrello.vuotoTitolo },
  { chiave: "shop.carrello.vuoto.testo", label: "Carrello vuoto · testo", tipo: "textarea", default: T.carrello.vuotoTesto },
  { chiave: "shop.carrello.vuoto.link", label: "Carrello vuoto · link piccolo", tipo: "text", default: T.carrello.vuotoLink },
  { chiave: "shop.err404.titolo", label: "Pagina non trovata · titolo", tipo: "text", default: T.err404.titolo },
  { chiave: "shop.err404.testo", label: "Pagina non trovata · testo", tipo: "textarea", default: T.err404.testo },
  { chiave: "shop.err500.titolo", label: "Errore del sito · titolo", tipo: "text", default: T.err500.titolo },
  { chiave: "shop.err500.testo", label: "Errore del sito · testo", tipo: "textarea", default: T.err500.testo },
];

/** I testi di servizio confermati dal titolare (D63, D77): le chiavi vengono da `CHIAVI_TESTI`, mai riscritte qui.
 *  Partono VUOTI: finché sono vuoti la riga non compare. Per aggiungerne una si aggiunge a `CHIAVI_TESTI` e qui il compilatore
 *  chiede la sua etichetta. */
const ETICHETTE_CONFERMATI: Record<ChiaveTesto, string> = {
  reso: "Reso · la regola in una frase",
  assistenza: "Assistenza · come ci si mette in contatto",
  assistenza_whatsapp: "Assistenza WhatsApp · numero e orari",
  pronta_consegna: "Pronta consegna · scrivi qualcosa solo se è vero (accende il badge sui prodotti disponibili)",
  garanzia: "Garanzia · il testo, solo quando è deciso",
  firmatario: "Firmatario · il nome del titolare, come si legge accanto al ritratto",
};

/** Le chiavi dei testi confermati nell'editor: «shop.conf.» + CHIAVI_TESTI, nello stesso ordine (D77). */
export const CAMPI_CONFERMATI: string[] = CHIAVI_TESTI.map((k) => `shop.conf.${k}`);

export const CAMPI_TESTO_SHOP: CampoTestoShop[] = [
  ...TESTI_PAGINA,
  ...CHIAVI_TESTI.map(
    (k): CampoTestoShop => ({ chiave: `shop.conf.${k}`, label: ETICHETTE_CONFERMATI[k], tipo: "text", default: "", hint: "Lascia vuoto finché non è deciso: la riga non compare." }),
  ),
  // Come `CAMPI_TESTO_ID`: la trascrizione e la liberatoria partono vuote.
  { chiave: "shop.coloriTrascrizione", label: "Testo parlato del video dei colori (per «Leggi il testo del video»)", tipo: "textarea", default: "" },
  { chiave: "shop.curaTrascrizione", label: "Testo parlato del video della cura (per «Leggi il testo del video»)", tipo: "textarea", default: "" },
  { chiave: "shop.clienti.liberatoria", label: "Media con persone: scrivi «sì» solo se hai la liberatoria scritta di chi è ritratto", tipo: "text", default: "" },
];
