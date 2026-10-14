/** ── PROVE DELLE PAGINE NUOVE (home, Protocol, catalogo) ───────────────────
 *  `node prove/sito/pagine.mjs`. Come le altre prove: si impacchetta il
 *  codice vero con esbuild (lo porta già vite), niente dipendenze nuove.
 *
 *  Cosa copre: i testi (niente prezzi né parole vietate, nome solo dalla
 *  costante), gli interruttori (tutti spenti), le regole di cosa si mostra
 *  (foto, durata, link allo shop) e che i file delle pagine non nascondano
 *  nel codice cose che i testi non hanno (un «€», un video che parte da solo,
 *  il vecchio nome). NON copre il disegno: quello si guarda con il telefono
 *  vero (Playwright, collaudo).
 *  ───────────────────────────────────────────────────────────────────────── */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const qui = dirname(fileURLToPath(import.meta.url));
const radice = join(qui, "..", "..");
const dove = join(tmpdir(), "prove-sito-pagine");

let fallite = 0;
let totale = 0;
function c(nome, atteso, ottenuto) {
  totale++;
  const a = JSON.stringify(atteso);
  const o = JSON.stringify(ottenuto);
  if (a !== o) {
    fallite++;
    console.error(`  ✗ ${nome}\n      atteso:   ${a}\n      ottenuto: ${o}`);
  }
}

/* ── 1. SI IMPACCHETTA IL CODICE VERO ───────────────────────────────────── */
rmSync(dove, { recursive: true, force: true });
mkdirSync(dove, { recursive: true });
function impacchetta(sorgente, nome) {
  execFileSync(
    "npx",
    ["esbuild", sorgente, "--bundle", "--format=cjs", `--outfile=${join(dove, `${nome}.cjs`)}`, "--alias:@=./src", "--log-level=error"],
    { cwd: radice, stdio: ["ignore", "ignore", "inherit"] },
  );
  return createRequire(import.meta.url)(join(dove, `${nome}.cjs`));
}
const FILE_TESTI = "src/landing/sito/testi-pagine.ts";
const FILE_REGOLE = "src/landing/sito/pagine-regole.ts";
if (!existsSync(join(radice, FILE_TESTI)) || !existsSync(join(radice, FILE_REGOLE))) {
  console.error(`✗ mancano ${FILE_TESTI} o ${FILE_REGOLE}`);
  process.exit(1);
}
const T = impacchetta(FILE_TESTI, "testi");
const R = impacchetta(FILE_REGOLE, "regole");

/* ── 2. TESTI: i valori approvati ───────────────────────────────────────── */
c("nome corto", "Invisible Derm", T.NOME_PRODOTTO);
c("nome esteso", "Invisible Derm Protocol®", T.NOME_PRODOTTO_ESTESO);
c("titolo home", "Esiste da sempre. Ora è evoluto.", T.TESTI_HOME.titolo);
c("riga sotto il titolo", "Invisible Derm è un sistema di capelli su misura, sottile e naturale.", T.TESTI_HOME.riga);
c("bottone catalogo", "Scegli dal catalogo", T.TESTI_HOME.bottoneCatalogo);
c("bottone consulenza", "Prenota la consulenza gratuita", T.TESTI_HOME.bottoneConsulenza);
c("titolo della sezione percorsi", "Da dove vuoi partire?", T.TESTI_HOME.percorsi.titolo);
c("frase di Marketing sopra le carte", "Dal classico all'evoluzione: scegli il tuo livello", T.TESTI_HOME.percorsi.frase);
c("5 FAQ in home", 5, T.TESTI_HOME.faq.length);
c("3 passi in home", 3, T.TESTI_HOME.comeFunziona.passi.length);
c("titolo Protocol", "Basta nasconderti. Fatti vedere come sei.", T.TESTI_PROTOCOL.titolo);
c("5 FAQ in Protocol", 5, T.TESTI_PROTOCOL.faq.length);
c("3 passi della consulenza", 3, T.TESTI_PROTOCOL.consulenza.passi.length);
c("titolo scheda Protocol", "Invisible Derm Protocol® · consulenza gratuita", T.TESTI_PROTOCOL.meta.titolo);
c("titolo catalogo", "Catalogo", T.TESTI_CATALOGO.titolo);
c("frase onesta del catalogo", "Il catalogo è in preparazione.", T.TESTI_CATALOGO.testo);
c("le due carte puntano alle strade nuove", ["/catalogo", "/protocol#modulo"], [T.LINK_CATALOGO, T.LINK_CONSULENZA]);
c("link allo shop di prova", "/shop", T.LINK_SHOP_DI_PROVA);

/* ── 3. INTERRUTTORI: tutti spenti, elenchi vuoti ───────────────────────── */
c("foto con consenso spenta", false, T.INTERRUTTORI.fotoConConsenso);
c("test del bottone spento", false, T.INTERRUTTORI.testBottone);
c("link allo shop di prova spento", false, T.INTERRUTTORI.linkShopDiProva);
c("pop-up in uscita spento", false, T.INTERRUTTORI.popupUscita);
c("nessuna foto con consenso scritta", 0, T.FOTO_CON_CONSENSO.length);
c("durata della consulenza non data", null, T.DURATA_CONSULENZA);

/* ── 4. NIENTE PREZZI, NIENTE PAROLE VIETATE, NIENTE VECCHIO NOME ───────── */
function tutteLeStringhe(x, fuori = []) {
  if (typeof x === "string") fuori.push(x);
  else if (Array.isArray(x)) x.forEach((v) => tutteLeStringhe(v, fuori));
  else if (x && typeof x === "object") Object.values(x).forEach((v) => tutteLeStringhe(v, fuori));
  return fuori;
}
const VIETATE = [
  /€|euro\b/i, /\bcura\b|\bcurar/i, /ricrescita/i, /definitiv/i, /garantit/i, /guarisc/i, /solo noi/i,
  /trustpilot/i, /bio-mimetic/i, /ultimi posti/i, /slot limitati/i, /\bgiorni\b/i, /scade/i, /sconto|sconti/i,
];
const testiPagine = tutteLeStringhe([T.TESTI_HOME, T.TESTI_PROTOCOL, T.TESTI_CATALOGO]);
const trovate = [];
for (const s of testiPagine) for (const v of VIETATE) if (v.test(s)) trovate.push(`${v}: «${s.slice(0, 60)}»`);
c("nei testi delle pagine niente prezzi né parole vietate", [], trovate);
c("nei testi ci sono stringhe da controllare", true, testiPagine.length > 40);

/* ── 5. COSA SI MOSTRA ──────────────────────────────────────────────────── */
const foto = [{ src: "/a.jpg", alt: "a" }];
c("foto: interruttore spento → nessuna foto", [], R.fotoDaMostrare(false, foto));
c("foto: interruttore acceso ma elenco vuoto → nessuna foto", [], R.fotoDaMostrare(true, []));
c("foto: acceso e con foto → le foto", foto, R.fotoDaMostrare(true, foto));
c("durata: null → la riga non c'è", null, R.rigaDurata(null));
c("durata: vuota → la riga non c'è", null, R.rigaDurata("   "));
c("durata: data → la riga c'è", "Durata: circa mezz'ora.", R.rigaDurata("circa mezz'ora"));
c("shop di prova: spento → niente link", false, R.mostraLinkShop(false));
c("shop di prova: acceso → link", true, R.mostraLinkShop(true));
c("bottone A", "Prenota la consulenza gratuita", R.testoBottoneConsulenza("A", T.TESTI_HOME.bottoneConsulenza, T.BOTTONE_VARIANTE_B));
c("bottone B", "Fatti richiamare nell'orario che scegli", R.testoBottoneConsulenza("B", T.TESTI_HOME.bottoneConsulenza, T.BOTTONE_VARIANTE_B));

/* ── 6. I FILE DELLE PAGINE ─────────────────────────────────────────────── */
const FILE_PAGINE = [
  "src/landing/sito/HomeNuova.tsx",
  "src/landing/sito/PaginaProtocol.tsx",
  "src/landing/sito/pezzi.tsx",
  "src/routes/protocol.tsx",
  "src/routes/catalogo.tsx",
];
const sorgenti = {};
for (const f of FILE_PAGINE) {
  const p = join(radice, f);
  c(`${f} esiste`, true, existsSync(p));
  sorgenti[f] = existsSync(p) ? readFileSync(p, "utf8") : "";
}
// Si controlla il codice, non i commenti: un commento può citare ciò che non si fa.
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
for (const f of FILE_PAGINE) {
  const s = senzaCommenti(sorgenti[f]);
  c(`${f}: nessun «€»`, false, /€/.test(s));
  c(`${f}: nessun «Bio-Mimetic»`, false, /bio-mimetic/i.test(s));
  c(`${f}: nessun video che parte da solo`, false, /autoPlay|autoplay/.test(s));
  c(`${f}: nessun conto alla rovescia né «ultimi posti»`, false, /countdown|ultimi posti|slot limitati/i.test(s));
  c(`${f}: il nome del prodotto non è scritto a mano`, false, /Invisible Derm/.test(s));
  c(`${f}: nessun Trustpilot`, false, /trustpilot/i.test(s));
}
const home = senzaCommenti(sorgenti["src/landing/sito/HomeNuova.tsx"]);
c("home: monta la barra della consulenza", true, /<BarraConsulenza\s+provenienza="consulenza"/.test(home));
c("home: i due bottoni del primo schermo usano la stessa classe", true, /GrigliaBottoni/.test(home));
c("home: il bottone consulenza salva la scelta (punto home)", true, /salvaScelta\(\{[^}]*punto:\s*"home"/.test(home));
c("home: scelta_percorso", true, /scelta_percorso/.test(home));
c("home: click_bottone", true, /click_bottone/.test(home));

const prot = senzaCommenti(sorgenti["src/landing/sito/PaginaProtocol.tsx"]);
c("protocol: il modulo ha provenienza consulenza e problema facoltativo", true, /origine="consulenza"[\s\S]*problemaObbligatorio=\{false\}/.test(prot));
c("protocol: il bottone scende a #modulo", true, /#modulo|"modulo"/.test(prot));
c("protocol: il bottone si ripete almeno 3 volte (testata, dopo «Cos'è», dopo «Come funziona»)", true, (prot.match(/<BottoneConsulenza/g) ?? []).length >= 3);

const rottaP = sorgenti["src/routes/protocol.tsx"];
c("rotta /protocol: canonico", true, /\$\{SITO\}\/protocol/.test(rottaP));
c("rotta /protocol: dichiara il suo percorso", true, /createFileRoute\("\/protocol"\)/.test(rottaP));
const rottaC = sorgenti["src/routes/catalogo.tsx"];
c("rotta /catalogo: canonico", true, /\$\{SITO\}\/catalogo/.test(rottaC));
c("rotta /catalogo: dichiara il suo percorso", true, /createFileRoute\("\/catalogo"\)/.test(rottaC));
c("rotta /catalogo: il link allo shop dipende dall'interruttore", true, /mostraLinkShop\(/.test(senzaCommenti(rottaC)));
c("rotta /catalogo: monta la barra", true, /<BarraConsulenza\s+provenienza="consulenza"/.test(senzaCommenti(rottaC)));

if (fallite) {
  console.error(`\n✗ pagine: ${fallite} prove fallite su ${totale}`);
  process.exit(1);
}
console.log(`✓ pagine: ${totale} prove passate`);
