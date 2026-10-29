/** ── PROVE: CRUSCOTTO WHATSAPP (30/10/2026, pacchetto p4-cruscotto-wa) ───────
 *  Il calcolo puro: per giorno, per modello, costo con tariffe scelte, velocità
 *  di risposta per consulente e segnale indiretto del saldo. Dati inventati.
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo, radice }`. */
export function proveCruscottoWa(mod, { c, gruppo }) {
  const K = mod["cruscotto-wa/calcolo"];
  const adesso = new Date("2026-10-30T10:00:00Z"); // 11:00 a Roma (ora solare)
  const iso = (g, h = "09:00") => new Date(`${g}T${h}:00+01:00`).toISOString();

  gruppo("CRUSCOTTO WA · I GIORNI E LE IMPOSTAZIONI");
  const g7 = K.giorniDelPeriodo("7", adesso);
  c("7 giorni di Roma, oggi compreso", ["2026-10-24", "2026-10-30", 7], [g7[0], g7[6], g7.length]);
  c("inizio periodo = mezzanotte di Roma del 24/10 (ancora ora legale)", "2026-10-23T22:00:00.000Z", K.inizioCruscotto("7", adesso).toISOString());
  c("tariffe valide: virgola italiana", [0.05, 0.0248], [K.tariffeValide({ marketing: "0,05" }).marketing, K.tariffeValide({ marketing: "0,05" }).utility]);
  c("tariffe non valide tornano al listino", [0.0658, 0.0248], [K.tariffeValide({ marketing: -1, utility: "abc" }).marketing, K.tariffeValide({ marketing: -1, utility: "abc" }).utility]);
  c("soglia: 10 di serie, valida 1-240", [10, 10, 15], [K.sogliaValida(undefined), K.sogliaValida(0), K.sogliaValida("15")]);

  gruppo("CRUSCOTTO WA · PER GIORNO");
  const msg = (g, direzione, cliente, extra = {}) => ({ creatoIl: iso(g), direzione, canale: "manychat", stato: "sent", cliente, doppione: false, ...extra });
  const messaggi = [
    msg("2026-10-30", "outbound", "1"),
    msg("2026-10-30", "outbound", "2"),
    msg("2026-10-30", "outbound", "3", { stato: "failed" }),
    msg("2026-10-30", "outbound", "4", { canale: "baileys" }),
    msg("2026-10-30", "inbound", "1"),
    msg("2026-10-30", "inbound", "1"),
    msg("2026-10-30", "inbound", "2"),
    msg("2026-10-30", "inbound", "9", { doppione: true }),
    msg("2026-10-29", "inbound", "5"),
    msg("2026-10-10", "inbound", "6"),
  ];
  const schede = [
    { id: "a", creatoIl: null, primoContattoIl: null, consulenteId: null, stato: "appuntamento_fissato", fissatoIl: iso("2026-10-30", "10:00"), importato: false },
    { id: "b", creatoIl: null, primoContattoIl: null, consulenteId: null, stato: "appuntamento_fissato", fissatoIl: iso("2026-10-30", "10:30"), importato: false },
  ];
  const r = K.perGiorno(messaggi, schede, new Set(["a"]), "7", adesso);
  const oggi = r[6];
  c("inviati: niente falliti, niente telefono", 2, oggi.inviati);
  c("dal telefono a parte", 1, oggi.dalTelefono);
  c("risposte = persone distinte, senza doppioni", 2, oggi.risposte);
  c("prenotazioni: solo lead già toccati da WhatsApp", 1, oggi.prenotazioni);
  c("ieri: una risposta", 1, r[5].risposte);
  c("un messaggio fuori periodo non conta", 7, r.length);

  gruppo("CRUSCOTTO WA · PER MODELLO E COSTO");
  const inv = (modello, leadId, extra = {}) => ({ tipo: "promemoria", stato: "inviato", motivo: null, modello, conFlusso: true, inviatoIl: iso("2026-10-28"), prenotatoIl: iso("2026-10-28"), rispostaIl: null, leadId, ...extra });
  const invii = [
    inv("hgl_primo_contatto_v2", "a", { rispostaIl: iso("2026-10-28", "09:10") }),
    inv("hgl_primo_contatto_v2", "b"),
    inv("hgl_primo_contatto_v2", null),
    inv("hgl_promemoria_meet", "c"),
    inv(null, null, { conFlusso: false, tipo: "chat" }),
    inv("hgl_promemoria_meet", "c", { tipo: "prova" }),
    inv("hgl_promemoria_meet", "c", { stato: "fallito" }),
  ];
  const sch = [
    { ...schede[0], fissatoIl: iso("2026-10-29") },
    { ...schede[1], fissatoIl: iso("2026-11-20") },
  ];
  const m = K.perModello(invii, sch, K.TARIFFE_PREDEFINITE, "7", adesso);
  const pc = m.find((x) => x.modello === "hgl_primo_contatto_v2");
  c("due modelli (testo libero, prove e falliti fuori)", 2, m.length);
  c("primo contatto: 3 inviati, 1 risposta", [3, 1], [pc.inviati, pc.risposte]);
  c("tasso risposta 33,3%", 33.3, pc.tassoRisposta);
  c("prenotazione: solo entro 7 giorni dall'invio, su 2 con scheda", [1, 2, 50], [pc.prenotazioni, pc.conScheda, pc.tassoPrenotazione]);
  c("costo marketing 3 x 0,0658", 0.1974, pc.costo);
  c("tariffe scelte cambiano il costo", 0.3, K.perModello(invii, sch, { marketing: 0.1, utility: 0.02 }, "7", adesso).find((x) => x.modello === "hgl_primo_contatto_v2").costo);
  c("modello senza lead: tasso prenotazione null", null, K.perModello([inv("hgl_promemoria_meet", null)], [], K.TARIFFE_PREDEFINITE, "7", adesso)[0].tassoPrenotazione);
  const costi = { categorie: [{ categoria: "marketing", etichetta: "M", messaggi: 10, costo: 0 }, { categoria: "utility", etichetta: "U", messaggi: 5, costo: 0 }], stimati: 2 };
  const cs = K.costoConTariffe(costi, K.TARIFFE_PREDEFINITE);
  c("costo stimato con il listino", [0.782, 15, false], [cs.totale, cs.messaggi, cs.tariffePersonalizzate]);
  c("tariffe personalizzate segnalate", true, K.costoConTariffe(costi, { marketing: 0.07, utility: 0.0248 }).tariffePersonalizzate);

  gruppo("CRUSCOTTO WA · VELOCITÀ DI RISPOSTA PER CONSULENTE");
  const nomi = new Map([["c1", "Anna"], ["c2", "Luca"]]);
  const lead = (id, cons, minuti, extra = {}) => {
    const nato = new Date("2026-10-29T08:00:00Z");
    return { id, creatoIl: nato.toISOString(), primoContattoIl: minuti === null ? null : new Date(nato.getTime() + minuti * 60000).toISOString(), consulenteId: cons, stato: minuti === null ? "da_contattare" : "non_risponde", fissatoIl: null, importato: false, ...extra };
  };
  const v = K.velocitaConsulenti(
    [lead("1", "c1", 4), lead("2", "c1", 6), lead("3", "c1", 30), lead("4", "c2", 20), lead("5", "c2", null), lead("6", null, null), lead("7", "c1", 1, { importato: true }), lead("8", "c1", null, { stato: "venduto" })],
    nomi, 10, "7", adesso);
  const anna = v.find((x) => x.consulenteId === "c1");
  const luca = v.find((x) => x.consulenteId === "c2");
  c("Anna: 4 lead nuovi (importati fuori), 3 contattati", [4, 3], [anna.lead, anna.contattati]);
  c("Anna: mediana 6 minuti, 66,7% entro 10", [6, 66.7], [anna.medianaMinuti, anna.entroSoglia]);
  c("Anna: un lead senza dato non finge", 1, anna.senzaDato);
  c("Anna: mediana ok e nessuno in attesa = niente avviso", false, anna.avviso);
  c("Luca: mediana 20 > 10 e uno in ritardo = avviso", [20, 1, true], [luca.medianaMinuti, luca.inRitardoOra, luca.avviso]);
  c("lead senza consulente in un gruppo suo, con avviso", ["Senza consulente", true], [v.find((x) => x.consulenteId === "").nome, v.find((x) => x.consulenteId === "").avviso]);
  c("soglia più larga toglie l'avviso a Luca sul passato", 0, K.velocitaConsulenti([lead("4", "c2", 20)], nomi, 30, "7", adesso)[0].inRitardoOra);

  gruppo("CRUSCOTTO WA · SALDO, SEGNALE INDIRETTO");
  const ora = adesso.getTime();
  const f = (oreFa, stato, motivo = null) => ({ stato, motivo, inviatoIl: new Date(ora - oreFa * 3600000).toISOString(), prenotatoIl: new Date(ora - oreFa * 3600000).toISOString() });
  c("tutto bene", "ok", K.segnaleSaldo([f(1, "inviato"), f(2, "inviato")], { acceso: true, fermatoMotivo: null }, adesso).livello);
  c("nessun invio: non è un allarme", "ok", K.segnaleSaldo([], null, adesso).livello);
  c("due blocchi e poi niente = allarme", "allarme", K.segnaleSaldo([f(5, "inviato"), f(3, "fallito", "blocco"), f(2, "fallito", "blocco")], { acceso: true, fermatoMotivo: null }, adesso).livello);
  c("un blocco ma poi partono = attenzione", "attenzione", K.segnaleSaldo([f(3, "fallito", "blocco"), f(1, "inviato")], null, adesso).livello);
  c("giro fermato da solo dopo un blocco = allarme", "allarme", K.segnaleSaldo([f(3, "fallito", "blocco"), f(1, "inviato")], { acceso: false, fermatoMotivo: "Fermato" }, adesso).livello);
  c("blocchi vecchi di 30 ore non contano", "ok", K.segnaleSaldo([f(30, "fallito", "blocco"), f(31, "fallito", "blocco")], null, adesso).livello);
  c("i rifiuti del contatto non sono credito", "ok", K.segnaleSaldo([f(2, "fallito", "rifiuto_contatto"), f(1, "fallito", "rifiuto_contatto")], null, adesso).livello);
  c("la frase manda al Wallet", true, /Wallet/.test(K.segnaleSaldo([f(3, "fallito", "blocco"), f(2, "fallito", "blocco")], null, adesso).frase));
}
