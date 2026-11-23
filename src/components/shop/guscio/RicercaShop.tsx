/** ── LA RICERCA DELL'HEADER (VETRINA V1 · T82b) ───────────────────────────────────────────────────────────────
 *  Documento del Design §4.5.1 («Ricerca») e PIANO-V1 D79, D90, D103. Si monta nel posto `ricerca` di `ShopHeader` (lo fa `GuscioShop`, T93).
 *  · Telefono: un tasto da 44 px con la lente; al tocco la riga dell'header diventa il campo (48 px, testo da 16 px: il telefono non
 *    ingrandisce) con il tasto per chiuderla. Computer: il campo c'è sempre, 260 px che diventano 380 da 1280.
 *  · L'elenco leggero (`elencoProdotti` → `soloLeggere`) si scarica SOLO al primo fuoco sul campo e resta in memoria. Se il server non
 *    risponde (o risponde vuoto) si riprova al fuoco dopo; intanto Invio porta comunque alla pagina dei risultati.
 *  · Tendina di 5 voci al massimo (`suggerimenti`), con miniatura (se la foto non c'è, solo testo), nome e prezzo (Invisible Derm: nessuna
 *    cifra). Il fuoco resta SEMPRE nel campo: la voce evidenziata la nomina `aria-activedescendant`. Frecce, Invio ed Esc sono di
 *    `voceEvidenziata` (T105): voce evidenziata → la sua scheda; nessuna voce → `/shop/cerca?q=` (sotto i 2 caratteri Invio non fa niente).
 *  · `Search` (D90): dopo 1 s di pausa o con Invio, una volta sola per testo (`creaEmettitoreRicerca`); il testo esce SOLO se è il nome di
 *    un prodotto o di una categoria (`eventoCerca` con il vocabolario del catalogo scaricato): un nome di persona, un indirizzo, una
 *    parola di salute partono senza testo. Il testo cercato non va mai in un indirizzo diverso da `/shop/cerca`.
 *  Cosa NON fa: la pagina `/shop/cerca` (T96), la griglia dei risultati, lo stato vuoto con i 4 prodotti. Il fuoco vero sul telefono, la
 *  tastiera a schermo e `aria-live` che annuncia si guardano nel browser (T103c, T106). Tutti i testi stanno in `testi-shop.ts`. */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { FotoShop } from "@/components/shop/FotoShop";
import { riempi, TESTI_PROVVISORI, TESTI_SHOP } from "@/landing/testi-shop";
import { emettiEvento } from "@/lib/tracciamento/api";
import { elencoProdotti } from "@/shop/cms/catalogo.functions";
import { creaEmettitoreRicerca } from "@/shop/cms/elenco";
import { soloLeggere, type CardLeggera } from "@/shop/cms/vetrina-card";
import { eventoCerca, vocabolarioRicerca } from "@/shop/cms/vetrina-eventi";
import {
  TENDINA_CHIUSA,
  tendinaDopoDigitazione,
  voceEvidenziata,
  type StatoTendina,
} from "@/shop/cms/vetrina-interazioni";
import { cercaNeiLeggeri, MIN_CARATTERI_RICERCA, suggerimenti } from "@/shop/cms/vetrina-ricerca";

const GUSCIO = TESTI_PROVVISORI.guscio;
const TESTI = TESTI_PROVVISORI.ricerca;

const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** Il prezzo della voce: niente se la card non ne ha (Invisible Derm, dato mancante); «Da …» se le varianti costano cifre diverse. */
function prezzoVoce(
  card: Pick<CardLeggera, "prezzoCent" | "prezziDiversi" | "senzaPrezzo">,
): string | null {
  if (card.senzaPrezzo || card.prezzoCent === null) return null;
  const prezzo = EURO.format(card.prezzoCent / 100);
  return card.prezziDiversi ? riempi(TESTI_PROVVISORI.card.da, { prezzo }) : prezzo;
}

/** Spazi ridotti a uno e nessuno ai bordi: il testo che si cerca e che va nell'indirizzo. */
const pulito = (t: string): string => t.replace(/\s+/g, " ").trim();
const abbastanza = (t: string): boolean => pulito(t).length >= MIN_CARATTERI_RICERCA;

/** Tasto da 44 × 44 senza fondo (come nell'header); l'anello di fuoco è quello bianco di D100. */
const TASTO =
  "shop-anello-scuro inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10";

/** Le voci della tendina. Solo disegno: non ha stato (la logica è tutta in `RicercaShop`). Ogni voce è UN SOLO elemento: il link alla scheda
 *  con il ruolo di opzione (nessun elemento interattivo dentro un'opzione), fuori dalla tabulazione: il punto di tabulazione è il campo, e
 *  il clic del mouse non gli toglie il fuoco (`onMouseDown`). La voce evidenziata ha un anello interno (non solo un colore). */
export function VociRicerca({
  id,
  voci,
  indice,
  aperta,
  onScegli,
}: {
  id: string;
  voci: readonly CardLeggera[];
  indice: number | null;
  aperta: boolean;
  onScegli: () => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={GUSCIO.cerca}
      hidden={!aperta}
      className="shop-dissolvi absolute inset-x-0 top-full z-40 mx-2 mt-1 max-h-[60dvh] overflow-y-auto rounded-lg bg-white py-1 text-ink shadow-galleggiante lg:mx-0 lg:mt-2"
    >
      {voci.map((v, i) => {
        const prezzo = prezzoVoce(v);
        const parametri = { slug: v.slug };
        return (
          <li key={v.slug} role="presentation">
            <Link
              to="/shop/prodotto/$slug"
              params={parametri}
              role="option"
              id={`${id}-${i}`}
              aria-selected={i === indice}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onScegli}
              className={`flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-[var(--brand-velo-10)] ${i === indice ? "bg-[var(--brand-velo-10)] ring-2 ring-inset ring-ink" : ""}`}
            >
              {/* `alt` vuoto: il nome è lì accanto. Senza foto FotoShop non disegna niente (mai un riquadro vuoto). */}
              <FotoShop
                foto={v.foto}
                alt=""
                uso="miniatura"
                className="h-12 w-12 shrink-0 rounded-md"
              />
              <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-medium leading-snug">
                {v.nome}
              </span>
              {prezzo && (
                <span className="shrink-0 text-sm font-semibold tabular-nums">{prezzo}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export interface RicercaShopProps {
  /** Le categorie del catalogo (le stesse dell'header): i loro nomi entrano nel vocabolario di `Search`. Mancanti = solo i prodotti. */
  categorie?: readonly { nome?: unknown }[] | null;
}

export function RicercaShop({ categorie }: RicercaShopProps) {
  const navigate = useNavigate();
  const idLista = useId();
  const [testo, setTesto] = useState("");
  const [tendina, setTendina] = useState<StatoTendina>(TENDINA_CHIUSA);
  /** L'elenco leggero: `null` finché non si è scaricato. */
  const [carte, setCarte] = useState<CardLeggera[] | null>(null);
  /** Solo telefono: la riga è diventata il campo. Sul computer il campo c'è sempre e questo non conta. */
  const [aperta, setAperta] = useState(false);
  const campo = useRef<HTMLInputElement | null>(null);
  const lente = useRef<HTMLButtonElement | null>(null);
  const inCorso = useRef(false);

  const risultati = useMemo(
    () => suggerimenti(cercaNeiLeggeri(carte ?? [], testo)),
    [carte, testo],
  );
  const visibile = tendina.aperta && risultati.length > 0;
  const evidenziata =
    visibile && tendina.indice !== null && tendina.indice < risultati.length
      ? tendina.indice
      : null;

  // ── l'evento Search: pausa o Invio, e il testo solo se è un nome del catalogo ──
  const nomi = useMemo(() => vocabolarioRicerca(carte, categorie), [carte, categorie]);
  const nomiAggiornati = useRef(nomi);
  useEffect(() => {
    nomiAggiornati.current = nomi;
  }, [nomi]);
  const ricerca = useMemo(
    () =>
      creaEmettitoreRicerca((t) => {
        const e = eventoCerca(t, nomiAggiornati.current);
        if (e) emettiEvento(e.nome, e.dati);
      }),
    [],
  );
  useEffect(() => ricerca.ferma, [ricerca]);

  // il telefono: aperto il campo, il fuoco ci va (e il fuoco fa scaricare l'elenco)
  useEffect(() => {
    if (aperta) campo.current?.focus();
  }, [aperta]);

  /** Il primo fuoco scarica l'elenco; con uno in corso o già arrivato non si ripete. Un errore, o un elenco vuoto, non chiude la porta: si riprova al fuoco dopo. */
  const scarica = () => {
    if (inCorso.current || (carte !== null && carte.length > 0)) return;
    inCorso.current = true;
    elencoProdotti({ data: {} })
      .then((prodotti) => {
        setCarte(soloLeggere(prodotti));
      })
      .catch(() => {
        // shortcut: nessun avviso a schermo se l'elenco non arriva; Invio porta alla pagina dei risultati, che dice la sua. Se serve un avviso, qui.
      })
      .finally(() => {
        inCorso.current = false;
      });
  };

  /** La tendina dopo una lettera. Con l'elenco ancora in arrivo resta «aperta» e si mostra da sola quando le voci ci sono. */
  const dopoDigitazione = (t: string): StatoTendina =>
    carte === null
      ? { aperta: abbastanza(t), indice: null }
      : tendinaDopoDigitazione(suggerimenti(cercaNeiLeggeri(carte, t)).length);

  const chiudiCampo = () => {
    setAperta(false);
    setTendina(TENDINA_CHIUSA);
    lente.current?.focus();
  };

  const alCambio = (valore: string) => {
    setTesto(valore);
    setTendina(dopoDigitazione(valore));
    ricerca.scrivi(valore);
  };

  const alTasto = (e: KeyboardEvent<HTMLInputElement>) => {
    // Invio mentre si compone (tastiere a caratteri) conferma la parola, non la ricerca
    if (e.nativeEvent.isComposing) return;
    const r = voceEvidenziata(tendina, e.key, risultati.length);
    if (!r.gestito) {
      if (e.key === "Escape" && aperta) {
        e.preventDefault();
        chiudiCampo();
      }
      return;
    }
    e.preventDefault();
    if (r.azione === "cerca" && !abbastanza(testo)) return;
    setTendina({ aperta: r.aperta, indice: r.indice });
    if (r.azione === "apri" && r.indice !== null && risultati[r.indice]) {
      ricerca.invio(testo);
      void navigate({ to: "/shop/prodotto/$slug", params: { slug: risultati[r.indice].slug } });
      chiudiCampo();
    } else if (r.azione === "cerca") {
      ricerca.invio(testo);
      // shortcut: indirizzo costruito a mano, perché `/shop/cerca` entra nell'albero delle rotte con T96; poi si possono usare `to` e `search` tipati.
      void navigate({ href: `/shop/cerca?${new URLSearchParams({ q: pulito(testo) })}` });
      chiudiCampo();
    }
  };

  return (
    <>
      <button
        ref={lente}
        type="button"
        aria-label={GUSCIO.cerca}
        aria-expanded={aperta}
        onClick={() => setAperta(true)}
        className={`${TASTO} lg:hidden`}
      >
        <Search className="h-6 w-6" aria-hidden="true" />
      </button>
      <div
        role="search"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTendina(TENDINA_CHIUSA);
        }}
        className={
          aperta
            ? "fixed inset-x-0 top-0 z-10 flex h-14 items-center gap-2 bg-[#081634] px-4 lg:relative lg:block lg:h-auto lg:w-64 lg:bg-transparent lg:px-0 xl:w-[380px]"
            : "relative hidden lg:block lg:w-64 xl:w-[380px]"
        }
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/70"
            aria-hidden="true"
          />
          <input
            ref={campo}
            type="search"
            role="combobox"
            aria-expanded={visibile}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={evidenziata === null ? undefined : `${idLista}-${evidenziata}`}
            aria-label={GUSCIO.cerca}
            placeholder={TESTI_SHOP.header.ricerca}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            value={testo}
            onChange={(e) => alCambio(e.target.value)}
            onFocus={() => {
              scarica();
              if (abbastanza(testo)) setTendina(dopoDigitazione(testo));
            }}
            onKeyDown={alTasto}
            className="shop-anello-scuro h-12 w-full appearance-none truncate rounded-md border border-white/40 bg-white/10 pl-10 pr-3 text-base text-white placeholder:text-white/70 focus:bg-white/15 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        <button
          type="button"
          aria-label={TESTI.chiudi}
          onClick={chiudiCampo}
          className={`${TASTO} lg:hidden`}
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
        <VociRicerca
          id={idLista}
          voci={risultati}
          indice={evidenziata}
          aperta={visibile}
          onScegli={chiudiCampo}
        />
        {/* La riga che dice a voce quante voci ci sono: c'è sempre (anche vuota), così il cambio si sente. */}
        <span role="status" aria-live="polite" className="sr-only">
          {visibile
            ? risultati.length === 1
              ? TESTI.unRisultato
              : riempi(TESTI.risultati, { n: risultati.length })
            : ""}
        </span>
      </div>
    </>
  );
}

export default RicercaShop;
