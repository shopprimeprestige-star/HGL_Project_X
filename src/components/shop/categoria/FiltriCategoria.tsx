/** ── I FILTRI DELLA CATEGORIA (VETRINA V1 · T90) ──────────────────────────────────────────────────────────
 *  Documento del Design §4.5.3 e PIANO-V1 D80/D82. Telefono: barra «Filtra (n)» attaccata sotto l'header e foglio dal basso (`FoglioFiltri`,
 *  Radix, si scarica al primo tocco) con «Mostra {n} prodotti» e «Azzera filtri». Computer: colonna a sinistra, conteggio e chip rimovibili.
 *  La logica non è qui: i gruppi, la lettura e la scrittura dell'indirizzo, il filtro per variante e i chip sono di `vetrina-filtri` (T77), il
 *  fuoco che torna al bottone è `foglio` di `vetrina-interazioni` (T105), lo stato vuoto e gli scheletri sono di T83. Qui si collegano.
 *  ⚠️ Lo stato sta SOLO nell'indirizzo: ogni scelta naviga (`replace`, senza saltare in alto) e il componente rilegge `search`; ricaricare dà la
 *   stessa pagina. shortcut: nessuna copia locale ottimistica: se il router tarda, la spunta si muove con lui; si cambia se T103c lo trova lento.
 *  ⚠️ Al cambio si tengono le card vecchie (`aria-busy`) finché il router carica; gli scheletri li mette `Scheletro` solo dopo 300 ms.
 *  Non scrive nessuna parola (da `testi-shop`) e non disegna le card: le dà la pagina con `children(visibili)` (di norma `GrigliaCard`).
 *  Senza filtri veri (nessuna opzione, tutto disponibile) non c'è né barra né colonna. Lo monta `PaginaCategoria` (T95), non una route. */
import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { Scheletro } from "@/components/shop/Scheletro";
import { StatoVuoto } from "@/components/shop/StatoVuoto";
import { riempi, TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import {
  FILTRI_VUOTI,
  applicaFiltri,
  chipAttivi,
  filtriAttivi,
  gruppiDaProdotti,
  leggiFiltri,
  scriviFiltri,
  togliFiltro,
  type Filtrabile,
  type GruppoFiltro,
  type StatoFiltri,
  type ValoreFiltro,
} from "@/shop/cms/vetrina-filtri";
import { FOGLIO_CHIUSO, foglio, type StatoFoglio } from "@/shop/cms/vetrina-interazioni";

const FoglioFiltri = lazy(() => import("./FoglioFiltri"));

/** Chi apre il foglio: il riduttore `foglio` lo ricorda e alla chiusura dice a chi restituire il fuoco. */
const ID_TASTO = "filtri-tasto";
const FILTRI = TESTI_SHOP.categoria.filtri;
const TESTI = TESTI_PROVVISORI.filtri;
const numero = (n: number): string => (n === 1 ? TESTI.unProdotto : riempi(TESTI.numero, { n }));
/** Gli scheletri hanno la griglia della categoria (3 colonne, 4 da 1536 px), al massimo 6 carte. */
const GRIGLIA_SCHELETRI = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-4";
const SCHELETRI_MIN = 2;
const SCHELETRI_MAX = 6;

/** I valori scelti di un gruppo: solo se lo stato li ha davvero (un gruppo chiamato «constructor» non pesca nulla dall'oggetto). */
const sceltiDi = (stato: StatoFiltri, chiave: string): string[] =>
  Object.hasOwn(stato.valori, chiave) ? stato.valori[chiave] : [];

/** Il campione del colore: foto vera, o la prima lettera su fondo notte (mai una tinta inventata). L'anello lo tiene visibile anche sul pieno. */
function Campione({ v, premuto }: { v: ValoreFiltro; premuto: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-campione
      className={`flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0A1430] text-xs font-semibold text-white ring-1 ${premuto ? "ring-white/70" : "ring-ink/20"}`}
    >
      {v.campione ? (
        <FotoShop foto={v.campione} alt="" uso="miniatura" className="size-full" />
      ) : (
        v.valore.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** Un valore: pillola da 44 px; scelto = fondo notte + spunta (non solo il colore). */
function Valore({
  gruppo,
  v,
  premuto,
  onClick,
}: {
  gruppo: GruppoFiltro;
  v: ValoreFiltro;
  premuto: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={premuto}
      data-filtro={`${gruppo.chiave}:${v.chiave}`}
      onClick={onClick}
      className={`shop-anello inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
        premuto
          ? "border-[#0A1430] bg-[#0A1430] text-white"
          : "border-[#7C8695] bg-white text-ink hover:border-[#0A1430]"
      }`}
    >
      {gruppo.tipo === "campioni" && <Campione v={v} premuto={premuto} />}
      {v.valore}
      {premuto && <Check className="size-4" aria-hidden="true" />}
    </button>
  );
}

/** «Disponibile»: un interruttore (`role=switch`), riga da 44 px. */
function Interruttore({
  nome,
  acceso,
  onClick,
}: {
  nome: string;
  acceso: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acceso}
      data-filtro="disp"
      onClick={onClick}
      className="shop-anello flex min-h-11 w-full items-center justify-between gap-4 text-sm font-semibold text-ink"
    >
      {nome}
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-[#0A1430] transition-colors ${acceso ? "bg-[#0A1430]" : "bg-white"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full transition-all ${acceso ? "left-[22px] bg-white" : "left-0.5 bg-[#0A1430]"}`}
        />
      </span>
    </button>
  );
}

export interface FiltriCategoriaProps<P extends Filtrabile> {
  /** I prodotti PUBBLICATI della categoria (basta `varianti` e `opzioni`; il resto passa intatto a `children`). */
  prodotti: readonly P[];
  /** La ricerca dell'indirizzo come la dà il router (`useSearch`): qualunque cosa, i valori che non conosciamo si ignorano. */
  search: unknown;
  /** Disegna i prodotti che passano i filtri (di norma `GrigliaCard`). Si chiama solo con almeno un prodotto visibile, salvo quando la
   *  categoria non ha filtri veri: allora si chiama sempre, anche con `[]` (la pagina decide cosa fare senza prodotti). Con filtri e nessun risultato si vede lo stato vuoto. */
  children: (visibili: P[]) => ReactNode;
}

export function FiltriCategoria<P extends Filtrabile>({
  prodotti,
  search,
  children,
}: FiltriCategoriaProps<P>) {
  const gruppi = useMemo(() => gruppiDaProdotti(prodotti), [prodotti]);
  const stato = useMemo(() => leggiFiltri(search, gruppi), [search, gruppi]);
  const visibili = useMemo(() => applicaFiltri(prodotti, stato), [prodotti, stato]);
  const chip = chipAttivi(gruppi, stato);
  const attivi = filtriAttivi(stato);

  const navigate = useNavigate();
  /** Il router sta caricando (dopo una scelta): le card restano, e `Scheletro` conta i 300 ms. Solo se la rotta è la stessa (cambiano i filtri):
   *  verso un'altra rotta (la scheda di una card) `location` è già quella nuova e la griglia resta com'è. */
  const inAttesa = useRouterState({
    select: (s) => s.isLoading && s.location.pathname === s.resolvedLocation?.pathname,
  });

  // ── l'indirizzo: ogni scelta lo riscrive, gli altri parametri restano ──
  /** `cambia` riceve lo stato letto dall'indirizzo CORRENTE (`prima`), non quello già disegnato: due tocchi veloci non si sovrascrivono. */
  const vai = (cambia: (corrente: StatoFiltri) => StatoFiltri) => {
    const miei = new Set(gruppi.map((g) => g.chiave));
    void navigate({
      search: (prima: Record<string, unknown>) => ({
        ...Object.fromEntries(Object.entries(prima).filter(([k]) => !miei.has(k))),
        ...Object.fromEntries(
          new URLSearchParams(scriviFiltri(cambia(leggiFiltri(prima, gruppi)))),
        ),
      }),
      replace: true,
      resetScroll: false,
    } as Parameters<typeof navigate>[0]);
  };
  const alterna = (g: GruppoFiltro, valore: string) =>
    vai((s) => {
      if (g.tipo === "interruttore") return { ...s, disponibile: !s.disponibile };
      const gia = sceltiDi(s, g.chiave);
      return {
        ...s,
        valori: {
          ...s.valori,
          [g.chiave]: gia.includes(valore) ? gia.filter((k) => k !== valore) : [...gia, valore],
        },
      };
    });
  const azzera = () => vai(() => FILTRI_VUOTI);

  // ── il foglio del telefono: in ritardo, fuoco restituito al bottone ──
  const [montato, setMontato] = useState(false);
  const [statoFoglio, setStatoFoglio] = useState<StatoFoglio>(FOGLIO_CHIUSO);
  const tasto = useRef<HTMLButtonElement | null>(null);
  /** A chi restituire il fuoco appena il foglio si è chiuso (lo dice il riduttore); `null` = a nessuno. Si legge una volta sola, dal gestore. */
  const fuocoA = useRef<string | null>(null);
  const apri = () => {
    setMontato(true);
    setStatoFoglio((s) => foglio(s, { tipo: "apri", da: ID_TASTO }));
  };
  /** Chiusura con la X, Esc, tocco fuori o «Mostra»: il fuoco torna al bottone. */
  const chiudi = (aperto: boolean) => {
    if (aperto) return;
    const dopo = foglio(statoFoglio, { tipo: "chiudi" });
    fuocoA.current = dopo.fuocoA;
    setStatoFoglio(dopo);
  };
  const rendiFuoco = () => {
    if (fuocoA.current === ID_TASTO) tasto.current?.focus();
    fuocoA.current = null;
  };

  if (gruppi.length === 0) return <>{children(visibili)}</>;

  /** I gruppi: lo stesso disegno in colonna (computer) e nel foglio (telefono). */
  const corpo = gruppi.map((g) =>
    g.tipo === "interruttore" ? (
      <Interruttore
        key={g.chiave}
        nome={g.nome}
        acceso={stato.disponibile}
        onClick={() => alterna(g, "")}
      />
    ) : (
      <fieldset key={g.chiave} className="min-w-0">
        <legend className="text-sm font-semibold tracking-tight text-ink">{g.nome}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {g.valori.map((v) => (
            <Valore
              key={v.chiave}
              gruppo={g}
              v={v}
              premuto={sceltiDi(stato, g.chiave).includes(v.chiave)}
              onClick={() => alterna(g, v.chiave)}
            />
          ))}
        </div>
      </fieldset>
    ),
  );

  return (
    <div>
      {/* telefono: la barra sta sotto l'header (56 px) e occupa tutta la larghezza */}
      <div className="sticky top-14 z-20 -mx-4 flex items-center gap-3 border-b border-ink/10 bg-white px-4 py-2 min-[360px]:-mx-6 min-[360px]:px-6 lg:hidden">
        <button
          ref={tasto}
          type="button"
          data-fuoco={ID_TASTO}
          aria-haspopup="dialog"
          aria-expanded={statoFoglio.aperto}
          onClick={apri}
          className="shop-anello inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-[#7C8695] bg-white px-4 text-sm font-semibold text-[#0A1430] hover:border-[#0A1430]"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {riempi(FILTRI.filtra, { n: attivi })}
        </button>
        {/* il numero a vista sul telefono (la regione `status` sotto lo dice già a chi usa lo schermo parlato) */}
        <p aria-hidden="true" className="shrink-0 text-sm tabular-nums text-ink-muted">
          {numero(visibili.length)}
        </p>
      </div>

      <div className="mt-4 lg:mt-0 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10 xl:grid-cols-[16rem_minmax(0,1fr)]">
        {/* computer: la colonna a sinistra */}
        <aside
          aria-label={TESTI.titolo}
          className="-m-1 hidden p-1 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem-var(--barra-h,0px))] lg:overflow-y-auto"
        >
          <h2 className="text-lg font-semibold tracking-tight text-ink">{TESTI.titolo}</h2>
          <div className="mt-5 space-y-6">{corpo}</div>
          {attivi > 0 && (
            <button
              type="button"
              onClick={azzera}
              className="shop-anello mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand-scuro underline underline-offset-4 hover:text-ink"
            >
              {FILTRI.azzera}
            </button>
          )}
        </aside>

        <div className="min-w-0">
          {/* il numero lo dice la regione `status` (sempre presente, così il cambio viene letto); a vista solo sul computer, con i chip */}
          <p role="status" className="sr-only">
            {numero(visibili.length)}
          </p>
          <div className="hidden min-h-11 flex-wrap items-center gap-x-4 gap-y-2 pb-4 lg:flex">
            <p aria-hidden="true" className="text-sm text-ink-muted">
              {numero(visibili.length)}
            </p>
            {chip.length > 0 && (
              <ul aria-label={TESTI.attivi} className="flex flex-wrap gap-2">
                {chip.map((c) => (
                  <li key={`${c.gruppo}:${c.valore ?? ""}`}>
                    <button
                      type="button"
                      data-chip
                      aria-label={riempi(TESTI.togli, { nome: c.etichetta })}
                      onClick={() => vai((s) => togliFiltro(s, c))}
                      className="shop-anello inline-flex min-h-11 items-center gap-2 rounded-full bg-ink/10 pl-4 pr-3 text-sm font-medium text-ink hover:bg-ink/15"
                    >
                      {c.etichetta}
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div data-griglia aria-busy={inAttesa}>
            <Scheletro
              inAttesa={inAttesa}
              quanti={Math.min(Math.max(visibili.length, SCHELETRI_MIN), SCHELETRI_MAX)}
              className={GRIGLIA_SCHELETRI}
            >
              {visibili.length > 0 ? (
                children(visibili)
              ) : (
                <StatoVuoto
                  icona={SlidersHorizontal}
                  titolo={TESTI_SHOP.categoria.vuoto}
                  azioni={
                    attivi > 0 ? [{ testo: FILTRI.azzera, aspetto: "pieno", onClick: azzera }] : []
                  }
                />
              )}
            </Scheletro>
          </div>
        </div>
      </div>

      {montato && (
        <Suspense fallback={null}>
          <FoglioFiltri
            aperto={statoFoglio.aperto}
            onApertoChange={chiudi}
            titolo={TESTI.titolo}
            chiudi={TESTI.chiudi}
            mostra={
              visibili.length === 1 ? TESTI.mostraUno : riempi(TESTI.mostra, { n: visibili.length })
            }
            annuncio={numero(visibili.length)}
            azzera={attivi > 0 ? { testo: FILTRI.azzera, onClick: azzera } : undefined}
            onRendiFuoco={rendiFuoco}
          >
            {corpo}
          </FoglioFiltri>
        </Suspense>
      )}
    </div>
  );
}

export default FiltriCategoria;
