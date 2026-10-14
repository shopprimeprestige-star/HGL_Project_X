/** ── REGOLE DELLE PAGINE NUOVE (senza schermo) ─────────────────────────────
 *  Cosa si mostra e cosa no, in funzioni pure: stanno qui perché le prove le
 *  possano chiamare senza aprire una pagina (`prove/sito/pagine.mjs`).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Le foto con consenso si vedono solo con l'interruttore acceso E almeno una foto vera. */
export function fotoDaMostrare<T>(acceso: boolean, elenco: readonly T[]): readonly T[] {
  return acceso ? elenco : [];
}

/** La riga della durata c'è solo se Operativo ha dato il dato: niente numeri inventati. */
export function rigaDurata(durata: string | null): string | null {
  const d = durata?.trim();
  return d ? `Durata: ${d}.` : null;
}

/** Il link allo shop di prova sta sul catalogo provvisorio solo se il titolare lo accende. */
export function mostraLinkShop(acceso: boolean): boolean {
  return acceso === true;
}

/** Il testo del bottone della consulenza: A di base, B solo a test acceso. */
export function testoBottoneConsulenza(variante: "A" | "B", testoA: string, testoB: string): string {
  return variante === "B" ? testoB : testoA;
}
