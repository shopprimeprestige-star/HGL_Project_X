/** ── QUANTO È GRANDE LA CAMERINA, E SU QUALE SCHERMO SI MISURA ─────────────
 *
 *  Sta fuori da `call.tsx` per una ragione sola: è aritmetica, e l'aritmetica
 *  si prova. Queste tre righe decidono se la camerina che il consulente vede
 *  nel suo specchio è grande quanto quella che il cliente ha in mano — e
 *  quando sbagliano non si rompe niente: viene semplicemente un cerchio della
 *  misura sbagliata, che è il genere di difetto che resta lì per mesi.
 *
 *  ── ⚠️ IL METRO È LO SCHERMO DEL CLIENTE ─────────────────────────────────
 *  La misura viaggia fra i due dispositivi come FRAZIONE. Se ognuno la
 *  riconvertisse sulla propria finestra, il 28% scelto sui 390 punti del
 *  telefono diventerebbe 420 punti sul monitor del consulente: proporzionale,
 *  ma un'altra cosa — e lo specchio serve a vedere quanto è grande DA LORO.
 *  Passando lo stesso `base` (le dimensioni del dispositivo del cliente) i due
 *  lati fanno il conto sullo stesso metro e il numero torna identico.
 */
export interface SchermoBase { w: number; h: number }

/** Le dimensioni della finestra di qui: il ripiego quando non c'è un cliente
 *  collegato, cioè quando non esiste nessun metro comune. */
export const schermoLocale = (): SchermoBase => ({
  w: typeof window === "undefined" ? 360 : window.innerWidth || 360,
  h: typeof window === "undefined" ? 640 : window.innerHeight || 640,
});

/** ── PERCHÉ QUESTE MISURE PREDEFINITE ──────────────────────────────────────
 *  La PiP si misura in PROPORZIONE ALLA FINESTRA, non in pixel fissi: 112px
 *  su un telefono sono mezzo pollice di schermo, gli stessi 112px su un
 *  monitor sono un francobollo in cui non si legge un'espressione — e in una
 *  consulenza di vendita l'espressione è l'informazione principale.
 *   · telefono: 30% del LATO CORTO, fra 96 e 190px. Il contenuto mostrato deve
 *     restare leggibile: la PiP non può prendersi mezzo schermo.
 *   · tablet e computer: 22% della LARGHEZZA, fra 240 e 460px, e comunque mai
 *     oltre METÀ ALTEZZA (con due camere impilate la colonna deve starci).
 *     Su un portatile da 1440px sono ~320px: un volto grande come in una
 *     chiamata normale. Era questo il "neanche si vede il volto".
 *  Il telefono si riconosce dal LATO CORTO, non dalla larghezza: in
 *  orizzontale un iPhone è largo 844px — la larghezza direbbe "computer",
 *  ma i 390px di altezza dicono la verità. */
export function pipLarghezzaDefault(base?: SchermoBase): number {
  if (typeof window === "undefined" && !base) return 260;
  const b = base || schermoLocale();
  const W = b.w || 360, H = b.h || 640;
  const corto = Math.min(W, H);
  if (corto < 500) return Math.round(Math.min(190, Math.max(96, corto * 0.3)));
  return Math.round(Math.max(200, Math.min(460, Math.max(240, W * 0.22), H * 0.5)));
}
/** Estremi del ridimensionamento manuale: larghi, ma mai fuori dallo schermo. */
export function pipLimiti(base?: SchermoBase): { min: number; max: number } {
  const b = base || schermoLocale();
  const W = b.w || 360, H = b.h || 640;
  //  ⚠️ Gli estremi seguono lo stesso metro della misura: se il tetto lo
  //   desse il monitor del consulente, lui potrebbe trascinare fino a 640
  //   punti una camerina che sul telefono non può superarne 234 — e lo
  //   specchio mostrerebbe una cosa che dall'altra parte non esiste.
  return { min: 80, max: Math.round(Math.max(140, Math.min(640, W * 0.6, H * 0.9))) };
}
/** Le misure del "tocco secco": piccola · consigliata · grande.
 *
 *  ⚠️ SENZA DOPPIONI, ED È LA CORREZIONE DI UN GUASTO VERO. Le tre misure
 *   vengono tenute dentro gli estremi, e su uno schermo stretto il tetto le
 *   schiaccia una sull'altra: «consigliata» e «grande» diventano lo STESSO
 *   numero. Chi toccava per rimpicciolire passava da un valore all'altro senza
 *   che il cerchio cambiasse di un pixel — «si allarga ma poi non si stringe
 *   più» (segnalazione del committente).
 *   Togliendo i doppioni il giro ha sempre un effetto: se le misure possibili
 *   sono due, il tocco le alterna; se lo schermo ne permette una sola, non
 *   cambia niente perché non c'è niente da cambiare — e almeno non sembra
 *   rotto. */
export function pipMisure(base?: SchermoBase): number[] {
  const d = pipLarghezzaDefault(base);
  const { min, max } = pipLimiti(base);
  const c = (n: number) => Math.round(Math.min(max, Math.max(min, n)));
  return [...new Set([c(d * 0.6), c(d), c(d * 1.6)])];
}

/** ── LA MISURA CHE ARRIVA DALL'ALTRO LATO ──────────────────────────────────
 *  Frazione → punti di schermo, tenuta dentro gli estremi dello stesso metro.
 *  ⚠️ È la riga che fa «se allargo io si allarga anche a lui»: con lo stesso
 *   `base` dalle due parti, `misuraDaFrazione(frazioneDaMisura(n)) === n`.
 *   Se un giorno tornasse a essere `window.innerWidth`, il difetto non
 *   somiglierebbe a un difetto — solo un cerchio della misura sbagliata.
 */
export function misuraDaFrazione(frazione: number, base?: SchermoBase): number {
  const { min, max } = pipLimiti(base);
  const b = base && base.w > 0 ? base : schermoLocale();
  const n = Number(frazione) * b.w;
  return Math.round(Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)));
}

/** Punti di schermo → frazione, sullo stesso metro. */
export function frazioneDaMisura(punti: number, base?: SchermoBase): number {
  const b = base && base.w > 0 ? base : schermoLocale();
  return b.w > 0 ? punti / b.w : 0;
}
