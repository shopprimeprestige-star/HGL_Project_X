/** ── PERCHÉ QUELLA CAMERA NON SI VEDE ──────────────────────────────────────
 *
 *  ⚠️ ESISTE PERCHÉ LA STESSA DOMANDA È TORNATA TRE VOLTE E OGNI VOLTA LA
 *   RISPOSTA ERA UN'IPOTESI. «Faccio salire uno spettatore e non si vede» può
 *   voler dire almeno sei cose, e da fuori sono identiche:
 *    · il server non gli ha ancora registrato la traccia video (è salito in
 *      sola voce, o la registrazione è arrivata dopo);
 *    · noi non ci siamo mai agganciati a quella traccia;
 *    · ci siamo agganciati ma il flusso non è mai arrivato;
 *    · il flusso è arrivato con l'audio e senza video;
 *    · la traccia video c'è ma è spenta o finita;
 *    · c'è tutto e il riquadro non lo disegna nessuno.
 *   Le prime cinque si distinguono QUI, con certezza, guardando i dati che
 *   abbiamo già in mano. La sesta si vede dalle misure del riquadro.
 *
 *  Questo modulo non guarda niente da sé: riceve i fatti e li mette in righe
 *  leggibili. È tenuto separato apposta — così si può mettere alla prova senza
 *  montare una console, una connessione e una sala.
 */

export interface FattiPersona {
  nome: string;
  spettatore: string;
  /** «audio» o «video»: cosa gli ha concesso il presentatore */
  stato: string;
  /** la sessione SFU che il server gli ha assegnato quando è salito */
  sessionId?: string;
  /** i nomi delle tracce che il SERVER dice di avergli registrato */
  tracciaAudio?: string;
  tracciaVideo?: string;
  /** ci siamo già agganciati a queste tracce? (le chiavi `sessione/traccia`) */
  agganciate: string[];
  /** cosa è davvero arrivato: una riga per traccia del flusso ricevuto */
  arrivate: { kind: string; enabled: boolean; muted: boolean; readyState: string }[];
  /** il flusso esiste? (assente = non è mai arrivato niente) */
  flusso: boolean;
}

/** La diagnosi in una frase. È la riga che si legge per prima, e deve bastare
 *  da sola: chi la legge sta conducendo, non sta indagando. */
export function diagnosi(p: FattiPersona): string {
  if (p.stato !== "video") return "Sale in sola voce: il video non è previsto.";
  if (!p.sessionId) return "Non è ancora salito: il server non gli ha aperto una sessione.";
  if (!p.tracciaVideo) return "Il server non gli ha registrato la traccia video (è pubblicato in sola voce).";
  const chiave = `${p.sessionId}/${p.tracciaVideo}`;
  if (!p.agganciate.includes(chiave)) return "Non ci siamo agganciati alla sua traccia video.";
  if (!p.flusso) return "Agganciata, ma dal server non è arrivato nessun flusso.";
  const video = p.arrivate.filter((t) => t.kind === "video");
  if (!video.length) return "Il flusso è arrivato con l'audio ma senza video.";
  const viva = video.find((t) => t.readyState === "live" && t.enabled);
  if (!viva) {
    const t = video[0];
    if (t.readyState !== "live") return `La traccia video è arrivata ma è ${t.readyState}.`;
    return "La traccia video è arrivata ma è spenta.";
  }
  if (viva.muted) return "Video agganciato e vivo, ma non arrivano ancora fotogrammi.";
  return "Tutto a posto: video agganciato, vivo e in arrivo.";
}

/** Va tutto bene per questa persona? Serve al pallino verde/rosso. */
export function aPosto(p: FattiPersona): boolean {
  return diagnosi(p).startsWith("Tutto a posto");
}

/** ── LE MISURE DEL RIQUADRO ────────────────────────────────────────────────
 *  L'altra metà della domanda: «la camera esce schiacciata». Un riquadro che
 *  non sta nelle proporzioni della sorgente TAGLIA, e taglia in silenzio.
 *  ⚠️ Si confronta il riquadro con LA SORGENTE, non con 16:9 fisso: una camera
 *   di un telefono in verticale è 9:16, e pretendere da lei un 16:9 sarebbe
 *   dichiarare sbagliato proprio il caso più comune. */
export function misuraRiquadro(
  riquadro: { larghezza: number; altezza: number },
  sorgente: { larghezza: number; altezza: number },
): { proporzioneRiquadro: number; proporzioneSorgente: number; taglia: boolean; descrizione: string } {
  const pr = riquadro.altezza > 0 ? riquadro.larghezza / riquadro.altezza : 0;
  const ps = sorgente.altezza > 0 ? sorgente.larghezza / sorgente.altezza : 0;
  //  Un po' di tolleranza: un pixel di arrotondamento non è un ritaglio.
  const taglia = !!pr && !!ps && Math.abs(pr - ps) / ps > 0.05;
  const quanto = ps ? Math.round((1 - Math.min(pr, ps) / Math.max(pr, ps)) * 100) : 0;
  return {
    proporzioneRiquadro: Number(pr.toFixed(3)),
    proporzioneSorgente: Number(ps.toFixed(3)),
    taglia,
    descrizione: !pr || !ps
      ? "Non misurabile: il riquadro o la camera non hanno ancora una dimensione."
      : taglia
        ? `Il riquadro è ${pr.toFixed(2)}:1 e la camera manda ${ps.toFixed(2)}:1 — si perde circa il ${quanto}% dell'inquadratura.`
        : `Il riquadro segue la camera (${pr.toFixed(2)}:1 contro ${ps.toFixed(2)}:1): non si taglia niente.`,
  };
}
