/** ── PROVE: «OGGI» DEL CONSULENTE CHE È DENTRO (31/10/2026) ───────────────────
 *  Richiesta del titolare: il prossimo meet e le cose da fare sono quelle del consulente loggato,
 *  non quelle degli altri; in «Da fare» le pastiglie Oggi / Ieri / Data / Da…a….
 *  Regole pure: src/crm/consulente-dentro.ts (chi è dentro), src/crm/chatwa/prossimo-meet.ts
 *  (soloDi), src/crm/periodo-da-fare.ts (le date) e src/crm/chatwa/pannello-oggi.ts (gruppi).
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveOggiDelConsulente(mod, { c, gruppo, radice }) {
  const D = mod["consulente-dentro"];
  const P = mod["chatwa/prossimo-meet"];
  const T = mod["periodo-da-fare"];
  const PO = mod["chatwa/pannello-oggi"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  gruppo("OGGI DEL CONSULENTE · CHI È DENTRO");
  const dentro = (o) => D.consulenteDelloSchermo({ collegatoId: "m", admin: false, faConsulenze: true, ...o });
  c("titolare con email e password (nessun consulente collegato): tutti, libero", { id: "", bloccato: false }, dentro({ collegatoId: "", admin: true }));
  c("consulente col PIN: parte su di sé e non può cambiare", { id: "m", bloccato: true }, dentro({}));
  c("admin col PIN: parte sul consulente del PIN e può scegliere (31/10: «Col PIN vede solo il suo»)", { id: "m", bloccato: false }, dentro({ admin: true }));
  c("admin col PIN anche senza il permesso consulenze: parte sul PIN", { id: "m", bloccato: false }, dentro({ admin: true, faConsulenze: false }));
  c("setter che non fa consulenze: niente da isolare (le consulenze non sono sue)", { id: "", bloccato: false }, dentro({ faConsulenze: false }));
  c("collegato senza id leggibile: tutti, libero", { id: "", bloccato: false }, dentro({ collegatoId: undefined }));
  const consulente = dentro({});
  const admin = dentro({ admin: true });
  c("bloccato: la scelta fatta altrove non conta mai", "m", D.chiVale(consulente, "altro"));
  c("bloccato: nemmeno «tutti»", "m", D.chiVale(consulente, ""));
  c("admin col PIN senza scelta: il suo", "m", D.chiVale(admin, null));
  c("libero che sceglie «tutti»: tutti", "", D.chiVale(admin, ""));
  c("libero che sceglie un altro: quell'altro", "f", D.chiVale(admin, "f"));
  c("titolare senza collegato: senza scelta, tutti", "", D.chiVale(dentro({ collegatoId: "", admin: true }), null));

  gruppo("OGGI DEL CONSULENTE · IL PROSSIMO MEET È SOLO IL SUO");
  const OGGI = "2026-10-31";
  const alle = (hhmm) => Date.parse(`${OGGI}T${hhmm}:00+01:00`);
  const consulenti = [
    { id: "m", data: { nome: "Mirko Rossi" } },
    { id: "f", data: { nome: "Filippo" } },
  ];
  let n = 0;
  const chat = (consulenteId, ora) => {
    n++;
    return {
      phone: `+39333222${String(n).padStart(4, "0")}`,
      lead: { id: `l${n}`, data: { stato: "appuntamento_fissato", dataMeeting: OGGI, oraMeeting: ora, consulenteId } },
    };
  };
  const dim = chat("f", "09:00");
  const dim2 = chat("m", "10:30");
  const dim3 = chat("m", "16:00");
  const tutte = [dim, dim2, dim3];
  const tel = (r) => r?.chat.phone ?? null;
  c("senza consulente dentro (titolare): il prossimo di tutti, com'era", dim.phone, tel(P.prossimoMeet(tutte, OGGI, alle("08:00"), consulenti)));
  c("soloDi vuoto: come prima", dim.phone, tel(P.prossimoMeet(tutte, OGGI, alle("08:00"), consulenti, "")));
  c("Mirko dentro: il suo prossimo, non quello di Filippo alle 9", dim2.phone, tel(P.prossimoMeet(tutte, OGGI, alle("08:00"), consulenti, "m")));
  c("…e l'etichetta dice il suo nome", "Meet alle 10:30 · Mirko", P.prossimoMeet(tutte, OGGI, alle("08:00"), consulenti, "m")?.etichetta);
  c("Mirko dentro, passato il suo delle 10:30 (oltre la tolleranza): il successivo suo (16:00)", dim3.phone, tel(P.prossimoMeet(tutte, OGGI, alle("13:00"), consulenti, "m")));
  c("Filippo dentro: il suo, anche se c'è altro prima", dim.phone, tel(P.prossimoMeet(tutte, OGGI, alle("08:00"), consulenti, "f")));
  c("chi non ha meet oggi non vede quelli degli altri", null, P.prossimoMeet(tutte, OGGI, alle("08:00"), consulenti, "z"));
  c("un meet senza consulente non è di nessuno: non compare a chi è dentro", null, P.prossimoMeet([chat(null, "11:00")], OGGI, alle("08:00"), consulenti, "m"));
  c("non muta l'elenco", 3, (P.prossimoMeet(tutte, OGGI, alle("08:00"), consulenti, "m"), tutte.length));

  gruppo("OGGI DEL CONSULENTE · LE DATE DI «DA FARE»");
  const g = "2026-10-31";
  c("di serie: oggi", { tipo: "oggi", da: "", a: "" }, T.PERIODO_DI_SERIE);
  c("oggi", { da: g, a: g }, T.intervalloDi({ tipo: "oggi", da: "", a: "" }, g));
  c("ieri", { da: "2026-10-30", a: "2026-10-30" }, T.intervalloDi({ tipo: "ieri", da: "", a: "" }, g));
  c("ieri a cavallo del mese", { da: "2026-10-31", a: "2026-10-31" }, T.intervalloDi({ tipo: "ieri", da: "", a: "" }, "2026-11-01"));
  c("ieri a cavallo dell'anno", { da: "2025-12-31", a: "2025-12-31" }, T.intervalloDi({ tipo: "ieri", da: "", a: "" }, "2026-01-01"));
  c("una data sola", { da: "2026-10-12", a: "2026-10-12" }, T.intervalloDi({ tipo: "giorno", da: "2026-10-12", a: "" }, g));
  c("una data sola ancora vuota: oggi (non un elenco vuoto)", { da: g, a: g }, T.intervalloDi({ tipo: "giorno", da: "", a: "" }, g));
  c("da… a…", { da: "2026-10-12", a: "2026-10-20" }, T.intervalloDi({ tipo: "intervallo", da: "2026-10-12", a: "2026-10-20" }, g));
  c("da… a… scritto al contrario: si rimette in ordine", { da: "2026-10-12", a: "2026-10-20" }, T.intervalloDi({ tipo: "intervallo", da: "2026-10-20", a: "2026-10-12" }, g));
  c("da… a… con un capo solo: quel giorno", { da: "2026-10-12", a: "2026-10-12" }, T.intervalloDi({ tipo: "intervallo", da: "2026-10-12", a: "" }, g));
  c("…anche col solo «a»", { da: "2026-10-20", a: "2026-10-20" }, T.intervalloDi({ tipo: "intervallo", da: "", a: "2026-10-20" }, g));
  c("una data che non esiste vale come vuota", { da: g, a: g }, T.intervalloDi({ tipo: "giorno", da: "2026-02-31", a: "" }, g));

  gruppo("OGGI DEL CONSULENTE · COSA SI RICORDA");
  const salva = (p, giorno) => T.scriviPeriodo(p, giorno);
  const ieriScelto = { tipo: "ieri", da: "", a: "" };
  c("scritto e riletto lo stesso giorno: la stessa scelta", ieriScelto, T.leggiPeriodo(salva(ieriScelto, g), g));
  const inter = { tipo: "intervallo", da: "2026-10-12", a: "2026-10-20" };
  c("anche un intervallo", inter, T.leggiPeriodo(salva(inter, g), g));
  c("scelta fatta ieri: stamattina si riparte da oggi", T.PERIODO_DI_SERIE, T.leggiPeriodo(salva(ieriScelto, "2026-10-30"), g));
  c("niente di salvato: oggi", T.PERIODO_DI_SERIE, T.leggiPeriodo(null, g));
  c("testo rovinato: oggi", T.PERIODO_DI_SERIE, T.leggiPeriodo("{non json", g));
  c("tipo sconosciuto: oggi", T.PERIODO_DI_SERIE, T.leggiPeriodo(JSON.stringify({ tipo: "boh", giorno: g }), g));
  c("date rovinate dentro una scelta valida: ripulite", { tipo: "giorno", da: "", a: "" }, T.leggiPeriodo(JSON.stringify({ tipo: "giorno", da: "pippo", a: 5, giorno: g }), g));

  gruppo("OGGI DEL CONSULENTE · LE COSE DA FARE PER DATA");
  const ora = new Date("2026-10-31T09:00:00Z");
  const adesso = ora.getTime();
  const lead = (id, data = {}) => ({ id, data: { nome: `N${id}`, ...data } });
  const riga = (id, extra) => ({ id, tipo: "task", cosa: id, chi: "", giorno: g, ora: "", istante: null, fatta: false, ...extra });
  const righe = [
    riga("oggi-mio", { lead: lead("a", { consulenteId: "m" }) }),
    riga("oggi-altrui", { lead: lead("b", { consulenteId: "f" }) }),
    riga("ieri-mio", { giorno: "2026-10-30", lead: lead("c", { consulenteId: "m" }) }),
    riga("ieri-altrui", { giorno: "2026-10-30", lead: lead("d", { consulenteId: "f" }) }),
    riga("ieri-fatto", { giorno: "2026-10-30", fatta: true, lead: lead("e", { consulenteId: "m" }) }),
    riga("ieri-lead-arretrato", { tipo: "ricontatto", giorno: "2026-10-30", lead: lead("x", { consulenteId: "m" }) }),
    riga("vecchio-mio", { giorno: "2026-10-20", lead: lead("g", { consulenteId: "m" }) }),
    riga("domani-mio", { giorno: "2026-11-01", lead: lead("h", { consulenteId: "m" }) }),
  ];
  const mestieri = new Map();
  //  Dentro lo stesso gruppo l'ordine fra righe pari è quello di `ordinaRighe` (non è di questa commessa): qui si confrontano in ordine alfabetico.
  const ids = (gr) => gr.map((x) => [x.fascia, x.righe.map((r) => r.id).sort()]);
  const vedo = (periodo, chi = "") => ids(PO.daFareDelPannello({ righe, adesso, oggi: g, chi, mestieri, periodo }));
  c("senza periodo e con periodo «oggi»: lo stesso di prima (oggi + rimasto indietro, non l'arretrato dei lead)",
    vedo(undefined, "m"), vedo(T.PERIODO_DI_SERIE, "m"));
  c("oggi, solo del consulente: le sue di oggi e il suo rimasto indietro, mai gli altrui né l'arretrato dei lead",
    [["daIeri", ["ieri-mio", "vecchio-mio"]], ["quandoCapita", ["oggi-mio"]]],
    vedo(T.PERIODO_DI_SERIE, "m"));
  c("oggi, di tutti (admin): anche l'altrui",
    [["daIeri", ["ieri-altrui", "ieri-mio", "vecchio-mio"]], ["quandoCapita", ["oggi-altrui", "oggi-mio"]]],
    vedo(T.PERIODO_DI_SERIE, ""));
  c("ieri, solo del consulente: gruppo del giorno, senza spuntate né altrui",
    [["giorno:2026-10-30", ["ieri-lead-arretrato", "ieri-mio"]]],
    vedo({ tipo: "ieri", da: "", a: "" }, "m"));
  c("ieri, di tutti (admin): anche l'altrui",
    [["giorno:2026-10-30", ["ieri-altrui", "ieri-lead-arretrato", "ieri-mio"]]],
    vedo({ tipo: "ieri", da: "", a: "" }, ""));
  c("una data sola nel passato",
    [["giorno:2026-10-20", ["vecchio-mio"]]],
    vedo({ tipo: "giorno", da: "2026-10-20", a: "" }, "m"));
  c("una data nel futuro",
    [["giorno:2026-11-01", ["domani-mio"]]],
    vedo({ tipo: "giorno", da: "2026-11-01", a: "" }, "m"));
  c("da… a…: un gruppo per giorno, in ordine di calendario",
    [["giorno:2026-10-20", ["vecchio-mio"]], ["giorno:2026-10-30", ["ieri-lead-arretrato", "ieri-mio"]], ["giorno:2026-10-31", ["oggi-mio"]]],
    vedo({ tipo: "intervallo", da: "2026-10-20", a: "2026-10-31" }, "m"));
  c("un giorno senza niente: nessun gruppo", [], vedo({ tipo: "giorno", da: "2026-10-25", a: "" }, "m"));
  const gruppiIeri = PO.daFareDelPannello({ righe, adesso, oggi: g, chi: "m", mestieri, periodo: { tipo: "ieri", da: "", a: "" } });
  c("il contatore segue il filtro (consulente + data)", 2, PO.contaRighe(gruppiIeri));
  c("il titolo del gruppo dice il giorno in italiano", "Ieri · venerdì 30 ottobre", PO.titoloDelGiorno("2026-10-30", g));
  c("oggi", "Oggi · sabato 31 ottobre", PO.titoloDelGiorno(g, g));
  c("domani", "Domani · domenica 1 novembre", PO.titoloDelGiorno("2026-11-01", g));
  c("un altro giorno: senza etichetta", "lunedì 12 ottobre", PO.titoloDelGiorno("2026-10-12", g));

  gruppo("OGGI DEL CONSULENTE · DISEGNO (SORGENTE)");
  const pan = senzaCommenti(leggi("src/crm/chatwa/PannelloOggi.tsx"));
  const elenco = senzaCommenti(leggi("src/crm/chatwa/ElencoChat.tsx"));
  c("il pannello decide chi è dentro con la funzione pura (una regola sola)", true, /consulenteDelloSchermo\(/.test(pan) && /chiVale\(/.test(pan));
  c("il pannello passa il periodo scelto alle cose da fare", true, /periodo[,:\s]/.test(pan) && /daFareDelPannello\(/.test(pan));
  c("il periodo si ricorda con localStorage dentro try/catch", true, /try\s*\{[^}]*localStorage[^}]*\}\s*catch/.test(pan));
  c("quattro pastiglie: Oggi, Ieri, Data, Da… a…", true, ["Oggi", "Ieri", "Data", "Da… a…"].every((t) => new RegExp(`>\\s*${t}\\s*<`).test(pan)));
  c("date scelte con input date nativi", true, (pan.match(/type="date"/g) ?? []).length >= 3);
  c("le pastiglie scorrono di lato, come nelle chat", true, /overflow-x-auto/.test(pan));
  c("l'elenco delle chat dà al prossimo meet il consulente dentro", true, /prossimoMeet\([\s\S]*?consultants,\s*\w+/.test(elenco));
}
