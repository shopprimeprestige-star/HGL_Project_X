/** ── BloccoAcquisto · VETRINA V1 · T87b ───────────────────────────────────────────────────────────────────────
 *  Il blocco d'acquisto della scheda (SPEC §4.5.4 n. 2-5): testata, prezzo, scelta della variante, «Aggiungi al carrello», conferma, fiducia.
 *  Due pezzi, perché la barra d'acquisto (T84a) deve fare LO STESSO gesto e leggere LO STESSO stato:
 *   · `useAcquisto(prodotto, scelta)`: il gesto (messaggio e fuoco alla scelta mancante, carrello, evento, «Aggiunto» per 2 s). La pagina lo
 *     chiama una volta e dà il risultato al blocco e alla barra (`onAggiungi={acquisto.aggiungi}`, `aggiunto`, `esaurito`).
 *  · `BloccoAcquisto`: il disegno. Non ha stato suo: la scelta (`scelta`, `onScegli`) e il gesto (`acquisto`) li tiene la pagina.
 *  Regole (SPEC, V1-S3, V1-S4):
 *   · il bottone si spegne SOLO per «Esaurito»; senza scelta resta acceso e il clic porta il fuoco alla scelta mancante (`fuocoSullaScelta`);
 *   · mai una riga nel carrello senza SKU: scelta mancante, combinazione che non esiste, variante esaurita, anteprima, Invisible Derm, prezzo non valido;
 *   · anteprima (bozza vista con la chiave, D94): stesso disegno della scheda vera, senza il bottone (al suo posto la striscia «anteprima») e senza
 *     `ATTRIBUTO_BLOCCO`: il titolare controlla in bozza campioni, spedizione e fiducia, ma niente si compra;
 *   · il prezzo viene dal prodotto del server (variante scelta, o «Da …» se le varianti costano cifre diverse): mai dal carrello o dalla memoria del browser;
 *   · dopo l'aggiunta: «Aggiunto» per 2 s, poi di nuovo «Aggiungi al carrello» (il timer CAMBIA uno stato: T105), e la striscia «{nome} è nel carrello ·
 *     Vai al carrello», che resta finché non si cambia pagina. Nessun avviso a comparsa, nessuna scorciatoia di acquisto immediato.
 *  Cosa decide e cosa no: la logica sta in `vetrina-varianti.ts`, `vetrina-scheda.ts`, `vetrina-eventi.ts`, `vetrina-interazioni.ts`, `vetrina-fiducia.ts`;
 *  qui si collega e si disegna. Le parole stanno in `testi-shop.ts`. Lo monta `PaginaScheda` (T97b): sul computer il blocco è `sticky` (`lg:self-start`
 *  perché in una griglia non si stiri) e porta `ATTRIBUTO_BLOCCO`, così la barra fissa si nasconde finché nome, prezzo e bottone sono a schermo. */
import { useEffect, useRef, useState, type RefObject } from "react";
import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BloccoFiducia } from "@/components/shop/BloccoFiducia";
import { ATTRIBUTO_BLOCCO } from "@/components/shop/guscio/BarreFisse";
import {
  fuocoSullaScelta,
  SelettoreVariante,
  type Mancante,
} from "@/components/shop/scheda/SelettoreVariante";
import { TESTI_PROVVISORI, TESTI_SHOP, riempi } from "@/landing/testi-shop";
import { emettiEvento } from "@/lib/tracciamento/api";
import { useCart } from "@/shop/CartContext";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { cardDaPubblico, badgeProntaConsegna } from "@/shop/cms/vetrina-card";
import { eventoAggiungi } from "@/shop/cms/vetrina-eventi";
import { DURATA_AGGIUNTO_MS, statoAggiunta } from "@/shop/cms/vetrina-interazioni";
import type { Blocco } from "@/shop/cms/vetrina-scheda";
import type { VoceFiducia } from "@/shop/cms/vetrina-fiducia";
import {
  messaggioMancante,
  statoBottone,
  varianteScelta,
  type Scelta,
} from "@/shop/cms/vetrina-varianti";

type Variante = ProdottoPubblico["varianti"][number];

/** Cosa dice la frase accanto al bottone: la variante scelta è esaurita, oppure la scelta fatta non si può comprare (nessuna variante, o il gruppo non c'è). */
export type FraseBottone = "esaurita" | "nonDisponibile";

/** Ciò che il gesto dà a chi disegna (il blocco) e a chi ha lo stesso bottone (la barra d'acquisto). */
export interface Acquisto {
  /** Il clic su «Aggiungi al carrello»: aggiunge, oppure porta il fuoco alla scelta mancante. Mai una riga senza SKU. */
  aggiungi: () => void;
  /** La variante scelta (`varianteScelta` di T78), o `null` se manca una scelta o la combinazione non esiste. */
  variante: Variante | null;
  /** Solo questo spegne il bottone: variante scelta esaurita, o prodotto tutto esaurito (`statoBottone` di T78). */
  esaurito: boolean;
  /** «Aggiunto» sul bottone: i 2 secondi di `statoAggiunta` (T105). */
  aggiunto: boolean;
  /** La striscia «{nome} è nel carrello»: dopo l'aggiunta, per QUESTO prodotto, finché non si cambia pagina. */
  nelCarrello: boolean;
  /** La scelta mancante dopo un clic (per `SelettoreVariante`): quale gruppo mostra «Scegli …». */
  mancante: Mancante | null;
  frase: FraseBottone | null;
  /** Va data al `ref` del selettore: da qui `fuocoSullaScelta` trova il gruppo. */
  selettoreRef: RefObject<HTMLDivElement | null>;
}

/** Il clic senza aver finito la scelta: su quale prodotto, quale opzione mancava, se il fuoco non ha trovato il gruppo, e la scelta di allora. */
interface Tentativo {
  slug: string;
  opzione: string | null;
  senzaGruppo: boolean;
  chiave: string;
}

const prezzoValido = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n > 0;
const chiaveDi = (scelta: Scelta) => JSON.stringify(Object.entries(scelta ?? {}).sort());

export function useAcquisto(prodotto: ProdottoPubblico, scelta: Scelta): Acquisto {
  const { add } = useCart();
  const [aggiunta, setAggiunta] = useState<{ slug: string; il: number | null } | null>(null);
  const [tentativo, setTentativo] = useState<Tentativo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selettoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const vendibile = prodotto.acquistabile === true && !prodotto.anteprima;
  const variante = varianteScelta(prodotto, scelta);
  const manca = messaggioMancante(prodotto.opzioni, scelta);
  const esaurito = statoBottone(variante, prodotto.varianti) === "esaurito";
  const chiave = chiaveDi(scelta);

  // il messaggio resta finché manca QUELLA scelta (non salta alla prossima senza un nuovo clic)
  const tentato = tentativo?.slug === prodotto.slug ? tentativo : null; // un clic su un altro prodotto non parla di questo
  const mancante =
    tentato?.opzione && !tentato.senzaGruppo && manca?.opzione === tentato.opzione ? manca : null;
  const nonDisponibile =
    !!tentato &&
    (tentato.senzaGruppo
      ? manca?.opzione === tentato.opzione
      : tentato.opzione === null && tentato.chiave === chiave && !manca);
  const frase: FraseBottone | null = nonDisponibile
    ? "nonDisponibile"
    : variante && !variante.disponibile
      ? "esaurita"
      : null;

  const aggiungi = () => {
    if (!vendibile || esaurito) return;
    if (manca) {
      // shortcut: se il fuoco non trova il gruppo (opzione senza valori disegnati) la frase accanto al bottone dice «scelta non disponibile»;
      // quando ogni opzione avrà per forza dei valori il ramo si può togliere.
      setTentativo({
        slug: prodotto.slug,
        opzione: manca.opzione,
        senzaGruppo: !fuocoSullaScelta(selettoreRef.current, manca.opzione),
        chiave,
      });
      return;
    }
    // senza SKU (combinazione che non esiste) o senza un prezzo valido del server: mai una riga nel carrello
    if (!variante || !prezzoValido(variante.prezzoCent)) {
      setTentativo({ slug: prodotto.slug, opzione: null, senzaGruppo: false, chiave });
      return;
    }
    add({ id: variante.sku }, 1, undefined, {
      sku: variante.sku,
      snap: {
        nome: prodotto.nome,
        slug: prodotto.slug,
        prezzoCent: variante.prezzoCent,
        foto: prodotto.media.find((m) => m.slot === "principale")?.src ?? null,
        varianteNome: Object.keys(variante.opzioni).length ? variante.nome : null,
      },
    });
    const evento = eventoAggiungi(prodotto, variante.sku, 1);
    if (evento) emettiEvento(evento.nome, evento.dati);
    setAggiunta({ slug: prodotto.slug, il: Date.now() });
    // il timer CAMBIA lo stato (T105): rileggere soltanto l'ora potrebbe lasciare «Aggiunto» se scatta 1 ms prima
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setAggiunta((a) => a && { ...a, il: null }),
      DURATA_AGGIUNTO_MS,
    );
  };

  const questo = aggiunta?.slug === prodotto.slug;
  return {
    aggiungi,
    variante,
    esaurito,
    aggiunto: questo && statoAggiunta(aggiunta.il, Date.now()) === "aggiunto",
    nelCarrello: questo,
    mancante,
    frase,
    selettoreRef,
  };
}

type BloccoAcquistoDati = Extract<Blocco, { id: "acquisto" }>;

interface Props {
  prodotto: ProdottoPubblico;
  /** Il blocco `acquisto` di `bloccheScheda` (T78): se si compra e se la riga «Spedizione» si disegna. */
  blocco: BloccoAcquistoDati;
  scelta: Scelta;
  onScegli: (scelta: Scelta) => void;
  acquisto: Acquisto;
  /** Le voci di fiducia VERE (`vociFiducia`, T76): da qui la riga «Spedizione» e la riga sotto il bottone. */
  voci: readonly VoceFiducia[];
  /** I testi confermati dal titolare: servono solo alla pillola «Pronta consegna» (`badgeProntaConsegna`). */
  testi?: Parameters<typeof badgeProntaConsegna>[0];
  /** Centesimi → «289,00 €»: lo stesso formattatore della pagina e delle barre. */
  formatta: (cent: number) => string;
}

export function BloccoAcquisto({
  prodotto,
  blocco,
  scelta,
  onScegli,
  acquisto,
  voci,
  testi,
  formatta,
}: Props) {
  const t = TESTI_SHOP.scheda;
  const eyebrow = prodotto.categorie?.[0]?.nome?.trim();
  const riga = prodotto.rigaPresentazione?.trim();
  const { variante, esaurito, aggiunto } = acquisto;

  const testata = (
    <div className="flex flex-col gap-2">
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{eyebrow}</p>
      )}
      <h1 className="text-balance break-words text-2xl font-bold leading-tight text-[#0A1430] lg:text-4xl">
        {prodotto.nome}
      </h1>
      {riga && <p className="text-base text-ink-muted">{riga}</p>}
    </div>
  );
  // niente `gap` sulla radice: le zone sotto il bottone sono spesso vuote e un `gap` lascerebbe uno spazio fantasma; i margini stanno sui pezzi che ci sono
  const radice = "flex flex-col lg:sticky lg:top-24 lg:self-start";

  // Invisible Derm e simili: la scheda si mostra, non si compra (nessun prezzo, bottone, scelta, spedizione)
  if (!blocco.acquistabile) return <div className={radice}>{testata}</div>;

  // il prezzo viene dai dati del server: la variante scelta, o il «da» del prodotto (con «Da …» se le varianti costano cifre diverse)
  const card = cardDaPubblico(prodotto);
  const cent = variante ? variante.prezzoCent : prodotto.prezzoDaCent;
  const prezzo = prezzoValido(cent) ? formatta(cent) : null;
  const conDa = !variante && card.prezziDiversi;
  const prezzoRiga = prezzo && (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-2xl font-semibold tabular-nums text-[#0A1430]">
        {conDa ? riempi(TESTI_PROVVISORI.card.da, { prezzo }) : prezzo}
      </span>
      <span className="text-sm text-ink-muted">{TESTI_SHOP.carrello.ivaInclusa}</span>
    </p>
  );

  // anteprima (bozza vista con la chiave, D94): si vede com'è, tutta, ma non si vende: manca solo il bottone (al suo posto la striscia)
  const anteprima = !!prodotto.anteprima;

  const spedizione = blocco.rigaSpedizione ? voci.find((v) => v.id === "spedizione")?.testo : null;
  const pronta = badgeProntaConsegna(
    testi,
    variante ? variante.disponibile : prodotto.varianti.some((v) => v.disponibile),
  );
  const nome = (n: string) => riempi(t.nelCarrello, { nome: n });

  return (
    <div className={radice}>
      {/* in anteprima non c'è bottone: la barra d'acquisto non ha niente da inseguire, quindi niente `ATTRIBUTO_BLOCCO` */}
      <div {...(anteprima ? {} : ATTRIBUTO_BLOCCO)} className="flex flex-col gap-5">
        {testata}
        {(prezzoRiga || spedizione) && (
          <div className="flex flex-col gap-1.5">
            {prezzoRiga}
            {spedizione && <p className="text-sm text-ink-muted">{spedizione}</p>}
          </div>
        )}
        {pronta && (
          <span className="self-start rounded-full border border-ink/15 bg-white px-2.5 py-1 text-xs font-semibold text-[#0A1430]">
            {pronta}
          </span>
        )}
        <SelettoreVariante
          prodotto={prodotto}
          scelta={scelta}
          onScegli={onScegli}
          mancante={acquisto.mancante}
          ref={acquisto.selettoreRef}
        />
        {anteprima ? (
          <p className="flex min-h-14 items-center rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-[#0A1430]">
            {TESTI_PROVVISORI.scheda.anteprimaStriscia}
          </p>
        ) : (
          <button
            type="button"
            onClick={acquisto.aggiungi}
            disabled={esaurito}
            className={`shop-anello flex h-14 w-full items-center justify-center gap-2 rounded-md px-6 text-base font-semibold transition-colors ${
              esaurito
                ? "cursor-not-allowed border-2 border-ink/40 bg-white text-ink-muted"
                : "bg-[#0A1430] text-white hover:bg-[#1B2A4E]"
            }`}
          >
            {esaurito ? (
              t.esaurito
            ) : aggiunto ? (
              <>
                <Check aria-hidden className="shop-pop h-5 w-5" />
                {t.aggiunto}
              </>
            ) : (
              t.aggiungi
            )}
          </button>
        )}
      </div>
      {/* Le due zone ci sono sempre, anche vuote: una regione `aria-live` che nasce con il testo dentro non viene letta. */}
      <div aria-live="polite">
        {acquisto.frase && (
          <p className="mt-3 text-sm text-ink-muted">
            {acquisto.frase === "esaurita"
              ? TESTI_PROVVISORI.scheda.sceltaEsaurita
              : TESTI_PROVVISORI.scheda.sceltaNonDisponibile}
          </p>
        )}
      </div>
      <div role="status">
        {acquisto.nelCarrello && (
          <p className="mt-3 flex items-center justify-between gap-3 rounded-md border border-ink/10 bg-white px-4 text-sm text-[#0A1430]">
            <span className="min-w-0 py-2">{nome(prodotto.nome)}</span>
            <Link
              to="/shop/carrello"
              className="shop-anello inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-4"
            >
              {t.vaiAlCarrello}
            </Link>
          </p>
        )}
      </div>
      {/* La spedizione, quando c'è, sta già in testata (e la decide `blocco`): nella riga di fiducia non si ripete mai. */}
      <BloccoFiducia className="mt-5" voci={voci.filter((v) => v.id !== "spedizione")} />
    </div>
  );
}
