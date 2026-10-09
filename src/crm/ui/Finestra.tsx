/** ─────────────────────────────────────────────────────────────────────────
 *  Finestra.tsx — LE FINESTRE DEL CRM (dialoghi, fogli, pannelli)
 *
 *  PERCHÉ ESISTE
 *  Le finestre erano il punto in cui il CRM si sfaldava: ognuna sceglieva il
 *  proprio fondo, i propri raggi, il proprio modo di dire "questa voce è
 *  selezionata". Il difetto più visibile — testata scura su corpo bianco — non
 *  era nemmeno una scelta: i dialoghi Radix vivono in un *portale* attaccato a
 *  <body>, quindi FUORI dal contenitore `.crm-theme`. Lì i token (--card,
 *  --background, --border…) tornano a quelli della landing, che è scura. Una
 *  metà della finestra usava i token (→ scura) e l'altra metà colori scritti a
 *  mano (→ chiara): due mondi nella stessa finestra.
 *
 *  COME È RISOLTO
 *  Ogni finestra porta con sé il tema chiaro del CRM tramite un involucro
 *  `crm-theme` in `display:contents` — non disegna nessuna scatola (quindi non
 *  ridipinge il fondo) ma le variabili CSS scendono a tutti i figli. Così Input,
 *  Button, Badge & co. dentro la finestra sono chiari come nel resto del CRM.
 *
 *  LE REGOLE, IN BREVE
 *   1. UN SOLO FONDO — testata, corpo e piede sono slate-50. La testata si
 *      distingue con una riga sottile e il peso del testo, mai con un blocco.
 *   2. COLORE SOLO DOVE SIGNIFICA — in un elenco di scelte le righe sono
 *      neutre: il colore sta nel pallino. La voce scelta ha una spunta e un
 *      fondo tenue, mai un blocco pieno che affoga il testo.
 *   3. RIPOSANTE — niente bianco puro come fondo pagina, niente nero puro nel
 *      testo, niente saturazioni forti su aree grandi.
 *   4. RITMO COSTANTE — px-4 py-3 · rounded-xl/2xl · gap-2/3.
 *   5. GERARCHIA UNICA — titolo (l'AZIONE) → contesto in una riga → contenuto →
 *      azioni in fondo a destra, con UNA sola azione piena.
 *   6. SUL TELEFONO — la finestra diventa un foglio dal basso e l'azione
 *      principale è l'ultima, cioè quella che il pollice raggiunge.
 *  ───────────────────────────────────────────────────────────────────────── */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   0. LE MISURE — scritte una volta, riusate ovunque
   ═════════════════════════════════════════════════════════════════════════ */

/** Il fondo unico della finestra: testata, corpo e piede condividono questo. */
export const FONDO_FINESTRA = "bg-slate-50 text-slate-900";
/** Le superfici *dentro* la finestra (schede, elenchi, campi). */
export const FONDO_INTERNO = "bg-white border-slate-200";
/** Il bordo di servizio: sempre lo stesso grigio, mai più scuro. */
export const BORDO_FINESTRA = "border-slate-200";
/** Padding orizzontale di testata/corpo/piede: l'unico ritmo ammesso. */
export const PADDING_FINESTRA = "px-4 sm:px-5";
/** Classe per gli input dentro una finestra: campo bianco su fondo slate-50. */
export const CLASSE_CAMPO =
  "h-9 rounded-lg border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400";
/** Classe per le textarea: stessa famiglia del campo, altezza libera. */
export const CLASSE_AREA =
  "rounded-lg border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400";

const LARGHEZZE = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
} as const;

export type LarghezzaFinestra = keyof typeof LARGHEZZE;

/** L'involucro che riporta il tema chiaro dentro il portale.
 *  `display:contents` = non genera una scatola, quindi non ridipinge il fondo:
 *  eredita solo le variabili CSS e il colore del testo. */
function Tema({ children }: { children: ReactNode }) {
  return <div className="crm-theme contents">{children}</div>;
}

/** Il velo dietro la finestra. Nero all'80% spegneva la pagina; qui è un grigio
 *  profondo trasparente: si capisce che è dietro, non che è sparita. */
function Velo() {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      )}
    />
  );
}

/** Il tasto di chiusura: stessa posizione e stesso peso in ogni finestra. */
function Chiudi() {
  return (
    <DialogPrimitive.Close
      className={cn(
        "absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg",
        "text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
      )}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Chiudi</span>
    </DialogPrimitive.Close>
  );
}

/** Testata condivisa da finestre e fogli: titolo = l'azione, contesto = una riga. */
function Testata({
  titolo,
  contesto,
  icona: Icona,
}: {
  titolo: ReactNode;
  contesto?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-b bg-slate-50 py-3 pr-12",
        BORDO_FINESTRA,
        PADDING_FINESTRA,
      )}
    >
      <div className="flex items-start gap-2.5">
        {Icona && (
          <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <Icona className="h-4 w-4 text-slate-500" />
          </span>
        )}
        <div className="min-w-0">
          <DialogPrimitive.Title className="truncate text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
            {titolo}
          </DialogPrimitive.Title>
          {contesto ? (
            <p className="mt-0.5 truncate text-[12px] leading-tight text-slate-500">{contesto}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Il piede. Le azioni si passano nell'ordine "prima la secondaria, poi la
 *  principale": sul telefono la principale finisce in basso (dove arriva il
 *  pollice), sul desktop finisce a destra (dove l'occhio la cerca). */
function Piede({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "shrink-0 border-t bg-slate-50 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        BORDO_FINESTRA,
        PADDING_FINESTRA,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. FINESTRA — il dialogo centrale (foglio dal basso sul telefono)
   ═════════════════════════════════════════════════════════════════════════ */

export function Finestra({
  aperta,
  onCambio,
  titolo,
  contesto,
  icona,
  azioni,
  larghezza = "md",
  senzaPadding,
  bloccante,
  classeCorpo,
  className,
  children,
}: {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  /** Dice l'AZIONE ("Cambia stato"), non l'oggetto. */
  titolo: ReactNode;
  /** Una riga sola: di chi/di cosa stiamo parlando. */
  contesto?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  /** Prima la secondaria, poi la principale (una sola piena). */
  azioni?: ReactNode;
  larghezza?: LarghezzaFinestra;
  senzaPadding?: boolean;
  /** true = non si chiude cliccando fuori (conferme che cancellano dati) */
  bloccante?: boolean;
  classeCorpo?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={aperta} onOpenChange={onCambio}>
      <DialogPrimitive.Portal>
        <Velo />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onPointerDownOutside={bloccante ? (e) => e.preventDefault() : undefined}
          onInteractOutside={bloccante ? (e) => e.preventDefault() : undefined}
          className={cn(
            // telefono: foglio dal basso, a tutta larghezza
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden outline-none",
            "rounded-t-2xl border-t shadow-2xl",
            FONDO_FINESTRA,
            BORDO_FINESTRA,
            // desktop: finestra centrata
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88vh] sm:w-[calc(100%-2rem)]",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border",
            // entrata/uscita: dal basso sul telefono, in dissolvenza sul desktop
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=closed]:slide-out-to-bottom-8",
            "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
            LARGHEZZE[larghezza],
            className,
          )}
        >
          <Tema>
            {/* maniglia: sul telefono dice "questo foglio si trascina/chiude" */}
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-slate-300 sm:hidden" />
            <Chiudi />
            <Testata titolo={titolo} contesto={contesto} icona={icona} />
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                !senzaPadding && cn("py-4", PADDING_FINESTRA),
                classeCorpo,
              )}
            >
              {children}
            </div>
            {azioni ? <Piede>{azioni}</Piede> : null}
          </Tema>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. FOGLIO — il pannello laterale (sul telefono anche lui sale dal basso)
   ═════════════════════════════════════════════════════════════════════════ */

export function Foglio({
  aperto,
  onCambio,
  titolo,
  contesto,
  icona,
  azioni,
  larghezza = "md",
  senzaPadding,
  classeCorpo,
  className,
  children,
}: {
  aperto: boolean;
  onCambio: (v: boolean) => void;
  titolo: ReactNode;
  contesto?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  azioni?: ReactNode;
  larghezza?: LarghezzaFinestra;
  senzaPadding?: boolean;
  classeCorpo?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={aperto} onOpenChange={onCambio}>
      <DialogPrimitive.Portal>
        <Velo />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            // telefono: foglio dal basso
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden outline-none",
            "rounded-t-2xl border-t shadow-2xl",
            FONDO_FINESTRA,
            BORDO_FINESTRA,
            // desktop: colonna a destra, tutta altezza
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:h-full sm:w-full",
            "sm:rounded-none sm:border-l sm:border-t-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "max-sm:data-[state=open]:slide-in-from-bottom-8 max-sm:data-[state=closed]:slide-out-to-bottom-8",
            "sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right",
            LARGHEZZE[larghezza],
            className,
          )}
        >
          <Tema>
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-slate-300 sm:hidden" />
            <Chiudi />
            <Testata titolo={titolo} contesto={contesto} icona={icona} />
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                !senzaPadding && cn("py-4", PADDING_FINESTRA),
                classeCorpo,
              )}
            >
              {children}
            </div>
            {azioni ? <Piede>{azioni}</Piede> : null}
          </Tema>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. PANNELLO — il popover (notifiche, filtri, scelte rapide)
   ═════════════════════════════════════════════════════════════════════════ */

/** Stessa anatomia della finestra, in piccolo: testata sottile, corpo, piede.
 *  Va usato DENTRO <Popover>, al posto di <PopoverContent>. */
export function Pannello({
  titolo,
  contesto,
  azioni,
  senzaPadding,
  className,
  classeCorpo,
  children,
  ...resto
}: {
  titolo?: ReactNode;
  contesto?: ReactNode;
  azioni?: ReactNode;
  senzaPadding?: boolean;
  classeCorpo?: string;
  children?: ReactNode;
} & Omit<ComponentProps<typeof PopoverContent>, "title" | "children">) {
  return (
    <PopoverContent
      sideOffset={6}
      className={cn(
        "z-50 w-72 overflow-hidden rounded-xl border p-0 shadow-lg",
        FONDO_FINESTRA,
        BORDO_FINESTRA,
        className,
      )}
      {...resto}
    >
      <Tema>
        {(titolo || azioni) && (
          <div
            className={cn(
              "flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2",
              BORDO_FINESTRA,
            )}
          >
            <div className="min-w-0">
              {titolo ? (
                <div className="truncate text-[12px] font-semibold text-slate-900">{titolo}</div>
              ) : null}
              {contesto ? (
                <div className="truncate text-[11px] text-slate-500">{contesto}</div>
              ) : null}
            </div>
            {azioni ? <div className="flex shrink-0 items-center gap-1">{azioni}</div> : null}
          </div>
        )}
        <div className={cn(!senzaPadding && "p-3", classeCorpo)}>{children}</div>
      </Tema>
    </PopoverContent>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. I PEZZI DENTRO LA FINESTRA
   ═════════════════════════════════════════════════════════════════════════ */

/** Un blocco = una domanda. Superficie bianca sul fondo slate-50: è così che si
 *  crea gerarchia senza cambiare colore. */
export function SezioneFinestra({
  titolo,
  nota,
  azioni,
  icona: Icona,
  senzaPadding,
  className,
  classeCorpo,
  children,
}: {
  titolo?: ReactNode;
  nota?: ReactNode;
  azioni?: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  senzaPadding?: boolean;
  className?: string;
  classeCorpo?: string;
  children?: ReactNode;
}) {
  return (
    /** ⚠️ `shrink-0` NON È UN DETTAGLIO, ed è il difetto segnalato dal
     *  committente: «la schermata non scorre e taglia le opzioni dell'IVA».
     *  Il corpo delle finestre è una colonna flessibile, e un figlio con
     *  `overflow-hidden` — che qui serve solo agli angoli arrotondati — può
     *  essere SCHIACCIATO da flexbox invece di far scorrere il contenitore:
     *  la sezione si accorcia, quello che c'è dentro viene tagliato a metà
     *  riga, e la finestra sembra rotta senza che nessuna barra di scorrimento
     *  compaia. Con questo, quando il contenuto è troppo, a scorrere è il
     *  corpo della finestra — che è quello che deve succedere. */
    <section
      className={cn("shrink-0 overflow-hidden rounded-xl border bg-white", BORDO_FINESTRA, className)}
    >
      {(titolo || azioni) && (
        <header
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5",
            BORDO_FINESTRA,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {Icona && <Icona className="h-4 w-4 shrink-0 text-slate-400" />}
            <div className="min-w-0">
              {titolo ? (
                <h3 className="truncate text-[13px] font-semibold leading-tight text-slate-900">
                  {titolo}
                </h3>
              ) : null}
              {nota ? <p className="truncate text-[11px] text-slate-500">{nota}</p> : null}
            </div>
          </div>
          {azioni ? <div className="flex shrink-0 items-center gap-1.5">{azioni}</div> : null}
        </header>
      )}
      {children != null && (
        <div className={cn(!senzaPadding && "p-4", classeCorpo)}>{children}</div>
      )}
    </section>
  );
}

/** Etichetta + controllo + eventuale spiegazione. L'etichetta è sempre la
 *  stessa: minuscola, grigia, maiuscoletto. */
export function CampoFinestra({
  etichetta,
  nota,
  obbligatorio,
  azioni,
  className,
  children,
}: {
  etichetta: ReactNode;
  nota?: ReactNode;
  obbligatorio?: boolean;
  azioni?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {etichetta}
          {obbligatorio && <span className="ml-0.5 text-slate-400">*</span>}
        </span>
        {azioni ? <div className="flex shrink-0 items-center gap-1">{azioni}</div> : null}
      </div>
      <div className="mt-1.5">{children}</div>
      {nota ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{nota}</p> : null}
    </div>
  );
}

/** Una riga di scelta in un elenco (stato, consulente, opzione).
 *  La riga resta NEUTRA: il colore, se serve, sta nel `punto`. La scelta si
 *  legge dalla spunta e da un fondo appena più scuro — mai da un blocco pieno. */
export function VoceScelta({
  selezionata,
  onClick,
  titolo,
  nota,
  punto,
  icona: Icona,
  coda,
  disabilitata,
  className,
}: {
  selezionata?: boolean;
  onClick?: () => void;
  titolo: ReactNode;
  nota?: ReactNode;
  /** classe del pallino colorato, es. PUNTO_TONO[tono] */
  punto?: string;
  icona?: ComponentType<{ className?: string }>;
  /** contenuto a destra, prima della spunta (conteggi, importi) */
  coda?: ReactNode;
  disabilitata?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabilitata}
      aria-pressed={selezionata}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        selezionata
          ? "border-slate-300 bg-slate-100"
          : "border-slate-200 bg-white hover:bg-slate-50",
        disabilitata && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {punto ? (
        <span className={cn("h-2 w-2 shrink-0 rounded-full", punto)} />
      ) : Icona ? (
        <Icona className="h-4 w-4 shrink-0 text-slate-400" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-900">{titolo}</span>
        {nota ? (
          <span className="mt-0.5 block truncate text-[11px] leading-snug text-slate-500">
            {nota}
          </span>
        ) : null}
      </span>
      {coda ? <span className="shrink-0 text-[12px] text-slate-500">{coda}</span> : null}
      <Check
        className={cn(
          "h-4 w-4 shrink-0 text-slate-900 transition-opacity",
          selezionata ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}

/** Scelta breve in fila (durate, tipi, formati). Stessa logica della voce:
 *  niente riempimento pieno, la selezione è un fondo tenue + bordo più deciso. */
export function Pillola({
  attiva,
  onClick,
  titolo,
  disabilitata,
  className,
  children,
}: {
  attiva?: boolean;
  onClick?: () => void;
  titolo?: string;
  disabilitata?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titolo}
      disabled={disabilitata}
      aria-pressed={attiva}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5",
        "text-[12px] leading-none tabular-nums transition-colors",
        attiva
          ? "border-slate-400 bg-slate-200/70 font-semibold text-slate-900"
          : "border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50",
        disabilitata && "cursor-not-allowed opacity-45 hover:bg-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Riga di servizio: una frase che spiega, avvisa o conferma. Tenue per
 *  definizione — un avviso non deve gridare più del contenuto. */
export function NotaFinestra({
  tono = "neutro",
  icona: Icona,
  className,
  children,
}: {
  tono?: "neutro" | "attenzione" | "conferma";
  icona?: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
}) {
  const toni = {
    neutro: "border-slate-200 bg-white text-slate-600",
    attenzione: "border-amber-200 bg-amber-50 text-amber-900",
    conferma: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] leading-snug",
        toni[tono],
        className,
      )}
    >
      {Icona && <Icona className="mt-px h-3.5 w-3.5 shrink-0 opacity-70" />}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Elenco vuoto dentro una finestra: si dice perché è vuoto, non si lascia il
 *  buco. Tratteggiato, così non sembra una scheda vera. */
export function VuotoFinestra({
  testo,
  icona: Icona,
  className,
}: {
  testo: ReactNode;
  icona?: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center",
        className,
      )}
    >
      {Icona && <Icona className="h-4 w-4 text-slate-400" />}
      <p className="text-[12px] text-slate-500">{testo}</p>
    </div>
  );
}

/** Coppia etichetta/valore per i riepiloghi dentro le finestre. */
export function DatoFinestra({
  etichetta,
  children,
  className,
}: {
  etichetta: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-[11px] text-slate-500">{etichetta}</div>
      <div className="truncate text-[13px] font-medium text-slate-900">{children ?? "—"}</div>
    </div>
  );
}

/** Numero da leggere in mezzo secondo, versione da finestra: stesso riquadro
 *  bianco delle sezioni, nessun colore se non c'è un significato. */
export function KpiFinestra({
  etichetta,
  valore,
  nota,
  forte,
  className,
}: {
  etichetta: ReactNode;
  valore: ReactNode;
  nota?: ReactNode;
  /** true = è il numero che conta in questa finestra */
  forte?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5",
        className,
      )}
    >
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {etichetta}
      </div>
      <div
        className={cn(
          "truncate text-[19px] font-semibold leading-tight tabular-nums",
          forte ? "text-slate-900" : "text-slate-700",
        )}
      >
        {valore}
      </div>
      {nota ? <div className="truncate text-[11px] text-slate-500">{nota}</div> : null}
    </div>
  );
}
