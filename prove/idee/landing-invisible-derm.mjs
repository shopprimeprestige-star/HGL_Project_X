/** ── PROVE: LA LANDING /invisible-derm (12/11/2026) ──────────────────────────
 *  Commessa 2026-11-12-landing-invisible-derm. Si controllano le promesse della pagina:
 *  la rotta c'è, è fuori dai motori di ricerca e dalla sitemap, non ha shop, prezzi né conto alla
 *  rovescia, l'H1 è quello deciso, la riga Hollywood è una sola, le voci `{{da confermare}}` non
 *  esistono nei testi, Inter e lang="it" valgono per questa rotta e la home non cambia.
 *  Non disegna la pagina: l'aspetto si guarda aprendola (390 e 1440). */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function proveLandingInvisibleDerm(mod, { c, gruppo, radice }) {
  gruppo("LANDING /invisible-derm (12/11/2026)");
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  /** il sorgente senza commenti: le prove guardano quello che finisce in pagina, non la storia */
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`\\])\/\/.*$/gm, "$1");

  const rotta = leggi("src/routes/invisible-derm.tsx");
  const testi = leggi("src/landing/testi-invisible-derm.ts");
  const cartella = "src/components/landing/invisible-derm";
  const componenti = readdirSync(join(radice, cartella)).map((f) => leggi(`${cartella}/${f}`));
  const pagina = [rotta, testi, ...componenti].map(senzaCommenti).join("\n");
  const T = mod["landing/testi-invisible-derm"];
  const CAR = mod["lib/carattere"];
  const SEO = mod["seo/regole"];

  /* La rotta */
  c("la rotta è /invisible-derm", true, /createFileRoute\("\/invisible-derm"\)/.test(rotta));
  c("è nell'albero delle rotte", true, /'\/invisible-derm'/.test(leggi("src/routeTree.gen.ts")));
  c("noindex nella testata", true, /name: "robots", content: "noindex,follow"/.test(rotta));
  c("canonico sul proprio indirizzo", true, /href: `\$\{SITO\}\/invisible-derm`/.test(rotta));
  c("fuori dalla sitemap", false, SEO.PAGINE_PUBBLICHE.includes("/invisible-derm"));
  c("fuori dalla sitemap generata", false, /invisible-derm/.test(senzaCommenti(leggi("src/routes/sitemap[.]xml.ts"))));

  /* Il titolo */
  c("un solo H1", 1, (rotta.match(/<h1\b/g) || []).length);
  c("l'H1 in pagina è il testo dell'hero", true, /<h1[\s\S]*?HERO\.h1/.test(rotta));
  c("testo dell'H1", "Invisible Derm: il sistema di capelli sottile, ma resistente.", T.HERO.h1.replace(/\[\/?a\]/g, ""));
  c("meta title", "Invisible Derm a Roma | Sottile, ma resistente", T.META.titolo);

  /* Cosa NON c'è */
  c("nessun link a /shop", false, /\/shop|catalogo/i.test(pagina));
  c("nessun prezzo (€, euro, 47)", false, /€|\beuro\b|\b47\b|prezzo/i.test(pagina.replace(/Quanto costa\?/, "")));
  c("nessun conto alla rovescia", false, /countdown|getCountdown|Scade entro|ultimi \$?\{?[\w.]*\}? giorni|line-through/i.test(pagina));
  c("nessun tel:, mailto: o WhatsApp", false, /tel:|mailto:|wa\.me|whatsapp/i.test(pagina));
  c("nessun «Prima» / «Dopo» nel confronto", false, /\bPrima\b|\bDopo\b/.test(pagina));
  c("nessuna voce da confermare nei testi", false, /\{\{/.test(senzaCommenti(testi)));
  c("la tabella ha le 4 righe sicure", 4, T.TABELLA.righe.length);
  c("non importa lo shop né la barra della consulenza", false, /StickyHeader|BarraConsulenza|PlaceholderBox|ComparisonTable|VideoReviewsSection|PopupUscita/.test(pagina));

  /* Hollywood, una volta; «resistente» con i testi [SE test] */
  c("Hollywood compare una sola volta in tutta la pagina", 1, (pagina.match(/Hollywood/g) || []).length);
  c("è la versione «Ci risulta…», senza virgolette", true, /^Ci risulta che sia usato/.test(T.RESISTENTE.hollywood) && !/["«»]/.test(T.RESISTENTE.hollywood));
  c("H2 della sezione 4 con test", "[a]Sottile.[/a] E non per questo fragile.", T.RESISTENTE.h2);

  /* Il bottone è uguale ovunque */
  c("testo del bottone", "Prenota la consulenza gratuita", T.BOTTONE);
  c("riga sotto il bottone", "Gratis, online, in videochiamata.", T.RIGA_BOTTONE);

  /* Il cursore: accessibile e neutro */
  const cursore = leggi(`${cartella}/CursoreConfronto.tsx`);
  c("il cursore è uno slider con aria", true, /role="slider"/.test(cursore) && /aria-valuenow/.test(cursore) && /aria-valuetext/.test(cursore) && /aria-orientation="horizontal"/.test(cursore));
  c("scorrimento verticale libero (touch-action: pan-y)", true, /touchAction: "pan-y"/.test(cursore));
  c("tastiera: frecce, Pagina su/giù, Home, Fine", true, ["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"].every((k) => cursore.includes(`"${k}"`)));
  c("etichette neutre", ["Patch standard", "Invisible Derm"], [T.CONFRONTO.etichette.patch, T.CONFRONTO.etichette.derm]);

  /* La barra del telefono */
  const barra = leggi(`${cartella}/BarraPrenotaId.tsx`);
  c("la barra è solo sotto i 1024 px e dopo il confronto", true, /lg:hidden/.test(barra) && /data-barra-dopo='confronto'/.test(barra) && /\[data-barra-nascondi='vista'\]/.test(barra));
  c("il segnale della barra sta nella pagina", true, /data-barra-dopo="confronto"/.test(rotta));

  /* Slot vuoto = niente; liberatorie */
  c("senza file lo slot non disegna niente (MediaSlot)", true, /nascondiSeVuoto = false/.test(leggi("src/components/landing/MediaSlot.tsx")) && /if \(!src && nascondiSeVuoto\) return null/.test(leggi("src/components/landing/MediaSlot.tsx")));
  c("liberatoria: solo «sì»", [true, true, false, false, false], ["sì", " SI ", "", "no", "forse"].map(T.liberatoriaOk));
  c("le chiavi dei media iniziano per id.", [], T.SLOT_ID.filter((s) => !s.chiave.startsWith("id.")).map((s) => s.chiave));
  c("le chiavi dei media sono uniche", T.SLOT_ID.length, new Set(T.SLOT_ID.map((s) => s.chiave)).size);

  /* Carattere, lingua e il resto del sito */
  c("Inter vale su /invisible-derm", [true, true, true], ["/invisible-derm", "/invisible-derm/", "/Invisible-Derm?x=1#top"].map(CAR.usaInter));
  c("Inter NON vale su rotte simili", [false, false], ["/invisible-dermx", "/invisible-derm/altro"].map(CAR.usaInter));
  c("lang=\"it\" solo per questa rotta", [true, false, false, false], ["/invisible-derm", "/", "/shop", "/blog"].map(CAR.paginaInItaliano));
  c("la radice usa paginaInItaliano", true, /lang=\{paginaInItaliano\(percorso\) \? "it" : "en"\}/.test(leggi("src/routes/__root.tsx")));
  const faq = leggi("src/components/landing/FaqAccordion.tsx");
  c("FAQ: aria-expanded e aria-controls", true, /aria-expanded=\{isOpen\}/.test(faq) && /aria-controls=/.test(faq));
  c("FAQ: senza elenco esterno restano le domande della home", true, /voci \?\? FAQS/.test(faq));
  c("la home non importa niente della nuova pagina", false, /invisible-derm|testi-invisible/.test(leggi("src/routes/index.tsx")));
}
