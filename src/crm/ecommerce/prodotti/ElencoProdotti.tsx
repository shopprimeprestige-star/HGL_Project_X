/** ── L'ELENCO DEI PRODOTTI (ElencoProdotti.tsx) ───────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T14 (Design §4.10.1). La linguetta «Prodotti» di `/CRM/ecommerce`: cinque segmenti,
 *  ricerca per nome e SKU, filtro per categoria, colonne ordinabili, il chip di stato con la PRIMA ragione per cui un prodotto
 *  non è a posto, la giacenza cambiabile dalla riga, e le azioni di gruppo con il riepilogo di chi è rimasto fuori.
 *
 *  ── COSA STA DOVE ───────────────────────────────────────────────────────────
 *  Le regole senza schermo (ordine, ricerca, chip, SKU della copia, frasi dei riepiloghi) sono in `elenco-puro.ts` e si provano
 *  da sole. Le letture e le scritture passano TUTTE da `negozio` (`useNegozio()`, chiamato una volta dal guscio): qui non c'è
 *  nessun `fetch`. Il segmento e la categoria si chiedono al server (`impostaFiltri`) e restano nell'archivio, quindi tornando
 *  dalla scheda si ritrova l'elenco com'era; la ricerca per testo è locale e immediata.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Una lettura che fallisce NON svuota l'elenco (lo dice `client.ts`): qui si vede l'ultimo buono con l'ora e l'errore accanto.
 *  · Database non pronto (S1 non applicata) o cancello: una frase chiara e «Riprova», non un errore generico.
 *  · «Elimina» non esiste: un prodotto si archivia dalla sua scheda. Niente prezzi barrati, sconti, stelle.
 *  · Il numero dei pezzi non si legge dall'elenco del server (non lo porta): si apre dalla riga («Giacenza») e si legge la
 *    scheda di quel prodotto solo allora. Si cambia con `giacenza_imposta`, che non va mai sotto zero.
 *  ⚠️ Nessun log da qui, mai. */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Lock,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Chip, Segmento, Vuoto } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { oraHHmm } from "@/crm/ecommerce/client";
import { Avviso } from "@/crm/ecommerce/Avviso";
import {
  SEGMENTI,
  type ErroreNegozio,
  type FiltriElenco,
  type RigaElenco,
} from "@/crm/negozio/client";
import { skuValido, type Variante } from "@/shop/cms/modello";
import {
  ETICHETTE_SEGMENTO,
  MAX_GRUPPO,
  chipProdotto,
  cercaRighe,
  ordinaRighe,
  prezzoDaCent,
  proponiSkuCopia,
  riepilogoDuplica,
  riepilogoGruppo,
  type Colonna,
  type Direzione,
  type Fuori,
} from "./elenco-puro";
import type { Negozio } from "./tipi";

export interface PropsElencoProdotti {
  /** L'archivio unico della pagina (`useNegozio()` chiamato dal guscio). */
  negozio: Negozio;
  /** Cambia l'indirizzo: `apri(id)` apre la scheda del prodotto, `apri(null)` torna qui. */
  apri: (id: string | null) => void;
  /** Sale quando le categorie cambiano (T17): l'elenco rilegge i nomi per il suo filtro. */
  categorieAggiornate?: number;
}

const TONO = { ok: "vinta", attenzione: "in_sospeso", neutro: "neutro", spento: "chiusa" } as const;
const CANALI = [
  { chiave: "sito", lettera: "S", nome: "Sito" },
  { chiave: "meta", lettera: "M", nome: "Meta" },
  { chiave: "google", lettera: "G", nome: "Google" },
  { chiave: "tiktok", lettera: "T", nome: "TikTok" },
] as const;
const TIPI = [
  { valore: "patch", nome: "Patch" },
  { valore: "cura", nome: "Cura" },
  { valore: "kit", nome: "Kit" },
] as const;
const MAX_PEZZI = 1_000_000;
/** I tipi di errore dopo i quali riprovare con il prodotto dopo è inutile: l'operazione si ferma. */
const FERMANO = ["sessione", "permesso", "migrazione", "rete"];

const campo =
  "h-8 rounded-md border border-border bg-card px-2 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface EsitoGruppo {
  tono: "ok" | "attenzione" | "errore";
  riga: string;
  fuori: Fuori[];
}

export function ElencoProdotti({ negozio, apri, categorieAggiornate = 0 }: PropsElencoProdotti) {
  const {
    prodotti,
    caricato,
    errore,
    troncato,
    ultimoAggiornamento,
    inAggiornamento,
    filtri,
    aggiorna,
    impostaFiltri,
    esegui,
  } = negozio;
  const segmento = filtri.segmento ?? "tutti";
  const categoria = filtri.categoria ?? "";

  const [q, setQ] = useState("");
  const [ordine, setOrdine] = useState<{ colonna: Colonna; direzione: Direzione }>({
    colonna: "nome",
    direzione: "su",
  });
  const [scelti, setScelti] = useState<ReadonlySet<string>>(new Set());
  const [aperti, setAperti] = useState<ReadonlySet<string>>(new Set());
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<EsitoGruppo | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const [categorie, setCategorie] = useState<{ id: string; nome: string }[]>([]);

  //  I nomi delle categorie per il filtro: una lettura sola, all'apertura. Se fallisce il filtro non compare (l'elenco funziona lo stesso).
  const leggiCategorie = negozio.categorie;
  useEffect(() => {
    let vivo = true;
    void leggiCategorie().then((r) => {
      if (!vivo || !r.ok || !Array.isArray(r.dati.categorie)) return;
      setCategorie(
        (r.dati.categorie as unknown[]).flatMap((k) => {
          const o = k as { id?: unknown; nome?: unknown } | null;
          return o && typeof o.id === "string" && typeof o.nome === "string"
            ? [{ id: o.id, nome: o.nome }]
            : [];
        }),
      );
    });
    return () => {
      vivo = false;
    };
  }, [leggiCategorie, categorieAggiornate]);

  const visibili = useMemo(
    () => ordinaRighe(cercaRighe(prodotti, q), ordine.colonna, ordine.direzione),
    [prodotti, q, ordine],
  );
  const nomi = useMemo(() => Object.fromEntries(prodotti.map((r) => [r.id, r.nome])), [prodotti]);
  //  Chi non si vede più (filtro cambiato, prodotto sparito) non resta selezionato di nascosto.
  const selezionati = useMemo(() => visibili.filter((r) => scelti.has(r.id)), [visibili, scelti]);
  const pieno = selezionati.length >= MAX_GRUPPO;
  const filtrato = segmento !== "tutti" || categoria !== "" || q.trim() !== "";

  const cambiaFiltri = (p: Partial<FiltriElenco>) => {
    setScelti(new Set());
    setEsito(null);
    void impostaFiltri({ ...filtri, ...p });
  };
  const togliFiltri = () => {
    setQ("");
    cambiaFiltri({ segmento: undefined, categoria: undefined });
  };
  const ordinaPer = (colonna: Colonna) =>
    setOrdine((o) => ({
      colonna,
      direzione: o.colonna === colonna && o.direzione === "su" ? "giu" : "su",
    }));
  const alterna = (insieme: ReadonlySet<string>, id: string): ReadonlySet<string> =>
    insieme.has(id) ? new Set([...insieme].filter((x) => x !== id)) : new Set(insieme).add(id);
  const tuttiScelti =
    visibili.length > 0 && visibili.slice(0, MAX_GRUPPO).every((r) => scelti.has(r.id));
  const scegliTutti = () =>
    setScelti(tuttiScelti ? new Set() : new Set(visibili.slice(0, MAX_GRUPPO).map((r) => r.id)));

  /** Una azione alla volta: i tasti restano spenti finché non è finita. */
  const lavora = async (f: () => Promise<void>) => {
    if (occupato) return;
    setOccupato(true);
    setEsito(null);
    try {
      await f();
    } finally {
      setOccupato(false);
    }
  };

  const cambiaStato = (stato: "pubblicato" | "bozza") =>
    lavora(async () => {
      const ids = selezionati.map((r) => r.id);
      const r = await esegui("gruppo_stato", { ids, stato });
      if (!r.ok) return setEsito({ tono: "errore", riga: r.errore.messaggio, fuori: [] });
      const rie = riepilogoGruppo(stato, ids, r.dati, nomi);
      setEsito({ tono: rie.fuori.length ? "attenzione" : "ok", riga: rie.riga, fuori: rie.fuori });
      setScelti(new Set(rie.fuori.map((f) => f.id))); // chi è rimasto fuori resta selezionato: lo si vede e si sistema
    });

  const duplica = () =>
    lavora(async () => {
      const usati = new Set(prodotti.map((r) => r.sku));
      const esiti: { id: string; ok: boolean; frase?: string }[] = [];
      let fermo: string | null = null;
      for (const riga of selezionati) {
        if (fermo) {
          esiti.push({ id: riga.id, ok: false, frase: fermo });
          continue;
        }
        let esitoRiga: { id: string; ok: boolean; frase?: string } = { id: riga.id, ok: false };
        //  Lo SKU lo conosciamo solo per i prodotti che si vedono: se è occupato da uno che non si vede, il server lo dice e si prova col numero dopo.
        for (let prova = 0; prova < 3; prova++) {
          const sku = proponiSkuCopia(riga.sku, usati);
          const r = await esegui("prodotto_duplica", { prodottoId: riga.id, sku });
          usati.add(sku);
          if (r.ok) {
            esitoRiga = { id: riga.id, ok: true };
            break;
          }
          esitoRiga = { id: riga.id, ok: false, frase: r.errore.messaggio };
          if (r.errore.tipo === "duplicato") continue;
          if (FERMANO.includes(r.errore.tipo))
            fermo = "Non l'ho provato: l'operazione si è fermata prima.";
          break;
        }
        esiti.push(esitoRiga);
      }
      const rie = riepilogoDuplica(esiti, nomi);
      setEsito({ tono: rie.fuori.length ? "attenzione" : "ok", riga: rie.riga, fuori: rie.fuori });
      setScelti(new Set(rie.fuori.map((f) => f.id)));
    });

  const adotta = (r: RigaElenco) =>
    lavora(async () => {
      const x = await esegui("prodotto_adotta", { prodottoId: r.id });
      setEsito(
        x.ok
          ? {
              tono: "ok",
              riga: `«${r.nome}» è un tuo prodotto: lo trovi in «Tutti», in bozza. Completalo e pubblicalo quando è pronto.`,
              fuori: [],
            }
          : { tono: "errore", riga: x.errore.messaggio, fuori: [] },
      );
    });

  /* ── Prima lettura: niente da mostrare ancora ── */
  if (!caricato) {
    if (errore) return <ErroreLettura errore={errore} riprova={() => void aggiorna()} />;
    return <Scheletri />;
  }

  const tastoNuovo = (
    <Button type="button" size="sm" className="h-8 text-[12px]" onClick={() => setNuovo(true)}>
      <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      Nuovo prodotto
    </Button>
  );
  const nessunProdotto = prodotti.length === 0;

  return (
    <div className="flex flex-col gap-3 pb-20 md:pb-0">
      {/* ── Avvisi: l'ultima lettura buona resta, l'errore sta accanto ── */}
      {errore && (
        <Avviso
          errore
          azione={
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[12px]"
              onClick={() => void aggiorna()}
            >
              Riprova
            </Button>
          }
        >
          {errore.messaggio} Quello che vedi è l'ultima lettura riuscita
          {ultimoAggiornamento !== null ? `, delle ${oraHHmm(ultimoAggiornamento)}` : ""}.
        </Avviso>
      )}
      {troncato && (
        <Avviso>
          Il catalogo è molto grande: si vedono solo i primi prodotti. Usa la ricerca o i filtri per
          trovare gli altri.
        </Avviso>
      )}

      {/* ── Segmenti, ricerca, categoria ── */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Quali prodotti vedere"
      >
        {SEGMENTI.map((s) => (
          <Segmento
            key={s}
            attivo={segmento === s}
            onClick={() => cambiaFiltri({ segmento: s === "tutti" ? undefined : s })}
          >
            {ETICHETTE_SEGMENTO[s]}
          </Segmento>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca per nome o SKU"
            aria-label="Cerca per nome o SKU"
            maxLength={100}
            className="h-8 pl-8 text-[12.5px]"
          />
        </div>
        {categorie.length > 0 && (
          <select
            aria-label="Filtra per categoria"
            value={categoria}
            onChange={(e) => cambiaFiltri({ categoria: e.target.value || undefined })}
            className={cn(campo, "max-w-48")}
          >
            <option value="">Tutte le categorie</option>
            {categorie.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nome}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-2">
          {ultimoAggiornamento !== null && (
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              Aggiornato alle {oraHHmm(ultimoAggiornamento)}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[12px]"
            onClick={() => void aggiorna()}
            disabled={inAggiornamento}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", inAggiornamento && "animate-spin")}
              aria-hidden="true"
            />
            Aggiorna
          </Button>
          <span className="hidden md:inline-flex">{tastoNuovo}</span>
        </div>
      </div>

      {/* ── Azioni di gruppo ── */}
      {selezionati.length > 0 && segmento !== "vecchio_catalogo" && (
        <div
          role="group"
          aria-label="Azioni sui prodotti scelti"
          className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 backdrop-blur"
        >
          <span className="px-1 text-[12.5px] font-medium" aria-live="polite">
            {selezionati.length === 1
              ? "1 prodotto scelto"
              : `${selezionati.length} prodotti scelti`}
            {pieno && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · al massimo {MAX_GRUPPO} alla volta
              </span>
            )}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-8 text-[12px]"
            disabled={occupato}
            onClick={() => void cambiaStato("pubblicato")}
          >
            Pubblica
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            disabled={occupato}
            onClick={() => void cambiaStato("bozza")}
          >
            Metti in bozza
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            disabled={occupato}
            onClick={() => void duplica()}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Duplica
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-[12px]"
            disabled={occupato}
            onClick={() => setScelti(new Set())}
          >
            Togli la scelta
          </Button>
        </div>
      )}
      {esito && <EsitoAzione esito={esito} chiudi={() => setEsito(null)} />}

      {/* ── L'elenco ── */}
      {nessunProdotto && !filtrato ? (
        <Vuoto
          icona={PackageOpen}
          titolo="Non c'è ancora nessun prodotto."
          testo="Crea il primo: lo completi con calma, in bozza, e lo pubblichi quando è pronto."
          azione={tastoNuovo}
        />
      ) : visibili.length === 0 ? (
        <Vuoto
          icona={PackageOpen}
          titolo={
            segmento === "vecchio_catalogo" && !q.trim() && !categoria
              ? "Nessun articolo del vecchio catalogo"
              : "Nessun prodotto con questi filtri"
          }
          testo={
            segmento === "vecchio_catalogo" && !q.trim() && !categoria
              ? "O li hai già usati tutti, oppure l'importazione degli articoli di prima non è ancora stata fatta."
              : "Prova a togliere un filtro o a cambiare la ricerca."
          }
          azione={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={togliFiltri}
            >
              Togli i filtri
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-[12px] text-muted-foreground" aria-live="polite">
            {visibili.length === 1 ? "1 prodotto" : `${visibili.length} prodotti`}
          </p>

          {/* Computer: tabella */}
          <div
            className={cn(
              "hidden overflow-hidden rounded-xl border border-border bg-card md:block",
              inAggiornamento && "opacity-80",
            )}
          >
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="border-b border-border bg-muted/40 text-[11.5px] text-muted-foreground">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Scegli i primi prodotti dell'elenco"
                      checked={tuttiScelti}
                      onChange={scegliTutti}
                      className="h-4 w-4 accent-sky-600"
                    />
                  </th>
                  <Intestazione colonna="nome" ordine={ordine} ordinaPer={ordinaPer}>
                    Nome
                  </Intestazione>
                  <Intestazione colonna="sku" ordine={ordine} ordinaPer={ordinaPer}>
                    SKU
                  </Intestazione>
                  <Intestazione colonna="stato" ordine={ordine} ordinaPer={ordinaPer}>
                    Stato
                  </Intestazione>
                  <Intestazione colonna="prezzo" ordine={ordine} ordinaPer={ordinaPer} destra>
                    Prezzo
                  </Intestazione>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibili.map((r) => {
                  const scelto = scelti.has(r.id);
                  const aperta = aperti.has(r.id);
                  return (
                    <Fragment key={r.id}>
                      <tr className={cn("align-top hover:bg-accent/40", scelto && "bg-sky-50/60")}>
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Scegli ${r.nome}`}
                            checked={scelto}
                            disabled={!scelto && pieno}
                            onChange={() => setScelti(alterna(scelti, r.id))}
                            className="h-4 w-4 accent-sky-600"
                          />
                        </td>
                        <td className="min-w-0 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => apri(r.id)}
                            className="rounded-md text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {r.nome}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] tabular-nums text-muted-foreground">
                          {r.sku}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatoRiga riga={r} />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {prezzoDaCent(r.prezzoCent)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <AzioniRiga
                            riga={r}
                            aperta={aperta}
                            occupato={occupato}
                            alternaGiacenza={() => setAperti(alterna(aperti, r.id))}
                            adotta={() => void adotta(r)}
                          />
                        </td>
                      </tr>
                      {aperta && (
                        <tr className="bg-muted/30">
                          <td />
                          <td colSpan={5} className="px-3 pb-3 pt-1">
                            <PannelloGiacenza
                              id={r.id}
                              negozio={negozio}
                              apriScheda={() => apri(r.id)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Telefono: una card per prodotto */}
          <ul className={cn("flex flex-col gap-2 md:hidden", inAggiornamento && "opacity-80")}>
            {visibili.map((r) => {
              const scelto = scelti.has(r.id);
              return (
                <li
                  key={r.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-3",
                    scelto && "border-sky-300 bg-sky-50/60",
                  )}
                >
                  <div className="flex items-start gap-1">
                    <label className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label={`Scegli ${r.nome}`}
                        checked={scelto}
                        disabled={!scelto && pieno}
                        onChange={() => setScelti(alterna(scelti, r.id))}
                        className="h-5 w-5 accent-sky-600"
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => apri(r.id)}
                        className="block min-h-6 max-w-full rounded-md text-left text-[14px] font-medium leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {r.nome}
                      </button>
                      <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                        {r.sku} · {prezzoDaCent(r.prezzoCent)}
                      </p>
                      <div className="mt-1.5">
                        <StatoRiga riga={r} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <AzioniRiga
                      riga={r}
                      aperta={aperti.has(r.id)}
                      occupato={occupato}
                      alternaGiacenza={() => setAperti(alterna(aperti, r.id))}
                      adotta={() => void adotta(r)}
                      grande
                    />
                  </div>
                  {aperti.has(r.id) && (
                    <div className="mt-2 border-t border-border pt-2">
                      <PannelloGiacenza id={r.id} negozio={negozio} apriScheda={() => apri(r.id)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Telefono: il tasto resta in basso, sotto il pollice */}
      <div className="fixed inset-x-4 bottom-4 z-30 md:hidden">
        <Button
          type="button"
          className="h-12 w-full text-[14px] shadow-lg"
          onClick={() => setNuovo(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nuovo prodotto
        </Button>
      </div>

      <FinestraNuovo
        aperta={nuovo}
        chiudi={() => setNuovo(false)}
        crea={(dati) => esegui("prodotto_crea", dati)}
        creato={(id) => {
          setNuovo(false);
          apri(id);
        }}
      />
    </div>
  );
}

/* ══ PEZZI PICCOLI ══════════════════════════════════════════════════════════ */

function Intestazione({
  colonna,
  ordine,
  ordinaPer,
  destra,
  children,
}: {
  colonna: Colonna;
  ordine: { colonna: Colonna; direzione: Direzione };
  ordinaPer: (c: Colonna) => void;
  destra?: boolean;
  children: ReactNode;
}) {
  const attiva = ordine.colonna === colonna;
  const Freccia = ordine.direzione === "su" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={attiva ? (ordine.direzione === "su" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 font-medium", destra && "text-right")}
    >
      <button
        type="button"
        onClick={() => ordinaPer(colonna)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          attiva && "text-foreground",
        )}
      >
        {children}
        {attiva && <Freccia className="h-3 w-3" aria-hidden="true" />}
      </button>
    </th>
  );
}

/** Il chip di stato e, sotto, la prima ragione scritta (se c'è). */
function StatoRiga({ riga }: { riga: RigaElenco }) {
  const chip = chipProdotto(riga);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-1">
        <Chip tono={TONO[chip.tono]} punto>
          {chip.etichetta}
        </Chip>
        {chip.modifiche && <Chip tono="in_sospeso">Modifiche non pubblicate</Chip>}
      </span>
      {chip.ragione && (
        <span className="max-w-xs text-[11.5px] leading-snug text-amber-800">
          Da sistemare: {chip.ragione}
        </span>
      )}
    </div>
  );
}

function AzioniRiga({
  riga,
  aperta,
  occupato,
  alternaGiacenza,
  adotta,
  grande,
}: {
  riga: RigaElenco;
  aperta: boolean;
  occupato: boolean;
  alternaGiacenza: () => void;
  adotta: () => void;
  grande?: boolean;
}) {
  const alto = grande ? "min-h-11" : "h-8";
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {riga.origine === "codice" && (
        <Button
          type="button"
          size="sm"
          className={cn(alto, "text-[12px]")}
          disabled={occupato}
          onClick={adotta}
        >
          Usa questo prodotto
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(alto, "text-[12px]")}
        aria-expanded={aperta}
        onClick={alternaGiacenza}
      >
        Giacenza
        <ChevronDown
          className={cn("ml-1 h-3.5 w-3.5 transition", aperta && "rotate-180")}
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}

function EsitoAzione({ esito, chiudi }: { esito: EsitoGruppo; chiudi: () => void }) {
  return (
    <div
      role={esito.tono === "errore" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-[12.5px] leading-snug",
        esito.tono === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        esito.tono === "attenzione" && "border-amber-200 bg-amber-50 text-amber-900",
        esito.tono === "errore" && "border-rose-200 bg-rose-50 text-rose-900",
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1">{esito.riga}</p>
        <button
          type="button"
          onClick={chiudi}
          className="-m-1 rounded-md p-1 text-[12px] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Chiudi
        </button>
      </div>
      {esito.fuori.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          {esito.fuori.map((f) => (
            <li key={f.id}>
              <span className="font-medium">{f.nome}</span>: {f.motivo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** La prima lettura è fallita: niente da mostrare, solo la frase e il modo di riprovare. */
function ErroreLettura({ errore, riprova }: { errore: ErroreNegozio; riprova: () => void }) {
  const tasto = (
    <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={riprova}>
      Riprova
    </Button>
  );
  if (errore.tipo === "permesso" || errore.tipo === "sessione")
    return (
      <Vuoto
        icona={Lock}
        titolo={errore.tipo === "sessione" ? "La sessione è scaduta" : "I prodotti non sono per te"}
        testo={errore.messaggio}
        azione={tasto}
      />
    );
  //  S1 non applicata (o lo shop non apribile): non è un guasto, è una cosa da fare. Il resto del CRM funziona.
  if (errore.tipo === "migrazione" || errore.tipo === "cancello")
    return (
      <Vuoto
        icona={PackageOpen}
        titolo="Il catalogo non è ancora pronto"
        testo={`${errore.messaggio} Gli ordini e il resto del CRM funzionano come sempre.`}
        azione={tasto}
      />
    );
  return <Vuoto titolo="Non riesco a leggere i prodotti" testo={errore.messaggio} azione={tasto} />;
}

function Scheletri() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">Carico i prodotti…</span>
      <div className="flex gap-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-7 w-20 animate-pulse rounded-lg border border-border bg-muted/50"
          />
        ))}
      </div>
      <div
        className="flex flex-col gap-px overflow-hidden rounded-xl border border-border"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse bg-muted/50" />
        ))}
      </div>
    </div>
  );
}

/* ══ LA GIACENZA E I CANALI DI UN PRODOTTO ══════════════════════════════════ */

type Letta =
  | { stato: "carico" }
  | { stato: "errore"; messaggio: string }
  | { stato: "pronta"; varianti: Variante[]; canali: Record<string, boolean> };

/** Si apre dalla riga: legge la scheda di QUEL prodotto (il numero dei pezzi sta lì) e fa cambiare la giacenza con `giacenza_imposta`. */
function PannelloGiacenza({
  id,
  negozio,
  apriScheda,
}: {
  id: string;
  negozio: Negozio;
  apriScheda: () => void;
}) {
  const [letta, setLetta] = useState<Letta>({ stato: "carico" });
  const [tentativo, setTentativo] = useState(0);
  const leggiScheda = negozio.scheda;
  useEffect(() => {
    let vivo = true;
    setLetta({ stato: "carico" });
    void leggiScheda(id).then((r) => {
      if (!vivo) return;
      if (!r.ok) return setLetta({ stato: "errore", messaggio: r.errore.messaggio });
      const varianti = r.scheda.varianti.filter(
        (v): v is Variante => typeof (v as Variante)?.id === "string",
      );
      const c = (r.scheda.prodotto as { canali?: Record<string, unknown> }).canali ?? {};
      setLetta({
        stato: "pronta",
        varianti,
        canali: Object.fromEntries(CANALI.map((k) => [k.chiave, c[k.chiave] === true])),
      });
    });
    return () => {
      vivo = false;
    };
  }, [id, leggiScheda, tentativo]);

  if (letta.stato === "carico")
    return (
      <p role="status" aria-busy="true" className="text-[12px] text-muted-foreground">
        Leggo la giacenza…
      </p>
    );
  if (letta.stato === "errore")
    return (
      <p role="alert" className="flex flex-wrap items-center gap-2 text-[12px] text-rose-900">
        {letta.messaggio}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[12px]"
          onClick={() => setTentativo((n) => n + 1)}
        >
          Riprova
        </Button>
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
        Canali:
        {CANALI.map((k) => (
          <span
            key={k.chiave}
            title={`${k.nome}: ${letta.canali[k.chiave] ? "acceso" : "spento"}`}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded border text-[11px] font-semibold",
              letta.canali[k.chiave]
                ? "border-sky-300 bg-sky-50 text-sky-800"
                : "border-border text-muted-foreground/70",
            )}
          >
            <span aria-hidden="true">{k.lettera}</span>
            <span className="sr-only">
              {k.nome} {letta.canali[k.chiave] ? "acceso" : "spento"}
            </span>
          </span>
        ))}
      </p>
      {letta.varianti.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Questo prodotto non ha ancora varianti, e i pezzi stanno nelle varianti.{" "}
          <button type="button" onClick={apriScheda} className="underline">
            Apri la scheda
          </button>{" "}
          per aggiungerle.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {letta.varianti.map((v) => (
            <RigaGiacenza key={v.id} variante={v} esegui={negozio.esegui} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RigaGiacenza({ variante, esegui }: { variante: Variante; esegui: Negozio["esegui"] }) {
  const [valore, setValore] = useState(String(variante.giacenza));
  const [attuale, setAttuale] = useState(variante.giacenza);
  const [stato, setStato] = useState<{ tono: "ok" | "errore"; testo: string } | null>(null);
  const [invio, setInvio] = useState(false);
  const numero = /^\d{1,7}$/.test(valore.trim()) ? Number(valore.trim()) : null;
  const valido = numero !== null && numero <= MAX_PEZZI;
  const invariato = numero === attuale;

  const imposta = async () => {
    if (!valido || invio) return;
    setInvio(true);
    setStato(null);
    const r = await esegui("giacenza_imposta", {
      varianteId: variante.id,
      valore: numero,
      motivo: "rettifica",
    });
    setInvio(false);
    if (!r.ok) return setStato({ tono: "errore", testo: r.errore.messaggio });
    const nuova = typeof r.dati.giacenza === "number" ? r.dati.giacenza : numero;
    setAttuale(nuova);
    setValore(String(nuova));
    setStato({ tono: "ok", testo: `Ora ce ne sono ${nuova}.` });
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="min-w-0 flex-1 basis-40 text-[12.5px]">
        <span className="font-medium">{variante.nome || "Variante unica"}</span>
        <span className="ml-2 text-[11.5px] tabular-nums text-muted-foreground">
          {variante.sku}
        </span>
        {!variante.attiva && (
          <span className="ml-2 text-[11.5px] text-muted-foreground">(non attiva)</span>
        )}
      </span>
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void imposta();
        }}
      >
        <label className="sr-only" htmlFor={`pezzi-${variante.id}`}>
          Pezzi di {variante.nome || variante.sku}
        </label>
        <Input
          id={`pezzi-${variante.id}`}
          inputMode="numeric"
          value={valore}
          onChange={(e) => setValore(e.target.value)}
          aria-invalid={!valido}
          className="h-8 w-20 text-right text-[12.5px] tabular-nums"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-8 text-[12px]"
          disabled={!valido || invariato || invio}
        >
          {invio ? "Salvo…" : "Imposta"}
        </Button>
      </form>
      <span
        role={stato?.tono === "errore" ? "alert" : "status"}
        className={cn(
          "basis-full text-[11.5px]",
          stato?.tono === "errore" ? "text-rose-800" : "text-emerald-800",
        )}
      >
        {!valido ? "Scrivi un numero intero, da 0 in su." : (stato?.testo ?? "")}
      </span>
    </li>
  );
}

/* ══ «NUOVO PRODOTTO» ═══════════════════════════════════════════════════════ */

function FinestraNuovo({
  aperta,
  chiudi,
  crea,
  creato,
}: {
  aperta: boolean;
  chiudi: () => void;
  crea: (dati: Record<string, unknown>) => ReturnType<Negozio["esegui"]>;
  creato: (id: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPI)[number]["valore"]>("patch");
  const [sku, setSku] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const pulito = sku.trim().toUpperCase();

  const invia = async () => {
    if (invio) return;
    if (nome.trim().length < 2) return setErrore("Scrivi il nome del prodotto.");
    if (!skuValido(pulito))
      return setErrore(
        "Lo SKU non è valido: maiuscolo, senza spazi, da 2 a 40 segni (per esempio HG-T01).",
      );
    setInvio(true);
    setErrore(null);
    const r = await crea({ nome: nome.trim(), tipo, sku: pulito });
    setInvio(false);
    const id = r.ok ? (r.dati.prodotto as { id?: unknown } | undefined)?.id : null;
    if (!r.ok) return setErrore(r.errore.messaggio);
    if (typeof id !== "string")
      return setErrore(
        "Il prodotto è stato creato ma non riesco ad aprirlo: lo trovi nell'elenco.",
      );
    setNome("");
    setSku("");
    creato(id);
  };

  return (
    <Dialog open={aperta} onOpenChange={(v) => !v && !invio && chiudi()}>
      <DialogContent className="crm-theme bg-white text-foreground">
        <DialogHeader>
          <DialogTitle>Nuovo prodotto</DialogTitle>
          <DialogDescription>
            Nasce in bozza: nessuno lo vede finché non lo pubblichi. Il resto lo scrivi nella
            scheda.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void invia();
          }}
        >
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            Nome
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={120}
              autoComplete="off"
              className="min-h-11 text-[14px] font-normal sm:min-h-9"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className={cn(campo, "min-h-11 text-[14px] font-normal sm:min-h-9")}
            >
              {TIPI.map((t) => (
                <option key={t.valore} value={t.valore}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium">
            SKU
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              maxLength={40}
              autoComplete="off"
              placeholder="Per esempio HG-T01"
              className="min-h-11 text-[14px] font-normal sm:min-h-9"
            />
            <span className="text-[11.5px] font-normal text-muted-foreground">
              È il codice con cui riconosci il prodotto. Una volta scelto non va cambiato.
            </span>
          </label>
          {errore && (
            <p role="alert" className="text-[12.5px] text-rose-800">
              {errore}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              disabled={invio}
              onClick={chiudi}
            >
              Annulla
            </Button>
            <Button type="submit" className="min-h-11 sm:min-h-9" disabled={invio}>
              {invio ? "Creo…" : "Crea il prodotto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
