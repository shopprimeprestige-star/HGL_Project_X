/** ── LA PANORAMICA DELL'E-COMMERCE (Panoramica.tsx) ─────────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce, T11 (SPEC §3.2). Qui NON si calcola niente: ogni cifra viene da `conti.ts` (T4), sullo
 *  STESSO elenco di ordini che leggerà la scheda «Ordini» (`useOrdini`, una lettura sola nel guscio). Si disegna soltanto.
 *
 *  ── RILASCIO 2 (T63, SPEC 8A n. 7; SPEC 7.4 n. 4) ──────────────────────────────
 *   Le quattro cifre principali sono quelle di sempre e NON leggono né gli ordini in attesa né quelli di prova né i rimborsi. Sotto, in una riga
 *   a parte, si dice quanti sono: «N ordini in attesa di pagamento», «N ordini di prova non contati», «Rimborsato» (già tolto da «Incassato»).
 *   La riga compare solo se c'è qualcosa da dire: con i soli ordini di prima la pagina è identica a prima.
 *
 *  ── LE ETICHETTE DICONO QUELLO CHE I CONTI FANNO ──────────────────────────────
 *   · «Incassato» = gli ordini FATTI nel periodo che risultano pagati, non i soldi entrati nel periodo: un ordine del 30/11
 *     pagato il 2/12 sta a novembre. Include gli annullati già pagati («di cui N annullati»), così la cifra coincide con le
 *     righe del filtro «pagato = sì».
 *   · «Hanno ordinato più di una volta» e non «clienti di ritorno»: conta chi ha, nel periodo, un ordine che non è il suo
 *     primo di sempre (anche due ordini dentro lo stesso periodo). Il cliente si riconosce da telefono ed email: le schede
 *     dei lead non c'entrano ancora.
 *   · «Ordini fermi» e il numeretto del menu sono «di sempre»: non seguono il periodo.
 *   · Gli ordini con un importo fuori norma (negativo, o sopra il tetto) contano come ordini ma valgono 0 nelle cifre, e la
 *     pagina lo dice (`importiAnomali`): senza, la differenza con l'elenco sarebbe muta. */
import { useMemo, useState } from "react";
import { ChevronRight, PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kpi, KpiRiga, Scheda, Segmento, Vuoto, VuotoRiga, dataBreve, plurale } from "@/crm/ui";
import {
  IMPORTO_MAX,
  andamento,
  importoFuoriNorma,
  ordiniFermi,
  panoramica,
  piuVenduti,
  riacquisto,
} from "./conti";
import type { Periodo } from "./conti";
import { ETICHETTA_STATO, STATI_ORDINE, nomeCliente } from "./ordine";
import type { StatoOrdine } from "./ordine";
import type { StatoOrdini } from "./client";
import { euro } from "./pagina";
import { TONO_STATO_ORDINE } from "./ordini-ui";
import { Avviso } from "./Avviso";

/** Quanti ordini fermi, e quante righe dei più venduti e dei clienti, si elencano. */
const FERMI_ELENCATI = 5;
const CLIENTI_ELENCATI = 10;
/** shortcut: il grafico mostra al massimo gli ultimi 90 giorni del periodo (a 3660 barre non si legge niente); se serve vedere
 *  più lontano, raggruppare per settimana o per mese. */
const GIORNI_GRAFICO = 90;

/** La nota di un riquadro va a capo invece di finire in «…»: sono le etichette oneste («di cui 1 annullato», «annullati esclusi»), non si perdono.
 *  `Kpi` tronca la nota (è il suo comportamento per tutto il CRM): qui si annulla solo per le note di questa pagina. */
const NotaIntera = ({ children }: { children: string }) => (
  <span className="block whitespace-normal">{children}</span>
);

const giornoLeggibile = (giorno: string): string => dataBreve(`${giorno}T12:00:00`);

export interface PropsPanoramica {
  /** Quello che dà `useOrdini()`: la Panoramica legge `ordini` e basta. */
  lettura: Pick<StatoOrdini, "ordini">;
  periodo: Periodo;
  /** L'istante di «adesso», deciso dal guscio (serve a «fermi»): così il disegno non dipende dall'orologio. */
  adesso: Date;
  /** Il clic su uno stato apre la scheda «Ordini» già filtrata. `tutto`: anche il periodo diventa «Tutto» (per le cifre «di sempre»). */
  apriStato: (stato: StatoOrdine, opzioni?: { tutto?: boolean }) => void;
}

export function Panoramica({ lettura, periodo, adesso, apriStato }: PropsPanoramica) {
  const { ordini } = lettura;
  const t = adesso.getTime();
  const dati = useMemo(
    () => ({
      // `adesso` serve solo a leggere «scaduto» un ordine in attesa la cui sessione è finita: le cifre principali non lo usano.
      p: panoramica(ordini, periodo, new Date(t)),
      fermi: ordiniFermi(ordini, new Date(t)),
      giorni: andamento(ordini, periodo),
      venduti: piuVenduti(ordini, periodo),
      // TUTTI gli ordini, non quelli già filtrati dal periodo: «il primo di sempre» deve essere vero.
      ricompra: riacquisto(ordini, periodo),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- il periodo è definito dai suoi due estremi
    [ordini, periodo.da, periodo.a, t],
  );
  const { p, fermi, giorni, venduti, ricompra } = dati;

  if (ordini.length === 0) {
    return (
      <Vuoto
        icona={PackageSearch}
        titolo="Nessun ordine, per ora"
        testo="Quando qualcuno ordina dallo shop, l'ordine compare qui: con le cifre, i prodotti più venduti e chi ricompra."
      />
    );
  }

  const inPeriodo = STATI_ORDINE.map((s) => p.perStato[s]).some((n) => n > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ── LE CIFRE ─────────────────────────────────────────────────────────── */}
      <KpiRiga colonne={4} className="grid-cols-1 min-[480px]:grid-cols-2">
        <Kpi
          etichetta="Ordini"
          valore={p.ordini.n}
          nota={<NotaIntera>{`${euro(p.ordini.medio)} di media · annullati esclusi`}</NotaIntera>}
        />
        <Kpi
          etichetta="Incassato"
          valore={euro(p.incassato.importo)}
          nota={
            <NotaIntera>{`${plurale(p.incassato.n, "ordine", "ordini")}${p.annullatiPagati > 0 ? ` · di cui ${plurale(p.annullatiPagati, "annullato", "annullati")}` : ""}`}</NotaIntera>
          }
          tono={p.incassato.importo > 0 ? "vinta" : "neutro"}
        />
        <Kpi
          etichetta="Da incassare"
          valore={euro(p.daIncassare.importo)}
          nota={
            <NotaIntera>{`${plurale(p.daIncassare.n, "ordine", "ordini")} non pagati`}</NotaIntera>
          }
        />
        <Kpi
          etichetta="Ordini fermi"
          valore={fermi.length}
          nota={
            <NotaIntera>
              {fermi.length > 0 ? "nuovi da più di 48 ore, mai toccati" : "Nessun ordine fermo"}
            </NotaIntera>
          }
          tono={fermi.length > 0 ? "in_sospeso" : "neutro"}
          onClick={fermi.length > 0 ? () => apriStato("nuovo", { tutto: true }) : undefined}
        />
      </KpiRiga>
      <p className="-mt-2 text-[11px] leading-snug text-muted-foreground">
        «Incassato» = ordini del periodo risultati pagati, anche se il pagamento è arrivato dopo.
        Gli ordini fermi sono di sempre: non seguono il periodo.
      </p>

      {(p.inAttesa > 0 || p.prova > 0 || p.rimborsato.n > 0) && (
        <section aria-label="Fuori dalle cifre" className="-mt-1 flex flex-col gap-1">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Fuori dalle cifre
          </h2>
          <ul className="flex flex-col gap-0.5 text-[12.5px]">
            {p.inAttesa > 0 && (
              <li>{plurale(p.inAttesa, "ordine", "ordini")} in attesa di pagamento</li>
            )}
            {p.prova > 0 && (
              <li>
                {plurale(p.prova, "ordine di prova non contato", "ordini di prova non contati")}
              </li>
            )}
            {p.rimborsato.n > 0 && (
              <li>
                Rimborsato: {euro(p.rimborsato.importo)} su{" "}
                {plurale(p.rimborsato.n, "ordine", "ordini")}{" "}
                <span className="text-muted-foreground">(già tolto da «Incassato»)</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {p.importiAnomali > 0 && (
        <Avviso>
          {plurale(p.importiAnomali, "ordine del periodo ha", "ordini del periodo hanno")} un
          importo fuori norma (negativo o sopra {euro(IMPORTO_MAX)}):{" "}
          {p.importiAnomali === 1 ? "conta" : "contano"} come ordine ma vale 0 nelle cifre.
        </Avviso>
      )}

      {fermi.length > 0 && (
        <Scheda
          titolo="Da guardare per primi"
          nota="Ordini nuovi da più di 48 ore che nessuno ha toccato, i più vecchi in alto"
          senzaPadding
        >
          <ul className="divide-y divide-border">
            {fermi.slice(0, FERMI_ELENCATI).map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-[12.5px]"
              >
                <span className="font-medium tabular-nums">{o.ref}</span>
                <span className="min-w-0 flex-1 truncate">{nomeCliente(o)}</span>
                <span className="text-muted-foreground">
                  da{" "}
                  {plurale(
                    Math.floor((t - Date.parse(o.creatoIl)) / 86_400_000),
                    "giorno",
                    "giorni",
                  )}
                </span>
                <span className="tabular-nums">
                  {importoFuoriNorma(o) ? "importo fuori norma" : euro(o.totale)}
                </span>
              </li>
            ))}
          </ul>
          {fermi.length > FERMI_ELENCATI && (
            <p className="border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
              e altri {fermi.length - FERMI_ELENCATI} —{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => apriStato("nuovo", { tutto: true })}
              >
                aprili nella scheda Ordini
              </button>
              , stato «Nuovo», senza limite di periodo.
            </p>
          )}
        </Scheda>
      )}

      {!inPeriodo ? (
        <Vuoto
          icona={PackageSearch}
          titolo="Nessun ordine in questo periodo"
          testo={`Cambia il periodo in alto: in tutto ci sono ${plurale(ordini.length, "ordine", "ordini")}.`}
        />
      ) : (
        <>
          {/* ── PER STATO: un clic apre l'elenco già filtrato ────────────────── */}
          <section aria-label="Ordini per stato" className="flex flex-col gap-2">
            <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Ordini per stato
            </h2>
            <KpiRiga colonne={5}>
              {STATI_ORDINE.map((s) => (
                <Kpi
                  key={s}
                  etichetta={ETICHETTA_STATO[s]}
                  valore={p.perStato[s]}
                  tono={p.perStato[s] > 0 ? TONO_STATO_ORDINE[s] : "neutro"}
                  onClick={() => apriStato(s)}
                />
              ))}
            </KpiRiga>
          </section>

          <Andamento giorni={giorni} />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ── I PIÙ VENDUTI ─────────────────────────────────────────────── */}
            <Scheda
              titolo="Prodotti più venduti"
              nota="Annullati esclusi · per prodotto, la variante si apre dalla riga"
              senzaPadding
            >
              {venduti.length === 0 ? (
                <VuotoRiga testo="Nessun prodotto venduto in questo periodo." />
              ) : (
                <ol className="divide-y divide-border">
                  {venduti.map((v) => {
                    const riga = (
                      <>
                        <span className="min-w-0 flex-1 truncate font-medium">{v.nome}</span>
                        <span className="tabular-nums">{plurale(v.pezzi, "pezzo", "pezzi")}</span>
                        <span className="hidden tabular-nums text-muted-foreground sm:inline">
                          {plurale(v.ordini, "ordine", "ordini")}
                        </span>
                        <span className="w-20 text-right tabular-nums">{euro(v.ricavo)}</span>
                      </>
                    );
                    const conVarianti = v.varianti.some((x) => x.variante);
                    return (
                      <li key={v.chiave} className="text-[12.5px]">
                        {conVarianti ? (
                          <details className="group">
                            <summary className="flex cursor-pointer list-none items-baseline gap-3 px-4 py-2 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                              <ChevronRight
                                className="h-3 w-3 shrink-0 self-center text-muted-foreground transition-transform group-open:rotate-90"
                                aria-hidden="true"
                              />
                              {riga}
                            </summary>
                            <ul className="bg-muted/30 py-1">
                              {v.varianti.map((x) => (
                                <li
                                  key={x.variante ?? "-"}
                                  className="flex items-baseline gap-3 py-1 pl-10 pr-4 text-[12px] text-muted-foreground"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    {x.variante ?? "Senza variante"}
                                  </span>
                                  <span className="tabular-nums">
                                    {plurale(x.pezzi, "pezzo", "pezzi")}
                                  </span>
                                  <span className="w-24 text-right tabular-nums">
                                    {euro(x.ricavo)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : (
                          <div className="flex items-baseline gap-3 px-4 py-2 pl-10">{riga}</div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Scheda>

            {/* ── CHI RICOMPRA ──────────────────────────────────────────────── */}
            <Scheda
              titolo="Hanno ordinato più di una volta"
              nota={
                ricompra.clientiNelPeriodo > 0
                  ? `${ricompra.tornati} su ${ricompra.clientiNelPeriodo} clienti del periodo (${Math.round(ricompra.tasso * 100)}%)`
                  : "Nessun cliente nel periodo"
              }
              senzaPadding
            >
              {ricompra.elenco.length === 0 ? (
                <VuotoRiga testo="Nessun cliente del periodo ha ordinato più di una volta." />
              ) : (
                <ul className="divide-y divide-border">
                  {ricompra.elenco.slice(0, CLIENTI_ELENCATI).map((cl) => (
                    <li
                      key={cl.chiave}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-[12.5px]"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{cl.nome}</span>
                      <span className="tabular-nums">
                        {plurale(cl.n, "ordine", "ordini")} in tutto
                      </span>
                      <span className="tabular-nums">{euro(cl.speso)}</span>
                      <span className="text-muted-foreground">
                        ultimo {dataBreve(cl.ultimoOrdine)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {ricompra.elenco.length > CLIENTI_ELENCATI && (
                <p className="border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
                  e altri {ricompra.elenco.length - CLIENTI_ELENCATI}.
                </p>
              )}
              <p className="border-t border-border px-4 py-2 text-[11px] leading-snug text-muted-foreground">
                Chi ha, nel periodo, un ordine che non è il suo primo. Il cliente si riconosce da
                telefono ed email; le schede dei lead non sono ancora collegate.
              </p>
            </Scheda>
          </div>
        </>
      )}
    </div>
  );
}

/** Ordini o incassato, giorno per giorno. Barre di `div`: come gli altri grafici semplici del CRM, niente libreria. */
function Andamento({ giorni }: { giorni: ReturnType<typeof andamento> }) {
  const [serie, setSerie] = useState<"ordini" | "incassato">("ordini");
  const visibili = giorni.slice(-GIORNI_GRAFICO);
  const max = Math.max(0, ...visibili.map((g) => g[serie]));
  if (visibili.length === 0) return null;
  const primo = visibili[0].giorno;
  const ultimo = visibili[visibili.length - 1].giorno;
  return (
    <Scheda
      titolo="Andamento"
      nota={
        giorni.length > GIORNI_GRAFICO
          ? `Ultimi ${GIORNI_GRAFICO} giorni del periodo`
          : "Giorno per giorno, per data dell'ordine"
      }
      azioni={
        <>
          <Segmento attivo={serie === "ordini"} onClick={() => setSerie("ordini")}>
            Ordini
          </Segmento>
          <Segmento attivo={serie === "incassato"} onClick={() => setSerie("incassato")}>
            Incassato
          </Segmento>
        </>
      }
    >
      <div
        role="img"
        aria-label={`Andamento giornaliero: ${serie === "ordini" ? "ordini" : "incassato"}, dal ${giornoLeggibile(primo)} al ${giornoLeggibile(ultimo)}`}
        className="flex h-28 items-end gap-px border-b border-border"
      >
        {visibili.map((g) => {
          const v = g[serie];
          return (
            <div
              key={g.giorno}
              title={`${giornoLeggibile(g.giorno)} · ${plurale(g.ordini, "ordine", "ordini")} · ${euro(g.incassato)} incassati`}
              className={cn(
                "min-w-[2px] flex-1 rounded-t-sm bg-sky-700",
                v === 0 && "bg-transparent",
              )}
              style={{
                height: `${max > 0 && v > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0}%`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{giornoLeggibile(primo)}</span>
        <span>
          {max > 0
            ? `giorno migliore: ${serie === "ordini" ? plurale(max, "ordine", "ordini") : euro(max)}`
            : "nessun movimento"}
        </span>
        <span>{giornoLeggibile(ultimo)}</span>
      </div>
      {/*  Le barre dicono il valore solo col mouse: la stessa serie, in tabella, si legge con la tastiera e con il lettore di schermo. */}
      <details className="mt-2 text-[12px]">
        <summary className="w-fit cursor-pointer rounded px-1 py-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Valori giorno per giorno
        </summary>
        <div className="mt-1 max-h-56 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">Ordini e incassato per ogni giorno del periodo</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">
                  Giorno
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  Ordini
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Incassato
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibili.map((g) => (
                <tr key={g.giorno}>
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {giornoLeggibile(g.giorno)}
                  </th>
                  <td className="py-1 pr-3 text-right">{g.ordini}</td>
                  <td className="py-1 text-right">{euro(g.incassato)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Scheda>
  );
}
