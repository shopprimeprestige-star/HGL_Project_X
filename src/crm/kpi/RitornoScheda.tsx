// ── RITORNO ─────────────────────────────────────────────────────────────────
//  A COSA RISPONDE
//  «Quanto rende quello che spendo». È la domanda del TITOLARE, e le altre tre
//  schede non la toccano: qui ci sono i soldi, là c'è il lavoro.
//  Numero principale: il COSTO PER CLIENTE.
//
//  ── IL DIFETTO CHE QUESTA SCHEDA CHIUDE ───────────────────────────────────
//  La stessa pagina conteneva DUE VOLTE gli stessi quattro numeri, calcolati su
//  due spese diverse: la «Panoramica» sulla sola spesa sincronizzata da Meta
//  più una stima TikTok, «KPI manuale» sulla sola spesa scritta a mano. Stesso
//  periodo, due «costo per cliente». Chi cambiava scheda vedeva il numero
//  muoversi e concludeva che la pagina era rotta.
//  Adesso la spesa è UNA (vedi ./spesa e ./useRegistroSpesa) e la pagina dice a
//  voce alta quanta parte di quella spesa è davvero registrata: senza quel
//  numero, un costo per cliente calcolato su 24 giorni di spesa su 30 sembra
//  bellissimo e non lo è.
//
//  ── COSA È STATO TOLTO, E PERCHÉ ──────────────────────────────────────────
//   · IL COSTO PER APPUNTAMENTO: era il terzo costo unitario in fila, e
//     l'appuntamento non è un risultato — è un passaggio. Tre costi unitari
//     accanto fanno perdere quello che conta.
//   · IL RITORNO SULLA SPESA «IN MODALITÀ NETTO»: il numeratore del netto ha
//     già la spesa sottratta, quindi quel rapporto non misura niente e scende
//     senza che sia successo nulla. Il ritorno si legge sul fatturato, e basta.
//     Con lui è sparito anche l'interruttore lordo/netto: fatturato, risultato
//     netto e margine stanno adesso uno accanto all'altro, che è il modo in cui
//     si guardano davvero.
//   · IL DETTAGLIO GIORNO PER GIORNO con fatturato, margine, costo per lead e
//     costo per cliente giornalieri: attribuiva le vendite alla data del
//     MEETING mentre tutta la testa della pagina è agganciata alla data di
//     ingresso del lead, e toglieva la spesa solo nei giorni con una vendita.
//     Restano le quattro colonne oneste — giorno, campagne, speso, lead —
//     dentro il registro della spesa.
//   · GLI APPUNTAMENTI FISSATI OGGI/IERI/ALTROIERI: dichiaravano di non seguire
//     il periodo scelto, dentro una pagina il cui unico patto è che il periodo
//     valga per tutto.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Divide,
  AlertTriangle,
  BadgeEuro,
  CalendarDays,
  Loader2,
  Percent,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useCRM } from "@/crm/CRMContext";
import { cn } from "@/lib/utils";
import type { Lead } from "@/crm/types";
import { Kpi, Scheda, eur, useRicerca } from "@/crm/ui";
import {
  STATI_CONSULENZA,
  calcolaGiorni,
  calcolaMetricheGenerali,
  eConversione,
  type Intervallo,
} from "@/crm/kpi-calcoli";
import { calcolaContoNetto, dataChiusura } from "@/crm/kpi-netto";
import { conBase, euroPreciso, pct, suQuanti, volte } from "@/crm/kpi/basi";
import { VOLUME_MINIMO_LPS } from "@/crm/kpi/soglie";
import { etichettaPeriodo, giornoCorto } from "@/crm/kpi/finestra";
import { prezzoMedioDiVendita, schedeFuoriDaOgniPeriodo } from "@/crm/kpi/spesa";
import { useRegistroSpesa } from "@/crm/kpi/useRegistroSpesa";
import { ElencoDietro } from "@/crm/kpi/pezzi";
import { vociDelConto } from "@/crm/kpi-netto";
import { CostoUnitario, FasciaRisultato, PassoImbuto, VoceConto } from "@/crm/kpi/conto-pezzi";
import { ModuloSpesa, RegistroSpesa } from "@/crm/kpi/RegistroSpesa";

/*  Gli stati esclusi dai conteggi NON sono esportati da kpi-calcoli. Qui sono
    ripetuti per un solo scopo: costruire l'ELENCO di schede che sta dietro a un
    numero già calcolato là. Nessun numero mostrato nasce da questa lista. */
const NON_CONTEGGIABILI: readonly string[] = ["no_show", "fissa_meet_dopo"];

/** I conteggi che si possono aprire per vedere le schede che ci stanno dietro. */
type ChiaveDietro = "lead" | "appuntamenti" | "consulenze" | "clienti" | "noShow";

/** ── DA QUALE NUMERO SI È APERTO L'ELENCO ─────────────────────────────────
 *  Non basta sapere QUALE elenco è aperto: qui tre numeri diversi (costo per
 *  cliente, fatturato e il conteggio Clienti dell'imbuto) portano allo stesso
 *  elenco di schede, e due (costo per lead e Lead entrati) allo stesso elenco
 *  di lead. Tenendo solo la chiave, premerne uno accendeva tutti i riquadri
 *  fratelli, e premere il secondo CHIUDEVA l'elenco invece di spostarcisi — un
 *  numero che si spegne quando lo premi sembra rotto. */
type OrigineDietro = ChiaveDietro | "costoLead" | "cpa" | "fatturato";

const TITOLO_DIETRO: Record<ChiaveDietro, string> = {
  lead: "Lead entrati nel periodo",
  appuntamenti: "Appuntamenti fissati",
  consulenze: "Consulenze svolte",
  clienti: "Clienti acquisiti",
  noShow: "Non si sono presentati",
};

/** L'ora dell'ultima lettura da Meta. Il valore arriva dal database e può
 *  essere una data che JavaScript non sa leggere: «Invalid Date» accanto alla
 *  spesa fa dubitare della spesa, non dell'orologio. */
function oraDi(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function RitornoScheda({ intervallo }: { intervallo: Intervallo }) {
  const { leads, consultants } = useCRM();
  const ricerca = useRicerca();

  //  ⚠️ TUTTI GLI HOOK SOPRA I RETURN ANTICIPATI. Questa scheda non ne ha, e
  //  non deve averne: la spesa si legge sempre, altrimenti al primo caricamento
  //  vuoto l'ordine degli hook cambierebbe.
  const { registro, dentro, estremi, ultimaSync, caricando, sincronizzando, riallinea } =
    useRegistroSpesa(intervallo);

  const [dietro, setDietro] = useState<{ chiave: ChiaveDietro; da: OrigineDietro } | null>(null);
  const [registroAperto, setRegistroAperto] = useState(false);
  const rifDietro = useRef<HTMLDivElement | null>(null);
  /** Due bersagli diversi, perché sono due gesti diversi: «registra» porta al
   *  modulo, «correggi» porta all'elenco delle registrazioni. Un solo ref li
   *  manderebbe entrambi nel posto sbagliato per metà dei casi. */
  const rifModulo = useRef<HTMLDivElement | null>(null);
  const rifRegistro = useRef<HTMLDivElement | null>(null);

  /* ── I NUMERI ────────────────────────────────────────────────────────────
     Tutti dalla stessa spesa e dalle stesse formule di kpi-calcoli, che sono
     la trascrizione fedele del CRM aziendale e non si toccano. Due chiamate
     perché il lordo e il netto si guardano affiancati: la distanza fra i due
     È l'informazione. */
  const mLordo = useMemo(
    () => calcolaMetricheGenerali(leads, registro.spese, dentro, true),
    [leads, registro, dentro],
  );
  const mNetto = useMemo(
    () => calcolaMetricheGenerali(leads, registro.spese, dentro, false),
    [leads, registro, dentro],
  );
  /** La scomposizione del netto: stessi lead, stessa spesa, stesso periodo. */
  const conto = useMemo(
    () => calcolaContoNetto(leads, registro.spese, dentro),
    [leads, registro, dentro],
  );
  /** Il giorno per giorno del registro: STESSA spesa dei numeri qui sopra.
   *  Ricalcolarlo dentro il registro vorrebbe dire due totali diversi nella
   *  stessa scheda. */
  const giorni = useMemo(
    () => calcolaGiorni(leads, registro.spese, dentro),
    [leads, registro, dentro],
  );

  /** Le schede del periodo, divise come le divide il calcolo: stesso filtro,
   *  stessa data di attribuzione, stesse esclusioni. Un elenco che mostrasse
   *  righe diverse dal numero che lo apre farebbe perdere credibilità a
   *  entrambi. */
  const elenchi = useMemo((): Record<ChiaveDietro, Lead[]> => {
    /*  ⚠️ LA STESSA DATA DEL CALCOLO. Se l'elenco filtrasse per data
        d'ingresso e il numero sopra per data di chiusura, aprendo il dettaglio
        si troverebbero righe diverse dal totale che le ha aperte — ed è il
        modo più rapido di far perdere credibilità a tutti e due. */
    const nelPeriodo = leads.filter((l) => dentro(dataChiusura(l)));
    const conteggiabili = nelPeriodo.filter((l) => !NON_CONTEGGIABILI.includes(l.data.stato));
    const perData = (a: Lead[]) =>
      [...a].sort((x, y) => String(y.data.createdAt).localeCompare(String(x.data.createdAt)));
    return {
      lead: perData(conteggiabili),
      appuntamenti: perData(conteggiabili.filter((l) => !!l.data.dataMeeting)),
      //  «Consulenza svolta» non è uno stato solo: è l'elenco STATI_CONSULENZA
      //  delle formule. Si importa da lì invece di riscriverlo, altrimenti
      //  l'elenco e il conteggio divergono al primo stato nuovo.
      consulenze: perData(nelPeriodo.filter((l) => STATI_CONSULENZA.includes(l.data.stato))),
      clienti: perData(nelPeriodo.filter(eConversione)),
      noShow: perData(nelPeriodo.filter((l) => l.data.stato === "no_show")),
    };
  }, [leads, dentro]);

  /** Le schede senza data di ingresso leggibile: non compaiono in NESSUN
   *  periodo, nemmeno in «Tutto». Con 843 schede importate possono essere
   *  decine, e chi rifà i conti a mano trova un totale che non torna. */
  const fuoriPeriodo = useMemo(() => schedeFuoriDaOgniPeriodo(leads), [leads]);

  //  I numeri grandi stanno in cima e l'elenco che aprono compare più giù: su
  //  telefono si premeva un numero e sullo schermo non cambiava niente.
  //  `nearest` non muove la pagina quando l'elenco è già sotto gli occhi.
  useEffect(() => {
    if (dietro) rifDietro.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [dietro]);

  /** Premere di nuovo lo STESSO numero chiude l'elenco; premerne un altro
   *  sposta l'evidenza senza far sparire l'elenco. */
  const mostraDietro = (chiave: ChiaveDietro, da: OrigineDietro) =>
    setDietro((corrente) => (corrente?.da === da ? null : { chiave, da }));

  /** Apre l'elenco delle registrazioni e ci porta: è dove si corregge. */
  const apriRegistro = () => {
    setRegistroAperto(true);
    rifRegistro.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Porta al modulo, che è dove si scrive la spesa mancante. */
  const vaiAlModulo = () =>
    rifModulo.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const { origine, copertura } = registro;
  const prezzoMedio = prezzoMedioDiVendita(mLordo.fatturatoLordo, mLordo.conversioni);
  const margine = conBase(conto.marginePercentuale, 0, conto.clienti, {
    casi: "clienti",
    minimo: 1,
  });

  /* ── LE PERCENTUALI DELL'IMBUTO, CON LA LORO BASE ────────────────────────
     Le formule di kpi-calcoli tornano 0 quando il denominatore è zero — è
     giusto, un numero non può essere «niente» — ma stampato sotto un
     conteggio quello 0 si legge come un disastro: «presenza 0,0%» quando
     nessuno aveva un appuntamento, «ne chiude 0,0%» quando non c'è stata
     nessuna consulenza. E su tre o quattro casi una percentuale si sposta di
     venti punti per una persona sola. Qui non si ricalcola niente: si decide
     se quel numero ha diritto di essere scritto, con la soglia comune a tutta
     la pagina. */
  const versoAppuntamento = conBase(
    mLordo.leadVersoAppuntamento,
    mLordo.appuntamenti,
    mLordo.lead,
    { casi: "lead" },
  );
  const chiusura = conBase(mLordo.closeRate, mLordo.conversioni, mLordo.consulenze, {
    casi: "consulenze",
  });
  const suAppuntamenti = conBase(mLordo.cvr, mLordo.conversioni, mLordo.appuntamenti, {
    casi: "appuntamenti",
  });
  const presenza = conBase(
    mLordo.showRate,
    mLordo.appuntamentiConNoShow - mLordo.noShow,
    mLordo.appuntamentiConNoShow,
    { casi: "appuntamenti" },
  );
  /** L'imbuto in una frase esiste solo se c'è una base su cui dirla: «di ogni
   *  100 lead entrati, 0 e 0» calcolato su tre lead è una frase che sembra un
   *  verdetto e non lo è. */
  const imbutoInUnaFrase = mLordo.lead >= VOLUME_MINIMO_LPS;

  //  ── DOVE IL COLORE HA DIRITTO DI ESSERCI ────────────────────────────────
  //   Due condizioni, e nessuna è decorativa: la pubblicità restituisce meno di
  //   quanto costa, il periodo si chiude in perdita. Tutto il resto è inchiostro
  //   neutro.
  const ritornoInPerdita = mLordo.spesa > 0 && mLordo.roas < 1;
  const margineInPerdita = mNetto.fatturatoNetto < 0;
  //  La copertura sotto la quale i costi unitari vanno letti con la riserva
  //  scritta accanto: sotto il 90% dei giorni mancano più di tre giornate su
  //  trenta, e il costo per cliente ne esce più basso del vero.
  const coperturaZoppa = copertura.calcolabile && copertura.percentuale < 90;

  /** ── LA SCALA DELLE BARRE ────────────────────────────────────────────────
   *  Ogni voce del conto porta una barra lunga in proporzione alla PIÙ GRANDE
   *  fra le altre, non al totale: sul totale le voci piccole diventerebbero
   *  tutte un filo di due pixel, indistinguibili fra loro — e la differenza
   *  fra 200 € e 2.000 € è esattamente quello che si sta cercando di vedere.
   *  Il risultato resta fuori dalla scala: non è una fetta, è quello che
   *  avanza. */
  const voci = useMemo(() => vociDelConto(conto), [conto]);
  const scala = useMemo(
    () =>
      Math.max(1, ...voci.filter((v) => v.tipo !== "risultato").map((v) => Math.abs(v.importo))),
    [voci],
  );
  /** Tutto quello che è uscito: è il secondo numero della fascia in cima. */
  const uscito = conto.iva + conto.costiSchede + conto.spesaPubblicitaria;

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          1 · LA RISPOSTA, PRIMA DI TUTTO IL RESTO
          ⚠️ Questa fascia è nuova ed è il cuore del rifacimento. Prima la
           pagina si apriva con sei riquadri della stessa taglia — costo per
           cliente, costo per lead, ritorno, fatturato, netto, margine — e
           nessuno diceva quale fosse la domanda. Chi apre una pagina di conti
           ne ha una sola in testa: «alla fine, quanto mi resta?».
           Entrato meno uscito uguale resta, scritto come una sottrazione e non
           come tre fatti indipendenti.
          ══════════════════════════════════════════════════════════════════ */}
      <FasciaRisultato
        entrato={conto.incassato}
        uscito={uscito}
        resta={conto.netto}
        margine={margine.misurabile ? margine.valore : null}
        nota={
          <>
            {/*  ── ⚠️ «DEL PERIODO» FACEVA LEGGERE UN'ALTRA COSA ─────────────
                Segnalato dal committente: «dice 1 cliente e io ne ho chiusi di
                più». Il numero era giusto e la frase no. Questa scheda misura
                QUANTO RENDE LA SPESA, e per farlo prende i lead ARRIVATI nella
                finestra e segue loro — non le vendite chiuse dentro la
                finestra. È l'unico modo di confrontare la pubblicità di un
                mese con quello che quella pubblicità ha portato: attribuendo
                per data di vendita si metterebbero incassi di lead comprati a
                marzo sopra la spesa di agosto, e il ritorno uscirebbe
                inventato.
                «Su 1 cliente del periodo» però si legge come «hai chiuso una
                vendita sola», che è falso e spaventa. Adesso la frase dice di
                quali clienti sta parlando, e dove sono finiti gli altri.
                ⚠️ E il «Su» maiuscolo se n'è andato: `suQuanti` restituisce
                 già «su 1 cliente», e insieme facevano «Su su 1 cliente». */}
            {/*  ⚠️ SENZA «Su» DAVANTI: `suQuanti` restituisce già «su 1
                cliente», e insieme facevano «Su su 1 cliente». Era rimasto
                anche dopo la prima correzione — la frase l'avevo riscritta e
                la parola no. */}
            Calcolato {suQuanti(conto.clienti, "cliente", "clienti")} che ha CHIUSO in questa
            finestra: chiusura vuol dire acconto incassato, e la vendita conta nel giorno in cui si
            è chiusa — non in quello in cui era arrivato il contatto. «È uscito» comprende
            l&apos;IVA sugli incassi che ce l&apos;avevano, i costi scritti sulle schede e la spesa
            pubblicitaria. Il dettaglio è qui sotto.
          </>
        }
      />

      {/* ══════════════════════════════════════════════════════════════════
          2 · DOVE SONO FINITI I SOLDI
          Le stesse voci di prima, ma con una barra: «quale mi mangia di più»
          è una domanda a cui si risponde guardando, non confrontando a mente
          sei cifre incolonnate.
          ══════════════════════════════════════════════════════════════════ */}
      <Scheda
        titolo="Dove sono finiti i soldi"
        nota="Da quanto è entrato a quanto resta, una riga per volta"
        icona={Divide}
        senzaPadding
      >
        <ul className="divide-y divide-slate-100">
          {voci.map((v) => (
            <VoceConto
              key={v.chiave}
              etichetta={v.etichetta}
              nota={v.nota}
              importo={v.importo}
              quota={Math.abs(v.importo) / scala}
              tipo={v.tipo}
            />
          ))}
        </ul>
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          La spesa pubblicitaria è quella unica del periodo: registrata a mano dove c&apos;è,
          sincronizzata da Meta dove non c&apos;è, più la stima TikTok. Le voci a zero restano in
          elenco — «costo installatore € 0» dice che nessuno l&apos;ha scritto, una riga assente
          sembra una dimenticanza del programma.
        </p>
      </Scheda>

      {/* ══════════════════════════════════════════════════════════════════
          2-bis · COME SONO ENTRATI I SOLDI
          ⚠️ È CASSA, NON FISCO, e la scheda lo dice: quanto è passato da banca
           e POS e quanto dal cassetto. Serve a chi a fine mese deve far
           quadrare i due, e non tocca nessuno dei numeri qui sopra — da dove
           arrivano i soldi non cambia quanto se ne è guadagnato.
          ⚠️ E COMPARE SOLO SE QUALCUNO HA REGISTRATO QUALCOSA: una scheda con
           due zeri, su un archivio in cui il canale non si è mai scritto,
           sarebbe una domanda senza risposta messa in mezzo a dei conti veri.
          ══════════════════════════════════════════════════════════════════ */}
      {conto.incassatoTracciato + conto.incassatoContanti > 0 && (
        <Scheda
          titolo="Come sono entrati i soldi"
          nota="Quanto è passato dalla banca e quanto dal cassetto"
          icona={Wallet}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Kpi
              etichetta="Tracciati"
              valore={eur(conto.incassatoTracciato)}
              nota="Bonifico, carta o POS"
            />
            <Kpi
              etichetta="In contanti"
              valore={eur(conto.incassatoContanti)}
              nota="Dichiarati alla registrazione della vendita"
            />
          </div>
          {/*  ⚠️ IL NUMERO CHE MANCA VA DETTO. Senza questa riga i due importi
              sopra si leggono come il totale incassato, e non lo sono: sono
              solo le pratiche su cui qualcuno ha scritto come è stato pagato.
              Dedurre il resto — «se non l'hanno scritto sarà tracciato» —
              vorrebbe dire inventare un numero in un riepilogo di cassa, che è
              peggio di un numero mancante. */}
          <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
            {conto.schedeSenzaCanale > 0
              ? `Su ${conto.schedeSenzaCanale} ${
                  conto.schedeSenzaCanale === 1 ? "pratica" : "pratiche"
                } del periodo non è stato registrato come ha pagato: quelle non sono contate qui, né da una parte né dall'altra.`
              : "Su tutte le pratiche del periodo è stato registrato come ha pagato."}{" "}
            Questi due numeri non entrano nel conto qui sopra: dicono da dove sono arrivati i
            soldi, non quanto ne è rimasto.
          </p>
        </Scheda>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          3 · QUANTO COSTA PORTARE UN CLIENTE
          ⚠️ L'avviso sulla copertura sta QUI e non più in cima alla pagina.
           È il difetto che aveva: galleggiava sopra tutto, e riguarda solo
           questi tre numeri — sono loro che si dividono per la spesa. Sopra la
           fascia del risultato, che non c'entra, si leggeva come un allarme
           generale e faceva dubitare di numeri che non erano in discussione.
          ══════════════════════════════════════════════════════════════════ */}
      <Scheda
        titolo="Quanto costa portare un cliente"
        nota="I tre numeri della pubblicità: quanto costa un contatto, quanto costa chi compra, quanto torna indietro"
        icona={Target}
        classeCorpo="space-y-3 p-3"
      >
        {coperturaZoppa && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              La spesa risulta registrata su <strong>{copertura.giorniCoperti}</strong> giorni su{" "}
              <strong>{copertura.giorniTotali}</strong> ({pct(copertura.percentuale)}): questi tre
              numeri sono <strong>più bassi del vero</strong>.
              {copertura.scoperti.length > 0 && (
                <>
                  {" "}
                  Mancano {copertura.scoperti.slice(0, 6).map(giornoCorto).join(", ")}
                  {copertura.scoperti.length > 6 &&
                    ` e altri ${copertura.scoperti.length - 6} giorni`}
                  .
                </>
              )}{" "}
              <button
                type="button"
                onClick={vaiAlModulo}
                className="font-semibold underline underline-offset-2"
              >
                Registrala qui sotto
              </button>
              .
            </span>
          </p>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <CostoUnitario
            etichetta="Costo per cliente"
            valore={mLordo.cpa ? euroPreciso(mLordo.cpa) : "—"}
            base={
              mLordo.conversioni > 0
                ? `${suQuanti(mLordo.conversioni, "cliente", "clienti")} nel periodo${
                    prezzoMedio > 0 ? ` · prezzo medio ${eur(prezzoMedio)}` : ""
                  }`
                : "nessun cliente nel periodo: non è misurabile"
            }
            formula="Spesa pubblicitaria ÷ clienti acquisiti"
            icona={Target}
            principale
            onClick={() => mostraDietro("clienti", "cpa")}
            attivo={dietro?.da === "cpa"}
          />
          <CostoUnitario
            etichetta="Costo per lead"
            valore={mLordo.costoPerLead ? euroPreciso(mLordo.costoPerLead) : "—"}
            base={
              mLordo.lead > 0
                ? `${suQuanti(mLordo.lead, "lead entrato", "lead entrati")} nel periodo`
                : "nessun lead nel periodo"
            }
            formula="Spesa ÷ lead entrati. No show e rinvii restano fuori: non sono lead lavorati"
            icona={Users}
            onClick={() => mostraDietro("lead", "costoLead")}
            attivo={dietro?.da === "costoLead"}
          />
          <CostoUnitario
            etichetta="Ritorno sulla spesa"
            valore={mLordo.spesa > 0 ? volte(mLordo.roas) : "—"}
            base={
              mLordo.spesa > 0
                ? `su ${euroPreciso(mLordo.spesa)} spesi`
                : "nessuna spesa nel periodo"
            }
            formula="Fatturato ÷ spesa. Sotto 1× la pubblicità restituisce meno di quanto costa"
            icona={TrendingUp}
            allarme={ritornoInPerdita}
          />
        </div>
      </Scheda>

      {/* ══════════════════════════════════════════════════════════════════
          4 · IL PERCORSO
          ⚠️ Adesso l'imbuto si stringe DAVVERO. Erano cinque riquadri della
           stessa larghezza: la parola «imbuto» era l'unica cosa che si
           stringeva, e dove si perde gente bisognava dedurlo confrontando
           cinque numeri. Con le barre in proporzione al primo passo, il
           gradino si vede.
          ══════════════════════════════════════════════════════════════════ */}
      <Scheda
        titolo="Il percorso"
        nota="Da quanti entrano a quanti comprano. Premi un passaggio per vedere le schede che ci stanno dietro"
        icona={Users}
        senzaPadding
      >
        <div className="divide-y divide-slate-100">
          <PassoImbuto
            etichetta="Lead entrati"
            valore={mLordo.lead}
            quota={1}
            conversione="il punto di partenza"
            icona={Users}
            onClick={() => mostraDietro("lead", "lead")}
            attivo={dietro?.da === "lead"}
          />
          <PassoImbuto
            etichetta="Hanno fissato un appuntamento"
            valore={mLordo.appuntamenti}
            quota={mLordo.lead > 0 ? mLordo.appuntamenti / mLordo.lead : 0}
            conversione={
              versoAppuntamento.misurabile
                ? `${versoAppuntamento.valore} dei lead`
                : versoAppuntamento.base
            }
            icona={CalendarDays}
            onClick={() => mostraDietro("appuntamenti", "appuntamenti")}
            attivo={dietro?.da === "appuntamenti"}
          />
          <PassoImbuto
            etichetta="Si sono presentati (consulenza svolta)"
            valore={mLordo.consulenze}
            quota={mLordo.lead > 0 ? mLordo.consulenze / mLordo.lead : 0}
            conversione={presenza.misurabile ? `presenza ${presenza.valore}` : presenza.base}
            onClick={() => mostraDietro("consulenze", "consulenze")}
            attivo={dietro?.da === "consulenze"}
          />
          <PassoImbuto
            etichetta="Hanno comprato"
            valore={mLordo.conversioni}
            quota={mLordo.lead > 0 ? mLordo.conversioni / mLordo.lead : 0}
            conversione={chiusura.misurabile ? `ne chiude ${chiusura.valore}` : chiusura.base}
            tono={mLordo.conversioni > 0 ? "buono" : "neutro"}
            onClick={() => mostraDietro("clienti", "clienti")}
            attivo={dietro?.da === "clienti"}
          />
          {/*  I no show non sono un passo dell'imbuto: sono quelli che ne sono
              usciti. Stanno in fondo, staccati, in rosso — e la barra è in
              proporzione agli appuntamenti, non ai lead, perché è da lì che
              sono mancati. */}
          <PassoImbuto
            etichetta="Non si sono presentati"
            valore={mLordo.noShow}
            quota={
              mLordo.appuntamentiConNoShow > 0 ? mLordo.noShow / mLordo.appuntamentiConNoShow : 0
            }
            conversione={
              mLordo.appuntamentiConNoShow > 0
                ? `su ${mLordo.appuntamentiConNoShow} appuntamenti`
                : "nessun appuntamento"
            }
            tono={mLordo.noShow > 0 ? "male" : "neutro"}
            onClick={() => mostraDietro("noShow", "noShow")}
            attivo={dietro?.da === "noShow"}
          />
        </div>

        <div className="space-y-1.5 border-t border-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          <p className="text-[12px] text-slate-600">
            {imbutoInUnaFrase ? (
              <>
                Di ogni 100 lead entrati,{" "}
                <strong className="font-semibold tabular-nums text-slate-900">
                  {mLordo.leadVersoAppuntamento.toFixed(0)}
                </strong>{" "}
                fissano un appuntamento e{" "}
                <strong className="font-semibold tabular-nums text-slate-900">
                  {mLordo.conversioneTotale.toFixed(0)}
                </strong>{" "}
                comprano — su {mLordo.lead} lead del periodo.
              </>
            ) : mLordo.lead === 0 ? (
              "Nessun lead entrato nel periodo scelto: l'imbuto qui sopra non ha una base su cui essere calcolato. Allarga il periodo."
            ) : (
              `Nel periodo ${mLordo.lead === 1 ? "è entrato 1 lead" : `sono entrati ${mLordo.lead} lead`}: troppo pochi per ridurli a una proporzione su cento, dove una persona sola vale venti punti.`
            )}
          </p>
          <p>
            Conta come cliente chi è <strong>Venduto</strong> o <strong>Acconto</strong>, più{" "}
            <strong>Appuntamento in sede</strong> con la caparra spuntata. Un lead archiviato come{" "}
            <strong>Chiuso</strong> esce dal conteggio e il suo fatturato sparisce dal periodo,
            anche se il denaro è stato incassato.
          </p>
          <p>
            Tutto è agganciato alla data di <strong>ingresso del lead</strong>: una vendita chiusa
            oggi su un contatto di due mesi fa pesa su due mesi fa.
          </p>
          {fuoriPeriodo > 0 && (
            <p>
              <strong>{fuoriPeriodo}</strong>{" "}
              {fuoriPeriodo === 1 ? "scheda non ha" : "schede non hanno"} una data di ingresso
              leggibile e non {fuoriPeriodo === 1 ? "compare" : "compaiono"} in nessun periodo,
              nemmeno in «Tutto».
            </p>
          )}
        </div>
      </Scheda>

      {dietro && (
        <div ref={rifDietro}>
          <ElencoDietro
            titolo={TITOLO_DIETRO[dietro.chiave]}
            righe={elenchi[dietro.chiave]}
            conImporto={dietro.chiave === "clienti"}
            nomeConsulente={(id) => consultants.find((c) => c.id === id)?.data.nome || ""}
            onApri={(l) => ricerca.apriLead(l.id)}
            onChiudi={() => setDietro(null)}
          />
        </div>
      )}

      {/* ── ⚠️ LA CONTABILITÀ NON STA PIÙ QUI ───────────────────────────────
          Ci sono state per qualche giorno, e sono uscite: le spese fisse del
          mese e il conto delle imposte vivono adesso in /CRM/contabilita.
          Il motivo non è di spazio. Questa pagina risponde a «quanto rende
          quello che spendo in pubblicità» e si guarda a finestre mobili —
          trenta giorni, novanta. La contabilità risponde a «quanto devo allo
          Stato» e si guarda per mese, trimestre, anno: sono due domande con
          due calendari diversi, e messe nella stessa pagina il periodo scelto
          in cima ne accontentava una sola.
          ⚠️ Chi cerca il netto lo trova qui sopra ed è un altro numero: quello
           è il risultato della macchina commerciale, non l'utile dopo le
           imposte. Erano affiancati e si scambiavano. */}
      {/* ── IL REGISTRO DELLA SPESA ─────────────────────────────────────────
          Qui confluiscono le tre provenienze, e qui si REGISTRA la spesa a
          mano: registrare è un'azione, non una sezione di analisi, ed è il
          motivo per cui la scheda «KPI manuale» non esiste più. */}
      <div ref={rifModulo}>
        <Scheda
          titolo="Registro della spesa"
          nota={etichettaPeriodo(intervallo, estremi)}
          icona={BadgeEuro}
          azioni={
            <button
              type="button"
              onClick={riallinea}
              disabled={sincronizzando}
              title="Riscarica da Meta la spesa del periodo che stai guardando"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
            >
              {sincronizzando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Riallinea
            </button>
          }
          classeCorpo="space-y-3 p-3"
        >
          <ModuloSpesa onVediRegistro={apriRegistro} />

          {/* ── LE TRE PROVENIENZE, IN CHIARO ──────────────────────────────
              La somma delle tre non fa sempre il totale, ed è voluto: dove
              una giornata è scritta a mano la sincronizzazione NON entra, per
              non contare due volte lo stesso giorno. Il numero dei giorni
              sostituiti è lì per spiegarlo. */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi
              etichetta="Spesa del periodo"
              valore={euroPreciso(origine.totale)}
              nota="Il totale che usano tutti i numeri qui sopra"
              icona={BadgeEuro}
            />
            <Kpi
              etichetta="Sincronizzata"
              valore={euroPreciso(origine.sincronizzata)}
              nota={
                caricando
                  ? "Leggo la spesa…"
                  : oraDi(ultimaSync)
                    ? `Meta, letta alle ${oraDi(ultimaSync)}`
                    : "Nessuna lettura da Meta in questo periodo"
              }
            />
            <Kpi
              etichetta="Scritta a mano"
              valore={euroPreciso(origine.aMano)}
              nota={`${origine.registrazioniAMano} ${
                origine.registrazioniAMano === 1 ? "registrazione" : "registrazioni"
              }${origine.giorniSostituiti > 0 ? ` · sostituiscono ${origine.giorniSostituiti} ${origine.giorniSostituiti === 1 ? "giornata sincronizzata" : "giornate sincronizzate"}` : ""}`}
            />
            <Kpi
              etichetta="Stimata"
              valore={euroPreciso(origine.stimata)}
              nota={
                origine.stimata > 0
                  ? "TikTok, dal budget giornaliero: è una stima, non una lettura"
                  : "Nessun budget TikTok impostato"
              }
            />
          </div>

          {/* ── LA COPERTURA ───────────────────────────────────────────────
              Il numero che mancava: un costo per cliente calcolato su 24
              giorni di spesa su 30 è gonfiato di un quinto, e finora nessuno
              poteva accorgersene. */}
          <div className="rounded-lg border border-border px-3 py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Copertura della spesa
              </span>
              <span
                className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  coperturaZoppa && "text-amber-700",
                )}
              >
                {copertura.calcolabile
                  ? `${pct(copertura.percentuale)} · ${copertura.giorniCoperti} giorni su ${copertura.giorniTotali}`
                  : "—"}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {copertura.calcolabile
                ? "Giorni del periodo in cui risulta una spesa registrata (a mano o sincronizzata). La stima TikTok non conta: se contasse, con un budget impostato la copertura sarebbe sempre del 100% e il numero smetterebbe di dire qualcosa."
                : "Su «Tutto» non esiste un numero di giorni su cui misurarla: si dice, invece di stampare un 100% inventato."}
              {copertura.oggiDaRegistrare &&
                " Oggi non è ancora registrato, ed è fuori dal conto: è la giornata in corso, non un buco."}
            </p>
          </div>

          {registro.nonAttribuita > 0 && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <strong>{euroPreciso(registro.nonAttribuita)}</strong> di spesa scritta a mano non
              dice a quale canale appartiene: entra nel totale ma non nelle righe per canale della
              scheda «Fonti». Chi registra la sera ha in mano un totale, non una ripartizione — ed è
              meglio dirlo che infilarlo d'ufficio sotto Meta.
            </p>
          )}
        </Scheda>
      </div>

      <div ref={rifRegistro}>
        <RegistroSpesa
          dentro={dentro}
          giorni={giorni}
          aperto={registroAperto}
          onCambiaAperto={setRegistroAperto}
        />
      </div>
    </>
  );
}
