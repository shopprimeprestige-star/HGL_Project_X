/** ── LA TAVOLA DELLE TRE SOLUZIONI (landing v3, 4.2) ────────────────────────────────────────────────
 *  Una tavola sola, divisa da filetti, con gli angoli a mirino: tre celle numerate 01 · 02 · 03, stessa forma
 *  e stesso peso. Telefono: tre righe; da 1024: tre colonne dallo stesso markup.
 *  - Ogni riga ha UN solo elemento attivo (link esteso: il suo ::after copre la riga, quindi l'area di tocco è tutta la riga
 *    e l'azione può essere bassa), mai bottoni dentro bottoni.
 *  - Le miniature sono «tutte o nessuna»: se ne manca una, tutte e tre diventano il numero grande in Anton.
 *  - La spiegazione (`children`) sta subito dopo la tavola, quindi dopo la cella 03 nell'ordine del Tab.
 *  - Spiegazione aperta su telefono: il bottone blu sotto la tavola non si disegna (un solo blu per schermata). */
import type { MouseEvent, ReactNode, Ref } from "react";
import { vaiDopo } from "@/landing/sito/pezzi";
import { traccia } from "@/landing/sito/traccia";
import { LINK_CATALOGO, TESTI_SOLUZIONI as T } from "@/landing/testi-sito";
import { BottoneContorno, LinkAzione } from "./Azioni";
import { Foto } from "./Foto";
import type { VistaSoluzioni } from "./regole";
import { CONTENITORE } from "./stile";
import { BloccoConsulenza, type AlPrenotare } from "./Testata";

export const ID_CELLA = "invisible-derm";
export const ID_SPIEGAZIONE = "spiegazione-invisible-derm";

/** L'azione di una riga: il suo ::after copre la riga intera; il fuoco si vede su tutta la riga (sul <li>).
 *  `min-h-0`: l'area di tocco di 44 px è già la riga, quindi il `min-height` del ruolo non serve e non gonfia la riga. */
const ESTESO = "min-h-0 after:absolute after:inset-0 focus-visible:outline-none";

interface Props {
  miniature: VistaSoluzioni["miniature"];
  aperta: boolean;
  /** Il bottone della cella 03: apre o chiude la spiegazione. */
  onAlterna: () => void;
  /** La cella 01 e il bottone blu aprono il foglio del modulo. */
  onPrenota: AlPrenotare;
  cellaRef: Ref<HTMLLIElement>;
  /** La spiegazione: va subito dopo la tavola. */
  children?: ReactNode;
}

export function TavolaSoluzioni({ miniature, aperta, onAlterna, onPrenota, cellaRef, children }: Props) {
  const [trapianto, patch, invisibile] = T.voci;
  const voci = [trapianto, patch, invisibile];
  const media = miniature ? [miniature.trapianto, miniature.patch, miniature.invisibile] : [null, null, null];

  //  Il clic su «Patch pronte in stock →» si conta e poi si va al catalogo (al massimo 300 ms di attesa, come nelle altre pagine).
  const versoIlCatalogo = (e: MouseEvent<HTMLAnchorElement>) =>
    vaiDopo(e, LINK_CATALOGO, () => traccia("card_patch_clic", { bottone: "patch", sezione: "tavola" }));

  const azioni = [
    <LinkAzione key="a" onClick={(e) => onPrenota("trapianto", e.currentTarget)} className={ESTESO}>
      {trapianto.azione}
    </LinkAzione>,
    <LinkAzione key="b" href={LINK_CATALOGO} onClick={versoIlCatalogo} className={ESTESO}>
      {patch.azione}
    </LinkAzione>,
    //  Il «+» che ruota in «×» lo disegna già `BottoneContorno` (da `aria-expanded`).
    <BottoneContorno key="c" onClick={onAlterna} aria-expanded={aperta} aria-controls={ID_SPIEGAZIONE} className={ESTESO}>
      {aperta ? invisibile.azioneAperta : invisibile.azione}
    </BottoneContorno>,
  ];

  return (
    <div className={`${CONTENITORE} mt-4 lg:mt-10`}>
      <div className="brackets border-y border-white/15">
        <span className="br-tr" aria-hidden="true" />
        <span className="br-bl" aria-hidden="true" />
        <ol className="grid list-none divide-y divide-white/15 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {voci.map((voce, i) => {
            const solaScritta = media[i] === null;
            const e03 = voce.id === ID_CELLA;
            return (
              <li
                key={voce.id}
                id={e03 ? ID_CELLA : undefined}
                ref={e03 ? cellaRef : undefined}
                className={`relative grid scroll-mt-4 grid-cols-[var(--m)_1fr] items-start gap-x-3 px-3 py-3 [@media(max-height:700px)]:max-lg:py-2 transition-colors duration-150 [--m:72px] hover:bg-white/[0.04] has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-[3px] has-[:focus-visible]:outline-white motion-reduce:transition-none [@media(max-height:700px)]:max-lg:[--m:64px] lg:block lg:scroll-mt-[60px] lg:p-6 ${
                  e03 && aperta ? "shadow-[inset_0_2px_0_0_var(--hgl-elettrico)]" : ""
                }`}
              >
                <div className="lg:mb-5">
                  {solaScritta ? (
                    <span aria-hidden="true" className="block font-[family-name:var(--hgl-font-titoli)] text-[40px] uppercase leading-none text-[var(--hgl-titoli)]">
                      {voce.numero}
                    </span>
                  ) : (
                    <span className="block size-[var(--m)] overflow-hidden rounded-lg lg:aspect-[3/2] lg:size-auto lg:w-full">
                      <Foto slot={media[i]} formato="3:2" larghezza={373} altezza={249} className="size-full object-cover" />
                    </span>
                  )}
                </div>
                <div role={e03 ? "group" : undefined} aria-label={e03 ? invisibile.etichettaAccessibile : undefined}>
                  {e03 ? (
                    <p className="sol-etichetta mb-1.5 flex items-center gap-1.5 text-[var(--hgl-titoli)]">
                      <span aria-hidden="true" className="size-1.5 bg-current" />
                      {invisibile.etichetta}
                    </p>
                  ) : null}
                  {/* Il numero e il nome stanno sulla stessa riga: tre righe intere nella prima schermata (4.2). */}
                  <div className="flex items-baseline gap-3">
                    {solaScritta ? null : (
                      <span aria-hidden="true" className="sol-etichetta text-[var(--hgl-dettagli)]">
                        {voce.numero}
                      </span>
                    )}
                    <h2 className="sol-h2-nome text-white">{voce.nome}</h2>
                  </div>
                  <p className="sol-riga mt-1.5 text-[var(--hgl-dettagli)]">{voce.riga}</p>
                  <div className="mt-2 text-white">{azioni[i]}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* La spiegazione di Invisible Derm: subito dopo la tavola, a tutta larghezza (fuori dai margini su telefono). */}
      {children}

      {/* L'unico bottone blu su telefono. A spiegazione aperta non si disegna: il suo gemello è nel passo in fondo al pannello. */}
      {aperta ? null : <BloccoConsulenza onPrenota={onPrenota} className="mt-5 lg:hidden" />}
    </div>
  );
}
