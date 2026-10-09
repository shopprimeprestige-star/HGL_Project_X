/** ── LA MEMORIA DELLE NOTIFICHE ────────────────────────────────────────────
 *
 *  IL PROBLEMA CHE RISOLVE
 *  Il motore ricalcola gli eventi ogni mezzo minuto e a ogni ricarica della
 *  pagina. Senza memoria, "installazione di oggi" suonerebbe a ogni giro e a
 *  ogni F5: dopo tre volte l'utente disattiva tutto, e a quel punto il sistema
 *  di notifiche esiste ma non serve a niente.
 *
 *  COSA SI RICORDA, IN QUATTRO CASSETTI SEPARATI
 *   · VISTI     — le chiavi degli eventi già notificati. Un evento notificato
 *                 non torna: né al giro dopo, né dopo un riavvio del browser.
 *   · STORICO   — cosa è stato notificato, per la pagina "Notifiche". È un
 *                 registro leggibile, non serve al funzionamento.
 *   · SOSPESI   — gli avvisi finiti nella campanella ma MAI arrivati sulla
 *                 scrivania, perché nel momento in cui sono nati il permesso
 *                 del browser non c'era ancora. Vedi sotto: è il cassetto che
 *                 mancava, ed è il motivo per cui "le notifiche non
 *                 funzionavano".
 *   · ISTANTANEA— stato e consulente di ogni trattativa all'ultimo giro. È il
 *                 termine di paragone per capire cosa è CAMBIATO: senza,
 *                 "acconto ricevuto" non è distinguibile da "acconto ricevuto
 *                 la settimana scorsa e ancora lì".
 *
 *  Tutto in localStorage, perché è memoria di questo dispositivo esattamente
 *  come lo sono il permesso e le preferenze.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { LivelloSuono } from "@/crm/suoni-crm";
import type { TipoEvento } from "./catalogo";

const CHIAVE_VISTI = "hg_crm_notif_visti_v1";
const CHIAVE_STORICO = "hg_crm_notif_storico_v1";
const CHIAVE_SOSPESI = "hg_crm_notif_sospesi_v1";
const CHIAVE_ISTANTANEA = "hg_crm_notif_istantanea_v1";
const CHIAVE_TURNO = "hg_crm_notif_turno_v1";

/** Le chiavi scadono: senza scadenza il cassetto cresce all'infinito e prima o
 *  poi riempie la quota di localStorage, facendo fallire ANCHE le scritture
 *  degli altri. Sette giorni bastano: nessun evento del CRM si ripete a
 *  distanza maggiore con la stessa chiave. */
const SCADENZA_VISTI_MS = 7 * 86_400_000;
const MAX_STORICO = 200;

/** Chi ascolta questo evento ridisegna: la pagina Notifiche si aggiorna mentre
 *  gli avvisi arrivano, senza doverla ricaricare. */
export const EVENTO_STORICO = "hg-crm-notif-storico";

function annuncia(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO_STORICO));
}

function leggi<T>(chiave: string, difetto: T): T {
  if (typeof window === "undefined") return difetto;
  try {
    const grezzo = window.localStorage.getItem(chiave);
    return grezzo ? (JSON.parse(grezzo) as T) : difetto;
  } catch {
    return difetto;
  }
}

function scrivi(chiave: string, valore: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    /* quota piena: si perde la memoria, non il funzionamento */
  }
}

/* ── 1. LE CHIAVI GIÀ NOTIFICATE ─────────────────────────────────────────── */

type Visti = Record<string, number>;

let vistiCache: Visti | null = null;

function visti(): Visti {
  if (vistiCache) return vistiCache;
  const v = leggi<Visti>(CHIAVE_VISTI, {});
  // Pulizia all'apertura: è l'unico momento in cui costa zero.
  const limite = Date.now() - SCADENZA_VISTI_MS;
  let cambiato = false;
  for (const k of Object.keys(v)) {
    if (!Number.isFinite(v[k]) || v[k] < limite) {
      delete v[k];
      cambiato = true;
    }
  }
  vistiCache = v;
  if (cambiato) scrivi(CHIAVE_VISTI, v);
  return v;
}

// Due schede aperte sullo stesso CRM hanno due copie in memoria di questo
// cassetto. Senza questa riga la seconda scheda non sa mai cosa ha già
// notificato la prima, e lo stesso avviso arriva due volte.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === CHIAVE_VISTI) vistiCache = null;
  });
}

export function giaNotificato(chiave: string): boolean {
  return chiave in visti();
}

/** Segna in blocco: una scrittura sola per giro invece di una per evento. */
export function segnaNotificati(chiavi: string[]): void {
  if (chiavi.length === 0) return;
  const v = visti();
  const adesso = Date.now();
  chiavi.forEach((k) => {
    v[k] = adesso;
  });
  scrivi(CHIAVE_VISTI, v);
}

/* ── 2. LO STORICO LEGGIBILE ─────────────────────────────────────────────── */

export interface VoceStorico {
  id: string;
  tipo: TipoEvento;
  titolo: string;
  corpo: string;
  /** ISO del momento in cui la notifica è stata inviata. */
  inviataIl: string;
  /** Quante schede lead riguardava (1, o N se raggruppata). */
  quantita: number;
  leadId?: string;
  destinazione: string;
  /** L'utente l'ha davvero vista? Diventa true al clic sulla notifica. */
  aperta?: boolean;
  /** Letta nella campanella. Distinta da `aperta` perché sono due gesti
   *  diversi: scorrere l'elenco non è aprire la scheda, ma basta a togliere il
   *  numero rosso. */
  letta?: boolean;
  /** La chiave dell'evento che l'ha generata. Serve alla campanella per NON
   *  mostrare due volte la stessa notifica quando la stessa riga arriva anche
   *  dalla tabella `notifications` (che usa la stessa chiave come dedupe_key). */
  chiave?: string;
  gravita?: string;
}

/** Non letta = né aperta dalla notifica, né vista nella campanella. */
export function nonLetta(v: VoceStorico): boolean {
  return !v.letta && !v.aperta;
}

export function leggiStorico(): VoceStorico[] {
  const grezzo = leggi<VoceStorico[]>(CHIAVE_STORICO, []);
  // Stessa cautela della coda: un solo valore sporco in memoria non deve
  // spegnere la campanella.
  return Array.isArray(grezzo) ? grezzo.filter((v) => v && typeof v.id === "string") : [];
}

export function aggiungiStorico(voci: VoceStorico[]): void {
  if (voci.length === 0) return;
  const attuale = leggiStorico();
  // Le più recenti in testa, e si tiene solo una finestra: lo storico serve a
  // capire "cosa mi è arrivato oggi", non a fare archeologia.
  scrivi(CHIAVE_STORICO, [...voci, ...attuale].slice(0, MAX_STORICO));
  annuncia();
}

export function segnaApertaStorico(id: string): void {
  const attuale = leggiStorico();
  const dopo = attuale.map((v) => (v.id === id ? { ...v, aperta: true, letta: true } : v));
  scrivi(CHIAVE_STORICO, dopo);
  annuncia();
}

/** Segna lette le voci indicate (clic sulla riga nella campanella). */
export function segnaLetteStorico(ids: string[]): void {
  if (ids.length === 0) return;
  const insieme = new Set(ids);
  const dopo = leggiStorico().map((v) => (insieme.has(v.id) ? { ...v, letta: true } : v));
  scrivi(CHIAVE_STORICO, dopo);
  annuncia();
}

/** "Segna tutte": azzera il numero rosso senza cancellare niente. Lo storico
 *  resta leggibile — è la differenza fra archiviare e buttare via. */
export function segnaTutteLetteStorico(): void {
  const dopo = leggiStorico().map((v) => (v.letta ? v : { ...v, letta: true }));
  scrivi(CHIAVE_STORICO, dopo);
  annuncia();
}

export function svuotaStorico(): void {
  scrivi(CHIAVE_STORICO, []);
  annuncia();
}

/* ── 3. LA CODA DI CONSEGNA ──────────────────────────────────────────────── */

/** ── IL GUASTO CHE QUESTO CASSETTO RIPARA ──────────────────────────────────
 *  Il motore parte insieme al CRM, cioè PRIMA che l'utente abbia concesso il
 *  permesso di notificare. Gli eventi della giornata (installazione di oggi,
 *  richiamo scaduto, saldo scoperto) venivano calcolati subito, segnati come
 *  "già detti" e messi nella campanella — ma sulla scrivania non compariva
 *  nulla, perché il permesso non c'era. Quando poi l'utente premeva "Attiva le
 *  notifiche", quelle chiavi risultavano già usate: fino al giorno dopo non
 *  arrivava più niente. Da fuori è esattamente "le notifiche non funzionano".
 *
 *  Adesso ciò che non è arrivato sulla scrivania resta in coda, e viene
 *  consegnato al primo giro utile dopo che il permesso è stato concesso.
 *  ───────────────────────────────────────────────────────────────────────── */
export interface AvvisoSospeso {
  /** L'id della voce di storico corrispondente: la notifica consegnata in
   *  ritardo deve segnare letta QUELLA riga, non crearne una nuova. */
  id: string;
  chiave: string;
  tipo: TipoEvento;
  titolo: string;
  corpo: string;
  gravita: string;
  suono: LivelloSuono;
  destinazione: string;
  leadId?: string;
  quantita: number;
  natoIl: number;
}

/** Due ore. Un promemoria consegnato a fine giornata non è un promemoria, è un
 *  rimprovero: oltre questa soglia l'avviso resta nella campanella e smette di
 *  cercare la scrivania. */
const SCADENZA_SOSPESI_MS = 2 * 3_600_000;
/** Concedere il permesso non deve scatenare una raffica: il resto è già nella
 *  campanella, con il suo numero rosso. */
const MAX_SOSPESI = 12;

export function leggiSospesi(): AvvisoSospeso[] {
  const limite = Date.now() - SCADENZA_SOSPESI_MS;
  const grezzo = leggi<AvvisoSospeso[]>(CHIAVE_SOSPESI, []);
  // Una riga malformata (versione vecchia, scrittura interrotta) non deve far
  // cadere il motore: le notifiche smetterebbero del tutto per un dato sporco.
  if (!Array.isArray(grezzo)) return [];
  return grezzo.filter((s) => s && typeof s.chiave === "string" && Number(s.natoIl) > limite);
}

export function aggiungiSospesi(nuovi: AvvisoSospeso[]): void {
  if (nuovi.length === 0) return;
  const gia = leggiSospesi();
  const chiaviGia = new Set(gia.map((s) => s.chiave));
  const uniti = [...gia, ...nuovi.filter((n) => !chiaviGia.has(n.chiave))];
  // Si tengono i PIÙ RECENTI: se la coda trabocca, la roba vecchia è anche
  // quella che è meno probabile serva ancora.
  scrivi(CHIAVE_SOSPESI, uniti.slice(-MAX_SOSPESI));
  annuncia();
}

export function togliSospesi(chiavi: string[]): void {
  if (chiavi.length === 0) return;
  const insieme = new Set(chiavi);
  scrivi(
    CHIAVE_SOSPESI,
    leggiSospesi().filter((s) => !insieme.has(s.chiave)),
  );
  annuncia();
}

export function svuotaSospesi(): void {
  scrivi(CHIAVE_SOSPESI, []);
  annuncia();
}

/* ── 4. L'ISTANTANEA DELLE TRATTATIVE ────────────────────────────────────── */

export interface Istantanea {
  /** leadId → "stato|consulenteId": due informazioni in una stringa perché
   *  l'istantanea può contenere migliaia di righe e ogni oggetto in più pesa
   *  nel JSON salvato a ogni giro. */
  righe: Record<string, string>;
  /** Falsa al primo avvio su questo dispositivo. Serve a NON notificare tutto
   *  l'archivio la prima volta: senza, chi attiva le notifiche riceve
   *  ottocento avvisi di "cambio stato" nel primo minuto. */
  inizializzata: boolean;
  aggiornataIl: number;
}

export const ISTANTANEA_VUOTA: Istantanea = {
  righe: {},
  inizializzata: false,
  aggiornataIl: 0,
};

export function leggiIstantanea(): Istantanea {
  const i = leggi<Istantanea>(CHIAVE_ISTANTANEA, ISTANTANEA_VUOTA);
  return {
    righe: i && typeof i.righe === "object" && i.righe ? i.righe : {},
    inizializzata: !!i?.inizializzata,
    aggiornataIl: Number(i?.aggiornataIl) || 0,
  };
}

export function scriviIstantanea(i: Istantanea): void {
  scrivi(CHIAVE_ISTANTANEA, i);
}

/** Azzera tutto: usata dal pulsante "Ricomincia da capo" nella pagina
 *  Notifiche, quando qualcosa si è incastrato e si vuole ripartire pulito. */
export function azzeraMemoria(): void {
  vistiCache = null;
  scrivi(CHIAVE_VISTI, {});
  scrivi(CHIAVE_ISTANTANEA, ISTANTANEA_VUOTA);
  svuotaSospesi();
  svuotaStorico();
}

/* ── 5. IL TURNO FRA SCHEDE ──────────────────────────────────────────────── */

/** ── PERCHÉ SERVE ──────────────────────────────────────────────────────────
 *  Chi lavora tiene il CRM aperto in due o tre schede. Ogni scheda monta il
 *  motore, e ogni motore calcola gli stessi eventi nello stesso mezzo minuto:
 *  il riquadro sulla scrivania è uno solo (i browser lo sostituiscono a parità
 *  di `tag`), ma il SUONO partiva una volta per scheda. Tre "din" sovrapposti
 *  su tre schede leggermente sfasate sono il modo più rapido per far spegnere
 *  le notifiche a chi le usa.
 *
 *  Qui si passa un testimone: la prima scheda che lo prende notifica per tutte,
 *  e lo tiene per venti secondi. Se quella scheda viene chiusa, il testimone
 *  scade da solo e al giro dopo lo prende un'altra — nessuno resta a piedi.
 *  ───────────────────────────────────────────────────────────────────────── */
const IO = `s-${Math.random().toString(36).slice(2, 8)}`;
const TURNO_MS = 20_000;

/** Rimette il testimone al centro del tavolo. Lo chiama la scheda in cui
 *  l'utente ha appena premuto un pulsante: chi guarda ha la precedenza, e deve
 *  vedere l'effetto adesso e non fra venti secondi in un'altra finestra. */
export function liberaTurno(): void {
  scrivi(CHIAVE_TURNO, null);
}

export function prendiTurno(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = leggi<{ chi?: string; quando?: number } | null>(CHIAVE_TURNO, null);
    const adesso = Date.now();
    if (v && v.chi && v.chi !== IO && adesso - Number(v.quando) < TURNO_MS) return false;
    scrivi(CHIAVE_TURNO, { chi: IO, quando: adesso });
    // Rilettura: due schede possono aver trovato il turno scaduto nello stesso
    // istante e averlo preso entrambe. L'ultima che scrive è l'unica che si
    // rivede scritta, quindi è l'unica che procede.
    return leggi<{ chi?: string } | null>(CHIAVE_TURNO, null)?.chi === IO;
  } catch {
    // Storage negato (navigazione privata rigida): meglio notificare due volte
    // che non notificare mai.
    return true;
  }
}

/* ── 6. LE MODIFICHE FATTE DA QUI ────────────────────────────────────────── */

/** ── PERCHÉ ────────────────────────────────────────────────────────────────
 *  "Cambio di stato" serve a sapere cosa ha fatto un COLLEGA. Annunciare a chi
 *  ha appena premuto "Venduto" che la trattativa è passata a venduto non è
 *  un'informazione: è un'eco, e le eco insegnano a ignorare le notifiche.
 *
 *  In memoria e non in localStorage di proposito: interessa solo la scheda in
 *  cui il gesto è avvenuto. Se la stessa modifica arriva su un'altra postazione
 *  lì è davvero "qualcun altro ha cambiato qualcosa", ed è giusto che suoni.
 *  ───────────────────────────────────────────────────────────────────────── */
const modificheQui = new Map<string, number>();
const FINESTRA_MODIFICA_MS = 90_000;

export function segnalaModificaLocale(leadId: string): void {
  if (leadId) modificheQui.set(leadId, Date.now());
}

export function modificatoQui(leadId: string): boolean {
  const t = modificheQui.get(leadId);
  if (t === undefined) return false;
  if (Date.now() - t > FINESTRA_MODIFICA_MS) {
    modificheQui.delete(leadId);
    return false;
  }
  return true;
}
