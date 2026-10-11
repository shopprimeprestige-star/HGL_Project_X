/** ── LETTURA DEGLI ARTICOLI PER LE PAGINE PUBBLICHE ─────────────────────────
 *  Si usa il client pubblico (chiave anon): il database lascia leggere solo
 *  gli articoli PUBBLICATI e solo le colonne pubbliche (vedi la migrazione
 *  `blog_articoli`). Così le pagine del blog non possono mostrare una bozza
 *  nemmeno per sbaglio, e funzionano uguali sul server (SSR, quello che legge
 *  Google) e nel browser quando si naviga da una pagina all'altra.
 *
 *  ⚠️ SE LA TABELLA NON C'È ANCORA, IL BLOG È VUOTO, NON ROTTO: prima della
 *   migrazione `/blog` dice «presto i primi articoli» invece di un errore. */
import { supabase } from "@/integrations/supabase/client";
import type { RigaArticolo } from "@/seo/regole";

const COLONNE = "id, slug, titolo, descrizione, corpo, parola_chiave, autore, stato, faq, immagine, aggiornato_il, pubblicato_il";
const COLONNE_ELENCO = "slug, titolo, descrizione, corpo, pubblicato_il, aggiornato_il";

type Tabella = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (k: string, v: string) => {
        order: (k: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: unknown }>;
        maybeSingle: () => Promise<{ data: unknown | null; error: unknown }>;
      };
    };
  };
};
const db = () => supabase as unknown as Tabella;

export type VoceElenco = Pick<RigaArticolo, "slug" | "titolo" | "descrizione" | "corpo" | "pubblicato_il" | "aggiornato_il">;

export async function articoliPubblicati(): Promise<VoceElenco[]> {
  try {
    const { data } = await db().from("blog_articoli").select(COLONNE_ELENCO).eq("stato", "pubblicato").order("pubblicato_il", { ascending: false });
    return (data ?? []) as VoceElenco[];
  } catch {
    return [];
  }
}

export async function articoloPubblicato(slug: string): Promise<RigaArticolo | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    const { data } = await db().from("blog_articoli").select(COLONNE).eq("slug", slug).maybeSingle();
    const riga = data as RigaArticolo | null;
    return riga && riga.stato === "pubblicato" ? riga : null;
  } catch {
    return null;
  }
}
