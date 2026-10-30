/** ── DATI PER LA FATTURA, DOPO L'ACCONTO (30/10/2026) ──────────────────────
 *
 *  Commessa 2026-10-30-oggi-e-fatture, parte B. Qui le REGOLE, pure e provate
 *  (prove/dati-fattura.mjs): niente rete, niente database, niente React.
 *  Il giro che le usa è in `dati-fattura-giro.ts`, il collegamento al mondo in
 *  `routes/hooks/dati-fattura.ts`.
 *
 *  Il percorso:
 *   1. sulla scheda c'è un acconto (`payment.accontoPagato > 0`) → UNA volta sola
 *      si chiedono al cliente i dati per la fattura (testo libero nelle 24 ore,
 *      modello `hgl_dati_fattura` fuori finestra, altrimenti promemoria);
 *   2. il cliente risponde con una FOTO (documento, tessera) o con un TESTO coi
 *      dati → l'AI già in uso li legge → BOZZA di fattura collegata al lead.
 *
 *  ⚠️ MAI UNA FATTURA CONFERMATA O INVIATA ALLO SDI: qui nasce solo `stato:
 *   "bozza"`, numero 0, data vuota. La conferma è a mano del titolare.
 *  ⚠️ NON SI SOVRASCRIVE NIENTE: se la bozza esiste già, si riempiono solo i
 *   campi vuoti (`innestaDocumento`).
 *  ⚠️ PRIVACY: niente di tutto questo finisce nei log (solo conteggi e codici).
 */
import { classificaTesto } from "../chatwa/media";
import { finestraPerTesto } from "../manychat/finestra";
import { contoDaLordo } from "./conti";
import {
  codiceFiscaleValido,
  innestaDocumento,
  normalizzaDocumento,
  type DatiDocumento,
} from "./lettura-documento";
import { CLIENTE_VUOTO, type ClienteFattura, type Fattura } from "./tipi";

/** Il modello Meta (testo in `wa-meta-templates.ts`, `MODELLI_MANYCHAT`). */
export const NOME_MODELLO_DATI_FATTURA = "hgl_dati_fattura";
/** Entro quanti giorni dalla richiesta una risposta vale come «i dati». */
export const GIORNI_PER_RISPONDERE = 14;
/** Quanti messaggi già letti si ricordano sulla scheda (tetto). */
export const MESSAGGI_RICORDATI = 30;
/** Quanti file al massimo per scheda. */
export const FILE_MASSIMI = 6;

/** ── LO STATO DELLA RICHIESTA, SULLA SCHEDA (`LeadData.datiFattura`) ───────
 *   preesistente      acconto già presente quando l'interruttore è stato acceso: non si chiede
 *   promemoria        da chiedere, ma non può partire (finestra chiusa e modello non pronto,
 *                     o invio fallito): sta in «Da fare»
 *   richiesta_inviata chiesto, si aspetta la risposta
 *   bozza_pronta      i dati sono arrivati, la bozza è in «Fatture»
 *   da_guardare       è arrivato qualcosa che non si legge da soli: lo guarda una persona */
export type StatoDatiFattura =
  | "preesistente"
  | "promemoria"
  | "richiesta_inviata"
  | "bozza_pronta"
  | "da_guardare"
  /** esiste già una fattura EMESSA per questa scheda: non si crea un'altra bozza */
  | "fattura_emessa";

export interface DatiFatturaScheda {
  stato: StatoDatiFattura;
  /** quando è partita la richiesta (ISO) */
  richiestaIl?: string;
  /** perché è in promemoria / da guardare: parola breve, mai dati */
  motivo?: string;
  /** percorsi nel bucket privato `dati-fattura` */
  file?: string[];
  /** id dei messaggi già letti (`wa_message_id`) */
  letti?: string[];
  bozzaIl?: string;
  /** ── LE LETTURE GIÀ FATTE, PER NON LEGGERE DUE VOLTE LA STESSA FOTO ──────────
   *  Chiave = id dei messaggi letti (`f:<id,id>` per le foto, `t:<id>` per un testo); valore =
   *  i dati GIÀ INTERPRETATI. Stanno sulla scheda (che ha già i permessi giusti), mai in
   *  `app_config`. Si tolgono appena la bozza è scritta. */
  letture?: Record<string, DatiLetti>;
}

export interface ConfigDatiFattura {
  /** l'interruttore: spento di base, lo accende il titolare */
  acceso: boolean;
  /** vero quando il modello Meta è approvato (canale cloud; con ManyChat conta il flusso mappato) */
  modelloApprovato?: boolean;
  /** `da_fare` = al prossimo giro si segnano come «preesistenti» le schede che hanno già un acconto */
  avvio?: "da_fare" | "fatto";
  attivoDal?: string;
}

export interface SchedaPerRichiesta {
  telefono?: string;
  stato?: string;
  payment?: { accontoPagato?: number };
  datiFattura?: DatiFatturaScheda;
}

export type DecisioneRichiesta =
  | { azione: "invia"; come: "testo" | "modello" }
  | { azione: "promemoria"; motivo: "finestra_chiusa_senza_modello" }
  | { azione: "niente"; motivo: string };

const STATI_SENZA_RICHIESTA = new Set(["ripensamento", "perdi_tempo", "trattativa_persa"]);

/** Cosa fare per una scheda. Pura. `ultimaEntrata`: ultimo messaggio del cliente (ISO). */
export function decidiRichiesta(i: {
  scheda: SchedaPerRichiesta;
  config: ConfigDatiFattura;
  ultimaEntrata: string | null;
  stop: boolean;
  modelloPronto: boolean;
  adesso: Date;
}): DecisioneRichiesta {
  const { scheda, config } = i;
  if (!config.acceso) return { azione: "niente", motivo: "spento" };
  if (!(Number(scheda.payment?.accontoPagato) > 0))
    return { azione: "niente", motivo: "senza_acconto" };
  if (STATI_SENZA_RICHIESTA.has(String(scheda.stato))) return { azione: "niente", motivo: "stato" };
  const st = scheda.datiFattura?.stato;
  //  UNA volta sola: l'unico stato che si riprova è il promemoria.
  if (st && st !== "promemoria") return { azione: "niente", motivo: "gia_chiesto" };
  if (String(scheda.telefono ?? "").replace(/\D/g, "").length < 8)
    return { azione: "niente", motivo: "senza_telefono" };
  if (i.stop) return { azione: "niente", motivo: "stop" };
  if (finestraPerTesto(i.ultimaEntrata, i.adesso)) return { azione: "invia", come: "testo" };
  if (i.modelloPronto) return { azione: "invia", come: "modello" };
  return { azione: "promemoria", motivo: "finestra_chiusa_senza_modello" };
}

/** Il primo nome per il parametro del modello ({{1}}); senza nome: «cliente». */
export function nomePerModello(nome?: string): string {
  const n =
    String(nome ?? "")
      .trim()
      .split(/\s+/)[0] ?? "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "cliente";
}

/** La chiave unica dell'invio nel registro: una sola richiesta per scheda. */
export const chiaveRichiesta = (telefono: string, leadId: string) =>
  `df|${String(telefono).replace(/\D/g, "").slice(-9)}|${leadId}`;

/** ── UNA RISPOSTA È ENTRO IL TEMPO? ──────────────────────────────────── */
export function entroIlTempo(
  richiestaIl: string | undefined,
  arrivato: string,
  giorni = GIORNI_PER_RISPONDERE,
) {
  const a = Date.parse(String(richiestaIl ?? ""));
  const b = Date.parse(arrivato);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b >= a - 60_000 && b <= a + giorni * 86_400_000;
}

/** Un messaggio in entrata: cosa ne facciamo? */
export type CosaFareConMessaggio =
  | { tipo: "file"; url: string; formato: "immagine" | "pdf" }
  | { tipo: "testo" }
  | { tipo: "da_guardare" }
  | { tipo: "niente" };

const CF_NEL_TESTO = /\b[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]\b/;
const PIVA_NEL_TESTO = /(?:^|[^\d])\d{11}(?:[^\d]|$)/;
const CAP_E_VIA =
  /\b(via|viale|v\.le|piazza|p\.zza|corso|largo|vicolo|strada|loc\.|località)\b[^\n]{3,}\b\d{5}\b/i;

/** Il testo sembra contenere dati da fattura? (Per non pagare l'AI su ogni «grazie».) */
export function sembraConDati(testo: string): boolean {
  const t = String(testo ?? "");
  if (t.length > 1500) return false;
  return CF_NEL_TESTO.test(t) || PIVA_NEL_TESTO.test(t) || CAP_E_VIA.test(t);
}

/** Dal testo di un messaggio in entrata (`body`) e dal suo canale. */
export function cosaFareConMessaggio(body: string, canale?: string | null): CosaFareConMessaggio {
  const k = classificaTesto(body);
  if (k.tipo === "immagine" && k.url) return { tipo: "file", url: k.url, formato: "immagine" };
  if (k.tipo === "documento" && k.url) return { tipo: "file", url: k.url, formato: "pdf" };
  //  Allegato di tipo sconosciuto (heic…): una persona lo guarda.
  if (k.tipo === "allegato") return { tipo: "da_guardare" };
  //  Dal ponte (Baileys) i media arrivano solo come segnaposto, senza file.
  if (canale === "baileys" && /^\s*\[(foto|immagine|image|documento|document|pdf)/i.test(body))
    return { tipo: "da_guardare" };
  if (k.tipo === "testo" && sembraConDati(body)) return { tipo: "testo" };
  return { tipo: "niente" };
}

/** ── IL LINK MANYCHAT, SCARICABILE? ───────────────────────────────────────
 *  L'URL è già passato da `classificaTesto` (https, host `manybot-files`, percorso
 *  `/<pagina>/wa/AAAA/MM/GG/<file>`): non si scarica nient'altro (niente SSRF). */
export const MIME_DA_FORMATO: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};
export function mimeDaUrl(url: string): string | null {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(new URL(url).pathname);
  return (m && MIME_DA_FORMATO[m[1].toLowerCase()]) || null;
}
export const PESO_MASSIMO_FILE = 8 * 1024 * 1024;

/** Il percorso nel bucket privato: sorteggiato, senza nome del cliente. */
export function percorsoFile(userId: string, leadId: string, casuale: string, mime: string) {
  const est =
    mime === "application/pdf"
      ? "pdf"
      : mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
  return `${userId}/${leadId}/${casuale}.${est}`;
}

/** ── LE LETTURE ──────────────────────────────────────────────────────── */
export interface DatiLetti extends DatiDocumento {
  denominazione?: string;
  partitaIva?: string;
  pec?: string;
  codiceDestinatario?: string;
}

export const PROMPT_TESTO_DATI =
  "The text below is a message from an Italian customer who was asked for the data needed for an invoice. " +
  "Extract ONLY these fields and return STRICT JSON, no prose, no markdown fence:\n" +
  '{"nome":"","cognome":"","denominazione":"","codiceFiscale":"","partitaIva":"","indirizzo":"","cap":"","comune":"","provincia":"","pec":"","codiceDestinatario":""}\n' +
  'Rules: use "" for anything not clearly written — never guess, never invent. ' +
  "denominazione is a company name (only if the customer is a company). codiceFiscale is the 16-character tax code, uppercase. " +
  "partitaIva is 11 digits. indirizzo is street and house number only. cap 5 digits. provincia 2 letters. " +
  "codiceDestinatario is the 7-character SDI code. Do not return anything else.\n\nMESSAGE:\n";

/** Ripulisce il JSON del modello (testo): quello che non torna non entra. */
export function normalizzaDatiTesto(o: Record<string, unknown>): DatiLetti {
  const base = normalizzaDocumento(o);
  const pul = (v: unknown) =>
    String(v ?? "")
      .replace(/\s+/g, " ")
      .trim();
  const d: DatiLetti = { ...base };
  const den = pul(o.denominazione);
  if (den) d.denominazione = den.slice(0, 80);
  const piva = pul(o.partitaIva).replace(/\D/g, "");
  if (/^\d{11}$/.test(piva)) d.partitaIva = piva;
  const pec = pul(o.pec).toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(pec)) d.pec = pec;
  const sdi = pul(o.codiceDestinatario).toUpperCase();
  if (/^[A-Z0-9]{7}$/.test(sdi)) d.codiceDestinatario = sdi;
  return d;
}

export function leggiJsonDatiTesto(testo: string): DatiLetti {
  const s = String(testo ?? "").replace(/```(?:json)?/gi, " ");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return {};
  try {
    return normalizzaDatiTesto(JSON.parse(s.slice(a, b + 1)) as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** Unisce più letture (più foto): vale il primo valore non vuoto. */
export function unisciLetture(letture: DatiLetti[]): DatiLetti {
  const out: Record<string, unknown> = {};
  for (const l of letture)
    for (const [k, v] of Object.entries(l)) {
      if (k === "documenti") {
        out.documenti = Array.from(
          new Set([...((out.documenti as string[]) ?? []), ...((v as string[]) ?? [])]),
        );
      } else if (v && !out[k]) out[k] = v;
    }
  return out as DatiLetti;
}

export const conAlmenoUnDato = (l: DatiLetti) =>
  !!(l.nome || l.cognome || l.denominazione || l.codiceFiscale || l.partitaIva || l.indirizzo);

/** ── LA BOZZA ──────────────────────────────────────────────────────────── */
export interface SchedaPerBozza {
  id: string;
  nome?: string;
  cognome?: string;
  email?: string;
  payment?: { accontoPagato?: number; prezzoFinaleVendita?: number; prezzoTotale?: number };
}

/** La bozza nuova o aggiornata. `esistente` si arricchisce, non si sovrascrive.
 *  ⚠️ Stato sempre «bozza», numero 0, data vuota: la conferma è del titolare. */
export function bozzaDaDati(i: {
  scheda: SchedaPerBozza;
  letti: DatiLetti;
  esistente: Fattura | null;
  aliquota: number;
  adesso: Date;
}): { bozza: Fattura; riempiti: string[] } {
  const { scheda, letti, esistente } = i;
  const partenza: ClienteFattura = esistente
    ? esistente.cliente
    : { ...CLIENTE_VUOTO, nome: scheda.nome ?? "", cognome: scheda.cognome ?? "" };
  //  Nome e cognome della scheda sono quelli sentiti al telefono: se i documenti dicono altro, vale il documento
  //  (in fattura devono combaciare) ma SOLO su una bozza nuova; su una esistente non si tocca niente.
  const base: ClienteFattura = esistente
    ? partenza
    : {
        ...partenza,
        nome: letti.nome || partenza.nome,
        cognome: letti.cognome || partenza.cognome,
      };
  const inn = innestaDocumento(base, letti);
  const cliente: ClienteFattura = { ...inn.dati };
  const riempiti = [...inn.riempiti];
  const azienda = !!(letti.denominazione || letti.partitaIva);
  const extra: [keyof ClienteFattura, string | undefined][] = [
    ["denominazione", letti.denominazione],
    ["partitaIva", letti.partitaIva],
    ["pec", letti.pec],
    ["codiceDestinatario", letti.codiceDestinatario],
  ];
  for (const [k, v] of extra) {
    const attuale = String(cliente[k] ?? "").trim();
    //  «0000000» è il valore vuoto del codice destinatario.
    if (v && (!attuale || (k === "codiceDestinatario" && attuale === "0000000"))) {
      (cliente as unknown as Record<string, unknown>)[k] = v;
      riempiti.push(String(k));
    }
  }
  if (!esistente && azienda) cliente.azienda = true;
  if (cliente.codiceFiscale && !codiceFiscaleValido(cliente.codiceFiscale))
    cliente.codiceFiscale = "";

  if (esistente) return { bozza: { ...esistente, cliente }, riempiti };

  const versato = Number(scheda.payment?.accontoPagato) || 0;
  const prezzo =
    Number(scheda.payment?.prezzoFinaleVendita) || Number(scheda.payment?.prezzoTotale) || 0;
  const conto = contoDaLordo(versato, i.aliquota);
  const tipo: Fattura["tipo"] = prezzo > 0 && versato >= prezzo - 0.01 ? "unica" : "acconto";
  return {
    riempiti,
    bozza: {
      id: `bozza:${scheda.id}`,
      stato: "bozza",
      numero: 0,
      anno: i.adesso.getFullYear(),
      serie: "",
      data: "",
      dataPagamento: "",
      tipo,
      leadId: scheda.id,
      leadNome: `${cliente.nome} ${cliente.cognome}`.trim() || cliente.denominazione || "Cliente",
      preventivoRef: "",
      cliente,
      righe: [
        {
          descrizione: "Fornitura impianto capillare",
          quantita: 1,
          prezzoUnitario: conto.imponibile,
          aliquota: conto.aliquota,
        },
      ],
      causale: "Conferma ordine",
      imponibile: conto.imponibile,
      imposta: conto.imposta,
      totale: conto.totale,
      creataIl: i.adesso.toISOString(),
      emessaIl: "",
      ...(scheda.email ? { emailOrigine: scheda.email.toLowerCase() } : {}),
    },
  };
}
