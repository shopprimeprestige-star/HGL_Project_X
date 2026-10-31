/** ── PROVE: INTEGRAZIONE DEL LANCIO MEETLY (31/10/2026) ───────────────────────
 *  Ramo feat/meetly-lancio: unisce la scatola nera, la correzione «dentro ma spenti» e il trasporto
 *  SFU. Qui si provano SOLO i due raccordi nati dall'unione:
 *   1. l'ospite senza camera né microfono quando la stanza è in SFU (il client SFU non pubblica
 *      senza tracce, quindi non può nemmeno abbonarsi: la via è il ripiego su mesh del consulente,
 *      dove la correzione «stallo» negozia in sola ricezione);
 *   2. il rapporto della scatola nera che dice con quale trasporto era la chiamata e perché si è ripiegato.
 *  Le prove sul sorgente leggono il call.tsx vero (corpi di funzione a parentesi bilanciate).
 *  Dati inventati: nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveMeetlyLancio(mod, { c, gruppo, radice }) {
  const R = mod["shop/meetly-sfu-regole"];
  const M = mod["shop/senza-media"];
  const S = mod["shop/scatola-nera"];
  const B = mod["shop/scatola-nera-browser"];
  const src = readFileSync(join(radice, "src/shop/call.tsx"), "utf8");
  const senza = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:"'`])\/\/.*$/gm, "$1");
  const corpo = (firma) => {
    const i = senza.indexOf(firma);
    if (i < 0) return "";
    const a = senza.indexOf("{", senza.indexOf(")", i + firma.length));
    let n = 0;
    for (let k = a; k < senza.length; k++) {
      if (senza[k] === "{") n++;
      else if (senza[k] === "}" && --n === 0) return senza.slice(a, k + 1);
    }
    return "";
  };

  /* ── 1. OSPITE SENZA MEDIA IN SFU ─────────────────────────────────────── */
  gruppo("LANCIO · OSPITE SENZA MEDIA IN SFU: SI RIPIEGA SU MESH, DOVE LO STALLO COPRE IL CASO");
  const t0 = 1_000_000;
  const adotta = R.adottaTrasporto(
    R.nuovoStatoAdozione(),
    { pid: "host0001", tr: "sfu" },
    { adesso: t0, nessunPcConnesso: true },
  );
  c("l'ospite segue il consulente in SFU", "sfu", adotta.azione);
  const dopo = R.adottaTrasporto(adotta.stato, { pid: "host0001", tr: "mesh" }, { adesso: t0 + 31_000, nessunPcConnesso: true });
  c("quando il consulente ripiega e annuncia mesh, l'ospite torna a mesh", "mesh", dopo.azione);
  c("…e da quel momento non riprende l'SFU in questa chiamata", "resta", R.adottaTrasporto(dopo.stato, { pid: "host0001", tr: "sfu" }, { adesso: t0 + 32_000, nessunPcConnesso: true }).azione);
  c(
    "in mesh, senza media ma con la richiesta fallita o appesa, la correzione stallo negozia in sola ricezione",
    true,
    M.puoNegoziare({ haMedia: false, mediaFallita: true }),
  );

  const att = /const ATTESA_OSPITE_MS = ([\d_]+);/.exec(src);
  const attesaOspite = att ? Number(att[1].replace(/_/g, "")) : 0;
  c("il consulente aspetta l'ospite più a lungo dell'attesa per i media (altrimenti ripiega prima che l'ospite sia in sola ricezione)", true, attesaOspite > M.SENZA_MEDIA_DOPO_MS);
  const mi = corpo("async function maybeInitiate(");
  const ramoSfu = mi.slice(0, mi.indexOf("puoNegoziare("));
  c("maybeInitiate, in SFU, arma la sorveglianza dell'ospite (consulente)", true, /sorvegliaOspite\(pid\)/.test(ramoSfu));
  const sv = corpo("function sorvegliaOspite(");
  c("la sorveglianza ripiega su mesh se l'ospite non risulta connesso", true, /connectionState !== "connected"/.test(sv) && /ripiegaSuMesh\("ospite"\)/.test(sv));
  c("l'ospite senza media, in SFU, non crea né annuncia nulla da solo (resta a mesh il compito di collegarlo)", true, /if \(!localStream\) return;/.test(ramoSfu));
  c(
    "senza annuncio (ospite che non pubblica) il peer SFU non risulta mai connesso, quindi la sorveglianza scatta",
    false,
    R.statoPeer({ adesso: t0, chiuso: false, pub: "connected", sub: "connected", disconnessoDa: 0, tracce: false, ultimoSaluto: t0 - 1000 }) === "connected",
  );
  c("chiudiPeerSenzaRoster svuota anche i peer in sola ricezione (ricostruzione dopo il ripiego)", true, /peerSenzaMedia\.clear\(\)/.test(corpo("function chiudiPeerSenzaRoster(")));
  const client = readFileSync(join(radice, "src/shop/meetly-sfu.ts"), "utf8");
  c("il client SFU non pubblica senza tracce (perciò la sola ricezione in SFU non esiste: scelta documentata)", true, /!mid\.audio && !mid\.video/.test(client));

  /* ── 2. LA SCATOLA NERA DICE IL TRASPORTO E IL RIPIEGO ────────────────── */
  gruppo("LANCIO · SCATOLA NERA: TRASPORTO E MOTIVO DEL RIPIEGO NEL RAPPORTO");
  const base = {
    v: 1, rid: "abc123def456", tipo: "blocco", ruolo: "ospite", browser: "Safari 17", sistema: "iOS 17",
    rete: { tipo: "", effettiva: "4g" }, hasTurn: true,
    stati: { signaling: "stable", ice: "connected", connessione: "connected", raccolta: "complete" },
    locali: [], remoti: [], coppia: null,
    segnali: { offerteInviate: 0, offerteRicevute: 0, risposteInviate: 0, risposteRicevute: 0, iceInviati: 0, iceRicevuti: 0, offerteScartate: 0 },
    permessi: { camera: "concesso", microfono: "concesso" }, erroreMedia: "",
    tracce: { locali: { video: 1, audio: 1 }, remote: { video: 0, audio: 0, vive: 0 } },
    incontroMs: 15000, collegatoMs: null,
  };
  const con = (extra) => S.pulisciRapporto({ ...base, ...extra });
  c("un rapporto senza i campi nuovi (versione vecchia) vale mesh senza ripiego", ["mesh", ""], [con({}).trasporto, con({}).ripiego]);
  c("sfu e motivo noto passano", ["sfu", "timeout-sub"], [con({ trasporto: "sfu", ripiego: "timeout-sub" }).trasporto, con({ trasporto: "sfu", ripiego: "timeout-sub" }).ripiego]);
  c("dopo un ripiego il trasporto è mesh e il motivo resta", ["mesh", "ospite"], [con({ trasporto: "mesh", ripiego: "ospite" }).trasporto, con({ trasporto: "mesh", ripiego: "ospite" }).ripiego]);
  c("tutti i motivi del client SFU e di adottaTrasporto sono ammessi", true,
    ["server", "timeout-pub", "timeout-sub", "ice-fallita", "ospite-vecchio", "ospite", "non-configurato", "tr-mesh", "host-nuovo-senza-tr"].every((m) => con({ ripiego: m }).ripiego === m));
  c("un trasporto sconosciuto diventa mesh", "mesh", con({ trasporto: "piramide" }).trasporto);
  c("un motivo libero (nomi, indirizzi) diventa «altro» e non esce", "altro", con({ ripiego: "Mario Rossi 203.0.113.5" }).ripiego);
  c("il motivo non può essere un oggetto né un numero", ["", ""], [con({ ripiego: { a: 1 } }).ripiego, con({ ripiego: 42 }).ripiego]);
  c("nel rapporto pulito non c'è traccia del testo libero", false, /Mario|203\.0\.113/.test(JSON.stringify(con({ ripiego: "Mario Rossi 203.0.113.5" }))));

  //  Il browser compone il rapporto con il trasporto del momento (finto browser, timer dei 15 s accelerato).
  const fin = { navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
  const inviati = [];
  const pc = { signalingState: "stable", iceConnectionState: "checking", connectionState: "connecting", iceGatheringState: "complete", getStats: async () => new Map() };
  const dip = (extra = {}) => ({
    stanza: () => "kfr-mbqd-tzp", ruolo: () => "ospite", iceServers: () => [{ urls: ["turn:t.example:3478"] }],
    peer: () => pc, remoto: () => undefined, locale: () => null, mediaVivo: () => false,
    trasporto: () => "mesh", ripiego: () => "", ...extra,
  });
  const aspetta = (ms) => new Promise((ok) => fin.setTimeout(ok, ms));
  try {
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "x" }, configurable: true });
    globalThis.fetch = async (u, o) => (inviati.push(JSON.parse(o.body)), { ok: true });
    globalThis.setTimeout = (f, ms, ...a) => fin.setTimeout(f, ms >= S.ATTESA_MS ? 5 : ms, ...a);
    const a = B.creaScatola(dip({ trasporto: () => "sfu" }));
    a.incontro("p1");
    await aspetta(80);
    a.chiudiTutto();
    c("il browser scrive il trasporto in uso (sfu)", ["sfu", ""], [inviati[0]?.rapporto?.trasporto, inviati[0]?.rapporto?.ripiego]);
    const b = B.creaScatola(dip({ trasporto: () => "mesh", ripiego: () => "timeout-sub" }));
    b.incontro("p2");
    await aspetta(80);
    b.chiudiTutto();
    c("…e il motivo del ripiego dopo che si è tornati a mesh", ["mesh", "timeout-sub"], [inviati[1]?.rapporto?.trasporto, inviati[1]?.rapporto?.ripiego]);
  } finally {
    if (fin.navigator) Object.defineProperty(globalThis, "navigator", fin.navigator);
    globalThis.fetch = fin.fetch;
    globalThis.setTimeout = fin.setTimeout;
  }

  //  call.tsx: i due dati arrivano dal trasporto vero della chiamata.
  const sc = src.slice(src.indexOf("const scatola = creaScatola("), src.indexOf("const scatola = creaScatola(") + 700);
  c("call.tsx: la scatola riceve trasporto e motivo del ripiego", true, /trasporto: \(\) => trasporto\b/.test(sc) && /ripiego: \(\) => ultimoRipiego\b/.test(sc));
  const rip = corpo("function ripiegaSuMesh(");
  c("ripiegaSuMesh ricorda il motivo", true, /ultimoRipiego = motivo/.test(rip));
  c("azzeraTrasporto lo dimentica (nuova chiamata, rapporti puliti)", true, /ultimoRipiego = ""/.test(corpo("function azzeraTrasporto(")));
  const crm = readFileSync(join(radice, "src/crm/CollegamentiFalliti.tsx"), "utf8");
  c("il riquadro del gestionale mostra il trasporto e il ripiego", true, /\.trasporto/.test(crm) && /\.ripiego/.test(crm));
}
