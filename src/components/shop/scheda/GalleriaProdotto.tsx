/** ── GalleriaProdotto · VETRINA V1 · T86 ──────────────────────────────────────────────────────────────────────
 *  La galleria della scheda (SPEC §4.5.4 n. 1, V1-S2). Scorrimento NATIVO (`scroll-snap`, nessuna libreria: D82): la foto principale, la foto
 *  di scala sempre seconda, le foto 2-5 e il video come diapositiva con la sua copertina (l'ordine lo dà `ordinaGalleria` di T78: qui si
 *  disegna ciò che arriva). Tocco o clic su una foto = lightbox; il video parte solo al tocco (nessun avvio da solo, nessun scaricamento prima).
 *  · «Una foto = nessun controllo» ha UNA fonte, `controlliGalleria` (T105): con una foto sola niente frecce, contatore e miniature.
 *  · Contatore «1/6» sempre; frecce da 44 px solo da 768 px; miniature verticali solo dal computer (1024 px).
 *  · Tastiera: frecce, Inizio e Fine passano di foto (`comandoDaTasto` + `stepGalleria`: ai bordi si ferma, non gira). Una sola diapositiva ha
 *    il fuoco con Tab (le altre `tabIndex={-1}`): le frecce spostano il fuoco con la foto, così Invio ingrandisce sempre quella che si vede.
 *  · La lightbox è Radix Dialog e si scarica al primo tocco (`lazy`: non pesa sulla prima pagina). Lo stato è il riduttore `lightbox`: ricorda
 *    DA QUALE diapositiva si è aperta e, chiusa, il fuoco torna alla diapositiva della foto che si stava guardando (la stessa, se non ci si è mossi).
 *  · Il video che suona si ferma (torna la copertina) quando si passa a un'altra foto.
 *  · Nessun timer e nessun effetto: ogni stato cambia da un gesto (tasto, dito, tocco), e la prova lo fa girare davvero.
 *  La prima foto è `eager` (`prima`): chi monta la galleria passa `prima` a nessun'altra foto della pagina. */
import { lazy, Suspense, useRef, useState, type KeyboardEvent, type UIEvent } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { TESTI_PROVVISORI, riempi } from "@/landing/testi-shop";
import { etichettaDiapositiva, type Diapositiva } from "@/shop/cms/vetrina-galleria";
import {
  comandoDaTasto,
  controlliGalleria,
  LIGHTBOX_CHIUSA,
  lightbox,
  stepGalleria,
  type ComandoGalleria,
  type StatoLightbox,
} from "@/shop/cms/vetrina-interazioni";

/** Radix Dialog sta tutto qui dentro: si scarica al primo tocco su una foto. */
const Lightbox = lazy(() => import("./Lightbox"));

const G = TESTI_PROVVISORI.galleria;
/** Chi apre la lightbox: il riduttore `foglio` lo ricorda e, alla chiusura, dice a chi restituire il fuoco. */
const DIAPOSITIVA = "diapositiva-";

/** Bottone tondo da 44 px sulla foto (bordo sottile, nessuna ombra); `aria-disabled` e non `disabled`: al bordo il fuoco non si perde. */
const CLASSI_FRECCIA =
  "shop-anello h-11 w-11 items-center justify-center rounded-full border border-ink/15 bg-white text-[#0A1430] transition-colors hover:bg-ink/5 aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-white";

/** Il bottone della copertina sparisce quando il video parte: il fuoco passa al video (una funzione sola, così gira al montaggio e non a ogni disegno). */
const fuocoAlVideo = (el: HTMLVideoElement | null) => el?.focus();

export interface GalleriaProdottoProps {
  /** Le diapositive già in ordine (`ordinaGalleria(scheda.media)`). Nessuna = la galleria non disegna niente. */
  diapositive: readonly Diapositiva[] | null | undefined;
}

export function GalleriaProdotto({ diapositive }: GalleriaProdottoProps) {
  const [indice, setIndice] = useState(0);
  const [lb, setLb] = useState<StatoLightbox>(LIGHTBOX_CHIUSA);
  const [videoAvviato, setVideoAvviato] = useState(false);
  const scorritore = useRef<HTMLDivElement | null>(null);
  const bottoni = useRef<(HTMLButtonElement | null)[]>([]);
  /** A chi restituire il fuoco appena la lightbox si è chiusa (lo dice il riduttore); `null` = a nessuno. Si legge una volta sola. */
  const fuocoA = useRef<string | null>(null);

  const lista = Array.isArray(diapositive) ? (diapositive as readonly Diapositiva[]) : [];
  const n = lista.length;
  if (n === 0) return null;
  const attiva = stepGalleria({ indice, totale: n }, { vai: indice }).indice;
  const { mostra, haPrecedente, haSuccessivo } = controlliGalleria({ indice: attiva, totale: n });

  /** La foto mostrata cambia. Il video che sta suonando si ferma (torna la copertina) se ci si allontana: non deve suonare fuori vista. */
  const mostraFoto = (i: number) => {
    setIndice(i);
    if (lista[i]?.tipo !== "video") setVideoAvviato(false);
  };
  /** Porta la galleria alla foto `i` (il browser rispetta il movimento ridotto: `scroll-behavior` in `styles.css`). */
  const scorriA = (i: number) => scorritore.current?.scrollTo({ left: i * scorritore.current.clientWidth });
  const vai = (comando: ComandoGalleria, conFuoco = false) => {
    const i = stepGalleria({ indice: attiva, totale: n }, comando).indice;
    mostraFoto(i);
    scorriA(i);
    if (conFuoco) bottoni.current[i]?.focus({ preventScroll: true });
  };
  /** Il dito (o la rotella) ha spostato lo scorrimento: l'indice è la foto più vicina. */
  const alloScorrimento = (e: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = e.currentTarget;
    // larghezza zero (galleria nascosta): il rapporto non è un numero e `stepGalleria` lascia l'indice dov'è
    mostraFoto(stepGalleria({ indice: attiva, totale: n }, { vai: Math.round(scrollLeft / clientWidth) }).indice);
  };
  const allaTastiera = (e: KeyboardEvent<HTMLDivElement>) => {
    // sul video che parte i tasti sono del lettore (cercare, volume): la galleria non li prende
    if (!mostra || (e.target as HTMLElement).tagName === "VIDEO") return;
    const comando = comandoDaTasto(e.key);
    if (!comando) return;
    e.preventDefault();
    vai(comando, true);
  };

  // ── la lightbox: solo le foto (il video ha il suo bottone), e il video è sempre l'ultima diapositiva ──
  const foto = lista.filter((d): d is Extract<Diapositiva, { tipo: "foto" }> => d.tipo === "foto");
  const apri = (i: number) => {
    const posto = foto.findIndex((f) => f.id === lista[i].id);
    if (posto < 0) return;
    setLb((s) => lightbox(s, { tipo: "apri", da: `${DIAPOSITIVA}${i}`, indice: posto, totale: foto.length }));
  };
  /** Chiusura (X, Esc, tocco fuori): Radix ci avvisa; si chiude solo, mai si apre da qui. */
  const chiudi = (aperto: boolean) => {
    if (aperto) return;
    const dopo = lightbox(lb, { tipo: "chiudi" });
    fuocoA.current = dopo.fuocoA;
    setLb(dopo);
  };
  /** Chiusa la lightbox: la galleria va alla foto che si stava guardando e il fuoco torna alla sua diapositiva (non resta nel vuoto). */
  const rendiFuoco = () => {
    const partito = fuocoA.current;
    fuocoA.current = null;
    if (partito === null) return;
    const i = lista.findIndex((d) => d.id === foto[lb.indice]?.id);
    if (i < 0) return;
    mostraFoto(i);
    scorriA(i);
    bottoni.current[i]?.focus({ preventScroll: true });
  };

  const corrente = lista[attiva];
  return (
    <section aria-roledescription={mostra ? G.carosello : undefined} aria-label={G.etichetta} className="flex flex-col gap-3 lg:flex-row lg:gap-4">
      {mostra && (
        <ul className="hidden shrink-0 flex-col gap-2 p-1 lg:flex lg:max-h-[640px] lg:overflow-y-auto">
          {lista.map((d, i) => (
            <li key={d.id}>
              <button
                type="button"
                data-miniatura={i}
                aria-label={etichettaDiapositiva(i, n, d.tipo)}
                aria-current={i === attiva ? "true" : undefined}
                onClick={() => vai({ vai: i })}
                className={`shop-anello block h-24 w-24 overflow-hidden rounded-md border-2 ${i === attiva ? "border-[#0A1430]" : "border-transparent hover:border-ink/25"}`}
              >
                {d.tipo === "foto" ? <FotoShop foto={d.src} alt="" uso="miniatura" /> : <FotoShop src={d.copertina} alt="" uso="miniatura" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative min-w-0 flex-1">
        <div
          ref={scorritore}
          data-scorritore=""
          onScroll={alloScorrimento}
          onKeyDown={allaTastiera}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth rounded-[14px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {lista.map((d, i) => (
            <div
              key={d.id}
              role={mostra ? "group" : undefined}
              aria-roledescription={mostra ? G.diapositiva : undefined}
              aria-label={mostra ? etichettaDiapositiva(i, n, d.tipo) : undefined}
              className="w-full shrink-0 snap-center"
            >
              {d.tipo === "foto" ? (
                <button
                  type="button"
                  ref={(el) => {
                    bottoni.current[i] = el;
                  }}
                  data-diapositiva={i}
                  tabIndex={i === attiva ? 0 : -1}
                  aria-haspopup="dialog"
                  onClick={() => apri(i)}
                  className="shop-anello block w-full cursor-zoom-in focus-visible:-outline-offset-4!"
                >
                  <FotoShop foto={d.src} alt={d.alt} uso="galleria" prima={i === 0} />
                  <span className="sr-only">{G.ingrandisci}</span>
                </button>
              ) : videoAvviato ? (
                <video
                  src={d.video}
                  poster={d.copertina}
                  controls
                  autoPlay
                  playsInline
                  muted={d.muto}
                  aria-label={d.alt}
                  data-video=""
                  ref={fuocoAlVideo}
                  className="aspect-square w-full bg-[#081634] object-contain"
                />
              ) : (
                <div className="relative">
                  <FotoShop src={d.copertina} alt={d.alt} uso="galleria" prima={i === 0} />
                  <button
                    type="button"
                    ref={(el) => {
                      bottoni.current[i] = el;
                    }}
                    data-diapositiva={i}
                    tabIndex={i === attiva ? 0 : -1}
                    onClick={() => setVideoAvviato(true)}
                    className="shop-anello absolute inset-0 flex items-center justify-center focus-visible:-outline-offset-4!"
                  >
                    <span aria-hidden="true" className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#081634]/85 text-white">
                      <Play className="h-7 w-7" fill="currentColor" />
                    </span>
                    <span className="sr-only">{G.guardaVideo}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {mostra && (
          <>
            <button type="button" aria-label={G.precedente} aria-disabled={!haPrecedente} onClick={() => vai("indietro")} className={`${CLASSI_FRECCIA} absolute left-3 top-1/2 hidden -translate-y-1/2 md:inline-flex`}>
              <ChevronLeft aria-hidden="true" className="h-6 w-6" />
            </button>
            <button type="button" aria-label={G.successiva} aria-disabled={!haSuccessivo} onClick={() => vai("avanti")} className={`${CLASSI_FRECCIA} absolute right-3 top-1/2 hidden -translate-y-1/2 md:inline-flex`}>
              <ChevronRight aria-hidden="true" className="h-6 w-6" />
            </button>
            {/* La regione c'è sempre (una regione nuova non verrebbe letta): annuncia la foto che cambia. */}
            <p role="status" className="absolute bottom-3 right-3 rounded-md bg-[#081634]/85 px-2.5 py-1 text-sm font-medium tabular-nums text-white">
              <span className="sr-only">{riempi(G.numero, { n: attiva + 1, m: n })}</span>
              <span aria-hidden="true">{riempi(G.contatore, { n: attiva + 1, m: n })}</span>
            </p>
          </>
        )}

        {corrente.tipo === "video" && corrente.testoParlato && (
          <details className="mt-3 text-sm text-[#0A1430]">
            <summary className="shop-anello flex min-h-11 cursor-pointer items-center">{TESTI_PROVVISORI.scheda.trascrizione}</summary>
            <p className="whitespace-pre-line pb-2 text-ink-muted">{corrente.testoParlato}</p>
          </details>
        )}
      </div>

      {lb.totale > 0 && (
        <Suspense fallback={null}>
          <Lightbox aperto={lb.aperto} onApertoChange={chiudi} foto={foto} indice={lb.indice} onVai={(comando) => setLb((s) => lightbox(s, { tipo: "vai", comando }))} onRendiFuoco={rendiFuoco} />
        </Suspense>
      )}
    </section>
  );
}
