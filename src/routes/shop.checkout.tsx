import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lock, ArrowRight, ShoppingBag } from "lucide-react";
import { PRODUCTS, formatPrice } from "@/shop/catalog";
import { ShopVisual } from "@/shop/ShopVisual";
import { useCart } from "@/shop/CartContext";
import { modalitaCatalogo } from "@/shop/cms/catalogo.functions";
import { cassaDelSito } from "@/shop/cms/cassa-sito.functions";
import { CassaStripe } from "@/shop/cassa/CassaStripe";
import { cassaPerLoader } from "@/shop/cassa/cassa-client";
import { MSG_NON_VERIFICABILE, SPEDIZIONE_CMS_CENT, datiEventoRighe, itemsOrdine } from "@/shop/cms/cassa";
import { primaVolta } from "@/shop/cms/scheda";
import { useRivalidaCarrello } from "@/shop/useRivalidaCarrello";
import { emettiEvento } from "@/lib/tracciamento/api";
import { supabase } from "@/integrations/supabase/client";
import { MESSAGGIO_ERRORE_ORDINE, firmaOrdine, inviaOrdine, rigaOrdine, tentativoPer, type DatiOrdine, type Tentativo } from "@/shop/invio-ordine";

export const Route = createFileRoute("/shop/checkout")({
  //  Il catalogo del sito: se non risponde si pensa `codice`, cioè la cassa di oggi.
  //  La cassa nuova (Stripe) si chiede solo con il catalogo `cms`; un rifiuto o un timeout → la cassa di oggi (`cassaPerLoader`).
  loader: async () => {
    const modo = await modalitaCatalogo().catch(() => "codice" as const);
    return { modo, cassa: await cassaPerLoader(modo, () => cassaDelSito()) };
  },
  //  `?annullato=1`: il cliente è tornato da Stripe senza pagare.
  validateSearch: (s: Record<string, unknown>): { annullato?: 1 } => (s.annullato === "1" || s.annullato === 1 ? { annullato: 1 } : {}),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { cassa } = Route.useLoaderData();
  const { annullato } = Route.useSearch();
  return cassa === "stripe" ? <CassaStripe annullato={annullato === 1} /> : <CassaVecchia />;
}

const prezzoCodice = (id: string) => PRODUCTS.find((pr) => pr.id === id)?.price;

const SHIPPING_THRESHOLD = 59;
const SHIPPING_COST = 4.9;

interface Form {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  indirizzo: string;
  citta: string;
  cap: string;
  note: string;
}

const EMPTY: Form = { nome: "", cognome: "", email: "", telefono: "", indirizzo: "", citta: "", cap: "", note: "" };

function Field({
  label, value, onChange, type = "text", required = true, className = "",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm text-white/70">{label}{required && <span className="text-brand"> *</span>}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}

function CassaVecchia() {
  const { lines, subtotal, count, clear } = useCart();
  const { modo } = Route.useLoaderData();
  const { stato, avviso, controlla } = useRivalidaCarrello(modo);
  const cms = modo === "cms";
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  // Identificativi dell'ordine: nascono una volta per tentativo e si riusano nei nuovi invii (vedi invio-ordine.ts).
  const tentativo = useRef<Tentativo | null>(null);

  //  CMS (D37): tariffa fissa, nessuna soglia. `codice`: come oggi (gratis da 59 €).
  const shipping = cms ? SPEDIZIONE_CMS_CENT / 100 : subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;
  //  InitiateCheckout: una volta per carrello (stesse righe e quantità) e sessione, a controllo finito
  useEffect(() => {
    if (stato !== "ok" || lines.length === 0) return;
    const dati = datiEventoRighe(lines, prezzoCodice);
    const chiave = `hg_ic_${lines.map((l) => `${l.key}x${l.qty}`).join("+")}`;
    if (dati && primaVolta(window.sessionStorage, chiave)) emettiEvento("InitiateCheckout", dati);
  }, [stato, lines]);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  //  Righe del catalogo CMS rimaste con il catalogo `codice` (la pagina le toglie): non si ordinano mai, e il bottone aspetta.
  const righeCmsPendenti = !cms && lines.some((l) => l.sku);
  const items = lines.filter((l) => !l.sku).map((l) => {
    const p = PRODUCTS.find((pr) => pr.id === l.productId);
    return {
      product_id: l.productId,
      name: p?.name ?? l.productId,
      slug: p?.slug ?? null,
      qty: l.qty,
      unit_price: p?.price ?? 0,
      variant: l.variant ?? null,
    };
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrore(null);
    try {
      let dati: DatiOrdine = { form, items, subtotal, shipping, total };
      if (cms) {
        //  Catalogo CMS: i prezzi si ricalcolano dal SERVER, adesso. Quello che il browser ricorda nella riga serve solo a mostrare.
        const esito = await controlla();
        if (esito.stato !== "ok") {
          setErrore(MSG_NON_VERIFICABILE);
          return;
        }
        // qualcosa è cambiato (prodotto tolto, prezzo nuovo): il cliente rilegge il riepilogo e conferma di nuovo
        if (esito.rimosse > 0 || esito.prezziCambiati) return;
        const { items: righeServer, subtotaleCent } = itemsOrdine(esito.righe, esito.server);
        const speseCent = SPEDIZIONE_CMS_CENT;
        dati = { form, items: righeServer, subtotal: subtotaleCent / 100, shipping: speseCent / 100, total: (subtotaleCent + speseCent) / 100 };
      }
      tentativo.current = tentativoPer(tentativo.current, firmaOrdine(dati));
      const t = tentativo.current;
      const esito = await inviaOrdine(rigaOrdine(t, dati), async (riga) => await supabase.from("shop_orders").insert(riga as never));
      if (esito === "salvato") {
        setOrderId(t.orderRef);
        tentativo.current = null;
        clear();
      } else {
        setErrore(MESSAGGIO_ERRORE_ORDINE);
      }
    } catch {
      setErrore(MESSAGGIO_ERRORE_ORDINE);
    } finally {
      setSubmitting(false);
    }
  };

  // conferma ordine
  if (orderId) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-400" />
        <h1 className="text-2xl font-bold">Ordine confermato!</h1>
        <p className="mt-2 text-white/60">
          Grazie{form.nome ? `, ${form.nome}` : ""}. Il tuo ordine <span className="font-mono text-brand">{orderId}</span> è
          stato ricevuto. Ti invieremo la conferma e il tracking via email.
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-medium text-white transition hover:brightness-110"
        >
          Continua lo shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-white/30" />
        <h1 className="text-xl font-semibold">Carrello vuoto</h1>
        <p className="mt-2 text-sm text-white/55">Aggiungi prodotti prima di procedere al checkout.</p>
        <Link to="/shop" className="mt-6 inline-block rounded-lg bg-brand px-5 py-3 font-medium text-white hover:brightness-110">
          Vai al catalogo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>
      {avviso && (
        <p role="status" className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {avviso}
        </p>
      )}
      {stato === "non_verificabile" && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {MSG_NON_VERIFICABILE}
        </p>
      )}
      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* dati */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Contatti</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" value={form.nome} onChange={set("nome")} />
              <Field label="Cognome" value={form.cognome} onChange={set("cognome")} />
              <Field label="Email" type="email" value={form.email} onChange={set("email")} />
              <Field label="Telefono" type="tel" value={form.telefono} onChange={set("telefono")} />
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Indirizzo di spedizione</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Indirizzo" value={form.indirizzo} onChange={set("indirizzo")} className="sm:col-span-2" />
              <Field label="Città" value={form.citta} onChange={set("citta")} />
              <Field label="CAP" value={form.cap} onChange={set("cap")} />
              <Field label="Note (opzionale)" value={form.note} onChange={set("note")} required={false} className="sm:col-span-2" />
            </div>
          </section>
        </div>

        {/* riepilogo */}
        <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-semibold">Il tuo ordine</h2>
          <div className="space-y-3">
            {lines.map((l) => {
              //  riga CMS: si mostra da ciò che il server ha detto all'apertura; l'ordine si ricalcola comunque (`itemsOrdine`)
              if (l.sku) {
                if (!cms || !l.snap) return null;
                return (
                  <div key={l.key} className="flex items-center gap-3">
                    {l.snap.foto ? <img src={l.snap.foto.w480} alt="" className="h-12 w-12 rounded-xl object-cover" loading="lazy" /> : <div className="h-12 w-12 rounded-xl bg-white/5" />}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-white">{l.snap.nome}</p>
                      <p className="text-xs text-white/45">{l.snap.varianteNome ? `${l.snap.varianteNome} · ` : ""}Qtà {l.qty}</p>
                    </div>
                    <span className="text-sm font-medium">{formatPrice((l.snap.prezzoCent * l.qty) / 100)}</span>
                  </div>
                );
              }
              const p = PRODUCTS.find((pr) => pr.id === l.productId);
              if (!p) return null;
              return (
                <div key={l.key} className="flex items-center gap-3">
                  <ShopVisual product={p} className="h-12 w-12" compact />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-white">{p.name}</p>
                    <p className="text-xs text-white/45">Qtà {l.qty}</p>
                  </div>
                  <span className="text-sm font-medium">{formatPrice(p.price * l.qty)}</span>
                </div>
              );
            })}
          </div>
          <div className="my-4 border-t border-white/10" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/70"><span>Subtotale</span><span className="text-white">{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between text-white/70">
              <span>Spedizione</span>
              <span className={shipping === 0 ? "text-emerald-300" : "text-white"}>{shipping === 0 ? "Gratuita" : formatPrice(shipping)}</span>
            </div>
            <div className="my-2 border-t border-white/10" />
            <div className="flex justify-between text-base font-bold"><span>Totale</span><span>{formatPrice(total)}</span></div>
          </div>
          <button
            type="submit"
            disabled={submitting || (cms ? stato !== "ok" : righeCmsPendenti)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Lock className="h-4 w-4" /> {submitting ? "Elaborazione…" : "Conferma ordine"}
          </button>
          {errore && (
            <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errore}
            </p>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/40">
            <Lock className="h-3 w-3" /> Pagamento sicuro · Dati protetti
          </p>
        </div>
      </form>
    </div>
  );
}
