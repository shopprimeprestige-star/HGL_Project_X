/** ── IL CANCELLO DI USCITA: «APRI LO SHOP AL PUBBLICO» ──────────────────────
 *  Commessa 2026-11-20-shop-completo (T09), PIANO D26 e SPEC §11b. Modulo PURO: nessun database, nessuna rete.
 *
 *  `condizioniUscita(stato)` dice, riga per riga, se lo shop si può aprire (`catalogo_sito` = `cms`). Il server accende
 *  l'interruttore SOLO se `puoAprire` è vero; tornare a `codice` è sempre permesso (non passa di qui).
 *  Una riga è `{ chiave, ok, valutabile, frase }`. Nel R1 si sanno valutare: ≥ 2 prodotti pubblicati con foto principale,
 *  nessun pubblicato senza foto principale, banner del consenso. Le altre dipendono dalla cassa (R2) e valgono «no» con
 *  `valutabile: false`: **in produzione il R1 non può aprire lo shop** (scelta dichiarata, D26). Il R2 passa i fatti che
 *  oggi mancano (`pagamentoIncassa`, `spedizioneResi`, `emailConferma`, `migrazioneOrdini`) e le righe si accendono.
 *
 *  ── RILASCIO 2 (T56, PIANO-R2 D56) ──────────────────────────────────────────
 *  · Le tre righe «pagamento», «spedizione_resi», «email_conferma» escono da «non valutabile» solo quando il fatto è
 *    passato (`fatti.server.ts`); se non è passato restano com'erano in R1.
 *  · `migrazioneOrdini` NON lo passa nessuno: la M2 la applica il titolare a mano e l'app non sa se «le iscrizioni libere sono
 *    chiuse». Quindi `puoAprire` resta falso: nel R2 lo shop non si apre da solo (si apre il titolare, a mano, a fine collaudo).
 *  · `condizioniCassa(fatti)` (in fondo): le quattro precondizioni per accendere `cassa_sito = "stripe"`, una frase ciascuna. */

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
/** I fatti che servono per accendere la cassa Stripe (D56): solo «presente / assente», mai i valori delle variabili. */
export interface FattiCassa {
  /** La chiave segreta di Stripe è nell'ambiente del server. */
  chiavePresente?: boolean | null;
  /** Il segreto del webhook è nell'ambiente del server. */
  segretoPresente?: boolean | null;
  /** Esiste una tariffa di spedizione attiva per l'Italia. */
  tariffaAttiva?: boolean | null;
  /** La migrazione S4 (pagamenti) è applicata. */
  s4Presente?: boolean | null;
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

/* ══ LA CASSA STRIPE: LE QUATTRO PRECONDIZIONI (D56) ════════════════════════ */

export const CHIAVI_CONDIZIONI_CASSA = ["chiave_stripe", "segreto_webhook", "tariffa", "migrazione_pagamenti"] as const;
export interface CondizioneCassa {
  chiave: string;
  ok: boolean;
  frase: string;
}

/** Una precondizione: vera solo se il fatto è proprio `true` (un fatto assente, nullo o storto vale «no»: nel dubbio la cassa non si accende). */
const cond = (chiave: string, fatto: unknown, vera: string, falsa: string): CondizioneCassa => ({ chiave, ok: fatto === true, frase: fatto === true ? vera : falsa });

/** Si può accendere `cassa_sito = "stripe"`? Chiave, segreto del webhook, tariffa attiva, migrazione S4. `vecchia` non passa di qui. */
export function condizioniCassa(fatti: unknown): { righe: CondizioneCassa[]; puoAccendere: boolean } {
  const f: FattiCassa = typeof fatti === "object" && fatti !== null && !Array.isArray(fatti) ? fatti : {};
  const righe = [
    cond("chiave_stripe", f.chiavePresente, "La chiave di Stripe è collegata.", "Manca la chiave di Stripe: va messa fra le variabili del sito prima di accendere la cassa."),
    cond("segreto_webhook", f.segretoPresente, "Il segreto del webhook di Stripe è collegato.", "Manca il segreto del webhook di Stripe: senza, i pagamenti non si registrano."),
    cond("tariffa", f.tariffaAttiva, "C'è una tariffa di spedizione attiva.", "Manca una tariffa di spedizione attiva: impostala nella scheda Spedizioni."),
    cond("migrazione_pagamenti", f.s4Presente, "Il database dei pagamenti è aggiornato.", "Manca l'aggiornamento del database dei pagamenti (migrazione S4): chiedi a chi gestisce il database di applicarlo."),
  ];
  return { righe, puoAccendere: righe.every((x) => x.ok) };
}
