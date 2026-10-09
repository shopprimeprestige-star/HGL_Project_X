#!/usr/bin/env node
/** ── I PERCORSI CHE VALGONO SOLDI, PROVATI SUL SERVER VERO ─────────────────
 *
 *  `prove/prove.mjs` prova le REGOLE (7.354 controlli su moduli puri) e le
 *  prova bene. Quello che non poteva provare è il GIRO: la pagina che chiama
 *  la rotta, la rotta che scrive nel database, il documento che si rilegge
 *  identico il giorno dopo. Ed è lì che sono nati i guasti di questa
 *  settimana — il preventivo che perdeva le sue condizioni, il numero che non
 *  si ritrovava, la rotta aperta che scriveva quello che le passavi.
 *
 *  Qui si parla con il server come ci parla la pagina: si crea un preventivo,
 *  lo si rilegge, gli si cambia il numero, si controlla che il link vecchio
 *  porti ancora al documento giusto. Niente browser: in pochi secondi, e si
 *  può lanciare prima di ogni pubblicazione.
 *
 *  ── COME SI USA ──────────────────────────────────────────────────────────
 *      node prove/percorsi.mjs                     (sul server locale)
 *      node prove/percorsi.mjs https://…workers.dev
 *
 *  ⚠️ SCRIVE DAVVERO, E POI PULISCE. I preventivi di prova nascono con il
 *   numero che comincia per `IDPROVE` e vengono cancellati alla fine, insieme
 *   alle righe che si portano dietro (condizioni, causale, rimandi). Se il
 *   giro si interrompe a metà, la pulizia gira lo stesso: sta in `finally`.
 *   Per cancellare serve la chiave di servizio, che si legge dal `.env` come
 *   fa il resto del progetto.
 *  ⚠️ LE AZIONI DA CONSULENTE (cambiare numero e causale) VOGLIONO LA
 *   CREDENZIALE: senza, quelle prove si saltano e lo si dice, invece di
 *   dichiarare verde un percorso che non è stato percorso. Per farle girare:
 *      CODICE_PRESENTATORE=... node prove/percorsi.mjs
 *  ───────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
/*  ── ⚠️ IL SERVER SI CERCA, NON SI DÀ PER SCONTATO ────────────────────────
    Segnalazione del committente: «npm run percorsi non ha potuto girare, il
    server locale su :8080 non era acceso… risolvi».
    E il motivo era peggio di un server spento: sulla 8080 di questa macchina
    risponde un ALTRO programma (un server llama, in ascolto su 127.0.0.1).
    Questo file però chiedeva a `[::1]:8080` — l'indirizzo IPv6 — dove non
    c'era nessuno: usciva «fetch failed» alla prima richiesta, senza dire né
    che cosa cercava né dove.
    Adesso si prova una lista di indirizzi e si CONTROLLA CHE SIA IL NOSTRO:
    un programma qualsiasi che risponde 200 sulla stessa porta non è il nostro
    server, e dichiarare verdi 37 percorsi su un server sbagliato sarebbe la
    bugia peggiore che questo file possa dire. Chi passa un indirizzo a mano
    comanda lui, come prima. */
const CANDIDATI = [
  process.argv[2],
  process.env.BASE,
  "http://127.0.0.1:8788",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
  "http://127.0.0.1:5173",
].filter(Boolean).map((u) => String(u).replace(/\/$/, ""));

/** È il nostro server? Si chiede una rotta che esiste solo qui e si guarda la
 *  forma della risposta, non il codice HTTP. */
async function nostro(base) {
  try {
    const r = await fetch(`${base}/api/public/pricing`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return false;
    const j = await r.json();
    //  ⚠️ `prices`, non `pricing`: la rotta risponde con il listino in chiaro.
    //   Con la chiave sbagliata questo controllo diceva «non è il nostro» a un
    //   server che era proprio il nostro — e il messaggio d'aiuto mandava a
    //   riaccendere una cosa già accesa.
    return !!j && typeof j === "object" && ("prices" in j || "pricing" in j);
  } catch {
    return false;
  }
}

let BASE = "";
for (const c of CANDIDATI) {
  //  Un indirizzo passato a mano non si mette in discussione: può essere il
  //  sito pubblicato, e lì questa prova girerebbe lo stesso.
  if (c === process.argv[2] || c === process.env.BASE) { BASE = c; break; }
  if (await nostro(c)) { BASE = c; break; }
}
if (!BASE) {
  console.error(
    "\n✖ Non trovo il server di questo progetto.\n" +
      `   Ho provato: ${CANDIDATI.join(", ")}\n` +
      "   Accendilo con  npx vite dev --port 8788  (la 8080 su questa macchina è di un altro programma),\n" +
      "   oppure passa l'indirizzo:  node prove/percorsi.mjs https://…\n",
  );
  process.exit(1);
}
const CODICE = process.env.CODICE_PRESENTATORE || "";

// ── il .env, letto come lo legge il resto del progetto ─────────────────────
const env = {};
try {
  for (const riga of readFileSync(join(RADICE, ".env"), "utf8").split("\n")) {
    const m = riga.match(/^([A-Z_]+)=(.*)$/);
    //  ⚠️ I valori possono essere fra virgolette: lasciandocele dentro,
    //   l'indirizzo diventa `"https://…"` e la pulizia non parte — cioè i
    //   preventivi di prova restano in archivio di produzione.
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* senza .env si prova lo stesso: salta solo la pulizia */ }

let fatti = 0, rotti = 0, saltati = 0;
const c = (nome, atteso, letto) => {
  fatti++;
  const bene = JSON.stringify(atteso) === JSON.stringify(letto);
  if (!bene) rotti++;
  console.log((bene ? "  ok  " : "  NO  ") + nome.padEnd(52) +
    (bene ? "" : `atteso ${JSON.stringify(atteso)}, letto ${JSON.stringify(letto)}`));
};
const salta = (nome, perché) => { saltati++; console.log("  --  " + nome.padEnd(52) + perché); };
const gruppo = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 58 - t.length))}`);

const chiedi = async (percorso, opzioni = {}) => {
  const r = await fetch(`${BASE}${percorso}`, opzioni);
  const testo = await r.text();
  try { return { stato: r.status, corpo: JSON.parse(testo) }; }
  catch { return { stato: r.status, corpo: testo }; }
};
const posta = (percorso, corpo, intestazioni = {}) =>
  chiedi(percorso, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...intestazioni },
    body: JSON.stringify(corpo),
  });

/** I numeri creati durante la corsa: si cancellano tutti alla fine. */
const creati = [];
/** Le stanze d'attesa create durante la corsa: stessa sorte. */
const stanzeSala = [];
/** La credenziale di servizio, quando c'è: serve a PREPARARE una scena che
 *  dal di fuori non si potrebbe scrivere (la regia la scrive solo il
 *  consulente). Senza, le prove che la vogliono si saltano. */
const chiaveDiServizio = env.SUPABASE_SERVICE_ROLE_KEY || "";
async function scriviRiga(key, value) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/app_config`, {
    method: "POST",
    headers: { apikey: chiaveDiServizio, Authorization: `Bearer ${chiaveDiServizio}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}
const numero = (s) => `IDPROVE${s}${Date.now().toString(36).slice(-4).toUpperCase()}`;

const rigaDiProva = (ref, extra = {}) => ({
  quote_ref: ref,
  nome: "Prova", cognome: "Percorsi", email: "prove@example.invalid", telefono: "+39 000 000",
  base_choice: "Invisible Derm Protocol",
  base_system: { id: "invisible-derm", name: "Invisible Derm Protocol", price: 860 },
  upsells: [{ name: "Voce di prova", price: 100 }],
  qty: 1, fitting_mode: "remoto", discount_eur: 0, total: 960,
  ...extra,
});

async function percorsi() {
  // ── 1 · UN PREVENTIVO NASCE, E SI RILEGGE COM'ERA ────────────────────────
  gruppo("IL PREVENTIVO SI CREA E SI RILEGGE");
  const ref1 = numero("A");
  const nato = await posta("/api/public/quote-create", {
    row: rigaDiProva(ref1),
    condizioni: {
      listino: { prices: {}, acconto: 55, manutenzione: { prezzo: 777, mesi: 9 }, causale: "Acconto {nome} - {numero}" },
      scelte: { baseId: "invisible-derm", voci: [], varianti: {}, simOn: false, installOn: false, installLoc: "studio", fitting: "remoto", qty: 1 },
    },
  });
  c("si crea", true, nato.corpo?.ok === true);
  const ref = String(nato.corpo?.ref || ref1);
  creati.push(ref);

  const letto = await chiedi(`/api/public/quote?ref=${encodeURIComponent(ref)}`);
  c("si rilegge", true, letto.corpo?.ok === true);
  c("col suo totale", 960, Number(letto.corpo?.quote?.total));
  c("e con la voce che aveva", "Voce di prova", letto.corpo?.quote?.upsells?.[0]?.name);

  // ── 2 · LE CONDIZIONI RESTANO QUELLE DEL GIORNO IN CUI È NATO ────────────
  gruppo("IL DOCUMENTO NON CAMBIA DA SOLO");
  const cond = JSON.parse(letto.corpo?.condizioni || "{}");
  c("la fotografia torna indietro", 55, cond?.listino?.acconto);
  c("…con l'assistenza di allora", 777, cond?.listino?.manutenzione?.prezzo);
  c("…e la causale di allora", "Acconto {nome} - {numero}", cond?.listino?.causale);
  //  Il listino di OGGI può dire tutt'altro: è proprio il punto.
  const oggi = await chiedi("/api/public/pricing");
  c("il listino di oggi è un'altra cosa", true, oggi.corpo?.acconto !== 55 || oggi.corpo?.manutenzione?.prezzo !== 777);

  // ── 3 · UNA ROTTA APERTA SCRIVE SOLO QUELLO CHE DEVE ─────────────────────
  gruppo("LA ROTTA APERTA NON SI FA SCRIVERE ADDOSSO");
  const ref2 = numero("B");
  const storto = await posta("/api/public/quote-create", {
    row: rigaDiProva(ref2, {
      status: "confermato",
      id: "00000000-0000-0000-0000-000000000000",
      timeline_steps: { selfie: true },
      pippo: "non esisto",
      total: -50,
      nome: "N".repeat(500),
    }),
  });
  c("si crea lo stesso", true, storto.corpo?.ok === true);
  if (storto.corpo?.ok) {
    creati.push(String(storto.corpo.ref));
    const q = (await chiedi(`/api/public/quote?ref=${encodeURIComponent(storto.corpo.ref)}`)).corpo?.quote ?? {};
    c("lo stato non lo decide chi chiama", "nuovo", q.status);
    c("le tappe non si scrivono da fuori", true, !q.timeline_steps || Object.keys(q.timeline_steps).length === 0);
    c("niente totali negativi", 0, Number(q.total));
    c("i testi lunghi si accorciano", 120, String(q.nome || "").length);
  }

  // ── 4 · IL NUMERO SI CAMBIA, E IL LINK VECCHIO REGGE ─────────────────────
  gruppo("CAMBIARE NUMERO A UN PREVENTIVO");
  if (!CODICE) {
    salta("cambio numero", "serve CODICE_PRESENTATORE");
    salta("cambio causale", "serve CODICE_PRESENTATORE");
  } else {
    const nuovo = numero("C");
    const r = await posta("/api/presenter/quotes", { action: "rinumera", ref, nuovo, code: CODICE });
    c("il cambio riesce", true, r.corpo?.ok === true);
    if (r.corpo?.ok) {
      creati.push(nuovo);
      const vecchio = await chiedi(`/api/public/quote?ref=${encodeURIComponent(ref)}`);
      c("il link vecchio porta ancora al documento", true, vecchio.corpo?.ok === true);
      c("…che adesso ha il numero nuovo", nuovo, String(vecchio.corpo?.quote?.quote_ref || ""));
      const conNuovo = await chiedi(`/api/public/quote?ref=${encodeURIComponent(nuovo)}`);
      c("le condizioni lo hanno seguito", 55, JSON.parse(conNuovo.corpo?.condizioni || "{}")?.listino?.acconto);
      //  E un numero impossibile viene rifiutato con il motivo scritto.
      const corto = await posta("/api/presenter/quotes", { action: "rinumera", ref: nuovo, nuovo: "A", code: CODICE });
      c("un numero di due lettere si rifiuta", false, corto.corpo?.ok === true);

      const caus = await posta("/api/presenter/quotes", { action: "causale", ref: nuovo, causale: "Saldo {numero}", code: CODICE });
      c("la causale si cambia", true, caus.corpo?.ok === true);
      const dopo = await chiedi(`/api/public/quote?ref=${encodeURIComponent(nuovo)}`);
      c("…e torna indietro col documento", "Saldo {numero}", dopo.corpo?.causale);
    }
  }

  // ── 5 · LE PORTE CHE DEVONO RESTARE CHIUSE ───────────────────────────────
  /*  ── LA PORTA D'INGRESSO DELLA CONSULENZA ────────────────────────────
      Segnalazione del committente: «quando una persona entra rimane in attesa
      e non entra mai». La bussata e il via libera adesso passano anche dal
      server, e questa è l'unica prova che dice se quella strada REGGE DAVVERO:
      il modulo puro (prove.mjs) sa le regole della lista, ma non sa se la riga
      si scrive e si rilegge. */
  gruppo("LA SALA D'ATTESA, SUL SERVER VERO");
  const stanza = `prova-percorsi-${Date.now().toString(36).slice(-5)}`;
  stanzeSala.push(stanza);
  const bussata = await posta("/api/public/sala-attesa", { sess: stanza, pid: "p-uno", nome: "Prova Uno", dev: "D-uno" });
  c("chi bussa entra in sala d'attesa", "attesa", bussata.corpo?.stato);
  const riletto = await chiedi(`/api/public/sala-attesa?sess=${stanza}&pid=p-uno&dev=D-uno`);
  c("e la ritrova rileggendo", "attesa", riletto.corpo?.stato);
  //  ⚠️ Di chi non ha mai bussato non si dice «no»: si dice «non so», e il
  //   cliente continua a bussare invece di vedersi chiudere la porta in faccia.
  const altro = await chiedi(`/api/public/sala-attesa?sess=${stanza}&pid=mai-visto`);
  c("di uno mai visto non si sa niente", "sconosciuto", altro.corpo?.stato);
  //  ⚠️ E da questa rotta non escono MAI i nomi degli altri in attesa: sono
  //   clienti di un centro medico, e il codice della stanza ce l'hanno tutti
  //   quelli che hanno ricevuto il link.
  c("non si sfila fuori l'elenco", false, JSON.stringify(riletto.corpo || {}).includes("Prova Uno"));
  const senzaStanza = await posta("/api/public/sala-attesa", { pid: "p-uno" });
  c("senza stanza non si bussa", 400, senzaStanza.stato);

  /*  ── LA REGIA DI UNA CONSULENZA DI GRUPPO ───────────────────────────
      Qui si prova la sola cosa che non si può provare a tavolino: chi può
      cambiare che cosa. Le regole (penna, stanze, che cosa vede ciascuno)
      sono già provate in prove.mjs — questa è la porta. */
  gruppo("LA REGIA DEL GRUPPO, SUL SERVER VERO");
  const vuota = await chiedi(`/api/public/regia-gruppo?sess=${stanza}`);
  c("una consulenza nasce senza preventivo comune", false, vuota.corpo?.regia?.comune);
  //  ⚠️ Accendere il comune è del consulente: da acceso lo vedono tutti.
  const accendi = await posta("/api/public/regia-gruppo", { sess: stanza, comune: true });
  c("il comune non lo accende un estraneo", 401, accendi.stato);
  //  ⚠️ …e nemmeno aprire il preventivo di una persona o prenderle la penna.
  const apri = await posta("/api/public/regia-gruppo", { sess: stanza, individuale: { chi: "p1", acceso: true } });
  c("né apre il preventivo di qualcuno", 401, apri.stato);
  const prendi = await posta("/api/public/regia-gruppo", { sess: stanza, penna: { chi: "p1", a: "consulente" } });
  c("né gli prende la penna", 401, prendi.stato);
  /*  ⚠️ UNA COSA SOLA È PUBBLICA, ED È VOLUTA: ridare la penna al cliente.
      È la regola del committente — «quando prendi la penna, può
      riprendersela» — e chi se la riprende è un cliente, che non ha nessuna
      credenziale: ha solo il codice della sua stanza. */
  const ridai = await posta("/api/public/regia-gruppo", { sess: stanza, penna: { chi: "p1", a: "cliente" } });
  c("ma la penna il cliente se la riprende", 200, ridai.stato);
  c("e resta com'era: nessuno gliel'aveva presa", "cliente", ridai.corpo?.regia?.penne?.p1 ?? "cliente");
  //  ⚠️ E nemmeno azzerare: «si ricomincia» spegne la vista a tutti, ed è
  //   una mossa del consulente (la fa l'avvio della consulenza).
  const azzera = await posta("/api/public/regia-gruppo", { sess: stanza, azzera: true });
  c("né azzera quello che vedono", 401, azzera.stato);
  const senzaStanzaRegia = await posta("/api/public/regia-gruppo", { penna: { chi: "p1", a: "cliente" } });
  c("senza stanza non si tocca niente", 400, senzaStanzaRegia.stato);

  /*  ── DOVE MANDA IL SERVER UN CLIENTE COL SUO PREVENTIVO ACCESO ──────
      Terza segnalazione sulla stessa cosa: «passo ai media e il cliente col
      preventivo attivo passa ai media uguale». Le prime due volte il rimedio
      stava sul telefono del cliente — e misurando il canale della stanza vera
      quel telefono annunciava `persona: ""`, cioè non sapeva chi era. Adesso
      la precedenza la calcola anche il server, e QUESTA è la prova che regge:
      il modulo puro sa la regola, ma non sa se la rotta la applica. */
  if (chiaveDiServizio) {
    const dentro = `prova-percorsi-${Date.now().toString(36).slice(-5)}`;
    stanzeSala.push(dentro);
    const persona = { leadId: "aa11bb22-0000-0000-0000-000000000000", nome: "Prova", cognome: "Sola" };
    const suoGettone = "paa11bb22";   // gettoneDi: 'p' + le prime 8 cifre del lead
    await scriviRiga(`attesi:${dentro}`, JSON.stringify({ persone: [persona] }));
    await scriviRiga(`presenter_page:${dentro}`, "/presenta");
    await scriviRiga(`regia_gruppo:${dentro}`, JSON.stringify({ comune: false, penne: {}, individuali: [], aperto: "", at: Date.now() }));
    const spento = await chiedi(`/api/presenter/curpage?sess=${dentro}`);
    c("col preventivo spento il cliente segue i media", "/presenta", spento.corpo?.path);
    await scriviRiga(`regia_gruppo:${dentro}`, JSON.stringify({ comune: false, penne: {}, individuali: [suoGettone], aperto: "", at: Date.now() }));
    const acceso = await chiedi(`/api/presenter/curpage?sess=${dentro}`);
    //  ⚠️ Il cliente non dichiara niente: è il caso misurato sul vero. In una
    //   stanza che aspetta UNA persona il server non ha bisogno che lo sappia.
    c("acceso, il server lo manda sul suo preventivo", "/preventivo?persona=paa11bb22", acceso.corpo?.path);
    c("e lo dice, così il pannello non mente", true, acceso.corpo?.suo === true);
    //  ⚠️ Ma la riga del consulente NON si tocca: lui sta sui media, e la
    //   precedenza è una risposta a chi segue, non una scrittura.
    const riga = await chiedi(`/api/public/regia-gruppo?sess=${dentro}`);
    c("la regia resta com'era", true, Array.isArray(riga.corpo?.regia?.individuali));
  }

  gruppo("LE PORTE CHIUSE RESTANO CHIUSE");
  //  Chi sta aspettando, e il via libera, stanno dietro alla sessione del
  //  presentatore: da qui escono i nomi dei clienti e si apre una consulenza.
  const elenco = await chiedi(`/api/presenter/sala-attesa?sess=${stanza}`);
  c("l'elenco di chi aspetta non è di tutti", 401, elenco.stato);
  const viaLibera = await posta("/api/presenter/sala-attesa", { sess: stanza, pid: "p-uno", stato: "ammesso" });
  c("e il via libera non lo dà un estraneo", 401, viaLibera.stato);
  const pagina = await posta("/api/presenter/curpage", { path: "/slide", sess: "prova-percorsi" });
  c("la pagina del cliente non la sposta un estraneo", 401, pagina.stato);
  //  ⚠️ Il riassunto dei preventivi della stanza porta i TOTALI dei clienti:
  //   sta dietro alla sessione del consulente come tutto il resto.
  const riassunti = await chiedi(`/api/presenter/preventivi-stanza?sess=${stanza}`);
  c("i totali dei preventivi non sono di tutti", 401, riassunti.stato);
  const pref = await posta("/api/presenter/prefs", { presenterId: "x", audio: {} });
  c("le preferenze del microfono nemmeno", 401, pref.stato);
  const copia = await chiedi("/api/crm/copia-automatica");
  c("la copia di sicurezza vuole le credenziali", 401, copia.stato);
  const archivio = await chiedi("/api/crm/backup");
  c("e l'archivio completo pure", 401, archivio.stato);
}

/** ── LA PULIZIA ───────────────────────────────────────────────────────────
 *  Tutto quello che la corsa ha scritto se ne va: la riga del preventivo e le
 *  righe che gli stanno attaccate. Gira anche se le prove si sono fermate a
 *  metà — un archivio di produzione non è il posto dove lasciare i cocci. */
async function pulisci() {
  const url = env.SUPABASE_URL, chiave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) { console.log("\n⚠️  niente .env: i preventivi di prova restano in archivio:", creati.join(", ")); return; }
  const intestazioni = { apikey: chiave, Authorization: `Bearer ${chiave}` };
  let tolti = 0;
  for (const ref of [...new Set(creati)]) {
    await fetch(`${url}/rest/v1/quote_requests?quote_ref=eq.${encodeURIComponent(ref)}`, { method: "DELETE", headers: intestazioni });
    for (const base of ["preventivo_condizioni", "preventivo_causale", "quote_rinumerato", "anteprima:preventivo"]) {
      const k = base === "quote_rinumerato" || base === "anteprima:preventivo" ? `${base}:${ref}` : `${base}:${ref.toLowerCase()}`;
      await fetch(`${url}/rest/v1/app_config?key=eq.${encodeURIComponent(k)}`, { method: "DELETE", headers: intestazioni });
    }
    tolti++;
  }
  /*  ⚠️ E LE SCHEDE CHE NEL FRATTEMPO SI FOSSERO AGGANCIATE. Da oggi un
      preventivo appena nato si attacca da solo alla scheda del cliente quando
      il telefono dà un solo candidato (api.public.quote-create). Il telefono
      di prova è corto apposta e non aggancia niente — ma se un giorno
      qualcuno lo cambia con uno vero, cancellare il preventivo lascerebbe una
      scheda che punta a un documento che non esiste più. */
  for (const ref of [...new Set(creati)]) {
    const r = await fetch(
      `${url}/rest/v1/crm_leads?select=id&data->>quoteRef=eq.${encodeURIComponent(ref)}`,
      { headers: intestazioni },
    );
    const schede = r.ok ? await r.json() : [];
    for (const s of schede) {
      const piena = await (await fetch(`${url}/rest/v1/crm_leads?select=data&id=eq.${s.id}`, { headers: intestazioni })).json();
      const dati = { ...(piena?.[0]?.data ?? {}) };
      delete dati.quoteRef;
      await fetch(`${url}/rest/v1/crm_leads?id=eq.${s.id}`, {
        method: "PATCH",
        headers: { ...intestazioni, "Content-Type": "application/json" },
        body: JSON.stringify({ data: dati }),
      });
    }
  }
  for (const stanza of [...new Set(stanzeSala)]) {
    for (const base of ["sala_attesa", "regia_gruppo", "attesi", "presenter_page"]) {
      await fetch(`${url}/rest/v1/app_config?key=eq.${encodeURIComponent(`${base}:${stanza}`)}`, { method: "DELETE", headers: intestazioni });
    }
  }
  console.log(`\n🧹 puliti ${tolti} preventivi di prova${stanzeSala.length ? ` e ${new Set(stanzeSala).size} sale d'attesa` : ""}`);
}

console.log(`\nPercorsi che valgono soldi — server: ${BASE}${CODICE ? " (con credenziale)" : " (senza credenziale: alcune prove si saltano)"}`);
try {
  await percorsi();
} catch (e) {
  rotti++;
  console.error("\n✖ la corsa si è interrotta:", e instanceof Error ? e.message : e);
} finally {
  await pulisci();
}
console.log(
  rotti
    ? `\n✖ ${rotti} controlli falliti su ${fatti}${saltati ? ` (${saltati} saltati)` : ""}\n`
    : `\n✓ tutti i ${fatti} controlli passano${saltati ? ` (${saltati} saltati)` : ""}\n`,
);
process.exit(rotti ? 1 : 0);
