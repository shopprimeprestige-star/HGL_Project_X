/** ── «NON È IL PRODOTTO GIUSTO PER TE?» ────────────────────────────────────
 *  Il box nella scheda di una protesi, sotto «Acquista ora». Non toglie e non
 *  copre il bottone d'acquisto. Le 7 voci sono tasti compatti: il tocco segna
 *  la voce, il bottone apre il foglio (dritto sul modulo se la voce c'è già,
 *  sull'elenco completo, con «Altro», se non c'è).
 *  Evento `stock_box_visto` quando il box entra nello schermo (una volta).
 *  `variante="chiara"` (V1, scheda dello shop, D85): card chiara, voci compatte scure su chiaro, bottone di contorno e i testi del
 *  documento dello shop; di base «scura», come oggi. Gli stessi sette tasti, lo stesso foglio, gli stessi eventi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { traccia } from "@/landing/consulenza/eventi";
import { PROBLEMI, TESTI_CONSULENZA, type IdProblema } from "@/landing/testi-sito";
import { TESTI_SHOP } from "@/landing/testi-shop";
import { VociProblema } from "./VociProblema";

const PannelloProblemi = lazy(() => import("./PannelloProblemi"));

/** Nel box le 7 voci; «Altro» si sceglie nel foglio. */
const VOCI_BOX = PROBLEMI.filter((p) => p.id !== "altro");

export function BoxProdottoGiusto({
  prodotto,
  variante = "scura",
}: {
  prodotto: string;
  variante?: "scura" | "chiara";
}) {
  const chiara = variante === "chiara";
  const s = TESTI_SHOP.scheda;
  const t = chiara
    ? { titolo: s.boxTitolo, testo: s.boxTesto, bottone: s.boxBottone }
    : TESTI_CONSULENZA.box;
  const radice = useRef<HTMLElement | null>(null);
  const [scelta, setScelta] = useState<IdProblema | null>(null);
  const [montato, setMontato] = useState(false);
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    const el = radice.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(
      (voci) => {
        if (!voci.some((v) => v.isIntersecting)) return;
        traccia("stock_box_visto", {}, { dedupKey: "box" });
        o.disconnect();
      },
      { threshold: 0.5 },
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);

  return (
    <section
      ref={radice}
      aria-labelledby="box-giusto-titolo"
      className={
        chiara
          ? "rounded-xl border border-[#0A1430]/15 bg-white p-4"
          : "rounded-xl border border-white/15 bg-white/[0.04] p-4"
      }
    >
      <h2
        id="box-giusto-titolo"
        className={
          chiara
            ? "text-lg font-bold leading-tight tracking-tight text-[#0A1430]"
            : "text-lg font-bold leading-tight tracking-tight text-white"
        }
      >
        {t.titolo}
      </h2>
      <p
        className={
          chiara
            ? "mt-2 max-w-prose text-sm leading-relaxed text-ink-muted"
            : "mt-2 max-w-prose text-sm leading-relaxed text-white/75"
        }
      >
        {t.testo}
      </p>
      <div className="mt-3">
        <VociProblema
          compatta
          voci={VOCI_BOX}
          scelta={scelta}
          onScegli={setScelta}
          variante={variante}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setMontato(true);
          setAperto(true);
        }}
        className={
          chiara
            ? "mt-3 h-12 w-full rounded-lg border-2 border-[#0A1430] bg-transparent px-4 text-[15px] font-semibold text-[#0A1430] transition-colors hover:bg-[#0A1430]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006CC4] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            : "mt-3 h-12 w-full rounded-lg bg-brand-scuro px-4 text-[15px] font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1a3a]"
        }
      >
        {t.bottone}
      </button>
      {montato && (
        <Suspense fallback={null}>
          <PannelloProblemi
            aperto={aperto}
            onApertoChange={setAperto}
            provenienza="stock"
            punto="box"
            prodotto={prodotto}
            problemaIniziale={scelta}
          />
        </Suspense>
      )}
    </section>
  );
}

export default BoxProdottoGiusto;
