/** ── PROVE: LA SCATOLA NERA DEI COLLEGAMENTI MEETLY (31/10/2026) ───────────
 *  Commessa 2026-10-31-meetly-connessione, parte A. Si prova la parte pura
 *  (src/shop/scatola-nera.ts): come si tolgono gli indirizzi dai candidati, che
 *  cosa lascia passare il rapporto, e la frase di diagnosi in parole semplici.
 *  Indirizzi usati: solo quelli riservati alla documentazione (RFC 5737/3849). */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function proveScatolaNera(mod, { c, gruppo, radice }) {
  const S = mod["shop/scatola-nera"];
  const B = mod["shop/scatola-nera-browser"];

  gruppo("SCATOLA NERA: I CANDIDATI SENZA INDIRIZZI");
  const srflx =
    "candidate:842163049 1 udp 1677729535 203.0.113.5 54321 typ srflx raddr 192.168.1.20 rport 54321 generation 0 ufrag abcd network-cost 999";
  c("srflx: tipo, protocollo e porta", { tipo: "srflx", proto: "udp", porta: 54321 }, S.riduciCandidato(srflx));
  c("niente indirizzi nel risultato", false, /203\.0\.113|192\.168/.test(JSON.stringify(S.riduciCandidato(srflx))));
  c(
    "host con nome mDNS",
    { tipo: "host", proto: "udp", porta: 50123 },
    S.riduciCandidato("a=candidate:1 1 udp 2113937151 3f2b1c4e-aaaa-bbbb-cccc-0123456789ab.local 50123 typ host generation 0"),
  );
  c(
    "relay TCP su IPv6",
    { tipo: "relay", proto: "tcp", porta: 443 },
    S.riduciCandidato("candidate:3 1 tcp 41885439 2001:db8::1 443 typ relay raddr :: rport 0 tcptype passive"),
  );
  c("relay col protocollo dello stats (tls)", { tipo: "relay", proto: "tls", porta: 5349 }, S.riduciCandidato("candidate:4 1 udp 41885439 198.51.100.7 5349 typ relay raddr 0.0.0.0 rport 0", "tls"));
  c("candidato vuoto (fine raccolta) = niente", null, S.riduciCandidato(""));
  c("testo senza senso = niente", null, S.riduciCandidato("ciao a tutti"));
  c("tipo sconosciuto = niente", null, S.riduciCandidato("candidate:1 1 udp 1 203.0.113.5 1 typ strano"));

  gruppo("SCATOLA NERA: BROWSER E SISTEMA RIDOTTI");
  const chrome = S.riduciUserAgent(
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36",
  );
  c("Chrome su Android", { browser: "Chrome 130", sistema: "Android 14" }, chrome);
  c(
    "Safari su iPhone",
    { browser: "Safari 17", sistema: "iOS 17" },
    S.riduciUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
  );
  c(
    "Edge su Windows",
    { browser: "Edge 130", sistema: "Windows" },
    S.riduciUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.46"),
  );
  c(
    "Firefox su Mac",
    { browser: "Firefox 131", sistema: "macOS" },
    S.riduciUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0"),
  );
  c("user agent vuoto", { browser: "sconosciuto", sistema: "sconosciuto" }, S.riduciUserAgent(""));

  gruppo("SCATOLA NERA: IL RAPPORTO PASSA SOLO CIÒ CHE SI È DECISO");
  const base = {
    v: 1,
    rid: "abc123def456",
    tipo: "blocco",
    ruolo: "consulente",
    browser: "Chrome 130",
    sistema: "macOS",
    rete: { tipo: "wifi", effettiva: "4g" },
    hasTurn: true,
    stati: { signaling: "have-local-offer", ice: "checking", connessione: "connecting", raccolta: "complete" },
    locali: [
      { tipo: "host", proto: "udp", porta: 50123, n: 1 },
      { tipo: "srflx", proto: "udp", porta: 54321, n: 1 },
      { tipo: "relay", proto: "udp", porta: 3478, n: 1 },
    ],
    remoti: [{ tipo: "srflx", proto: "udp", porta: 40000, n: 1 }],
    coppia: null,
    segnali: { offerteInviate: 1, offerteRicevute: 0, risposteInviate: 0, risposteRicevute: 1, iceInviati: 3, iceRicevuti: 1, offerteScartate: 0 },
    permessi: { camera: "concesso", microfono: "concesso" },
    erroreMedia: "",
    tracce: { locali: { video: 1, audio: 1 }, remote: { video: 0, audio: 0, vive: 0 } },
    incontroMs: 15012,
    collegatoMs: null,
    trasporto: "mesh",
    ripiego: "",
  };
  const con = (extra) => ({ ...base, ...extra });
  c("un rapporto buono passa uguale", base, S.pulisciRapporto(base));
  c("non-oggetto = niente", null, S.pulisciRapporto("ciao"));
  c("tipo sbagliato = niente", null, S.pulisciRapporto(con({ tipo: "altro" })));
  c("ruolo sbagliato = niente", null, S.pulisciRapporto(con({ ruolo: "mago" })));
  const sporco = S.pulisciRapporto(
    con({
      nome: "Mario Rossi",
      telefono: "+393331234567",
      email: "m@r.it",
      browser: "Chrome 130 da 203.0.113.9",
      locali: [{ tipo: "host", proto: "udp", porta: 1, n: 1, ip: "203.0.113.5", address: "198.51.100.2" }],
      stati: { signaling: "stable", ice: "203.0.113.5", connessione: "connected", raccolta: "complete", x: "y" },
    }),
  );
  const testo = JSON.stringify(sporco);
  c("i campi non previsti spariscono", false, /Mario|333123|m@r\.it|"ip"|address|"x"/.test(testo));
  c("nessun indirizzo IP nel testo", false, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(testo));
  c("uno stato fuori elenco diventa «ignoto»", "ignoto", sporco.stati.ice);
  c("i contatori sono numeri non negativi", true, S.pulisciRapporto(con({ segnali: { ...base.segnali, iceInviati: -4, offerteInviate: "x" } })).segnali.iceInviati === 0);
  c("le liste di candidati hanno un tetto", true, S.pulisciRapporto(con({ locali: Array.from({ length: 200 }, (_, i) => ({ tipo: "host", proto: "udp", porta: i, n: 1 })) })).locali.length <= 24);
  c("una stringa lunga è tagliata", true, S.pulisciRapporto(con({ browser: "x".repeat(500) })).browser.length <= 40);
  c("rid con simboli = niente", null, S.pulisciRapporto(con({ rid: "../etc/passwd" })));
  c("la dimensione resta piccola", true, JSON.stringify(S.pulisciRapporto(base)).length < 2000);

  gruppo("SCATOLA NERA: LA FRASE IN PAROLE SEMPLICI");
  const d = (extra) => S.diagnosi(con(extra));
  c(
    "offerta senza risposta, lato consulente",
    "Il cliente non ha mai ricevuto l'aggancio",
    d({ segnali: { ...base.segnali, risposteRicevute: 0, iceRicevuti: 0 }, remoti: [] }).frase,
  );
  c(
    "offerta senza risposta, lato ospite",
    "Il consulente non ha mai ricevuto l'aggancio",
    d({ ruolo: "ospite", segnali: { ...base.segnali, risposteRicevute: 0 } }).frase,
  );
  c(
    "nessun relay con TURN presente",
    "Rete che blocca: nessun candidato relay",
    d({ locali: base.locali.filter((x) => x.tipo !== "relay") }).frase,
  );
  c("permesso camera negato (permesso)", "Permesso camera negato", d({ permessi: { camera: "negato", microfono: "concesso" } }).frase);
  c(
    "permesso camera negato (errore all'apertura, senza tracce)",
    "Permesso camera negato",
    d({ erroreMedia: "NotAllowedError", tracce: { locali: { video: 0, audio: 0 }, remote: base.tracce.remote } }).frase,
  );
  c("permesso microfono negato", "Permesso microfono negato", d({ permessi: { camera: "concesso", microfono: "negato" } }).frase);
  c("permessi negati entrambi", "Permesso camera e microfono negati", d({ permessi: { camera: "negato", microfono: "negato" } }).frase);
  c(
    "errore vecchio ma ora le tracce ci sono: non conta",
    false,
    /Permesso/.test(d({ erroreMedia: "NotAllowedError" }).frase),
  );
  c(
    "nessuna camera trovata",
    "Camera o microfono non trovati",
    d({ erroreMedia: "NotFoundError", tracce: { locali: { video: 0, audio: 0 }, remote: base.tracce.remote } }).frase,
  );
  c(
    "offerta scartata perché senza media",
    "L'offerta dell'altro è stata scartata: camera e microfono non erano aperti",
    d({ ruolo: "ospite", segnali: { ...base.segnali, offerteInviate: 0, offerteRicevute: 2, offerteScartate: 2, risposteInviate: 0, risposteRicevute: 0 }, tracce: { locali: { video: 0, audio: 0 }, remote: base.tracce.remote } }).frase,
  );
  c(
    "nessuna offerta scambiata",
    "Nessun aggancio è mai partito",
    d({ segnali: { offerteInviate: 0, offerteRicevute: 0, risposteInviate: 0, risposteRicevute: 0, iceInviati: 0, iceRicevuti: 0, offerteScartate: 0 } }).frase,
  );
  c(
    "offerta arrivata ma risposta non uscita",
    "L'aggancio dell'altro è arrivato ma non siamo riusciti a rispondere",
    d({ segnali: { ...base.segnali, offerteInviate: 0, offerteRicevute: 1, risposteInviate: 0, risposteRicevute: 0 } }).frase,
  );
  c(
    "TURN mai arrivato al browser",
    "Le credenziali TURN non sono arrivate: la rete non ha una via di scampo",
    d({ hasTurn: false }).frase,
  );
  c(
    "nessun indirizzo di rete raccolto",
    "Il browser non ha trovato nessun indirizzo di rete",
    d({ locali: [] }).frase,
  );
  c(
    "dall'altro lato nessun indirizzo",
    "Dall'altro lato non è arrivato nessun indirizzo di rete",
    d({ remoti: [], segnali: { ...base.segnali, iceRicevuti: 0 } }).frase,
  );
  c(
    "connessi ma senza media",
    "Connessi, ma l'altro non manda né video né audio",
    d({ stati: { ...base.stati, connessione: "connected", ice: "connected" } }).frase,
  );
  c(
    "connessione fallita con relay presente",
    "Connessione fallita: i due dispositivi non sono riusciti a raggiungersi",
    d({ stati: { ...base.stati, connessione: "failed", ice: "failed" } }).frase,
  );
  c("rimasta in attesa", "Connessione rimasta in attesa: nessun percorso di rete trovato", d({}).frase);
  c("«dove si è fermato»: segnalazione", "Segnalazione", d({ segnali: { ...base.segnali, risposteRicevute: 0 } }).dove);
  c("«dove si è fermato»: rete", "Rete", d({ locali: base.locali.filter((x) => x.tipo !== "relay") }).dove);
  c("«dove si è fermato»: permessi", "Permessi", d({ permessi: { camera: "negato", microfono: "concesso" } }).dove);
  const esito = S.diagnosi(con({ tipo: "esito", collegatoMs: 23400, coppia: { locale: { tipo: "host", proto: "udp" }, remoto: { tipo: "srflx", proto: "udp" } } }));
  c("esito: collegato dopo N secondi", "Si è collegato dopo 23 secondi", esito.frase);
  c("esito: dove", "Collegato", esito.dove);
  c(
    "esito passato dal relay",
    "Si è collegato dopo 9 secondi, passando dal server TURN",
    S.diagnosi(con({ tipo: "esito", collegatoMs: 9100, coppia: { locale: { tipo: "relay", proto: "udp" }, remoto: { tipo: "host", proto: "udp" } } })).frase,
  );

  gruppo("SCATOLA NERA: TETTI E IMPIANTO");
  c("si guarda dopo 15 secondi", 15000, S.ATTESA_MS);
  c("limite di dimensione del corpo", true, S.LIMITE_BYTE >= 2000 && S.LIMITE_BYTE <= 16000);
  c("codice stanza valido", true, S.codiceStanzaValido("kfr-mbqd-tzp"));
  c("codice stanza con simboli = no", false, S.codiceStanzaValido("../../x"));
  c("codice stanza vuoto = no", false, S.codiceStanzaValido(""));
  c("tetto per stanza abbastanza largo per un gruppo", true, S.LIMITE_PER_STANZA >= 30);
  c("esiste anche un tetto globale", true, S.LIMITE_GLOBALE >= 100 && S.LIMITE_GLOBALE <= 1000);

  gruppo("SCATOLA NERA: IL BROWSER NON SI FERMA MAI");
  //  Si finge un browser: `navigator` senza `permissions` (iOS vecchi) e il timer dei 15 s accelerato.
  const fin = { navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
  const inviati = [];
  const pc = { signalingState: "have-local-offer", iceConnectionState: "checking", connectionState: "connecting", iceGatheringState: "complete", getStats: async () => new Map() };
  const dip = (extra = {}) => ({
    stanza: () => "kfr-mbqd-tzp",
    ruolo: () => "ospite",
    iceServers: () => [{ urls: ["turn:t.example:3478"] }],
    peer: () => pc,
    remoto: () => undefined,
    locale: () => null,
    mediaVivo: () => false,
    trasporto: () => "mesh",
    ripiego: () => "",
    ...extra,
  });
  const aspetta = (ms) => new Promise((ok) => fin.setTimeout(ok, ms));
  try {
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1" }, configurable: true });
    globalThis.fetch = async (u, o) => (inviati.push(JSON.parse(o.body)), { ok: true });
    globalThis.setTimeout = (f, ms, ...a) => fin.setTimeout(f, ms >= S.ATTESA_MS ? 5 : ms, ...a);
    const errori = [];
    const quando = (e) => errori.push(e);
    process.on("unhandledRejection", quando);
    process.on("uncaughtException", quando);

    //  1) niente `navigator.permissions`: il rapporto parte lo stesso, coi permessi «ignoto»
    const a = B.creaScatola(dip());
    a.incontro("p1");
    await aspetta(80);
    c("senza navigator.permissions il rapporto parte comunque", 1, inviati.length);
    c("…con i permessi «ignoto»", { camera: "ignoto", microfono: "ignoto" }, inviati[0]?.rapporto?.permessi);
    a.chiudiTutto();

    //  2) `permissions.query` che lancia o rifiuta: stessa cosa
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "x", permissions: { query: () => { throw new Error("no"); } } }, configurable: true });
    const b = B.creaScatola(dip());
    b.incontro("p2");
    await aspetta(80);
    c("se permissions.query lancia, il rapporto parte comunque", 2, inviati.length);
    b.chiudiTutto();

    //  3) `mediaVivo` che lancia: nessun errore per la pagina, niente rapporto
    const d = B.creaScatola(dip({ mediaVivo: () => { throw new Error("rotto"); } }));
    d.incontro("p3");
    await aspetta(80);
    await aspetta(20);
    c("se mediaVivo lancia, nessun errore non gestito", 0, errori.length);
    c("…e nessun rapporto", 2, inviati.length);
    d.chiudiTutto();
    process.off("unhandledRejection", quando);
    process.off("uncaughtException", quando);
  } finally {
    if (fin.navigator) Object.defineProperty(globalThis, "navigator", fin.navigator);
    globalThis.fetch = fin.fetch;
    globalThis.setTimeout = fin.setTimeout;
  }

  const rotta = readFileSync(join(radice, "src/routes/api.public.meetly-diagnosi.ts"), "utf8");
  c("la rotta controlla la dimensione", true, /LIMITE_BYTE/.test(rotta));
  c("la rotta limita la frequenza per stanza", true, /LIMITE_PER_STANZA/.test(rotta));
  c("la rotta non salva il codice stanza in chiaro", false, /stanza:\s*sess\b/.test(rotta));
  c("la rotta guarda content-length prima di leggere il corpo", true, /content-length/i.test(rotta) && rotta.indexOf("content-length") < rotta.indexOf("request.text()"));
  c("la rotta ha il tetto globale", true, /LIMITE_GLOBALE/.test(rotta));
  c("«tabella assente» solo coi codici 42P01 / PGRST205", false, /meetly_diagnosi\/\.test\(/.test(rotta) && /TABELLA_ASSENTE[\s\S]{0,200}message/.test(rotta));
  c("la lettura chiede le credenziali del gestionale", true, /chiamanteCRM/.test(rotta) && /puo\("consulenti"\)/.test(rotta));
  const sql = readFileSync(join(radice, "supabase/migrations/20261031120000_meetly_diagnosi.sql"), "utf8");
  c("migrazione: RLS attiva", true, /ENABLE ROW LEVEL SECURITY/.test(sql));
  c("migrazione: niente accesso ad anon e authenticated", true, /REVOKE ALL ON public\.meetly_diagnosi FROM anon, authenticated/.test(sql));
  c("migrazione: nessun DROP né DELETE", false, /\bDROP\s+TABLE|\bDELETE\s+FROM/i.test(sql.replace(/^--.*$/gm, "")));
  const call = readFileSync(join(radice, "src/shop/call.tsx"), "utf8");
  c("call.tsx: la scatola è agganciata", true, /scatola-nera-browser/.test(call) && /scatola\.incontro\(/.test(call));
}
