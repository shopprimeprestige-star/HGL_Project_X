/** ── NEGOZIO · T06 · I TESTI: COSA NON SI PUÒ SCRIVERE E COSA SI SCONSIGLIA ──
 *  `src/shop/cms/testi.ts`: `controllaTesto(testo)` → `{ bloccanti, avvisi }`.
 *  Bloccante (SPEC §4 n. 10): una cifra o un «€» entro 40 segni da «Invisible Derm»; «sconto del», «risparmi»,
 *  «prezzo barrato». Avviso: le parole da non usare (Copywriter §3.5.1), con la frase esatta del piano.
 *  Dati inventati. */

export async function prove(mod, { c, gruppo }) {
  const T = mod["shop/cms/testi"];
  gruppo("NEGOZIO · I TESTI: BLOCCHI E PAROLE DA NON USARE (20/11/2026)");
  const blocchi = (t) => T.controllaTesto(t).bloccanti.length;
  const parole = (t) => T.controllaTesto(t).avvisi.map((a) => a.parola);

  // ── Invisible Derm: nessuna cifra ──
  c("«Invisible Derm da 3.900 €» → bloccante", 1, blocchi("Invisible Derm da 3.900 €"));
  c("«Invisible Derm, su misura» → nessun blocco", 0, blocchi("Invisible Derm, su misura"));
  c("una cifra prima del nome (entro 40 segni) → bloccante", 1, blocchi("Costa 3900 e si chiama Invisible Derm Protocol"));
  c("il simbolo «€» da solo, senza cifre → bloccante", 1, blocchi("Invisible Derm costa tanti €"));
  c("maiuscole e spazi doppi non cambiano niente", 1, blocchi("INVISIBLE   DERM 2 sedute"));
  c("«Invisible Derm Protocol®» senza cifre → nessun blocco", 0, blocchi("Si chiama Invisible Derm Protocol®: un sistema su misura."));
  c("una cifra lontana (oltre 40 segni) non blocca", 0, blocchi(`Invisible Derm ${"è un sistema su misura ".repeat(3)}e il codice è 123`));
  c("la cifra a 40 segni esatti blocca, a 41 no", [1, 0], [blocchi(`Invisible Derm${"x".repeat(39)}1`), blocchi(`Invisible Derm${"x".repeat(40)}1`)]);
  c("una cifra senza «Invisible Derm» è libera (un prezzo di un prodotto)", 0, blocchi("Flacone da 100 ml, 28,90 €"));
  c("più occorrenze: basta una cifra vicina a una", 1, blocchi(`Invisible Derm è su misura. ${"Parole. ".repeat(10)}Poi Invisible Derm a 3900.`));
  const f = T.controllaTesto("Invisible Derm da 3.900 €").bloccanti[0];
  c("il blocco ha una frase per il titolare, in italiano", true, typeof f.frase === "string" && f.frase.length > 20 && /Invisible Derm/.test(f.frase));

  // ── sconti e risparmi ──
  c("«sconto del 20%» → bloccante", 1, blocchi("Oggi sconto del 20% su tutto"));
  c("«Sconto della» e maiuscole → bloccante", 1, blocchi("SCONTO DELLA settimana"));
  c("«risparmi» → bloccante", 1, blocchi("Con questo kit risparmi tempo e denaro"));
  c("«prezzo barrato» → bloccante", 1, blocchi("Mostra il prezzo barrato"));
  c("«risparmio» e «scontrino» non sono «sconto del» né «risparmi»", 0, blocchi("Un risparmio di tempo; conserva lo scontrino"));
  c("un testo pulito → nessun blocco, nessun avviso", [[], []], ((r) => [r.bloccanti, r.avvisi])(T.controllaTesto("Si spruzza sui capelli della patch, a patch asciutta, prima di pettinare.")));

  // ── parole da non usare (avvisi) ──
  const elenco = {
    invisibile: "Una patch invisibile", garantito: "Risultato garantito", premium: "Qualità premium",
    "cura la calvizie": "Cura la calvizie", ricrescita: "Aiuta la ricrescita", "riduce la caduta": "Riduce la caduta",
    definitivo: "Un metodo definitivo", Remy: "Capelli Remy", europei: "Capelli europei",
    indistinguibile: "Una patch indistinguibile", "best seller": "Il nostro best seller", "più venduto": "Il più venduto del mese",
  };
  for (const [parola, testo] of Object.entries(elenco)) c(`avviso per «${parola}»`, [parola.toLowerCase()], parole(testo).map((p) => p.toLowerCase()));
  c("il messaggio è quello del piano, parola per parola", "Il testo contiene “invisibile”: è una parola da non usare. Controlla.", T.controllaTesto("Una patch invisibile").avvisi[0].frase);
  c("maiuscole: «INVISIBILE» avvisa e riporta come è scritta", ["INVISIBILE"], parole("Una patch INVISIBILE"));
  c("femminile e plurale: «garantita», «invisibili»", ["garantita", "invisibili"], parole("Patch garantita, forme invisibili"));
  c("«cura la calvizie» con spazi doppi", 1, T.controllaTesto("Cura  la   calvizie").avvisi.length);
  c("«Invisible Derm» (il nome del sistema) NON è «invisibile»", [], parole("Invisible Derm Protocol®: un sistema su misura"));
  c("«invisibilmente» e «premiumizzare» non sono le parole da non usare (parola intera)", [], parole("Si fissa invisibilmente"));
  c("«definitivamente» non è «definitivo»", [], parole("Si risolve definitivamente"));
  c("«la cura» da sola, «ricrescere» da solo: nessun avviso", [], parole("La cura del cuoio capelluto; i capelli possono ricrescere"));
  c("ogni occorrenza ha la sua posizione (per sottolinearla nel testo)", [{ parola: "premium", da: 6, a: 13 }, { parola: "premium", da: 16, a: 23 }],
    T.controllaTesto("Linea premium e premium").avvisi.map(({ parola, da, a }) => ({ parola, da, a })));
  c("testo vuoto, spazi, o non testo → niente, senza errori", [[], [], [], []], [T.controllaTesto("").avvisi, T.controllaTesto("   ").avvisi, T.controllaTesto(null).avvisi, T.controllaTesto(undefined).bloccanti]);
  const r = T.controllaTesto("Invisible Derm 3900 invisibile");
  c("blocchi e avvisi insieme: i due elenchi sono separati", [1, 1], [r.bloccanti.length, r.avvisi.length]);
  c("«best  seller» (due spazi) e «best-seller» avvisano", [["best  seller"], ["best-seller"]], ["Il best  seller", "Il best-seller"].map((t) => parole(t)));
  c("«più venduta», «piu venduti» (senza accento), «PIÙ VENDUTO»: avviso", [["più venduta"], ["piu venduti"], ["PIÙ VENDUTO"]], ["La più venduta", "I piu venduti", "IL PIÙ VENDUTO"].map((t) => parole(t)));
  c("«venduto» da solo o «più» da solo: nessun avviso", [], parole("Un prodotto venduto in tutta Italia, più morbido"));
  c("le parole vietate sono le undici del piano più «più venduto»", ["invisibile", "garantito", "premium", "cura la calvizie", "ricrescita", "riduce la caduta", "definitivo", "Remy", "europei", "indistinguibile", "best seller", "più venduto"], [...T.PAROLE_DA_NON_USARE]);
}
