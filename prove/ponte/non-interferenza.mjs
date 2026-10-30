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
 *   3. il GREP dell'SQL di T1: le tre funzioni scrivono solo le tabelle e le
 *      colonne dell'elenco.
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
    insert: ["user_id", "wa_message_id", "direction", "from_number", "to_number", "body", "media_type", "status", "canale", "created_at", "raw_payload", "duplicato_di"],
    update: ["duplicato_di"],
  },
  whatsapp_contacts: {
    insert: ["user_id", "phone_e164", "display_name", "last_message_at", "risposto_il", "origine"],
    update: ["last_message_at", "display_name", "risposto_il", "updated_at"],
  },
  ponte_wa_stato: {
    upsert: ["user_id", "stato", "collegato_dal", "ultimo_messaggio_il", "storico", "contatori", "versione", "aggiornato_il"],
  },
};
/** Le colonne dei contatti che il ponte non tocca mai (I2). */
const PROTETTE = ["unread_count", "ultimo_in_entrata_il", "ultimo_in_entrata_anteprima", "lead_id", "subscriber_id", "non_scrivere_dal", "risposto_il"];
const VIETATE = ["whatsapp_registra_entrata", "unread_count", "ultimo_in_entrata", "non_scrivere_dal", "manychat_invii", "crm_leads"];

const senzaCommenti = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const fileTs = (cartella) =>
  readdirSync(cartella, { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => join(cartella, f));

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
    const D = "393330000299"; // sconosciuto: non entra
    const ALTRO = "99999999-1111-4222-8333-444444444444";
    const mondo = {
      manychat_config: [{ id: 1, user_id: UTENTE, attivo: true }],
      whatsapp_settings: [{ user_id: UTENTE, phone_number_id: "1000000001" }],
      app_config: [{ key: "funnel", value: { acceso: true } }],
      crm_leads: [
        { id: "l-a", user_id: UTENTE, data: { telefono: "+39 333 000 0201", stato: "da_ricontattare" } },
        { id: "l-b", user_id: UTENTE, data: { telefono: "3330000202", stato: "richiamo" } },
        { id: "l-c", user_id: UTENTE, data: { telefono: "+393330000203", stato: "nuovo", contattoWa: { stato: "inviato", il: iso(-2 * GIORNO) } } },
        { id: "l-x", user_id: ALTRO, data: { telefono: "+393330000299" } },
      ],
      manychat_invii: [
        //  Senza risposta: il freno è tirato. Lo storico porta un «in» DOPO l'invio: non deve sbloccarlo.
        { id: "i-a", user_id: UTENTE, telefono: A, tipo: "ricontatto", stato: "inviato", prenotato_il: iso(-2 * GIORNO), risposta_il: null, sbloccato_il: null },
        { id: "i-b", user_id: UTENTE, telefono: B, tipo: "promemoria", stato: "inviato", prenotato_il: iso(-3 * GIORNO), risposta_il: iso(-3 * GIORNO + 600), sbloccato_il: null },
        { id: "i-c", user_id: UTENTE, telefono: C, tipo: "ricontatto", stato: "inviato", prenotato_il: iso(-1 * GIORNO), risposta_il: null, sbloccato_il: null },
      ],
      whatsapp_contacts: [
        { id: "w-a", user_id: UTENTE, phone_e164: "+" + A, display_name: null, lead_id: "l-a", subscriber_id: "5001", unread_count: 3,
          last_message_at: iso(-GIORNO), ultimo_in_entrata_il: iso(-GIORNO), ultimo_in_entrata_anteprima: "quando?", risposto_il: null, non_scrivere_dal: null },
        { id: "w-b", user_id: UTENTE, phone_e164: B, display_name: "Nome In Rubrica", lead_id: "l-b", subscriber_id: null, unread_count: 0,
          last_message_at: iso(-5 * GIORNO), ultimo_in_entrata_il: iso(-6 * GIORNO), ultimo_in_entrata_anteprima: "stop", risposto_il: iso(-5 * GIORNO), non_scrivere_dal: iso(-5 * GIORNO) },
      ],
      whatsapp_messages: [
        { id: "c0c0c0c0-1111-4222-8333-000000000001", user_id: UTENTE, wa_message_id: "mc-a1", direction: "inbound", from_number: "+" + A,
          to_number: "manychat", body: "quando?", status: "delivered", canale: "manychat", created_at: iso(-GIORNO) },
      ],
    };
    const m = nuovoMondo(mondo);
    const prima = structuredClone(m.tab);

    //  500 messaggi: 120 a testa per A, B, C, 140 per D; in e out alternati, dagli ultimi 90 giorni fino a 1 ora fa.
    const numeri = [...Array(120).fill(A), ...Array(120).fill(B), ...Array(120).fill(C), ...Array(140).fill(D)];
    const messaggi = numeri.map((numero, i) => ({
      id: `3EB0ST${String(i).padStart(4, "0")}`,
      numero,
      dir: i % 2 ? "out" : "in",
      ts: Math.floor((ADESSO - 3600_000 - ((i * 7919) % 90) * 86400_000 - i * 1000) / 1000),
      testo: i % 5 === 0 ? "📷 Foto" : `messaggio di prova ${i}`,
      tipo: i % 5 === 0 ? "foto" : "testo",
    }));
    const dopoInvio = messaggi.filter((x) => x.numero === A && x.dir === "in" && x.ts * 1000 > Date.parse(mondo.manychat_invii[0].prenotato_il));
    c("lo storico porta anche messaggi in entrata dopo l'invio senza risposta", true, dopoInvio.length > 0);

    const Route = rotta.carica();
    const POST = Route.options.server.handlers.POST;
    const esiti = [];
    for (let i = 0; i < messaggi.length; i += 50) {
      const x = await chiama(POST, {
        corpo: { v: 1, tipo: "lotto", origine: "storico", messaggi: messaggi.slice(i, i + 50), nomi: { [A]: "Nome Da Whatsapp", [C]: "Altro Nome", [D]: "Sconosciuto" } },
      });
      esiti.push(x.json);
    }
    const somma = (k) => esiti.reduce((t, e) => t + (e?.[k] ?? 0), 0);
    c("10 lotti da 50, tutti 200", 10, esiti.filter((e) => e?.ok === true).length);
    c("ricevuti 500, nuovi 360 (A, B, C), fuori rubrica 140 (D)", [500, 360, 140, 0], [somma("ricevuti"), somma("nuovi"), somma("fuori_rubrica"), somma("scartati")]);
    //  p3 (30/10): lo storico rimanda gli id dei non noti (e solo quelli), che il
    //  ponte tiene nella sua cache sul Mac; nel CRM non entra niente di D.
    const idD = new Set(messaggi.filter((x) => x.numero === D).map((x) => x.id));
    const rimandati = esiti.flatMap((e) => e?.non_noti ?? []);
    c("lo storico rimanda in non_noti solo gli id dei non noti (140 di D)", [140, true], [rimandati.length, rimandati.every((id) => idD.has(id))]);

    gruppo("PONTE WHATSAPP · NON-INTERFERENZA · COSA È STATO SCRITTO (I1, I2)");
    const dopo = m.tab;
    for (const t of ["crm_leads", "manychat_invii", "manychat_config", "whatsapp_settings", "app_config"])
      c(`${t}: identica`, prima[t], dopo[t]);
    const toccate = [...new Set(m.scritture.map((w) => w.tabella))].sort();
    c("tabelle scritte: solo whatsapp_messages e whatsapp_contacts", ["whatsapp_contacts", "whatsapp_messages"], toccate);
    const fuori = m.scritture.filter((w) => !w.colonne.every((k) => PERMESSE[w.tabella]?.[w.azione]?.includes(k)));
    c("ogni scrittura usa solo le colonne permesse", [], fuori);
    c("nessuna scrittura diretta delle porte (tutto dentro ponte_wa_scrivi)", 0, m.scritture.filter((w) => w.via === "diretta").length);
    c("le sole funzioni chiamate sono le tre del ponte", ["ponte_wa_candidati", "ponte_wa_noti", "ponte_wa_scrivi"], [...new Set(m.rpc.map((r) => r.fn))].sort());
    for (const x of prima.whatsapp_contacts) {
      const y = dopo.whatsapp_contacts.find((r) => r.id === x.id);
      c(`contatto ${x.id}: non letti, entrate, scheda, STOP e risposto identici`,
        Object.fromEntries(PROTETTE.map((k) => [k, x[k]])), Object.fromEntries(PROTETTE.map((k) => [k, y?.[k]])));
    }
    const nuovo = dopo.whatsapp_contacts.filter((r) => !prima.whatsapp_contacts.some((x) => x.id === r.id));
    c("un solo contatto nuovo (C), del ponte, senza scheda e senza non letti", [["+" + C, "baileys", 0, undefined, undefined]],
      nuovo.map((r) => [r.phone_e164, r.origine, r.unread_count, r.lead_id, r.ultimo_in_entrata_il]));
    c("il nome di WhatsApp riempie solo un nome vuoto", ["Nome Da Whatsapp", "Nome In Rubrica"],
      ["w-a", "w-b"].map((id) => dopo.whatsapp_contacts.find((r) => r.id === id)?.display_name));
    c("lo sconosciuto D non lascia traccia", false, JSON.stringify(dopo.whatsapp_messages.concat(dopo.whatsapp_contacts)).includes(D));
    c("le righe nuove sono tutte canale baileys", 360, dopo.whatsapp_messages.filter((r) => r.canale === "baileys").length);

    gruppo("PONTE WHATSAPP · NON-INTERFERENZA · LE DECISIONI SONO LE STESSE");
    const adesso = new Date(ADESSO);
    const invii = (t) =>
      t.manychat_invii.map((i) => ({ telefono: i.telefono, tipo: i.tipo, stato: i.stato, prenotatoIl: i.prenotato_il, rispostaIl: i.risposta_il, sbloccatoIl: i.sbloccato_il }));
    const freno = (t) =>
      t.crm_leads.filter((l) => l.user_id === UTENTE).map((l) => [
        R.aspettaRisposta(l.data.telefono, invii(t), l.data.contattoWa, adesso),
        R.ultimoAutomatico(l.data.telefono, invii(t))?.prenotatoIl ?? null,
      ]);
    c("il freno «mai due senza risposta» è tirato per A e C prima dell'import", [true, false, true], freno(prima).map((x) => x[0]));
    c("freno e ultimo invio uguali prima e dopo l'import", freno(prima), freno(dopo));

    const chat = (t, n) => {
      const contatto = t.whatsapp_contacts.find((r) => r.user_id === UTENTE && R.ultimeNoveCifre(r.phone_e164) === R.ultimeNoveCifre(n)) ?? null;
      const messaggi = t.whatsapp_messages.filter((r) => R.ultimeNoveCifre(r.direction === "inbound" ? r.from_number : r.to_number) === R.ultimeNoveCifre(n));
      return S.daRispondere({ contatto, messaggi, adesso });
    };
    c("«Da rispondere» di A, B, C uguale prima e dopo (anche C, che ora ha un contatto e 120 messaggi)",
      [A, B, C].map((n) => chat(prima, n)), [A, B, C].map((n) => chat(dopo, n)));
    c("il numeretto del menu non cambia", S.contaDaRispondere(prima.whatsapp_contacts, adesso), S.contaDaRispondere(dopo.whatsapp_contacts, adesso));
    c("…e vale 1 (solo A)", 1, S.contaDaRispondere(dopo.whatsapp_contacts, adesso));
    c("nessuna chiamata fuori dal database", 0, esterne);
  } finally {
    globalThis.fetch = fetchVero;
    delete globalThis.__ponteMondo;
    rotta.chiudi();
  }

  /* ═══ 2. IL GREP DEL TYPESCRIPT ═══════════════════════════════════════════ */
  gruppo("PONTE WHATSAPP · NON-INTERFERENZA · GREP DEL CODICE (I1, I3)");
  {
    const file = [...fileTs(join(radice, "src/crm/manychat")), ...fileTs(join(radice, "src/routes/hooks"))];
    const letture = [];
    let scritture = 0;
    //  UNA lettura ammessa (fix/manychat-eco, 29/10/2026): `ultimeEntrate` per
    //  l'eco del Default Reply, che esclude le righe del ponte nel filtro stesso.
    const LETTURE_AMMESSE = { "src/crm/manychat/porte.server.ts": 1 };
    const FILTRO_SENZA_PONTE = "canale.is.null,canale.neq.${CANALE_PONTE}";
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
      const lettureOk =
        select === ammesse &&
        (ammesse === 0 || codice.split(FILTRO_SENZA_PONTE).length - 1 === ammesse);
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

    const ponte = [...fileTs(join(radice, "src/crm/ponte")), join(radice, "src/routes/api.public.ponte-whatsapp.ts")];
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
    c("il codice del ponte: ingresso, pari, porte, tipi, rotta (ci sono tutti)", [], vecchi.filter((x) => !nomiPonte.includes(x)));
    c("…e in più solo i file dell'invio a mano (invio-tipi, invio, invio-giro, invio.server)", [], nomiPonte.filter((x) => !vecchi.includes(x) && !invio.includes(x)));
    c("…invio-tipi.ts e invio.ts esistono già (T0)", true, nomiPonte.includes("src/crm/ponte/invio-tipi.ts") && nomiPonte.includes("src/crm/ponte/invio.ts"));
    const nominate = ponte.flatMap((f) => {
      const codice = senzaCommenti(readFileSync(f, "utf8"));
      return VIETATE.filter((v) => codice.includes(v)).map((v) => `${f.slice(radice.length + 1)}: ${v}`);
    });
    c(`il codice del ponte non nomina ${VIETATE.join(", ")}`, [], nominate);
  }

  /* ═══ 3. IL GREP DELL'SQL DI T1 ═══════════════════════════════════════════ */
  gruppo("PONTE WHATSAPP · NON-INTERFERENZA · GREP DELL'SQL (I1, I2, I4)");
  {
    const sql = readFileSync(join(radice, "supabase/migrations/20261029120000_ponte_whatsapp.sql"), "utf8").replace(/--.*$/gm, "");
    const corpi = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)[\s\S]*?\$\$([\s\S]*?)\$\$/g)].map((x) => [x[1], x[2]]);
    c("le funzioni della migrazione sono le tre del ponte", ["ponte_wa_candidati", "ponte_wa_noti", "ponte_wa_scrivi"], corpi.map((x) => x[0]).sort());
    const tutto = corpi.map((x) => x[1]).join("\n");
    const bersagli = [...tutto.matchAll(/(?<!DO |FOR )\b(INSERT INTO|UPDATE|DELETE FROM)\s+(?:public\.)?(\w+)/g)].map((x) => `${x[1]} ${x[2]}`);
    c("dentro le funzioni si scrivono solo whatsapp_messages e whatsapp_contacts, senza DELETE",
      ["INSERT INTO whatsapp_contacts", "INSERT INTO whatsapp_messages", "UPDATE whatsapp_contacts", "UPDATE whatsapp_messages"], [...new Set(bersagli)].sort());
    const colonne = (blocco) => [...blocco.matchAll(/^\s*(?:SET\s+)?(\w+)\s+=\s/gm)].map((x) => x[1]);
    const setDi = (tab) => [...tutto.matchAll(new RegExp(`UPDATE public\\.${tab}\\s+\\w+\\s+SET([\\s\\S]*?)\\bWHERE\\b`, "g"))].flatMap((x) => colonne("SET" + x[1]));
    const conflitto = [...tutto.matchAll(/DO UPDATE\s+SET([\s\S]*?)(?:RETURNING|;)/g)].flatMap((x) => colonne("SET" + x[1]));
    c("UPDATE dei messaggi: solo duplicato_di", ["duplicato_di"], [...new Set(setDi("whatsapp_messages"))]);
    const contatti = [...new Set([...setDi("whatsapp_contacts"), ...conflitto])].sort();
    c("UPDATE dei contatti (anche ON CONFLICT): solo last_message_at, display_name, risposto_il, updated_at",
      ["display_name", "last_message_at", "risposto_il", "updated_at"], contatti);
    const insert = (tab) => [...tutto.matchAll(new RegExp(`INSERT INTO public\\.${tab}(?:\\s+AS\\s+\\w+)?\\s*\\(([^)]*)\\)`, "g"))]
      .flatMap((x) => x[1].split(",").map((s) => s.trim()));
    c("INSERT dei contatti: solo le colonne permesse", [], insert("whatsapp_contacts").filter((k) => !PERMESSE.whatsapp_contacts.insert.includes(k)));
    c("INSERT dei messaggi: solo le colonne permesse", [], insert("whatsapp_messages").filter((k) => !PERMESSE.whatsapp_messages.insert.includes(k)));
    c("il grep dell'SQL vede le colonne (non è vuoto)", [true, true], [insert("whatsapp_contacts").length >= 5, insert("whatsapp_messages").length >= 10]);
    c("nessuna funzione esistente ridefinita (I4)", [], [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((x) => x[1]).filter((n) => !n.startsWith("ponte_wa_")));
  }
}
