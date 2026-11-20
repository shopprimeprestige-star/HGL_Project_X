/** ── NEGOZIO · T06 · LA GIACENZA: MAI SOTTO ZERO ───────────────────────────
 *  `src/shop/cms/giacenza.ts`: `applicaMovimento(attuale, delta)`, `statoDisponibilita(giacenza, attiva)`,
 *  `giacenzaBassa(giacenza, soglia)`. Pure. Il pubblico vede solo «disponibile» o «esaurito», mai un numero.
 *  Dati inventati. */

export async function prove(mod, { c, gruppo }) {
  const G = mod["shop/cms/giacenza"];
  gruppo("NEGOZIO · LA GIACENZA NON VA SOTTO ZERO (20/11/2026)");

  // ── applicaMovimento ──
  c("giacenza 3 con delta −4 → rifiutato (motivo giacenza_negativa)", [false, "giacenza_negativa"], ((r) => [r.ok, r.motivo])(G.applicaMovimento(3, -4)));
  c("…e la frase dice quanti ce ne sono e quanti se ne chiedono", [true, true], ((f) => [/\b3\b/.test(f), /\b4\b/.test(f)])(G.applicaMovimento(3, -4).frase));
  c("giacenza 3 con delta −3 → 0", { ok: true, giacenza: 0 }, G.applicaMovimento(3, -3));
  c("giacenza 3 con delta −1 → 2", { ok: true, giacenza: 2 }, G.applicaMovimento(3, -1));
  c("giacenza 0 con delta +10 → 10 (un carico)", { ok: true, giacenza: 10 }, G.applicaMovimento(0, 10));
  c("giacenza 0 con delta −1 → rifiutato", false, G.applicaMovimento(0, -1).ok);
  c("delta zero → rifiutato (movimento_nullo), la giacenza non cambia", [false, "movimento_nullo"], ((r) => [r.ok, r.motivo])(G.applicaMovimento(5, 0)));
  const stranezze = [[3, 0.5], [3, "2"], [3, NaN], [3, Infinity], [3, null], [3, undefined], [1.5, 1], [-1, 1], ["3", 1], [NaN, 1], [null, 1], [Number.MAX_SAFE_INTEGER, 1]];
  c("numeri non interi, testo, NaN, null, giacenza negativa o oltre il limite → rifiutati (non_valido)", Array(stranezze.length).fill([false, "non_valido"]),
    stranezze.map(([a, d]) => ((r) => [r.ok, r.motivo])(G.applicaMovimento(a, d))));
  c("ogni rifiuto ha la sua frase in italiano", [], [G.applicaMovimento(3, -4), G.applicaMovimento(5, 0), G.applicaMovimento(3, 0.5)].filter((r) => !r.frase || r.frase.length < 15));
  c("una raffica di movimenti non scende mai sotto zero", [], (() => {
    const guai = [];
    let g = 7;
    for (const d of [-3, -3, -3, 5, -4, -9, 2, -1, -1, -1, -1, -1, -1]) {
      const r = G.applicaMovimento(g, d);
      if (r.ok) g = r.giacenza;
      if (g < 0) guai.push({ g, d });
    }
    return guai;
  })());
  c("il totale dopo movimenti validi è la somma", 9, [3, -2, 10, -2].reduce((g, d) => G.applicaMovimento(g, d).giacenza, 0));

  // ── statoDisponibilita ──
  c("giacenza 5, variante attiva → disponibile", "disponibile", G.statoDisponibilita(5, true));
  c("giacenza 1 → disponibile", "disponibile", G.statoDisponibilita(1, true));
  c("giacenza 0 → esaurito", "esaurito", G.statoDisponibilita(0, true));
  c("variante non attiva → esaurito, anche con giacenza", "esaurito", G.statoDisponibilita(5, false));
  c("senza dire se è attiva vale «attiva»", "disponibile", G.statoDisponibilita(2));
  c("giacenza negativa, NaN, testo, null → esaurito (nel dubbio non si vende)", Array(5).fill("esaurito"), [-1, NaN, "5", null, undefined].map((g) => G.statoDisponibilita(g, true)));
  c("lo stato è solo una parola: il numero non esce", ["disponibile", "esaurito"], [G.statoDisponibilita(3, true), G.statoDisponibilita(0, true)]);

  // ── giacenzaBassa ──
  c("soglia 3: giacenza 3, 2, 1 → bassa", [true, true, true], [3, 2, 1].map((g) => G.giacenzaBassa(g, 3)));
  c("soglia 3: giacenza 4 e 100 → non bassa", [false, false], [4, 100].map((g) => G.giacenzaBassa(g, 3)));
  c("giacenza 0 è «esaurita», non «bassa» (un'altra scritta)", false, G.giacenzaBassa(0, 3));
  c("soglia 0, negativa, vuota o storta → mai bassa", Array(5).fill(false), [0, -1, null, NaN, "3"].map((s) => G.giacenzaBassa(1, s)));
  c("giacenza storta → mai bassa", Array(3).fill(false), [NaN, -2, null].map((g) => G.giacenzaBassa(g, 3)));
}
