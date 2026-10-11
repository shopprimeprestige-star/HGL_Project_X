/** ── LA SCHEDA DEL CONSULENTE ──────────────────────────────────────────────
 *
 *  PERCHÉ UN PANNELLO E NON UN DIALOGO
 *  Qui dentro c'è tutto quello che riguarda una persona: chi è, come entra,
 *  quando lavora e quanto rende. Prima era spezzato in due finestre strette —
 *  una per i numeri, una per gli orari — più una striscia gialla nella riga
 *  dell'elenco per il PIN: tre posti per la stessa persona, e nessuno dei tre
 *  diceva se stesse lavorando bene. Adesso è un pannello laterale ampio, che si
 *  apre accanto all'elenco e sul telefono sale dal basso. Niente finestre dentro
 *  finestre: aprire un lead da qui CHIUDE il pannello e apre la scheda
 *  del cliente.
 *
 *  I NUMERI NON SI RICALCOLANO
 *  Vengono da `calcolaMetricheConsulenti` (kpi-calcoli.ts), gli stessi
 *  dell'elenco e del KPI manuale. Ogni numero è premibile e mostra le
 *  lead che lo compongono: una cifra che non si può verificare non viene
 *  usata per decidere niente.
 *
 *  IL PIN È UNA CREDENZIALE, E HA UNA SEZIONE SUA
 *  Si digita coperto, si scopre con un gesto esplicito, e non è più rileggibile
 *  dopo il salvataggio (il server non lo restituisce: vedi
 *  routes/api.crm.consulente-pin.ts). Vale in due posti — accesso al CRM e
 *  ingresso da presentatore nelle videoconsulenze — quindi assegnarne uno nuovo
 *  o revocarlo chiude entrambe le porte.
 *  «Accesso» è una sezione a sé e non una riga in fondo all'anagrafica: era
 *  sepolta lì, e infatti su tutta la squadra risultava un solo consulente con il
 *  PIN — gli altri semplicemente non entravano. Quando manca, la sua linguetta
 *  porta il punto ambra e la pagina ci arriva in un clic (`vistaIniziale`).
 *  Siccome il codice non si rilegge, subito dopo l'assegnazione resta a schermo
 *  una volta sola, con il tasto per copiarlo: è l'ultimo momento utile per
 *  consegnarlo.
 *
 *  IL MESTIERE ADESSO È ANCHE IL PERMESSO
 *  Le spunte «che lavoro fa» compaiono in DUE punti della scheda, e sono lo
 *  stesso dato:
 *   · in «Accesso → Che cosa può fare», perché lì decidono che cosa la persona
 *     potrà toccare — il permesso è l'unione di ciò che serve a ogni mestiere
 *     acceso, più ADMIN che apre tutto (crm/permessi.ts);
 *   · in «Anagrafica → Che mestiere fa», perché lì decidono come va MISURATA.
 *  Due copie della stessa domanda in due schermate sarebbero due risposte
 *  diverse: sono lo stesso `bozza`, si accendono di qua o di là indifferentemente
 *  e si salvano insieme.
 *  I numeri seguono gli stessi mestieri — due blocchi separati, e si vede solo
 *  quello dei mestieri che la persona fa davvero: un riquadro di zeri sulla
 *  scheda di chi non telefona è un giudizio, non un dato.
 *
 *  ⚠️ E FINCHÉ NESSUNO SALVA, NON CAMBIA NIENTE PER NESSUNO. Le persone che
 *  lavorano oggi hanno un livello e magari nessuna spunta: i loro permessi
 *  restano quelli del livello finché qualcuno non apre questa sezione e salva.
 *  È il momento in cui la scheda mostra, in chiaro e prima di scrivere, che cosa
 *  quella persona guadagna e che cosa perde.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  PhoneCall,
  Plus,
  ShieldCheck,
  Shuffle,
  Trash2,
  TriangleAlert,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCRM } from "@/crm/CRMContext";
import { intestazioniCRM, usePuo } from "@/crm/AuthContext";
import {
  calcolaMetricheConsulenti,
  type FiltroPeriodo,
  type MetricheConsulente,
} from "@/crm/kpi-calcoli";
import {
  GRUPPI_SETTER,
  calcolaMetricheSetter,
  conMestieri,
  etichettaMestieri,
  leadDelGruppoSetter,
  mestieriDi,
  type GruppoSetter,
  type Mestieri,
  type MestieriConsulente,
  type MetricheSetter,
} from "@/crm/kpi-setter";
import { NotaAttribuzioneSetter, NumeriSetter, SceltaMestieri } from "@/crm/kpi/setter-pezzi";
import { ConsultantFunnelKpiTab } from "@/crm/kpi/ConsultantFunnelKpiTab";
import { Chip, Kpi, KpiRiga, eur, useRicerca } from "@/crm/ui";
import {
  CLASSE_CAMPO,
  CampoFinestra,
  Foglio,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
  VuotoFinestra,
} from "@/crm/ui/Finestra";
import {
  ConfermaRimozione,
  ElencoLead,
  GRUPPI,
  leadDelGruppo,
  type GruppoNumero,
} from "@/crm/ConsultantsPerformance";
import {
  ETICHETTA_PERMESSO,
  ETICHETTA_RUOLO,
  INTERRUTTORI_FINI,
  NOME_MESTIERE,
  PERMESSI_MESTIERE,
  PERMESSI_RUOLO,
  RUOLO_MINIMO,
  TUTTI_I_PERMESSI,
  conDeroghe,
  daSalvare,
  mestieriAccesi,
  permessiDiPartenza,
  ruoloDaScritta,
  type Permesso,
  type RuoloCRM,
} from "@/crm/permessi";
import type {
  Consultant,
  ConsultantData,
  FasciaOraria,
  IndisponibilitaCustom,
  Lead,
} from "@/crm/types";
import { cn } from "@/lib/utils";

const GIORNI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

/** Livello ed elenco ridotti a una stringa confrontabile: l'elenco arriva dal
 *  server in un ordine che non è detto sia il nostro, e un confronto ingenuo
 *  direbbe «modificato» su una scheda che nessuno ha toccato. */
const firmaPermessi = (r: RuoloCRM, elenco: Permesso[]): string =>
  `${r}|${[...elenco].sort().join(",")}`;

/** Le spunte dei mestieri in una stringa. Serve a una domanda sola: le spunte a
 *  schermo sono già scritte in archivio, o c'è qualcosa da salvare? Senza,
 *  accendere un mestiere che non cambia nessun permesso (perché quel permesso
 *  arrivava già da una deroga) lascerebbe il pulsante spento e la spunta si
 *  perderebbe alla chiusura della scheda.
 *  ⚠️ Un mestiere nuovo si aggiunge IN CODA e non in mezzo: la firma serve solo a
 *  confrontare due letture della stessa scheda, ma infilare una cifra in mezzo
 *  rende illeggibile qualunque firma scritta a mano in un test o in un log. */
const firmaMestieri = (m: Mestieri): string =>
  `${+m.faSetter}${+m.faConsulente}${+m.faInstallatore}${+m.faAccompagnatore}${+m.faDriver}${+m.faManutentore}`;

/** Le sezioni della scheda. «Accesso» sta prima dell'anagrafica di proposito:
 *  un consulente senza PIN non entra da nessuna parte, e quindi è la prima cosa
 *  da sistemare, prima ancora del suo numero di telefono. */
export type VistaConsulente = "numeri" | "accesso" | "anagrafica" | "orari" | "funnel";

const VISTE: { v: VistaConsulente; t: string }[] = [
  { v: "numeri", t: "Numeri" },
  { v: "accesso", t: "Accesso" },
  { v: "anagrafica", t: "Anagrafica" },
  { v: "orari", t: "Orari" },
  { v: "funnel", t: "Funnel" },
];

interface Props {
  consulente: Consultant | null;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** Lo stesso periodo dell'elenco: due finestre temporali diverse nella stessa
   *  pagina sono il modo più rapido per far litigare due numeri. */
  dentro: FiltroPeriodo;
  etichettaPeriodo?: string;
  /** Il numero da cui si è arrivati: la scheda si apre già su quell'elenco. */
  gruppoIniziale?: GruppoNumero;
  /** Da dove si è entrati: premendo un numero si arriva sui Numeri, premendo
   *  «Assegna PIN» si arriva direttamente sull'Accesso, senza cercarlo. */
  vistaIniziale?: VistaConsulente;
  /** Avvisa la pagina che l'accesso di questo consulente è cambiato. */
  onAccessoCambiato?: (consulenteId: string, attivo: boolean) => void;
}

export function SchedaConsulente({
  consulente,
  aperta,
  onCambio,
  dentro,
  etichettaPeriodo,
  gruppoIniziale = "lead",
  vistaIniziale = "numeri",
  onAccessoCambiato,
}: Props) {
  const { leads, consultants, adSpending, updateConsultant } = useCRM();
  const ricerca = useRicerca();
  //  ── LA TERZA PORTA DELLO STESSO GESTO ────────────────────────────────────
  //   Questo pannello si apre oggi solo dalla pagina Consulenti, che il
  //   permesso `consulenti` ce l'ha già. Ma è la stessa azione distruttiva dei
  //   due cestini, e nasconderla lì e lasciarla qui vorrebbe dire che la regola
  //   vale solo finché nessuno apre questa scheda da un'altra schermata.
  //   Come là: è una cortesia, la difesa la fa il server alla revoca del PIN.
  const puoRimuovere = usePuo()("consulenti");

  const [vista, setVista] = useState<VistaConsulente>(vistaIniziale);
  const [gruppo, setGruppo] = useState<GruppoNumero>(gruppoIniziale);
  //  Il gruppo del setter è uno stato SUO: i due mestieri hanno elenchi
  //  diversi, e un solo stato condiviso farebbe cambiare l'elenco del telefono
  //  premendo un numero delle consulenze.
  const [gruppoSetter, setGruppoSetter] = useState<GruppoSetter>("fissati");
  const [bozza, setBozza] = useState<ConsultantData | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);
  //  La conferma di rimozione: è una finestra vera e non un `confirm()` del
  //  browser, perché deve mostrare NUMERI (quanti lead, quanto fatturato) e
  //  dire se sta spegnendo o cancellando.
  const [rimozioneAperta, setRimozioneAperta] = useState(false);

  // stato dell'accesso: il PIN non torna mai indietro, solo se c'è ed è attivo
  const [accesso, setAccesso] = useState<{ ha: boolean; attivo: boolean } | null>(null);
  const [pinNuovo, setPinNuovo] = useState("");
  const [mostraPin, setMostraPin] = useState(false);
  //  Il codice appena assegnato, tenuto a schermo una volta sola: dopo questo
  //  momento non lo rilegge più nessuno, nemmeno il CRM.
  const [consegnato, setConsegnato] = useState("");

  //  ── I PERMESSI, ACCANTO ALLA CHIAVE ────────────────────────────────────
  //  Chiavi e deroghe stanno nella stessa riga del PIN e si decidono nello
  //  stesso momento: separarli significherebbe assegnare il PIN oggi e i
  //  permessi mai. Il resto — cioè quasi tutto — viene dai MESTIERI, che stanno
  //  nella scheda della persona (`bozza`) e si accendono qui accanto.
  //
  //  Del LIVELLO resta in piedi una cosa sola: `admin`, le chiavi di casa. Gli
  //  altri due valori esistono ancora perché li dicono le righe vecchie, e
  //  finché una riga non viene salvata da qui sono ANCORA LORO a comandare —
  //  vedi `secondoMestieri`. Il ripiego è il livello più basso: una riga senza
  //  niente scritto vuol dire NO, non "tutto".
  const [ruolo, setRuolo] = useState<RuoloCRM>(RUOLO_MINIMO);
  //  ── LE DEROGHE, NON L'ELENCO ───────────────────────────────────────────
  //   Qui si tiene solo ciò che è stato deciso a mano CONTRO la base, e non
  //   l'elenco disteso dei permessi: la base cambia sotto i piedi ogni volta
  //   che si tocca un mestiere, e un elenco già disteso non saprebbe più quali
  //   delle sue voci erano una scelta di qualcuno e quali arrivavano dal
  //   mestiere che si è appena spento.
  const [deroghe, setDeroghe] = useState<Partial<Record<Permesso, boolean>>>({});
  //  Che cosa può fare ADESSO, secondo il server: serve a mostrare in chiaro il
  //  «prima e dopo» a chi sta per far passare questa persona ai mestieri.
  const [elencoInVigore, setElencoInVigore] = useState<Permesso[]>([]);
  //  Su questa persona comandano già i mestieri, o ancora il vecchio livello?
  //  Si parte da `true` per non far lampeggiare l'avviso del passaggio nel
  //  mezzo secondo in cui la risposta non è ancora arrivata.
  const [secondoMestieri, setSecondoMestieri] = useState(true);
  //  Il livello era scritto nella riga, o è il ripiego? Serve a dirlo in
  //  chiaro: «setter» perché qualcuno l'ha scelto e «setter» perché non c'era
  //  niente si vedono identici, e solo il secondo va guardato con sospetto.
  const [ruoloDichiarato, setRuoloDichiarato] = useState(true);
  //  Quello che c'è scritto adesso nel database, per sapere se è cambiato
  //  qualcosa senza dover confrontare due elenchi disordinati a mano.
  const [permessiSalvati, setPermessiSalvati] = useState("");
  const [salvaPermessiInCorso, setSalvaPermessiInCorso] = useState(false);

  //  Le dipendenze guardano l'ID, non l'oggetto: salvando, il consulente
  //  cambia identità e questo effetto rimetterebbe la vista su "Numeri"
  //  buttando fuori chi stava lavorando negli orari.
  const idConsulente = consulente?.id;
  const datiConsulente = consulente?.data;
  useEffect(() => {
    if (!aperta || !idConsulente || !datiConsulente) return;
    setBozza({ ...datiConsulente });
    setVista(vistaIniziale);
    setGruppo(gruppoIniziale);
    setPinNuovo("");
    setMostraPin(false);
    setConsegnato("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperta, idConsulente, gruppoIniziale, vistaIniziale]);

  useEffect(() => {
    //  Si azzera SEMPRE prima di chiedere: passando da un consulente all'altro,
    //  tenere il vecchio stato mentre arriva il nuovo vuol dire mostrare
    //  «Accesso attivo» sulla scheda di chi non ce l'ha.
    setAccesso(null);
    //  Anche i permessi tornano al meno potente prima di chiedere: tenere quelli
    //  del consulente precedente mentre arriva la risposta vuol dire mostrare
    //  «Admin» sulla scheda di chi admin non è, e magari salvarcelo sopra.
    setRuolo(RUOLO_MINIMO);
    setDeroghe({});
    setElencoInVigore([]);
    setSecondoMestieri(true);
    setRuoloDichiarato(true);
    setPermessiSalvati("");
    if (!aperta || !idConsulente) return;
    let vivo = true;
    //  Le credenziali servono: da quando la rotta controlla il permesso
    //  «consulenti», una chiamata senza intestazioni riceve 401 e la scheda
    //  resterebbe per sempre su «Accesso sconosciuto».
    intestazioniCRM()
      .then((h) => fetch(`/api/crm/consulente-pin?consultantId=${idConsulente}`, { headers: h }))
      .then((r) => r.json())
      .then((r) => {
        if (!vivo || !r?.ok) return;
        setAccesso({ ha: !!r.ha, attivo: !!r.attivo });
        //  Il server manda il livello e l'elenco GIÀ RISOLTO (livello +
        //  deroghe): qui non si rifà quel conto, o esisterebbero due tabelle di
        //  regole da tenere allineate. Se la risposta è di una versione vecchia
        //  e non li contiene, resta il ripiego meno potente.
        const r2 = r as {
          ruolo?: unknown;
          concessi?: unknown;
          dichiarato?: unknown;
          extra?: unknown;
          secondoMestieri?: unknown;
        };
        //  I nomi vecchi si traducono anche qui: la risposta può arrivare da un
        //  worker non ancora aggiornato, e un "titolare" non riconosciuto
        //  diventerebbe il ripiego — cioè mostrerebbe SETTER sulla scheda di chi
        //  ha le chiavi, pronto a essere salvato sopra al primo tocco.
        const liv = ruoloDaScritta(r2.ruolo) ?? RUOLO_MINIMO;
        //  ELENCO ASSENTE O VUOTO ≠ «NIENTE DI NIENTE». Il server manda sempre
        //  almeno `lead.propri`: un elenco vuoto è una risposta a cui non
        //  crediamo, e trattarla come «nessun permesso» disegnerebbe tutti gli
        //  interruttori spenti anche sulla scheda di un admin — e li
        //  salverebbe così.
        const arrivati = Array.isArray(r2.concessi) ? (r2.concessi as Permesso[]) : [];
        const el = arrivati.length ? arrivati : PERMESSI_RUOLO[liv];
        //  ── LE DEROGHE SI RIPRENDONO COM'ERANO ─────────────────────────────
        //   Arrivano dal server già ripulite, e si rimettono tali e quali: sono
        //   le sole decisioni prese a mano, e ricavarle dalla differenza fra
        //   elenco e base le perderebbe tutte le volte che base e deroga dicono
        //   la stessa cosa — cioè un permesso tolto a mano tornerebbe acceso da
        //   solo alla prima riapertura della scheda.
        //   Una risposta vecchia che non le manda vale «nessuna deroga», che è
        //   com'era prima che esistessero.
        const deroghePulite: Partial<Record<Permesso, boolean>> = {};
        const grezzo = (r2.extra ?? {}) as Record<string, unknown>;
        for (const k of Object.keys(grezzo) as Permesso[]) {
          if (typeof grezzo[k] === "boolean") deroghePulite[k] = grezzo[k] as boolean;
        }
        setRuolo(liv);
        setDeroghe(deroghePulite);
        setElencoInVigore(el);
        setSecondoMestieri(r2.secondoMestieri === true);
        setRuoloDichiarato(r2.dichiarato !== false);
        setPermessiSalvati(firmaPermessi(liv, el));
      })
      .catch(() => {
        /* l'accesso resta sconosciuto: meglio non dire nulla che dire il falso */
      });
    return () => {
      vivo = false;
    };
  }, [aperta, idConsulente]);

  const metrica = useMemo(() => {
    if (!consulente) return null;
    return (
      calcolaMetricheConsulenti(leads, consultants, adSpending, dentro).find(
        (r) => r.id === consulente.id,
      ) ?? null
    );
  }, [leads, consultants, adSpending, dentro, consulente]);

  const elenco = useMemo(
    () => (consulente ? leadDelGruppo(leads, consulente.id, gruppo, dentro) : []),
    [leads, consulente, gruppo, dentro],
  );

  //  ⚠️ TUTTI GLI HOOK SOPRA IL RETURN ANTICIPATO che sta poche righe più giù:
  //  calcolarli dentro il ramo «fa il setter» li farebbe comparire e sparire a
  //  ogni cambio di persona, che è il modo classico di rompere React.
  //  La metrica arriva da `consultants` (i dati SALVATI), non dalla bozza:
  //  accendere l'interruttore senza salvare non inventa numeri, e la sezione lo
  //  dice invece di mostrare zeri.
  const metricaSetter = useMemo<MetricheSetter | null>(() => {
    if (!consulente) return null;
    return (
      calcolaMetricheSetter(leads, consultants, dentro).find((r) => r.id === consulente.id) ?? null
    );
  }, [leads, consultants, dentro, consulente]);

  const elencoSetter = useMemo(
    () => (consulente ? leadDelGruppoSetter(leads, consulente.id, gruppoSetter, dentro) : []),
    [leads, consulente, gruppoSetter, dentro],
  );

  const modificato = useMemo(
    () => !!bozza && !!consulente && JSON.stringify(bozza) !== JSON.stringify(consulente.data),
    [bozza, consulente],
  );

  if (!consulente || !bozza) return null;

  const cambia = <K extends keyof ConsultantData>(k: K, v: ConsultantData[K]) =>
    setBozza((d) => (d ? { ...d, [k]: v } : d));

  //  I mestieri della BOZZA: l'interruttore deve rispondere subito, altrimenti
  //  sembra rotto. I numeri invece restano quelli dei dati salvati (vedi
  //  `metricaSetter`), così non si vedono percentuali di un mestiere che non è
  //  ancora stato scritto da nessuna parte.
  const mestieri = mestieriDi(bozza);

  //  ── CHE COSA POTRÀ FARE, CALCOLATO QUI E ADESSO ─────────────────────────
  //   Base (i mestieri accesi, o tutto se è admin) più le deroghe, con la
  //   STESSA funzione che userà il server quando rileggerà la riga: la scheda
  //   non ha una sua idea dei permessi, mostra in anticipo quello che verrà
  //   deciso. Si passano sempre i mestieri della bozza, anche su una riga che
  //   segue ancora il vecchio livello, perché è questo che quella persona avrà
  //   appena si salva — ed è esattamente ciò che l'avviso del passaggio
  //   confronta con quello che ha oggi.
  const basePermessi = permessiDiPartenza(ruolo, mestieri);
  const concessi = conDeroghe(basePermessi, deroghe);
  const mestieriSalvati = mestieriDi(consulente.data);
  const mestieriModificati = firmaMestieri(mestieri) !== firmaMestieri(mestieriSalvati);

  /** ⚠️ NON PASSA DA `cambia`: i due campi non stanno (ancora) in
   *  `ConsultantData`, e un letterale con una proprietà in più verrebbe
   *  rifiutato da TypeScript. `conMestieri` è la variabile tipizzata che li
   *  aggiunge — stesso schema di `payment.incassoSaldo`. */
  const cambiaMestiere = (patch: MestieriConsulente) =>
    setBozza((d) => (d ? conMestieri(d, patch) : d));

  const chiudi = (v: boolean) => {
    //  Una scheda chiusa per sbaglio con le modifiche dentro è lavoro perso e
    //  non c'è modo di accorgersene dopo: si chiede prima.
    if (!v && modificato && !confirm("Ci sono modifiche non salvate. Chiudere lo stesso?")) return;
    onCambio(v);
  };

  const salva = async () => {
    setSalvataggio(true);
    //  ⚠️ try/finally, non due righe in fila: se il salvataggio fallisce a metà
    //  — rete caduta, sessione scaduta — senza il finally lo stato «sto
    //  salvando» resta acceso per sempre e il pulsante non si riaccende più.
    //  Da lì in poi la scheda sembra rotta e l'unico rimedio è ricaricare la
    //  pagina, buttando via ciò che si era scritto.
    try {
      await updateConsultant(consulente.id, bozza);
      toast.success("Scheda aggiornata", { description: bozza.nome });
    } catch (e) {
      console.error(e);
      toast.error("Scheda NON salvata", {
        description: e instanceof Error ? e.message : "Riprova fra un momento.",
      });
    } finally {
      setSalvataggio(false);
    }
  };

  const apriIlLead = (leadId: string) => {
    //  Niente finestre dentro finestre: il pannello si toglie di mezzo e resta
    //  solo la scheda del cliente.
    onCambio(false);
    ricerca.apriLead(leadId);
  };

  /** ── LE SPUNTE VANNO SCRITTE PRIMA DEI PERMESSI, SEMPRE ─────────────────
   *  Da quando i permessi si calcolano dai mestieri, salvare la riga del PIN
   *  con il segno del passaggio mentre le spunte sono ancora solo a schermo
   *  vorrebbe dire consegnare a quella persona i permessi di mestieri che nel
   *  database non ci sono. Quindi prima la scheda, poi la riga — e se la prima
   *  non riesce, la seconda non parte affatto.
   *  Si scrive anche quando a occhio non è cambiato niente: `conMestieri` mette
   *  nero su bianco tutte e cinque le spunte, comprese quelle che finora erano
   *  soltanto un valore di partenza mai scritto. Da lì in avanti quella persona
   *  ha dei mestieri SCELTI, non ereditati da un ripiego che un domani potrebbe
   *  cambiare. */
  const scriviMestieri = async (): Promise<boolean> => {
    try {
      await updateConsultant(consulente.id, conMestieri(bozza, mestieri));
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Mestieri NON salvati: i permessi non sono stati toccati", {
        description: e instanceof Error ? e.message : "Riprova fra un momento.",
      });
      return false;
    }
  };

  /** ── PIN ────────────────────────────────────────────────────────────────
   *  Da 4 a 8 cifre: si detta al telefono e si digita davanti al cliente. */
  const salvaPin = async () => {
    if (!(await scriviMestieri())) return;
    const r = await fetch("/api/crm/consulente-pin", {
      method: "POST",
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      //  I permessi viaggiano insieme al PIN: alla prima attivazione è l'unico
      //  momento in cui vengono decisi, e senza mandarli un consulente nuovo
      //  nascerebbe con la riga dei permessi vuota.
      body: JSON.stringify({
        consultantId: consulente.id,
        pin: pinNuovo,
        nome: bozza.nome,
        ...daSalvare(ruolo, mestieri, concessi),
      }),
    })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) {
      toast.error(r?.reason || "PIN non salvato");
      return;
    }
    setAccesso({ ha: true, attivo: true });
    //  Prima di svuotare il campo il codice si sposta nel riquadro di consegna:
    //  da adesso in poi non è più rileggibile da nessuna schermata, e chiudere
    //  la scheda senza averlo dettato significa doverne assegnare un altro.
    setConsegnato(pinNuovo);
    setPinNuovo("");
    setMostraPin(false);
    onAccessoCambiato?.(consulente.id, true);
    toast.success(`Accesso attivo per ${bozza.nome}`, {
      description:
        "Vale per il CRM e per le videoconsulenze. Il codice precedente non funziona più.",
    });
  };

  /** ── SALVA MESTIERI E PERMESSI INSIEME, SENZA TOCCARE IL PIN ───────────
   *  Un gesto solo perché è una decisione sola: «questa persona fa questi
   *  mestieri, quindi può fare queste cose». Erano due salvataggi in due
   *  linguette diverse, ed era il modo più semplice per accendere una spunta e
   *  non accorgersi che i permessi erano rimasti indietro.
   *
   *  Si manda il segno del passaggio e le SOLE deroghe che si discostano dai
   *  mestieri (`daSalvare`): salvare l'elenco disteso congelerebbe dentro la
   *  riga i permessi di oggi, e il giorno in cui un mestiere cambia contenuto
   *  non cambierebbe per nessuno.
   *
   *  Il 409 non è un guasto: è il server che rifiuta di lasciare il CRM senza
   *  nessuno che possa assegnare permessi. Va letto e mostrato com'è. */
  const salvaPermessi = async () => {
    setSalvaPermessiInCorso(true);
    if (!(await scriviMestieri())) {
      setSalvaPermessiInCorso(false);
      return;
    }
    const r = await fetch("/api/crm/consulente-pin", {
      method: "POST",
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        consultantId: consulente.id,
        ...daSalvare(ruolo, mestieri, concessi),
      }),
    })
      .then((x) => x.json())
      .catch(() => null);
    setSalvaPermessiInCorso(false);
    if (!r?.ok) {
      toast.error(r?.reason || "Permessi non salvati");
      return;
    }
    setPermessiSalvati(firmaPermessi(ruolo, concessi));
    setElencoInVigore(concessi);
    //  Da adesso su questa persona comandano i mestieri: l'avviso del passaggio
    //  sparisce, e sparisce perché è successo davvero.
    setSecondoMestieri(true);
    setRuoloDichiarato(true);
    const cose = concessi.map((p) => ETICHETTA_PERMESSO[p].toLowerCase());
    toast.success(`Permessi aggiornati per ${bozza.nome}`, {
      description: `Adesso può: ${cose.join(", ")}. Vale subito, anche se sta già lavorando: il suo menu si riallinea entro un minuto.`,
    });
  };

  /** ── LE CHIAVI DI CASA ───────────────────────────────────────────────────
   *  L'unica cosa che NON passa dai mestieri, e per due ragioni: perché è la
   *  cassaforte (listino, archivio, PIN e permessi di tutti, compresi i propri)
   *  e perché i mestieri li scrive il browser nella scheda della persona,
   *  mentre questo passa dalla rotta guardata. Un mestiere non deve poter
   *  consegnare le chiavi — è scritto anche in crm/permessi.ts.
   *
   *  Si chiede conferma prima di darle: non è irreversibile — si torna indietro
   *  da questo stesso interruttore — ma va detto prima, non scoperto dopo.
   *  ⚠️ Togliersele da soli quando non resta nessun altro admin è l'unica mossa
   *  senza ritorno, e infatti non la decide questa schermata: il server la
   *  rifiuta con il motivo scritto per esteso, e qui si legge. */
  const cambiaAdmin = (v: boolean) => {
    if (v) {
      if (
        !confirm(
          `Dare a ${bozza.nome || "questa persona"} le chiavi di casa (ADMIN)?\n\n` +
            "Vedrà e potrà modificare tutto, come te: archivio dei lead, listino e sconti, " +
            "spesa pubblicitaria e margini, PIN e permessi di tutti — compreso il tuo.\n\n" +
            "Si può togliere in qualsiasi momento da questo stesso interruttore.",
        )
      )
        return;
      setRuolo("admin");
    } else {
      //  Si scende al livello più basso, non al «consulente»: da qui in poi
      //  quello che questa persona può fare lo dicono i suoi mestieri, e un
      //  livello di mezzo lasciato scritto sarebbe una seconda risposta alla
      //  stessa domanda — pronta a saltare fuori dove i mestieri non arrivano.
      setRuolo(RUOLO_MINIMO);
    }
    setRuoloDichiarato(true);
  };

  /** Una deroga si SCRIVE solo se dice qualcosa di diverso dalla base: se
   *  coincide si toglie di mezzo, altrimenti resterebbe attaccata alla riga a
   *  ripetere ciò che il mestiere già dice — e domani, cambiato il mestiere,
   *  continuerebbe a dirlo da sola. */
  const cambiaPermesso = (p: Permesso, acceso: boolean) =>
    setDeroghe((d) => {
      const fuori = { ...d };
      if (acceso === basePermessi.includes(p)) delete fuori[p];
      else fuori[p] = acceso;
      return fuori;
    });

  const copiaConsegnato = () => {
    if (!consegnato) return;
    void navigator.clipboard
      .writeText(consegnato)
      .then(() =>
        toast.success("PIN copiato", { description: "Incollalo nel messaggio per il consulente." }),
      )
      .catch(() => toast.error("Copia non riuscita: leggilo e scrivilo a mano."));
  };

  const revocaPin = async () => {
    if (
      !confirm(
        `Revocare l'accesso di ${bozza.nome}? Non entrerà più né nel CRM né in videoconsulenza.`,
      )
    )
      return;
    const r = await fetch("/api/crm/consulente-pin", {
      method: "POST",
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      body: JSON.stringify({ consultantId: consulente.id, revoca: true }),
    })
      .then((x) => x.json())
      .catch(() => null);
    if (!r?.ok) {
      //  Il motivo lo scrive il server, e in un caso conta parecchio: revocare
      //  l'ultimo accesso che sa assegnare permessi viene rifiutato apposta.
      toast.error(r?.reason || "Accesso non revocato");
      return;
    }
    setAccesso({ ha: true, attivo: false });
    setConsegnato("");
    onAccessoCambiato?.(consulente.id, false);
    toast.success("Accesso revocato");
  };

  const proponiPin = () => {
    //  Un codice proposto è quasi sempre migliore di quello che si sceglierebbe
    //  al volo (1234, l'anno di nascita). Resta modificabile.
    const n = new Uint32Array(1);
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(n);
    else n[0] = Math.floor(Math.random() * 1e6);
    setPinNuovo(String(1000 + (n[0] % 9000)));
    setMostraPin(true);
  };

  //  ── TOGLIERE QUALCUNO SI FA IN UN POSTO SOLO ─────────────────────────────
  //   Qui c'era un `confirm()` che diceva una cosa sbagliata («i suoi lead
  //   restano, ma senza consulente»: in realtà restano attaccati a un id che
  //   non esiste più e finiscono sotto «Sconosciuto») e che cancellava senza
  //   revocare l'accesso da presentatore. Adesso apre la STESSA conferma
  //   dell'elenco — con i numeri veri di questa persona — e passa dalla stessa
  //   funzione: una regola sola, in un posto solo.

  const statoAccesso = !accesso
    ? { testo: "Accesso sconosciuto", tono: "neutro" as const }
    : accesso.attivo
      ? { testo: "Accesso attivo", tono: "vinta" as const }
      : accesso.ha
        ? { testo: "Accesso revocato", tono: "in_sospeso" as const }
        : { testo: "Senza accesso", tono: "in_sospeso" as const };

  //  Solo quando la risposta è arrivata davvero: finché l'accesso è sconosciuto
  //  un punto ambra sulla linguetta sarebbe un allarme inventato.
  const senzaAccesso = !!accesso && !accesso.attivo;

  //  Una riga sola con le tre cose che cambiano il senso di tutto il resto: se
  //  lavora, se riesce a entrare, e su che periodo sono i numeri qui sotto.
  const contestoTestata = [
    bozza.attivo ? "Attivo" : "Spento",
    //  Il mestiere sta in testata perché decide che numeri si vedono qui sotto:
    //  senza, due schede identiche con blocchi diversi sembrano un guasto.
    etichettaMestieri(mestieri).toLowerCase(),
    accesso ? (accesso.attivo ? "entra nel CRM" : "non entra: manca il PIN") : null,
    etichettaPeriodo ? `numeri ${etichettaPeriodo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Foglio
      aperto={aperta}
      onCambio={chiudi}
      titolo={bozza.nome || "Consulente"}
      contesto={contestoTestata}
      icona={BarChart3}
      larghezza="lg"
      classeCorpo="space-y-3"
      azioni={
        <>
          {/*  ── UN PULSANTE SPENTO DEVE DIRE PERCHÉ ──────────────────────────
              «Salva modifiche» spento e senza spiegazione si legge come un
              guasto: si riprova, si ricarica, si chiude la scheda perdendo
              quello che si era scritto. Le ragioni sono due e sono opposte —
              non c'è niente da salvare, oppure il salvataggio è in corso — e
              vanno dette, perché la prima significa «hai già finito» e la
              seconda «aspetta un attimo».
              ⚠️ Livello, permessi e PIN NON passano da qui: hanno il loro
              salvataggio nella sezione Accesso. Cambiarli lascia questo tasto
              spento, ed è corretto — ma senza dirlo sembra che non abbiano
              funzionato. */}
          <span className="mr-auto text-[11px] text-muted-foreground">
            {salvataggio ? (
              <span className="text-amber-700">Salvataggio in corso…</span>
            ) : modificato ? (
              <span className="text-amber-700">Modifiche non salvate</span>
            ) : (
              "Nessuna modifica da salvare · livello, permessi e PIN si salvano in «Accesso»"
            )}
          </span>
          <Button
            variant="outline"
            onClick={() => chiudi(false)}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            Chiudi
          </Button>
          <Button onClick={salva} disabled={!modificato || salvataggio}>
            Salva modifiche
          </Button>
        </>
      }
    >
      {/* ── ACCESO O SPENTO: si vede sempre, in qualunque sezione ─────────── */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
          bozza.attivo ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50",
        )}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">
            {bozza.attivo ? "Consulente attivo" : "Consulente spento"}
          </p>
          <p className="text-[11px] leading-snug text-slate-600">
            {bozza.attivo
              ? "Riceve nuovi lead e compare fra gli assegnatari."
              : "Non riceve più lead. Resta nell'elenco con i suoi numeri: quello che ha chiuso resta suo."}
          </p>
        </div>
        <Switch checked={bozza.attivo} onCheckedChange={(v) => cambia("attivo", v)} />
      </div>

      {/* ── LE SEZIONI ────────────────────────────────────────────────────
          Il punto ambra su «Accesso» è l'unico colore di questa fila: dice che
          lì dentro manca un passaggio, senza costringere ad aprire ogni scheda
          per scoprire chi è rimasto fuori. */}
      <div className="flex flex-wrap gap-1.5">
        {VISTE.map((x) => (
          <Pillola
            key={x.v}
            attiva={vista === x.v}
            onClick={() => setVista(x.v)}
            titolo={
              x.v === "accesso" && senzaAccesso ? "Manca il PIN: non entra nel CRM" : undefined
            }
          >
            {x.v === "accesso" && senzaAccesso && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
            )}
            {x.t}
          </Pillola>
        ))}
      </div>

      {/* ── I NUMERI, UN BLOCCO PER MESTIERE ───────────────────────────────
          Ordine del lavoro, non dell'importanza: prima il telefono (che
          produce l'appuntamento), poi la consulenza (che produce il cliente).
          Si mostra SOLO il mestiere che la persona fa: riquadri di zeri per
          chi non telefona sono un giudizio travestito da dato. */}
      {vista === "numeri" && (
        <>
          {!mestieri.faSetter && !mestieri.faConsulente && (
            <NotaFinestra tono="attenzione" icona={TriangleAlert}>
              Non è segnato nessun mestiere per {bozza.nome || "questa persona"}: senza, non si sa
              su quali numeri vada misurata e non compare in nessun confronto. Si sceglie in{" "}
              <strong>Anagrafica → Che mestiere fa</strong>, e si possono accendere tutti e due.
            </NotaFinestra>
          )}

          {mestieri.faSetter && (
            <SezioneNumeriSetter
              nome={bozza.nome}
              metrica={metricaSetter}
              gruppo={gruppoSetter}
              onGruppo={setGruppoSetter}
              elenco={elencoSetter}
              onApriLead={apriIlLead}
              etichettaPeriodo={etichettaPeriodo}
            />
          )}

          {mestieri.faConsulente && (
            <>
              {mestieri.faSetter && (
                <TitoloMestiere
                  icona={Video}
                  titolo="Come consulente"
                  nota="Chi svolge le videoconsulenze. Si misura sulla chiusura: quante consulenze diventano clienti."
                />
              )}
              <SezioneNumeri
                metrica={metrica}
                gruppo={gruppo}
                onGruppo={setGruppo}
                elenco={elenco}
                onApriLead={apriIlLead}
                etichettaPeriodo={etichettaPeriodo}
              />
            </>
          )}
        </>
      )}

      {vista === "accesso" && (
        <>
          <SezionePin
            nome={bozza.nome}
            stato={statoAccesso}
            pin={pinNuovo}
            onPin={setPinNuovo}
            mostra={mostraPin}
            onMostra={setMostraPin}
            onSalva={salvaPin}
            onRevoca={revocaPin}
            onProponi={proponiPin}
            revocabile={!!accesso?.attivo}
            consegnato={consegnato}
            onCopiaConsegnato={copiaConsegnato}
            onFineConsegna={() => setConsegnato("")}
          />

          <SezionePermessi
            nome={bozza.nome}
            ruolo={ruolo}
            mestieri={mestieri}
            onMestiere={cambiaMestiere}
            base={basePermessi}
            concessi={concessi}
            deroghe={deroghe}
            inVigore={elencoInVigore}
            secondoMestieri={secondoMestieri}
            dichiarato={ruoloDichiarato}
            onAdmin={cambiaAdmin}
            onPermesso={cambiaPermesso}
            onSalva={salvaPermessi}
            salvando={salvaPermessiInCorso}
            //  Tre cose sono «da salvare», e la terza non si vede nell'elenco
            //  dei permessi: una spunta di mestiere che non cambia nessun
            //  permesso (perché quel permesso arrivava già da una deroga) va
            //  comunque scritta, o si perde chiudendo la scheda.
            modificato={
              !secondoMestieri ||
              mestieriModificati ||
              firmaPermessi(ruolo, concessi) !== permessiSalvati
            }
            //  Senza PIN non c'è riga su cui scrivere i permessi: il server
            //  rifiuterebbe. Si sceglie lo stesso il livello — verrà salvato
            //  insieme al codice, nello stesso gesto.
            senzaPin={!accesso?.ha}
          />

          <SezioneFinestra titolo="Cosa apre questo codice" classeCorpo="p-4 space-y-2">
            <NotaFinestra icona={KeyRound}>
              <strong>Il CRM.</strong> Entra dalla schermata di accesso con il PIN e vede i suoi
              lead, la sua agenda e i suoi appuntamenti.
            </NotaFinestra>
            <NotaFinestra icona={Video}>
              <strong>Le videoconsulenze.</strong> Lo stesso codice lo fa entrare come presentatore
              nella stanza del cliente: una persona sola, una credenziale sola.
            </NotaFinestra>
            {!bozza.attivo && (
              <NotaFinestra tono="attenzione" icona={TriangleAlert}>
                Il consulente è spento: anche con il PIN attivo non riceverà nuovi lead. Riaccendilo
                dall&apos;interruttore qui sopra.
              </NotaFinestra>
            )}
          </SezioneFinestra>
        </>
      )}

      {vista === "anagrafica" && (
        <>
          <SezioneFinestra titolo="Chi è" classeCorpo="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoFinestra etichetta="Nome">
                <Input
                  value={bozza.nome}
                  onChange={(e) => cambia("nome", e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Email">
                <Input
                  value={bozza.email || ""}
                  onChange={(e) => cambia("email", e.target.value)}
                  placeholder="nome@studio.it"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Telefono">
                <Input
                  value={bozza.telefono || ""}
                  onChange={(e) => cambia("telefono", e.target.value)}
                  placeholder="333 1234567"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra
                etichetta="Max consulenze al giorno"
                nota="Raggiunto il tetto, l'assegnazione automatica passa al collega."
              >
                <Input
                  type="number"
                  min={0}
                  value={bozza.maxCallGiorno ?? 0}
                  onChange={(e) => cambia("maxCallGiorno", Number(e.target.value))}
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra
                etichetta="Priorità"
                nota="A pari carico di giornata tocca prima al numero più basso."
              >
                <Input
                  type="number"
                  min={1}
                  value={bozza.priorita ?? 1}
                  onChange={(e) => cambia("priorita", Number(e.target.value))}
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
            </div>
          </SezioneFinestra>

          {/* ── CHE MESTIERE FA ─────────────────────────────────────────────
              Le STESSE spunte che stanno in «Accesso → Che cosa può fare», e lo
              stesso `bozza`: si accendono di qua o di là indifferentemente.
              Compaiono in due posti perché rispondono a due domande che si fanno
              in due momenti diversi — «come va misurata» mentre si guarda una
              classifica, «che cosa può toccare» mentre si consegna un PIN — e
              mandare a cercare l'altra linguetta è il modo in cui una delle due
              resta non compilata.
              ⚠️ Da qui i permessi si SALVANO col tasto «Salva modifiche» in
              fondo alla scheda insieme a tutto il resto; il passaggio ai
              mestieri di chi segue ancora il vecchio livello si fa invece da
              «Accesso», dove si vede prima che cosa cambia. */}
          <SezioneFinestra
            titolo="Che mestiere fa"
            nota="Decide su quali numeri viene misurata, cosa le si può far fare su una posa (eseguirla, affiancare chi la esegue, portarci qualcuno) o su un ritorno per la manutenzione, e CHE COSA PUÒ TOCCARE nel CRM: il permesso è l'unione di quello che serve a ogni mestiere acceso. L'elenco per esteso è in «Accesso → Che cosa può fare»."
            classeCorpo="p-4 space-y-3"
          >
            <SceltaMestieri
              faSetter={mestieri.faSetter}
              faConsulente={mestieri.faConsulente}
              faDriver={mestieri.faDriver}
              faInstallatore={mestieri.faInstallatore}
              faAccompagnatore={mestieri.faAccompagnatore}
              faManutentore={mestieri.faManutentore}
              onCambio={cambiaMestiere}
            />

            {!mestieri.faSetter && !mestieri.faConsulente && (
              <NotaFinestra tono="attenzione" icona={TriangleAlert}>
                Con setter e consulente spenti {bozza.nome || "questa persona"} non compare in
                nessun confronto: i suoi lead restano nel CRM, ma non finiscono in nessuna
                classifica.{" "}
                {mestieri.faInstallatore ||
                mestieri.faAccompagnatore ||
                mestieri.faDriver ||
                mestieri.faManutentore
                  ? "Continua però a comparire dove si programmano le pose e i ritorni — installatore, accompagnatore, driver e manutentore non sono numeri, sono lavoro sul campo."
                  : ""}
              </NotaFinestra>
            )}

            {!mestieri.dichiarato && (
              <NotaFinestra>
                Nessuno ha ancora scelto: quello che si vede è il valore di partenza —{" "}
                <strong>consulente sì, setter no</strong> — ed è l&apos;unico che lascia i numeri di
                oggi esattamente come erano. Basta salvare per renderlo una scelta.
              </NotaFinestra>
            )}

            <NotaFinestra>
              Si possono accendere <strong>tutti</strong>: chi telefona la mattina e fa consulenze
              il pomeriggio ha due serie di numeri separate, una per mestiere, e può andare a posare
              lo stesso — installatore, accompagnatore, driver e manutentore non toccano nessun
              numero, dicono solo chi si può mandare a eseguire una posa, chi ad affiancarlo sul
              posto, chi a portarcelo e chi a fare i ritorni per la manutenzione. E{" "}
              <strong>i permessi seguono queste stesse spunte</strong>: quello che questa persona
              potrà toccare è la somma di ciò che serve a ogni mestiere acceso. Le chiavi di casa
              (ADMIN) sono l&apos;unica cosa che non passa di qui: stanno in «Accesso → Che cosa può
              fare», insieme all&apos;elenco per esteso.
            </NotaFinestra>
          </SezioneFinestra>

          <SezioneFinestra titolo="Calendario esterno" classeCorpo="p-4 space-y-2">
            <NotaFinestra icona={CalendarDays}>
              Non serve più collegare Google: appuntamenti, link della consulenza e disponibilità li
              gestisce la piattaforma. Dipendere da un calendario esterno significava che, con
              un&apos;autorizzazione scaduta, l&apos;appuntamento restava senza link.
            </NotaFinestra>
            {consulente.data.calendarioCollegato && (
              <p className="text-[11px] text-slate-500">
                Collegamento storico ancora presente: {consulente.data.googleEmail || "—"}
              </p>
            )}
          </SezioneFinestra>

          {puoRimuovere && (
            <SezioneFinestra titolo="Toglilo dal CRM" classeCorpo="p-4 space-y-2">
              <NotaFinestra tono="attenzione" icona={TriangleAlert}>
                I suoi lead non si cancellano con lui e restano attaccati al suo nome: per questo,
                se ha già lavorato, questo gesto lo SPEGNE invece di cancellarlo. In tutti e due i
                casi il PIN viene revocato — niente più CRM e niente più videoconsulenza. La
                finestra che si apre dice quale delle due cose sta per succedere.
              </NotaFinestra>
              <Button
                variant="outline"
                onClick={() => setRimozioneAperta(true)}
                className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" /> Togli dal CRM
              </Button>
            </SezioneFinestra>
          )}
        </>
      )}

      {vista === "orari" && <SezioneOrari bozza={bozza} cambia={cambia} />}

      {vista === "funnel" && <ConsultantFunnelKpiTab consultantId={consulente.id} />}

      {/*  La stessa conferma dell'elenco, con gli stessi numeri e le stesse
          parole. Riuscita, chiude anche questo pannello: la persona che si
          stava guardando non è più quella di prima. */}
      <ConfermaRimozione
        consulente={consulente}
        aperta={rimozioneAperta}
        onCambio={setRimozioneAperta}
        accessoAttivo={accesso?.attivo}
        onFatto={() => {
          onAccessoCambiato?.(consulente.id, false);
          onCambio(false);
        }}
      />
    </Foglio>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I MESTIERI
   ═════════════════════════════════════════════════════════════════════════ */

/** L'intestazione di un blocco di numeri. Non è una <SezioneFinestra> perché
 *  sotto ci sono già dei riquadri con il loro bordo: un riquadro dentro un
 *  riquadro dentro un pannello fa tre cornici per un titolo di due parole. */
function TitoloMestiere({
  icona: Icona,
  titolo,
  nota,
}: {
  icona: ComponentType<{ className?: string }>;
  titolo: string;
  nota: string;
}) {
  return (
    <div className="flex items-start gap-2 px-0.5 pt-1">
      <Icona className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-tight text-slate-900">{titolo}</p>
        <p className="text-[11.5px] leading-snug text-slate-500">{nota}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I NUMERI DEL TELEFONO
   ═════════════════════════════════════════════════════════════════════════ */

/** I gruppi del setter che parlano di APPUNTAMENTI: nel loro elenco si mostra
 *  la data del meeting invece di quella d'ingresso, perché è l'unica data che
 *  si sta cercando. Sta in una costante e non in una catena di `||` perché
 *  aggiungere un gruppo e dimenticare la catena è già successo: l'elenco
 *  «ancora da svolgere» sarebbe nato mostrando la data sbagliata. */
const GRUPPI_SETTER_CON_DATA = new Set<GruppoSetter>([
  "fissati",
  "daSvolgere",
  "presentati",
  "noShow",
]);

/** Il blocco del setter: i suoi numeri, l'elenco dietro il numero scelto e —
 *  sempre — la riga che dichiara come sono attribuiti. */
function SezioneNumeriSetter({
  nome,
  metrica,
  gruppo,
  onGruppo,
  elenco,
  onApriLead,
  etichettaPeriodo,
}: {
  nome: string;
  metrica: MetricheSetter | null;
  gruppo: GruppoSetter;
  onGruppo: (g: GruppoSetter) => void;
  elenco: Lead[];
  onApriLead: (id: string) => void;
  etichettaPeriodo?: string;
}) {
  return (
    <>
      <TitoloMestiere
        icona={PhoneCall}
        titolo="Come setter"
        nota="Chi telefona e fissa. Si misura sugli appuntamenti messi in agenda: che poi il cliente compri non dipende da lui."
      />
      {!metrica ? (
        //  Succede quando «fa il setter» è stato appena acceso e non ancora
        //  salvato: mostrare zeri farebbe credere che non abbia fissato niente.
        <VuotoFinestra
          testo={`Salva la scheda per vedere i numeri di ${nome || "questa persona"} come setter.`}
        />
      ) : (
        <>
          <NumeriSetter metrica={metrica} gruppo={gruppo} onGruppo={onGruppo} />
          <SezioneFinestra
            titolo={GRUPPI_SETTER[gruppo].etichetta}
            nota={
              etichettaPeriodo
                ? `${elenco.length} nel periodo · ${etichettaPeriodo}`
                : `${elenco.length} nel periodo`
            }
            senzaPadding
          >
            <div className="border-b border-slate-200 px-4 py-2">
              <p className="text-[11px] leading-snug text-slate-500">
                {GRUPPI_SETTER[gruppo].spiegazione}
              </p>
            </div>
            <ElencoLead
              leads={elenco}
              //  Quali gruppi mostrano la data del meeting: vedi
              //  `GRUPPI_SETTER_CON_DATA` qui sopra.
              gruppo={GRUPPI_SETTER_CON_DATA.has(gruppo) ? "appuntamenti" : "lead"}
              onApri={onApriLead}
              vuoto="Nessuna scheda dietro questo numero."
            />
            <NotaAttribuzioneSetter />
          </SezioneFinestra>
        </>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I NUMERI
   ═════════════════════════════════════════════════════════════════════════ */

function SezioneNumeri({
  metrica,
  gruppo,
  onGruppo,
  elenco,
  onApriLead,
  etichettaPeriodo,
}: {
  metrica: MetricheConsulente | null;
  gruppo: GruppoNumero;
  onGruppo: (g: GruppoNumero) => void;
  elenco: Lead[];
  onApriLead: (id: string) => void;
  etichettaPeriodo?: string;
}) {
  if (!metrica) {
    return <VuotoFinestra testo="Nessun numero per questo consulente nel periodo scelto." />;
  }
  return (
    <>
      <KpiRiga colonne={3}>
        <Kpi
          etichetta="Lead"
          valore={metrica.lead}
          nota={`${(metrica.quotaLead * 100).toFixed(0)}% del totale assegnato`}
          onClick={() => onGruppo("lead")}
          attivo={gruppo === "lead"}
        />
        <Kpi
          etichetta="Appuntamenti"
          valore={metrica.appuntamenti}
          nota={`${metrica.leadVersoAppuntamento.toFixed(0)}% dei lead`}
          onClick={() => onGruppo("appuntamenti")}
          attivo={gruppo === "appuntamenti"}
        />
        <Kpi
          etichetta="Consulenze svolte"
          valore={metrica.consulenze}
          onClick={() => onGruppo("consulenze")}
          attivo={gruppo === "consulenze"}
        />
        <Kpi
          etichetta="Clienti"
          valore={metrica.conversioni}
          tono={metrica.conversioni > 0 ? "vinta" : "neutro"}
          onClick={() => onGruppo("clienti")}
          attivo={gruppo === "clienti"}
        />
        <Kpi
          etichetta="No show"
          valore={metrica.noShow}
          tono={metrica.noShow > 0 ? "persa" : "neutro"}
          onClick={() => onGruppo("noShow")}
          attivo={gruppo === "noShow"}
        />
        {/*  Niente «0,0%» quando non ci sono consulenze: è la stessa regola
            dell'elenco e della scheda KPI, e la nota porta sempre la base —
            «50%» su due consulenze e «50%» su quaranta non sono lo stesso
            numero, ma senza denominatore si leggono uguali. */}
        <Kpi
          etichetta="CVR"
          valore={metrica.consulenze > 0 ? `${metrica.cvr.toFixed(1)}%` : "—"}
          nota={
            metrica.consulenze > 0
              ? `${metrica.conversioni} su ${metrica.consulenze} consulenze`
              : "Nessuna consulenza svolta nel periodo"
          }
          tono={
            metrica.consulenze === 0
              ? "neutro"
              : metrica.cvr >= 50
                ? "vinta"
                : metrica.cvr >= 25
                  ? "in_sospeso"
                  : "neutro"
          }
          onClick={() => onGruppo("consulenze")}
        />
        <Kpi
          etichetta="Fatturato"
          valore={eur(metrica.fatturatoLordo)}
          nota="Prezzi finali di vendita"
          onClick={() => onGruppo("fatturato")}
          attivo={gruppo === "fatturato"}
        />
        <Kpi
          etichetta="Margine"
          valore={eur(metrica.fatturatoNetto)}
          nota="Costi tolti, spesa ADV esclusa"
          onClick={() => onGruppo("fatturato")}
        />
        <Kpi
          etichetta="Costo per cliente"
          valore={metrica.cpa > 0 ? eur(metrica.cpa) : "—"}
          nota="Spesa ADV attribuita pro-quota"
          onClick={() => onGruppo("clienti")}
        />
      </KpiRiga>

      <SezioneFinestra
        titolo={GRUPPI[gruppo].etichetta}
        nota={
          etichettaPeriodo
            ? `${elenco.length} nel periodo · ${etichettaPeriodo}`
            : `${elenco.length} nel periodo`
        }
        senzaPadding
      >
        <div className="border-b border-slate-200 px-4 py-2">
          <p className="text-[11px] leading-snug text-slate-500">{GRUPPI[gruppo].spiegazione}</p>
        </div>
        <ElencoLead
          leads={elenco}
          gruppo={gruppo}
          onApri={onApriLead}
          vuoto="Nessun lead dietro questo numero."
        />
      </SezioneFinestra>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL PIN
   ═════════════════════════════════════════════════════════════════════════ */

function SezionePin({
  nome,
  stato,
  pin,
  onPin,
  mostra,
  onMostra,
  onSalva,
  onRevoca,
  onProponi,
  revocabile,
  consegnato,
  onCopiaConsegnato,
  onFineConsegna,
}: {
  nome: string;
  stato: { testo: string; tono: "neutro" | "vinta" | "in_sospeso" };
  pin: string;
  onPin: (v: string) => void;
  mostra: boolean;
  onMostra: (v: boolean) => void;
  onSalva: () => void;
  onRevoca: () => void;
  onProponi: () => void;
  revocabile: boolean;
  /** Il codice appena assegnato: si mostra una volta sola, per consegnarlo. */
  consegnato: string;
  onCopiaConsegnato: () => void;
  onFineConsegna: () => void;
}) {
  const valido = /^\d{4,8}$/.test(pin);
  return (
    <SezioneFinestra
      titolo="Accesso"
      nota="Lo stesso codice per il CRM e per le videoconsulenze"
      icona={KeyRound}
      azioni={<Chip tono={stato.tono}>{stato.testo}</Chip>}
      classeCorpo="p-4 space-y-3"
    >
      {/*  L'unica finestra in cui il codice è ancora leggibile. Sta in cima
          perché è l'azione del momento: dettarlo o incollarlo al consulente. */}
      {consegnato && (
        <NotaFinestra tono="conferma" icona={Check}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              PIN di {nome || "questo consulente"}:{" "}
              <strong className="text-[14px] tracking-[0.25em] tabular-nums">{consegnato}</strong>
            </span>
            <span className="w-full text-[11px] opacity-80 sm:w-auto">
              Consegnalo adesso: da qui in poi non è più leggibile.
            </span>
            <button
              type="button"
              onClick={onCopiaConsegnato}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50"
            >
              <Copy className="h-3 w-3" /> Copia
            </button>
            <button
              type="button"
              onClick={onFineConsegna}
              className="rounded-md px-1.5 py-0.5 text-[11px] text-emerald-800/80 hover:bg-emerald-100"
            >
              Fatto, nascondi
            </button>
          </span>
        </NotaFinestra>
      )}

      <CampoFinestra
        etichetta={revocabile ? "Sostituisci il PIN" : "Assegna un PIN"}
        nota="Da 4 a 8 cifre. Si detta al telefono, quindi niente lettere."
        azioni={
          <button
            type="button"
            onClick={() => onMostra(!mostra)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            {mostra ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {mostra ? "Nascondi" : "Mostra"}
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            //  Coperto per difetto: il PIN si assegna spesso con qualcuno che
            //  guarda lo schermo, e scoprirlo deve essere una scelta.
            type={mostra ? "text" : "password"}
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => onPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="••••"
            className={cn(CLASSE_CAMPO, "w-32 tracking-[0.35em]")}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onProponi}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
          >
            <Shuffle className="h-3.5 w-3.5" /> Proponi
          </Button>
          <Button size="sm" onClick={onSalva} disabled={!valido}>
            {revocabile ? "Sostituisci" : "Attiva accesso"}
          </Button>
          {revocabile && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRevoca}
              className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
            >
              Revoca
            </Button>
          )}
        </div>
      </CampoFinestra>

      {/*  L'avviso serve quando c'è davvero qualcosa da rompere. Alla prima
          assegnazione «invalida il precedente» non vuol dire niente, e un avviso
          che non riguarda quello che stai facendo insegna a saltare gli avvisi. */}
      {revocabile ? (
        <NotaFinestra tono="attenzione" icona={TriangleAlert}>
          Assegnare un PIN nuovo <strong>invalida subito il precedente</strong>: chi lo stava usando
          resta fuori sia dal CRM sia dalle videoconsulenze, finché non riceve quello nuovo.
        </NotaFinestra>
      ) : (
        <NotaFinestra>
          Appena attivato, {nome || "il consulente"} entra con questo codice: dalla schermata di
          accesso del CRM e come presentatore nelle videoconsulenze.
        </NotaFinestra>
      )}
      <NotaFinestra>
        Il codice non è rileggibile: il CRM lo conserva ma non lo restituisce a nessuna schermata.
        Se {nome || "il consulente"} l&apos;ha perso, se ne assegna un altro.
      </NotaFinestra>
    </SezioneFinestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHE COSA PUÒ FARE, UNA VOLTA ENTRATO

   Sta accanto al PIN e non in una pagina sua: chiave e permesso sono la stessa
   decisione — «questa persona entra, e fa queste cose». Separarli significa
   assegnare il PIN oggi e i permessi mai, cioè lasciare a tutti tutto.

   SI ACCENDONO I MESTIERI, non si spuntano quindici caselle. I mestieri sono
   l'unica cosa che chi assegna il PIN sa già senza doverci pensare — «telefona,
   e ogni tanto va a posare» — e si possono accendere tutti insieme: il permesso
   è l'UNIONE di ciò che serve a ciascuno (crm/permessi.ts). Sopra ci sono le
   chiavi di casa, che restano una decisione a parte, e sotto le poche eccezioni
   che in un'azienda vera cambiano davvero da persona a persona.

   ⚠️ LE STESSE SPUNTE STANNO ANCHE IN «ANAGRAFICA → CHE MESTIERE FA», e sono lo
   stesso dato: si accendono di qua o di là indifferentemente. Compaiono due
   volte perché rispondono a due domande che si fanno in due momenti diversi —
   «come va misurata» quando si guarda una classifica, «che cosa può toccare»
   quando si consegna un PIN — e mandare a cercare l'altra linguetta è il modo
   in cui una delle due resta non compilata.

   ⚠️ QUI SI DISEGNA, NON SI DIFENDE. Il rifiuto vero lo dà il server su ogni
   rotta (guardiaCRM / guardiaP): questa scheda decide solo che cosa scrivere
   nella riga del PIN e nella scheda della persona.
   ═════════════════════════════════════════════════════════════════════════ */

/** Perché questa persona può fare questa cosa, detto in italiano. Serve alla
 *  riga dell'elenco qui sotto: un permesso senza il suo perché costringe a
 *  indovinare quale spunta spegnere per toglierlo. */
function motivoDelPermesso(
  p: Permesso,
  ruolo: RuoloCRM,
  mestieri: Mestieri,
  deroghe: Partial<Record<Permesso, boolean>>,
): string {
  //  La deroga per prima: è la sola decisione presa a mano su questo permesso,
  //  e comanda su tutto il resto — dirlo per primo è dire dove si va a
  //  spegnerla.
  if (deroghe[p] === true) return "aggiunto a mano qui sotto";
  if (ruolo === "admin") return "ha le chiavi di casa";
  const da = mestieriAccesi(mestieri).filter((k) => PERMESSI_MESTIERE[k].includes(p));
  if (da.length > 0) return `fa il ${da.map((k) => NOME_MESTIERE[k]).join(" e il ")}`;
  //  Resta `lead.propri`, che ha chiunque entri: senza, il CRM si aprirebbe e
  //  non farebbe niente.
  return "ce l'ha chiunque entri";
}

/** L'elenco in chiaro: frasi intere, non sigle, una riga per cosa, con accanto
 *  da dove arriva. È la risposta alla domanda che si fa chi assegna un
 *  permesso — «e quindi questa persona che cosa vede?» — e finché non c'era,
 *  quella domanda si risolveva provando col PIN di qualcun altro. */
function ElencoInChiaro({
  elenco,
  perche,
}: {
  elenco: Permesso[];
  perche?: (p: Permesso) => string;
}) {
  if (elenco.length === 0) return null;
  return (
    <ul className="space-y-1">
      {elenco.map((p) => (
        <li key={p} className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="min-w-0 text-[12.5px] leading-snug text-slate-800">
            {ETICHETTA_PERMESSO[p]}
            {perche && <span className="text-slate-500"> · {perche(p).toLowerCase()}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SezionePermessi({
  nome,
  ruolo,
  mestieri,
  onMestiere,
  base,
  concessi,
  deroghe,
  inVigore,
  secondoMestieri,
  dichiarato,
  onPermesso,
  onSalva,
  onAdmin,
  salvando,
  modificato,
  senzaPin,
}: {
  nome: string;
  ruolo: RuoloCRM;
  /** Le spunte della BOZZA, non quelle salvate: l'interruttore deve rispondere
   *  subito e l'elenco «potrà fare» deve muoversi con lui. */
  mestieri: Mestieri;
  onMestiere: (patch: MestieriConsulente) => void;
  /** Quello che i mestieri accesi danno da soli, prima delle eccezioni: serve a
   *  dire quali eccezioni sono davvero un'eccezione. */
  base: Permesso[];
  concessi: Permesso[];
  deroghe: Partial<Record<Permesso, boolean>>;
  /** Che cosa può fare ADESSO, secondo il server. Diverso da `concessi` solo
   *  finché su questa persona comanda ancora il vecchio livello: è il «prima»
   *  del confronto che si mostra prima di far passare qualcuno ai mestieri. */
  inVigore: Permesso[];
  /** true = i permessi di questa persona seguono già i mestieri. false = segue
   *  ancora il livello, e salvando qui cambia regola: va detto e mostrato. */
  secondoMestieri: boolean;
  /** false = nessuno ha mai scelto un livello per questa persona: quello che
   *  vale è il ripiego, e va detto invece che lasciato credere. */
  dichiarato: boolean;
  onPermesso: (p: Permesso, acceso: boolean) => void;
  onSalva: () => void;
  onAdmin: (v: boolean) => void;
  salvando: boolean;
  modificato: boolean;
  senzaPin: boolean;
}) {
  const admin = ruolo === "admin";
  const perche = (p: Permesso) => motivoDelPermesso(p, ruolo, mestieri, deroghe);
  //  Il confronto del passaggio, calcolato una volta sola e sui due elenchi
  //  interi: «guadagna» e «perde» sono le uniche due cose che chi salva deve
  //  sapere prima di premere, e vanno dette come differenza, non come due
  //  elenchi lunghi da confrontare a occhio.
  const guadagna = concessi.filter((p) => !inVigore.includes(p));
  const perde = inVigore.filter((p) => !concessi.includes(p));
  const nessunMestiere = mestieriAccesi(mestieri).length === 0;

  return (
    <SezioneFinestra titolo="Che cosa può fare" classeCorpo="p-4 space-y-4">
      {/*  ── IL PASSAGGIO, DETTO PRIMA DI FARLO ──────────────────────────
          Questa persona è ancora sul vecchio livello: finché non si salva qui
          non le cambia niente, ed è apposta — chi lavora oggi non deve
          ritrovarsi domattina con permessi diversi perché è uscita una
          versione nuova. Ma il momento in cui si salva va capito prima, non
          scoperto dopo: quindi si scrive che cosa guadagna e che cosa perde,
          con le parole delle cose, non con i nomi dei livelli. */}
      {!secondoMestieri && !senzaPin && (
        <NotaFinestra tono="attenzione" icona={TriangleAlert}>
          <span className="block">
            I permessi di {nome || "questa persona"} seguono ancora il vecchio livello{" "}
            <strong>{ETICHETTA_RUOLO[ruolo]}</strong>
            {!dichiarato && " (che però non le ha mai assegnato nessuno: vale il più basso)"}.
            Salvando qui passano ai <strong>mestieri accesi</strong> qui sotto, e da quel momento si
            cambiano accendendo e spegnendo quelle spunte.
          </span>
          {guadagna.length > 0 && (
            <span className="mt-1.5 block">
              <strong>In più potrà:</strong>{" "}
              {guadagna.map((p) => ETICHETTA_PERMESSO[p].toLowerCase()).join(", ")}.
            </span>
          )}
          {perde.length > 0 && (
            <span className="mt-1.5 block">
              <strong>Non potrà più:</strong>{" "}
              {perde.map((p) => ETICHETTA_PERMESSO[p].toLowerCase()).join(", ")}. Se serve, accendi
              il mestiere che lo dà o riaccendilo fra le eccezioni.
            </span>
          )}
          {guadagna.length === 0 && perde.length === 0 && (
            <span className="mt-1.5 block">
              Non cambia niente di quello che può fare oggi: cambia solo da dove arriva — dai suoi
              mestieri invece che dal livello.
            </span>
          )}
        </NotaFinestra>
      )}

      {/*  ── ⚠️ E LE SPUNTE CHE SI VEDONO POTREBBERO NON AVERLE SCELTE NESSUNO
          Su una scheda in cui «che lavoro fa» non è mai stato compilato, quello
          che si vede qui sotto è il valore di partenza (consulente sì, setter
          no): è un ripiego per i GRAFICI, non una scelta di nessuno, e finché
          comanda il livello non ha mai dato un permesso a nessuno. Salvando
          diventa il permesso, e su chi oggi è SETTER significa consegnargli
          preventivi e incassi. La differenza è già scritta qui sopra («in più
          potrà»), ma là si legge come un effetto; qui si dice da dove viene e
          che cosa fare, perché è l'unico momento in cui si può ancora
          correggere. Sparisce appena qualcuno tocca una spunta e salva. */}
      {!secondoMestieri && !admin && !mestieri.dichiarato && (
        <NotaFinestra tono="attenzione" icona={TriangleAlert}>
          Nessuno ha ancora scelto che lavoro fa {nome || "questa persona"}: le spunte qui sotto
          sono il valore di partenza — <strong>consulente sì, setter no</strong> — e finora non le
          hanno dato nessun permesso. Salvando diventano il suo permesso:{" "}
          <strong>controllale una per una prima di premere</strong>. Se telefona e basta, spegni «Fa
          il consulente» e accendi «Fa il setter», altrimenti da domani potrà fare preventivi e
          registrare incassi.
        </NotaFinestra>
      )}

      {/*  ── I RUOLI, CHE SI SOMMANO ──────────────────────────────────────
          Sono le stesse spunte dell'anagrafica e lo stesso componente: due
          copie della stessa domanda prendono due formulazioni diverse nel giro
          di un mese, e qui la formulazione È il permesso. */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Che lavoro fa · si possono accendere tutti
        </p>
        <SceltaMestieri
          faSetter={mestieri.faSetter}
          faConsulente={mestieri.faConsulente}
          faDriver={mestieri.faDriver}
          faInstallatore={mestieri.faInstallatore}
          faAccompagnatore={mestieri.faAccompagnatore}
          faManutentore={mestieri.faManutentore}
          onCambio={onMestiere}
        />
        {nessunMestiere && !admin && (
          <NotaFinestra tono="attenzione" icona={TriangleAlert}>
            Senza nessun mestiere acceso {nome || "questa persona"} entra nel CRM e vede soltanto i
            propri lead: niente agenda, niente preventivi, niente installazioni. Se deve lavorare,
            accendi il mestiere che fa.
          </NotaFinestra>
        )}
      </div>

      {/*  ── LE CHIAVI DI CASA ────────────────────────────────────────────
          Sotto i mestieri e non sopra: è la decisione rara, e chi apre questa
          scheda nove volte su dieci sta assegnando un mestiere. È un
          interruttore e non un pulsante che salva da solo, perché adesso il
          salvataggio è uno per tutta la sezione — mestieri, chiavi ed eccezioni
          sono la stessa decisione e partono insieme. */}
      <label
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3",
          admin ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white",
        )}
      >
        <span className="min-w-0">
          <span
            className={cn(
              "block text-[13.5px] font-semibold",
              admin ? "text-amber-900" : "text-slate-900",
            )}
          >
            Ha anche le chiavi di casa (ADMIN)
          </span>
          <span
            className={cn(
              "block text-[12px] leading-snug",
              admin ? "text-amber-800/85" : "text-slate-600",
            )}
          >
            {senzaPin
              ? "Prima assegna un PIN: senza, non entra da nessuna parte."
              : admin
                ? "Vede e gestisce tutto, come te — archivio, listino, spesa pubblicitaria, PIN e permessi di tutti. I mestieri qui sopra restano quelli che fa, ma non le tolgono niente."
                : "Apre tutto in un gesto: archivio, listino, spesa pubblicitaria e margini, PIN e permessi. È l'unica cosa che i mestieri non danno."}
          </span>
        </span>
        <Switch checked={admin} onCheckedChange={onAdmin} disabled={salvando || senzaPin} />
      </label>

      {/*  ── LE ECCEZIONI ─────────────────────────────────────────────────
          Sono le cose che non appartengono a un mestiere solo: chi vede i lead
          di tutti, chi li assegna, chi cancella, chi guarda i numeri delle
          campagne. Con le chiavi di casa accese non servono — un admin ha già
          tutto — e mostrarle lì sarebbe un pannello di interruttori che non
          fanno niente. */}
      {admin ? (
        <NotaFinestra icona={ShieldCheck}>
          Con le chiavi di casa non ci sono eccezioni da dosare: {nome || "questa persona"} ha già
          tutto. Togli l&apos;interruttore qui sopra per tornare a decidere cosa per cosa.
        </NotaFinestra>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Eccezioni, oltre a quello che danno i mestieri
          </p>
          {INTERRUTTORI_FINI.map((p) => {
            const acceso = concessi.includes(p);
            //  Dire che si sta derogando, e in che verso: senza questa riga si
            //  perde di vista che cosa è stato cambiato a mano rispetto ai
            //  mestieri, e alla revisione successiva nessuno sa più perché.
            const deroga = acceso !== base.includes(p);
            return (
              <label
                key={p}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] text-slate-800">{ETICHETTA_PERMESSO[p]}</span>
                  {deroga && (
                    <span className="block text-[11px] text-amber-700">
                      {acceso
                        ? "Aggiunto a mano: nessuno dei mestieri accesi lo dà"
                        : "Tolto a mano, anche se un mestiere acceso lo darebbe"}
                    </span>
                  )}
                </span>
                <Switch checked={acceso} onCheckedChange={(v) => onPermesso(p, v)} />
              </label>
            );
          })}
        </div>
      )}

      {/*  ── E ALLA FINE, IN CHIARO ───────────────────────────────────────
          L'elenco di quello che questa persona potrà fare, frase per frase e
          con accanto da dove arriva. Non è un riepilogo di cortesia: è l'unico
          punto in cui si vede il RISULTATO di mestieri, chiavi ed eccezioni
          messi insieme, ed è quello che si legge prima di premere Salva. */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {modificato ? "Dopo il salvataggio potrà" : "Può"}
        </p>
        <ElencoInChiaro elenco={concessi} perche={perche} />
        {concessi.length < TUTTI_I_PERMESSI.length && (
          <p className="text-[11.5px] leading-snug text-slate-500">
            <strong>Non potrà:</strong>{" "}
            {TUTTI_I_PERMESSI.filter((p) => !concessi.includes(p))
              .map((p) => ETICHETTA_PERMESSO[p].toLowerCase())
              .join(", ")}
            .
          </p>
        )}
      </div>

      {senzaPin ? (
        <NotaFinestra icona={ShieldCheck}>
          {nome || "Il consulente"} non ha ancora un PIN: accendi qui sopra i mestieri che fa e
          verranno salvati insieme al codice, con il pulsante «Attiva accesso».
        </NotaFinestra>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onSalva} disabled={!modificato || salvando}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {salvando ? "Salvataggio…" : "Salva ruoli e permessi"}
          </Button>
          {modificato && (
            <span className="text-[11px] text-amber-700">Modifiche non ancora salvate.</span>
          )}
        </div>
      )}

      <NotaFinestra>
        Vale <strong>subito</strong>, anche se {nome || "il consulente"} sta già lavorando: i
        permessi vengono riletti a ogni richiesta, non al prossimo accesso. Il suo menu di sinistra
        si riallinea da solo entro un minuto — o appena torna sulla scheda del CRM — senza uscire e
        rientrare. Lo stesso vale nelle videoconsulenze, perché il codice è lo stesso.
      </NotaFinestra>
    </SezioneFinestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ORARI E DISPONIBILITÀ
   ═════════════════════════════════════════════════════════════════════════ */

function SezioneOrari({
  bozza,
  cambia,
}: {
  bozza: ConsultantData;
  cambia: <K extends keyof ConsultantData>(k: K, v: ConsultantData[K]) => void;
}) {
  const orario = `${CLASSE_CAMPO} w-auto min-w-0 flex-1`;

  const giornoDentroFuori = (dow: number) => {
    const c = bozza.giorniLavorativi.includes(dow);
    cambia(
      "giorniLavorativi",
      c ? bozza.giorniLavorativi.filter((x) => x !== dow) : [...bozza.giorniLavorativi, dow].sort(),
    );
  };

  const cambiaFasce = (next: FasciaOraria[]) => cambia("fasceOrarie", next);

  const cambiaFasceGiorno = (dow: number, fasce: FasciaOraria[]) => {
    const cur = { ...(bozza.fasceOrarieGiorno || {}) };
    if (fasce.length === 0) delete cur[dow];
    else cur[dow] = fasce;
    cambia("fasceOrarieGiorno", cur);
  };

  const aggiungiIndisp = () =>
    cambia("indisponibilita", [
      ...(bozza.indisponibilita || []),
      { data: new Date().toISOString().slice(0, 10) } as IndisponibilitaCustom,
    ]);

  const cambiaIndisp = (i: number, patch: Partial<IndisponibilitaCustom>) => {
    const arr = [...(bozza.indisponibilita || [])];
    arr[i] = { ...arr[i], ...patch };
    cambia("indisponibilita", arr);
  };

  const togliIndisp = (i: number) => {
    const arr = [...(bozza.indisponibilita || [])];
    arr.splice(i, 1);
    cambia("indisponibilita", arr);
  };

  return (
    <>
      <SezioneFinestra
        titolo="Giorni lavorativi"
        nota="Nei giorni spenti non vengono proposti slot."
        classeCorpo="p-4"
      >
        <div className="grid grid-cols-7 gap-1.5">
          {GIORNI.map((g, i) => (
            <Pillola
              key={g}
              attiva={bozza.giorniLavorativi.includes(i)}
              onClick={() => giornoDentroFuori(i)}
              className="py-2"
            >
              {g}
            </Pillola>
          ))}
        </div>
      </SezioneFinestra>

      <SezioneFinestra
        titolo="Fasce orarie predefinite"
        nota="Valgono per tutti i giorni lavorativi."
        azioni={
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
            onClick={() => cambiaFasce([...bozza.fasceOrarie, { inizio: "14:00", fine: "18:00" }])}
          >
            <Plus className="h-3 w-3" /> Aggiungi
          </Button>
        }
        classeCorpo="p-4 space-y-2"
      >
        {bozza.fasceOrarie.length === 0 ? (
          <VuotoFinestra testo="Nessuna fascia impostata: il consulente non ha slot." />
        ) : (
          bozza.fasceOrarie.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="time"
                value={f.inizio}
                onChange={(e) => {
                  const next = [...bozza.fasceOrarie];
                  next[i] = { ...next[i], inizio: e.target.value };
                  cambiaFasce(next);
                }}
                className={orario}
              />
              <span className="text-slate-400">—</span>
              <Input
                type="time"
                value={f.fine}
                onChange={(e) => {
                  const next = [...bozza.fasceOrarie];
                  next[i] = { ...next[i], fine: e.target.value };
                  cambiaFasce(next);
                }}
                className={orario}
              />
              <Button
                size="icon"
                variant="ghost"
                title="Togli la fascia"
                className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => cambiaFasce(bozza.fasceOrarie.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </SezioneFinestra>

      <SezioneFinestra
        titolo="Orari diversi in un giorno"
        nota="Se imposti fasce per un giorno, sostituiscono quelle predefinite."
        classeCorpo="p-4 space-y-2"
      >
        {bozza.giorniLavorativi.length === 0 ? (
          <VuotoFinestra testo="Scegli prima i giorni lavorativi." />
        ) : (
          bozza.giorniLavorativi.map((dow) => {
            const fasce = bozza.fasceOrarieGiorno?.[dow] || [];
            return (
              <div key={dow} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-slate-900">{GIORNI[dow]}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() =>
                      cambiaFasceGiorno(dow, [...fasce, { inizio: "09:00", fine: "13:00" }])
                    }
                  >
                    <Plus className="h-3 w-3" /> Aggiungi
                  </Button>
                </div>
                {fasce.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Usa le fasce predefinite.</p>
                ) : (
                  <div className="space-y-2">
                    {fasce.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={f.inizio}
                          onChange={(e) => {
                            const next = [...fasce];
                            next[i] = { ...next[i], inizio: e.target.value };
                            cambiaFasceGiorno(dow, next);
                          }}
                          className={orario}
                        />
                        <span className="text-slate-400">—</span>
                        <Input
                          type="time"
                          value={f.fine}
                          onChange={(e) => {
                            const next = [...fasce];
                            next[i] = { ...next[i], fine: e.target.value };
                            cambiaFasceGiorno(dow, next);
                          }}
                          className={orario}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Togli la fascia"
                          className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() =>
                            cambiaFasceGiorno(
                              dow,
                              fasce.filter((_, j) => j !== i),
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </SezioneFinestra>

      <SezioneFinestra
        titolo="Giorni e ore non disponibili"
        azioni={
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
            onClick={aggiungiIndisp}
          >
            <Plus className="h-3 w-3" /> Aggiungi data
          </Button>
        }
        classeCorpo="p-4 space-y-2"
      >
        <NotaFinestra>Lascia gli orari vuoti per bloccare l&apos;intera giornata.</NotaFinestra>
        {(bozza.indisponibilita || []).map((ind, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={ind.data}
                onChange={(e) => cambiaIndisp(i, { data: e.target.value })}
                className={orario}
              />
              <Input
                type="time"
                placeholder="da"
                value={ind.inizio || ""}
                onChange={(e) => cambiaIndisp(i, { inizio: e.target.value })}
                className={orario}
              />
              <Input
                type="time"
                placeholder="a"
                value={ind.fine || ""}
                onChange={(e) => cambiaIndisp(i, { fine: e.target.value })}
                className={orario}
              />
              <Button
                size="icon"
                variant="ghost"
                title="Togli la data"
                className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => togliIndisp(i)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="Motivo (opzionale)"
              value={ind.motivo || ""}
              onChange={(e) => cambiaIndisp(i, { motivo: e.target.value })}
              className={CLASSE_CAMPO}
            />
          </div>
        ))}
        {(!bozza.indisponibilita || bozza.indisponibilita.length === 0) && (
          <VuotoFinestra testo="Nessun blocco impostato." />
        )}
      </SezioneFinestra>
    </>
  );
}

/** Il vecchio nome resta valido: era il dialogo dei soli KPI e qualcuno
 *  potrebbe ancora importarlo. Ora apre la scheda intera, che è un superset. */
export function ConsultantKPIDialog({
  consultant,
  open,
  onOpenChange,
  dentro,
}: {
  consultant: Consultant | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dentro?: FiltroPeriodo;
}) {
  return (
    <SchedaConsulente
      consulente={consultant}
      aperta={open}
      onCambio={onOpenChange}
      dentro={dentro ?? (() => true)}
    />
  );
}
