/** ── CERCARE UN LEAD ────────────────────────────────────────────────────────
 *  Modulo a parte, e senza una riga di React: la regola con cui si decide se
 *  una scheda risponde a quello che si sta scrivendo è la cosa più facile da
 *  rompere senza accorgersene — basta un campo dimenticato — e da qui la si
 *  può mettere alla prova senza montare mezza interfaccia.
 *  Chi la usa la importa da `crm/ui`, che la ri-esporta: le pagine continuano
 *  ad avere un solo posto da cui prendere le cose.
 */
/** ── CERCARE UN LEAD, IN UN POSTO SOLO ─────────────────────────────────────
 *
 *  Una casella sola che cerca su tutto: nome, cognome, telefono, email, città
 *  E LE NOTE. Chiedere PRIMA su quale campo cercare è la ragione per cui si
 *  finisce a scorrere l'elenco a mano.
 *
 *  ⚠️ LE NOTE SONO IL MOTIVO PER CUI QUESTA FUNZIONE ESISTE.
 *   In una scheda il dato che serve spesso non ha un campo suo: il nome del
 *   marito che ha chiamato al posto della moglie, il paese scritto a mano
 *   perché non era in elenco, «richiamare dopo le 18», il modello del pezzo
 *   concordato a voce. Chi cerca «Brindisi» o «la sorella di» sta cercando una
 *   cosa che nel gestionale c'è — solo, sta in una nota. Senza guardarci
 *   dentro, la ricerca risponde «nessun risultato» a una domanda a cui il
 *   database saprebbe rispondere.
 *
 *  ⚠️ E STA QUI, non copiata su ogni pagina: due ricerche scritte due volte
 *   divergono, e si scopre trovando un lead in una schermata e non nell'altra
 *   con le stesse identiche parole.
 *
 *  `q` va già passato per `normalizza`, `qCifre` per `soloCifre`: si preparano
 *  UNA volta fuori dal ciclo, non ottocento volte dentro.
 */
export function trovaNelLead(
  //  ⚠️ `unknown` e non il tipo `Lead`: questa funzione sta in `crm/ui`, che
  //   `crm/types` non lo importa — e non deve, o si crea un anello fra i due.
  //   Il contenuto si restringe subito qui sotto, in un punto solo.
  l: { data?: unknown },
  q: string,
  qCifre: string,
): boolean {
  if (!q && !qCifre) return true;
  const d = (l?.data ?? {}) as Record<string, any>;

  if (q) {
    const pezzi = [
      d.nome, d.cognome, d.email, d.citta, d.indirizzo, d.provincia,
      //  Le note, tutte quelle che un lead può avere. Ognuna nasce in un
      //  momento diverso della trattativa, e chi cerca non si ricorda in quale.
      d.note, d.notePostCall, d.noteGestione, d.lostReasonNote,
      d.installazione?.noteInstallazione,
      d.chiusura?.note,
      d.impiantoSuMisura?.note,
      ...(Array.isArray(d.manutenzioni) ? d.manutenzioni.map((m: any) => m?.note) : []),
    ];
    if (normalizza(pezzi.filter(Boolean).join(" ")).includes(q)) return true;
  }

  //  ⚠️ Sotto le tre cifre un numero è dentro qualunque telefono: cercare «12»
  //   restituirebbe mezzo archivio, ed è il modo più veloce di far credere che
  //   la ricerca non funzioni.
  return qCifre.length >= 3 && soloCifre(d.telefono).includes(qCifre);
}


/** Solo cifre di un numero. Ripetuta qui e non importata da `ui` di proposito:
 *  quel file tira dentro tutta la libreria dei componenti, e questo modulo deve
 *  restare puro per poter essere provato da solo. Tre righe non divergono. */
function soloCifre(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

/** Testo confrontabile: minuscolo e senza accenti, così «Nicolò» si trova
 *  scrivendo «nicolo». Vale la stessa nota di `soloCifre`. */
export function normalizza(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
