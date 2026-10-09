/** ── CONTABILITÀ ───────────────────────────────────────────────────────────
 *
 *  La sezione che si gira al commercialista.
 *
 *  ── ⚠️ PERCHÉ NON STA PIÙ DENTRO KPI ──────────────────────────────────────
 *  Ci è stata per qualche giorno ed era il posto sbagliato, per una ragione
 *  che si vede solo usandola: KPI si guarda a finestre mobili — «ultimi trenta
 *  giorni» — perché misura l'andamento della pubblicità, che col calendario non
 *  c'entra niente. La contabilità si guarda per MESE, TRIMESTRE, ANNO, perché
 *  l'IVA si liquida e le imposte si calcolano su periodi con un primo e un
 *  ultimo giorno stabiliti dalla legge. Due domande, due calendari: nella
 *  stessa pagina il periodo scelto in cima ne accontentava una sola, e un'IVA
 *  calcolata «sugli ultimi trenta giorni» non corrisponde a nessuna
 *  dichiarazione esistente.
 *
 *  ── COSA C'È DENTRO ───────────────────────────────────────────────────────
 *   1. il conto del periodo, riga per riga, con la stampa da consegnare;
 *   2. le fatture emesse, con gli XML da scaricare;
 *   3. le fatture dei fornitori, da caricare e da riscaricare;
 *   4. i costi che arrivano dal CRM, voce per voce, con la spunta «si scarica»;
 *   5. le spese fisse del mese;
 *   6. le aliquote.
 *
 *  ⚠️ È UN CONTO GESTIONALE, non una dichiarazione, e la pagina lo dice a voce
 *   alta. Il commercialista sa cose che questo programma non sa: acconti già
 *   versati, perdite riportate, ammortamenti, la base vera dell'IRAP. Quella
 *   scritta non si toglie per far sembrare il numero più autorevole.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookText,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  FileUp,
  Landmark,
  PackageCheck,
  Pencil,
  Printer,
  Receipt,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCRM } from "@/crm/CRMContext";
import { archivio, leggiAzienda, leggiEmesse } from "@/crm/fatture/archivio";
import { AZIENDA_VUOTA, type DatiAzienda, type Fattura } from "@/crm/fatture/tipi";
import { costruisciXml, nomeFileXml, problemiXml } from "@/crm/fatture/xml";
import { scaricaInFila, scaricaTesto, scaricaXml } from "@/crm/fatture/scarica";
import {
  ALIQUOTE_PREDEFINITE,
  calcolaContoFiscale,
  incassiSenzaIvaDi,
  type Aliquote,
  type CostoContabile,
} from "@/crm/contabilita";
import {
  DA_SEMPRE,
  chiaveVoce,
  conRegola,
  fineDelMese,
  meseCorrente,
  meseLeggibile,
  periodoLeggibile,
  senzaRegola,
  mesiToccatiDa,
  regolaOggi,
  vociConRegola,
  type RegoleContabili,
} from "@/crm/contabilita-regole";
import { costiDaiFornitori, costiDaiMesi, costiDallePratiche } from "@/crm/contabilita-raccolta";
import {
  eliminaAllegato,
  emessaDaNoi,
  intestataANoi,
  eliminaFornitore,
  leggiAllegato,
  leggiFornitori,
  leggiXmlFornitore,
  salvaFornitore,
  type FatturaFornitore,
} from "@/crm/contabilita-fornitori";
import { FinestraFornitore } from "@/crm/contabilita-FinestraFornitore";
import { FinestraCategoria } from "@/crm/contabilita-Categoria";
import { Autofatture } from "@/crm/contabilita-Autofatture";
import type { CategoriaSpesa } from "@/crm/contabilita-categorie";
import { Scadenzario } from "@/crm/contabilita-Scadenzario";
import { ProspettoF24 } from "@/crm/contabilita-ProspettoF24";
import { SostitutoImposta } from "@/crm/contabilita-SostitutoImposta";
import { LeveFiscali } from "@/crm/contabilita-LeveFiscali";
import { costruisciPacchetto } from "@/crm/contabilita-esporta";
import { DaSistemare } from "@/crm/contabilita-DaSistemare";
import { adempimento, regimeDi } from "@/crm/contabilita-regimi";
import {
  costruisciAutofattura,
  nomeFileAutofattura,
  problemiAutofattura,
} from "@/crm/contabilita-autofattura";
import { useLiquidazione } from "@/crm/contabilita-liquidazione";
import { CostiMese } from "@/crm/contabilita-CostiMese";
import { costruisciFoglio } from "@/crm/contabilita-foglio";
import { protocolli } from "@/crm/contabilita-registri";
import { costruisciRegistri } from "@/crm/contabilita-registri-foglio";
import { leggiCostiDiPiuMesi, type VoceMese } from "@/crm/costi-mese";
import {
  costruisciPeriodo,
  dentroIlPeriodo,
  inCorso,
  mesiDelPeriodo,
  periodoCorrente,
  periodoVicino,
  type Periodo,
  type TipoPeriodo,
} from "@/crm/contabilita-periodo";
import { leggiEuro, scriviEuro } from "@/crm/euro";
import { eConversione } from "@/crm/kpi-calcoli";
import type { VoceCosto } from "@/crm/types";
import {
  BarraAzioni,
  Pagina,
  Scheda,
  Segmento,
  SepBarra,
  Titolo,
  dataBreve,
  eur,
  useRicerca,
} from "@/crm/ui";
import { CampoFinestra, Finestra, NotaFinestra, SezioneFinestra } from "@/crm/ui/Finestra";

export const Route = createFileRoute("/CRM/contabilita")({
  head: () => ({ meta: [{ title: "Contabilità — CRM" }] }),
  component: PaginaContabilita,
});

const CHIAVE_REGOLE = "contabilita_voci";
const CHIAVE_ALIQUOTE = "contabilita_aliquote";
/** ── ⚠️ IL CREDITO IVA CHE ARRIVA DAL PERIODO PRIMA ───────────────────────
 *  Uno per periodo, perché è un dato di QUEL periodo e non una impostazione:
 *  riscriverlo cambierebbe una liquidazione già fatta. La chiave porta la data
 *  di inizio, che è l'unica cosa che identifica un periodo senza ambiguità
 *  («2026-04-01» è il secondo trimestre e anche aprile: il tipo sta nel
 *  suffisso). */
const chiaveCredito = (p: Periodo) => `contabilita_credito:${p.tipo}:${p.dal}`;

function PaginaContabilita() {
  const { leads } = useCRM();
  const ricerca = useRicerca();
  const [tipo, setTipo] = useState<TipoPeriodo>("trimestre");
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoCorrente("trimestre"));
  const [azienda, setAzienda] = useState<DatiAzienda>(AZIENDA_VUOTA);
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [fornitori, setFornitori] = useState<FatturaFornitore[]>([]);
  /** Le spese fisse dei mesi che il periodo tocca, per mese.
   *  ⚠️ TIPIZZATO PER DAVVERO e non con un `as never` di comodo: qui passano
   *   affitto, luce e abbonamenti, e una forma sbagliata non darebbe un errore —
   *   darebbe un elenco vuoto, cioè un utile più alto del vero senza che
   *   nessuno se ne accorga. */
  const [costiMese, setCostiMese] = useState<Record<string, VoceMese[]>>({});
  const [regole, setRegole] = useState<RegoleContabili>({});
  const [aliquote, setAliquote] = useState<Aliquote>(ALIQUOTE_PREDEFINITE);
  /** Il credito IVA riportato dal periodo precedente, come lo ha liquidato chi
   *  tiene i libri. Zero finché nessuno lo scrive. */
  const [creditoPrecedente, setCreditoPrecedente] = useState(0);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState("");
  const [avanzamento, setAvanzamento] = useState<{ fatti: number; totale: number } | null>(null);
  /** La voce su cui si sta cambiando la regola. */
  const [daRegolare, setDaRegolare] = useState<string | null>(null);
  const [apriAliquote, setApriAliquote] = useState(false);
  const [apriAMano, setApriAMano] = useState(false);
  //  ⚠️ Mensile o trimestrale NON si legge qui: sta in un posto solo
  //   (`crm/contabilita-liquidazione`), perché lo guardano anche il badge del
  //   menu e la striscia di «Da fare oggi». Tre letture separate volevano dire
  //   che cambiandola da qui gli altri due restavano indietro fino al
  //   ricaricamento — due date diverse per la stessa scadenza.
  const { regime: liquidazione, cambia: cambiaLiquidazione } = useLiquidazione();
  /** Il PDF appena scelto: la finestra si apre già piena di quello che ci ha
   *  letto dentro. */
  const [pdfDaLeggere, setPdfDaLeggere] = useState<File | null>(null);
  const [pacchetto, setPacchetto] = useState<{ fatti: number; totale: number } | null>(null);
  /** La fattura scritta a mano che si sta correggendo. */
  const [daCorreggere, setDaCorreggere] = useState<FatturaFornitore | null>(null);
  /** La riga PROPOSTA da «Registra la bolletta»: non è una correzione, è una
   *  riga nuova con dentro il mestiere già fatto. Vedi `proposta` in
   *  crm/contabilita-FinestraFornitore. */
  const [proposta, setProposta] = useState<Partial<FatturaFornitore> | null>(null);
  /** Il primo passo del caricamento: che documento è. Vedi
   *  crm/contabilita-categorie per il perché si chiede PRIMA del file. */
  const [scegliCategoria, setScegliCategoria] = useState(false);
  /** La categoria scelta al passo 1: imposta regime e percentuale della riga
   *  che si sta per creare. Si dimentica a finestra chiusa. */
  const [categoriaScelta, setCategoriaScelta] = useState<CategoriaSpesa | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /** ── ⚠️ IL PERIODO CAMBIA IL FILTRO, NON I DATI ────────────────────────
   *  Qui c'era una lettura sola che dipendeva dal periodo: cliccando la
   *  freccia per andare al trimestre prima si riscaricava TUTTO — anagrafica,
   *  fatture emesse, fatture dei fornitori con dentro l'XML originale di
   *  ognuna, regole, aliquote — per poi filtrarle su date diverse. Con un
   *  anno di fatture caricate sono megabyte a ogni freccia, e la freccia si
   *  preme quattro volte di fila.
   *  Le fatture di un fornitore non cambiano perché guardo un altro trimestre:
   *  cambia quali guardo. Quindi l'archivio si legge una volta, e a seguire il
   *  periodo restano solo le spese fisse dei mesi che tocca — che sono
   *  letteralmente una riga per mese.
   *  ⚠️ `caricando` lo muovono in due, e un booleano si spegnerebbe al primo
   *   che finisce mentre l'altro sta ancora leggendo: si conta quanti sono in
   *   corso. */
  const quantiInCorso = useRef(0);
  const segnaInizio = useCallback(() => {
    quantiInCorso.current += 1;
    setCaricando(true);
  }, []);
  const segnaFine = useCallback(() => {
    quantiInCorso.current = Math.max(0, quantiInCorso.current - 1);
    if (quantiInCorso.current === 0) setCaricando(false);
  }, []);

  /** Tutto quello che non dipende dal periodo. */
  const ricaricaArchivio = useCallback(async () => {
    segnaInizio();
    setErrore("");
    try {
      const [a, e, f, r, al] = await Promise.all([
        leggiAzienda(),
        leggiEmesse(),
        leggiFornitori(),
        archivio.leggi(CHIAVE_REGOLE),
        archivio.leggi(CHIAVE_ALIQUOTE),
      ]);
      setAzienda(a);
      //  ⚠️ Una lettura fallita NON diventa «non c'è niente»: senza le fatture
      //   il fatturato sarebbe zero, senza i fornitori mancherebbero dei costi,
      //   e in tutti e due i casi il conto uscirebbe SBAGLIATO invece che
      //   assente. Meglio nessun numero che un numero ottimista.
      if (!e.ok) throw new Error(e.errore || "non riesco a leggere le fatture emesse");
      if (!f.ok) throw new Error(f.errore || "non riesco a leggere le fatture dei fornitori");
      setFatture(e.lista);
      setFornitori(f.lista);
      try {
        setRegole(r ? (JSON.parse(r) as RegoleContabili) : {});
      } catch {
        setRegole({});
      }
      try {
        setAliquote(
          al
            ? { ...ALIQUOTE_PREDEFINITE, ...(JSON.parse(al) as Partial<Aliquote>) }
            : ALIQUOTE_PREDEFINITE,
        );
      } catch {
        setAliquote(ALIQUOTE_PREDEFINITE);
      }
    } catch (x) {
      setErrore(x instanceof Error ? x.message : String(x));
    }
    segnaFine();
  }, [segnaInizio, segnaFine]);

  /** Le sole che seguono il periodo: le spese fisse dei mesi che tocca.
   *  ⚠️ Tiene acceso «sto leggendo» anche lei: senza, cambiando trimestre il
   *   conto si ridisegnerebbe per un istante SENZA le spese fisse del periodo
   *   nuovo — un utile più alto del vero, mostrato e poi corretto. */
  const ricaricaMesi = useCallback(async () => {
    segnaInizio();
    try {
      const [m, cr] = await Promise.all([
        leggiCostiDiPiuMesi(mesiDelPeriodo(periodo)),
        archivio.leggi(chiaveCredito(periodo)),
      ]);
      setCreditoPrecedente(Math.max(0, Number(cr) || 0));
      setCostiMese(m);
    } catch (x) {
      setErrore(x instanceof Error ? x.message : String(x));
    }
    segnaFine();
  }, [periodo, segnaInizio, segnaFine]);

  const salvaCredito = async (v: number) => {
    setCreditoPrecedente(v);
    const e = await archivio.scrivi(chiaveCredito(periodo), String(v));
    if (e) toast.error("Il credito non è stato salvato", { description: e });
  };

  /** Dopo un salvataggio: rileggere tutto è giusto, perché non si sa cosa è
   *  cambiato. */
  const ricarica = useCallback(async () => {
    await Promise.all([ricaricaArchivio(), ricaricaMesi()]);
  }, [ricaricaArchivio, ricaricaMesi]);

  useEffect(() => {
    void ricaricaArchivio();
  }, [ricaricaArchivio]);
  useEffect(() => {
    void ricaricaMesi();
  }, [ricaricaMesi]);

  const dentro = useMemo(() => dentroIlPeriodo(periodo), [periodo]);

  const fattureDelPeriodo = useMemo(
    () => fatture.filter((f) => f.stato === "emessa" && dentro(f.data)),
    [fatture, dentro],
  );
  /** ── ⚠️ IL CONTROLLO SULL'XML SI FA UNA VOLTA, NON A OGNI RIDISEGNO ────
   *  `problemiXml` valida una fattura intera: partite IVA, codici fiscali con
   *  il carattere di controllo, date, righe. Chiamarlo dentro il `map` della
   *  lista voleva dire rifarlo per ogni fattura del trimestre a ogni apertura
   *  di finestra e a ogni tasto premuto nei campi qui sopra. Si fa una volta
   *  per periodo, e si consulta. */
  const bloccantiPerFattura = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of fattureDelPeriodo) m.set(f.id, problemiXml(f, azienda).bloccanti);
    return m;
  }, [fattureDelPeriodo, azienda]);
  const nostreFatture = useMemo(
    () => ({ fatture: fattureDelPeriodo, azienda }),
    [fattureDelPeriodo, azienda],
  );

  const fornitoriDelPeriodo = useMemo(
    () => fornitori.filter((f) => dentro(f.data)),
    [fornitori, dentro],
  );

  const costi = useMemo(
    () => [
      ...costiDallePratiche(leads, dentro),
      ...costiDaiMesi(costiMese),
      ...costiDaiFornitori(fornitori, dentro),
    ],
    [leads, dentro, costiMese, fornitori],
  );

  const senzaIva = useMemo(() => {
    return leads
      .filter((l) => l?.data && eConversione(l))
      .reduce((t, l) => t + incassiSenzaIvaDi(l.data.payment?.incassi, dentro), 0);
  }, [leads, dentro]);

  const conto = useMemo(
    () =>
      calcolaContoFiscale({
        fatture: fattureDelPeriodo,
        costi,
        incassiSenzaIva: senzaIva,
        creditoPrecedente,
        regole,
        aliquote,
      }),
    [fattureDelPeriodo, costi, senzaIva, creditoPrecedente, regole, aliquote],
  );

  /** Le voci raggruppate per titolo: è così che si mettono le spunte, e così
   *  che il commercialista le legge — non riga per riga, che sarebbero
   *  centinaia. */
  const perVoce = useMemo(() => {
    const m = new Map<string, VoceRaggruppata>();
    for (const r of conto.righe) {
      const k = chiaveVoce(r.titolo);
      const v = m.get(k) ?? {
        chiave: k,
        titolo: r.titolo,
        totale: 0,
        deducibile: 0,
        non: 0,
        iva: 0,
        quante: 0,
        righe: [] as CostoContabile[],
      };
      v.totale += r.importo;
      v.quante += 1;
      v.iva += r.ivaDetraibile;
      if (r.scaricabile) v.deducibile += r.importo - r.ivaDetraibile;
      else v.non += r.importo;
      v.righe.push(r);
      m.set(k, v);
    }
    //  ⚠️ Dentro la voce, dalla più recente: aprendo «Impianto» si cerca quasi
    //   sempre l'ultima, non la prima. Le righe senza data restano in coda
    //   invece di risalire in cima per via di una stringa vuota.
    for (const v of m.values()) {
      v.righe.sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
    }
    return [...m.values()].sort((a, b) => b.totale - a.totale);
  }, [conto.righe]);

  const cambiaTipo = (t: TipoPeriodo) => {
    setTipo(t);
    setPeriodo(periodoCorrente(t));
  };

  /** ── ⚠️ NON SI DICE «SALVATA» SE NON È STATO SCRITTO NIENTE ────────────
   *  `conRegola` non scrive quando la regola nuova dice ESATTAMENTE quello che
   *  già valeva in quel momento — ed è giusto, una riga che non cambia niente
   *  sporca la storia e fa credere a chi la legge che in quel periodo sia
   *  successo qualcosa.
   *  Ma la pagina diceva «Regola salvata» lo stesso: si premeva, compariva la
   *  conferma, e nella storia non compariva niente. Chi lo vede conclude che il
   *  salvataggio è rotto, e la volta dopo ci riprova tre volte.
   *  Adesso si confrontano le regole prima e dopo, e si dice quale delle due
   *  cose è successa. */
  const salvaRegole = async (nuove: RegoleContabili) => {
    const cambiate = JSON.stringify(nuove) !== JSON.stringify(regole);
    if (!cambiate) {
      toast.info("Era già così", {
        description:
          "Quella voce era già trattata in questo modo nel periodo scelto: non ho aggiunto niente alla sua storia.",
      });
      return;
    }
    setRegole(nuove);
    const e = await archivio.scrivi(CHIAVE_REGOLE, JSON.stringify(nuove));
    if (e) toast.error("La regola non è stata salvata", { description: e });
    //  ⚠️ Il messaggio non dice più «dal mese in poi»: adesso una regola può
    //   valere da un giorno, o fra due date. Dire «in poi» su un intervallo
    //   sarebbe una piccola bugia proprio nel momento in cui si conferma.
    else
      toast.success("Regola salvata", {
        description: "I costi dei periodi precedenti non cambiano.",
      });
  };

  /** ── IL PACCHETTO PER IL COMMERCIALISTA ────────────────────────────────
   *  Uno ZIP con gli originali, gli elenchi e il riepilogo. Cosa ci va dentro
   *  — e cosa NON ci va, che è la parte che va detta — sta in
   *  `crm/contabilita-esporta`. */
  const scaricaPacchetto = async () => {
    setPacchetto({ fatti: 0, totale: fornitoriDelPeriodo.length });
    try {
      const r = await costruisciPacchetto({
        periodo,
        azienda,
        fatture: fattureDelPeriodo,
        fornitori: fornitoriDelPeriodo,
        conto,
        aliquote,
        regole,
        avanzamento: (fatti, totale) => setPacchetto({ fatti, totale }),
      });
      const url = URL.createObjectURL(r.zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.nome;
      a.click();
      //  L'indirizzo temporaneo si libera dopo, non subito: revocarlo nello
      //  stesso istante del clic annulla lo scaricamento su certi browser.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success(`${r.dentro} file dentro ${r.nome}`, {
        description: r.senzaOriginale.length
          ? `⚠️ ${r.senzaOriginale.length} righe non hanno un documento allegato: l'elenco è nel LEGGIMI dentro lo zip.`
          : "Originali, elenchi in CSV e riepilogo. Il LEGGIMI dice anche cosa NON c'è dentro.",
        duration: 12000,
      });
    } catch (x) {
      toast.error("Il pacchetto non si è formato", {
        description: x instanceof Error ? x.message : String(x),
      });
    }
    setPacchetto(null);
  };

  /** ── I PROTOCOLLI DEGLI ACQUISTI ───────────────────────────────────────
   *  ⚠️ Si calcolano su TUTTO l'archivio, non sul periodo: un progressivo che
   *   riparte a ogni trimestre non è un progressivo. Vedi
   *   `crm/contabilita-registri`. */
  const numeriProtocollo = useMemo(() => protocolli(fornitori), [fornitori]);

  const stampaRegistri = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Il browser ha bloccato la finestra di stampa", {
        description: "Consenti le finestre a comparsa per questo sito e riprova.",
      });
      return;
    }
    w.document.write(
      costruisciRegistri(
        fattureDelPeriodo,
        fornitoriDelPeriodo,
        numeriProtocollo,
        periodo,
        azienda,
      ),
    );
    w.document.close();
  };

  /** ── LE AUTOFATTURE DA TRASMETTERE ─────────────────────────────────────
   *  Per ogni fattura estera del periodo un file TD17/TD18/TD19, pronto da
   *  mandare allo SDI. Chi non si può costruire si dice PERCHÉ, una per una:
   *  «3 non si possono fare» manda a indovinare quali. */
  const autofatture = useMemo(
    () =>
      fornitoriDelPeriodo
        .filter((f) => regimeDi(f.regime ?? "italiana").tipoDocumento)
        .map((f) => ({ f, problemi: problemiAutofattura(f, azienda) })),
    [fornitoriDelPeriodo, azienda],
  );

  const scaricaAutofatture = async () => {
    const buone = autofatture.filter((x) => x.problemi.length === 0);
    const rotte = autofatture.filter((x) => x.problemi.length > 0);
    if (buone.length === 0) {
      toast.error("Nessuna autofattura si può costruire", {
        description: rotte.length
          ? `${rotte[0].f.fornitore}: ${rotte[0].problemi[0]}`
          : "In questo periodo non ci sono acquisti esteri da trasmettere.",
      });
      return;
    }
    toast.info(`Sto scaricando ${buone.length} file`, {
      description:
        (rotte.length > 0
          ? `${rotte.length} non si possono costruire: ${rotte.map((x) => x.f.fornitore).join(", ")}. `
          : "") + "Vanno trasmesse allo SDI dal canale del commercialista.",
      duration: 12000,
    });
    await scaricaInFila(
      buone.map((x) => ({
        nome: nomeFileAutofattura(x.f, azienda),
        contenuto: costruisciAutofattura(x.f, azienda),
        tipo: "application/xml",
      })),
      (fatti, totale) => setAvanzamento({ fatti, totale }),
    );
    setAvanzamento(null);
  };

  /* ── CARICARE LE FATTURE DEI FORNITORI ──────────────────────────────────
     Più file insieme, uno per volta: ognuno è una scrittura a sé in archivio,
     e ventiquattro fatture caricate insieme sono ventiquattro richieste. Il
     contatore c'è perché un'attesa muta è indistinguibile da una pagina
     bloccata. */
  const caricaFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const elenco = Array.from(files);
    /*  ── ⚠️ UN PDF NON SI PUÒ CARICARE IN SILENZIO ─────────────────────
        Da un XML i numeri si leggono e la fattura entra da sola; da un PDF si
        RICONOSCONO, e una fattura entrata in contabilità senza che nessuno
        abbia guardato i numeri riconosciuti è esattamente il caso che questo
        programma evita da sempre. Quindi il PDF apre la finestra, già piena di
        quello che si è letto, e chi carica conferma.
        ⚠️ UNO PER VOLTA, e va detto: dieci PDF insieme vorrebbero dire dieci
         finestre in fila, che nessuno compila. Si prende il primo e si dice
         quanti ne restano. */
    /*  ⚠️ ANCHE I FOGLI DI CALCOLO, insieme ai PDF: da un .xls i numeri si
        RICONOSCONO come da un PDF, non si leggono come da un XML. Lasciarli
        nel giro degli XML voleva dire scartarli tutti con «non è una fattura
        elettronica» — cioè il fornitore cinese che non entrava mai. */
    const pdf = elenco.filter(
      (f) => /\.(pdf|xls|xlsx|xlsm)$/i.test(f.name) || /pdf|excel|spreadsheet/i.test(f.type),
    );
    if (pdf.length > 0) {
      setPdfDaLeggere(pdf[0]);
      setApriAMano(true);
      if (fileRef.current) fileRef.current.value = "";
      if (pdf.length > 1) {
        toast.info(`Apro ${pdf[0].name}`, {
          description: `Gli altri ${pdf.length - 1} PDF vanno caricati uno alla volta: da un PDF i numeri si riconoscono, e vanno confermati con il documento davanti.`,
          duration: 9000,
        });
      }
      if (pdf.length === elenco.length) return;
    }
    //  Il contatore conta gli XML, non i PDF: quelli sono già stati messi da
    //  parte, e vederli dentro un totale che non scorre fa sembrare bloccato
    //  un caricamento che sta andando.
    const daLeggere = elenco.filter((f) => !pdf.includes(f));
    setAvanzamento({ fatti: 0, totale: daLeggere.length });
    const scartate: string[] = [];
    /** Caricate, ma intestate a qualcun altro: vanno guardate. */
    const estranee: string[] = [];
    let entrate = 0;
    for (let i = 0; i < daLeggere.length; i++) {
      const testo = await daLeggere[i].text().catch(() => "");
      const letta = leggiXmlFornitore(testo, daLeggere[i].name);
      if (!letta.ok) {
        scartate.push(`${daLeggere[i].name}: ${letta.motivo}`);
      } else if (emessaDaNoi(letta.fattura, azienda.partitaIva, azienda.codiceFiscale)) {
        //  ⚠️ NON ENTRA, e non è un avviso: chi emette è la nostra società, e
        //   non esiste una lettura in cui quel documento sia un acquisto. Il
        //   pulsante «Scarica gli XML» sta in questa stessa pagina, tre righe
        //   più su: ricaricare per sbaglio uno di quei file è la cosa più
        //   facile del mondo, e trasformerebbe un ricavo in un costo.
        scartate.push(
          `${daLeggere[i].name}: questa fattura l'hai emessa TU (${letta.fattura.fornitore}). Le tue stanno in «Fatture», non fra i costi.`,
        );
      } else {
        const e = await salvaFornitore(letta.fattura);
        if (e) {
          scartate.push(`${daLeggere[i].name}: ${e}`);
        } else {
          entrate += 1;
          //  ⚠️ CARICATA, MA FORSE NON È NOSTRA. Caricando una cartella intera
          //   a fine trimestre è facilissimo prendere dentro il file
          //   sbagliato, e nessuna di quelle darebbe errore: entrerebbe come
          //   costo con la sua IVA in detrazione, e il conto sarebbe sbagliato
          //   in silenzio. Si avvisa e non si blocca — le partite IVA in
          //   archivio si scrivono in modi diversi, e un blocco su un
          //   confronto fra stringhe rifiuterebbe fatture giuste.
          if (!intestataANoi(letta.fattura, azienda.partitaIva, azienda.codiceFiscale)) {
            estranee.push(`${letta.fattura.fornitore} (${daLeggere[i].name})`);
          }
        }
      }
      setAvanzamento({ fatti: i + 1, totale: daLeggere.length });
    }
    setAvanzamento(null);
    if (fileRef.current) fileRef.current.value = "";
    if (entrate > 0)
      toast.success(`${entrate} ${entrate === 1 ? "fattura caricata" : "fatture caricate"}`);
    //  ⚠️ I file scartati si dicono UNO PER UNO col loro motivo: «3 file non
    //   caricati» manda a indovinare quali, e il giorno della verifica quei tre
    //   costi non ci sono e nessuno sa perché.
    if (scartate.length > 0) {
      toast.error(
        `${scartate.length} ${scartate.length === 1 ? "file non caricato" : "file non caricati"}`,
        {
          description: scartate.slice(0, 4).join(" · "),
          duration: 14000,
        },
      );
    }
    void ricarica();
  };

  /** ── RISCARICARE IL DOCUMENTO ────────────────────────────────────────
   *  Due strade perché sono due cose diverse: l'XML sta dentro il documento
   *  stesso, l'allegato in una chiave sua (vedi crm/contabilita-fornitori) e
   *  si va a prendere solo adesso — l'elenco non deve trascinarsi dietro dei
   *  megabyte di PDF a ogni apertura della pagina. */
  /** ── ⚠️ DALLA BOLLETTA ALLEGATA ALLA RIGA CHE FA DETRARRE ──────────────
   *  Il passaggio che tutti saltano, e che vale l'IVA di ogni importazione.
   *  Qui si apre la finestra con dentro tutto quello che si può sapere senza
   *  guardare la bolletta — chi la emette, il regime, la causale, il rimando
   *  alla fattura — e si lasciano vuoti i DUE numeri che stanno solo lì:
   *  il valore doganale e l'imposta.
   *
   *  ⚠️ NON SI PRECOMPILANO GLI IMPORTI DALLA FATTURA, ed è la cosa più
   *   importante di questa funzione. Il valore doganale NON è il totale della
   *   fattura: comprende il trasporto e l'assicurazione fino al confine, e i
   *   dazi. Proporre il totale del fornitore vorrebbe dire un imponibile
   *   plausibile e sbagliato — e nessuno ricontrolla un campo che è già
   *   pieno. Vuoto costringe a guardare la bolletta, che è l'unico posto dove
   *   quei due numeri esistono.
   *
   *  ⚠️ `soloImposta` c'è fin da subito: senza, questa riga porterebbe il
   *   valore doganale fra i COSTI, cioè lo stesso acquisto due volte. */
  /** ── ⚠️ LA BOLLETTA È GIÀ STATA REGISTRATA? ────────────────────────────
   *  Si guarda fra le righe «solo imposta» se ce n'è una che nomina questa
   *  fattura. Non è un legame vero — le note sono testo — ed è una scelta:
   *  un campo di collegamento andrebbe scritto anche su tutte le bollette
   *  registrate a mano prima d'oggi, che non ce l'hanno e non ce l'avranno
   *  mai. Il rischio del testo è mostrare il pulsante una volta di troppo;
   *  il rischio di un legame che quasi nessuna riga ha è nasconderlo sempre.
   *  Fra i due, meglio quello che si vede. */
  const bollettaGiaRegistrata = (f: FatturaFornitore): boolean => {
    const rif = `${f.fornitore}${f.numero ? ` n. ${f.numero}` : ""} del ${f.data}`;
    return fornitori.some((x) => x.soloImposta && (x.note ?? "").includes(rif));
  };

  const registraLaBolletta = (f: FatturaFornitore) => {
    setProposta({
      fornitore: "Dogana — IVA all'importazione",
      paese: "IT",
      regime: "italiana",
      soloImposta: true,
      data: f.data,
      numero: "",
      imponibile: 0,
      imposta: 0,
      totale: 0,
      righe: [],
      note: `Bolletta doganale della fattura ${f.fornitore}${f.numero ? ` n. ${f.numero}` : ""} del ${f.data}. Scrivi il numero della bolletta (MRN), il valore doganale e l'IVA come stanno scritti lì.`,
    });
  };

  const riscarica = async (
    f: FatturaFornitore,
    quale: "documento" | "pagamento" | "dogana" = "documento",
  ) => {
    if (quale === "documento" && f.originale) {
      scaricaXml(f.nomeFile || `${f.id}.xml`, f.originale);
      return;
    }
    const a = await leggiAllegato(f.id, quale);
    if (!a) {
      toast.error(
        quale === "pagamento"
          ? "La prova di pagamento non si trova più in archivio"
          : quale === "dogana"
            ? "La bolletta doganale non si trova più in archivio"
            : "Il documento non si trova più in archivio",
      );
      return;
    }
    //  Da base64 a file: si passa per i byte invece che per un `data:` lungo
    //  megabyte, che certi browser rifiutano di scaricare.
    const byte = Uint8Array.from(atob(a.contenuto), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([byte], { type: a.tipo }));
    const link = document.createElement("a");
    link.href = url;
    link.download = a.nome;
    link.click();
    URL.revokeObjectURL(url);
  };

  /** ── ⚠️ I COSTI IN UN FILE CHE IL COMMERCIALISTA PUÒ APRIRE ───────────
   *  Il foglio da stampare risponde alla domanda «quanto devo»; questo
   *  risponde all'altra, che arriva subito dopo: «fammeli vedere». È un CSV
   *  perché è l'unica cosa che entra in un foglio di calcolo e in un
   *  gestionale senza che nessuno debba ricopiare niente.
   *
   *  ⚠️ IL SEPARATORE È IL PUNTO E VIRGOLA e i decimali hanno la VIRGOLA:
   *   Excel in italiano apre un CSV con la virgola mettendo tutta la riga in
   *   una cella sola, e legge «1234.56» come una data o come testo. Un file
   *   che si apre storto viene ricopiato a mano, cioè non serve a niente.
   *  ⚠️ E c'è il BOM davanti: senza, Excel legge «Contabilità» come
   *   «ContabilitÃ ». Tre byte che evitano una telefonata.
   *
   *  ⚠️ UNA RIGA PER COSTO, non per voce: al commercialista serve il dettaglio
   *   — è lui che deve poter dire «questo lo scarichi, questo no». Il
   *   raggruppamento lo fa lui col foglio di calcolo, in due secondi; il
   *   contrario — ricostruire il dettaglio da un totale — non si può fare. */
  const scaricaCostiCsv = () => {
    const campo = (v: unknown) => {
      const t = String(v ?? "");
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    //  I numeri come li scrive un foglio di calcolo italiano.
    const numero = (n: number) => (Number(n) || 0).toFixed(2).replace(".", ",");
    const intestazioni = [
      "Data",
      "Voce",
      "Dettaglio",
      "Provenienza",
      "Importo",
      "Deducibile",
      "IVA detratta",
      "Regola in vigore da",
    ];
    const righe = conto.righe
      .slice()
      .sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? "")))
      .map((r) =>
        [
          r.data ?? "",
          r.titolo,
          r.dettaglio ?? "",
          ORIGINE[r.origine],
          numero(r.importo),
          r.scaricabile ? "si" : "no",
          numero(r.ivaDetraibile),
          r.daQuandoVale === DA_SEMPRE ? "" : r.daQuandoVale,
        ]
          .map(campo)
          .join(";"),
      );
    //  In fondo il totale: chi apre il file lo cerca, e sommare a mano
    //  duecento righe per controllare che tornino è il modo di non farlo.
    const coda = [
      "",
      [
        "",
        "TOTALE",
        "",
        "",
        numero(conto.righe.reduce((t, r) => t + r.importo, 0)),
        "",
        numero(conto.ivaACredito),
        "",
      ]
        .map(campo)
        .join(";"),
      ["", "di cui deducibile", "", "", numero(conto.costiDeducibili), "", "", ""]
        .map(campo)
        .join(";"),
      ["", "di cui NON deducibile", "", "", numero(conto.costiNonDeducibili), "", "", ""]
        .map(campo)
        .join(";"),
    ];
    scaricaTesto(
      `costi-${periodo.nome.replace(/\s+/g, "-").toLowerCase()}.csv`,
      `\uFEFF${[intestazioni.map(campo).join(";"), ...righe, ...coda].join("\r\n")}`,
      "text/csv",
    );
  };

  const scaricaEmesse = async () => {
    const buone = fattureDelPeriodo.filter((f) => problemiXml(f, azienda).bloccanti.length === 0);
    if (buone.length === 0) {
      toast.error("Nessuna fattura del periodo si può consegnare", {
        description: "A tutte manca un dato obbligatorio: aprile in «Fatture» per vedere quale.",
      });
      return;
    }
    const scartate = fattureDelPeriodo.length - buone.length;
    toast.info(`Sto scaricando ${buone.length} file`, {
      description:
        (scartate > 0 ? `${scartate} restano indietro: manca un dato obbligatorio. ` : "") +
        "Se il browser chiede il permesso per i download multipli, dagli l'ok.",
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
  };

  return (
    <Pagina>
      <Titolo
        testo="Contabilità"
        icona={Calculator}
        nota={`${periodo.nome} · quello che hai fatturato, quello che hai speso e quanto va allo Stato`}
        azioni={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void scaricaPacchetto()}
              disabled={!!pacchetto || caricando || !!errore}
              title="Uno ZIP con gli originali, gli elenchi in CSV e il riepilogo del periodo"
            >
              <PackageCheck className="mr-1.5 h-3.5 w-3.5" />
              {pacchetto
                ? `Preparo… ${pacchetto.fatti}/${pacchetto.totale}`
                : "Pacchetto commercialista"}
            </Button>
            {/*  I registri IVA sono LIBRI OBBLIGATORI (artt. 23 e 25 DPR
                633/72): in una verifica si chiedono quelli. */}
            <Button variant="outline" size="sm" onClick={stampaRegistri}>
              <BookText className="mr-1.5 h-3.5 w-3.5" /> Registri IVA
            </Button>
            <Button variant="outline" size="sm" onClick={() => setApriAliquote(true)}>
              <Landmark className="mr-1.5 h-3.5 w-3.5" /> Aliquote
            </Button>
          </>
        }
      />

      {/* ── IL PERIODO ────────────────────────────────────────────────────
          Mese, trimestre, anno: i tre periodi su cui si liquida e si dichiara.
          Niente «ultimi 30 giorni» — vedi la nota in cima al file. */}
      <BarraAzioni>
        <Segmento attivo={tipo === "mese"} onClick={() => cambiaTipo("mese")}>
          Mese
        </Segmento>
        <Segmento attivo={tipo === "trimestre"} onClick={() => cambiaTipo("trimestre")}>
          Trimestre
        </Segmento>
        <Segmento attivo={tipo === "anno"} onClick={() => cambiaTipo("anno")}>
          Anno
        </Segmento>
        <SepBarra />
        <button
          type="button"
          onClick={() => setPeriodo(periodoVicino(periodo, -1))}
          title="Il periodo prima"
          aria-label="Il periodo prima"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-1 text-[13px] font-semibold capitalize">{periodo.nome}</span>
        <button
          type="button"
          onClick={() => setPeriodo(periodoVicino(periodo, 1))}
          title="Il periodo dopo"
          aria-label="Il periodo dopo"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </BarraAzioni>

      {caricando ? (
        <p className="px-1 text-[12.5px] text-muted-foreground">Leggo fatture, costi e regole…</p>
      ) : errore ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Non riesco a leggere i dati del periodo, quindi non mostro nessun conto: un conto fatto
            su dati mancanti direbbe un utile più alto del vero.{" "}
            <span className="text-amber-800/70">{errore}</span>
          </span>
        </p>
      ) : (
        <>
          {inCorso(periodo) && (
            <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>
                <strong>{periodo.nome}</strong> non è ancora finito: questi numeri sono veri ma
                parziali. Girati come definitivi, mancherà quello che deve ancora succedere.
              </span>
            </p>
          )}

          {/*  ── ⚠️ LE SCADENZE PRIMA DEL CONTO ─────────────────────────
              Il conto risponde a «come è andata»; le scadenze a «cosa devo
              fare, ed entro quando». La seconda domanda ha una data sopra e la
              prima no: chi apre questa pagina il 10 di maggio deve vedere che
              fra sei giorni si versa, non doverlo scoprire scorrendo. */}
          <Scadenzario
            oggi={new Date().toISOString().slice(0, 10)}
            regime={liquidazione}
            onCambiaRegime={(r) =>
              void cambiaLiquidazione(r).then((e) => {
                if (e) toast.error("Non ho salvato la scelta", { description: e });
              })
            }
          />

          <ContoDelPeriodo
            conto={conto}
            aliquote={aliquote}
            periodo={periodo}
            azienda={azienda}
            regole={regole}
            creditoPrecedente={creditoPrecedente}
            onCredito={(v) => void salvaCredito(v)}
          />

          {/*  ── ⚠️ QUELLO CHE NON VA, PRIMA DEGLI ELENCHI ──────────────
              Il pacchetto per il commercialista dice «riapri e precisa le
              fatture generiche», e finché questa striscia non c'era, trovarle
              voleva dire scorrere l'elenco cercando una parola. Un programma
              che dice cosa fare deve dire anche dove. */}
          <DaSistemare
            fornitori={fornitoriDelPeriodo}
            righe={conto.righe}
            nostre={nostreFatture}
            onApri={(f) => setDaCorreggere(f)}
          />

          {/*  ── ⚠️ L'F24 SUBITO DOPO IL CONTO ──────────────────────────
              È la domanda che viene dopo «quanto devo»: «e adesso cosa
              scrivo». Metterlo in fondo, dopo gli elenchi, vorrebbe dire
              farlo cercare proprio nel giorno in cui serve. */}
          <ProspettoF24 conto={conto} periodo={periodo} regime={liquidazione} azienda={azienda} />

          {/*  Compare solo se hai trattenuto qualcosa: chi non paga
              professionisti non deve vedere una scheda su un adempimento che
              non lo riguarda. */}
          <SostitutoImposta
            fornitori={fornitoriDelPeriodo}
            anno={Number(periodo.dal.slice(0, 4))}
          />

          {/* ── LE FATTURE EMESSE ──────────────────────────────────────── */}
          <Scheda
            titolo="Fatture emesse"
            nota={`${fattureDelPeriodo.length} nel periodo · ${eur(conto.imponibileFatturato)} di imponibile`}
            icona={FileText}
            azioni={
              fattureDelPeriodo.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => void scaricaEmesse()}>
                  <FileCode2 className="mr-1.5 h-3.5 w-3.5" /> Scarica gli XML
                </Button>
              )
            }
            senzaPadding
          >
            {fattureDelPeriodo.length === 0 ? (
              <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
                Nessuna fattura emessa in questo periodo. Si emettono da «Fatture».
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {fattureDelPeriodo.map((f) => {
                  //  ⚠️ Il controllo sta sulla RIGA, non solo nel messaggio
                  //   che compare scaricando: «2 restano indietro» senza dire
                  //   quali manda a riaprire le fatture una per una.
                  const rotta = bloccantiPerFattura.get(f.id) ?? [];
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">
                        {f.cliente.azienda
                          ? f.cliente.denominazione
                          : `${f.cliente.nome} ${f.cliente.cognome}`.trim()}
                        <span className="ml-2 text-[11.5px] text-muted-foreground">
                          n. {f.numero} · {dataBreve(f.data)}
                        </span>
                        {rotta.length > 0 && (
                          <span
                            title={rotta.join(" · ")}
                            className="ml-2 rounded bg-rose-50 px-1.5 py-px text-[10.5px] font-medium text-rose-700"
                          >
                            non si può consegnare
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {eur(f.imponibile)} + {eur(f.imposta)}
                      </span>
                      <span className="w-24 shrink-0 text-right font-semibold tabular-nums">
                        {eur(f.totale)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Scheda>

          {/* ── LE FATTURE DEI FORNITORI ───────────────────────────────── */}
          <Scheda
            titolo="Fatture dei fornitori"
            nota="XML dello SDI, oppure il PDF di Meta, Amazon, Alibaba: leggo il documento e riempio i campi. Questa è una copia di lavoro: la conservazione a norma per dieci anni la fa il gestionale del commercialista"
            icona={Upload}
            azioni={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xml,text/xml,application/xml,.pdf,application/pdf,.xls,.xlsx,.xlsm"
                  multiple
                  onChange={(e) => void caricaFile(e.target.files)}
                  className="hidden"
                />
                {/*  ── DUE STRADE, E SERVONO TUTTE E DUE ──────────────────
                    L'XML si legge e i numeri sono quelli del documento; il PDF
                    no, e chi ha solo quello — l'estero, Alibaba, Amazon — non
                    può restare fuori dalla contabilità. Scritta a mano si vede
                    che è scritta a mano, ed è giusto: un numero letto e un
                    numero digitato non hanno lo stesso peso. */}
                {/*  Le autofatture: l'unico documento ufficiale che questo
                    programma può produrre davvero, e ne serve una per ogni
                    fattura estera, ogni mese. */}
                {autofatture.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => void scaricaAutofatture()}>
                    <FileCode2 className="mr-1.5 h-3.5 w-3.5" /> Autofatture (
                    {autofatture.filter((x) => x.problemi.length === 0).length})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setApriAMano(true)}>
                  <FileUp className="mr-1.5 h-3.5 w-3.5" /> Scrivi a mano
                </Button>
                <Button variant="outline" size="sm" onClick={() => setScegliCategoria(true)}>
                  {/*  ⚠️ NON PIÙ «Carica XML o PDF». Quel nome elencava DUE
                      formati, e chi aveva in mano un terzo — l'Excel di un
                      fornitore cinese, la foto di uno scontrino — concludeva
                      che lì non ci andava. Segnalato dal committente con
                      «non capisco dove caricare le proforma».
                      Il pulsante dice cosa si carica, non in che formato: i
                      formati stanno scritti sotto, dove servono. */}
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Carica un documento
                </Button>
              </>
            }
            senzaPadding
          >
            {avanzamento && (
              <p className="border-b border-border px-4 py-2 text-[12.5px] tabular-nums text-muted-foreground">
                {avanzamento.fatti}/{avanzamento.totale}…
              </p>
            )}
            {fornitoriDelPeriodo.length === 0 ? (
              <div className="px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                {/*  ── ⚠️ QUI CI VA TUTTO, E VA DETTO ────────────────────
                    Prima questa riga diceva «carica gli XML, non il PDF». Era
                    vera per le fatture italiane e faceva credere a chi aveva
                    in mano qualunque altra cosa — un PDF di Meta, l'Excel di
                    un fornitore cinese, lo scontrino del pranzo — che lì non
                    ci andasse. Il risultato è documenti che non entrano mai
                    in contabilità, cioè costi che nessuno scarica.
                    Adesso si dice prima CHE COSA ci va, e solo dopo qual è il
                    formato migliore per ognuno. */}
                Nessuna fattura di fornitore in questo periodo.
                <br />
                <br />
                <strong>Qui va tutto quello che hai pagato:</strong> le fatture italiane, quelle di
                Meta, Google, TikTok e Amazon, i fornitori esteri, le bollette del corriere, e anche
                lo scontrino del pranzo o del carburante. Accetta <strong>XML, PDF, Excel</strong> e
                le foto.
                <br />
                <br />
                Delle fatture italiane conviene l&apos;<strong>XML</strong> e non il PDF:
                dall&apos;XML imponibile e imposta si <em>leggono</em>, da un PDF andrebbero
                indovinati. I file <strong>.p7m</strong> sono firmati e non si aprono qui:
                l&apos;XML in chiaro si scarica dal cassetto fiscale o dal tuo gestionale. Di tutto
                il resto va bene quello che hai — e se un documento non si lascia leggere, i numeri
                si scrivono a mano.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {fornitoriDelPeriodo.map((f) => {
                  const r = regimeDi(f.regime ?? "italiana");
                  //  Il divieto di legge sta sulla riga del costo, non sulla
                  //  fattura: è il conto che lo decide, ed è l'unico posto in
                  //  cui si guarda come è stata pagata.
                  const vietato = conto.righe.find((x) => x.id === f.id)?.bloccoDiLegge;
                  return (
                    <li key={f.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{f.fornitore}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {f.numero && `n. ${f.numero} · `}
                          {dataBreve(f.data)}
                          {f.paese && ` · ${f.paese}`}
                          {/*  ⚠️ IL REGIME SI SCRIVE SULLA RIGA, sempre: è quello
                            che spiega perché una fattura da 800 € non porta
                            nessuna IVA in detrazione. Senza, quella riga
                            sembra un errore di calcolo. */}
                          {f.regime && f.regime !== "italiana" && (
                            <span
                              title={adempimento(f.regime)}
                              className={cn(
                                "ml-1 rounded px-1.5 py-px text-[10.5px] font-medium",
                                //  ⚠️ Rossa se manca il tipo documento: quella
                                //   fattura resta fuori dal foglio degli esteri,
                                //   e una riga che sembra a posto non lo dice.
                                r.daPrecisare
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {r.titolo}
                              {r.tipoDocumento ? ` · ${r.tipoDocumento}` : ""}
                            </span>
                          )}
                          {f.aMano && (
                            <span className="ml-1 rounded bg-amber-50 px-1.5 py-px text-[10.5px] font-medium text-amber-700">
                              scritta a mano
                            </span>
                          )}
                          {f.valuta && f.importoValuta ? ` · ${f.importoValuta} ${f.valuta}` : ""}
                          {f.righe.length > 0 &&
                            ` · ${f.righe.map((x) => x.descrizione).join(", ")}`}
                        </span>
                        {vietato && (
                          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-rose-700">
                            {vietato}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                        {eur(f.imponibile)} + {eur(f.imposta)}
                      </span>
                      <span className="w-24 shrink-0 text-right font-semibold tabular-nums">
                        {eur(f.totale)}
                      </span>
                      {/*  Riscaricare l'originale: un archivio che tiene i numeri
                        ma butta il file costringe, il giorno della verifica, a
                        ricercare i file da un'altra parte. */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 shrink-0 p-0"
                        disabled={!f.originale && !f.conAllegato}
                        title={
                          f.originale || f.conAllegato
                            ? "Riscarica il documento com'era"
                            : "Nessun documento allegato a questa fattura"
                        }
                        aria-label={`Riscarica la fattura di ${f.fornitore}`}
                        onClick={() => void riscarica(f)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {/*  ── LA PROVA DI PAGAMENTO, QUANDO C'È ──────────────
                          Un secondo tasto e non una scelta dentro il primo:
                          sono due file diversi, e chi li cerca cerca l'uno o
                          l'altro — la fattura per il commercialista, la
                          ricevuta per far vedere che i soldi sono usciti.
                          Compare solo dove c'è, quindi dice anche quali righe
                          la prova ce l'hanno e quali no. */}
                      {f.conProvaPagamento && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 shrink-0 p-0"
                          title="Riscarica la prova di pagamento"
                          aria-label={`Prova di pagamento di ${f.fornitore}`}
                          onClick={() => void riscarica(f, "pagamento")}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {f.conBollettaDoganale && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 shrink-0 border-amber-300 p-0 text-amber-800"
                          title="Riscarica la bolletta doganale"
                          aria-label={`Bolletta doganale di ${f.fornitore}`}
                          onClick={() => void riscarica(f, "dogana")}
                        >
                          <FileUp className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/*  ── ⚠️ IL PASSAGGIO CHE VALE L'IVA ────────────────
                          Compare sulle importazioni che hanno la bolletta
                          allegata ma NON ancora la riga che la registra —
                          cioè esattamente le righe su cui c'è dell'imposta
                          che nessuno sta riprendendo. Sparisce da sola
                          quando quella riga esiste: un pulsante che resta
                          acceso dopo essere stato premuto fa registrare la
                          stessa bolletta due volte. */}
                      {f.conBollettaDoganale && !bollettaGiaRegistrata(f) && (
                        <Button
                          size="sm"
                          className="h-7 shrink-0 bg-amber-600 px-2 text-[11.5px] text-white hover:bg-amber-700"
                          title="Crea la riga che porta in detrazione l'IVA pagata in dogana"
                          onClick={() => registraLaBolletta(f)}
                        >
                          Registra l&apos;IVA
                        </Button>
                      )}
                      {/*  ⚠️ SI CORREGGE SOLO QUELLO CHE È STATO SCRITTO A MANO.
                        Una fattura letta da un XML è il documento: correggerla
                        a mano vorrebbe dire che i numeri in contabilità non
                        corrispondono più al file che sta accanto, e la
                        differenza non la vedrebbe nessuno. Quelle si
                        correggono ricaricando il file giusto. */}
                      {f.aMano && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 shrink-0 p-0"
                          title="Correggi questa fattura"
                          aria-label={`Correggi la fattura di ${f.fornitore}`}
                          onClick={() => setDaCorreggere(f)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:border-rose-300 hover:text-rose-600"
                        title="Togli questa fattura dall'archivio"
                        aria-label={`Elimina la fattura di ${f.fornitore}`}
                        onClick={() => {
                          void (async () => {
                            const e = await eliminaFornitore(f);
                            if (e) {
                              toast.error("Non è stata eliminata", { description: e });
                              return;
                            }
                            //  ⚠️ Via anche l'allegato: un file rimasto in
                            //   archivio senza la sua fattura non lo trova più
                            //   nessuno, e resta lì a occupare spazio per sempre.
                            if (f.conAllegato) await eliminaAllegato(f.id);
                            //  ⚠️ ANCHE LA PROVA DI PAGAMENTO, che sta in una
                            //   chiave sua: cancellare la fattura e lasciarci
                            //   dietro la ricevuta vorrebbe dire un file che
                            //   nessuna schermata mostra più e che resta in
                            //   archivio per sempre.
                            if (f.conProvaPagamento) await eliminaAllegato(f.id, "pagamento");
                            if (f.conBollettaDoganale) await eliminaAllegato(f.id, "dogana");
                            void ricarica();
                          })();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Scheda>

          {/* ── LE AUTOFATTURE, UNA PER UNA ─────────────────────────────
              ⚠️ SUBITO SOTTO LE FATTURE RICEVUTE e non in fondo alla pagina:
               è l'adempimento che nasce da quelle righe, e chi ha appena
               finito di caricare le fatture estere è l'unico che sa se le ha
               già mandate. In fondo lo leggerebbe fra un mese.
              Il pulsante «Autofatture (N)» qui sopra resta: scarica tutti i
              file in un colpo, che è quello che si fa la prima volta. Questo
              elenco serve per la conferma, che è una per una. */}
          <Autofatture
            fornitori={fornitoriDelPeriodo}
            azienda={azienda}
            onCambiate={() => void ricarica()}
          />

          {/* ── I COSTI, VOCE PER VOCE ─────────────────────────────────── */}
          <VociDeiCosti
            voci={perVoce}
            regole={regole}
            onRegola={(titolo) => setDaRegolare(titolo)}
            onCsv={conto.righe.length > 0 ? scaricaCostiCsv : undefined}
            onApriLead={(id) => ricerca.apriLead(id)}
          />

          {/*  ⚠️ SI APRE SULL'ULTIMO MESE DEL PERIODO e ricarica il conto
              quando salva: erano due difetti d'uso, non di calcolo. Aprirsi sul
              mese corrente mentre sopra si legge «2º trimestre» fa credere che
              le due schede non c'entrino niente; e salvare senza rileggere
              lasciava il conto in cima fermo a prima dell'affitto appena
              scritto — chi lo prova la prima volta conclude che non funziona. */}
          <CosaSiScarica
            voci={perVoce.map((v) => ({ chiave: v.chiave, titolo: v.titolo }))}
            regole={regole}
            onRegola={(titolo) => setDaRegolare(titolo)}
          />

          <CostiMese
            meseIniziale={mesiDelPeriodo(periodo).slice(-1)[0]}
            mesiDelPeriodo={mesiDelPeriodo(periodo)}
            onSalvato={() => void ricarica()}
          />

          {/*  ── ⚠️ IN FONDO, E NON IN CIMA ──────────────────────────────
              Un elenco di modi per spendere messo sopra il numero delle
              imposte si legge come un invito a spendere. Sta dopo i costi,
              cioè dopo aver visto quanto è già uscito. */}
          <LeveFiscali
            conto={conto}
            aliquote={aliquote}
            mesiDelPeriodo={mesiDelPeriodo(periodo).length}
          />
        </>
      )}

      {daRegolare && (
        <FinestraRegola
          titolo={daRegolare}
          regole={regole}
          onChiudi={() => setDaRegolare(null)}
          onSalva={(nuove) => {
            void salvaRegole(nuove);
            setDaRegolare(null);
          }}
        />
      )}

      {/* ── PASSO 1: CHE DOCUMENTO È ─────────────────────────────────────
          ⚠️ Prima si chiede, poi si sceglie il file. Al contrario — file e
           poi categoria — la domanda arriverebbe quando il modulo è già
           pieno, cioè quando la risposta serve solo a spiegare una scelta
           già fatta. Chi carica un pranzo non sa che se ne deduce il 75%: se
           glielo si dice dopo, preme salva prima. */}
      <FinestraCategoria
        aperta={scegliCategoria}
        onCambio={setScegliCategoria}
        onScelta={(c) => {
          setCategoriaScelta(c);
          //  Il file si chiede subito dopo: la scelta non è un passaggio a
          //  sé, è la prima domanda dello stesso gesto.
          setTimeout(() => fileRef.current?.click(), 0);
        }}
      />

      <FinestraFornitore
        aperta={apriAMano || !!daCorreggere || !!proposta}
        daCorreggere={daCorreggere}
        /*  ⚠️ La categoria vince sul nulla, non sul documento: qui si
            impostano il regime di partenza e la percentuale di legge, e quello
            che il file dice si sovrascrive DOPO, quando viene letto. Un
            documento che si presenta batte sempre una categoria scelta a
            memoria — è il motivo per cui Meta resta irlandese anche se si è
            premuto «pubblicità online». */
        proposta={
          proposta ??
          (categoriaScelta
            ? {
                ...(categoriaScelta.regime ? { regime: categoriaScelta.regime } : {}),
                ...(categoriaScelta.percentuale != null
                  ? { percentualeDeducibile: categoriaScelta.percentuale }
                  : {}),
                ...(categoriaScelta.percentualeIva != null
                  ? { percentualeIva: categoriaScelta.percentualeIva }
                  : {}),
                ...(categoriaScelta.avviso || categoriaScelta.norma
                  ? {
                      note: [categoriaScelta.titolo, categoriaScelta.norma]
                        .filter(Boolean)
                        .join(" · "),
                    }
                  : {}),
              }
            : null)
        }
        avvisoCategoria={categoriaScelta?.avviso}
        azienda={azienda}
        esistenti={fornitori}
        pdfIniziale={pdfDaLeggere}
        onCambio={(v) => {
          if (!v) {
            setApriAMano(false);
            setDaCorreggere(null);
            setProposta(null);
            setCategoriaScelta(null);
            //  ⚠️ Il PDF si dimentica alla chiusura, o la finestra successiva
            //   — anche quella aperta con «Scrivi a mano» — ripartirebbe con
            //   dentro i numeri della fattura di prima.
            setPdfDaLeggere(null);
          }
        }}
        onSalvata={() => void ricarica()}
      />

      <FinestraAliquote
        aperta={apriAliquote}
        aliquote={aliquote}
        onCambio={setApriAliquote}
        onSalva={(a) => {
          setAliquote(a);
          void archivio.scrivi(CHIAVE_ALIQUOTE, JSON.stringify(a)).then((e) => {
            if (e) toast.error("Le aliquote non sono state salvate", { description: e });
            else toast.success("Aliquote salvate");
          });
        }}
      />
    </Pagina>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CONTO DEL PERIODO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ LA SOTTRAZIONE SI LEGGE TUTTA ─────────────────────────────────────
 *  Un «ti resta 5.564 €» che non si può ricostruire è un numero che si può
 *  solo accettare per fede, e alla prima cifra strana non ci crede più
 *  nessuno. Qui ogni riga dice da dove viene, e il verso è scritto col segno
 *  davanti oltre che col colore: chi non distingue bene i colori legge lo
 *  stesso.
 *
 *  ⚠️ DUE RISULTATI, E NON SONO LO STESSO NUMERO. «Utile imponibile» è quello
 *   su cui si pagano le imposte; «utile reale» è quello che resta in mano —
 *   più basso, perché toglie anche i costi che non si scaricano, e più alto
 *   per gli incassi registrati senza IVA. Metterne uno solo vorrebbe dire
 *   nascondere metà della verità: il primo serve al commercialista, il secondo
 *   a chi deve decidere se può permettersi un'assunzione. */
function ContoDelPeriodo({
  conto,
  aliquote,
  periodo,
  azienda,
  regole,
  creditoPrecedente,
  onCredito,
}: {
  conto: ReturnType<typeof calcolaContoFiscale>;
  aliquote: Aliquote;
  periodo: Periodo;
  azienda: DatiAzienda;
  regole: RegoleContabili;
  creditoPrecedente: number;
  onCredito: (v: number) => void;
}) {
  const perdita = conto.utileReale < 0;
  return (
    <Scheda
      titolo="Il conto del periodo"
      nota="Conto gestionale, non una dichiarazione: il commercialista lavora anche su cose che questo programma non sa"
      icona={Calculator}
      azioni={
        <Button
          variant="outline"
          size="sm"
          onClick={() => stampaPerIlCommercialista(conto, aliquote, periodo, azienda, regole)}
        >
          <Printer className="mr-1.5 h-3.5 w-3.5" /> Per il commercialista
        </Button>
      }
      senzaPadding
    >
      <div className="grid grid-cols-1 border-b border-border sm:grid-cols-3">
        <Cifra
          etichetta="Fatturato, al netto dell'IVA"
          valore={conto.imponibileFatturato}
          colore="text-emerald-700"
        />
        <Cifra
          etichetta="Va allo Stato"
          valore={conto.alloStato}
          colore="text-rose-700"
          nota="IVA da versare più imposte"
        />
        <div className={cn("px-4 py-3", perdita ? "bg-rose-50" : "bg-emerald-50")}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {perdita ? "Sei in perdita di" : "Ti resta davvero"}
          </div>
          <div
            className={cn(
              "text-[28px] font-bold leading-none tabular-nums",
              perdita ? "text-rose-700" : "text-emerald-700",
            )}
          >
            {eur(conto.utileReale)}
          </div>
          {/*  ⚠️ «DAVVERO» NON VUOL DIRE «IN BANCA». Questo conto sta sul
              FATTURATO del periodo, non sull'incassato — una fattura emessa e
              non ancora pagata le tasse le fa pagare lo stesso, ed e' proprio
              la cosa che conviene vedere prima che succeda. Ma senza dirlo, un
              numero grosso scritto «ti resta davvero» si legge come il saldo
              del conto corrente, che e' un'altra cosa. */}
          <div className="mt-1 text-[11px] leading-snug text-slate-500">
            di quello che hai FATTURATO nel periodo, a imposte pagate. Non è il saldo in banca: le
            fatture emesse e non ancora incassate sono già dentro.
          </div>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 text-[13px]">
        <Riga
          etichetta="Fatturato imponibile"
          nota="somma delle fatture emesse nel periodo"
          valore={conto.imponibileFatturato}
        />
        {/*  ── ⚠️ DUE RIGHE, PERCHÉ SONO DUE COSE ─────────────────────────
            Qui c'era una riga sola, «IVA incassata dai clienti», con dentro
            `ivaADebito` — che comprende anche l'imposta autoliquidata sugli
            acquisti esteri. Quella nessun cliente l'ha mai pagata: se la
            addebita l'azienda a se' stessa, e la ritrova subito dopo fra
            quelle detratte. Su un trimestre con Meta la riga diceva 4.805 €
            «incassati» quando dai clienti ne erano arrivati 4.400: chi va a
            cercarli sull'estratto conto non li trova, e ha ragione lui. */}
        <Riga
          etichetta="IVA incassata dai clienti"
          nota="denaro dello Stato che ci passa dalle mani"
          valore={conto.ivaADebito - conto.ivaAutoliquidata}
          tenue
        />
        {conto.ivaAutoliquidata > 0 && (
          <Riga
            etichetta="IVA che ti addebiti da solo"
            nota="inversione contabile sugli acquisti esteri: la metti tu, e la ritrovi qui sotto fra quelle detratte — se è detraibile il saldo è zero"
            valore={conto.ivaAutoliquidata}
            tenue
          />
        )}
        <Riga
          etichetta="IVA detratta sugli acquisti"
          nota={
            conto.ivaACredito > 0
              ? conto.ivaAutoliquidata > 0
                ? "dalle fatture dei fornitori, dalle voci detraibili e dall'inversione contabile"
                : "dalle fatture dei fornitori e dalle voci segnate come detraibili"
              : "nessuna voce segnata come detraibile"
          }
          valore={-conto.ivaACredito}
          tenue
        />
        {/*  ── ⚠️ IL CREDITO CHE ARRIVA DAL PERIODO PRIMA ─────────────────
            Non e' una impostazione: e' un dato di QUESTO periodo, e viene
            dalla liquidazione precedente come e' stata fatta — quella del
            commercialista, che puo' non coincidere con la stima qui dentro.
            Percio' si scrive a mano, e finche' non lo si scrive vale zero:
            un credito inventato farebbe versare MENO del dovuto, che e' il
            verso in cui sbagliare costa. */}
        <RigaCredito
          valore={creditoPrecedente}
          onCambia={onCredito}
          quiCredito={conto.creditoIvaDaRiportare}
        />
        <Riga etichetta="IVA da versare" valore={conto.ivaDaVersare} uscita />
        {/*  ── ⚠️ IL CREDITO CHE AVANZA SI DICE ────────────────────────────
            Con «IVA da versare: 0» e nient'altro si crede che non ci sia
            niente. Invece c'è un credito che si porta al periodo dopo, e un
            credito dimenticato è denaro dell'azienda che resta allo Stato.
            Compare solo quando c'è: una riga a zero fissa insegna a saltarla. */}
        {conto.creditoIvaDaRiportare > 0 && (
          <Riga
            etichetta="Credito IVA che avanza"
            nota="non si versa niente: questo credito si porta al periodo dopo, dillo al commercialista"
            valore={conto.creditoIvaDaRiportare}
          />
        )}
        <Riga etichetta="Costi che abbassano l'utile" valore={-conto.costiDeducibili} uscita />
        <Riga etichetta="Utile imponibile" valore={conto.utileImponibile} forte />
        <Riga etichetta={`IRES ${aliquote.ires}%`} valore={-conto.ires} uscita />
        {/*  ⚠️ L'IRAP NON SI CALCOLA SULL'UTILE, e qui invece si fa cosi'.
            La sua base imponibile e' un'altra — certi costi del personale non
            si deducono — quindi questa e' la riga piu' approssimativa di tutto
            il conto. La scritta in cima dice gia' che e' un conto gestionale,
            ma quella vale per tutto: questa riga in particolare merita di
            dirlo da se', o si legge come le altre. */}
        <Riga
          etichetta={`IRAP ${aliquote.irap}%`}
          nota="calcolata sull'utile per semplicità: la base vera dell'IRAP è un'altra, e la sa il commercialista"
          valore={-conto.irap}
          uscita
        />
        <Riga etichetta="Utile dopo le imposte" valore={conto.utileDopoLeImposte} />
        <Riga
          etichetta="Costi che NON si scaricano"
          nota="pagati davvero, ma non abbassano le imposte: si tolgono qui, per intero"
          valore={-conto.costiNonDeducibili}
          uscita
        />
        <Riga
          etichetta="Incassi registrati senza IVA"
          nota="fuori dal fatturato, quindi fuori dalle imposte: si aggiungono qui, per intero"
          valore={conto.incassiSenzaIva}
        />
        <Riga etichetta="Utile reale" valore={conto.utileReale} forte />
      </ul>
    </Scheda>
  );
}

function Cifra({
  etichetta,
  valore,
  colore,
  nota,
}: {
  etichetta: string;
  valore: number;
  colore: string;
  nota?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {etichetta}
      </div>
      <div className={cn("text-[21px] font-bold leading-tight tabular-nums", colore)}>
        {eur(valore)}
      </div>
      {nota && <div className="text-[11px] text-slate-500">{nota}</div>}
    </div>
  );
}

/** ── LA RIGA DEL CREDITO CHE ARRIVA DA PRIMA ──────────────────────────────
 *  L'unica riga scrivibile del conto, e ha una ragione: quel numero non lo sa
 *  questo programma — lo sa la liquidazione precedente, che l'ha fatta il
 *  commercialista e può non coincidere con la stima qui dentro.
 *  ⚠️ COMPARE SEMPRE, anche a zero. È il contrario della regola che uso per il
 *   resto della pagina (una riga a zero si nasconde), e il motivo è che qui lo
 *   zero non è un fatto: è «nessuno l'ha ancora scritto». Nascosta, un credito
 *   di ottocento euro resterebbe non riportato per sempre senza che niente lo
 *   ricordi — e si versa allo Stato una cifra che non si deve. */
function RigaCredito({
  valore,
  onCambia,
  quiCredito,
}: {
  valore: number;
  onCambia: (v: number) => void;
  quiCredito: number;
}) {
  const [testo, setTesto] = useState(valore > 0 ? scriviEuro(valore) : "");
  useEffect(() => {
    setTesto(valore > 0 ? scriviEuro(valore) : "");
  }, [valore]);
  return (
    <li className="flex items-baseline justify-between gap-3 px-4 py-1.5">
      <span className="min-w-0">
        <span className="block">− Credito IVA dal periodo precedente</span>
        <span className="block text-[11.5px] leading-snug text-muted-foreground">
          {valore > 0
            ? "si sottrae da quello che versi: veniva dalla liquidazione prima"
            : "se la liquidazione precedente si è chiusa a credito, scrivilo qui: si sottrae da quello che versi"}
        </span>
      </span>
      <Input
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={() => onCambia(Math.max(0, leggiEuro(testo)))}
        inputMode="decimal"
        placeholder="0,00"
        title={
          quiCredito > 0
            ? `Attenzione: anche questo periodo si chiude a credito (${scriviEuro(quiCredito)} €), quindi non c'è niente da versare comunque.`
            : "Lo trovi sulla liquidazione precedente, alla voce «credito da riportare»."
        }
        className="h-7 w-28 shrink-0 text-right text-[13px] tabular-nums"
      />
    </li>
  );
}

function Riga({
  etichetta,
  nota,
  valore,
  forte,
  uscita,
  tenue,
}: {
  etichetta: string;
  nota?: string;
  valore: number;
  forte?: boolean;
  uscita?: boolean;
  tenue?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-baseline justify-between gap-3 px-4 py-1.5",
        forte && "bg-slate-50/70",
        tenue && "opacity-70",
      )}
    >
      <span className="min-w-0">
        <span className={cn("block", forte && "font-bold")}>
          {uscita ? "− " : forte ? "= " : ""}
          {etichetta}
        </span>
        {nota && <span className="block text-[11px] leading-snug text-slate-500">{nota}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          forte ? "text-[16px] font-bold" : "text-[13.5px] font-semibold",
          uscita ? "text-rose-700" : valore < 0 ? "text-rose-700" : "text-slate-800",
        )}
      >
        {eur(valore)}
      </span>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I COSTI, VOCE PER VOCE
   ═════════════════════════════════════════════════════════════════════════ */

/** Una voce del periodo con dentro le sue righe: il totale si legge sempre, il
 *  dettaglio si apre. */
interface VoceRaggruppata {
  chiave: string;
  titolo: string;
  totale: number;
  deducibile: number;
  non: number;
  iva: number;
  quante: number;
  righe: CostoContabile[];
}

/** ── I COSTI, VOCE PER VOCE, E DENTRO OGNI VOCE ────────────────────────────
 *  ⚠️ RAGGRUPPATI e non riga per riga: le righe sono centinaia — ogni pratica
 *   ne porta tre o quattro — e un elenco di centinaia di righe non si guarda e
 *   non si gira a nessuno. La spunta si mette sulla VOCE, che è il livello a
 *   cui la domanda ha senso: «l'installatore lo scarico?» è una domanda
 *   sull'installatore, non su quel singolo pagamento.
 *
 *  ── ⚠️ MA LA VOCE SI APRE, ED ERA QUELLO CHE MANCAVA ──────────────────────
 *  «Impianto 2.010 €» senza poterci guardare dentro è un numero che si può
 *  solo accettare: alla domanda del commercialista — «cosa c'è in questi
 *  duemila euro?» — si rispondeva andando a riaprire le schede una per una.
 *  Adesso la riga si preme e mostra le sue, con di chi sono e di che giorno.
 *
 *  ⚠️ DUE BERSAGLI DISTINTI, E NON UNO DENTRO L'ALTRO: la riga apre il
 *   dettaglio, la pastiglia a destra apre la regola. Erano la stessa cosa —
 *   premere ovunque apriva la regola — e per vedere cosa c'era dentro una voce
 *   ci si ritrovava davanti una finestra che chiedeva da quando si scarica.
 *   Un pulsante dentro un pulsante non si può fare (i browser lo riparano
 *   spostandone uno fuori dall'altro, e si preme una cosa e ne parte
 *   un'altra), quindi sono affiancati.
 *
 *  ⚠️ DENTRO IL DETTAGLIO SI VEDE ANCHE LA REGOLA CHE HA COLPITO OGNI RIGA.
 *   È l'unico posto in cui una voce «in parte» si spiega: due costi identici,
 *   uno dedotto e uno no, con accanto scritto da quale mese vale la regola che
 *   li ha divisi. Senza, quella dicitura sembra un errore di calcolo. */
function VociDeiCosti({
  voci,
  regole,
  onRegola,
  onCsv,
  onApriLead,
}: {
  voci: VoceRaggruppata[];
  regole: RegoleContabili;
  onRegola: (titolo: string) => void;
  /** Assente = non c'è niente da esportare, e il pulsante non compare: un
   *  comando che scarica un file vuoto si prova una volta sola. */
  onCsv?: () => void;
  onApriLead?: (id: string) => void;
}) {
  const [aperte, setAperte] = useState<Set<string>>(new Set());
  const apriChiudi = (k: string) =>
    setAperte((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <Scheda
      titolo="I costi del periodo"
      nota="Premi una voce per vedere cosa c'è dentro, la pastiglia per dire da quando si scarica"
      icona={FileText}
      azioni={
        onCsv && (
          <Button variant="outline" size="sm" onClick={onCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV per il commercialista
          </Button>
        )
      }
      senzaPadding
    >
      {voci.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
          Nessun costo in questo periodo.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {voci.map((v) => {
            const oggi = regolaOggi(v.titolo, regole);
            const misto = v.deducibile > 0 && v.non > 0;
            /*  ── ⚠️ LA PASTIGLIA DICEVA LA SPUNTA, NON IL RISULTATO ──────
                Su una voce vietata per legge — carburante o trasferta pagati
                in contanti — la regola scritta puo' benissimo dire «si
                scarica», perche' nessuno l'ha mai cambiata: non serviva.
                La pastiglia diventava verde e la riga accanto diceva «non si
                scarica», sulla stessa riga. E cliccandola si apriva una
                finestra in cui spuntare una casella che su quel costo non
                cambia niente, senza che niente lo dicesse.
                Il divieto vince, quindi la pastiglia dice il divieto. */
            const vietate = v.righe.filter((r) => r.bloccoDiLegge);
            const perLegge = vietate.length > 0 && vietate.length === v.righe.length;
            const perche = vietate[0]?.bloccoDiLegge ?? "";
            const aperta = aperte.has(v.chiave);
            return (
              <li key={v.chiave}>
                <div className="flex items-center gap-2 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => apriChiudi(v.chiave)}
                    aria-expanded={aperta}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
                        aperta && "rotate-90",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{v.titolo}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {v.quante} {v.quante === 1 ? "voce" : "voci"}
                        {perLegge
                          ? ` · ${perche}`
                          : misto
                            ? vietate.length > 0
                              ? ` · ${eur(v.deducibile)} si scarica, ${eur(v.non)} no — su una parte il pagamento non era tracciato`
                              : ` · ${eur(v.deducibile)} si scarica, ${eur(v.non)} no — la regola è cambiata dentro al periodo`
                            : v.non > 0
                              ? " · non si scarica"
                              : " · si scarica"}
                        {v.iva > 0 && ` · ${eur(v.iva)} di IVA detratta`}
                      </span>
                    </span>
                  </button>
                  {/*  La pastiglia dice lo stato E apre la regola: è il posto
                      in cui uno guarda per sapere come è trattata quella voce,
                      quindi è anche il posto in cui prova a cambiarla. */}
                  <button
                    type="button"
                    onClick={() => onRegola(v.titolo)}
                    title={
                      perLegge
                        ? `${perche} La spunta qui dentro non cambia questo: se invece hai pagato con carta o bonifico, correggilo sulla fattura.`
                        : `Da quando «${v.titolo}» si scarica`
                    }
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold transition",
                      perLegge
                        ? "bg-rose-100 text-rose-800 hover:bg-rose-200"
                        : misto
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : oggi.scaricabile
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100",
                    )}
                  >
                    {perLegge
                      ? "vietato per legge"
                      : misto
                        ? "in parte"
                        : oggi.scaricabile
                          ? "si scarica"
                          : "non si scarica"}
                  </button>
                  <span className="w-24 shrink-0 text-right text-[13.5px] font-semibold tabular-nums">
                    {eur(v.totale)}
                  </span>
                </div>

                {aperta && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
                    {v.righe.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-baseline gap-3 py-1.5 pl-10 pr-4 text-[12.5px]"
                      >
                        <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
                          {r.data ? dataBreve(r.data) : "senza data"}
                        </span>
                        {/*  ⚠️ IL NOME PORTA ALLA PERSONA, quando c'è una
                            persona. Dalla contabilità si finisce sempre per
                            chiedersi «e questo chi era?»: senza il
                            collegamento tocca copiare il nome, aprire i lead,
                            cercarlo — tre gesti per una domanda che ne merita
                            zero. Dove non c'è una scheda (spese fisse, fatture
                            dei fornitori) resta testo: un finto collegamento
                            che non porta da nessuna parte è peggio di nessun
                            collegamento. */}
                        <span className="min-w-0 flex-1 truncate">
                          {r.leadId && onApriLead ? (
                            <button
                              type="button"
                              onClick={() => onApriLead(r.leadId as string)}
                              className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600"
                              title={`Apri la scheda di ${r.dettaglio}`}
                            >
                              {r.dettaglio}
                            </button>
                          ) : (
                            r.dettaglio || "—"
                          )}
                          <span className="ml-1.5 text-[10.5px] text-muted-foreground">
                            {ORIGINE[r.origine]}
                          </span>
                        </span>
                        {/*  ⚠️ SI SCRIVE DA QUANDO VALE LA REGOLA CHE HA
                            COLPITO QUESTA RIGA, non solo l'esito: è l'unico
                            posto in cui una voce «in parte» smette di sembrare
                            un errore di calcolo. */}
                        <span
                          className={cn(
                            "shrink-0 text-[10.5px]",
                            r.scaricabile ? "text-emerald-700" : "text-rose-700",
                          )}
                          title={
                            r.daQuandoVale === DA_SEMPRE
                              ? "Nessuna regola scritta: vale il ripiego"
                              : `Regola in vigore da ${meseLeggibile(r.daQuandoVale)}`
                          }
                        >
                          {r.scaricabile ? "si scarica" : "non si scarica"}
                          {r.daQuandoVale !== DA_SEMPRE && ` · da ${r.daQuandoVale}`}
                        </span>
                        {r.ivaDetraibile > 0 && (
                          <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                            IVA {eur(r.ivaDetraibile)}
                          </span>
                        )}
                        <span className="w-20 shrink-0 text-right tabular-nums">
                          {eur(r.importo)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Scheda>
  );
}

/** Da dove viene un costo, in una parola: dentro il dettaglio è la differenza
 *  fra «l'ho scritto su una scheda» e «c'è una fattura». */
const ORIGINE: Record<CostoContabile["origine"], string> = {
  pratica: "dalla scheda",
  mese: "spesa fissa",
  fornitore: "fattura ricevuta",
  pubblicita: "pubblicità",
};

/* ═══════════════════════════════════════════════════════════════════════════
   COSA SI SCARICA E COSA NO — l'elenco completo
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ PERCHÉ QUESTA SCHEDA ESISTE, OLTRE ALL'ELENCO DEI COSTI ───────────
 *  Nell'elenco dei costi si può cambiare la regola di una voce, ma solo se
 *  quella voce ha dei costi NEL PERIODO che si sta guardando. Sembra
 *  ragionevole e lascia fuori due casi che capitano subito:
 *   · impostare una voce PRIMA che arrivi il costo — «da gennaio
 *     l'installatore non si scarica più», deciso a dicembre;
 *   · ritrovare una regola scritta mesi fa per una voce che in questo periodo
 *     non compare. Quella regola c'è e decide, ma non la trova più nessuno per
 *     cambiarla: è il tipo di cosa che poi si scopre guardando un conto che
 *     non torna.
 *  Qui ci sono TUTTE: quelle viste nel periodo e quelle che hanno una regola
 *  scritta, anche se in questo trimestre non hanno speso un euro. E da qui si
 *  può aggiungerne una nuova scrivendo il nome.
 *
 *  ⚠️ DUE COSE DIVERSE, E LE PAROLE LO DICONO. «Si scarica» è il costo che
 *   abbassa l'utile imponibile (deducibile); «IVA detraibile» è l'imposta che
 *   si porta in detrazione. Un costo può essere l'uno e non l'altro — una
 *   fattura senza IVA si scarica ma non fa detrarre niente — e chiamarli
 *   tutti e due «scaricare» è il modo di sbagliare la liquidazione. */
function CosaSiScarica({
  voci,
  regole,
  onRegola,
}: {
  /** Le voci viste nel periodo. */
  voci: { chiave: string; titolo: string }[];
  regole: RegoleContabili;
  onRegola: (titolo: string) => void;
}) {
  const [nuova, setNuova] = useState("");

  //  Tutte insieme, senza ripetizioni: quelle del periodo e quelle che hanno
  //  una regola scritta. Le seconde possono non avere costi qui.
  const tutte = useMemo(() => {
    const m = new Map<string, { chiave: string; titolo: string; nelPeriodo: boolean }>();
    for (const v of voci) m.set(v.chiave, { ...v, nelPeriodo: true });
    for (const v of vociConRegola(regole)) {
      if (!m.has(v.chiave)) m.set(v.chiave, { ...v, nelPeriodo: false });
    }
    return [...m.values()].sort((a, b) => a.titolo.localeCompare(b.titolo, "it"));
  }, [voci, regole]);

  return (
    <Scheda
      titolo="Cosa si scarica e cosa no"
      nota="Vale da un mese in poi: quello che è già passato non cambia"
      icona={Landmark}
      senzaPadding
    >
      {tutte.length === 0 ? (
        <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
          Nessuna voce ancora. Appena scrivi un costo o carichi una fattura compare qui.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {tutte.map((v) => {
            const r = regolaOggi(v.titolo, regole);
            const storia = regole[v.chiave] ?? [];
            return (
              <li key={v.chiave}>
                <button
                  type="button"
                  onClick={() => onRegola(v.titolo)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{v.titolo}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {storia.length === 0
                        ? "nessuna regola scritta: vale il ripiego"
                        : storia.length === 1
                          ? //  ⚠️ `periodoLeggibile` e non solo l'inizio: con
                            //   gli intervalli «da marzo 2026» su una regola
                            //   che finiva a giugno direbbe una cosa falsa —
                            //   e la direbbe proprio nell'elenco che si
                            //   guarda per sapere com'è messa una voce.
                            periodoLeggibile(storia[0])
                          : `${storia.length} cambi, l'ultimo ${periodoLeggibile([...storia].sort((a, b) => b.da.localeCompare(a.da))[0])}`}
                      {/*  ⚠️ Si dice quando una voce NON ha costi qui: senza,
                          sembra che il periodo non torni. */}
                      {!v.nelPeriodo && " · nessun costo in questo periodo"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      r.scaricabile ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                    )}
                  >
                    {r.scaricabile ? "si scarica" : "non si scarica"}
                  </span>
                  <span
                    className={cn(
                      "w-28 shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-semibold",
                      r.ivaDetraibile
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {r.ivaDetraibile ? "IVA detraibile" : "IVA non detratta"}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── AGGIUNGERNE UNA CHE NON C'È ANCORA ────────────────────────────
          Serve per decidere PRIMA che il costo arrivi: «da gennaio
          l'installatore non si scarica più», scritto a dicembre. Senza, la
          regola si può mettere solo dopo aver già registrato un costo con il
          trattamento sbagliato. */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-2">
        <Input
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          placeholder="Una voce che non è ancora in elenco…"
          className="h-8 flex-1 text-[13px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && nuova.trim()) {
              onRegola(nuova.trim());
              setNuova("");
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!nuova.trim()}
          onClick={() => {
            onRegola(nuova.trim());
            setNuova("");
          }}
        >
          Imposta
        </Button>
      </div>
    </Scheda>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA FINESTRA CHE CAMBIA UNA REGOLA — è qui che vive il tempo
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ NON UNA SPUNTA: UNA DATA E UNA SPUNTA ─────────────────────────────
 *  È la differenza fra questa versione e quella di prima, e vale la pena
 *  ripeterla dove si preme. Cambiare «si scarica» senza dire DA QUANDO
 *  vorrebbe dire riscrivere anche i mesi già chiusi: l'utile imponibile del
 *  trimestre scorso — un numero già letto, magari già girato — cambierebbe da
 *  solo, senza un avviso. Qui si sceglie il mese, e il passato resta quello che
 *  era.
 *
 *  ⚠️ IL MESE PROPOSTO È QUELLO CORRENTE, che è cosa si intende dicendo «da
 *   adesso». Si può spostare indietro — a ottobre ci si accorge di una cosa
 *   vera da luglio — e in quel caso la finestra SCRIVE QUANTI MESI CHIUSI si
 *   stanno riscrivendo. È una cosa legittima e non deve essere una sorpresa.
 *
 *  ⚠️ LA STORIA SI VEDE. Sotto c'è l'elenco dei cambi già fatti: senza, dopo
 *   tre mesi nessuno ricorda più perché un costo di luglio è trattato in un
 *   modo e quello di settembre in un altro — e la prima cosa che si pensa è
 *   che il programma sbagli. */
function FinestraRegola({
  titolo,
  regole,
  onChiudi,
  onSalva,
}: {
  titolo: string;
  regole: RegoleContabili;
  onChiudi: () => void;
  onSalva: (regole: RegoleContabili) => void;
}) {
  /** ── ⚠️ TOGLIERE UNA REGOLA, NON SOLO SCRIVERNE UN'ALTRA ────────────────
   *  Finché le regole erano solo «da qui in poi», sbagliarne una si rimediava
   *  scrivendone un'altra sopra. Con gli intervalli no: un intervallo scritto
   *  per errore — le date scambiate, la voce sbagliata — non si disfa
   *  scrivendoci sopra, perché quello che si scrive è comunque UNA regola. Si
   *  restava con una decisione in archivio che nessuno voleva.
   *  ⚠️ E si toglie una RIGA per volta, quella che si è appena sbagliata, non
   *   tutta la storia: cancellare i cambi vecchi vorrebbe dire riscrivere i
   *   conti dei mesi in cui valevano — cioè il difetto che questa cartella
   *   esiste per impedire. */
  const storia = regole[chiaveVoce(titolo)] ?? [];
  const inVigore = regolaOggi(titolo, regole);
  const [scaricabile, setScaricabile] = useState(inVigore.scaricabile);
  const [ivaDetraibile, setIvaDetraibile] = useState(inVigore.ivaDetraibile);
  /** ── ⚠️ DAL MESE O DAL GIORNO ────────────────────────────────────────
   *  Il mese è il caso normale ed è quello che si spiega in una riga: «da
   *  settembre in poi, no». Il giorno serve quando è successo qualcosa di
   *  preciso — il fornitore ha aperto la partita IVA il 17, il contratto è
   *  finito il 20 — e in quel caso arrotondare al mese vorrebbe dire trattare
   *  male sedici giorni.
   *  ⚠️ VA SAPUTO COSA COMPORTA IL GIORNO: quel mese avrà due trattamenti
   *   diversi al suo interno, e chi legge la liquidazione deve poterlo
   *   spiegare. Per questo il foglio per il commercialista scrive la data
   *   esatta e non il mese, e la finestra lo dice prima che si salvi. */
  const [precisione, setPrecisione] = useState<"mese" | "giorno">("mese");
  /** ── ⚠️ DA QUANDO IN POI, OPPURE DA QUANDO A QUANDO ──────────────────
   *  «In poi» è il caso normale: una decisione presa vale finché non se ne
   *  prende un'altra. «Fino a» serve per i periodi che si sa già essere finiti
   *  — un fornitore che per tre mesi non ha fatturato, un contratto sospeso —
   *  e prima costringeva a scrivere DUE regole: quella che apre e quella che
   *  richiude. Chi si scordava la seconda trattava male tutti i mesi
   *  successivi, e non se ne accorgeva perché non succedeva niente. */
  const [conFine, setConFine] = useState(false);
  const [aMese, setAMese] = useState(meseCorrente());
  const [aGiorno, setAGiorno] = useState(() => new Date().toISOString().slice(0, 10));
  const [da, setDa] = useState(meseCorrente());
  const [giorno, setGiorno] = useState(() => new Date().toISOString().slice(0, 10));
  /*  ⚠️ Se l'ultima regola scritta era al giorno, la finestra si riapre al
      giorno. Senza, chi la riapre per correggere un dettaglio la riporterebbe
      al mese senza accorgersene — e sedici giorni cambierebbero trattamento
      per una distrazione. */
  useEffect(() => {
    const ultima = [...storia].sort((a, b) => b.da.localeCompare(a.da))[0];
    if (ultima && /^\d{4}-\d{2}-\d{2}$/.test(ultima.da)) setPrecisione("giorno");
    //  E se l'ultima era un intervallo, si riapre con la fine accesa: senza,
    //  chi la riapre per correggere una spunta la trasformerebbe in una regola
    //  «in poi» — cioè estenderebbe a tutti i mesi futuri una cosa che valeva
    //  per tre.
    if (ultima?.a) {
      setConFine(true);
      if (/^\d{4}-\d{2}-\d{2}$/.test(ultima.a)) setAGiorno(ultima.a);
      setAMese(ultima.a.slice(0, 7));
    }
    //  Solo all'apertura: dopo comanda chi preme le pastiglie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  //  Quello che si salva davvero: uno dei due, secondo la precisione scelta.
  const momento = precisione === "giorno" ? giorno : da;
  //  ⚠️ La fine si conserva SEMPRE come giorno: scegliendo un mese è il suo
  //   ULTIMO giorno. Tenendola come «2026-06» la regola smetterebbe di valere
  //   il 1º giugno invece che il 30 — quattro settimane trattate male da un
  //   confronto fra stringhe (vedi `a` in contabilita-regole).
  const fine = conFine ? (precisione === "giorno" ? aGiorno : fineDelMese(aMese)) : undefined;
  //  Una fine prima dell'inizio non è un intervallo: è un errore di battitura,
  //  e salvata darebbe una regola che non copre mai niente.
  const fineSbagliata = !!fine && fine < momento;
  const [nota, setNota] = useState("");

  const toccati = mesiToccatiDa(momento);

  return (
    <Finestra
      aperta
      onCambio={(v) => {
        if (!v) onChiudi();
      }}
      titolo={titolo}
      contesto="Da quando si scarica, e da quando no"
      icona={Landmark}
      larghezza="md"
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button variant="outline" onClick={onChiudi}>
            Annulla
          </Button>
          <Button
            disabled={fineSbagliata}
            onClick={() =>
              onSalva(
                conRegola(regole, titolo, {
                  da: momento,
                  ...(fine ? { a: fine } : {}),
                  scaricabile,
                  ivaDetraibile,
                  ...(nota.trim() ? { nota: nota.trim() } : {}),
                }),
              )
            }
          >
            Salva la regola
          </Button>
        </>
      }
    >
      <SezioneFinestra
        titolo="Come va trattato"
        nota="Vale per i costi di questa voce, dal mese scelto in poi"
      >
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2">
            <input
              type="checkbox"
              checked={scaricabile}
              onChange={(e) => setScaricabile(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
            />
            <span className="text-[13px]">
              <span className="block font-medium">Si scarica (costo deducibile)</span>
              <span className="block text-[11.5px] leading-snug text-muted-foreground">
                Abbassa l&apos;utile su cui si pagano IRES e IRAP. Senza la spunta il costo si paga
                lo stesso, ma le imposte si calcolano come se non ci fosse — e viene tolto alla
                fine, per intero, dall&apos;utile reale.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2">
            <input
              type="checkbox"
              checked={ivaDetraibile}
              onChange={(e) => setIvaDetraibile(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
            />
            <span className="text-[13px]">
              <span className="block font-medium">L&apos;IVA si detrae (imposta detraibile)</span>
              <span className="block text-[11.5px] leading-snug text-muted-foreground">
                Spenta di partenza: detrarre l&apos;IVA di un costo senza una fattura valida abbassa
                l&apos;IVA da versare, ed è l&apos;errore che costa. Sulle fatture dei fornitori
                caricate l&apos;imposta si legge dal documento, non si stima.
              </span>
            </span>
          </label>
        </div>
      </SezioneFinestra>

      <SezioneFinestra
        titolo="Da quando"
        nota="Il passato resta com'era: questa regola vale da qui in avanti"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {/*  Due pastiglie e non una tendina: sono due, e per due voci una
              tendina è un tocco in più per niente. */}
          <div className="flex shrink-0 gap-1 rounded-lg border border-slate-200 p-0.5">
            {(["mese", "giorno"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrecisione(p)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition",
                  precisione === p
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {p === "mese" ? "Dal mese" : "Dal giorno"}
              </button>
            ))}
          </div>
          {precisione === "mese" ? (
            <Input
              type="month"
              value={da}
              onChange={(e) => setDa(e.target.value || meseCorrente())}
              className="min-w-0 flex-1"
            />
          ) : (
            <Input
              type="date"
              value={giorno}
              onChange={(e) => setGiorno(e.target.value || new Date().toISOString().slice(0, 10))}
              className="min-w-0 flex-1"
            />
          )}
        </div>
        {/* ── FINO A QUANDO ────────────────────────────────────────────────
            Spento è «in poi», che è quello che si intende quasi sempre.
            Acceso chiude l'intervallo, e dopo quella data torna a valere quello
            che valeva prima — senza doversi ricordare di scrivere una seconda
            regola che richiude. */}
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={conFine}
            onChange={(e) => setConFine(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-slate-900"
          />
          <span>Solo fino a una certa data, poi torna com&apos;era</span>
        </label>
        {conFine && (
          <div className="mt-1.5">
            {precisione === "mese" ? (
              <Input
                type="month"
                value={aMese}
                onChange={(e) => setAMese(e.target.value || meseCorrente())}
              />
            ) : (
              <Input
                type="date"
                value={aGiorno}
                onChange={(e) =>
                  setAGiorno(e.target.value || new Date().toISOString().slice(0, 10))
                }
              />
            )}
          </div>
        )}

        <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
          {fineSbagliata ? (
            <span className="font-medium text-rose-600">
              La fine è prima dell&apos;inizio: così la regola non varrebbe per nessun costo.
            </span>
          ) : fine ? (
            `Vale per i costi dal ${meseLeggibile(momento)} al ${meseLeggibile(fine)}. Dopo torna a valere quello che valeva prima.`
          ) : precisione === "mese" ? (
            `Vale per i costi dal 1º di ${meseLeggibile(da)} in poi.`
          ) : (
            `Vale per i costi dal ${meseLeggibile(giorno)} in poi — quel mese avrà due trattamenti al suo interno, e il foglio per il commercialista scriverà la data esatta.`
          )}
        </p>
      </SezioneFinestra>

      {toccati.length > 0 && (
        <NotaFinestra tono="attenzione">
          Stai riscrivendo {toccati.length}{" "}
          {toccati.length === 1 ? "mese già chiuso" : "mesi già chiusi"}
          {toccati.length <= 6 ? ` (${toccati.map(meseLeggibile).join(", ")})` : ""}: i conti di{" "}
          {toccati.length === 1 ? "quel mese" : "quei mesi"} cambieranno. Se li avevi già girati al
          commercialista, avvisalo.
        </NotaFinestra>
      )}

      <CampoFinestra etichetta="Perché" nota="Facoltativo, e serve al commercialista più che a te">
        <Input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="da settembre fattura regolarmente…"
        />
      </CampoFinestra>

      {storia.length > 0 && (
        <SezioneFinestra titolo="Com'è cambiata finora">
          <ul className="flex flex-col divide-y divide-border text-[12.5px]">
            {[...storia]
              .sort((a, b) => b.da.localeCompare(a.da))
              .map((r) => (
                <li key={r.da} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="block">{periodoLeggibile(r)}</span>
                    {r.nota && (
                      <span className="block text-[11px] text-muted-foreground">{r.nota}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        r.scaricabile
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      )}
                    >
                      {r.scaricabile ? "si scarica" : "non si scarica"}
                      {r.ivaDetraibile ? " · IVA detratta" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSalva(senzaRegola(regole, titolo, r.da))}
                      title="Togli questo cambio: i costi di quel periodo tornano a valere quello che valeva prima"
                      aria-label={`Togli il cambio ${periodoLeggibile(r)}`}
                      className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </SezioneFinestra>
      )}
    </Finestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LE ALIQUOTE
   ═════════════════════════════════════════════════════════════════════════ */

function FinestraAliquote({
  aperta,
  aliquote,
  onCambio,
  onSalva,
}: {
  aperta: boolean;
  aliquote: Aliquote;
  onCambio: (v: boolean) => void;
  onSalva: (a: Aliquote) => void;
}) {
  const [a, setA] = useState(aliquote);
  useEffect(() => {
    if (aperta) setA(aliquote);
  }, [aperta, aliquote]);
  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo="Le aliquote"
      contesto="Cambiano per legge: si impostano, non stanno scritte nel programma"
      icona={Landmark}
      larghezza="sm"
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button variant="outline" onClick={() => onCambio(false)}>
            Annulla
          </Button>
          <Button
            onClick={() => {
              onSalva(a);
              onCambio(false);
            }}
          >
            Salva
          </Button>
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <CampoFinestra etichetta="IRES %">
          <Input
            value={String(a.ires)}
            onChange={(e) => setA((x) => ({ ...x, ires: Number(e.target.value) || 0 }))}
            inputMode="decimal"
          />
        </CampoFinestra>
        <CampoFinestra etichetta="IRAP %">
          <Input
            value={String(a.irap)}
            onChange={(e) => setA((x) => ({ ...x, irap: Number(e.target.value) || 0 }))}
            inputMode="decimal"
          />
        </CampoFinestra>
        <CampoFinestra etichetta="IVA %">
          <Input
            value={String(a.iva)}
            onChange={(e) => setA((x) => ({ ...x, iva: Number(e.target.value) || 0 }))}
            inputMode="decimal"
          />
        </CampoFinestra>
      </div>
      <NotaFinestra>
        L&apos;IRAP ha una base imponibile sua, che non è l&apos;utile: qui è una stima, e la pagina
        lo dice. Il conto vero lo fa il commercialista.
      </NotaFinestra>
    </Finestra>
  );
}

/** ── APRIRE LA FINESTRA DI STAMPA ─────────────────────────────────────────
 *  Il foglio lo COSTRUISCE `costruisciFoglio` (crm/contabilita-foglio), che è
 *  una funzione pura e quindi si può provare; qui resta solo il gesto di
 *  aprirlo.
 *  ⚠️ LA SEPARAZIONE NON È PER ELEGANZA. Questi fogli sono template annidati
 *   dentro altri template, e in questo stesso progetto un `${` protetto per
 *   errore ha già mandato in stampa un documento con scritto alla lettera
 *   «${riga("Impianto", d.prodotto)}» al posto del prodotto — un difetto che
 *   leggendo il codice non si vede e sul foglio consegnato si vede benissimo.
 *   Separata, la si rende in memoria e ci si conta sopra i segnaposto rimasti. */
function stampaPerIlCommercialista(
  conto: ReturnType<typeof calcolaContoFiscale>,
  aliquote: Aliquote,
  periodo: Periodo,
  azienda: DatiAzienda,
  regole: RegoleContabili,
) {
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Il browser ha bloccato la finestra di stampa", {
      description: "Consenti le finestre a comparsa per questo sito e riprova.",
    });
    return;
  }
  w.document.write(costruisciFoglio(conto, aliquote, periodo, azienda, regole));
  w.document.close();
}
