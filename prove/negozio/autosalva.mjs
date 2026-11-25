/** ── NEGOZIO · T13 · IL SALVATAGGIO AUTOMATICO ──────────────────────────────
 *  `src/crm/negozio/autosalva.ts` (puro): salva da solo 2 s dopo l'ultima modifica, annulla il timer se ne arriva
 *  un'altra, non salva due volte lo stesso contenuto, dice «Salvato alle HH:MM». Orologio e timer a mano. */
import { oraDi } from "./_ora.mjs";

export async function prove(mod, { c, gruppo }) {
  const A = mod["negozio/autosalva"];
  gruppo("NEGOZIO · IL SALVATAGGIO AUTOMATICO (20/11/2026)");

  const sfiata = () => new Promise((r) => setTimeout(r, 0));
  /** Orologio e timer a mano. */
  const banco = (esito = () => true) => {
    const p = { t: Date.UTC(2026, 10, 20, 12, 0, 0), timer: new Map(), n: 1, salvataggi: [], inCorso: 0, picco: 0, sbloccaTutti: null };
    const porte = {
      adesso: () => p.t,
      imposta: (fn, ms) => { const h = p.n++; p.timer.set(h, { fn, quando: p.t + ms }); return h; },
      annulla: (h) => p.timer.delete(h),
    };
    p.avanza = async (ms) => {
      const fine = p.t + ms;
      for (;;) {
        const scaduti = [...p.timer.entries()].filter(([, x]) => x.quando <= fine).sort((a, b) => a[1].quando - b[1].quando);
        if (!scaduti.length) break;
        const [h, x] = scaduti[0];
        p.timer.delete(h);
        p.t = Math.max(p.t, x.quando);
        x.fn();
        await sfiata();
      }
      p.t = fine;
      await sfiata();
    };
    const salva = async (contenuto) => {
      p.salvataggi.push({ contenuto, quando: p.t });
      p.inCorso++; p.picco = Math.max(p.picco, p.inCorso);
      const r = await esito(contenuto, p);
      p.inCorso--;
      return r;
    };
    return { p, porte, salva };
  };

  // ── 3 modifiche in 1 s → UN salvataggio a +2 s ──
  {
    const b = banco();
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    a.modifica({ nome: "A" });
    await b.p.avanza(400);
    a.modifica({ nome: "AB" });
    await b.p.avanza(400);
    a.modifica({ nome: "ABC" });
    const t0 = b.p.t;
    await b.p.avanza(1999);
    c("3 modifiche in 1 s: 1999 ms dopo l'ultima NON ha ancora salvato", 0, b.p.salvataggi.length);
    await b.p.avanza(1);
    c("a +2 s dall'ultima: UN salvataggio, col contenuto più recente", [1, { nome: "ABC" }, t0 + 2000], [b.p.salvataggi.length, b.p.salvataggi[0].contenuto, b.p.salvataggi[0].quando]);
    await b.p.avanza(10_000);
    c("e poi niente altro", 1, b.p.salvataggi.length);
    c("lo stato dice «Salvato alle HH:MM» (ora del browser)", ["salvato", `Salvato alle ${oraDi(t0 + 2000)}`], [a.stato().fase, a.stato().testo]);
  }

  // ── lo stesso contenuto non si salva due volte ──
  {
    const b = banco();
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    a.modifica({ nome: "A", righe: [1, 2] });
    await b.p.avanza(2000);
    a.modifica({ nome: "A", righe: [1, 2] });
    await b.p.avanza(5000);
    c("lo stesso contenuto riscritto uguale: non si salva di nuovo", 1, b.p.salvataggi.length);
    a.modifica({ nome: "B", righe: [1, 2] });
    a.modifica({ nome: "A", righe: [1, 2] });
    await b.p.avanza(5000);
    c("modificato e tornato com'era prima del timer: niente da salvare", 1, b.p.salvataggi.length);
    c("un contenuto diverso si salva", 2, (a.modifica({ nome: "C" }), await b.p.avanza(2000), b.p.salvataggi.length));
  }

  // ── il timer si annulla: non resta acceso un timer per ogni battuta ──
  {
    const b = banco();
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    for (let k = 0; k < 20; k++) { a.modifica({ k }); await b.p.avanza(100); }
    c("20 modifiche ravvicinate: ne resta acceso UNO solo", 1, b.p.timer.size);
    a.ferma();
    c("ferma(): nessun timer acceso e nessun salvataggio", [0, 0], [b.p.timer.size, b.p.salvataggi.length]);
    a.modifica({ k: 99 });
    await b.p.avanza(5000);
    c("dopo ferma() una modifica non salva più (la pagina è stata lasciata)", 0, b.p.salvataggi.length);
  }

  // ── durante un salvataggio arriva un'altra modifica: mai due salvataggi insieme ──
  {
    let sblocca;
    const b = banco(() => new Promise((ok) => { sblocca = () => ok(true); }));
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    a.modifica({ v: 1 });
    await b.p.avanza(2000);
    c("il primo salvataggio parte ed è in attesa", ["salvando", 1], [a.stato().fase, b.p.salvataggi.length]);
    a.modifica({ v: 2 });
    await b.p.avanza(5000);
    c("una modifica arrivata mentre salva NON fa partire un secondo salvataggio in parallelo", [1, 1], [b.p.salvataggi.length, b.p.picco]);
    const insistente = a.subito();
    await sfiata();
    c("«Salva subito» mentre si sta già salvando non ne fa partire un altro in parallelo", [1, 1], [b.p.salvataggi.length, b.p.picco]);
    let risolto = false;
    void insistente.then(() => { risolto = true; });
    sblocca(); // finisce il primo (v1)
    await sfiata(); await sfiata();
    c("finito il primo, subito() NON ha ancora risolto: la v2 è ancora da salvare (altrimenti «Pubblica» pubblicherebbe la v1)", [false, 2, { v: 2 }], [risolto, b.p.salvataggi.length, b.p.salvataggi[1]?.contenuto]);
    c("…e la v2 parte subito, senza aspettare i 2 s, e mai in parallelo", [0, 1], [b.p.timer.size, b.p.picco]);
    sblocca(); // finisce il secondo (v2)
    await sfiata(); await sfiata();
    c("subito() risolve `true` solo quando la v2 è salvata: niente in coda, niente in volo", [true, true, "salvato", 0], [await insistente, risolto, a.stato().fase, b.p.timer.size]);
    await b.p.avanza(10_000);
    c("…e dopo non salva più niente", 2, b.p.salvataggi.length);
  }

  // ── subito() con modifiche che continuano ad arrivare: le salva tutte, poi risolve ──
  {
    const sbloccaCoda = [];
    const b = banco(() => new Promise((ok) => sbloccaCoda.push(() => ok(true))));
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    a.modifica({ v: 1 });
    const s = a.subito();
    await sfiata();
    a.modifica({ v: 2 });
    sbloccaCoda.shift()();
    await sfiata(); await sfiata();
    a.modifica({ v: 3 }); // arriva mentre salva la v2
    sbloccaCoda.shift()();
    await sfiata(); await sfiata();
    sbloccaCoda.shift()();
    c("v1 in volo, poi v2, poi v3: subito() le salva tutte e risolve `true` dopo l'ultima", [true, [{ v: 1 }, { v: 2 }, { v: 3 }], 0, 1], [await s, b.p.salvataggi.map((x) => x.contenuto), b.p.timer.size, b.p.picco]);
  }

  // ── subito(): se un salvataggio fallisce, dice `false` e non insiste ──
  {
    const b = banco((x) => x.v !== 2);
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    a.modifica({ v: 1 });
    await b.p.avanza(2000);
    a.modifica({ v: 2 });
    const r = await a.subito();
    c("subito() con la v2 che non si salva: `false` (chi chiama non pubblica), fase «errore», un solo tentativo, nessun timer", [false, "errore", 2, 0], [r, a.stato().fase, b.p.salvataggi.length, b.p.timer.size]);
  }

  // ── errori: si dice, e si riprova con la prossima modifica ──
  {
    let n = 0;
    const b = banco(() => ++n > 1);
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    a.modifica({ v: 1 });
    await b.p.avanza(2000);
    c("salvataggio fallito: lo stato dice «errore», il testo non finge «Salvato»", ["errore", false], [a.stato().fase, /^Salvato/.test(a.stato().testo)]);
    await b.p.avanza(30_000);
    c("…e non ritenta all'infinito da solo", 1, b.p.salvataggi.length);
    a.modifica({ v: 1 });
    await b.p.avanza(2000);
    c("alla modifica successiva (anche uguale: l'ultimo salvataggio non è riuscito) riprova, e stavolta salva", [2, "salvato"], [b.p.salvataggi.length, a.stato().fase]);
    // subito() dopo un errore ritenta l'ultima modifica, UNA volta per chiamata
    let riesce = false;
    const b3 = banco(() => riesce);
    const a3 = A.creaAutosalva({ salva: b3.salva, porte: b3.porte });
    a3.modifica({ v: 7 });
    await b3.p.avanza(2000);
    c("(prima) salvataggio fallito: fase «errore», 1 tentativo", ["errore", 1], [a3.stato().fase, b3.p.salvataggi.length]);
    const r1 = await a3.subito();
    c("subito() dopo un errore ritenta SUBITO l'ultima modifica (senza aspettare i 2 s); fallisce ancora: `false`", [false, 2, { v: 7 }, "errore", 0], [r1, b3.p.salvataggi.length, b3.p.salvataggi[1]?.contenuto, a3.stato().fase, b3.p.timer.size]);
    await b3.p.avanza(60_000);
    c("…e da sola non insiste: nessun ritentativo senza una nuova chiamata", 2, b3.p.salvataggi.length);
    const r2 = await a3.subito();
    c("ogni chiamata a subito() è UN tentativo (non un ciclo infinito)", [false, 3], [r2, b3.p.salvataggi.length]);
    riesce = true;
    const r3 = await a3.subito();
    c("quando la rete torna, subito() salva la stessa modifica e risolve `true`", [true, 4, { v: 7 }, "salvato"], [r3, b3.p.salvataggi.length, b3.p.salvataggi[3]?.contenuto, a3.stato().fase]);
    c("…e poi subito() non ritenta più niente (è salvato)", [true, 4], [await a3.subito(), b3.p.salvataggi.length]);
    // una modifica nuova prende il posto di quella fallita
    let ok4 = false;
    const b4 = banco(() => ok4);
    const a4 = A.creaAutosalva({ salva: b4.salva, porte: b4.porte });
    a4.modifica({ v: 1 });
    await b4.p.avanza(2000);
    a4.modifica({ v: 2 });
    ok4 = true;
    await a4.subito();
    c("dopo un errore e una modifica nuova, subito() salva la nuova (non la vecchia fallita)", [2, { v: 2 }], [b4.p.salvataggi.length, b4.p.salvataggi[1]?.contenuto]);
    const a5 = A.creaAutosalva({ salva: b3.salva, porte: b3.porte });
    c("subito() su una scheda senza modifiche: `true`, niente da fare", true, await a5.subito());
    const lancia = banco(() => { throw new Error("rete caduta, Anna Esempio"); });
    const a2 = A.creaAutosalva({ salva: lancia.salva, porte: lancia.porte });
    a2.modifica({ v: 1 });
    await lancia.p.avanza(2000);
    c("un salvataggio che lancia: «errore», nessuna eccezione, il messaggio del browser non si mostra", ["errore", false], [a2.stato().fase, /Anna/.test(JSON.stringify(a2.stato()))]);
  }

  // ── subito(): per «Salva» e per quando si lascia la pagina ──
  {
    const b = banco();
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    a.modifica({ v: 1 });
    await b.p.avanza(500);
    await a.subito();
    c("subito(): salva ora senza aspettare i 2 s, e il timer si spegne", [1, 0, "salvato"], [b.p.salvataggi.length, b.p.timer.size, a.stato().fase]);
    await b.p.avanza(5000);
    c("…e poi non salva una seconda volta", 1, b.p.salvataggi.length);
    c("subito() senza modifiche non fa niente", [1, true], [b.p.salvataggi.length, await a.subito()]);
  }

  // ── chi guarda lo stato ──
  {
    const b = banco();
    const a = A.creaAutosalva({ salva: b.salva, porte: b.porte });
    const viste = [];
    const smetti = a.iscrivi(() => viste.push(a.stato().fase));
    a.modifica({ v: 1 });
    await b.p.avanza(2000);
    smetti();
    a.modifica({ v: 2 });
    c("chi si iscrive vede le fasi: in attesa → salvando → salvato; dopo `smetti` non sente più", ["in_attesa", "salvando", "salvato"], viste);
    c("all'inizio: fermo, e nessun testo", ["fermo", ""], ((s) => [s.fase, s.testo])(A.creaAutosalva({ salva: async () => true, porte: banco().porte }).stato()));
    const base = A.creaAutosalva({ salva: b.salva, porte: b.porte, contenutoIniziale: { v: 5 } });
    base.modifica({ v: 5 });
    await b.p.avanza(5000);
    c("col contenuto iniziale dato, riscriverlo uguale non salva niente (la scheda appena aperta)", 0, b.p.salvataggi.filter((s) => s.contenuto.v === 5).length);
  }
}
