/** ── IL RIQUADRO CHE CHIEDE UNA FOTO ───────────────────────────────────────
 *
 *  Ce n'erano due, uguali nel mestiere e diversi nell'aspetto: uno per la foto
 *  di un taglio, uno per la foto da cui prendere il colore. Erano due rettangoli
 *  tratteggiati e grigi in fondo alla pagina — cioè la forma che su qualunque
 *  sito vuol dire «zona di scarico», e il posto dove non guarda nessuno.
 *
 *  ── ⚠️ STA IN CIMA, PRIMA DELLA GRIGLIA ──────────────────────────────────
 *  «Voglio questo taglio qui» è la richiesta più naturale davanti a una prova
 *  capelli, e stava sepolta sotto trentacinque riquadri: chi scorreva fino in
 *  fondo l'aveva già scartata per stanchezza. Le due strade — scegli dalla
 *  vetrina, oppure portami la tua foto — sono pari, e la seconda si vede per
 *  prima perché è quella che nessuno si aspetta.
 *
 *  ── ⚠️ E NON È PIÙ TRATTEGGIATO ──────────────────────────────────────────
 *  Il tratteggio dice «trascina qui un file», che su un telefono non vuol dire
 *  niente e su un computer promette una cosa che non facciamo. Un riquadro
 *  pieno con un bordo che si accende dice quello che è: un tasto.
 */
import type { LucideIcon } from "lucide-react";
import { Check, Loader2, X } from "lucide-react";

export function RiquadroCarica({
  icona: Icona,
  titolo,
  sotto,
  anteprima,
  attivo,
  occupato,
  onClick,
  onRimuovi,
}: {
  icona: LucideIcon;
  titolo: string;
  sotto: string;
  /** la miniatura della foto già scelta, se c'è */
  anteprima?: string;
  /** questa è la scelta in corso */
  attivo?: boolean;
  /** sta lavorando: niente doppi tocchi */
  occupato?: boolean;
  onClick: () => void;
  /** ── ⚠️ TOGLIERE UNA FOTO DEVE COSTARE UN TOCCO ────────────────────────
   *  Una foto caricata per sbaglio — quella del colore al posto di quella del
   *  taglio, o una venuta male — restava lì per sempre: si poteva solo
   *  SOSTITUIRE, cioè cercarne un'altra nel telefono. Chi voleva semplicemente
   *  tornare indietro non aveva nessuna strada, e la prova partiva con dentro
   *  un riferimento che non voleva più. */
  onRimuovi?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={occupato}
      className={`group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl px-4 py-3.5 text-left transition disabled:opacity-70 ${
        attivo
          ? "hg-bordo-vivo hg-alone"
          : "hg-vetro hg-lucido hover:-translate-y-0.5 hover:border-white/25"
      }`}
      style={attivo ? ({ ["--hg-fondo" as string]: "#0b1224" }) : undefined}
    >
      {/* ── ⚠️ L'ALONE SI ACCENDE SOLO AL PASSAGGIO ────────────────────────
            Una luce sempre accesa su un riquadro secondario ruba l'attenzione
            al tasto principale, che è quello blu più in basso. Qui compare
            quando ci passi sopra: dice «sono un tasto» a chi lo sta già
            guardando, e sta zitto con tutti gli altri. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-10 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-blue-500/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <span
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition ${
          attivo ? "border-blue-400/40 bg-blue-500/15" : "border-white/12 bg-white/[0.04] group-hover:border-white/25"
        }`}
      >
        {anteprima ? (
          <img src={anteprima} alt="" className="h-full w-full object-cover" />
        ) : occupato ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
        ) : (
          //  ⚠️ L'icona si muove di un pelo al passaggio: è l'unica animazione
          //   che ci sta su un elemento secondario. Un rimbalzo o una
          //   rotazione, qui, sarebbero un giocattolo in mezzo a una scelta.
          <Icona className="h-5 w-5 text-white/55 transition-transform duration-300 group-hover:scale-110 group-hover:text-blue-200" />
        )}
        {!!anteprima && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{titolo}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-white/45">{sotto}</span>
      </span>

      {/*  ⚠️ Dentro il riquadro c'è già un tasto, e un tasto dentro un tasto
          non si può fare: questo è un `span` con il suo gestore, e il tocco si
          ferma qui — senza `stopPropagation` togliere la foto aprirebbe anche
          il selettore di file, cioè l'opposto di quello che si è chiesto. */}
      {!!onRimuovi && !!anteprima && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Togli questa foto"
          title="Togli questa foto"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRimuovi(); }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.stopPropagation();
            e.preventDefault();
            onRimuovi();
          }}
          className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/12 text-white/45 transition hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-200"
        >
          <X className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
