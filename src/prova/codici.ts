/** ── I CODICI D'ACCESSO ALLA PROVA CAPELLI ─────────────────────────────────
 *
 *  La prova non è più aperta a chiunque passi: si entra con un codice che
 *  diamo noi su WhatsApp. Ogni codice porta con sé un numero di generazioni;
 *  finite quelle, se ne comprano altre.
 *
 *  ── ⚠️ PERCHÉ UN CODICE E NON UN ACCOUNT ─────────────────────────────────
 *  Chiedere a una persona di registrarsi per vedersi con i capelli vuol dire
 *  perderne nove su dieci: password, email di conferma, e intanto se n'è
 *  andata. Un codice invece arriva nella stessa chat dove si sta già
 *  parlando, si tocca e si è dentro. E per noi vale di più di un account,
 *  perché sappiamo A CHI l'abbiamo dato.
 *
 *  ── ⚠️ COME SONO FATTI ───────────────────────────────────────────────────
 *  Otto caratteri, in due gruppi da quattro, senza le lettere che si
 *  confondono: niente O contro 0, niente I contro 1, niente S contro 5. Un
 *  codice che si detta al telefono e si sbaglia è un cliente che scrive «non
 *  funziona» e aspetta — cioè un cliente perso per un carattere.
 *  Si leggono anche minuscoli e senza trattino: chi li scrive a mano non deve
 *  indovinare la forma giusta.
 */

/** ⚠️ NIENTE O, I, S, Z, B: si confondono con 0, 1, 5, 2, 8 su un telefono e
 *  in una foto di uno schermo. Restano ventuno lettere e cinque cifre. */
const ALFABETO = "ACDEFGHJKLMNPQRTUVWXY34679";

export const LUNGHEZZA = 8;

/** Un codice nuovo. `caso` serve solo alle prove: in produzione è Math.random. */
export function nuovoCodice(caso: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < LUNGHEZZA; i += 1) {
    s += ALFABETO[Math.floor(caso() * ALFABETO.length) % ALFABETO.length];
  }
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** ── COME SI SCRIVE, COME SI LEGGE ─────────────────────────────────────────
 *  ⚠️ Chi lo riceve su WhatsApp lo copia con lo spazio, o lo scrive minuscolo,
 *   o si dimentica il trattino. Tutte e tre le volte deve funzionare: rifiutare
 *   un codice giusto scritto in un modo diverso è il modo più stupido di
 *   perdere una persona che stava già entrando. */
export function normalizza(grezzo: string): string {
  const pulito = String(grezzo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  //  Gli scambi tipici di chi ricopia a mano: si correggono invece di
  //  rifiutare, perché il nostro alfabeto quei caratteri non li usa.
  const corretto = pulito
    .replace(/O/g, "0").replace(/I/g, "1").replace(/L(?=[0-9])/g, "1")
    .replace(/S/g, "5").replace(/Z/g, "2").replace(/B/g, "8");
  return corretto.slice(0, LUNGHEZZA);
}

/** Come si mostra: sempre a gruppi di quattro. */
export function leggibile(c: string): string {
  const n = normalizza(c);
  return n.length > 4 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
}

export function formaValida(c: string): boolean {
  return normalizza(c).length === LUNGHEZZA;
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUANTE PROVE RESTANO
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ TRE, ed è una scelta di vendita e non un limite tecnico. Con una sola la
 *  persona non fa in tempo a capire che funziona; con dieci si stanca prima di
 *  arrivare a parlare con noi. Tre bastano a vedersi con tre tagli diversi —
 *  cioè a innamorarsi di uno — e lasciano voglia di continuare. */
export const PROVE_COMPRESE = 3;

export interface StatoCodice {
  /** quante generazioni ha in tutto (comprese + comprate) */
  totali: number;
  /** quante ne ha già usate */
  usate: number;
  /** spento a mano dallo studio */
  bloccato?: boolean;
  /** ⚠️ Un codice admin NON ha un tetto: è chi vende, e sta preparando la
   *  vetrina o mostrando i tagli a un cliente seduto davanti. Fermarlo alla
   *  terza prova durante una consulenza sarebbe una figura, non un risparmio.
   *  Quello che serve non è un limite ma un CONTO: quanto ha speso, scritto
   *  accanto al codice. Vedi `spesoCentesimi` in archivio.server. */
  admin?: boolean;
}

export interface Verdetto {
  ok: boolean;
  restano: number;
  /** perché no, detto a chi lo legge */
  perche?: string;
  /** l'unica cosa che può fare adesso */
  puoComprare?: boolean;
}

/** Può fare un'altra prova?
 *  ⚠️ «Finite» e «bloccato» sono due no diversi e vanno detti diversi: dal
 *   primo si esce comprando, dal secondo no. Un solo messaggio per entrambi
 *   manderebbe una persona bloccata a pagare — che è il modo di trasformare un
 *   problema in un rimborso. */
export function puoProvare(s: StatoCodice | null | undefined): Verdetto {
  if (!s) return { ok: false, restano: 0, perche: "Questo codice non esiste." };
  if (s.bloccato) return { ok: false, restano: 0, perche: "Questo codice non è più attivo." };
  //  ⚠️ Illimitato vuol dire illimitato: `restano` resta un numero perché la
  //   pagina lo mostra, e qui vale -1 — che si legge come «non contarle».
  if (s.admin) return { ok: true, restano: -1 };
  const restano = Math.max(0, Number(s.totali || 0) - Number(s.usate || 0));
  if (restano <= 0) {
    return {
      ok: false,
      restano: 0,
      perche: "Hai finito le prove comprese.",
      puoComprare: true,
    };
  }
  return { ok: true, restano };
}
