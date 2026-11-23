/** ── RIQUADRO DELL'ANTEPRIMA (VETRINA V1 · T97a · D94) ─────────────────────────────────────────────────────────
 *  La scheda vista con la chiave d'anteprima (D31) è una bozza: si vede com'è, ma non si vende (lo dice la striscia di `BloccoAcquisto`).
 *  Questo riquadro ambra, sopra la pagina, elenca ciò che i clienti NON vedrebbero adesso (`anteprima.nascosti`: un motivo per blocco).
 *  È un `<details>`: chiuso di partenza, con il titolo come bottone («Mostra cosa è nascosto»); funziona senza JavaScript e il fuoco è del browser.
 *  Senza motivi non si disegna: un riquadro vuoto non dice niente. Mai il nome interno del blocco: solo la frase del server.
 *  Testo: solo `testi-shop.ts`. Larghezza e margini come `PaginaScheda`, così il riquadro sta sulla sua colonna. */
import { TESTI_PROVVISORI } from "@/landing/testi-shop";

export interface PropsRiquadroAnteprima {
  nascosti?: readonly { blocco: string; motivo: string }[] | null;
}

export function RiquadroAnteprima({ nascosti }: PropsRiquadroAnteprima) {
  const motivi = (Array.isArray(nascosti) ? nascosti : []).filter((n) => typeof n?.motivo === "string" && n.motivo.trim() !== "");
  if (motivi.length === 0) return null;
  return (
    <div data-riquadro-anteprima className="mx-auto w-full max-w-6xl px-4 pt-4 min-[360px]:px-6">
      <details className="rounded-md border border-amber-300 bg-amber-50 text-amber-950">
        <summary className="shop-anello min-h-11 cursor-pointer rounded-md px-4 py-3 text-sm font-semibold">{TESTI_PROVVISORI.scheda.anteprimaRiquadro}</summary>
        <ul className="list-disc space-y-1 px-4 pb-4 pl-9 pr-4 text-sm">
          {motivi.map((n, i) => (
            //  l'indice rende unica la chiave: due blocchi con lo stesso motivo (o lo stesso blocco due volte) sono righe diverse
            <li key={`${i}-${n.blocco}`}>{n.motivo}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
