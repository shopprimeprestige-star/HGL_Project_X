/** ── LA TAVOLA DELLE TRE SOLUZIONI (landing v3, 4.2) ────────────────────────────────────────────────
 *  Una tavola sola, divisa da filetti, con gli angoli a mirino: tre celle numerate 01 · 02 · 03, stessa forma
 *  e stesso peso. Telefono: tre righe; da 1024: tre colonne dallo stesso markup.
 *  - Ogni riga ha UN solo elemento attivo (link esteso: il suo ::after copre la riga), mai bottoni dentro bottoni.
 *  - Le miniature sono «tutte o nessuna»: se ne manca una, tutte e tre diventano il numero grande in Anton.
 *  - La spiegazione (`children`) sta subito dopo la tavola, quindi dopo la cella 03 nell'ordine del Tab.
 *  - Spiegazione aperta su telefono: il bottone blu sotto la tavola non si disegna (un solo blu per schermata). */
import type { MouseEvent, ReactNode, Ref } from "react";
import { Plus } from "lucide-react";
import { vaiDopo } from "@/landing/sito/pezzi";
import { LINK_CATALOGO, TESTI_SOLUZIONI as T } from "@/landing/testi-sito";
import type { VistaSoluzioni } from "./ponte";
import { tracciaSoluzioni } from "./ponte";
import { BottoneContorno, Foto, LinkAzione } from "./ponte-ui";
import { BloccoConsulenza, type AlPrenotare } from "./Testata";
import { ANTON, CONTENITORE, ETICHETTA, INTER } from "./stile";

export const ID_CELLA = "invisible-derm";
export const ID_SPIEGAZIONE = "spiegazione-invisible-derm";

/** L'azione di una riga: il suo ::after copre la riga intera; il fuoco si vede su tutta la riga (sul <li>). */
const ESTESO = "after:absolute after:inset-0 focus-visible:outline-none";
const COME_LINK = `${INTER} text-base font-semibold underline decoration-2 underline-offset-4 decoration-[var(--hgl-titoli,#5CB6FF)]`;

interface Props {
  miniature: VistaSoluzioni["miniature"];
  aperta: boolean;
  /** Il bottone della cella 03: apre o chiude la spiegazione. */
  onAlterna: () => void;
  /** La cella 01 e il bottone blu aprono il foglio del modulo. */
  onPrenota: AlPrenotare;
  bottoneRef: Ref<HTMLElement>;
  cellaRef: Ref<HTMLLIElement>;
  /** La spiegazione: va subito dopo la tavola. */
  children?: ReactNode;
}

export function TavolaSoluzioni({ miniature, aperta, onAlterna, onPrenota, bottoneRef, cellaRef, children }: Props) {
  const [trapianto, patch, invisibile] = T.voci;
  const voci = [trapianto, patch, invisibile];
  const media = miniature ? [miniature.trapianto, miniature.patch, miniature.invisibile] : [null, null, null];

  //  Il clic su «Patch pronte in stock →» si conta e poi si va al catalogo (al massimo 300 ms di attesa, come nelle altre pagine).
  const versoIlCatalogo = (e: MouseEvent<HTMLElement>) =>
    vaiDopo(e as MouseEvent<HTMLAnchorElement>, LINK_CATALOGO, () => tracciaSoluzioni("card_patch_clic", { bottone: "patch", sezione: "tavola" }));

  const azioni = [
    <LinkAzione key="a" onClick={(e) => onPrenota("trapianto", e.currentTarget)} className={`${COME_LINK} ${ESTESO}`}>
      {trapianto.azione}
    </LinkAzione>,
    <LinkAzione key="b" href={LINK_CATALOGO} onClick={versoIlCatalogo} className={`${COME_LINK} ${ESTESO}`}>
      {patch.azione}
    </LinkAzione>,
    <BottoneContorno
      key="c"
      ref={bottoneRef}
      onClick={onAlterna}
      aria-expanded={aperta}
      aria-controls={ID_SPIEGAZIONE}
      className={`${ESTESO} inline-flex items-center gap-2`}
    >
      <Plus aria-hidden="true" className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${aperta ? "rotate-45" : ""}`} />
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
                className={`relative grid scroll-mt-4 grid-cols-[var(--m)_1fr] items-start gap-x-3 px-3 py-3 transition-colors duration-150 [--m:72px] hover:bg-white/[0.04] has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-[3px] has-[:focus-visible]:outline-white motion-reduce:transition-none [@media(max-height:640px)]:max-lg:[--m:64px] lg:block lg:scroll-mt-[60px] lg:p-6 ${
                  e03 && aperta ? "shadow-[inset_0_2px_0_0_var(--hgl-elettrico,#0F90FE)]" : ""
                }`}
              >
                <div className="lg:mb-5">
                  {solaScritta ? (
                    <span aria-hidden="true" className={`${ANTON} block text-[40px] leading-none text-[var(--hgl-titoli,#5CB6FF)]`}>
                      {voce.numero}
                    </span>
                  ) : (
                    <span className="block size-[var(--m)] overflow-hidden rounded-lg lg:aspect-[3/2] lg:size-auto lg:w-full">
                      <Foto slot={media[i]} formato="3:2" larghezza={373} altezza={249} className="size-full object-cover" />
                    </span>
                  )}
                </div>
                <div role={e03 ? "group" : undefined} aria-label={e03 ? invisibile.etichettaAccessibile : undefined}>
                  <p className={`${ETICHETTA} flex items-center gap-3`}>
                    {solaScritta ? null : (
                      <span aria-hidden="true" className="text-[var(--hgl-dettagli,#C9D6FF)]">
                        {voce.numero}
                      </span>
                    )}
                    {e03 ? (
                      <span className="flex items-center gap-1.5 text-[var(--hgl-titoli,#5CB6FF)]">
                        <span aria-hidden="true" className="size-1.5 bg-current" />
                        {invisibile.etichetta}
                      </span>
                    ) : null}
                  </p>
                  <h2 className={`${ANTON} mt-2 text-[22px] leading-none tracking-[0.005em] text-white lg:text-[32px]`}>{voce.nome}</h2>
                  <p className={`${INTER} mt-2 text-[15px] leading-[1.35] text-[var(--hgl-dettagli,#C9D6FF)] lg:text-[17px]`}>{voce.riga}</p>
                  <div className="mt-3 text-white">{azioni[i]}</div>
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
