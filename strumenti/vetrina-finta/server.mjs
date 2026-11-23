/** ── VETRINA FINTA · IL FINTO SUPABASE LOCALE (T75, D91) ───────────────────────
 *  Un piccolo server che parla abbastanza PostgREST per far girare l'app senza il database vero:
 *    · `GET /rest/v1/<tabella>`: `select`, `eq`/`neq`/`is`/`in`/`gt`…, `not.`, `order`, `limit`, `offset`, `maybeSingle`/`single`;
 *    · `POST /rest/v1/<tabella>` (insert, upsert): ACCETTA E SCARTA, risponde 201, non scrive niente (`lp_events`, `public_leads`…);
 *    · `GET /storage/v1/object/public/<bucket>/<percorso>`: le foto di prova (SVG quadrato con la scritta «PROVA»);
 *    · `GET /__vetrina/stato`: lo scenario e l'elenco delle richieste ricevute, per chi collauda.
 *  Quello che non conosce lo dice (400, 404, 405): mai una risposta inventata.
 *
 *  ⚠️ SALVAGUARDIE (la parte che conta, vedi `avvia.mjs` per l'altra metà):
 *    · ascolta SOLO su 127.0.0.1;
 *    · ogni richiesta al database vuole la chiave finta (`CHIAVE_FINTA`): una chiave vera avrebbe risposto 401;
 *    · CORS solo per le pagine su 127.0.0.1 o localhost.
 *  ⚠️ Non apre connessioni verso l'esterno: serve soltanto. */
import { createServer } from "node:http";
import { CHIAVE_FINTA, TABELLE_S1, datiScenario, svgProva } from "./dati.mjs";

const HOST = "127.0.0.1";
const MAX_CORPO = 1_000_000;
const MAX_REGISTRO = 500;
const OPERATORI = { eq: (a, b) => a === b, neq: (a, b) => a !== b, gt: (a, b) => cmp(a, b) > 0, gte: (a, b) => cmp(a, b) >= 0, lt: (a, b) => cmp(a, b) < 0, lte: (a, b) => cmp(a, b) <= 0 };

const cmp = (a, b) => (Number.isFinite(Number(a)) && Number.isFinite(Number(b)) ? Number(a) - Number(b) : a < b ? -1 : a > b ? 1 : 0);
const testoDi = (v) => (v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v));

class ErroreRichiesta extends Error {
  constructor(stato, code, message) {
    super(message);
    this.stato = stato;
    this.code = code;
  }
}

/** Un filtro `colonna=op.valore` (o `not.op.valore`) → una funzione sulla riga. */
function filtro(colonne, colonna, espressione) {
  if (!colonne.includes(colonna)) throw new ErroreRichiesta(400, "42703", `column ${colonna} does not exist`);
  let negato = false, e = espressione;
  if (e.startsWith("not.")) { negato = true; e = e.slice(4); }
  const punto = e.indexOf(".");
  const op = punto < 0 ? "" : e.slice(0, punto), valore = punto < 0 ? "" : e.slice(punto + 1);
  let prova;
  if (op === "is") {
    if (!["null", "true", "false"].includes(valore)) throw new ErroreRichiesta(400, "PGRST100", "finto: `is` vale solo con null, true o false");
    prova = (r) => testoDi(r[colonna]) === (valore === "null" ? null : valore);
  } else if (op === "in") {
    if (!/^\(.*\)$/.test(valore)) throw new ErroreRichiesta(400, "PGRST100", "finto: `in` vuole un elenco fra parentesi");
    const elenco = valore.slice(1, -1).split(",").map((x) => x.replace(/^"|"$/g, ""));
    prova = (r) => elenco.includes(testoDi(r[colonna]) ?? "\u0000");
  } else if (OPERATORI[op]) {
    prova = (r) => { const v = testoDi(r[colonna]); return v !== null && OPERATORI[op](v, valore); };
  } else {
    throw new ErroreRichiesta(400, "PGRST100", `finto: filtro non supportato («${op || e}»)`);
  }
  return negato ? (r) => !prova(r) : prova;
}

/** La lettura di una tabella con i parametri dell'indirizzo → `{ righe, totale, colonne }`. */
function leggi(tabella, params) {
  const { colonne, righe } = tabella;
  const filtri = [];
  let scelte = null, ordine = [], limite = Infinity, da = 0;
  for (const [k, v] of params) {
    if (k === "select") {
      if (v !== "*" && v !== "") {
        if (/[()!:]/.test(v)) throw new ErroreRichiesta(400, "PGRST100", "finto: relazioni, alias e cast nella select non sono supportati");
        scelte = v.split(",").map((x) => x.trim()).filter(Boolean);
        for (const c of scelte) if (c !== "*" && !colonne.includes(c)) throw new ErroreRichiesta(400, "42703", `column ${c} does not exist`);
        if (scelte.includes("*")) scelte = null;
      }
    } else if (k === "order") {
      ordine = v.split(",").map((x) => { const [c, verso = "asc"] = x.split("."); if (!colonne.includes(c)) throw new ErroreRichiesta(400, "42703", `column ${c} does not exist`); return [c, verso === "desc" ? -1 : 1]; });
    } else if (k === "limit") {
      limite = Number(v);
      if (!Number.isInteger(limite) || limite < 0) throw new ErroreRichiesta(400, "PGRST100", "finto: limit non valido");
    } else if (k === "offset") {
      da = Number(v);
      if (!Number.isInteger(da) || da < 0) throw new ErroreRichiesta(400, "PGRST100", "finto: offset non valido");
    } else if (k === "or" || k === "and" || k.includes(".")) {
      throw new ErroreRichiesta(400, "PGRST100", `finto: «${k}» non è supportato`);
    } else if (colonne.includes(k)) {
      filtri.push(filtro(colonne, k, v));
    } else {
      throw new ErroreRichiesta(400, "42703", `column ${k} does not exist`);
    }
  }
  let trovate = righe.filter((r) => filtri.every((f) => f(r)));
  for (const [c, verso] of [...ordine].reverse()) trovate = [...trovate].sort((a, b) => verso * (cmp(testoDi(a[c]) ?? "", testoDi(b[c]) ?? "")));
  const totale = trovate.length;
  trovate = trovate.slice(da, Number.isFinite(limite) ? da + limite : undefined);
  if (scelte) trovate = trovate.map((r) => Object.fromEntries(scelte.map((c) => [c, r[c]])));
  return { righe: trovate, totale, da };
}

const origineLocale = (origine) => {
  try { const u = new URL(origine); return (u.protocol === "http:" || u.protocol === "https:") && (u.hostname === "127.0.0.1" || u.hostname === "localhost"); } catch { return false; }
};

/** Avvia il finto su 127.0.0.1 (porta 0 = una libera). `{ porta, url, scenario, registro, chiudi }`. */
export async function avviaFinto({ scenario = "completo", porta = 0 } = {}) {
  const dati = datiScenario(scenario);
  const registro = [];
  const conteggio = { scartati: 0 };
  const ricorda = (metodo, percorso, stato) => { registro.push({ metodo, percorso, stato }); if (registro.length > MAX_REGISTRO) registro.shift(); };

  const server = createServer((req, res) => {
    const risposta = (stato, corpo, tipo = "application/json; charset=utf-8", extra = {}) => {
      const origine = req.headers.origin;
      const cors = origine && origineLocale(origine)
        ? { "access-control-allow-origin": origine, "access-control-allow-credentials": "true", "access-control-allow-headers": req.headers["access-control-request-headers"] || "*", "access-control-allow-methods": "GET, HEAD, POST, OPTIONS", "access-control-expose-headers": "content-range", vary: "Origin" }
        : {};
      res.writeHead(stato, { "content-type": tipo, "cache-control": "no-store", ...cors, ...extra });
      res.end(req.method === "HEAD" || stato === 204 ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo));
    };
    const errore = (stato, code, message, percorso) => { ricorda(req.method, percorso, stato); risposta(stato, { code, message, details: null, hint: null }); };

    let url;
    try { url = new URL(req.url ?? "/", `http://${HOST}`); } catch { return errore(400, "PGRST100", "indirizzo non valido", "?"); }
    const percorso = url.pathname;
    const metodo = req.method ?? "GET";

    if (metodo === "OPTIONS") return risposta(204, "");
    if (percorso === "/__vetrina/stato") return risposta(200, { scenario: dati.nome, modo: dati.modo, scartati: conteggio.scartati, richieste: registro });

    // le foto di prova: nessuna chiave (come lo storage pubblico)
    const foto = /^\/storage\/v1\/object\/public\/(shop-media|landing-media)\/(.+)$/.exec(percorso);
    if (foto && (metodo === "GET" || metodo === "HEAD")) {
      const svg = svgProva(decodeURIComponent(foto[2]));
      if (!svg) return errore(404, "404", "finto: foto non riconosciuta", percorso);
      ricorda(metodo, percorso, 200);
      return risposta(200, svg, "image/svg+xml; charset=utf-8", { "cache-control": "public, max-age=3600" });
    }

    const rest = /^\/rest\/v1\/([A-Za-z0-9_]+)$/.exec(percorso);
    const rpc = /^\/rest\/v1\/rpc\//.test(percorso);
    if (!rest && !rpc) return errore(404, "404", "finto: indirizzo sconosciuto", percorso);

    // ogni richiesta al database porta la chiave finta: una chiave diversa (magari vera) non passa
    if (req.headers.apikey !== CHIAVE_FINTA) return errore(401, "PGRST301", "finto: chiave non valida (il finto accetta solo la sua)", percorso);
    if (dati.modo === "guasto") return errore(503, "PGRST000", "finto: scenario «guasto», il database non risponde", percorso);
    if (rpc) return errore(404, "PGRST202", "finto: nessuna funzione SQL", percorso);

    const nome = rest[1];
    if (metodo === "POST") {
      // insert e upsert: letti (con un tetto) e scartati
      let letti = 0;
      req.on("data", (pezzo) => { letti += pezzo.length; if (letti > MAX_CORPO) req.destroy(); });
      req.on("end", () => {
        conteggio.scartati++;
        ricorda(metodo, percorso, 201);
        const vuoto = !/return=representation/.test(String(req.headers.prefer ?? ""));
        risposta(201, vuoto ? "" : "[]");
      });
      return;
    }
    if (metodo !== "GET" && metodo !== "HEAD") return errore(405, "PGRST117", `finto: ${metodo} non è supportato`, percorso);

    const tabella = dati.tabelle[nome];
    if (!tabella || (dati.modo === "vecchio" && TABELLE_S1.includes(nome))) {
      return errore(404, "PGRST205", `Could not find the table 'public.${nome}' in the schema cache`, percorso);
    }
    try {
      const { righe, totale, da } = leggi(tabella, url.searchParams);
      const intervallo = `${righe.length ? `${da}-${da + righe.length - 1}` : "*"}/${totale}`;
      if (/pgrst\.object\+json/.test(String(req.headers.accept ?? ""))) {
        if (righe.length !== 1) return errore(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", percorso);
        ricorda(metodo, percorso, 200);
        return risposta(200, righe[0], "application/vnd.pgrst.object+json; charset=utf-8", { "content-range": intervallo });
      }
      ricorda(metodo, percorso, 200);
      risposta(200, righe, "application/json; charset=utf-8", { "content-range": intervallo });
    } catch (e) {
      if (e instanceof ErroreRichiesta) return errore(e.stato, e.code, e.message, percorso);
      throw e;
    }
  });

  await new Promise((ok, no) => { server.once("error", no); server.listen(porta, HOST, ok); });
  const { port } = server.address();
  return {
    porta: port,
    url: `http://${HOST}:${port}`,
    scenario: dati.nome,
    server,
    registro,
    chiudi: () => new Promise((ok) => { server.close(() => ok()); server.closeAllConnections?.(); }),
  };
}
