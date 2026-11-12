/** ── TESTI DELLA LANDING /invisible-derm ───────────────────────────────────
 *  Parola per parola dalla sezione 3 del documento `20-sito/2026-11-12-landing-invisible-derm.md`,
 *  con le decisioni del capo progetto: versioni `[SE test]` («resistente») e riga Hollywood
 *  «Ci risulta…» visibile, una volta sola.
 *  ⚠️ Le voci `{{da confermare}}` NON stanno in questo file (non basta nasconderle col CSS):
 *   posa/spessore/tenuta/frequenza nella tabella, garanzia nelle domande, nome e ruolo del titolare,
 *   anni e installazioni. Quando il titolare risponde, si aggiungono qui.
 *  ⚠️ Mai prezzi, scadenze, scarsità, numeri o recensioni non confermati.
 *  `[a]…[/a]` = parola in accento (RichText). */

export const BOTTONE = "Prenota la consulenza gratuita";
export const RIGA_BOTTONE = "Gratis, online, in videochiamata.";
export const DIDASCALIA_COPPIA = "10 cm, luce dello studio.";

export const META = {
  titolo: "Invisible Derm a Roma | Sottile, ma resistente",
  descrizione:
    "Invisible Derm, l'evoluzione della patch: sottile, ma resistente. Su misura, senza chirurgia, in meno di 2 ore a Roma. Consulenza gratuita online.",
};

export const MARCHIO = {
  indirizzo: "Studio a Roma · Via degli Scipioni 132",
  altLogo: "Hair Genius Labs",
};

export const HERO = {
  sopratitolo: ["Invisible Derm", "solo da noi, a Roma"],
  h1: "Invisible Derm: il sistema di capelli [a]sottile, ma resistente[/a].",
  sottotitolo:
    "L'evoluzione della patch. Su misura per te, senza chirurgia, in meno di 2 ore. Solo da noi, a Roma.",
  pillole: ["Sottile, ma resistente", "Su misura, senza chirurgia", "Posa in meno di 2 ore, tutti i giorni"],
  titoloModulo: BOTTONE,
  didascaliaFoto: "Da 10 centimetri, alla luce dello studio.",
};

export const COSE = {
  sopratitolo: "Che cos'è",
  h2: "Che cos'è Invisible Derm.",
  definizione: "Un sistema di capelli su misura, sottile e naturale, senza chirurgia. L'evoluzione della patch.",
  corpo: "Invisible Derm Protocol® è il sistema che usiamo in studio, a Roma. Lo facciamo solo noi: abbiamo l'esclusiva.",
  fatti: [
    { titolo: "Evoluzione della patch.", testo: "Parte dall'idea della patch cutanea e fa un passo avanti." },
    { titolo: "Su misura.", testo: "Sul tuo colore, sulla tua densità, sulla tua attaccatura." },
    { titolo: "Solo da noi.", testo: "Abbiamo l'esclusiva di Invisible Derm." },
  ],
  copertinaVideo: "Te lo spiego in 30 secondi.",
  linkTrascrizione: "Leggi il testo del video",
};

export const CONFRONTO = {
  sopratitolo: "Il confronto",
  h2: "Patch standard e Invisible Derm. [a]Stessa luce, stessa distanza.[/a]",
  sottotitolo: "Non devi fidarti di una frase. Guarda.",
  istruzione: "Trascina per confrontare.",
  etichette: { patch: "Patch standard", derm: "Invisible Derm" },
  coppie: [
    { titolo: "Attaccatura frontale", chiave: "id.confronto1", alt: "Attaccatura frontale a confronto, a sinistra una patch standard, a destra Invisible Derm, sulla stessa testa, da 10 centimetri." },
    { titolo: "Bordo e profilo", chiave: "id.confronto2", alt: "Bordo e profilo a confronto, patch standard e Invisible Derm, stessa luce e stessa distanza." },
    { titolo: "Piega e movimento", chiave: "id.confronto3", alt: "Un pettine solleva i capelli sulla patch standard e su Invisible Derm, con lo stesso gesto." },
  ],
  didascaliaCoppia3: "Il pettine solleva, il dito passa. Stesso gesto su tutte e due.",
  riga: "La patch standard va bene per molti, e la facciamo anche noi. Qui vedi dove Invisible Derm fa un passo in più.",
  videoTitolo: "Le due in mano, 40 secondi",
  videoDidascalia: "Il titolare le mette una accanto all'altra e te le spiega, senza giudicare.",
  videoAlt: "Il titolare tiene in mano una patch standard e un sistema Invisible Derm e li confronta.",
};

export const RESISTENTE = {
  sopratitolo: "Sottile, ma resistente",
  h2: "[a]Sottile.[/a] E non per questo fragile.",
  introduzione: "Sottile fa pensare a fragile. Per questo ti facciamo vedere tutte e due le cose, una alla volta.",
  sottile: {
    numero: "01",
    kicker: "01 · Sottile",
    titolo: "Sottile",
    testo: "Il bordo è il punto che si guarda di più. Per questo lo mostriamo da vicino, accanto alla patch standard.",
    didascalia: "Da 10 centimetri, alla luce dello studio.",
    alt: "Macro del bordo di Invisible Derm con un calibro accanto, ripreso in camera.",
  },
  resistente: {
    numero: "02",
    kicker: "02 · Resistente",
    titolo: "Resistente",
    testo: "Un solo test, in una sola ripresa, senza stacchi. Lo stesso test sulla patch standard, accanto. Quello che vedi è quello che è successo.",
    didascalia: "Trazione, in una ripresa unica.",
    alt: "Test di trazione ripreso senza stacchi, su Invisible Derm e sulla patch standard, una accanto all'altra.",
  },
  ogniGiorno: {
    numero: "03",
    titolo: "Per ogni giorno",
    testo: "Mare, doccia, palestra, phon. Le clip sono girate così come sono, senza ritocchi.",
    // l'ordine è quello delle chiavi id.vita1..4
    clip: [
      { etichetta: "Mare", alt: "Clip ripresa così com'è: mare, con un sistema Invisible Derm." },
      { etichetta: "Doccia", alt: "Clip ripresa così com'è: doccia, con un sistema Invisible Derm." },
      { etichetta: "Palestra", alt: "Clip ripresa così com'è: palestra, con un sistema Invisible Derm." },
      { etichetta: "Phon", alt: "Clip ripresa così com'è: phon, con un sistema Invisible Derm." },
    ],
    etichettaRegione: "Clip di vita quotidiana",
  },
  simbolo: {
    didascalia: "Sottile, ma resistente, nello stesso fotogramma.",
    alt: "Membrana tesa controfuoco: sottile, ma resistente, nello stesso fotogramma.",
  },
  // Versione B «Ci risulta…», una volta sola in tutta la pagina (decisione del capo progetto).
  hollywood:
    "Ci risulta che sia usato anche da persone dello spettacolo di Hollywood. Per noi conta una cosa sola: che vada bene in un giorno qualsiasi, non solo in una sera di gala.",
};

export const TABELLA = {
  sopratitolo: "Riga per riga",
  h2: "Patch standard e Invisible Derm, riga per riga.",
  caption: "Patch standard e Invisible Derm a confronto, riga per riga",
  intestazioni: ["Patch standard", "Invisible Derm"] as const,
  righe: [
    { nome: "Pronta o su misura", patch: "Pronta", derm: "Su misura: colore, densità, attaccatura" },
    { nome: "Chirurgia", patch: "No", derm: "No" },
    { nome: "Manutenzione", patch: "Periodica", derm: "Periodica, circa 10 minuti" },
    { nome: "Solo da noi", patch: "–", derm: "Sì, abbiamo l'esclusiva" },
  ],
  limiteApertura: "Ti dico anche le cose scomode, prima che le chieda tu.",
  limite:
    "Serve una manutenzione periodica, circa 10 minuti. Invisible Derm copre la mancanza di capelli: non ferma la caduta. E non è la risposta giusta per tutti.",
  chiusura: "In consulenza valutiamo anche trapianto e patch standard. Se per te è meglio un'altra strada, te lo diciamo.",
};

export const STUDIO = {
  sopratitolo: "Chi siamo",
  h2: "Uno studio vero, a Roma.",
  corpo:
    "Hair Genius Labs. Via degli Scipioni 132, Roma. Qui facciamo la posa di Invisible Derm, di cui abbiamo l'esclusiva. La consulenza la fai prima, online, da casa.",
  indirizzo: ["Hair Genius Labs", "Via degli Scipioni 132 · Roma"],
  altTitolare: "Il titolare di Hair Genius Labs nello studio di Roma.",
  didascalie: ["Ingresso, via degli Scipioni 132", "La sala interna", "La postazione di posa", "Lo studio in 20 secondi"],
  alt: [
    "Ingresso dello studio Hair Genius Labs con il numero civico 132 in via degli Scipioni, a Roma.",
    "La sala interna dello studio.",
    "La postazione dove si fa la posa di Invisible Derm.",
    "Un giro dello studio di Roma, in 20 secondi.",
  ],
};

export const PASSI = {
  sopratitolo: "Come funziona",
  h2: "Dalla videochiamata allo specchio, in giornata.",
  passi: [
    { titolo: "Scegli giorno e ora", testo: "Lo fai nel calendario qui sotto. Ci vuole un minuto." },
    { titolo: "Consulenza gratuita, online", testo: "In videochiamata guardiamo il tuo caso. Insieme scegliamo fra trapianto, patch standard o Invisible Derm." },
    { titolo: "La posa, a Roma", testo: "Se è Invisible Derm, lo facciamo su misura. Ci vogliono meno di 2 ore. Tutto in giornata. Dal lunedì alla domenica, a qualsiasi orario." },
  ],
  fuoriRoma: "Vieni da fuori Roma? Non devi dormire qui e non devi tornare un'altra volta.",
  videoDidascalia: "La posa, accelerata: dall'inizio allo specchio.",
  videoAlt: "La posa di Invisible Derm in un video accelerato di 30 secondi, dall'inizio fino allo specchio.",
};

export const FAQ = {
  sopratitolo: "Domande",
  h2: "Le domande che ci fanno più spesso.",
  voci: [
    { q: "Si vede?", a: "Guardalo tu. Nella sezione del confronto trovi Invisible Derm e una patch standard, con la stessa luce e a 10 centimetri. Sul tuo caso lo vediamo insieme in consulenza." },
    { q: "Regge nella vita di tutti i giorni?", a: "Nella sezione «Sottile, ma resistente» vedi un test ripreso in un'unica scena. Non ti promettiamo niente che non abbiamo ripreso." },
    { q: "Ho già provato una patch e non è andata. Perché dovrebbe andare?", a: "Non ti dico che andrà meglio: ti faccio vedere la differenza e ti spiego cosa è cambiato. In consulenza mi racconti cosa non ha funzionato. Se la strada giusta è un'altra, te lo dico." },
    { q: "Quanto costa?", a: "Dipende da cosa serve: è su misura. Te lo diciamo in consulenza, dopo aver guardato il tuo caso." },
    { q: "In cosa è diversa da una patch standard?", a: "La patch standard è pronta; Invisible Derm si prepara su misura, sul tuo colore, sulla tua densità, sulla tua attaccatura. Entrambe si fanno senza chirurgia. La patch standard la facciamo anche noi: la differenza la vedi nel confronto, riga per riga." },
    { q: "Quanta manutenzione serve?", a: "Una manutenzione periodica, circa 10 minuti." },
    { q: "Com'è la consulenza? Devo decidere subito?", a: "È gratuita e si fa online, in videochiamata. Guardiamo il tuo caso e capiamo se la soluzione più indicata è trapianto, patch standard o Invisible Derm. Non devi decidere niente subito." },
  ],
  rigaFinale: "Hai ancora un dubbio? Chiedilo in videochiamata, è gratis.",
};

export const PRENOTA = {
  sopratitolo: "La consulenza",
  h2: "Prenota la consulenza gratuita.",
  sottotitolo:
    "Online, in videochiamata. Guardiamo il tuo caso e ti diciamo quale soluzione è più indicata: trapianto, patch standard o Invisible Derm.",
  righe: ["Gratuita, senza impegno", "Anche in videochiamata, da casa", "Se la strada giusta non è Invisible Derm, te lo diciamo."],
  privacy: "Usiamo i tuoi dati solo per la consulenza.",
};

export const BARRA = { chiudi: "Chiudi la barra" };

export const FOOTER = {
  riga: "Hair Genius Labs · Via degli Scipioni 132, Roma",
  // Gli stessi dati già pubblici nel Footer della home (4.13 del documento).
  ragioneSociale: "HAIR GENIUS LABS SRLS · P.IVA 18486531009",
};

/** I media caricabili dal CRM (chiavi `id.*`). `alt` = valore di partenza della descrizione (`<chiave>.alt`). */
export type SlotId = { chiave: string; label: string; tipo: "image" | "video"; alt?: string };
export const SLOT_ID: SlotId[] = [
  { chiave: "id.titolareFoto", label: "Ritratto del titolare, quadrata 1:1 ≥ 600 px, ≤ 200 KB", tipo: "image", alt: STUDIO.altTitolare },
  { chiave: "id.heroFoto", label: "Foto macro dell'hero, 4:5 1080×1350, ≤ 300 KB (attaccatura nel 25-60% dell'altezza)", tipo: "image", alt: "Primo piano dell'attaccatura con un sistema Invisible Derm, ripreso da 10 centimetri alla luce dello studio." },
  { chiave: "id.presentazioneVideo", label: "Video del titolare «Che cos'è Invisible Derm», 9:16, 30-40 s, sottotitoli impressi, ≤ 25 MB", tipo: "video", alt: "Il titolare spiega che cos'è Invisible Derm." },
  { chiave: "id.presentazionePoster", label: "Copertina del video del titolare, 4:5", tipo: "image", alt: "Il titolare guarda in camera, pronto a spiegare che cos'è Invisible Derm." },
  { chiave: "id.confronto1.patch", label: "Confronto 1 · patch standard, 4:5 (stessa testa, luce e distanza)", tipo: "image" },
  { chiave: "id.confronto1.derm", label: "Confronto 1 · Invisible Derm, 4:5 (stessa inquadratura della patch)", tipo: "image" },
  { chiave: "id.confronto2.patch", label: "Confronto 2 · patch standard, ravvicinata ≥ 1920 px", tipo: "image" },
  { chiave: "id.confronto2.derm", label: "Confronto 2 · Invisible Derm, ravvicinata ≥ 1920 px", tipo: "image" },
  { chiave: "id.confronto3.patchClip", label: "Confronto 3 · clip patch standard, 3:4, muta, 6-8 s, ≤ 2,5 MB", tipo: "video" },
  { chiave: "id.confronto3.dermClip", label: "Confronto 3 · clip Invisible Derm, 3:4, muta, stessa durata, ≤ 2,5 MB", tipo: "video" },
  { chiave: "id.confronto3.patch", label: "Confronto 3 · foto patch standard, 4:5 (solo se mancano le clip)", tipo: "image" },
  { chiave: "id.confronto3.derm", label: "Confronto 3 · foto Invisible Derm, 4:5 (solo se mancano le clip)", tipo: "image" },
  { chiave: "id.confrontoVideo", label: "Video «Le due in mano», 9:16, 40-50 s, sottotitoli impressi", tipo: "video", alt: CONFRONTO.videoAlt },
  { chiave: "id.confrontoVideoPoster", label: "Copertina del video «Le due in mano», 4:5", tipo: "image", alt: CONFRONTO.videoAlt },
  { chiave: "id.limiteVideo", label: "Il limite · video della voce del titolare, 9:16, 15 s", tipo: "video", alt: "Il titolare spiega i limiti di Invisible Derm." },
  { chiave: "id.limitePoster", label: "Il limite · copertina del video, 4:5", tipo: "image", alt: "Il titolare spiega i limiti di Invisible Derm." },
  { chiave: "id.sottileFoto", label: "Pilastro Sottile · macro del bordo con calibro, 4:3", tipo: "image", alt: RESISTENTE.sottile.alt },
  { chiave: "id.testVideo", label: "Pilastro Resistente · test in un'unica ripresa, 4:5, 20-30 s", tipo: "video", alt: RESISTENTE.resistente.alt },
  { chiave: "id.testPoster", label: "Pilastro Resistente · copertina del test, 4:5", tipo: "image", alt: RESISTENTE.resistente.alt },
  ...RESISTENTE.ogniGiorno.clip.map((c, i): SlotId => ({ chiave: `id.vita${i + 1}`, label: `Per ogni giorno · clip ${c.etichetta}, 3:4, muta, 6-8 s, ≤ 2,5 MB`, tipo: "video", alt: c.alt })),
  { chiave: "id.simboloFoto", label: "Immagine-simbolo, membrana tesa controfuoco, 21:9", tipo: "image", alt: RESISTENTE.simbolo.alt },
  { chiave: "id.studio1", label: "Studio · ingresso col civico 132, 16:10", tipo: "image", alt: STUDIO.alt[0] },
  { chiave: "id.studio2", label: "Studio · sala interna, 4:3", tipo: "image", alt: STUDIO.alt[1] },
  { chiave: "id.studio3", label: "Studio · postazione di posa, 4:3", tipo: "image", alt: STUDIO.alt[2] },
  { chiave: "id.studioVideo", label: "Studio · giro di 20 s, 16:9, muto, ≤ 8 MB", tipo: "video", alt: STUDIO.alt[3] },
  { chiave: "id.posaVideo", label: "Come funziona · posa accelerata, 16:9, 30 s, muta", tipo: "video", alt: PASSI.videoAlt },
  { chiave: "id.posaPoster", label: "Come funziona · copertina della posa, 16:9", tipo: "image", alt: PASSI.videoAlt },
];

/** Le descrizioni (alt) modificabili dal CRM: chiave `<slot>.alt` → valore di partenza. */
export const ALT_ID: Record<string, string> = {
  ...Object.fromEntries(SLOT_ID.filter((s) => s.alt).map((s) => [`${s.chiave}.alt`, s.alt as string])),
  ...Object.fromEntries(CONFRONTO.coppie.map((c) => [`${c.chiave}.alt`, c.alt])),
};

/** Gli altri campi di testo del CRM. Le liberatorie sono un campo in cui si scrive «sì» (il CRM non ha ancora un vero interruttore). */
export const CAMPI_TESTO_ID = [
  { chiave: "id.confronto.liberatoria", tipo: "text", label: "Confronti e clip con persone: scrivi «sì» solo se hai la liberatoria scritta di chi è ritratto" },
  { chiave: "id.vita.liberatoria", tipo: "text", label: "Clip «Per ogni giorno»: scrivi «sì» solo se hai la liberatoria scritta di chi è ritratto" },
  { chiave: "id.presentazioneTrascrizione", tipo: "textarea", label: "Testo parlato del video del titolare (per «Leggi il testo del video»)" },
  { chiave: "id.confrontoVideoTrascrizione", tipo: "textarea", label: "Testo parlato del video «Le due in mano» (per «Leggi il testo del video»)" },
] as const;

/** «sì» in qualunque grafia ragionevole; vuoto o altro = liberatoria non confermata. */
export function liberatoriaOk(valore: string): boolean {
  return /^s[iì]$/i.test(valore.trim());
}
