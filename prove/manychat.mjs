/** ── LE PROVE DI MANYCHAT · l'ingresso ─────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). `prove/prove.mjs` impacchetta i
 *  moduli `src/crm/manychat/*` (voci `manychat/…` di MODULI) e chiama
 *  `proveManychat(mod, aiuti)`: qui si chiamano, in ordine, i file d'area.
 *
 *  ⚠️ UN FILE PER AREA, UN COMPITO PER FILE. `prove.mjs` lo ha toccato solo il
 *   compito 1, una volta: gli altri compiti scrivono nel loro file d'area in
 *   `prove/manychat/` e non entrano in `prove.mjs`, così nessuno si pesta i
 *   piedi. Un file ancora vuoto passa.
 *  ⚠️ `aiuti` = { c, gruppo, radice }: `c(nome, atteso, letto)` conta il
 *   controllo (e fa fallire `npm test` se non torna), `gruppo(titolo)` apre un
 *   blocco, `radice` è la cartella del progetto (per leggere i sorgenti).
 *  ───────────────────────────────────────────────────────────────────────── */
import { proveContatto } from "./manychat/contatto.mjs";
import { proveRegole } from "./manychat/regole.mjs";
import { proveQuando } from "./manychat/quando.mjs";
import { proveApi } from "./manychat/api.mjs";
import { proveRitorno } from "./manychat/ritorno.mjs";
import { provePorta } from "./manychat/porta.mjs";
import { proveRisposta } from "./manychat/risposta.mjs";
import { proveGiro } from "./manychat/giro.mjs";
import { proveMigrazioni } from "./manychat/migrazioni.mjs";
import { provePannello } from "./manychat/pannello.mjs";
import { creaFinto, creaOrologio, esiti, PERCORSI } from "./manychat/finto.mjs";

/** Il ManyChat finto deve fare quello che dice: lo si controlla qui, una volta,
 *  perché tutte le altre prove ci si appoggiano. */
async function proveDelFinto({ c, gruppo }) {
  gruppo("MANYCHAT · IL FINTO");
  const chiamaJson = async (f, metodo, percorso, corpo) => {
    const r = await f.fetch(`https://api.manychat.com${percorso}?x=1`, {
      method: metodo,
      headers: { Authorization: "Bearer chiave-finta" },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    return { http: r.status, corpo: await r.json() };
  };

  const f = creaFinto();
  const a = await chiamaJson(f, "POST", PERCORSI.flusso, {
    subscriber_id: 1000001,
    flow_ns: "content-finto-1",
  });
  c(
    "registra metodo, percorso, query, corpo e intestazioni",
    [
      {
        metodo: "POST",
        percorso: PERCORSI.flusso,
        query: { x: "1" },
        corpo: { subscriber_id: 1000001, flow_ns: "content-finto-1" },
        intestazioni: { authorization: "Bearer chiave-finta" },
      },
    ],
    f.chiamate,
  );
  c("di serie risponde success con HTTP 200", [200, "success"], [a.http, a.corpo.status]);

  const t = creaFinto();
  const trovato = await chiamaJson(t, "GET", PERCORSI.perSistema);
  c("scenario «trovato»: il contatto c'è", [200, true], [trovato.http, trovato.corpo.data?.id > 0]);
  const as = creaFinto().scenario("assente");
  const assente = await chiamaJson(as, "GET", PERCORSI.perSistema);
  c("scenario «assente»: nessun contatto", null, assente.corpo.data);
  const creato = await chiamaJson(as, "POST", PERCORSI.crea, { first_name: "Maria" });
  c("…e createSubscriber lo crea", true, creato.corpo.data?.id > 0);

  const r = creaFinto().su("POST", PERCORSI.flusso, esiti.nonAutorizzato());
  c(
    "401 per copione",
    [401, "error"],
    await chiamaJson(r, "POST", PERCORSI.flusso, {}).then((x) => [x.http, x.corpo.status]),
  );
  const m = creaFinto().su("POST", PERCORSI.flusso, esiti.modelloRifiutato());
  c(
    "modello rifiutato per copione: HTTP 400 con la forma dello swagger",
    [400, "error", true],
    await chiamaJson(m, "POST", PERCORSI.flusso, {}).then((x) => [
      x.http,
      x.corpo.status,
      Array.isArray(x.corpo.details.messages),
    ]),
  );
  const e5 = creaFinto().su("POST", PERCORSI.flusso, esiti.errore500());
  c("500 per copione", 500, (await chiamaJson(e5, "POST", PERCORSI.flusso, {})).http);
  const rete = creaFinto().su("POST", PERCORSI.flusso, esiti.reteGiu());
  c(
    "rete giù: fetch lancia, e la chiamata resta registrata",
    ["TypeError", 1],
    await chiamaJson(rete, "POST", PERCORSI.flusso, {}).then(
      () => ["nessun errore", 0],
      (err) => [err.name, rete.chiamate.length],
    ),
  );
  c(
    "rotta fuori copione: 404, mai un successo per caso",
    404,
    (await chiamaJson(creaFinto(), "GET", "/fb/non/esiste")).http,
  );

  //  La lentezza: non risponde finché il chiamante non interrompe.
  const lento = creaFinto().su("POST", PERCORSI.flusso, esiti.lento());
  const stop = new AbortController();
  const attesa = lento.fetch(`https://api.manychat.com${PERCORSI.flusso}`, {
    method: "POST",
    body: "{}",
    signal: stop.signal,
  });
  stop.abort();
  c(
    "lentezza: finisce solo con l'interruzione del chiamante",
    "AbortError",
    await attesa.then(
      () => "risposta",
      (err) => err.name,
    ),
  );

  //  Il tempo finto: 3 secondi a chiamata, sull'orologio che la prova condivide.
  const orologio = creaOrologio(Date.parse("2026-10-23T10:00:00+02:00"));
  const g = creaFinto({ orologio, ritardoMs: 3000 });
  await chiamaJson(g, "GET", PERCORSI.info);
  await chiamaJson(g, "GET", PERCORSI.flussi);
  c(
    "ritardoMs fa avanzare l'orologio finto, senza aspettare davvero",
    "2026-10-23T08:00:06.000Z",
    orologio.adesso().toISOString(),
  );
  g.svuota();
  c("svuota() azzera le chiamate", 0, g.chiamate.length);
}

export async function proveManychat(mod, aiuti) {
  await proveDelFinto(aiuti);
  await proveContatto(mod, aiuti);
  await proveRegole(mod, aiuti);
  await proveQuando(mod, aiuti);
  await proveApi(mod, aiuti);
  await proveRitorno(mod, aiuti);
  await provePorta(mod, aiuti);
  await proveRisposta(mod, aiuti);
  await proveGiro(mod, aiuti);
  await proveMigrazioni(mod, aiuti);
  await provePannello(mod, aiuti);
}
