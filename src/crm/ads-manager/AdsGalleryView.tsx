import { ImageIcon, Flame, Pause, Play, Eye, Film, ExternalLink } from "lucide-react";
import { FatigueSparkline } from "./FatigueSparkline";
import { HealthPill } from "./AdsInsightsUI";
import { fmtEUR, fmtINT, fmtPCT, fmtX } from "./columns";
import {
  type QualityResult,
  TIER_LABEL,
  TIER_SHORT,
  tierRingClass,
  tierBadgeClass,
} from "./quality-rank";
import type { Verdict } from "./verdict";
import { VerdictBadge } from "./VerdictBadge";
import { BotSuspectBadge } from "./BotSuspectBadge";

/** Vista alternativa alla tabella: griglia di card grandi con thumbnail + KPI overlay
 *  + badge fatigue/health/classifica. Pensata per chi ragiona visivamente sulle creative.
 *  Non duplica logica analitica: riceve già perf, classification, fatigue map e health map.
 */

type AdLike = {
  id: string;
  name: string;
  status: string;
  creative: {
    thumbnail: string | null;
    isVideo?: boolean;
    videoDuration?: number | null;
    videoFileName?: string | null;
  } | null;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PerfLike = any;

/** Formatta secondi → "M:SS" (es. 75 → "1:15"). Restituisce null se invalido. */
function fmtDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface GalleryProps {
  ads: AdLike[];
  perfByAd: Map<string, PerfLike>;
  classification: Map<string, QualityResult>;
  classifyOn: boolean;
  fatigueMap: Map<string, { isFatigued: boolean; reasons: string[] }>;
  healthMap: Map<string, number | null>;
  /** Verdetto operativo per ogni ad (Step 2 refactor). Opzionale per backward-compat. */
  verdictMap?: Map<string, Verdict>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onOpenFatigue: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  resuming: boolean;
  /** Criterio di ordinamento delle card. Se omesso, usa l'ordine in input. */
  sortBy?: "spend" | "lead" | "roas" | "health" | "fatigue";
  /** Estremi del periodo: servono al popover del sospetto bot per andare a
   *  ripescare le ultime sessioni sospette. Senza, il badge non compare. */
  sinceISO?: string;
  untilISO?: string;
}

export function AdsGalleryView(p: GalleryProps) {
  if (p.ads.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        Nessuna inserzione da mostrare.
      </div>
    );
  }
  // Applica sort: dal più alto al più basso. Per fatigue, più alto = peggio = primo.
  const sortedAds = p.sortBy
    ? [...p.ads].sort((a, b) => {
        const pa = p.perfByAd.get(a.id);
        const pb = p.perfByAd.get(b.id);
        const get = (item: PerfLike | undefined, ad: AdLike): number => {
          if (p.sortBy === "health") return p.healthMap.get(ad.id) ?? -1;
          if (p.sortBy === "fatigue") return Number(item?.fatigueScore ?? 0);
          if (p.sortBy === "lead") return Number(item?.lead ?? 0);
          if (p.sortBy === "roas") return Number(item?.roas ?? 0);
          return Number(item?.spend ?? 0);
        };
        return get(pb, b) - get(pa, a);
      })
    : p.ads;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
      {sortedAds.map((a) => {
        const perf = p.perfByAd.get(a.id);
        const cls = p.classifyOn ? p.classification.get(a.id) : undefined;
        const fat = p.fatigueMap.get(a.id);
        const health = p.healthMap.get(a.id) ?? null;
        const isSel = p.selected.has(a.id);
        const isPaused = /PAUSED/i.test(a.status);

        const ringCls = cls
          ? tierRingClass(cls.tier)
          : fat?.isFatigued
            ? "ring-2 ring-rose-300"
            : isSel
              ? "ring-2 ring-[oklch(0.55_0.18_252)]"
              : "ring-1 ring-border hover:ring-[oklch(0.55_0.18_252)]/40";

        return (
          <div
            key={a.id}
            className={`group relative bg-white rounded-xl overflow-hidden ${ringCls} transition-all cursor-pointer flex flex-col`}
            onClick={() => p.onOpen(a.id)}
          >
            {/* Thumbnail con overlay — click apre l'inserzione su Meta Ads Manager */}
            <a
              href={`https://www.facebook.com/adsmanager/manage/ads?selected_ad_ids=${a.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Apri su Meta Ads Manager"
              className="group/thumb relative aspect-square bg-gradient-to-br from-[oklch(0.92_0.02_252)] to-[oklch(0.86_0.04_252)] grid place-items-center overflow-hidden block"
            >
              {a.creative?.thumbnail ? (
                <img src={a.creative.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              )}

              {/* External-link hint visible on hover — comunica visivamente che è cliccabile */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10 px-2 py-1 rounded-full bg-black/75 text-white text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm pointer-events-none">
                <ExternalLink className="h-2.5 w-2.5" />
                Apri su Meta
              </div>

              {/* Overlay video: nome file (in basso a sx) + durata (in basso a dx, stile YouTube).
                  Gradient nero in basso per garantire leggibilità sopra qualsiasi thumbnail. */}
              {a.creative?.isVideo && (a.creative?.videoFileName || a.creative?.videoDuration) && (
                <>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none" />
                  {a.creative?.videoFileName && (
                    <div
                      className="absolute bottom-1.5 left-1.5 right-14 flex items-center gap-1 text-[10px] font-medium text-white/95 truncate"
                      title={a.creative.videoFileName}
                    >
                      <Film className="h-3 w-3 shrink-0 opacity-80" />
                      <span className="truncate">{a.creative.videoFileName}</span>
                    </div>
                  )}
                  {fmtDuration(a.creative?.videoDuration) && (
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-semibold tabular-nums tracking-tight">
                      {fmtDuration(a.creative?.videoDuration)}
                    </div>
                  )}
                </>
              )}

              {/* Checkbox top-left */}
              <div className="absolute top-2 left-2">
                <input
                  type="checkbox"
                  checked={isSel}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => p.onToggleSelect(a.id)}
                  className="h-4 w-4 accent-[oklch(0.55_0.18_252)] rounded"
                />
              </div>

              {/* Badge top-right: health + classifica */}
              <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                {health != null && <HealthPill score={health} />}
                {cls && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold border backdrop-blur-sm ${tierBadgeClass(cls.tier)}`}
                    title={
                      cls.reason
                        ? `⚠ FORZATA: ${cls.reason}\n${TIER_LABEL[cls.tier]} · score ${cls.score}/100 (cap)`
                        : `${TIER_LABEL[cls.tier]} · score ${cls.score}/100 (z=${cls.z.toFixed(2)})`
                    }
                  >
                    {TIER_SHORT[cls.tier]} {cls.score}
                    {cls.reason && <span className="ml-0.5">⚠</span>}
                  </span>
                )}
                {/* Motivo gating in chiaro nella card gallery */}
                {cls?.reason && (
                  <span className="text-[9.5px] bg-rose-50/95 text-rose-800 border border-rose-200 rounded px-1.5 py-0.5 max-w-[180px] text-right backdrop-blur-sm">
                    {cls.reason}
                  </span>
                )}
              </div>

              {/* Fatigue badge bottom-left */}
              {fat?.isFatigued && (
                <div className="absolute bottom-2 left-2">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100/95 text-rose-800 backdrop-blur-sm"
                    title={`Stanca: ${fat.reasons.join(" · ")}`}
                  >
                    <Flame className="h-3 w-3" /> Stanca {perf?.fatigueScore ?? ""}
                  </span>
                </div>
              )}

              {/* Status badge bottom-right */}
              <div className="absolute bottom-2 right-2">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm ${isPaused ? "bg-slate-100/95 text-slate-700" : "bg-emerald-100/95 text-emerald-800"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isPaused ? "bg-slate-400" : "bg-emerald-500"}`}
                  />
                  {isPaused ? "Pausa" : "Attivo"}
                </span>
              </div>

              {/* KPI overlay sopra al hover */}
              <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="grid grid-cols-2 gap-1 text-[10.5px]">
                  <KpiOverlay label="Spesa" value={fmtEUR(perf?.spend ?? null)} />
                  <KpiOverlay label="Lead" value={fmtINT(perf?.lead ?? null)} />
                  <KpiOverlay label="ROAS" value={fmtX(perf?.roas ?? null)} />
                  <KpiOverlay label="CPL" value={fmtEUR(perf?.cpl ?? null)} />
                </div>
              </div>
            </a>

            {/* Body */}
            <div className="p-2.5 space-y-1.5">
              {(() => {
                const v = p.verdictMap?.get(a.id);
                //  Il sospetto bot stava accanto al nome nella tabella a ottanta
                //  colonne: sparita quella, il segnale sarebbe sparito con lei.
                //  Vive qui, dove si guarda la singola creativa, ed è uguale su
                //  Meta e su TikTok perché la galleria è la stessa.
                const sessioni = Number(perf?.lpSessions ?? 0);
                const bot = Number(perf?.lpBots ?? 0);
                const totali = sessioni + bot;
                const quotaBot = totali > 0 ? (bot / totali) * 100 : 0;
                const mostraBot = p.sinceISO && p.untilISO && sessioni >= 10 && quotaBot > 30;
                if (!v && !mostraBot) return null;
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {v && <VerdictBadge verdict={v} size="sm" />}
                    {mostraBot && (
                      <BotSuspectBadge
                        adId={a.id}
                        bots={bot}
                        totalSessions={totali}
                        botRate={quotaBot}
                        sinceISO={p.sinceISO!}
                        untilISO={p.untilISO!}
                      />
                    )}
                  </div>
                );
              })()}
              <div className="text-[12px] font-semibold truncate" title={a.name}>
                {a.name}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <KpiCell label="Spesa" value={fmtEUR(perf?.spend ?? null)} />
                <KpiCell label="Lead" value={fmtINT(perf?.lead ?? null)} />
                <KpiCell
                  label="ROAS"
                  value={fmtX(perf?.roas ?? null)}
                  tone={
                    perf && perf.roas >= 2 ? "good" : perf && perf.roas > 0 ? "warn" : undefined
                  }
                />
                <KpiCell
                  label="Netto"
                  value={fmtEUR(perf?.netto ?? null)}
                  tone={
                    perf && perf.netto > 0 ? "good" : perf && perf.netto < 0 ? "bad" : undefined
                  }
                />
              </div>
              {/* Funnel + sparkline */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-[10.5px] text-muted-foreground tabular-nums">
                  Hook{" "}
                  <span className="font-semibold text-foreground">
                    {fmtPCT(perf?.hookRate ?? null)}
                  </span>
                  {" · "}
                  Hold{" "}
                  <span className="font-semibold text-foreground">
                    {fmtPCT(perf?.holdRate ?? null)}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onOpenFatigue(a.id);
                  }}
                >
                  <FatigueSparkline trend={perf?.trend ?? []} />
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
              style={{ top: "auto", bottom: "auto" }}
            >
              {/* Hover-only icon row: appare sotto la thumbnail su hover */}
            </div>
            <div className="px-2.5 pb-2.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  p.onOpen(a.id);
                }}
                className="h-7 w-7 grid place-items-center rounded-md hover:bg-secondary"
                title="Dettaglio"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              {isPaused ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onResume(a.id);
                  }}
                  disabled={p.resuming}
                  className="h-7 w-7 grid place-items-center rounded-md hover:bg-emerald-50 text-emerald-700 disabled:opacity-50"
                  title="Riattiva"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onPause(a.id);
                  }}
                  className="h-7 w-7 grid place-items-center rounded-md hover:bg-secondary"
                  title="Pausa"
                >
                  <Pause className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "text-emerald-700"
      : tone === "bad"
        ? "text-rose-600"
        : tone === "warn"
          ? "text-amber-700"
          : "text-foreground";
  return (
    <div className="rounded-md bg-secondary/40 px-1.5 py-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">
        {label}
      </div>
      <div className={`text-[11.5px] font-semibold tabular-nums leading-tight mt-0.5 ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function KpiOverlay({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="opacity-80">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
