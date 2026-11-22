/** ── LA CASSA NUOVA, LATO BROWSER (PURA) ────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T58 (PIANO-R2 §3.1, D47, D50, D60, D61). Nessun React, nessuna rete, nessun `window`: tutto
 *  ciò che `CassaStripe.tsx` decide sta qui e si prova con porte finte (prove/negozio/cassa-client.mjs, eventi-cassa.mjs).
 *   · il corpo della richiesta ha solo SKU e quantità, più il totale che il cliente ha visto (`totaleAttesoCent`): i prezzi li fa il server;
 *   · `tentativo` come in `invio-ordine.ts`: stesso contenuto = stesso tentativo (un doppio clic ritrova lo stesso ordine), contenuto
 *     diverso = tentativo nuovo (mai riusarlo con dati diversi: il server risponderebbe `tentativo_diverso`);
 *   · ogni risposta del server diventa una frase e, se serve, un errore ACCANTO AL CAMPO; `prezzi_cambiati` porta i totali nuovi e NON
 *     fa partire un secondo invio;
 *   · il browser segue solo un indirizzo `https://checkout.stripe.com/…`: nessuno script di Stripe nel sito;
 *   · gli eventi (D60): `AddShippingInfo` una volta per carrello e sessione, `AddPaymentInfo` al «Paga ora», e il rinvio aspetta
 *     `scarica()` per un massimo di 800 ms. Un errore del tracciamento non ferma mai il pagamento. */
import type { DatiEvento } from "../../lib/tracciamento/eventi";
import type { NomeEvento } from "../../lib/tracciamento/nomi";
import { uuidNuovo } from "../invio-ordine";
import type { RigaCarrello } from "../cms/carrello";
import { datiEventoRighe } from "../cms/cassa";
import { cassaDa, type Cassa } from "../cms/cassa-sito";
import { primaVolta } from "../cms/scheda";
import { validaCap, validaProvincia } from "./fiscale";
import type { SpedizionePubblica } from "./spedizione";

/** Dove può portare il rinvio: solo qui. */
export const INDIRIZZO_STRIPE = "https://checkout.stripe.com/";
/** Quanto aspetta il loader la risposta di `cassaDelSito()` prima di ripiegare sulla cassa vecchia. */
export const TETTO_CASSA_MS = 3000;
/** Quanto aspetta il rinvio a Stripe che gli eventi in volo arrivino al server (D60). */
export const TETTO_SCARICA_MS = 800;

export const FRASE_RETE =
  "Non siamo riusciti a contattare il negozio: il carrello è ancora qui, riprova tra un momento.";
export const FRASE_CHIUSA = "Il negozio sta per aprire: riprova tra poco.";
const FRASE_NON_DISPONIBILE =
  "Questo prodotto non è disponibile: toglilo dal carrello per continuare.";
const FRASE_PREZZI = "I prezzi sono cambiati: controlla il nuovo totale e conferma di nuovo.";
const FRASE_PERMESSO = "Ricarica la pagina e riprova.";
const MAX_FRASE = 300;

/* ══ IL LOADER ══════════════════════════════════════════════════════════════ */

const attesaVera = (ms: number) =>
  // shortcut: il timer non si cancella quando risponde prima il server (vive al più TETTO_CASSA_MS e non tiene niente); si cambia se diventa un problema
  new Promise<"tempo">((r) => {
    setTimeout(() => r("tempo"), ms);
  });

/** Quale cassa mostra la pagina. `cassaDelSito()` si chiede SOLO con il catalogo `cms`; un rifiuto, un timeout o una risposta strana → `vecchia`. */
export async function cassaPerLoader(
  modo: unknown,
  leggi: () => Promise<unknown> | unknown,
  attendi: (ms: number) => Promise<"tempo"> = attesaVera,
): Promise<Cassa> {
  if (modo !== "cms") return "vecchia";
  try {
    const r = await Promise.race([Promise.resolve().then(() => leggi()), attendi(TETTO_CASSA_MS)]);
    return r === "tempo" ? "vecchia" : cassaDa(r);
  } catch {
    return "vecchia";
  }
}

/* ══ IL MODULO E IL CORPO ═══════════════════════════════════════════════════ */

export interface ModuloCassa {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  note: string;
  vuoleFattura: boolean;
  tipo: "privato" | "azienda";
  denominazione: string;
  cf: string;
  piva: string;
  sdi: string;
  pec: string;
  termini: boolean;
  privacy: boolean;
  /** La trappola: deve restare vuota (la riempie solo un programma). */
  sito_web: string;
}

export const MODULO_VUOTO: ModuloCassa = {
  nome: "",
  cognome: "",
  email: "",
  telefono: "",
  indirizzo: "",
  citta: "",
  cap: "",
  provincia: "",
  note: "",
  vuoleFattura: false,
  tipo: "privato",
  denominazione: "",
  cf: "",
  piva: "",
  sdi: "",
  pec: "",
  termini: false,
  privacy: false,
  sito_web: "",
};

export interface RigaCassa {
  sku: string;
  qty: number;
}

/** Le righe da mandare: solo SKU e quantità, dalle righe del carrello che hanno uno SKU. */
export function righeDaCarrello(righe: readonly RigaCarrello[]): RigaCassa[] {
  return (Array.isArray(righe) ? righe : []).flatMap((l) =>
    typeof l?.sku === "string" && l.sku !== "" && Number.isInteger(l.qty) && l.qty > 0
      ? [{ sku: l.sku, qty: l.qty }]
      : [],
  );
}

export interface DatiCorpo {
  modulo: ModuloCassa;
  righe: readonly RigaCassa[];
  totaleAttesoCent: number;
  permesso: string;
  tentativo: string;
  consensoMarketing: boolean;
  attribuzione: Record<string, string>;
  versione: string;
}

/** Il corpo di `POST /api/public/shop-cassa` (§3.1). Nessun prezzo di riga: il totale è solo quello che il cliente ha visto. */
export function corpoCassa(d: DatiCorpo) {
  const m = d.modulo;
  const t = (x: string) => (typeof x === "string" ? x.trim() : "");
  const corpo: Record<string, unknown> = {
    permesso: d.permesso,
    tentativo: d.tentativo,
    totaleAttesoCent: d.totaleAttesoCent,
    righe: d.righe.map((r) => ({ sku: r.sku, qty: r.qty })),
    contatti: {
      nome: t(m.nome),
      cognome: t(m.cognome),
      email: t(m.email),
      telefono: t(m.telefono),
    },
    spedizione: {
      indirizzo: t(m.indirizzo),
      citta: t(m.citta),
      cap: t(m.cap),
      provincia: t(m.provincia),
      nazione: "IT",
    },
    consensi: { termini: m.termini, privacy: m.privacy, versione: d.versione },
    consensoMarketing: d.consensoMarketing === true,
    attribuzione: d.attribuzione,
    sito_web: m.sito_web,
  };
  if (t(m.note) !== "") corpo.note = t(m.note);
  if (m.vuoleFattura) {
    const f: Record<string, string> = { tipo: m.tipo, denominazione: t(m.denominazione) };
    // i campi del tipo scelto: il privato ha il codice fiscale; l'azienda la P.IVA e, se li ha, SDI e PEC
    if (m.tipo === "privato") f.cf = t(m.cf);
    else {
      f.piva = t(m.piva);
      if (t(m.sdi) !== "") f.sdi = t(m.sdi);
      if (t(m.pec) !== "") f.pec = t(m.pec);
    }
    corpo.fattura = f;
  }
  return corpo;
}

/** Il contenuto del corpo come testo, senza ciò che si rinnova da solo (permesso, tentativo): se cambia, è un altro ordine. */
export function firmaCassa(corpo: Record<string, unknown>): string {
  const resto = { ...corpo };
  delete resto.permesso;
  delete resto.tentativo;
  return JSON.stringify(resto);
}

export interface TentativoCassa {
  id: string;
  firma: string;
}

/** Lo stesso tentativo se il contenuto è identico; altrimenti un id nuovo (come `tentativoPer` di `invio-ordine.ts`). */
export function tentativoCassa(
  precedente: TentativoCassa | null,
  firma: string,
  uuid: () => string = uuidNuovo,
): TentativoCassa {
  if (precedente && precedente.firma === firma) return precedente;
  return { id: uuid(), firma };
}

/** Il server rifiuta un permesso con meno di 3 s di vita o più di 30 minuti. Quanto aspettare prima di inviare (ms), oppure `"rinnova"`. */
export function attesaPermesso(emessoIl: number | null, adesso: number): number | "rinnova" {
  if (emessoIl === null) return "rinnova";
  const eta = adesso - emessoIl;
  if (eta < 0 || eta >= 29 * 60_000) return "rinnova";
  return eta < 3500 ? 3500 - eta : 0;
}

/** L'indirizzo della cassa senza `annullato` (il ritorno da Stripe senza pagare): con quella chiave la pagina non è ammessa al tracciamento
 *  (`ammesse.ts`), quindi si toglie dopo averla letta. Le altre chiavi e il `#…` restano com'erano. */
export function senzaAnnullato(percorso: string, ricerca: string, hash: string): string {
  const q = new URLSearchParams(ricerca.replace(/^\?/, ""));
  q.delete("annullato");
  const resto = q.toString();
  return `${percorso}${resto ? `?${resto}` : ""}${hash}`;
}

/* ══ I TOTALI ═══════════════════════════════════════════════════════════════ */

const interoNonNegativo = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** Subtotale + spedizione del server, in centesimi. `null` se la tariffa non c'è o non si è ancora letta: nessun totale inventato. */
export function calcolaTotali(
  subtotaleCent: number,
  spedizione: SpedizionePubblica | null,
): { spedizioneCent: number; totaleCent: number } | null {
  if (
    !spedizione ||
    spedizione.stato !== "ok" ||
    !interoNonNegativo(spedizione.costoCent) ||
    !interoNonNegativo(subtotaleCent)
  )
    return null;
  return { spedizioneCent: spedizione.costoCent, totaleCent: subtotaleCent + spedizione.costoCent };
}

/* ══ LE RISPOSTE DEL SERVER ═════════════════════════════════════════════════ */

export type EsitoCassa =
  | { tipo: "vai"; url: string }
  | { tipo: "campi"; frase: string; campi: Record<string, string> }
  | { tipo: "prezzi"; frase: string; totaleCent: number; spedizioneCent: number }
  | { tipo: "righe"; frase: string; righe: { sku: string; frase: string }[] }
  | { tipo: "chiusa"; frase: string }
  | { tipo: "permesso"; frase: string }
  | { tipo: "errore"; frase: string; nuovoTentativo: boolean };

const oggetto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
/** Una frase del server solo se è breve e di testo; altrimenti quella di riserva. */
const frasePer = (x: unknown, riserva: string): string =>
  typeof x === "string" && x.trim() !== "" && x.length <= MAX_FRASE ? x : riserva;

/** L'indirizzo è davvero quello di Stripe (https, stesso nome, nessuna credenziale)? */
export function eIndirizzoStripe(url: unknown): url is string {
  if (typeof url !== "string" || !url.startsWith(INDIRIZZO_STRIPE) || /\s/.test(url)) return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "checkout.stripe.com" &&
      u.username === "" &&
      u.password === ""
    );
  } catch {
    return false;
  }
}

export function leggiRisposta(_stato: number, corpo: unknown): EsitoCassa {
  if (!oggetto(corpo)) return { tipo: "errore", frase: FRASE_RETE, nuovoTentativo: false };
  if (corpo.ok === true) {
    return eIndirizzoStripe(corpo.url)
      ? { tipo: "vai", url: corpo.url }
      : { tipo: "errore", frase: FRASE_RETE, nuovoTentativo: false };
  }
  switch (corpo.motivo) {
    case "valore": {
      const campi: Record<string, string> = {};
      if (oggetto(corpo.campi))
        for (const k of Object.keys(corpo.campi)) {
          const f = corpo.campi[k];
          if (typeof f === "string" && f.trim() !== "" && f.length <= MAX_FRASE) campi[k] = f;
        }
      return {
        tipo: "campi",
        frase: frasePer(corpo.frase, "Controlla i campi segnati e riprova."),
        campi,
      };
    }
    case "prezzi_cambiati":
      return interoNonNegativo(corpo.totaleCent) && interoNonNegativo(corpo.spedizioneCent)
        ? {
            tipo: "prezzi",
            frase: frasePer(corpo.frase, FRASE_PREZZI),
            totaleCent: corpo.totaleCent,
            spedizioneCent: corpo.spedizioneCent,
          }
        : { tipo: "errore", frase: FRASE_RETE, nuovoTentativo: false };
    case "non_disponibile": {
      const righe = (Array.isArray(corpo.righe) ? corpo.righe : []).flatMap((r) =>
        oggetto(r) && typeof r.sku === "string" && r.sku !== ""
          ? [{ sku: r.sku, frase: frasePer(r.frase, FRASE_NON_DISPONIBILE) }]
          : [],
      );
      return { tipo: "righe", frase: frasePer(corpo.frase, FRASE_NON_DISPONIBILE), righe };
    }
    case "cassa_chiusa":
      return { tipo: "chiusa", frase: FRASE_CHIUSA };
    case "permesso":
      return { tipo: "permesso", frase: FRASE_PERMESSO };
    case "tentativo_diverso":
    case "non_riproponibile":
      // il tentativo non si può più riprendere: il prossimo clic ne crea uno nuovo
      return { tipo: "errore", frase: frasePer(corpo.frase, FRASE_RETE), nuovoTentativo: true };
    default:
      // troppe_richieste, riprova_in_corso, guasto, sconosciuti: il tentativo si tiene (stessi dati = stessa sessione)
      return { tipo: "errore", frase: frasePer(corpo.frase, FRASE_RETE), nuovoTentativo: false };
  }
}

/** I campi del modulo: l'errore sta accanto al campo con lo stesso nome. Tutto il resto (carrello, versione…) va in cima. */
const CAMPI_DEL_MODULO = new Set([
  "nome",
  "cognome",
  "email",
  "telefono",
  "indirizzo",
  "citta",
  "cap",
  "provincia",
  "note",
  "tipo",
  "denominazione",
  "cf",
  "piva",
  "sdi",
  "pec",
  "termini",
  "privacy",
]);
export function separaCampi(campi: Record<string, string>): {
  perCampo: Record<string, string>;
  generali: string[];
} {
  const perCampo: Record<string, string> = {};
  const generali: string[] = [];
  for (const k of Object.keys(oggetto(campi) ? campi : {})) {
    const f = campi[k];
    if (typeof f !== "string" || f === "") continue;
    if (CAMPI_DEL_MODULO.has(k)) perCampo[k] = f;
    else if (!generali.includes(f)) generali.push(f);
  }
  return { perCampo, generali };
}

/* ══ GLI EVENTI (D60) ═══════════════════════════════════════════════════════ */

type Archivio = Pick<Storage, "getItem" | "setItem"> | null | undefined;
type Emetti = (nome: NomeEvento, dati: DatiEvento) => unknown;

/** L'indirizzo è completo e valido: via, città, CAP di cinque cifre e sigla di provincia vera. */
export function indirizzoCompleto(
  m: Pick<ModuloCassa, "indirizzo" | "citta" | "cap" | "provincia">,
): boolean {
  return (
    m.indirizzo.trim() !== "" &&
    m.citta.trim() !== "" &&
    validaCap(m.cap).ok &&
    validaProvincia(m.provincia).ok
  );
}

/** `AddShippingInfo`: una volta per carrello (stesse righe e quantità) e sessione, quando l'indirizzo è completo. Vero se è partito. Non lancia mai. */
export function eventoSpedizione(
  porte: { emetti: Emetti; archivio: Archivio },
  modulo: ModuloCassa,
  righe: readonly RigaCarrello[],
): boolean {
  try {
    if (!indirizzoCompleto(modulo)) return false;
    const dati = datiEventoRighe(righe, () => undefined);
    if (!dati) return false;
    const chiave = `hg_asi_${righe.map((l) => `${l.sku ?? l.key}x${l.qty}`).join("+")}`;
    if (!primaVolta(porte.archivio, chiave)) return false;
    return porte.emetti("AddShippingInfo", dati) != null;
  } catch {
    return false;
  }
}

/** `AddPaymentInfo`: alla pressione di «Paga ora», prima del rinvio. Vero se è partito. Non lancia mai. */
export function eventoPagamento(
  porte: { emetti: Emetti },
  righe: readonly RigaCarrello[],
): boolean {
  try {
    const dati = datiEventoRighe(righe, () => undefined);
    return dati ? porte.emetti("AddPaymentInfo", dati) != null : false;
  } catch {
    return false;
  }
}

export interface PorteRinvio {
  /** Aspetta gli invii al server in corso; se manca (o fallisce) si parte lo stesso. */
  scarica?: () => Promise<unknown> | unknown;
  attendi: (ms: number) => Promise<unknown>;
  naviga: (url: string) => void;
}

/** Porta il cliente a Stripe, dopo aver lasciato a `scarica()` al massimo `tettoMs` per mandare gli eventi (la navigazione li ucciderebbe). */
export async function rinviaAStripe(
  url: string,
  porte: PorteRinvio,
  tettoMs: number = TETTO_SCARICA_MS,
): Promise<void> {
  if (!eIndirizzoStripe(url)) return;
  if (porte.scarica) {
    const scarica = porte.scarica;
    try {
      await Promise.race([
        Promise.resolve()
          .then(() => scarica())
          .catch(() => undefined),
        porte.attendi(tettoMs),
      ]);
    } catch {
      /* il tracciamento non ferma il pagamento */
    }
  }
  porte.naviga(url);
}
