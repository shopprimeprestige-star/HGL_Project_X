/** ── IL VIDEO CHE L'OSPITE DEVE VEDERE, ANCHE SE IL TELEFONO NON LO LASCIA PARTIRE
 *
 *  Segnalazione del titolare (17/11/2026): «quando condivido il contenuto in
 *  videochiamata alcune persone non riescono a vedere i video, altre sì».
 *  Le foto si vedevano per tutti: cambiava solo ciò che il telefono permette.
 *
 *  ── LA CAUSA ──────────────────────────────────────────────────────────────
 *  Il lettore dell'ospite (`/presenta`, lato cliente) dava per scontato che
 *  almeno la partenza IN MUTO fosse sempre concessa. Non lo è: iPhone con
 *  «Risparmio energetico», browser dentro WhatsApp/Instagram, Android con
 *  «Risparmio dati» rifiutano ANCHE quella. Allora:
 *   · il video restava fermo, e su iPhone — senza primo fotogramma — vuoto;
 *   · il pulsante nativo «play» di iOS non c'è, perché `styles.css` lo nasconde
 *     su ogni <video> senza comandi (serve per le camere della chiamata);
 *   · l'unico aiuto era «Attiva l'audio», che parla di audio e non dice che il
 *     video è fermo: nessuno lo toccava, perché il suono non era il problema.
 *  Chi aveva un telefono permissivo vedeva partire il video; gli altri no.
 *
 *  ── COSA FA QUESTO FILE ───────────────────────────────────────────────────
 *  Tre cose, tutte senza toccare il browser (si provano con un elemento finto):
 *   1. `avviaVideoOspite`: prova con audio, poi in muto, e dice COME è andata —
 *      `bloccato` è l'unico esito in cui la pagina deve chiedere un tocco;
 *   2. le frasi per il diario degli errori, senza nomi né indirizzi;
 *   3. `segnalaVideoOspite`: scrive quella frase nel diario (una volta per
 *      motivo), così la prossima volta si sa PERCHÉ un telefono non l'ha vista.
 *  ───────────────────────────────────────────────────────────────────────── */
import { riduciUserAgent } from "./scatola-nera";

/** Quanto si aspetta che il video abbia almeno un fotogramma prima di dire «stallo». */
export const STALLO_DOPO_MS = 6000;

/** `partito`: com'era stato chiesto · `muto`: voleva l'audio, il telefono no, ma
 *  il video gira · `bloccato`: non parte nemmeno muto, serve un tocco ·
 *  `interrotto`: un altro video ha preso il posto, non è un rifiuto. */
export type EsitoAvvio = "partito" | "muto" | "bloccato" | "interrotto";

/** Il minimo che serve di un <video>: così si prova senza browser. */
export type LettoreVideo = { muted: boolean; play: () => Promise<void> | undefined };

const nomeErrore = (e: unknown): string => {
  const n = (e as { name?: unknown } | null)?.name;
  return typeof n === "string" && n ? n.slice(0, 40) : "errore";
};

/** Fa partire il video e dice com'è andata. Non lancia mai. */
export async function avviaVideoOspite(
  v: LettoreVideo,
  conAudio: boolean,
): Promise<{ esito: EsitoAvvio; motivo: string }> {
  v.muted = !conAudio;
  try {
    await v.play();
    return { esito: "partito", motivo: "" };
  } catch (e) {
    const motivo = nomeErrore(e);
    //  ⚠️ AbortError = «un'altra richiesta ha preso il posto» (si è cambiato
    //   video mentre partiva questo). Non è un rifiuto del telefono: trattarlo
    //   come tale toglieva l'audio al video successivo, senza che nessuno
    //   l'avesse chiesto.
    if (motivo === "AbortError") return { esito: "interrotto", motivo };
    if (!conAudio) return { esito: "bloccato", motivo };
    v.muted = true; // ripiego: senza audio quasi nessun browser rifiuta
    try {
      await v.play();
      return { esito: "muto", motivo };
    } catch (e2) {
      const m2 = nomeErrore(e2);
      return { esito: m2 === "AbortError" ? "interrotto" : "bloccato", motivo: m2 };
    }
  }
}

/* ── LE FRASI DEL DIARIO ───────────────────────────────────────────────────
 *  Solo numeri e nomi di errore del browser: niente indirizzo del file, niente
 *  nome di chi guarda. */
export const motivoBloccato = (nomeErr: string) => `Video ospite bloccato: ${String(nomeErr || "errore").slice(0, 40)}`;
export const motivoErroreMedia = (codice: number | null | undefined) =>
  `Video ospite non riproducibile: errore del media codice ${Number.isFinite(codice) ? Number(codice) : 0}`;
export const motivoStallo = (readyState: number, networkState: number) =>
  `Video ospite in stallo: nessun fotogramma dopo ${STALLO_DOPO_MS / 1000} s (stato ${readyState | 0}, rete ${networkState | 0})`;

const giaDette = new Set<string>();

/** Scrive nel diario errori del cliente (`/api/presenter/errors`, scrittura
 *  aperta) una frase di sopra. SOLO diario: non fa comparire il riquadro
 *  arancione al consulente — un telefono che chiede un tocco è normale, non è
 *  un'emergenza. Una volta per frase per apertura di pagina. */
export function segnalaVideoOspite(frase: string): void {
  if (typeof window === "undefined" || giaDette.has(frase)) return;
  giaDette.add(frase);
  try {
    const { browser, sistema } = riduciUserAgent(navigator.userAgent);
    void fetch("/api/presenter/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      //  Niente `name`: il diario ne ha il campo, qui resta vuoto apposta.
      body: JSON.stringify({ msg: frase, page: "/presenta", ua: `${browser} · ${sistema}` }),
    }).catch(() => {
      /* il diario è un di più: se non parte, il cliente non deve accorgersene */
    });
  } catch {
    /* idem */
  }
}
