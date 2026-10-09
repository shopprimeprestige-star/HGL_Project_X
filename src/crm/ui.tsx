/** ─────────────────────────────────────────────────────────────────────────
 *  ui.tsx — I MATTONI CONDIVISI DEL CRM
 *
 *  PERCHÉ QUESTO FILE ESISTE
 *  Prima ogni pagina si disegnava le proprie card, i propri titoli e i propri
 *  badge di stato: stesso concetto, dieci resa diverse. Il costo non è estetico,
 *  è di lettura — se "venduto" è verde in una pagina e blu in un'altra, chi
 *  guarda deve ri-imparare i colori ad ogni schermata invece di riconoscerli.
 *  Qui il linguaggio visivo è definito UNA volta e importato ovunque.
 *
 *  REGOLE DEL LINGUAGGIO VISIVO (valgono per tutte le pagine)
 *   · Raggi:      schede e riquadri numerici rounded-xl · pastiglia di stato e
 *                 controlli rounded-md · filtri a segmento rounded-lg
 *   · Spaziature: pagina p-4 md:p-6 · dentro le schede px-3/px-4 py-2.5 ·
 *                 gap fra blocchi 4
 *   · Testo:      titolo pagina 1.25rem/600 · titolo blocco 13px/600 ·
 *                 numero grande 19px/600 tabular-nums · servizio 11–12px muted
 *   · Colore:     il colore porta SOLO informazione di stato. Niente decorazione.
 *                 Un tono = un significato (vedi TONI più sotto).
 *
 *  UNA SOLA FONTE PER GLI STATI
 *  Etichette e colori degli stati NON si ridefiniscono qui: arrivano da
 *  types.ts (LEAD_STATUS_LABEL, LEAD_STATUS_PHASE, LEAD_PHASE_COLOR). Questo
 *  file li riespone con nomi comodi. Averne due copie è già costato caro: la
 *  finestra ⌘K chiamava lo stesso lead "Da ricontattare" mentre l'elenco lo
 *  chiamava "Ricontatto fissato", e lo colorava di blu invece che di ambra.
 *  ───────────────────────────────────────────────────────────────────────── */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LEAD_PHASE_COLOR,
  LEAD_PHASE_DOT,
  LEAD_STATUS_COLOR,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_PHASE,
  eAppuntamento,
  eStatoNonSvolta,
  //  «La posa è stata fatta?» sta in types.ts e non qui: la stessa domanda la fa
  //  il modulo installazioni, che da qui importa già — chiedergli la regola
  //  chiuderebbe il cerchio, e ricopiarla è come si finisce con il badge del
  //  menu che conta una cosa e la pagina un'altra.
  posaFatta,
  type Lead,
  type LeadPhase,
  type LeadStatus,
} from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. TONI — l'unico posto dove si decide che colore ha un'informazione
   ═════════════════════════════════════════════════════════════════════════ */

/** I toni sono SIGNIFICATI, non colori: si sceglie "vinta", non "verde".
 *  Sono le stesse sei fasi della trattativa definite in types.ts — non un
 *  secondo elenco: due vocabolari di colore sullo stesso concetto tornano
 *  sempre a divergere. "neutro" in più serve ai riquadri che non parlano di
 *  una trattativa (conteggi, totali, righe di servizio). */
export type Tono = LeadPhase | "neutro";

/** Classi del chip (sfondo + testo + bordo). Tinte chiare: il CRM è su fondo
 *  bianco e i chip devono essere leggibili anche venti per riga in tabella. */
export const CLASSI_TONO: Record<Tono, string> = {
  ...LEAD_PHASE_COLOR,
  neutro: "bg-slate-500/10 text-slate-700 border-slate-500/25",
};

/** Pallino pieno: serve quando lo spazio non basta per il testo (liste dense,
 *  celle di calendario) e quando il chip è già dentro un blocco colorato. */
export const PUNTO_TONO: Record<Tono, string> = {
  ...LEAD_PHASE_DOT,
  neutro: "bg-slate-400",
};

/** Testo forte del tono: per numeri e importi, dove il chip sarebbe rumore. */
export const TESTO_TONO: Record<Tono, string> = {
  da_lavorare: "text-sky-700",
  in_corso: "text-indigo-700",
  in_sospeso: "text-amber-700",
  vinta: "text-emerald-700",
  persa: "text-rose-700",
  chiusa: "text-slate-700",
  neutro: "text-foreground",
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. STATI DEL LEAD — etichetta e tono arrivano da types.ts
   ═════════════════════════════════════════════════════════════════════════ */

/** Il tono di uno stato è la sua FASE: nessuna tabella parallela da tenere
 *  allineata a mano. */
export const TONO_STATO: Record<LeadStatus, Tono> = LEAD_STATUS_PHASE;

/** Le etichette sono quelle di types.ts, riesposte con il nome italiano usato
 *  in queste pagine. Restano un solo elenco. */
export const ETICHETTA_STATO: Record<LeadStatus, string> = LEAD_STATUS_LABEL;

/** ── LA FORMA DELLA PASTIGLIA DI STATO ────────────────────────────────────
 *  Lo stato compare in tre punti (elenco lead, riga dell'agenda, ricerca ⌘K) e
 *  in due dei tre si può premere per cambiarlo. Aveva tre forme diverse: qui
 *  la forma è una sola, e chi la vede sa già che si può premere.
 *  Il colore NON sta qui: si aggiunge con classiStato(stato). */
export const CLASSE_BADGE_STATO =
  "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium leading-5";

/** Etichetta di uno stato, con rete di sicurezza: se un giorno arriva dal DB
 *  uno stato che qui non è mappato, si mostra il valore grezzo invece di una
 *  cella vuota. */
export function etichettaStato(stato: LeadStatus | string | undefined | null): string {
  if (!stato) return "—";
  return LEAD_STATUS_LABEL[stato as LeadStatus] ?? String(stato);
}

/** Tono di uno stato, con fallback neutro. */
export function tonoStato(stato: LeadStatus | string | undefined | null): Tono {
  return LEAD_STATUS_PHASE[stato as LeadStatus] ?? "neutro";
}

/** Classi colore pronte per un badge di stato (per chi non usa <ChipStato/>). */
export function classiStato(stato: LeadStatus | string | undefined | null): string {
  return LEAD_STATUS_COLOR[stato as LeadStatus] ?? CLASSI_TONO.neutro;
}

/* ── L'ESITO DELL'APPUNTAMENTO ─────────────────────────────────────────────
   Sigla, nome e colore dell'esito stanno qui una volta sola: erano definiti due
   volte, con due sfumature di verde e due modi di scrivere "Non fatti".

   DUE ELENCHI, PERCHÉ SONO DUE COSE DIVERSE.
    · LENTI_ESITO — le TRE caselle con cui si LEGGE una giornata: svolte,
      clienti assenti, da riprogrammare. Sono conteggi e filtri, non gesti.
    · ESITI — i DUE pulsanti che si PREMONO per segnare com'è andata.

   Perché il terzo pulsante è SPARITO invece di diventare un "Svolta": un
   pulsante deve scrivere uno stato, e uno stato che voglia dire soltanto
   «svolta» non esiste più — era "fatto", ed è proprio quello che si è tolto.
   Segnare "Svolta" e poi il vero esito (venduto, in valutazione, ricontatto
   fissato) significava chiedere due volte la stessa cosa, ed è il motivo per
   cui i numeri non tornavano: chi segnava subito il venduto si vedeva sparire
   la consulenza dal totale del giorno. Ora la consulenza risulta svolta DA
   SOLA, non appena non è segnata assente o da riprogrammare; l'esito vero si
   sceglie nella pastiglia di stato accanto ai due pulsanti, che è lì da sempre
   e ha tutte le voci giuste. Rimarcare "svolta" per errore si annulla dalla
   stessa pastiglia. */
export const LENTI_ESITO = [
  {
    //  La chiave resta il valore storico "fatto": è un riferimento interno
    //  (conteggi, filtro salvato nell'indirizzo) e rinominarla romperebbe i
    //  collegamenti già in giro senza cambiare una parola a schermo. Il
    //  SIGNIFICATO però non è più «qualcuno ha premuto F»: è «la consulenza c'è
    //  stata», cioè tutto ciò che non è assente né da riprogrammare.
    stato: "fatto",
    sigla: "S",
    breve: "Svolte",
    nome: "Svolta",
    //  Non si preme per assegnarlo: si può solo guardarci dentro.
    assegnabile: false,
    spento: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:brightness-95",
    acceso: "border-emerald-600 bg-emerald-600 text-white",
  },
  {
    //  ── UNO SOLO DEI DUE STATI SOPRAVVIVE ──────────────────────────────
    //   "Consulenza non svolta" (non_fatto) e "Cliente assente" (no_show)
    //   descrivevano lo stesso fatto — l'incontro non c'è stato — con due
    //   parole diverse, e chi filtrava ne trovava DUE nell'elenco senza sapere
    //   quale scegliere. Da qui in avanti si scrive solo no_show; le schede
    //   vecchie con non_fatto continuano a esistere e vengono contate insieme
    //   a queste ovunque (vedi esitoDi, contaEsiti e il filtro delle
    //   trattative), quindi nessun dato storico si perde.
    stato: "no_show",
    sigla: "NF",
    breve: "Non svolte",
    assegnabile: true,
    //  "Cliente assente" e non "Consulenza non svolta": nel gruppo finiscono
    //  insieme chi non si è presentato (no_show) e chi non ha svolto la
    //  consulenza (non_fatto), e nove volte su dieci è la prima. Chiamarlo
    //  "consulenza" faceva pensare a un incontro avvenuto male invece che a
    //  un cliente che non c'era.
    nome: "Cliente assente",
    spento: "border-rose-300 bg-rose-50 text-rose-700 hover:brightness-95",
    acceso: "border-rose-600 bg-rose-600 text-white",
  },
  {
    stato: "da_spostare",
    sigla: "DS",
    breve: "Da riprogrammare",
    nome: "Da riprogrammare",
    assegnabile: true,
    spento: "border-amber-300 bg-amber-50 text-amber-700 hover:brightness-95",
    acceso: "border-amber-600 bg-amber-600 text-white",
  },
] as const;

/** Le tre chiavi d'esito, tipizzate: chi conta o filtra per esito usa questo
 *  invece di riscrivere l'unione a mano. Restano TRE anche se i pulsanti sono
 *  due: "svolte" continua a essere un numero da leggere, solo non è più un
 *  gesto da fare. */
export type ChiaveEsito = (typeof LENTI_ESITO)[number]["stato"];

/** ── I DUE PULSANTI CHE SI PREMONO ─────────────────────────────────────────
 *  Derivati dall'elenco qui sopra e non riscritti a mano: sigla, nome e colori
 *  devono restare gli stessi del riquadro che li conta, altrimenti il pulsante
 *  rosso e il totale rosso smettono di sembrare la stessa cosa.
 *  Chi mostra pulsanti d'esito (agenda, riquadro "Adesso", scheda del lead)
 *  cicla su QUESTO: così il terzo pulsante è sparito ovunque insieme, senza che
 *  nessuna schermata potesse restare indietro. */
export const ESITI = LENTI_ESITO.filter(
  (e): e is Extract<(typeof LENTI_ESITO)[number], { assegnabile: true }> => e.assegnabile,
);

/** ── LA TINTA DELLA RIGA ───────────────────────────────────────────────────
 *  Su un elenco di venti righe la pastiglia di stato si legge una alla volta:
 *  bisogna posare l'occhio su ognuna. La tinta della riga invece si vede tutta
 *  insieme, e serve a separare due cose che si somigliano ma vanno trattate al
 *  contrario:
 *
 *   · AMBRA = da riprogrammare. L'appuntamento non è perso, manca solo una data
 *     nuova: è lavoro che torna dentro l'agenda oggi stesso.
 *   · ROSA  = cliente assente / consulenza non svolta. È una perdita: si
 *     recupera con una telefonata, non con il calendario.
 *
 *  Prima erano tutte e due rosse e si finiva per trattare come persi anche gli
 *  appuntamenti che bastava rifissare.
 *  La tinta resta bassissima (fondo /60, filetto laterale 2px): un elenco con
 *  metà righe colorate a pieno campo stanca dopo dieci minuti, e il colore
 *  smette di essere un segnale. */
export function classiRigaStato(stato: LeadStatus | string | undefined | null): string {
  if (stato === "da_spostare")
    return "border-l-2 border-l-amber-400 bg-amber-50/60 hover:bg-amber-50";
  if (stato === "non_fatto" || stato === "no_show")
    return "border-l-2 border-l-rose-400 bg-rose-50/50 hover:bg-rose-50/80";
  //  Il filetto trasparente c'è anche sulle righe normali: senza, le righe
  //  colorate sarebbero larghe 2px più delle altre e l'elenco "ballerebbe".
  return "border-l-2 border-l-transparent hover:bg-muted/40";
}

/* ── QUANTO PESA LA GIORNATA ───────────────────────────────────────────────
   Il numero di appuntamenti di un giorno non è un'informazione neutra: dice se
   c'è spazio per recuperare un arretrato o se la giornata è già oltre il limite
   e qualcosa slitterà comunque. Il colore lo dice prima del numero.

   LE SOGLIE, e perché queste. Il centro lavora su una decina di consulenze al
   giorno; una consulenza occupa circa 45 minuti fra incontro, preventivo e
   note, e ogni giorno se ne aggiungono due o tre di recupero (assenti da
   richiamare, appuntamenti da rifissare).
    · fino a 6  → VERDE: giornata con margine, ci sta dentro anche l'arretrato;
    · da 7 a 11 → AMBRA: giornata piena. Non è un allarme — è la normalità —
      ma non entra altro senza togliere qualcosa;
    · da 12     → ROSSO: si sfora. Va saputo la mattina, quando si può ancora
      spostare qualcuno, non alle 18 quando si è già saltato il pranzo. */
export type CaricoGiornata = "leggero" | "pieno" | "sovraccarico";

const SOGLIA_PIENO = 7;
const SOGLIA_SOVRACCARICO = 12;

export function caricoGiornata(n: number): CaricoGiornata {
  if (n >= SOGLIA_SOVRACCARICO) return "sovraccarico";
  if (n >= SOGLIA_PIENO) return "pieno";
  return "leggero";
}

/** Pieno e testo bianco come gli altri badge numerici: a 18px una tinta chiara
 *  non si vede con la coda dell'occhio, e questo badge deve farsi notare mentre
 *  si guarda altrove. */
export const CLASSI_CARICO: Record<CaricoGiornata, string> = {
  leggero: "bg-emerald-600 text-white",
  pieno: "bg-amber-500 text-white",
  sovraccarico: "bg-rose-600 text-white",
};

/** Versione tenue, per quando il badge sta dentro un elemento già colorato
 *  (le pastiglie dei giorni) e il pieno diventerebbe una macchia. */
export const CLASSI_CARICO_TENUE: Record<CaricoGiornata, string> = {
  leggero: "bg-emerald-500/15 text-emerald-700",
  pieno: "bg-amber-500/20 text-amber-700",
  sovraccarico: "bg-rose-500/15 text-rose-700",
};

// ── NIENTE CONSIGLI SULLA GIORNATA ─────────────────────────────────────────
//  Qui c'era DESCRIZIONE_CARICO: tre frasi che commentavano la giornata, e la
//  terza diceva «giornata sovraccarica: conviene spostare qualcosa». Chi
//  organizza la giornata sa già quanto lavoro ha, e vedersi suggerire dal
//  programma di spostare un cliente è fastidioso — oltre che, quasi sempre,
//  impossibile. Restano il NUMERO e il COLORE, che informano senza dire cosa
//  fare: quello che serve per decidere c'è, il consiglio non serviva a nessuno.

/** Il conteggio degli appuntamenti di un giorno, colorato per carico.
 *  A zero non rende nulla: stessa regola di <Badge/> — uno "0" acceso occupa
 *  attenzione per dire che non c'è niente da fare. */
export function BadgeCarico({
  n,
  tenue,
  titolo,
  className,
}: {
  n: number | null | undefined;
  /** dentro un elemento già colorato: usa la versione a tinta bassa */
  tenue?: boolean;
  titolo?: string;
  className?: string;
}) {
  if (!n || n <= 0) return null;
  const carico = caricoGiornata(n);
  return (
    <span
      //  Il titolo dice QUANTI, non che cosa converrebbe fare: il commento sulla
      //  giornata è stato tolto apposta (vedi sopra).
      title={titolo ?? `${n} in agenda`}
      className={cn(
        "inline-flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5",
        "text-[11px] font-semibold leading-none tabular-nums",
        tenue ? CLASSI_CARICO_TENUE[carico] : CLASSI_CARICO[carico],
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. CHIP — l'informazione breve e colorata
   ═════════════════════════════════════════════════════════════════════════ */

export function Chip({
  tono = "neutro",
  punto,
  icona: Icona,
  className,
  children,
  ...resto
}: {
  tono?: Tono;
  /** mostra il pallino pieno prima del testo: utile nelle liste fitte */
  punto?: boolean;
  icona?: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5",
        "text-[11px] font-medium leading-5 whitespace-nowrap",
        CLASSI_TONO[tono],
        className,
      )}
      {...resto}
    >
      {punto && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PUNTO_TONO[tono])} />}
      {Icona && <Icona className="h-3 w-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Il chip dello stato lead: forma, etichetta e colore arrivano tutti da un
 *  posto solo, così nessuna pagina può disallinearsi. */
export function ChipStato({
  stato,
  className,
}: {
  stato: LeadStatus | string | undefined | null;
  className?: string;
}) {
  return (
    <span className={cn(CLASSE_BADGE_STATO, classiStato(stato), className)}>
      <span className="truncate">{etichettaStato(stato)}</span>
    </span>
  );
}

/** ── QUANTO MANCA ──────────────────────────────────────────────────────────
 *  La pastiglia del conto alla rovescia ("tra 25 min", "adesso", "in ritardo di
 *  10 min"). Il testo lo calcola l'agenda (attesaDi); qui c'è solo il vestito,
 *  perché la stessa frase compare nella riga dell'elenco e nel riquadro grande
 *  di "Adesso" e deve avere lo stesso colore in tutti e due.
 *  "Adesso" è l'unico caso a fondo pieno: è il momento in cui bisogna alzarsi. */
export type TonoAttesa = "ora" | "ritardo" | "attesa";

export const CLASSI_ATTESA: Record<TonoAttesa, string> = {
  ritardo: "border-rose-200 bg-rose-50 text-rose-700",
  ora: "border-sky-600 bg-sky-600 text-white",
  attesa: "border-sky-200 bg-sky-50 text-sky-700",
};

export function ChipAttesa({
  attesa,
  grande,
  className,
}: {
  attesa: { testo: string; tono: TonoAttesa } | null | undefined;
  /** nel riquadro "Adesso" si legge da un metro di distanza */
  grande?: boolean;
  className?: string;
}) {
  if (!attesa) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border font-semibold",
        grande ? "px-2 py-0.5 text-[12px]" : "px-1.5 py-px text-[10.5px]",
        CLASSI_ATTESA[attesa.tono],
        className,
      )}
    >
      {attesa.testo}
    </span>
  );
}

/** ── IL BADGE NUMERICO ─────────────────────────────────────────────────────
 *  Il contatore che sta accanto a una voce di menu o al titolo di una coda.
 *  Due regole, e nessuna delle due è di gusto:
 *
 *   · MAI A ZERO. Uno "0" occupa la stessa riga degli altri numeri, si legge
 *     con la stessa attenzione e solo dopo si scopre che non c'era niente da
 *     fare. Un menu con sei zeri accesi è un menu che si smette di guardare.
 *     Se non c'è lavoro, il badge non esiste: <Badge n={0}/> non rende nulla.
 *
 *   · IL COLORE DICE L'URGENZA, NON LA CATEGORIA. Rosa = dentro quel numero
 *     c'è del ritardo, ambra = scade oggi, grigio = è solo un conteggio.
 *     Sono le stesse due tinte di TONO_AZIONE: un numero rosa nel menu e una
 *     data rossa in fondo alla riga dicono la stessa identica cosa, e non c'è
 *     una seconda tavolozza da imparare.
 *
 *  Il pieno (fondo saturo, testo bianco) invece della tinta chiara dei chip è
 *  voluto: a 18 px il contrasto di un chip tenue non si vede con la coda
 *  dell'occhio, e un badge che non si nota mentre si guarda altrove non serve. */
/** ── I QUATTRO COLORI, E COSA VOGLIONO DIRE ───────────────────────────────
 *  · `ritardo` rosso — è già passato, e non l'ha fatto nessuno;
 *  · `oggi` ambra — tocca oggi, c'è ancora tempo ma la giornata è quella;
 *  · `pronto` verde — è tutto a posto ed è per oggi: non c'è niente da
 *    decidere, solo da eseguire. È il colore delle pose già programmate per
 *    oggi e delle spedizioni pronte a partire;
 *  · `info` grigio — un numero che non chiede niente adesso.
 *  ⚠️ Verde e ambra insieme sulla stessa famiglia NON sono decorazione: sono
 *   la differenza fra «da programmare» (una decisione da prendere, ambra) e
 *   «programmato» (un lavoro da fare, verde). Chi passa davanti al menu deve
 *   poter distinguere le due cose senza leggere le parole. */
export type UrgenzaBadge = "ritardo" | "oggi" | "pronto" | "info";

export const CLASSI_BADGE: Record<UrgenzaBadge, string> = {
  ritardo: "bg-rose-600 text-white",
  oggi: "bg-amber-500 text-white",
  pronto: "bg-emerald-600 text-white",
  info: "bg-slate-500/15 text-slate-700",
};

/** Il badge ridotto a un punto: quando la barra è chiusa a sole icone il
 *  numero non ci sta, ma "qui c'è qualcosa e di che colore" deve restare. */
export const PUNTO_BADGE: Record<UrgenzaBadge, string> = {
  ritardo: "bg-rose-600",
  oggi: "bg-amber-500",
  pronto: "bg-emerald-600",
  info: "bg-slate-400",
};

export function Badge({
  n,
  urgenza = "info",
  /** spiegazione a comparsa: un numero da solo è un indovinello */
  titolo,
  /** Al posto della cifra, e acceso anche a zero: vedi `testo` in ContoBadge. */
  testo,
  className,
}: {
  n: number | null | undefined;
  urgenza?: UrgenzaBadge;
  titolo?: string;
  testo?: string;
  className?: string;
}) {
  if (!testo && (!n || n <= 0)) return null;
  return (
    <span
      title={titolo}
      className={cn(
        "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1",
        "text-[10.5px] font-semibold leading-none tabular-nums",
        CLASSI_BADGE[urgenza],
        className,
      )}
    >
      {/*  Oltre il centinaio la cifra esatta non cambia la decisione (si apre
          comunque la pagina) ma allarga la riga: si tronca. */}
      {testo ?? (Number(n) > 99 ? "99+" : n)}
    </span>
  );
}

/** ── FILTRO A SEGMENTO ─────────────────────────────────────────────────────
 *  Il pulsante "acceso/spento" che si usa per i gruppi, per il consulente e per
 *  i motivi dell'arretrato. Era ricopiato in quattro punti con quattro raggi
 *  diversi: qui è uno solo, con il conteggio sempre nello stesso posto — perché
 *  il numero accanto al filtro è quello che fa decidere se premerlo. */
export function Segmento({
  attivo,
  onClick,
  conteggio,
  titolo,
  disabilitato,
  className,
  children,
}: {
  attivo?: boolean;
  onClick: () => void;
  conteggio?: number;
  /** spiegazione a comparsa: il nome corto basta a chi lavora, non a chi impara */
  titolo?: string;
  /** ── QUANDO CAMBIARE FILTRO SAREBBE UN DANNO ────────────────────────────
   *  Facoltativo, e quasi sempre non serve: un filtro si preme e basta. Serve
   *  dove sotto sta lavorando una scrittura di gruppo a lotti (lead importati):
   *  cambiare la fetta di elenco mentre si scrivono trecento righe fa sparire
   *  la barra che porta il contatore — resta una pagina con tutti i comandi
   *  spenti e niente che dica perché — e fa perdere la promessa che le righe
   *  rifiutate restino selezionate, perché la selezione si ricalcola su ciò che
   *  si vede. Spento è meglio che finto: il gesto torna appena il lavoro
   *  finisce, che sono pochi secondi. */
  disabilitato?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titolo}
      aria-pressed={attivo}
      disabled={disabilitato}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition",
        attivo
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
        disabilitato && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {conteggio !== undefined && (
        <span
          className={cn(
            "rounded px-1 text-[11px] font-semibold tabular-nums",
            attivo ? "bg-background/20" : "bg-muted text-muted-foreground",
          )}
        >
          {conteggio}
        </span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. STRUTTURA DELLA PAGINA — Pagina · Titolo · BarraAzioni · Scheda
   ═════════════════════════════════════════════════════════════════════════ */

/** Contenitore di pagina: esiste solo per avere lo stesso margine ovunque.
 *  Senza, ogni pagina sceglie il suo padding e passare da una all'altra fa
 *  "saltare" il contenuto. */
export function Pagina({
  children,
  className,
  larga,
}: {
  children: ReactNode;
  className?: string;
  /** true = niente limite di larghezza (tabelle e calendari lo vogliono) */
  larga?: boolean;
}) {
  //  p-4 md:p-6 è la misura che usano già dodici pagine del CRM (agenda, KPI,
  //  pipeline, impostazioni…). Le pagine rifatte partivano da p-3 md:p-5: il
  //  contenuto "saltava" di qualche pixel a ogni cambio pagina, che è il modo
  //  più silenzioso di far sembrare due schermate due prodotti diversi.
  return (
    <div className={cn("p-4 md:p-6", !larga && "mx-auto w-full max-w-[1400px]", className)}>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

/** Intestazione di pagina. La `nota` risponde alla domanda "cosa mi dice questa
 *  schermata", non descrive la funzione: chi la usa ogni giorno sa già cos'è. */
export function Titolo({
  testo,
  nota,
  icona: Icona,
  azioni,
  className,
}: {
  testo: string;
  nota?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  azioni?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icona && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
            <Icona className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold leading-tight tracking-tight">
            {testo}
          </h1>
          {nota && <p className="mt-0.5 text-[12px] text-muted-foreground">{nota}</p>}
        </div>
      </div>
      {azioni && <div className="flex flex-wrap items-center gap-2">{azioni}</div>}
    </div>
  );
}

/** Barra dei comandi della pagina (filtri, ricerca locale, pulsanti).
 *  È `sticky`: con 850 trattative si scorre molto, e i filtri devono restare
 *  raggiungibili senza tornare in cima. */
export function BarraAzioni({
  children,
  className,
  fissa = true,
}: {
  children: ReactNode;
  className?: string;
  fissa?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2",
        fissa && "sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-card/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Separatore verticale dentro la BarraAzioni: raggruppa i comandi affini
 *  senza costringere a un menu. */
export function SepBarra({ className }: { className?: string }) {
  return <span className={cn("mx-0.5 h-5 w-px shrink-0 bg-border", className)} />;
}

/** La scheda: un blocco = una domanda. Il titolo è opzionale perché a volte
 *  il contenuto (una tabella) si spiega da solo e l'intestazione è solo rumore. */
export function Scheda({
  titolo,
  nota,
  azioni,
  icona: Icona,
  className,
  classeCorpo,
  senzaPadding,
  children,
}: {
  titolo?: ReactNode;
  nota?: ReactNode;
  azioni?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  className?: string;
  classeCorpo?: string;
  /** per tabelle a filo bordo */
  senzaPadding?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      {(titolo || azioni) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icona && <Icona className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              {titolo && (
                <h2 className="truncate text-[13px] font-semibold leading-tight">{titolo}</h2>
              )}
              {nota && <p className="truncate text-[11px] text-muted-foreground">{nota}</p>}
            </div>
          </div>
          {azioni && <div className="flex shrink-0 items-center gap-1.5">{azioni}</div>}
        </header>
      )}
      {children != null && (
        <div className={cn(!senzaPadding && "p-4", classeCorpo)}>{children}</div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. KPI — il numero che si legge in mezzo secondo
   ═════════════════════════════════════════════════════════════════════════ */

/** Riquadro numerico. `onClick` lo rende un filtro: cliccare il numero e vedere
 *  le righe che lo compongono è il passaggio più richiesto e va fatto in un clic. */
export function Kpi({
  etichetta,
  valore,
  nota,
  tono = "neutro",
  icona: Icona,
  onClick,
  attivo,
  className,
}: {
  etichetta: string;
  valore: ReactNode;
  nota?: ReactNode;
  tono?: Tono;
  icona?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  attivo?: boolean;
  className?: string;
}) {
  const Elemento = onClick ? "button" : "div";
  return (
    <Elemento
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left",
        onClick && "transition-colors hover:bg-accent/60 cursor-pointer",
        attivo && "ring-2 ring-primary/40 border-primary/40",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {Icona && <Icona className="h-3 w-3" />}
        <span className="truncate">{etichetta}</span>
      </span>
      <span
        className={cn(
          "truncate text-[19px] font-semibold leading-tight tabular-nums",
          tono !== "neutro" && TESTO_TONO[tono],
        )}
      >
        {valore}
      </span>
      {nota && <span className="truncate text-[11px] text-muted-foreground">{nota}</span>}
    </Elemento>
  );
}

/** Griglia di KPI: stesse colonne in tutte le pagine, così l'occhio trova il
 *  numero sempre nella stessa posizione. */
export function KpiRiga({
  children,
  className,
  colonne = 4,
}: {
  children: ReactNode;
  className?: string;
  colonne?: 2 | 3 | 4 | 5 | 6;
}) {
  const griglia: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
  };
  return <div className={cn("grid gap-2", griglia[colonne], className)}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. VUOTO — cosa si vede quando non c'è niente da vedere
   ═════════════════════════════════════════════════════════════════════════ */

/** Uno spazio vuoto senza spiegazione fa dubitare che la pagina sia rotta.
 *  Qui diciamo perché è vuoto e, quando ha senso, offriamo l'azione che lo
 *  riempie. */
export function Vuoto({
  titolo,
  testo,
  icona: Icona,
  azione,
  className,
}: {
  titolo: string;
  testo?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  azione?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center",
        className,
      )}
    >
      {Icona && (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background">
          <Icona className="h-4 w-4 text-muted-foreground" />
        </span>
      )}
      <p className="text-[13px] font-medium">{titolo}</p>
      {testo && <p className="max-w-md text-[12px] text-muted-foreground">{testo}</p>}
      {azione && <div className="mt-1">{azione}</div>}
    </div>
  );
}

/** Versione a una riga, per gli elenchi dentro una scheda già intestata: lì il
 *  riquadro tratteggiato di <Vuoto/> raddoppierebbe il bordo della scheda.
 *  Vive qui e non nella dashboard perché la stessa frase deve avere lo stesso
 *  aspetto in tutte le code (agenda, arretrati, installazioni). */
export function VuotoRiga({ testo }: { testo: string }) {
  return <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">{testo}</p>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. DETTAGLI RICORRENTI
   ═════════════════════════════════════════════════════════════════════════ */

/** Tasto della tastiera. Le scorciatoie vanno mostrate dove servono, altrimenti
 *  esistono solo per chi ha letto la documentazione (cioè nessuno). */
export function Tasto({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5",
        "font-sans text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Il nome del tasto modificatore di questo computer: "⌘" su Mac, "Ctrl"
 *  altrove. Parte da "⌘" e si corregge dopo il montaggio, perché durante il
 *  render sul server `navigator` non esiste e un valore diverso fra server e
 *  browser farebbe lampeggiare la scritta. */
export function useTastoComando(): string {
  const [tasto, setTasto] = useState("⌘");
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const mac = /mac|iphone|ipad/i.test(navigator.userAgent);
    setTasto(mac ? "⌘" : "Ctrl");
  }, []);
  return tasto;
}

/** Coppia etichetta/valore per le schede di dettaglio. */
export function Dato({
  etichetta,
  children,
  className,
}: {
  etichetta: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] text-muted-foreground">{etichetta}</div>
      <div className="truncate text-[13px] font-medium">{children ?? "—"}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. RICERCA GLOBALE — il contratto, non l'implementazione
   ═════════════════════════════════════════════════════════════════════════ */

/** La finestra di ricerca (⌘K) vive nel guscio (routes/CRM.tsx) perché deve
 *  restare montata mentre si cambia pagina. Qui c'è solo il "telecomando":
 *  qualunque pagina può aprirla o aprire una scheda lead senza sapere come è
 *  fatta e senza importare il guscio (che la importerebbe a sua volta). */
export interface ApiRicerca {
  /** apre la finestra di ricerca, eventualmente già compilata */
  apri: (query?: string) => void;
  /** apre direttamente la scheda di una trattativa, da qualunque pagina */
  apriLead: (leadId: string) => void;
  /** apre la scheda vuota per inserire una trattativa nuova */
  nuovaTrattativa: () => void;
}

const CtxRicerca = createContext<ApiRicerca | null>(null);

export function ProviderRicerca({ valore, children }: { valore: ApiRicerca; children: ReactNode }) {
  return <CtxRicerca.Provider value={valore}>{children}</CtxRicerca.Provider>;
}

/** Fuori dal guscio (login, pagine pubbliche) restituisce funzioni inerti:
 *  meglio un pulsante che non fa nulla di una pagina che va in errore. */
const RICERCA_INERTE: ApiRicerca = {
  apri: () => {},
  apriLead: () => {},
  nuovaTrattativa: () => {},
};

export function useRicerca(): ApiRicerca {
  return useContext(CtxRicerca) ?? RICERCA_INERTE;
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. FORMATTAZIONE — le stesse cifre ovunque
   ═════════════════════════════════════════════════════════════════════════ */

/** Euro senza decimali: gli importi del CRM sono a tre/quattro cifre e i
 *  centesimi occupano spazio senza aggiungere nulla. */
export const eur = (n: number | null | undefined) =>
  `€ ${(n || 0).toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;

/** Data breve "12 ago" / "12 ago 24" se l'anno non è quello corrente. */
export function dataBreve(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const stessoAnno = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    ...(stessoAnno ? {} : { year: "2-digit" }),
  });
}

/** ── «L'HA DETTO IL …» ─────────────────────────────────────────────────────
 *
 *  Richiesta del committente, dopo aver visto lo stato nuovo sulla scheda:
 *  «fai che si vede anche nella lista lead la data».
 *
 *  La data che le liste già mostravano è una sola: ENTRO QUANDO ha detto che
 *  si fa vivo (`dataRicontatto`, la scrive `prossimaAzione`). L'altra — il
 *  giorno in cui l'ha detto — stava solo dentro la scheda, e aprirla una per
 *  una è esattamente il gesto che una lista serve a evitare. Le due insieme
 *  sono l'unica cosa che fa decidere: «l'ha detto ieri e si fa vivo lunedì» e
 *  «l'ha detto a marzo e si fa vivo lunedì» sono due situazioni diverse.
 *
 *  ⚠️ SOLO SU QUELLO STATO. Su una riga qualunque sarebbe una data in più da
 *   leggere su ottocento righe, e le liste di questo CRM si reggono su quello
 *   che NON c'è scritto.
 *  ⚠️ UNA FRASE SOLA PER TUTTE LE LISTE: la scrivono l'elenco dei lead e
 *   quello dei lead importati, e due formati diversi per la stessa data si
 *   leggono come due date diverse. */
export function dettoIlInChiaro(d?: { stato?: string | null; ciRicontattaDettoIl?: string | null } | null): string {
  if (!d || d.stato !== "ci_ricontatta_lui") return "";
  const quando = dataBreve(d.ciRicontattaDettoIl);
  //  `dataBreve` risponde «—» su una data che non c'è o non si legge: lì non
  //  si scrive niente, perché «detto il —» è peggio del silenzio.
  return quando && quando !== "—" ? `detto il ${quando}` : "";
}

/** Solo cifre di un numero di telefono: serve a confrontare "+39 333 1234567"
 *  con "3331234567" senza che l'utente debba scrivere il formato giusto. */
export const soloCifre = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

/** Testo confrontabile: minuscolo e senza accenti, così "Nicolò" si trova
 *  scrivendo "nicolo". */
export { trovaNelLead } from "./ricerca-lead";

export const normalizza = (s: string | null | undefined) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Oggi in formato "2026-08-13", con l'orologio LOCALE.
 *  `new Date().toISOString()` lavora in UTC: d'estate, dopo le 22, restituisce
 *  gi\u00e0 il giorno dopo \u2014 e una pagina aperta la sera segnava "domani" come se
 *  fosse oggi. Tutte le date del CRM sono stringhe locali: si confrontano fra
 *  loro solo se nascono dallo stesso orologio. */
export const oggiIso = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Solo la parte data di un valore che potrebbe essere un ISO completo. */
export const soloData = (v?: string | null): string => (v ? String(v).slice(0, 10) : "");

/** Giorni di distanza da oggi: negativo = passato, 0 = oggi, positivo = futuro. */
/** ── "NON LO SO" NON È "OGGI" ──────────────────────────────────────────────
 *  Questa funzione restituiva 0 — cioè OGGI — quando la data non si riusciva a
 *  leggere. Sembra prudente e invece è il contrario: nell'archivio importato le
 *  date storte sono centinaia, e finivano tutte nel conto della giornata. Il
 *  badge "Oggi" del menu diceva 99+ quando gli appuntamenti veri erano dieci, e
 *  per lo stesso motivo il badge dei Lead — che conta i RITARDI — restava
 *  vuoto: quelle schede erano state dichiarate "di oggi" invece che "senza
 *  data". Un guasto solo, due sintomi opposti.
 *
 *  Adesso una data illeggibile vale NaN, che non è né oggi né in ritardo né
 *  futuro: chi conta la deve escludere, ed è quello che si vuole. */
export function giorniDaOggi(isoData: string): number {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const d = new Date(`${isoData}T00:00:00`);
  if (Number.isNaN(d.getTime())) return Number.NaN;
  return Math.round((d.getTime() - oggi.getTime()) / 86_400_000);
}

/** Comodità per i confronti: `giorniDaOggi` può dire "non lo so". */
export const dataLeggibile = (isoData: string) => !Number.isNaN(giorniDaOggi(isoData));

const FMT_GIORNO = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** La data detta in relazione a oggi. "14 ago" obbliga a fare il conto con il
 *  calendario; "in ritardo di 3 g" dice gi\u00e0 cosa fare. */
export function etichettaQuando(isoData: string, ora?: string): string {
  const g = giorniDaOggi(isoData);
  const d = new Date(`${isoData}T00:00:00`);
  //  Data illeggibile: si dice che non si sa, non si stampa "NaN" né si finge
  //  che sia oggi. Nell'archivio importato capita, ed è meglio una riga onesta
  //  di un numero inventato.
  if (Number.isNaN(g)) return ora ? `data da controllare · ${ora}` : "data da controllare";
  const quando =
    g === 0
      ? "oggi"
      : g === 1
        ? "domani"
        : g === -1
          ? "ieri"
          : g < 0
            ? `in ritardo di ${-g} g`
            : FMT_GIORNO.format(d);
  return ora ? `${quando} \u00b7 ${ora}` : quando;
}

const FMT_GIORNO_STRETTO = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

/** ── LA STESSA DATA, PER UNA RIGA STRETTA ─────────────────────────────────
 *
 *  Serve sul telefono, e non è un vezzo: nella riga del lead «in ritardo di
 *  23 g» occupa 108 punti dei 169 disponibili, e siccome non si accorcia mai
 *  (`shrink-0`, altrimenti diventerebbe «in rit…», che non dice niente) lascia
 *  61 punti a STATO e AZIONE messi insieme. Misurato: «Appuntamento fissato ·
 *  Consulenza» finiva a schermo come «Appu… · C…». Cioè la riga diceva l'ora
 *  del ritardo di una cosa di cui non si capiva né lo stato né che cosa fosse.
 *
 *  ⚠️ NON È UN SECONDO CALCOLO: il giorno lo conta `giorniDaOggi`, lo stesso
 *   di `etichettaQuando`. Cambia solo come si DICE — e se un domani cambiasse
 *   il modo di contare i giorni, cambierebbe per tutte e due insieme.
 *
 *  ⚠️ L'ORA SI TIENE SOLO DOVE SI AGISCE OGGI. Su un appuntamento di oggi o di
 *   domani l'ora è metà dell'informazione: senza, bisogna aprire la scheda. Su
 *   uno in ritardo di ventitré giorni l'ora non cambia niente a nessuno — e
 *   quei 40 punti valgono molto di più dati allo stato.
 *  ⚠️ E il giorno della settimana sparisce: «gio 12 set» e «12 set» portano a
 *   fare la stessa telefonata, ma il primo costa 24 punti in più. */
export function etichettaQuandoBreve(isoData: string, ora?: string): string {
  const g = giorniDaOggi(isoData);
  if (Number.isNaN(g)) return "data da controllare";
  if (g === 0) return ora ? `oggi \u00b7 ${ora}` : "oggi";
  if (g === 1) return ora ? `domani \u00b7 ${ora}` : "domani";
  if (g === -1) return "ieri";
  if (g < 0) return `${-g} g fa`;
  return FMT_GIORNO_STRETTO.format(new Date(`${isoData}T00:00:00`));
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   10. LA PROSSIMA AZIONE \u2014 la stessa risposta in tutte le pagine
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

/** \u2500\u2500 PERCH\u00c9 STA QUI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *  \u00abCosa devo fare con questa persona\u00bb \u00e8 la domanda che ci si fa davanti a ogni
 *  riga, in ogni pagina. Finch\u00e9 la risposta \u00e8 vissuta dentro l'elenco
 *  trattative, le altre pagine hanno mostrato lo stato \u2014 che dice dov'\u00e8 la
 *  pratica, non cosa fare \u2014 e il ritardo non si vedeva da nessuna parte: lo si
 *  scopriva riaprendo la scheda, cio\u00e8 troppo tardi. Calcolata qui, la stessa
 *  frase e lo stesso ritardo compaiono ovunque compaia un lead. */
export type TonoAzione = "ritardo" | "oggi" | "futuro" | "aperto" | "chiuso";

export interface Azione {
  /** Il gesto: "Consulenza", "Richiamo", "Installazione", "Prima chiamata"\u2026 */
  cosa: string;
  /** Quando, gi\u00e0 scritto in relazione a oggi. Vuoto se non c'\u00e8 una data. */
  quando: string;
  /** Lo stesso, per una riga stretta: vedi `etichettaQuandoBreve`. Sul telefono
   *  la forma lunga si mangia lo spazio dello stato e dell'azione, che sono le
   *  due cose per cui si guarda la riga. Vuoto quando lo \u00e8 anche `quando`. */
  quandoBreve: string;
  /** Il GIORNO vero, in ISO, e l'ora. ⚠️ Servono insieme al relativo, non al
   *  posto suo: «fra 3 giorni» non dice che giorno segnare in agenda, e
   *  «gio 12 set» costringe a fare il conto col calendario. Vuoti quando non
   *  c'è una data. */
  giorno: string;
  ora: string;
  /** Giorni di ritardo. 0 quando non c'\u00e8 una data o non \u00e8 ancora scaduta. */
  ritardo: number;
  /** Chiave di ordinamento: pi\u00f9 piccola = pi\u00f9 urgente (vedi ordinaPerUrgenza). */
  urgenza: number;
  tono: TonoAzione;
}

//  Le pratiche chiuse non hanno una prossima azione, anche quando si portano
//  dietro date vecchie: senza questa regola una vendita conclusa un anno fa
//  tornava in cima alle code "in ritardo di 400 g" e sommergeva il lavoro vero.
//  ⚠️ «ripensamento» sta qui dal giorno in cui nasce. Senza, un cliente che si
//  è tirato indietro avrebbe continuato a portarsi dietro la data del sollecito
//  dell'acconto e sarebbe rimasto in cima alle code «in ritardo» per sempre —
//  cioè il difetto che questa riga esiste per non fare.
const STATI_CHIUSI = new Set<LeadStatus>(["concluso", "annullato", "perdi_tempo", "ripensamento"]);

//  Scaglioni della chiave di urgenza: prima chi \u00e8 in ritardo (pi\u00f9 \u00e8 vecchio,
//  pi\u00f9 sale), poi oggi, poi i giorni futuri, poi chi non ha una data \u2014 c'\u00e8 da
//  fissarla, ma non scade oggi \u2014 e infine le pratiche chiuse.
const URGENZA_SENZA_DATA = 10_000;
const URGENZA_CHIUSA = 100_000;

/** ── IL GESTO SUCCESSIVO QUANDO NON C'È NESSUNA DATA ───────────────────────
 *  È il caso più frequente sulle liste appena importate, dove «cosa faccio»
 *  vale più di qualunque altra informazione.
 *  ⚠️ CI DEVONO ESSERE TUTTI GLI STATI CHE NON SONO CHIUSI. Uno stato che manca
 *   non dà errore: esce con un trattino e col tono «chiuso», cioè quella
 *   trattativa si legge come archivio e sprofonda in fondo a tutte le code.
 *   È già successo a «Appuntamento rifissato» e a «Visita in sede disdetta» —
 *   due schede vive che sparivano dall'occhio di chi doveva ridargli una data.
 *   La prova `proveDelGestoPerStato` adesso lo impedisce. */
export const AZIONE_PER_STATO: Partial<Record<LeadStatus, string>> = {
  da_contattare: "Prima chiamata",
  non_risponde: "Riprova a chiamare",
  segreteria: "Riprova a chiamare",
  richiamo: "Fissa il richiamo",
  appuntamento_fissato: "Fissa data e ora",
  //  Stato storico, non più assegnabile: sulle schede vecchie resta però la
  //  cosa giusta da dire — la consulenza c'è stata e manca il seguito.
  fatto: "Definisci il seguito",
  non_fatto: "Riprogramma",
  da_spostare: "Riprogramma",
  venduto: "Programma l'installazione",
  acconto: "Programma l'installazione",
  //  ── LE TRE CHIUSURE VINTE ───────────────────────────────────────────────
  //   Senza queste righe una vendita appena chiusa e ancora senza data usciva
  //   da qui con un trattino e il tono "chiuso": una pratica pagata si
  //   leggeva come archivio, cioè spariva dall'occhio di chi la deve
  //   programmare. Il gesto è lo stesso di "acconto" — dare un giorno — e per
  //   questo dice le stesse parole.
  //   ⚠️ Il pacco no: una spedizione non ha data né tecnico, e "programma
  //   l'installazione" manderebbe a cercare uno slot che non esiste.
  posa_in_sede: "Programma l'installazione",
  posa_a_domicilio: "Programma l'installazione",
  posa_da_spedire: "Prepara la spedizione",
  //  Non è un no: è una persona che non si riesce più a raggiungere, e il
  //  gesto è riprovare — non archiviare.
  irreperibile: "Riprova a raggiungerlo",
  in_attesa_acconto: "Sollecita l'acconto",
  viene_in_sede: "Fissa data in sede",
  gestire_in_chat: "In gestione via chat",
  sta_valutando: "Fissa il ricontatto",
  da_ricontattare: "Fissa il ricontatto",
  //  La cosa da fare non è chiamarlo: è aspettare fino alla data che ha detto
  //  lui — e se quel giorno passa, allora sì.
  ci_ricontatta_lui: "Aspetta che si faccia vivo",
  fissa_meet_dopo: "Fissa la consulenza",
  no_show: "Riprogramma",
  //  ⚠️ QUESTI DUE MANCAVANO, e non è che dicevano la cosa sbagliata: non
  //   dicevano niente. Uscivano col trattino e col tono «chiuso», cioè una
  //   scheda ancora viva finiva in fondo a ogni coda insieme alle pratiche
  //   archiviate. «Appuntamento rifissato» senza data è esattamente come
  //   «Appuntamento fissato» senza data: manca il giorno. E chi ha disdetto la
  //   visita in sede aspetta che gli si riproponga di passare — non un meet,
  //   che con lui non c'entra.
  appuntamento_rifissato: "Fissa data e ora",
  sede_disdetta: "Rifissa la visita",
};

/** Il gesto successivo per una trattativa, con il suo ritardo in giorni. */
export function prossimaAzione(l: Lead): Azione {
  const d = l.data;
  if (STATI_CHIUSI.has(d.stato)) {
    return {
      cosa: "Nessuna azione",
      quando: "",
      quandoBreve: "",
      giorno: "",
      ora: "",
      ritardo: 0,
      urgenza: URGENZA_CHIUSA,
      tono: "chiuso",
    };
  }

  //  Fra tutte le date fissate vince la prima che deve ancora arrivare; se sono
  //  tutte passate vince la pi\u00f9 vecchia, perch\u00e9 \u00e8 quella che sta facendo
  //  perdere la trattativa.
  const candidati = [
    { cosa: "Consulenza", data: soloData(d.dataMeeting), ora: d.oraMeeting },
    /*  ⚠️ LA PAROLA CAMBIA CON LO STATO: sulla stessa data, «Richiamo» dice
        che la telefonata la facciamo noi. Con «Ci ricontatta lui» la fa lui, e
        una coda che dice «Richiamo» a chi aveva chiesto di non essere
        richiamato fa fare esattamente la telefonata sbagliata. */
    {
      cosa: d.stato === "ci_ricontatta_lui" ? "Si fa vivo lui" : "Richiamo",
      data: soloData(d.dataRicontatto),
      ora: d.oraRicontatto,
    },
    { cosa: "Richiamo", data: soloData(d.callbackAt), ora: undefined },
    { cosa: "In sede", data: soloData(d.dataVieneInSede), ora: d.oraVieneInSede },
    {
      cosa: "Installazione",
      data: soloData(d.installazione?.dataInstallazione),
      ora: d.installazione?.orarioInstallazione,
    },
  ].filter((c) => !!c.data);

  if (candidati.length) {
    const futuri = candidati
      .filter((c) => giorniDaOggi(c.data) >= 0)
      .sort((a, b) => a.data.localeCompare(b.data));
    const scelto = futuri[0] ?? [...candidati].sort((a, b) => a.data.localeCompare(b.data))[0];
    const g = giorniDaOggi(scelto.data);
    return {
      cosa: scelto.cosa,
      quando: etichettaQuando(scelto.data, scelto.ora),
      quandoBreve: etichettaQuandoBreve(scelto.data, scelto.ora),
      giorno: scelto.data,
      ora: scelto.ora ?? "",
      ritardo: g < 0 ? -g : 0,
      //  La distanza in giorni \u00c8 gi\u00e0 la chiave di urgenza: negativa e tanto pi\u00f9
      //  bassa quanto pi\u00f9 la scadenza \u00e8 vecchia, 0 per oggi, positiva per il
      //  futuro. Un solo numero, nessuna tabella di pesi da mantenere.
      urgenza: g,
      tono: g < 0 ? "ritardo" : g === 0 ? "oggi" : "futuro",
    };
  }

  //  Nessuna data: lo stato dice comunque qual \u00e8 il gesto successivo. \u00c8 il caso
  //  pi\u00f9 frequente sulle liste appena importate, dove \u00abcosa faccio\u00bb vale pi\u00f9 di
  //  qualunque altra informazione (la tabella sta pi\u00f9 in alto, esportata).
  const cosa = AZIONE_PER_STATO[d.stato];
  if (!cosa)
    return {
      cosa: "\u2014",
      quando: "",
      quandoBreve: "",
      giorno: "",
      ora: "",
      ritardo: 0,
      urgenza: URGENZA_CHIUSA,
      tono: "chiuso",
    };
  return {
    cosa,
    quando: "",
    quandoBreve: "",
    giorno: "",
    ora: "",
    ritardo: 0,
    urgenza: URGENZA_SENZA_DATA,
    tono: "aperto",
  };
}

//  Rosa e ambra sono le stesse due tinte che il CRM usa per "persa" e "in
//  sospeso": una data scaduta e una data di oggi si riconoscono con lo stesso
//  colpo d'occhio delle pastiglie di stato, senza introdurre un rosso a parte.
export const TONO_AZIONE: Record<TonoAzione, string> = {
  ritardo: "text-rose-600",
  oggi: "text-amber-600",
  futuro: "text-muted-foreground",
  aperto: "text-muted-foreground",
  chiuso: "text-muted-foreground/60",
};

/** La prossima azione in una riga sola: gesto + quando, con il ritardo gi\u00e0
 *  colorato. Sta accanto al nome, non dentro la scheda: l'informazione che fa
 *  decidere non deve costare un clic. */
export function ChipAzione({
  lead,
  azione,
  className,
}: {
  lead?: Lead;
  /** gi\u00e0 calcolata, quando la riga la usa anche per ordinare */
  azione?: Azione;
  className?: string;
}) {
  const az = azione ?? (lead ? prossimaAzione(lead) : null);
  if (!az) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 text-[11.5px]", className)}>
      <span className={cn("truncate", az.tono === "chiuso" && TONO_AZIONE.chiuso)}>{az.cosa}</span>
      {/*  Il separatore si scrive come STRINGA, non come testo JSX: nel testo
           JSX una sequenza di escape non viene interpretata e finiva a schermo
           alla lettera, accanto alla prossima azione di ogni riga di ogni
           pagina. Dentro le graffe e' una stringa vera, e torna il punto. */}
      {az.quando && (
        <span className={cn("shrink-0 tabular-nums", TONO_AZIONE[az.tono])}>
          {"\u00b7"} {az.quando}
        </span>
      )}
    </span>
  );
}

/** \u2500\u2500 L'ORDINE GIUSTO \u00c8 QUELLO DELLE SCADENZE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *  L'ordine di inserimento risponde a \u00abcosa \u00e8 arrivato per ultimo\u00bb, che non \u00e8
 *  una domanda che qualcuno si fa: chi apre una lista vuole sapere cosa sta
 *  scadendo. A parit\u00e0 di urgenza ordina il cognome, cos\u00ec le righe restano
 *  ferme fra un aggiornamento e l'altro (una lista che si riordina da sola
 *  mentre la si lavora fa perdere il segno). */
export function ordinaPerUrgenza(leads: Lead[]): Lead[] {
  return [...leads]
    .map((l) => ({ l, u: prossimaAzione(l).urgenza }))
    .sort(
      (a, b) =>
        a.u - b.u ||
        `${a.l.data.cognome || ""} ${a.l.data.nome || ""}`.localeCompare(
          `${b.l.data.cognome || ""} ${b.l.data.nome || ""}`,
        ),
    )
    .map((x) => x.l);
}

/** Quante trattative hanno una scadenza gi\u00e0 passata: \u00e8 il numero che dice se
 *  una coda va aperta adesso o pu\u00f2 aspettare domani. */
export const contaInRitardo = (leads: Lead[]) =>
  leads.reduce((n, l) => n + (prossimaAzione(l).ritardo > 0 ? 1 : 0), 0);

/** \u2500\u2500 QUANTO RESTA DA INCASSARE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *  La cifra che conta il giorno della consegna non \u00e8 l'acconto gi\u00e0 preso: \u00e8
 *  quello che il cliente deve ancora dare. `saldoRimanente` viene tenuto
 *  allineato dal salvataggio, ma sulle pratiche vecchie e sugli import pu\u00f2
 *  mancare: qui si ricalcola dal prezzo finale, cos\u00ec il numero mostrato \u00e8 uno
 *  solo in tutto il CRM. */
export function saldoDaIncassare(l: Lead): number {
  const p = l.data.payment;
  if (!p) return 0;
  const finale = Number(p.prezzoFinaleVendita) || 0;
  const acconto = Number(p.accontoPagato) || 0;
  if (finale > 0) return Math.max(0, finale - acconto);
  return Math.max(0, Number(p.saldoRimanente) || 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. LE CODE DI OGGI — un solo posto dove si decide cosa è "da fare"
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ STANNO QUI ─────────────────────────────────────────────────────
 *  Il numero nel menu e le righe nella pagina devono essere LA STESSA COSA.
 *  Se il menu dice "Installazioni 3" e la pagina ne mostra 2, il badge non
 *  viene più creduto — e un badge di cui non ci si fida è peggio di nessun
 *  badge, perché continua a chiedere attenzione senza restituire informazione.
 *  Basta che succeda una volta.
 *  Per questo qui non ci sono conteggi ma SELEZIONI: la funzione restituisce
 *  le trattative, il menu ne conta la lunghezza e la pagina le elenca. Una
 *  regola sola, due usi, nessuna possibilità di divergere.
 *
 *  Le pratiche archiviate (chiuse, non interessate, non in target) restano
 *  fuori da tutte le code: non sono lavoro arretrato, sono storia. */

/** Le trattative che chiedono attenzione OGGI: la prossima azione scade oggi
 *  oppure è già scaduta.
 *  Chi non ha ancora una data non entra: c'è da fissarla, ma non è una
 *  scadenza di oggi — farla entrare qui riempirebbe il badge di lavoro che
 *  può aspettare, cioè lo renderebbe inutile. */
export function leadDiOggi(leads: Lead[]): Lead[] {
  return leads.filter((l) => {
    const t = prossimaAzione(l).tono;
    return t === "ritardo" || t === "oggi";
  });
}

/** ── LA GIORNATA IN SEDE STA SEPARATA DALL'ARRETRATO ───────────────────────
 *  Chi arriva OGGI e chi è passato senza che nessuno abbia registrato com'è
 *  andata sono due lavori diversi, e un numero solo che li somma è lo stesso
 *  difetto già corretto sul badge "Oggi": con l'archivio importato le visite
 *  rimaste aperte sono decine, quindi il badge avrebbe detto ogni giorno più o
 *  meno la stessa cifra — e un numero che non cambia non dice più niente sulla
 *  giornata. L'arretrato resta, ma nella frase al passaggio del mouse.
 *
 *  L'esito registrato chiude la partita: chi è già arrivato (o non si è
 *  presentato) non è più lavoro da fare, e il numero deve poter arrivare a
 *  zero quando la sede ha ricevuto tutti. Un badge che resta acceso fino a
 *  mezzanotte si smette di guardare.
 *
 *  Le stesse regole della pagina /CRM/sede (gruppi "Oggi in sede" e "Da
 *  chiudere"), così menu e pagina dicono la stessa cosa. */

/** Le visite in sede ANCORA APERTE, con la distanza in giorni già calcolata.
 *  Le due code qui sotto partono da questa lettura sola: stessi campi, stesse
 *  esclusioni, nessuna possibilità che "oggi" e "arretrato" contino due
 *  popolazioni diverse.
 *
 *  Tre esclusioni, e nessuna è di gusto:
 *   · la scheda senza `data` (import a metà) si salta prima di leggere
 *     qualunque campo, altrimenti la barra laterale muore e con lei la pagina;
 *   · l'esito registrato chiude la visita: è lavoro fatto, non lavoro da fare;
 *   · la data ILLEGGIBILE resta fuori da tutto. `giorniDaOggi` dice NaN, che
 *     non è né oggi né in ritardo: "non lo so" non deve finire in un conteggio
 *     del giorno, e nell'archivio importato quelle date sono centinaia.
 *
 *  L'esito vive nel JSON del lead (CampiSede, dichiarato in PannelloSede e non
 *  in types.ts): si legge con un accesso difensivo invece di importare quel
 *  file, perché PannelloSede importa già da questo e l'import inverso
 *  chiuderebbe il cerchio. */
function visiteSedeAperte(leads: Lead[]): { lead: Lead; giorni: number }[] {
  const aperte: { lead: Lead; giorni: number }[] = [];
  for (const l of Array.isArray(leads) ? leads : []) {
    const d = l?.data;
    if (!d || d.stato !== "viene_in_sede") continue;
    if ((d as { sedeEsito?: unknown }).sedeEsito) continue;
    const giorno = soloData(d.dataVieneInSede);
    if (!giorno) continue;
    const g = giorniDaOggi(giorno);
    if (Number.isNaN(g)) continue;
    aperte.push({ lead: l, giorni: g });
  }
  return aperte;
}

/** Chi è atteso in sede OGGI e non è ancora stato registrato: è il numero del
 *  badge "Viene in sede".
 *
 *  Nella pagina /CRM/sede sono le righe del gruppo "Oggi in sede" più quelle
 *  di oggi che, passata l'ora dell'appuntamento, scivolano in "Da chiudere":
 *  restano comunque persone di oggi da sistemare, e il badge non deve calare
 *  di uno alle 15:45 solo perché è passata l'ora. Cala quando si registra
 *  l'esito, cioè quando il lavoro è davvero finito. */
export function leadInSedeOggi(leads: Lead[]): Lead[] {
  return visiteSedeAperte(leads)
    .filter((v) => v.giorni === 0)
    .map((v) => v.lead);
}

/** Le visite dei GIORNI SCORSI rimaste senza esito: nessuno ha detto com'è
 *  andata, e ogni giorno che passa rende più difficile ricostruirlo. È
 *  arretrato, non lavoro di oggi: si racconta nella descrizione del badge, non
 *  nel numero. Nella pagina è il grosso del gruppo "Da chiudere". */
export function leadInSedeDaChiudere(leads: Lead[]): Lead[] {
  return visiteSedeAperte(leads)
    .filter((v) => v.giorni < 0)
    .map((v) => v.lead);
}

/** Tutto ciò che in sede chiede attenzione: la giornata più l'arretrato.
 *  Resta esportata perché è la selezione che serve a una pagina "cosa c'è di
 *  aperto in sede"; il badge invece usa le due code separate. */
export function leadInSedeDaSeguire(leads: Lead[]): Lead[] {
  return [...leadInSedeOggi(leads), ...leadInSedeDaChiudere(leads)];
}

/** Le installazioni di oggi ancora da fare.
 *  ⚠️ «FATTA» NON È PIÙ UNO STATO DEL LEAD, ed è la correzione di un guasto che
 *   sarebbe passato inosservato. Qui c'era scritto `stato !== "venduto"`, che
 *   era la stessa regola scritta a mano dentro `posaCompletata` del modulo
 *   installazioni — due copie, perché ui.tsx non può importare quel file (lui
 *   importa già da qui: si chiuderebbe il cerchio). Con le tre chiusure vinte
 *   di oggi quella copia si rompeva in tutti e due i versi: una posa APPENA
 *   ESEGUITA non è più "venduto", quindi il badge restava acceso per sempre; e
 *   una vendita appena chiusa non è "venduto" neanche lei, quindi il badge la
 *   contava fra le pose del giorno anche senza che nessuno l'avesse programmata.
 *   La regola sta adesso in `posaFatta` (crm/types.ts), che ui.tsx può
 *   importare senza cicli: badge del menu e pagina rispondono alla stessa riga.
 *  Gli stati chiusi restano fuori a parte: una pratica archiviata non è una
 *  posa da fare, comunque sia finita.
 *  ⚠️ È ANCHE L'INSIEME DA CUI PARTONO I BADGE DELLE LENTI («Nel nostro
 *  centro», «A domicilio», «Con driver»): CRMSidebar filtra QUESTE righe invece
 *  di rifarsi la giornata per conto suo, così i tre numeri sono per costruzione
 *  pezzi del numero di «Installazioni» e non possono sommare più del tutto. */
export function leadInstallazioniOggi(leads: Lead[]): Lead[] {
  const oggi = oggiIso();
  //  Letture difensive: questa selezione gira nella barra laterale, che sta
  //  sopra OGNI pagina del CRM. Una sola scheda arrivata dall'archivio senza
  //  `data` non deve far sparire il menu — e con lui tutto il resto.
  return (Array.isArray(leads) ? leads : []).filter((l) => {
    const d = l?.data;
    if (!d) return false;
    //  Confronto fra stringhe: una data illeggibile non è uguale a oggi, quindi
    //  resta fuori da sola. "Non lo so" non è "oggi".
    if (soloData(d.installazione?.dataInstallazione) !== oggi) return false;
    return !posaFatta(d) && !STATI_CHIUSI.has(d.stato);
  });
}

//  ── QUI C'ERA leadPoseDaProgrammare ─────────────────────────────────────────
//   Contava chi aveva già pagato e aspettava ancora una data, e serviva SOLO al
//   badge della voce «Agenda posa», che non esiste più (né la voce né la
//   pagina). Non è stata spostata altrove perché quella coda si guarda già,
//   con lo stesso criterio e sullo stesso insieme, dalla lente «Senza data»
//   dentro /CRM/installazioni: tenerne qui una seconda copia avrebbe voluto
//   dire due numeri diversi per la stessa domanda, che è esattamente il difetto
//   che tutto questo blocco di conteggi esiste per evitare.

/** ── L'APPUNTAMENTO CHE DEVE ANCORA SUCCEDERE ──────────────────────────────
 *  Vero quando sulla consulenza non è stato ancora registrato NESSUN esito,
 *  cioè quando c'è ancora qualcosa da fare.
 *
 *  IL CRITERIO NON SI RISCRIVE QUI: `eStatoNonSvolta` ed `eAppuntamento` stanno
 *  in types.ts e sono gli stessi che usano la pagina Oggi (esitoDi in
 *  MeetGiornalieri), i totali del giorno e i filtri dell'elenco lead. Copiarne
 *  qui l'elenco degli stati significherebbe avere due giornate diverse per lo
 *  stesso giorno, ed è già successo. Si importa la regola, non la si ricopia.
 *  MeetGiornalieri NON si può importare al contrario: quel file importa già da
 *  questo, e il cerchio si chiuderebbe.
 *
 *  Le tre uscite dal conto, che sono esattamente i tre modi di "smaltire" un
 *  appuntamento:
 *   · cliente assente / consulenza non svolta → eStatoNonSvolta;
 *   · da riprogrammare                        → eStatoNonSvolta;
 *   · svolta                                  → qualunque altro stato che non
 *     sia più un appuntamento in piedi (venduto, acconto, sta valutando,
 *     ricontatto fissato, viene in sede, non interessato…): «svolta» è un
 *     calcolo, non una spunta da mettere.
 *  Restano dentro solo l'appuntamento ancora fissato (o rifissato) e la scheda
 *  senza stato, che è una riga da guardare, non una consulenza già data. */
function senzaEsito(stato?: LeadStatus | string | null): boolean {
  if (!stato) return true;
  if (eStatoNonSvolta(stato)) return false;
  return eAppuntamento(stato);
}

/** ── I NUMERI DEL MENU ─────────────────────────────────────────────────────
 *  Le chiavi sono le voci della barra che possono avere un badge.
 *
 *  ⚠️ SONO DUE FAMIGLIE, E NON PER GUSTO: le prime quattro si contano QUI, le
 *  altre no — non ci possono stare. Le lenti delle pose («Nel nostro centro»,
 *  «A domicilio», «Da spedire», «Con driver») si decidono con `modoConsegna` e
 *  `conDriver`, che vivono in crm/spedizione.ts e in crm/InstallationScheduleDialog:
 *  DUE FILE CHE IMPORTANO GIÀ DA QUESTO. Importarli di qui chiuderebbe il
 *  cerchio, e il rimedio ovvio — ricopiare qui il criterio — è esattamente ciò
 *  che questo blocco di conteggi esiste per non fare: il badge del menu e la
 *  pastiglia della pagina si risponderebbero due numeri diversi al primo
 *  archivio storto. Quei quattro si contano quindi in CRMSidebar, che può
 *  importare le regole vere da dove stanno (vedi `conteggiPose` là). */
export type ChiaveConteggioLead = "oggi" | "trattative" | "sede" | "installazioni";

/** Le voci del gruppo delle pose: stesso badge, stessa forma, conto altrove
 *  (CRMSidebar). I nomi sono quelli delle lenti di /CRM/installazioni. */
export type ChiaveConteggioPosa =
  | "in_sede"
  | "a_domicilio"
  | "da_spedire"
  | "con_driver"
  //  ── I RITORNI NON SONO UN QUINTO MODO DI CONSEGNA ───────────────────────
  //   Sta qui perché è una lente di /CRM/installazioni come le altre quattro e
  //   il badge si conta insieme a loro, ma la domanda è un'altra: non «come
  //   arriva l'impianto» bensì «chi deve tornare». Il numero infatti non si
  //   calcola sulle pose in lavorazione — un cliente che torna fra tre
  //   settimane ha la posa chiusa da un pezzo — ma su tutti i lead.
  | "manutenzioni"
  /** ── LE POSE CHE NESSUNO HA ANCORA MESSO IN CALENDARIO ──────────────────
   *  Impianti pagati, senza una data. Non sono in ritardo — nessuno ha promesso
   *  niente — ma sono l'unica cosa di questa famiglia che richiede una
   *  DECISIONE invece che un'esecuzione, e per questo hanno un badge loro,
   *  ambra, separato dal verde di quelle già programmate.
   *  Finché stavano dentro il numero delle pose, una giornata vuota e cinque
   *  impianti fermi da programmare davano lo stesso menu spento. */
  | "da_programmare";

/** ── LE COSE DA FARE OGGI ──────────────────────────────────────────────────
 *  Sta fuori da `conteggiMenu` perché il suo numero non nasce dai soli lead:
 *  dentro ci sono anche le righe scritte a mano, che vivono in `app_config` e
 *  vanno lette a parte. Lo calcola CRMSidebar con `costruisciRighe`, cioè con
 *  la stessa funzione da cui la pagina fa nascere le sue righe.
 *  ⚠️ Qui c'era scritto che questa voce NON doveva avere un badge, per non
 *   mettere due numeri quasi uguali accanto a «Oggi». Il committente l'ha
 *   chiesto lo stesso, e la ragione regge: «Oggi» conta gli appuntamenti,
 *   questo conta i GESTI della giornata — chiamate, promesse scadute e note
 *   scritte a mano, che in «Oggi» non compaiono affatto. */
export type ChiaveConteggioDaFare = "dafare";

/** ── ⚠️ QUESTO BADGE NON CONTA DEL LAVORO, CONTA DEI GIORNI ───────────────
 *  Tutti gli altri badge di questa barra dicono «quante cose restano da
 *  fare», e scendono man mano che si lavora. Questo dice quanti GIORNI mancano
 *  alla prossima liquidazione IVA, e scende da solo: 90, 89, 88… Sono due cose
 *  diverse che si mostrano nello stesso posto, e chi tocca questa riga deve
 *  saperlo — «Contabilità 29» non vuol dire ventinove fatture da caricare.
 *  Il tooltip lo dice per esteso, ed è per questo che il tooltip qui non è un
 *  di più. Le regole del conto alla rovescia stanno in `crm/contabilita-scadenze`. */
export type ChiaveConteggioFiscale = "scadenza";

/** Tutto ciò che una voce di menu può chiedere come badge. */
export type ChiaveConteggio =
  | ChiaveConteggioLead
  | ChiaveConteggioPosa
  | ChiaveConteggioDaFare
  | ChiaveConteggioFiscale;

export interface ContoBadge {
  n: number;
  urgenza: UrgenzaBadge;
  /** frase pronta per il tooltip: dice COSA sono quei numeri */
  titolo: string;
  /** ── ⚠️ QUANDO IL NUMERO È ZERO MA IL BADGE DEVE RESTARE ACCESO ───────
   *  Serve al conto alla rovescia delle scadenze: 3, 2, 1, e poi… zero, cioè
   *  OGGI. Con la sola cifra il badge si spegneva proprio il giorno in cui
   *  contava — la regola «zero non si mostra» è giusta per le code di lavoro
   *  (niente da fare, niente da vedere) e sbagliata per una scadenza. */
  testo?: string;
}

/** «1 posa» / «3 pose»: il numero attaccato alla parola giusta. Esportata perché
 *  le frasi dei badge nascono in due posti (qui e in CRMSidebar, per le lenti
 *  delle pose) e devono suonare uguali — un tooltip che dice «1 pose» fa
 *  sembrare sciatto anche il numero che ha accanto. */
export const plurale = (n: number, uno: string, molti: string) => `${n} ${n === 1 ? uno : molti}`;

/** Tutti i conteggi della barra laterale in una chiamata sola.
 *  La sidebar si ridisegna a ogni cambio pagina e l'archivio è di ottocento
 *  trattative: `prossimaAzione` — la parte cara — si attraversa una volta, non
 *  una per voce di menu.
 *
 *  ── I BADGE CONTANO QUELLO CHE RESTA DA FARE ──────────────────────────────
 *  Richiesta del committente, ed è la sola lettura che rende utile un badge:
 *  man mano che si lavora il numero deve SCENDERE, e a giornata finita deve
 *  sparire. Sparire è l'informazione — dice «qui non c'è più niente», che è
 *  esattamente ciò che si vuole sapere passando davanti al menu alle 18.
 *  Un badge che conta tutto ciò che ESISTE invece resta fermo tutto il giorno,
 *  e un numero che non cambia mai si smette di guardare.
 *  Il TOTALE della giornata non si perde: è nella frase al passaggio del
 *  mouse, dove serve a chi programma il lavoro e non toglie forza al numero. */
export function conteggiMenu(leads: Lead[]): Record<ChiaveConteggioLead, ContoBadge> {
  let scadute = 0;
  //  ── "OGGI" CONTA LE CONSULENZE, NON TUTTE LE SCADENZE ────────────────────
  //   prossimaAzione guarda quattro date diverse — consulenza, richiamo, visita
  //   in sede, installazione — e chiamarle tutte "oggi" faceva dire 6 al badge
  //   quando gli appuntamenti erano 3. Peggio: chi viene in sede veniva contato
  //   DUE volte, qui e nel badge "Viene in sede", e i numeri del menu non
  //   tornavano con quelli delle pagine.
  //   Il criterio è lo stesso della pagina Oggi (MeetGiornalieri): un
  //   appuntamento è una scheda con la data di consulenza di oggi. Le altre
  //   scadenze hanno già il loro badge.
  //
  //   E LO STATO NON FILTRA PIÙ NIENTE. Qui si toglievano le schede chiuse
  //   (concluso, non interessato, perdi tempo): sembra prudenza e invece
  //   spostava il numero fuori da qualunque cifra della pagina. La pagina /CRM
  //   scrive in grande «N appuntamenti oggi» contando TUTTA la giornata, esito
  //   compreso, e "Non interessato" è l'esito di una consulenza che c'è stata,
  //   non una scheda da nascondere. Il menu diceva 5 e la pagina 6, e a quel
  //   punto non si crede più a nessuno dei due.
  //   E IL NUMERO È QUELLO CHE RESTA DA FARE, non tutta la giornata: appena si
  //   segna l'esito — svolta, cliente assente, da riprogrammare — la riga esce
  //   dal conto e il badge cala di uno. Il criterio è `senzaEsito` qui sopra,
  //   che legge la regola da types.ts: la stessa che usa il riquadro "Da fare
  //   oggi" della pagina Oggi, non una seconda copia (due copie della stessa
  //   regola diventano due giornate diverse, ed è già successo).
  //   Il TOTALE degli appuntamenti del giorno resta nella frase del tooltip,
  //   così chi programma la giornata non perde quel dato.
  //  La data di oggi con l'orologio LOCALE, presa dalla stessa oggiIso() che
  //  usano le code qui sopra: un solo "giorno" per tutti i conteggi. Rifarla a
  //  mano qui dentro copriva anche il nome della funzione con una stringa, e
  //  chi avesse scritto oggiIso() più sotto avrebbe trovato un errore a
  //  schermo invece di un numero.
  const giornoOggi = oggiIso();
  //  Tutti gli appuntamenti del giorno (il totale, per la frase) e quanti ne
  //  restano senza esito (il numero del badge).
  let inGiornata = 0;
  let daFareOggi = 0;
  //  Quante persone erano attese oggi in sede in tutto, esito compreso: il
  //  badge conta solo quelle ancora da ricevere, ma la frase deve poter dire
  //  com'era la giornata. Si conta qui dentro e non con una seconda passata:
  //  la barra si ridisegna a ogni cambio pagina.
  let sedeOggiTotale = 0;
  //  Le pose di oggi che risultano GIÀ CHIUSE: non entrano nel badge (non c'è
  //  più niente da fare) ma la pagina Installazioni le mostra ancora nella
  //  lente "Oggi", perché alle 18 serve sapere cosa è stato fatto in giornata.
  //  Dirlo nella descrizione è ciò che tiene insieme i due numeri: senza, chi
  //  vede 2 nel menu e 3 nella pagina pensa che uno dei due sbagli.
  let installazioniOggiChiuse = 0;
  for (const l of Array.isArray(leads) ? leads : []) {
    //  Scheda arrivata a metà dall'import: si salta PRIMA di leggerla. Senza
    //  questa riga prossimaAzione legge `l.data.stato` di un oggetto che non
    //  c'è, e la barra laterale — che sta sopra ogni pagina — muore insieme
    //  alla pagina che si sta guardando.
    const d = l?.data;
    if (!d) continue;
    if (prossimaAzione(l).tono === "ritardo") scadute += 1;
    const st = d.stato as LeadStatus | undefined;
    //  Confronto fra stringhe: una data illeggibile non è mai uguale a oggi,
    //  quindi le date storte dell'archivio importato restano fuori da sole —
    //  "non lo so" non è "oggi", e giorniDaOggi su quelle dice NaN.
    if (soloData(d.dataMeeting) === giornoOggi) {
      inGiornata += 1;
      if (senzaEsito(st)) daFareOggi += 1;
    }
    if (st === "viene_in_sede" && soloData(d.dataVieneInSede) === giornoOggi) {
      sedeOggiTotale += 1;
    }
    //  Stessa domanda del filtro qui sopra, e va fatta con la stessa riga: se
    //  il conteggio delle chiuse e l'elenco delle aperte usassero due criteri,
    //  il badge del menu direbbe un numero e la pagina ne mostrerebbe un altro.
    if (
      soloData(d.installazione?.dataInstallazione) === giornoOggi &&
      (posaFatta(d) || (!!st && STATI_CHIUSI.has(st)))
    ) {
      installazioniOggiChiuse += 1;
    }
  }

  //  ── LA SEDE: IL NUMERO È LA GIORNATA, L'ARRETRATO È LA FRASE ─────────────
  //   Il badge diceva "giornata + visite passate mai chiuse". Le due cose non
  //   si sommano: l'arretrato non arriva oggi in negozio, e sommandolo il
  //   numero non tornava mai con nessun riquadro della pagina /CRM/sede.
  //   Una lettura sola per tutte e due le cifre: sono la stessa selezione
  //   divisa in due, e rileggerla due volte è lavoro sprecato a ogni cambio
  //   pagina (la barra si ridisegna ogni volta).
  const sedeAperte = visiteSedeAperte(leads);
  const sedeOggi = sedeAperte.filter((v) => v.giorni === 0).length;
  const sedeDaChiudere = sedeAperte.filter((v) => v.giorni < 0).length;
  //  Le visite di oggi già chiuse: non stanno nel badge (il lavoro è fatto) ma
  //  servono a dire la giornata intera nella frase. Il massimo con zero è una
  //  rete: se un domani le due letture divergessero, meglio una frase senza
  //  quel pezzo che una frase con un numero negativo.
  const sedeChiuseOggi = Math.max(0, sedeOggiTotale - sedeOggi);
  const installazioni = leadInstallazioniOggi(leads).length;
  //  Le pose di oggi in tutto: quelle da fare più quelle già chiuse.
  const installazioniOggiTotali = installazioni + installazioniOggiChiuse;

  //  ── "OGGI" VUOL DIRE OGGI ────────────────────────────────────────────────
  //   Qui si sommavano le scadenze GIÀ PASSATE a quelle di giornata: con 843
  //   schede in archivio l'arretrato è di centinaia, quindi il badge diceva
  //   sempre 99+ anche in una giornata con dieci appuntamenti. Un numero che
  //   dice sempre la stessa cosa non è un'informazione, è un adesivo rosso.
  //   L'arretrato ha il suo posto — la voce "Lead", che ha il filtro "In
  //   ritardo" costruito sulla stessa prossimaAzione — e lì è utile perché ci
  //   si può lavorare sopra.

  return {
    oggi: {
      //  Quelle ancora da fare, non tutta la giornata: si smaltiscono e il
      //  numero cala, a giornata segnata il badge sparisce.
      n: daFareOggi,
      //  Sempre il tono "oggi": il numero conta SOLO la giornata, e colorarlo
      //  di rosso per un arretrato che non è dentro quel numero direbbe una
      //  cosa che il numero non dice.
      urgenza: "oggi",
      //  Le stesse parole della pagina Oggi (il riquadro "Da fare oggi" e il
      //  totale in grande sopra la giornata): il badge dice quante restano, la
      //  frase dice su quante. Senza il totale, chi programma la giornata
      //  perderebbe il dato che gli serve — e vedere «2» a metà pomeriggio
      //  senza sapere che gli appuntamenti erano 9 racconta una giornata
      //  diversa da quella vera.
      //  L'arretrato NON sta qui: prima ci stava con un rimando al riquadro
      //  "Da recuperare", che però conta un'altra cosa (solo appuntamenti
      //  passati senza esito, assenti e da rifissare), quindi il rimando
      //  mandava a un numero che non tornava mai. Ora l'arretrato è scritto
      //  sulla voce "Lead", dove il filtro "In ritardo" usa esattamente questo
      //  conteggio.
      titolo: !inGiornata
        ? "Nessun appuntamento oggi"
        : daFareOggi
          ? `${plurale(daFareOggi, "appuntamento ancora da segnare", "appuntamenti ancora da segnare")} su ${plurale(inGiornata, "appuntamento", "appuntamenti")} di oggi`
          : `${plurale(inGiornata, "appuntamento", "appuntamenti")} oggi, tutti segnati`,
    },
    //  L'elenco Lead non mostra NESSUN numero (`n: 0`, e il badge a zero non
    //  viene disegnato): non è una coda di lavoro ma l'archivio completo, e un
    //  numero perennemente a tre cifre accanto a una voce di menu smette di
    //  essere letto — anzi, toglie forza ai badge che invece vanno guardati.
    //  Il conteggio serve lo stesso: è la frase al passaggio del mouse, cioè
    //  l'unico posto dove l'arretrato è scritto (vedi CRMSidebar).
    trattative: {
      n: 0,
      urgenza: "ritardo",
      //  Stesso conteggio del filtro "In ritardo" della pagina Lead: entrambi
      //  chiedono a prossimaAzione, quindi la frase del menu e il numero della
      //  pastiglia non possono dire due cose diverse.
      titolo: scadute
        ? `${plurale(scadute, "lead", "lead")} con la scadenza già passata`
        : "Nessun lead in ritardo",
    },
    //  Si accende quando qualcuno deve venire OGGI, e si spegne quando sono
    //  stati tutti ricevuti: è la giornata della sede, non lo storico.
    //  Sempre ambra — "manca un passaggio" — anche se dentro la giornata c'è
    //  chi è già passato senza esito: colorare di rosa per l'arretrato
    //  direbbe una cosa che il numero non contiene, ed è l'errore appena
    //  corretto sul badge "Oggi".
    sede: {
      n: sedeOggi,
      urgenza: "oggi",
      //  "dei giorni scorsi" e non "passate": nel numero ci sono anche le
      //  visite di OGGI di cui è già passata l'ora, e "visite passate" avrebbe
      //  lasciato credere che stiano nella seconda cifra invece che nella
      //  prima. Sulla pagina quelle righe si trovano sotto "Da chiudere"
      //  insieme all'arretrato: è l'unica differenza fra menu e pagina, ed è
      //  voluta — il badge non deve calare di uno alle 15:45 solo perché è
      //  passata l'ora dell'appuntamento.
      //  Il totale della giornata (visite chiuse comprese) sta nella frase: il
      //  badge cala a ogni esito registrato, ma «quante ne erano previste» è il
      //  dato che serve a chi organizza la sede.
      titolo: `${
        sedeOggi
          ? `${plurale(sedeOggi, "cliente ancora atteso", "clienti ancora attesi")} in sede oggi su ${plurale(sedeOggiTotale, "visita", "visite")} in giornata`
          : sedeChiuseOggi
            ? `Ricevuti tutti: ${plurale(sedeChiuseOggi, "visita chiusa", "visite chiuse")} oggi`
            : "Nessuno atteso oggi in sede"
      }${
        sedeDaChiudere
          ? ` · ${plurale(sedeDaChiudere, "visita", "visite")} dei giorni scorsi da chiudere`
          : ""
      }`,
    },
    //  Sono per definizione di oggi: ambra, mai rosa.
    installazioni: {
      n: installazioni,
      //  ── VERDE, NON AMBRA ────────────────────────────────────────────────
      //   Queste pose una data ce l'hanno già: non c'è niente da decidere,
      //   solo da eseguire. L'ambra resta a «Da programmare», che è la voce
      //   accanto e chiede una decisione — ed è la differenza che si deve
      //   poter leggere col colore, senza fermarsi a leggere le parole.
      urgenza: "pronto",
      //  La frase si legge anche a badge spento, quindi lo zero va detto a
      //  parole: "0 installazioni da fare oggi" si legge peggio di "Nessuna".
      //  Anche qui il totale del giorno sta nella frase: il badge dice quante
      //  restano — e a fine giornata sparisce — mentre «quante pose c'erano»
      //  resta leggibile per chi la giornata la programma.
      titolo: `${
        installazioni
          ? `${plurale(installazioni, "installazione ancora da fare", "installazioni ancora da fare")} oggi su ${plurale(installazioniOggiTotali, "posa", "pose")} in giornata`
          : installazioniOggiTotali
            ? `Fatte tutte: ${plurale(installazioniOggiTotali, "posa", "pose")} oggi`
            : "Nessuna installazione da fare oggi"
      }${
        //  La differenza fra il badge e la pagina va detta, ma solo finché c'è
        //  ancora un numero acceso da spiegare: a giornata finita la frase «N
        //  pose oggi» dice già tutto, e ripetere che sono chiuse è rumore.
        installazioni && installazioniOggiChiuse
          ? installazioniOggiChiuse === 1
            ? " · 1 già chiusa, la pagina la mostra ancora"
            : ` · ${installazioniOggiChiuse} già chiuse, la pagina le mostra ancora`
          : ""
      }`,
    },
  };
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   11. LAVORARE SU PI\u00d9 RIGHE INSIEME
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

/** ── LA BARRA DELLA SELEZIONE ──────────────────────────────────────────────
 *  Compare in basso quando qualcosa è selezionato, e porta le azioni di gruppo.
 *
 *  ── ⚠️ RIFATTA: ERA UN RIQUADRO BIANCO SU UNO SFONDO BIANCO ───────────────
 *  Stessa carta della pagina, stesso bordo grigio di ogni altra scheda: per
 *  accorgersi che era comparsa bisognava guardarla. Adesso è SCURA, ed è
 *  l'unica cosa scura della schermata — non è gusto, è il modo di dire «sei
 *  entrato in una modalità diversa, adesso i comandi agiscono su venti righe
 *  invece che su una». Il contrasto è l'informazione.
 *
 *  ⚠️ IL NUMERO È GRANDE E STA PER PRIMO. È l'unica cosa che chi sta per
 *   premere «elimina» deve leggere: su quante righe sto per agire. Prima era
 *   una scritta da dodici pixel accanto alle altre.
 *
 *  ⚠️ La X sta in fondo e STACCATA dalle azioni: è l'unico comando che non fa
 *   niente ai dati, e in mezzo agli altri diventava il vicino di casa di
 *   «elimina» — due bersagli attaccati sono un errore che aspetta. */
/** ── I PULSANTI DENTRO LA BARRA SCURA ──────────────────────────────────────
 *  Su fondo scuro un pulsante «outline» sparisce: il suo contorno è grigio
 *  chiaro e il suo testo è scuro. Questa è la classe da mettere alle azioni che
 *  ci vanno dentro, ed è qui e non ricopiata in ogni pagina perché la barra e i
 *  suoi pulsanti sono la stessa decisione.
 *  ⚠️ Un'azione DISTRUTTIVA non usa questa: usa il rosso chiaro
 *   (`text-rose-300 hover:bg-rose-500/20`), perché in fondo alla barra deve
 *   distinguersi da quelle che si premono tutti i giorni. */
export const CLASSE_AZIONE_BARRA =
  "h-8 text-[12.5px] text-white hover:bg-white/10 hover:text-white";

export function BarraSelezione({
  conteggio,
  onAnnulla,
  children,
  className,
}: {
  conteggio: number;
  onAnnulla: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (conteggio <= 0) return null;
  return (
    <div
      className={cn(
        "sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2",
        "rounded-2xl border border-white/10 bg-slate-900 px-2.5 py-2 text-white shadow-xl",
        "ring-1 ring-black/5",
        className,
      )}
    >
      <span className="flex items-baseline gap-1.5 pl-1 pr-0.5">
        <span className="text-[17px] font-bold leading-none tabular-nums">{conteggio}</span>
        <span className="text-[12px] font-medium text-white/60">
          {conteggio === 1 ? "selezionata" : "selezionate"}
        </span>
      </span>
      <span aria-hidden className="h-5 w-px bg-white/15" />
      {children}
      <span aria-hidden className="h-5 w-px bg-white/15" />
      <button
        type="button"
        onClick={onAnnulla}
        aria-label="Annulla la selezione"
        title="Annulla la selezione (Esc)"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** \u2500\u2500 ESPORTAZIONE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *  Si esporta per lavorare fuori dal CRM (commercialista, corrieri, liste di
 *  richiamo): le colonne devono essere le stesse ovunque, altrimenti due file
 *  dello stesso mese non si confrontano. In coda stanno la prossima azione e il
 *  ritardo, cio\u00e8 l'unica cosa che un foglio di calcolo non sa ricavare da solo. */
export function esportaCsvLead(
  righe: Lead[],
  suffisso: string,
  nomeConsulente: (id?: string | null) => string = () => "",
): void {
  if (righe.length === 0) return;
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = [
    "Data acquisizione",
    "Nome",
    "Cognome",
    "Telefono",
    "Email",
    "Citta",
    "Fonte",
    "Stato",
    "Consulente",
    "Data meeting",
    "Ora meeting",
    "Prezzo finale",
    "Acconto incassato",
    "Saldo da incassare",
    "Data installazione",
    "Prossima azione",
    "Giorni di ritardo",
    "Note",
  ];
  const rows = righe.map((l) => {
    const az = prossimaAzione(l);
    return [
      soloData(l.data.createdAt),
      l.data.nome,
      l.data.cognome,
      l.data.telefono,
      l.data.email || "",
      l.data.citta || "",
      l.data.fonte || "",
      etichettaStato(l.data.stato),
      nomeConsulente(l.data.consulenteId),
      l.data.dataMeeting || "",
      l.data.oraMeeting || "",
      l.data.payment?.prezzoFinaleVendita ?? "",
      l.data.payment?.accontoPagato ?? "",
      saldoDaIncassare(l) || "",
      l.data.installazione?.dataInstallazione || "",
      az.quando ? `${az.cosa} \u00b7 ${az.quando}` : az.cosa,
      az.ritardo || "",
      l.data.note || "",
    ];
  });
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  //  Il BOM serve a Excel per aprire il file in UTF-8 senza accenti rotti.
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lead-${suffisso}-${oggiIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   12. SCORCIATOIE DA TASTIERA \u2014 le stesse lettere in tutte le pagine
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

/** \u2500\u2500 PERCH\u00c9 UN HOOK E NON UN useEffect PER PAGINA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 *  Le protezioni sono la parte che deve andare sempre uguale: non intercettare
 *  i tasti mentre si scrive in un campo, non rubarli a un menu aperto, lasciar
 *  passare \u2318K della ricerca globale. Riscritte a mano pagina per pagina, una di
 *  quelle righe prima o poi manca \u2014 e il sintomo \u00e8 una lettera che "sparisce"
 *  mentre si compila un campo, cio\u00e8 il modo pi\u00f9 veloce di far odiare le
 *  scorciatoie a chi le subisce.
 *
 *  La mappa \u00e8 indicizzata su `event.key`: "/", "?", "Escape", "ArrowLeft" e le
 *  lettere minuscole (una maiuscola premuta con Maiusc viene ricondotta). */
export function useScorciatoie(
  mappa: Record<string, (e: KeyboardEvent) => void>,
  opzioni?: { bloccato?: boolean },
): void {
  const bloccato = opzioni?.bloccato ?? false;
  //  La mappa \u00e8 un oggetto nuovo a ogni render: tenerla in un riferimento evita
  //  di registrare e togliere il listener di continuo (e di perdere il tasto
  //  premuto proprio in quell'istante). L'aggiornamento avviene dopo il render
  //  e non durante: un render scartato non deve lasciare in giro funzioni che
  //  leggono uno stato mai diventato vero.
  const rif = useRef(mappa);
  useEffect(() => {
    rif.current = mappa;
  });

  useEffect(() => {
    if (bloccato) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const scrivendo =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (scrivendo) {
        //  Esc esce dal campo: \u00e8 l'unico tasto che serve mentre si scrive.
        if (e.key === "Escape") t?.blur();
        return;
      }
      //  \u2318/Ctrl restano alla ricerca globale e al browser.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      //  Con un menu o un calendario aperto i tasti appartengono a quello.
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      //  Un menu a tendina chiuso ma col fuoco addosso risponde gi\u00e0 da solo
      //  alle frecce e alle lettere: senza questa riga una freccia cambiava il
      //  consulente E il mese nello stesso istante.
      if (t?.closest('[role="combobox"], [role="listbox"], select')) return;
      const azione = rif.current[e.key] ?? rif.current[e.key.toLowerCase()];
      if (!azione) return;
      e.preventDefault();
      azione(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bloccato]);
}

/** Una voce del promemoria: il tasto e cosa fa. */
export type Scorciatoia = readonly [string, string];

/** Le tre che valgono in ogni pagina del CRM: si aggiungono in coda a quelle
 *  della pagina, cos\u00ec l'elenco finisce sempre con le stesse tre righe e chi le
 *  ha imparate una volta le ritrova dove se le aspetta. */
export const SCORCIATOIE_COMUNI: Scorciatoia[] = [
  ["/", "Vai alla ricerca"],
  ["?", "Mostra questo elenco"],
  ["Esc", "Chiudi, poi annulla"],
];

/** Il promemoria delle scorciatoie: un pulsante e un pannello.
 *  Le scorciatoie che non si vedono non esistono, e il manuale non lo legge
 *  nessuno: l'unico posto dove funzionano \u00e8 la barra della pagina. */
export function AiutoScorciatoie({
  voci,
  aperto,
  onCambia,
  className,
}: {
  voci: readonly Scorciatoia[];
  aperto: boolean;
  onCambia: (v: boolean) => void;
  className?: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onCambia(!aperto)}
        title="Scorciatoie da tastiera (?)"
        aria-label="Scorciatoie da tastiera"
        //  Su telefono non c'\u00e8 una tastiera: il pulsante sarebbe solo ingombro.
        className={cn(
          "hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border",
          "bg-card text-muted-foreground hover:text-foreground md:inline-flex",
          className,
        )}
      >
        <Keyboard className="h-3.5 w-3.5" />
      </button>
      {aperto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 p-6 pt-24"
          onClick={() => onCambia(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold">Scorciatoie</span>
              <button
                type="button"
                onClick={() => onCambia(false)}
                aria-label="Chiudi"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {voci.map(([k, d]) => (
                <div key={k} className="flex items-center justify-between gap-3 text-[12px]">
                  <Tasto>{k}</Tasto>
                  <span className="text-right text-muted-foreground">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
