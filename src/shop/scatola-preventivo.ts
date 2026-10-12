/** ── LA SCATOLA NERA DEL PREVENTIVO ────────────────────────────────────────
 *
 *  Richiesta del committente: «controlla anche il preventivo nella scatola
 *  nera, per capire come funziona e se funziona bene».
 *
 *  Il caso che l'ha fatta nascere: «seleziono e scorro e al cliente non
 *  arriva». La causa (il consulente nella stanza personale del cliente, il
 *  cliente su quella comune) si è trovata leggendo a mano la regia sul server,
 *  dopo. Con questa riga si legge mentre succede: in quale stanza scrive il
 *  consulente, se il canale è aperto, quanti stati e scorrimenti partono,
 *  quanti ospiti hanno salutato su QUEL canale (cioè lo stanno ascoltando), se
 *  il salvataggio sul server riesce, e le regole che possono spegnere l'invio
 *  (videochiamata, chi trasmette, preventivo spento per lui).
 *
 *  ⚠️ NIENTE DI PRIVATO: conteggi, stati e la parola «comune» o «personale».
 *   Nessun nome, nessuna scelta del cliente, nessun prezzo.
 *  ⚠️ NON CHIACCHIERA: una riga ogni trenta secondi, e solo se nel frattempo è
 *   successo qualcosa o è cambiata una regola. Una consulenza ferma non
 *   riempie il diario di righe uguali.
 *  ───────────────────────────────────────────────────────────────────────── */

export type ContatoriPreventivo = {
  statoInviati: number;
  scorriInviati: number;
  statoRicevuti: number;
  scorriRicevuti: number;
  salvatiOk: number;
  salvatiKo: number;
  /** l'ultimo errore del salvataggio sul server (codice o motivo) */
  ultimoErrore: string;
  /** saluti degli ospiti sul canale: chi si è collegato a QUESTA stanza */
  saluti: number;
  /** l'ultimo stato del canale («SUBSCRIBED», «CLOSED», …) */
  canale: string;
};

export const contatoriVuoti = (): ContatoriPreventivo => ({
  statoInviati: 0,
  scorriInviati: 0,
  statoRicevuti: 0,
  scorriRicevuti: 0,
  salvatiOk: 0,
  salvatiKo: 0,
  ultimoErrore: "",
  saluti: 0,
  canale: "",
});

export type RegolePreventivo = {
  /** in quale stanza scrive il consulente */
  stanza: "comune" | "personale" | "nessuna";
  /** la persona della stanza personale la vede? null = stanza comune */
  luiLoVede: boolean | null;
  /** quante persone hanno il loro preventivo acceso */
  personeAccese: number;
  /** questo contesto ha vinto l'elezione e trasmette lo stato */
  trasmette: boolean;
  /** lo scorrimento parte (falso in videochiamata) */
  scorre: boolean;
  videochiamata: boolean;
};

/** Le regole in una parola sola: serve a capire se sono cambiate. */
export const firmaRegole = (r: RegolePreventivo): string =>
  [r.stanza, r.luiLoVede, r.personeAccese, r.trasmette, r.scorre, r.videochiamata].join("|");

/** C'è qualcosa da scrivere? */
export function daScrivere(c: ContatoriPreventivo, regoleCambiate: boolean): boolean {
  return (
    regoleCambiate ||
    c.statoInviati + c.scorriInviati + c.statoRicevuti + c.scorriRicevuti + c.salvatiOk + c.salvatiKo + c.saluti > 0
  );
}

const si = (b: boolean) => (b ? "sì" : "no");

/** Una riga del diario. */
export function rigaPreventivo(r: RegolePreventivo, c: ContatoriPreventivo): string {
  const stanza =
    r.stanza === "personale"
      ? `stanza personale (${r.luiLoVede ? "lui la vede" : "lui NON la vede"})`
      : r.stanza === "comune"
        ? "stanza comune"
        : "nessuna stanza";
  const parti = [
    `preventivo · ${stanza}`,
    `accesi ${r.personeAccese}`,
    `canale ${c.canale || "?"}`,
    `trasmette ${si(r.trasmette)}`,
    `scorrimento ${r.scorre ? "sì" : r.videochiamata ? "no (videochiamata)" : "no"}`,
    `inviati stato ${c.statoInviati} scorri ${c.scorriInviati}`,
    `ricevuti stato ${c.statoRicevuti} scorri ${c.scorriRicevuti}`,
    `ospiti in ascolto ${c.saluti}`,
    `salvati ${c.salvatiOk}${c.salvatiKo ? ` falliti ${c.salvatiKo} (${c.ultimoErrore || "?"})` : ""}`,
  ];
  return parti.join(" · ").slice(0, 600);
}
