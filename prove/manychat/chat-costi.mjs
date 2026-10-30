/** ── PROVE: CHAT WHATSAPP · I COSTI DEI MODELLI E IL PANNELLO (29/10/2026) ───────
 *
 *  Commessa 2026-10-29-chat-modelli-costi. Parte A: tariffe e categorie (un solo file
 *  di costanti) e la casella a finestra chiusa che non apre da sola l'elenco.
 *  Parte B: il calcolo dei costi per periodo (ora di Roma).
 *  Dati inventati: nessun numero, nessun nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveChatCosti(mod, { c, gruppo, radice }) {
  const K = mod["chatwa/costi-whatsapp"];
  const T = mod["wa-meta-templates"];

  gruppo("CHAT · COSTI · TARIFFE E CATEGORIE (un solo file)");
  c(
    "tariffe Meta Italia in EUR dalla rate card del 1 ottobre 2026",
    [0.0658, 0.0248],
    [K.TARIFFE.marketing, K.TARIFFE.utility],
  );
  c("data e fonte dichiarate", [true, true], [
    /^2026-10-01$/.test(K.TARIFFE_DAL),
    K.TARIFFE_FONTE.startsWith("https://developers.facebook.com/docs/whatsapp/pricing"),
  ]);
  const utility = [
    "consulenza_conferma_presenza", "cliente_assente", "meet_adesso", "meet_domani", "meet_oggi",
    "non_risponde", "promemoria_meet", "promemoria_sede", "richiamo_concordato", "sede_disdetta",
  ];
  const marketing = [
    "casi_reali", "da_riprogrammare", "meet_da_fissare", "primo_contatto", "richiamo_24h",
    "ricontatto_consulenza", "ritorno", "ultimo_tentativo",
  ];
  c("le dieci Utility di ManyChat", [], utility.filter((n) => K.categoriaModello(`hgl_${n}`) !== "utility" && K.categoriaModello(n) !== "utility"));
  c("le otto Marketing di ManyChat", [], marketing.filter((n) => K.categoriaModello(`hgl_${n}`) !== "marketing"));
  c(
    "la categoria vera vince su quella scritta nel codice (meet_da_fissare, da_riprogrammare)",
    ["UTILITY", "UTILITY", "marketing", "marketing"],
    [
      T.findMetaTemplate("hgl_meet_da_fissare").category,
      T.findMetaTemplate("hgl_da_riprogrammare").category,
      K.categoriaModello("hgl_meet_da_fissare", "UTILITY"),
      K.categoriaModello("hgl_da_riprogrammare", "UTILITY"),
    ],
  );
  c("i nomi _v2 / _v3 valgono come l'originale", ["marketing", "utility", "marketing"], [
    K.categoriaModello("hgl_primo_contatto_v2"),
    K.categoriaModello("hgl_meet_oggi_v3"),
    K.categoriaModello("primo_contatto_v2"),
  ]);
  c("un modello sconosciuto usa la categoria dichiarata", ["utility", "marketing"], [
    K.categoriaModello("altro_nuovo", "UTILITY"),
    K.categoriaModello("altro_nuovo", "MARKETING"),
  ]);
  c("…e senza categoria vale la più cara (mai sottostimare)", "marketing", K.categoriaModello("altro_nuovo"));
  c("la mattina col link (hgl_meet_oggi_link, v5) è Utility", ["utility", "utility", true], [
    K.categoriaModello("hgl_meet_oggi_link"),
    K.categoriaModello("hgl_meet_oggi_link_v5", "MARKETING"),
    K.categoriaConosciuta("hgl_meet_oggi_link"),
  ]);
  c("prezzo di un modello", [0.0658, 0.0248], [K.prezzoModello("hgl_ritorno"), K.prezzoModello("hgl_meet_oggi")]);
  c("euro: virgola all'italiana", ["0,0658 €", "1,23 €", "0,00 €"], [K.euro(0.0658, 4), K.euro(1.2345, 2), K.euro(0, 2)]);
  c(
    "la nota dei prezzi dice cifre, data e che si paga",
    true,
    /Marketing ≈ 0,0658 €/.test(K.notaPrezzi()) &&
      /Utility ≈ 0,0248 €/.test(K.notaPrezzi()) &&
      /1 ottobre 2026/.test(K.notaPrezzi()) &&
      /si paga/i.test(K.notaPrezzi()),
  );

  gruppo("CHAT · FINESTRA CHIUSA · L'ELENCO NON SI APRE DA SOLO");
  const cas = readFileSync(join(radice, "src/crm/chatwa/Casella.tsx"), "utf8");
  const sm = readFileSync(join(radice, "src/crm/chatwa/ScegliModello.tsx"), "utf8");
  const blocco = cas.slice(cas.indexOf('if (stato === "solo_modelli")'), cas.indexOf("const configurata"));
  c("un pulsante «Invia un modello» c'è", true, /Invia un modello/.test(blocco));
  c("lo stato dell'elenco parte chiuso", true, /useState\(false\)/.test(cas) && /modelliAperti/.test(cas));
  c("l'elenco è dentro un foglio che si apre solo a richiesta", true, /<Sheet open=\{modelliAperti\}/.test(blocco));
  c("fuori dal foglio non c'è nessun elenco", 1, (blocco.match(/<ScegliModello/g) ?? []).length);
  c("…e sta dopo l'apertura del foglio", true, blocco.indexOf("<Sheet open") < blocco.indexOf("<ScegliModello"));
  c("la barra dice «Finestra chiusa · solo modelli approvati»", true, /Finestra chiusa · solo modelli approvati/.test(blocco));
  c("ogni modello dell'elenco mostra categoria e prezzo, e la nota si paga", true, /categoriaModello\(/.test(sm) && /prezzoModello\(/.test(sm) && /notaPrezzi\(\)/.test(sm));
  c("niente di nuovo con la finestra aperta (la frase resta)", true, /Puoi scrivere libero/.test(readFileSync(join(radice, "src/crm/chatwa/stato.ts"), "utf8")) && !/costi-whatsapp/.test(cas.slice(cas.indexOf("const configurata"))));

  /* ── B. IL CALCOLO DEI COSTI PER PERIODO ───────────────────────────────── */
  const C = mod["chatwa/calcolo-costi"];
  //  Giovedì 29/10/2026, 15:00 a Roma (ora solare: il cambio è nella notte del 25/10).
  const ADESSO = new Date("2026-10-29T14:00:00Z");
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  const inv = (quando, tipo, modello, extra = {}) => ({
    tipo,
    modello,
    conFlusso: modello !== null || !!extra.conFlusso,
    inviatoIl: quando,
  });

  gruppo("CHAT · COSTI · I PERIODI (ora di Roma)");
  c(
    "i cinque periodi, Oggi per primo",
    ["oggi", "3", "7", "30", "90"],
    C.PERIODI.map((p) => p.id),
  );
  c("le etichette", ["Oggi", "3 giorni", "7 giorni", "30 giorni", "90 giorni"], C.PERIODI.map((p) => p.etichetta));
  c("predefinito Oggi", "oggi", C.PERIODO_INIZIALE);
  c("Oggi comincia alla mezzanotte di Roma (ora solare: 23:00Z del giorno prima)", "2026-10-28T23:00:00.000Z", C.inizioPeriodo("oggi", ADESSO).toISOString());
  c("3 giorni: oggi e i due prima", "2026-10-26T23:00:00.000Z", C.inizioPeriodo("3", ADESSO).toISOString());
  c("7 giorni attraversa il cambio d'ora (25/10): la mezzanotte resta di Roma", "2026-10-22T22:00:00.000Z", C.inizioPeriodo("7", ADESSO).toISOString());
  c("30 giorni", "2026-09-29T22:00:00.000Z", C.inizioPeriodo("30", ADESSO).toISOString());
  c("90 giorni", "2026-07-31T22:00:00.000Z", C.inizioPeriodo("90", ADESSO).toISOString());
  c(
    "subito dopo mezzanotte a Roma è già il giorno nuovo",
    "2026-10-29T23:00:00.000Z",
    C.inizioPeriodo("oggi", new Date("2026-10-30T00:30:00+01:00")).toISOString(),
  );
  c("un periodo sconosciuto vale Oggi", "2026-10-28T23:00:00.000Z", C.inizioPeriodo("boh", ADESSO).toISOString());
  c("periodoValido", [true, false, false], [C.periodoValido("7"), C.periodoValido("8"), C.periodoValido(undefined)]);

  gruppo("CHAT · COSTI · IL CALCOLO");
  {
    const invii = [
      inv("2026-10-29T08:00:00Z", "primo_contatto", "hgl_primo_contatto"), // marketing, oggi
      inv("2026-10-29T09:00:00Z", "primo_contatto", "hgl_primo_contatto"),
      inv("2026-10-29T10:00:00Z", "meet_oggi", "hgl_meet_oggi"), // utility, oggi
      inv("2026-10-29T11:00:00Z", "chat", "hgl_meet_da_fissare"), // a mano, marketing (vera categoria)
      inv("2026-10-29T12:00:00Z", "chat", null), // testo libero: non si paga
      inv("2026-10-28T22:59:59Z", "primo_contatto", "hgl_primo_contatto"), // 23:59:59 di ieri a Roma: fuori da Oggi
      inv("2026-10-27T10:00:00Z", "ritorno", "hgl_ritorno"), // 2 giorni fa
      inv("2026-10-20T10:00:00Z", "promemoria", "hgl_promemoria_meet"), // 9 giorni fa
      inv("2026-09-01T10:00:00Z", "meet_oggi", "hgl_meet_oggi"), // 58 giorni fa
      inv("2026-10-29T16:00:00Z", "primo_contatto", "hgl_primo_contatto"), // nel futuro: non conta
    ];
    const oggi = C.calcolaCosti(invii, "oggi", ADESSO);
    c("Oggi: 4 messaggi a pagamento", 4, oggi.messaggi);
    c(
      "…per categoria",
      [
        ["marketing", 3, r6(3 * 0.0658)],
        ["utility", 1, 0.0248],
      ],
      oggi.categorie.map((x) => [x.categoria, x.messaggi, x.costo]),
    );
    c("…il totale è la somma", r6(3 * 0.0658 + 0.0248), oggi.totale);
    c(
      "…divisione: automatici e a mano",
      { automatici: [3, r6(2 * 0.0658 + 0.0248)], mano: [1, 0.0658] },
      { automatici: [oggi.automatici.messaggi, oggi.automatici.costo], mano: [oggi.mano.messaggi, oggi.mano.costo] },
    );
    c(
      "…per tipo (i più costosi prima)",
      [["primo_contatto", 2], ["chat", 1], ["meet_oggi", 1]],
      oggi.perTipo.map((x) => [x.tipo, x.messaggi]),
    );
    c("…il testo libero si conta a parte, gratis", 1, oggi.testiLiberi);
    const t3 = C.calcolaCosti(invii, "3", ADESSO);
    c("3 giorni: entra anche ieri (22:59Z) e il ritorno di 2 giorni fa", 6, t3.messaggi);
    const t7 = C.calcolaCosti(invii, "7", ADESSO);
    c("7 giorni: non entra il promemoria di 9 giorni fa", 6, t7.messaggi);
    const t30 = C.calcolaCosti(invii, "30", ADESSO);
    c("30 giorni: entra", 7, t30.messaggi);
    const t90 = C.calcolaCosti(invii, "90", ADESSO);
    c("90 giorni: entra anche settembre", 8, t90.messaggi);
    c("il futuro non conta mai (i primi contatti sono 3, non 4)", 3, t90.perTipo.find((x) => x.tipo === "primo_contatto").messaggi);
  }
  {
    //  Il modello non si sa: si stima dal tipo, o con la categoria più cara.
    const x = C.calcolaCosti(
      [
        inv("2026-10-29T08:00:00Z", "meet_domani", null, { conFlusso: true }), // dal tipo: utility
        inv("2026-10-29T08:05:00Z", "chat", null, { conFlusso: true }), // flusso sconosciuto da chat: marketing, stimato
        inv("2026-10-29T08:10:00Z", "prova", null), // senza flusso: non si paga
        inv("2026-10-29T08:15:00Z", "promemoria", "altro_modello_nuovo"), // modello fuori elenco: marketing
      ],
      "oggi",
      ADESSO,
    );
    c("modello ignoto: dal tipo / più caro", [r6(0.0248 + 0.0658 + 0.0658), 3], [x.totale, x.messaggi]);
    c("…quanti sono solo stimati", 3, x.stimati);
  }
  {
    const v = C.calcolaCosti([], "30", ADESSO);
    c("nessun invio: tutto a zero, le due categorie ci sono comunque", [0, 0, ["marketing", "utility"], 0], [
      v.totale,
      v.messaggi,
      v.categorie.map((x) => x.categoria),
      v.perTipo.length,
    ]);
    c("righe rotte o senza data: ignorate, mai un NaN", 0, C.calcolaCosti([{ tipo: "x", modello: null, conFlusso: true, inviatoIl: "boh" }, null, {}], "90", ADESSO).totale);
  }

  gruppo("CHAT · COSTI · NIENTE DI PRIVATO");
  {
    const r = C.calcolaCosti([inv("2026-10-29T08:00:00Z", "primo_contatto", "hgl_primo_contatto")], "oggi", ADESSO);
    const testo = JSON.stringify(r);
    c("la risposta ha solo conteggi e importi", false, /telefono|nome|body|testo[^L]|lead|subscriber|\+?\d{9,}/i.test(testo));
    c("le chiavi sono quelle attese", ["automatici", "categorie", "dal", "mano", "messaggi", "perTipo", "periodo", "risparmio", "stimati", "testiLiberi", "totale"], Object.keys(r).sort());
  }

  gruppo("CHAT · COSTI · LA ROTTA E IL PANNELLO (sorgenti)");
  {
    const rotta = readFileSync(join(radice, "src/routes/api.crm.whatsapp-costi.ts"), "utf8");
    const srv = readFileSync(join(radice, "src/crm/chatwa/costi.server.ts"), "utf8");
    const pan = readFileSync(join(radice, "src/crm/chatwa/PannelloCosti.tsx"), "utf8");
    const pag = readFileSync(join(radice, "src/crm/chatwa/PaginaChat.tsx"), "utf8");
    c("la rotta passa dalla guardia del CRM, col permesso delle impostazioni, e vuole il titolare", true,
      /guardiaCRM\(request, cors, "impostazioni"\)/.test(rotta) && /adminUserId/.test(rotta) && /403/.test(rotta));
    c("la rotta legge soltanto (niente POST)", false, /POST:/.test(rotta));
    c("il periodo arriva dalla richiesta ma è validato", true, /periodoValido\(/.test(rotta));
    c("il server filtra per utente e solo gli invii arrivati", true,
      /\.eq\("user_id", userId\)/.test(srv) && /\.eq\("stato", "inviato"\)/.test(srv));
    c("il server non seleziona telefono né lead", false, /select[^;]*(telefono|lead_id)/.test(srv));
    c("nei log solo il codice", true, (srv.match(/console\.\w+\([^)]*\)/g) ?? []).every((x) => !/telefono|body/.test(x)));
    c("il pannello: un tasto per periodo, tutti da 44 px", true, /C\.?PERIODI|PERIODI\.map/.test(pan) && /min-h-11/.test(pan));
    c("il pannello dice che è una stima e dov'è il conto vero", true, /Wallet di ManyChat/.test(pan) && /Stima/i.test(pan));
    c("l'abbonamento ManyChat è a parte, mai sommato", true, /abbonamento/i.test(pan) && !/totale\s*\+/.test(pan));
    c("la pagina ha il tasto «Costi WhatsApp» con l'icona, solo con il permesso", true,
      /aria-label="Costi WhatsApp"/.test(pan) && /<TastoCosti/.test(pag) && /<PannelloCosti/.test(pag) && /usePuo\(\)\("impostazioni"\)/.test(pag));
  }
}
