/** ── PARTE O NON PARTE: LA DECISIONE DEL MESSAGGIO DI CONFERMA ──────────────
 *
 *  Commessa 2026-10-22 («Rispondi SÌ»). Ogni due minuti il cron legge le
 *  schede con un appuntamento e chiede a `decidiInvio` cosa fare di ciascuna.
 *  La risposta è una sola fra: niente, aspetta, preesistente, salta, invia.
 *
 *  ⚠️ È IL CUORE DELLA FUNZIONE: una regola sbagliata qui è un messaggio
 *   doppio a un cliente, o uno di notte, o uno mancato. Ogni regola ha la sua
 *   prova (proveDelPromemoriaWhatsapp, la matrice). L'ora arriva da fuori: qui
 *   dentro non si legge mai l'orologio.
 *
 *  LE REGOLE, IN ORDINE
 *   · non è un appuntamento, manca il giorno o l'ora, è già iniziato → niente
 *   · questa chiave ha già il suo segno → niente (mai due messaggi); se è
 *     `in_invio` da più di 10 minuti il worker è caduto a metà → `incerto`,
 *     e NON si rimanda: meglio una telefonata della setter che due messaggi
 *   · primo giro dopo l'accensione → `preesistente`, a prescindere da quando
 *     la scheda è stata toccata (correzione 3 del revisore: una nota scritta
 *     dopo l'accensione non deve far partire un appuntamento di settimane fa)
 *   · 3 messaggi già mandati, STOP, numero, nome, ora → `salta` col motivo
 *   · scheda toccata da meno di 2 minuti → aspetta (la setter corregge)
 *   · fuori dalle 08-21 di Roma → aspetta l'apertura; ma se all'apertura
 *     mancherebbe meno di un'ora → `troppo_vicino` subito
 *   · meno di 60 minuti all'appuntamento → `troppo_vicino`
 *   · senza link → aspetta (lo crea il browser qualche secondo dopo); MA se il consulente non usa
 *     Meetly il link non serve e non si manda mai: parte il gemello senza link
 *   · altrimenti → invia
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData, type PromemoriaWhatsapp } from "../types";
import { chiaveTelefono } from "../telefono-doppio";
import {
  finestraAperta,
  giornoParlato,
  minutiAlla,
  minutiAllApertura,
  nomePerModello,
  numeroPerWhatsapp,
  oraNormale,
} from "./formati";

export const CALMA_MIN = 2;
export const ANTICIPO_MIN = 60;
export const TETTO_INVII = 3;
export const INCERTO_DOPO_MIN = 10;
export const NOME_MODELLO = "consulenza_conferma_presenza";
/** Il gemello SENZA link per i consulenti che non usano Meetly (31/10/2026): stesso messaggio,
 *  tre variabili (nome, giorno, ora). Il link per collegarsi lo manda il consulente a mano. */
export const NOME_MODELLO_SENZA_LINK = "consulenza_conferma_presenza_sl";

export type MotivoAttesa = "fuori_orario" | "manca_link" | "calma";
export type MotivoSalto =
  | "senza_numero"
  | "numero_non_valido"
  | "manca_nome"
  | "orario_illeggibile"
  | "troppo_vicino"
  | "troppi_invii"
  | "disiscritto"
  | "incerto";

export interface IngressoInvio {
  d: Partial<LeadData>;
  /** il link per-persona del CRM (`valoriDaLead(...).link`), "" se manca */
  link: string;
  /** `crm_leads.updated_at` */
  aggiornataIl: string | null;
  /** i numeri che hanno scritto STOP (`whatsapp_contacts.non_scrivere_dal`),
   *  così come sono salvati: con o senza «+», li normalizza la regola */
  numeriStop: string[];
  adesso: Date;
  /** il primo giro dopo l'accensione: nulla di nuovo parte */
  primoGiro: boolean;
  /** il consulente della scheda non usa Meetly (`invitoMeet = "senza"`): il gemello senza link,
   *  mai il link. Assente = usa Meetly (come prima). */
  senzaLink?: boolean;
}

export type Decisione =
  | { azione: "niente" }
  | { azione: "aspetta"; motivo: MotivoAttesa }
  | { azione: "preesistente"; chiave: string }
  | { azione: "salta"; chiave: string; stato: "non_inviato" | "incerto"; motivo: MotivoSalto }
  | {
      azione: "invia";
      chiave: string;
      numero: string;
      /** `NOME_MODELLO` (4 parametri, l'ultimo è il link) o `NOME_MODELLO_SENZA_LINK` (3) */
      modello: string;
      parametri: string[];
      /** il conto dei messaggi della scheda, compreso questo */
      volte: number;
    };

/** «AAAA-MM-GGTHH:MM|ultime 9 cifre». `null` se mancano giorno o ora; il
 *  telefono può mancare (la chiave serve anche a segnare «senza numero»). */
export function chiaveAppuntamento(d: Partial<LeadData>): string | null {
  const giorno = String(d.dataMeeting ?? "").trim();
  const ora = String(d.oraMeeting ?? "").trim();
  if (!giorno || !ora) return null;
  return `${giorno}T${oraNormale(ora) ?? ora}|${chiaveTelefono(d.telefono)}`;
}

/** Gli stati che chiudono una chiave: per quella chiave non parte più niente. */
const CHIUSI: PromemoriaWhatsapp["stato"][] = [
  "inviato",
  "non_inviato",
  "non_recapitato",
  "preesistente",
  "incerto",
];

export function decidiInvio(i: IngressoInvio): Decisione {
  const { d, adesso } = i;
  const niente = { azione: "niente" } as const;
  if (!eAppuntamento(d.stato)) return niente;
  const chiave = chiaveAppuntamento(d);
  const giorno = String(d.dataMeeting ?? "").trim();
  if (!chiave || !giornoParlato(giorno)) return niente;
  const ora = oraNormale(d.oraMeeting);
  //  Con l'ora illeggibile si sa almeno il giorno: un giorno passato è passato.
  const mancano = ora ? minutiAlla(giorno, ora, adesso) : minutiAlla(giorno, "23:59", adesso);
  if (mancano <= 0) return niente;

  const p = d.promemoria ?? {};
  if (p.chiave === chiave) {
    if (CHIUSI.includes(p.stato)) return niente;
    if (p.stato === "in_invio") {
      const da = p.invioIl ? (adesso.getTime() - Date.parse(p.invioIl)) / 60_000 : Infinity;
      return da > INCERTO_DOPO_MIN
        ? { azione: "salta", chiave, stato: "incerto", motivo: "incerto" }
        : niente;
    }
    //  stato vuoto = segno tolto dopo un errore tecnico: si può riprovare.
  }
  if (i.primoGiro) return { azione: "preesistente", chiave };

  const salta = (motivo: MotivoSalto): Decisione => ({
    azione: "salta",
    chiave,
    stato: "non_inviato",
    motivo,
  });
  const volte = Number(p.volte) || 0;
  if (volte >= TETTO_INVII) return salta("troppi_invii");
  const numero = numeroPerWhatsapp(d.telefono);
  if (numero && i.numeriStop.some((n) => numeroPerWhatsapp(n) === numero))
    return salta("disiscritto");
  if (!String(d.telefono ?? "").trim()) return salta("senza_numero");
  if (!numero) return salta("numero_non_valido");
  const nome = nomePerModello(d.nome);
  if (!nome) return salta("manca_nome");
  if (!ora) return salta("orario_illeggibile");

  if (i.aggiornataIl && adesso.getTime() - Date.parse(i.aggiornataIl) < CALMA_MIN * 60_000)
    return { azione: "aspetta", motivo: "calma" };
  if (!finestraAperta(adesso)) {
    return mancano - minutiAllApertura(adesso) < ANTICIPO_MIN
      ? salta("troppo_vicino")
      : { azione: "aspetta", motivo: "fuori_orario" };
  }
  if (mancano < ANTICIPO_MIN) return salta("troppo_vicino");
  if (i.senzaLink)
    return {
      azione: "invia",
      chiave,
      numero,
      modello: NOME_MODELLO_SENZA_LINK,
      parametri: [nome, giornoParlato(giorno) as string, ora],
      volte: volte + 1,
    };
  if (!i.link) return { azione: "aspetta", motivo: "manca_link" };
  return {
    azione: "invia",
    chiave,
    numero,
    modello: NOME_MODELLO,
    parametri: [nome, giornoParlato(giorno) as string, ora, i.link],
    volte: volte + 1,
  };
}

/** Le risposte di un appuntamento vecchio non valgono per quello nuovo. */
const AZZERA = {
  confermatoIl: null,
  confermatoVia: null,
  rispostaIl: null,
  rispostaTesto: null,
  stopIl: null,
};

/** Il pezzo da fondere in `data.promemoria` per questa decisione. `null` =
 *  non si scrive niente (aspetta, niente). Con una chiave NUOVA (tutto tranne
 *  `incerto`) lo scrive `promemoria_aggancia`, che mette anche la chiave. */
export function pezzoDaScrivere(
  dec: Decisione,
  adessoIso: string,
): Partial<PromemoriaWhatsapp> | null {
  if (dec.azione === "invia")
    return { stato: "in_invio", motivo: null, invioIl: adessoIso, volte: dec.volte, ...AZZERA };
  if (dec.azione === "preesistente") return { stato: "preesistente", motivo: null, ...AZZERA };
  if (dec.azione === "salta") {
    if (dec.stato === "incerto") return { stato: "incerto", motivo: "incerto" };
    return { stato: "non_inviato", motivo: dec.motivo, ...AZZERA };
  }
  return null;
}

const FRASI: Record<string, string> = {
  senza_numero: "messaggio non partito: manca il numero",
  numero_non_valido: "messaggio non partito: numero non valido",
  manca_nome: "messaggio non partito: manca il nome",
  orario_illeggibile: "messaggio non partito: l'ora dell'appuntamento non si legge",
  troppo_vicino: "messaggio non partito: appuntamento troppo vicino",
  troppi_invii: "messaggio non partito: già 3 messaggi a questa persona",
  disiscritto: "messaggio non partito: ha chiesto di non ricevere messaggi",
  incerto: "non si sa se il messaggio è arrivato",
  non_recapitato: "messaggio non consegnato: il numero non è su WhatsApp",
  rifiutato: "messaggio rifiutato da WhatsApp",
};

/** La frase, per la setter e per il titolare. Mai un codice a schermo. */
export function testoMotivo(codice: string | null | undefined, extra?: string): string {
  const frase = FRASI[String(codice ?? "")] ?? "messaggio non partito";
  return extra ? `${frase} (${extra})` : frase;
}
