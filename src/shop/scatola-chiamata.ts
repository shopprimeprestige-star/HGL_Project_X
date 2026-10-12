/** ── LA SCATOLA NERA DELLA VIDEOCHIAMATA ───────────────────────────────────
 *
 *  Segnalazione del committente: «la videochiamata si blocca di continuo e va
 *  a scatti». Si può ottimizzare?
 *
 *  ⚠️ NON SI INDOVINA. «A scatti» ha tre cause diverse, con tre rimedi
 *   diversi, e da fuori sembrano identiche:
 *    · la RETE (pacchetti persi, ritardo, passaggio dal TURN): si scende di
 *      qualità prima che la linea si intasi;
 *    · il COMPUTER di chi trasmette (`qualityLimitationReason = cpu`): si
 *      alleggerisce il lavoro — meno pixel, meno fotogrammi, niente lavori
 *      pesanti in parallelo (la registrazione a 60 fotogrammi lo era);
 *    · la PAGINA bloccata (blocchi del thread principale, shop/lentezza): il
 *      video arriva ma non si disegna.
 *   Il programma queste misure le prendeva già ogni dieci secondi, ma le
 *   scriveva solo nella console, che se ne va con la scheda. Qui diventano
 *   una riga ogni trenta secondi nel diario della chiamata, che si legge dal
 *   server dopo una consulenza vera.
 *
 *  ⚠️ NIENTE DI PRIVATO: numeri e le prime lettere dell'identificativo tecnico
 *   del collegamento. Nessun nome, nessun contenuto.
 *  ───────────────────────────────────────────────────────────────────────── */

export type CampioneVideo = {
  /** identificativo tecnico del collegamento (se ne scrivono 4 lettere) */
  pid: string;
  fpsSu?: number;
  larghezzaSu?: number;
  altezzaSu?: number;
  /** "cpu" | "bandwidth" | "none" | "other" */
  limiteSu?: string;
  fpsGiu?: number;
  larghezzaGiu?: number;
  altezzaGiu?: number;
  /** congelamenti dall'inizio della connessione (contatore del browser) */
  congelamenti?: number;
  /** secondi passati congelati dall'inizio (contatore del browser) */
  secondiCongelati?: number;
};

export type LineaVista = {
  kbit?: number;
  ponte?: boolean;
  rttMs?: number;
  persiSu?: number;
  persiGiu?: number;
};

/** Ogni quanto si scrive una riga, in millisecondi. */
export const OGNI_MS = 30_000;

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = (f: unknown) => `${Math.round(n(f) * 1000) / 10}%`;
const ris = (w?: number, h?: number) => (n(w) && n(h) ? `${n(w)}×${n(h)}` : "?");

/** La differenza dei contatori dal giro prima: i contatori del browser
 *  partono da zero a ogni riconnessione, e una differenza negativa vorrebbe
 *  dire «si è riconnesso», non «ha scongelato». */
export function differenza(ora: number, prima: number | undefined): number {
  const a = n(ora), b = n(prima);
  return a >= b ? a - b : a;
}

/** Una riga del diario. `prima` = i contatori dei congelamenti al giro prima,
 *  per collegamento. */
export function rigaChiamata(p: {
  campioni: CampioneVideo[];
  linea?: LineaVista | null;
  prima?: Map<string, { congelamenti: number; secondi: number }>;
  blocchi?: { quanti: number; peggioreMs: number; cosa: string };
}): string {
  const l = p.linea || {};
  const parti: string[] = [
    `chiamata · ${p.campioni.length} collegati`,
    `banda su ${n(l.kbit)} kbit`,
    l.ponte ? "via TURN" : "diretto",
    `ritardo ${n(l.rttMs)} ms`,
    `persi su ${pct(l.persiSu)} giù ${pct(l.persiGiu)}`,
  ];
  for (const c of p.campioni) {
    const pre = p.prima?.get(c.pid);
    const nuovi = differenza(n(c.congelamenti), pre?.congelamenti);
    const sec = Math.round(differenza(n(c.secondiCongelati), pre?.secondi) * 10) / 10;
    parti.push(
      `[${String(c.pid).slice(0, 4)}] esce ${Math.round(n(c.fpsSu))}fps ${ris(c.larghezzaSu, c.altezzaSu)} freno ${c.limiteSu || "none"}` +
        ` · entra ${Math.round(n(c.fpsGiu))}fps ${ris(c.larghezzaGiu, c.altezzaGiu)} congelamenti +${nuovi} (${sec}s)`,
    );
  }
  const b = p.blocchi;
  if (b && b.quanti)
    parti.push(`pagina bloccata ${b.quanti} volte, la peggiore ${(b.peggioreMs / 1000).toFixed(1)}s (${b.cosa})`);
  return parti.join(" · ").slice(0, 600);
}
