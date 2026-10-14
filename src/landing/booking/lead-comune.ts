/** ── I PEZZI COMUNI DEL SALVATAGGIO DEL LEAD ────────────────────────────────
 *  Servono al modulo corto (`ModuloCorto.tsx`) e usano gli stessi pezzi del
 *  modulo lungo (`BookingFunnel`): stesse chiavi del lead, stesso evento «Lead»
 *  verso Meta. Una prova di deriva (`prove/sito/lead.mjs`) tiene i due allineati.
 *
 *  ── Una richiesta = { id, chiave, eventId }, nata una volta ──────────────────
 *  `id` è il lead; `chiave` (32 byte casuali) serve solo a fissare l'orario sullo
 *  stesso lead: nel database va soltanto la sua impronta SHA-256; `eventId` lega
 *  riga, Pixel e CAPI, così Meta conta un Lead solo. Vive in memoria e in
 *  sessionStorage fino all'orario fissato. Mai in localStorage, mai negli eventi,
 *  mai nei log. Dopo un errore di rete il nuovo tocco riusa la stessa richiesta e
 *  prende `23505` (già salvato): nessun doppione, nessun secondo Lead.
 *
 *  ⚠️ Il client si passa come argomento: le prove usano un finto. Niente rete,
 *  niente database, in questo file, che non passino da lì.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  detectSource,
  eventId as makeEventId,
  fireCapi,
  firePixel,
  trackEvent,
  type buildJourneySnapshot,
  type SourceData,
} from "./tracking";
import {
  campiConsenso,
  colonneSito,
  erroreDaRitentare,
  giaSalvato,
  painPointsConColonne,
  painPointsDiRiserva,
  telefonoDaInviare,
  type ModuloCortoDati,
  type PuntoSito,
} from "@/landing/sito/richiesta";
import type { Provenienza } from "@/landing/consulenza/regole";

/** Lo stesso valore di `CUSTOM_EVENTS.leadInviato` in `BookingFunnel` (la prova di deriva lo confronta). */
export const EVENTO_LEAD = "Lead_Prenotazione_Inviato";

export interface RichiestaSito {
  id: string;
  chiave: string;
  eventId: string;
}
export type StatoRichiesta = "da_inviare" | "salvato" | "salvato_senza_consenso" | "salvato_riserva";
export interface RichiestaConservata extends RichiestaSito {
  stato: StatoRichiesta;
  /** Il Lead verso Meta è già partito per questa richiesta. */
  annunciato: boolean;
}

export type Payload = Record<string, unknown>;
export type EsitoInvio = "salvato" | "salvato_senza_consenso" | "salvato_riserva" | { errore: string };
export type EsitoOrario = "fissato" | "occupato" | "non_valido" | "non_disponibile";

/** Il poco che serve del client Supabase. Il client vero si passa con un cast al punto d'uso. */
export interface ClienteLead {
  from(tabella: string): {
    insert(payload: Payload): PromiseLike<{ error: { code?: string; message?: string } | null }>;
  };
  rpc(nome: string, argomenti: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

/* ── La richiesta ──────────────────────────────────────────────────────── */

function esadecimale(byte: Uint8Array): string {
  return Array.from(byte, (b) => b.toString(16).padStart(2, "0")).join("");
}

function nuovoUuid(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  // Riserva (browser vecchi): UUID v4 dai byte casuali.
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = esadecimale(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function nuovaRichiesta(): RichiestaSito {
  const byte = new Uint8Array(32);
  globalThis.crypto.getRandomValues(byte);
  return { id: nuovoUuid(), chiave: esadecimale(byte), eventId: makeEventId() };
}

const CHIAVE_RICHIESTA = "hgl_richiesta_sito_v1";
const STATI: readonly StatoRichiesta[] = ["da_inviare", "salvato", "salvato_senza_consenso", "salvato_riserva"];

/** Lettura tollerante: dati rotti, vecchi o di forma sbagliata valgono «niente», mai un errore. */
export function richiestaConservata(): RichiestaConservata | null {
  try {
    if (typeof window === "undefined") return null;
    const grezzo = window.sessionStorage.getItem(CHIAVE_RICHIESTA);
    if (!grezzo) return null;
    const d = JSON.parse(grezzo) as Record<string, unknown> | null;
    if (!d || typeof d !== "object" || Array.isArray(d)) return null;
    const { id, chiave, eventId, stato } = d;
    if (typeof id !== "string" || !id || typeof eventId !== "string" || !eventId) return null;
    if (typeof chiave !== "string" || chiave.length < 32) return null;
    if (typeof stato !== "string" || !STATI.includes(stato as StatoRichiesta)) return null;
    return { id, chiave, eventId, stato: stato as StatoRichiesta, annunciato: d.annunciato === true };
  } catch {
    return null;
  }
}

function scrivi(r: RichiestaConservata): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(CHIAVE_RICHIESTA, JSON.stringify(r));
  } catch {
    // memoria piena o bloccata (Safari privato): si perde il ricordo, il lead si salva lo stesso
  }
}

export function conservaRichiesta(r: RichiestaSito, stato: StatoRichiesta): void {
  const prima = richiestaConservata();
  const annunciato = prima?.eventId === r.eventId ? prima.annunciato : false;
  scrivi({ id: r.id, chiave: r.chiave, eventId: r.eventId, stato, annunciato });
}

/** Dopo l'orario fissato la chiave non serve più: via. */
export function dimenticaRichiesta(): void {
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(CHIAVE_RICHIESTA);
  } catch {
    // niente da fare
  }
}

/** SHA-256 in esadecimale. È l'unica cosa della chiave che arriva nel database. */
export async function impronta(chiave: string): Promise<string> {
  const dati = new TextEncoder().encode(chiave);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", dati);
  return esadecimale(new Uint8Array(hash));
}

/* ── Il lead ───────────────────────────────────────────────────────────── */

function dividiNome(completo: string): { nome: string; cognome: string } {
  const parti = completo.trim().split(/\s+/);
  if (parti.length <= 1) return { nome: parti[0] ?? "", cognome: "" };
  return { nome: parti[0], cognome: parti.slice(1).join(" ") };
}

/** Le stesse chiavi di `insertPayload` in `BookingFunnel.submit`, senza orario, senza punteggio, senza urgenza. */
export function payloadBase(
  dati: { nome: string; telefono: string },
  fonte: SourceData,
  percorso: ReturnType<typeof buildJourneySnapshot>,
  eventId: string,
): Payload {
  const { nome, cognome } = dividiNome(dati.nome);
  return {
    nome,
    cognome: cognome || "—",
    email: "—",
    telefono: dati.telefono.trim(),
    citta: "—",
    data_slot: null,
    ora_slot: null,
    disagio_score: null,
    pain_points: [],
    urgenza: null,
    portatore: null,
    portatore_motivo: null,
    utm_source: fonte.utm_source ?? detectSource(),
    utm_medium: fonte.utm_medium ?? null,
    utm_campaign: fonte.utm_campaign ?? null,
    utm_id: fonte.utm_id ?? null,
    utm_content: fonte.utm_content ?? null,
    utm_term: fonte.utm_term ?? null,
    fbp: fonte.fbp ?? null,
    fbc: fonte.fbc ?? null,
    fbclid: fonte.fbclid ?? null,
    ttclid: fonte.ttclid ?? null,
    ad_id: fonte.ad_id ?? null,
    adset_id: fonte.adset_id ?? null,
    campaign_id: fonte.campaign_id ?? null,
    ad_name: fonte.ad_name ?? null,
    creative_name: fonte.creative_name ?? null,
    external_id: fonte.external_id ?? null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    event_id: eventId,
    touch_history: percorso.touch_history,
    touch_count: percorso.touch_count,
    first_channel: percorso.first_channel,
    last_channel: percorso.last_channel,
    journey_type: percorso.journey_type,
    days_to_convert: percorso.days_to_convert,
    hours_to_convert: percorso.hours_to_convert,
  };
}

/** I tre payload dei tentativi: pieno → senza consenso → riserva (le sole colonne di oggi). Stesso `id` e stesso `event_id` in tutti. */
export function costruisciPayload(p: {
  dati: ModuloCortoDati;
  richiesta: RichiestaSito;
  /** L'impronta della chiave; `null` se il browser non sa calcolarla (il calendario allora non si propone). */
  hash: string | null;
  sito: { origine: Provenienza; punto: PuntoSito; prodotto?: string };
  fonte: SourceData;
  percorso: ReturnType<typeof buildJourneySnapshot>;
}): { pieno: Payload; senzaConsenso: Payload; riserva: Payload } {
  const colonne = colonneSito(p.dati, p.sito);
  const base = payloadBase({ nome: p.dati.nome, telefono: telefonoDaInviare(p.dati.telefono) }, p.fonte, p.percorso, p.richiesta.eventId);
  const senzaConsenso: Payload = {
    ...base,
    id: p.richiesta.id,
    ...(p.hash ? { chiave_orario_hash: p.hash } : {}),
    ...colonne,
    pain_points: painPointsConColonne(colonne),
  };
  const pieno: Payload = { ...senzaConsenso, ...campiConsenso(p.dati) };
  const riserva: Payload = { ...base, id: p.richiesta.id, pain_points: painPointsDiRiserva(colonne) };
  return { pieno, senzaConsenso, riserva };
}

async function tenta(client: ClienteLead, payload: Payload): Promise<{ ok: true } | { ok: false; code?: string; message: string }> {
  try {
    const { error } = await client.from("public_leads").insert(payload);
    if (!error) return { ok: true };
    return { ok: false, code: error.code, message: error.message || "errore" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "rete non raggiungibile" };
  }
}

/** Salva il lead. Al massimo due ritentativi, e solo se mancano le colonne (migrazione non applicata):
 *  1° senza le chiavi del consenso, 2° con le sole colonne di oggi. Se il payload pieno e quello senza
 *  consenso sono uguali (casella non spuntata) il 1° ritentativo si salta. `23505` = già salvato.
 *  Ogni altro errore torna com'è, senza ritentare: un nuovo tocco riusa la stessa richiesta. */
export async function inviaRichiesta(client: ClienteLead, [pieno, senzaConsenso, riserva]: [Payload, Payload, Payload]): Promise<EsitoInvio> {
  const passi: Array<[Payload, Exclude<EsitoInvio, { errore: string }>]> = [[pieno, "salvato"]];
  if (JSON.stringify(senzaConsenso) !== JSON.stringify(pieno)) passi.push([senzaConsenso, "salvato_senza_consenso"]);
  passi.push([riserva, "salvato_riserva"]);
  for (let i = 0; i < passi.length; i++) {
    const r = await tenta(client, passi[i][0]);
    if (r.ok || giaSalvato(r.code)) return passi[i][1];
    if (!erroreDaRitentare(r.code) || i === passi.length - 1) return { errore: r.message };
  }
  return { errore: "errore" };
}

/* ── Il Lead verso Meta: una volta per richiesta ───────────────────────── */

const annunciati = new Set<string>();

/** Le stesse tre righe di `BookingFunnel`: Pixel «Lead», CAPI, evento «Lead». Torna `true` se è partito ora. */
export function annunciaLead(eventId: string, contatti: { nome: string; telefono: string }): boolean {
  if (annunciati.has(eventId)) return false;
  const salvata = richiestaConservata();
  if (salvata?.eventId === eventId && salvata.annunciato) {
    annunciati.add(eventId);
    return false;
  }
  annunciati.add(eventId);
  if (salvata?.eventId === eventId) scrivi({ ...salvata, annunciato: true });
  const { nome, cognome } = dividiNome(contatti.nome);
  const telefono = contatti.telefono.trim();
  firePixel("Lead", { content_name: "booking_lead", value: 1, currency: "EUR" }, eventId, { customName: EVENTO_LEAD });
  void fireCapi(
    "Lead",
    eventId,
    { email: "", phone: telefono, first_name: nome, last_name: cognome, city: "" },
    { value: 1, currency: "EUR", content_name: "booking_lead" },
  );
  void trackEvent("Lead", 6, { event_id: eventId, custom_event: EVENTO_LEAD });
  return true;
}

/* ── L'orario sullo stesso lead ────────────────────────────────────────── */

/** Chiama la funzione del database: aggiorna lo stesso lead. Funzione assente o rete caduta → `non_disponibile`. */
export async function fissaOrario(client: ClienteLead, id: string, chiave: string, data: string, ora: string): Promise<EsitoOrario> {
  try {
    const { data: risposta, error } = await client.rpc("fissa_orario_lead_sito", { p_id: id, p_chiave: chiave, p_data: data, p_ora: ora });
    if (error) return "non_disponibile";
    if (risposta === "fissato" || risposta === "occupato" || risposta === "non_valido") return risposta;
    return "non_valido";
  } catch {
    return "non_disponibile";
  }
}
