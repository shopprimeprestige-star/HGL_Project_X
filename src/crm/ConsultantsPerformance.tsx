/** ── I CONSULENTI, UNA RIGA A TESTA ────────────────────────────────────────
 *
 *  A COSA SERVE
 *  Dire in un colpo d'occhio chi sta lavorando bene. Quattro numeri per riga —
 *  appuntamenti, consulenze svolte, clienti chiusi, tasso di conversione — più
 *  il fatturato, che è il quinto numero che si guarda comunque.
 *
 *  DA DOVE VENGONO I NUMERI
 *  Da `calcolaMetricheConsulenti` (kpi-calcoli.ts), cioè dalle stesse formule
 *  del KPI manuale. Qui non si calcola nulla di nuovo: se questa schermata
 *  rifacesse le medie a modo suo, due pagine direbbero due verità sullo stesso
 *  consulente e nessuna delle due verrebbe più creduta. La tabella precedente
 *  aveva le sue formule copiate a mano ed è esattamente com'era nata la
 *  divergenza.
 *
 *  OGNI NUMERO È UNA PORTA
 *  Un numero da solo non si può verificare. Premendolo si apre la scheda del
 *  consulente già posizionata sull'elenco dei lead che lo compongono.
 *
 *  CHI È SPENTO RESTA
 *  Un consulente disattivato non sparisce dall'elenco: resta, con la sua riga
 *  spenta e la sua etichetta. Farlo sparire fa credere che sia stato
 *  cancellato — e il mese scorso ha comunque prodotto quei numeri.
 *
 *  CHI NON PUÒ ENTRARE LO DICE QUI
 *  Accanto al nome di un consulente attivo senza PIN non c'è un'etichetta ma un
 *  tasto, «Assegna PIN», che apre la sua scheda già sull'accesso. Era il buco
 *  più costoso della schermata: la squadra risultava al lavoro mentre uno solo
 *  aveva davvero le chiavi del CRM, e dalla tabella non si vedeva.
 *
 *  DUE MESTIERI, DUE ELENCHI
 *  Chi telefona e chi fa le consulenze non si confrontano nella stessa tabella:
 *  il primo risponde di quanti appuntamenti mette in agenda, il secondo di
 *  quante consulenze diventano clienti. Una classifica sola li mescolerebbe e
 *  farebbe risultare "peggiore" chi telefona tutto il giorno. Qui in cima c'è
 *  quindi una scelta — Consulenti / Setter — e una persona che fa entrambi i
 *  mestieri compare in tutti e due gli elenchi, con numeri diversi.
 *  Il mestiere è un attributo della persona (crm/kpi-setter.ts) e NON è il
 *  livello di permesso: si può avere il livello «consulente» e telefonare.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  KeyRound,
  PhoneCall,
  Power,
  Trash2,
  TriangleAlert,
  Medal,
  Trophy,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra, KpiFinestra, NotaFinestra, SezioneFinestra } from "@/crm/ui/Finestra";
import { storicoConsulente, useCRM, type ModoRimozione } from "@/crm/CRMContext";
import {
  STATI_CONSULENZA,
  calcolaMetricheConsulenti,
  eConversione,
  ricavoLordo,
  type FiltroPeriodo,
  type MetricheConsulente,
} from "@/crm/kpi-calcoli";
import {
  CLASSI_TONO,
  Chip,
  ChipStato,
  Kpi,
  KpiRiga,
  Scheda,
  Segmento,
  TESTO_TONO,
  Vuoto,
  VuotoRiga,
  dataBreve,
  eur,
  useRicerca,
  type Tono,
} from "@/crm/ui";
import { calcolaMetricheSetter, mestieriDi, type GruppoSetter } from "@/crm/kpi-setter";
import { ConfrontoSetter, NotaAttribuzioneSetter, TotaliSetter } from "@/crm/kpi/setter-pezzi";
import type { Consultant, Lead } from "@/crm/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   1. I GRUPPI — cosa c'è dietro ogni numero
   ═════════════════════════════════════════════════════════════════════════ */

export type GruppoNumero =
  | "lead"
  | "appuntamenti"
  | "consulenze"
  | "clienti"
  | "noShow"
  | "fatturato";

export const GRUPPI: Record<GruppoNumero, { etichetta: string; spiegazione: string }> = {
  lead: {
    etichetta: "Lead",
    spiegazione:
      "Tutte le schede assegnate nel periodo, no show e rinvii compresi: è su questo numero che si divide la spesa pubblicitaria.",
  },
  appuntamenti: {
    etichetta: "Appuntamenti",
    spiegazione: "Appuntamenti validi: fuori i no show e i «fissa meet dopo».",
  },
  consulenze: {
    etichetta: "Consulenze",
    spiegazione: "Consulenze davvero svolte: è il denominatore del tasso di conversione.",
  },
  clienti: {
    etichetta: "Clienti",
    spiegazione: "Lead chiusi: venduto, acconto, e il «viene in sede» con l'acconto spuntato.",
  },
  noShow: {
    etichetta: "No show",
    spiegazione: "Appuntamenti a cui il cliente non si è presentato.",
  },
  fatturato: {
    etichetta: "Fatturato",
    spiegazione: "Somma dei prezzi finali di vendita dei lead chiusi.",
  },
};

//  ── LO STESSO ELENCO DI kpi-calcoli, PURTROPPO RICOPIATO ──────────────────
//   `STATI_NON_CONTEGGIABILI` in kpi-calcoli.ts non è esportato, e senza di
//   quello l'elenco dietro il numero "Appuntamenti" mostrerebbe righe diverse
//   da quelle contate. Finché non viene esportato, questo array deve restare
//   identico a quello: se lì cambia, qui va cambiato lo stesso giorno.
const STATI_FUORI_APPUNTAMENTO: readonly string[] = ["no_show", "fissa_meet_dopo"];

/** I lead che compongono un numero. Serve al pannello del consulente
 *  per far vedere le righe dietro la cifra, e alla coda "senza consulente". */
export function leadDelGruppo(
  leads: Lead[],
  consulenteId: string | null,
  gruppo: GruppoNumero,
  dentro: FiltroPeriodo,
): Lead[] {
  const suoi = leads.filter(
    (l) =>
      dentro(l.data.createdAt) &&
      (consulenteId === null ? !l.data.consulenteId : l.data.consulenteId === consulenteId),
  );
  const scelti = suoi.filter((l) => {
    switch (gruppo) {
      case "appuntamenti":
        return !!l.data.dataMeeting && !STATI_FUORI_APPUNTAMENTO.includes(l.data.stato);
      case "consulenze":
        return STATI_CONSULENZA.includes(l.data.stato);
      case "clienti":
      case "fatturato":
        return eConversione(l);
      case "noShow":
        return l.data.stato === "no_show";
      default:
        return true;
    }
  });
  return scelti.sort((a, b) => (b.data.createdAt || "").localeCompare(a.data.createdAt || ""));
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. L'ELENCO DIETRO IL NUMERO
   ═════════════════════════════════════════════════════════════════════════ */

const MASSIMO_RIGHE = 40;

/** I lead in fila, ognuno apribile. Vive qui e non nel pannello perché
 *  la stessa lista serve anche alla coda delle schede senza consulente: due
 *  copie della stessa riga avrebbero preso due aspetti diversi. */
export function ElencoLead({
  leads,
  gruppo,
  onApri,
  vuoto,
}: {
  leads: Lead[];
  gruppo: GruppoNumero;
  onApri: (leadId: string) => void;
  vuoto: string;
}) {
  if (leads.length === 0) return <VuotoRiga testo={vuoto} />;
  const mostrati = leads.slice(0, MASSIMO_RIGHE);
  return (
    <div>
      <ul className="divide-y divide-border">
        {mostrati.map((l) => {
          const importo = ricavoLordo(l);
          const quando =
            gruppo === "appuntamenti" && l.data.dataMeeting
              ? `Appuntamento ${dataBreve(l.data.dataMeeting)}${l.data.oraMeeting ? ` · ${l.data.oraMeeting}` : ""}`
              : `Entrata il ${dataBreve(l.data.createdAt)}`;
          return (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onApri(l.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {l.data.nome} {l.data.cognome}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <ChipStato stato={l.data.stato} />
                    <span className="truncate text-[11px] text-muted-foreground">{quando}</span>
                  </span>
                </span>
                {importo > 0 && (
                  <span className="shrink-0 text-[12.5px] font-medium tabular-nums">
                    {eur(importo)}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
      {leads.length > mostrati.length && (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          Mostrate le {MASSIMO_RIGHE} più recenti su {leads.length}.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA TABELLA — chi sta lavorando bene
   ═════════════════════════════════════════════════════════════════════════ */

type Ordine = "conversioni" | "cvr" | "appuntamenti" | "consulenze" | "lead" | "fatturatoLordo";

export type FiltroAttivi = "tutti" | "attivi" | "spenti";

/** Il tasso di conversione è l'unico numero che vale la pena colorare: dice se
 *  la persona sta chiudendo o solo parlando. Le soglie sono quelle già usate
 *  nella tabella precedente, così chi le aveva in testa le ritrova. */
function tonoCvr(cvr: number, consulenze: number): Tono {
  if (consulenze === 0) return "neutro";
  if (cvr >= 50) return "vinta";
  if (cvr >= 25) return "in_sospeso";
  return "neutro";
}

interface Props {
  /** La finestra temporale scelta dalla pagina: uno solo per tutta la schermata. */
  dentro: FiltroPeriodo;
  /** Frase che dice quale periodo si sta guardando (per le note). */
  etichettaPeriodo?: string;
  /** Quali consulenti mostrare. Gli spenti restano visibili, ma si possono isolare. */
  filtro?: FiltroAttivi;
  /** Chi può entrare: true = PIN attivo, false = fuori dal CRM. La chiave manca
   *  finché non si sa (richiesta non ancora tornata, o fallita): un "non lo so"
   *  non deve diventare un allarme. */
  accessi?: Record<string, boolean>;
  /** Il numero premuto apre la scheda del consulente su quell'elenco. */
  onApri?: (consulenteId: string, gruppo: GruppoNumero) => void;
  /** Lo stesso, per i numeri del setter: sono gruppi diversi perché
   *  rispondono a domande diverse, e mescolarli aprirebbe l'elenco sbagliato. */
  onApriSetter?: (setterId: string, gruppo: GruppoSetter) => void;
  /** «Assegna PIN» premuto sulla riga: apre la scheda già sull'accesso. */
  onAccesso?: (consulenteId: string) => void;
  /** Il cestino sulla riga. Se manca, il cestino NON compare: è così che questa
   *  tabella resta usabile da una pagina che non deve poter togliere nessuno.
   *  Chi lo passa ha già verificato il permesso `consulenti` — e comunque
   *  nasconderlo non è la difesa: quella la fa il server (vedi
   *  `rimuoviConsulente` in CRMContext). */
  onElimina?: (consulenteId: string) => void;
  className?: string;
}

/** Le due classifiche. Non è un filtro sulle stesse righe: sono due tabelle con
 *  colonne diverse, perché i due mestieri si misurano su cose diverse. */
type VistaMestiere = "consulenti" | "setter";

export function ConsultantsPerformance({
  dentro,
  etichettaPeriodo,
  filtro = "tutti",
  accessi,
  onApri,
  onApriSetter,
  onAccesso,
  onElimina,
  className,
}: Props) {
  const { leads, consultants, adSpending } = useCRM();
  const ricerca = useRicerca();
  const [ordine, setOrdine] = useState<Ordine>("conversioni");
  const [apriSenza, setApriSenza] = useState(false);
  //  Si parte dai consulenti: è la classifica che questa pagina mostrava da
  //  sempre, e chi la apre per abitudine deve ritrovarla dov'era.
  const [vista, setVista] = useState<VistaMestiere>("consulenti");

  //  Il calcolo riceve SEMPRE tutti i consulenti: la quota di lead e la spesa
  //  attribuita si dividono sull'intera squadra. Filtrare prima del calcolo
  //  avrebbe gonfiato la quota di chi resta.
  const metriche = useMemo(
    () => calcolaMetricheConsulenti(leads, consultants, adSpending, dentro),
    [leads, consultants, adSpending, dentro],
  );

  const anagrafica = useMemo(() => {
    const m = new Map<string, Consultant>();
    consultants.forEach((c) => m.set(c.id, c));
    return m;
  }, [consultants]);

  //  I setter si calcolano SEMPRE, anche mentre si guardano i consulenti: il
  //  conteggio sulla linguetta deve esserci prima che qualcuno la prema, e un
  //  hook dentro un ramo condizionale è il modo classico di rompere React.
  const righeSetter = useMemo(
    () => calcolaMetricheSetter(leads, consultants, dentro),
    [leads, consultants, dentro],
  );

  const righe = useMemo(() => {
    const visibili = metriche.filter((r) => {
      const c = anagrafica.get(r.id);
      //  Un consulente cancellato dall'anagrafica ma con lead suoi resta
      //  in tabella: quei lead sono esistiti e i numeri devono tornare.
      //  Non sappiamo che mestiere facesse, e il ripiego è «consulente»: è la
      //  stessa scelta di kpi-setter, e toglierlo di qui farebbe sparire dei
      //  numeri che esistono.
      if (!c) return filtro !== "spenti";
      //  Chi NON fa il consulente non sta in questa classifica: le sue colonne
      //  (consulenze, clienti, CVR) misurano un mestiere che non fa, e a zero
      //  sembrerebbe semplicemente il peggiore della squadra. Per chi c'era già
      //  non cambia niente: il valore di partenza è «fa il consulente».
      if (!mestieriDi(c.data).faConsulente) return false;
      if (filtro === "attivi") return c.data.attivo;
      if (filtro === "spenti") return !c.data.attivo;
      return true;
    });
    const chiave = (r: MetricheConsulente) => {
      switch (ordine) {
        case "cvr":
          return r.cvr;
        case "appuntamenti":
          return r.appuntamenti;
        case "consulenze":
          return r.consulenze;
        case "lead":
          return r.lead;
        case "fatturatoLordo":
          return r.fatturatoLordo;
        default:
          return r.conversioni;
      }
    };
    return [...visibili].sort(
      (a, b) => chiave(b) - chiave(a) || b.fatturatoLordo - a.fatturatoLordo,
    );
  }, [metriche, anagrafica, filtro, ordine]);

  const totali = useMemo(() => {
    const t = righe.reduce(
      (a, r) => {
        a.lead += r.lead;
        a.appuntamenti += r.appuntamenti;
        a.consulenze += r.consulenze;
        a.conversioni += r.conversioni;
        a.noShow += r.noShow;
        a.fatturato += r.fatturatoLordo;
        return a;
      },
      { lead: 0, appuntamenti: 0, consulenze: 0, conversioni: 0, noShow: 0, fatturato: 0 },
    );
    return { ...t, cvr: t.consulenze > 0 ? (t.conversioni / t.consulenze) * 100 : 0 };
  }, [righe]);

  //  Gli stessi filtri «attivi / spenti» valgono anche per i setter: la barra
  //  in cima alla pagina è una sola, e una scelta che vale per una tabella e
  //  non per l'altra si legge come un errore della pagina.
  const setterVisibili = useMemo(() => {
    if (filtro === "tutti") return righeSetter;
    return righeSetter.filter((r) => {
      const c = anagrafica.get(r.id);
      if (!c) return filtro !== "spenti";
      return filtro === "attivi" ? c.data.attivo : !c.data.attivo;
    });
  }, [righeSetter, anagrafica, filtro]);

  //  ── LA CODA CHE NON È DI NESSUNO ────────────────────────────────────────
  //   Le schede senza consulente non compaiono nei numeri di nessuno: se non
  //   si dicono qui, spariscono e restano ferme per giorni.
  const senzaConsulente = useMemo(
    () => leadDelGruppo(leads, null, "lead", dentro),
    [leads, dentro],
  );

  const primo = righe[0];

  /** ── LA CLASSIFICA DEL CVR ─────────────────────────────────────────────────
   *  Trofeo al primo, medaglia al secondo e al terzo, in ordine di conversione
   *  — non di fatturato, non di numero di consulenze: il CVR dice quanto bene
   *  lavora una persona, gli altri due dicono quanto le è passato davanti.
   *
   *  ⚠️ La classifica si calcola sul CVR anche quando la tabella è ordinata per
   *  un'altra colonna: se seguisse l'ordinamento, il trofeo salterebbe di riga
   *  a ogni clic sulle intestazioni e smetterebbe di significare qualcosa.
   *
   *  ⚠️ Ci entra solo chi ha davvero fatto consulenze. Un CVR del 100% su una
   *  consulenza sola non è il miglior risultato del mese: è un caso, e premiarlo
   *  toglie il premio a chi ne ha fatte trenta. Stessa ragione per cui un CVR a
   *  zero resta fuori — le medaglie sono un riconoscimento, e darle a tutti fino
   *  a riempire i tre posti le svuota.
   *
   *  ⚠️ A parimerito NON si assegna niente a nessuno dei due: due trofei
   *  identici nella stessa colonna si leggono come un errore di disegno, e chi
   *  guarda va a cercare quale dei due è quello vero. */
  const MINIME_PER_CLASSIFICA = 3;
  const classifica = useMemo(() => {
    const candidati = righe
      .filter((r) => r.consulenze >= MINIME_PER_CLASSIFICA && r.cvr > 0)
      .sort((a, b) => b.cvr - a.cvr);
    const posti = new Map<string, 1 | 2 | 3>();
    let posto = 0;
    for (const r of candidati) {
      posto += 1;
      if (posto > 3) break;
      //  Parimerito: nessuno dei due prende il posto, e il posto si brucia.
      const exAequo = candidati.filter((x) => x.cvr === r.cvr).length > 1;
      if (!exAequo) posti.set(r.id, posto as 1 | 2 | 3);
    }
    return posti;
  }, [righe]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/*  ── QUALE MESTIERE SI STA GUARDANDO ─────────────────────────────────
          Due tabelle, non un filtro: le colonne sono diverse perché le domande
          sono diverse. Chi fa entrambi i mestieri compare in tutte e due, con
          numeri suoi. Il conteggio accanto dice subito se qualcuno è segnato
          come setter: uno zero qui è la risposta a «perché la tabella è
          vuota». */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Segmento
          attivo={vista === "consulenti"}
          onClick={() => setVista("consulenti")}
          conteggio={righe.length}
          titolo="Chi svolge le videoconsulenze: si misura su quante diventano clienti"
        >
          Consulenti
        </Segmento>
        <Segmento
          attivo={vista === "setter"}
          onClick={() => setVista("setter")}
          conteggio={setterVisibili.length}
          titolo="Chi telefona e fissa: si misura su quanti appuntamenti mette in agenda"
        >
          Setter
        </Segmento>
      </div>

      {vista === "setter" && (
        <>
          {/*  I totali della squadra solo se una squadra c'è: con nessuno
              segnato come setter sarebbero cinque riquadri di zeri per un
              mestiere che in questo CRM ancora non risulta fatto da nessuno —
              e cinque zeri si leggono come «lavorano male», non come «non è
              stato ancora indicato chi telefona». Il perché lo dice la riga
              vuota della tabella qui sotto. */}
          {setterVisibili.length > 0 && <TotaliSetter righe={setterVisibili} />}
          <Scheda
            titolo="Chi telefona, a confronto"
            nota={
              etichettaPeriodo
                ? `${etichettaPeriodo} · il numero che conta è «fissati su 100 contatti lavorati»`
                : "Il numero che conta è «fissati su 100 contatti lavorati»"
            }
            icona={PhoneCall}
            senzaPadding
          >
            <ConfrontoSetter righe={setterVisibili} onApri={onApriSetter} />
            {setterVisibili.length > 0 && <NotaAttribuzioneSetter />}
          </Scheda>
        </>
      )}

      {vista === "consulenti" && (
        <>
          {/*  I totali in alto non sono decorativi: premendone uno la tabella si
          riordina su quel numero, che è il modo più rapido di rispondere a
          "chi ne ha fatti di più". */}
          <KpiRiga colonne={6}>
            <Kpi
              etichetta="Lead"
              valore={totali.lead}
              nota="Assegnati nel periodo"
              onClick={() => setOrdine("lead")}
              attivo={ordine === "lead"}
            />
            <Kpi
              etichetta="Appuntamenti"
              valore={totali.appuntamenti}
              onClick={() => setOrdine("appuntamenti")}
              attivo={ordine === "appuntamenti"}
            />
            <Kpi
              etichetta="Consulenze"
              valore={totali.consulenze}
              onClick={() => setOrdine("consulenze")}
              attivo={ordine === "consulenze"}
            />
            <Kpi
              etichetta="Clienti"
              valore={totali.conversioni}
              tono={totali.conversioni > 0 ? "vinta" : "neutro"}
              onClick={() => setOrdine("conversioni")}
              attivo={ordine === "conversioni"}
            />
            {/*  ── LA PERCENTUALE PORTA LA SUA BASE ─────────────────────────
                Senza consulenze svolte non si scrive «0%»: uno zero con la
                virgola si legge come «chiude niente», mentre la verità è che
                non c'è ancora niente da misurare. */}
            <Kpi
              etichetta="CVR squadra"
              valore={totali.consulenze > 0 ? `${totali.cvr.toFixed(1)}%` : "—"}
              nota={
                totali.consulenze > 0
                  ? `${totali.conversioni} su ${totali.consulenze} consulenze`
                  : "Nessuna consulenza svolta nel periodo"
              }
              tono={tonoCvr(totali.cvr, totali.consulenze)}
              onClick={() => setOrdine("cvr")}
              attivo={ordine === "cvr"}
            />
            <Kpi
              etichetta="Fatturato"
              valore={eur(totali.fatturato)}
              onClick={() => setOrdine("fatturatoLordo")}
              attivo={ordine === "fatturatoLordo"}
            />
          </KpiRiga>

          <Scheda
            titolo="Come sta andando ognuno"
            nota={
              etichettaPeriodo
                ? `${etichettaPeriodo} · premi un numero per vedere i lead che lo compongono`
                : "Premi un numero per vedere i lead che lo compongono"
            }
            senzaPadding
          >
            {righe.length === 0 ? (
              <Vuoto
                titolo="Nessun consulente da mostrare"
                testo={
                  filtro === "spenti"
                    ? "Nessun consulente è stato disattivato."
                    : "Aggiungi un consulente o approva una richiesta in attesa."
                }
                className="m-3 border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {righe.map((r) => {
                  const c = anagrafica.get(r.id);
                  const spento = !!c && !c.data.attivo;
                  //  Si avvisa SOLO di chi dovrebbe stare dentro e non ci entra: su
                  //  uno spento la mancanza del PIN è coerente, non un problema.
                  const senzaAccesso = !!c && c.data.attivo && accessi?.[r.id] === false;
                  const migliore = r.id === primo?.id && righe.length > 1 && r.conversioni > 0;
                  const posto = classifica.get(r.id);
                  //  Chi fa due mestieri ha due serie di numeri: dirlo qui evita
                  //  che il suo lavoro al telefono passi per inesistente solo
                  //  perché questa tabella non lo misura.
                  const ancheSetter = !!c && mestieriDi(c.data).faSetter;
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3",
                        spento && "bg-muted/40",
                      )}
                    >
                      {/* chi è */}
                      <div className="flex min-w-0 items-start gap-2 sm:w-52 sm:shrink-0">
                        {/*  ⚠️ Icone, mai emoji: un'emoji cambia disegno da un
                            sistema all'altro e su Windows la coppa diventa un
                            rettangolo. Il posto sta anche nel testo del titolo e
                            nell'etichetta per chi legge con la voce: un colore e
                            una forma, da soli, non dicono «secondo».  */}
                        {posto === 1 && (
                          <span
                            className="mt-0.5 shrink-0"
                            title={`Primo per conversione: ${Math.round(r.cvr)}%`}
                          >
                            <Trophy
                              className="h-3.5 w-3.5 text-amber-500"
                              aria-label="Primo per conversione"
                            />
                          </span>
                        )}
                        {posto === 2 && (
                          <span
                            className="mt-0.5 shrink-0"
                            title={`Secondo per conversione: ${Math.round(r.cvr)}%`}
                          >
                            <Medal
                              className="h-3.5 w-3.5 text-slate-400"
                              aria-label="Secondo per conversione"
                            />
                          </span>
                        )}
                        {posto === 3 && (
                          <span
                            className="mt-0.5 shrink-0"
                            title={`Terzo per conversione: ${Math.round(r.cvr)}%`}
                          >
                            <Medal
                              className="h-3.5 w-3.5 text-amber-700"
                              aria-label="Terzo per conversione"
                            />
                          </span>
                        )}
                        {!posto && migliore && (
                          <Trophy
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                            aria-label="Miglior risultato"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onApri?.(r.id, "lead")}
                            className="block w-full min-w-0 text-left"
                          >
                            <span
                              className={cn(
                                "block truncate text-[14px] font-semibold leading-tight",
                                spento && "text-muted-foreground",
                              )}
                            >
                              {r.nome}
                            </span>
                          </button>
                          {/*  «Senza accesso» non è un'etichetta ma il tasto che
                          risolve: è fuori dal pulsante del nome perché porta
                          altrove — dritto al PIN, non ai numeri. */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {spento && <Chip tono="chiusa">Spento</Chip>}
                            {ancheSetter && (
                              <button
                                type="button"
                                onClick={() => setVista("setter")}
                                title="Fa anche il setter: i suoi numeri al telefono stanno nella vista «Setter»"
                                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <PhoneCall className="h-3 w-3 shrink-0" />
                                <span className="truncate">Anche setter</span>
                              </button>
                            )}
                            {senzaAccesso && (
                              <button
                                type="button"
                                onClick={() => onAccesso?.(r.id)}
                                title="Non ha un PIN: non entra né nel CRM né in videoconsulenza. Premi per assegnarglielo."
                                className={cn(
                                  "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5",
                                  "text-[11px] font-medium leading-5 whitespace-nowrap transition-colors hover:brightness-95",
                                  CLASSI_TONO.in_sospeso,
                                )}
                              >
                                <KeyRound className="h-3 w-3 shrink-0" />
                                <span className="truncate">Assegna PIN</span>
                              </button>
                            )}
                            {!spento && !senzaAccesso && (
                              <span className="text-[11px] text-muted-foreground">
                                {r.quotaLead > 0
                                  ? `${(r.quotaLead * 100).toFixed(0)}% dei lead`
                                  : "Nessun lead nel periodo"}
                              </span>
                            )}
                          </div>
                        </div>
                        {/*  ── IL CESTINO, DISCRETO ────────────────────────────
                            Solo icona e grigio: «Assegna PIN» è il gesto di
                            tutti i giorni e deve restare il più evidente della
                            riga. Compare solo se la persona è ANCORA in
                            anagrafica: sulla riga «Sconosciuto» di un
                            consulente già cancellato non c'è niente da
                            togliere, e un cestino lì prometterebbe di far
                            sparire dei numeri che invece restano. */}
                        {onElimina && c && (
                          <BottoneCestino
                            nome={r.nome}
                            onClick={() => onElimina(r.id)}
                            className="-mr-1 -mt-0.5"
                          />
                        )}
                      </div>

                      {/* i suoi numeri */}
                      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 sm:grid-cols-5">
                        <Numero
                          etichetta="Appuntam."
                          valore={r.appuntamenti}
                          titolo={GRUPPI.appuntamenti.spiegazione}
                          onClick={() => onApri?.(r.id, "appuntamenti")}
                        />
                        <Numero
                          etichetta="Consulenze"
                          valore={r.consulenze}
                          titolo={GRUPPI.consulenze.spiegazione}
                          onClick={() => onApri?.(r.id, "consulenze")}
                        />
                        <Numero
                          etichetta="Clienti"
                          valore={r.conversioni}
                          tono={r.conversioni > 0 ? "vinta" : "neutro"}
                          titolo={GRUPPI.clienti.spiegazione}
                          onClick={() => onApri?.(r.id, "clienti")}
                        />
                        {/*  Con zero consulenze la cifra è un trattino, non uno
                           «0%»: la stessa regola della scheda «Consulenti» dei
                           KPI, o la stessa persona risulta a 0% di là e a —
                           di qua. Il titolo porta sempre la base. */}
                        <Numero
                          etichetta="CVR"
                          valore={r.consulenze > 0 ? `${r.cvr.toFixed(0)}%` : "—"}
                          tono={tonoCvr(r.cvr, r.consulenze)}
                          titolo={
                            r.consulenze > 0
                              ? `${r.conversioni} clienti su ${r.consulenze} consulenze svolte. I no show non sono nel conto.`
                              : "Nessuna consulenza svolta nel periodo: non c'è ancora niente da misurare."
                          }
                          onClick={() => onApri?.(r.id, "consulenze")}
                        />
                        <Numero
                          etichetta="Fatturato"
                          valore={eur(r.fatturatoLordo)}
                          titolo={GRUPPI.fatturato.spiegazione}
                          onClick={() => onApri?.(r.id, "fatturato")}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => onApri?.(r.id, "lead")}
                        title="Apri la scheda del consulente"
                        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* la coda di nessuno */}
            {senzaConsulente.length > 0 && (
              <div className="border-t border-border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setApriSenza((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <UserX className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">
                    Schede senza consulente nel periodo
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                    {senzaConsulente.length}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      apriSenza && "rotate-90",
                    )}
                  />
                </button>
                {apriSenza && (
                  <div className="border-t border-border bg-card">
                    <ElencoLead
                      leads={senzaConsulente}
                      gruppo="lead"
                      onApri={ricerca.apriLead}
                      vuoto="Nessuna scheda da assegnare."
                    />
                  </div>
                )}
              </div>
            )}
          </Scheda>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. TOGLIERE UNA PERSONA — il cestino e la sua conferma
   ═════════════════════════════════════════════════════════════════════════ */

/** ── UN'AZIONE DISTRUTTIVA NON HA IL PESO DI UNA QUOTIDIANA ────────────────
 *  Icona sola, grigia, senza bordo: accanto a «Assegna PIN» — che è il tasto
 *  che si preme ogni giorno — deve leggersi come una cosa che sta lì, non come
 *  una cosa da fare. Diventa rossa solo quando ci si passa sopra, cioè quando
 *  qualcuno la sta davvero cercando. Il quadrato è 32px anche se l'icona ne
 *  occupa 14: sul telefono un bersaglio più piccolo si preme per sbaglio, ed è
 *  l'unico tasto della riga in cui «per sbaglio» conta qualcosa. */
export function BottoneCestino({
  nome,
  onClick,
  className,
}: {
  nome: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Togli ${nome} dal CRM`}
      aria-label={`Togli ${nome} dal CRM`}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/70",
        "transition-colors hover:bg-rose-50 hover:text-rose-600",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300",
        className,
      )}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** ── LA CONFERMA DICE COSA SI PERDE ────────────────────────────────────────
 *  Una finestra sola per tutti i punti da cui si può togliere qualcuno (il
 *  riquadro di chi non entra, l'elenco «Come sta andando ognuno», la scheda):
 *  due conferme scritte in due posti diventano due promesse diverse, e una
 *  delle due invecchia.
 *
 *  Quello che c'è dentro è il minimo per capire cosa si sta facendo: il nome,
 *  i suoi numeri VERI di sempre, e la frase che dice se questo gesto SPEGNE o
 *  CANCELLA. «Sei sicuro?» non è una conferma: è un passaggio che si preme
 *  senza leggere.
 *
 *  ⚠️ SPEGNERE E CANCELLARE NON SONO LA STESSA COSA e la finestra non prova a
 *  farle sembrare uguali: cambiano titolo, colore della nota e parola sul tasto
 *  finale. Chi preme deve sapere quale delle due sta facendo PRIMA di premere.
 *  La regola è in `rimuoviConsulente` (CRMContext) — qui si racconta, là si
 *  decide, e c'è un posto solo in cui cambiarla. */
export function ConfermaRimozione({
  consulente,
  aperta,
  onCambio,
  accessoAttivo,
  onFatto,
}: {
  /** Chi si sta togliendo. `null` = finestra chiusa e niente da disegnare. */
  consulente: Consultant | null;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** Se si sa già se ha un PIN attivo, la finestra lo dice con precisione
   *  invece di una frase che vale per tutti. `undefined` = non lo sappiamo. */
  accessoAttivo?: boolean;
  /** Riuscito: la pagina chiude, aggiorna quello che deve e ringrazia. */
  onFatto?: (id: string, modo: ModoRimozione) => void;
}) {
  const { leads, rimuoviConsulente } = useCRM();
  const [inCorso, setInCorso] = useState(false);
  //  ⚠️ Il tasto è già `disabled`, ma quel `disabled` arriva col disegno
  //  successivo: un doppio clic rapido — o l'Invio tenuto premuto — entra due
  //  volte. La seconda passata trova la riga già cancellata e il database
  //  risponde «zero righe toccate», cioè un errore rosso DOPO una cancellazione
  //  riuscita. Il blocco vero è questo, che non aspetta React.
  const inCorsoRef = useRef(false);
  //  ⚠️ Gli hook stanno TUTTI sopra il return anticipato: `consulente` è null
  //  ogni volta che la finestra è chiusa, e un useMemo sotto al return
  //  cambierebbe il numero di hook fra un disegno e l'altro.
  const id = consulente?.id ?? "";
  const storia = useMemo(() => storicoConsulente(leads, id), [leads, id]);
  if (!consulente) return null;

  //  ⚠️ `data` è tipata come sempre presente, ma nel database c'è di tutto: una
  //  riga senza `data` farebbe esplodere la finestra proprio mentre si sta per
  //  cancellare qualcuno. Si legge in punta di piedi.
  const nome = consulente.data?.nome || "questa persona";
  const eraAttivo = consulente.data?.attivo !== false;
  //  Spegnere chi è già spento non è un'azione: in quel caso resta solo la
  //  revoca dell'accesso, e va detto — o il tasto sembra non aver fatto niente.
  const soloChiavi = storia.haStoria && !eraAttivo;

  const conferma = async () => {
    if (inCorsoRef.current) return;
    inCorsoRef.current = true;
    setInCorso(true);
    const esito = await rimuoviConsulente(consulente.id);
    inCorsoRef.current = false;
    setInCorso(false);
    //  Il motivo del no lo ha già scritto a schermo `rimuoviConsulente`, con le
    //  parole del server. Qui la finestra RESTA APERTA: chiuderla su un errore
    //  vorrebbe dire far sparire il contesto di ciò che non è riuscito.
    if (!esito.ok || !esito.modo) return;
    onCambio(false);
    onFatto?.(consulente.id, esito.modo);
    //  ⚠️ Se è successa una cosa DIVERSA da quella annunciata — si è premuto
    //  «Elimina definitivamente» e il database ha rivelato dei lead che questa
    //  pagina non aveva — lo dice l'avviso, e prende il posto della frase
    //  rassicurante: chi ha premuto deve sapere che quella persona è ancora lì,
    //  spenta, e non cancellata come aveva appena letto.
    toast.success(
      esito.avviso
        ? `${nome} spenta, non eliminata`
        : esito.modo === "eliminato"
          ? `${nome} eliminato`
          : `${nome} non lavora più nel CRM`,
      {
        description:
          esito.avviso ??
          (esito.modo === "eliminato"
            ? "Scheda cancellata e accesso revocato."
            : "Accesso revocato e niente più lead. I suoi numeri restano col suo nome."),
        duration: esito.avviso ? 10000 : undefined,
      },
    );
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      bloccante
      larghezza="sm"
      icona={storia.haStoria ? Power : Trash2}
      titolo={storia.haStoria ? `Togli ${nome} dal CRM` : `Elimina ${nome}`}
      contesto={consulente.data?.email || "Nessuna email"}
      azioni={
        <>
          <Button
            variant="outline"
            onClick={() => onCambio(false)}
            disabled={inCorso}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            Annulla
          </Button>
          <Button
            onClick={conferma}
            disabled={inCorso}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {inCorso
              ? "Un momento…"
              : storia.haStoria
                ? soloChiavi
                  ? "Revoca l'accesso"
                  : "Spegni e revoca l'accesso"
                : "Elimina definitivamente"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/*  I NUMERI VERI, PRIMA DELLE PAROLE. Sono di sempre, non del periodo
            scelto in cima alla pagina: è quello che si perde, e il filtro delle
            date non c'entra con quello che esiste. */}
        <SezioneFinestra
          titolo="Che cosa ha alle spalle"
          nota="Tutto lo storico, non il periodo scelto"
          classeCorpo="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4"
        >
          <KpiFinestra etichetta="Lead" valore={storia.lead} forte />
          <KpiFinestra etichetta="Consulenze" valore={storia.consulenze} />
          <KpiFinestra etichetta="Clienti" valore={storia.clienti} />
          <KpiFinestra etichetta="Fatturato" valore={eur(storia.fatturato)} />
        </SezioneFinestra>

        {storia.haStoria ? (
          <NotaFinestra tono="attenzione" icona={TriangleAlert}>
            <strong>Non viene cancellata.</strong> I suoi {storia.lead} lead non si cancellano con
            lei: senza la sua scheda resterebbero in tabella sotto «Sconosciuto», per sempre e senza
            un nome da aprire.{" "}
            {soloChiavi
              ? "È già spenta: questo gesto le revoca l'accesso e lascia i suoi numeri dove sono."
              : "Viene quindi spenta: niente più lead nuovi, i suoi numeri restano leggibili col suo nome."}
          </NotaFinestra>
        ) : (
          <NotaFinestra tono="attenzione" icona={TriangleAlert}>
            <strong>Questa persona viene cancellata davvero, e non si torna indietro.</strong> Non
            risulta avere nessun lead assegnato, quindi non c&apos;è nessun numero che resti senza
            nome. Per rimetterla dentro andrà creata di nuovo, con un PIN nuovo.{" "}
            {/*  Questi quattro numeri vengono dai lead che la pagina ha in memoria,
                che può essere vecchia di un'ora. Prima di cancellare si richiede
                il conto al database: dirlo qui è quello che rende accettabile un
                tasto irreversibile appoggiato a una copia. */}
            <span className="opacity-80">
              Il conteggio viene ricontrollato sul database un attimo prima: se salta fuori anche un
              solo lead, invece di eliminarla la spengo e te lo dico.
            </span>
          </NotaFinestra>
        )}

        {/*  LE CHIAVI SI DICONO SEMPRE: è la parte che nessuno si aspetta, ed è
            anche la più importante — chiude il CRM e la videoconsulenza. */}
        <NotaFinestra icona={KeyRound}>
          {accessoAttivo === false
            ? "Non risulta avere un PIN attivo. L'accesso viene chiuso lo stesso, anche come presentatore in videoconsulenza."
            : "Il suo PIN viene revocato nello stesso gesto: non entrerà più né nel CRM né in videoconsulenza come presentatore."}
        </NotaFinestra>
      </div>
    </Finestra>
  );
}

/** Il numero dentro la riga. Non è <Kpi/> per una ragione di densità: qui ce ne
 *  stanno cinque per consulente e il riquadro grande farebbe scorrere la pagina
 *  per ogni persona. Bordi, raggi e tono restano quelli del linguaggio comune. */
function Numero({
  etichetta,
  valore,
  tono = "neutro",
  titolo,
  onClick,
}: {
  etichetta: string;
  valore: string | number;
  tono?: Tono;
  titolo?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titolo}
      className="min-w-0 rounded-lg border border-border bg-card px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
    >
      <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {etichetta}
      </span>
      <span
        className={cn(
          "block truncate text-[15px] font-semibold leading-tight tabular-nums",
          tono !== "neutro" && TESTO_TONO[tono],
        )}
      >
        {valore}
      </span>
    </button>
  );
}
