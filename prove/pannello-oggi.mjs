/** ── LE PROVE DEL PANNELLO «OGGI» NELLA CHAT WHATSAPP ──────────────────────
 *
 *  Commessa 2026-10-30-oggi-e-fatture, parte A. Al posto della colonna «Lead
 *  CRM» la chat mostra la giornata: consulenze, cose da fare, e il vecchio
 *  elenco lead come terza scheda. Le regole NON sono nuove: le consulenze del
 *  giorno sono la stessa scelta dell'agenda di «Oggi» (crm/consulenze-del-
 *  giorno, usata anche da MeetGiornalieri), le cose da fare sono le righe di
 *  «Da fare oggi» con i filtri di partenza di quella pagina.
 *
 *  Dati inventati: nessun cliente vero.
 *  ───────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function provePannelloOggi(mod, { c, gruppo, radice }) {
  const CG = mod["consulenze-del-giorno"];
  const PO = mod["chatwa/pannello-oggi"];

  const lead = (id, data = {}) => ({ id, data: { nome: `N${id}`, ...data } });

  gruppo("PANNELLO OGGI · LE CONSULENZE DEL GIORNO (STESSA SCELTA DELL'AGENDA)");
  const g = "2026-10-30";
  const leads = [
    lead("a", { dataMeeting: g, oraMeeting: "15:00", consulenteId: "c1" }),
    lead("b", { dataMeeting: `${g}T00:00:00`, oraMeeting: "09:30", consulenteId: "c2" }),
    lead("c", { dataMeeting: "2026-10-31", oraMeeting: "10:00", consulenteId: "c1" }),
    lead("d", { dataMeeting: g, oraMeeting: "", consulenteId: "c1" }),
    lead("e", {}),
    null,
  ];
  c(
    "solo quelle del giorno, in ordine di ora (senza ora in cima, come l'agenda)",
    ["d", "b", "a"],
    CG.consulenzeDelGiorno(leads, g).map((l) => l.id),
  );
  c(
    "il filtro consulente tiene solo le sue",
    ["d", "a"],
    CG.consulenzeDelGiorno(leads, g, "c1").map((l) => l.id),
  );
  c("nessuna scheda, nessun errore", [], CG.consulenzeDelGiorno(undefined, g));
  const meet = readFileSync(join(radice, "src/crm/MeetGiornalieri.tsx"), "utf8");
  c(
    "l'agenda di «Oggi» usa la stessa funzione (una regola sola)",
    true,
    /consulenzeDelGiorno\(/.test(meet),
  );

  gruppo("PANNELLO OGGI · LE COSE DA FARE (I FILTRI DI PARTENZA DI «DA FARE OGGI»)");
  const ora = new Date("2026-10-30T09:00:00Z"); // 10:00 a Roma
  const adesso = ora.getTime();
  const riga = (id, extra) => ({
    id,
    tipo: "task",
    cosa: id,
    chi: "",
    giorno: g,
    ora: "",
    istante: null,
    fatta: false,
    ...extra,
  });
  const righe = [
    riga("ieri", { giorno: "2026-10-29" }),
    riga("arretrato-lead", {
      tipo: "ricontatto",
      giorno: "2026-10-28",
      lead: lead("x", { consulenteId: "c1" }),
    }),
    riga("domani", { giorno: "2026-10-31" }),
    riga("fatta", { fatta: true }),
    riga("pomeriggio", {
      ora: "16:00",
      istante: new Date("2026-10-30T15:00:00Z").getTime(),
      lead: lead("p", { consulenteId: "c2" }),
    }),
    riga("capita", { lead: lead("q", { consulenteId: "c1" }) }),
  ];
  const mestieri = new Map();
  const tutte = PO.daFareDelPannello({ righe, adesso, oggi: g, chi: "", mestieri });
  c(
    "gruppi nell'ordine della pagina; fuori arretrato dei lead, giorni futuri e righe spuntate",
    [
      ["daIeri", ["ieri"]],
      ["pomeriggio", ["pomeriggio"]],
      ["quandoCapita", ["capita"]],
    ],
    tutte.map((x) => [x.fascia, x.righe.map((r) => r.id)]),
  );
  c(
    "il filtro consulente è la stessa regola della pagina (rigaPassaChi)",
    [["quandoCapita", ["capita"]]],
    PO.daFareDelPannello({ righe, adesso, oggi: g, chi: "c1", mestieri }).map((x) => [
      x.fascia,
      x.righe.map((r) => r.id),
    ]),
  );
  c("quante righe in tutto", 3, PO.contaRighe(tutte));
  c(
    "l'ordine dei mucchi arretrati si può passare da fuori (verso scelto da chi guarda)",
    ["ieri", "ieri"],
    PO.daFareDelPannello({
      righe: [riga("ieri", { giorno: "2026-10-29" })],
      adesso,
      oggi: g,
      chi: "",
      mestieri,
      ordinaArretrati: (r) => [...r, ...r],
    })[0].righe.map((r) => r.id),
  );

  gruppo("PANNELLO OGGI · TOCCARE UNA RIGA APRE LA SUA CHAT");
  const chats = [
    { phone: "39333", lead: lead("a") },
    { phone: "39444", lead: null },
  ];
  c("la chat del lead, se c'è", "39333", PO.chatDelLead(chats, "a")?.phone);
  c("nessuna chat: null (si apre la scheda)", null, PO.chatDelLead(chats, "z"));
  c("id vuoto: null", null, PO.chatDelLead(chats, ""));
  c(
    "nessuna chat abbinata ma stesso numero: si apre quella chat",
    "393401234567",
    PO.chatDelLead([...chats, { phone: "393401234567", lead: null }], "z", "+39 340 123 4567")
      ?.phone,
  );
  c(
    "numero diverso: null (si apre la scheda)",
    null,
    PO.chatDelLead(chats, "z", "+39 340 999 9999"),
  );
  c(
    "«Tutti» mostra anche l'arretrato di mesi fa",
    true,
    PO.daFareDelPannello({
      righe: [riga("vecchia", { giorno: "2026-06-01", tipo: "richiamo" })],
      adesso,
      oggi: g,
      chi: "",
      mestieri,
      periodo: { tipo: "tutti", da: "", a: "" },
    }).some((x) => x.righe.some((r) => r.id === "vecchia")),
  );
  c(
    "«Oggi» invece non la mostra",
    false,
    PO.daFareDelPannello({
      righe: [riga("vecchia", { giorno: "2026-06-01", tipo: "richiamo" })],
      adesso,
      oggi: g,
      chi: "",
      mestieri,
    }).some((x) => x.righe.some((r) => r.id === "vecchia")),
  );

  gruppo("PANNELLO OGGI · LA PAGINA CHAT");
  const pag = readFileSync(join(radice, "src/crm/chatwa/PaginaChat.tsx"), "utf8");
  c("la colonna di destra è il pannello Oggi", true, /<PannelloOggi\b/.test(pag));
  c(
    "il vecchio elenco lead non è più montato dalla pagina (vive dentro il pannello)",
    false,
    /<WhatsAppLeadsPanel\b/.test(pag),
  );
  const pan = readFileSync(join(radice, "src/crm/chatwa/PannelloOggi.tsx"), "utf8");
  c("il pannello Oggi non ha più il tasto «Pagina intera» (richiesta del titolare, 31/10/2026)", false, /Pagina intera/.test(pan));
  c(
    "il pannello riusa i pezzi esistenti: RigaLead, VoceDaFare, WhatsAppLeadsPanel, vistaOggi",
    true,
    /<RigaLead\b/.test(pan) &&
      /<VoceDaFare\b/.test(pan) &&
      /<WhatsAppLeadsPanel\b/.test(pan) &&
      /vistaOggi\(/.test(pan),
  );
  c(
    "nel pannello le righe da fare sono nella variante compatta",
    true,
    /<VoceDaFare[\s\S]{0,600}\bcompatta\b/.test(pan),
  );
  const dafare = readFileSync(join(radice, "src/routes/CRM.dafare.tsx"), "utf8");
  c(
    "la pagina «Da fare oggi» non usa la variante compatta (resta identica)",
    false,
    /\bcompatta\b/.test(dafare),
  );
}
