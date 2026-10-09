/** ─────────────────────────────────────────────────────────────────────────
 *  SchedaCliente — QUANDO LA TRATTATIVA È VINTA, LA SCHEDA CAMBIA MESTIERE
 *
 *  Fino all'acconto la scheda serve a VENDERE: chi la apre cerca uno slot, un
 *  consulente, il link della consulenza. Dal momento in cui il cliente lascia
 *  l'acconto quella stessa scheda serve a CONSEGNARE: chi la apre cerca quanto
 *  resta da incassare, se il prodotto è stato ordinato, che giorno si installa.
 *  Sono due lavori diversi, fatti spesso da due persone diverse.
 *
 *  QUATTRO BLOCCHI, NON QUATTORDICI RIQUADRI
 *  Chi lavora una consegna ragiona per blocchi, e la scheda è fatta con gli
 *  stessi:
 *    0. LA BARRA DEL LAVORO — importo, stato, e le azioni di ogni giorno
 *       (chiama, WhatsApp con data e cifra, saldo incassato, completa)
 *    1. DOVE SI POSA E CHI CI VA — agenda, installatore, tipo, indirizzo
 *    2. IL MATERIALE — cosa si posa
 *    3. SOLDI — la porta agli importi, e gli avvisi solo quando servono
 *    4. CONTESTO — storico acquisti e note della consulenza
 *
 *  COSA È SPARITO, E PERCHÉ NON VA RIMESSO
 *  Questa scheda vive DENTRO LeadDialog, che intorno a lei mostra già: nome e
 *  città (testata), telefono con Chiama e WhatsApp (barra essenziale), data e
 *  ora dell'installazione con la frase "domani alle 10:00" (riquadro «Prossima
 *  azione · Installazione», fermo in cima), prezzo/incassato/saldo/costi/
 *  profitto (colonna di sinistra) e i tasti rapidi del primo incasso.
 *  Da qui, di conseguenza, sono spariti DUE DOPPIONI veri, non ridotti:
 *   · i campi Data e Ora della posa — erano identici a quelli del riquadro in
 *     cima, scrivevano lo stesso campo, e nessuno dei due diceva di essere una
 *     copia. Resta l'agenda, che è l'unico modo di scegliere un orario LIBERO;
 *   · la riga "€ X di vendita · € Y già incassati" — terza copia degli stessi
 *     due numeri nella stessa finestra.
 *  Sono spariti anche: il cartellino dello stato ordine accanto al selettore
 *  dello stesso stato (erano due comandi per una cosa sola), l'elenco di otto
 *  righe "Chi installa" (una scelta che si fa una volta a pratica occupava
 *  mezza schermata: ora è un menu), e le due righe che spiegavano il pulsante
 *  dell'agenda.
 *
 *  LO STATO SI CAMBIA CON IL COMANDO DI TUTTI
 *  Il selettore locale del materiale non esiste più: stato del materiale e
 *  "posa completata" si cambiano con `StatoInstallazione`, lo stesso componente
 *  dell'elenco installazioni — stesse parole, stesso aspetto, stesse scritture.
 *  Il saldo si registra PREMENDO L'IMPORTO (`ImportoConsegna`): si apre la
 *  finestra che chiede quanto è stato incassato, se comprende l'IVA e se la
 *  pratica è conclusa. È la stessa finestra dell'elenco installazioni.
 *
 *  IL RITORNO INDIETRO RESTA ESPLICITO
 *  L'incasso si registra in un clic, quindi si sbaglia in un clic. Il modo per
 *  disfare è in fondo alla finestra degli importi — cioè accanto ai numeri che
 *  ha sbagliato chi lo cerca — e dice cosa succede prima di premere.
 *
 *  PERCHÉ I MATTONCINI DEI CAMPI STANNO QUI
 *  Campo, Scelta, SottoBlocco e le classi dei controlli nascono nella scheda
 *  della trattativa e servono identici a questa: definirli qui e importarli di
 *  là tiene UNA sola definizione e nessun ciclo fra i due file (LeadDialog
 *  importa SchedaCliente, mai il contrario). Non sono però una SECONDA
 *  famiglia di componenti: sono adattatori sottili su quelli di
 *  `ui/Finestra.tsx` — stesso bordo, stesso ritmo, stesse etichette — perché
 *  una finestra del CRM deve essere fatta di un materiale solo.
 *
 *  QUI VIVONO ANCHE LE SCORCIATOIE DELLE FINESTRE
 *  `useScorciatoie` di ui.tsx lascia apposta ⌘/Ctrl al browser: serve alle
 *  PAGINE, dove un tasto singolo basta. Nelle finestre il gesto è un altro —
 *  si sta scrivendo dentro un campo e si vuole chiudere salvando — quindi
 *  ⌘/Ctrl+↵. Sta qui perché la usano tutte e quattro le finestre del lead, e
 *  accanto c'è il promemoria da mettere nel piede: una scorciatoia che non si
 *  vede non esiste.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Package, RotateCcw, Wallet, Wrench } from "lucide-react";
import { generateAvailability } from "./booking-utils";
import type {
  Consultant,
  InstallazioneInfo,
  Lead,
  LeadData,
  LeadStatus,
  PaymentInfo,
  TipoInstallazione,
} from "./types";
//  «Questo lead ha comprato?» si chiede a types.ts, dove l'elenco dei vinti
//  vive in un posto solo: qui era ricopiato, e la copia si era già fermata al
//  vecchio "venduto".
import { eChiusuraVinta } from "./types";
import { Tasto, dataBreve, eur, useTastoComando } from "./ui";
import {
  CampoFinestra,
  CLASSE_AREA,
  CLASSE_CAMPO,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
  VoceScelta,
} from "./ui/Finestra";
/*  I COMANDI DELLE INSTALLAZIONI SONO QUELLI DELL'ELENCO
 *  Importarli invece di rifarli è il motivo per cui da qui e da /CRM/installazioni
 *  si cambia lo stato con le stesse parole e si incassa con lo stesso gesto.
 *  Attenzione: questi componenti scrivono su Supabase da soli (useAzioniInstallazione
 *  → updateLead) e vogliono il lead SALVATO, non la bozza che si sta compilando. */
import {
  AzioniInstallazione,
  BadgeOggi,
  ETICHETTA_TIPO,
  ImportoConsegna,
  StatoInstallazione,
  //  ⚠️ CHI PUÒ ESEGUIRE UNA POSA SI DECIDE IN UN POSTO SOLO. Qui c'era un
  //  filtro scritto a mano (`consultants.filter(attivo)`): due menu per la
  //  stessa domanda, e da questa scheda si assegnava la posa a gente che
  //  «Programma installazione» non propone nemmeno. Un secondo elenco di chi
  //  può posare è la stessa cosa che kpi-setter.ts ha deciso di non avere per i
  //  ruoli.
  esecutoriPossibili,
  //  E la stessa risposta a «non c'è nessun installatore»: una schermata sola,
  //  scritta accanto alla regola, così questa scheda e la finestra non possono
  //  spiegare in due modi diversi la stessa spunta mancante.
  SenzaInstallatori,
  giornoISO,
  posaCompletata,
} from "./InstallationScheduleDialog";
//  Il cartellino della priorità: stesso componente dell'elenco delle pose.
import { SegnoPriorita } from "./PrioritaPosa";
import { SpesaTotale } from "./SpesaCliente";
import { TastoRicevuta } from "./ricevuta";
import { TastoFattura } from "./fatture/TastoFattura";
import { FatturatoIncassato } from "./fatture/BadgeDaFatturare";
//  Serve a dire, nel menu, chi è in elenco solo perché è già scritto sulla posa.
import { mestieriDi } from "./kpi-setter";
/** ── IL RITORNO SI VEDE ANCHE DA QUI ───────────────────────────────────────
 *  Solo il SEGNO, non il pulsante: questa scheda si apre anche a impianto
 *  posato da un mese, e chi la guarda deve poter leggere «torna fra sei giorni»
 *  senza passare dalla lente delle installazioni. Il gesto di fissarlo resta
 *  dov'è, sulla riga della posa appena completata, che è l'unico momento in cui
 *  il cliente è ancora lì. */
import { SegnoManutenzione } from "./manutenzione/PannelloManutenzioni";

/* ═══════════════════════════════════════════════════════════════════════════
   1. I MATTONCINI CONDIVISI CON LA SCHEDA DELLA TRATTATIVA
   ═════════════════════════════════════════════════════════════════════════ */

/** Il campo di testo delle finestre. È quello di ui/Finestra con una sola
 *  aggiunta: `text-base` sotto i 640px. Non è un vezzo — sotto i 16px iOS
 *  ingrandisce la pagina appena si tocca un campo, e non torna più indietro. */
export const CLASSI_CAMPO = cn(CLASSE_CAMPO, "text-base sm:text-[13px]");
/** La textarea: stessa famiglia del campo, altezza libera, niente maniglia. */
export const CLASSI_AREA = cn(CLASSE_AREA, "resize-none text-base sm:text-[13px]");
/** Il menu a tendina: stesso guscio del campo, perché è un campo anche lui. */
export const CLASSI_SELECT = cn(
  CLASSE_CAMPO,
  "w-full border px-2.5 text-base shadow-sm transition-colors sm:text-[13px]",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
);
/** La griglia dei campi: due colonne, sempre le stesse, in tutte le sezioni. */
export const GRIGLIA = "grid grid-cols-1 gap-3 sm:grid-cols-2";

/** Etichetta sopra, controllo sotto. È `CampoFinestra` con un altro nome: le
 *  due facce della scheda lo chiamavano già "Campo" e cambiare parola in
 *  cinquanta punti non aggiunge niente — cambiare COMPONENTE sì. */
export const Campo = CampoFinestra;

/** Una voce che si può scegliere: la `VoceScelta` delle finestre, con l'ordine
 *  degli argomenti a cui questa scheda è abituata (il testo è il figlio, la
 *  nota sta a destra). Accesa = fondo tenue + spunta; MAI un blocco pieno,
 *  perché il testo dentro un rettangolo saturo si legge peggio proprio quando
 *  conta di più, cioè quando è quello selezionato. */
export function Scelta({
  attiva,
  disabilitata,
  onClick,
  nota,
  className,
  children,
}: {
  attiva?: boolean;
  disabilitata?: boolean;
  onClick: () => void;
  /** informazione di servizio a destra (es. "3/6 call oggi") */
  nota?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <VoceScelta
      selezionata={attiva}
      disabilitata={disabilitata}
      onClick={onClick}
      titolo={children}
      coda={nota}
      className={cn("py-2", className)}
    />
  );
}

/** Blocco che compare solo in certe condizioni. Prima ognuno aveva il suo
 *  riquadro colorato — arancione, azzurro — e la finestra sembrava un semaforo:
 *  qui è una parte della scheda che si apre, separata da una riga, con gli
 *  stessi campi di tutte le altre.
 *
 *  NOTA — dopo il riordino della consegna questa scheda non lo usa più (i
 *  blocchi condizionati sono diventati finestre a sé). Resta esportato perché è
 *  un mattoncino della famiglia dei campi, come Campo e Scelta: toglierlo è una
 *  pulizia da fare guardando TUTTE le finestre del lead, non un effetto
 *  collaterale di questo lavoro. */
export function SottoBlocco({
  titolo,
  nota,
  children,
}: {
  titolo: string;
  nota?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-slate-200 p-4">
      <p className="mb-2.5 text-[12px] font-medium text-slate-700">{titolo}</p>
      {nota && <p className="-mt-2 mb-2.5 text-[11px] text-slate-500">{nota}</p>}
      <div className={GRIGLIA}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1b. LE SCORCIATOIE DELLE FINESTRE — sempre le stesse due
   ═════════════════════════════════════════════════════════════════════════ */

/** ⌘/Ctrl+↵ salva e chiude, anche mentre il cursore è dentro un campo.
 *  Funziona sull'intera finestra e non sul singolo `onKeyDown`: chi compila
 *  quindici campi non deve ricordarsi su quale si trovava per poter salvare. */
export function useSalvaConTastiera(attivo: boolean, salva: () => void): void {
  //  La funzione cambia a ogni render (legge la bozza corrente): tenerla in un
  //  riferimento evita di riagganciare il listener di continuo e di salvare una
  //  versione vecchia del modulo.
  const rif = useRef(salva);
  useEffect(() => {
    rif.current = salva;
  });
  useEffect(() => {
    if (!attivo) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        rif.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attivo]);
}

/** Il promemoria da mettere per primo nel piede della finestra: finisce a
 *  sinistra sul monitor e sparisce sul telefono, dove una tastiera non c'è. */
export function ScorciatoieFinestra({
  salva = true,
  children,
}: {
  /** false quando la finestra non ha un'azione di salvataggio */
  salva?: boolean;
  /** scorciatoie in più, specifiche di quella finestra */
  children?: ReactNode;
}) {
  const cmd = useTastoComando();
  return (
    <span className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 sm:mr-auto sm:inline-flex">
      <span className="inline-flex items-center gap-1">
        <Tasto>Esc</Tasto> chiudi
      </span>
      {salva && (
        <span className="inline-flex items-center gap-1">
          <Tasto>{cmd}</Tasto>
          <Tasto>↵</Tasto> salva
        </span>
      )}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. QUANDO SI CAMBIA MESTIERE
   ═════════════════════════════════════════════════════════════════════════ */

/** ── LA TRATTATIVA È VINTA ────────────────────────────────────────────────
 *  Due modi di dire la stessa cosa, e vanno accettati tutti e due: lo STATO —
 *  una delle tre chiusure di oggi, l'"acconto" che il sistema mette da sé, o il
 *  vecchio "venduto" dell'archivio — oppure l'IMPORTO, perché un acconto può
 *  arrivare da un'importazione con lo stato ancora fermo a com'era. Basta uno
 *  dei due perché il lavoro diventi la consegna.
 *  ⚠️ L'elenco degli stati NON è più scritto qui: `eChiusuraVinta` (crm/types)
 *   è la stessa riga che leggono i KPI e il contesto. Scritto a mano conosceva
 *   solo "acconto" e "venduto": una vendita chiusa oggi come «Da spedire» e
 *   pagata tutta alla consegna — cioè con acconto zero, che è un caso normale —
 *   risultava NON vinta, e la scheda continuava a mostrare il mestiere della
 *   trattativa invece di quello della consegna. */
export function trattativaVinta(d: LeadData): boolean {
  return eChiusuraVinta(d.stato) || (d.payment?.accontoPagato || 0) > 0;
}

/** ── DOVE TORNA LA SCHEDA SE L'INCASSO ERA UN ERRORE ──────────────────────
 *  Non si inventa uno stato: se la consulenza era già fissata la trattativa
 *  torna "svolta" (è successa davvero, l'errore è solo l'incasso), altrimenti
 *  torna in attesa di appuntamento. `previousStato` non si usa qui perché
 *  appartiene alla chiusura/riapertura della pratica: leggerlo in due posti
 *  diversi porta a due significati diversi dello stesso campo. */
export function statoRitornoConsulenza(d: LeadData): LeadStatus {
  return d.dataMeeting && d.oraMeeting ? "fatto" : "appuntamento_fissato";
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. TABELLE DI SERVIZIO
   ═════════════════════════════════════════════════════════════════════════ */

/*  Le parole dei tipi NON stanno più qui: le dice `ETICHETTA_TIPO` del modulo
    installazioni. Quando erano due tabelle, la stessa posa era "Taxi (a
    domicilio)" nella scheda e "A domicilio" nell'elenco. Qui resta solo
    l'ORDINE in cui si presentano, che è quello di lettura. */
const TIPI_INSTALLAZIONE: TipoInstallazione[] = ["da_impostare", "taxi", "indipendente"];

const DURATE_INSTALLAZIONE = [60, 90, 120, 150, 180] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA SCHERMATA DELLA CONSEGNA
   ═════════════════════════════════════════════════════════════════════════ */

interface Props {
  form: LeadData;
  update: <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;
  consultants: Consultant[];
  /** Tutte le pratiche. Servono per due cose: sapere quali slot sono già
   *  occupati sull'agenda, e ritrovare qui dentro la versione SALVATA di
   *  questa scheda (vedi `leadSalvato`). */
  allLeads: Lead[];
  /** il lead che si sta modificando: i suoi slot non contano come occupati */
  currentLeadId?: string;
  /** Lo storico acquisti arriva dall'esterno già montato: qui si decide solo
   *  DOVE sta nella pagina, non come è fatto. */
  storicoAcquisti?: ReactNode;
  /** ── COME SI CHIUDE LA FINESTRA CHE CONTIENE QUESTA SCHEDA ──────────────
   *  Serve in un caso solo, ed è un vicolo cieco: quando non c'è nessun
   *  installatore, `SenzaInstallatori` offre di aprire l'anagrafica dei
   *  consulenti. Questa scheda però vive DENTRO la finestra del lead: cambiare
   *  pagina senza chiuderla prima lascia la finestra aperta sopra l'anagrafica
   *  e copre proprio la scheda da aprire — cioè un secondo vicolo cieco dentro
   *  il primo. Chi monta la scheda sa come si chiude, questa no: quindi la
   *  riceve. Assente = si cambia pagina e basta, ed è giusto solo dove attorno
   *  non c'è nessuna finestra da chiudere. */
  chiudiScheda?: () => void;
}

export function SchedaPostVendita({
  form,
  update,
  consultants,
  allLeads,
  currentLeadId,
  storicoAcquisti,
  chiudiScheda,
}: Props) {
  /* ── LA VERSIONE SALVATA DI QUESTA SCHEDA ──────────────────────────────
     I comandi condivisi delle installazioni (StatoInstallazione, ImportoConsegna,
     AzioniInstallazione) scrivono su Supabase da soli: vogliono il lead che sta
     nel database, non la bozza che si sta compilando — la bozza non ha un id
     vero e ogni scrittura fallirebbe.

     PERCHÉ SE LO PRENDE DA SÉ E NON SE LO FA PASSARE
     Riceverlo come prop voleva dire dipendere da chi monta la scheda, e chi la
     monta non lo passava: risultato, la barra del lavoro non compariva MAI e al
     suo posto restava per sempre la riga "compaiono appena la scheda è stata
     salvata". `allLeads` è già l'elenco del contesto CRM e `currentLeadId` è
     già l'id di questa pratica: il lead salvato è lì dentro, basta ripescarlo.
     Così la scheda non si può montare "a metà".

     Finché la trattativa non è mai stata salvata il risultato è `undefined`, ed
     è giusto così: i comandi non si montano e la barra lo dice. */
  const leadSalvato = useMemo(
    () => (currentLeadId ? allLeads.find((l) => l.id === currentLeadId) : undefined),
    [allLeads, currentLeadId],
  );

  /* ── Il denaro si tiene sempre coerente ────────────────────────────────
     Prezzo, incassato, saldo e stato del pagamento sono quattro facce dello
     stesso numero: si scrivono insieme, altrimenti si finisce con un "pagato
     interamente" e il saldo ancora aperto. */
  const patchPagamento = (patch: Partial<PaymentInfo>) => {
    const next: PaymentInfo = { ...form.payment, ...patch };
    const prezzo = Number(next.prezzoFinaleVendita) || Number(next.prezzoTotale) || 0;
    const acconto = Number(next.accontoPagato) || 0;
    next.saldoRimanente = Math.max(0, prezzo - acconto);
    next.statoPagamento =
      acconto <= 0
        ? "nessun_pagamento"
        : acconto >= prezzo && prezzo > 0
          ? "pagato_interamente"
          : "acconto_ricevuto";
    update("payment", next);
  };

  const patchInstallazione = (patch: Partial<InstallazioneInfo>) =>
    update("installazione", { ...form.installazione, ...patch });

  const prezzo = form.payment?.prezzoFinaleVendita || form.payment?.prezzoTotale || 0;
  const acconto = form.payment?.accontoPagato || 0;
  const saldo = Math.max(0, prezzo - acconto);
  //  Il prezzo finale è il numero su cui il sistema calcola il saldo ovunque:
  //  se è a zero mentre c'è un prezzo di listino, il saldo qui sarebbe giusto
  //  ma altrove no. Meglio dirlo che lasciarlo scoprire alla consegna.
  const prezzoFinaleMancante =
    !form.payment?.prezzoFinaleVendita && (form.payment?.prezzoTotale || 0) > 0;

  const inst = form.installazione;
  /* ── «LA FA CHI HA VENDUTO» NON SCAVALCA LA REGOLA ─────────────────────
     Qui il ripiego era secco: se sulla posa non c'era nessuno, si prendeva il
     consulente della vendita. Era comodo finché in quel menu ci stavano tutti;
     da quando «Chi installa» accetta SOLO gli installatori (esecutoriPossibili)
     è diventato la porta di servizio della stessa regola — il venditore entrava
     in elenco perché «è già scritto su questa posa», risultava pure scelto, e
     al primo slot preso `impostaQuando` lo scriveva davvero come installatore.
     Adesso il ripiego vale solo se quella persona può eseguire; altrimenti non
     c'è nessuno, l'agenda non si apre e il campo lo dice — che è la verità. */
  const scrittoSullaPosa = inst?.consulenteInstallazioneId || "";
  const chiHaVenduto = form.consulenteId || "";
  const installatoreId =
    scrittoSullaPosa ||
    (chiHaVenduto && esecutoriPossibili(consultants).elenco.some((c) => c.id === chiHaVenduto)
      ? chiHaVenduto
      : "");
  const installatore = consultants.find((c) => c.id === installatoreId);
  const durataInst = inst?.durataInstallazione || 60;

  return (
    <div className="space-y-3">
      {/* ══════ 0 · LA BARRA DEL LAVORO ══════
          Senza riquadro attorno e in cima: sono le cose che si guardano e si
          fanno ogni giorno, e devono stare sotto gli occhi senza scorrere. */}
      <BarraLavoro lead={leadSalvato} saldo={saldo} />

      {/* ══════ 1 · DOVE SI POSA E CHI CI VA ══════ */}
      <BloccoPosa
        inst={inst}
        patchInstallazione={patchInstallazione}
        consultants={consultants}
        allLeads={allLeads}
        currentLeadId={currentLeadId}
        installatore={installatore}
        installatoreId={installatoreId}
        durataInst={durataInst}
        consulenteVenditaId={form.consulenteId}
        chiudiScheda={chiudiScheda}
      />

      {/* ══════ 2 · IL MATERIALE ══════ */}
      <BloccoMateriale form={form} update={update} patchPagamento={patchPagamento} />

      {/* ══════ 3 · SOLDI ══════ */}
      <BloccoSoldi
        form={form}
        update={update}
        patchPagamento={patchPagamento}
        prezzo={prezzo}
        saldo={saldo}
        prezzoFinaleMancante={prezzoFinaleMancante}
      />

      {/* ══════ 4 · CONTESTO ══════
          Storico e note stanno in fondo: raccontano il cliente, non il lavoro
          di oggi. Lo storico è montato dall'esterno; le righe dei prodotti si
          aggiungono solo premendo «+», mai da sole. */}
      {storicoAcquisti}
      <NoteConsulenza form={form} update={update} />
    </div>
  );
}

/* ── 0 · LA BARRA DEL LAVORO ───────────────────────────────────────────────
   Le quattro azioni della giornata in una riga sola: chiamare, scrivere su
   WhatsApp con data e cifra già dentro, registrare il saldo (due tocchi, con o
   senza IVA), segnare la posa completata. Accanto, le due cose che si leggono
   a colpo d'occhio: quanto resta da incassare e a che punto è.

   È L'UNICO PUNTO COLORATO DELLA SCHEDA
   Ambra se manca l'incasso, emerald se è saldato o completato, sky per "oggi".
   Tutto il resto è neutro apposta: se colori ovunque, non si legge niente.

   PERCHÉ LEGGE IL LEAD SALVATO E NON LA BOZZA
   Questi comandi scrivono su Supabase da soli, quindi devono vedere quello che
   c'è nel database, non quello che si sta scrivendo: registrare un incasso su
   un prezzo non ancora salvato scriverebbe in archivio un numero che nessuno
   ha confermato. Gli importi in lavorazione si vedono e si correggono nella
   finestra «Correggi gli importi», ed è dopo «Salva» che questa cifra cambia. */
function BarraLavoro({ lead, saldo }: { lead?: Lead; saldo: number }) {
  if (!lead) {
    return (
      <NotaFinestra icona={Wallet}>
        I comandi rapidi dell&apos;installazione — stato del materiale, saldo incassato, WhatsApp
        con data e cifra — compaiono appena la scheda è stata salvata una prima volta.
        {saldo > 0 && (
          <>
            {" "}
            Da incassare alla consegna:{" "}
            <strong className="font-semibold tabular-nums">{eur(saldo)}</strong>.
          </>
        )}
      </NotaFinestra>
    );
  }

  const oggi = lead.data.installazione?.dataInstallazione === giornoISO();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/*  ── ⚠️ A POSA FATTA IL RIQUADRO DELL'INCASSO SPARISCE ──────────────
          Richiesta del committente: quando l'ordine è completato deve restare
          solo «Speso in tutto», coi costi e il netto sotto.
          Non è una preferenza di stile: a saldo chiuso quel riquadro diceva
          «già versato 650 · totale 650 · resta 0», cioè tre caselle per
          ripetere una cifra che il blocco qui sotto scriveva già — e la sola
          cosa che aggiungeva, «resta 0», è l'informazione meno utile che si
          possa dare su una pratica finita.
          ⚠️ SPARISCE SOLO DOVE C'È L'ALTRO. Nella giornata dell'installatore e
           nei pacchi da spedire `SoldiPosa` resta l'unico blocco dei soldi, e
           là continua a comparire col suo conto (vedi la nota su `SoldiPosa`
           in crm/InstallationScheduleDialog): toglierlo lascerebbe quelle
           schermate senza nessun numero. */}
      {!posaCompletata(lead) && <ImportoConsegna lead={lead} />}
      {/*  ── LO STORICO, ANCHE QUI ─────────────────────────────────────────
          Richiesta del committente: il pulsante deve stare su OGNI cliente.
          Finora esisteva solo sulla riga delle pose completate — cioè si
          trovava scorrendo l'elenco delle installazioni, e chi apriva la
          scheda di quella persona per telefonarle non aveva modo di sapere
          quanto gli aveva lasciato né quante volte era tornato. Col cliente al
          telefono è esattamente il dato che serve.
          ⚠️ È IL MEDESIMO componente dell'elenco (crm/SpesaCliente): stesso
           numero, stessa finestra, stesso conto. Una seconda versione qui
           avrebbe potuto dire una cifra diversa sulla stessa persona. */}
      <SpesaTotale lead={lead} />
      <StatoInstallazione lead={lead} />
      {oggi && <BadgeOggi />}
      {/*  ── IL CARTELLINO «DA ANTICIPARE», ANCHE QUI ─────────────────────
          Richiesta del committente: la priorità si deve vedere «anche fuori,
          sul lead». Finora viveva solo negli elenchi delle pose e dei pacchi —
          cioè si scopriva soltanto scorrendo la pagina delle installazioni, e
          chi apriva la scheda di quella persona per telefonarle non aveva modo
          di sapere che era stata messa in cima, né che aveva chiesto un giorno
          preciso. Con il cliente al telefono è esattamente il dato che serve.
          ⚠️ È il MEDESIMO componente dell'elenco (crm/PrioritaPosa): stesso
           colore, stesse parole, e soprattutto la stessa regola su quando
           sparire — a posa fatta non c'è più niente da anticipare. Una seconda
           versione qui avrebbe mostrato il cartellino su pratiche chiuse. */}
      <SegnoPriorita lead={lead} />
      {/*  Compare da sé solo se un ritorno c'è davvero (SegnoManutenzione
          restituisce null altrimenti): un segno sempre presente smette di
          essere guardato entro mezza giornata. */}
      <SegnoManutenzione lead={lead} />
      {/*  Il riepilogo di consegna si ristampa da qui: il cliente lo perde, o lo
          chiede sei mesi dopo al telefono, e a quel punto la riga della posa nel
          suo giorno non si trova più. La cifra della copertura è quella scritta
          allora sulla pratica, non il listino di oggi — vedi crm/ricevuta. */}
      <TastoRicevuta lead={lead} esteso />
      {/*  La fattura: si compone da qui, dove ci sono già il cliente e gli
          importi. ⚠️ Non è legata alla posa come il riepilogo — una fattura
          nasce con l'incasso, e il primo incasso è l'acconto (vedi TastoFattura). */}
      <TastoFattura lead={lead} esteso />
      {/*  ── ⚠️ FATTURATO CONTRO INCASSATO ──────────────────────────────────
          Richiesta del committente. Sta ACCANTO al tasto della fattura perché
          è la domanda a cui quel tasto risponde: «di quello che ha pagato,
          quanto gli ho già fatturato?». Prima la differenza non la vedeva
          nessuno finché non la chiedeva il commercialista — e a quel punto era
          un mese dopo, su venti pratiche insieme.
          ⚠️ Non dice cosa fare: quanto vada fatturato lo decide chi fattura,
           documento per documento. Qui ci sono due cifre e la loro distanza. */}
      <FatturatoIncassato lead={lead} className="w-full sm:w-auto" />
      {/*  ⚠️ NIENTE «FISSA» QUI: il pulsante sta sulla riga della posa
          completata e nella giornata del tecnico, cioè dove il cliente è
          ancora presente. Da questa scheda si fissa un ritorno al telefono, e
          il posto per farlo è la lente «Manutenzioni». */}
      {/*  Sul telefono le azioni vanno a capo su una riga tutta loro: sei
          pulsanti in coda a un importo diventano bersagli da 20px. */}
      <AzioniInstallazione lead={lead} className="w-full sm:ml-auto sm:w-auto sm:justify-end" />
    </div>
  );
}

/* ── 1 · DOVE SI POSA E CHI CI VA ──────────────────────────────────────────
   Un blocco solo per la domanda "dove devo andare e con chi". Il DOVE sta
   nelle note della posa: era in fondo alla scheda, cioè il dato più cercato
   nel posto peggiore.

   DATA E ORA NON SONO QUI, E NON È UNA DIMENTICANZA
   Questa scheda vive dentro LeadDialog, che in cima — fermo sul monitor, primo
   sul telefono — tiene già il riquadro «Prossima azione · Installazione» con
   data, ora e la frase "domani alle 10:00". Ripeterle qui dentro significava
   due campi data e due campi ora identici nella stessa finestra a due dita di
   distanza: chi apriva la scheda doveva capire quale dei due comandasse (sono
   lo stesso dato, scrivono lo stesso campo). Se ne tiene UNO, e si tiene quello
   che si vede senza scorrere — che è anche quello che risponde alla telefonata
   "quando viene il tecnico?".
   Qui resta il modo di scegliere data e ora BENE, cioè su uno slot libero:
   l'agenda.

   L'agenda di questa schermata non è quella della consulenza: gli slot sono
   quelli di CHI INSTALLA (di norma il consulente della vendita, ma può essere
   un altro). Scegliere uno slot da qui lo occupa davvero: gli orari già presi —
   consulenze, visite in sede e altre installazioni — sono esclusi dall'elenco,
   quindi due clienti non possono finire alla stessa ora sulla stessa persona.

   LA DURATA STA DENTRO L'AGENDA
   Serve solo a calcolare gli slot: fuori dall'agenda non decide niente, e come
   riga sempre aperta erano cinque pastiglie che non si toccavano mai. */
function BloccoPosa({
  inst,
  patchInstallazione,
  consultants,
  allLeads,
  currentLeadId,
  installatore,
  installatoreId,
  durataInst,
  consulenteVenditaId,
  chiudiScheda,
}: {
  inst?: InstallazioneInfo;
  patchInstallazione: (patch: Partial<InstallazioneInfo>) => void;
  consultants: Consultant[];
  allLeads: Lead[];
  currentLeadId?: string;
  installatore?: Consultant;
  installatoreId: string;
  durataInst: number;
  consulenteVenditaId?: string | null;
  /** vedi `chiudiScheda` in `Props`: la via d'uscita dal vicolo cieco passa da
   *  un'altra pagina, e questa scheda sta dentro una finestra */
  chiudiScheda?: () => void;
}) {
  //  L'agenda si apre a richiesta: quando la data c'è già, aprirla sempre
  //  significherebbe mezza schermata di orari da scorrere per arrivare alle
  //  note.
  const [agendaAperta, setAgendaAperta] = useState(false);
  //  Chi può eseguire la posa: gli INSTALLATORI, con la stessa funzione che
  //  riempie «Chi la esegue» in «Programma installazione» — e chi è già scritto
  //  su questa posa resta in elenco anche se nel frattempo è stato spento o gli
  //  è stata tolta la spunta. Non c'è più nessun ripiego sui consulenti: se non
  //  c'è nemmeno un installatore il menu sparisce e al suo posto si legge cosa
  //  manca e dove si accende (`manca` + SenzaInstallatori, la stessa schermata
  //  della finestra: una mancanza sola, raccontata in un modo solo).
  const { elenco: eseguibili, manca: mancaEsecutore } = useMemo(
    () => esecutoriPossibili(consultants, installatoreId),
    [consultants, installatoreId],
  );

  const disponibilita = useMemo(() => {
    if (!installatore) return [];
    return generateAvailability(installatore, durataInst, allLeads, 30, undefined, currentLeadId);
  }, [installatore, durataInst, allLeads, currentLeadId]);

  const dataScelta = inst?.dataInstallazione || "";
  const oraScelta = inst?.orarioInstallazione || "";
  const tipoScelto = inst?.tipoInstallazione || "da_impostare";

  /* ── CHI INSTALLA SI SCRIVE INSIEME AL QUANDO ──────────────────────────
     L'agenda considera occupato uno slot solo se l'installazione dice di chi
     è. Finché nessuno tocca il menu dell'installatore, il nome è quello del
     consulente della vendita ma è solo un valore di comodo: se salvassimo
     data e ora senza fissarlo, l'appuntamento esisterebbe per il cliente e
     non per l'agenda — e lo stesso orario verrebbe offerto di nuovo al
     cliente dopo. */
  const impostaQuando = (
    patch: Pick<InstallazioneInfo, "dataInstallazione" | "orarioInstallazione">,
  ) => patchInstallazione({ consulenteInstallazioneId: installatoreId || null, ...patch });

  /*  Cambiare installatore invalida lo slot: quell'orario era libero sull'agenda di
      un'altra persona, non della nuova. */
  const cambiaInstallatore = (id: string) => {
    if (id === installatoreId) return;
    patchInstallazione({
      consulenteInstallazioneId: id || null,
      dataInstallazione: undefined,
      orarioInstallazione: undefined,
    });
  };

  /*  ── IL NOME SCRITTO A MANO, CHE ORA SI LEGGE E BASTA ──────────────────
      Qui c'era un campo di TESTO che scriveva `installazione.tecnicoAssegnato`:
      un nome che non bloccava nessuna agenda. È lo stesso campo che «Programma
      installazione» ha smesso di scrivere quando chi accompagna è diventato una
      persona scelta (vedi `accompagnatoreScrittoAMano` là dentro). Lasciarlo
      scrivibile QUI voleva dire che il CRM continuava a produrre proprio i nomi
      che l'altra finestra dichiara «rimasti dalle pose vecchie»: due risposte
      vive alla stessa domanda, e quella scrivibile è quella che non toglie
      tempo a nessuno.
      Quello che è già scritto NON si cancella e resta visibile — su quelle
      pratiche è l'unica traccia di chi ci andava — ma si legge soltanto. */
  const nomeScrittoAMano = String(inst?.tecnicoAssegnato || "").trim();

  return (
    <SezioneFinestra
      titolo="Dove si posa e chi ci va"
      nota="Installatore, tipo di posa e indirizzo"
      icona={Wrench}
      /*  Il pulsante dell'agenda sta nella testata del blocco: è la prima cosa
          della riga in cui si sceglie l'installatore — e gli slot sono i suoi —
          e da lì non si sposta quando l'agenda si apre. Le due righe che
          spiegavano cosa fa sono sparite: il nome lo dice, e il dettaglio
          ("gli slot si bloccano sull'agenda di X") è nel title. */
      azioni={
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!installatore}
          title={
            installatore
              ? `Orari liberi di ${installatore.data.nome} nei prossimi 30 giorni · lo slot scelto si blocca sulla sua agenda`
              : "Scegli l'installatore per vedere gli orari liberi"
          }
          onClick={() => setAgendaAperta((v) => !v)}
        >
          <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
          {agendaAperta ? "Chiudi l'agenda" : "Data e ora dall'agenda"}
        </Button>
      }
      classeCorpo="space-y-3 p-4"
    >
      {/* L'AGENDA DELL'INSTALLATORE — a tutta larghezza del blocco, senza un
          secondo riquadro dentro il riquadro: è una parte di questo blocco che
          si apre, non una scheda a sé. Sta in cima perché è attaccata al
          pulsante che l'ha aperta. */}
      {agendaAperta && installatore && (
        <div className="-mx-4 -mt-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Durata
            </span>
            {DURATE_INSTALLAZIONE.map((d) => (
              <Pillola
                key={d}
                attiva={durataInst === d}
                onClick={() =>
                  patchInstallazione({ durataInstallazione: d, orarioInstallazione: undefined })
                }
                className="px-2 py-1"
              >
                {d} min
              </Pillola>
            ))}
            {/*  Lo slot scelto si legge qui, mentre l'agenda è aperta: la
                pastiglia accesa può essere venti giorni più in basso, e senza
                questa riga non si saprebbe che la scelta è andata a segno.
                Chiusa l'agenda, data e ora restano scritte una volta sola in
                cima alla finestra. */}
            {dataScelta && oraScelta && (
              <span className="ml-auto text-[11.5px] tabular-nums text-slate-600">
                Scelto: {dataBreve(dataScelta)} · {oraScelta}
              </span>
            )}
          </div>
          {disponibilita.length === 0 ? (
            <p className="px-4 pb-3 text-[11.5px] text-slate-500">
              Nessuno slot libero di {durataInst} minuti nei prossimi 30 giorni per{" "}
              {installatore.data.nome}.
            </p>
          ) : (
            <div className="max-h-64 divide-y divide-slate-200 overflow-y-auto border-t border-slate-200">
              {disponibilita.map((day) => (
                <div key={day.date} className="px-4 py-2.5">
                  <div className="mb-2 text-[12px] font-medium text-slate-700">{day.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {day.slots.map((s) => (
                      <Pillola
                        key={s}
                        attiva={dataScelta === day.date && oraScelta === s}
                        onClick={() =>
                          impostaQuando({ dataInstallazione: day.date, orarioInstallazione: s })
                        }
                        className="px-2 py-1 font-mono"
                      >
                        {s}
                      </Pillola>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CHI CI VA — un menu, non otto righe sempre aperte.
          «Chi installa» è LA scelta, ed è l'unica: il nome scritto a mano
          accanto non è più una seconda risposta alla stessa domanda ma il
          residuo delle pose vecchie, e si vede solo dove c'è. */}
      <div className={GRIGLIA}>
        <Campo etichetta="Chi installa" nota="Gli orari liberi arrivano dalla sua agenda">
          {mancaEsecutore ? (
            //  ── NIENTE MENU VUOTO ────────────────────────────────────────
            //   Un «Da assegnare» da solo, senza nessun nome sotto, è una
            //   tendina che non si può usare e non dice perché. Al suo posto
            //   c'è la schermata che dice cosa manca e porta ad accenderlo: la
            //   stessa di «Programma installazione», scritta una volta sola.
            //   ⚠️ E la finestra del lead si chiude PRIMA di cambiare pagina,
            //   come fa la finestra della posa: senza, resterebbe aperta sopra
            //   l'anagrafica e coprirebbe proprio la scheda da aprire.
            <SenzaInstallatori manca={mancaEsecutore} primaDiAndare={chiudiScheda} />
          ) : (
            <select
              className={CLASSI_SELECT}
              value={installatoreId}
              onChange={(e) => cambiaInstallatore(e.target.value)}
            >
              <option value="">Da assegnare</option>
              {eseguibili.map((c) => (
                <option key={c.id} value={c.id}>
                  {/*  Sapere chi ha venduto aiuta a scegliere: spesso il cliente
                      si aspetta la stessa persona che ha visto in consulenza.
                      Chi resta in elenco solo perché è già scritto su questa
                      posa lo dice: il nome da solo non spiegherebbe perché sta
                      in un menu di installatori. */}
                  {c.data.nome}
                  {c.id === consulenteVenditaId ? " · ha venduto" : ""}
                  {!mestieriDi(c.data).faInstallatore ? " · già su questa posa" : ""}
                  {!c.data.attivo ? " · non più attivo" : ""}
                </option>
              ))}
            </select>
          )}
        </Campo>
        {/*  ⚠️ SOLA LETTURA, E SOLO SE C'È. Era un campo scrivibile: si digitava
            un nome, il CRM continuava a proporre quella persona libera e lo si
            scopriva la mattina stessa. Adesso chi va a posare si SCEGLIE qui
            accanto — è l'unico modo perché la posa gli tolga il tempo che le
            sta togliendo davvero. Quello che era già scritto resta, dichiarato
            per quello che è. */}
        {nomeScrittoAMano && (
          <Campo
            etichetta="Nome scritto a mano"
            nota="Resta dalle pose vecchie: è un testo, non blocca nessuna agenda"
          >
            <Input className={CLASSI_CAMPO} value={nomeScrittoAMano} readOnly disabled />
          </Campo>
        )}
      </div>

      {/* TIPO — una scelta breve è una fila di pastiglie, non tre righe
          d'elenco. Le parole sono quelle dell'elenco installazioni. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Tipo</span>
        {TIPI_INSTALLAZIONE.map((t) => (
          <Pillola
            key={t}
            attiva={tipoScelto === t}
            onClick={() => patchInstallazione({ tipoInstallazione: t })}
          >
            {ETICHETTA_TIPO[t]}
          </Pillola>
        ))}
      </div>

      {/* IL DOVE — è quello che il tecnico legge prima di uscire */}
      <Campo etichetta="Dove e note per la posa">
        <Textarea
          rows={3}
          className={CLASSI_AREA}
          placeholder="Indirizzo, piano, ascensore, parcheggio, dettagli per chi va a posare…"
          value={inst?.noteInstallazione || ""}
          onChange={(e) => patchInstallazione({ noteInstallazione: e.target.value })}
        />
      </Campo>
    </SezioneFinestra>
  );
}

/* ── 2 · IL MATERIALE ──────────────────────────────────────────────────────
   Cosa si posa: base, colore, misure. È la scheda tecnica del prodotto, quella
   che si legge prima di ordinare e prima di partire.

   NIENTE CHECKLIST DELLA BORSA
   Qui c'era l'elenco fisso dei quattro materiali (protesi, colla, forbici,
   modulo firma): nessuno lo spuntava mai, perché non è l'elenco di chi lavora
   ma uno inventato dal programma. Tolto da tutto il ramo delle installazioni.
   ⚠️ Il dato NON è stato cancellato: le checklist già spuntate restano scritte
   in `installazione.checklist` e nessuna scrittura di questa scheda le tocca.

   NIENTE SELETTORE DI STATO QUI DENTRO
   "Da ordinare / Colore da confermare / Ordinato / Colore confermato" si
   sceglie dal chip in cima alla scheda (StatoInstallazione), che è lo stesso
   comando dell'elenco installazioni. Tenerne una copia qui significava due
   controlli per un valore solo, con parole diverse fra le due pagine. */
function BloccoMateriale({
  form,
  update,
  patchPagamento,
}: {
  form: LeadData;
  update: <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;
  patchPagamento: (patch: Partial<PaymentInfo>) => void;
}) {
  return (
    <SezioneFinestra
      titolo="Il materiale"
      nota="Cosa si posa: base, colore, misure"
      icona={Package}
      classeCorpo="space-y-3 p-4"
    >
      <div className={GRIGLIA}>
        <Campo etichetta="Prodotto">
          <Input
            className={CLASSI_CAMPO}
            value={form.payment?.prodotto || ""}
            placeholder="Modello venduto"
            onChange={(e) => patchPagamento({ prodotto: e.target.value })}
          />
        </Campo>
        <Campo etichetta="Codice colore">
          <Input
            className={CLASSI_CAMPO}
            value={form.codiceColore || ""}
            placeholder="es. 1B30"
            onChange={(e) => update("codiceColore", e.target.value)}
          />
        </Campo>
        <Campo etichetta="Dettagli impianto" className="sm:col-span-2">
          <Input
            className={CLASSI_CAMPO}
            value={form.dettagliImpianto || ""}
            placeholder="Base, densità, misure, riccio…"
            onChange={(e) => update("dettagliImpianto", e.target.value)}
          />
        </Campo>
        {/*  IL VIDEO DEL COLORE È UN CAMPO DEL MODULO
            Era un riquadro con un interruttore per un sì/no: come casella costa
            una riga sola. ⚠️ Vive finché non si preme «Salva», come gli altri
            campi qui sopra — non si scrive da sé come fanno i comandi condivisi
            delle installazioni. */}
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] sm:col-span-2">
          <Checkbox
            checked={!!form.videoColoreSent}
            onCheckedChange={(v) => update("videoColoreSent", v === true)}
          />
          <span className={form.videoColoreSent ? "text-muted-foreground line-through" : ""}>
            Video del colore inviato al cliente
          </span>
        </label>
      </div>
    </SezioneFinestra>
  );
}

/* ── 3 · SOLDI ─────────────────────────────────────────────────────────────
   QUI NON SI SCRIVE NESSUN NUMERO CHE SIA GIÀ SCRITTO ALTROVE
   Nella stessa finestra il prezzo di vendita e quanto è già stato incassato
   stanno già nel «Riepilogo economico» della colonna di sinistra (con costi e
   profitto), e la cifra che serve davvero alla consegna sta in cima
   (ImportoConsegna). Una riga "€ X di vendita · € Y già incassati" qui era la
   TERZA copia degli stessi due numeri a mezzo schermo di distanza: è il motivo
   per cui questa scheda sembrava piena di soldi ovunque. Tolta.

   RESTA UNA PORTA, E DUE COSE CHE SI DICONO SOLO SE SUCCEDONO
   La porta è «Correggi gli importi»: prezzo, incasso, metodo, data, rate e
   costi si toccano una volta a pratica — spesso mai, perché li ha già scritti
   la vendita — quindi stanno dietro un gesto, non davanti agli occhi ogni
   giorno. Il corpo del blocco compare solo se c'è un piano rate o se manca il
   prezzo: senza, resta la sola riga di testata con la porta. */
function BloccoSoldi({
  form,
  update,
  patchPagamento,
  prezzo,
  saldo,
  prezzoFinaleMancante,
}: {
  form: LeadData;
  update: <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;
  patchPagamento: (patch: Partial<PaymentInfo>) => void;
  prezzo: number;
  saldo: number;
  prezzoFinaleMancante: boolean;
}) {
  const [importiAperti, setImportiAperti] = useState(false);
  const rate = !!form.payment?.pianoRate;
  const numeroRate = form.payment?.numeroRate || 0;
  const importoRata = form.payment?.importoRata || 0;
  //  Due mancanze diverse, un avviso solo: senza nessun prezzo il saldo non
  //  esiste; con il solo listino esiste ma è quello sbagliato. In entrambi i
  //  casi il numero della consegna non è affidabile, e si dice in ambra.
  const avviso = prezzo <= 0 || prezzoFinaleMancante;

  return (
    <>
      <SezioneFinestra
        titolo="Soldi"
        nota="Prezzo, incassi, rate e costi"
        icona={Wallet}
        azioni={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setImportiAperti(true)}
          >
            Correggi gli importi
          </Button>
        }
        classeCorpo="space-y-2 p-4"
      >
        {rate || avviso ? (
          <>
            {/*  Le rate si dicono solo quando ci sono davvero: è una minoranza
                dei clienti, e tre campi vuoti sempre aperti erano tre campi in
                più da saltare con gli occhi ogni volta. */}
            {rate && (
              <p className="text-[12px] text-slate-600">
                A rate: {numeroRate} × {eur(importoRata)}
                {form.payment?.prossimaScadenza
                  ? ` · prossima ${dataBreve(form.payment.prossimaScadenza)}`
                  : ""}
              </p>
            )}

            {/*  L'unico avviso che resta in prima pagina: incassare sul prezzo
                sbagliato è l'errore che costa di più, e si scopre alla
                consegna. */}
            {avviso && (
              <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                {prezzo <= 0 ? (
                  <>
                    Manca il <strong className="font-medium">prezzo di vendita</strong>: finché non
                    c&apos;è, l&apos;importo da incassare alla consegna non si può calcolare.
                  </>
                ) : (
                  <>
                    Manca il <strong className="font-medium">prezzo finale di vendita</strong>:
                    finché resta a zero, incassi e profitto risultano sbagliati nelle altre
                    schermate.
                  </>
                )}
              </NotaFinestra>
            )}
          </>
        ) : null}
      </SezioneFinestra>

      <FinestraImporti
        aperta={importiAperti}
        onCambio={setImportiAperti}
        form={form}
        update={update}
        patchPagamento={patchPagamento}
        saldo={saldo}
      />
    </>
  );
}

/* ── LA FINESTRA DEGLI IMPORTI ─────────────────────────────────────────────
   Tutto quello che si scrive una volta sola, insieme: prezzo e incasso, il
   piano rate con il suo avviso, i costi, e in fondo il ritorno alla consulenza.
   Le tre cose stanno nella stessa finestra perché si sbagliano nello stesso
   momento — quando si registra l'incasso — ed è lì che si vanno a cercare. */
function FinestraImporti({
  aperta,
  onCambio,
  form,
  update,
  patchPagamento,
  saldo,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  form: LeadData;
  update: <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;
  patchPagamento: (patch: Partial<PaymentInfo>) => void;
  saldo: number;
}) {
  const rate = !!form.payment?.pianoRate;
  const numeroRate = form.payment?.numeroRate || 0;
  const importoRata = form.payment?.importoRata || 0;
  const copertura = numeroRate * importoRata;
  const cliente = `${form.nome || ""} ${form.cognome || ""}`.trim();

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      larghezza="md"
      icona={Wallet}
      titolo="Correggi gli importi"
      contesto={[cliente, "si scrivono qui, si salvano con «Salva»"].filter(Boolean).join(" · ")}
      classeCorpo="space-y-3"
      azioni={
        <Button type="button" onClick={() => onCambio(false)}>
          Fatto
        </Button>
      }
    >
      <SezioneFinestra titolo="Prezzo e incasso" classeCorpo="p-4">
        <div className={GRIGLIA}>
          <Campo etichetta="Prezzo finale di vendita (€)" obbligatorio>
            <Input
              type="number"
              className={CLASSI_CAMPO}
              value={form.payment?.prezzoFinaleVendita || 0}
              onChange={(e) => patchPagamento({ prezzoFinaleVendita: Number(e.target.value) })}
            />
          </Campo>
          {/*  "Già incassato", mai "acconto": alla consegna l'acconto è in cassa
              da settimane e chiamarlo così faceva credere che fosse un numero
              da ritirare. È lo stesso lessico delle pagine installazioni. */}
          <Campo etichetta="Già incassato (€)">
            <Input
              type="number"
              className={CLASSI_CAMPO}
              value={form.payment?.accontoPagato || 0}
              onChange={(e) => patchPagamento({ accontoPagato: Number(e.target.value) })}
            />
          </Campo>
          <Campo etichetta="Metodo di pagamento">
            <Input
              className={CLASSI_CAMPO}
              value={form.payment?.metodoPagamento || ""}
              placeholder="es. Bonifico, contanti, POS"
              onChange={(e) => patchPagamento({ metodoPagamento: e.target.value })}
            />
          </Campo>
          <Campo etichetta="Data dell'incasso">
            <Input
              type="date"
              className={CLASSI_CAMPO}
              value={form.payment?.dataPagamento || ""}
              onChange={(e) => patchPagamento({ dataPagamento: e.target.value })}
            />
          </Campo>
        </div>
      </SezioneFinestra>

      <SezioneFinestra
        titolo="Piano rate"
        nota="Il saldo si incassa in più volte, non tutto alla consegna"
        azioni={<Switch checked={rate} onCheckedChange={(v) => patchPagamento({ pianoRate: v })} />}
        classeCorpo="space-y-3 p-4"
      >
        {rate ? (
          <>
            <div className={GRIGLIA}>
              <Campo etichetta="Numero di rate">
                <Input
                  type="number"
                  min={1}
                  className={CLASSI_CAMPO}
                  value={form.payment?.numeroRate || 0}
                  onChange={(e) => patchPagamento({ numeroRate: Number(e.target.value) })}
                />
              </Campo>
              <Campo etichetta="Importo della rata (€)">
                <Input
                  type="number"
                  className={CLASSI_CAMPO}
                  value={form.payment?.importoRata || 0}
                  onChange={(e) => patchPagamento({ importoRata: Number(e.target.value) })}
                />
              </Campo>
              <Campo etichetta="Prossima scadenza" className="sm:col-span-2">
                <Input
                  type="date"
                  className={CLASSI_CAMPO}
                  value={form.payment?.prossimaScadenza || ""}
                  onChange={(e) => patchPagamento({ prossimaScadenza: e.target.value })}
                />
              </Campo>
            </div>
            {/* Un piano che non copre il saldo è l'errore più caro di tutti:
                si scopre all'ultima rata, quando mancano ancora soldi. L'avviso
                sta ATTACCATO ai campi, cioè dove nasce lo sbaglio. */}
            {copertura > 0 && saldo > 0 && copertura !== saldo && (
              <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                {numeroRate} rate da {eur(importoRata)} coprono {eur(copertura)} dei {eur(saldo)} da
                incassare.
              </NotaFinestra>
            )}
          </>
        ) : (
          <p className="text-[12px] text-slate-500">
            Spento: il saldo si incassa in una volta sola, alla consegna.
          </p>
        )}
      </SezioneFinestra>

      {/* I COSTI RESTANO RAGGIUNGIBILI
          Non servono alla consegna ma sono l'altra metà del profitto (che si
          legge già nella colonna di sinistra della scheda): si scrivono una
          volta, a fine pratica. */}
      <SezioneFinestra
        titolo="Costi"
        nota="Entrano nel calcolo del profitto, non nel saldo"
        classeCorpo="p-4"
      >
        <div className={GRIGLIA}>
          <Campo etichetta="Prodotto (€)">
            <Input
              type="number"
              className={CLASSI_CAMPO}
              value={form.payment?.costi?.costoProdotto || 0}
              onChange={(e) =>
                patchPagamento({
                  costi: { ...form.payment?.costi, costoProdotto: Number(e.target.value) },
                })
              }
            />
          </Campo>
          <Campo etichetta="Installazione (€)">
            <Input
              type="number"
              className={CLASSI_CAMPO}
              value={form.payment?.costi?.costoInstallatore || 0}
              onChange={(e) =>
                patchPagamento({
                  costi: { ...form.payment?.costi, costoInstallatore: Number(e.target.value) },
                })
              }
            />
          </Campo>
          <Campo etichetta="Taglio (€)">
            <Input
              type="number"
              className={CLASSI_CAMPO}
              value={form.payment?.costi?.costoTaglio || 0}
              onChange={(e) =>
                patchPagamento({
                  costi: { ...form.payment?.costi, costoTaglio: Number(e.target.value) },
                })
              }
            />
          </Campo>
        </div>
      </SezioneFinestra>

      <TornaAllaConsulenza form={form} update={update} onFatto={() => onCambio(false)} />
    </Finestra>
  );
}

/* ── IL RITORNO INDIETRO ───────────────────────────────────────────────────
   Sta in fondo alla finestra degli importi, perché è lì che nasce l'errore: si
   registra un incasso sulla scheda sbagliata e ci si accorge subito dopo.
   Chiede conferma una volta sola e dice esattamente cosa fa. Capita una volta
   al mese: non merita tre elementi in fondo alla scheda di ogni giorno. */
function TornaAllaConsulenza({
  form,
  update,
  onFatto,
}: {
  form: LeadData;
  update: <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;
  /** chiude la finestra degli importi: la scheda che sta sotto non parla più
   *  di consegna, e restare su un modulo di importi non avrebbe senso */
  onFatto: () => void;
}) {
  const [conferma, setConferma] = useState(false);
  const statoDestinazione = statoRitornoConsulenza(form);

  const annulla = () => {
    const prezzo = form.payment?.prezzoFinaleVendita || form.payment?.prezzoTotale || 0;
    update("payment", {
      ...form.payment,
      accontoPagato: 0,
      saldoRimanente: prezzo,
      statoPagamento: "nessun_pagamento",
      dataPagamento: undefined,
    });
    update("stato", statoDestinazione);
    //  La data di conversione va tolta: se resta, la vendita sbagliata continua
    //  a pesare sul giorno in cui era stata registrata in tutte le statistiche,
    //  e a una chiusura vera più avanti verrebbe attribuita la data vecchia.
    update("convertedAt", undefined);
    setConferma(false);
    onFatto();
    toast.success("Incasso annullato", {
      description: "La scheda torna alla consulenza. Ricordati di salvare.",
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="min-w-0 text-[11.5px] text-slate-500">
        Incasso registrato per errore? La scheda torna alla consulenza e gli importi si azzerano.
      </p>
      {!conferma ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConferma(true)}
          className="shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
          Annulla l&apos;incasso
        </Button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11.5px] text-slate-600">
            Torna a «{statoDestinazione === "fatto" ? "Consulenza svolta" : "Appuntamento fissato"}
            »?
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setConferma(false)}>
            No
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={annulla}>
            Sì, annulla
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── 4 · LE NOTE DELLA CONSULENZA ──────────────────────────────────────────
   Sono ciò che il cliente ha chiesto in chiamata: si leggono una volta, di
   solito la prima volta che si apre la pratica. Un'area di testo alta quattro
   righe sempre aperta — la terza della finestra, dopo le note della posa e le
   note della trattativa — allungava la scheda per un contenuto che si guarda e
   si lascia lì. Qui si vedono le prime due righe e si apre chi vuole scrivere. */
function NoteConsulenza({
  form,
  update,
}: {
  form: LeadData;
  update: <K extends keyof LeadData>(k: K, v: LeadData[K]) => void;
}) {
  const [aperte, setAperte] = useState(false);
  const testo = form.notePostCall || "";

  return (
    <SezioneFinestra
      titolo="Note della consulenza"
      azioni={
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setAperte((v) => !v)}
        >
          {aperte ? "Chiudi" : testo ? "Apri" : "Scrivi"}
        </Button>
      }
      classeCorpo="p-4"
    >
      {/*  Senza note e con l'area chiusa non c'è corpo: una riga che dice
          "Nessuna nota" occupa lo stesso spazio delle note e non ne fa le veci
          — il pulsante «Scrivi» qui accanto dice già tutto. */}
      {aperte ? (
        <Textarea
          rows={4}
          className={CLASSI_AREA}
          placeholder="Cosa è stato detto in chiamata, richieste particolari, promesse fatte"
          value={testo}
          onChange={(e) => update("notePostCall", e.target.value)}
        />
      ) : testo ? (
        <p className="line-clamp-2 whitespace-pre-line text-[12px] leading-snug text-slate-600">
          {testo}
        </p>
      ) : null}
    </SezioneFinestra>
  );
}
