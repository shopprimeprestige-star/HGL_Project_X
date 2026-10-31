/** ── PROVE: IL PONTE NON TOCCA GIRO, NON LETTI, «DA RISPONDERE» ──
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T4 (PIANO §d1, I1-I4).
 *  Tre prove:
 *   1. il MONDO FINTO: schede, invii (uno senza risposta), contatti con non
 *      letti, `ultimo_in_entrata_*`, `non_scrivere_dal`; si importano 500
 *      messaggi `storico` (anche in entrata dopo l'invio) attraverso la rotta
 *      vera e le porte vere (`caricaRotta` di `rotta.mjs`). Poi: tabelle e
 *      colonne scritte solo quelle di I1/I2, colonne protette identiche, e le
 *      decisioni (freno del giro di `regole.ts`, «Da rispondere» della chat)
 *      uguali prima e dopo;
 *   2. il GREP del TypeScript: sotto `src/crm/manychat/` e `src/routes/hooks/`
 *      nessuno legge `whatsapp_messages` (solo `insert`, le porte di
 *      scrittura); il codice del ponte non nomina le colonne e le tabelle
 *      vietate;
 *   3. il GREP dell'SQL di T1 e della migrazione «tutte le chat» (30/10): le
 *      funzioni scrivono solo le tabelle e le colonne dell'elenco.
 *  30/10, «tutte le chat»: D7 tolta (A, B, C e lo sconosciuto D entrano tutti;
 *  i contatti nuovi sono DUE, senza scheda, 0 non letti, senza nome) e D9
 *  cambiata (una promozione ha il suo elenco chiuso di colonne; I2 resta per le
 *  righe `storico`, che non diventano mai non letti né «Da rispondere»).
 *  ⚠️ Le funzioni SQL del mondo finto imitano quelle di T1: la prova 1 prova
 *   il codice TypeScript e le decisioni; l'SQL vero lo legge la prova 3 (e il
 *   collaudo su Postgres di `prove/sql/ponte-wa.sql`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { UTENTE, caricaRotta, chiama, nuovoMondo } from "./rotta.mjs";

/** Cosa il ponte può scrivere (I1, I2; `updated_at` aggiunto da T1 su richiesta di T7, LAVAGNA). */
const PERMESSE = {
  whatsapp_messages: {
    insert: [
      "user_id",
      "wa_message_id",
      "direction",
      "from_number",
      "to_number",
      "body",
      "media_type",
      "status",
      "canale",
      "created_at",
      "raw_payload",
      "duplicato_di",
      "attesa_dal",
    ],
    update: ["duplicato_di", "attesa_dal", "promosso_il"],
  },
  whatsapp_contacts: {
    insert: ["user_id", "phone_e164", "display_name", "last_message_at", "risposto_il", "origine"],
    update: ["last_message_at", "display_name", "risposto_il", "updated_at"],
  },
  ponte_wa_stato: {
    upsert: [
      "user_id",
      "stato",
      "collegato_dal",
      "ultimo_messaggio_il",
      "storico",
      "contatori",
      "versione",
      "aggiornato_il",
    ],
  },
};
/** Cosa scrive sui contatti una PROMOZIONE (E3) o un ritiro: elenco chiuso, solo ponte_wa_promuovi e ponte_wa_ritira. */
const PROMOZIONE_CONTATTI = [
  "unread_count",
  "ultimo_in_entrata_anteprima",
  "ultimo_in_entrata_il",
  "last_message_at",
  "updated_at",
];
/** Le colonne dei contatti che il ponte non tocca mai (I2). */
const PROTETTE = [
  "unread_count",
  "ultimo_in_entrata_il",
  "ultimo_in_entrata_anteprima",
  "lead_id",
  "subscriber_id",
  "non_scrivere_dal",
  "risposto_il",
];
const VIETATE = [
  "whatsapp_registra_entrata",
  "unread_count",
  "ultimo_in_entrata",
  "non_scrivere_dal",
  "manychat_invii",
  "crm_leads",
];

const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const fileTs = (cartella) =>
  readdirSync(cartella, { recursive: true })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(cartella, f));

export async function provePonteNonInterferenza(mod, { c, gruppo, radice }) {
  const R = mod["manychat/regole"];
  const S = mod["chatwa/stato"];

  /* ═══ 1. IL MONDO FINTO E 500 MESSAGGI DI STORICO ═════════════════════════ */
  gruppo("PONTE WHATSAPP · NON-INTERFERENZA · IL MONDO FINTO (compito T4)");
  const rotta = await caricaRotta(radice);
  const fetchVero = globalThis.fetch;
  let esterne = 0;
  globalThis.fetch = () => {
    esterne++;
    throw new Error("nessuna chiamata fuori dal database");
  };
  try {
    const ADESSO = Date.now();
    const iso = (deltaS) => new Date(ADESSO + deltaS * 1000).toISOString();
    const GIORNO = 86400;
    const A = "393330000201"; // contatto con non letti e attesa aperta
    const B = "393330000202"; // contatto in STOP, già risposto
    const C = "393330000203"; // solo scheda: il contatto lo crea il ponte
    const D = "393330000299"; // sconosciuto (D7 tolta il 30/10): entra come contatto del ponte, senza scheda
    const ALTRO = "99999999-1111-4222-8333-444444444444";
    const mondo = {
      manychat_config: [{ id: 1, user_id: UTENTE, attivo: true }],
      whatsapp_settings: [{ user_id: UTENTE, phone_number_id: "1000000001" }],
      app_config: [{ key: "funnel", value: { acceso: true } }],
      crm_leads: [
        {
          id: "l-a",
          user_id: UTENTE,
          data: { telefono: "+39 333 000 0201", stato: "da_ricontattare" },
        },
        { id: "l-b", user_id: UTENTE, data: { telefono: "3330000202", stato: "richiamo" } },
        {
          id: "l-c",
          user_id: UTENTE,
          data: {
            telefono: "+393330000203",
            stato: "nuovo",
            contattoWa: { stato: "inviato", il: iso(-2 * GIORNO) },
          },
        },
        { id: "l-x", user_id: ALTRO, data: { telefono: "+393330000299" } }, // la scheda di un ALTRO utente: non rende D un lead
      ],
      manychat_invii: [
        //  Senza risposta: il freno è tirato. Lo storico porta un «in» DOPO l'invio: non deve sbloccarlo.
        {
          id: "i-a",
          user_id: UTENTE,
          telefono: A,
          tipo: "ricontatto",
          stato: "inviato",
          prenotato_il: iso(-2 * GIORNO),
          risposta_il: null,
          sbloccato_il: null,
        },
        {
          id: "i-b",
          user_id: UTENTE,
          telefono: B,
          tipo: "promemoria",
          stato: "inviato",
          prenotato_il: iso(-3 * GIORNO),
          risposta_il: iso(-3 * GIORNO + 600),
          sbloccato_il: null,
        },
        {
          id: "i-c",
          user_id: UTENTE,
          telefono: C,
          tipo: "ricontatto",
          stato: "inviato",
          prenotato_il: iso(-1 * GIORNO),
          risposta_il: null,
          sbloccato_il: null,
        },
      ],
      whatsapp_contacts: [
        {
          id: "w-a",
          user_id: UTENTE,
          phone_e164: "+" + A,
          display_name: null,
          lead_id: "l-a",
          subscriber_id: "5001",
          unread_count: 3,
          last_message_at: iso(-GIORNO),
          ultimo_in_entrata_il: iso(-GIORNO),
          ultimo_in_entrata_anteprima: "quando?",
          risposto_il: null,
          non_scrivere_dal: null,
        },
        {
          id: "w-b",
          user_id: UTENTE,
          phone_e164: B,
          display_name: "Nome In Rubrica",
          lead_id: "l-b",
          subscriber_id: null,
          unread_count: 0,
          last_message_at: iso(-5 * GIORNO),
          ultimo_in_entrata_il: iso(-6 * GIORNO),
          ultimo_in_entrata_anteprima: "stop",
          risposto_il: iso(-5 * GIORNO),
          non_scrivere_dal: iso(-5 * GIORNO),
        },
      ],
      whatsapp_messages: [
        {
          id: "c0c0c0c0-1111-4222-8333-000000000001",
          user_id: UTENTE,
          wa_message_id: "mc-a1",
          direction: "inbound",
          from_number: "+" + A,
          to_number: "manychat",
          body: "quando?",
          status: "delivered",
          canale: "manychat",
          created_at: iso(-GIORNO),
        },
      ],
    };
    const m = nuovoMondo(mondo);
    const prima = structuredClone(m.tab);

    //  500 messaggi: 120 a testa per A, B, C, 140 per D; in e out alternati, dagli ultimi 90 giorni fino a 1 ora fa.
    const numeri = [
      ...Array(120).fill(A),
      ...Array(120).fill(B),
      ...Array(120).fill(C),
      ...Array(140).fill(D),
    ];
    const messaggi = numeri.map((numero, i) => ({
      id: `3EB0ST${String(i).padStart(4, "0")}`,
      numero,
      dir: i % 2 ? "out" : "in",
      ts: Math.floor((ADESSO - 3600_000 - ((i * 7919) % 90) * 86400_000 - i * 1000) / 1000),
      testo: i % 5 === 0 ? "📷 Foto" : `messaggio di prova ${i}`,
      tipo: i % 5 === 0 ? "foto" : "testo",
    }));
    const dopoInvio = messaggi.filter(
      (x) =>
        x.numero === A &&
        x.dir === "in" &&
        x.ts * 1000 > Date.parse(mondo.manychat_invii[0].prenotato_il),
    );
    c(
      "lo storico porta anche messaggi in entrata dopo l'invio senza risposta",
      true,
      dopoInvio.length > 0,
    );

    const Route = rotta.carica();
    const POST = Route.options.server.handlers.POST;
    const esiti = [];
    for (let i = 0; i < messaggi.length; i += 50) {
      const x = await chiama(POST, {
        corpo: {
          v: 1,
          tipo: "lotto",
          origine: "storico",
          messaggi: messaggi.slice(i, i + 50),
          nomi: { [A]: "Nome Da Whatsapp", [C]: "Altro Nome", [D]: "Sconosciuto" },
        },
      });
      esiti.push(x.json);
    }
    const somma = (k) => esiti.reduce((t, e) => t + (e?.[k] ?? 0), 0);
    c("10 lotti da 50, tutti 200", 10, esiti.filter((e) => e?.ok === true).length);
    c(
      "ricevuti 500, nuovi 500 (A, B, C e lo sconosciuto D), fuori rubrica 0",
      [500, 500, 0, 0],
      [somma("ricevuti"), somma("nuovi"), somma("fuori_rubrica"), somma("scartati")],
    );
    c(
      "…e nessun id torna in non_noti (D7 tolta)",
      0,
      esiti.flatMap((e) => e?.non_noti ?? []).length,
    );

    gruppo("PONTE WHATSAPP · NON-INTERFERENZA · COSA È STATO SCRITTO (I1, I2)");
    const dopo = m.tab;
    for (const t of [
      "crm_leads",
      "manychat_invii",
      "manychat_config",
      "whatsapp_settings",
      "app_config",
    ])
      c(`${t}: identica`, prima[t], dopo[t]);
    const toccate = [...new Set(m.scritture.map((w) => w.tabella))].sort();
    c(
      "tabelle scritte: solo whatsapp_messages e whatsapp_contacts",
      ["whatsapp_contacts", "whatsapp_messages"],
      toccate,
    );
    c(
      "lo storico non marca niente: nessuna riga con attesa_dal o promosso_il (non può diventare un'entrata vera)",
      0,
      dopo.whatsapp_messages.filter((r) => r.attesa_dal || r.promosso_il).length,
    );
    const fuori = m.scritture.filter(
      (w) => !w.colonne.every((k) => PERMESSE[w.tabella]?.[w.azione]?.includes(k)),
    );
    c("ogni scrittura usa solo le colonne permesse", [], fuori);
    c(
      "nessuna scrittura diretta delle porte (tutto dentro ponte_wa_scrivi)",
      0,
      m.scritture.filter((w) => w.via === "diretta").length,
    );
    c(
      "le sole funzioni chiamate sono candidati, scrivi e promuovi (mai noti)",
      ["ponte_wa_candidati", "ponte_wa_scrivi"],
      [...new Set(m.rpc.map((r) => r.fn))].sort(),
    );
    for (const x of prima.whatsapp_contacts) {
      const y = dopo.whatsapp_contacts.find((r) => r.id === x.id);
      c(
        `contatto ${x.id}: non letti, entrate, scheda, STOP e risposto identici`,
        Object.fromEntries(PROTETTE.map((k) => [k, x[k]])),
        Object.fromEntries(PROTETTE.map((k) => [k, y?.[k]])),
      );
    }
    const nuovo = dopo.whatsapp_contacts.filter(
      (r) => !prima.whatsapp_contacts.some((x) => x.id === r.id),
    );
    c(
      "due contatti nuovi (C e lo sconosciuto D), del ponte, senza scheda, senza non letti, senza entrate, SENZA NOME (E7)",
      [
        ["+" + C, "baileys", 0, undefined, undefined, null],
        ["+" + D, "baileys", 0, undefined, undefined, null],
      ],
      nuovo
        .map((r) => [
          r.phone_e164,
          r.origine,
          r.unread_count,
          r.lead_id,
          r.ultimo_in_entrata_il,
          r.display_name,
        ])
        .sort((p, q) => (p[0] < q[0] ? -1 : 1)),
    );
    c(
      "il nome di WhatsApp riempie solo un nome vuoto di un contatto che ha già la scheda",
      ["Nome Da Whatsapp", "Nome In Rubrica"],
      ["w-a", "w-b"].map((id) => dopo.whatsapp_contacts.find((r) => r.id === id)?.display_name),
    );
    c(
      "lo sconosciuto D ha le sue 140 righe, tutte del ponte, e nessuna sulla scheda di un altro utente",
      [140, true],
      [
        dopo.whatsapp_messages.filter(
          (r) => r.canale === "baileys" && (r.from_number === "+" + D || r.to_number === "+" + D),
        ).length,
        dopo.crm_leads.every((l) => l.user_id !== UTENTE || !JSON.stringify(l).includes(D)),
      ],
    );
    c(
      "le righe nuove sono tutte canale baileys",
      500,
      dopo.whatsapp_messages.filter((r) => r.canale === "baileys").length,
    );

    gruppo("PONTE WHATSAPP · NON-INTERFERENZA · LE DECISIONI SONO LE STESSE");
    const adesso = new Date(ADESSO);
    const invii = (t) =>
      t.manychat_invii.map((i) => ({
        telefono: i.telefono,
        tipo: i.tipo,
        stato: i.stato,
        prenotatoIl: i.prenotato_il,
        rispostaIl: i.risposta_il,
        sbloccatoIl: i.sbloccato_il,
      }));
    const freno = (t) =>
      t.crm_leads
        .filter((l) => l.user_id === UTENTE)
        .map((l) => [
          R.aspettaRisposta(l.data.telefono, invii(t), l.data.contattoWa, adesso),
          R.ultimoAutomatico(l.data.telefono, invii(t))?.prenotatoIl ?? null,
        ]);
    c(
      "il freno «mai due senza risposta» è tirato per A e C prima dell'import",
      [true, false, true],
      freno(prima).map((x) => x[0]),
    );
    c("freno e ultimo invio uguali prima e dopo l'import", freno(prima), freno(dopo));

    const chat = (t, n) => {
      const contatto =
        t.whatsapp_contacts.find(
          (r) => r.user_id === UTENTE && R.ultimeNoveCifre(r.phone_e164) === R.ultimeNoveCifre(n),
        ) ?? null;
      const messaggi = t.whatsapp_messages.filter(
        (r) =>
          R.ultimeNoveCifre(r.direction === "inbound" ? r.from_number : r.to_number) ===
          R.ultimeNoveCifre(n),
      );
      return S.daRispondere({ contatto, messaggi, adesso });
    };
    c(
      "«Da rispondere» di A, B, C e dello sconosciuto D uguale prima e dopo l'import di STORICO (D non ha niente, gli altri nemmeno)",
      [A, B, C, D].map((n) => chat(prima, n)),
      [A, B, C, D].map((n) => chat(dopo, n)),
    );
    c(
      "lo storico di D, 140 messaggi anche in entrata, non lo mette in «Da rispondere»",
      false,
      chat(dopo, D).attesa,
    );
    c(
      "il numeretto del menu non cambia con lo storico",
      S.contaDaRispondere(prima.whatsapp_contacts, adesso),
      S.contaDaRispondere(dopo.whatsapp_contacts, adesso),
    );
    c("…e vale 1 (solo A)", 1, S.contaDaRispondere(dopo.whatsapp_contacts, adesso));
    c(
      "«Non letti»: la somma dei non letti è quella di prima (solo A, 3)",
      [3, 3],
      [prima.whatsapp_contacts, dopo.whatsapp_contacts].map((t) =>
        t.reduce((n, r) => n + (r.unread_count ?? 0), 0),
      ),
    );

    gruppo("PONTE WHATSAPP · NON-INTERFERENZA · LA PROMOZIONE (D9 cambiata il 30/10)");
    //  Un'entrata VIVA di un lead (A) e di uno sconosciuto (D), senza pari: dopo l'attesa diventano entrate
    //  vere. Il tempo si sposta riscrivendo attesa_dal. Cambia solo l'elenco chiuso di colonne di E3.
    {
      const m2 = nuovoMondo(structuredClone(mondo));
      const p0 = structuredClone(m2.tab);
      const Route2 = rotta.carica();
      const POST2 = Route2.options.server.handlers.POST;
      await chiama(POST2, {
        corpo: {
          v: 1,
          tipo: "lotto",
          origine: "vivo",
          messaggi: [
            {
              id: "3EB0PRA1",
              numero: A,
              dir: "in",
              ts: Math.floor(ADESSO / 1000) - 90,
              testo: "Posso spostare l'appuntamento?",
              tipo: "testo",
            },
            {
              id: "3EB0PRD1",
              numero: D,
              dir: "in",
              ts: Math.floor(ADESSO / 1000) - 80,
              testo: "Buongiorno, siete aperti?",
              tipo: "testo",
            },
          ],
          nomi: { [A]: "Nome Da Whatsapp", [D]: "Sconosciuto" },
        },
      });
      const nonLetti = (t, n) =>
        t.whatsapp_contacts.find((r) => R.ultimeNoveCifre(r.phone_e164) === R.ultimeNoveCifre(n))
          ?.unread_count;
      c(
        "subito dopo il lotto vivo: non letti ancora quelli di prima (A 3, D 0), e «Da rispondere» non è cambiato",
        [3, 0, 1],
        [
          nonLetti(m2.tab, A),
          nonLetti(m2.tab, D),
          S.contaDaRispondere(m2.tab.whatsapp_contacts, adesso),
        ],
      );
      for (const r of m2.tab.whatsapp_messages.filter((x) => x.canale === "baileys"))
        r.attesa_dal = new Date(Date.now() - 130_000).toISOString();
      await chiama(POST2, { corpo: { v: 1, tipo: "battito", stato: "collegato" } });
      c(
        "dopo 130 secondi: +1 non letti per il lead (4) e per lo sconosciuto (1)",
        [4, 1],
        [nonLetti(m2.tab, A), nonLetti(m2.tab, D)],
      );
      c(
        "«Da rispondere» ora conta anche lo sconosciuto: 2 (A e D)",
        2,
        S.contaDaRispondere(m2.tab.whatsapp_contacts, adesso),
      );
      c(
        "lo sconosciuto D è «da rispondere» con l'anteprima del suo messaggio",
        [true, "Buongiorno, siete aperti?"],
        (() => {
          const x = m2.tab.whatsapp_contacts.find(
            (r) => R.ultimeNoveCifre(r.phone_e164) === R.ultimeNoveCifre(D),
          );
          return [
            Boolean(S.daRispondere({ contatto: x, messaggi: [], adesso })),
            x?.ultimo_in_entrata_anteprima,
          ];
        })(),
      );
      for (const t of [
        "crm_leads",
        "manychat_invii",
        "manychat_config",
        "whatsapp_settings",
        "app_config",
      ])
        c(`${t}: identica anche dopo la promozione`, p0[t], m2.tab[t]);
      for (const x of p0.whatsapp_contacts) {
        const y = m2.tab.whatsapp_contacts.find((r) => r.id === x.id);
        c(
          `contatto ${x.id} dopo la promozione: scheda, id ManyChat, STOP e risposto_il identici`,
          Object.fromEntries(
            ["lead_id", "subscriber_id", "non_scrivere_dal", "risposto_il"].map((k) => [k, x[k]]),
          ),
          Object.fromEntries(
            ["lead_id", "subscriber_id", "non_scrivere_dal", "risposto_il"].map((k) => [k, y?.[k]]),
          ),
        );
      }
      c(
        "lo sconosciuto D resta senza scheda, senza id ManyChat, senza STOP",
        [undefined, undefined, undefined],
        (() => {
          const x = m2.tab.whatsapp_contacts.find(
            (r) => R.ultimeNoveCifre(r.phone_e164) === R.ultimeNoveCifre(D),
          );
          return [x?.lead_id, x?.subscriber_id, x?.non_scrivere_dal];
        })(),
      );
      c(
        "la promozione scrive sui contatti solo l'elenco chiuso di E3",
        [],
        m2.scritture.filter(
          (w) =>
            w.via === "ponte_wa_promuovi" &&
            w.tabella === "whatsapp_contacts" &&
            !w.colonne.every((k) => PROMOZIONE_CONTATTI.includes(k)),
        ),
      );
      c(
        "le funzioni chiamate: candidati, scrivi, promuovi",
        ["ponte_wa_candidati", "ponte_wa_promuovi", "ponte_wa_scrivi"],
        [...new Set(m2.rpc.map((r) => r.fn))].sort(),
      );
      c(
        "il freno «mai due senza risposta» e l'ultimo invio sono uguali a prima (l'entrata promossa non sblocca niente)",
        freno(p0),
        freno(m2.tab),
      );
    }
    c("nessuna chiamata fuori dal database", 0, esterne);
  } finally {
    globalThis.fetch = fetchVero;
    delete globalThis.__ponteMondo;
    rotta.chiudi();
  }

  /* ═══ 2. IL GREP DEL TYPESCRIPT ═══════════════════════════════════════════ */
  gruppo("PONTE WHATSAPP · NON-INTERFERENZA · GREP DEL CODICE (I1, I3)");
  {
    const file = [
      ...fileTs(join(radice, "src/crm/manychat")),
      ...fileTs(join(radice, "src/routes/hooks")),
    ];
    const letture = [];
    let scritture = 0;
    //  UNA lettura ammessa (fix/manychat-eco, 29/10/2026): `ultimeEntrate` per
    //  l'eco del Default Reply, che esclude le righe del ponte nel filtro stesso.
    const LETTURE_AMMESSE = {
      "src/crm/manychat/porte.server.ts": 1,
      //  p8: il conto degli invii falliti del controllo della notte, senza il ponte.
      "src/routes/hooks/controllo-notte.ts": 1,
      //  Una reazione non riapre la finestra di 24 ore (30/10/2026): i messaggi in entrata
      //  recenti dei soli contatti la cui ultima entrata era senza testo.
      "src/crm/manychat/entrate-vere.server.ts": 1,
    };
    const FILTRO_SENZA_PONTE = "canale.is.null,canale.neq.${CANALE_PONTE}";
    //  UNA lettura CON il ponte, voluta dal titolare (30/10/2026, «contano tutti i
    //  messaggi»): il ritorno in «Attesa WhatsApp» quando il cliente scrive, da
    //  qualsiasi canale. Legge solo le entrate senza pari (`duplicato_di` nullo) e
    //  non scrive nulla su whatsapp_messages: le altre regole restano senza ponte.
    //  Una seconda lettura (30/10/2026, «la palla è al cliente»): i messaggi nostri e suoi
    //  degli ultimi 7 giorni dei soli candidati a «Da chiamare», ponte compreso, solo
    //  senza pari (`duplicato_di` nullo), per sapere chi ha scritto per ultimo. Non scrive nulla.
    const LETTURE_COL_PONTE = { "src/routes/hooks/attesa-da-chiamare.ts": 2 };
    for (const f of file) {
      const codice = senzaCommenti(readFileSync(f, "utf8"));
      const rel = f.slice(radice.length + 1);
      const nomi = (codice.match(/["'`]whatsapp_messages["'`]/g) ?? []).length;
      const insert = [
        ...codice.matchAll(/\.from\(\s*["'`]whatsapp_messages["'`]\s*\)\s*\.(\w+)(?:<[^>]*>)?\(/g),
      ];
      scritture += insert.filter((x) => x[1] === "insert").length;
      const select = insert.filter((x) => x[1] === "select").length;
      const ammesse = LETTURE_AMMESSE[rel] ?? 0;
      const colPonte = LETTURE_COL_PONTE[rel] ?? 0;
      const lettureOk =
        select === ammesse + colPonte &&
        (ammesse === 0 || codice.split(FILTRO_SENZA_PONTE).length - 1 === ammesse) &&
        (colPonte === 0 || /\.is\(\s*["'`]duplicato_di["'`]\s*,\s*null\s*\)/.test(codice));
      if (
        nomi !== insert.length ||
        insert.some((x) => x[1] !== "insert" && x[1] !== "select") ||
        !lettureOk
      )
        letture.push(rel);
    }
    c(
      "sotto manychat/ e routes/hooks/ whatsapp_messages si usa solo per insert (più la lettura dell'eco, senza il ponte)",
      [],
      letture,
    );
    c("…e le porte di scrittura ci sono davvero (il grep vede qualcosa)", true, scritture >= 3);

    const ponte = [
      ...fileTs(join(radice, "src/crm/ponte")),
      join(radice, "src/routes/api.public.ponte-whatsapp.ts"),
    ];
    //  I file attesi sono una lista di nomi, non un numero: l'invio a mano
    //  (commessa 2026-10-30-ponte-invio-manuale) ne aggiunge, uno per compito
    //  (`invio-giro.ts` e `invio.server.ts` arrivano con il blocco B).
    const nomiPonte = ponte.map((f) => f.slice(radice.length + 1)).sort();
    const vecchi = [
      "src/crm/ponte/ingresso.ts",
      "src/crm/ponte/pari.ts",
      "src/crm/ponte/porte.server.ts",
      "src/crm/ponte/tipi.ts",
      "src/routes/api.public.ponte-whatsapp.ts",
    ];
    const invio = ["src/crm/ponte/invio-giro.ts", "src/crm/ponte/invio-tipi.ts", "src/crm/ponte/invio.server.ts", "src/crm/ponte/invio.ts"];
    //  Le immagini (commessa 2026-10-30-ponte-storico-completo, T5): tre file, alla pari dell'invio.
    invio.push("src/crm/ponte/media-tipi.ts", "src/crm/ponte/media.ts", "src/crm/ponte/media.server.ts");
    //  Le revoche (commessa 2026-10-31, ponte-revoche): un file, la porta vera (`revoche.server.ts`).
    invio.push("src/crm/ponte/revoche.server.ts");
    c("il codice del ponte: ingresso, pari, porte, tipi, rotta (ci sono tutti)", [], vecchi.filter((x) => !nomiPonte.includes(x)));
    c("…e in più solo i file dell'invio a mano (invio-tipi, invio, invio-giro, invio.server) e delle immagini (media-tipi, media, media.server) e delle revoche (revoche.server)", [], nomiPonte.filter((x) => !vecchi.includes(x) && !invio.includes(x)));
    c("…invio-tipi.ts e invio.ts esistono già (T0)", true, nomiPonte.includes("src/crm/ponte/invio-tipi.ts") && nomiPonte.includes("src/crm/ponte/invio.ts"));
    const nominate = ponte.flatMap((f) => {
      const codice = senzaCommenti(readFileSync(f, "utf8"));
      return VIETATE.filter((v) => codice.includes(v)).map(
        (v) => `${f.slice(radice.length + 1)}: ${v}`,
      );
    });
    c(`il codice del ponte non nomina ${VIETATE.join(", ")}`, [], nominate);
  }

  /* ═══ 3. IL GREP DELL'SQL (T1 e «tutte le chat») ═════════════════════════ */
  gruppo("PONTE WHATSAPP · NON-INTERFERENZA · GREP DELL'SQL (I1, I2, I4)");
  {
    //  La migrazione del ponte (29/10) e quella di «tutte le chat» (30/10): `ponte_wa_scrivi` esiste in tutte e due
    //  (la seconda la ridefinisce con le stesse colonne), quindi le si legge insieme.
    const leggi = (f) =>
      readFileSync(join(radice, `supabase/migrations/${f}`), "utf8").replace(/--.*$/gm, "");
    const sql1 = leggi("20261029120000_ponte_whatsapp.sql");
    const sql2 = leggi("20261030160000_ponte_tutte_le_chat.sql");
    const sql = sql1 + "\n" + sql2;
    const corpi = [
      ...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)[\s\S]*?\$\$([\s\S]*?)\$\$/g),
    ].map((x) => [x[1], x[2]]);
    c(
      "le funzioni delle due migrazioni sono quelle del ponte (scrivi due volte: la 2ª ridefinisce la 1ª)",
      [
        "ponte_wa_candidati",
        "ponte_wa_noti",
        "ponte_wa_promuovi",
        "ponte_wa_ritira",
        "ponte_wa_scrivi",
        "ponte_wa_scrivi",
      ],
      corpi.map((x) => x[0]).sort(),
    );
    //  Le funzioni che scrivono il lotto (v1 e v2 di scrivi): l'elenco chiuso di I1/I2 di sempre.
    const scrivi = corpi
      .filter((x) => x[0] === "ponte_wa_scrivi")
      .map((x) => x[1])
      .join("\n");
    const nuove = corpi
      .filter((x) => x[0] === "ponte_wa_promuovi" || x[0] === "ponte_wa_ritira")
      .map((x) => x[1])
      .join("\n");
    const bersagli = (tutto) =>
      [
        ...tutto.matchAll(/(?<!DO |FOR )\b(INSERT INTO|UPDATE|DELETE FROM)\s+(?:public\.)?(\w+)/g),
      ].map((x) => `${x[1]} ${x[2]}`);
    c(
      "scrivi (v1 e v2): si scrivono solo whatsapp_messages e whatsapp_contacts, senza DELETE",
      [
        "INSERT INTO whatsapp_contacts",
        "INSERT INTO whatsapp_messages",
        "UPDATE whatsapp_contacts",
        "UPDATE whatsapp_messages",
      ],
      [...new Set(bersagli(scrivi))].sort(),
    );
    c(
      "promuovi e ritira: solo UPDATE di whatsapp_contacts e whatsapp_messages (mai INSERT, mai DELETE)",
      ["UPDATE whatsapp_contacts", "UPDATE whatsapp_messages"],
      [...new Set(bersagli(nuove))].sort(),
    );
    const colonne = (blocco) =>
      [...blocco.matchAll(/^\s*(?:SET\s+)?(\w+)\s+=\s/gm)].map((x) => x[1]);
    const setDi = (tutto, tab) =>
      [
        ...tutto.matchAll(
          new RegExp(`UPDATE public\\.${tab}\\s+\\w+\\s+SET([\\s\\S]*?)\\bWHERE\\b`, "g"),
        ),
      ].flatMap((x) => colonne("SET" + x[1]));
    const conflitto = [...scrivi.matchAll(/DO UPDATE\s+SET([\s\S]*?)(?:RETURNING|;)/g)].flatMap(
      (x) => colonne("SET" + x[1]),
    );
    c(
      "scrivi, UPDATE dei messaggi: solo duplicato_di",
      ["duplicato_di"],
      [...new Set(setDi(scrivi, "whatsapp_messages"))],
    );
    const contatti = [...new Set([...setDi(scrivi, "whatsapp_contacts"), ...conflitto])].sort();
    c(
      "scrivi, UPDATE dei contatti (anche ON CONFLICT): solo last_message_at, display_name, risposto_il, updated_at",
      ["display_name", "last_message_at", "risposto_il", "updated_at"],
      contatti,
    );
    const insert = (tab) =>
      [
        ...scrivi.matchAll(
          new RegExp(`INSERT INTO public\\.${tab}(?:\\s+AS\\s+\\w+)?\\s*\\(([^)]*)\\)`, "g"),
        ),
      ].flatMap((x) => x[1].split(",").map((s) => s.trim()));
    c(
      "scrivi, INSERT dei contatti: solo le colonne permesse",
      [],
      insert("whatsapp_contacts").filter((k) => !PERMESSE.whatsapp_contacts.insert.includes(k)),
    );
    c(
      "scrivi, INSERT dei messaggi: solo le colonne permesse (con attesa_dal)",
      [],
      insert("whatsapp_messages").filter((k) => !PERMESSE.whatsapp_messages.insert.includes(k)),
    );
    c(
      "il grep dell'SQL vede le colonne (non è vuoto)",
      [true, true],
      [insert("whatsapp_contacts").length >= 5, insert("whatsapp_messages").length >= 10],
    );
    //  Le due funzioni nuove nominano i non letti e l'ultima entrata (è il loro mestiere); lo dice il grep, in un posto solo.
    const nomina = (tutto, k) => tutto.includes(k);
    c(
      "i non letti e l'ultima entrata li nomina SOLO promuovi/ritira, non scrivi (I2 resta per lo storico)",
      [true, false],
      [
        nomina(nuove, "unread_count") && nomina(nuove, "ultimo_in_entrata_il"),
        nomina(scrivi, "unread_count") || nomina(scrivi, "ultimo_in_entrata"),
      ],
    );
    c(
      "nessuna funzione esistente ridefinita (I4), salvo ponte_wa_scrivi con le sue tre modifiche (prova in tutte-migrazione.mjs)",
      [],
      [...sql2.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)]
        .map((x) => x[1])
        .filter((n) => !n.startsWith("ponte_wa_")),
    );
    c(
      "nel TypeScript (commenti esclusi) ponte_wa_promuovi sta solo in ponte/porte.server.ts e ponte_wa_ritira non c'è: la chiama l'SQL di ponte_wa_scrivi",
      [],
      (() => {
        const trovati = [];
        for (const f of [...fileTs(join(radice, "src"))]) {
          const rel = f.slice(radice.length + 1);
          const codice = senzaCommenti(readFileSync(f, "utf8"));
          if (/ponte_wa_(promuovi|ritira)/.test(codice) && rel !== "src/crm/ponte/porte.server.ts")
            trovati.push(rel);
        }
        return trovati;
      })(),
    );
  }
}
