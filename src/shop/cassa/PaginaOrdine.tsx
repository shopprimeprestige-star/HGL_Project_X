/** ── LA PAGINA ORDINE (impianto minimo) ─────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T60 (PIANO-R2 §3.3, D14, D48, D63, D64, D66; SPEC §12.4.3). La vetrina grafica è di V2 e sostituisce
 *  `VistaOrdine`: il resto (lettura, ricontrollo, riprova) resta.
 *  ⚠️ La pagina porta la chiave `t` dell'ordine nell'indirizzo. La chiave si legge dall'indirizzo nel browser, va solo nel corpo della
 *  chiamata al server, e non finisce mai in un log, nel titolo, in `localStorage` né in un collegamento.
 *  · Si legge `ordinePubblico` SUL CLIENT; il disegno del server è sempre «carico» (nessun dato dell'ordine nell'HTML).
 *  · Ricontrollo: ogni 5 s, per al massimo 2 minuti dall'apertura, solo in `verifica` (o finché non c'è una risposta valida) e a scheda visibile.
 *    Poi si ferma e compare «Aggiorna», che fa UNA lettura sola. Il limite del server è di 120 letture/ora per indirizzo: un'apertura ne costa 25.
 *  · Mai «pagato» da solo: i titoli sono le frasi del server. In `verifica` il numero d'ordine non c'è (`ref` è `null`).
 *  · «Serve aiuto?» solo con il testo `assistenza` confermato dal titolare (D63): nessuna frase d'assistenza è scritta qui. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, PackageSearch, XCircle } from "lucide-react";
import { useCart } from "@/shop/CartContext";
import { emettiSoloContatore } from "@/lib/tracciamento/api";
import { ordinePubblico } from "@/shop/cassa/ordine-pubblico.functions";
import type { OrdinePubblico, RispostaOrdinePubblica } from "@/shop/cassa/ordine-pubblico.server";
import type { TestiConfermati } from "@/shop/cms/testi-confermati";

/* ══ LE REGOLE NEL TEMPO (senza schermo, provate con un orologio finto) ═════ */

export const RITMO_MS = 5000;
export const FINESTRA_MS = 120000;
/** La cassa rifiuta un permesso più giovane di 3 s (`ETA_MINIMA_MS` di `permesso-cassa.ts`); qui un margine in più. */
const ATTESA_PERMESSO_MS = 3200;
/** Il permesso dura 30 min: oltre questa età se ne chiede uno nuovo. */
const ETA_MASSIMA_PERMESSO_MS = 25 * 60_000;
const ATTESA_RIPROVA_IN_CORSO_MS = 2000;
const TENTATIVI_RIPROVA_IN_CORSO = 5;
const MAX_FRASE = 300;

export type StatoPagina =
  | { tipo: "carico" }
  | { tipo: "assente" }
  | { tipo: "ordine"; ordine: OrdinePubblico; testi: TestiConfermati; finestraFinita: boolean };

/** La chiave `t` dall'indirizzo, com'è (testo: una chiave di sole cifre resta testo). Vuota o assente = `null`. */
export function leggiChiave(ricerca: string | null | undefined): string | null {
  const t = new URLSearchParams(typeof ricerca === "string" ? ricerca : "").get("t");
  return t ? t : null;
}

/** Il carrello si svuota solo quando un pagamento è arrivato: in `verifica`, a pagamento non riuscito o scaduto e ad ordine annullato serve ancora
 *  (per «Riprova il pagamento» e per tornare alla cassa se i prezzi sono cambiati). */
export function svuotaCarrello(fase: string): boolean {
  return ["pagato", "in_preparazione", "spedito", "consegnato", "rimborsato"].includes(fase);
}

export interface PorteControllo {
  leggi: () => Promise<RispostaOrdinePubblica>;
  adesso: () => number;
  programma: (fn: () => void, ms: number) => unknown;
  annulla: (id: unknown) => void;
  visibile: () => boolean;
  cambio: (stato: StatoPagina) => void;
}

/** Legge l'ordine e lo ricontrolla finché serve. `avvia()` = la prima lettura e il ciclo; `aggiorna()` = UNA lettura, il ciclo non riparte. */
export function creaControllo(p: PorteControllo) {
  let attivo = true;
  let inizio = 0;
  let timer: unknown = null;
  let inLettura = false;
  let ultimo: Extract<RispostaOrdinePubblica, { ok: true }> | null = null;
  let rifiutata = false; // almeno un rifiuto e nessuna risposta valida
  let finita = false;

  const emetti = () => {
    if (!attivo) return;
    if (ultimo)
      p.cambio({
        tipo: "ordine",
        ordine: ultimo.ordine,
        testi: ultimo.testi,
        finestraFinita: finita,
      });
    else p.cambio(finita && rifiutata ? { tipo: "assente" } : { tipo: "carico" });
  };

  /** Una lettura. Un rifiuto o un guasto non cancella un ordine già visto. Torna `false` se ce n'era già una in corso. */
  async function leggi(): Promise<boolean> {
    if (inLettura) return false;
    inLettura = true;
    try {
      const r = await p.leggi().catch((): RispostaOrdinePubblica => ({ ok: false }));
      if (!attivo) return true;
      if (r && r.ok === true && r.ordine) ultimo = r;
      else if (!ultimo) rifiutata = true;
    } finally {
      inLettura = false;
    }
    emetti();
    return true;
  }

  const serveAncora = () => !ultimo || ultimo.ordine.fase === "verifica";

  async function giro() {
    timer = null;
    if (!attivo) return;
    if (p.visibile()) await leggi();
    if (!attivo) return;
    if (p.adesso() - inizio >= FINESTRA_MS) {
      finita = true;
      emetti();
      return;
    }
    if (serveAncora()) timer = p.programma(() => void giro(), RITMO_MS);
  }

  return {
    async avvia() {
      inizio = p.adesso();
      emetti();
      await leggi();
      if (attivo && serveAncora()) timer = p.programma(() => void giro(), RITMO_MS);
    },
    async aggiorna() {
      await leggi();
    },
    ferma() {
      attivo = false;
      if (timer !== null) p.annulla(timer);
      timer = null;
    },
  };
}

/* ══ «RIPROVA IL PAGAMENTO» (D66) ═══════════════════════════════════════════ */

export type StatoRiprova =
  | { tipo: "fermo" }
  | { tipo: "in_corso" }
  | { tipo: "prezzi"; frase: string }
  | { tipo: "errore"; frase: string };

export type EsitoRiprova =
  | { tipo: "vai" }
  | { tipo: "pagato" }
  | { tipo: "prezzi"; frase: string }
  | { tipo: "errore"; frase: string };

export interface PorteRiprova {
  ref: string;
  t: string;
  /** Il permesso della cassa (`rinnova` = uno nuovo, a prescindere da quello in memoria). `presoA` = quando è arrivato. */
  permesso: (rinnova: boolean) => Promise<{ valore: string; presoA: number } | null>;
  invia: (corpo: Record<string, unknown>) => Promise<{ stato: number; corpo: unknown } | null>;
  adesso: () => number;
  attendi: (ms: number) => Promise<void>;
  vai: (url: string) => void;
}

/** Se non si riesce a dire altro (rete, 404 uguale per tutti, corpo che non è un oggetto). */
const FRASE_GUASTO = "Non siamo riusciti ad aprire il pagamento: riprova tra poco.";
const oggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const fraseDi = (corpo: unknown): string =>
  oggetto(corpo) && typeof corpo.frase === "string" && corpo.frase.trim()
    ? corpo.frase.trim().slice(0, MAX_FRASE)
    : FRASE_GUASTO;

/** La sequenza lato cliente: un permesso (vecchio di almeno 3 s), l'invio, e il rinvio a Stripe solo con un indirizzo `https://`. */
export async function riprovaOrdine(p: PorteRiprova): Promise<EsitoRiprova> {
  let rinnova = false;
  let in_corso = 0;
  for (let giro = 0; giro < 12; giro++) {
    const permesso = await p.permesso(rinnova).catch(() => null);
    if (!permesso) return { tipo: "errore", frase: FRASE_GUASTO };
    const resta = ATTESA_PERMESSO_MS - (p.adesso() - permesso.presoA);
    if (resta > 0) await p.attendi(resta);
    const r = await p
      .invia({ azione: "riprova", ref: p.ref, t: p.t, permesso: permesso.valore })
      .catch(() => null);
    if (!r) return { tipo: "errore", frase: FRASE_GUASTO };
    const corpo = r.corpo;
    if (oggetto(corpo) && corpo.ok === true) {
      if (typeof corpo.url === "string" && corpo.url.startsWith("https://")) {
        p.vai(corpo.url);
        return { tipo: "vai" };
      }
      return { tipo: "errore", frase: FRASE_GUASTO };
    }
    const motivo = oggetto(corpo) && typeof corpo.motivo === "string" ? corpo.motivo : "";
    if (motivo === "riprova_in_corso" && ++in_corso < TENTATIVI_RIPROVA_IN_CORSO) {
      await p.attendi(ATTESA_RIPROVA_IN_CORSO_MS);
      rinnova = false;
      continue;
    }
    if (motivo === "permesso" && !rinnova) {
      rinnova = true;
      continue;
    }
    if (motivo === "prezzi_cambiati") return { tipo: "prezzi", frase: fraseDi(corpo) };
    if (motivo === "gia_pagato") return { tipo: "pagato" };
    return { tipo: "errore", frase: fraseDi(corpo) };
  }
  return { tipo: "errore", frase: FRASE_GUASTO };
}

/* ══ IL DISEGNO ═════════════════════════════════════════════════════════════ */

const euro = (cent: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cent / 100);
const data = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("it-IT", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Rome",
      }).format(new Date(iso))
    : null;

const SCHEDA = "rounded-2xl border border-white/10 bg-white/[0.03] p-5";
const BOTTONE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-60";

function Aiuto({ testo }: { testo: string | null }) {
  if (!testo) return null;
  return (
    <section className={SCHEDA}>
      <h2 className="mb-2 font-semibold">Serve aiuto?</h2>
      <p className="whitespace-pre-line text-sm text-white/70">{testo}</p>
    </section>
  );
}

const TAPPE: { chiave: keyof OrdinePubblico["tempo"]; nome: string }[] = [
  { chiave: "ricevuto", nome: "Ordine ricevuto" },
  { chiave: "pagato", nome: "Pagamento ricevuto" },
  { chiave: "inPreparazione", nome: "In preparazione" },
  { chiave: "spedito", nome: "Spedito" },
  { chiave: "consegnato", nome: "Consegnato" },
];

function LineaDelTempo({ ordine }: { ordine: OrdinePubblico }) {
  const fatte = TAPPE.filter((t) => ordine.tempo[t.chiave]);
  const corrente = fatte[fatte.length - 1]?.chiave;
  return (
    <ol className={`${SCHEDA} space-y-4`}>
      {TAPPE.map((t) => {
        const quando = data(ordine.tempo[t.chiave]);
        const attuale = t.chiave === corrente;
        return (
          <li
            key={t.chiave}
            aria-current={attuale ? "step" : undefined}
            className="flex items-start gap-3"
          >
            <span
              aria-hidden="true"
              className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${quando ? (attuale ? "border-brand bg-brand" : "border-white/60 bg-white/60") : "border-white/25"}`}
            />
            <div className="min-w-0">
              <p className={`text-sm ${quando ? "text-white" : "text-white/45"}`}>{t.nome}</p>
              {quando && <p className="text-xs text-white/55">{quando}</p>}
              {t.chiave === "spedito" && ordine.tracking && (
                <div className="mt-1 space-y-1 text-xs text-white/70">
                  {ordine.tracking.corriere && <p>{ordine.tracking.corriere}</p>}
                  {ordine.tracking.numero && <p className="font-mono">{ordine.tracking.numero}</p>}
                  {ordine.tracking.url && (
                    <a
                      href={ordine.tracking.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-brand underline"
                    >
                      Segui il pacco
                    </a>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Riepilogo({ ordine }: { ordine: OrdinePubblico }) {
  return (
    <section className={SCHEDA}>
      <h2 className="mb-4 font-semibold">Il tuo ordine</h2>
      <div className="space-y-3">
        {ordine.righe.map((r, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-white">{r.nome}</p>
              <p className="text-xs text-white/45">
                {r.variante ? `${r.variante} · ` : ""}Qtà {r.qty}
              </p>
            </div>
            <span className="font-medium">{euro(r.totaleCent)}</span>
          </div>
        ))}
      </div>
      <div className="my-4 border-t border-white/10" />
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-white/70">
          <span>Subtotale</span>
          <span className="text-white">{euro(ordine.subtotaleCent)}</span>
        </div>
        <div className="flex justify-between text-white/70">
          <span>Spedizione</span>
          <span className={ordine.spedizioneCent === 0 ? "text-emerald-300" : "text-white"}>
            {ordine.spedizioneCent === 0 ? "Gratuita" : euro(ordine.spedizioneCent)}
          </span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Totale</span>
          <span>{euro(ordine.totaleCent)}</span>
        </div>
        {ordine.rimborsatoCent > 0 && (
          <div className="flex justify-between text-white/70">
            <span>Rimborsato</span>
            <span className="text-white">{euro(ordine.rimborsatoCent)}</span>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-white/55">
        Spedizione a: {ordine.cap} {ordine.citta}
      </p>
    </section>
  );
}

export interface PropsVista {
  stato: StatoPagina;
  riprova: StatoRiprova;
  suRiprova: () => void;
  suAggiorna: () => void;
  inLettura: boolean;
}

/** Il disegno puro: tutto ciò che si vede dipende da queste proprietà (la vetrina di V2 sostituisce questo componente). */
export function VistaOrdine({ stato, riprova, suRiprova, suAggiorna, inLettura }: PropsVista) {
  if (stato.tipo === "carico") {
    return (
      <div
        role="status"
        className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center"
      >
        <Loader2
          aria-hidden="true"
          className="mx-auto mb-4 h-10 w-10 animate-spin text-white/40 motion-reduce:animate-none"
        />
        <p className="text-sm text-white/70">Stiamo cercando il tuo ordine…</p>
      </div>
    );
  }
  if (stato.tipo === "assente") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <PackageSearch aria-hidden="true" className="mx-auto mb-4 h-12 w-12 text-white/30" />
        <h1 className="text-xl font-semibold">Ordine non trovato</h1>
        <p className="mt-2 text-sm text-white/55">Il link non è valido o non è più disponibile.</p>
        <Link to="/shop" className={`${BOTTONE} mt-6 bg-brand`}>
          Torna allo shop
        </Link>
      </div>
    );
  }

  const { ordine, testi, finestraFinita } = stato;
  const aiuto = testi.assistenza;

  if (ordine.fase === "verifica") {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div role="status" className={`${SCHEDA} px-6 py-12 text-center`}>
          <Loader2
            aria-hidden="true"
            className="mx-auto mb-4 h-12 w-12 animate-spin text-white/40 motion-reduce:animate-none"
          />
          <h1 className="text-2xl font-bold">{ordine.frase}</h1>
          {finestraFinita ? (
            <>
              <p className="mt-2 text-sm text-white/60">Il controllo automatico si è fermato.</p>
              <button
                type="button"
                onClick={suAggiorna}
                disabled={inLettura}
                className={`${BOTTONE} mt-5 border border-white/20 bg-white/5`}
              >
                Aggiorna
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-white/60">Questa pagina si aggiorna da sola.</p>
          )}
        </div>
        {finestraFinita && <Aiuto testo={aiuto} />}
      </div>
    );
  }

  const fallito = ordine.fase === "non_riuscito" || ordine.fase === "scaduto";
  const chiuso = ordine.fase === "annullato" || ordine.fase === "rimborsato";
  const Icona = fallito ? XCircle : CheckCircle2;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className={`${SCHEDA} px-6 py-8 text-center`}>
        <Icona
          aria-hidden="true"
          className={`mx-auto mb-3 h-12 w-12 ${fallito ? "text-red-400" : "text-emerald-400"}`}
        />
        <h1 className="text-2xl font-bold">{ordine.frase}</h1>
        {ordine.ref && (
          <p className="mt-2 text-sm text-white/60">
            Ordine <span className="font-mono text-brand">{ordine.ref}</span>
          </p>
        )}
        {fallito && ordine.riprovabile && (
          <div className="mt-5">
            <button
              type="button"
              onClick={suRiprova}
              disabled={riprova.tipo === "in_corso"}
              aria-busy={riprova.tipo === "in_corso"}
              className={`${BOTTONE} bg-brand`}
            >
              Riprova il pagamento
            </button>
          </div>
        )}
        {(riprova.tipo === "errore" || riprova.tipo === "prezzi") && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {riprova.frase}
            {riprova.tipo === "prezzi" && (
              <Link to="/shop/checkout" className="mt-2 block font-medium underline">
                Torna alla cassa
              </Link>
            )}
          </div>
        )}
      </div>
      {!fallito && !chiuso && <LineaDelTempo ordine={ordine} />}
      {chiuso && <div className={`${SCHEDA} border-l-4 border-l-white/40`}>{ordine.frase}</div>}
      {ordine.righe.length > 0 && <Riepilogo ordine={ordine} />}
      <Aiuto testo={aiuto} />
      <div className="text-center">
        <Link to="/shop" className="text-sm text-white/60 underline hover:text-white">
          Torna allo shop
        </Link>
      </div>
    </div>
  );
}

/* ══ LA PAGINA ══════════════════════════════════════════════════════════════ */

export function PaginaOrdine({ ricevuto }: { ricevuto: string }) {
  const { clear } = useCart();
  const [stato, setStato] = useState<StatoPagina>({ tipo: "carico" });
  const [riprova, setRiprova] = useState<StatoRiprova>({ tipo: "fermo" });
  const [inLettura, setInLettura] = useState(false);
  const controllo = useRef<ReturnType<typeof creaControllo> | null>(null);
  const chiave = useRef<string | null>(null);
  const permesso = useRef<{ valore: string; presoA: number } | null>(null);
  const svuotato = useRef(false);

  // l'apertura si conta una volta, solo come numero: nessun evento verso le piattaforme, nessun dato
  useEffect(() => {
    emettiSoloContatore("OrderPageView");
  }, []);

  useEffect(() => {
    const t = leggiChiave(window.location.search);
    chiave.current = t;
    if (!t) {
      setStato({ tipo: "assente" });
      return;
    }
    const c = creaControllo({
      leggi: () => ordinePubblico({ data: { ref: ricevuto, t } }),
      adesso: () => Date.now(),
      programma: (fn, ms) => window.setTimeout(fn, ms),
      annulla: (id) => window.clearTimeout(id as number),
      visibile: () => !document.hidden,
      cambio: setStato,
    });
    controllo.current = c;
    void c.avvia();
    return () => c.ferma();
  }, [ricevuto]);

  // il carrello si svuota una volta, alla prima risposta che dice che il pagamento è arrivato
  useEffect(() => {
    if (svuotato.current || stato.tipo !== "ordine" || !svuotaCarrello(stato.ordine.fase)) return;
    svuotato.current = true;
    clear();
  }, [stato, clear]);

  const prendiPermesso = useCallback(async (rinnova: boolean) => {
    const p = permesso.current;
    if (!rinnova && p && Date.now() - p.presoA < ETA_MASSIMA_PERMESSO_MS) return p;
    const r = await fetch("/api/public/shop-cassa-permesso", { cache: "no-store" });
    const j: unknown = await r.json();
    const valore =
      oggetto(j) && j.ok === true && typeof j.permesso === "string" ? j.permesso : null;
    permesso.current = valore ? { valore, presoA: Date.now() } : null;
    return permesso.current;
  }, []);

  // il permesso si prende appena il bottone compare, così il clic non aspetta i 3 secondi minimi
  const riprovabile = stato.tipo === "ordine" && stato.ordine.riprovabile;
  useEffect(() => {
    if (riprovabile) void prendiPermesso(false).catch(() => null);
  }, [riprovabile, prendiPermesso]);

  const suRiprova = async () => {
    const t = chiave.current;
    if (!t) return;
    setRiprova({ tipo: "in_corso" });
    const esito = await riprovaOrdine({
      ref: ricevuto,
      t,
      permesso: prendiPermesso,
      invia: async (corpo) => {
        const r = await fetch("/api/public/shop-cassa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        return { stato: r.status, corpo: await r.json().catch(() => null) };
      },
      adesso: () => Date.now(),
      attendi: (ms) => new Promise((ok) => window.setTimeout(ok, ms)),
      vai: (url) => window.location.assign(url),
    });
    if (esito.tipo === "vai") return; // la pagina sta per lasciare il sito: il bottone resta spento
    if (esito.tipo === "pagato") {
      setRiprova({ tipo: "fermo" });
      void controllo.current?.aggiorna();
      return;
    }
    setRiprova(esito);
  };

  const suAggiorna = async () => {
    setInLettura(true);
    await controllo.current?.aggiorna();
    setInLettura(false);
  };

  return (
    <VistaOrdine
      stato={stato}
      riprova={riprova}
      suRiprova={suRiprova}
      suAggiorna={suAggiorna}
      inLettura={inLettura}
    />
  );
}
