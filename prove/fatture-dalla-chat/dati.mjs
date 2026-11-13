/** ── DATI INVENTATI PER LE PROVE DI «FATTURE DALLA CHAT» ───────────────────
 *  ⚠️ Nomi di fantasia, id finti. Mai un numero, un CF o un indirizzo vero in
 *   nessuna prova di questa cartella. Lo stesso spirito di prove/fatture-bulk/dati.mjs,
 *   ma qui gli id delle righe sono UUID di scheda (`crm_leads`), non indici-di-file. */

/** Un lotto di prova (la forma è quella di `lottoValido`, condivisa con la bulk). */
export const LOTTO_PROVA = "lotto-0123abcd";

/** Due schede di fantasia, UUID v4 validi (forma attesa da `schedaIdValido`/`idRigaValido`). */
export const SCHEDA_PROVA = "3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5f";
export const SCHEDA_PROVA_ALTRA = "a1b2c3d4-e5f6-4789-9abc-def012345678";

/** Id non validi, nelle stesse forme che la bulk prova già per `lottoValido`:
 *  mai una stringa che possa finire in un LIKE o rompere una chiave. */
export const ID_NON_VALIDI = [
  "",
  "3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5f:extra",
  "3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5f%",
  "3f2a9c1e_77b0_4c1d_9d2e_0a1b2c3d4e5f",
  "non-un-uuid",
  "3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5", // una cifra in meno
  "../../etc/passwd",
  "  3f2a9c1e-77b0-4c1d-9d2e-0a1b2c3d4e5f  ",
];
