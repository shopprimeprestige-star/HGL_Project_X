/** ── LA CHAT WHATSAPP · RICONOSCERE MEDIA E SEGNAPOSTO ─────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM). Funzioni PURE: niente React,
 *  niente Supabase, niente `@/integrations` (così `prove/prove.mjs` le
 *  impacchetta con la voce `chatwa/media`). Prove in `prove/manychat/chat-media.mjs`.
 *
 *  ⚠️ SCHELETRO DEL COMPITO 0: le firme sono quelle concordate nel PIANO, i corpi
 *   no. Il compito T2 li riempie (D8, D10, D14) senza cambiare le firme.
 *  ⚠️ Il testo lo scrive il cliente su una rotta pubblica: nessuna regex con un
 *   quantificatore dentro un quantificatore (ReDoS, R1). T2 lo dichiara qui.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Host da cui si accettano i media di ManyChat (lista chiusa, D14). */
export const HOST_MEDIA_AMMESSI: readonly string[] = [
  "manybot-files.s3.eu-central-1.amazonaws.com",
  "manybot-files.s3.amazonaws.com",
];

export type TipoTesto = "testo" | "audio" | "immagine" | "video" | "documento" | "allegato" | "illeggibile";

export interface TestoClassificato {
  tipo: TipoTesto;
  /** `url.href` normalizzato: solo per i media riconosciuti. */
  url?: string;
  /** Cosa si scrive nella bolla/anteprima («🎤 Vocale», «Messaggio non leggibile»…). */
  etichetta: string;
}

/** Che cos'è un testo arrivato dal cliente: parole, un media o un messaggio illeggibile. */
export function classificaTesto(testo: string): TestoClassificato {
  // shortcut: scheletro T0, tutto «testo» finché T2 non scrive D14, torna al T2.
  return { tipo: "testo", etichetta: typeof testo === "string" ? testo : "" };
}

/** Il testo è fatto SOLO di segnaposto non risolti (`{{x}}`)? Vuoto = no. */
export function eSoloSegnaposto(testo: string): boolean {
  // shortcut: scheletro T0, mai segnaposto finché T2 non scrive D8, torna al T2.
  void testo;
  return false;
}

/** L'anteprima di un messaggio in entrata, per l'elenco (≤ 100 caratteri, D10). */
export function anteprimaIn(testo: string): string {
  // shortcut: scheletro T0, nessun troncamento né media finché T2 non scrive D10, torna al T2.
  return typeof testo === "string" ? testo : "";
}
