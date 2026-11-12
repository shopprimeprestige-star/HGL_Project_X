/** ── IL DISEGNO DEL BORDO, SEMPRE VISIBILE ─────────────────────────────────
 *  Sezione dalla pelle alla superficie, patch standard a sinistra e Invisible Derm a destra: il bordo
 *  spesso e visibile contro la membrana sottile che si confonde con la pelle. Niente foto finte, niente
 *  numeri. Etichette identiche (testo vero, non pixel); colori del brand; `role="img"` con descrizione.
 *  Resta anche quando ci sono le foto del confronto: le spiega. */
import { CONFRONTO } from "@/landing/testi-invisible-derm";

const PELLE = "#c99f86";
const MEMBRANA = "#dbe6f7";

/** `spessore` in unità del disegno (viewBox 400×200); la pelle sta sotto y=130. */
function Sezione({ spessore, bordo }: { spessore: number; bordo: boolean }) {
  const y = 130 - spessore;
  return (
    <svg viewBox="0 0 400 200" aria-hidden="true" focusable="false" className="block w-full">
      <rect x="0" y="130" width="400" height="70" fill={PELLE} />
      {/* i capelli sopra la membrana */}
      {[90, 130, 170, 210, 250, 290, 320].map((x, i) => (
        <path key={x} d={`M${x} ${y} q${i % 2 ? 8 : -8} -38 ${i % 2 ? 4 : -4} -78`} stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ))}
      {/* la membrana: spessa con il bordo che si stacca, oppure sottile e affusolata verso il bordo */}
      {bordo ? (
        <>
          <rect x="60" y={y} width="280" height={spessore} rx="3" fill={MEMBRANA} />
          <path d={`M60 ${y} h-0 v${spessore}`} stroke="#ffffff" strokeWidth="3" />
          <path d={`M340 ${y + 2} v${spessore - 2}`} stroke="#0a1a3a" strokeOpacity="0.45" strokeWidth="3" />
        </>
      ) : (
        <path d={`M60 130 L66 ${y} H334 L340 130 Z`} fill={PELLE} stroke={MEMBRANA} strokeOpacity="0.8" strokeWidth="1.5" />
      )}
    </svg>
  );
}

export function DisegnoConfronto() {
  const d = CONFRONTO.disegno;
  const etichetta = "bg-[#081634]/90 px-3 py-2 text-center text-etichetta font-semibold uppercase tracking-[0.18em] text-white";
  return (
    <figure role="img" aria-label={d.alt} className="mx-auto max-w-3xl">
      <h3 aria-hidden="true" className="mb-4 text-center text-xl font-bold text-white md:text-2xl">{d.titolo}</h3>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 md:gap-5">
        {([["patch", 26, true], ["derm", 7, false]] as const).map(([k, spessore, bordo]) => (
          <div key={k} className="overflow-hidden rounded-md border border-white/15 bg-blueprint-fine">
            <p className={etichetta}>{CONFRONTO.etichette[k]}</p>
            <Sezione spessore={spessore} bordo={bordo} />
          </div>
        ))}
      </div>
      <figcaption aria-hidden="true" className="mt-3 text-center text-sm text-white/75">{d.didascalia}</figcaption>
    </figure>
  );
}
