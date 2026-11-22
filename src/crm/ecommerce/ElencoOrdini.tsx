/** ── LA SCHEDA «ORDINI» (ElencoOrdini.tsx) ─────────────────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce, T12 (SPEC §3.2). Ricerca, filtri, una riga per ordine con lo stato cambiabile, e il
 *  pannello di dettaglio (`DettaglioOrdine`). Le regole (quali ordini, che conferma, che frase) sono in `ordini-ui.ts`,
 *  provate; qui si disegna e si orchestra.
 *
 *  ── LE REGOLE DEL GUSCIO, RISPETTATE ──────────────────────────────────────────
 *   · `lettura.ordini` è LO STESSO elenco della Panoramica: il periodo si applica con `nelPeriodo` (dentro `filtraOrdini`).
 *   · `stato` e `ordine` vengono dall'indirizzo; `imposta` li cambia senza lasciare la scheda. L'ordine aperto si trova per
 *     `id` fra TUTTI gli ordini letti (anche fuori periodo: il link può venire da un'altra pagina).
 *   · `migrazionePronta !== true` = comandi spenti, col motivo.
 *   · Le azioni passano tutte da `esegui` (`useOrdini`) in UN punto solo (`lancia`), una alla volta, e se ne legge l'esito:
 *     conflitto, storico mancato, migrazione, errore. «Annullato» come stato e «Annulla pagamento» chiedono conferma.
 *
 *  ── RILASCIO 2 (T63, SPEC 8A n. 1 e 7) ────────────────────────────────────────
 *   · Sulla riga: lo stato di pagamento («In attesa», «Scaduto», «Rimborsato…»), «PROVA», «Fattura da fare», «Giacenza da verificare»,
 *     e «Cassa nuova» per gli ordini del sito. Gli ordini di prima si leggono come oggi: «Pagato» / «Non pagato» e nient'altro.
 *   · Filtri nuovi: canale, pagamento, «Fattura da fare», «Giacenza da verificare», «Mostra ordini di prova». Si traducono nei filtri di
 *     `ordini-ui` con `filtriR2`: con le scelte vuote non aggiungono NIENTE, quindi la lista è quella di oggi (anche gli ordini di prova si vedono).
 *   · I numeri accanto ai filtri non contano gli ordini in attesa, scaduti o non riusciti (come il numeretto del menu): restano in lista col loro
 *     badge e la pagina lo dice, invece di far tornare male i conti.
 *  ⚠️ Nessun log: gli ordini contengono nome, telefono e indirizzo dei clienti. Nella lista nessun dato fiscale: solo il segno «Fattura da fare». */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarraAzioni, Chip, Segmento, Vuoto, plurale } from "@/crm/ui";
import type { Tono } from "@/crm/ui";
import { importoFuoriNorma } from "./conti";
import type { Periodo } from "./conti";
import type { Azione } from "./azioni";
import type { RisultatoAzione, RisultatoStorico, StatoOrdini } from "./client";
import { ETICHETTA_STATO, STATI_ORDINE, nomeCliente } from "./ordine";
import type { Ordine, StatoOrdine } from "./ordine";
import {
  PAGINA_RIGHE,
  comandiAttivi,
  conteggiPerStato,
  dataOra,
  esitoAzione,
  filtraOrdini,
  ordineDaId,
  serveConferma,
  testoConferma,
  unaPerVolta,
} from "./ordini-ui";
import type { Esito, Filtri, FiltroPagato } from "./ordini-ui";
import { statoEffettivo } from "./pagamento";
import type { StatoPagamento } from "./pagamento";
import { AVVISO_MIGRAZIONE, euro } from "./pagina";
import { DettaglioOrdine, MessaggioEsito, classeMenuStato } from "./DettaglioOrdine";

export interface PropsElencoOrdini {
  lettura: Pick<StatoOrdini, "ordini">;
  periodo: Periodo;
  /** Dall'indirizzo: il filtro scelto con un clic sulla Panoramica. */
  stato?: StatoOrdine;
  /** Dall'indirizzo: l'ordine con il dettaglio aperto (il suo `id`). */
  ordine?: string;
  /** `false` = mancano le colonne nuove del database: nessuna azione. `null` = non si è ancora letto. */
  migrazionePronta: boolean | null;
  /** Cambia stato e ordine nell'indirizzo, restando sulla scheda. */
  imposta?: (p: { stato?: StatoOrdine; ordine?: string }) => void;
  /** Da `useOrdini`: manda un'azione alla rotta. Sostituisce l'ordine nell'elenco e rilegge da solo su conflitto. */
  esegui: (azione: Azione) => Promise<RisultatoAzione>;
  storico: (ordineId: string) => Promise<RisultatoStorico>;
  /** L'istante di «adesso» (serve a leggere «scaduto», D52). Se manca si prende al momento in cui arrivano gli ordini. */
  adesso?: Date;
}

const SCELTE_PAGATO: { valore: FiltroPagato | undefined; testo: string }[] = [
  { valore: undefined, testo: "Tutti" },
  { valore: "si", testo: "Pagati" },
  { valore: "no", testo: "Non pagati" },
];

// ── i filtri nuovi del Rilascio 2 ──────────────────────────────────────────

/** Le scelte dei filtri nuovi. Vuote = nessun filtro in più. */
export interface SceltaFiltriR2 {
  canale?: "sito" | "vecchio";
  statoPagamento?: StatoPagamento;
  fatturaDaFare: boolean;
  giacenzaDaVerificare: boolean;
  /** Il predefinito è «sì»: gli ordini di prova si vedono (col badge), come ogni altro ordine di oggi. */
  mostraProva: boolean;
}
export const SCELTE_R2_VUOTE: SceltaFiltriR2 = {
  fatturaDaFare: false,
  giacenzaDaVerificare: false,
  mostraProva: true,
};

/** Le scelte → i filtri di `ordini-ui`. Con le scelte vuote è `{}`: la lista è identica a quella di prima. */
export function filtriR2(s: SceltaFiltriR2, adesso: Date): Partial<Filtri> {
  const f: Partial<Filtri> = {};
  if (s.canale) f.canale = s.canale;
  if (s.statoPagamento) {
    f.statoPagamento = s.statoPagamento;
    f.adesso = adesso;
  }
  if (s.fatturaDaFare) f.fatturaDaFare = true;
  if (s.giacenzaDaVerificare) f.giacenzaDaVerificare = true;
  if (!s.mostraProva) f.mostraProva = false;
  return f;
}

/** Il badge di pagamento sulla riga. Per gli ordini di prima (`pagato` / `da_incassare`) è quello di sempre. */
const BADGE_PAGAMENTO: Record<StatoPagamento, { testo: string; tono: Tono }> = {
  pagato: { testo: "Pagato", tono: "vinta" },
  da_incassare: { testo: "Non pagato", tono: "neutro" },
  in_attesa: { testo: "In attesa", tono: "da_lavorare" },
  scaduto: { testo: "Scaduto", tono: "neutro" },
  fallito: { testo: "Non riuscito", tono: "persa" },
  rimborsato_in_parte: { testo: "Rimborsato in parte", tono: "in_corso" },
  rimborsato: { testo: "Rimborsato", tono: "neutro" },
};
/** Chi non ha (ancora o mai) pagato: i numeri accanto ai filtri e il numeretto del menu non li contano. */
const NON_PAGATI: readonly StatoPagamento[] = ["in_attesa", "scaduto", "fallito"];
/** Come in `ordini-ui` (filtro «Fattura da fare»): richiesta e non ancora emessa. Qui serve solo al segno sulla riga. */
const fatturaDaFare = (o: Ordine): boolean => o.fatturaRichiesta && o.fatturaEmessaIl === null;

//  Chip e non menu a tendina: la scheda ha già un menu per ogni riga (lo stato dell'ordine) e così le scelte si vedono tutte insieme.
const SCELTE_CANALE: { valore: SceltaFiltriR2["canale"]; testo: string }[] = [
  { valore: undefined, testo: "Tutti" },
  { valore: "sito", testo: "Cassa nuova" },
  { valore: "vecchio", testo: "Prima della cassa nuova" },
];
const SCELTE_PAGAMENTO: { valore: StatoPagamento | undefined; testo: string }[] = [
  { valore: undefined, testo: "Tutti" },
  { valore: "in_attesa", testo: "In attesa" },
  { valore: "scaduto", testo: "Scaduto" },
  { valore: "fallito", testo: "Non riuscito" },
  { valore: "pagato", testo: "Pagato" },
  { valore: "rimborsato_in_parte", testo: "Rimborsato in parte" },
  { valore: "rimborsato", testo: "Rimborsato" },
  { valore: "da_incassare", testo: "Da incassare" },
];

export function ElencoOrdini({
  lettura,
  periodo,
  stato,
  ordine,
  migrazionePronta,
  imposta,
  esegui,
  storico,
  adesso,
}: PropsElencoOrdini) {
  const [ricerca, setRicerca] = useState("");
  const [pagato, setPagato] = useState<FiltroPagato | undefined>(undefined);
  const [scelte, setScelte] = useState<SceltaFiltriR2>(SCELTE_R2_VUOTE);
  const idProva = useId();
  const [visibili, setVisibili] = useState(PAGINA_RIGHE);
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [conferma, setConferma] = useState<{ azione: Azione; ordine: Ordine } | null>(null);
  const ultimaRiga = useRef<HTMLElement | null>(null);
  const comandi = comandiAttivi(migrazionePronta);

  //  «Adesso» cambia quando arrivano ordini nuovi, non a ogni disegno: serve solo a leggere «scaduto».
  // eslint-disable-next-line react-hooks/exhaustive-deps -- l'istante si rinnova con la lettura degli ordini
  const ora = useMemo(() => adesso ?? new Date(), [adesso, lettura.ordini]);
  const nuovi = useMemo(() => filtriR2(scelte, ora), [scelte, ora]);
  const righe = useMemo(
    () => filtraOrdini(lettura.ordini, { periodo, stato, pagato, ricerca, ...nuovi }),
    [lettura.ordini, periodo, stato, pagato, ricerca, nuovi],
  );
  const conteggi = useMemo(
    () => conteggiPerStato(lettura.ordini, { periodo, pagato, ricerca, ...nuovi }),
    [lettura.ordini, periodo, pagato, ricerca, nuovi],
  );
  const aperto = ordineDaId(lettura.ordini, ordine);

  //  Una riga di conferma che resta a schermo è rumore: dopo qualche secondo se ne va. Gli avvisi e gli errori restano.
  useEffect(() => {
    if (esito?.tono !== "ok") return;
    const t = setTimeout(() => setEsito(null), 5000);
    return () => clearTimeout(t);
  }, [esito]);

  /** L'UNICO punto che parla con la rotta. Una azione per volta (`unaPerVolta`: un secondo clic mentre la prima lavora non parte);
   *  `true` = riuscita. L'`esegui` si legge dal riferimento: la funzione si crea una volta sola, la prop può cambiare. */
  const eseguiRef = useRef(esegui);
  eseguiRef.current = esegui;
  const lancia = useRef(
    unaPerVolta(async (azione: Azione, ref: string): Promise<boolean> => {
      setOccupato(true);
      setEsito(null);
      try {
        const r = await eseguiRef.current(azione);
        setEsito(esitoAzione(r, azione, ref));
        return r.ok;
      } catch {
        setEsito({
          tono: "errore",
          testo: "Qualcosa non ha funzionato: aggiorna l'elenco e controlla l'ordine.",
        });
        return false;
      } finally {
        setOccupato(false);
      }
    }),
  ).current;

  /** Le azioni gravi (annullare l'ordine, annullare il pagamento) passano da una conferma; le altre partono. */
  const chiedi = (azione: Azione, o: Ordine): Promise<boolean> => {
    if (serveConferma(azione)) {
      setConferma({ azione, ordine: o });
      return Promise.resolve(false);
    }
    return lancia(azione, o.ref);
  };
  const confermata = () => {
    const c = conferma;
    setConferma(null);
    if (c) void lancia(c.azione, c.ordine.ref);
  };

  const scegliStato = (s: StatoOrdine | undefined) => {
    setVisibili(PAGINA_RIGHE);
    imposta?.({ stato: s });
  };
  const scegli = (p: Partial<SceltaFiltriR2>) => {
    setScelte((s) => ({ ...s, ...p }));
    setVisibili(PAGINA_RIGHE);
  };
  const togliFiltri = () => {
    setRicerca("");
    setPagato(undefined);
    setScelte(SCELTE_R2_VUOTE);
    scegliStato(undefined);
  };
  const apri = (o: Ordine, el: HTMLElement) => {
    ultimaRiga.current = el;
    setEsito(null);
    imposta?.({ ordine: o.id });
  };
  const chiudi = () => {
    setEsito(null);
    imposta?.({ ordine: undefined });
  };

  const testoConf = conferma ? testoConferma(conferma.azione, conferma.ordine) : null;
  const mostrate = righe.slice(0, visibili);
  const filtrato = !!(stato || pagato || ricerca.trim() || Object.keys(nuovi).length > 0);
  //  Righe che si vedono ma non sono nei numeri accanto ai filtri: se si sceglie un pagamento, i numeri le contano e la nota non serve.
  const nonPagati = scelte.statoPagamento
    ? 0
    : righe.filter((o) => NON_PAGATI.includes(statoEffettivo(o, ora))).length;

  return (
    <div className="flex flex-col gap-3">
      {/* ── RICERCA E FILTRI ─────────────────────────────────────────────────── */}
      <BarraAzioni fissa={false} className="flex-col items-stretch gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={ricerca}
            onChange={(e) => {
              setRicerca(e.target.value);
              setVisibili(PAGINA_RIGHE);
            }}
            aria-label="Cerca ordini per nome, email, telefono o numero ordine"
            placeholder="Cerca per nome, email, telefono o numero ordine"
            autoComplete="off"
            className="min-h-11 pl-8 text-[13px] sm:min-h-9"
          />
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtra per stato"
        >
          <Segmento
            attivo={!stato}
            onClick={() => scegliStato(undefined)}
            conteggio={conteggi.tutti}
          >
            Tutti
          </Segmento>
          {STATI_ORDINE.map((s) => (
            <Segmento
              key={s}
              attivo={stato === s}
              onClick={() => scegliStato(s)}
              conteggio={conteggi[s]}
            >
              {ETICHETTA_STATO[s]}
            </Segmento>
          ))}
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtra per pagamento"
        >
          {SCELTE_PAGATO.map((p) => (
            <Segmento
              key={p.testo}
              attivo={pagato === p.valore}
              onClick={() => {
                setPagato(p.valore);
                setVisibili(PAGINA_RIGHE);
              }}
            >
              {p.testo}
            </Segmento>
          ))}
        </div>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
          role="group"
          aria-label="Altri filtri"
        >
          <ScelteUna
            nome="Canale"
            scelte={SCELTE_CANALE}
            valore={scelte.canale}
            onScegli={(canale) => scegli({ canale })}
          />
          <ScelteUna
            nome="Pagamento"
            scelte={SCELTE_PAGAMENTO}
            valore={scelte.statoPagamento}
            onScegli={(statoPagamento) => scegli({ statoPagamento })}
          />
          <Segmento
            attivo={scelte.fatturaDaFare}
            onClick={() => scegli({ fatturaDaFare: !scelte.fatturaDaFare })}
          >
            Fattura da fare
          </Segmento>
          <Segmento
            attivo={scelte.giacenzaDaVerificare}
            onClick={() => scegli({ giacenzaDaVerificare: !scelte.giacenzaDaVerificare })}
          >
            Giacenza da verificare
          </Segmento>
          <label
            htmlFor={idProva}
            className="flex items-center gap-2 text-[12px] text-muted-foreground"
          >
            <Switch
              id={idProva}
              checked={scelte.mostraProva}
              onCheckedChange={(v) => scegli({ mostraProva: v })}
            />
            Mostra ordini di prova
          </label>
        </div>
      </BarraAzioni>

      {!comandi && (
        <p className="text-[11.5px] text-muted-foreground">Comandi spenti: {AVVISO_MIGRAZIONE}</p>
      )}
      {!aperto && <MessaggioEsito esito={esito} />}

      {/* ── L'ELENCO ─────────────────────────────────────────────────────────── */}
      {lettura.ordini.length === 0 ? (
        <Vuoto
          icona={PackageSearch}
          titolo="Nessun ordine, per ora"
          testo="Quando qualcuno ordina dallo shop, l'ordine compare qui."
        />
      ) : righe.length === 0 ? (
        <Vuoto
          icona={PackageSearch}
          titolo={filtrato ? "Nessun ordine con questi filtri" : "Nessun ordine in questo periodo"}
          testo={
            filtrato
              ? "Prova a togliere un filtro o a cambiare il periodo in alto."
              : `Cambia il periodo in alto: in tutto ci sono ${plurale(lettura.ordini.length, "ordine", "ordini")}.`
          }
          azione={
            filtrato ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={togliFiltri}
              >
                Togli i filtri
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-[12px] text-muted-foreground" aria-live="polite">
            {plurale(righe.length, "ordine", "ordini")}
            {righe.length > mostrate.length ? ` · se ne vedono ${mostrate.length}` : ""}
          </p>
          {nonPagati > 0 && (
            <p className="-mt-2 text-[11.5px] leading-snug text-muted-foreground">
              {nonPagati === 1 ? "1 ordine non è" : `${nonPagati} ordini non sono`} ancora pagati
              (in attesa, scaduti o non riusciti): non sono nei numeri accanto ai filtri né nel
              numeretto del menu.
            </p>
          )}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {mostrate.map((o) => {
              const fuori = importoFuoriNorma(o);
              return (
                <li
                  key={o.id}
                  data-riga=""
                  className="flex flex-col gap-2 px-3 py-2.5 hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-3"
                >
                  <button
                    type="button"
                    aria-label={`Apri ordine ${o.ref}, ${nomeCliente(o)}`}
                    onClick={(e) => apri(o, e.currentTarget)}
                    className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-md text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium tabular-nums sm:w-28">{o.ref}</span>
                    <span className="text-[12px] text-muted-foreground sm:w-28">
                      {dataOra(o.creatoIl)}
                    </span>
                    <span className="min-w-0 basis-full truncate sm:basis-0 sm:flex-1">
                      {nomeCliente(o)}
                    </span>
                    <span
                      className={
                        fuori
                          ? "text-amber-800 sm:w-28 sm:text-right"
                          : "tabular-nums sm:w-28 sm:text-right"
                      }
                    >
                      {fuori ? "importo fuori norma" : euro(o.totale)}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <BadgePagamento ordine={o} adesso={ora} />
                      {o.prova && (
                        <Chip tono="in_sospeso" title="Ordine di prova: non conta nelle cifre">
                          PROVA
                        </Chip>
                      )}
                      {fatturaDaFare(o) && <Chip tono="in_corso">Fattura da fare</Chip>}
                      {o.giacenzaDaVerificare && <Chip tono="persa">Giacenza da verificare</Chip>}
                      {o.canale === "sito" && (
                        <span className="text-[11.5px] text-muted-foreground">Cassa nuova</span>
                      )}
                    </span>
                  </button>
                  <select
                    aria-label={`Stato ordine ${o.ref}`}
                    value={o.stato}
                    disabled={!comandi || occupato}
                    onChange={(e) =>
                      void chiedi(
                        {
                          azione: "stato",
                          ordineId: o.id,
                          da: o.stato,
                          a: e.target.value as StatoOrdine,
                        },
                        o,
                      )
                    }
                    className={cn(classeMenuStato(o.stato), "self-start sm:self-auto")}
                  >
                    {STATI_ORDINE.map((s) => (
                      <option key={s} value={s}>
                        {ETICHETTA_STATO[s]}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
          {righe.length > mostrate.length && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-[12.5px] sm:min-h-8"
                onClick={() => setVisibili((v) => v + PAGINA_RIGHE)}
              >
                Mostra altri {Math.min(PAGINA_RIGHE, righe.length - mostrate.length)}
              </Button>
            </div>
          )}
        </>
      )}

      {/* ── IL DETTAGLIO ─────────────────────────────────────────────────────── */}
      <DettaglioOrdine
        ordine={aperto}
        mancante={!!ordine && !aperto}
        onChiudi={chiudi}
        ultimaRiga={ultimaRiga}
        comandi={comandi}
        occupato={occupato}
        esito={esito}
        chiedi={(a) => (aperto ? chiedi(a, aperto) : Promise.resolve(false))}
        storico={storico}
      />

      {/*  La conferma è una finestra vera: «Torna indietro» prende il fuoco, il tasto che annulla non è mai il predefinito. */}
      <AlertDialog open={!!conferma} onOpenChange={(v) => !v && setConferma(null)}>
        <AlertDialogContent className="crm-theme bg-white text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>{testoConf?.titolo}</AlertDialogTitle>
            <AlertDialogDescription>{testoConf?.testo}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Torna indietro</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={confermata}>
              {testoConf?.si}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BadgePagamento({ ordine, adesso }: { ordine: Ordine; adesso: Date }) {
  const b = BADGE_PAGAMENTO[statoEffettivo(ordine, adesso)];
  return <Chip tono={b.tono}>{b.testo}</Chip>;
}

/** Un gruppo di chip dove se ne sceglie uno solo: il nome del gruppo è scritto (per chi guarda e per il lettore di schermo). */
function ScelteUna<V extends string | undefined>({
  nome,
  scelte,
  valore,
  onScegli,
}: {
  nome: string;
  scelte: { valore: V; testo: string }[];
  valore: V;
  onScegli: (v: V) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={nome}>
      <span className="text-[12px] text-muted-foreground">{nome}</span>
      {scelte.map((x) => (
        <Segmento key={x.testo} attivo={valore === x.valore} onClick={() => onScegli(x.valore)}>
          {x.testo}
        </Segmento>
      ))}
    </div>
  );
}
