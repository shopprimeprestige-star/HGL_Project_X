/** ── /soluzioni · LA LANDING «TRE SOLUZIONI» (landing v3) ───────────────────────────────────────────
 *  Trapianto, patch o Invisible Derm: le tre cose che fa lo studio, nella prima schermata. La pagina vera sta in
 *  `landing/sito/soluzioni`; qui ci sono il CANCELLO, la testa e la cache.
 *
 *  ── IL CANCELLO ──────────────────────────────────────────────────────────
 *  I contenuti arrivano dal `loader` attraverso `leggiSoluzioni` (una funzione del server) già filtrati: il browser
 *  non vede mai il contenuto grezzo del CRM. Senza il video del titolare (video, copertina, conferma dei sottotitoli)
 *  la pagina NON si mostra: reindirizzamento TEMPORANEO (302, mai 301: i browser lo ricordano e la pagina resterebbe
 *  irraggiungibile anche dopo aver caricato il video) alla home, con i soli parametri delle campagne. Database lento
 *  o giù = cancello chiuso = 302: mai un 500. Il codice d'anteprima del CRM apre la pagina anche col cancello chiuso.
 *
 *  ── CACHE ────────────────────────────────────────────────────────────────
 *  `staleTime: Infinity` e `shouldReload: false`: il foglio del modulo (`pushState`) e l'ancora della spiegazione
 *  (`replaceState`) non devono rilanciare il loader.
 *
 *  ── NASCOSTA ─────────────────────────────────────────────────────────────
 *  `noindex`, in `PAGINE_NASCOSTE` (seo/regole.ts) e fuori dalla mappa, finché il titolare non dice «pubblica». */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { PaginaSoluzioni } from "@/landing/sito/soluzioni/PaginaSoluzioni";
import { apriDaRicerca, destinazioneCancello, leggiSoluzioni, registraCancello, VISTA_VUOTA, type VistaSoluzioni } from "@/landing/sito/soluzioni/ponte";
import { PRECARICA_FONT_SOLUZIONI } from "@/landing/sito/soluzioni/ponte-ui";
import { TESTI_SOLUZIONI } from "@/landing/testi-sito";
import { SITO } from "@/seo/regole";

/** La registrazione della visita fermata non ritarda mai il 302 oltre questo tempo. */
const ATTESA_REGISTRAZIONE_MS = 300;

export const Route = createFileRoute("/soluzioni")({
  loaderDeps: ({ search }) => {
    const codice = (search as Record<string, unknown> | undefined)?.anteprima;
    return { anteprima: typeof codice === "string" ? codice : "" };
  },
  staleTime: Infinity,
  shouldReload: false,
  loader: async ({ deps, location }): Promise<VistaSoluzioni> => {
    //  Una lettura che lancia vale «cancello chiuso»: la pagina non si mostra, ma nessuno vede un errore.
    const vista = await leggiSoluzioni({ data: { anteprima: deps.anteprima || undefined } }).catch(() => VISTA_VUOTA);
    if (vista.pubblicabile || vista.anteprima) return vista;
    const ricerca = location.searchStr;
    await Promise.race([
      Promise.resolve(registraCancello({ data: { search: ricerca } })).catch(() => undefined),
      new Promise((fine) => setTimeout(fine, ATTESA_REGISTRAZIONE_MS)),
    ]);
    throw redirect({ href: destinazioneCancello(ricerca), statusCode: 302 });
  },
  head: ({ loaderData, match }) => {
    const t = TESTI_SOLUZIONI.meta;
    //  Con ?apri=invisible-derm (annunci e Reel su Invisible Derm) la descrizione parla di Invisible Derm.
    const descrizione = apriDaRicerca((match as { search?: unknown } | undefined)?.search) ? t.descrizioneApri : t.descrizione;
    const immagine = loaderData?.ogImage ?? null;
    return {
      links: [{ rel: "canonical", href: `${SITO}/soluzioni` }, ...PRECARICA_FONT_SOLUZIONI],
      meta: [
        { title: t.titolo },
        { name: "description", content: descrizione },
        //  Nascosta finché il titolare non dice «pubblica» (vedi PAGINE_NASCOSTE in seo/regole.ts).
        { name: "robots", content: "noindex" },
        { property: "og:title", content: t.titoloSocial },
        { property: "og:description", content: descrizione },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITO}/soluzioni` },
        { property: "og:site_name", content: "Hair Genius Labs" },
        { property: "og:locale", content: "it_IT" },
        ...(immagine
          ? [
              { property: "og:image", content: immagine },
              ...(loaderData?.video?.slot.alt ? [{ property: "og:image:alt", content: loaderData.video.slot.alt }] : []),
              { name: "twitter:card", content: "summary_large_image" },
              { name: "twitter:image", content: immagine },
            ]
          : []),
      ],
    };
  },
  component: Soluzioni,
});

function Soluzioni() {
  const vista = Route.useLoaderData();
  const apriDalServer = apriDaRicerca(Route.useSearch());
  return <PaginaSoluzioni vista={vista} apriDalServer={apriDalServer} />;
}
