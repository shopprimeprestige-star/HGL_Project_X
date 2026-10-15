/** ── PROVE DEI TESTI DEL SITO (compito B8) ─────────────────────────────────
 *  `node prove/sito/testi.mjs`. `src/landing/testi-sito.ts` è l'unico posto di
 *  nome, interruttori, link e testi del sito pubblico (SPEC «Decido io» 11).
 *  Cosa copre: che il contratto del giro 2 ci sia tutto con i nomi esatti, che
 *  i file provvisori di D e C non esistano più e nessuno li importi, che nei
 *  testi non ci siano prezzi né parole vietate né il vecchio nome, e che gli
 *  interruttori siano spenti.
 *  ───────────────────────────────────────────────────────────────────────── */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";
import { FRASI_AMMESSE, togliFrasiAmmesse } from "./_frasi-ammesse.mjs";

const { c, vero, finisci } = nuovaProva("testi del sito");
const T = await carica("src/landing/testi-sito.ts", "testi-sito");

/* ── 1. IL NOME: un posto solo ──────────────────────────────────────────── */
c("nome corto", "Invisible Derm", T.NOME_PRODOTTO);
c("nome esteso", "Invisible Derm Protocol®", T.NOME_PRODOTTO_ESTESO);

/* ── 2. INTERRUTTORI, LINK E DATI DEL CONTRATTO (tutti spenti / vuoti) ───── */
c("interruttori: solo le quattro chiavi del contratto", ["fotoConConsenso", "linkShopDiProva", "popupUscita", "testBottone"], Object.keys(T.INTERRUTTORI).sort());
c("interruttori: tutti spenti", [false, false, false, false], ["popupUscita", "fotoConConsenso", "testBottone", "linkShopDiProva"].map((k) => T.INTERRUTTORI[k]));
c("link catalogo: lo shop di oggi, finché il redesign non è approvato", "/shop", T.LINK_CATALOGO);
c("link consulenza: l'ancora della home di oggi, finché Protocol non è approvata", "/#prenota", T.LINK_CONSULENZA);
vero("l'ancora #prenota esiste nella home di oggi", /id="prenota"/.test(leggi("src/routes/index.tsx")));
c("link shop di prova", "/shop", T.LINK_SHOP_DI_PROVA);
c("foto con consenso: elenco vuoto", [], T.FOTO_CON_CONSENSO);
c("durata della consulenza: dato di Operativo, null finché non c'è", null, T.DURATA_CONSULENZA);
c("versione del consenso WhatsApp", "wa-sito-2026-10-14", T.VERSIONE_CONSENSO_WA);
c("fasce: mattina, pomeriggio, sera", [["mattina", "Mattina"], ["pomeriggio", "Pomeriggio"], ["sera", "Sera"]], T.FASCE.map((f) => [f.id, f.etichetta]));
c("problemi: 8 voci, «Altro» per ultima", 8, T.PROBLEMI.length);
c("problemi: etichetta di «tenuta» identica al Copywriter", "Tenuta: si stacca presto", T.PROBLEMI.find((p) => p.id === "tenuta")?.etichetta);

/* ── 3. LE DUE CARTE PUNTANO ALLE STRADE NUOVE ──────────────────────────── */
c("carta Stock → LINK_CATALOGO", T.LINK_CATALOGO, T.TESTI_STRADE.carte[0].href);
c("carta Protocol → LINK_CONSULENZA", T.LINK_CONSULENZA, T.TESTI_STRADE.carte[1].href);
c("carta Protocol porta il nome esteso", T.NOME_PRODOTTO_ESTESO, T.TESTI_STRADE.carte[1].titolo);

/* ── 4. TESTI_HOME ──────────────────────────────────────────────────────── */
const H = T.TESTI_HOME;
c("home: titolo", "Esiste da sempre. Ora è evoluto.", H.titolo);
c("home: riga col nome dalla costante", `${T.NOME_PRODOTTO} è un sistema di capelli su misura, sottile e naturale.`, H.riga);
c("home: bottoni", ["Scegli dal catalogo", "Prenota la consulenza gratuita"], [H.bottoneCatalogo, H.bottoneConsulenza]);
c("home: titolo dei percorsi", "Da dove vuoi partire?", H.percorsi.titolo);
c("home: frase di Marketing sopra le carte", "Dal classico all'evoluzione: scegli il tuo livello", H.percorsi.frase);
c("home: prove, titolo", "Fatti, non parole.", H.prove.titolo);
c("home: prove, tenuta", "Mare, doccia, palestra, phon. Vita normale.", H.prove.tenuta.testo);
c("home: prove, manutenzione", "Circa 10 minuti. Ogni tanto serve un controllo: te lo diciamo subito.", H.prove.manutenzione.testo);
c("home: prove, foto", "Persone vere, con il loro consenso scritto.", H.prove.foto.testo);
c("home: come funziona", ["Tre passi, niente giri.", ["Parli con noi.", "Lo facciamo su misura per te.", "Torni alla vita di prima."]], [H.comeFunziona.titolo, H.comeFunziona.passi]);
c("home: 5 FAQ con domanda e risposta", 5, H.faq.filter((f) => f.q && f.a).length);
c("home: chiusura", "Scegli come iniziare.", H.chiusura.titolo);
c("home: titolo della scheda", "Invisible Derm · Hair Genius Labs", H.meta.titolo);
c("home: descrizione", "Un sistema di capelli su misura, sottile e naturale. Scegli dal catalogo o prenota la consulenza gratuita.", H.meta.descrizione);

/* ── 5. TESTI_PROTOCOL ──────────────────────────────────────────────────── */
const P = T.TESTI_PROTOCOL;
c("protocol: titolo", "Basta nasconderti. Fatti vedere come sei.", P.titolo);
c("protocol: sottotitolo", "Un sistema su misura, sottile e naturale. Ti spieghiamo tutto in una consulenza gratuita.", P.sottotitolo);
c("protocol: bottone", "Prenota la consulenza gratuita", P.bottone);
c("protocol: fa / non fa per te (solo il limite vero: la manutenzione)", true, /controllo periodico/.test(P.perChi.fa) && /manutenzione/.test(P.perChi.nonFa));
c("protocol: «Cos'è»", "Naturale e su misura.", P.cosE.titolo);
c("protocol: tenuta e manutenzione", "Regge. Ti spieghiamo come.", P.tenuta.titolo);
c("protocol: foto", "Persone vere. Con il loro consenso.", P.foto.titolo);
c("protocol: come funziona la consulenza, 3 passi", ["Cosa succede dopo la richiesta", 3], [P.consulenza.titolo, P.consulenza.passi.length]);
c("protocol: 5 FAQ", 5, P.faq.filter((f) => f.q && f.a).length);
c("protocol: titolo della scheda", "Invisible Derm Protocol® · consulenza gratuita", P.meta.titolo);
c("protocol: descrizione = sottotitolo", P.sottotitolo, P.meta.descrizione);

/* ── 6. TESTI_CATALOGO ──────────────────────────────────────────────────── */
const K = T.TESTI_CATALOGO;
c("catalogo: titolo e frase onesta", ["Catalogo", "Il catalogo è in preparazione."], [K.titolo, K.testo]);
c("catalogo: seguito", "Intanto possiamo guardare insieme il tuo caso, gratis.", K.seguito);
c("catalogo: bottone e link allo shop di prova", ["Prenota la consulenza gratuita", "Guarda lo shop di prova"], [K.bottone, K.linkShop]);

/* ── 7. TESTI_MODULO_CORTO ──────────────────────────────────────────────── */
const M = T.TESTI_MODULO_CORTO;
c("modulo: titoli", ["Lascia due dati, al resto pensiamo noi.", "Consulenza gratuita"], [M.titoloProtocol, M.titoloShop]);
c("modulo: etichette", ["Come ti chiami?", "Il tuo numero di telefono", "Quando preferisci essere richiamato?"], [M.nome, M.telefono, M.fascia]);
c("modulo: bottoni A e B", ["Prenota la consulenza gratuita", "Fatti richiamare nell'orario che scegli"], [M.bottoneA, M.bottoneB]);
c("modulo: frase sotto il bottone", "Ti richiamiamo noi nell'orario che scegli.", M.sotto);
c("modulo: errori del Copywriter", ["Scrivi il tuo nome.", "Controlla il numero: servono solo cifre.", "Scegli una fascia.", "Scegli il problema principale.", "Non siamo riusciti a inviare. Riprova tra un momento."], [M.errori.nome, M.errori.telefono, M.errori.fascia, M.errori.problema, M.errori.invio]);
c("modulo: conferma", ["Fatto. Ti richiamiamo noi.", "Ti richiamiamo nell'orario che hai scelto e guardiamo il tuo caso insieme."], [M.conferma.titolo, M.conferma.testo]);
c("modulo: privacy come nel modulo di oggi", ["I tuoi dati sono al sicuro · Trattati secondo il GDPR", "/privacy-policy"], [M.privacy.testo, M.privacy.link]);
c("modulo: calendario", ["Preferisci fissare subito la videoconsulenza?", "Scegli giorno e ora", "Quell'orario è appena stato preso: scegline un altro.", "Non siamo riusciti a fissarla da qui: ti richiamiamo noi per scegliere l'orario insieme."], [M.calendario.domanda, M.calendario.bottone, M.calendario.occupato, M.calendario.nonValido]);
c("modulo: testi dentro il calendario (senza durata né programma di chiamata)", ["Scegli il giorno e l'ora", "Videoconsulenza online, gratuita.", "Orario scelto"], [M.calendario.titolo, M.calendario.sotto, M.calendario.scelto]);
c("modulo: «fissata» lascia il segnaposto quando non c'è l'orario", "Videoconsulenza fissata {{giorno e ora}}. Il link te lo mandiamo noi.", M.calendario.fissata("{{giorno e ora}}"));
c("modulo: casella del consenso (facoltativa, mai spuntata)", "Ok a ricevere promemoria su WhatsApp", M.consenso);

/* ── 8. NIENTE PREZZI, PAROLE VIETATE, VECCHIO NOME ─────────────────────── */
const stringhe = (x, fuori = []) => {
  if (typeof x === "string") fuori.push(x);
  else if (typeof x === "function") fuori.push(x("{{giorno e ora}}"));
  else if (Array.isArray(x)) x.forEach((v) => stringhe(v, fuori));
  else if (x && typeof x === "object") Object.values(x).forEach((v) => stringhe(v, fuori));
  return fuori;
};
const VIETATE = [
  /€|\beuro\b/i, /\bcura\b|\bcurar/i, /ricrescita/i, /definitiv/i, /garantit/i, /guarisc/i, /solo noi/i,
  /trustpilot/i, /bio-mimetic/i, /ultimi posti/i, /slot limitati/i, /\bgiorni\b/i, /scade/i, /sconto|sconti/i,
];
const tutte = stringhe([T.TESTI_HOME, T.TESTI_PROTOCOL, T.TESTI_CATALOGO, T.TESTI_MODULO_CORTO, T.TESTI_CONSULENZA, T.TESTI_STRADE, T.PROBLEMI, T.FASCE]);
c("ci sono molte stringhe da controllare", true, tutte.length > 100);
const trovate = [];
for (const s of tutte) for (const v of VIETATE) if (v.test(s)) trovate.push(`${v}: «${s.slice(0, 60)}»`);
c("nei testi niente prezzi, scadenze né parole vietate", [], trovate);
const codice = leggi("src/landing/testi-sito.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
c("testi-sito.ts: «Invisible Derm» scritto a mano solo nelle due costanti", 2, (codice.match(/Invisible Derm/g) ?? []).length);
c("testi-sito.ts: nessun «Bio-Mimetic» nel codice", false, /bio-mimetic/i.test(codice));

/* ── 9. I FILE PROVVISORI NON CI SONO PIÙ E NESSUNO LI IMPORTA ───────────── */
for (const f of ["src/landing/sito/testi-pagine.ts", "src/landing/sito/testi-modulo-corto.ts"])
  c(`${f} non esiste più`, false, existsSync(join(radice, f)));
const importatori = [];
const cerca = (d) => {
  for (const v of readdirSync(join(radice, d), { withFileTypes: true })) {
    const p = `${d}/${v.name}`;
    if (v.isDirectory()) cerca(p);
    else if (/\.(tsx?|mjs)$/.test(v.name) && p !== "prove/sito/testi.mjs" && /testi-pagine|testi-modulo-corto/.test(readFileSync(join(radice, p), "utf8"))) importatori.push(p);
  }
};
cerca("src");
cerca("prove");
c("nessun file importa o legge i testi provvisori", [], importatori);

/* ── 10. PRODUCT.md: il nome è Invisible Derm ───────────────────────────── */
const prodotto = leggi("PRODUCT.md");
c("PRODUCT.md: «Bio-Mimetic» compare solo per dire che non si usa più", [], prodotto.split("\n").filter((r) => /bio-mimetic/i.test(r) && !/non si usa/i.test(r)));
vero("PRODUCT.md: dice che il nome è Invisible Derm", /Invisible Derm/.test(prodotto));

/* ── 11. /SOLUZIONI · TESTI_SOLUZIONI, PAROLA PER PAROLA (landing v3, sezioni 3.1-3.6) ──────────
 *  Compito S3.0. Ogni stringa è quella del Copywriter: se cambia, cambia qui e nel documento 20-sito/2026-10-14-landing-v3.md. */
const S = T.TESTI_SOLUZIONI;
const ND = T.NOME_PRODOTTO;
vero("TESTI_SOLUZIONI esiste", !!S);

//  3.6 · Meta per Google
c("meta: titolo pagina (57 caratteri)", "Trapianto, patch o Invisible Derm | Hair Genius Labs Roma", S.meta.titolo);
c("meta: descrizione", "Facciamo trapianto, patch e Invisible Derm. In consulenza gratuita, anche in videochiamata, ti diciamo quale serve davvero a te.", S.meta.descrizione);
c("meta: descrizione per gli annunci (?apri)", "Che cos'è Invisible Derm: un sistema di capelli su misura, sottile e naturale, senza chirurgia. Te lo spiega il titolare in 30 secondi.", S.meta.descrizioneApri);
c("meta: titolo per la condivisione", "Trapianto, patch o Invisible Derm? Li facciamo tutti e tre.", S.meta.titoloSocial);
vero("meta: titolo ≤ 60", S.meta.titolo.length <= 60);
vero("meta: descrizioni ≤ 155", S.meta.descrizione.length <= 155 && S.meta.descrizioneApri.length <= 155);

//  3.1 · Prima schermata
c("marchio: indirizzo", "Studio a Roma · Via degli Scipioni 132", S.marchio.indirizzo);
c("marchio: alt del logo", "Hair Genius Labs", S.marchio.logoAlt);
c("titolo: prima riga", "Trapianto, patch o Invisible Derm?", S.titolo.prima);
c("titolo: seconda riga, una sola parola in accento", "Li facciamo [a]tutti e tre[/a].", S.titolo.seconda);
c("sottotitolo", "Ti diciamo quale serve davvero a te. Se hai già un'idea, partiamo da quella.", S.sottotitolo);
c("voci: tre, ordine fisso Trapianto · Patch · Invisible Derm", [["trapianto", "01", "Trapianto"], ["patch", "02", "Patch"], ["invisible-derm", "03", "Invisible Derm"]], S.voci.map((v) => [v.id, v.numero, v.nome]));
c("voce 01: riga (non comincia con «se»)", "Con la chirurgia. Lo valutiamo insieme sulla tua nuca, con il parere del medico.", S.voci[0].riga);
c("voce 01: azione", "Si può fare nel mio caso?", S.voci[0].azione);
c("voce 02: riga", "Senza chirurgia. Pronta, la trovi in stock.", S.voci[1].riga);
c("voce 02: azione = testo della barra (stesse parole, stessa azione)", "Patch pronte in stock →", S.voci[1].azione);
c("voce 03: riga", "Su misura, sottile e naturale. Senza chirurgia.", S.voci[2].riga);
c("voce 03: azione, chiusa e aperta", ["Che cos'è Invisible Derm?", "Chiudi la spiegazione"], [S.voci[2].azione, S.voci[2].azioneAperta]);
c("voce 03: etichetta «Solo da noi»", "Solo da noi", S.voci[2].etichetta);
c("voce 03: etichetta accessibile", "Invisible Derm, solo da noi. Su misura, sottile e naturale, senza chirurgia.", S.voci[2].etichettaAccessibile);
c("primario: bottone e riga", ["Prenota la consulenza gratuita", "Non sai quale fa per te? Te lo diciamo noi. Gratis, anche in videochiamata."], [S.primario.bottone, S.primario.riga]);

//  3.2 · Scheda «Che cos'è Invisible Derm?»
const E = S.spiegazione;
c("spiegazione: titolo", "Che cos'è Invisible Derm", E.titolo);
c("spiegazione: prima riga", "Invisible Derm è un sistema di capelli su misura, sottile e naturale, senza chirurgia.", E.primaRiga);
c("spiegazione: video, pillola · Riguarda · play · testo", ["Te lo spiego in 30 secondi", "Riguarda", "Guarda il video: che cos'è Invisible Derm, con audio", "Leggi il testo del video"], [E.video.pillola, E.video.riguarda, E.video.etichettaPlay, E.video.leggiTesto]);
c("spiegazione: macro, didascalia", "Da 10 centimetri, alla luce dello studio.", E.macro.didascalia);
c("spiegazione: macro, tasti (4.3)", ["Metti in pausa il video", "Fai partire il video"], [E.macro.ferma, E.macro.riparti]);
c("spiegazione: le tre righe visibili", [
  ["Cos'è.", "Fatto sul tuo colore, sulla tua densità, sulla tua attaccatura."],
  ["Come si mette.", "In studio, senza intervento. La posa dura meno di 2 ore."],
  ["Il limite vero.", "Vuole manutenzione, da fare ogni tanto: circa 10 minuti. E non cura la caduta: la copre."],
], E.righe.map((r) => [r.titolo, r.testo]));
c("spiegazione: le due righe piccole", [
  ["La patch?", "La patch è pronta, e la vendiamo anche noi. Invisible Derm lo facciamo su misura per te."],
  ["Solo da noi.", "Invisible Derm lo installiamo in esclusiva, qui a Roma."],
], E.piccole.map((r) => [r.titolo, r.testo]));
c("spiegazione: il passo (bottone, riga, link)", ["Prenota la consulenza gratuita", "La guardi da vicino, senza impegno. Gratis, anche in videochiamata.", "Chiudi la spiegazione"], [E.passo.bottone, E.passo.riga, E.passo.chiudi]);
c("spiegazione: prefisso dell'anteprima quando manca altro che il video", "Anteprima.", E.anteprima.prefisso);
c("spiegazione: riga dell'anteprima (4.7)", 'Anteprima: manca il video "Che cos\'è Invisible Derm". La pagina non è online.', E.anteprima.senzaVideo);
vero("il limite vero contiene la frase ammessa, intera", E.righe[2].testo.includes(FRASI_AMMESSE[0]));
vero("la riga 5 è la frase ammessa, intera", E.piccole[1].testo === FRASI_AMMESSE[2]);

//  3.3 · Barra
c("barra: testo e etichetta accessibile", ["Patch pronte in stock →", "Vai al catalogo delle patch pronte in stock"], [S.barra.testo, S.barra.etichettaAccessibile]);

//  3.4 · Modulo
const MS = S.modulo;
c("modulo: titolo", "Lascia due dati. Ti diciamo con onestà quale strada fa per te.", MS.titolo);
c("modulo: riga secondo l'interesse", { trapianto: "Guardiamo il tuo caso e ti diciamo se si può fare.", "invisible-derm": "La guardi da vicino e decidi con calma.", "non-so": "Ti aiutiamo a scegliere fra le tre." }, MS.rigaInteresse);
c("modulo: campi", { nome: ["Nome", "Il tuo nome"], telefono: ["Telefono", "Il tuo numero", "Serve solo per richiamarti."], fascia: "Quando ti chiamiamo?" }, { nome: [MS.nome.etichetta, MS.nome.segnaposto], telefono: [MS.telefono.etichetta, MS.telefono.segnaposto, MS.telefono.aiuto], fascia: MS.fascia.etichetta });
c("modulo: le tre rassicurazioni", ["Consulenza gratuita, senza impegno.", "Anche in videochiamata.", "Se la soluzione giusta non è Invisible Derm, te lo diciamo."], MS.rassicurazioni);
//  Marketing n. 2 (15/10): chi arriva da «trapianto» o «non so» non deve leggere «se non è Invisible Derm»: sembra una spinta.
c("modulo: terza spunta neutra per chi non viene da Invisible Derm", "Se la soluzione giusta è un'altra, te lo diciamo.", MS.rassicurazioneAltra);
{
  const uguali = ["Consulenza gratuita, senza impegno.", "Anche in videochiamata."];
  c("terza spunta per «invisible-derm»: quella di sempre", [...uguali, "Se la soluzione giusta non è Invisible Derm, te lo diciamo."], T.rassicurazioniPer("invisible-derm"));
  for (const i of ["trapianto", "non-so"]) {
    c(`terza spunta per «${i}»: neutra`, [...uguali, "Se la soluzione giusta è un'altra, te lo diciamo."], T.rassicurazioniPer(i));
    vero(`«${i}»: il nome del prodotto non compare nelle spunte`, !/invisible/i.test(T.rassicurazioniPer(i).join(" ")));
  }
  vero("FoglioModulo disegna le spunte con rassicurazioniPer(interesse)", /rassicurazioniPer\(interesse\)/.test(leggi("src/landing/sito/soluzioni/FoglioModulo.tsx")));
}
c("modulo: bottone e riga sotto", ["Prenota la consulenza gratuita", "Ti richiamiamo noi, nell'orario che scegli."], [MS.bottone, MS.sotto]);
c("modulo: errori (senza rimando a WhatsApp)", ["Scrivi il tuo nome.", "Controlla il numero: mancano delle cifre.", "Scegli quando ti va bene.", "Non siamo riusciti a inviare la richiesta. Riprova tra un attimo."], [MS.errori.nome, MS.errori.telefono, MS.errori.fascia, MS.errori.invio]);
c("modulo: conferma", ["Fatto. Ti richiamiamo noi.", "Abbiamo ricevuto la tua richiesta. Ti chiamiamo nella fascia che hai scelto."], [MS.conferma.titolo, MS.conferma.testo]);
c("modulo: etichetta della X", "Chiudi e torna alla pagina", MS.chiudi);
vero("modulo: nessun testo di privacy nuovo (resta quello di oggi)", !("privacy" in MS));
vero("modulo: il rimando a WhatsApp non c'è", !/whatsapp|wa\.me/i.test(JSON.stringify(MS)));

//  Interesse: le etichette che il CRM mostra accanto al lead
c("interesse: etichette (il prodotto dalla costante)", { trapianto: "Trapianto", "invisible-derm": ND, "non-so": "Non so quale" }, S.interesse);

//  La barra e la scheda patch dicono la stessa cosa: una costante sola
c("barra e scheda patch: stesse parole", S.barra.testo, S.voci[1].azione);

//  Il nome del prodotto: si cambia in una riga e tutta la pagina lo segue
vero("il nome del prodotto arriva dalla costante, in ogni testo", JSON.stringify(S).split(ND).length - 1 >= 12);

/* ── 12. /SOLUZIONI · NIENTE PREZZI, PROMESSE, DATI NON CONFERMATI ───────────────────────────── */
const soluzioni = stringhe([S]).map((s) => togliFrasiAmmesse(s));
const VIETATE_SOLUZIONI = [
  ...VIETATE,
  /\binvisibil[ei]/i, // la parola italiana «invisibile»: il nome Invisible Derm non la contiene
  /indistinguibil/i, /nessuno se ne accorge/i, /non si stacca/i, /segreto/i, /capelli veri/i, /da tutta europa/i, /meglio|più naturale di/i,
  /verificato/i, /\b1326\b/, /\b47\b/, /★|stell[ae]\b/i, /\{\{|da confermare/i, /reticolazione|0[.,]03\s?mm|membrana/i,
  /conto alla rovescia|ultime? (posti|disponibilit)|posti limitati/i, /wa\.me|whatsapp|mailto:|tel:/i,
];
const trovateSoluzioni = [];
for (const s of soluzioni) for (const v of VIETATE_SOLUZIONI) if (v.test(s)) trovateSoluzioni.push(`${v}: «${s.slice(0, 60)}»`);
c("soluzioni: ci sono molte stringhe da controllare", true, soluzioni.length > 50);
c("soluzioni: niente parole vietate (restano solo le tre frasi ammesse)", [], trovateSoluzioni);
c("le frasi ammesse sono davvero nei testi (altrimenti l'eccezione è inutile)", [true, true, true], FRASI_AMMESSE.map((f) => stringhe([S]).some((s) => s.includes(f))));
//  Una variante della frase del limite NON passa: la scansione la vede ancora.
vero("la scansione vede ancora «cura» fuori dalla frase ammessa", /\bcura\b/i.test(togliFrasiAmmesse("E non cura la caduta. È la cura.")));
vero("«E non cura la caduta: la copre.» è l'unico «cura» di TESTI_SOLUZIONI", stringhe([S]).filter((s) => /\bcura\b/i.test(s)).every((s) => !/\bcura\b/i.test(togliFrasiAmmesse(s))));

finisci();
