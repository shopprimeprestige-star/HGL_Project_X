/** ── PROVE: «LA PALLA È AL CLIENTE» (30/10/2026) ───────────────────────────
 *  Da «Attesa WhatsApp» a «Da chiamare»: l'ultimo messaggio è NOSTRO (da
 *  qualunque canale) da almeno 10 ore, il cliente non ha scritto dopo, le eco
 *  non sono risposte, niente STOP. Dati inventati (solo orari e numeri finti). */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function proveAttesaPalla(mod, { c, gruppo, radice }) {
  gruppo("DA CHIAMARE: LA PALLA È AL CLIENTE (ultimo messaggio nostro da 10 ore)");
  const D = mod["chatwa/daChiamare"];
  const A = mod["importa/attesa-da-chiamare"];
  const adesso = new Date("2026-10-30T11:45:00Z");
  const NUM = "393330000001";
  const dati = {
    stato: "attesa_whatsapp",
    statoPrecedenteIl: "2026-10-28T08:11:01Z",
    statoDal: "2026-10-28T08:11:01Z",
  };
  const nostro = (created_at, canale, body, extra = {}) => ({
    direction: "outbound",
    created_at,
    canale,
    body,
    from_number: "manychat",
    to_number: NUM,
    ...extra,
  });
  const suo = (created_at, canale, body, extra = {}) => ({
    direction: "inbound",
    created_at,
    canale,
    body,
    from_number: NUM,
    to_number: "manychat",
    ...extra,
  });
  const si = (p) => D.calcolaDaChiamare({ dati, adesso, ...p }).si;

  //  Il caso del titolare: modello il 28/10, risposta la sera, lui scrive dal telefono il 29/10, poi l'eco.
  const caso = [
    nostro("2026-10-28T08:11:01Z", "manychat", "Ciao, ti scrivo da Hair Genius Labs"),
    suo("2026-10-28T22:01:00Z", "baileys", "Sì, va bene"),
    suo("2026-10-28T22:01:01Z", "manychat", "Sì, va bene", { duplicato_di: "id-del-pari" }),
    nostro("2026-10-29T09:03:45Z", "baileys", "Ti chiamo domani mattina, ok?"),
    suo("2026-10-29T09:03:48Z", "manychat", "Ti chiamo domani mattina, ok?"),
  ];
  const rubrica = "2026-10-29T09:03:48Z";
  const r = D.calcolaDaChiamare({ dati, messaggi: caso, ultimaEntrataIl: rubrica, adesso });
  c("il caso vero (eco dopo il messaggio dal telefono, rubrica dell'eco): da chiamare", true, r.si);
  c(
    "…l'attesa comincia dal nostro ultimo messaggio, non dall'ingresso nello stato",
    Date.parse("2026-10-29T09:03:45Z"),
    Date.parse(r.dal),
  );
  const p = A.patchDaChiamare({ ...dati, note: "x" }, { ultimoInEntrataIl: rubrica }, adesso, caso);
  c(
    "…e il cron scrive solo lo stato e la sua storia",
    {
      stato: "da_chiamare",
      statoPrecedente: "attesa_whatsapp",
      statoPrecedenteIl: adesso.toISOString(),
      statoDal: adesso.toISOString(),
    },
    p,
  );
  c(
    "senza i messaggi, la regola di prima: l'eco della rubrica lo teneva in attesa",
    null,
    A.patchDaChiamare(dati, { ultimoInEntrataIl: rubrica }, adesso),
  );
  c(
    "l'eco e il suo pari non cambiano l'ordine delle righe",
    true,
    si({ messaggi: [...caso].reverse(), ultimaEntrataIl: rubrica }),
  );

  gruppo("DA CHIAMARE: CHI RISPONDE PER ULTIMO RESTA IN ATTESA");
  const risposta = suo("2026-10-29T12:00:00Z", "manychat", "Mi richiami nel pomeriggio?");
  c(
    "il cliente ha risposto dopo il nostro messaggio: resta",
    false,
    si({ messaggi: [...caso, risposta], ultimaEntrataIl: rubrica }),
  );
  c(
    "…anche se la risposta arriva dal ponte (canale baileys)",
    false,
    si({ messaggi: [...caso, { ...risposta, canale: "baileys" }] }),
  );
  c(
    "…anche se la risposta arriva dal canale diretto (Cloud API)",
    false,
    si({ messaggi: [...caso, { ...risposta, canale: null }] }),
  );
  c(
    "…o la dice solo la rubrica",
    false,
    si({ messaggi: caso, ultimaEntrataIl: "2026-10-29T12:00:00Z" }),
  );
  c(
    "la sua risposta resta anche col cron",
    null,
    A.patchDaChiamare(dati, { ultimoInEntrataIl: "2026-10-29T12:00:00Z" }, adesso, [
      ...caso,
      risposta,
    ]),
  );
  c(
    "la rubrica è più vecchia del nostro ultimo messaggio: l'ultimo è nostro, sì",
    true,
    si({ messaggi: caso.slice(0, 4), ultimaEntrataIl: "2026-10-28T22:01:00Z" }),
  );

  gruppo("DA CHIAMARE: SENZA FINESTRA APERTA, 24 ORE DAL NOSTRO ULTIMO MESSAGGIO");
  const fa = (ore) => new Date(adesso.getTime() - ore * 3600_000).toISOString();
  const unoNostro = (ore) => [nostro(fa(ore), "baileys", "Ci sentiamo?")];
  c("nostro messaggio di 23 ore fa (finestra mai aperta): ancora no", false, si({ messaggi: unoNostro(23) }));
  c("…di 24 ore: sì", true, si({ messaggi: unoNostro(24) }));
  c("…di 24 ore e 1 minuto: sì", true, si({ messaggi: unoNostro(24 + 1 / 60) }));
  c(
    "nostro messaggio recente, ingresso nello stato vecchio: no (conta il più recente)",
    false,
    si({ messaggi: unoNostro(2) }),
  );
  c(
    "ingresso nello stato recente, nostro messaggio vecchio: no (conta il più recente)",
    false,
    D.calcolaDaChiamare({
      dati: { stato: "attesa_whatsapp", statoPrecedenteIl: fa(3) },
      messaggi: unoNostro(20),
      adesso,
    }).si,
  );
  c(
    "un nostro messaggio dal ponte conta come nostro",
    true,
    si({ messaggi: [nostro(fa(25), "baileys", "da telefono")] }),
  );
  c(
    "un nostro messaggio Cloud API conta come nostro",
    true,
    si({ messaggi: [nostro(fa(25), null, "cloud")] }),
  );
  c(
    "un nostro messaggio doppione (duplicato_di) non conta: vale l'ingresso nello stato",
    { si: true, dal: "2026-10-28T08:11:01Z" },
    D.calcolaDaChiamare({
      dati,
      messaggi: [nostro(fa(1), "baileys", "doppione", { duplicato_di: "x" })],
      adesso,
    }),
  );
  c(
    "un suo messaggio doppione non conta come risposta",
    true,
    si({
      messaggi: [
        nostro(fa(25), "manychat", "ciao"),
        suo(fa(5), "baileys", "ok", { duplicato_di: "x" }),
      ],
    }),
  );
  c(
    "lo stato è un altro (richiamo): non c'è attesa",
    false,
    D.calcolaDaChiamare({
      dati: { stato: "richiamo", statoPrecedenteIl: fa(30) },
      messaggi: unoNostro(20),
      adesso,
    }).si,
  );
  c(
    "senza data d'ingresso non si inventa",
    false,
    D.calcolaDaChiamare({ dati: { stato: "attesa_whatsapp" }, messaggi: unoNostro(20), adesso }).si,
  );

  gruppo("DA CHIAMARE: LE ECO NON SONO RISPOSTE, UNA RISPOSTA VERA SÌ");
  const out = nostro("2026-10-29T09:03:45Z", "baileys", "Ti chiamo domani");
  const eco = (secondi, extra = {}) =>
    suo(
      new Date(Date.parse("2026-10-29T09:03:45Z") + secondi * 1000).toISOString(),
      "manychat",
      "Ti chiamo domani",
      extra,
    );
  c("eco 3 secondi dopo: ignorata", true, si({ messaggi: [out, eco(3)] }));
  c(
    "eco col testo scritto diversamente (maiuscole, spazi): ignorata",
    true,
    si({ messaggi: [out, eco(3, { body: "  ti chiamo   DOMANI " })] }),
  );
  c("eco esattamente a 60 secondi: ignorata", true, si({ messaggi: [out, eco(60)] }));
  c("stesso testo ma 2 minuti dopo: non è un'eco, è lui", false, si({ messaggi: [out, eco(120)] }));
  c(
    "testo diverso 3 secondi dopo: è lui",
    false,
    si({ messaggi: [out, eco(3, { body: "Va bene, grazie" })] }),
  );
  c(
    "eco + risposta vera 2 minuti dopo con testo diverso: la risposta conta",
    false,
    si({ messaggi: [out, eco(3), eco(120, { body: "Meglio alle 15" })] }),
  );
  c(
    "stesso testo arrivato PRIMA del nostro messaggio: non è un'eco, ma l'ultimo resta nostro",
    true,
    si({ messaggi: [out, eco(-3)] }),
  );
  c(
    "stesso testo di un altro numero: non è un'eco",
    false,
    si({ messaggi: [out, eco(3, { from_number: "393339999999" })] }),
  );
  c(
    "stesso testo dal ponte (non ManyChat): non è un'eco",
    false,
    si({ messaggi: [out, eco(3, { canale: "baileys" })] }),
  );
  c(
    "riga senza testo: non si può dire che sia un'eco",
    false,
    si({ messaggi: [out, eco(3, { body: null })] }),
  );
  const tOut = Date.parse("2026-10-29T09:03:45Z");
  c(
    "rubrica uguale all'eco (entro 60 s): non vale",
    true,
    si({ messaggi: [out, eco(3)], ultimaEntrataIl: "2026-10-29T09:03:48Z" }),
  );
  c(
    "rubrica a 40 secondi dall'eco: non vale",
    true,
    si({ messaggi: [out, eco(3)], ultimaEntrataIl: new Date(tOut + 43_000).toISOString() }),
  );
  c(
    "rubrica 2 minuti dopo l'eco: vale",
    false,
    si({
      messaggi: [out, eco(3)],
      ultimaEntrataIl: new Date(tOut + 3_000 + 120_000).toISOString(),
    }),
  );
  c(
    "rubrica senza nessuna eco nei messaggi (messaggi non caricati): vale",
    false,
    si({ messaggi: [], ultimaEntrataIl: "2026-10-29T09:03:48Z" }),
  );
  c(
    "la rubrica dopo il nostro messaggio, senza eco: vale",
    false,
    si({ messaggi: [out], ultimaEntrataIl: "2026-10-29T10:00:00Z" }),
  );

  gruppo("DA CHIAMARE: STOP E NIENTE MESSAGGI");
  c("STOP sul numero: no", false, si({ messaggi: caso, ultimaEntrataIl: rubrica, stop: true }));
  c(
    "STOP anche col cron",
    null,
    A.patchDaChiamare(dati, { ultimoInEntrataIl: rubrica, stop: true }, adesso, caso),
  );
  c(
    "nessun messaggio, attesa da 25 ore: sì",
    true,
    D.calcolaDaChiamare({
      dati: { stato: "attesa_whatsapp", statoPrecedenteIl: fa(25) },
      messaggi: [],
      adesso,
    }).si,
  );
  c(
    "nessun messaggio, attesa da 9 ore: no",
    false,
    D.calcolaDaChiamare({
      dati: { stato: "attesa_whatsapp", statoPrecedenteIl: fa(9) },
      messaggi: [],
      adesso,
    }).si,
  );
  c(
    "nessun messaggio, la rubrica dice che ha scritto dopo l'ingresso: no",
    false,
    D.calcolaDaChiamare({
      dati: { stato: "attesa_whatsapp", statoPrecedenteIl: fa(30) },
      messaggi: [],
      ultimaEntrataIl: fa(20),
      adesso,
    }).si,
  );
  c(
    "nessun messaggio, aveva scritto prima dell'ingresso: sì",
    true,
    D.calcolaDaChiamare({
      dati: { stato: "attesa_whatsapp", statoPrecedenteIl: fa(30) },
      messaggi: [],
      ultimaEntrataIl: fa(40),
      adesso,
    }).si,
  );
  c(
    "solo messaggi suoi di prima dell'ingresso (nessuno nostro): come prima, sì",
    true,
    D.calcolaDaChiamare({
      dati: { stato: "attesa_whatsapp", statoPrecedenteIl: fa(30) },
      messaggi: [suo(fa(40), "manychat", "ciao")],
      adesso,
    }).si,
  );

  gruppo("DA CHIAMARE: IL CRON LEGGE I MESSAGGI COME DEVE");
  const hook = readFileSync(join(radice, "src/routes/hooks/attesa-da-chiamare.ts"), "utf8");
  const giro = hook.slice(
    hook.indexOf("async function messaggiDi"),
    hook.indexOf("export async function giroAttesaDaChiamare"),
  );
  c(
    "legge i messaggi con le sole colonne che servono (body per l'eco, status per gli invii non partiti)",
    true,
    //  Dal 31/10 (revoche del ponte) la lettura chiede anche `eliminato_il` e, senza la migrazione (42703), ripiega sulle colonne di prima.
    giro.includes('"direction, created_at, canale, duplicato_di, eliminato_il, from_number, to_number, body, status"') &&
      giro.includes('"direction, created_at, canale, duplicato_di, from_number, to_number, body, status"'),
  );
  c("sempre per utente", true, /\.eq\("user_id", userId\)/.test(giro));
  c(
    "solo degli ultimi 7 giorni",
    true,
    /GIORNI_DI_MESSAGGI = 7/.test(hook) && /\.gte\("created_at", dal\)/.test(giro),
  );
  c(
    "dei soli candidati, a blocchi e a pagine",
    true,
    /i \+= 30/.test(giro) &&
      /elenco\.slice\(i, i \+ 30\)/.test(giro) &&
      /\.range\(da, da \+ PAGINA - 1\)/.test(giro),
  );
  c(
    "il giro passa i messaggi alla regola",
    true,
    /patchDaChiamare\(r\.data, perNumero\.get\(chiave\), adesso, messaggi\.get\(chiave\)\)/.test(
      hook,
    ),
  );
  c(
    "il testo dei messaggi non finisce mai nei log",
    false,
    /console\.(log|warn|error|info)\([^)]*(body|messagg|testo)/.test(hook),
  );
}
