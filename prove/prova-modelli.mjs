import { readFileSync } from "node:fs";
import { join } from "node:path";

/** ── PROVE: «PROVA I MODELLI» (Impostazioni → WhatsApp) ────────────────────
 *
 *  Richiesta del titolare, 24/10/2026. Le regole del riquadro stanno in
 *  `src/crm/prova-modelli.ts` (pura); qui si provano contro i modelli VERI di
 *  `wa-meta-templates` e contro gli esiti VERI della porta unica
 *  (`rispostaChat`), così se la porta cambia una frase questa prova lo dice.
 *  Si collega da `prove/prove.mjs` con una voce di MODULI e una chiamata.
 *
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo }`. */
export function proveProvaModelli(mod, { c, gruppo, radice }) {
  const PM = mod["prova-modelli"];
  const { META_TEMPLATES, findMetaTemplate } = mod["wa-meta-templates"];
  const { rispostaChat, MAX_PARAMETRI } = mod["manychat/porta"];

  gruppo("PROVA I MODELLI · I VALORI D'ESEMPIO");
  const conferma = findMetaTemplate("consulenza_conferma_presenza");
  c(
    "un esempio per ogni variabile, nell'ordine del modello",
    ["Mario", "giovedì 29 ottobre", "18:00", PM.ESEMPIO_LINK],
    PM.valoriDiEsempio(conferma),
  );
  c(
    "ogni modello ha tanti valori quante variabili, tutti pieni",
    [],
    META_TEMPLATES.filter((t) => {
      const v = PM.valoriDiEsempio(t);
      return v.length !== t.params.length || v.some((x) => !x.trim());
    }).map((t) => t.name),
  );
  c(
    "il giorno d'esempio è davvero un giovedì (29/10/2026)",
    4,
    new Date(Date.UTC(2026, 9, 29)).getUTCDay(),
  );
  c(
    "l'anteprima mette i valori al posto di {{1}}, {{2}}…",
    true,
    PM.anteprimaTesto(conferma, [
      "Rita",
      "lunedì 2 novembre",
      "09:30",
      "https://x.test/a",
    ]).includes(
      "Gentile Rita, la Sua consulenza con Hair Genius Labs è fissata per lunedì 2 novembre alle ore 09:30.",
    ),
  );
  c(
    "…e non lascia segnaposto quando i valori ci sono tutti",
    false,
    /\{\{\d+\}\}/.test(PM.anteprimaTesto(conferma, PM.valoriDiEsempio(conferma))),
  );
  c(
    "un valore ancora vuoto lascia il segnaposto, così si vede cosa manca",
    true,
    PM.anteprimaTesto(conferma, ["", "x", "y", "z"]).startsWith("Gentile {{1}},"),
  );

  gruppo("PROVA I MODELLI · IL NUMERO");
  const n = (s) => PM.numeroPerProva(s);
  c("con +39 e spazi", { ok: true, e164: "+393331234567" }, n("+39 333 123 4567"));
  c("con 0039", { ok: true, e164: "+393331234567" }, n("0039 333-1234567"));
  c(
    "cellulare italiano senza prefisso: +39",
    { ok: true, e164: "+393331234567" },
    n("333 1234567"),
  );
  c("con le parentesi e i trattini", { ok: true, e164: "+393331234567" }, n("(+39) 333-123-4567"));
  c("un prefisso estero resta com'è", { ok: true, e164: "+34612345678" }, n("+34 612 345 678"));
  c("vuoto: lo dice", false, n("").ok);
  c("troppo corto: lo dice", false, n("+39 33").ok);
  c("troppo lungo (più di 15 cifre): lo dice", false, n("+39 333 1234 5678 9012").ok);
  c("lettere: lo dice", false, n("+39 333 abc 4567").ok);
  c("fisso senza prefisso: chiede il prefisso", false, n("06 1234567").ok);
  c(
    "…e la frase dice come scriverlo",
    true,
    /prefisso/.test(n("06 1234567").motivo) && /\+39/.test(n("06 1234567").motivo),
  );

  gruppo("PROVA I MODELLI · IL CANALE");
  const riga = (data, error = null) => ({ data, error });
  c(
    "cloud: nessun flusso da mostrare",
    { canale: "cloud", modelliConFlusso: [], chiaveManychat: true, migrazione: true },
    PM.statoCanaleDaRiga(riga({ canale: "cloud", flussi: { a: "ns" } }), true),
  );
  c(
    "manychat: i modelli con un flusso non vuoto (mai il codice del flusso)",
    {
      canale: "manychat",
      modelliConFlusso: ["consulenza_conferma_presenza"],
      chiaveManychat: false,
      migrazione: true,
    },
    PM.statoCanaleDaRiga(
      riga({
        canale: "manychat",
        flussi: { consulenza_conferma_presenza: " content-1 ", vuoto: "  ", numero: 5 },
      }),
      false,
    ),
  );
  c(
    "nessuna riga: cloud",
    { canale: "cloud", modelliConFlusso: [], chiaveManychat: true, migrazione: true },
    PM.statoCanaleDaRiga(riga(null), true),
  );
  c(
    "tabella assente (42P01): cloud e «migrazione non applicata»",
    { canale: "cloud", modelliConFlusso: [], chiaveManychat: true, migrazione: false },
    PM.statoCanaleDaRiga(riga(null, { code: "42P01", message: "x" }), true),
  );
  c(
    "tabella assente (PGRST205): idem",
    false,
    PM.statoCanaleDaRiga(riga(null, { code: "PGRST205", message: "x" }), true).migrazione,
  );
  c(
    "un altro guasto del database NON si spaccia per cloud",
    null,
    PM.statoCanaleDaRiga(riga(null, { code: "XX000", message: "boom" }), true),
  );
  const mc = {
    canale: "manychat",
    modelliConFlusso: ["conferma_sede"],
    chiaveManychat: true,
    migrazione: true,
  };
  const cl = { ...mc, canale: "cloud", modelliConFlusso: [] };
  c("flusso collegato", "collegato", PM.flussoDelModello(mc, "conferma_sede"));
  c("flusso mancante", "mancante", PM.flussoDelModello(mc, "fissa_meet"));
  c("col cloud il flusso non c'entra", "non_serve", PM.flussoDelModello(cl, "fissa_meet"));
  c(
    "la frase dice canale e flusso mancante",
    true,
    /ManyChat/.test(PM.fraseCanale(mc, "fissa_meet")) &&
      /nessun flusso/i.test(PM.fraseCanale(mc, "fissa_meet")),
  );
  c(
    "la frase col flusso collegato non dice «nessun»",
    false,
    /nessun/i.test(PM.fraseCanale(mc, "conferma_sede")),
  );
  c("la frase col cloud nomina la Cloud API", true, /Cloud/.test(PM.fraseCanale(cl, "fissa_meet")));
  c(
    "migrazione non applicata: la frase lo scrive",
    true,
    /migrazione non applicata/i.test(PM.fraseCanale({ ...cl, migrazione: false }, "fissa_meet")),
  );
  c(
    "chiave ManyChat mancante: la frase lo scrive",
    true,
    /chiave/i.test(PM.fraseCanale({ ...mc, chiaveManychat: false }, "conferma_sede")),
  );
  c("canale non ancora letto: nessuna frase", "", PM.fraseCanale(null, "conferma_sede"));

  gruppo("PROVA I MODELLI · IL CONTROLLO PRIMA DELL'INVIO");
  const ok = (o) =>
    PM.controllaProva({
      numero: "+39 333 123 4567",
      modello: "consulenza_conferma_presenza",
      valori: PM.valoriDiEsempio(conferma),
      stato: cl,
      ...o,
    });
  c("tutto a posto", true, ok({}).ok);
  c("restituisce il numero in formato internazionale", "+393331234567", ok({}).e164);
  c("numero sbagliato: il motivo del numero", false, ok({ numero: "12" }).ok);
  c("modello che non esiste", false, ok({ modello: "inventato" }).ok);
  const senza = ok({ valori: ["Mario", "", "18:00", "https://x.test"] });
  c("un valore vuoto blocca", false, senza.ok);
  c("…e dice QUALE (la descrizione della variabile)", true, /Giorno parlato/.test(senza.motivo));
  c(
    "a capo dentro un valore: Meta lo rifiuta, qui si ferma",
    false,
    ok({ valori: ["Ma\nrio", "a", "b", "c"] }).ok,
  );
  c("quattro spazi di fila: idem", false, ok({ valori: ["Ma    rio", "a", "b", "c"] }).ok);
  c("tabulazione: idem", false, ok({ valori: ["Ma\trio", "a", "b", "c"] }).ok);
  c(
    "spazi ai bordi si tolgono",
    ["Mario", "a", "b", "c"],
    ok({ valori: ["  Mario ", "a", "b", "c"] }).valori,
  );
  const cinque = findMetaTemplate("promemoria_meet");
  c("il modello con 5 variabili esiste (serve alla prova sotto)", 5, cinque.params.length);
  c(
    "ManyChat accetta al massimo MAX_PARAMETRI variabili: blocca prima",
    false,
    ok({ modello: cinque.name, valori: PM.valoriDiEsempio(cinque), stato: mc }).ok,
  );
  c(
    "…col cloud lo stesso modello passa",
    true,
    ok({ modello: cinque.name, valori: PM.valoriDiEsempio(cinque) }).ok,
  );
  c("MAX_PARAMETRI è quello della porta", 4, MAX_PARAMETRI);

  gruppo("PROVA I MODELLI · IL CORPO DELLA CHIAMATA");
  const corpo = PM.corpoProva(conferma, "+393331234567", PM.valoriDiEsempio(conferma));
  c(
    "numero, modello, lingua e variabili in ordine",
    {
      to: "+393331234567",
      templateName: "consulenza_conferma_presenza",
      templateLang: "it",
      templateParams: ["Mario", "giovedì 29 ottobre", "18:00", PM.ESEMPIO_LINK],
    },
    corpo,
  );
  c("NIENTE leadId: la prova non tocca nessuna scheda", false, "leadId" in corpo);

  gruppo("PROVA I MODELLI · L'ESITO IN CHIARO");
  const e = (esito, codice) => {
    const r = rispostaChat({ esito, ...(codice ? { codice } : {}) });
    return PM.esitoInChiaro(r.status, r.corpo, "+393331234567");
  };
  const buono = e("ok");
  c("ok: tono ok", "ok", buono.tono);
  c("ok: dice a quale numero è partito", true, buono.frase.includes("+39 333 123 4567"));
  c("stop: la frase della porta", true, /ha chiesto di non ricevere/.test(e("stop").frase));
  c(
    "flusso mancante: la frase della porta",
    true,
    /flusso collegato/.test(e("flusso_mancante").frase),
  );
  c(
    "chiave mancante: la frase della porta",
    true,
    /Manca la chiave/.test(e("blocco", "manca_chiave").frase),
  );
  c(
    "pausa di 120 s: la frase della porta",
    true,
    /Riprova fra un minuto/.test(e("riprova_fra_poco").frase),
  );
  c(
    "incerto: dice di controllare, non di rimandare",
    true,
    /prima di rimandarlo/.test(e("incerto").frase),
  );
  c(
    "ogni errore ha tono «errore»",
    ["errore", "errore", "errore"],
    [e("stop").tono, e("incerto").tono, e("blocco").tono],
  );
  c(
    "401: sessione scaduta",
    true,
    /rientra/i.test(PM.esitoInChiaro(401, { error: "invalid_session" }, "+39").frase),
  );
  c(
    "senza message ma con hint (credenziali Cloud mancanti): si legge l'hint",
    true,
    /Configura WhatsApp/.test(
      PM.esitoInChiaro(
        400,
        { error: "missing_credentials", hint: "Configura WhatsApp in Impostazioni" },
        "+39",
      ).frase,
    ),
  );
  c(
    "risposta senza forma nota: frase di riserva con il codice HTTP",
    true,
    /500/.test(PM.esitoInChiaro(500, null, "+39").frase),
  );
  c(
    "l'esito d'errore non nomina il numero (non finisce in giro per caso)",
    false,
    e("stop").frase.includes("333"),
  );
  c(
    "il numero in chiaro è scritto con gli spazi",
    "+39 333 123 4567",
    PM.numeroLeggibile("+393331234567"),
  );

  gruppo("PROVA I MODELLI · NIENTE NUMERI IN GIRO");
  //  Il numero vive solo nello stato del componente: né archivio del browser,
  //  né log, né una tabella. (La riga in `whatsapp_messages` la scrive la porta
  //  come per ogni invio: non è di questo riquadro.)
  for (const f of [
    "src/crm/prova-modelli.ts",
    "src/crm/ProvaModelliWhatsapp.tsx",
    "src/routes/api.crm.whatsapp-canale.ts",
  ]) {
    const testo = readFileSync(join(radice, f), "utf8");
    c(
      `${f}: nessun console.*, localStorage, sessionStorage o scrittura nel database`,
      false,
      /console\.|localStorage|sessionStorage|\.insert\(|\.upsert\(|\.update\(/.test(testo),
    );
  }
  const comp = readFileSync(join(radice, "src/crm/ProvaModelliWhatsapp.tsx"), "utf8");
  c("il componente chiama /api/whatsapp-send", true, comp.includes("/api/whatsapp-send"));
  c(
    "…e legge il canale da /api/crm/whatsapp-canale",
    true,
    comp.includes("/api/crm/whatsapp-canale"),
  );
  c(
    "…e si vede solo con il permesso «impostazioni»",
    true,
    /usePuo\(\)\(\s*"impostazioni"\s*\)/.test(comp),
  );
  const rotta = readFileSync(join(radice, "src/routes/api.crm.whatsapp-canale.ts"), "utf8");
  c(
    //  Commessa 2026-10-28 (chat nel CRM, D13): la leggono anche i setter. Il riquadro
    //  «Prova i modelli» resta per «impostazioni» (qui sopra); vedi chat-uscita.mjs.
    'la rotta del canale sta dietro guardiaCRM("lead.propri")',
    true,
    /guardiaCRM\(request, cors, "lead\.propri"\)/.test(rotta),
  );

  gruppo("PROVA I MODELLI · I MODELLI DI MANYCHAT");
  const { MODELLI_MANYCHAT } = mod["wa-meta-templates"];
  //  Quante variabili manda il CRM per ogni modello (testi.ts → crm_v1…crm_v4):
  //  se un testo qui ne ha un numero diverso, la prova direbbe il falso.
  const VARIABILI = {
    hgl_primo_contatto: 1, hgl_richiamo_24h: 1, hgl_meet_domani: 4, hgl_meet_domani_testo: 4, hgl_meet_oggi: 3, hgl_meet_oggi_link: 4,
    hgl_promemoria_meet: 4, hgl_meet_adesso: 3, hgl_ricontatto_consulenza: 2,
    hgl_meet_da_fissare: 2, hgl_richiamo_concordato: 2, hgl_non_risponde: 1,
    hgl_cliente_assente: 1, hgl_da_riprogrammare: 2, hgl_promemoria_sede: 4,
    hgl_sede_disdetta: 1, hgl_ultimo_tentativo: 1, hgl_ritorno: 1, hgl_casi_reali: 1,
    hgl_acconto: 2, hgl_come_eravamo_rimasti: 2,
  };
  //  Il giro passa il consulente (v2) anche a questi due, ma il loro testo Utility non lo nomina: un segnaposto in meno.
  const SENZA_CONSULENTE_NEL_TESTO = new Set(["hgl_da_riprogrammare", "hgl_come_eravamo_rimasti"]);
  c("ci sono tutti i 21 modelli hgl_ di ManyChat (20 con flusso + il testo del giorno prima)", Object.keys(VARIABILI).sort(), MODELLI_MANYCHAT.map((t) => t.name).sort());
  c(
    "ogni modello ha le variabili che il CRM manda, al massimo 4, e un segnaposto per ognuna (salvo il consulente non nominato dal testo)",
    [],
    MODELLI_MANYCHAT.filter((t) => {
      const n = (t.body.match(/\{\{\d+\}\}/g) ?? []).length;
      return t.params.length !== VARIABILI[t.name] || t.params.length > MAX_PARAMETRI || n !== t.params.length - (SENZA_CONSULENTE_NEL_TESTO.has(t.name) ? 1 : 0);
    }).map((t) => t.name),
  );
  c(
    "esempi pieni per ogni variabile, anteprima senza segnaposto",
    [],
    MODELLI_MANYCHAT.filter((t) => {
      const v = PM.valoriDiEsempio(t);
      return v.some((x) => !x.trim()) || /\{\{\d+\}\}/.test(PM.anteprimaTesto(t, v));
    }).map((t) => t.name),
  );
  //  ⚠️ La chat manda questo testo come testo libero: deve essere IDENTICO ai modelli Meta.
  c(
    "il testo dei due modelli della mattina è quello approvato da Meta (v5 col link, v4 senza)",
    [
      "Ciao {{1}}, ci vediamo oggi alle {{2}} per la tua consulenza online con {{3}}.\n\nIl link per collegarti è questo: {{4}}\nPoco prima te lo ricordo qui.",
      "Ciao {{1}}, ti ricordo che oggi alle ore {{2}} hai la tua consulenza online con Hair Genius Labs.\n\nTi seguirà {{3}}. Poco prima dell'inizio ti arriva il link per collegarti.\n\nSe hai un imprevisto, rispondi qui e troviamo un altro orario.",
      ["lead_name", "appointment_time", "consultant_name", "meet_link"],
    ],
    [
      findMetaTemplate("hgl_meet_oggi_link").body,
      findMetaTemplate("hgl_meet_oggi").body,
      findMetaTemplate("hgl_meet_oggi_link").params.map((p) => p.key),
    ],
  );
  c("findMetaTemplate trova anche i modelli di ManyChat", "hgl_meet_oggi", findMetaTemplate("hgl_meet_oggi")?.name);
  c("…e i vecchi restano dove sono (META_TEMPLATES non cambia)", false, META_TEMPLATES.some((t) => t.name.startsWith("hgl_")));

  gruppo("PROVA I MODELLI · LA TENDINA");
  const cloud = { canale: "cloud", modelliConFlusso: [], chiaveManychat: true, migrazione: true };
  c("canale Cloud API o non ancora letto: la lista di sempre", [META_TEMPLATES.length, META_TEMPLATES.length], [PM.modelliDaProvare(cloud).length, PM.modelliDaProvare(null).length]);
  const mcT = { canale: "manychat", modelliConFlusso: ["hgl_meet_oggi", "consulenza_conferma_presenza", "appuntamento_conferma_inesistente"], chiaveManychat: true, migrazione: true };
  c(
    "canale ManyChat: solo i modelli con un flusso, prima i vecchi poi quelli di ManyChat",
    ["consulenza_conferma_presenza", "hgl_meet_oggi"],
    PM.modelliDaProvare(mcT).map((t) => t.name),
  );
  c("canale ManyChat senza flussi: tendina vuota (nessuna prova destinata a fallire)", 0, PM.modelliDaProvare({ ...mcT, modelliConFlusso: [] }).length);
  c(
    "la prova di un modello ManyChat passa il controllo e manda il suo nome",
    ["hgl_meet_oggi", 3],
    (() => {
      const t = findMetaTemplate("hgl_meet_oggi");
      const k = PM.controllaProva({ numero: "+39 333 0000001", modello: t.name, valori: PM.valoriDiEsempio(t), stato: mcT });
      const b = k.ok ? PM.corpoProva(t, k.e164, k.valori) : null;
      return [b?.templateName, b?.templateParams.length];
    })(),
  );
}
