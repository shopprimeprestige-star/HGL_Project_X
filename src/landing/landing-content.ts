import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "video";
  default: string;
  hint?: string;
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
      { key: "hero.h1", label: "Titolo H1 (usa [a]...[/a] per highlight)", type: "textarea", default: "Bio-Mimetic™: il [a]nuovo[/a]\nimpianto 2026.\n[a]Invisibile[/a]. Davvero!" },
      { key: "hero.errorPill", label: "Pillola rossa", type: "text", default: "Una patch cutanea si vede sempre." },
      { key: "hero.body", label: "Body sotto H1", type: "textarea", default: "Il [a]Bio-Mimetic™[/a] no. Ho fuso l'invisibilità di una [a]0.03mm[/a] con la resistenza di una [a]0.08mm[/a]. Un impianto che non tradisce mai — neanche a distanza di contatto." },
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
      { key: "s02.body", label: "Body", type: "textarea", default: "La [a]Reticolazione Molecolare[/a] del [a]Bio-Mimetic™[/a] permette alla membrana skin di scomparire sulla pelle pur mantenendo una forza di trazione mai vista." },
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
      { key: "s03.h2R", label: "Titolo destro", type: "textarea", default: "Patch cutanea vs Bio-Mimetic™.\n[a]La differenza è misurabile.[/a]" },
      { key: "s03.stat1Big", label: "Stat 1 big", type: "text", default: "INVISIBILE" },
      { key: "s03.stat1Sub", label: "Stat 1 sub", type: "text", default: "Attaccatura\nbio-mimetica" },
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
      { key: "s04.intro", label: "Intro", type: "textarea", default: "Sport, sudore, mare, sole o doccia: il [a]Bio-Mimetic™[/a] resta naturale e indistinguibile in ogni condizione." },
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
      { key: "s05.h2", label: "Titolo H2", type: "text", default: "Patch cutanea vs Bio-Mimetic™." },
      { key: "s05.body", label: "Body", type: "textarea", default: "A sinistra la patch cutanea comune. A destra la nostra attaccatura ad effetto cute viva — [a]Zero-Edge del Bio-Mimetic™[/a]." },
      { key: "s05.beforeImage", label: "Immagine PRIMA (patch cutanea)", type: "image", default: "" },
      { key: "s05.afterImage", label: "Immagine DOPO (Bio-Mimetic)", type: "image", default: "" },
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
      { key: "slogan.eyebrow", label: "Eyebrow", type: "text", default: "— Bio-Mimetic™ —" },
      { key: "slogan.h2", label: "Titolo H2", type: "textarea", default: "Se non si vede,\n[a]è reale.[/a]" },
      { key: "slogan.body", label: "Body", type: "text", default: "Indistinguibile dalla cute. Anche a distanza di contatto." },
    ],
  },
];

export const DEFAULT_TEXTS: Record<string, string> = LANDING_SCHEMA.reduce(
  (acc, sec) => {
    sec.fields.forEach((f) => {
      if (f.type === "text" || f.type === "textarea") acc[f.key] = f.default;
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
    "Scopri le esperienze autentiche di chi ha trasformato la propria vita con il Bio-Mimetic™.",
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
