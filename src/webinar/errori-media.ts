/** ── PERCHÉ NON SI APRE CAMERA O MICROFONO ─────────────────────────────────
 *
 *  ⚠️ C'ERANO DUE FRASI PER SEI CAUSE DIVERSE. Tutto quello che non era «hai
 *   negato il permesso» diventava «controlla che non li stia usando un'altra
 *   applicazione» — che è vero in UN caso su sei. A chi non ha una camera, a
 *   chi ha il browser su http, a chi ha una camera che non regge quello che
 *   chiediamo, quella frase dice di andare a chiudere applicazioni che non
 *   c'entrano niente. Segnalato: «dice sempre così quando una persona prova a
 *   entrare».
 *
 *  ⚠️ E OGNI FRASE PORTA UN CODICE. «Mi dà C03» è una cosa che si può dire al
 *   telefono a chi conduce; «non funziona» non lo è, ed era tutto quello che
 *   si poteva dire prima.
 */
export interface SpiegazioneMedia {
  codice: string;
  testo: string;
}

export function spiegaErroreMedia(nome: string, conVideo: boolean): SpiegazioneMedia {
  switch (String(nome || "")) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        codice: "C01",
        testo: conVideo
          ? "Camera e microfono sono bloccati. Sbloccali dalle impostazioni del browser e riprova."
          : "Il microfono è bloccato. Sbloccalo dalle impostazioni del browser e riprova.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      //  ⚠️ Non c'è proprio l'apparecchio: dire «chiudi le altre applicazioni»
      //   manda a cercare un problema che non esiste. Con la sola voce si entra
      //   lo stesso, e va detto perché è l'unica cosa che si può fare.
      return {
        codice: "C02",
        testo: conVideo
          ? "Su questo dispositivo non c'è una camera. Puoi entrare solo con la voce."
          : "Su questo dispositivo non c'è un microfono.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        codice: "C03",
        testo: "Camera o microfono sono già in uso da un'altra applicazione o da un'altra scheda. Chiudila e riprova.",
      };
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      //  ⚠️ Questo è un difetto NOSTRO, non suo: vuol dire che abbiamo chiesto
      //   alla camera qualcosa che non sa fare. Si riprova da soli senza
      //   chiedere niente (vedi chi chiama), e se anche così non va lo si dice
      //   senza dare la colpa a chi guarda.
      return {
        codice: "C04",
        testo: "La tua camera non regge quello che le ho chiesto. Riprova, o entra solo con la voce.",
      };
    case "SecurityError":
      return {
        codice: "C05",
        testo: "Su questa pagina il browser blocca camera e microfono. Apri il link da un indirizzo https.",
      };
    case "AbortError":
      return { codice: "C06", testo: "Il browser ha interrotto l'apertura della camera. Riprova." };
    case "TypeError":
      //  ⚠️ Vuol dire che abbiamo chiesto male, non che c'è qualcosa di rotto
      //   dalla sua parte: `getUserMedia` risponde così a una richiesta senza
      //   né audio né video, o scritta in un modo che non capisce. È un difetto
      //   nostro, e la frase non deve mandare la persona a controllare la sua
      //   camera.
      return {
        codice: "C09",
        testo: "L'apertura della camera è fallita da parte nostra. Riprova, o entra solo con la voce.",
      };
    case "NotSupportedError":
    case "InvalidStateError":
      //  ⚠️ Tipico dei browser dentro le applicazioni e delle pagine aperte in
      //   una scheda che il sistema ha messo a dormire. Aprire il link nel
      //   browser vero è l'unica cosa che funziona, e va detto.
      return {
        codice: "C10",
        testo: "Questo browser non riesce ad aprire camera e microfono. Apri il link in Chrome o Safari.",
      };
    case "SenzaSupporto":
      //  ⚠️ Succede sui browser dentro le applicazioni (Instagram, Facebook):
      //   lì `getUserMedia` non esiste proprio, e nessuna impostazione lo fa
      //   comparire. L'unica cosa che funziona è aprire il link nel browser
      //   vero, e va detto — altrimenti si prova all'infinito.
      return {
        codice: "C07",
        testo: "Questo browser non permette camera e microfono. Apri il link in Chrome o Safari.",
      };
    default:
      //  ⚠️ Il ramo «non so cosa sia» esiste perché la lista non può essere
      //   completa: browser diversi inventano nomi diversi. Ma chi lo legge
      //   deve poter dire QUALE, altrimenti resta un codice muto e la volta
      //   dopo siamo al punto di prima — è già successo. Chi chiama ci
      //   attacca il nome vero.
      return {
        codice: "C08",
        testo: "Non riesco ad aprire camera e microfono. Riprova, o entra solo con la voce.",
      };
  }
}
