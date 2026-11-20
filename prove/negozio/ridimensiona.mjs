/** ── NEGOZIO · T13 · RIDIMENSIONARE LE FOTO NEL BROWSER ─────────────────────
 *  `src/crm/negozio/ridimensiona.ts`: dati larghezza e altezza e un punto di ritaglio (0-1, 0-1), calcola il quadrato
 *  da ritagliare e le misure 480/960/1600; mai ingrandire; avvisi in italiano; limiti di formato, peso e durata.
 *  L'originale non si conserva (D5): al server arrivano solo le misure. Il disegno vero (canvas) è dietro una porta. */

export async function prove(mod, { c, gruppo }) {
  const R = mod["negozio/ridimensiona"];
  gruppo("NEGOZIO · LE FOTO RIDIMENSIONATE NEL BROWSER (20/11/2026)");
  const codici = (p) => p.avvisi.map((a) => a.codice);

  // ── 4000×3000: ritaglio al centro, tre misure ──
  const g = R.pianoFoto(4000, 3000);
  c("4000×3000 → ritaglio quadrato 3000×3000 al centro (x = 500, y = 0)", [true, { x: 500, y: 0, lato: 3000 }], [g.ok, g.piano.ritaglio]);
  c("…tre file quadrati: 480, 960, 1600, ognuno per il suo nome", [{ lato: 480, per: [480] }, { lato: 960, per: [960] }, { lato: 1600, per: [1600] }], g.piano.misure);
  c("…nessun avviso di «piccola»: ha 3000 px; ma «non quadrata»", ["non_quadrata"], codici(g.piano));
  c("…e dice «al centro» (il punto è quello di partenza)", "La foto non è quadrata: la ritaglio al centro.", g.piano.avvisi[0].frase);

  // ── il punto di ritaglio sposta il quadrato, ma resta dentro l'immagine ──
  const sx = R.pianoFoto(4000, 3000, { x: 0, y: 0.5 }).piano.ritaglio;
  const dx = R.pianoFoto(4000, 3000, { x: 1, y: 0.5 }).piano.ritaglio;
  c("punto a sinistra → x = 0; punto a destra → x = 1000 (4000 − 3000)", [0, 1000], [sx.x, dx.x]);
  c("punto a 0.25 → x = 250", 250, R.pianoFoto(4000, 3000, { x: 0.25, y: 0.5 }).piano.ritaglio.x);
  const alto = R.pianoFoto(3000, 4000, { x: 0.5, y: 0 }).piano.ritaglio;
  const basso = R.pianoFoto(3000, 4000, { x: 0.5, y: 1 }).piano.ritaglio;
  c("foto in piedi: il punto muove la y (0 → 0, 1 → 1000), la x resta 0", [{ x: 0, y: 0, lato: 3000 }, { x: 0, y: 1000, lato: 3000 }], [alto, basso]);
  let fuori = 0;
  for (const [w, h] of [[4000, 3000], [3000, 4000], [1201, 1200], [1200, 5000]])
    for (const x of [-5, 0, 0.3, 0.5, 1, 7, NaN, Infinity, "a", null, undefined])
      for (const y of [-1, 0, 0.9, 1, 3, NaN, undefined]) {
        const r = R.pianoFoto(w, h, { x, y }).piano.ritaglio;
        if (r.x < 0 || r.y < 0 || r.x + r.lato > w || r.y + r.lato > h || !Number.isInteger(r.x) || !Number.isInteger(r.y)) fuori++;
      }
  c("qualunque punto (fuori da 0-1, NaN, testo, vuoto): il quadrato resta DENTRO l'immagine, con numeri interi", 0, fuori);
  c("un punto storto vale «al centro»", R.pianoFoto(4000, 3000).piano.ritaglio, R.pianoFoto(4000, 3000, { x: NaN, y: "a" }).piano.ritaglio);
  c("lo stesso punto dà sempre lo stesso quadrato", R.pianoFoto(4000, 3000, { x: 0.3, y: 0.7 }), R.pianoFoto(4000, 3000, { x: 0.3, y: 0.7 }));
  const spostato = R.pianoFoto(4000, 3000, { x: 0, y: 0.5 });
  c("con un punto spostato l'avviso non dice «al centro»", "La foto non è quadrata: la ritaglio dove hai indicato.", spostato.piano.avvisi[0].frase);

  // ── 800×600: mai ingrandita ──
  const p = R.pianoFoto(800, 600);
  c("800×600 → ritaglio 600×600; si fanno solo 480 e 600 (il 600 serve per 960 e 1600): mai ingrandita", [{ x: 100, y: 0, lato: 600 }, [{ lato: 480, per: [480] }, { lato: 600, per: [960, 1600] }]], [p.piano.ritaglio, p.piano.misure]);
  c("…avviso «piccola» con i px del lato corto, e anche «non quadrata»", [["piccola", "non_quadrata"], "La foto è piccola (600 px): sul sito può sembrare sfocata."], [codici(p.piano), p.piano.avvisi[0].frase]);
  const quasi = R.pianoFoto(1000, 1000);
  c("1000×1000: quadrata, piccola; 480 e 960 sì, il 1600 diventa 1000 (per 1600)", [["piccola"], [{ lato: 480, per: [480] }, { lato: 960, per: [960] }, { lato: 1000, per: [1600] }]], [codici(quasi.piano), quasi.piano.misure]);
  c("200×200: una sola misura (200) per tutti e tre i nomi", [{ lato: 200, per: [480, 960, 1600] }], R.pianoFoto(200, 200).piano.misure);
  let ingrandite = 0;
  for (const [w, h] of [[100, 100], [479, 900], [480, 480], [481, 700], [959, 959], [961, 5000], [1599, 1700], [1600, 1600], [1601, 1601], [9000, 8000]]) {
    const pi = R.pianoFoto(w, h).piano;
    if (pi.misure.some((m) => m.lato > pi.ritaglio.lato)) ingrandite++;
    if (![480, 960, 1600].every((n) => pi.misure.filter((m) => m.per.includes(n)).length === 1)) ingrandite++; // ogni nome ha UN file
  }
  c("in nessun caso una misura supera il quadrato ritagliato, e ogni nome (480, 960, 1600) ha un file solo", 0, ingrandite);

  // ── foto già quadrata ──
  const q = R.pianoFoto(2000, 2000);
  c("foto già quadrata: nessun avviso di ritaglio (e nemmeno «piccola»)", [[], { x: 0, y: 0, lato: 2000 }], [q.piano.avvisi, q.piano.ritaglio]);
  c("1200 px esatti non sono «piccola»; 1199 sì", [[], ["piccola"]], [codici(R.pianoFoto(1200, 1200).piano), codici(R.pianoFoto(1199, 1199).piano)]);

  // ── misure strane ──
  const storte = [[0, 100], [100, 0], [-5, 100], [100.5, 100], ["100", 100], [NaN, 100], [Infinity, 100], [null, undefined], [70000, 100]];
  c("larghezza o altezza storte (0, negative, decimali, testo, NaN, enormi) → rifiutate con una frase, mai un'eccezione", storte.map(() => false), storte.map(([w, h]) => R.pianoFoto(w, h).ok));
  c("…con la frase per il titolare", true, /non riesco a leggere/i.test(R.pianoFoto(0, 100).frase));

  // ── il campione colore: 1:1, 400 px ──
  const cam = R.pianoCampione(900, 600);
  c("campione colore: quadrato al centro e un solo file da 400", [{ x: 150, y: 0, lato: 600 }, [{ lato: 400, per: [400] }]], [cam.piano.ritaglio, cam.piano.misure]);
  c("…sotto i 400 px si avvisa e non si ingrandisce", [["piccola"], [{ lato: 300, per: [400] }]], ((r) => [codici(r.piano), r.piano.misure])(R.pianoCampione(300, 300)));

  // ── formato, peso, durata ──
  const MB = 1024 * 1024;
  const ok = (x) => R.controllaFile(x).ok;
  c("foto: JPG, PNG, WebP, AVIF passano", [true, true, true, true], ["image/jpeg", "image/png", "image/webp", "image/avif"].map((mime) => ok({ tipo: "foto", mime, byte: 3 * MB })));
  c("foto: GIF, PDF, HEIC, video, testo vuoto → no, con la frase dei formati", [false, false, false, false, false, true],
    [...["image/gif", "application/pdf", "image/heic", "video/mp4", ""].map((mime) => ok({ tipo: "foto", mime, byte: MB })), /JPG, PNG, WebP o AVIF/.test(R.controllaFile({ tipo: "foto", mime: "application/pdf", byte: MB }).frase)]);
  c("foto: 10 MB esatti passano, 10 MB + 1 byte no (con la frase del peso)", [true, false, true], [ok({ tipo: "foto", mime: "image/jpeg", byte: 10 * MB }), ok({ tipo: "foto", mime: "image/jpeg", byte: 10 * MB + 1 }), /10 MB/.test(R.controllaFile({ tipo: "foto", mime: "image/jpeg", byte: 11 * MB }).frase)]);
  c("la copertina del video è una foto: stessi limiti", [true, false, false], [ok({ tipo: "copertina", mime: "image/webp", byte: MB }), ok({ tipo: "copertina", mime: "video/mp4", byte: MB }), ok({ tipo: "copertina", mime: "image/jpeg", byte: 11 * MB })]);
  c("video di tipo sbagliato: la frase dice «MP4 o MOV» (come il server)", true, /MP4 o MOV/.test(R.controllaFile({ tipo: "video", mime: "video/webm", byte: MB, durataS: 5 }).frase));
  c("video: MP4 e quicktime (l'iPhone) passano; WebM e AVI no", [true, true, false, false], ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"].map((mime) => ok({ tipo: "video", mime, byte: 5 * MB, durataS: 10 })));
  c("video: 25 MB esatti sì, oltre no (con la frase)", [true, false, true], [ok({ tipo: "video", mime: "video/mp4", byte: 25 * MB, durataS: 10 }), ok({ tipo: "video", mime: "video/mp4", byte: 25 * MB + 1, durataS: 10 }), /25 MB/.test(R.controllaFile({ tipo: "video", mime: "video/mp4", byte: 30 * MB, durataS: 10 }).frase)]);
  c("video: 15 s esatti sì, 15,1 no («troppo lungo»), durata che non si legge no", [true, false, true, false, false],
    [ok({ tipo: "video", mime: "video/mp4", byte: MB, durataS: 15 }), ok({ tipo: "video", mime: "video/mp4", byte: MB, durataS: 15.1 }), /troppo lungo/.test(R.controllaFile({ tipo: "video", mime: "video/mp4", byte: MB, durataS: 40 }).frase), ok({ tipo: "video", mime: "video/mp4", byte: MB, durataS: NaN }), ok({ tipo: "video", mime: "video/mp4", byte: MB })]);
  c("peso zero, negativo o non numerico, tipo sconosciuto → no", [false, false, false, false], [ok({ tipo: "foto", mime: "image/jpeg", byte: 0 }), ok({ tipo: "foto", mime: "image/jpeg", byte: -1 }), ok({ tipo: "foto", mime: "image/jpeg", byte: "3" }), ok({ tipo: "audio", mime: "image/jpeg", byte: MB })]);

  // ── il disegno vero (canvas) dietro una porta: qui con un finto ──
  {
    const chiamate = [];
    const porta = {
      crea(lato) {
        const t = { lato, disegni: [] };
        chiamate.push(t);
        return { disegna: (sorgente, r, sfondo) => t.disegni.push({ sorgente, r, sfondo }), aBlob: async (tipo, qualita) => ({ finto: true, lato, tipo, qualita }) };
      },
    };
    const piano = R.pianoFoto(4000, 3000, { x: 0, y: 0.5 }).piano;
    const out = await R.disegnaMisure("SORGENTE", piano, porta);
    c("disegnaMisure: un file per misura, ritagliando SEMPRE lo stesso quadrato, in JPEG", [[480, 960, 1600], [[0, 0, 3000], [0, 0, 3000], [0, 0, 3000]], ["image/jpeg", "image/jpeg", "image/jpeg"], [["SORGENTE", "SORGENTE", "SORGENTE"]]],
      [out.map((o) => o.lato), chiamate.map((t) => [t.disegni[0].r.x, t.disegni[0].r.y, t.disegni[0].r.lato]), out.map((o) => o.blob.tipo), [chiamate.map((t) => t.disegni[0].sorgente)]]);
    c("lo sfondo è bianco: un PNG trasparente non diventa nero nel JPEG (la porta lo dipinge prima di disegnare)", [["#ffffff", "#ffffff", "#ffffff"]], [chiamate.map((t) => t.disegni[0].sfondo)]);
    c("…ogni file porta i nomi (480, 960, 1600) che serve", [[480], [960], [1600]], out.map((o) => o.per));
    const p2 = await R.disegnaMisure("S", R.pianoFoto(800, 600).piano, porta);
    c("una foto piccola: due file, e il 600 serve per 960 e 1600", [[480, 600], [[960, 1600]]], [p2.map((o) => o.lato), [p2[1].per]]);
    c("se il browser non sa scrivere il file → errore con la frase, non un file vuoto", "Non sono riuscito a preparare la foto: provane un'altra.",
      await R.disegnaMisure("S", piano, { crea: () => ({ disegna() {}, aBlob: async () => null }) }).then(() => "", (e) => e.message));
  }
}
