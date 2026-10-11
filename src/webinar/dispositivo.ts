/** ── SU CHE SCHERMO SI STA GUARDANDO ───────────────────────────────────────
 *
 *  Tre classi e basta: telefono, tablet, computer. Servono a una cosa sola —
 *  far arrivare a ciascuno quello che il relatore ha preparato PER LUI.
 *
 *  ── ⚠️ A COSA SERVONO, E A COSA NO ───────────────────────────────────────
 *  Servono a DISEGNARE le tre cornici della regia e a sapere quale si sta
 *  comandando. NON servono a spezzare lo stato della sala in tre: quella
 *  strada è stata provata e scartata — obbligava chi conduce a guidare tre
 *  cornici insieme, e chi non lo faceva lasciava fermi i telefoni, cioè quasi
 *  tutta la sala. Si sceglie una schermata su cui lavorare e quello che si fa
 *  lì arriva a tutti.
 */
export type Dispositivo = "desktop" | "tablet" | "mobile";

/** Il nome del telaio nella regia → la classe. */
export function dispositivoDi(nome: string): Dispositivo {
  const n = String(nome || "").toLowerCase();
  if (n.startsWith("tel")) return "mobile";
  if (n.startsWith("tab")) return "tablet";
  return "desktop";
}

/** ⚠️ Le soglie sono le stesse dell'impaginazione (`sm` e `lg` di Tailwind):
 *  se qui dicessi «tablet» a uno schermo che il foglio di stile impagina da
 *  telefono, la sala riceverebbe la versione sbagliata proprio per colpa di
 *  chi doveva sceglierla bene. */
export function dispositivoDelloSchermo(larghezza?: number): Dispositivo {
  const w = Number.isFinite(Number(larghezza))
    ? Number(larghezza)
    : (typeof window === "undefined" ? 1280 : window.innerWidth || 1280);
  if (w < 768) return "mobile";
  if (w < 1180) return "tablet";
  return "desktop";
}
