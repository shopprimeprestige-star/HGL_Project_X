/** ── LE PROVE DEL RIEPILOGO DELLA SERA (idea 10, 30/10/2026) ────────────────
 *
 *  `prove/prove.mjs` impacchetta `push/riepilogo` (voce di MODULI) e chiama
 *  `proveRiepilogoSerale(mod, aiuti)`. Il giro si prova con porte finte che
 *  si comportano come il database; rotta e migrazione si leggono dal sorgente.
 *  ⚠️ `aiuti` = { c, gruppo, radice }. Dati inventati: nessun nome, nessun
 *   numero vero. Gli istanti sono in UTC, così la prova non cambia esito con
 *   il fuso del computer.
 *  ───────────────────────────────────────────────────────────────────────── */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveRiepilogoSerale(mod, { c, gruppo, radice }) {
  const R = mod["push/riepilogo"];
  const INV = mod["promemoria/invio"];

  /* ═══ L'ORA: 20:00 DI ROMA, CON L'ORA SOLARE E L'ORA LEGALE ═════════════ */
  gruppo("RIEPILOGO SERALE · SI MANDA SOLO ALLE 20 DI ROMA");
  const alle = (iso) => R.eOraDelRiepilogo(new Date(iso));
  c("inverno: 19:00 UTC sono le 20 di Roma", true, alle("2026-12-10T19:00:00Z"));
  c("inverno: 18:00 UTC sono le 19, ancora no", false, alle("2026-12-10T18:00:00Z"));
  c(
    "inverno: fino alle 20:59 (19:59 UTC) sì, alle 21 no",
    [true, false],
    [alle("2026-12-10T19:59:00Z"), alle("2026-12-10T20:00:00Z")],
  );
  c("estate: 18:00 UTC sono le 20 di Roma", true, alle("2026-07-15T18:00:00Z"));
  c("estate: 19:00 UTC sono le 21, troppo tardi", false, alle("2026-07-15T19:00:00Z"));
  c("estate: 17:59 UTC sono le 19:59, ancora no", false, alle("2026-07-15T17:59:00Z"));
  c(
    "cambio d'ora d'autunno (25/10): vale 19:00 UTC, non 18:00",
    [true, false],
    [alle("2026-10-25T19:00:00Z"), alle("2026-10-25T18:00:00Z")],
  );
  c(
    "cambio d'ora di primavera (29/3): vale 18:00 UTC, non 19:00",
    [true, false],
    [alle("2026-03-29T18:00:00Z"), alle("2026-03-29T19:00:00Z")],
  );
  c(
    "di ogni giorno una sola delle due ore del cron cade nella finestra",
    true,
    [
      "2026-01-15",
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
      "2026-07-15",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ].every((g) => [alle(`${g}T18:00:00Z`), alle(`${g}T19:00:00Z`)].filter(Boolean).length === 1),
  );

  gruppo("RIEPILOGO SERALE · IL GIORNO DI DOMANI A ROMA");
  const domani = (iso) => R.domaniARoma(new Date(iso));
  c("una sera qualunque", "2026-10-30", domani("2026-10-29T19:00:00Z"));
  c("la sera prima del cambio d'ora d'autunno", "2026-10-25", domani("2026-10-24T18:00:00Z"));
  c("la sera del cambio d'ora (giorno di 25 ore)", "2026-10-26", domani("2026-10-25T19:00:00Z"));
  c("la sera prima del cambio d'ora di primavera", "2026-03-29", domani("2026-03-28T19:00:00Z"));
  c(
    "la sera del cambio d'ora di primavera (giorno di 23 ore)",
    "2026-03-30",
    domani("2026-03-29T18:00:00Z"),
  );
  c("fine anno", "2027-01-01", domani("2026-12-31T19:00:00Z"));
  c("fine mese di un anno bisestile", "2028-02-29", domani("2028-02-28T19:00:00Z"));
  c(
    "dopo mezzanotte a Roma, ma ancora sera in UTC: il giorno è quello di Roma",
    "2026-07-17",
    domani("2026-07-15T22:30:00Z"),
  );

  /* ═══ I CONTI ═══════════════════════════════════════════════════════════ */
  gruppo("RIEPILOGO SERALE · QUANTE CONSULENZE, CONFERMATE, DA SENTIRE");
  const ADESSO = new Date("2026-10-30T19:00:00Z"); // 20:00 a Roma, ora solare
  const DOMANI = "2026-10-31";
  const base = (extra) => ({
    stato: "appuntamento_fissato",
    dataMeeting: DOMANI,
    oraMeeting: "10:00",
    telefono: "+393330000001",
    ...extra,
  });
  const conferma = (d, p) => ({ ...d, promemoria: { chiave: INV.chiaveAppuntamento(d), ...p } });
  const sì = (d) =>
    conferma(d, {
      stato: "inviato",
      inviatoIl: "2026-10-29T10:00:00Z",
      confermatoIl: "2026-10-29T11:00:00Z",
      confermatoVia: "whatsapp",
    });
  const leads = [
    { data: sì(base({})) },
    { data: sì(base({ oraMeeting: "11:30", stato: "appuntamento_rifissato" })) },
    {
      data: conferma(base({ oraMeeting: "15:00" }), {
        stato: "inviato",
        inviatoIl: "2026-10-29T10:00:00Z",
      }),
    },
    { data: base({ oraMeeting: "16:00" }) },
    { data: base({ dataMeeting: "2026-10-30" }) },
    { data: base({ dataMeeting: "2026-11-01" }) },
    { data: base({ stato: "venduto" }) },
    { data: sì(base({ stato: "annullato" })) },
  ];
  c(
    "4 di domani (2 confermate), gli altri giorni e stati non contano",
    { consulenze: 4, confermate: 2, daSentire: 2 },
    R.contaConsulenze(leads, ADESSO),
  );
  c(
    "confermate + da sentire = consulenze",
    true,
    (({ consulenze: n, confermate: x, daSentire: y }) => n === x + y)(
      R.contaConsulenze(leads, ADESSO),
    ),
  );
  c(
    "un segno di un altro orario non conferma",
    { consulenze: 1, confermate: 0, daSentire: 1 },
    R.contaConsulenze([{ data: { ...sì(base({})), oraMeeting: "12:00" } }], ADESSO),
  );
  c(
    "nessuna scheda: tutto a zero",
    { consulenze: 0, confermate: 0, daSentire: 0 },
    R.contaConsulenze([], ADESSO),
  );
  c(
    "dopo il cambio d'ora d'autunno «domani» è il 26",
    { consulenze: 1, confermate: 0, daSentire: 1 },
    R.contaConsulenze(
      [
        { data: base({ dataMeeting: "2026-10-26" }) },
        { data: base({ dataMeeting: "2026-10-25" }) },
      ],
      new Date("2026-10-25T19:00:00Z"),
    ),
  );

  gruppo("RIEPILOGO SERALE · CHAT SENZA RISPOSTA");
  const fa = (ore) => new Date(ADESSO.getTime() - ore * 3_600_000).toISOString();
  const chat = [
    { ultimo_in_entrata_il: fa(2), risposto_il: null },
    { ultimo_in_entrata_il: fa(5), risposto_il: fa(9) },
    { ultimo_in_entrata_il: fa(5), risposto_il: fa(4) },
    { ultimo_in_entrata_il: fa(23.9), risposto_il: null },
    { ultimo_in_entrata_il: fa(24.1), risposto_il: null },
    { ultimo_in_entrata_il: fa(70), risposto_il: null },
    { ultimo_in_entrata_il: null, risposto_il: fa(1) },
    { ultimo_in_entrata_il: "boh", risposto_il: null },
    { ultimo_in_entrata_il: fa(3), risposto_il: fa(3) },
  ];
  c("ultimo messaggio del cliente, nelle ultime 24 ore", 3, R.contaChatSenzaRisposta(chat, ADESSO));
  c(
    "risposta nello stesso istante: risposta data",
    0,
    R.contaChatSenzaRisposta([{ ultimo_in_entrata_il: fa(3), risposto_il: fa(3) }], ADESSO),
  );
  c("nessuna chat: zero", 0, R.contaChatSenzaRisposta([], ADESSO));
  c("la soglia di lettura è 24 ore fa", fa(24), R.sogliaChat(ADESSO));

  /* ═══ LA FRASE E L'AVVISO ═══════════════════════════════════════════════ */
  gruppo("RIEPILOGO SERALE · LA FRASE, SOLO NUMERI");
  const q = (consulenze, confermate, daSentire, chatSenzaRisposta) => ({
    consulenze,
    confermate,
    daSentire,
    chatSenzaRisposta,
  });
  c(
    "la frase del titolare",
    "Domani 4 consulenze · 2 confermate · 2 da sentire · 3 chat senza risposta",
    R.fraseRiepilogo(q(4, 2, 2, 3)),
  );
  c(
    "al singolare",
    "Domani 1 consulenza · 1 confermata · 0 da sentire · 1 chat senza risposta",
    R.fraseRiepilogo(q(1, 1, 0, 1)),
  );
  c(
    "senza chat si dice zero",
    "Domani 2 consulenze · 0 confermate · 2 da sentire · 0 chat senza risposta",
    R.fraseRiepilogo(q(2, 0, 2, 0)),
  );
  c(
    "senza consulenze non si elencano confermate e da sentire",
    "Domani nessuna consulenza · 5 chat senza risposta",
    R.fraseRiepilogo(q(0, 0, 0, 5)),
  );
  c(
    "l'avviso apre le chat, ha una chiave sola e nessun nome",
    {
      titolo: "Riepilogo della sera",
      corpo: "Domani 4 consulenze · 2 confermate · 2 da sentire · 3 chat senza risposta",
      chiave: "riepilogo-serale",
      destinazione: "/CRM/whatsapp",
    },
    R.avvisoRiepilogo(q(4, 2, 2, 3)),
  );
  c("0 consulenze e 0 chat: nessuna notifica", null, R.avvisoRiepilogo(q(0, 0, 0, 0)));
  c("solo consulenze: si manda", true, !!R.avvisoRiepilogo(q(1, 0, 1, 0)));
  c("solo chat: si manda", true, !!R.avvisoRiepilogo(q(0, 0, 0, 1)));
  c(
    "il corpo ha solo cifre, parole fisse e separatori",
    true,
    /^[\d\sA-Za-zàèéìòù·]+$/.test(R.fraseRiepilogo(q(4, 2, 2, 3))),
  );

  /* ═══ IL GIRO, CON PORTE FINTE ══════════════════════════════════════════ */
  gruppo("RIEPILOGO SERALE · IL GIRO: UNA VOLTA SOLA, ALL'ORA GIUSTA");
  const nuovo = (extra = {}) => {
    const s = { ultimo: null, scritti: [], inviati: [], letture: 0, ...extra };
    const porte = {
      leggiUltimo: async () => s.ultimo,
      scriviUltimo: async (g) => {
        if (s.ultimo === g) return false;
        s.ultimo = g;
        s.scritti.push(g);
        return true;
      },
      utenti: async () => s.utenti ?? ["u1"],
      schede: async (u, g) => {
        s.letture++;
        s.giornoLetto = g;
        return (s.schede ?? {})[u] ?? [];
      },
      contatti: async (u, da) => {
        s.daLetto = da;
        return (s.contatti ?? {})[u] ?? [];
      },
      invia: async (u, avviso) => {
        s.inviati.push({ u, avviso });
        return { inviate: 2 };
      },
    };
    return { s, porte };
  };
  const dati = { u1: leads };
  {
    const { s, porte } = nuovo({ schede: dati, contatti: { u1: chat } });
    const e = await R.giroRiepilogo(porte, ADESSO);
    c(
      "alle 20: una notifica con la frase giusta",
      ["Domani 4 consulenze · 2 confermate · 2 da sentire · 3 chat senza risposta", 1],
      [s.inviati[0]?.avviso.corpo, s.inviati.length],
    );
    c("risposta con soli conteggi", { fatto: true, installazioni: 1, avvisi: 1, inviate: 2 }, e);
    c(
      "legge il giorno di domani e la soglia di 24 ore",
      [DOMANI, fa(24)],
      [s.giornoLetto, s.daLetto],
    );
    c("segna il giorno di oggi (Roma)", ["2026-10-30"], s.scritti);
    const e2 = await R.giroRiepilogo(porte, new Date(ADESSO.getTime() + 10 * 60_000));
    c(
      "secondo giro nella stessa ora: niente, già mandato",
      [{ fatto: false, motivo: "gia_mandato" }, 1],
      [e2, s.inviati.length],
    );
    const e3 = await R.giroRiepilogo(porte, new Date(ADESSO.getTime() + 24 * 3_600_000));
    c(
      "la sera dopo parte di nuovo",
      [true, 2, ["2026-10-30", "2026-10-31"]],
      [e3.fatto, s.inviati.length, s.scritti],
    );
  }
  {
    const { s, porte } = nuovo({ schede: dati });
    const e = await R.giroRiepilogo(porte, new Date("2026-10-30T18:00:00Z"));
    c(
      "alle 19 di Roma (18:00 UTC d'inverno): niente, e non segna",
      [{ fatto: false, motivo: "fuori_orario" }, 0, 0, null],
      [e, s.inviati.length, s.letture, s.ultimo],
    );
  }
  {
    const { s, porte } = nuovo({ schede: dati });
    const e = await R.giroRiepilogo(porte, new Date("2026-07-15T18:00:00Z"));
    c("d'estate il giro di 18:00 UTC parte", [true, "2026-07-15"], [e.fatto, s.ultimo]);
  }
  {
    const { s, porte } = nuovo({});
    const e = await R.giroRiepilogo(porte, ADESSO);
    c(
      "0 consulenze e 0 chat: nessuna notifica, ma il giorno è segnato",
      [{ fatto: true, installazioni: 1, avvisi: 0, inviate: 0 }, 0, ["2026-10-30"]],
      [e, s.inviati.length, s.scritti],
    );
  }
  {
    const { s, porte } = nuovo({ utenti: [] });
    const e = await R.giroRiepilogo(porte, ADESSO);
    c(
      "nessun telefono iscritto: non legge e non segna",
      [{ fatto: false, motivo: "nessun_telefono" }, 0, null],
      [e, s.letture, s.ultimo],
    );
  }
  {
    const { s, porte } = nuovo({
      utenti: ["u1", "u2"],
      schede: { u1: leads, u2: [] },
      contatti: { u2: [{ ultimo_in_entrata_il: fa(1), risposto_il: null }] },
    });
    await R.giroRiepilogo(porte, ADESSO);
    c(
      "due installazioni: ognuna riceve i SUOI numeri",
      ["u1:4", "u2:0"],
      s.inviati.map(
        (x) =>
          `${x.u}:${x.avviso.corpo.match(/\d+ consulenz/) ? x.avviso.corpo.match(/(\d+) consulenz/)[1] : 0}`,
      ),
    );
  }
  {
    const { s, porte } = nuovo({ schede: dati });
    porte.contatti = async () => {
      throw Object.assign(new Error("x"), { code: "42703" });
    };
    let errore = null;
    try {
      await R.giroRiepilogo(porte, ADESSO);
    } catch (e) {
      errore = e.code;
    }
    c(
      "una lettura che fallisce lancia e NON segna la serata (si può riprovare)",
      ["42703", null, 0],
      [errore, s.ultimo, s.inviati.length],
    );
  }
  {
    //  Revisione di sicurezza (30/10): due chiamate insieme, una sola notifica.
    const { s, porte } = nuovo({ schede: dati });
    const [a, b] = await Promise.all([R.giroRiepilogo(porte, ADESSO), R.giroRiepilogo(porte, ADESSO)]);
    c("due chiamate insieme: una sola manda", [1, 1], [[a, b].filter((x) => x.fatto).length, s.scritti.length]);
    c("…l'altra si ferma su «già mandato»", "gia_mandato", [a, b].find((x) => !x.fatto)?.motivo);
  }
  {
    const { s, porte } = nuovo({ schede: dati });
    porte.scriviUltimo = async () => {
      throw new Error("db");
    };
    let lanciato = false;
    try {
      await R.giroRiepilogo(porte, ADESSO);
    } catch {
      lanciato = true;
    }
    c(
      "se il segno non si scrive non si manda (meglio zero notifiche che ogni ora)",
      [true, 0],
      [lanciato, s.inviati.length],
    );
  }

  /* ═══ LA ROTTA E LA MIGRAZIONE ══════════════════════════════════════════ */
  gruppo("RIEPILOGO SERALE · ROTTA, CRON, COME SI SPEGNE");
  const hook = readFileSync(join(radice, "src/routes/hooks/riepilogo-serale.ts"), "utf8");
  const codiceHook = hook.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  c(
    "la rotta è /hooks/riepilogo-serale",
    true,
    /createFileRoute\("\/hooks\/riepilogo-serale"\)/.test(hook),
  );
  c(
    "stessa autenticazione degli altri hook: chiave pubblicabile, 401 senza",
    true,
    /authorization/.test(hook) &&
      /SUPABASE_PUBLISHABLE_KEY \|\| process\.env\.SUPABASE_ANON_KEY/.test(hook) &&
      /unauthorized"[^)]*401/.test(hook),
  );
  c(
    "legge a pagine, in ordine fisso",
    true,
    /\.order\("id", \{ ascending: true \}\)/.test(hook) &&
      /\.range\(da, da \+ PAGINA - 1\)/.test(hook),
  );
  c(
    "legge solo le schede di domani negli stati di appuntamento",
    true,
    /\.eq\("data->>dataMeeting", giorno\)/.test(hook) &&
      /\.in\("data->>stato", STATI_APPUNTAMENTO/.test(hook),
  );
  c(
    "la notifica passa dallo stesso invio delle notifiche WhatsApp",
    true,
    /inviaATutti\(userId, avviso\)/.test(hook),
  );
  c(
    "l'utente è quello delle iscrizioni, mai uno fisso",
    true,
    /from\("push_iscrizioni"\)/.test(hook) && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(hook),
  );
  c(
    "nei log solo il codice",
    true,
    /console\.error\("\[riepilogo-serale\]", typeof code === "string" \? code : "errore"\)/.test(
      hook,
    ),
  );
  c(
    "nessun nome né telefono nei log della rotta",
    false,
    /console\.\w+\([^)]*(nome|telefono|cognome)/.test(codiceHook),
  );
  c(
    "il segno del giorno sta in app_config",
    true,
    /riepilogo_serale_ultimo/.test(R.CHIAVE_ULTIMO) && /from\("app_config"\)/.test(hook),
  );

  const cartella = join(radice, "supabase/migrations");
  const file = readdirSync(cartella).find((n) => n.endsWith("_riepilogo_serale_cron.sql"));
  c("la migrazione c'è, con la data di oggi", "20261030110000_riepilogo_serale_cron.sql", file);
  const sql = readFileSync(join(cartella, file), "utf8");
  const codice = sql.replace(/--.*$/gm, "");
  const chiamate = [
    ...codice.matchAll(/public\.programma_hook_cron\('([^']+)', '([^']+)', '([^']+)'\)/g),
  ].map((m) => m.slice(1));
  c(
    "due cron alla stessa rotta: 18:00 e 19:00 UTC (20:00 di Roma d'estate e d'inverno)",
    [
      ["riepilogo-serale-18utc", "0 18 * * *", "/hooks/riepilogo-serale"],
      ["riepilogo-serale-19utc", "0 19 * * *", "/hooks/riepilogo-serale"],
    ],
    chiamate,
  );
  c(
    "come si spegne: tutte e due scritte",
    true,
    /cron\.unschedule\('riepilogo-serale-18utc'\)/.test(sql) &&
      /cron\.unschedule\('riepilogo-serale-19utc'\)/.test(sql),
  );
  c(
    "solo aggiunte: niente che cancelli, nessuna chiave",
    false,
    /DROP |DELETE |TRUNCATE|ALTER TABLE|service_role_key/i.test(codice),
  );
  c("spiega il fuso (UTC) nel commento", true, /UTC/.test(sql) && /ora legale/.test(sql));
}
