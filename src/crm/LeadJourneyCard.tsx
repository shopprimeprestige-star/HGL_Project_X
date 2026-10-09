/** ─────────────────────────────────────────────────────────────────────────
 *  LeadJourneyCard — IL PERCORSO DEL CLIENTE PRIMA DI DIVENTARE UN LEAD
 *
 *  Sta dentro la scheda della trattativa (linguetta «Anagrafica»), quindi vive
 *  DENTRO una finestra: deve essere fatto dello stesso materiale di tutto il
 *  resto della finestra, e prima non lo era. Era rimasto l'ultimo pezzo con la
 *  vecchia tavolozza: sette colori diversi per sette tipi di evento (blu,
 *  viola, ciano, ambra, rosa, verde, zinco), riquadri `bg-secondary`, testo a
 *  10px. Sette colori su una lista di trenta righe non sono un'informazione:
 *  sono un tappeto, e il lettore smette di cercarci un significato.
 *
 *  COSA DICE IL COLORE, ADESSO
 *  Un percorso è STORIA: non c'è niente da fare adesso, quindi niente sky e
 *  niente ambra. Tutti i passaggi sono neutri e uno solo è colorato — il
 *  momento della conversione (emerald = fatto). Il primo e l'ultimo contatto,
 *  che sono le due righe su cui si litiga quando si attribuisce una vendita,
 *  si riconoscono da un'etichetta scritta, non da una tinta.
 *
 *  MOBILE PRIMA
 *  La tabella a cinque colonne usciva dallo schermo del telefono. Qui ogni
 *  passaggio è una riga che si impila: ora e tipo sopra, annuncio e campagna
 *  sotto. Sul monitor le due parti tornano affiancate.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import {
  Fingerprint,
  GitMerge,
  Info,
  Loader2,
  Monitor,
  MousePointerClick,
  Smartphone,
} from "lucide-react";
import { getLeadJourney } from "@/crm/ads-financials.functions";
import { LeadJourneySankey } from "@/crm/LeadJourneySankey";
import { Chip, dataBreve, type Tono } from "@/crm/ui";
import { KpiFinestra, NotaFinestra, SezioneFinestra, VuotoFinestra } from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";

interface JourneyData {
  ok: boolean;
  error: string | null;
  externalId: string | null;
  email: string | null;
  sessionsCount: number;
  distinctAds: number;
  eventsCount: number;
  firstSeen: string | null;
  lastTouch: string | null;
  firstClickAdId: string | null;
  lastClickAdId: string | null;
  adIds: string[];
  touchpoints: Array<{
    ts: string;
    sessionId: string;
    eventName: string;
    adId: string | null;
    adName: string | null;
    campaignId: string | null;
    utmSource: string | null;
    utmCampaign: string | null;
    device: string | null;
  }>;
}

/** Giorno e ora sulla stessa riga: si leggono a confronto fra loro, quindi
 *  vanno sempre nello stesso formato e in cifre incolonnate. */
function quando(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString(
    "it-IT",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

/** ── I NOMI DEGLI EVENTI, IN ITALIANO E CON UN SOLO COLORE ────────────────
 *  Gli eventi arrivano dal tracciamento con i nomi tecnici di Meta: qui
 *  diventano parole che si capiscono senza sapere cos'è un «ViewContent».
 *  Il tono è neutro per tutti tranne la conversione: è l'unico passaggio che
 *  cambia qualcosa: da lì in poi questa persona è una trattativa. */
const EVENTI: Record<string, { etichetta: string; tono: Tono }> = {
  PageView: { etichetta: "Visita", tono: "neutro" },
  HighQualityVisit: { etichetta: "Visita attenta", tono: "neutro" },
  Scroll: { etichetta: "Scorrimento", tono: "neutro" },
  Click: { etichetta: "Clic", tono: "neutro" },
  ViewContent: { etichetta: "Pagina vista", tono: "neutro" },
  AddToCart: { etichetta: "Passo del funnel", tono: "neutro" },
  Lead: { etichetta: "Diventa lead", tono: "vinta" },
};

function evento(nome: string): { etichetta: string; tono: Tono } {
  return EVENTI[nome] ?? { etichetta: nome, tono: "neutro" };
}

/** L'identificativo di un annuncio è lungo e illeggibile: se c'è il nome si
 *  mostra quello, altrimenti la coda del codice — che almeno si confronta. */
function nomeAnnuncio(adName: string | null, adId: string | null): string {
  if (adName) return adName;
  if (adId) return `…${adId.slice(-8)}`;
  return "—";
}

interface TouchHistoryItem {
  ch?: string;
  ts?: number | string;
  utm_source?: string | null;
  utm_campaign?: string | null;
  page?: string | null;
}

export function LeadJourneyCard({
  leadId,
  accessToken,
  touchHistory,
}: {
  leadId: string;
  accessToken: string;
  touchHistory?: TouchHistoryItem[] | null;
}) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCaricamento(true);
    setErrore(null);
    getLeadJourney({ data: { accessToken, leadId, lookbackDays: 90 } })
      .then((r) => {
        if (vivo) setData(r as JourneyData);
      })
      .catch((e) => {
        if (vivo) setErrore(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (vivo) setCaricamento(false);
      });
    return () => {
      vivo = false;
    };
  }, [accessToken, leadId]);

  if (caricamento) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ricostruzione del percorso…
      </div>
    );
  }

  if (errore) {
    return (
      <NotaFinestra tono="attenzione" icona={Info}>
        Il percorso non si è potuto ricostruire: {errore}
      </NotaFinestra>
    );
  }

  if (!data) return null;

  /*  I contatti salvati sulla scheda pubblica si mostrano SEMPRE, anche quando
      il tracciamento pubblicitario non risponde: sono l'unica cosa che si sa
      di sicuro, perché li ha scritti la landing quando la persona è arrivata. */
  const contattiReali =
    touchHistory && touchHistory.length > 0 ? (
      <SezioneFinestra
        titolo="Contatti registrati dalla landing"
        nota={`${touchHistory.length} passaggi, dal primo all'ultimo`}
        icona={MousePointerClick}
        senzaPadding
      >
        <ol className="divide-y divide-slate-200">
          {touchHistory
            .slice()
            .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0))
            .map((t, i) => {
              const ms = typeof t.ts === "number" ? t.ts : t.ts ? Date.parse(String(t.ts)) : 0;
              return (
                <li key={i} className="flex items-center gap-2.5 px-4 py-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold tabular-nums text-slate-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium capitalize text-slate-900">
                      {t.ch || "Origine non dichiarata"}
                    </span>
                    {t.utm_campaign ? (
                      <span className="block truncate text-[11px] text-slate-500">
                        {t.utm_campaign}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {ms ? quando(new Date(ms).toISOString()) : "—"}
                  </span>
                </li>
              );
            })}
        </ol>
      </SezioneFinestra>
    ) : null;

  /*  Senza identificativo pubblicitario non c'è niente da attribuire: si dice
      perché, invece di mostrare quattro zeri che sembrano un dato. */
  if (!data.externalId) {
    return (
      <div className="space-y-3">
        {contattiReali}
        <NotaFinestra icona={Info}>
          {data.error ||
            "Questo contatto non porta un identificativo di tracciamento: è stato inserito a mano, importato, o è arrivato prima che il tracciamento fosse attivo."}
        </NotaFinestra>
      </div>
    );
  }

  const piuVisite = data.distinctAds > 1 || data.sessionsCount > 1;
  const piuAnnunci =
    !!data.firstClickAdId && !!data.lastClickAdId && data.firstClickAdId !== data.lastClickAdId;

  return (
    <div className="space-y-3">
      {/* ── I QUATTRO NUMERI ──────────────────────────────────────────────
          Rispondono alle sole domande che si fanno qui: quante volte è
          tornato, quanti annunci l'hanno toccato, quando è iniziato e quando
          si è convertito. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiFinestra
          etichetta="Visite"
          valore={data.sessionsCount}
          nota="prima di lasciare i dati"
          forte
        />
        <KpiFinestra
          etichetta="Annunci diversi"
          valore={data.distinctAds}
          nota={`${data.eventsCount} eventi in tutto`}
        />
        <KpiFinestra
          etichetta="Primo contatto"
          valore={data.firstSeen ? dataBreve(data.firstSeen) : "—"}
          nota={
            data.firstClickAdId ? `annuncio …${data.firstClickAdId.slice(-8)}` : "annuncio ignoto"
          }
        />
        <KpiFinestra
          etichetta="Conversione"
          valore={data.lastTouch ? dataBreve(data.lastTouch) : "—"}
          nota={
            data.lastClickAdId ? `annuncio …${data.lastClickAdId.slice(-8)}` : "annuncio ignoto"
          }
        />
      </div>

      {/* ── A CHI SI ATTRIBUISCE LA VENDITA ───────────────────────────────
          Quando il primo e l'ultimo clic sono su due annunci diversi, il
          merito dipende da quale modello si guarda: dirlo qui evita di
          scoprirlo litigando sui rapporti di spesa. */}
      {piuAnnunci && (
        <NotaFinestra icona={Fingerprint}>
          Toccato da <strong className="font-medium">più annunci</strong>: primo clic su{" "}
          <span className="font-mono text-[11px]">…{data.firstClickAdId?.slice(-10)}</span>, ultimo
          clic su <span className="font-mono text-[11px]">…{data.lastClickAdId?.slice(-10)}</span>.
        </NotaFinestra>
      )}
      {piuVisite && !piuAnnunci && (
        <NotaFinestra icona={Fingerprint}>
          {data.sessionsCount} visite sullo stesso annuncio prima di lasciare i dati.
        </NotaFinestra>
      )}

      {/* ── IL FLUSSO FRA GLI ANNUNCI ─────────────────────────────────── */}
      {data.touchpoints.length > 0 && data.distinctAds > 1 && (
        <SezioneFinestra
          titolo="Da quale annuncio a quale"
          nota="In ordine di tempo: primo · intermedi · ultimo"
          icona={GitMerge}
          classeCorpo="p-2 overflow-x-auto"
        >
          <LeadJourneySankey
            touchpoints={data.touchpoints.map((t) => ({
              ts: t.ts,
              adId: t.adId,
              adName: t.adName,
            }))}
            firstClickAdId={data.firstClickAdId}
            lastClickAdId={data.lastClickAdId}
          />
        </SezioneFinestra>
      )}

      {/* ── OGNI PASSAGGIO, IN ORDINE ─────────────────────────────────────
          Una riga per passaggio invece di una tabella: sul telefono le cinque
          colonne finivano fuori schermo e si leggeva solo l'orario. */}
      <SezioneFinestra
        titolo="Passaggio per passaggio"
        nota={
          data.touchpoints.length
            ? `${data.touchpoints.length} eventi · i più recenti in fondo`
            : undefined
        }
        icona={MousePointerClick}
        senzaPadding
      >
        {data.touchpoints.length === 0 ? (
          <div className="p-4">
            <VuotoFinestra testo="Nessun passaggio tracciato: il contatto non è passato dalla landing." />
          </div>
        ) : (
          <ol className="max-h-80 divide-y divide-slate-200 overflow-y-auto overscroll-contain">
            {data.touchpoints.map((t, i) => {
              const e = evento(t.eventName);
              const Dispositivo = t.device === "desktop" ? Monitor : Smartphone;
              const primo = !!t.adId && t.adId === data.firstClickAdId && i === 0;
              const ultimo =
                !!t.adId && t.adId === data.lastClickAdId && i === data.touchpoints.length - 1;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3",
                    e.tono === "vinta" && "bg-emerald-50/50",
                  )}
                >
                  <span className="flex items-center gap-2 sm:w-40 sm:shrink-0">
                    <span className="text-[11.5px] tabular-nums text-slate-500">
                      {quando(t.ts)}
                    </span>
                    <Dispositivo
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      aria-label={t.device === "desktop" ? "Da computer" : "Da telefono"}
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <Chip tono={e.tono} punto={e.tono !== "neutro"}>
                      {e.etichetta}
                    </Chip>
                    <span
                      className="min-w-0 truncate text-[12px] text-slate-700"
                      title={t.adName || t.adId || ""}
                    >
                      {nomeAnnuncio(t.adName, t.adId)}
                    </span>
                    {(t.utmCampaign || t.utmSource) && (
                      <span className="min-w-0 truncate text-[11px] text-slate-500">
                        · {t.utmCampaign || t.utmSource}
                      </span>
                    )}
                    {primo && (
                      <span className="text-[11px] font-medium text-slate-500">primo clic</span>
                    )}
                    {ultimo && (
                      <span className="text-[11px] font-medium text-slate-500">ultimo clic</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </SezioneFinestra>

      {contattiReali}
    </div>
  );
}
