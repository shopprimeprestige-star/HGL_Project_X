/** ── /CRM/ecommerce — GLI ORDINI DELLO SHOP ────────────────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce, T11 (SPEC §3). Il GUSCIO: titolo, schede, periodo, avvisi. Non calcola niente (i conti
 *  sono `crm/ecommerce/conti.ts`) e non parla col database (gli ordini arrivano da `/api/crm/ordini` tramite `useOrdini`).
 *
 *  ── UNA LETTURA SOLA, UN PERIODO SOLO ─────────────────────────────────────────
 *  `useOrdini()` si chiama qui, UNA volta: ogni chiamata ha il suo archivio e la sua rilettura, e due schede con due letture
 *  potrebbero dire due cose diverse sullo stesso ordine. Il periodo è uno stato di questa pagina e vale per tutte le schede:
 *  la Panoramica e (T12) l'elenco ricevono lo stesso `Periodo` e lo applicano con `nelPeriodo` di `conti.ts`, così una cifra
 *  coincide sempre con le righe che si vedono aprendola.
 *
 *  ── CHI NON PUÒ, NON VEDE NIENTE ──────────────────────────────────────────────
 *  La voce di menu e la pagina vogliono «pagamenti» (permessi.ts). Ma il rifiuto vero lo dà la rotta: se la lettura risponde
 *  «permesso» o «sessione» NON si mostra quello che era già in memoria da una lettura precedente (a chi ha perso il permesso
 *  nome, telefono e indirizzo non devono restare a schermo).
 *
 *  ── LE SCHEDE SONO NELL'INDIRIZZO ─────────────────────────────────────────────
 *  `?scheda=ordini&stato=nuovo`: l'indirizzo si può condividere e il clic su uno stato della Panoramica porta all'elenco già
 *  filtrato. «Clienti» e «Da collegare» (SPEC §3.2) arrivano con i rilasci successivi: finché non ci sono non hanno linguetta.
 *
 *  ── LA LINGUETTA «PRODOTTI» (Shop completo, T14) ───────────────────────────────
 *  `?scheda=prodotti` è l'elenco del catalogo, `?scheda=prodotti&id=<id>` la scheda di un prodotto (T15). Il catalogo si legge
 *  SOLO lì: `useNegozio()` sta in `LinguettaProdotti`, che si disegna solo con quella scheda e dopo il «return» di chi non ha il
 *  permesso. Panoramica e Ordini non fanno nessuna lettura del CMS. Il periodo e «Aggiorna» della pagina sono degli ordini: nella
 *  linguetta dei prodotti non compaiono. Il permesso è quello della pagina (`pagamenti`, permessi.ts); il rifiuto vero lo dà la rotta. */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, RefreshCw, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarraAzioni, Pagina, Titolo, Vuoto, dataBreve } from "@/crm/ui";
import { DateRangeFilter, type DateRange } from "@/crm/DateRangeFilter";
import { useOrdini } from "@/crm/ecommerce/useOrdini";
import { oraHHmm } from "@/crm/ecommerce/client";
import {
  AVVISO_MIGRAZIONE,
  RANGE_TUTTO,
  leggiRicerca,
  periodoDaRange,
  rangeDiPartenza,
  type RicercaEcommerce,
} from "@/crm/ecommerce/pagina";
import { MAX_ORDINI_LETTI } from "@/crm/ecommerce/ordine";
import { Avviso } from "@/crm/ecommerce/Avviso";
import { Panoramica } from "@/crm/ecommerce/Panoramica";
import { ElencoOrdini } from "@/crm/ecommerce/ElencoOrdini";
import type { StatoOrdine } from "@/crm/ecommerce/ordine";
import { useNegozio } from "@/crm/negozio/useNegozio";
import { ElencoProdotti } from "@/crm/ecommerce/prodotti/ElencoProdotti";
import { SchedaProdotto } from "@/crm/ecommerce/prodotti/SchedaProdotto";
import { Categorie } from "@/crm/ecommerce/prodotti/Categorie";
import { ApriShop } from "@/crm/ecommerce/prodotti/ApriShop";

/** L'indirizzo della pagina: quello di T11 (Panoramica e Ordini) più `?scheda=prodotti` con l'`id` del prodotto aperto. */
type RicercaPagina = Omit<RicercaEcommerce, "scheda"> & { scheda?: "ordini" | "prodotti"; id?: string };
/** Come l'id valido per il server: lettere, numeri e trattini. Chi scrive a mano un id storto trova l'elenco. */
const ID_PRODOTTO = /^[A-Za-z0-9-]{1,64}$/;
function leggiRicercaPagina(raw: Record<string, unknown>): RicercaPagina {
  if (raw.scheda !== "prodotti") return leggiRicerca(raw);
  return typeof raw.id === "string" && ID_PRODOTTO.test(raw.id) ? { scheda: "prodotti", id: raw.id } : { scheda: "prodotti" };
}

export const Route = createFileRoute("/CRM/ecommerce")({
  head: () => ({ meta: [{ title: "E-commerce — CRM" }] }),
  validateSearch: (raw: Record<string, unknown>): RicercaPagina => leggiRicercaPagina(raw),
  component: PaginaEcommerce,
});

/** Le linguette: la riga di sotto dice cosa si trova, in poche parole (come nei KPI). */
const LINGUETTE = [
  { scheda: undefined, titolo: "Panoramica", domanda: "Come sta andando lo shop" },
  { scheda: "ordini", titolo: "Ordini", domanda: "Stato, pagamenti, spedizioni" },
  { scheda: "prodotti", titolo: "Prodotti", domanda: "Catalogo, giacenze, pubblicazione" },
] as const;

/** «dal 20 ott al 18 nov», «solo il 5 nov», con «Tutto lo storico» davanti se non c'è nessuna data. */
function descriviPeriodo(range: DateRange, da: string, a: string): string {
  const g = (x: string) => dataBreve(`${x}T12:00:00`);
  const giorni = da === a ? `solo il ${g(da)}` : `dal ${g(da)} al ${g(a)}`;
  return range.from || range.to ? giorni : `Tutto lo storico · ${giorni}`;
}

function PaginaEcommerce() {
  const ricerca = Route.useSearch();
  const navigate = Route.useNavigate();
  const lettura = useOrdini();
  const [range, setRange] = useState<DateRange>(() => rangeDiPartenza(new Date()));
  //  «Adesso» cambia a ogni lettura, non a ogni disegno: i conti restano fermi finché non arrivano dati nuovi.
  const adesso = useMemo(() => new Date(), [lettura.ultimoAggiornamento]); // eslint-disable-line react-hooks/exhaustive-deps
  const periodo = useMemo(
    () => periodoDaRange(range, lettura.ordini, adesso),
    [range, lettura.ordini, adesso],
  );

  const scheda = ricerca.scheda ?? "panoramica";
  const bloccato = lettura.errore?.tipo === "permesso" || lettura.errore?.tipo === "sessione";
  const aggiorna = () => void lettura.aggiorna();
  //  Dagli «ordini fermi» (di sempre) si apre l'elenco su «Tutto»: con i 30 giorni di partenza la cifra e le righe non coinciderebbero.
  const apriStato = (stato: StatoOrdine, opzioni?: { tutto?: boolean }) => {
    if (opzioni?.tutto) setRange(RANGE_TUTTO);
    void navigate({ search: { scheda: "ordini", stato } });
  };
  const imposta = (p: { stato?: StatoOrdine; ordine?: string }) =>
    void navigate({ search: (prev) => ({ ...prev, ...p }), replace: true });

  const azioni = (
    <>
      {lettura.ultimoAggiornamento !== null && !bloccato && (
        <span className="text-[11px] text-muted-foreground">
          Aggiornato alle {oraHHmm(lettura.ultimoAggiornamento)}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-[12px]"
        onClick={aggiorna}
        disabled={lettura.inAggiornamento}
      >
        <RefreshCw
          className={cn("mr-1.5 h-3.5 w-3.5", lettura.inAggiornamento && "animate-spin")}
          aria-hidden="true"
        />
        Aggiorna
      </Button>
    </>
  );

  //  ── Senza diritto: solo la frase, nessun dato (nemmeno quello di una lettura precedente) ──
  if (bloccato && lettura.errore) {
    return (
      <Pagina>
        <Titolo testo="E-commerce" icona={ShoppingBag} />
        <Vuoto
          icona={Lock}
          titolo={
            lettura.errore.tipo === "sessione"
              ? "La sessione è scaduta"
              : "Gli ordini non sono per te"
          }
          testo={lettura.errore.messaggio}
          azione={
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={aggiorna}>
              Riprova
            </Button>
          }
        />
      </Pagina>
    );
  }

  return (
    <Pagina larga>
      <Titolo
        testo="E-commerce"
        icona={ShoppingBag}
        nota={scheda === "prodotti" ? "I prodotti dello shop" : "Gli ordini dello shop"}
        azioni={scheda === "prodotti" ? undefined : azioni}
      />

      <nav aria-label="Sezioni dell'e-commerce" className="grid grid-cols-3 gap-1.5 md:max-w-2xl">
        {LINGUETTE.map((l) => {
          const attiva = (l.scheda ?? "panoramica") === scheda;
          return (
            <Link
              key={l.titolo}
              to="/CRM/ecommerce"
              search={l.scheda ? { scheda: l.scheda } : {}}
              aria-current={attiva ? "page" : undefined}
              className={cn(
                "relative block rounded-lg border px-3 py-2 pl-4 text-left transition",
                attiva
                  ? "border-border bg-card shadow-sm"
                  : "border-transparent bg-muted hover:bg-accent",
              )}
            >
              {attiva && (
                <span className="pointer-events-none absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-sky-500" />
              )}
              <span
                className={cn(
                  "block truncate text-[13px] leading-tight",
                  attiva ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                {l.titolo}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {l.domanda}
              </span>
            </Link>
          );
        })}
      </nav>

      {scheda === "prodotti" ? (
        //  Il catalogo: qui e solo qui si legge il CMS (vedi la nota in cima al file).
        <LinguettaProdotti
          id={ricerca.id}
          apri={(id) => void navigate({ search: id ? { scheda: "prodotti", id } : { scheda: "prodotti" } })}
        />
      ) : (
        <>
      {/*  Il periodo vale per tutte le schede. Non è appiccicato in alto: sul telefono il filtro occupa più righe e coprirebbe la pagina. */}
      <BarraAzioni fissa={false} className="flex-col items-stretch gap-1.5">
        <DateRangeFilter value={range} onChange={setRange} />
        <p className="text-[11px] text-muted-foreground">
          Periodo: {descriviPeriodo(range, periodo.da, periodo.a)}. Vale per tutte le schede.
        </p>
      </BarraAzioni>

      {lettura.caricato ? (
        <>
          {/*  ── Gli avvisi: quello che chi legge le cifre deve sapere ── */}
          {lettura.errore && (
            <Avviso
              errore
              azione={
                <Button size="sm" variant="outline" className="h-7 text-[12px]" onClick={aggiorna}>
                  Riprova
                </Button>
              }
            >
              {lettura.errore.messaggio} Quello che vedi è l'ultima lettura riuscita
              {lettura.ultimoAggiornamento !== null
                ? `, delle ${oraHHmm(lettura.ultimoAggiornamento)}`
                : ""}
              .
            </Avviso>
          )}
          {lettura.migrazionePronta === false && (
            <Avviso>
              Il database non è ancora pronto per gestire gli ordini: si vedono, ma stato, pagamenti
              e note non si possono modificare. {AVVISO_MIGRAZIONE}
            </Avviso>
          )}
          {lettura.scartati > 0 && (
            <Avviso>
              {lettura.scartati === 1
                ? "1 riga della tabella ordini non si può leggere e non è"
                : `${lettura.scartati} righe della tabella ordini non si possono leggere e non sono`}{" "}
              nelle cifre.
            </Avviso>
          )}
          {lettura.troncato && (
            <Avviso>
              Gli ordini sono moltissimi: si leggono solo i più recenti (fino a{" "}
              {MAX_ORDINI_LETTI.toLocaleString("it-IT")}). Le cifre dei periodi più lontani possono
              essere incomplete.
            </Avviso>
          )}
          {periodo.da > periodo.a && (
            <Avviso>La data di inizio viene dopo quella di fine: scegli un periodo valido.</Avviso>
          )}

          {scheda === "panoramica" ? (
            <Panoramica lettura={lettura} periodo={periodo} adesso={adesso} apriStato={apriStato} />
          ) : (
            <ElencoOrdini
              lettura={lettura}
              periodo={periodo}
              stato={ricerca.stato}
              ordine={ricerca.ordine}
              migrazionePronta={lettura.migrazionePronta}
              imposta={imposta}
              esegui={lettura.esegui}
              storico={lettura.storico}
            />
          )}
        </>
      ) : lettura.errore ? (
        //  Prima lettura fallita: niente da mostrare, solo il modo di riprovare.
        <Vuoto
          titolo="Non riesco a leggere gli ordini"
          testo={lettura.errore.messaggio}
          azione={
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={aggiorna}>
              Riprova
            </Button>
          }
        />
      ) : (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Carico gli ordini…</span>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-xl border border-border bg-muted/50"
              />
            ))}
          </div>
          <div
            className="h-40 animate-pulse rounded-xl border border-border bg-muted/50"
            aria-hidden="true"
          />
        </div>
      )}
        </>
      )}
    </Pagina>
  );
}

/** ── LA LINGUETTA «PRODOTTI» ────────────────────────────────────────────────────
 *  Crea l'archivio del negozio UNA volta (una lettura, una rilettura ogni 30 s) e lo passa alle schermate di `prodotti/`.
 *  Con un `id` apre la scheda di quel prodotto (T15) sotto il link «Tutti i prodotti»; senza, «Apri lo shop» (T17, se è spento),
 *  l'elenco e le categorie (T17). Si disegna solo con `?scheda=prodotti`: nessun'altra linguetta legge il catalogo. */
function LinguettaProdotti({ id, apri }: { id?: string; apri: (id: string | null) => void }) {
  const negozio = useNegozio();
  //  Sale a ogni modifica delle categorie: l'elenco rilegge i nomi del suo filtro.
  const [categorieAggiornate, setCategorieAggiornate] = useState(0);
  if (id)
    return (
      <div className="flex flex-col gap-3">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 min-h-11 text-[12.5px] sm:min-h-8"
            onClick={() => apri(null)}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Tutti i prodotti
          </Button>
        </div>
        <SchedaProdotto id={id} negozio={negozio} apri={apri} />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <ApriShop negozio={negozio} />
      <ElencoProdotti negozio={negozio} apri={apri} categorieAggiornate={categorieAggiornate} />
      <Categorie
        negozio={negozio}
        cambiate={() => {
          setCategorieAggiornate((n) => n + 1);
          void negozio.aggiorna();
        }}
      />
    </div>
  );
}
