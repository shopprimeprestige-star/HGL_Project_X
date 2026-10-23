/** ── LA PORTA UNICA DEGLI INVII WHATSAPP ───────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). Scritta dal compito U1 (Dev B):
 *  le porte vere sono in `porta.server.ts`, le prove in `prove/manychat/porta.mjs`.
 *
 *  Chi manda un messaggio WhatsApp dal CRM (la conferma «risponda SÌ», la chat,
 *  il pannello lead, il webinar, il giro dei ricontatti) passa da QUI. La porta
 *  guarda il canale:
 *   - `cloud`: lo stesso corpo Graph di oggi, identico (prova a confronto);
 *   - `manychat`: prenotazione (registro + pausa per contatto + STOP), il
 *     contatto, SOLO i parametri del modello nei campi `crm_v1…crm_v4`, poi
 *     `sendFlow` col flusso mappato; un modello senza flusso → rifiuto senza
 *     nessuna chiamata; un testo libero → `sendContent`.
 *
 *  Le PORTE (database, rete, orologio, chiave) sono iniettate: il modulo non
 *  conosce `supabaseAdmin` né `process.env`.
 *
 *  ── GLI ESITI E COME LI LEGGE LA CONFERMA DEL 22/10 (PIANO §1e c) ─────────
 *   ok                → inviato
 *   riprova_fra_poco, gia_preso → riprova (segno tolto, nessun blocco)
 *   stop              → rifiuto del cliente («disiscritto»)
 *   da_collegare, rifiuto_contatto → rifiuto del cliente
 *   flusso_mancante, blocco → blocco tecnico
 *   incerto           → rete (solo rete giù, timeout e 5xx)
 *  La traduzione la fa `promemoria/pronto.ts` (`esitoInvio`), che legge
 *  `manychat?: EsitoPorta` PRIMA di `status`/`corpo`/`rete`.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { ClientManychat, EsitoApi, RisultatoApi } from "./api";

export type CanaleWhatsapp = "cloud" | "manychat";

/** Chi chiede l'invio (finisce in `manychat_invii.tipo`). */
export type TipoInvioPorta =
  | "promemoria"
  | "ricontatto"
  | "conferma"
  | "chat"
  | "webinar"
  | "prova";

/** L'esito della porta. È il campo `manychat` di `RispostaInvio`. */
export type EsitoPorta =
  | "ok"
  /** un invio allo stesso telefono negli ultimi 120 s (pausa per contatto) */
  | "riprova_fra_poco"
  /** la chiave unica dell'invio c'è già: lo ha preso un altro giro */
  | "gia_preso"
  /** il numero ha chiesto di non ricevere messaggi (`non_scrivere_dal`) */
  | "stop"
  /** il contatto ManyChat non si trova né si crea */
  | "da_collegare"
  /** il numero non è su WhatsApp */
  | "rifiuto_contatto"
  /** il modello non ha un flusso mappato in `manychat_config.flussi` */
  | "flusso_mancante"
  /** chiave rifiutata, canale scollegato, modello in pausa, limite */
  | "blocco"
  /** rete giù, timeout, 5xx: non si sa se è partito; non si rimanda */
  | "incerto";

export interface RichiestaInvio {
  canale: CanaleWhatsapp;
  /** il telefono, in qualunque formato (la porta lo porta a cifre) */
  a: string;
  /** testo libero (chat entro 24 h) */
  testo?: string;
  /** nome del modello approvato */
  modello?: string;
  lingua?: string;
  /** parametri posizionali {{1}}, {{2}}… del modello */
  parametri?: string[];
  /** il nome della persona: serve solo a creare il contatto in ManyChat, e ne
   *  parte la prima parola (mai il cognome) */
  nome?: string;
  leadId?: string | null;
  tipo: TipoInvioPorta;
  /** chiave unica dell'invio (`p|tel9|…`, `r|tel9|…`); assente per la chat a mano */
  chiave?: string;
}

export interface RisultatoPorta {
  esito: EsitoPorta;
  /** id nel registro `manychat_invii`, se c'è stata una prenotazione */
  invioId?: string;
  /** lo stato e il corpo della chiamata Graph, solo col canale `cloud` */
  status?: number;
  corpo?: unknown;
  /** la chiamata Graph non è arrivata in fondo (solo `cloud`) */
  rete?: boolean;
  /** un codice breve per i log: mai numero, testo o chiavi */
  codice?: string;
}

/** Cosa si chiede al database per prenotare un invio ManyChat. */
export interface PrenotazionePorta {
  tipo: TipoInvioPorta;
  /** solo cifre */
  telefono: string;
  leadId: string | null;
  chiave: string | null;
  /** il flusso (`ns`) che partirà; null per il testo libero */
  flowNs: string | null;
}

/** Una riga per `whatsapp_messages` (la scrive la porta, canale `manychat`). */
export interface MessaggioPorta {
  leadId: string | null;
  /** col «+» */
  a: string;
  corpo: string;
  stato: "sent" | "failed" | "queued";
  waId: string | null;
  errore: string | null;
}

/** Le porte della porta (database, rete, orologio, chiavi). */
export interface PortePorta {
  adesso(): Date;
  /** Il client ManyChat; null = manca la chiave (`MANYCHAT_API_KEY`). */
  client(): ClientManychat | null;
  /** Il `ns` del flusso collegato al modello (`manychat_config.flussi`). */
  flusso(modello: string): Promise<string | null>;
  /** `manychat_prenota_porta`: prenota o dice perché no. Lancia se il database non risponde. */
  prenota(p: PrenotazionePorta): Promise<{ id: string } | { motivo: string }>;
  /** `manychat_esito`: aggiorna la riga solo se è ancora `prenotato`. */
  esito(id: string, patch: Record<string, unknown>): Promise<void>;
  /** L'ultimo `subscriber_id` visto per quel telefono (passo 1 della ricerca).
   *  Nel registro è TESTO (`manychat_invii.subscriber_id`): chi lo legge lo
   *  riporta a numero solo se è un intero sicuro. */
  subscriberNoto(telefono: string): Promise<number | null>;
  /** La riga in `whatsapp_messages` (e il contatto in `whatsapp_contacts`). */
  registra(m: MessaggioPorta): Promise<void>;
  /** La chiamata Graph vera, col canale `cloud`. Lancia se la rete è giù. */
  cloud(corpo: Record<string, unknown>): Promise<{ status: number; corpo: unknown }>;
}

/** Quanti parametri del modello arrivano nei campi `crm_v1…crm_v4`. */
export const MAX_PARAMETRI = 4;

/** Solo le cifre di un telefono. */
export const soloCifre = (t: string) => String(t ?? "").replace(/\D/g, "");

/** ── IL CORPO DELLA GRAPH API ──────────────────────────────────────────────
 *  Identico a quello che `api.whatsapp-send` e la conferma del 22/10 hanno
 *  sempre mandato (prova a confronto in `porta.mjs`). */
export function corpoGraph(r: {
  a: string;
  testo?: string;
  modello?: string;
  lingua?: string;
  parametri?: string[];
}): Record<string, unknown> {
  const pulito = String(r.a ?? "").replace(/[^\d+]/g, "");
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: (pulito.startsWith("+") ? pulito : `+${pulito}`).replace(/^\+/, ""),
  };
  if (r.modello) {
    payload.type = "template";
    const template: Record<string, unknown> = {
      name: r.modello,
      language: { code: r.lingua || "it" },
    };
    const params = r.parametri;
    if (Array.isArray(params) && params.length > 0) {
      template.components = [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text: String(text ?? "") })),
        },
      ];
    }
    payload.template = template;
  } else {
    payload.type = "text";
    payload.text = { preview_url: false, body: r.testo };
  }
  return payload;
}

/** Manda un messaggio WhatsApp dal canale scelto. Non lancia: ogni guasto è un
 *  esito. */
export async function inviaWhatsapp(
  porte: PortePorta,
  richiesta: RichiestaInvio,
): Promise<RisultatoPorta> {
  if (richiesta.canale === "cloud") return viaCloud(porte, richiesta);
  return viaManychat(porte, richiesta);
}

/** Col canale `cloud` la porta non decide niente: spedisce e restituisce lo
 *  stato e il corpo, che chi chiama legge come ha sempre fatto. `esito` serve
 *  solo ai log. */
async function viaCloud(porte: PortePorta, r: RichiestaInvio): Promise<RisultatoPorta> {
  try {
    const { status, corpo } = await porte.cloud(corpoGraph(r));
    const esito: EsitoPorta =
      status >= 500 ? "incerto" : status >= 200 && status < 300 ? "ok" : "blocco";
    return { esito, status, corpo };
  } catch {
    return { esito: "incerto", rete: true, codice: "rete" };
  }
}

/** Col canale `manychat`. L'ordine è la sicurezza:
 *   1. niente chiamate se manca la chiave o il flusso;
 *   2. PRIMA la prenotazione nel registro (pausa per contatto, STOP, chiave unica);
 *   3. il contatto, i campi, il flusso;
 *   4. l'esito nel registro e in `whatsapp_messages`.
 *  Un errore incerto non si ritenta. Un guasto del registro DOPO l'invio non
 *  cambia l'esito: il messaggio è partito. */
async function viaManychat(porte: PortePorta, r: RichiestaInvio): Promise<RisultatoPorta> {
  const cifre = soloCifre(r.a);
  if (cifre.length < 8) return { esito: "rifiuto_contatto", codice: "numero" };
  const client = porte.client();
  if (!client) return { esito: "blocco", codice: "manca_chiave" };
  //  Il corpo della chat arriva dal browser: se i parametri non sono un elenco,
  //  è un errore di chi chiama, non un'eccezione.
  if (r.parametri !== undefined && !Array.isArray(r.parametri))
    return { esito: "blocco", codice: "parametri_non_validi" };
  const parametri = r.parametri ?? [];
  if (parametri.length > MAX_PARAMETRI) return { esito: "blocco", codice: "troppi_parametri" };

  let ns: string | null = null;
  if (r.modello) {
    try {
      ns = await porte.flusso(r.modello);
    } catch {
      return { esito: "blocco", codice: "configurazione" };
    }
    //  Modello senza flusso: rifiuto senza nessuna chiamata (nemmeno al registro).
    if (!ns) return { esito: "flusso_mancante", codice: "flusso_mancante" };
  } else if (!r.testo) {
    return { esito: "blocco", codice: "richiesta_vuota" };
  }

  let invioId: string;
  try {
    const p = await porte.prenota({
      tipo: r.tipo,
      telefono: cifre,
      leadId: r.leadId ?? null,
      chiave: r.chiave ?? null,
      flowNs: ns,
    });
    if ("motivo" in p)
      return { esito: MOTIVI_PRENOTAZIONE[p.motivo] ?? "blocco", codice: p.motivo };
    invioId = p.id;
  } catch {
    //  Il registro non risponde: non è partito niente, ma non si invia al buio.
    return { esito: "blocco", codice: "registro" };
  }

  /** Chiude la riga del registro (se l'esito è certo) e restituisce l'esito. */
  const chiudi = async (
    esito: EsitoPorta,
    codice: string | undefined,
    patch: Record<string, unknown> | null,
    subscriber: number | null,
  ): Promise<RisultatoPorta> => {
    if (patch) {
      await porte
        .esito(invioId, { ...patch, ...(subscriber ? { subscriber_id: String(subscriber) } : {}) })
        .catch(() => undefined);
    }
    return { esito, invioId, ...(codice ? { codice } : {}) };
  };
  /** Un'API che non ha detto «fatto», PRIMA di `sendFlow`: ricerca, creazione o
   *  campi non mandano niente, quindi è certo che nulla è partito. Un `incerto`
   *  qui è un `blocco` col suo codice e la riga si chiude «fallito»: la
   *  conferma non si perde (il giro toglie il segno e riprova fra 10 minuti,
   *  col motivo in vista) e il telefono non resta in pausa. `incerto` vero è
   *  solo quello di `sendFlow`/`sendContent`. */
  const fallita = (x: RisultatoApi, subscriber: number | null) => {
    const incerta = x.esito === "incerto";
    const esito: EsitoPorta = incerta
      ? "blocco"
      : (ESITO_DA_API[x.esito as Exclude<EsitoApi, "ok">] ?? "blocco");
    return chiudi(
      esito,
      incerta ? "non_risponde_prima_invio" : x.codice,
      { stato: "fallito", motivo: incerta ? "non_risponde_prima_invio" : esito },
      subscriber,
    );
  };

  //  Il contatto: il registro, poi la ricerca, poi la creazione.
  let subscriber = await porte.subscriberNoto(cifre).catch(() => null);
  if (!subscriber) {
    const t = await client.trovaContatto(cifre);
    if (t.esito !== "ok") return fallita(t, null);
    subscriber = t.dati?.id ?? null;
    if (!subscriber) {
      const n = await client.creaContatto(primoNome(r.nome), cifre);
      //  Non creabile (esiste già, permesso negato): da collegare a mano.
      if (n.esito === "rifiuto_contatto") {
        await registraDi(porte, r, "failed", null, "da_collegare");
        return chiudi("da_collegare", n.codice, { stato: "fallito", motivo: "da_collegare" }, null);
      }
      if (n.esito !== "ok" || !n.dati) return fallita(n, null);
      subscriber = n.dati.id;
    }
  }

  //  I campi che il flusso legge: SOLO i parametri del modello, più chi siamo.
  if (ns) {
    const campi: Record<string, string> = {};
    parametri.forEach((v, i) => (campi[`crm_v${i + 1}`] = String(v ?? "")));
    campi.crm_invio_id = invioId;
    if (r.leadId) campi.crm_lead_id = r.leadId;
    campi.crm_telefono = cifre;
    const w = await client.scriviCampi(subscriber, campi);
    if (w.esito !== "ok") return fallita(w, subscriber);
  }

  //  ⚠️ L'invio. Da qui in poi un guasto vuol dire «non so se è partito».
  const s = ns
    ? await client.mandaFlusso(subscriber, ns)
    : await client.mandaTesto(subscriber, r.testo ?? "");
  if (s.esito === "ok") {
    await porte
      .esito(invioId, {
        stato: "inviato",
        inviato_il: porte.adesso().toISOString(),
        subscriber_id: String(subscriber),
      })
      .catch(() => undefined);
    await registraDi(porte, r, "sent", `mc:${invioId}`, null);
    return { esito: "ok", invioId };
  }
  const esito = ESITO_DA_API[s.esito] ?? "incerto";
  //  Oltre le 24 ore il testo libero non passa: lo dice il codice numerico di ManyChat.
  const codice = /_(3011|3031)$/.test(s.codice ?? "") ? "fuori_24h" : s.codice;
  if (esito === "incerto") {
    await registraDi(porte, r, "queued", `mc:${invioId}`, "esito incerto");
    return { esito, invioId, ...(codice ? { codice } : {}) };
  }
  if (esito === "rifiuto_contatto") await registraDi(porte, r, "failed", null, esito);
  return chiudi(esito, codice, { stato: "fallito", motivo: esito }, subscriber);
}

//  I motivi di `manychat_prenota_porta`: STOP viene prima della pausa. Gli altri
//  (`dati_mancanti`, `manca_riga_giro`, o uno nuovo) non sono un «riprova»:
//  sono un blocco, perché nel registro qualcosa non va.
const MOTIVI_PRENOTAZIONE: Record<string, EsitoPorta> = {
  pausa_contatto: "riprova_fra_poco",
  stop: "stop",
  gia_preso: "gia_preso",
};

const ESITO_DA_API: Record<Exclude<EsitoApi, "ok">, EsitoPorta> = {
  rifiuto_contatto: "rifiuto_contatto",
  blocco: "blocco",
  incerto: "incerto",
};

/** Solo la prima parola: a ManyChat non va il cognome. */
const primoNome = (nome?: string) =>
  String(nome ?? "")
    .trim()
    .split(/\s+/)[0] ?? "";

/** Scrive la riga di `whatsapp_messages`. Un guasto qui non cambia l'esito. */
async function registraDi(
  porte: PortePorta,
  r: RichiestaInvio,
  stato: MessaggioPorta["stato"],
  waId: string | null,
  errore: string | null,
) {
  await porte
    .registra({
      leadId: r.leadId ?? null,
      a: `+${soloCifre(r.a)}`,
      corpo: r.testo ?? `[template:${r.modello}]`,
      stato,
      waId,
      errore,
    })
    .catch(() => undefined);
}

/** ── PER LA CONFERMA DEL 22/10 ─────────────────────────────────────────────
 *  La forma che il giro della conferma sa leggere (`RispostaInvio` di
 *  `promemoria/pronto.ts`): col canale `cloud` è la risposta Graph di sempre
 *  (o `rete`), col canale ManyChat è l'`EsitoPorta` e l'id del messaggio. */
export function rispostaPerConferma(r: RisultatoPorta): {
  rete?: boolean;
  status?: number;
  corpo?: unknown;
  manychat?: EsitoPorta;
  waId?: string;
} {
  if (r.rete) return { rete: true };
  if (r.status !== undefined) return { status: r.status, corpo: r.corpo };
  return { manychat: r.esito, ...(r.invioId ? { waId: `mc:${r.invioId}` } : {}) };
}

/** ── PER LA CHAT, IL PANNELLO LEAD, IL WEBINAR ─────────────────────────────
 *  Gli esiti della porta diventano la risposta di `/api/whatsapp-send`. Le frasi
 *  sono per la setter: «Questo numero ha chiesto di non ricevere messaggi». */
export function rispostaChat(r: RisultatoPorta): {
  status: number;
  corpo: Record<string, unknown>;
} {
  const no = (
    status: number,
    error: string,
    message: string,
    extra: Record<string, unknown> = {},
  ) => ({
    status,
    corpo: { error, message, ...extra },
  });
  switch (r.esito) {
    case "ok":
      return {
        status: 200,
        corpo: { ok: true, waMessageId: r.invioId ? `mc:${r.invioId}` : null },
      };
    case "riprova_fra_poco":
    case "gia_preso":
      return no(
        429,
        "riprova_fra_poco",
        "Riprova fra un minuto: a questo numero è appena partito un messaggio.",
      );
    case "stop":
      return no(403, "stop", "Questo numero ha chiesto di non ricevere messaggi");
    case "da_collegare":
      return no(
        422,
        "da_collegare",
        "Contatto ManyChat da collegare: non si trova né si crea per questo numero.",
      );
    case "rifiuto_contatto":
      return no(422, "rifiuto_contatto", "Il numero non risulta su WhatsApp.");
    case "flusso_mancante":
      return no(
        400,
        "flusso_mancante",
        "Questo modello non ha ancora un flusso collegato in ManyChat.",
      );
    case "incerto":
      return no(
        504,
        "esito_incerto",
        "Non so se il messaggio è partito: controlla in ManyChat prima di rimandarlo.",
      );
    default:
      if (r.codice === "non_risponde_prima_invio")
        return no(
          503,
          "non_risponde",
          "ManyChat non risponde: il messaggio non è partito, riprova.",
        );
      if (r.codice === "troppi_parametri")
        return no(
          400,
          "troppi_parametri",
          `Il modello ha troppe variabili: ManyChat ne accetta al massimo ${MAX_PARAMETRI}.`,
        );
      return r.codice === "manca_chiave"
        ? no(503, "manca_chiave", "Manca la chiave di ManyChat: il messaggio non è partito.")
        : r.codice === "fuori_24h"
          ? no(
              502,
              "wa_api_error",
              "Fuori dalle 24 ore dall'ultimo messaggio del cliente serve un modello approvato.",
              { category: "outside_24h_window" },
            )
          : no(
              502,
              "wa_api_error",
              "ManyChat ha rifiutato il messaggio: controlla il collegamento (chiave, canale WhatsApp, flusso).",
              { category: "manychat_rifiutato" },
            );
  }
}
