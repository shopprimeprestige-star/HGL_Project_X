// ── CHE FACCIO ADESSO ───────────────────────────────────────────────────────
//  Questa pagina risponde a una domanda sola, ed è la prima della giornata:
//  "che cosa devo fare adesso". Tutto il resto — l'andamento, i totali, i
//  numeri — viene dopo, in fondo, dove si guarda una volta al giorno.
//
//  LA REGOLA DEI TRE SECONDI. Si apre la pagina e in meno di tre secondi si
//  deve sapere cosa premere. Prima non era così: c'erano dieci righe tutte
//  uguali e la risposta costava una lettura completa dell'agenda, venti volte
//  al giorno. Adesso il prossimo appuntamento è UNO SOLO, grande, in cima, con
//  quanto manca scritto in parole e i gesti a portata di pollice; il resto
//  della giornata resta sotto, dov'è sempre stato.
//
//  L'ORDINE È LA FUNZIONE PRINCIPALE. Dall'alto in basso:
//   1. ADESSO — il prossimo appuntamento, o (se non ce n'è) il primo passo che
//      ha senso fare in questo momento.
//   2. LE CODE IN UNA RIGA — cinque numeri che portano al blocco giusto.
//   3. LA GIORNATA — l'agenda del giorno scelto, con banner, esiti e i tre
//      gruppi (da fare · svolti · non svolti).
//   4. DA RECUPERARE — il lavoro rimasto indietro, ognuno con il suo motivo:
//      appuntamenti passati senza esito, clienti assenti, appuntamenti da
//      riprogrammare rimasti senza data nuova. Presente ma non invadente:
//      l'arretrato invisibile è arretrato che cresce, quello urlato fa
//      smettere di guardare la pagina.
//   5. LE ALTRE CODE — ricontatti di oggi, chi viene in sede, installazioni.
//   6. ANDAMENTO — i numeri.
//
//  Il filtro consulente è UNO SOLO e vale per tutta la pagina: filtrare
//  l'agenda su una persona e vedere gli arretrati di tutti significava
//  lavorare, senza accorgersene, sui contatti di un collega.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCRM } from "@/crm/CRMContext";
import {
  MeetGiornalieri,
  RigaLead,
  SchedaAdesso,
  Sezione,
  Elenco,
  esitoDi,
  giornoBreve,
  minutiDi,
  attesaDi,
  iso,
  soloGiorno,
} from "@/crm/MeetGiornalieri";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LEAD_STATUS_LABEL,
  eAppuntamento,
  eChiusuraVinta,
  //  «La posa è stata fatta?» sta in types.ts, in un posto solo: qui era
  //  ricopiata come `stato !== "venduto"`, ed è la copia che si è rotta.
  posaFatta,
  type Lead,
  type LeadStatus,
} from "@/crm/types";
//  Segmenti di filtro, riga "niente da mostrare" e badge del carico vengono dal
//  linguaggio comune: qui la dashboard se li disegnava per conto suo, con raggi
//  e colori leggermente diversi da quelli dell'elenco lead.
//  Anche le scorciatoie e l'ordinamento per urgenza arrivano da lì: erano
//  riscritti a mano in questa pagina, ed è così che due schermate cominciano a
//  rispondere in modo diverso allo stesso tasto.
import {
  AiutoScorciatoie,
  BadgeCarico,
  SCORCIATOIE_COMUNI,
  Segmento,
  VuotoRiga,
  //  La porta per leggere una data: dice NaN quando non si legge, e serve a
  //  trasformare la data di un mese vicino nello scarto rispetto a oggi.
  giorniDaOggi,
  ordinaPerUrgenza,
  useScorciatoie,
  type Scorciatoia,
} from "@/crm/ui";
import {
  CalendarDays,
  CheckCircle2,
  History,
  MapPin,
  PhoneCall,
  Plus,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { Finestra } from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";
//  Chi fa le consulenze si chiede sempre a lui: vedi la testata del file per il
//  perché la stessa domanda non si riscrive in ogni pagina.
import { NotaSoloConsulenti, consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { LeadDialog } from "@/crm/LeadDialog";
import { InstallationScheduleDialog } from "@/crm/InstallationScheduleDialog";
/*  Le pratiche che si SPEDISCONO non sono pose: non occupano un tecnico e non
 *  hanno un orario. Vanno tolte anche da qui, o la giornata di casa conta un
 *  lavoro che nessuno andrà a fare. Il filtro è lo stesso dell'elenco
 *  installazioni e dell'agenda: una regola sola per tutte e tre le pagine. */
import { soloPose } from "@/crm/spedizione";
import { QuickStatusDialog, requiresAnyDialog } from "@/crm/QuickStatusDialog";
import { useChiusura } from "@/crm/ChiusuraDialog";
import { CapiHealthAlert } from "@/crm/CapiHealthAlert";
import { HealthGlobalSection } from "@/crm/HealthGlobalSection";

export const Route = createFileRoute("/CRM/")({
  component: DashboardPage,
});

/** Minuti dall'inizio della giornata, adesso. */
const oraCorrente = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** ── LE RAGIONI PER CUI UN CONTATTO È ARRETRATO ────────────────────────────
 *  Ogni motivo porta il NOME UFFICIALE dello stato che lo genera (quello della
 *  pastiglia, dell'elenco lead e dei messaggi), tranne "Esito da segnare" che
 *  non è uno stato ma una condizione: un appuntamento passato senza esito.
 *  "Cliente assente" tiene insieme chi non si è presentato e le consulenze non
 *  svolte: sono lo stesso gesto di recupero — una telefonata — e nell'agenda
 *  stanno già nello stesso gruppo.
 *  "Da riprogrammare" invece resta separato, perché il gesto è opposto: non si
 *  telefona per capire, si apre il calendario e si dà una data. */
type TipoArretrato = "senza_esito" | "assente" | "riprogrammare";
const ETICHETTA_ARRETRATO: Record<TipoArretrato, string> = {
  senza_esito: "Esito da segnare",
  //  "Cliente assente" e non "No show" né "Consulenza non svolta": è la parola
  //  che il committente usa e l'unica che dice il fatto senza girarci intorno.
  //  Arriva da LEAD_STATUS_LABEL, così il motivo dell'arretrato e la pastiglia
  //  della riga dicono la stessa cosa.
  assente: LEAD_STATUS_LABEL.no_show,
  riprogrammare: LEAD_STATUS_LABEL.da_spostare,
};

/** ── LE SCORCIATOIE DI QUESTA PAGINA ──────────────────────────────────────
 *  Le tre comuni (ricerca, aiuto, Esc) si aggiungono in coda da sole: chi le ha
 *  imparate altrove le ritrova qui nello stesso ordine. */
const SCORCIATOIE: Scorciatoia[] = [
  ["← →", "Giorno precedente / successivo"],
  //  Maiusc + freccia = mese, come nella pagina Agenda: lo stesso gesto deve
  //  fare la stessa cosa nelle due schermate che mostrano un calendario.
  ["Maiusc + ← →", "Mese precedente / successivo"],
  ["O", "Torna a oggi"],
  ...SCORCIATOIE_COMUNI,
];

/** ── LIMITE DELLE FRECCE ───────────────────────────────────────────────────
 *  Il giorno dell'agenda è uno scarto rispetto a oggi, e da quando la striscia
 *  apre il mese intero non ha più senso fermarlo a due giorni indietro e sei
 *  avanti (erano le pastiglie che finivano lì). Un anno per parte è il limite
 *  che serve solo a impedire che un tasto tenuto premuto porti la dashboard
 *  nel 2400. */
const LIMITE_GIORNI = 366;

/** Sposta il giorno mostrato di un MESE esatto, passando per la data vera:
 *  sommare trenta giorni fa slittare il giorno del mese a ogni salto, e dopo
 *  quattro mesi si è persa la settimana. */
function scartoDelMeseVicino(scarto: number, delta: number): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + scarto);
  const giorno = d.getDate();
  //  Prima il primo del mese, poi il mese: partendo dal 31 si finirebbe nel mese
  //  dopo ancora (il 31 aprile non esiste e JavaScript lo fa scivolare al 1°
  //  maggio). Poi si torna al giorno buono, o all'ultimo che quel mese ha.
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(giorno, ultimo));
  const nuovo = giorniDaOggi(iso(d));
  //  Data illeggibile: si resta dove si era. Non si salta a oggi — sarebbe un
  //  movimento che nessuno ha chiesto.
  if (Number.isNaN(nuovo)) return scarto;
  return Math.max(-LIMITE_GIORNI, Math.min(LIMITE_GIORNI, nuovo));
}

function DashboardPage() {
  const { leads, consultants, updateLead } = useCRM();

  // ── Schede e finestre ────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [installLead, setInstallLead] = useState<Lead | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  //  Cambio di stato che richiede altri dati (data ricontatto, acconto, sede):
  //  senza questa finestra il dato si perdeva e andava rimesso a mano dopo.
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStato, setQuickStato] = useState<LeadStatus | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  //  La finestra delle tre chiusure vinte: apertura, chiusura ed elemento
  //  stanno tutti dentro l'aggancio, così questa pagina non tiene un secondo
  //  paio di stati che potrebbero uscire dal passo con quelli qui sopra.
  const chiusura = useChiusura();

  // ── Filtri di pagina ─────────────────────────────────────────────────────
  const [chi, setChi] = useState(""); // consulente, vale per tutto
  //  Il foglio con cui si sceglie, e che esiste solo sul telefono: sul
  //  monitor i nomi stanno tutti in vista e non si apre mai.
  const [foglioChi, setFoglioChi] = useState(false);
  const [cerca, setCerca] = useState(""); // nome, telefono, città
  const [scarto, setScarto] = useState(0); // giorno dell'agenda, rispetto a oggi
  /** ── L'AGENDA STA MOSTRANDO UNA GIORNATA, O TUTTO LO STORICO ────────────
   *  Il comando è dentro l'agenda (la striscia dei giorni), ma la scelta si
   *  tiene QUI perché fuori dall'agenda ci sono due cose che la riguardano e
   *  che l'agenda non può raggiungere da sola: l'intestazione «La giornata»
   *  qui sotto, che da acceso sarebbe la bugia più in vista della pagina, e il
   *  tasto O — «torna a oggi» — che stando già su oggi non muove lo scarto e
   *  quindi non riporterebbe indietro nessuno. */
  const [storico, setStorico] = useState(false);
  const [soloArretrato, setSoloArretrato] = useState<TipoArretrato | null>(null);
  const [aiuto, setAiuto] = useState(false); // pannello delle scorciatoie ("?")
  const cercaRef = useRef<HTMLInputElement>(null);

  //  L'orologio avanza da solo: "tra 25 min" scritto un'ora fa è una bugia.
  //  Con lui avanza anche la data — altrimenti una pagina lasciata aperta la
  //  notte mostrerebbe ancora la giornata di ieri.
  //  La data è quella LOCALE, non UTC: fino alle due di notte `toISOString()`
  //  restituisce il giorno precedente, e la dashboard si apriva su ieri.
  const [adesso, setAdesso] = useState(oraCorrente);
  const [oggi, setOggi] = useState(() => iso(new Date()));
  useEffect(() => {
    const t = setInterval(() => {
      setAdesso(oraCorrente());
      setOggi(iso(new Date()));
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const nomeConsulente = (l: Lead) =>
    consultants.find((c) => c.id === l.data.consulenteId)?.data.nome;

  // ── Cosa si vede ─────────────────────────────────────────────────────────
  //  La ricerca vale su tutta la pagina, agenda compresa; il filtro consulente
  //  lo applica anche l'agenda per conto suo (le servono i conteggi per giorno).
  const cercati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const d = l.data;
      return `${d.nome || ""} ${d.cognome || ""} ${d.telefono || ""} ${d.citta || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [leads, cerca]);

  const visibili = useMemo(
    () => (chi ? cercati.filter((l) => l.data.consulenteId === chi) : cercati),
    [cercati, chi],
  );

  //  ── CHI PUÒ COMPARIRE NELLA BARRA «CONSULENTE» ─────────────────────────
  //   Solo chi fa le consulenze: questa barra filtra le SCHEDE assegnate, e un
  //   installatore fra i pulsanti è una casella che restituisce sempre zero —
  //   letta come "oggi non ha niente" invece che come "non è il suo mestiere".
  //   Si passa `leads` perché chi ha schede in mano deve restare premibile anche
  //   senza spunta, o quelle schede diventerebbero irraggiungibili dal filtro.
  //   Regola e ripiego stanno in crm/chi-fa-la-consulenza, uno solo per tutti.
  const { elenco: consulentiFiltro, ripiego: ripiegoConsulenti } = useMemo(
    () => consulentiPerConsulenza(consultants, { leads, anche: [chi] }),
    [consultants, leads, chi],
  );

  // ── 1. OGGI: tutti gli appuntamenti ancora da fare ───────────────────────
  //  Non una finestra di due ore: TUTTI quelli di oggi, in ordine di orario.
  //  Una finestra mobile nasconde il resto della giornata e costringe a
  //  cercarlo altrove — e la prima cosa che si vuole sapere aprendo il CRM la
  //  mattina è quanti ne ho oggi, non quanti nelle prossime due ore.
  const imminenti = useMemo(
    () =>
      visibili
        .filter(
          (l) =>
            soloGiorno(l.data.dataMeeting) === oggi &&
            esitoDi(l) === "programmato" &&
            l.data.stato !== "gestire_in_chat",
        )
        .map((l) => ({ l, m: minutiDi(l.data.oraMeeting) }))
        .filter((x): x is { l: Lead; m: number } => x.m !== null)
        .sort((a, b) => a.m - b.m),
    [visibili, oggi],
  );

  //  Tutti gli appuntamenti di oggi, esito compreso: è il numero che dice
  //  quanto pesa la giornata (il badge del carico), non quanti ne restano.
  const appuntamentiOggi = useMemo(
    () => visibili.filter((l) => soloGiorno(l.data.dataMeeting) === oggi),
    [visibili, oggi],
  );

  //  Gli appuntamenti di OGGI segnati "da riprogrammare": non sono da fare (non
  //  hanno più un'ora) e non sono arretrato (il giorno non è ancora passato).
  //  Senza questo conto la pagina diceva "tutti chiusi" mentre tre clienti
  //  aspettavano una telefonata per riavere una data.
  const daRifissareOggi = useMemo(
    () => appuntamentiOggi.filter((l) => l.data.stato === "da_spostare").length,
    [appuntamentiOggi],
  );

  /** ── IL PROSSIMO, E QUELLI SUBITO DOPO ────────────────────────────────
   *  Il primo della lista è il prossimo anche quando la sua ora è già passata
   *  e nessuno ha segnato l'esito: è proprio quello il caso in cui serve una
   *  spinta, e il conto alla rovescia lo dice ("in ritardo di 10 min").
   *  Dietro, due o tre nomi: servono a sapere se si può allungare la
   *  consulenza in corso o se il prossimo è già alla porta. */
  const prossimo = imminenti[0] ?? null;
  const dopo = imminenti.slice(1, 4).map((x) => x.l);

  // ── 2. DA RECUPERARE: il lavoro rimasto indietro ──────────────────────────
  const arretrati = useMemo(() => {
    //  ── COSA È "DA RECUPERARE" ─────────────────────────────────────────
    //   1. un appuntamento di un giorno GIÀ PASSATO rimasto in "Appuntamento":
    //      nessuno ha detto com'è andato, ed è la riga più pericolosa che esista;
    //   2. il cliente che non si è presentato (o la consulenza non svolta);
    //   3. l'appuntamento segnato "da riprogrammare" che una data nuova non
    //      l'ha mai avuta. Prima restava solo dentro l'agenda del suo vecchio
    //      giorno: per ritrovarlo bisognava tornare indietro con le frecce,
    //      cioè non lo ritrovava nessuno. Qui si vede — con la riga ambra, che
    //      dice "basta rifissarlo", non "è perso".
    //   I ricontatti scaduti NON sono arretrato: hanno già un esito e la loro
    //   coda. Mettere tutto qui trasformava la sezione in un secondo elenco
    //   trattative, e non la si guardava più.
    const out: { l: Lead; tipo: TipoArretrato; quando: string }[] = [];
    for (const l of visibili) {
      const d = l.data;
      const giorno = soloGiorno(d.dataMeeting);
      if (d.stato === "no_show" || d.stato === "non_fatto") {
        //  Il giorno di oggi non è arretrato: la giornata non è finita.
        if (!giorno || giorno < oggi) out.push({ l, tipo: "assente", quando: giorno });
      } else if (d.stato === "da_spostare") {
        if (!giorno || giorno < oggi) out.push({ l, tipo: "riprogrammare", quando: giorno });
        //  Anche l'appuntamento di un cliente di ritorno resta senza esito se
        //  il giorno è passato: è la stessa telefonata da fare.
      } else if (eAppuntamento(d.stato) && giorno && giorno < oggi) {
        out.push({ l, tipo: "senza_esito", quando: giorno });
      }
    }
    //  ── L'ORDINE È L'IMMINENZA, NON LA DATA DI INSERIMENTO ─────────────
    //   Dal più recente: quello di ieri si recupera ancora — il cliente si
    //   ricorda di noi, il preventivo è fresco — quello di due mesi fa quasi
    //   mai. "Chi va sentito prima sta in cima" qui vuol dire proprio questo, e
    //   NON "il più vecchio per primo": una coda che parte dai casi ormai freddi
    //   consuma la mezz'ora di recupero sulle telefonate che non rientrano.
    return out.sort((a, b) => b.quando.localeCompare(a.quando));
  }, [visibili, oggi]);

  const contiArretrato = useMemo(() => {
    const c: Record<TipoArretrato, number> = { senza_esito: 0, assente: 0, riprogrammare: 0 };
    for (const a of arretrati) c[a.tipo] += 1;
    return c;
  }, [arretrati]);

  const arretratiVisti = soloArretrato
    ? arretrati.filter((a) => a.tipo === soloArretrato)
    : arretrati;
  //  Venticinque righe bastano per una sessione di recupero: oltre, il posto
  //  giusto è l'elenco trattative, che ha ricerca e ordinamenti.
  const MAX_ARRETRATI = 25;

  // ── 4. LE ALTRE CODE DI OGGI ─────────────────────────────────────────────
  const ricontattiOggi = useMemo(
    () =>
      visibili
        .filter(
          (l) => l.data.stato === "da_ricontattare" && soloGiorno(l.data.dataRicontatto) === oggi,
        )
        .sort((a, b) => (a.data.oraRicontatto || "").localeCompare(b.data.oraRicontatto || "")),
    [visibili, oggi],
  );

  //  Chi viene in sede: appuntamento fisico, altra logistica. Prima oggi, poi i
  //  prossimi, in fondo quelli già passati che nessuno ha chiuso.
  const inSede = useMemo(() => {
    const peso = (d?: string) => (!d ? 1 : d === oggi ? 0 : d > oggi ? 1 : 2);
    return visibili
      .filter((l) => l.data.stato === "viene_in_sede")
      .sort((a, b) => {
        const pa = peso(soloGiorno(a.data.dataVieneInSede)),
          pb = peso(soloGiorno(b.data.dataVieneInSede));
        if (pa !== pb) return pa - pb;
        const cmp = soloGiorno(a.data.dataVieneInSede).localeCompare(
          soloGiorno(b.data.dataVieneInSede),
        );
        return pa === 2 ? -cmp : cmp;
      });
  }, [visibili, oggi]);

  const installazioniOggi = useMemo(
    () =>
      soloPose(visibili)
        .filter((l) => soloGiorno(l.data.installazione?.dataInstallazione) === oggi)
        .sort((a, b) =>
          (a.data.installazione?.orarioInstallazione || "").localeCompare(
            b.data.installazione?.orarioInstallazione || "",
          ),
        ),
    [visibili, oggi],
  );

  //  Ha pagato ma non ha una data di installazione: è la coda che, se resta
  //  ferma, si trasforma in una telefonata del cliente.
  //  In cima chi ha la scadenza più vicina (o già passata), non chi è stato
  //  inserito prima: l'ordine di inserimento risponde a «cosa è arrivato per
  //  ultimo», che non è una domanda che si fa nessuno davanti a questa lista.
  const daProgrammare = useMemo(
    () =>
      ordinaPerUrgenza(
        soloPose(visibili).filter(
          (l) =>
            //  ⚠️ «Non ancora fatta» non è più `stato !== "venduto"`: la posa
            //   eseguita ha adesso un campo suo (installazione.completataIl) e
            //   lo stato di una vendita di oggi non è mai "venduto". Con la
            //   vecchia riga una posa APPENA COMPLETATA restava per sempre in
            //   questa coda, e la dashboard chiedeva di programmare un lavoro
            //   già finito.
            !posaFatta(l.data) &&
            (l.data.stato === "acconto" || (l.data.payment?.accontoPagato || 0) > 0) &&
            !l.data.installazione?.dataInstallazione,
        ),
      ),
    [visibili],
  );

  // ── Azioni ───────────────────────────────────────────────────────────────
  const apriLead = (l: Lead) => {
    setEditing(l);
    setEditOpen(true);
  };
  const nuovoLead = () => {
    setEditing(null);
    setEditOpen(true);
  };
  const apriInstallazione = (l: Lead) => {
    setInstallLead(l);
    setInstallOpen(true);
  };

  /** ── CAMBIO DI STATO ───────────────────────────────────────────────────
   *  Se il nuovo stato ha bisogno di altri dati — la data del ricontatto,
   *  l'acconto, il giorno in sede — si apre la finestra che li chiede. Prima
   *  lo stato cambiava e basta: il dato mancante andava rimesso più tardi,
   *  aprendo la scheda, e spesso non ci tornava nessuno.
   *  Ogni cambio si può annullare per qualche secondo: chi lavora veloce
   *  sbaglia riga, e senza "Annulla" bisogna ricordare lo stato di prima. */
  const cambiaStato = async (l: Lead, nuovo: LeadStatus) => {
    if (nuovo === l.data.stato) return;
    //  ── «HA COMPRATO» PASSA DALLA SUA FINESTRA, E CI PASSA PER PRIMO ──────
    //   Le tre chiusure vinte non si scrivono da qui: le scrive ChiusuraDialog
    //   insieme all'acconto, al totale e al modo di consegna, in un salvataggio
    //   solo. ⚠️ Il ramo sta PRIMA di `requiresAnyDialog` e non chiama
    //   `updateLead`: scrivere lo stato qui e i soldi là sono due momenti, e in
    //   mezzo c'è un lead verde con la cassa vuota — che nel totale del mese
    //   vale una vendita da zero euro e che nessuno andrà più a correggere,
    //   perché a schermo è già a posto.
    if (chiusura.intercetta(l, nuovo)) return;
    if (requiresAnyDialog(nuovo)) {
      setQuickLead(l);
      setQuickStato(nuovo);
      setQuickOpen(true);
      return;
    }
    const precedente = l.data.stato;
    await updateLead(l.id, { stato: nuovo });
    toast.success(`${l.data.nome} ${l.data.cognome} → ${LEAD_STATUS_LABEL[nuovo]}`, {
      action: { label: "Annulla", onClick: () => void updateLead(l.id, { stato: precedente }) },
    });
  };

  const vaiA = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── SCORCIATOIE ──────────────────────────────────────────────────────────
  //  Poche e sensate: la giornata si sfoglia con le frecce, "O" riporta a oggi,
  //  "/" porta il cursore nella ricerca, "?" mostra l'elenco.
  //  Le protezioni — non rubare i tasti mentre si scrive, non toglierli a un
  //  menu aperto, lasciar passare ⌘K — stanno dentro useScorciatoie (crm/ui) e
  //  non più riscritte qui: erano una copia a mano, e una copia a mano è il
  //  posto in cui prima o poi una di quelle righe manca. Il sintomo sarebbe una
  //  lettera che sparisce mentre si compila un campo.
  useScorciatoie(
    {
      //  Maiusc si legge SUBITO e non dentro l'aggiornamento dello stato:
      //  quella funzione viene eseguita più tardi, e leggere lì un tasto
      //  premuto un istante fa è il genere di dettaglio che funziona finché
      //  non funziona più.
      //  ⚠️ OGNI TASTO CHE PARLA DI GIORNI SPEGNE ANCHE LO STORICO. Sono i
      //  comandi di una giornata: dentro «tutto lo storico» una freccia che
      //  cambia lo scarto senza cambiare niente a schermo è un comando rotto,
      //  e "O torna a oggi" premuto stando su oggi non tornerebbe da nessuna
      //  parte. Spegnere e basta è anche la risposta giusta: chi preme una
      //  freccia sta chiedendo un giorno.
      ArrowLeft: (e) => {
        const mese = e.shiftKey;
        setScarto((s) => (mese ? scartoDelMeseVicino(s, -1) : Math.max(-LIMITE_GIORNI, s - 1)));
        setStorico(false);
      },
      ArrowRight: (e) => {
        const mese = e.shiftKey;
        setScarto((s) => (mese ? scartoDelMeseVicino(s, 1) : Math.min(LIMITE_GIORNI, s + 1)));
        setStorico(false);
      },
      o: () => {
        setScarto(0);
        setStorico(false);
      },
      "/": () => cercaRef.current?.focus(),
      "?": () => setAiuto((v) => !v),
      Escape: () => {
        setCerca("");
        setSoloArretrato(null);
        setAiuto(false);
      },
    },
    //  Con una scheda aperta i tasti appartengono a quella.
    { bloccato: editOpen || installOpen || quickOpen },
  );

  //  "mercoledì 13 agosto": in italiano mesi e giorni restano minuscoli, quindi
  //  si alza solo la prima lettera (la classe CSS "capitalize" le alzerebbe tutte).
  const dataEstesa = (() => {
    const s = new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  /** ── QUANDO NON C'È UN APPUNTAMENTO ────────────────────────────────────
   *  Il riquadro "Adesso" non può restare vuoto: uno spazio bianco in cima
   *  alla pagina fa pensare che manchi qualcosa. Al posto del prossimo
   *  appuntamento si mette il primo passo che ha davvero senso in questo
   *  momento, nell'ordine in cui costa di più rimandarlo. */
  const passo = (() => {
    if (prossimo) return null;
    //  Prima di tutto il resto: un appuntamento di OGGI rimasto senza data
    //  nuova. È l'unico lavoro che scade nella giornata in corso — domani
    //  diventa arretrato, e da lì rientra molto meno.
    if (daRifissareOggi)
      return {
        testo: `${daRifissareOggi} ${daRifissareOggi === 1 ? "appuntamento di oggi aspetta" : "appuntamenti di oggi aspettano"} una data nuova.`,
        azione: "Vai alla giornata",
        dove: "agenda",
      };
    if (arretrati.length)
      return {
        testo: `${arretrati.length} da recuperare: appuntamenti senza esito, assenti, da rifissare.`,
        azione: "Vai all'arretrato",
        dove: "recuperare",
      };
    if (ricontattiOggi.length)
      return {
        testo: `${ricontattiOggi.length} ${ricontattiOggi.length === 1 ? "persona da ricontattare" : "persone da ricontattare"} oggi.`,
        azione: "Vai ai ricontatti",
        dove: "ricontatti",
      };
    if (installazioniOggi.length)
      return {
        testo: `${installazioniOggi.length} ${installazioniOggi.length === 1 ? "installazione" : "installazioni"} da seguire oggi.`,
        azione: "Vai alle installazioni",
        dove: "installazioni",
      };
    if (daProgrammare.length)
      return {
        testo: `${daProgrammare.length} ${daProgrammare.length === 1 ? "cliente aspetta" : "clienti aspettano"} la data di posa.`,
        azione: "Programma le pose",
        dove: "installazioni",
      };
    return null;
  })();

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-16 md:p-6">
      {/* ── INTESTAZIONE ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">{dataEstesa}</h1>
          {/*  Sotto la data si parla SOLO di oggi: l'arretrato ha il suo
               riquadro, e sommarlo qui faceva sembrare enorme una giornata
               che enorme non è.
               Il badge dice quanto pesa la giornata prima ancora di leggere il
               numero: verde c'è margine (fino a 6), arancione è piena (7–11),
               rosso si sfora (da 12). Le soglie e il perché stanno in
               caricoGiornata (crm/ui) e nel banner dell'agenda.
               Quello che il badge NON fa più è commentare la giornata: la frase
               «giornata sovraccarica: conviene spostare qualcosa» è stata tolta
               da qui e da crm/ui. Chi guarda questa pagina la mattina sa già
               quanto lavoro ha; il colore informa, il consiglio infastidiva. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
            <BadgeCarico
              n={appuntamentiOggi.length}
              titolo={`${appuntamentiOggi.length} appuntamenti oggi`}
            />
            <span>
              {appuntamentiOggi.length === 0
                ? "Nessun appuntamento oggi"
                : `${appuntamentiOggi.length === 1 ? "appuntamento" : "appuntamenti"} oggi · ${
                    imminenti.length > 0
                      ? `${imminenti.length} da fare`
                      : //  "Tutti chiusi" con tre appuntamenti da rifissare era
                        //  falso: chiusi non lo erano, avevano solo perso l'ora.
                        daRifissareOggi > 0
                        ? `${daRifissareOggi} da rifissare`
                        : "tutti chiusi"
                  }`}
            </span>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={cercaRef}
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              placeholder="Cerca nome o telefono"
              aria-label="Cerca fra le trattative"
              className="h-9 pl-8 text-[13px]"
            />
          </div>
          {/*  Il nome per esteso solo dove c'è spazio: a 375px l'etichetta
              intera rubava metà riga alla ricerca. */}
          <Button size="sm" className="h-9 shrink-0" onClick={nuovoLead} title="Nuovo lead">
            <Plus className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Nuovo lead</span>
            <span className="sm:hidden">Nuovo</span>
          </Button>
        </div>
      </header>

      {/* ── CHI SEGUE COSA ───────────────────────────────────────────────────
          Un filtro solo per tutta la pagina: agenda, arretrati e code.
          ⚠️ La soglia si conta sull'elenco già filtrato: con un consulente solo
          in mezzo a dieci collaboratori, «Tutti» più un nome sono due pulsanti
          che dicono la stessa cosa. */}
      {consulentiFiltro.length > 1 && (
        <div className="space-y-1.5">
          {/* ── SUL MONITOR: I NOMI TUTTI IN VISTA ─────────────────────────── */}
          <div className="hidden flex-wrap items-center gap-1.5 lg:flex">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Consulente
            </span>
            <Segmento attivo={!chi} onClick={() => setChi("")}>
              Tutti
            </Segmento>
            {consulentiFiltro.map((c) => (
              <Segmento
                key={c.id}
                attivo={chi === c.id}
                onClick={() => setChi(chi === c.id ? "" : c.id)}
              >
                {c.data.nome}
              </Segmento>
            ))}
          </div>

          {/* ── SUL TELEFONO: UN PULSANTE SOLO ──────────────────────────────
              ⚠️ È IL PEZZO CHE STA SOPRA «ADESSO», ed è per questo che va
              stretto. Con sei collaboratori la fila di nomi diventa due o tre
              righe, e spinge sotto la piega dello schermo l'unica cosa che
              questa pagina esiste per mostrare: il prossimo appuntamento. Le
              tre righe non servivano nemmeno a scegliere — la scelta si fa una
              volta al giorno, il prossimo appuntamento si guarda venti volte.
              ⚠️ Il nome scelto è SCRITTO SUL PULSANTE, non nascosto dentro:
              un filtro che restringe l'agenda, gli arretrati e le code senza
              dire su chi è acceso fa lavorare, senza accorgersene, sui
              contatti di un collega. */}
          <button
            type="button"
            onClick={() => setFoglioChi(true)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition lg:hidden",
              chi
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {chi
              ? (consulentiFiltro.find((c) => c.id === chi)?.data.nome ?? "Consulente")
              : "Tutti i consulenti"}
          </button>

          {foglioChi && (
            <Finestra
              aperta={foglioChi}
              onCambio={setFoglioChi}
              icona={Users}
              titolo="Chi segue cosa"
              contesto="Vale per l'agenda, gli arretrati e le code"
              larghezza="sm"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Segmento
                  attivo={!chi}
                  onClick={() => {
                    setChi("");
                    setFoglioChi(false);
                  }}
                >
                  Tutti
                </Segmento>
                {consulentiFiltro.map((c) => (
                  <Segmento
                    key={c.id}
                    attivo={chi === c.id}
                    onClick={() => {
                      setChi(chi === c.id ? "" : c.id);
                      setFoglioChi(false);
                    }}
                  >
                    {c.data.nome}
                  </Segmento>
                ))}
              </div>
              <NotaSoloConsulenti ripiego={ripiegoConsulenti} className="mt-2" />
            </Finestra>
          )}

          <NotaSoloConsulenti ripiego={ripiegoConsulenti} className="hidden lg:block" />
        </div>
      )}

      {/* ── 1. ADESSO ────────────────────────────────────────────────────────
          La sola cosa che non può aspettare, e l'unica in evidenza. */}
      <div id="adesso" className="scroll-mt-16">
        {prossimo ? (
          <SchedaAdesso
            lead={prossimo.l}
            attesa={attesaDi(prossimo.m, adesso)}
            prossimi={dopo}
            onApri={apriLead}
            onStato={cambiaStato}
            nomeConsulente={nomeConsulente}
          />
        ) : (
          <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-4">
            {/*  Il segno di spunta verde vuol dire una cosa sola: non c'è più
                niente da fare. Se qualcosa c'è ancora — arretrato, ricontatti,
                pose senza data — il verde è una rassicurazione falsa, e si
                chiude la pagina con il lavoro dentro. In quel caso il cerchio è
                arancione, come tutto il resto che "manca un passaggio". */}
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                passo ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
              }`}
            >
              {passo ? (
                <History className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight">
                {appuntamentiOggi.length === 0
                  ? "Oggi non ci sono appuntamenti"
                  : daRifissareOggi > 0
                    ? "Nessuna consulenza da fare adesso"
                    : "Gli appuntamenti di oggi sono tutti chiusi"}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {passo?.testo ?? "Niente in sospeso. Buona giornata."}
              </p>
            </div>
            {passo && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full shrink-0 sm:w-auto"
                onClick={() => vaiA(passo.dove)}
              >
                {passo.azione}
              </Button>
            )}
          </section>
        )}
      </div>

      {/* ── 2. LA CODA DI OGGI, IN UNA RIGA ──────────────────────────────────
          Cinque numeri e un colpo d'occhio: premuti, portano al blocco giusto.
          Serve a sapere cosa resta senza scorrere la pagina fino in fondo. */}
      <nav className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {/*  Ogni riquadro dice anche SU QUALE PERIODO è calcolato: "Da
            recuperare 14" letto accanto a quattro numeri di oggi si leggeva
            come "quattordici da recuperare oggi", e faceva sembrare la giornata
            il doppio di quello che è. */}
        <Salto
          etichetta="Da fare oggi"
          nota="Oggi"
          n={imminenti.length}
          tono="urgente"
          titolo={`${imminenti.length} appuntamenti di oggi ancora da fare`}
          //  ⚠️ ANCHE QUESTO È UN COMANDO CHE PARLA DI GIORNI, quindi spegne lo
          //  storico come le frecce e il tasto O. Il riquadro promette «oggi» e
          //  conta gli appuntamenti di oggi: senza queste due righe portava
          //  dritto a un'agenda intitolata «Tutto lo storico», con dentro
          //  duecento righe di sette mesi e un conteggio che non c'entrava
          //  niente con il numero appena premuto.
          onClick={() => {
            setScarto(0);
            setStorico(false);
            vaiA("agenda");
          }}
        />
        <Salto
          etichetta="Da recuperare"
          nota="All time"
          n={arretrati.length}
          tono="arretrato"
          titolo={`${arretrati.length} contatti rimasti indietro, di tutti i giorni passati`}
          onClick={() => vaiA("recuperare")}
        />
        <Salto
          etichetta="Ricontatti"
          nota="Oggi"
          n={ricontattiOggi.length}
          titolo={`${ricontattiOggi.length} persone da ricontattare oggi`}
          onClick={() => vaiA("ricontatti")}
        />
        <Salto
          etichetta="In sede"
          nota="Tutti"
          n={inSede.length}
          titolo={`${inSede.length} clienti attesi in sede, oggi e nei prossimi giorni`}
          onClick={() => vaiA("sede")}
        />
        <Salto
          etichetta="Installazioni"
          nota="Oggi + pose"
          n={installazioniOggi.length + daProgrammare.length}
          titolo={`${installazioniOggi.length} installazioni oggi · ${daProgrammare.length} pose ancora da programmare`}
          onClick={() => vaiA("installazioni")}
        />
      </nav>

      <CapiHealthAlert />

      {/* ── 3. LA GIORNATA ───────────────────────────────────────────────────
          L'agenda vera e propria: la barra del giorno (chiusa mostra oggi, un
          tocco apre il mese intero), i totali cliccabili, i tre gruppi. Riceve
          il filtro consulente e il giorno dall'alto, così le frecce della
          tastiera — e Maiusc+frecce per il mese — muovono questa. */}
      <div id="agenda" className="scroll-mt-16 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          {/*  ⚠️ IL TITOLO SEGUE QUELLO CHE C'È SOTTO. «La giornata» scritto
            sopra sette mesi di appuntamenti è la bugia più in vista della
            pagina: è la riga più grande della sezione, si legge prima di
            qualsiasi cosa e nessuno la rilegge dopo aver acceso lo storico. */}
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            {storico ? "Tutto lo storico" : "La giornata"}
          </h2>
          {/*  Il promemoria dei tasti sta dove servono. Prima era una riga di
              testo fissa che ne elencava tre e nascondeva le altre: adesso è il
              pannello comune del CRM, aperto anche da "?". */}
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              ← → cambia giorno · Maiusc mese · O torna a oggi
            </span>
            <AiutoScorciatoie voci={SCORCIATOIE} aperto={aiuto} onCambia={setAiuto} />
          </div>
        </div>
        <MeetGiornalieri
          leads={cercati}
          consulenti={consultants}
          onApri={apriLead}
          onEvidenzia={(l) => void updateLead(l.id, { highlighted: !l.data.highlighted })}
          onStato={cambiaStato}
          nomeConsulente={nomeConsulente}
          consulenteId={chi}
          onConsulenteId={setChi}
          scarto={scarto}
          onScarto={setScarto}
          adesso={adesso}
          storico={storico}
          onStorico={setStorico}
        />
      </div>

      {/* ── 4. DA RECUPERARE ─────────────────────────────────────────────── */}
      <Sezione
        id="recuperare"
        titolo="Da recuperare"
        icona={History}
        tinta="text-amber-600"
        conteggio={arretrati.length}
        accento={arretrati.length > 0 ? "arretrato" : undefined}
        nota={
          arretrati.length > 0
            ? "Appuntamenti dei giorni scorsi rimasti senza esito, clienti assenti e appuntamenti da rifissare. Le righe arancioni non sono perse: manca solo una data nuova, e il calendario a sinistra della riga la mette."
            : undefined
        }
        azione={
          arretrati.length > MAX_ARRETRATI ? (
            <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
              <Link to="/CRM/trattative">Apri l'elenco trattative</Link>
            </Button>
          ) : undefined
        }
      >
        {arretrati.length === 0 ? (
          <VuotoRiga testo="Niente da recuperare. Tutti gli appuntamenti hanno un esito." />
        ) : (
          <>
            {/*  Filtri per motivo: le code restano distinguibili con un tocco.
                ⚠️ SUL TELEFONO NON VANNO A CAPO: scorrono di lato. Andando a
                 capo diventano due o tre righe di intestazione sopra un elenco
                 che spesso ha tre righe — cioè più cornice che contenuto, e il
                 recupero degli arretrati è proprio la sezione che si smette di
                 guardare per prima quando costa fatica. Sul monitor restano
                 come sono, dove ci stanno su una riga sola. */}
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-x-visible [&::-webkit-scrollbar]:hidden">
              <Segmento
                attivo={!soloArretrato}
                conteggio={arretrati.length}
                onClick={() => setSoloArretrato(null)}
              >
                Tutti
              </Segmento>
              {(Object.keys(ETICHETTA_ARRETRATO) as TipoArretrato[])
                .filter((t) => contiArretrato[t] > 0)
                .map((t) => (
                  <Segmento
                    key={t}
                    attivo={soloArretrato === t}
                    conteggio={contiArretrato[t]}
                    onClick={() => setSoloArretrato(soloArretrato === t ? null : t)}
                  >
                    {ETICHETTA_ARRETRATO[t]}
                  </Segmento>
                ))}
            </div>
            {arretratiVisti.length === 0 && <VuotoRiga testo="Nessuna riga con questo motivo." />}
            <Elenco>
              {arretratiVisti.slice(0, MAX_ARRETRATI).map(({ l, tipo, quando }) => (
                <RigaLead
                  key={l.id}
                  lead={l}
                  onApri={apriLead}
                  onEvidenzia={(x) => void updateLead(x.id, { highlighted: !x.data.highlighted })}
                  onStato={cambiaStato}
                  nomeConsulente={nomeConsulente}
                  //  ── DOVE VA LA DATA, E PERCHÉ NON SEMPRE NELLA COLONNA ──
                  //   Su "Esito da segnare" e "Cliente assente" la data è quella
                  //   del fatto avvenuto: sta incolonnata a sinistra, che è come
                  //   si scorre un elenco di recupero (prima i giorni vicini).
                  //   Su "Da riprogrammare" invece la data vecchia è lo slot
                  //   saltato, non un appuntamento ancora in piedi: messa nella
                  //   colonna faceva credere che ci fosse una data, e teneva
                  //   occupato il posto dell'icona del calendario — cioè
                  //   dell'unico gesto che serve su quella riga. Lì la data
                  //   scende accanto al motivo e la colonna diventa il pulsante.
                  quando={tipo === "riprogrammare" ? undefined : giornoBreve(quando)}
                  motivo={
                    tipo === "riprogrammare" && quando
                      ? `${ETICHETTA_ARRETRATO[tipo]} · ${giornoBreve(quando)}`
                      : ETICHETTA_ARRETRATO[tipo]
                  }
                />
              ))}
            </Elenco>
            {arretratiVisti.length > MAX_ARRETRATI && (
              <p className="px-3 py-2 text-[11.5px] text-muted-foreground">
                Mostrati i {MAX_ARRETRATI} più recenti di {arretratiVisti.length}.{" "}
                <Link to="/CRM/trattative" className="font-medium text-primary hover:underline">
                  Vedi tutte nell'elenco
                </Link>
              </p>
            )}
          </>
        )}
      </Sezione>

      {/* ── 5. LE ALTRE CODE ─────────────────────────────────────────────── */}
      <Sezione
        id="ricontatti"
        titolo="Da ricontattare oggi"
        icona={PhoneCall}
        tinta="text-indigo-600"
        conteggio={ricontattiOggi.length}
      >
        {ricontattiOggi.length === 0 ? (
          <VuotoRiga testo="Nessun ricontatto in programma per oggi." />
        ) : (
          <Elenco>
            {ricontattiOggi.map((l) => (
              <RigaLead
                key={l.id}
                lead={l}
                onApri={apriLead}
                onEvidenzia={(x) => void updateLead(x.id, { highlighted: !x.data.highlighted })}
                onStato={cambiaStato}
                nomeConsulente={nomeConsulente}
                quando={l.data.oraRicontatto || "—"}
                esiti={false}
                //  Il promemoria parla di un appuntamento: si mostra solo se ce
                //  n'è uno, altrimenti manderebbe un messaggio che non sta in piedi.
                promemoria={!!l.data.dataMeeting}
                principale={null}
              />
            ))}
          </Elenco>
        )}
      </Sezione>

      <Sezione
        id="sede"
        titolo="Appuntamento in sede"
        icona={MapPin}
        tinta="text-indigo-600"
        conteggio={inSede.length}
      >
        {inSede.length === 0 ? (
          <VuotoRiga testo="Nessun appuntamento in sede." />
        ) : (
          <Elenco>
            {inSede.map((l) => (
              <RigaLead
                key={l.id}
                lead={l}
                onApri={apriLead}
                onEvidenzia={(x) => void updateLead(x.id, { highlighted: !x.data.highlighted })}
                onStato={cambiaStato}
                nomeConsulente={nomeConsulente}
                quando={
                  soloGiorno(l.data.dataVieneInSede) === oggi
                    ? "oggi"
                    : giornoBreve(l.data.dataVieneInSede)
                }
                motivo={l.data.oraVieneInSede ? `ore ${l.data.oraVieneInSede}` : undefined}
                esiti={false}
                principale={null}
              />
            ))}
          </Elenco>
        )}
      </Sezione>

      {/* ── INSTALLAZIONI ────────────────────────────────────────────────────
          Due code diverse ma dello stesso lavoro: quelle di oggi da seguire e
          quelle pagate che aspettano una data. Vicine, perché chi guarda l'una
          guarda anche l'altra. */}
      <Sezione
        id="installazioni"
        titolo="Installazioni di oggi"
        icona={Wrench}
        tinta="text-sky-600"
        conteggio={installazioniOggi.length}
        azione={
          <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
            <Link to="/CRM/installazioni/oggi">Apri la pagina</Link>
          </Button>
        }
      >
        {installazioniOggi.length === 0 ? (
          <VuotoRiga testo="Nessuna installazione programmata per oggi." />
        ) : (
          <Elenco>
            {installazioniOggi.map((l) => {
              const inst = l.data.installazione;
              const tecnico =
                consultants.find((c) => c.id === inst?.consulenteInstallazioneId)?.data.nome ||
                inst?.tecnicoAssegnato ||
                "Installatore da assegnare";
              return (
                <RigaLead
                  key={l.id}
                  lead={l}
                  onApri={apriLead}
                  onEvidenzia={(x) => void updateLead(x.id, { highlighted: !x.data.highlighted })}
                  onStato={cambiaStato}
                  nomeConsulente={nomeConsulente}
                  quando={inst?.orarioInstallazione || "—"}
                  motivo={`${tecnico}${inst?.durataInstallazione ? ` · ${inst.durataInstallazione} min` : ""}`}
                  esiti={false}
                  principale={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 text-[11.5px]"
                      onClick={() => apriInstallazione(l)}
                    >
                      Modifica
                    </Button>
                  }
                />
              );
            })}
          </Elenco>
        )}
      </Sezione>

      <Sezione
        titolo="Installazioni da programmare"
        icona={Wrench}
        tinta="text-amber-600"
        conteggio={daProgrammare.length}
        nota={daProgrammare.length > 0 ? "Hanno pagato l'acconto e aspettano una data." : undefined}
      >
        {daProgrammare.length === 0 ? (
          <VuotoRiga testo="Tutte le installazioni pagate hanno una data." />
        ) : (
          <Elenco>
            {daProgrammare.map((l) => (
              <RigaLead
                key={l.id}
                lead={l}
                onApri={apriLead}
                onEvidenzia={(x) => void updateLead(x.id, { highlighted: !x.data.highlighted })}
                onStato={cambiaStato}
                nomeConsulente={nomeConsulente}
                motivo={`Acconto € ${l.data.payment?.accontoPagato || 0}`}
                esiti={false}
                principale={
                  <Button
                    size="sm"
                    className="h-8 shrink-0 text-[11.5px]"
                    onClick={() => apriInstallazione(l)}
                  >
                    Programma
                  </Button>
                }
              />
            ))}
          </Elenco>
        )}
      </Sezione>

      {/* ── 6. ANDAMENTO ─────────────────────────────────────────────────────
          I numeri stanno in fondo: si guardano una volta al giorno, mentre
          quello che c'è sopra si guarda venti volte. Prima erano in cima e
          spingevano il lavoro sotto la piega dello schermo. */}
      <div className="space-y-3 pt-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Andamento
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Totale etichetta="Trattative" valore={leads.length} to="/CRM/trattative" icona={Users} />
          <Totale
            etichetta="Appuntamenti oggi"
            valore={leads.filter((l) => soloGiorno(l.data.dataMeeting) === oggi).length}
            to="/CRM/agenda"
            icona={CalendarDays}
          />
          <Totale
            etichetta="Venduti e acconti"
            /*  ⚠️ Contava a mano "venduto" e "acconto", cioè i due stati vinti
                di ieri. Le vendite di oggi portano una delle tre chiusure e da
                qui erano invisibili: il riquadro della dashboard restava fermo
                mentre la pagina dei numeri saliva, e due schermate che contano
                le stesse vendite in modo diverso fanno perdere fiducia a
                entrambe. `eChiusuraVinta` è l'elenco unico di types.ts. */
            valore={leads.filter((l) => eChiusuraVinta(l.data.stato)).length}
            to="/CRM/avanzamento"
            icona={Wrench}
          />
          <Totale
            //  Il numero è tutta l'anagrafica — consulenti, setter, driver,
            //  installatori, accompagnatori — e portava il nome di uno solo dei
            //  cinque: adesso dice quello della sezione che apre.
            etichetta="Collaboratori"
            valore={consultants.length}
            to="/CRM/consulenti"
            icona={Users}
          />
        </div>
        <HealthGlobalSection />
      </div>

      <LeadDialog open={editOpen} onOpenChange={setEditOpen} lead={editing} />
      <InstallationScheduleDialog
        lead={installLead}
        open={installOpen}
        onOpenChange={setInstallOpen}
      />
      <QuickStatusDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        lead={quickLead}
        newStatus={quickStato}
      />
      {chiusura.finestra}
    </div>
  );
}

/** Numero della coda: dice quanto resta e porta al blocco che lo contiene. */
function Salto({
  etichetta,
  n,
  nota,
  tono,
  titolo,
  onClick,
}: {
  etichetta: string;
  n: number;
  /** Riga sotto l'etichetta: dice su QUALE periodo è calcolato il numero.
   *  Senza, "Da recuperare" si legge come "da recuperare oggi". */
  nota?: string;
  tono?: "urgente" | "arretrato";
  /** La frase per esteso: due parole e un numero non bastano a chi arriva
   *  adesso, e con il lettore di schermo il riquadro leggerebbe "14 Da
   *  recuperare All time" e nient'altro. */
  titolo?: string;
  onClick: () => void;
}) {
  const vuoto = n === 0;
  //  Le stesse due famiglie di colore usate ovunque nel CRM: cielo = da fare
  //  adesso, ambra = manca un passaggio. Quando la coda è vuota il riquadro si
  //  spegne, così i colori restano un segnale e non una decorazione fissa.
  const colore = vuoto
    ? "border-border bg-card text-muted-foreground"
    : tono === "urgente"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : tono === "arretrato"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-border bg-card text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      title={titolo}
      aria-label={titolo ?? `${n} ${etichetta}`}
      className={`rounded-xl border px-2.5 py-2 text-left transition hover:brightness-95 ${colore}`}
    >
      <div className="text-[19px] font-semibold leading-none tabular-nums">{n}</div>
      <div className="mt-1 truncate text-[11px] font-medium opacity-80">{etichetta}</div>
      {nota ? (
        <div className="truncate text-[10px] font-medium uppercase tracking-wide opacity-55">
          {nota}
        </div>
      ) : null}
    </button>
  );
}

/** Totale di riepilogo: sempre cliccabile, perché un numero senza il suo
 *  elenco costringe a cercarlo a mano nella pagina giusta. */
function Totale({
  etichetta,
  valore,
  to,
  icona: Icona,
}: {
  etichetta: string;
  valore: number;
  to: string;
  icona: typeof Users;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-border bg-card px-3 py-2.5 transition hover:border-foreground/25"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icona className="h-3.5 w-3.5" />
        <span className="truncate">{etichetta}</span>
      </div>
      <div className="mt-1 text-[19px] font-semibold leading-tight tabular-nums">{valore}</div>
    </Link>
  );
}
