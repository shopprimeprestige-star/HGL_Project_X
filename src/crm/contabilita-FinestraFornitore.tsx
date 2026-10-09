/** ── REGISTRARE UNA FATTURA RICEVUTA CHE NON È UN XML ──────────────────────
 *
 *  Serve per tutte quelle che un XML non ce l'hanno: Meta, Google, Amazon,
 *  Alibaba, i fornitori cinesi e americani. Mandano un PDF, non un file dello
 *  SDI, perché non sono tenuti a mandarlo.
 *
 *  ── IL PDF SI LEGGE, MA NON FA FEDE ───────────────────────────────────────
 *  Si carica il PDF, il programma prova a leggerci dentro e RIEMPIE i campi;
 *  chi carica controlla i numeri con il documento davanti e conferma. La
 *  fattura resta segnata «scritta a mano», perché è quello che è: un numero
 *  che una persona ha confermato. Dall'XML invece i numeri si LEGGONO — il
 *  tracciato è fisso — e quella distinzione non si può perdere. Il perché per
 *  esteso sta in `crm/contabilita-pdf`.
 *
 *  ── ⚠️ IL REGIME LO SCEGLIE CHI CARICA, NON IL PROGRAMMA ──────────────────
 *  Sarebbe comodo dedurlo dal paese — «Cina, quindi importazione» — e sarebbe
 *  sbagliato: dallo stesso paese arrivano beni (importazione, IVA in dogana) e
 *  servizi (autofattura, inversione contabile), e «Amazon» può essere la
 *  società lussemburghese, quella italiana o quella americana. Il paese mette
 *  in cima le scelte plausibili e avvisa quando stonano; sceglie una persona.
 *
 *  ── ⚠️ IL CAMBIO NON LO INVENTA NESSUNO ───────────────────────────────────
 *  Una fattura cinese arriva in dollari. In contabilità va in euro, al cambio
 *  del giorno dell'operazione: prenderlo da un servizio a caso e scriverlo in
 *  un registro contabile vorrebbe dire mettere un numero che non corrisponde a
 *  nessun documento. Si chiede l'importo IN EURO — quello uscito davvero dal
 *  conto, o quello che indica il commercialista — e la valuta originale resta
 *  scritta accanto perché il controllo sia possibile.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Paperclip, Receipt, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { leggiEuro, scriviEuro } from "./euro";
import { eur } from "./ui";
import { CampoFinestra, Finestra, NotaFinestra, SezioneFinestra } from "./ui/Finestra";
import { leggiPdf, proponiDalTesto } from "./contabilita-pdf";
import { eFoglioDiCalcolo, leggiFoglio } from "./contabilita-xls";
import {
  adempimento,
  regimeDi,
  spiegaPerEsteso,
  stonatura,
  verdetto,
  zonaDelPaese,
} from "./contabilita-regimi";
import type { DatiAzienda } from "./fatture/tipi";
import { METODI, serveIlMetodo, type MetodoPagamento } from "./contabilita-tracciabilita";
import {
  REGIMI,
  TETTO_ALLEGATO,
  idDelDocumento,
  nuovoIdAMano,
  salvaAllegato,
  salvaFornitore,
  type FatturaFornitore,
  type RegimeIva,
} from "./contabilita-fornitori";

const oggiISO = () => new Date().toISOString().slice(0, 10);

/** ── ⚠️ SI APRE ANCHE PER CORREGGERE ──────────────────────────────────────
 *  Passando `daCorreggere` la finestra si riempie con quella fattura e la
 *  riscrive sulla STESSA chiave. Serve perché qui si scrivono numeri a mano, e
 *  a mano si sbaglia: senza, l'unico rimedio a una cifra sbagliata era
 *  cancellare e riscrivere tutto — perdendo l'allegato, che nessuno ha voglia
 *  di ricaricare, e con la scheda che nel frattempo era già entrata nel conto
 *  del periodo.
 *  ⚠️ L'ALLEGATO SI CONSERVA se non se ne carica un altro: correggere una
 *   cifra non deve buttare via il documento che quella cifra la dimostra. */
export function FinestraFornitore({
  aperta,
  daCorreggere,
  azienda,
  esistenti,
  pdfIniziale,
  proposta,
  avvisoCategoria,
  onCambio,
  onSalvata,
}: {
  aperta: boolean;
  daCorreggere?: FatturaFornitore | null;
  /** La NOSTRA società: serve a una cosa sola e importante — accorgersi che
   *  la fattura caricata l'abbiamo emessa noi. Vedi `emessaDaNoi`. */
  azienda?: DatiAzienda;
  /** Quelle già in archivio: servono ad accorgersi di star ricaricando una
   *  fattura che c'è già. Vedi `giaCaricata`. */
  esistenti?: FatturaFornitore[];
  /** Un PDF già scelto dalla pagina: si legge appena la finestra si apre. */
  pdfIniziale?: File | null;
  /** ── LA RIGA GIÀ IMPOSTATA, MA NON ANCORA SALVATA ─────────────────────
   *  La usa «Registra la bolletta»: apre la finestra con dentro il mestiere
   *  già fatto — fornitore, regime, causale, il rimando alla fattura — e i
   *  soli due numeri che stanno sulla bolletta da battere a mano.
   *  ⚠️ È DIVERSA DA `daCorreggere`: quella modifica una riga che esiste,
   *   questa ne PROPONE una nuova. Confonderle vorrebbe dire sovrascrivere
   *   la fattura del fornitore con la sua bolletta doganale. */
  proposta?: Partial<FatturaFornitore> | null;
  /** ── QUELLO CHE LA CATEGORIA SCELTA VUOLE FAR SAPERE ───────────────────
   *  «Se ne deduce il 75%», «l'IVA non si detrae»: arriva dal primo passo del
   *  caricamento e si mostra IN CIMA, prima dei campi.
   *  ⚠️ Prima e non dopo, come il verdetto: una regola che si legge quando il
   *   modulo è già pieno serve solo a spiegare una scelta già fatta. */
  avvisoCategoria?: string;
  onCambio: (v: boolean) => void;
  onSalvata: () => void;
}) {
  const [fornitore, setFornitore] = useState("");
  const [partitaIva, setPartitaIva] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [paese, setPaese] = useState("");
  const [data, setData] = useState(oggiISO());
  const [numero, setNumero] = useState("");
  const [regime, setRegime] = useState<RegimeIva>("italiana");
  const [imponibile, setImponibile] = useState("");
  const [imposta, setImposta] = useState("");
  const [aliquotaReverse, setAliquotaReverse] = useState("22");
  const [valuta, setValuta] = useState("");
  const [importoValuta, setImportoValuta] = useState("");
  const [note, setNote] = useState("");
  const [metodo, setMetodo] = useState<MetodoPagamento | "">("");
  const [notaDiCredito, setNotaDiCredito] = useState(false);
  /** ⚠️ È una proforma: entra come costo ma NON nei registri IVA. Il perché
   *  per esteso sta sul campo `proforma` in crm/contabilita-fornitori. */
  const [proforma, setProforma] = useState(false);
  const [ritenuta, setRitenuta] = useState("");
  /** La valuta letta dal documento, euro compreso: serve a dire «è in euro»
   *  invece di mostrare due campi vuoti che sembrano da riempire. */
  const [monetaVista, setMonetaVista] = useState("");
  const [valutaAperta, setValutaAperta] = useState(false);
  /** true = il documento caricato è una NOSTRA fattura. Blocca il
   *  salvataggio: un ricavo registrato come costo è un errore a quattro cifre
   *  che nessuna somma torna a smentire. */
  const [nostraFattura, setNostraFattura] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [letto, setLetto] = useState<string[]>([]);
  /** Quali campi ha riempito il documento: si mostrano in una riga, perché
   *  «li ha compilati lui» e «li ho scritti io» non possono somigliarsi. */
  const [presiDalFile, setPresiDalFile] = useState<string[]>([]);
  const [inCorso, setInCorso] = useState(false);
  const [inLettura, setInLettura] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  /** ── LA PROVA DI PAGAMENTO ─────────────────────────────────────────────
   *  La ricevuta PayPal, la contabile del bonifico. Sta accanto al documento
   *  e non dentro: sono due carte diverse e servono tutte e due — il perché
   *  per esteso sta su `conProvaPagamento` in crm/contabilita-fornitori. */
  const [pagamento, setPagamento] = useState<File | null>(null);
  const pagamentoRef = useRef<HTMLInputElement | null>(null);
  /** ── LA BOLLETTA DOGANALE ──────────────────────────────────────────────
   *  Compare solo sulle importazioni. ⚠️ Allegarla NON detrae l'imposta: il
   *  perché per esteso sta su `conBollettaDoganale` in contabilita-fornitori,
   *  e la finestra lo dice a chi la carica. */
  const [dogana, setDogana] = useState<File | null>(null);
  const doganaRef = useRef<HTMLInputElement | null>(null);
  /** ⚠️ Questo documento porta l'imposta e basta, non un costo: è la bolletta
   *  doganale registrata a sé. Il perché sta su `soloImposta` in
   *  crm/contabilita-fornitori — in due parole, il costo della merce è già
   *  sulla fattura del fornitore e contarlo due volte abbassa l'utile. */
  const [soloImposta, setSoloImposta] = useState(false);
  /** Quanta parte se ne deduce. Vuoto = tutto. Vedi contabilita-categorie. */
  const [percentuale, setPercentuale] = useState("");
  /** Quanta IVA si detrae. Vuoto = tutta. ⚠️ Numero diverso dal precedente. */
  const [percIva, setPercIva] = useState("");

  /** ── LEGGERE UN PDF E RIEMPIRE I CAMPI ────────────────────────────────
   *  ⚠️ RIEMPIE SOLO QUELLO CHE È VUOTO. Rileggendo un secondo PDF, o
   *   caricandolo dopo aver già corretto a mano una cifra, sovrascrivere
   *   cancellerebbe la correzione — cioè la cosa che una persona ha fatto
   *   apposta perché il riconoscimento aveva sbagliato. */
  const leggiIlFile = async (f: File) => {
    setFile(f);
    /*  ── ⚠️ NON SOLO PDF: ANCHE I FOGLI DI CALCOLO ──────────────────────
        I fornitori esteri mandano quello che gli pare, e quelli cinesi
        mandano quasi sempre un Excel. Prima quei file si potevano allegare ma
        non si leggevano: tutti i numeri andavano ribattuti a mano da un
        foglio in inglese, ed è il momento in cui una cifra si sbaglia.
        Il testo esce nella STESSA forma di un PDF e lo interpreta lo stesso
        `proponiDalTesto`: due riconoscitori diversi vorrebbero dire due idee
        diverse di che cos'è un imponibile. */
    const foglio = eFoglioDiCalcolo(f.name, f.type);
    const ePdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
    if (!ePdf && !foglio) {
      setLetto([]);
      return;
    }
    setInLettura(true);
    const dati = await f.arrayBuffer();
    const lettura = await (foglio ? leggiFoglio(dati, f.name) : leggiPdf(dati)).catch(() => null);
    setInLettura(false);
    if (!lettura || !lettura.ok) {
      setLetto([
        lettura?.motivo ||
          `il ${foglio ? "foglio" : "PDF"} non si è potuto leggere: i numeri si scrivono a mano.`,
      ]);
      return;
    }
    const p = proponiDalTesto(lettura.testo, azienda);
    setNostraFattura(p.emessaDaNoi === true);
    /*  ── ⚠️ IL DOCUMENTO SOSTITUISCE, NON RIEMPIE I BUCHI ────────────────
        Prima ogni campo si riempiva solo se era vuoto (`x || letto`), per non
        cancellare una correzione fatta a mano. Sembrava prudente ed era il
        difetto: caricando il PDF DOPO aver scritto due cose a caso, o
        cambiando documento, restavano dentro i valori vecchi accanto a quelli
        nuovi — una riga metà di una fattura e metà di un'altra, che è la sola
        cosa peggiore di una riga vuota.
        Caricare un documento è un IMPORT: quello che c'è scritto nel file
        vince, si vede scritto quali campi ha toccato, e da lì in poi si
        corregge a mano quello che serve. */
    const presi: string[] = [];
    const metti = <T,>(v: T | undefined | null, come: string, set: (x: T) => void) => {
      if (v == null || v === "") return;
      set(v);
      presi.push(come);
    };
    metti(p.fornitore, "fornitore", setFornitore);
    metti(p.partitaIva, "partita IVA", setPartitaIva);
    metti(p.paese, "paese", setPaese);
    metti(p.data, "data", setData);
    metti(p.numero, "numero", setNumero);
    metti(p.descrizione, "cosa hai comprato", setDescrizione);
    metti(p.regime, "come si tratta l'IVA", setRegime);
    metti(p.imponibile != null ? scriviEuro(p.imponibile) : undefined, "importo", setImponibile);
    metti(p.imposta != null ? scriviEuro(p.imposta) : undefined, "IVA", setImposta);
    metti(p.aliquota != null ? String(p.aliquota) : undefined, "aliquota", setAliquotaReverse);
    metti(p.valuta, "valuta", setValuta);
    metti(
      p.importoValuta != null ? scriviEuro(p.importoValuta) : undefined,
      "importo in valuta",
      setImportoValuta,
    );
    if (p.notaDiCredito) {
      setNotaDiCredito(true);
      presi.push("nota di credito");
    }
    if (p.proforma) {
      setProforma(true);
      presi.push("proforma");
    }
    if (p.valutaVista) {
      setMonetaVista(p.valutaVista);
      presi.push("valuta");
    }
    setPresiDalFile(presi);
    setLetto(
      p.spiega.length
        ? p.spiega
        : ["Letto dal PDF. Controlla i numeri con il documento davanti prima di salvare."],
    );
  };

  useEffect(() => {
    if (!aperta) return;
    //  ⚠️ O si riempie con quella da correggere, O si riparte da VUOTO. I dati
    //   lasciati da un'apertura precedente sono il modo più silenzioso di
    //   registrare due volte lo stesso acquisto sotto un altro nome.
    /*  ⚠️ TRE STRADE, IN QUEST'ORDINE: la riga da correggere se c'è, altrimenti
        la riga PROPOSTA da chi ha aperto la finestra («Registra la bolletta»),
        altrimenti vuoto. La proposta non è una correzione: crea una riga
        nuova, e scambiarle vorrebbe dire sovrascrivere la fattura del
        fornitore con la sua bolletta doganale. */
    const f = daCorreggere ?? (proposta as FatturaFornitore | undefined) ?? null;
    setFornitore(f?.fornitore ?? "");
    setPartitaIva(f?.partitaIva ?? "");
    setDescrizione(
      f?.righe
        ?.map((r) => r.descrizione)
        .filter(Boolean)
        .join(" · ") ?? "",
    );
    setPaese(f?.paese ?? "");
    setData(f?.data ?? oggiISO());
    setNumero(f?.numero ?? "");
    setRegime(f?.regime ?? "italiana");
    setImponibile(f && f.imponibile > 0 ? scriviEuro(f.imponibile) : "");
    setImposta(f && f.imposta > 0 ? scriviEuro(f.imposta) : "");
    setAliquotaReverse(String(f?.aliquotaReverse ?? 22));
    setValuta(f?.valuta ?? "");
    setImportoValuta(f?.importoValuta ? scriviEuro(f.importoValuta) : "");
    setNote(f?.note ?? "");
    setMetodo(f?.metodoPagamento ?? "");
    setNotaDiCredito(f?.notaDiCredito === true);
    setProforma(f?.proforma === true);
    setSoloImposta(f?.soloImposta === true);
    setPercentuale(f?.percentualeDeducibile != null ? String(f.percentualeDeducibile) : "");
    setPercIva(f?.percentualeIva != null ? String(f.percentualeIva) : "");
    setRitenuta(f?.ritenuta ? scriviEuro(f.ritenuta) : "");
    setNostraFattura(false);
    setMonetaVista("");
    setValutaAperta(false);
    setFile(null);
    setLetto([]);
    setPresiDalFile([]);
    setInCorso(false);
    if (fileRef.current) fileRef.current.value = "";
    //  Il PDF scelto dalla pagina si legge subito: chi lo ha trascinato lì si
    //  aspetta di trovare la finestra già piena, non un altro pulsante.
    if (pdfIniziale) void leggiIlFile(pdfIniziale);
    //  ⚠️ `leggiIlFile` NON va fra le dipendenze: si ricrea a ogni disegno, e
    //   metterla qui farebbe rileggere il PDF a ogni battuta di tasto —
    //   cancellando, ogni volta, la correzione appena fatta a mano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperta, daCorreggere, pdfIniziale]);

  const imp = Math.max(0, leggiEuro(imponibile));
  const iva = Math.max(0, leggiEuro(imposta));
  //  Il totale è la somma, e si mostra: chi copia da una fattura ha davanti un
  //  totale, e vedere che torna è il controllo che si fa senza pensarci.
  const totale = Math.round((imp + iva) * 100) / 100;
  /** ── ⚠️ QUESTA FATTURA C'È GIÀ ────────────────────────────────────────
   *  Da quando il PDF si legge da solo, ricaricare la cartella del mese è un
   *  gesto da due secondi — e senza questo avviso il secondo giro
   *  raddoppierebbe il trimestre. La chiave è la stessa che usa l'XML
   *  (`idDelDocumento`), quindi il salvataggio SOSTITUISCE invece di
   *  sdoppiare; ma sostituire in silenzio è un'altra cosa da nascondere, e
   *  qui si dice prima. */
  const idProposto = daCorreggere?.id ?? idDelDocumento(partitaIva, fornitore, data, numero);
  const giaCaricata =
    !daCorreggere && idProposto ? esistenti?.find((f) => f.id === idProposto) : undefined;
  const puo = !!fornitore.trim() && !!data && imp > 0 && !inCorso && !nostraFattura;
  const v = verdetto({
    regime,
    paese,
    notaDiCredito,
    emessaDaNoi: nostraFattura,
    imposta: iva,
    autoliquidata: (imp * (Number(aliquotaReverse) || 22)) / 100,
  });
  const scelto = regimeDi(regime);
  const stona = stonatura(paese, regime);

  //  ── ⚠️ IL METODO DI PAGAMENTO SI CHIEDE QUASI MAI ────────────────────
  //   Solo dove la legge lo guarda: carburante, trasferte, rappresentanza. Il
  //   perché — e perché chiederlo dove non serve fa danno — sta in
  //   `crm/contabilita-tracciabilita`.
  const domanda = useMemo(
    () => serveIlMetodo(fornitore, note, letto.join(" ")),
    [fornitore, note, letto],
  );

  /** L'ordine dei regimi: quelli plausibili per il paese scritto vanno in
   *  cima. ⚠️ NESSUNO SPARISCE — il paese può essere sbagliato, e una lista
   *  che nasconde la scelta giusta costringe a cancellare il paese per
   *  ritrovarla. Tranne il vecchio «reverse», che compare solo se è già il
   *  valore di questa fattura: proporlo su una nuova vorrebbe dire creare
   *  altre righe senza adempimento. */
  const regimiVisibili = useMemo(() => {
    const zona = zonaDelPaese(paese);
    return REGIMI.filter((r) => !r.daPrecisare || r.chiave === regime).sort((a, b) => {
      const p = (r: (typeof REGIMI)[number]) =>
        r.chiave === regime ? 0 : zona && r.dove === zona ? 1 : r.dove === "OVUNQUE" ? 3 : 2;
      return p(a) - p(b);
    });
  }, [paese, regime]);

  const salva = async () => {
    if (!puo) return;
    setInCorso(true);
    //  Correggendo si riscrive la STESSA chiave: un id nuovo lascerebbe in
    //  archivio anche la versione sbagliata, e il costo risulterebbe doppio.
    const id = idProposto || nuovoIdAMano();
    const autoliquida = regimeDi(regime).autoliquida;
    const f: FatturaFornitore = {
      id,
      fornitore: fornitore.trim(),
      //  ⚠️ QUI C'ERA UNA STRINGA VUOTA MURATA. La partita IVA del fornitore
      //   veniva riconosciuta dal documento e poi buttata via al salvataggio:
      //   nell'elenco per il commercialista la colonna restava vuota proprio
      //   per le fatture estere, che sono quelle su cui la si va a cercare.
      partitaIva: partitaIva.trim().toUpperCase(),
      data,
      numero: numero.trim(),
      imponibile: imp,
      //  Con l'inversione contabile il fornitore NON addebita imposta: quella
      //  scritta qui sarebbe una cifra che nessuno ha pagato.
      imposta: regime === "italiana" ? iva : 0,
      totale: regime === "italiana" ? totale : imp,
      //  Una riga sola con cosa è stato comprato: senza, in contabilità resta
      //  il solo nome del fornitore, e fra sei mesi «Shenzhen Hair Co. ·
      //  3.730 €» non risponde più alla domanda per cui la si va a cercare.
      righe: descrizione.trim()
        ? [
            {
              descrizione: descrizione.trim(),
              quantita: 1,
              prezzoUnitario: imp,
              aliquota: regime === "italiana" ? (imp > 0 ? Math.round((iva / imp) * 100) : 0) : 0,
              totale: imp,
            },
          ]
        : [],
      originale: "",
      nomeFile: file?.name ?? daCorreggere?.nomeFile ?? "",
      aMano: true,
      caricataIl: daCorreggere?.caricataIl ?? new Date().toISOString(),
      paese: paese.trim().toUpperCase() || undefined,
      regime,
      ...(autoliquida ? { aliquotaReverse: Number(aliquotaReverse) || 22 } : {}),
      ...(valuta.trim() ? { valuta: valuta.trim().toUpperCase() } : {}),
      ...(leggiEuro(importoValuta) > 0 ? { importoValuta: leggiEuro(importoValuta) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(metodo ? { metodoPagamento: metodo } : {}),
      //  ⚠️ Gli importi restano POSITIVI, come sul documento: il segno lo gira
      //   `effettiContabili`, in un posto solo. Vedi `notaDiCredito` in
      //   crm/contabilita-fornitori.
      ...(notaDiCredito ? { notaDiCredito: true } : {}),
      ...(proforma ? { proforma: true } : {}),
      ...(leggiEuro(ritenuta) > 0 ? { ritenuta: leggiEuro(ritenuta) } : {}),
      //  ⚠️ Senza un file nuovo resta quello di prima: correggere una cifra
      //   non deve buttare via il documento che quella cifra la dimostra.
      conAllegato: file ? true : (daCorreggere?.conAllegato ?? false),
      //  ⚠️ Come sopra: senza un file nuovo resta quello di prima. Correggere
      //   una cifra non deve buttare via la ricevuta che dimostra il pagamento.
      ...(pagamento || daCorreggere?.conProvaPagamento ? { conProvaPagamento: true } : {}),
      ...(dogana || daCorreggere?.conBollettaDoganale ? { conBollettaDoganale: true } : {}),
      ...(soloImposta ? { soloImposta: true } : {}),
      //  ⚠️ Si scrive solo se è diversa da tutto: un campo «100» su ogni
      //   fattura sarebbe rumore in archivio, e il conto legge «assente» e
      //   «100» allo stesso modo.
      ...(percentuale.trim() !== "" && Number(percentuale) !== 100
        ? { percentualeDeducibile: Math.min(100, Math.max(0, Number(percentuale) || 0)) }
        : {}),
      ...(percIva.trim() !== "" && Number(percIva) !== 100
        ? { percentualeIva: Math.min(100, Math.max(0, Number(percIva) || 0)) }
        : {}),
    };

    if (file) {
      if (file.size > TETTO_ALLEGATO) {
        setInCorso(false);
        toast.error("Il file è troppo grande", {
          description: `Il limite è 2 MB e questo ne pesa ${(file.size / 1024 / 1024).toFixed(1)}. Riducilo, oppure salva la fattura senza allegato.`,
        });
        return;
      }
      const b64 = await new Promise<string>((risolvi, rifiuta) => {
        const lettore = new FileReader();
        lettore.onload = () => risolvi(String(lettore.result ?? "").split(",")[1] ?? "");
        lettore.onerror = () => rifiuta(new Error("il file non si è potuto leggere"));
        lettore.readAsDataURL(file);
      }).catch(() => "");
      if (!b64) {
        setInCorso(false);
        toast.error("Il file non si è potuto leggere", {
          description: "Puoi salvare la fattura senza allegato e riprovare dopo.",
        });
        return;
      }
      const e = await salvaAllegato(id, {
        contenuto: b64,
        nome: file.name,
        tipo: file.type || "application/pdf",
      });
      if (e) {
        setInCorso(false);
        toast.error("L'allegato non è stato salvato", { description: e });
        return;
      }
    }

    /*  ── LA PROVA DI PAGAMENTO, NELLA SUA CHIAVE ────────────────────────
        ⚠️ Se non si salva, la fattura SI SALVA LO STESSO e lo si dice: la
        registrazione del costo non deve dipendere da una ricevuta che è
        facoltativa. Il contrario — perdere la fattura perché la contabile del
        bonifico pesava troppo — sarebbe un baratto che nessuno ha chiesto. */
    if (pagamento) {
      if (pagamento.size > TETTO_ALLEGATO) {
        toast.warning("La prova di pagamento non è stata allegata", {
          description: `Il limite è 2 MB e questa ne pesa ${(pagamento.size / 1024 / 1024).toFixed(1)}. La fattura viene salvata lo stesso.`,
        });
      } else {
        const b64p = await new Promise<string>((risolvi) => {
          const lettore = new FileReader();
          lettore.onload = () => risolvi(String(lettore.result ?? "").split(",")[1] ?? "");
          lettore.onerror = () => risolvi("");
          lettore.readAsDataURL(pagamento);
        });
        const ep = b64p
          ? await salvaAllegato(
              id,
              { contenuto: b64p, nome: pagamento.name, tipo: pagamento.type || "application/pdf" },
              "pagamento",
            )
          : "il file non si è potuto leggere";
        if (ep) {
          toast.warning("La prova di pagamento non è stata allegata", { description: ep });
        }
      }
    }

    if (dogana) {
      if (dogana.size > TETTO_ALLEGATO) {
        toast.warning("La bolletta doganale non è stata allegata", {
          description: `Il limite è 2 MB e questa ne pesa ${(dogana.size / 1024 / 1024).toFixed(1)}. La fattura viene salvata lo stesso.`,
        });
      } else {
        const b64d = await new Promise<string>((risolvi) => {
          const lettore = new FileReader();
          lettore.onload = () => risolvi(String(lettore.result ?? "").split(",")[1] ?? "");
          lettore.onerror = () => risolvi("");
          lettore.readAsDataURL(dogana);
        });
        const ed = b64d
          ? await salvaAllegato(
              id,
              { contenuto: b64d, nome: dogana.name, tipo: dogana.type || "application/pdf" },
              "dogana",
            )
          : "il file non si è potuto leggere";
        if (ed) toast.warning("La bolletta doganale non è stata allegata", { description: ed });
      }
    }

    const e = await salvaFornitore(f);
    setInCorso(false);
    if (e) {
      toast.error("La fattura non è stata salvata", { description: e });
      return;
    }
    toast.success(
      daCorreggere
        ? `${f.fornitore} · corretta in ${eur(f.totale)}`
        : `${f.fornitore} · ${notaDiCredito ? `−${eur(f.totale)} accreditati` : `${eur(f.totale)} registrata`}`,
      { description: adempimento(regime) },
    );
    onCambio(false);
    onSalvata();
  };

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo={daCorreggere ? "Correggi la fattura" : "Fattura ricevuta"}
      contesto={
        daCorreggere
          ? `${daCorreggere.fornitore} · resta la stessa riga, con i numeri corretti`
          : "Carica il PDF e lo leggo, oppure scrivi i numeri a mano"
      }
      icona={FileUp}
      larghezza="md"
      classeCorpo="space-y-3"
      azioni={
        <>
          <Button variant="outline" onClick={() => onCambio(false)} disabled={inCorso}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={!puo}>
            {inCorso
              ? "Salvo…"
              : nostraFattura
                ? "Non si può salvare: è una tua fattura"
                : daCorreggere
                  ? "Salva le correzioni"
                  : "Salva la fattura"}
          </Button>
        </>
      }
    >
      {avvisoCategoria && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
          <p className="text-[12.5px] leading-relaxed text-sky-900">{avvisoCategoria}</p>
        </div>
      )}

      {/* ── IL PDF, IN CIMA ──────────────────────────────────────────────
          È il primo gesto: si carica il documento e i campi si riempiono da
          soli. Sta prima di tutto il resto perché è quello che fa risparmiare
          il lavoro; sotto restano i campi, per chi ha solo la carta. */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xls,.xlsx,.xlsm,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leggiIlFile(f);
            }}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={inLettura}
          >
            {file ? (
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <ScanLine className="mr-1.5 h-3.5 w-3.5" />
            )}
            {inLettura ? "Leggo…" : file ? "Cambia documento" : "Carica il PDF"}
          </Button>
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
            {file
              ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB`
              : daCorreggere?.conAllegato
                ? `${daCorreggere.nomeFile || "documento allegato"} · resta questo`
                : "PDF o immagine, fino a 2 MB. Resta in archivio e si riscarica"}
          </span>
        </div>
        {presiDalFile.length > 0 && (
          <p className="mt-2 border-t border-slate-200 pt-2 text-[11.5px] leading-snug">
            <strong className="text-emerald-700">Letti dal documento:</strong>{" "}
            <span className="text-slate-600">{presiDalFile.join(" · ")}</span>. Controllali con la
            fattura davanti, poi salva.
          </p>
        )}
        {letto.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-[11.5px] leading-snug text-muted-foreground">
            {letto.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        )}
      </div>

      {/* ── LA PROVA CHE QUEI SOLDI SONO USCITI ──────────────────────────
          ⚠️ SEPARATA DAL DOCUMENTO, e non è pignoleria: il documento dice CHE
           COSA hai comprato, questa dice CHE L'HAI PAGATO. In una verifica su
           un fornitore estero è la seconda a reggere la deduzione, e nessuna
           delle due sostituisce l'altra.
          ⚠️ E su un pagamento in valuta è l'unico posto dove sta scritto
           quanti EURO sono usciti davvero — cambio e commissioni comprese.
           È il numero che va nel campo dell'importo qui sotto, e non un
           cambio preso da internet: quello vero è quello che ha applicato chi
           ha mosso i soldi. */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            ref={pagamentoRef}
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPagamento(f);
            }}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={() => pagamentoRef.current?.click()}>
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            {pagamento ? "Cambia la prova" : "Prova di pagamento"}
          </Button>
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
            {pagamento
              ? `${pagamento.name} · ${(pagamento.size / 1024).toFixed(0)} KB`
              : daCorreggere?.conProvaPagamento
                ? "ricevuta già allegata · resta questa"
                : "Ricevuta PayPal, contabile del bonifico, estratto conto. Facoltativa"}
          </span>
          {pagamento && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-[11.5px] text-muted-foreground"
              onClick={() => setPagamento(null)}
            >
              Togli
            </Button>
          )}
        </div>
      </div>

      {/* ── QUANTA PARTE SE NE DEDUCE ────────────────────────────────────
          Compare solo quando NON è tutto, cioè quando c'è qualcosa da sapere.
          ⚠️ E si può correggere: le percentuali del TUIR valgono nel caso
           normale, non in tutti. Il furgone che porta gli impianti e non fa
           altro è un veicolo strumentale e si deduce al 100% — chi lo sa lo
           scrive qui e lo motiva nelle note, che è esattamente quello che il
           commercialista chiederà. */}
      {(percentuale.trim() !== "" && Number(percentuale) !== 100) ||
      (percIva.trim() !== "" && Number(percIva) !== 100) ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
          <label className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-amber-900">Se ne deduce</span>
            <input
              type="number"
              min={0}
              max={100}
              value={percentuale}
              onChange={(e) => setPercentuale(e.target.value)}
              className="h-8 w-20 rounded-md border border-amber-300 bg-white px-2 text-[13px] tabular-nums"
            />
            <span className="text-amber-900">%</span>
            {imp > 0 && (
              <span className="text-[12px] text-amber-800">
                — abbassa l&apos;imponibile di{" "}
                <strong>{eur((imp * (Number(percentuale) || 0)) / 100)}</strong> invece che di{" "}
                {eur(imp)}. La differenza è uscita lo stesso e si vede nell&apos;utile reale.
              </span>
            )}
          </label>
          {/*  ── ⚠️ E L'IVA HA IL SUO NUMERO, NON LO STESSO ────────────────
              Sull'auto la legge fa dedurre il 20% del COSTO e detrarre il 40%
              dell'IVA: due articoli diversi, scritti in due anni diversi per
              due ragioni diverse. Un campo solo per tutte e due sembra una
              semplificazione e sbaglia sempre uno dei due conti.
              ⚠️ L'IVA che NON si detrae non si perde: resta dentro il costo,
               dove la legge la vuole. Non c'è nessun conto da fare a parte. */}
          <label className="mt-2 flex flex-wrap items-center gap-2 border-t border-amber-200 pt-2 text-[13px]">
            <span className="font-medium text-amber-900">Dell&apos;IVA se ne detrae</span>
            <input
              type="number"
              min={0}
              max={100}
              value={percIva}
              onChange={(e) => setPercIva(e.target.value)}
              placeholder="100"
              className="h-8 w-20 rounded-md border border-amber-300 bg-white px-2 text-[13px] tabular-nums"
            />
            <span className="text-amber-900">%</span>
            <span className="text-[12px] text-amber-800">
              Quella che non si detrae resta dentro il costo.
            </span>
          </label>
        </div>
      ) : null}

      {/* ── QUESTA RIGA PORTA SOLO L'IMPOSTA ─────────────────────────────
          Compare quando c'è: cioè su una riga nata da «Registra la bolletta»,
          o se qualcuno la spunta a mano. Non è una casella da mettere in giro
          per tutte le fatture — è la spiegazione di una riga particolare, e
          va letta proprio da chi ci si trova dentro.
          ⚠️ SI PUÒ SPEGNERE: se un giorno la si usa per un documento che un
           costo ce l'ha davvero, chi lo sa lo dice. */}
      {(soloImposta || regime === "italiana") && soloImposta && (
        <div className="rounded-lg border-2 border-sky-300 bg-sky-50 px-3 py-2.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={soloImposta}
              onChange={(e) => setSoloImposta(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-600"
            />
            <span className="text-[13px]">
              <span className="block font-medium text-sky-900">
                Porta solo l&apos;imposta, non un costo
              </span>
              <span className="block text-[11.5px] leading-snug text-sky-800">
                È la bolletta doganale: il costo della merce è già registrato sulla fattura del
                fornitore, e contarlo anche qui vorrebbe dire lo stesso acquisto due volte fra i
                costi. In contabilità questa riga porta{" "}
                {imposta ? eur(leggiEuro(imposta)) : "l'IVA"} di IVA a credito e nessun costo. I
                dazi, se ci sono, vanno su una riga loro.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* ── LA BOLLETTA DOGANALE, SOLO DOVE ESISTE ───────────────────────
          ⚠️ Solo sulle importazioni: su una fattura italiana o su un servizio
           estero una casella «bolletta doganale» non è un'opzione in più, è
           una domanda a cui non c'è risposta — e le domande senza risposta si
           riempiono a caso. */}
      {scelto.inDogana && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              ref={doganaRef}
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setDogana(f);
              }}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={() => doganaRef.current?.click()}>
              <FileUp className="mr-1.5 h-3.5 w-3.5" />
              {dogana ? "Cambia la bolletta" : "Bolletta doganale"}
            </Button>
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
              {dogana
                ? `${dogana.name} · ${(dogana.size / 1024).toFixed(0)} KB`
                : daCorreggere?.conBollettaDoganale
                  ? "bolletta già allegata · resta questa"
                  : "Il documento della dogana, o la fattura del corriere che ti rifattura l'IVA"}
            </span>
            {dogana && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-[11.5px] text-muted-foreground"
                onClick={() => setDogana(null)}
              >
                Togli
              </Button>
            )}
          </div>
          {/*  ── ⚠️ IL PUNTO IN CUI SI PERDONO I SOLDI ────────────────────
              Chi allega la bolletta pensa di aver finito. Non ha finito: il
              file attaccato qui è una prova, non una registrazione, e finché
              quella bolletta non è registrata come documento a sé l'imposta
              non torna indietro. La riga intanto sembra completa — ed è per
              questo che l'avviso c'è SEMPRE, anche quando il file è già
              allegato, e non solo la prima volta. */}
          <p className="mt-2 border-t border-amber-200 pt-2 text-[11.5px] leading-snug text-amber-900">
            <strong>Allegarla non detrae l&apos;IVA.</strong> Su questa fattura l&apos;imposta non
            c&apos;è: sta nella bolletta, e per riprenderla va registrata come documento a sé, con
            l&apos;IVA esposta («IVA italiana in fattura»). Controlla anche a chi è intestata: se
            l&apos;importatore non sei tu, quell&apos;IVA non è tua e il documento buono è la
            fattura del corriere.
          </p>
        </div>
      )}

      {/* ── ⚠️ IL VERDETTO, PRIMA DEI CAMPI E PRIMA DEL PULSANTE ────────
          Chi carica una fattura estera non si sta chiedendo quale sia il
          regime: si sta chiedendo «questa la posso scaricare, e adesso cosa
          devo fare». Saperlo DOPO aver salvato non serve a niente. */}
      {v.allarme ? (
        <div className="rounded-lg border-2 border-rose-300 bg-rose-50 px-3 py-2.5">
          <p className="text-[13.5px] font-semibold text-rose-900">{v.titolo}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-rose-800">{v.allarme}</p>
        </div>
      ) : (
        (presiDalFile.length > 0 || !!daCorreggere) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <p className="text-[13.5px] font-semibold">{v.titolo}</p>
            <dl className="mt-1.5 grid gap-x-3 gap-y-1 text-[12.5px] sm:grid-cols-[auto_1fr]">
              <dt className="font-medium text-muted-foreground">Il costo si scarica</dt>
              <dd className="leading-snug">{v.costo}</dd>
              <dt className="font-medium text-muted-foreground">L&apos;IVA</dt>
              <dd className="leading-snug">{v.iva}</dd>
            </dl>
            {v.passi.length > 0 && (
              <ol className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-[12px] leading-relaxed">
                {v.passi.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 font-semibold text-slate-500">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      )}

      {giaCaricata && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
          <strong>Questa fattura è già in archivio.</strong> Stesso fornitore, stessa data, stesso
          numero
          {giaCaricata.caricataIl
            ? ` (caricata il ${giaCaricata.caricataIl.slice(8, 10)}/${giaCaricata.caricataIl.slice(5, 7)})`
            : ""}
          . Salvando la <strong>sostituisci</strong>, non ne aggiungi una seconda: il costo resta
          contato una volta sola.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <CampoFinestra etichetta="Fornitore" obbligatorio>
          <Input
            value={fornitore}
            onChange={(e) => setFornitore(e.target.value)}
            placeholder="Meta Platforms Ireland, Shenzhen Hair Co.…"
          />
        </CampoFinestra>
        <CampoFinestra
          etichetta="Partita IVA del fornitore"
          nota="Come sta scritta sul documento: IE9692928F, DE811907980, 09876543210"
        >
          <Input
            value={partitaIva}
            onChange={(e) => setPartitaIva(e.target.value)}
            placeholder="IE9692928F"
          />
        </CampoFinestra>
        <CampoFinestra
          etichetta="Paese"
          nota="La sigla: IE, CN, US. Mette in cima i regimi plausibili, non decide"
        >
          <Input value={paese} onChange={(e) => setPaese(e.target.value)} placeholder="IE" />
        </CampoFinestra>
        <CampoFinestra etichetta="Data della fattura" obbligatorio>
          <Input
            type="date"
            value={data}
            max={oggiISO()}
            onChange={(e) => setData(e.target.value)}
          />
        </CampoFinestra>
        <CampoFinestra etichetta="Numero">
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="INV-2026-0912"
          />
        </CampoFinestra>
      </div>

      <CampoFinestra
        etichetta="Cosa hai comprato"
        nota="Resta scritto accanto al costo: fra sei mesi «Shenzhen Hair Co. · 3.730 €» da solo non dice niente"
      >
        <Input
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="Pubblicità Facebook, capelli 200 pz, consulenza contabile…"
        />
      </CampoFinestra>

      {/* ── IL REGIME ────────────────────────────────────────────────────
          Ogni scelta con scritto cosa comporta. È la decisione che rende
          giusti o sbagliati i numeri di un acquisto estero, e chi la prende
          deve poter leggere le conseguenze senza uscire di qui. */}
      <SezioneFinestra
        titolo="Chi ti ha mandato questa fattura"
        nota="Passa il mouse su una riga per la spiegazione lunga. Se non sei sicuro, guarda chi c'è scritto in cima alla fattura e se hai comprato una COSA o un SERVIZIO"
      >
        <div className="flex flex-col gap-1.5">
          {regimiVisibili.map((r) => (
            <label
              key={r.chiave}
              /*  ── ⚠️ LA SPIEGAZIONE LUNGA STA NEL TOOLTIP, NON NELLA RIGA ──
                  Otto voci con tre righe di spiegazione ciascuna fanno una
                  finestra che si scorre e non si legge: chi deve scegliere
                  salta tutto e clicca la prima. Nella riga resta la sola
                  domanda che chi ha la fattura in mano si sta facendo — di chi
                  è, e cosa ho comprato — e il resto compare se lo si cerca. */
              title={spiegaPerEsteso(r)}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition",
                regime === r.chiave
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="regime"
                checked={regime === r.chiave}
                onChange={() => setRegime(r.chiave)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-slate-900"
              />
              <span className="min-w-0 text-[13px]">
                <span className="block font-medium">
                  {r.titolo}
                  {r.tipoDocumento && (
                    <span className="ml-1.5 rounded bg-slate-200/70 px-1.5 py-px text-[10px] font-semibold tracking-wide text-slate-700">
                      {r.tipoDocumento}
                    </span>
                  )}
                </span>
                <span className="block text-[11.5px] leading-snug text-muted-foreground">
                  {r.chi}
                </span>
                {/*  Gli esempi e la conseguenza solo su quella scelta: sono la
                    conferma di aver preso la riga giusta, e servono dopo il
                    clic — non prima, quando moltiplicherebbero per otto la
                    roba da leggere. */}
                {regime === r.chiave && (
                  <>
                    <span className="mt-1 block text-[11.5px] leading-snug text-slate-600">
                      <strong>Per esempio:</strong> {r.esempi}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {r.spiega}
                    </span>
                  </>
                )}
              </span>
            </label>
          ))}
        </div>
      </SezioneFinestra>

      {stona && <NotaFinestra tono="attenzione">{stona}</NotaFinestra>}

      <div className="grid gap-2 sm:grid-cols-3">
        <CampoFinestra
          etichetta={regime === "italiana" ? "Imponibile" : "Importo in euro"}
          obbligatorio
          nota={regime === "italiana" ? undefined : "quello uscito davvero dal conto"}
        >
          <Input
            value={imponibile}
            onChange={(e) => setImponibile(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
          />
        </CampoFinestra>
        {regime === "italiana" ? (
          <>
            <CampoFinestra etichetta="IVA in fattura">
              <Input
                value={imposta}
                onChange={(e) => setImposta(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </CampoFinestra>
            <CampoFinestra etichetta="Totale" nota="calcolato: controlla che torni col documento">
              <Input
                value={totale > 0 ? scriviEuro(totale) : ""}
                readOnly
                className="bg-slate-50"
              />
            </CampoFinestra>
          </>
        ) : scelto.autoliquida ? (
          <CampoFinestra
            etichetta="Aliquota da applicare %"
            nota="il fornitore non la scrive: la metti tu"
          >
            <Input
              value={aliquotaReverse}
              onChange={(e) => setAliquotaReverse(e.target.value)}
              inputMode="decimal"
            />
          </CampoFinestra>
        ) : null}
      </div>

      {/* ── ⚠️ RIMBORSO O SPESA ──────────────────────────────────────────
          Una sola casella, ma è quella che gira il segno di tutta la riga.
          Sta subito sotto gli importi, dove chi ha appena scritto una cifra
          si sta chiedendo se è quella giusta — e non in fondo, dove la
          troverebbe dopo aver già salvato. */}
      <label
        className={cn(
          "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition",
          notaDiCredito
            ? "border-emerald-300 bg-emerald-50/70"
            : "border-slate-200 hover:bg-slate-50",
        )}
      >
        <input
          type="checkbox"
          checked={notaDiCredito}
          onChange={(e) => setNotaDiCredito(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-600"
        />
        <span className="text-[13px]">
          <span className="block font-medium">È una nota di credito (un rimborso)</span>
          <span className="block text-[11.5px] leading-snug text-muted-foreground">
            Il fornitore ti ridà dei soldi, o annulla una fattura di prima: un accredito di Meta, un
            reso di Amazon, uno sconto arrivato dopo. Scrivi gli importi POSITIVI, come sul
            documento: in contabilità vengono sottratti da soli.
          </span>
          {notaDiCredito && imp > 0 && (
            <span className="mt-1 block text-[12px] font-medium text-emerald-800">
              In contabilità toglierà {eur(regime === "italiana" ? totale : imp)} dai costi
              {regime === "italiana" && iva > 0 ? ` e ${eur(iva)} dall'IVA a credito` : ""}.
            </span>
          )}
        </span>
      </label>

      {/* ── ⚠️ È UNA PROFORMA ────────────────────────────────────────────
          Sta accanto alla nota di credito perché fa la stessa cosa: cambia il
          significato del documento, non una sua cifra. E qui si può SPEGNERE,
          e serve: certi fornitori intitolano «proforma» anche la fattura vera,
          e in quel caso il documento va registrato eccome. Chi ha il foglio
          davanti lo sa; il programma no, e non deve decidere al posto suo. */}
      <label
        className={cn(
          "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition",
          proforma ? "border-amber-300 bg-amber-50/70" : "border-slate-200 hover:bg-slate-50",
        )}
      >
        <input
          type="checkbox"
          checked={proforma}
          onChange={(e) => setProforma(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-600"
        />
        <span className="text-[13px]">
          <span className="block font-medium">È una proforma (non è ancora una fattura)</span>
          <span className="block text-[11.5px] leading-snug text-muted-foreground">
            Il documento che i fornitori esteri mandano per farsi pagare. Non è un documento
            fiscale: il costo si segue lo stesso, ma non entra nei registri IVA e non fa detrarre
            niente finché non arriva la fattura definitiva.
          </span>
          {proforma && (
            <span className="mt-1 block text-[12px] font-medium text-amber-800">
              Resta in contabilità come costo di {eur(totale)}, fuori dai registri IVA. Chiedi al
              fornitore la fattura definitiva e caricala al posto di questa.
            </span>
          )}
        </span>
      </label>

      {scelto.autoliquida && !proforma && imp > 0 && (
        <NotaFinestra>
          Autoliquiderai <strong>{eur((imp * (Number(aliquotaReverse) || 22)) / 100)}</strong> di
          IVA: va a debito e a credito insieme, quindi se è detraibile il saldo è zero.{" "}
          {scelto.tipoDocumento ? (
            <>
              Resta da trasmettere allo SDI il <strong>{scelto.tipoDocumento}</strong>, entro il 15
              del mese dopo quello in cui hai ricevuto il documento.
            </>
          ) : (
            <>
              Scegli la voce esatta — beni o servizi, UE o fuori — o non si sa quale documento vada
              trasmesso.
            </>
          )}
          {scelto.intrastat && ` Se superi le soglie serve anche l'INTRASTAT ${scelto.intrastat}.`}
        </NotaFinestra>
      )}
      {scelto.inDogana && (
        <NotaFinestra tono="attenzione">
          Da questa fattura non si detrae nessuna IVA: quella si paga in dogana. Quando arriva il{" "}
          <strong>documento doganale</strong>, caricalo come una fattura separata con «IVA italiana
          in fattura» — è quello a rendere l&apos;imposta detraibile. Trasporto e dazi che hai
          pagato sono costo: sommali all&apos;importo.
        </NotaFinestra>
      )}

      {/* ── ⚠️ IL METODO DI PAGAMENTO, SOLO QUANDO CONTA ─────────────────
          Su una fattura di pubblicità o di consulenza questo blocco non
          compare, ed è voluto: come hai pagato non cambia niente. Compare sul
          carburante e sulle trasferte, dove cambia tutto. */}
      {domanda.serve && (
        <SezioneFinestra titolo="Come l'hai pagata" nota={domanda.perche}>
          <div className="flex flex-wrap gap-1.5">
            {METODI.map((m) => (
              <button
                key={m.chiave}
                type="button"
                onClick={() => setMetodo(metodo === m.chiave ? "" : m.chiave)}
                title={m.nota}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition",
                  metodo === m.chiave
                    ? m.tracciato
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {m.titolo}
              </button>
            ))}
          </div>
          {metodo && !METODI.find((m) => m.chiave === metodo)?.tracciato && (
            <p className="mt-2 text-[11.5px] leading-snug text-rose-700">
              Segnata così, questa spesa entra fra i costi <strong>non deducibili</strong>: la paghi
              ma non abbassa le imposte, e l&apos;IVA non si detrae. Resta comunque contata
              nell&apos;utile reale, perché è uscita davvero.
            </p>
          )}
        </SezioneFinestra>
      )}

      {/*  ── ⚠️ LA RITENUTA SI CHIEDE SOLO SULLE FATTURE ITALIANE ────────
          Un professionista non residente non è soggetto a ritenuta italiana
          se il lavoro è svolto all'estero, e per le royalties ci sono le
          convenzioni. Chiederla su Meta insegnerebbe a rispondere a caso —
          la stessa ragione per cui il metodo di pagamento compare solo dove
          la legge lo guarda. */}
      {(regime === "italiana" || regime === "reverse_interno") && (
        <CampoFinestra
          etichetta="Ritenuta d'acconto trattenuta"
          nota="Sulle parcelle dei professionisti: l'importo scritto sul documento, non la percentuale. Vuoto se non c'è"
        >
          <Input
            value={ritenuta}
            onChange={(e) => setRitenuta(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className="text-right tabular-nums"
          />
        </CampoFinestra>
      )}
      {leggiEuro(ritenuta) > 0 && (
        <NotaFinestra tono="attenzione">
          Trattenendo {eur(leggiEuro(ritenuta))} diventi <strong>sostituto d&apos;imposta</strong>:
          vanno versati con l&apos;F24, codice <strong>1040</strong>, entro il 16 del mese dopo
          quello in cui hai pagato. E per quest&apos;anno ti tocca anche la Certificazione Unica
          (entro il 16 marzo) e il modello 770. Il costo resta {eur(imp)}: la ritenuta non lo
          abbassa, cambia solo quanto esce dal conto verso di lui.
        </NotaFinestra>
      )}

      {/* ── ⚠️ LA VALUTA SI MOSTRA SOLO SE SERVE ────────────────────────
          Due campi vuoti con dentro «USD» e «0,00» in grigio si leggono come
          campi da riempire, e su una fattura in euro non c'è NIENTE da
          riempire: il committente li ha segnalati due volte come «non si
          precompila». Un campo che deve restare vuoto è meglio non mostrarlo
          — e dire, invece, quello che si è capito.
          Non converte niente nessuno: vedi la nota in cima al file. */}
      {valuta || valutaAperta ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <CampoFinestra etichetta="Valuta del documento" nota="la sigla: USD, GBP, CNY">
            <Input value={valuta} onChange={(e) => setValuta(e.target.value)} placeholder="USD" />
          </CampoFinestra>
          <CampoFinestra
            etichetta="Importo originale"
            nota="quello scritto sul documento, non in euro"
          >
            <Input
              value={importoValuta}
              onChange={(e) => setImportoValuta(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </CampoFinestra>
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          {monetaVista === "EUR"
            ? "Il documento è in euro: non c'è nessun cambio da applicare."
            : "Se il documento non è in euro, l'importo originale va scritto accanto."}
          <button
            type="button"
            onClick={() => setValutaAperta(true)}
            className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11.5px] font-medium text-slate-700 transition hover:bg-slate-50"
          >
            È in un'altra valuta
          </button>
        </p>
      )}

      <CampoFinestra etichetta="Note" nota="ordine, cambio applicato, documento doganale">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </CampoFinestra>

      <NotaFinestra>
        <strong>Cosa resta da fare:</strong> {adempimento(regime)}. Il regime che scegli qui finisce
        sul foglio per il commercialista, accanto alla riga: il controllo lo fa chi è in grado di
        farlo.
      </NotaFinestra>
    </Finestra>
  );
}
