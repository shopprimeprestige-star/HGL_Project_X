/** ── LE REGOLE DELLA SEO DEL SITO PUBBLICO ──────────────────────────────────
 *
 *  Un modulo puro: niente React, niente database. Decide che cosa dire ai
 *  motori di ricerca (robots.txt, sitemap.xml, dati strutturati) e controlla
 *  che un articolo del blog sia pronto prima che qualcuno lo pubblichi.
 *  Le prove stanno in `prove/prove.mjs` → proveDellaSeo.
 *
 *  ⚠️ LE PAGINE PRIVATE NON SI NASCONDONO QUI. CRM, preventivo, Meetly, area
 *   consulente e webinar dichiarano già `noindex` nella loro testata, ed è
 *   quello che le toglie da Google. Bloccarle anche in robots.txt sarebbe
 *   peggio: Google non potrebbe più leggere il `noindex` e potrebbe tenere
 *   l'indirizzo in elenco senza contenuto. Qui si blocca solo ciò che non è
 *   una pagina (le API) e il gestionale, dove non c'è niente da leggere.
 *
 *  ⚠️ NIENTE PREZZI NEGLI ARTICOLI. Decisione del titolare (11/10/2026): il
 *   prezzo non si scrive mai, né nei video né nel blog. `controllaArticolo`
 *   lo blocca, così un articolo con una cifra in euro non arriva online.
 *  ───────────────────────────────────────────────────────────────────────── */

export const SITO = "https://hair-genius-hub.hair";
export const MARCHIO = "Hair Genius Labs";

/** Pagine pubbliche fisse che vanno nella mappa del sito. */
export const PAGINE_PUBBLICHE: readonly string[] = [
  "/",
  //  "/blog" entra qui quando la pagina del blog esiste: un indirizzo che
  //  risponde 404 nella mappa del sito è un errore per Google.
  "/shop",
  "/privacy-policy",
  "/cookie-policy",
  "/termini-e-condizioni",
];

/** Percorsi che non sono pagine da leggere: si chiedono ai motori di non visitarli. */
export const NON_VISITARE: readonly string[] = ["/api/", "/CRM"];

export function robotsTxt(sito: string = SITO): string {
  const righe = ["User-agent: *", ...NON_VISITARE.map((p) => `Disallow: ${p}`), "", `Sitemap: ${sito}/sitemap.xml`, ""];
  return righe.join("\n");
}

export type VoceMappa = { percorso: string; aggiornato?: string | null };

const XML_SOSTITUZIONI: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
export function xmlSicuro(testo: string): string {
  return testo.replace(/[&<>"']/g, (c) => XML_SOSTITUZIONI[c]);
}

/** Una data accettabile per <lastmod>: solo AAAA-MM-GG (o un ISO completo, ridotto al giorno). */
export function giornoIso(valore: string | null | undefined): string | null {
  if (!valore) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(valore.trim());
  return m ? m[1] : null;
}

/** La mappa del sito: indirizzi assoluti, ognuno una volta sola, nell'ordine dato. */
export function sitemapXml(voci: readonly VoceMappa[], sito: string = SITO): string {
  const visti = new Set<string>();
  const url: string[] = [];
  for (const v of voci) {
    if (!v || typeof v.percorso !== "string" || !v.percorso.startsWith("/")) continue;
    const loc = sito + (v.percorso === "/" ? "/" : v.percorso.replace(/\/+$/, ""));
    if (visti.has(loc)) continue;
    visti.add(loc);
    const giorno = giornoIso(v.aggiornato);
    url.push(`  <url><loc>${xmlSicuro(loc)}</loc>${giorno ? `<lastmod>${giorno}</lastmod>` : ""}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${url.join("\n")}\n</urlset>\n`;
}

/** Lo slug di un articolo: minuscole, senza accenti, parole separate da un trattino. */
export function slugDaTitolo(titolo: string): string {
  return titolo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function contaParole(testo: string): number {
  const pulito = testo.replace(/[#*_>`[\]()!-]/g, " ").trim();
  return pulito ? pulito.split(/\s+/).length : 0;
}

/** Minuti di lettura a 200 parole al minuto, almeno 1. */
export function minutiDiLettura(testo: string): number {
  return Math.max(1, Math.round(contaParole(testo) / 200));
}

export type Faq = { domanda: string; risposta: string };
export type Articolo = {
  slug: string;
  titolo: string; // <title> e H1
  descrizione: string; // meta description
  corpo: string; // Markdown
  parolaChiave: string;
  autore: string;
  pubblicato?: string | null; // ISO
  aggiornato?: string | null; // ISO
  immagine?: string | null; // URL assoluto
  faq?: Faq[];
};

export type Problema = { campo: string; messaggio: string };

/** Che cosa manca perché l'articolo sia pubblicabile. Vuoto = pronto. */
export function controllaArticolo(a: Articolo): Problema[] {
  const p: Problema[] = [];
  const titolo = (a.titolo || "").trim();
  const descrizione = (a.descrizione || "").trim();
  const chiave = (a.parolaChiave || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug || "")) p.push({ campo: "slug", messaggio: "slug: solo minuscole, numeri e trattini" });
  if (titolo.length < 20 || titolo.length > 60) p.push({ campo: "titolo", messaggio: `titolo di ${titolo.length} caratteri: servono 20-60` });
  if (descrizione.length < 70 || descrizione.length > 160) p.push({ campo: "descrizione", messaggio: `descrizione di ${descrizione.length} caratteri: servono 70-160` });
  if (!chiave) p.push({ campo: "parolaChiave", messaggio: "manca la parola chiave principale" });
  else {
    if (!titolo.toLowerCase().includes(chiave)) p.push({ campo: "titolo", messaggio: "la parola chiave non è nel titolo" });
    const inizio = (a.corpo || "").slice(0, 600).toLowerCase();
    if (!inizio.includes(chiave)) p.push({ campo: "corpo", messaggio: "la parola chiave non compare nelle prime righe" });
  }
  const parole = contaParole(a.corpo || "");
  if (parole < 600) p.push({ campo: "corpo", messaggio: `solo ${parole} parole: un articolo utile ne ha almeno 600` });
  if (/^#\s/m.test(a.corpo || "")) p.push({ campo: "corpo", messaggio: "il corpo non deve avere un H1 (# ): il titolo è già l'H1" });
  if (!/^##\s/m.test(a.corpo || "")) p.push({ campo: "corpo", messaggio: "servono dei sottotitoli H2 (## )" });
  if (!(a.autore || "").trim()) p.push({ campo: "autore", messaggio: "manca l'autore: Google lo chiede per i temi di salute ed estetica" });
  const testoTutto = [titolo, descrizione, a.corpo, ...(a.faq || []).flatMap((f) => [f.domanda, f.risposta])].join(" ");
  if (/(?:€\s?\d|\d[\d.,]*\s?(?:€|euro\b))/i.test(testoTutto)) p.push({ campo: "corpo", messaggio: "c'è una cifra in euro: il prezzo non si scrive mai" });
  if (/\{\{[^}]*\}\}|\[da confermare\]|\[inserisci/i.test(testoTutto)) p.push({ campo: "corpo", messaggio: "c'è un segnaposto da compilare" });
  if (/—/.test(testoTutto)) p.push({ campo: "corpo", messaggio: "c'è un trattino lungo (—): passalo da /umano" });
  for (const f of a.faq || []) {
    if (!f.domanda?.trim() || !f.risposta?.trim()) { p.push({ campo: "faq", messaggio: "una domanda frequente è vuota" }); break; }
  }
  return p;
}

/** I dati strutturati dell'articolo: BlogPosting + percorso + domande frequenti. */
export function datiStrutturatiArticolo(a: Articolo, sito: string = SITO): object[] {
  const url = `${sito}/blog/${a.slug}`;
  const blocchi: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: a.titolo,
      description: a.descrizione,
      mainEntityOfPage: url,
      url,
      inLanguage: "it-IT",
      author: { "@type": "Person", name: a.autore },
      publisher: { "@type": "Organization", name: MARCHIO, url: sito },
      ...(a.pubblicato ? { datePublished: a.pubblicato } : {}),
      ...(a.aggiornato || a.pubblicato ? { dateModified: a.aggiornato || a.pubblicato } : {}),
      ...(a.immagine ? { image: [a.immagine] } : {}),
      keywords: a.parolaChiave,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${sito}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${sito}/blog` },
        { "@type": "ListItem", position: 3, name: a.titolo, item: url },
      ],
    },
  ];
  const faq = (a.faq || []).filter((f) => f.domanda?.trim() && f.risposta?.trim());
  if (faq.length) {
    blocchi.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.domanda, acceptedAnswer: { "@type": "Answer", text: f.risposta } })),
    });
  }
  return blocchi;
}

/** Dati strutturati dell'attività (homepage). Solo dati certi: niente telefono finché i numeri sul sito non coincidono. */
export function datiStrutturatiAttivita(sito: string = SITO): object {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: MARCHIO,
    url: sito,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Via degli Scipioni 132",
      addressLocality: "Roma",
      postalCode: "00192",
      addressCountry: "IT",
    },
  };
}

/** Testo sicuro da mettere dentro <script type="application/ld+json">. */
export function jsonLd(dati: object): string {
  return JSON.stringify(dati).replace(/</g, "\\u003c");
}
