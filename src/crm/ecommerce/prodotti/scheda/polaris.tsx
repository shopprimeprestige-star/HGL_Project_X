/** ── IL KIT DI STILE POLARIS PER LA SCHEDA (scheda/polaris.tsx) ───────────────
 *  Commessa 2026-11-25-editor-prodotti, E5 (SPEC §3.1). Lo STILE di Polaris (la libreria di Shopify) rifatto con ciò che il progetto ha già:
 *  Tailwind, i token di `.crm-theme`, le icone di lucide. Nessun pacchetto nuovo, nessun colore scritto a mano: fuori dalla scheda niente cambia.
 *
 *  I pezzi: `PaginaScheda` (fondo grigio, due colonne), `RiquadroPolaris` (il riquadro bianco col titolo e il segno «a posto / da sistemare (n)»),
 *  `BadgeStato` (Bozza / Pubblicato / Archiviato, col puntino e col testo), `Banner` (informa, avverte, segnala un errore), `CampoP` (etichetta
 *  sopra, aiuto sotto, contatore, errore a parole) e le classi del campo e del tasto.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Riquadri bianchi, bordo da 1 px, angoli da 12 px, NESSUN'ombra; titolo 14 px grassetto; spazi da 16 px; nessun riquadro dentro un riquadro
 *    (dentro si separa con lo spazio o con una riga, mai con un altro bordo).
 *  · Campi alti 44 px sul telefono e 36 sul computer; sul telefono il testo è 16 px (iOS non ingrandisce la pagina).
 *  · UN SOLO tasto pieno per schermata (il principale della testata): qui dentro i tasti sono sempre di contorno. Lo decide il guscio.
 *  · Il colore non è mai l'unico segnale: badge, segni e banner dicono lo stato anche a parole; ogni errore è una frase accanto al campo.
 *  · Focus sempre visibile; i passaggi animati si fermano con `motion-reduce`.
 *  ⚠️ Solo presentazione: niente rete, niente scrittura, niente stato della scheda. Quello che si apre o si chiude lo decide chi chiama. */
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TonoSezione } from "../scheda-pura";

/* ══ LE CLASSI CONDIVISE ════════════════════════════════════════════════════ */

/** Il campo di testo, il menu a tendina e l'area di testo: 44 px sul telefono, 36 sul computer; bordo leggibile (3:1) e anello di focus. */
export const CLASSI_CAMPO =
  "min-h-11 w-full rounded-lg border border-muted-foreground/70 bg-card px-3 text-[16px] text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground md:min-h-9 md:text-[13px]";
/** I tasti dentro la scheda (sempre `variant="outline"`: il tasto pieno è uno solo, nella testata). */
export const CLASSI_TASTO = "h-11 text-[13px] md:h-9";

/* ══ LA PAGINA ══════════════════════════════════════════════════════════════ */

/** Fondo grigio chiaro con testata in cima e sotto due colonne (circa due terzi e un terzo dal computer, una sola sul telefono). */
export function PaginaScheda({
  testata,
  principale,
  laterale,
}: {
  testata?: ReactNode;
  principale: ReactNode;
  laterale?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-muted p-3 md:p-5">
      <div className="mx-auto flex min-w-0 max-w-[1180px] flex-col gap-4">
        {testata}
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">{principale}</div>
          {laterale && <div className="flex min-w-0 flex-col gap-4">{laterale}</div>}
        </div>
      </div>
    </div>
  );
}

/* ══ IL RIQUADRO ════════════════════════════════════════════════════════════ */

const ICONA_SEGNO = {
  ok: CheckCircle2,
  da_sistemare: AlertTriangle,
  da_controllare: Info,
} as const;

/** «a posto» / «da controllare (n)» / «da sistemare (n)»: sempre scritto, il colore aiuta soltanto. */
export function SegnoRiquadro({ segno }: { segno: { tono: TonoSezione; testo: string } }) {
  const Icona = ICONA_SEGNO[segno.tono];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium",
        segno.tono === "ok" && "bg-emerald-50 text-emerald-900",
        segno.tono === "da_sistemare" && "bg-rose-50 text-rose-900",
        segno.tono === "da_controllare" && "bg-amber-50 text-amber-900",
      )}
    >
      <Icona className="h-3 w-3" aria-hidden="true" />
      {segno.testo}
    </span>
  );
}

/**
 * Il riquadro. Senza `alterna` è fisso (titolo, segno e un'`azione` a destra, per esempio «Applica prezzo»). Con `alterna` si apre e si chiude:
 * tutta la riga del titolo è il tasto (alta 44 px sul telefono) e `aperto` lo decide chi chiama, così «Vai» da «Prima di pubblicare» lo può aprire.
 * Gli identificativi `sez-<id>` (il titolo) e `pan-<id>` (il pannello) sono quelli a cui portano i link della scheda.
 */
export function RiquadroPolaris({
  id,
  titolo,
  segno,
  aperto = true,
  alterna,
  subito,
  azione,
  children,
}: {
  id: string;
  titolo: string;
  segno?: { tono: TonoSezione; testo: string };
  aperto?: boolean;
  alterna?: () => void;
  /** «si applica subito»: ciò che cambia il sito senza passare dalla bozza (il prezzo di un prodotto pubblicato). */
  subito?: boolean;
  /** Un tasto a destra del titolo (solo nel riquadro fisso: dentro il tasto che apre e chiude non può starci un altro tasto). */
  azione?: ReactNode;
  children: ReactNode;
}) {
  const note = (
    <>
      {subito && (
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[12px] font-medium text-sky-900">
          si applica subito
        </span>
      )}
      {segno && <SegnoRiquadro segno={segno} />}
    </>
  );
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      {alterna ? (
        <h2 className="m-0">
          <button
            type="button"
            id={`sez-${id}`}
            aria-expanded={aperto}
            aria-controls={`pan-${id}`}
            onClick={alterna}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-[14px] font-semibold hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">{titolo}</span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {note}
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform motion-reduce:transition-none",
                  aperto && "rotate-180",
                )}
                aria-hidden="true"
              />
            </span>
          </button>
        </h2>
      ) : (
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <h2 id={`sez-${id}`} className="m-0 min-w-0 text-[14px] font-semibold">
            {titolo}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {note}
            {azione}
          </div>
        </div>
      )}
      <div
        id={`pan-${id}`}
        hidden={!aperto}
        className={cn(
          "flex flex-col gap-4 px-4 pb-4",
          alterna ? "border-t border-border pt-4" : "pt-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/* ══ IL BADGE DI STATO ══════════════════════════════════════════════════════ */

const STATI = {
  bozza: { testo: "Bozza", badge: "bg-muted text-foreground", puntino: "bg-muted-foreground" },
  pubblicato: {
    testo: "Pubblicato",
    badge: "bg-emerald-50 text-emerald-900",
    puntino: "bg-emerald-600",
  },
  archiviato: {
    testo: "Archiviato",
    badge: "border border-border bg-card text-muted-foreground",
    puntino: "border border-muted-foreground",
  },
} as const;

/** Bozza (grigio), Pubblicato (verde), Archiviato (neutro, puntino vuoto): il testo c'è sempre, il colore è un aiuto. */
export function BadgeStato({ stato }: { stato: keyof typeof STATI }) {
  const s = STATI[stato];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium",
        s.badge,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", s.puntino)} aria-hidden="true" />
      {s.testo}
    </span>
  );
}

/* ══ IL BANNER ══════════════════════════════════════════════════════════════ */

const TONI_BANNER = {
  info: { classi: "border-sky-200 bg-sky-50 text-sky-900", Icona: Info },
  attenzione: { classi: "border-amber-200 bg-amber-50 text-amber-900", Icona: AlertTriangle },
  errore: { classi: "border-rose-200 bg-rose-50 text-rose-900", Icona: CircleAlert },
} as const;

/** Una frase che spiega, con un `titolo` facoltativo e un'`azione` (un tasto di contorno passato dal guscio). L'errore lo legge subito chi usa la sintesi vocale. */
export function Banner({
  tono,
  titolo,
  azione,
  children,
}: {
  tono: keyof typeof TONI_BANNER;
  titolo?: string;
  azione?: ReactNode;
  children: ReactNode;
}) {
  const { classi, Icona } = TONI_BANNER[tono];
  return (
    <div
      role={tono === "errore" ? "alert" : "status"}
      className={cn(
        "flex min-w-0 flex-wrap items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] leading-snug",
        classi,
      )}
    >
      <Icona className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {titolo && <p className="font-semibold">{titolo}</p>}
        <div>{children}</div>
      </div>
      {azione && <div className="shrink-0">{azione}</div>}
    </div>
  );
}

/* ══ IL CAMPO ═══════════════════════════════════════════════════════════════ */

/** L'errore (una frase, che blocca) e gli avvisi (parole da non usare, che non bloccano) sotto un campo; `id` è quello del campo. */
export function MessaggiCampo({
  id,
  errore,
  avvisi,
}: {
  id: string;
  errore?: string;
  avvisi?: string[];
}) {
  return (
    <>
      {errore && (
        <p
          id={`${id}-errore`}
          role="alert"
          className="flex items-start gap-1.5 text-[13px] text-rose-800"
        >
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {errore}
        </p>
      )}
      {avvisi && avvisi.length > 0 && (
        <ul id={`${id}-avvisi`} className="flex flex-col gap-0.5">
          {avvisi.map((a) => (
            <li key={a} className="flex items-start gap-1.5 text-[13px] text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Un campo: etichetta sopra (collegata con `htmlFor`), il controllo, l'aiuto sotto in grigio, il contatore «84 / 300» a destra dell'etichetta
 * (oltre il massimo lo dice anche a parole), l'errore a parole. `children` riceve `id`, `aria-describedby` e `aria-invalid` da mettere sul controllo.
 */
export function CampoP({
  id,
  etichetta,
  aiuto,
  contatore,
  errore,
  avvisi,
  facoltativo,
  children,
}: {
  id: string;
  etichetta: string;
  aiuto?: string;
  contatore?: { n: number; max: number };
  errore?: string;
  avvisi?: string[];
  facoltativo?: boolean;
  children: (p: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
  }) => ReactNode;
}) {
  const descr =
    [aiuto && `${id}-aiuto`, errore && `${id}-errore`, avvisi?.length && `${id}-avvisi`]
      .filter(Boolean)
      .join(" ") || undefined;
  const troppo = contatore ? contatore.n > contatore.max : false;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium">
          {etichetta}
          {facoltativo && <span className="font-normal text-muted-foreground"> (facoltativo)</span>}
        </label>
        {contatore && (
          <span
            className={cn(
              "text-[12px] tabular-nums",
              troppo ? "font-semibold text-rose-800" : "text-muted-foreground",
            )}
          >
            {`${contatore.n} / ${contatore.max}`}
            {troppo && " · troppo lungo"}
          </span>
        )}
      </div>
      {children({ id, "aria-describedby": descr, "aria-invalid": !!errore })}
      {aiuto && (
        <p id={`${id}-aiuto`} className="text-[13px] text-muted-foreground">
          {aiuto}
        </p>
      )}
      <MessaggiCampo id={id} errore={errore} avvisi={avvisi} />
    </div>
  );
}
