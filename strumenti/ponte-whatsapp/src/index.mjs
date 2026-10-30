/** ── PONTE WHATSAPP · L'AVVIO (launchd → questo file) ───────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T6 (PIANO §a2-§a4, §b3).
 *  Lo lancia launchd (`it.hgl.ponte-whatsapp`) dalla copia in
 *  `~/Library/Application Support/HGL/ponte-wa/app/`, oppure il titolare a
 *  mano per la prima prova: `node src/index.mjs --senza-invio` (collega,
 *  scarica, scrive la fila e NON spedisce: stampa solo i conteggi).
 *
 *  In ordine: umask 077 → registro e uscite sostituite → Node 22 o 24 →
 *  `config.env` → fila → Baileys (import dinamico, solo qui) → collegamento
 *  → giro d'invio dei lotti → battito ogni 60 s. SIGTERM/SIGINT: chiude il
 *  socket, aspetta il lotto e l'eventuale invio in volo, scrive `fermo`, esce.
 *
 *  UN SOLO PUNTO D'INVIO (commessa 2026-10-30-ponte-invio-manuale): con
 *  `INVII_ATTIVI=1` in config.env il ponte manda, a mano e con limiti, i testi
 *  che il CRM mette in coda (`invio.mjs`, `inviaTesto` di `collega.mjs`); di
 *  serie è spento e il ponte resta di sola lettura. Il ciclo parte dalla
 *  risposta al battito (`invii_in_attesa`), non da un polling fisso.
 *
 *  ⚠️ LOG (obiezione 5 del revisore). Le librerie di cifratura scrivono con
 *   `console.*` per conto loro e i loro oggetti contengono JID e testi: qui
 *   `console.*`, `process.stdout.write`, `process.stderr.write` e i gestori
 *   `uncaughtException`/`unhandledRejection` diventano un codice e un
 *   contatore. Il log (`~/Library/Logs/hgl-ponte-wa.log`, rotazione a 5 MB)
 *   ha solo codici fissi e numeri. Il terminale, se c'è, serve solo al QR e
 *   ai conteggi di `--senza-invio`.
 *  ───────────────────────────────────────────────────────────────────────── */
import { appendFileSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { creaCollegamento } from "./collega.mjs";
import { leggiConfig } from "./config.mjs";
import { creaInvii } from "./invio.mjs";
import { creaFila, spedisci } from "./lotti.mjs";
import { creaQr } from "./qr.mjs";

/** Solo le linee LTS: le stesse di `engines` in package.json. */
export const NODE_AMMESSI = [22, 24];
export const nodeAmmesso = (versione) => NODE_AMMESSI.includes(Number(String(versione).replace(/^v/, "").split(".")[0]));

export const LOG_MAX_BYTE = 5 * 1024 * 1024;
export const BATTITO_MS = 60_000;
const GIORNO_MS = 86_400_000;
const CODICE = /^[a-z_]+$/;

/** La versione di Baileys che il battito dichiara (package.json, esatta). */
export const VERSIONE_BAILEYS = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).dependencies["@whiskeysockets/baileys"];

/** Dove sta tutto sul Mac (PIANO §a1): fuori dal repo, fuori da iCloud, e
 *  diverso dal `com.ponte.whatsapp` di un altro progetto. */
export function percorsiDi(casa) {
  const base = join(casa, "Library/Application Support/HGL/ponte-wa");
  return {
    base,
    app: join(base, "app"),
    auth: join(base, "auth"),
    fila: join(base, "fila"),
    invii: join(base, "invii"),
    config: join(base, "config.env"),
    stato: join(base, "stato.json"),
    lid: join(base, "lid.json"),
    qr: join(base, "qr.png"),
    log: join(casa, "Library/Logs/hgl-ponte-wa.log"),
  };
}

/** Il registro: una riga `<ISO> <codice> chiave=numero …`. Un codice che
 *  non è una parola minuscola diventa `codice_non_valido`; i conteggi che
 *  non sono numeri si scartano. Oltre `maxByte` il file passa in `.1`.
 *  Non lancia mai: il log non deve fermare il ponte. */
export function creaRegistro({ percorso, maxByte = LOG_MAX_BYTE, orologio = Date.now }) {
  let byte = 0;
  try {
    byte = statSync(percorso).size;
  } catch {
    byte = 0;
  }
  return function registro(codice, conteggi = {}) {
    const c = typeof codice === "string" && CODICE.test(codice) ? codice : "codice_non_valido";
    const parti = Object.entries(conteggi ?? {})
      .filter(([k, v]) => CODICE.test(k) && typeof v === "number" && Number.isFinite(v))
      .map(([k, v]) => `${k}=${v}`);
    const riga = `${new Date(orologio()).toISOString()} ${[c, ...parti].join(" ")}\n`;
    try {
      if (byte > 0 && byte + riga.length > maxByte) {
        renameSync(percorso, `${percorso}.1`);
        byte = 0;
      }
      appendFileSync(percorso, riga, { mode: 0o600 });
      byte += Buffer.byteLength(riga);
    } catch {
      // disco pieno o cartella sparita: si va avanti senza log
    }
  };
}

/** Sostituisce `console.*`, le scritture su stdout/stderr e i gestori degli
 *  errori non presi: al registro arriva solo `console_<metodo>`,
 *  `uscita_stdout`, `promessa_rifiutata`, `eccezione` e quante volte (le
 *  prime tre, poi ogni mille). Un'eccezione non presa chiude il processo con
 *  il codice 70: launchd lo rilancia (ThrottleInterval 30 s).
 *  `terminale`: se vero, restituisce la scrittura vera sul terminale (QR e
 *  conteggi); altrimenti null. */
export function blindaUscite(registro, { terminale = Boolean(process.stdout.isTTY) } = {}) {
  const scriviTerminale = terminale ? process.stdout.write.bind(process.stdout) : null;
  const conti = {};
  const conta = (codice) => {
    conti[codice] = (conti[codice] ?? 0) + 1;
    const n = conti[codice];
    if (n <= 3 || n % 1000 === 0) registro(codice, { n });
  };
  console.log = () => conta("console_log");
  console.info = () => conta("console_info");
  console.warn = () => conta("console_warn");
  console.error = () => conta("console_error");
  console.debug = () => conta("console_debug");
  console.trace = () => conta("console_trace");
  console.dir = () => conta("console_dir");
  console.table = () => conta("console_table");
  console.assert = () => conta("console_assert");
  const zitto = (codice) =>
    function scrivi(...argomenti) {
      conta(codice);
      const fatto = argomenti.find((a) => typeof a === "function");
      if (fatto) fatto();
      return true;
    };
  process.stdout.write = zitto("uscita_stdout");
  process.stderr.write = zitto("uscita_stderr");
  process.noDeprecation = true;
  process.on("unhandledRejection", () => conta("promessa_rifiutata"));
  process.on("uncaughtException", () => {
    registro("eccezione");
    process.exit(70);
  });
  return { terminale: scriviTerminale };
}

const numero = (x) => (Number.isFinite(x) ? x : 0);

/** Una mappa di diagnosi ripulita: chiavi `[a-z_]`, valori numeri finiti. */
function soloConti(m) {
  if (!m || typeof m !== "object") return {};
  return Object.fromEntries(Object.entries(m).filter(([k, v]) => CODICE.test(k) && typeof v === "number" && Number.isFinite(v)));
}

/** La diagnosi per il log, in una riga: `scarto_<motivo>`, `tipo_<in|out>_<tipo>`,
 *  `nodo_<tipo di unavailable>` → quante volte. Solo codici e numeri. */
export function contiDiagnosi(d) {
  const conti = {};
  for (const [prefisso, m] of [["scarto", d?.scarti], ["tipo", d?.tipi], ["nodo", d?.nodi]]) {
    for (const [k, v] of Object.entries(soloConti(m))) conti[`${prefisso}_${k}`] = v;
  }
  return conti;
}

/** Il battito (`BattitoPonte`, §b3) da stato del collegamento e fila: solo
 *  parole della lista chiusa, date ISO e numeri. Il QR non c'è mai.
 *  `contatori` resta entro 18 chiavi: il CRM ne tiene 20 con `in_coda` e
 *  `scartati`. `invii` = `{ invii_attivi, invii_ok, invii_ko }` di `invio.mjs`
 *  (assente = ponte senza invii: tre zeri). Il dettaglio va in `diagnosi` (stato.json e log; la rotta del
 *  CRM non lo legge e non lo salva). */
export function corpoBattito(ist, fc, { erroreServer = false, invii = {} } = {}) {
  let stato = ist.stato;
  if (stato === "collegato" && erroreServer) stato = "errore";
  else if (stato === "collegato" && fc.piena) stato = "coda_piena";
  const e = ist.estrazione ?? {};
  const d = ist.diagnosi ?? {};
  return {
    v: 1,
    tipo: "battito",
    stato,
    collegato_dal: ist.collegato_dal ?? null,
    ultimo_messaggio_il: ist.ultimo_messaggio_il ?? null,
    storico: { fatto: Boolean(ist.storico?.fatto), avanzamento: numero(ist.storico?.avanzamento) },
    in_coda: numero(fc.in_coda),
    scartati: numero(fc.scartati),
    contatori: {
      lotti_storico: numero(fc.lotti_storico),
      lotti_vivo: numero(fc.lotti_vivo),
      non_noti_scaduti: numero(fc.non_noti_scaduti),
      divisi: numero(fc.divisi),
      letti: numero(e.letti),
      validi: numero(e.validi),
      chat: numero(e.chat),
      scartati_estrazione: numero(e.letti) - numero(e.validi),
      lid_risolti: numero(e.lid_risolti),
      lid_errori: numero(e.lid_errori),
      storico_rifiutati: numero(e.storico_rifiutati),
      tipo_sconosciuto: numero(d.scarti?.tipo_sconosciuto),
      fanout_ospitati: numero(d.nodi?.hosted_unavailable_fanout),
      fanout_registrati: numero(e.invii_nascosti),
      invii_attivi: numero(invii?.invii_attivi),
      invii_ok: numero(invii?.invii_ok),
      invii_ko: numero(invii?.invii_ko),
    },
    versione: VERSIONE_BAILEYS,
    diagnosi: { scarti: soloConti(d.scarti), tipi: soloConti(d.tipi), nodi: soloConti(d.nodi) },
  };
}

/** Scrittura atomica con permessi 600. */
function scriviJson(percorso, dati) {
  const temporaneo = `${percorso}.tmp-${process.pid}`;
  writeFileSync(temporaneo, `${JSON.stringify(dati, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaneo, percorso);
}

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function main() {
  process.umask(0o077);
  const P = percorsiDi(homedir());
  mkdirSync(dirname(P.log), { recursive: true });
  const registro = creaRegistro({ percorso: P.log });
  const { terminale } = blindaUscite(registro);
  const dici = (testo) => terminale?.(`${testo}\n`);
  const qr = creaQr({ percorso: P.qr, terminale, registro });
  registro("avvio");

  // Un errore di configurazione esce con 0: launchd (KeepAlive solo sulle
  // uscite con errore) non lo rilancia in ciclo; la notifica dice cosa fare.
  if (!nodeAmmesso(process.versions.node)) {
    registro("node_non_lts", { versione: Number(process.versions.node.split(".")[0]) });
    dici(`Questo Node è il ${process.versions.node}: il ponte vuole Node 22 o 24 (LTS). Rilancia installa.sh.`);
    await qr.notifica("node");
    process.exit(0);
  }
  mkdirSync(P.base, { recursive: true, mode: 0o700 });
  const conf = leggiConfig(P.config);
  if (!conf.ok) {
    registro(`config_${conf.errore}`);
    dici(conf.messaggio);
    await qr.notifica("config");
    process.exit(0);
  }
  const { url, token, storicoGiorni, attesaPariSecondi, invii: inviAttivi } = conf.config;
  const senzaInvio = process.argv.includes("--senza-invio");
  if (senzaInvio) registro("senza_invio");

  const fila = creaFila({ cartella: P.fila, attesaPariMs: attesaPariSecondi * 1000 });
  registro("scartati_puliti", { tolti: fila.pulisciScartati() });

  let erroreServer = false;
  let fermo = false;
  let invii = null;
  let inVolo = null;
  let sveglia = null;

  function scriviStato() {
    try {
      scriviJson(P.stato, { ...corpoBattito(col.istantanea(), fila.contatori(), { erroreServer, invii: invii?.contatori() }), aggiornato_il: new Date().toISOString() });
    } catch {
      registro("stato_non_scritto");
    }
  }

  function pianificaGiro() {
    if (senzaInvio || fermo) return;
    if (sveglia) clearTimeout(sveglia);
    sveglia = null;
    const quando = fila.prossimaSveglia();
    if (quando === null) return;
    sveglia = setTimeout(giro, Math.min(Math.max(0, quando - Date.now()), BATTITO_MS));
  }

  /** Spedisce i lotti pronti, uno alla volta (vivi prima, storico al ritmo). */
  async function giro() {
    if (senzaInvio || fermo || inVolo) return;
    inVolo = (async () => {
      let voce;
      while (!fermo && (voce = fila.prossimo())) {
        const r = await spedisci({ url, token, corpo: voce.lotto });
        const e = fila.esito(voce, r);
        if (r.stato === 200) erroreServer = false;
        else if (e.stato === "errore") erroreServer = true;
        registro(`lotto_${e.azione}`, { http: r.stato ?? 0, messaggi: voce.lotto.messaggi.length, pausa_ms: e.pausaStorico });
      }
    })();
    try {
      await inVolo;
    } catch {
      registro("giro_fallito");
    } finally {
      inVolo = null;
      pianificaGiro();
    }
  }

  /** la riga `diagnosi` si scrive solo quando cambia (il log non si gonfia) */
  let ultimaDiagnosi = "";

  async function battito() {
    const corpo = corpoBattito(col.istantanea(), fila.contatori(), { erroreServer, invii: invii?.contatori() });
    scriviStato();
    registro(`battito_${corpo.stato}`, { in_coda: corpo.in_coda, scartati: corpo.scartati, ...corpo.contatori });
    const conti = contiDiagnosi(corpo.diagnosi);
    const firma = JSON.stringify(conti);
    if (firma !== ultimaDiagnosi && Object.keys(conti).length) registro("diagnosi", conti);
    ultimaDiagnosi = firma;
    if (senzaInvio) {
      const k = corpo.contatori;
      dici(`[senza invio] messaggi letti ${k.letti}, validi ${k.validi}, chat ${k.chat}, in fila ${corpo.in_coda}, storico ${corpo.storico.avanzamento}% · stato ${corpo.stato}`);
      return;
    }
    const r = await spedisci({ url, token, corpo });
    if (r.stato === 200) fila.segnalaBuono(); // il database risponde: un 500 ripetuto è colpa del lotto
    if (r.stato === 200) invii?.dopoBattito(r.corpo); // «ce n'è in coda» → il ciclo degli invii
    if (r.stato === 200) erroreServer = false;
    else if (r.stato === 401 || r.stato === 503) erroreServer = true;
    if (r.stato !== 200) registro("battito_non_arrivato", { http: r.stato ?? 0 });
  }

  const baileys = await import("@whiskeysockets/baileys");
  const col = creaCollegamento({
    baileys: { makeWASocket: baileys.makeWASocket ?? baileys.default, useMultiFileAuthState: baileys.useMultiFileAuthState, Browsers: baileys.Browsers },
    percorsi: { auth: P.auth, lid: P.lid },
    fila,
    qr,
    registro,
    storicoDal: storicoGiorni > 0 ? Math.floor(Date.now() / 1000) - storicoGiorni * 86_400 : undefined,
    avvisa: () => {
      scriviStato();
      giro();
    },
  });

  //  Gli invii a mano: spenti di serie (INVII_ATTIVI=0) e mai con --senza-invio.
  invii = creaInvii({
    url,
    token,
    cartella: P.invii,
    attivo: inviAttivi === 1 && !senzaInvio,
    collegato: () => col.istantanea().stato === "collegato",
    inviaTesto: (numero, testo) => col.inviaTesto(numero, testo),
    registro,
  });
  if (inviAttivi === 1 && !senzaInvio) registro("invii_attivi");

  const battiti = setInterval(() => void battito(), BATTITO_MS);
  const pulizia = setInterval(() => registro("scartati_puliti", { tolti: fila.pulisciScartati() }), GIORNO_MS);

  async function chiudi() {
    if (fermo) return;
    fermo = true;
    clearInterval(battiti);
    clearInterval(pulizia);
    if (sveglia) clearTimeout(sveglia);
    col.ferma();
    await Promise.race([Promise.all([inVolo ?? Promise.resolve(), invii.ferma()]), pausa(10_000)]).catch(() => {});
    const corpo = corpoBattito(col.istantanea(), fila.contatori(), { invii: invii.contatori() });
    scriviStato();
    if (!senzaInvio) await spedisci({ url, token, corpo, timeoutMs: 5000 });
    registro("fermo");
    process.exit(0);
  }
  process.on("SIGTERM", () => void chiudi());
  process.on("SIGINT", () => void chiudi());

  await col.avvia();
  void invii.avvia(); // consegna gli esiti rimasti e chiude gli invii a metà (non invia mai da sé)
  void battito();
  giro();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => process.exit(1));
}
