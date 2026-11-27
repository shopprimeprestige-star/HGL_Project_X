/** ── L'ELENCO DEI PRODOTTI (ElencoProdotti.tsx) ───────────────────────────────
 *  Commessa 2026-11-20-shop-completo, T14 (Design §4.10.1). La linguetta «Prodotti» di `/CRM/ecommerce`: cinque segmenti,
 *  ricerca per nome e SKU, filtro per categoria, colonne ordinabili, il chip di stato con la PRIMA ragione per cui un prodotto
 *  non è a posto, la giacenza cambiabile dalla riga, e le azioni di gruppo con il riepilogo di chi è rimasto fuori.
 *
 *  ── COSA STA DOVE ───────────────────────────────────────────────────────────
 *  Le regole senza schermo (ordine, ricerca, chip, SKU della copia, frasi dei riepiloghi) sono in `elenco-puro.ts` e si provano
 *  da sole. Le letture e le scritture passano da `negozio` (`useNegozio()`, chiamato una volta dal guscio); l'unica eccezione è l'import
 *  (E9: `eseguiAzione` senza la rilettura dopo ogni gruppo, vedi sotto). Qui non c'è nessun `fetch(` diretto. Il segmento e la categoria si chiedono al server (`impostaFiltri`) e restano nell'archivio, quindi tornando
 *  dalla scheda si ritrova l'elenco com'era; la ricerca per testo è locale e immediata.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Una lettura che fallisce NON svuota l'elenco (lo dice `client.ts`): qui si vede l'ultimo buono con l'ora e l'errore accanto.
 *  · Database non pronto (S1 non applicata) o cancello: una frase chiara e «Riprova», non un errore generico.
 *  · «Elimina» non esiste: un prodotto si archivia dalla sua scheda. Niente prezzi barrati, sconti, stelle.
 *  · «Aggiungi prodotto» apre la scheda vuota (`SchedaNuova`, E9): non scrive niente finché non si preme «Salva bozza». «Importa» apre la
 *    finestra dell'import (E10): la finestra scrive con un `esegui` che NON rilegge l'elenco dopo ogni gruppo (fino a 60 letture), e l'elenco
 *    si rilegge una volta sola, alla chiusura.
 *  · Il numero dei pezzi non si legge dall'elenco del server (non lo porta): si apre dalla riga («Giacenza») e si legge la
 *    scheda di quel prodotto solo allora. Si cambia con `giacenza_imposta`, che non va mai sotto zero.
 *  ⚠️ Nessun log da qui, mai. */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchCRM } from "@/crm/AuthContext";
import { Chip, Segmento, Vuoto } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { oraHHmm } from "@/crm/ecommerce/client";
import { Avviso } from "@/crm/ecommerce/Avviso";
import {
  SEGMENTI,
  eseguiAzione,
  leggiScheda,
  type ErroreNegozio,
  type FiltriElenco,
  type RigaElenco,
} from "@/crm/negozio/client";
import type { Variante } from "@/shop/cms/modello";
import {
  ETICHETTE_SEGMENTO,
  aGruppi,
  uniscoGruppi,
  chipProdotto,
  cercaRighe,
  etichettaCanali,
  etichettaGiacenza,
  ordinaRighe,
  prezzoDaCent,
  proponiCopia,
  riepilogoDuplica,
  riepilogoGruppo,
  type AzioneGruppo,
  type Colonna,
  type Direzione,
  type Fuori,
} from "./elenco-puro";
import { FinestraImporta } from "./importa/FinestraImporta";
import { SchedaNuova } from "./SchedaNuova";
import { elencoCategorie } from "./scheda-nuova-puro";
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
const MAX_PEZZI = 1_000_000;
/** I tipi di errore dopo i quali riprovare con il prodotto dopo è inutile: l'operazione si ferma. */
const FERMANO = ["sessione", "permesso", "migrazione", "rete"];

const campo =
  "h-11 rounded-md border border-border bg-card px-2 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8";

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
  const [importa, setImporta] = useState(false);
  //  La conferma di «Elimina» (E14): `n` resta quello del clic, così il titolo non cambia mentre la finestra si chiude.
  const [cestino, setCestino] = useState({ aperta: false, n: 0 });
  const eraNuovo = useRef(false);
  const [categorie, setCategorie] = useState<{ id: string; nome: string }[]>([]);

  //  I nomi delle categorie per il filtro: una lettura sola, all'apertura. Se fallisce il filtro non compare (l'elenco funziona lo stesso).
  const leggiCategorie = negozio.categorie;
  useEffect(() => {
    let vivo = true;
    void leggiCategorie().then((r) => {
      if (!vivo || !r.ok || !Array.isArray(r.dati.categorie)) return;
      setCategorie(elencoCategorie(r.dati.categorie));
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
  const filtrato = segmento !== "tutti" || categoria !== "" || q.trim() !== "";

  //  L'import scrive a gruppi: con l'`esegui` del negozio l'elenco si rileggerebbe dopo OGNI gruppo (fino a 60 letture, e la lista sfarfalla sotto
  //  la finestra). Questo `esegui` manda l'azione e basta; l'elenco si rilegge una volta sola, quando la finestra si chiude.
  //  `scheda` (sola lettura) serve alle foto dell'import (E13): un prodotto già presente che ha già foto si salta.
  const negozioImporta = useMemo(
    () => ({
      esegui: (azione: string, dati?: Record<string, unknown>) =>
        eseguiAzione(fetchCRM, azione, dati),
      scheda: (id: string) => leggiScheda(fetchCRM, id),
    }),
    [],
  );
  //  Tornando dalla scheda nuova il cursore va al tasto «Aggiungi prodotto» (quello che si vede: sul telefono è il tasto fisso), non sul nulla.
  useEffect(() => {
    if (eraNuovo.current && !nuovo)
      [...document.querySelectorAll<HTMLElement>("[data-aggiungi-prodotto]")]
        .find((b) => b.getClientRects().length > 0)
        ?.focus();
    eraNuovo.current = nuovo;
  }, [nuovo]);
  const chiudiImporta = () => {
    setImporta(false);
    void aggiorna();
  };

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
  const tuttiScelti = visibili.length > 0 && visibili.every((r) => scelti.has(r.id));
  const scegliTutti = () => setScelti(tuttiScelti ? new Set() : new Set(visibili.map((r) => r.id)));

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

  const cambiaStato = (stato: AzioneGruppo) =>
    lavora(async () => {
      const ids = selezionati.map((r) => r.id);
      //  Si possono scegliere tutti: al server vanno a pezzi di 20 (il suo tetto), uno dopo l'altro.
      const pezzi = aGruppi(ids);
      const risposte: unknown[] = [];
      for (let k = 0; k < pezzi.length; k++) {
        const r = await esegui("gruppo_stato", { ids: pezzi[k], stato });
        if (!r.ok) {
          //  Quelli già mandati sono fatti; chi non è partito resta scelto, così si riprova solo su di loro.
          const fatti = pezzi.slice(0, k).flat().length;
          setScelti(new Set(pezzi.slice(k).flat()));
          return setEsito({
            tono: "errore",
            riga: fatti
              ? `${r.errore.messaggio} (i primi ${fatti} sono già fatti: restano scelti gli altri)`
              : r.errore.messaggio,
            fuori: [],
          });
        }
        risposte.push(r.dati);
      }
      const rie = riepilogoGruppo(stato, ids, uniscoGruppi(stato, risposte), nomi);
      setEsito({ tono: rie.fuori.length ? "attenzione" : "ok", riga: rie.riga, fuori: rie.fuori });
      setScelti(new Set(rie.fuori.map((f) => f.id))); // chi è rimasto fuori resta selezionato: lo si vede e si sistema
    });

  const duplica = () =>
    lavora(async () => {
      const skuUsati = new Set(prodotti.map((r) => r.sku));
      const slugUsati = new Set(prodotti.map((r) => r.slug));
      const esiti: { id: string; ok: boolean; frase?: string }[] = [];
      let fermo: string | null = null;
      for (const riga of selezionati) {
        if (fermo) {
          esiti.push({ id: riga.id, ok: false, frase: fermo });
          continue;
        }
        let esitoRiga: { id: string; ok: boolean; frase?: string } = { id: riga.id, ok: false };
        //  SKU e indirizzo li conosciamo solo per i prodotti che si vedono: se uno è occupato da un prodotto che non si vede, il server lo dice e si prova col numero dopo.
        for (let prova = 0; prova < 3; prova++) {
          const { sku, slug } = proponiCopia(riga.sku, riga.slug, skuUsati, slugUsati);
          const r = await esegui("prodotto_duplica", { prodottoId: riga.id, sku, slug });
          skuUsati.add(sku);
          slugUsati.add(slug);
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

  /* ── «Aggiungi prodotto»: la scheda vuota prende il posto dell'elenco (che resta com'era: ricerca, filtri, scelte). Non scrive niente. ── */
  if (nuovo)
    return (
      <SchedaNuova
        negozio={negozio}
        apri={(id) => {
          setNuovo(false);
          apri(id);
        }}
        torna={() => setNuovo(false)}
      />
    );

  const tastoNuovo = (
    <Button
      type="button"
      size="sm"
      className="h-8 text-[12px]"
      data-aggiungi-prodotto
      onClick={() => setNuovo(true)}
    >
      <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
      Aggiungi prodotto
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
            className="min-h-9 md:min-h-0"
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
            className="h-11 pl-8 text-[12.5px] md:h-8"
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
            className="h-11 text-[12px] md:h-8"
            onClick={() => void aggiorna()}
            disabled={inAggiornamento}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", inAggiornamento && "animate-spin")}
              aria-hidden="true"
            />
            Aggiorna
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 text-[12px] md:h-8"
            onClick={() => setImporta(true)}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Importa
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
          </span>
          {/* Nel Cestino (E14) si può solo rimettere in bozza: niente Pubblica, Duplica, Elimina. */}
          {segmento === "cestino" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 text-[12px] md:h-8"
              disabled={occupato}
              onClick={() => void cambiaStato("bozza")}
            >
              Rimetti in bozza
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="h-11 text-[12px] md:h-8"
                disabled={occupato}
                onClick={() => void cambiaStato("pubblicato")}
              >
                Pubblica
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 text-[12px] md:h-8"
                disabled={occupato}
                onClick={() => void cambiaStato("bozza")}
              >
                Metti in bozza
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 text-[12px] md:h-8"
                disabled={occupato}
                onClick={() => void duplica()}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Duplica
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 text-[12px] text-rose-800 hover:text-rose-900 md:h-8"
                disabled={occupato}
                onClick={() => setCestino({ aperta: true, n: selezionati.length })}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Elimina
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-11 text-[12px] md:h-8"
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
          testo="Crea il primo con «Aggiungi prodotto»: lo completi con calma, in bozza, e lo pubblichi quando è pronto. Se hai già un catalogo in un file, usa «Importa»."
        />
      ) : visibili.length === 0 && segmento === "cestino" && !q.trim() && !categoria ? (
        <Vuoto icona={Trash2} titolo="Il Cestino è vuoto." />
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
              className="h-11 text-[12px] md:h-8"
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
                  <th scope="col" className="w-10 px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      aria-label="Scegli tutti i prodotti dell'elenco"
                      checked={tuttiScelti}
                      onChange={scegliTutti}
                      className="h-4 w-4 accent-sky-600"
                    />
                  </th>
                  <Intestazione colonna="nome" ordine={ordine} ordinaPer={ordinaPer} larga>
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
                  <th scope="col" className="px-3 py-2 font-medium">
                    Canali
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Giacenza
                  </th>
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
                        <td className="px-3 py-2.5 text-[12px] text-muted-foreground">
                          {etichettaCanali(r.canali)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[12px] tabular-nums">
                          {etichettaGiacenza(r.giacenza)}
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
                          <td colSpan={7} className="px-3 pb-3 pt-1">
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
                        onChange={() => setScelti(alterna(scelti, r.id))}
                        className="h-5 w-5 accent-sky-600"
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => apri(r.id)}
                        className="-my-3 block max-w-full py-3 rounded-md text-left text-[14px] font-medium leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {r.nome}
                      </button>
                      <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                        {r.sku} · {prezzoDaCent(r.prezzoCent)}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {etichettaCanali(r.canali)} · Giacenza: {etichettaGiacenza(r.giacenza)}
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
      <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 md:hidden">
        <Button
          type="button"
          className="h-12 w-full text-[14px] shadow-lg"
          data-aggiungi-prodotto
          onClick={() => setNuovo(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Aggiungi prodotto
        </Button>
      </div>

      <FinestraCestino
        aperta={cestino.aperta}
        n={cestino.n}
        occupato={occupato}
        chiudi={() => setCestino((x) => ({ ...x, aperta: false }))}
        conferma={() =>
          void cambiaStato("archiviato").finally(() => setCestino((x) => ({ ...x, aperta: false })))
        }
      />
      <FinestraImporta
        aperta={importa}
        chiudi={chiudiImporta}
        negozio={negozioImporta}
        apriProdotto={(id) => {
          void aggiorna();
          apri(id);
        }}
        vaiAiProdotti={chiudiImporta}
      />
    </div>
  );
}

/* ══ PEZZI PICCOLI ══════════════════════════════════════════════════════════ */

/** «Elimina» chiede prima (E14): i prodotti vanno nel Cestino (stato «archiviato»), non si cancella niente (D5).
 *  Mentre si scrive la finestra non si chiude (né Esc, né clic fuori, né la X) e i due tasti sono spenti. */
function FinestraCestino({
  aperta,
  n,
  occupato,
  chiudi,
  conferma,
}: {
  aperta: boolean;
  n: number;
  occupato: boolean;
  chiudi: () => void;
  conferma: () => void;
}) {
  return (
    <Dialog open={aperta} onOpenChange={(v) => !v && !occupato && chiudi()}>
      <DialogContent className="crm-theme bg-white text-foreground">
        <DialogHeader>
          <DialogTitle>
            {n === 1 ? "Spostare 1 prodotto nel Cestino?" : `Spostare ${n} prodotti nel Cestino?`}
          </DialogTitle>
          <DialogDescription>
            {n === 1
              ? "Sparisce dal sito e dall'elenco. Non si cancella niente: lo ritrovi nel Cestino e lo puoi rimettere in bozza."
              : "Spariscono dal sito e dall'elenco. Non si cancella niente: li ritrovi nel Cestino e li puoi rimettere in bozza."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 text-[13px] md:h-9"
            disabled={occupato}
            onClick={chiudi}
          >
            Annulla
          </Button>
          <Button
            type="button"
            className="h-11 text-[13px] md:h-9"
            disabled={occupato}
            onClick={conferma}
          >
            Sposta nel Cestino
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Intestazione({
  colonna,
  ordine,
  ordinaPer,
  destra,
  larga,
  children,
}: {
  colonna: Colonna;
  ordine: { colonna: Colonna; direzione: Direzione };
  ordinaPer: (c: Colonna) => void;
  destra?: boolean;
  larga?: boolean;
  children: ReactNode;
}) {
  const attiva = ordine.colonna === colonna;
  const Freccia = ordine.direzione === "su" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={attiva ? (ordine.direzione === "su" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 font-medium", destra && "text-right", larga && "w-[38%]")}
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
    <Button size="sm" variant="outline" className="h-11 text-[12px] md:h-8" onClick={riprova}>
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
            className="h-7 w-20 animate-pulse motion-reduce:animate-none rounded-lg border border-border bg-muted/50"
          />
        ))}
      </div>
      <div
        className="flex flex-col gap-px overflow-hidden rounded-xl border border-border"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse motion-reduce:animate-none bg-muted/50" />
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
    <div className="flex max-w-2xl flex-col gap-2">
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
      <span className="min-w-0 basis-56 text-[12.5px]">
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
          className="h-11 w-20 text-right text-[12.5px] tabular-nums md:h-8"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-11 text-[12px] md:h-8"
          disabled={!valido || invio}
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
