/** ── StepperQuantita · VETRINA V1 · T89 (SPEC §4.5.5, V1-K2, V1-T11) ──────────────────────────────────────────
 *  «−», campo, «+»: tre elementi da 44 px, a 8 px l'uno dall'altro. Il campo è da 16 px (sotto, il telefono ingrandisce la pagina da solo)
 *  e numerico (`type="text"` con tastiera dei numeri: niente freccine né rotella che cambiano la quantità senza volerlo).
 *  · Limiti `min`…`max` (1…99, come `setQty` del carrello di oggi): ai bordi il bottone è spento, e il gestore ricontrolla comunque.
 *    Scendere sotto 1 non toglie la riga: si toglie con «Togli».
 *  · Scrivere nel campo cambia solo una BOZZA (stato del componente): la quantità vera parte con Invio o uscendo dal campo; Esc butta la bozza.
 *  · Un'unica regione `role="status"` dice «{nome}: quantità {n}» a chi non vede la riga; c'è già al primo disegno (una regione nuova non
 *    verrebbe letta) e cambia con la quantità. Non ci sono timer: la quantità è quella che arriva da fuori (`qty`).
 *  Il componente non conosce il carrello: chi lo usa passa `onCambia` (di norma `setQty` di `useCart`). Parole: `testi-shop.ts`. */
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { TESTI_PROVVISORI, riempi } from "@/landing/testi-shop";

/** Gli stessi limiti di `CartContext.setQty` (che non va oltre 99). */
export const QUANTITA_MIN = 1;
export const QUANTITA_MAX = 99;

/** Il testo scritto nel campo come quantità: intero portato dentro `min`…`max`; senza cifre resta la quantità di prima. */
export function quantitaDaTesto(testo: string, attuale: number, min: number, max: number): number {
  const n = Number.parseInt(testo, 10);
  return Number.isNaN(n) ? attuale : Math.min(max, Math.max(min, n));
}

const BOTTONE =
  "shop-anello flex h-11 w-11 items-center justify-center rounded-md border border-[#7C8695] bg-white text-[#0A1430] transition-colors hover:bg-ink/5 active:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

interface Props {
  qty: number;
  /** Il nome del prodotto: serve ai lettori di schermo per distinguere una riga dall'altra. */
  nome: string;
  /** Una quantità nuova, già dentro i limiti e diversa da `qty`. */
  onCambia: (qty: number) => void;
  min?: number;
  max?: number;
}

export function StepperQuantita({
  qty,
  nome,
  onCambia,
  min = QUANTITA_MIN,
  max = QUANTITA_MAX,
}: Props) {
  const t = TESTI_PROVVISORI.carrello;
  /** Quello che si sta scrivendo nel campo; `null` = niente in corso, si vede `qty`. */
  const [bozza, setBozza] = useState<string | null>(null);

  const vai = (voluta: number) => {
    const n = Math.min(max, Math.max(min, voluta));
    if (n !== qty) onCambia(n);
  };
  const conferma = () => {
    if (bozza === null) return;
    setBozza(null);
    vai(quantitaDaTesto(bozza, qty, min, max));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={qty <= min} onClick={() => vai(qty - 1)} className={BOTTONE}>
        <Minus aria-hidden className="h-4 w-4" />
        <span className="sr-only">
          {t.diminuisci} {nome}
        </span>
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={`${t.quantita} ${nome}`}
        value={bozza ?? String(qty)}
        onChange={(e) => setBozza(e.target.value.replace(/\D/g, "").slice(0, String(max).length))}
        onBlur={conferma}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            conferma();
          } else if (e.key === "Escape") setBozza(null);
        }}
        className="shop-anello h-11 w-12 rounded-md border border-[#7C8695] bg-white text-center text-base font-semibold tabular-nums text-[#0A1430]"
      />
      <button type="button" disabled={qty >= max} onClick={() => vai(qty + 1)} className={BOTTONE}>
        <Plus aria-hidden className="h-4 w-4" />
        <span className="sr-only">
          {t.aumenta} {nome}
        </span>
      </button>
      <span role="status" className="sr-only">
        {riempi(t.annuncio, { nome, n: qty })}
      </span>
    </div>
  );
}
