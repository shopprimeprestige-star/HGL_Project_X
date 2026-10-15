/** ── LA TESTATA DI /soluzioni · riga del marchio, titolo, volto del titolare (landing v3, 4.2) ───────────
 *  Niente si muove (H1 e ritratto sono l'LCP), niente menu, niente collegamenti: la riga del marchio è
 *  solo logo e indirizzo. Il ritratto manca = niente cerchio, il sottotitolo prende tutta la larghezza.
 *  Il bottone blu sta qui, in alto a destra, solo da 1024; su telefono sta sotto la tavola (`BloccoConsulenza`).
 *  Caratteri, colori e scala tipografica sono le classi `sol-*` di S2. */
import type { ReactNode } from "react";
import logo from "@/assets/logo-hair-genius.png";
import { RichText } from "@/components/landing/RichText";
import { TESTI_SOLUZIONI as T } from "@/landing/testi-sito";
import { BottonePrimario } from "./Azioni";
import { Foto } from "./Foto";
import type { Interesse, Slot } from "./regole";
import { CONTENITORE } from "./stile";

export type AlPrenotare = (interesse: Interesse, da: HTMLElement) => void;

/** L'unico bottone blu della schermata, con la sua riga. */
export function BloccoConsulenza({ onPrenota, className = "" }: { onPrenota: AlPrenotare; className?: string }): ReactNode {
  return (
    <div className={className}>
      <BottonePrimario onClick={(e) => onPrenota("non-so", e.currentTarget)}>{T.primario.bottone}</BottonePrimario>
      <p className="sol-didascalia mt-3 text-[var(--hgl-dettagli)]">{T.primario.riga}</p>
    </div>
  );
}

export function Testata({ ritratto, onPrenota }: { ritratto: Slot | null; onPrenota: AlPrenotare }) {
  return (
    <header className={`${CONTENITORE} lg:pt-11`}>
      {/* Riga del marchio (non fissa): logo a sinistra, luogo a destra, solo testo. Da 1024 sta sotto la barra delle patch (44). Gli spazi di «Via degli Scipioni 132» sono non separabili: si va a capo solo dopo «·», mai in mezzo all'indirizzo (marketing n. 4). */}
      <div className="flex min-h-12 items-center justify-between gap-4 lg:min-h-[72px]">
        <img src={logo} alt={T.marchio.logoAlt} width={110} height={26} className="h-[26px] w-auto select-none lg:h-8" draggable={false} />
        <p className="text-right text-[13px] font-medium leading-snug text-[var(--hgl-dettagli)] lg:text-[15px]">
          {T.marchio.indirizzo.replace(/( · )(.+)$/, (_, sep: string, via: string) => sep + via.replace(/ /g, "\u00A0"))}
        </p>
      </div>

      <h1 className="sol-h1 mt-3 text-white lg:mt-12">
        <span className="block">{T.titolo.prima}</span>
        <span className="block">
          <RichText value={T.titolo.seconda} highlightClass="text-[var(--hgl-titoli)]" />
        </span>
      </h1>

      <div className="mt-3 lg:mt-6 lg:grid lg:grid-cols-12 lg:items-end lg:gap-8">
        {/* Il volto (72 px su telefono, 96 su computer) guarda verso la tavola; il sottotitolo gli sta accanto. */}
        <div className="flex items-center gap-3 lg:col-span-7 lg:gap-5">
          {ritratto ? (
            <span className="block size-[72px] shrink-0 overflow-hidden rounded-full border-2 border-[var(--hgl-dettagli)]/40 lg:size-24">
              <Foto slot={ritratto} formato="4:5" larghezza={96} altezza={96} priorita="alta" posizione="50% 25%" className="size-full object-cover" />
            </span>
          ) : null}
          <p className="sol-sottotitolo text-white [@media(max-height:700px)]:max-lg:text-sm">{T.sottotitolo}</p>
        </div>
        <BloccoConsulenza onPrenota={onPrenota} className="hidden lg:col-span-5 lg:block" />
      </div>
    </header>
  );
}
