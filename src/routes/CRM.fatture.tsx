/** ── FATTURE ───────────────────────────────────────────────────────────────
 *
 *  Tre cose in una pagina: i dati del centro (si scrivono una volta), le bozze
 *  in attesa di un incasso, e le fatture emesse da scaricare.
 *
 *  ── ⚠️ COSA SI SCARICA, E QUALE DEI DUE FILE CONTA ────────────────────────
 *  Di ogni fattura escono due file, e non sono equivalenti:
 *   · l'XML è LA FATTURA — è quello che il commercialista importa e che passa
 *     dallo SDI;
 *   · il PDF è la copia leggibile, per il cliente e per controllare i numeri.
 *  Mandare al commercialista il solo PDF vuol dire non avergli mandato niente,
 *  e la pagina lo dice dove si preme, non in una nota in fondo.
 *
 *  ⚠️ E QUESTA PAGINA NON TRASMETTE ALLO SDI. Nessuna schermata di questo CRM
 *   lo fa: serve un canale accreditato. Qui si compone, si numera e si scarica.
 *
 *  ── LA SELEZIONE È QUELLA DI SEMPRE ───────────────────────────────────────
 *  Clic sulla riga, Maiusc+clic per il blocco, «Seleziona tutte» in barra: è
 *  `useSelezioneRighe`, lo stesso dei lead importati e di «Da fare oggi». Un
 *  terzo modo di selezionare in un terzo posto è come si perde l'abitudine.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Download,
  FileCheck2,
  FilePlus2,
  FileCode2,
  FileText,
  Receipt,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BarraAzioni,
  BarraSelezione,
  Kpi,
  KpiRiga,
  Pagina,
  Scheda,
  Segmento,
  SepBarra,
  Titolo,
  Vuoto,
  eur,
} from "@/crm/ui";
import { CLASSE_CAMPO, Finestra } from "@/crm/ui/Finestra";
import { useCRM } from "@/crm/CRMContext";
import type { Lead } from "@/crm/types";
import { FinestraIncassoFattura } from "@/crm/fatture/FinestraIncassoFattura";
import { RigaSelezionabile, testoSelezionaTutti, useSelezioneRighe } from "@/crm/importa/selezione";
import {
  eUltimaDellaSerie,
  eliminaBozza,
  rimettiInBozza,
  puoTornareInBozza,
  etichettaNumero,
  salvaEmessa,
  leggiAzienda,
  leggiBozze,
  leggiEmesse,
  mancanzeAzienda,
  salvaAzienda,
  emetti,
} from "@/crm/fatture/archivio";
import { costruisciXml, nomeFileXml, problemiXml } from "@/crm/fatture/xml";
import { FinestraAltraFattura } from "@/crm/fatture/FinestraAltraFattura";
import { costruisciDocumento, nomeCliente } from "@/crm/fatture/documento";
import { scaricaInFila, scaricaXml } from "@/crm/fatture/scarica";
import { AZIENDA_VUOTA, REGIMI, type DatiAzienda, type Fattura } from "@/crm/fatture/tipi";

export const Route = createFileRoute("/CRM/fatture")({ component: FatturePage });

const dataBreve = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
};

/** Apre il foglio leggibile in una finestra di stampa. Stessa tecnica del
 *  riepilogo di consegna: da lì «Salva come PDF». */
function apriDocumento(f: Fattura, a: DatiAzienda, logo: string) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Il browser ha bloccato la finestra di stampa", {
      description: "Consenti le finestre a comparsa per questo sito e riprova.",
    });
    return;
  }
  w.document.write(costruisciDocumento(f, a, logo));
  w.document.close();
}

function FatturePage() {
  const { leads } = useCRM();
  const [azienda, setAzienda] = useState<DatiAzienda>(AZIENDA_VUOTA);
  const [bozze, setBozze] = useState<Fattura[]>([]);
  const [emesse, setEmesse] = useState<Fattura[]>([]);
  const [caricando, setCaricando] = useState(true);
  /** Il marchio in cima alla fattura. Vuoto = esce il nome scritto, mai
   *  un'immagine rotta. */
  const [logo, setLogo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [apriDati, setApriDati] = useState(false);
  const [lente, setLente] = useState<"emesse" | "bozze">("emesse");
  const [avanzamento, setAvanzamento] = useState<{ fatti: number; totale: number } | null>(null);
  /** ⚠️ IL CESTINO C'È SU TUTTE E DUE, E FA DUE COSE DIVERSE. Su una bozza
   *   cancella; su una fattura emessa la RIMETTE IN BOZZA con dentro gli stessi
   *   dati (vedi `rimettiInBozza`), perché il motivo per cui si elimina una
   *   fattura è quasi sempre che è sbagliata, e buttare le venti cose giuste
   *   insieme a quella storta vuol dire ribatterle — a partire dal codice
   *   fiscale, che ribattuto fa scartare il documento dallo SDI.
   *  ⚠️ Quello che il cestino NON disfa resta il numero: tolto da metà serie
   *   lascia un buco che il commercialista dovrà spiegare, e se il documento
   *   era già allo SDI si annulla con una nota di credito, non di qui. La
   *   finestra di conferma dice quale dei casi è. */
  /** La fattura emessa che aspetta di essere segnata incassata. */
  const [daIncassare, setDaIncassare] = useState<Fattura | null>(null);
  /** ⚠️ UN ELENCO E NON UNA SOLA. Il cestino di riga ne mette dentro una, la
   *  barra della selezione ne mette dentro venti: una seconda finestra per il
   *  gruppo avrebbe voluto dire due conferme da tenere allineate, e quella che
   *  spiega meno sarebbe stata proprio quella che cancella di più. */
  const [daButtare, setDaButtare] = useState<Fattura[]>([]);
  /** La fattura da cui si sta facendo la successiva per lo stesso cliente. */
  const [daRifare, setDaRifare] = useState<Fattura | null>(null);
  /** L'emissione in blocco chiede una data sola: quella dell'incasso. */
  const [daEmettere, setDaEmettere] = useState<Fattura[]>([]);
  const [giornoBlocco, setGiornoBlocco] = useState(() => new Date().toISOString().slice(0, 10));
  const [buttando, setButtando] = useState(false);

  const ricarica = useCallback(async () => {
    setCaricando(true);
    const [a, e, b] = await Promise.all([leggiAzienda(), leggiEmesse(), leggiBozze()]);
    setAzienda(a);
    if (e.ok) setEmesse(e.lista);
    if (b.ok) setBozze(b.lista);
    setCaricando(false);
    //  ⚠️ I dati del centro si aprono DA SOLI se mancano: senza di quelli non si
    //   emette niente, e una pagina che mostra un elenco vuoto senza dire perché
    //   fa cercare il problema altrove.
    if (mancanzeAzienda(a).length > 0) setApriDati(true);
  }, []);

  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  useEffect(() => {
    //  Stessa fonte del logo dell'app e del riepilogo di consegna
    //  (shop/BrandLogo, crm/ricevuta): cambiando il marchio dalle impostazioni
    //  cambia anche la fattura, senza che nessuno debba ricordarsi di passare
    //  di qui. Se non risponde, la fattura esce col nome del centro scritto.
    fetch("/api/presenter/brand")
      .then((r) => r.json())
      .then((j) => setLogo(String(j?.logoUrl || "")))
      .catch(() => setLogo(""));
  }, []);

  /** ── ⚠️ RAGGRUPPATE PER CLIENTE ─────────────────────────────────────────
   *  Richiesta del committente: le fatture di uno stesso cliente devono stare
   *  insieme. Con la seconda e la terza fattura verso la stessa persona un
   *  elenco per data le sparpaglia — «quante gliene ho fatte, e per quanto?»
   *  diventa una domanda a cui si risponde scorrendo.
   *
   *  ⚠️ LA CHIAVE È IL CODICE FISCALE, poi la partita IVA, poi il nome. L'id
   *   della scheda NON basta: le fatture nate dal preventivo non ce l'hanno
   *   (là la scheda non esisteva ancora), e raggruppando per quello lo stesso
   *   cliente si sdoppierebbe proprio nel caso che questa funzione esiste per
   *   risolvere. Il nome è l'ultimo ripiego: due omonimi finirebbero insieme,
   *   ma senza codice fiscale né partita IVA non c'è modo di distinguerli, e
   *   sbagliare accorpando due omonimi costa meno che sdoppiare tutti.
   *
   *  ⚠️ L'ORDINE DENTRO IL GRUPPO È PER DATA, dalla più recente: dentro un
   *   cliente si cerca «l'ultima che gli ho fatto». Fra i gruppi comanda la
   *   fattura più recente del gruppo, così chi ha fatturato ieri sta in cima —
   *   ordinare i gruppi per nome avrebbe messo in cima gli Abate per sempre.
   *
   *  ⚠️ E QUESTO È L'ORDINE CHE VEDE LA SELEZIONE. `useSelezioneRighe` calcola
   *   «da qui a lì» sull'elenco che riceve: passandogli l'elenco non
   *   raggruppato, Maiusc+clic avrebbe preso righe diverse da quelle in mezzo
   *   sullo schermo. */
  const righe = useMemo(() => {
    const base = lente === "emesse" ? emesse : bozze;
    const chiaveCliente = (f: Fattura) =>
      (f.cliente.codiceFiscale || "").trim().toUpperCase() ||
      (f.cliente.partitaIva || "").trim() ||
      nomeCliente(f).toLowerCase();
    //  La data su cui si ordina: quella del documento, o la creazione per le
    //  bozze — che una data non ce l'hanno ancora.
    const quando = (f: Fattura) => f.data || f.creataIl || "";
    const gruppi = new Map<string, Fattura[]>();
    for (const f of base) {
      const k = chiaveCliente(f);
      const g = gruppi.get(k);
      if (g) g.push(f);
      else gruppi.set(k, [f]);
    }
    return [...gruppi.values()]
      .map((g) => [...g].sort((a, b) => quando(b).localeCompare(quando(a))))
      .sort((a, b) => quando(b[0]).localeCompare(quando(a[0])))
      .flat();
  }, [lente, emesse, bozze]);
  //  L'elenco vuole un `id`, e le fatture ce l'hanno: la selezione è la stessa
  //  dei lead importati (vedi la nota in cima).
  const {
    selezione,
    selezionati,
    quante,
    tuttiSelezionati,
    tettoStretto,
    scegli,
    selezionaTutti,
    azzera,
    tieniSolo,
  } = useSelezioneRighe(righe);

  /** ── LA SCHEDA DIETRO UNA FATTURA ──────────────────────────────────────
   *  Due strade, e servono tutte e due: una fattura nata dal CRM porta l'id
   *  della scheda, una nata dal preventivo no — là la scheda non esisteva
   *  ancora — e si riconosce dall'email.
   *  ⚠️ Può non trovarla, e va bene: l'incasso si registra lo stesso e lo stato
   *   resta da mettere a mano. Un pulsante che si rifiuta di funzionare perché
   *   manca un collegamento è peggio di mezzo lavoro fatto. */
  const schedaDi = useCallback(
    (f: Fattura): Lead | null => {
      const tutti = Array.isArray(leads) ? leads : [];
      const perId = tutti.find((l) => l.id === f.leadId);
      if (perId) return perId;
      const email = String(f.emailOrigine ?? "").toLowerCase();
      if (!email) return null;
      return tutti.find((l) => String(l.data?.email ?? "").toLowerCase() === email) ?? null;
    },
    [leads],
  );

  const totaleEmesso = useMemo(() => emesse.reduce((t, f) => t + f.totale, 0), [emesse]);
  /** Quante fatture emesse aspettano ancora il bonifico: è il numero che dice
   *  quanto lavoro di riconciliazione c'è. */
  const daRiscuotere = useMemo(() => emesse.filter((f) => !f.dataPagamento).length, [emesse]);
  const mancanze = mancanzeAzienda(azienda);

  const salvaDati = async () => {
    setSalvando(true);
    /* ── ⚠️ SI RIPULISCE PRIMA DI SALVARE ────────────────────────────────
       Un numero copiato da un PDF — una visura, tipicamente — arriva con
       attaccati dei caratteri INVISIBILI: U+202D e U+202C, i segni con cui il
       testo dichiara la propria direzione. A schermo il campo è perfetto, in
       archivio la partita IVA è «\u202D18486531009\u202C», e ogni controllo
       che la guardi con un `/^\d{11}$/` dice di no su un dato giusto.
       Il file XML se li perdeva per strada (vedi `latino` in fatture/xml), ma
       l'archivio se li teneva, e con lui tutti gli altri usi di quel numero.
       Si tolgono qui, una volta, nel momento in cui il dato entra. */
    const grezzo = { ...azienda } as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(grezzo)) {
      if (typeof v === "string") {
        grezzo[k] = v
          //  Via i segni di direzione, gli spazi unificatori e ogni altro
          //  carattere di controllo: non si vedono e non servono a niente.
          .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
          .replace(/\u00A0/g, " ")
          .trim();
      }
    }
    const pulito = grezzo as unknown as DatiAzienda;
    setAzienda(pulito);
    const errore = await salvaAzienda(pulito);
    setSalvando(false);
    if (errore) {
      toast.error("Dati NON salvati", { description: errore });
      return;
    }
    toast.success("Dati dell'azienda salvati");
    if (mancanzeAzienda(azienda).length === 0) setApriDati(false);
  };

  /** ── ELIMINARE, UNA O VENTI ────────────────────────────────────────────
   *  ⚠️ UNA SCRITTURA PER FATTURA, e non c'è modo di farne una sola: ogni
   *   fattura è una riga a sé in archivio (vedi crm/fatture/archivio). Venti
   *   eliminazioni sono venti richieste, quindi si va con il contatore acceso —
   *   un'operazione lunga che parte muta è indistinguibile da una pagina
   *   bloccata.
   *  ⚠️ QUELLO CHE FALLISCE RESTA SELEZIONATO. Chi è stato eliminato esce
   *   dall'elenco da solo al ricarico; chi ha dato errore resta scelto e sotto
   *   gli occhi, pronto per un secondo tentativo. Toglierli tutti dalla
   *   selezione dopo un errore vorrebbe dire nascondere proprio le righe su cui
   *   bisogna tornare. */
  const buttaBozza = async () => {
    if (daButtare.length === 0 || buttando) return;
    setButtando(true);
    const falliti: Fattura[] = [];
    /** Il primo errore vero incontrato: è quello che si mostra. */
    let motivo = "";
    let fatti = 0;
    if (daButtare.length > 1) setAvanzamento({ fatti: 0, totale: daButtare.length });
    for (const f of daButtare) {
      //  Due archivi diversi: una bozza vive sotto la chiave del cliente, una
      //  emessa sotto il suo numero. Sbagliare chiave qui vorrebbe dire dire
      //  «eliminata» e non eliminare niente.
      //  ⚠️ E UNA EMESSA NON SPARISCE: torna bozza, con dentro gli stessi dati
      //   (vedi `rimettiInBozza`). Il gesto si chiama ancora «elimina» perché
      //   è quello che fa alla contabilità — il numero se ne va davvero — ma
      //   il lavoro raccolto resta.
      const errore = f.stato === "emessa" ? await rimettiInBozza(f) : await eliminaBozza(f.leadId);
      if (errore) {
        falliti.push(f);
        //  ⚠️ IL PRIMO MOTIVO VERO, non un «riprova» buono per tutto. Il
        //   fallimento più probabile qui è «c'è già una bozza aperta per questo
        //   cliente», e riprovare non lo risolve: bisogna andare a toglierla.
        //   Un messaggio che invita a ripetere un gesto che non può riuscire è
        //   peggio di nessun messaggio.
        if (!motivo) motivo = errore;
      }
      fatti += 1;
      if (daButtare.length > 1) setAvanzamento({ fatti, totale: daButtare.length });
    }
    setButtando(false);
    setAvanzamento(null);
    const riusciti = daButtare.length - falliti.length;

    if (falliti.length > 0) {
      //  ⚠️ La finestra RESTA APERTA se qualcosa non è andato: chiuderla
      //   lascerebbe righe ancora lì con l'aria di essere state eliminate, e il
      //   secondo tentativo non lo farebbe nessuno.
      setDaButtare(falliti);
      tieniSolo(falliti.map((f) => f.id));
      toast.error(
        riusciti > 0
          ? `Eliminate ${riusciti}, ${falliti.length} no`
          : daButtare.length === 1
            ? daButtare[0].stato === "emessa"
              ? "Fattura NON eliminata"
              : "Bozza NON eliminata"
            : "Nessuna è stata eliminata",
        {
          description: motivo
            ? `${motivo.charAt(0).toUpperCase()}${motivo.slice(1)}.`
            : "Quelle rimaste sono ancora selezionate: riprova.",
        },
      );
      void ricarica();
      return;
    }

    const era = daButtare;
    setDaButtare([]);
    azzera();
    /*  ── DOVE SONO FINITE ───────────────────────────────────────────────
        ⚠️ Una fattura emessa non sparisce più: torna bozza. Ed è un fatto che
         chi ha premuto DEVE portarsi via, perché cambia il posto in cui
         cercarla — la riga esce da «Emesse» e ricompare sotto «Bozze».
         Un messaggio che dicesse solo «eliminata» sarebbe falso due volte:
         farebbe credere perso il lavoro raccolto, e manderebbe a ricompilare
         da capo una bozza che è già lì. Il pulsante accanto ci porta, invece
         di lasciare che la si cerchi. */
    const tornate = era.filter((f) => f.stato === "emessa" && puoTornareInBozza(f));
    const vaiAlleBozze =
      tornate.length > 0
        ? { label: "Vai alle bozze", onClick: () => setLente("bozze") }
        : undefined;

    if (era.length === 1) {
      const f = era[0];
      const tornata = tornate.length === 1;
      toast.success(
        f.stato !== "emessa"
          ? "Bozza eliminata"
          : tornata
            ? `Fattura ${etichettaNumero(f)} rimessa in bozza`
            : `Fattura ${etichettaNumero(f)} eliminata`,
        {
          //  Due cose distinte, e quando valgono entrambe si dicono tutte e
          //  due: dove sono finiti i dati, e cosa ne è stato del numero.
          description:
            [
              tornata ? "I dati restano tutti: cliente, importo, causale." : null,
              f.stato === "emessa" && eUltimaDellaSerie(f, emesse)
                ? `Il numero ${f.numero} è tornato libero: lo prenderà la prossima.`
                : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          action: vaiAlleBozze,
        },
      );
    } else {
      toast.success(
        tornate.length === era.length
          ? `${era.length} fatture rimesse in bozza`
          : tornate.length > 0
            ? `Eliminate ${era.length} fatture, ${tornate.length} tornate in bozza`
            : `Eliminate ${era.length} fatture`,
        { action: vaiAlleBozze },
      );
    }
    void ricarica();
  };

  /** ── EMETTERE IN BLOCCO ─────────────────────────────────────────────────
   *  ⚠️ CHIEDE UNA DATA SOLA, ed è il compromesso che rende utile il gesto:
   *   emettendone venti una per una la finestra chiederebbe venti volte data,
   *   acconto-o-saldo e modo di consegna — cioè non lo userebbe nessuno. Qui si
   *   emette e basta, con la data dell'incasso valida per tutte.
   *  ⚠️ E QUINDI NON TOCCA LO STATO DEI CLIENTI. La finestra singola lo fa
   *   (è la sua ragione d'essere); questa no, e la conferma lo dice: chi
   *   emette venti fatture insieme sta mettendo in ordine la contabilità, non
   *   registrando venti consegne.
   *  ⚠️ UNA PER VOLTA E NON IN PARALLELO: il numero di fattura si assegna
   *   leggendo l'ultimo presente in archivio (vedi `prossimoNumeroSu`). Venti
   *   emissioni contemporanee leggerebbero tutte lo stesso ultimo numero e ne
   *   scriverebbero venti con lo stesso, cioè una serie con dei duplicati. */
  const emettiInBlocco = async () => {
    if (daEmettere.length === 0 || buttando) return;
    setButtando(true);
    const falliti: Fattura[] = [];
    let fatti = 0;
    setAvanzamento({ fatti: 0, totale: daEmettere.length });
    for (const f of daEmettere) {
      const esito = await emetti(f, azienda, giornoBlocco);
      if (!esito.ok) falliti.push(f);
      fatti += 1;
      setAvanzamento({ fatti, totale: daEmettere.length });
    }
    setButtando(false);
    setAvanzamento(null);
    const riusciti = daEmettere.length - falliti.length;
    setDaEmettere([]);
    if (falliti.length > 0) {
      tieniSolo(falliti.map((f) => f.id));
      toast.error(`Emesse ${riusciti}, ${falliti.length} no`, {
        description: "Quelle rimaste sono ancora selezionate: riprova.",
      });
    } else {
      azzera();
      toast.success(`${riusciti} ${riusciti === 1 ? "fattura emessa" : "fatture emesse"}`, {
        description: "Hanno preso numero e data. Lo stato dei clienti non è stato toccato.",
      });
    }
    void ricarica();
  };

  /** ── ⚠️ IL FILE SI CONTROLLA PRIMA DI CONSEGNARLO ──────────────────────
   *  Un XML sbagliato non si vede: è valido come testo, si scarica, si manda
   *  al commercialista, lui lo carica, e lo scarto torna giorni dopo con un
   *  codice numerico che non dice quale campo. Nel frattempo quella fattura
   *  risulta emessa e non è arrivata a nessuno.
   *  Qui si guarda prima (`problemiXml`) e ci si ferma con davanti il nome del
   *  campo da riempire. ⚠️ Non si corregge niente da soli: un codice fiscale
   *   sbagliato non si indovina, e riempire un campo obbligatorio a caso
   *   produce una fattura giusta per il tracciato e falsa per il fisco. */
  const scaricaXmlDi = (f: Fattura) => {
    const { bloccanti, avvisi } = problemiXml(f, azienda);
    if (bloccanti.length > 0) {
      toast.error(
        `Questa fattura verrebbe scartata: ${bloccanti.length === 1 ? "manca un dato" : `mancano ${bloccanti.length} dati`}`,
        {
          description: bloccanti.join(" · "),
          duration: 12000,
        },
      );
      return;
    }
    //  Gli avvisi non fermano niente: il file è valido, si dicono e si va.
    if (avvisi.length > 0) toast.warning(avvisi.join(" · "), { duration: 9000 });
    scaricaXml(nomeFileXml(f, azienda), costruisciXml(f, azienda));
  };

  const scaricaTutti = async () => {
    const scelte = selezionati.filter((f) => f.stato === "emessa");
    if (scelte.length === 0) {
      toast.error("Le bozze non si scaricano", {
        description: "Non hanno numero né data: prima si emettono.",
      });
      return;
    }
    //  ⚠️ QUELLE CHE VERREBBERO SCARTATE RESTANO INDIETRO, e si dice quante.
    //   Scaricarle insieme alle buone vorrebbe dire consegnarne trenta al
    //   commercialista e scoprire due settimane dopo che tre non sono mai
    //   entrate — con in mano trenta ricevute di consegna e nessun modo di
    //   sapere quali. Meglio ventisette file e una riga che dice «tre no, e
    //   perché».
    const buone = scelte.filter((f) => problemiXml(f, azienda).bloccanti.length === 0);
    const scartate = scelte.length - buone.length;
    if (buone.length === 0) {
      toast.error("Nessuna di queste fatture si può consegnare", {
        description: "A tutte manca un dato obbligatorio: aprile una per una per vedere quale.",
        duration: 10000,
      });
      return;
    }
    //  ⚠️ SI AVVISA PRIMA. Il browser, al secondo file, chiede il permesso per i
    //   download multipli: senza una riga che lo annunci sembra che ne siano
    //   arrivati due su trenta senza motivo.
    toast.info(`Sto scaricando ${buone.length} file`, {
      description:
        (scartate > 0
          ? `${scartate} ${scartate === 1 ? "fattura è rimasta indietro" : "fatture sono rimaste indietro"}: manca un dato obbligatorio e verrebbero scartate. `
          : "") + "Se il browser chiede il permesso per i download multipli, dagli l'ok.",
      duration: scartate > 0 ? 12000 : 6000,
    });
    await scaricaInFila(
      buone.map((f) => ({
        nome: nomeFileXml(f, azienda),
        contenuto: costruisciXml(f, azienda),
        tipo: "application/xml",
      })),
      (fatti, totale) => setAvanzamento({ fatti, totale }),
    );
    setAvanzamento(null);
    azzera();
  };

  const campo = (
    etichetta: string,
    chiave: keyof DatiAzienda,
    opzioni?: { nota?: string; larga?: boolean; numero?: boolean; maiuscolo?: boolean },
  ) => (
    <label className={cn("block space-y-1", opzioni?.larga && "sm:col-span-2")}>
      <span className="block text-[12px] font-medium text-foreground">{etichetta}</span>
      <Input
        value={String(azienda[chiave] ?? "")}
        onChange={(e) => {
          const v = opzioni?.maiuscolo ? e.target.value.toUpperCase() : e.target.value;
          setAzienda((a) => ({ ...a, [chiave]: opzioni?.numero ? Number(v) || 0 : v }));
        }}
        inputMode={opzioni?.numero ? "decimal" : undefined}
        className={CLASSE_CAMPO}
      />
      {opzioni?.nota && (
        <span className="block text-[11px] leading-snug text-muted-foreground">{opzioni.nota}</span>
      )}
    </label>
  );

  /** ── COSA SUCCEDE DAVVERO A QUELLE CHE STO PER ELIMINARE ────────────────
   *  Quattro mucchi, perché il gesto ha quattro esiti diversi e la conferma
   *  deve dire quello giusto. ⚠️ SI CALCOLANO PRIMA DI PREMERE, non dopo: una
   *  conferma che scopre a cose fatte di non aver potuto eliminare niente è
   *  esattamente la finestra che nessuno legge più.
   *   · bozzeDaButtare  → spariscono davvero, non c'è niente da recuperare
   *   · tornanoInBozza  → emesse che si ritroveranno fra le bozze, compilate
   *   · senzaScheda     → emesse senza cliente a cui agganciare la bozza: una
   *                       bozza vive sotto la chiave della scheda, e senza
   *                       quella non c'è dove posarla (vedi `rimettiInBozza`)
   *   · postoOccupato   → emesse il cui cliente ha GIÀ una bozza aperta: di
   *                       bozze per cliente ce n'è una sola, e sovrascriverla
   *                       cancellerebbe in silenzio il lavoro di qualcun
   *                       altro. Quindi non si elimina, e si dice prima. */
  const bozzeDaButtare = daButtare.filter((f) => f.stato !== "emessa");
  const emesseDaButtare = daButtare.filter((f) => f.stato === "emessa");
  const senzaScheda = emesseDaButtare.filter((f) => !puoTornareInBozza(f));
  const postoOccupato = emesseDaButtare.filter(
    (f) => puoTornareInBozza(f) && bozze.some((b) => b.leadId === f.leadId),
  );
  const tornanoInBozza = emesseDaButtare.filter(
    (f) => puoTornareInBozza(f) && !bozze.some((b) => b.leadId === f.leadId),
  );

  return (
    <Pagina>
      <Titolo
        testo="Fatture"
        icona={Receipt}
        nota={`${emesse.length} emesse · ${bozze.length} in bozza`}
      />

      <KpiRiga colonne={4}>
        <Kpi etichetta="Emesse" valore={emesse.length} icona={Receipt} nota="Con numero e data" />
        <Kpi
          etichetta="In bozza"
          valore={bozze.length}
          tono={bozze.length > 0 ? "in_sospeso" : "neutro"}
          nota="Pronte: si emettono con «Emetti»"
        />
        <Kpi
          etichetta="Da riscuotere"
          valore={daRiscuotere}
          tono={daRiscuotere > 0 ? "in_sospeso" : "neutro"}
          //  ⚠️ Esiste perché adesso si può fatturare PRIMA di incassare: una
          //   fattura emessa senza la data del pagamento è un bonifico che non è
          //   ancora arrivato, e senza un numero a schermo quel conto lo tiene
          //   solo chi se lo ricorda.
          nota="Emesse, in attesa del bonifico"
        />
        <Kpi etichetta="Fatturato" valore={eur(totaleEmesso)} nota="Totale delle emesse" />
      </KpiRiga>

      {/* ── I DATI DEL CENTRO ─────────────────────────────────────────────
          Si scrivono una volta e finiscono su ogni fattura. La scheda si apre
          da sola finché manca qualcosa: è l'unico modo di non far scoprire il
          buco quando si sta emettendo, col cliente che aspetta. */}
      <Scheda
        titolo="Dati dell'azienda"
        nota={
          mancanze.length > 0
            ? `Manca ${mancanze.join(", ")}`
            : "Finiscono su ogni fattura, insieme alla numerazione"
        }
        icona={Building2}
        azioni={
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            onClick={() => setApriDati((v) => !v)}
          >
            {apriDati ? "Chiudi" : "Apri"}
          </Button>
        }
      >
        {apriDati && (
          <div className="space-y-3">
            {mancanze.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Finché mancano questi dati non si può emettere niente: sono i campi che lo SDI
                  rifiuta di sicuro. La correttezza fiscale della prima fattura vera vale la pena
                  fartela confermare dal commercialista.
                </span>
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {campo("Ragione sociale", "denominazione", { larga: true })}
              {campo("Partita IVA", "partitaIva")}
              {campo("Codice fiscale", "codiceFiscale", {
                nota: "Per le società coincide con la partita IVA",
                maiuscolo: true,
              })}
              {campo("Indirizzo", "indirizzo")}
              {campo("Numero civico", "civico")}
              {campo("CAP", "cap")}
              {campo("Comune", "comune")}
              {campo("Provincia", "provincia", { nota: "Sigla, es. MI", maiuscolo: true })}
              <label className="block space-y-1">
                <span className="block text-[12px] font-medium text-foreground">
                  Regime fiscale
                </span>
                <select
                  value={azienda.regimeFiscale}
                  onChange={(e) => setAzienda((a) => ({ ...a, regimeFiscale: e.target.value }))}
                  className={cn(CLASSE_CAMPO, "h-9 w-full")}
                >
                  {REGIMI.map((r) => (
                    <option key={r.codice} value={r.codice}>
                      {r.codice} · {r.nome}
                    </option>
                  ))}
                </select>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  Una S.r.l.s. è ordinario (RF01)
                </span>
              </label>
              {campo("Aliquota IVA", "aliquotaPredefinita", {
                numero: true,
                nota: "In percentuale. 0 se le operazioni non sono soggette",
              })}
              {campo("Ufficio REA", "reaUfficio", {
                nota: "Sigla provincia, es. MI",
                maiuscolo: true,
              })}
              {campo("Numero REA", "reaNumero")}
              {/*  ⚠️ CAPITALE SOCIALE E COMPAGINE NON SI CHIEDONO PIÙ: erano due
                  campi facoltativi del tracciato e sono stati tolti dalla
                  fattura. Il valore eventualmente salvato in passato resta in
                  archivio e non lo legge più nessuno. */}
              {campo("PEC", "pec", {
                larga: true,
                nota: "Il recapito del centro: finisce fra i contatti dell'emittente e sul foglio leggibile",
              })}
              {campo("IBAN", "iban", { larga: true, maiuscolo: true })}
              {campo("Primo numero libero", "primoNumero", {
                numero: true,
                nota: "Da qui parte la numerazione: mettici il primo numero che il commercialista non ha già usato",
              })}
              {campo("Anno della numerazione", "annoNumerazione", { numero: true })}
              {campo("Sezionale", "serie", {
                nota: "Vuoto se la numerazione è unica",
                maiuscolo: true,
              })}
            </div>
            <Button onClick={() => void salvaDati()} disabled={salvando} className="h-9">
              <Save className="mr-1.5 h-4 w-4" />
              {salvando ? "Salvo…" : "Salva i dati"}
            </Button>
          </div>
        )}
      </Scheda>

      <BarraAzioni>
        <Segmento
          attivo={lente === "emesse"}
          conteggio={emesse.length}
          onClick={() => setLente("emesse")}
        >
          Emesse
        </Segmento>
        <Segmento
          attivo={lente === "bozze"}
          conteggio={bozze.length}
          onClick={() => setLente("bozze")}
        >
          In bozza
        </Segmento>
        {righe.length > 0 && (
          <>
            <SepBarra />
            <Segmento attivo={tuttiSelezionati} onClick={selezionaTutti}>
              {testoSelezionaTutti(tuttiSelezionati, tettoStretto, quante)}
            </Segmento>
          </>
        )}
      </BarraAzioni>

      {caricando ? (
        <p className="px-1 text-[12px] text-muted-foreground">Sto leggendo le fatture…</p>
      ) : righe.length === 0 ? (
        <Vuoto
          titolo={lente === "emesse" ? "Nessuna fattura emessa" : "Nessuna bozza"}
          icona={Receipt}
          testo={
            lente === "emesse"
              ? "Le fatture si compongono dalla scheda del cliente, con «Fattura». Restano in bozza finché non incassi: allora si emettono e prendono numero e data."
              : "Una bozza si prepara dalla scheda del cliente, anche prima dell'incasso: porta già dentro cliente, importo e causale."
          }
        />
      ) : (
        <Scheda senzaPadding>
          <ul className="divide-y divide-border">
            {righe.map((f, i) => {
              /*  ── L'INTESTAZIONE DEL GRUPPO ────────────────────────────
                  Compare solo quando il cliente CAMBIA rispetto alla riga di
                  sopra: l'elenco è già ordinato per gruppi (vedi `righe`),
                  quindi basta guardare la riga precedente invece di ricostruire
                  una struttura ad albero — e le righe restano una lista piatta,
                  che è quello che la selezione a blocchi si aspetta.
                  ⚠️ Compare SOLO se quel cliente ha più di una fattura: sopra
                   un cliente con una fattura sola sarebbe una riga di
                   intestazione per una riga di contenuto, cioè un elenco
                   lungo il doppio che non raggruppa niente. */
              const stesso = (a: Fattura, b: Fattura) =>
                ((a.cliente.codiceFiscale || "").trim().toUpperCase() ||
                  (a.cliente.partitaIva || "").trim() ||
                  nomeCliente(a).toLowerCase()) ===
                ((b.cliente.codiceFiscale || "").trim().toUpperCase() ||
                  (b.cliente.partitaIva || "").trim() ||
                  nomeCliente(b).toLowerCase());
              const primo = i === 0 || !stesso(righe[i - 1], f);
              const delGruppo = righe.filter((x) => stesso(x, f));
              const intestazione = primo && delGruppo.length > 1;
              return (
                <Fragment key={f.id}>
                  {intestazione && (
                    <li className="flex items-baseline justify-between gap-2 bg-muted/40 px-4 py-1.5">
                      <span className="truncate text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {nomeCliente(f)}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">
                        {delGruppo.length} fatture ·{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {eur(delGruppo.reduce((t, x) => t + x.totale, 0))}
                        </span>
                      </span>
                    </li>
                  )}
                  <RigaSelezionabile
                    scelta={selezione.has(f.id)}
                    etichetta={`fattura di ${nomeCliente(f)}`}
                    onScegli={(blocco) => scegli(f.id, blocco)}
                    azioni={
                      <div className="flex shrink-0 items-center gap-1">
                        {/*  ── DA BOZZA A FATTURA ──────────────────────────────
                        La bozza si emette da qui, e la finestra chiede prima le
                        tre cose che servono: quando è arrivato il pagamento, se
                        ha saldato tutto o solo una parte, e come gli arriva
                        l'impianto. Da lì lo stato del cliente si aggiorna da sé.
                        ⚠️ È LA STESSA FINESTRA dell'incasso, non una gemella:
                         le domande sono identiche, e due finestre uguali
                         divergono al primo ritocco — il giorno in cui una delle
                         due smette di aggiornare la scheda, quale sia dipende da
                         dove si è premuto. */}
                        {f.stato !== "emessa" && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-[11.5px]"
                            onClick={() => setDaIncassare(f)}
                            title="Assegna numero e data, e aggiorna la scheda del cliente"
                          >
                            <FileCheck2 className="mr-1 h-3.5 w-3.5" /> Emetti
                          </Button>
                        )}
                        {/*  ── È ARRIVATO IL BONIFICO ───────────────────────────
                        Solo sulle emesse che aspettano ancora i soldi: quelle
                        nate dal preventivo, fatturate prima dell'incasso. */}
                        {f.stato === "emessa" && !f.dataPagamento && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-[11.5px]"
                            onClick={() => setDaIncassare(f)}
                            title="Registra quando è arrivato il pagamento"
                          >
                            <CalendarClock className="mr-1 h-3.5 w-3.5" /> Incassa
                          </Button>
                        )}
                        {/*  ⚠️ L'XML PRIMA, e con l'etichetta che dice cos'è: è LA
                        fattura. Il PDF accanto è la copia leggibile, e chi
                        manda solo quello al commercialista non gli ha mandato
                        niente. */}
                        {f.stato === "emessa" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11.5px]"
                            onClick={() => scaricaXmlDi(f)}
                            title="Il file per il commercialista: è questo che vale"
                          >
                            <FileCode2 className="mr-1 h-3.5 w-3.5" /> XML
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11.5px]"
                          onClick={() => apriDocumento(f, azienda, logo)}
                          title="La copia leggibile, da stampare o salvare in PDF"
                        >
                          <FileText className="mr-1 h-3.5 w-3.5" /> PDF
                        </Button>
                        {/*  ⚠️ IL CESTINO C'È ANCHE SULLE EMESSE, su richiesta del
                        committente. Non sono la stessa cosa e la conferma lo
                        dice: una bozza non esiste per nessuno, una fattura
                        emessa ha un numero dentro una serie. A riposo resta
                        grigio come gli altri comandi — il rosso è della
                        conferma, non dell'icona: un elenco con dieci icone
                        rosse è un elenco in cui il rosso non vuol più dire
                        niente. */}
                        {/*  ── UN'ALTRA PER QUESTO CLIENTE ──────────────────────
                        Richiesta del committente: da qui si fa la seconda
                        fattura verso quel cliente, e premendo di nuovo la
                        terza. Parte da questa riga e non dalla scheda perché
                        i dati del cliente sono già tutti qui — e ricompilarli
                        è l'occasione per scriverne uno diverso dal primo.
                        Icona sola: è un comando che si usa poche volte, e su
                        una riga già piena di pulsanti una parola in più
                        toglierebbe spazio a quelli di tutti i giorni. */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => setDaRifare(f)}
                          title={`Fai un'altra fattura per ${nomeCliente(f)}`}
                          aria-label={`Un'altra fattura per ${nomeCliente(f)}`}
                        >
                          <FilePlus2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0 text-muted-foreground hover:border-rose-300 hover:text-rose-600"
                          onClick={() => setDaButtare([f])}
                          title={
                            f.stato === "emessa" ? "Elimina questa fattura" : "Elimina questa bozza"
                          }
                          aria-label={`Elimina ${f.stato === "emessa" ? "la fattura" : "la bozza"} di ${nomeCliente(f)}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    }
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold">{nomeCliente(f)}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold",
                            f.stato === "emessa"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-amber-500/10 text-amber-700",
                          )}
                        >
                          {f.stato === "emessa" ? etichettaNumero(f) : "bozza"}
                        </span>
                        {f.tipo === "acconto" && (
                          <span
                            className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            title="Al saldo questo imponibile è già fatturato: non va rifatturato"
                          >
                            acconto
                          </span>
                        )}
                      </span>
                      <span className="truncate text-[11.5px] text-muted-foreground">
                        {f.stato === "emessa" ? dataBreve(f.data) : "senza numero"} ·{" "}
                        {eur(f.totale)} ·{" "}
                        {f.stato === "emessa" && (
                          <>
                            {f.dataPagamento ? (
                              <span className="text-emerald-700">
                                incassata il {dataBreve(f.dataPagamento)}
                              </span>
                            ) : (
                              //  ⚠️ In ambra e per esteso: potendo fatturare prima
                              //   di incassare, «in attesa del bonifico» va distinto
                              //   a colpo d'occhio da una fattura già pagata.
                              <span className="text-amber-700">in attesa del bonifico</span>
                            )}{" "}
                            ·{" "}
                          </>
                        )}
                        {f.causale}
                      </span>
                    </span>
                  </RigaSelezionabile>
                </Fragment>
              );
            })}
          </ul>
        </Scheda>
      )}

      {daIncassare && (
        <FinestraIncassoFattura
          fattura={daIncassare}
          lead={schedaDi(daIncassare)}
          azienda={azienda}
          aperta={!!daIncassare}
          onCambio={(v) => {
            if (!v) setDaIncassare(null);
          }}
          onFatto={(f) => {
            //  ⚠️ DUE STRADE, E NON SI POSSONO CONFONDERE. Emettendo, la
            //   finestra ha GIÀ scritto la fattura e tolto la bozza: riscriverla
            //   qui la rimetterebbe in archivio una seconda volta con la stessa
            //   chiave — innocuo, ma direbbe una cosa falsa a chi legge il
            //   codice. Registrando un incasso su una fattura già emessa,
            //   invece, la riga va aggiornata: è l'unico modo perché quel
            //   «pagamento ricevuto il…» finisca sul foglio.
            if (daIncassare.stato !== "emessa") {
              toast.success(`Fattura ${f.anno}/${f.numero} emessa`, {
                description: "La trovi fra le emesse, con l'XML per il commercialista.",
              });
              void ricarica();
              return;
            }
            void salvaEmessa(f).then((errore) => {
              if (errore) toast.error("Incasso NON registrato", { description: errore });
              else toast.success("Incasso registrato");
              void ricarica();
            });
          }}
        />
      )}

      {/* ── LA CONFERMA ───────────────────────────────────────────────────
          ⚠️ NON C'È «ANNULLA» DOPO: una bozza eliminata non si ripesca da
           nessun cestino, quindi la domanda sta PRIMA — con il nome scritto
           dentro, perché in un elenco di righe alte trenta pixel quella su cui
           si è premuto e quella di sotto sono la stessa cosa.
          Il rosso è qui, non sull'icona della riga. */}
      {/* ── LA CONFERMA ───────────────────────────────────────────────────
          ⚠️ NON C'È «ANNULLA» DOPO: una fattura eliminata non si ripesca da
           nessun cestino, quindi la domanda sta PRIMA — con il nome scritto
           dentro, perché in un elenco di righe alte trenta pixel quella su cui
           si è premuto e quella di sotto sono la stessa cosa.
          ⚠️ È LA STESSA per una e per venti. Una seconda finestra per il
           gruppo avrebbe voluto dire due conferme da tenere allineate, e quella
           che spiega meno sarebbe stata proprio quella che cancella di più.
          Il rosso è qui, non sull'icona della riga. */}
      <Finestra
        aperta={daButtare.length > 0}
        onCambio={(v) => {
          if (!v) setDaButtare([]);
        }}
        larghezza="sm"
        bloccante
        icona={Trash2}
        titolo={
          daButtare.length > 1
            ? `Elimino ${daButtare.length} fatture?`
            : daButtare[0]?.stato === "emessa"
              ? "Elimino questa fattura?"
              : "Elimino questa bozza?"
        }
        contesto={
          daButtare.length > 1
            ? `${eur(daButtare.reduce((t, f) => t + f.totale, 0))} in tutto · ${
                daButtare.filter((f) => f.stato === "emessa").length
              } emesse, ${daButtare.filter((f) => f.stato !== "emessa").length} in bozza`
            : daButtare[0]
              ? `${nomeCliente(daButtare[0])} · ${eur(daButtare[0].totale)}${
                  daButtare[0].stato === "emessa" ? ` · n. ${etichettaNumero(daButtare[0])}` : ""
                }`
              : undefined
        }
        azioni={
          <>
            <Button variant="outline" onClick={() => setDaButtare([])} disabled={buttando}>
              Lascia stare
            </Button>
            {/*  ⚠️ SPENTO SE NON PUÒ RIUSCIRE: quando TUTTE quelle scelte hanno
                 già una bozza aperta, premere non eliminerebbe niente e
                 tornerebbe solo un errore. Un pulsante acceso che non fa
                 niente è peggio di uno spento che spiega perché. */}
            <Button
              onClick={() => void buttaBozza()}
              disabled={
                buttando || (daButtare.length > 0 && postoOccupato.length === daButtare.length)
              }
              className="bg-rose-600 hover:bg-rose-700 sm:min-w-32"
            >
              {buttando ? "Elimino…" : "Sì, elimina"}
            </Button>
          </>
        }
      >
        {/* ── CHE FINE FANNO I DATI ──────────────────────────────────────
            ⚠️ LA RISPOSTA NON È PIÙ UNA SOLA, da quando una fattura emessa
             torna bozza invece di sparire. Scrivere «sparisce e non si
             recupera» anche per quelle sarebbe la bugia che manda a ribattere
             un codice fiscale già scritto bene — e un codice fiscale ribattuto
             è un documento scartato dallo SDI giorni dopo. Le bozze invece
             spariscono per davvero, e continua a dirlo. */}
        {tornanoInBozza.length > 0 && (
          <p className="text-[13.5px] leading-relaxed text-slate-700">
            {tornanoInBozza.length > 1 ? (
              <>
                {tornanoInBozza.length} fatture tornano{" "}
                <strong className="text-slate-900">fra le bozze, già compilate</strong>
              </>
            ) : (
              <>
                La fattura torna{" "}
                <strong className="text-slate-900">fra le bozze, già compilata</strong>
              </>
            )}
            : stesso cliente, stessi importi, stessa causale. Non c&apos;è niente da riscrivere — si
            corregge quello che era sbagliato e si riemette.
          </p>
        )}

        {bozzeDaButtare.length > 0 && (
          <p
            className={cn(
              "text-[13.5px] leading-relaxed text-slate-700",
              tornanoInBozza.length > 0 && "mt-2",
            )}
          >
            {bozzeDaButtare.length > 1 ? "Le bozze spariscono" : "La bozza sparisce"} e non si{" "}
            {bozzeDaButtare.length > 1 ? "recuperano" : "recupera"}: i dati raccolti — codice
            fiscale, residenza, importo — andranno riscritti da capo.
          </p>
        )}

        {/* ── LE EMESSE CHE NON POSSONO TORNARE ──────────────────────────
            Una bozza vive sotto la chiave della scheda cliente: senza scheda
            non c'è dove posarla. Succede alle fatture nate fuori dal CRM, e
            chi preme deve saperlo PRIMA — per quelle il gesto è quello di una
            volta, irreversibile. */}
        {senzaScheda.length > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {senzaScheda.length > 1
                ? `${senzaScheda.length} di queste non hanno una scheda cliente`
                : "Questa fattura non ha una scheda cliente"}
              : la bozza non ha dove posarsi, quindi{" "}
              {senzaScheda.length > 1 ? "spariscono" : "sparisce"} davvero e i dati vanno riscritti
              da capo.
            </span>
          </p>
        )}

        {/* ── IL POSTO GIÀ OCCUPATO ──────────────────────────────────────
            ⚠️ DETTO PRIMA, NON DOPO. Di bozze per cliente ce n'è UNA: se c'è
             già un saldo in preparazione, rimettere qui questa fattura lo
             cancellerebbe in silenzio. `rimettiInBozza` si rifiuta di farlo —
             e una conferma che non lo dicesse manderebbe a premere un pulsante
             che non può riuscire. */}
        {postoOccupato.length > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {postoOccupato.length > 1
                ? `Per ${postoOccupato.length} di questi clienti c'è già una bozza aperta`
                : `Per ${nomeCliente(postoOccupato[0])} c'è già una bozza aperta`}
              : di bozze per cliente ce n&apos;è una sola, e questa non le passa sopra.{" "}
              <strong>
                {postoOccupato.length > 1 ? "Queste non vengono eliminate" : "Non viene eliminata"}
              </strong>
              : prima va emessa o buttata la bozza che c&apos;è già.
            </span>
          </p>
        )}

        {/* ── I NOMI, QUANDO SONO PIÙ DI UNA ─────────────────────────────
            ⚠️ Scritti per esteso e non contati: «22 fatture» non dice se
             dentro c'è quella giusta. Sopra le otto si tronca — un elenco più
             lungo della finestra non si legge — ma il numero delle altre resta
             scritto, perché sparire in silenzio è la cosa che questa riga
             esiste per impedire. */}
        {daButtare.length > 1 && (
          <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-600">
            {daButtare.slice(0, 8).map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-2">
                <span className="truncate">
                  {nomeCliente(f)}
                  {f.stato === "emessa" ? ` · n. ${etichettaNumero(f)}` : " · bozza"}
                </span>
                <span className="shrink-0 tabular-nums">{eur(f.totale)}</span>
              </li>
            ))}
            {daButtare.length > 8 && (
              <li className="pt-1 text-slate-500">e altre {daButtare.length - 8}</li>
            )}
          </ul>
        )}

        {/* ── COSA RESTA DOPO ────────────────────────────────────────────
            ⚠️ FRASI DIVERSE PER FATTI DIVERSI, e non è prolissità: una bozza
             non esiste per nessuno, l'ultima della serie libera il suo numero,
             una in mezzo lascia un buco che qualcuno dovrà spiegare. Una
             conferma che dice sempre la stessa cosa smette di essere letta
             proprio nel caso in cui contava. */}
        {daButtare.length === 1 &&
          (daButtare[0].stato !== "emessa" ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
              Nessun numero è stato assegnato, quindi in contabilità non resta niente e la
              numerazione non si tocca.
            </p>
          ) : eUltimaDellaSerie(daButtare[0], emesse) ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
              È l&apos;ultima della serie: il numero{" "}
              <strong className="text-slate-700">{daButtare[0].numero}</strong> torna libero e lo
              prenderà la prossima. Nella numerazione non resta nessun buco.
            </p>
          ) : (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Non è l&apos;ultima della serie: resterà un buco al numero{" "}
                <strong>{daButtare[0].numero}</strong>, e i buchi in una numerazione il
                commercialista li deve spiegare.
              </span>
            </p>
          ))}

        {/*  Nel gruppo il conto dei buchi si fa in una riga sola: elencare
            quali numeri restano scoperti fra venti fatture è un elenco che
            nessuno legge, e il fatto — «resteranno dei buchi» — è uno solo. */}
        {daButtare.length > 1 && daButtare.some((f) => f.stato === "emessa") && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Fra queste ci sono fatture già emesse: dove non sono le ultime della serie resteranno
              dei buchi nella numerazione, e i buchi il commercialista li deve spiegare.
            </span>
          </p>
        )}

        {/* ⚠️ La cosa che nessun pulsante di questa pagina può disfare. */}
        {daButtare.some((f) => f.stato === "emessa") && (
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
            E se {daButtare.length > 1 ? "erano" : "era"} già{" "}
            {daButtare.length > 1 ? "state trasmesse" : "stata trasmessa"} allo SDI, cancellarle qui{" "}
            <strong className="text-slate-700">non le disfa</strong>: esistono ancora
            all&apos;Agenzia e si annullano con una nota di credito. Qui si perde solo la nostra
            copia.
          </p>
        )}
      </Finestra>

      {/* ── EMETTERE IN BLOCCO: SERVE UNA DATA ────────────────────────────
          Una sola, valida per tutte. Vedi `emettiInBlocco` per il perché
          questa strada non chiede il resto e non tocca lo stato dei clienti. */}
      <Finestra
        aperta={daEmettere.length > 0}
        onCambio={(v) => {
          if (!v) setDaEmettere([]);
        }}
        larghezza="sm"
        bloccante
        icona={FileCheck2}
        titolo={`Emetto ${daEmettere.length} ${daEmettere.length === 1 ? "bozza" : "bozze"}?`}
        contesto={`${eur(daEmettere.reduce((t, f) => t + f.totale, 0))} in tutto`}
        azioni={
          <>
            <Button variant="outline" onClick={() => setDaEmettere([])} disabled={buttando}>
              Annulla
            </Button>
            <Button onClick={() => void emettiInBlocco()} disabled={buttando || !giornoBlocco}>
              {buttando ? "Emetto…" : "Sì, emetti"}
            </Button>
          </>
        }
      >
        <label className="block space-y-1">
          <span className="block text-[12px] font-medium text-foreground">
            Giorno dell&apos;incasso
          </span>
          <Input
            type="date"
            value={giornoBlocco}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setGiornoBlocco(e.target.value)}
          />
          <span className="block text-[11.5px] leading-snug text-muted-foreground">
            Diventa la data di tutte, e da qui esce l&apos;anno della numerazione.
          </span>
        </label>
        <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
          Prendono numero e data. Lo stato dei clienti non viene toccato: per quello c&apos;è
          «Emetti» sulla singola riga, che chiede anche come arriva l&apos;impianto.
        </p>
      </Finestra>

      {daRifare && (
        <FinestraAltraFattura
          origine={daRifare}
          azienda={azienda}
          aperta={!!daRifare}
          onCambio={(v) => {
            if (!v) setDaRifare(null);
          }}
          onFatta={() => {
            setDaRifare(null);
            void ricarica();
          }}
        />
      )}

      <BarraSelezione conteggio={selezionati.length} onAnnulla={azzera}>
        {avanzamento ? (
          //  Un lavoro lungo che parte muto è indistinguibile da una pagina
          //  bloccata: finché va avanti, la barra dice solo a che punto è.
          <span className="px-2 text-[12.5px] font-medium tabular-nums text-white/80">
            {avanzamento.fatti}/{avanzamento.totale}…
          </span>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12.5px] text-white hover:bg-white/10 hover:text-white"
              onClick={() => void scaricaTutti()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> XML
            </Button>
            {/*  ── EMETTI ──────────────────────────────────────────────────
                Compare solo se fra le selezionate c'è almeno una bozza: su
                venti fatture già emesse questo pulsante non avrebbe niente da
                fare, e un comando che a volte non fa niente è un comando di cui
                non ci si fida. Il numero fra parentesi dice su quante agirà —
                che non sono sempre tutte quelle selezionate. */}
            {selezionati.some((f) => f.stato !== "emessa") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-[12.5px] text-white hover:bg-white/10 hover:text-white"
                onClick={() => setDaEmettere(selezionati.filter((f) => f.stato !== "emessa"))}
              >
                <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                Emetti ({selezionati.filter((f) => f.stato !== "emessa").length})
              </Button>
            )}
            {/*  ⚠️ L'ELIMINA STA IN FONDO E IN ROSSO, staccato dagli altri due:
                è l'unico che non si può disfare, e il suo vicino di casa non
                deve essere un pulsante che si preme dieci volte al giorno. */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12.5px] text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
              onClick={() => setDaButtare(selezionati)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Elimina
            </Button>
          </>
        )}
      </BarraSelezione>
    </Pagina>
  );
}
