// ── AL TELEFONO ─────────────────────────────────────────────────────────────
//  A COSA RISPONDE
//  Una sola domanda: su cento contatti di una lista importata che la consulente
//  ha chiamato, quanti diventano un appuntamento — e dove finiscono gli altri
//  novanta. È la misura del LAVORO AL TELEFONO, non della pubblicità: qui non
//  c'è spesa, non c'è costo per lead, non c'è fatturato.
//
//  ── QUALI LEAD ENTRANO QUI, E COME SI RICONOSCONO ─────────────────────────
//  Solo i lead IMPORTATI, cioè `data.importato === true`. È la spunta che
//  scrive l'importazione dell'archivio (routes/CRM.trattative.tsx e
//  crm/import-backup.ts) e nessun altro: un lead arrivato dal modulo pubblico
//  non ce l'ha.
//
//  ⚠️ NON si usa `eImportato` dell'elenco lead — `importato && !(dataMeeting &&
//  consulenteId)` — che in quella pagina serve a decidere QUALI STATI mostrare
//  nel menu. Quella regola toglie dal gruppo proprio i lead che hanno ottenuto
//  l'appuntamento, cioè i successi: usata qui darebbe un tasso di
//  appuntamento vicino a zero per costruzione. Qui «importato» vuol dire «da
//  dove arriva», non «a che punto è».
//
//  ── PERCHÉ IL DENOMINATORE NON È TUTTA LA LISTA ───────────────────────────
//  Un contatto ancora «Da contattare» non è stato chiamato: tenerlo nel
//  denominatore farebbe scendere il tasso ogni volta che si carica una lista
//  nuova, cioè proprio quando non è successo ancora niente. Il numero grande è
//  quindi sui contatti LAVORATI; la quota dei mai chiamati resta sotto, in
//  chiaro, perché è lavoro che aspetta.
import { useMemo } from "react";
import { Phone } from "lucide-react";
import { useCRM } from "@/crm/CRMContext";
import { cn } from "@/lib/utils";
import { Kpi, KpiRiga, Scheda, Vuoto } from "@/crm/ui";
import { LEAD_STATUS_LABEL, STATI_PRIMO_CONTATTO, type Lead, type LeadStatus } from "@/crm/types";
import type { FiltroPeriodo } from "@/crm/kpi-calcoli";
import { VOLUME_MINIMO_LPS } from "@/crm/kpi/soglie";

/** ── HA FISSATO, O NO ──────────────────────────────────────────────────────
 *  Un appuntamento fissato lascia due tracce: lo stato, oppure la data della
 *  consulenza sulla scheda. Si guardano entrambe perché il lead non si ferma
 *  lì: chi ha comprato è «Venduto», chi non si è presentato è «Cliente
 *  assente», e contando il solo stato «Appuntamento fissato» si perderebbero
 *  per strada tutti gli appuntamenti riusciti — cioè il numero che si cerca. */
function haFissato(l: Lead): boolean {
  const s = l.data.stato;
  return s === "appuntamento_fissato" || s === "appuntamento_rifissato" || !!l.data.dataMeeting;
}

/** La chiave del gruppo che raccoglie tutto ciò che non ha un esito suo: i lead
 *  che sono andati OLTRE la telefonata (venduto, in valutazione, cliente
 *  assente…). Non è un cestino: sotto la barra i suoi stati sono elencati uno
 *  per uno con il loro numero. */
const OLTRE = "__oltre__";

/** ── DA STATO A ESITO DELLA TELEFONATA ─────────────────────────────────────
 *  Ogni stato finisce in UNA quota e una sola, e ciò che non è qui dentro
 *  finisce nel gruppo «oltre»: così la scomposizione copre tutta la lista per
 *  costruzione e la somma non può che fare cento.
 *
 *  Due scelte che non si leggono dai nomi:
 *   · «Appuntamento fissato» e «rifissato» sono LA STESSA quota. Sono due
 *     stati diversi perché il secondo è il ritorno di qualcuno già in
 *     archivio, ma al telefono l'esito è identico: un appuntamento. Tenerli
 *     separati (o peggio: dimenticarne uno) è il modo più rapido per far
 *     mentire la somma.
 *   · «Perditempo» NON è in STATI_PRIMO_CONTATTO — chi lavora una lista non lo
 *     trova nel menu — ma nei dati esiste e al telefono è un esito vero, di
 *     quelli che il committente ha chiesto per nome. Ha la sua riga: dentro
 *     «oltre» sarebbe sembrato un lead che l'appuntamento l'ha ottenuto. */
const ESITO_DI: Partial<Record<LeadStatus, string>> = {
  appuntamento_fissato: "appuntamento",
  appuntamento_rifissato: "appuntamento",
  richiamo: "richiamo",
  segreteria: "segreteria",
  non_risponde: "non_risponde",
  annullato: "annullato",
  perdi_tempo: "perdi_tempo",
  da_contattare: "da_contattare",
};

/** L'ordine in cui si leggono gli esiti: prima l'unico che è un risultato, poi
 *  le perdite dalla più recuperabile alla meno, in fondo chi non è stato ancora
 *  chiamato. Non è l'ordine per grandezza di proposito: una scomposizione che
 *  cambia ordine a ogni periodo non si confronta con quella della settimana
 *  scorsa. Le etichette sono quelle del CRM (LEAD_STATUS_LABEL), tranne dove
 *  una quota raccoglie due stati. */
const ORDINE_ESITI: { chiave: string; etichetta: string }[] = [
  { chiave: "appuntamento", etichetta: "Appuntamento fissato" },
  { chiave: "richiamo", etichetta: LEAD_STATUS_LABEL.richiamo },
  { chiave: "segreteria", etichetta: LEAD_STATUS_LABEL.segreteria },
  { chiave: "non_risponde", etichetta: LEAD_STATUS_LABEL.non_risponde },
  { chiave: "annullato", etichetta: LEAD_STATUS_LABEL.annullato },
  { chiave: "perdi_tempo", etichetta: LEAD_STATUS_LABEL.perdi_tempo },
  { chiave: "da_contattare", etichetta: LEAD_STATUS_LABEL.da_contattare },
];

/** ── IL CONTROLLO CHE VALE DAVVERO ─────────────────────────────────────────
 *  La somma fa cento per costruzione (c'è il gruppo «oltre» a raccogliere il
 *  resto), quindi verificarla non direbbe più niente. Quello che invece può
 *  ancora rompersi è che qualcuno aggiunga uno stato a STATI_PRIMO_CONTATTO —
 *  in types.ts, un altro file — senza dargli una riga qui: quel lead finirebbe
 *  in «oltre», cioè fra chi l'appuntamento l'ha ottenuto, e il tasso salirebbe
 *  senza motivo. Si controlla una volta sola all'avvio e si dice in pagina. */
const PRIMI_SENZA_ESITO = STATI_PRIMO_CONTATTO.filter((s) => !ESITO_DI[s]);

interface Quota {
  chiave: string;
  etichetta: string;
  conteggio: number;
  percentuale: number;
  /** vero per l'unica quota che è un risultato: l'appuntamento */
  vinta: boolean;
  /** vero per chi non è ancora stato chiamato: non è una perdita, è lavoro che
   *  aspetta, e colorarlo come una perdita farebbe prendere decisioni sbagliate */
  daFare: boolean;
}

export function TelefonoScheda({ dentro }: { dentro: FiltroPeriodo }) {
  const { leads } = useCRM();

  const dati = useMemo(() => {
    //  Il filtro del periodo è lo stesso di tutte le altre schede, comprese le
    //  sue regole: una data illeggibile non lo passa e quel lead non finisce in
    //  nessuna finestra, invece di finire in tutte.
    const lista = leads.filter((l) => !!l.data.importato && dentro(l.data.createdAt));

    const perEsito = new Map<string, number>();
    const dettaglio = new Map<string, number>();
    for (const l of lista) {
      const s = String(l.data.stato || "");
      //  Uno stato senza esito di telefonata significa che quel lead è già
      //  andato avanti: si accorpa, e più sotto lo si dettaglia. Nessuno stato
      //  può restare fuori — nemmeno una scheda senza stato, che nei dati veri
      //  capita e qui vale «oltre», non «sparita».
      const chiave = ESITO_DI[s as LeadStatus] ?? OLTRE;
      perEsito.set(chiave, (perEsito.get(chiave) || 0) + 1);
      if (chiave === OLTRE) {
        dettaglio.set(s, (dettaglio.get(s) || 0) + 1);
      }
    }

    const totale = lista.length;
    const quota = (n: number) => (totale > 0 ? (n / totale) * 100 : 0);

    const quote: Quota[] = ORDINE_ESITI.map(({ chiave, etichetta }) => {
      const n = perEsito.get(chiave) || 0;
      return {
        chiave,
        etichetta,
        conteggio: n,
        percentuale: quota(n),
        vinta: chiave === "appuntamento",
        daFare: chiave === "da_contattare",
      };
    });
    const nOltre = perEsito.get(OLTRE) || 0;
    //  La quota «oltre» va messa subito dopo l'appuntamento: quei lead ci sono
    //  passati tutti, e vederla in fondo farebbe leggere l'appuntamento come
    //  più raro di quanto sia.
    quote.splice(1, 0, {
      chiave: OLTRE,
      etichetta: "Già oltre il primo contatto",
      conteggio: nOltre,
      percentuale: quota(nOltre),
      vinta: true,
      daFare: false,
    });

    //  Il dettaglio del gruppo «oltre», per non nascondere niente dietro
    //  un'etichetta sola.
    const dettaglioOltre = [...dettaglio.entries()]
      .map(([s, n]) => ({
        stato: s,
        etichetta: LEAD_STATUS_LABEL[s as LeadStatus] || "Senza stato",
        conteggio: n,
      }))
      .sort((a, b) => b.conteggio - a.conteggio);

    const daContattare = perEsito.get("da_contattare") || 0;
    const lavorati = totale - daContattare;

    //  ── CHI HA OTTENUTO L'APPUNTAMENTO ──────────────────────────────────
    //  Vale l'appuntamento anche chi ha uno stato da lavorazione (venduto,
    //  cliente assente, sta valutando…): ci è arrivato per forza, e in quei
    //  lead la data sulla scheda a volte manca perché l'appuntamento è stato
    //  preso a voce.
    //  Il numeratore esclude chi è ancora «Da contattare»: una scheda mai
    //  chiamata che si porta dietro una data di consulenza è un dato sporco, e
    //  contandola il tasso potrebbe superare cento su un denominatore che quel
    //  lead non contiene.
    const fissati = lista.filter((l) => {
      const esito = ESITO_DI[String(l.data.stato || "") as LeadStatus] ?? OLTRE;
      if (esito === "da_contattare") return false;
      return haFissato(l) || esito === OLTRE;
    }).length;

    //  Controllo di quadratura: le quote coprono tutto per costruzione, quindi
    //  questa somma torna sempre. Resta come rete: se un domani qualcuno
    //  toccasse il raggruppamento qui sopra, la pagina lo direbbe invece di
    //  lasciarlo scoprire a chi rifà i conti a mano.
    const sommaConteggi = quote.reduce((s, q) => s + q.conteggio, 0);

    //  Dove se ne va la fetta più grossa: è l'unica perdita che merita
    //  l'inchiostro colorato. I mai chiamati non sono una perdita.
    const perditaMaggiore = quote
      .filter((q) => !q.vinta && !q.daFare)
      .reduce<Quota | null>(
        (peggio, q) => (!peggio || q.conteggio > peggio.conteggio ? q : peggio),
        null,
      );

    return {
      totale,
      lavorati,
      daContattare,
      fissati,
      quote,
      dettaglioOltre,
      sommaConteggi,
      perditaMaggiore,
      //  IL NUMERO CHE CONTA: appuntamenti ogni cento contatti chiamati.
      tasso: lavorati > 0 ? (fissati / lavorati) * 100 : 0,
      tassoSuTutta: totale > 0 ? (fissati / totale) * 100 : 0,
      //  Chi si può ancora recuperare: sono tre stati che vogliono un'altra
      //  telefonata, non un funerale.
      daRiprovare:
        (perEsito.get("richiamo") || 0) +
        (perEsito.get("segreteria") || 0) +
        (perEsito.get("non_risponde") || 0),
    };
  }, [leads, dentro]);

  //  L'unica perdita che si colora, e solo se esiste davvero: con una lista
  //  tutta da chiamare non c'è ancora nessuna perdita da segnalare.
  const chiavePerdita =
    dati.perditaMaggiore && dati.perditaMaggiore.conteggio > 0 ? dati.perditaMaggiore.chiave : null;

  /** ── QUANDO IL NUMERO GRANDE HA DIRITTO DI ESSERE SCRITTO ─────────────────
   *  Il denominatore sono i contatti LAVORATI, e nei dati veri può essere zero:
   *  una lista appena caricata e non ancora chiamata stampava «0» a caratteri
   *  cubitali sopra la scritta «appuntamenti ogni 100 chiamate», cioè dava del
   *  disastro a un lavoro che non è ancora cominciato. Sotto i cinque contatti
   *  lavorati (VOLUME_MINIMO_LPS) vale la regola di tutta la pagina: una
   *  telefonata sola sposta il numero di venti punti, e allora non si scrive —
   *  si dice perché. La soglia è quella comune (./soglie), non una seconda. */
  const misurabile = dati.lavorati >= VOLUME_MINIMO_LPS;

  if (dati.totale === 0) {
    return (
      <Vuoto
        titolo="Nessun lead importato in questo periodo"
        testo="Qui si misura solo il lavoro al telefono su liste importate. Allarga il periodo qui sopra, oppure carica una lista da «Importa»."
        icona={Phone}
      />
    );
  }

  return (
    <>
      {/* ── UN NUMERO SOLO, GRANDE ──────────────────────────────────────────
          Tutto il resto della scheda esiste per spiegare questo. */}
      <Scheda classeCorpo="p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Appuntamenti ogni 100 chiamate
            </div>
            <div className="text-[40px] font-semibold leading-none tabular-nums sm:text-[52px]">
              {misurabile ? dati.tasso.toFixed(0) : "—"}
            </div>
            {misurabile ? (
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                <strong className="font-semibold text-foreground tabular-nums">
                  {dati.fissati}
                </strong>{" "}
                appuntamenti fissati su{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {dati.lavorati}
                </strong>{" "}
                contatti lavorati.
                {dati.daContattare > 0 && (
                  <>
                    {" "}
                    Gli altri <span className="tabular-nums">{dati.daContattare}</span> della lista
                    non sono ancora stati chiamati: su tutta la lista importata il tasso sarebbe{" "}
                    <span className="tabular-nums">{dati.tassoSuTutta.toFixed(0)}%</span>.
                  </>
                )}
              </p>
            ) : (
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                {dati.lavorati === 0
                  ? `Nessuno dei ${dati.totale} contatti importati nel periodo è ancora stato chiamato: finché non parte la prima telefonata questo numero non esiste.`
                  : `Solo ${dati.lavorati} ${dati.lavorati === 1 ? "contatto lavorato" : "contatti lavorati"} su ${dati.totale} importati: sotto ${VOLUME_MINIMO_LPS} una telefonata sola sposta il numero di venti punti, e non si scrive. Le quote qui sotto restano leggibili — sono conteggi, non medie.`}
              </p>
            )}
          </div>
          <p className="max-w-[22rem] text-[11px] leading-relaxed text-muted-foreground">
            Conta come appuntamento chi ha lo stato «Appuntamento fissato» o «rifissato», chi ha una
            data di consulenza sulla scheda e chi è già a uno stato da lavorazione: chi ha comprato
            o non si è presentato l'appuntamento l'ha comunque ottenuto, e lasciarlo fuori farebbe
            sembrare il telefono peggiore di com'è.
          </p>
        </div>
      </Scheda>

      <KpiRiga colonne={4}>
        <Kpi etichetta="Lista importata" valore={dati.totale} nota="Lead importati nel periodo" />
        <Kpi
          etichetta="Mai chiamati"
          valore={dati.daContattare}
          tono={dati.daContattare > 0 ? "in_sospeso" : "neutro"}
          nota="Ancora «Da contattare»"
        />
        <Kpi
          etichetta="Da riprovare"
          valore={dati.daRiprovare}
          nota="Richiamo, segreteria, non risponde"
        />
        <Kpi
          etichetta="Appuntamenti"
          valore={dati.fissati}
          tono={dati.fissati > 0 ? "vinta" : "neutro"}
          nota="Fissati, comunque siano finiti"
        />
      </KpiRiga>

      {/* ── DOVE FINISCONO GLI ALTRI ────────────────────────────────────────
          Una barra sola divisa in quote, non dieci riquadri uguali: le
          proporzioni si leggono al primo sguardo, e sotto ci sono i numeri per
          chi deve riferirli. */}
      <Scheda
        titolo="Dove finisce la lista"
        nota="Ogni esito è una quota dei lead importati del periodo"
        classeCorpo="space-y-3 p-4"
      >
        <div className="flex h-4 w-full overflow-hidden rounded-full border border-border">
          {dati.quote
            .filter((q) => q.conteggio > 0)
            .map((q) => (
              <div
                key={q.chiave}
                //  Il colore è un segnale, non una tinta per distinguere: verde
                //  ciò che è arrivato all'appuntamento, ambra la perdita più
                //  grossa, tratteggio chiaro chi non è ancora stato chiamato,
                //  grigio tutto il resto. Con dieci tinte diverse servirebbe
                //  una legenda per leggere una proporzione.
                className={cn(
                  q.vinta
                    ? "bg-emerald-600"
                    : q.daFare
                      ? "bg-muted"
                      : q.chiave === chiavePerdita
                        ? "bg-amber-500"
                        : "bg-foreground/25",
                )}
                style={{ width: `${q.percentuale}%` }}
                title={`${q.etichetta}: ${q.conteggio} (${q.percentuale.toFixed(1)}%)`}
              />
            ))}
        </div>

        <ul className="divide-y divide-border">
          {dati.quote.map((q) => (
            <li
              key={q.chiave}
              className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-sm",
                    q.vinta
                      ? "bg-emerald-600"
                      : q.daFare
                        ? "bg-muted-foreground/30"
                        : q.chiave === chiavePerdita
                          ? "bg-amber-500"
                          : "bg-foreground/25",
                  )}
                />
                <span className="truncate">{q.etichetta}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-muted-foreground">{q.conteggio}</span>
                <span
                  className={cn(
                    "w-14 text-right font-semibold",
                    q.chiave === chiavePerdita && "text-amber-700",
                  )}
                >
                  {q.percentuale.toFixed(1)}%
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {/*  La quadratura, detta invece che nascosta. */}
          {dati.sommaConteggi === dati.totale ? (
            <p>
              Le quote sono calcolate sui {dati.totale} lead importati del periodo e sommano al
              100%: ogni scheda sta in una riga sola.
            </p>
          ) : (
            <p className="font-medium text-amber-700">
              Attenzione: le righe qui sopra coprono {dati.sommaConteggi} lead sui {dati.totale}{" "}
              importati del periodo. {dati.totale - dati.sommaConteggi} non rientrano in nessun
              esito — è uno stato che questa scheda non conosce, va aggiunto a ESITO_DI in
              crm/kpi/TelefonoScheda.tsx.
            </p>
          )}
          {/*  L'altro modo di sbagliare: uno stato di primo contatto nuovo che
               nessuno ha incasellato qui finirebbe fra chi ha ottenuto
               l'appuntamento, alzando il tasso senza che sia successo niente. */}
          {PRIMI_SENZA_ESITO.length > 0 && (
            <p className="font-medium text-amber-700">
              Attenzione: gli stati {PRIMI_SENZA_ESITO.map((s) => LEAD_STATUS_LABEL[s]).join(", ")}{" "}
              sono esiti di prima chiamata ma questa scheda non li conosce: finiscono in «Già oltre
              il primo contatto» e gonfiano il tasso. Vanno aggiunti a ESITO_DI in
              crm/kpi/TelefonoScheda.tsx.
            </p>
          )}
          {dati.dettaglioOltre.length > 0 && (
            <p>
              «Già oltre il primo contatto» sono i lead che hanno superato la telefonata e adesso
              hanno uno stato da lavorazione:{" "}
              {dati.dettaglioOltre.map((d) => `${d.etichetta} ${d.conteggio}`).join(" · ")}. Ci sono
              passati tutti da un appuntamento, ed è per questo che il numero grande qui sopra li
              conta: la riga «Appuntamento fissato» da sola conta solo chi è ancora fermo lì.
            </p>
          )}
          <p>
            Entrano solo i lead <strong>importati</strong> (la spunta che mette l'importazione
            dell'archivio), presi per data di ingresso nel periodo scelto in alto. I lead arrivati
            dal modulo pubblico non sono lavoro di telefonata e restano fuori.
          </p>
        </div>
      </Scheda>
    </>
  );
}
