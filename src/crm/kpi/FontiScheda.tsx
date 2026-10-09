// ── FONTI ───────────────────────────────────────────────────────────────────
//  A COSA RISPONDE
//  «Da dove arrivano i clienti buoni». Non «quanti lead fa Meta» — quello lo
//  sa già il pannello degli annunci — ma quale provenienza porta persone che
//  poi comprano davvero.
//  Numero principale: la CONVERSIONE TOTALE, cioè quanti dei lead entrati
//  diventano clienti. È l'unico numero che mette d'accordo volume e qualità.
//
//  ── LA QUALITÀ DEL LEAD È SCESA DA NUMERO GRANDE A COLONNA ────────────────
//  Il punteggio di disagio medio stava in cima, grande quanto il costo per
//  cliente. Ma è una media di risposte facoltative su un modulo: da sola non
//  dice niente e non si agisce. Come COLONNA, accanto a lead e clienti di ogni
//  canale, dice l'unica cosa che serve — «questa fonte porta gente che scotta
//  meno» — e sta dove si prende la decisione.
//
//  ── COSA È STATO TOLTO, E PERCHÉ ──────────────────────────────────────────
//   · I QUATTRO CONTEGGI LEAD NEI SEGMENTI CANALE della barra: la tabella «Per
//     canale» ha già quella colonna ed è già cliccabile. Erano due comandi per
//     lo stesso filtro, e chi ne premeva uno non capiva perché l'altro non si
//     accendesse. Adesso si filtra dalla tabella, che è dove si sta guardando.
//   · LA DIMENSIONE «ANGOLO CREATIVO» dal raggruppamento: è quella con più dati
//     mancanti (esiste solo se l'annuncio ha passato creative_name, utm_content
//     o ad_name) e l'analisi per creatività vive in /CRM/campagne-meta, dove ci
//     sono impression e video veri. Qui era una classifica di quello che era
//     stato taggato meglio.
import { useMemo, useState } from "react";
import { Target } from "lucide-react";
import { useCRM } from "@/crm/CRMContext";
import { cn } from "@/lib/utils";
import type { AdSpending, Consultant, Lead } from "@/crm/types";
import { Scheda, Segmento, VuotoRiga, eur } from "@/crm/ui";
import {
  calcolaMetricheGenerali,
  type FiltroPeriodo,
  type Intervallo,
  type MetricheGenerali,
} from "@/crm/kpi-calcoli";
import { conBase, euroPreciso, punteggio } from "@/crm/kpi/basi";
import { SOGLIA_LPS, VOLUME_MINIMO_LPS } from "@/crm/kpi/soglie";
import { CANALI, NOME_CANALE, canaleDi, type CanaleLead } from "@/crm/kpi/canale";
import { useRegistroSpesa } from "@/crm/kpi/useRegistroSpesa";
import { NumeroChiave } from "@/crm/kpi/pezzi";
import { RisposteFormScheda } from "@/crm/kpi/RisposteFormScheda";
//  L'altra metà della stessa domanda: le risposte del questionario
//  dell'inserzione, contate sulle schede del CRM. Vedi la sua testata per
//  perché sta accanto e non dentro a quella qui sopra.
import { RisposteAdsScheda } from "@/crm/kpi/RisposteAdsScheda";
import type { Channel } from "@/crm/kpi/cvr-generale-utils";

/*  Gli stati che le formule NON contano fra i lead: un no show non è costato
    una consulenza e un «fissa meet dopo» non è ancora entrato nell'imbuto.
    Ripetuti qui per un solo scopo — usare lo STESSO denominatore della colonna
    «Lead» anche per il punteggio medio. Il calcolo resta in kpi-calcoli. */
const NON_CONTEGGIABILI: readonly string[] = ["no_show", "fissa_meet_dopo"];

/** Punteggio medio del gruppo. Chi non ha dichiarato nulla conta 0 e resta nel
 *  denominatore: un gruppo dove nessuno risponde NON è un gruppo di lead
 *  caldissimi, e alzare la media escludendolo lo farebbe sembrare tale. */
function lpsMedio(leads: Lead[]): number {
  if (leads.length === 0) return 0;
  const somma = leads.reduce(
    (s, l) => s + (typeof l.data.qualifica?.disagio === "number" ? l.data.qualifica.disagio : 0),
    0,
  );
  return somma / leads.length;
}

/** Come si raggruppa la tabella della qualità. Erano cinque schede separate con
 *  le stesse due colonne; l'angolo creativo è uscito (vedi l'intestazione). */
type Dimensione = "citta" | "campagna" | "consulente";

const DIMENSIONI: { v: Dimensione; t: string; nota: string }[] = [
  { v: "citta", t: "Città", nota: "Dove abita chi lascia il contatto" },
  { v: "campagna", t: "Campagna", nota: "Il valore di utm_campaign del link" },
  { v: "consulente", t: "Consulente", nota: "Chi ha ricevuto il lead in assegnazione" },
];

export function FontiScheda({ intervallo }: { intervallo: Intervallo }) {
  const { leads, consultants } = useCRM();

  //  ⚠️ TUTTI GLI HOOK SOPRA I RETURN ANTICIPATI: questa scheda non ne ha.
  //  La spesa è LA STESSA della scheda «Ritorno» — stesso registro, stessa
  //  costruzione — altrimenti il costo per lead di Meta letto qui non
  //  tornerebbe con il costo per lead letto là.
  const { registro, dentro } = useRegistroSpesa(intervallo);
  const [canale, setCanale] = useState<Channel>("all");
  const [dimensione, setDimensione] = useState<Dimensione>("citta");

  const leadDelCanale = useMemo(
    () => (canale === "all" ? leads : leads.filter((l) => canaleDi(l) === canale)),
    [leads, canale],
  );
  const speseDelCanale = useMemo<AdSpending[]>(
    () => (canale === "all" ? registro.spese : registro.perCanale[canale as CanaleLead]),
    [canale, registro],
  );

  const m = useMemo(
    () => calcolaMetricheGenerali(leadDelCanale, speseDelCanale, dentro, true),
    [leadDelCanale, speseDelCanale, dentro],
  );

  /* ── IL CONFRONTO FRA CANALI ─────────────────────────────────────────────
     Sempre su tutti e tre, anche quando ne è selezionato uno: il confronto è
     il motivo per cui questa scheda esiste. */
  const perCanale = useMemo(
    () =>
      CANALI.map((c) => {
        const suoi = leads.filter((l) => canaleDi(l) === c);
        const mc = calcolaMetricheGenerali(suoi, registro.perCanale[c], dentro, true);
        const conteggiabili = suoi.filter(
          (l) => dentro(l.data.createdAt) && !NON_CONTEGGIABILI.includes(l.data.stato),
        );
        return { canale: c, m: mc, lps: lpsMedio(conteggiabili) };
      }),
    [leads, registro, dentro],
  );

  const gruppi = useMemo(
    () => raggruppa(leadDelCanale, dentro, dimensione, consultants),
    [leadDelCanale, dentro, dimensione, consultants],
  );

  /** ── LA CONVERSIONE TOTALE, CON LA SUA BASE ──────────────────────────────
   *  La percentuale arriva già calcolata da kpi-calcoli: qui si aggiunge solo
   *  su quanti casi è fatta. Il 40% di 5 lead e il 40% di 300 sono due fatti
   *  diversi, e con il primo si sposta un budget per sbaglio. */
  const conversione = conBase(m.conversioneTotale, m.conversioni, m.lead, { casi: "lead" });

  return (
    <>
      {/* ── IL NUMERO PRINCIPALE ────────────────────────────────────────────
          Non c'è più la barra dei canali: il filtro è la tabella qui sotto,
          che ha già i conteggi ed è già cliccabile. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <NumeroChiave
          etichetta={
            canale === "all"
              ? "Conversione totale"
              : `Conversione totale · ${NOME_CANALE[canale as CanaleLead]}`
          }
          valore={conversione.valore}
          base={
            conversione.misurabile
              ? `${m.conversioni} ${m.conversioni === 1 ? "cliente" : "clienti"} su ${m.lead} lead entrati`
              : conversione.base
          }
          formula="Clienti ÷ lead entrati: l'imbuto intero, dalla prima telefonata alla firma"
          icona={Target}
          principale
          className="lg:col-span-3"
        />
      </div>

      {/* ── IL CONFRONTO FRA CANALI ─────────────────────────────────────────
          Le righe sono il filtro della scheda: premerne una guarda tutto il
          resto solo su quel canale, premerla di nuovo toglie il filtro. */}
      <Scheda
        titolo="Per canale"
        nota={
          canale === "all"
            ? "Premi una riga per guardare tutta la scheda solo su quel canale"
            : `Stai guardando solo ${NOME_CANALE[canale as CanaleLead]}: premi di nuovo la riga per togliere il filtro`
        }
        senzaPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Canale</th>
                <th className="px-3 py-2 text-right font-medium">Spesa</th>
                <th className="px-3 py-2 text-right font-medium">Lead</th>
                <th className="px-3 py-2 text-right font-medium">Costo lead</th>
                <th className="px-3 py-2 text-right font-medium">Appunt.</th>
                <th className="px-3 py-2 text-right font-medium">Clienti</th>
                <th className="px-3 py-2 text-right font-medium">Costo cliente</th>
                <th className="px-3 py-2 text-right font-medium">Conversione</th>
                <th className="px-3 py-2 text-right font-medium">Fatturato</th>
                <th className="px-3 py-2 text-right font-medium">Qualità</th>
              </tr>
            </thead>
            <tbody>
              {perCanale.map(({ canale: c, m: mc, lps: q }) => {
                const scelto = canale === c;
                const freddo = mc.lead >= VOLUME_MINIMO_LPS && q < SOGLIA_LPS;
                const conv = conBase(mc.conversioneTotale, mc.conversioni, mc.lead, {
                  casi: "lead",
                });
                return (
                  <tr
                    key={c}
                    onClick={() => setCanale(scelto ? "all" : c)}
                    title={
                      scelto
                        ? "Togli il filtro"
                        : `Guarda tutta la scheda solo su ${NOME_CANALE[c]}`
                    }
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent/50",
                      scelto && "bg-accent/60",
                    )}
                  >
                    <td className="px-3 py-2 font-medium">{NOME_CANALE[c]}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {c === "organic" ? "—" : euroPreciso(mc.spesa)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{mc.lead}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {mc.costoPerLead ? euroPreciso(mc.costoPerLead) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{mc.appuntamenti}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {mc.conversioni}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {mc.cpa ? euroPreciso(mc.cpa) : "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-right tabular-nums"
                      title={conv.misurabile ? `${conv.base} lead` : conv.base}
                    >
                      {conv.valore}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur(mc.fatturatoLordo)}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        freddo && "font-semibold text-amber-700",
                      )}
                    >
                      {mc.lead >= VOLUME_MINIMO_LPS ? punteggio(q) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          L'organico non ha spesa, quindi non ha un costo per lead: il trattino dice «non
          misurabile», non «gratis». La riga TikTok usa il budget giornaliero delle impostazioni
          moltiplicato per i giorni del periodo — è una stima, non una lettura. «Conversione» e
          «Qualità» compaiono da {VOLUME_MINIMO_LPS} lead in su: sotto, una persona sola le sposta
          di venti punti. «Qualità» è ambra quando la media del disagio dichiarato sta sotto{" "}
          {SOGLIA_LPS}/10.
          {registro.nonAttribuita > 0 && (
            <>
              {" "}
              {euroPreciso(registro.nonAttribuita)} di spesa scritta a mano non dichiara il canale e
              non compare in nessuna di queste righe: nel totale della scheda «Ritorno» invece c'è.
            </>
          )}
        </p>
      </Scheda>

      {/* ── CHI PORTA I LEAD MIGLIORI ────────────────────────────────────────
          Erano cinque schede: disagio per fonte, per campagna, per città, per
          consulente e i «top 5 angoli comunicativi». Cinque riquadri con le
          stesse due colonne e cinque titoli diversi. Qui è una tabella sola e
          il raggruppamento si sceglie. */}
      <Scheda
        titolo="Chi porta i lead migliori"
        nota={DIMENSIONI.find((d) => d.v === dimensione)?.nota}
        azioni={
          <div className="flex flex-wrap gap-1.5">
            {DIMENSIONI.map(({ v, t }) => (
              <Segmento key={v} attivo={dimensione === v} onClick={() => setDimensione(v)}>
                {t}
              </Segmento>
            ))}
          </div>
        }
        senzaPadding
      >
        {gruppi.length === 0 ? (
          <VuotoRiga testo="Nessun gruppo con abbastanza lead in questo periodo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">
                    {DIMENSIONI.find((d) => d.v === dimensione)?.t}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Lead</th>
                  <th className="px-3 py-2 text-right font-medium">Appunt.</th>
                  <th className="px-3 py-2 text-right font-medium">Clienti</th>
                  <th className="px-3 py-2 text-right font-medium">Conversione</th>
                  <th className="px-3 py-2 text-right font-medium">Fatturato</th>
                  <th className="px-3 py-2 text-right font-medium">Qualità</th>
                </tr>
              </thead>
              <tbody>
                {gruppi.map((g) => {
                  const freddo = g.m.lead >= VOLUME_MINIMO_LPS && g.lps < SOGLIA_LPS;
                  const conv = conBase(g.m.conversioneTotale, g.m.conversioni, g.m.lead, {
                    casi: "lead",
                  });
                  return (
                    <tr key={g.chiave} className="border-b border-border last:border-0">
                      <td className="max-w-[240px] truncate px-3 py-2 font-medium" title={g.nome}>
                        {g.nome}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.m.lead}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{g.m.appuntamenti}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {g.m.conversioni}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                        title={conv.misurabile ? `${conv.base} lead` : conv.base}
                      >
                        {conv.valore}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {eur(g.m.fatturatoLordo)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          freddo && "font-semibold text-amber-700",
                        )}
                      >
                        {punteggio(g.lps)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Ordinati per numero di lead, primi venti. Compaiono solo i gruppi con almeno{" "}
          {VOLUME_MINIMO_LPS} lead nel periodo: sotto quella soglia una media si sposta di due punti
          per una risposta sola e fa prendere decisioni sbagliate. Nessuna colonna di spesa: la
          spesa non nasce per città né per campagna, e spalmarla qui darebbe un costo che sembra
          misurato e invece è ripartito.
        </p>
      </Scheda>

      {/* ── LE RISPOSTE DEL MODULO ──────────────────────────────────────────
          Stesso periodo e stesso canale del resto della scheda. */}
      <RisposteFormScheda dentro={dentro} canale={canale} intervallo={intervallo} />

      {/* ── LE RISPOSTE DEL QUESTIONARIO DELL'INSERZIONE ───────────────────
          Stesso periodo. ⚠️ NON prende il canale: le risposte arrivano con le
          liste importate, che sono tutte inserzioni — filtrare per canale qui
          vorrebbe dire una tabella che si svuota scegliendo «organico», e
          sembrerebbe rotta invece che vuota per costruzione. */}
      <RisposteAdsScheda dentro={dentro} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RAGGRUPPARE
   ═════════════════════════════════════════════════════════════════════════ */

interface Gruppo {
  chiave: string;
  nome: string;
  m: MetricheGenerali;
  lps: number;
}

/** ── PERCHÉ SI RICHIAMA LA STESSA FORMULA PER OGNI GRUPPO ──────────────────
 *  Le colonne di questa tabella sono le stesse del riepilogo, e devono restare
 *  identiche anche nelle eccezioni (quali stati contano, quali si escludono,
 *  come si attribuisce la data). Ricontarle qui a mano significa che alla prima
 *  modifica di kpi-calcoli le due letture divergono in silenzio: si passa
 *  quindi lo stesso calcolo, un gruppo alla volta.
 *  Nessuna spesa: la spesa non nasce per città né per campagna. */
function raggruppa(
  leads: Lead[],
  dentro: FiltroPeriodo,
  dimensione: Dimensione,
  consultants: Consultant[],
): Gruppo[] {
  const nomeDi = (l: Lead): { chiave: string; nome: string } => {
    if (dimensione === "citta") {
      const c = (l.data.citta || "").trim();
      return { chiave: c || "—", nome: c || "Città non indicata" };
    }
    if (dimensione === "campagna") {
      const c = (l.data.tracking?.utm_campaign || "").trim();
      return { chiave: c || "—", nome: c || "Senza campagna" };
    }
    const id = l.data.consulenteId || "";
    const nome = consultants.find((c) => c.id === id)?.data.nome;
    return { chiave: id || "—", nome: nome || "Non assegnato" };
  };

  const mappa = new Map<string, { nome: string; leads: Lead[] }>();
  for (const l of leads) {
    if (!dentro(l.data.createdAt)) continue;
    const g = nomeDi(l);
    const riga = mappa.get(g.chiave) || { nome: g.nome, leads: [] };
    riga.leads.push(l);
    mappa.set(g.chiave, riga);
  }

  return [...mappa.entries()]
    .map(([chiave, { nome, leads: suoi }]) => ({
      chiave,
      nome,
      m: calcolaMetricheGenerali(suoi, [], dentro, true),
      lps: lpsMedio(suoi.filter((l) => !NON_CONTEGGIABILI.includes(l.data.stato))),
    }))
    .filter((g) => g.m.lead >= VOLUME_MINIMO_LPS)
    .sort((a, b) => b.m.lead - a.m.lead)
    .slice(0, 20);
}
