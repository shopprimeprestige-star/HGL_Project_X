/** ─────────────────────────────────────────────────────────────────────────
 *  IL GIORNO — gli orari da offrire, la linea del tempo, e la finestra che ci
 *  scrive dentro.
 *
 *  CHI GUARDA QUESTA ROBA
 *  Il setter, con qualcuno in linea che ha appena detto "sì, quando?". La sua
 *  domanda non è "com'è fatta la giornata": è DOVE C'È POSTO, e la risposta
 *  deve essere leggibile ad alta voce senza contare niente.
 *
 *  PERCIÒ IL GIORNO SI RACCONTA IN DUE PEZZI, IN QUEST'ORDINE
 *   1. GLI ORARI DA OFFRIRE (<OrariDaOffrire/>): una fila di orari premibili,
 *      divisi in mattina e pomeriggio. Si leggono al telefono così come sono —
 *      "posso alle 10, alle 11:30 o alle 15" — e premerne uno apre la
 *      fissazione già su quell'ora. Prima gli orari liberi erano riquadri
 *      "Libero fino alle 09:30" grandi come un appuntamento: per dire un orario
 *      bisognava aprire il riquadro e leggerci dentro.
 *   2. COM'È OCCUPATA (<LineaDelGiorno/>): la rotaia verticale con chi c'è.
 *      I buchi restano, ma come righe sottili di contorno — sono il vuoto fra
 *      due impegni, non devono pesare quanto un impegno.
 *
 *  LE REGOLE DEL DISEGNO
 *   · UN SOLO SEGNALE DI COLORE PER RIGA. Lo stato della trattativa sta nel
 *     pallino sulla rotaia; il riquadro resta neutro. Prima il colore era sia
 *     sul bordo sia nel chip sia (nella griglia di squadra) sul fondo: dieci
 *     righe così sono una bandiera, non un'agenda.
 *   · QUELLO CHE È PASSATO NON SI OFFRE. Su oggi gli orari già trascorsi
 *     escono dalla fila (restano contati in una nota): proporre le 09:00 alle
 *     16 è un appuntamento sbagliato che si scopre il giorno dopo.
 *   · ADESSO SI VEDE. Sul giorno di oggi una riga sottile segna l'ora corrente:
 *     è la differenza fra "restano quattro buchi" e "restano quattro buchi ma
 *     tre sono già passati".
 *   · UN COMPONENTE SOLO, DUE POSTI. Gli stessi due pezzi vivono nella colonna
 *     della pagina e dentro questa finestra: due disegni della stessa giornata
 *     erano il modo più rapido per farli divergere.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  MessageCircle,
  Plus,
  CalendarDays,
  Clock,
  AlertTriangle,
  CalendarClock,
  MapPin,
  MoveRight,
  Loader2,
  CircleSlash,
  Lock,
} from "lucide-react";
import { capienzaConsulenza, getFreeSlotsForDate, presiPerOra } from "@/crm/booking-utils";
//  La spunta «quest'ora solo per questa persona»: la stessa di tutto il CRM.
import { SpuntaSoloUnaPersona, useModiFascia } from "@/crm/ModoDellaFascia";
import { DURATA_PREDEFINITA } from "@/crm/invito";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "@/crm/whatsapp";
import { formatDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";
import { useCRM } from "@/crm/CRMContext";
import { ChipStato, PUNTO_TONO, tonoStato } from "@/crm/ui";
import {
  CampoFinestra,
  CLASSE_AREA,
  CLASSE_CAMPO,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
  VoceScelta,
  VuotoFinestra,
} from "@/crm/ui/Finestra";
import type { Consultant, Lead, LeadData, LeadStatus } from "@/crm/types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. LA GIORNATA IN RIGHE — impegni e buchi, nello stesso ordine dell'orologio
   ═════════════════════════════════════════════════════════════════════════ */

/** Un impegno del giorno è un meeting online oppure una visita in sede: sono
 *  due campi diversi della scheda, ma sulla linea del giorno occupano tempo
 *  allo stesso modo. */
export type TipoImpegno = "meet" | "sede";

export const ICONA_IMPEGNO = { meet: CalendarClock, sede: MapPin } as const;
const ETICHETTA_IMPEGNO = { meet: "Meeting", sede: "In sede" } as const;

export function tipoImpegno(l: Lead, giorno: string): TipoImpegno {
  return l.data.dataMeeting === giorno ? "meet" : "sede";
}

export function oraImpegno(l: Lead, giorno: string): string | null {
  return (tipoImpegno(l, giorno) === "meet" ? l.data.oraMeeting : l.data.oraVieneInSede) || null;
}

/** Gli impegni di un consulente in un giorno. Sta qui e non nella pagina perché
 *  la finestra deve poter guardare anche un ALTRO giorno (quello di
 *  destinazione, mentre si sposta un appuntamento). */
export function impegniDelGiorno(
  leads: Lead[],
  giorno: string | null,
  consultant: Consultant | null,
): Lead[] {
  if (!giorno) return [];
  return leads.filter(
    (l) =>
      (consultant ? l.data.consulenteId === consultant.id : true) &&
      (l.data.dataMeeting === giorno || l.data.dataVieneInSede === giorno),
  );
}

const aMinuti = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
};

const daMinuti = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export type RigaGiorno =
  | { t: "impegno"; chiave: string; min: number; lead: Lead; ora: string | null; tipo: TipoImpegno }
  | { t: "libero"; chiave: string; min: number; da: string; a: string; orari: string[] }
  | { t: "adesso"; chiave: string; min: number; ora: string };

/** Data locale YYYY-MM-DD. Costruita a mano: `toISOString()` lavora in UTC e
 *  dalle 22 in poi sposta "oggi" al giorno dopo. */
const isoLocale = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Una data buona è una data scritta come si deve: nei dati veri arrivano
 *  stringhe vuote e formati storti, e confrontarli con "<" darebbe risposte a
 *  caso invece di un onesto "non lo so".
 *  Esportata perché la pagina deve dare la STESSA risposta: se qui il giorno è
 *  illeggibile e lì lo si confronta con "<", il pannello dice "giorno passato"
 *  su una data che nessuno sa leggere. */
export const dataLeggibile = (giorno: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(giorno || "");

/** true = giorno già finito. Su un giorno passato non c'è niente da proporre,
 *  per quanti buchi risultino liberi. */
export function giornoPassato(giorno: string, adesso: Date = new Date()): boolean {
  return dataLeggibile(giorno) && giorno < isoLocale(adesso);
}

/** L'ora corrente in minuti, ma solo se `giorno` è oggi. Fuori da oggi la riga
 *  "adesso" non ha senso e non va inserita. */
export function minutiAdesso(giorno: string, ora: Date = new Date()): number | null {
  if (giorno !== isoLocale(ora)) return null;
  return ora.getHours() * 60 + ora.getMinutes();
}

/** Gli orari che si possono ancora PROPORRE, separati da quelli già passati.
 *
 *  Non ricalcola niente: la disponibilità arriva già fatta da booking-utils
 *  (getFreeSlotsForDate) e qui si decide soltanto cosa ha senso dire al
 *  telefono. Due conti diversi sulla stessa giornata sono la cosa che questa
 *  pagina non si può permettere.
 *
 *  Il filtro sul formato serve perché nei dati veri un orario può arrivare
 *  vuoto o storto: "  " diventerebbe 0 minuti, cioè un posto libero alle 00:00
 *  in cima alla fila. */
export function orariOffribili(
  giorno: string,
  liberi: string[],
  adesso: Date = new Date(),
): { offribili: string[]; passati: number } {
  //  Solo orari di un orologio vero: "25:00" e "  " passavano un controllo di
  //  sola forma e finivano in fila fra gli orari da dire al cliente.
  const validi = (liberi || []).filter(
    (o) => typeof o === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(o),
  );
  //  Ieri è tutto passato, per definizione: senza questo, un giorno finito
  //  mostrava una fila piena di orari da proporre a nessuno.
  if (giornoPassato(giorno, adesso)) return { offribili: [], passati: validi.length };
  const ora = minutiAdesso(giorno, adesso);
  if (ora === null) return { offribili: validi, passati: 0 };
  const offribili = validi.filter((o) => aMinuti(o) >= ora);
  return { offribili, passati: validi.length - offribili.length };
}

/** Mattina e pomeriggio: è così che si propone un orario a voce ("stamattina
 *  alle 10 oppure nel pomeriggio alle 15"), ed è anche il modo più corto per
 *  spezzare una fila di venti pastiglie in due file leggibili. */
const CONFINE_POMERIGGIO = 13 * 60;

export function raggruppaPerMezzaGiornata(orari: string[]): { nome: string; orari: string[] }[] {
  const mattina = orari.filter((o) => aMinuti(o) < CONFINE_POMERIGGIO);
  const pomeriggio = orari.filter((o) => aMinuti(o) >= CONFINE_POMERIGGIO);
  const gruppi: { nome: string; orari: string[] }[] = [];
  if (mattina.length > 0) gruppi.push({ nome: "Mattina", orari: mattina });
  if (pomeriggio.length > 0) gruppi.push({ nome: "Pomeriggio", orari: pomeriggio });
  return gruppi;
}

/** Impegni e buchi mescolati in un unico elenco ordinato per ora.
 *  Gli orari liberi contigui si fondono in una fascia sola: "dalle 15 alle 18"
 *  è una frase, sei pastiglie in fila sono un conteggio da fare a mano. */
export function righeDelGiorno(
  impegni: Lead[],
  giorno: string,
  liberi: string[],
  durata: number,
  adesso?: number | null,
): RigaGiorno[] {
  const righe: RigaGiorno[] = [];

  for (const l of impegni) {
    const ora = oraImpegno(l, giorno);
    righe.push({
      t: "impegno",
      chiave: `${l.id}-${giorno}`,
      //  Un appuntamento senza orario esiste lo stesso: finisce in fondo alla
      //  linea invece di sparire (e lì si vede che gli manca l'ora).
      min: ora ? aMinuti(ora) : Number.MAX_SAFE_INTEGER,
      lead: l,
      ora,
      tipo: tipoImpegno(l, giorno),
    });
  }

  const ordinati = [...liberi].sort();
  let i = 0;
  while (i < ordinati.length) {
    const inizio = i;
    while (i + 1 < ordinati.length && aMinuti(ordinati[i + 1]) === aMinuti(ordinati[i]) + durata) {
      i++;
    }
    const gruppo = ordinati.slice(inizio, i + 1);
    righe.push({
      t: "libero",
      chiave: `libero-${gruppo[0]}`,
      min: aMinuti(gruppo[0]),
      da: gruppo[0],
      a: daMinuti(aMinuti(gruppo[gruppo.length - 1]) + durata),
      orari: gruppo,
    });
    i++;
  }

  //  L'ora corrente si infila fra le righe come se fosse un evento: così la
  //  giornata si legge in due metà, quella andata e quella recuperabile.
  //  Non compare su una giornata senza niente sopra e senza niente sotto,
  //  dove sarebbe solo un tratto in mezzo al vuoto.
  if (adesso != null && righe.length > 0) {
    righe.push({
      t: "adesso",
      chiave: "adesso",
      //  Mezzo minuto in avanti: a parità di ora la riga "adesso" sta DOPO
      //  l'appuntamento delle 15:00, che alle 15:00 è appena cominciato.
      min: adesso + 0.5,
      ora: daMinuti(adesso),
    });
  }

  return righe.sort((a, b) => a.min - b.min);
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LA LINEA DEL GIORNO — un componente solo, due posti dove vive
   ═════════════════════════════════════════════════════════════════════════ */

/** L'orario libero premibile. 40px di altezza: è la misura sotto la quale il
 *  pollice comincia a prendere l'orario sbagliato, e gli orari si scelgono più
 *  spesso dal telefono che dal mouse. */
export function TastoOra({
  ora,
  scelta,
  onClick,
  presi = 0,
  capienza,
  soloUno,
  className,
}: {
  ora: string;
  scelta?: boolean;
  onClick?: () => void;
  /*  ── ⚠️ QUANTE PERSONE HAI GIÀ IN QUELL'ORA ───────────────────────────
      Richiesta del committente: «fino a 3 persone nella stessa ora di
      consulenza per consulente, con il contatore 1/3, 2/3, 3/3».
      Un orario con due persone dentro è ancora offribile, ma non è come uno
      vuoto: chi lo propone al telefono deve sapere quanto è pieno. Assente o
      zero = non si mostra niente, come prima. */
  presi?: number;
  capienza?: number;
  /*  ── ⚠️ QUESTA FASCIA È TENUTA PER UNA PERSONA SOLA ───────────────────
      Segnalazione del committente: «quelli che stanno soli e non soli, non
      c'è la spunta per farlo». Il guasto era proprio qui: una fascia tenuta
      per uno solo e ancora VUOTA era identica a una libera — stesso colore,
      nessun contatore (a zero non si scriveva niente) — quindi non si poteva
      né vedere quali fossero né decidere, perché per decidere bisogna prima
      capire com'è messa. Adesso porta il lucchetto e dice «0/1». */
  soloUno?: boolean;
  /** larghezza extra quando il tasto sta in una fila a capo invece che in griglia */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={scelta}
      title={
        soloUno
          ? `Tenuta per una persona sola${presi ? " · già presa" : ": il primo che entra la occupa tutta"}`
          : presi > 0 && capienza
            ? `${presi} di ${capienza} in questa fascia`
            : undefined
      }
      className={cn(
        "flex h-10 flex-col items-center justify-center gap-0.5 rounded-lg border text-[12.5px] font-medium leading-none tabular-nums transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        scelta
          ? "border-foreground bg-foreground text-background"
          : soloUno
            ? "border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
            : presi > 0
              ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
              : "border-border bg-card text-foreground hover:border-foreground/40 hover:bg-accent",
        className,
      )}
    >
      <span className="flex items-center gap-1">
        {soloUno && <Lock className="h-2.5 w-2.5 shrink-0 opacity-70" />}
        {ora}
      </span>
      {/*  ⚠️ SU UNA FASCIA TENUTA PER UNO SOLO IL CONTATORE SI VEDE ANCHE A
           ZERO: «0/1» è l'unica cosa che distingue «tenuta e ancora libera»
           da «libera per tutti», e senza di quello le due erano identiche. */}
      {(soloUno || presi > 0) && capienza ? (
        <span className="text-[10px] font-semibold leading-none opacity-80">
          {presi}/{soloUno ? 1 : capienza}
        </span>
      ) : null}
    </button>
  );
}

/* ── GLI ORARI DA OFFRIRE ────────────────────────────────────────────────────
   La risposta a "dove c'è posto?", scritta come si dice al telefono.

   Prima questa informazione esisteva solo dentro i riquadri "Libero fino alle
   09:30 · 1 posto da 30'": per arrivare a un orario da proporre bisognava
   aprire il riquadro, e per proporne tre bisognava aprirne tre. Qui gli orari
   sono già tutti fuori, in fila, premibili: leggerne tre di seguito è un colpo
   d'occhio, e premerne uno fissa direttamente lì.

   Gli orari già passati non compaiono (si contano soltanto): alle 16 "libero
   alle 09:00" non è un posto, è un errore che si scopre il giorno dopo. */
export function OrariDaOffrire({
  giorno,
  liberi,
  presiPerOra,
  capienza,
  durata,
  lavorativo,
  senzaConsulente,
  oraScelta,
  onScegliOra,
  consultantId,
  titolo = "Da offrire al telefono",
  className,
}: {
  giorno: string;
  /** orari liberi già calcolati da booking-utils, della stessa `durata` */
  liberi: string[];
  /** quante persone ci sono già in ciascun orario (il «2» di «2/3») */
  presiPerOra?: Map<string, number>;
  capienza?: number;
  durata: number;
  lavorativo: boolean;
  /** true = nessun consulente scelto: non è "pieno", è "non lo so" */
  senzaConsulente?: boolean;
  oraScelta?: string | null;
  onScegliOra?: (ora: string) => void;
  /** ── ⚠️ SERVE PER LA SPUNTA «SOLO PER QUESTA PERSONA» ─────────────────
   *  Senza il consulente non si sa di quale agenda si sta parlando, e la
   *  spunta non compare: gli orari si leggono lo stesso, come prima. */
  consultantId?: string | null;
  /** cambia solo l'intestazione: spostando un appuntamento non si sta
   *  "offrendo" niente, si sta scegliendo dove va */
  titolo?: string;
  className?: string;
}) {
  const { offribili, passati } = useMemo(() => orariOffribili(giorno, liberi), [giorno, liberi]);
  const gruppi = useMemo(() => raggruppaPerMezzaGiornata(offribili), [offribili]);
  /*  ── ⚠️ TUTTI I GANCI PRIMA DELLE USCITE ANTICIPATE ───────────────────
      Qui sotto ci sono i casi «niente da offrire», che escono subito: un
      gancio messo dopo si smonterebbe a ogni giornata piena (vedi la prova
      «nessun hook sotto un'uscita anticipata»). */
  const fasce = useModiFascia(consultantId, giorno, durata);

  //  Il vuoto ha motivi diversi e vanno detti in modi diversi: chi legge deve
  //  sapere se cambiare giorno, cambiare consulente o smettere di cercare per
  //  oggi. E una data che non si riesce a leggere non è "pieno": è "non lo so",
  //  e va detto così — offrire orari appesi a una data storta è il modo più
  //  rapido per fissare un appuntamento che non esiste.
  const giornoNoto = dataLeggibile(giorno);
  if (senzaConsulente || !giornoNoto || offribili.length === 0) {
    const testo = senzaConsulente
      ? "Scegli un consulente per vedere dove c'è posto."
      : !giornoNoto
        ? "Data non leggibile: di questo giorno non si sa niente."
        : giornoPassato(giorno)
          ? "Giorno già passato: qui non c'è più niente da proporre."
          : !lavorativo
            ? "Non lavora in questo giorno: prova un altro giorno."
            : passati > 0
              ? `Per oggi non resta niente da proporre: i ${passati} orari liberi sono già passati.`
              : "Giornata piena: nessun posto libero.";
    return (
      <p
        className={cn(
          "rounded-xl border border-dashed border-border px-3 py-3 text-center text-[12px] text-muted-foreground",
          className,
        )}
      >
        {testo}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
        <span className="font-semibold uppercase tracking-wide text-foreground">{titolo}</span>
        <span className="text-muted-foreground">slot da {durata}′</span>
        {passati > 0 && <span className="text-muted-foreground">· {passati} già passati oggi</span>}
      </div>
      {gruppi.map((g) => (
        <div key={g.nome} className="flex flex-wrap items-center gap-1.5">
          {/*  L'etichetta della mezza giornata compare solo quando ci sono
              entrambe: su una fila sola sarebbe una parola in più da leggere. */}
          {gruppi.length > 1 && (
            <span className="w-[4.5rem] shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
              {g.nome}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {g.orari.map((o) => (
              <TastoOra
                key={o}
                ora={o}
                scelta={oraScelta === o}
                onClick={() => onScegliOra?.(o)}
                presi={presiPerOra?.get(o) ?? 0}
                /*  ⚠️ I posti sono quelli di QUESTA fascia: un'ora tenuta per
                    una persona sola ne ha uno, anche se la capienza generale
                    dice tre. Senza questa riga si leggerebbe «1/3, c'è posto»
                    su un'ora che non accetta più nessuno. */
                capienza={fasce.modi[o] === "solo" ? 1 : capienza}
                soloUno={fasce.modi[o] === "solo"}
                className="min-w-[3.5rem] px-2.5"
              />
            ))}
          </div>
        </div>
      ))}
      {/*  ── LA SPUNTA, SOTTO GLI ORARI ───────────────────────────────────
           Richiesta del committente: «deve esserci una spunta che blocca lo
           slot per una persona sola, e mettila in tutto il CRM». Compare
           quando un'ora è scelta — prima non c'è niente da decidere — ed è la
           stessa di tutte le altre schermate (crm/ModoDellaFascia). */}
      {/*  ⚠️ NON SI CHIEDE PIÙ CHE L'ORA SIA FRA QUELLE DA OFFRIRE: quelle
           sono solo le ore ANCORA LIBERE E FUTURE, e proprio sull'ora dove
           hai appena messo una persona — che quindi può uscire dall'elenco —
           è dove serve la spunta. Basta avere il consulente e l'ora scelta. */}
      {consultantId && oraScelta && (
        <SpuntaSoloUnaPersona
          ora={oraScelta}
          presi={presiPerOra?.get(oraScelta) ?? 0}
          capienza={capienza}
          modo={fasce.modi[oraScelta] === "solo" ? "solo" : "aperta"}
          onCambia={fasce.cambia}
          salvando={fasce.salvando}
          durata={durata}
        />
      )}
    </div>
  );
}

/** Il pallino sulla rotaia. È l'unico punto di colore della riga: dice in che
 *  fase è la trattativa senza colorare tutto il riquadro.
 *
 *  Il filo parte dal primo pallino e finisce sull'ultimo: sporgere sopra e
 *  sotto lo farebbe sembrare una giornata tagliata a metà, quando invece è
 *  tutta lì. Il centro del pallino cade a 15px dall'alto della riga (top 11px +
 *  metà di 8px): è la stessa misura che allinea l'orario nella colonna a
 *  sinistra. */
function PallinoRotaia({
  classe,
  primo,
  ultimo,
}: {
  classe: string;
  primo?: boolean;
  ultimo?: boolean;
}) {
  return (
    <span className="relative w-2.5 shrink-0" aria-hidden>
      {!(primo && ultimo) && (
        <span
          className={cn(
            "absolute left-1/2 w-px -translate-x-1/2 bg-border",
            primo ? "bottom-0 top-[15px]" : ultimo ? "top-0 h-[15px]" : "inset-y-0",
          )}
        />
      )}
      <span
        className={cn(
          "absolute left-1/2 top-[11px] h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-card",
          classe,
        )}
      />
    </span>
  );
}

interface PropsLinea {
  giorno: string;
  impegni: Lead[];
  /** orari liberi già calcolati (booking-utils), della stessa durata di `durata` */
  liberi: string[];
  durata: number;
  /** false = il consulente quel giorno non lavora: cambia la frase del vuoto */
  lavorativo: boolean;
  onApriLead?: (l: Lead) => void;
  onSposta?: (l: Lead) => void;
  onScegliOra?: (ora: string) => void;
  /** nome del consulente per il messaggio WhatsApp precompilato */
  nomeConsulente?: (id?: string | null) => string;
  /** true = versione stretta (colonna della pagina): niente tasti telefono */
  stretta?: boolean;
  className?: string;
}

export function LineaDelGiorno({
  giorno,
  impegni,
  liberi,
  durata,
  lavorativo,
  onApriLead,
  onSposta,
  onScegliOra,
  nomeConsulente,
  stretta,
  className,
}: PropsLinea) {
  //  L'ora corrente si calcola al montaggio: la linea non deve muoversi da sola
  //  mentre qualcuno la sta guardando (basta cambiare giorno per rifarla).
  const adesso = useMemo(() => minutiAdesso(giorno), [giorno]);
  const righe = useMemo(
    () => righeDelGiorno(impegni, giorno, liberi, durata, adesso),
    [impegni, giorno, liberi, durata, adesso],
  );
  if (righe.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center",
          className,
        )}
      >
        <CircleSlash className="h-4 w-4 text-muted-foreground" />
        <p className="max-w-[22rem] text-[12.5px] text-muted-foreground">
          {lavorativo
            ? "Giornata piena: nessun orario libero e nessun appuntamento da mostrare."
            : "Giorno non lavorativo per questo consulente."}
        </p>
      </div>
    );
  }

  return (
    <ol className={cn("min-w-0", className)}>
      {righe.map((r, i) => {
        //  Primo e ultimo servono alla rotaia: il filo comincia e finisce sui
        //  pallini, non nel vuoto sopra e sotto la giornata.
        const primo = i === 0;
        const ultimo = i === righe.length - 1;

        // ── L'ORA CORRENTE ────────────────────────────────────────────────
        if (r.t === "adesso") {
          return (
            <li key={r.chiave} className="flex gap-2">
              {/*  30px di altezza: metà è 15px, cioè esattamente il centro del
                  pallino sulla rotaia. Ora, pallino e filo restano in linea. */}
              <span className="flex h-[30px] w-10 shrink-0 items-center justify-end text-[11.5px] font-semibold tabular-nums text-sky-700">
                {r.ora}
              </span>
              <PallinoRotaia classe="bg-sky-500" primo={primo} ultimo={ultimo} />
              <div className="flex h-[30px] min-w-0 flex-1 items-center gap-2">
                <span className="h-px flex-1 bg-sky-500/40" aria-hidden />
                <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-wide text-sky-700">
                  adesso
                </span>
              </div>
            </li>
          );
        }

        // ── UN IMPEGNO ────────────────────────────────────────────────────
        if (r.t === "impegno") {
          const l = r.lead;
          const Icona = ICONA_IMPEGNO[r.tipo];
          const tono = tonoStato(l.data.stato);
          return (
            <li key={r.chiave} className="flex gap-2">
              <span className="w-10 shrink-0 pt-2.5 text-right text-[11.5px] font-semibold tabular-nums text-foreground">
                {r.ora ?? "—"}
              </span>
              <PallinoRotaia classe={PUNTO_TONO[tono]} primo={primo} ultimo={ultimo} />
              {/*  Lo spazio fra una riga e l'altra sta DENTRO la colonna del
                  contenuto, non come padding della riga: così la rotaia (che si
                  stira per tutta l'altezza della riga) resta un filo continuo
                  invece di spezzarsi a ogni appuntamento. */}
              <div className="mb-1.5 flex min-w-0 flex-1 items-stretch gap-1 rounded-xl border border-border bg-card p-1">
                <button
                  type="button"
                  onClick={() => onApriLead?.(l)}
                  className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
                >
                  <span className="block truncate text-[13px] font-medium leading-tight">
                    {l.data.nome} {l.data.cognome}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Icona className="h-3 w-3" />
                      {ETICHETTA_IMPEGNO[r.tipo]}
                    </span>
                    <ChipStato stato={l.data.stato} />
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 self-center">
                  {onSposta && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onSposta(l)}
                      title="Sposta questo appuntamento"
                      aria-label={`Sposta l'appuntamento di ${l.data.nome} ${l.data.cognome}`}
                      className="h-10 w-10 text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
                    >
                      <MoveRight className="h-4 w-4" />
                    </Button>
                  )}
                  {!stretta && l.data.telefono && (
                    <>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
                      >
                        <a href={`tel:${l.data.telefono}`} title="Chiama" aria-label="Chiama">
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
                      >
                        <a
                          href={buildWhatsAppLink(
                            l.data.telefono,
                            getWhatsAppMessageForStatus(
                              l,
                              nomeConsulente?.(l.data.consulenteId) ?? "",
                            ),
                          )}
                          target="_blank"
                          rel="noreferrer"
                          title="WhatsApp"
                          aria-label="Scrivi su WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        }

        // ── UN BUCO ───────────────────────────────────────────────────────
        //  Il vuoto pesa meno del pieno: una riga di contorno alta 30px contro
        //  i ~64px di un appuntamento. Prima il buco era un riquadro grande
        //  quanto un impegno, e mezza giornata libera sembrava mezza giornata
        //  occupata. Gli orari esatti non si aprono più da qui: stanno tutti
        //  nella fila in cima (<OrariDaOffrire/>), che è dove li si cerca.
        //  Questa riga resta premibile e prende il primo posto della fascia,
        //  perché al telefono si chiede quasi sempre "il prima possibile".
        //  "Il prima possibile" però non è un'ora già passata: su OGGI la
        //  fascia che sta a cavallo dell'ora corrente (le 09:00–12:00 viste
        //  alle 11) partiva dalle 09:00, e il tasto in fondo alla finestra si
        //  ritrovava un orario del mattino da confermare. Su un giorno finito
        //  di orari futuri non ce n'è nessuno e resta il primo: lì il "+"
        //  serve a registrare a posteriori, non a proporre.
        const primoUtile =
          (adesso == null ? undefined : r.orari.find((o) => aMinuti(o) >= adesso)) ?? r.orari[0];
        return (
          <li key={r.chiave} className="flex gap-2">
            <span className="flex h-[30px] w-10 shrink-0 items-center justify-end text-[11px] tabular-nums text-muted-foreground/70">
              {r.da}
            </span>
            {/*  Il buco ha un pallino vuoto: sulla rotaia si distingue da un
                impegno senza bisogno di leggere niente. */}
            <PallinoRotaia
              classe="border border-muted-foreground/40 bg-card"
              primo={primo}
              ultimo={ultimo}
            />
            <div className="mb-1 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onScegliOra?.(primoUtile)}
                disabled={!onScegliOra}
                title={onScegliOra ? `Fissa alle ${primoUtile}` : undefined}
                aria-label={`Libero dalle ${r.da} alle ${r.a}: ${r.orari.length} posti da ${durata} minuti`}
                className="flex h-[30px] w-full min-w-0 items-center gap-2 rounded-md px-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="shrink-0">
                  libero fino alle <span className="tabular-nums">{r.a}</span> · {r.orari.length}{" "}
                  {r.orari.length === 1 ? "posto" : "posti"}
                </span>
                {/*  Il tratteggio riempie lo spazio che resta: dice "qui non
                    c'è niente" senza disegnare un riquadro che sembri roba. */}
                <span className="h-px min-w-0 flex-1 border-t border-dashed border-border" />
                {onScegliOra && <Plus className="h-3.5 w-3.5 shrink-0 opacity-50" />}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA FINESTRA DEL GIORNO — leggere, creare, spostare
   ═════════════════════════════════════════════════════════════════════════ */

interface BookableStatus {
  v: LeadStatus;
  label: string;
  hint: string;
  needsTime: boolean;
}

/** Le quattro strade possibili dopo un contatto. Il colore non sta nel
 *  riquadro: arriva dal tono dello stato (PUNTO_TONO) ed è solo un pallino. */
const QUICK_STATUSES: BookableStatus[] = [
  {
    v: "appuntamento_fissato",
    label: "Appuntamento",
    hint: "Meeting online con orario",
    needsTime: true,
  },
  {
    v: "viene_in_sede",
    label: "Appuntamento in sede",
    hint: "Incontro fisico in sede",
    needsTime: true,
  },
  {
    v: "fissa_meet_dopo",
    label: "Fissa meet dopo",
    hint: "Da ricontattare per fissare",
    needsTime: false,
  },
  {
    v: "da_ricontattare",
    label: "Da ricontattare",
    hint: "Pianifica una richiamata",
    needsTime: false,
  },
];

//  30′ è il passo con cui è disegnata tutta l'agenda (griglia di squadra
//  compresa): partire da qui fa sì che il numero di ore libere del calendario e
//  quello di questa finestra siano lo stesso numero.
const DURATE = [15, 30, 45, 60, 90] as const;
//  ⚠️ LA DURATA DI SERIE È QUELLA DI TUTTO IL CRM (crm/invito), non una di
//   questa finestra: il passo con cui è DISEGNATA l'agenda resta mezz'ora —
//   gli orari si offrono ogni trenta minuti — ma la consulenza che si sta
//   fissando dura quanto dura dappertutto.
const DURATA_STD = DURATA_PREDEFINITA;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string | null;
  consultant: Consultant | null;
  leads: Lead[];
  consultants: Consultant[];
  onOpenLead: (lead: Lead) => void;
  onCreateLead: (prefill: Partial<LeadData>) => void;
  /** orario già scelto nella pagina (si è premuto un buco nel pannello del giorno) */
  oraIniziale?: string | null;
  /** appuntamento da spostare: la finestra si apre già in modalità spostamento */
  leadDaSpostare?: Lead | null;
}

export function AgendaDaySheet({
  open,
  onOpenChange,
  date,
  consultant,
  leads,
  consultants,
  onOpenLead,
  onCreateLead,
  oraIniziale,
  leadDaSpostare,
}: Props) {
  const { updateLead } = useCRM();

  const [statusV, setStatusV] = useState<LeadStatus>("appuntamento_fissato");
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickNote, setQuickNote] = useState("");
  // Follow-up date (per "da_ricontattare" e "fissa_meet_dopo")
  const [followUpDate, setFollowUpDate] = useState("");
  // Toggle "ha lasciato acconto" per viene_in_sede
  const [accontoLasciato, setAccontoLasciato] = useState(false);
  const [accontoImporto, setAccontoImporto] = useState<string>("");
  // Durata configurabile per calcolo slot
  const [duration, setDuration] = useState<number>(DURATA_STD);
  // ── SPOSTAMENTO ──────────────────────────────────────────────────────────
  const [spostamento, setSpostamento] = useState<Lead | null>(null);
  const [giornoDest, setGiornoDest] = useState<string>("");
  const [salvataggio, setSalvataggio] = useState(false);

  const consultantName = (id?: string | null) =>
    consultants.find((c) => c.id === id)?.data.nome ?? "—";

  //  All'apertura la finestra riparte dal contesto che le arriva dalla pagina:
  //  quale giorno, quale orario già premuto, quale appuntamento si sta
  //  spostando. Senza questo, riaprendola si ritrovavano le scelte di prima.
  useEffect(() => {
    if (!open) return;
    setSlotTime(oraIniziale ?? null);
    setSpostamento(leadDaSpostare ?? null);
    setGiornoDest(date ?? "");
    setSalvataggio(false);
  }, [open, date, oraIniziale, leadDaSpostare]);

  //  Mentre si sposta, la giornata mostrata è quella di DESTINAZIONE: si sceglie
  //  un orario guardando com'è messo quel giorno, non quello di partenza.
  const giornoAttivo = spostamento ? giornoDest || date : date;

  const impegni = useMemo(
    () => impegniDelGiorno(leads, giornoAttivo, consultant),
    [leads, giornoAttivo, consultant],
  );

  const lavorativo = useMemo(() => {
    if (!consultant || !giornoAttivo) return false;
    const dow = new Date(giornoAttivo + "T00:00:00").getDay();
    return consultant.data.giorniLavorativi?.includes(dow) ?? false;
  }, [consultant, giornoAttivo]);

  //  L'appuntamento che si sta spostando non deve occupare se stesso: senza
  //  escluderlo, l'orario in cui è adesso risulterebbe indisponibile.
  const slots = useMemo(() => {
    if (!consultant || !giornoAttivo) return [];
    return getFreeSlotsForDate(consultant, giornoAttivo, duration, leads, spostamento?.id);
  }, [consultant, giornoAttivo, leads, duration, spostamento]);
  //  Quante persone ci sono già in ciascun orario: un orario con due dentro è
  //  ancora offribile, ma chi lo propone al telefono deve saperlo.
  const quantiPerOra = useMemo(() => {
    if (!consultant || !giornoAttivo) return new Map<string, number>();
    return presiPerOra(consultant, giornoAttivo, duration, leads, spostamento?.id);
  }, [consultant, giornoAttivo, leads, duration, spostamento]);

  // Fascia oraria attiva del consulente per il giorno mostrato (override del giorno > default)
  const activeFasce = useMemo(() => {
    if (!consultant || !giornoAttivo) return [];
    const dow = new Date(giornoAttivo + "T00:00:00").getDay();
    const overrides = consultant.data.fasceOrarieGiorno?.[dow];
    return overrides && overrides.length > 0 ? overrides : consultant.data.fasceOrarie || [];
  }, [consultant, giornoAttivo]);

  // Indisponibilità del giorno (per spiegare slot mancanti)
  const dayBlocks = useMemo(() => {
    if (!consultant || !giornoAttivo) return [];
    return (consultant.data.indisponibilita || []).filter((x) => x.data === giornoAttivo);
  }, [consultant, giornoAttivo]);

  const status = QUICK_STATUSES.find((s) => s.v === statusV)!;

  const reset = () => {
    setStatusV("appuntamento_fissato");
    setSlotTime(null);
    setQuickName("");
    setQuickPhone("");
    setQuickNote("");
    setFollowUpDate("");
    setAccontoLasciato(false);
    setAccontoImporto("");
    setSpostamento(null);
    setSalvataggio(false);
  };

  const buildPrefill = (): Partial<LeadData> | null => {
    if (!date) return null;
    const [nome = "", ...cognomeParts] = quickName.trim().split(" ");
    const cognome = cognomeParts.join(" ");
    const prefill: Partial<LeadData> = {
      stato: statusV,
      consulenteId: consultant?.id ?? null,
      nome: nome || quickName.trim(),
      cognome,
      telefono: quickPhone.trim(),
      note: quickNote.trim() || undefined,
    };
    if (statusV === "viene_in_sede") {
      prefill.dataVieneInSede = date;
      if (slotTime) prefill.oraVieneInSede = slotTime;
      prefill.accontoVieneInSede = accontoLasciato;
      if (accontoLasciato && accontoImporto) {
        const v = Number(accontoImporto);
        if (!isNaN(v) && v > 0) {
          prefill.payment = {
            accontoPagato: v,
            statoPagamento: "acconto_ricevuto",
            dataPagamento: new Date().toISOString().slice(0, 10),
          };
          prefill.stato = "acconto";
        }
      }
    } else if (statusV === "appuntamento_fissato") {
      prefill.dataMeeting = date;
      if (slotTime) prefill.oraMeeting = slotTime;
    } else {
      // da_ricontattare / fissa_meet_dopo → usa followUpDate (default = data corrente cliccata)
      prefill.dataRicontatto = followUpDate || date;
    }
    return prefill;
  };

  const handleQuickCreate = () => {
    const prefill = buildPrefill();
    if (!prefill) return;
    onCreateLead(prefill);
    reset();
  };

  const handleOpenFullForm = () => {
    if (!date) return;
    const prefill: Partial<LeadData> = {
      stato: statusV,
      consulenteId: consultant?.id ?? null,
    };
    if (statusV === "viene_in_sede") {
      prefill.dataVieneInSede = date;
      if (slotTime) prefill.oraVieneInSede = slotTime;
    } else if (statusV === "appuntamento_fissato") {
      prefill.dataMeeting = date;
      if (slotTime) prefill.oraMeeting = slotTime;
    } else {
      prefill.dataRicontatto = followUpDate || date;
    }
    onCreateLead(prefill);
    reset();
  };

  //  Spostare significa riscrivere data e ora del campo giusto: un meeting non
  //  può finire nei campi della visita in sede (e viceversa), altrimenti la
  //  trattativa cambia natura senza che nessuno l'abbia deciso.
  const confermaSpostamento = async () => {
    if (!spostamento || !giornoDest || !slotTime) return;
    const tipo = tipoImpegno(spostamento, date ?? "");
    setSalvataggio(true);
    await updateLead(
      spostamento.id,
      tipo === "meet"
        ? { dataMeeting: giornoDest, oraMeeting: slotTime }
        : { dataVieneInSede: giornoDest, oraVieneInSede: slotTime },
    );
    setSalvataggio(false);
    setSpostamento(null);
    setSlotTime(null);
    onOpenChange(false);
  };

  //  Quanti posti si possono ancora PROPORRE: sul giorno di oggi gli orari già
  //  passati non sono posti, e contarli faceva dire al telefono "ho ancora sei
  //  buchi" quando i primi quattro erano di stamattina.
  const offribili = useMemo(
    () => orariOffribili(giornoAttivo ?? "", slots).offribili.length,
    [giornoAttivo, slots],
  );

  //  L'unico riepilogo della finestra, e parte dai posti liberi perché è la
  //  domanda con cui la si apre.
  const contesto = spostamento
    ? `Spostamento in corso · ${consultant?.data.nome || "nessun consulente"}`
    : [
        consultant?.data.nome || "Nessun consulente",
        `${offribili} ${offribili === 1 ? "posto libero" : "posti liberi"}`,
        `${impegni.length} ${impegni.length === 1 ? "appuntamento" : "appuntamenti"}`,
      ].join(" · ");

  const oraAttuale = spostamento ? oraImpegno(spostamento, date ?? "") : null;

  return (
    <Finestra
      aperta={open}
      onCambio={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      titolo={
        spostamento
          ? `Sposta ${spostamento.data.nome} ${spostamento.data.cognome}`.trim()
          : date
            ? formatDate(date)
            : "Giorno"
      }
      contesto={contesto}
      icona={spostamento ? MoveRight : CalendarDays}
      larghezza="xl"
      senzaPadding
      azioni={
        spostamento ? (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSpostamento(null);
                setSlotTime(null);
                setGiornoDest(date ?? "");
              }}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Annulla lo spostamento
            </Button>
            <Button
              onClick={confermaSpostamento}
              disabled={!slotTime || !giornoDest || salvataggio}
            >
              {salvataggio ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoveRight className="h-3.5 w-3.5" />
              )}
              {slotTime ? `Sposta alle ${slotTime}` : "Scegli un orario"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleOpenFullForm}
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            >
              Apri la scheda completa
            </Button>
            <Button onClick={handleQuickCreate} disabled={!quickName.trim() || !quickPhone.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Crea trattativa{status.needsTime && slotTime ? ` · ${slotTime}` : ""}
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] md:divide-x md:divide-slate-200">
        {/* ── SINISTRA: com'è fatta la giornata ─────────────────────────── */}
        <div className="space-y-3 px-4 py-4 sm:px-5">
          {!lavorativo && consultant && (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              Giorno non lavorativo per questo consulente: gli orari liberi sono zero per scelta,
              non per pienezza.
            </NotaFinestra>
          )}

          <SezioneFinestra
            titolo={spostamento ? "Il giorno di destinazione" : "La giornata"}
            //  Il riepilogo (quanti in agenda, quanti liberi) sta già nel
            //  contesto in cima alla finestra: ripeterlo qui erano due frasi
            //  che dicevano lo stesso numero con parole diverse.
            nota={giornoAttivo ? formatDate(giornoAttivo, { short: true }) : undefined}
            icona={CalendarClock}
            azioni={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Durata</span>
                {DURATE.map((d) => (
                  <Pillola
                    key={d}
                    attiva={duration === d}
                    onClick={() => {
                      setDuration(d);
                      setSlotTime(null);
                    }}
                    titolo={`Cerca buchi da ${d} minuti`}
                    className="px-2 py-1"
                  >
                    {d}&apos;
                  </Pillola>
                ))}
              </div>
            }
            classeCorpo="p-4 space-y-3"
          >
            {/*  Le fasce di lavoro spiegano perché gli orari liberi sono quelli e
                non altri: senza, un pomeriggio vuoto sembra un errore. */}
            {consultant && lavorativo && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                <span className="uppercase tracking-wide text-slate-400">Fascia</span>
                {activeFasce.length === 0 ? (
                  <span className="italic text-slate-400">nessuna per questo giorno</span>
                ) : (
                  activeFasce.map((f, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 tabular-nums"
                    >
                      {f.inizio}–{f.fine}
                    </span>
                  ))
                )}
                {dayBlocks.length > 0 && (
                  <>
                    <span className="uppercase tracking-wide text-slate-400">Bloccato</span>
                    {dayBlocks.map((b, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 tabular-nums text-amber-900"
                      >
                        {b.inizio && b.fine ? `${b.inizio}–${b.fine}` : "tutto il giorno"}
                      </span>
                    ))}
                  </>
                )}
              </div>
            )}

            {!consultant ? (
              <VuotoFinestra testo="Seleziona un consulente per vedere la sua giornata." />
            ) : (
              <>
                {/*  Prima gli orari da dire a voce, poi com'è occupata la
                    giornata: è l'ordine in cui servono a chi ha qualcuno in
                    linea. L'orario premuto qui è lo stesso che finisce nel
                    tasto in fondo alla finestra.
                    Mentre si sposta, la scelta dell'orario appartiene alla
                    colonna "Dove va": due file di orari identiche sulla stessa
                    schermata sono due posti dove premere per la stessa cosa. */}
                {!spostamento && (
                  <OrariDaOffrire
                    giorno={giornoAttivo ?? ""}
                    liberi={slots}
                    presiPerOra={quantiPerOra}
                    capienza={capienzaConsulenza()}
                    durata={duration}
                    lavorativo={lavorativo}
                    oraScelta={slotTime}
                    onScegliOra={(o) => setSlotTime(slotTime === o ? null : o)}
                    consultantId={consultant?.id}
                  />
                )}
                <LineaDelGiorno
                  giorno={giornoAttivo ?? ""}
                  impegni={impegni}
                  liberi={slots}
                  durata={duration}
                  lavorativo={lavorativo}
                  nomeConsulente={consultantName}
                  onApriLead={onOpenLead}
                  //  Durante uno spostamento non si apre un secondo spostamento:
                  //  si finisce quello in corso o lo si annulla.
                  onSposta={
                    spostamento
                      ? undefined
                      : (l) => {
                          setSpostamento(l);
                          setGiornoDest(date ?? "");
                          setSlotTime(null);
                        }
                  }
                  onScegliOra={(o) => setSlotTime(slotTime === o ? null : o)}
                />
              </>
            )}
          </SezioneFinestra>
        </div>

        {/* ── DESTRA: si sposta, oppure si crea ──────────────────────────── */}
        <div className="space-y-3 px-4 py-4 sm:px-5">
          {spostamento ? (
            <>
              <SezioneFinestra titolo="Cosa si sta spostando" classeCorpo="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      PUNTO_TONO[tonoStato(spostamento.data.stato)],
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-900">
                    {spostamento.data.nome} {spostamento.data.cognome}
                  </span>
                </div>
                <p className="text-[12px] text-slate-600">
                  Adesso è {date ? formatDate(date, { short: true }) : "—"}
                  {oraAttuale ? ` alle ${oraAttuale}` : " senza orario"} ·{" "}
                  {ETICHETTA_IMPEGNO[tipoImpegno(spostamento, date ?? "")]}
                </p>
              </SezioneFinestra>

              <SezioneFinestra titolo="Dove va" classeCorpo="p-4 space-y-3">
                <CampoFinestra
                  etichetta="Nuovo giorno"
                  nota="Cambiando giorno, a sinistra compare com'è messo quel giorno."
                >
                  <Input
                    type="date"
                    value={giornoDest}
                    onChange={(e) => {
                      setGiornoDest(e.target.value);
                      setSlotTime(null);
                    }}
                    className={CLASSE_CAMPO}
                  />
                </CampoFinestra>

                {/*  Gli stessi orari, letti allo stesso modo del resto della
                    pagina: divisi in mattina e pomeriggio e senza quelli già
                    passati, che spostando un appuntamento a oggi erano il modo
                    più facile per rimandarlo nel passato. */}
                <OrariDaOffrire
                  giorno={giornoAttivo ?? ""}
                  liberi={slots}
                  presiPerOra={quantiPerOra}
                  capienza={capienzaConsulenza()}
                  durata={duration}
                  lavorativo={lavorativo}
                  oraScelta={slotTime}
                  onScegliOra={(o) => setSlotTime(slotTime === o ? null : o)}
                  consultantId={consultant?.id}
                  titolo="Nuovo orario"
                />
              </SezioneFinestra>

              <NotaFinestra tono={slotTime ? "conferma" : "neutro"} icona={Clock}>
                {slotTime
                  ? `Nuovo appuntamento: ${formatDate(giornoDest, { short: true })} alle ${slotTime} (${duration}′).`
                  : "Scegli il nuovo orario: si salva solo quando premi il tasto in fondo."}
              </NotaFinestra>
            </>
          ) : (
            <>
              <SezioneFinestra
                titolo="Come prosegue"
                nota="Determina cosa viene salvato in agenda."
                classeCorpo="p-4"
              >
                <div className="grid gap-1.5">
                  {QUICK_STATUSES.map((s) => (
                    <VoceScelta
                      key={s.v}
                      selezionata={statusV === s.v}
                      onClick={() => {
                        setStatusV(s.v);
                        if (!s.needsTime) setSlotTime(null);
                      }}
                      titolo={s.label}
                      nota={s.hint}
                      punto={PUNTO_TONO[tonoStato(s.v)]}
                    />
                  ))}
                </div>
              </SezioneFinestra>

              {status.needsTime && (
                <NotaFinestra tono={slotTime ? "conferma" : "neutro"} icona={Clock}>
                  {slotTime ? (
                    <>
                      Orario scelto: <strong className="font-semibold">{slotTime}</strong> (
                      {duration}
                      ′)
                    </>
                  ) : (
                    //  I buchi non si aprono più (gli orari stanno già tutti in
                    //  fila): la frase mandava a cercare un gesto che non
                    //  esiste, cioè il modo più sicuro per far credere che
                    //  l'orario non si possa scegliere.
                    "Premi un orario nella fila «Da offrire al telefono», oppure lascia vuoto e decidilo dopo."
                  )}
                </NotaFinestra>
              )}

              {!status.needsTime && (
                <SezioneFinestra titolo="Quando ricontattare" classeCorpo="p-4">
                  <CampoFinestra
                    etichetta={
                      statusV === "fissa_meet_dopo"
                        ? "Data per fissare il meet"
                        : "Data della richiamata"
                    }
                    nota={`Se lasci il campo com'è, vale il giorno aperto in agenda (${date ? formatDate(date, { short: true }) : "—"}).`}
                  >
                    <Input
                      type="date"
                      value={followUpDate || date || ""}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className={CLASSE_CAMPO}
                    />
                  </CampoFinestra>
                </SezioneFinestra>
              )}

              {statusV === "viene_in_sede" && (
                <SezioneFinestra
                  titolo="Acconto al primo incontro"
                  nota="Finisce nella scheda Installazioni."
                  classeCorpo="p-4 space-y-3"
                >
                  <div className="flex flex-wrap gap-2">
                    <Pillola attiva={!accontoLasciato} onClick={() => setAccontoLasciato(false)}>
                      Lo deve lasciare
                    </Pillola>
                    <Pillola attiva={accontoLasciato} onClick={() => setAccontoLasciato(true)}>
                      Sì, lo lascia
                    </Pillola>
                  </div>
                  {accontoLasciato && (
                    <CampoFinestra etichetta="Importo acconto" nota="Opzionale.">
                      <Input
                        type="number"
                        value={accontoImporto}
                        onChange={(e) => setAccontoImporto(e.target.value)}
                        placeholder="€"
                        className={CLASSE_CAMPO}
                      />
                    </CampoFinestra>
                  )}
                </SezioneFinestra>
              )}

              <SezioneFinestra titolo="Chi è" classeCorpo="p-4 space-y-3">
                <CampoFinestra etichetta="Nome e cognome" obbligatorio>
                  <Input
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Mario Rossi"
                    className={CLASSE_CAMPO}
                  />
                </CampoFinestra>
                <CampoFinestra etichetta="Telefono" obbligatorio>
                  <Input
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="+39…"
                    className={CLASSE_CAMPO}
                  />
                </CampoFinestra>
                <CampoFinestra etichetta="Note">
                  <Textarea
                    rows={2}
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="Note rapide…"
                    className={`${CLASSE_AREA} resize-none`}
                  />
                </CampoFinestra>
              </SezioneFinestra>
            </>
          )}
        </div>
      </div>
    </Finestra>
  );
}
