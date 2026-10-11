/** ── QUANDO IL MODO IN CUI HAI PAGATO CAMBIA LE TASSE ──────────────────────
 *
 *  Richiesta del committente, e la domanda era quella giusta: «se non serve
 *  per legge non chiedermelo». Infatti quasi mai serve. Per la stragrande
 *  maggioranza dei costi di una società il metodo di pagamento non tocca
 *  niente — un bonifico e dei contanti scaricano uguale, e chiederlo a ogni
 *  fattura sarebbe un campo in più da compilare cento volte per non usarlo
 *  mai. Chiederlo dove NON serve, poi, fa un danno peggiore che non chiederlo:
 *  insegna a rispondere a caso, e quando la domanda arriva sul carburante —
 *  dove serve davvero — ci si risponde con la stessa distrazione.
 *
 *  ── I DUE CASI IN CUI SERVE DAVVERO ───────────────────────────────────────
 *
 *  1. CARBURANTI E LUBRIFICANTI PER AUTOTRAZIONE. Dal 1° luglio 2018 il costo
 *     si deduce e l'IVA si detrae SOLO se pagati con mezzi tracciabili: carta
 *     di credito, di debito, prepagata, assegno, bonifico. In contanti non si
 *     deduce e non si detrae niente — zero, non una percentuale.
 *     art. 164 c. 1-bis TUIR · art. 19-bis1 c. 1 lett. d) DPR 633/72.
 *
 *  2. TRASFERTE E RAPPRESENTANZA. Dal 1° gennaio 2025 vitto, alloggio,
 *     viaggio e trasporto con taxi o noleggio con conducente sostenuti in
 *     trasferta, i rimborsi analitici ai dipendenti e le spese di
 *     rappresentanza si deducono solo se pagati con mezzi tracciabili.
 *     L. 207/2024 art. 1 commi 81-83.
 *
 *  ── ⚠️ E LE ALTRE REGOLE CHE ASSOMIGLIANO A QUESTA, MA NON C'ENTRANO ──────
 *   · Le detrazioni IRPEF al 19% (mediche, sportive, veterinarie) vogliono il
 *     pagamento tracciato, ma sono la dichiarazione di una PERSONA: una
 *     S.r.l.s. paga IRES, e qui non c'entrano niente.
 *   · Il tetto al contante — 5.000 € dal 2023 — è una regola ANTIRICICLAGGIO:
 *     violarla è una sanzione amministrativa, non una perdita di deducibilità.
 *     Il costo resta deducibile. Sono due cose diverse e vanno tenute diverse,
 *     altrimenti si finisce per credere che sotto i 5.000 € vada sempre bene —
 *     e sul carburante non va bene mai.
 *
 *  ── ⚠️ QUESTO MODULO NON INDOVINA, PROPONE ────────────────────────────────
 *  Riconoscere «carburante» dal nome del fornitore e dalle righe è un
 *  indizio, non una prova: un distributore vende anche caffè e autostrada.
 *  Quindi la domanda COMPARE, con scritto perché; la risposta la dà chi
 *  carica, e può anche dire che non è carburante.
 *  ───────────────────────────────────────────────────────────────────────── */

export type MetodoPagamento = "bonifico" | "carta" | "assegno" | "contanti" | "altro";

export const METODI: {
  chiave: MetodoPagamento;
  titolo: string;
  tracciato: boolean;
  nota: string;
}[] = [
  { chiave: "bonifico", titolo: "Bonifico", tracciato: true, nota: "Tracciato" },
  {
    chiave: "carta",
    titolo: "Carta",
    tracciato: true,
    nota: "Credito, debito o prepagata: tracciata",
  },
  { chiave: "assegno", titolo: "Assegno", tracciato: true, nota: "Tracciato" },
  {
    chiave: "contanti",
    titolo: "Contanti",
    tracciato: false,
    nota: "Su queste spese fa perdere la deduzione e la detrazione",
  },
  {
    chiave: "altro",
    titolo: "Altro",
    tracciato: false,
    nota: "Non sappiamo se è tracciato: qui vale come se non lo fosse",
  },
];

export const tracciato = (m?: MetodoPagamento | null): boolean =>
  METODI.find((x) => x.chiave === m)?.tracciato === true;

/** Le due famiglie di spesa per cui la legge guarda come hai pagato. */
export type CategoriaTracciata = "carburante" | "trasferta";

const PAROLE: Record<CategoriaTracciata, RegExp> = {
  //  ⚠️ «gasolio» e «benzina» ci stanno, «gas» no: il gas del contatore non è
  //   carburante per autotrazione, e la parola è dentro «gasolio» — un
  //   confine sbagliato qui accenderebbe la domanda su tutte le bollette.
  carburante:
    /\b(carburant\w*|benzin\w*|gasoli\w*|rifornimento|distributore|eni|q8|tamoil|esso|ip\s|agip|shell|erg|carta\s*carburante)\b/i,
  trasferta:
    /\b(hotel|albergo|b&b|ristorant\w*|pranzo|cena|trattoria|pizzeria|taxi|ncc|noleggio\s*con\s*conducente|trasfert\w*|rappresentanz\w*|catering|bar\b)\b/i,
};

const PERCHE: Record<CategoriaTracciata, string> = {
  carburante:
    "Sul carburante il costo si deduce e l'IVA si detrae solo se hai pagato con carta, bonifico o assegno. In contanti non si scarica niente.",
  trasferta:
    "Dal 2025 vitto, alloggio, taxi e rappresentanza si deducono solo se pagati con mezzi tracciabili.",
};

/** ── SERVE CHIEDERE COME È STATA PAGATA? ──────────────────────────────────
 *  Le si dà tutto il testo che si ha — nome del fornitore, righe, note — e
 *  risponde una volta sola. Se torna `serve: false` la finestra non mostra
 *  nessun campo: è il caso normale. */
export function serveIlMetodo(...testi: (string | null | undefined)[]): {
  serve: boolean;
  categoria?: CategoriaTracciata;
  perche: string;
} {
  const testo = testi.filter(Boolean).join(" ");
  if (!testo.trim()) return { serve: false, perche: "" };
  for (const c of ["carburante", "trasferta"] as CategoriaTracciata[]) {
    if (PAROLE[c].test(testo)) return { serve: true, categoria: c, perche: PERCHE[c] };
  }
  return { serve: false, perche: "" };
}

/** ── ⚠️ IL COSTO È BLOCCATO DALLA LEGGE? ──────────────────────────────────
 *  Torna la FRASE del blocco, o stringa vuota. Chi la riceve non deduce quel
 *  costo e non ne detrae l'IVA, e la scrive accanto alla riga: un costo che
 *  sparisce dai deducibili senza dire perché è peggio di uno contato male,
 *  perché non si può correggere.
 *
 *  ⚠️ VALE SOLO SE QUALCUNO HA DETTO COME HA PAGATO. Una fattura vecchia, o
 *   una su cui la domanda non è mai comparsa, non ha un metodo scritto: lì non
 *   si blocca niente. Dedurre da un campo VUOTO che il pagamento non fosse
 *   tracciato vorrebbe dire togliere di colpo la deduzione a tutto lo storico,
 *   sulla base di un dato che non è mai stato chiesto. */
export function bloccoDiLegge(
  metodo: MetodoPagamento | null | undefined,
  ...testi: (string | null | undefined)[]
): string {
  if (!metodo || tracciato(metodo)) return "";
  const q = serveIlMetodo(...testi);
  if (!q.serve || !q.categoria) return "";
  return q.categoria === "carburante"
    ? "Carburante pagato in contanti: per legge non si deduce e non si detrae."
    : "Trasferta o rappresentanza pagata in contanti: dal 2025 non si deduce.";
}
