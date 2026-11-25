/** ── IL FOGLIO DEI FILTRI (VETRINA V1 · T90) ──────────────────────────────────────────────────────────────
 *  Il foglio dal basso del telefono (documento §4.5.3): titolo, X da 44 px, i gruppi dei filtri che scorrono, e in fondo «Mostra {n} prodotti»
 *  pieno notte e «Azzera filtri». Radix Dialog (D82): fuoco intrappolato ed Esc li dà lui. Questo file si scarica solo al primo tocco sulla barra
 *  (`lazy` in `FiltriCategoria`), così Radix non pesa sulla prima pagina. Non scrive nessuna parola: i testi e i gruppi li dà `FiltriCategoria`.
 *  Il fuoco alla chiusura lo restituisce `FiltriCategoria` (riduttore `foglio`): qui si impedisce a Radix di mandarlo dove capita e si chiama
 *  `onRendiFuoco`. Entra con `shop-foglio` e lo sfondo con `shop-dissolvi` (D100). Il numero del bottone cambia a ogni scelta: la regione `status`
 *  lo dice a chi non vede (fuori dal foglio, Radix nasconde la pagina). */
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export interface FoglioFiltriProps {
  aperto: boolean;
  /** Radix chiede di cambiare lo stato (X, Esc, tocco fuori, «Mostra»). */
  onApertoChange: (aperto: boolean) => void;
  titolo: string;
  chiudi: string;
  /** «Mostra 12 prodotti»: chiude il foglio. */
  mostra: string;
  /** Quanti prodotti passano, detto a voce a ogni scelta. */
  annuncio: string;
  /** «Azzera filtri»: solo se c'è qualcosa da azzerare. */
  azzera?: { testo: string; onClick: () => void };
  /** Il foglio si è chiuso: la barra rimette il fuoco sul suo bottone. */
  onRendiFuoco: () => void;
  children: ReactNode;
}

export default function FoglioFiltri({
  aperto,
  onApertoChange,
  titolo,
  chiudi,
  mostra,
  annuncio,
  azzera,
  onRendiFuoco,
  children,
}: FoglioFiltriProps) {
  return (
    <Dialog.Root open={aperto} onOpenChange={onApertoChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="shop-dissolvi fixed inset-0 z-[55] bg-black/70" />
        <Dialog.Content
          // niente descrizione: il titolo basta (e Radix non protesta)
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onRendiFuoco();
          }}
          className="shop-foglio fixed inset-x-0 bottom-0 z-[55] flex max-h-[85dvh] flex-col rounded-t-2xl bg-white focus:outline-none"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-ink/10 pl-4 pr-2 min-[360px]:pl-6">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-ink">
              {titolo}
            </Dialog.Title>
            <Dialog.Close
              aria-label={chiudi}
              className="shop-anello inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-ink/5"
            >
              <X className="size-6" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 min-[360px]:px-6">
            {children}
          </div>

          <div className="shrink-0 space-y-1 border-t border-ink/10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 min-[360px]:px-6">
            <p role="status" className="sr-only">
              {annuncio}
            </p>
            <Dialog.Close
              data-aspetto="pieno"
              className="shop-anello inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#0A1430] px-6 text-sm font-semibold text-white hover:bg-[#1B2A4E]"
            >
              {mostra}
            </Dialog.Close>
            {azzera && (
              <button
                type="button"
                onClick={azzera.onClick}
                className="shop-anello inline-flex min-h-11 w-full items-center justify-center text-sm font-medium text-brand-scuro underline underline-offset-4 hover:text-ink"
              >
                {azzera.testo}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
