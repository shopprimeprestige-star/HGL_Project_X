// ── DA DOVE ARRIVANO I CLIENTI ──────────────────────────────────────────────
//  A cosa serve questa pagina: sapere quale pubblicità porta persone che poi
//  comprano davvero, e quale porta solo traffico. Non è la pagina dei costi
//  (quella è /CRM/kpi) né quella delle campagne (/CRM/campagne-meta): qui si
//  guarda il PERCORSO di una persona, dal primo annuncio visto al momento in
//  cui ha lasciato il numero.
//
//  COSA È CAMBIATO, E PERCHÉ
//   · PARLA ITALIANO. La pagina si chiamava «Attribution» e diceva first-click,
//     last-click, assist, touches, Direct, CR, multi-touch. Chi la usa vende
//     impianti di capelli: adesso legge «primo annuncio», «ultimo annuncio»,
//     «ha aiutato», «persone», «nessun annuncio», e ha una legenda che spiega
//     le quattro parole senza presupporre un corso di marketing.
//   · STESSI MATTONI DEL RESTO DEL CRM. Card/CardHeader di shadcn erano rimasti
//     solo qui: ogni blocco aveva il suo padding e la sua misura di titolo.
//     Adesso Pagina · Titolo · BarraAzioni · Scheda · Kpi come nelle altre venti
//     schermate, così passare da una pagina all'altra non fa «saltare» niente.
//   · IL DIAGRAMMA NON È PIÙ L'UNICA COPIA DEL DATO. Il flusso Sankey e
//     l'elenco «Top 10 sequenze» dicevano la stessa cosa in due blocchi; il
//     diagramma, per giunta, su un telefono era illeggibile. Ora sono un blocco
//     solo (FlussoAnnunci): l'elenco in parole e numeri c'è sempre, la figura
//     compare dove c'è spazio per leggerla.
//   · MENO COLONNE, PIÙ DECISIONI. Dalla classifica annunci sono sparite
//     «Touches» e «€/Assist»: erano due modi indiretti di dire quello che il
//     riquadro «Aiutano ma non chiudono mai» dice a chiare lettere e con il
//     pulsante per filtrare.
//   · SUL TELEFONO SI LEGGE. Le due tabelle (sette colonne la classifica, sei
//     l'elenco persone) sotto i 640px diventano una scheda per riga: le stesse
//     informazioni su tre righe di testo, senza scorrimento laterale. La
//     classifica porta con sé i tre ordinamenti che servono, perché senza le
//     intestazioni da premere non ci sarebbe altro modo di riordinarla.
//   · PREMERE UN ANNUNCIO FA SEMPRE LA STESSA COSA. Il nome dell'annuncio nella
//     classifica e i riquadri «aiutano ma non chiudono mai» impostavano un
//     filtro su una tabella che stava due schermate più in basso: si premeva e
//     non succedeva niente di visibile. Ora aprono le persone, come i nodi del
//     diagramma e le tappe dei percorsi.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Foglio, VuotoFinestra } from "@/crm/ui/Finestra";
import { Activity, GitMerge, Loader2, RefreshCw, Search, TrendingDown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCRM } from "@/crm/CRMContext";
import { LeadDialog } from "@/crm/LeadDialog";
import { SortableHeader } from "@/crm/SortableHeader";
import type { SankeyNodeClick } from "@/crm/AttributionSankeyChart";
import { FlussoAnnunci } from "@/crm/attribution/FlussoAnnunci";
import {
  LegendaAttribuzione,
  NESSUN_ANNUNCIO,
  PAROLE,
  TITOLO_RUOLO,
} from "@/crm/attribution/parole";
import { MetaVsTikTokSection } from "@/crm/attribution/MetaVsTikTokSection";
import {
  BarraAzioni,
  Chip,
  Kpi,
  KpiRiga,
  Pagina,
  Scheda,
  Segmento,
  SepBarra,
  Titolo,
  Vuoto,
  VuotoRiga,
  dataBreve,
  eur,
} from "@/crm/ui";
import { useSortableTable, applySort, type SortState } from "@/crm/useSortableTable";
import {
  getAttributionOverview,
  type AttributionJourneyRow,
  type AttributionAdRanking,
  type AttributionCampaignRanking,
  type AttributionPathRow,
  type AttributionSummary,
} from "@/crm/ads-financials.functions";
import type { Lead } from "@/crm/types";

export const Route = createFileRoute("/CRM/attribuzione")({
  component: PaginaAttribuzione,
});

function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onClick,
  align = "right",
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onClick: (k: K) => void;
  align?: "left" | "right" | "center";
}) {
  return (
    <th className={`px-3 py-2 font-medium text-${align}`}>
      <SortableHeader
        label={label}
        active={sort.key === sortKey}
        dir={sort.key === sortKey ? sort.dir : null}
        align={align}
        onClick={() => onClick(sortKey)}
      />
    </th>
  );
}

const PERIODI = [7, 14, 30, 60, 90];

/** Un annuncio senza nome è un id di trenta cifre: si mostra la coda, che è
 *  l'unica parte che si riconosce a colpo d'occhio in Gestione inserzioni. */
function etichettaAnnuncio(a: { adName: string | null; adId: string }): string {
  return a.adName || `…${a.adId.slice(-10)}`;
}

/** Su telefono la classifica non ha intestazioni da premere: l'ordine si
 *  sceglie qui. Tre voci, quelle su cui si decide davvero. */
const ORDINE_MOBILE: { chiave: ChiaveAnnuncio; breve: string; titolo: string }[] = [
  { chiave: "lastClicks", breve: "Chiude", titolo: "Dal più visto subito prima del contatto" },
  { chiave: "uniqueLeads", breve: "Persone", titolo: "Da quello visto da più persone" },
  { chiave: "spend", breve: "Spesa", titolo: "Da quello che costa di più" },
];

function isoGiorniFa(giorni: number): string {
  const d = new Date();
  d.setDate(d.getDate() - giorni);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Variazione rispetto al periodo prima, già scritta come si legge: «+12% sul
 *  periodo prima». Null quando il confronto non è chiesto o non ha senso
 *  (dividere per zero). */
function variazione(ora: number, prima: number | undefined): string | null {
  if (prima === undefined) return null;
  if (prima === 0) return ora === 0 ? "uguale al periodo prima" : "nessun dato prima";
  const d = ((ora - prima) / prima) * 100;
  if (Math.abs(d) < 0.5) return "uguale al periodo prima";
  return `${d > 0 ? "+" : ""}${d.toFixed(0)}% sul periodo prima`;
}

interface DatiPagina {
  ok: boolean;
  summary: AttributionSummary;
  previousSummary: AttributionSummary | null;
  journeys: AttributionJourneyRow[];
  adRanking: AttributionAdRanking[];
  campaignRanking: AttributionCampaignRanking[];
  topPaths: AttributionPathRow[];
}

type ChiaveAnnuncio =
  | "adName"
  | "firstClicks"
  | "lastClicks"
  | "assists"
  | "uniqueLeads"
  | "spend"
  | "costPerLead";
type ChiavePersona = "createdAt" | "fullName" | "sessionsCount" | "daysToConvert";

function PaginaAttribuzione() {
  const { leads } = useCRM();
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setToken(data.session?.access_token ?? "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setToken(s?.access_token ?? "");
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const [giorni, setGiorni] = useState<number>(30);
  const [confronta, setConfronta] = useState<boolean>(false);
  const [dati, setDati] = useState<DatiPagina | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [cerca, setCerca] = useState("");
  const [filtroAnnuncio, setFiltroAnnuncio] = useState<string>("all");
  const [filtroCampagna, setFiltroCampagna] = useState<string>("all");
  const [soloClienti, setSoloClienti] = useState(false);
  const [quantiAnnunci, setQuantiAnnunci] = useState<number>(10);
  const [flussoSoloClienti, setFlussoSoloClienti] = useState(false);
  const [leadAperto, setLeadAperto] = useState<Lead | null>(null);
  const [dettaglio, setDettaglio] = useState<SankeyNodeClick | null>(null);

  const ordineAnnunci = useSortableTable<ChiaveAnnuncio>();
  const ordinePersone = useSortableTable<ChiavePersona>();

  const carica = () => {
    if (!token) return;
    setCaricamento(true);
    setErrore(null);
    getAttributionOverview({
      data: {
        accessToken: token,
        sinceISO: isoGiorniFa(giorni),
        untilISO: new Date().toISOString(),
        lookbackDays: 90,
        comparePrevious: confronta,
      },
    })
      .then((r) => setDati(r as DatiPagina))
      .catch((e) => setErrore(e instanceof Error ? e.message : String(e)))
      .finally(() => setCaricamento(false));
  };

  useEffect(() => {
    carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [token, giorni, confronta]);

  const annunciFiltrati = useMemo(() => {
    if (!dati) return [];
    let righe = dati.adRanking;
    if (filtroCampagna !== "all") righe = righe.filter((r) => r.campaignId === filtroCampagna);
    return applySort(righe, ordineAnnunci.sort, (it, k) => {
      if (k === "adName") return it.adName || it.adId;
      const v = (it as unknown as Record<string, number | null>)[k];
      return v ?? -Infinity;
    });
  }, [dati, ordineAnnunci.sort, filtroCampagna]);

  const personeFiltrate = useMemo(() => {
    if (!dati) return [];
    let righe = dati.journeys;
    if (soloClienti) righe = righe.filter((j) => j.isConverted);
    if (filtroAnnuncio !== "all") {
      righe = righe.filter(
        (j) => j.firstClickAdId === filtroAnnuncio || j.lastClickAdId === filtroAnnuncio,
      );
    }
    if (filtroCampagna !== "all") righe = righe.filter((j) => j.campaignId === filtroCampagna);
    if (cerca.trim()) {
      const s = cerca.toLowerCase();
      righe = righe.filter(
        (j) =>
          (j.fullName || "").toLowerCase().includes(s) ||
          (j.email || "").toLowerCase().includes(s) ||
          (j.firstClickAdName || "").toLowerCase().includes(s) ||
          (j.lastClickAdName || "").toLowerCase().includes(s),
      );
    }
    return applySort(righe, ordinePersone.sort, (it, k) => {
      if (k === "createdAt") return new Date(it.createdAt).getTime();
      if (k === "fullName") return it.fullName || it.email || "";
      return (it as unknown as Record<string, number>)[k];
    });
  }, [dati, ordinePersone.sort, cerca, filtroAnnuncio, filtroCampagna, soloClienti]);

  //  Premere il nome di un annuncio, ovunque sia scritto, apre sempre la
  //  stessa cosa: le persone che l'hanno visto. Un nome che cambia effetto a
  //  seconda del blocco in cui sta è un nome su cui non si preme più.
  function apriAnnuncio(a: AttributionAdRanking) {
    setDettaglio({
      ruolo: "tutti",
      adId: a.adId,
      etichetta: etichettaAnnuncio(a),
      raggruppato: false,
    });
  }

  function apriPersona(j: AttributionJourneyRow) {
    if (j.source !== "crm") return;
    const trovato = leads.find((l) => l.id === j.leadId);
    if (trovato) setLeadAperto(trovato);
  }

  //  Le persone dietro a un annuncio, nel ruolo su cui si è premuto. È il
  //  passaggio che rende utile il diagramma: senza, resta un disegno.
  const personeDelNodo = useMemo(() => {
    if (!dettaglio || !dati) return [];
    const idsInVista = new Set(
      [...dati.adRanking]
        .sort((a, b) => b.totalTouches - a.totalTouches)
        .slice(0, quantiAnnunci)
        .map((a) => a.adId),
    );
    return dati.journeys
      .filter((j) => {
        //  «tutti» = premuto il nome dell'annuncio nella classifica: lì la
        //  domanda non è in che momento è stato visto, ma chi l'ha visto.
        if (dettaglio.ruolo === "tutti") {
          if (!dettaglio.adId) return false;
          return (
            j.firstClickAdId === dettaglio.adId ||
            j.lastClickAdId === dettaglio.adId ||
            j.intermediateAdIds.includes(dettaglio.adId)
          );
        }
        if (dettaglio.ruolo === "primo") {
          if (dettaglio.adId) return j.firstClickAdId === dettaglio.adId;
          if (dettaglio.etichetta === NESSUN_ANNUNCIO) return !j.firstClickAdId;
          return j.firstClickAdId !== null && !idsInVista.has(j.firstClickAdId);
        }
        if (dettaglio.ruolo === "ultimo") {
          if (dettaglio.adId) return j.lastClickAdId === dettaglio.adId;
          if (dettaglio.etichetta === NESSUN_ANNUNCIO) return !j.lastClickAdId;
          return j.lastClickAdId !== null && !idsInVista.has(j.lastClickAdId);
        }
        if (dettaglio.adId) return j.intermediateAdIds.includes(dettaglio.adId);
        return j.intermediateAdIds.some((id) => !idsInVista.has(id));
      })
      .slice(0, 200);
  }, [dettaglio, dati, quantiAnnunci]);

  //  Annunci che compaiono spesso nel mezzo del percorso ma non sono MAI
  //  l'ultimo prima del contatto, e intanto costano. Non è detto che vadano
  //  spenti — spesso fanno conoscere — ma sono la prima cosa da guardare
  //  quando il budget non torna.
  const nonChiudonoMai = useMemo(() => {
    if (!dati) return [];
    return dati.adRanking
      .filter((a) => a.lastClicks === 0 && a.assists >= 3 && a.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8);
  }, [dati]);

  const speseSprecate = nonChiudonoMai.reduce((s, a) => s + a.spend, 0);

  if (caricamento) {
    return (
      <Pagina larga>
        <div className="grid min-h-[50vh] place-items-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Sto ricostruendo i percorsi delle persone…
            </p>
          </div>
        </div>
      </Pagina>
    );
  }
  if (errore) {
    return (
      <Pagina larga>
        <Vuoto
          titolo="Non sono riuscito a leggere i dati"
          testo={errore}
          icona={GitMerge}
          azione={
            <Button variant="outline" size="sm" onClick={carica}>
              Riprova
            </Button>
          }
        />
      </Pagina>
    );
  }
  if (!dati) return null;

  const s = dati.summary;
  const p = dati.previousSummary;
  const percMultiAnnuncio = s.totalLeads ? (s.multiAdLeads / s.totalLeads) * 100 : 0;

  return (
    <Pagina larga>
      <Titolo
        testo="Da dove arrivano i clienti"
        icona={GitMerge}
        nota={
          <>
            {s.totalLeads} persone negli ultimi {giorni} giorni ·{" "}
            <span className="font-medium text-emerald-700">
              {s.convertedLeads} diventate clienti
            </span>
          </>
        }
        azioni={
          <Button variant="outline" size="sm" onClick={carica}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Aggiorna</span>
          </Button>
        }
      />

      <BarraAzioni>
        <span className="text-[11.5px] text-muted-foreground">Periodo</span>
        {PERIODI.map((g) => (
          <Segmento
            key={g}
            attivo={giorni === g}
            onClick={() => setGiorni(g)}
            titolo={`Persone arrivate negli ultimi ${g} giorni`}
          >
            {g} g
          </Segmento>
        ))}
        <SepBarra />
        <Segmento
          attivo={confronta}
          onClick={() => setConfronta((v) => !v)}
          titolo="Aggiunge sotto ogni numero quanto è cambiato rispetto ai giorni precedenti"
        >
          Confronta col periodo prima
        </Segmento>
      </BarraAzioni>

      {/* ── I QUATTRO NUMERI CHE SI GUARDANO PER PRIMI ───────────────────── */}
      <KpiRiga colonne={4}>
        <Kpi
          etichetta="Persone arrivate"
          valore={s.totalLeads}
          icona={Users}
          nota={
            variazione(s.totalLeads, p?.totalLeads) ?? `${s.convertedLeads} sono diventate clienti`
          }
        />
        <Kpi
          etichetta="Hanno visto più annunci"
          valore={s.multiAdLeads}
          tono={percMultiAnnuncio >= 30 ? "vinta" : "neutro"}
          nota={
            variazione(s.multiAdLeads, p?.multiAdLeads) ??
            `${percMultiAnnuncio.toFixed(0)}% del totale`
          }
        />
        <Kpi
          etichetta="Sono tornate più volte"
          valore={s.multiTouchLeads}
          nota={
            variazione(s.multiTouchLeads, p?.multiTouchLeads) ??
            `${s.avgSessions.toFixed(1)} visite a testa in media`
          }
        />
        <Kpi
          etichetta="Giorni per decidere"
          valore={`${s.avgDaysToConvert.toFixed(1)} g`}
          icona={Activity}
          tono={s.avgDaysToConvert > 14 ? "in_sospeso" : "neutro"}
          nota={
            variazione(s.avgDaysToConvert, p?.avgDaysToConvert) ??
            `${s.avgDistinctAds.toFixed(1)} annunci visti in media`
          }
        />
      </KpiRiga>

      <LegendaAttribuzione />

      {/* ── SOLDI CHE ESCONO SENZA CHIUDERE NIENTE ───────────────────────── */}
      {nonChiudonoMai.length > 0 && (
        <Scheda
          titolo="Aiutano, ma non chiudono mai"
          nota={`${nonChiudonoMai.length} annunci · ${eur(speseSprecate)} spesi nel periodo`}
          icona={TrendingDown}
          className="border-rose-200"
        >
          <p className="mb-3 text-[11.5px] leading-snug text-muted-foreground">
            Questi annunci vengono visti nel mezzo del percorso, ma non sono mai stati{" "}
            <span className="font-medium text-foreground">l'ultimo prima del contatto</span>.
            Possono servire a farsi conoscere: prima di spegnerli, guarda quante persone hanno
            portato.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {nonChiudonoMai.map((a) => (
              <button
                key={a.adId}
                type="button"
                /*  Prima questo pulsante impostava un filtro su una tabella che
                    sta due schermate più in basso: si premeva e non succedeva
                    niente di visibile. Ora apre subito le persone, come ogni
                    altro numero della pagina. */
                onClick={() =>
                  setDettaglio({
                    ruolo: "mezzo",
                    adId: a.adId,
                    etichetta: a.adName || `…${a.adId.slice(-10)}`,
                    raggruppato: false,
                  })
                }
                title="Mostra le persone che hanno visto questo annuncio"
                className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/40 px-3 py-2 text-left transition-colors hover:bg-rose-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">
                    {etichettaAnnuncio(a)}
                  </span>
                  <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                    ha aiutato {a.assists} volte · {a.uniqueLeads} persone · mai l'ultimo
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[12.5px] font-semibold tabular-nums text-rose-700">
                    {eur(a.spend)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">spesi</span>
                </span>
              </button>
            ))}
          </div>
        </Scheda>
      )}

      {/* ── IL PERCORSO: elenco sempre, figura dove c'è spazio ───────────── */}
      <FlussoAnnunci
        journeys={flussoSoloClienti ? dati.journeys.filter((j) => j.isConverted) : dati.journeys}
        adRanking={dati.adRanking}
        topPaths={dati.topPaths}
        topN={quantiAnnunci}
        onNodo={(n) => setDettaglio(n)}
        azioni={
          <>
            <Segmento
              attivo={flussoSoloClienti}
              onClick={() => setFlussoSoloClienti((v) => !v)}
              titolo="Mostra solo il percorso di chi ha comprato"
            >
              Solo chi ha comprato
            </Segmento>
            <Select
              value={String(quantiAnnunci)}
              onValueChange={(v) => setQuantiAnnunci(Number(v))}
            >
              <SelectTrigger className="h-8 w-[118px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 annunci</SelectItem>
                <SelectItem value="10">10 annunci</SelectItem>
                <SelectItem value="15">15 annunci</SelectItem>
                <SelectItem value="20">20 annunci</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* ── CONFRONTO FRA I DUE CANALI ───────────────────────────────────── */}
      <MetaVsTikTokSection
        sinceISO={isoGiorniFa(giorni).slice(0, 10)}
        untilISO={new Date().toISOString().slice(0, 10)}
      />

      {/* ── CLASSIFICA ANNUNCI ───────────────────────────────────────────── */}
      <Scheda
        titolo="Classifica degli annunci"
        nota="Cosa fa ogni annuncio nel percorso, e quanto costa"
        senzaPadding
        azioni={
          <Select value={filtroCampagna} onValueChange={setFiltroCampagna}>
            <SelectTrigger className="h-8 w-[200px] text-[12px]">
              <SelectValue placeholder="Tutte le campagne" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le campagne</SelectItem>
              {dati.campaignRanking.map((c) => (
                <SelectItem key={c.campaignId} value={c.campaignId}>
                  Campagna …{c.campaignId.slice(-8)} ({c.uniqueLeads} persone)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {/* ── SU TELEFONO: UNA SCHEDA PER ANNUNCIO ───────────────────────
             Sette colonne su 360px vogliono dire scorrere di lato per leggere
             una riga sola, e nessuno lo fa: le colonne che contano diventano
             tre righe di testo. L'ordine si sceglie qui, perché senza le
             intestazioni della tabella non ci sarebbe altro modo. */}
        <div className="sm:hidden">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Ordina per</span>
            {ORDINE_MOBILE.map((o) => (
              <Segmento
                key={o.chiave}
                attivo={ordineAnnunci.sort.key === o.chiave}
                onClick={() => ordineAnnunci.setSort({ key: o.chiave, dir: "desc" })}
                titolo={o.titolo}
              >
                {o.breve}
              </Segmento>
            ))}
          </div>
          {annunciFiltrati.length === 0 ? (
            <VuotoRiga testo="Nessun annuncio con dati nel periodo scelto." />
          ) : (
            <ul className="divide-y divide-border">
              {annunciFiltrati.map((a) => (
                <li key={a.adId}>
                  <button
                    type="button"
                    onClick={() => apriAnnuncio(a)}
                    className="w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                  >
                    <span className="block truncate text-[13px] font-medium">
                      {etichettaAnnuncio(a)}
                    </span>
                    {/*  Frasi intere, non sigle: «Ha portato al contatto 3» si
                         legge, «3 · 5 · 2» va decifrato ogni volta. Il numero
                         che decide — quante volte è stato l'ultimo — è l'unico
                         in grassetto. */}
                    <span className="mt-1 block text-[11.5px] leading-snug text-muted-foreground">
                      {PAROLE.ultimo.breve}{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {a.lastClicks}
                      </span>{" "}
                      {a.lastClicks === 1 ? "volta" : "volte"} · {PAROLE.primo.breve.toLowerCase()}{" "}
                      <span className="tabular-nums">{a.firstClicks}</span> ·{" "}
                      {PAROLE.mezzo.breve.toLowerCase()}{" "}
                      <span className="tabular-nums">{a.assists}</span>
                    </span>
                    <span className="mt-0.5 block text-[11.5px] tabular-nums text-muted-foreground">
                      {a.uniqueLeads} {a.uniqueLeads === 1 ? "persona" : "persone"}
                      {a.spend > 0 ? ` · ${eur(a.spend)} spesi` : ""}
                      {a.costPerLead != null ? ` · ${eur(a.costPerLead)} a persona` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden max-h-[420px] overflow-auto sm:block">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortTh
                  label="Annuncio"
                  sortKey="adName"
                  sort={ordineAnnunci.sort}
                  onClick={ordineAnnunci.onHeaderClick}
                  align="left"
                />
                <SortTh
                  label={PAROLE.primo.breve}
                  sortKey="firstClicks"
                  sort={ordineAnnunci.sort}
                  onClick={ordineAnnunci.onHeaderClick}
                />
                <SortTh
                  label={PAROLE.ultimo.breve}
                  sortKey="lastClicks"
                  sort={ordineAnnunci.sort}
                  onClick={ordineAnnunci.onHeaderClick}
                />
                <SortTh
                  label={PAROLE.mezzo.breve}
                  sortKey="assists"
                  sort={ordineAnnunci.sort}
                  onClick={ordineAnnunci.onHeaderClick}
                />
                <SortTh
                  label="Persone"
                  sortKey="uniqueLeads"
                  sort={ordineAnnunci.sort}
                  onClick={ordineAnnunci.onHeaderClick}
                />
                <SortTh
                  label="Spesa"
                  sortKey="spend"
                  sort={ordineAnnunci.sort}
                  onClick={ordineAnnunci.onHeaderClick}
                />
                <SortTh
                  label="€ a persona"
                  sortKey="costPerLead"
                  sort={ordineAnnunci.sort}
                  onClick={ordineAnnunci.onHeaderClick}
                />
              </tr>
            </thead>
            <tbody>
              {annunciFiltrati.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <VuotoRiga testo="Nessun annuncio con dati nel periodo scelto." />
                  </td>
                </tr>
              ) : (
                annunciFiltrati.map((a) => (
                  <tr key={a.adId} className="border-t border-border hover:bg-muted/30">
                    <td className="max-w-[280px] truncate px-3 py-2" title={a.adName || a.adId}>
                      <button
                        type="button"
                        className="max-w-full truncate text-left hover:underline"
                        onClick={() => apriAnnuncio(a)}
                        title="Mostra le persone che hanno visto questo annuncio"
                      >
                        {etichettaAnnuncio(a)}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.firstClicks || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {a.lastClicks || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {a.assists || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.uniqueLeads}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.spend > 0 ? eur(a.spend) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.costPerLead != null ? eur(a.costPerLead) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Scheda>

      {/* ── LE PERSONE, UNA PER UNA ──────────────────────────────────────── */}
      <Scheda
        titolo="Le persone, una per una"
        nota={`${personeFiltrate.length} righe · premi una riga per aprire la scheda`}
        senzaPadding
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-[190px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cerca nome, email o annuncio"
              className="h-8 pl-8 text-[12.5px]"
            />
          </div>
          <Select value={filtroAnnuncio} onValueChange={setFiltroAnnuncio}>
            <SelectTrigger className="h-8 w-[210px] text-[12px]">
              <SelectValue placeholder="Tutti gli annunci" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli annunci</SelectItem>
              {dati.adRanking.map((a) => (
                <SelectItem key={a.adId} value={a.adId}>
                  {etichettaAnnuncio(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmento
            attivo={soloClienti}
            onClick={() => setSoloClienti((v) => !v)}
            titolo="Mostra solo chi ha comprato"
          >
            Solo chi ha comprato
          </Segmento>
        </div>

        {/* ── SU TELEFONO: UNA SCHEDA PER PERSONA ───────────────────────── */}
        <div className="sm:hidden">
          {personeFiltrate.length === 0 ? (
            <VuotoRiga testo="Nessuna persona con questi filtri." />
          ) : (
            <ul className="max-h-[520px] divide-y divide-border overflow-auto">
              {personeFiltrate.map((j) => (
                <li key={`${j.source}-${j.leadId}`}>
                  <CartaPersona
                    j={j}
                    onApri={() => apriPersona(j)}
                    percorso
                    className="w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hidden max-h-[520px] overflow-auto sm:block">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortTh
                  label="Arrivata il"
                  sortKey="createdAt"
                  sort={ordinePersone.sort}
                  onClick={ordinePersone.onHeaderClick}
                  align="left"
                />
                <SortTh
                  label="Persona"
                  sortKey="fullName"
                  sort={ordinePersone.sort}
                  onClick={ordinePersone.onHeaderClick}
                  align="left"
                />
                <th className="px-3 py-2 text-left font-medium">Primo → ultimo annuncio</th>
                <SortTh
                  label="Visite"
                  sortKey="sessionsCount"
                  sort={ordinePersone.sort}
                  onClick={ordinePersone.onHeaderClick}
                />
                <SortTh
                  label="Giorni"
                  sortKey="daysToConvert"
                  sort={ordinePersone.sort}
                  onClick={ordinePersone.onHeaderClick}
                />
                <th className="px-3 py-2 text-center font-medium">Esito</th>
              </tr>
            </thead>
            <tbody>
              {personeFiltrate.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <VuotoRiga testo="Nessuna persona con questi filtri." />
                  </td>
                </tr>
              ) : (
                personeFiltrate.map((j) => (
                  <tr
                    key={`${j.source}-${j.leadId}`}
                    onClick={() => apriPersona(j)}
                    className={`border-t border-border hover:bg-muted/30 ${
                      j.source === "crm" ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                      {dataBreve(j.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[180px] truncate font-medium">{j.fullName || "—"}</div>
                      <div className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                        {j.email || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {/*  Primo e ultimo annuncio in una cella sola, uno sotto
                           l'altro: erano due colonne che si leggevano sempre
                           insieme e su schermo stretto costavano metà tabella. */}
                      <div className="max-w-[240px] truncate text-muted-foreground">
                        {nomeTappa(j.firstClickAdName, j.firstClickAdId)}
                      </div>
                      <div className="max-w-[240px] truncate font-medium">
                        ↓ {nomeTappa(j.lastClickAdName, j.lastClickAdId)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {j.sessionsCount}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        · {j.distinctAds} ann.
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {j.daysToConvert ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Chip tono={j.isConverted ? "vinta" : "da_lavorare"}>
                        {j.isConverted ? "Cliente" : "Aperta"}
                      </Chip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Scheda>

      {leadAperto && (
        <LeadDialog
          open={!!leadAperto}
          onOpenChange={(o) => !o && setLeadAperto(null)}
          lead={leadAperto}
        />
      )}

      {/* ── CHI HA VISTO QUESTO ANNUNCIO ─────────────────────────────────── */}
      <Foglio
        aperto={!!dettaglio}
        onCambio={(o) => !o && setDettaglio(null)}
        titolo="Chi ha visto questo annuncio"
        contesto={
          dettaglio
            ? `${TITOLO_RUOLO[dettaglio.ruolo]} · ${dettaglio.etichetta} · ${personeDelNodo.length} persone${
                personeDelNodo.length >= 200 ? " (prime 200)" : ""
              }`
            : undefined
        }
        larghezza="md"
      >
        {personeDelNodo.length === 0 ? (
          <VuotoFinestra
            testo={
              dettaglio?.ruolo === "tutti"
                ? "Nessuna persona ha visto questo annuncio nel periodo scelto."
                : "Nessuna persona ha visto questo annuncio in questo momento del percorso."
            }
          />
        ) : (
          <div className="space-y-1.5">
            {personeDelNodo.map((j) => (
              <CartaPersona
                key={`${j.source}-${j.leadId}`}
                j={j}
                onApri={() => {
                  apriPersona(j);
                  setDettaglio(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              />
            ))}
          </div>
        )}
      </Foglio>
    </Pagina>
  );
}

/** ── UNA PERSONA, IN UNA RIGA ──────────────────────────────────────────────
 *  La stessa riga serve in due posti — l'elenco su telefono e il pannello «chi
 *  ha visto questo annuncio» — e finché erano due blocchi di markup gemelli
 *  bastava correggerne uno per farli divergere. `className` cambia solo il
 *  vestito: dentro al pannello le righe sono cartoncini staccati, nell'elenco
 *  sono righe separate da un filo.
 *  Le persone importate dalla landing (source ≠ crm) non hanno una scheda da
 *  aprire: il pulsante resta spento invece di non fare niente al tocco. */
function CartaPersona({
  j,
  onApri,
  percorso,
  className,
}: {
  j: AttributionJourneyRow;
  onApri: () => void;
  /** aggiunge la riga «primo annuncio → ultimo annuncio» */
  percorso?: boolean;
  className?: string;
}) {
  const apribile = j.source === "crm";
  return (
    <button
      type="button"
      onClick={onApri}
      disabled={!apribile}
      title={apribile ? "Apri la scheda della persona" : "Contatto arrivato dalla landing"}
      className={`flex w-full items-center justify-between gap-2 disabled:cursor-default disabled:opacity-60 ${className ?? ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {j.fullName || j.email || "—"}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {dataBreve(j.createdAt)} · {j.distinctAds} annunci · {j.sessionsCount} visite
          {j.daysToConvert != null ? ` · decisa in ${j.daysToConvert} g` : ""}
        </span>
        {percorso && (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {nomeTappa(j.firstClickAdName, j.firstClickAdId)} →{" "}
            <span className="font-medium text-foreground">
              {nomeTappa(j.lastClickAdName, j.lastClickAdId)}
            </span>
          </span>
        )}
      </span>
      <Chip tono={j.isConverted ? "vinta" : "da_lavorare"} className="shrink-0">
        {j.isConverted ? "Cliente" : "Aperta"}
      </Chip>
    </button>
  );
}

/** Il nome di una tappa del percorso: il nome dell'annuncio, la coda del suo id
 *  se il nome non c'è, «Nessun annuncio» se non è passata da lì. */
function nomeTappa(nome: string | null, id: string | null): string {
  return nome || (id ? `…${id.slice(-8)}` : NESSUN_ANNUNCIO);
}
