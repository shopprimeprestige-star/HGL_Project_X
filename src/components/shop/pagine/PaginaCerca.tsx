/** ── PaginaCerca · VETRINA V1 · T96 ───────────────────────────────────────────
 *  I risultati di `/shop/cerca?q=`: il campo, poi la griglia delle card (T85) che hanno il testo nel nome o in uno SKU (T77, da 2 caratteri).
 *  Senza risultati: `StatoVuoto` («Non troviamo “{testo}”…») PIÙ 4 patch della vetrina: la pagina non finisce mai nel vuoto. Sotto i 2 caratteri
 *  non c'è stata nessuna ricerca: solo il campo e le stesse 4 patch.
 *  ⚠️ Privacy (D90): la ricerca si fa QUI, sull'elenco che arriva dal caricamento (senza `q`): il testo non va al server. Questa pagina non emette
 *  nessun evento: `Search` lo emette solo l'header (`RicercaShop`), prima di navigare. Il testo cercato resta testo (React lo esce con le entità).
 *  Non monta il guscio (header, piè, barre: `GuscioShop`, T93). Le parole stanno in `testi-shop.ts`. */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { GrigliaCard } from "@/components/shop/GrigliaCard";
import { StatoErrore } from "@/components/shop/StatoErrore";
import { StatoVuoto } from "@/components/shop/StatoVuoto";
import { TESTI_PROVVISORI, TESTI_SHOP, riempi } from "@/landing/testi-shop";
import type { ProdottoPubblico } from "@/shop/cms/modello";
import { soloLeggere } from "@/shop/cms/vetrina-card";
import {
  MIN_CARATTERI_RICERCA,
  cercaNeiLeggeri,
  quattroDallaVetrina,
} from "@/shop/cms/vetrina-ricerca";

/** Quanto è lungo, al massimo, il testo che si cerca (lo taglia `validateSearch`). */
export const MAX_CARATTERI_Q = 80;

/** Il testo dell'indirizzo, come lo vuole la pagina. Il router converte i valori che sembrano numeri, booleani, liste (`?q=2024` → 2024,
 *  `true`, `1e3` → 1000): cercare uno SKU di sole cifre darebbe «nessun risultato». Numeri e booleani tornano testo; liste e oggetti, niente. */
export function testoDaIndirizzo(q: unknown): string {
  const testo =
    typeof q === "string" ? q : typeof q === "number" || typeof q === "boolean" ? String(q) : "";
  return testo.slice(0, MAX_CARATTERI_Q);
}

/** Spazi ridotti a uno e nessuno ai bordi. */
const compatta = (t: string) => t.replace(/\s+/g, " ").trim();

export interface PaginaCercaProps {
  /** L'elenco intero dei prodotti pubblicati, come lo dà il caricamento (senza il testo cercato). */
  prodotti: readonly ProdottoPubblico[];
  q: string;
  /** Il server non ha risposto: un problema nostro, non «nessun risultato». */
  guasto?: boolean;
  riprova?: () => void;
}

export function PaginaCerca({ prodotti, q, guasto = false, riprova }: PaginaCercaProps) {
  const naviga = useNavigate();
  const campo = useRef<HTMLInputElement>(null);
  const cercato = compatta(q);
  const ricercaFatta = cercato.length >= MIN_CARATTERI_RICERCA;
  const carte = useMemo(() => soloLeggere(prodotti), [prodotti]);
  const trovati = useMemo(() => cercaNeiLeggeri(carte, cercato), [carte, cercato]);
  const suggeriti = useMemo(() => soloLeggere(quattroDallaVetrina(prodotti)), [prodotti]);

  // Se l'indirizzo cambia da fuori (la ricerca dell'header mentre si è già qui) il campo lo segue; scrivendo qui non succede niente.
  useEffect(() => {
    if (campo.current && compatta(campo.current.value) !== cercato) campo.current.value = q;
  }, [q, cercato]);

  const invia = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nuovo = compatta(
      (e.currentTarget.elements.namedItem("q") as HTMLInputElement | null)?.value ?? "",
    );
    if (nuovo.length < MIN_CARATTERI_RICERCA) return;
    // Il router codifica il testo (`&`, `#`, `%`, accenti): mai un indirizzo scritto a mano.
    void naviga({ to: "/shop/cerca", search: { q: nuovo } });
  };

  const risultati = ricercaFatta && !guasto && trovati.length > 0;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 min-[360px]:px-6 sm:py-12">
      <h1 className="text-balance break-words text-3xl font-bold tracking-tight text-[#0A1430] sm:text-4xl">
        {ricercaFatta
          ? riempi(TESTI_PROVVISORI.cerca.titolo, { testo: cercato })
          : TESTI_PROVVISORI.guscio.cerca}
      </h1>

      <form
        role="search"
        action="/shop/cerca"
        method="get"
        onSubmit={invia}
        className="mt-5 flex max-w-xl gap-2"
      >
        <input
          ref={campo}
          type="search"
          name="q"
          defaultValue={q}
          aria-label={TESTI_PROVVISORI.guscio.cerca}
          placeholder={TESTI_SHOP.header.ricerca}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          className="shop-anello h-12 min-w-0 flex-1 appearance-none truncate rounded-md border border-ink/40 bg-white px-3 text-base text-ink placeholder:text-ink-muted"
        />
        <button
          type="submit"
          className="shop-anello inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-[#0A1430] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1B2A4E]"
        >
          {TESTI_PROVVISORI.guscio.cerca}
        </button>
      </form>

      {/* La regione c'è sempre (anche vuota): una regione nuova non verrebbe letta. */}
      <p role="status" className="mt-6 text-sm text-ink-muted empty:mt-0">
        {risultati
          ? trovati.length === 1
            ? TESTI_PROVVISORI.filtri.unProdotto
            : riempi(TESTI_PROVVISORI.filtri.numero, { n: trovati.length })
          : ""}
      </p>

      {guasto ? (
        <div className="mt-8">
          <StatoErrore
            titolo={TESTI_SHOP.err500.titolo}
            testo={TESTI_SHOP.err500.testo}
            riprova={riprova}
          />
        </div>
      ) : risultati ? (
        <div className="mt-3">
          <GrigliaCard card={trovati} livello="h2" prima />
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {ricercaFatta && (
            <StatoVuoto titolo={riempi(TESTI_SHOP.microtesti.ricercaVuota, { testo: cercato })} />
          )}
          {suggeriti.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-bold text-[#0A1430]">{TESTI_SHOP.header.patch}</h2>
              <GrigliaCard card={suggeriti} colonne={4} livello="h3" />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
