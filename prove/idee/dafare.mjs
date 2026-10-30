/** ── LE PROVE DELL'IDEA 2: «CHI NON HA CONFERMATO» IN CIMA A «DA FARE OGGI» ──
 *
 *  Commessa 2026-10-30-idee-chat. `prove/prove.mjs` impacchetta i moduli
 *  (`dafare/senza-conferma`, `dafare/righe`, ecc. in MODULI) e chiama
 *  `proveIdeeDafare(mod, aiuti)`. `aiuti` = { c, gruppo, radice }.
 *
 *  Dati inventati: nessun cliente vero. Gli istanti sono scritti in UTC (`Z`),
 *  così la prova dice lo stesso su qualunque computer; a Roma è UTC+2 fino al
 *  24/10/2026 compreso e UTC+1 dal 25/10 (cambio d'ora alle 03:00 locali).
 *  ───────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveIdeeDafare(mod, { c, gruppo, radice }) {
  const SC = mod["dafare/senza-conferma"];
  const DF = mod["dafare/righe"];
  const INV = mod["promemoria/invio"];

  const scheda = (giorno, ora, extra = {}) => ({
    nome: "Mario",
    cognome: "Esempio",
    telefono: "333 123 4567",
    stato: "appuntamento_fissato",
    dataMeeting: giorno,
    oraMeeting: ora,
    ...extra,
  });
  /** Il lead col promemoria confermato dal cliente, sulla chiave GIUSTA. */
  const confermata = (d, extra = {}) => ({
    ...d,
    promemoria: {
      stato: "inviato",
      chiave: INV.chiaveAppuntamento(d),
      inviatoIl: "2026-10-30T08:00:00Z",
      confermatoIl: "2026-10-30T09:00:00Z",
      confermatoVia: "whatsapp",
      ...extra,
    },
  });
  const visibile = (d, quando) => SC.senzaConfermaOggi(d, new Date(quando)) !== null;

  gruppo("DA FARE OGGI · CHI NON HA CONFERMATO: LE SOGLIE (ORE DI ROMA)");
  // 30/10/2026: Roma = UTC+1.
  const g30 = "2026-10-30";
  c(
    "consulenza 15:30: alle 11:59 non c'è ancora",
    false,
    visibile(scheda(g30, "15:30"), "2026-10-30T10:59:00Z"),
  );
  c("…alle 12:00 compare", true, visibile(scheda(g30, "15:30"), "2026-10-30T11:00:00Z"));
  c("…alle 15:29 c'è ancora", true, visibile(scheda(g30, "15:30"), "2026-10-30T14:29:00Z"));
  c("…alle 15:30 è passata: esce", false, visibile(scheda(g30, "15:30"), "2026-10-30T14:30:00Z"));
  c(
    "consulenza 14:00 (ultima «del pomeriggio»): dalle 12:00",
    [false, true],
    [
      visibile(scheda(g30, "14:00"), "2026-10-30T10:59:00Z"),
      visibile(scheda(g30, "14:00"), "2026-10-30T11:00:00Z"),
    ],
  );
  c(
    "consulenza serale 19:30: dalle 12:00",
    [false, true],
    [
      visibile(scheda(g30, "19:30"), "2026-10-30T10:59:00Z"),
      visibile(scheda(g30, "19:30"), "2026-10-30T11:00:00Z"),
    ],
  );
  c(
    "consulenza 13:59 (prima delle 14): dalle 11:29",
    [false, true],
    [
      visibile(scheda(g30, "13:59"), "2026-10-30T10:28:00Z"),
      visibile(scheda(g30, "13:59"), "2026-10-30T10:29:00Z"),
    ],
  );
  c(
    "consulenza 10:00: dalle 07:30 (2 ore e mezza prima)",
    [false, true],
    [
      visibile(scheda(g30, "10:00"), "2026-10-30T06:29:00Z"),
      visibile(scheda(g30, "10:00"), "2026-10-30T06:30:00Z"),
    ],
  );
  c(
    "consulenza 9:00 scritta senza zero: dalle 06:30",
    [false, true],
    [
      visibile(scheda(g30, "9:00"), "2026-10-30T05:29:00Z"),
      visibile(scheda(g30, "9:00"), "2026-10-30T05:30:00Z"),
    ],
  );
  c(
    "le soglie in minuti",
    [720, 720, 450, 0],
    [SC.avvisoDalle(840), SC.avvisoDalle(1170), SC.avvisoDalle(600), SC.avvisoDalle(100)],
  );

  gruppo("DA FARE OGGI · CHI NON HA CONFERMATO: IL CAMBIO D'ORA");
  // Dal 25/10 Roma è UTC+1: mezzogiorno a Roma sono le 11:00Z, non le 10:00Z.
  c(
    "25/10 (ora solare), cons. 16:00: le 10:00Z sono le 11 a Roma, presto",
    false,
    visibile(scheda("2026-10-25", "16:00"), "2026-10-25T10:00:00Z"),
  );
  c(
    "…le 11:00Z sono le 12: compare",
    true,
    visibile(scheda("2026-10-25", "16:00"), "2026-10-25T11:00:00Z"),
  );
  c(
    "24/10 (ancora ora legale), cons. 16:00: le 10:00Z sono le 12",
    [false, true],
    [
      visibile(scheda("2026-10-24", "16:00"), "2026-10-24T09:59:00Z"),
      visibile(scheda("2026-10-24", "16:00"), "2026-10-24T10:00:00Z"),
    ],
  );
  c(
    "25/10 mattina, cons. 09:00: dalle 06:30 solari = 05:30Z",
    [false, true],
    [
      visibile(scheda("2026-10-25", "09:00"), "2026-10-25T05:29:00Z"),
      visibile(scheda("2026-10-25", "09:00"), "2026-10-25T05:30:00Z"),
    ],
  );
  // 29/3/2026: alle 02:00 locali si passa all'ora legale (UTC+2).
  c(
    "29/3 (scatta l'ora legale), cons. 15:00: dalle 12:00 = 10:00Z",
    [false, true],
    [
      visibile(scheda("2026-03-29", "15:00"), "2026-03-29T09:59:00Z"),
      visibile(scheda("2026-03-29", "15:00"), "2026-03-29T10:00:00Z"),
    ],
  );
  c(
    "29/3 mattina, cons. 09:00: dalle 06:30 legali = 04:30Z",
    [false, true],
    [
      visibile(scheda("2026-03-29", "09:00"), "2026-03-29T04:29:00Z"),
      visibile(scheda("2026-03-29", "09:00"), "2026-03-29T04:30:00Z"),
    ],
  );
  c(
    "23:30 a Roma (22:30Z), cons. 23:45: è ancora oggi, compare",
    true,
    visibile(scheda("2026-10-30", "23:45"), "2026-10-30T22:30:00Z"),
  );
  c(
    "mezzanotte a Roma (23:00Z) è già domani: la consulenza di ieri non c'è",
    false,
    visibile(scheda("2026-10-30", "23:45"), "2026-10-30T23:00:00Z"),
  );

  gruppo("DA FARE OGGI · CHI NON HA CONFERMATO: CHI ESCE E CHI NO");
  const alle12 = new Date("2026-10-30T11:00:00Z");
  c(
    "ha confermato su WhatsApp: non compare",
    null,
    SC.senzaConfermaOggi(confermata(scheda(g30, "15:30")), alle12),
  );
  c(
    "confermato a voce: non compare",
    null,
    SC.senzaConfermaOggi(confermata(scheda(g30, "15:30"), { confermatoVia: "voce" }), alle12),
  );
  c(
    "«non posso» dopo il sì: torna",
    true,
    visibile(
      confermata(scheda(g30, "15:30"), {
        rispostaIl: "2026-10-30T10:00:00Z",
        rispostaTesto: "non posso",
      }),
      alle12,
    ),
  );
  c(
    "conferma di un altro orario (spostata): non vale, compare",
    true,
    visibile(
      confermata({ ...scheda(g30, "15:30") }, { chiave: "2026-10-30T11:00|123456789" }),
      alle12,
    ),
  );
  c(
    "promemoria inviato e senza risposta: compare",
    true,
    visibile(
      {
        ...scheda(g30, "15:30"),
        promemoria: {
          stato: "inviato",
          chiave: INV.chiaveAppuntamento(scheda(g30, "15:30")),
          inviatoIl: "2026-10-30T10:30:00Z",
        },
      },
      alle12,
    ),
  );
  c("nessun promemoria sulla scheda: compare", true, visibile(scheda(g30, "15:30"), alle12));
  c(
    "rifissato come fissato",
    true,
    visibile(scheda(g30, "15:30", { stato: "appuntamento_rifissato" }), alle12),
  );
  c(
    "altri stati (annullato, richiamo, chat): mai",
    [false, false, false],
    ["annullato", "richiamo", "gestire_in_chat"].map((stato) =>
      visibile(scheda(g30, "15:30", { stato }), alle12),
    ),
  );
  c("consulenza di domani: non compare", false, visibile(scheda("2026-10-31", "15:30"), alle12));
  c(
    "senza ora o con ora illeggibile: non si inventa",
    [false, false],
    [visibile(scheda(g30, ""), alle12), visibile(scheda(g30, "boh"), alle12)],
  );
  c(
    "scheda vuota o senza dati: nessun errore",
    [null, null],
    [SC.senzaConfermaOggi(undefined, alle12), SC.senzaConfermaOggi({}, alle12)],
  );
  c(
    "l'etichetta",
    { ora: "15:30", etichetta: "Non ha confermato · consulenza alle 15:30" },
    SC.senzaConfermaOggi(scheda(g30, "15:30"), alle12),
  );
  c(
    "l'etichetta normalizza l'ora (9:00 → 09:00)",
    "Non ha confermato · consulenza alle 09:00",
    SC.senzaConfermaOggi(scheda(g30, "9:00"), new Date("2026-10-30T06:00:00Z"))?.etichetta,
  );

  gruppo("DA FARE OGGI · LA RIGA, LA FASCIA E LA PRIORITÀ");
  const lead = (id, dati) => ({ id, data: dati });
  // L'ora locale del computer non conta per la regola (usa Roma): ma `costruisciRighe`
  // legge «oggi» col calendario locale, quindi si guardano solo il giorno e i campi.
  const righe = DF.costruisciRighe({
    ora: alle12,
    task: [],
    leads: [
      lead("senza", scheda(g30, "15:30")),
      lead("conferma", confermata(scheda(g30, "17:00", { nome: "Anna" }))),
      lead("presto", scheda(g30, "19:00", { nome: "Luca" })),
      lead("domani", scheda("2026-10-31", "10:00", { nome: "Elena" })),
      lead("altro", { nome: "Rita", cognome: "Prova", stato: "da_spostare" }),
      lead("posa", {
        nome: "Paolo",
        cognome: "Posa",
        stato: "posa_in_sede",
        installazione: { dataInstallazione: g30, orarioInstallazione: "16:00" },
      }),
    ],
  });
  const di = (id) => righe.find((r) => r.id === `lead:${id}`);
  c(
    "senza conferma: una riga sola, tipo dedicato",
    [1, "senza_conferma"],
    [righe.filter((r) => r.id === "lead:senza").length, di("senza")?.tipo],
  );
  c(
    "…col giorno e l'ora della consulenza",
    [g30, "15:30"],
    [di("senza")?.giorno, di("senza")?.ora],
  );
  c(
    "…la frase del verbo e l'etichetta",
    ["Chiamare Mario Esempio", "Non ha confermato · consulenza alle 15:30"],
    [di("senza")?.cosa, di("senza")?.senzaConferma?.etichetta],
  );
  c("ha confermato: nessuna riga (come prima di questa idea)", undefined, di("conferma"));
  c("consulenza di domani: nessuna riga", undefined, di("domani"));
  c(
    "un lead vinto con la posa di oggi: solo la riga della posa, nessun doppione",
    [1, 0],
    [
      righe.filter((r) => r.id === "posa:posa").length,
      righe.filter((r) => r.id === "lead:posa").length,
    ],
  );
  c("«Da riprogrammare» resta com'era", "meet_da_rifissare", di("altro")?.tipo);
  c("le righe sono tutte con id unico", righe.length, new Set(righe.map((r) => r.id)).size);

  const adesso = alle12.getTime();
  const oggi = g30;
  c(
    "la fascia è «Da sentire», e viene prima di tutte",
    ["daSentire", "daSentire"],
    [DF.fasciaDi(di("senza"), adesso, oggi), DF.FASCE[0]],
  );
  c("un lead normale non cambia fascia", "quandoCapita", DF.fasciaDi(di("altro"), adesso, oggi));
  c(
    "la posa nemmeno",
    false,
    DF.fasciaDi(
      righe.find((r) => r.id === "posa:posa"),
      adesso,
      oggi,
    ) === "daSentire",
  );
  // Il lead già nell'elenco per un altro motivo: la riga resta una, con il segno in più.
  const doppio = { ...di("senza"), tipo: "ricontatto", senzaConferma: undefined };
  c(
    "senza il segno, una riga d'altro tipo non va in cima",
    false,
    DF.fasciaDi(doppio, adesso, oggi) === "daSentire",
  );
  c(
    "col segno, qualunque sia il tipo, sale in cima",
    "daSentire",
    DF.fasciaDi({ ...doppio, senzaConferma: { ora: "15:30", etichetta: "x" } }, adesso, oggi),
  );
  c(
    "titolo e nota della fascia ci sono",
    [true, true],
    [!!DF.TITOLO_FASCIA.daSentire, !!DF.NOTA_FASCIA.daSentire],
  );
  c(
    "il filtro «Non confermati» ha spiegazione e verbo",
    [true, true],
    [!!DF.META_RIGA.senza_conferma.spiegazione, DF.META_RIGA.senza_conferma.verbo === "Chiamare"],
  );
  c("è anche tra i tipi del filtro", true, DF.TIPI_RIGA.includes("senza_conferma"));

  const piu = DF.ordinaRighe(righe.filter((r) => r.senzaConferma));
  c(
    "dentro «Da sentire» prima la consulenza più vicina",
    ["lead:senza", "lead:presto"],
    piu.map((r) => r.id),
  );

  // Esce da sola: alle 12 la riga c'è, quando il cliente conferma sparisce.
  const dopo = DF.costruisciRighe({
    ora: alle12,
    task: [],
    leads: [lead("senza", confermata(scheda(g30, "15:30")))],
  });
  c("quando conferma, ricalcolando la riga non c'è più", 0, dopo.length);
  const passata = DF.costruisciRighe({
    ora: new Date("2026-10-30T15:00:00Z"),
    task: [],
    leads: [lead("senza", scheda(g30, "15:30"))],
  });
  c("passata l'ora della consulenza, la riga non c'è più", 0, passata.length);
  const presto = DF.costruisciRighe({
    ora: new Date("2026-10-30T10:00:00Z"),
    task: [],
    leads: [lead("senza", scheda(g30, "15:30"))],
  });
  c("prima delle 12 la riga non c'è ancora", 0, presto.length);

  // La barra laterale conta le righe di oggi con la stessa funzione: ne basta una.
  gruppo("DA FARE OGGI · LE SCHERMATE (SORGENTE)");
  const sidebar = readFileSync(join(radice, "src/crm/CRMSidebar.tsx"), "utf8");
  c(
    "il badge del menu usa costruisciRighe e si ricalcola ogni minuto",
    true,
    /costruisciRighe\(\{ leads, task: taskManuali, ora \}\)/.test(sidebar) &&
      /\[leads, taskManuali, minutoAttuale\]/.test(sidebar) &&
      /setInterval\([\s\S]{0,80}60_000\)/.test(sidebar),
  );
  const voce = readFileSync(join(radice, "src/crm/dafare/VoceDaFare.tsx"), "utf8");
  c(
    "la riga mostra l'etichetta e il tasto tel: con numeroDaComporre",
    true,
    /riga\.senzaConferma\.etichetta/.test(voce) &&
      /href=\{`tel:\$\{numeroDaComporre\(/.test(voce) &&
      /from "@\/crm\/importa\/chiamare"/.test(voce),
  );
  c(
    "il tasto è a tutta larghezza sotto la riga (telefono 375 px) e alto 40 px",
    true,
    /basis-full/.test(voce) && /h-10 shrink-0/.test(voce),
  );
  const pagina = readFileSync(join(radice, "src/routes/CRM.dafare.tsx"), "utf8");
  c(
    "la pagina disegna i gruppi da FASCE (il nuovo gruppo compare da sé)",
    true,
    /FASCE\.map|for \(const f of FASCE\)/.test(pagina),
  );
  const righeSrc = readFileSync(join(radice, "src/crm/dafare/righe.tsx"), "utf8");
  c(
    "le altre schermate che usano il motore filtrano per tipo (scadenze: solo ricontatto e task)",
    true,
    /riga\.tipo !== "ricontatto" && riga\.tipo !== "task"/.test(
      readFileSync(join(radice, "src/crm/importa/scadenze.ts"), "utf8"),
    ) && /senzaConfermaOggi\(d, ora\)/.test(righeSrc),
  );
}
