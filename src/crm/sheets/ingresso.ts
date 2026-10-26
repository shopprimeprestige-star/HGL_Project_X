/** ── L'INGRESSO DEI LEAD DAL FOGLIO GOOGLE ─────────────────────────────────
 *
 *  Commessa 2026-10-25 (lead da Google Sheets), compito S. Il foglio dove Meta
 *  Lead Ads scrive i lead ha uno script (strumenti/google-sheets/ingresso-crm.gs)
 *  che manda ogni riga nuova a `POST /api/public/sheets-ingresso`. Qui sta tutta
 *  la logica, PURA: niente rete, niente database. Le porte vere stanno in
 *  `sheets/porte.server.ts`, la rotta in `routes/api.public.sheets-ingresso.ts`,
 *  la parte che decide nel database è S1 (`sheets_ingresso_scrivi`). Prove in
 *  `prove/sheets/ingresso.mjs`.
 *
 *  ⚠️ LA RIGA SI LEGGE CON LE STESSE REGOLE DEL FILE DI META. Le celle arrivano
 *   già divise e vanno a `traduciRighe` (la stessa funzione che dopo la
 *   divisione usa `traduciCsv`): un lead dal foglio è identico a uno caricato da
 *   file, a parte l'origine. Niente CSV rifatto: una risposta libera del modulo
 *   con un a capo si spezzerebbe in due schede.
 *  ⚠️ Mai nomi, numeri, testi o id del lead in risposta o nei log. Degli errori
 *   del database si tiene SOLO `code`: il messaggio di Postgres su `crm_leads`
 *   («Failing row contains …») contiene il `data` col telefono.
 *  ⚠️ L'ordine è quello della rotta ManyChat: PRIMA il segreto e la chiave,
 *   POI il corpo. Una richiesta senza chiave non costa una lettura, e 413/400 si
 *   vedono solo con la chiave giusta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { conListaOrigine, traduciRighe } from "../import-backup";
import { patchRicarico } from "../importa/ricarico";
import { leggiCorpoLimitato, stessaChiave } from "../manychat/ritorno";
import { chiaveTelefono } from "../telefono-doppio";
import type { LeadData } from "../types";

/** Il corpo che manda lo script (versione 1, piano §2a). */
export interface RichiestaIngresso {
  versione: 1;
  foglio: { id: string; nome: string; scheda: string };
  /** la riga del foglio, intero ≥ 2 */
  riga: number;
  intestazioni: string[];
  /** stessa lunghezza di `intestazioni`, ogni cella ≤ 1000 caratteri */
  valori: string[];
}

/** Gli esiti che lo script scrive nella scheda «Invii al CRM» del foglio. */
export type EsitoIngresso = "nuovo" | "ritorno" | "gia_ricevuto" | "gia_presente" | "scartata";

/** Il tetto di righe al giorno (ora di Roma): lo stesso `300` di S1 in SQL
 *  (`TETTO_RIGHE_GIORNO`). Con la chiave rubata è il massimo di schede che si
 *  possono creare in un giorno. */
export const TETTO_RIGHE_GIORNO = 300;

/** Le ultime chiavi d'ingresso tenute sulla scheda di ritorno (`ricarico.chiaviIngresso`). */
const CHIAVI_TENUTE = 5;
/** Quante volte si riprova a segnare il ritorno se la scheda cambia sotto di noi. */
const TENTATIVI_RITORNO = 3;

/** Limiti del corpo (piano §2a). */
const MAX_CELLE = 60;
const MAX_CELLA = 1000;
const MAX_NOME = 100;
const MAX_ID_FOGLIO = 200;

/** La scheda pronta da scrivere, o il motivo per cui la riga si scarta. */
export type SchedaDaRiga = { data: LeadData; chiave: string; tel9: string } | { scartata: string };

/** Come la scheda si legge e si scrive per segnare un ritorno. `versione` è
 *  l'`updated_at` letto: si scrive solo se combacia ancora (come `updateLead`). */
export interface SchedaLetta {
  data: Partial<LeadData>;
  versione: string;
}

/** Le porte vere (o finte, nelle prove). Chi non riesce LANCIA `{ code }`. */
export interface PorteIngresso {
  /** l'utente dell'installazione (`manychat_config.user_id`), `null` se manca */
  utente(): Promise<string | null>;
  /** `sheets_ingresso_scrivi` (S1): una transazione che decide tutto. */
  scrivi(i: {
    userId: string;
    chiave: string;
    tel9: string;
    metaId: string;
    /** il nome del foglio, mai l'id del file Google */
    foglio: string;
    riga: number;
    data: LeadData;
  }): Promise<{ esito: EsitoIngresso | "tetto"; leadId?: string; stato?: string }>;
  leggiScheda(userId: string, leadId: string): Promise<SchedaLetta | null>;
  /** `true` se ha scritto (la versione combaciava ancora). */
  scriviScheda(
    userId: string,
    leadId: string,
    data: Partial<LeadData>,
    versione: string,
  ): Promise<boolean>;
  /** `sheets_ingresso_esito` (S1): «ritorno da segnare» diventa «ritorno». */
  chiudi(i: { userId: string; chiave: string; esito: EsitoIngresso }): Promise<boolean>;
}

/* ── LA FORMA DEL CORPO ─────────────────────────────────────────────────── */

const senzaNulli = (t: string) => t.split("\u0000").join("");

function elencoDiTesto(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_CELLE) return null;
  const fuori: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || x.length > MAX_CELLA) return null;
    fuori.push(senzaNulli(x));
  }
  return fuori;
}

/** Controlla la forma del JSON e i limiti (piano §2a). `null` = forma sbagliata.
 *  Il carattere nullo si toglie (Postgres lo rifiuta in un `jsonb`). */
export function leggiRichiesta(json: unknown): RichiestaIngresso | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (o.versione !== 1) return null;
  const f = o.foglio as Record<string, unknown> | null;
  if (!f || typeof f !== "object") return null;
  if (typeof f.id !== "string" || f.id.length < 1 || f.id.length > MAX_ID_FOGLIO) return null;
  if (typeof f.nome !== "string" || f.nome.length > MAX_NOME) return null;
  if (typeof f.scheda !== "string" || f.scheda.length > MAX_NOME) return null;
  if (typeof o.riga !== "number" || !Number.isInteger(o.riga) || o.riga < 2 || o.riga > 10_000_000)
    return null;
  const intestazioni = elencoDiTesto(o.intestazioni);
  const valori = elencoDiTesto(o.valori);
  if (!intestazioni || !valori || intestazioni.length !== valori.length) return null;
  return {
    versione: 1,
    foglio: { id: senzaNulli(f.id), nome: senzaNulli(f.nome), scheda: senzaNulli(f.scheda) },
    riga: o.riga,
    intestazioni,
    valori,
  };
}

/* ── DALLA RIGA ALLA SCHEDA ─────────────────────────────────────────────── */

async function impronta(testo: string): Promise<string> {
  const hash = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo)),
  );
  let esa = "";
  for (const b of hash.slice(0, 16)) esa += b.toString(16).padStart(2, "0");
  return esa;
}

/** La chiave d'idempotenza: `m:<cifre dell'id Meta>` oppure `f:` + SHA-256
 *  (32 caratteri esadecimali) di foglio, ultime 9 cifre del numero, data del
 *  modulo, nome e cognome; senza numero e senza data, di tutte le celle unite.
 *  ⚠️ Non dipende dal numero di riga: se il foglio viene ordinato la stessa riga
 *   dà la stessa chiave e il CRM risponde «già ricevuto». */
export async function chiaveIngresso(d: Partial<LeadData>, r: RichiestaIngresso): Promise<string> {
  if (d.metaLeadId) return `m:${d.metaLeadId.replace(/\D/g, "")}`;
  const tel9 = chiaveTelefono(d.telefono);
  const data = d.listaOrigine?.dataDalFile ? (d.createdAt ?? "") : "";
  const base =
    tel9 || data
      ? [r.foglio.id, tel9, data, d.nome ?? "", d.cognome ?? ""].join("|")
      : [r.foglio.id, ...r.valori].join("␟");
  return `f:${await impronta(base)}`;
}

/** Dalla riga del foglio alla scheda: `traduciRighe`, poi l'origine, il fatto
 *  «ha lasciato il numero nel modulo», `stato: "da_contattare"`,
 *  `importato: true`, `consulenteId: null`. Quello che decide il foglio si
 *  ferma ai campi che `traduciRighe` sa leggere: una colonna «stato» o
 *  «consulenteId» scritta a mano non conta. */
export async function schedaDaRiga(r: RichiestaIngresso, adesso: Date): Promise<SchedaDaRiga> {
  const lead = traduciRighe(r.intestazioni, [r.valori], { unaRigaSola: true }).leads[0];
  if (!lead) return { scartata: "senza nome né telefono" };
  const foglio = r.foglio.nome.trim() || "Foglio Google";
  const letta = conListaOrigine(lead, `Google Sheets · ${foglio}`, adesso);
  //  ⚠️ `il` = la data del modulo se si legge, altrimenti `null`: mai l'ora
  //   d'ingresso come ripiego (un `il` nullo non vale come consenso).
  const il = letta.listaOrigine?.dataDalFile ? letta.createdAt : null;
  const data: LeadData = {
    ...letta,
    stato: "da_contattare",
    importato: true,
    consulenteId: null,
    origineIngresso: {
      via: "google_sheets",
      foglio,
      ...(r.foglio.scheda.trim() ? { scheda: r.foglio.scheda.trim() } : {}),
      riga: r.riga,
      il: adesso.toISOString(),
    },
    //  Il foglio lo riempie Meta Lead Ads: chi è qui ha lasciato il numero in un
    //  modulo. Senza telefono non c'è niente a cui scrivere.
    ...(letta.telefono.trim()
      ? { consensoModulo: { whatsapp: true, il, via: "modulo_meta", fonte: "google_sheets" } }
      : {}),
  };
  return { data, chiave: await chiaveIngresso(data, r), tel9: chiaveTelefono(data.telefono) };
}

/* ── IL CONTATTO DI RITORNO ─────────────────────────────────────────────── */

/** La modifica da salvare su una scheda già in archivio quando lo stesso numero
 *  ricompare dal foglio: `patchRicarico` (contatore +1, stato e note intatti) e,
 *  NELLA STESSA PATCH, la chiave d'ingresso. Se la scheda la porta già, `null`:
 *  un tentativo interrotto dopo la scrittura non fa salire il contatore due volte.
 *  Il consenso del modulo si aggiunge solo se la scheda non ne ha uno e non ha
 *  revocato (`okWhatsapp.si === false`). */
export function patchDelRitorno(
  attuale: Partial<LeadData>,
  i: { chiave: string; arrivo: LeadData; adesso: Date },
): Partial<LeadData> | null {
  const prima = attuale.ricarico?.chiaviIngresso ?? [];
  if (prima.includes(i.chiave)) return null;
  const patch = patchRicarico(attuale, i.arrivo.listaOrigine?.file, i.adesso, {
    tracking: i.arrivo.tracking,
    modulo: i.arrivo.modulo,
  });
  if (patch.ricarico) {
    patch.ricarico = {
      ...patch.ricarico,
      chiaviIngresso: [i.chiave, ...prima].slice(0, CHIAVI_TENUTE),
    };
  }
  if (!attuale.consensoModulo && i.arrivo.consensoModulo && attuale.okWhatsapp?.si !== false)
    patch.consensoModulo = i.arrivo.consensoModulo;
  return patch;
}

/** Segna il ritorno sulla scheda: rilegge, fonde, scrive solo se `updated_at`
 *  combacia (3 tentativi), come `updateLead` nel browser. */
export async function segnaRitorno(
  porte: PorteIngresso,
  i: { userId: string; leadId: string; chiave: string; arrivo: LeadData; adesso: Date },
): Promise<"fatto" | "gia_segnato" | "sparita" | "fallito"> {
  for (let t = 0; t < TENTATIVI_RITORNO; t++) {
    try {
      const letta = await porte.leggiScheda(i.userId, i.leadId);
      if (!letta) return "sparita";
      const patch = patchDelRitorno(letta.data, i);
      if (!patch) return "gia_segnato";
      if (await porte.scriviScheda(i.userId, i.leadId, { ...letta.data, ...patch }, letta.versione))
        return "fatto";
    } catch {
      //  un errore del database vale un tentativo; il codice lo registra la rotta
      //  se anche l'ultimo fallisce (mai il messaggio)
    }
  }
  return "fallito";
}

/* ── LA RICHIESTA HTTP ──────────────────────────────────────────────────── */

const risposta = (stato: number, json: unknown) =>
  new Response(JSON.stringify(json), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Solo il codice di un errore del database, e solo se ha la forma di un codice. */
function codiceDi(e: unknown): string {
  const x = (e as { code?: unknown } | null)?.code;
  return typeof x === "string" && /^[A-Za-z0-9_]{1,12}$/.test(x) ? x : "?";
}

/** Il database non c'è o non è pronto (S1 mancante, connessione, risorse): la
 *  riga non c'entra, lo script deve riprovare dopo (503). Un errore sulla riga
 *  (dato rifiutato, vincolo) è un 500: lo script lo conta su QUELLA riga. */
const NON_PRONTO = ["42P01", "42883", "42703", "PGRST202", "PGRST204", "PGRST205"];
function guastoDelServizio(code: string): boolean {
  return code === "?" || NON_PRONTO.includes(code) || /^(08|53|57|58)/.test(code);
}

/** Dalla richiesta HTTP alla risposta HTTP, come `gestisciRichiesta` di
 *  ManyChat: prima il segreto e la chiave, POI il corpo. `esito` è una parola
 *  per i log, mai un dato. */
export async function gestisciIngresso(
  porte: PorteIngresso,
  i: { request: Request; segreto: string | undefined; adesso: Date },
): Promise<{ response: Response; esito?: string }> {
  const fine = (stato: number, errore: string, esito = errore) => ({
    response: risposta(stato, { ok: false, errore }),
    esito,
  });
  if (!i.segreto) return fine(503, "non_configurato", "segreto_assente");
  if (!stessaChiave(i.request.headers.get("x-hgl-token"), i.segreto))
    return fine(401, "non_autorizzato");

  const letto = await leggiCorpoLimitato(i.request.body);
  if (letto.troppoGrande) return fine(413, "troppo_grande");
  let richiesta: RichiestaIngresso | null = null;
  try {
    richiesta = leggiRichiesta(JSON.parse(letto.testo));
  } catch {
    richiesta = null;
  }
  if (!richiesta) return fine(400, "forma");

  const scheda = await schedaDaRiga(richiesta, i.adesso);
  if ("scartata" in scheda)
    return {
      response: risposta(200, { ok: true, esito: "scartata", motivo: scheda.scartata }),
      esito: "scartata",
    };

  const ok = (esito: EsitoIngresso) => ({ response: risposta(200, { ok: true, esito }), esito });
  const errore = (e: unknown) => {
    const code = codiceDi(e);
    return guastoDelServizio(code)
      ? fine(503, "non_pronto", `non_pronto:${code}`)
      : fine(500, "errore", `errore:${code}`);
  };

  let userId: string | null;
  try {
    userId = await porte.utente();
  } catch (e) {
    return errore(e);
  }
  if (!userId) return fine(503, "non_configurato");

  let scritta: Awaited<ReturnType<PorteIngresso["scrivi"]>>;
  try {
    scritta = await porte.scrivi({
      userId,
      chiave: scheda.chiave,
      tel9: scheda.tel9,
      metaId: scheda.data.metaLeadId ?? "",
      foglio: scheda.data.origineIngresso?.foglio ?? "",
      riga: richiesta.riga,
      data: scheda.data,
    });
  } catch (e) {
    return errore(e);
  }

  if (scritta.esito === "tetto") return fine(503, "tetto");
  if (scritta.esito === "nuovo" || scritta.esito === "gia_presente") return ok(scritta.esito);
  const ritornoInterrotto =
    scritta.esito === "gia_ricevuto" && scritta.stato === "ritorno_da_segnare";
  if (scritta.esito === "gia_ricevuto" && !ritornoInterrotto) return ok("gia_ricevuto");
  if (scritta.esito !== "ritorno" && !ritornoInterrotto)
    return fine(500, "errore", "esito_sconosciuto");
  if (!scritta.leadId) return fine(500, "errore", "ritorno_senza_scheda");

  //  Un ritorno (nuovo, o un tentativo interrotto che si completa adesso).
  const segnato = await segnaRitorno(porte, {
    userId,
    leadId: scritta.leadId,
    chiave: scheda.chiave,
    arrivo: scheda.data,
    adesso: i.adesso,
  });
  if (segnato === "fallito") return fine(503, "non_pronto", "ritorno_non_segnato");
  try {
    await porte.chiudi({ userId, chiave: scheda.chiave, esito: "ritorno" });
  } catch {
    //  La scheda è già segnata (la chiave sta nella stessa patch): al tentativo
    //  dopo il contatore non sale due volte e il registro si chiude.
    return fine(503, "non_pronto", "ritorno_non_chiuso");
  }
  return ok("ritorno");
}
