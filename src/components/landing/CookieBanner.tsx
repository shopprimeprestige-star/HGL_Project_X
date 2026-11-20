/*  ── IL VECCHIO BANNER DELLE LANDING NON DISEGNA PIÙ NIENTE ──────────────────────────
    Shop R1 · T27 · PIANO D15. Il banner dei cookie è uno solo per tutto il sito: lo monta la radice
    (`components/tracciamento/ProviderTracciamento`). Le tre landing (`index`, `invisible-derm`, `invisible-derm-v1`)
    importano ancora questo nome e non si toccano: da qui in poi disegna niente, e la scelta (v1 compresa) la legge
    `lib/consenso`. Un secondo banner scriverebbe una scelta vecchia sopra quella nuova. */
export function CookieBanner() {
  return null;
}
