/** ── RiepilogoOrdine · VETRINA V1 · T89 (SPEC §4.5.5, V1-K1, V1-K4, V1-T9) ─────────────────────────────────────
 *  Il riquadro del carrello: Prodotti · Spedizione · Totale (IVA inclusa), poi [Vai alla cassa]. Sempre in quest'ordine (SPEC §12.4.1 n. 7).
 *  · I soldi arrivano già decisi da `riepilogo()` di T79 (spedizione = tariffa del server, nessuna soglia, totale solo se si sa tutto):
 *    qui si scrive solo `testoPrezzo`. «…» mentre si controlla, «—» se non si sa; mai «da calcolare», mai una barra «ti manca…».
 *  · [Vai alla cassa] porta alla cassa di oggi (`/shop/checkout`, `PERCORSO_CASSA`), è l'unico bottone pieno del riquadro e resta acceso
 *    anche durante il controllo (D89: la cassa ricalcola dal server). Porta `ATTRIBUTO_BLOCCO`: finché è a schermo la barra fissa si nasconde
 *    (`BarraCarrello`, T84a); `refBottone` serve a chi misura (T98).
 *  · Niente consulenza, niente fiducia, niente «Continua a guardare»: sono della pagina. Parole: `testi-shop.ts`. */
import type { Ref } from "react";
import { Link } from "@tanstack/react-router";
import { ATTRIBUTO_BLOCCO } from "@/components/shop/guscio/BarreFisse";
import { TESTI_SHOP } from "@/landing/testi-shop";
import { testoPrezzo, type Riepilogo } from "@/shop/cms/vetrina-carrello";

interface Props {
  riepilogo: Riepilogo;
  /** Centesimi → «289,00 €»: lo stesso formattatore della pagina e delle barre. */
  formatta: (cent: number) => string;
  refBottone?: Ref<HTMLAnchorElement>;
}

export function RiepilogoOrdine({ riepilogo, formatta, refBottone }: Props) {
  const t = TESTI_SHOP.carrello;
  return (
    <div className="rounded-[14px] border border-ink/10 bg-white p-4 sm:p-5">
      <dl className="flex flex-col gap-2 text-sm text-ink-muted">
        <div className="flex items-baseline justify-between gap-3">
          <dt>{t.prodotti}</dt>
          <dd className="tabular-nums text-[#0A1430]">
            {testoPrezzo(riepilogo.prodotti, formatta)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>{t.spedizione}</dt>
          <dd className="tabular-nums text-[#0A1430]">
            {testoPrezzo(riepilogo.spedizione, formatta)}
          </dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-3 text-base text-[#0A1430]">
          <dt className="font-semibold">
            {t.totale} <span className="text-sm font-normal text-ink-muted">({t.ivaInclusa})</span>
          </dt>
          <dd className="text-lg font-semibold tabular-nums">
            {testoPrezzo(riepilogo.totale, formatta)}
          </dd>
        </div>
      </dl>
      <Link
        to="/shop/checkout"
        ref={refBottone}
        {...ATTRIBUTO_BLOCCO}
        className="shop-anello mt-4 flex h-14 w-full items-center justify-center rounded-md bg-[#0A1430] px-6 text-base font-semibold text-white transition-colors hover:bg-[#1B2A4E]"
      >
        {t.vaiAllaCassa}
      </Link>
    </div>
  );
}
