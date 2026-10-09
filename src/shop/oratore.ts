/** ── CHI STA PARLANDO, SENZA FAR TREMARE LO SCHERMO ────────────────────────
 *
 *  Segnalazione del committente: «all'ospite si sposta sopra e sotto il cerchio
 *  della mia camera quando condivido contenuti» e «quando la videochiamata è
 *  attiva, all'utente la camera si spegne e si accende di continuo, come se si
 *  allargasse e si stringesse».
 *
 *  ── ⚠️ UNA SOLA CAUSA PER TUTTI E TRE I SINTOMI ──────────────────────────
 *  Chi parla veniva deciso SESSANTA VOLTE AL SECONDO, e senza nessuna
 *  esitazione: a ogni fotogramma si misurava il volume di ognuno, si prendeva
 *  il più forte, e se era diverso da quello di prima si cambiava — e si
 *  mandava anche un messaggio sul canale.
 *  In una conversazione vera il «più forte» cambia di continuo: due persone si
 *  accavallano, un respiro copre una pausa, una sedia si muove. Risultato: la
 *  camerina del cliente cambiava faccia decine di volte al secondo (che si
 *  legge come una camera che si spegne e si riaccende), il riquadro passava da
 *  due cerchi a uno e viceversa (che si legge come una camera che si allarga e
 *  si stringe), e il blocco cambiando altezza faceva saltare il cerchio su e
 *  giù. In più il canale riceveva una raffica di messaggi che non servivano a
 *  nessuno.
 *
 *  ── LA REGOLA, IN TRE RIGHE ──────────────────────────────────────────────
 *  Per prendersi la scena non basta essere il più forte in un istante:
 *   · bisogna esserlo di un MARGINE, non per una virgola;
 *   · bisogna esserlo per un PO' di tempo, non per un fotogramma;
 *   · e chi ce l'ha non la perde finché non cala davvero (silenzio prolungato).
 *  Sono le stesse tre regole di qualunque videoconferenza che non sfarfalla.
 *
 *  ⚠️ NIENTE React e niente audio qui dentro: si passano le misure già fatte e
 *   l'orologio. È una regola di comportamento, e va potuta mettere alla prova
 *   senza un microfono e senza un browser.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Quanto forte deve essere un suono per contare come «voce». Sotto, è
 *  respiro, ventola, tastiera. */
export const SOGLIA_VOCE = 0.05;
/** Di quanto il candidato deve superare chi ha la scena per insidiarla.
 *  ⚠️ Senza margine due persone quasi pari si rubano la scena a vicenda: è
 *   proprio il caso in cui si vede lo sfarfallio. */
export const MARGINE = 0.02;
/** Per quanto tempo deve restare davanti prima di prendersela (ms). */
export const ATTESA_CAMBIO_MS = 1200;
/** Dopo quanto silenzio la scena si libera (ms). ⚠️ Lungo di proposito: fra
 *  una frase e l'altra si respira, e una camerina che sparisce a ogni virgola
 *  è peggio di una che resta. */
export const ATTESA_SILENZIO_MS = 2500;

export interface StatoOratore {
  /** chi ha la scena adesso ("" = nessuno) */
  attuale: string;
  /** chi la sta insidiando, e da quando */
  candidato: string;
  daQuando: number;
  /** da quando non si sente più nessuno */
  silenzioDa: number;
}

export const statoOratoreVuoto = (): StatoOratore => ({
  attuale: "",
  candidato: "",
  daQuando: 0,
  silenzioDa: 0,
});

/** Una misura: chi, e quanto forte. */
export interface Misura {
  pid: string;
  rms: number;
}

/** ── IL PASSO ──────────────────────────────────────────────────────────────
 *  Prende le misure di questo istante e restituisce lo stato nuovo. Se
 *  `attuale` cambia, chi chiama aggiorna lo schermo e avvisa gli altri: NON si
 *  manda niente quando resta uguale, che è il caso normale.
 */
export function passoOratore(
  stato: StatoOratore,
  misure: Misura[],
  adesso: number,
): StatoOratore {
  const forti = (Array.isArray(misure) ? misure : [])
    .filter((m) => m && typeof m.pid === "string" && m.pid && Number.isFinite(m.rms))
    .filter((m) => m.rms > SOGLIA_VOCE)
    .sort((a, b) => b.rms - a.rms);

  //  ── NESSUNO PARLA ────────────────────────────────────────────────────
  if (!forti.length) {
    const da = stato.silenzioDa || adesso;
    //  ⚠️ La scena NON si libera subito: fra una frase e l'altra si respira.
    if (stato.attuale && adesso - da >= ATTESA_SILENZIO_MS) {
      return { attuale: "", candidato: "", daQuando: 0, silenzioDa: da };
    }
    return { ...stato, candidato: "", daQuando: 0, silenzioDa: da };
  }

  const primo = forti[0];
  //  Chi parla c'è: il conto del silenzio riparte da zero.
  const base = { ...stato, silenzioDa: 0 };

  //  ── LA SCENA È GIÀ SUA ────────────────────────────────────────────────
  if (primo.pid === stato.attuale) {
    return { ...base, candidato: "", daQuando: 0 };
  }

  //  ── NESSUNO CE L'HA: si prende subito, non c'è niente da far tremare ──
  if (!stato.attuale) {
    return { ...base, attuale: primo.pid, candidato: "", daQuando: 0 };
  }

  //  ── QUALCUNO LA INSIDIA ───────────────────────────────────────────────
  //   Deve superare chi ce l'ha di un margine: quasi pari non basta.
  const suo = forti.find((m) => m.pid === stato.attuale)?.rms ?? 0;
  if (primo.rms < suo + MARGINE) {
    return { ...base, candidato: "", daQuando: 0 };
  }
  //  E deve restare davanti per un po'.
  if (stato.candidato !== primo.pid) {
    return { ...base, candidato: primo.pid, daQuando: adesso };
  }
  if (adesso - stato.daQuando < ATTESA_CAMBIO_MS) return base;
  return { ...base, attuale: primo.pid, candidato: "", daQuando: 0 };
}
