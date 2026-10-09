/** ── QUESTO ERRORE È NOSTRO, O È DI UN'ESTENSIONE DEL BROWSER? ─────────────
 *
 *  Segnalazione del committente, con la schermata sotto gli occhi: durante la
 *  consulenza, sul suo Meetly, il riquadro arancione «Problema sul dispositivo
 *  del cliente — Promise non gestita: Cannot read properties of undefined» con
 *  il pulsante «Ricarica il dispositivo del cliente».
 *
 *  ⚠️ MISURATO, NON DEDOTTO. Gli errori del cliente finiscono in un diario sul
 *   server (rotta `presenter/errors`), e lì c'è lo stack per intero:
 *     TypeError: Cannot read properties of undefined (reading 'M_ID')
 *       at Y (chrome-extension://eppiocemhmnl…/executors/200.js:1:761)
 *   Non è nostro: è un'ESTENSIONE installata nel browser del cliente, che
 *   inciampa da sola ogni minuto. Il nostro programma non c'entra, ricaricare
 *   il dispositivo del cliente non serve a niente — e nel frattempo il
 *   consulente è convinto di avere una consulenza rotta fra le mani.
 *
 *  Una pagina non può impedire a un'estensione di sbagliare. Può però smettere
 *  di prendersi la colpa: qui si riconosce da dove viene l'errore, e quello che
 *  non è nostro resta nella console del cliente invece di finire sullo schermo
 *  del consulente.
 *
 *  ⚠️ NEL DUBBIO È NOSTRO. Un errore vero nascosto costa una consulenza; un
 *   avviso di troppo costa una riga letta. Si scarta solo quello che si
 *   riconosce con certezza — un indirizzo di estensione, o il messaggio muto
 *   che i browser danno per uno script di un'altra origine.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Gli indirizzi da cui parlano le estensioni, in tutti i browser. */
const ESTENSIONE = /\b(chrome|moz|safari-web|ms-browser|opera|edge)-extension:\/\//i;

/** Il messaggio muto: lo dà il browser quando a sbagliare è uno script servito
 *  da un'altra origine, e non lascia né riga né file. I nostri script stanno
 *  sulla nostra origine, quindi questo non è mai uno dei nostri. */
const MUTO = /^script error\.?$/i;

export function daUnEstensione(msg?: string | null, stack?: string | null): boolean {
  const tutto = `${msg ?? ""}\n${stack ?? ""}`;
  return ESTENSIONE.test(tutto);
}

/** Vale la pena avvisare il consulente di questo errore del cliente? */
export function erroreDaMostrare(msg?: string | null, stack?: string | null): boolean {
  const m = String(msg ?? "").trim();
  if (daUnEstensione(m, stack)) return false;
  //  «Script error.» da solo non dice niente a nessuno: né a noi per capirlo,
  //  né al consulente per rimediare. Con un seguito, invece, è un errore vero.
  if (MUTO.test(m.replace(/^promise non gestita:\s*/i, "").trim()) && !String(stack ?? "").trim()) return false;
  //  Un errore senza messaggio e senza traccia non è una notizia.
  if (!m && !String(stack ?? "").trim()) return false;
  return true;
}
