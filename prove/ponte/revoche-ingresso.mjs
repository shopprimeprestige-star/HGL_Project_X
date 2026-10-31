/** ── PROVE: LE REVOCHE DEL PONTE · L'INGRESSO DEL CRM (ingresso.ts) ─────────
 *
 *  Commessa 2026-10-31, ponte-revoche. Il Mac manda `{ v: 1, tipo: "revoca", chiave }` alla rotta
 *  esistente `POST /api/public/ponte-whatsapp`. `gestisciRichiesta` lo accetta SOLO con la chiave del
 *  ponte e SOLO se riceve la porta `revoche` (come `media` e `invii`: senza, è corpo non valido, cioè
 *  la rotta di prima non cambia). L'utente viene da `porte.utente()`, mai dal corpo.
 *  Le prove di ingresso e di rotta di sempre (`ingresso.mjs`, `rotta.mjs`) non si toccano.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SEGRETO = "s".repeat(32);
const ADESSO = new Date("2026-11-01T09:00:00Z");
const UTENTE = "00000000-0000-4000-8000-000000000001";
const ALTRO_UTENTE = "00000000-0000-4000-8000-000000000002";
const CHIAVE = "bw:393331234567:3EB0A1";

function richiesta(corpo, { token = SEGRETO } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-HGL-Token"] = token;
  return new Request("https://esempio.invalid/api/public/ponte-whatsapp", { method: "POST", headers, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
}

/** Le porte del ponte (tutte da non chiamare) e quelle delle revoche (da chiamare una volta). */
function finte(o = {}) {
  const chiamate = { ponte: [], revoca: [] };
  const avvisi = [];
  const mai = (nome) => async (...a) => {
    chiamate.ponte.push(nome);
    throw new Error(`porta ${nome} non prevista`);
  };
  const porte = {
    utente: async () => (o.utente === undefined ? UTENTE : o.utente),
    candidati: mai("candidati"),
    scrivi: mai("scrivi"),
    promuovi: mai("promuovi"),
    recentiDelPonte: mai("recentiDelPonte"),
    battito: mai("battito"),
    avviso: (codice, conteggi) => avvisi.push([codice, conteggi]),
  };
  const revoche = {
    revoca: async (u, chiave) => {
      chiamate.revoca.push({ u, chiave });
      if (o.rompi) throw { code: o.rompi };
      return o.esito ?? { trovate: 2, marcate: 2 };
    },
  };
  return { porte, revoche, chiamate, avvisi };
}

export async function provePonteRevocheIngresso(mod, { c, gruppo, radice }) {
  const I = mod["ponte/ingresso"];
  const T = mod["ponte/tipi"];
  const corpo = (o = {}) => ({ v: 1, tipo: "revoca", chiave: CHIAVE, ...o });
  const vai = (f, req, extra = {}) => I.gestisciRichiesta(f.porte, { request: req, segreto: SEGRETO, adesso: ADESSO, revoche: f.revoche, ...extra });
  const leggi = async (r) => ({ stato: r.status, corpo: await r.json() });

  gruppo("PONTE WHATSAPP · REVOCHE · INGRESSO DELLA ROTTA (solo con la chiave del ponte)");
  {
    const f = finte();
    const r = await leggi(await vai(f, richiesta(corpo())));
    c("revoca valida: 200 con quante righe ha trovato e marcato", { stato: 200, corpo: { ok: true, trovate: 2, marcate: 2 } }, r);
    c("…la porta è chiamata UNA volta, con l'utente del server e la chiave", [{ u: UTENTE, chiave: CHIAVE }], f.chiamate.revoca);
    c("…e nessuna altra porta del ponte (né lotti, né pari, né battito)", [], f.chiamate.ponte);
    c("…il log è il codice «revoca» con soli contatori numerici", [["revoca", { trovate: 2, marcate: 2 }]], f.avvisi);
    c("…il codice «revoca» è nella lista chiusa dei log", true, T.CODICI_AVVISO.includes("revoca"));
  }
  {
    const f = finte({ esito: { trovate: 0, marcate: 0 } });
    c("riga non ancora arrivata: 200 con zero (il Mac ripassa)", { stato: 200, corpo: { ok: true, trovate: 0, marcate: 0 } }, await leggi(await vai(f, richiesta(corpo()))));
  }
  {
    const f = finte();
    await vai(f, richiesta(corpo({ user_id: ALTRO_UTENTE, utente: ALTRO_UTENTE, userId: ALTRO_UTENTE })));
    c("l'utente non arriva mai dal corpo", [UTENTE], f.chiamate.revoca.map((x) => x.u));
  }

  gruppo("PONTE WHATSAPP · REVOCHE · INGRESSO: CHIAVE, CORPO E GUASTI");
  {
    const quasi = async (req, extra) => {
      const f = finte();
      const r = await leggi(await vai(f, req, extra));
      return { stato: r.stato, errore: r.corpo.errore, porteChiamate: f.chiamate.revoca.length + f.chiamate.ponte.length };
    };
    c("senza chiave del ponte: 401 e la porta non si tocca", { stato: 401, errore: "non_autorizzato", porteChiamate: 0 }, await quasi(richiesta(corpo(), { token: null })));
    c("chiave sbagliata (anche di una cifra): 401", { stato: 401, errore: "non_autorizzato", porteChiamate: 0 }, await quasi(richiesta(corpo(), { token: "x".repeat(32) })));
    c("chiave giusta ma più corta di 32: 503 non_configurato", { stato: 503, errore: "non_configurato", porteChiamate: 0 }, await quasi(richiesta(corpo(), { token: "s".repeat(31) }), { segreto: "s".repeat(31) }));
    c("segreto del server assente: 503 non_configurato", { stato: 503, errore: "non_configurato", porteChiamate: 0 }, await quasi(richiesta(corpo()), { segreto: undefined }));
    c("senza la porta `revoche` il tipo non esiste: 400 corpo_non_valido (la rotta di prima)", { stato: 400, errore: "corpo_non_valido", porteChiamate: 0 }, await quasi(richiesta(corpo()), { revoche: undefined }));

    const storte = {
      "v diversa": corpo({ v: 2 }),
      "v assente": { tipo: "revoca", chiave: CHIAVE },
      "senza chiave": { v: 1, tipo: "revoca" },
      "chiave numero": corpo({ chiave: 5 }),
      "chiave senza bw:": corpo({ chiave: "393331234567:3EB0A1" }),
      "cifre troppo poche": corpo({ chiave: "bw:1234567:3EB0A1" }),
      "cifre troppe": corpo({ chiave: "bw:1234567890123456:3EB0A1" }),
      "cifre con lettere": corpo({ chiave: "bw:39333123456a:3EB0A1" }),
      "id vuoto": corpo({ chiave: "bw:393331234567:" }),
      "id con i due punti": corpo({ chiave: "bw:393331234567:3EB:0A1" }),
      "id con spazio": corpo({ chiave: "bw:393331234567:3EB 0A1" }),
      "id oltre 128": corpo({ chiave: `bw:393331234567:${"A".repeat(129)}` }),
      "chiave con a capo": corpo({ chiave: `${CHIAVE}\n` }),
      "chiave in lista": corpo({ chiave: [CHIAVE] }),
      "corpo non JSON": "{non json",
      "corpo vuoto": "",
      "lista": [],
    };
    for (const [nome, b] of Object.entries(storte)) c(`corpo storto (${nome}): 400 e la porta non si tocca`, { stato: 400, errore: "corpo_non_valido", porteChiamate: 0 }, await quasi(richiesta(b)));

    const grande = await quasi(richiesta(JSON.stringify(corpo({ extra: "x".repeat(T.LIMITI.corpoByte + 10) }))));
    c("corpo oltre 256 KB: 413", { stato: 413, errore: "troppo_grande", porteChiamate: 0 }, grande);

    const senzaUtente = finte({ utente: null });
    const ru = await leggi(await vai(senzaUtente, richiesta(corpo())));
    c("nessun utente configurato: 503 e la revoca non parte", [503, "non_configurato", 0], [ru.stato, ru.corpo.errore, senzaUtente.chiamate.revoca.length]);

    const guasto = finte({ rompi: "XX000" });
    const rg = await leggi(await vai(guasto, richiesta(corpo())));
    c("il database fallisce: 500 database (il Mac ritenta), e il log non porta l'errore", [500, "database", [["database", undefined]]], [rg.stato, rg.corpo.errore, guasto.avvisi]);

    const assente = finte({ rompi: "42883" });
    const ra = await leggi(await vai(assente, richiesta(corpo())));
    c("migrazione non applicata (funzione assente 42883): 500 e avviso funzioni_assenti", [500, [["funzioni_assenti", undefined]]], [ra.stato, assente.avvisi]);

    const rispostaTesto = JSON.stringify(rg.corpo) + JSON.stringify((await leggi(await vai(finte(), richiesta(corpo())))).corpo);
    c("le risposte non contengono la chiave né il numero del cliente", [false, false], [rispostaTesto.includes("bw:"), rispostaTesto.includes("393331234567")]);
  }

  gruppo("PONTE WHATSAPP · REVOCHE · CODICE (rotta e porte, senza toccare le prove di sempre)");
  {
    const ing = readFileSync(join(radice, "src/crm/ponte/ingresso.ts"), "utf8");
    const rotta = readFileSync(join(radice, "src/routes/api.public.ponte-whatsapp.ts"), "utf8");
    const porte = readFileSync(join(radice, "src/crm/ponte/porte.server.ts"), "utf8");
    const tipiSrc = readFileSync(join(radice, "src/crm/ponte/tipi.ts"), "utf8");
    c("PortePonte non cambia: la porta delle revoche è a parte (`PorteRevoche`), come media e invii", [false, true], [/\brevoca\b/.test((tipiSrc.match(/export interface PortePonte \{([\s\S]*?)\n\}/) ?? [])[1] ?? "revoca"), /export interface PorteRevoche\b/.test(tipiSrc)]);
    c("la rotta passa `revoche: porteRevoche()` e importa solo dai 4 moduli di sempre", [true, ["@/crm/ponte/ingresso", "@/crm/ponte/porte.server", "@/crm/push/invio.server", "@tanstack/react-router"]], [/revoche:\s*porteRevoche\(\)/.test(rotta), [...rotta.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort()]);
    c("porte.server.ts esporta porteRevoche e chiama la sola funzione ponte_wa_revoca", [true, ["ponte_wa_revoca"]], [/export function porteRevoche\(\): PorteRevoche/.test(porte), [...porte.slice(porte.indexOf("export function porteRevoche")).split("export function porteIngresso")[0].matchAll(/rpc<[^(]*\(\s*"(\w+)"/g)].map((m) => m[1])]);
    c("ingresso.ts: il ramo revoca sta dopo il controllo della chiave e dopo l'utente del server", true, ing.indexOf("stessaChiave(") < ing.indexOf("await porte.utente()") && ing.indexOf("await porte.utente()") < ing.indexOf("i.revoche!.revoca("));
  }
}
