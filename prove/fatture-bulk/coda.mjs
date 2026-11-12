/** ── FATTURE BULK · T8 · LA CODA, I CODICI D'ERRORE, LE IMMAGINI (parti pure) ─
 *  `coda.ts` è pura: i tempi e le attese sono iniettati (qui `attendi` non aspetta,
 *  registra), nessun `setTimeout`. Le parti pure di `immagini.ts` (controllo del file,
 *  misure della riduzione, SHA-256) si provano qui; la riduzione vera (canvas) e il
 *  confronto 1600/2000 px si provano nel browser in T14.
 *  ⚠️ Nessun dato personale: elementi numerati, errori finti. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Una promessa che si risolve quando lo decide la prova (per tenere "in corso" più elementi insieme). */
const differita = () => {
  let ok, ko;
  const p = new Promise((a, b) => ((ok = a), (ko = b)));
  return { p, ok, ko };
};
const microtask = () => new Promise((r) => setImmediate(r));

export async function prove(mod, { c, gruppo, radice }) {
  const Q = mod["fatture/bulk/coda"];
  const I = mod["fatture/bulk/immagini"];
  const K = mod["fatture/bulk/chiavi"];
  const E = (codice) => new Q.ErroreCoda(codice);

  /** Esegue la coda con un `esegui` a copione e `attendi` che registra le attese senza aspettare. */
  async function corri({ n = 1, copione, opz = {} }) {
    const attese = [];
    const chiamate = []; // [elemento, tentativo]
    const r = await Q.eseguiCoda({
      elementi: Array.from({ length: n }, (_, i) => i),
      esegui: async (el, tentativo) => {
        chiamate.push([el, tentativo]);
        return copione(el, tentativo, chiamate.length);
      },
      attendi: async (ms) => void attese.push(ms),
      ...opz,
    });
    return { r, attese, chiamate };
  }

  gruppo("BULK · T8 · LA CODA · IN PARALLELO");
  c("le costanti del piano: 3 insieme, 3 tentativi, attese 2 s e 5 s, freno a 5", [3, 3, [2000, 5000], 5],
    [K.IN_PARALLELO, K.TENTATIVI_PER_GRUPPO, K.RITARDI_RIPETIZIONE_MS, K.ERRORI_DI_FILA]);
  {
    let inCorso = 0, massimo = 0;
    const attivi = [];
    const lavoro = Q.eseguiCoda({
      elementi: Array.from({ length: 10 }, (_, i) => i),
      esegui: async (el) => {
        inCorso++; massimo = Math.max(massimo, inCorso);
        const d = differita(); attivi.push(d);
        await d.p;
        inCorso--; return el;
      },
      attendi: async () => {},
    });
    let finito = false;
    lavoro.then(() => (finito = true));
    while (!finito) {
      await microtask();
      attivi.shift()?.ok();
    }
    const r = await lavoro;
    c("10 elementi: mai più di 3 in corso", 3, massimo);
    c("e finiscono tutti, nell'ordine degli elementi", Array.from({ length: 10 }, (_, i) => ({ ok: true, valore: i })), r.esiti);
    c("nessuna fermata", undefined, r.fermataPer);
  }
  {
    let inCorso = 0, massimo = 0;
    await Q.eseguiCoda({
      elementi: [1, 2, 3, 4], inParallelo: 1,
      esegui: async () => { inCorso++; massimo = Math.max(massimo, inCorso); await microtask(); inCorso--; },
      attendi: async () => {},
    });
    c("con inParallelo: 1 uno alla volta", 1, massimo);
  }
  {
    const r = await corri({ n: 0, copione: () => 1 });
    c("nessun elemento: nessun esito, nessuna fermata", [[], undefined], [r.r.esiti, r.r.fermataPer]);
  }
  {
    // L'ordine dei risultati è quello degli elementi, anche se chi finisce prima è l'ultimo.
    const fine = [];
    const attivi = [];
    const lavoro = Q.eseguiCoda({
      elementi: ["a", "b", "c"],
      esegui: async (el) => { const d = differita(); attivi.push([el, d]); await d.p; return el.toUpperCase(); },
      attendi: async () => {},
      perOgnuno: (i, e) => fine.push([i, e.ok && e.valore]),
    });
    await microtask();
    for (const el of ["c", "a", "b"]) attivi.find(([x]) => x === el)[1].ok();
    const r = await lavoro;
    c("l'ordine dei risultati non dipende da chi finisce prima", ["A", "B", "C"], r.esiti.map((e) => e.valore));
    c("perOgnuno arriva nell'ordine in cui finiscono, una volta per elemento", [[2, "C"], [0, "A"], [1, "B"]], fine);
  }

  gruppo("BULK · T8 · LA CODA · UN SOLO LIVELLO DI RIPETIZIONI (2 s e 5 s)");
  for (const codice of ["limite", "rete", "timeout"]) {
    const x = await corri({ copione: () => { throw E(codice); } });
    c(`«${codice}» sempre: 3 tentativi in tutto, attese 2 s e 5 s, poi errore`, [3, [2000, 5000], { ok: false, codice }],
      [x.chiamate.length, x.attese, x.r.esiti[0]]);
  }
  {
    const x = await corri({ copione: (_, t) => { if (t === 1) throw E("limite"); return "fatto"; } });
    c("429 e poi bene: una sola attesa da 2 s, il numero del tentativo sale", [{ ok: true, valore: "fatto" }, [2000], [[0, 1], [0, 2]]],
      [x.r.esiti[0], x.attese, x.chiamate]);
  }
  {
    const x = await corri({ copione: (_, t) => { if (t < 3) throw E("rete"); return "fatto"; } });
    c("due guasti e poi bene: attese 2 s e 5 s, al terzo tentativo", [{ ok: true, valore: "fatto" }, [2000, 5000], 3],
      [x.r.esiti[0], x.attese, x.chiamate.length]);
  }
  for (const codice of ["richiesta_non_valida", "troncata", "credito", "illeggibile", "non_autorizzato", "non_permesso", "file_non_valido", "interno"]) {
    const x = await corri({ copione: () => { throw E(codice); } });
    c(`«${codice}»: nessuna ripetizione, nessuna attesa (si pagherebbe due volte)`, [1, [], { ok: false, codice }],
      [x.chiamate.length, x.attese, x.r.esiti[0]]);
  }
  {
    const x = await corri({ copione: () => { throw new TypeError("bug nostro"); } });
    c("un errore che non è di rete (un nostro bug) non si ripete: «interno»", [1, { ok: false, codice: "interno" }],
      [x.chiamate.length, x.r.esiti[0]]);
  }
  {
    const x = await corri({ n: 5, copione: () => { throw E("limite"); }, opz: { inParallelo: 1 } });
    c("i tentativi per gruppo non superano mai 3 (5 gruppi sempre in 429: 15 chiamate, non di più)", [15, 3], [x.chiamate.length, Math.max(...x.chiamate.map(([, t]) => t))]);
  }

  gruppo("BULK · T8 · LA CODA · IL FRENO A 5 ERRORI");
  {
    const x = await corri({ n: 12, copione: () => { throw E("troncata"); }, opz: { inParallelo: 1 } });
    c("5 errori di fila → si ferma: 5 chiamate, gli altri 7 non fatti", [5, 7, 5], [x.chiamate.length, x.r.esiti.filter((e) => e === undefined).length, x.r.esiti.filter((e) => e?.ok === false).length]);
    c("la fermata dice perché e con quale codice", ["freno", "troncata"], [x.r.fermataPer, x.r.codiceFreno]);
    c("i non fatti sono in fondo, nell'ordine (si riparte dal primo)", [5, 6, 7, 8, 9, 10, 11],
      x.r.esiti.map((e, i) => (e === undefined ? i : -1)).filter((i) => i >= 0));
  }
  {
    const x = await corri({ n: 4, copione: () => { throw E("troncata"); }, opz: { inParallelo: 1 } });
    c("4 errori di fila non bastano a fermare la coda", [undefined, 4], [x.r.fermataPer, x.r.esiti.filter((e) => e?.ok === false).length]);
  }
  {
    // F F F F S F F F F S …: un successo azzera il contatore, non si ferma mai.
    const x = await corri({ n: 20, copione: (el) => { if (el % 5 === 4) return "ok"; throw E("illeggibile"); }, opz: { inParallelo: 1 } });
    c("un successo azzera il contatore: 4 errori e un successo, per 20 elementi, non frena", [undefined, 20, 16],
      [x.r.fermataPer, x.r.esiti.filter((e) => e !== undefined).length, x.r.esiti.filter((e) => e?.ok === false).length]);
  }
  {
    // Con più elementi in corso, quelli già partiti finiscono (e si registrano), ma non ne partono altri.
    const x = await corri({ n: 40, copione: () => { throw E("illeggibile"); } });
    const fatti = x.r.esiti.filter((e) => e !== undefined).length;
    c("in parallelo: dopo il freno non partono altri; al massimo i 2 già in corso oltre il quinto", true, fatti >= 5 && fatti <= 7);
    c("ogni elemento partito ha il suo esito (nessun buco in mezzo)", true, x.r.esiti.slice(0, fatti).every((e) => e !== undefined) && x.r.esiti.slice(fatti).every((e) => e === undefined));
    c("fermata dal freno", "freno", x.r.fermataPer);
  }
  {
    // Il freno conta i fallimenti DEFINITIVI dell'elemento, non i singoli tentativi: 3 tentativi falliti = 1 errore.
    const x = await corri({ n: 4, copione: () => { throw E("limite"); }, opz: { inParallelo: 1 } });
    c("3 tentativi falliti dello stesso gruppo contano come un errore solo (4 gruppi, 12 tentativi: nessun freno)", [12, undefined],
      [x.chiamate.length, x.r.fermataPer]);
  }

  gruppo("BULK · T8 · LA CODA · CREDITO, SESSIONE E PERMESSO FERMANO SUBITO");
  for (const codice of ["credito", "non_autorizzato", "non_permesso"]) {
    // 10 elementi, uno alla volta, il secondo fa il guasto: non parte più niente dopo.
    const x = await corri({ n: 10, copione: (el) => { if (el === 1) throw E(codice); return "ok"; }, opz: { inParallelo: 1 } });
    c(`«${codice}» al secondo: ferma subito (2 chiamate, 8 non fatti)`, [2, "freno", codice, 8],
      [x.chiamate.length, x.r.fermataPer, x.r.codiceFreno, x.r.esiti.filter((e) => e === undefined).length]);
    c(`«${codice}»: i non fatti sono in fondo, il guasto è registrato`, [{ ok: false, codice }, true],
      [x.r.esiti[1], x.r.esiti.slice(2).every((e) => e === undefined)]);
  }
  {
    // In parallelo: quelli già partiti finiscono, ma nessuno nuovo parte.
    const attivi = [];
    const lavoro = Q.eseguiCoda({
      elementi: Array.from({ length: 10 }, (_, i) => i),
      esegui: async (el) => { const d = differita(); attivi.push([el, d]); await d.p; },
      attendi: async () => {},
    });
    await microtask();
    c("partono 3", [0, 1, 2], attivi.map(([el]) => el));
    attivi[1][1].ko(E("credito"));
    await microtask();
    attivi[0][1].ok(); attivi[2][1].ok();
    const r = await lavoro;
    c("il 402 del secondo ferma: nessun quarto elemento parte, gli altri due finiscono", [3, "freno", "credito", [true, false, true]],
      [attivi.length, r.fermataPer, r.codiceFreno, r.esiti.slice(0, 3).map((e) => e.ok)]);
  }

  gruppo("BULK · T8 · LA CODA · ANNULLARE NON È UN GUASTO");
  {
    // Dopo «annulla» una fetch interrotta lancia AbortError: non è un fallimento e non conta nel freno.
    const ctl = new AbortController();
    const visti = [];
    const x = await corri({
      n: 8, opz: { inParallelo: 1, segnale: ctl.signal, perOgnuno: (i, e) => visti.push([i, e.ok]) },
      copione: (el) => {
        if (el < 2) return "ok";
        ctl.abort();
        const e = new Error("The operation was aborted"); e.name = "AbortError"; throw e;
      },
    });
    c("AbortError dopo l'annulla: l'elemento resta «non fatto», non registrato, niente freno", ["annullata", undefined, [[0, true], [1, true]], undefined],
      [x.r.fermataPer, x.r.esiti[2], visti, x.r.codiceFreno]);
  }
  {
    // 4 guasti veri, poi l'annulla con AbortError: non deve essere il quinto di fila.
    const ctl = new AbortController();
    const x = await corri({
      n: 8, opz: { inParallelo: 1, segnale: ctl.signal },
      copione: (el) => {
        if (el < 4) throw E("illeggibile");
        ctl.abort(); const e = new Error("aborted"); e.name = "AbortError"; throw e;
      },
    });
    c("4 errori veri e poi l'annulla: si ferma per annullamento, non per freno", ["annullata", undefined], [x.r.fermataPer, x.r.codiceFreno]);
  }

  gruppo("BULK · T8 · LA CODA · inParallelo NON VALIDO");
  for (const n of [0, -1, 1.5, NaN]) {
    let errore = null;
    try { await Q.eseguiCoda({ elementi: [1], esegui: async () => 1, attendi: async () => {}, inParallelo: n }); } catch (e) { errore = e.message; }
    c(`inParallelo ${n} → errore, non una coda ferma senza dirlo`, true, typeof errore === "string" && /inParallelo/.test(errore));
  }

  gruppo("BULK · T8 · LA CODA · «OCCUPATO» (un'altra scheda sta già leggendo)");
  {
    const x = await corri({ copione: (_, t, n) => { if (n <= 2) throw E("occupato"); return "fatto"; } });
    c("occupato due volte e poi bene: riprova fra poco (5 s), il tentativo pagato resta il primo", [{ ok: true, valore: "fatto" }, [5000, 5000], [1, 1, 1]],
      [x.r.esiti[0], x.attese, x.chiamate.map(([, t]) => t)]);
  }
  {
    const x = await corri({ copione: (_, t, n) => { if (n === 1) throw E("occupato"); if (t === 1) throw E("limite"); return "fatto"; } });
    c("occupato, poi 429, poi bene: il 429 conta come primo tentativo e si ripete a 2 s", [[5000, 2000], [1, 1, 2]],
      [x.attese, x.chiamate.map(([, t]) => t)]);
  }
  {
    // 6 gruppi sempre occupati: finiscono in errore «occupato» dopo l'attesa massima, ma NON fermano il freno.
    const x = await corri({ n: 6, copione: () => { throw E("occupato"); }, opz: { inParallelo: 1 } });
    c("6 gruppi occupati per sempre: nessun freno, ognuno finisce «occupato»", [undefined, 6, 6],
      [x.r.fermataPer, x.r.esiti.filter((e) => e?.codice === "occupato").length, x.r.esiti.filter((e) => e !== undefined).length]);
    c("l'attesa è limitata (non si aspetta per sempre l'altra scheda)", true, x.chiamate.length === 6 * (Q.MAX_ATTESE_OCCUPATO + 1));
    c("e dura più del reclamo (90 s), così alla fine l'altra scheda ha finito o il reclamo è scaduto", true,
      Q.MAX_ATTESE_OCCUPATO * Q.ATTESA_OCCUPATO_MS > K.SCADENZA_RECLAMO_MS);
  }
  {
    // «Occupato» non azzera un'eventuale serie di errori già in corso: 4 errori, un occupato, 1 errore → freno.
    const seq = ["illeggibile", "illeggibile", "illeggibile", "illeggibile", "occupato", "illeggibile"];
    const x = await corri({
      n: 6, opz: { inParallelo: 1 },
      copione: (el) => { throw E(seq[el]); },
    });
    c("occupato in mezzo a una serie di errori non la azzera", "freno", x.r.fermataPer);
  }

  gruppo("BULK · T8 · LA CODA · ANNULLARE E RIPRENDERE");
  {
    const ctl = new AbortController();
    const x = await corri({ n: 6, copione: (el) => el, opz: { inParallelo: 1, segnale: ctl.signal, perOgnuno: (i) => { if (i === 1) ctl.abort(); } } });
    c("annullata dopo 2 elementi: gli altri non partono", ["annullata", 2, 4], [x.r.fermataPer, x.chiamate.length, x.r.esiti.filter((e) => e === undefined).length]);
  }
  {
    const ctl = new AbortController(); ctl.abort();
    const x = await corri({ n: 3, copione: (el) => el, opz: { segnale: ctl.signal } });
    c("già annullata prima di partire: non parte niente", [0, "annullata"], [x.chiamate.length, x.r.fermataPer]);
  }
  {
    const ctl = new AbortController();
    const visti = [];
    const x = await corri({
      n: 1, copione: () => { throw E("rete"); },
      opz: { segnale: ctl.signal, attendi: async () => ctl.abort(), perOgnuno: (i, e) => visti.push(e) },
    });
    c("annullata durante l'attesa fra due tentativi: l'elemento resta «non fatto» e non si segnala", [undefined, [], "annullata"],
      [x.r.esiti[0], visti, x.r.fermataPer]);
  }
  {
    // Ripresa: la coda si rilancia sui soli elementi non fatti (gli indici sono relativi a ciò che si passa).
    const primo = await corri({ n: 8, copione: (el) => { if (el < 2) return "ok"; throw E("illeggibile"); }, opz: { inParallelo: 1 } });
    const nonFatti = primo.r.esiti.map((e, i) => (e === undefined ? i : -1)).filter((i) => i >= 0);
    c("dopo il freno restano da fare quelli dal primo non fatto", [7], nonFatti.slice(-1));
    const secondo = await Q.eseguiCoda({ elementi: nonFatti, esegui: async (el) => el * 10, attendi: async () => {} });
    c("la ripresa lavora solo quelli e li restituisce nell'ordine", nonFatti.map((el) => ({ ok: true, valore: el * 10 })), secondo.esiti);
  }

  gruppo("BULK · T8 · I CODICI D'ERRORE DA UNO STATO HTTP");
  c("429 → limite, 402 → credito, 408/504 → timeout, 5xx → rete", ["limite", "credito", "timeout", "timeout", "rete", "rete"],
    [429, 402, 408, 504, 500, 502].map(Q.codiceDaStato));
  c("401 → non_autorizzato, 403 → non_permesso, 404 → non_trovato, altri 4xx → richiesta_non_valida",
    ["non_autorizzato", "non_permesso", "non_trovato", "richiesta_non_valida", "richiesta_non_valida"], [401, 403, 404, 400, 413].map(Q.codiceDaStato));
  c("uno stato strano (0, 200) → rete: la richiesta non ha dato una risposta che si capisce", ["rete", "rete"], [0, 200].map(Q.codiceDaStato));
  c("i soli codici che si ripetono sono rete, limite, timeout", ["limite", "rete", "timeout"], [...Q.CODICI_RIPETIBILI].sort());

  gruppo("BULK · T8 · IMMAGINI · CONTROLLO DEL FILE");
  const MB = 1024 * 1024;
  const giudizio = (type, size) => I.controllaFile({ type, size }).ok;
  c("PNG, JPG, WebP passano", [true, true, true, true], [giudizio("image/png", MB), giudizio("image/jpeg", MB), giudizio("image/jpg", MB), giudizio("image/webp", MB)]);
  c("PDF, HEIC, GIF no", [false, false, false], [giudizio("application/pdf", MB), giudizio("image/heic", MB), giudizio("image/gif", MB)]);
  c("tipo mancante no", false, giudizio("", MB));
  c("file vuoto no; 1 byte sì; 15 MB sì; 15 MB + 1 no", [false, true, true, false], [giudizio("image/png", 0), giudizio("image/png", 1), giudizio("image/png", 15 * MB), giudizio("image/png", 15 * MB + 1)]);
  c("il motivo è una frase italiana che dice cosa fare", true, /^[A-Z].*\.$/.test(I.controllaFile({ type: "application/pdf", size: MB }).motivo ?? ""));
  c("troppo pesante: il motivo parla di peso", true, /15 MB/.test(I.controllaFile({ type: "image/png", size: 16 * MB }).motivo ?? ""));

  gruppo("BULK · T8 · IMMAGINI · MISURE DELLA RIDUZIONE E IMPRONTA");
  c("lato lungo 4000 → 2000, proporzioni tenute", { larghezza: 1000, altezza: 2000 }, I.misureRidotte(2000, 4000));
  c("larghezza lunga: 3000×1500 → 2000×1000", { larghezza: 2000, altezza: 1000 }, I.misureRidotte(3000, 1500));
  c("già piccola: non si ingrandisce mai", { larghezza: 1080, altezza: 1920 }, I.misureRidotte(1080, 1920));
  c("uno screenshot di telefono 1170×2532 scende a 924×2000", { larghezza: 924, altezza: 2000 }, I.misureRidotte(1170, 2532));
  c("lato lungo 2001 → 2000", { larghezza: 1000, altezza: 2000 }, I.misureRidotte(1000, 2001));
  c("lato corto che arrotondato fa zero resta almeno 1", 1, I.misureRidotte(10000, 1).altezza);
  c("il limite è 2000 px", 2000, I.LATO_MASSIMO_PX);
  c("SHA-256 di «abc» (valore noto), in esadecimale minuscolo", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    await I.improntaSha256(new TextEncoder().encode("abc").buffer));
  c("lunga 64 caratteri", 64, (await I.improntaSha256(new Uint8Array([1, 2, 3]).buffer)).length);
  c("due file diversi, due impronte diverse; lo stesso, la stessa", [false, true],
    await (async () => {
      const a = await I.improntaSha256(new Uint8Array([1, 2, 3]).buffer);
      const b = await I.improntaSha256(new Uint8Array([1, 2, 4]).buffer);
      const a2 = await I.improntaSha256(new Uint8Array([1, 2, 3]).buffer);
      return [a === b, a === a2];
    })());

  gruppo("BULK · T8 · SOLO CODICE PURO, DOVE DEVE");
  const coda = readFileSync(join(radice, "src/crm/fatture/bulk/coda.ts"), "utf8");
  c("coda.ts: niente setTimeout, Date, fetch, console, Supabase (i tempi si iniettano)", [false, false, false, false, false],
    [/\bsetTimeout\b/.test(coda), /\bDate\b/.test(coda), /\bfetch\(/.test(coda), /console\./.test(coda), /supabase/i.test(coda)]);
  const imm = readFileSync(join(radice, "src/crm/fatture/bulk/immagini.ts"), "utf8");
  c("immagini.ts: niente rete, niente console, niente chiavi, nessuna scrittura nel DOM della pagina", [false, false, false, false],
    [/\bfetch\(/.test(imm), /console\./.test(imm), /supabase/i.test(imm), /document\.body|appendChild|localStorage/.test(imm)]);
}
