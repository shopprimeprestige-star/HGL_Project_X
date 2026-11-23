/** ── TiServeAnche · VETRINA V1 · T85 ──────────────────────────────────────────
 *  «Ti serve anche»: UNA card orizzontale (foto 72, nome, prezzo, bottone di contorno), sulla scheda e, con un altro titolo, nel carrello.
 *  Il dato è il blocco `tiServeAnche` di `bloccheScheda` (T78): `correlato` = indirizzo, nome, prezzo da, foto. Quel blocco c'è solo con
 *  un prezzo e mai per Invisible Derm (lo decide T78); qui lo si rispetta di nuovo: senza prezzo o per Invisible Derm non si disegna niente.
 *  Il bottone segue `azioneCard` sulla card fatta da `correlato` (che porta `sku`, `prezziDiversi`, `aggiungibile`, T88b): «Aggiungi» con un clic se si può,
 *  altrimenti «Scegli» verso la scheda. La card la fa sempre `correlato`: una card già pronta non si passa (nessuno lo faceva, e due strade per lo stesso dato divergono). */
import { useId } from "react";
import { FotoShop } from "@/components/shop/FotoShop";
import { AzioneCard, NomeCard, PrezzoCard } from "@/components/shop/CardProdotto";
import { TESTI_SHOP } from "@/landing/testi-shop";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import type { CardLeggera } from "@/shop/cms/vetrina-card";

export type Correlato = NonNullable<ProdottoPubblico["correlato"]>;

/** La card da ciò che il server sa del correlato (T88b): `sku`, `prezziDiversi` e `aggiungibile` (si compra con un clic). `aggiungibile` conta solo con uno SKU
 *  vero e un prezzo (mai uno SKU inventato); un `correlato` del server di prima, senza le tre chiavi, dà una card che porta alla scheda («Scegli»). */
function cardDaCorrelato(c: Correlato): CardLeggera {
  const sku = typeof c.sku === "string" && c.sku !== "" ? c.sku : null;
  const aggiungibile = c.aggiungibile === true && sku !== null && c.prezzoDaCent !== null;
  return {
    slug: c.slug,
    nome: c.nome,
    riga: null,
    prezzoCent: c.prezzoDaCent,
    prezziDiversi: c.prezziDiversi === true,
    foto: c.foto ? { w480: c.foto.w480, w960: c.foto.w960 } : null,
    fotoAlt: c.foto ? "" : null, // il nome è lì accanto: la foto è decorativa
    nColori: 0,
    conVarianti: !aggiungibile,
    aggiungibile,
    disponibile: aggiungibile,
    senzaPrezzo: false,
    skuVarianti: aggiungibile && sku ? [sku] : [],
  };
}

export function TiServeAnche({
  correlato,
  titolo = TESTI_SHOP.scheda.tiServeAnche,
}: {
  correlato: Correlato | null | undefined;
  titolo?: string;
}) {
  const idTitolo = useId();
  if (
    !correlato ||
    correlato.prezzoDaCent === null ||
    eInvisibleDerm(correlato.nome, correlato.slug)
  )
    return null;
  const c = cardDaCorrelato(correlato);
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
