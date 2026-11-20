/** ── IL CANCELLO DI USCITA: «APRI LO SHOP AL PUBBLICO» ──────────────────────
 *  Commessa 2026-11-20-shop-completo (T09), PIANO D26 e SPEC §11b. Modulo PURO: nessun database, nessuna rete.
 *
 *  `condizioniUscita(stato)` dice, riga per riga, se lo shop si può aprire (`catalogo_sito` = `cms`). Il server accende
 *  l'interruttore SOLO se `puoAprire` è vero; tornare a `codice` è sempre permesso (non passa di qui).
 *  Una riga è `{ chiave, ok, valutabile, frase }`. Nel R1 si sanno valutare: ≥ 2 prodotti pubblicati con foto principale,
 *  nessun pubblicato senza foto principale, banner del consenso. Le altre dipendono dalla cassa (R2) e valgono «no» con
 *  `valutabile: false`: **in produzione il R1 non può aprire lo shop** (scelta dichiarata, D26). Il R2 passa i fatti che
 *  oggi mancano (`pagamentoIncassa`, `spedizioneResi`, `emailConferma`, `migrazioneOrdini`) e le righe si accendono. */

export interface StatoCancello {
  /** Prodotti con stato «pubblicato». */
  pubblicati?: unknown;
  /** Fra quelli, quanti hanno una foto principale che il pubblico vede (non rimossa, con liberatoria se c'è una persona). */
  conFotoPrincipale?: unknown;
  /** Il banner del consenso è nel sito. `null`/assente = non lo so. */
  bannerPresente?: boolean | null;
  /** Stripe incassa davvero (modalità reale, pagamento di prova rimborsato). */
  pagamentoIncassa?: boolean | null;
  /** Costo e tempi di spedizione impostati e resi scritti nelle pagine di servizio. */
  spedizioneResi?: boolean | null;
  /** L'email di conferma ordine parte davvero (partita su un ordine di prova). */
  emailConferma?: boolean | null;
  /** M2 applicata e registrazione libera dei nuovi utenti spenta. */
  migrazioneOrdini?: boolean | null;
}
export interface CondizioneUscita {
  chiave: string;
  ok: boolean;
  /** `false` = oggi non si sa verificare: la riga vale «no» e dice che si attiva col rilascio della cassa. */
  valutabile: boolean;
  frase: string;
}

/** Nell'ordine della SPEC §11b e del D26. */
export const CHIAVI_CONDIZIONI = ["catalogo_reale", "foto_vere", "pagamento", "spedizione_resi", "email_conferma", "banner_consenso", "migrazione_ordini"] as const;

const MINIMO_PRODOTTI = 2;
const conto = (x: unknown): number => (typeof x === "number" && Number.isSafeInteger(x) && x >= 0 ? x : 0);

/** Una condizione che dipende da un fatto esterno: vero, falso o non ancora valutabile (`null`). */
function esterna(chiave: string, fatto: boolean | null | undefined, vera: string, falsa: string, cosa: string): CondizioneUscita {
  if (typeof fatto !== "boolean") return { chiave, ok: false, valutabile: false, frase: `Si attiva col rilascio della cassa: ${cosa}.` };
  return { chiave, ok: fatto, valutabile: true, frase: fatto ? vera : falsa };
}

export function condizioniUscita(stato: unknown): { righe: CondizioneUscita[]; puoAprire: boolean } {
  const s: StatoCancello = typeof stato === "object" && stato !== null && !Array.isArray(stato) ? stato : {};
  const pubblicati = conto(s.pubblicati);
  // più foto che prodotti non può essere: nel dubbio non si conta nulla di più
  const conFoto = Math.min(conto(s.conFotoPrincipale), pubblicati);
  const senzaFoto = pubblicati - conFoto;
  const righe: CondizioneUscita[] = [
    {
      chiave: "catalogo_reale",
      ok: conFoto >= MINIMO_PRODOTTI,
      valutabile: true,
      frase: conFoto >= MINIMO_PRODOTTI
        ? `Ci sono ${conFoto} prodotti pubblicati con la foto principale.`
        : `Servono almeno ${MINIMO_PRODOTTI} prodotti pubblicati con la foto principale: ora ce ne sono ${conFoto}.`,
    },
    {
      chiave: "foto_vere",
      ok: senzaFoto === 0,
      valutabile: true,
      frase: senzaFoto === 0
        ? "Ogni prodotto pubblicato ha la foto principale."
        : `${senzaFoto === 1 ? "Un prodotto pubblicato non ha" : `${senzaFoto} prodotti pubblicati non hanno`} la foto principale: mettila o riporta il prodotto in bozza.`,
    },
    esterna("pagamento", s.pagamentoIncassa, "Il pagamento incassa (provato con un pagamento reale rimborsato).", "Il pagamento non incassa ancora: serve Stripe in modalità reale e un pagamento di prova rimborsato.", "il pagamento che incassa"),
    esterna("spedizione_resi", s.spedizioneResi, "Spedizioni e resi sono impostati e scritti.", "Mancano le spedizioni (costo e tempi) o i resi scritti nelle pagine di servizio.", "spedizioni e resi"),
    esterna("email_conferma", s.emailConferma, "L'email di conferma ordine parte.", "L'email di conferma ordine non è ancora partita su un ordine di prova.", "l'email di conferma ordine"),
    esterna("banner_consenso", s.bannerPresente, "Il banner dei cookie è attivo.", "Il banner dei cookie non è attivo: senza, lo shop non si apre.", "il banner dei cookie"),
    esterna("migrazione_ordini", s.migrazioneOrdini, "Gli ordini sono protetti (migrazione M2 applicata, iscrizioni libere chiuse).", "Gli ordini non sono ancora protetti: serve la migrazione M2 e le iscrizioni libere chiuse.", "la protezione degli ordini"),
  ];
  return { righe, puoAprire: righe.every((x) => x.valutabile && x.ok) };
}
