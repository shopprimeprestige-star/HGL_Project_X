/** ── COME SONO ENTRATI I SOLDI — TRACCIATO E CONTANTI, SENZA CONTARLI DUE VOLTE ─
 *
 *  Di una pratica da 530 possono arrivare 280 per bonifico e 250 in mano. Il
 *  CRM lo chiede in due momenti diversi, e sono due domande diverse:
 *
 *   · REGISTRANDO LA VENDITA si dichiara come entrerà il TOTALE. In quel
 *     momento in cassa c'è solo l'acconto: tutto il resto è una previsione su
 *     un saldo che deve ancora arrivare (vedi `incassoTracciato` in types.ts).
 *   · REGISTRANDO LA POSA si sa com'è entrato DAVVERO il saldo, perché il
 *     cliente ce l'ha appena messo in mano o l'ha appena bonificato.
 *
 *  ⚠️ QUESTO FILE ESISTE PERCHÉ SOMMARE LE DUE DICHIARAZIONI È SBAGLIATO.
 *   Su Michele Porrozzi — prezzo 530, versati 100, «250 in contanti sul
 *   totale» detto alla vendita — dichiarare poi 430 di saldo tutto in contanti
 *   e sommare farebbe 680 di contanti su una pratica da 530: un numero che non
 *   esiste, dentro la scheda che la contabilità legge per sapere quanto è
 *   passato dalla banca.
 *
 *  La regola, in una riga: DEI SOLDI GIÀ IN CASSA vale la dichiarazione della
 *  vendita, ridotta a quanto era davvero entrato allora; del saldo di adesso
 *  vale quello che si sta dichiarando adesso. La previsione sul futuro viene
 *  sostituita dal fatto, non sommata a lui.
 *
 *  ⚠️ NIENTE React qui dentro: è una regola di denaro, e le regole di denaro si
 *   devono poter mettere alla prova senza aprire una finestra (prove/prove.mjs).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Quanto di una cifra è passato dalla banca e quanto è arrivato in mano. */
export interface Canale {
  tracciato: number;
  contanti: number;
}

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Ai centesimi: `0.1 + 0.2` non fa `0.3`, e su due cifre confrontate a schermo
 *  si vede. */
const cent = (n: number): number => Math.round(n * 100) / 100;

/** La divisione di UN movimento: si dichiara il contante, il tracciato è il
 *  resto.
 *  ⚠️ Mai più del movimento stesso e mai negativo: «ha lasciato 600 in contanti
 *   su un saldo di 430» è una battitura, e scritta così direbbe −170 di
 *   tracciato — un numero che poi nessuno sa più da dove viene. */
export function divisioneMovimento(incassato: number, contanti: number | undefined): Canale | null {
  if (contanti === undefined || contanti === null) return null;
  const tetto = Math.max(0, numero(incassato));
  const inMano = Math.min(Math.max(0, numero(contanti)), tetto);
  return { tracciato: cent(tetto - inMano), contanti: cent(inMano) };
}

/** ── I TOTALI DELLA PRATICA DOPO QUESTO INCASSO ────────────────────────────
 *  `null` = non toccare niente. Succede quando adesso non si è dichiarato
 *  niente: una dichiarazione fatta alla vendita non va riscritta solo perché
 *  qualcuno ha registrato una posa senza rispondere alla domanda.
 *
 *  ⚠️ LA PARTE GIÀ IN CASSA SI RIDUCE ALLA QUOTA DAVVERO ENTRATA. La vendita
 *   parla del totale; di quel totale, quando si scriveva, era arrivato solo
 *   l'acconto. Si tiene quindi la stessa proporzione fra tracciato e contanti
 *   dichiarata allora, ma sulla sola cifra che era in cassa — il resto era una
 *   previsione sul saldo, e il saldo adesso lo stiamo registrando per davvero.
 *   Senza questo taglio i contanti di una pratica potrebbero superare il suo
 *   prezzo.
 *
 *  ⚠️ Se alla vendita non era stato dichiarato niente, la parte già in cassa
 *   resta NON attribuita: non è né tracciata né in contanti, perché nessuno
 *   l'ha mai detto. La scheda KPI ha già la riga che conta quelle pratiche —
 *   inventare «tutto tracciato» sarebbe una dichiarazione che non esiste. */
export function canaleDopoIncasso(p: {
  /** quanto era già in cassa PRIMA di questo movimento */
  versatoPrima: number;
  /** la dichiarazione fatta alla vendita, se c'è stata */
  tracciatoPrima?: number;
  contantiPrima?: number;
  /** quanto entra adesso, IVA compresa */
  incassato: number;
  /** quanto di `incassato` è in contanti. `undefined` = non è stato detto */
  contantiOra?: number;
}): Canale | null {
  const ora = divisioneMovimento(p.incassato, p.contantiOra);
  if (!ora) return null;

  const tracciatoDetto = numero(p.tracciatoPrima);
  const contantiDetti = numero(p.contantiPrima);
  const detto = tracciatoDetto + contantiDetti;
  //  Quanta parte della dichiarazione della vendita riguarda soldi che erano
  //  DAVVERO entrati: al massimo tutta, se l'acconto era già grande come il
  //  totale dichiarato.
  const quota = detto > 0 ? Math.min(Math.max(0, numero(p.versatoPrima)), detto) / detto : 0;

  return {
    tracciato: cent(tracciatoDetto * quota + ora.tracciato),
    contanti: cent(contantiDetti * quota + ora.contanti),
  };
}

/** ── LO STESSO TAGLIO SU PIÙ RIGHE ────────────────────────────────────────
 *  Un incasso può essere registrato in più parti (una con l'IVA dentro, una
 *  al netto: vedi `parti` in OpzioniIncasso). Il contante dichiarato è uno
 *  solo e vale su tutto il movimento, quindi si spalma sulle righe in
 *  proporzione a quanto pesano.
 *  ⚠️ L'ULTIMA RIGA CHIUDE LA SOMMA. Arrotondando riga per riga si perde
 *   qualche centesimo, e la somma delle righe non tornerebbe più con il
 *   contante dichiarato: quel centesimo si scarica sull'ultima, che è l'unico
 *   modo perché i due numeri combacino sempre. */
export function ripartisciCanale(importi: number[], contanti: number | undefined): (Canale | null)[] {
  const righe = (Array.isArray(importi) ? importi : []).map((n) => Math.max(0, numero(n)));
  if (contanti === undefined || contanti === null) return righe.map(() => null);
  const totale = righe.reduce((s, n) => s + n, 0);
  const inMano = Math.min(Math.max(0, numero(contanti)), totale);
  let restaContante = cent(inMano);
  return righe.map((imp, i) => {
    const ultima = i === righe.length - 1;
    const quota = ultima ? restaContante : Math.min(cent(totale > 0 ? (inMano * imp) / totale : 0), restaContante);
    restaContante = cent(restaContante - quota);
    return { tracciato: cent(imp - quota), contanti: cent(quota) };
  });
}
