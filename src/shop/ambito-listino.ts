/** ─────────────────────────────────────────────────────────────────────────
 *  OGNI CONSULENTE HA IL SUO LISTINO
 *
 *  Richiesta del committente: «fai che tutte le modifiche del listino che
 *  faccio io come consulente si salvano al consulente, e gli altri consulenti
 *  hanno le loro modifiche — codici sconto, listino, eccetera».
 *
 *  COM'ERA
 *  Una riga sola per tutti (`app_config.key = 'quote_pricing'`). Due consulenti
 *  che ritoccavano i prezzi si sovrascrivevano a vicenda, e l'ultimo che
 *  salvava decideva le cifre che vedevano i clienti di entrambi. Non era un
 *  caso limite: bastava lavorare nello stesso pomeriggio.
 *
 *  COM'È ADESSO
 *  La riga porta l'id del consulente: `quote_pricing:<id>`. La riga SENZA id
 *  resta, e resta importante — è il listino di casa, quello da cui parte chi
 *  non ha ancora toccato niente:
 *
 *    leggere  →  la riga tua, se esiste; altrimenti quella di casa.
 *    scrivere →  sempre la tua (la prima volta nasce da quella che vedevi).
 *
 *  Così il giorno della pubblicazione non cambia niente per nessuno: finché un
 *  consulente non salva, continua a vendere col listino di casa. E chi entra
 *  con le chiavi di casa (il codice consulente generale, o l'accesso del
 *  proprietario) modifica proprio quella riga lì: è il listino che vale per
 *  tutti quelli che non ne hanno uno loro.
 *
 *  ⚠️ IL CLIENTE DEVE VEDERE IL LISTINO DI CHI LO STA SEGUENDO, e il cliente
 *   non sa chi è il suo consulente: sa solo il codice della sua consulenza. La
 *   traduzione da codice a consulente la fa il server (`crm/listino-di-chi`),
 *   leggendo chi conduce quella consulenza. Se non riesce a dirlo — il link
 *   aperto prima che la consulenza sia avviata — vale il listino di casa, e la
 *   pagina richiede i prezzi quando il consulente entra: un cliente che legge
 *   389 mentre il consulente dice 589 è il guasto peggiore di tutta questa
 *   faccenda, e va reso impossibile, non improbabile.
 *  ───────────────────────────────────────────────────────────────────────── */

import { chiaveSessione, codiceChiave } from "./chiave-sessione";

/** Le righe di `app_config` che da oggi hanno una versione per consulente.
 *  Stanno qui insieme perché sono tutte «cose del listino», e chi ne aggiunge
 *  una deve vedere subito che va aggiunta anche alla copia iniziale. */
export const BASE_LISTINO = "quote_pricing";
export const BASE_QUANTITA = "qty_discounts";
export const BASE_PROMO = "promo_days";
/** ⚠️ Deve restare uguale a `CHIAVE_GARANZIE` di shop/garanzia-codici: è la
 *  stessa riga vista da due punti, e due nomi diversi vorrebbero dire una
 *  garanzia salvata in un posto e letta da un altro. */
export const BASE_GARANZIE = "garanzia_codici";
/** Di chi è ogni codice sconto. Sta in una riga a parte perché la tabella
 *  `discount_codes` non ha una colonna per il proprietario, e aggiungerla
 *  vorrebbe dire una modifica allo schema in mezzo a una giornata di lavoro. */
export const BASE_PROPRIETARI = "coupons_owner";

/** ── ⚠️ DI CHI È UNA CONSULENZA, ANCHE QUANDO NON È PIÙ VIVA ─────────────
 *  Segnalazione del committente: «quando apro il preventivo a me mostra il
 *  prezzo nuovo che ho impostato e al cliente ne mostra un altro».
 *
 *  Il cliente manda il codice della sua consulenza e il server traduce codice →
 *  consulente per sapere QUALE listino servirgli. Quella traduzione leggeva una
 *  cosa sola: la riga della sessione VIVA (`session_live:<codice>`). Ma quella
 *  riga:
 *   · non esiste affatto se il consulente ha mandato il solo link del
 *     preventivo senza avviare la videochiamata — che è il modo normale di
 *     lavorare, e il link stesso dice «non serve la videochiamata»;
 *   · viene AZZERATA alla chiusura della consulenza (`presenterId: ""`), quindi
 *     appena il consulente chiude, la pagina del cliente — che ricontrolla i
 *     prezzi ogni venti secondi — ricade sul listino di casa e le cifre gli
 *     cambiano sotto gli occhi.
 *  In tutti e due i casi il consulente vede il suo listino e il cliente un
 *  altro: è il guasto peggiore di questa faccenda, ed è successo.
 *
 *  Qui si tiene la traduzione in una riga che NON muore con la chiamata:
 *  `sessione_di:<codice>` → id del consulente, scritta quando il codice nasce.
 *  ⚠️ Non sostituisce la sessione viva, la SEGUE: se la sessione è viva e dice
 *   chi conduce, comanda lei — un codice può essere ripreso da un collega, e
 *   chi sta conducendo adesso conta più di chi l'ha aperto ieri. */
export const BASE_SESSIONE_DI = "sessione_di";

/** L'id del consulente ridotto a ciò che può stare in una chiave.
 *  ⚠️ Non è pignoleria: l'id arriva da un cookie o da un indirizzo, cioè da
 *   fuori, e finisce dentro una chiave di database. */
export const idAmbito = (id: unknown): string => codiceChiave(id);

/** La chiave di una riga del listino per QUESTO consulente. Senza consulente
 *  torna la riga di casa — la stessa di prima, che resta il punto di partenza
 *  di tutti. È la stessa regola delle chiavi di sessione, scritta una volta
 *  sola: `base` da solo, oppure `base:<id>`. */
export const chiaveAmbito = (base: string, consulente: unknown): string =>
  chiaveSessione(base, consulente);

/** ── DI CHI È QUESTO CODICE SCONTO ────────────────────────────────────────
 *  Un codice senza proprietario è di casa: lo vedono e lo possono usare tutti.
 *  È il ripiego giusto, perché tutti i codici esistenti oggi non hanno un
 *  proprietario e nessuno deve perderli.
 *  Un codice con proprietario lo vede solo lui. */
export const codiceSuo = (proprietario: unknown, consulente: unknown): boolean => {
  const p = idAmbito(proprietario);
  if (!p) return true;                       // di casa: di tutti
  return p === idAmbito(consulente);
};

/** I codici che questo consulente deve vedere, dato l'elenco completo e la
 *  mappa «codice → proprietario».
 *  ⚠️ Il confronto sul codice è senza maiuscole: i codici si scrivono a mano,
 *   e «ESTATE10» e «estate10» sono lo stesso codice per chiunque tranne che
 *   per un confronto fatto male. */
export function codiciVisibili<T extends { code?: string | null }>(
  codici: T[],
  proprietari: Record<string, string>,
  consulente: unknown,
): T[] {
  const mappa = new Map(Object.entries(proprietari).map(([k, v]) => [k.trim().toLowerCase(), v]));
  return codici.filter((c) => codiceSuo(mappa.get(String(c.code ?? "").trim().toLowerCase()), consulente));
}

/** Chi tocca un codice deve poterlo toccare: il suo, oppure uno di casa.
 *  È la stessa domanda di `codiceSuo`, con un nome che dice cosa si sta per
 *  fare — cancellare il codice di un collega è un errore che non si vede
 *  finché non serve quel codice. */
export const puoToccareIlCodice = codiceSuo;
