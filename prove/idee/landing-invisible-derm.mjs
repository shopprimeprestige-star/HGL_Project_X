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
  // «Prima/Dopo» vale solo per la sezione dei clienti (titolare, 13/11/2026), mai nel confronto patch / Invisible Derm
  c("nessun «Prima» / «Dopo» nel confronto", false, /\bPrima\b|\bDopo\b/.test(JSON.stringify(T.CONFRONTO)));
  c("nessuna voce da confermare nei testi", false, /\{\{/.test(senzaCommenti(testi)));
  const righe = T.TABELLA.righe.map((r) => r.nome);
  c("la tabella: 6 righe, «Bordo» e «Sottile e resistente» in testa, «Chirurgia» in fondo", ["Bordo", "Sottile e resistente", "Chirurgia"], [righe[0], righe[1], righe[righe.length - 1]]);
  c("la tabella ha 6 righe", 6, righe.length);
  c("riga «Bordo» (frasi del titolare)", ["Più spesso, da vicino si può notare", "Sottile, si confonde con la pelle"], [T.TABELLA.righe[0].patch, T.TABELLA.righe[0].derm]);
  c("riga «Sottile e resistente» (frasi del titolare)", ["Di solito devi scegliere: o sottile o resistente", "Tutte e due, insieme"], [T.TABELLA.righe[1].patch, T.TABELLA.righe[1].derm]);
  c("non importa lo shop né la barra della consulenza", false, /StickyHeader|BarraConsulenza|PlaceholderBox|ComparisonTable|VideoReviewsSection|PopupUscita/.test(pagina));

  /* Senza media la pagina regge: pilastro «Resistente», disegno, frasi che non rimandano a media assenti */
  const vistaRotta = senzaCommenti(rotta);
  c("il pilastro «Resistente» si disegna anche senza il video del test", false, /\{test && \(\s*<Pilastro/.test(vistaRotta));
  c("senza video il pilastro ha un testo che non rimanda al test", true, /test \? RESISTENTE\.resistente\.testoConVideo : RESISTENTE\.resistente\.testo/.test(vistaRotta) && !/test|ripresa|vedi/i.test(T.RESISTENTE.resistente.testo));
  const disegno = leggi(`${cartella}/DisegnoConfronto.tsx`);
  c("il disegno SVG è in pagina fuori da ogni condizione sui media", true, /<div className=\{haConfronti \? "mt-14" : "mt-12"\}>\s*<DisegnoConfronto \/>/.test(vistaRotta));
  c("il disegno: SVG con role=\"img\" e descrizione", true, /<svg/.test(disegno) && /role="img"/.test(disegno) && /aria-label=\{d\.alt\}/.test(disegno));
  c("il disegno non usa foto né media del CRM", false, /<img|media\(|src=/.test(senzaCommenti(disegno)));
  c("la descrizione del disegno dice bordo spesso e membrana sottile", true, /bordo spesso/.test(T.CONFRONTO.disegno.alt) && /sottile/.test(T.CONFRONTO.disegno.alt));
  c("le frasi sotto il confronto, l'introduzione e la FAQ non rimandano a media assenti", [], [T.CONFRONTO.riga, T.RESISTENTE.introduzione, ...T.FAQ.voci.map((v) => v.a)].filter((t) => /ti facciamo vedere|vedi un test|ripres[ao]|stessa luce e a 10 centimetri|Qui vedi/.test(t)));
  c("FAQ «Regge…»: risposta del titolare", "Sì: è fatto per la vita di tutti i giorni, non per una sera. Lavoro, doccia, sport. In consulenza ti spieghiamo come si comporta nel tuo caso e quanta manutenzione serve.", T.FAQ.voci[1].a);
  c("computer: «Gratis, online…» sta solo col bottone del telefono", true, /text-base lg:hidden">\{RIGA_BOTTONE\}/.test(vistaRotta.replace(/\s+/g, " ")) || /lg:hidden">\{RIGA_BOTTONE\}/.test(vistaRotta));
  c("il tasto Play passa il fuoco al video", true, /video\.current\?\.focus\(\)/.test(leggi(`${cartella}/VideoSlot.tsx`)));

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
  c("FAQ: aria-controls solo con la risposta aperta (mai un id che non c'è)", true, /aria-controls=\{isOpen \?/.test(faq));
  c("FAQ: senza elenco esterno restano le domande della home", true, /voci \?\? FAQS/.test(faq));
  /* Editor visuale delle immagini (?modifica, solo con accesso al CRM) */
  const editor = senzaCommenti(leggi(`${cartella}/ModificaImmagini.tsx`));
  const rottaV1 = leggi("src/routes/invisible-derm-v1.tsx");
  const chiaviNeiPunti = [...(rotta + rottaV1).matchAll(/punto\("[^"]+", \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    .concat(/punto\("Prima e dopo", SLOT_PRIMA_DOPO\.map/.test(rotta) ? T.SLOT_PRIMA_DOPO.map((s) => s.chiave) : []);
  c("prima e dopo: 3 coppie e 2 video, con liberatoria", [10, true], [T.SLOT_PRIMA_DOPO.length, /primaDopoOk = libOk\("id\.primaDopo\.liberatoria"\)/.test(rotta) && /libOk = \(k: string\) => modifica \|\| liberatoriaOk\(text\(k\)\)/.test(rotta)]);
  c("editor: ogni punto foto/video ha una sezione da cui cambiarlo", [], T.SLOT_ID.map((s) => s.chiave).filter((k) => !chiaviNeiPunti.includes(k)));
  c("editor: nessuna chiave inventata nei bottoni", [], chiaviNeiPunti.filter((k) => !T.SLOT_ID.some((s) => s.chiave === k)));
  c("editor: si accende solo con ?modifica e un accesso aperto", true, /has\("modifica"\)/.test(editor) && /data\.session\?\.user/.test(editor));
  c("editor: salva un campo solo, rileggendo la riga prima", true, /salvaCampoLanding\(/.test(editor) && /export async function salvaCampoLanding[\s\S]*?\.select\("data"\)[\s\S]*?\.upsert\(/.test(leggi("src/landing/landing-content.ts")));
  c("v1: rotta propria, noindex, canonico suo", true, /createFileRoute\("\/invisible-derm-v1"\)/.test(rottaV1) && /noindex,follow/.test(rottaV1) && /\/invisible-derm-v1` \}/.test(rottaV1));
  c("v1: niente calendario fisso nell'hero, si apre nel popup", [false, true], [/prenota-hero/.test(rottaV1), /function PopupPrenota[\s\S]*?<BookingFunnel/.test(rottaV1)]);
  c("v1: hero col prima/dopo", true, /coppia="id\.primaDopoHero"/.test(rottaV1));
  c("v1: Inter e lang it", [true, true], [CAR.usaInter("/invisible-derm-v1"), CAR.paginaInItaliano("/invisible-derm-v1")]);
  c("nessun indirizzo della sede sulla landing (titolare, 13/11/2026)", false, /Scipioni/i.test(pagina));
  c("la home non importa niente della nuova pagina", false, /invisible-derm|testi-invisible/.test(leggi("src/routes/index.tsx")));
}
