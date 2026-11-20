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
 *  ⚠️ Nessun log: gli ordini contengono nome, telefono e indirizzo dei clienti. */
import { useEffect, useMemo, useRef, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { importoFuoriNorma } from "./conti";
import type { Periodo } from "./conti";
import type { Azione } from "./azioni";
import type { RisultatoAzione, RisultatoStorico, StatoOrdini } from "./client";
import { ETICHETTA_STATO, STATI_ORDINE, eIncassato, nomeCliente } from "./ordine";
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
import type { Esito, FiltroPagato } from "./ordini-ui";
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
}

const SCELTE_PAGATO: { valore: FiltroPagato | undefined; testo: string }[] = [
  { valore: undefined, testo: "Tutti" },
  { valore: "si", testo: "Pagati" },
  { valore: "no", testo: "Non pagati" },
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
}: PropsElencoOrdini) {
  const [ricerca, setRicerca] = useState("");
  const [pagato, setPagato] = useState<FiltroPagato | undefined>(undefined);
  const [visibili, setVisibili] = useState(PAGINA_RIGHE);
  const [occupato, setOccupato] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [conferma, setConferma] = useState<{ azione: Azione; ordine: Ordine } | null>(null);
  const ultimaRiga = useRef<HTMLElement | null>(null);
  const comandi = comandiAttivi(migrazionePronta);

  const righe = useMemo(
    () => filtraOrdini(lettura.ordini, { periodo, stato, pagato, ricerca }),
    [lettura.ordini, periodo, stato, pagato, ricerca],
  );
  const conteggi = useMemo(
    () => conteggiPerStato(lettura.ordini, { periodo, pagato, ricerca }),
    [lettura.ordini, periodo, pagato, ricerca],
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
  const togliFiltri = () => {
    setRicerca("");
    setPagato(undefined);
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
  const filtrato = !!(stato || pagato || ricerca.trim());

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
                    <Chip tono={eIncassato(o) ? "vinta" : "neutro"}>
                      {eIncassato(o) ? "Pagato" : "Non pagato"}
                    </Chip>
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
