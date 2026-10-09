/** ── LA GARANZIA, CODICE PER CODICE ────────────────────────────────────────
 *
 *  Il riquadro «Il tuo impianto resta seguito da noi» — quello dei 450 € per
 *  una rigenerazione o una sostituzione — non è più uguale per tutti: ogni
 *  codice promozionale può decidere se mostrarlo e a che cifra.
 *
 *  ── ⚠️ PERCHÉ IN `app_config` E NON IN UNA COLONNA ────────────────────────
 *  Perché aggiungere due colonne a `discount_codes` vuol dire una migrazione su
 *  un database di produzione, e `supabase db push` applica tutte le migrazioni
 *  in sospeso — non solo la propria. Su un archivio con dentro le vendite di
 *  un'azienda non è una cosa da fare di iniziativa propria. La forma dei dati è
 *  già quella giusta: il giorno in cui si vogliono due colonne, a spostarli
 *  bastano una lettura e una scrittura.
 *
 *  ── UNA CHIAVE SOLA, NON UNA PER CODICE ───────────────────────────────────
 *  `garanzia_codici` contiene la mappa intera. Con una chiave per codice
 *  servirebbe una lettura per ogni codice applicato — e il configuratore ne
 *  applica anche tre insieme — mentre così si legge una volta e si tiene.
 *
 *  ⚠️ NIENTE QUI DENTRO DECIDE COSA SI VEDE: si legge una configurazione e si
 *   risponde a una domanda. Chi disegna è routes/preventivo, che è anche
 *   l'unico posto in cui la regola «se nessun codice dice niente, vale il
 *   listino» ha senso.
 *  ───────────────────────────────────────────────────────────────────────── */

export interface GaranziaCodice {
  /** false = su questo preventivo il riquadro della garanzia non compare */
  mostra: boolean;
  /** Il prezzo FISSO dal secondo impianto in poi. 0 = non è questo il modo. */
  importo: number;
  /** ── OPPURE UNA PERCENTUALE, CHE È L'ALTRO MODO ───────────────────────
   *  Richiesta del committente: «dove posso scegliere o % di sconto su importo
   *  oppure prezzo fisso».
   *  I due campi convivono nella riga ma non nel significato: se c'è la
   *  percentuale comanda lei (vedi `tipoOfferta`). Tenerne uno solo avrebbe
   *  voluto dire convertire la percentuale in euro al momento di salvare — e
   *  allora un preventivo da 800 e uno da 1.200 avrebbero avuto lo stesso
   *  sconto in cifra, che non è quello che «meno 30%» vuol dire. */
  sconto?: number;
  /*  ── ⚠️ E QUANTO È LIMITATA, che è ciò che la rende un'offerta ─────────
      Richiesta del committente: «posso impostare importo fisso sulla garanzia
      15 mesi e dice esplicitamente poi sulla garanzia che è limitata con i
      posti e data».
      Un prezzo più basso senza un limite non è una promozione: è il nuovo
      listino, e chi legge lo capisce benissimo — «se costa così oggi costerà
      così anche fra un mese». I due limiti sono quelli che chiunque riconosce
      come veri perché sono verificabili: quanti posti restano, ed entro quando.
      ⚠️ TUTTI E DUE FACOLTATIVI, e uno solo basta: un'offerta può essere «solo
       per i primi cinque» senza scadenza, o «fino a domenica» senza posti.
       Nessuno dei due = il prezzo c'è ma non si promette niente di limitato,
       e allora NON si scrive che è limitata. Scriverlo senza un numero da
       mostrare è la cosa che fa perdere fiducia più in fretta di tutte. */
  /** Quanti posti restano a questo prezzo. `null`/assente = nessun limite. */
  posti?: number | null;
  /** Quanti erano in tutto: serve a scrivere «3 di 10», che è più credibile
   *  di «3» perché dice anche quanti ne sono già andati. */
  postiTotali?: number | null;
  /** Ultimo giorno valido (YYYY-MM-DD). Assente = nessuna scadenza. */
  scadenza?: string;
  /** ── ⚠️ OPPURE QUANTI GIORNI DURA, CHE NON È LA STESSA COSA ───────────
   *  Richiesta del committente: «posso mettere entro quanti giorni scade e poi
   *  dà la data, in dinamico ogni giorno mette data dinamica; ma quando il
   *  preventivo è creato rimane su quel preventivo la data che è stata
   *  inserita nel giorno che è stato generato».
   *  È la differenza fra una promozione che invecchia e una che vive: con una
   *  data fissa, il 6 ottobre l'offerta è morta per tutti e bisogna ricordarsi
   *  di spostarla; con i giorni, ogni preventivo nasce con la SUA scadenza —
   *  «sette giorni da oggi» — e resta quella per sempre su quel documento.
   *  ⚠️ Vince sui giorni fissi quando c'è: due modi di dire la stessa cosa
   *   devono avere un ordine, o due schermate rispondono in modo diverso. */
  giorni?: number;
  /** Come si chiama l'offerta sul riquadro. Vuoto = una frase di casa. */
  titolo?: string;
}

export type MappaGaranzie = Record<string, GaranziaCodice>;

export const CHIAVE_GARANZIE = "garanzia_codici";

/** Legge la mappa da una stringa JSON, difendendosi da tutto: la scrive un
 *  modulo, la rilegge un altro, e in mezzo c'è un campo di testo di un
 *  database. Una riga illeggibile non deve far sparire il riquadro a tutti. */
export function leggiMappa(grezzo: string | null | undefined): MappaGaranzie {
  if (!grezzo) return {};
  try {
    const v = JSON.parse(grezzo) as Record<string, unknown>;
    if (!v || typeof v !== "object") return {};
    const out: MappaGaranzie = {};
    for (const [codice, g] of Object.entries(v)) {
      if (!g || typeof g !== "object") continue;
      const o = g as { mostra?: unknown; importo?: unknown };
      const posti = Number((o as { posti?: unknown }).posti);
      const postiTotali = Number((o as { postiTotali?: unknown }).postiTotali);
      const scadenza = String((o as { scadenza?: unknown }).scadenza ?? "").slice(0, 10);
      const titolo = String((o as { titolo?: unknown }).titolo ?? "").trim().slice(0, 80);
      out[codice.toUpperCase()] = {
        //  ⚠️ Il valore di ripiego è `true`: una configurazione scritta male non
        //   deve NASCONDERE la garanzia. Nasconderla vuol dire togliere dal
        //   preventivo una cosa che il cliente si aspetta di leggere, e non se
        //   ne accorgerebbe nessuno finché non la chiede al telefono.
        mostra: o.mostra !== false,
        importo: Math.max(0, Number(o.importo) || 0),
        //  ⚠️ La percentuale si rilegge come tutto il resto: senza questa riga
        //   un codice «−30%» tornava dall'archivio senza il suo 30, e il
        //   preventivo lo trattava come se non avesse nessuna offerta.
        ...(Number.isFinite(Number((o as { sconto?: unknown }).sconto)) &&
        Number((o as { sconto?: unknown }).sconto) > 0
          ? { sconto: Math.min(100, Math.round(Number((o as { sconto?: unknown }).sconto))) }
          : {}),
        //  ⚠️ Un numero illeggibile diventa «nessun limite», non «zero posti»:
        //   zero posti spegnerebbe l'offerta per un carattere storto.
        ...(Number.isFinite(posti) && posti >= 0 ? { posti: Math.round(posti) } : {}),
        ...(Number.isFinite(postiTotali) && postiTotali > 0 ? { postiTotali: Math.round(postiTotali) } : {}),
        ...(/^\d{4}-\d{2}-\d{2}$/.test(scadenza) ? { scadenza } : {}),
        ...(Number.isFinite(Number((o as { giorni?: unknown }).giorni)) &&
        Number((o as { giorni?: unknown }).giorni) > 0
          ? { giorni: Math.round(Number((o as { giorni?: unknown }).giorni)) }
          : {}),
        ...(titolo ? { titolo } : {}),
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** ── QUALE CODICE DECIDE, QUANDO SONO PIÙ D'UNO ───────────────────────────
 *  Il primo dei codici applicati che ha una configurazione, nell'ordine in cui
 *  sono stati applicati.
 *
 *  ⚠️ SERVE UNA REGOLA, E DEVE ESSERE UNA SOLA. Su un preventivo possono
 *   convivere un codice automatico e uno battuto a mano: senza un criterio, il
 *   riquadro comparirebbe o no a seconda dell'ordine in cui il browser ha
 *   restituito due elenchi — cioè a caso, e in modo non riproducibile quando
 *   qualcuno chiede «perché a lui è uscito e a me no».
 *  «Il primo» è la regola più facile da spiegare a voce e l'unica che chi
 *  configura può controllare: si mette per primo il codice che comanda.
 *
 *  `null` = nessun codice dice niente, e allora vale il listino. */
export function garanziaDa(codici: string[], mappa: MappaGaranzie): GaranziaCodice | null {
  for (const c of codici) {
    const g = mappa[String(c ?? "").toUpperCase()];
    if (g) return g;
  }
  return null;
}
