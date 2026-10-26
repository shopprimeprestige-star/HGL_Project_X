/** ── PROVE: IL CLIENT DI MANYCHAT ──────────────────────────────────────────
 *
 *  File d'area della commessa 2026-10-23 (ManyChat), compito U1 (Dev B). Si
 *  collega da `prove/manychat.mjs`. Tutto contro il ManyChat finto
 *  (`finto.mjs`): nessuna chiamata vera, chiave e numeri inventati.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (chiave
 *  `"manychat/<nome>"`). `aiuti`: `{ c, gruppo, radice }` (`c(nome, atteso,
 *  letto)`).
 *
 *  ⚠️ I testi d'errore del finto sono INVENTATI: il client classifica per
 *   stato HTTP e forma, e qui lo si prova cambiando il testo a parità di forma. */
import { creaFinto, esiti, PERCORSI } from "./finto.mjs";

const CHIAVE = "chiave-finta-0000";
const CIFRE = "393331234567";

/** Un finto con il campo `crm_telefono` presente (serve il suo id per cercare). */
function finto() {
  return creaFinto().su(
    "GET",
    PERCORSI.campi,
    esiti.successo([
      { id: 501, name: "crm_telefono", type: "text" },
      { id: 502, name: "crm_v1", type: "text" },
    ]),
  );
}

export async function proveApi(mod, { c, gruppo }) {
  const A = mod["manychat/api"];

  gruppo("MANYCHAT · IL CLIENT · fetch STACCATO (come sui Worker)");
  {
    //  Sui Worker `fetch` chiamato come metodo di un altro oggetto lancia
    //  «Illegal invocation»: questo fetch fa lo stesso se `this` non è vuoto.
    const opzioni = {
      chiave: CHIAVE,
      fetch: function (url) {
        if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
        return Promise.resolve({
          status: 200,
          json: async () => ({ status: "success", data: { id: 1, name: "Pagina", is_pro: true } }),
        });
      },
    };
    const r = await A.creaClient(opzioni).chiSei();
    c("chiSei con un fetch che vuole `this` vuoto: arriva a ManyChat", "ok", r.esito);
  }

  gruppo("MANYCHAT · IL CLIENT · LA CATENA DELL'INVIO");
  {
    //  Contatto trovato: la ricerca, poi campi, tag e sendFlow, IN QUEST'ORDINE.
    const f = finto();
    const k = A.creaClient({ chiave: CHIAVE, fetch: f.fetch });
    const t = await k.trovaContatto(CIFRE);
    c("trovato per il campo crm_telefono: ok col contatto", ["ok", 1000001], [t.esito, t.dati?.id]);
    const id = t.dati.id;
    await k.scriviCampi(id, { crm_v1: "Maria", crm_invio_id: "abc" });
    await k.aggiungiTag(id, "crm-promemoria");
    const s = await k.mandaFlusso(id, "content-finto-1");
    c("sendFlow accettato → ok", "ok", s.esito);
    c(
      "l'ordine: id del campo, ricerca, campi, tag, sendFlow",
      [PERCORSI.campi, PERCORSI.perCampo, PERCORSI.scriviCampi, PERCORSI.tag, PERCORSI.flusso],
      f.percorsi(),
    );
    const [, cerca, campi, tag, flusso] = f.chiamate;
    c(
      "la ricerca usa l'id del campo e le sole cifre",
      { field_id: "501", field_value: CIFRE },
      cerca.query,
    );
    c(
      "setCustomFields: subscriber_id intero e i campi per nome",
      {
        subscriber_id: 1000001,
        fields: [
          { field_name: "crm_v1", field_value: "Maria" },
          { field_name: "crm_invio_id", field_value: "abc" },
        ],
      },
      campi.corpo,
    );
    c("addTagByName", { subscriber_id: 1000001, tag_name: "crm-promemoria" }, tag.corpo);
    c("sendFlow", { subscriber_id: 1000001, flow_ns: "content-finto-1" }, flusso.corpo);
    c(
      "ogni chiamata porta la chiave nell'intestazione",
      true,
      f.chiamate.every((x) => x.intestazioni.authorization === `Bearer ${CHIAVE}`),
    );
    c(
      "…e l'id del campo si chiede una volta sola",
      1,
      f.percorsi().filter((p) => p === PERCORSI.campi).length,
    );
  }

  gruppo("MANYCHAT · IL CLIENT · CONTATTO ASSENTE");
  {
    //  Il campo non trova nessuno → il telefono di sistema → poi si crea.
    const f = finto()
      .scenario("assente")
      .su("GET", PERCORSI.campi, esiti.successo([{ id: 501, name: "crm_telefono", type: "text" }]));
    const k = A.creaClient({ chiave: CHIAVE, fetch: f.fetch });
    const t = await k.trovaContatto(CIFRE);
    c("assente: nessun contatto, ma esito ok", ["ok", null], [t.esito, t.dati]);
    c(
      "…cercato per campo e poi per telefono (con il +)",
      [PERCORSI.campi, PERCORSI.perCampo, PERCORSI.perSistema],
      f.percorsi(),
    );
    c("…e il telefono di sistema ha il +", { phone: `+${CIFRE}` }, f.chiamate[2].query);
    const n = await k.creaContatto("Maria Rossi", CIFRE);
    const corpo = f.chiamate.at(-1).corpo;
    c(
      "createSubscriber: il solo nome, il numero WhatsApp col +",
      { first_name: "Maria", whatsapp_phone: `+${CIFRE}` },
      corpo,
    );
    c("…mai il cognome, da nessuna parte", false, JSON.stringify(f.chiamate).includes("Rossi"));
    c("…creato: ok col contatto", ["ok", 1000001], [n.esito, n.dati?.id]);
    //  Non c'è il campo crm_telefono in ManyChat: salta il passo 2, non si rompe.
    const g = creaFinto().scenario("assente");
    const kg = A.creaClient({ chiave: CHIAVE, fetch: g.fetch });
    await kg.trovaContatto(CIFRE);
    c(
      "senza il campo crm_telefono si passa al telefono di sistema",
      [PERCORSI.campi, PERCORSI.perSistema],
      g.percorsi(),
    );
    //  Il telefono di sistema trova, il campo no.
    const h = finto().su("GET", PERCORSI.perCampo, esiti.successo([]));
    const kh = A.creaClient({ chiave: CHIAVE, fetch: h.fetch });
    c("campo vuoto, telefono di sistema trova", 1000001, (await kh.trovaContatto(CIFRE)).dati?.id);
    //  Creazione rifiutata (esiste già, permesso negato): rifiuto del contatto, non blocco.
    const r = creaFinto().su("POST", PERCORSI.crea, esiti.errore(400));
    const kr = A.creaClient({ chiave: CHIAVE, fetch: r.fetch });
    c(
      "creazione rifiutata (4xx) → rifiuto_contatto",
      "rifiuto_contatto",
      (await kr.creaContatto("Maria", CIFRE)).esito,
    );
    const r401 = creaFinto().su("POST", PERCORSI.crea, esiti.nonAutorizzato());
    c(
      "creazione con la chiave rifiutata → blocco",
      "blocco",
      (await A.creaClient({ chiave: CHIAVE, fetch: r401.fetch }).creaContatto("Maria", CIFRE))
        .esito,
    );
    for (const http of [403, 429]) {
      const rx = creaFinto().su("POST", PERCORSI.crea, esiti.errore(http));
      c(
        `creazione con ${http} → blocco (non «da collegare»: lo stato chiuso non riparte)`,
        "blocco",
        (await A.creaClient({ chiave: CHIAVE, fetch: rx.fetch }).creaContatto("Maria", CIFRE))
          .esito,
      );
    }
    const r500 = creaFinto().su("POST", PERCORSI.crea, esiti.errore500());
    const k5 = A.creaClient({ chiave: CHIAVE, fetch: r500.fetch });
    c(
      "creazione con 500 → incerto, una sola chiamata",
      ["incerto", 1],
      [(await k5.creaContatto("Maria", CIFRE)).esito, r500.chiamate.length],
    );
  }

  gruppo("MANYCHAT · IL CLIENT · ESITI: BLOCCO E INCERTO");
  {
    const prova = async (copione, nome, atteso) => {
      const f = creaFinto();
      copione(f);
      const k = A.creaClient({ chiave: CHIAVE, fetch: f.fetch, timeoutMs: 25 });
      const t0 = Date.now();
      const r = await k.mandaFlusso(1000001, "content-finto-1");
      c(`${nome}: ${atteso}`, atteso, r.esito);
      c(`${nome}: UNA sola chiamata, mai una seconda`, 1, f.chiamate.length);
      c(`${nome}: la chiave non compare nel risultato`, false, JSON.stringify(r).includes(CHIAVE));
      return Date.now() - t0;
    };
    await prova(
      (f) => f.su("POST", PERCORSI.flusso, esiti.nonAutorizzato()),
      "401 chiave rifiutata",
      "blocco",
    );
    await prova(
      (f) => f.su("POST", PERCORSI.flusso, esiti.modelloRifiutato()),
      "modello rifiutato (400)",
      "blocco",
    );
    await prova((f) => f.su("POST", PERCORSI.flusso, esiti.errore(429)), "429 limite", "blocco");
    await prova((f) => f.su("POST", PERCORSI.flusso, esiti.reteGiu()), "rete giù", "incerto");
    await prova((f) => f.su("POST", PERCORSI.flusso, esiti.errore500()), "500", "incerto");
    const ms = await prova(
      (f) => f.su("POST", PERCORSI.flusso, esiti.lento()),
      "lentezza oltre il tempo",
      "incerto",
    );
    c("…e l'attesa si ferma al tempo massimo (non resta appesa)", true, ms < 2000);
    c("il tempo massimo di serie è 8 secondi", 8000, A.TIMEOUT_CHIAMATA_MS);
    //  La chiamata lenta porta il segnale: è così che il client la interrompe.
    let segnale = null;
    const spia = async (url, init) => {
      segnale = init.signal ?? null;
      return new Response(JSON.stringify({ status: "success" }), { status: 200 });
    };
    await A.creaClient({ chiave: CHIAVE, fetch: spia }).mandaFlusso(1, "x");
    c("ogni chiamata passa un AbortSignal al fetch", true, segnale instanceof AbortSignal);
    //  Un fetch che lancia con la chiave nel messaggio: il risultato non la ripete.
    const indiscreto = async (url, init) => {
      throw new Error(`rete giù ${init.headers.Authorization}`);
    };
    const r = await A.creaClient({ chiave: CHIAVE, fetch: indiscreto }).mandaFlusso(1, "x");
    c(
      "un errore che porta la chiave non la ripete (nemmeno nel codice)",
      [false, "incerto"],
      [JSON.stringify(r).includes(CHIAVE), r.esito],
    );
    //  Corpo che non è JSON, con HTTP 200: non si sa com'è andata.
    const storto = async () => new Response("<html>", { status: 200 });
    c(
      "200 con un corpo che non è JSON → incerto",
      "incerto",
      (await A.creaClient({ chiave: CHIAVE, fetch: storto }).mandaFlusso(1, "x")).esito,
    );
    //  Più di 20 campi: ManyChat ne accetta 20, qui non si spezza la scrittura.
    const f20 = creaFinto();
    const venti = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`crm_${i}`, "x"]));
    c(
      "21 campi → blocco, senza chiamare",
      ["blocco", 0],
      [
        (await A.creaClient({ chiave: CHIAVE, fetch: f20.fetch }).scriviCampi(1, venti)).esito,
        f20.chiamate.length,
      ],
    );
  }

  gruppo("MANYCHAT · IL CLIENT · classifica() GUARDA STATO E FORMA, MAI IL TESTO");
  {
    const K = A.classifica;
    const ok = { status: "success", data: {} };
    const err = (message, extra = {}) => ({
      status: "error",
      message,
      details: { messages: [{ message }] },
      ...extra,
    });
    c("200 success → ok", "ok", K(200, ok));
    c("200 con errore dichiarato → blocco (non è partito)", "blocco", K(200, err("x")));
    c("200 con una forma sconosciuta → incerto", "incerto", K(200, { ciao: 1 }));
    c("200 senza corpo → incerto", "incerto", K(200, null));
    c("401 → blocco", "blocco", K(401, err("x")));
    c("403 → blocco", "blocco", K(403, err("x")));
    c("400 → blocco", "blocco", K(400, err("x")));
    c("404 → blocco", "blocco", K(404, err("x")));
    c("429 → blocco (limite)", "blocco", K(429, err("x")));
    c("500 → incerto", "incerto", K(500, err("x")));
    c("502 → incerto", "incerto", K(502, null));
    c("503 con la forma dell'errore → incerto", "incerto", K(503, err("x")));
    c(
      "nessuno stato (rete, timeout) → incerto",
      "incerto",
      K(undefined, null, new TypeError("fetch failed")),
    );
    c(
      "un errore senza stato → incerto anche se c'è un corpo",
      "incerto",
      K(undefined, ok, new Error("x")),
    );
    c(
      "codice 304x (contenuto non inviabile su quel canale) → rifiuto_contatto",
      "rifiuto_contatto",
      K(400, { status: "error", message: "x", code: 3041 }),
    );
    c(
      "codice 3011 (oltre le 24 ore) → blocco",
      "blocco",
      K(400, { status: "error", message: "x", code: 3011 }),
    );
    //  Cambiare la frase a parità di stato e forma NON cambia l'esito.
    const frasi = ["Template is not approved", "Modello non approvato", "unauthorized", "", "🙂"];
    c(
      "400: qualunque testo, stesso esito",
      [true],
      [frasi.every((m) => K(400, err(m)) === "blocco")],
    );
    c(
      "500: qualunque testo, stesso esito",
      [true],
      [frasi.every((m) => K(500, err(m)) === "incerto")],
    );
    c(
      "200 success: il testo che dice «error» non conta",
      "ok",
      K(200, { status: "success", message: "error: unauthorized", data: {} }),
    );
  }

  gruppo("MANYCHAT · IL CLIENT · LE ALTRE CHIAMATE");
  {
    const f = creaFinto().su(
      "GET",
      PERCORSI.flussi,
      esiti.successo({
        flows: [{ ns: "content-a", name: "CRM · Conferma", folder_id: 1 }],
        folders: [],
      }),
    );
    const k = A.creaClient({ chiave: CHIAVE, fetch: f.fetch });
    c(
      "chiSei: la chiave è buona, is_pro",
      ["ok", true],
      await k.chiSei().then((r) => [r.esito, r.dati?.isPro]),
    );
    c("flussi: ns e nome", [{ ns: "content-a", nome: "CRM · Conferma" }], (await k.flussi()).dati);
    c("campi: i nomi", ["crm_v1"], (await k.campi()).dati);
    const non = creaFinto().su("GET", PERCORSI.info, esiti.nonAutorizzato());
    c(
      "chiSei con la chiave rifiutata → blocco",
      "blocco",
      (await A.creaClient({ chiave: CHIAVE, fetch: non.fetch }).chiSei()).esito,
    );
    const free = creaFinto().su("GET", PERCORSI.info, esiti.successo({ is_pro: false }));
    c(
      "chiSei: piano non Pro",
      false,
      (await A.creaClient({ chiave: CHIAVE, fetch: free.fetch }).chiSei()).dati?.isPro,
    );
    //  Testo libero: sendContent col contenuto WhatsApp.
    const t = creaFinto();
    const r = await A.creaClient({ chiave: CHIAVE, fetch: t.fetch }).mandaTesto(
      1000001,
      "Ciao Maria",
    );
    c(
      "sendContent: testo libero, canale WhatsApp",
      [
        "ok",
        {
          subscriber_id: 1000001,
          data: {
            version: "v2",
            content: { type: "whatsapp", messages: [{ type: "text", text: "Ciao Maria" }] },
          },
        },
      ],
      [r.esito, t.chiamate[0].corpo],
    );
    //  La ricerca si ferma al primo errore: niente passo dopo.
    const lenta = finto().su("GET", PERCORSI.perCampo, esiti.reteGiu());
    const kl = A.creaClient({ chiave: CHIAVE, fetch: lenta.fetch });
    const tl = await kl.trovaContatto(CIFRE);
    c(
      "ricerca con la rete giù → incerto, e nessun altro passo",
      ["incerto", [PERCORSI.campi, PERCORSI.perCampo]],
      [tl.esito, lenta.percorsi()],
    );
    const dopo = finto().su("GET", PERCORSI.perCampo, esiti.nonAutorizzato());
    c(
      "ricerca con la chiave rifiutata → blocco",
      "blocco",
      (await A.creaClient({ chiave: CHIAVE, fetch: dopo.fetch }).trovaContatto(CIFRE)).esito,
    );
    //  Un id che arriva come stringa (lo schema di ManyChat dice «string»).
    const str = finto().su(
      "GET",
      PERCORSI.perCampo,
      esiti.successo([
        { id: "1000009", whatsapp_phone: "+393331234567", optin_whatsapp: true, subscribed: true },
      ]),
    );
    const ts = await A.creaClient({ chiave: CHIAVE, fetch: str.fetch }).trovaContatto(CIFRE);
    c(
      "l'id come stringa diventa un numero",
      [1000009, true],
      [ts.dati?.id, ts.dati?.optinWhatsapp],
    );
    const senzaId = finto()
      .su("GET", PERCORSI.perCampo, esiti.successo([{ id: "boh" }]))
      .su("GET", PERCORSI.perSistema, esiti.successo(null));
    c(
      "un contatto senza id valido non si usa",
      null,
      (await A.creaClient({ chiave: CHIAVE, fetch: senzaId.fetch }).trovaContatto(CIFRE)).dati,
    );
  }
}
