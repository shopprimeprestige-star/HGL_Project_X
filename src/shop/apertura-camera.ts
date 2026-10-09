/** ── QUANDO LA CAMERA NON SI APRE, SI RIPROVA (E SI DICE) ──────────────────
 *
 *  Segnalazione del committente: «la camera del presentatore sul dispositivo
 *  dell'ospite non funziona più».
 *
 *  ── DOVE SI ROMPEVA ──────────────────────────────────────────────────────
 *  La camera si chiedeva così:
 *
 *      deviceId: { exact: <la camera scelta l'ultima volta> }
 *
 *  `exact` vuol dire «quella e nessun'altra»: se quella camera non c'è più — un
 *  altro computer, la webcam staccata, il telefono che rinomina i suoi
 *  dispositivi dopo un aggiornamento — il browser non ripiega su un'altra, dà
 *  errore. E l'errore arrivava a un `catch` che spegne la camera in silenzio: il
 *  presentatore si vedeva «camera spenta» addosso senza una riga che dicesse
 *  perché, e dall'altra parte il cliente vedeva un rettangolo con scritto che il
 *  consulente ha la camera spenta.
 *
 *  ⚠️ E NON MORIVA SOLO LA CAMERA. All'avvio della chiamata camera e microfono
 *   si chiedono in UNA richiesta sola: se il video faceva fallire quella
 *   richiesta, cadeva anche l'audio — consulenza muta, oltre che cieca, per una
 *   webcam scollegata.
 *
 *  ── LA SCALA DEI TENTATIVI ───────────────────────────────────────────────
 *  Qui non si apre niente: si decide in che ordine PROVARE, dal più completo al
 *  più magro, e che cosa si sta lasciando per strada a ogni gradino. Chi chiama
 *  (shop/call) scende la scala finché uno riesce.
 *   1. tutto come richiesto, con i dispositivi scelti a mano;
 *   2. senza la camera scelta a mano — cioè con quella di serie;
 *   3. senza nemmeno il microfono scelto a mano;
 *   4. solo audio. Una consulenza senza immagine si fa; senza voce no.
 *  Gli id ricordati che si smette di chiedere si buttano: puntano a roba che
 *  non c'è, e al tentativo dopo ricadrebbero dentro.
 *
 *  ⚠️ NON SI SCENDE PIÙ DEL NECESSARIO: se nessun dispositivo era stato scelto
 *   a mano il gradino 2 non esiste, perché sarebbe identico al primo.
 *  ───────────────────────────────────────────────────────────────────────── */

export type VincoliVideo = MediaTrackConstraints | false;
export type VincoliAudio = MediaTrackConstraints | boolean;

export interface Tentativo {
  video: VincoliVideo;
  audio: VincoliAudio;
  /** Che cosa si lascia per strada rispetto alla richiesta piena. */
  rinuncia: "niente" | "dispositivi-scelti" | "video";
  /** Gli id ricordati che, arrivati qui, sono da dimenticare. */
  scorda: ("camera" | "microfono")[];
}

const conDispositivo = (v: MediaTrackConstraints, id: string): MediaTrackConstraints =>
  ({ ...v, deviceId: { exact: id } });

export function tentativiMedia(p: {
  /** I vincoli video pieni, SENZA deviceId (risoluzione, fotogrammi…). `false` = niente video. */
  video?: VincoliVideo;
  /** I vincoli audio pieni, SENZA deviceId. `false` = niente audio. */
  audio?: VincoliAudio;
  camId?: string | null;
  micId?: string | null;
}): Tentativo[] {
  const video = p.video ?? false;
  const audio = p.audio ?? false;
  const cam = String(p.camId || "").trim();
  const mic = String(p.micId || "").trim();
  //  Gli id scelti a mano valgono solo per il canale che li riguarda: un
  //  microfono scelto non c'entra niente con una richiesta di solo video.
  const camUsato = !!cam && video !== false;
  const micUsato = !!mic && audio !== false && audio !== true;

  const primo: Tentativo = {
    video: video !== false && camUsato ? conDispositivo(video, cam) : video,
    audio: audio !== false && audio !== true && micUsato ? conDispositivo(audio, mic) : audio,
    rinuncia: "niente",
    scorda: [],
  };
  const scala: Tentativo[] = [primo];

  //  ⚠️ PRIMA SI MOLLA LA CAMERA, POI IL MICROFONO. Nove volte su dieci a
  //   mancare è la webcam (staccata, cambiata, un altro computer), e buttare
  //   subito anche il microfono scelto a mano vorrebbe dire far perdere al
  //   consulente un'impostazione che funzionava benissimo.
  if (camUsato) {
    scala.push({
      video,
      audio: primo.audio,
      rinuncia: "dispositivi-scelti",
      scorda: ["camera"],
    });
  }
  if (micUsato) {
    scala.push({
      video,
      audio,
      rinuncia: "dispositivi-scelti",
      scorda: [...(camUsato ? (["camera"] as const) : []), "microfono"],
    });
  }

  //  Ultimo gradino: la voce. Ha senso solo se l'audio era richiesto e il video
  //  pure — se il video non c'era, questo tentativo sarebbe il precedente.
  if (video !== false && audio !== false) {
    scala.push({ video: false, audio, rinuncia: "video", scorda: [] });
  }
  return scala;
}

/** ── PERCHÉ NON SI APRE, DETTO A CHI STA LAVORANDO ─────────────────────────
 *  I nomi degli errori del browser sono quelli dello standard. La frase è per
 *  il consulente, che deve capire se tocca a lui (permesso, un'altra
 *  applicazione aperta) o se deve solo cambiare camera. */
export function spiegaErroreMedia(e: unknown): string {
  const nome = String((e as { name?: string } | null)?.name || "").trim();
  if (nome === "NotAllowedError" || nome === "SecurityError")
    return "Il browser non ci lascia usare camera e microfono: dai il permesso dall'icona accanto all'indirizzo, poi riprova.";
  if (nome === "NotFoundError" || nome === "DevicesNotFoundError")
    return "Nessuna camera collegata a questo computer.";
  if (nome === "NotReadableError" || nome === "TrackStartError")
    return "La camera è occupata da un'altra applicazione (Zoom, Meet, FaceTime): chiudila e riprova.";
  if (nome === "OverconstrainedError" || nome === "ConstraintNotSatisfiedError")
    return "La camera scelta non è più collegata: ne stiamo usando un'altra.";
  return "Camera non disponibile su questo dispositivo.";
}

/** Che cosa dire dopo che la scala è finita: quale gradino ha retto, o nessuno. */
export function esitoApertura(p: { rinuncia: Tentativo["rinuncia"] | null; errore?: unknown }): string {
  if (p.rinuncia === "niente") return "";
  if (p.rinuncia === "dispositivi-scelti")
    return "La camera (o il microfono) che avevi scelto non c'è più: stiamo usando quelli di serie.";
  if (p.rinuncia === "video")
    return `Sei in chiamata con la sola voce. ${spiegaErroreMedia(p.errore)}`;
  return spiegaErroreMedia(p.errore);
}
