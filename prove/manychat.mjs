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
import { createHmac } from "node:crypto";
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
import { proveSequenze } from "./manychat/sequenze.mjs";
import { proveStati } from "./manychat/stati.mjs";
import { proveSequenzeMigrazione } from "./manychat/sequenze-migrazione.mjs";
import { proveDelleParolePrenota } from "./manychat/prenota-parole.mjs";
import { proveDegliOrariPrenota } from "./manychat/prenota-orari.mjs";
import { proveDeiTestiPrenota } from "./manychat/prenota-testi.mjs";
import { proveDellaSchedaPrenota } from "./manychat/prenota-scheda.mjs";
import { proveDellaStanzaPrenota } from "./manychat/prenota-stanza.mjs";
import { proveDellePortePrenota } from "./manychat/prenota-porte.mjs";
import { proveDellaConcorrenzaPrenota } from "./manychat/prenota-concorrenza.mjs";
import { proveDellaRottaPrenota } from "./manychat/prenota-rotta.mjs";
import { proveDellInterruttorePrenota } from "./manychat/prenota-interruttore.mjs";
import { proveDellOrchestratorePrenota } from "./manychat/prenota.mjs";
import { proveChatMigrazione } from "./manychat/chat-migrazione.mjs";
import { proveChatMedia } from "./manychat/chat-media.mjs";
import { proveChatStato } from "./manychat/chat-stato.mjs";
import { proveChatEntrata } from "./manychat/chat-entrata.mjs";
import { proveChatUscita } from "./manychat/chat-uscita.mjs";
import { proveChatPagina } from "./manychat/chat-pagina.mjs";
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

/** Lo scheletro del compito 0 (commessa 2026-10-25): i moduli nuovi esistono e
 *  hanno le firme concordate nel piano. */
function proveDelloScheletro(mod, { c, gruppo }) {
  gruppo("MANYCHAT · LO SCHELETRO DELLE SEQUENZE (compito 0)");
  const funzioni = {
    "manychat/sequenze": ["decidiLeadNuovi", "decidiGiornoMeet"],
    "manychat/stati": ["decidiPerStato"],
  };
  for (const [nome, attese] of Object.entries(funzioni)) {
    c(
      `${nome}: espone ${attese.join(", ")}`,
      attese.map(() => "function"),
      attese.map((f) => typeof mod[nome]?.[f]),
    );
  }
  c("manychat/stati: espone TABELLA_STATI (un oggetto)", "object", typeof mod["manychat/stati"]?.TABELLA_STATI);
}

/** Lo scheletro della «Chat WhatsApp nel CRM» (commessa 2026-10-28, compito 0): i
 *  due moduli puri esistono con le firme del piano. ⚠️ Controlla solo che le
 *  funzioni CI SIANO (`function`), mai che siano ancora stub: T2 e T3 le
 *  riempiono senza toccare questa prova. */
function proveDelloScheletroChat(mod, { c, gruppo }) {
  gruppo("CHAT WHATSAPP · LO SCHELETRO (compito 0)");
  const funzioni = {
    "chatwa/media": ["classificaTesto", "eSoloSegnaposto", "anteprimaIn"],
    "chatwa/stato": [
      "daRispondere", "contaVecchie", "ordinaDaRispondere", "attesaInChiaro", "finestra24",
      "statoCasella", "schedaUnica", "leggiRicercaChat", "contaDaRispondere",
    ],
  };
  for (const [nome, attese] of Object.entries(funzioni)) {
    c(
      `${nome}: espone ${attese.join(", ")}`,
      attese.map(() => "function"),
      attese.map((f) => typeof mod[nome]?.[f]),
    );
  }
  c("chatwa/media: espone HOST_MEDIA_AMMESSI (un elenco di host)", true, Array.isArray(mod["chatwa/media"]?.HOST_MEDIA_AMMESSI));
}

/** Lo scheletro di «Prenota in chat» (commessa 2026-10-27, compito 0): i moduli
 *  esistono con le firme del piano e i contratti di `prenota-tipi` fanno quello
 *  che dicono. ⚠️ Controlla solo che le funzioni CI SIANO (`function`), mai che
 *  siano ancora stub: i compiti dopo il T0 le riempiono senza toccare questa prova. */
async function proveDelloScheletroPrenota(mod, { c, gruppo }) {
  gruppo("PRENOTA · LO SCHELETRO (compito 0)");
  const funzioni = {
    "manychat/prenota-tipi": ["leggiConfigPrenota", "improntaNumero", "chiaveLucchettoLead", "chiaveLucchettoConsulente"],
    "manychat/prenota-lettura": ["leggiPaginato"],
    "manychat/prenota-parole": ["capisciRisposta"],
    "manychat/prenota-orari": ["giorniFinestra", "consulentiPrenotabili", "slotLiberiDelGiorno", "proponi", "scegliConsulente", "ancoraLibero"],
    "manychat/prenota-testi": [
      "testoProposte", "testoConferma", "testoGiaFissato", "testoPreso", "testoVecchia",
      "testoNessunOrario", "testoAltriFiniti", "testoErrore", "testoOpzioneNonCe", "testoAttesa",
    ],
    "manychat/prenota-scheda": ["puoPrenotare", "appuntamentoFuturo", "presaDallaChat", "daPrenotare", "daDisfare", "conNota", "cambioRicontatto"],
    "manychat/prenota-stanza": ["assicuraStanza"],
    "manychat/prenota": ["gestisciPrenota", "gestisciRichiestaPrenota"],
  };
  for (const [nome, attese] of Object.entries(funzioni)) {
    c(
      `${nome}: espone ${attese.join(", ")}`,
      attese.map(() => "function"),
      attese.map((f) => typeof mod[nome]?.[f]),
    );
  }

  //  I contratti veri (`prenota-tipi`): chi li usa dopo non li rifà.
  const T = mod["manychat/prenota-tipi"];
  c("FISSATO_DA_CHAT", "cliente-chat", T.FISSATO_DA_CHAT);
  c("chiavi di app_config", ["prenota_chat", "prenota_chat:", "prenota_chat_lock:"], [
    T.CHIAVE_CONFIG, T.prefissoProposta, T.prefissoLucchetto,
  ]);
  c("lucchetto del lead", "prenota_chat_lock:lead:abc", T.chiaveLucchettoLead("abc"));
  c("lucchetto del consulente e del giorno", "prenota_chat_lock:c1:2026-10-29",
    T.chiaveLucchettoConsulente("c1", "2026-10-29"));
  c("motivi del secondo stato (lista chiusa)",
    ["prenota_nessun_orario", "prenota_altri_finiti", "prenota_errore"], [...T.MOTIVI_CONTATTO]);
  c("codici di log: 22, con «occupato» e senza «doppio_tocco»", [22, true, false], [
    T.CODICI_LOG.length, T.CODICI_LOG.includes("occupato"), T.CODICI_LOG.includes("doppio_tocco"),
  ]);
  c("fasce in minuti (inizio compreso)", { mattina: [480, 779], pomeriggio: [780, 1019], sera: [1020, 1439] },
    Object.fromEntries(Object.entries(T.FASCE).map(([k, v]) => [k, [v.da, v.a]])));
  c("le fasce coprono 08:00-23:59 senza buchi", true,
    T.FASCE.mattina.a + 1 === T.FASCE.pomeriggio.da && T.FASCE.pomeriggio.a + 1 === T.FASCE.sera.da);

  //  La riga di configurazione: senza riga, illeggibile o non «acceso: true» = spenta.
  const L = T.leggiConfigPrenota;
  const predefinita = { acceso: true, consulenteId: "", preavvisoOre: 3, giorniAvanti: 14, durataMin: 60 };
  for (const [nome, riga] of [
    ["senza riga (null)", null], ["senza riga (undefined)", undefined], ["vuota", ""],
    ["illeggibile", "{non json"], ["un numero", "5"], ["un array", "[]"],
    ["acceso: false", '{"acceso":false}'], ["acceso come testo", '{"acceso":"true"}'],
    ["senza il campo acceso", '{"preavvisoOre":3}'],
  ]) c(`config ${nome} → spenta`, null, L(riga));
  c("config minima accesa → predefiniti", predefinita, L('{"acceso":true}'));
  c("config completa", { acceso: true, consulenteId: "c-1", preavvisoOre: 5, giorniAvanti: 7, durataMin: 90 },
    L('{"v":1,"acceso":true,"consulenteId":"c-1","preavvisoOre":5,"giorniAvanti":7,"durataMin":90}'));
  c("numeri fuori scala o non numeri → predefiniti", predefinita,
    L('{"acceso":true,"consulenteId":7,"preavvisoOre":0,"giorniAvanti":31,"durataMin":"60"}'));
  c("estremi ammessi: 1-48 ore, 1-30 giorni, 15-180 minuti",
    { acceso: true, consulenteId: "", preavvisoOre: 48, giorniAvanti: 1, durataMin: 180 },
    L('{"acceso":true,"preavvisoOre":48,"giorniAvanti":1,"durataMin":180}'));
  c("sotto gli estremi → predefiniti", predefinita,
    L('{"acceso":true,"preavvisoOre":49,"giorniAvanti":0,"durataMin":14}'));

  //  L'impronta del numero: HMAC, mai il numero, mai uguale con un altro segreto.
  const tel = "393330000001";
  const a = await T.improntaNumero(tel, "segreto-finto-1");
  const attesa = createHmac("sha256", "segreto-finto-1").update(tel).digest("hex").slice(0, 32);
  c("impronta = HMAC-SHA256 troncato a 16 byte (32 cifre esadecimali)", attesa, a);
  c("l'impronta è stabile", a, await T.improntaNumero(tel, "segreto-finto-1"));
  c("con un altro segreto cambia", false, a === (await T.improntaNumero(tel, "segreto-finto-2")));
  c("con un altro numero cambia", false, a === (await T.improntaNumero("393330000002", "segreto-finto-1")));
  c("il numero non compare nell'impronta", false, a.includes(tel));
}

export async function proveManychat(mod, aiuti) {
  proveDelloScheletro(mod, aiuti);
  await proveDelloScheletroPrenota(mod, aiuti);
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
  //  Commessa 2026-10-25 (sequenze WhatsApp): un file per compito.
  await proveSequenze(mod, aiuti);
  await proveStati(mod, aiuti);
  await proveSequenzeMigrazione(mod, aiuti);
  //  Commessa 2026-10-27 (prenota in chat): un file per compito, vuoti finché
  //  il compito non li riempie.
  await proveDelleParolePrenota(mod, aiuti);
  await proveDegliOrariPrenota(mod, aiuti);
  await proveDeiTestiPrenota(mod, aiuti);
  await proveDellaSchedaPrenota(mod, aiuti);
  await proveDellaStanzaPrenota(mod, aiuti);
  await proveDellePortePrenota(mod, aiuti);
  await proveDellOrchestratorePrenota(mod, aiuti);
  await proveDellaConcorrenzaPrenota(mod, aiuti);
  await proveDellaRottaPrenota(mod, aiuti);
  await proveDellInterruttorePrenota(mod, aiuti);
  //  Commessa 2026-10-28 (chat WhatsApp): un file per compito, vuoti finché il
  //  compito non li riempie. Lo scheletro (compito 0) controlla solo che i
  //  moduli puri esistano.
  proveDelloScheletroChat(mod, aiuti);
  await proveChatMigrazione(mod, aiuti);
  await proveChatMedia(mod, aiuti);
  await proveChatStato(mod, aiuti);
  await proveChatEntrata(mod, aiuti);
  await proveChatUscita(mod, aiuti);
  await proveChatPagina(mod, aiuti);
}
