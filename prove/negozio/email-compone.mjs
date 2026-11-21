/** ── NEGOZIO · R2 · T49 · LE EMAIL DELLO SHOP: COME SI COMPONE UN MESSAGGIO (PURO) ───────────────────────────
 *  `src/shop/email/compone.ts` (PIANO-R2 D53, T49; contratto della revisione di T43): variabili a graffa singola, UN SOLO
 *  passaggio (un valore che contiene `{ref}` non si riscrive), valori del cliente con escape HTML, link solo `https://`,
 *  l'indirizzo del cliente solo nella conferma, mai il telefono né il codice fiscale. Dati inventati (`@example.com`, `.example`). */

export async function prove(mod, { c, gruppo }) {
  const K = mod["shop/email/compone"];
  const T = mod["shop/email/tipi"];
  gruppo("NEGOZIO R2 · EMAIL: COME SI COMPONE UN MESSAGGIO (T49)");

  const modello = (chiave, oggetto, testo) => ({ chiave, oggetto, testo, acceso: true, approvato_da: "titolare", approvato_il: "2026-11-21T10:00:00.000Z", approvato_hash: "x" });
  const V = { nome: "Giulia", ref: "HG-T49-1", totale: "€ 38,50", link_ordine: "https://shop.example/shop/ordine/HG-T49-1?t=abc", corriere: "Corriere Prova", numero_tracking: "TRK123", link_tracking: "https://corriere.example/t/TRK123", importo_rimborso: "€ 10,00", riepilogo_righe: "1 × Prodotto di prova — € 38,50", indirizzo_spedizione: "Giulia Prova\nVia di Prova 1\n00100 Roma (RM)\nItalia" };

  // ── la sostituzione ──
  const conf = modello("conferma_ordine", "Ordine {ref}", "Ciao {nome},\nordine {ref} da {totale}.\n{riepilogo_righe}\nSpedizione a:\n{indirizzo_spedizione}\nVedi: {link_ordine}");
  const r = K.componi(conf, V);
  c("oggetto e testo con le variabili sostituite", ["Ordine HG-T49-1", "Ciao Giulia,\nordine HG-T49-1 da € 38,50.\n1 × Prodotto di prova — € 38,50\nSpedizione a:\nGiulia Prova\nVia di Prova 1\n00100 Roma (RM)\nItalia\nVedi: https://shop.example/shop/ordine/HG-T49-1?t=abc"], [r.oggetto, r.testo]);
  c("una variabile ripetuta si sostituisce ogni volta", "Giulia e Giulia", K.componi(modello("annullato", "x", "{nome} e {nome}"), V).testo);
  c("variabile nota senza valore (assente, null, vuota) → niente, senza «undefined» né «null»", ["Ciao ,|", "Ciao ,|", "Ciao ,|"], [{}, { nome: null }, { nome: "" }].map((v) => `${K.componi(modello("annullato", "x", "Ciao {nome},"), v).testo}|${/undefined|null/.test(K.componi(modello("annullato", "x", "{nome}"), v).testo) ? "SPORCO" : ""}`));
  c("valori non stringa (numero, oggetto, array) ignorati: mai «[object Object]»", Array(3).fill(""), [12.5, { a: 1 }, ["x"]].map((n) => K.componi(modello("annullato", "x", "{nome}"), { nome: n }).testo));
  c("una graffa che non è una variabile resta com'è (nessuna eccezione, nessuna sostituzione)", "Ciao {cognome} {Nome} { nome } {nome", K.componi(modello("annullato", "x", "Ciao {cognome} {Nome} { nome } {nome"), V).testo);

  // ── UN SOLO PASSAGGIO (contratto della revisione di T43) ──
  const furbo = K.componi(modello("conferma_ordine", "{nome}", "{nome} / {ref} / {totale}"), { ...V, nome: "{ref} {totale} {{da confermare}}", ref: "{nome}", totale: "{link_ordine}" });
  c("un valore che contiene {ref}, {totale} o `{{` NON viene riscritto né rivalutato", "{ref} {totale} {{da confermare}} / {nome} / {link_ordine}", furbo.testo);
  c("…e vale anche nell'oggetto e nell'html", ["{ref} {totale} {{da confermare}}", true], [furbo.oggetto, furbo.html.includes("{ref} {totale} {{da confermare}} / {nome} / {link_ordine}")]);
  c("le variabili non ammesse per la chiave NON si sostituiscono (l'indirizzo nello «spedito», il prezzo nel pagamento non riuscito)", ["Vai a {indirizzo_spedizione} {riepilogo_righe} {totale}", "Pagamento {totale} {importo_rimborso}"], [
    K.componi(modello("spedito", "x", "Vai a {indirizzo_spedizione} {riepilogo_righe} {totale}"), V).testo, K.componi(modello("pagamento_non_riuscito", "x", "Pagamento {totale} {importo_rimborso}"), V).testo]);
  c("l'indirizzo del cliente sta SOLO nella conferma (testo e html, con tutte le variabili passate a tutti i modelli)", [true, false, false, false, false], T.CHIAVI_EMAIL.map((k) => {
    const m = modello(k, "{nome}", T.VARIABILI_PER_CHIAVE[k].map((v) => `{${v}}`).join("\n"));
    const o = K.componi({ ...m, testo: `${m.testo}\n{indirizzo_spedizione}` }, V);
    return o.testo.includes("Via di Prova 1") || o.html.includes("Via di Prova 1");
  }));
  c("telefono, codice fiscale, email: nessuna variabile li porta, nemmeno se passati", [], ["telefono", "codice_fiscale", "email"].filter((v) => {
    const o = K.componi(modello("conferma_ordine", "{" + v + "}", "{" + v + "}"), { ...V, [v]: "VALORE-RISERVATO" });
    return `${o.oggetto}${o.testo}${o.html}`.includes("VALORE-RISERVATO");
  }));
  c("nessuna variabile (nemmeno quelle) contiene dati fuori elenco: l'elenco è questo", ["nome", "ref", "totale", "link_ordine", "corriere", "numero_tracking", "link_tracking", "importo_rimborso", "riepilogo_righe", "indirizzo_spedizione"], [...T.VARIABILI_NOTE]);

  // ── l'HTML: escape di tutto, link solo https ──
  const cattivo = K.componi(modello("annullato", "Ciao {nome}", "<b>Ciao</b> {nome} & \"{ref}\" 'x'\n<script>alert(1)</script>"), { ...V, nome: "<script>alert(1)</script>", ref: 'a"b\'c&d' });
  c("il nome `<script>` del cliente esce con `&lt;` nell'html", [true, false], [cattivo.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), /<script/i.test(cattivo.html)]);
  c("anche il testo scritto dal titolare è escaped (`<b>` diventa `&lt;b&gt;`), e & \" ' pure", [true, true, true], [cattivo.html.includes("&lt;b&gt;Ciao&lt;/b&gt;"), cattivo.html.includes("&amp;") && !/&(?!amp;|lt;|gt;|quot;|#39;|#x27;)/.test(cattivo.html.replace(/<style[\s\S]*?<\/style>/g, "")), cattivo.html.includes("a&quot;b&#39;c&amp;d")]);
  c("il testo semplice resta testo semplice (nessun escape: non è HTML)", ["<script>alert(1)</script>", "Ciao"], [cattivo.oggetto.replace(/^Ciao /, ""), K.componi(modello("annullato", "x", "Ciao"), V).testo]);
  c("a capo → `<br>` nell'html; niente `<img`, niente `<script`, niente stile esterno", [true, false, false, false], [r.html.includes("Via di Prova 1<br>00100 Roma (RM)<br>Italia"), /<img/i.test(r.html), /<script/i.test(r.html), /<link|@import|url\(/i.test(r.html)]);
  c("html a tabelle, con lingua e codifica", [true, true, true], [/^<!doctype html>/i.test(r.html), r.html.includes("<table") && r.html.includes("role=\"presentation\""), r.html.includes('lang="it"') && /charset=["']?utf-8/i.test(r.html)]);
  c("l'oggetto dell'html (title) è escaped", true, K.componi(modello("annullato", "A<b>", "x"), V).html.includes("<title>A&lt;b&gt;</title>"));
  c("nessun colore rosso nel pagamento non riuscito", false, /red|rosso|#(?:[cdef]00|[cdef][0-9a-f]0{4}|f00)/i.test(K.componi(modello("pagamento_non_riuscito", "x", "Ciao {nome}"), V).html));

  // ── i link: solo https ──
  const link = (url, chiave = "spedito", nome = "link_tracking") => K.componi(modello(chiave, "x", `Segui: {${nome}}`), { ...V, [nome]: url });
  const ok = link("https://corriere.example/t/TRK123");
  c("link tracking https → nel testo e come <a href> nell'html", ["Segui: https://corriere.example/t/TRK123", true], [ok.testo, ok.html.includes('<a href="https://corriere.example/t/TRK123"')]);
  c("link tracking assente → «Segui: » e nessun <a>", [true, false], [link(undefined).testo === "Segui: ", /<a /.test(link(undefined).html)]);
  c("link non https (http, javascript, data, protocollo relativo, mailto, testo qualunque) → niente, né nel testo né nell'html", Array(6).fill([true, false]), ["http://corriere.example/t", "javascript:alert(1)", "data:text/html,x", "//corriere.example/t", "mailto:a@b.it", "corriere.example/t"].map((u) => [link(u).testo === "Segui: ", /<a |href=/.test(link(u).html)]));
  c("link con spazi, a capo, virgolette o `<`/`>` dentro → scartato (non rompe l'attributo)", Array(4).fill(true), ['https://x.example/a b', "https://x.example/a\nb", 'https://x.example/"onmouseover="x', "https://x.example/<b>"].map((u) => link(u).testo === "Segui: " && !/onmouseover|<b>/.test(link(u).html)));
  c("`link_ordine` ha la stessa regola (https o niente)", ["Segui: https://shop.example/shop/ordine/R?t=k", "Segui: "], [link("https://shop.example/shop/ordine/R?t=k", "annullato", "link_ordine").testo, link("http://shop.example/o", "annullato", "link_ordine").testo]);
  c("con `&` nel link: nell'html è `&amp;`, nel testo no", ["Segui: https://x.example/a?b=1&c=2", true], [link("https://x.example/a?b=1&c=2").testo, link("https://x.example/a?b=1&c=2").html.includes('href="https://x.example/a?b=1&amp;c=2"')]);

  // ── l'oggetto è una riga sola ──
  c("a capo nei valori o nel modello: l'oggetto resta una riga (niente intestazioni iniettate)", [false, "Ordine Giulia Bcc: x@y.example"], (() => { const o = K.componi(modello("annullato", "Ordine {nome}\r\nx", "t"), { ...V, nome: "Giulia\nBcc: x@y.example" }).oggetto; return [/[\r\n]/.test(o), o.replace(/\s*x$/, "").replace(/\s+/g, " ")]; })());

  // ── robustezza ──
  c("modello o variabili strani: mai un'eccezione, mai «undefined»", Array(4).fill(false), [[null, V], [{}, V], [modello("annullato", "x", "y"), null], [{ chiave: "annullato", oggetto: 5, testo: ["a"] }, undefined]].map(([m, v]) => { try { const o = K.componi(m, v); return /undefined|\[object/.test(`${o.oggetto}${o.testo}${o.html}`); } catch { return "ECCEZIONE"; } }));
  c("valori molto lunghi (100 mila caratteri) si compongono e si tagliano a un tetto ragionevole", true, (() => { const o = K.componi(modello("annullato", "x", "{nome}"), { ...V, nome: "a".repeat(100_000) }); return o.testo.length <= 5_000 && o.testo.length > 0; })());
}
