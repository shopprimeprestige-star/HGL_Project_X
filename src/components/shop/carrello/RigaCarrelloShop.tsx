/** ── RigaCarrelloShop · VETRINA V1 · T89 (SPEC §4.5.5, V1-K1, V1-K2, V1-T9, V1-T11) ───────────────────────────
 *  Una riga del carrello nuovo: foto 1:1 (72 px sul telefono, 96 da sm), nome (link alla scheda), «{colore} · {misura}» come lo dà il server,
 *  prezzo di riga, quantità (`StepperQuantita`), «Togli», e sotto un avviso ambra se c'è qualcosa da dire su QUESTA riga.
 *  · È una voce di elenco (`<li>`): la lista (`<ul>`) la apre la pagina (T98).
 *  · Prezzi: solo `RigaVista` di T79 → `testoPrezzo`. Una cifra solo con «ok»; «…» in controllo, «—» se non si sa (D89). Mai la cifra
 *    ricordata dal browser, mai «da calcolare». Il prezzo ha una larghezza minima: «…» e la cifra non spostano la riga.
 *  · Il componente non tocca il carrello: `onQuantita(chiave, n)` e `onTogli(chiave)` sono di chi lo monta (di norma `setQty` e `remove` di
 *    `useCart`; `RemoveFromCart` lo emette la pagina con la riga del carrello, che qui non c'è). Parole: `testi-shop.ts`.
 *  · `AvvisoCarrello` è il riquadro ambra (icona + testo) che la pagina riusa per le righe tolte e per la frase «alcuni prodotti non sono
 *    più disponibili». La regione `role="status"` sta sempre nel disegno, anche vuota: una regione che nasce già piena non viene letta. */
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { TESTI_SHOP } from "@/landing/testi-shop";
import { testoPrezzo, type RigaVista } from "@/shop/cms/vetrina-carrello";
import { StepperQuantita } from "./StepperQuantita";

/** Un avviso inline con filetto ambra a sinistra (il giallo pieno è dei riquadri di modifica, T101 A18) e icona. Senza testo disegna solo la regione vuota (pronta a dire il prossimo avviso). */
export function AvvisoCarrello({ testo }: { testo: string | null | undefined }) {
  return (
    <div role="status">
      {testo ? (
        <p className="flex items-start gap-2 rounded-md border border-l-4 border-ink/10 border-l-[#8A5A00] bg-white px-3 py-2 text-sm text-ink">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#8A5A00]" />
          {testo}
        </p>
      ) : null}
    </div>
  );
}

interface Props {
  riga: RigaVista;
  /** L'avviso di questa riga (es. la quantità portata al massimo): il testo c'è già, lo scrive `avvisiRiga` di T79. */
  avviso?: string | null;
  /** Centesimi → «289,00 €»: lo stesso formattatore della pagina e delle barre. */
  formatta: (cent: number) => string;
  onQuantita: (chiave: string, qty: number) => void;
  onTogli: (chiave: string) => void;
}

export function RigaCarrelloShop({ riga, avviso, formatta, onQuantita, onTogli }: Props) {
  const params = { slug: riga.slug };
  return (
    <li className="flex flex-wrap gap-3 border-b border-ink/10 py-4 sm:gap-4">
      {/* Il nome è lì accanto: la foto è decorazione (alt vuoto). Senza foto il riquadro tiene il posto. */}
      <FotoShop
        foto={riga.foto}
        alt=""
        uso="miniatura"
        nascondiSeVuoto={false}
        className="h-[72px] w-[72px] shrink-0 rounded-lg sm:h-24 sm:w-24"
      />
      <div className="grid min-w-0 grow basis-48 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
        <Link
          to="/shop/prodotto/$slug"
          params={params}
          className="shop-anello flex min-h-11 min-w-0 items-center rounded-sm text-[15px] font-semibold leading-tight text-[#0A1430] underline-offset-4 hover:underline"
        >
          <span className="line-clamp-2">{riga.nome}</span>
        </Link>
        {riga.varianteNome && (
          <p className="col-start-1 break-words text-sm text-ink-muted">{riga.varianteNome}</p>
        )}
        {/* Sta in alto a destra ma dopo il nome nella lettura (posto esplicito, ordine del documento intatto). */}
        <p className="col-start-2 row-start-1 flex min-h-11 min-w-20 items-center justify-end text-right text-base font-semibold tabular-nums text-[#0A1430]">
          {testoPrezzo(riga.riga, formatta)}
        </p>
        {/* Quantità e «Togli» vanno a capo se non c'è posto (a 320 px nessuna barra orizzontale, V1-T11). */}
        <div className="col-span-2 mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <StepperQuantita
            qty={riga.qty}
            nome={riga.nome}
            onCambia={(n) => onQuantita(riga.key, n)}
          />
          <button
            type="button"
            onClick={() => onTogli(riga.key)}
            className="shop-anello inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 text-sm font-medium text-brand-scuro underline underline-offset-4 hover:text-ink"
          >
            {TESTI_SHOP.carrello.togli}
            <span className="sr-only"> {riga.nome}</span>
          </button>
        </div>
        <div className="col-span-2">
          <AvvisoCarrello testo={avviso} />
        </div>
      </div>
    </li>
  );
}
