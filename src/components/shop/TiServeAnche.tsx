/** ── TiServeAnche · VETRINA V1 · T85 ──────────────────────────────────────────
 *  «Ti serve anche»: UNA card orizzontale (foto 72, nome, prezzo, bottone di contorno), sulla scheda e, con un altro titolo, nel carrello.
 *  Il dato è il blocco `tiServeAnche` di `bloccheScheda` (T78): `correlato` = indirizzo, nome, prezzo da, foto. Quel blocco c'è solo con
 *  un prezzo e mai per Invisible Derm (lo decide T78); qui lo si rispetta di nuovo: senza prezzo o per Invisible Derm non si disegna niente.
 *  ⚠️ `correlato` NON porta lo SKU della variante né se si compra con un clic: da solo la card dice «Scegli» e manda alla scheda.
 *  Se la pagina può dare la `CardLeggera` del correlato (`card`), il bottone segue `azioneCard` («Aggiungi» con un clic, se si può). */
import { useId } from "react";
import { FotoShop } from "@/components/shop/FotoShop";
import { AzioneCard, NomeCard, PrezzoCard } from "@/components/shop/CardProdotto";
import { TESTI_SHOP } from "@/landing/testi-shop";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import type { CardLeggera } from "@/shop/cms/vetrina-card";

export type Correlato = NonNullable<ProdottoPubblico["correlato"]>;

/** La card di ciò che si sa del correlato: niente SKU, niente «un clic» (porta alla scheda), niente «Da» (non sappiamo se i prezzi differiscono). */
function cardDaCorrelato(c: Correlato): CardLeggera {
  return {
    slug: c.slug,
    nome: c.nome,
    riga: null,
    prezzoCent: c.prezzoDaCent,
    prezziDiversi: false,
    foto: c.foto ? { w480: c.foto.w480, w960: c.foto.w960 } : null,
    fotoAlt: c.foto ? "" : null, // il nome è lì accanto: la foto è decorativa
    nColori: 0,
    conVarianti: false,
    aggiungibile: false,
    disponibile: false,
    senzaPrezzo: false,
    skuVarianti: [],
  };
}

export function TiServeAnche({
  correlato,
  card,
  titolo = TESTI_SHOP.scheda.tiServeAnche,
}: {
  correlato: Correlato | null | undefined;
  card?: CardLeggera | null;
  titolo?: string;
}) {
  const idTitolo = useId();
  if (
    !correlato ||
    correlato.prezzoDaCent === null ||
    eInvisibleDerm(correlato.nome, correlato.slug)
  )
    return null;
  const c =
    card && card.slug === correlato.slug && !card.senzaPrezzo ? card : cardDaCorrelato(correlato);
  return (
    <section aria-labelledby={idTitolo} className="flex flex-col gap-3">
      <h2 id={idTitolo} className="text-lg font-bold text-[#0A1430]">
        {titolo}
      </h2>
      <div className="group relative flex items-center gap-3 rounded-[14px] border border-ink/10 bg-white p-3 transition-colors hover:border-brand/35 focus-within:border-brand/35">
        <FotoShop
          foto={c.foto}
          alt={c.fotoAlt}
          uso="miniatura"
          sizes="72px"
          className="w-[72px] shrink-0 rounded-md"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-[#0A1430]">
            <NomeCard card={c} />
          </p>
          <PrezzoCard card={c} />
        </div>
        <div className="w-[7.5rem] shrink-0">
          <AzioneCard card={c} />
        </div>
      </div>
    </section>
  );
}
