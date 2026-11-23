import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, Menu } from "lucide-react";
import { CartProvider, useCart } from "@/shop/CartContext";
import { getProduct } from "@/shop/catalog";
import { elencoCategorie, modalitaCatalogo, schedaProdotto } from "@/shop/cms/catalogo.functions";
import { collaudoDellaVisita } from "@/shop/cms/cassa-sito.functions";
import { CACHE_COLLAUDO } from "@/shop/cms/collaudo";
import { nomeProtesiPerBarra } from "@/shop/cms/guscio";
import type { CategoriaPubblica } from "@/shop/cms/modello";
import { GuscioShop, guscioNuovo } from "@/components/shop/guscio/GuscioShop";
import { TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import { BarraConsulenza } from "@/components/landing/consulenza/BarraConsulenza";
import { GestisciCookie } from "@/components/tracciamento/GestisciCookie";
import { Toaster } from "@/components/ui/sonner";
import logo from "@/assets/logo-hair-genius.png";

type Modalita = "codice" | "cms";

/** La modalità di QUESTA visita, nel browser: letta una volta (o arrivata con la pagina del server) e poi ferma. Un guasto di
 *  rete a metà visita non riporta lo shop su `codice` (catalogo vecchio, 404 sulle categorie, righe CMS nel carrello).
 *  Sul server resta `undefined`: lì si legge a ogni richiesta, e la variabile non è condivisa fra visitatori. */
let modalitaVisita: Modalita | undefined;

export const Route = createFileRoute("/shop")({
  //  La modalità del catalogo (`codice` o `cms`) si legge qui e scende a tutte le pagine dello shop nel contesto della rotta
  //  (`modalita`): le pagine figlie non la rileggono. Sul server a ogni richiesta; nel browser una volta per visita.
  //  Se la lettura non riesce, lo shop resta quello di oggi.
  beforeLoad: async () => {
    if (modalitaVisita) return { modalita: modalitaVisita };
    let modalita: Modalita;
    try {
      modalita = await modalitaCatalogo();
    } catch {
      modalita = "codice";
    }
    if (typeof window !== "undefined") modalitaVisita = modalita;
    //  Collaudo con chiave (T67): solo sul server (nel browser `headers` non conta). Senza collaudo il contesto è `{ modalita }`, come prima:
    //  nessuna chiave in più finisce nell'HTML.
    const collaudo = typeof window === "undefined" ? await collaudoDellaVisita().catch(() => false) : false;
    return collaudo ? { modalita, collaudo: true as const } : { modalita };
  },
  //  Con il collaudo l'HTML di TUTTE le pagine /shop* è privato e non si tiene da nessuna parte (una copia `cms` non deve finire in una
  //  cache condivisa). Senza collaudo non si dichiara niente: resta `no-cache, must-revalidate` della radice.
  headers: ({ matches }): Record<string, string> =>
    matches.some((m) => (m.context as { collaudo?: boolean } | undefined)?.collaudo === true) ? { "Cache-Control": CACHE_COLLAUDO } : {},
  //  Il guscio nuovo (D72) ha bisogno delle categorie per «Cura» e per la ricerca: si chiedono qui, SOLO con `cms` e sulle cinque pagine V1.
  //  Con `codice` (e per cassa, ordine, collaudo) non si chiama niente e il valore è `undefined`, come oggi che il layout non ha un loader.
  //  Un guasto non è mai un errore al pubblico: elenco vuoto e l'header non ha «Cura».
  //  ⚠️ I parametri sono annotati di proposito: un `context` dedotto dalla rotta rende circolare il tipo che `Route.useLoaderData()` legge dal `component`.
  loader: async ({ context, location }: { context: { modalita: Modalita }; location?: { pathname?: string } }) => {
    if (context.modalita !== "cms" || !guscioNuovo(location?.pathname)) return undefined;
    const elenco: unknown = await elencoCategorie().catch(() => null);
    return {
      categorie: Array.isArray(elenco) ? elenco.map(({ slug, nome, quanti }: CategoriaPubblica) => ({ slug, nome, quanti })) : [],
    };
  },
  //  `head` gira dopo `beforeLoad`: la modalità la trova nel contesto del match. Con il catalogo CMS la descrizione non promette
  //  niente (D38); senza contesto (lettura fallita) resta quella di oggi. Sulle cinque pagine V1 con `cms` titolo e descrizione sono del
  //  copy (D72). ⚠️ Il percorso si legge dalla FOGLIA delle `matches`: `match.pathname` di questo layout è sempre `/shop`. Se la foglia è il layout
  //  stesso (percorso sconosciuto) o mancano le `matches`, resta tutto com'è oggi.
  head: ({ match, matches }) => {
    const cms = (match?.context as { modalita?: Modalita } | undefined)?.modalita === "cms";
    const foglia = matches?.[matches.length - 1];
    const v1 = cms && foglia && foglia.routeId !== match?.routeId && guscioNuovo(foglia.pathname) ? foglia.pathname.toLowerCase().replace(/\/+$/, "") : null;
    //  shortcut: scheda e categoria non hanno un titolo qui (lo mettono le loro pagine): sotto, quello della home. Quando le pagine hanno il loro `head`, nessun cambio.
    const titolo = v1 === "/shop/carrello" ? TESTI_SHOP.meta.carrello.titolo : v1 === "/shop/cerca" ? TESTI_PROVVISORI.cerca.metaTitolo : TESTI_SHOP.meta.home.titolo;
    return {
      meta: [
        { title: v1 ? titolo : "Hair Genius Shop — Toupee e prodotti per la cura" },
        {
          name: "description",
          content: v1
            ? TESTI_SHOP.meta.home.descrizione
            : cms
              ? "Patch e prodotti per la cura, scelti in studio."
              : "Protesi lace e skin indistinguibili, shampoo, balsami, districanti, solventi e adesivi. Tutto per chi indossa un toupee.",
        },
      ],
    };
  },
  component: ShopLayout,
});

function CartButton() {
  const { count } = useCart();
  return (
    <Link
      to="/shop/carrello"
      className="relative flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-brand hover:bg-white/10"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Carrello</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

function Header() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const linkCls = (active: boolean) =>
    `text-sm transition ${active ? "text-white" : "text-white/60 hover:text-white"}`;
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/shop" className="flex items-center gap-2">
          <img src={logo} alt="Hair Genius" className="h-8 w-8 rounded-md object-contain" />
          <span className="text-sm font-semibold tracking-tight text-white">
            Hair Genius <span className="text-brand">Shop</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/shop" className={linkCls(path === "/shop")}>
            Catalogo
          </Link>
          <a href="/preventivo" className="text-sm text-white/60 transition hover:text-white">
            Preventivo su misura
          </a>
          <a href="/" className="text-sm text-white/60 transition hover:text-white">
            Analisi gratuita
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <CartButton />
        </div>
      </div>
    </header>
  );
}

function ShopFooter({ modalita }: { modalita: Modalita }) {
  const cms = modalita === "cms";
  //  Con il catalogo CMS niente «grado premium» (D38) e link più chiari (contrasto: white/60); con `codice` com'è oggi.
  const colore = cms ? "text-white/60" : "text-white/45";
  return (
    <footer className="bg-footer border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Hair Genius" className="h-9 w-9 rounded-md object-contain" />
          <p className="text-sm text-white/60">
            Hair Genius Labs · {cms ? "Patch e prodotti per la cura" : "Protesi e cura di grado premium"}
          </p>
          <div className={`flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs ${colore}`}>
            <a href="/privacy-policy" className="hover:text-white/80">Privacy</a>
            <a href="/termini-e-condizioni" className="hover:text-white/80">Termini</a>
            <a href="/cookie-policy" className="hover:text-white/80">Cookie</a>
            {/* Riapre la scelta dei cookie. `-my-1.5 py-1.5`: area da toccare più alta senza allungare la riga. */}
            <GestisciCookie className="-my-1.5 cursor-pointer py-1.5 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" />
            <Link to="/shop" className="hover:text-white/80">Catalogo</Link>
          </div>
          <p className="mt-2 text-[11px] text-white/30">
            © {new Date().getFullYear()} Hair Genius Labs SRLS
            {/* Con il catalogo CMS la soglia non c'è più (la cifra non è più vera): la frase si mostra solo con quello del codice. */}
            {!cms && " · Spedizione gratuita sopra €59"}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** La barra della consulenza: nella scheda di una protesi sa quale protesi si guarda. */
function BarraShop({ modalita }: { modalita: Modalita }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const slug = path.match(/^\/shop\/prodotto\/([^/]+)/)?.[1];
  let slugLetto: string | undefined;
  try {
    slugLetto = slug ? decodeURIComponent(slug) : undefined;
  } catch {
    //  Indirizzo rotto (es. %E0): niente protesi, e il negozio resta in piedi.
    slugLetto = undefined;
  }
  //  Catalogo CMS: la protesi si chiede al server dopo il montaggio (la barra comunque compare solo dopo); un guasto = nessun nome.
  const [nomeCms, setNomeCms] = useState<string | undefined>();
  useEffect(() => {
    setNomeCms(undefined);
    if (modalita !== "cms" || !slugLetto) return;
    let vivo = true;
    schedaProdotto({ data: { slug: slugLetto } })
      .then((r) => vivo && setNomeCms(nomeProtesiPerBarra(r.esito === "trovato" ? r.prodotto : null)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [modalita, slugLetto]);
  const prodotto = modalita !== "cms" && slugLetto ? getProduct(slugLetto) : undefined;
  return <BarraConsulenza provenienza="stock" prodotto={modalita === "cms" ? nomeCms : prodotto?.category === "toupee" ? prodotto.name : undefined} />;
}

/** Il guscio di oggi (testata, piè di pagina e barra di R2), com'è stato sempre: tutto con `codice`, e con `cms` per cassa, ordine, collaudo e percorsi sconosciuti. */
function GuscioDiOggi({ modalita }: { modalita: Modalita }) {
  return (
    <div className="bg-blueprint min-h-screen text-white">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <ShopFooter modalita={modalita} />
      {/* Dopo il piè di pagina: lo spazio che la barra riserva sta qui, sotto tutto. */}
      <BarraShop modalita={modalita} />
      <Toaster />
    </div>
  );
}

/** Il guscio nuovo (T93): le categorie vengono dal loader di questa rotta. */
function GuscioNuovo() {
  const dati = Route.useLoaderData();
  return (
    <GuscioShop categorie={dati?.categorie}>
      <Outlet />
    </GuscioShop>
  );
}

function ShopLayout() {
  const { modalita } = Route.useRouteContext();
  //  La pagina arrivata dal server non ripassa da `beforeLoad` nel browser: la sua modalità diventa quella della visita.
  if (typeof window !== "undefined") modalitaVisita ??= modalita;
  const pagina = useRouterState({ select: (s) => s.location.pathname });
  //  D72: il guscio nuovo vale solo con `cms` E sulle cinque pagine V1 (`guscioNuovo`); tutto il resto resta com'è oggi.
  //  `CartProvider` è la radice in entrambi i casi: passando da una pagina V1 alla cassa il carrello non si rimonta.
  return (
    <CartProvider>
      {modalita === "cms" && guscioNuovo(pagina) ? <GuscioNuovo /> : <GuscioDiOggi modalita={modalita} />}
    </CartProvider>
  );
}
