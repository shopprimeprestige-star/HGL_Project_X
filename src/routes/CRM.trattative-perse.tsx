/** ─────────────────────────────────────────────────────────────────────────
 *  LE TRATTATIVE PERSE
 *
 *  NON È UN CIMITERO
 *  Un elenco di nomi persi non serve a niente: si guarda una volta, mette di
 *  malumore e non si riapre più. Questa pagina risponde a due domande sole, e
 *  le mette in quest'ordine perché è l'ordine in cui cambiano le decisioni:
 *
 *   1. PERCHÉ si è perso — i motivi con i numeri, dal più frequente. È il dato
 *      che cambia il listino, lo script della chiamata o il target delle
 *      campagne. Un motivo che pesa il 40% è un problema del processo, non
 *      della singola trattativa;
 *   2. CHI si può riprendere — «non è il momento» e «prezzo fuori budget» non
 *      sono dei no: sono dei non adesso. Da qui si riparte con un messaggio o
 *      si rimette la persona in coda per il ricontatto, senza passare
 *      dall'elenco generale a cercarla per nome.
 *
 *  IL MOTIVO CHE MANCA
 *  Una trattativa persa senza motivo registrato è un dato buttato: il numero
 *  in alto lo dice sempre, ed è cliccabile — porta esattamente a quelle
 *  trattative, così si sistemano invece di restare un rimprovero.
 *
 *  QUALI TRATTATIVE FINISCONO QUI
 *  Quelle in uno stato di perdita: «Non interessato», «Cliente assente», «Non
 *  in target» e le pratiche chiuse. Lo stato resta scritto su ogni riga perché
 *  un cliente che non si è presentato e uno che ha scelto un concorrente si
 *  riprendono in due modi diversi.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCRM } from "@/crm/CRMContext";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog } from "@/crm/QuickStatusDialog";
import {
  LOST_STATUSES,
  LOST_REASON_LABEL,
  LOST_REASON_OPTIONS,
  type LostReason,
  type Lead,
  type LeadStatus,
} from "@/crm/types";
import {
  ChipStato,
  Kpi,
  KpiRiga,
  Pagina,
  Scheda,
  Segmento,
  Titolo,
  Vuoto,
  VuotoRiga,
  dataBreve,
} from "@/crm/ui";
import {
  buildWhatsAppLink,
  componiMessaggio,
  modelloDi,
  valoriDaLead,
} from "@/crm/whatsapp";
import { MessageCircle, Phone, RotateCcw, TrendingDown, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/CRM/trattative-perse")({
  component: PaginaTrattativePerse,
});

/** ── COSA CONTA COME PERSO ────────────────────────────────────────────────
 *  Agli stati che chiedono il motivo (LOST_STATUSES) si aggiunge
 *  «Non interessato»: è la chiusura più frequente di tutte, ed escluderla
 *  significava avere una pagina sulle perdite che non guardava dove si perde
 *  davvero. Il motivo lì non viene chiesto: infatti finiscono quasi tutte fra
 *  quelle «senza motivo», ed è giusto che si veda. */
const STATI_PERSI: LeadStatus[] = Array.from(new Set<LeadStatus>([...LOST_STATUSES, "annullato"]));

/** I motivi che sono un «non adesso» e non un no: sono la miniera. */
const MOTIVI_RIPRENDIBILI: LostReason[] = ["tempo", "prezzo", "non_risponde", "ripensamento"];

/** Il periodo: 0 = da sempre. Sotto i 7 giorni i numeri non fanno una
 *  distribuzione, sopra i 90 non descrivono più come si lavora adesso. */
const PERIODI: { g: number; l: string }[] = [
  { g: 7, l: "7 giorni" },
  { g: 30, l: "30 giorni" },
  { g: 90, l: "90 giorni" },
  { g: 0, l: "Da sempre" },
];

/** La chiave con cui si raggruppa: un motivo, oppure il non-detto. */
type ChiaveMotivo = LostReason | "senza";

/** Quando è stata persa: il momento in cui è stato registrato il motivo, se
 *  c'è; altrimenti l'ultima modifica, che è la miglior approssimazione. */
function quandoPersa(l: Lead): string {
  return l.data.lostReasonAt || l.data.convertedAt || l.updated_at;
}

interface Gruppo {
  chiave: string;
  etichetta: string;
  totale: number;
  senzaMotivo: number;
  motivoPrincipale?: LostReason;
  conteggioPrincipale: number;
}

function PaginaTrattativePerse() {
  const { leads, consultants } = useCRM();
  const [giorni, setGiorni] = useState(30);
  const [motivoScelto, setMotivoScelto] = useState<ChiaveMotivo | null>(null);
  const [schedaLead, setSchedaLead] = useState<Lead | null>(null);
  const [ricontatto, setRicontatto] = useState<Lead | null>(null);

  const nomeConsulente = (id?: string | null) =>
    consultants.find((c) => c.id === id)?.data.nome || "";

  const perse = useMemo(() => {
    const limite = giorni > 0 ? Date.now() - giorni * 86_400_000 : 0;
    return leads
      .filter((l) => {
        if (!STATI_PERSI.includes(l.data.stato)) return false;
        if (!limite) return true;
        return new Date(quandoPersa(l)).getTime() >= limite;
      })
      .sort((a, b) => new Date(quandoPersa(b)).getTime() - new Date(quandoPersa(a)).getTime());
  }, [leads, giorni]);

  /** Il conteggio per motivo, che è il cuore della pagina. */
  const perMotivo = useMemo(() => {
    const m = new Map<ChiaveMotivo, Lead[]>();
    perse.forEach((l) => {
      const k: ChiaveMotivo = l.data.lostReason ?? "senza";
      const lista = m.get(k);
      if (lista) lista.push(l);
      else m.set(k, [l]);
    });
    return m;
  }, [perse]);

  const senzaMotivo = perMotivo.get("senza")?.length ?? 0;

  const motiviOrdinati = useMemo(
    () =>
      LOST_REASON_OPTIONS.map((r) => ({ motivo: r, n: perMotivo.get(r)?.length ?? 0 }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n),
    [perMotivo],
  );

  const riprendibili = useMemo(
    () => perse.filter((l) => l.data.lostReason && MOTIVI_RIPRENDIBILI.includes(l.data.lostReason)),
    [perse],
  );

  /** L'elenco in basso: tutto, oppure il motivo su cui si è cliccato. */
  const elenco = useMemo(() => {
    if (!motivoScelto) return perse;
    return perMotivo.get(motivoScelto) ?? [];
  }, [motivoScelto, perMotivo, perse]);

  const raggruppa = (
    chiaveDi: (l: Lead) => { chiave: string; etichetta: string },
    massimo?: number,
  ): Gruppo[] => {
    const m = new Map<string, Gruppo & { motivi: Partial<Record<LostReason, number>> }>();
    perse.forEach((l) => {
      const { chiave, etichetta } = chiaveDi(l);
      let g = m.get(chiave);
      if (!g) {
        g = {
          chiave,
          etichetta,
          totale: 0,
          senzaMotivo: 0,
          conteggioPrincipale: 0,
          motivi: {},
        };
        m.set(chiave, g);
      }
      g.totale++;
      if (l.data.lostReason) g.motivi[l.data.lostReason] = (g.motivi[l.data.lostReason] ?? 0) + 1;
      else g.senzaMotivo++;
    });
    const righe = Array.from(m.values()).map((g) => {
      let top: LostReason | undefined;
      let n = 0;
      (Object.keys(g.motivi) as LostReason[]).forEach((r) => {
        const v = g.motivi[r] ?? 0;
        if (v > n) {
          n = v;
          top = r;
        }
      });
      return { ...g, motivoPrincipale: top, conteggioPrincipale: n };
    });
    righe.sort((a, b) => b.totale - a.totale);
    return massimo ? righe.slice(0, massimo) : righe;
  };

  const perConsulente = useMemo(
    () =>
      raggruppa((l) => ({
        chiave: l.data.consulenteId || "_nessuno",
        etichetta: nomeConsulente(l.data.consulenteId) || "Senza consulente",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perse, consultants],
  );

  const perCreative = useMemo(
    () =>
      raggruppa((l) => {
        const t = l.data.tracking;
        return {
          chiave: t?.ad_id || t?.ad_name || t?.creative_name || "_organico",
          etichetta:
            t?.ad_name || t?.creative_name || (t?.ad_id ? `Annuncio ${t.ad_id}` : "Organico o diretto"),
        };
      }, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perse],
  );

  return (
    <Pagina>
      <Titolo
        testo="Trattative perse"
        icona={TrendingDown}
        nota={
          perse.length === 0
            ? "Nessuna trattativa persa nel periodo"
            : `${perse.length} nel periodo · il motivo dice cosa cambiare, l'elenco chi richiamare`
        }
        azioni={
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODI.map((p) => (
              <Segmento key={p.g} attivo={giorni === p.g} onClick={() => setGiorni(p.g)}>
                {p.l}
              </Segmento>
            ))}
          </div>
        }
      />

      <KpiRiga colonne={4}>
        <Kpi
          etichetta="Perse"
          valore={perse.length}
          nota={giorni > 0 ? `negli ultimi ${giorni} giorni` : "da sempre"}
          tono="persa"
          onClick={() => setMotivoScelto(null)}
          attivo={motivoScelto === null}
        />
        <Kpi
          etichetta="Da riprendere"
          valore={riprendibili.length}
          nota="prezzo, tempo, ripensamento"
          tono="in_corso"
        />
        <Kpi
          etichetta="Senza motivo"
          valore={senzaMotivo}
          nota={senzaMotivo > 0 ? "apri e registra il motivo" : "tutte registrate"}
          tono={senzaMotivo > 0 ? "in_sospeso" : "neutro"}
          onClick={senzaMotivo > 0 ? () => setMotivoScelto("senza") : undefined}
          attivo={motivoScelto === "senza"}
        />
        <Kpi
          etichetta="Motivo principale"
          valore={motiviOrdinati[0] ? LOST_REASON_LABEL[motiviOrdinati[0].motivo] : "—"}
          nota={
            motiviOrdinati[0]
              ? `${motiviOrdinati[0].n} su ${perse.length} · ${Math.round(
                  (motiviOrdinati[0].n / Math.max(1, perse.length)) * 100,
                )}%`
              : "nessun motivo registrato"
          }
        />
      </KpiRiga>

      {/* ── PERCHÉ SI È PERSO ───────────────────────────────────────────── */}
      <Scheda
        titolo="Perché si è perso"
        nota="Clicca un motivo per vedere chi si è perso così"
      >
        {perse.length === 0 ? (
          <Vuoto
            titolo="Niente da analizzare"
            testo="Nel periodo scelto non risultano trattative perse. Allarga il periodo per vedere lo storico."
            icona={TrendingDown}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {motiviOrdinati.map(({ motivo, n }) => {
              const pct = (n / perse.length) * 100;
              const attivo = motivoScelto === motivo;
              return (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => setMotivoScelto(attivo ? null : motivo)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    attivo ? "border-foreground/30 bg-accent/60" : "border-transparent hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium">{LOST_REASON_LABEL[motivo]}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
                      <span className="text-[14px] font-semibold text-foreground">{n}</span> ·{" "}
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        MOTIVI_RIPRENDIBILI.includes(motivo) ? "bg-amber-500/70" : "bg-rose-500/70"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}

            {senzaMotivo > 0 && (
              <button
                type="button"
                onClick={() => setMotivoScelto(motivoScelto === "senza" ? null : "senza")}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  motivoScelto === "senza"
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/10"
                }`}
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span className="text-[12.5px] leading-relaxed text-amber-900">
                  <span className="font-semibold">{senzaMotivo}</span> perse senza motivo
                  registrato: non entrano in nessuna delle percentuali qui sopra. Aprile e
                  scegliere il motivo è l'unico modo per far diventare veri questi numeri.
                </span>
              </button>
            )}

            <p className="mt-1 text-[11.5px] text-muted-foreground">
              In ambra i motivi che sono un «non adesso» — quelle trattative si riprendono. In rosa
              quelle chiuse davvero.
            </p>
          </div>
        )}
      </Scheda>

      {/* ── CHI SI PUÒ RIPRENDERE ───────────────────────────────────────── */}
      <Scheda
        titolo={
          motivoScelto
            ? `Perse per «${motivoScelto === "senza" ? "motivo non registrato" : LOST_REASON_LABEL[motivoScelto]}»`
            : "Tutte le trattative perse"
        }
        nota={`${elenco.length} ${elenco.length === 1 ? "trattativa" : "trattative"} · dalla più recente`}
        azioni={
          motivoScelto && (
            <button
              type="button"
              onClick={() => setMotivoScelto(null)}
              className="rounded-md border border-border px-2 py-1 text-[11.5px] font-medium hover:bg-accent"
            >
              Mostra tutte
            </button>
          )
        }
        senzaPadding
      >
        {elenco.length === 0 ? (
          <VuotoRiga testo="Nessuna trattativa con questo motivo nel periodo scelto." />
        ) : (
          <ul className="divide-y divide-border">
            {elenco.slice(0, 120).map((l) => {
              const consulente = nomeConsulente(l.data.consulenteId);
              const messaggio = componiMessaggio(
                modelloDi("fissa_meet_dopo"),
                valoriDaLead(l, "fissa_meet_dopo", consulente),
              );
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 hover:bg-accent/40"
                >
                  <button
                    type="button"
                    onClick={() => setSchedaLead(l)}
                    className="min-w-0 flex-1 text-left"
                    title="Apri la scheda: da lì si registra o si corregge il motivo"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium">
                        {l.data.nome} {l.data.cognome}
                      </span>
                      <ChipStato stato={l.data.stato} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
                      <span>{dataBreve(quandoPersa(l))}</span>
                      {consulente && <span>· {consulente}</span>}
                      {l.data.lostReason ? (
                        <span>· {LOST_REASON_LABEL[l.data.lostReason]}</span>
                      ) : (
                        <span className="font-medium text-amber-700">· motivo non registrato</span>
                      )}
                      {l.data.lostReasonNote && (
                        <span className="truncate italic">«{l.data.lostReasonNote}»</span>
                      )}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    {l.data.telefono && (
                      <>
                        <a
                          href={`tel:${l.data.telefono}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
                          title={`Chiama ${l.data.telefono}`}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={buildWhatsAppLink(l.data.telefono, messaggio)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                          title="Scrivi su WhatsApp per riaprire il discorso"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </>
                    )}
                    {/*  Riprendere non è cambiare stato e basta: serve una data,
                        altrimenti la trattativa torna aperta e si riperde. Il
                        popup del ricontatto la chiede. */}
                    <button
                      type="button"
                      onClick={() => setRicontatto(l)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 text-[11.5px] font-medium text-sky-700 hover:bg-sky-500/15"
                      title="Rimette la trattativa in coda con una data di ricontatto"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Riprendi
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {elenco.length > 120 && (
          <p className="border-t border-border px-4 py-2 text-[11.5px] text-muted-foreground">
            Mostrate le 120 più recenti su {elenco.length}: restringi il periodo o scegli un motivo.
          </p>
        )}
      </Scheda>

      {/* ── DOVE SI PERDE ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TabellaGruppi
          titolo="Per consulente"
          nota="Se un motivo pesa solo su una persona, è formazione — non mercato"
          righe={perConsulente}
        />
        <TabellaGruppi
          titolo="Per annuncio"
          nota="Un annuncio che porta sempre lo stesso motivo sta portando le persone sbagliate"
          righe={perCreative}
        />
      </div>

      {/* La scheda completa: da lì si registra il motivo mancante. */}
      <LeadDialog
        open={schedaLead !== null}
        onOpenChange={(v) => {
          if (!v) setSchedaLead(null);
        }}
        lead={schedaLead}
      />

      {/* Riprendi: chiede la data del ricontatto e riapre la trattativa. */}
      <QuickStatusDialog
        open={ricontatto !== null}
        onOpenChange={(v) => {
          if (!v) setRicontatto(null);
        }}
        lead={ricontatto}
        newStatus={ricontatto ? "da_ricontattare" : null}
      />
    </Pagina>
  );
}

/** Le due letture secondarie: chi perde e cosa porta a perdere. Stessa forma
 *  per tutte e due, così si confrontano senza rileggere l'intestazione. */
function TabellaGruppi({
  titolo,
  nota,
  righe,
}: {
  titolo: string;
  nota: string;
  righe: Gruppo[];
}) {
  return (
    <Scheda titolo={titolo} nota={nota} senzaPadding>
      {righe.length === 0 ? (
        <VuotoRiga testo="Nessun dato nel periodo." />
      ) : (
        <ul className="divide-y divide-border">
          {righe.map((r) => (
            <li key={r.chiave} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{r.etichetta}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {r.totale} {r.totale === 1 ? "persa" : "perse"}
                  {r.senzaMotivo > 0 && (
                    <span className="text-amber-700"> · {r.senzaMotivo} senza motivo</span>
                  )}
                </div>
              </div>
              {r.motivoPrincipale && (
                <span className="shrink-0 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {LOST_REASON_LABEL[r.motivoPrincipale]} · {r.conteggioPrincipale}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Scheda>
  );
}
