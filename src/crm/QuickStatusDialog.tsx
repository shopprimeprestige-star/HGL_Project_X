/** ─────────────────────────────────────────────────────────────────────────
 *  QuickStatusDialog — LA FINESTRA CHE CHIEDE I DETTAGLI
 *
 *  Alcuni stati non sono solo un'etichetta: "Acconto incassato" senza importo
 *  non serve a nessuno, "Ricontatto fissato" senza data nemmeno. Questa
 *  finestra si apre subito dopo la scelta dello stato e chiede SOLO i campi che
 *  quello stato richiede davvero:
 *   · acconto / venduto      → importi, prodotto, costi, installazione
 *   · in_attesa_acconto      → note + interesse percepito 1-10
 *
 *  GLI STATI CHE PROMETTONO UN MOMENTO NON PASSANO PIÙ DI QUI
 *  Quali siano NON è scritto qui: sono le voci di `QUANDO_PER_STATO`
 *  (crm/quando-per-stato.ts), le stesse su cui il selettore disegna l'icona
 *  calendario. Hanno una loro PROCEDURA A PASSI — giorno →
 *  ora → note — che sta in fondo a questo file (`ProceduraQuando`). Un modulo
 *  unico con dentro un campo data, un campo ora e un'area note chiedeva tre
 *  cose insieme in una finestra che si apre in mezzo a una telefonata: la data
 *  si sbagliava perché «2026-09-08» e «2026-08-09» si somigliano, e l'ora si
 *  digitava senza sapere se il consulente in quel momento c'era.
 *
 *  PRECOMPILAZIONE (ibrida, in quest'ordine)
 *   1) i valori già presenti sul lead
 *   2) i valori predefiniti dell'utente (whatsapp_settings.default_values)
 *   3) un default sensato (es. ricontatto = domani alle 10:00)
 *  Si salva con una sola updateLead, così il CRM resta in sync.
 *
 *  IL RIFACIMENTO VISIVO
 *  Prima era un `DialogContent` con `bg-white` scritto a mano ma titolo,
 *  etichette e campi lasciati ai token del tema: dentro il portale Radix i
 *  token tornano quelli scuri della landing, quindi bordi invisibili, testo
 *  slavato e un cursore blu pieno sul primo campo. Adesso usa il guscio
 *  condiviso <Finestra/>: un fondo solo, campi bianchi su slate-50, blocchi
 *  con lo stesso ritmo, e in fondo a destra UNA sola azione piena.
 *  Il titolo dice l'AZIONE ("Registra la vendita"), il nome del cliente e lo
 *  stato di destinazione — che è l'unico colore della finestra — stanno nella
 *  riga di contesto, con la stessa pastiglia dell'elenco trattative.
 *
 *  SI CHIUDE SENZA STACCARE LE MANI
 *  Questa finestra si apre in mezzo a una telefonata: Esc chiude, ⌘/Ctrl+↵
 *  salva, ed è scritto nel piede.
 *  ───────────────────────────────────────────────────────────────────────── */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  PhoneIncoming,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Euro,
  MapPin,
  PauseCircle,
  StickyNote,
  Tags,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
//  La regola dell'IVA sta in un file suo: la stessa domanda si fa qui,
//  alla chiusura della vendita e quando si incassa il saldo.
import { MODO_IVA_PREDEFINITO, ScegliIva, conIvaBool, contoIva, type ModoIva } from "./iva";
import { useCRM } from "./CRMContext";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CampoFinestra,
  CLASSE_AREA,
  CLASSE_CAMPO,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
  VuotoFinestra,
} from "./ui/Finestra";
import {
  LEAD_STATUS_LABEL,
  applyAutoStatus,
  type Consultant,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "./types";
//  La disponibilità si LEGGE, non si ricalcola: due modi di dire chi è libero
//  giovedì pomeriggio danno due risposte diverse per lo stesso pomeriggio, e
//  quella sbagliata la scopre il cliente davanti a una porta chiusa.
import { capienzaConsulenza, generateAvailability } from "./booking-utils";
import { DURATA_PREDEFINITA } from "./invito";
//  La spunta «quest'ora solo per questa persona»: la stessa di tutto il CRM.
import { SpuntaSoloUnaPersona, useModiFascia } from "@/crm/ModoDellaFascia";
import { intestazioniCRM } from "@/crm/AuthContext";
//  Chi può fare una consulenza si chiede lì, e solo lì: la testata di quel file
//  spiega perché il filtro non si riscrive in ogni schermata.
import { NotaSoloConsulenti, consulentiPerConsulenza } from "./chi-fa-la-consulenza";
//  QUALI STATI CHIEDONO UNA DATA STA IN UN FILE SOLO (crm/quando-per-stato.ts):
//  la leggono la scheda del lead, la ricerca ⌘K, il selettore di stato — che ci
//  disegna sopra l'icona calendario — e questa finestra. Finché qui dentro ce
//  n'era una copia, l'icona prometteva una domanda che poi non arrivava.
import {
  QUANDO_PER_STATO,
  chiedeUnaData,
  type RichiestaQuando as QuandoBase,
} from "./quando-per-stato";
import { CLASSE_BADGE_STATO, Tasto, classiStato, dataBreve, eur, useTastoComando } from "./ui";
//  Le due scorciatoie delle finestre stanno in SchedaCliente insieme al loro
//  promemoria: qui si importano, non si riscrivono (l'import va in una
//  direzione sola, quindi non nasce un ciclo).
import { ScorciatoieFinestra, useSalvaConTastiera } from "./SchedaCliente";

interface DefaultValues {
  acconto?: number;
  prezzoFinaleVendita?: number;
  prezzoTotale?: number;
  prodotto?: string;
  costoTaglio?: number;
  costoInstallatore?: number;
  costoProdotto?: number;
  durataInstallazione?: number;
  noteRicontatto?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead | null;
  newStatus: LeadStatus | null;
  /** ── «È STATO SCRITTO» NON SI DEDUCE DALLA CHIUSURA ─────────────────────
   *  Chiamata SOLO quando l'archivio è cambiato davvero. Chi apre questa
   *  finestra vede `onOpenChange(false)` sia se si salva sia se si annulla, e
   *  dai due casi non c'è modo di distinguere: la postazione delle chiamate
   *  (routes/CRM.importa) ci contava sopra i «segnati» della giornata e finiva
   *  per non contare mai gli appuntamenti fissati — cioè l'esito migliore del
   *  giorno, l'unico che passa sempre di qui perché promette un momento.
   *  È lo stesso idioma di `useChiusura(onSalvata)` in ChiusuraDialog: chi non
   *  la passa continua a funzionare come prima. */
  /** ⚠️ Porta con sé il GIORNO appena promesso, quando ce n'è uno: chi apre
   *  questa finestra da una coda di chiamata deve poter mostrare subito dopo
   *  com'è messo quel giorno, e altrimenti dovrebbe rileggersi la scheda
   *  dall'elenco per scoprire una data che questa finestra aveva già in mano.
   *  Chi non se ne fa niente ignora l'argomento: i chiamanti di prima
   *  continuano a funzionare identici. */
  onSalvato?: (info?: { giorno?: string; stato?: LeadStatus }) => void;
}

/** ── LE TRE CHIUSURE VINTE NON STANNO QUI, ED È VOLUTO ────────────────────
 *  Sembra una dimenticanza e non lo è: «Nel nostro centro», «A domicilio» e
 *  «Da spedire» chiedono degli importi eccome, ma li chiede la LORO finestra
 *  (ChiusuraDialog), che oltre ai soldi scrive anche il modo di consegna e lo
 *  stato — tutto in un salvataggio solo. Aggiungerle a questa riga aprirebbe
 *  DUE finestre per un gesto solo: chi cambia stato le intercetta già una riga
 *  prima, con `richiedeChiusura`.
 *  ⚠️ Chi un domani volesse il contrario (le tre dentro il modulo dei
 *   pagamenti) deve prima togliere quel ramo dai sei punti che cambiano stato,
 *   non solo aggiungere la condizione qui.
 *  "venduto" invece resta: non si assegna più, ma le schede d'archivio che lo
 *  portano continuano a passare da questa finestra quando qualcuno ci mette
 *  mano, e togliendolo non chiederebbe più nemmeno l'importo. */
const requiresPaymentDialog = (s: LeadStatus | null): boolean => s === "acconto" || s === "venduto";

const requiresAttesaDialog = (s: LeadStatus | null): boolean => s === "in_attesa_acconto";

/** ── LE DUE ECCEZIONI ALLA TABELLA DEL «QUANDO» ───────────────────────────
 *  `QUANDO_PER_STATO` dice quali stati promettono un momento. Tutti aprono la
 *  procedura a passi tranne questi due, e per due motivi che non sono
 *  dimenticanze:
 *   · `in_attesa_acconto` ha già il SUO modulo — interesse percepito e note —
 *     e la data del sollecito ci sta dentro (vedi la sezione «Attesa acconto»
 *     più sotto): due finestre di fila per lo stesso stato sarebbero due
 *     conferme per un gesto solo;
 *   · `da_spostare` è un ESITO, non una scelta di menu: si segna con il
 *     pulsante dedicato sulla riga dell'agenda, ed è il gesto più frequente
 *     della giornata. La data nuova la dà «Sposta l'appuntamento» nella scheda,
 *     che legge la stessa tabella. */
const SENZA_PROCEDURA: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  "in_attesa_acconto",
  "da_spostare",
]);

/** Gli stati che PROMETTONO UN MOMENTO: non aprono un modulo ma la procedura
 *  a passi (giorno → ora → note). Esportata perché il selettore di stato deve
 *  poterlo dire nella riga, PRIMA che si prema: si sa in anticipo che si
 *  aprirà un calendario e non un campo.
 *
 *  ⚠️ QUI STAVA UN ELENCO SCRITTO A MANO — richiamo, da_ricontattare,
 *  fissa_meet_dopo, viene_in_sede, appuntamento_fissato — cioè cinque stati su
 *  undici. Gli altri sei promettevano una data e non la chiedevano: scegliendo
 *  «Appuntamento rifissato» dalla pagina Oggi, dall'elenco lead o dalla ricerca
 *  il lead restava con una consulenza promessa e senza giorno, cioè fuori dalle
 *  code che ordinano per data — mentre la SCHEDA dello stesso lead la data la
 *  chiedeva, perché legge la tabella condivisa. Adesso la legge anche questa
 *  finestra, e i due percorsi non possono più divergere. */
const apreProceduraQuando = (s: LeadStatus | null): boolean =>
  chiedeUnaData(s) && !SENZA_PROCEDURA.has(s as LeadStatus);

/** Stati che NON richiedono un popup → conferma diretta inline */
const requiresAnyDialog = (s: LeadStatus | null): boolean =>
  requiresPaymentDialog(s) || requiresAttesaDialog(s) || apreProceduraQuando(s);

/** ── IL TITOLO DICE COSA STO FACENDO ──────────────────────────────────────
 *  "Imposta: Acconto incassato" nominava l'oggetto e lasciava all'utente il
 *  compito di capire il verbo. Qui il titolo è l'azione; lo stato di
 *  destinazione, che serve come conferma, sta nella riga di contesto. */
const TITOLO_AZIONE: Partial<Record<LeadStatus, string>> = {
  acconto: "Registra l'acconto",
  venduto: "Registra la vendita",
  in_attesa_acconto: "Segna l'attesa dell'acconto",
};

const ICONA_AZIONE: Partial<Record<LeadStatus, typeof Euro>> = {
  acconto: Euro,
  venduto: Euro,
  in_attesa_acconto: PauseCircle,
};

/** Due colonne sul monitor, una sul telefono: sotto i 640px due campi data e
 *  ora affiancati diventano due bersagli troppo stretti per il pollice. */
const GRIGLIA = "grid grid-cols-1 gap-3 sm:grid-cols-2";

/* ── PICCOLE UTILITÀ DI DATA ───────────────────────────────────────────────
   `toISOString()` NON si usa per le date da calendario: converte in UTC, e la
   mezzanotte italiana diventa le 22 del giorno prima. Chi lavora la sera tardi
   si ritrovava «Domani» che scriveva la data di oggi. Stessa scelta fatta in
   booking-utils e in LeadDialog: una data da calendario si compone a mano. */
function isoLocale(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoOggi(): string {
  return isoLocale(new Date());
}

/** La data di N giorni dopo `base` (o dopo oggi), nel formato del campo date. */
function fraGiorni(n: number, base?: string): string {
  const partenza = testoDi(base).slice(0, 10);
  const d = partenza ? new Date(`${partenza}T12:00:00`) : new Date();
  if (isNaN(d.getTime())) return isoOggi();
  d.setDate(d.getDate() + n);
  return isoLocale(d);
}

/** Tutto quello che arriva dal database va letto senza fidarsi del tipo
 *  dichiarato: negli archivi importati una data è a volte un numero, e
 *  `.slice` su un numero è un errore di render. */
function testoDi(v: unknown): string {
  return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);
}

export function QuickStatusDialog({ open, onOpenChange, lead, newStatus, onSalvato }: Props) {
  const { updateLead } = useCRM();
  const { user } = useAuth();
  const [defaults, setDefaults] = useState<DefaultValues>({});
  const [saving, setSaving] = useState(false);

  // Form state — riusato per tutti gli scenari
  const [accontoPagato, setAccontoPagato] = useState<string>("");
  const [prezzoFinale, setPrezzoFinale] = useState<string>("");
  const [prezzoTotale, setPrezzoTotale] = useState<string>("");
  /** ── COM'È L'IVA SU QUESTO PREZZO ──────────────────────────────────────
   *  Richiesta del committente: registrando l'acconto si deve poter dire se il
   *  prezzo l'IVA la comprende, se va aggiunta (e allora il totale sale del
   *  22%) o se non se ne applica. Prima la domanda esisteva solo alla fine —
   *  incassando il saldo — cioè settimane dopo che la cifra era stata pattuita,
   *  e nel frattempo quella cifra girava per il CRM senza che nessuno sapesse
   *  se era lorda o netta.
   *  ⚠️ Il modo NON si legge dalla scheda e riparte sempre dal predefinito
   *   («inclusa», che è ciò che il CRM salvava prima): il campo che c'è in
   *   archivio è un sì/no sul MARGINE, e leggerlo come «aggiungi» farebbe
   *   crescere del 22% il prezzo di una pratica riaperta per correggere un
   *   nome. */
  const [modoIva, setModoIva] = useState<ModoIva>(MODO_IVA_PREDEFINITO);
  const [prodotto, setProdotto] = useState<string>("");
  const [costoTaglio, setCostoTaglio] = useState<string>("");
  const [costoInstallatore, setCostoInstallatore] = useState<string>("");
  const [costoProdotto, setCostoProdotto] = useState<string>("");
  const [dataInstallazione, setDataInstallazione] = useState<string>("");
  const [orarioInstallazione, setOrarioInstallazione] = useState<string>("");
  const [noteForm, setNoteForm] = useState<string>("");

  const [interesse, setInteresse] = useState<number>(7);
  /*  ── QUANDO SI SOLLECITA L'ANTICIPO ───────────────────────────────────
      `in_attesa_acconto` è nella tabella del «quando» (chiede `dataRicontatto`)
      ed è l'unico stato di quella tabella che NON apre la procedura a passi:
      ha già questo modulo, e due finestre di fila per lo stesso gesto sono una
      di troppo. La data però deve esserci lo stesso — il selettore ci stampa
      sopra il calendario, e soprattutto un anticipo atteso e mai sollecitato è
      un lead perso — quindi il campo sta qui dentro. */
  const [dataSollecito, setDataSollecito] = useState<string>("");

  //  Carica i valori predefiniti da whatsapp_settings.default_values.
  //  NON per gli stati che aprono la procedura guidata: quella non usa nessuno
  //  di questi campi, e una chiamata di rete in più a ogni «richiamo» è mezzo
  //  secondo rubato a chi sta cambiando stato con il cliente in linea.
  useEffect(() => {
    if (!user || !open || apreProceduraQuando(newStatus)) return;
    void (async () => {
      const { data } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (
                k: string,
                v: string,
              ) => {
                maybeSingle: () => Promise<{ data: { default_values?: DefaultValues } | null }>;
              };
            };
          };
        }
      )
        .from("whatsapp_settings")
        .select("default_values")
        .eq("user_id", user.id)
        .maybeSingle();
      setDefaults(data?.default_values ?? {});
    })();
  }, [user, open, newStatus]);

  //  Precompila i campi quando la finestra si apre o cambia lead/stato — di
  //  nuovo, solo per i moduli che quei campi li hanno davvero.
  useEffect(() => {
    if (!open || !lead || !newStatus || apreProceduraQuando(newStatus)) return;
    const d = lead.data;
    const dv = defaults;
    setAccontoPagato(
      d.payment?.accontoPagato != null
        ? String(d.payment.accontoPagato)
        : dv.acconto != null
          ? String(dv.acconto)
          : "",
    );
    setModoIva(MODO_IVA_PREDEFINITO);
    setPrezzoFinale(
      d.payment?.prezzoFinaleVendita != null
        ? String(d.payment.prezzoFinaleVendita)
        : dv.prezzoFinaleVendita != null
          ? String(dv.prezzoFinaleVendita)
          : "",
    );
    setPrezzoTotale(
      d.payment?.prezzoTotale != null
        ? String(d.payment.prezzoTotale)
        : dv.prezzoTotale != null
          ? String(dv.prezzoTotale)
          : "",
    );
    setProdotto(d.payment?.prodotto || dv.prodotto || "");
    setCostoTaglio(
      d.payment?.costi?.costoTaglio != null
        ? String(d.payment.costi.costoTaglio)
        : dv.costoTaglio != null
          ? String(dv.costoTaglio)
          : "",
    );
    setCostoInstallatore(
      d.payment?.costi?.costoInstallatore != null
        ? String(d.payment.costi.costoInstallatore)
        : dv.costoInstallatore != null
          ? String(dv.costoInstallatore)
          : "",
    );
    setCostoProdotto(
      d.payment?.costi?.costoProdotto != null
        ? String(d.payment.costi.costoProdotto)
        : dv.costoProdotto != null
          ? String(dv.costoProdotto)
          : "",
    );
    setDataInstallazione(d.installazione?.dataInstallazione || "");
    setOrarioInstallazione(d.installazione?.orarioInstallazione || "");
    setNoteForm(d.note || "");

    if (requiresAttesaDialog(newStatus)) {
      setNoteForm(d.note || dv.noteRicontatto || "");
      setInteresse(7);
      //  Si riparte dalla data già sulla scheda solo se è ancora futura: una
      //  data di tre giorni fa proposta come sollecito è un sollecito che non
      //  arriva. Altrimenti fra tre giorni, che è il ritmo con cui si richiama
      //  chi ha promesso un bonifico.
      const giaScritta = testoDi(d.dataRicontatto).slice(0, 10);
      setDataSollecito(giaScritta && giaScritta >= isoOggi() ? giaScritta : fraGiorni(3));
    }
  }, [open, lead, newStatus, defaults]);

  const titolo = useMemo(() => {
    if (!newStatus) return "";
    return TITOLO_AZIONE[newStatus] ?? `Imposta ${LEAD_STATUS_LABEL[newStatus]}`;
  }, [newStatus]);

  /*  Il contesto dice DI CHI si parla e DOVE sta andando. Lo stato nuovo non è
      una parola in mezzo alle altre: è la pastiglia colorata dell'elenco, la
      stessa forma e lo stesso colore, così si riconosce senza rileggerla — ed
      è l'unico colore di tutta la finestra. */
  const contesto = useMemo(() => {
    if (!lead || !newStatus) return undefined;
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-slate-700">
          {`${lead.data.nome} ${lead.data.cognome}`.trim()}
        </span>
        <span aria-hidden>→</span>
        <span className={cn(CLASSE_BADGE_STATO, classiStato(newStatus))}>
          {LEAD_STATUS_LABEL[newStatus]}
        </span>
      </span>
    );
  }, [lead, newStatus]);

  /*  Il numero che si guarda mentre si compila: quanto resta da incassare.
      Scritto qui sotto ai campi evita di aprire la calcolatrice — ed è lo
      stesso conto che farà la scheda della consegna. */
  const saldo = useMemo(() => {
    //  `pattuito` è la cifra scritta a mano; `prezzo` è quella che il cliente
    //  paga davvero — le due coincidono sempre TRANNE con «aggiungi IVA», dove
    //  la seconda è la prima +22%. Il residuo si calcola sulla seconda: era il
    //  punto in cui il conto si rompeva, perché «resta» diceva il netto mentre
    //  in cassa sarebbe finito il lordo.
    const pattuito = Number(prezzoFinale) || Number(prezzoTotale) || 0;
    const conto = contoIva(pattuito, modoIva);
    const acconto = Number(accontoPagato) || 0;
    return {
      pattuito,
      conto,
      prezzo: conto.totale,
      acconto,
      resto: Math.max(0, conto.totale - acconto),
    };
  }, [prezzoFinale, prezzoTotale, accontoPagato, modoIva]);

  const handleSave = async () => {
    if (!lead || !newStatus) return;
    setSaving(true);
    try {
      const patch: Partial<LeadData> = { stato: newStatus };

      if (requiresPaymentDialog(newStatus)) {
        patch.payment = {
          ...(lead.data.payment || {}),
          accontoPagato: accontoPagato ? Number(accontoPagato) : 0,
          //  ⚠️ CON «AGGIUNGI IVA» IL PREZZO SCRITTO È QUELLO MAGGIORATO, e non
          //   la cifra battuta nel campo: è l'unica delle tre scelte che cambia
          //   quello che il cliente deve, e salvare il netto qui vorrebbe dire
          //   che il 22% appena dichiarato non lo chiede più nessuno — il saldo
          //   alla consegna lo calcolano tutte le altre pagine da questo campo.
          //   Con «inclusa» e «senza» il conto restituisce la stessa cifra, e il
          //   comportamento resta identico a prima.
          prezzoFinaleVendita:
            modoIva === "aggiunta" && saldo.pattuito > 0
              ? saldo.conto.totale
              : prezzoFinale
                ? Number(prezzoFinale)
                : undefined,
          prezzoTotale: prezzoTotale ? Number(prezzoTotale) : undefined,
          prodotto: prodotto || undefined,
          costi: {
            ...(lead.data.payment?.costi || {}),
            //  Il sì/no che il calcolo del margine legge da sempre: qui si
            //  ricava dal modo, invece di restare non detto come prima.
            ivaInclusa: conIvaBool(modoIva),
            costoTaglio: costoTaglio ? Number(costoTaglio) : undefined,
            costoInstallatore: costoInstallatore ? Number(costoInstallatore) : undefined,
            costoProdotto: costoProdotto ? Number(costoProdotto) : undefined,
          },
        };
        if (dataInstallazione || orarioInstallazione) {
          patch.installazione = {
            ...(lead.data.installazione || {}),
            //  ── CHI INSTALLA SI SCRIVE INSIEME AL QUANDO ────────────────────
            //   L'agenda considera occupata una fascia solo se l'installazione
            //   dice DI CHI è: booking-utils cerca il consulente della posa (e
            //   il driver), non quello della scheda. Senza questo nome la posa
            //   scritta qui esisteva per il cliente e non per il calendario —
            //   lo stesso orario veniva offerto di nuovo, e con lui le due ore
            //   di strada prima e dopo. È la stessa riga che scrivono già la
            //   scheda del cliente e la posa a mano del lead: qui mancava, ed è
            //   l'unico posto da cui una posa poteva nascere anonima.
            //   Se ce n'è già uno non si tocca: riprogrammare da qui non deve
            //   spostare la posa sull'agenda di un'altra persona.
            consulenteInstallazioneId:
              lead.data.installazione?.consulenteInstallazioneId ?? lead.data.consulenteId ?? null,
            dataInstallazione: dataInstallazione || lead.data.installazione?.dataInstallazione,
            orarioInstallazione:
              orarioInstallazione || lead.data.installazione?.orarioInstallazione,
          };
        }
        if (noteForm !== lead.data.note) patch.note = noteForm;
      }

      if (requiresAttesaDialog(newStatus)) {
        //  La data del sollecito va nel campo che la tabella condivisa nomina
        //  (`dataRicontatto`), mai in un campo scelto qui: è il guasto storico
        //  della vecchia barra, dove la data finiva dove l'elenco non guardava.
        if (dataSollecito) patch.dataRicontatto = dataSollecito;
        // Aggiungiamo l'interesse dentro le note in modo umano leggibile (non rompiamo il modello)
        const tag = `[Interesse ${interesse}/10]`;
        const existing = (noteForm || "").trim();
        const note = existing.includes("[Interesse")
          ? existing.replace(/\[Interesse \d+\/10\]/g, tag)
          : `${tag}${existing ? "\n" + existing : ""}`;
        patch.note = note;
      }

      // applyAutoStatus è già richiamato dentro updateLead nel CRMContext
      const _applied: LeadData = applyAutoStatus({ ...lead.data, ...patch } as LeadData);
      void _applied; // solo per chiarezza

      //  ⚠️ La conferma si dà DOPO aver guardato la risposta: `updateLead`
      //   restituisce `false` quando in archivio non è stato scritto niente, e
      //   qui dentro si registrano acconti. Un «Stato aggiornato ✓» su una
      //   scrittura mai avvenuta è il modo più veloce per perdere dei soldi
      //   senza che nessuno se ne accorga. La finestra resta aperta: i dati
      //   appena scritti sono ancora nei campi, si riprova senza ridigitarli.
      if (!(await updateLead(lead.id, patch))) {
        toast.error("Stato NON salvato", {
          description: "La scheda in archivio è rimasta com'era. Riprova.",
        });
        return;
      }
      toast.success(`Stato aggiornato → ${LEAD_STATUS_LABEL[newStatus]}`);
      onSalvato?.({ giorno: dataSollecito || undefined, stato: newStatus });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  //  ⌘/Ctrl+↵ salva da qualunque campo: questa finestra si apre in mezzo a una
  //  telefonata e si chiude senza staccare le mani dalla tastiera.
  //  La procedura guidata ha la SUA scorciatoia (avanti/conferma): senza questa
  //  esclusione un ⌘+↵ ne farebbe scattare due, e la seconda salverebbe un
  //  modulo che l'utente non ha nemmeno visto.
  useSalvaConTastiera(
    open && requiresAnyDialog(newStatus) && !apreProceduraQuando(newStatus),
    () => void handleSave(),
  );

  // Se lo stato non richiede dialog, evita render (il chiamante gestirà il commit diretto)
  if (!requiresAnyDialog(newStatus)) return null;

  /*  GLI STATI CHE PROMETTONO UN MOMENTO PRENDONO L'ALTRA STRADA.
      È un componente a sé — non un ramo di questo `return` — perché ha i suoi
      passi, il suo stato e i suoi calcoli sulla disponibilità: montarli qui
      dentro significherebbe tenerli vivi anche quando si registra un acconto.
      L'uscita anticipata sta DOPO tutti gli hook di questa funzione: React li
      conta per posizione, e uno saltato è la finestra che muore al secondo
      render. */
  if (apreProceduraQuando(newStatus) && lead && newStatus) {
    return (
      <ProceduraQuando
        key={`${lead.id}-${newStatus}`}
        aperta={open}
        onCambio={onOpenChange}
        //  Passa di qui la maggioranza degli esiti che promettono un momento
        //  (richiamo, appuntamento, ricontatto): se `onSalvato` si fermasse al
        //  ramo qui sopra, chi conta i salvataggi non ne vedrebbe quasi nessuno.
        onSalvato={onSalvato}
        lead={lead}
        stato={newStatus}
      />
    );
  }

  const note = (
    <CampoFinestra etichetta="Note" nota="Restano sulla scheda del lead.">
      <Textarea
        value={noteForm}
        onChange={(e) => setNoteForm(e.target.value)}
        rows={3}
        placeholder="Cosa è stato detto, obiezioni, accordi presi…"
        className={CLASSE_AREA}
      />
    </CampoFinestra>
  );

  return (
    <Finestra
      aperta={open}
      onCambio={onOpenChange}
      titolo={titolo}
      contesto={contesto}
      icona={newStatus ? ICONA_AZIONE[newStatus] : undefined}
      larghezza={requiresPaymentDialog(newStatus) ? "md" : "sm"}
      classeCorpo="flex flex-col gap-3"
      azioni={
        <>
          <ScorciatoieFinestra />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="sm:min-w-28">
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </>
      }
    >
      {/* ── VENDITA / ACCONTO ────────────────────────────────────────────────
          Nove campi in fila erano un muro. Divisi per domanda — quanto entra,
          quanto esce, quando si installa — si compilano senza rileggerli. */}
      {requiresPaymentDialog(newStatus) && (
        <>
          <SezioneFinestra
            titolo="Incasso"
            nota="Quello che il cliente paga."
            /*  Il saldo si vede mentre si scrive: è il numero che l'installatore
                dovrà incassare alla consegna, e sbagliarlo qui si scopre tardi. */
            azioni={
              saldo.prezzo > 0 ? (
                <span className="text-[11.5px] tabular-nums text-slate-600">
                  resta <span className="font-semibold text-slate-900">{eur(saldo.resto)}</span>
                </span>
              ) : undefined
            }
          >
            <div className={GRIGLIA}>
              <CampoFinestra etichetta="Acconto pagato (€)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={accontoPagato}
                  onChange={(e) => setAccontoPagato(e.target.value)}
                  placeholder="0"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Prezzo finale vendita (€)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={prezzoFinale}
                  onChange={(e) => setPrezzoFinale(e.target.value)}
                  placeholder="0"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Prezzo totale (€)" nota="Prima di eventuali sconti.">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={prezzoTotale}
                  onChange={(e) => setPrezzoTotale(e.target.value)}
                  placeholder="0"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Prodotto">
                <Input
                  value={prodotto}
                  onChange={(e) => setProdotto(e.target.value)}
                  placeholder="es. Bio-Mimetic L"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
            </div>
          </SezioneFinestra>

          {/* ── COM'È L'IVA SU QUESTO PREZZO ────────────────────────────────
              Richiesta del committente: la domanda si fa QUI, dove il prezzo si
              pattuisce, e non solo settimane dopo quando si incassa il saldo.
              Sta in una sezione sua e sotto l'incasso perché è una domanda SUL
              prezzo appena scritto: metterla sopra vorrebbe dire sceglierla su
              una cifra che ancora non c'è.
              ⚠️ Compare solo quando una cifra c'è: tre riquadri che dicono tutti
               «0,00 €» non sono una scelta, sono rumore in cima a un modulo. */}
          {saldo.pattuito > 0 && (
            <SezioneFinestra
              titolo="Com'è l'IVA su questo prezzo?"
              nota={`Sul pattuito di ${eur(saldo.pattuito)}. Resta scritta: serve al calcolo del netto`}
              azioni={
                saldo.conto.cambiaIlTotale ? (
                  <span className="text-[11.5px] font-semibold tabular-nums text-amber-700">
                    totale {eur(saldo.conto.totale)}
                  </span>
                ) : undefined
              }
            >
              <ScegliIva modo={modoIva} onCambia={setModoIva} base={saldo.pattuito} />
              {saldo.conto.cambiaIlTotale && (
                //  L'unico avviso in ambra del modulo, e compare solo quando il
                //  totale è cambiato davvero: si sta per chiedere al cliente
                //  più di quanto gli è stato detto a voce.
                <p className="mt-2 text-[11.5px] leading-snug text-amber-700">
                  Il prezzo salvato sarà {eur(saldo.conto.totale)}, non {eur(saldo.pattuito)}:{" "}
                  {eur(saldo.conto.imposta)} in più da chiedere al cliente.
                </p>
              )}
            </SezioneFinestra>
          )}

          <SezioneFinestra titolo="Costi" nota="Servono al margine: lasciali vuoti se non li sai.">
            <div className={GRIGLIA}>
              <CampoFinestra etichetta="Costo taglio (€)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={costoTaglio}
                  onChange={(e) => setCostoTaglio(e.target.value)}
                  placeholder="0"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Costo installatore (€)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={costoInstallatore}
                  onChange={(e) => setCostoInstallatore(e.target.value)}
                  placeholder="0"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Costo prodotto (€)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={costoProdotto}
                  onChange={(e) => setCostoProdotto(e.target.value)}
                  placeholder="0"
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
            </div>
          </SezioneFinestra>

          <SezioneFinestra titolo="Installazione" nota="Si può fissare anche dopo.">
            <div className={GRIGLIA}>
              <CampoFinestra etichetta="Data">
                <Input
                  type="date"
                  value={dataInstallazione}
                  onChange={(e) => setDataInstallazione(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
              <CampoFinestra etichetta="Orario">
                <Input
                  type="time"
                  value={orarioInstallazione}
                  onChange={(e) => setOrarioInstallazione(e.target.value)}
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
            </div>
          </SezioneFinestra>

          <SezioneFinestra>{note}</SezioneFinestra>
        </>
      )}

      {/* ── ATTESA ACCONTO ───────────────────────────────────────────────────
          L'interesse era un cursore da trascinare: sul telefono si sbagliava
          di due tacche su tre e il pomello prendeva il navy del tema. Dieci
          bersagli in fila si premono al primo colpo e mostrano il valore
          scelto senza doverlo leggere di fianco. */}
      {requiresAttesaDialog(newStatus) && (
        <SezioneFinestra>
          <div className="flex flex-col gap-3">
            {/*  Prima della nota e prima dell'interesse: è l'unica cosa che
                 riporta il lead sotto gli occhi di qualcuno. */}
            <CampoFinestra
              etichetta="Quando lo solleciti"
              nota="È la data che lo riporta nelle code di lavoro."
            >
              <Input
                type="date"
                value={dataSollecito}
                onChange={(e) => setDataSollecito(e.target.value)}
                className={CLASSE_CAMPO}
              />
            </CampoFinestra>
            {note}
            <CampoFinestra
              etichetta="Interesse percepito"
              nota="1 = lo perdiamo · 10 = paga domani. Finisce nelle note."
            >
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Pillola
                    key={n}
                    attiva={interesse === n}
                    onClick={() => setInteresse(n)}
                    titolo={`Interesse ${n} su 10`}
                    className="h-8 w-8 p-0"
                  >
                    {n}
                  </Pillola>
                ))}
              </div>
            </CampoFinestra>
            <NotaFinestra>
              Il lead resta aperto: lo ritrovi in «Attesa acconto» finché non incassi.
            </NotaFinestra>
          </div>
        </SezioneFinestra>
      )}
    </Finestra>
  );
}

export { apreProceduraQuando, requiresAnyDialog };

/* ═══════════════════════════════════════════════════════════════════════════
   LA PROCEDURA GUIDATA — GIORNO → ORA → NOTE

   UN PASSO PER SCHERMATA, E NON UN MODULO SOLO
   Scegliere «Richiamo concordato» apriva un riquadro con dentro tre domande in
   fila: una data da digitare, un'ora da digitare, un'area note. Tre cose
   insieme, mentre si è al telefono, su un telefono. Qui si fa una domanda per
   volta, si vede sempre a che punto si è, e si torna indietro senza perdere
   quello che si è già scelto.

   IL TERZO PASSO È FACOLTATIVO PER DAVVERO
   Le note si confermano a campo vuoto, con Invio. Non sono un ostacolo fra chi
   telefona e il salvataggio: sono l'ultima occasione di scrivere quello che il
   cliente ha appena detto, e se diventano obbligatorie si riempiono di «ok».

   DUE PRIMI PASSI DIVERSI, PERCHÉ SONO DUE DOMANDE DIVERSE
   Quale dei due si apre NON è deciso qui: lo dice `conOrariLiberi` della
   tabella condivisa, cioè «questo momento occupa l'agenda di un consulente».
    · IL RICONTATTO (richiamo, ricontatto fissato, meet da fissare, in
      valutazione, chat, visita disdetta) e la VISITA IN SEDE: la domanda è «che
      giorno», e la risposta la decide chi telefona. Il calendario è già aperto
      — non un campo data da premere per farlo comparire — con accanto le
      distanze che si scelgono sempre.
    · LA CONSULENZA (appuntamento fissato e rifissato): la domanda è «dove c'è
      posto». Non si sceglie prima la persona e poi il suo calendario: si
      guardano gli orari liberi di TUTTA la squadra insieme, in una griglia
      giorno × fascia, e scegliere un orario decide insieme consulente, giorno
      e ora.

   GLI ORARI LIBERI NON SI RICALCOLANO QUI
   Vengono da `generateAvailability` (booking-utils), che è la stessa fonte
   dell'agenda mensile e della scheda del lead: due modi di calcolare la
   disponibilità darebbero due risposte diverse per lo stesso pomeriggio, e la
   sbagliata la scopre il cliente. Da questo file la disponibilità si LEGGE
   soltanto — comprese le pause del consulente, che nell'archivio importato sono
   un oggetto e non un elenco e che infatti si leggono di là.
   ═════════════════════════════════════════════════════════════════════════ */

type PassoQuando = "giorno" | "ora" | "note";

interface RichiestaQuando extends QuandoBase {
  /** true = il giorno si sceglie dagli orari liberi di tutta la squadra.
   *  Non è una voce da tenere allineata a mano: è `conOrariLiberi` della
   *  tabella condivisa, che dice esattamente la stessa cosa (solo la
   *  consulenza si prende da un buco in agenda). */
  conSquadra?: boolean;
  /** Come finisce scritto nel diario delle note. */
  verbo: string;
  icona: typeof Euro;
}

/*  ── QUELLO CHE QUESTA FINESTRA AGGIUNGE, E NIENT'ALTRO ───────────────────
    Il verbo del diario e l'icona della testata sono le uniche due cose che
    riguardano questa finestra e nessun altro. Campo di destinazione, titolo,
    nota e obbligo dell'ora arrivano da `QUANDO_PER_STATO`.
    Qui c'era invece una TABELLA GEMELLA, con il commento che prometteva «una
    per una, stesse parole»: aveva cinque voci contro undici, e le sei mancanti
    sono state per giorni sei stati che promettevano una data e non la
    chiedevano. Ricopiare significa esattamente questo, e il build non lo vede. */
const VESTE_QUANDO: Partial<Record<LeadStatus, { verbo: string; icona: typeof Euro }>> = {
  richiamo: { verbo: "Richiamo concordato per", icona: CalendarClock },
  da_ricontattare: { verbo: "Ricontatto fissato per", icona: CalendarClock },
  fissa_meet_dopo: { verbo: "Richiamo fissato per", icona: CalendarClock },
  //  Il verbo dice di chi è il turno: è l'unica cosa che distingue questo
  //  stato dal ricontatto, e nel diario deve restare scritta.
  ci_ricontatta_lui: { verbo: "Ci ricontatta lui entro il", icona: PhoneIncoming },
  //  «In valutazione», «Trattativa in chat» e «Visita disdetta» non finiscono
  //  in agenda: quello che si fissa è il giorno in cui li si risente. Il verbo
  //  nomina TUTTE E DUE le cose — dove è finito il lead e quando lo si
  //  riprende — perché la riga del diario è l'unico posto in cui la spunta
  //  «l'ho ricontattato» resta scritta.
  sta_valutando: { verbo: "In valutazione, da risentire il", icona: CalendarClock },
  gestire_in_chat: { verbo: "Da gestire in chat, si riprende il", icona: CalendarClock },
  sede_disdetta: { verbo: "Visita disdetta, da risentire il", icona: CalendarClock },
  viene_in_sede: { verbo: "Appuntamento in sede fissato per", icona: MapPin },
  appuntamento_fissato: { verbo: "Appuntamento fissato per", icona: CalendarDays },
  //  Il cliente di ritorno: stesso gesto del primo appuntamento — si guarda
  //  dove c'è posto in squadra — e nel diario si legge che è un RI-fissato,
  //  perché la storia alle spalle è il motivo per cui lo si richiama.
  appuntamento_rifissato: { verbo: "Appuntamento rifissato per", icona: CalendarDays },
};

/*  La tabella della procedura è DERIVATA: un giorno in cui uno stato entra in
    `QUANDO_PER_STATO` entra da solo anche qui, con parole neutre se nessuno gli
    ha ancora scritto il verbo — una finestra con un titolo generico si legge,
    una finestra che non si apre no. */
const QUANDO_GUIDATO: Partial<Record<LeadStatus, RichiestaQuando>> = Object.fromEntries(
  (Object.entries(QUANDO_PER_STATO) as [LeadStatus, QuandoBase][])
    .filter(([s]) => !SENZA_PROCEDURA.has(s))
    .map(([s, base]) => [
      s,
      {
        ...base,
        conSquadra: !!base.conOrariLiberi,
        verbo: VESTE_QUANDO[s]?.verbo ?? `${LEAD_STATUS_LABEL[s] ?? s} ·`,
        icona: VESTE_QUANDO[s]?.icona ?? CalendarClock,
      } satisfies RichiestaQuando,
    ]),
) as Partial<Record<LeadStatus, RichiestaQuando>>;

/** Quanto dura una consulenza quando la scheda non lo dice: è la stessa misura
 *  usata da booking-utils, altrimenti lo stesso slot occuperebbe mezz'ora di
 *  qua e un'ora di là. */
//  ⚠️ LA DURATA DI SERIE È UNA SOLA PER TUTTO IL CRM (crm/invito): qui ce
//   n'era una sua, e lo stesso appuntamento durava 30 minuti se fissato dalla
//   coda dei lead importati e 45 se fissato da un'altra schermata.
const DURATA_CONSULENZA = DURATA_PREDEFINITA;
/** Le durate fra cui si sceglie fissando una consulenza. Sono le stesse della
 *  scheda del lead (crm/LeadDialog): due elenchi diversi vorrebbero dire che
 *  una durata scelta qui non si ritrova là. */
const DURATE_CONSULENZA = [15, 30, 45, 60, 90];
/** Fin dove si guarda avanti negli orari liberi. Oltre le due settimane un
 *  appuntamento non si prende al telefono: si richiama. */
const GIORNI_AVANTI = 14;

/* ── LE DISTANZE CHE SI SCELGONO SEMPRE ────────────────────────────────────
   «Domani», «fra 3 giorni», «fra una settimana» coprono la quasi totalità dei
   ricontatti: dal calendario costano quattro tocchi, da qui uno. Restano
   ACCANTO al calendario, non al posto suo: sono la scorciatoia dei casi
   frequenti, non l'unica strada. */
const SCORCIATOIE_GIORNO: { g: number; l: string }[] = [
  { g: 1, l: "Domani" },
  { g: 3, l: "Fra 3 giorni" },
  { g: 7, l: "Fra una settimana" },
  { g: 14, l: "Fra due settimane" },
];

/* ── LE TRE FASCE DELLA GIORNATA ───────────────────────────────────────────
   Sono l'unità con cui si parla al telefono («ti va bene giovedì mattina?») ed
   è anche l'unica che sta in larghezza su un telefono: quattordici giorni per
   sedici orari sono duecento bersagli, quattordici per tre sono quarantadue. */
const FASCE: { nome: string; da: number; a: number }[] = [
  { nome: "Mattina", da: 0, a: 13 * 60 },
  { nome: "Pomeriggio", da: 13 * 60, a: 17 * 60 },
  { nome: "Sera", da: 17 * 60, a: 24 * 60 },
];

/** Gli orari che si scelgono a mano, divisi nelle stesse tre fasce. */
const ORE_MANUALI: { nome: string; ore: string[] }[] = FASCE.map((f) => ({
  nome: f.nome,
  //  `f.a` è il confine ESCLUSO della fascia: senza il mezz'ora in meno le
  //  13:00 comparirebbero sia sotto «Mattina» sia sotto «Pomeriggio», e la
  //  stessa ora premuta in due punti diversi fa dubitare di averla premuta.
  ore: serieOre(Math.max(f.da, 8 * 60), Math.min(f.a - 30, 20 * 60 + 30)),
}));

/** I quattro orari più usati, gli stessi della finestrella del «quando» nella
 *  scheda del lead: chi lavora al telefono li preme senza cercarli. */
const ORE_FREQUENTI = ["09:00", "11:00", "15:00", "18:00"];

const GIORNI_CORTI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const MESI_CORTI = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];
const GIORNI_LUNGHI = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];
const MESI_LUNGHI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** "09:30" → 570. Null quando il valore non è un orario: dall'archivio arriva
 *  di tutto, e un NaN che scivola in un confronto rende «libero» un orario che
 *  non lo è. */
function minutiDi(hhmm?: unknown): number | null {
  const s = testoDi(hhmm);
  const [h, m] = s.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function oraDi(minuti: number): string {
  return `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;
}

function serieOre(da: number, a: number, passo = 30): string[] {
  const out: string[] = [];
  for (let m = da; m <= a; m += passo) out.push(oraDi(m));
  return out;
}

/** «2026-08-21» → «gio 21 ago». Sta dove lo spazio è una riga sola. */
function etichettaGiorno(iso: string): string {
  const d = new Date(`${testoDi(iso).slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return testoDi(iso);
  return `${GIORNI_CORTI[d.getDay()]} ${d.getDate()} ${MESI_CORTI[d.getMonth()]}`;
}

/** La data detta come si dice al telefono: «giovedì 21 agosto, ore 15:30».
 *  Una data in cifre si legge ma non si CONTROLLA, e quello che si controlla
 *  mentre si parla è il giorno della settimana. */
function quandoInChiaro(data?: unknown, ora?: unknown): string {
  const giorno = testoDi(data).slice(0, 10);
  const orario = testoDi(ora).slice(0, 5);
  if (!giorno) return "";
  const d = new Date(`${giorno}T12:00:00`);
  if (isNaN(d.getTime())) return orario ? `${giorno}, ore ${orario}` : giorno;
  const etichetta = `${GIORNI_LUNGHI[d.getDay()]} ${d.getDate()} ${MESI_LUNGHI[d.getMonth()]}`;
  return orario ? `${etichetta}, ore ${orario}` : etichetta;
}

/** «fra 8 giorni», «domani», «3 giorni fa». È l'unica cosa che dice se la data
 *  scelta è quella giusta: «21 agosto» da solo non lo dice. */
function distanzaInChiaro(data?: unknown): string {
  const giorno = testoDi(data).slice(0, 10);
  if (!giorno) return "";
  const d = new Date(`${giorno}T12:00:00`);
  if (isNaN(d.getTime())) return "";
  const oggi = new Date();
  oggi.setHours(12, 0, 0, 0);
  const g = Math.round((d.getTime() - oggi.getTime()) / 86_400_000);
  if (g === 0) return "oggi";
  if (g === 1) return "domani";
  if (g === -1) return "ieri";
  return g > 0 ? `fra ${g} giorni` : `${-g} giorni fa`;
}

/** Il nome del consulente letto senza dare per scontato che la scheda sia
 *  completa: una riga senza `data` è già bastata ad abbattere una finestra. */
function nomeDelConsulente(c?: Consultant): string {
  return testoDi(c?.data?.nome).trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   I PEZZI DELLA PROCEDURA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── DOVE SONO ARRIVATO ───────────────────────────────────────────────────
 *  Tre tappe sempre visibili, con sotto la risposta già data. Non è
 *  decorazione: senza, una procedura a passi diventa una finestra che cambia
 *  contenuto da sola e non si sa più quanto manca. Le tappe già fatte si
 *  premono per tornarci — indietro è un tocco, non un ripensamento. */
const PASSI: { id: PassoQuando; nome: string }[] = [
  { id: "giorno", nome: "Giorno" },
  { id: "ora", nome: "Ora" },
  { id: "note", nome: "Note" },
];

function BarraPassi({
  passo,
  data,
  ora,
  oraFacoltativa,
  onVai,
}: {
  passo: PassoQuando;
  data: string;
  ora: string;
  oraFacoltativa: boolean;
  onVai: (p: PassoQuando) => void;
}) {
  const indice = PASSI.findIndex((p) => p.id === passo);
  const risposte: Record<PassoQuando, string> = {
    giorno: data ? etichettaGiorno(data) : "da scegliere",
    ora: ora || (oraFacoltativa ? "facoltativa" : "da scegliere"),
    note: "facoltative",
  };
  return (
    <div className="flex items-stretch gap-1.5">
      {PASSI.map((p, i) => {
        const corrente = i === indice;
        const fatto = i < indice;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => (fatto ? onVai(p.id) : undefined)}
            disabled={!fatto}
            aria-current={corrente ? "step" : undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
              corrente && "border-sky-300 bg-sky-50",
              fatto && "border-slate-200 bg-white hover:bg-slate-50",
              !corrente && !fatto && "border-slate-200 bg-white opacity-60",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                corrente
                  ? "bg-sky-600 text-white"
                  : fatto
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500",
              )}
            >
              {fatto ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate text-[11.5px] font-semibold leading-tight",
                  corrente ? "text-sky-900" : "text-slate-700",
                )}
              >
                {p.nome}
              </span>
              <span className="block truncate text-[11px] leading-tight text-slate-500">
                {risposte[p.id]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** ── IL CALENDARIO, GIÀ APERTO ────────────────────────────────────────────
 *  Non un campo data che apre il calendario del sistema operativo — che su
 *  Android e su iPhone è una cosa diversa ogni volta — ma il mese disegnato
 *  qui, sempre visibile, con i giorni passati spenti perché un ricontatto nel
 *  passato non esiste. Sei righe fisse: un mese da cinque righe e uno da sei
 *  farebbero saltare l'altezza della finestra fra un mese e l'altro. */
function CalendarioMese({
  scelto,
  minimo,
  onScegli,
}: {
  scelto: string;
  /** primo giorno scegliibile (di norma oggi) */
  minimo: string;
  onScegli: (iso: string) => void;
}) {
  const [mese, setMese] = useState(() => {
    const base = testoDi(scelto).slice(0, 10) || minimo;
    const d = new Date(`${base}T12:00:00`);
    const buona = isNaN(d.getTime()) ? new Date() : d;
    return new Date(buona.getFullYear(), buona.getMonth(), 1);
  });

  //  Scegliendo una scorciatoia («fra due settimane») la data può cadere nel
  //  mese dopo: il calendario ci si sposta da solo, altrimenti si accende un
  //  giorno che non è a schermo e sembra che il tocco non abbia fatto niente.
  useEffect(() => {
    const d = new Date(`${testoDi(scelto).slice(0, 10)}T12:00:00`);
    if (isNaN(d.getTime())) return;
    setMese((m) =>
      m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth()
        ? m
        : new Date(d.getFullYear(), d.getMonth(), 1),
    );
  }, [scelto]);

  const primo = new Date(mese.getFullYear(), mese.getMonth(), 1);
  //  La settimana italiana comincia di lunedì: `getDay()` la fa cominciare di
  //  domenica, e il mese risultava scalato di un giorno.
  const inizio = new Date(primo);
  inizio.setDate(primo.getDate() - ((primo.getDay() + 6) % 7));
  const celle = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inizio);
    d.setDate(inizio.getDate() + i);
    return d;
  });

  const oggi = isoOggi();
  const meseMinimo = new Date(`${minimo}T12:00:00`);
  const indietroSpento =
    !isNaN(meseMinimo.getTime()) &&
    mese.getFullYear() * 12 + mese.getMonth() <=
      meseMinimo.getFullYear() * 12 + meseMinimo.getMonth();

  const titolo = `${MESI_LUNGHI[mese.getMonth()]} ${mese.getFullYear()}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          disabled={indietroSpento}
          aria-label="Mese precedente"
          onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-[13px] font-semibold capitalize text-slate-900">{titolo}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500"
          aria-label="Mese successivo"
          onClick={() => setMese(new Date(mese.getFullYear(), mese.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {["lun", "mar", "mer", "gio", "ven", "sab", "dom"].map((g, i) => (
          <span
            key={i}
            className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400"
          >
            {g.charAt(0)}
          </span>
        ))}
        {celle.map((d) => {
          const iso = isoLocale(d);
          const fuori = d.getMonth() !== mese.getMonth();
          const passato = iso < minimo;
          const attivo = iso === scelto;
          return (
            <button
              key={iso}
              type="button"
              disabled={passato}
              aria-pressed={attivo}
              aria-label={quandoInChiaro(iso)}
              onClick={() => onScegli(iso)}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg border text-[13px] tabular-nums transition-colors",
                attivo
                  ? "border-sky-600 bg-sky-600 font-semibold text-white"
                  : iso === oggi
                    ? "border-sky-200 bg-sky-50 font-semibold text-sky-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                fuori && !attivo && "text-slate-400",
                passato && "cursor-not-allowed border-transparent bg-transparent text-slate-300",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── GLI ORARI LIBERI DI TUTTA LA SQUADRA ──────────────────────────────────
   Una riga per giorno, con quanti orari restano: si preme il giorno e si vede
   la giornata intera (prima erano tre colonne e bisognava sceglierne una).
   Occupa quanto una tastiera e risponde alla domanda vera del committente —
   «dove c'è posto?» — senza chiedere prima di scegliere la persona. */
interface SlotSquadra {
  ora: string;
  consulente: Consultant;
  /*  ── ⚠️ QUANTI CI SONO GIÀ IN QUEST'ORA ──────────────────────────────
      Segnalazione del committente: spostando una consulenza «non mi dà gli
      slot 1/3 2/3 sugli orari».
      Questa schermata riceveva soltanto l'elenco delle ore libere, come testo:
      non aveva i numeri e non poteva scriverli. Adesso arrivano con l'ora, da
      `generateAvailability`, che li calcola con la stessa regola della scheda
      del lead — quella provata — così la stessa mezz'ora si legge uguale
      ovunque la si guardi. */
  presi: number;
  posti: number;
}
interface GiornoSquadra {
  data: string;
  etichetta: string;
  slot: SlotSquadra[];
  /** quanti orari liberi per ciascuna fascia, nell'ordine di FASCE */
  perFascia: number[];
  /** quante persone diverse hanno almeno un buco quel giorno */
  consulenti: number;
}

/** In quale mezza giornata cade quest'ora. -1 = non si sa.
 *  ⚠️ SERVE SOLO A SCRIVERE L'ETICHETTA: da quando la giornata si vede intera,
 *   le fasce non filtrano più niente (richiesta del committente). */
function fasciaDi(ora: string): number {
  return FASCE.findIndex((f) => {
    const m = minutiDi(ora);
    return m !== null && m >= f.da && m < f.a;
  });
}

function dentroFascia(indice: number, ora: string): boolean {
  const m = minutiDi(ora);
  if (m === null) return false;
  const f = FASCE[indice];
  return m >= f.da && m < f.a;
}

/** Gli orari liberi della squadra, giorno per giorno.
 *
 *  Tutto quello che entra qui viene da fuori — schede dei consulenti e lead
 *  così come stanno in archivio — quindi niente si dà per scontato: né che
 *  `generateAvailability` restituisca un elenco, né che dentro i giorni ci
 *  siano davvero degli orari. Torna `null` quando il calcolo cade: in quel caso
 *  la procedura non muore, offre la strada a mano. */
function giorniDellaSquadra(
  squadra: Consultant[],
  durata: number,
  elenco: Lead[],
  escludiLeadId?: string,
  /** Le ore tenute per una persona sola, «AAAA-MM-GG HH:MM» → "solo". */
  oreTenute?: Record<string, "solo">,
): GiornoSquadra[] | null {
  try {
    const per = new Map<string, SlotSquadra[]>();
    for (const c of squadra) {
      const giorni = generateAvailability(
        c,
        durata,
        elenco,
        GIORNI_AVANTI,
        undefined,
        escludiLeadId,
        undefined,
        //  ⚠️ Senza questo, un'ora tenuta per una persona sola risultava
        //   «1 di 3, c'è ancora posto» e la si poteva offrire a un secondo
        //   cliente: la spunta non serviva a niente (vedi booking-utils).
        oreTenute,
      );
      if (!Array.isArray(giorni)) continue;
      for (const g of giorni) {
        if (!g || typeof g.date !== "string" || !Array.isArray(g.slots)) continue;
        const riga = per.get(g.date) ?? [];
        const statoDi = new Map((g.ore ?? []).map((x) => [x.ora, x]));
        for (const o of g.slots)
          if (typeof o === "string" && o) {
            const st = statoDi.get(o);
            riga.push({ ora: o, consulente: c, presi: st?.presi ?? 0, posti: st?.capienza ?? 0 });
          }
        per.set(g.date, riga);
      }
    }

    //  Le 09:00 di oggi alle 16 non sono un orario libero: sono un
    //  appuntamento nel passato. È la stessa regola di `prossimoSlotLibero`.
    const adesso = new Date();
    const oggi = isoLocale(adesso);
    const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();

    const out: GiornoSquadra[] = [];
    per.forEach((slot, data) => {
      const utili = (
        data === oggi
          ? slot.filter((s) => {
              const m = minutiDi(s.ora);
              return m !== null && m >= minutiAdesso;
            })
          : slot
      ).sort(
        (a, b) =>
          a.ora.localeCompare(b.ora) ||
          nomeDelConsulente(a.consulente).localeCompare(nomeDelConsulente(b.consulente)),
      );
      if (utili.length === 0) return;
      out.push({
        data,
        etichetta: etichettaGiorno(data),
        slot: utili,
        perFascia: FASCE.map((_, i) => utili.filter((s) => dentroFascia(i, s.ora)).length),
        consulenti: new Set(utili.map((s) => s.consulente.id)).size,
      });
    });
    return out.sort((a, b) => a.data.localeCompare(b.data));
  } catch (e) {
    console.warn("[CRM] orari liberi della squadra non calcolabili", e);
    return null;
  }
}

function GrigliaSquadra({
  giorni,
  data,
  onScegli,
}: {
  giorni: GiornoSquadra[];
  data: string;
  onScegli: (data: string) => void;
}) {
  /*  ── ⚠️ IL GIORNO SI SCEGLIE, LA FASCIA NO ────────────────────────────
      Richiesta del committente: «mostra tutte le disponibilità tutte insieme
      senza farmi selezionare mattina pomeriggio sera: dammi la giornata
      completa».
      Qui c'erano tre colonne — mattina, pomeriggio, sera — e bisognava
      sceglierne UNA per vedere gli orari. Due conseguenze: chi al telefono
      sente «quando potete?» doveva già sapere che mezza giornata proporre, e
      l'orario buono poteva stare nella colonna che non aveva aperto. Adesso
      una riga per giorno con quanti orari ci sono, e premendola si vede la
      GIORNATA INTERA. Le tre mezze giornate restano scritte, ma come
      informazione: dicono dov'è il posto, non obbligano a decidere. */
  return (
    <div className="space-y-1.5">
      {giorni.map((g) => {
        const attivo = data === g.data;
        const dettaglio = FASCE.map((f, i) => ({ nome: f.nome, quanti: g.perFascia[i] ?? 0 }))
          .filter((x) => x.quanti > 0)
          .map((x) => `${x.quanti} ${x.nome.toLowerCase()}`)
          .join(" · ");
        return (
          <button
            key={g.data}
            type="button"
            aria-pressed={attivo}
            onClick={() => onScegli(g.data)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
              attivo
                ? "border-sky-600 bg-sky-50"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-slate-900">
                {g.etichetta}
              </span>
              <span className="block truncate text-[11.5px] text-slate-500">
                {dettaglio || "nessun orario"} · {g.consulenti}{" "}
                {g.consulenti === 1 ? "consulente" : "consulenti"}
              </span>
            </span>
            {/*  Il numero è il totale della giornata: è la risposta alla
                domanda «quel giorno c'è posto?», che è quella che si fa. */}
            <span
              className={cn(
                "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[14px] font-bold tabular-nums",
                attivo ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-800",
              )}
            >
              {g.slot.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Tutti gli orari di quel giorno, raccolti sotto il nome di chi è libero:
 *  sceglierne uno decide insieme consulente, giorno e ora. */
function OreDellaSquadra({
  giorno,
  ora,
  consulenteId,
  onScegli,
}: {
  giorno: GiornoSquadra;
  ora: string;
  consulenteId: string | null;
  onScegli: (ora: string, consulente: Consultant) => void;
}) {
  /*  ── ⚠️ LA GIORNATA INTERA, NON UNA FASCIA ALLA VOLTA ─────────────────
      Richiesta del committente: «mostra tutte le disponibilità tutte insieme
      senza farmi selezionare mattina pomeriggio sera».
      Qui c'era un filtro a tre pulsanti e si vedeva solo la mezza giornata
      scelta: al telefono, con il cliente che chiede «quando potete?», si
      finiva a leggere tre elenchi uno dopo l'altro — e l'ora buona poteva
      stare in quello non aperto.
      Adesso si vedono TUTTE le ore del giorno, sotto il nome di chi è libero.
      Le mezze giornate restano come etichette dentro l'elenco: servono a
      orientare l'occhio su una fila lunga, non a decidere. */
  const gruppi: { consulente: Consultant; ore: SlotSquadra[] }[] = [];
  for (const s of giorno.slot) {
    const trovato = gruppi.find((g) => g.consulente.id === s.consulente.id);
    if (trovato) trovato.ore.push(s);
    else gruppi.push({ consulente: s.consulente, ore: [s] });
  }

  return (
    <div className="space-y-3">
      {gruppi.length === 0 ? (
        <VuotoFinestra testo="Nessun orario libero in questo giorno: provane un altro." />
      ) : (
        gruppi.map((g) => (
          <div key={g.consulente.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {nomeDelConsulente(g.consulente) || "Consulente senza nome"}
              <span className="ml-auto text-[11px] font-normal text-slate-400">
                {g.ore.length} liber{g.ore.length === 1 ? "o" : "i"}
              </span>
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {g.ore.map((s, i) => {
                const mia = fasciaDi(s.ora);
                //  L'etichetta della mezza giornata compare SOLO quando cambia:
                //  su venti pastiglie in fila è l'unico appiglio per l'occhio, e
                //  non si preme — è una scritta, non un filtro.
                const cambia = i === 0 || mia !== fasciaDi(g.ore[i - 1].ora);
                const scelta = ora === s.ora && consulenteId === g.consulente.id;
                return (
                  <Fragment key={s.ora}>
                    {cambia && mia >= 0 && (
                      <span className="w-full pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                        {FASCE[mia].nome}
                      </span>
                    )}
                    <Pillola
                      attiva={scelta}
                      onClick={() => onScegli(s.ora, g.consulente)}
                      className={cn(
                        "py-2",
                        //  ⚠️ Ambra = «c'è già qualcuno a quest'ora, e c'è ancora
                        //   posto»: lo stesso colore della scheda del lead, perché
                        //   è la stessa cosa. Due colori diversi per lo stesso
                        //   fatto sono il modo di non fidarsi più di nessuno dei
                        //   due. Le ore occupate non compaiono affatto qui: in una
                        //   griglia di squadra un'ora sbarrata per un consulente e
                        //   libera per un altro direbbe due cose insieme.
                        s.presi > 0 &&
                          !scelta &&
                          "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
                      )}
                      /*  ⚠️ La casella accesa è quella dove il cliente è già
                        fissato: senza dirlo, una griglia con un'ora evidenziata
                        e nient'altro si legge come «ho appena scelto», non come
                        «è già così». */
                      titolo={
                        scelta
                          ? "È l'orario fissato adesso per questo cliente. Scegline un altro per spostarlo."
                          : s.presi > 0
                            ? `${s.presi} di ${s.posti} in quest'ora: c'è ancora posto, la consulenza è la stessa per tutti.`
                            : undefined
                      }
                    >
                      {s.ora}
                      {/*  Il contatore, com'è nella scheda del lead: quante
                         persone ci sono già in quell'ora e quante ce ne stanno. */}
                      {s.posti > 0 && (
                        <span className="text-[10px] font-semibold opacity-80">
                          {s.presi}/{s.posti}
                        </span>
                      )}
                    </Pillola>
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Gli orari scelti a mano: per il ricontatto non c'è un'agenda da rispettare,
 *  c'è l'ora che ha detto il cliente. */
function OreManuali({
  ora,
  facoltativa,
  onScegli,
}: {
  ora: string;
  facoltativa: boolean;
  onScegli: (ora: string) => void;
}) {
  return (
    <div className="space-y-3">
      <CampoFinestra etichetta="Orari più usati">
        <div className="flex flex-wrap gap-1.5">
          {ORE_FREQUENTI.map((o) => (
            <Pillola key={o} attiva={ora === o} onClick={() => onScegli(o)} className="py-2">
              {o}
            </Pillola>
          ))}
          {facoltativa && (
            <Pillola attiva={!ora} onClick={() => onScegli("")} className="py-2">
              Senza orario
            </Pillola>
          )}
        </div>
      </CampoFinestra>

      {ORE_MANUALI.map((b) => (
        <CampoFinestra key={b.nome} etichetta={b.nome}>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {b.ore.map((o) => (
              <Pillola key={o} attiva={ora === o} onClick={() => onScegli(o)} className="py-2">
                {o}
              </Pillola>
            ))}
          </div>
        </CampoFinestra>
      ))}

      <CampoFinestra etichetta="Un altro orario" nota="Per gli orari che non stanno nell'elenco.">
        <Input
          type="time"
          value={ora}
          onChange={(e) => onScegli(e.target.value)}
          className={cn(CLASSE_CAMPO, "max-w-[9rem]")}
        />
      </CampoFinestra>
    </div>
  );
}

/** ── LA RIGA CHE SI RILEGGE PRIMA DI SALVARE ──────────────────────────────
 *  La data come si dice al telefono, la distanza da oggi, e IN QUALE CAMPO
 *  finirà. Non è decorazione: è il controllo che manca a un campo data, dove
 *  «2026-09-08» e «2026-08-09» si somigliano abbastanza da passare inosservati.
 *  Quando manca il consulente lo dice: un appuntamento senza consulente non
 *  occupa nessuna agenda, quindi lo stesso orario verrà offerto a un altro. */
function RigaInChiaro({
  data,
  ora,
  nomeCampo,
  oraObbligatoria,
  consulente,
  conSquadra,
  primoPasso,
}: {
  data: string;
  ora: string;
  nomeCampo: string;
  oraObbligatoria: boolean;
  consulente?: Consultant;
  conSquadra?: boolean;
  /** true = si sta ancora scegliendo il giorno, non c'è niente da correggere */
  primoPasso?: boolean;
}) {
  if (!data) {
    //  Al primo passo la data manca perché non l'ha ancora scelta nessuno: un
    //  avviso rosso all'apertura di una procedura è un rimprovero per qualcosa
    //  che non è ancora successo. Si dice invece dove finirà, che è
    //  l'informazione che serve mentre si sceglie.
    return primoPasso ? (
      <NotaFinestra>Il giorno che scegli finirà in «{nomeCampo}».</NotaFinestra>
    ) : (
      <NotaFinestra tono="attenzione" icona={AlertTriangle}>
        Senza data questo lead esce dalle code di lavoro: nessuno lo richiama.
      </NotaFinestra>
    );
  }
  const distanza = distanzaInChiaro(data);
  const mancaOra = oraObbligatoria && !ora;
  return (
    <NotaFinestra
      tono={mancaOra ? "attenzione" : "conferma"}
      icona={mancaOra ? AlertTriangle : Check}
    >
      <span className="block font-semibold">
        {quandoInChiaro(data, ora)}
        {distanza ? ` · ${distanza}` : ""}
      </span>
      <span className="block">
        {mancaOra
          ? `Manca l'ora: per questo stato è un appuntamento preso, non un «prima o poi».`
          : `Finirà in «${nomeCampo}»${
              conSquadra
                ? consulente
                  ? ` e in agenda a ${nomeDelConsulente(consulente) || "questo consulente"}`
                  : " — nessun consulente assegnato: l'orario resterà libero per gli altri"
                : ""
            }.`}
      </span>
    </NotaFinestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA PROCEDURA
   ═════════════════════════════════════════════════════════════════════════ */

function ProceduraQuando({
  aperta,
  onCambio,
  onSalvato,
  lead,
  stato,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** solo a scrittura avvenuta — vedi `Props.onSalvato` in cima al file */
  onSalvato?: (info?: { giorno?: string; stato?: LeadStatus }) => void;
  lead: Lead;
  stato: LeadStatus;
}) {
  const { updateLead, consultants, leads } = useCRM();
  const cmd = useTastoComando();
  const richiesta = QUANDO_GUIDATO[stato];

  const [passo, setPasso] = useState<PassoQuando>("giorno");
  const [data, setData] = useState("");
  const [ora, setOra] = useState("");
  /*  ⚠️ QUI C'ERA LA MEZZA GIORNATA SCELTA (mattina/pomeriggio/sera) e non
      serve più a niente: la giornata si vede intera, e le fasce sono rimaste
      solo come etichette dentro l'elenco. Richiesta del committente — «mostra
      tutte le disponibilità tutte insieme». */
  const [consulenteId, setConsulenteId] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  //  La strada a mano per l'appuntamento: serve quando la squadra non ha buchi,
  //  quando l'orario è stato concordato fuori agenda, o quando il calcolo della
  //  disponibilità non riesce. Senza, un guasto altrove impedirebbe di fissare.
  const [aMano, setAMano] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  //  Invio dal campo note e ⌘+Invio dalla finestra sono due strade allo stesso
  //  salvataggio: senza questa guardia la nota finisce scritta due volte.
  const inCorso = useRef(false);

  const oggi = isoOggi();
  /** ── ⚠️ QUANTO DURA, E ADESSO SI SCEGLIE ───────────────────────────────
   *  Segnalazione del committente: «ora non mi fa selezionare il tempo di
   *  quanto deve durare la consulenza quando faccio la schedulazione».
   *  Qui la durata si LEGGEVA soltanto — dalla scheda, o mezz'ora di ripiego —
   *  e da questa finestra non c'era modo di cambiarla: per una consulenza da
   *  un'ora bisognava fissare l'appuntamento, poi aprire la scheda del lead e
   *  correggerla lì. Nel frattempo l'agenda aveva già bloccato trenta minuti,
   *  e la mezz'ora successiva risultava libera per un altro cliente.
   *  ⚠️ CAMBIARLA RICALCOLA GLI ORARI. Non è un'etichetta: la disponibilità si
   *   costruisce sulla durata (vedi `giorniDellaSquadra` più sotto), quindi un
   *   appuntamento da un'ora offre solo le caselle in cui ci stanno sessanta
   *   minuti. Per questo è uno stato e non un campo salvato alla fine. */
  const [durata, setDurata] = useState(DURATA_CONSULENZA);
  //  Le durate offerte: quelle di sempre più, se la scheda ne porta una fuori
  //  elenco, anche quella — o premendo si cambierebbe senza volerlo.
  const durateOfferte = DURATE_CONSULENZA.includes(durata)
    ? DURATE_CONSULENZA
    : [...DURATE_CONSULENZA, durata].sort((a, b) => a - b);
  const conSquadra = !!richiesta?.conSquadra;

  /*  I due valori che la scheda porta già. Si estraggono QUI, come stringhe, e
      non dentro l'effetto: se l'effetto dipendesse dall'oggetto `lead`, un
      qualunque aggiornamento dell'elenco lead mentre la finestra è aperta lo
      farebbe ripartire — cioè riporterebbe al primo passo qualcuno che stava
      scrivendo la nota. Due stringhe uguali sono uguali, e l'effetto sta
      fermo. */
  const dataInScheda = testoDi(
    richiesta?.chiaveData === "dataMeeting"
      ? lead.data.dataMeeting
      : richiesta?.chiaveData === "dataVieneInSede"
        ? lead.data.dataVieneInSede
        : lead.data.dataRicontatto,
  ).slice(0, 10);
  const consulenteInScheda =
    typeof lead.data.consulenteId === "string" ? lead.data.consulenteId : null;

  /*  I due valori stanno in un RIFERIMENTO e non fra le dipendenze dell'effetto.
      Fuori di qui l'elenco lead si aggiorna da solo — un salvataggio in un'altra
      pagina, una riga che torna dal server — e la scheda arriva con campi
      diversi: se l'effetto ci dipendesse, si rimonterebbe da capo e riporterebbe
      al PRIMO PASSO qualcuno che sta scrivendo la nota, buttando via giorno e
      ora già scelti a telefono acceso. La procedura si azzera solo quando si
      APRE; quando cambia il lead ci pensa la `key` di chi la monta. */
  //  L'ora già in scheda viaggia con la data: senza, riaprendo una consulenza
  //  già fissata la griglia non aveva niente da illuminare.
  const oraInScheda = testoDi(
    richiesta?.chiaveData === "dataMeeting"
      ? lead.data.oraMeeting
      : richiesta?.chiaveData === "dataVieneInSede"
        ? lead.data.oraVieneInSede
        : lead.data.oraRicontatto,
  ).slice(0, 5);
  const inScheda = useRef({ data: dataInScheda, ora: oraInScheda, consulente: consulenteInScheda });
  inScheda.current = { data: dataInScheda, ora: oraInScheda, consulente: consulenteInScheda };

  //  Ogni apertura riparte dal primo passo. La data che c'è già si riprende
  //  solo se è ancora futura — ripartire da una consulenza di tre giorni fa
  //  vorrebbe dire proporre un'altra data passata — e solo quando il giorno lo
  //  sceglie l'utente: per l'appuntamento il giorno deve uscire dagli orari
  //  liberi, altrimenti si arriverebbe al passo dell'ora con un giorno che in
  //  agenda non ha nessun buco.
  useEffect(() => {
    if (!aperta) return;
    const { data: giaInScheda, ora: oraGia, consulente } = inScheda.current;
    setPasso("giorno");
    /*  ── ⚠️ L'APPUNTAMENTO CHE C'È GIÀ SI VEDE, E RISULTA SCELTO ──────────
        Segnalazione del committente: «il setter fissa l'appuntamento e
        seleziona lo slot, e quello slot rimane ancora disponibile».
        L'appuntamento c'era davvero — l'ho verificato sull'archivio: le
        schede col diario «Appuntamento fissato per» hanno tutte il loro
        giorno e la loro ora. Quello che non c'era era il MODO DI VEDERLO:
        riaprendo la scheda la finestra ripartiva vuota (giorno e ora
        azzerati) e la griglia non mostra come occupato l'appuntamento del
        lead che si sta fissando — giustamente, altrimenti non si potrebbe
        spostarlo. Il risultato però era identico a un appuntamento mai
        preso: nessuna casella accesa, la sua ora libera come le altre.
        Adesso il giorno e l'ora della scheda tornano SELEZIONATI: la casella
        è accesa e si legge «è questa». Spostarlo resta un clic su un'altra
        casella, come prima.
        ⚠️ Solo se è ancora futuro: ripartire da una consulenza di tre giorni
         fa vorrebbe dire riproporre una data passata. */
    const futura = !!giaInScheda && giaInScheda >= isoOggi();
    setData(futura ? giaInScheda : "");
    setOra(futura ? oraGia : "");
    setConsulenteId(consulente);
    setNota("");
    setAMano(false);
    //  ⚠️ Riparte da quella della SCHEDA, non dall'ultima scelta: la finestra
    //   si riapre su un altro cliente, e un'ora e mezza rimasta accesa dal
    //   precedente bloccherebbe l'agenda di questo senza che nessuno l'abbia
    //   chiesto.
    setDurata(
      Number(lead.data.durataMeeting) > 0 ? Number(lead.data.durataMeeting) : DURATA_CONSULENZA,
    );
  }, [aperta, conSquadra, lead.data.durataMeeting]);

  //  L'ultimo passo si apre con il cursore già dentro: si scrive e si preme
  //  Invio, senza cercare il campo.
  useEffect(() => {
    if (!aperta || passo !== "note") return;
    const t = setTimeout(() => areaRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [aperta, passo]);

  //  Le due liste si guardano prima di usarle: qui dentro si scorre l'archivio
  //  intero, ed è il punto in cui una riga senza `data` (o un consulente senza
  //  giorni lavorativi, che negli archivi importati capita) farebbe cadere il
  //  calcolo della disponibilità al montaggio della finestra.
  //  ⚠️ E LA SQUADRA È FATTA DI CONSULENTI. Da questa griglia si sceglie una
  //  casella e con quella si decide CHI fa la consulenza (vedi `OreDellaSquadra`
  //  più sotto: `setConsulenteId(c.id)`): un driver o un installatore qui dentro
  //  è un'agenda libera che invita a piazzarci sopra un appuntamento che quella
  //  persona non farà. Il filtro e il ripiego stanno in crm/chi-fa-la-consulenza,
  //  gli stessi di tutti gli altri elenchi.
  //  Chi è già scritto sulla scheda resta: spostare una consulenza non deve
  //  togliere di mezzo la persona che ce l'ha adesso.
  //  ⚠️⚠️ E L'ORDINE DELLE DUE SETACCIATE NON SI GIRA: prima il mestiere su
  //  TUTTA l'anagrafica, poi chi è spento o senza giorni lavorativi. Chiedendo
  //  il mestiere al solo gruppo già scremato, un centro in cui i consulenti ci
  //  sono ma sono tutti spenti (o senza settimana tipo compilata) faceva
  //  scattare il ripiego: la griglia tornava a offrire le ore di driver e
  //  installatori, e la riga sotto dava la colpa a una spunta che invece c'era.
  //  Un avviso che indica la casella sbagliata è peggio del silenzio — si va ad
  //  accendere ciò che è già acceso e il guasto vero (persona disattivata,
  //  giorni lavorativi mai compilati) resta dov'è.
  //  Se dopo le due setacciate non resta nessuno la finestra NON si pianta:
  //  `grigliaUsabile` diventa falso e si passa al calendario a mano, che è la
  //  strada già prevista per «niente orari liberi».
  const { elenco: squadra, ripiego: ripiegoConsulenti } = useMemo(() => {
    const arr = Array.isArray(consultants) ? consultants : [];
    const { elenco, ripiego } = consulentiPerConsulenza(arr, {
      anche: [lead.data?.consulenteId],
    });
    return {
      elenco: elenco.filter(
        (c) => c && c.data && c.data.attivo !== false && Array.isArray(c.data.giorniLavorativi),
      ),
      ripiego,
    };
  }, [consultants, lead.data?.consulenteId]);

  const elenco = useMemo<Lead[]>(
    () => (Array.isArray(leads) ? leads.filter((l) => l && l.data) : []),
    [leads],
  );

  /*  ── ⚠️ LE ORE TENUTE PER UNA PERSONA SOLA, DI TUTTA LA SQUADRA ────────
      Segnalazione del committente: «clicco la spunta che vuole stare solo, ma
      l'orario continua a essere disponibile per 3».
      La spunta scriveva davvero (il server la fa rispettare anche al cliente
      che si prenota dal link pubblico), ma questa finestra — che mostra
      quattordici giorni di tutta la squadra — non la leggeva: calcolava la
      disponibilità con la capienza generale, e quell'ora restava offerta a
      tutti. Qui si leggono TUTTE in una richiesta sola e si passano al motore
      (vedi `generateAvailability`): una richiesta per giorno e per consulente
      sarebbero quaranta a ogni apertura.
      ⚠️ Le chiavi arrivano in UTC e qui diventano LOCALI, perché locali sono
       gli orari che si disegnano: «2026-10-12T15:00» a Roma d'estate è
       «2026-10-12 17:00». */
  const [oreTenute, setOreTenute] = useState<Record<string, "solo">>({});
  useEffect(() => {
    if (!aperta) return;
    let vivo = true;
    //  Con le credenziali: l'elenco di TUTTE le ore tenute è l'agenda del
    //  centro, e la rotta lo consegna solo a chi ha il permesso «agenda».
    void intestazioniCRM()
      .then((headers) => fetch("/api/crm/fascia-modo?tutte=1", { headers }))
      .then((r: Response) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; solo?: Record<string, string[]> } | null) => {
        if (!vivo || !j?.ok || !j.solo) return;
        const fuori: Record<string, "solo"> = {};
        for (const [, quandi] of Object.entries(j.solo)) {
          for (const q of quandi) {
            const d = new Date(`${q}Z`);
            if (Number.isNaN(d.getTime())) continue;
            const giorno = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const ora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            fuori[`${giorno} ${ora}`] = "solo";
          }
        }
        setOreTenute(fuori);
      })
      .catch(() => {
        /* senza, si torna a com'era: nessuna ora tenuta */
      });
    return () => {
      vivo = false;
    };
  }, [aperta]);

  const giorni = useMemo<GiornoSquadra[] | null>(() => {
    if (!aperta || !conSquadra) return [];
    return giorniDellaSquadra(squadra, durata, elenco, lead.id, oreTenute);
  }, [aperta, conSquadra, squadra, durata, elenco, lead.id, oreTenute]);

  const giornoScelto = giorni?.find((g) => g.data === data);
  const consulenteScelto = squadra.find((c) => c.id === consulenteId);
  /*  ── ⚠️ «QUEST'ORA SOLO PER QUESTA PERSONA», ANCHE DA QUI ──────────────
      Segnalazione del committente: «quando importo lead mi dà solo l'opzione
      di 3 persone su quello slot». Questa è la finestra da cui si fissano gli
      appuntamenti della coda dei lead importati, e la scelta si poteva fare
      solo dalla scheda del cliente: l'ora restava aperta fino a tre, e il
      secondo contatto che si fissava finiva dentro la stessa consulenza.
      La spunta è quella di tutto il CRM (crm/ModoDellaFascia). */
  /*  ── ⚠️ IL CONSULENTE PUÒ NON ESSERE STATO SCELTO QUI ─────────────────
      Segnalazione del committente: «non c'è la spunta per farlo». Una delle
      ragioni era questa: la spunta chiedeva il consulente SCELTO nella
      griglia degli orari, ma quando l'orario si scrive a mano — o quando il
      lead ha già il suo consulente e la griglia non si usa — quel valore
      resta vuoto, e la spunta non compariva mai. Il consulente di questa
      fascia è quello scelto adesso oppure quello che il lead ha in scheda:
      è lo stesso che finisce nell'appuntamento salvato. */
  const consulenteDellaFascia = consulenteId || consulenteInScheda;
  const fasce = useModiFascia(consulenteDellaFascia, data, durata);

  //  I posti di QUESTA fascia: quanti ci sono già dentro e quanti ce ne stanno.
  const fasciaScelta = giornoScelto?.slot.find(
    (x) => x.ora === ora && x.consulente.id === consulenteDellaFascia,
  );
  //  La griglia si usa solo se c'è davvero qualcosa dentro: senza consulenti,
  //  senza buchi o con il calcolo caduto si passa alla strada a mano — e lo si
  //  dice, invece di mostrare una tabella vuota.
  const grigliaUsabile = conSquadra && !aMano && !!giorni && giorni.length > 0;

  const nomeCliente =
    `${testoDi(lead.data.nome)} ${testoDi(lead.data.cognome)}`.trim() || "Senza nome";

  const oraObbligatoria = !!richiesta?.oraObbligatoria;
  const puoAvanzare =
    passo === "giorno" ? !!data : passo === "ora" ? !oraObbligatoria || !!ora : !!data;

  const conferma = async () => {
    if (!richiesta || inCorso.current) return;
    if (!data) {
      setPasso("giorno");
      return;
    }
    if (oraObbligatoria && !ora) {
      setPasso("ora");
      return;
    }
    inCorso.current = true;
    setSalvando(true);
    try {
      const patch: Partial<LeadData> = { stato };
      //  Il campo di destinazione non lo decide lo stato corrente ma la
      //  tabella: è il guasto storico della vecchia barra, dove la data
      //  digitata finiva in un campo e l'elenco ne leggeva un altro.
      if (richiesta.chiaveData === "dataMeeting") {
        patch.dataMeeting = data;
        patch.oraMeeting = ora || undefined;
        patch.durataMeeting = durata;
        //  Chi fa la consulenza si scrive INSIEME al quando: l'agenda considera
        //  occupato uno slot solo se sa di chi è, e senza quel nome lo stesso
        //  orario verrebbe offerto di nuovo a un altro cliente.
        if (consulenteId) patch.consulenteId = consulenteId;
      } else if (richiesta.chiaveData === "dataVieneInSede") {
        patch.dataVieneInSede = data;
        patch.oraVieneInSede = ora || undefined;
      } else {
        patch.dataRicontatto = data;
        patch.oraRicontatto = ora || undefined;
      }

      //  Le note della scheda sono un DIARIO, non un campo da riscrivere: la
      //  nota si appende in coda con la data davanti, come fa la spunta del
      //  compimento. Il campo arriva dal database e negli archivi importati non
      //  è sempre una stringa: concatenare a un oggetto scriverebbe
      //  "[object Object]" dentro la scheda di un cliente vero.
      const precedenti = typeof lead.data.note === "string" ? lead.data.note : "";
      const scritto = nota.trim();
      const chi = conSquadra && consulenteScelto ? ` · ${nomeDelConsulente(consulenteScelto)}` : "";
      const riga = `${dataBreve(new Date().toISOString())} · ${richiesta.verbo} ${quandoInChiaro(
        data,
        ora,
      )}${chi}${scritto ? ` — ${scritto}` : ""}`;
      patch.note = precedenti.trim() ? `${precedenti}\n${riga}` : riga;

      //  ⚠️ Come nell'altro ramo: la spunta verde si dà solo dopo aver letto la
      //   risposta. Qui si promette un giorno e un'ora a un cliente — un
      //   «fissato ✓» su una scrittura mai avvenuta è un appuntamento che
      //   nessuno ha in agenda e a cui qualcuno si presenta.
      if (!(await updateLead(lead.id, patch))) {
        toast.error("Non salvato", {
          description: "La scheda in archivio è rimasta com'era. Riprova.",
        });
        return;
      }
      toast.success(`${nomeCliente} → ${LEAD_STATUS_LABEL[stato]}`, {
        description: quandoInChiaro(data, ora),
      });
      //  Il giorno appena promesso: chi ci ha aperto questa finestra lo usa
      //  per mostrare subito com'è messo quel giorno (vedi `onSalvato`).
      onSalvato?.({ giorno: data || undefined, stato });
      onCambio(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aggiornamento non riuscito");
    } finally {
      inCorso.current = false;
      setSalvando(false);
    }
  };

  const avanti = () => {
    if (salvando) return;
    if (passo === "giorno") {
      if (data) setPasso("ora");
      return;
    }
    if (passo === "ora") {
      if (puoAvanzare) setPasso("note");
      return;
    }
    void conferma();
  };

  //  ⌘/Ctrl+↵ manda avanti da qualunque punto: la procedura si attraversa senza
  //  staccare le mani dalla tastiera, che è come la usa chi sta telefonando.
  useSalvaConTastiera(aperta, avanti);

  //  Uno stato senza richiesta non arriva qui (ci pensa `apreProceduraQuando`),
  //  ma se ci arrivasse è meglio niente che una finestra a metà. La guardia sta
  //  DOPO gli hook: React li conta per posizione.
  if (!richiesta) return null;

  const contesto = (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium text-slate-700">{nomeCliente}</span>
      <span aria-hidden>→</span>
      <span className={cn(CLASSE_BADGE_STATO, classiStato(stato))}>{LEAD_STATUS_LABEL[stato]}</span>
    </span>
  );

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo={richiesta.titolo}
      contesto={contesto}
      icona={richiesta.icona}
      larghezza={conSquadra ? "md" : "sm"}
      classeCorpo="flex flex-col gap-3"
      azioni={
        <>
          <ScorciatoieFinestra salva={false}>
            <span className="inline-flex items-center gap-1">
              <Tasto>{cmd}</Tasto>
              <Tasto>↵</Tasto> {passo === "note" ? "conferma" : "avanti"}
            </span>
          </ScorciatoieFinestra>
          {passo === "giorno" ? (
            <Button variant="outline" onClick={() => onCambio(false)} disabled={salvando}>
              Annulla
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setPasso(passo === "note" ? "ora" : "giorno")}
              disabled={salvando}
            >
              <ChevronLeft className="h-4 w-4" /> Indietro
            </Button>
          )}
          <Button onClick={avanti} disabled={salvando || !puoAvanzare} className="sm:min-w-32">
            {passo === "note" ? (salvando ? "Salvataggio…" : "Conferma") : "Avanti"}
          </Button>
        </>
      }
    >
      <BarraPassi
        passo={passo}
        data={data}
        ora={ora}
        oraFacoltativa={!oraObbligatoria}
        onVai={setPasso}
      />

      {/* ── PASSO 1 · IL GIORNO ─────────────────────────────────────────── */}
      {passo === "giorno" &&
        (grigliaUsabile && giorni ? (
          <SezioneFinestra
            titolo="Dove c'è posto"
            nota="Orari liberi di tutta la squadra, prossimi 14 giorni"
            icona={CalendarDays}
            classeCorpo="p-3 space-y-2"
          >
            <GrigliaSquadra
              giorni={giorni}
              data={data}
              onScegli={(d) => {
                setData(d);
                //  Scegliere il giorno porta subito agli orari — tutti quelli
                //  della giornata, senza passare da mattina/pomeriggio/sera.
                setOra("");
                setPasso("ora");
              }}
            />
            <p className="text-[11px] leading-snug text-slate-500">
              Il numero sono gli orari ancora liberi di quel giorno. Premendo il giorno li vedi
              tutti — mattina, pomeriggio e sera insieme — e sceglierne uno decide insieme
              consulente, giorno e ora.
            </p>
            {/*  Se qui dentro ci sono tutti perché nessuno è ancora segnato
                consulente, va detto proprio accanto alla frase che spiega che
                una casella sceglie anche la persona. */}
            <NotaSoloConsulenti ripiego={ripiegoConsulenti} />
            <button
              type="button"
              onClick={() => setAMano(true)}
              className="text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Oppure scegli il giorno dal calendario
            </button>
          </SezioneFinestra>
        ) : (
          <SezioneFinestra
            titolo="Il giorno"
            nota="Un tocco sulla distanza, oppure dal calendario"
            icona={CalendarDays}
            classeCorpo="p-3"
          >
            {conSquadra && !aMano && (
              <NotaFinestra tono="attenzione" icona={AlertTriangle} className="mb-3">
                {giorni === null
                  ? "Gli orari liberi non si caricano: scegli il giorno dal calendario."
                  : "Nessun orario libero nei prossimi 14 giorni: scegli il giorno dal calendario."}
              </NotaFinestra>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="order-2 sm:order-1 sm:flex-1">
                <CalendarioMese scelto={data} minimo={oggi} onScegli={setData} />
              </div>
              <div className="order-1 flex flex-wrap gap-1.5 sm:order-2 sm:w-40 sm:flex-col">
                {SCORCIATOIE_GIORNO.map((s) => {
                  const d = fraGiorni(s.g);
                  return (
                    <Pillola
                      key={s.g}
                      attiva={data === d}
                      onClick={() => setData(d)}
                      className="py-2 sm:w-full sm:justify-start"
                    >
                      {s.l}
                    </Pillola>
                  );
                })}
                {conSquadra && aMano && giorni && giorni.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAMano(false)}
                    className="mt-1 text-left text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  >
                    Torna agli orari liberi
                  </button>
                )}
              </div>
            </div>
          </SezioneFinestra>
        ))}

      {/* ── PASSO 2 · L'ORA ─────────────────────────────────────────────── */}
      {passo === "ora" && (
        <SezioneFinestra
          titolo="L'ora"
          nota={
            grigliaUsabile && giornoScelto
              ? `${quandoInChiaro(data)} · chi è libero`
              : oraObbligatoria
                ? quandoInChiaro(data)
                : `${quandoInChiaro(data)} · si può anche non metterla`
          }
          icona={Clock}
          classeCorpo="p-3"
        >
          {/* ── ⚠️ QUANTO DURA, PRIMA DI SCEGLIERE L'ORA ─────────────────
              Segnalazione del committente: da questa finestra la durata non si
              poteva scegliere. Sta QUI e non altrove perché è la domanda che
              viene PRIMA dell'orario: le caselle offerte sotto sono quelle in
              cui ci sta davvero, e sceglierne una da trenta minuti per una
              consulenza da un'ora vuol dire lasciare libera la mezz'ora dopo —
              che finisce a un altro cliente.
              ⚠️ Solo dove la durata conta davvero, cioè su una consulenza:
               per un richiamo o una visita in sede non si blocca nessuna
               agenda, e un riquadro in più sarebbe una domanda senza effetto.
              ⚠️ Cambiandola le caselle si ricalcolano da sole: `durata` è una
               dipendenza del conto della disponibilità. Se l'ora era già
               scelta la si lascia — è il gesto successivo a dirlo — e se non
               ci sta più, la griglia non la offre più. */}
          {richiesta.chiaveData === "dataMeeting" && (
            <div className="mb-3 border-b border-slate-200 pb-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Quanto dura
              </p>
              <div className="flex flex-wrap gap-1.5">
                {durateOfferte.map((d) => (
                  <Pillola key={d} attiva={durata === d} onClick={() => setDurata(d)}>
                    {d} min
                  </Pillola>
                ))}
              </div>
            </div>
          )}
          {grigliaUsabile && giornoScelto ? (
            <OreDellaSquadra
              giorno={giornoScelto}
              ora={ora}
              consulenteId={consulenteId}
              onScegli={(o, c) => {
                setOra(o);
                setConsulenteId(c.id);
                setPasso("note");
              }}
            />
          ) : (
            <OreManuali ora={ora} facoltativa={!oraObbligatoria} onScegli={setOra} />
          )}
        </SezioneFinestra>
      )}

      {/* ── PASSO 3 · LE NOTE, FACOLTATIVE ──────────────────────────────── */}
      {passo === "note" && (
        <SezioneFinestra
          titolo="Note"
          nota="Facoltative: si conferma anche a campo vuoto"
          icona={StickyNote}
          classeCorpo="p-3"
        >
          {/*  ⚠️ LA SPUNTA STA QUI, dopo che l'ora è stata scelta: scegliendo
               un orario si arriva proprio su questo passo, e la decisione
               «quest'ora è sua» si prende nello stesso gesto in cui si fissa
               l'appuntamento — non tornando sulla scheda del cliente dopo.
               Solo per le consulenze: su un richiamo o una visita non c'è
               nessuna fascia da tenere. */}
          {richiesta.chiaveData === "dataMeeting" && ora && consulenteDellaFascia && (
            <SpuntaSoloUnaPersona
              ora={ora}
              presi={fasciaScelta?.presi ?? 0}
              capienza={fasciaScelta?.posti || capienzaConsulenza()}
              modo={fasce.modi[ora] === "solo" ? "solo" : "aperta"}
              onCambia={fasce.cambia}
              salvando={fasce.salvando}
              durata={durata}
              className="mb-3"
            />
          )}
          <Textarea
            ref={areaRef}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => {
              //  Invio conferma, Maiusc+Invio va a capo. Con ⌘/Ctrl si lascia
              //  fare alla scorciatoia di finestra, altrimenti si salva due volte.
              if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey) return;
              e.preventDefault();
              void conferma();
            }}
            rows={3}
            placeholder="Cosa vi siete detti, obiezioni, accordi presi…"
            className={CLASSE_AREA}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Si aggiunge in coda al diario della scheda, con la data davanti: le note vecchie non si
            perdono. Maiusc+Invio va a capo.
          </p>
        </SezioneFinestra>
      )}

      {/*  LA SCELTA IN CHIARO, SEMPRE SOTTO: è l'unico modo di accorgersi di
          aver preso il giorno sbagliato prima di salvarlo. */}
      <RigaInChiaro
        data={data}
        ora={ora}
        nomeCampo={richiesta.nomeCampo}
        oraObbligatoria={oraObbligatoria && passo !== "giorno"}
        consulente={consulenteScelto}
        conSquadra={conSquadra}
        primoPasso={passo === "giorno"}
      />
    </Finestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL COMPIMENTO DI UN IMPEGNO — LA SPUNTA E LA SUA NOTA

   Alcuni stati non descrivono una situazione: descrivono una PROMESSA. «Ricontatto
   fissato» vuol dire "ho detto che lo richiamo giovedì". Finché la promessa è lì,
   la riga chiede attenzione ogni volta che si scorre l'elenco; appena è onorata
   deve smettere di chiederla — e oggi per farlo bisognava aprire il selettore,
   cercare lo stato giusto fra dodici e sceglierlo. Tre gesti per dire "fatto".

   Qui la promessa ha un suo compimento dichiarato: uno stato solo, sempre lo
   stesso, raggiungibile con una spunta dalla riga. La finestrella che si apre
   chiede una nota FACOLTATIVA — si conferma anche a mano vuota — perché quello
   che il cliente ha detto al telefono vale più dello stato in cui finisce, e se
   non lo si scrive nel momento in cui è stato detto non lo si scrive più.

   PERCHÉ «Ricontatto fissato» DIVENTA «In valutazione» E NON «Ricontattato»:
   lo stato "ricontattato" NON ESISTE in types.ts, e types.ts non si tocca da
   qui. Fra quelli esistenti, "sta_valutando" ("In valutazione") è l'unico che
   dice la stessa cosa che dice un ricontatto appena fatto: ci ho parlato, la
   trattativa è aperta, la palla è al cliente. Sta nella stessa fase (in_corso)
   e nello stesso vocabolario (STATI_TRATTATIVA), quindi la pastiglia non cambia
   colore sotto le mani di chi guarda. Il FATTO che il ricontatto sia avvenuto
   non si perde comunque: finisce nel diario delle note, datato.

   "richiamo" ("Richiamo concordato") resta senza spunta di proposito: appartiene
   al vocabolario della PRIMA CHIAMATA (STATI_PRIMO_CONTATTO) e ogni compimento
   possibile lo farebbe saltare nel vocabolario della trattativa — cioè uno stato
   che il suo stesso selettore non gli propone.
   ═════════════════════════════════════════════════════════════════════════ */

export interface Compimento {
  /** Lo stato in cui la trattativa entra quando l'impegno è stato onorato. */
  stato: LeadStatus;
  /** Come si scrive nel diario delle note: participio, non imperativo. */
  verbo: string;
  /** Il titolo della finestrella: dice l'azione, non l'oggetto. */
  titolo: string;
  /** Cosa succede, in una riga, per chi passa sopra la spunta. */
  spiega: string;
  /** ── COSA COMPORTA, DETTO PRIMA DI CONFERMARE ───────────────────────────
   *  Non è la stessa cosa di `spiega`: quello dice cosa sto dichiarando, questo
   *  dice cosa succede al lead DOPO. Serve dove la conseguenza non si vede
   *  dalla pastiglia — il passaggio all'acconto marca la pratica come vinta e
   *  la manda in produzione, e chi conferma deve saperlo prima, non scoprirlo
   *  trovandosi il lead in un'altra lista. */
  comporta?: string;
}

export const COMPIMENTO: Partial<Record<LeadStatus, Compimento>> = {
  da_ricontattare: {
    stato: "sta_valutando",
    verbo: "Ricontattato",
    titolo: "Segna il ricontatto fatto",
    spiega: "L'ho ricontattato",
  },
  fissa_meet_dopo: {
    stato: "appuntamento_fissato",
    verbo: "Meet fissato",
    titolo: "Segna il meet fissato",
    spiega: "Ho fissato il meet",
  },
  /*  Si è fatto vivo davvero: la palla torna a noi, e la scheda torna a essere
      una trattativa aperta come tutte le altre. ⚠️ Senza questa voce l'unico
      modo di chiudere l'attesa sarebbe cambiare stato a mano, e una promessa
      che non si può «spuntare» resta in coda per sempre. */
  ci_ricontatta_lui: {
    stato: "sta_valutando",
    verbo: "Si è fatto vivo",
    titolo: "Segna che si è fatto vivo lui",
    spiega: "Mi ha ricontattato",
  },
  appuntamento_fissato: {
    stato: "fatto",
    verbo: "Consulenza svolta",
    titolo: "Segna la consulenza svolta",
    spiega: "La consulenza è stata fatta",
  },
  viene_in_sede: {
    stato: "fatto",
    verbo: "Venuto in sede",
    titolo: "Segna la visita fatta",
    spiega: "È venuto in sede",
  },
  da_spostare: {
    stato: "appuntamento_fissato",
    verbo: "Appuntamento rifissato",
    titolo: "Segna l'appuntamento rifissato",
    spiega: "Ho rifissato l'appuntamento",
  },
  //  ── L'UNICO COMPIMENTO CHE SI CONFERMA E BASTA ─────────────────────────
  //   Prima la spunta saltava direttamente alla finestra degli importi: per
  //   dire «l'anticipo è arrivato» bisognava compilare un modulo di sette
  //   campi. Adesso la conferma è una finestra sola e l'importo resta a un
  //   clic (vedi `onImporti` in DialogoCompimento): chi lo sa lo scrive, chi
  //   sta al telefono avanza lo stato e torna dopo sui numeri.
  in_attesa_acconto: {
    stato: "acconto",
    verbo: "Acconto incassato",
    //  Non più "Registra l'acconto": qui NON si registra un importo, e un
    //  titolo che promette un modulo su una finestra di sola conferma fa
    //  chiudere la finestra a chi cercava i campi.
    titolo: "Segna l'acconto incassato",
    spiega: "Ho incassato l'acconto",
    comporta:
      "Il lead risulta vinto e la pratica entra in produzione. L'importo non viene toccato: se l'anticipo va messo a numero, usa «Registra l'importo».",
  },
};

/* ── LA PASTIGLIA CHE AVANZA DA SOLA ───────────────────────────────────────
   Richiesta del committente: «Attesa acconto» deve cambiarsi premendo la
   pastiglia, con una conferma. Vale SOLO per gli stati elencati qui, e
   l'elenco è uno solo di proposito.

   La pastiglia è la porta del selettore di stato: dirottarla significa
   togliere quella porta, e si può fare solo dove il passo successivo è UNO,
   ovvio e sempre lo stesso. Degli altri compimenti nessuno lo è:
    · «Appuntamento fissato» e «Appuntamento in sede» finiscono in consulenza svolta,
      ma anche in venduto, cliente assente, in valutazione — l'esito di un
      incontro non si indovina;
    · «Meet da fissare» e «Da riprogrammare» portano a un appuntamento, che
      senza giorno e ora non esiste: lì serve la procedura, non una conferma;
    · «Ricontatto fissato» → «In valutazione» è una lettura, non un fatto.
   Per tutti loro la pastiglia continua ad aprire il selettore, e il passo
   rapido resta dov'era: la spunta accanto.

   ⚠️ QUI C'ERA «Attesa acconto», ED È STATO UN ERRORE DI RAGIONAMENTO.
   Il ragionamento era: ha un solo seguito possibile (l'anticipo è arrivato) e
   quel seguito dal selettore non è raggiungibile, quindi la pastiglia non
   serve. Il primo pezzo è falso. Un lead in attesa di acconto ha DAVVERO un
   solo seguito buono, ma ne ha molti cattivi — ci ripensa, sparisce, chiede di
   essere risentito fra un mese — e sono quelli che si segnano più spesso.
   Togliendo la porta del selettore, «Attesa acconto» era diventato l'unico
   stato del CRM da cui non si usciva: la pastiglia proponeva l'acconto e
   basta, e per tutto il resto bisognava scovare «Scegli un altro stato»
   dentro la conferma. Il passo rapido non è andato perso: sta dove sta per
   tutti gli altri stati, cioè sulla SPUNTA accanto alla pastiglia, che legge
   `compimentoDi` e non questo elenco.
   L'elenco resta perché la meccanica è giusta e un giorno può servire: va
   riempito solo con stati da cui non si esce, non con stati che hanno un
   seguito probabile. */
export const STATI_A_PASSO_OVVIO: LeadStatus[] = [];

/** Il passo ovvio di uno stato, se ne ha uno. Accetta stringhe grezze: lo
 *  stato arriva dal database e può essere un valore mai visto — in quel caso
 *  la pastiglia resta quella di sempre e apre il selettore. */
export function passoOvvioDi(stato: LeadStatus | string | undefined | null): Compimento | null {
  if (!stato || !(STATI_A_PASSO_OVVIO as string[]).includes(String(stato))) return null;
  return compimentoDi(stato);
}

/** Il compimento di uno stato, se ne ha uno. Accetta anche stringhe grezze:
 *  dal database può arrivare uno stato che qui non è mappato, e in quel caso
 *  la spunta semplicemente non compare. */
export function compimentoDi(stato: LeadStatus | string | undefined | null): Compimento | null {
  if (!stato) return null;
  return COMPIMENTO[stato as LeadStatus] ?? null;
}

/** ── LA FINESTRELLA DELLA SPUNTA (E DELLA PASTIGLIA) ──────────────────────
 *  Un campo solo, facoltativo, e due modi per chiuderla: Invio conferma,
 *  Esc annulla. Si apre in mezzo a una telefonata e non deve rubare più di due
 *  secondi. La nota NON sovrascrive quelle vecchie: si appende in coda con la
 *  data davanti, come fa la nota rapida del pannello sede — le note della
 *  scheda sono un diario, non un campo da riscrivere.
 *
 *  È ANCHE LA CONFERMA DEL PASSO OVVIO (vedi STATI_A_PASSO_OVVIO): la
 *  intestazione dice già nome, stato di partenza e stato d'arrivo, quindi era
 *  di per sé la finestra di conferma che serviva — scriverne una seconda
 *  identica accanto voleva dire due finestre da mantenere che si contraddicono
 *  al primo ritocco. Quello che mancava era dire cosa comporta, ed è
 *  `meta.comporta`. UNA finestra sola: da qui si scrive, non si passa ad
 *  altre. */
export function DialogoCompimento({
  lead,
  onChiudi,
  onImporti,
  onAltroStato,
}: {
  lead: Lead | null;
  onChiudi: () => void;
  /** ── LE DUE VIE DI FUGA ──────────────────────────────────────────────────
   *  Non sono un secondo modo di dire la stessa cosa: portano ai due posti che
   *  esistevano già.
   *   · onImporti  → la finestra che l'acconto lo mette a numero (la stessa di
   *     sempre: QuickStatusDialog su "acconto"). Senza di lei questa conferma
   *     sarebbe un doppione povero di quel modulo;
   *   · onAltroStato → il selettore, perché dirottare la pastiglia non deve
   *     togliere l'unico modo di scegliere uno stato diverso.
   *  Restano finestre DIVERSE, mai in cascata: qui non si conferma nulla
   *  passando di là, si cambia strada. Chi le riceve chiude questa e apre
   *  quella. */
  onImporti?: (lead: Lead) => void;
  onAltroStato?: (lead: Lead) => void;
}) {
  const { updateLead } = useCRM();
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  //  Invio dal campo e ⌘+Invio dalla finestra sono due strade allo stesso
  //  salvataggio: senza questa guardia un ⌘+Invio le percorre entrambe e la
  //  nota finisce scritta due volte.
  const inCorso = useRef(false);

  const meta = compimentoDi(lead?.data.stato);

  //  ── LE VIE DI FUGA COMPAIONO SOLO DOVE PORTANO DA QUALCHE PARTE ─────────
  //   Gli importi: solo se lo stato d'arrivo ha davvero un modulo di importi
  //   (l'acconto). Su «Consulenza svolta» quel tasto aprirebbe una finestra
  //   vuota.
  //   Il selettore: solo dove la pastiglia è stata dirottata, perché è lì che
  //   l'elenco degli stati è stato tolto di mezzo. Altrove la pastiglia ce
  //   l'ha ancora, e ripeterlo qui sarebbe un tasto in più da leggere.
  const viaImporti =
    onImporti && requiresPaymentDialog(meta?.stato ?? null) ? onImporti : undefined;
  const viaStato = onAltroStato && passoOvvioDi(lead?.data.stato) ? onAltroStato : undefined;

  //  Ogni apertura riparte a campo vuoto e con il cursore già dentro: la nota
  //  di ieri sulla trattativa di oggi è peggio di nessuna nota.
  useEffect(() => {
    if (!lead) return;
    setNota("");
    const t = setTimeout(() => areaRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [lead]);

  const conferma = async () => {
    if (!lead || !meta || inCorso.current) return;
    inCorso.current = true;
    setSalvando(true);
    try {
      const testo = nota.trim();
      //  Il campo note arriva dal database e negli archivi importati non è
      //  sempre una stringa: concatenare a un oggetto scriverebbe
      //  "[object Object]" dentro la scheda di un cliente vero.
      const precedenti = typeof lead.data.note === "string" ? lead.data.note : "";
      const riga = `${dataBreve(new Date().toISOString())} · ${meta.verbo}${
        testo ? ` — ${testo}` : ""
      }`;
      await updateLead(lead.id, {
        stato: meta.stato,
        note: precedenti.trim() ? `${precedenti}\n${riga}` : riga,
      });
      toast.success(
        `${`${lead.data.nome || ""} ${lead.data.cognome || ""}`.trim()} → ${LEAD_STATUS_LABEL[meta.stato]}`,
      );
      onChiudi();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aggiornamento non riuscito");
    } finally {
      inCorso.current = false;
      setSalvando(false);
    }
  };

  useSalvaConTastiera(!!lead && !!meta, () => void conferma());

  const contestoSpunta =
    lead && meta ? (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-slate-700">
          {`${lead.data.nome || ""} ${lead.data.cognome || ""}`.trim() || "Senza nome"}
        </span>
        <span className={cn(CLASSE_BADGE_STATO, classiStato(lead.data.stato))}>
          {LEAD_STATUS_LABEL[lead.data.stato]}
        </span>
        <span aria-hidden>→</span>
        <span className={cn(CLASSE_BADGE_STATO, classiStato(meta.stato))}>
          {LEAD_STATUS_LABEL[meta.stato]}
        </span>
      </span>
    ) : undefined;

  return (
    <Finestra
      aperta={!!lead && !!meta}
      onCambio={(v) => !v && onChiudi()}
      titolo={meta?.titolo ?? "Segna come fatto"}
      contesto={contestoSpunta}
      icona={CheckCircle2}
      larghezza="sm"
      classeCorpo="flex flex-col gap-2"
      azioni={
        <>
          <ScorciatoieFinestra salva={false}>
            <span className="inline-flex items-center gap-1">
              <Tasto>Invio</Tasto> conferma
            </span>
          </ScorciatoieFinestra>
          <Button variant="outline" onClick={onChiudi} disabled={salvando}>
            Annulla
          </Button>
          <Button onClick={() => void conferma()} disabled={salvando} className="sm:min-w-28">
            {salvando ? "Salvataggio…" : "Conferma"}
          </Button>
        </>
      }
    >
      {/*  Cosa comporta si legge PRIMA del campo note: è la ragione per cui si
          può voler annullare, e in fondo alla finestra non la leggerebbe
          nessuno. */}
      {meta?.comporta && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{meta.comporta}</span>
        </p>
      )}

      <CampoFinestra
        etichetta="Note (facoltative)"
        nota="Si conferma anche a campo vuoto: data ed esito finiscono comunque nel diario della scheda."
      >
        <Textarea
          ref={areaRef}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => {
            //  Invio conferma, Maiusc+Invio va a capo. Con ⌘/Ctrl si lascia
            //  fare alla scorciatoia di finestra, altrimenti si salva due volte.
            if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            void conferma();
          }}
          rows={3}
          placeholder="Cosa vi siete detti, obiezioni, accordi presi…"
          className={CLASSE_AREA}
        />
      </CampoFinestra>
      <NotaFinestra>Maiusc+Invio va a capo.</NotaFinestra>

      {/*  Le alternative stanno qui e non fra le azioni in fondo: laggiù, di
          fianco a «Conferma», sembrerebbero due modi di confermare. Qui sono
          quello che sono — «non è questo che volevo fare». */}
      {lead && (viaImporti || viaStato) && (
        <div className="mt-1 flex flex-col gap-1.5 border-t border-slate-200 pt-3">
          <span className="text-[11px] font-medium text-slate-500">Oppure</span>
          <div className="flex flex-wrap gap-2">
            {viaImporti && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvando}
                className="text-[12px]"
                onClick={() => viaImporti(lead)}
              >
                <Euro className="mr-1.5 h-3.5 w-3.5" />
                Registra l&apos;importo…
              </Button>
            )}
            {viaStato && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvando}
                className="text-[12px]"
                onClick={() => viaStato(lead)}
              >
                <Tags className="mr-1.5 h-3.5 w-3.5" />
                Scegli un altro stato…
              </Button>
            )}
          </div>
        </div>
      )}
    </Finestra>
  );
}
