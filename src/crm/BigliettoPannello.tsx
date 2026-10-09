/** ─────────────────────────────────────────────────────────────────────────
 *  BigliettoPannello — LA FINESTRA DA CUI PARTE IL BIGLIETTO
 *
 *  COSA FA, DETTO COME LO VIVE CHI LO USA
 *  Il consulente ha appena fissato una consulenza. Preme il calendario sulla
 *  riga del lead e si apre questa finestra: dentro c'è il biglietto 1920×1080
 *  già disegnato — quello vero, non un facsimile — e quattro gesti in fila:
 *  copiare il link, scaricare il PNG, scaricare il PDF, aprire WhatsApp col
 *  messaggio già scritto.
 *
 *  L'ANTEPRIMA È IL FILE
 *  La `<canvas>` che si vede qui dentro è disegnata da `disegnaBiglietto`, la
 *  stessa funzione che riempie la tela poi esportata. Non è una ricostruzione
 *  in HTML che "assomiglia": una riproduzione fatta con i div si scollerebbe
 *  dal disegno vero alla prima misura cambiata, e il consulente scoprirebbe la
 *  differenza solo dopo aver mandato l'immagine al cliente. Qui, se il nome è
 *  troppo lungo e il saluto rimpicciolisce, si vede rimpicciolire.
 *  La tela resta 1920×1080 nei suoi attributi (i pixel veri) e viene ridotta
 *  dai CSS (`w-full h-auto`): il 16:9 arriva dalle proporzioni intrinseche,
 *  non da un `aspect-ratio` scritto a mano che potrebbe smentirle.
 *
 *  ⚠️ L'ANTEPRIMA SCALDA ANCHE IL LOGO
 *  Il logo del biglietto arriva da un'altra origine e va scaricato come blob
 *  prima di finire sulla tela (vedi biglietto.ts). Disegnare l'anteprima
 *  all'apertura significa che quel giro di rete è già fatto quando si preme
 *  "Scarica": fra la pressione e il file resta solo la codifica. Su Safari
 *  questo non è un dettaglio di velocità — un giro di rete in mezzo fa
 *  scadere il gesto dell'utente e il salvataggio viene bloccato come se fosse
 *  una finestra a comparsa.
 *
 *  ⚠️ L'IMMAGINE SU WHATSAPP LA ALLEGA UNA PERSONA, NON IL BROWSER
 *  `wa.me` porta testo e link, mai un file: nessuna pagina web può allegare
 *  qualcosa a una chat al posto tuo. È scritto nell'interfaccia, in chiaro,
 *  perché un consulente che si aspetta l'immagine allegata e non la trova
 *  conclude che il pannello è rotto — e smette di usarlo.
 *
 *  LE TRAPPOLE CHE QUESTO FILE EVITA (tutte già costate una schermata bianca)
 *   · gli hook stanno TUTTI sopra qualunque uscita anticipata: qui di uscite
 *     anticipate non ce n'è nemmeno una, il caso "niente dati" è un contenuto
 *     della finestra e non un `return null`;
 *   · il disegno riparte quando cambiano i dati e quando la finestra si
 *     riapre, e viene abbandonato se ci si chiude sopra a metà;
 *   · ogni fallimento lo dice un messaggio a comparsa. Un `console.error` che
 *     nessuno guarda è un errore raddoppiato: prima non funziona, poi non si
 *     sa nemmeno che non funziona.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  FileText,
  Image as IconaImmagine,
  Link2,
  Loader2,
  MessageCircle,
  Paperclip,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Finestra, NotaFinestra, SezioneFinestra, VuotoFinestra } from "./ui/Finestra";
import { disegnaBiglietto, nomeFile, pdfDaTela, pngDaTela } from "./biglietto";
import type { DatiBiglietto } from "./biglietto";
import { FRASI } from "./consulenza-contenuti";
import {
  durataInParole,
  durataPulita,
  giornoPerEsteso,
  quandoInParole,
  type DatiInvito,
} from "./invito";
import { depositaAnteprimaBiglietto, type EsitoAnteprima } from "./anteprima-link";
import { buildWhatsAppLink } from "./whatsapp";

/* ═══════════════════════════════════════════════════════════════════════════
   1. DIRE QUANDO — due modi, e non sono intercambiabili
   ═════════════════════════════════════════════════════════════════════════ */

/** Il biglietto conosce cinque campi; le funzioni che sanno dire una data a
 *  parole ne vogliono uno di forma diversa. Si converte qui, in un posto solo,
 *  invece di riscrivere `Intl.DateTimeFormat` per la terza volta nel progetto. */
function comeInvito(d: DatiBiglietto): DatiInvito {
  return {
    nome: d.nome,
    data: d.giorno,
    ora: d.ora,
    //  ⚠️ La durata passa da `durataPulita` e non finisce dentro grezza. Chi
    //  legge un `DatiInvito` ha il diritto di moltiplicarlo per sessantamila
    //  senza pensarci (lo fa già `faseInvito`), e nell'archivio importato le
    //  durate in secondi esistono: un 2700 non ripulito diventa un incontro che
    //  finisce fra quarantacinque ore.
    durata: durataPulita(d.durataMinuti),
    consulente: d.consulente || "",
    link: d.link,
  };
}

/** «Giovedì 21 agosto alle 15:30», sempre e comunque — mai «Oggi alle 15:30».
 *
 *  ⚠️ Questa forma serve al MESSAGGIO che accompagna il biglietto, e la
 *  ragione è la stessa per cui il biglietto stesso non scrive mai "Oggi": il
 *  messaggio resta nella chat del cliente per settimane, e un "oggi" letto tre
 *  giorni dopo è una bugia con l'ora dentro. In più il biglietto allegato
 *  scrive la data per esteso: due modi diversi di dire lo stesso appuntamento,
 *  a due centimetri di distanza, fanno controllare il cliente.
 *  Stringa vuota se la data non si legge — non si inventa un giorno. */
function quandoAssoluto(d: DatiBiglietto): string {
  const giorno = giornoPerEsteso(comeInvito(d));
  if (!giorno) return "";
  return d.ora ? `${giorno} alle ${d.ora}` : giorno;
}

/** La riga di contesto della finestra, invece, PUÒ dire «Oggi alle 15:30»:
 *  è sullo schermo del consulente adesso, non viaggia da nessuna parte e non
 *  sopravvive a mezzanotte. È l'unica differenza fra queste due funzioni, ed è
 *  tutta lì: una cosa che si guarda contro una cosa che si conserva. */
function quandoSulloSchermo(d: DatiBiglietto): string {
  return quandoInParole(comeInvito(d)) || "Giorno e ora da confermare";
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL MESSAGGIO CHE ACCOMPAGNA IL BIGLIETTO
   ═════════════════════════════════════════════════════════════════════════ */

/** Il testo che WhatsApp apre già scritto.
 *
 *  PERCHÉ NON RIUSA `buildLinkConsulenzaMessage` (crm/whatsapp.ts): quelli
 *  sono i modelli degli STATI della trattativa, vogliono un `Lead` intero e
 *  parlano della stanza Meetly. Qui c'è solo un biglietto e la pagina
 *  dell'appuntamento, e il pannello riceve cinque campi per scelta — non ha un
 *  lead da cui pescare.
 *
 *  Le frasi fisse vengono da FRASI e non sono riscritte "meglio" qui: il
 *  cliente legge la stessa promessa nel messaggio, sul biglietto allegato e
 *  sulla pagina che apre. La terza volta ci crede; se le tre versioni fossero
 *  scritte in tre modi, la terza volta si insospettisce. */
function messaggioWhatsApp(d: DatiBiglietto): string {
  const quando = quandoAssoluto(d);
  //  ── COME SI LEGGE UN MESSAGGIO CON UNA FOTO SOPRA ────────────────────────
  //  Questo testo non viaggia da solo: sotto c'è il biglietto allegato. Quindi
  //  NON ripete quello che l'immagine dice già (le tre soluzioni, come si
  //  svolge): la rimanda, e basta. Un messaggio che racconta la stessa cosa
  //  della foto che gli sta sopra fa saltare tutti e due.
  //
  //  Blocchi separati da una riga vuota, una sola idea per riga: su WhatsApp si
  //  legge in verticale col pollice, e un paragrafo di tre righe piene è la
  //  cosa che si salta. Il giorno e l'ora sono in *grassetto* — gli asterischi
  //  sono la sintassi di WhatsApp — perché sono l'unica cosa che il cliente
  //  tornerà a cercare in chat fra tre giorni.
  const blocchi: string[] = [];

  //  ⚠️ Il saluto chiude con la virgola solo se il nome c'è: «Ciao ,» è il
  //  genere di dettaglio che fa capire al cliente che è un messaggio automatico.
  blocchi.push(d.nome ? `Ciao ${d.nome},` : "Ciao,");
  blocchi.push("ti confermo la tua videoconsulenza gratuita.");

  //  Il quando su una riga sua, in grassetto. Se manca (non dovrebbe: il tasto
  //  che apre il pannello esiste solo con giorno e ora) il blocco salta invece
  //  di stampare un grassetto vuoto.
  const righe: string[] = [];
  if (quando) righe.push(`*${quando}*`);
  //  Durata e consulente sono la stessa domanda — «quanto mi porta via, e chi
  //  trovo» — quindi stanno insieme. «Niente da scaricare» chiude la riga: è
  //  l'obiezione che nessuno pronuncia, e sull'immagine non c'è più.
  righe.push(
    `Circa ${durataInParole(d.durataMinuti)}${d.consulente ? `, con ${d.consulente}` : ""}. ${FRASI.nienteDaScaricareBreve}.`,
  );
  blocchi.push(righe.join("\n"));

  blocchi.push("Nell'immagine qui sopra trovi cosa vedremo insieme.");

  //  ⚠️ Il link va DA SOLO sulla sua riga: WhatsApp rende cliccabile solo ciò
  //  che riconosce, e un indirizzo appiccicato a un punto fermo o a una
  //  parentesi finisce cliccabile per metà.
  if (d.link) {
    blocchi.push("Da qui entri quando è il momento:");
    blocchi.push(d.link);
  }

  //  L'ultima riga vale un appuntamento: chi non può venire e non sa come dirlo
  //  semplicemente sparisce, e un buco in agenda che nessuno aveva previsto è
  //  peggio di una disdetta. Dare il permesso di spostare fa disdire chi
  //  altrimenti sarebbe solo scomparso.
  blocchi.push("Se ti serve spostarla, scrivimi pure.");

  return blocchi.join("\n\n");
}

/** I codici già depositati in questa sessione: ridisegnare il biglietto (una
 *  finestra riaperta, un dato cambiato) non deve rispedire lo stesso file. */
const giaDepositate = new Set<string>();

/** Il codice dell'invito, che sta in fondo al suo indirizzo. */
function codiceDaLink(link: string): string {
  const m = /\/invito\/([A-Za-z0-9._-]+)/.exec(String(link || ""));
  return m ? m[1] : "";
}

/** ── DEPOSITA L'ANTEPRIMA, IN SILENZIO ─────────────────────────────────────
 *  Il biglietto appena disegnato diventa l'immagine che WhatsApp mostrerà nel
 *  riquadro del link.
 *
 *  ⚠️ Si rimpicciolisce a 1200 px prima di partire, e si comprime in JPEG.
 *  Non è avarizia: oltre il mezzo mega i programmi di messaggistica smettono
 *  di mostrare l'anteprima — e la mostrano rimpicciolita comunque, quindi i
 *  pixel in più non li vedrebbe nessuno.
 *
 *  ⚠️ E soprattutto: se qualcosa qui va storto NON si dice niente. Questo non
 *  è un gesto che l'utente ha chiesto, è un miglioramento che accade da solo
 *  mentre lui sta facendo altro; un avviso rosso su un'operazione invisibile
 *  lo lascerebbe a chiedersi che cosa ha sbagliato, e il link funziona lo
 *  stesso — l'anteprima ricade sul marchio dello studio. */
/* ═══════════════════════════════════════════════════════════════════════════
   3. I DUE MESTIERI DEL BROWSER: copiare e consegnare un file
   ═════════════════════════════════════════════════════════════════════════ */

/** ── COPIA NEGLI APPUNTI, CON RIPIEGO ──────────────────────────────────────
 *  Stessa strada di `MeetGiornalieri`: `navigator.clipboard` non c'è sempre e
 *  non riesce sempre — sui browser Apple la copia è legata al tocco e viene
 *  rifiutata se in mezzo è passato un `await`. Il ripiego è il vecchio campo
 *  invisibile con `execCommand`, che quei browser accettano ancora.
 *  ⚠️ Se fallisce anche quello si restituisce `false`: chi chiama mostra il
 *  link per esteso, così si copia a mano. Mai dire "copiato" quando non lo è —
 *  il consulente incollerebbe altro nella chat del cliente. */
async function copiaNegliAppunti(testo: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(testo);
      return true;
    }
  } catch {
    /* rifiutata: si prova la vecchia strada */
  }
  try {
    const campo = document.createElement("textarea");
    campo.value = testo;
    campo.setAttribute("readonly", "");
    //  Fuori dallo schermo ma NON `display:none`: un elemento nascosto davvero
    //  non si può selezionare, e senza selezione non c'è niente da copiare.
    campo.style.position = "fixed";
    campo.style.top = "-1000px";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}

/** Il CRM gira come applicazione a schermo intero sul TELEFONO
 *  (public/manifest.webmanifest, `display: "standalone"`). Serve saperlo perché
 *  lì lo scarico si comporta in modo diverso: vedi `consegnaFile`.
 *
 *  ⚠️ E "a schermo intero" da solo non basta a dire "telefono". Chrome ed Edge
 *  installano le applicazioni web anche sul Mac, e lì `display-mode:
 *  standalone` è vero esattamente come su un iPhone: il committente che si
 *  installa il CRM sul desktop finirebbe nel ramo pensato per il telefono e si
 *  vedrebbe aprire il foglio di condivisione di macOS al posto di uno scarico —
 *  cioè un passaggio in più per niente, su una macchina dove l'ancora funziona
 *  benissimo. Il puntatore grossolano è la domanda vera che si voleva fare: si
 *  tocca con un dito o si clicca con un mouse. */
function aSchermoIntero(): boolean {
  try {
    const aDito = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (!aDito) return false;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    //  La vecchia bandiera di Safari su iPhone, che non conosce display-mode.
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

type EsitoConsegna = "scaricato" | "condiviso" | "annullato" | "fallito";

/** Quando l'utente chiude il foglio di condivisione senza scegliere niente non
 *  è successo niente di male: non è un errore da segnalare.
 *
 *  ⚠️ SOLO `AbortError`, e la differenza è tutt'altro che formale.
 *  `NotAllowedError` NON è una persona che ha cambiato idea: è il browser che
 *  rifiuta la condivisione perché il gesto è scaduto — ed è proprio quello che
 *  succede su Safari dopo la codifica di un'immagine da un megabyte e mezzo.
 *  Contarlo come "annullato" faceva uscire `consegnaFile` dicendo che era andato
 *  tutto bene: niente file, nessun ripiego sull'ancora e NESSUN MESSAGGIO. Il
 *  consulente preme, non succede niente, e apre la chat del cliente convinto di
 *  avere il biglietto. Trattato come guasto, invece, tocca all'ancora, e se
 *  fallisce anche quella si dice. */
function annullatoDaUtente(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** ── PORTARE IL FILE FUORI DAL BROWSER ─────────────────────────────────────
 *  Sul computer è banale: un'ancora `download` su un `blob:`.
 *
 *  ⚠️ SU IPHONE, DENTRO L'APPLICAZIONE A SCHERMO INTERO, quella stessa ancora
 *  spesso NON produce nessun file e NON solleva nessun errore: il consulente
 *  preme, non succede niente, e non c'è niente da leggere da nessuna parte.
 *  Lì la strada vera è il foglio di condivisione del sistema — che poi è
 *  esattamente il percorso verso WhatsApp, senza nessuna libreria in più.
 *  Per questo a schermo intero si prova PRIMA la condivisione, e l'ancora
 *  resta il ripiego; sul computer l'ordine è rovesciato, perché lì un foglio
 *  di condivisione a sorpresa sarebbe un passaggio in più per niente.
 *
 *  ⚠️ `URL.revokeObjectURL` è RITARDATO di trenta secondi. Le copie sparse per
 *  il CRM revocano subito e reggono, ma quelle scaricano CSV da pochi
 *  kilobyte: un PNG da un paio di megabyte non è detto che faccia in tempo. */
async function consegnaFile(blob: Blob, nome: string, tipo: string): Promise<EsitoConsegna> {
  const file = typeof File === "function" ? new File([blob], nome, { type: tipo }) : null;
  const puoCondividere =
    !!file &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function" &&
    navigator.canShare({ files: [file] });

  const condividi = async (): Promise<EsitoConsegna | null> => {
    if (!puoCondividere || !file) return null;
    try {
      await navigator.share({ files: [file] });
      return "condiviso";
    } catch (e) {
      return annullatoDaUtente(e) ? "annullato" : null;
    }
  };

  const scarica = (): EsitoConsegna | null => {
    try {
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 30_000);
      return "scaricato";
    } catch {
      return null;
    }
  };

  const ordine = aSchermoIntero() ? [condividi, scarica] : [scarica, condividi];
  for (const passo of ordine) {
    const esito = await passo();
    if (esito) return esito;
  }
  return "fallito";
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. PERCHÉ NON HA FUNZIONATO, DETTO IN ITALIANO
   ═════════════════════════════════════════════════════════════════════════ */

/** Un messaggio a comparsa che dice «errore» e basta non serve a nessuno: chi
 *  lo legge non può né rimediare né riferirlo. Qui i due guasti che capitano
 *  davvero hanno un nome loro, e tutto il resto riporta almeno il motivo che
 *  il browser ha dato. */
function motivoLeggibile(e: unknown): string {
  if (e instanceof DOMException && e.name === "SecurityError") {
    //  È il guasto numero uno di questo biglietto, e non dà nessun segnale
    //  prima del clic: un'immagine di altra origine finita sulla tela la
    //  "sporca", e l'esportazione viene rifiutata solo al momento di uscire.
    return "il logo remoto ha bloccato l'esportazione dell'immagine";
  }
  if (e instanceof DOMException && e.name === "InvalidStateError") {
    return "il logo non ha dimensioni leggibili e non si è potuto disegnare";
  }
  if (e instanceof Error && e.message) return e.message;
  const s = String(e ?? "").trim();
  return s && s !== "[object Object]" ? s : "il browser non ha detto perché";
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. IL PANNELLO
   ═════════════════════════════════════════════════════════════════════════ */

type StatoDisegno = "attesa" | "pronto" | "errore";

export function BigliettoPannello({
  aperto,
  chiudi,
  dati,
}: {
  aperto: boolean;
  chiudi: () => void;
  dati: DatiBiglietto | null;
}) {
  /* ── TUTTI GLI HOOK STANNO QUI SOPRA, SENZA ECCEZIONI ───────────────────
   *  ⚠️ In questo file non esiste nessuna uscita anticipata — niente
   *  `if (!dati) return null`. Un `return` prima di un hook cambia il numero
   *  di hook fra due render e React si ferma con l'errore 310: schermata
   *  bianca su tutto il CRM, non solo su questa finestra. Il caso "non ci sono
   *  dati" è un CONTENUTO della finestra, più in basso. */

  //  La tela sta in uno stato e non in un `useRef`, ed è la scelta che tiene
  //  in piedi tutto il resto: la finestra è un portale Radix, quindi la
  //  <canvas> NASCE quando si apre e MUORE quando si chiude. Un riferimento
  //  non avvisa nessuno quando cambia, e l'effetto girerebbe con `null` in
  //  mano; il riferimento-funzione invece provoca un render, così l'effetto
  //  parte esattamente quando la tela esiste e si pulisce quando sparisce.
  const [tela, setTela] = useState<HTMLCanvasElement | null>(null);
  const [stato, setStato] = useState<StatoDisegno>("attesa");
  const [motivo, setMotivo] = useState("");
  //  Quale dei due scarichi è in corso: serve a spegnere i tasti e a mettere
  //  la rotella su quello giusto. Due scarichi insieme non si vietano per
  //  gusto — la seconda `toBlob` parte mentre la prima tiene la memoria.
  const [inCorso, setInCorso] = useState<"" | "png" | "pdf">("");
  //  Si alza di uno a ogni "Riprova": è l'unico modo di rifare un effetto che
  //  ha già le stesse dipendenze di prima.
  const [tentativo, setTentativo] = useState(0);
  //  Lo stato dell'anteprima del link: non è una decorazione. È l'unica cosa
  //  che distingue «mandato con la sua immagine» da «mandato col logo», e
  //  senza si scopre dal cliente.
  const [anteprima, setAnteprima] = useState<EsitoAnteprima>("");
  const [motivoAnteprima, setMotivoAnteprima] = useState("");

  //  ⚠️ L'oggetto `dati` arriva ricostruito a ogni render della riga del CRM
  //  (è un letterale, non uno stato): se finisse fra le dipendenze
  //  dell'effetto, il biglietto si ridisegnerebbe a ogni battito dell'agenda.
  //  Quello che conta è il CONTENUTO, ed è la chiave qui sotto; il riferimento
  //  serve solo a leggere l'ultimo oggetto nel momento in cui l'effetto parte.
  const ultimiDati = useRef<DatiBiglietto | null>(dati);
  ultimiDati.current = dati;

  const chiave = JSON.stringify(
    dati
      ? [dati.nome, dati.giorno, dati.ora, dati.durataMinuti, dati.consulente ?? "", dati.link]
      : null,
  );

  /** ── IL DISEGNO, E IL MODO DI ABBANDONARLO A METÀ ─────────────────────
   *  Riparte in tre occasioni, e sono tutte e tre necessarie:
   *   · la tela nasce (finestra aperta) o muore (finestra chiusa);
   *   · cambia il contenuto — l'appuntamento spostato mentre il pannello è
   *     aperto deve ridisegnare, o si manda l'ora vecchia;
   *   · si preme "Riprova".
   *
   *  ⚠️ `vivo` non è una precauzione teorica. `disegnaBiglietto` è asincrona
   *  (aspetta i font e il logo): chi chiude la finestra mentre gira smonta la
   *  tela sotto una promessa ancora in volo, e senza questa bandiera al
   *  ritorno si scriverebbe uno stato su un componente che non c'è più. */
  useEffect(() => {
    //  ⚠️ Senza tela si TORNA IN ATTESA, non si esce e basta. La finestra è un
    //  portale: chiudendola la <canvas> muore e `tela` diventa null, ma `stato`
    //  resterebbe "pronto" dalla volta prima. Alla riapertura nasce una tela
    //  nuova e VUOTA che per un disegno si mostrerebbe a piena opacità con i
    //  due tasti di scarico già accesi — e da quando lo scarico esporta la tela
    //  dell'anteprima invece di ridisegnare, quel disegno di troppo non è più
    //  un lampo ma un file nero mandato a un cliente.
    if (!tela) {
      setStato("attesa");
      return;
    }
    const d = ultimiDati.current;
    if (!d) return;

    let vivo = true;
    setStato("attesa");
    setMotivo("");

    disegnaBiglietto(tela, d).then(
      () => {
        if (!vivo) return;
        setStato("pronto");
        //  L'anteprima del link parte da sola, senza chiedere niente a nessuno:
        //  è la stessa immagine che il consulente sta guardando in questo
        //  istante, e va depositata PRIMA che il link finisca in una chat.
        //  Se fallisce non si dice niente a schermo — vedi depositaAnteprima.
        //  La tela è già disegnata: si passa al deposito, che così non deve
        //  rifare il lavoro. Ma il deposito NON dipende più da questa finestra —
        //  parte da solo quando nasce il link (vedi anteprima-link.ts).
        void depositaAnteprimaBiglietto(
          d,
          (stato, motivo) => {
            if (!vivo) return;
            setAnteprima(stato);
            setMotivoAnteprima(motivo || "");
          },
          tela,
        );
      },
      (e: unknown) => {
        if (!vivo) return;
        const m = motivoLeggibile(e);
        setStato("errore");
        setMotivo(m);
        //  Il silenzio è il peggior errore: l'anteprima vuota da sola non
        //  dice se sta ancora caricando o se si è rotta.
        toast.error("Biglietto non disegnato", { description: m });
      },
    );

    return () => {
      vivo = false;
    };
  }, [tela, chiave, tentativo]);

  /* ── DA QUI IN GIÙ NIENTE PIÙ HOOK: solo valori e funzioni ──────────── */

  const haLink = !!dati?.link?.trim();
  const pronto = stato === "pronto";
  const occupato = inCorso !== "";

  async function copiaLink() {
    if (!dati?.link) return;
    const fatto = await copiaNegliAppunti(dati.link);
    if (fatto) {
      //  Il link resta scritto nella conferma: è la prova che negli appunti
      //  c'è quello giusto, e serve la volta che si incolla nella chat
      //  sbagliata e ci si chiede cosa fosse.
      toast.success("Link copiato", { description: dati.link });
      return;
    }
    toast.info("Copia rifiutata dal browser: eccolo, da copiare a mano", {
      description: dati.link,
      duration: 15_000,
    });
  }

  /** Un solo percorso per PNG e PDF: cambia la funzione che crea il blob e il
   *  tipo del file, non il resto. Due copie di questa procedura sarebbero due
   *  posti in cui dimenticare il `finally`.
   *
   *  ⚠️ SI ESPORTA LA TELA DELL'ANTEPRIMA, non se ne disegna un'altra.
   *  `pngBiglietto(d)` ridisegnerebbe da capo, e sarebbe sbagliato per due
   *  motivi che non c'entrano con la velocità. Primo: il file diventerebbe una
   *  SECONDA immagine, e la promessa scritta in cima a questo file — "quello che
   *  vedi è quello che si scarica" — smetterebbe di essere vera nel momento in
   *  cui serve, cioè quando il secondo disegno esce diverso dal primo. Secondo:
   *  quel percorso ripassa dal logo, e dopo un errore di rete `precaricaLogo`
   *  riprova — un giro di rete infilato fra il clic e il salvataggio è proprio
   *  ciò che fa scadere il gesto dell'utente, e Safari a quel punto blocca lo
   *  scarico come una finestra a comparsa senza dire niente a nessuno.
   *  Il prezzo è la guardia qui sotto: senza tela e senza disegno finito non si
   *  esporta niente, perché una tela non finita esce come un rettangolo nero. */
  async function scarica(formato: "png" | "pdf") {
    const d = ultimiDati.current;
    if (!d || occupato) return;
    if (!tela || stato !== "pronto") return;
    setInCorso(formato);
    const nome = nomeFile(d, formato);
    try {
      const blob = formato === "png" ? await pngDaTela(tela) : await pdfDaTela(tela);
      const tipo = formato === "png" ? "image/png" : "application/pdf";
      const esito = await consegnaFile(blob, nome, tipo);
      if (esito === "scaricato") {
        toast.success(formato === "png" ? "Biglietto scaricato" : "PDF scaricato", {
          description: nome,
        });
      } else if (esito === "condiviso") {
        toast.success("Biglietto passato alla condivisione", { description: nome });
      } else if (esito === "fallito") {
        //  Non si dice "scaricato" per educazione: se il file non è uscito,
        //  il consulente deve saperlo PRIMA di aprire la chat del cliente.
        toast.error("File non salvato dal browser", {
          description: "Prova da un'altra finestra, o dal computer.",
        });
      }
      //  "annullato" = il foglio di condivisione chiuso senza scegliere.
      //  Non è successo niente, e non c'è niente da dire.
    } catch (e) {
      const m = motivoLeggibile(e);
      toast.error(formato === "png" ? "PNG non creato" : "PDF non creato", { description: m });
    } finally {
      setInCorso("");
    }
  }

  function apriWhatsApp() {
    const d = ultimiDati.current;
    if (!d) return;
    //  ── DIRITTO SULLA CHAT DEL CLIENTE ──────────────────────────────────────
    //  Con il numero si apre la conversazione giusta, col messaggio già
    //  scritto: resta da allegare l'immagine e premere invio. Senza numero —
    //  un lead arrivato senza recapito — si ripiega sull'elenco delle chat,
    //  che è com'era prima: un tocco in più, ma il messaggio non si perde.
    //  ⚠️ `buildWhatsAppLink` è la stessa funzione che usano tutti gli altri
    //  tasti WhatsApp del CRM: ripulisce il numero dagli spazi e toglie il «+»
    //  che wa.me non accetta. Scrivere qui una seconda ripulitura vorrebbe dire
    //  avere due idee diverse di che cos'è un numero valido.
    const testo = messaggioWhatsApp(d);
    const numero = String(d.telefono || "").trim();
    const url = numero
      ? buildWhatsAppLink(numero, testo)
      : `https://wa.me/?text=${encodeURIComponent(testo)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Finestra
      aperta={aperto}
      onCambio={(v) => {
        if (!v) chiudi();
      }}
      titolo="Manda il biglietto"
      contesto={
        dati
          ? [dati.nome || "Cliente senza nome", quandoSulloSchermo(dati)].join(" · ")
          : "Nessun appuntamento selezionato"
      }
      icona={IconaImmagine}
      larghezza="lg"
      azioni={
        <>
          <Button variant="outline" onClick={chiudi}>
            Chiudi
          </Button>
          {/*  Il tasto dice a CHI si scrive, non che programma si apre: con il
              numero in mano porta dritto sulla chat di quella persona, e il nome
              scritto sul tasto è l'ultimo controllo prima di mandare qualcosa
              alla persona sbagliata. Senza numero resta il nome generico,
              perché finirebbe davvero sull'elenco delle conversazioni. */}
          <Button onClick={apriWhatsApp} disabled={!dati}>
            <MessageCircle className="h-4 w-4" />
            {dati?.telefono
              ? dati.nome
                ? `Scrivi a ${dati.nome}`
                : "Scrivi al cliente"
              : "Apri WhatsApp"}
          </Button>
        </>
      }
    >
      {!dati ? (
        <VuotoFinestra
          icona={AlertTriangle}
          testo="Questa finestra si apre dal calendario sulla riga di un appuntamento: senza giorno e ora non c'è nessun biglietto da disegnare."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* ── L'ANTEPRIMA ────────────────────────────────────────────── */}
          <SezioneFinestra
            titolo="Anteprima"
            nota="Quello che vedi è quello che si scarica: 1920 × 1080, pronto per WhatsApp."
            senzaPadding
          >
            <div className="relative bg-[#081634]">
              {/* La tela porta i pixel veri negli attributi e viene rimpicciolita
                  dai CSS: il 16:9 nasce dalle sue proporzioni intrinseche, non da
                  un rapporto scritto a mano che un domani potrebbe smentirle. */}
              <canvas
                ref={setTela}
                width={1920}
                height={1080}
                aria-label="Anteprima del biglietto della consulenza"
                className={cn(
                  "block h-auto w-full transition-opacity duration-200",
                  //  Nascosta finché non è finita: una tela mezza disegnata
                  //  sembra un biglietto sbagliato, non un biglietto in corso.
                  pronto ? "opacity-100" : "opacity-0",
                )}
              />

              {stato === "attesa" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-[12px]">Sto disegnando il biglietto…</span>
                </div>
              )}

              {stato === "errore" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                  <span className="text-[12px] text-slate-200">
                    Il biglietto non si è disegnato: {motivo}.
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setTentativo((n) => n + 1)}
                    className="mt-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Riprova
                  </Button>
                </div>
              )}
            </div>
          </SezioneFinestra>

          {/* ── I TRE GESTI ────────────────────────────────────────────── */}
          <SezioneFinestra
            titolo="Cosa mandi"
            nota="Prima scarica l'immagine, poi apri WhatsApp: in chat la alleghi dalla graffetta."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                variant="outline"
                onClick={copiaLink}
                disabled={!haLink}
                title={haLink ? dati.link : "Questo appuntamento non ha ancora una pagina pubblica"}
              >
                <Link2 className="h-4 w-4" />
                Copia il link
              </Button>

              {/* ⚠️ Lo scarico resta spento finché l'anteprima non è finita:
                  esportare una tela ancora vuota produce un file nero, che è
                  peggio di un tasto che aspetta. */}
              <Button
                variant="outline"
                onClick={() => void scarica("png")}
                disabled={!pronto || occupato}
              >
                {inCorso === "png" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Scarica il PNG
              </Button>

              <Button
                variant="outline"
                onClick={() => void scarica("pdf")}
                disabled={!pronto || occupato}
              >
                {inCorso === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Scarica il PDF
              </Button>
            </div>

            {!haLink && (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                La pagina pubblica di questo appuntamento non è ancora stata creata: il biglietto si
                manda lo stesso, ma il messaggio parte senza link.
              </p>
            )}
          </SezioneFinestra>

          {/* ── L'ANTEPRIMA DEL LINK, DETTA A CHIARE LETTERE ───────────────
              Succede da sola, quindi senza questa riga il consulente non ha
              nessun modo di sapere se è successa: manderebbe il link fidandosi,
              e scoprirebbe il riquadro vuoto dal cliente. Tre stati, tre frasi
              brevi — e quando fallisce si dice il motivo, non «errore». */}
          {anteprima === "fatta" && (
            <p className="flex items-center gap-2 text-xs text-emerald-600">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
              Anteprima del link pronta: chi lo riceve vede questo biglietto.
            </p>
          )}
          {anteprima === "invio" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              Sto preparando l'anteprima del link…
            </p>
          )}
          {anteprima === "errore" && (
            <p className="flex items-start gap-2 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Anteprima del link non creata{motivoAnteprima ? ` (${motivoAnteprima})` : ""}: il
                link funziona, ma nella chat comparirà il logo invece del biglietto.
              </span>
            </p>
          )}

          {/* ── LA COSA CHE VA DETTA, NON LASCIATA CAPIRE ───────────────── */}
          <NotaFinestra tono="attenzione" icona={Paperclip}>
            WhatsApp si apre con il messaggio e il link <strong>già scritti</strong>, ma{" "}
            <strong>l'immagine la alleghi tu</strong>: nessun sito può attaccare un file a una chat
            al posto tuo. Scarica il biglietto, apri WhatsApp, scegli il cliente e allegalo dalla
            graffetta.
          </NotaFinestra>
        </div>
      )}
    </Finestra>
  );
}
