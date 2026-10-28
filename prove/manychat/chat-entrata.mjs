/** ── PROVE: CHAT WHATSAPP · L'ENTRATA ─────────────────────────────────────────────
 *
 *  Commessa 2026-10-28 (chat WhatsApp nel CRM), PIANO.md T4 (D6-D10, R3, R4, R6).
 *  Cosa copre: i numeri sconosciuti si registrano, il contatore dei non letti è
 *  +1 per messaggio (atomico, nella funzione SQL), un testo fatto solo di
 *  segnaposto `{{...}}` non sporca niente, la chat torna in «Da rispondere» con
 *  l'orologio del DATABASE, e prima della migrazione il codice ripiega da solo.
 *
 *  ⚠️ NIENTE DI VERO: `risposta.ts` è quello vero, `porte.server.ts` pure, ma
 *   con un Supabase FINTO in memoria che si comporta come le funzioni SQL del
 *   piano (`whatsapp_registra_entrata`, `whatsapp_segna_risposto`: +1, formato
 *   col «+» o senza, ora = quella del database, che qui è `db.ora`). Nessuna
 *   rete, nessun ManyChat. Dati inventati: nessun numero né nome vero.
 *  ⚠️ Il modulo delle porte si ricarica da capo a ogni scenario: l'avviso del
 *   ripiego è «uno per processo» e la memoria sta lì dentro.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEL = "393331234567";
const SUB = "1000001";
const NOME = "Anna Demo";
const U = "u-entrata-1";
const U_INVIO = "11111111-2222-4333-8444-555555555555";
const U_LEAD = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ADESSO = new Date("2026-10-28T14:00:20Z");
const VOCALE =
  "https://manybot-files.s3.eu-central-1.amazonaws.com/pagina123/wa/2026/10/28/original_abc123def.ogg";

/** Il Supabase finto: le tabelle stanno in `globalThis.__chatEntrata`. */
const SUPABASE_FINTO = `
const db = () => globalThis.__chatEntrata;
const iso = (ms) => new Date(ms).toISOString();
const colonneNuove = ["ultimo_in_entrata_il", "ultimo_in_entrata_anteprima", "risposto_il", "subscriber_id"];
function tabella(nome) {
  const st = db();
  const righe = nome === "whatsapp_contacts" ? st.contatti : nome === "whatsapp_messages" ? st.messaggi : [];
  const filtri = [];
  let azione = "select", valori = null, tetto = Infinity, colonne = null, chiaveUpsert = null;
  const q = {
    select: (c) => ((colonne = c ? c.split(",").map((s) => s.trim()) : null), q),
    insert: (v) => ((azione = "insert"), (valori = v), q),
    update: (v) => ((azione = "update"), (valori = v), q),
    upsert: (v, o) => ((azione = "upsert"), (valori = v), (chiaveUpsert = o.onConflict.split(",")), q),
    eq: (c, v) => (filtri.push((r) => r[c] === v), q),
    in: (c, v) => (filtri.push((r) => v.includes(r[c])), q),
    is: (c, v) => (filtri.push((r) => (r[c] ?? null) === v), q),
    limit: (n) => ((tetto = n), q),
    then: (ok, no) => Promise.resolve(esegui()).then(ok, no),
  };
  function senzaColonna(v) {
    return st.senzaColonne && Object.keys(v).some((k) => colonneNuove.includes(k))
      ? { data: null, error: { code: "42703", message: "column does not exist" } }
      : null;
  }
  function esegui() {
    st.operazioni.push({ tabella: nome, azione });
    if (azione === "select") {
      const r = righe.filter((x) => filtri.every((f) => f(x))).slice(0, tetto);
      return {
        data: r.map((x) => (colonne ? Object.fromEntries(colonne.map((k) => [k, x[k] ?? null])) : { ...x })),
        error: null,
      };
    }
    st.scritture++;
    const guasto = senzaColonna(valori);
    if (guasto) return guasto;
    if (azione === "insert") {
      if (nome === "whatsapp_messages" && righe.some((r) => r.wa_message_id === valori.wa_message_id))
        return { data: null, error: { code: "23505", message: "duplicate " + valori.body } };
      righe.push({ ...valori });
      return { data: null, error: null };
    }
    if (azione === "update") {
      for (const r of righe.filter((x) => filtri.every((f) => f(x)))) Object.assign(r, valori);
      return { data: null, error: null };
    }
    const esiste = righe.find((r) => chiaveUpsert.every((k) => r[k] === valori[k]));
    if (esiste) Object.assign(esiste, valori);
    else righe.push({ id: "riga-" + righe.length, ...valori });
    return { data: null, error: null };
  }
  return q;
}
const cifre = (t) => String(t ?? "").replace(/\\D/g, "");
/** La riga del numero: col «+» di preferenza, altrimenti senza (come l'SQL). */
function trova(userId, tel) {
  return db()
    .contatti.filter((r) => r.user_id === userId && (r.phone_e164 === "+" + tel || r.phone_e164 === tel))
    .sort((a, b) => (b.phone_e164 === "+" + tel) - (a.phone_e164 === "+" + tel))[0];
}
export const supabaseAdmin = {
  from: (t) => tabella(t),
  rpc: async (fn, a) => {
    const st = db();
    st.rpc.push({ fn, args: a });
    if (st.erroreRpc) return { data: null, error: st.erroreRpc };
    if (fn === "whatsapp_registra_entrata") {
      const tel = cifre(a.p_phone);
      const ora = iso(st.ora); // ⚠️ l'orologio è quello del DATABASE: p_il non entra in nessun confronto
      const r = trova(a.p_user_id, tel);
      if (r) {
        r.unread_count = (r.unread_count ?? 0) + 1;
        r.last_message_at = ora;
        r.ultimo_in_entrata_il = ora;
        r.ultimo_in_entrata_anteprima = a.p_anteprima;
        r.lead_id = r.lead_id ?? a.p_lead_id;
        r.display_name = r.display_name ?? a.p_nome;
        r.subscriber_id = a.p_subscriber_id ?? r.subscriber_id;
      } else {
        st.contatti.push({
          id: "riga-" + st.contatti.length,
          user_id: a.p_user_id, phone_e164: "+" + tel, lead_id: a.p_lead_id, display_name: a.p_nome,
          unread_count: 1, last_message_at: ora, ultimo_in_entrata_il: ora,
          ultimo_in_entrata_anteprima: a.p_anteprima, subscriber_id: a.p_subscriber_id,
        });
      }
      return { data: null, error: null };
    }
    if (fn === "whatsapp_segna_risposto") {
      const r = trova(a.p_user_id, cifre(a.p_phone));
      if (!r) return { data: false, error: null };
      const ora = iso(st.ora);
      r.risposto_il = ora > (r.ultimo_in_entrata_il ?? "") ? ora : r.ultimo_in_entrata_il;
      return { data: true, error: null };
    }
    return { data: null, error: { code: "42883", message: "function does not exist" } };
  },
};
export const supabaseAdminDefault = supabaseAdmin;
globalThis.__chatEntrataSupabase = supabaseAdmin;`;

export async function proveChatEntrata(mod, { c, gruppo, radice }) {
  const RS = mod["manychat/risposta"];
  const RT = mod["manychat/ritorno"];
  const IV = mod["promemoria/invio"];
  const CT = mod["manychat/contatto"];

  const dir = mkdtempSync(join(tmpdir(), "chat-entrata-"));
  const avvisoOriginale = console.warn;
  const fetchVero = globalThis.fetch;
  let chiamateEsterne = 0;
  globalThis.fetch = () => {
    chiamateEsterne++;
    throw new Error("l'entrata non deve chiamare nessuno");
  };
  try {
    const finta = join(dir, "supabase-finto.js");
    writeFileSync(finta, SUPABASE_FINTO);
    const esbuild = createRequire(import.meta.url)("esbuild");
    const fuori = join(dir, "porte-server.cjs");
    await esbuild.build({
      entryPoints: [join(radice, "src/crm/manychat/porte.server.ts")],
      bundle: true,
      format: "cjs",
      platform: "node",
      outfile: fuori,
      logLevel: "error",
      loader: { ".tsx": "tsx" },
      alias: { "@/integrations/supabase/client.server": finta, "@": join(radice, "src") },
    });
    const richiedi = createRequire(import.meta.url);

    /** I `console.warn` di tutta la prova (le porte vere scrivono lì). */
    const warn = [];
    console.warn = (...a) => warn.push(a.map(String).join(" "));

    /** Modulo delle porte nuovo di zecca + database finto vuoto. */
    function carica(o = {}) {
      delete richiedi.cache[richiedi.resolve(fuori)];
      warn.length = 0;
      const st = {
        contatti: (o.contatti ?? []).map((r, i) => ({ id: "riga-" + i, ...r })),
        messaggi: [],
        rpc: [],
        operazioni: [],
        scritture: 0,
        erroreRpc: o.erroreRpc ?? null,
        senzaColonne: !!o.senzaColonne,
        ora: Date.parse("2026-10-28T14:00:20Z"),
      };
      globalThis.__chatEntrata = st;
      return { PS: richiedi(fuori), st };
    }

    /* ── il mondo: porte vere per il contatto e il registro, finte per il resto ── */
    const invioConferma = (o = {}) => ({
      id: U_INVIO,
      userId: U,
      leadId: U_LEAD,
      telefono: TEL,
      subscriberId: SUB,
      prenotatoIl: "2026-10-28T13:55:00Z",
      stato: "inviato",
      ...o,
    });
    const scheda = () => {
      const data = { telefono: "333 123 4567", dataMeeting: "2026-10-29", oraMeeting: "16:00" };
      data.promemoria = { stato: "inviato", chiave: IV.chiaveAppuntamento(data) };
      return { id: U_LEAD, userId: U, data };
    };
    function mondo(o = {}) {
      const { PS, st } = carica(o);
      const vera = PS.porteRisposta();
      const m = {
        db: st,
        avvisi: [],
        chiamate: [], // gli argomenti di ogni `aggiornaContatto`
        rispostaLog: [],
        contattoLog: [],
        rpcPromemoria: [],
        scritture: [], // tutto ciò che il mondo finto scrive (per cercare il segnaposto)
        invii: o.invii ?? [],
        schede: o.schede ?? [],
      };
      m.porte = {
        ...vera,
        avviso: (x) => m.avvisi.push(x),
        utente: async () => ({ userId: U }),
        invii: async (cerca) =>
          m.invii.filter(
            (i) =>
              i.userId === cerca.userId &&
              Date.parse(i.prenotatoIl) >= cerca.dal.getTime() &&
              (i.id === cerca.crmInvioId ||
                (cerca.subscriberId && i.subscriberId === cerca.subscriberId) ||
                (cerca.telefono && i.telefono === cerca.telefono)),
          ),
        aggiornaContatto: async (userId, x) => {
          m.chiamate.push(x);
          if (o.guastoContatto) throw { code: "XX009", message: `dato ${TEL} ${NOME} ${VOCALE}` };
          return vera.aggiornaContatto(userId, x);
        },
        rispostaArrivata: async (userId, invioId) => {
          m.rispostaLog.push({ userId, invioId });
          m.scritture.push({ rispostaArrivata: invioId });
        },
        contattoDi: async (userId, leadId) => {
          const s = m.schede.find((x) => x.id === leadId && x.userId === userId);
          return s ? { contattoWa: s.data.contattoWa } : null;
        },
        scriviContatto: async (userId, leadId, cambio) => {
          const s = m.schede.find((x) => x.id === leadId && x.userId === userId);
          if (!s) return false;
          s.data.contattoWa = CT.applicaCambio(s.data.contattoWa, cambio);
          m.contattoLog.push(cambio.patch.stato);
          m.scritture.push({ contatto: cambio });
          return true;
        },
        //  La conferma: lo STOP sul numero è quello VERO (scrive nel Supabase finto);
        //  le schede e l'aggiornamento del promemoria sono finti.
        conferma: (userId, tel, adesso) => ({
          ...vera.conferma(userId, tel, adesso),
          schedeConMessaggio: async () => m.schede.filter((s) => s.userId === userId),
          aggiorna: async (id, pezzo, seChiave) => {
            m.rpcPromemoria.push({ id, pezzo, seChiave });
            m.scritture.push({ promemoria: pezzo });
            const s = m.schede.find((x) => x.id === id);
            if (s && s.data.promemoria?.chiave === seChiave)
              s.data.promemoria = { ...s.data.promemoria, ...pezzo };
            return { error: null };
          },
          avviso: (x) => m.avvisi.push(`conferma: ${x}`),
        }),
      };
      return m;
    }
    const corpo = (o = {}) => ({
      crmInvioId: "",
      crmLeadId: "",
      subscriberId: SUB,
      telefono: `+${TEL}`,
      testo: "Salve, vorrei informazioni",
      ...o,
    });
    const richiesta = (o = {}) => ({
      chiaveOk: true,
      segretoPresente: true,
      corpo: corpo(),
      adesso: ADESSO,
      ...o,
    });
    const manda = (m, o = {}, adesso) =>
      RS.gestisciRisposta(m.porte, richiesta({ corpo: corpo(o), ...(adesso ? { adesso } : {}) }));
    const riga = (m, tel = TEL) => m.db.contatti.find((r) => r.phone_e164 === `+${tel}`);
    const inAttesa = (r) =>
      !!r?.ultimo_in_entrata_il && (!r.risposto_il || r.ultimo_in_entrata_il > r.risposto_il);

    /* ════════════════════════════════════════════════════════════════════
     *  1 · I NUMERI SCONOSCIUTI SI REGISTRANO, IL +1 È UNO PER MESSAGGIO
     * ════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · ENTRATA · SCONOSCIUTI E +1");
    {
      let m = mondo();
      let r = await manda(m);
      c(
        "uno sconosciuto (né invio né rubrica) → registrata",
        [200, "registrata"],
        [r.stato, r.esito],
      );
      c(
        "…una riga di messaggio e la riga del contatto, con 1 non letto",
        [1, 1, 1, `+${TEL}`],
        [
          m.db.messaggi.length,
          m.db.contatti.length,
          riga(m)?.unread_count,
          m.db.contatti[0]?.phone_e164,
        ],
      );

      //  Lo stesso messaggio due volte nello stesso minuto: UNA riga, UNA chiamata, UN +1.
      m = mondo();
      await manda(m);
      r = await manda(m, {}, new Date(ADESSO.getTime() + 20e3));
      c("stesso messaggio due volte nello stesso minuto → doppione", "doppione", r.esito);
      c(
        "…1 riga, 1 chiamata a aggiornaContatto, 1 non letto",
        [1, 1, 1],
        [m.db.messaggi.length, m.chiamate.length, riga(m)?.unread_count],
      );

      //  Tre messaggi diversi: tre righe, tre chiamate, tre non letti.
      m = mondo();
      for (const [i, testo] of ["uno", "due", "tre"].entries())
        await manda(m, { testo }, new Date(ADESSO.getTime() + i * 5e3));
      c(
        "tre messaggi diversi → 3 righe, 3 chiamate, 3 non letti",
        [3, 3, 3, 1],
        [m.db.messaggi.length, m.chiamate.length, riga(m)?.unread_count, m.db.contatti.length],
      );
      c(
        "…la funzione SQL è chiamata col nome e i parametri del piano",
        [
          "whatsapp_registra_entrata",
          ["p_user_id", "p_phone", "p_lead_id", "p_il", "p_anteprima", "p_subscriber_id", "p_nome"],
        ],
        [m.db.rpc[0].fn, Object.keys(m.db.rpc[0].args)],
      );

      //  STOP di uno sconosciuto: la riga nasce e porta `non_scrivere_dal`.
      m = mondo();
      r = await manda(m, { testo: "stop" });
      c(
        "STOP di uno sconosciuto → riga creata con non_scrivere_dal",
        [1, ADESSO.toISOString()],
        [m.db.contatti.length, riga(m)?.non_scrivere_dal],
      );

      //  Il numero senza «+» (righe vecchie) è la stessa chat: +1 sulla stessa riga.
      m = mondo({ contatti: [{ user_id: U, phone_e164: TEL, unread_count: 2, lead_id: null }] });
      await manda(m);
      c(
        "riga vecchia senza «+» → +1 sulla stessa riga, nessuna riga doppia",
        [1, 3],
        [m.db.contatti.length, m.db.contatti[0].unread_count],
      );

      //  Restano ignorati: l'invio di un altro contatto e il telefono non valido.
      m = mondo({ invii: [invioConferma({ subscriberId: "2000002", telefono: "393338888888" })] });
      r = await manda(m, { crmInvioId: U_INVIO });
      c(
        "invio di un altro contatto → ignorata, niente registrato",
        ["ignorata", 0, 0],
        [r.esito, m.db.messaggi.length, m.db.contatti.length],
      );
      m = mondo();
      r = await manda(m, { telefono: "", subscriberId: "" });
      c(
        "nessun telefono → ignorata, niente registrato",
        ["ignorata", 0, 0],
        [r.esito, m.db.messaggi.length, m.db.contatti.length],
      );

      //  Uno sconosciuto non tocca l'«ora della risposta» del giro né nessuna scheda.
      m = mondo({ schede: [scheda()] });
      await manda(m);
      c(
        "sconosciuto: nessuna ora di risposta, nessun secondo stato",
        [0, 0],
        [m.rispostaLog.length, m.contattoLog.length],
      );
    }

    /* ── l'ora della risposta del giro: solo per chi risponde a noi ─────── */
    gruppo("CHAT WHATSAPP · ENTRATA · L'ORA DELLA RISPOSTA DEL GIRO");
    {
      //  Uno spammer che scrive due volte (la prima crea la riga, la seconda è
      //  «nota» ma senza scheda) non deve spegnere l'avviso «nessuna risposta da 48 ore».
      let m = mondo();
      await manda(m, { testo: "uno" });
      await manda(m, { testo: "due" }, new Date(ADESSO.getTime() + 5e3));
      c(
        "sconosciuto senza scheda che scrive due volte → 0 ore di risposta",
        [2, 0],
        [m.db.messaggi.length, m.rispostaLog.length],
      );
      m = mondo({
        contatti: [{ user_id: U, phone_e164: `+${TEL}`, lead_id: null, unread_count: 0 }],
      });
      await manda(m);
      c("in rubrica ma senza scheda → 0 ore di risposta", 0, m.rispostaLog.length);
      m = mondo({
        contatti: [{ user_id: U, phone_e164: `+${TEL}`, lead_id: U_LEAD, unread_count: 0 }],
      });
      await manda(m);
      c(
        "in rubrica con scheda → l'ora della risposta si scrive (senza invio)",
        [null],
        m.rispostaLog.map((x) => x.invioId),
      );
      m = mondo({ invii: [invioConferma()] });
      await manda(m, { crmInvioId: U_INVIO });
      c(
        "risposta a un nostro invio → l'ora della risposta si scrive",
        [U_INVIO],
        m.rispostaLog.map((x) => x.invioId),
      );
    }

    /* ════════════════════════════════════════════════════════════════════
     *  2 · I SEGNAPOSTO NON RISOLTI (D8, R4, R6)
     * ════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · ENTRATA · SEGNAPOSTO");
    {
      //  Sconosciuto: si scarta, niente di niente.
      for (const testo of ["{{last_input_text}}", "  {{a}} {{b}} ", "{{ x }}"]) {
        const m = mondo();
        const r = await manda(m, { testo });
        c(
          `sconosciuto, testo «${testo.trim()}» → segnaposto: nessuna riga, nessuna chiamata, nessun contatto`,
          ["segnaposto", 0, 0, 0],
          [r.esito, m.db.messaggi.length, m.chiamate.length, m.db.contatti.length],
        );
      }
      //  Un testo con anche parole vere NON è un segnaposto: si registra.
      {
        const m = mondo();
        const r = await manda(m, { testo: "{{a}} ciao" });
        c(
          "segnaposto più una parola vera → registrata com'è",
          ["registrata", "{{a}} ciao"],
          [r.esito, m.db.messaggi[0]?.body],
        );
      }

      //  Numero IN RUBRICA: si registra come messaggio non leggibile e conta.
      let m = mondo({
        contatti: [{ user_id: U, phone_e164: `+${TEL}`, lead_id: null, unread_count: 0 }],
      });
      let r = await manda(m, { testo: "{{last_input_text}}" });
      c(
        "numero in rubrica → registrata, riga «[messaggio senza testo]»",
        ["registrata", 1, "[messaggio senza testo]"],
        [r.esito, m.db.messaggi.length, m.db.messaggi[0]?.body],
      );
      c(
        "…+1 non letto, anteprima «Messaggio non leggibile», in «Da rispondere»",
        [1, "Messaggio non leggibile", true],
        [riga(m)?.unread_count, riga(m)?.ultimo_in_entrata_anteprima, inAttesa(riga(m))],
      );

      //  Abbinato a un invio (anche se il numero non è in rubrica): si prosegue.
      m = mondo({ invii: [invioConferma()], schede: [scheda()] });
      r = await manda(m, { testo: "{{last_input_text}}", crmInvioId: U_INVIO });
      c(
        "abbinato a un invio → si prosegue: riga «[messaggio senza testo]» e ora della risposta",
        [true, 1, "[messaggio senza testo]", [U_INVIO]],
        [
          r.esito !== "segnaposto",
          m.db.messaggi.length,
          m.db.messaggi[0]?.body,
          m.rispostaLog.map((x) => x.invioId),
        ],
      );

      //  R4b: il segnaposto non arriva da NESSUNA parte, nemmeno alla conferma o alla scheda.
      m = mondo({ invii: [invioConferma()], schede: [scheda()] });
      r = await manda(m, { testo: "{{last_input_text}}", crmInvioId: U_INVIO });
      const tutto = JSON.stringify([
        m.db.messaggi,
        m.db.contatti,
        m.db.rpc,
        m.schede,
        m.rpcPromemoria,
        m.scritture,
        m.avvisi,
        warn,
      ]);
      c("il segnaposto non compare in nessuna scrittura né avviso", false, tutto.includes("{{"));
      c(
        "…il promemoria non è confermato e il numero non è in STOP",
        [undefined, undefined],
        [m.schede[0].data.promemoria.confermatoIl, riga(m)?.non_scrivere_dal],
      );
      c(
        "…la scheda diventa «Ha risposto» con un'anteprima vuota (testo vuoto a dopoRisposta)",
        ["ha_risposto", ""],
        [
          m.schede[0].data.contattoWa?.stato,
          m.schede[0].data.contattoWa?.storia?.[0]?.anteprima ?? "",
        ],
      );

      //  Il segnaposto non entra nell'impronta: due segnaposto diversi nello stesso minuto sono lo stesso messaggio.
      m = mondo({ contatti: [{ user_id: U, phone_e164: `+${TEL}`, lead_id: null }] });
      await manda(m, { testo: "{{a}}" });
      r = await manda(m, { testo: "{{b}}" });
      c(
        "due segnaposto diversi nello stesso minuto → un solo messaggio (doppione)",
        ["doppione", 1],
        [r.esito, m.db.messaggi.length],
      );
    }

    /* ════════════════════════════════════════════════════════════════════
     *  3 · L'OROLOGIO È QUELLO DEL DATABASE (R3)
     * ════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · ENTRATA · UN SOLO OROLOGIO (quello del database)");
    {
      const m = mondo();
      const T = m.db.ora;
      await manda(m, { testo: "prima domanda" }, ADESSO);
      c("il primo messaggio mette la chat in «Da rispondere»", true, inAttesa(riga(m)));
      //  La risposta del CRM, 10 s dopo (orologio del database).
      m.db.ora = T + 10e3;
      await globalThis.__chatEntrataSupabase.rpc("whatsapp_segna_risposto", {
        p_user_id: U,
        p_phone: `+${TEL}`,
      });
      c("dopo la risposta del CRM esce da «Da rispondere»", false, inAttesa(riga(m)));
      //  Il cliente riscrive 1 s dopo, ma l'orologio del Worker è INDIETRO di 5 s.
      m.db.ora = T + 11e3;
      const workerIndietro = new Date(T + 11e3 - 5e3);
      await manda(m, { testo: "seconda domanda" }, workerIndietro);
      c(
        "cliente che riscrive 1 s dopo con il Worker indietro di 5 s → rientra",
        true,
        inAttesa(riga(m)),
      );
      c(
        "…l'orario d'entrata è quello del database, non quello del Worker",
        [new Date(T + 11e3).toISOString(), 2],
        [riga(m)?.ultimo_in_entrata_il, riga(m)?.unread_count],
      );
      c(
        "…il Worker manda la sua ora solo come ripiego (p_il), senza decidere niente",
        workerIndietro.toISOString(),
        m.db.rpc[m.db.rpc.length - 1].args.p_il,
      );
    }

    /* ════════════════════════════════════════════════════════════════════
     *  4 · VOCALE, NOME, SÌ AL PROMEMORIA, LOG
     * ════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · ENTRATA · VOCALE, NOME, CONFERMA E LOG");
    {
      //  Vocale: nella riga resta l'URL, all'elenco arriva «🎤 Vocale».
      let m = mondo();
      await manda(m, { testo: VOCALE });
      c(
        "vocale (URL manybot-files .ogg) → riga col testo URL e anteprima «🎤 Vocale» passata alla porta",
        [VOCALE, "🎤 Vocale", "🎤 Vocale"],
        [m.db.messaggi[0]?.body, m.chiamate[0]?.anteprima, riga(m)?.ultimo_in_entrata_anteprima],
      );
      //  Testo normale: l'anteprima è il testo (≤ 100 caratteri).
      m = mondo();
      await manda(m, { testo: "x".repeat(300) });
      c(
        "testo di 300 caratteri → anteprima di 100 + «…»",
        101,
        [...m.chiamate[0].anteprima].length,
      );

      //  Gli argomenti di `aggiornaContatto`: subscriber e nome.
      m = mondo();
      await manda(m, { nome: NOME });
      c(
        "il nome del cliente e il subscriber arrivano alla porta e alla riga",
        [NOME, SUB, NOME, SUB],
        [
          m.chiamate[0].nome,
          m.chiamate[0].subscriberId,
          riga(m)?.display_name,
          riga(m)?.subscriber_id,
        ],
      );
      m = mondo();
      await manda(m, { subscriberId: "" });
      c(
        "senza nome né subscriber → null alla porta",
        [null, null],
        [m.chiamate[0].nome, m.chiamate[0].subscriberId],
      );
      m = mondo({
        contatti: [
          {
            user_id: U,
            phone_e164: `+${TEL}`,
            display_name: "Nome della rubrica",
            unread_count: 0,
          },
        ],
      });
      await manda(m, { nome: NOME });
      c(
        "il nome del messaggio non sovrascrive quello già in rubrica",
        "Nome della rubrica",
        riga(m)?.display_name,
      );

      //  SÌ a un promemoria da un numero in rubrica: ancora confermato.
      m = mondo({
        invii: [invioConferma()],
        schede: [scheda()],
        contatti: [{ user_id: U, phone_e164: `+${TEL}`, lead_id: U_LEAD, unread_count: 0 }],
      });
      const r = await manda(m, { testo: "Sì", crmInvioId: U_INVIO });
      c(
        "SÌ a un promemoria da un numero in rubrica → ancora confermato",
        ["confermato", ADESSO.toISOString(), 1],
        [r.esito, m.schede[0].data.promemoria.confermatoIl, riga(m)?.unread_count],
      );
    }

    /* ── nei log solo codici ─────────────────────────────────────────── */
    gruppo("CHAT WHATSAPP · ENTRATA · NEI LOG SOLO CODICI");
    {
      const SEGRETO = "testo riservato del cliente";
      const nessunDato = (righe) => {
        const t = righe.join("|");
        return !(
          t.includes(TEL) ||
          t.includes(NOME) ||
          t.includes("manybot") ||
          t.includes(SEGRETO) ||
          t.includes(SUB)
        );
      };
      //  a) La porta del contatto lancia con dati dentro il messaggio.
      let m = mondo({ guastoContatto: true });
      let r = await manda(m, { testo: VOCALE + " " + SEGRETO, nome: NOME });
      c(
        "porta che lancia con dati nel messaggio → esito errore, avviso col solo codice",
        ["errore", true, true],
        [r.esito, /XX009/.test(m.avvisi.join("|")), nessunDato([...m.avvisi, ...warn])],
      );
      //  b) La funzione SQL dà errore (con dati nel messaggio): passa dalla porta VERA.
      m = mondo({ erroreRpc: { code: "XX000", message: `boom ${TEL} ${NOME} ${SEGRETO}` } });
      r = await manda(m, { testo: SEGRETO, nome: NOME });
      c(
        "errore della funzione SQL → esito errore, nei log solo il codice",
        ["errore", true, true],
        [r.esito, /XX000/.test(m.avvisi.join("|")), nessunDato([...m.avvisi, ...warn])],
      );
      //  c) Il ripiego pre-migrazione: l'avviso ha il codice, mai dati.
      m = mondo({
        erroreRpc: { code: "42883", message: `function ${TEL} ${NOME} ${SEGRETO}` },
        senzaColonne: true,
      });
      r = await manda(m, { testo: SEGRETO, nome: NOME });
      c(
        "ripiego prima della migrazione → registrata, un avviso col codice e niente dati",
        ["registrata", true, true],
        [r.esito, warn.some((x) => x.includes("42883")), nessunDato([...m.avvisi, ...warn])],
      );
    }

    /* ════════════════════════════════════════════════════════════════════
     *  5 · porte.server VERO: la funzione c'è, la funzione manca, altro errore
     * ════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · ENTRATA · aggiornaContatto (porta vera, database finto)");
    {
      const x = (o = {}) => ({
        telefono: TEL,
        leadId: null,
        adesso: ADESSO,
        anteprima: "Ciao",
        subscriberId: SUB,
        nome: NOME,
        ...o,
      });

      //  a) La funzione c'è: una chiamata, nessuna scrittura diretta.
      let { PS, st } = carica();
      await PS.porteRisposta().aggiornaContatto(U, x({ leadId: U_LEAD }));
      c(
        "funzione presente → 1 chiamata con i parametri del piano, nessuna scrittura diretta",
        [
          [
            {
              fn: "whatsapp_registra_entrata",
              args: {
                p_user_id: U,
                p_phone: `+${TEL}`,
                p_lead_id: U_LEAD,
                p_il: ADESSO.toISOString(),
                p_anteprima: "Ciao",
                p_subscriber_id: SUB,
                p_nome: NOME,
              },
            },
          ],
          0,
          0,
        ],
        [st.rpc, st.scritture, warn.length],
      );
      //  anche senza subscriber e nome: null, non stringa vuota
      ({ PS, st } = carica());
      await PS.porteRisposta().aggiornaContatto(U, x({ subscriberId: null, nome: null }));
      c(
        "senza subscriber né nome → null alla funzione",
        [null, null],
        [st.rpc[0].args.p_subscriber_id, st.rpc[0].args.p_nome],
      );

      //  b) La funzione manca (prima della migrazione): ripiego con +1.
      for (const codice of ["42883", "PGRST202", "42703", "PGRST204"]) {
        ({ PS, st } = carica({
          erroreRpc: { code: codice, message: `dato ${TEL}` },
          senzaColonne: true,
          contatti: [{ user_id: U, phone_e164: TEL, unread_count: 4, lead_id: null }],
        }));
        let lanciato = null;
        try {
          await PS.porteRisposta().aggiornaContatto(U, x({ leadId: U_LEAD }));
        } catch (e) {
          lanciato = e;
        }
        c(
          `funzione assente (${codice}) → non lancia, riga vecchia (senza «+») 4 → 5, ora e scheda`,
          [null, 1, 5, ADESSO.toISOString(), U_LEAD],
          [
            lanciato,
            st.contatti.length,
            st.contatti[0].unread_count,
            st.contatti[0].last_message_at,
            st.contatti[0].lead_id,
          ],
        );
        c(
          `funzione assente (${codice}) → nessuna colonna nuova scritta`,
          true,
          !("ultimo_in_entrata_il" in st.contatti[0]) && !("subscriber_id" in st.contatti[0]),
        );
      }
      //  senza riga: la crea con 1 (come il webhook), formato col «+»
      ({ PS, st } = carica({ erroreRpc: { code: "42883", message: "x" }, senzaColonne: true }));
      await PS.porteRisposta().aggiornaContatto(U, x());
      c(
        "funzione assente e numero nuovo → riga creata col «+» e 1 non letto",
        [1, `+${TEL}`, 1],
        [st.contatti.length, st.contatti[0]?.phone_e164, st.contatti[0]?.unread_count],
      );
      //  un solo avviso per processo (non uno per messaggio), col solo codice
      ({ PS, st } = carica({
        erroreRpc: { code: "42883", message: `dato ${TEL} ${NOME}` },
        senzaColonne: true,
      }));
      for (let i = 0; i < 3; i++) await PS.porteRisposta().aggiornaContatto(U, x());
      c(
        "tre messaggi prima della migrazione → un solo avviso, col codice e senza dati, 3 non letti",
        [1, true, true, 3],
        [
          warn.length,
          warn[0]?.includes("42883"),
          !warn.join("|").includes(TEL) && !warn.join("|").includes(NOME),
          st.contatti[0].unread_count,
        ],
      );

      //  c) Un altro errore: lancia SOLO il codice, e non ripiega.
      ({ PS, st } = carica({
        erroreRpc: { code: "XX000", message: `dato ${TEL} ${NOME}` },
        contatti: [{ user_id: U, phone_e164: `+${TEL}`, unread_count: 4 }],
      }));
      let lanciato = null;
      try {
        await PS.porteRisposta().aggiornaContatto(U, x());
      } catch (e) {
        lanciato = e;
      }
      c(
        "altro errore → lancia solo {code}, nessun ripiego, nessuna scrittura, nessun avviso",
        [{ code: "XX000" }, 0, 4, 0],
        [lanciato, st.scritture, st.contatti[0].unread_count, warn.length],
      );
    }

    /* ════════════════════════════════════════════════════════════════════
     *  6 · `leggiCorpo` e il nome (D9)
     * ════════════════════════════════════════════════════════════════════ */
    gruppo("CHAT WHATSAPP · ENTRATA · IL NOME DEL CLIENTE (leggiCorpo)");
    {
      c("nome normale → passa", NOME, RT.leggiCorpo({ nome: NOME }).nome);
      c("nome di 500 caratteri → 80", 80, RT.leggiCorpo({ nome: "n".repeat(500) }).nome.length);
      c(
        "il taglio del nome non spezza una emoji a metà",
        "n".repeat(79),
        RT.leggiCorpo({ nome: "n".repeat(79) + "😀" }).nome,
      );
      c(
        "nome oggetto, booleano, vuoto o assente → vuoto",
        [true, true, true, true],
        [{ a: 1 }, true, "", undefined].map((v) => !RT.leggiCorpo({ nome: v }).nome),
      );
      c(
        "segnaposto non risolto come nome ({{first_name}}) → vuoto",
        [true, true],
        ["{{first_name}}", "Anna {{last_name}}"].map((v) => !RT.leggiCorpo({ nome: v }).nome),
      );
      c("spazi attorno al nome → tolti", NOME, RT.leggiCorpo({ nome: `  ${NOME} ` }).nome);
    }

    c("in tutte le prove: nessuna chiamata esterna", 0, chiamateEsterne);
  } finally {
    console.warn = avvisoOriginale;
    globalThis.fetch = fetchVero;
    rmSync(dir, { recursive: true, force: true });
    delete globalThis.__chatEntrata;
    delete globalThis.__chatEntrataSupabase;
  }
}
