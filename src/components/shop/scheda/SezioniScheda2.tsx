/** ── SezioniScheda2 · VETRINA V1 · T88b ───────────────────────────────────────
 *  Le sezioni in fondo alla scheda: domande frequenti, box «Non è il prodotto giusto per te?», «Ti serve anche».
 *  Cosa disegnare e in che ordine lo decide `bloccheScheda` (T78): qui si riceve l'elenco dei blocchi e si disegnano SOLO i propri
 *  (`faq`, `box`, `tiServeAnche`); galleria, acquisto, colore, «Nella confezione», come si usa,
 *  scheda tecnica e avvertenze sono di altri componenti e qui si saltano. Un elenco assente o sbagliato non disegna niente, senza lanciare.
 *  · FAQ: `FaqAccordion` con `voci` (righe da 56 px). Una domanda senza testo, o non ancora pronta (segnaposto, testo provvisorio del CRM), non si mostra; se non ne
 *    resta nessuna non c'è nemmeno il titolo.
 *  · Box: quello della landing con `variante="chiara"` (card chiara, bottone di contorno); il blocco `box` c'è solo su una patch in vendita.
 *  · «Ti serve anche»: `TiServeAnche` (T85), che da `correlato` (SKU e «si compra con un clic», T88b, `pubblico.ts`) fa da sé la card.
 *    L'evento di aggiunta e il carrello sono della card: qui non si emette né si tocca niente.
 *  · «Cosa contiene» del kit (blocco `confezione`) è di `SezioniScheda1` (T88a): qui il blocco `confezione` non produce niente.
 *  · Sotto la piega (FAQ, box, «Ti serve anche»): `content-visibility:auto`, così il browser non disegna ciò che non si vede ancora.
 *  Nessuna sezione recensioni (non esistono in questa commessa). Le parole stanno in `testi-shop.ts`. */
import { useId } from "react";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { BoxProdottoGiusto } from "@/components/landing/consulenza/BoxProdottoGiusto";
import { TiServeAnche } from "@/components/shop/TiServeAnche";
import { TESTI_SHOP } from "@/landing/testi-shop";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { eInvisibleDerm } from "@/shop/cms/pubblico";
import type { Blocco } from "@/shop/cms/vetrina-scheda";

/** Un testo con un segnaposto o ancora in attesa del titolare non è pronto per il pubblico (stessa regola delle righe della scheda tecnica). */
const NON_PRONTO = /da\s+confermare|\{\{/i;
const testoVero = (t: unknown): t is string =>
  typeof t === "string" && t.trim() !== "" && !NON_PRONTO.test(t);

/** Sotto la piega: il browser salta il disegno finché la sezione è lontana; 480 px è la misura di riserva (nessun salto allo scorrere).
 *  `content-visibility:auto` ritaglia ciò che esce dal contenitore: i 4 px di spazio (`p-1`, compensati da `-m-1`) lasciano vedere l'anello del fuoco. */
const SOTTO_LA_PIEGA = "-m-1 p-1 [content-visibility:auto] [contain-intrinsic-size:auto_480px]";
const CLASSI_TITOLO = "text-lg font-bold text-[#0A1430]";

function Faq({ faq }: { faq: ProdottoPubblico["faq"] }) {
  const id = useId();
  const voci = (Array.isArray(faq) ? faq : [])
    .filter((f) => testoVero(f?.d) && testoVero(f?.r))
    .map((f) => ({ q: f.d, a: f.r }));
  if (voci.length === 0) return null;
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3 ${SOTTO_LA_PIEGA}`}>
      <h2 id={id} className={CLASSI_TITOLO}>
        {TESTI_SHOP.scheda.faq}
      </h2>
      {/* `FaqAccordion` si centra da solo (`mx-auto`): qui sta sotto il titolo, a sinistra. Su fondo chiaro il blu del marchio scende di un gradino
          (come in `.bg-light-panel`), così il numero resta leggibile; l'anello del fuoco è quello dello shop (2 px, scarto 2, azzurro) senza toccare `FaqAccordion`. */}
      <div className="[--brand:var(--brand-su-chiaro)] [&>div]:mx-0 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[#006CC4]">
        <FaqAccordion voci={voci} />
      </div>
    </section>
  );
}

export function SezioniScheda2({
  prodotto,
  blocchi,
}: {
  prodotto: ProdottoPubblico;
  blocchi: readonly Blocco[] | null | undefined;
}) {
  const elenco = Array.isArray(blocchi) ? blocchi : [];
  const sezioni = elenco.flatMap((b, i) => {
    switch (b?.id) {
      case "faq":
        return [<Faq key={i} faq={prodotto.faq} />];
      case "box":
        return [
          <div key={i} className={SOTTO_LA_PIEGA}>
            <BoxProdottoGiusto prodotto={prodotto.nome} variante="chiara" />
          </div>,
        ];
      case "tiServeAnche": {
        // secondo cancello (il primo è di `bloccheScheda`): senza prezzo e per Invisible Derm la card non c'è, e nemmeno il suo contenitore
        const c = b.correlato;
        if (!c || c.prezzoDaCent === null || eInvisibleDerm(c.nome, c.slug)) return [];
        return [
          <div key={i} className={SOTTO_LA_PIEGA}>
            <TiServeAnche correlato={c} />
          </div>,
        ];
      }
      default:
        return [];
    }
  });
  if (sezioni.length === 0) return null;
  return <div className="flex flex-col gap-8 sm:gap-10">{sezioni}</div>;
}

export default SezioniScheda2;
