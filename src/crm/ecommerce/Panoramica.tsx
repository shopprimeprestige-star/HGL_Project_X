/** ── LA PANORAMICA DELL'E-COMMERCE (Panoramica.tsx) ─────────────────────────────
 *  Commessa 2026-11-17-crm-ecommerce, T11 (SPEC §3.2). Qui NON si calcola niente: ogni cifra viene da `conti.ts` (T4), sullo
 *  STESSO elenco di ordini che leggerà la scheda «Ordini» (`useOrdini`, una lettura sola nel guscio). Si disegna soltanto.
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
import { Avviso } from "./Avviso";

/** Quanti ordini fermi, e quante righe dei più venduti e dei clienti, si elencano. */
const FERMI_ELENCATI = 5;
const CLIENTI_ELENCATI = 10;
/** shortcut: il grafico mostra al massimo gli ultimi 90 giorni del periodo (a 3660 barre non si legge niente); se serve vedere
 *  più lontano, raggruppare per settimana o per mese. */
const GIORNI_GRAFICO = 90;

/** Un tono per stato: serve a distinguere i numeri a colpo d'occhio, ma il nome dello stato è sempre scritto. */
const TONO_STATO = {
  nuovo: "da_lavorare",
  in_preparazione: "in_sospeso",
  spedito: "in_corso",
  consegnato: "vinta",
  annullato: "persa",
} as const;

const giornoLeggibile = (giorno: string): string => dataBreve(`${giorno}T12:00:00`);

export interface PropsPanoramica {
  /** Quello che dà `useOrdini()`: la Panoramica legge `ordini` e basta. */
  lettura: Pick<StatoOrdini, "ordini">;
  periodo: Periodo;
  /** L'istante di «adesso», deciso dal guscio (serve a «fermi»): così il disegno non dipende dall'orologio. */
  adesso: Date;
  /** Il clic su uno stato apre la scheda «Ordini» già filtrata. */
  apriStato: (stato: StatoOrdine) => void;
}

export function Panoramica({ lettura, periodo, adesso, apriStato }: PropsPanoramica) {
  const { ordini } = lettura;
  const t = adesso.getTime();
  const dati = useMemo(
    () => ({
      p: panoramica(ordini, periodo),
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
          nota={`${euro(p.ordini.medio)} di media · annullati esclusi`}
        />
        <Kpi
          etichetta="Incassato"
          valore={euro(p.incassato.importo)}
          nota={`${plurale(p.incassato.n, "ordine", "ordini")}${p.annullatiPagati > 0 ? ` · di cui ${plurale(p.annullatiPagati, "annullato", "annullati")}` : ""}`}
          tono={p.incassato.importo > 0 ? "vinta" : "neutro"}
        />
        <Kpi
          etichetta="Da incassare"
          valore={euro(p.daIncassare.importo)}
          nota={`${plurale(p.daIncassare.n, "ordine", "ordini")} non pagati`}
        />
        <Kpi
          etichetta="Ordini fermi"
          valore={fermi.length}
          nota={fermi.length > 0 ? "nuovi da più di 48 ore, mai toccati" : "Nessun ordine fermo"}
          tono={fermi.length > 0 ? "in_sospeso" : "neutro"}
          onClick={fermi.length > 0 ? () => apriStato("nuovo") : undefined}
        />
      </KpiRiga>
      <p className="-mt-2 text-[11px] leading-snug text-muted-foreground">
        «Incassato» = ordini del periodo risultati pagati, anche se il pagamento è arrivato dopo.
        Gli ordini fermi sono di sempre: non seguono il periodo.
      </p>

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
              e altri {fermi.length - FERMI_ELENCATI} — li trovi nella scheda Ordini, stato «Nuovo».
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
                  tono={p.perStato[s] > 0 ? TONO_STATO[s] : "neutro"}
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
                "min-w-[2px] flex-1 rounded-t-sm bg-sky-600/80",
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
    </Scheda>
  );
}
