/** ── CardProdotto · VETRINA V1 · T85 ──────────────────────────────────────────
 *  La card di un prodotto (home, categoria, ricerca) e i pezzi che «Ti serve anche» riusa (`PrezzoCard`, `AzioneCard`).
 *  Disegno del documento (§4.2.5, §4.5.2): bianca, bordo `ink/10`, raggio 14, foto 1:1 in alto, NIENTE ombra, niente stelle, niente barrato.
 *  Cosa decide e cosa no: la logica sta nei moduli puri (`vetrina-card.ts`: azione, colori, badge; `vetrina-interazioni.ts`: «Aggiunto»);
 *  qui si disegna. Le parole stanno in `testi-shop.ts`, tranne la «Da» dei prezzi diversi, che è provvisoria (sotto).
 *  · Il nome è un link con l'area estesa a tutta la card (`after:inset-0`): un solo punto di tabulazione per card. «Scegli» e «Scopri» sono
 *    il disegno del bottone dentro quell'area (non un secondo link verso lo stesso posto); «Aggiungi» è un vero bottone, sopra (`z-10`).
 *  · Invisible Derm (`senzaPrezzo`): nessuna cifra e nessun «Aggiungi», solo «Scopri».
 *  · Il badge «Pronta consegna» c'è solo se è vero (D86: `badgeProntaConsegna`). */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { TESTI_PROVVISORI, TESTI_SHOP, riempi } from "@/landing/testi-shop";
import { emettiEvento } from "@/lib/tracciamento/api";
import { useCart } from "@/shop/CartContext";
import type { Product } from "@/shop/catalog";
import {
  azioneCard,
  badgeProntaConsegna,
  etichettaColori,
  type AzioneCard as Azione,
  type CardLeggera,
} from "@/shop/cms/vetrina-card";
import { DURATA_AGGIUNTO_MS, statoAggiunta } from "@/shop/cms/vetrina-interazioni";

/** Testi che il documento non dà: provvisori, senza parole vietate, per il copywriter (si cambiano qui, in un punto solo). */
export const TESTI_CARD_PROVVISORI = {
  /** Davanti al prezzo quando le varianti costano cifre diverse: «Da 289,00 €». */
  da: "Da {prezzo}",
};

const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** Contorno notte, 44 px, angoli 6: l'unico bottone della card (un solo pieno per schermo: qui mai pieno). */
const CLASSI_BOTTONE =
  "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border-2 border-[#0A1430] px-3 text-sm font-semibold text-[#0A1430]";

/** Il prezzo: 18/600 sotto il nome. Nessuna cifra se la card non ne ha (Invisible Derm, dato mancante): niente nodo. «Da …» se le varianti costano cifre diverse. */
export function PrezzoCard({
  card,
}: {
  card: Pick<CardLeggera, "prezzoCent" | "prezziDiversi" | "senzaPrezzo">;
}) {
  if (card.senzaPrezzo || card.prezzoCent === null) return null;
  const prezzo = EURO.format(card.prezzoCent / 100);
  return (
    <p className="text-lg font-semibold tabular-nums text-[#0A1430]">
      {card.prezziDiversi ? riempi(TESTI_CARD_PROVVISORI.da, { prezzo }) : prezzo}
    </p>
  );
}

/** Il bottone «Aggiungi» o «Aggiunto» (senza stato: lo tiene `BottoneAggiungi`). `aggiunto` cambia l'etichetta, mai la larghezza né il fuoco. */
export function PulsanteAggiungi({
  nome,
  aggiunto,
  onAggiungi,
}: {
  nome: string;
  aggiunto: boolean;
  onAggiungi: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onAggiungi}
        className={`${CLASSI_BOTTONE} shop-anello relative z-10 bg-white transition-colors hover:bg-ink/5 active:bg-ink/10`}
      >
        {aggiunto ? (
          <>
            <Check aria-hidden className="shop-pop h-4 w-4" />
            {TESTI_SHOP.scheda.aggiunto}
          </>
        ) : (
          TESTI_SHOP.card.aggiungi
        )}
        <span className="sr-only"> {nome}</span>
      </button>
      {/* La regione annuncia l'aggiunta a chi non vede il bottone; c'è sempre nel disegno (una regione nuova non verrebbe letta). */}
      <span role="status" className="sr-only">
        {aggiunto ? riempi(TESTI_SHOP.scheda.nelCarrello, { nome }) : ""}
      </span>
    </>
  );
}

/** «Aggiungi» con un clic: mette nel carrello l'unica variante, dice «Aggiunto» per 2 secondi, poi torna «Aggiungi» (il timer CAMBIA uno stato). */
function BottoneAggiungi({ card }: { card: CardLeggera }) {
  const { add } = useCart();
  const [aggiuntoIl, setAggiuntoIl] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const aggiungi = () => {
    const sku = card.skuVarianti[0];
    // Solo ciò che `azioneCard` ha già verificato, ricontrollato: mai un prezzo o uno SKU inventato.
    if (!sku || card.prezzoCent === null) return;
    // shortcut: `add` vuole un `Product` del vecchio catalogo anche se con `cms` non lo legge; qui ne passiamo l'identità, non uno finto completo. Quando `add` lo renderà facoltativo, si toglie.
    add({ id: sku } as Product, 1, undefined, {
      sku,
      snap: {
        nome: card.nome,
        slug: card.slug,
        prezzoCent: card.prezzoCent,
        foto: card.foto,
        varianteNome: null,
      },
    });
    emettiEvento("AddToCart", {
      contentIds: [sku],
      contentName: card.nome,
      contentType: "product",
      valueCent: card.prezzoCent,
      numItems: 1,
    });
    setAggiuntoIl(Date.now());
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAggiuntoIl(null), DURATA_AGGIUNTO_MS);
  };

  return (
    <PulsanteAggiungi
      nome={card.nome}
      aggiunto={statoAggiunta(aggiuntoIl, Date.now()) === "aggiunto"}
      onAggiungi={aggiungi}
    />
  );
}

/** Il bottone della card secondo `azioneCard`: «Aggiungi» (bottone vero), «Scegli» o «Scopri» (il disegno del bottone: il clic lo prende il nome esteso). */
export function AzioneCard({
  card,
  azione = azioneCard(card),
}: {
  card: CardLeggera;
  azione?: Azione;
}) {
  if (azione === "aggiungi") return <BottoneAggiungi card={card} />;
  const testo = azione === "scopri" ? TESTI_PROVVISORI.card.scopri : TESTI_SHOP.card.scegli;
  return (
    <span aria-hidden className={`${CLASSI_BOTTONE} transition-colors group-hover:bg-ink/5`}>
      {testo}
    </span>
  );
}

/** Il nome come link: l'area è tutta la card (`after:inset-0`), il fuoco si vede intorno alla card intera. */
export function NomeCard({
  card,
  className = "",
}: {
  card: Pick<CardLeggera, "slug" | "nome">;
  className?: string;
}) {
  return (
    <Link
      to="/shop/prodotto/$slug"
      params={{ slug: card.slug }}
      className={`outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[#006CC4] ${className}`.trim()}
    >
      {card.nome}
    </Link>
  );
}

export interface PropsCard {
  card: CardLeggera;
  /** I testi confermati dal titolare: servono solo a decidere il badge «Pronta consegna» (D86). */
  testi?: Parameters<typeof badgeProntaConsegna>[0];
  /** `true` solo per la prima foto sopra la piega (D98). */
  prima?: boolean;
  /** Il livello del titolo: `h3` sotto un H2 di sezione (home), `h2` sotto l'H1 della pagina (categoria, ricerca). */
  livello?: "h2" | "h3";
}

export function CardProdotto({ card, testi, prima = false, livello = "h3" }: PropsCard) {
  const Titolo = livello;
  const badge = badgeProntaConsegna(testi, card.disponibile);
  const colori = etichettaColori(card.nColori);
  return (
    <article className="group relative flex h-full flex-col rounded-[14px] border border-ink/10 bg-white transition-colors hover:border-brand/35 focus-within:border-brand/35">
      <div className="relative">
        <FotoShop
          foto={card.foto}
          alt={card.fotoAlt}
          uso="card"
          prima={prima}
          className="rounded-t-[13px] [&_img]:transition-transform [&_img]:duration-200 group-hover:[&_img]:scale-[1.03]"
        />
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0A1430]">
            {badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <Titolo className="line-clamp-2 text-[15px] font-semibold leading-tight text-[#0A1430]">
          <NomeCard card={card} />
        </Titolo>
        {card.riga && <p className="line-clamp-2 text-sm text-ink-muted">{card.riga}</p>}
        {/* Colori, prezzo e bottone stanno in fondo: in una riga di card i prezzi e i bottoni restano allineati anche con nomi e righe di lunghezza diversa. */}
        <div className="mt-auto flex flex-col gap-1 pt-2">
          {colori && <p className="text-sm text-ink-muted">{colori}</p>}
          <PrezzoCard card={card} />
          <div className="pt-2">
            <AzioneCard card={card} />
          </div>
        </div>
      </div>
    </article>
  );
}
