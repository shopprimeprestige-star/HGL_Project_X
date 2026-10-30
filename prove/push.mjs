/** ── PROVE: LA NOTIFICA PUSH QUANDO UN LEAD RISPONDE (p2-push-risposte) ─────
 *
 *  Commessa 2026-10-30-ottimizzazioni, pacchetto p2. Il telefono suona per
 *  ogni messaggio in entrata VERO (ManyChat, webhook di Meta, ponte vivo), mai
 *  per eco, doppioni o storico; lo riceve il consulente del lead e il titolare.
 *  Lo stesso messaggio arrivato da due strade (ManyChat e ponte) suona una
 *  volta sola: la porta `push_avviso_porta` lascia passare un avviso per numero
 *  ogni `FINESTRA_AVVISO_S` secondi.
 *
 *  Dati inventati: nessun numero né nome vero.
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const UTENTE = "00000000-0000-4000-8000-000000000001";
const NUM = "393331234567";
const ALTRO = "393339876543";

/** Le iscrizioni di prova: il titolare (senza consulente), due consulenti. */
const TITOLARE = { id: "i-tit", consulente_id: null };
const C1 = { id: "i-c1", consulente_id: "cons-1" };
const C2 = { id: "i-c2", consulente_id: "cons-2" };

function porteAvvisoFinte(o = {}) {
  const ch = { porta: [], scheda: [], invia: [] };
  const porte = {
    acceso: () => o.acceso ?? true,
    porta: async (u, chiave) => {
      ch.porta.push({ u, chiave });
      if (o.porta === "rotta") throw { code: "PGRST202" };
      return o.porta ?? true;
    },
    scheda: async (u, leadId, telefono) => {
      ch.scheda.push({ u, leadId, telefono });
      if (o.scheda === "rotta") throw { code: "XX000" };
      return o.scheda ?? null;
    },
    iscrizioni: async () => o.iscrizioni ?? [TITOLARE, C1, C2],
    invia: async (u, avviso, lista) => {
      ch.invia.push({ u, avviso, ids: lista.map((i) => i.id) });
      if (o.invia === "rotta") throw new Error("rete");
    },
  };
  return { porte, ch };
}

async function proveDelloSmistamento(mod, { c, gruppo }) {
  gruppo("PUSH RISPOSTE · A CHI ARRIVA E QUANTE VOLTE");
  const A = mod["push/avviso"];
  const T = mod["ponte/tipi"];
  c(
    "la finestra della porta è quella del pari del ponte (180 s)",
    [180, T.FINESTRA_PARI_S],
    [A.FINESTRA_AVVISO_S, 180],
  );

  const ids = (l) => l.map((i) => i.id);
  c(
    "destinatari: titolare e consulente del lead, non gli altri",
    ["i-tit", "i-c1"],
    ids(A.destinatari([TITOLARE, C1, C2], "cons-1")),
  );
  c(
    "destinatari: lead senza consulente → solo il titolare",
    ["i-tit"],
    ids(A.destinatari([TITOLARE, C1, C2], null)),
  );
  c(
    "destinatari: consulente_id vuoto vale come titolare",
    ["x"],
    ids(A.destinatari([{ id: "x", consulente_id: "" }, C2], undefined)),
  );

  let f = porteAvvisoFinte({ scheda: { nome: "Mario Esempio", consulenteId: "cons-1" } });
  let esito = await A.avvisaRisposta(f.porte, {
    userId: UTENTE,
    telefono: `+${NUM}`,
    leadId: "lead-1",
    nomeProfilo: "Mario WA",
  });
  c(
    "con la scheda: inviato a titolare + consulente del lead",
    ["inviato", ["i-tit", "i-c1"]],
    [esito, f.ch.invia[0]?.ids],
  );
  c(
    "…col nome della scheda, mai il testo",
    "Mario Esempio ti ha scritto",
    f.ch.invia[0]?.avviso.corpo,
  );
  c(
    "…la porta è chiesta con la chiave del numero (ultime 9 cifre)",
    [{ u: UTENTE, chiave: "331234567" }],
    f.ch.porta,
  );
  c(
    "…la scheda si cerca con lead e telefono",
    [{ u: UTENTE, leadId: "lead-1", telefono: `+${NUM}` }],
    f.ch.scheda,
  );

  f = porteAvvisoFinte();
  esito = await A.avvisaRisposta(f.porte, {
    userId: UTENTE,
    telefono: NUM,
    nomeProfilo: "Mario WA",
  });
  c(
    "senza scheda: solo il titolare, col nome del profilo",
    ["inviato", ["i-tit"], "Mario WA ti ha scritto"],
    [esito, f.ch.invia[0]?.ids, f.ch.invia[0]?.avviso.corpo],
  );
  c("senza leadId la scheda si cerca col solo telefono", null, f.ch.scheda[0]?.leadId);

  f = porteAvvisoFinte({ porta: false });
  esito = await A.avvisaRisposta(f.porte, { userId: UTENTE, telefono: NUM });
  c(
    "porta chiusa (già avvisato da poco per questo numero): nessun invio",
    ["gia_avvisato", 0],
    [esito, f.ch.invia.length],
  );

  f = porteAvvisoFinte({ porta: "rotta" });
  esito = await A.avvisaRisposta(f.porte, { userId: UTENTE, telefono: NUM });
  c(
    "porta guasta (migrazione non applicata): si avvisa comunque",
    ["inviato", 1],
    [esito, f.ch.invia.length],
  );

  f = porteAvvisoFinte({ scheda: "rotta" });
  esito = await A.avvisaRisposta(f.porte, { userId: UTENTE, telefono: NUM });
  c(
    "lettura della scheda guasta: si avvisa il titolare",
    ["inviato", ["i-tit"]],
    [esito, f.ch.invia[0]?.ids],
  );

  f = porteAvvisoFinte({ acceso: false });
  esito = await A.avvisaRisposta(f.porte, { userId: UTENTE, telefono: NUM });
  c(
    "senza chiavi VAPID: niente, nemmeno la porta",
    ["spento", 0, 0],
    [esito, f.ch.porta.length, f.ch.invia.length],
  );

  f = porteAvvisoFinte({ iscrizioni: [C2] });
  esito = await A.avvisaRisposta(f.porte, { userId: UTENTE, telefono: NUM });
  c("nessun destinatario iscritto: nessun invio", ["nessuno", 0], [esito, f.ch.invia.length]);

  f = porteAvvisoFinte({ invia: "rotta" });
  let lanciato = false;
  try {
    esito = await A.avvisaRisposta(f.porte, { userId: UTENTE, telefono: NUM });
  } catch {
    lanciato = true;
  }
  c(
    "un invio guasto non lancia mai (il messaggio in arrivo non si perde)",
    [false, "errore"],
    [lanciato, esito],
  );
}

/** Le porte del ponte, ridotte a quello che serve qui: un database in memoria
 *  che fa quello che promette `ponte_wa_scrivi` (nuovi / già presenti). */
function porteDelPonte(P, o = {}) {
  const scritti = new Set();
  return {
    utente: async () => UTENTE,
    candidati: async (_u, righe) => {
      const out = [];
      for (const r of righe)
        for (const x of o.crm ?? []) if (P.ammessoCome(x, r)) out.push({ k: r.k, ...x });
      return out;
    },
    scrivi: async (_u, s) => {
      const e = {
        nuovi: 0,
        gia_presenti: 0,
        doppioni: 0,
        pari_persi: 0,
        contatti_nuovi: 0,
        risposto: 0,
      };
      const pari = new Set(s.pari.map((p) => p.k));
      for (const r of s.righe) {
        if (scritti.has(r.k)) e.gia_presenti++;
        else {
          scritti.add(r.k);
          e.nuovi++;
          if (pari.has(r.k)) e.doppioni++;
        }
      }
      return e;
    },
    //  30/10 «tutte le chat»: la promozione c'è (non fa niente qui) e `noti` non esiste più.
    promuovi: async () => ({ promosse: 0, saltate: 0 }),
    recentiDelPonte: async () => [],
    battito: async () => undefined,
    avviso: () => undefined,
  };
}

async function proveDelPonteVivo(mod, { c, gruppo }) {
  gruppo("PUSH RISPOSTE · IL PONTE: SOLO I MESSAGGI VIVI E NUOVI");
  const I = mod["ponte/ingresso"];
  const P = mod["ponte/pari"];
  const SEGRETO = "s".repeat(32);
  const ADESSO = new Date("2026-10-30T12:00:00Z");
  const ORA = Math.floor(ADESSO.getTime() / 1000);
  const msg = (x = {}) => ({
    id: "3EB0A1",
    numero: NUM,
    dir: "in",
    ts: ORA - 40,
    testo: "Ciao",
    tipo: "testo",
    ...x,
  });
  const lotto = (messaggi, x = {}) => ({ v: 1, tipo: "lotto", origine: "vivo", messaggi, ...x });
  const richiesta = (corpo) =>
    new Request("https://esempio.invalid/api/public/ponte-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-HGL-Token": SEGRETO },
      body: JSON.stringify(corpo),
    });
  /** Manda un lotto con le porte date e restituisce gli avvisi chiesti. */
  const manda = async (porte, corpo, o = {}) => {
    const avvisi = [];
    const r = await I.gestisciRichiesta(porte, {
      request: richiesta(corpo),
      segreto: SEGRETO,
      adesso: ADESSO,
      avvisa: async (u, entrate) => {
        avvisi.push({ u, entrate });
        if (o.rompi) throw new Error("rete");
      },
    });
    return { stato: r.status, avvisi };
  };

  let porte = porteDelPonte(P);
  let r = await manda(porte, lotto([msg()], { nomi: { [NUM]: "Mario WA" } }));
  c(
    "un'entrata viva e nuova, senza pari: si avvisa (numero e nome del profilo)",
    [200, [{ u: UTENTE, entrate: [{ numero: NUM, nome: "Mario WA" }] }]],
    [r.stato, r.avvisi],
  );
  r = await manda(porte, lotto([msg()]));
  c(
    "lo stesso lotto rimandato (già presente): nessun avviso",
    [200, 0],
    [r.stato, r.avvisi.length],
  );

  r = await manda(porteDelPonte(P), lotto([msg()], { origine: "storico" }));
  c("lo storico non avvisa mai", [200, 0], [r.stato, r.avvisi.length]);

  r = await manda(porteDelPonte(P), lotto([msg({ dir: "out" })]));
  c("un messaggio in uscita non avvisa", 0, r.avvisi.length);

  //  30/10, decisione del titolare («push anche per sconosciuti»): D7 tolta, un numero che il CRM
  //  non conosce entra come ogni altro e la notifica parte (col numero, come ManyChat per i nuovi).
  r = await manda(porteDelPonte(P), lotto([msg({ numero: "393330000777" })]));
  c("un numero che il CRM non conosce avvisa come gli altri (e ora entra)", [200, [{ u: UTENTE, entrate: [{ numero: "393330000777", nome: null }] }]], [r.stato, r.avvisi]);

  //  La riga ManyChat dello stesso messaggio, 20 s prima: il ponte la riconosce come pari.
  const crm = [
    {
      id: "c-1",
      created_at: new Date((ORA - 60) * 1000).toISOString(),
      direction: "inbound",
      body: "Ciao",
      canale: "manychat",
      numero: NUM,
    },
  ];
  r = await manda(
    porteDelPonte(P, { crm: crm.map(({ numero, ...x }) => ({ ...x, from_number: `+${numero}` })) }),
    lotto([msg()]),
  );
  c("il doppione di un messaggio ManyChat (pari) non avvisa di nuovo", 0, r.avvisi.length);

  r = await manda(
    porteDelPonte(P),
    lotto([msg(), msg({ id: "3EB0A2", testo: "ci sei?" }), msg({ id: "3EB0A3", numero: ALTRO })]),
  );
  c(
    "più messaggi dello stesso numero: una voce per numero",
    [NUM, ALTRO],
    r.avvisi[0]?.entrate.map((e) => e.numero).sort((a, b) => (a === NUM ? -1 : b === NUM ? 1 : 0)),
  );
  c(
    "senza nome nel lotto: nome null",
    [null, null],
    r.avvisi[0]?.entrate.map((e) => e.nome),
  );

  const tanti = Array.from({ length: 14 }, (_, i) =>
    msg({ id: `M${i}`, numero: `39333000${String(i).padStart(4, "0")}` }),
  );
  r = await manda(porteDelPonte(P), lotto(tanti));
  c(
    "un lotto con tanti numeri avvisa al più AVVISI_PER_LOTTO numeri",
    [10, I.AVVISI_PER_LOTTO],
    [r.avvisi[0]?.entrate.length, 10],
  );

  r = await manda(porteDelPonte(P), lotto([msg()]), { rompi: true });
  c("un avviso guasto non cambia la risposta al Mac (200: il lotto è scritto)", 200, r.stato);

  const senza = await I.gestisciRichiesta(porteDelPonte(P), {
    request: richiesta(lotto([msg()])),
    segreto: SEGRETO,
    adesso: ADESSO,
  });
  c("senza `avvisa` la rotta funziona come prima", 200, senza.status);
}

/** ManyChat con un registro in memoria: quando parte `avvisaNuovo`. */
async function proveDiManychat(mod, { c, gruppo }) {
  gruppo("PUSH RISPOSTE · MANYCHAT: MAI PER ECO, DOPPIONI, SEGNAPOSTO");
  const RS = mod["manychat/risposta"];
  const righe = [];
  const avvisi = [];
  const porte = {
    avviso: () => undefined,
    utente: async () => ({ userId: UTENTE }),
    invii: async () => [],
    contattoNoto: async (_u, tel) =>
      righe.some((r) => r.telefono === tel) ? { leadId: "lead-1" } : null,
    ultimeEntrate: async (_u, tel) =>
      righe
        .filter((r) => r.telefono === tel)
        .reverse()
        .slice(0, 5)
        .map((r) => ({ testo: r.testo, il: r.adesso, media: null })),
    registraMessaggio: async (_u, m) => {
      if (righe.some((r) => r.waId === m.waId)) return "doppione";
      righe.push(m);
      return "nuovo";
    },
    aggiornaContatto: async () => undefined,
    avvisaNuovo: async (_u, x) => {
      avvisi.push(x);
    },
    conferma: () => ({
      schedeConMessaggio: async () => [],
      aggiorna: async () => ({ error: null }),
      segnaStop: async () => ({ error: null }),
      avviso: () => undefined,
    }),
    rispostaArrivata: async () => undefined,
    contattoDi: async () => null,
    scriviContatto: async () => false,
  };
  const manda = (testo, iso, tel = NUM) =>
    RS.gestisciRisposta(porte, {
      chiaveOk: true,
      segretoPresente: true,
      corpo: {
        crmInvioId: "",
        crmLeadId: "",
        subscriberId: "1000001",
        telefono: tel,
        testo,
        nome: "Mario WA",
      },
      adesso: new Date(iso),
    });
  let e = await manda("Buongiorno, mi interessa", "2026-10-30T10:00:05Z");
  c("un messaggio nuovo: una notifica", ["registrata", 1], [e.esito, avvisi.length]);
  e = await manda("Buongiorno, mi interessa", "2026-10-30T10:00:30Z");
  c(
    "lo stesso messaggio nello stesso minuto (doppione): niente",
    ["doppione", 1],
    [e.esito, avvisi.length],
  );
  e = await manda("Buongiorno, mi interessa", "2026-10-30T12:00:00Z");
  c(
    "lo stesso testo ore dopo (eco del Default Reply): niente",
    ["eco", 1],
    [e.esito, avvisi.length],
  );
  e = await manda("{{Last Text Input}}", "2026-10-30T12:01:00Z", ALTRO);
  c(
    "solo segnaposto da un numero sconosciuto: niente",
    ["segnaposto", 1],
    [e.esito, avvisi.length],
  );
  e = await manda("A che ora domani?", "2026-10-30T12:02:00Z");
  c(
    "una risposta nuova vera: un'altra notifica, col lead",
    ["registrata", 2, "lead-1"],
    [e.esito, avvisi.length, avvisi[1]?.leadId],
  );
}

function proveDelCablaggio({ c, gruppo, radice }) {
  gruppo("PUSH RISPOSTE · I COLLEGAMENTI");
  const leggi = (p) => readFileSync(join(radice, p), "utf8");
  const ris = leggi("src/crm/manychat/risposta.ts");
  const posEco = ris.indexOf("if (eco) return eco;");
  const posDopp = ris.indexOf('if (scritto === "doppione") return "doppione";');
  const posSegn = ris.indexOf('if (soloSegnaposto && sconosciuto) return "segnaposto";');
  const posAvv = ris.indexOf(".avvisaNuovo?.(");
  c(
    "ManyChat: eco, doppione e segnaposto escono PRIMA della notifica",
    true,
    posEco > 0 && posDopp > 0 && posSegn > 0 && posAvv > Math.max(posEco, posDopp, posSegn),
  );

  const inv = leggi("src/crm/push/invio.server.ts");
  c(
    "avvisaMessaggioWhatsapp passa da avvisaRisposta (porta + destinatari)",
    true,
    /avvisaRisposta\(/.test(inv) && /push_avviso_porta/.test(inv) && /FINESTRA_AVVISO_S/.test(inv),
  );
  c(
    "il consulente del lead si legge dalla scheda (data.consulenteId) con user_id nel filtro",
    true,
    /consulenteId/.test(inv) &&
      /\.from\("crm_leads"\)[\s\S]{0,200}\.eq\("user_id", userId\)/.test(inv),
  );
  c(
    "senza leadId il lead si cerca nella rubrica WhatsApp",
    true,
    /\.from\("whatsapp_contacts"\)[\s\S]{0,200}lead_id/.test(inv),
  );
  c("nei log del push solo codici", false, /console\.\w+\([^)]*(telefono|nome|leadId)/.test(inv));

  const rotta = leggi("src/routes/api.public.ponte-whatsapp.ts");
  c(
    "la rotta del ponte passa `avvisa` (notifica dei vivi)",
    true,
    /avvisa:\s*avvisaEntratePonte/.test(rotta),
  );
  const hook = leggi("src/routes/api.public.whatsapp-webhook.ts");
  c(
    "webhook di Meta: avvisa ancora solo se il messaggio è nuovo",
    true,
    /if \(!nuovo\.error\)\s*await avvisaMessaggioWhatsapp/.test(hook),
  );

  const FILE = "supabase/migrations/20261030120200_p2_push_risposte.sql";
  c("la migrazione nuova esiste", true, existsSync(join(radice, FILE)));
  if (!existsSync(join(radice, FILE))) return;
  const grezzo = leggi(FILE);
  const sql = grezzo.replace(/--.*$/gm, "");
  c(
    "solo aggiuntiva: niente DROP, DELETE, TRUNCATE, ALTER … DROP",
    false,
    /\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i.test(sql),
  );
  c(
    "la tabella, solo se manca, con chiave (user_id, chiave)",
    true,
    /CREATE TABLE IF NOT EXISTS public\.push_avvisi_recenti/.test(sql) &&
      /PRIMARY KEY \(user_id, chiave\)/.test(sql),
  );
  c(
    "tabella solo del server (RLS senza politiche, REVOKE)",
    true,
    /ALTER TABLE public\.push_avvisi_recenti ENABLE ROW LEVEL SECURITY/.test(sql) &&
      !/CREATE POLICY/.test(sql) &&
      /REVOKE ALL ON public\.push_avvisi_recenti FROM anon, authenticated/.test(sql),
  );
  c(
    "la porta: un solo comando atomico (INSERT … ON CONFLICT … WHERE)",
    true,
    /CREATE OR REPLACE FUNCTION public\.push_avviso_porta\(p_user_id uuid, p_chiave text, p_finestra_s integer\)/.test(
      sql,
    ) &&
      /ON CONFLICT \(user_id, chiave\) DO UPDATE/.test(sql) &&
      /RETURNING/.test(sql),
  );
  c(
    "SECURITY DEFINER con search_path fisso",
    true,
    /SECURITY DEFINER SET search_path = public/.test(sql),
  );
  c(
    "solo la chiave di servizio la chiama",
    true,
    /REVOKE ALL ON FUNCTION public\.push_avviso_porta\(uuid, text, integer\) FROM PUBLIC, anon, authenticated;/.test(
      sql,
    ) &&
      /GRANT EXECUTE ON FUNCTION public\.push_avviso_porta\(uuid, text, integer\) TO service_role;/.test(
        sql,
      ),
  );
  c(
    "come si annulla: scritto nel commento",
    true,
    /COME SI ANNULLA/i.test(grezzo) && /DROP FUNCTION public\.push_avviso_porta/.test(grezzo),
  );
}

export async function provePushRisposte(mod, aiuti) {
  await proveDelloSmistamento(mod, aiuti);
  await proveDelPonteVivo(mod, aiuti);
  await proveDiManychat(mod, aiuti);
  proveDelCablaggio(aiuti);
}
