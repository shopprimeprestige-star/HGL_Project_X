/** ── PROVE: LA CHAT IGNORA IL PONTE NELLE REGOLE ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T7.
 *  Le funzioni pure di `chatwa/stato.ts` e `chatwa/daChiamare.ts`: le righe
 *  `canale='baileys'` sono solo da vedere (I3), la lettura a pagine, i doppioni
 *  e gli eventi dello storico. La parte che gira dentro l'hook vero (database
 *  finto, tempo reale, messaggio vivo in ritardo) sta in
 *  `prove/manychat/chat-pagina.mjs`.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
export async function provePonteStatoChat(mod, { c, gruppo }) {
  const S = mod["chatwa/stato"];
  const D = mod["chatwa/daChiamare"];
  const T = mod["ponte/tipi"];

  const ADESSO = Date.parse("2026-10-29T12:00:00.000Z");
  const MIN = 60_000;
  const ORA = 60 * MIN;
  const GIORNO = 24 * ORA;
  const fa = (ms) => new Date(ADESSO - ms).toISOString();
  const msg = (direction, ms, canale, body = "ciao") => ({
    direction,
    body,
    created_at: fa(ms),
    ...(canale ? { canale } : {}),
  });
  const ponte = (direction, ms, body) => msg(direction, ms, T.CANALE_PONTE, body);

  gruppo("PONTE · CHAT: LE RIGHE DEL PONTE SONO SOLO DA VEDERE");
  c("una riga del ponte si riconosce dal canale (lo stesso di tipi.ts)", [true, false, false, false], [
    S.eRigaPonte({ canale: T.CANALE_PONTE }),
    S.eRigaPonte({ canale: "manychat" }),
    S.eRigaPonte({ canale: null }),
    S.eRigaPonte({}),
  ]);

  //  «Da rispondere», ripiego sui messaggi: stesso contatto, con e senza lo storico del ponte.
  const colonneVuote = { ultimo_in_entrata_il: null, risposto_il: null };
  const veri = [msg("inbound", 2 * ORA, "manychat", "Buongiorno"), msg("outbound", 3 * ORA, "manychat")];
  const storico = [
    ponte("inbound", 40 * GIORNO, "storia"),
    ponte("outbound", 39 * GIORNO),
    ponte("inbound", 10 * GIORNO, "ancora storia"),
    ponte("inbound", 30 * MIN, "arrivato adesso dal telefono"),
    ponte("outbound", 5 * MIN, "risposto dal telefono"),
  ];
  const regole = (messaggi, contatto = colonneVuote) => ({
    dr: S.daRispondere({ contatto, messaggi, adesso: ADESSO }),
    f24: S.finestra24({ contatto, messaggi, adesso: ADESSO }),
    chiamare: D.calcolaDaChiamare({
      dati: { stato: "attesa_whatsapp", statoPrecedenteIl: fa(20 * ORA) },
      messaggi,
      adesso: new Date(ADESSO),
    }),
  });
  c("stessi messaggi veri, con e senza righe del ponte: stesse regole (ripiego)", regole(veri), regole([...veri, ...storico]));
  c("…anche con le righe del ponte mescolate in ordine diverso", regole(veri), regole([...storico.slice(2), ...veri, ...storico.slice(0, 2)]));
  c(
    "…e con le colonne del contatto (le colonne vincono, il ponte non entra)",
    regole(veri, { ultimo_in_entrata_il: fa(2 * ORA), ultimo_in_entrata_anteprima: "Buongiorno", risposto_il: null }),
    regole([...veri, ...storico], { ultimo_in_entrata_il: fa(2 * ORA), ultimo_in_entrata_anteprima: "Buongiorno", risposto_il: null }),
  );

  //  Uno storico di sole righe del ponte, con tanti inbound vecchi senza risposta.
  const soloStorico = Array.from({ length: 50 }, (_, i) => ponte("inbound", (8 + i) * GIORNO, `vecchio ${i}`));
  const r = regole(soloStorico);
  c("solo storico del ponte: non è «Da rispondere»", [false, false, null, null], [r.dr.attesa, r.dr.vecchia, r.dr.dal, r.dr.fonte]);
  c(
    "uno storico di inbound vecchi non aggiunge «N chat senza risposta da più di 7 giorni»",
    0,
    S.contaVecchie([r.dr, regole([...soloStorico, ...soloStorico]).dr]),
  );
  c("solo storico del ponte: la finestra di 24 ore resta chiusa (niente 'puoi scrivere libero')", false, regole([ponte("inbound", 5 * MIN)]).f24.aperta);
  c("lo stesso messaggio, se arriva da ManyChat, la apre", true, regole([msg("inbound", 5 * MIN, "manychat")]).f24.aperta);
  c("inbound del ponte di 30 minuti fa: non toglie «Da chiamare»", true, regole([ponte("inbound", 30 * MIN)]).chiamare.si);
  c("inbound ManyChat di 30 minuti fa: toglie «Da chiamare» (come prima)", false, regole([msg("inbound", 30 * MIN, "manychat")]).chiamare.si);
  c("un messaggio d'uscita del ponte non fa uscire la chat da «Da rispondere»", true, regole([msg("inbound", 2 * ORA, "manychat"), ponte("outbound", 5 * MIN)]).dr.attesa);

  //  Prova a proprietà, seme fisso: aggiungere righe del ponte a caso non cambia mai le regole.
  {
    let seme = 20261029;
    const caso = () => ((seme = (seme * 1664525 + 1013904223) >>> 0), seme / 2 ** 32);
    let uguali = 0;
    const CASI = 300;
    for (let k = 0; k < CASI; k++) {
      const giusti = Array.from({ length: Math.floor(caso() * 6) }, () =>
        msg(caso() < 0.5 ? "inbound" : "outbound", Math.floor(caso() * 20 * GIORNO), caso() < 0.5 ? "manychat" : undefined),
      );
      const extra = Array.from({ length: Math.floor(caso() * 8) }, () =>
        ponte(caso() < 0.5 ? "inbound" : "outbound", Math.floor(caso() * 60 * GIORNO)),
      );
      const contatto = caso() < 0.5 ? colonneVuote : { ultimo_in_entrata_il: fa(Math.floor(caso() * 5 * GIORNO)), risposto_il: caso() < 0.5 ? fa(Math.floor(caso() * 5 * GIORNO)) : null };
      if (JSON.stringify(regole(giusti, contatto)) === JSON.stringify(regole([...giusti, ...extra], contatto))) uguali++;
    }
    c(`${CASI} casi a caso (seme fisso): con le righe del ponte le regole non cambiano mai`, CASI, uguali);
  }

  gruppo("PONTE · CHAT: LETTURA DEI CONTATTI A PAGINE");
  {
    const tutti = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${String(i).padStart(5, "0")}` }));
    /** Un database che dà al massimo 1000 righe a richiesta, come PostgREST. */
    const finto = (righe, errore = null) => {
      const chiamate = [];
      return {
        chiamate,
        leggi: async (da, a) => {
          chiamate.push([da, a]);
          if (errore && chiamate.length === errore.alla) return { data: null, error: errore.e };
          return { data: righe.slice(da, a + 1).slice(0, 1000), error: null };
        },
      };
    };
    let f = finto(tutti(2500));
    let e = await S.leggiContattiAPagine(f.leggi);
    c("2500 contatti: tutti, in 3 pagine", [2500, [[0, 999], [1000, 1999], [2000, 2999]], false, null], [e.data.length, f.chiamate, e.troncato, e.error]);
    f = finto(tutti(0));
    e = await S.leggiContattiAPagine(f.leggi);
    c("nessun contatto: una richiesta, elenco vuoto", [0, 1, false], [e.data.length, f.chiamate.length, e.troncato]);
    f = finto(tutti(1000));
    e = await S.leggiContattiAPagine(f.leggi);
    c("esattamente 1000: due richieste (la seconda vuota), tutti", [1000, 2, false], [e.data.length, f.chiamate.length, e.troncato]);
    f = finto(tutti(5000));
    e = await S.leggiContattiAPagine(f.leggi);
    c("5000: cinque pagine, segnato come troncato (potrebbero essercene altri)", [5000, 5, true], [e.data.length, f.chiamate.length, e.troncato]);
    f = finto(tutti(7300));
    e = await S.leggiContattiAPagine(f.leggi);
    c("7300: si ferma a 5 pagine e lo dice", [5000, 5, true], [e.data.length, f.chiamate.length, e.troncato]);
    f = finto(tutti(2500), { alla: 2, e: { code: "XX000", message: "rete" } });
    e = await S.leggiContattiAPagine(f.leggi);
    c("errore alla seconda pagina: l'errore passa, niente dati a metà", [null, "XX000", 2], [e.data, e.error?.code, f.chiamate.length]);
    //  Un contatto nuovo fra una pagina e l'altra sposta le righe: la stessa non si conta due volte.
    {
      const righe = tutti(1500);
      let n = 0;
      const dopo = await S.leggiContattiAPagine(async (da, a) => {
        n++;
        const base = n === 2 ? [{ id: "c-nuovo" }, ...righe] : righe;
        return { data: base.slice(da, a + 1), error: null };
      });
      c("righe spostate fra due pagine: nessun id doppio", dopo.data.length, new Set(dopo.data.map((x) => x.id)).size);
    }
  }

  gruppo("PONTE · CHAT: LETTURA DEI MESSAGGI SENZA DOPPIONI");
  {
    const righe = (n, doppi) =>
      Array.from({ length: n }, (_, i) => ({ id: `m${i}`, duplicato_di: i < doppi ? `crm${i}` : null }));
    const rich = [];
    const buono = async (filtra) => {
      rich.push(filtra);
      return { data: righe(2000, 0), error: null };
    };
    let r1 = await S.leggiSenzaDoppioni(buono);
    c("colonna presente: una sola richiesta, col filtro", [[true], 2000, null], [rich, r1.data.length, r1.error]);

    rich.length = 0;
    const senzaColonna = async (filtra) => {
      rich.push(filtra);
      return filtra
        ? { data: null, error: { code: "42703", message: "column does not exist" } }
        : { data: righe(2000, 1000), error: null };
    };
    r1 = await S.leggiSenzaDoppioni(senzaColonna);
    c("errore 42703: rilegge senza filtro e scarta i doppioni in codice", [[true, false], 1000, true], [rich, r1.data.length, r1.data.every((x) => !x.duplicato_di)]);
    rich.length = 0;
    r1 = await S.leggiSenzaDoppioni(async (filtra) => (rich.push(filtra), filtra ? { data: null, error: { code: "PGRST204", message: "x" } } : { data: [], error: null }));
    c("errore PGRST204: stessa cosa", [[true, false], 0, null], [rich, r1.data.length, r1.error]);
    rich.length = 0;
    r1 = await S.leggiSenzaDoppioni(async (filtra) => (rich.push(filtra), { data: null, error: { code: "XX000", message: "rete" } }));
    c("un altro errore non si maschera: una sola richiesta, l'errore passa", [[true], "XX000"], [rich, r1.error?.code]);
    rich.length = 0;
    r1 = await S.leggiSenzaDoppioni(async (filtra) => (rich.push(filtra), filtra ? { data: null, error: { code: "42703", message: "x" } } : { data: null, error: { code: "XX000", message: "rete" } }));
    c("42703 e poi errore anche senza filtro: l'errore della seconda passa", [[true, false], "XX000"], [rich, r1.error?.code]);
    c("`senzaDoppioni` toglie solo chi ha `duplicato_di`", ["a", "c"], S.senzaDoppioni([{ id: "a" }, { id: "b", duplicato_di: "x" }, { id: "c", duplicato_di: null }]).map((x) => x.id));
    c("mancaColonna: solo 42703 e PGRST204", [true, true, false, false], [S.colonnaMancante({ code: "42703", message: "" }), S.colonnaMancante({ code: "PGRST204", message: "" }), S.colonnaMancante({ code: "42883", message: "" }), S.colonnaMancante(null)]);
  }

  gruppo("PONTE · CHAT: GLI EVENTI DELLO STORICO NON RIAVVIANO LA LETTURA");
  {
    const M = "whatsapp_messages";
    const C = "whatsapp_contacts";
    const nuovoMsg = (extra) => ({ eventType: "INSERT", new: { id: "x", created_at: fa(3 * ORA), canale: T.CANALE_PONTE, ...extra }, old: {} });
    const base = { id: "c1", unread_count: 0, ultimo_in_entrata_il: fa(ORA), risposto_il: null, non_scrivere_dal: null, lead_id: null, last_message_at: fa(ORA), display_name: null, updated_at: fa(ORA) };
    const upd = (cambi) => ({ eventType: "UPDATE", new: { ...base, ...cambi }, old: base });
    const ev = (t, e) => S.eventoDaIgnorare(t, e, ADESSO);
    c("INSERT del ponte vecchio di 3 ore: si ignora", true, ev(M, nuovoMsg()));
    c("INSERT del ponte di 11 minuti: si ignora", true, ev(M, nuovoMsg({ created_at: fa(11 * MIN) })));
    c("INSERT del ponte di 9 minuti (vivo): si rilegge", false, ev(M, nuovoMsg({ created_at: fa(9 * MIN) })));
    c("INSERT del ponte appena scritto: si rilegge", false, ev(M, nuovoMsg({ created_at: fa(0) })));
    c("INSERT del ponte con data nel futuro: si rilegge", false, ev(M, nuovoMsg({ created_at: fa(-5 * MIN) })));
    c("INSERT di ManyChat vecchio: si rilegge", false, ev(M, nuovoMsg({ canale: "manychat" })));
    c("INSERT senza canale (Cloud) vecchio: si rilegge", false, ev(M, nuovoMsg({ canale: undefined })));
    c("INSERT del ponte con data illeggibile: si rilegge", false, ev(M, nuovoMsg({ created_at: "boh" })));
    c("UPDATE di un messaggio, anche del ponte: si rilegge", false, ev(M, { eventType: "UPDATE", new: nuovoMsg().new, old: nuovoMsg().new }));
    c("DELETE di un messaggio: si rilegge", false, ev(M, { eventType: "DELETE", new: {}, old: nuovoMsg().new }));
    c("contatto: cambiano solo last_message_at, display_name, updated_at: si ignora", true, ev(C, upd({ last_message_at: fa(0), display_name: "Nome", updated_at: fa(0) })));
    for (const k of ["unread_count", "ultimo_in_entrata_il", "risposto_il", "non_scrivere_dal", "lead_id"])
      c(`contatto: cambia anche ${k}: si rilegge`, false, ev(C, upd({ last_message_at: fa(0), updated_at: fa(0), [k]: k === "unread_count" ? 2 : fa(0) })));
    c("contatto: cambia una colonna che il piano non cita (es. nome in rubrica): si rilegge", false, ev(C, upd({ nome_rubrica: "Altro", updated_at: fa(0) })));
    c("contatto: INSERT di un contatto nuovo: si rilegge", false, ev(C, { eventType: "INSERT", new: base, old: {} }));
    //  TUTTE LE CHAT (30/10): l'import dello storico crea centinaia di contatti `baileys`
    //  senza scheda. Quell'INSERT silenzioso non rilegge la chat (lo recupera il controllo
    //  ogni 15 s); ogni altro INSERT sì. Nota 2 del revisore: `risposto_il` vuoto, perché un
    //  contatto nato da un'uscita viva dal telefono ha `risposto_il` ed è un evento vero.
    const nuovoBaileys = (extra) => ({
      eventType: "INSERT",
      new: { id: "n1", origine: "baileys", unread_count: 0, ultimo_in_entrata_il: null, risposto_il: null, lead_id: null, non_scrivere_dal: null, display_name: null, last_message_at: fa(3 * ORA), updated_at: fa(0), ...extra },
      old: {},
    });
    c("contatto: INSERT silenzioso del ponte (origine baileys, nessun non letto, nessuna scheda): si ignora", true, ev(C, nuovoBaileys()));
    c("contatto: INSERT del ponte senza `unread_count` né colonne d'entrata (assenti): si ignora", true, ev(C, { eventType: "INSERT", new: { id: "n1", origine: "baileys" }, old: {} }));
    c("contatto: INSERT del ponte con un non letto: si rilegge", false, ev(C, nuovoBaileys({ unread_count: 1 })));
    c("contatto: INSERT del ponte con `ultimo_in_entrata_il`: si rilegge", false, ev(C, nuovoBaileys({ ultimo_in_entrata_il: fa(0) })));
    c("contatto: INSERT del ponte con `lead_id`: si rilegge", false, ev(C, nuovoBaileys({ lead_id: "l1" })));
    c("contatto: INSERT del ponte con `non_scrivere_dal`: si rilegge", false, ev(C, nuovoBaileys({ non_scrivere_dal: fa(0) })));
    c("contatto: INSERT del ponte con `risposto_il` (nato da un'uscita viva dal telefono): si rilegge", false, ev(C, nuovoBaileys({ risposto_il: fa(0) })));
    c("contatto: INSERT di un'altra origine (ManyChat, Cloud, nessuna): si rilegge", [false, false, false], [ev(C, nuovoBaileys({ origine: "manychat" })), ev(C, nuovoBaileys({ origine: "cloud" })), ev(C, nuovoBaileys({ origine: undefined }))]);
    c("contatto: UPDATE di un contatto baileys con un non letto: si rilegge (la regola dell'INSERT non vale per gli UPDATE)", false, ev(C, { eventType: "UPDATE", new: { ...nuovoBaileys().new, unread_count: 1 }, old: nuovoBaileys().new }));
    c("contatto: DELETE di un contatto baileys: si rilegge", false, ev(C, { eventType: "DELETE", new: {}, old: nuovoBaileys().new }));
    c("contatto: DELETE: si rilegge", false, ev(C, { eventType: "DELETE", new: {}, old: base }));
    c("contatto: UPDATE senza il vecchio valore completo: si rilegge", false, ev(C, { eventType: "UPDATE", new: base, old: { id: "c1" } }));
    c("contatto: UPDATE con vecchio vuoto: si rilegge", false, ev(C, { eventType: "UPDATE", new: base, old: {} }));
    c("evento assente o senza dati: si rilegge", [false, false, false], [ev(C, undefined), ev(M, null), ev(C, {})]);
  }

  //  TUTTE LE CHAT (30/10/2026): nessun filtro nasconde uno sconosciuto. Il tetto delle 5 pagine da
  //  1000 contatti sta in `leggiContattiAPagine` (provato più su); qui si blocca la regola dei filtri
  //  e del numeretto «Da rispondere» su un elenco grande, 600 chat senza scheda comprese.
  gruppo("PONTE · CHAT: «TUTTE» E «NON LETTI» CONTANO ANCHE GLI SCONOSCIUTI");
  {
    const { passaFiltro } = mod["chatwa/cercaChat"];
    //  2000 chat: 1400 con scheda, 600 sconosciute; ogni quinta ha non letti.
    const chat = Array.from({ length: 2000 }, (_, i) => ({
      phone: `3933300${String(i).padStart(5, "0")}`,
      lead: i < 1400 ? { data: { stato: "nuovo" } } : null,
      unread: i % 5 === 0 ? 1 + (i % 3) : 0,
      finestra: null,
    }));
    const passano = (f) => chat.filter((x) => passaFiltro(x, f));
    const sconosciute = chat.filter((x) => !x.lead);
    const attesaNonLetti = chat.filter((x) => x.unread > 0);
    c("«Tutte» lascia passare 2000 chat su 2000", 2000, passano("all").length);
    c("«Tutte» include ogni sconosciuta", 600, passano("all").filter((x) => !x.lead).length);
    c("«Non letti» = tutte e sole le chat con non letti", attesaNonLetti.map((x) => x.phone), passano("unread").map((x) => x.phone));
    c("«Non letti» include gli sconosciuti con non letti", 120, passano("unread").filter((x) => !x.lead).length);
    c("«Sconosciuti» = chi non ha scheda", sconosciute.map((x) => x.phone), passano("unknown").map((x) => x.phone));
    c("«Con lead» + «Sconosciuti» = 2000, senza sovrapposizioni", [2000, 0], [passano("with-lead").length + passano("unknown").length, passano("with-lead").filter((x) => passaFiltro(x, "unknown")).length]);

    //  «Da rispondere»: uno sconosciuto con un'entrata più recente della risposta conta come un lead.
    const prima = fa(5 * ORA);
    const dopo = fa(1 * ORA);
    const contatti = [
      { ultimo_in_entrata_il: dopo, risposto_il: prima }, // sconosciuto, entrata dopo la risposta: attesa
      { ultimo_in_entrata_il: dopo, risposto_il: null }, // sconosciuto mai risposto: attesa
      { ultimo_in_entrata_il: prima, risposto_il: dopo }, // già risposto: no
      { ultimo_in_entrata_il: null, risposto_il: null }, // solo storico, nessuna colonna d'entrata: no
    ];
    c("`contaDaRispondere` conta gli sconosciuti con un'entrata dopo la risposta", 2, S.contaDaRispondere(contatti, ADESSO));
    //  Solo storico del ponte: nessuna colonna d'entrata, nessun ripiego sulle righe `baileys`.
    c(
      "uno sconosciuto con il solo storico del ponte non è «Da rispondere»",
      false,
      S.daRispondere({ contatto: { ultimo_in_entrata_il: null, risposto_il: null }, messaggi: [ponte("inbound", 2 * ORA, "ciao dallo storico")], adesso: ADESSO }).attesa,
    );
    c(
      "…e non apre la finestra di 24 ore",
      false,
      S.finestra24({ contatto: { ultimo_in_entrata_il: null, risposto_il: null }, messaggi: [ponte("inbound", 2 * ORA, "ciao dallo storico")], adesso: ADESSO }).aperta,
    );
  }
}
