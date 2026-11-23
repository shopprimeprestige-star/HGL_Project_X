/** ── Lightbox · VETRINA V1 · T86 ─────────────────────────────────────────────────────────────────────────
 *  La foto a tutto schermo (SPEC §4.5.4 n. 1): fondo notte, foto grande, contatore, frecce, X da 44 px. Radix Dialog (D82): il fuoco resta
 *  dentro, Esc chiude, i lettori di schermo la annunciano come finestra. Il file si scarica solo al primo tocco su una foto (`lazy` in
 *  `GalleriaProdotto`), così Radix non pesa sulla prima pagina; per questo l'esportazione di default.
 *  · Senza stato proprio: l'indice e la chiusura sono della galleria (riduttore `lightbox` di T105); qui frecce, Inizio e Fine passano di foto
 *    con `comandoDaTasto` e si fermano ai bordi. Una foto sola = solo la X (`controlliGalleria`).
 *  · Lo zoom con le dita è del browser: `touch-action: pinch-zoom` e nessun codice (D82). Perciò il passaggio fra le foto sul telefono sta nelle frecce.
 *  · Alla chiusura Radix NON sposta il fuoco: si chiama `onRendiFuoco` e la galleria lo rimette sulla diapositiva giusta. */
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { TESTI_PROVVISORI, riempi } from "@/landing/testi-shop";
import type { Diapositiva } from "@/shop/cms/vetrina-galleria";
import { comandoDaTasto, controlliGalleria, stepGalleria, type ComandoGalleria } from "@/shop/cms/vetrina-interazioni";

const G = TESTI_PROVVISORI.galleria;

/** Tondo da 44 px su fondo notte: bordo e velo bianchi, nessuna ombra. `aria-disabled` e non `disabled`: al bordo il fuoco non si perde. */
const CLASSI_BOTTONE =
  "shop-anello-scuro inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-white/10";

export interface LightboxProps {
  aperto: boolean;
  /** Radix chiede di cambiare lo stato (X, Esc). */
  onApertoChange: (aperto: boolean) => void;
  /** Le sole foto (il video ha il suo bottone nella galleria). */
  foto: readonly Extract<Diapositiva, { tipo: "foto" }>[] | null | undefined;
  /** La foto mostrata; fuori campo si porta dentro. */
  indice: number;
  onVai: (comando: ComandoGalleria) => void;
  /** La finestra si è chiusa: la galleria rimette il fuoco sulla diapositiva giusta. */
  onRendiFuoco: () => void;
}

export function Lightbox({ aperto, onApertoChange, foto, indice, onVai, onRendiFuoco }: LightboxProps) {
  const lista = Array.isArray(foto) ? foto : [];
  if (lista.length === 0) return null;
  const attiva = stepGalleria({ indice, totale: lista.length }, { vai: indice }).indice;
  const { mostra, haPrecedente, haSuccessivo } = controlliGalleria({ indice: attiva, totale: lista.length });
  const questa = lista[attiva];

  return (
    <Dialog.Root open={aperto} onOpenChange={onApertoChange}>
      <Dialog.Portal>
        <Dialog.Content
          // niente descrizione: il titolo basta (e Radix non protesta)
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onRendiFuoco();
          }}
          onKeyDown={(e) => {
            const comando = mostra ? comandoDaTasto(e.key) : null;
            if (!comando) return;
            e.preventDefault();
            onVai(comando);
          }}
          className="shop-dissolvi fixed inset-0 z-[55] flex flex-col bg-[#081634] text-white focus:outline-none"
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-4 min-[360px]:px-6">
            <Dialog.Title className="sr-only">{G.titoloLightbox}</Dialog.Title>
            {mostra ? (
              <p role="status" className="text-sm font-medium tabular-nums">
                {riempi(G.contatore, { n: attiva + 1, m: lista.length })}
              </p>
            ) : (
              <span />
            )}
            <Dialog.Close aria-label={G.chiudi} className={CLASSI_BOTTONE}>
              <X aria-hidden="true" className="h-6 w-6" />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4 [touch-action:pinch-zoom] min-[360px]:px-6">
            <FotoShop foto={questa.src} alt={questa.alt} uso="galleria" sizes="100vw" prima className="w-[min(100%,calc(100dvh-10rem))]" />
          </div>

          {mostra && (
            <div className="flex shrink-0 items-center justify-center gap-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
              <button type="button" aria-label={G.precedente} aria-disabled={!haPrecedente} onClick={() => onVai("indietro")} className={CLASSI_BOTTONE}>
                <ChevronLeft aria-hidden="true" className="h-6 w-6" />
              </button>
              <button type="button" aria-label={G.successiva} aria-disabled={!haSuccessivo} onClick={() => onVai("avanti")} className={CLASSI_BOTTONE}>
                <ChevronRight aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Lightbox;
