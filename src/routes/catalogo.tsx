/** ── /catalogo · PAGINA PROVVISORIA ─────────────────────────────────────────
 *  «Scegli dal catalogo» porta qui finché il catalogo vero (fase 2) non c'è.
 *  Lo shop d'esempio ha stelle, recensioni e prezzi barrati inventati e una
 *  cassa senza pagamento: mandarci tutti i visitatori della home sarebbe
 *  mostrare cose non vere. Quindi una frase onesta, il bottone della
 *  consulenza e, solo se il titolare lo accende (`linkShopDiProva`), il
 *  collegamento allo shop di prova.
 *  Niente date inventate, niente «a breve», niente prezzi.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { MouseEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SITO } from "@/seo/regole";
import { BarraConsulenza } from "@/components/landing/consulenza/BarraConsulenza";
import { CookieBanner } from "@/components/landing/CookieBanner";
import { Footer } from "@/components/landing/Footer";
import { Bottone, Marchio, vaiDopo } from "@/landing/sito/pezzi";
import { mostraLinkShop, testoBottoneConsulenza } from "@/landing/sito/pagine-regole";
import {
  BOTTONE_VARIANTE_B,
  INTERRUTTORI,
  LINK_CONSULENZA,
  LINK_SHOP_DI_PROVA,
  TESTI_CATALOGO,
} from "@/landing/testi-sito";
import { traccia, usaTracciamentoPagina, usaVariante } from "@/landing/sito/traccia-provvisoria";

export const Route = createFileRoute("/catalogo")({
  component: Catalogo,
  head: () => ({
    links: [{ rel: "canonical", href: `${SITO}/catalogo` }],
    meta: [
      { title: TESTI_CATALOGO.meta.titolo },
      { name: "description", content: TESTI_CATALOGO.meta.descrizione },
      { property: "og:title", content: TESTI_CATALOGO.meta.titolo },
      { property: "og:description", content: TESTI_CATALOGO.meta.descrizione },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITO}/catalogo` },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:locale", content: "it_IT" },
    ],
  }),
});

function Catalogo() {
  usaTracciamentoPagina("catalogo");
  const variante = usaVariante();
  const t = TESTI_CATALOGO;

  const perLaConsulenza = (e: MouseEvent<HTMLAnchorElement>) => {
    vaiDopo(e, LINK_CONSULENZA, () => traccia("click_bottone", { bottone: "catalogo_consulenza", sezione: "catalogo" }));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main id="top" className="bg-blueprint flex-1 text-white">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-6 lg:px-10 lg:pb-28 lg:pt-12">
          <a href="/" aria-label="Hair Genius Labs, torna alla home" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <Marchio />
          </a>
          <h1 className="mt-10 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:mt-16 lg:text-6xl">
            {t.titolo}
          </h1>
          <p className="mt-5 max-w-xl text-xl font-semibold leading-snug text-white">{t.testo}</p>
          <p className="mt-2 max-w-xl text-lg leading-relaxed text-white/80">{t.seguito}</p>
          <div data-barra-nascondi="vista" className="mt-8 max-w-sm lg:mt-10">
            <Bottone href={LINK_CONSULENZA} tono="scuro" onClick={perLaConsulenza}>
              {testoBottoneConsulenza(variante, t.bottone, BOTTONE_VARIANTE_B)}
            </Bottone>
          </div>
          {mostraLinkShop(INTERRUTTORI.linkShopDiProva) ? (
            <p className="mt-6">
              <a
                href={LINK_SHOP_DI_PROVA}
                className="inline-flex min-h-11 items-center text-base font-semibold text-white underline underline-offset-4 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t.linkShop}
              </a>
            </p>
          ) : null}
        </div>
      </main>
      <Footer />
      <BarraConsulenza provenienza="consulenza" />
      <CookieBanner />
    </div>
  );
}
