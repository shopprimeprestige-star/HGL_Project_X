/** ── LA CASSA NUOVA: IMPIANTO FUNZIONALE MINIMO (T58, D61) ───────────────────
 *  `shop.checkout.tsx` la monta solo con la cassa effettiva `stripe` (e catalogo `cms`). Tre blocchi (contatti, spedizione, fattura),
 *  le due caselle di legge, il riepilogo con la spedizione DAL SERVER e «Paga ora»: il browser manda SKU e quantità a
 *  `/api/public/shop-cassa`, riceve un indirizzo di Stripe Checkout e ci porta il cliente. I prezzi li fa il server (D50).
 *  Le decisioni stanno in `cassa-client.ts` (puro, provato); qui c'è solo lo schermo.
 *  ⚠️ La vetrina grafica è di V2, che sostituisce QUESTO file: stessi stili dello shop di oggi, niente loghi, niente promesse. */
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Lock, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/shop/catalog";
import { useCart } from "@/shop/CartContext";
import { useRivalidaCarrello } from "@/shop/useRivalidaCarrello";
import { MSG_NON_VERIFICABILE, datiEventoRighe } from "@/shop/cms/cassa";
import { primaVolta } from "@/shop/cms/scheda";
import { tariffaSpedizione } from "@/shop/cassa/tariffe.functions";
import type { SpedizionePubblica } from "@/shop/cassa/spedizione";
import { PROVINCE_IT } from "@/shop/cassa/fiscale";
import { leggiConsenso } from "@/lib/consenso";
import { queryPulita } from "@/lib/tracciamento/ammesse";
import * as tracciamento from "@/lib/tracciamento/api";
import {
  FRASE_CHIUSA,
  FRASE_RETE,
  MODULO_VUOTO,
  attesaPermesso,
  calcolaTotali,
  corpoCassa,
  eventoPagamento,
  eventoSpedizione,
  firmaCassa,
  leggiRisposta,
  righeDaCarrello,
  rinviaAStripe,
  separaCampi,
  tentativoCassa,
  type EsitoCassa,
  type ModuloCassa,
  type TentativoCassa,
} from "@/shop/cassa/cassa-client";

/** shortcut: la versione dei testi legali che il cliente accetta non esiste ancora (i Termini non hanno una data di versione): si usa la data
 *  di questa consegna; quando i Termini avranno una versione si legge da lì, in un posto solo. */
const VERSIONE_TESTI = "2026-11-22";
/** Il nome sta in una costante perché `api.ts` (R1) non esporta ancora `scaricaEventi`: se un giorno lo esporta, il rinvio lo aspetta da solo. */
const NOME_SCARICA = "scaricaEventi";

type Tariffa = SpedizionePubblica | "guasto" | null;

const CLASSE_CAMPO =
  "min-h-12 w-full rounded-lg border bg-white/5 px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

/** Un campo con l'etichetta sempre visibile e l'errore accanto (`role="alert"`, collegato al campo). */
function Campo({
  nome,
  etichetta,
  valore,
  onChange,
  errore,
  tipo = "text",
  obbligatorio = true,
  autoComplete,
  inputMode,
  className = "",
  figli,
}: {
  nome: string;
  etichetta: string;
  valore: string;
  onChange: (v: string) => void;
  errore?: string;
  tipo?: string;
  obbligatorio?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  className?: string;
  figli?: React.ReactNode;
}) {
  const id = `cassa-${nome}`;
  const idErrore = `${id}-errore`;
  const comune = {
    id,
    name: nome,
    value: valore,
    required: obbligatorio,
    autoComplete,
    "aria-invalid": errore ? true : undefined,
    "aria-describedby": errore ? idErrore : undefined,
    className: `${CLASSE_CAMPO} ${errore ? "border-red-400" : "border-white/15"}`,
  };
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm text-white/70">
        {etichetta}
        {obbligatorio && <span className="text-brand"> *</span>}
      </label>
      {figli ? (
        <select {...comune} onChange={(e) => onChange(e.target.value)}>
          {figli}
        </select>
      ) : (
        <input
          {...comune}
          type={tipo}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {errore && (
        <p id={idErrore} role="alert" className="mt-1 text-sm text-red-300">
          {errore}
        </p>
      )}
    </div>
  );
}

/** Una casella di legge: non pre-spuntata, con il collegamento al testo. */
function CasellaLegge({
  nome,
  valore,
  onChange,
  errore,
  children,
}: {
  nome: string;
  valore: boolean;
  onChange: (v: boolean) => void;
  errore?: string;
  children: React.ReactNode;
}) {
  const id = `cassa-${nome}`;
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 items-start gap-3 text-sm text-white/80">
        <input
          id={id}
          name={nome}
          type="checkbox"
          checked={valore}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={errore ? true : undefined}
          aria-describedby={errore ? `${id}-errore` : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand,#3b82f6)]"
        />
        <span>{children}</span>
      </label>
      {errore && (
        <p id={`${id}-errore`} role="alert" className="mt-1 text-sm text-red-300">
          {errore}
        </p>
      )}
    </div>
  );
}

export function CassaStripe({ annullato = false }: { annullato?: boolean }) {
  const { lines, count } = useCart();
  const { stato, avviso, controlla } = useRivalidaCarrello("cms");
  const [form, setForm] = useState<ModuloCassa>(MODULO_VUOTO);
  const [tariffa, setTariffa] = useState<Tariffa>(null);
  const [occupato, setOccupato] = useState(false);
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [generali, setGenerali] = useState<string[]>([]);
  const [righeNo, setRigheNo] = useState<Record<string, string>>({});
  const [chiusa, setChiusa] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  /** I totali che il server ha detto dopo un `prezzi_cambiati`: valgono finché il riepilogo non li raggiunge. */
  const [dalServer, setDalServer] = useState<{ totaleCent: number; spedizioneCent: number } | null>(
    null,
  );
  const tentativo = useRef<TentativoCassa | null>(null);
  const permesso = useRef<{ token: string; emessoIl: number } | null>(null);
  const inCorso = useRef(false);
  const set =
    <K extends keyof ModuloCassa>(k: K) =>
    (v: ModuloCassa[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  /* ── la tariffa di spedizione: la stessa funzione del carrello, dal server ── */
  useEffect(() => {
    let vivo = true;
    tariffaSpedizione()
      .then((t) => vivo && setTariffa(t))
      .catch(() => vivo && setTariffa("guasto"));
    return () => {
      vivo = false;
    };
  }, []);

  /* ── il permesso: lo si prende subito, così i 3 secondi minimi passano mentre il cliente compila ── */
  const prendiPermesso = async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/public/shop-cassa-permesso", {
        method: "GET",
        cache: "no-store",
      });
      const j: unknown = await r.json();
      const token =
        typeof j === "object" && j !== null ? (j as { permesso?: unknown }).permesso : null;
      if (!r.ok || typeof token !== "string" || token === "") return false;
      permesso.current = { token, emessoIl: Date.now() };
      return true;
    } catch {
      return false;
    }
  };
  useEffect(() => {
    if (lines.length > 0) void prendiPermesso();
  }, [lines.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── il ritorno dalla pagina di Stripe con «indietro»: il pulsante torna libero ── */
  useEffect(() => {
    const torna = (e: PageTransitionEvent) => {
      if (e.persisted) {
        inCorso.current = false;
        setOccupato(false);
      }
    };
    window.addEventListener("pageshow", torna);
    return () => window.removeEventListener("pageshow", torna);
  }, []);

  /* ── eventi: InitiateCheckout (come la cassa di oggi) e AddShippingInfo (una volta per carrello e sessione, a indirizzo completo) ── */
  useEffect(() => {
    if (stato !== "ok" || lines.length === 0) return;
    const dati = datiEventoRighe(lines, () => undefined);
    const chiave = `hg_ic_${lines.map((l) => `${l.key}x${l.qty}`).join("+")}`;
    if (dati && primaVolta(window.sessionStorage, chiave))
      tracciamento.emettiEvento("InitiateCheckout", dati);
  }, [stato, lines]);
  useEffect(() => {
    if (stato !== "ok" || lines.length === 0) return;
    // un attimo dopo l'ultimo tasto: non a metà dell'ultimo campo
    const t = setTimeout(() => {
      eventoSpedizione(
        { emetti: tracciamento.emettiEvento, archivio: window.sessionStorage },
        form,
        lines,
      );
    }, 800);
    return () => clearTimeout(t);
  }, [stato, lines, form]);

  /* ── i totali ── */
  const righeCms = lines.filter((l) => l.sku && l.snap);
  const subtotaleCent = righeCms.reduce((s, l) => s + (l.snap?.prezzoCent ?? 0) * l.qty, 0);
  const spedizione = tariffa && tariffa !== "guasto" ? tariffa : null;
  const calcolati = calcolaTotali(subtotaleCent, spedizione);
  useEffect(() => {
    if (dalServer && calcolati && calcolati.totaleCent === dalServer.totaleCent) setDalServer(null);
  }, [dalServer, calcolati?.totaleCent]); // eslint-disable-line react-hooks/exhaustive-deps
  const spedizioneCent = dalServer ? dalServer.spedizioneCent : (calcolati?.spedizioneCent ?? null);
  const totaleCent = dalServer ? dalServer.totaleCent : (calcolati?.totaleCent ?? null);
  const tariffaGuasta = tariffa === "guasto";
  const negozioChiuso =
    chiusa || (tariffa !== null && tariffa !== "guasto" && tariffa.stato === "assente");

  const mostra = (e: Extract<EsitoCassa, { tipo: "campi" }>) => {
    const { perCampo, generali: g } = separaCampi(e.campi);
    setErrori(perCampo);
    setGenerali(g.length || Object.keys(perCampo).length ? g : [e.frase]);
    const primo = Object.keys(perCampo)[0];
    if (primo) setTimeout(() => document.getElementById(`cassa-${primo}`)?.focus(), 0);
  };

  const paga = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inCorso.current) return;
    inCorso.current = true;
    setOccupato(true);
    setErrori({});
    setGenerali([]);
    setRigheNo({});
    setNota(null);
    let rinviato = false;
    try {
      // AddPaymentInfo alla pressione, prima di tutto il resto (il consenso lo guarda `emettiEvento`)
      eventoPagamento({ emetti: tracciamento.emettiEvento }, lines);
      // i prezzi si ricalcolano dal SERVER, adesso; se qualcosa è cambiato il cliente rilegge il riepilogo e conferma di nuovo
      const esito = await controlla();
      if (esito.stato !== "ok") {
        setGenerali([MSG_NON_VERIFICABILE]);
        return;
      }
      if (esito.rimosse > 0 || esito.prezziCambiati) return;
      const sub = esito.righe.reduce((s, l) => s + (l.snap?.prezzoCent ?? 0) * l.qty, 0);
      const tot = calcolaTotali(sub, spedizione);
      if (!tot) {
        setChiusa(true);
        return;
      }
      // il permesso deve avere almeno 3 secondi (lo legge il server dal token) e meno di 30 minuti
      let attesa = attesaPermesso(permesso.current?.emessoIl ?? null, Date.now());
      if (attesa === "rinnova") {
        if (!(await prendiPermesso())) {
          setGenerali([FRASE_RETE]);
          return;
        }
        attesa = attesaPermesso(permesso.current?.emessoIl ?? null, Date.now());
      }
      if (typeof attesa === "number" && attesa > 0) await new Promise((r) => setTimeout(r, attesa));
      const token = permesso.current?.token ?? "";
      const totaleAtteso = dalServer ? dalServer.totaleCent : tot.totaleCent;
      const attribuzione = Object.fromEntries(
        new URLSearchParams(queryPulita(window.location.search)),
      );
      const dati = {
        modulo: form,
        righe: righeDaCarrello(esito.righe),
        totaleAttesoCent: totaleAtteso,
        permesso: token,
        consensoMarketing: leggiConsenso(window.localStorage).marketing,
        attribuzione,
        versione: VERSIONE_TESTI,
      };
      // lo stesso contenuto riusa lo stesso tentativo; un dato cambiato ne crea uno nuovo
      tentativo.current = tentativoCassa(
        tentativo.current,
        firmaCassa(corpoCassa({ ...dati, tentativo: "" })),
      );
      const corpo = corpoCassa({ ...dati, tentativo: tentativo.current.id });
      let r: EsitoCassa;
      try {
        const ris = await fetch("/api/public/shop-cassa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        r = leggiRisposta(ris.status, await ris.json().catch(() => null));
      } catch {
        r = { tipo: "errore", frase: FRASE_RETE, nuovoTentativo: false };
      }
      switch (r.tipo) {
        case "vai": {
          rinviato = true;
          const scarica = (tracciamento as unknown as Record<string, unknown>)[NOME_SCARICA];
          await rinviaAStripe(r.url, {
            scarica:
              typeof scarica === "function"
                ? () => (scarica as () => Promise<unknown>)()
                : undefined,
            attendi: (ms) => new Promise((ok) => setTimeout(ok, ms)),
            naviga: (u) => window.location.assign(u),
          });
          return;
        }
        case "campi":
          mostra(r);
          return;
        case "prezzi":
          // i totali nuovi si vedono e il cliente conferma di nuovo: nessun secondo invio da solo
          setDalServer({ totaleCent: r.totaleCent, spedizioneCent: r.spedizioneCent });
          setNota(r.frase);
          void controlla();
          return;
        case "righe":
          setRigheNo(Object.fromEntries(r.righe.map((x) => [x.sku, x.frase])));
          setGenerali([r.frase]);
          return;
        case "chiusa":
          setChiusa(true);
          return;
        case "permesso":
          permesso.current = null;
          void prendiPermesso();
          setGenerali([r.frase]);
          return;
        case "errore":
          if (r.nuovoTentativo) tentativo.current = null;
          setGenerali([r.frase]);
          return;
      }
    } catch {
      setGenerali([FRASE_RETE]);
    } finally {
      // dopo il rinvio la pagina se ne va: il pulsante resta occupato (si libera col ritorno da Stripe, `pageshow`)
      if (!rinviato) {
        inCorso.current = false;
        setOccupato(false);
      }
    }
  };

  if (count === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-white/30" />
        <h1 className="text-xl font-semibold">Carrello vuoto</h1>
        <p className="mt-2 text-sm text-white/55">
          Aggiungi prodotti prima di procedere al checkout.
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-block rounded-lg bg-brand px-5 py-3 font-medium text-white hover:brightness-110"
        >
          Vai al catalogo
        </Link>
      </div>
    );
  }

  const euro = (cent: number) => formatPrice(cent / 100);
  const fattura = form.vuoleFattura;
  const azienda = form.tipo === "azienda";
  const pronto = stato === "ok" && totaleCent !== null && !negozioChiuso && !tariffaGuasta;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>
      {annullato && (
        <p
          role="status"
          className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          Pagamento annullato, il carrello è ancora qui.
        </p>
      )}
      {avviso && (
        <p
          role="status"
          className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          {avviso}
        </p>
      )}
      {stato === "non_verificabile" && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {MSG_NON_VERIFICABILE}
        </p>
      )}
      {negozioChiuso && (
        <p
          role="status"
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80"
        >
          {FRASE_CHIUSA}
        </p>
      )}
      {tariffaGuasta && (
        <p
          role="status"
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80"
        >
          Non riusciamo a leggere la spedizione in questo momento: ricarica la pagina tra un attimo.
        </p>
      )}
      <form onSubmit={paga} noValidate className="relative grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Contatti</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                nome="nome"
                etichetta="Nome"
                valore={form.nome}
                onChange={set("nome")}
                errore={errori.nome}
                autoComplete="given-name"
              />
              <Campo
                nome="cognome"
                etichetta="Cognome"
                valore={form.cognome}
                onChange={set("cognome")}
                errore={errori.cognome}
                autoComplete="family-name"
              />
              <Campo
                nome="email"
                etichetta="Email"
                tipo="email"
                inputMode="email"
                valore={form.email}
                onChange={set("email")}
                errore={errori.email}
                autoComplete="email"
              />
              <Campo
                nome="telefono"
                etichetta="Telefono"
                tipo="tel"
                inputMode="tel"
                valore={form.telefono}
                onChange={set("telefono")}
                errore={errori.telefono}
                autoComplete="tel"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Indirizzo di spedizione</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                nome="indirizzo"
                etichetta="Indirizzo e numero civico"
                valore={form.indirizzo}
                onChange={set("indirizzo")}
                errore={errori.indirizzo}
                autoComplete="street-address"
                className="sm:col-span-2"
              />
              <Campo
                nome="cap"
                etichetta="CAP"
                inputMode="numeric"
                valore={form.cap}
                onChange={set("cap")}
                errore={errori.cap}
                autoComplete="postal-code"
              />
              <Campo
                nome="citta"
                etichetta="Città"
                valore={form.citta}
                onChange={set("citta")}
                errore={errori.citta}
                autoComplete="address-level2"
              />
              <Campo
                nome="provincia"
                etichetta="Provincia"
                valore={form.provincia}
                onChange={set("provincia")}
                errore={errori.provincia}
                autoComplete="address-level1"
                figli={
                  <>
                    <option value="">Scegli la sigla</option>
                    {PROVINCE_IT.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </>
                }
              />
              <p className="self-end pb-3 text-sm text-white/60">Spediamo in Italia.</p>
              <Campo
                nome="note"
                etichetta="Note per il corriere (opzionale)"
                valore={form.note}
                onChange={set("note")}
                errore={errori.note}
                obbligatorio={false}
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <label
              htmlFor="cassa-vuoleFattura"
              className="flex min-h-11 items-center gap-3 font-semibold"
            >
              <input
                id="cassa-vuoleFattura"
                name="vuoleFattura"
                type="checkbox"
                checked={fattura}
                onChange={(e) => set("vuoleFattura")(e.target.checked)}
                className="h-5 w-5 accent-[var(--brand,#3b82f6)]"
              />
              Mi serve la fattura
            </label>
            {fattura && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Campo
                  nome="tipo"
                  etichetta="La fattura è per"
                  valore={form.tipo}
                  onChange={(v) => set("tipo")(v === "azienda" ? "azienda" : "privato")}
                  errore={errori.tipo}
                  figli={
                    <>
                      <option value="privato">Un privato</option>
                      <option value="azienda">Un'azienda</option>
                    </>
                  }
                />
                <Campo
                  nome="denominazione"
                  etichetta={azienda ? "Ragione sociale" : "Nome e cognome"}
                  valore={form.denominazione}
                  onChange={set("denominazione")}
                  errore={errori.denominazione}
                />
                {azienda ? (
                  <>
                    <Campo
                      nome="piva"
                      etichetta="Partita IVA"
                      inputMode="numeric"
                      valore={form.piva}
                      onChange={set("piva")}
                      errore={errori.piva}
                    />
                    <Campo
                      nome="sdi"
                      etichetta="Codice SDI (opzionale)"
                      valore={form.sdi}
                      onChange={set("sdi")}
                      errore={errori.sdi}
                      obbligatorio={false}
                    />
                    <Campo
                      nome="pec"
                      etichetta="PEC (opzionale)"
                      tipo="email"
                      inputMode="email"
                      valore={form.pec}
                      onChange={set("pec")}
                      errore={errori.pec}
                      obbligatorio={false}
                    />
                  </>
                ) : (
                  <Campo
                    nome="cf"
                    etichetta="Codice fiscale"
                    valore={form.cf}
                    onChange={set("cf")}
                    errore={errori.cf}
                  />
                )}
              </div>
            )}
          </section>

          <section className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <CasellaLegge
              nome="termini"
              valore={form.termini}
              onChange={set("termini")}
              errore={errori.termini}
            >
              Ho letto e accetto i{" "}
              <a
                href="/termini-e-condizioni"
                target="_blank"
                rel="noopener"
                className="underline underline-offset-2"
              >
                termini e condizioni
              </a>{" "}
              di vendita.
            </CasellaLegge>
            <CasellaLegge
              nome="privacy"
              valore={form.privacy}
              onChange={set("privacy")}
              errore={errori.privacy}
            >
              Ho letto l'
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener"
                className="underline underline-offset-2"
              >
                informativa sulla privacy
              </a>
              .
            </CasellaLegge>
          </section>
        </div>

        {/* la trappola: un cliente non la vede e non ci arriva con la tastiera; un programma la riempie */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden"
        >
          <label>
            Sito web{" "}
            <input
              name="sito_web"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.sito_web}
              onChange={(e) => set("sito_web")(e.target.value)}
            />
          </label>
        </div>

        {/* riepilogo */}
        <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-semibold">Il tuo ordine</h2>
          <div className="space-y-3">
            {righeCms.map((l) => (
              <div key={l.key}>
                <div className="flex items-center gap-3">
                  {l.snap?.foto ? (
                    <img
                      src={l.snap.foto.w480}
                      alt=""
                      className="h-12 w-12 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-white/5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-white">{l.snap?.nome}</p>
                    <p className="text-xs text-white/45">
                      {l.snap?.varianteNome ? `${l.snap.varianteNome} · ` : ""}Qtà {l.qty}
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    {euro((l.snap?.prezzoCent ?? 0) * l.qty)}
                  </span>
                </div>
                {l.sku && righeNo[l.sku] && (
                  <p role="alert" className="mt-1 text-sm text-red-300">
                    {righeNo[l.sku]}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="my-4 border-t border-white/10" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/70">
              <span>Subtotale</span>
              <span className="text-white">{euro(subtotaleCent)}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Spedizione</span>
              <span className={spedizioneCent === 0 ? "text-emerald-300" : "text-white"}>
                {spedizioneCent === null
                  ? "—"
                  : spedizioneCent === 0
                    ? "Gratuita"
                    : euro(spedizioneCent)}
              </span>
            </div>
            {spedizione &&
              spedizione.stato === "ok" &&
              (spedizione.corriere || spedizione.frase) && (
                <p className="text-xs text-white/50">
                  {[spedizione.corriere, spedizione.frase].filter(Boolean).join(" · ")}
                </p>
              )}
            <div className="my-2 border-t border-white/10" />
            <div className="flex justify-between text-base font-bold">
              <span>Totale</span>
              <span>{totaleCent === null ? "—" : euro(totaleCent)}</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={occupato || !pronto}
            aria-busy={occupato}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            {occupato
              ? "Ti portiamo alla pagina di pagamento…"
              : totaleCent === null
                ? "Paga ora"
                : `Paga ora · ${euro(totaleCent)}`}
          </button>
          {nota && (
            <p
              role="status"
              className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
            >
              {nota}
            </p>
          )}
          {generali.length > 0 && (
            <div
              role="alert"
              className="mt-3 space-y-1 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {generali.map((g) => (
                <p key={g}>{g}</p>
              ))}
            </div>
          )}
          <p className="mt-3 text-center text-xs text-white/50">
            Ti portiamo alla pagina di pagamento di Stripe: noi non vediamo i dati della carta.
          </p>
        </div>
      </form>
    </div>
  );
}
