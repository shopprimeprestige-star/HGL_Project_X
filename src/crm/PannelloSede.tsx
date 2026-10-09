/** ─────────────────────────────────────────────────────────────────────────
 *  PannelloSede — LA VISITA IN SEDE: IL SEGNO FUORI, IL PANNELLO DENTRO
 *
 *  A COSA SERVE
 *  "Viene in sede" era una PAROLA in mezzo ad altre parole: nell'elenco stava
 *  scritto come tutto il resto, e per sapere quando arrivava la persona bisognava
 *  aprire la scheda. Qui la visita diventa due cose:
 *
 *   · FUORI — <TesseraSede/>: un blocco grafico con la data, l'ora e lo spillo
 *     della sede. Si riconosce con la coda dell'occhio, senza leggere: chi viene
 *     di persona non somiglia più a chi fa la consulenza a distanza.
 *     Negli elenchi MISTI, dove le righe non sono tutte visite in sede, lo
 *     stesso segno si usa in linea: <SpilloSede/>.
 *   · DENTRO — <FinestraSede/>: una sola finestra che risponde alle domande vere
 *     (quando viene · chi lo riceve · cosa deve portare · cosa ha già pagato ·
 *     cosa manca), con le azioni SEMPRE in fondo, nello stesso posto.
 *
 *  LE TRE PAROLE DELLO STATO
 *  Atteso · Arrivato · Non presentato. Prima erano cinque diciture diverse fra
 *  elenco e scheda ("venuto", "confermata", "da confermare"…): tre parole sole,
 *  usate uguali nei due posti, si imparano una volta.
 *
 *  IL COLORE È UN SEGNALE, NON UNA DECORAZIONE
 *  ambra = manca un passaggio · sky = tocca adesso · emerald = fatto ·
 *  rose = perso o scaduto · slate = in agenda, nulla da fare. Sono le stesse
 *  tinte delle fasi della trattativa (ui.tsx): nessuna tavolozza nuova.
 *
 *  PERCHÉ IL PANNELLO LAVORA SU UNA BOZZA
 *  <FinestraSede/> accumula le modifiche in un patch e le scrive tutte insieme
 *  con "Salva". Scrivere a ogni tocco farebbe ricaricare i lead dal contesto e
 *  quello che si sta compilando sparirebbe sotto le mani. Le azioni a un clic
 *  della LISTA (/CRM/sede) scrivono invece subito: lì non c'è nessuna bozza
 *  aperta e nessun rischio.
 *
 *  NIENTE FINESTRE DENTRO FINESTRE
 *  Dalla finestra della sede non se ne apre una seconda: il motivo del mancato
 *  acquisto e il passo successivo si scelgono QUI dentro, e "Apri la scheda
 *  completa" chiude prima questa finestra e poi apre quella.
 *
 *  DOVE SI INNESTA
 *   · /CRM/sede (routes/CRM.sede.tsx) — elenco + <FinestraSede/>
 *   · LeadDialog.tsx — il corpo si può montare da solo dentro la scheda:
 *
 *       {form.stato === "viene_in_sede" && (
 *         <PannelloSede
 *           dati={form}
 *           onCambia={(patch) => setForm((f) => ({ ...f, ...patch }))}
 *           consulenti={consultants}
 *         />
 *       )}
 *  ───────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  ExternalLink,
  MapPin,
  Package,
  StickyNote,
  UserCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import type { Consultant, Lead, LeadData, LeadStatus } from "./types";
//  Chi fa le consulenze si chiede lì, e solo lì: vedi la testata di quel file.
import { NotaSoloConsulenti, consulentiPerConsulenza } from "./chi-fa-la-consulenza";
import { LOST_REASON_LABEL, LOST_REASON_OPTIONS, LOST_STATUSES } from "./types";
//  ETICHETTA_STATO sta in ui.tsx, non in types.ts: types.ts espone
//  LEAD_STATUS_LABEL e ui.tsx lo riespone col nome italiano. Importarlo dal
//  posto sbagliato compilava solo finché nessuno montava questo file.
import {
  CLASSI_TONO,
  Chip,
  ETICHETTA_STATO,
  PUNTO_TONO,
  TESTO_TONO,
  dataBreve,
  etichettaQuando,
  eur,
  giorniDaOggi,
  soloData,
  tonoStato,
  type Tono,
} from "./ui";
import {
  CLASSE_AREA,
  CLASSE_CAMPO,
  CampoFinestra,
  DatoFinestra,
  Finestra,
  KpiFinestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
  VoceScelta,
} from "./ui/Finestra";

/* ═══════════════════════════════════════════════════════════════════════════
   1. I CAMPI DELLA VISITA — dove vivono e perché non stanno in types.ts
   ═════════════════════════════════════════════════════════════════════════ */

/** Com'è andata la visita. Sono due fatti, non due stati della trattativa: uno
 *  è "si è presentato", l'altro è "cosa abbiamo deciso" — e vanno tenuti
 *  separati, altrimenti un cliente arrivato che ci pensa su risulta identico a
 *  uno che non si è presentato. */
export type EsitoSede = "arrivato" | "non_presentato";

/** ── LE INFORMAZIONI CHE MANCAVANO ────────────────────────────────────────
 *  "Ha confermato?", "è arrivato?", "cosa deve portare?" non esistevano da
 *  nessuna parte: chi lavorava la lista se le ricordava a memoria, e il giorno
 *  dopo nessuno sapeva più chi avesse confermato cosa. Vivono nel JSON del lead
 *  — la colonna `data` è JSONB e accetta chiavi nuove senza migrazione — e sono
 *  dichiarate QUI e non in types.ts solo perché types.ts non fa parte di questo
 *  intervento: appena ci si potrà mettere mano, queste righe si spostano dentro
 *  LeadData e i due aiutanti sotto spariscono senza toccare nient'altro. */
export interface CampiSede {
  /** il cliente ha detto "ci sarò" */
  sedeConfermata?: boolean;
  /** ISO — quando è arrivata la conferma (serve alla mini-storia) */
  sedeConfermataIl?: string;
  sedeEsito?: EsitoSede;
  /** ISO — quando è stato registrato l'esito */
  sedeEsitoIl?: string;
  /** cosa deve portare con sé: si dice al telefono e si dimentica subito */
  sedePorta?: string[];
}

/** Legge i campi della visita da una scheda. */
export const leggiSede = (d: LeadData): CampiSede => d as LeadData & CampiSede;

/** Prepara una modifica dei campi della visita per `updateLead`/`onCambia`.
 *  Il doppio passaggio da `unknown` è l'unico punto in cui si forza il tipo:
 *  concentrarlo qui significa che il giorno in cui i campi entrano in LeadData
 *  si cancella questa riga e il resto del CRM non se ne accorge. */
export const patchSede = (p: CampiSede): Partial<LeadData> => p as unknown as Partial<LeadData>;

/** Le cose che il cliente si dimentica sempre. L'elenco è corto di proposito:
 *  una lista lunga non viene letta al telefono, e queste cinque coprono tutto
 *  quello che fa saltare o allungare un appuntamento in sede. */
export const COSE_DA_PORTARE = [
  "Documento d'identità",
  "Codice fiscale",
  "Foto o referti",
  "Protesi attuale",
  "Accompagnatore",
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   2. LO STATO DELLA VISITA — una sola definizione per elenco e pannello
   ═════════════════════════════════════════════════════════════════════════ */

/** Le situazioni in cui può trovarsi una visita. Sono le stesse che filtrano
 *  l'elenco: se elenco e pannello le calcolassero per conto proprio, prima o poi
 *  una riga risulterebbe "confermata" in un posto e no nell'altro. */
export type StatoVisita = "da_fissare" | "atteso" | "confermato" | "arrivato" | "non_presentato";

/** Tre parole per il cliente (atteso · arrivato · non presentato) più i due
 *  passaggi che le precedono. "Confermato" resta accanto ad "atteso" perché è la
 *  stessa attesa, ma con la parola del cliente dentro. */
export const ETICHETTA_VISITA: Record<StatoVisita, string> = {
  da_fissare: "Data da fissare",
  atteso: "Atteso",
  confermato: "Atteso · confermato",
  arrivato: "Arrivato",
  non_presentato: "Non presentato",
};

export interface Visita {
  /** AAAA-MM-GG, "" se non ancora fissata */
  data: string;
  ora: string;
  fissata: boolean;
  /** distanza in giorni: negativo = passata, 0 = oggi */
  giorni: number;
  oggi: boolean;
  /** "oggi · 15:00", "in ritardo di 2 g", "data da fissare" */
  quando: string;
  /** giorni di ritardo, 0 se non è scaduta */
  ritardo: number;
  confermata: boolean;
  esito?: EsitoSede;
  stato: StatoVisita;
  /** la frase che dice cosa fare adesso, non dove sta la pratica */
  cosa: string;
  /** l'orario è passato e nessuno ha detto com'è andata: è il caso che va
   *  chiuso PRIMA di tutto, perché ogni giorno che passa rende più difficile
   *  ricostruire cos'è successo */
  daChiudere: boolean;
}

const minuti = (ora: string): number => {
  const [h, m] = ora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Lo stato della visita, calcolato una volta sola per tutto il CRM.
 *  `adesso` si passa dall'esterno quando chi chiama tiene il proprio orologio
 *  (la pagina /CRM/sede resta aperta tutto il giorno e lo fa battere ogni
 *  minuto): così la riga cambia gruppo quando l'appuntamento finisce davvero,
 *  e non quando qualcuno ricarica. Il GIORNO invece resta quello di
 *  `giorniDaOggi`, che è già l'orologio comune di tutto il CRM. */
export function visitaDi(d: LeadData, adesso: Date = new Date()): Visita {
  const s = leggiSede(d);
  const data = soloData(d.dataVieneInSede);
  const ora = d.oraVieneInSede || "";
  const fissata = !!data;
  //  giorniDaOggi può dire "non lo so" (data illeggibile): trattala come una
  //  visita senza data, che è ciò che è.
  const gRaw = fissata ? giorniDaOggi(data) : 0;
  const giorni = Number.isNaN(gRaw) ? 0 : gRaw;
  const confermata = !!s.sedeConfermata;
  const esito = s.sedeEsito;

  //  Una visita di oggi è "passata" solo quando l'appuntamento è FINITO. Prima
  //  di mezzogiorno chiedere "è arrivato?" per un appuntamento delle 17 è
  //  rumore; chiederlo alle 15:01 per quello delle 15:00 lo è altrettanto,
  //  perché la persona è seduta al tavolo in quel momento. La durata è quella
  //  prenotata in agenda: 45 minuti quando non è stata scelta.
  const fine = ora ? minuti(ora) + (Number(d.durataVieneInSede) || 45) : 0;
  const oraPassata = !ora || fine <= adesso.getHours() * 60 + adesso.getMinutes();
  const daChiudere = fissata && !esito && (giorni < 0 || (giorni === 0 && oraPassata));

  const stato: StatoVisita = esito
    ? esito
    : !fissata
      ? "da_fissare"
      : confermata
        ? "confermato"
        : "atteso";

  const cosa = esito
    ? esito === "arrivato"
      ? d.stato === "viene_in_sede"
        ? "Scegli il passo successivo"
        : "Visita chiusa"
      : "Riprogramma o chiudi la trattativa"
    : !fissata
      ? "Fissa la data della visita"
      : daChiudere
        ? "Segna se si è presentato"
        : !confermata
          ? "Fatti confermare la presenza"
          : giorni === 0
            ? "Oggi lo ricevi in sede"
            : "In agenda: nulla da fare fino al giorno";

  return {
    data,
    ora,
    fissata,
    giorni,
    oggi: fissata && giorni === 0,
    quando: fissata ? etichettaQuando(data, ora || undefined) : "data da fissare",
    ritardo: fissata && giorni < 0 ? -giorni : 0,
    confermata,
    esito,
    stato,
    cosa,
    daChiudere,
  };
}

/** ── IL TONO DI UNA VISITA ────────────────────────────────────────────────
 *  Non è il colore dello STATO ma quello dell'URGENZA, che è la cosa che fa
 *  decidere: una visita confermata fra sei giorni e una di stamattina hanno lo
 *  stesso stato e due priorità opposte. L'ordine dei controlli è l'ordine in cui
 *  ci si fanno le domande davanti alla riga. */
export function tonoVisita(v: Visita): Tono {
  if (v.esito === "arrivato") return "vinta"; // emerald: fatto
  if (v.esito === "non_presentato") return "persa"; // rose: perso
  //  L'esito che manca dalla mattina è un passaggio ancora da fare (ambra);
  //  quello che manca da ieri è una visita rimasta muta, e ogni giorno che
  //  passa rende più difficile ricostruire cos'è successo (rose). Distinguerli
  //  fa vedere, dentro lo stesso gruppo, da quale riga si comincia.
  if (v.daChiudere) return v.giorni === 0 ? "in_sospeso" : "persa";
  if (!v.fissata) return "in_sospeso"; // ambra: manca un passaggio
  if (v.oggi) return "da_lavorare"; // sky: tocca adesso
  if (!v.confermata) return "in_sospeso"; // ambra: manca la conferma
  return "chiusa"; // slate: in agenda, nulla da fare
}

/** ── COSA MANCA ───────────────────────────────────────────────────────────
 *  L'elenco dei passaggi ancora aperti, nell'ordine in cui vanno chiusi. Serve
 *  in due posti — la riga dell'elenco e la testa del pannello — e deve dire le
 *  stesse cose con le stesse parole. */
export function cosaMancaVisita(d: LeadData, visita?: Visita): string[] {
  //  Se chi chiama ha già la visita in mano gliela si prende: ricalcolarla
  //  significherebbe rileggere l'orologio a metà riga e rischiare che la
  //  tessera e la frase "Manca:" della stessa riga dicano due cose diverse.
  const v = visita ?? visitaDi(d);
  const manca: string[] = [];
  if (!v.fissata) manca.push("data e ora");
  if (!d.consulenteId) manca.push("chi lo riceve");
  if (v.fissata && !v.confermata && !v.esito) manca.push("conferma del cliente");
  if (v.daChiudere) manca.push("esito della visita");
  if (d.accontoVieneInSede && (Number(d.payment?.accontoPagato) || 0) <= 0)
    manca.push("acconto da incassare");
  return manca;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. IL SEGNO FUORI — la tessera, lo spillo e la pastiglia
   ═════════════════════════════════════════════════════════════════════════ */

const FMT_TESSERA = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** ── LA TESSERA ───────────────────────────────────────────────────────────
 *  Il blocco che dice "questa persona viene QUI, questo giorno, a quest'ora".
 *
 *  ── ⚠️ RIFATTA: ERA UN BLOCCO PIENO PER DIRE CHE NON SI SAPEVA NIENTE ─────
 *  Nello stato «da fissare» la tessera era un rettangolo ambra pieno, bordo
 *  tratteggiato, due righe di testo maiuscolo — cioè il segno più pesante
 *  della riga usato per dire l'unica cosa che NON si sa: quando viene. In un
 *  elenco di dieci persone da richiamare, dieci blocchi ambra affiancati
 *  diventano una parete: l'occhio ci sbatte contro e non trova più il nome,
 *  che è quello che serve per alzare il telefono.
 *
 *  Adesso il fondo è bianco e il colore sta dove ha un significato:
 *   · il PUNTO colorato porta l'urgenza — è piccolo, e da lontano si legge
 *     comunque perché è l'unica macchia di colore della tessera;
 *   · l'etichetta «in sede» è minuta e grigia: dice il genere, non il fatto;
 *   · la riga grande è il FATTO — l'ora quando c'è, «da fissare» quando manca.
 *  Così una tessera fissata e una da fissare si distinguono per quello che
 *  dicono, non per quanto inchiostro occupano.
 *
 *  ⚠️ La larghezza fissa resta: incolonnate, le tessere formano una colonna di
 *   date leggibile a scorrimento, ed è il modo in cui questa pagina si usa. */
export function TesseraSede({ visita, className }: { visita: Visita; className?: string }) {
  const tono = tonoVisita(visita);
  const giorno = visita.fissata ? FMT_TESSERA.format(new Date(`${visita.data}T00:00:00`)) : "";
  return (
    <span
      //  Il segno si legge senza parole, ma chi lo incontra la prima volta deve
      //  poterlo interrogare: la spiegazione a comparsa dice per esteso quello
      //  che il blocco dice per colore e posizione.
      title={`In sede · ${visita.quando} · ${ETICHETTA_VISITA[visita.stato]}`}
      className={cn(
        "flex w-[92px] shrink-0 flex-col justify-center gap-0.5 rounded-lg border border-slate-200 bg-card px-2 py-1.5",
        className,
      )}
    >
      <span className="flex items-center gap-1 whitespace-nowrap text-[9.5px] font-semibold uppercase leading-none tracking-[0.08em] text-slate-500">
        {/*  Il punto porta l'urgenza. È l'unica macchia di colore della
            tessera, quindi non ha bisogno di essere grande per essere vista —
            e non compete col nome della persona, che è il vero bersaglio della
            riga. */}
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PUNTO_TONO[tono])} aria-hidden />
        <MapPin className="h-2.5 w-2.5 shrink-0" />
        in sede
      </span>
      {visita.fissata ? (
        <>
          <span className="whitespace-nowrap text-[16px] font-bold leading-tight tabular-nums text-slate-900">
            {visita.ora || "—:—"}
          </span>
          <span className="truncate text-[10.5px] leading-tight text-slate-500">{giorno}</span>
        </>
      ) : (
        //  Non c'è un'ora da scrivere: il fatto È che manca. Si dice una volta
        //  sola, nel colore dell'urgenza, e non si aggiunge una seconda riga
        //  per riempire lo spazio della prima.
        <span className={cn("text-[12.5px] font-semibold leading-tight", TESTO_TONO[tono])}>
          Da fissare
        </span>
      )}
    </span>
  );
}

/** ── LO SPILLO ────────────────────────────────────────────────────────────
 *  La stessa informazione della tessera, ma in linea. Serve negli elenchi MISTI
 *  — trattative, giornata, ricerca — dove le righe non sono tutte visite in
 *  sede: lì un blocco alto due righe spezzerebbe il ritmo della lista, mentre
 *  la riga deve continuare a dire "questo viene QUI" senza usare una parola in
 *  mezzo ad altre parole. Il segno resta lo spillo più il colore dell'urgenza,
 *  identici a quelli della tessera: è la stessa cosa vista da lontano. */
export function SpilloSede({ visita, className }: { visita: Visita; className?: string }) {
  const tono = tonoVisita(visita);
  return (
    <span
      title={`In sede · ${visita.quando} · ${ETICHETTA_VISITA[visita.stato]}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5",
        "whitespace-nowrap text-[11px] font-medium leading-5",
        CLASSI_TONO[tono],
        !visita.fissata && "border-dashed",
        className,
      )}
    >
      <MapPin className="h-3 w-3 shrink-0" />
      <span className="shrink-0">In sede</span>
      <span className="truncate font-semibold tabular-nums">{visita.quando}</span>
    </span>
  );
}

/** La pastiglia dello stato: le stesse tre parole ovunque. */
export function ChipVisita({ visita, className }: { visita: Visita; className?: string }) {
  return (
    <Chip tono={tonoVisita(visita)} punto className={className}>
      {ETICHETTA_VISITA[visita.stato]}
    </Chip>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. COSA SUCCEDE DOPO LA VISITA
   ═════════════════════════════════════════════════════════════════════════ */

export interface PassoDopoVisita {
  stato: LeadStatus;
  /** cosa è successo davvero, detto come lo direbbe il consulente */
  nota: string;
  /** questo stato pretende il motivo del mancato acquisto: si sceglie qui sotto,
   *  senza aprire una seconda finestra */
  chiedeMotivo: boolean;
}

const passo = (stato: LeadStatus, nota: string): PassoDopoVisita => ({
  stato,
  nota,
  chiedeMotivo: LOST_STATUSES.includes(stato),
});

/** I passi che hanno senso DOPO una visita, divisi per esito. L'elenco è corto
 *  di proposito: sono le cose che succedono davvero quando qualcuno esce dalla
 *  sede, non i venti stati del CRM. */
export const PASSI_DOPO_VISITA: Record<EsitoSede, PassoDopoVisita[]> = {
  arrivato: [
    //  ⚠️ ERA passo("venduto", …), e "venduto" non si assegna più: oggi una
    //   vendita si chiude dicendo anche COME arriva l'impianto (types.ts). Qui
    //   la scelta è già decisa dai fatti — il cliente è fisicamente nel nostro
    //   centro — quindi la voce resta UNA, e questo elenco resta corto com'è
    //   stato scritto per essere. Se poi l'impianto va spedito, il modo di
    //   consegna si corregge dalla pagina installazioni, che è il posto che
    //   possiede quel campo.
    //  ⚠️ E resta una differenza da sapere: questa voce SCRIVE LO STATO senza
    //   passare da ChiusuraDialog, perché questo pannello accumula un patch e
    //   lo salva col suo pulsante, mentre quella finestra salva subito — le due
    //   cose non si incastrano senza riscrivere il pannello. Conseguenza: da
    //   qui la vendita si registra senza importi, e i soldi restano da mettere
    //   dalla scheda. È come funzionava anche prima con "venduto": non è un
    //   guasto nuovo, ma è l'ultimo punto del CRM in cui si vince un lead senza
    //   che nessuno chieda un euro.
    passo("posa_in_sede", "Ha comprato: posa nel nostro centro, si passa alla consegna"),
    passo("in_attesa_acconto", "Ha detto sì ma l'acconto non è ancora arrivato"),
    passo("sta_valutando", "Ci pensa: resta aperta e va ripresa"),
    passo("da_ricontattare", "Si risente in una data concordata"),
    passo("annullato", "Non se ne fa nulla"),
  ],
  non_presentato: [
    passo("da_spostare", "Si riprogramma la visita"),
    passo("da_ricontattare", "Prima lo si risente, poi si rifissa"),
    passo("no_show", "Non si è presentato e non risponde più"),
    passo("annullato", "Non interessato"),
  ],
};

/** L'elenco dei passi successivi. Vive qui perché lo usano in due — il pannello
 *  e (in futuro) la scheda — e devono proporre le stesse voci con le stesse
 *  parole. */
export function ScelteDopoVisita({
  esito,
  statoAttuale,
  onScegli,
  className,
}: {
  esito: EsitoSede;
  statoAttuale: LeadStatus;
  onScegli: (p: PassoDopoVisita) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {PASSI_DOPO_VISITA[esito].map((p) => (
        <VoceScelta
          key={p.stato}
          titolo={ETICHETTA_STATO[p.stato]}
          nota={p.nota}
          punto={PUNTO_TONO[tonoStato(p.stato)]}
          selezionata={statoAttuale === p.stato}
          onClick={() => onScegli(p)}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. LA MINI-STORIA — cosa è già successo, in ordine
   ═════════════════════════════════════════════════════════════════════════ */

interface VoceStoria {
  cosa: string;
  quando: string;
  fatto: boolean;
  tono: Tono;
}

/** Le tappe che una visita attraversa. Le voci non ancora avvenute restano in
 *  elenco, spente: vedere cosa manca vale quanto vedere cosa c'è. */
function storiaDi(d: LeadData): VoceStoria[] {
  const s = leggiSede(d);
  const v = visitaDi(d);
  const acconto = Number(d.payment?.accontoPagato) || 0;
  const meeting = soloData(d.dataMeeting);
  const voci: VoceStoria[] = [
    {
      cosa: "Trattativa aperta",
      quando: dataBreve(d.createdAt),
      fatto: true,
      tono: "neutro",
    },
  ];
  if (meeting) {
    const svolta = giorniDaOggi(meeting) < 0;
    voci.push({
      cosa: svolta ? "Consulenza a distanza svolta" : "Consulenza a distanza in programma",
      quando: etichettaQuando(meeting, d.oraMeeting || undefined),
      fatto: svolta,
      tono: "in_corso",
    });
  }
  voci.push({
    cosa: v.fissata ? "Appuntamento in sede fissato" : "Appuntamento da fissare",
    quando: v.quando,
    fatto: v.fissata,
    tono: "in_corso",
  });
  voci.push({
    cosa: v.confermata ? "Presenza confermata dal cliente" : "Conferma non ancora arrivata",
    quando: s.sedeConfermataIl ? dataBreve(s.sedeConfermataIl) : "in attesa",
    fatto: v.confermata,
    tono: "in_corso",
  });
  voci.push({
    cosa: v.esito
      ? v.esito === "arrivato"
        ? "Arrivato in sede"
        : "Non si è presentato"
      : "Esito della visita",
    quando: s.sedeEsitoIl ? dataBreve(s.sedeEsitoIl) : "da registrare",
    fatto: !!v.esito,
    tono: v.esito === "non_presentato" ? "persa" : "vinta",
  });
  if (acconto > 0) {
    voci.push({
      cosa: `Acconto incassato · ${eur(acconto)}`,
      quando: d.payment?.dataPagamento ? dataBreve(d.payment.dataPagamento) : "—",
      fatto: true,
      tono: "vinta",
    });
  }
  return voci;
}

function Storia({ voci }: { voci: VoceStoria[] }) {
  return (
    <ol>
      {voci.map((v, i) => (
        <li key={v.cosa} className="flex gap-2.5">
          <span className="flex flex-col items-center">
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                v.fatto ? PUNTO_TONO[v.tono] : "bg-slate-300",
              )}
            />
            {i < voci.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
          </span>
          <span className={cn("min-w-0 flex-1", i < voci.length - 1 && "pb-3")}>
            <span
              className={cn(
                "block truncate text-[12.5px] font-medium",
                v.fatto ? "text-slate-900" : "text-slate-400",
              )}
            >
              {v.cosa}
            </span>
            <span className="block truncate text-[11px] text-slate-500">{v.quando}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. IL PANNELLO — il corpo, senza contenitore
   ═════════════════════════════════════════════════════════════════════════ */

const DURATE = [30, 45, 60, 90];

export function PannelloSede({
  dati,
  onCambia,
  consulenti,
  className,
}: {
  /** la bozza aperta: il pannello legge da qui, non dal database */
  dati: LeadData;
  /** aggiorna la bozza; il salvataggio resta un gesto solo, in fondo */
  onCambia: (patch: Partial<LeadData>) => void;
  consulenti: Consultant[];
  className?: string;
}) {
  const v = visitaDi(dati);
  const s = leggiSede(dati);
  const manca = cosaMancaVisita(dati, v);
  const [nota, setNota] = useState("");

  const consulente = consulenti.find((c) => c.id === dati.consulenteId);
  //  Chi si può mettere sulla visita: solo chi fa consulenze, più chi c'è già
  //  scritto. Regola e ripiego in crm/chi-fa-la-consulenza — nessun filtro
  //  scritto a mano qui, o questo pannello e la scheda del lead finirebbero per
  //  proporre due elenchi diversi per la stessa visita.
  const { elenco: selezionabili, ripiego: ripiegoConsulenti } = consulentiPerConsulenza(
    consulenti,
    { anche: [dati.consulenteId] },
  );
  const acconto = Number(dati.payment?.accontoPagato) || 0;
  const prezzo =
    Number(dati.payment?.prezzoFinaleVendita) || Number(dati.payment?.prezzoTotale) || 0;
  const residuo = prezzo > 0 ? Math.max(0, prezzo - acconto) : 0;
  const porta = s.sedePorta || [];

  /** L'esito si registra insieme al momento in cui lo si registra: senza la
   *  data, la mini-storia della prossima apertura non saprebbe dire "quando". */
  const segnaEsito = (esito: EsitoSede) =>
    onCambia(
      patchSede({
        sedeEsito: v.esito === esito ? undefined : esito,
        sedeEsitoIl: v.esito === esito ? undefined : new Date().toISOString(),
      }),
    );

  const confermaVisita = (confermata: boolean) =>
    onCambia(
      patchSede({
        sedeConfermata: confermata,
        sedeConfermataIl: confermata ? new Date().toISOString() : undefined,
      }),
    );

  /** Spostare la data annulla la conferma: il cliente aveva detto sì a un altro
   *  giorno. Lasciare la spunta accesa è il modo più veloce per ritrovarsi una
   *  sede vuota con la riga che diceva "confermato".
   *
   *  Le due cose partono in UNA sola chiamata, non in due di fila: chi ci
   *  ascolta accumula le modifiche in una bozza, e due chiamate nello stesso
   *  gesto leggono entrambe la bozza com'era PRIMA — la seconda riscriveva
   *  sopra la prima e la data nuova spariva appena la si scriveva. */
  const spostaA = (campo: "dataVieneInSede" | "oraVieneInSede", valore: string) =>
    onCambia({
      [campo]: valore,
      ...(v.confermata ? patchSede({ sedeConfermata: false, sedeConfermataIl: undefined }) : {}),
    } as Partial<LeadData>);

  const alterna = (cosa: string) =>
    onCambia(
      patchSede({
        sedePorta: porta.includes(cosa) ? porta.filter((x) => x !== cosa) : [...porta, cosa],
      }),
    );

  /** La nota rapida si APPENDE con la data davanti: è un diario, non un campo
   *  da sovrascrivere. Chi rilegge la scheda fra un mese deve capire quando è
   *  stata detta una cosa, non solo che è stata detta. */
  const aggiungiNota = () => {
    const testo = nota.trim();
    if (!testo) return;
    const riga = `${dataBreve(new Date().toISOString())} · ${testo}`;
    onCambia({ note: dati.note ? `${dati.note}\n${riga}` : riga });
    setNota("");
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* ── LA TESTA: QUANDO, A CHE PUNTO SIAMO, COSA MANCA ────────────────
          È l'unico blocco colorato del pannello. Non contiene azioni: quelle
          stanno tutte in fondo, dove il pollice le trova sempre. */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
        <TesseraSede visita={v} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipVisita visita={v} />
            {dati.accontoVieneInSede && (
              <Chip tono="in_sospeso" icona={Wallet}>
                Porta l'acconto
              </Chip>
            )}
          </div>
          <div className="mt-1.5 text-[13px] font-semibold leading-tight text-slate-900">
            {v.cosa}
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-slate-500">
            {v.quando}
            {v.ritardo > 0 && ` · scaduta da ${v.ritardo} ${v.ritardo === 1 ? "giorno" : "giorni"}`}
          </div>
          {manca.length > 0 && (
            <div className="mt-1.5 text-[11px] leading-snug text-amber-700">
              Manca: {manca.join(" · ")}
            </div>
          )}
        </div>
      </div>

      {/*  Il consulente è chi riceve la persona: senza, il giorno della visita
          nessuno sa di doverci essere. */}
      {!dati.consulenteId && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          Nessun consulente assegnato: è chi riceve la persona in sede.
        </NotaFinestra>
      )}

      {/* ── 1. QUANDO VIENE ───────────────────────────────────────────────── */}
      <SezioneFinestra
        titolo="Quando viene"
        nota="Spostare la data annulla la conferma già data dal cliente"
        icona={CalendarClock}
        classeCorpo="space-y-3 p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoFinestra etichetta="Data" obbligatorio>
            <Input
              type="date"
              className={CLASSE_CAMPO}
              value={v.data}
              onChange={(e) => spostaA("dataVieneInSede", e.target.value)}
            />
          </CampoFinestra>
          <CampoFinestra etichetta="Ora">
            <Input
              type="time"
              className={CLASSE_CAMPO}
              value={v.ora}
              onChange={(e) => spostaA("oraVieneInSede", e.target.value)}
            />
          </CampoFinestra>
        </div>

        <CampoFinestra etichetta="Durata" nota="Occupa l'agenda del consulente per questo tempo">
          <div className="flex flex-wrap gap-1.5">
            {DURATE.map((m) => (
              <Pillola
                key={m}
                attiva={(dati.durataVieneInSede || 45) === m}
                onClick={() => onCambia({ durataVieneInSede: m })}
              >
                {m} min
              </Pillola>
            ))}
          </div>
        </CampoFinestra>

        <CampoFinestra
          etichetta="Ha confermato?"
          nota="La conferma del cliente: senza, la sede rischia di restare vuota"
        >
          <div className="flex flex-wrap gap-1.5">
            <Pillola attiva={v.confermata} onClick={() => confermaVisita(true)}>
              <Check className="h-3.5 w-3.5" /> Sì, ci sarà
            </Pillola>
            <Pillola attiva={!v.confermata} onClick={() => confermaVisita(false)}>
              Non ancora
            </Pillola>
            {v.confermata && s.sedeConfermataIl && (
              <span className="self-center text-[11px] text-slate-500">
                confermato il {dataBreve(s.sedeConfermataIl)}
              </span>
            )}
          </div>
        </CampoFinestra>
      </SezioneFinestra>

      {/* ── 2. CHI LO RICEVE ──────────────────────────────────────────────── */}
      <SezioneFinestra
        titolo="Chi lo riceve"
        nota="Il consulente che sarà in sede quel giorno"
        icona={UserRound}
        classeCorpo="space-y-3 p-4"
      >
        {/*  ⚠️ Ricevere in sede È fare la consulenza: la nota qui sopra lo dice
            già («il consulente che sarà in sede quel giorno»), e l'elenco deve
            dire la stessa cosa. Chi è già scritto su questa visita resta fra le
            pastiglie anche senza spunta, o riaprendo il pannello sparirebbe il
            nome di chi quel giorno c'è davvero. */}
        <div className="flex flex-wrap gap-1.5">
          {selezionabili.map((c) => (
            <Pillola
              key={c.id}
              attiva={dati.consulenteId === c.id}
              onClick={() => onCambia({ consulenteId: dati.consulenteId === c.id ? null : c.id })}
            >
              {c.data.nome}
            </Pillola>
          ))}
          {selezionabili.length === 0 && (
            <span className="text-[11px] text-slate-500">Nessun consulente in anagrafica.</span>
          )}
        </div>
        <NotaSoloConsulenti ripiego={ripiegoConsulenti} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/*  Il numero è premibile: la conferma della presenza si chiede al
              telefono, e da qui la si chiede senza chiudere il pannello e
              senza ricopiare il numero a mano. */}
          <DatoFinestra etichetta="Telefono">
            {dati.telefono ? (
              <a href={`tel:${dati.telefono}`} className="underline underline-offset-2">
                {dati.telefono}
              </a>
            ) : (
              "—"
            )}
          </DatoFinestra>
          <DatoFinestra etichetta="Città">{dati.citta || "—"}</DatoFinestra>
          <DatoFinestra etichetta="Lo riceve">
            {consulente?.data.nome || "Da assegnare"}
          </DatoFinestra>
          <DatoFinestra etichetta="Durata">{dati.durataVieneInSede || 45} min</DatoFinestra>
        </div>
      </SezioneFinestra>

      {/* ── 3. COSA DEVE PORTARE ──────────────────────────────────────────── */}
      <SezioneFinestra
        titolo="Cosa deve portare"
        nota="Si dice al telefono e si dimentica: qui resta scritto"
        icona={Package}
        classeCorpo="space-y-3 p-4"
      >
        <div className="flex flex-wrap gap-1.5">
          {COSE_DA_PORTARE.map((c) => (
            <Pillola key={c} attiva={porta.includes(c)} onClick={() => alterna(c)}>
              {c}
            </Pillola>
          ))}
        </div>
        <CampoFinestra
          etichetta="Acconto in sede"
          nota="Se è previsto si incassa allo sportello: il consulente deve saperlo prima"
        >
          <div className="flex flex-wrap gap-1.5">
            <Pillola
              attiva={!!dati.accontoVieneInSede}
              onClick={() => onCambia({ accontoVieneInSede: true })}
            >
              <Wallet className="h-3.5 w-3.5" /> Sì, porta l'acconto
            </Pillola>
            <Pillola
              attiva={!dati.accontoVieneInSede}
              onClick={() => onCambia({ accontoVieneInSede: false })}
            >
              Non previsto
            </Pillola>
          </div>
        </CampoFinestra>
        {(dati.codiceColore || dati.dettagliImpianto) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {dati.codiceColore && (
              <DatoFinestra etichetta="Codice colore">{dati.codiceColore}</DatoFinestra>
            )}
            {dati.dettagliImpianto && (
              <DatoFinestra etichetta="Impianto">{dati.dettagliImpianto}</DatoFinestra>
            )}
          </div>
        )}
      </SezioneFinestra>

      {/* ── 4. COSA HA GIÀ PAGATO E COSA MANCA ────────────────────────────── */}
      <SezioneFinestra
        titolo="Conti"
        nota="Quanto è già entrato e quanto resta da incassare"
        icona={Wallet}
        classeCorpo="grid grid-cols-1 gap-2 p-4 sm:grid-cols-3"
      >
        <KpiFinestra
          etichetta="Preventivo"
          valore={prezzo > 0 ? eur(prezzo) : "Da definire"}
          nota={prezzo > 0 ? "prezzo concordato" : "nessun importo in scheda"}
        />
        <KpiFinestra
          etichetta="Già incassato"
          valore={eur(acconto)}
          nota={
            acconto > 0
              ? dati.payment?.dataPagamento
                ? `acconto del ${dataBreve(dati.payment.dataPagamento)}`
                : "acconto versato"
              : "nessun pagamento"
          }
        />
        <KpiFinestra
          etichetta="Resta da incassare"
          valore={prezzo > 0 ? eur(residuo) : "—"}
          nota={
            dati.accontoVieneInSede ? "una parte si incassa in sede" : "da saldare alla consegna"
          }
          forte
        />
      </SezioneFinestra>

      {/* ── 5. COM'È ANDATA ───────────────────────────────────────────────
          Compare solo quando c'è una data: prima, "è arrivato?" è una domanda
          senza senso, e mostrarla vuota abitua a saltarla. */}
      {v.fissata && (
        <SezioneFinestra
          titolo="Com'è andata"
          nota="Si registra il giorno stesso: dopo non se lo ricorda più nessuno"
          icona={UserCheck}
          classeCorpo="space-y-2 p-4"
        >
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <VoceScelta
              titolo="È arrivato"
              nota="Si è presentato in sede"
              punto={PUNTO_TONO.vinta}
              selezionata={v.esito === "arrivato"}
              onClick={() => segnaEsito("arrivato")}
            />
            <VoceScelta
              titolo="Non si è presentato"
              nota="Non è venuto all'appuntamento"
              punto={PUNTO_TONO.persa}
              selezionata={v.esito === "non_presentato"}
              onClick={() => segnaEsito("non_presentato")}
            />
          </div>
          {v.esito && s.sedeEsitoIl && (
            <p className="text-[11px] text-slate-500">
              Registrato il {dataBreve(s.sedeEsitoIl)} — si toglie ripremendo la voce scelta.
            </p>
          )}
        </SezioneFinestra>
      )}

      {/* ── 6. E ADESSO — il passo successivo del funnel ───────────────────── */}
      {v.esito && (
        <SezioneFinestra
          titolo="E adesso?"
          nota="Scegliendo, la trattativa passa allo stato successivo"
          icona={ArrowRight}
          classeCorpo="space-y-2 p-4"
        >
          <ScelteDopoVisita
            esito={v.esito}
            statoAttuale={dati.stato}
            onScegli={(p) =>
              onCambia(
                p.chiedeMotivo
                  ? { stato: p.stato, lostReasonAt: new Date().toISOString() }
                  : { stato: p.stato },
              )
            }
          />
          {/*  Il motivo del mancato acquisto si sceglie QUI, non in una seconda
              finestra: una finestra dentro una finestra è il punto in cui si
              preme "chiudi" e si perde tutto quello che si stava facendo. */}
          {LOST_STATUSES.includes(dati.stato) && (
            <CampoFinestra etichetta="Perché è andata persa" obbligatorio>
              <div className="flex flex-wrap gap-1.5">
                {LOST_REASON_OPTIONS.map((m) => (
                  <Pillola
                    key={m}
                    attiva={dati.lostReason === m}
                    onClick={() =>
                      onCambia({
                        lostReason: dati.lostReason === m ? undefined : m,
                        lostReasonAt: new Date().toISOString(),
                      })
                    }
                  >
                    {LOST_REASON_LABEL[m]}
                  </Pillola>
                ))}
              </div>
            </CampoFinestra>
          )}
          {dati.stato !== "viene_in_sede" && (
            <NotaFinestra tono="conferma" icona={Check}>
              La trattativa diventa «{ETICHETTA_STATO[dati.stato]}» quando premi Salva.
            </NotaFinestra>
          )}
        </SezioneFinestra>
      )}

      {/* ── 7. COSA È GIÀ SUCCESSO ────────────────────────────────────────── */}
      <SezioneFinestra titolo="Cosa è già successo" classeCorpo="p-4">
        <Storia voci={storiaDi(dati)} />
      </SezioneFinestra>

      {/* ── 8. NOTA RAPIDA ────────────────────────────────────────────────
          Una riga datata in coda alle note: si scrive mentre si è al telefono,
          senza cercare il campo grande in un'altra linguetta. */}
      <SezioneFinestra titolo="Nota rapida" icona={StickyNote} classeCorpo="space-y-2 p-4">
        <Textarea
          rows={2}
          className={CLASSE_AREA}
          placeholder="Es. arriva con la moglie, chiede di parcheggiare vicino"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => {
            //  Invio aggiunge, Maiusc+Invio va a capo: si scrive e si passa oltre
            //  senza staccare le mani dalla tastiera.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              aggiungiNota();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            Finisce in coda alle note, con la data davanti.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-[12px]"
            disabled={!nota.trim()}
            onClick={aggiungiNota}
          >
            Aggiungi
          </Button>
        </div>
        {dati.note && (
          <p className="max-h-32 overflow-y-auto whitespace-pre-line border-l-2 border-slate-300 pl-2.5 text-[12px] leading-snug text-slate-600">
            {dati.note}
          </p>
        )}
      </SezioneFinestra>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. LA FINESTRA — il pannello con le azioni in fondo
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ ACCUMULA UN PATCH ─────────────────────────────────────────────
 *  Le modifiche si sommano in `patch` e partono tutte insieme con "Salva": un
 *  solo scritto sul database, un solo ricarico della lista, e il piede della
 *  finestra che dice sempre la stessa cosa nello stesso posto. Il vantaggio
 *  vero è che "Chiudi" torna indietro davvero: finché non si salva, la
 *  trattativa sul database non è stata toccata. */
export function FinestraSede({
  lead,
  aperta,
  onCambio,
  consulenti,
  onSalva,
  onApriScheda,
}: {
  lead: Lead | null;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  consulenti: Consultant[];
  //  `Promise<unknown>` e non `Promise<void>`: chi la riempie è `updateLead`,
  //  che oggi RESTITUISCE se ha salvato davvero. Un tipo che pretende `void`
  //  rifiuterebbe proprio la funzione vera, costringendo il chiamante a
  //  incartarla — e quella carta è il posto in cui l'esito si perde di nuovo.
  onSalva: (id: string, patch: Partial<LeadData>) => Promise<unknown> | void;
  /** apre la scheda completa: la finestra si chiude PRIMA, non si annidano */
  onApriScheda?: (id: string) => void;
}) {
  const [modifiche, setModifiche] = useState<{ id: string; patch: Partial<LeadData> } | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  //  Il patch vale solo per la trattativa che l'ha generato: se si apre un'altra
  //  riga senza aver salvato, le modifiche non la seguono.
  const patch = lead && modifiche?.id === lead.id ? modifiche.patch : {};
  const cambiato = Object.keys(patch).length > 0;
  const dati = lead ? ({ ...lead.data, ...patch } as LeadData) : null;

  //  L'aggiornamento parte dalla bozza PRECEDENTE letta al momento del calcolo,
  //  non da quella catturata al disegno: due modifiche partite dallo stesso
  //  gesto (spostare la data annulla la conferma) si sommano invece di
  //  cancellarsi a vicenda.
  const cambia = (p: Partial<LeadData>) => {
    if (!lead) return;
    setModifiche((prima) => ({
      id: lead.id,
      patch: { ...(prima?.id === lead.id ? prima.patch : {}), ...p },
    }));
  };

  const chiudi = () => {
    setModifiche(null);
    onCambio(false);
  };

  const salva = async () => {
    if (!lead || !cambiato || salvataggio) return;
    setSalvataggio(true);
    try {
      await onSalva(lead.id, patch);
      setModifiche(null);
      onCambio(false);
    } finally {
      setSalvataggio(false);
    }
  };

  const v = dati ? visitaDi(dati) : null;
  const nome = dati ? `${dati.nome || ""} ${dati.cognome || ""}`.trim() || "Senza nome" : "";

  return (
    <Finestra
      aperta={aperta}
      onCambio={(x) => (x ? onCambio(true) : chiudi())}
      titolo="Appuntamento in sede"
      contesto={v ? `${nome} · ${v.quando}` : nome}
      icona={MapPin}
      larghezza="md"
      /*  bloccante: con delle modifiche non salvate, un clic fuori dalla finestra
          le butterebbe via senza dire niente. */
      bloccante={cambiato}
      classeCorpo="p-3 sm:p-4"
      azioni={
        <>
          <div className="mr-auto flex min-w-0 items-center gap-2">
            <span className="truncate text-[11px] text-slate-500">
              {cambiato ? "Modifiche non ancora salvate" : "Nessuna modifica: si può chiudere"}
            </span>
            {lead && onApriScheda && (
              <button
                type="button"
                onClick={() => {
                  chiudi();
                  //  Prima si chiude questa, poi si apre la scheda: due finestre
                  //  aperte nello stesso istante si contendono il focus e
                  //  lasciano la pagina non cliccabile.
                  setTimeout(() => onApriScheda(lead.id), 140);
                }}
                className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-900"
              >
                <ExternalLink className="h-3 w-3" /> Scheda completa
              </button>
            )}
          </div>
          {/*  Con delle modifiche aperte il pulsante dice cosa fa davvero:
              "Chiudi" farebbe pensare a "metti via", e invece butta via quello
              che si è appena compilato. Una domanda di conferma qui aprirebbe
              una finestra dentro la finestra, che è la cosa da non fare. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-[13px]"
            onClick={chiudi}
          >
            {cambiato ? "Annulla le modifiche" : "Chiudi"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 text-[13px]"
            disabled={!cambiato || salvataggio}
            onClick={salva}
          >
            {salvataggio ? "Salvo…" : "Salva"}
          </Button>
        </>
      }
    >
      {dati && <PannelloSede dati={dati} onCambia={cambia} consulenti={consulenti} />}
    </Finestra>
  );
}

/** Le due azioni a un clic dell'elenco: scrivono SUBITO perché lì non c'è
 *  nessuna bozza aperta e nessun rischio di perdere quello che si sta
 *  compilando. Vivono qui per non riscrivere in due posti la regola
 *  "l'esito si registra insieme al momento in cui lo si registra". */
export const patchEsitoSede = (esito: EsitoSede): Partial<LeadData> =>
  patchSede({ sedeEsito: esito, sedeEsitoIl: new Date().toISOString() });

export const patchConfermaSede = (confermata: boolean): Partial<LeadData> =>
  patchSede({
    sedeConfermata: confermata,
    sedeConfermataIl: confermata ? new Date().toISOString() : undefined,
  });
