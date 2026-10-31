/** ── LA SCATOLA NERA DEI COLLEGAMENTI MEETLY (31/10/2026) ───────────────────
 *
 *  Segnalazione del titolare: «titolare e cliente si vedono "dentro" la stanza,
 *  ma ognuno vede l'altro con camera e microfono spenti». La presenza viaggia
 *  sul canale Supabase, il media su una connessione peer-to-peer che a volte non
 *  si forma: e quando succede nessuno sa dire PERCHÉ, perché il guasto si vede
 *  solo dal lato del cliente, che non ha una console.
 *
 *  Questo file è la parte che NON tocca il browser né la rete: decide cosa si
 *  raccoglie, toglie ciò che non deve uscire e traduce i numeri in una frase.
 *  Lo usano il browser (per comporre il rapporto), la rotta (per non fidarsi di
 *  quello che arriva) e il gestionale (per scrivere la riga di diagnosi).
 *  Il pezzo che parla con la rete sta in scatola-nera-browser.ts.
 *
 *  ── ⚠️ COSA NON ESCE MAI ──────────────────────────────────────────────────
 *   · nomi, telefoni, email, testi della chat: il rapporto non li contiene e
 *     `pulisciRapporto` butta ogni campo che non è in elenco;
 *   · INDIRIZZI IP: di un candidato ICE restano il tipo (host/srflx/relay), il
 *     protocollo e la porta. L'indirizzo — anche il nome .local dei browser
 *     recenti — non viene nemmeno copiato;
 *   · il codice della stanza in chiaro: la rotta ne tiene solo un'impronta.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Dopo quanto dall'incontro si guarda se il media remoto è vivo. */
export const ATTESA_MS = 15_000;
/** Un rapporto onesto sta in poche centinaia di byte: oltre, non è il nostro. */
export const LIMITE_BYTE = 8_000;
/** Quanti rapporti accetta una stanza in `FINESTRA_MIN` minuti. Largo apposta: in un gruppo di N
 *  persone le coppie sono N·(N-1) e i «blocco» non devono mangiare il posto degli «esito». */
export const LIMITE_PER_STANZA = 30;
/** Quanti rapporti accetta l'INTERO archivio in `FINESTRA_MIN` minuti, qualunque sia la stanza:
 *  il codice stanza lo sceglie chi chiama, e ruotandolo si aggirerebbe il tetto per stanza. */
export const LIMITE_GLOBALE = 200;
export const FINESTRA_MIN = 10;
/** Oltre questi giorni le righe si buttano (lo fa la rotta, a ogni tanto). */
export const GIORNI_CONSERVAZIONE = 60;

export type TipoCandidato = "host" | "srflx" | "prflx" | "relay";
export type ProtoCandidato = "udp" | "tcp" | "tls";
export type Candidato = { tipo: TipoCandidato; proto: ProtoCandidato; porta: number | null };
export type CandidatoContato = Candidato & { n: number };
export type Permesso = "concesso" | "negato" | "da-chiedere" | "ignoto";

export type Rapporto = {
  v: 1;
  rid: string;
  tipo: "blocco" | "esito";
  ruolo: "consulente" | "ospite";
  browser: string;
  sistema: string;
  rete: { tipo: string; effettiva: string };
  hasTurn: boolean | null;
  stati: { signaling: string; ice: string; connessione: string; raccolta: string };
  locali: CandidatoContato[];
  remoti: CandidatoContato[];
  coppia: { locale: { tipo: string; proto: string; porta?: number }; remoto: { tipo: string; proto: string; porta?: number } } | null;
  segnali: {
    offerteInviate: number;
    offerteRicevute: number;
    risposteInviate: number;
    risposteRicevute: number;
    iceInviati: number;
    iceRicevuti: number;
    offerteScartate: number;
  };
  permessi: { camera: Permesso; microfono: Permesso };
  erroreMedia: string;
  tracce: { locali: { video: number; audio: number }; remote: { video: number; audio: number; vive: number } };
  incontroMs: number;
  collegatoMs: number | null;
};

const TIPI = ["host", "srflx", "prflx", "relay"];
const PROTO = ["udp", "tcp", "tls"];

/** Di una riga candidate: tipo, protocollo e porta. Mai l'indirizzo.
 *  `relayProto` (dallo stats del browser) dice se il TURN è stato raggiunto in
 *  udp, tcp o tls: la riga SDP del candidato relay non lo dice. */
export function riduciCandidato(riga: string, relayProto?: string): Candidato | null {
  const t = String(riga || "").trim().split(/\s+/);
  if (!/^(a=)?candidate:/.test(t[0] || "")) return null;
  const i = t.indexOf("typ");
  const tipo = t[i + 1];
  const proto = (t[2] || "").toLowerCase();
  if (i < 0 || !TIPI.includes(tipo) || (proto !== "udp" && proto !== "tcp")) return null;
  const porta = Number.parseInt(t[5], 10);
  return {
    tipo: tipo as TipoCandidato,
    proto: tipo === "relay" && relayProto === "tls" ? "tls" : proto,
    porta: Number.isInteger(porta) && porta >= 0 && porta <= 65535 ? porta : null,
  };
}

/** Browser e sistema in due parole, senza versioni minori né modello del telefono. */
export function riduciUserAgent(ua: string): { browser: string; sistema: string } {
  const s = String(ua || "");
  const v = (re: RegExp) => re.exec(s)?.[1];
  let browser = "sconosciuto";
  const cerca: [string, RegExp][] = [
    ["Edge", /Edg(?:A|iOS)?\/(\d+)/],
    ["Opera", /OPR\/(\d+)/],
    ["Samsung Internet", /SamsungBrowser\/(\d+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
    ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
    ["Safari", /Version\/(\d+)[^)]*Safari/],
  ];
  for (const [nome, re] of cerca) {
    const n = v(re);
    if (n) {
      browser = `${nome} ${n}`;
      break;
    }
  }
  let sistema = "sconosciuto";
  if (/iPhone|iPad|iPod/.test(s)) sistema = `iOS ${v(/OS (\d+)_/) ?? ""}`.trim();
  else if (/Android/.test(s)) sistema = `Android ${v(/Android (\d+)/) ?? ""}`.trim();
  else if (/Windows/.test(s)) sistema = "Windows";
  else if (/Mac OS X/.test(s)) sistema = "macOS";
  else if (/CrOS/.test(s)) sistema = "ChromeOS";
  else if (/Linux/.test(s)) sistema = "Linux";
  return { browser, sistema };
}

/** Il candidato scelto, come lo racconta `getStats()`: stesse regole di sopra. */
export function candidatoDaStat(s: { candidateType?: string; protocol?: string; port?: number; relayProtocol?: string } | undefined) {
  if (!s) return null;
  const tipo = String(s.candidateType || "");
  const proto = tipo === "relay" && s.relayProtocol === "tls" ? "tls" : String(s.protocol || "");
  if (!TIPI.includes(tipo) || !PROTO.includes(proto)) return null;
  return { tipo, proto, ...(Number.isInteger(s.port) ? { porta: s.port as number } : {}) };
}

/** Una lista di candidati, raggruppata: tipo+protocollo+porta con il numero di volte. */
export function contaCandidati(lista: Candidato[]): CandidatoContato[] {
  const m = new Map<string, CandidatoContato>();
  for (const c of lista) {
    const k = `${c.tipo}/${c.proto}/${c.porta}`;
    const e = m.get(k);
    if (e) e.n++;
    else m.set(k, { ...c, n: 1 });
  }
  return [...m.values()];
}

export function codiceStanzaValido(s: unknown): boolean {
  return typeof s === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(s);
}

/* ── LA PULIZIA: si copia SOLO ciò che è in elenco ────────────────────────── */
const STATI = new Set([
  "nessuno", "ignoto",
  // signaling
  "stable", "have-local-offer", "have-remote-offer", "have-local-pranswer", "have-remote-pranswer",
  // ice / connessione / raccolta
  "new", "checking", "connecting", "connected", "completed", "failed", "disconnected", "closed", "gathering", "complete",
]);
const RETI = new Set(["bluetooth", "cellular", "ethernet", "none", "wifi", "wimax", "other", "unknown"]);
const EFFETTIVE = new Set(["slow-2g", "2g", "3g", "4g"]);
const ERRORI_MEDIA = new Set([
  "NotAllowedError", "SecurityError", "NotFoundError", "NotReadableError", "OverconstrainedError", "AbortError", "TypeError",
]);
const PERMESSI = new Set(["concesso", "negato", "da-chiedere", "ignoto"]);

const IP4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IP6 = /\b[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}\b/gi;
const LOCALE = /\b[\w-]+\.local\b/gi;
const testoBreve = (x: unknown, max = 40) =>
  String(typeof x === "string" ? x : "")
    .replace(IP4, "")
    .replace(IP6, "")
    .replace(LOCALE, "")
    .replace(/[^\w .\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const intero = (x: unknown, max = 1_000_000) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(0, Math.round(x))) : 0;
const dalElenco = (x: unknown, ok: Set<string>, altro: string) => (typeof x === "string" && ok.has(x) ? x : altro);
const oggetto = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

function listaCandidati(x: unknown): CandidatoContato[] {
  if (!Array.isArray(x)) return [];
  const out: CandidatoContato[] = [];
  for (const e of x.slice(0, 24)) {
    const o = oggetto(e);
    if (!TIPI.includes(String(o.tipo)) || !PROTO.includes(String(o.proto))) continue;
    out.push({
      tipo: o.tipo as TipoCandidato,
      proto: o.proto as ProtoCandidato,
      porta: typeof o.porta === "number" && o.porta >= 0 && o.porta <= 65535 ? Math.round(o.porta) : null,
      n: Math.max(1, intero(o.n, 99)),
    });
  }
  return out;
}

function latoCoppia(x: unknown) {
  const o = oggetto(x);
  if (!TIPI.includes(String(o.tipo)) || !PROTO.includes(String(o.proto))) return null;
  return { tipo: String(o.tipo), proto: String(o.proto), ...(typeof o.porta === "number" ? { porta: intero(o.porta, 65535) } : {}) };
}

/** Il rapporto com'è ammesso a uscire dal browser e a entrare nell'archivio.
 *  `null` = non è un rapporto nostro. Ogni campo ha un elenco o un tetto. */
export function pulisciRapporto(x: unknown): Rapporto | null {
  const o = oggetto(x);
  if (o.v !== 1 || typeof o.rid !== "string" || !/^[a-z0-9]{6,32}$/.test(o.rid)) return null;
  if (o.tipo !== "blocco" && o.tipo !== "esito") return null;
  if (o.ruolo !== "consulente" && o.ruolo !== "ospite") return null;
  const rete = oggetto(o.rete);
  const st = oggetto(o.stati);
  const sg = oggetto(o.segnali);
  const pm = oggetto(o.permessi);
  const tr = oggetto(o.tracce);
  const tl = oggetto(tr.locali);
  const trm = oggetto(tr.remote);
  const cp = oggetto(o.coppia);
  const locale = latoCoppia(cp.locale);
  const remoto = latoCoppia(cp.remoto);
  return {
    v: 1,
    rid: o.rid,
    tipo: o.tipo,
    ruolo: o.ruolo,
    browser: testoBreve(o.browser),
    sistema: testoBreve(o.sistema),
    rete: { tipo: dalElenco(rete.tipo, RETI, ""), effettiva: dalElenco(rete.effettiva, EFFETTIVE, "") },
    hasTurn: typeof o.hasTurn === "boolean" ? o.hasTurn : null,
    stati: {
      signaling: dalElenco(st.signaling, STATI, "ignoto"),
      ice: dalElenco(st.ice, STATI, "ignoto"),
      connessione: dalElenco(st.connessione, STATI, "ignoto"),
      raccolta: dalElenco(st.raccolta, STATI, "ignoto"),
    },
    locali: listaCandidati(o.locali),
    remoti: listaCandidati(o.remoti),
    coppia: locale && remoto ? { locale, remoto } : null,
    segnali: {
      offerteInviate: intero(sg.offerteInviate),
      offerteRicevute: intero(sg.offerteRicevute),
      risposteInviate: intero(sg.risposteInviate),
      risposteRicevute: intero(sg.risposteRicevute),
      iceInviati: intero(sg.iceInviati),
      iceRicevuti: intero(sg.iceRicevuti),
      offerteScartate: intero(sg.offerteScartate),
    },
    permessi: { camera: dalElenco(pm.camera, PERMESSI, "ignoto") as Permesso, microfono: dalElenco(pm.microfono, PERMESSI, "ignoto") as Permesso },
    erroreMedia: typeof o.erroreMedia === "string" && o.erroreMedia ? dalElenco(o.erroreMedia, ERRORI_MEDIA, "altro") : "",
    tracce: {
      locali: { video: intero(tl.video, 99), audio: intero(tl.audio, 99) },
      remote: { video: intero(trm.video, 99), audio: intero(trm.audio, 99), vive: intero(trm.vive, 99) },
    },
    incontroMs: intero(o.incontroMs, 86_400_000),
    collegatoMs: typeof o.collegatoMs === "number" ? intero(o.collegatoMs, 86_400_000) : null,
  };
}

/** ── LA DIAGNOSI IN PAROLE SEMPLICI ────────────────────────────────────────
 *  Si va dal guasto più a monte al più a valle: un permesso negato spiega tutto
 *  ciò che viene dopo, un'offerta mai arrivata spiega l'assenza di candidati,
 *  e solo se la segnalazione è andata bene ha senso accusare la rete.
 *  `dove` è la parola da mettere in colonna: Permessi, Segnalazione, Rete, Media. */
export function diagnosi(r: Rapporto): { dove: string; frase: string } {
  const altro = r.ruolo === "consulente" ? "Il cliente" : "Il consulente";
  const sg = r.segnali;

  if (r.tipo === "esito") {
    const s = Math.round((r.collegatoMs ?? r.incontroMs) / 1000);
    const dalRelay = r.coppia?.locale.tipo === "relay" || r.coppia?.remoto.tipo === "relay";
    return { dove: "Collegato", frase: `Si è collegato dopo ${s} secondi${dalRelay ? ", passando dal server TURN" : ""}` };
  }

  // 1. i permessi: senza camera e microfono non si offre né si risponde
  const senzaTracce = r.tracce.locali.video + r.tracce.locali.audio === 0;
  const errNegato = senzaTracce && (r.erroreMedia === "NotAllowedError" || r.erroreMedia === "SecurityError");
  const camNeg = r.permessi.camera === "negato" || (errNegato && r.permessi.microfono !== "negato");
  const micNeg = r.permessi.microfono === "negato";
  if (camNeg && micNeg) return { dove: "Permessi", frase: "Permesso camera e microfono negati" };
  if (camNeg) return { dove: "Permessi", frase: "Permesso camera negato" };
  if (micNeg) return { dove: "Permessi", frase: "Permesso microfono negato" };
  if (senzaTracce && r.erroreMedia === "NotFoundError") return { dove: "Permessi", frase: "Camera o microfono non trovati" };
  if (senzaTracce && r.erroreMedia === "NotReadableError")
    return { dove: "Permessi", frase: "Camera o microfono occupati da un altro programma" };

  // 2. la segnalazione: offerta e risposta
  if (sg.offerteScartate > 0 && senzaTracce)
    return { dove: "Permessi", frase: "L'offerta dell'altro è stata scartata: camera e microfono non erano aperti" };
  if (sg.offerteInviate === 0 && sg.offerteRicevute === 0) return { dove: "Segnalazione", frase: "Nessun aggancio è mai partito" };
  if (sg.offerteInviate > 0 && sg.risposteRicevute === 0) return { dove: "Segnalazione", frase: `${altro} non ha mai ricevuto l'aggancio` };
  if (sg.offerteRicevute > 0 && sg.risposteInviate === 0)
    return { dove: "Segnalazione", frase: "L'aggancio dell'altro è arrivato ma non siamo riusciti a rispondere" };

  // 3. agganciati ma senza video né audio
  if (r.stati.connessione === "connected" && r.tracce.remote.vive === 0)
    return { dove: "Media", frase: "Connessi, ma l'altro non manda né video né audio" };

  // 4. la rete
  if (r.hasTurn === false)
    return { dove: "Rete", frase: "Le credenziali TURN non sono arrivate: la rete non ha una via di scampo" };
  if (r.locali.length === 0) return { dove: "Rete", frase: "Il browser non ha trovato nessun indirizzo di rete" };
  if (!r.locali.some((c) => c.tipo === "relay")) return { dove: "Rete", frase: "Rete che blocca: nessun candidato relay" };
  if (r.remoti.length === 0 && sg.iceRicevuti === 0)
    return { dove: "Segnalazione", frase: "Dall'altro lato non è arrivato nessun indirizzo di rete" };
  if (r.stati.connessione === "failed" || r.stati.ice === "failed")
    return { dove: "Rete", frase: "Connessione fallita: i due dispositivi non sono riusciti a raggiungersi" };
  return { dove: "Rete", frase: "Connessione rimasta in attesa: nessun percorso di rete trovato" };
}
