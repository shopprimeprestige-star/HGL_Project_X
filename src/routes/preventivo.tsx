import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { depositaAnteprimaPreventivo } from "@/shop/anteprima-preventivo";
import { readPointerPref, writePointerPref, makePointerHysteresis } from "@/shop/pointer";
import { PointerDot, type PtrTarget } from "@/shop/PointerDot";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Plus,
  Minus,
  Sparkles,
  FileText,
  ArrowRight,
  Ban,
  RotateCcw,
  Eye,
  Tag,
  Flame,
  Zap,
  Landmark,
  Copy,
  BadgeCheck,
  MessageCircle,
  Wrench,
  RefreshCw,
  MapPin,
  Video,
  Pencil,
  Lock,
  CalendarClock,
  Download,
  Route as RouteIcon,
  X,
  User,
  Mail,
  Phone,
  Percent,
  StickyNote,
  BadgePercent,
  Package,
  Fingerprint,
  Radio,
  Share2,
  Pointer,
  Clock,
  ArrowUpRight,
  Maximize2,
  ChevronDown,
  PenLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { formatPrice } from "@/shop/catalog";
import {
  BASE_SOLUTIONS,
  FITTING_OPTIONS,
  accontoDi,
  buildMenu,
  promoDeadline,
  formatDeadline,
  sectionsFor,
  siPersonalizza,
  TRANSPLANT_ID,
  HAIR_LENGTH_CM,
  vociAiPrezziDiOggi,
  type QuoteMenu,
  DEFAULT_SELECTED,
  preselezione,
  prezzoDiPartenza,
  setPromoDays,
  type PricingOverrides,
  type PartePreventivo,
  chiaveParte,
  parteAccesa,
} from "@/shop/quote-menu";
//  ⚠️ Riaprire un preventivo com'era è una regola, non due righe di
//   assegnazioni: sta in un file suo, puro, e si può provare.
import { configurazioneDa } from "@/shop/riapri-preventivo";
//  ⚠️ Il link «solo preventivo» non mostra più soltanto il preventivo: se il
//   consulente passa ai media, il cliente ci va dietro. La regola sta in un
//   file suo e si prova (vedi proveDelLinkCheSegue).
import { deveAndareSu } from "@/shop/segue-contenuto";
import { CameraDelConsulente } from "@/shop/CameraDelConsulente";
import { PercorsoTimeline, TransplantTimeline, type Steps } from "@/shop/percorso-timeline";
import { DeviceFrame } from "@/shop/DeviceFrame";
//  Pigra: il pacchetto della barra non deve finire in quello della pagina,
//  che la apre anche il cliente (vedi shop/BarraPresentatore).
import { BarraPresentatore as PresenterBar } from "@/shop/BarraPresentatore";
import { BrandLogo } from "@/shop/BrandLogo";
import { useLiveId, useLiveNav } from "@/shop/live";
import { guestContentSeen, useGuestChannel, useCall, reportGuestViewport, gettoneDiQuestoCliente } from "@/shop/call";
import {
  cosaVede,
  haIlSuo,
  hoLaPenna,
  loScorrimentoMiRiguarda,
  siScriveInDue,
  stanzaDelPreventivo,
} from "@/shop/preventivi-di-gruppo";
import { cambiaRegia, useRegiaGruppo } from "@/shop/regia-gruppo";
import { useAttesiDelConsulente } from "@/shop/PlanciaGruppo";
import {
  readAnchor,
  applyAnchor,
  applyRatio,
  logOut,
  scrollContext,
  stopGlide,
  type ScrollAnchor,
} from "@/shop/scrollsync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sfx, primeSfx } from "@/shop/sfx";
import { useLookup } from "@/shop/lookup";
import { copyLink } from "@/shop/copied";
import { setQuoteRef } from "@/shop/quote-ref";
import { codiceDaIndirizzo, getLiveId } from "@/shop/live";
import { codiceDiretta, codiceDaPagina } from "@/shop/codice-diretta";
import {
  type Bozza,
  PARTENZA,
  bozzaUtile,
  leggiBozza,
  salvaBozza,
  eliminaBozza,
  quandoBozza,
} from "@/shop/bozza";
import { getPresenter } from "@/shop/presenter";

//  Il pannello che prepara la bozza di fattura dell'acconto: sta in un file
//  suo perche' questa pagina e' gia' abbastanza lunga.
import { BozzaFattura } from "@/shop/bozza-fattura";
//  La garanzia decisa codice per codice: la mappa e la regola di quale codice
//  comanda quando sono più d'uno.
import { garanziaDa, leggiMappa, type GaranziaCodice, type MappaGaranzie } from "@/shop/garanzia-codici";
//  O il 35% perché la garanzia è compresa, o la cifra fissa di un codice: mai
//  tutte e due. La regola (e il perché) stanno in shop/promo-garanzia.
import {
  disclaimerDi,
  frasiCodiceApplicato,
  giornoEsteso,
  offertaValida,
  prezzoDalSecondo,
  scadenzaEffettiva,
  tipoOfferta,
} from "@/shop/promo-garanzia";
/*  ── LE CONDIZIONI CON CUI UN PREVENTIVO È NATO ───────────────────────────
    Un documento consegnato non cambia da solo: il listino di quel momento
    viaggia col preventivo, e la pagina lo disegna con quello. «Modifica
    preventivo» butta via la fotografia e si riparte dalle condizioni di oggi.
    Vedi shop/condizioni-preventivo. */
//  La causale del bonifico: una frase sola, scritta in un posto solo, che
//  devono leggere uguale la pagina del cliente e la fattura.
import { causaleDi } from "@/shop/causale-bonifico";
import {
  condizioniDa,
  leggiCondizioni,
  listinoDelPreventivo,
  type CondizioniPreventivo,
  type ScelteFatte,
} from "@/shop/condizioni-preventivo";
//  L'aiuto sull'indirizzo: il comportamento sta nel gancio, il disegno scuro
//  in questa pagina (vedi `CampoIndirizzoScuro`).
import { useIndirizziSuggeriti, type IndirizzoScelto } from "@/crm/indirizzo-suggerito";

export const Route = createFileRoute("/preventivo")({
  // ── ANTEPRIMA DEL LINK ────────────────────────────────────────────────────
  //  Chi riceve il link su WhatsApp vede un riquadro: senza queste righe era
  //  quello generico del sito. Ora dice cosa si sta per aprire.
  //  ── L'ANTEPRIMA È DI QUESTO PREVENTIVO ──────────────────────────────────
  //   Il numero del preventivo sta nell'indirizzo (/preventivo?id=IDXXXXX), e
  //   finisce dentro l'indirizzo dell'immagine: così ogni cliente vede nel
  //   riquadro la propria scheda — nome e totale — invece della stessa figura
  //   generica per tutti.
  //   ⚠️ Se il numero non c'è (la pagina aperta per costruire un preventivo
  //   nuovo, non per rileggerne uno) l'indirizzo resta senza codice e la rotta
  //   risponde col marchio dello studio: mai un riquadro rotto.
  head: ({ match }) => {
    const cerca = (match as { search?: Record<string, unknown> } | undefined)?.search;
    //  ⚠️ `sess` come ripiego non è una svista: il link mandato al cliente
    //  prima che il preventivo esista porta SOLO quello, ed è il caso più
    //  frequente. Non è nemmeno un dato in più esposto: chi legge questa
    //  pagina per farne l'anteprima ha già `sess` davanti, sta dentro
    //  l'indirizzo che sta leggendo.
    const rif = String((cerca?.id ?? cerca?.ref ?? cerca?.sess ?? "") as string).trim();
    const T = "Il tuo preventivo, costruito insieme";
    const D =
      "Scegli tu ogni dettaglio: il prezzo si aggiorna mentre decidi. Nessun pagamento adesso.";
    const IMG = `https://hair-genius-hub.hair/api/og/anteprima/preventivo/${encodeURIComponent(rif)}.jpg`;
    return {
      meta: [
        { title: T },
        { name: "description", content: D },
        { name: "robots", content: "noindex" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Hair Genius Labs" },
        { property: "og:title", content: T },
        { property: "og:description", content: D },
        { property: "og:image", content: IMG },
        { property: "og:image:secure_url", content: IMG },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:width", content: "1200" },
        //  ⚠️ Le misure VERE del file. E 675, non di più: i lettori ritagliano
        //  l'anteprima verso il 16:9, e una tela più alta si vede tagliata in
        //  cima — logo e numero del preventivo spariscono.
        { property: "og:image:height", content: "675" },
        { property: "og:locale", content: "it_IT" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: T },
        { name: "twitter:description", content: D },
        { name: "twitter:image", content: IMG },
        { name: "theme-color", content: "#050f24" },
      ],
    };
  },
  component: () => (
    <DeviceFrame>
      <QuoteBuilder />
    </DeviceFrame>
  ),
});

const BANK = {
  intestatario: "Hair Genius Labs SRLS",
  iban: "IT80 M368 8801 6001 0000 0029 556",
  //  ⚠️ L'ACCONTO NON STA PIÙ QUI. Era `acconto_fisso: 100`, letto in quattro
  //   punti di questa pagina: adesso si imposta dal listino (Impostazioni →
  //   Listino) e si legge da `menu.acconto`. Lasciarne una copia qui vorrebbe
  //   dire che prima o poi qualcuno la userebbe, e due acconti diversi sullo
  //   stesso documento sono un documento sbagliato. Il valore di casa resta
  //   uno solo, in shop/quote-menu (`ACCONTO_DI_CASA`).
};

interface Profile {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  eta: string;
  greyPct: string;
  colorCode: string;
  problemi: string;
  /** ── I DATI CHE SERVONO SOLO ALLA FATTURA ────────────────────────────────
   *  Codice fiscale e residenza. ⚠️ NON SERVONO AL PREVENTIVO e non lo
   *   bloccano: si può creare un preventivo senza, come si è sempre fatto.
   *   Stanno qui perché questo è l'unico momento in cui il cliente è
   *   raggiungibile — sta dettando nome ed email, ha il telefono in mano — e
   *   chiedergli il codice fiscale costa dieci secondi. Chiederglielo tre
   *   settimane dopo, quando il bonifico è arrivato e bisogna fatturare, costa
   *   due solleciti; e finché non risponde la fattura non si può fare.
   *  ⚠️ NON FINISCONO NELLA RIGA DEL PREVENTIVO: `quote_requests` non ha
   *   colonne per loro e non gliene servono. Vivono nella pagina e passano alla
   *   finestra della fattura, che è l'unica che li scrive. */
  codiceFiscale: string;
  indirizzo: string;
  civico: string;
  cap: string;
  comune: string;
  provincia: string;
}
interface Discount {
  code: string;
  discount_eur: number;
  stock_total: number | null;
  stock_left: number | null;
  label: string | null;
  apply_message: string | null;
  scarcity_title: string | null;
  scarcity_text: string | null;
  //  «garanzia» = lo sconto che c'è perché la garanzia 15 mesi è compresa nel
  //  prezzo (shop/promo-garanzia). Non è un codice e non si può togliere a
  //  mano: sparisce da solo quando un codice la vende a cifra fissa.
  kind?: "code" | "qty" | "consulente";
}
interface QItem {
  name: string;
  price: number;
  wasPrice?: number;
  /** ── ⚠️ DOVE SI FA L'INSTALLAZIONE ────────────────────────────────────
   *  Richiesta del committente: «fai che il luogo dell'installazione si salvi e
   *  torni». Prima non si salvava da nessuna parte: la riga diceva soltanto che
   *  l'installazione c'è, e riaprendo il preventivo il posto ripartiva sempre
   *  dal centro — anche per chi l'aveva scelta a casa sua, con le spese di
   *  viaggio che quella scelta comporta.
   *  Sta QUI, dentro la voce, e non in una colonna nuova: `upsells` è già la
   *  riga JSON dove vive tutto ciò che riguarda una voce, e una colonna in più
   *  vorrebbe dire una modifica allo schema del database per un dato che
   *  riguarda una voce sola.
   *  Assente = «nel nostro centro», che è come si è sempre comportato. */
  dove?: "studio" | "home";
}
export interface QuoteEditPatch {
  qty?: number;
  extraEur?: number;
  promoUntil?: string;
  codes?: { code: string; eur: number; label?: string }[];
  /** Codici TOLTI dal preventivo. Senza questo, applicare un secondo codice
   *  poteva solo sommarsi al primo: due promozioni addosso allo stesso cliente
   *  e un prezzo che non corrisponde a nessun listino. */
  removed?: string[];
  /** Via TUTTI gli sconti: si riparte dal prezzo di listino di quello che il
   *  preventivo comprende. È l'unico modo di ripulire anche ciò che non si sa
   *  scomporre — e da lì i codici si rimettono uno alla volta, sapendo quanto
   *  valgono. */
  reset?: boolean;
  /** `false` = le personalizzazioni non si presentano più come scontate: via il
   *  prezzo barrato accanto alla voce e via la riga «Sconti sulle
   *  personalizzazioni». Il prezzo scontato diventa semplicemente il prezzo, e
   *  quello che il cliente paga non cambia di un euro. */
  upsellSconti?: boolean;
  notes?: { at: string; by: string; text: string }[];
}

interface Snapshot {
  ref: string;
  /** ── L'ID DELLA SOLUZIONE BASE, QUANDO C'È ─────────────────────────────
   *  La riga salvata lo porta dentro `base_system`, ma questo riepilogo non lo
   *  teneva: si portava dietro solo il nome, che è quello che si legge. Serve
   *  a riaprire il preventivo esattamente com'era (vedi shop/riapri-preventivo):
   *  un nome può essere stato riscritto nel listino, un id no.
   *  Assente sulle righe salvate prima: lì si ricade sul nome. */
  baseId?: string;
  baseName: string;
  basePrice: number;
  items: QItem[];
  qty: number;
  fittingId: "remoto" | "sede";
  fittingName: string;
  fittingPrice: number;
  /** `altro` = sconto già applicato che non si è riusciti ad attribuire a un
   *  codice preciso: si mostra e si porta dietro, ma non si tocca. */
  discounts: {
    code: string;
    eur: number;
    kind?: "code" | "qty" | "consulente" | "altro";
    label?: string;
  }[];
  discountEur: number;
  gross: number;
  total: number;
  acconto: number;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  eta: string;
  greyPct: string;
  colorCode: string;
  /** "Cosa dobbiamo sapere": allergie, patologie, note del cliente. Solo per noi. */
  problemi?: string;
  /** false = nessuna installazione scelta: il saldo si regola con bonifico. */
  installOn?: boolean;
  scarcity?: { title: string; text: string; saving: number } | null;
  promoUntil: string;
  timelineStart: string;
  steps: Steps;
}

const HERO_TRUST: { label: string; Icon: LucideIcon }[] = [
  // Due sole voci, e devono togliere i due dubbi che frenano davvero:
  // "e se poi si rovina?" e "quanto rischio adesso?". Sono entrambi fatti
  // scritti nel preventivo, non slogan.
];

const EMPTY: Profile = {
  nome: "",
  cognome: "",
  email: "",
  telefono: "",
  eta: "",
  greyPct: "",
  colorCode: "",
  problemi: "",
  codiceFiscale: "",
  indirizzo: "",
  civico: "",
  cap: "",
  comune: "",
  provincia: "",
};
const OPT = (
  <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
    Opzionale
  </span>
);

/* ── IL PREZZO DI PRIMA ─────────────────────────────────────────────────────
 *  ⚠️ Segnalazione del committente: «il prezzo vecchio non si legge, è troppo
 *   piccolo e il colore non si nota». Era così in SETTE punti diversi, ognuno
 *   con la sua misura e la sua trasparenza: 12px al 45%, 13px al 50%, 13,5px
 *   al 45% senza nemmeno la barra colorata. Sotto il 60% di bianco, su questo
 *   fondo blu scuro, un numero smette di esistere.
 *
 *  E non è un dettaglio decorativo: il prezzo barrato è l'unica cosa che dà la
 *  misura allo sconto. Se il "prima" non si legge, il "dopo" non sembra un
 *  affare — è un numero qualunque.
 *
 *  Adesso la resa è UNA SOLA, qui sotto, e la usano tutti i punti in cui
 *  compare un prezzo superato: 15px (quanto il prezzo attivo), bianco all'80%,
 *  cifre tabellari e barra ROSSA piena da 2,5px — la barra si vede da sola,
 *  anche a colpo d'occhio, e si distingue dal grigio delle voci tolte.
 *  Il prezzo scontato resta AMBRA, distinto dal blu dei prezzi normali: si
 *  capisce a colpo d'occhio quali voci sono in offerta. */
const BARRATO_CLASSI =
  "font-bold tabular-nums text-white/80 line-through decoration-red-400 decoration-[2.5px]";
function PromoPrice({ price, wasPrice }: { price: number; wasPrice?: number }) {
  const free = price === 0;
  const discounted = !!wasPrice && wasPrice > price;
  const tag = (
    <span
      className={`rounded-md px-2 py-0.5 text-sm font-bold ${
        free
          ? "bg-emerald-500/20 text-emerald-300"
          : discounted
            ? "bg-amber-400/25 text-amber-200 ring-1 ring-amber-300/50"
            : "bg-brand/20 text-brand"
      }`}
    >
      {free ? "GRATIS" : "+" + formatPrice(price)}
    </span>
  );
  if (discounted) {
    return (
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span className={`${BARRATO_CLASSI} text-[15px]`}>
          {formatPrice(wasPrice!)}
        </span>
        {tag}
      </span>
    );
  }
  return <span className="whitespace-nowrap">{tag}</span>;
}

/* Nota scadenza promo, discreta */
/** Scadenza della singola voce scontata: una fascia dentro la scheda, non una
 *  pillola appesa sotto. Prima si perdeva fra i testi e nessuno la leggeva. */
/** ── FASCIA DELLA SCADENZA ─────────────────────────────────────────────────
 *  Una sola resa in tutta la pagina: fascia a piè di scheda, a tutta larghezza,
 *  bordo superiore ambra, icona calendario, data per esteso in grassetto.
 *  Prima esisteva in due versioni diverse — una pillola stretta dentro il testo e
 *  una fascia — e la stessa informazione sembrava due cose diverse. */
function PromoNote({ until, onApri }: { until: Date; onApri?: () => void }) {
  const esteso = until.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    // ── LA DATA DA SOLA NON BASTA ──────────────────────────────────────────
    //  "A questo prezzo fino a venerdì" lascia in sospeso la domanda vera:
    //  perché fino a venerdì? Senza risposta la data sembra una tattica. Qui
    //  sotto c'è la riga che dice che una risposta esiste e si può leggere:
    //  è un invito esplicito, non un dettaglio da indovinare.
    //  È uno <span> con ruolo di pulsante e non un <button> perché questa
    //  fascia vive DENTRO la scheda dell'opzione, che è già un pulsante: un
    //  pulsante dentro un pulsante non è cliccabile in modo affidabile.
    <span
      role={onApri ? "button" : undefined}
      tabIndex={onApri ? 0 : undefined}
      onClick={
        onApri
          ? (e) => {
              e.stopPropagation();
              onApri();
            }
          : undefined
      }
      onKeyDown={
        onApri
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onApri();
              }
            }
          : undefined
      }
      className={`hg-shine block border-t border-amber-400/30 bg-amber-400/[0.09] px-4 py-2.5 text-[12px] leading-snug text-amber-100 transition ${onApri ? "cursor-pointer hover:bg-amber-400/[0.16]" : ""}`}
    >
      <span className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 flex-shrink-0 text-amber-300" />
        <span>
          A questo prezzo fino a <b className="font-semibold text-white">{esteso}</b>
        </span>
      </span>
      {onApri && (
        <span className="mt-1 flex items-center gap-1 pl-6 text-[11px] font-semibold text-amber-200/80 underline decoration-amber-300/40 underline-offset-2">
          Perché scade questo prezzo <ArrowUpRight className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}

function scarcityFrom(d: Discount): { title: string; text: string; saving: number } | null {
  if (d.stock_left === null) return null;
  const title = d.scarcity_title?.trim() || "Posti video testimonianza";
  const text = (
    d.scarcity_text?.trim() ||
    "Restano solo {left} posti{total} riservati alla video testimonianza con il codice {code}."
  )
    .replace(/\{left\}/g, String(d.stock_left))
    .replace(/\{total\}/g, d.stock_total ? ` su ${d.stock_total}` : "")
    .replace(/\{code\}/g, d.code);
  return { title, text, saving: Number(d.discount_eur) || 0 };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * UN SOLO TRASMETTITORE
 * Questa pagina può girare in PIÙ contesti JS contemporaneamente sullo stesso
 * dispositivo del presentatore:
 *   - la finestra esterna e l'iframe dell'anteprima dispositivo (?embed=1),
 *   - una seconda scheda lasciata aperta,
 *   - il breve istante in cui DeviceFrame monta i children e poi passa all'iframe.
 * Se due contesti trasmettono sullo stesso canale, l'ospite riceve a raffica due
 * stati DIVERSI (uno col preventivo creato, uno ancora sul configuratore) e
 * lampeggia fra le due schermate. Elezione con lock in localStorage: vince UN
 * solo contesto; l'iframe dell'anteprima ha priorità sulla finestra esterna
 * perché è lì che il presentatore clicca davvero.
 * ────────────────────────────────────────────────────────────────────────────*/
const SRC = Math.random().toString(36).slice(2, 9); // id univoco per contesto/caricamento
const HOST_LOCK_KEY = "hg_quote_host";
const LOCK_STALE_MS = 2500;
function myPrio(): number {
  if (typeof window === "undefined") return 0;
  const inFrame =
    window.self !== window.top || new URLSearchParams(window.location.search).get("embed") === "1";
  return inFrame ? 1 : 0;
}
/** true se questo contesto è (o diventa) IL trasmettitore. */
function claimHostLock(): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const prio = myPrio();
  try {
    const raw = localStorage.getItem(HOST_LOCK_KEY);
    if (raw) {
      const j = JSON.parse(raw) as { src?: string; ts?: number; prio?: number };
      const fresh = now - (Number(j?.ts) || 0) < LOCK_STALE_MS;
      if (j?.src && j.src !== SRC && fresh && (Number(j.prio) || 0) >= prio) return false;
    }
    localStorage.setItem(HOST_LOCK_KEY, JSON.stringify({ src: SRC, ts: now, prio }));
    return true;
  } catch {
    return true;
  }
}

/*  ── LA FASCIA FISSA IN CIMA È STATA TOLTA ────────────────────────────────
 *  Ripeteva su ogni schermata una cosa che il cliente incontra già dove
 *  serve — sotto la voce in promozione e accanto al prezzo bloccato — e in
 *  cima toglieva spazio alla pagina senza aggiungere nulla. La spiegazione
 *  (qui sotto) è rimasta: si apre da quei due punti.
 *  Si apre SOLO al clic: aprirla al passaggio del mouse la faceva comparire
 *  da sola, anche solo scorrendo con il puntatore fermo lì sopra. */

/** ── PERCHÉ QUESTO PREZZO SCADE ────────────────────────────────────────────
 *  Prima erano tre riquadri, ciascuno con titolo E paragrafo, più una nota di
 *  chiusura: sette righe di testo da 12px per rispondere a una domanda che il
 *  cliente si fa in due secondi. Sul telefono non le legge nessuno — e una
 *  spiegazione che non si legge lascia la data a sembrare una tattica di
 *  vendita, cioè fa il danno che doveva evitare.
 *  Ora la risposta sta in tre affermazioni, in quest'ordine:
 *   · PERCHÉ — una frase sola sul motivo (l'obiettivo del laboratorio);
 *   · PRIMA / DOPO — due celle affiancate, cosa vale fino a quel giorno e cosa
 *     succede il giorno dopo: è un confronto, si capisce prima di leggerlo;
 *   · L'IMPEGNO — chi ci rimette se l'obiettivo non si raggiunge (noi).
 *  Niente conto alla rovescia e niente rosso: la scadenza va letta come un
 *  impegno che ci siamo presi, non come una spinta a firmare adesso. */
function PercheScade({ until, onClose }: { until: Date; onClose: () => void }) {
  // Le date arrivano dal database e possono essere illeggibili: senza questo
  // controllo il cliente si troverebbe scritto "Invalid Date" dove si aspetta
  // un giorno. Se la data non regge, le due celle non si disegnano affatto —
  // il motivo e l'impegno restano, e sono la parte che conta.
  const valida = !Number.isNaN(until.getTime());
  const giorno = (d: Date) => {
    const s = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const dopo = new Date(until.getTime() + 24 * 3600 * 1000);
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6 print:hidden"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/12 bg-[#0b1730] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <Clock className="h-4 w-4 flex-shrink-0 text-amber-300" />
          <h3 className="text-[16px] font-bold text-white">Perché questo prezzo scade</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-mr-1 ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* pb più alto sul telefono: da foglio che sale dal basso, l'ultima riga
            finiva a filo della barra di sistema e sembrava tagliata. */}
        <div className="px-5 pb-8 pt-5 sm:pb-5">
          {/* 1 · IL MOTIVO — una frase, non un capitolo. */}
          <p className="text-[15.5px] leading-relaxed text-white/85">
            Il laboratorio ci fa condizioni migliori se arriviamo a{" "}
            <b className="font-bold text-white">75 installazioni</b> questa settimana. Te le abbiamo
            già applicate qui.
          </p>

          {/* 2 · PRIMA / DOPO — il confronto si legge senza leggere: due celle,
                 una accesa e una spenta, e in mezzo la linea del tempo. */}
          {valida && (
            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/12">
              <div className="border-r border-white/12 bg-amber-400/[0.10] px-3.5 py-3.5">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-amber-300">
                  Fino al
                </p>
                <p className="mt-1 text-[15px] font-bold leading-tight text-white">
                  {giorno(until)}
                </p>
                <p className="mt-1.5 text-[14px] leading-snug text-amber-100/85">
                  i numeri che vedi qui
                </p>
              </div>
              <div className="bg-white/[0.03] px-3.5 py-3.5">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-white/50">
                  Dal
                </p>
                <p className="mt-1 text-[15px] font-bold leading-tight text-white/75">
                  {giorno(dopo)}
                </p>
                <p className="mt-1.5 text-[14px] leading-snug text-white/55">
                  si torna ai prezzi di listino
                </p>
              </div>
            </div>
          )}

          {/* 3 · L'IMPEGNO — la riga che toglie la sensazione di pressione. */}
          <p className="mt-4 border-l-2 border-emerald-400/50 pl-3.5 text-[14.5px] leading-relaxed text-white/70">
            Se non ci arriviamo, il vantaggio lo perdiamo noi. Non è una spinta a decidere in
            fretta.
          </p>
        </div>
      </div>
    </div>
  );
}

/** ── IL CARTELLINO DI UNA FASE ─────────────────────────────────────────────
 *  Numero grande, titolo corto, e a destra QUANDO succede. Serve a chi legge di
 *  fretta — e a chi fatica a stare dietro a un blocco di testo: il numero dà
 *  l'ordine, la riga di destra dà il tempo, e non serve leggere il resto per
 *  capire dove ci si trova. */
function FaseTitolo({ n, titolo, quando }: { n: number; titolo: string; quando: string }) {
  return (
    // ── LA FASE, IN UNA CARTA ──────────────────────────────────────────────
    //  Prima erano tre pezzi in fila su una riga sola: sul telefono il
    //  cartellino del tempo finiva addosso al titolo, e il testo sotto
    //  galleggiava senza appartenere a niente. Ora la fase è un blocco unico —
    //  numero, titolo e tempo IMPILATI, ciascuno sulla sua riga — dentro una
    //  carta con la sua cornice: si legge dall'alto in basso, e si vede dove
    //  finisce una fase e comincia l'altra anche scorrendo in fretta.
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent px-4 py-3.5">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent"
      />
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/15 text-[16px] font-bold text-brand">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold leading-tight text-white sm:text-[17px]">
            {titolo}
          </h3>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand/80">
            <Clock className="h-3 w-3" /> {quando}
          </p>
        </div>
      </div>
    </div>
  );
}

/** ── ⚠️ IL CODICE DELLA CONSULENZA VIAGGIA CON LA RICHIESTA ───────────────
 *  Da quando ogni consulente ha il suo listino e i suoi codici sconto, il
 *  server deve sapere DI CHI è la consulenza per rispondere con le cifre
 *  giuste. Il cliente non sa chi è il suo consulente: sa il codice della sua
 *  stanza, ed è quello che manda. La traduzione la fa il server.
 *  Senza codice — preventivo aperto fuori da una consulenza — si torna al
 *  listino di casa, che è come ha sempre funzionato. */
const conSessione = (url: string) => {
  /*  ── ⚠️ E IL CLIENTE IL CODICE CE L'HA NEL LINK, NON IN MEMORIA ───────
      Qui si leggeva solo `getLiveId()`, cioè la memoria del dispositivo: sul
      telefono del cliente è vuota (verificato in produzione: `hg_live_session`
      è null sulla sua pagina). La richiesta partiva senza codice e il server
      rispondeva col listino DI CASA, mentre il consulente sul suo schermo
      leggeva il proprio — due prezzi diversi per la stessa consulenza, e
      quello sbagliato davanti a chi deve pagare.
      `codiceDaPagina` guarda prima l'indirizzo — dove il codice ce l'ha il
      cliente — e poi la memoria, dove ce l'ha chi conduce. */
  const c =
    typeof window === "undefined"
      ? getLiveId()
      : codiceDaPagina({
          pathname: window.location.pathname,
          search: window.location.search,
          hostId: getLiveId(),
        });
  return c ? `${url}${url.includes("?") ? "&" : "?"}sess=${encodeURIComponent(c)}` : url;
};

function QuoteBuilder() {
  const [baseId, setBaseId] = useState<string>(BASE_SOLUTIONS[0].id);
  // parte già su una combinazione sensata (tutte voci senza sovrapprezzo)
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [simOn, setSimOn] = useState(false);
  /*  ── LA CALIBRAZIONE NON È GIÀ SPUNTATA ───────────────────────────────
      Partiva selezionata, e i 70 € erano già dentro il totale prima che il
      cliente avesse scelto: la si toglieva, non la si aggiungeva. Ora è una
      voce che si accende, come tutte le altre. */
  const [installOn, setInstallOn] = useState(false);
  /** Dove si fa: cambia il testo e le spese di viaggio, non il prezzo. */
  const [installLoc, setInstallLoc] = useState<"studio" | "home">("studio");
  /** Sotto-scelta per le voci che ne hanno una (l'intensità dell'onda, l'ampiezza
   *  del riccio): { id della voce → id dell'opzione }. */
  const [varianti, setVarianti] = useState<Record<string, string>>({});
  const [fitting, setFitting] = useState<"remoto" | "sede">("remoto");
  // "Il tuo percorso": UNA sola vista a schermo intero (non è più un popup né una
  // seconda "pagina completa"): un solo stato → presentatore e ospite sono sempre
  // sulla stessa schermata e non c'è ambiguità popup/pagina.
  const [percorsoOpen, setPercorsoOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [profile, setProfile] = useState<Profile>({ ...EMPTY });

  const [codeInput, setCodeInput] = useState("");
  const [manual, setManual] = useState<Discount | null>(null);
  const [autos, setAutos] = useState<Discount[]>([]);
  const [qtyDiscounts, setQtyDiscounts] = useState<Record<string, number>>({});
  const qtyDiscRef = useRef<Record<string, number>>({});
  qtyDiscRef.current = qtyDiscounts;
  /*  Il listino di adesso, leggibile dalle funzioni che girano fuori dal
      disegno (la rilettura del documento salvato, gli aggiornamenti che
      arrivano dal canale). Serve per l'acconto, che dal listino si può
      cambiare e non è più una costante. */
  const pricingRef = useRef<PricingOverrides>({});
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Snapshot | null>(null);
  // Preventivo COM'È SCRITTO A DATABASE, senza le modifiche successive. Le
  // modifiche si applicano sempre a PARTIRE DA QUI: applicarle a ciò che è già
  // a schermo le sommerebbe a ogni ricontrollo (sconto che cresce da solo).
  const baseSnapRef = useRef<Snapshot | null>(null);
  const editSigRef = useRef("");
  const [quoteEdit, setQuoteEdit] = useState<QuoteEditPatch | null>(null);
  /** ── QUESTO PREVENTIVO È STATO ANNULLATO, E IL VALIDO È QUESTO ─────────
   *  Il numero del preventivo che ha preso il posto di quello aperto, "" o
   *  `null` se questo è ancora valido.
   *
   *  ⚠️ PRIMA QUI C'ERA IL SUO OPPOSTO — `sostituisce`, cioè «da quale vecchio
   *   numero sei arrivato» — perché il vecchio link portava DENTRO il preventivo
   *   nuovo. Il committente ha chiesto di rovesciarlo: il vecchio link mostra il
   *   VECCHIO preventivo, quello che la persona ricorda di aver ricevuto, e la
   *   pagina gli dice a chiare lettere che è annullato e qual è quello valido.
   *   Cambiare il documento sotto gli occhi di chi sta decidendo come spendere
   *   migliaia di euro è il modo più rapido di fargli pensare di essere stato
   *   preso in giro, anche quando il prezzo nuovo è più basso. */
  const [annullatoDa, setAnnullatoDa] = useState<string | null>(null);
  /** ── E QUANDO IL VECCHIO DOCUMENTO NON SI DEVE PROPRIO LEGGERE ─────────
   *  Il ripiego qui sopra — annullato ma consultabile — è quello giusto quasi
   *  sempre. Non lo è quando il prezzo di prima era molto più basso, o quando
   *  le condizioni di allora non si vogliono più far leggere a chi tratta: in
   *  quel caso, dai «Preventivi attivi», il documento si spegne e di questo
   *  link resta il solo avviso. Lo decide il server (api.public.quote), non
   *  questa pagina: qui si obbedisce. */
  const [soloAvviso, setSoloAvviso] = useState(false);
  /** Il progressivo leggibile del preventivo: «PREV-2026-0015».
   *  ⚠️ NON sostituisce il ref (IDQY6EF), che resta l'indirizzo del documento e
   *   quello che il cliente scrive nella causale del bonifico. Questo è il
   *   numero con cui il preventivo si nomina — al telefono, in un elenco. Lo
   *   assegna il server una volta sola (vedi `numeroPreventivo` in
   *   api.public.quote): qui si mostra e basta. */
  const [numeroPrev, setNumeroPrev] = useState("");
  /** ── LA GARANZIA, DECISA DAI CODICI ────────────────────────────────────
   *  La mappa «codice → mostra/importo» che arriva insieme ai codici sconto.
   *  Vuota finché non si è letta, e vuota vuol dire «nessun codice dice
   *  niente»: allora vale il listino, che è il comportamento di sempre. */
  const [garanzie, setGaranzie] = useState<MappaGaranzie>({});
  // riferimenti sempre freschi: i gestori del canale vivono a lungo
  const selectedRef = useRef<Set<string>>(new Set());
  const baseIdRef = useRef("");
  const inPromoRef = useRef<(id: string) => boolean>(() => false);
  const primoStatoRef = useRef(false);
  const lookup = useLookup(); // "sto cercando il tuo preventivo"
  const [remoteLookup, setRemoteLookup] = useState(false);
  /** numero preventivo scritto NEL LINK: non si perde seguendo il presentatore */
  const pinnedRef = useRef<string | null>(null);
  /** true se il preventivo a schermo lo stiamo seguendo, non ce l'ha dato il link */
  const followedRef = useRef(false);
  const shownRef = useRef<string | null>(null);
  /** L'ultimo preventivo creato, sempre leggibile anche dalle funzioni di
   *  pulizia (che altrimenti vedrebbero il valore di quando sono nate). */
  const resultRef = useRef<Snapshot | null>(null);
  /** Rimette in scena una bozza. Vive in un riferimento perché serve a un
   *  effetto che sta PIÙ IN ALTO della funzione: citarla direttamente lì la
   *  userebbe prima che esista, e la pagina non si disegnerebbe affatto. */
  const applicaRef = useRef<(b: Bozza | null) => void>(() => {});
  const [loadingRef, setLoadingRef] = useState(false);
  const [promoTick, setPromoTick] = useState(0);
  //  ── LA COMPOSIZIONE IN CORSO NON SI PERDE ──────────────────────────────
  //  Finché il preventivo non è stato creato vive solo nella memoria della
  //  pagina: bastava un ricaricamento — o il recupero automatico dopo un
  //  errore — per ricominciare da zero davanti al cliente. Ora ogni scelta
  //  viene messa da parte su questo dispositivo e ripresa all'apertura.
  // Firma d'ingresso della schermata: si sente una volta sola, all'apertura.
  //  ── NESSUN SUONO SENZA UN GESTO ─────────────────────────────────────────
  //   Qui la pagina suonava da sola ogni volta che veniva montata: non solo
  //   quando la aprivi tu, ma anche quando si rimontava per conto suo — una
  //   navigazione automatica, un rientro, un aggiornamento. Il suono del cambio
  //   schermata lo fa già il pulsante che premi: è quello il gesto.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const promoUntil = useMemo(() => promoDeadline(), [promoTick]);

  // prezzi modificabili dal CRM
  const [pricing, setPricing] = useState<PricingOverrides>({});
  /*  ── LA FOTOGRAFIA DEL PREVENTIVO A SCHERMO ────────────────────────────
      Il listino com'era quando questo preventivo è nato, più le scelte fatte.
      `null` = non c'è nessun documento emesso davanti (si sta configurando),
      oppure lo si sta modificando apposta: in tutti e due i casi comanda il
      listino di oggi. */
  const [condizioni, setCondizioni] = useState<CondizioniPreventivo | null>(null);
  /*  La causale decisa a mano per QUESTO preventivo (dal pannello dei
      preventivi). Vuota = vale il modello del listino, cioè la fotografia. */
  const [causaleSuMisura, setCausaleSuMisura] = useState("");
  const condizioniRef = useRef<CondizioniPreventivo | null>(null);
  condizioniRef.current = condizioni;
  /*  ── ⚠️ UN SOLO LISTINO IN USO, PER TUTTA LA PAGINA ────────────────────
      La fotografia del preventivo a schermo, se c'è; altrimenti il listino di
      oggi. Da QUI passa tutto quello che si disegna: il menu, le parti accese,
      le spunte di partenza, l'acconto. Chiedersi «quale listino?» in ogni
      punto sarebbe il modo sicuro di mostrarne due diversi nella stessa
      schermata — ed è successo davvero: con il menu fuso e `acceso` no, il
      riquadro dell'assistenza spariva da un preventivo emesso quando c'era,
      solo perché nel frattempo lo si era spento dal listino. */
  //  ⚠️ `!!result` = c'è un documento EMESSO a schermo. Serve a distinguere i
  //   preventivi nati prima della fotografia — su cui gli spegnimenti di oggi
  //   non valgono all'indietro — dal configuratore, dove invece le
  //   impostazioni nuove devono vedersi subito (vedi shop/condizioni-preventivo).
  const listinoInUso = useMemo(
    () => listinoDelPreventivo(condizioni, pricing, !!result),
    [pricing, condizioni, result],
  );
  const listinoRef = useRef<PricingOverrides>({});
  listinoRef.current = listinoInUso;
  const menu = useMemo(() => buildMenu(listinoInUso), [listinoInUso]);
  /*  ── ⚠️ LE SPUNTE DI PARTENZA LE DECIDE IL LISTINO ─────────────────────
      Richiesta del committente: «fai che dalle impostazioni listino posso
      selezionare quali opzioni sono già preselezionate».
      La combinazione di serie (`DEFAULT_SELECTED`) resta il ripiego: è quella
      che vale nell'istante fra l'apertura della pagina e la risposta del
      listino, e quella che vale se il listino non si legge. Appena arriva, se
      nessuno ha ancora toccato niente, le spunte diventano quelle decise nel
      pannello — una volta sola, perché rifarlo a ogni rilettura del listino
      cancellerebbe le scelte fatte davanti al cliente. */
  /*  ⚠️ Le spunte di partenza non sono più una sola lista: cambiano da una
      soluzione all'altra (richiesta del committente: «posso preselezionare gli
      upsell sui prodotti»). `preselDi` risponde per la strada che gli passi —
      e le sezioni di un'altra strada non ci entrano nemmeno come id. */
  const preselDi = useCallback((id: string) => preselezione(listinoInUso, id), [listinoInUso]);
  const presel = useMemo(() => preselDi(baseId), [preselDi, baseId]);
  const preselRef = useRef<string[]>([...DEFAULT_SELECTED]);
  preselRef.current = presel;
  const preselDiRef = useRef(preselDi);
  preselDiRef.current = preselDi;
  /** true appena qualcuno tocca le scelte (o le riceve da un'altra schermata):
   *  da lì in poi la preselezione del listino non entra più a sovrascrivere. */
  const sceltoAMano = useRef(false);
  const preselApplicata = useRef(false);
  /** Com'è il configuratore appena aperto, ADESSO: `PARTENZA` con le spunte
   *  decise nel pannello Listino. Serve a "hai toccato qualcosa?", e con le
   *  spunte del codice avrebbe risposto sì a una schermata mai toccata. */
  const partenzaOra = useCallback(() => ({ ...PARTENZA, selected: [...preselRef.current] }), []);
  const [pricingLetto, setPricingLetto] = useState(false);
  /*  ── ⚠️ LE PARTI DELLA PAGINA SI POSSONO SPEGNERE ─────────────────────
      Richiesta del committente: «fai che posso disattivare le opzioni del
      preventivo dalle impostazioni presentazione».
      Le sezioni spente non arrivano nemmeno qui (le toglie `buildMenu`).
      Queste quattro invece sono parti fisse della pagina, senza un prezzo:
      ci sono sempre state e non si potevano togliere. `acceso` risponde per
      tutte con la stessa domanda, e assente vuol dire acceso — un listino
      salvato prima di oggi continua a mostrare tutto. */
  const acceso = useCallback(
    (id: PartePreventivo) => parteAccesa(listinoInUso, chiaveParte(id)),
    [listinoInUso],
  );
  /*  ── ⚠️ E SI RICHIEDE FINCHÉ IL PREVENTIVO NON È FATTO ────────────────
      Il listino dipende da CHI conduce la consulenza, e il cliente quasi
      sempre apre il link PRIMA che il consulente avvii: in quel momento il
      server non sa ancora di chi è la stanza e risponde col listino di casa.
      Senza questa rilettura il cliente resterebbe su quelle cifre per tutta la
      consulenza, mentre il consulente ne legge altre sul suo schermo — il
      guasto peggiore che questa pagina possa avere.
      ⚠️ E SI RILEGGE ANCHE A PREVENTIVO FATTO, senza che il documento si
       muova: quello che c'è a schermo si disegna con la sua fotografia (vedi
       `condizioni`), non con quello che arriva da qui. Questa lettura tiene
       aggiornato il listino di OGGI, che serve nell'istante in cui si preme
       «modifica preventivo» — è la richiesta «si aggiorna con le nuove
       condizioni», e senza rilettura si ripartirebbe da quelle di stamattina. */
  useEffect(() => {
    let vivo = true;
    let ultimo = "";
    const leggi = async () => {
      if (!vivo) return;
      try {
        const testo = await fetch(conSessione("/api/public/pricing")).then((r) => r.text());
        if (!vivo || testo === ultimo) return;
        ultimo = testo;
        setPricing(JSON.parse(testo) as PricingOverrides);
      } catch {
        /* vale quello che c'è: mai lasciare la pagina senza prezzi */
      } finally {
        if (vivo) setPricingLetto(true);
      }
    };
    void leggi();
    const t = setInterval(leggi, 20_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);
  /*  Una volta sola, e solo se la pagina è ancora come si è aperta: chi guarda
      riceve le scelte del consulente dal canale della diretta, e chi presenta
      può aver già spuntato qualcosa mentre il listino arrivava. In entrambi i
      casi qui non si tocca niente. */
  useEffect(() => {
    if (!pricingLetto || preselApplicata.current) return;
    preselApplicata.current = true;
    if (sceltoAMano.current) return;
    setSelected(new Set(preselDiRef.current(baseIdRef.current)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingLetto, presel]);

  // sconti automatici (si sommano a quello manuale)
  useEffect(() => {
    fetch(conSessione("/api/public/validate-discount"))
      .then((r) => r.json())
      .then((j) => {
        setAutos((j.codes ?? []) as Discount[]);
        setQtyDiscounts((j.qtyDiscounts ?? {}) as Record<string, number>);
        setGaranzie(leggiMappa(j.garanzie as string | undefined));
        // durata delle promozioni decisa dal presentatore: va applicata PRIMA
        // che si calcoli una scadenza, altrimenti resta quella di default
        if (j.promoDays) {
          setPromoDays(Number(j.promoDays));
          setPromoTick((t) => t + 1);
        }
      })
      .catch(() => {});
  }, []);

  // link corto: /preventivo?id=IDP1234
  const loadQuote = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingRef(true);
    // La scadenza di un preventivo già emesso si ricalcola dalla sua data di
    // creazione: serve PRIMA la durata impostata dal presentatore, altrimenti
    // si userebbe quella di default e la data mostrata sarebbe un'altra.
    try {
      const dj = await fetch(conSessione("/api/public/validate-discount")).then((x) => x.json());
      if (dj?.promoDays) setPromoDays(Number(dj.promoDays));
      //  ⚠️ Serve ANCHE qui: aprendo un preventivo già emesso i codici arrivano
      //   dalla riga salvata, non da questa chiamata — ma la configurazione
      //   della garanzia sta in `app_config` e va letta lo stesso, o il riquadro
      //   riapparirebbe su un preventivo che l'aveva nascosto.
      if (dj?.garanzie !== undefined) setGaranzie(leggiMappa(dj.garanzie as string | undefined));
    } catch {
      /* si usa la durata di default */
    }
    return fetch(`/api/public/quote?ref=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;
        const q = j.quote;
        //  ── QUESTO NUMERO È ANCORA VALIDO? ────────────────────────────────
        //   Il preventivo chiesto può essere stato sostituito da uno nuovo (il
        //   consulente ha applicato uno sconto: vedi api.presenter.quote-revise).
        //   Il server adesso risponde con QUESTO documento — quello che la
        //   persona ha in mano — e in più con il numero di quello valido. Il
        //   riquadro in cima lo dice per esteso, e da lì si va all'altro.
        setAnnullatoDa(j.sostituitoDa ? String(j.sostituitoDa) : null);
        setSoloAvviso(j.soloAvviso === true);
        setNumeroPrev(j.numero ? String(j.numero) : "");
        /*  ── LE CONDIZIONI DI QUEL GIORNO ─────────────────────────────
            Il listino com'era quando questo preventivo è nato. Senza (i
            documenti emessi prima di oggi) vale quello di adesso, che è
            come ci si è sempre comportati.
            ⚠️ Si legge PRIMA di costruire il documento: l'acconto scritto qui
             sotto è quello di allora, non quello di oggi. */
        const cond = leggiCondizioni(typeof j.condizioni === "string" ? j.condizioni : null);
        setCondizioni(cond);
        setCausaleSuMisura(typeof j.causale === "string" ? j.causale : "");
        const listinoDiAllora = listinoDelPreventivo(cond, pricingRef.current, true);
        //  ⚠️ LA CORREZIONE DELL'INDIRIZZO RESTA, e adesso quasi non scatta mai:
        //   il documento restituito è quello chiesto. Serve ancora per le
        //   differenze di maiuscole e per i ref scritti a mano — e non deve
        //   scattare su un annullamento, perché riscrivere l'indirizzo col
        //   numero nuovo cancellerebbe proprio il link che la persona sta
        //   guardando.
        if (String(q.quote_ref || "") && String(q.quote_ref) !== id) {
          try {
            const u = new URL(window.location.href);
            u.searchParams.set("id", String(q.quote_ref));
            u.searchParams.delete("ref");
            window.history.replaceState({}, "", u.toString());
            pinnedRef.current = String(q.quote_ref);
          } catch {
            /* l'indirizzo resta quello vecchio: il preventivo mostrato è giusto lo stesso */
          }
        }
        const items: QItem[] = (q.upsells ?? []).map((u: QItem) => ({
          name: u.name,
          price: Number(u.price) || 0,
          // il listino di ogni voce serve a dire quanto è stato scontato:
          // senza, riaprendo il preventivo gli sconti sparivano dal riepilogo
          wasPrice: typeof u.wasPrice === "number" ? u.wasPrice : undefined,
          //  ⚠️ E il posto dell'installazione: senza questa riga il campo si
          //   perderebbe proprio qui, nel punto in cui il preventivo salvato
          //   torna in mano alla pagina — cioè si salverebbe e non tornerebbe.
          ...(u.dove === "home" || u.dove === "studio" ? { dove: u.dove } : {}),
        }));
        const fit = FITTING_OPTIONS.find((f) => f.id === (q.fitting_mode || "remoto"))!;
        const bs = q.base_system ?? {};
        const nQty = Number(q.qty) || 1;
        const gross =
          ((Number(bs.price) || 0) + items.reduce((s, i) => s + i.price, 0)) * nQty + fit.price;
        const dEur = Number(q.discount_eur) || 0;
        const total = Number(q.total) || Math.max(0, gross - dEur);
        const firstCode = String(q.discount_code || "")
          .split(",")[0]
          .trim();
        const snap: Snapshot = {
          ref: q.quote_ref,
          baseId: bs.id ? String(bs.id) : undefined,
          baseName: bs.name ?? q.base_choice ?? "",
          basePrice: Number(bs.price) || 0,
          items,
          qty: nQty,
          fittingId: (q.fitting_mode || "remoto") as "remoto" | "sede",
          fittingName: fit.name,
          fittingPrice: fit.price,
          //  ── LO SCONTO ARRIVA GIÀ SCOMPOSTO, QUANDO SI PUÒ ────────────────
          //   Qui c'era una riga sola con dentro tutto: il codice era la
          //   stringa intera («VIDEO50, BENVENUTO») e gli euro erano lo sconto
          //   COMPLESSIVO, sconto quantità compreso. Con quella riga il
          //   consulente non poteva togliere un codice — non si sapeva quanto
          //   valesse — e l'unica modifica possibile era sommarne un altro.
          //   Il server adesso lo scompone (`sconti`); quando non ci riesce
          //   risponde `null` e si torna alla riga unica di prima, che è
          //   imprecisa ma non inventa niente.
          discounts:
            (j.sconti as Snapshot["discounts"] | null) ??
            (q.discount_code ? [{ code: q.discount_code, eur: dEur }] : []),
          discountEur: dEur,
          gross,
          total,
          acconto: Math.min(accontoDi(listinoDiAllora), total),
          nome: q.nome ?? "",
          cognome: q.cognome ?? "",
          email: q.email ?? "",
          telefono: q.telefono ?? "",
          eta: q.eta ? String(q.eta) : "",
          greyPct: q.grey_pct ? String(q.grey_pct) : "",
          colorCode: q.color_code ?? "",
          problemi: q.problemi ?? "",
          // dall'elenco voci: se non c'è installazione il saldo va per bonifico
          installOn: items.some((u) => /installazione|calibrazione/i.test(u.name)),
          promoUntil: promoDeadline(q.created_at).toISOString(),
          timelineStart: q.timeline_start || q.created_at,
          steps: (q.timeline_steps ?? {}) as Steps,
          scarcity:
            dEur > 0
              ? {
                  title: "Posti video testimonianza",
                  text: `Prezzo riservato a chi registra una breve video testimonianza${firstCode ? ` (codice ${firstCode})` : ""}.`,
                  saving: dEur,
                }
              : null,
        };
        baseSnapRef.current = snap;
        //  ── L'ANTEPRIMA DI QUESTO PREVENTIVO SI RIFÀ QUANDO LO SI RIAPRE ───
        //   Serve a due cose, e la seconda è quella che si nota:
        //   · i preventivi creati PRIMA di un cambiamento della grafica hanno
        //     ancora l'immagine vecchia depositata, e nessuno la riscriverebbe
        //     mai — riaprirli è l'unico momento in cui i loro dati tornano in
        //     mano a qualcuno che può disegnare;
        //   · un preventivo ritoccato dopo la creazione (sconto aggiunto,
        //     quantità cambiata) mostrerebbe nell'anteprima il totale di
        //     partenza, cioè una cifra che non è più quella.
        //   ⚠️ Si deposita sotto il NUMERO DEL PREVENTIVO, mai sotto la
        //   sessione: quella ha la sua scheda, senza numeri (vedi più sotto).
        //   ⚠️ E col NOME DEL SISTEMA scritto sopra: qui passava una stringa
        //   vuota, quindi ogni preventivo riaperto si riscriveva l'anteprima
        //   buttando via la riga che dice CHE COSA ha davanti il cliente. Il
        //   dato c'è ed è quello vero della riga (`base_system.name`, o la
        //   scelta registrata alla creazione): non c'era motivo di ometterlo.
        void depositaAnteprimaPreventivo({
          ref: String(q.quote_ref || ""),
          nome: q.nome ?? "",
          cognome: q.cognome ?? "",
          totale: total,
          base: snap.baseName,
          quantita: nQty,
          prezzoPieno: gross,
        });
        // preventivo "corrente" della consulenza: è quello a cui verrà legata
        // la registrazione della videochiamata
        setQuoteRef(q.quote_ref);
        setResult(snap);
        // Modifiche fatte dopo la creazione: prima non venivano rilette, quindi
        // riaprendo il preventivo si tornava ai numeri di partenza.
        fetch(`/api/presenter/quote-edit?ref=${encodeURIComponent(q.quote_ref)}`)
          .then((r) => r.json())
          .then((ej) => {
            const e = ej?.edit as QuoteEditPatch | null;
            if (!e) return;
            editSigRef.current = JSON.stringify(e);
            setQuoteEdit(e);
            setResult((prev) =>
              prev && baseSnapRef.current
                ? withEdit(baseSnapRef.current, e, qtyDiscRef.current, accontoDi(listinoRef.current))
                : prev,
            );
          })
          .catch(() => {});
        window.scrollTo({ top: 0 });
        // arricchisci col conteggio posti live, se il codice è ancora valido
        if (firstCode) {
          fetch(conSessione("/api/public/validate-discount"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: firstCode }),
          })
            .then((r) => r.json())
            .then((dj) => {
              if (!dj?.valid) return;
              const sc = scarcityFrom({ ...(dj as Discount), discount_eur: dEur });
              if (sc) setResult((prev) => (prev ? { ...prev, scarcity: sc } : prev));
            })
            .catch(() => {});
        }
      })
      .finally(() => setLoadingRef(false));
  }, []);

  // ── SEGUI IL PREVENTIVO APERTO DAL CONSULENTE ─────────────────────────────
  //  Legge dallo stato del presentatore SOLO il numero del preventivo. Se è
  //  cambiato, se lo carica per conto proprio; se il consulente è tornato al
  //  configuratore, torna anche lui — ma senza buttare via il preventivo che
  //  era scritto nel link, che gli è stato mandato apposta.
  const seguiPreventivo = useCallback(
    (st: Record<string, unknown> | null | undefined) => {
      if (!st || !st.v) return;
      setRemoteLookup(!!st.lookup);
      const ref = (st.result as Snapshot | null | undefined)?.ref ?? null;
      if (ref) {
        if (ref === shownRef.current) return;
        followedRef.current = true;
        loadQuote(ref);
        return;
      }
      // il consulente non ha nessun preventivo aperto
      if (shownRef.current && followedRef.current) {
        followedRef.current = false;
        baseSnapRef.current = null;
        editSigRef.current = "";
        setQuoteEdit(null);
        setResult(null);
        if (pinnedRef.current) loadQuote(pinnedRef.current); // torna al suo
      }
    },
    [loadQuote],
  );

  // link corto: /preventivo?id=IDP1234 — e "Apri" dal pannello dei preventivi.
  //  Il pannello non ricarica la pagina (in videochiamata la interromperebbe) e
  //  la rotta non si rimonta: senza questo ascoltatore "Apri" non faceva nulla
  //  quando si era già sul preventivo.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("id") || q.get("ref");
    if (id) {
      pinnedRef.current = id;
      loadQuote(id);
    }
    const onOpen = (ev: Event) => {
      const ref = (ev as CustomEvent<string>).detail;
      if (!ref) return;
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("id", ref);
        u.searchParams.delete("ref");
        window.history.replaceState({}, "", u.toString());
      } catch {
        /* */
      }
      loadQuote(ref);
    };
    //  "Riprendi la bozza" dalla barra: si può premere da qualsiasi schermata,
    //  quindi il preventivo può essere ancora in arrivo — l'evento lo raggiunge
    //  comunque, perché la barra lo rilancia dopo aver navigato qui.
    const onBozza = () => {
      const b = leggiBozza();
      if (!b) return;
      applicaRef.current(b); // un clic, ed è già sullo schermo
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    //  Arrivando da un'altra schermata questa pagina può montarsi DOPO che il
    //  segnale è partito: il contrassegno lasciato dalla barra sopravvive alla
    //  navigazione e viene letto qui, appena si è pronti.
    try {
      if (sessionStorage.getItem("hg_recupera_bozza") === "1") {
        sessionStorage.removeItem("hg_recupera_bozza");
        onBozza();
      }
    } catch {
      /* */
    }
    window.addEventListener("hg:riprendi-bozza", onBozza);
    window.addEventListener("hg:open-quote", onOpen);
    return () => {
      window.removeEventListener("hg:riprendi-bozza", onBozza);
      window.removeEventListener("hg:open-quote", onOpen);
    };
  }, [loadQuote]);

  // ── "NUOVO PREVENTIVO" DALLA BARRA ────────────────────────────────────────
  //  Torna al configuratore vuoto senza ricaricare: in videochiamata un
  //  ricaricamento interromperebbe la diretta. Toglie anche il numero
  //  dall'indirizzo, così un eventuale ricaricamento non riapre il vecchio.
  useEffect(() => {
    const reset = () => {
      baseSnapRef.current = null;
      editSigRef.current = "";
      setResult(null);
      // svuota DAVVERO: prima restavano dati e scelte del cliente precedente,
      // e in diretta il cliente nuovo se li vedeva addosso.
      setProfile({ ...EMPTY });
      //  ── ⚠️ E IL CLIENTE DI ADESSO TORNA SUBITO ───────────────────────
      //   Svuotare è giusto — i dati del cliente precedente non devono
      //   restare addosso al successivo — ma qui la scheda restava vuota
      //   ANCHE quando il cliente è lo stesso: secondo preventivo per la
      //   stessa persona, e il nome da riscrivere a mano davanti a lei.
      //   Si rimette la persona della consulenza in corso, e si chiede al CRM
      //   la sua scheda vera (l'email aggiunta dopo l'avvio, il cognome
      //   corretto): forzando, perché la scheda è appena stata svuotata e non
      //   c'è niente da difendere.
      const leadOra = leggiLeadCorrente();
      if (leadOra) {
        applicaLead(leadOra, true);
        void rinfrescaLead(leadOra.id, true);
      }
      setBaseId(PARTENZA.baseId);
      //  ⚠️ Non `PARTENZA.selected`: quella è la combinazione scritta nel
      //   codice, e da quando il pannello Listino decide le spunte sarebbe una
      //   schermata "nuova" diversa da quella che si apre aprendo la pagina.
      setSelected(new Set(preselRef.current));
      sceltoAMano.current = false;
      setSimOn(PARTENZA.simOn);
      setInstallOn(PARTENZA.installOn);
      setInstallLoc(PARTENZA.installLoc);
      setFitting(PARTENZA.fitting);
      setQty(PARTENZA.qty);
      setManual(null);
      setCodeInput("");
      setCodeErr(null);
      setQuoteRef(null);
      //  ── "NUOVO PREVENTIVO" NON BUTTA VIA NIENTE ─────────────────────────
      //   Qui la bozza veniva cancellata. Ma svuotare la schermata e cancellare
      //   il lavoro sono due cose diverse: capita di premere "Nuovo preventivo"
      //   e accorgersi un attimo dopo che quello di prima serviva ancora.
      //   Ora lo schermo si pulisce e il lavoro precedente resta lì, offerto
      //   dalla scheda di recupero: si riprende con un clic, o si butta via
      //   con "Riparti in bianco" — ma è una decisione, non un effetto laterale.
      const b = leggiBozza();
      const codice = getLiveId();
      if (b && b.code && codice && b.code === codice && bozzaUtile(b, partenzaOra())) {
        bozzaInAttesa.current = true;
        setBozza(b);
      } else eliminaBozza();
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has("id") || u.searchParams.has("ref")) {
          u.searchParams.delete("id");
          u.searchParams.delete("ref");
          window.history.replaceState({}, "", u.toString());
        }
      } catch {
        /* */
      }
      window.scrollTo({ top: 0 });
    };
    try {
      if (sessionStorage.getItem("hg_new_quote") === "1") {
        sessionStorage.removeItem("hg_new_quote");
        reset();
      }
    } catch {
      /* */
    }
    /*  Per chi è il preventivo nuovo: "" = quello comune (com'è sempre
        stato), un gettone = quello di quella persona. Arriva o nell'evento o
        — quando la pagina vive dentro l'anteprima dispositivo, dove gli
        eventi non passano — in una riga di memoria. */
    const perChi = (dettaglio?: unknown) => {
      let chi: string | null = null;
      const d = dettaglio as { chi?: unknown } | undefined;
      if (d && typeof d.chi === "string") chi = d.chi;
      if (chi === null) {
        try { chi = localStorage.getItem("hg_new_quote_chi"); } catch { /* */ }
      }
      if (chi !== null) setApertoSubito(chi);
    };
    const onNew = (e: Event) => {
      try {
        sessionStorage.removeItem("hg_new_quote");
      } catch {
        /* */
      }
      perChi((e as CustomEvent).detail);
      reset();
    };
    const onStore = (e: StorageEvent) => {
      if (e.key === "hg_new_quote_at") onNew(new CustomEvent("hg:new-quote"));
    };
    window.addEventListener("hg:new-quote", onNew);
    window.addEventListener("storage", onStore);
    return () => {
      window.removeEventListener("hg:new-quote", onNew);
      window.removeEventListener("storage", onStore);
    };
  }, []);

  // ── LE MODIFICHE SI VEDONO MENTRE LE FAI ──────────────────────────────────
  //  Il consulente cambia quantità o riapre le condizioni dal proprio pannello;
  //  chi ha il preventivo aperto (cliente compreso) lo vede aggiornarsi da solo
  //  entro pochi secondi, senza ricaricare e senza che nessuno gli dica di farlo.
  resultRef.current = result;
  pricingRef.current = pricing;
  const watchedRef = result?.ref ?? null;
  shownRef.current = watchedRef;
  useEffect(() => {
    if (!watchedRef) return;
    let alive = true;
    const check = () =>
      fetch(`/api/presenter/quote-edit?ref=${encodeURIComponent(watchedRef)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((ej) => {
          if (!alive) return;
          //  ── QUESTO PREVENTIVO È STATO SOSTITUITO DA UN ALTRO ─────────────
          //   Il consulente ha applicato una modifica e ne è nato uno nuovo. Le
          //   pagine già aperte — la sua, e soprattutto il TELEFONO DEL CLIENTE,
          //   che ha il vecchio link davanti — devono passare al documento buono
          //   da sole: è l'unico modo perché in giro non resti un secondo prezzo.
          //   Non costa una chiamata in più: il rimando viaggia insieme alle
          //   modifiche, nella stessa risposta.
          const sostituitoDa = String(ej?.sostituitoDa || "").trim();
          if (sostituitoDa && sostituitoDa !== watchedRef) {
            editSigRef.current = "";
            baseSnapRef.current = null;
            setQuoteEdit(null);
            void loadQuote(sostituitoDa);
            return;
          }
          const e = ej?.edit as QuoteEditPatch | null;
          const sig = e ? JSON.stringify(e) : "";
          if (sig === editSigRef.current) return; // nulla di nuovo
          editSigRef.current = sig;
          const orig = baseSnapRef.current;
          if (!orig || orig.ref !== watchedRef) return;
          setQuoteEdit(e);
          setResult(e ? withEdit(orig, e, qtyDiscRef.current, accontoDi(listinoRef.current)) : orig);
        })
        .catch(() => {});
    const iv = setInterval(check, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [watchedRef, loadQuote]);

  // ─────────── DIRETTA LIVE (mirror in tempo reale) ───────────
  const watchId =
    typeof window !== "undefined"
      ? codiceDaIndirizzo(window.location.pathname, window.location.search)
      : null;
  const isViewer = !!watchId;
  // link "cliente": preventivo interattivo ma senza i pulsanti del presentatore
  const isClient =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("client") === "1";
  // ── LINK SOLO PREVENTIVO, LEGATO ALLA CONSULENZA ──────────────────────────
  //  `sess` è il codice della consulenza che ha generato il link. Il cliente
  //  vede la pagina e la compila in tempo reale insieme a te, senza che gli
  //  venga chiesto nulla: nessuna camera, nessun microfono, nessuna chiamata.
  //  Se la consulenza è stata chiusa, il link non è più valido.
  const clientSess =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("sess") : null;
  const [sessDead, setSessDead] = useState(false);
  useEffect(() => {
    if (!isClient || !clientSess) return;
    let stop = false;
    //  Il link del preventivo ha una sessione TUTTA SUA, che non muore con la
    //  videochiamata: resta valida finché il consulente non ricomincia da capo.
    //  Prima si verificava la sessione della chiamata, che si azzera alla
    //  chiusura — e il cliente trovava il link "non più attivo" pochi minuti
    //  dopo averlo ricevuto.
    //  Si chiede lo stato DI QUESTO link, non della consulenza in generale:
    //  ogni preventivo ha la sua sessione, quindi un link mandato ieri non
    //  muore perché nel frattempo ne è stato preparato un altro.
    const suo = new URLSearchParams(window.location.search).get("id") || "";
    const check = () =>
      fetch(
        //  ⚠️ Si manda anche il PROPRIO codice. Prima, il link senza numero di
        //   preventivo ricadeva sulla casella condivisa da tutti i consulenti:
        //   bastava che un collega ricominciasse perché questo cliente leggesse
        //   «link non più attivo» con la sua consulenza ancora aperta.
        `/api/presenter/quote-session?sess=${encodeURIComponent(clientSess || "")}${suo ? `&ref=${encodeURIComponent(suo)}` : ""}`,
      )
        .then((r) => r.json())
        .then((j) => {
          if (stop) return;
          // nessun codice registrato = nessun link è ancora stato invalidato: si passa
          setSessDead(j?.morto === true || (!!j?.code && j.code !== clientSess));
        })
        .catch(() => {});
    check();
    const iv = setInterval(check, 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [isClient, clientSess]);
  // ── IL LINK SOLO PREVENTIVO RISPECCHIA COME UN OSPITE ─────────────────────
  //  `client=1&sess=CODICE` non è un semplice indirizzo alla pagina: nasce
  //  DENTRO una consulenza. Finora però tutto il lato RICEVENTE era legato al
  //  parametro `watch`, quindi chi apriva questo link vedeva sì la pagina, ma
  //  non lo scorrimento, non il dito e non i cambi di vista del consulente:
  //  restava fermo mentre dall'altra parte si presentava.
  //  Ora ascolta lo stesso canale della consulenza — stato, scorrimento e
  //  puntatore — pur restando una pagina normale: nessuna camera, nessun
  //  microfono, nessuna richiesta di entrare in chiamata.
  //  ATTENZIONE alla distinzione, che è il punto di tutto:
  //   · il GESTO (scorrimento e dito) viene rispecchiato: è ciò che serve per
  //     seguire il consulente mentre presenta;
  //   · lo STATO (quale preventivo, quali opzioni, i dati del cliente) NO.
  //  Lo stato vive su una chiave GLOBALE del server, non legata alla sessione:
  //  applicarlo qui significherebbe che il cliente, un secondo dopo aver aperto
  //  il proprio preventivo, si ritrova quello di un altro — o il configuratore
  //  vuoto appena il consulente passa al cliente successivo. Per lo stesso
  //  motivo la pagina resta INTERATTIVA: nessuno la sta riscrivendo da fuori,
  //  quindi il cliente può compilare, scaricare il PDF e copiare l'IBAN.
  // ── LA BOZZA SI SALVA E SI RIPRENDE ───────────────────────────────────────
  //  Solo sul dispositivo del consulente, e solo finché il preventivo non è
  //  stato creato: da quel momento la verità è la riga a database.
  /** ── CHI ABBIAMO DAVANTI ──────────────────────────────────────────────
   *  Quando la consulenza parte dal CRM, il lead viaggia con lei: nome,
   *  cognome, telefono, età e le note già prese. Il preventivo nasce intestato
   *  invece di essere ricompilato a mano davanti al cliente — che è il momento
   *  in cui si sbagliano i cognomi e si saltano le cifre dei numeri.
   *  Da qui in poi le correzioni tornano indietro sulla scheda: una verità sola. */
  const leadCrmRef = useRef<{
    id: string;
    nome?: string;
    cognome?: string;
    telefono?: string;
    email?: string;
    eta?: string;
    problemi?: string;
  } | null>(null);
  /** Mette i dati del cliente nella scheda.
   *  ⚠️ `forza` decide chi vince: di norma si riempie SOLO quello che è vuoto,
   *   perché ciò che il consulente ha appena scritto davanti al cliente vale
   *   più di quello che c'è in archivio. Si forza soltanto quando la scheda è
   *   appena stata svuotata (il tasto «Nuovo preventivo») o quando la persona
   *   davanti è cambiata: lì non c'è niente da difendere. */
  const applicaLead = useCallback(
    (l: NonNullable<typeof leadCrmRef.current> | null, forza = false) => {
      if (!l?.id) return;
      leadCrmRef.current = l;
      setProfile((p) => ({
        ...p,
        nome: (forza ? l.nome : p.nome || l.nome) || "",
        cognome: (forza ? l.cognome : p.cognome || l.cognome) || "",
        telefono: (forza ? l.telefono : p.telefono || l.telefono) || "",
        email: (forza ? l.email : p.email || l.email) || "",
        eta: (forza ? l.eta : p.eta || l.eta) || "",
        problemi: (forza ? l.problemi : p.problemi || l.problemi) || "",
      }));
    },
    [],
  );
  const leggiLeadCorrente = useCallback((): NonNullable<typeof leadCrmRef.current> | null => {
    try {
      const raw = localStorage.getItem("hg_lead_corrente");
      if (!raw) return null;
      const l = JSON.parse(raw) as NonNullable<typeof leadCrmRef.current>;
      return l?.id ? l : null;
    } catch {
      return null;
    }
  }, []);
  /** ── ⚠️ LA SCHEDA DEL CRM È PIÙ FRESCA DELLA FOTOGRAFIA ────────────────
   *  Segnalazione del committente: «non recupera i dati del cliente inseriti
   *  nel lead».
   *  `hg_lead_corrente` è una FOTOGRAFIA scattata dal CRM nell'istante in cui
   *  si preme «Avvia consulenza»: l'email aggiunta alla scheda dieci minuti
   *  dopo, il cognome corretto, l'età appena chiesta al telefono non ci sono —
   *  e non ci sarebbero mai, perché nessuno riscrive quella fotografia.
   *  Qui si richiede la scheda vera al CRM e si riempie quello che manca.
   *  ⚠️ La porta è già aperta: la sessione di Meetly viaggia in un cookie, e
   *   la rotta accetta chi sta conducendo (routes/api.crm.lead-sync). Se la
   *   lettura non riesce — nessuna sessione, rete assente — resta la
   *   fotografia, che è come si è sempre comportato. */
  const rinfrescaLead = useCallback(
    async (id: string, forza = false) => {
      if (!id) return;
      try {
        const j = (await fetch(`/api/crm/lead-sync?leadId=${encodeURIComponent(id)}`).then((r) =>
          r.json(),
        )) as { ok?: boolean; lead?: NonNullable<typeof leadCrmRef.current> };
        if (!j?.ok || !j.lead?.id) return;
        //  I campi vuoti della scheda non devono cancellare quelli della
        //  fotografia: si tiene il più informativo dei due.
        const prima = leadCrmRef.current;
        applicaLead(
          {
            ...j.lead,
            nome: j.lead.nome || prima?.nome || "",
            cognome: j.lead.cognome || prima?.cognome || "",
            telefono: j.lead.telefono || prima?.telefono || "",
            email: j.lead.email || prima?.email || "",
            eta: j.lead.eta || prima?.eta || "",
            problemi: j.lead.problemi || prima?.problemi || "",
          },
          forza,
        );
      } catch {
        /* resta la fotografia */
      }
    },
    [applicaLead],
  );
  useEffect(() => {
    if (isViewer || isClient) return;
    const l = leggiLeadCorrente();
    if (!l) return;
    applicaLead(l);
    void rinfrescaLead(l.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** ── ⚠️ E SE LA CONSULENZA CAMBIA MENTRE QUESTA PAGINA È APERTA ────────
   *  Il CRM scrive `hg_lead_corrente` a ogni «Avvia consulenza», da un'altra
   *  scheda del browser. Questa pagina la leggeva una volta sola al
   *  montaggio: chi la teneva aperta e avviava la consulenza dopo — o passava
   *  al cliente successivo — restava con la persona di prima addosso, o con
   *  nessuna.
   *  Si applica FORZANDO, ma solo quando la persona è davvero cambiata:
   *  un'altra consulenza è un altro cliente, e tenere il nome del precedente
   *  sarebbe il modo di intestargli il preventivo sbagliato. */
  useEffect(() => {
    if (isViewer || isClient) return;
    const suCambio = (e: StorageEvent) => {
      if (e.key !== "hg_lead_corrente") return;
      const l = leggiLeadCorrente();
      if (!l || l.id === leadCrmRef.current?.id) return;
      applicaLead(l, true);
      void rinfrescaLead(l.id, true);
    };
    window.addEventListener("storage", suCambio);
    return () => window.removeEventListener("storage", suCambio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*  ── ⚠️ SONO DENTRO LA STANZA DI UN'ALTRA PERSONA? ───────────────────
      Serve agli effetti della bozza, che stanno più in alto di dove
      `guardoIlSuo` si può calcolare: un riferimento, aggiornato appena lo si
      sa. Il perché sta nel cartello sopra la scheda «preventivo lasciato a
      metà». */
  const guardoIlSuoRef = useRef(false);
  const bozzaPronta = useRef(false);
  /** Il lavoro lasciato a metà, in attesa che tu decida di riprenderlo.
   *  Non viene applicato da solo: sarebbe una sorpresa davanti al cliente. */
  const [bozza, setBozza] = useState<Bozza | null>(null);
  /** Spiegazione della scadenza: si apre dal banner e dalla riga del prezzo. */
  const [percheScade, setPercheScade] = useState(false);
  /** ── PERCHÉ QUI SERVE UN RIFERIMENTO E NON LO STATO ─────────────────────
   *  L'effetto che offre la bozza e quello che la salva girano nello STESSO
   *  giro: quando il secondo parte, lo stato aggiornato dal primo non è ancora
   *  arrivato, quindi vedeva "nessuna bozza in attesa" e salvava sopra il
   *  lavoro da recuperare la schermata vuota appena aperta — cancellandolo
   *  nell'istante esatto in cui lo stavamo offrendo. Il riferimento cambia
   *  valore SUBITO, e ferma il salvataggio già dal primo giro. */
  const bozzaInAttesa = useRef(false);
  /** Fotografia di quello che c'è adesso sullo schermo, pronta da salvare. */
  const istantanea = useCallback(
    (): Bozza => ({
      v: 2,
      code: getLiveId() || "",
      at: Date.now(),
      baseId,
      selected: [...selected],
      simOn,
      installOn,
      installLoc,
      fitting,
      qty,
      profile,
      varianti,
      //  Solo se è DAVVERO applicato: quello scritto a metà nel campo non è
      //  uno sconto, e riproporlo alla ripresa sarebbe una promessa falsa.
      codice: manual?.code || "",
      //  ⚠️ LA PAGINA DICHIARA SE LE SCELTE SONO STATE TOCCATE, invece di
      //   lasciarlo indovinare a un confronto con le spunte di partenza —
      //   che arrivano dal listino e alla riapertura non ci sono ancora. Era
      //   il motivo per cui la scheda «preventivo lasciato a metà» usciva
      //   ogni volta, anche su una pagina mai sfiorata. Vedi `toccato` in
      //   shop/bozza.
      toccato: sceltoAMano.current,
    }),
    [baseId, selected, simOn, installOn, installLoc, fitting, qty, profile, varianti, manual],
  );
  //  Riferimenti sempre freschi: quando si esce dalla schermata la funzione di
  //  pulizia vede i valori di QUANDO è stata creata, non quelli di adesso.
  const istantaneaRef = useRef(istantanea);
  istantaneaRef.current = istantanea;
  useEffect(() => {
    if (isViewer || isClient) return;
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("id") || q.get("ref")) {
        bozzaPronta.current = true;
        return;
      } // si sta aprendo un preventivo esistente
      const b = leggiBozza();
      if (b) {
        // solo se è di QUESTA consulenza (le bozze non si mescolano fra clienti)
        // e solo se contiene qualcosa che valga la pena riprendere.
        //  ── LA BOZZA È DI QUESTA CONSULENZA, O DI NESSUNA ──────────────────
        //   Il confronto è stretto: senza codice, o con il codice di un'altra
        //   consulenza, non viene nemmeno mostrata. Aprendo una consulenza
        //   nuova si parte puliti — il lavoro sul cliente precedente non deve
        //   comparire davanti a quello dopo.
        const codice = getLiveId();
        const mia = !!b.code && !!codice && b.code === codice;
        if (mia && bozzaUtile(b, partenzaOra())) {
          bozzaInAttesa.current = true;
          setBozza(b);
          console.log("[QUOTE] c'è un preventivo lasciato a metà: in attesa del recupero");
        } else if (!mia) eliminaBozza();
      }
    } catch {
      /* */
    }
    bozzaPronta.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Rimette sullo schermo un lavoro salvato. Non chiede nulla: chi la chiama
   *  ha già deciso (il pulsante nella scheda, o "Recupera preventivo" dalla
   *  barra, che deve recuperare al primo clic e non aprire un'altra domanda). */
  /** Ricontrolla un codice già applicato prima e lo rimette se vale ancora.
   *  Silenzioso: non è una scelta che si sta facendo adesso, è la ripresa di
   *  una fatta prima — un festeggiamento a schermo sarebbe fuori posto. */
  const riapplicaCodice = useCallback(async (code: string) => {
    const c = code.trim();
    if (!c) return;
    try {
      const res = await fetch(conSessione("/api/public/validate-discount"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const j = await res.json();
      if (j.valid) {
        setManual(j as Discount);
        setCodeErr(null);
      } else {
        setManual(null);
        setCodeErr(
          j.reason === "sold_out"
            ? "Il codice di prima è esaurito: i posti riservati sono finiti."
            : "Il codice di prima non è più valido.",
        );
      }
    } catch {
      //  Un controllo di rete andato male non deve far fallire la ripresa: il
      //  codice resta scritto nel campo e basta premere "Applica".
    }
  }, []);
  const applicaBozza = useCallback((b: Bozza | null) => {
    if (!b) return;
    if (b.baseId) setBaseId(b.baseId);
    if (Array.isArray(b.selected)) {
      setSelected(new Set(b.selected));
      sceltoAMano.current = true;   // il lavoro ripreso vince sulla preselezione
    }
    if (typeof b.simOn === "boolean") setSimOn(b.simOn);
    if (typeof b.installOn === "boolean") setInstallOn(b.installOn);
    if (b.installLoc) setInstallLoc(b.installLoc);
    if (b.varianti) setVarianti(b.varianti);
    if (b.fitting) setFitting(b.fitting);
    if (b.qty) setQty(b.qty);
    if (b.profile) setProfile({ ...EMPTY, ...b.profile });
    /*  ── IL CODICE TORNA COL RESTO ─────────────────────────────────────────
        Prima no: si riprendeva il preventivo e il codice sconto era sparito,
        col prezzo risalito e da riscrivere davanti al cliente.
        Si ricontrolla sul server invece di rimetterlo com'era: nel frattempo
        può essere scaduto o esaurito, e un prezzo promesso su un codice morto
        è peggio di un codice da riscrivere. Se non vale più, il campo resta
        compilato con la spiegazione accanto: si vede cos'è successo. */
    if (b.codice) {
      setCodeInput(b.codice);
      void riapplicaCodice(b.codice);
    }
    bozzaInAttesa.current = false;
    setBozza(null);
    try {
      sfx.success();
    } catch {
      /* */
    }
  }, [riapplicaCodice]);
  applicaRef.current = applicaBozza;
  /** Il pulsante dentro la scheda. */
  const recuperaBozza = useCallback(() => applicaBozza(bozza), [applicaBozza, bozza]);
  /** Butta via il lavoro precedente e riparte in bianco. */
  const scartaBozza = useCallback(() => {
    eliminaBozza();
    bozzaInAttesa.current = false;
    setBozza(null);
  }, []);
  useEffect(() => {
    if (isViewer || isClient || !bozzaPronta.current || result) return;
    //  ⚠️ E NEMMENO MENTRE GUARDO IL PREVENTIVO DI UN ALTRO: quello che c'è
    //   sullo schermo in quel momento è il SUO, e salvarlo come bozza mia
    //   vorrebbe dire ritrovarmi il suo lavoro al posto del mio.
    if (guardoIlSuoRef.current) return;
    //  Finché la scheda di recupero è lì, NON si salva: salvare adesso
    //  scriverebbe sopra il lavoro da recuperare la schermata vuota che stai
    //  guardando — cioè lo cancellerebbe nell'istante esatto in cui lo offriamo.
    if (bozza || bozzaInAttesa.current) return;
    salvaBozza(istantanea());
  }, [
    isViewer,
    isClient,
    result,
    bozza,
    baseId,
    selected,
    simOn,
    installOn,
    installLoc,
    fitting,
    qty,
    profile,
    istantanea,
  ]);
  // ── SI SALVA ANCHE MENTRE ESCI ────────────────────────────────────────────
  //  Uscire dal preventivo per far vedere un video, una slide o un sito è la
  //  cosa più normale del mondo durante una consulenza — ed è esattamente il
  //  momento in cui questa schermata viene smontata. Il salvataggio a ogni
  //  scelta basterebbe, ma qui non si può sbagliare: si riscrive anche
  //  nell'istante in cui te ne vai, e quando chiudi la finestra.
  useEffect(() => {
    if (isViewer || isClient) return;
    const scrivi = () => {
      if (resultRef.current || bozzaInAttesa.current || guardoIlSuoRef.current) return;
      salvaBozza(istantaneaRef.current());
    };
    window.addEventListener("pagehide", scrivi);
    window.addEventListener("beforeunload", scrivi);
    return () => {
      window.removeEventListener("pagehide", scrivi);
      window.removeEventListener("beforeunload", scrivi);
      scrivi(); // uscita dalla schermata (Media, Slide, Link…)
    };
  }, [isViewer, isClient]);

  /*  ── IN UNA CONSULENZA DI GRUPPO OGNUNO HA IL SUO ──────────────────────
      Richiesta del committente: «posso decidere se a qualche utente far
      mostrare il loro preventivo singolo individuale, e lui vede solo il suo
      preventivo reale in quel momento; loro possono compilare il loro
      preventivo da soli».
      Qui la pagina si fa tre domande, e le risposte stanno tutte in
      shop/preventivi-di-gruppo:
        1. chi sono io in questa stanza (il gettone scelto all'ingresso);
        2. che cosa mi tocca vedere — il mio preventivo, quello comune, o
           niente (il comune spento non si guarda: ci sta dentro il lavoro in
           corso del consulente);
        3. chi ci scrive: se la penna è mia questa pagina è viva come il link
           «solo preventivo», se ce l'ha il consulente torna uno specchio.
      ⚠️ CON UNA PERSONA SOLA NON CAMBIA NIENTE. Senza gettone `vedoDelGruppo`
       resta "comune" e tutte e tre le righe qui sotto si spengono: è la
       richiesta esplicita del committente («se entra solo 1 rimane così com'è»).  */
  const hostId = useLiveId(); // sessione condivisa (gestita dalla PresenterBar)
  /** Si sta compilando in due in questa stanza? Lo legge `applySnapshot`, che
   *  può essere rimasto agganciato a un giro precedente. Vedi `inDue`. */
  const inDueRef = useRef(false);
  /*  Come `inDueRef`, e per lo stesso motivo: `applySnapshot` può essere
      rimasto agganciato a un giro precedente, e deve leggere il valore di
      ADESSO — non quello di quando è stato creato. */
  const mirrorsStateRef = useRef(false);
  //  ⚠️ Anche quello che il server gli ha messo nell'indirizzo: vedi
  //   `gettoneDiQuestoCliente`. È il cliente che non si è mai ricaricato.
  const mioGettone = isViewer ? gettoneDiQuestoCliente(watchId) : "";
  const { regia: regiaGruppo, gruppo: inGruppo } = useRegiaGruppo(watchId, isViewer && !!mioGettone);
  const vedoDelGruppo = mioGettone
    ? cosaVede({ regia: regiaGruppo, io: mioGettone, gruppo: inGruppo })
    : "comune";
  /*  ⚠️ FINCHÉ LA REGIA NON È ARRIVATA NON SI MOSTRA NIENTE, e non è un
      eccesso di prudenza: `null` vuol dire «non lo so ancora», e il ripiego
      comodo — «intanto fagli vedere il comune» — vorrebbe dire mostrare per
      due secondi, a ogni caricamento di pagina, un preventivo che il
      consulente non ha ancora acceso. Al cliente esce un velo che dice che
      sta arrivando; è la stessa cosa che vede quando davvero non c'è niente
      per lui, e in quei due secondi è anche la verità. */
  //  ⚠️ Se lo vede, lo può compilare: non c'è più nessuna penna da passare
  //   (vedi `hoLaPenna` in shop/preventivi-di-gruppo).
  const scrivoIlMio = vedoDelGruppo === "mio"
    && hoLaPenna({ regia: regiaGruppo, io: "cliente", chi: mioGettone });

  /*  ── E DALL'ALTRA PARTE: IL CONSULENTE CHE GUARDA ──────────────────────
      «Io posso andare a gestire il loro preventivo in tempo reale cliccando
      sul nome dell'utente, e ci deve essere un pulsante per editarlo anche io
      con loro e mi mostra cosa stanno facendo».
      È la stessa regola di sopra, letta dall'altro lato: nella stanza di
      quella persona c'è UNA penna. Se ce l'ha lei, questa pagina diventa uno
      specchio del suo schermo — ed è così che «mi mostra cosa sta facendo».
      Se la prendo io, torna la pagina di sempre, ma quello che scrivo finisce
      nella sua stanza e lo vede comparire.
      ⚠️ Solo su una persona DAVVERO attesa qui: `aperto` è una stringa che
       arriva dal server, e una stanza inventata porterebbe il consulente a
       specchiarsi su niente, con la pagina bloccata e nessun modo di capire
       perché. */
  /*  ── ⚠️ «GUARDA DA ME» NON FUNZIONAVA SEMPRE, ED ERA QUESTA COPPIA ────
      Segnalazione del committente: «il pulsante guarda da me / chiudi da me
      non funziona sempre». «Sempre» è la parola che conta: a volte sì, a
      volte no — cioè una corsa, non un guasto.
      Il pulsante scrive `aperto` nella regia, e questa pagina si specchia
      sulla stanza di quella persona solo se (a) legge la regia e (b)
      riconosce il gettone fra gli attesi. Tutte e due dipendevano da un
      elenco che si rilegge OGNI TRENTA SECONDI:
       · la regia non veniva nemmeno chiesta finché l'elenco era vuoto —
         `attesiDelGruppo.length >= 1` — e con una consulenza aperta dal link
         l'elenco è vuoto proprio all'inizio, finché il cliente non viene
         registrato;
       · e se il gettone non era ancora in elenco, `guardoIlSuo` restava
         falso: il pulsante si accendeva, il server registrava la mossa, e la
         pagina non faceva niente. Trenta secondi dopo, da sola, cominciava a
         funzionare. Da fuori: «a volte sì, a volte no».
      Adesso la regia si legge sempre quando c'è una consulenza aperta, e
      l'elenco si rilegge SUBITO quando arriva un gettone che non conosce. */
  const [giroAttesi, setGiroAttesi] = useState(0);
  const attesiDelGruppo = useAttesiDelConsulente(!isViewer && !isClient ? hostId : null, giroAttesi);
  const { regia: regiaDelConsulente } = useRegiaGruppo(
    hostId,
    //  ⚠️ BASTA UNA CONSULENZA APERTA. Prima serviva anche una persona in
    //   elenco: vedi il cartello qui sopra.
    !isViewer && !isClient && !!hostId,
  );
  /*  ── «NUOVO PREVENTIVO PER…» DEVE VALERE SUBITO ────────────────────────
      Richiesta del committente: «quando clicco nuovo preventivo posso
      selezionare se pubblico o di uno degli utenti che è dentro».
      La scelta si scrive sul server (la regia), ma questa pagina la rileggerà
      fra tre secondi: nel frattempo il configuratore si svuota e la prima
      cosa che scriverebbe finirebbe nella stanza di PRIMA — cioè il
      preventivo comune, cancellato da un preventivo vuoto intestato a un
      altro. Qui la scelta vale immediatamente, e lo scavalco si toglie da sé
      appena il server dice la stessa cosa. */
  const [apertoSubito, setApertoSubito] = useState<string | null>(null);
  const apertoDaMe = apertoSubito ?? (regiaDelConsulente?.aperto || "");
  useEffect(() => {
    if (apertoSubito !== null && (regiaDelConsulente?.aperto || "") === apertoSubito) setApertoSubito(null);
  }, [regiaDelConsulente, apertoSubito]);
  const conosciuto = attesiDelGruppo.some((a) => a.gettone === apertoDaMe);
  //  Gettone che non conosco: l'elenco è vecchio, lo rileggo adesso invece di
  //  aspettare il giro. Una volta per gettone, non a ripetizione.
  useEffect(() => {
    if (!isViewer && !isClient && apertoDaMe && !conosciuto) setGiroAttesi((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apertoDaMe]);
  const guardoIlSuo = !isViewer && !isClient && !!apertoDaMe && conosciuto;
  /*  ⚠️ LA PENNA NON È PIÙ UN COMANDO: chi lo vede lo può toccare. Se ho
      aperto il preventivo di una persona, ci scrivo — che è quello che si fa
      davvero quando lo si compila parlando. (Il selettore «solo lui / solo
      io» l'ha fatto togliere il committente: chiedeva di ragionare su una
      cosa che ha una risposta sola.) */
  guardoIlSuoRef.current = guardoIlSuo;
  const pennaMia = guardoIlSuo;

  /*  ── SI SCRIVE IN DUE SULLA STESSA PAGINA ──────────────────────────────
      Richiesta del committente: «fai che però posso modificare anche io il
      preventivo del cliente mentre lui lo edita».
      Con una penna sola i due ruoli sono netti: chi scrive non riceve, chi
      riceve non scrive. Qui invece le due cose valgono INSIEME, e la pagina
      deve fare una cosa che prima non faceva mai: restare viva e continuare
      ad applicare quello che arriva dall'altro.
      ⚠️ L'ULTIMO CHE TOCCA VINCE, e va detto: lo stato è una fotografia
       intera della pagina. Su scelte fatte parlandosi è esattamente come
       passarsi un foglio; due dita sulla stessa voce nello stesso secondo
       danno un vincitore solo. Per quello «prendi tu la penna» resta. */
  /*  Si è in due quando il preventivo è acceso ANCHE per lui: solo allora
      dall'altra parte c'è qualcuno che scrive e le due pagine devono
      applicarsi a vicenda quello che arriva. Se lo stai preparando tu e per
      lui è spento, non c'è niente da conciliare. */
  const inDue =
    (isViewer && vedoDelGruppo === "mio" && siScriveInDue(regiaGruppo, mioGettone)) ||
    (guardoIlSuo && siScriveInDue(regiaDelConsulente, apertoDaMe));
  /*  ── «FAI CHE VEDO ANCHE DOVE CLICCA LUI» ──────────────────────────────
      Il dito del consulente viaggia da sempre verso il cliente. Adesso
      torna anche indietro: quando il consulente ha aperto il preventivo di
      una persona, quella persona manda il proprio.
      ⚠️ SOLO MENTRE QUALCUNO GUARDA, ed è la condizione che fa la differenza
       fra una comodità e uno spreco: `aperto` dice che il consulente è
       dentro quella stanza in questo momento. Fuori di lì il cliente non
       trasmette un messaggio ogni decimo di secondo a nessuno.
      ⚠️ E SOLO IL DITO. Lo scorrimento no: il consulente sta scorrendo per
       conto suo, e trascinargli la pagina sotto gli occhi mentre legge
       sarebbe la cosa più fastidiosa di tutta la consulenza. */
  const mandaIlDito = isViewer && vedoDelGruppo === "mio" && !!mioGettone
    && (regiaGruppo?.aperto || "") === mioGettone;

  const isMirror = (isViewer && !scrivoIlMio) || (guardoIlSuo && !pennaMia)
    || (isClient && !!clientSess && !sessDead);
  //  ── IL PREVENTIVO SI COSTRUISCE DAVANTI A LUI ────────────────────────────
  //  Chi apre il link con il codice della consulenza in corso vede il
  //  preventivo comporsi in tempo reale: ogni voce che tocchi compare sul suo
  //  schermo mentre la spieghi. Prima seguiva solo il NUMERO di un preventivo
  //  già creato, quindi durante la composizione non vedeva nulla.
  //  Il rischio che questo comportava — lo stato è una chiave globale, e un
  //  cliente poteva vedere il preventivo di un altro — oggi non c'è più: il
  //  codice è quello della consulenza, cambia con "Ricomincia", e chi ha un
  //  codice vecchio non riceve niente.
  const mirrorsState = (isViewer && !scrivoIlMio) || (guardoIlSuo && !pennaMia)
    || (isClient && !!clientSess && !sessDead);
  /** Si applica quello che arriva? Sempre, quando si guarda; e anche quando si
   *  scrive in due, che è il solo caso in cui una pagina viva riceve. */
  const applicaDaRemoto = mirrorsState || inDue;
  //  Letto da `applySnapshot`, che può essere rimasto agganciato a un giro
  //  precedente: senza il ref, i due ripari qui sotto si spegnerebbero
  //  proprio nell'istante in cui si passa a scrivere in due.
  inDueRef.current = inDue;
  mirrorsStateRef.current = mirrorsState;
  //  Il cliente collegato alla consulenza SEGUE il preventivo che apri: non
  //  l'intero stato — che è una chiave globale e finirebbe per mostrargli i
  //  dati di un altro cliente — ma solo QUALE preventivo è aperto. Il contenuto
  //  se lo rilegge da sé dal database, quindi resta il preventivo giusto e la
  //  pagina resta sua: può compilare, scaricare il PDF, copiare l'IBAN.
  /*  Chi ha la penna sul PROPRIO preventivo sta esattamente nella stessa
      situazione del link «solo preventivo»: la pagina è sua e la compila, ma
      quale preventivo sia aperto lo decide il consulente. */
  const followsQuote = (isClient && !!clientSess && !sessDead) || scrivoIlMio;

  // ── L'INDIRIZZO SEGUE IL PREVENTIVO APERTO ────────────────────────────────
  //  Appena un preventivo è sullo schermo, il suo numero finisce nell'indirizzo
  //  (/preventivo?id=IDP1234). Serve a tre cose concrete:
  //   · ricaricando la pagina si riapre quel preventivo, non il configuratore;
  //   · l'indirizzo si può copiare dalla barra del browser ed è già quello giusto;
  //   · aprendolo su un secondo schermo si continua da lì.
  //  Prima il numero restava solo in memoria: l'indirizzo diceva "/preventivo" e
  //  basta, qualunque cosa avessi davanti.
  //  Il numero si AGGIUNGE soltanto: toglierlo spetta a "Nuovo preventivo", che
  //  lo fa già. Se lo togliesse anche questo, il primo istante dopo il
  //  caricamento — quando il preventivo è ancora in arrivo — lo cancellerebbe.
  useEffect(() => {
    if (isViewer || isClient || !watchedRef) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("id") === watchedRef) return;
      u.searchParams.set("id", watchedRef);
      u.searchParams.delete("ref");
      window.history.replaceState({}, "", u.toString());
    } catch {
      /* */
    }
  }, [isViewer, isClient, watchedRef]);
  // ── CODICE DEL CANALE ─────────────────────────────────────────────────────
  //  `watchId` (il parametro del link) resta la verità per capire SE questo è un
  //  ospite. Ma il CANALE deve seguire il codice della sessione viva: se il
  //  presentatore rigenera la sessione, un ospite col link precedente resterebbe
  //  in ascolto su un canale morto — scorrimento e puntatore fermi — pur
  //  vedendo ancora i cambi di schermata, che arrivano dal server via polling.
  //  Era esattamente il quadro osservato.
  const guestChan = useGuestChannel(isViewer ? watchId : null);
  //  Il link solo preventivo ascolta ESATTAMENTE la sessione che l'ha generato:
  //  se il consulente ne apre una nuova, il link muore (vedi `sessDead`) invece
  //  di agganciarsi silenziosamente a una consulenza diversa.
  //  ⚠️ UNA SOLA RISPOSTA ALLA DOMANDA «di chi è questo dispositivo»: la dà
  //   `codiceDiretta`, e la usano sia il canale in tempo reale sia il controllo
  //   periodico qui sotto. Quando erano due espressioni diverse, il controllo
  //   periodico chiedeva lo stato di un'altra riga e riportava il cliente al
  //   configuratore un secondo dopo aver visto il preventivo creato.
  const chanBase = codiceDiretta({ isViewer, isClient, guestChan, watchId, clientSess, hostId });
  /*  ── OGNI PREVENTIVO È UNA STANZA ──────────────────────────────────────
      Il codice nudo è il preventivo COMUNE — cioè quello che la consulenza ha
      sempre avuto. Chi ha un preventivo suo si sposta nella sua stanza
      (`codice--gettone`): lì dentro ci sono solo lui e il consulente, e quello
      che scrive non finisce sotto gli occhi degli altri due.
      ⚠️ Vale per il canale in tempo reale E per lo stato sul server: sono la
       stessa stanza vista da due strade, e tenerle disallineate vorrebbe dire
       ricevere dal canale il preventivo di un altro. */
  const chanCode = guardoIlSuo
    ? stanzaDelPreventivo(chanBase, apertoDaMe)
    : vedoDelGruppo === "mio" && mioGettone
    ? stanzaDelPreventivo(chanBase, mioGettone)
    //  ⚠️ NIENTE VUOL DIRE NIENTE: senza stanza non si rispecchia e non si
    //   ascolta nessun canale. È il comune spento, e il comune spento per un
    //   cliente non esiste.
    : vedoDelGruppo === "niente" ? "" : chanBase;
  const navigate = useNavigate();
  useLiveNav(!!hostId && !isViewer && !isClient, watchId);
  /** ── ⚠️ IL LINK «SOLO PREVENTIVO» SEGUE ANCHE I MEDIA ──────────────────
   *  Richiesta del committente: «mentre condivido il preventivo, se seleziono
   *  media deve mostrare i media. Quindi può trasmettere entrambi».
   *  Prima questo link era una stanza sola: il consulente apriva una foto e il
   *  cliente restava a fissare il preventivo fermo, senza che nessuno dei due
   *  se ne accorgesse.
   *  ⚠️ NON si usa `useLiveNav`, che porta l'ospite OVUNQUE vada il consulente
   *   e con il link della stanza: questo è un link che promette «niente
   *   camera, niente microfono, nessuna stanza», e mandarlo su una pagina che
   *   non conosce la forma `client=1&sess=` romperebbe proprio quella
   *   promessa. Le mete sono due sole (vedi shop/segue-contenuto), e tutto il
   *   resto vale «resta dove sei».
   *  ⚠️ Solo per il CLIENTE con il suo link: il consulente, e chi guarda dalla
   *   stanza, non devono essere portati in giro da questa riga. */
  useEffect(() => {
    if (!isClient || !clientSess) return;
    let fermo = false;
    const guarda = () => {
      fetch(`/api/presenter/curpage?sess=${encodeURIComponent(clientSess)}`)
        .then((r) => r.json())
        .then((j) => {
          if (fermo) return;
          const dove = deveAndareSu(String(j?.path ?? ""), window.location.pathname);
          if (!dove) return;
          console.log("[QUOTE] il consulente è passato a", dove);
          //  Navigazione dentro l'applicazione: un ricaricamento vero
          //  butterebbe via il canale e lo stato già ricevuto.
          //  ⚠️ `client` va passato come NUMERO: l'indirizzo lo scrive il
          //   router, e una stringa «1» gliela riscrive fra virgolette
          //   (`client=%221%22`) per non perderne il tipo. Il cliente
          //   arriverebbe con un parametro che non combacia, la pagina non lo
          //   riconoscerebbe più come cliente e gli si aprirebbe la schermata
          //   del consulente.
          void navigate({ to: dove, search: { client: 1, sess: clientSess } as never });
        })
        .catch(() => { /* rete assente: si resta dove si è */ });
    };
    guarda();
    const iv = setInterval(guarda, 1500);
    return () => { fermo = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, clientSess]);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const snapRef = useRef<Record<string, unknown>>({});
  // elezione: solo questo contesto trasmette (vedi claimHostLock)
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  useEffect(() => {
    if (isViewer || isClient || !hostId) {
      setIsBroadcaster(false);
      return;
    }
    const tick = () =>
      setIsBroadcaster((prev) => {
        const now = claimHostLock();
        if (now !== prev)
          console.log(
            now
              ? `[QUOTE] questo contesto TRASMETTE (src=${SRC}) — [SCROLL] contesto: ${scrollContext()}`
              : `[QUOTE] contesto in ascolto, non trasmette (src=${SRC}) — [SCROLL] contesto: ${scrollContext()}`,
          );
        return now;
      });
    tick();
    const iv = setInterval(tick, 800);
    return () => clearInterval(iv);
  }, [isViewer, isClient, hostId]);
  const canBroadcast = !!hostId && !isViewer && !isClient && isBroadcaster;
  // ── SCORRIMENTO E DITO NON PASSANO DALL'ELEZIONE ──────────────────────────
  //  L'elezione di UN solo trasmettitore serve per lo STATO (quale schermata,
  //  quali opzioni): due contesti che raccontano stati diversi facevano
  //  lampeggiare la pagina del cliente. Ma scorrimento e puntatore descrivono un
  //  gesto FISICO avvenuto QUI: solo un contesto per volta viene scorso, quindi
  //  non c'è alcun conflitto da arbitrare.
  //  Gating anche di questi sull'elezione significava che, se a vincere era il
  //  contesto gemello (l'iframe dell'anteprima), lo scorrimento non partiva
  //  affatto — ed è il motivo per cui non arrivava più al cliente in tempo reale.
  //  In VIDEOCHIAMATA la pagina del presentatore non si trasmette: il cliente
  //  guarda le camere, non deve vedere scorrere quello che il consulente sta
  //  facendo dietro. Appena si torna su "Contenuti" riparte tutto.
  const callSt = useCall();
  const inVideocall = callSt.active && callSt.mode === "call";
  const canSendLive = !!hostId && !isViewer && !isClient && !inVideocall;
  // letto dai gestori del canale (creato una volta): una variabile catturata
  // resterebbe ferma al valore del momento in cui il canale è stato aperto
  const bcastRef = useRef(false);
  bcastRef.current = canBroadcast;

  // ─── USCITA CONSOLIDATA (anti rate-limit Supabase ~10 msg/s) ───
  // Puntatore (~14/s) + scroll pagina (~11/s) + scroll pannelli (~6/s) su tre
  // eventi separati superavano abbondantemente il tetto del canale: i messaggi
  // venivano accodati/scartati e lo `state` arrivava in ritardo → LAG e stati
  // vecchi applicati fuori ordine. Ora tutto ciò che è "continuo" viaggia in UN
  // solo evento `live`, al massimo ~8 volte al secondo.
  // `sa` = ancora di contenuto della PAGINA, `panelAnchors` = ancore dei pannelli
  // interni. `scroll`/`panels` restano come FALLBACK a frazione (vedi scrollsync.ts).
  type OutPatch = {
    ptr?: { x: number; y: number; on: boolean };
    scroll?: number;
    sa?: ScrollAnchor | null;
    panels?: Record<string, number>;
    panelAnchors?: Record<string, ScrollAnchor>;
    sts?: number; // orologio DELLO SCROLL (vedi scrollClock)
  };
  // ─── OROLOGIO DELLO SCROLL (la causa vera del "torna indietro dopo 1s") ───
  // Lo scroll viaggiava su DUE binari che si combattevano: l'evento `live`
  // (posizione precisa, ~8/s) e lo SNAPSHOT di stato, che porta con sé una copia
  // di `scroll`/`sa`/`panels` scattata in un altro momento. Lo snapshot arriva
  // dal battito ogni 4s, dalla risposta `hello` (fino a 4s vecchia) e soprattutto
  // dal polling ~1s di /api/presenter/quotestate, scritto all'ULTIMO cambio di
  // stato: contiene quindi una posizione ARBITRARIAMENTE VECCHIA. Poche centinaia
  // di ms dopo ogni scroll preciso l'ospite veniva riportato lì.
  // Rimedio: ogni posizione porta il proprio timestamp `sts` e l'ospite APPLICA
  // SOLO ciò che è più recente dell'ultima posizione già applicata. Un binario
  // solo, in ordine, sempre — e l'ancora resta l'unica verità.
  const scrollClock = () => Date.now();
  const outRef = useRef<OutPatch>({});
  const flushRef = useRef<number | null>(null);
  const flushOut = () => {
    flushRef.current = null;
    const p = outRef.current;
    outRef.current = {};
    if (!chanRef.current) {
      //  Senza canale il messaggio non parte, e prima spariva in silenzio:
      //  è la differenza fra «il dito non si vede» e «il dito non è partito».
      if (p.ptr) console.warn("[DITO] nessun canale aperto: il dito non parte");
      return;
    }
    if (
      p.ptr === undefined &&
      p.scroll === undefined &&
      p.panels === undefined &&
      p.sa === undefined &&
      p.panelAnchors === undefined
    )
      return;
    chanRef.current.send({ type: "broadcast", event: "live", payload: p });
  };
  const queueOut = (patch: OutPatch) => {
    const cur = outRef.current;
    outRef.current = {
      ptr: patch.ptr ?? cur.ptr,
      scroll: patch.scroll ?? cur.scroll,
      sa: patch.sa !== undefined ? patch.sa : cur.sa,
      panels: patch.panels ? { ...cur.panels, ...patch.panels } : cur.panels,
      panelAnchors: patch.panelAnchors
        ? { ...cur.panelAnchors, ...patch.panelAnchors }
        : cur.panelAnchors,
      sts: patch.sts ?? cur.sts,
    };
    if (flushRef.current == null) flushRef.current = window.setTimeout(flushOut, 120);
  };
  useEffect(
    () => () => {
      if (flushRef.current != null) clearTimeout(flushRef.current);
    },
    [],
  );
  // ─── PUNTATORE (dito) — identico a quello delle slide ───
  // Il presentatore lo attiva e muove il mouse: sul dispositivo dell'ospite compare
  // un dito stilizzato con alone pulsante brand. Le coordinate sono FRAZIONI del
  // viewport (0..1) e lo scroll è già sincronizzato → indica sempre lo stesso punto.
  const [pointerOn, setPointerOn] = useState(() => readPointerPref()); // attivo di default (preferenza persistita)
  const [ptr, setPtr] = useState<{ x: number; y: number; on: boolean }>({
    x: 0.5,
    y: 0.5,
    on: false,
  });
  const ptrTs = useRef(0);
  const sendPtr = (x: number, y: number, on: boolean) => {
    queueOut({ ptr: { x, y, on } });
  };
  const togglePointer = () =>
    setPointerOn((v) => {
      const nv = !v;
      writePointerPref(nv);
      if (!nv) {
        setPtr((p) => ({ ...p, on: false }));
        sendPtr(0.5, 0.5, false);
      }
      return nv;
    });
  // host: cattura il movimento su TUTTA la pagina (il preventivo scorre con la finestra)
  useEffect(() => {
    if (!((canSendLive && pointerOn) || mandaIlDito)) return;
    // Sopra i comandi del PRESENTATORE (barra, impostazioni, popup: [data-hg-noptr])
    // il dito sparisce. Il contenuto del preventivo (card opzione, pulsanti, campi)
    // NON è un comando: prima lo era e il dito lampeggiava di continuo.
    // Isteresi: spegnimento solo dopo ~150ms continuativi sui comandi.
    const gate = makePointerHysteresis(() => {
      setPtr((p) => ({ ...p, on: false }));
      sendPtr(0.5, 0.5, false);
    });
    //  Il consulente vede anche il PROPRIO dito (è l'anteprima di quello che
    //  arriva dall'altra parte). Il cliente no: sul suo schermo un pallino che
    //  insegue il suo stesso mouse non gli dice niente, e il suo dito serve a
    //  chi lo guarda. Lo manda, non se lo disegna.
    const mostroAncheIlMio = canSendLive && pointerOn;
    //  Una riga sola, all'accensione: quando il dito non arriva dall'altra
    //  parte, la prima domanda è sempre «ma lo stai mandando?».
    console.log(`[DITO] invio acceso — mio=${mostroAncheIlMio} versoChiMiGuarda=${mandaIlDito} stanza=${chanCode}`);
    const onMove = (e: PointerEvent) => {
      if (gate.over(e.target)) return;
      const x = e.clientX / Math.max(1, window.innerWidth);
      const y = e.clientY / Math.max(1, window.innerHeight);
      if (mostroAncheIlMio) setPtr({ x, y, on: true });
      const now = performance.now();
      if (now - ptrTs.current > 100) {
        ptrTs.current = now;
        sendPtr(x, y, true);
      } // accodato, flush ~8/s
    };
    const onLeave = () => {
      gate.forceHide();
      setPtr((p) => ({ ...p, on: false }));
      sendPtr(0.5, 0.5, false);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      onLeave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSendLive, pointerOn, mandaIlDito]);
  /*  Il dito DELL'ALTRO. Sta in uno stato separato dal proprio, se no i due
      si sovrascriverebbero a vicenda dieci volte al secondo e sullo schermo
      resterebbe un dito solo che salta fra due posizioni. */
  const [ptrLui, setPtrLui] = useState<PtrTarget>({ x: 0.5, y: 0.5, on: false });
  /*  Come si chiama chi sta indicando: per il consulente è la persona di cui
      ha aperto il preventivo, per il cliente è il consulente. Solo il nome di
      battesimo — l'etichetta sta attaccata a un dito che si muove. */
  const nomeDellAltro = guardoIlSuo
    ? (attesiDelGruppo.find((a) => a.gettone === apertoDaMe)?.nome || "Cliente").trim().split(" ")[0]
    : (callSt.presenterName || "Consulente").trim().split(" ")[0];
  //  Questa pagina un dito lo manda? Allora quello che riceve è dell'altro.
  //  In un ref perché lo legge il gestore del canale, che può essere rimasto
  //  agganciato a un giro precedente.
  const mandoIoIlDitoRef = useRef(false);
  mandoIoIlDitoRef.current = (canSendLive && pointerOn) || mandaIlDito;
  // dito renderizzato (host = anteprima locale, ospite = ciò che riceve)
  // Animato fotogramma per fotogramma da PointerDot: le posizioni arrivano
  // ~10 volte al secondo, il dito si muove a 60. Visibile anche al presentatore.
  const pointerOverlay = (
    <>
      <PointerDot target={ptr} fixed className="print:hidden" />
      {/*  Verde e con il nome attaccato: con due dita che si muovono, sapere
          quale è il suo è tutto il punto della cosa. */}
      <PointerDot
        target={ptrLui}
        fixed
        className="print:hidden"
        tinta={{ ping: "bg-emerald-400/40", alone: "bg-emerald-400/50", punto: "bg-emerald-400" }}
        etichetta={nomeDellAltro}
      />
    </>
  );
  // pulsante di attivazione (solo presentatore in diretta) — stessa resa delle slide
  const pointerToggle =
    !isViewer && !isClient && hostId ? (
      <button
        onClick={togglePointer}
        title="Puntatore per indicare al cliente"
        className={`fixed bottom-24 right-4 z-[86] flex h-11 w-11 items-center justify-center rounded-full border shadow-lg print:hidden lg:bottom-20 ${pointerOn ? "border-brand bg-brand text-white" : "border-white/15 bg-[#0b1730]/90 text-white/80 hover:bg-white/10"}`}
      >
        <Pointer className="h-4 w-4" />
      </button>
    ) : null;

  /*  ── LA FACCIA DEL CONSULENTE, SUL LINK «SOLO PREVENTIVO» ────────────────
      Richiesta: «fai che posso attivare e disattivare anche la mia camera
      anche su questi link». Compare solo quando il consulente accende, e solo
      a chi è arrivato con il link: al cliente non viene chiesto niente — né
      camera, né microfono, né di entrare in una stanza (shop/camera-link).
      ⚠️ NON per l'ospite di una videochiamata vera: lì la faccia c'è già,
       dentro la chiamata, e questa ne metterebbe una seconda accanto. */
  const cameraDelLink =
    isClient && clientSess && !isViewer ? <CameraDelConsulente sess={clientSess} /> : null;

  // ─── SCROLL SINCRONIZZATO DEI PANNELLI INTERNI ───
  // Ogni contenitore scrollabile "mirrorabile" ha un attributo data-hg-scroll="<id>".
  // Il presentatore trasmette la posizione NORMALIZZATA (0..1, ~6 invii/s) e
  // l'ospite la applica allo stesso identico contenitore.
  //
  // ⚠️ ORA È ANCORATO AL CONTENUTO: il presentatore manda `{a,f}` (ancora +
  // avanzamento dentro l'ancora) e l'ospite la risolve nel proprio DOM con la
  // PROPRIA geometria → stesso blocco in cima anche con schermi diversi.
  // La frazione 0..1 resta solo come fallback se l'ancora non esiste.
  const panelScrollRef = useRef<Record<string, number>>({});
  const panelAnchorRef = useRef<Record<string, ScrollAnchor>>({});
  // ultima posizione di scroll ACCETTATA dall'ospite (vedi scrollClock):
  // qualunque payload con `sts` più vecchio viene ignorato → niente scatti
  // all'indietro provocati dallo snapshot o dal polling del server.
  const lastScrollTsRef = useRef(0);
  // ── PRIMO CARICAMENTO: SI PARTE SEMPRE DALL'ALTO ────────────────────────
  //  CAUSA DEL "pagina già scrollata del ~10% appena aperta": il primissimo
  //  payload che l'ospite riceve è lo SNAPSHOT DEL SERVER (/api/presenter/
  //  quotestate), scritto all'ULTIMO cambio di stato del presentatore. Porta
  //  con sé `sa`/`scroll` fotografati in quel momento — cioè una posizione
  //  arbitrariamente vecchia. Con `lastScrollTsRef` a 0 veniva accettata e
  //  l'ospite saltava lì ancora prima che il presentatore avesse scrollato.
  //  Ora: finché non è arrivata una posizione FRESCA (evento `live`, oppure un
  //  battito/`state` più recente di STALE_SCROLL_MS) l'ospite resta in cima.
  //  Se il presentatore è davvero scrollato, il battito ogni 4s (che ricalcola
  //  l'ancora al momento dell'invio) lo porta lì entro pochi secondi.
  const STALE_SCROLL_MS = 6000;
  const gotFreshScrollRef = useRef(false);
  /** true se questa posizione è più nuova dell'ultima applicata */
  const acceptScroll = (sts: unknown, live = false): boolean => {
    const t = Number(sts) || 0;
    if (!gotFreshScrollRef.current) {
      // prima posizione mai applicata: si accetta solo se è DAVVERO recente
      const fresh = live || (!!t && Date.now() - t < STALE_SCROLL_MS);
      if (!fresh) {
        console.log(
          `[SCROLL] prima posizione IGNORATA (stantia: sts=${t || 0}) — l'ospite parte dall'alto`,
        );
        if (t > lastScrollTsRef.current) lastScrollTsRef.current = t;
        return false;
      }
      gotFreshScrollRef.current = true;
    }
    if (!t) return true; // sorgente senza orologio (compatibilità)
    if (t < lastScrollTsRef.current) return false;
    lastScrollTsRef.current = t;
    return true;
  };
  const panelAnchorOk = useRef<Record<string, boolean>>({});
  const applyPanelScroll = (k: string, s: number) => {
    const el =
      typeof document !== "undefined"
        ? (document.querySelector(`[data-hg-scroll="${k}"]`) as HTMLElement | null)
        : null;
    if (!el) return false;
    const a = panelAnchorRef.current[k];
    if (a) {
      const target = applyAnchor(el, a);
      if (target != null) {
        panelAnchorOk.current[k] = true;
        return true;
      }
    }
    if (panelAnchorOk.current[k]) return true; // stessa regola dei pannelli
    return applyRatio(el, s);
  };
  // Il pannello può non esistere ancora (popup appena aperto dallo snapshot):
  // riproviamo per ~1s invece di perdere la posizione.
  const applyPanelScrollSoon = (k: string, s: number, tries = 30) => {
    if (applyPanelScroll(k, s)) return;
    if (tries <= 0) {
      console.log("[SCROLL] pannello assente", k);
      return;
    }
    requestAnimationFrame(() => applyPanelScrollSoon(k, s, tries - 1));
  };
  const applyAllPanelScroll = () => {
    const keys = new Set([
      ...Object.keys(panelScrollRef.current),
      ...Object.keys(panelAnchorRef.current),
    ]);
    keys.forEach((k) => applyPanelScrollSoon(k, panelScrollRef.current[k] ?? 0));
  };
  // scroll della PAGINA (ancora + fallback frazione)
  const pageScrollRef = useRef(0);
  const pageAnchorRef = useRef<ScrollAnchor | null>(null);
  // ── PERCHÉ L'OSPITE FACEVA "SOPRA E SOTTO" ────────────────────────────────
  //  Esistono due modi di posizionare l'ospite: per ANCORA (preciso: stesso
  //  blocco, stesso punto) e a PERCENTUALE (approssimativo: la stessa frazione
  //  di pagina). Il secondo era il ripiego per quando l'ancora non si trova.
  //  Il guaio: l'ancora può risultare momentaneamente non misurabile — succede
  //  durante un ridisegno della pagina, e la pagina si ridisegna di continuo.
  //  In quegli istanti scattava il ripiego a percentuale che, su un telefono
  //  dove la pagina è molto più alta, indica un punto DIVERSO. Risultato: un
  //  colpo alla posizione giusta, uno a quella approssimativa, avanti e
  //  indietro. Ora, dopo il primo posizionamento riuscito per ancora, il
  //  ripiego non viene più usato: se l'ancora manca per un istante, l'ospite
  //  semplicemente RESTA DOV'È e riparte al messaggio successivo.
  //  ⚠️ Il blocco permanente del ripiego (una volta riuscito per ancora, mai più
  //  la percentuale) è stato RIMOSSO: bastava una singola ancora momentaneamente
  //  non misurabile per congelare l'ospite per sempre. Le slide non hanno alcun
  //  blocco simile — e funzionano.
  //
  // ── CASCATA DI SCROLLER (come nelle slide) ────────────────────────────────
  //  Non si dà per scontato che a scorrere sia la finestra: sul telefono può
  //  essere il corpo della pagina o un contenitore interno. Si prova in ordine
  //  finché qualcosa si muove davvero. Era questa la difesa che mancava.
  const pageScrollers = (): (HTMLElement | null)[] => {
    if (typeof document === "undefined") return [null];
    const de = (document.scrollingElement || document.documentElement) as HTMLElement;
    const canScroll = de && de.scrollHeight - window.innerHeight > 4;
    const body = document.body;
    const bodyScrolls = body && body.scrollHeight - body.clientHeight > 4;
    const marked = document.querySelector('[data-hg-scroll="quote"]') as HTMLElement | null;
    return [canScroll ? null : (undefined as never), marked, bodyScrolls ? body : null].filter(
      (x) => x !== undefined,
    ) as (HTMLElement | null)[];
  };
  /** true se la posizione è stata applicata a QUALCOSA che si muove davvero. */
  const applyPageScrollOnce = (): boolean => {
    const a = pageAnchorRef.current;
    for (const root of pageScrollers()) {
      if (root === null && !(document.documentElement.scrollHeight - window.innerHeight > 4))
        continue;
      if (root && !(root.scrollHeight - root.clientHeight > 4)) continue;
      if (a && applyAnchor(root, a) != null) return true;
      if (applyRatio(root, pageScrollRef.current)) return true;
    }
    return false;
  };
  //  RITENTATIVO: subito dopo l'ingresso, o dopo un cambio di schermata, la
  //  pagina del cliente può non essere ancora alta: in quell'istante qualunque
  //  comando di scorrimento cade nel vuoto. Prima veniva perso per sempre
  //  (niente più battito periodico che lo ripetesse). Ora la posizione resta in
  //  sospeso e viene riprovata finché la pagina non è pronta.
  const pendingScrollRef = useRef(0);
  const applyPageScroll = () => {
    if (applyPageScrollOnce()) {
      pendingScrollRef.current = 0;
      return;
    }
    if (pendingScrollRef.current) return; // un solo ritentativo in corso
    const started = Date.now();
    const retry = () => {
      if (!pendingScrollRef.current) return;
      if (applyPageScrollOnce() || Date.now() - started > 8000) {
        pendingScrollRef.current = 0;
        return;
      }
      pendingScrollRef.current = window.setTimeout(retry, 200);
    };
    pendingScrollRef.current = window.setTimeout(retry, 120);
    console.log("[SCROLL] pagina non ancora scorrevole: posizione tenuta in sospeso e riprovata");
  };
  // ─── UNICO PUNTO D'INGRESSO DELLO SCROLL SULL'OSPITE ───
  // Sia l'evento `live` sia lo snapshot passano di qui. Chi arriva con un
  // orologio arretrato viene scartato: l'ancora più recente è l'unica verità e
  // nulla può più riportare indietro l'ospite un secondo dopo.
  const applyScrollPayload = (
    p: {
      scroll?: unknown;
      sa?: unknown;
      panels?: unknown;
      panelAnchors?: unknown;
      sts?: unknown;
    },
    live = false,
  ) => {
    try {
      applyScrollPayloadInner(p, live);
    } catch (e) {
      const err = e as Error;
      console.warn("[SCROLL] applicazione fallita:", err);
      // il messaggio vero arriva al presentatore: "Script error." non dice nulla
      void import("@/shop/call")
        .then((m) => m.reportGuestError?.(`Scroll: ${err?.message || String(e)}`, err?.stack || ""))
        .catch(() => {});
    }
  };
  const applyScrollPayloadInner = (
    p: {
      scroll?: unknown;
      sa?: unknown;
      panels?: unknown;
      panelAnchors?: unknown;
      sts?: unknown;
    },
    live = false,
  ) => {
    const hasPage = typeof p.scroll === "number" || !!p.sa;
    const hasPanels = !!p.panels || !!p.panelAnchors;
    if (!hasPage && !hasPanels) return;
    if (!acceptScroll(p.sts, live)) {
      console.log(
        `[SCROLL] posizione arretrata ignorata (sts=${Number(p.sts) || 0} < ${lastScrollTsRef.current})`,
      );
      return;
    }
    if (p.sa) pageAnchorRef.current = p.sa as ScrollAnchor;
    if (typeof p.scroll === "number") pageScrollRef.current = p.scroll;
    if (hasPage) {
      appliedAt.current = Date.now();
      applyPageScroll();
    }
    const pa = (p.panelAnchors as Record<string, ScrollAnchor> | undefined) ?? null;
    const ps = (p.panels as Record<string, number> | undefined) ?? null;
    if (pa) panelAnchorRef.current = { ...panelAnchorRef.current, ...pa };
    if (ps) panelScrollRef.current = { ...panelScrollRef.current, ...ps };
    if (hasPanels) {
      const keys = new Set([...Object.keys(ps ?? {}), ...Object.keys(pa ?? {})]);
      keys.forEach((k) => applyPanelScrollSoon(k, Number(panelScrollRef.current[k]) || 0));
    }
  };
  // l'ospite riapplica la posizione appena il pannello compare
  useEffect(() => {
    if (!isMirror) return;
    requestAnimationFrame(applyAllPanelScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMirror, percorsoOpen]);

  // SNAPSHOT UNICO E AUTOREVOLE: contiene TUTTO ciò che l'ospite deve rispecchiare
  // (vista configuratore↔riepilogo tramite `result`, selezioni, popup aperti/chiusi,
  // scroll pagina e scroll dei pannelli). `rev` cresce sempre: l'ospite scarta
  // qualunque payload più vecchio dell'ultimo applicato → niente sorpassi.
  //
  // ⚠️ Lo snapshot si costruisce SEMPRE dai valori CORRENTI (ref aggiornato a ogni
  // render), mai da una closure: il battito ogni 4s ricostruiva uno stato vecchio
  // con un `rev` più alto e l'ospite chiudeva il popup "Il tuo percorso" (1s aperto
  // / 1s chiuso). Inoltre `rev` cresce SOLO se il contenuto cambia davvero → due
  // battiti consecutivi senza azioni sono identici e l'ospite li ignora.
  const liveRef = useRef({
    baseId,
    selected,
    simOn,
    installOn,
    fitting,
    qty,
    profile,
    manual,
    result,
    percorsoOpen,
    lookup,
    condizioni,
    causaleSuMisura,
  });
  liveRef.current = {
    baseId,
    selected,
    simOn,
    installOn,
    fitting,
    qty,
    profile,
    manual,
    result,
    percorsoOpen,
    lookup,
    condizioni,
    causaleSuMisura,
  };

  // Stato dei popup: contatore separato che avanza SOLO quando il presentatore
  // apre/chiude davvero. L'ospite tocca i popup solo quando questo cambia →
  // nessun altro messaggio (battito, scroll, riallineamento) può chiuderli.
  // `ts`: avanza SOLO quando il contenuto cambia davvero (non a ogni battito).
  // È l'orologio dello stato: il server lo usa per rifiutare le scritture vecchie
  // e l'ospite per rifiutare i payload vecchi. Un contesto stantio (che non cambia
  // più) resta con un `ts` congelato → non può più imporsi. Fine del lampeggio.
  const tsRef = useRef(0);
  const sigRef = useRef("");
  const buildSnapshot = () => {
    const c = liveRef.current;
    const body = {
      v: 2,
      baseId: c.baseId,
      selected: [...c.selected],
      simOn: c.simOn,
      installOn: c.installOn,
      fitting: c.fitting,
      qty: c.qty,
      profile: c.profile,
      manual: c.manual,
      result: c.result,
      percorsoOpen: c.percorsoOpen,
      lookup: c.lookup,
      //  ⚠️ ANCHE LE CONDIZIONI: il cliente disegna il documento con la
      //   stessa fotografia del consulente. Senza, i due leggerebbero due
      //   assistenze diverse sullo stesso preventivo appena uno dei due
      //   listini cambia — ed è la cosa che questa pagina non può permettersi.
      condizioni: c.condizioni,
      //  E la causale scritta a mano per questo preventivo: è la riga che il
      //  cliente COPIA, e due copie diverse sono un bonifico che non si lega.
      causale: c.causaleSuMisura,
    };
    // La FIRMA descrive solo lo STATO (viste, selezioni, popup): lo scroll NON
    // ne fa parte. Prima ci finiva dentro e ogni singolo pixel scrollato faceva
    // "cambiare stato" → l'ospite ri-eseguiva l'intera cascata di setState (nuovo
    // Set, nuovo oggetto `result`) ~ogni battito, con relativo re-layout, e poi
    // riapplicava una posizione scattata altrove. Ora battito e polling che non
    // portano novità di stato sono a costo zero per l'ospite.
    const sig = JSON.stringify(body);
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      tsRef.current = Math.max(Date.now(), tsRef.current + 1);
    }
    // Lo scroll viaggia ACCANTO allo stato, con il PROPRIO orologio: chi lo
    // riceve sa quanto è fresco e può scartarlo se è arretrato.
    const scroll = {
      panels: { ...panelScrollRef.current },
      panelAnchors: { ...panelAnchorRef.current },
      scroll:
        typeof window !== "undefined"
          ? window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
          : 0,
      sa: typeof window !== "undefined" ? readAnchor(null) : null,
      sts: scrollClock(),
    };
    return { ...body, ...scroll, sig, ts: tsRef.current };
  };

  const lastTsRef = useRef(0);
  const lastSigRef = useRef<string | null>(null);
  /*  Quando il canale in tempo reale ha parlato l'ultima volta. Serve al
      polling qui sotto per capire se c'è bisogno di lui. */
  const canaleVistoIl = useRef(0);
  const applySnapshot = (s: Record<string, unknown> | null | undefined) => {
    /*  ── ⚠️ NON SI SCRIVE SOPRA LE MANI DI CHI STA SCRIVENDO ─────────────
        Vale solo quando si compila in due. Chi sta digitando il proprio nome
        o il codice fiscale, se in quell'istante arriva la fotografia
        dell'altro, si vede il campo riscritto a metà parola — e non capisce
        perché. Qui si lascia perdere questo giro: lo stato resta sul server e
        il controllo periodico lo riapplica un secondo dopo, appena il campo
        non ha più il fuoco. Si perde un secondo, non una frase. */
    if (inDueRef.current && typeof document !== "undefined") {
      const dove = document.activeElement as HTMLElement | null;
      const staScrivendo =
        !!dove && (dove.tagName === "INPUT" || dove.tagName === "TEXTAREA" || dove.isContentEditable);
      if (staScrivendo) return;
    }
    // snapshot vuoto/non inizializzato: NON deve azzerare la vista dell'ospite
    // (era la causa del "a volte l'ospite resta sul configuratore").
    if (!s || !s.v) return;
    // ORDINE UNICO E GLOBALE: si applica solo ciò che è più NUOVO dell'ultimo
    // applicato, indipendentemente da chi l'ha mandato (canale realtime o
    // polling del valore autorevole sul server).
    const ts = Number(s.ts) || 0;
    if (ts && ts < lastTsRef.current) return; // payload sorpassato → ignorato
    /*  ── ⚠️ UN CLIC APPENA FATTO NON SI LASCIA CANCELLARE ────────────────
        Segnalazione del committente: «dentro Meetly clicco le opzioni e non
        risponde», senza nessuna fascia che blocchi la pagina. È una corsa, e
        si vede solo quando in due si scrive nella stessa stanza:
          · io clicco al secondo 10,0 e mando il mio stato;
          · il controllo periodico, partito al secondo 9,9, torna indietro al
            secondo 10,2 con la fotografia di PRIMA del clic;
          · quella fotografia è più recente dell'ultima che avevo applicato,
            quindi entra — e il mio clic sparisce sotto i miei occhi.
        La regola giusta non è «è più nuova dell'ultima applicata» ma «è più
        nuova dell'ultima MIA»: `tsRef` è l'orologio del mio ultimo
        cambiamento, e niente di più vecchio di quello può scavalcarlo.
        ⚠️ CON UN TETTO, perché i due orologi sono di due computer diversi: se
         quello dell'altro è indietro di più di quindici secondi non è una
         corsa, è un orologio sbagliato — e allora si accetta lo stesso, o
         quella persona non riuscirebbe più a cambiare niente. */
    if (inDueRef.current && ts && ts < tsRef.current && tsRef.current - ts < 15_000) return;
    // ── CAMBIO DI APPROCCIO: LO SNAPSHOT NON PORTA PIÙ LO SCROLL ────────────
    //  Lo snapshot descrive lo STATO (quale schermata, quali opzioni), e viene
    //  riletto dal server ogni secondo. Portava con sé anche la posizione di
    //  scorrimento fotografata all'ULTIMO cambio di stato: una posizione vecchia
    //  anche di minuti che, una volta al secondo, strappava l'ospite dal punto in
    //  cui la posizione LIVE lo aveva appena portato. Da qui sia lo scarto fisso
    //  sia la sensazione di "non in tempo reale".
    //  Ora la posizione viaggia su UN SOLO binario: l'evento realtime, che è
    //  l'unico a descrivere DOVE SI TROVA ADESSO il presentatore.
    //  (`applyScrollPayload(…, true)` nel gestore dell'evento `live`.)
    const sig = typeof s.sig === "string" ? s.sig : null;
    if (sig && sig === lastSigRef.current) {
      // contenuto identico a quello già mostrato: si aggiorna solo l'orologio
      // (niente riallineamenti di scroll che combatterebbero col mirror in corso)
      if (ts > lastTsRef.current) lastTsRef.current = ts;
      return;
    }
    if (ts) lastTsRef.current = ts;
    lastSigRef.current = sig;
    /*  ── ⚠️ QUELLO CHE HO APPENA RICEVUTO NON LO RIMANDO INDIETRO ────────
        Chi scrive in due è, allo stesso tempo, uno che riceve: applicare uno
        stato cambia lo stato di questa pagina, e la regola «lo stato è
        cambiato, mandalo» lo rispedirebbe al mittente con un orologio nuovo.
        Il mittente lo riapplicherebbe, e via così: due pagine che si
        rimbalzano la stessa fotografia più volte al secondo, per sempre.
        Si segna qui che questa fotografia è già nostra — stessa firma, stesso
        orologio, già «mandata» — e la prossima costruzione non trova niente
        di nuovo da dire. */
    if (inDueRef.current && ts) {
      if (typeof s.sig === "string") sigRef.current = s.sig;
      tsRef.current = ts;
      pushedTsRef.current = ts;
    }
    console.log(
      `[QUOTE] stato applicato ts=${ts} result=${!!s.result} percorsoOpen=${!!s.percorsoOpen}`,
    );
    setRemoteLookup(!!s.lookup);
    // ── ANCHE CHI GUARDA SENTE LE SCELTE ──────────────────────────────────
    //  Il cliente sentiva i suoni solo toccando lui. Ma in consulenza a
    //  selezionare sei tu: senza un suono, dall'altra parte le voci si
    //  accendevano in silenzio e il passaggio non si notava. Ora ogni tua
    //  scelta suona anche da lui — con lo stesso timbro delle voci in
    //  promozione quando la voce è scontata o gratuita.
    //  Il PRIMO stato ricevuto non suona: è il caricamento della pagina, non
    //  una scelta, e sarebbe una raffica di note all'ingresso.
    //  ── QUI NON SI SUONA PIÙ ───────────────────────────────────────────────
    //   Questo è il lato che RICEVE lo stato di qualcun altro, e lo riceve anche
    //   dal controllo periodico: bastava una differenza qualsiasi — o l'anteprima
    //   dispositivo aperta accanto — perché partissero note senza che nessuno
    //   avesse toccato niente. Il suono di una scelta lo fa ora il dispositivo di
    //   chi la compie, e viaggia agli altri per conto suo (vedi il ponte dei
    //   suoni nella videochiamata): una scelta, un suono, ovunque.
    const nuoveSel = new Set((s.selected as string[]) ?? []);
    primoStatoRef.current = true;
    /*  ⚠️ PRIMA LE CONDIZIONI, POI IL RESTO: da loro dipende il listino con
        cui si disegna tutto quello che arriva dopo. `undefined` (uno stato
        mandato da una versione vecchia della pagina) non cancella niente;
        `null` sì, ed è il presentatore che ha premuto «modifica preventivo». */
    if (s.condizioni !== undefined)
      setCondizioni(
        s.condizioni ? leggiCondizioni(JSON.stringify(s.condizioni)) : null,
      );
    if (typeof s.causale === "string") setCausaleSuMisura(s.causale);
    setBaseId(String(s.baseId ?? BASE_SOLUTIONS[0].id));
    //  Queste sono le scelte di chi presenta: valgono più della preselezione
    //  del listino, altrimenti l'ospite se le vedrebbe cambiare sotto gli occhi
    //  appena il suo listino finisce di caricare.
    sceltoAMano.current = true;
    setSelected(nuoveSel);
    setSimOn(!!s.simOn);
    setInstallOn(s.installOn !== false);
    setFitting((s.fitting as "remoto" | "sede") ?? "remoto");
    setQty(Number(s.qty) || 1);
    /*  ── ⚠️ UN PROFILO ASSENTE NON È UN PROFILO VUOTO ────────────────
        Segnalazione del committente: «non precompila il preventivo con i dati
        del cliente». Qui c'era `?? {...EMPTY}`: una fotografia che non porta
        il profilo — e sono tante: le manda anche chi ha una versione vecchia,
        o chi non ha ancora toccato i dati — CANCELLAVA i dati appena presi
        dalla scheda del CRM. Una al secondo, quindi la precompilazione
        spariva sempre.
        Assente vuol dire «non ne so niente»: si tiene quello che c'è. Per
        svuotarli davvero si manda un profilo vuoto, che è un oggetto e non
        un buco (lo fa «Nuovo preventivo»). */
    if (s.profile) setProfile(s.profile as Profile);
    setManual((s.manual as Discount) ?? null);
    // ⚠️ ORDINE: `result` e `percorsoOpen` arrivano dallo STESSO snapshot e sono
    // impostati nello stesso batch di render. La vista "Il tuo percorso" è
    // renderizzata solo dentro `if (result)`: senza `result` nello stesso stato
    // l'ospite non vedrebbe nulla. Se lo snapshot dice percorsoOpen ma NON ha
    // result, l'apertura viene rimandata (non si perde: arriverà col prossimo
    // snapshot/poll che contiene entrambi).
    //  ── QUELLO CHE ARRIVA DALLA RETE NON È DETTO CHE ABBIA QUESTA FORMA ───
    //   Qui il preventivo arriva dal dispositivo del consulente come JSON e
    //   veniva solo DICHIARATO Snapshot: nessuno controllava niente. Basta uno
    //   snapshot vecchio, o troncato, senza `items` o senza `discounts` e la
    //   pagina del cliente muore su `.reduce` di undefined — schermo bianco,
    //   in diretta, mentre sta decidendo se spendere qualche migliaio di euro.
    //   Gli elenchi si normalizzano qui, all'ingresso, una volta sola: se
    //   mancano si mostra un preventivo senza voci, non una pagina rotta.
    const grezzo = (s.result ?? null) as Snapshot | null;
    const nextResult: Snapshot | null = grezzo
      ? {
          ...grezzo,
          items: Array.isArray(grezzo.items) ? grezzo.items : [],
          discounts: Array.isArray(grezzo.discounts) ? grezzo.discounts : [],
        }
      : null;
    setResult(nextResult);
    // la vista del percorso è consultabile ANCHE prima di creare il preventivo
    // (dalla sezione 02): non va più legata all'esistenza del risultato
    setPercorsoOpen(!!s.percorsoOpen);
    // il cambio di vista rifà il layout: si riallinea sull'ULTIMA ancora nota
    // (non su quella dello snapshot, che potrebbe essere più vecchia).
    requestAnimationFrame(() => {
      /*  ── ⚠️ CHI SCRIVE NON SI FA SPOSTARE LA PAGINA ──────────────────
          Segnalazione del committente: «il preventivo mentre lo compilo
          continuamente torna sopra, e devo riscorrere verso il punto».
          Lo scorrimento viaggia insieme allo stato, ed è giusto quando uno
          presenta e l'altro guarda. Ma da quando si compila IN DUE nella
          stessa stanza quello stato arriva anche a chi sta scrivendo, e ogni
          fotografia — una al secondo — gli riportava la pagina dove stava
          l'altro. Per di più la protezione che esisteva («se ha scorso di suo
          non lo riporto indietro») vive dentro un effetto che gira solo per
          chi guarda: a chi scrive non si applicava nemmeno quella.
          La regola sta in `loScorrimentoMiRiguarda`, dov'è provata. */
      if (loScorrimentoMiRiguarda({ guardo: mirrorsStateRef.current, scrivo: inDueRef.current })
          && userScrollAt.current <= appliedAt.current) {
        appliedAt.current = Date.now();
        applyPageScroll();
      }
      //  Gli scorrimenti DENTRO i pannelli restano: sono piccoli, non spostano
      //  la pagina sotto le dita, e servono a vedere la stessa riga.
      applyAllPanelScroll();
    });
  };

  // ── IL CLIENTE PUÒ SCORRERE QUANTO VUOLE ──────────────────────────────────
  //  Finché il presentatore sta fermo, la pagina è sua: nessun riallineamento,
  //  nessuna animazione che gli tira via il dito. Appena il presentatore scorre
  //  davvero, la posizione nuova vince e lo riporta dove sta guardando lui.
  //  Il riconoscimento è per tempo: uno scorrimento avvenuto DOPO l'ultima
  //  posizione applicata è per forza suo, non nostro.
  const userScrollAt = useRef(0);
  const appliedAt = useRef(0);
  useEffect(() => {
    if (!isMirror) return;
    const onScroll = () => {
      // se lo scorrimento arriva entro 400ms da una nostra applicazione è
      // l'animazione, non il dito del cliente
      if (Date.now() - appliedAt.current < 400) return;
      userScrollAt.current = Date.now();
      stopGlide(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMirror]);

  // OSPITE — PRIMO CARICAMENTO: si parte SEMPRE dall'alto. Il browser può
  // ripristinare da solo la posizione di scroll (bfcache / SPA nav) e questo,
  // sommato allo snapshot stantio del server, produceva la pagina "già scrollata".
  useEffect(() => {
    if (!isMirror || typeof window === "undefined") return;
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      /* */
    }
    window.scrollTo(0, 0);
    const t = window.setTimeout(() => {
      if (!gotFreshScrollRef.current) window.scrollTo(0, 0);
    }, 120);
    return () => clearTimeout(t);
  }, [isMirror]);

  /*  ── ⚠️ UN CANALE SOLO PER STANZA, E I SUOI ASCOLTATORI QUI ───────────
      Trovato provando, e non si vedeva ragionando: questa pagina apriva DUE
      canali con lo stesso nome — uno per mandare (il consulente) e uno per
      ricevere (chi guarda). Finché il consulente non riceveva mai, il
      doppione non dava fastidio; da quando guarda il preventivo di una
      persona li apriva tutti e due sulla stessa stanza, e il secondo non
      consegnava più niente: il dito del cliente arrivava al server — l'ho
      visto con un collegamento a mano — e sullo schermo del consulente non
      compariva.
      Ora gli ascoltatori stanno qui, in due funzioni sole, e li aggancia il
      canale che c'è: quello di trasmissione se la pagina ne ha uno, quello di
      ascolto altrimenti. */
  const suStato = (payload: unknown) => {
    if (applicaDaRemoto) {
      //  Il canale funziona: da qui il polling può rallentare (vedi sotto).
      canaleVistoIl.current = Date.now();
      applySnapshot(payload as Record<string, unknown>);
    } else if (followsQuote) seguiPreventivo(payload as Record<string, unknown>);
    guestContentSeen();
  };
  const suLive = (payload: unknown) => {
    try {
      const p = payload as OutPatch;
      if (p.ptr) {
        const dito = { x: Number(p.ptr.x) || 0, y: Number(p.ptr.y) || 0, on: !!p.ptr.on };
        //  Se anche questa pagina manda un dito, quello che arriva è
        //  dell'altro e va nel suo posto; se no è il caso di sempre (uno
        //  indica, l'altro guarda) e resta dov'è sempre stato.
        if (mandoIoIlDitoRef.current) setPtrLui(dito);
        else setPtr(dito);
      }
      applyScrollPayload(p, true); // evento in tempo reale = posizione ATTUALE
    } catch (e) {
      console.warn("[LIVE] messaggio ignorato:", e);
    }
  };
  //  In un ref: gli ascoltatori si agganciano una volta sola, alla nascita
  //  del canale, e senza questo resterebbero legati ai valori di quel giro.
  const ascoltiRef = useRef({ suStato, suLive });
  ascoltiRef.current = { suStato, suLive };

  // Spettatore: si iscrive e riceve gli aggiornamenti
  useEffect(() => {
    //  ⚠️ `applicaDaRemoto`, non `isMirror`: chi scrive in due NON è uno
    //   specchio, ma deve ascoltare lo stesso — altrimenti vedrebbe le mosse
    //   dell'altro solo al giro del controllo periodico, un secondo dopo.
    /*  ⚠️ …o quando c'è solo da MANDARE il dito: il cliente che compila da
        solo il proprio preventivo non riceve niente (la penna è sua), ma
        deve poter far vedere dove sta indicando. Senza questa riga non
        avrebbe nessun canale da cui parlare. */
    /*  ⚠️ CHI HA IL PROPRIO PREVENTIVO RESTA COLLEGATO, SEMPRE. Prima il
        canale dipendeva da «mi stanno guardando adesso»: appena il
        consulente chiudeva la scheda della persona, quella perdeva il canale
        — e con esso anche il dito del consulente, che è la cosa che c'è da
        sempre. Un'iscrizione in più costa niente; un filo che si stacca da
        solo mentre parli costa una consulenza. */
    const nellaSuaStanza = isViewer && vedoDelGruppo === "mio";
    if ((!applicaDaRemoto && !mandaIlDito && !nellaSuaStanza) || !chanCode) {
      if (chanCode) console.log(`[DITO] nessun canale qui: applico=${applicaDaRemoto} mando=${mandaIlDito}`);
      return;
    }
    /*  ⚠️ …e non se ne apre un SECONDO sulla stessa stanza: il canale di
        trasmissione (qui sotto) porta già gli stessi ascoltatori. Due canali
        con lo stesso nome sullo stesso collegamento non consegnano. */
    if (canSendLive) return;
    const ch = supabase.channel(`qlive-${chanCode}`, { config: { broadcast: { self: false } } });
    // PRIMA si applica lo stato del presentatore, POI si segnala "contenuti
    // applicati": invertendo l'ordine il velo di caricamento cadeva un istante
    // prima che il preventivo fosse popolato → l'ospite vedeva la pagina vuota.
    ch.on("broadcast", { event: "state" }, ({ payload }) => ascoltiRef.current.suStato(payload));
    // evento CONSOLIDATO: puntatore + scroll pagina + scroll pannelli in un solo
    // messaggio (max ~8/s) → si resta sotto il tetto del canale e niente ritardi.
    ch.on("broadcast", { event: "live" }, ({ payload }) => ascoltiRef.current.suLive(payload));
    // Saluto RIPETUTO, esattamente come sulle slide: se il presentatore si
    // iscrive DOPO l'ospite, il primo saluto andrebbe perso e l'ospite
    // resterebbe fermo in cima per tutta la consulenza.
    const helloTimers: number[] = [];
    //  ⚠️ Questo canale serve anche da bocca: il cliente non ne ha un altro
    //   (quello di trasmissione lo apre solo il consulente), e il suo dito
    //   passa di qui. Chi ha già il proprio non se lo fa togliere: i due
    //   effetti parlano sullo stesso argomento, quindi va bene l'uno o
    //   l'altro, e la pulizia azzera solo se il riferimento è ancora suo.
    if (!chanRef.current) chanRef.current = ch;
    ch.subscribe((status) => {
      console.log(`[DITO] ascolto ${chanCode}: ${status}`);
      if (status !== "SUBSCRIBED") return;
      // Il saluto porta le dimensioni REALI dello schermo: così l'anteprima del
      // presentatore si adatta al dispositivo del cliente anche con il solo
      // link del preventivo, esattamente come fa in videochiamata.
      const hello = () =>
        ch.send({
          type: "broadcast",
          event: "hello",
          payload: {
            vp: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
          },
        });
      hello();
      [400, 1200, 3000, 6000].forEach((ms) => helloTimers.push(window.setTimeout(hello, ms)));
    });
    return () => {
      helloTimers.forEach(clearTimeout);
      supabase.removeChannel(ch);
      if (chanRef.current === ch) chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMirror, mirrorsState, applicaDaRemoto, mandaIlDito, isViewer, vedoDelGruppo, canSendLive, followsQuote, seguiPreventivo, chanCode]);

  // Host: raccoglie le dimensioni dello schermo annunciate da chi guarda il
  // preventivo senza videochiamata (l'anteprima si adatta a lui).
  // Host: apre il canale quando avvia la diretta; risponde ai nuovi spettatori
  useEffect(() => {
    // un OSPITE non deve mai trasmettere: se apre il link di sorveglianza sullo
    // stesso dispositivo del presentatore (stessa sessione in localStorage)
    // ri-trasmetteva il proprio stato in ritardo sullo stesso canale → la vista
    // si apriva e chiudeva da sola.
    // ── PERCHÉ LO SCORRIMENTO NON PARTIVA (causa vera) ─────────────────────
    //  Qui la condizione era `canBroadcast`, cioè "ho vinto l'elezione". Ma
    //  questo effetto non decide solo CHI racconta lo stato: è quello che APRE
    //  IL CANALE. Il contesto che perdeva l'elezione restava quindi senza alcun
    //  canale — e con esso senza la possibilità di inviare QUALSIASI cosa.
    //  Avere tolto l'elezione da scorrimento e puntatore non serviva a nulla:
    //  i loro messaggi finivano comunque in un canale inesistente.
    //  Ora il canale lo apre OGNI contesto del presentatore; a passare
    //  dall'elezione è solo ciò che deve avere una voce sola: lo STATO.
    /*  ⚠️ IL CANALE SEGUE LA STANZA, NON LA CONSULENZA. Era
        `qlive-${hostId}`: mentre lavori nel preventivo di una persona, il tuo
        dito e il tuo scorrimento finivano nel canale della consulenza, dove
        lei non ascolta — ascolta quello della sua stanza. Nel caso di sempre
        i due codici coincidono, quindi qui non cambia niente. */
    if (!canSendLive || !chanCode) return;
    const ch = supabase.channel(`qlive-${chanCode}`, { config: { broadcast: { self: false } } });
    /*  ⚠️ ANCHE QUESTO CANALE ASCOLTA. Da quando il consulente può guardare
        il preventivo di una persona — e riceverne il dito — il canale non è
        più a senso unico. Gli ascoltatori sono gli stessi di chi guarda
        (`ascoltiRef`): duplicarli qui vorrebbe dire due comportamenti che
        divergono al primo ritocco. */
    ch.on("broadcast", { event: "state" }, ({ payload }) => ascoltiRef.current.suStato(payload));
    ch.on("broadcast", { event: "live" }, ({ payload }) => ascoltiRef.current.suLive(payload));
    // Lo snapshot va RICOSTRUITO ora: `snapRef.current` è quello dell'ultimo
    // cambio di stato e porterebbe una posizione di scroll vecchia (una delle
    // cause del "l'ospite apre la pagina già scrollata").
    ch.on("broadcast", { event: "hello" }, ({ payload }) => {
      // Dimensioni dello schermo di chi guarda: l'anteprima "come lo vede il
      // cliente" si adatta anche senza videochiamata.
      const vp = (payload as { vp?: { w?: number; h?: number; dpr?: number } } | undefined)?.vp;
      if (vp?.w && vp?.h) reportGuestViewport(Number(vp.w), Number(vp.h), Number(vp.dpr) || 1);
      // ── CHI ENTRA DOPO DEVE POTER CHIEDERE "DOVE SEI?" ──────────────────
      //  Tolto il battito periodico, la posizione viaggiava SOLO mentre il
      //  presentatore scorreva. Un cliente che entra a consulenza già scorsa —
      //  o che si collega da telefono e monta la pagina un istante dopo —
      //  non aveva alcun modo di sapere dove ti trovi: restava in cima, e per
      //  lui la pagina "non scorreva" affatto.
      //  Ora al saluto si risponde con la posizione ATTUALE, ricalcolata adesso.
      //  Risponde ogni contesto che può inviare posizioni (non passa
      //  dall'elezione, come già scorrimento e puntatore); lo STATO invece resta
      //  riservato al contesto eletto, che è ciò che evita il lampeggio.
      try {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        ch.send({
          type: "broadcast",
          event: "live",
          payload: {
            scroll: Math.max(0, Math.min(1, window.scrollY / max)),
            sa: readAnchor(null),
            panels: panelScrollRef.current,
            panelAnchors: panelAnchorRef.current,
            sts: scrollClock(),
          },
        });
      } catch {
        /* */
      }
      if (!bcastRef.current) return; // allo stato risponde solo il contesto eletto
      snapRef.current = buildSnapshot();
      ch.send({ type: "broadcast", event: "state", payload: snapRef.current });
    });
    //  Lo stato dell'iscrizione si scrive: quando il dito o lo stato non
    //  arrivano, la prima cosa da sapere è se il canale è davvero agganciato
    //  (SUBSCRIBED) o è rimasto per strada (CHANNEL_ERROR, TIMED_OUT).
    ch.subscribe((stato) => console.log(`[DITO] parlo+ascolto ${chanCode}: ${stato}`));
    chanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      //  ⚠️ Solo se è ancora il nostro: da quando anche chi guarda può avere
      //   un canale da cui mandare il dito, azzerare alla cieca toglierebbe
      //   il canale buono di un altro effetto.
      if (chanRef.current === ch) chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chanCode, canSendLive]);

  // Host: trasmette a ogni cambiamento di stato.
  // NB: lo snapshot si aggiorna ANCHE senza diretta attiva — prima era dentro il
  // `if (!hostId) return`, quindi chi entrava in diretta a preventivo già creato
  // riceveva uno snapshot vuoto e restava sul configuratore.
  // ─── STATO AUTOREVOLE SUL SERVER (giudice unico) ───
  // Il canale realtime resta per la reattività immediata, ma la VERITÀ è il valore
  // salvato su /api/presenter/quotestate: il server ne tiene UNO solo e rifiuta le
  // scritture con `ts` più vecchio. Così, anche se più contesti del presentatore
  // parlano insieme, quello stantio non può imporre il proprio stato e l'ospite
  // converge sempre entro ~1s. (Stesso meccanismo, affidabile, di curpage.)
  const pushTimerRef = useRef<number | null>(null);
  const pushedTsRef = useRef(0);
  /*  In quale stanza scrive QUESTA pagina. Vuota = quella della consulenza
      che sta conducendo (il caso di sempre: il consulente). Piena solo per il
      cliente che ha la penna sul proprio preventivo di gruppo.
      ⚠️ Un ref e non una variabile: `pushServerState` parte da un timer un
       quarto di secondo dopo, e leggerebbe il valore del giro in cui è stata
       creata. */
  const stanzaScrittaRef = useRef("");
  /*  ── ⚠️ PRIMA SI LEGGE LA STANZA, POI CI SI SCRIVE ─────────────────────
      Aprire il preventivo di una persona non deve MAI far comparire sul suo
      schermo quello che c'era sul mio. Il caso che fa danno è concreto: il
      consulente ha aperta la scheda di Bruno, prende la penna sul preventivo
      di Anna — che non ha ancora toccato niente, quindi la sua stanza è
      vuota e non c'è nessuno stato da rispecchiare — e la prima cosa che
      Anna vede è il modulo con dentro NOME, TELEFONO ed EMAIL di Bruno.
      Davanti a Bruno.
      Qui la stanza si legge una volta prima di poterci scrivere: se dentro
      c'è qualcosa la rispecchia il giro normale, se è vuota si azzerano i
      dati personali, e fino ad allora non parte nessuna scrittura. */
  const stanzaLettaRef = useRef("");
  const [stanzaPronta, setStanzaPronta] = useState("");
  useEffect(() => {
    const stanza = (pennaMia && chanCode) || "";
    if (!stanza || stanzaLettaRef.current === stanza) return;
    stanzaLettaRef.current = stanza;
    let vivo = true;
    void (async () => {
      let vuota = true;
      try {
        const r = await fetch(`/api/presenter/quotestate?sess=${encodeURIComponent(stanza)}`, { cache: "no-store" });
        const j = (await r.json()) as { state?: Record<string, unknown> | null };
        vuota = !j?.state;
      } catch {
        //  Se non si riesce a leggere si tratta come vuota: azzerare i dati
        //  personali è la scelta prudente, riscriverli costa dieci secondi.
      }
      if (!vivo) return;
      if (vuota) {
        /*  ── ⚠️ NON SI SVUOTA E BASTA: SI METTONO I DATI DI QUESTA PERSONA ──
            Segnalazione del committente: «non precompila il preventivo con i
            dati del cliente». Qui si svuotava, ed era giusto solo a metà: il
            motivo vero è non far comparire ad Anna i dati di Bruno, non
            lasciare il modulo in bianco. La persona di questa stanza la
            sappiamo — è il gettone che ho aperto — e la sua scheda ce l'ha il
            CRM: si riempie con la SUA, che è quello che serve davanti a lei.
            ⚠️ `forza`: la persona davanti è cambiata, non c'è niente da
             difendere di quello che c'era scritto prima. */
        const chi = attesiDelGruppo.find((a) => a.gettone === apertoDaMe);
        if (chi?.leadId) void rinfrescaLead(chi.leadId, true);
        else setProfile({ ...EMPTY });
      }
      setStanzaPronta(stanza);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pennaMia, chanCode]);
  useEffect(() => {
    const mia = (scrivoIlMio && chanCode) || "";
    //  Il cliente scrive nella propria stanza da subito: è la sua, e non c'è
    //  nessun dato di un altro da portarci dentro.
    if (mia) { stanzaScrittaRef.current = mia; return; }
    stanzaScrittaRef.current = (pennaMia && chanCode && stanzaPronta === chanCode && chanCode) || "";
  }, [scrivoIlMio, pennaMia, chanCode, stanzaPronta]);
  const pushServerState = () => {
    if (pushTimerRef.current != null) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null;
      const snap = snapRef.current as { ts?: number };
      const ts = Number(snap?.ts) || 0;
      if (!ts || ts === pushedTsRef.current) return;
      pushedTsRef.current = ts;
      //  Il codice della consulenza viaggia con lo stato: è ciò che permette al
      //  server di distinguere l'ospite di QUESTA stanza da un curioso qualsiasi
      //  e di consegnare la scheda del cliente solo al primo.
      fetch("/api/presenter/quotestate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        //  ⚠️ LA STANZA DI CHI SCRIVE. Per il consulente è la consulenza che
        //   sta conducendo; per il cliente che ha la penna sul proprio
        //   preventivo è la SUA stanza, ed è così che il consulente vede in
        //   tempo reale quello che sta facendo («mi mostra cosa stanno
        //   facendo»). Scrivere nel codice nudo vorrebbe dire sovrascrivere
        //   il preventivo comune con il suo.
        body: JSON.stringify({ ...snap, sess: stanzaScrittaRef.current || getLiveId() || "" }),
      }).catch(() => {});
    }, 250);
  };
  useEffect(
    () => () => {
      if (pushTimerRef.current != null) clearTimeout(pushTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (isMirror) return;
    snapRef.current = buildSnapshot();
    /*  il link "cliente" è la pagina del cliente stesso: non deve MAI scrivere
        ⚠️ …tranne quando la penna del SUO preventivo è sua, dentro una
         consulenza di gruppo: lì scrivere è il punto: è l'unico modo perché
         il consulente veda comporsi quello che sta compilando. Scrive nella
         sua stanza, mai nel comune (vedi `stanzaScritta`). */
    if (!isClient || scrivoIlMio) pushServerState();
    if (!canBroadcast) return;
    chanRef.current?.send({ type: "broadcast", event: "state", payload: snapRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canBroadcast,
    baseId,
    selected,
    simOn,
    installOn,
    fitting,
    qty,
    profile,
    manual,
    result,
    percorsoOpen,
    lookup,
  ]);

  // ─── OSPITE: polling del valore autorevole (~1s) ───
  // Il realtime dà la reattività istantanea, questo garantisce la CONVERGENZA:
  // qualunque cosa succeda sul canale, entro ~1s l'ospite mostra la verità.
  useEffect(() => {
    //  ⚠️ `applicaDaRemoto` e non `mirrorsState`: chi compila in DUE non è uno
    //   specchio, ma deve continuare a ricevere. Senza questa riga il canale
    //   in tempo reale resta l'unica strada — e quando tace (rete mobile, una
    //   scheda in secondo piano) i due si ritrovano con due preventivi diversi
    //   in mano senza accorgersene. Misurato provando in due schede: la
    //   scelta del cliente arrivava nella sua stanza sul server e sullo
    //   schermo del consulente non compariva.
    if (!applicaDaRemoto && !followsQuote) return;
    let alive = true;
    const poll = async () => {
      try {
        /*  ── ⚠️ SI CHIEDE LO STATO DELLA PROPRIA CONSULENZA ─────────────
            Segnalazione del committente: «quando creo il preventivo non glielo
            mostra creato, ma solo mentre lo creo».
            Qui c'era `getLiveId()`, cioè il codice della consulenza che sta
            conducendo QUESTO dispositivo. Sul telefono del cliente non c'è —
            lui il codice ce l'ha nel link, non in memoria — e la richiesta
            partiva senza: il server rispondeva allora con la RIGA CONDIVISA,
            quella che raccoglie le pagine dei contesti senza codice (una
            scheda /preventivo rimasta aperta da un collega, l'anteprima
            dispositivo). Quella riga viene riscritta di continuo con un
            orologio fresco, quindi ogni secondo sorpassava lo stato vero
            arrivato dalla diretta e riportava il cliente al configuratore.
            Da qui il quadro esatto: le voci si vedevano comparire mentre le
            sceglievi — quelle passano dal canale realtime — e il preventivo
            creato spariva un istante dopo.
            Il codice giusto è quello della consulenza che si sta
            rispecchiando: lo stesso del canale (`chanCode`), che per l'ospite
            è il codice del suo link. Senza codice non si rispecchia NESSUNO:
            uno stato che non porta il codice della tua consulenza non è tuo,
            e mostrarlo vorrebbe dire far vedere a un cliente il preventivo di
            un altro. */
        const sess = chanCode || "";
        if (!sess) return;
        const r = await fetch(
          `/api/presenter/quotestate?sess=${encodeURIComponent(sess)}`,
          { cache: "no-store" },
        );
        const j = (await r.json()) as { state?: Record<string, unknown> | null };
        if (!alive || !j?.state) return;
        if (applicaDaRemoto) {
          applySnapshot(j.state);
          guestContentSeen();
        } else {
          seguiPreventivo(j.state);
          guestContentSeen();
        }
      } catch {
        /* rete: riproveremo fra poco */
      }
    };
    /*  ── ⚠️ QUANTO SPESSO SI CHIEDE, E PERCHÉ NON SEMPRE UGUALE ────────
        Questo giro esiste come RETE DI SICUREZZA del canale in tempo reale:
        se un messaggio si perde, entro un secondo il cliente vede comunque la
        verità. Ma quando il canale funziona — cioè quasi sempre — è una
        richiesta al secondo che non porta niente di nuovo: su una consulenza
        di 45 minuti sono ~2.700 richieste per ogni cliente collegato, pagate
        in batteria del suo telefono e in quota del piano (il conto delle
        richieste giornaliere è un tetto vero, e ci si arriva).
        Adesso: se il canale ha parlato da poco si chiede ogni cinque secondi,
        se tace si torna al ritmo pieno. Il caso in cui la rete di sicurezza
        serve davvero — canale muto — è esattamente quello in cui resta veloce.
        ⚠️ Un `setTimeout` che si riarma, non un `setInterval`: l'intervallo
         ha un ritmo fisso deciso alla partenza, e qui il ritmo cambia. */
    const RITMO_PIENO = mirrorsState ? 1000 : 1500;
    //  ⚠️ Dieci secondi, non cinque: quando il canale parla questo giro non
    //   porta MAI niente di nuovo, e cinque secondi erano comunque 720
    //   richieste l'ora per ogni cliente collegato. Se il canale tace si
    //   torna al ritmo pieno, che è il caso in cui la rete di sicurezza serve
    //   davvero. (Il tetto giornaliero del piano è un limite vero: il
    //   27/09/2026 il sito si è fermato per quello.)
    const RITMO_CALMO = typeof document !== "undefined" && document.hidden ? 20_000 : 10_000;
    const CANALE_FRESCO_MS = 8000;
    let prossimo: ReturnType<typeof setTimeout> | null = null;
    const giro = async () => {
      await poll();
      if (!alive) return;
      const canaleVivo = Date.now() - canaleVistoIl.current < CANALE_FRESCO_MS;
      prossimo = setTimeout(giro, canaleVivo ? RITMO_CALMO : RITMO_PIENO);
    };
    void giro();
    return () => {
      alive = false;
      if (prossimo) clearTimeout(prossimo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirrorsState, applicaDaRemoto, followsQuote, seguiPreventivo, chanCode]);

  // Host: battito leggero — ri-trasmette lo snapshot completo ogni 4s così un
  // ospite che ha perso un evento si riallinea da solo in pochi secondi.
  // Nessuna dipendenza dallo stato: buildSnapshot legge SEMPRE liveRef.current,
  // quindi l'intervallo non va ricreato a ogni click (era churn inutile).
  useEffect(() => {
    if (!canBroadcast) return;
    const iv = setInterval(() => {
      snapRef.current = buildSnapshot();
      chanRef.current?.send({ type: "broadcast", event: "state", payload: snapRef.current });
    }, 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canBroadcast]);

  // Host: BATTITO DELLA POSIZIONE (1,2s). Ora che lo scroll viaggia SOLO
  // sull'evento realtime, un ospite che entra a metà consulenza (o che ha perso
  // un pacchetto) non avrebbe nulla da applicare finché il presentatore non
  // muove la pagina. Qui l'ancora viene RICALCOLATA al momento dell'invio:
  // è sempre la posizione attuale, mai una fotografia vecchia.
  // ── STESSO MODELLO DELLE SLIDE: SI PARLA SOLO QUANDO SI SCORRE ────────────
  //  Il battito periodico che stava qui è stato RIMOSSO. Ribadiva la posizione
  //  ogni 1,2 secondi anche a pagina ferma e, con due contesti del presentatore
  //  vivi contemporaneamente, ognuno annunciava la propria: il cliente veniva
  //  strappato avanti e indietro a cadenza fissa. Le slide non hanno mai avuto
  //  questo battito, ed è il motivo per cui lì lo scorrimento è sempre stato
  //  affidabile. Ora vale la stessa regola: si trasmette una posizione solo
  //  quando la pagina si muove davvero.
  const lastScrollGestureRef = useRef(0);

  // Host: trasmette lo scroll interno dei pannelli marcati data-hg-scroll
  useEffect(() => {
    if (!canSendLive) return;
    let last = 0,
      raf = 0;
    const emit = (el: HTMLElement, k: string) => {
      last = Date.now();
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 4) return; // contenitore non scrollabile → niente da rispecchiare
      const s = el.scrollTop / max;
      const a = readAnchor(el);
      panelScrollRef.current = { ...panelScrollRef.current, [k]: s };
      if (a) panelAnchorRef.current = { ...panelAnchorRef.current, [k]: a };
      logOut(`pannello ${k}`, a, el);
      queueOut({
        panels: { [k]: s },
        panelAnchors: a ? { [k]: a } : undefined,
        sts: scrollClock(),
      });
    };
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | null;
      // il target può essere un discendente (o il document): risaliamo al contenitore marcato
      const el =
        t && typeof t.closest === "function"
          ? (t.closest("[data-hg-scroll]") as HTMLElement | null)
          : null;
      const k = el ? el.getAttribute("data-hg-scroll") : null;
      if (!el || !k) return;
      const now = Date.now();
      if (now - last < 160) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => emit(el, k));
        return;
      }
      emit(el, k);
    };
    // capture: lo scroll dei contenitori interni non risale fino a window
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSendLive]);

  // Host: trasmette lo scroll della pagina (accodato nell'evento consolidato)
  useEffect(() => {
    if (!canSendLive) return;
    let last = 0,
      raf = 0;
    // Come nelle slide: si invia solo se la posizione è CAMBIATA davvero
    // (soglia 0,002 della pagina) e non più di ~6 volte al secondo. Sotto quella
    // soglia sono micro-assestamenti del layout, non un movimento voluto: erano
    // proprio loro a produrre correzioni continue sul dispositivo del cliente.
    // ── LETTURA A CASCATA (come nelle slide) ────────────────────────────────
    //  Non si legge più solo dalla finestra: se a scorrere è il corpo della
    //  pagina o un contenitore interno — cosa che accade dentro l'anteprima
    //  dispositivo e su alcuni telefoni — dalla finestra risulterebbe che non ci
    //  si è mossi affatto, e non partirebbe nulla.
    const readPos = (): { s: number; root: HTMLElement | null } | null => {
      const de = (document.scrollingElement || document.documentElement) as HTMLElement;
      const maxD = de.scrollHeight - window.innerHeight;
      if (maxD > 4) return { s: (window.scrollY || de.scrollTop) / maxD, root: null };
      const b = document.body;
      const maxB = b.scrollHeight - b.clientHeight;
      if (maxB > 4) return { s: b.scrollTop / maxB, root: b };
      const m = document.querySelector('[data-hg-scroll="quote"]') as HTMLElement | null;
      if (m) {
        const mx = m.scrollHeight - m.clientHeight;
        if (mx > 4) return { s: m.scrollTop / mx, root: m };
      }
      return null;
    };
    let lastSent = -1;
    const emit = () => {
      const pos = readPos();
      if (!pos) return;
      const s = Math.max(0, Math.min(1, pos.s));
      if (Math.abs(s - lastSent) < 0.002) return;
      last = Date.now();
      lastSent = s;
      lastScrollGestureRef.current = last;
      const a = readAnchor(pos.root);
      logOut("pagina", a, pos.root);
      queueOut({ scroll: s, sa: a, sts: scrollClock() });
    };
    const onScroll = () => {
      const now = Date.now();
      if (now - last < 160) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(emit);
        return;
      }
      emit();
    };
    // Gli eventi `scroll` degli ELEMENTI non risalgono alla finestra: serve
    // l'ascolto in CATTURA su document, come fanno le slide. Senza, scorrendo un
    // contenitore interno non partiva niente.
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSendLive]);

  const base = menu.base.find((b) => b.id === baseId) ?? menu.base[0];
  // ── IL TRAPIANTO È UN PRODOTTO A SÉ ──────────────────────────────────────
  //  Non condivide nessun accessorio con gli impianti: ha una sezione tutta sua
  //  (soggiorno e post-trapianto), nessuna installazione in studio, nessuna
  //  analisi del colore, e un percorso diverso nel preventivo.
  const isTransplant = base?.id === TRANSPLANT_ID;
  const fitOpt = menu.fitting.find((f) => f.id === fitting) ?? menu.fitting[0];
  const selectedItems = sectionsFor(menu.sections, baseId)
    .flatMap((s) => s.items)
    .filter((u) => selected.has(u.id));
  const upsellTotal = selectedItems.reduce((s, u) => s + u.price, 0);
  // col trapianto: niente installazione in studio e nessun costo di analisi
  const perUnit =
    (base?.price ?? 0) +
    upsellTotal +
    (simOn && menu.simulation ? menu.simulation.price : 0) +
    (installOn && menu.installation && !isTransplant ? menu.installation.price : 0);
  const gross = perUnit * qty + (isTransplant ? 0 : (fitOpt?.price ?? 0));
  // sconto automatico in base alla quantità selezionata (impostato dal CRM)
  const qtyDiscEur = Number(qtyDiscounts[String(qty)]) || 0;
  const qtyDisc: Discount | null =
    qtyDiscEur > 0
      ? {
          code: `Q${qty}`,
          discount_eur: qtyDiscEur,
          stock_total: null,
          stock_left: null,
          label: `${qty} impianti`,
          apply_message: null,
          scarcity_title: null,
          scarcity_text: null,
          kind: "qty",
        }
      : null;
  const codiciApplicati = [...(manual ? [manual] : []), ...autos, ...(qtyDisc ? [qtyDisc] : [])];

  /*  ── ⚠️ IL 35% NON TOCCA QUESTO PREVENTIVO: VALE DAL PROSSIMO IMPIANTO ─
      Correzione del committente, con lo schermo davanti: «non devi dire così,
      ma questo solo dal prossimo impianto in poi: il primo lo paga a prezzo
      intero».
      Qui il 35% era diventato uno SCONTO sul totale di oggi — compariva fra le
      condizioni applicate e abbassava la cifra che il cliente sta per firmare.
      Sbagliato, e non di poco: è la promessa di un prezzo che non gli stiamo
      facendo. Quello che la garanzia dà è il prezzo del PROSSIMO impianto, fra
      quindici mesi; il primo si paga intero.
      Perciò da qui non esce più nessuno sconto: escono due numeri da MOSTRARE
      (quanto costerebbe il prossimo a listino e quanto costa con la garanzia),
      e il totale di oggi resta quello che era.
      ⚠️ E se un codice porta la sua offerta, comanda lui: al posto del 35%
       vale la cifra fissa che ha dentro (shop/promo-garanzia). Le due non si
       sommano mai — vedi `scontoGaranziaEuro`, che è rimasta la regola di chi
       comanda anche adesso che non produce più uno sconto. */
  const garanziaCodiceOra = garanziaDa(codiciApplicati.map((d) => d.code), garanzie);
  const offertaGaranzia = offertaValida(garanziaCodiceOra) ? garanziaCodiceOra : null;
  const garanziaVisibile = (garanziaCodiceOra ? garanziaCodiceOra.mostra : true) && acceso("garanzia");
  /*  ── ⚠️ NIENTE PIÙ PROMOZIONI AUTOMATICHE ─────────────────────────────
      Richiesta del committente: «fai che in automatico non c'è nessuna
      garanzia dei 15 mesi, rimuovila».
      Qui c'era il 35% di casa, che si applicava da solo a ogni preventivo con
      un elenco di eccezioni per i prodotti dove non doveva. Adesso non c'è
      niente da eccettuare: senza un CODICE GARANZIA il preventivo è il
      preventivo, e il riquadro del secondo impianto non compare affatto.
      ⚠️ E questa promozione NON si mescola con quella della video
       testimonianza: quella toglie euro dal totale di OGGI, questa fissa il
       prezzo di un acquisto FUTURO. Restano due voci separate — vedi il
       cartello in shop/promo-garanzia. */
  const secondoImpianto = prezzoDalSecondo({ pieno: gross, offerta: garanziaVisibile ? offertaGaranzia : null });
  const allDiscounts = [...codiciApplicati];
  const rawDiscount = allDiscounts.reduce((s, d) => s + d.discount_eur, 0);
  const discountEur = Math.min(rawDiscount, gross);
  const total = Math.max(0, gross - discountEur);

  //  ── L'ANTEPRIMA DEL LINK DELLA CONSULENZA ──────────────────────────────
  //   Il link mandato PRIMA che il preventivo esista porta solo il codice della
  //   sessione (…?client=1&sess=CODICE), e senza questo pezzo resterebbe l'unico
  //   link della casa senza anteprima — ed è il più mandato di tutti.
  //
  //   ⚠️ SOTTO IL CODICE DI SESSIONE NON VA MAI UN TOTALE, e prima ci andava.
  //   Quel codice resta lo stesso per tutta la consulenza: l'immagine
  //   depositata lì viene riscritta a ogni ritocco del prezzo, e finisce col
  //   raccontare l'ultimo numero visto sullo schermo del consulente — che non è
  //   un preventivo, è un passaggio intermedio. Il cliente riaprendo quel link
  //   vedrebbe una cifra che nessuno gli ha mai proposto.
  //   Il totale ha un indirizzo suo: quello del preventivo confermato
  //   (…&id=IDXXXXX), depositato alla conferma con il numero vero.
  //   Qui si prepara la scheda «lo costruiamo insieme», che è la sola cosa vera
  //   finché non si conferma qualcosa — e per questo non dipende dal prezzo:
  //   si deposita una volta, appena si conosce il nome.
  const anteprimaFattaRef = useRef("");
  useEffect(() => {
    if (isMirror) return;
    const sess = getLiveId() || "";
    const chi = `${profile.nome || ""} ${profile.cognome || ""}`.trim();
    if (!sess || !chi) return;
    const firma = `${sess}|${chi}`;
    if (anteprimaFattaRef.current === firma) return;
    const t = window.setTimeout(() => {
      anteprimaFattaRef.current = firma;
      void depositaAnteprimaPreventivo({
        ref: sess,
        nome: profile.nome,
        cognome: profile.cognome,
        //  Zero di proposito: è ciò che fa scegliere la scheda «da costruire».
        totale: 0,
        base: "",
        quantita: 1,
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [isMirror, profile.nome, profile.cognome]);
  //  Dal listino, non da una costante: vedi `acconto` in shop/quote-menu.
  //  E mai più del totale — un acconto più alto del prezzo non vuol dire niente.
  //  ⚠️ L'acconto della SOLUZIONE scelta: la patch può averne uno suo (vedi
  //   `accontoDi`). Il tetto resta il totale — su un preventivo che costa meno
  //   dell'acconto si chiede il totale, non di più.
  const acconto = Math.min(menu.accontoPer(base?.id), total);
  /** ── QUANTO COSTA LA GARANZIA SU QUESTO PREVENTIVO ─────────────────────
   *  Se un codice applicato lo dice, comanda lui; altrimenti vale il listino.
   *  ⚠️ Anche l'importo ha il suo ripiego: un codice che dice «mostrala» ma con
   *   la cifra a zero non deve far uscire «0,00 €» sotto la parola IMPORTO —
   *   quello si legge come «è gratis», ed è la promessa più cara che questa
   *   pagina possa fare per sbaglio. Zero vuol dire «non l'ho impostata», e si
   *   torna al listino. */
  const garanziaCodice = garanziaCodiceOra;
  const garanzia = {
    mostra: garanziaCodice ? garanziaCodice.mostra : true,
    //  ⚠️ Dal MENU, non dalla costante: il prezzo della manutenzione si
    //   imposta dal listino, e leggerlo dal catalogo vorrebbe dire una cifra a
    //   schermo diversa da quella che il consulente ha appena salvato.
    importo: garanziaCodice?.importo || menu.manutenzione.price,
  };
  /*  La riga che il cliente legge sotto il codice appena applicato. Si compone
      QUI perché qui ci sono i tre pezzi che servono — quanto toglie, che cosa
      fa alla garanzia, quanto è limitata — e si passa al riepilogo, che è solo
      il posto dove si stampa. */
  const messaggioCodice = manual
    ? frasiCodiceApplicato({
        codice: manual.code,
        sconto: manual.discount_eur,
        offerta: garanziaDa([manual.code], garanzie),
        pieno: gross,
        suo: manual.apply_message,
      })
    : "";

  const scarcityList = allDiscounts.map(scarcityFrom).filter(Boolean) as {
    title: string;
    text: string;
    saving: number;
  }[];

  const PERSONALIZABLE = "invisible-derm";
  //  ⚠️ La stessa domanda la fa `sectionsFor` (shop/quote-menu), e adesso la
  //   risposta è una sola: era proprio la doppia risposta a far comparire nel
  //   riepilogo della patch le opzioni dell'Invisible Derm — invisibili sullo
  //   schermo, ma vive nel conto.
  const canPersonalize = siPersonalizza(base?.id ?? "");
  // se la base selezionata è stata disabilitata dall'admin, passa alla prima disponibile
  useEffect(() => {
    if (menu.base.length && !menu.base.some((b) => b.id === baseId)) setBaseId(menu.base[0].id);
  }, [menu.base, baseId]);
  const visibleUpsellSecs = canPersonalize
    ? sectionsFor(menu.sections, base?.id ?? "").filter(
        (sec) => !sec.requiresAnyOf || sec.requiresAnyOf.some((id) => selected.has(id)),
      )
    : [];
  const profileNum = 3 + visibleUpsellSecs.length + (canPersonalize && menu.simulation ? 1 : 0); // il profilo è l'ultimo step
  const chooseBase = (id: string) => {
    if (id !== baseId) {
      // La soluzione base è la scelta più importante della pagina: le si dà il
      // suono delle voci in promozione anche quando non lo è, perché è un
      // cambio di strada, non la spunta di un accessorio.
      const b = menu.base.find((x) => x.id === id);
      primeSfx();
      b && (b.price === 0 || (!!b.wasPrice && b.wasPrice > b.price))
        ? sfx.selectDeal()
        : sfx.select();
    }
    setBaseId(id);
    sceltoAMano.current = true;
    //  Cambiare strada rimette le spunte di partenza — quelle decise nel
    //  pannello Listino, non quelle scritte nel codice. Il trapianto ha
    //  accessori tutti suoi: le voci degli impianti non lo riguardano, e le
    //  toglie di mezzo `sectionsFor` senza che serva svuotare la selezione
    //  (svuotandola si perdevano anche le spunte della SUA sezione, hotel e
    //  kit post-trapianto, che il pannello può aver preselezionato).
    if (id === TRANSPLANT_ID || id !== PERSONALIZABLE) {
      //  ⚠️ Le spunte della strada in cui si ENTRA, non di quella da cui si
      //   esce: `preselRef` segue la soluzione corrente, che in questo istante
      //   è ancora la precedente (lo stato si aggiorna al render dopo).
      setSelected(new Set(preselDi(id)));
      setSimOn(false);
    }
  };
  /** true se la voce è gratuita o in promozione: ha un suono tutto suo. */
  const inPromo = (id: string) => {
    for (const sec of menu.sections) {
      const it = sec.items.find((x) => x.id === id);
      if (it) return it.price === 0 || (!!it.wasPrice && it.wasPrice > it.price);
    }
    return false;
  };
  selectedRef.current = selected;
  baseIdRef.current = baseId;
  inPromoRef.current = inPromo;
  const toggle = (id: string) => {
    sceltoAMano.current = true;
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        sfx.deselect();
      } else {
        n.add(id);
        inPromo(id) ? sfx.selectDeal() : sfx.select();
      }
      return n;
    });
  };
  // selezione singola (radio): scegliendone un'altra deseleziona la precedente dello stesso gruppo
  const selectSingle = (groupIds: string[], id: string) => {
    sceltoAMano.current = true;
    setSelected((prev) => {
      const n = new Set(prev);
      const wasOn = n.has(id);
      groupIds.forEach((g) => n.delete(g));
      if (!wasOn) {
        n.add(id);
        inPromo(id) ? sfx.selectDeal() : sfx.select();
      } else sfx.deselect();
      return n;
    });
  };
  const reset = () => {
    sfx.deselect();
    sceltoAMano.current = true;
    setSelected(new Set());
    setSimOn(false);
    setInstallOn(true);
    setBaseId(BASE_SOLUTIONS[0].id);
    setQty(1);
    setFitting("remoto");
  };

  // se non è selezionato un tipo di capello, azzera la qualità (sotto-sezione condizionale)
  useEffect(() => {
    const hairTypeSel = selected.has("hair-european") || selected.has("hair-indian");
    if (!hairTypeSel && (selected.has("hair-virgin") || selected.has("hair-treated"))) {
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete("hair-virgin");
        n.delete("hair-treated");
        return n;
      });
    }
  }, [selected]);

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setChecking(true);
    setCodeErr(null);
    try {
      const res = await fetch(conSessione("/api/public/validate-discount"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (j.valid) {
        setManual(j as Discount);
        /*  ── ⚠️ E SI RILEGGE LA GARANZIA DI QUESTO CODICE ─────────────────
            Segnalazione del committente: «ho messo codice promo ma non si
            aggiorna l'importo con quello del codice promo e non dice neanche
            posti disponibili e rimanenti e la data quando scade».
            La mappa delle garanzie si leggeva UNA VOLTA SOLA, all'apertura
            della pagina. Un codice creato mentre il preventivo era già aperto —
            cioè il caso normale: lo creo nelle impostazioni e vado subito a
            provarlo — non c'era in quella mappa, e il preventivo applicava il
            codice senza sapere che portava un'offerta. Da fuori: «il codice non
            fa niente».
            Rileggerla qui costa una richiesta, e solo quando qualcuno batte un
            codice a mano: è il momento esatto in cui può essere cambiata. */
        void fetch(conSessione("/api/public/validate-discount"))
          .then((r) => r.json())
          .then((d) => { if (d?.garanzie !== undefined) setGaranzie(leggiMappa(d.garanzie as string | undefined)); })
          .catch(() => { /* resta quella che c'è */ });
        sfx.selectDeal();
        {
          const sconto = Number(j.discount_eur) || 0;
          const p = gross > 0 ? Math.round((sconto / gross) * 100) : 0;
          //  Percentuale E importo: la prima dice quanto pesa, il secondo cosa
          //  resta in tasca. Da sole, la prima sembra uno slogan e il secondo un
          //  numero qualsiasi.
          toast.success(
            p >= 1
              ? `Prezzo video testimonianza attivo · −${p}% sul totale (${formatPrice(sconto)})`
              : `Prezzo video testimonianza attivo · risparmi ${formatPrice(sconto)}`,
          );
        }
      } else {
        setManual(null);
        sfx.error();
        setCodeErr(
          j.reason === "sold_out"
            ? "Codice esaurito: i posti riservati sono finiti."
            : "Codice non valido: controlla di averlo scritto bene.",
        );
      }
    } catch {
      sfx.error();
      setCodeErr("Verifica non riuscita, riprova tra poco.");
    } finally {
      setChecking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    /*  ── ⚠️ CONFERMA IL CONSULENTE, NON IL CLIENTE ────────────────────────
        Richiesta del committente: «fai che per confermare il preventivo può
        farlo solo il presentatore».
        Il cliente compone il suo — sceglie, cambia idea, prova — e la
        conferma è il momento in cui quel preventivo diventa un impegno con un
        numero: quel passo lo fa chi conduce la consulenza, guardandolo in
        faccia. Qui si rifiuta anche l'invio, non solo si spegne il pulsante:
        un modulo si invia anche col tasto Invio da un campo, e una difesa che
        si vede soltanto non è una difesa. */
    if (isViewer) {
      console.warn("[GUEST] conferma rifiutata: il preventivo lo conferma il consulente");
      toast("Lo conferma il consulente", {
        description: "Hai finito di comporre il tuo preventivo: ora lo conferma chi sta conducendo la consulenza.",
      });
      return;
    }
    setSubmitting(true);
    /*  ── CHE COSA ERA SPUNTATO, PER ID ───────────────────────────────────
        Le voci, per ID e per nome: l'id serve a rimetterle esatte quando si
        preme «modifica preventivo», il nome a poter dire QUALE non è tornata
        se dal listino è stata tolta. Vedi shop/condizioni-preventivo. */
    const scelteDiAdesso = (): ScelteFatte => ({
      baseId,
      voci: [
        ...selectedItems.map((u) => ({ id: u.id, nome: u.name })),
        ...(simOn && menu.simulation ? [{ id: menu.simulation.id, nome: menu.simulation.name }] : []),
        ...(installOn && menu.installation ? [{ id: menu.installation.id, nome: menu.installation.name }] : []),
      ],
      varianti: { ...varianti },
      simOn,
      installOn,
      installLoc,
      fitting,
      qty,
    });
    //  La sotto-scelta entra NEL NOME della voce: è così che arriva sul
    //  preventivo, nel PDF e in produzione — "Mosso — onda media" dice a chi
    //  costruisce l'impianto cosa fare, "Mosso" da solo no.
    const conVariante = (u: { id: string; name: string }) => {
      const v = menu.sections.flatMap((sec) => sec.items).find((i) => i.id === u.id)?.variants;
      if (!v) return u.name;
      const scelta = v.options.find((o) => o.id === (varianti[u.id] ?? v.defaultId));
      return scelta ? `${u.name} — ${scelta.name.toLowerCase()}` : u.name;
    };
    const items: QItem[] = [
      ...selectedItems.map((u) => ({ name: conVariante(u), price: u.price, wasPrice: u.wasPrice })),
      ...(simOn && menu.simulation
        ? [
            {
              name: menu.simulation.name,
              price: menu.simulation.price,
              wasPrice: menu.simulation.wasPrice,
            },
          ]
        : []),
      //  ⚠️ Il posto viaggia CON la voce: è una proprietà dell'installazione,
      //   non del preventivo, e messo qui torna indietro insieme a lei quando
      //   il preventivo si riapre (shop/riapri-preventivo).
      ...(installOn && menu.installation
        ? [{ name: menu.installation.name, price: menu.installation.price, dove: installLoc }]
        : []),
    ];
    // NUMERO PREVENTIVO = "ID" + 5 caratteri alfanumerici maiuscoli (es. ID8271X).
    // È l'UNICO identificativo: badge, riepilogo, PDF, link cliente, WhatsApp,
    // API ?ref= e causale del bonifico usano tutti questo stesso codice.
    // Alfabeto senza caratteri ambigui (niente 0/O/1/I) → ~32^5 ≈ 33 milioni.
    const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const makeRef = () =>
      "ID" +
      Array.from(
        { length: 5 },
        () => REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)],
      ).join("");
    const row = (r: string) => ({
      quote_ref: r,
      nome: profile.nome,
      cognome: profile.cognome,
      email: profile.email,
      telefono: profile.telefono,
      eta: profile.eta ? Number(profile.eta) : null,
      grey_pct: profile.greyPct ? Number(profile.greyPct) : null,
      color_code: profile.colorCode || null,
      problemi: profile.problemi || null,
      base_choice: base.name,
      base_system: { id: base.id, name: base.name, price: base.price },
      upsells: items,
      qty,
      fitting_mode: fitting,
      discount_code:
        allDiscounts
          .filter((d) => d.kind !== "qty")
          .map((d) => d.code)
          .join(", ") || null,
      discount_eur: discountEur,
      total,
      status: "nuovo",
    });
    /*  ── LA FOTOGRAFIA DELLE CONDIZIONI ──────────────────────────────────
        Richiesta del committente: «se un preventivo lo faccio con le opzioni
        accese o con determinati prezzi, rimangono quei prezzi e quelle
        impostazioni».
        Nella riga del preventivo ci sono le voci e i loro prezzi, non il
        resto di quello che c'era a schermo: l'assistenza, l'acconto, quali
        pezzi della pagina erano accesi. Quella roba la pagina la rileggeva
        dal listino di ADESSO, e il listino cambia — così un documento già
        consegnato cambiava da solo. Qui si fotografa il listino intero
        insieme alle scelte fatte, per ID (vedi shop/condizioni-preventivo).
        ⚠️ Gli ID servono a «modifica preventivo»: riaprire dai nomi è
         un'approssimazione, e una voce rinominata nel frattempo non
         tornerebbe indietro. */
    const foto = condizioniDa(pricingRef.current, scelteDiAdesso());
    //  ── IL SALVATAGGIO LO FA IL SERVER ──────────────────────────────────
    //   Prima l'inserimento partiva da qui, dal browser, e passava per le
    //   regole di riga del database. Quando venivano rifiutate, questo codice
    //   faceva `break` e mostrava comunque il preventivo: il numero appariva a
    //   schermo, il cliente lo vedeva, e nell'archivio non c'era niente.
    //   Ora l'esito torna indietro, e se non si è salvato lo si sa SUBITO —
    //   mentre il cliente è ancora davanti e si può rifare.
    let ref = makeRef();
    try {
      const r = await fetch("/api/public/quote-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        /*  ⚠️ CHI STA COMPILANDO, QUANDO LO SA ─────────────────────────
            In una consulenza di gruppo il preventivo lo compila il cliente
            sul proprio schermo, e chi sia lo ha già dichiarato all'ingresso:
            il gettone viaggia con la richiesta e il server lo traduce nella
            sua scheda, invece di indovinarla dal telefono (che in tre
            persone della stessa famiglia è lo stesso numero). Fuori dal
            gruppo questi due campi sono vuoti e non cambia niente. */
        body: JSON.stringify({
          row: row(ref), condizioni: foto,
          ...(mioGettone ? { sess: watchId || "", persona: mioGettone } : {}),
        }),
      }).then((x) => x.json());
      if (r?.ok && r.ref) {
        ref = String(r.ref); // il server può aver dovuto cambiare numero
      } else {
        toast.error(
          "Preventivo NON salvato in archivio. Non chiudere la pagina: riprova a confermare.",
          { duration: 12000 },
        );
        console.error("[PREVENTIVO] salvataggio fallito:", r?.reason);
      }
    } catch (e) {
      toast.error("Preventivo NON salvato: connessione assente. Non chiudere la pagina.", {
        duration: 12000,
      });
      console.error("[PREVENTIVO] salvataggio fallito:", e);
    }
    setSubmitting(false);
    //  ⚠️ Vale da subito anche su questo schermo: da qui in avanti il
    //   documento a video si disegna con la fotografia, non con il listino —
    //   che nel frattempo il consulente può ritoccare mentre il cliente sta
    //   ancora leggendo.
    setCondizioni(foto);
    // il numero dell'ultimo preventivo creato alimenta il "link solo preventivo"
    setQuoteRef(ref);
    //  ── L'ANTEPRIMA DEL LINK, SUBITO ─────────────────────────────────────
    //   Chi riceve questo link su WhatsApp vede prima di tutto un riquadro.
    //   Qui si disegna la scheda di QUESTO preventivo — nome, totale, che cosa
    //   comprende — e si deposita come immagine dell'anteprima.
    //   Parte adesso e non quando si preme "condividi": il consulente il link
    //   lo copia e lo manda nello stesso secondo, e i server di WhatsApp
    //   leggono l'anteprima UNA volta sola e poi la tengono in cache per
    //   giorni. Arrivare tardi qui significa non arrivare mai.
    //   ⚠️ Non si aspetta il risultato e non si dice niente: il preventivo è
    //   già salvato, e questa è una rifinitura che non deve poter rovinare il
    //   momento in cui il cliente sta guardando lo schermo.
    void depositaAnteprimaPreventivo({
      ref,
      nome: profile.nome,
      cognome: profile.cognome,
      totale: total,
      base: base.name,
      quantita: qty,
      prezzoPieno: Number(gross) || 0,
    });
    //  ── LA BOZZA DI FATTURA NASCE INSIEME AL PREVENTIVO ──────────────────
    //   Richiesta del committente: se i dati per la fattura sono stati scritti
    //   nel modulo qui sopra, la bozza si prepara DA SOLA appena il preventivo
    //   è salvato. Prima bisognava aprire un pannello e ripremere: due gesti in
    //   più con il cliente davanti, e per una cosa che i dati per farla li
    //   aveva già tutti.
    //
    //   ⚠️ SOLO SE I DATI CI SONO DAVVERO. Codice fiscale e residenza sono
    //    facoltativi nel modulo (un preventivo si è sempre potuto fare senza), e
    //    una bozza a metà è peggio di nessuna bozza: sembra pronta e poi non si
    //    può emettere. Se manca anche uno solo dei campi non si fa niente, e il
    //    pannello resta lì per prepararla a mano.
    //   ⚠️ E SOLO PER IL CONSULENTE: `isViewer` è chi guarda la diretta,
    //    `isClient` è il cliente sul suo telefono. Il cliente non ha nessuna
    //    autorizzazione da presentatore — la rotta risponderebbe 401 — e non è
    //    lui a dover creare documenti contabili.
    //   ⚠️ NON SI ASPETTA E NON SI BLOCCA NIENTE: il preventivo è già salvato,
    //    e una bozza che non riesce non deve rovinare il momento in cui il
    //    cliente sta guardando lo schermo. Se non riesce lo si dice, piano.
    if (!isViewer && !isClient) {
      const f = {
        codiceFiscale: profile.codiceFiscale.trim(),
        indirizzo: profile.indirizzo.trim(),
        civico: profile.civico.trim(),
        cap: profile.cap.trim(),
        comune: profile.comune.trim(),
        provincia: profile.provincia.trim(),
      };
      const completi = Object.values(f).every(Boolean) && !!profile.email.trim();
      if (completi) {
        //  ⚠️ IL TOTALE DEL PREVENTIVO, NON L'ACCONTO — scelta del committente.
        //   La bozza nasce con la cifra intera della pratica; al momento di
        //   emetterla si dice se il cliente ha versato tutto o solo una parte, e
        //   lì l'importo si corregge (vedi crm/fatture/FinestraIncassoFattura).
        //   È l'ordine giusto: la cifra che si conosce oggi è quella del
        //   preventivo, quella che arriverà si conosce quando arriva.
        void fetch("/api/presenter/fattura-bozza", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref,
            email: profile.email.trim(),
            importo: total,
            //  «unica» perché copre l'intera pratica: diventa «acconto» se
            //  emettendola si dichiara che il cliente ha versato solo una parte.
            tipo: "unica",
            //  ⚠️ `emetti` assente: si prepara e basta. Numero e data nascono
            //   quando la si segna pagata, dalla pagina «Fatture».
            cliente: {
              azienda: false,
              nome: profile.nome,
              cognome: profile.cognome,
              ...f,
              nazione: "IT",
              codiceDestinatario: "0000000",
            },
          }),
        })
          .then((x) => x.json())
          .then((j: { ok?: boolean; reason?: string }) => {
            if (j?.ok)
              toast.success("Bozza di fattura pronta", {
                description: `Per ${formatPrice(total)}, il totale del preventivo. La trovi in «Fatture»: emettendola dirai se ha versato tutto o solo una parte.`,
              });
            else
              toast.warning("Bozza di fattura non creata", {
                description: "Il preventivo è salvato. La puoi preparare qui sotto.",
              });
          })
          .catch(() => {
            /* rete: il preventivo è salvato, la bozza si rifà dal pannello */
          });
      }
    }

    //  ── IL PREVENTIVO PORTA IL NOME DI CHI L'HA FATTO ────────────────────
    //   Con più consulenti sullo stesso archivio, senza questo non si può dire
    //   chi ha seguito cosa — né filtrare l'elenco per vedere solo i propri.
    try {
      const pres = JSON.parse(localStorage.getItem("hg_presenter") || "null") as {
        id?: string;
        name?: string;
      } | null;
      if (pres?.id) {
        fetch("/api/presenter/quote-owner", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref, presenterId: pres.id, presenterName: pres.name }),
        }).catch(() => {});
      }
    } catch {
      /* */
    }
    //  ── LA SCHEDA DEL CRM SI AGGIORNA DA SOLA ───────────────────────────
    //   Cognomi corretti, numeri nuovi, età: quello che è stato sistemato qui
    //   davanti al cliente vale anche là. Le note si accodano, non sostituiscono.
    if (leadCrmRef.current?.id) {
      fetch("/api/crm/lead-sync", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadCrmRef.current.id,
          quoteRef: ref,
          profilo: {
            nome: profile.nome,
            cognome: profile.cognome,
            telefono: profile.telefono,
            email: profile.email,
            eta: profile.eta,
          },
          note: profile.problemi || "",
        }),
      }).catch(() => {
        /* la scheda si aggiorna al prossimo salvataggio */
      });
    }
    eliminaBozza();
    const fresh: Snapshot = {
      ref,
      baseName: base.name,
      basePrice: base.price,
      items,
      qty,
      fittingId: fitting,
      fittingName: fitOpt?.name ?? "",
      fittingPrice: fitOpt?.price ?? 0,
      //  ⚠️ `kind` non può restare vuoto. I codici validati al momento — quello
      //   digitato dal consulente e quelli automatici — arrivano dalla tabella
      //   senza un tipo, e una voce senza tipo il pannello di modifica la legge
      //   come «sconto che non so scomporre»: il consulente non potrebbe più
      //   togliere il codice appena messo, e applicandone un altro i due si
      //   sommerebbero. Un codice qui dentro è un codice, e va detto.
      discounts: allDiscounts.map((d) => ({
        code: d.code,
        eur: d.discount_eur,
        kind: d.kind ?? ("code" as const),
        label: d.label ?? undefined,
      })),
      discountEur,
      gross,
      total,
      acconto,
      nome: profile.nome,
      cognome: profile.cognome,
      email: profile.email,
      telefono: profile.telefono,
      eta: profile.eta,
      greyPct: profile.greyPct,
      colorCode: profile.colorCode,
      problemi: profile.problemi,
      installOn,
      scarcity: scarcityList[0] ?? null,
      promoUntil: promoUntil.toISOString(),
      timelineStart: new Date().toISOString(),
      steps: {},
    };
    baseSnapRef.current = fresh; // origine delle modifiche fatte dopo
    setResult(fresh);
    sfx.page("creato");
    sfx.success();
    window.scrollTo({ top: 0 });
  };

  const copy = (t: string, label: string) => copyLink(t, `${label} copiato`);
  const inputCls =
    "w-full rounded-xl border border-white/20 bg-white/[0.06] px-3.5 py-3 text-[15px] text-white placeholder:text-white/40 transition focus:border-brand focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-brand/30";

  // ── BANNER DELLA DIRETTA ───────────────────────────────────────────────────
  //  Prima era `fixed`: non occupava spazio, quindi COPRIVA i primi ~28px del
  //  contenuto sul dispositivo del cliente. Quello spazio non esiste da nessuna
  //  parte nella pagina del presentatore, perciò la parte alta di ogni schermata
  //  risultava mangiata proprio dal banner: da qui i "buchi" e il senso di
  //  disallineamento anche a posizione corretta.
  //  Ora sta nel FLUSSO della pagina: occupa il proprio spazio, non copre nulla
  //  e viene conteggiato come qualsiasi altro contenuto.
  //  Inoltre compare anche nell'ANTEPRIMA del presentatore (l'iframe che simula
  //  il dispositivo del cliente): così ciò che vedi in anteprima è, riga per
  //  riga, ciò che vede lui.
  const inPreviewFrame =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      new URLSearchParams(window.location.search).get("embed") === "1");
  const showBanner = mirrorsState || (inPreviewFrame && !!hostId);

  // ── "STIAMO RECUPERANDO IL TUO PREVENTIVO" ────────────────────────────────
  //  Mentre il consulente cerca fra i preventivi, dall'altra parte la pagina
  //  resterebbe immobile: il cliente non sa se lo stai ascoltando o se è
  //  caduta la linea, e nel dubbio parla sopra o riaggancia. Questo velo
  //  risponde alla domanda prima che se la faccia — e sparisce da solo appena
  //  apri il documento, quindi non va mai chiuso a mano.
  const lookupVeil =
    remoteLookup && (isMirror || isViewer) ? (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#040d1f]/88 px-6 backdrop-blur-sm print:hidden">
        <div className="hg-rise w-full max-w-sm rounded-3xl border border-white/12 bg-white/[0.04] px-6 py-8 text-center shadow-2xl">
          <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/35 bg-brand/10">
            <span className="hg-pulse-ring absolute inset-0 rounded-2xl border border-brand/40" />
            <FileText className="hg-icon-in h-6 w-6 text-brand" />
          </span>
          <p className="mt-4 text-[17px] font-bold leading-tight text-white">
            Stiamo recuperando il tuo preventivo
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
            Il consulente sta aprendo il documento a tuo nome. Resta in linea, ci vuole un istante.
          </p>
          <span className="mx-auto mt-5 block h-px w-24 overflow-hidden rounded-full bg-white/10">
            <span className="hg-sheen block h-full w-full bg-gradient-to-r from-transparent via-brand to-transparent" />
          </span>
        </div>
      </div>
    ) : null;
  /*  ── «IL TUO PREVENTIVO STA ARRIVANDO» ─────────────────────────────────
      In una consulenza di gruppo il consulente manda tutti sulla pagina del
      preventivo, ma quello che ciascuno deve vedere lo accende lui: il comune
      quando è pronto, il singolo a chi decide di aprirlo. Nel frattempo
      questa pagina non deve mostrare né una pagina vuota né — peggio — il
      lavoro in corso di un altro. */
  const veloGruppo =
    isViewer && !!mioGettone && vedoDelGruppo === "niente" ? (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#040d1f]/92 px-6 backdrop-blur-sm print:hidden">
        <div className="hg-rise w-full max-w-sm rounded-3xl border border-white/12 bg-white/[0.04] px-6 py-8 text-center shadow-2xl">
          <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/35 bg-brand/10">
            <span className="hg-pulse-ring absolute inset-0 rounded-2xl border border-brand/40" />
            <FileText className="hg-icon-in h-6 w-6 text-brand" />
          </span>
          <p className="mt-4 text-[17px] font-bold leading-tight text-white">
            Il consulente sta preparando il preventivo
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
            Compare qui appena è pronto. Resta pure su questa pagina: non serve fare altro.
          </p>
          <span className="mx-auto mt-5 block h-px w-24 overflow-hidden rounded-full bg-white/10">
            <span className="hg-sheen block h-full w-full bg-gradient-to-r from-transparent via-brand to-transparent" />
          </span>
        </div>
      </div>
    ) : null;
  /*  ── IL TUO PREVENTIVO, E CHI CI STA SCRIVENDO ─────────────────────────
      Richiesta del committente: «quando prendi la penna, può riprendersela».
      Perché possa riprendersela deve prima SAPERE che gliel'hai presa — una
      pagina che si compila da sola senza una riga che lo dica è una pagina
      rotta, non una pagina condivisa. Qui c'è la riga, e accanto il pulsante.
      ⚠️ Riprendersela è un clic solo, senza conferme: è il suo preventivo. */
  /*  ── LA FASCIA DEL CLIENTE ─────────────────────────────────────────────
      Due soli stati, e nessun pulsante: da quando la penna non si passa più,
      il suo preventivo lo può sempre toccare. Quello che gli serve sapere è
      una cosa sola — se sta lavorando da solo o se il consulente è dentro con
      lui — perché senza quella riga vede il foglio muoversi da sé e si ferma.
      (I pulsanti «Riprendi tu» e «Faccio da solo» erano il modo di
      riprendersi una penna che adesso non gli toglie più nessuno.) */
  const bandaDelMio =
    isViewer && vedoDelGruppo === "mio" ? (
      <div data-hg-sempre className={`relative z-[80] flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-1.5 text-center text-xs font-semibold text-white print:hidden ${inDue ? "bg-sky-700" : "bg-emerald-600"}`}>
        <FileText className="h-3.5 w-3.5" />
        {inDue
          ? "Questo è il tuo preventivo: lo state compilando insieme al consulente"
          : "Questo è il tuo preventivo — compilalo pure, il consulente lo vede mentre lo fai"}
      </div>
    ) : null;
  /*  ── SU QUALE PREVENTIVO STO LAVORANDO ─────────────────────────────────
      Quando apri il preventivo di una persona, la tua pagina diventa la SUA:
      quello che tocchi finisce nella sua stanza, non nel preventivo comune.
      Senza una riga che lo dica è il modo più facile di scrivere per venti
      minuti nel posto sbagliato — e la via d'uscita non può essere un
      pannello in un angolo, che magari è chiuso.
      ⚠️ Dice anche se lui lo sta vedendo: è la differenza fra «lo stiamo
       facendo insieme» e «glielo sto preparando», e cambia come parli. */
  const chiGuardo = attesiDelGruppo.find((a) => a.gettone === apertoDaMe)?.nome || "questa persona";
  const luiLoVede = guardoIlSuo && haIlSuo(regiaDelConsulente, apertoDaMe);
  const bandaGuardo =
    guardoIlSuo ? (
      <div data-hg-sempre className={`relative z-[80] flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-1.5 text-center text-xs font-semibold text-white print:hidden ${luiLoVede ? "bg-emerald-700" : "bg-sky-800"}`}>
        <FileText className="h-3.5 w-3.5" />
        {luiLoVede
          ? `Stai lavorando al preventivo di ${chiGuardo}: lo vede e lo state compilando insieme`
          : `Stai preparando il preventivo di ${chiGuardo}: lui non lo vede ancora`}
        <button
          type="button"
          onClick={() => {
            //  Chiude la sua stanza dal mio schermo: quello che vede LUI non
            //  cambia di una virgola (lo decide il pannello, un'altra riga).
            setApertoSubito("");
            void cambiaRegia(hostId, { aperto: "" });
          }}
          className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold hover:bg-white/30"
        >
          Torna al tuo
        </button>
      </div>
    ) : null;
  const viewerBanner = showBanner ? (
    <div className="relative z-[80] flex items-center justify-center gap-2 bg-brand px-4 py-1.5 text-center text-xs font-semibold text-white print:hidden">
      <Radio className="h-3.5 w-3.5 animate-pulse" /> Diretta — stai vedendo la configurazione in
      tempo reale
    </div>
  ) : null;

  /*  ⚠️ LA PLANCIA DEL GRUPPO NON SI MONTA QUI, E C'È UNA RAGIONE TROVATA
      PROVANDO: con l'anteprima dispositivo accesa — cioè come si lavora
      spesso — questa pagina gira DENTRO l'iframe dell'anteprima, e la plancia
      finiva disegnata dentro la cornicetta del telefono, insieme a quello che
      vede il cliente. I comandi del consulente non stanno nello schermo del
      cliente. Adesso la monta una volta sola la scorza della videochiamata
      (shop/call: `PlanciaDelGruppo`), che è fuori da qualunque anteprima e
      c'è su tutte le pagine. Qui restano solo le due letture che servono a
      questa pagina per sapere quale preventivo sta guardando. */
  const presenterBar = !isViewer && !isClient ? <PresenterBar page="preventivo" /> : null;

  // ─────────── PAGINA RIEPILOGO ───────────
  if (result) {
    const r = result;
    // Causale bonifico: "Conferma ordine : ID8271X" — il codice è lo stesso
    // numero preventivo mostrato ovunque. Niente nome/cognome del cliente.
    //  ⚠️ QUESTA FRASE DEVE COMBACIARE CON QUELLA DELLA FATTURA, parola per
    //   parola: è la causale che il cliente copia nel bonifico, ed è il filo con
    //   cui poi si lega quel versamento al documento contabile
    //   (`causalePredefinita` in crm/fatture/FinestraFattura scrive «Conferma
    //   ordine - IDXXXXX»). Il trattino ha preso il posto dei due punti proprio
    //   per farle combaciare.
    /*  ── LA CAUSALE ────────────────────────────────────────────────────
        Richiesta del committente: «fai che posso cambiare la causale del
        preventivo».
        Era scritta qui a mano, con l'avvertenza che doveva combaciare «parola
        per parola» con quella della fattura — tre copie della stessa frase in
        tre file diversi. Adesso la costruisce `causaleDi` (shop/causale-
        bonifico) da un MODELLO: quello scritto a mano per questo preventivo
        se c'è, altrimenti quello del listino con cui è nato.
        ⚠️ Il modello viaggia nella fotografia del documento, quindi la
         causale di un preventivo già consegnato non cambia più da sola. */
    const causale = causaleDi({
      modello: causaleSuMisura || menu.causale,
      numero: r.ref,
      nome: [r.nome, r.cognome].filter(Boolean).join(" ").trim(),
      totale: formatPrice(r.total),
    });
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareLink = `${origin}/preventivo?id=${r.ref}&client=1`;
    //  L'indirizzo di QUESTO preventivo, nudo: è quello che si mostra a chi è
    //  arrivato da un link ormai disattivato, perché possa sostituire nei suoi
    //  messaggi quello vecchio. Senza `client=1`: chi lo riceve deve vedere la
    //  stessa pagina che gli è stata mandata la prima volta.
    const linkPreventivo = `${origin}/preventivo?id=${r.ref}`;
    /** L'indirizzo del preventivo VALIDO, quando questo è stato annullato.
     *  Vuoto se questo vale ancora — così chi lo usa non deve ricordarsi di
     *  controllare `annullatoDa` una seconda volta. */
    const linkValido = annullatoDa ? `${origin}/preventivo?id=${annullatoDa}` : "";
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`Preventivo Hair Genius Labs ${r.ref} — ${formatPrice(r.total)}. Aprilo qui: ${shareLink}`)}`;

    const askEdit = async () => {
      const pwd = window.prompt("Inserisci la password per modificare il preventivo:");
      if (!pwd) return;
      const res = await fetch("/api/public/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: r.ref, password: pwd }),
      });
      const j = await res.json();
      if (j.ok) {
        //  ⚠️ SI PARTE DA `EMPTY` e si sovrascrive quello che il preventivo
        //   sa: i campi della fattura non stanno nella riga del preventivo
        //   (vedi `Profile`), e senza questa base resterebbero `undefined` —
        //   cioè comparirebbero nei campi come «undefined» e finirebbero così
        //   nella finestra della fattura.
        setProfile({
          ...EMPTY,
          nome: r.nome,
          cognome: r.cognome,
          email: r.email,
          telefono: r.telefono,
          eta: r.eta,
          greyPct: r.greyPct,
          colorCode: r.colorCode,
        });
        setQty(r.qty);
        /*  ── ⚠️ E LA CONFIGURAZIONE TORNA COM'ERA ──────────────────────
            Segnalazione del committente: «se clicco modifica preventivo mi
            deve rimettere tutto settato come era prima, e non che riparte da
            capo».
            Qui si rimettevano solo i dati della persona e la quantità: il
            configuratore ripartiva dalla combinazione di serie, e chi aveva
            davanti un preventivo con otto personalizzazioni doveva
            ricostruirlo a memoria davanti al cliente — bastava dimenticarne
            una perché il preventivo nuovo costasse meno del vecchio senza che
            nessuno se ne accorgesse.
            Il cammino inverso (nomi salvati → voci del listino di oggi) lo fa
            `configurazioneDa`, che usa la stessa `voceDiListino` del resto
            della pagina. */
        /*  ── ⚠️ CON LE CONDIZIONI DI OGGI, NON CON QUELLE DI ALLORA ────
            Richiesta del committente: «a meno che non faccia modifica
            preventivo, e allora si aggiorna con le nuove condizioni».
            Finché il documento è a schermo si disegna con la sua fotografia
            (`condizioni`); premendo «modifica» quella fotografia si butta, e
            da qui in avanti — prezzi, assistenza, acconto, voci disponibili —
            vale il listino di adesso. Per questo il menu su cui si rimettono
            le spunte è ricostruito dal listino di oggi e non è `menu`, che in
            questo istante è ancora quello di allora. */
        const menuOggi = buildMenu(pricingRef.current);
        //  Le scelte fotografate col preventivo (per ID: esatte). Sui
        //  preventivi nati prima si torna al cammino dai nomi.
        const c = configurazioneDa(r, menuOggi, condizioniRef.current?.scelte);
        setCondizioni(null);
        setBaseId(c.baseId);
        setSelected(new Set(c.selected));
        setVarianti(c.varianti);
        setSimOn(c.simOn);
        setInstallOn(c.installOn);
        setInstallLoc(c.installLoc);
        setFitting((condizioniRef.current?.scelte?.fitting as "remoto" | "sede") || r.fittingId);
        //  ⚠️ Da qui in avanti comandano le scelte riaperte: la preselezione
        //   del listino non deve entrare a sovrascriverle (vedi `sceltoAMano`).
        sceltoAMano.current = true;
        //  ⚠️ Il codice sconto si RICONTROLLA sul server invece di rimetterlo
        //   com'era: nel frattempo può essere scaduto o esaurito, e riapplicarlo
        //   alla cieca vorrebbe dire promettere un prezzo che non esiste più.
        //   È la stessa cautela della bozza ripresa.
        const codice = r.discounts.find((d) => d.kind === "code" || !d.kind)?.code ?? "";
        if (codice) {
          setCodeInput(codice);
          void riapplicaCodice(codice);
        }
        setResult(null);
        window.history.replaceState({}, "", "/preventivo");
        //  ⚠️ Una voce che nel listino di oggi non esiste più NON torna, e si
        //   dice: scoprirlo dal totale, davanti al cliente, è il modo peggiore.
        if (c.perse.length)
          toast.warning(
            c.perse.length === 1
              ? `Una voce non è più a listino e non è stata rimessa: «${c.perse[0]}»`
              : `${c.perse.length} voci non sono più a listino e non sono state rimesse: ${c.perse.slice(0, 3).join(", ")}`,
            { duration: 10000 },
          );
        toast.success("Modifica sbloccata", {
          description: "La configurazione è tornata com'era: cambia quello che serve e riconferma.",
        });
      } else {
        toast.error(
          j.reason === "not_configured" ? "Password non configurata nel CRM." : "Password errata.",
        );
      }
    };

    const askNew = async () => {
      const pwd = window.prompt("Inserisci la password per creare una nuova configurazione:");
      if (!pwd) return;
      const res = await fetch("/api/public/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: r.ref, password: pwd }),
      });
      const j = await res.json();
      if (j.ok) {
        window.location.href = "/preventivo";
      } else {
        toast.error(
          j.reason === "not_configured" ? "Password non configurata nel CRM." : "Password errata.",
        );
      }
    };

    const rPromo = new Date(r.promoUntil);
    const scadutoOra = rPromo.getTime() < Date.now();
    /*  C'è uno sconto su quello che paga OGGI? Solo allora ha senso parlare di
        un prezzo bloccato fino a una data.
        ⚠️ Si guardano gli EURO, non il fatto che un codice ci sia: il codice
         della garanzia vale zero oggi — fissa il prezzo del secondo impianto —
         e guardare solo «c'è un codice» accenderebbe la promessa sbagliata.
        ⚠️ E si escludono gli sconti quantità: quelli sono il listino per tre
         impianti, non una condizione data a questa persona. */
    const scontoDiOggi = (r.discounts ?? []).some(
      (d) => d.kind !== "qty" && Number(d.eur) > 0,
    );
    // L'elenco delle voci viene da un preventivo salvato: se manca (record
    // vecchio, snapshot arrivato a metà dalla diretta) qui esplodeva tutto il
    // documento. Si legge una volta sola da una lista che esiste per certo.
    const voci = Array.isArray(r.items) ? r.items : [];
    // Risparmio ottenuto sulle singole voci (listino → prezzo applicato):
    // `gross` li contiene già, quindi il listino VERO è gross + questo.
    const upsellSaving = voci.reduce(
      (t, i) =>
        t +
        Math.max(0, (Number(i.wasPrice) || 0) - (Number(i.price) || 0)) *
          Math.max(1, Number(r.qty) || 1),
      0,
    );
    // I totali arrivano dal database e non è detto che siano numeri: se `gross`
    // tornasse come stringa, "4900" + 300 diventerebbe "4900300" e il cliente
    // leggerebbe un listino inventato. Si coercono qui, una volta sola.
    const listinoTot = (Number(r.gross) || 0) + upsellSaving;
    const condizioniTot = (Number(r.discountEur) || 0) + upsellSaving;
    // `anchor`: SOTTO-ANCORA dentro una sezione molto alta. Più ancore = più
    // granularità: l'ospite si allinea al singolo blocco anche dentro elenchi
    // lunghi, senza dover indovinare un offset interno che sui due schermi non
    // corrisponde mai.
    const AddedItem = ({
      name,
      price,
      wasPrice,
      anchor,
    }: {
      name: string;
      price: number;
      wasPrice?: number;
      anchor?: string;
    }) => (
      <div
        data-hg-anchor={anchor}
        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          </span>
          {/* 14,5px al 90%: era 14px al 85% e su schermo luminoso, all'aperto,
              le voci si confondevano con le note. */}
          <span className="flex-1 text-[14.5px] leading-snug text-white/90">{name}</span>
          <PromoPrice price={price} wasPrice={wasPrice} />
        </div>
      </div>
    );

    /** ── L'AVVISO DI ANNULLAMENTO, SCRITTO UNA VOLTA SOLA ─────────────────
     *  Serve in due posti — sopra il preventivo consultabile e, da solo, quando
     *  il documento è stato spento — e in un caso è l'UNICA cosa che la persona
     *  legge. Scritto due volte, prima o poi le due copie si sarebbero dette
     *  cose diverse, e quella sbagliata sarebbe stata proprio la sola in
     *  pagina. */
    {
      /* ── QUESTO PREVENTIVO È STATO ANNULLATO ──────────────────────────
          ⚠️ QUESTO RIQUADRO HA CAMBIATO MESTIERE. Prima diceva «sei
           arrivato da un link vecchio, ecco quello nuovo» e sotto c'era già
           il preventivo NUOVO: si apriva un link salvato in chat e sotto gli
           occhi comparivano un altro prezzo e un altro numero. Adesso sotto
           c'è il preventivo che la persona ricorda, e questo riquadro dice
           l'unica cosa che quel documento non può dire da sé: che non vale
           più, e dove sta quello che vale.
          ROSSO E NON AZZURRO, ed è il punto: prima era un avviso di
          cortesia sopra un documento buono, adesso è l'unica cosa che
          impedisce a qualcuno di fare un bonifico contro un preventivo
          annullato. Il rosso in questa pagina non lo usa nient'altro.
          Il numero valido è un PULSANTE e non una riga di testo: chi arriva
          qui deve poter passare al documento buono con un dito, non copiare
          a mano un codice di sette caratteri. */
    }
    const avvisoAnnullato =
      annullatoDa && annullatoDa !== r.ref ? (
        <section className="hg-rise mb-5 overflow-hidden rounded-2xl border border-rose-400/40 bg-rose-500/[0.08]">
          <div className="flex flex-wrap items-start gap-3 px-4 py-4 sm:px-5">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-rose-300/40 bg-rose-500/15">
              <Ban className="h-5 w-5 text-rose-200" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold leading-snug text-white">
                Questo preventivo è stato annullato
              </h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-white/75">
                Il numero <b className="font-mono font-semibold text-white">{r.ref}</b>{" "}
                <b className="font-semibold text-white">non è più valido</b>: quello che leggi qui
                sotto è il documento che avevi ricevuto, tenuto apposta consultabile, ma il prezzo e
                le condizioni sono stati rifatti e non si possono più applicare.
              </p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-white/75">
                Il preventivo valido è{" "}
                <b className="font-mono font-semibold text-white">{annullatoDa}</b>.
              </p>
            </div>
          </div>
          {/*  L'indirizzo di quello valido, in chiaro e copiabile: il
              vecchio link resta in chat per sempre, e chi lo riapre deve
              poter sostituire quello che ha salvato senza ricostruirlo. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-rose-400/25 bg-rose-500/[0.06] px-4 py-3 sm:px-5">
            <a
              href={linkValido}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[13.5px] font-bold text-[#7f1d1d] transition hover:bg-rose-50"
            >
              Apri il preventivo valido <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <code className="min-w-0 flex-1 truncate rounded-lg border border-white/12 bg-black/25 px-2.5 py-1.5 font-mono text-[13px] text-white/75">
              {linkValido}
            </code>
            <button
              type="button"
              onClick={() => copy(linkValido, "Link")}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" /> Copia il link
            </button>
          </div>
        </section>
      ) : null;

    /** ── IL LINK SPENTO: RESTA L'AVVISO, SPARISCE IL DOCUMENTO ────────────
     *  Qui la pagina finisce prima. Niente prezzi, niente percorso, niente
     *  pulsante di pagamento: solo il riquadro rosso col numero valido e il
     *  suo link.
     *
     *  ⚠️ NON È UNA PAGINA D'ERRORE ED È IL PUNTO. Chi arriva ha in mano un
     *   link che gli abbiamo mandato noi: se trovasse «non trovato» penserebbe
     *   a un guasto e scriverebbe per chiedere spiegazioni. Trova invece detto
     *   per esteso che quel numero è stato annullato, qual è quello valido, e
     *   un pulsante per aprirlo — cioè esce da qui dove deve andare.
     *
     *  ⚠️ SI FERMA QUI E NON NASCONDE COL CSS: le sezioni sotto non vengono
     *   proprio costruite. Nasconderle avrebbe lasciato prezzi e condizioni
     *   nel foglio, leggibili a chiunque apra la pagina con due dita di
     *   curiosità — cioè avrebbe fatto sembrare fatto quello che non era. */
    if (soloAvviso && avvisoAnnullato) {
      return (
        <div className="bg-blueprint min-h-screen text-white">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/85 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-3">
              <a href="/" className="flex items-center">
                <BrandLogo className="h-6 w-auto" />
              </a>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-8">{avvisoAnnullato}</main>
        </div>
      );
    }

    return (
      <div className={`bg-blueprint min-h-screen text-white ${mirrorsState ? "live-viewer" : ""}`}>
        {lookupVeil}
        {veloGruppo}
        {bandaDelMio}
        {bandaGuardo}
        {viewerBanner}
        {presenterBar}
        {pointerOverlay}
        {pointerToggle}
        {cameraDelLink}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/85 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-3">
            <a href="/" className="flex items-center">
              <BrandLogo className="h-6 w-auto" />
            </a>
          </div>
        </header>
        {percheScade && <PercheScade until={rPromo} onClose={() => setPercheScade(false)} />}
        <main className="mx-auto max-w-3xl px-4 py-8">
          {avvisoAnnullato}

          {/* ── 1 · I DIECI SECONDI ───────────────────────────────────────
              Prima qui c'erano il totale, il listino barrato, la pillola del
              risparmio, i dati anagrafici e la CTA: cinque cose, e il prezzo
              affiancato dal barrato che lo faceva leggere come un saldo.
              Ora restano QUATTRO numeri e un pulsante — quanto costa, quanto
              esce adesso, quanto alla consegna, entro quando — e il totale si
              presenta NUDO: un prezzo da solo è un prezzo di listino, un prezzo
              accanto a un barrato è un prezzo scontato. Il risparmio esiste
              ancora, ma si incontra dopo, in forma di aritmetica. */}
          <section
            data-hg-anchor="res-cliente"
            className="relative mb-5 overflow-hidden rounded-3xl border border-brand/45 bg-gradient-to-br from-brand/[0.18] via-brand/[0.06] to-transparent px-5 py-6 sm:px-7 sm:py-7"
          >
            <span
              aria-hidden
              className="hg-aurora pointer-events-none absolute -top-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-brand/25 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent"
            />
            <div className="relative">
              {/*  ⚠️ IL BOLLO STA ATTACCATO AL NUMERO, non solo nel riquadro in
                   cima: questa pagina si stampa e si manda in PDF, e in un
                   foglio stampato il riquadro rosso finisce alla prima pagina
                   mentre il numero si rilegge dappertutto. Chi ha in mano il
                   foglio deve poter vedere accanto al codice che quel codice non
                   vale più. */}
              <p className="hg-rise flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brand">
                {/*  ⚠️ DUE CODICI, E FANNO DUE MESTIERI. Il numero è come il
                     preventivo si chiama; il ref è dove ABITA — sta nel link e
                     va nella causale del bonifico, ed è per questo che resta
                     l'ultimo della riga, attaccato alla parola «ordine» che il
                     cliente ritroverà sul bonifico e sulla fattura. */}
                {numeroPrev && <span>Preventivo n. {numeroPrev}</span>}
                <span>
                  {numeroPrev ? "· Ordine" : "Preventivo"} {r.ref}
                </span>
                {annullatoDa && annullatoDa !== r.ref && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/50 bg-rose-500/15 px-2 py-[3px] text-[10px] font-bold tracking-[0.16em] text-rose-200">
                    <Ban className="h-3 w-3" /> Annullato
                  </span>
                )}
              </p>
              <h1
                className="hg-rise mt-1.5 text-[22px] font-bold leading-tight tracking-tight sm:text-[26px]"
                style={{ animationDelay: "60ms" }}
              >
                {r.baseName}
                {r.qty > 1 ? ` × ${r.qty}` : ""}
              </h1>
              {(r.nome || r.cognome) && (
                <p
                  className="hg-rise mt-1 text-[14px] text-white/65"
                  style={{ animationDelay: "90ms" }}
                >
                  Intestato a{" "}
                  <b className="font-semibold text-white/90">
                    {r.nome} {r.cognome}
                  </b>
                  {r.eta && <span className="text-white/55">, {r.eta} anni</span>}
                </p>
              )}

              {/* ── LE ETICHETTE PICCOLE RESTANO PICCOLE, MA SI LEGGONO ──────
                  Sopra un numero da 44px una parola da 14px non è gerarchia, è
                  rumore: l'occhio deve prendere prima la cifra. Quindi le
                  soprascritte (“Totale”, “Ora”, “Alla consegna”) restano
                  minute — ma salgono di contrasto, perché un grigio al 45% su
                  fondo scuro a cinquant'anni semplicemente non c'è. */}
              <p
                className="hg-rise mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60"
                style={{ animationDelay: "120ms" }}
              >
                Totale
              </p>
              <p
                className="hg-rise hg-price-pop text-[44px] font-extrabold leading-none tracking-tight text-white sm:text-[52px]"
                style={{ animationDelay: "150ms" }}
              >
                {formatPrice(r.total)}
              </p>

              {/* due celle, un filo in mezzo: è tutta l'aritmetica che serve ora */}
              <div
                className="hg-rise mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]"
                style={{ animationDelay: "200ms" }}
              >
                <div className="border-r border-white/10 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                    Ora
                  </p>
                  <p className="mt-1 text-[24px] font-bold leading-none tabular-nums text-white">
                    {formatPrice(r.acconto)}
                  </p>
                  <p className="mt-1.5 text-[13.5px] leading-snug text-white/60">
                    acconto, scalato dal totale
                  </p>
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    {r.installOn === false ? "Prima della spedizione" : "Alla consegna"}
                  </p>
                  <p className="mt-1 text-[24px] font-bold leading-none tabular-nums text-white">
                    {formatPrice(Math.max(0, r.total - r.acconto))}
                  </p>
                  <p className="mt-1.5 text-[13.5px] leading-snug text-white/60">
                    {r.installOn === false
                      ? "il resto con bonifico bancario"
                      : "il resto, quando lo ricevi"}
                  </p>
                </div>
              </div>

              {/* ── IL PULSANTE PRINCIPALE ─────────────────────────────────
                  ⚠️ SU UN PREVENTIVO ANNULLATO NON PORTA A PAGARE, e non è una
                   precauzione teorica: il riquadro rosso sta in cima, ma questo
                   pulsante è la prima cosa che si tocca scorrendo — e chi lo
                   tocca finisce sull'IBAN con una causale che cita un numero
                   morto. Un bonifico così arriva davvero, e poi va riconciliato
                   a mano contro un documento che non esiste più.
                   Al suo posto porta al preventivo valido: stessa posizione,
                   stesso peso, un altro colore. Chi voleva pagare continua ad
                   avere UN pulsante da premere — semplicemente lo porta dove i
                   soldi si possono prendere davvero. */}
              {annullatoDa && annullatoDa !== r.ref ? (
                <a
                  href={linkValido}
                  onClick={() => sfx.select()}
                  className="hg-rise relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border border-rose-400/40 bg-rose-500/15 px-5 py-4 text-[15px] font-bold text-white transition hover:bg-rose-500/25 print:hidden"
                  style={{ animationDelay: "250ms" }}
                >
                  <span className="relative z-10 flex flex-wrap items-center justify-center gap-x-2">
                    Apri il preventivo valido
                    <span className="font-mono">{annullatoDa}</span>
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </a>
              ) : (
                <a
                  href="#res-pagamento"
                  onClick={() => sfx.select()}
                  className="hg-cta-glow hg-rise relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-brand px-5 py-4 text-[15px] font-bold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 print:hidden"
                  style={{ animationDelay: "250ms" }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Versa l&apos;acconto di {formatPrice(r.acconto)}{" "}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </a>
              )}

              {/* ── LA RIGA DELLA SCADENZA ───────────────────────────────────
                  Era 12px al 45%: la data entro cui il prezzo tiene — cioè
                  l'informazione che decide se leggere oggi o rimandare — stava
                  scritta più in piccolo di tutto il resto. Ora è 14px con
                  contrasto pieno, e il pulsante “perché?” è abbastanza alto da
                  centrarlo col pollice al primo tentativo.

                  ⚠️ E COMPARE SOLO SE C'È DAVVERO UNO SCONTO SU QUESTO
                   PREVENTIVO. Segnalazione del committente: «non deve essere
                   mostrato sempre, ma solo se metto il codice sconto della
                   video testimonianza — e non basta quello sul secondo
                   impianto, perché in quel caso non ci sono sconti
                   sull'impianto che paga oggi».
                   «Prezzo bloccato fino al…» è una promessa su quello che sta
                   per pagare, e su un preventivo a listino non l'ha fatta
                   nessuno: scriverla lo stesso vuol dire impegnarsi a una
                   cifra che può cambiare, con la data stampata sul documento.
                   ⚠️ Il codice della garanzia NON la fa comparire: quel codice
                    vale zero euro oggi (fissa il prezzo del SECONDO impianto),
                    e `eur > 0` è proprio ciò che lo distingue. Guardare solo
                    «c'è un codice» avrebbe acceso la promessa sbagliata. */}
              <p
                hidden={!scontoDiOggi}
                className="hg-rise mt-3.5 text-[14px] leading-relaxed text-white/60"
                style={{ animationDelay: "300ms" }}
              >
                {scadutoOra ? (
                  <span className="text-red-200/85">
                    I prezzi di questo preventivo sono quelli del {formatDeadline(rPromo)} e non
                    sono più impegnativi.
                  </span>
                ) : (
                  <>
                    {/* Cliccabile: la data da sola non dice PERCHÉ, e il perché
                          è la parte che rende credibile la data. */}
                    <button
                      type="button"
                      onClick={() => setPercheScade(true)}
                      className="hg-shine mr-1 inline-flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-400/[0.10] px-2.5 py-1.5 align-middle text-[14px] font-medium text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-400/15"
                    >
                      Prezzo bloccato fino al{" "}
                      <b className="font-bold text-white">{formatDeadline(rPromo)}</b>
                      <span className="rounded-full bg-amber-300/25 px-2 py-0.5 text-[12px] font-bold text-amber-100">
                        perché?
                      </span>
                    </button>
                    {/*  ── COME SI PAGA VA A CAPO ────────────────────────────
                          Di fianco al pulsante sembrava una nota del "perché?",
                          e si leggeva come una precisazione sulla scadenza. È
                          invece un'informazione a sé — e per molti la più
                          rassicurante: non si lascia nessuna carta. Su una riga
                          sua, con il suo respiro, si vede.
                          "Bancario" e non "ordinario": ordinario è il termine
                          della banca (contrapposto a istantaneo), e a chi legge
                          non dice niente. */}
                    <span className="mt-1.5 block text-[14px] text-white/60">
                      Bonifico bancario, nessuna carta richiesta.
                    </span>
                  </>
                )}
              </p>
            </div>
          </section>

          {/* ── LA FATTURA DELL'ACCONTO ──────────────────────────────────
              ⚠️ STA QUI E NON PIÙ NEL CONFIGURATORE, e il motivo è che qui
               l'ordine ESISTE: ha un numero (IDQY6EF) e una cifra. Nel
               configuratore il preventivo non era ancora nato, quindi la
               causale non poteva citarlo — e una fattura di acconto senza il
               riferimento all'ordine è proprio quella che non si riesce a
               riconciliare leggendo l'estratto conto.
              ⚠️ E si emette, non si abbozza: scelta del committente. La nota su
               cosa comporta sta in cima a shop/bozza-fattura.
              Solo per il consulente: `isViewer` è chi guarda la diretta,
              `isClient` è il cliente sul suo telefono. Nessuno dei due deve
              vedere un modulo che parla di fatturazione. */}
          {!isViewer && !isClient && (
            <BozzaFattura
              profilo={{ nome: r.nome, cognome: r.cognome, email: r.email }}
              //  ⚠️ IL TOTALE, non l'acconto: la bozza copre l'intera pratica
              //   e la cifra si corregge quando la si emette, dichiarando se il
              //   cliente ha versato tutto o solo una parte. Stessa scelta della
              //   bozza creata da sola alla conferma del preventivo.
              acconto={r.total}
              ref={r.ref}
              //  La stessa frase scritta sopra, accanto all'IBAN: due causali
              //  diverse sulla stessa schermata sono un bonifico che non si lega.
              causale={causale}
              //  Quello che è già stato chiesto al cliente qualche schermata
              //  fa: se c'è, il pannello si apre pieno e resta un tocco.
              //  ⚠️ Vuoto aprendo un preventivo da un link salvato, ed è
              //   giusto: di quei campi, allora, non si sa niente.
              iniziali={{
                codiceFiscale: profile.codiceFiscale,
                indirizzo: profile.indirizzo,
                civico: profile.civico,
                cap: profile.cap,
                comune: profile.comune,
                provincia: profile.provincia,
              }}
              formatPrice={formatPrice}
              inputCls="w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/35 focus:bg-white/[0.08] focus:outline-none"
            />
          )}

          {/* il consulente lavora sul documento, davanti al cliente */}
          {!isViewer && !isClient && (
            <ConsultantPanel
              base={baseSnapRef.current ?? r}
              snap={r}
              edit={quoteEdit}
              qtyDisc={qtyDiscounts}
              //  Il listino di OGGI, con dentro gli override del CRM: serve al
              //  pannello per poter rifare il preventivo ai prezzi correnti.
              menu={menu}
              annullatoDa={annullatoDa}
              linkValido={linkValido}
              onSostituito={(nuovo, precedente) => {
                //  ── IL PREVENTIVO NUOVO PRENDE IL POSTO DI QUELLO VECCHIO ──
                //   Non è una modifica applicata a quello che c'era: è un altro
                //   documento, e da qui in poi è LUI l'originale. Quindi
                //   `baseSnapRef` diventa questo e la modifica affiancata si
                //   azzera — i suoi valori sono ormai dentro la riga.
                baseSnapRef.current = nuovo;
                editSigRef.current = "";
                setQuoteEdit(null);
                setResult(nuovo);
                setQuoteRef(nuovo.ref);
                pinnedRef.current = nuovo.ref;
                //  L'indirizzo cambia SUBITO, mentre il consulente guarda lo
                //  schermo: è quello che copia e manda, e se restasse indietro
                //  manderebbe al cliente il numero che ha appena disattivato.
                try {
                  const u = new URL(window.location.href);
                  u.searchParams.set("id", nuovo.ref);
                  u.searchParams.delete("ref");
                  window.history.replaceState({}, "", u.toString());
                } catch {
                  /* l'indirizzo resta indietro: il numero giusto è comunque a schermo */
                }
                //  ── LE DUE ANTEPRIME ────────────────────────────────────────
                //   Quella del numero NUOVO, perché è il link che parte adesso.
                //   E quella del numero VECCHIO, che al cliente è già arrivato
                //   in chat: quel link porta qui, ma il riquadro che WhatsApp
                //   mostra accanto è un'immagine depositata sotto il vecchio
                //   numero, e lì c'è ancora scritto il prezzo di prima. Si
                //   ridisegna con la cifra nuova, così le due cose dicono la
                //   stessa cosa. Nessuna delle due si aspetta: sono rifiniture,
                //   e il preventivo è già salvato.
                const dati = {
                  nome: nuovo.nome,
                  cognome: nuovo.cognome,
                  totale: nuovo.total,
                  base: nuovo.baseName,
                  quantita: nuovo.qty,
                  prezzoPieno: Number(nuovo.gross) || 0,
                };
                void depositaAnteprimaPreventivo({ ref: nuovo.ref, ...dati });
                if (precedente && precedente !== nuovo.ref)
                  void depositaAnteprimaPreventivo({ ref: precedente, ...dati });
              }}
            />
          )}

          {/* ── SCHEDA INTERNA ────────────────────────────────────────────
              Allergie, patologie e accordi presi. Non è mai parte del
              documento del cliente: non compare sul suo schermo, non finisce
              nel PDF, e in stampa sparisce. Sta qui perché è dove il
              consulente guarda prima di parlare. */}
          {!isViewer && !isClient && (r.problemi || (quoteEdit?.notes ?? []).length > 0) && (
            <section className="mb-5 overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] print:hidden">
              <div className="flex items-center gap-2 border-b border-amber-400/15 px-4 py-2.5">
                <StickyNote className="h-4 w-4 text-amber-300" />
                <span className="text-[13px] font-semibold text-white">Scheda interna</span>
                <span className="ml-auto text-[11px] text-white/35">non visibile al cliente</span>
              </div>
              {r.problemi && (
                <div className="border-b border-amber-400/10 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/70">
                    Dichiarato dal cliente
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-white/80">
                    {r.problemi}
                  </p>
                </div>
              )}
              {(quoteEdit?.notes ?? []).length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Note di consulenza
                  </p>
                  <ul className="mt-2 space-y-2">
                    {(quoteEdit?.notes ?? []).map((n, i) => (
                      <li
                        key={`${n.at}-${i}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">
                          {n.text}
                        </p>
                        <p className="mt-1 text-[11px] text-white/35">
                          {new Date(n.at).toLocaleString("it-IT")}
                          {n.by ? ` · ${n.by}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ── 2 · IL GESTO ──────────────────────────────────────────────
              Il bonifico stava in fondo, dopo otto blocchi. Chi ha deciso in
              alto deve poter agire con UNO scorrimento. E l'ultima obiezione,
              qui, non è il prezzo: è "cosa succede dopo che ho mandato i
              soldi" — per questo il percorso è la riga di chiusura di questo
              blocco, non un cartellone tre schermate prima. */}
          <section
            id="res-pagamento"
            data-hg-anchor="res-bonifico"
            className="mb-5 scroll-mt-4 overflow-hidden rounded-2xl border border-brand/35 bg-brand/[0.05]"
          >
            {/* Tutte le intestazioni di sezione del documento stanno a 17px:
                se una sola cresce, le altre sembrano meno importanti — ed è la
                gerarchia, non la dimensione assoluta, a dire cosa leggere prima. */}
            <h2 className="flex items-center gap-2.5 border-b border-white/[0.07] px-4 py-3.5 text-[17px] font-bold">
              <Landmark className="h-[18px] w-[18px] flex-shrink-0 text-brand" /> Acconto di{" "}
              {formatPrice(r.acconto)}
            </h2>
            {/* ── NON FARE QUESTO BONIFICO ─────────────────────────────────
                Le coordinate restano a schermo: questo è il documento che la
                persona ha ricevuto, e cancellarne dei pezzi vorrebbe dire non
                mostrarglielo davvero — che è l'opposto di quello che il
                committente ha chiesto.
                ⚠️ MA LA CAUSALE CITA UN NUMERO MORTO, e una causale è
                 precisamente il filo con cui un bonifico viene riconosciuto: un
                 versamento arrivato con dentro un preventivo annullato si
                 riconcilia a mano, con una telefonata, e nel frattempo il
                 cliente crede di aver pagato. Quindi la riga sta SOPRA le
                 coordinate, non sotto: dopo l'IBAN sarebbe già stato copiato. */}
            {annullatoDa && annullatoDa !== r.ref && (
              <p className="flex items-start gap-2.5 border-b border-rose-400/25 bg-rose-500/[0.10] px-4 py-3 text-[14px] leading-relaxed text-rose-50">
                <Ban className="mt-[3px] h-4 w-4 flex-shrink-0 text-rose-300" />
                <span className="min-w-0">
                  <b className="font-semibold text-white">Non fare questo bonifico.</b> Questo
                  preventivo è annullato: la causale qui sotto cita un numero che non è più valido.
                  L&apos;importo e la causale da usare sono sul preventivo{" "}
                  <a href={linkValido} className="font-mono font-semibold text-white underline">
                    {annullatoDa}
                  </a>
                  .
                </span>
              </p>
            )}
            <dl className="space-y-2.5 px-4 py-4">
              <Row
                label="Intestatario"
                value={BANK.intestatario}
                onCopy={() => copy(BANK.intestatario, "Intestatario")}
              />
              <Row
                label="IBAN"
                value={BANK.iban}
                mono
                onCopy={() => copy(BANK.iban.replace(/\s/g, ""), "IBAN")}
              />
              <Row
                label="Causale"
                value={causale}
                highlight
                onCopy={() => copy(causale, "Causale")}
              />
            </dl>
            <p className="px-4 pb-4 text-[14px] leading-relaxed text-white/60">
              La causale deve essere esatta: è così che il bonifico risulta collegato a questo
              preventivo.
            </p>
            <button
              type="button"
              //  Spento dalle impostazioni: il riquadro non si apre e il
              //  pulsante non c'è (vedi `acceso`).
              hidden={!acceso("percorso")}
              onClick={() => {
                sfx.page("percorso");
                setPercorsoOpen(true);
              }}
              data-hg-anchor="res-percorso"
              className="hg-shine group flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-brand/25 bg-gradient-to-r from-brand/[0.10] to-transparent px-4 py-3.5 text-left transition hover:from-brand/[0.16] print:hidden"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/20 text-brand">
                <RouteIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 text-[14px] leading-snug text-white/70">
                Dopo l&apos;acconto:{" "}
                <b className="font-semibold text-white">
                  selfie → progetto → prova → installazione
                </b>
              </span>
              <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-lg shadow-brand/25 transition group-hover:brightness-110">
                Vedi le date{" "}
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
          </section>

          {/* ── 3 · LA VERIFICA ───────────────────────────────────────────
              Un elenco piatto, prezzi incolonnati, e in fondo l'UNICA riga in
              cui listino e risparmio compaiono insieme: forma da fattura, non
              da volantino. È qui che il risparmio si dice una volta sola —
              prima era dichiarato in quattro punti diversi. */}
          <section
            data-hg-anchor="res-scelta"
            className="mb-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
          >
            {/* Titolo di sezione più alto e voci più grandi: è la parte che il
                cliente rilegge prima di pagare, e va letta senza avvicinare
                il telefono agli occhi. Nessuna voce sotto i 14px. */}
            <h2 className="mb-3.5 text-[17px] font-bold">Cosa comprende</h2>
            <div
              data-hg-anchor="res-scelta-base"
              className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] pb-3"
            >
              <span className="min-w-0">
                <span className="block text-[15.5px] font-semibold leading-snug text-white">
                  {r.baseName}
                  {r.qty > 1 ? ` × ${r.qty}` : ""}
                </span>
                {/*  La lunghezza dei capelli è una caratteristica dell'impianto, e
                    si scrive sotto il suo nome. Il trapianto non ce l'ha: là i
                    capelli sono i suoi e ricrescono.
                    ⚠️ QUI C'ERA ANCHE `garanzia.mostra`, e non c'entrava niente:
                     quella condizione nasce per il riquadro dell'assistenza (più
                     sotto), e in un rimaneggiamento è rimasta attaccata a questa
                     riga. Effetto: un codice che diceva «non mostrare la
                     garanzia» faceva sparire «capelli 45 cm» e lasciava il
                     riquadro dell'assistenza al suo posto — cioè esattamente il
                     contrario di quello che era stato chiesto. */}
                {!r.baseName?.toLowerCase().includes("trapianto") && (
                  <span className="mt-0.5 block text-[14px] text-white/60">
                    capelli {HAIR_LENGTH_CM} cm
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 text-[15.5px] font-semibold tabular-nums text-white">
                {formatPrice(r.basePrice)}
              </span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {voci.map((u, i) => (
                <AddedItem
                  key={i}
                  anchor={`res-item-${i}`}
                  name={u.name}
                  price={u.price}
                  wasPrice={u.wasPrice}
                />
              ))}
              <AddedItem anchor="res-item-fitting" name={r.fittingName} price={r.fittingPrice} />
            </div>
            {/* ── IL CONTO, IN COLONNA ─────────────────────────────────────
                Prima listino e condizioni stavano su UNA riga di 12,5px al
                45% di bianco, separati da un puntino, col totale schiacciato
                a destra sulla stessa linea. Tre informazioni diverse con lo
                stesso peso e nessun allineamento: a cinquant'anni, sul
                telefono, quella riga non si legge — si salta.
                Ora è una colonna da fattura: ogni voce sulla sua riga, gli
                importi incolonnati (tabular-nums), e il totale staccato da un
                filo e più grande di tutto. Chi legge di fretta prende solo il
                totale; chi vuole verificare rifà il conto dall'alto in basso.
                I numeri sono gli stessi di prima: cambia solo come si vedono. */}
            <div data-hg-anchor="res-totale" className="mt-4 border-t border-white/12 pt-3">
              <div className="flex items-baseline justify-between gap-4 py-[3px]">
                <span className="text-[14.5px] text-white/60">Listino</span>
                <span className="text-[15px] tabular-nums text-white/70">
                  {formatPrice(listinoTot)}
                </span>
              </div>
              {condizioniTot > 0 && (
                <div className="flex items-baseline justify-between gap-4 py-[3px]">
                  <span className="text-[14.5px] text-white/60">Condizioni applicate</span>
                  <span className="text-[15px] font-semibold tabular-nums text-emerald-300">
                    −{formatPrice(condizioniTot)}
                  </span>
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-white/12 pt-3">
                <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/65">
                  Totale
                </span>
                <span className="text-[30px] font-extrabold leading-none tabular-nums text-white">
                  {formatPrice(r.total)}
                </span>
              </div>
            </div>
          </section>

          {/* ── 4 · PERCHÉ QUESTO PREZZO ──────────────────────────────────
              Tre condizioni con tre meccaniche diverse e dichiarate. È la
              differenza fra le tre che le rende credibili: sconti che scadono
              tutti insieme lo stesso giorno sembrano montati ad arte. */}
          <CondizioniApplicate r={r} />

          {/* ── 5 · L'ULTIMO DUBBIO ───────────────────────────────────────
              "E se poi si rovina?" — sta qui perché chi ha già copiato l'IBAN
              non lo leggerà, e va benissimo così.

              ── ⚠️ TRE MODI DI NON MOSTRARLO, E SONO TRE COSE DIVERSE ───────
              · IL TRAPIANTO non ha un impianto da rigenerare: lì il riquadro
                non ha senso, e nessuna impostazione può farlo comparire.
              · L'INTERRUTTORE DEL LISTINO (`acceso("garanzia")`) lo toglie a
                tutti i preventivi di questo consulente: è la richiesta «fai che
                posso disattivare questa garanzia dal preventivo», e si trova
                dove si trovano le altre parti spegnibili della pagina.
              · UN CODICE PROMOZIONALE può toglierlo su un preventivo solo, o
                cambiarne la cifra (vedi shop/garanzia-codici): `garanziaDa`
                guarda i codici applicati, nell'ordine in cui sono stati
                applicati, e comanda il primo che dice qualcosa.
              ⚠️ NESSUNO CHE DICA NIENTE = COMPORTAMENTO DI SEMPRE: il riquadro
               si vede, al prezzo di listino. Un'assenza di configurazione non
               deve poter far sparire dal preventivo una cosa che il cliente si
               aspetta di leggere. */}
          {!r.baseName?.toLowerCase().includes("trapianto") && garanzia.mostra && acceso("garanzia") && (
            <section
              data-hg-anchor="res-garanzia"
              className="mb-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
            >
              <h2 className="flex items-center gap-2.5 text-[17px] font-bold">
                <BadgeCheck className="hg-icon-in h-[18px] w-[18px] flex-shrink-0 text-emerald-300" />{" "}
                {menu.manutenzione.title}
              </h2>
              {/* Quattro voci a 13px al 70% erano un paragrafo diviso in quattro:
                  stessa densità, stesso grigio, nessuna presa per l'occhio. Ora
                  il titolo della voce va A CAPO sopra la spiegazione — si può
                  leggere solo la prima riga di ognuna e sapere già cosa si
                  riceve — e il corpo sta a 14px con interlinea larga. */}
              <div className="mt-3.5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {menu.manutenzione.items.map((it, i) => (
                  <div
                    key={it.t}
                    className="hg-pop flex gap-2.5"
                    style={{ animationDelay: `${80 + i * 60}ms` }}
                  >
                    <Check className="mt-[3px] h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <p className="min-w-0 text-[14px] leading-relaxed text-white/65">
                      <b className="block font-semibold text-white">{it.t}</b>
                      {it.d}
                    </p>
                  </div>
                ))}
              </div>
              {/* ── QUANTO COSTA, DOPO ───────────────────────────────────
                  Era una riga di testo tenue (12px, bianco al 40%) in coda
                  alla scheda: la cifra che il cliente deve portarsi a casa
                  aveva lo stesso peso della nota che la circondava, e a
                  braccio teso sul telefono spariva del tutto.
                  Ora è UN blocco solo, che si legge in un colpo nell'ordine
                  in cui la domanda si forma: QUANTO (la cifra, grande e
                  piena), PER COSA (rigenerato o rifatto da capo, stesso
                  prezzo), ENTRO QUANDO (mai: non scade).
                  Il testo attorno è corto di proposito — accanto a un
                  paragrafo lungo un numero grande non sembra importante,
                  sembra un errore di impaginazione.
                  La cifra viene dal listino (menu.manutenzione), non riscritta a mano:
                  se il listino cambia, cambia anche qui. */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06]">
                {/*  ── LA CIFRA, E ACCANTO COSA COMPRA ────────────────────
                    Due colonne e non una riga di prosa: a sinistra il prezzo,
                    a destra i DUE fatti che lo definiscono — quanti interventi
                    e per quanto tempo — uno per riga, ognuno di tre parole.
                    ⚠️ QUI C'ERA UNA FRASE LUNGA in fondo alla scheda, e non era
                     solo lunga: era dentro un `flex-wrap` con l'icona, quindi
                     appena il testo superava la riga il calendario restava da
                     solo in cima e le parole andavano sotto. Sembrava un errore
                     di impaginazione, ed era esattamente quello.
                    Tre parole per riga non vanno a capo mai, su nessuno
                    schermo: il difetto sparisce perché sparisce la causa. */}
                {/*  ── ⚠️ L'OFFERTA, QUANDO UN CODICE LA PORTA ────────────
                     Richiesta del committente: «posso impostare importo fisso
                     sulla garanzia 15 mesi e dice esplicitamente poi sulla
                     garanzia che è limitata con i posti e data».
                     Sta SOPRA la cifra e non sotto, perché è la cosa che
                     cambia il significato del numero che si sta per leggere.
                     E dice solo quello che è vero: posti e data escono da
                     `limiteInParole`, che con nessuno dei due torna vuoto —
                     una scarsità dichiarata e non dimostrata fa perdere
                     fiducia più in fretta di un prezzo alto. */}
                {/*  ⚠️ QUI C'ERA LA FASCIA DELL'OFFERTA. È andata in fondo al
                     documento, in un riquadro suo (`SecondoImpianto`): questo
                     riquadro parla di quanto costa l'assistenza, quello parla
                     del prossimo acquisto, e affiancarli faceva leggere il
                     secondo prezzo come una correzione del primo. */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                      Importo
                    </p>
                    {/* 40px sul telefono: si legge a braccio teso, ma resta un
                        gradino SOTTO il totale in cima (44/52px). Se la cifra
                        dell'assistenza pareggia il prezzo dell'impianto, il
                        cliente smette di guardare l'impianto e comincia a
                        chiedersi quanto gli costerà tenerlo. */}
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-white sm:text-[46px]">
                      {/*  Il prezzo di prima BARRATO, e solo quando è davvero
                           più alto: barrare una cifra uguale (o più bassa) è
                           il modo più rapido di far sembrare finta una
                           promozione vera. */}
                      {offertaGaranzia && menu.manutenzione.price > garanzia.importo && (
                        <span className="text-[20px] font-semibold text-white/35 line-through sm:text-[22px]">
                          {formatPrice(menu.manutenzione.price)}
                        </span>
                      )}
                      {formatPrice(garanzia.importo)}
                    </p>
                  </div>

                  {/*  Il filetto verticale separa il prezzo da ciò che compra
                      senza aggiungere un riquadro dentro un riquadro. Sparisce
                      sul telefono, dove le due parti si impilano e il filetto
                      taglierebbe per il verso sbagliato. */}
                  <span className="hidden h-12 w-px self-center bg-emerald-400/25 sm:block" />

                  <ul className="min-w-[11rem] flex-1 space-y-2">
                    <li className="flex items-center gap-2.5 text-[15.5px] leading-snug text-white/85">
                      <Check className="h-[18px] w-[18px] flex-shrink-0 text-emerald-300" />
                      <span>
                        <b className="font-semibold text-white">Un intervento</b> compreso
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5 text-[15.5px] leading-snug text-white/85">
                      <CalendarClock className="h-[18px] w-[18px] flex-shrink-0 text-emerald-300" />
                      <span>
                        entro{" "}
                        <b className="font-semibold text-white">{menu.manutenzione.everyMonths} mesi</b>
                      </span>
                    </li>
                  </ul>
                </div>

                {/*  E COSA SUCCEDE DOPO — la sola cosa che resta da dire, su una
                    riga sua. `items-start` con l'icona `flex-shrink-0` e il testo
                    in un blocco a parte: andando a capo il testo scorre SOTTO SE
                    STESSO e non sotto l'icona, che è il difetto di prima. */}
                <p className="flex items-start gap-2.5 border-t border-emerald-400/25 bg-emerald-400/[0.04] px-4 py-3 text-[14px] leading-relaxed text-emerald-50/80 sm:px-5">
                  <RefreshCw className="mt-[3px] h-4 w-4 flex-shrink-0 text-emerald-300/80" />
                  <span className="min-w-0">
                    Per altri interventi nello stesso periodo si ripaga l&apos;importo.
                  </span>
                </p>
                              </div>
            </section>
          )}

          {/* ── 6 · PIEDE DEL DOCUMENTO ───────────────────────────────────
              I dati del cliente sono una conferma, non una notizia: stavano in
              apertura e occupavano lo spazio della decisione. */}
          {/*  ── ⚠️ IL PREZZO DEL SECONDO IMPIANTO, IN FONDO ──────────────
               Richiesta del committente: «deve uscire anche sul preventivo
               creato che il secondo impianto ha quel costo; crea in fondo al
               preventivo, con design moderno, con anche quando scade la promo,
               i posti».
               In fondo e non in mezzo: è la cosa che si legge DOPO aver
               deciso su questo impianto, e messa più in alto competerebbe con
               il prezzo di oggi invece di aggiungersi.
               ⚠️ La data si conta dal giorno in cui il preventivo è NATO, non
                da oggi: su un documento già consegnato la scadenza non deve
                muoversi ogni volta che lo si riapre. */}
          {offertaGaranzia && (
            <SecondoImpianto
              offerta={offertaGaranzia}
              pieno={gross}
              da={r.timelineStart ? new Date(r.timelineStart) : undefined}
              variante="preventivo"
            />
          )}

          <div
            data-hg-anchor="res-azioni"
            className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-white/10 pt-5"
          >
            <div className="min-w-0">
              {/* I recapiti sono la riga su cui il cliente controlla che sia
                  proprio il SUO preventivo: al 30% di bianco non si controlla
                  niente. Restano in coda — è il posto giusto — ma leggibili. */}
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Recapiti
              </p>
              <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-white/60">
                {r.email && <span className="break-all">{r.email}</span>}
                {r.telefono && <span className="tabular-nums">{r.telefono}</span>}
                <span className="font-mono text-white/45">{r.ref}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => {
                  // ── COME SI CHIAMA IL FILE ──────────────────────────────
                  //  Il browser usa il titolo della pagina come nome del PDF.
                  //  Si scrive per un attimo un titolo da documento — azienda,
                  //  tipo, intestatario, numero, data — e si rimette subito
                  //  quello di prima: il cliente si ritrova in cartella un file
                  //  riconoscibile fra mille, non "Componi il tuo preventivo".
                  const prec = document.title;
                  const pulito = (t: string) =>
                    t
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^A-Za-z0-9 ]/g, "")
                      .trim()
                      .replace(/\s+/g, "-");
                  const cliente = pulito(`${r.nome} ${r.cognome}`) || "Cliente";
                  const d = new Date();
                  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  document.title = `HairGeniusLabs_Preventivo_${cliente}_${r.ref}_${data}`;
                  window.print();
                  setTimeout(() => {
                    document.title = prec;
                  }, 1200);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5" /> Scarica PDF
              </button>
              {!isViewer && !isClient && (
                <>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-[14px] font-medium text-[#8ff0b5] transition hover:bg-[#25D366]/20"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Invia al cliente
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(shareLink, "Link cliente")}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-white/10"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copia link
                  </button>
                  <button
                    type="button"
                    onClick={askEdit}
                    title="Modifica preventivo (richiede password)"
                    aria-label="Modifica preventivo"
                    className="relative inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white transition hover:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <Lock className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#081634] p-[1px] text-white/50" />
                  </button>
                  <button
                    type="button"
                    onClick={askNew}
                    title="Nuova configurazione (richiede password)"
                    aria-label="Nuova configurazione"
                    className="relative inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white transition hover:bg-white/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <Lock className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#081634] p-[1px] text-white/50" />
                  </button>
                </>
              )}
            </div>
          </div>
        </main>

        {/* VISTA "IL TUO PERCORSO" — schermata intera (non è un popup): la X
            riporta al preventivo creato. UNA sola vista, UN solo stato, UN solo
            contenitore scrollabile mirrorato (data-hg-scroll="percorso"). */}
        {percorsoOpen && (
          <div
            data-hg-scroll="percorso"
            className="bg-blueprint fixed inset-0 z-[60] overflow-y-auto text-white print:hidden"
          >
            <header className="sticky top-0 z-10 border-b border-white/10 bg-[#081634]/90 backdrop-blur">
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
                <BrandLogo className="h-6 w-auto" />
                <div className="flex items-center gap-2">
                  <a
                    href={`/percorso?id=${r.ref}&print=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => setPercorsoOpen(false)}
                    aria-label="Chiudi"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-3xl px-4 py-8">
              <section data-hg-anchor="percorso-intro" className="mb-8 text-center">
                <p className="text-[11px] uppercase tracking-[0.25em] text-brand">
                  Il tuo percorso
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                  Dal selfie all'installazione, passo per passo
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-white/60">
                  Cinque passi in tutto: nei primi due tocca a te mandarci qualcosa, nei due dopo
                  lavoriamo noi e tu aspetti, l'ultimo lo facciamo insieme. Qui sotto vedi a che
                  punto sei e la data di ogni passo.
                </p>
                <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
                  <span className="font-mono text-brand">{r.ref}</span>
                  <span className="text-white/50">
                    Inizio: {formatDeadline(new Date(r.timelineStart))}
                  </span>
                </div>
              </section>
              {r.baseName?.toLowerCase().includes("trapianto") ? (
                <TransplantTimeline />
              ) : (
                <PercorsoTimeline start={new Date(r.timelineStart)} steps={r.steps} />
              )}
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPercorsoOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium transition hover:bg-white/10"
                >
                  <CalendarClock className="h-4 w-4" /> Torna al preventivo
                </button>
              </div>
            </main>
          </div>
        )}

        <Toaster />
      </div>
    );
  }

  if (loadingRef) {
    return (
      <div className="bg-blueprint flex min-h-screen items-center justify-center text-white/60">
        Caricamento preventivo…
      </div>
    );
  }

  // Link solo-preventivo di una consulenza ormai chiusa: si dice chiaramente,
  // invece di lasciare il cliente su una pagina che non è più collegata a nessuno.
  if (isClient && clientSess && sessDead) {
    return (
      <div className="bg-blueprint flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-white">
        <BrandLogo className="h-8 w-auto" />
        <h1 className="text-xl font-semibold">Questo link non è più attivo</h1>
        <p className="max-w-xs text-sm text-white/60">
          La consulenza collegata a questo preventivo è stata chiusa. Chiedi al tuo consulente un
          link aggiornato.
        </p>
      </div>
    );
  }

  // ─────────── CONFIGURATORE ───────────
  return (
    <div
      className={`bg-blueprint min-h-screen pb-36 text-white lg:pb-8 ${mirrorsState ? "live-viewer" : ""}`}
    >
      {lookupVeil}
      {veloGruppo}
      {bandaDelMio}
      {bandaGuardo}
      {viewerBanner}
      {presenterBar}
      {pointerOverlay}
      {pointerToggle}
      {cameraDelLink}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-3">
          <a href="/" className="flex items-center">
            <BrandLogo className="h-6 w-auto" />
          </a>
        </div>
      </header>
      {percheScade && <PercheScade until={promoUntil} onClose={() => setPercheScade(false)} />}

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* ── RIPRENDI DA DOVE ERI ──────────────────────────────────────────
            Compare solo a te, solo se c'è davvero del lavoro da riprendere e
            solo se appartiene a QUESTA consulenza. Il cliente non la vede: in
            diretta si guarda il preventivo, non i nostri ripensamenti. */}
        {/*  ── ⚠️ MAI DENTRO LA STANZA DI UN'ALTRA PERSONA ──────────────
             Segnalazione del committente, con la fotografia: preme l'occhio
             per vedere cosa sta facendo il cliente, e al posto del suo
             preventivo gli esce «Hai un preventivo lasciato a metà — Riparti
             in bianco / Recupera preventivo».
             Quella scheda parla della BOZZA salvata su questo dispositivo,
             cioè del lavoro del consulente: non c'entra niente con la stanza
             che sta guardando, la copre, e il pulsante giallo avrebbe fatto
             la cosa peggiore di tutte — scrivere la propria bozza SOPRA il
             preventivo del cliente, mentre lui lo compila.
             Era nascosta solo quando si guarda «da fermi» (`isMirror`): ma
             chi entra nella stanza di qualcuno ha la penna, quindi non è uno
             specchio, e la scheda ricompariva. La domanda giusta non è «sto
             guardando?» ma «sono nel preventivo di un altro?». */}
        {!isMirror && !guardoIlSuo && bozza && (
          <section className="hg-rise mb-5 flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] px-4 py-3.5 sm:flex-row sm:items-center print:hidden">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-400/15 text-amber-200">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-white">
                Hai un preventivo lasciato a metà
                {bozza.profile?.nome || bozza.profile?.cognome
                  ? ` — ${[bozza.profile?.nome, bozza.profile?.cognome].filter(Boolean).join(" ")}`
                  : ""}
              </p>
              <p className="text-[11.5px] leading-snug text-white/55">
                Salvato su questo dispositivo
                {quandoBozza(bozza.at) ? ` ${quandoBozza(bozza.at)}` : ""}. Riprende dal punto
                esatto in cui eri: scelte, dati e quantità.
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={scartaBozza}
                className="rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                Riparti in bianco
              </button>
              <button
                type="button"
                onClick={recuperaBozza}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[12.5px] font-semibold text-[#3b2400] shadow-lg shadow-amber-500/20 transition hover:brightness-110"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Recupera preventivo
              </button>
            </div>
          </section>
        )}
        {/* ── APERTURA ─────────────────────────────────────────────────────
            Le tre garanzie erano pillole impilate una sotto l'altra: occupavano
            mezza schermata e si leggevano come un elenco qualsiasi. Ora sono una
            riga sola, in griglia, con icona sopra e testo sotto — leggibile in un
            colpo d'occhio anche sul telefono. Il titolo entra con una comparsa
            scalata e lo sfondo respira lentamente: movimento, non animazione. */}
        <section
          data-hg-anchor="cfg-hero"
          className="relative mb-5 overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-b from-brand/[0.14] via-white/[0.02] to-transparent px-4 py-7 text-center sm:mb-7 sm:rounded-3xl sm:px-6 sm:py-10"
        >
          <div className="hg-aurora pointer-events-none absolute -top-28 left-1/2 h-64 w-[22rem] -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
          <div className="hg-aurora-slow pointer-events-none absolute -bottom-24 right-0 h-48 w-48 rounded-full bg-brand/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-3.5 sm:gap-4">
            <span
              className="hg-rise inline-flex items-center gap-1.5 rounded-full border border-brand/35 bg-brand/12 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-brand sm:text-[10px]"
              style={{ animationDelay: "0ms" }}
            >
              <Fingerprint className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Il tuo preventivo, costruito con
              te
            </span>
            <h1
              className="hg-rise text-balance text-[1.7rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl md:text-[2.9rem]"
              style={{ animationDelay: "70ms" }}
            >
              Scegli tu ogni dettaglio.
              <br />
              <span className="bg-gradient-to-r from-brand via-sky-300 to-brand bg-clip-text text-transparent">
                Impossibile da riconoscere.
              </span>
            </h1>
            <p
              className="hg-rise max-w-xl text-balance text-sm leading-relaxed text-white/65 sm:text-base"
              style={{ animationDelay: "140ms" }}
            >
              Scegli la tua strada e cosa aggiungere: il prezzo si aggiorna mentre decidi. Il
              preventivo che esce è il tuo, non un listino uguale per tutti.
            </p>
            {/* Due voci, non tre: la griglia a tre colonne le lasciava strette e
                mandava il testo a capo. Qui stanno affiancate, icona a sinistra e
                testo a destra, su una riga sola ciascuna. */}
          </div>
        </section>

        {/* ── LA CAUSA VERA DELLO SFORAMENTO ────────────────────────────────
            Una colonna di griglia, per impostazione predefinita, non può essere
            più stretta del suo contenuto: se una scheda al suo interno diventa
            larga, la colonna la segue e il contenuto esce dallo schermo. È il
            motivo per cui il problema si spostava da una sezione all'altra a
            seconda di cosa selezionavi, e per cui correggere le singole schede
            non bastava.
            Servono DUE cose insieme: `min-w-0` sulla colonna, e la colonna
            dichiarata esplicitamente (`grid-cols-1`). Senza la seconda, su
            telefono la colonna resta "automatica" e si allarga comunque fino al
            contenuto più largo — era questo il pezzo che mancava. */}
        <form onSubmit={submit} className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-8">
            {/* soluzione base */}
            <section data-hg-anchor="cfg-step-01">
              <h2 className="mb-1 text-lg font-semibold">
                <span className="text-brand">01</span> — Da dove partiamo
              </h2>
              {/* il titolo da solo non diceva nulla: qui si spiega che si sceglie
                  la STRADA, e che tutto il resto dipende da questa scelta */}
              <p className="mb-3 text-sm leading-relaxed text-white/55">
                Sono tre strade diverse per riavere i capelli. Scegli la tua: il resto del
                preventivo si adatta di conseguenza. Il prezzo che leggi su ogni scheda comprende
                già le scelte incluse, e non conta ancora installazione, quantità e sconti.
              </p>
              <div className={`grid gap-3 ${menu.base.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {menu.base.map((b) => {
                  const active = baseId === b.id;
                  /*  ── ⚠️ IL PREZZO DELLA SCHEDA È QUELLO "FINO A QUI" ─────
                      Richiesta del committente: «fai che il prezzo di ogni
                      servizio all'inizio del preventivo scriva il prezzo totale
                      fino a quel momento, in base ai prodotti aggiuntivi già
                      preselezionati».
                      Qui c'era il prezzo della base sola — 389 € — e il cliente
                      lo leggeva come «costa 389 €», mentre nel totale in fondo
                      entravano anche le voci già spuntate: il numero cresceva
                      scorrendo, senza che si capisse da dove. Ora la cifra
                      grande è quella vera di questa strada adesso, e sotto c'è
                      scritto com'è fatta. Il conto lo fa `prezzoDiPartenza`:
                      rispetta il listino, le voci nascoste e gli sconti spenti.
                      ⚠️ Non è il totale del preventivo: calibrazione,
                       simulazione, analisi del volto, quantità e sconti si
                       scelgono dopo. La riga sotto lo dice a parole. */
                  /*  ⚠️ CON QUALI SPUNTE SI FA IL CONTO ─────────────────
                      Con quelle che avresti PREMENDO questa scheda, non con
                      quelle di adesso: cambiando strada le spunte tornano
                      quelle di partenza (lo fa `chooseBase`), e l'unica che se
                      le tiene è quella personalizzabile. Facendo il conto
                      sempre sulle spunte correnti, la scheda della Patch
                      avrebbe mostrato il prezzo di un innesto scelto
                      sull'Invisible Derm — una cifra che premendola sarebbe
                      sparita. */
                  const par = prezzoDiPartenza(
                    menu,
                    b.id,
                    b.id === baseId || b.id === PERSONALIZABLE ? selected : preselDi(b.id),
                  );
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => chooseBase(b.id)}
                      data-hg-anchor={`cfg-base-${b.id}`}
                      className={`rounded-xl border p-4 text-left transition ${active ? "border-brand bg-brand/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{b.name}</span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-brand bg-brand text-white" : "border-white/25"}`}
                        >
                          {active && <Check className="h-3 w-3" />}
                        </span>
                      </div>
                      {b.badge && (
                        // il badge distingue le tre strade a colpo d'occhio:
                        // ha bisogno di peso, non di essere un dettaglio
                        <span
                          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${
                            /top di gamma/i.test(b.badge)
                              ? "bg-gradient-to-r from-amber-400/90 to-amber-300/80 text-[#2b1c00] shadow-sm shadow-amber-500/30"
                              : /economico/i.test(b.badge)
                                ? "bg-white/12 text-white/80 ring-1 ring-white/20"
                                : "bg-brand text-white shadow-sm shadow-brand/30"
                          }`}
                        >
                          {b.badge}
                        </span>
                      )}
                      <p className="mt-2 text-xs text-white/55">{b.desc}</p>
                      {/*  ⚠️ `flex-wrap`: la cifra, il barrato e la riga che
                          spiega devono poter andare a capo. Senza, su schermo
                          stretto il prezzo spingeva fuori la scheda. */}
                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {/*  ⚠️ Barrato solo se c'è davvero uno sconto: un
                            "prima" uguale (o più basso) del prezzo non è
                            un'offerta, è un numero che confonde. */}
                        {par.listino ? (
                          <span className={`${BARRATO_CLASSI} text-[15px]`}>
                            {formatPrice(par.listino)}
                          </span>
                        ) : null}
                        <span
                          className={`inline-block rounded-lg px-2.5 py-1 text-sm font-bold ${par.totale === 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.08] text-white"}`}
                        >
                          {par.totale === 0 ? "GRATIS" : formatPrice(par.totale)}
                        </span>
                      </p>
                      {/*  Com'è fatta quella cifra: senza questa riga il numero
                          non combacerebbe con nessun prezzo di listino e
                          sembrerebbe uscito dal nulla. */}
                      {par.voci.length > 0 && (
                        <p className="mt-1 text-[11.5px] leading-snug text-white/45">
                          {par.extra > 0 ? (
                            <>
                              {formatPrice(b.price)} di base + {formatPrice(par.extra)} di scelte
                              già incluse
                            </>
                          ) : (
                            <>
                              {par.voci.length} scelte già incluse, senza sovrapprezzo
                            </>
                          )}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Colore e analisi morfologica: riguarda la costruzione di un impianto,
                non il trapianto — con il trapianto la sezione sparisce del tutto. */}
            {!isTransplant && (
              <section data-hg-anchor="cfg-step-02">
                {/* ── DUE FASI, IN QUEST'ORDINE ───────────────────────────────
                  Prima l'installazione stava SOPRA lo studio del volto: si
                  leggeva il giorno della posa prima di sapere come viene
                  costruito l'impianto, e non si capiva che una cosa viene dopo
                  l'altra. Ora sono due fasi numerate, una sotto l'altra, con
                  scritto in testa cosa succede e quanto dura: si capisce
                  scorrendo, senza dover leggere tutto. */}
                <h2 className="mb-1 text-lg font-semibold">
                  <span className="text-brand">02</span> — Dallo studio del volto all'installazione
                </h2>
                <p className="mb-4 text-sm leading-relaxed text-white/55">
                  Due fasi, in quest'ordine. La prima decide{" "}
                  <b className="font-semibold text-white/75">come viene costruito</b> il tuo
                  impianto. La seconda è il giorno in cui lo indossi.
                </p>

                <FaseTitolo n={1} titolo="Studiamo il tuo volto" quando="Prima cosa" />
                <p className="mb-3 mt-2 px-1 text-[13.5px] leading-relaxed text-white/55">
                  Proporzioni del viso, forma della testa, colore esatto. Da remoto li legge il
                  software da foto e video: dati, non stime. Nel nostro centro li verifica un
                  tecnico di persona.
                </p>
                <div className={`grid gap-3 ${menu.fitting.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {menu.fitting.map((f) => {
                    const active = fitting === f.id;
                    const remoto = f.id === "remoto";
                    const Icon = remoto ? Video : MapPin;
                    const b = f as { bullets?: string[]; bestFor?: string };
                    return (
                      /* ── DUE STRADE, NON DUE PARAGRAFI ──────────────────────────
                       Prima erano due muri di testo con il prezzo in fondo: per
                       confrontarli bisognava leggerli tutti e due per intero.
                       Ora ogni scheda ha lo stesso schema — icona colorata,
                       titolo, prezzo in alto, tre punti, e in fondo A CHI
                       CONVIENE — così il confronto si fa riga per riga. */
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => {
                          primeSfx();
                          if (f.id !== fitting) f.price === 0 ? sfx.selectDeal() : sfx.select();
                          setFitting(f.id);
                        }}
                        data-hg-anchor={`cfg-fitting-${f.id}`}
                        className={`flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                          active
                            ? "border-brand bg-brand/[0.09] shadow-lg shadow-brand/10"
                            : "border-white/12 bg-white/[0.03] hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 px-4 pt-4">
                          <span
                            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                              remoto
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-brand/20 text-brand"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold leading-tight text-white">
                              {f.name}
                            </span>
                            <span
                              className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[13px] font-bold ${
                                f.price === 0
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-brand/20 text-brand"
                              }`}
                            >
                              {f.price === 0 ? "GRATIS" : "+" + formatPrice(f.price)}
                            </span>
                          </span>
                          <span
                            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                              active ? "border-brand bg-brand text-white" : "border-white/25"
                            }`}
                          >
                            {active && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </div>
                        <ul className="mt-3 space-y-1.5 px-4 text-[13px] leading-relaxed text-white/65">
                          {(b.bullets ?? [f.desc]).map((t) => (
                            <li key={t} className="flex gap-2">
                              <Check
                                className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${remoto ? "text-emerald-400" : "text-brand"}`}
                              />
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                        {b.bestFor && (
                          <p className="mt-3 border-t border-white/10 px-4 py-2.5 text-[12px] text-white/50">
                            <span className="font-semibold text-white/70">Conviene </span>
                            {b.bestFor.replace(/^Se /, "se ").replace(/^A chiunque/, "a chiunque")}
                          </p>
                        )}
                        {/* ── E POI COSA SUCCEDE ────────────────────────────────
                          Una riga sola, in fondo alla strada scelta: la domanda
                          arriva qui, e qui trova la risposta. È uno <span> e non
                          un pulsante perché questa scheda È già un pulsante, e
                          uno dentro l'altro non si preme in modo affidabile. */}
                        {active && acceso("percorso") && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              sfx.page("percorso");
                              setPercorsoOpen(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setPercorsoOpen(true);
                              }
                            }}
                            className="flex cursor-pointer items-center gap-1.5 border-t border-brand/25 bg-brand/[0.07] px-4 py-2.5 text-[12px] font-medium text-brand transition hover:bg-brand/[0.14]"
                          >
                            <RouteIcon className="h-3.5 w-3.5" />
                            Come funziona, passo dopo passo
                            <ArrowUpRight className="ml-auto h-3.5 w-3.5" />
                          </span>
                        )}
                        {/* l'appuntamento in sede si prenota con l'acconto: va detto
                          qui, non dopo, e senza girarci intorno */}
                        {(f as { requiresDeposit?: boolean }).requiresDeposit && (
                          <p className="flex items-start gap-2 border-t border-amber-400/25 bg-amber-400/[0.07] px-4 py-2.5 text-[12px] leading-relaxed text-amber-100/80">
                            <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
                            <span>
                              L'appuntamento si prenota con l'acconto di{" "}
                              {formatPrice(menu.acconto)}, che viene scalato dal totale.
                            </span>
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* ── COME FUNZIONA, PRIMA DI SCEGLIERE ─────────────────────────
                  Il percorso completo era visibile solo DOPO aver creato il
                  preventivo. Ma è proprio prima che il cliente si chiede "e poi
                  cosa succede?". Qui è un rimando discreto, non un blocco. */}
                {/* Il rimando al percorso NON è più una scheda a sé: viveva sotto
                  le due strade come un blocco in più da leggere. Ora sta DENTRO
                  la strada scelta, in fondo, come una riga sola — è lì che nasce
                  la domanda "e poi cosa succede?". */}

                <div className="mt-6">
                  <FaseTitolo n={2} titolo="L'installazione" quando="Dopo la fase 1 · 2 ore" />
                  <p className="mb-3 mt-2 px-1 text-[13.5px] leading-relaxed text-white/55">
                    Un solo appuntamento di due ore,{" "}
                    <b className="font-semibold text-white/75">nel nostro centro o a casa tua</b>.
                    Si fa quando l'impianto è pronto.
                  </p>
                  {/* installazione: attivabile/disattivabile (nascosta se disabilitata dall'admin) */}
                  {/* Con il TRAPIANTO non esiste installazione in studio: l'intervento
                  si svolge in clinica. La voce viene nascosta e non conteggiata. */}
                  {menu.installation && !isTransplant && (
                    /* ── SCHEDA SERVIZIO, NON UNA VOCE DI ELENCO ──────────────────
                   Prima era una riga sola con icona, titolo, prezzo e sei righe
                   di testo tutte compresse: il titolo andava a capo, il prezzo
                   finiva schiacciato contro la spunta e il testo era illeggibile.
                   Qui la scheda è divisa in due parti: sopra la decisione (cosa
                   è, quanto costa, se è incluso), sotto la spiegazione. */
                    <div
                      className={`overflow-hidden rounded-2xl border transition ${installOn ? "border-brand bg-brand/[0.08]" : "border-white/12 bg-white/[0.03]"}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          primeSfx();
                          installOn ? sfx.deselect() : sfx.select();
                          setInstallOn((v) => !v);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                      >
                        <span
                          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${installOn ? "bg-brand text-white" : "bg-white/10 text-brand"}`}
                        >
                          <Wrench className="h-5 w-5" />
                        </span>
                        {/*  ── ⚠️ IL PREZZO STA SOTTO, NON DI FIANCO ──────────
                            Segnalazione del committente, con la schermata sotto
                            gli occhi: «il prezzo fa buggare tutto, il titolo va
                            a capo».
                            Icona, titolo, prezzo e spunta stavano tutti su UNA
                            riga. Il prezzo non si può stringere (è una cifra) e
                            la spunta nemmeno, quindi a stringersi era l'unica
                            cosa elastica: il titolo. Nella colonna del
                            preventivo restavano centoventi pixel, e
                            «Calibrazione e applicazione da noi» usciva incolonnato
                            una parola per riga.
                            Ora il prezzo sta SOTTO il titolo — la stessa forma
                            che ha già la voce della simulazione, poco più su —
                            e il titolo ha tutta la larghezza. */}
                        <span className="min-w-0 flex-1">
                          {/*  Spaziatura stretta: «INSTALLAZIONE PROFESSIONALE»
                              è lunga, e con le lettere larghe andava a capo
                              anche lei nella colonna del preventivo. */}
                          <span className="block text-[11px] font-bold uppercase tracking-[0.02em] text-brand">
                            Installazione professionale
                          </span>
                          <span className="block text-[15px] font-semibold leading-snug text-white">
                            {menu.installation.name}
                          </span>
                          <span className="mt-1.5 inline-block whitespace-nowrap rounded-lg bg-brand/20 px-2.5 py-1 text-sm font-bold text-brand">
                            +{formatPrice(menu.installation.price)}
                          </span>
                        </span>
                        <span
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border ${installOn ? "border-brand bg-brand text-white" : "border-white/25"}`}
                        >
                          {installOn && <Check className="h-4 w-4" />}
                        </span>
                      </button>
                      <p className="border-t border-white/10 px-4 py-3 text-[13px] leading-relaxed text-white/60">
                        {menu.installation.desc}
                      </p>
                      {/* ── DOVE ────────────────────────────────────────────────
                      Stesso lavoro e stesso prezzo nei due casi. L'unica
                      differenza sono le spese di viaggio, e vanno dette qui —
                      non scoperte dopo. */}
                      {installOn && acceso("dove") && (
                        <div className="border-t border-white/10 bg-white/[0.02] px-4 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                            Dove
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["studio", "Nel nostro centro"],
                                ["home", "A casa tua"],
                              ] as const
                            ).map(([k, t]) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  sfx.select();
                                  setInstallLoc(k);
                                }}
                                className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition ${
                                  installLoc === k
                                    ? "border-brand bg-brand/20 text-white"
                                    : "border-white/15 bg-white/[0.04] text-white/65 hover:bg-white/10"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          {installLoc === "home" && (
                            <p className="mt-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-[12.5px] leading-relaxed text-amber-100/90">
                              Il servizio costa uguale.{" "}
                              <b>Restano da coprire le spese di viaggio dell'installatore</b>,
                              calcolate sulla distanza: te le comunichiamo prima di fissare
                              l'appuntamento.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* vista del percorso, consultabile già in fase di scelta */}
            {percorsoOpen && (
              <div
                data-hg-scroll="percorso"
                className="bg-blueprint fixed inset-0 z-[60] overflow-y-auto text-white print:hidden"
              >
                <header className="sticky top-0 z-10 border-b border-white/10 bg-[#081634]/90 backdrop-blur">
                  <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
                    <BrandLogo className="h-6 w-auto" />
                    <button
                      type="button"
                      onClick={() => setPercorsoOpen(false)}
                      className="rounded-lg border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </header>
                <div className="mx-auto max-w-3xl px-4 py-6">
                  <h1 data-hg-anchor="percorso-titolo" className="mb-1 text-2xl font-bold">
                    Come funziona, passo dopo passo
                  </h1>
                  <p className="mb-6 text-sm text-white/55">
                    {isTransplant
                      ? "Il tuo viaggio a Istanbul, giorno per giorno."
                      : "Dalle prime foto alla consegna: cosa serve da te e quanto tempo occorre."}
                  </p>
                  {/* con `start={null}` le date non venivano calcolate e la scheda restava
                      senza tempi: proprio l'informazione per cui la si apre.
                      Partendo da oggi, mostra le finestre reali. */}
                  {isTransplant ? (
                    <TransplantTimeline />
                  ) : (
                    <PercorsoTimeline start={new Date()} steps={{}} />
                  )}
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setPercorsoOpen(false)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium transition hover:bg-white/10"
                    >
                      <ArrowRight className="h-4 w-4 rotate-180" /> Torna alla scelta
                    </button>
                  </div>
                </div>
              </div>
            )}

            {canPersonalize ? (
              (() => {
                const visibleSecs = visibleUpsellSecs;
                return (
                  <>
                    {visibleSecs.map((sec, idx) => {
                      const groupIds = sec.items.map((i) => i.id);
                      return (
                        <section key={sec.num} data-hg-anchor={`cfg-sez-${sec.num}`}>
                          <h2 className="mb-1 text-lg font-semibold">
                            <span className="text-brand">{String(idx + 3).padStart(2, "0")}</span> —{" "}
                            {sec.title}
                          </h2>
                          {/* chiarimento della sezione: quando le opzioni si somigliano,
                      dice in una riga che cosa cambia davvero fra loro */}
                          {"note" in sec && (sec as { note?: string }).note && (
                            /* La nota era testo chiaro su fondo chiaro, a bassa
                       leggibilità: si faceva fatica a leggerla proprio dove
                       serviva capire. Ora ha una barra laterale, testo più
                       grande e contrasto pieno. */
                            <p className="mb-3 flex gap-2.5 rounded-xl border-l-[3px] border-brand bg-brand/[0.12] px-3.5 py-3 text-[13px] leading-relaxed text-white/90">
                              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
                              <span>{(sec as { note?: string }).note}</span>
                            </p>
                          )}
                          {sec.single && (
                            <p className="mb-3 text-xs text-white/45">Scegli una sola opzione.</p>
                          )}
                          {!sec.single && <div className="mb-3" />}
                          <div className="space-y-2.5">
                            {sec.items.map((item) => {
                              const active = selected.has(item.id);
                              const onClick = () =>
                                sec.single ? selectSingle(groupIds, item.id) : toggle(item.id);
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  onClick={onClick}
                                  data-hg-anchor={`cfg-opt-${item.id}`}
                                  className={`block w-full overflow-hidden rounded-xl border text-left transition ${active ? "border-brand bg-brand/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
                                >
                                  <span className="flex items-start gap-3 p-4">
                                    <span
                                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border ${sec.single ? "rounded-full" : "rounded-md"} ${active ? "border-brand bg-brand text-white" : "border-white/25"}`}
                                    >
                                      {active ? (
                                        <Check className="h-3.5 w-3.5" />
                                      ) : sec.single ? null : (
                                        <Plus className="h-3.5 w-3.5 text-white/40" />
                                      )}
                                    </span>
                                    <span className="block min-w-0 flex-1">
                                      {/* ── NIENTE PIÙ SFORAMENTI A DESTRA ──────────────
                                Il blocco del prezzo non va a capo per scelta, ma
                                senza `min-w-0` sul titolo la riga non poteva
                                stringersi: la scheda si allargava oltre lo schermo
                                e su telefono il contenuto usciva dal bordo.
                                Su schermi stretti prezzo e titolo si impilano. */}
                                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                        <span className="min-w-0 flex-1 break-words text-sm font-medium uppercase tracking-wide">
                                          {item.name}
                                        </span>
                                        <span className="flex-shrink-0">
                                          <PromoPrice price={item.price} wasPrice={item.wasPrice} />
                                        </span>
                                      </div>
                                      <span className="mt-1 block text-sm text-white/55">
                                        {item.desc}
                                      </span>
                                    </span>
                                  </span>
                                  {/* ── COME VA FATTA ────────────────────────────────
                              Si apre sotto la voce, solo quando è scelta: fra
                              un'onda appena accennata e un riccio stretto c'è
                              tutta la differenza fra un impianto che si integra
                              e uno che si nota. Prima quella scelta si faceva a
                              voce e non finiva da nessuna parte. */}
                                  {active && item.variants && (
                                    <span className="hg-rise block border-t border-white/10 bg-white/[0.03] px-4 py-3">
                                      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                                        {item.variants.title}
                                      </span>
                                      <span className="grid grid-cols-3 gap-1.5">
                                        {item.variants.options.map((o) => {
                                          const sel =
                                            (varianti[item.id] ?? item.variants!.defaultId) ===
                                            o.id;
                                          return (
                                            <span
                                              key={o.id}
                                              role="button"
                                              tabIndex={0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                sfx.select();
                                                setVarianti((v) => ({ ...v, [item.id]: o.id }));
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setVarianti((v) => ({ ...v, [item.id]: o.id }));
                                                }
                                              }}
                                              className={`block cursor-pointer rounded-lg border px-2 py-2 text-center transition ${sel ? "border-brand bg-brand/20 shadow-sm shadow-brand/20" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}
                                            >
                                              <span
                                                className={`block text-[12px] font-semibold leading-tight ${sel ? "text-white" : "text-white/75"}`}
                                              >
                                                {o.name}
                                              </span>
                                              <span className="mt-0.5 block text-[10px] leading-snug text-white/45">
                                                {o.desc}
                                              </span>
                                            </span>
                                          );
                                        })}
                                      </span>
                                    </span>
                                  )}
                                  {!!item.wasPrice && (
                                    <PromoNote
                                      until={promoUntil}
                                      onApri={() => setPercheScade(true)}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                    {menu.simulation && (
                      <section data-hg-anchor="cfg-simulazione">
                        <h2 className="mb-3 text-lg font-semibold">
                          <span className="text-brand">
                            {String(visibleSecs.length + 3).padStart(2, "0")}
                          </span>{" "}
                          — Come starà su di te
                        </h2>
                        {/* ── SCHEDA RICOSTRUITA ──────────────────────────────────────
                    Prima: icona, titolo, prezzo e spunta tutti sulla stessa riga,
                    con il titolo spezzato su quattro righe e la spunta a metà
                    altezza. Ora la scheda ha tre fasce nette — intestazione,
                    descrizione, scadenza — e su telefono resta leggibile perché
                    nulla compete per lo spazio orizzontale. */}
                        <button
                          type="button"
                          onClick={() => {
                            primeSfx();
                            simOn ? sfx.deselect() : sfx.selectDeal();
                            setSimOn((v) => !v);
                          }}
                          className={`block w-full overflow-hidden rounded-2xl border text-left transition ${simOn ? "border-brand bg-brand/[0.09] shadow-lg shadow-brand/10" : "border-white/12 bg-white/[0.03] hover:border-brand/40"}`}
                        >
                          <div className="flex items-center gap-3 px-4 pt-4">
                            <span
                              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${simOn ? "bg-brand text-white" : "bg-brand/15 text-brand"}`}
                            >
                              <Eye className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-semibold leading-tight text-white">
                                {menu.simulation.name}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-2">
                                {!!menu.simulation.wasPrice &&
                                  menu.simulation.wasPrice > menu.simulation.price && (
                                  <span className={`${BARRATO_CLASSI} text-[15px]`}>
                                    {formatPrice(menu.simulation.wasPrice)}
                                  </span>
                                )}
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${menu.simulation.price === 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-brand/20 text-brand"}`}
                                >
                                  {menu.simulation.price === 0
                                    ? "GRATIS"
                                    : "+" + formatPrice(menu.simulation.price)}
                                </span>
                              </span>
                            </span>
                            <span
                              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border ${simOn ? "border-brand bg-brand text-white" : "border-white/25"}`}
                            >
                              {simOn && <Check className="h-4 w-4" />}
                            </span>
                          </div>
                          <p className="mt-3 border-t border-white/10 px-4 py-3 text-[13px] leading-relaxed text-white/60">
                            {menu.simulation.desc}
                          </p>
                          {!!menu.simulation.wasPrice && (
                            <PromoNote until={promoUntil} onApri={() => setPercheScade(true)} />
                          )}
                        </button>
                      </section>
                    )}
                  </>
                );
              })()
            ) : (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm text-white/60">
                  <span className="font-medium text-white">Patch Standard</span> è la soluzione
                  essenziale, senza personalizzazioni. Per attaccatura su misura, colore, densità e
                  simulazione scegli <span className="text-brand">Invisible Derm Protocol</span>.
                </p>
              </section>
            )}

            {/* profilo — ultimo step, da compilare per confermare */}
            <section data-hg-anchor="cfg-dati">
              <h2 className="mb-1.5 text-lg font-semibold">
                <span className="text-brand">{String(profileNum).padStart(2, "0")}</span> — Il
                preventivo a tuo nome
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                L'età calibra densità e attaccatura. Nessun pagamento: vedi subito il riepilogo.
              </p>
              <div className="grid gap-x-4 gap-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:grid-cols-2 sm:p-6">
                <Field
                  label="Nome"
                  req
                  icon={User}
                  value={profile.nome}
                  onChange={(v) => setProfile({ ...profile, nome: v })}
                  placeholder="Mario"
                />
                <Field
                  label="Cognome"
                  req
                  icon={User}
                  value={profile.cognome}
                  onChange={(v) => setProfile({ ...profile, cognome: v })}
                  placeholder="Rossi"
                />
                {/* Età subito sotto il cognome e a tutta larghezza. Brizzolatura e
                    codice colore sono stati rimossi: si definiscono nell'analisi
                    del colore, non li deve dichiarare il cliente in un modulo. */}
                <div className="sm:col-span-2">
                  <Field
                    label="Età"
                    req
                    type="number"
                    value={profile.eta}
                    onChange={(v) => setProfile({ ...profile, eta: v })}
                    placeholder="42"
                  />
                </div>
                <Field
                  label="Email"
                  req
                  icon={Mail}
                  type="email"
                  value={profile.email}
                  onChange={(v) => setProfile({ ...profile, email: v })}
                  placeholder="mario@email.it"
                />
                <Field
                  label="Telefono"
                  req
                  icon={Phone}
                  type="tel"
                  value={profile.telefono}
                  onChange={(v) => setProfile({ ...profile, telefono: v })}
                  placeholder="+39 333 1234567"
                />
                {/* ── I DATI DELLA FATTURA ────────────────────────────────
                    Richiesta del committente: chiederli QUI, mentre il cliente
                    sta dettando i suoi dati, invece che tre settimane dopo per
                    email quando il bonifico è arrivato e bisogna fatturare.
                    ⚠️ SONO OPZIONALI E NON BLOCCANO IL PREVENTIVO: un preventivo
                     si è sempre potuto fare senza, e continuare a poterlo fare
                     conta più di una fattura pronta. Se ci sono, la finestra
                     della fattura si apre già piena e resta un tocco.
                    ⚠️ E NON FINISCONO NELLA RIGA DEL PREVENTIVO: `quote_requests`
                     non ha colonne per loro e non gliene servono. Restano nella
                     pagina e passano alla fattura, che è l'unica che li scrive.
                    Sta in fondo, dopo tutto il resto, ed è voluto: sono i campi
                    che il cliente si aspetta di meno, e in mezzo al modulo
                    farebbero sembrare il preventivo una pratica burocratica. */}
                <div className="sm:col-span-2">
                  <p className="mb-1 text-[13px] font-medium text-white/80">Per la fattura {OPT}</p>
                  <p className="mb-3 text-[12px] leading-relaxed text-white/45">
                    Il preventivo si crea anche senza. Ma se li scrivi adesso, quando arriva
                    l&apos;acconto la fattura è già pronta da emettere.
                  </p>
                  <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                    <Field
                      label="Codice fiscale"
                      value={profile.codiceFiscale}
                      onChange={(v) => setProfile({ ...profile, codiceFiscale: v.toUpperCase() })}
                      placeholder="RSSMRA80A01F205X"
                    />
                    {/*  ⚠️ RIEMPIE ANCHE I QUATTRO CAMPI SOTTO, ma solo quelli
                        che il suggerimento porta davvero: su una via senza
                        numero civico il campo del civico resta com'è invece di
                        essere svuotato. Cancellare quello che il cliente ha
                        appena scritto, per «coerenza» con un dato che il
                        servizio non ha, è il modo più rapido di fargli
                        riscrivere tre volte la stessa cosa.
                        ⚠️ E il CAP conta il doppio qui: su una fattura
                        elettronica un CAP sbagliato la fa scartare dallo SdI,
                        e chi se ne accorge è il commercialista settimane
                        dopo. */}
                    <CampoIndirizzoScuro
                      valore={profile.indirizzo}
                      comune={profile.comune}
                      onTesto={(v) => setProfile({ ...profile, indirizzo: v })}
                      onScelto={(i) =>
                        setProfile((p) => ({
                          ...p,
                          indirizzo: i.indirizzo || p.indirizzo,
                          civico: i.civico || p.civico,
                          cap: i.cap || p.cap,
                          comune: i.comune || p.comune,
                          provincia: i.provincia || p.provincia,
                        }))
                      }
                    />
                    <Field
                      label="Numero civico"
                      value={profile.civico}
                      onChange={(v) => setProfile({ ...profile, civico: v })}
                      placeholder="3"
                    />
                    <Field
                      label="CAP"
                      value={profile.cap}
                      onChange={(v) => setProfile({ ...profile, cap: v })}
                      placeholder="20121"
                    />
                    <Field
                      label="Comune"
                      value={profile.comune}
                      onChange={(v) => setProfile({ ...profile, comune: v })}
                      placeholder="Milano"
                    />
                    <Field
                      label="Provincia"
                      value={profile.provincia}
                      onChange={(v) => setProfile({ ...profile, provincia: v.toUpperCase() })}
                      placeholder="MI"
                    />
                  </div>
                </div>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-white/80">
                    <StickyNote className="h-4 w-4 text-white/45" /> Cosa dobbiamo sapere {OPT}
                  </span>
                  <textarea
                    rows={3}
                    value={profile.problemi}
                    onChange={(e) => setProfile({ ...profile, problemi: e.target.value })}
                    placeholder="Allergie, problemi del cuoio capelluto, o il risultato che hai in mente…"
                    className={`${inputCls} resize-none`}
                  />
                </label>
              </div>
            </section>
          </div>

          {/* RIEPILOGO MOBILE/TABLET — stessa identica logica della sidebar desktop
              (componente <Summary> condiviso): voci, quantità, CODICE PROMOZIONALE,
              sconti/scarcity, totale e Conferma. Su lg+ resta solo la sidebar. */}
          {/* ── NIENTE ANCORA SUL RIEPILOGO ─────────────────────────────────────
              Misurato: sul desktop il riepilogo è una COLONNA LATERALE (dentro un
              contenitore incollato, quindi scartato come riferimento), sul telefono
              è impilato IN FONDO. Le due posizioni non si corrispondono, quindi il
              presentatore aveva 5 fasce e il cliente 6: nella parte bassa della
              pagina la corrispondenza saltava e il cliente non riusciva più a
              seguirti. Come per le schede-opzione affiancate, un blocco che cambia
              posizione fra i due layout non può fare da riferimento. */}
          <section className="lg:hidden">
            <div className="rounded-2xl border border-brand/40 bg-gradient-to-b from-brand/[0.10] to-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
              <Summary
                soloConsulente={isViewer}
                mobile
                {...{
                  base,
                  selectedItems,
                  simOn,
                  installOn,
                  sim: menu.simulation,
                  install: menu.installation,
                  fitOpt,
                  qty,
                  setQty,
                  allDiscounts,
                  discountEur,
                  gross,
                  total,
                  codeInput,
                  messaggioCodice,
                  secondoImpianto,
                  offertaGaranzia,
                  setCodeInput,
                  applyCode,
                  checking,
                  codeErr,
                  manual,
                  scarcityList,
                  inputCls,
                  submitting,
                  promoUntil,
                  acconto,
                  acceso,
                }}
              />
            </div>
          </section>

          {/* riepilogo sticky desktop — sempre visibile mentre scorri.
              STESSO id d'ancora del riepilogo mobile: è lo STESSO contenuto
              (componente <Summary> condiviso). Una sola delle due copie è
              visibile per volta e scrollsync ignora sia le ancore nascoste sia
              quelle dentro un contenitore sticky → nessuna ambiguità. */}
          {/* ── PERCHÉ NON RESTAVA IN ALTO ──────────────────────────────────
              `sticky` era già impostato, ma questo è un elemento di GRIGLIA: per
              impostazione predefinita viene allungato a tutta l'altezza della
              riga, e un elemento alto quanto la colonna non ha spazio per
              scorrere — quindi restava fermo insieme al resto.
              `self-start` gli fa prendere solo l'altezza che gli serve: da lì in
              poi accompagna lo scorrimento. */}
          <div className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Summary
                soloConsulente={isViewer}
                {...{
                  base,
                  selectedItems,
                  simOn,
                  installOn,
                  sim: menu.simulation,
                  install: menu.installation,
                  fitOpt,
                  qty,
                  setQty,
                  allDiscounts,
                  discountEur,
                  gross,
                  total,
                  codeInput,
                  messaggioCodice,
                  secondoImpianto,
                  offertaGaranzia,
                  setCodeInput,
                  applyCode,
                  checking,
                  codeErr,
                  manual,
                  scarcityList,
                  inputCls,
                  submitting,
                  promoUntil,
                  acconto,
                  acceso,
                }}
              />
            </div>
          </div>

          {/* sticky mobile: SOLO il prezzo (quantità e conferma stanno nella sezione
              "Il tuo preventivo" a fine pagina). Design compatto e leggibile. */}
          {/* ── BARRA DEL TOTALE — RIFATTA ───────────────────────────────────
              Prima era una fascia incollata al bordo con quattro elementi in
              fila: icona, etichetta, prezzo, listino e risparmio si contendevano
              la stessa riga e nessuno emergeva.
              Ora è una scheda sospesa, staccata dal bordo, su DUE righe con ruoli
              chiari: sopra il contesto (etichetta e listino), sotto i due numeri
              che contano — il totale e quanto si risparmia — allineati agli
              estremi. Il prezzo resta l'elemento più grande della schermata. */}
          <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
            {/* Vetro: sfondo semitrasparente + sfocatura di ciò che scorre sotto. Si
                  intuisce il contenuto dietro, la scheda resta leggibile. */}
            <div className="hg-glass relative mx-auto max-w-md overflow-hidden rounded-2xl border border-brand/30 bg-[#081a3d]/60 shadow-[0_-10px_44px_rgba(0,0,0,.5)] backdrop-blur-2xl backdrop-saturate-150">
              <div className="hg-aurora pointer-events-none absolute -top-14 left-1/2 h-24 w-52 rounded-full bg-brand/25 blur-3xl" />
              {/* filo superiore: separa la scheda dal contenuto che scorre sotto */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
              {/* luccichio: una lama di luce che attraversa il vetro ogni 6s */}
              <span className="hg-sheen pointer-events-none absolute inset-0" />

              <div className="relative px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="hg-pulse-ring absolute inset-0 rounded-full bg-brand" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-brand" />
                    </span>
                    Totale stimato
                  </span>
                  {/*  ── ⚠️ IL 35% DELLA GARANZIA QUI NON SI VEDE ──────────
                       Decisione del committente: «quello di default del 35%
                       fai che lo mostra solo nel riepilogo prima di confermare
                       e poi nel preventivo sotto, nel badge garanzia 15 mesi.
                       E non fa nulla sullo sticky».
                       Ha ragione: questa barra è il PREZZO, e un prezzo
                       barrato che compare da solo, senza il riquadro che lo
                       spiega, si legge come un listino gonfiato. Il barrato e
                       la pastiglia del risparmio restano per gli sconti che
                       hanno un perché visibile qui — un codice, la quantità.
                       ⚠️ E il barrato è il prezzo VERO di partenza di questi
                        sconti (totale + quello che tolgono), non il lordo
                        pieno: scrivere il lordo mentre una parte dello sconto
                        non è nominata farebbe un conto che non torna. */}
                  {discountEur > 0 && (
                    <span className={`${BARRATO_CLASSI} text-[15px]`}>
                      {formatPrice(gross)}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-end justify-between gap-3">
                  <span
                    key={total}
                    className="hg-price-pop text-[30px] font-extrabold leading-none tracking-tight text-white"
                  >
                    {formatPrice(total)}
                  </span>
                  {discountEur > 0 && (
                    /* niente icona: su schermi stretti finiva a capo sopra la
                       cifra e sembrava un elemento staccato */
                    <span
                      key={`s${discountEur}`}
                      className="hg-price-pop mb-0.5 whitespace-nowrap rounded-lg bg-emerald-400/15 px-2.5 py-1 text-[12px] font-bold text-emerald-300 ring-1 ring-emerald-400/25"
                    >
                      −{formatPrice(discountEur)}
                    </span>
                  )}
                </div>

                {/*  ── ⚠️ IL SECONDO IMPIANTO — UNA RIGA SUA, NON UN BARRATO
                     SU QUESTO PREZZO ────────────────────────────────────
                     Richiesta del committente: «non fa che cancella il prezzo
                     attuale, ma crea una nuova riga dopo che dice prezzo
                     intero cancellato e mette quello che pagherà».
                     Sono due cose che non c'entrano niente: quanto paga OGGI e
                     quanto pagherà per il SECONDO. Barrare il primo per
                     annunciare il secondo vuol dire promettere uno sconto su
                     ciò che sta per firmare — e alla firma, quando il conto
                     non torna, quella riga è scritta nel suo preventivo. */}
                {secondoImpianto && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-emerald-400/20 pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
                      Dal secondo impianto
                    </span>
                    <span className="flex items-baseline gap-2">
                      {secondoImpianto.risparmio > 0 && (
                        <span className={`${BARRATO_CLASSI} text-[13px]`}>{formatPrice(gross)}</span>
                      )}
                      <b className="text-[17px] font-extrabold leading-none text-emerald-300">
                        {formatPrice(secondoImpianto.prezzo)}
                      </b>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </main>
      <Toaster />
    </div>
  );
}

/* ── riepilogo — UNICO componente condiviso: sidebar desktop + sezione mobile/tablet.
      `mobile` allarga solo spaziature/tocco, i calcoli e lo stato sono gli stessi. ── */
/** ── QUANTO STAI RISPARMIANDO, E FINO A QUANDO ─────────────────────────────
 *  Compare solo se c'è davvero uno sconto attivo: nessuna urgenza inventata.
 *  Dice tre cose, nell'ordine in cui servono: quanto risparmi, entro quando, e
 *  come bloccarlo. Due vesti diverse — nel riepilogo prima dell'invio è
 *  compatto; nel preventivo creato è più ampio, perché lì è il momento della
 *  decisione. */
/** ── CONDIZIONI APPLICATE ──────────────────────────────────────────────────
 *  Prima questo blocco era oro su oro, con "STAI RISPARMIANDO" in grande: la
 *  grafica del volantino. Su un preventivo da migliaia di euro quel tono fa
 *  l'effetto opposto — mette in dubbio anche il prezzo.
 *  Ora è un riquadro sobrio, con le condizioni elencate come voci di un
 *  documento, il MOTIVO per cui esistono, e la scadenza spiegata invece che
 *  annunciata. Nessun colore d'allarme, nessun punto esclamativo. */
/** ── PANNELLO DEL CONSULENTE ────────────────────────────────────────────────
 *  Visibile SOLO al consulente, e solo su un preventivo già creato. Permette di
 *  intervenire davanti al cliente: cambiare la quantità, applicare uno sconto e
 *  riaprire le condizioni scadute decidendo per quanti giorni.
 *  Il codice consulente si digita in chiaro solo per chi lo scrive: sullo
 *  schermo resta mascherato, così può essere usato in videochiamata. */
/** ── MODIFICHE DEL CONSULENTE APPLICATE AL PREVENTIVO ──────────────────────
 *  Quantità aggiornata, sconto aggiuntivo, condizioni riaperte. Parte SEMPRE dal
 *  preventivo originale, così ricalcolare due volte dà lo stesso risultato: è
 *  ciò che permette di rileggere le modifiche a ogni apertura e di mostrarle al
 *  cliente mentre vengono fatte, senza che i numeri si accumulino. */
export function withEdit(
  prev: Snapshot,
  e: QuoteEditPatch,
  qtyDisc?: Record<string, number>,
  /** L'acconto pieno del listino di oggi. Assente = quello già scritto nel
   *  preventivo: è il comportamento giusto per chi sta solo rileggendo un
   *  documento emesso, e l'unico possibile dove il listino non c'è. */
  accontoPieno?: number,
): Snapshot {
  const nQty = typeof e.qty === "number" && e.qty > 0 ? e.qty : prev.qty;
  // L'analisi in sede si paga UNA volta, non una per impianto: va tenuta fuori
  // dalla moltiplicazione, altrimenti al cliente arriva un totale gonfiato.
  const fisso = Number(prev.fittingPrice) || 0;
  const perUnit = (prev.gross - fisso) / Math.max(1, prev.qty);
  const gross2 = perUnit * nQty + fisso;

  //  ── AZZERARE: SI RIPARTE DAL PREZZO DI QUELLO CHE C'È DENTRO ─────────────
  //   Non è «togliere gli sconti che conosco», è tornare al prezzo di listino di
  //   quello che il preventivo comprende — e per questo funziona anche dove
  //   togliere una voce alla volta non funziona: sui preventivi vecchi, dove
  //   parte dello sconto non si sa a quale codice appartenga, e su quelli con
  //   uno sconto deciso a mano. Il prezzo pieno non va ricostruito: è la somma
  //   delle voci di «Cosa comprende», che nel preventivo c'è sempre.
  //   Da qui in poi i codici si rimettono uno alla volta, sapendo quanto valgono.
  const azzerato = e.reset === true;
  const extra = azzerato || !(typeof e.extraEur === "number" && e.extraEur > 0) ? 0 : e.extraEur;
  const righe = azzerato ? [] : [...prev.discounts];
  let base = azzerato ? 0 : prev.discountEur;

  //  ── I CODICI TOLTI, PRIMA DI TUTTO IL RESTO ──────────────────────────────
  //   Togliere un codice non è nascondere una riga: sono euro che tornano nel
  //   prezzo, e vanno scalati dallo sconto complessivo. È esatto solo perché
  //   ogni codice adesso arriva con il SUO valore accanto (vedi `vociSconto` in
  //   api.public.quote): finché lo sconto era un numero unico, di un codice
  //   applicato ieri non si sapeva quanto valesse e l'unica cosa possibile era
  //   sommargliene un altro sopra.
  //   Lo sconto quantità e quello deciso dal consulente non si toccano da qui:
  //   il primo dipende dalla quantità, il secondo è una decisione, e nessuno
  //   dei due è un codice promozionale.
  //   ⚠️ Si tolgono SOLO le voci dichiarate `kind: "code"`, cioè quelle di cui
  //    si conosce con certezza il valore. Una voce senza tipo è lo sconto non
  //    scomposto — dentro c'è di tutto — e una `altro` è la parte che non si è
  //    riusciti ad attribuire: toglierle vorrebbe dire restituire al cliente
  //    euro che nessuno sa a che titolo tornino indietro.
  const via = new Set((e.removed ?? []).map((c) => c.toUpperCase()));
  if (via.size)
    for (let i = righe.length - 1; i >= 0; i--) {
      const d = righe[i];
      if (d.kind !== "code" || !via.has(d.code.toUpperCase())) continue;
      base -= Number(d.eur) || 0;
      righe.splice(i, 1);
    }

  // Lo sconto quantità dipende dalla quantità: cambiandola va rifatto, non
  // trascinato. Se la tabella non è disponibile si lascia com'era.
  //  ⚠️ Su un preventivo azzerato non torna: azzerare vuol dire prezzo pieno, e
  //   uno sconto che si rimette da solo cambiando la quantità sarebbe un
  //   azzeramento che non tiene. Chi lo rivuole toglie l'azzeramento.
  if (!azzerato && qtyDisc && nQty !== prev.qty) {
    const vecchio = righe.find((d) => d.kind === "qty");
    const nuovo = Number(qtyDisc[String(nQty)]) || 0;
    if (vecchio || nuovo > 0) {
      base = base - (vecchio?.eur ?? 0) + nuovo;
      const i = righe.findIndex((d) => d.kind === "qty");
      if (nuovo > 0) {
        const voce = { code: "QTA", eur: nuovo, kind: "qty" as const, label: `${nQty} impianti` };
        if (i >= 0) righe[i] = voce;
        else righe.push(voce);
      } else if (i >= 0) righe.splice(i, 1);
    }
  }
  // Codici sconto aggiunti dopo: contano una volta sola, anche se uno di essi
  // era già stato applicato in fase di creazione.
  const nuovi = (e.codes ?? []).filter(
    (c) => !righe.some((d) => d.code.toUpperCase() === c.code.toUpperCase()),
  );
  const daCodici = nuovi.reduce((t, c) => t + (Number(c.eur) || 0), 0);
  nuovi.forEach((c) =>
    righe.push({ code: c.code, eur: Number(c.eur) || 0, kind: "code" as const, label: c.label }),
  );
  const disc2 = Math.min(gross2, Math.max(0, base) + extra + daCodici);
  const total2 = Math.max(0, gross2 - disc2);
  return {
    ...prev,
    //  ── LE PERSONALIZZAZIONI SMETTONO DI SEMBRARE SCONTATE ─────────────────
    //   Si toglie il `wasPrice`, cioè il prezzo pieno da cui si parte: senza
    //   quello sparisce il barrato accanto alla voce e sparisce la riga «Sconti
    //   sulle personalizzazioni» dalle condizioni, perché è calcolata proprio
    //   dalla differenza fra i due. Il `price` non si tocca — il totale non
    //   cambia di un centesimo, cambia solo che quel prezzo non si presenta più
    //   come un ribasso.
    items:
      e.upsellSconti === false
        ? prev.items.map((i) => ({ name: i.name, price: i.price }))
        : prev.items,
    qty: nQty,
    gross: gross2,
    discountEur: disc2,
    total: total2,
    //  ⚠️ Mai più del totale: cambiando la quantità il totale scende, e un
    //   acconto più alto del prezzo non vuol dire niente.
    acconto: Math.min(typeof accontoPieno === "number" ? accontoPieno : prev.acconto, total2),
    promoUntil: e.promoUntil || prev.promoUntil,
    //  Uno sconto deciso dal consulente NON è un codice promozionale: senza un
    //  tipo suo finiva nel gruppo dei coupon, e il cliente se lo trovava scritto
    //  come "Codice CONSULENTE" sotto il titolo "Video testimonianza", con
    //  accanto la pastiglia dei posti rimasti. Diceva una cosa falsa.
    discounts:
      extra > 0
        ? [...righe, { code: "CONSULENTE", eur: extra, kind: "consulente" as const }]
        : righe,
  };
}

/** ── MODIFICA DI UN PREVENTIVO GIÀ EMESSO ──────────────────────────────────
 *  Questo non è un pannello di vendita: è la RETTIFICA di un documento già
 *  consegnato, e il cliente la guarda insieme al consulente. Perciò niente
 *  colori d'allarme, niente "stai risparmiando", niente riquadri che pulsano.
 *  La forma è quella di una scheda amministrativa: i campi da una parte, e
 *  sotto il riepilogo di ciò che cambia, riga per riga, con i numeri incolonnati
 *  come su una fattura. Ogni variazione è dichiarata per esteso, comprese
 *  quelle in peggio: uno sconto che si perde va detto quanto uno che si applica.
 *
 *  ── ⚠️ DA QUI NASCE UN PREVENTIVO NUOVO, NON UNA CORREZIONE ───────────────
 *  Prima ogni pulsante di questo pannello scriveva una modifica ACCANTO al
 *  preventivo, e il documento restava quello: due prezzi per lo stesso cliente,
 *  quello scritto nella riga e quello ricomposto leggendola. Il cliente aveva in
 *  mano un link che continuava a valere, e l'anteprima di WhatsApp — disegnata
 *  dove quella ricomposizione non avviene — gli mostrava il prezzo pieno.
 *
 *  Adesso il pannello raccoglie le modifiche SENZA scrivere niente, le mostra
 *  tutte insieme sotto «Cosa cambia», e un gesto solo — «Applica le modifiche» —
 *  fa nascere un preventivo nuovo con i valori già dentro la riga. Quello di
 *  prima diventa inattivo e il suo link porta a questo.
 *  Il motivo per cui i pulsanti non scrivono più uno per uno è tutto qui: tre
 *  pulsanti che salvano vorrebbero dire tre numeri di preventivo per una
 *  trattativa sola.
 */
function ConsultantPanel({
  base,
  snap,
  edit,
  qtyDisc,
  menu,
  annullatoDa,
  linkValido,
  onSostituito,
}: {
  base: Snapshot;
  snap: Snapshot;
  edit: QuoteEditPatch | null;
  qtyDisc: Record<string, number>;
  menu: QuoteMenu;
  /** ── QUESTO DOCUMENTO È GIÀ MORTO ──────────────────────────────────────
   *  Il numero del preventivo che ha preso il posto di questo, se c'è.
   *  ⚠️ Il divieto vero non è qui: è sul server, che rifiuta di rifare un
   *   preventivo già sostituito (api.presenter.quote-revise risponde 409 con il
   *   numero buono). Senza quel rifiuto ci sarebbero TRE prezzi in giro. Questa
   *   prop serve a non far scoprire il divieto sbattendoci contro: aprire il
   *   pannello, ricomporre uno sconto davanti al cliente e prendersi un errore è
   *   una figura che si fa in videochiamata, e si fa una volta sola. */
  annullatoDa: string | null;
  /** L'indirizzo del preventivo valido: si offre da premere, non da ricopiare. */
  linkValido: string;
  /** Il preventivo nuovo, già calcolato, e il numero di quello che sostituisce. */
  onSostituito: (nuovo: Snapshot, precedente: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [nQty, setNQty] = useState(snap.qty);
  const [giorni, setGiorni] = useState("");
  const [codice, setCodice] = useState("");
  /** Codici verificati e messi in conto, ma non ancora scritti da nessuna parte. */
  const [aggiunti, setAggiunti] = useState<{ code: string; eur: number; label?: string }[]>([]);
  /** Codici già sul preventivo che si è deciso di togliere. */
  const [tolti, setTolti] = useState<string[]>([]);
  /** Via tutto: si riparte dal prezzo di listino di quello che il preventivo
   *  comprende, e i codici si rimettono da lì. */
  const [azzera, setAzzera] = useState(false);
  /** I prezzi barrati sulle personalizzazioni: accesi o spenti su QUESTO
   *  preventivo. `null` = come sta adesso, non lo si tocca. */
  const [upsellSconti, setUpsellSconti] = useState<boolean | null>(null);
  /** Rifare il preventivo con il listino di oggi, tenendo le stesse scelte. */
  const [prezziOggi, setPrezziOggi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setNQty(snap.qty);
  }, [snap.qty]);

  //  Preventivo diverso — o quello nuovo appena coniato: il pannello riparte
  //  pulito, o le modifiche di prima resterebbero in conto su un documento a cui
  //  non appartengono più.
  useEffect(() => {
    setAggiunti([]);
    setTolti([]);
    setAzzera(false);
    setUpsellSconti(null);
    setPrezziOggi(false);
    setGiorni("");
    setCodice("");
    setErr("");
  }, [snap.ref]);

  /** ── LO STESSO PREVENTIVO, AI PREZZI DI OGGI ────────────────────────────
   *  Le scelte del cliente non si toccano — sistema, personalizzazioni,
   *  quantità, modalità di rilievo restano quelle — e si riprende solo QUANTO
   *  COSTANO oggi. Serve perché un preventivo porta i prezzi del giorno in cui
   *  è nato: se il listino è cambiato nel frattempo, riaprirlo e cambiarci uno
   *  sconto lascerebbe in giro un documento con i prezzi di allora e la data di
   *  adesso.
   *  Una voce che dal listino è sparita resta con il prezzo che aveva: quello
   *  che il cliente ha scelto non si toglie da sotto. */
  const aOggi = (s: Snapshot): Snapshot => {
    const items = vociAiPrezziDiOggi(s.items, menu);
    const sistema = menu.base.find((b) => b.name === s.baseName);
    const rilievo = menu.fitting.find((f) => f.id === s.fittingId);
    const basePrice = sistema ? Number(sistema.price) || 0 : s.basePrice;
    const fittingPrice = rilievo ? Number(rilievo.price) || 0 : s.fittingPrice;
    const gross =
      (basePrice + items.reduce((t, i) => t + (Number(i.price) || 0), 0)) * Math.max(1, s.qty) +
      fittingPrice;
    return { ...s, items, basePrice, fittingPrice, gross };
  };
  const oggi = aOggi(base);
  const baseUsata = prezziOggi ? oggi : base;
  //  Se il listino non si è mosso, premere il pulsante non deve poter coniare
  //  un preventivo nuovo: un numero nuovo per zero differenze è un numero
  //  sprecato, e al cliente arriva un link nuovo senza motivo.
  const prezziDiversi = Math.abs(oggi.gross - base.gross) > 0.005;

  const nuovaScadenza = (() => {
    const g = Number(giorni);
    if (!(g > 0 && g <= 120)) return null;
    const d = new Date();
    d.setDate(d.getDate() + g);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  })();

  //  ── LA SCADENZA DEL DOCUMENTO NUOVO ──────────────────────────────────────
  //   Il preventivo che sta per nascere è emesso OGGI, e la sua validità si
  //   conta da oggi: se il consulente non scrive un numero di giorni, vale la
  //   durata standard decisa dal titolare. Non è un dettaglio nascosto — sta fra
  //   le righe di «Cosa cambia», perché riaprire le condizioni è una decisione
  //   commerciale e il cliente la sta leggendo insieme al consulente.
  const scadenzaNuova = nuovaScadenza ?? promoDeadline();

  //  ── I CODICI CHE IL PREVENTIVO HA GIÀ ADDOSSO ────────────────────────────
  //   Due provenienze, una lista sola: quelli messi alla creazione (arrivano
  //   scomposti dal server, `kind: "code"`) e quelli applicati dopo con una
  //   modifica. Si mettono insieme perché al consulente non interessa da dove
  //   vengono — gli interessa poterli togliere.
  //   ⚠️ Solo le voci con `kind: "code"`: quando il server non riesce a
  //    scomporre lo sconto manda una riga unica senza tipo, con dentro tutti i
  //    codici e anche lo sconto quantità. Offrire di togliere QUELLA vorrebbe
  //    dire restituire al cliente cifre che non sono di nessun codice.
  const suDocumento = base.discounts
    .filter((d) => d.kind === "code")
    .map((d) => ({ code: d.code, eur: Number(d.eur) || 0, label: d.label }));
  const esistenti = [
    ...suDocumento,
    ...(edit?.codes ?? []).filter(
      (c) => !suDocumento.some((d) => d.code.toUpperCase() === c.code.toUpperCase()),
    ),
  ];
  const attivo = (c: { code: string }) => !tolti.includes(c.code.toUpperCase());

  //  ── QUANDO LO SCONTO NON SI SA SCOMPORRE ─────────────────────────────────
  //   Capita sui preventivi vecchi e su quelli il cui codice è stato tolto dal
  //   listino: lo sconto arriva come una voce sola, senza tipo, e di quella non
  //   si può sapere quanti euro appartengano a quale codice. In quel caso un
  //   codice nuovo si SOMMA, perché è l'unica cosa onesta che si può fare —
  //   togliere alla cieca vorrebbe dire restituire al cliente una cifra
  //   inventata. Va detto a chi sta per premere, non scoperto dopo guardando il
  //   totale.
  const nonScomponibile = base.discounts.some((d) => !d.kind);

  //  ── GLI SCONTI SULLE PERSONALIZZAZIONI ───────────────────────────────────
  //   Non sono euro tolti dal totale: sono voci comprate a meno del loro
  //   listino, e il risparmio si legge dalla differenza fra `wasPrice` e
  //   `price`. Spegnerli non cambia il totale — toglie il barrato e la riga dal
  //   riepilogo delle condizioni.
  //   ⚠️ Si può solo SPEGNERE, non riaccendere: il prezzo pieno da cui si
  //    partiva vive nella riga del preventivo, e un preventivo emesso senza non
  //    ce l'ha più. Riaccenderli vorrebbe dire inventare un listino di partenza.
  //    Per questo il pulsante compare solo dove c'è qualcosa da spegnere.
  const scontiUpsellOra = baseUsata.items.some((i) => (Number(i.wasPrice) || 0) > i.price);
  const risparmioUpsell = baseUsata.items.reduce(
    (t, i) => t + Math.max(0, (Number(i.wasPrice) || 0) - i.price) * Math.max(1, nQty),
    0,
  );
  const upsellCambia = scontiUpsellOra && upsellSconti === false;

  //  Codici che il preventivo nuovo si porta dietro: quelli di prima rimasti in
  //  piedi più quelli appena verificati. Quelli tolti escono di qui E finiscono
  //  in `removed`, perché i due elenchi servono a due cose diverse: questo
  //  aggiunge, quello scala gli euro da quanto era già scontato.
  //  Azzerato: i codici di prima non si portano dietro nemmeno quelli scritti
  //  nella modifica precedente. Restano solo quelli messi in conto adesso.
  const codiciFinali = azzera ? aggiunti : [...(edit?.codes ?? []).filter(attivo), ...aggiunti];

  // Anteprima calcolata qui, prima di salvare: si decide guardando i numeri
  // definitivi, non una promessa. Ed è ESATTAMENTE il conto che finirà scritto
  // nella riga del preventivo nuovo — non un'approssimazione da schermo.
  const bozza: QuoteEditPatch = {
    ...(edit ?? {}),
    qty: nQty,
    codes: codiciFinali,
    removed: tolti,
    reset: azzera,
    ...(upsellSconti === null ? {} : { upsellSconti }),
    promoUntil: scadenzaNuova.toISOString(),
  };
  const preview = withEdit(baseUsata, bozza, qtyDisc);
  const scaduto = new Date(snap.promoUntil).getTime() < Date.now();

  const qtaSconto = (d: Snapshot) =>
    d.discounts.filter((x) => x.kind === "qty").reduce((t, x) => t + x.eur, 0);
  const qtaPrima = qtaSconto(snap);
  const qtaDopo = qtaSconto(preview);
  const unitPrima = snap.total / Math.max(1, snap.qty);
  const unitDopo = preview.total / Math.max(1, nQty);

  const giorno = (d: Date | string) =>
    new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long" });

  //  Qualcosa da fare c'è? Anche riaprire le condizioni conta — è la modifica
  //  che si fa più spesso su un preventivo scaduto, e cambia quello che il
  //  cliente può ancora ottenere. Quello che NON conta è il campo lasciato
  //  vuoto: senza una richiesta esplicita non si conia un numero nuovo per una
  //  data che sarebbe ripartita comunque.
  const cambia =
    nQty !== snap.qty ||
    aggiunti.length > 0 ||
    tolti.length > 0 ||
    azzera ||
    upsellCambia ||
    (prezziOggi && prezziDiversi) ||
    !!nuovaScadenza;

  // righe del riepilogo: si costruiscono solo se qualcosa cambia davvero
  const righe: { voce: string; da?: string; a: string }[] = [];
  if (nQty !== snap.qty)
    righe.push({ voce: "Quantità impianti", da: String(snap.qty), a: String(nQty) });
  //  Il listino prima e dopo: è la riga che spiega perché il totale si è mosso
  //  senza che nessuno abbia toccato sconti o quantità.
  if (prezziOggi && prezziDiversi)
    righe.push({
      voce: "Listino delle voci scelte",
      da: formatPrice(base.gross),
      a: formatPrice(oggi.gross),
    });
  //  Va detto per esteso perché è l'unica modifica che NON tocca il totale: chi
  //  legge solo la riga in fondo non capirebbe che cosa è cambiato.
  if (upsellCambia)
    righe.push({
      voce: "Sconti sulle personalizzazioni",
      da: `−${formatPrice(risparmioUpsell)} in evidenza`,
      a: "non più mostrati",
    });
  //  ── AZZERATO: UNA RIGA SOLA, NON UN ELENCO ───────────────────────────────
  //   Quando si toglie tutto, elencare voce per voce quello che sparisce fa
  //   perdere la cosa importante — che si torna al prezzo pieno — dentro un
  //   elenco di sottrazioni. Un numero solo, con accanto quanto viene adesso.
  if (azzera)
    righe.push({
      voce: "Sconti applicati",
      da: snap.discountEur > 0 ? `−${formatPrice(snap.discountEur)}` : "nessuno",
      a: "tolti tutti",
    });
  else {
    if (Math.abs(qtaDopo - qtaPrima) > 0.005)
      righe.push({
        voce: "Sconto quantità",
        da: qtaPrima > 0 ? `−${formatPrice(qtaPrima)}` : "nessuno",
        a: qtaDopo > 0 ? `−${formatPrice(qtaDopo)}` : "nessuno",
      });
    //  Prima quello che se ne va, poi quello che arriva: è l'ordine in cui il
    //  consulente lo racconta al cliente, ed è l'ordine in cui i due numeri si
    //  leggono senza doverli mettere in fila a mente.
    esistenti
      .filter((c) => !attivo(c))
      .forEach((c) =>
        righe.push({ voce: `Codice ${c.code}`, da: `−${formatPrice(c.eur)}`, a: "tolto" }),
      );
  }
  aggiunti.forEach((c) =>
    righe.push({ voce: `Codice ${c.code}`, da: "non applicato", a: `−${formatPrice(c.eur)}` }),
  );
  if (cambia)
    righe.push({
      voce: "Validità condizioni",
      da: giorno(snap.promoUntil),
      a: giorno(scadenzaNuova),
    });

  /** ── IL CODICE SI VERIFICA ADESSO, SI APPLICA DOPO ────────────────────────
   *  Il valore non si inventa: si chiede al server, che è lo stesso posto da
   *  cui lo prende la creazione del preventivo. Ma qui non si salva niente —
   *  entra solo nel conto che si sta guardando, e diventa un documento vero
   *  quando si preme «Applica le modifiche». Al momento di scrivere il server
   *  lo ricontrolla: fra la verifica e il gesto possono passare minuti, e i
   *  posti di un codice a esaurimento possono finire in mezzo.
   *
   *  ── ⚠️ UN CODICE NUOVO PRENDE IL POSTO DI QUELLO DI PRIMA ────────────────
   *  Qui prima si sommava, e il risultato era un preventivo con due promozioni
   *  addosso e un prezzo che non corrispondeva a nessun listino. Un codice
   *  sconto è un LIVELLO DI PREZZO, non un buono da accumulare: applicarne un
   *  altro vuol dire «adesso vale questo», non «tutti e due».
   *  Quello di prima non sparisce di nascosto: resta a schermo sbarrato, è
   *  scritto per esteso in «Cosa cambia» — con gli euro che torna a costare — e
   *  un tocco lo rimette dentro, se davvero vanno sommati. Il cliente sta
   *  guardando lo stesso schermo: niente può succedere in silenzio. */
  const verificaCodice = async () => {
    const c = codice.trim().toUpperCase();
    if (!c) return;
    //  Azzerato, i codici di prima non ci sono più: rimetterne uno che c'era è
    //  esattamente quello che si sta facendo, e non è un doppione.
    const gia =
      codiciFinali.some((x) => x.code.toUpperCase() === c) ||
      (!azzera && esistenti.some((x) => attivo(x) && x.code.toUpperCase() === c));
    if (gia) {
      setErr("Questo codice è già applicato a questo preventivo.");
      return;
    }
    setBusy("codice");
    setErr("");
    try {
      const j = await (
        await fetch(conSessione("/api/public/validate-discount"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: c }),
        })
      ).json();
      if (!j?.valid) {
        sfx.error();
        setErr(
          j?.reason === "sold_out"
            ? "Questo codice sconto è esaurito."
            : "Questo codice non risulta attivo.",
        );
        return;
      }
      //  Il codice nuovo è IL codice: quelli che c'erano vanno da parte, e
      //  quello eventualmente messo in conto un minuto fa lascia il posto.
      setTolti((l) => [...new Set([...l, ...esistenti.map((x) => x.code.toUpperCase())])]);
      setAggiunti([
        {
          code: String(j.code || c),
          eur: Number(j.discount_eur) || 0,
          label: j.label ?? undefined,
        },
      ]);
      setCodice("");
    } catch {
      sfx.error();
      setErr("Verifica non riuscita, riprova tra poco.");
    } finally {
      setBusy(null);
    }
  };

  /** ── IL GESTO: DA QUI NASCE IL PREVENTIVO NUOVO ───────────────────────────
   *  Si manda il conto già fatto — è quello che il cliente ha davanti — e le
   *  modifiche dichiarate una per una, che il server usa per ricontrollare i
   *  codici e per chiedere il permesso «listino» dove serve. Le opzioni non si
   *  rimandano: le ricopia il server dalla riga vecchia, così non se ne può
   *  perdere una per strada. */
  const applica = async () => {
    if (!code.trim()) {
      setErr("Serve il PIN o il codice consulente.");
      return;
    }
    if (!cambia) return;
    setBusy("salva");
    setErr("");
    try {
      const j = await (
        await fetch("/api/presenter/quote-revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref: snap.ref,
            code,
            by: getPresenter()?.name || undefined,
            qty: nQty,
            ...(nuovaScadenza ? { promoDays: Number(giorni) } : {}),
            //  Il server toglie il prezzo pieno dalle voci che ricopia: le
            //  opzioni non gliele rimanda il browser, quindi la modifica va
            //  DICHIARATA o si perderebbe nella copia.
            ...(upsellCambia ? { upsellSconti: false } : {}),
            //  Stessa ragione: le voci le ricopia il server dalla riga vecchia,
            //  quindi se vanno riprezzate deve saperlo — e le riprezza lui, con
            //  la stessa funzione che ha appena disegnato l'anteprima qui.
            ...(prezziOggi && prezziDiversi ? { prezziOggi: true } : {}),
            addCodes: aggiunti.map((c) => c.code),
            totali: {
              //  ⚠️ Solo i codici veri. Lo sconto quantità viene dal listino e
              //   non ha un codice; quello deciso dal consulente è una cifra,
              //   non una promozione. Scriverli qui vorrebbe dire che domani,
              //   riaprendo il preventivo, si andrebbero a cercare in tabella
              //   come se fossero codici — e non trovandoli lo sconto non si
              //   saprebbe più scomporre (vedi `vociSconto`).
              discountCode:
                preview.discounts
                  .filter(
                    (d) => d.kind !== "qty" && d.kind !== "consulente" && d.code !== "CONSULENTE",
                  )
                  .map((d) => d.code)
                  .join(", ") || null,
              discountEur: preview.discountEur,
              total: preview.total,
            },
          }),
        })
      ).json();
      if (!j?.ok) {
        sfx.error();
        setErr(
          j?.messaggio ||
            (j?.reason === "codice non valido"
              ? "PIN o codice consulente errato."
              : j?.reason === "codice sconto esaurito"
                ? "Questo codice sconto è esaurito."
                : j?.reason === "codice sconto non valido"
                  ? "Questo codice sconto non risulta attivo."
                  : j?.error === "permesso"
                    ? "Per cambiare le condizioni serve il permesso sul listino."
                    : "Modifica non riuscita: il preventivo NON è stato cambiato."),
        );
        return;
      }
      const nuovo: Snapshot = {
        ...preview,
        ref: String(j.ref),
        promoUntil: scadenzaNuova.toISOString(),
      };
      onSostituito(nuovo, snap.ref);
      sfx.success();
      toast.success(`Nuovo preventivo ${j.ref} · il precedente non è più valido`, {
        duration: 8000,
      });
    } catch {
      setErr("Errore di rete: il preventivo NON è stato cambiato.");
      sfx.error();
    } finally {
      setBusy(null);
    }
  };

  /** ── UN DOCUMENTO ANNULLATO NON SI MODIFICA ─────────────────────────────
   *  Al posto del pulsante, la strada. Il divieto lo fa il server (409, vedi la
   *  nota sulla prop `annullatoDa`); qui si evita solo di farcelo sbattere
   *  contro davanti al cliente — e si dice DOVE andare, perché «non si può»
   *  senza un dove è un vicolo cieco.
   *  ⚠️ Sostituisce il pulsante e non gli si aggiunge accanto: due comandi di
   *   cui uno inerte, in videochiamata, si premono nell'ordine sbagliato. */
  if (annullatoDa && annullatoDa !== snap.ref) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-rose-400/30 bg-rose-500/[0.07] px-4 py-2.5 text-[13px] text-white/75 print:hidden">
        <Ban className="h-3.5 w-3.5 flex-shrink-0 text-rose-300" />
        <span>
          Questo preventivo è annullato: si modifica il{" "}
          <a href={linkValido} className="font-mono font-semibold text-white underline">
            {annullatoDa}
          </a>
          , che è quello valido.
        </span>
        <span className="ml-auto text-[11px] text-white/30">riservato al consulente</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-5 flex w-full items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.025] px-4 py-2.5 text-left text-[13px] text-white/65 transition hover:border-white/25 hover:text-white print:hidden"
      >
        <Pencil className="h-3.5 w-3.5 text-white/45" />
        <span>Modifica questo preventivo</span>
        <span className="ml-auto text-[11px] text-white/30">riservato al consulente</span>
      </button>
    );
  }

  const campo =
    "rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/35 focus:bg-white/[0.08] focus:outline-none";
  const riga = "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.07] px-4 py-3";
  const voce = "w-40 flex-shrink-0 text-[13px] text-white/55";

  return (
    <div
      data-hg-noptr
      className="mb-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.02] print:hidden"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span className="text-[13px] font-semibold text-white">Modifica del preventivo</span>
        <span className="font-mono text-[12px] text-white/45">{snap.ref}</span>
        {scaduto && (
          <span className="text-[11.5px] text-white/45">
            · condizioni scadute il{" "}
            {new Date(snap.promoUntil).toLocaleDateString("it-IT", {
              day: "numeric",
              month: "long",
            })}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={riga}>
        <span className={voce}>PIN o codice consulente</span>
        <input
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setErr("");
          }}
          autoComplete="off"
          placeholder="••••••••"
          className={`${campo} w-40 tracking-[0.25em] placeholder:tracking-normal`}
        />
        <span className="text-[11.5px] text-white/35">
          Va bene il PIN del tuo account presentatore. Non compare a schermo mentre lo scrivi.
        </span>
      </div>

      <div className={riga}>
        <span className={voce}>Quantità impianti</span>
        <div className="flex items-center rounded-lg border border-white/15 bg-white/[0.05]">
          <button
            type="button"
            onClick={() => setNQty((q) => Math.max(1, q - 1))}
            className="px-2.5 py-1.5 text-white/60 hover:text-white"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums text-white">
            {nQty}
          </span>
          <button
            type="button"
            onClick={() => setNQty((q) => Math.min(9, q + 1))}
            className="px-2.5 py-1.5 text-white/60 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {nQty !== snap.qty && (
          <span className="text-[11.5px] text-white/35">in preventivo: {snap.qty}</span>
        )}
      </div>

      {/*  ── RIPARTIRE DAL PREZZO PIENO ───────────────────────────────────────
            Sta PRIMA del campo del codice perché è il primo gesto: si ripulisce
            il preventivo e poi si rimette quello che si vuole. È anche l'unico
            modo di togliere ciò che non si sa scomporre — gli sconti dei
            preventivi vecchi, quelli decisi a mano — perché non toglie voci:
            rifà il conto dal prezzo di listino di quello che il preventivo
            comprende, che è sempre lì sotto, in «Cosa comprende». */}
      <div className={riga}>
        <span className={voce}>Sconti</span>
        <button
          type="button"
          onClick={() => {
            setAzzera((v) => !v);
            setErr("");
          }}
          className={`rounded-lg border px-3 py-2 text-[12.5px] font-medium transition ${
            azzera
              ? "border-white/35 bg-white/[0.10] text-white"
              : "border-white/20 bg-white/[0.06] text-white/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          {azzera ? "Rimetti gli sconti di prima" : "Azzera tutti gli sconti"}
        </button>
        <span className="text-[11.5px] leading-snug text-white/40">
          {azzera ? (
            <>
              si riparte dal prezzo pieno di quello che il preventivo comprende:{" "}
              <b className="font-medium text-white/70">{formatPrice(preview.gross)}</b>. Da qui puoi
              rimettere i codici che vuoi.
            </>
          ) : snap.discountEur > 0 ? (
            <>
              adesso ci sono{" "}
              <b className="font-medium text-white/70">{formatPrice(snap.discountEur)}</b> di
              sconti. Azzerando si torna al prezzo pieno e si riparte da lì.
            </>
          ) : (
            <>su questo preventivo non c'è nessuno sconto da togliere.</>
          )}
        </span>
      </div>

      {/*  ── RIFARE IL PREVENTIVO COL LISTINO DI OGGI ────────────────────────
            Sta accanto all'azzeramento degli sconti perché sono i due gesti che
            rimettono il preventivo in pari, ma toccano cose diverse e vanno
            tenuti separati: quello sopra ripulisce gli SCONTI, questo aggiorna i
            PREZZI. Si possono usare insieme — prima si riporta il listino a
            oggi, poi si azzera e si rimettono i codici che si vogliono. */}
      <div className={riga}>
        <span className={voce}>Prezzi del listino</span>
        <button
          type="button"
          onClick={() => {
            setPrezziOggi((v) => !v);
            setErr("");
          }}
          className={`rounded-lg border px-3 py-2 text-[12.5px] font-medium transition ${
            prezziOggi
              ? "border-white/35 bg-white/[0.10] text-white"
              : "border-white/20 bg-white/[0.06] text-white/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          {prezziOggi ? "Tieni i prezzi del preventivo" : "Aggiorna ai prezzi di oggi"}
        </button>
        <span className="text-[11.5px] leading-snug text-white/40">
          {!prezziDiversi ? (
            <>le voci di questo preventivo sono già ai prezzi di oggi: non cambierebbe niente.</>
          ) : prezziOggi ? (
            <>
              stesse scelte, prezzi correnti: il listino passa da {formatPrice(base.gross)} a{" "}
              <b className="font-medium text-white/70">{formatPrice(oggi.gross)}</b>.
            </>
          ) : (
            <>
              questo preventivo ha i prezzi del giorno in cui è nato. Oggi le stesse voci farebbero{" "}
              <b className="font-medium text-white/70">{formatPrice(oggi.gross)}</b> di listino,
              invece di {formatPrice(base.gross)}.
            </>
          )}
        </span>
      </div>

      {/*  ── I PREZZI BARRATI DELLE PERSONALIZZAZIONI ────────────────────────
            Compare solo se ce n'è davvero uno da spegnere. Spegnendolo il
            cliente paga esattamente la stessa cifra: sparisce il «390,00 €»
            sbarrato accanto alla voce e sparisce la tessera «Personalizzazioni»
            dal riepilogo degli sconti. */}
      {scontiUpsellOra && (
        <div className={riga}>
          <span className={voce}>Prezzi barrati</span>
          <div className="flex items-center rounded-xl border border-white/15 bg-black/20 p-1">
            {[
              { v: true, t: "Mostrali" },
              { v: false, t: "Nascondili" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setUpsellSconti(o.v)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  (upsellSconti ?? true) === o.v
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
          <span className="text-[11.5px] leading-snug text-white/40">
            {upsellSconti === false ? (
              <>
                le personalizzazioni non si presentano più come scontate: il prezzo che c&apos;è
                diventa <b className="font-medium text-white/70">il prezzo</b>. Il cliente paga
                sempre {formatPrice(preview.total)}.
              </>
            ) : (
              <>
                oggi il cliente vede {formatPrice(risparmioUpsell)} di sconto sulle
                personalizzazioni, col prezzo pieno sbarrato accanto a ogni voce.
              </>
            )}
          </span>
        </div>
      )}

      <div className={riga}>
        <span className={voce}>Codice sconto</span>
        <input
          value={codice}
          onChange={(e) => setCodice(e.target.value.toUpperCase())}
          placeholder="es. VIDEO50"
          className={`${campo} w-36 font-mono`}
        />
        <button
          type="button"
          disabled={!codice.trim() || busy !== null}
          onClick={() => void verificaCodice()}
          className="rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-[12.5px] font-medium text-white hover:bg-white/10 disabled:opacity-40"
        >
          {busy === "codice" ? "…" : "Metti in conto"}
        </button>
        {/*  I codici in conto adesso: si tolgono con un tocco, perché finché non
             si preme «Applica le modifiche» non è stato scritto niente. */}
        {aggiunti.map((c) => (
          <button
            key={`nuovo-${c.code}`}
            type="button"
            disabled={busy !== null}
            onClick={() => setAggiunti((l) => l.filter((x) => x.code !== c.code))}
            title="Togli dal conto"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/[0.08] px-2 py-1 text-[11.5px] text-white hover:border-white/40 disabled:opacity-50"
          >
            <span className="font-mono">{c.code}</span> −{formatPrice(c.eur)}{" "}
            <X className="h-3 w-3 text-white/45" />
          </button>
        ))}
        {/*  Quelli già applicati a questo preventivo — alla creazione o con una
             modifica successiva: toglierne uno è una modifica come le altre, e
             vale lo stesso gesto finale. Sbarrato = sta uscendo dal preventivo;
             un tocco lo rimette dentro. */}
        {esistenti.map((c) => {
          //  Azzerando se ne vanno tutti insieme: le pastiglie si sbarrano da
          //  sé e non si toccano più una per una, o si direbbe che una si può
          //  salvare mentre il conto dice il contrario.
          const via = azzera || !attivo(c);
          return (
            <button
              key={c.code}
              type="button"
              disabled={busy !== null}
              onClick={() =>
                setTolti((l) =>
                  via ? l.filter((x) => x !== c.code.toUpperCase()) : [...l, c.code.toUpperCase()],
                )
              }
              title={via ? "Rimettilo nel conto" : "Togli questo codice"}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] disabled:opacity-50 ${
                via
                  ? "border-white/10 bg-transparent text-white/35 line-through decoration-white/30"
                  : "border-white/15 bg-white/[0.05] text-white/75 hover:border-white/30 hover:text-white"
              }`}
            >
              <span className="font-mono">{c.code}</span> −{formatPrice(c.eur)}{" "}
              <X className="h-3 w-3 text-white/40" />
            </button>
          );
        })}
        {nonScomponibile && !azzera && (
          <span className="basis-full text-[11.5px] leading-snug text-amber-200/70">
            Lo sconto già applicato a questo preventivo non è scomponibile voce per voce: un codice
            aggiunto qui <b className="font-semibold">si somma</b> a quello che c'è, non lo
            sostituisce. Se vuoi ripartire pulito, usa «Azzera tutti gli sconti» qui sopra.
          </span>
        )}
      </div>

      <div className={riga}>
        <span className={voce}>Validità condizioni</span>
        <input
          value={giorni}
          onChange={(e) => setGiorni(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric"
          placeholder="giorni"
          className={`${campo} w-24`}
        />
        <span className="text-[11.5px] text-white/40">
          {nuovaScadenza ? (
            <>
              il preventivo nuovo varrà fino a{" "}
              <b className="font-medium text-white/70">
                {nuovaScadenza.toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </b>
            </>
          ) : (
            <>
              oggi valgono fino al {giorno(snap.promoUntil)} — vuoto: il preventivo nuovo riparte
              dalla durata standard, fino al{" "}
              <b className="font-medium text-white/70">{giorno(scadenzaNuova)}</b>
            </>
          )}
        </span>
      </div>

      {/* ── RIEPILOGO DELLE MODIFICHE ─────────────────────────────────────────
          Incolonnato come una fattura. È la parte che si legge insieme al
          cliente, quindi dice per intero anche ciò che peggiora. */}
      <div className="border-t border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Cosa cambia
        </p>
        {!cambia ? (
          <p className="mt-2 text-[12.5px] text-white/45">
            Nessuna modifica impostata. I valori qui sopra sono quelli attuali del preventivo.
          </p>
        ) : (
          <>
            <dl className="mt-2.5 space-y-1.5">
              {righe.map((r) => (
                <div key={r.voce} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <dt className="min-w-0 text-white/60">{r.voce}</dt>
                  <dd className="whitespace-nowrap tabular-nums text-white/80">
                    {r.da && (
                      <>
                        <span className="text-white/35">{r.da}</span>
                        <span className="mx-1.5 text-white/25">→</span>
                      </>
                    )}
                    <span className="font-semibold text-white">{r.a}</span>
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.09] pt-2 text-[14px]">
                <dt className="font-medium text-white/70">Totale</dt>
                <dd className="whitespace-nowrap tabular-nums">
                  {snap.total !== preview.total && (
                    <>
                      <span className={`${BARRATO_CLASSI} text-[14px]`}>
                        {formatPrice(snap.total)}
                      </span>
                      <span className="mx-1.5 text-white/25">→</span>
                    </>
                  )}
                  <span className="text-base font-bold text-white">
                    {formatPrice(preview.total)}
                  </span>
                </dd>
              </div>
            </dl>

            {/* La nota sulla quantità: per esteso, con il conto già fatto. */}
            {nQty !== snap.qty && (
              <p className="mt-3 border-l-2 border-white/15 pl-3 text-[12.5px] leading-relaxed text-white/55">
                {qtaDopo > qtaPrima ? (
                  <>
                    Portando la quantità a{" "}
                    <b className="font-semibold text-white/85">{nQty} impianti</b> si applica lo
                    sconto quantità previsto dal listino:{" "}
                    <b className="font-semibold text-white/85">{formatPrice(qtaDopo)}</b> in tutto,
                    pari a{" "}
                    <b className="font-semibold text-white/85">{formatPrice(qtaDopo / nQty)}</b> per
                    impianto. Il costo di ogni impianto passa da {formatPrice(unitPrima)} a{" "}
                    <b className="font-semibold text-white/85">{formatPrice(unitDopo)}</b>.
                  </>
                ) : qtaDopo < qtaPrima ? (
                  <>
                    Scendendo a{" "}
                    <b className="font-semibold text-white/85">
                      {nQty === 1 ? "un impianto" : `${nQty} impianti`}
                    </b>{" "}
                    lo sconto quantità di {formatPrice(qtaPrima)} non si applica più
                    {qtaDopo > 0 ? (
                      <>
                        : resta quello previsto per {nQty} impianti, {formatPrice(qtaDopo)}.
                      </>
                    ) : (
                      <>.</>
                    )}{" "}
                    Il costo per impianto torna a{" "}
                    <b className="font-semibold text-white/85">{formatPrice(unitDopo)}</b>.
                  </>
                ) : (
                  <>
                    Per {nQty} impianti il listino non prevede uno sconto quantità: il costo per
                    impianto resta {formatPrice(unitDopo)}.
                  </>
                )}
              </p>
            )}
          </>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null || !cambia}
            onClick={() => void applica()}
            className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {busy === "salva" ? "Emetto…" : "Applica le modifiche"}
          </button>
          {cambia && (
            <button
              type="button"
              onClick={() => {
                setNQty(snap.qty);
                setAggiunti([]);
                setTolti([]);
                setAzzera(false);
                setUpsellSconti(null);
                setPrezziOggi(false);
                setGiorni("");
                setErr("");
              }}
              className="rounded-lg border border-white/15 px-3 py-2 text-[12.5px] font-medium text-white/60 hover:bg-white/5 hover:text-white"
            >
              Annulla
            </button>
          )}
          {err && <span className="text-[12.5px] font-medium text-destructive">{err}</span>}
          {/*  ⚠️ Questa frase diceva il contrario, ed era la descrizione del
               comportamento vecchio: «Il preventivo originale resta agli atti: le
               modifiche sono registrate a parte». Adesso il documento precedente
               si disattiva davvero, e chi preme deve saperlo PRIMA di premere —
               una riga a schermo che racconta un'altra procedura è peggio di
               nessuna riga. */}
          <span className="ml-auto max-w-[22rem] text-right text-[11px] leading-snug text-white/30">
            Ne nasce un preventivo NUOVO, con un numero nuovo. Il {snap.ref} smette di valere e il
            suo link porterà a quello nuovo.
          </span>
        </div>
      </div>
    </div>
  );
}

/** ── CONDIZIONI APPLICATE AL PREVENTIVO ────────────────────────────────────
 *  Il blocco precedente metteva tutto in una colonna sola — sconti di listino,
 *  codice promozionale, scadenza — e finiva per dire una cosa sbagliata: che
 *  l'impianto "in realtà" costa meno. Il valore del prodotto non si tocca:
 *  quello che è scontato sono le PERSONALIZZAZIONI, ed è giusto vederlo voce
 *  per voce, con accanto il prezzo pieno da cui si parte.
 *
 *  Le due condizioni hanno regole diverse e vanno separate, perché è la loro
 *  differenza a renderle credibili:
 *   · gli sconti sulle personalizzazioni SCADONO in una data precisa;
 *   · la video testimonianza vale FINO A ESAURIMENTO POSTI — non ha una data,
 *     ha un numero.
 *  Una promozione che scade "quando finisce tutto insieme" si riconosce a
 *  distanza come finta. Due meccaniche distinte, ciascuna con la sua ragione,
 *  è come funzionano le condizioni vere. */
function CondizioniApplicate({ r }: { r: Snapshot }) {
  //  Il dettaglio parte chiuso: la prima cosa da capire è QUANTI sconti ci
  //  sono, non da quali voci vengono. Chi vuole controllare apre.
  const [dettaglio, setDettaglio] = useState(false);
  const posti = r.scarcity?.text?.trim() || "";
  const until = new Date(r.promoUntil);
  // promoUntil è una STRINGA, e arriva anche da un campo che si compila a mano
  // in CRM: se non è una data leggibile `until` resta un Invalid Date e finisce
  // stampato al cliente come "Valide fino a Invalid Date NaN" — con `scaduto`
  // che vale false, quindi con l'aria di una promozione ancora buona. Qui non
  // si corregge nessuna condizione: sparisce solo la data che non sappiamo
  // scrivere, e con essa la riga che la annuncia.
  const dataValida = !Number.isNaN(until.getTime());
  const scaduto = dataValida && until.getTime() < Date.now();

  // Un preventivo può arrivare senza voci o senza sconti — riletto da un
  // database vecchio, ricevuto a metà dal canale della diretta. Qui si legge
  // solo, quindi si legge da elenchi che ESISTONO di sicuro: senza questi due
  // controlli un campo mancante spegne l'intera pagina invece di far sparire
  // un blocco. I numeri restano quelli che sono: si difende la forma, non i
  // valori.
  const vociQuote = Array.isArray(r.items) ? r.items : [];
  const scontiQuote = Array.isArray(r.discounts) ? r.discounts : [];

  // sconti di listino sulle singole personalizzazioni (× quantità)
  const righeUpsell = vociQuote
    .map((i) => ({ name: i.name, was: Number(i.wasPrice) || 0, price: Number(i.price) || 0 }))
    .filter((i) => i.was > i.price)
    .map((i) => ({ ...i, saving: (i.was - i.price) * Math.max(1, Number(r.qty) || 1) }));
  const totUpsell = righeUpsell.reduce((t, i) => t + i.saving, 0);

  const codici = scontiQuote.filter(
    (d) =>
      d.kind !== "qty" &&
      d.kind !== "altro" &&
      d.kind !== "consulente" &&
      d.code !== "CONSULENTE" &&
      Number(d.eur) > 0,
  );
  //  «altro» è la parte di sconto che non si è riusciti ad attribuire a un
  //  codice (vedi `vociSconto`): sta con le condizioni di listino, dove il
  //  cliente la legge come uno sconto già applicato — e non fra i coupon, dove
  //  si porterebbe dietro un nome di codice che non le appartiene.
  const qtaRighe = scontiQuote.filter(
    (d) => (d.kind === "qty" || d.kind === "altro") && Number(d.eur) > 0,
  );
  //  Riconosciuto anche per codice oltre che per tipo: i preventivi già emessi
  //  prima di questa correzione non hanno il campo, e continuerebbero a
  //  comparire fra i coupon.
  const consulenteRighe = scontiQuote.filter(
    (d) => (d.kind === "consulente" || d.code === "CONSULENTE") && Number(d.eur) > 0,
  );
  // (qui si calcolavano anche i subtotali per codice e per quantità, ma non
  //  venivano mostrati da nessuna parte: ogni voce porta già il suo importo)

  if (!righeUpsell.length && !codici.length && !qtaRighe.length) return null;

  /** ── QUANTI SCONTI HAI ADDOSSO, E FINO A QUANDO ─────────────────────────
   *  Il blocco raccontava benissimo OGNI sconto e malissimo QUANTI ne hai: per
   *  saperlo bisognava scorrere quattro gruppi, leggere quattro titoli e
   *  sommare a mente quattro cifre. Chi guarda un preventivo dal telefono non
   *  lo fa — e resta con l'impressione di aver ricevuto «uno sconto», al
   *  singolare, qualunque sia il numero vero.
   *  Qui sopra ci sono tutte le famiglie attive, una tessera ciascuna: cosa,
   *  quanto, e la regola che la tiene in piedi. Sotto, il totale. Il dettaglio
   *  voce per voce resta — è la prova, e va conservata — ma si apre a richiesta:
   *  una prova che si legge solo se la si cerca non fa rumore, e questo blocco
   *  ne faceva tanto.
   *  ⚠️ Ogni tessera porta la sua regola, e le regole sono DIVERSE: una data,
   *   dei posti, l'ordine. È la loro differenza a renderle credibili — sconti
   *   che finiscono tutti insieme lo stesso giorno si riconoscono come finti. */
  const totCodici = codici.reduce((t, d) => t + (Number(d.eur) || 0), 0);
  const totQta = qtaRighe.reduce((t, d) => t + (Number(d.eur) || 0), 0);
  const totCons = consulenteRighe.reduce((t, d) => t + (Number(d.eur) || 0), 0);
  const dataBreve = dataValida
    ? until.toLocaleDateString("it-IT", { day: "numeric", month: "long" })
    : "";
  //  ⚠️ UNA DATA SOLA PER TUTTI, e prima non era così: ogni famiglia aveva la
  //   sua regola — una data, dei posti, l'ordine — nella convinzione che regole
  //   diverse rendessero le condizioni più credibili. Nella pratica il cliente
  //   si trovava tre scadenze da tenere a mente e finiva per non fidarsi di
  //   nessuna. Adesso valgono tutte fino allo stesso giorno, detto UNA volta in
  //   cima: una condizione che si ricorda è una condizione che fa decidere.
  //   I nomi sono corti di proposito: su una tessera un titolo che va a capo
  //   sfalsa la cifra sotto, e tre cifre non allineate non si confrontano.
  const famiglie: { k: string; nome: string; eur: number; Icona: typeof Percent }[] = [];
  if (totUpsell > 0)
    famiglie.push({ k: "pers", nome: "Personalizzazioni", eur: totUpsell, Icona: Percent });
  if (totCodici > 0)
    famiglie.push({ k: "codici", nome: "Video testimonianza", eur: totCodici, Icona: Video });
  if (totQta > 0)
    famiglie.push({
      k: "qta",
      nome: qtaRighe.some((d) => d.kind === "qty") ? "Quantità" : "Sconto applicato",
      eur: totQta,
      Icona: Package,
    });
  if (totCons > 0)
    famiglie.push({ k: "cons", nome: "Consulente", eur: totCons, Icona: BadgePercent });
  const totaleSconti = famiglie.reduce((t, f) => t + f.eur, 0);

  // ── LA PASTIGLIA DELLA REGOLA ──────────────────────────────────────────
  //  Dice PERCHÉ quella condizione esiste ("entro il 12 agosto", "restano 10
  //  posti"). Aveva due vestiti diversi — uno neutro e uno ambra acceso — e in
  //  grassetto pesava quanto il titolo che accompagnava: due elementi che
  //  gridano insieme si annullano, e il titolo del gruppo smetteva di essere
  //  il punto d'ingresso della riga.
  //  Ora una sola pastiglia per tutti: stessa forma, stesso colore neutro,
  //  peso medio. La gerarchia la fanno colore e peso, non la dimensione — così
  //  resta a 14px, la misura minima leggibile in un documento che il cliente
  //  guarda dal telefono. L'ambra sparisce da qui perché in questo blocco ha
  //  un solo compito: segnalare il tempo, in fondo, sulla riga della scadenza.
  const Chip = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex flex-shrink-0 items-center rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-[3px] text-[14px] font-medium leading-snug text-white/60">
      {children}
    </span>
  );

  /** Quanto pesa questo sconto sul listino di partenza. Sotto l'1% non si
   *  scrive: una percentuale che arrotonda a zero fa sembrare finto il conto. */
  const perc = (saving: number) => {
    const base = (r.gross || 0) + righeUpsell.reduce((t, i) => t + i.saving, 0);
    if (!base || !saving) return "";
    const p = (saving / base) * 100;
    return p >= 1 ? `${p.toFixed(0)}%` : "";
  };
  //  ── UNA VOCE DELLO SCONTO ──────────────────────────────────────────────
  //   Una riga, quattro informazioni, e una gerarchia dichiarata:
  //
  //     ┌──────────────────────────────────────────────────────────┐
  //     │ 2 impianti                            −37%    −973,82 €  │
  //     │ 2̶.̶6̶3̶2̶,̶0̶0̶ ̶€̶  1.658,18 €                                   │
  //     └──────────────────────────────────────────────────────────┘
  //
  //   ⚠️ IL PREZZO DI PARTENZA ADESSO È BARRATO, e prima era «2.632,00 € →
  //    1.658,18 €». La freccia costringeva a LEGGERE per capire in che verso
  //    andava il conto; la barratura lo dice senza parole e senza simboli — è la
  //    convenzione che il cliente ha già visto mille volte su ogni cartellino, e
  //    non ha bisogno di essere imparata qui.
  //
  //   ⚠️ LA PERCENTUALE ERA UN GRIGIO SOTTO L'IMPORTO, e nella pratica non la
  //    leggeva nessuno: era la cosa più piccola e più scolorita della riga
  //    proprio mentre è quella che dice l'ENTITÀ dello sconto. «−973,82 €» da
  //    solo non si sa se è tanto o poco finché non lo si rapporta a qualcosa, e
  //    quel rapporto è il −37%.
  //    Adesso è una pastiglia verde accanto all'importo. Accanto e non sotto: si
  //    leggono insieme perché sono la stessa frase — «trentasette per cento, che
  //    fa novecentosettantatré euro». Il vecchio ragionamento («accanto si
  //    contendono la riga») valeva quando erano due numeri dello stesso peso; una
  //    pastiglia piccola e tinta accanto a una cifra grande e piena non compete,
  //    la introduce.
  //
  //   PROTAGONISTA RESTA L'IMPORTO IN EURO: è la cifra che il cliente confronta
  //   con quello che ha in tasca, e una percentuale va prima convertita — dal
  //   telefono non lo fa nessuno. Quindi l'euro è l'ultimo elemento della riga,
  //   il più grande e il più pieno: è lì che l'occhio si ferma.
  //
  //   ⚠️ E LA RIGA ADESSO È UN RIQUADRO. Erano voci separate da spazio, e con
  //    quattro dati per riga lo spazio non bastava più a dire dove finiva una e
  //    cominciava l'altra: scorrendo col pollice, il prezzo barrato di una si
  //    leggeva sotto il nome di quella dopo. Un fondo appena accennato costa
  //    pochissimo inchiostro e chiude il gruppo di quattro dati in un oggetto
  //    solo.
  const Voce = ({
    nome,
    was,
    prezzo,
    saving,
  }: {
    nome: string;
    was?: number;
    prezzo?: number;
    saving: number;
  }) => {
    const pct = perc(saving);
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
        <div className="min-w-0 flex-1">
          {/* va a capo, non si tronca: mezza parola non dice cosa è scontato */}
          <p className="text-[15px] font-semibold leading-snug text-white">{nome}</p>
          {typeof was === "number" && (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2.5 text-[13.5px] leading-snug tabular-nums">
              {/*  ⚠️ IL BARRATO NON SI SBIADISCE ───────────────────────────
                  Era al 45% e senza barra colorata: sparito. Ma è il prezzo
                  che dà la misura dello sconto — se non si legge, il numero
                  accanto non sembra più un affare. Stessa resa in tutta la
                  pagina: bianco leggibile e barra rossa netta.
                  ⚠️ E compare SOLO se è più alto del prezzo: un "prima"
                  uguale al "dopo" non è uno sconto, è un numero in più. Il
                  prezzo che si paga invece resta sempre scritto. */}
              {was > (prezzo ?? 0) && (
                <span className={`${BARRATO_CLASSI} text-[14px]`}>{formatPrice(was)}</span>
              )}
              {/*  ⚠️ E il prezzo che si paga resta il più forte dei due: un
                  barrato leggibile va bene, un barrato che grida più del
                  prezzo vero no. */}
              <span className="text-[15px] font-bold text-white">
                {prezzo === 0 ? "incluso" : formatPrice(prezzo ?? 0)}
              </span>
            </p>
          )}
        </div>
        {/* cifre tabellari: le colonne di importi si incolonnano davvero solo
            se ogni cifra occupa la stessa larghezza */}
        <div className="flex flex-shrink-0 items-center gap-2.5">
          {pct && (
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-[3px] text-[12.5px] font-bold leading-none tabular-nums text-emerald-200">
              −{pct}
            </span>
          )}
          <p className="text-[17px] font-extrabold leading-none tracking-tight tabular-nums text-emerald-300">
            −{formatPrice(saving)}
          </p>
        </div>
      </div>
    );
  };

  /** ── UN GRUPPO DEL DETTAGLIO ───────────────────────────────────────────
   *  L'intestazione era ricopiata quattro volte — titolo, pastiglia della
   *  scadenza, e in un caso un totale in fondo scritto in un modo tutto suo.
   *  Quattro copie della stessa fila sono quattro posti in cui un ritocco
   *  arriva in tre.
   *
   *  ⚠️ IL TOTALE DEL GRUPPO COMPARE SOLO DA DUE VOCI IN SU, ed è la stessa
   *   regola del riquadro grande in cima: un totale che somma un addendo non è
   *   un totale, è la stessa cifra scritta due volte a due centimetri di
   *   distanza — e chi legge si ferma a cercare la differenza, che non c'è.
   *   Il gruppo «Sconto quantità» ha quasi sempre una voce sola, ed era
   *   esattamente il caso in cui si vedeva.
   *  ⚠️ E STA NELL'INTESTAZIONE, non in fondo: in cima si legge insieme al
   *   titolo — «personalizzazioni, −225 €» — e chiude la domanda prima di
   *   entrare nell'elenco. In fondo la chiudeva dopo, cioè per chi aveva già
   *   letto tutte le voci e non ne aveva più bisogno. */
  const Gruppo = ({
    titolo,
    totale,
    voci,
    children,
  }: {
    titolo: string;
    totale: number;
    /** quante voci ci sono dentro: decide se il totale ha senso */
    voci: number;
    children: React.ReactNode;
  }) => (
    <div className="border-b border-white/[0.07] px-4 py-5 sm:px-5">
      {/*  ── L'INTESTAZIONE SPARISCE QUANDO IL GRUPPO È UNO SOLO ────────────
          ⚠️ Con una famiglia sola il dettaglio ridiceva parola per parola il
           riquadro verde due centimetri sopra: «Sconto quantità · scaduto ·
           −973,82 €» sotto «Sconto quantità · −973,82 €». Il dettaglio serve a
           dire DA DOVE VIENE quella cifra — «2 impianti, −37%» — non a
           ripeterne il nome, e chi lo apre lo ha appena letto.
          Con due gruppi o più l'intestazione torna e serve davvero: lì bisogna
          sapere dove finisce uno e comincia l'altro. */}
      {famiglie.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h3 className="text-[16px] font-bold text-white">{titolo}</h3>
            {/* niente pastiglia se la data non si sa leggere: meglio nessuna
                regola che una regola scritta "entro Invalid Date" */}
            {dataValida && <Chip>{scaduto ? "scaduto" : `fino al ${dataBreve}`}</Chip>}
          </div>
          {voci > 1 && (
            <span className="text-[16px] font-bold tabular-nums text-emerald-300">
              −{formatPrice(totale)}
            </span>
          )}
        </div>
      )}
      {/*  Due pixel fra un riquadro e l'altro: adesso a raggruppare è il fondo
          della voce, non lo spazio attorno. Con `space-y-5` le righe
          galleggiavano lontanissime e il gruppo si leggeva come quattro cose
          separate invece che come un elenco. */}
      <div className="space-y-2">{children}</div>
    </div>
  );

  return (
    <div
      data-hg-anchor="res-blocco-promo"
      className="mb-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.025]"
    >
      {/* ── L'INTESTAZIONE DEL BLOCCO ────────────────────────────────────────
          Era una soprascritta da 11px maiuscola al 45%: il titolo della sezione
          che il cliente rilegge PRIMA di pagare era la scritta più piccola
          della pagina. Ora è un titolo come gli altri (17px), e la riga che
          spiega a cosa serve sta sotto, leggibile, invece che appesa a destra
          in grigio fumo. */}
      {/* ── L'INTESTAZIONE, E LA DATA CHE VALE PER TUTTI ────────────────────
          Titolo e scadenza sulla stessa riga, ai due estremi: sono le due cose
          che si leggono per prime — quanti sconti hai e fino a quando — e
          separarle su due righe faceva perdere la seconda.
          La pastiglia della data è ambra e non verde: il verde in questo blocco
          vuol dire «euro risparmiati», e l'unica altra informazione che deve
          fermare l'occhio è il tempo. Due colori, due significati. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold leading-snug text-white">
            {famiglie.length > 1
              ? `Hai ${famiglie.length} sconti attivi`
              : "Lo sconto attivo su questo preventivo"}
          </h2>
          <p className="mt-0.5 text-[14px] leading-snug text-white/55">
            Sono già dentro al totale che vedi in cima.
          </p>
        </div>
        {dataValida && (
          <span
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
              scaduto
                ? "border-white/15 bg-white/[0.05] text-white/55"
                : "border-amber-300/40 bg-amber-300/10 text-amber-100"
            }`}
          >
            <CalendarClock className="h-4 w-4" />
            {scaduto
              ? `scaduti il ${dataBreve} ${until.getFullYear()}`
              : `tutti validi fino al ${dataBreve} ${until.getFullYear()}`}
          </span>
        )}
      </div>

      {/* ── LE TESSERE, E QUANDO NON SERVONO ──────────────────────────────────
          Una tessera per famiglia — icona, nome, cifra — più il totale sotto.
          ⚠️ CON UNA FAMIGLIA SOLA ERANO DUE RIQUADRI PER UN NUMERO SOLO: la
           tessera diceva «Quantità −973,82 €» e la riga sotto ripeteva
           «Risparmio totale −973,82 €», stessa cifra a due centimetri di
           distanza. Un totale che somma un addendo non è un totale, è
           un'eco — e chi legge si ferma a cercare la differenza fra i due
           numeri, che non c'è. Da una famiglia sola si disegna UN riquadro,
           quello grande, con dentro il nome della famiglia: cosa si è
           risparmiato e quanto, in una riga.
          La fila di tessere torna appena le famiglie sono due o più, dove il
          totale ha finalmente qualcosa da sommare. */}
      <div className="px-4 py-4 sm:px-5">
        {famiglie.length > 1 && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {famiglie.map((f) => (
              <div
                key={f.k}
                className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 transition hover:border-emerald-400/30"
              >
                <p className="flex items-center gap-2 text-[13px] font-medium leading-snug text-white/65">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-400/12">
                    <f.Icona className="h-[15px] w-[15px] text-emerald-300" />
                  </span>
                  <span className="min-w-0 truncate">{f.nome}</span>
                </p>
                <p className="mt-3 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-emerald-300">
                  −{formatPrice(f.eur)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── LA CIFRA ───────────────────────────────────────────────────────
            Con più famiglie è la SOMMA delle tessere qui sopra, e va vista come
            tale: larga quanto la fila, staccata, con la cifra più grande del
            blocco. Con una famiglia sola è semplicemente quello sconto, detto
            per nome — e allora si porta dentro la sua icona, che altrimenti
            sarebbe sparita insieme alla tessera. */}
        <div
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-3.5 ${
            famiglie.length > 1 ? "mt-3" : ""
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold text-white">
            {famiglie.length === 1 && (
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-400/12">
                {(() => {
                  const Icona = famiglie[0].Icona;
                  return <Icona className="h-[15px] w-[15px] text-emerald-300" />;
                })()}
              </span>
            )}
            <span className="min-w-0">
              {famiglie.length === 1
                ? `Sconto ${famiglie[0].nome.toLowerCase()}`
                : "Risparmio totale su questo preventivo"}
            </span>
          </span>
          <span className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-emerald-300">
            −{formatPrice(totaleSconti)}
          </span>
        </div>
      </div>

      {/* Il dettaglio è la PROVA, e una prova va conservata — ma non messa
          davanti a chi non l'ha chiesta: aperta di default, riempiva lo schermo
          di righe e faceva perdere il conto degli sconti dentro l'elenco delle
          voci. */}
      <button
        type="button"
        onClick={() => setDettaglio((v) => !v)}
        className="flex w-full items-center justify-center gap-2 border-b border-white/[0.07] px-4 py-3 text-[13.5px] font-medium text-white/60 transition hover:bg-white/[0.03] hover:text-white sm:px-5"
      >
        {dettaglio ? "Nascondi il dettaglio" : "Vedi da dove viene, voce per voce"}
        <ChevronDown className={`h-4 w-4 transition-transform ${dettaglio ? "rotate-180" : ""}`} />
      </button>

      {dettaglio && (
        <>
          {/* ── I QUATTRO GRUPPI ────────────────────────────────────────────
              Stessa forma per tutti e quattro — titolo, pastiglia della
              scadenza, totale se le voci sono più d'una — e la forma sta in un
              posto solo (`Gruppo`, qui sopra). Erano quattro intestazioni
              ricopiate, con un totale scritto in fondo a una sola di loro in un
              modo tutto suo: quattro copie della stessa fila sono quattro posti
              in cui un ritocco ne raggiunge tre. */}
          {righeUpsell.length > 0 && (
            <Gruppo
              titolo="Sconti sulle personalizzazioni"
              totale={totUpsell}
              voci={righeUpsell.length}
            >
              {righeUpsell.map((i, idx) => (
                <Voce
                  key={`${i.name}-${idx}`}
                  nome={i.name}
                  was={i.was}
                  prezzo={i.price}
                  saving={i.saving}
                />
              ))}
            </Gruppo>
          )}

          {/* 2 — video testimonianza: la validità è quella di tutti (in cima al
              blocco), il numero dei posti resta come nota perché è vero. */}
          {codici.length > 0 && (
            <Gruppo titolo="Video testimonianza" totale={totCodici} voci={codici.length}>
              {codici.map((d, idx) => (
                <Voce
                  key={`${d.code}-${idx}`}
                  nome={`Codice ${d.code}${d.label ? ` · ${d.label}` : ""}`}
                  saving={Number(d.eur) || 0}
                />
              ))}
              {posti && (
                <p className="pt-1 text-[13.5px] leading-relaxed text-white/55">
                  {posti.replace(/^Restano solo /i, "Restano ")}
                </p>
              )}
            </Gruppo>
          )}

          {/* 2bis — lo sconto deciso dal consulente: non è un codice, non ha
              posti né scadenza. Ha un gruppo suo perché mescolarlo ai coupon
              faceva leggere al cliente una promozione che non esiste. */}
          {consulenteRighe.length > 0 && (
            <Gruppo titolo="Sconto del consulente" totale={totCons} voci={consulenteRighe.length}>
              {consulenteRighe.map((d, idx) => (
                <Voce
                  key={`cons-${idx}`}
                  nome={d.label || "Sconto applicato in consulenza"}
                  saving={Number(d.eur) || 0}
                />
              ))}
            </Gruppo>
          )}

          {/* 3 — quantità.
              ⚠️ Qui dentro finiscono anche le voci `altro`, cioè la parte di
              sconto che non si è riusciti ad attribuire a un codice preciso. Il
              titolo allora NON può dire «Sconto quantità»: su un preventivo da
              un impianto il cliente leggerebbe il nome di uno sconto che non gli
              è stato fatto. Il titolo lo decide quello che c'è davvero dentro. */}
          {qtaRighe.length > 0 && (
            <Gruppo
              titolo={
                qtaRighe.some((d) => d.kind === "qty") ? "Sconto quantità" : "Sconto applicato"
              }
              totale={totQta}
              voci={qtaRighe.length}
            >
              {qtaRighe.map((d, idx) => (
                <Voce
                  key={`${d.code}-${idx}`}
                  nome={
                    d.label
                      ? `${d.label}`
                      : d.kind === "altro"
                        ? "Sconto già applicato"
                        : "Più impianti insieme"
                  }
                  saving={Number(d.eur) || 0}
                />
              ))}
            </Gruppo>
          )}
        </>
      )}

      {/* ── COSA COMPORTA LA SCADENZA ────────────────────────────────────────
          ⚠️ QUI C'ERA LA DATA UNA SECONDA VOLTA. La pastiglia in cima diceva
           «scaduti il 20 agosto» e questa riga, quattro centimetri sotto,
           «Condizioni scadute il Giovedì 20 agosto 2026»: la stessa scadenza
           detta due volte con due vestiti diversi, che è il modo più efficace
           di far rileggere due volte una cosa già capita. La data si scrive UNA
           volta sola, nella pastiglia in cima — che adesso porta anche l'anno,
           perché era l'unico pezzo che stava soltanto qui.
          Resta quello che la pastiglia non può dire: cosa comporta. Sono le due
          frasi che cambiano la decisione — «l'acconto le blocca» prima, «vanno
          riviste» dopo — e valgono una riga a testa.
          L'ambra resta solo qui, ed è l'unico altro colore del blocco: segnala
          il tempo, come il verde segnala il risparmio. */}
      {dataValida && (
        <div className="flex items-start gap-3 bg-white/[0.02] px-4 py-3.5 sm:px-5">
          <CalendarClock
            className={`mt-0.5 h-[18px] w-[18px] flex-shrink-0 ${scaduto ? "text-white/35" : "text-amber-300/80"}`}
          />
          <span className="text-[14.5px] leading-relaxed text-white/65">
            {scaduto
              ? "Sono scadute: vanno riviste sui prezzi correnti."
              : "L'acconto le blocca su questo preventivo."}
          </span>
        </div>
      )}
    </div>
  );
}

function PromoLock({
  saving,
  until,
  acconto,
  variant,
  items,
  gross,
  total,
  bloccoPrezzo,
}: {
  saving: number;
  until: Date;
  acconto: number;
  variant: "riepilogo" | "preventivo";
  items?: { label: string; eur: number }[];
  gross?: number;
  total?: number;
  /** ── ⚠️ IL PREZZO BLOCCATO SI PROMETTE SOLO SE QUALCUNO L'HA DATO ─────
   *  Richiesta del committente: «prezzo bloccato fino al… fai che esce solo se
   *  inserisco codici sconto delle videotestimonianze, altrimenti non deve
   *  essere presente».
   *  Ha ragione ed è una questione di sostanza, non di grafica: una data di
   *  scadenza è una PROMESSA («fino a quel giorno questo prezzo è tuo»), e su
   *  uno sconto quantità — che è solo il prezzo di listino per tre impianti —
   *  quella promessa non l'ha fatta nessuno. Scriverla comunque vuol dire
   *  impegnarsi a un prezzo che potrebbe cambiare, con la data stampata sul
   *  documento del cliente. */
  bloccoPrezzo?: boolean;
}) {
  if (!(saving > 0)) return null;
  const data = until.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Con il giorno della settimana la scadenza smette di essere un'insegna e
  // diventa una data d'agenda: si capisce quanto tempo c'è senza doverlo contare.
  const dataEstesa = (() => {
    const d = until.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
    return d.charAt(0).toUpperCase() + d.slice(1); // in italiano il mese resta minuscolo
  })();
  const righe = (items ?? []).filter((i) => i.eur > 0);
  const soloQta = righe.length > 0 && righe.every((r) => /quantit/i.test(r.label));

  // Il motivo per cui la condizione esiste: senza, uno sconto sembra arbitrario
  // — e ciò che sembra arbitrario oggi può sembrare gonfiato domani.
  const motivo = soloQta
    ? "Più impianti prodotti nello stesso lotto condividono lavorazione e spedizione: quello che si risparmia in produzione lo trovi qui."
    : "Le condizioni applicate a questo preventivo derivano dai prezzi correnti di materiali e produzione.";

  // ── LE STESSE CONDIZIONI, NEL RIEPILOGO ──────────────────────────────────
  //  Questo riquadro il cliente lo guarda DURANTE la videoconsulenza, su uno
  //  schermo condiviso: era la scritta più piccola della pagina (9,5px
  //  l'etichetta, 11,5px la spiegazione). Ora ha le misure del documento, così
  //  le condizioni si leggono uguali nei due posti in cui compaiono.
  if (variant === "riepilogo") {
    return (
      <div className="mt-4 rounded-xl border border-white/12 bg-white/[0.03] p-4">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
          Condizioni applicate
        </p>
        <ul className="mt-2.5 space-y-1.5 text-[14px]">
          {righe.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-2 text-white/75">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="whitespace-nowrap font-semibold text-emerald-300">
                −{formatPrice(r.eur)}
              </span>
            </li>
          ))}
        </ul>
        {/* La data sta in un riquadro suo: prima era in mezzo al testo e si
            leggeva per ultima, proprio la riga che serve ricordare.
            ⚠️ E compare solo con un codice applicato: vedi `bloccoPrezzo`. */}
        {bloccoPrezzo && (
          <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5">
            <CalendarClock className="h-4 w-4 shrink-0 text-amber-300/70" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Prezzo bloccato fino a
              </p>
              <p className="text-[15px] font-bold leading-tight text-white">{dataEstesa}</p>
            </div>
          </div>
        )}
        <p className="mt-2.5 text-[14px] leading-relaxed text-white/60">
          L&apos;acconto di {formatPrice(acconto)} le fissa su questo preventivo e viene scalato dal
          totale. Dopo, il preventivo resta valido: si ricalcola sui prezzi di quel momento.
        </p>
      </div>
    );
  }

  return (
    <div
      data-hg-anchor="res-blocco-promo"
      className="mb-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
          Condizioni applicate a questo preventivo
        </p>
        {typeof gross === "number" && typeof total === "number" && gross > total && (
          <p className="text-sm text-white/50">
            Listino{" "}
            <span className={`${BARRATO_CLASSI} text-[15px]`}>{formatPrice(gross)}</span>
            <span className="mx-1.5">→</span>
            <span className="text-base font-bold text-white">{formatPrice(total)}</span>
          </p>
        )}
      </div>
      <ul className="divide-y divide-white/[0.06] px-5 text-sm">
        {righe.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-3 py-2.5 text-white/75"
          >
            <span className="min-w-0">{r.label}</span>
            <span className="whitespace-nowrap font-semibold text-emerald-300">
              −{formatPrice(r.eur)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 bg-white/[0.02] px-5 py-4 text-[13px] leading-relaxed text-white/60">
        <p>{motivo}</p>
        {bloccoPrezzo ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-white/40" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Prezzo bloccato fino a
              </span>
              <span className="text-[15px] font-semibold text-white">
                {dataEstesa} {until.getFullYear()}
              </span>
            </div>
            <p className="mt-2.5">
              Entro quella data l'acconto di{" "}
              <b className="font-semibold text-white/85">{formatPrice(acconto)}</b> le fissa su
              questo preventivo e viene scalato dal totale. Dopo, il preventivo resta valido: si
              ricalcola sui prezzi di quel momento.
            </p>
          </>
        ) : (
          <p className="mt-2.5">
            L'acconto di{" "}
            <b className="font-semibold text-white/85">{formatPrice(acconto)}</b> le fissa su questo
            preventivo e viene scalato dal totale.
          </p>
        )}
      </div>
    </div>
  );
}

/** ── IL PREZZO DAL SECONDO IMPIANTO ───────────────────────────────────────
 *  Richiesta del committente: «deve uscire anche sul preventivo creato che il
 *  secondo impianto ha quel costo; crea in fondo al preventivo con design
 *  moderno, con anche quando scade la promo, i posti; anche nel riepilogo fai
 *  un design migliore, più ottimizzato per CVR e più premium».
 *
 *  UN COMPONENTE SOLO per i due posti — il riepilogo prima di creare e il fondo
 *  del documento creato — perché è la stessa promessa: due grafiche gemelle si
 *  scostano al primo ritocco, e allora lo stesso cliente legge due cose diverse
 *  sullo stesso schermo.
 *
 *  ⚠️ L'ORDINE È QUELLO IN CUI SI DECIDE, non quello in cui si scrive:
 *   1. il PREZZO, grande, con accanto quello di oggi barrato — è il fatto;
 *   2. PERCHÉ costa meno — senza la ragione uno sconto si legge come «allora il
 *      primo me l'avete fatto pagare troppo»;
 *   3. QUANTO È LIMITATO — posti e data, e solo se sono veri.
 *  ⚠️ La scarsità è FACOLTATIVA e non finta: senza posti e senza scadenza il
 *   riquadro esiste lo stesso e non scrive niente di limitato. Una percentuale
 *   può vivere benissimo senza urgenza (richiesta del committente), e
 *   un'urgenza dichiarata e non dimostrata brucia la fiducia su tutto il resto
 *   del documento. */
function SecondoImpianto({
  offerta,
  pieno,
  da,
  variante,
}: {
  offerta: GaranziaCodice;
  pieno: number;
  /** Il giorno da cui contare la scadenza: oggi, o la nascita del preventivo. */
  da?: Date;
  variante: "riepilogo" | "preventivo";
}) {
  const secondo = prezzoDalSecondo({ pieno, offerta });
  if (!secondo) return null;
  //  Con il giorno della settimana: una scadenza si capisce guardando
  //  l'agenda, non contando i giorni.
  const quando = giornoEsteso(scadenzaEffettiva(offerta, da ?? new Date()), new Date());
  const grande = variante === "preventivo";
  return (
    <section
      data-hg-anchor="res-secondo"
      className={`overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-emerald-400/[0.13] to-emerald-400/[0.04] ${
        grande ? "mb-5" : "mt-4"
      }`}
    >
      {/*  Il filo di luce in cima: la stessa lingua del riquadro del totale,
           che è l'altro blocco «premium» della pagina. Ripetere il segno vuol
           dire dire «questi due contano», senza scriverlo. */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
      <div className={grande ? "p-5 sm:p-6" : "p-4"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-100 ring-1 ring-emerald-300/30">
            <BadgeCheck className="h-3.5 w-3.5" />
            {offerta.titolo?.trim() || "Prezzo riservato"}
          </span>
          {/*  ⚠️ LA PERCENTUALE SOLO SE L'OFFERTA È IN PERCENTUALE. Richiesta
               del committente: «rimuovi la % di sconto su importo fisso, non
               deve essere mostrato il % in meno che risparmia».
               Su un prezzo fisso quella percentuale è un numero che calcoliamo
               noi — «550 invece di 2.000 fa il 73%» — e messo accanto alla
               cifra sposta l'attenzione dal prezzo allo sconto: chi legge si
               mette a controllare il conto invece di guardare quanto pagherà. */}
          {tipoOfferta(offerta) === "percento" && secondo.percento > 0 && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/80">
              −{secondo.percento}%
            </span>
          )}
        </div>

        <p className={`mt-3 font-bold text-white ${grande ? "text-[19px]" : "text-[15.5px]"}`}>
          Dal secondo impianto in poi
        </p>

        {/*  ⚠️ IL PREZZO DI OGGI BARRATO STA ACCANTO, NON SOPRA: sopra si
             leggerebbe come uno sconto su quello che sta per firmare. Qui è il
             termine di paragone di un acquisto futuro, ed è la sola posizione
             in cui non si può fraintendere. */}
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={`font-extrabold leading-none tracking-tight tabular-nums text-white ${
              grande ? "text-[42px] sm:text-[48px]" : "text-[32px]"
            }`}
          >
            {formatPrice(secondo.prezzo)}
          </span>
          {secondo.risparmio > 0 && (
            <span className="flex items-baseline gap-2">
              <span className={`${BARRATO_CLASSI} ${grande ? "text-[17px]" : "text-[14px]"}`}>
                {formatPrice(pieno)}
              </span>
              <span className={`font-semibold text-emerald-300 ${grande ? "text-[15px]" : "text-[13px]"}`}>
                risparmi {formatPrice(secondo.risparmio)}
              </span>
            </span>
          )}
        </div>

        {/*  ── IL PERCHÉ, E NE ESISTONO DUE ──────────────────────────────
             Testi del committente, uno per tipo di offerta.
             Con un PREZZO FISSO si spiegano due cose: il lavoro già fatto e la
             finestra del laboratorio (25 impianti in 14 giorni), perché è
             quella finestra a rendere possibile proprio quella cifra adesso.
             Con una PERCENTUALE resta solo la prima — una percentuale è una
             condizione che si tiene nel tempo, e appiccicarle sopra un'urgenza
             che non c'entra vorrebbe dire prometterne la scadenza senza averla.
             ⚠️ Lo STESSO testo nei due posti (riepilogo e documento): prima il
              riepilogo ne aveva una versione corta, ed è esattamente il genere
              di differenza che il cliente nota quando rilegge il PDF dopo
              averti sentito a voce. */}
        <p
          className={`mt-3 leading-relaxed text-emerald-50/75 ${
            grande ? "text-[13.5px]" : "text-[12.5px]"
          }`}
        >
          {disclaimerDi(offerta)}
        </p>

        {/*  ⚠️ QUI C'ERA IL CONTATORE DEI POSTI, con la sua barra. Tolto su
             richiesta del committente: «il counter delle persone non metterlo
             nella grafica, lascia solo la data». Resta nella riga che
             accompagna il codice appena applicato, dove serve a chi vende; sul
             documento resta la sola cosa che il cliente deve ricordare — entro
             quando. */}
        {/*  ── ⚠️ LA DATA, DETTA COME LA SI DIREBBE A VOCE ───────────────
             Segnalazione del committente: «il testo "prezzo bloccato fino al
             data" è scritto male, ripensalo più naturale, e formatta meglio:
             il design di quel pezzo non va bene».
             Aveva ragione due volte. Sul testo: «prezzo bloccato se confermi
             entro il» è una condizione contrattuale messa in bocca a chi
             vende — a voce nessuno parla così. Si dice cosa succede, e a chi:
             «questo prezzo resta tuo fino a…».
             Sulla forma: era una pastiglia sottile con dentro una riga di
             testo e una data in grassetto, tutto sulla stessa altezza — la
             data, che è l'unica cosa da ricordare, non emergeva. Adesso è un
             riquadro a due righe con l'icona in un quadrato suo: etichetta
             piccola sopra, data grande sotto. È la stessa forma del riquadro
             del totale, e vuol dire la stessa cosa: questo è un fatto, non una
             nota a margine. */}
        {quando && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3.5 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/25">
              <CalendarClock className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Questo prezzo resta tuo fino a
              </p>
              <p className={`font-bold leading-tight text-white ${grande ? "text-[17px]" : "text-[15px]"}`}>
                {quando}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Summary(p: any) {
  const {
    base,
    selectedItems,
    simOn,
    installOn,
    sim,
    install,
    fitOpt,
    qty,
    setQty,
    allDiscounts,
    discountEur,
    gross,
    total,
    codeInput,
    setCodeInput,
    applyCode,
    checking,
    codeErr,
    manual,
    scarcityList,
    inputCls,
    submitting,
    mobile,
    promoUntil,
    acconto,
    //  Quali parti fisse mostrare: arriva dal pannello del presentatore.
    //  Assente = tutto acceso, così questo componente resta usabile anche da
    //  chi non gliela passa.
    acceso = () => true,
  } = p;
  const sortedAddons = [
    ...selectedItems.map((u: any) => ({
      key: u.id,
      name: u.name,
      price: u.price,
      wasPrice: u.wasPrice,
    })),
    ...(simOn && sim
      ? [{ key: "sim", name: sim.name, price: sim.price, wasPrice: sim.wasPrice }]
      : []),
    ...(installOn && install ? [{ key: "install", name: install.name, price: install.price }] : []),
    ...(fitOpt ? [{ key: "fit", name: fitOpt.name, price: fitOpt.price }] : []),
  ].sort((a, b) => {
    const af = a.price === 0 ? 0 : 1,
      bf = b.price === 0 ? 0 : 1;
    return af !== bf ? af - bf : b.price - a.price; // GRATIS prima, poi dal più caro
  });
  const qtySave = allDiscounts
    .filter((d: any) => d.kind === "qty")
    .reduce((s: number, d: any) => s + d.discount_eur, 0);
  return (
    <>
      <h2 className={`mb-3 flex items-center gap-2 font-semibold ${mobile ? "text-lg" : ""}`}>
        <FileText className="h-4 w-4 text-brand" /> Il tuo preventivo
      </h2>
      <div className={`space-y-1.5 pr-1 text-sm ${mobile ? "" : "max-h-64 overflow-auto"}`}>
        {/* soluzione base — voce principale */}
        <div className="flex items-center justify-between gap-2 rounded-lg bg-brand/10 px-2.5 py-2">
          <span className="min-w-0 flex-1 truncate font-semibold text-white">{base.name}</span>
          <span className="whitespace-nowrap font-bold text-white">{formatPrice(base.price)}</span>
        </div>
        {/* add-on: prima i GRATIS, poi dal più caro al meno caro */}
        {sortedAddons.map((u: any) => (
          <div key={u.key} className="flex items-center justify-between gap-2 px-2.5 py-1">
            <span className="min-w-0 flex-1 truncate text-white/70">{u.name}</span>
            <PromoPrice price={u.price} wasPrice={u.wasPrice} />
          </div>
        ))}
      </div>

      {/* quantità — si può spegnere dalle impostazioni del presentatore */}
      <div
        hidden={!acceso("quantita")}
        className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
      >
        <span className="text-sm text-white/70">Quantità impianti</span>
        <div className="flex items-center rounded-lg border border-white/15 bg-white/5">
          <button
            type="button"
            onClick={() => {
              sfx.deselect();
              setQty((q: number) => Math.max(1, q - 1));
            }}
            className="px-2.5 py-1.5 text-white/70 hover:text-white"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-7 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            onClick={() => {
              sfx.select();
              setQty((q: number) => Math.min(9, q + 1));
            }}
            className="px-2.5 py-1.5 text-white/70 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* codice promozionale — si può spegnere dalle impostazioni */}
      <div hidden={!acceso("codice")} className="mt-4 border-t border-white/10 pt-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/70">
          <BadgePercent className="h-3.5 w-3.5 text-brand" /> Codice promozionale
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={codeInput}
              onChange={(e: any) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ES. H7135X"
              className={`${inputCls} pl-8 uppercase`}
            />
          </div>
          <button
            type="button"
            onClick={applyCode}
            disabled={checking}
            className="rounded-lg border border-brand bg-brand/10 px-3 text-sm font-medium text-white transition hover:bg-brand/20 disabled:opacity-60"
          >
            {checking ? "Verifico…" : "Applica"}
          </button>
        </div>
        {codeErr && <p className="mt-1.5 text-xs text-destructive">{codeErr}</p>}
        {manual && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-300">
            <Check className="h-3 w-3" />{" "}
            {/*  ── ⚠️ DICE QUELLO CHE HA FATTO, NON COME SI CHIAMA ──────
                 Richiesta del committente: «quando metto codice sconto nel
                 preventivo e lo aggiunge deve dire in modo professionale
                 quello che è, brevemente».
                 Qui c'era sempre la stessa frase — «Prezzo video testimonianza
                 attivo» — anche quando il codice faceva tutt'altro: davanti al
                 cliente, che quella riga la legge, era il nome di una cosa che
                 non c'entrava niente. Adesso si compone da ciò che il codice
                 fa davvero (shop/promo-garanzia), e il messaggio scritto a
                 mano da chi l'ha creato continua a vincere su tutto. */}
            {p.messaggioCodice ||
              frasiCodiceApplicato({
                codice: manual.code,
                sconto: manual.discount_eur,
                suo: manual.apply_message,
              })}
          </p>
        )}

      </div>

      {/* ── UN SOLO BLOCCO PER GLI SCONTI ──────────────────────────────────
          La stessa informazione compariva tre volte: righe verdi nell'elenco,
          riquadro "Condizioni applicate" e riquadro verde sotto il totale — più
          la fascia arancione dei posti. Quattro grafiche diverse per un solo
          concetto: da lì il disordine. Ora è uno, subito prima del totale. */}
      <PromoLock
        saving={discountEur}
        until={promoUntil}
        acconto={acconto}
        variant="riepilogo"
        /*  Il prezzo si «blocca» solo quando è stato dato un codice della video
            testimonianza. Uno sconto quantità è il listino per tre impianti,
            non una condizione data a questa persona — e il codice della
            garanzia vale ZERO euro oggi, perché fissa il prezzo del secondo
            impianto: per questo si guardano gli euro e non il codice. */
        bloccoPrezzo={allDiscounts.some((d: any) => d.kind !== "qty" && Number(d.discount_eur) > 0)}
        items={allDiscounts.map((d: any) => ({
          label:
            //  ⚠️ Il ramo «garanzia» è stato tolto con lo sconto che lo
            //   produceva: il 35% non è più uno sconto sul totale di oggi, e
            //   una riga che non può più comparire è una riga che il prossimo
            //   che legge deve capire perché c'è.
            d.kind === "qty" ? `Sconto quantità (${d.label})` : `Video testimonianza (${d.code})`,
          eur: d.discount_eur,
        }))}
      />

      {/*  ── ⚠️ LE DUE COSE DELLA GARANZIA, SPIEGATE QUI E NON SULLO STICKY ──
           Decisione del committente: il 35% «lo mostra solo nel riepilogo prima
           di confermare e poi nel preventivo sotto, nel badge garanzia 15
           mesi»; e l'offerta di un codice «lo deve mettere anche nel riepilogo
           prima di confermare, con spiegazione».
           È il posto giusto per tutte e due: qui il cliente sta decidendo e
           legge, mentre la barra in basso è un prezzo che deve restare un
           prezzo. Due righe, e ognuna dice una cosa sola:
            · perché il preventivo è più basso di oggi;
            · e cosa pagherà fra quindici mesi, che è l'altra domanda.
           ⚠️ Compaiono solo quando sono vere, e non insieme: o c'è il 35%, o
            c'è l'offerta di un codice (shop/promo-garanzia). */}
      {/*  Il prezzo del secondo impianto, nel punto in cui si decide. Stesso
           componente del fondo del documento: la promessa è la stessa, e due
           grafiche gemelle si scostano al primo ritocco. */}
      {p.offertaGaranzia && (
        <SecondoImpianto offerta={p.offertaGaranzia} pieno={p.gross} variante="riepilogo" />
      )}

      <div className="my-4 border-t border-white/10" />
      {/* Il totale è l'informazione più importante del riquadro: deve essere la
          prima cosa che l'occhio trova, non una riga fra le altre. */}
      {/* stesso vetro della barra in basso: la stessa informazione deve avere
          la stessa veste ovunque compaia */}
      <div className="hg-glass relative overflow-hidden rounded-xl border border-brand/30 bg-brand/[0.10] px-4 py-3.5 backdrop-blur-2xl backdrop-saturate-150">
        <span className="hg-sheen pointer-events-none absolute inset-0" />
        <div className="relative flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Totale stimato
          </span>
          {discountEur > 0 && (
            <span className={`${BARRATO_CLASSI} text-[15px]`}>
              {formatPrice(gross)}
            </span>
          )}
        </div>
        <p
          key={total}
          className={`hg-price-pop relative mt-0.5 font-extrabold leading-none tracking-tight text-white ${mobile ? "text-4xl" : "text-3xl"}`}
        >
          {formatPrice(total)}
        </p>
      </div>
      <button
        type="submit"
        disabled={submitting || !!p.soloConsulente}
        title={p.soloConsulente ? "Il preventivo lo conferma il consulente" : undefined}
        className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white transition hover:brightness-110 disabled:opacity-60 ${mobile ? "py-4 text-base shadow-lg shadow-brand/25" : "py-3"}`}
      >
        {submitting ? (
          "Creazione in corso…"
        ) : p.soloConsulente ? (
          <>Lo conferma il consulente</>
        ) : (
          <>
            Crea il tuo preventivo <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      <p className="mt-2 text-center text-[11px] text-white/40">
        {p.soloConsulente
          /*  Il cliente deve capire che non gli manca un passaggio: ha finito
              lui, tocca a chi conduce. Un pulsante spento senza una riga che
              lo spieghi è un guasto, dal suo punto di vista. */
          ? "Scegli pure quello che vuoi: quando hai finito lo conferma il consulente con te."
          : "Non paghi adesso. Dopo la conferma trovi l'IBAN e la causale per l'acconto."}
      </p>
    </>
  );
}

/** ── L'INDIRIZZO CHE SI SUGGERISCE, VERSIONE SCURA ────────────────────────
 *  Lo stesso aiuto che c'è nella fattura del CRM, vestito per questa pagina.
 *  ⚠️ IL COMPORTAMENTO NON È RICOPIATO: l'attesa prima di chiedere,
 *   l'annullamento della richiesta di prima e il «non ricercare quello che hai
 *   appena scelto» stanno nel gancio `useIndirizziSuggeriti`
 *   (crm/indirizzo-suggerito), lo stesso che usa il campo del CRM. Qui c'è
 *   solo il disegno — che è l'unica cosa davvero diversa fra le due pagine.
 *
 *  ⚠️ RESTA UN CAMPO NORMALE. Chi ha un indirizzo che il servizio non conosce
 *   — una frazione, una via nuova, un cliente estero — scrive e basta. Su una
 *   pagina che il CLIENTE compila da solo questo conta il doppio: un campo che
 *   rifiuta quello che non riconosce non fa una correzione, fa abbandonare il
 *   preventivo.
 *  ───────────────────────────────────────────────────────────────────────── */
function CampoIndirizzoScuro({
  valore,
  onTesto,
  onScelto,
  comune,
}: {
  valore: string;
  onTesto: (v: string) => void;
  onScelto: (i: IndirizzoScelto) => void;
  /** Aiuta la ricerca: «via roma» da solo è in duemila comuni. */
  comune?: string;
}) {
  const { suggerimenti, aperto, cercando, riapri, chiudi, scritto, scelto } = useIndirizziSuggeriti(
    valore,
    comune,
  );

  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-white/80">
        Indirizzo
      </span>
      <div className="relative">
        <input
          type="text"
          value={valore}
          onChange={(e) => {
            scritto();
            onTesto(e.target.value);
          }}
          onFocus={riapri}
          //  ⚠️ Con un ritardo: il tocco su un suggerimento toglie il fuoco al
          //   campo, e chiudendo subito la tendina cadrebbe nel vuoto.
          onBlur={() => window.setTimeout(chiudi, 150)}
          placeholder="Via Verdi"
          autoComplete="off"
          className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-3.5 py-3 text-[15px] text-white placeholder:text-white/40 transition focus:border-brand focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        {cercando && !aperto && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/40">
            cerco…
          </span>
        )}
        {aperto && suggerimenti.length > 0 && (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-white/15 bg-[#0b1a38] shadow-2xl">
            {suggerimenti.map((sg, i) => (
              <li key={`${sg.esteso}-${i}`}>
                <button
                  type="button"
                  //  `onMouseDown` e non `onClick`: il clic arriva dopo il
                  //  blur, e a quel punto la tendina non c'è più.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    scelto(sg);
                    onScelto(sg);
                  }}
                  className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition hover:bg-white/[0.07]"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                  <span className="min-w-0">
                    <span className="block text-[14px] text-white">
                      {[sg.indirizzo, sg.civico].filter(Boolean).join(" ")}
                    </span>
                    <span className="block text-[12px] text-white/45">
                      {[sg.cap, sg.comune, sg.provincia && `(${sg.provincia})`]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  req = false,
  opt = false,
  icon: Icon,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  req?: boolean;
  opt?: boolean;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <label className="block min-w-0">
        <span className="mb-1 flex items-baseline gap-1 text-[11px] font-medium text-white/70">
          <span className="min-w-0 truncate">{label}</span>
          {req && <span className="text-brand">*</span>}
          {opt && (
            <span className="text-[9px] font-normal uppercase tracking-wide text-white/35">
              opz.
            </span>
          )}
        </span>
        <input
          type={type}
          required={req}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => {
            primeSfx();
            sfx.field();
          }}
          className="w-full rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/40 transition focus:border-brand focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </label>
    );
  }
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-white/80">
        {Icon && <Icon className="mr-0.5 h-4 w-4 text-white/45" />}
        {label}
        {req && <span className="text-brand">*</span>}
        {opt && OPT}
      </span>
      <div className="relative">
        <input
          type={type}
          required={req}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => {
            primeSfx();
            sfx.field();
          }}
          className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-3.5 py-3 text-[15px] text-white placeholder:text-white/40 transition focus:border-brand focus:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
    </label>
  );
}

/** ── UNA COORDINATA DA COPIARE ─────────────────────────────────────────────
 *  IBAN e causale non si leggono: si TRASCRIVONO, spesso passando dallo schermo
 *  del telefono a quello della banca. A 14px in tondo un IBAN si sbaglia — e un
 *  bonifico sbagliato è una telefonata, non un pagamento. Qui il valore sale a
 *  15,5px, l'etichetta guadagna contrasto, e "Copia" diventa un bersaglio vero
 *  per il pollice invece di due parole appese in alto a destra. */
function Row({
  label,
  value,
  onCopy,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${highlight ? "border-brand/40 bg-brand/10" : "border-white/10 bg-white/[0.03]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/60">
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="-my-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13.5px] font-semibold text-brand transition hover:bg-white/10 print:hidden"
        >
          <Copy className="h-3.5 w-3.5" /> Copia
        </button>
      </div>
      <p
        className={`mt-1.5 break-all text-[15.5px] leading-snug ${mono ? "font-mono tracking-wide" : ""} ${highlight ? "font-semibold text-white" : "text-white/90"}`}
      >
        {value}
      </p>
    </div>
  );
}
