/** ── PROVE: «NO SHOW» E «DA SPOSTARE» NELLA BARRA DEL MEET (31/10/2026) ──────
 *  Regole pure in src/crm/chatwa/azioni-meet.ts; i pulsanti in AzioniMeet.tsx; il contenitore sticky
 *  comune (barra + pulsanti) in ElencoChat.tsx. Il disegno si prova sul sorgente e, a schermo, con il
 *  banco (strumenti/banco-chat/azioni.html). Il cambio di stato è `cambiaStatoLead`, non una copia.
 *  Il «dopo il cambio passa il successivo» si prova col vero `prossimoMeet` sulla lista aggiornata.
 *  Il «toast Annulla ferma il messaggio» si prova col vero `decidiPerStato` del giro.
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveAzioniMeet(mod, { c, gruppo, radice }) {
  const A = mod["chatwa/azioni-meet"];
  const P = mod["chatwa/prossimo-meet"];
  const S = mod["manychat/stati"];
  const SD = mod["stato-dal"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  const ADESSO = new Date("2026-10-31T10:00:00+01:00");
  const OGGI = "2026-10-31";
  const dati = (o = {}) => ({
    nome: "Giulia",
    cognome: "Verdi",
    stato: "appuntamento_fissato",
    consulenteId: "m",
    dataMeeting: OGGI,
    oraMeeting: "15:00",
    ...o,
  });

  gruppo("AZIONI MEET · I DUE STATI E LA FRASE DI CONFERMA");
  c(
    "due azioni, nell'ordine: «No show» (Cliente assente) e «Da spostare» (Da riprogrammare)",
    [
      ["no_show", "No show"],
      ["da_spostare", "Da spostare"],
    ],
    A.AZIONI_MEET.map((x) => [x.stato, x.etichetta]),
  );
  c("si richiude da sola dopo 8 secondi", 8000, A.CHIUSURA_MS);

  const noShow = A.fraseConferma("no_show", dati(), OGGI, ADESSO);
  c(
    "no_show: dice lo stato e il nome",
    true,
    /Giulia/.test(noShow) && /«Cliente assente»/.test(noShow),
  );
  c(
    "no_show: il messaggio «può partire», non prima dei minuti della tabella, se l'invio è acceso",
    [true, true, true],
    [
      /può partire/.test(noShow),
      /non prima di 30 minuti/.test(noShow),
      /se l'invio automatico è acceso/i.test(noShow),
    ],
  );
  c(
    "i minuti della frase sono quelli della tabella dei messaggi (stati.ts), non copiati",
    [30, 30],
    [S.TABELLA_STATI.no_show.attesaMin, S.TABELLA_STATI.da_spostare.attesaMin],
  );
  c(
    "nessuna promessa: mai «partirà», «riceverà», «manderemo»",
    false,
    /partirà|riceverà|manderemo|parte\b/i.test(noShow),
  );

  const rip = A.fraseConferma("da_spostare", dati(), OGGI, ADESSO);
  c(
    "da_spostare: dice lo stato e il nome",
    true,
    /Giulia/.test(rip) && /«Da riprogrammare»/.test(rip),
  );
  c(
    "da_spostare senza data di ricontatto: a evento, non prima di 30 minuti",
    [true, false],
    [/non prima di 30 minuti/.test(rip), /ricontatto/.test(rip)],
  );
  c("le due frasi sono diverse", true, noShow !== rip && !/Cliente assente/.test(rip));

  //  Con una data di ricontatto da oggi in poi «Da riprogrammare» è A DATA (giornoADataDi): la frase lo dice.
  const conData = A.fraseConferma(
    "da_spostare",
    dati({ dataRicontatto: "2026-11-05" }),
    OGGI,
    ADESSO,
  );
  c(
    "da_spostare con ricontatto già fissato: parla del giorno, non dei 30 minuti",
    [true, false],
    [/giovedì 5 novembre/.test(conData), /30 minuti/.test(conData)],
  );
  const vecchia = A.fraseConferma(
    "da_spostare",
    dati({ dataRicontatto: "2026-10-20" }),
    OGGI,
    ADESSO,
  );
  c(
    "data di ricontatto già passata: conta come senza data (a evento)",
    true,
    /non prima di 30 minuti/.test(vecchia),
  );
  c(
    "la frase segue la regola del giro: stessa risposta di giornoADataDi sul dato dopo il cambio",
    [null, "2026-11-05"],
    [
      mod["manychat/quando"].giornoADataDi(
        { ...dati({ dataRicontatto: "2026-10-20" }), statoDal: ADESSO.toISOString() },
        OGGI,
      ),
      mod["manychat/quando"].giornoADataDi(
        { ...dati({ dataRicontatto: "2026-11-05" }), statoDal: ADESSO.toISOString() },
        OGGI,
      ),
    ],
  );

  c(
    "nome vuoto: «il cliente»",
    true,
    /il cliente/.test(A.fraseConferma("no_show", dati({ nome: "  " }), OGGI, ADESSO)),
  );
  c(
    "nome mancante: «il cliente»",
    true,
    /il cliente/.test(A.fraseConferma("da_spostare", dati({ nome: undefined }), OGGI, ADESSO)),
  );
  const senzaCons = A.fraseConferma("no_show", dati({ consulenteId: null }), OGGI, ADESSO);
  c(
    "senza consulente il messaggio automatico non c'è (chi: consulente): nessuna promessa, solo lo stato",
    [false, true],
    [/messaggio|invio/i.test(senzaCons), /«Cliente assente»/.test(senzaCons)],
  );
  c(
    "stato che non è una delle due azioni: nessuna frase",
    "",
    A.fraseConferma("venduto", dati(), OGGI, ADESSO),
  );

  gruppo("AZIONI MEET · DOPO IL CAMBIO PASSA IL MEET SUCCESSIVO");
  let n = 0;
  const chat = (ora, stato = "appuntamento_fissato") => {
    n++;
    return {
      phone: `+39333222${String(n).padStart(4, "0")}`,
      lead: { id: `l${n}`, data: dati({ oraMeeting: ora, stato }) },
    };
  };
  const alle = (hhmm) => Date.parse(`${OGGI}T${hhmm}:00+01:00`);
  const consulenti = [{ id: "m", data: { nome: "Mirko Rossi" } }];
  const c15 = chat("15:00");
  const c17 = chat("17:00");
  const prima = P.prossimoMeet([c17, c15], OGGI, alle("09:00"), consulenti);
  c("prima del cambio: il meet delle 15:00", c15.phone, prima?.chat.phone);
  //  Quello che fa `updateLead`: la lista cambia, la barra si ricalcola SU QUELLA, non sul vecchio `meet`.
  const aggiorna = (lista, chatDaCambiare, stato) =>
    lista.map((x) =>
      x === chatDaCambiare ? { ...x, lead: { ...x.lead, data: { ...x.lead.data, stato } } } : x,
    );
  const dopoNoShow = aggiorna([c17, c15], c15, "no_show");
  c(
    "dopo «No show» sul primo: la barra mostra il meet delle 17:00",
    c17.phone,
    P.prossimoMeet(dopoNoShow, OGGI, alle("09:00"), consulenti)?.chat.phone,
  );
  const dopoSposta = aggiorna([c17, c15], c15, "da_spostare");
  c(
    "dopo «Da spostare» sul primo: idem",
    c17.phone,
    P.prossimoMeet(dopoSposta, OGGI, alle("09:00"), consulenti)?.chat.phone,
  );
  c(
    "l'ultimo meet del giorno: dopo il cambio la barra sparisce",
    null,
    P.prossimoMeet(aggiorna([c15], c15, "no_show"), OGGI, alle("09:00"), consulenti),
  );
  c(
    "con il filtro per consulente: passa al prossimo DI QUEL consulente, non a quello di un altro",
    null,
    P.prossimoMeet(
      aggiorna(
        [c15, { ...c17, lead: { ...c17.lead, data: { ...c17.lead.data, consulenteId: "f" } } }],
        c15,
        "no_show",
      ),
      OGGI,
      alle("09:00"),
      consulenti,
      "m",
    ),
  );

  gruppo("AZIONI MEET · IL TOAST «ANNULLA» FERMA DAVVERO IL MESSAGGIO");
  //  Il giro rilegge la scheda e rifà la decisione prima di inviare (giro.ts, `ancora`): vale lo stato ATTUALE.
  const FRASE = "2026-10-20T00:00:00.000Z";
  const ACCESO = "2026-10-20T06:00:00.000Z";
  const consulentiGiro = [
    { id: "m", data: { nome: "Mirko", attivo: true, mestieri: { faConsulente: true } } },
  ];
  const okWa = { si: true, il: "2026-10-01T09:00:00.000Z", da: "Demo" };
  const ctx = {
    consulenti: consulentiGiro,
    invii: [],
    tetti: { ricontatti: 20, leadNuovi: 30, totale: 100 },
    fraseModuloDal: FRASE,
    statiAccesi: Object.fromEntries(Object.keys(S.TABELLA_STATI).map((s) => [s, ACCESO])),
    indirizzoSede: "Via Esempio 1, Roma",
    prossimoDopo: null,
  };
  const quando = (min) => new Date(ADESSO.getTime() + min * 60_000);
  const scheda = (d) => ({
    id: "s1",
    data: { nome: "Giulia", telefono: "3331234567", consulenteId: "m", okWhatsapp: okWa, ...d },
  });
  for (const stato of ["no_show", "da_spostare"]) {
    const cambiato = scheda({ stato, statoDal: ADESSO.toISOString() });
    c(
      `${stato}: 10 minuti dopo il cambio il giro aspetta`,
      "aspetta",
      S.decidiPerStato([cambiato], quando(10), ctx)[0]?.tipo,
    );
    c(
      `${stato}: 35 minuti dopo, se nessuno lo ferma, parte (la prova distingue)`,
      "invia",
      S.decidiPerStato([cambiato], quando(35), ctx)[0]?.tipo,
    );
    //  «Annulla» di cambiaStatoLead: `updateLead(id, prima, { annulla: true })` → statoDalDopo.
    const prima = { stato: "appuntamento_fissato", statoDal: "2026-10-30T09:00:00.000Z" };
    const annullata = SD.statoDalDopo(
      cambiato.data,
      { ...cambiato.data, ...prima },
      quando(1),
      true,
      prima.statoDal,
    );
    c(
      `${stato}: dopo «Annulla» torna lo stato e il suo statoDal di prima`,
      [prima.stato, prima.statoDal],
      [annullata.stato, annullata.statoDal],
    );
    c(
      `${stato}: dopo «Annulla» il giro non ha più niente da inviare, nemmeno dopo 35 minuti`,
      [],
      S.decidiPerStato([scheda(annullata)], quando(35), ctx),
    );
  }
  const giro = leggi("src/crm/manychat/giro.ts");
  c(
    "il giro rilegge la scheda prima di inviare e annulla la riga se non è più «invia»",
    true,
    /const ancora = async/.test(giro) && /"scheda_cambiata"/.test(giro),
  );
  const useChat = senzaCommenti(leggi("src/crm/chatwa/useChatWa.ts"));
  c(
    "«Annulla» di cambiaStatoLead passa `annulla: true` (senza rinnovare statoDal)",
    true,
    /updateLead\(lead\.id, prima, \{ annulla: true \}\)/.test(useChat),
  );

  gruppo("AZIONI MEET · IL SORGENTE");
  const barra = leggi("src/crm/chatwa/BarraProssimoMeet.tsx");
  c(
    "BarraProssimoMeet non conosce AzioniMeet (resta com'è)",
    false,
    /AzioniMeet|azioni-meet/.test(barra),
  );
  const comp = leggi("src/crm/chatwa/AzioniMeet.tsx");
  const compC = senzaCommenti(comp);
  c(
    "il cambio di stato arriva da fuori (onCambiaStato): AzioniMeet non scrive la scheda",
    false,
    /updateLead|useCRM|supabase/.test(compC),
  );
  //  «Da riprogrammare» è un ESITO, non una voce del menu stato: filtrarlo con `statiSelezionabili` lo nasconderebbe sempre.
  const TY = mod["types"];
  c(
    "il menu stato di un meet fissato ha «Cliente assente» ma NON «Da riprogrammare» (è un esito): non si filtra con statiSelezionabili",
    [true, false, false],
    [
      TY.statiPer(dati()).includes("no_show"),
      TY.statiPer(dati()).includes("da_spostare"),
      /statiSelezionabili/.test(compC),
    ],
  );
  const ui = leggi("src/crm/ui.tsx");
  c(
    "i due stati sono gli ESITI assegnabili dei pulsanti dell'agenda (crm/ui), stesso gesto, stesso permesso",
    [true, true],
    ["no_show", "da_spostare"].map((st) =>
      new RegExp(
        `stato: "${st}",\\s*sigla: "[A-Z]+",\\s*breve: "[^"]+",\\s*(?:nome: "[^"]+",\\s*)?assegnabile: true`,
      ).test(ui),
    ),
  );
  c("senza scheda: niente", true, /!lead\) return null/.test(compC));
  c(
    "in volo i pulsanti sono fermi e il blocco si toglie in `finally`",
    [true, true, true],
    [/aria-busy/.test(compC), /disabled=\{/.test(compC), /finally \{/.test(compC)],
  );
  c(
    "la conferma è un gruppo con nome, e Esc la chiude",
    [true, true],
    [/role="group"/.test(compC), /"Escape"/.test(compC)],
  );
  c(
    "Annulla è preselezionato (il focus va lì) e dopo CHIUSURA_MS si richiude",
    [true, true],
    [/annullaRef\.current\?\.focus\(\)/.test(compC), /setTimeout\([^)]*CHIUSURA_MS/.test(compC)],
  );
  c(
    "tasti da 44 px (min-h-11) su tutta la larghezza (flex-1); i due stili derivano dalla stessa base",
    [true, true, true],
    [
      /const TASTO =\s*"[^"]*min-h-11[^"]*flex-1/.test(compC),
      /TASTO_CONTORNO = `\$\{TASTO\}/.test(compC),
      /TASTO_PIENO = `\$\{TASTO\}/.test(compC),
    ],
  );
  c(
    "la frase è la descrizione del gruppo: i lettori di schermo la leggono entrando",
    true,
    /aria-describedby=\{idFrase\}/.test(compC) && /id=\{idFrase\}/.test(compC),
  );
  c("niente emoji", false, /\p{Extended_Pictographic}/u.test(compC));
  c(
    "toni della barra (viola), non un colore nuovo",
    true,
    /violet-/.test(compC) && !/(emerald|amber|rose|red)-\d/.test(compC),
  );

  const elenco = leggi("src/crm/chatwa/ElencoChat.tsx");
  const bloccoMeet =
    /<div[^>]*sticky top-0 z-10[^>]*>\s*<BarraProssimoMeet[\s\S]*?<AzioniMeet[\s\S]*?<\/div>/.exec(
      elenco,
    )?.[0] ?? "";
  c(
    "barra e pulsanti stanno nello stesso contenitore sticky (scorrono insieme)",
    true,
    bloccoMeet.length > 0,
  );
  c(
    "AzioniMeet riceve il meet e `cambiaStatoLead` (che restituisce la promessa), con `key` sulla chat",
    [true, true, true],
    [
      /meet=\{meet\}/.test(bloccoMeet),
      /onCambiaStato=\{cambiaStatoLead\}/.test(bloccoMeet),
      /key=\{meet\.chat\.phone\}/.test(bloccoMeet),
    ],
  );
  c(
    "la barra c'è solo a caricamento finito e con un meet",
    true,
    /!caricamento && meet && \(\s*<div/.test(elenco),
  );
}
