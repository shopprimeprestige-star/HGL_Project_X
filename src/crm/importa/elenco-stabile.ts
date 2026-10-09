/** ── UNA RIGA NON SPARISCE SOTTO LE DITA ───────────────────────────────────
 *
 *  Segnalazione del committente: «su lead importati, quando clicco su un
 *  contatto, qualsiasi cosa faccio su quel contatto scompare. Se metto per
 *  esempio “appuntamento fissato” e poi chiudo il popup, deve rimanere lì il
 *  lead, perché significa che devo selezionare altro».
 *
 *  ── CHE COSA SUCCEDEVA ───────────────────────────────────────────────────
 *  L'elenco «Da chiamare in lista» mostra, giustamente, solo chi ha la prima
 *  chiamata ancora aperta. Ma l'elenco si ricalcola nell'istante in cui lo
 *  stato cambia: segni «appuntamento fissato», chiudi la finestra, e la riga
 *  che stavi guardando NON C'È PIÙ. Tre conseguenze, tutte brutte:
 *   · non si può fare una seconda cosa sulla stessa persona (aprire la scheda,
 *     correggere l'orario, cambiare idea sullo stato), e il secondo gesto è
 *     esattamente quello che si voleva fare;
 *   · non si sa se la scrittura è andata a buon fine o se la riga è sparita per
 *     un errore — da fuori sono identiche;
 *   · le righe sotto salgono di un posto, e il dito che stava scendendo preme
 *     la persona sbagliata.
 *
 *  ── LA REGOLA ────────────────────────────────────────────────────────────
 *  Chi è stato sistemato ADESSO, in questa schermata, resta dov'è — al suo
 *  posto, con una targhetta che dice com'è finito — finché non si cambia
 *  scheda. Non è «non filtrare»: è «non togliere una riga mentre la stai
 *  guardando». Al prossimo giro l'elenco è di nuovo pulito.
 *
 *  ⚠️ VALE SOLO PER GLI ELENCHI, NON PER LA CODA. Nella coda si lavora una
 *   persona alla volta e il senso del gesto è «passa alla prossima»: tenerla lì
 *   bloccherebbe il giro delle telefonate.
 *  ⚠️ NON È UNA SCRITTURA: è solo che cosa si vede. In archivio lo stato è
 *   quello nuovo dall'istante in cui si preme, e chi guarda la stessa pagina da
 *   un altro computer vede l'elenco senza quella riga. Qui si difende SOLO il
 *   gesto di chi la sta toccando.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Questa riga si vede ancora?
 *  · `tuttiVisibili` — l'interruttore «mostra anche i già sistemati»: con
 *    quello acceso non si nasconde niente e non c'è niente da decidere.
 *  · `daChiamare`    — la prima chiamata è ancora aperta: è il motivo normale
 *    per cui una riga sta in questo elenco.
 *  · `appenaSistemato` — l'ho sistemata io, adesso, da questa schermata. */
export function restaNellElenco(p: {
  daChiamare?: boolean;
  appenaSistemato?: boolean;
  tuttiVisibili?: boolean;
}): boolean {
  if (p.tuttiVisibili) return true;
  return !!p.daChiamare || !!p.appenaSistemato;
}

/** La targhetta da scrivere sulla riga rimasta. Vuota = non va scritto niente
 *  (la riga è lì di diritto).
 *  ⚠️ LA TARGHETTA SERVE: senza, una riga che per l'elenco non dovrebbe più
 *   esserci sembra un filtro che non funziona. Dice che cosa è successo e che
 *   sparirà da sola. */
export function targhettaSistemato(p: {
  daChiamare?: boolean;
  appenaSistemato?: boolean;
  tuttiVisibili?: boolean;
}): string {
  if (!p.appenaSistemato || p.daChiamare) return "";
  //  Con tutti visibili la riga c'è comunque: dire «resta qui» sarebbe falso.
  return p.tuttiVisibili ? "appena sistemato" : "appena sistemato · resta finché sei qui";
}
