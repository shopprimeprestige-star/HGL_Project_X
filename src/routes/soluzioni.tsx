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
import { leggiSoluzioni, registraCancello } from "@/landing/sito/soluzioni/contenuti";
import { PRECARICA_FONT_SOLUZIONI } from "@/landing/sito/soluzioni/font";
import { apriDaRicerca, destinazioneCancello, VISTA_VUOTA, type VistaSoluzioni } from "@/landing/sito/soluzioni/regole";
import { TESTI_SOLUZIONI } from "@/landing/testi-sito";
import { SITO } from "@/seo/regole";

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
    //  `registraCancello` aspetta al massimo 300 ms da sé (S1): il 302 non dipende dalla scrittura. Un errore non lo ferma.
    await Promise.resolve(registraCancello({ data: { search: ricerca } })).catch(() => undefined);
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
              //  L'alt è quello della copertina: vale solo quando l'immagine di condivisione è la copertina.
              ...(loaderData?.video && immagine === loaderData.video.slot.poster ? [{ property: "og:image:alt", content: loaderData.video.slot.alt }] : []),
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
