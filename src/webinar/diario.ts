/** ── IL DIARIO DI BORDO DI CHI GUARDA ──────────────────────────────────────
 *
 *  ⚠️ ESISTE PERCHÉ «SI VEDE NERO» È STATO SEGNALATO QUATTRO VOLTE E OGNI VOLTA
 *   ERA UNA COSA DIVERSA. Un rettangolo nero non dice niente: non dice se la
 *   sala non esiste, se l'SFU non è configurato, se la rete ha bloccato i
 *   candidati ICE, se la trattativa è fallita, se il video non è mai stato
 *   pubblicato, o se semplicemente il relatore ha spento la camera. Sei guasti
 *   diversi, un solo sintomo, e nessuno — né chi guarda né chi corregge —
 *   in grado di distinguerli.
 *
 *  Da qui in poi ogni passo del collegamento lascia una riga, e ogni guasto ha
 *  un CODICE. Il codice serve a due persone diverse:
 *   · a chi guarda, che può leggerlo al telefono e dirlo — «mi dà W06» è una
 *     informazione, «non si vede» non lo è;
 *   · a chi corregge, che dal diario vede l'ordine esatto in cui le cose sono
 *     andate storte invece di ricostruirlo per ipotesi.
 *
 *  ⚠️ NIENTE DATI DELLA PERSONA QUI DENTRO. Il diario viene spedito al server e
 *   letto da chi conduce: ci va cosa è successo e su che apparecchio, MAI il
 *   nome scritto all'ingresso o il testo dei messaggi. Un registro tecnico che
 *   si porta dietro i nomi è un registro che prima o poi finisce nel posto
 *   sbagliato.
 */

/** I guasti che si sanno riconoscere. Il testo è quello che legge CHI GUARDA:
 *  niente gergo, e dove si può anche cosa fare. */
export const GUASTI = {
  W01: { che: "Questa sala non esiste più", fai: "Controlla il link che ti hanno mandato." },
  W02: { che: "La diretta non è configurata", fai: "Non dipende da te. Riprova più tardi." },
  W03: { che: "Il server non risponde", fai: "Riprova fra un minuto." },
  W04: { che: "La diretta non è ancora partita", fai: "Resta qui: parte da sola." },
  W05: { che: "Il video non si collega", fai: "Ricarica la pagina." },
  W06: { che: "La tua rete sta bloccando il video", fai: "Passa dal wi-fi ai dati del telefono, o il contrario." },
  W07: { che: "Il collegamento è caduto", fai: "Ricarica la pagina." },
  W08: { che: "Sei collegato, ma il video non arriva", fai: "L'audio dovrebbe funzionare lo stesso." },
  W09: { che: "La camera è spenta", fai: "Non è un guasto: l'audio c'è." },
  W10: { che: "Il browser ha bloccato l'audio", fai: "Tocca lo schermo per attivarlo." },
  /** ⚠️ Non è quello che si mostra a chi guarda — per quello ci sono i codici
   *  C01…C08 di `webinar/errori-media`, uno per causa. Questo serve al diario:
   *  «ho provato ad aprire camera o microfono e non ci sono riuscito», col nome
   *  vero dell'errore accanto. Sono due cose diverse: la frase spiega, il
   *  diario registra. */
  W11: { che: "Camera o microfono non si aprono", fai: "Il motivo esatto è scritto qui accanto." },
  /** ⚠️ DIVERSO da W11, e la differenza conta: lì la camera non si apre, qui
   *  la camera è aperta e non riesce a partire il collegamento con la diretta.
   *  Erano la stessa riga, e chi riceveva il messaggio andava a controllare la
   *  camera — che funzionava benissimo. */
  W12: { che: "La camera è pronta, la diretta no", fai: "È il collegamento, non la camera." },
} as const;

export type Codice = keyof typeof GUASTI;

export interface Riga {
  /** millisecondi dall'apertura della pagina: i tempi RELATIVI si leggono, gli
   *  orologi assoluti di due apparecchi diversi no. */
  ms: number;
  passo: string;
  codice?: Codice;
  /** dettaglio tecnico, breve: il messaggio d'errore vero */
  nota?: string;
}

/** Che apparecchio è. Serve a capire se un guasto è di tutti o solo dei
 *  telefoni — che è la prima domanda che ci si fa, e finora non aveva
 *  risposta. Niente `userAgent` intero: è lungo, e mezzo è un'impronta. */
export function apparecchio(ua: string, larghezza: number): string {
  const s = String(ua || "");
  const sistema = /iPhone|iPad|iPod/i.test(s) ? "iOS"
    : /Android/i.test(s) ? "Android"
    : /Macintosh/i.test(s) ? "Mac"
    : /Windows/i.test(s) ? "Windows"
    : "altro";
  //  ⚠️ L'ORDINE CONTA: dentro Chrome su iOS la stringa contiene «CriOS» E
  //   «Safari», e dentro Edge contiene «Chrome». Cercando Safari o Chrome per
  //   primi si direbbe il browser sbagliato — e su un guasto che dipende dal
  //   browser è precisamente l'informazione che si stava cercando.
  const browser = /CriOS/i.test(s) ? "Chrome"
    : /EdgA?\//i.test(s) ? "Edge"
    : /FxiOS|Firefox/i.test(s) ? "Firefox"
    : /Chrome\//i.test(s) ? "Chrome"
    : /Safari\//i.test(s) ? "Safari"
    : "altro";
  return `${sistema} · ${browser} · ${Math.round(larghezza)}px`;
}

/** Un diario che si riempie da solo. Tenuto corto di proposito: se una sala
 *  resta aperta un'ora, le righe interessanti sono le prime e le ultime. */
export class Diario {
  private righe: Riga[] = [];
  private nato = 0;
  private readonly max: number;

  constructor(adesso: number, max = 60) {
    this.nato = adesso;
    this.max = max;
  }

  segna(adesso: number, passo: string, codice?: Codice, nota?: string) {
    this.righe.push({
      ms: Math.max(0, Math.round(adesso - this.nato)),
      passo,
      ...(codice ? { codice } : {}),
      //  Un messaggio d'errore di duemila caratteri riempie il diario e non
      //  aggiunge niente: la parte utile sta sempre in testa.
      ...(nota ? { nota: String(nota).slice(0, 300) } : {}),
    });
    //  ⚠️ SI BUTTA VIA DAL CENTRO, NON DALL'INIZIO. Le prime righe raccontano
    //   come è cominciata (ed è lì che stanno quasi tutti i guasti), le ultime
    //   come è finita. Buttando le più vecchie si perderebbe proprio l'inizio.
    if (this.righe.length > this.max) {
      const meta = Math.floor(this.max / 2);
      this.righe = [
        ...this.righe.slice(0, meta),
        { ms: this.righe[meta].ms, passo: `… ${this.righe.length - this.max} righe saltate` },
        ...this.righe.slice(this.righe.length - (this.max - meta - 1)),
      ];
    }
  }

  /** L'ultimo guasto segnato: è quello che si mostra a chi guarda. */
  ultimoGuasto(): Codice | null {
    for (let i = this.righe.length - 1; i >= 0; i--) {
      const c = this.righe[i].codice;
      if (c) return c;
    }
    return null;
  }

  tutte(): Riga[] {
    return this.righe.slice();
  }

  vuoto(): boolean {
    return this.righe.length === 0;
  }
}

/** Il diario in testo, per il file che si scarica dallo studio.
 *  Leggibile da una persona senza strumenti: è il punto. */
export function inTesto(d: { apparecchio: string; quando: string; righe: Riga[] }): string {
  const capo = `${d.quando} — ${d.apparecchio}`;
  const corpo = d.righe.map((r) => {
    const t = `${String(Math.floor(r.ms / 1000)).padStart(3, " ")},${String(r.ms % 1000).padStart(3, "0")}s`;
    const cod = r.codice ? `  [${r.codice}] ${GUASTI[r.codice].che}` : "";
    const nota = r.nota ? `  — ${r.nota}` : "";
    return `${t}  ${r.passo}${cod}${nota}`;
  });
  return [capo, "─".repeat(Math.max(20, capo.length)), ...corpo].join("\n");
}
