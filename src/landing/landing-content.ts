import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NOME_PRODOTTO } from "@/landing/testi-sito";

export type Review = {
  id: string;
  name: string;
  location: string;
  rating: number;
  title: string;
  text: string;
  videoUrl: string;
  posterUrl: string;
};

export type LandingContent = {
  texts: Record<string, string>;
  media: Record<string, string>;
  reviewsBadge: string;
  reviewsCount: string;
  reviewsHeadline: string;
  reviewsSubhead: string;
  reviews: Review[];
};

/** Proporzioni (o misura fissa) che un media deve avere: l'editor le scrive sotto il campo e avvisa, senza bloccare. */
export type Formato = "16:9" | "9:16" | "4:5" | "4:3" | "3:2" | "1:1" | "1200x630";

export type FieldDef = {
  key: string;
  label: string;
  /** `interruttore` si salva come "1" (acceso) o "" (spento); `scelta` come il `valore` di una delle `opzioni`.
   *  Tutti e due vivono in `texts`, con predefinito "". */
  type: "text" | "textarea" | "image" | "video" | "interruttore" | "scelta";
  default: string;
  hint?: string;
  formato?: Formato;
  /** Peso massimo consigliato, scritto come lo legge il titolare: "120 KB", "1,5 MB". */
  pesoMax?: string;
  opzioni?: { valore: string; etichetta: string }[];
};

export type SectionDef = {
  id: string;
  title: string;
  fields: FieldDef[];
};

/**
 * Schema dei campi modificabili della landing.
 * Tutti i testi supportano [a]...[/a] per highlight brand e \n per a-capo.
 */
export const LANDING_SCHEMA: SectionDef[] = [
  {
    id: "hero",
    title: "Hero (sezione iniziale)",
    fields: [
      { key: "hero.eyebrow1", label: "Eyebrow 1", type: "text", default: "Il problema non è averlo." },
      { key: "hero.eyebrow2", label: "Eyebrow 2 (accent)", type: "text", default: "È che non si noti." },
      { key: "hero.h1", label: "Titolo H1 (usa [a]...[/a] per highlight)", type: "textarea", default: "" + NOME_PRODOTTO + ": il [a]nuovo[/a]\nimpianto 2026.\n[a]Invisibile[/a]. Davvero!" },
      { key: "hero.errorPill", label: "Pillola rossa", type: "text", default: "Una patch cutanea si vede sempre." },
      { key: "hero.body", label: "Body sotto H1", type: "textarea", default: "Il [a]" + NOME_PRODOTTO + "[/a] no. Ho fuso l'invisibilità di una [a]0.03mm[/a] con la resistenza di una [a]0.08mm[/a]. Un impianto che non tradisce mai — neanche a distanza di contatto." },
      { key: "hero.priceLabel", label: "Etichetta prezzo", type: "text", default: "Valutazione professionale" },
      { key: "hero.priceOld", label: "Prezzo barrato", type: "text", default: "47€" },
      { key: "hero.priceNew", label: "Prezzo attuale (label)", type: "text", default: "Oggi:" },
      { key: "hero.priceHighlight", label: "Prezzo highlight", type: "text", default: "GRATIS" },
      { key: "hero.calendarTopLabel", label: "Label sopra calendario", type: "text", default: "Candidati per l'analisi tecnica" },
      { key: "hero.calendarBottomLabel", label: "Label sotto calendario", type: "text", default: "Analisi tecnica [a]gratuita[/a] · slot limitati mensili" },
    ],
  },
  {
    id: "s02",
    title: "Sezione 02 — Resistenza & Tecnologia",
    fields: [
      { key: "s02.eyebrow", label: "Eyebrow", type: "text", default: "02 · Resistenza & Tecnologia" },
      { key: "s02.h2", label: "Titolo H2", type: "textarea", default: "Invisibilità Skin.\nForza HD.\nSenza compromessi." },
      { key: "s02.body", label: "Body", type: "textarea", default: "La [a]Reticolazione Molecolare[/a] del [a]" + NOME_PRODOTTO + "[/a] permette alla membrana skin di scomparire sulla pelle pur mantenendo una forza di trazione mai vista." },
      { key: "s02.note", label: "Nota laterale", type: "textarea", default: "[a]Non è Lace.[/a] È una membrana continua: zero reti, zero nodi. Invisibilità totale. Resistenza da 0.08. Questo si che è assurdo." },
      { key: "s02.media", label: "Video / immagine destra", type: "video", default: "" },
    ],
  },
  {
    id: "s03",
    title: "Sezione 03 — Test della Verità + Confronto",
    fields: [
      { key: "s03.eyebrowL", label: "Eyebrow sinistro", type: "text", default: "03 · Test della Verità" },
      { key: "s03.h3L", label: "Titolo sinistro", type: "textarea", default: "Vedilo da vicino.\n[a]In alta definizione.[/a]" },
      { key: "s03.media", label: "Video del test", type: "video", default: "" },
      { key: "s03.bodyL1", label: "Paragrafo 1", type: "textarea", default: "Nessun nodo. Nessun riflesso sintetico. Il trattamento [a]Derm-Sync[/a] rende l'impianto indistinguibile dalla tua cute anche a distanza di contatto." },
      { key: "s03.bodyL2", label: "Paragrafo 2 (brand)", type: "textarea", default: "Questa è la distanza a cui ti guarda una persona. Guardala tu per primo." },
      { key: "s03.h2R", label: "Titolo destro", type: "textarea", default: "Patch cutanea vs " + NOME_PRODOTTO + ".\n[a]La differenza è misurabile.[/a]" },
      { key: "s03.stat1Big", label: "Stat 1 big", type: "text", default: "INVISIBILE" },
      { key: "s03.stat1Sub", label: "Stat 1 sub", type: "text", default: "Attaccatura\ninvisibile" },
      { key: "s03.stat2Big", label: "Stat 2 big", type: "text", default: "X5" },
      { key: "s03.stat2Sub", label: "Stat 2 sub", type: "text", default: "Forza\nreticolata" },
      { key: "s03.stat3Big", label: "Stat 3 big", type: "text", default: "120 MIN" },
      { key: "s03.stat3Sub", label: "Stat 3 sub", type: "text", default: "Installazione\ncompleta" },
    ],
  },
  {
    id: "s04",
    title: "Sezione 04 — I 3 Pilastri",
    fields: [
      { key: "s04.eyebrow", label: "Eyebrow", type: "text", default: "04 · I 3 Pilastri" },
      { key: "s04.h2", label: "Titolo H2", type: "textarea", default: "Vivi la tua vita.\nL'impianto resta invisibile." },
      { key: "s04.intro", label: "Intro", type: "textarea", default: "Sport, sudore, mare, sole o doccia: il [a]" + NOME_PRODOTTO + "[/a] resta naturale e indistinguibile in ogni condizione." },
      { key: "s04.pill1", label: "Pill 1", type: "text", default: "Sport intenso" },
      { key: "s04.pill2", label: "Pill 2", type: "text", default: "Sudore prolungato" },
      { key: "s04.pill3", label: "Pill 3", type: "text", default: "Mare e piscina" },
      { key: "s04.pill4", label: "Pill 4", type: "text", default: "Luce diretta" },
      { key: "s04.p1Title", label: "Pillar 1 - Titolo", type: "text", default: "Corri. Suda. Non cambia niente." },
      { key: "s04.p1Hook", label: "Pillar 1 - Hook", type: "text", default: "Sei a metà di una gara. Non puoi fermarti a controllare." },
      { key: "s04.p1Kicker", label: "Pillar 1 - Kicker", type: "text", default: "TENUTA HD ANCHE SOTTO SFORZO." },
      { key: "s04.p1Desc", label: "Pillar 1 - Descrizione", type: "textarea", default: "Corsa, palestra, crossfit, ciclismo: spingi al massimo. Non cede." },
      { key: "s04.p2Title", label: "Pillar 2 - Titolo", type: "text", default: "Mare, piscina, sauna. Resta invisibile." },
      { key: "s04.p2Hook", label: "Pillar 2 - Hook", type: "text", default: "Stai per tuffarti. Gli altri ti guardano. Non ci pensi nemmeno." },
      { key: "s04.p2Kicker", label: "Pillar 2 - Kicker", type: "text", default: "RESISTENTE A SALE E CLORO." },
      { key: "s04.p2Desc", label: "Pillar 2 - Descrizione", type: "textarea", default: "Tuffi, nuotate, sauna, sudorazione prolungata: tuffati. La membrana non si muove." },
      { key: "s04.p3Title", label: "Pillar 3 - Titolo", type: "text", default: "In spiaggia, sotto il sole diretto. Nessuno lo vede." },
      { key: "s04.p3Hook", label: "Pillar 3 - Hook", type: "text", default: "La luce più crudele. E nessuno vede niente." },
      { key: "s04.p3Kicker", label: "Pillar 3 - Kicker", type: "text", default: "ZERO RIFLESSI, ZERO SCALINI." },
      { key: "s04.p3Desc", label: "Pillar 3 - Descrizione", type: "textarea", default: "Sotto la luce diretta, in spiaggia o in piscina: esci al sole. Non ci pensare." },
    ],
  },
  {
    id: "s05",
    title: "Sezione 05 — Il Confronto (immagini)",
    fields: [
      { key: "s05.eyebrow", label: "Eyebrow", type: "text", default: "05 · Il Confronto" },
      { key: "s05.h2", label: "Titolo H2", type: "text", default: "Patch cutanea vs " + NOME_PRODOTTO + "." },
      { key: "s05.body", label: "Body", type: "textarea", default: "A sinistra la patch cutanea comune. A destra la nostra attaccatura ad effetto cute viva — [a]Zero-Edge del " + NOME_PRODOTTO + "[/a]." },
      { key: "s05.beforeImage", label: "Immagine PRIMA (patch cutanea)", type: "image", default: "" },
      { key: "s05.afterImage", label: "Immagine DOPO (" + NOME_PRODOTTO + ")", type: "image", default: "" },
    ],
  },
  {
    id: "banner",
    title: "Banner bianco con logo",
    fields: [
      { key: "banner.eyebrow", label: "Eyebrow", type: "text", default: "— Hair Genius Labs —" },
      { key: "banner.h2", label: "Titolo (usa \\n per a-capo)", type: "textarea", default: "Il segreto è che\n[a]non deve sembrare un segreto.[/a]" },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    fields: [
      { key: "faq.eyebrow", label: "Eyebrow", type: "text", default: "07 · FAQ" },
      { key: "faq.h2", label: "Titolo H2", type: "text", default: "Tutto quello che vuoi sapere." },
      { key: "faq.sub", label: "Sottotitolo", type: "text", default: "Tocca una domanda per espandere la risposta." },
    ],
  },
  {
    id: "s08",
    title: "Sezione 08 — Prenota",
    fields: [
      { key: "s08.eyebrow", label: "Eyebrow", type: "text", default: "08 · Posti Limitati" },
      { key: "s08.h2", label: "Titolo H2", type: "text", default: "Prenota la tua analisi tecnica." },
      { key: "s08.hook", label: "Hook", type: "text", default: "Se ci sei arrivato fin qui, la risposta la sai già." },
      { key: "s08.body", label: "Body", type: "textarea", default: "Accettiamo pochi nuovi casi al mese. Analisi [a]gratuita[/a] fino a esaurimento posti." },
      { key: "s08.urgency", label: "Urgency line", type: "text", default: "Hai già aspettato abbastanza." },
      { key: "s08.priceLabel", label: "Label prezzo", type: "text", default: "Valutazione professionale" },
      { key: "s08.cta", label: "Label CTA", type: "text", default: "Verifica disponibilità e blocca lo slot [a]gratuito[/a]" },
    ],
  },
  {
    id: "slogan",
    title: "Slogan finale",
    fields: [
      { key: "slogan.eyebrow", label: "Eyebrow", type: "text", default: "— " + NOME_PRODOTTO + " —" },
      { key: "slogan.h2", label: "Titolo H2", type: "textarea", default: "Se non si vede,\n[a]è reale.[/a]" },
      { key: "slogan.body", label: "Body", type: "text", default: "Indistinguibile dalla cute. Anche a distanza di contatto." },
    ],
  },
  {
    id: "v3",
    title: "Landing «Tre soluzioni»",
    fields: [
      { key: "v3.invisibleVideo", label: "Video del titolare: Che cos'è " + NOME_PRODOTTO, type: "video", default: "", formato: "9:16", pesoMax: "10 MB", hint: "Verticale 9:16 (sulla pagina si vede 4:5). mp4 H.264 720×1280, 25-35 secondi, audio AAC, al massimo 10 MB. Sottotitoli già impressi nel video, fra y 1300 e 1550 su 1920. Senza questo video la pagina non va online." },
      { key: "v3.invisiblePoster", label: "Copertina del video", type: "image", default: "", formato: "4:5", pesoMax: "120 KB", hint: "4:5, webp, al massimo 120 KB. Un fotogramma fermo dell'inizio del video. Senza copertina la pagina non va online." },
      { key: "v3.invisibleVideoAlt", label: "Descrizione della copertina (per chi non vede)", type: "text", default: "Il titolare di Hair Genius Labs ti guarda in camera, nello studio di Roma, e sta per spiegarti " + NOME_PRODOTTO + "." },
      { key: "v3.invisibleSottotitoli", label: "Ho controllato: i sottotitoli sono impressi nel video", type: "interruttore", default: "", hint: "Senza questa conferma la pagina non va online." },
      { key: "v3.invisibleTrascrizione", label: "Testo del video (le parole dette davvero)", type: "textarea", default: "", hint: "Se è vuoto, il link «Leggi il testo del video» non compare." },
      { key: "protocol.titolareFoto", label: "Ritratto del titolare", type: "image", default: "", formato: "4:5", hint: "4:5, il volto al centro (sulla pagina si vede in un cerchio). Se manca, il cerchio non compare." },
      { key: "protocol.titolareFotoAlt", label: "Descrizione del ritratto", type: "text", default: "Il titolare di Hair Genius Labs, in studio, ti guarda e sorride." },
      { key: "v3.trapiantoFoto", label: "Foto del trapianto", type: "image", default: "", formato: "3:2", pesoMax: "80 KB", hint: "3:2, il titolare nel quadrato centrale, webp, al massimo 80 KB. Se manca, le tre soluzioni diventano solo testo." },
      { key: "v3.trapiantoFotoAlt", label: "Descrizione della foto del trapianto", type: "text", default: "Il titolare di Hair Genius Labs in consulenza: ti guarda in camera, con una mano aperta, nello studio di Roma." },
      { key: "v3.trapiantoChi", label: "Chi si vede nella foto del trapianto", type: "scelta", default: "", opzioni: [{ valore: "titolare", etichetta: "Solo il titolare o un collaboratore" }, { valore: "cliente", etichetta: "C'è un cliente" }], hint: "Se non scegli, vale «C'è un cliente»: la foto non si vede finché non accendi la liberatoria." },
      { key: "v3.trapiantoLiberatoria", label: "Ho la liberatoria scritta", type: "interruttore", default: "", hint: "Accendilo solo se la liberatoria firmata è in 14-legale o nella scheda del cliente." },
      { key: "home.cartaCatalogoFoto", label: "Foto della patch", type: "image", default: "", formato: "4:3", hint: "4:3 (si ritaglia al centro in 3:2 e 1:1). Se manca, si usa la foto del primo articolo in stock del negozio." },
      { key: "home.cartaCatalogoFotoAlt", label: "Descrizione della foto della patch", type: "text", default: "Una patch tenuta in mano su fondo chiaro." },
      { key: "v3.invisibleMiniatura", label: "Foto ferma di " + NOME_PRODOTTO + " (scheda chiusa)", type: "image", default: "", formato: "3:2", pesoMax: "80 KB", hint: "3:2, soggetto nel quadrato centrale (va bene anche 1:1), webp, al massimo 80 KB. Se manca, si usa la copertina della clip del pettine." },
      { key: "v3.invisibleMiniaturaAlt", label: "Descrizione della foto ferma", type: "text", default: "Il pettine solleva l'attaccatura in primo piano, alla luce dello studio." },
      { key: "protocol.macroVideo", label: "Clip del pettine sull'attaccatura", type: "video", default: "", formato: "4:5", pesoMax: "1,5 MB", hint: "4:5, muta, 6-8 secondi, senza lampi né stacchi al giro, al massimo 1,5 MB." },
      { key: "protocol.macroPoster", label: "Copertina della clip", type: "image", default: "", formato: "4:5", hint: "4:5. Senza copertina la clip non compare." },
      { key: "protocol.macroVideoAlt", label: "Descrizione della clip", type: "text", default: "Primo piano dell'attaccatura frontale di un uomo, con un pettine che solleva i capelli. Video breve senza audio." },
      { key: "v3.macroChi", label: "Chi si vede nella clip", type: "scelta", default: "", opzioni: [{ valore: "titolare", etichetta: "Solo il titolare o un collaboratore" }, { valore: "cliente", etichetta: "C'è un cliente" }], hint: "Se non scegli, vale «C'è un cliente»: la clip non si vede finché non accendi la liberatoria." },
      { key: "v3.macroLiberatoria", label: "Ho la liberatoria scritta", type: "interruttore", default: "", hint: "Accendilo solo se la liberatoria firmata è in 14-legale o nella scheda del cliente." },
      { key: "v3.condivisioneImmagine", label: "Immagine per la condivisione (WhatsApp, social)", type: "image", default: "", formato: "1200x630", pesoMax: "200 KB", hint: "1200×630, webp o jpg, al massimo 200 KB. Se manca, si usa la copertina del video." },
    ],
  },
];

export const DEFAULT_TEXTS: Record<string, string> = LANDING_SCHEMA.reduce(
  (acc, sec) => {
    sec.fields.forEach((f) => {
      if (f.type === "text" || f.type === "textarea" || f.type === "interruttore" || f.type === "scelta") acc[f.key] = f.default;
    });
    return acc;
  },
  {} as Record<string, string>,
);

export const DEFAULT_MEDIA: Record<string, string> = LANDING_SCHEMA.reduce(
  (acc, sec) => {
    sec.fields.forEach((f) => {
      if (f.type === "image" || f.type === "video") acc[f.key] = f.default;
    });
    return acc;
  },
  {} as Record<string, string>,
);

export const DEFAULT_REVIEWS: Review[] = [
  {
    id: "r1",
    name: "Gianfranco — Reggio Emilia",
    location: "Reggio Emilia",
    rating: 5,
    title: "Trapianto Non Chirurgico — Risultati Incredibili",
    text:
      "Ero molto scettico, ma sono rimasto piacevolmente sorpreso. La tenuta è incredibile: mi faccio spesso il bagno a mare più volte e davvero resiste a qualsiasi cosa. Ho ritrovato la fiducia in me stesso, sembra che ho 10 anni di meno.",
    videoUrl: "",
    posterUrl: "",
  },
  {
    id: "r2",
    name: "Marco — Frosinone",
    location: "Frosinone",
    rating: 5,
    title: "Aspetto Naturale e Comfort Totale",
    text:
      "Ero già portatore da circa 3 anni: la membrana e il capello che utilizzano loro fanno la differenza. L'aspetto naturale è incredibile, sensazione come se non avessi nulla sulla testa.",
    videoUrl: "",
    posterUrl: "",
  },
  {
    id: "r3",
    name: "Andrea — Sicilia",
    location: "Sicilia",
    rating: 5,
    title: "Dopo due trapianti falliti, finalmente la soluzione",
    text:
      "Dopo due tentativi falliti, un amico mi ha parlato di loro. Effetto naturale impressionante. Nessun fastidio o prurito, anche dopo 2 ore di crossfit al giorno: sudore, docce, regge in modo incredibile.",
    videoUrl: "",
    posterUrl: "",
  },
];

export const DEFAULT_LANDING: LandingContent = {
  texts: DEFAULT_TEXTS,
  media: DEFAULT_MEDIA,
  reviewsBadge: "Verificato da Clienti Reali",
  reviewsCount: "Oltre 1326 Clienti Soddisfatti",
  reviewsHeadline: "Storie vere. Risultati veri.",
  reviewsSubhead:
    "Scopri le esperienze autentiche di chi ha trasformato la propria vita con il " + NOME_PRODOTTO + ".",
  reviews: DEFAULT_REVIEWS,
};

export function mergeLandingContent(raw: unknown): LandingContent {
  if (!raw || typeof raw !== "object") return DEFAULT_LANDING;
  const r = raw as Partial<LandingContent>;
  return {
    texts: { ...DEFAULT_TEXTS, ...(r.texts || {}) },
    media: { ...DEFAULT_MEDIA, ...(r.media || {}) },
    reviewsBadge: r.reviewsBadge || DEFAULT_LANDING.reviewsBadge,
    reviewsCount: r.reviewsCount || DEFAULT_LANDING.reviewsCount,
    reviewsHeadline: r.reviewsHeadline || DEFAULT_LANDING.reviewsHeadline,
    reviewsSubhead: r.reviewsSubhead || DEFAULT_LANDING.reviewsSubhead,
    reviews:
      Array.isArray(r.reviews) && r.reviews.length > 0
        ? r.reviews.map((rev, i) => ({
            ...(DEFAULT_REVIEWS[i % DEFAULT_REVIEWS.length] || DEFAULT_REVIEWS[0]),
            ...rev,
          }))
        : DEFAULT_REVIEWS,
  };
}

export function useLandingContent() {
  const [content, setContent] = useState<LandingContent>(DEFAULT_LANDING);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    supabase
      .from("landing_content")
      .select("data")
      .eq("id", "default")
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setContent(mergeLandingContent(data?.data));
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const text = useCallback(
    (key: string) => content.texts[key] ?? DEFAULT_TEXTS[key] ?? "",
    [content],
  );
  const media = useCallback(
    (key: string) => content.media[key] ?? DEFAULT_MEDIA[key] ?? "",
    [content],
  );
  return useMemo(() => ({ content, loading, text, media }), [content, loading, text, media]);
}
