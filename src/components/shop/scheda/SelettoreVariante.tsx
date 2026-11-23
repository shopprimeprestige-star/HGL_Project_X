/** ── SelettoreVariante · VETRINA V1 · T87a ────────────────────────────────────
 *  La scelta della variante nella scheda (SPEC §4.5.4 n. 3): un gruppo per ogni opzione del prodotto.
 *  · Il colore è a campioni a cerchio con la foto vera del campione (senza foto: la prima lettera su fondo notte, mai una tinta inventata);
 *    le altre opzioni (misura, lunghezza, base…) sono pillole. Ogni bersaglio è da 44 px.
 *  · Il valore scelto ha l'anello (bordo notte) e la spunta; il suo nome sta sotto i campioni.
 *  · Un valore esaurito ha la diagonale e la parola «Esaurito» nell'etichetta accessibile (V1-S4), ma si può scegliere: è così che il
 *    bottone d'acquisto (T87b) diventa «Esaurito». Nessun radio è mai `disabled`.
 *  · Tastiera da `radiogroup`: una sola tappa per gruppo (il valore scelto, o il primo); frecce, Home e End spostano e scelgono.
 *  · Manca una scelta (`mancante`, dato da `messaggioMancante`): il messaggio sta accanto al gruppo, in una zona `aria-live`.
 *  Cosa decide e cosa no: le regole sono in `vetrina-varianti.ts` (campioni, esaurito, etichette, SKU) e `vetrina-interazioni.ts` (frecce);
 *  qui si disegna. Il componente è controllato (`scelta` entra, `onScegli` esce): lo stato lo tiene la pagina. Le parole stanno in
 *  `testi-shop.ts`. Il fuoco alla scelta mancante lo porta `fuocoSullaScelta`, chiamata da T87b; il montaggio nella pagina è di T97b. */
import { useId, type KeyboardEvent, type Ref } from "react";
import { Check, CircleAlert } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { TESTI_PROVVISORI } from "@/landing/testi-shop";
import { emettiSoloContatore } from "@/lib/tracciamento/api";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { comandoDaTasto, stepGalleria } from "@/shop/cms/vetrina-interazioni";
import { contaVariante } from "@/shop/cms/vetrina-eventi";
import {
  campioniColore,
  etichettaCampione,
  skuScelto,
  valoreEsaurito,
  type CampioneColore,
  type Scelta,
} from "@/shop/cms/vetrina-varianti";

type Opzione = ProdottoPubblico["opzioni"][number];

/** La scelta mancante come la dà `messaggioMancante` (il nome dell'opzione e la chiave del testo). */
export type Mancante = { opzione: string; chiave: string };

const NOTTE = "#0A1430";
/** La diagonale di un valore esaurito: una riga da 2 px da un angolo all'altro, in `colore` (bianca sulla pillola scelta). */
const diagonale = (colore: string) => ({
  backgroundImage: `linear-gradient(to top right, transparent calc(50% - 1px), ${colore} calc(50% - 1px), ${colore} calc(50% + 1px), transparent calc(50% + 1px))`,
});

/** Il tasto di una freccia (o Home, End) → dove va il fuoco: l'indice nuovo, fermo ai bordi. `null` se il tasto non è suo (Tab, Invio, Spazio… restano al browser).
 *  Su/giù valgono come sinistra/destra; il passo è quello della galleria (T105), nessuna regola riscritta. */
export function passoDaTasto(tasto: string, indice: number, totale: number): number | null {
  const comando = comandoDaTasto(
    tasto === "ArrowDown" ? "ArrowRight" : tasto === "ArrowUp" ? "ArrowLeft" : tasto,
  );
  return comando && totale > 0 ? stepGalleria({ indice, totale }, comando).indice : null;
}

/** Porta il fuoco sulla tappa del gruppo dell'opzione `opzione` (il valore scelto, o il primo). `false` se il gruppo non c'è.
 *  Il browser scorre fin lì da solo (`scroll-padding` di `[data-shop-v1]`). Va chiamata dal bottone d'acquisto quando manca una scelta. */
export function fuocoSullaScelta(radice: ParentNode | null | undefined, opzione: string): boolean {
  const gruppo = [...(radice?.querySelectorAll<HTMLElement>('[role="radiogroup"]') ?? [])].find(
    (g) => g.dataset.opzione === opzione,
  );
  const tappa = gruppo?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]');
  tappa?.focus();
  return !!tappa;
}

/** Il messaggio accanto alla scelta mancante: da `testi-shop.ts` sotto `scheda.scegli.<opzione>`.
 *  shortcut: un'opzione con un nome fuori elenco (testo libero del CRM) mostra il suo nome, senza frase, finché il copywriter non dà un testo per quel nome (o un testo generico). */
function testoScegli({ opzione, chiave }: Mancante): string {
  const testi: Record<string, string> = TESTI_PROVVISORI.scheda.scegli;
  const k = chiave.split(".").pop() ?? "";
  return Object.hasOwn(testi, k) ? testi[k] : opzione;
}

type PropsRadio = {
  valore: string;
  scelto: boolean;
  esaurito: boolean;
  tappa: boolean;
  onScegli: () => void;
};

/** Un campione a cerchio: foto vera del campione, o la prima lettera su notte. Bordo da 2 px (notte se scelto), cerchio da 36 px dentro un bersaglio da 44. */
function Campione({
  c,
  scelto,
  esaurito,
  tappa,
  onScegli,
}: Omit<PropsRadio, "valore"> & { c: CampioneColore }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={scelto}
      aria-label={etichettaCampione(c.valore, esaurito)}
      tabIndex={tappa ? 0 : -1}
      onClick={onScegli}
      className={`shop-anello relative size-11 rounded-full border-2 p-0.5 ${scelto ? "border-[#0A1430]" : "border-transparent"}`}
    >
      <span className="relative flex size-full items-center justify-center overflow-hidden rounded-full bg-[#0A1430] text-base font-semibold text-white">
        {c.campione ? (
          <FotoShop foto={c.campione} alt="" uso="miniatura" className="size-full" />
        ) : (
          <span aria-hidden="true">{c.lettera}</span>
        )}
        {esaurito && (
          <>
            <span aria-hidden="true" className="absolute inset-0 bg-white/60" />
            <span
              data-esaurito
              aria-hidden="true"
              className="absolute inset-0"
              style={diagonale(NOTTE)}
            />
          </>
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-[#0A1430]/20"
        />
      </span>
      {scelto && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-[#0A1430] text-white"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Una pillola (misura, lunghezza, base…): contorno notte, scelta = piena notte con testo bianco; esaurita = diagonale. */
function Pillola({ valore, scelto, esaurito, tappa, onScegli }: PropsRadio) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={scelto}
      aria-label={etichettaCampione(valore, esaurito)}
      tabIndex={tappa ? 0 : -1}
      onClick={onScegli}
      className={`shop-anello relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 overflow-hidden rounded-md border-2 px-4 text-base font-semibold ${
        scelto
          ? "border-[#0A1430] bg-[#0A1430] text-white"
          : `border-[#0A1430]/60 bg-white ${esaurito ? "text-[#0A1430]/65" : "text-[#0A1430]"}`
      }`}
    >
      {valore}
      {scelto && <Check className="size-4" aria-hidden="true" />}
      {esaurito && (
        <span
          data-esaurito
          aria-hidden="true"
          className="absolute inset-0"
          style={diagonale(scelto ? "#FFFFFF" : NOTTE)}
        />
      )}
    </button>
  );
}

type PropsGruppo = {
  prodotto: ProdottoPubblico;
  opzione: Opzione;
  scelta: Scelta;
  mancante: Mancante | null;
  onScegli: (scelta: Scelta) => void;
};

function Gruppo({ prodotto, opzione, scelta, mancante, onScegli }: PropsGruppo) {
  const id = useId();
  const idEtichetta = `${id}-etichetta`;
  const idMessaggio = `${id}-messaggio`;
  const campioni = campioniColore([opzione]);
  const aCampioni = campioni.length > 0;
  const valori = opzione.valori.map((v) => v.valore);
  const scelto = valori.includes(scelta[opzione.nome]) ? scelta[opzione.nome] : null;
  const tappa = scelto ?? valori[0];
  // le scelte che il prodotto ha ancora: un valore sparito (o di un altro prodotto) non deve rendere «Esaurito» il resto
  const ancoraValide = Object.fromEntries(
    Object.entries(scelta).filter(([nome, valore]) =>
      prodotto.opzioni.some((o) => o.nome === nome && o.valori.some((v) => v.valore === valore)),
    ),
  );
  const messaggio = mancante?.opzione === opzione.nome ? testoScegli(mancante) : null;

  const scegli = (valore: string) => {
    if (valore === scelto) return;
    const nuova = { ...scelta, [opzione.nome]: valore };
    onScegli(nuova);
    // un conto per ogni variante intera scelta (solo lo SKU; resta anche con «Rifiuta»: non va a nessuna piattaforma)
    const conto = contaVariante(skuScelto(prodotto, nuova));
    if (conto) emettiSoloContatore(conto.contatore, conto.payload);
  };

  // frecce, Home, End: il fuoco e la scelta vanno insieme (come un gruppo di radio nativo)
  const alTasto = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const radii = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
    const qui = radii.indexOf(e.target as HTMLElement);
    const prossimo = qui < 0 ? null : passoDaTasto(e.key, qui, radii.length);
    if (prossimo === null) return;
    e.preventDefault();
    // un tasto che non sposta (bordo) non sceglie niente: con nulla scelto, ← sul primo valore non lo sceglie
    if (prossimo === qui) return;
    radii[prossimo]?.focus();
    scegli(valori[prossimo]);
  };

  return (
    <div className="space-y-2">
      <p id={idEtichetta} className="text-sm font-semibold text-[#0A1430]">
        {opzione.nome}
      </p>
      <div
        role="radiogroup"
        data-opzione={opzione.nome}
        aria-labelledby={idEtichetta}
        aria-describedby={messaggio ? idMessaggio : undefined}
        onKeyDown={alTasto}
        className="flex flex-wrap gap-2"
      >
        {aCampioni
          ? campioni.map((c) => (
              <Campione
                key={c.valore}
                c={c}
                scelto={c.valore === scelto}
                esaurito={valoreEsaurito(prodotto, opzione.nome, c.valore, ancoraValide)}
                tappa={c.valore === tappa}
                onScegli={() => scegli(c.valore)}
              />
            ))
          : valori.map((v) => (
              <Pillola
                key={v}
                valore={v}
                scelto={v === scelto}
                esaurito={valoreEsaurito(prodotto, opzione.nome, v, ancoraValide)}
                tappa={v === tappa}
                onScegli={() => scegli(v)}
              />
            ))}
      </div>
      {aCampioni && (
        <p data-scelto className="min-h-5 text-sm text-[#0A1430]/80">
          {scelto}
        </p>
      )}
      <div id={idMessaggio} aria-live="polite">
        {messaggio && (
          <p className="flex items-start gap-1.5 text-sm font-semibold text-[#0A1430]">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {messaggio}
          </p>
        )}
      </div>
    </div>
  );
}

export function SelettoreVariante({
  prodotto,
  scelta,
  onScegli,
  mancante = null,
  ref,
}: {
  prodotto: ProdottoPubblico;
  /** Le scelte fatte: nome dell'opzione → valore. */
  scelta: Scelta;
  /** La scelta nuova, intera (le altre scelte restano). */
  onScegli: (scelta: Scelta) => void;
  /** Il risultato di `messaggioMancante`: quale gruppo mostra «Scegli …». */
  mancante?: Mancante | null;
  /** Per `fuocoSullaScelta(ref.current, opzione)`. */
  ref?: Ref<HTMLDivElement>;
}) {
  const opzioni = Array.isArray(prodotto.opzioni)
    ? prodotto.opzioni.filter((o) => o.valori.length > 0)
    : [];
  if (opzioni.length === 0) return null;
  return (
    <div ref={ref} className="space-y-5">
      {opzioni.map((o) => (
        <Gruppo
          key={o.nome}
          prodotto={prodotto}
          opzione={o}
          scelta={scelta ?? {}}
          mancante={mancante}
          onScegli={onScegli}
        />
      ))}
    </div>
  );
}
