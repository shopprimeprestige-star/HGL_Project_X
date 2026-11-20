import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, ShieldCheck, Truck, RotateCcw, Check, Minus, Plus, ChevronRight, ShoppingBag } from "lucide-react";
import { CATEGORIES, PRODUCTS, formatPrice, getProduct } from "@/shop/catalog";
import { ShopVisual } from "@/shop/ShopVisual";
import { useCart } from "@/shop/CartContext";
import { toast } from "sonner";
import { traccia } from "@/landing/consulenza/eventi";
import { BoxProdottoGiusto } from "@/components/landing/consulenza/BoxProdottoGiusto";
import { PopupUscita } from "@/components/landing/consulenza/PopupUscita";
import { SITO } from "@/seo/regole";
import { emettiEvento } from "@/lib/tracciamento/api";
import { modalitaCatalogo, schedaProdotto } from "@/shop/cms/catalogo.functions";
import { modalitaCertaDelServer } from "@/shop/cms/modalita-certa.functions";
import { daPubblicoAProdotto, varianteDaOpzioni } from "@/shop/cms/adattatore";
import { cercaScheda, datiEventoCodice, datiEventoScheda, intestazioniScheda, primaVolta, senzaPrezzo, testataScheda, type Scheda } from "@/shop/cms/scheda";

/** Cosa ha deciso il caricamento (T20): la scheda e se l'indirizzo porta `?anteprima=`. Un guasto del database NON arriva qui: è un errore temporaneo; «non trovato» nemmeno: è `notFound()` (risposta 404). */
type Caricato = { scheda: Exclude<Scheda, { tipo: "temporaneo" | "non_trovato" }>; anteprima: boolean };

export const Route = createFileRoute("/shop/prodotto/$slug")({
  validateSearch: (raw: Record<string, unknown>): { anteprima?: string } => ({ anteprima: typeof raw.anteprima === "string" && raw.anteprima ? raw.anteprima.slice(0, 300) : undefined }),
  loaderDeps: ({ search }) => ({ anteprima: search.anteprima ?? "" }),
  loader: async ({ params, deps }): Promise<Caricato> => {
    const scheda = await cercaScheda(
      {
        modalita: () => modalitaCatalogo(),
        modalitaCerta: () => modalitaCertaDelServer(),
        scheda: (slug, chiave) => schedaProdotto({ data: { slug, chiave } }),
        nelCodice: (slug) => Boolean(getProduct(slug)),
      },
      params.slug,
      deps.anteprima,
    );
    // un guasto non è «non trovato»: errore temporaneo (la risposta non si ferma in nessuna memoria)
    if (scheda.tipo === "temporaneo") throw new Error("catalogo-temporaneamente-non-raggiungibile");
    // un indirizzo che non c'è risponde 404 (prima era una pagina 200 che diceva «non trovato»: per Google è un errore morbido)
    if (scheda.tipo === "non_trovato") throw notFound();
    return { scheda, anteprima: Boolean(deps.anteprima) };
  },
  // con il catalogo `codice` la testata resta quella di `shop.tsx`; con il CMS: titolo, descrizione, immagine, canonical e JSON-LD (non in anteprima)
  head: ({ loaderData, match }) => {
    if (match?.status === "notFound") {
      const nt = testataScheda(null, false, SITO);
      return { meta: nt.meta, links: nt.links, scripts: nt.scripts };
    }
    if (!loaderData || loaderData.scheda.tipo === "codice") return {};
    const t = testataScheda(loaderData.scheda.tipo === "cms" ? loaderData.scheda.prodotto : null, loaderData.anteprima, SITO);
    return { meta: t.meta, links: t.links, scripts: t.scripts };
  },
  //  Guasto (loader lanciato: `match.status` «error», nessun `loaderData`) → `no-store`; anteprima → `private, no-store`.
  headers: ({ loaderData, match }) => intestazioniScheda({ anteprima: Boolean(loaderData?.anteprima), errore: match?.status === "error" }),
  errorComponent: ErroreTemporaneo,
  notFoundComponent: NonTrovato,
  component: ProductDetail,
});

/** Come si vede un bottone spento (solo con il CMS: con `codice` la pagina resta com'era). */
const SPENTO = " disabled:cursor-not-allowed disabled:opacity-50";

function NonTrovato() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-20 text-center">
      <p className="text-white/60">Prodotto non trovato.</p>
      <Link to="/shop" className="mt-4 inline-block text-brand hover:underline">
        Torna al catalogo
      </Link>
    </div>
  );
}

function ErroreTemporaneo() {
  const router = useRouter();
  return (
    <div role="alert" className="rounded-2xl border border-white/10 bg-white/[0.03] py-20 text-center">
      <p className="text-white/70">Non riusciamo a mostrarti questo prodotto in questo momento.</p>
      <p className="mt-1 text-sm text-white/45">Non è sparito: riprova tra qualche istante.</p>
      <button onClick={() => router.invalidate()} className="mt-5 rounded-lg border border-brand bg-brand/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand/20">
        Riprova
      </button>
      <Link to="/shop" className="mt-4 block text-sm text-brand hover:underline">
        Torna al catalogo
      </Link>
    </div>
  );
}

//  `key={slug}`: passando da una scheda all'altra la scelta di variante e quantità riparte da zero.
function ProductDetail() {
  const { slug } = Route.useParams();
  return <SchedaVista key={slug} slug={slug} />;
}

function SchedaVista({ slug }: { slug: string }) {
  const { scheda, anteprima } = Route.useLoaderData();
  const cms = scheda.tipo === "cms" ? scheda.prodotto : null;
  const product = cms ? daPubblicoAProdotto(cms) : getProduct(slug);
  const navigate = useNavigate();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    product?.variants?.forEach((v) => (init[v.label] = v.options[0]));
    return init;
  });
  //  Con il CMS la riga è la VARIANTE: lo SKU di quella scelta (o `null`: combinazione che non esiste).
  const skuScelto = cms ? varianteDaOpzioni(cms, product?.variants?.length ? variant : {}) : null;
  const scelta = cms?.varianti.find((v) => v.sku === skuScelto) ?? null;
  const fuoriVendita = Boolean(cms && (anteprima || cms.anteprima)); // una bozza vista con la chiave non si compra
  //  Il prezzo che si vede: quello della variante scelta, altrimenti il «da» del prodotto. `null` = il server non lo manda (D39).
  const prezzoCent = cms ? (scelta ? scelta.prezzoCent : cms.prezzoDaCent) : null;
  const senzaCifra = Boolean(cms && (!cms.acquistabile || prezzoCent === null || senzaPrezzo(cms.nome, cms.slug)));

  //  Una scheda vista: solo un conteggio, con il nome pubblico del prodotto (non in anteprima).
  useEffect(() => {
    if (!product || anteprima) return;
    traccia("stock_vista_scheda", { prodotto: slug }, { dedupKey: `scheda:${slug}` });
  }, [slug, product, anteprima]);

  //  ViewContent: una volta per prodotto e sessione, mai in anteprima, mai per Invisible Derm.
  useEffect(() => {
    if (!product || anteprima || senzaCifra || (cms && cms.anteprima)) return;
    const dati = cms ? datiEventoScheda(cms, scelta?.sku ?? cms.varianti[0]?.sku ?? null) : datiEventoCodice(product);
    if (dati && primaVolta(window.sessionStorage, `hg_vc_${slug}`)) emettiEvento("ViewContent", dati);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta per prodotto: la variante scelta dopo non rifà l'evento
  }, [slug, anteprima]);

  if (!product) return <NonTrovato />;

  const category = CATEGORIES.find((c) => c.key === product.category);
  //  Il box «Non è il prodotto giusto per te?» e il pop-up stanno solo sulle protesi (con il CMS: dove il titolare ha acceso il box).
  const eProtesi = cms ? cms.boxConsulenza : product.category === "toupee";
  const related = cms ? [] : PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const prezzo = cms ? (prezzoCent ?? 0) / 100 : product.price;
  const esaurito = cms ? Boolean(scelta && !scelta.disponibile) : false;
  const nonAcquistabile = Boolean(cms && (fuoriVendita || senzaCifra || !scelta || esaurito));

  const addToCart = (go: boolean) => {
    if (cms) {
      if (nonAcquistabile || !scelta || scelta.prezzoCent === null) return;
      const foto = cms.media.find((m) => m.slot === "principale")?.src ?? null;
      add(product, qty, product.variants?.length ? variant : undefined, {
        sku: scelta.sku,
        snap: { nome: cms.nome, slug: cms.slug, prezzoCent: scelta.prezzoCent, foto, varianteNome: scelta.nome === scelta.sku ? null : scelta.nome },
      });
    } else {
      add(product, qty, product.variants?.length ? variant : undefined);
    }
    // lo stesso `event_id` va al browser e al server (lo fa `emettiEvento`); mai in anteprima
    const dati = cms ? datiEventoScheda(cms, scelta?.sku ?? null, qty) : datiEventoCodice(product, qty);
    if (dati && !anteprima) emettiEvento("AddToCart", dati);
    if (go) navigate({ to: "/shop/carrello" });
    else toast.success(`${product.name} × ${qty} aggiunto al carrello`);
  };

  return (
    <div className="space-y-12">
      {/* anteprima del CMS: la bozza vista con la chiave. Non si compra, non va a Google, non si traccia. */}
      {cms?.anteprima && (
        <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Anteprima: questa scheda non è ancora visibile al pubblico.</p>
          {cms.anteprima.nascosti.length > 0 && (
            <>
              <p className="mt-2 text-amber-100/80">Cosa i clienti non vedrebbero adesso:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-100/80">
                {cms.anteprima.nascosti.map((n) => (
                  <li key={`${n.blocco}-${n.motivo}`}>{n.motivo}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-white/45">
        <Link to="/shop" className="hover:text-white">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/70">{category?.label}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white/70">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* visual */}
        <div className="space-y-3">
          <ShopVisual product={product} className="aspect-square w-full" />
          {/* tre promesse del vecchio catalogo: con il CMS non si ripetono (ogni frase ha bisogno del dato vero del titolare) */}
          {!cms && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-brand" />
              <span className="text-[11px] text-white/60">Qualità premium</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <Truck className="mx-auto mb-1 h-5 w-5 text-brand" />
              <span className="text-[11px] text-white/60">Spedizione 24/48h</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <RotateCcw className="mx-auto mb-1 h-5 w-5 text-brand" />
              <span className="text-[11px] text-white/60">Reso 14 giorni</span>
            </div>
          </div>
          )}
        </div>

        {/* info */}
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-brand">{category?.label}</span>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {/* Stelle e numero di recensioni sono dati d'esempio: nelle protesi, dove c'è il box, si nascondono (i dati restano nel catalogo). */}
            {!eProtesi && product.reviews > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-0.5 text-amber-300">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4" fill={i < Math.round(product.rating) ? "currentColor" : "none"} strokeWidth={1.5} />
                  ))}
                </span>
                <span className="text-white/50">{product.rating} · {product.reviews} recensioni</span>
              </div>
            )}
          </div>

          {senzaCifra ? (
            <p className="text-white/70">Il costo lo vedi in consulenza.</p>
          ) : (
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold">{formatPrice(prezzo)}</span>
            {product.compareAt && (
              <>
                <span className="pb-1 text-lg text-white/40 line-through">{formatPrice(product.compareAt)}</span>
                <span className="mb-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  -{Math.round((1 - product.price / product.compareAt) * 100)}%
                </span>
              </>
            )}
          </div>
          )}

          <p className="text-white/70">{product.description}</p>

          {/* varianti */}
          {product.variants?.map((v) => (
            <div key={v.label} className="space-y-2">
              <span className="text-sm font-medium text-white/80">{v.label}</span>
              <div className="flex flex-wrap gap-2">
                {v.options.map((opt) => {
                  const active = variant[v.label] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setVariant((prev) => ({ ...prev, [v.label]: opt }))}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        active ? "border-brand bg-brand/15 text-white" : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
                      }`}
                    >
                      {active && <Check className="mr-1 inline h-3.5 w-3.5 text-brand" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Il blocco d'acquisto: la barra della consulenza non lo copre mai (si nasconde quando gli arriva sotto). */}
          {!senzaCifra && (
          <div data-barra-nascondi="fondo" className="space-y-5">
            {/* qty + add */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center rounded-lg border border-white/15 bg-white/5">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2.5 text-white/70 hover:text-white">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-medium">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="px-3 py-2.5 text-white/70 hover:text-white">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => addToCart(false)}
                disabled={nonAcquistabile}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand bg-brand/10 px-5 py-3 font-medium text-white transition hover:bg-brand/20${cms ? SPENTO : ""}`}
              >
                <ShoppingBag className="h-4 w-4" /> {esaurito ? "Esaurita" : "Aggiungi al carrello"}
              </button>
            </div>
            <button
              onClick={() => addToCart(true)}
              disabled={nonAcquistabile}
              className={`w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:brightness-110${cms ? SPENTO : ""}`}
            >
              Acquista ora
            </button>
            {cms && !scelta && !senzaCifra && <p className="text-xs text-white/50">Questa combinazione non è disponibile: scegline un'altra.</p>}
          </div>
          )}

          {!senzaCifra && (
          <p className="text-xs text-white/40">
            {(cms ? Boolean(scelta?.disponibile) : product.stock > 0) ? (
              <span className="text-emerald-300">● Disponibile</span>
            ) : (
              <span className="text-white/40">Esaurito</span>
            )}
            {!cms && " · Spedizione gratuita per ordini superiori a €59"}
          </p>
          )}

          {eProtesi && <BoxProdottoGiusto prodotto={product.name} />}

          {/* bullets (con il CMS: «cosa trovi nella confezione») */}
          {product.bullets.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <span className="mb-2 block text-sm font-medium text-white/80">{cms ? "Nella confezione" : "Caratteristiche"}</span>
            <ul className="space-y-2">
              {product.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-white/65">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" /> {b}
                </li>
              ))}
            </ul>
          </div>
          )}

          {/* specifiche tecniche */}
          {product.specs && product.specs.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-4 py-2.5 text-sm font-medium text-white/80">
                Specifiche tecniche
              </div>
              <dl className="divide-y divide-white/5">
                {product.specs.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-white/50">{s.label}</dt>
                    <dd className="text-right font-medium text-white/85">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* correlati */}
      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Ti potrebbe servire anche</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <Link
                key={p.id}
                to="/shop/prodotto/$slug"
                params={{ slug: p.slug }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-brand/60"
              >
                <ShopVisual product={p} className="aspect-[4/3] w-full" compact />
                <div className="p-3">
                  <span className="line-clamp-1 text-sm font-medium text-white transition group-hover:text-brand">{p.name}</span>
                  <span className="text-sm font-bold text-white/80">{formatPrice(p.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* con il CMS: «Ti serve anche», un solo prodotto, mai Invisible Derm e mai la sua cifra */}
      {cms?.correlato && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Ti serve anche</h2>
          <Link
            to="/shop/prodotto/$slug"
            params={{ slug: cms.correlato.slug }}
            className="group flex max-w-sm items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-brand/60"
          >
            {cms.correlato.foto && <img src={cms.correlato.foto.w480} alt="" className="h-20 w-20 rounded-xl object-cover" loading="lazy" />}
            <div>
              <span className="line-clamp-2 text-sm font-medium text-white transition group-hover:text-brand">{cms.correlato.nome}</span>
              {cms.correlato.prezzoDaCent !== null && !senzaPrezzo(cms.correlato.nome, cms.correlato.slug) && <span className="text-sm font-bold text-white/80">{formatPrice(cms.correlato.prezzoDaCent / 100)}</span>}
            </div>
          </Link>
        </section>
      )}

      {eProtesi && <PopupUscita prodotto={product.name} />}
    </div>
  );
}
