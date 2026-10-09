/** ── QUANTE CAMERE STANNO AFFIANCATE ────────────────────────────────────────
 *  Modulo puro — nessun React — perché questa regola decide cosa si vede su un
 *  telefono durante un salotto, ed è il genere di cosa che si sbaglia in
 *  silenzio: francobolli in cui non si riconosce nessuno, oppure una colonna
 *  sola su un monitor da 27 pollici. Da qui si può mettere alla prova.
 *  `Anteprime.tsx` la ri-esporta, così chi disegna ha un posto solo da cui
 *  prendere le cose.
 */

export function colonnePerCamere(n: number, larghezza?: number): number {
  //  ⚠️ È LA REGOLA DI MEETLY, copiata dalla riga che la decide in
  //   `shop/call.tsx`: 1→1, 2→2, 3→3, 4→2, fino a 9→3, poi la radice quadrata.
  //   Non è arbitraria — quattro camere su due colonne fanno un quadrato, su
  //   quattro fanno una striscia di francobolli — ed è già quella a cui
  //   l'occhio di chi presenta è abituato. Inventarne una seconda vorrebbe
  //   dire due griglie diverse per la stessa cosa nello stesso programma.
  const perNumero =
    n <= 1 ? 1
      : n === 2 ? 2
        : n === 3 ? 3
          : n === 4 ? 2
            : n <= 9 ? 3
              : Math.ceil(Math.sqrt(n));

  //  ⚠️ SENZA LARGHEZZA VALE SOLO IL NUMERO, ed è il caso della console del
  //   presentatore: lì i riquadri sono miniature di servizio in un pannello
  //   stretto, e vanno bene piccole. Chi passa una larghezza è la SALA, dove
  //   quelle stesse camere sono la cosa che si guarda.
  if (!larghezza) return Math.max(1, perNumero);

  //  Su un telefono tre camere affiancate sono tre francobolli: si riconosce
  //  che c'è qualcuno, non CHI.
  //  ⚠️ IL TETTO LIMITA, NON SOSTITUISCE: a due persone su un telefono
  //   restano due colonne, perché ci stanno. Se sostituisse, un telefono
  //   darebbe sempre il massimo consentito anche quando non serve.
  //  ⚠️ 340 E NON 400, e la differenza non è un dettaglio: un iPhone in
  //   verticale è largo 390-393, un Android comune 360-412. Con la soglia a
  //   400 QUALUNQUE telefono sarebbe finito a colonna singola — quattro
  //   persone in salotto diventavano quattro video da scorrere uno alla
  //   volta, invece di un quadrato che si vede tutto insieme. Sotto i 340 ci
  //   stanno solo i telefoni davvero piccoli, dove due colonne sarebbero
  //   davvero illeggibili.
  const tetto = larghezza < 340 ? 1 : larghezza < 768 ? 2 : larghezza < 1280 ? 3 : 4;
  return Math.max(1, Math.min(perNumero, tetto));
}

/** ── CHI SI VEDE, QUANDO SI NASCONDE CHI NON PARLA ─────────────────────────
 *  Un interruttore della regia: normalmente si vedono tutti quelli che
 *  conducono, con chi parla più largo; acceso, restano SOLO quelli che hanno
 *  la voce.
 *
 *  ⚠️ E QUANDO NON PARLA NESSUNO SI VEDONO TUTTI. È la regola che salva la
 *   funzione: fra una frase e l'altra si respira, e in quel mezzo secondo di
 *   silenzio lo schermo resterebbe VUOTO — nero, senza nessuno, ogni volta che
 *   qualcuno prende fiato. Nessuno che parla non vuol dire nessuno da vedere:
 *   vuol dire che non c'è motivo di scegliere.
 *
 *  Restituisce sempre almeno un elemento, se ce n'era almeno uno.
 */
export function chiSiVede<T extends { parla?: boolean }>(tutti: T[], soloChiParla: boolean): T[] {
  if (!soloChiParla) return tutti;
  const conLaVoce = tutti.filter((r) => r.parla);
  return conLaVoce.length ? conLaVoce : tutti;
}

/** ── COME SI DISPONE LA FASCIA DEI RELATORI ────────────────────────────────
 *  Chi conduce sta in una fascia con un posto fisso. Come si divide dipende da
 *  due cose: quanti sono, e quanto è largo lo schermo di chi guarda.
 *
 *  ⚠️ DUE MODI, E NON È PIGNOLERIA:
 *   · `riga`   — ci stanno tutti affiancati, e chi parla si ALLARGA spingendo
 *     gli altri in una striscia. È il modo giusto in due o tre su un computer:
 *     la fascia non cambia mai altezza, e l'occhio non deve riabituarsi.
 *   · `griglia` — non ci stanno: chi parla prende la PRIMA RIGA INTERA e gli
 *     altri si dispongono sotto. È il caso del telefono con tre relatori, dove
 *     affiancarli darebbe tre francobolli larghi due centimetri in cui non si
 *     riconosce nessuno.
 *
 *  La soglia è la larghezza minima perché una faccia resti una faccia: sotto i
 *  ~170 pixel per riquadro non si riconosce più chi è, e una fascia in cui non
 *  si riconosce nessuno non serve a niente.
 */
export const LARGHEZZA_MINIMA_FACCIA = 170;

export function disposizioneRelatori(
  quanti: number,
  larghezza: number,
): { modo: "riga" | "griglia"; colonne: number } {
  const n = Math.max(1, quanti);
  //  Quante ne stanno affiancate senza scendere sotto la soglia. Almeno una,
  //  sempre: su uno schermo strettissimo si mostra comunque qualcosa.
  const stanno = Math.max(1, Math.floor((larghezza || 1280) / LARGHEZZA_MINIMA_FACCIA));
  //  ⚠️ Il tetto per classe di schermo resta anche quando lo spazio ci
  //   sarebbe: quattro relatori affiancati su un tablet CI STANNO, ma sono
  //   quattro riquadri in cui si vede una testa e mezza spalla. Le facce
  //   vogliono aria.
  const tetto = larghezza < 640 ? 2 : larghezza < 1024 ? 3 : 4;
  const colonne = Math.min(n, stanno, tetto);
  return { modo: n <= colonne ? "riga" : "griglia", colonne };
}
