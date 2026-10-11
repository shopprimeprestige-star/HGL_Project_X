/** ── LA TESTATA DELLA PROVA ────────────────────────────────────────────────
 *
 *  ── ⚠️ TERZO TENTATIVO, E I PRIMI DUE ERANO LO STESSO TENTATIVO ──────────
 *  Le prime due volte ho spostato le cose dentro la stessa colonna centrata:
 *  logo un po' più su, un filo in mezzo, le pastiglie un po' più belle. Il
 *  committente me l'ha richiesto tre volte, ed è la risposta più chiara che
 *  ci sia — non era una questione di rifinitura, era l'impianto.
 *  Qui l'impianto è cambiato: il marchio non sta più nella colonna del
 *  contenuto ma in una BARRA che resta in alto anche scorrendo, come in
 *  qualunque applicazione; il titolo diventa un'apertura vera; e i passi non
 *  sono più quattro cerchi in fila ma un binario che si trasforma.
 *
 *  ── ⚠️ IL MARCHIO IN UNA BARRA CHE RESTA ─────────────────────────────────
 *  È la separazione più forte che esista fra due cose: metterle su due piani
 *  diversi. La barra è vetro, si stacca dal fondo, e porta a destra il numero
 *  di prove — l'unica informazione che serve sempre, in qualunque passo.
 *
 *  ── ⚠️ E I PASSI SI TRASFORMANO ──────────────────────────────────────────
 *  Quello dove sei si allarga e mostra il nome; gli altri restano icone. Non
 *  è un vezzo: su un telefono quattro etichette in fila si accavallano, e
 *  accorciarle tutte vuol dire non leggerne nessuna. Così il nome c'è sempre,
 *  ma solo dove serve — su quello che stai facendo adesso.
 */
import { Camera, Check, Palette, Scissors, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PassoProva = "foto" | "taglio" | "colore" | "risultato";

const PASSI: Array<{ chiave: PassoProva; nome: string; icona: LucideIcon }> = [
  { chiave: "foto", nome: "La tua foto", icona: Camera },
  { chiave: "taglio", nome: "Il taglio", icona: Scissors },
  { chiave: "colore", nome: "Il colore", icona: Palette },
  { chiave: "risultato", nome: "Il risultato", icona: Sparkles },
];

/** ── LA BARRA IN ALTO ──────────────────────────────────────────────────────
 *  Vetro, resta in cima, e sotto ha un filo che si riempie con l'avanzamento:
 *  il progresso si vede anche quando i passi sono scorsi via.
 */
export function BarraAlta({
  logo, restano, passo,
}: {
  logo?: string;
  /** −1 = illimitate (chi vende): non si mostra niente */
  restano: number | null;
  passo: PassoProva | string;
}) {
  const qui = PASSI.findIndex((p) => p.chiave === passo);
  const avanzamento = qui < 0 ? 0 : ((qui + 1) / PASSI.length) * 100;

  return (
    //  ⚠️ Niente margini negativi e niente `max-w`: la barra è larga quanto lo
    //   schermo, punto. Dentro, il contenuto si allinea alla stessa colonna
    //   del resto della pagina — così il logo sta sopra il titolo e non
    //   appiccicato al bordo su un monitor grande.
    <div className="sticky top-0 z-30 w-full">
      <div className="hg-vetro-forte relative w-full">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3.5 sm:px-6">
        {logo ? (
          <img src={logo} alt="Hair Genius Labs" className="h-8 w-auto max-w-[11rem] object-contain sm:h-9" />
        ) : (
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/75">
            Hair Genius Labs
          </span>
        )}

        <span className="min-w-0 flex-1" />

        {/*  ⚠️ Il numero delle prove sta QUI e non sotto al titolo: è l'unica
            informazione che serve in ogni passo, e in una barra che resta si
            vede sempre — anche a metà della griglia dei tagli, che è dove
            serve davvero («ne provo un altro o no?»). */}
        {restano !== null && restano >= 0 && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[12px] font-medium text-white/70">
            <Sparkles className="h-3 w-3 text-blue-300" />
            <span className="tabular-nums">{restano}</span>
            <span className="hidden sm:inline">{restano === 1 ? "prova" : "prove"}</span>
          </span>
        )}

        </div>

        {/*  Il filo dell'avanzamento: sottile, in fondo alla barra e largo
            quanto lo schermo, non quanto la colonna. Dice a che punto sei
            senza occupare una riga. */}
        <span className="absolute inset-x-0 bottom-0 block h-[2px] bg-white/[0.06]">
          <span
            className="block h-full bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400 transition-all duration-700 ease-out"
            style={{ width: `${avanzamento}%` }}
          />
        </span>
      </div>

      {/*  ── ⚠️ «POWERED BY», SOTTO LA BARRA ────────────────────────────
            Chiesto dal committente, e sta bene qui: la firma di chi ha fatto
            lo strumento va attaccata alla testata, non persa in fondo alla
            pagina dove arriva solo chi scorre tutto. Piccola e smorta: è una
            firma, non una réclame. */}
      <p className="bg-[#050f24]/80 py-1.5 text-center text-[10px] uppercase tracking-[0.2em] text-white/25 backdrop-blur">
        powered by Hair Genius Labs
      </p>
    </div>
  );
}

/** L'apertura: sopravvitolo piccolo, titolo grande, una riga sotto. */
export function Apertura({ titolo, sotto }: { titolo: string; sotto: string }) {
  return (
    <div className="text-center">
      {/*  ⚠️ Il sopravvitolo non ripete il marchio (che è già nella barra) ma
          dice CHE COSA È questa pagina: chi arriva da un link in chat non lo
          sa, e il titolo da solo — «Guardati con i capelli» — è un invito,
          non una spiegazione. */}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        <Sparkles className="h-3 w-3 text-blue-300" /> anteprima capelli
      </span>
      <h1 className="mt-4 bg-gradient-to-b from-white via-white to-white/45 bg-clip-text text-[2rem] font-semibold leading-[1.05] tracking-tight text-transparent sm:text-[2.75rem]">
        {titolo}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-snug text-white/45">{sotto}</p>
    </div>
  );
}

/** ── IL BINARIO DEI PASSI ──────────────────────────────────────────────────
 *  Quello corrente si allarga e mostra il nome, gli altri restano icone.
 */
export function Passi({
  passo, admin, haFoto, guida, vai,
}: {
  passo: PassoProva | string;
  admin?: boolean;
  haFoto?: boolean;
  /** ── ⚠️ CHI CONDUCE SI MUOVE ANCHE SENZA FOTO ────────────────────────
   *  In consulenza la foto ce l'ha il cliente, non il consulente: legare i
   *  passi al possesso della foto vorrebbe dire che chi guida la consulenza
   *  non può nemmeno aprire la vetrina dei tagli — cioè non può fare il suo
   *  mestiere. Lui si muove, e il cliente lo segue (vedi prova/specchio). */
  guida?: boolean;
  vai?: (p: PassoProva) => void;
}) {
  const qui = PASSI.findIndex((p) => p.chiave === passo);
  if (qui < 0) return null;

  return (
    //  ⚠️ A TUTTA LARGHEZZA, non stretti in mezzo: quattro pastiglie piccole
    //   al centro di uno schermo largo sembrano un residuo, e la barra dei
    //   passi è la seconda cosa che si guarda dopo il titolo. Ogni passo
    //   prende la sua parte, e quello corrente prende il doppio.
    <div className="flex w-full items-center gap-2">
      {PASSI.map((p, i) => {
        const fatto = i < qui;
        const adesso = i === qui;
        const Icona = p.icona;
        const raggiungibile = !!vai && (guida || (!!admin && (p.chiave === "foto" || haFoto)));
        return (
          <button
            key={p.chiave}
            type="button"
            disabled={!raggiungibile}
            aria-current={adesso ? "step" : undefined}
            onClick={() => raggiungibile && vai?.(p.chiave)}
            //  ⚠️ La transizione è su TUTTO, non solo sul colore: il riquadro
            //   che si allarga è quello che rende il passaggio una cosa sola
            //   invece di quattro pastiglie che cambiano tinta insieme.
            className={`group relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl border px-3 transition-all duration-500 ease-out ${
              adesso
                ? "hg-shine flex-[2.4] border-transparent bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/30"
                : fatto
                  ? "flex-1 border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                  : "flex-1 border-white/8 bg-white/[0.03] text-white/25"
            } ${raggiungibile ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
          >
            {fatto ? (
              <Check className="h-4 w-4 shrink-0 duration-300 animate-in zoom-in" strokeWidth={3} />
            ) : (
              <Icona
                className={`h-4 w-4 shrink-0 transition-transform duration-500 ${
                  adesso ? "scale-110" : "group-hover:scale-110"
                }`}
              />
            )}
            {/*  Il nome compare solo sul passo corrente, e in dissolvenza: se
                comparisse di colpo, a ogni cambio la riga «salterebbe». */}
            {adesso ? (
              <span className="truncate text-[13px] font-semibold duration-500 animate-in fade-in slide-in-from-left-2">
                {p.nome}
              </span>
            ) : (
              //  ⚠️ Il nome c'è anche sui passi non correnti, ma sparisce sotto
              //   i 640 punti: sul telefono quattro nomi in fila si
              //   accavallerebbero, e lì restano le sole icone.
              <span className="hidden truncate text-[12px] font-medium sm:inline">{p.nome}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
