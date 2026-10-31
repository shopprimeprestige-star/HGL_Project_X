/** ── PROVE: BADGE «DA QUANTO NON GLI SCRIVIAMO» E ICONA WHATSAPP NELLA RIGA (31/10/2026) ──
 *  Regole in src/crm/chatwa/attesaPosa.ts; il disegno è in RigaChat.tsx e si prova sul sorgente
 *  (il resto si guarda nel browser: strumenti/banco-chat). Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveRigaAttesaWame(mod, { c, gruppo, radice }) {
  const B = mod["chatwa/attesaPosa"];
  const S = mod["chatwa/stato"];
  const K = mod["chatwa/costruisciChat"];
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");

  const adesso = Date.UTC(2026, 9, 31, 12, 0);
  const fa = (ore) => new Date(adesso - ore * 3_600_000).toISOString();
  const lead = (extra = {}) => ({
    id: "L1",
    data: {
      nome: "Prova",
      cognome: "Finta",
      stato: "posa_in_sede",
      payment: { accontoPagato: 200 },
      ...extra,
    },
  });
  const msg = (direction, ore, extra = {}) => ({
    direction,
    body: "x",
    created_at: fa(ore),
    status: "sent",
    ...extra,
  });
  const chat = (o = {}) => ({
    lead: lead(),
    lastMessage: null,
    contact: null,
    ultimoNostroIl: null,
    ...o,
  });

  gruppo("BADGE ATTESA POSA: ULTIMO MESSAGGIO NOSTRO");
  c(
    "max dei messaggi in uscita",
    fa(5),
    S.ultimoNostroIl([msg("outbound", 50), msg("inbound", 1), msg("outbound", 5)]),
  );
  c(
    "un'uscita non partita non conta",
    fa(50),
    S.ultimoNostroIl([msg("outbound", 50), msg("outbound", 2, { status: "failed" })]),
  );
  c("solo messaggi del cliente: nessuna uscita", null, S.ultimoNostroIl([msg("inbound", 3)]));
  c("nessun messaggio: nessuna uscita", null, S.ultimoNostroIl([]));
  c(
    "data illeggibile ignorata",
    fa(7),
    S.ultimoNostroIl([
      msg("outbound", 7),
      { direction: "outbound", created_at: "boh", status: "sent" },
    ]),
  );

  gruppo("BADGE ATTESA POSA: CHI LO HA");
  c(
    "senza scheda: niente",
    null,
    B.badgeAttesaPosa(chat({ lead: null, lastMessage: msg("outbound", 30) }), adesso),
  );
  c(
    "trattativa senza acconto: niente",
    null,
    B.badgeAttesaPosa(
      chat({ lead: lead({ payment: {} }), lastMessage: msg("outbound", 30) }),
      adesso,
    ),
  );
  c(
    "posa già fatta: niente",
    null,
    B.badgeAttesaPosa(
      chat({
        lead: lead({ installazione: { completataIl: "2026-10-20" } }),
        lastMessage: msg("outbound", 30),
      }),
      adesso,
    ),
  );
  c(
    "pratica persa: niente",
    null,
    B.badgeAttesaPosa(
      chat({ lead: lead({ stato: "annullato" }), lastMessage: msg("outbound", 30) }),
      adesso,
    ),
  );
  c(
    "stessa regola del blocco «da installare»: ogni scheda che il blocco accetta ha il badge",
    true,
    [lead(), lead({ payment: {}, installazione: { priorita: true } })].every(
      (l) =>
        mod["chatwa/accontiInCima"].daInstallare(l) ===
        !!B.badgeAttesaPosa(chat({ lead: l, lastMessage: msg("outbound", 30) }), adesso),
    ),
  );
  c("niente da cui contare: niente", null, B.badgeAttesaPosa(chat(), adesso));

  gruppo("BADGE ATTESA POSA: TESTO CORTO E COLORE");
  const b = (ore) => B.badgeAttesaPosa(chat({ lastMessage: msg("outbound", ore) }), adesso);
  c("25 minuti: «25 min», neutro", ["25 min", "neutro"], [b(25 / 60).testo, b(25 / 60).livello]);
  c("3 ore: «3 h», neutro", ["3 h", "neutro"], [b(3).testo, b(3).livello]);
  c("2 giorni e 23 ore: «2 g», ancora neutro", ["2 g", "neutro"], [b(71).testo, b(71).livello]);
  c("3 giorni: «3 g», ambra", ["3 g", "ambra"], [b(72).testo, b(72).livello]);
  c("7 giorni e 23 ore: «7 g», ambra", ["7 g", "ambra"], [b(191).testo, b(191).livello]);
  c("8 giorni: «8 g», rosso", ["8 g", "rosso"], [b(192).testo, b(192).livello]);
  c("10 giorni: «10 g», rosso", ["10 g", "rosso"], [b(240).testo, b(240).livello]);
  c(
    "meno di un minuto: «<1 min»",
    "<1 min",
    B.badgeAttesaPosa(chat({ lastMessage: msg("outbound", 0.001) }), adesso).testo,
  );
  c(
    "il titolo lo dice per esteso, con la durata della funzione di sempre",
    "Non gli scrivi da 10 giorni",
    b(240).titolo,
  );

  gruppo("BADGE ATTESA POSA: DA DOVE SI CONTA");
  c(
    "l'ultimo è del cliente, ma una nostra uscita più vecchia c'è: conta quella",
    "5 g",
    B.badgeAttesaPosa(chat({ lastMessage: msg("inbound", 1), ultimoNostroIl: fa(120) }), adesso)
      .testo,
  );
  c(
    "il più recente fra uscita letta e uscita salvata",
    "2 g",
    B.badgeAttesaPosa(chat({ lastMessage: msg("outbound", 48), ultimoNostroIl: fa(120) }), adesso)
      .testo,
  );
  c(
    "chat vecchia (nessun messaggio letto): l'ultimo messaggio del contatto, se è nostro",
    "4 g",
    B.badgeAttesaPosa(
      chat({ contact: { ultimo_messaggio_il: fa(96), ultimo_messaggio_direzione: "outbound" } }),
      adesso,
    ).testo,
  );
  c(
    "ultimo messaggio letto non partito: si conta dalla uscita buona",
    "5 g",
    B.badgeAttesaPosa(
      chat({ lastMessage: msg("outbound", 2, { status: "failed" }), ultimoNostroIl: fa(120) }),
      adesso,
    ).testo,
  );
  const soloSuo = B.badgeAttesaPosa(chat({ lastMessage: msg("inbound", 30) }), adesso);
  c("nessuna uscita mai: dall'ultimo messaggio della chat", "1 g", soloSuo.testo);
  c("…e il titolo lo dice", true, /Nessun messaggio nostro/.test(soloSuo.titolo));
  c(
    "solo il contatto, con l'ultimo del cliente: dall'ultimo messaggio",
    "6 g",
    B.badgeAttesaPosa(
      chat({ contact: { ultimo_messaggio_il: fa(144), ultimo_messaggio_direzione: "inbound" } }),
      adesso,
    ).testo,
  );

  gruppo("BADGE ATTESA POSA: IL DATO ARRIVA SENZA LETTURE NUOVE");
  const t = (h) => fa(h);
  const contatto = {
    id: "c1",
    user_id: "u",
    phone_e164: "+393330000001",
    lead_id: "L1",
    display_name: null,
    last_message_at: t(1),
    unread_count: 0,
    created_at: t(900),
    updated_at: t(1),
    ultimo_messaggio_il: t(1),
    ultimo_messaggio_anteprima: "ok",
    ultimo_messaggio_direzione: "inbound",
  };
  const riga = (id, direction, ore, extra = {}) => ({
    id,
    user_id: "u",
    lead_id: "L1",
    direction,
    from_number: direction === "inbound" ? "+393330000001" : "manychat",
    to_number: direction === "inbound" ? "manychat" : "+393330000001",
    body: "x",
    status: "sent",
    wa_message_id: null,
    error_message: null,
    created_at: t(ore),
    delivered_at: null,
    read_at: null,
    ...extra,
  });
  const out = K.costruisciChat({
    tutti: [
      riga("a", "outbound", 100),
      riga("b", "inbound", 1),
      riga("c", "outbound", 3, { status: "failed" }),
    ],
    contacts: [contatto],
    leads: [{ id: "L1", user_id: "u", created_at: t(999), updated_at: t(999), data: lead().data }],
    adesso,
    ottimistici: {},
  });
  c(
    "costruisciChat porta l'ultima uscita partita sulla chat (dai messaggi già letti)",
    t(100),
    out[0].ultimoNostroIl,
  );
  const senza = K.costruisciChat({
    tutti: [riga("b", "inbound", 1)],
    contacts: [contatto],
    leads: [],
    adesso,
    ottimistici: {},
  });
  c("senza uscite nei messaggi letti: null", null, senza[0].ultimoNostroIl);
  c("il badge si calcola dalla chat costruita", "4 g", B.badgeAttesaPosa(out[0], adesso).testo);

  gruppo("RIGA: BADGE E ICONA WHATSAPP (sorgente)");
  const riga_ = senzaCommenti(leggi("src/crm/chatwa/RigaChat.tsx"));
  c(
    "la riga calcola il badge con la funzione pura e lo mostra con la clessidra",
    true,
    /badgeAttesaPosa\(c, adesso\)/.test(riga_) &&
      /\{attesaPosa && \(/.test(riga_) &&
      /<Hourglass/.test(riga_),
  );
  c(
    "i tre colori: neutro, ambra, rosso",
    true,
    /neutro:/.test(riga_) && /ambra:/.test(riga_) && /rosso:/.test(riga_),
  );
  c(
    "l'icona WhatsApp in alto a destra: solo a finestra chiusa, col link di sempre",
    true,
    /finestra && !finestra\.aperta && apriWa/.test(riga_) &&
      /href=\{apriWa\}/.test(riga_) &&
      /<IconaWhatsApp/.test(riga_),
  );
  const tasto = riga_.slice(
    riga_.indexOf("href={apriWa}") - 400,
    riga_.indexOf("href={apriWa}") + 900,
  );
  c("tocco da 44 px sul telefono", true, /h-11 w-11/.test(tasto));
  c("non apre la chat: ferma la propagazione", true, /e\.stopPropagation\(\)/.test(tasto));
  c("in selezione non si tocca (inert)", true, /inert=\{selezione\?\.attiva\}/.test(tasto));
  c(
    "nome accessibile con il nome del cliente",
    true,
    /aria-label=\{`Apri \$\{nome\} su WhatsApp`\}/.test(tasto),
  );
  c(
    "l'icona piccola accanto a «Finestra chiusa» non c'è più (una sola icona per lo stesso gesto)",
    true,
    (riga_.match(/<IconaWhatsApp/g) ?? []).length === 1,
  );
  c("niente più posto invisibile riservato al vecchio link", false, /invisible/.test(riga_));
}
