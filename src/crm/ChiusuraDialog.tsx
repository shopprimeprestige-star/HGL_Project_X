/** ─────────────────────────────────────────────────────────────────────────
 *  ChiusuraDialog — «HA COMPRATO»: UN GESTO SOLO, UN SALVATAGGIO SOLO
 *
 *  QUANDO SI APRE
 *  Quando dalla griglia degli stati si sceglie una delle tre chiusure vinte —
 *  «Nel nostro centro», «A domicilio», «Da spedire». Non si apre per "acconto"
 *  né per il vecchio "venduto": quelli hanno già il loro modulo in
 *  QuickStatusDialog e non si assegnano più dal menu (vedi types.ts).
 *
 *  PERCHÉ ESISTE, INVECE DI LASCIARE IL MODULO DEI PAGAMENTI
 *  Il modulo dei pagamenti chiede nove cose — incasso, costo del taglio, costo
 *  dell'installatore, costo del prodotto, data e ora della posa — perché nasce
 *  per la pratica GIÀ chiusa, quando qualcuno si siede a fare i conti. Qui il
 *  momento è un altro: il cliente è ancora davanti, ha appena detto di sì, e la
 *  finestra si compila con una mano sola mentre con l'altra si tiene il POS. Le
 *  domande sono quattro, e tre volte su quattro se ne risponde a una sola.
 *
 *  LE QUATTRO DOMANDE, NELL'ORDINE IN CUI CAPITANO
 *   1. QUANTO HA LASCIATO. Il campo nasce già scritto con il totale del
 *      preventivo di questo lead: quasi sempre l'acconto È una parte di quel
 *      numero, e riscriverlo a memoria è il modo più rapido per sbagliarlo di
 *      uno zero. ⚠️ Precompilato NON vuol dire deciso: le tre pastiglie sotto
 *      il campo (tutto · metà · niente ora) coprono i tre casi veri in un
 *      tocco, e la riga «resta da incassare» dice sempre ad alta voce che cosa
 *      si sta per salvare.
 *   2. È UN IMPIANTO SU MISURA. Un interruttore. Serve a chi ordina e a chi
 *      posa: un impianto su misura ha tempi diversi e non si sostituisce al
 *      volo. Se acceso, una riga per dire che cosa ha di particolare.
 *   3. CI SONO ALTRI SOLDI DA CHIEDERE. Un interruttore e un importo. Finché
 *      non risulta detto al cliente, il lead se lo porta dietro NELL'ELENCO
 *      (vedi AvvisoExtra qui sotto): dentro la scheda non lo vedrebbe nessuno,
 *      perché la scheda si apre quando si è già deciso di aprirla.
 *   4. NOTE. Sull'ACCORDO — la rata promessa a voce, lo sconto concesso, il
 *      «paga il resto alla consegna». Vanno in `chiusura.note`, non in
 *      `notePostCall`: quelle raccontano com'è andata la consulenza, e mischiare
 *      le due cose vuol dire non ritrovare più né l'una né l'altra.
 *
 *  ⚠️ SI SALVA TUTTO INSIEME, STATO COMPRESO.
 *   Lo stato NON lo scrive chi apre questa finestra: lo scrive lei, dentro lo
 *   stesso `updateLead` degli importi. È l'unica forma che rende impossibile il
 *   guasto peggiore — un lead «vinto» con la cassa vuota, che nei conti del mese
 *   vale una vendita da zero euro e che nessuno andrà più a correggere, perché a
 *   schermo è già verde. Chi monta questa finestra deve aprirla AL POSTO del
 *   cambio di stato, mai dopo (vedi la nota per i chiamanti in fondo al file).
 *
 *  ⚠️ E SI CONTROLLA CHE SIA ANDATA, DUE VOLTE.
 *   `updateLead` del CRMContext oggi risponde `true`/`false` — prima taceva, e
 *   la sua promessa si risolveva identica sia che avesse salvato sia che non
 *   avesse scritto niente. Quel `false` è la prima porta. La seconda è una
 *   rilettura della riga dal database: si guarda che ci sia lo stato scelto E
 *   la cifra battuta, perché questa finestra si riapre anche su una vendita già
 *   registrata (per correggere un acconto, per cambiare la consegna) e lì lo
 *   stato coincide già — controllarlo da solo vorrebbe dire dare per riuscito
 *   ogni salvataggio proprio nel giro in cui si sta correggendo del denaro.
 *   Se una delle due porte è chiusa, la finestra RESTA APERTA con tutto quello
 *   che è stato scritto dentro, e lo dice.
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { AlertTriangle, Euro, Megaphone, Ruler, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
//  La regola dell'IVA sta in un file suo: la stessa domanda si fa qui, quando
//  si registra l'acconto dalla pastiglia, e quando si incassa il saldo.
//  ⚠️ `ScegliIva` non si importa più: i riquadri dell'IVA sono spariti da questa
//   finestra (vedi lo stato `modoIva`). `contoIva` resta perché il margine
//   continua a scorporare l'imposta dal prezzo, che è un conto, non una domanda.
import { MODO_IVA_PREDEFINITO, conIvaBool, contoIva } from "./iva";
import { useCRM } from "./CRMContext";
import {
  CLASSE_AREA,
  CLASSE_CAMPO,
  CampoFinestra,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
} from "./ui/Finestra";
import { CLASSE_BADGE_STATO, CLASSI_BADGE, classiStato, eur } from "./ui";
//  ── COME SI LEGGE UNA CIFRA SCRITTA IN ITALIANO ───────────────────────────
//   `leggiEuro`/`scriviEuro` esistono già e stanno nella finestra dell'incasso
//   alla consegna: sono le DUE finestre in cui si batte del denaro, e devono
//   leggerlo allo stesso modo. Qui si importano, non si riscrivono — una
//   seconda lettura degli euro è una seconda idea di quanto valga "1.200".
//   L'import va in una direzione sola (ChiusuraDialog → InstallationScheduleDialog),
//   quella finestra non sa che questa esiste.
import { leggiEuro, scriviEuro } from "./InstallationScheduleDialog";
import { ScorciatoieFinestra, useSalvaConTastiera } from "./SchedaCliente";
import {
  LEAD_STATUS_LABEL,
  MODO_CONSEGNA_DA_STATO,
  STATI_CHIUSURA_VINTA,
  type ExtraDaChiedere,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. QUANDO SI APRE, E CHE COSA COMPORTA LO STATO SCELTO
   ═════════════════════════════════════════════════════════════════════════ */

/** Vero se questo stato apre la finestra della chiusura.
 *  Si legge da `STATI_CHIUSURA_VINTA` e non da un elenco scritto qui: il giorno
 *  che le chiusure diventino quattro, questa riga non va ritrovata.
 *  ⚠️ NON usa `eChiusuraVinta`, che comprende anche "venduto" e "acconto":
 *  quelli sono storia e automatismo, e hanno già il loro modulo altrove. */
export function richiedeChiusura(s?: LeadStatus | string | null): boolean {
  return (STATI_CHIUSURA_VINTA as string[]).includes(String(s ?? ""));
}

/** ── LO STATO DICE ANCHE COME ARRIVA L'IMPIANTO ───────────────────────────
 *  types.ts lo scrive a chiare lettere: lo stato e `installazione.spedizione.modo`
 *  stanno accanto, non uno al posto dell'altro — lo stato decide fase, colore e
 *  conteggi, il `modo` decide se la pratica entra in agenda e occupa un tecnico.
 *  ⚠️ Aggiornarne uno solo è il guasto silenzioso più caro di tutti: un lead
 *   «Da spedire» che continua a tenersi il posto in agenda lo si scopre la
 *   mattina stessa, con il tecnico già in viaggio e lo slot buttato. Qui si
 *   scrivono INSIEME, nello stesso salvataggio.
 *  ⚠️ Se un domani nasce una quarta chiusura e ci si dimentica di questa
 *   tabella, non si scrive un modo SBAGLIATO: non si scrive niente e la
 *   consegna resta com'era (vedi `salva`). Il grep è "posa_".
 *  ⚠️ LA TABELLA È IN types.ts, non più qui. Non è pulizia: i punti che
 *   registrano una vendita sono DUE — questa finestra e la rotta del telefono
 *   del consulente (routes/api.consulente.azione.ts), che gira sul server e
 *   questo file non può importarlo. Finché la tabella stava qui, la rotta non
 *   scriveva nessun modo di consegna e una vendita «Da spedire» segnata dal
 *   telefono restava in agenda come una posa. */
const MODO_CONSEGNA = MODO_CONSEGNA_DA_STATO;

/* ═══════════════════════════════════════════════════════════════════════════
   2. L'AVVISO CHE DEVE USCIRE DALLA SCHEDA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── «GLIEL'ABBIAMO DETTO?» ────────────────────────────────────────────────
 *  La domanda pericolosa dei soldi che mancano non è quanti sono: è se il
 *  cliente lo sa. Chiederglielo due volte è una brutta figura, non chiederglielo
 *  affatto vuol dire perderli alla consegna, quando ormai è tardi per parlarne.
 *  Il campo esiste già (`extraDaChiedere.comunicatoAlCliente`, types.ts): qui
 *  c'è solo la domanda ridotta a una riga, in un posto solo, così le pagine che
 *  la mostrano non se la riscrivono ciascuna a modo suo. */
export function extraDaAnnunciare(d?: Pick<LeadData, "extraDaChiedere"> | null): boolean {
  const e = d?.extraDaChiedere;
  return !!e?.serve && !e.comunicatoAlCliente;
}

/** Quanti lead hanno una richiesta ancora da comunicare: è il numero da mettere
 *  accanto a una voce di menu (`conteggiMenu` in crm/ui.tsx). */
export function contaExtraDaAnnunciare(leads: Lead[]): number {
  return leads.filter((l) => extraDaAnnunciare(l.data)).length;
}

/** ── L'AVVISO, COM'È FATTO E PERCHÉ È FATTO COSÌ ──────────────────────────
 *  Pieno e ambra, non tenue: è la stessa tinta con cui tutto il CRM dice «manca
 *  un'azione» (CLASSI_BADGE.oggi di crm/ui — nessuna tavolozza nuova da
 *  imparare), e a 18 px un colore chiaro con la coda dell'occhio non si vede.
 *  Porta l'IMPORTO e non solo un puntino: «€ 300 da dire» si capisce senza
 *  aprire niente, un pallino arancione obbliga ad aprire la scheda per sapere
 *  cosa vuole — cioè costa esattamente il gesto che l'avviso doveva evitare.
 *  Non è cliccabile di proposito: vive dentro righe di elenco che si aprono al
 *  tocco, e un bersaglio in più lì dentro è un tocco sbagliato in più. Si spegne
 *  dove si spengono le cose: sulla scheda della posa, con la spunta
 *  «gliel'ho detto». */
export function AvvisoExtra({
  dati,
  className,
}: {
  dati?: Pick<LeadData, "extraDaChiedere"> | null;
  className?: string;
}) {
  if (!extraDaAnnunciare(dati)) return null;
  const importo = Number(dati?.extraDaChiedere?.importo) || 0;
  return (
    <span
      title={
        importo > 0
          ? `Ci sono ancora ${eur(importo)} da chiedere a questo cliente, e non risulta che gliene sia stato parlato. L'avviso sparisce quando qualcuno segna che gliel'ha detto.`
          : "C'è ancora del denaro da chiedere a questo cliente, e non risulta che gliene sia stato parlato."
      }
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-1.5",
        "text-[10.5px] font-semibold leading-none tabular-nums",
        CLASSI_BADGE.oggi,
        className,
      )}
    >
      <Megaphone aria-hidden="true" className="h-3 w-3" />
      {importo > 0 ? `${eur(importo)} da dire` : "da dire"}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. IL TOTALE DEL PREVENTIVO
   ═════════════════════════════════════════════════════════════════════════ */

/** Che cosa ne sa la SCHEDA, senza chiedere niente a nessuno.
 *  A gradini, dal più preciso al più generico:
 *   · `chiusura.totalePreventivo` — questa stessa finestra, la volta scorsa;
 *   · `payment.prezzoFinaleVendita` — il prezzo concordato già scritto.
 *  ⚠️ NON c'è `payment.prezzoTotale`, e non è una dimenticanza: sulla scheda
 *   quel campo si chiama «Prezzo di listino — solo se c'è uno sconto da
 *   mostrare» (LeadDialog). Usarlo qui significherebbe proporre come acconto un
 *   prezzo pieno che il cliente non ha mai accettato, cioè registrare in cassa
 *   lo sconto che gli era stato fatto. */
export function totaleDaScheda(d?: LeadData | null): number {
  const gradini = [d?.chiusura?.totalePreventivo, d?.payment?.prezzoFinaleVendita];
  for (const g of gradini) {
    const n = Number(g);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Da dove arriva il numero che si vede nel campo. Serve a scriverlo sotto: un
 *  importo precompilato di cui non si sa la provenienza si cancella e si
 *  riscrive a mano, che è esattamente il lavoro che volevamo togliere. */
type FontePreventivo = "attesa" | "preventivo" | "scheda" | "vuoto" | "senzaAccesso" | "guasto";

/** ── IL TOTALE DEL PREVENTIVO VERO ────────────────────────────────────────
 *  Il legame fra scheda e preventivo è `data.quoteRef`, che ci scrive la pagina
 *  del preventivo quando il consulente lo manda al cliente (api.crm.lead-sync).
 *  Il totale però sulla scheda non c'è: sta nell'archivio dei preventivi, e si
 *  chiede a /api/presenter/quotes.
 *  ⚠️ Quella rotta vuole una sessione da PRESENTATORE — ce l'ha chi ha appena
 *   fatto la consulenza, non necessariamente chi apre il CRM da un altro
 *   computer. Quando manca risponde 401 con l'elenco vuoto: NON è un guasto da
 *   toast, è un fatto da dire sotto il campo, perché un avviso rosso all'apertura
 *   di ogni chiusura si impara a ignorare in due giorni.
 *  ⚠️ E non sovrascrive MAI quello che si sta scrivendo: la risposta arriva
 *   mentre le dita sono già sul campo, e un importo che cambia da solo sotto le
 *   mani è il guasto peggiore di tutti quelli che questa funzione può causare.
 *   Chi ha toccato i campi comanda (`toccato`). */
function useTotalePreventivo(lead: Lead | null, attivo: boolean) {
  const [totale, setTotale] = useState(0);
  const [fonte, setFonte] = useState<FontePreventivo>("vuoto");
  //  Niente più cast: `quoteRef` è dichiarato in LeadData (types.ts). Lo era già
  //  di fatto — lo scrive api.crm.lead-sync — ma non nel tipo, e leggerlo con un
  //  cast voleva dire che un errore di battitura sul nome sarebbe passato zitto,
  //  lasciando il campo dell'importo vuoto senza che nessuno capisse perché.
  const rif = String(lead?.data?.quoteRef ?? "").trim();
  const daScheda = totaleDaScheda(lead?.data);

  useEffect(() => {
    if (!attivo || !lead) return;
    //  Si parte da quello che la scheda sa già: è istantaneo, e se la rete non
    //  risponde resta comunque un numero sotto le dita.
    setTotale(daScheda);
    if (!rif) {
      setFonte(daScheda > 0 ? "scheda" : "vuoto");
      return;
    }
    setFonte("attesa");
    const stop = new AbortController();
    fetch(`/api/presenter/quotes?q=${encodeURIComponent(rif)}&limit=5`, { signal: stop.signal })
      .then((r) => r.json() as Promise<{ list?: unknown[]; error?: string }>)
      .then((j) => {
        if (j?.error === "auth") {
          setFonte(daScheda > 0 ? "scheda" : "senzaAccesso");
          return;
        }
        //  Corrispondenza ESATTA sul numero del preventivo: la ricerca è una
        //  "somiglianza" e su un archivio grande restituisce anche i vicini di
        //  casa. Prendere la prima riga vorrebbe dire, ogni tanto, incassare il
        //  preventivo di un altro cliente.
        const riga = (j?.list ?? [])
          .map((x) => x as { quote_ref?: string; total?: number | string })
          .find((x) => String(x.quote_ref ?? "").toUpperCase() === rif.toUpperCase());
        const t = Number(riga?.total);
        if (Number.isFinite(t) && t > 0) {
          setTotale(t);
          setFonte("preventivo");
        } else setFonte(daScheda > 0 ? "scheda" : "vuoto");
      })
      .catch((e: unknown) => {
        if ((e as { name?: string } | null)?.name === "AbortError") return;
        setFonte(daScheda > 0 ? "scheda" : "guasto");
      });
    return () => stop.abort();
    //  `daScheda` è un numero derivato da `lead`: sta fuori dalle dipendenze di
    //  proposito, altrimenti un salvataggio qualunque su questo lead rifarebbe
    //  la chiamata mentre la finestra è aperta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attivo, lead?.id, rif]);

  return { totale, fonte, rif };
}

/** La riga sotto il campo. Dice sempre qualcosa: «non lo so» detto è un'altra
 *  cosa da un campo vuoto e muto, che si legge come «non c'era niente». */
function notaFonte(fonte: FontePreventivo, rif: string): string {
  switch (fonte) {
    case "attesa":
      return `Sto leggendo il preventivo ${rif}…`;
    case "preventivo":
      return `Totale del preventivo ${rif}. Correggilo se avete concordato altro.`;
    case "scheda":
      return "Importo già scritto sulla scheda. Correggilo se avete concordato altro.";
    case "senzaAccesso":
      return `Il preventivo ${rif} non è leggibile da qui (serve l'accesso da presentatore): scrivi tu gli importi.`;
    case "guasto":
      return `Non sono riuscito a leggere il preventivo ${rif}: scrivi tu gli importi.`;
    default:
      return "Nessun preventivo collegato a questa scheda: scrivi tu gli importi.";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. L'INTERRUTTORE CON QUELLO CHE SI APRE SOTTO
   Due domande su tre, qui dentro, hanno risposta "no": stanno chiuse e occupano
   una riga sola. Il campo compare solo quando la risposta diventa "sì" — un
   campo sempre visibile e quasi sempre vuoto insegna a saltare quella zona
   della finestra, e il giorno che serve non lo si vede più.
   ═════════════════════════════════════════════════════════════════════════ */

function Interruttore({
  icona: Icona,
  titolo,
  nota,
  acceso,
  onCambio,
  children,
}: {
  icona: ComponentType<{ className?: string }>;
  titolo: string;
  nota: string;
  acceso: boolean;
  onCambio: (v: boolean) => void;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        //  `shrink-0` per la stessa ragione delle sezioni: in una colonna
        //  flessibile un riquadro senza altezza minima si lascia schiacciare, e
        //  quello che c'è dentro sparisce invece di far scorrere la finestra.
        "shrink-0 rounded-xl border transition-colors",
        acceso ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white",
      )}
    >
      {/*  L'etichetta è cliccabile insieme all'interruttore: 56px di bersaglio
           invece dei 44 scarsi della levetta, che col telefono in una mano sola
           sono la differenza fra accendere e sbagliare riga. */}
      <label
        htmlFor={id}
        className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 px-3 py-2.5"
      >
        <span className="flex min-w-0 items-start gap-2">
          <Icona
            aria-hidden="true"
            className={cn("mt-0.5 h-4 w-4 shrink-0", acceso ? "text-slate-600" : "text-slate-300")}
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-tight text-slate-900">
              {titolo}
            </span>
            <span className="block text-[11.5px] leading-snug text-slate-600">{nota}</span>
          </span>
        </span>
        <Switch id={id} checked={acceso} onCheckedChange={onCambio} />
      </label>
      {acceso && children ? <div className="border-t border-slate-200 p-3">{children}</div> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. LA FINESTRA
   ═════════════════════════════════════════════════════════════════════════ */

export function ChiusuraDialog({
  aperta,
  onChiudi,
  lead,
  stato,
  onSalvata,
}: {
  aperta: boolean;
  onChiudi: () => void;
  /** la pratica che si sta chiudendo; `null` = niente da mostrare */
  lead: Lead | null;
  /** una delle tre chiusure vinte: è QUESTA finestra a scriverlo */
  stato: LeadStatus | null;
  /** avvisa il chiamante che la riga è cambiata davvero (solo dopo la verifica) */
  onSalvata?: (stato: LeadStatus) => void;
}) {
  const { updateLead } = useCRM();

  const [totale, setTotale] = useState("");
  const [acconto, setAcconto] = useState("");
  /** ── ⚠️ QUI DENTRO L'IVA NON SI SCEGLIE PIÙ ─────────────────────────────
   *  Richiesta del committente: «rimuovi tutti i riferimenti a IVA e sconto da
   *  qui, questo deve essere solo una bozza di quello che deve pagare e quanto
   *  ha lasciato di acconto».
   *  Ed è la scelta giusta per QUESTA finestra: si apre col cliente davanti,
   *  nel momento in cui si chiude una vendita, e le uniche due cifre che in
   *  quel momento si sanno sono il prezzo e quello che lascia adesso. Il
   *  trattamento IVA è una domanda da scrivania, non da tavolo, e messa qui
   *  faceva una cosa sola: cambiava il totale (con «aggiungi 22%») dopo che al
   *  cliente era già stata detta un'altra cifra.
   *  ⚠️ NON SPARISCE DAL PROGRAMMA, sparisce da qui. Si sceglie dove serve
   *   davvero: incassando il saldo alla consegna (InstallationScheduleDialog) e
   *   preparando la fattura, che sono i due posti in cui l'IVA cambia qualcosa
   *   per davvero. Qui si continua a salvare il valore predefinito — il prezzo
   *   la comprende — che è esattamente quello che questa finestra scriveva già
   *   quando nessuno toccava i riquadri. */
  const modoIva = MODO_IVA_PREDEFINITO;
  /** vero appena qualcuno tocca uno dei due importi: da lì in poi comanda lui,
   *  e la risposta del preventivo che arriva tardi non gli cambia il campo. */
  const [toccato, setToccato] = useState(false);
  const [suMisura, setSuMisura] = useState(false);
  const [noteMisura, setNoteMisura] = useState("");
  const [extra, setExtra] = useState(false);
  const [extraImporto, setExtraImporto] = useState("");
  const [extraDetto, setExtraDetto] = useState(false);
  /** ── ⚠️ QUANTO È TRACCIATO E QUANTO È IN CONTANTI ──────────────────────
   *  Richiesta del committente, ed è una domanda di cassa: di un acconto di
   *  300 può essere arrivato un bonifico da 200 e 100 in mano. Chi tiene la
   *  contabilità deve sapere quale parte passa dalla banca; chi conta la cassa
   *  a fine giornata deve sapere quanto c'è nel cassetto.
   *  ⚠️ Un campo solo e l'altro CALCOLATO: due caselle libere che devono fare
   *   una somma esatta si contraddicono al primo ripensamento — si corregge
   *   una e l'altra resta indietro, e quello che si salva non torna con
   *   l'acconto. Qui si scrive il contante e il tracciato è il resto (o
   *   viceversa): non possono non tornare.
   */
  const [contanti, setContanti] = useState("");
  /* ── ⚠️ E NEMMENO LO SCONTO ────────────────────────────────────────────
     Stessa richiesta, stesso motivo: qui si scrive QUANTO DEVE PAGARE, cioè la
     cifra a cui si è chiuso. Un secondo campo che toglieva qualcosa al primo
     costringeva a decidere quale dei due fosse «il prezzo» proprio mentre si
     parla col cliente.
     ⚠️ Il prezzo di listino, per chi vuole far vedere quanto ha scontato,
      resta dov'era: sulla scheda del lead («Prezzo di listino — solo se c'è uno
      sconto da mostrare»), che è il posto in cui si ragiona con calma. Questa
      finestra non lo tocca più (vedi il salvataggio). */

  const [note, setNote] = useState("");
  const [salvando, setSalvando] = useState(false);

  const campoAcconto = useRef<HTMLInputElement>(null);
  const campoTotale = useRef<HTMLInputElement>(null);
  const campoExtra = useRef<HTMLInputElement>(null);
  /** ── IL CHIAVISTELLO CONTRO IL DOPPIO SALVATAGGIO ────────────────────────
   *  `salvando` è uno stato di React: fra il primo clic e il render che spegne
   *  il pulsante c'è un istante, e su un tasto che dice «Registra la vendita»
   *  il doppio tocco non è un caso di scuola — è quello che fa chiunque non
   *  veda succedere niente. Peggio ancora ⌘↵ tenuto premuto, che ripete
   *  l'evento decine di volte al secondo.
   *  ⚠️ Il chiavistello è un ref e non uno stato perché deve chiudersi NELLO
   *   STESSO istante del clic, non al render successivo.
   *  Va detto che i soldi non si sommerebbero comunque — il patch scrive valori
   *   assoluti, non incrementi — ma due scritture in volo sullo stesso jsonb
   *   sono due letture-modifiche-scritture sovrapposte, e l'ultima che atterra
   *   cancella quello che ha scritto l'altra. */
  const inCorso = useRef(false);

  const preventivo = useTotalePreventivo(lead, aperta && richiedeChiusura(stato));

  /** ── QUESTA CHIUSURA È GIÀ STATA REGISTRATA UNA VOLTA ────────────────────
   *  Cambia due cose, ed è la differenza fra proporre e sovrascrivere: su una
   *  pratica già chiusa gli importi salvati sono la decisione di una persona
   *  (l'acconto a zero perché paga alla consegna, il totale scontato a voce), e
   *  non li tocca nessuno — né la precompilazione, né il totale del preventivo
   *  che arriva dalla rete un istante dopo. Su una pratica nuova, invece, non
   *  c'è niente da rispettare e conviene proporre. */
  const giaChiusa = useMemo(
    () => !!lead && (richiedeChiusura(lead.data.stato) || lead.data.chiusura != null),
    [lead],
  );

  //  ── COM'È SCRITTA LA FINESTRA QUANDO SI APRE ────────────────────────────
  //   Tutto quello che la scheda sa già, così chi corregge una chiusura non
  //   ricomincia da capo. Si rifà solo al cambio di lead o di stato: legarla a
  //   `lead` intero vorrebbe dire azzerare il modulo a ogni salvataggio altrui.
  useEffect(() => {
    if (!aperta || !lead) return;
    const d = lead.data;
    const t = totaleDaScheda(d);
    /** ⚠️ SI RIPROPONE IL PREZZO CHIUSO, non il listino. Il campo adesso è uno
     *  solo e chiede «quanto deve pagare»: riaprendo una pratica scontata,
     *  mostrare il prezzo pieno vorrebbe dire far confermare al cliente una
     *  cifra che non ha mai accettato — e risalvando la si scriverebbe in
     *  cassa. `prezzoFinaleVendita` è la cifra a cui si è chiuso; il listino
     *  resta scritto dov'è e questa finestra non lo tocca. */
    const chiuso = Number(d.payment?.prezzoFinaleVendita ?? 0) || 0;
    const partenza = chiuso > 0 ? chiuso : t || Number(d.payment?.prezzoTotale ?? 0) || 0;
    setTotale(partenza > 0 ? scriviEuro(partenza) : "");
    //  ⚠️ L'ACCONTO NASCE UGUALE AL TOTALE, ed è la richiesta esplicita del
    //   committente: quasi sempre si incassa tutto o quasi, e riscrivere quattro
    //   cifre col cliente davanti è tempo perso. Il rischio dell'altro caso —
    //   salvare "pagato tutto" quando ha lasciato 500 — è coperto dalla riga
    //   «resta da incassare», che è sempre a schermo e cambia colore.
    //   Una chiusura GIÀ registrata fa eccezione: lì lo zero è una scelta di
    //   qualcuno, non un campo mai compilato, e va rispettata.
    const accSalvato = Number(d.chiusura?.accontoIncassato ?? d.payment?.accontoPagato ?? 0) || 0;
    setAcconto(accSalvato > 0 || giaChiusa ? scriviEuro(accSalvato) : t > 0 ? scriviEuro(t) : "");
    //  ⚠️ Il taglio fra contanti e tracciato NON si ricorda fra un cliente e
    //   l'altro: lasciato acceso dalla pratica di prima, i contanti di un
    //   altro finirebbero in cassa senza che nessuno li abbia scritti.
    setContanti("");
    setToccato(false);
    setSuMisura(!!d.suMisura?.attivo);
    setNoteMisura(d.suMisura?.note ?? "");
    setExtra(!!d.extraDaChiedere?.serve);
    setExtraImporto(d.extraDaChiedere?.importo ? String(d.extraDaChiedere.importo) : "");
    setExtraDetto(!!d.extraDaChiedere?.comunicatoAlCliente);
    setNote(d.chiusura?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperta, lead?.id, stato]);

  //  Il totale letto dal preventivo entra solo se nessuno ha ancora scritto
  //  (vedi la nota su `toccato` in useTotalePreventivo) e solo su una chiusura
  //  nuova.
  //  ⚠️ Senza `giaChiusa` questa riga era una perdita di soldi silenziosa: chi
  //   riapriva una chiusura per correggere il modo di consegna si vedeva
  //   l'acconto di 500 € risalire da solo a 2.400 non appena la rete rispondeva,
  //   e salvava «pagato per intero» una pratica con il saldo ancora aperto.
  useEffect(() => {
    if (!aperta || toccato || giaChiusa) return;
    if (preventivo.fonte !== "preventivo" || preventivo.totale <= 0) return;
    setTotale(scriviEuro(preventivo.totale));
    setAcconto(scriviEuro(preventivo.totale));
  }, [aperta, toccato, giaChiusa, preventivo.fonte, preventivo.totale]);

  //  Il fuoco va sull'acconto, con il numero già selezionato: la finestra si
  //  apre per correggere QUELLA cifra, e chi la deve cambiare scrive e basta.
  //  Il rinvio serve a Radix, che al montaggio porta il fuoco sul tasto di
  //  chiusura del guscio condiviso.
  useEffect(() => {
    if (!aperta) return;
    const t = setTimeout(() => campoAcconto.current?.select(), 60);
    return () => clearTimeout(t);
  }, [aperta]);

  const conti = useMemo(() => {
    //  ⚠️ NON `Number()`: «1.200» battuto da chi scrive le migliaia col punto
    //   — cioè chiunque, in italiano — per Number() vale UNO E VENTI, e una
    //   vendita da milleduecento euro finiva in cassa a 1,20 € senza che
    //   nessun controllo se ne accorgesse (1,20 è pur sempre maggiore di zero).
    //   E «450,73» con la virgola, che il campo numerico rifiuta, valeva zero.
    //   `leggiEuro` legge tutte e quattro le forme che si scrivono davvero, e
    //   una cifra illeggibile vale 0, mai NaN.
    //  ⚠️ UNA CIFRA SOLA: quella che il cliente deve pagare. Non c'è più uno
    //   sconto da sottrarre né un'IVA da aggiungere, quindi il numero battuto è
    //   già il totale della pratica — quello che finisce in cassa, nel saldo
    //   alla consegna e nel fatturato del mese.
    const t = leggiEuro(totale);
    const a = leggiEuro(acconto);
    //  `conto` resta perché lo legge il salvataggio (e perché l'IVA dentro il
    //  prezzo la si scorpora comunque, per il margine): con «inclusa» il totale
    //  è identico alla cifra battuta, quindi a schermo non cambia niente.
    const conto = contoIva(t, modoIva);
    /** ⚠️ IL CONTANTE SI CONTA SUL TOTALE, NON SULL'ACCONTO — correzione del
     *  committente. «Quanto di questi soldi è in contanti» è una domanda su
     *  tutta la pratica: il cliente lascia cento adesso e il resto alla
     *  consegna, e la parte in contanti può stare in tutti e due i momenti.
     *  Legandola all'acconto, chi non ha ancora incassato niente non poteva
     *  dichiarare niente — e chi aveva incassato poco vedeva un tetto che con
     *  il prezzo della pratica non c'entrava.
     *  Il tetto resta il totale: più di quello che il cliente paga non si può
     *  prendere, né in contanti né in altro modo. */
    const inContanti = Math.min(Math.max(0, leggiEuro(contanti)), conto.totale);
    return {
      pattuito: t,
      conto,
      totale: conto.totale,
      acconto: a,
      resto: conto.totale - a,
      contanti: inContanti,
      tracciato: Math.max(0, conto.totale - inContanti),
    };
  }, [totale, acconto, modoIva, contanti]);

  const scriviImporto = (set: (v: string) => void) => (v: string) => {
    setToccato(true);
    set(v);
  };

  const salva = async () => {
    if (!lead || !stato || salvando || inCorso.current) return;

    //  ── LE UNICHE DUE COSE OBBLIGATORIE, E PERCHÉ ─────────────────────────
    //   Il TOTALE: è lui che diventa `payment.prezzoFinaleVendita`, cioè il
    //   primo gradino da cui i KPI leggono il fatturato. Una chiusura senza
    //   totale è una vendita che nel mese vale zero — e il mese lo si guarda a
    //   fine mese, quando nessuno si ricorda più questa telefonata.
    //   L'IMPORTO DELL'EXTRA, ma solo se l'interruttore è acceso: «c'è altro da
    //   chiedere» senza la cifra non è una richiesta, è un'inquietudine — e
    //   l'avviso che comparirà nell'elenco non saprebbe dire quanto.
    //   Tutto il resto è facoltativo di proposito: l'acconto può essere zero
    //   davvero (paga alla consegna), le note su misura possono non servire, e
    //   un campo obbligatorio che non serve si riempie con una x.
    if (!(conti.totale > 0)) {
      toast.error("Manca il totale: senza, questa vendita nel mese vale zero.");
      campoTotale.current?.focus();
      return;
    }
    //  ⚠️ UN IMPORTO NEGATIVO PASSAVA DI QUI SENZA UNA PAROLA. Il segno meno si
    //   scrive, e «-500» battuto per sbaglio (o rimasto da un tentativo di
    //   correggere) superava il controllo qui sotto — perché -500 non è
    //   maggiore del totale — e finiva in cassa. Il
    //   saldo diventava totale PIÙ cinquecento, cioè la pratica chiedeva alla
    //   consegna cinquecento euro in più del dovuto, e a quel punto la
    //   discussione è col cliente davanti.
    if (conti.acconto < 0 || conti.totale < 0) {
      toast.error("Un importo negativo non esiste: controlla il segno meno.");
      (conti.acconto < 0 ? campoAcconto : campoTotale).current?.focus();
      return;
    }
    if (conti.acconto > conti.totale) {
      //  Non è un divieto morale: è che `applyAutoStatus` calcola il saldo come
      //  totale meno acconto, e un saldo negativo si presenta da solo alla
      //  consegna, sotto forma di "resta -300 €" che nessuno sa leggere.
      toast.error("L'acconto è più alto del totale: controlla le due cifre.");
      campoAcconto.current?.focus();
      return;
    }
    const importoExtra = leggiEuro(extraImporto);
    if (extra && !(importoExtra > 0)) {
      toast.error("Quanto c'è ancora da chiedere? Senza l'importo l'avviso non dice niente.");
      campoExtra.current?.focus();
      return;
    }

    inCorso.current = true;
    setSalvando(true);
    try {
      //  ── UN SOLO PACCHETTO ─────────────────────────────────────────────────
      //   Stato, soldi, consegna, su misura ed extra partono insieme: la riga
      //   del database è un unico jsonb, quindi o si scrive tutta o non si
      //   scrive niente. Due `updateLead` in fila sarebbero due momenti diversi,
      //   e il momento in mezzo è quello in cui il lead è già "vinto" e i soldi
      //   non ci sono ancora.
      const patch: Partial<LeadData> = {
        stato,
        //  ⚠️ `chiusura` è il verbale, `payment` è la cassa: types.ts chiede che
        //   chi scrive l'uno riscriva l'altro nello stesso salvataggio. Saltare
        //   `payment` darebbe una pratica vinta con il saldo fermo al totale e
        //   nessun acconto incassato, e il buco si scopre alla consegna.
        payment: {
          ...(lead.data.payment ?? {}),
          //  ⚠️ QUESTA FINESTRA NON SCRIVE PIÙ IL LISTINO. `prezzoTotale` è il
          //   prezzo di partenza e `prezzoFinaleVendita` quello a cui si è
          //   chiuso: da quando qui il campo è uno solo — quanto deve pagare —
          //   riscrivere anche il primo vorrebbe dire cancellare lo sconto che
          //   qualcuno aveva registrato sulla scheda del lead, dove il listino
          //   si continua a mettere.
          //  ⚠️ Un listino più BASSO del prezzo appena chiuso però è una
          //   contraddizione che resterebbe a schermo come «sconto negativo»:
          //   in quel caso si allinea, perché è rimasto indietro da un accordo
          //   precedente. Il resto del CRM — margine, saldo alla consegna,
          //   conti del mese — legge comunque solo il secondo campo.
          ...(Number(lead.data.payment?.prezzoTotale ?? 0) > 0 &&
          Number(lead.data.payment?.prezzoTotale ?? 0) < conti.totale
            ? { prezzoTotale: conti.totale }
            : {}),
          prezzoFinaleVendita: conti.totale,
          accontoPagato: conti.acconto,
          //  ⚠️ Si scrivono solo quando qualcuno ha davvero dichiarato dei
          //   contanti: su una pratica dove nessuno ha detto niente, «tutto
          //   tracciato» sarebbe una dichiarazione che non è stata fatta — e le
          //   schede vecchie non devono cambiare per il fatto di essere state
          //   riaperte e salvate.
          ...(conti.contanti > 0
            ? { incassoTracciato: conti.tracciato, incassoContanti: conti.contanti }
            : {}),
          costi: {
            ...(lead.data.payment?.costi ?? {}),
            //  Il sì/no che il calcolo del margine legge da sempre: ricavato
            //  dal modo invece di restare non detto.
            ivaInclusa: conIvaBool(modoIva),
          },
        },
        chiusura: {
          ...(lead.data.chiusura ?? {}),
          totalePreventivo: conti.totale,
          accontoIncassato: conti.acconto,
          note: note.trim() || undefined,
        },
      };

      const modo = MODO_CONSEGNA[stato];
      if (modo) {
        patch.installazione = {
          ...(lead.data.installazione ?? {}),
          spedizione: {
            ...(lead.data.installazione?.spedizione ?? {}),
            modo,
            //  `daSpedire` resta accanto a `modo` e si scrive sempre insieme a
            //  lui: le pratiche vecchie non hanno `modo`, e chi legge solo il
            //  booleano deve trovarlo aggiornato (vedi InstallazioneInfo).
            daSpedire: modo === "spedizione",
          },
        };
      }

      //  Si scrivono solo se c'è qualcosa da dire: un interruttore mai acceso
      //  non deve lasciare `{attivo:false}` addosso a ottocento schede.
      if (suMisura || lead.data.suMisura) {
        patch.suMisura = {
          ...(lead.data.suMisura ?? {}),
          attivo: suMisura,
          //  Spegnendo l'interruttore la nota NON si cancella: se domani si
          //  riaccende, quello che era stato scritto è ancora lì. Un dato che
          //  sparisce per un tocco è un dato che si riscrive a memoria.
          ...(suMisura ? { note: noteMisura.trim() || undefined } : {}),
        };
      }
      if (extra || lead.data.extraDaChiedere) {
        patch.extraDaChiedere = extra
          ? {
              ...(lead.data.extraDaChiedere ?? {}),
              serve: true,
              importo: importoExtra,
              comunicatoAlCliente: extraDetto,
            }
          : { ...(lead.data.extraDaChiedere ?? {}), serve: false };
      }

      //  ── PRIMA PORTA: QUELLO CHE ORA IL CONTESTO DICE DA SÉ ────────────────
      //   `updateLead` restituisce `false` quando non ha scritto niente: il
      //   database ha rifiutato, oppure il lead non era nell'elenco in memoria e
      //   la funzione è uscita prima ancora di provarci. Prima taceva in tutti e
      //   due i casi e la sua promessa si risolveva identica a quella riuscita.
      const scritto = await updateLead(lead.id, patch);
      if (!scritto) {
        toast.error(
          "Il salvataggio non è partito: la chiusura NON è stata registrata. Controlla la connessione e riprova.",
        );
        return;
      }

      //  ── SECONDA PORTA: SI RILEGGE LA RIGA VERA ────────────────────────────
      //   La prima porta dice che la scrittura è partita senza errori, non che
      //   sulla riga c'è quello che credo. Fra le due cose ci stanno una regola
      //   del database che riscrive un campo, un altro operatore che ha salvato
      //   la stessa scheda un istante prima, un `applyAutoStatus` che cambia
      //   idea sullo stato. Su una vendita la differenza vale l'intero importo,
      //   e una rilettura costa una manciata di millisecondi.
      const { data: riga, error } = await supabase
        .from("crm_leads")
        .select("data")
        .eq("id", lead.id)
        .maybeSingle();

      if (error) {
        //  Qui non si sa: può essere passata e può non essere passata. Si dice
        //  esattamente questo, e la finestra resta aperta con tutto scritto
        //  dentro — riprovare non fa danno, il salvataggio riscrive gli stessi
        //  valori.
        toast.warning("Non riesco a confermare il salvataggio: controlla la scheda e riprova.");
        return;
      }
      const salvato = ((riga as { data?: unknown } | null)?.data ?? {}) as LeadData;
      //  ⚠️ NON BASTA GUARDARE LO STATO, E QUESTO ERA UN BUCO VERO.
      //   Il controllo si fermava a `salvato.stato !== stato`. Ma questa finestra
      //   si riapre anche su una pratica GIÀ chiusa — si torna dentro per
      //   correggere l'acconto, o per cambiare il modo di consegna — e in quel
      //   caso lo stato in archivio coincide già con quello scelto: la verifica
      //   passava sempre, anche se degli IMPORTI non era arrivato niente. Cioè
      //   proprio nel giro in cui si sta correggendo una cifra, che è l'unico
      //   motivo per cui si riapre questa finestra.
      //   Si guarda quindi la CASSA, che è il campo da cui i KPI leggono il
      //   fatturato: se là non c'è il numero appena battuto, non è salvato.
      const cassaOk =
        (Number(salvato.payment?.prezzoFinaleVendita) || 0) === conti.totale &&
        (Number(salvato.payment?.accontoPagato) || 0) === conti.acconto;
      if (salvato.stato !== stato || !cassaOk) {
        toast.error(
          "Il salvataggio non è andato a buon fine: la chiusura NON è stata registrata. Riprova.",
        );
        return;
      }

      toast.success(
        `${LEAD_STATUS_LABEL[stato]} · ${eur(conti.acconto)} incassati su ${eur(conti.totale)}`,
      );
      onSalvata?.(stato);
      onChiudi();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio della chiusura");
    } finally {
      //  ⚠️ IL CHIAVISTELLO SI RIAPRE SEMPRE, ANCHE QUANDO È ANDATA MALE.
      //   Dimenticarlo qui sarebbe peggio del difetto che chiude: la finestra
      //   resta aperta apposta quando il salvataggio non passa, e con il
      //   chiavistello chiuso il tasto «Registra la vendita» non risponderebbe
      //   più — una vendita vera, scritta a schermo, che non si può salvare e
      //   che si perde chiudendo la finestra.
      inCorso.current = false;
      setSalvando(false);
    }
  };

  //  ⌘/Ctrl+↵ salva: questa finestra si compila mentre si parla, e chi è al
  //  computer non deve andare a cercare il tasto col mouse.
  useSalvaConTastiera(aperta && !!lead && !!stato, () => void salva());

  //  L'uscita anticipata sta DOPO tutti gli hook: React li conta per posizione,
  //  e uno saltato è la schermata bianca in produzione (errore 310).
  //  Si esce su `lead`/`stato`, non su `aperta`: tenendo la finestra montata
  //  mentre si chiude, l'animazione di uscita ha il tempo di girare.
  if (!lead || !stato || !richiedeChiusura(stato)) return null;

  const nome = `${lead.data.nome ?? ""} ${lead.data.cognome ?? ""}`.trim();

  return (
    <Finestra
      aperta={aperta}
      onCambio={(v) => !v && onChiudi()}
      titolo="Registra la vendita"
      icona={Trophy}
      larghezza="md"
      /*  Non si chiude toccando fuori: dentro c'è del denaro appena scritto, e
          un tocco a vuoto sul telefono lo butterebbe via senza chiedere. */
      bloccante
      classeCorpo="flex flex-col gap-3"
      contesto={
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          {nome ? <span className="font-medium text-slate-700">{nome}</span> : null}
          <span aria-hidden>→</span>
          <span className={cn(CLASSE_BADGE_STATO, classiStato(stato))}>
            {LEAD_STATUS_LABEL[stato]}
          </span>
        </span>
      }
      azioni={
        <>
          <ScorciatoieFinestra />
          <Button variant="outline" onClick={onChiudi} disabled={salvando}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={salvando} className="sm:min-w-36">
            {salvando ? "Salvataggio…" : "Registra la vendita"}
          </Button>
        </>
      }
    >
      {/* ═══ 1 · I SOLDI ═══ la sola sezione che si compila sempre */}
      <SezioneFinestra
        titolo="Quanto ha lasciato"
        icona={Euro}
        /*  Il conto sta nell'intestazione e si muove mentre si scrive: è la
            frase che il consulente dirà al cliente fra due secondi, ed è
            l'unico controllo contro l'acconto precompilato lasciato lì. */
        azioni={
          conti.totale > 0 ? (
            <span
              className={cn(
                "rounded-lg px-2 py-1 text-[11.5px] font-medium tabular-nums",
                //  Tre esiti, tre colori, e il terzo non è un dettaglio: un
                //  acconto più alto del totale è quasi sempre uno zero di
                //  troppo, e va detto MENTRE si scrive — al salvataggio è già
                //  una discussione, qui è ancora una correzione.
                conti.resto < 0
                  ? "bg-rose-50 text-rose-900"
                  : conti.resto > 0
                    ? "bg-amber-50 text-amber-900"
                    : "bg-emerald-50 text-emerald-900",
              )}
            >
              {conti.resto < 0 ? (
                "l'acconto supera il totale"
              ) : conti.resto > 0 ? (
                <>
                  resta da incassare <span className="font-semibold">{eur(conti.resto)}</span>
                </>
              ) : (
                "pagato per intero"
              )}
            </span>
          ) : undefined
        }
      >
        {/* ⚠️ IL TOTALE VIENE PRIMA, e non è un dettaglio di impaginazione:
            è la cifra da cui dipende tutto il resto — quanto resta da
            incassare, come si conta l'IVA, cosa si dirà al cliente. Avere
            l'acconto a sinistra faceva cominciare dalla risposta. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoFinestra
            etichetta="Totale della pratica (€)"
            obbligatorio
            nota={notaFonte(preventivo.fonte, preventivo.rif)}
          >
            <Input
              ref={campoTotale}
              /*  ⚠️ CAMPO DI TESTO, NON `type="number"`, ed è una correzione di
                  cassa: in italiano gli importi si scrivono «1.200» e «450,73».
                  Un campo numerico rifiuta la virgola (450,73 → campo vuoto →
                  zero) e legge il punto come decimale, quindi «1.200» diventava
                  UNO E VENTI — una vendita da milleduecento euro registrata a
                  1,20 €, sopra zero e quindi accettata da ogni controllo.
                  La lettura la fa `leggiEuro`, la stessa della finestra
                  dell'incasso alla consegna. `inputMode="decimal"` tiene la
                  tastiera numerica sul telefono. */
              inputMode="decimal"
              value={totale}
              onChange={(e) => scriviImporto(setTotale)(e.target.value)}
              placeholder="0"
              className={cn(CLASSE_CAMPO, "h-11 text-[15px] tabular-nums")}
            />
          </CampoFinestra>
          <CampoFinestra
            etichetta="Acconto incassato (€)"
            nota="Quello che il cliente lascia adesso."
          >
            <Input
              ref={campoAcconto}
              /*  ⚠️ CAMPO DI TESTO, NON `type="number"`, ed è una correzione di
                  cassa: in italiano gli importi si scrivono «1.200» e «450,73».
                  Un campo numerico rifiuta la virgola (450,73 → campo vuoto →
                  zero) e legge il punto come decimale, quindi «1.200» diventava
                  UNO E VENTI — una vendita da milleduecento euro registrata a
                  1,20 €, sopra zero e quindi accettata da ogni controllo.
                  La lettura la fa `leggiEuro`, la stessa della finestra
                  dell'incasso alla consegna. `inputMode="decimal"` tiene la
                  tastiera numerica sul telefono. */
              inputMode="decimal"
              value={acconto}
              onChange={(e) => scriviImporto(setAcconto)(e.target.value)}
              placeholder="0"
              className={cn(CLASSE_CAMPO, "h-11 text-[15px] tabular-nums")}
            />
            {/*  I tre casi veri, in un tocco. Le cifre restano correggibili a
                 mano: queste sono scorciatoie, non vincoli. */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pillola
                attiva={conti.totale > 0 && conti.acconto === conti.totale}
                onClick={() => scriviImporto(setAcconto)(totale)}
                titolo="Ha pagato tutto adesso"
              >
                tutto
              </Pillola>
              <Pillola
                attiva={conti.totale > 0 && conti.acconto === Math.round(conti.totale / 2)}
                onClick={() => scriviImporto(setAcconto)(scriviEuro(Math.round(conti.totale / 2)))}
                titolo="Metà adesso, metà alla consegna"
              >
                metà
              </Pillola>
              <Pillola
                attiva={conti.acconto === 0}
                onClick={() => scriviImporto(setAcconto)("0")}
                titolo="Non lascia niente adesso: paga tutto alla consegna"
              >
                niente ora
              </Pillola>
            </div>

          </CampoFinestra>
        </div>

        {/* ── ⚠️ COME HA PAGATO: TRACCIATO O IN CONTANTI ───────────────────
            A tutta larghezza e sotto i due campi, non incastrato dentro
            l'acconto: è una domanda SU quei soldi, e si legge dopo aver visto
            quanto sono. Prima stava dentro la colonna dell'acconto e in uno
            schermo stretto finiva sotto al totale, dove sembrava riferirsi a
            quello.
            ⚠️ Compare solo con un acconto: «quanto di zero è in contanti» non
             è una domanda. */}
        {conti.totale > 0 && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            {/*  ⚠️ «FACOLTATIVO» SCRITTO, non sottinteso: senza, un campo
                vuoto in mezzo a dei soldi si legge come una cosa da
                compilare, e chi non sa ancora come pagherà il resto si
                ferma qui a chiederselo. */}
            <p className="mb-2 text-[12px] font-medium text-slate-900">
              Come ha pagato <span className="font-normal text-slate-500">· facoltativo</span>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  di cui in contanti (€)
                </span>
                <Input
                  inputMode="decimal"
                  value={contanti}
                  onChange={(e) => scriviImporto(setContanti)(e.target.value)}
                  placeholder="facoltativo"
                  className={cn(CLASSE_CAMPO, "h-9 w-[7.5rem] text-[14px] tabular-nums")}
                />
              </label>
              <div className="flex flex-wrap gap-1.5 pb-1">
                <Pillola
                  attiva={conti.contanti === 0}
                  onClick={() => setContanti("")}
                  titolo="Bonifico, carta o POS: tutto tracciato"
                >
                  tutto tracciato
                </Pillola>
                <Pillola
                  attiva={conti.contanti === conti.totale && conti.totale > 0}
                  onClick={() => setContanti(scriviEuro(conti.totale))}
                  titolo="Tutto in contanti"
                >
                  tutto contanti
                </Pillola>
                {/*  L'acconto è la scorciatoia vera quando il resto arriverà
                    alla consegna e non si sa ancora come: si dichiara in
                    contanti solo quello che è già in mano. */}
                {conti.acconto > 0 && conti.acconto < conti.totale && (
                  <Pillola
                    attiva={conti.contanti === conti.acconto}
                    onClick={() => setContanti(scriviEuro(conti.acconto))}
                    titolo="Solo l'acconto è in contanti"
                  >
                    solo l&apos;acconto
                  </Pillola>
                )}
              </div>
            </div>
            {/*  La frase per intero, con tutte e due le cifre: è quello che si
                guarda per controllare, e due numeri incolonnati si confrontano
                meglio di due campi da compilare. */}
            <p className="mt-1.5 text-[11.5px] text-slate-600">
              Sul totale di {eur(conti.totale)}:{" "}
              <span className="font-medium">{eur(conti.tracciato)}</span> tracciati (bonifico,
              carta o POS) e <span className="font-medium">{eur(conti.contanti)}</span> in
              contanti.
            </p>
          </div>
        )}

        {/* ⚠️ QUI SOTTO C'ERA LA SCELTA DELL'IVA, tolta su richiesta del
            committente: questa finestra è la bozza di quello che il cliente
            deve pagare e di quello che lascia adesso. Il perché per esteso —
            e dove l'IVA si sceglie adesso — sta sullo stato `modoIva` in cima
            al file. */}
      </SezioneFinestra>

      {/* ═══ 2 · SU MISURA ═══ */}
      <Interruttore
        icona={Ruler}
        titolo="Impianto su misura"
        nota="Fatto per lui: tempi diversi, e non si sostituisce al volo."
        acceso={suMisura}
        onCambio={setSuMisura}
      >
        <CampoFinestra
          etichetta="Che cosa ha di particolare"
          nota="Serve a chi ordina e a chi posa."
        >
          <Textarea
            value={noteMisura}
            onChange={(e) => setNoteMisura(e.target.value)}
            rows={2}
            placeholder="Attaccatura, forma, misura presa a mano…"
            className={CLASSE_AREA}
          />
        </CampoFinestra>
      </Interruttore>

      {/* ═══ 3 · ALTRI SOLDI DA CHIEDERE ═══ */}
      <Interruttore
        icona={Megaphone}
        titolo="Altri soldi da chiedere"
        nota="Una lavorazione in più, una misura fuori standard, un secondo impianto."
        acceso={extra}
        onCambio={setExtra}
      >
        <div className="flex flex-col gap-3">
          <CampoFinestra etichetta="Quanto (€)" obbligatorio>
            <Input
              ref={campoExtra}
              /*  ⚠️ CAMPO DI TESTO, NON `type="number"`, ed è una correzione di
                  cassa: in italiano gli importi si scrivono «1.200» e «450,73».
                  Un campo numerico rifiuta la virgola (450,73 → campo vuoto →
                  zero) e legge il punto come decimale, quindi «1.200» diventava
                  UNO E VENTI — una vendita da milleduecento euro registrata a
                  1,20 €, sopra zero e quindi accettata da ogni controllo.
                  La lettura la fa `leggiEuro`, la stessa della finestra
                  dell'incasso alla consegna. `inputMode="decimal"` tiene la
                  tastiera numerica sul telefono. */
              inputMode="decimal"
              value={extraImporto}
              onChange={(e) => setExtraImporto(e.target.value)}
              placeholder="0"
              className={cn(CLASSE_CAMPO, "h-11 text-[15px] tabular-nums")}
            />
          </CampoFinestra>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <Checkbox
              checked={extraDetto}
              onCheckedChange={(v) => setExtraDetto(v === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-slate-900">
                Gliel&apos;ho già detto
              </span>
              <span className="block text-[11.5px] leading-snug text-slate-600">
                Lascialo spento se non gliene hai ancora parlato.
              </span>
            </span>
          </label>
          {/*  ⚠️ Nasce SPENTO di proposito. Un avviso di troppo costa un clic a
               chi lo spegne; un avviso mancante costa quei soldi alla consegna,
               quando ormai non si può più chiedere niente. */}
          {!extraDetto ? (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              Finché non risulta detto, questo lead porta un avviso ambra nell&apos;elenco: si vede
              senza aprire la scheda. Si spegne dalla scheda della posa, con la spunta qui sopra.
            </NotaFinestra>
          ) : null}
        </div>
      </Interruttore>

      {/* ═══ 4 · NOTE ═══ */}
      <CampoFinestra
        etichetta="Note sull'accordo"
        nota="La rata promessa a voce, lo sconto concesso, il «paga il resto alla consegna». Com'è andata la consulenza si scrive nelle note post consulenza, che è un'altra cosa."
      >
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Accordi presi sul pagamento…"
          className={CLASSE_AREA}
        />
      </CampoFinestra>
    </Finestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PER CHI LA MONTA — due righe, e non sei
   ─────────────────────────────────────────────────────────────────────────
   I punti da cui si cambia stato nel CRM sono SEI (l'elenco di Oggi, le
   trattative, WhatsApp, la tabella "da fare", i lead importati, la ricerca
   ⌘K). La prima stesura di questa finestra chiedeva a ognuno di dichiarare due
   `useState`, un ramo prima di quello di `requiresAnyDialog` e un elemento in
   fondo al JSX: quindici righe copiate sei volte, e la sesta copia — quella
   che qualcuno si dimentica — è un lead che diventa verde senza che nessuno
   abbia chiesto un euro. È lo stesso difetto che SelettoreStatoDialog esiste
   per togliere, un piano più in basso.
   Quindi la procedura sta QUI, in un posto solo, e chi la monta scrive:

       const chiusura = useChiusura();          // in cima al componente
       ...
       if (chiusura.intercetta(l, nuovo)) return;   // PRIMA di ogni altro ramo
       ...
       {chiusura.finestra}                      // una volta, in fondo al JSX

   ⚠️ `intercetta` risponde `true` quando si è presa in carico la cosa, e in
    quel caso il chiamante NON deve fare altro — soprattutto non `updateLead`.
    Scrivere lo stato lì e gli importi qui sono due salvataggi, e fra i due c'è
    un istante in cui il lead è già vinto e la cassa è vuota; se il secondo non
    passa, quell'istante diventa definitivo.
   ⚠️ E va PRIMA del ramo di `requiresAnyDialog`: se un domani i tre stati
    finissero anche lì, si aprirebbero due finestre per un gesto solo.
   ═══════════════════════════════════════════════════════════════════════ */

/** Quel che serve a montare la chiusura in una pagina che cambia stato.
 *  `finestra` è già l'elemento pronto: non va passato niente, sa già tutto. */
export interface AggancioChiusura {
  /** Se `nuovo` è una delle tre chiusure vinte, apre la finestra e risponde
   *  `true` — da lì in poi la pratica è sua e il chiamante si ferma.
   *  Risponde `false` su tutto il resto, e allora il chiamante prosegue come
   *  ha sempre fatto. */
  intercetta: (lead: Lead, nuovo: LeadStatus) => boolean;
  /** Da mettere una volta sola in fondo al JSX della pagina. */
  finestra: ReactNode;
  /** ── LA FINESTRA È APERTA ADESSO? ───────────────────────────────────────
   *  Serve alle pagine che hanno le SCORCIATOIE DA TASTIERA, e mancava.
   *  `useScorciatoie` (crm/ui) tace dentro i campi di testo, ma un dialogo non
   *  è un campo di testo: con la chiusura aperta il fuoco sta su un pulsante, e
   *  lì un «1» battuto per abitudine finiva a segnare un esito sul lead dietro
   *  — mentre di quella stessa persona si stava registrando la vendita.
   *  Chi non ha scorciatoie può ignorarlo: `intercetta` e `finestra` bastano
   *  ancora da soli. */
  aperta: boolean;
}

/** Vedi il blocco qui sopra: due righe per chi la monta, una procedura sola per
 *  tutti e sei i punti da cui si cambia stato. */
export function useChiusura(onSalvata?: (lead: Lead, stato: LeadStatus) => void): AggancioChiusura {
  //  Un oggetto solo e non due stati separati: lead e stato si accendono e si
  //  spengono INSIEME, e tenerli in due `useState` vuol dire che esiste un
  //  fotogramma in cui la finestra ha il lead nuovo e lo stato vecchio.
  const [in_corso, setInCorso] = useState<{ lead: Lead; stato: LeadStatus } | null>(null);

  const intercetta = (lead: Lead, nuovo: LeadStatus): boolean => {
    if (!richiedeChiusura(nuovo)) return false;
    setInCorso({ lead, stato: nuovo });
    return true;
  };

  const finestra = (
    <ChiusuraDialog
      //  `aperta` guarda l'oggetto, ma il lead resta montato mentre si chiude:
      //  è la finestra stessa a uscire su `lead`/`stato` nulli, e svuotarli
      //  subito le toglierebbe il contenuto a metà animazione.
      aperta={!!in_corso}
      onChiudi={() => setInCorso(null)}
      lead={in_corso?.lead ?? null}
      stato={in_corso?.stato ?? null}
      onSalvata={(s) => {
        if (in_corso) onSalvata?.(in_corso.lead, s);
      }}
    />
  );

  return { intercetta, finestra, aperta: !!in_corso };
}
