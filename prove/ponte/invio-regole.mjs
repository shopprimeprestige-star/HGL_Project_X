/** ── PROVE: INVIO A MANO DAL PONTE · LE REGOLE PURE (compito T2) ──
 *
 *  Commessa 2026-10-30-ponte-invio-manuale. Le funzioni di
 *  `src/crm/ponte/invio.ts`: chi può accodare e in che ordine si rifiuta, la
 *  frase di ogni motivo, gli stati visti dal browser, il riprova, la vista
 *  della coda senza doppioni e la lettura dei tre corpi JSON. Nessun database,
 *  orologio finto. Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */

/** Parole che il titolare non deve mai leggere (le stesse dell'avviso del ponte, più «ponte»). */
const VIETATE = /\b(QR|Baileys|token|JID|LID|sessione|battito|server|database|API|socket|log|ponte)\b/i;

export async function provePonteInvioRegole(mod, { c, gruppo, radice }) {
  const I = mod["ponte/invio"];
  const T = mod["ponte/invio-tipi"];
  const L = T.LIMITI_INVIO;

  const ADESSO = new Date("2026-10-30T12:00:00.000Z");
  const SEC = 1000;
  const MIN = 60 * SEC;
  const fa = (ms) => new Date(ADESSO.getTime() - ms).toISOString();
  const NUMERO = "393330000001";

  //  I fatti di una chat in cui tutto va bene; ogni prova ne cambia uno.
  const fatti = (o = {}) => ({
    entrata: true,
    stop: false,
    ponte_stato: "collegato",
    ponte_battito: fa(10 * SEC),
    invii_attivi: true,
    ultime24h: 0,
    in_coda: 0,
    ...o,
  });
  const controlla = (o = {}) => I.controllaAccodamento({ testo: "Buongiorno, ci vediamo domani", numero: NUMERO, fatti: fatti(), adesso: ADESSO, ...o });

  /* ═══ normalizzaNumero ═══ */
  gruppo("PONTE · INVIO A MANO · IL NUMERO (T2)");
  c(
    "normalizzaNumero: cifre 8-15, anche con «+» e spazi",
    [NUMERO, NUMERO, "12345678", "123456789012345"],
    [I.normalizzaNumero(NUMERO), I.normalizzaNumero("+39 333 000-0001"), I.normalizzaNumero("12345678"), I.normalizzaNumero("123456789012345")],
  );
  c(
    "normalizzaNumero: 7 e 16 cifre, gruppi, @lid, lettere, vuoto e non-stringhe → null",
    Array(10).fill(null),
    [
      I.normalizzaNumero("1234567"),
      I.normalizzaNumero("1234567890123456"),
      I.normalizzaNumero("120363000000000000@g.us"),
      I.normalizzaNumero("393330000001@lid"),
      I.normalizzaNumero("393330000001@s.whatsapp.net"),
      I.normalizzaNumero("../../etc"),
      I.normalizzaNumero(""),
      I.normalizzaNumero(null),
      I.normalizzaNumero(undefined),
      I.normalizzaNumero({ numero: NUMERO }),
    ],
  );

  /* ═══ ponteCollegato ═══ */
  gruppo("PONTE · INVIO A MANO · IL COLLEGAMENTO (T2)");
  const ponte = (ms, o = {}) => ({ stato: "collegato", aggiornato_il: fa(ms), invii_attivi: true, ...o });
  c("battito a 179 s: collegato", { ok: true }, I.ponteCollegato(ponte(179 * SEC), ADESSO));
  c("battito a 180 s: ancora collegato (≤ soglia)", { ok: true }, I.ponteCollegato(ponte(180 * SEC), ADESSO));
  c("battito a 181 s: non collegato", { ok: false, motivo: "ponte_non_collegato" }, I.ponteCollegato(ponte(181 * SEC), ADESSO));
  c("stato diverso da collegato: no", { ok: false, motivo: "ponte_non_collegato" }, I.ponteCollegato(ponte(5 * SEC, { stato: "attesa_qr" }), ADESSO));
  c("nessuna riga di stato: no", { ok: false, motivo: "ponte_non_collegato" }, I.ponteCollegato(null, ADESSO));
  c("data illeggibile: no", { ok: false, motivo: "ponte_non_collegato" }, I.ponteCollegato(ponte(0, { aggiornato_il: "ieri" }), ADESSO));
  c("orologio indietro (battito nel futuro): si considera fresco", { ok: true }, I.ponteCollegato(ponte(-5 * MIN), ADESSO));
  c("invii_attivi=false → invii_spenti", { ok: false, motivo: "invii_spenti" }, I.ponteCollegato(ponte(5 * SEC, { invii_attivi: false }), ADESSO));
  c("invii_attivi non dichiarato → invii_spenti (un ponte vecchio non invia)", { ok: false, motivo: "invii_spenti" }, I.ponteCollegato({ stato: "collegato", aggiornato_il: fa(5 * SEC) }, ADESSO));
  c("ponte fermo e invii spenti: vince «non collegato»", { ok: false, motivo: "ponte_non_collegato" }, I.ponteCollegato(ponte(10 * MIN, { invii_attivi: false }), ADESSO));

  /* ═══ controllaAccodamento ═══ */
  gruppo("PONTE · INVIO A MANO · CHI PUÒ ACCODARE (T2)");
  c("tutto a posto: ok", { ok: true }, controlla());
  c("testo vuoto", { ok: false, motivo: "testo_vuoto" }, controlla({ testo: "" }));
  c("testo di soli spazi e a capo", { ok: false, motivo: "testo_vuoto" }, controlla({ testo: " \n\t  " }));
  c("testo non stringa: vuoto", { ok: false, motivo: "testo_vuoto" }, controlla({ testo: null }));
  c("2000 caratteri passano", { ok: true }, controlla({ testo: "a".repeat(2000) }));
  c("2001 caratteri no", { ok: false, motivo: "testo_lungo" }, controlla({ testo: "a".repeat(2001) }));
  c("2000 emoji (coppie surrogate, 4000 unità) passano: si contano i punti di codice", { ok: true }, controlla({ testo: "😀".repeat(2000) }));
  c("2001 emoji no", { ok: false, motivo: "testo_lungo" }, controlla({ testo: "😀".repeat(2001) }));
  c("numero non valido", { ok: false, motivo: "numero_non_valido" }, controlla({ numero: "12345" }));
  c("numero di un gruppo", { ok: false, motivo: "numero_non_valido" }, controlla({ numero: "120363000000000000@g.us" }));
  c("ponte fermo", { ok: false, motivo: "ponte_non_collegato" }, controlla({ fatti: fatti({ ponte_battito: fa(10 * MIN) }) }));
  c("ponte senza riga di stato", { ok: false, motivo: "ponte_non_collegato" }, controlla({ fatti: fatti({ ponte_stato: null, ponte_battito: null }) }));
  c("ponte con battito a 179 s", { ok: true }, controlla({ fatti: fatti({ ponte_battito: fa(179 * SEC) }) }));
  c("ponte con battito a 181 s", { ok: false, motivo: "ponte_non_collegato" }, controlla({ fatti: fatti({ ponte_battito: fa(181 * SEC) }) }));
  c("stato del ponte diverso da collegato", { ok: false, motivo: "ponte_non_collegato" }, controlla({ fatti: fatti({ ponte_stato: "sostituita" }) }));
  c("invii spenti sul Mac", { ok: false, motivo: "invii_spenti" }, controlla({ fatti: fatti({ invii_attivi: false }) }));
  c("STOP", { ok: false, motivo: "stop" }, controlla({ fatti: fatti({ stop: true }) }));
  c("mai scritto", { ok: false, motivo: "mai_scritto" }, controlla({ fatti: fatti({ entrata: false }) }));
  c("il 20° messaggio nelle 24 ore passa (19 già presi)", { ok: true }, controlla({ fatti: fatti({ ultime24h: 19 }) }));
  c("il 21° no (20 già presi)", { ok: false, motivo: "limite_giornaliero" }, controlla({ fatti: fatti({ ultime24h: 20 }) }));
  c("coda a 2: passa", { ok: true }, controlla({ fatti: fatti({ in_coda: 2 }) }));
  c("coda a 3: coda_piena", { ok: false, motivo: "coda_piena" }, controlla({ fatti: fatti({ in_coda: 3 }) }));
  //  L'ordine: ogni coppia dice chi vince.
  const tutto = { testo: "", numero: "1", fatti: fatti({ ponte_battito: fa(10 * MIN), stop: true, entrata: false, ultime24h: 99, in_coda: 9 }) };
  c("ordine 1: testo vuoto prima di tutto", "testo_vuoto", controlla(tutto).motivo);
  c("ordine 2: testo lungo prima del numero", "testo_lungo", controlla({ ...tutto, testo: "a".repeat(2001) }).motivo);
  c("ordine 3: numero non valido prima del ponte", "numero_non_valido", controlla({ ...tutto, testo: "ciao" }).motivo);
  c("ordine 4: ponte non collegato prima di STOP", "ponte_non_collegato", controlla({ ...tutto, testo: "ciao", numero: NUMERO }).motivo);
  const conPonte = { testo: "ciao", numero: NUMERO, fatti: fatti({ stop: true, entrata: false, ultime24h: 99, in_coda: 9 }) };
  c("ordine 5: STOP prima di «mai scritto»", "stop", controlla(conPonte).motivo);
  c("ordine 6: «mai scritto» prima del limite", "mai_scritto", controlla({ ...conPonte, fatti: fatti({ entrata: false, ultime24h: 99, in_coda: 9 }) }).motivo);
  c("ordine 7: limite giornaliero prima della coda piena", "limite_giornaliero", controlla({ ...conPonte, fatti: fatti({ ultime24h: 99, in_coda: 9 }) }).motivo);
  c("ordine 8: la coda piena per ultima", "coda_piena", controlla({ ...conPonte, fatti: fatti({ in_coda: 9 }) }).motivo);
  c("non lancia con fatti storti", { ok: false, motivo: "ponte_non_collegato" }, controlla({ fatti: {} }));
  c("non lancia con testo e numero assenti", { ok: false, motivo: "testo_vuoto" }, I.controllaAccodamento({ fatti: fatti(), adesso: ADESSO }));

  /* ═══ fraseMotivo ═══ */
  gruppo("PONTE · INVIO A MANO · LE FRASI PER IL TITOLARE (T2)");
  const tutti = [...new Set([...T.MOTIVI_INVIO, ...T.MOTIVI_RIFIUTO])];
  for (const m of tutti) {
    const f = I.fraseMotivo(m);
    c(`«${m}» ha una frase italiana, senza gergo`, [true, null], [typeof f === "string" && f.length > 8 && /[.?!]$/.test(f), f.match(VIETATE)?.[0] ?? null]);
  }
  c("le frasi indicate dal piano", ["Non so se è partito: guarda sul telefono prima di riprovare.", "Non è partito entro 10 minuti: il Mac era spento o occupato.", "Questo cliente non ci ha mai scritto: non posso mandargli un messaggio libero."], [I.fraseMotivo("esito_incerto"), I.fraseMotivo("scaduto"), I.fraseMotivo("mai_scritto")]);
  c("i numeri nelle frasi sono quelli dei limiti", [true, true, true], [I.fraseMotivo("limite_giornaliero").includes(String(L.alGiorno)), I.fraseMotivo("testo_lungo").includes(String(L.caratteri)), I.fraseMotivo("scaduto").includes(String(L.scadenzaMin))]);
  c("motivo sconosciuto o assente: una frase generica, senza gergo", [true, true, null], [typeof I.fraseMotivo("boh") === "string" && I.fraseMotivo("boh").length > 8, I.fraseMotivo(null) === I.fraseMotivo(undefined), I.fraseMotivo("boh").match(VIETATE)?.[0] ?? null]);
  c("la frase della conferma per un invio incerto", true, /Riprovare lo stesso\?$/.test(I.FRASE_CONFERMA_INCERTO) && !VIETATE.test(I.FRASE_CONFERMA_INCERTO));

  /* ═══ statoVisibile ═══ */
  gruppo("PONTE · INVIO A MANO · GLI STATI VISTI DAL BROWSER (T2)");
  const riga = (o = {}) => ({
    id: "11111111-1111-4111-8111-111111111111",
    chiave: "chiave-di-prova-0001",
    numero: NUMERO,
    testo: "Buongiorno",
    stato: "in_attesa",
    motivo: null,
    created_at: fa(5 * SEC),
    preso_il: null,
    inviato_il: null,
    wa_message_id: null,
    ...o,
  });
  const sv = (o) => I.statoVisibile(riga(o), ADESSO);
  const attesa = sv();
  c("in_attesa appena messa: fase in_attesa, niente riprova, non incerta", ["in_attesa", null, false, false], [attesa.fase, attesa.motivo, attesa.puoRiprovare, attesa.incerto]);
  c("in_attesa: frase «In invio dal telefono…»", "In invio dal telefono…", attesa.frase);
  c("in_attesa a 9:59: ancora in attesa", "in_attesa", sv({ created_at: fa(9 * MIN + 59 * SEC) }).fase);
  c("in_attesa a 10:00: ancora in attesa (si scade oltre)", "in_attesa", sv({ created_at: fa(10 * MIN) }).fase);
  const scaduta = sv({ created_at: fa(10 * MIN + SEC) });
  c("in_attesa a 10:01: non_inviato · scaduto, si può riprovare", ["non_inviato", "scaduto", true, false], [scaduta.fase, scaduta.motivo, scaduta.puoRiprovare, scaduta.incerto]);
  c("…con la frase del motivo", I.fraseMotivo("scaduto"), scaduta.frase);
  const invio = (ms) => sv({ stato: "in_invio", created_at: fa(20 * MIN), preso_il: fa(ms) });
  c("in_invio a 2:59: ancora in invio", ["in_invio", false], [invio(2 * MIN + 59 * SEC).fase, invio(2 * MIN + 59 * SEC).puoRiprovare]);
  c("in_invio a 3:00: ancora in invio", "in_invio", invio(3 * MIN).fase);
  const incerta = invio(3 * MIN + SEC);
  c("in_invio a 3:01: non_inviato · esito_incerto, incerta, si può riprovare (con conferma)", ["non_inviato", "esito_incerto", true, true], [incerta.fase, incerta.motivo, incerta.incerto, incerta.puoRiprovare]);
  c("…con la frase che dice di guardare il telefono", I.fraseMotivo("esito_incerto"), incerta.frase);
  c("in_invio senza preso_il: si conta da created_at", "non_inviato", sv({ stato: "in_invio", created_at: fa(4 * MIN), preso_il: null }).fase);
  const inviata = sv({ stato: "inviato", preso_il: fa(30 * SEC), inviato_il: fa(10 * SEC), wa_message_id: "3EB0PROVA1" });
  c("inviato: fase inviato, niente riprova, non incerta", ["inviato", null, false, false], [inviata.fase, inviata.motivo, inviata.puoRiprovare, inviata.incerto]);
  c("…frase breve", true, typeof inviata.frase === "string" && inviata.frase.length > 3);
  for (const m of T.MOTIVI_INVIO) {
    const v = sv({ stato: "non_inviato", motivo: m });
    const riprova = m !== "stop" && m !== "mai_scritto";
    c(`non_inviato · ${m}: riprova ${riprova ? "sì" : "no"}, incerta ${m === "esito_incerto" ? "sì" : "no"}, frase del motivo`, [riprova, m === "esito_incerto", I.fraseMotivo(m)], [v.puoRiprovare, v.incerto, v.frase]);
  }
  c("non_inviato senza motivo scritto: si legge come errore_invio, riprovabile", ["errore_invio", true], [sv({ stato: "non_inviato", motivo: null }).motivo, sv({ stato: "non_inviato", motivo: null }).puoRiprovare]);
  c("non lancia con date illeggibili", "in_attesa", sv({ created_at: "boh" }).fase);

  /* ═══ puoRiprovare ═══ */
  gruppo("PONTE · INVIO A MANO · IL RIPROVA (T2)");
  const pr = (o) => I.puoRiprovare(riga(o));
  c("scaduto: sì, senza conferma", { ok: true, serveConferma: false }, pr({ stato: "non_inviato", motivo: "scaduto" }));
  c("errore_invio, non_collegato, limite_ponte, numero/testo non validi: sì, senza conferma", Array(5).fill({ ok: true, serveConferma: false }), ["errore_invio", "non_collegato", "limite_ponte", "numero_non_valido", "testo_non_valido"].map((m) => pr({ stato: "non_inviato", motivo: m })));
  c("esito_incerto: sì, ma con la conferma", { ok: true, serveConferma: true }, pr({ stato: "non_inviato", motivo: "esito_incerto" }));
  c("stop: no", { ok: false, motivo: "non_riprovabile" }, pr({ stato: "non_inviato", motivo: "stop" }));
  c("mai_scritto: no", { ok: false, motivo: "non_riprovabile" }, pr({ stato: "non_inviato", motivo: "mai_scritto" }));
  c("inviato: no", { ok: false, motivo: "non_riprovabile" }, pr({ stato: "inviato" }));
  c("in_attesa: no", { ok: false, motivo: "non_riprovabile" }, pr({ stato: "in_attesa" }));
  c("in_invio: no", { ok: false, motivo: "non_riprovabile" }, pr({ stato: "in_invio" }));
  c("non_inviato senza motivo: sì (errore_invio)", { ok: true, serveConferma: false }, pr({ stato: "non_inviato", motivo: null }));

  /* ═══ vistaCoda ═══ */
  gruppo("PONTE · INVIO A MANO · LA VISTA DELLA CODA, SENZA DOPPIONI (T2)");
  const msg = (o = {}) => ({ wa_message_id: null, direction: "outbound", body: "Buongiorno", created_at: fa(5 * SEC), canale: "baileys", ...o });
  const inv = (o = {}) => riga({ stato: "inviato", preso_il: fa(60 * SEC), inviato_il: fa(20 * SEC), wa_message_id: "3EB0AAAA", ...o });
  const ids = (righe) => righe.map((r) => r.id);
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  c("coda vuota: vuota", [], I.vistaCoda([], [], ADESSO));
  c("una riga inviato la cui riga bw: c'è già: nascosta", [], ids(I.vistaCoda([inv({ id: A })], [msg({ wa_message_id: `bw:${NUMERO}:3EB0AAAA` })], ADESSO)));
  c("inviato senza la riga bw: a 89 s dall'invio: mostrata", [A], ids(I.vistaCoda([inv({ id: A, inviato_il: fa(89 * SEC) })], [], ADESSO)));
  c("inviato senza la riga bw: a 91 s dall'invio: nascosta", [], ids(I.vistaCoda([inv({ id: A, inviato_il: fa(91 * SEC) })], [], ADESSO)));
  c("inviato senza inviato_il: si conta da created_at", [], ids(I.vistaCoda([inv({ id: A, inviato_il: null, created_at: fa(5 * MIN) })], [], ADESSO)));
  c("la riga bw: di un altro numero non nasconde", [A], ids(I.vistaCoda([inv({ id: A })], [msg({ wa_message_id: "bw:393330000999:3EB0AAAA" })], ADESSO)));
  c("in_attesa, in_invio e non_inviato (non incerto) restano, dal più vecchio", [C, B, A], ids(I.vistaCoda([riga({ id: A, created_at: fa(30 * SEC) }), riga({ id: B, stato: "in_invio", created_at: fa(60 * SEC), preso_il: fa(30 * SEC) }), riga({ id: C, stato: "non_inviato", motivo: "scaduto", created_at: fa(20 * MIN) })], [], ADESSO)));
  const incertaRiga = (o = {}) => riga({ id: A, stato: "non_inviato", motivo: "esito_incerto", testo: "Ci vediamo domani", created_at: fa(5 * MIN), preso_il: fa(4 * MIN), ...o });
  c("esito_incerto con l'eco (stesso testo, uscita baileys dopo il prelievo): nascosta", [], ids(I.vistaCoda([incertaRiga()], [msg({ body: "Ci vediamo domani", created_at: fa(3 * MIN) })], ADESSO)));
  c("…anche se maiuscole e spazi sono diversi", [], ids(I.vistaCoda([incertaRiga()], [msg({ body: "  ci  VEDIAMO\ndomani ", created_at: fa(3 * MIN) })], ADESSO)));
  c("…eco appena prima del prelievo (−60 s di tolleranza): nascosta", [], ids(I.vistaCoda([incertaRiga()], [msg({ body: "Ci vediamo domani", created_at: fa(4 * MIN + 30 * SEC) })], ADESSO)));
  c("…eco più vecchia del prelievo di 61 s: l'incerta resta", [A], ids(I.vistaCoda([incertaRiga()], [msg({ body: "Ci vediamo domani", created_at: fa(4 * MIN + 61 * SEC) })], ADESSO)));
  c("esito_incerto con un testo diverso: resta", [A], ids(I.vistaCoda([incertaRiga()], [msg({ body: "Un'altra frase", created_at: fa(3 * MIN) })], ADESSO)));
  c("esito_incerto: un'entrata con lo stesso testo non conta", [A], ids(I.vistaCoda([incertaRiga()], [msg({ body: "Ci vediamo domani", direction: "inbound", created_at: fa(3 * MIN) })], ADESSO)));
  c("esito_incerto: un'uscita di ManyChat con lo stesso testo non conta (solo l'eco del ponte)", [A], ids(I.vistaCoda([incertaRiga()], [msg({ body: "Ci vediamo domani", canale: "manychat", created_at: fa(3 * MIN) })], ADESSO)));
  c("in_invio diventato incerto a vista (oltre 3 minuti) con l'eco: nascosta", [], ids(I.vistaCoda([riga({ id: A, stato: "in_invio", testo: "Ci vediamo domani", created_at: fa(5 * MIN), preso_il: fa(4 * MIN) })], [msg({ body: "Ci vediamo domani", created_at: fa(3 * MIN) })], ADESSO)));
  c("stesso testo mandato due volte, una sola eco: una bolla resta", 1, I.vistaCoda([incertaRiga({ id: A }), incertaRiga({ id: B, created_at: fa(4 * MIN), preso_il: fa(3 * MIN + 30 * SEC) })], [msg({ body: "Ci vediamo domani", created_at: fa(3 * MIN) })], ADESSO).length);
  c("…due eco: nessuna bolla", 0, I.vistaCoda([incertaRiga({ id: A }), incertaRiga({ id: B, created_at: fa(4 * MIN), preso_il: fa(3 * MIN + 30 * SEC) })], [msg({ body: "Ci vediamo domani", created_at: fa(3 * MIN) }), msg({ body: "Ci vediamo domani", created_at: fa(2 * MIN) })], ADESSO).length);
  c("…nessuna eco: due bolle", 2, I.vistaCoda([incertaRiga({ id: A }), incertaRiga({ id: B })], [], ADESSO).length);
  c("l'eco di una riga inviato (stessa chiave) non nasconde un'incerta con lo stesso testo", [A], ids(I.vistaCoda([incertaRiga({ id: A }), inv({ id: B, testo: "Ci vediamo domani", wa_message_id: "3EB0BBBB" })], [msg({ body: "Ci vediamo domani", wa_message_id: `bw:${NUMERO}:3EB0BBBB`, created_at: fa(3 * MIN) })], ADESSO)));
  c("ordine per created_at, dal più vecchio", [B, C, A], ids(I.vistaCoda([riga({ id: A, created_at: fa(10 * SEC) }), riga({ id: B, created_at: fa(50 * SEC) }), riga({ id: C, created_at: fa(30 * SEC) })], [], ADESSO)));
  const dentro = [riga({ id: A })];
  const copia = JSON.stringify(dentro);
  I.vistaCoda(dentro, [msg()], ADESSO);
  c("non muta l'ingresso", copia, JSON.stringify(dentro));

  /* ═══ leggiRichiestaBrowser ═══ */
  gruppo("PONTE · INVIO A MANO · LETTURA DEI TRE CORPI JSON (T2)");
  const CH = "k".repeat(32);
  const U = "11111111-2222-4333-8444-555555555555";
  const lr = (j) => I.leggiRichiestaBrowser(j);
  c("accoda valido", { ok: true, r: { azione: "accoda", numero: NUMERO, testo: "Ciao", chiave: CH } }, lr({ azione: "accoda", numero: `+${NUMERO}`, testo: "Ciao", chiave: CH }));
  c("accoda: il testo non si taglia né si pulisce negli spazi", "  Ciao\ncome stai?  ", lr({ azione: "accoda", numero: NUMERO, testo: "  Ciao\ncome stai?  ", chiave: CH }).r.testo);
  c("accoda: \\u0000 tolto, surrogata isolata → \\uFFFD", "ab�c", lr({ azione: "accoda", numero: NUMERO, testo: "a\u0000b\uD83Dc", chiave: CH }).r.testo);
  c("accoda: una coppia surrogata intera resta", "😀", lr({ azione: "accoda", numero: NUMERO, testo: "😀", chiave: CH }).r.testo);
  c("accoda: 2001 caratteri è un rifiuto, non un taglio", { ok: false, motivo: "testo_lungo" }, lr({ azione: "accoda", numero: NUMERO, testo: "a".repeat(2001), chiave: CH }));
  c("accoda: 2000 emoji passano", true, lr({ azione: "accoda", numero: NUMERO, testo: "😀".repeat(2000), chiave: CH }).ok);
  c("accoda: testo vuoto o solo spazi", [{ ok: false, motivo: "testo_vuoto" }, { ok: false, motivo: "testo_vuoto" }, { ok: false, motivo: "testo_vuoto" }], [lr({ azione: "accoda", numero: NUMERO, testo: "", chiave: CH }), lr({ azione: "accoda", numero: NUMERO, testo: "   ", chiave: CH }), lr({ azione: "accoda", numero: NUMERO, chiave: CH })]);
  c("accoda: numero non valido", { ok: false, motivo: "numero_non_valido" }, lr({ azione: "accoda", numero: "123", testo: "Ciao", chiave: CH }));
  c("accoda: chiave corta (7), lunga (65), con caratteri vietati, assente", Array(4).fill({ ok: false, motivo: "corpo_non_valido" }), [lr({ azione: "accoda", numero: NUMERO, testo: "Ciao", chiave: "k".repeat(7) }), lr({ azione: "accoda", numero: NUMERO, testo: "Ciao", chiave: "k".repeat(65) }), lr({ azione: "accoda", numero: NUMERO, testo: "Ciao", chiave: "chiave con spazi!" }), lr({ azione: "accoda", numero: NUMERO, testo: "Ciao" })]);
  c("accoda: chiave di 8 e di 64 caratteri passano", [true, true], [lr({ azione: "accoda", numero: NUMERO, testo: "Ciao", chiave: "a_B-9".padEnd(8, "x") }).ok, lr({ azione: "accoda", numero: NUMERO, testo: "Ciao", chiave: "k".repeat(64) }).ok]);
  c("riprova valido, con e senza conferma", [{ ok: true, r: { azione: "riprova", id: U } }, { ok: true, r: { azione: "riprova", id: U, confermaIncerto: true } }], [lr({ azione: "riprova", id: U }), lr({ azione: "riprova", id: U, confermaIncerto: true })]);
  c("riprova: la conferma conta solo se è proprio true", { ok: true, r: { azione: "riprova", id: U } }, lr({ azione: "riprova", id: U, confermaIncerto: "true" }));
  c("riprova: id non uuid o assente", Array(2).fill({ ok: false, motivo: "corpo_non_valido" }), [lr({ azione: "riprova", id: "123" }), lr({ azione: "riprova" })]);
  c("azione sconosciuta o assente", Array(2).fill({ ok: false, motivo: "corpo_non_valido" }), [lr({ azione: "annulla", id: U }), lr({ numero: NUMERO })]);
  c("nessuna eccezione con null, numeri, stringhe, array, vuoto", Array(6).fill({ ok: false, motivo: "corpo_non_valido" }), [lr(null), lr(7), lr("accoda"), lr([]), lr({}), lr(undefined)]);

  const lp = (j) => I.leggiPrendi(j);
  c("prendi valido", { v: 1, tipo: "prendi" }, lp({ v: 1, tipo: "prendi" }));
  c("prendi: i campi in più non passano (l'utente non arriva mai dal corpo)", { v: 1, tipo: "prendi" }, lp({ v: 1, tipo: "prendi", user_id: "x", testo: "y" }));
  c("prendi: versione o tipo sbagliati, null, numeri, array", Array(6).fill(null), [lp({ v: 2, tipo: "prendi" }), lp({ v: 1, tipo: "esito" }), lp(null), lp(3), lp([]), lp(undefined)]);

  const le = (j) => I.leggiEsito(j, ADESSO);
  const ts = Math.floor(ADESSO.getTime() / 1000);
  c("esito inviato valido", { v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "3EB0AB.cd_E-1", ts: ts - 5 }, le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "3EB0AB.cd_E-1", ts: ts - 5 }));
  c("esito inviato senza ts: va bene (il server usa la sua ora)", { v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "3EB0AB" }, le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "3EB0AB" }));
  c("esito inviato senza wa_id, con caratteri vietati o lungo 129: rifiutato", Array(4).fill(null), [le({ v: 1, tipo: "esito", id: U, esito: "inviato" }), le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "a b" }), le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "a:b" }), le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "a".repeat(129) })]);
  c("esito: wa_id di 128 caratteri passa", true, le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "a".repeat(128) }) !== null);
  c("esito: ts nel futuro (oltre 10 minuti), troppo vecchio, non intero o non numero: il ts si scarta, l'esito resta", Array(5).fill(undefined), [ts + 601, 1230767999, 1.5, "adesso", Infinity].map((t) => le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "3EB0AB", ts: t })?.ts));
  c("esito: ts a +10 minuti e al minimo passano", [ts + 600, 1230768000], [ts + 600, 1230768000].map((t) => le({ v: 1, tipo: "esito", id: U, esito: "inviato", wa_id: "3EB0AB", ts: t }).ts));
  c("esito errore valido, con motivo della lista", { v: 1, tipo: "esito", id: U, esito: "errore", motivo: "esito_incerto" }, le({ v: 1, tipo: "esito", id: U, esito: "errore", motivo: "esito_incerto" }));
  c("esito errore: motivo sconosciuto, assente o non stringa → errore_invio", Array(3).fill("errore_invio"), [le({ v: 1, tipo: "esito", id: U, esito: "errore", motivo: "boh" }), le({ v: 1, tipo: "esito", id: U, esito: "errore" }), le({ v: 1, tipo: "esito", id: U, esito: "errore", motivo: 5 })].map((x) => x.motivo));
  c("esito errore: wa_id e ts non entrano", { v: 1, tipo: "esito", id: U, esito: "errore", motivo: "stop" }, le({ v: 1, tipo: "esito", id: U, esito: "errore", motivo: "stop", wa_id: "3EB0AB", ts }));
  c("esito: id non uuid, esito sconosciuto, versione sbagliata, null, numeri, array", Array(6).fill(null), [le({ v: 1, tipo: "esito", id: "1", esito: "errore" }), le({ v: 1, tipo: "esito", id: U, esito: "forse" }), le({ v: 2, tipo: "esito", id: U, esito: "errore" }), le(null), le(5), le([])]);

  gruppo("PONTE · INVIO A MANO · LE REGOLE NON TOCCANO IL RESTO (T2)");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const sorgente = fs.readFileSync(path.join(radice, "src/crm/ponte/invio.ts"), "utf8");
  c("invio.ts è puro: nessun import dal database, dal browser o da React", [], (sorgente.match(/^import .*$/gm) ?? []).filter((r) => /supabase|react|fetch|server|window|document/i.test(r)));
  c("…e non legge l'orologio (l'ora arriva da fuori)", false, /\bDate\.now\(|new Date\(\)/.test(sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
}
