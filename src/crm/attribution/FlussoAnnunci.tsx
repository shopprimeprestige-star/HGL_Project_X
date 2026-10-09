/** ─────────────────────────────────────────────────────────────────────────
 *  FlussoAnnunci — «che strada hanno fatto prima di scriverci»
 *
 *  PERCHÉ QUESTO BLOCCO ESISTE, E PERCHÉ NE SOSTITUISCE DUE
 *  La pagina diceva la stessa cosa due volte: un diagramma a flusso alto 460px
 *  e, sopra, un elenco «Top 10 sequenze ad più frequenti». Stesse persone,
 *  stessi percorsi, due blocchi da leggere. Peggio: il diagramma si legge solo
 *  su uno schermo largo — con 280px di margini per le etichette, su un telefono
 *  restava una striscia di nastri senza nomi.
 *
 *  Qui sono UNA cosa sola:
 *   · L'ELENCO C'È SEMPRE. È la versione che si legge ovunque, in parole e
 *     numeri: quante persone hanno fatto quel percorso, quante sono diventate
 *     clienti, quanto ci hanno messo. La barretta accanto al conteggio fa il
 *     lavoro che nel diagramma fa la larghezza del nastro.
 *   · IL DIAGRAMMA COMPARE DOVE SI LEGGE. Da 1024px in su, sotto l'elenco,
 *     con l'etichetta delle tre colonne sopra. È il colpo d'occhio, non la
 *     fonte: se sparisse, nessun numero andrebbe perso.
 *   · SI PREME OVUNQUE. Ogni annuncio dell'elenco e ogni nodo del diagramma
 *     aprono le stesse persone. Un numero che non porta al suo elenco è un
 *     numero che costringe a cercare a mano.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useMemo } from "react";
import { ArrowRight, Route as RouteIcon } from "lucide-react";
import { Scheda, VuotoRiga } from "@/crm/ui";
import { AttributionSankeyChart, type SankeyNodeClick } from "@/crm/AttributionSankeyChart";
import { NESSUN_ANNUNCIO, PAROLE } from "@/crm/attribution/parole";
import type {
  AttributionAdRanking,
  AttributionJourneyRow,
  AttributionPathRow,
} from "@/crm/ads-financials.functions";

interface Props {
  journeys: AttributionJourneyRow[];
  adRanking: AttributionAdRanking[];
  topPaths: AttributionPathRow[];
  topN: number;
  onNodo: (n: SankeyNodeClick) => void;
  /** azioni della testata (numero di annunci mostrati, solo convertiti…) */
  azioni?: React.ReactNode;
}

interface Tappa {
  etichetta: string;
  adId: string | null;
  ruolo: "primo" | "mezzo" | "ultimo";
}

export function FlussoAnnunci({ journeys, adRanking, topPaths, topN, onNodo, azioni }: Props) {
  //  I nomi degli annunci arrivano dalla classifica: il percorso li ha solo
  //  come id, e un id non dice niente a chi legge.
  const nomeAnnuncio = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of adRanking) m.set(a.adId, a.adName || `…${a.adId.slice(-6)}`);
    return (id: string) => m.get(id) ?? `…${id.slice(-6)}`;
  }, [adRanking]);

  //  Oltre quattro tappe la riga diventa un muro e nessuno la legge: si mostra
  //  la prima, l'ultima e quante ce n'erano in mezzo. La sequenza intera resta
  //  nel suggerimento a comparsa.
  const percorsi = useMemo(
    () =>
      topPaths.map((p) => {
        const ids = p.pathAdIds;
        const tappe: (Tappa | "salto")[] =
          ids.length <= 4
            ? ids.map((id, i) => ({
                etichetta: nomeAnnuncio(id),
                adId: id,
                ruolo: i === 0 ? "primo" : i === ids.length - 1 ? "ultimo" : "mezzo",
              }))
            : [
                { etichetta: nomeAnnuncio(ids[0]), adId: ids[0], ruolo: "primo" },
                "salto",
                {
                  etichetta: nomeAnnuncio(ids[ids.length - 1]),
                  adId: ids[ids.length - 1],
                  ruolo: "ultimo",
                },
              ];
        return {
          ...p,
          tappe,
          saltate: Math.max(0, ids.length - 2),
          completo: ids.map(nomeAnnuncio).join(" → "),
        };
      }),
    [topPaths, nomeAnnuncio],
  );

  //  Le persone che non hanno visto NESSUN annuncio non entrano nei percorsi
  //  (non hanno tappe), ma esistono e a volte sono la fetta più grossa: il
  //  passaparola. Tacerle farebbe sembrare che tutto arrivi dalla pubblicità.
  const senzaAnnunci = useMemo(() => {
    const righe = journeys.filter(
      (j) => !j.firstClickAdId && !j.lastClickAdId && j.intermediateAdIds.length === 0,
    );
    return { conteggio: righe.length, clienti: righe.filter((j) => j.isConverted).length };
  }, [journeys]);

  const massimo = Math.max(1, ...percorsi.map((p) => p.count), senzaAnnunci.conteggio);
  const nienteDaMostrare = percorsi.length === 0 && senzaAnnunci.conteggio === 0;

  return (
    <Scheda
      titolo="Che strada hanno fatto prima di scriverci"
      nota="I percorsi più frequenti, dal più battuto. Premi un annuncio per vedere le persone."
      icona={RouteIcon}
      azioni={azioni}
      senzaPadding
    >
      {nienteDaMostrare ? (
        <VuotoRiga testo="Nessun percorso tracciato nel periodo scelto." />
      ) : (
        <>
          <ol className="divide-y divide-border">
            {percorsi.map((p, i) => (
              <li key={`${p.path}-${i}`} className="px-3 py-2.5 sm:px-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {/*  Le tappe vanno a capo: su un telefono un percorso di
                         quattro annunci non sta su una riga, e troncarlo
                         toglierebbe proprio l'ultimo, cioè quello che ha
                         portato al contatto. */}
                    <div className="flex flex-wrap items-center gap-1" title={p.completo}>
                      {p.tappe.map((t, k) => (
                        <span key={k} className="inline-flex items-center gap-1">
                          {t === "salto" ? (
                            <span className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              +{p.saltate} nel mezzo
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                t.adId &&
                                onNodo({
                                  ruolo: t.ruolo,
                                  adId: t.adId,
                                  etichetta: t.etichetta,
                                  raggruppato: false,
                                })
                              }
                              title={`${PAROLE[t.ruolo].tappa} · ${t.etichetta}`}
                              className="max-w-[190px] truncate rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[11.5px] font-medium transition-colors hover:border-foreground/30 hover:bg-muted"
                            >
                              {t.etichetta}
                            </button>
                          )}
                          {k < p.tappe.length - 1 && (
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </span>
                      ))}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums">
                      <span>
                        <span className="font-semibold">{p.count}</span>{" "}
                        <span className="text-muted-foreground">
                          {p.count === 1 ? "persona" : "persone"}
                        </span>
                      </span>
                      <span className={classeResa(p.conversionRate)}>
                        {p.converted} {p.converted === 1 ? "cliente" : "clienti"} ·{" "}
                        {(p.conversionRate * 100).toFixed(0)}%
                      </span>
                      {p.avgDays !== null && (
                        <span className="text-muted-foreground">
                          decidono in {p.avgDays.toFixed(0)} g
                        </span>
                      )}
                    </div>

                    <Barra parte={p.count} totale={massimo} />
                  </div>
                </div>
              </li>
            ))}

            {senzaAnnunci.conteggio > 0 && (
              <li className="px-3 py-2.5 sm:px-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium">{NESSUN_ANNUNCIO}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11.5px] tabular-nums">
                      <span>
                        <span className="font-semibold">{senzaAnnunci.conteggio}</span>{" "}
                        <span className="text-muted-foreground">
                          {senzaAnnunci.conteggio === 1 ? "persona" : "persone"}
                        </span>
                      </span>
                      <span
                        className={classeResa(
                          senzaAnnunci.conteggio > 0
                            ? senzaAnnunci.clienti / senzaAnnunci.conteggio
                            : 0,
                        )}
                      >
                        {senzaAnnunci.clienti} {senzaAnnunci.clienti === 1 ? "cliente" : "clienti"}
                      </span>
                      <span className="text-muted-foreground">
                        arrivate per passaparola o ricerca
                      </span>
                    </div>
                    <Barra parte={senzaAnnunci.conteggio} totale={massimo} />
                  </div>
                </div>
              </li>
            )}
          </ol>

          {/* ── LO STESSO PERCORSO, IN FIGURA ─────────────────────────────
               Solo da 1024px: sotto quella larghezza il diagramma non ha
               spazio per i nomi e diventa un disegno astratto. */}
          <div className="hidden border-t border-border p-4 lg:block">
            <div className="mb-2 grid grid-cols-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>{PAROLE.primo.titolo}</span>
              <span className="text-center">{PAROLE.mezzo.titolo}</span>
              <span className="text-right">{PAROLE.ultimo.titolo}</span>
            </div>
            <AttributionSankeyChart
              journeys={journeys}
              adRanking={adRanking}
              topN={topN}
              onNodeClick={onNodo}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Lo spessore del nastro è il numero di persone. Gli annunci fuori dai primi {topN} sono
              raccolti in un blocco solo.
            </p>
          </div>
        </>
      )}
    </Scheda>
  );
}

/** La barretta di volume: sostituisce, su schermo stretto, la larghezza del
 *  nastro del diagramma. Resta grigia di proposito — dice «quanti», non «bene
 *  o male»: il giudizio sta nella percentuale accanto, ed è lì che serve il
 *  colore. */
function Barra({ parte, totale }: { parte: number; totale: number }) {
  const perc = Math.max(2, Math.round((parte / totale) * 100));
  return (
    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-slate-400/70" style={{ width: `${perc}%` }} />
    </div>
  );
}

//  Emerald = questo percorso porta clienti · ambra = ne porta qualcuno ·
//  neutro = passa gente ma non compra. Le stesse tre tinte delle fasi della
//  trattativa: nessun vocabolario di colore nuovo.
function classeResa(tasso: number): string {
  if (tasso >= 0.3) return "font-semibold text-emerald-700";
  if (tasso >= 0.1) return "font-medium text-amber-700";
  return "text-muted-foreground";
}
