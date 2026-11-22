/** ── IL WEBHOOK DI STRIPE: IL SERVER (R2 · T52 · PIANO-R2 D44, D45, D46, §3.2) ──────────────────────
 *  `gestisciWebhook(richiesta, porte)` → `Response`. Importabile senza ambiente: database, Stripe, segreto, orologio, log, email e il
 *  «dopo la risposta» sono PORTE (si prova con un finto database e un Stripe finto). La rotta (T57) le collega.
 *
 *  L'ordine delle cose, che non si cambia:
 *   1. segreto mancante → 503 (mai accettare senza firma);  2. corpo oltre 1 MB → 413, PRIMA di leggerlo e prima di ogni parsing;
 *   3. firma sui BYTE del corpo (`verificaFirma` di T44, mai `text()`): sbagliata, vecchia, futura o assente → 400 senza dettagli e
 *      senza toccare il database;  4. solo allora si legge il JSON e l'evento (`leggiEvento` di T44);
 *   5. idempotenza (`shop_stripe_evento_registra`): già elaborato → 200 e basta; registrato e mai chiuso (crash) → si rielabora, le funzioni SQL
 *      sono idempotenti;  6. l'effetto, SOLO con funzioni SQL: «pagato» è `shop_ordine_pagato` (importo, valuta, sessione dell'ordine e giacenza
 *      sono controllati dentro, in una transazione), chiusure con `shop_ordine_chiudi`, rimborsi con `shop_rimborso_riconcilia` sull'elenco
 *      letto da Stripe (D46), avvisi e storico con `shop_s4_avviso`/`shop_s4_evento`;  7. `shop_stripe_evento_chiudi`;  8. risposta 200;
 *   9. DOPO la risposta (`dopoRisposta`): il metodo di pagamento e la conferma d'ordine (best effort). Mai un errore verso Stripe se falliscono.
 *      ECCEZIONE, `pagamento_non_riuscito` (R3b): parte PRIMA di chiudere l'evento, perché se si perde nessuno la rimanda. Se l'invio lancia,
 *      finisce in `errore` o è `in_corso`, l'ordine riceve l'avviso `email_non_inviata` e la risposta è 500: l'evento resta aperto, Stripe ritenta, e al
 *      tentativo l'ordine è già `fallito` (`ignorato`) ma l'email si chiede lo stesso. Non si manda due volte: la guardia è `shop_email_prenota`
 *      e Resend ha la sua Idempotency-Key.
 *  Risposte: firma/JSON → 400 · tetto → 413 · evento non nostro o non gestito → 200 · guasto del database o di Stripe → 500 (Stripe ritenta fino
 *  a 3 giorni) · segreto mancante o migrazione S4 non applicata → 503.
 *  ⚠️ Nel log solo CODICI (`webhook <codice>`): mai email, nome, indirizzo, id di Stripe, id dell'ordine, messaggi di errore.
 *  ⚠️ Qui non si compone nessuna email: `PorteEmail.invia` (T54) chiama `messaggioInviabile` prima di `componi`, anche con `manuale:true`. */
import type { PorteEmail } from "../email/tipi";
import { codiceDi } from "../cms/cassa-sito";
import type { ClientStripe } from "../stripe/client";
import { leggiEvento, type EventoSessione } from "../stripe/eventi";
import { verificaFirma } from "../stripe/firma";

/** Il tetto del corpo: un evento di Stripe sta in qualche KB. */
const TETTO_CORPO = 1024 * 1024;
/** Quanto si aspetta il lavoro «dopo la risposta» quando la rotta non ha `waitUntil`. */
const TETTO_ATTESA_MS = 8_000;

/** Il pezzo di costruttore di query di Supabase che serve qui (il finto delle prove ne ha lo stesso aspetto). */
interface Interrogazione extends PromiseLike<{ data: unknown; error: { code?: unknown } | null }> {
  eq(colonna: string, valore: unknown): Interrogazione;
  is(colonna: string, valore: null): Interrogazione;
  maybeSingle(): Interrogazione;
}
export interface DbWebhook {
  from(tabella: string): {
    select(colonne?: string): Interrogazione;
    update(valori: Record<string, unknown>): Interrogazione;
  };
  rpc(
    nome: string,
    argomenti?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: unknown } | null }>;
}
/** Di Stripe servono due letture: il pagamento (metodo e metadati) e l'elenco dei rimborsi. */
export type StripeWebhook = Pick<ClientStripe, "leggiPagamento" | "elencaRimborsi">;

export interface PorteWebhook {
  db: DbWebhook;
  stripe: StripeWebhook;
  /** `STRIPE_WEBHOOK_SECRET`, letto al momento della richiesta. Vuoto o mancante: 503. */
  segreto: () => string | null | undefined;
  /** Millisecondi (`Date.now()`). */
  adesso: () => number;
  /** Solo CODICI. */
  log?: (codice: string) => void;
  email: PorteEmail;
  /** `waitUntil` se la rotta lo offre; altrimenti `attendiConTetto` (la risposta aspetta, al massimo 8 s). Mai un'eccezione verso Stripe. */
  dopoRisposta: (promessa: Promise<unknown>) => void | Promise<unknown>;
}

/** Il ripiego di `dopoRisposta` senza `waitUntil`: aspetta la promessa, ma non oltre il tetto, e non lancia mai. */
export async function attendiConTetto(
  promessa: Promise<unknown>,
  tettoMs = TETTO_ATTESA_MS,
): Promise<void> {
  let orologio: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promessa.catch(() => undefined),
      new Promise<void>((ok) => (orologio = setTimeout(ok, tettoMs))),
    ]);
  } finally {
    clearTimeout(orologio);
  }
}

const risposta = (stato: number, ok: boolean) =>
  new Response(JSON.stringify({ ok }), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Codici di Postgres/PostgREST che dicono «S4 non è applicata»: funzione, tabella o colonna assente. */
const MIGRAZIONE = new Set(["PGRST202", "PGRST204", "PGRST205", "42883", "42P01", "42703"]);

/** Esiti dell'invio email che ritentare non cambia (configurazione, database o indirizzo da sistemare): avviso e 200. */
const SENZA_RITENTO = new Set(["non_configurata", "migrazione", "senza_email"]);
/** La porta email dà il codice HTTP di Resend in `codice` (`http_<stato>`): un 4xx diverso da 408 e 429 è un rifiuto che non passa da solo. */
const eRifiutoPermanente = (codice: string | undefined): boolean => {
  const stato = /^http_(4\d\d)$/.exec(codice ?? "")?.[1];
  return stato !== undefined && stato !== "408" && stato !== "429";
};

/** Un guasto che il webhook non sa risolvere: porta solo un codice. `migrazione` → 503, il resto → 500. */
class Guasto extends Error {
  constructor(
    readonly codice: string,
    readonly migrazione = false,
  ) {
    super(codice);
  }
}

/** Il corpo in byte, fermandosi appena si supera il tetto (un flusso senza Content-Length non si legge tutto). `null` = troppo grande. */
async function leggiCorpo(richiesta: Request): Promise<Uint8Array | null> {
  if (!richiesta.body) return new Uint8Array(0);
  const lettore = richiesta.body.getReader();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.length;
    if (totale > TETTO_CORPO) {
      await lettore.cancel().catch(() => undefined);
      return null;
    }
    pezzi.push(value);
  }
  const corpo = new Uint8Array(totale);
  let da = 0;
  for (const p of pezzi) {
    corpo.set(p, da);
    da += p.length;
  }
  return corpo;
}

type Ordine = { id: string; prova: boolean; email: string; stato: string };

/** Una sola gestione di un evento: l'esito (testo breve, finisce in `shop_stripe_eventi.esito`) e il lavoro per DOPO la risposta. */
type Fatto = { esito: string; dopo: (() => Promise<unknown>)[] };

export async function gestisciWebhook(richiesta: Request, porte: PorteWebhook): Promise<Response> {
  const avvisa = (codice: string) => {
    try {
      porte.log?.(`webhook ${codice}`);
    } catch {
      /* il log non deve mai fermare la risposta */
    }
  };
  const db = porte.db;

  /** Una funzione SQL: il risultato, o un `Guasto` con il solo codice. */
  async function rpc(nome: string, argomenti: Record<string, unknown>): Promise<unknown> {
    const r = await db.rpc(nome, argomenti);
    if (r.error) {
      const codice = codiceDi(r.error);
      throw new Guasto(`db_${codice}`, MIGRAZIONE.has(codice));
    }
    return r.data;
  }
  const esitoDi = (dati: unknown): string => {
    const e = (dati as { esito?: unknown } | null)?.esito;
    return typeof e === "string" && /^[a-z_]{1,40}$/.test(e) ? e : "sconosciuto";
  };
  const avviso = (ordine: string, codice: string, rif: string | null) =>
    rpc("shop_s4_avviso", { p_ordine: ordine, p_codice: codice, p_gravita: "rosso", p_rif: rif });
  const storico = (ordine: string, tipo: string, dopo: Record<string, unknown> | null) =>
    rpc("shop_s4_evento", {
      p_ordine: ordine,
      p_tipo: tipo,
      p_chi: "stripe",
      p_prima: null,
      p_dopo: dopo,
    });

  async function leggiOrdine(id: string): Promise<Ordine | null> {
    const r = await db
      .from("shop_orders")
      .select("id, prova, email, stato_pagamento")
      .eq("id", id)
      .maybeSingle();
    if (r.error) {
      const codice = codiceDi(r.error);
      throw new Guasto(`db_${codice}`, MIGRAZIONE.has(codice));
    }
    const riga = r.data as Record<string, unknown> | null;
    if (!riga || typeof riga.id !== "string") return null;
    return {
      id: riga.id,
      prova: riga.prova === true,
      email: typeof riga.email === "string" ? riga.email.trim() : "",
      stato: typeof riga["stato_pagamento"] === "string" ? riga["stato_pagamento"] : "",
    };
  }

  /** L'ordine di un pagamento che non porta il suo ordine (rimborsi, contestazioni): `metadata[ordine_id]` del payment intent. */
  async function ordineDalPagamento(paymentIntent: string | null): Promise<string | null> {
    if (!paymentIntent) return null;
    const r = await porte.stripe.leggiPagamento(paymentIntent);
    if (!r.ok) {
      if (r.errore.codice === "resource_missing") return null; // un pagamento che Stripe non ha: non è nostro, ritentare non serve
      throw new Guasto(`stripe_${r.errore.codice}`);
    }
    const id = r.dati.metadata.ordine_id;
    return typeof id === "string" && UUID.test(id) ? id : null;
  }

  /** Metodo di pagamento e email di conferma, DOPO la risposta. Ogni pezzo va per conto suo: un errore dell'uno non ferma l'altro. */
  function dopoPagato(ordineId: string, paymentIntent: string | null): (() => Promise<unknown>)[] {
    return [
      async () => {
        if (!paymentIntent) return;
        const r = await porte.stripe.leggiPagamento(paymentIntent);
        if (!r.ok || !r.dati.metodo) return avvisa("metodo_non_letto");
        // l'unica scrittura diretta: un dettaglio che non decide niente (il «pagato» è già nel database); non si sovrascrive un valore già messo
        const scritto = await db
          .from("shop_orders")
          .update({ metodo_dettaglio: r.dati.metodo })
          .eq("id", ordineId)
          .is("metodo_dettaglio", null);
        if (scritto.error) avvisa("metodo_non_scritto");
      },
      () => porte.email.invia("conferma_ordine", ordineId, { manuale: false }),
    ];
  }

  /** E3 (D53), PRIMA di chiudere l'evento: se non parte, nessuno la rimanda. Un invio che lancia, finisce in `errore` o è `in_corso` lascia l'avviso
   *  `email_non_inviata` (una sola volta per evento) e fa fallire la richiesta (500): Stripe ritenta.
   *  Ritentare non serve, e quindi 200 con l'avviso e niente 500, quando manca l'indirizzo, quando la configurazione o il database non sono a posto
   *  (`non_configurata`, `migrazione`, `senza_email`) e quando Resend rifiuta per sempre (4xx diverso da 408 e 429: indirizzo rifiutato, chiave o dominio).
   *  Stati come `spenta` o `non_approvata` sono scelte del titolare, non guasti: nessun avviso, nessun 500.
   *  shortcut: l'invio si aspetta dentro la richiesta (il tetto è quello della porta, 8 s di Resend), quando serve di più si sposta in una coda. */
  async function emailNonRiuscito(ordine: Ordine, eventoId: string): Promise<void> {
    const segnala = () =>
      avviso(ordine.id, "email_non_inviata", eventoId).catch(() => avvisa("avviso_non_scritto"));
    if (ordine.email === "") return void (await segnala());
    let stato: string;
    let codice: string | undefined;
    try {
      ({ stato, codice } = await porte.email.invia("pagamento_non_riuscito", ordine.id, {
        manuale: false,
      }));
    } catch {
      stato = "eccezione";
    }
    if (SENZA_RITENTO.has(stato) || (stato === "errore" && eRifiutoPermanente(codice)))
      return void (await segnala());
    if (stato !== "errore" && stato !== "in_corso" && stato !== "eccezione") return;
    await segnala();
    throw new Guasto(`email_${stato}`);
  }

  async function sessione(ordine: Ordine, evento: EventoSessione): Promise<Fatto> {
    const s = evento.sessione;
    switch (evento.tipo) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (s.pagamento !== "paid") {
          if (s.pagamento !== "unpaid") return { esito: "ignorato", dopo: [] };
          // metodo ritardato (bonifico, ecc.): l'ordine resta in attesa, si scrive solo che il pagamento è in corso
          await storico(ordine.id, "pagamento_in_corso", { sessione: s.id });
          return { esito: "pagamento_in_corso", dopo: [] };
        }
        const dati = await rpc("shop_ordine_pagato", {
          p_ordine: ordine.id,
          p_sessione: s.id,
          p_importo_cent: s.importoCent,
          p_valuta: s.valuta,
          p_metodo: null,
          p_pagamento_id: s.paymentIntent,
        });
        const esito = esitoDi(dati);
        // anche `gia_pagato`: se il processo è morto fra il commit e l'invio, il tentativo di Stripe la manda (la guardia è `shop_email_prenota`)
        return {
          esito,
          dopo:
            esito === "pagato_ora" || esito === "gia_pagato"
              ? dopoPagato(ordine.id, s.paymentIntent)
              : [],
        };
      }
      case "checkout.session.async_payment_failed": {
        const esito = esitoDi(
          await rpc("shop_ordine_chiudi", {
            p_ordine: ordine.id,
            p_sessione: s.id,
            p_stato: "fallito",
          }),
        );
        // E3 (D53): se l'ordine è passato a fallito adesso, o lo era già per un tentativo precedente che si è fermato prima di chiudere l'evento
        // (stesso ragionamento di `gia_pagato`: la guardia contro il doppio invio è `shop_email_prenota`)
        if (esito === "chiuso" || (esito === "ignorato" && ordine.stato === "fallito"))
          await emailNonRiuscito(ordine, evento.id);
        return { esito, dopo: [] };
      }
      case "checkout.session.expired":
        return {
          esito: esitoDi(
            await rpc("shop_ordine_chiudi", {
              p_ordine: ordine.id,
              p_sessione: s.id,
              p_stato: "scaduto",
            }),
          ),
          dopo: [],
        };
    }
  }

  try {
    // 1 · segreto: senza, niente si accetta
    const segreto = porte.segreto();
    if (typeof segreto !== "string" || segreto === "") {
      avvisa("segreto_mancante");
      return risposta(503, false);
    }

    // 2 · il tetto, prima di leggere
    const dichiarata = Number(richiesta.headers.get("content-length"));
    if (Number.isFinite(dichiarata) && dichiarata > TETTO_CORPO) {
      avvisa("corpo_troppo_grande");
      return risposta(413, false);
    }
    const corpo = await leggiCorpo(richiesta);
    if (!corpo) {
      avvisa("corpo_troppo_grande");
      return risposta(413, false);
    }

    // 3 · la firma sui byte, prima di qualunque altra cosa
    const firma = await verificaFirma(
      corpo,
      richiesta.headers.get("stripe-signature"),
      segreto,
      porte.adesso(),
    );
    if (firma !== "ok") {
      avvisa(`firma_${firma}`);
      return risposta(400, false);
    }

    // 4 · l'evento (il decodificatore toglie un eventuale BOM: la firma ha già guardato i byte)
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(corpo));
    } catch {
      avvisa("corpo_non_json");
      return risposta(400, false);
    }
    const evento = leggiEvento(json);
    if (evento.tipo === "sconosciuto") return risposta(200, true);

    // l'ordine che l'evento dichiara; un id che non è dei nostri (altro uso dell'account Stripe) non si tocca nemmeno
    const dichiarato =
      "sessione" in evento
        ? evento.sessione.ordineId
        : "ordineId" in evento
          ? evento.ordineId
          : null;
    if (
      "sessione" in evento
        ? dichiarato === null || !UUID.test(dichiarato)
        : dichiarato !== null && !UUID.test(dichiarato)
    )
      return risposta(200, true);

    // 5 · idempotenza
    const stato = await rpc("shop_stripe_evento_registra", {
      p_id: evento.id,
      p_tipo: evento.tipo,
      p_ordine: dichiarato,
    });
    if (stato === "gia_elaborato") return risposta(200, true);

    // 6 · l'effetto
    let fatto: Fatto;
    const ordineId =
      dichiarato ?? ("sessione" in evento ? null : await ordineDalPagamento(evento.paymentIntent));
    const ordine = ordineId ? await leggiOrdine(ordineId) : null;
    if (!ordine) fatto = { esito: "non_trovato", dopo: [] };
    else if (ordine.prova === evento.livemode) {
      // un evento reale su un ordine di prova (o il contrario) non cambia niente: si segnala
      await avviso(ordine.id, "livemode_diverso", evento.id);
      fatto = { esito: "livemode_diverso", dopo: [] };
    } else if ("sessione" in evento) fatto = await sessione(ordine, evento);
    else if (evento.tipo === "charge.dispute.created") {
      await avviso(ordine.id, "contestazione", evento.id);
      await storico(ordine.id, "contestazione", {
        importo_cent: evento.importoCent,
        motivo: evento.motivo,
      });
      fatto = { esito: "contestazione", dopo: [] };
    } else if (!evento.paymentIntent) fatto = { esito: "ignorato", dopo: [] };
    else {
      // charge.refunded, refund.updated, refund.failed (D46): la fonte è l'elenco letto da Stripe, non la forma dell'evento
      const elenco = await porte.stripe.elencaRimborsi(evento.paymentIntent);
      if (!elenco.ok) throw new Guasto(`stripe_${elenco.errore.codice}`);
      if (elenco.dati.troncato) avvisa("rimborsi_troncati");
      await rpc("shop_rimborso_riconcilia", {
        p_ordine: ordine.id,
        p_rimborsi: elenco.dati.rimborsi,
        p_chiudi_orfane: false,
      });
      fatto = { esito: "rimborsi_riconciliati", dopo: [] };
    }

    // 7 · l'evento è fatto
    await rpc("shop_stripe_evento_chiudi", { p_id: evento.id, p_esito: fatto.esito });

    // 8-9 · la risposta parte; il resto la segue. Un errore qui non diventa mai un errore verso Stripe.
    if (fatto.dopo.length) {
      const lavoro = Promise.all(
        fatto.dopo.map((f) =>
          Promise.resolve()
            .then(f)
            .catch((e) => avvisa(`dopo_${codiceDi(e)}`)),
        ),
      );
      try {
        await porte.dopoRisposta(lavoro);
      } catch (e) {
        avvisa(`dopo_risposta_${codiceDi(e)}`);
      }
    }
    return risposta(200, true);
  } catch (e) {
    const g = e instanceof Guasto ? e : null;
    avvisa(g ? g.codice : `errore_${codiceDi(e)}`);
    return risposta(g?.migrazione ? 503 : 500, false);
  }
}
