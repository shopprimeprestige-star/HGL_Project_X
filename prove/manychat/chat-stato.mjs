/** ── PROVE: CHAT WHATSAPP · LE REGOLE DELLA CHAT ─────────────────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), PIANO.md T3. Le funzioni pure di
 *  `chatwa/stato.ts`: «Da rispondere» (D5, D17, R10), finestra di 24 ore (D15, R9),
 *  stato della casella (D12), abbinamento della scheda (D18), `?chat=` (D21) e il
 *  conteggio per il menu (D25). `adesso` è sempre passato da fuori. Dati inventati.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */

export async function proveChatStato(mod, { c, gruppo }) {
  const S = mod["chatwa/stato"];

  const ADESSO = Date.parse("2026-10-28T12:00:00.000Z");
  const MIN = 60_000;
  const ORA = 60 * MIN;
  const GIORNO = 24 * ORA;
  /** Un istante `ms` prima di ADESSO, come testo ISO. */
  const fa = (ms) => new Date(ADESSO - ms).toISOString();
  const msg = (direction, ms, body = "ciao") => ({ direction, body, created_at: fa(ms) });
  const dr = (contatto, messaggi = []) => S.daRispondere({ contatto, messaggi, adesso: ADESSO });

  /* ── daRispondere: con le colonne ──────────────────────────────────────── */
  gruppo("CHAT · DA RISPONDERE: LE COLONNE (D17)");
  {
    const r = dr({ ultimo_in_entrata_il: fa(10 * MIN), ultimo_in_entrata_anteprima: "Buongiorno", risposto_il: fa(2 * ORA) });
    c("entrata dopo la risposta: in attesa, dal = entrata, fonte colonne",
      { attesa: true, vecchia: false, dal: fa(10 * MIN), anteprima: "Buongiorno", fonte: "colonne" }, r);
  }
  c("risposta dopo l'entrata: non in attesa",
    [false, false, null, "colonne"],
    ((r) => [r.attesa, r.vecchia, r.dal, r.fonte])(dr({ ultimo_in_entrata_il: fa(2 * ORA), risposto_il: fa(10 * MIN) })));
  c("risposta nello stesso istante dell'entrata: non in attesa",
    false, dr({ ultimo_in_entrata_il: fa(5 * MIN), risposto_il: fa(5 * MIN) }).attesa);
  c("risposto vuoto (null): in attesa", true, dr({ ultimo_in_entrata_il: fa(5 * MIN), risposto_il: null }).attesa);
  c("risposto assente: in attesa", true, dr({ ultimo_in_entrata_il: fa(5 * MIN) }).attesa);
  {
    // il cliente era uscito (risposta 1 h fa) e riscrive 3 min fa: rientra col NUOVO orario
    const r = dr({ ultimo_in_entrata_il: fa(3 * MIN), risposto_il: fa(ORA) });
    c("il cliente riscrive dopo la risposta: rientra col nuovo orario", [true, fa(3 * MIN)], [r.attesa, r.dal]);
  }
  c("in attesa da più di 7 giorni con le colonne: resta in attesa, mai `vecchia` (l'attesa non ha limite)",
    [true, false], ((r) => [r.attesa, r.vecchia])(dr({ ultimo_in_entrata_il: fa(30 * GIORNO) })));
  c("STOP non lo toglie: la funzione non conosce lo stop e resta in attesa",
    true, dr({ ultimo_in_entrata_il: fa(MIN), risposto_il: null, non_scrivere_dal: fa(ORA) }).attesa);
  c("le colonne contano più dei messaggi caricati (un'uscita nei messaggi non cambia)",
    true, dr({ ultimo_in_entrata_il: fa(10 * MIN) }, [msg("outbound", MIN)]).attesa);
  c("anteprima assente: null", null, dr({ ultimo_in_entrata_il: fa(MIN) }).anteprima);
  c("data illeggibile nelle colonne: si ripiega sui messaggi",
    ["messaggi", true], ((r) => [r.fonte, r.attesa])(dr({ ultimo_in_entrata_il: "boh" }, [msg("inbound", ORA)])));

  /* ── daRispondere: il ripiego sui messaggi (D5, R10) ───────────────────── */
  gruppo("CHAT · DA RISPONDERE: IL RIPIEGO SUI MESSAGGI (D5, R10)");
  {
    const r = dr(null, [msg("outbound", 3 * GIORNO), msg("inbound", 2 * GIORNO, "Salve")]);
    c("colonne assenti + inbound di 2 giorni fa: in attesa, fonte messaggi",
      { attesa: true, vecchia: false, dal: fa(2 * GIORNO), anteprima: "Salve", fonte: "messaggi" }, r);
  }
  c("contatto con le colonne vuote (non null) = come colonne assenti",
    ["messaggi", true],
    ((r) => [r.fonte, r.attesa])(dr({ ultimo_in_entrata_il: null, risposto_il: null }, [msg("inbound", GIORNO)])));
  {
    const r = dr(null, [msg("inbound", 8 * GIORNO, "Vecchio")]);
    c("inbound di 8 giorni fa: non in attesa ma `vecchia`", [false, true, "messaggi"], [r.attesa, r.vecchia, r.fonte]);
    c("…e `dal`/`anteprima` restano visibili alla riga «più di 7 giorni»", [fa(8 * GIORNO), "Vecchio"], [r.dal, r.anteprima]);
  }
  c("esattamente 7 giorni: ancora in attesa", true, dr(null, [msg("inbound", 7 * GIORNO)]).attesa);
  c("poco oltre 7 giorni: `vecchia`", [false, true],
    ((r) => [r.attesa, r.vecchia])(dr(null, [msg("inbound", 7 * GIORNO + MIN)])));
  c("ultimo messaggio outbound dopo l'inbound: non in attesa e non `vecchia`",
    [false, false, null],
    ((r) => [r.attesa, r.vecchia, r.fonte])(dr(null, [msg("inbound", 2 * ORA), msg("outbound", ORA)])));
  c("…neanche se l'inbound è vecchio di 8 giorni",
    [false, false], ((r) => [r.attesa, r.vecchia])(dr(null, [msg("inbound", 8 * GIORNO), msg("outbound", 7 * GIORNO)])));
  c("outbound PRIMA dell'inbound: l'inbound è senza risposta", true,
    dr(null, [msg("outbound", 3 * ORA), msg("inbound", ORA)]).attesa);
  c("i messaggi non sono ordinati: conta il più recente per data, non per posizione",
    [true, fa(ORA)],
    ((r) => [r.attesa, r.dal])(dr(null, [msg("inbound", ORA), msg("inbound", 5 * ORA), msg("outbound", 3 * ORA)])));
  c("nessun messaggio: tutto vuoto", { attesa: false, vecchia: false, dal: null, anteprima: null, fonte: null }, dr(null, []));
  c("solo messaggi in uscita: non in attesa", false, dr(null, [msg("outbound", ORA)]).attesa);
  // {{...}} come ultimo inbound: ignorato, vale l'inbound vero precedente
  c("`{{last_input_text}}` come ultimo inbound: ignorato (non conta)", false,
    dr(null, [msg("inbound", ORA, "{{last_input_text}}")]).attesa);
  c("…e se prima c'era un messaggio vero, vale quello",
    [true, "Salve", fa(5 * ORA)],
    ((r) => [r.attesa, r.anteprima, r.dal])(dr(null, [msg("inbound", 5 * ORA, "Salve"), msg("inbound", ORA, "{{ last_input_text }}")])));
  c("body nullo (allegato senza testo): conta come inbound, anteprima null",
    [true, null], ((r) => [r.attesa, r.anteprima])(dr(null, [{ direction: "inbound", body: null, created_at: fa(ORA) }])));
  c("created_at illeggibile: il messaggio è ignorato",
    false, dr(null, [{ direction: "inbound", body: "x", created_at: "boh" }]).attesa);
  // «Fatto» premuto su una chat vecchia (colonne vuote ma `risposto_il` scritto)
  c("«Fatto» dopo l'inbound, colonne d'entrata vuote: non in attesa",
    false, dr({ ultimo_in_entrata_il: null, risposto_il: fa(10 * MIN) }, [msg("inbound", ORA)]).attesa);
  c("«Fatto» dopo un inbound di 8 giorni: non `vecchia` (l'ha già gestita)",
    [false, false], ((r) => [r.attesa, r.vecchia])(dr({ risposto_il: fa(GIORNO) }, [msg("inbound", 8 * GIORNO)])));
  c("il cliente riscrive dopo il «Fatto»: rientra",
    true, dr({ risposto_il: fa(2 * ORA) }, [msg("inbound", ORA)]).attesa);

  /* ── contaVecchie ──────────────────────────────────────────────────────── */
  gruppo("CHAT · LE VECCHIE (R10)");
  {
    const righe = [
      dr(null, [msg("inbound", 8 * GIORNO)]), // vecchia
      dr(null, [msg("inbound", 20 * GIORNO)]), // vecchia
      dr(null, [msg("inbound", ORA)]), // in attesa vera
      dr({ ultimo_in_entrata_il: fa(30 * GIORNO) }), // colonne: in attesa vera
      dr(null, [msg("inbound", 9 * GIORNO), msg("outbound", 8 * GIORNO)]), // già risposta
      dr(null, []), // niente
    ];
    c("contaVecchie conta solo `vecchia` (non quelle in attesa vere né quelle risposte)", 2, S.contaVecchie(righe));
    c("contaVecchie([]) = 0", 0, S.contaVecchie([]));
  }

  /* ── ordinaDaRispondere ────────────────────────────────────────────────── */
  gruppo("CHAT · L'ORDINE (D17)");
  {
    const a = { id: "a", dal: fa(10 * MIN) };
    const b = { id: "b", dal: fa(3 * ORA) };
    const cc = { id: "c", dal: fa(2 * GIORNO) };
    const ingresso = [a, b, cc];
    const copia = JSON.stringify(ingresso);
    const fuori = S.ordinaDaRispondere(ingresso);
    c("il più vecchio sopra", ["c", "b", "a"], fuori.map((x) => x.id));
    c("l'ingresso non viene mutato", copia, JSON.stringify(ingresso));
    c("è una copia nuova", true, fuori !== ingresso);
    const p1 = { id: "p1", dal: fa(ORA) };
    const p2 = { id: "p2", dal: fa(ORA) };
    const p3 = { id: "p3", dal: fa(ORA) };
    c("parità: l'ordine di arrivo resta (stabile)", ["p1", "p2", "p3"], S.ordinaDaRispondere([p1, p2, p3]).map((x) => x.id));
    c("parità in mezzo ai diversi: stabile", ["c", "p1", "p2", "a"],
      S.ordinaDaRispondere([p1, a, cc, p2]).map((x) => x.id));
    c("`dal` mancante (null) in fondo", ["c", "a", "n"],
      S.ordinaDaRispondere([{ id: "n", dal: null }, a, cc]).map((x) => x.id));
    c("`dal` illeggibile in fondo", ["a", "x"],
      S.ordinaDaRispondere([{ id: "x", dal: "boh" }, a]).map((x) => x.id));
    c("lista vuota", [], S.ordinaDaRispondere([]));
  }

  /* ── attesaInChiaro ────────────────────────────────────────────────────── */
  gruppo("CHAT · IL TEMPO D'ATTESA IN CHIARO");
  const att = (ms) => S.attesaInChiaro(fa(ms), ADESSO);
  c("20 s → «da meno di 1 min»", "da meno di 1 min", att(20_000));
  c("0 → «da meno di 1 min»", "da meno di 1 min", att(0));
  c("1 min → «da 1 min»", "da 1 min", att(MIN));
  c("25 min → «da 25 min»", "da 25 min", att(25 * MIN));
  c("59 min → «da 59 min»", "da 59 min", att(59 * MIN));
  c("60 min → «da 1 h»", "da 1 h", att(60 * MIN));
  c("3 h 10 min → «da 3 h»", "da 3 h", att(3 * ORA + 10 * MIN));
  c("23 h 59 → «da 23 h»", "da 23 h", att(23 * ORA + 59 * MIN));
  c("24 h → «da 1 giorno»", "da 1 giorno", att(24 * ORA));
  c("47 h → «da 1 giorno»", "da 1 giorno", att(47 * ORA));
  c("50 h → «da 2 giorni»", "da 2 giorni", att(50 * ORA));
  c("30 giorni → «da 30 giorni»", "da 30 giorni", att(30 * GIORNO));
  c("data nel futuro (orologio sfasato) → «da meno di 1 min»", "da meno di 1 min", att(-5 * MIN));
  c("dal null → «da meno di 1 min»", "da meno di 1 min", S.attesaInChiaro(null, ADESSO));
  c("dal illeggibile → «da meno di 1 min»", "da meno di 1 min", S.attesaInChiaro("boh", ADESSO));
  c("accetta anche `Date` e millisecondi", ["da 3 h", "da 3 h"],
    [S.attesaInChiaro(new Date(ADESSO - 3 * ORA), new Date(ADESSO)), S.attesaInChiaro(ADESSO - 3 * ORA, ADESSO)]);

  /* ── finestra24 ────────────────────────────────────────────────────────── */
  gruppo("CHAT · LA FINESTRA DI 24 ORE (D15, R9)");
  const CHIUSA = "Finestra di 24 ore chiusa: puoi mandare solo un modello approvato";
  //  `contatto` non passato = colonna a `trascorso` fa; passato (anche null) = quello.
  const fin = (trascorso, contatto = undefined, messaggi = []) =>
    S.finestra24({
      contatto: contatto === undefined ? { ultimo_in_entrata_il: fa(trascorso) } : contatto,
      messaggi,
      adesso: ADESSO,
    });
  c("22 h 59 trascorse (resta 1 h 01): aperta, «ancora per 1 ora»",
    [true, "Puoi scrivere libero ancora per 1 ora"], ((f) => [f.aperta, f.frase])(fin(22 * ORA + 59 * MIN)));
  c("23 h 59 trascorse (resta 1 minuto): aperta, «ancora per 1 minuto»",
    [true, "Puoi scrivere libero ancora per 1 minuto"], ((f) => [f.aperta, f.frase])(fin(23 * ORA + 59 * MIN)));
  c("23 h 59 min 30 s (restano 30 s): aperta, mai «0 minuti»",
    [true, "Puoi scrivere libero ancora per 1 minuto"], ((f) => [f.aperta, f.frase])(fin(24 * ORA - 30_000)));
  c("24 h 00 esatte: chiusa", [false, CHIUSA], ((f) => [f.aperta, f.frase])(fin(24 * ORA)));
  c("25 h: chiusa", false, fin(25 * ORA).aperta);
  c("5 h trascorse: «ancora per 19 ore»", "Puoi scrivere libero ancora per 19 ore", fin(5 * ORA).frase);
  c("1 min trascorso: «ancora per 23 ore» (resta 23 h 59: si arrotonda per difetto)",
    "Puoi scrivere libero ancora per 23 ore", fin(MIN).frase);
  c("restano 2 h esatte: «2 ore»", "Puoi scrivere libero ancora per 2 ore", fin(22 * ORA).frase);
  c("restano 1 h 59: «1 ora»", "Puoi scrivere libero ancora per 1 ora", fin(22 * ORA + MIN).frase);
  c("restano 1 h esatta: «1 ora»", "Puoi scrivere libero ancora per 1 ora", fin(23 * ORA).frase);
  c("restano 59 min: «59 minuti»", "Puoi scrivere libero ancora per 59 minuti", fin(23 * ORA + MIN).frase);
  c("restano 40 min: «40 minuti»", "Puoi scrivere libero ancora per 40 minuti", fin(23 * ORA + 20 * MIN).frase);
  c("scadeIl = entrata + 24 h quando è aperta", new Date(ADESSO - 5 * ORA + GIORNO).toISOString(), fin(5 * ORA).scadeIl);
  c("scadeIl null quando è chiusa", null, fin(30 * ORA).scadeIl);
  c("mai scritto (niente colonna, niente messaggi): chiusa con la frase del modello",
    [false, null, CHIUSA], ((f) => [f.aperta, f.scadeIl, f.frase])(S.finestra24({ contatto: null, messaggi: [], adesso: ADESSO })));
  c("contatto senza colonna, ultimo inbound caricato 2 h fa: aperta",
    [true, "Puoi scrivere libero ancora per 22 ore"],
    ((f) => [f.aperta, f.frase])(fin(0, { ultimo_in_entrata_il: null }, [msg("inbound", 5 * ORA), msg("inbound", 2 * ORA), msg("outbound", MIN)])));
  c("…solo i messaggi in uscita non aprono la finestra",
    false, fin(0, null, [msg("outbound", MIN)]).aperta);
  c("…l'inbound più recente per data, non per posizione",
    true, fin(0, null, [msg("inbound", ORA), msg("inbound", 40 * ORA)]).aperta);
  c("la colonna vince sui messaggi (colonna vecchia, messaggio recente → chiusa)",
    false, fin(0, { ultimo_in_entrata_il: fa(30 * ORA) }, [msg("inbound", MIN)]).aperta);
  c("colonna illeggibile: si ripiega sui messaggi", true,
    fin(0, { ultimo_in_entrata_il: "boh" }, [msg("inbound", ORA)]).aperta);
  c("entrata nel futuro (orologio sfasato): aperta, non più di 24 ore",
    [true, "Puoi scrivere libero ancora per 24 ore"], ((f) => [f.aperta, f.frase])(fin(-5 * MIN)));
  c("senza colonne il segnaposto `{{...}}` apre comunque la finestra (è un cliente che ha scritto)",
    true, fin(0, null, [msg("inbound", ORA, "{{last_input_text}}")]).aperta);

  /* ── statoCasella ──────────────────────────────────────────────────────── */
  gruppo("CHAT · LA CASELLA (D12)");
  const cas = (o) => S.statoCasella({ stop: false, finestraAperta: true, canale: "manychat", chiaviMeta: false, ...o });
  c("ManyChat senza chiavi Meta, finestra aperta: libera", "libera", cas({}));
  c("cloud senza chiavi Meta: configura", "configura", cas({ canale: "cloud", chiaviMeta: false }));
  c("cloud con le chiavi: libera", "libera", cas({ canale: "cloud", chiaviMeta: true }));
  c("canale non letto (null) senza chiavi: NON configura", "libera", cas({ canale: null, chiaviMeta: false }));
  c("canale non letto con finestra chiusa: solo modelli", "solo_modelli", cas({ canale: null, finestraAperta: false }));
  c("stop: stop anche con finestra aperta", "stop", cas({ stop: true }));
  c("stop prevale su tutto (finestra chiusa, cloud senza chiavi, forzaModelli)", "stop",
    cas({ stop: true, finestraAperta: false, canale: "cloud", forzaModelli: true }));
  c("finestra chiusa: solo modelli", "solo_modelli", cas({ finestraAperta: false }));
  c("forzaModelli con finestra aperta: solo modelli", "solo_modelli", cas({ forzaModelli: true }));
  c("forzaModelli false: come se non ci fosse", "libera", cas({ forzaModelli: false }));
  c("cloud senza chiavi con finestra chiusa: configura (prima le chiavi)", "configura",
    cas({ canale: "cloud", chiaviMeta: false, finestraAperta: false }));

  /* ── schedaUnica ───────────────────────────────────────────────────────── */
  gruppo("CHAT · L'ABBINAMENTO DELLA SCHEDA (D18)");
  {
    const L = (id, phone) => ({ id, phone });
    const una = S.schedaUnica([L(1, "333 123 4567"), L(2, "320 999 8888")], "+39 333 123 4567");
    c("una scheda che combacia: `una` con quella scheda", ["una", 1], [una.tipo, una.lead?.id]);
    c("due schede con lo stesso numero (formati diversi): `piu`", { tipo: "piu" },
      S.schedaUnica([L(1, "333 123 4567"), L(2, "+393331234567"), L(3, "320 999 8888")], "393331234567"));
    c("nessuna: `nessuna`", { tipo: "nessuna" }, S.schedaUnica([L(1, "320 999 8888")], "+393331234567"));
    c("nessuna scheda in elenco", { tipo: "nessuna" }, S.schedaUnica([], "+393331234567"));
    c("prefisso 0039 contro +39: combacia", ["una", 1],
      ((e) => [e.tipo, e.lead?.id])(S.schedaUnica([L(1, "0039 333 1234567")], "+39 333 1234567")));
    c("spazi, trattini e parentesi: combacia", ["una", 1],
      ((e) => [e.tipo, e.lead?.id])(S.schedaUnica([L(1, "(333) 123-4567")], "393331234567")));
    c("numero della chat troppo corto (< 8 cifre): nessuna, mai «combacia con tutti»", { tipo: "nessuna" },
      S.schedaUnica([L(1, "1234567"), L(2, "1234567")], "1234567"));
    c("numero vuoto: nessuna", { tipo: "nessuna" }, S.schedaUnica([L(1, "")], ""));
    c("telefono della scheda troppo corto o vuoto: non combacia", { tipo: "nessuna" },
      S.schedaUnica([L(1, "4567"), L(2, null), { id: 3 }], "393331234567"));
    c("otto cifre uguali: combacia (soglia inclusa)", ["una", 1],
      ((e) => [e.tipo, e.lead?.id])(S.schedaUnica([L(1, "31234567")], "31234567")));
    c("stesse ultime 9 cifre con prefisso diverso: combacia (come `phonesMatch` di oggi)", ["una", 1],
      ((e) => [e.tipo, e.lead?.id])(S.schedaUnica([L(1, "+44 333 1234567")], "+39 333 1234567")));
    c("una sola che combacia in mezzo a molte che non combaciano", ["una", 3],
      ((e) => [e.tipo, e.lead?.id])(S.schedaUnica([L(1, "320 111 2222"), L(2, "340 111 2222"), L(3, "333 123 4567")], "393331234567")));
    // le schede del CRM tengono il telefono in `data.telefono`
    const reale = S.schedaUnica([{ id: "x", data: { telefono: "333 123 4567" } }], "+393331234567");
    c("scheda del CRM (`data.telefono`): combacia", ["una", "x"], [reale.tipo, reale.lead?.id]);
    const lead = L(7, "333 123 4567");
    c("restituisce lo STESSO oggetto della lista (nessuna copia)", true, S.schedaUnica([lead], "393331234567").lead === lead);
  }

  /* ── leggiRicercaChat ──────────────────────────────────────────────────── */
  gruppo("CHAT · ?chat= NELL'INDIRIZZO (D21)");
  {
    const U = "3f2b8c1e-5a4d-4e6f-9b0a-1c2d3e4f5a6b";
    c("uuid valido: { chat }", { chat: U }, S.leggiRicercaChat({ chat: U }));
    c("uuid in maiuscolo: normalizzato in minuscolo", { chat: U }, S.leggiRicercaChat({ chat: U.toUpperCase() }));
    c("numero di telefono: ignorato", {}, S.leggiRicercaChat({ chat: "+393331234567" }));
    c("numero senza più: ignorato", {}, S.leggiRicercaChat({ chat: "393331234567" }));
    c("stringa vuota: ignorata", {}, S.leggiRicercaChat({ chat: "" }));
    c("stringa lunga: ignorata", {}, S.leggiRicercaChat({ chat: "a".repeat(5000) }));
    c("uuid con coda: ignorato", {}, S.leggiRicercaChat({ chat: U + "x" }));
    c("uuid con spazi attorno: ignorato", {}, S.leggiRicercaChat({ chat: ` ${U} ` }));
    c("uuid con a capo: ignorato", {}, S.leggiRicercaChat({ chat: U + "\n" }));
    c("array: ignorato", {}, S.leggiRicercaChat({ chat: [U] }));
    c("oggetto: ignorato", {}, S.leggiRicercaChat({ chat: { a: U } }));
    c("numero JS: ignorato", {}, S.leggiRicercaChat({ chat: 12345 }));
    c("senza `chat`: {}", {}, S.leggiRicercaChat({}));
    c("`__proto__` come chiave: ignorato", {}, S.leggiRicercaChat(JSON.parse('{"__proto__":{"chat":"' + U + '"}}')));
    c("chat ereditata dal prototipo: ignorata", {}, S.leggiRicercaChat(Object.create({ chat: U })));
    c("altre chiavi non passano", { chat: U }, S.leggiRicercaChat({ chat: U, x: "y", __proto__: { z: 1 } }));
    c("raw null/non oggetto: {}", [{}, {}, {}], [S.leggiRicercaChat(null), S.leggiRicercaChat(undefined), S.leggiRicercaChat("chat")]);
    c("l'uscita non porta il prototipo di Object con campi strani", false, "chat" in S.leggiRicercaChat({ chat: "no" }));
  }

  /* ── contaDaRispondere ─────────────────────────────────────────────────── */
  gruppo("CHAT · IL NUMERETTO DEL MENU (D25)");
  {
    const contatti = [
      { ultimo_in_entrata_il: fa(MIN), risposto_il: null }, // sì
      { ultimo_in_entrata_il: fa(30 * GIORNO), risposto_il: fa(31 * GIORNO) }, // sì (riscritto dopo risposta)
      { ultimo_in_entrata_il: fa(ORA), risposto_il: fa(MIN) }, // no (risposto)
      { ultimo_in_entrata_il: fa(ORA), risposto_il: fa(ORA) }, // no (pari)
      {}, // senza colonne
      { ultimo_in_entrata_il: null, risposto_il: null }, // colonne vuote
    ];
    c("conta solo i contatti in attesa; senza colonne → 0", 2, S.contaDaRispondere(contatti, ADESSO));
    c("lista vuota: 0", 0, S.contaDaRispondere([], ADESSO));
    c("contatto con `risposto_il` ma senza entrata: 0", 0, S.contaDaRispondere([{ risposto_il: fa(MIN) }], ADESSO));
  }

  /* ── tempo: nessun input del cliente può bloccare il Worker ───────────── */
  gruppo("CHAT · TEMPI (testo del cliente nel ripiego)");
  {
    const prova = (nome, body) => {
      const t0 = performance.now();
      const r = dr(null, [msg("inbound", ORA, body)]);
      const ms = performance.now() - t0;
      c(`${nome}: risponde sotto 50 ms`, true, ms < 50);
      return r;
    };
    prova("40 gruppi `{{a}}  ` + x", "{{a}}  ".repeat(40) + "x");
    prova("2000 gruppi + x", "{{a}} ".repeat(2000) + "x");
    prova("10000 spazi + x", " ".repeat(10000) + "x");
    prova("`{{` + 10000 a", "{{" + "a".repeat(10000));
    c("molti segnaposto di fila e basta: ignorato", false, dr(null, [msg("inbound", ORA, "{{a}} {{b}}\n{{c}}")]).attesa);
    c("segnaposto + testo vero: è un messaggio vero", true, dr(null, [msg("inbound", ORA, "{{a}} ciao")]).attesa);
  }
}
