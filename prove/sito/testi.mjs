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

const { c, vero, finisci } = nuovaProva("testi del sito");
const T = await carica("src/landing/testi-sito.ts", "testi-sito");

/* ── 1. IL NOME: un posto solo ──────────────────────────────────────────── */
c("nome corto", "Invisible Derm", T.NOME_PRODOTTO);
c("nome esteso", "Invisible Derm Protocol®", T.NOME_PRODOTTO_ESTESO);

/* ── 2. INTERRUTTORI, LINK E DATI DEL CONTRATTO (tutti spenti / vuoti) ───── */
c("interruttori: solo le quattro chiavi del contratto", ["fotoConConsenso", "linkShopDiProva", "popupUscita", "testBottone"], Object.keys(T.INTERRUTTORI).sort());
c("interruttori: tutti spenti", [false, false, false, false], ["popupUscita", "fotoConConsenso", "testBottone", "linkShopDiProva"].map((k) => T.INTERRUTTORI[k]));
c("link catalogo", "/catalogo", T.LINK_CATALOGO);
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
c("carta Stock → /catalogo", "/catalogo", T.TESTI_STRADE.carte[0].href);
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

finisci();
