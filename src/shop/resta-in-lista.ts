/** ── CHI RESTA NEI RIQUADRI DELLA VIDEOCHIAMATA ────────────────────────────
 *
 *  Segnalazione del committente, con due fotografie a quattro secondi di
 *  distanza: nella prima il riquadro del cliente non c'è, nella seconda c'è.
 *  «Continuamente mi scollega la camera dell'utente e la rimette».
 *
 *  ── PERCHÉ SPARIVA UNO CHE ERA LÌ ────────────────────────────────────────
 *  La pulizia della lista toglieva un partecipante per tre motivi diversi, e
 *  tutti e tre gli capitavano addosso insieme:
 *   · nessun «ci sono» da 10 secondi. Ma quei messaggi li manda la SUA scheda
 *     ogni tre secondi, e una scheda in secondo piano viene rallentata dal
 *     browser — su Safari e Chrome fino a fermarla del tutto. Con due finestre
 *     affiancate, come nella fotografia, la sua è sempre quella dietro;
 *   · nessuna connessione creata dopo 12 secondi;
 *   · connessione mai arrivata a «collegato» dopo 45.
 *  Con la camera spenta e il microfono chiuso non arriva nessun flusso, quindi
 *  la connessione resta a «connessione…» e quei due tagli scattano. Il
 *  riquadro spariva, il suo «ci sono» successivo lo ricreava, e da fuori è un
 *  cliente che si scollega e si riattacca in continuazione.
 *
 *  ── LA REGOLA ────────────────────────────────────────────────────────────
 *  Un riquadro non si toglie a uno che sta ancora dicendo «ci sono». Il suo
 *  saluto è l'unica prova che quella persona è alla sua pagina: la connessione
 *  può mancare per mille motivi che non sono «se n'è andato» — camera spenta,
 *  permessi non dati, rete che sta ancora trattando.
 *  ⚠️ E NON SI ASPETTA PER NIENTE: chi chiude davvero la scheda manda «bye» e
 *   sparisce nell'istante stesso. Questa finestra riguarda solo chi sparisce
 *   SENZA dirlo (scheda uccisa, telefono spento), e allora quarantacinque
 *   secondi di riquadro fermo sono un prezzo molto più basso di un riquadro
 *   che lampeggia in mezzo a una consulenza.
 *  ⚠️ «Resta» non vuol dire «non si fa niente»: se la connessione è guasta si
 *   continua a riprovare (è `riprova`). Quello che si smette di fare è
 *   CANCELLARLO dalla lista.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Da quanto può tacere un partecipante prima di sparire dai riquadri. */
export const SALUTO_VIVO_MS = 45_000;

/** ── ⚠️ QUANTO SI LASCIA IN PACE UNA CONNESSIONE CHE STA NASCENDO ────────
 *  Segnalazione del committente: ammettendo un cliente, per circa un minuto si
 *  vedevano a vicenda con la camera spenta e senza audio, poi entrava davvero.
 *  Era questa regola nella sua prima versione: appena una persona compariva in
 *  elenco SENZA connessione — cioè nei primissimi secondi, mentre la
 *  connessione si sta creando — rispondeva «riprova», e chi conduce rifaceva
 *  l'offerta ogni pochi secondi. Rifare l'offerta mentre la prima è in corso
 *  non ripara niente: la disturba, e la trattativa ricomincia da capo. Quel
 *  minuto è fatto di quei tentativi.
 *  Dodici secondi sono il tempo in cui una connessione normale si chiude da
 *  sé: era il vecchio `NO_PEER_MS`, e quel numero era giusto. */
export const GRAZIA_AVVIO_MS = 12_000;
/** Connessione guasta da tanto: si riprova (ICE restart). */
export const GUASTO_MS = 30_000;

export type VerdettoOspite = "resta" | "riprova" | "via";

export function verdettoSuOspite(p: {
  adesso: number;
  /** Ultimo «ci sono» ricevuto da lui (0 = mai). */
  ultimoSaluto?: number;
  /** Stato della connessione con lui; "assente" = non è mai stata creata. */
  stato?: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed" | "assente";
  /** Arriva media da lui (audio o video). */
  haMedia?: boolean;
  /** Da quando la connessione risulta guasta (0 = non lo è). */
  guastoDa?: number;
  /** Quando questa persona è comparsa in elenco la prima volta. */
  primaVolta?: number;
}): VerdettoOspite {
  const saluto = Number(p.ultimoSaluto) || 0;
  const stato = p.stato || "assente";
  //  Collegato o con media che arriva: non c'è niente da decidere.
  if (stato === "connected" || p.haMedia) return "resta";
  //  ⚠️ APPENA ARRIVATO: NON SI TOCCA. La connessione si sta creando, e rifare
  //   l'offerta adesso la fa ricominciare da capo — è il minuto di «camera
  //   spenta e senza audio» misurato dal committente. Vedi `GRAZIA_AVVIO_MS`.
  const prima = Number(p.primaVolta) || 0;
  if (prima && p.adesso - prima < GRAZIA_AVVIO_MS) return "resta";
  //  ⚠️ IL SALUTO VIENE PRIMA DI TUTTO IL RESTO. Se non ha mai salutato non è
  //   mai stato nessuno (una voce fantasma), e se tace da troppo se n'è andato
  //   senza dirlo. In mezzo, c'è: qualunque cosa faccia la connessione.
  if (!saluto || p.adesso - saluto > SALUTO_VIVO_MS) return "via";
  //  Saluta ancora, ma il filo è rotto o non si è mai formato: si riprova.
  const guasto = Number(p.guastoDa) || 0;
  if (stato === "closed" || stato === "failed" || stato === "assente") {
    if (stato === "failed" && guasto && p.adesso - guasto <= GUASTO_MS) return "resta";
    return "riprova";
  }
  return "resta";
}
