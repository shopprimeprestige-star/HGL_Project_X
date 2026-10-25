/** ── LE VARIABILI DEI MODELLI ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 2 (Dev A). Le prove
 *  stanno in `prove/manychat/regole.mjs` (con le regole di chi può ricevere).
 *
 *  Il testo dei messaggi NON si scrive qui: sono modelli approvati da Meta,
 *  dentro ManyChat. Il CRM riempie solo le variabili, che ManyChat legge dai
 *  campi del contatto (`crm_*`).
 *
 *  ⚠️ A ManyChat vanno solo il NOME (mai il cognome), il telefono e i
 *   parametri del modello: nessuna nota, nessun preventivo, nessun dato di
 *   salute. Una variabile vuota → `salta`: un modello col buco non parte.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "../types";
import { linkStanzaDi } from "../whatsapp";
import { linkPerPersona } from "@/shop/chi-dal-link";
import { gettoneDi } from "../fascia-consulenza";
import {
  giornoParlato,
  nomePerModello,
  numeroPerWhatsapp,
  oraNormale,
} from "../promemoria/formati";

/** I campi del contatto ManyChat che il CRM scrive (nome del campo → valore). */
export type CampiContatto = Record<string, string>;

export type CampiOSalta =
  | { tipo: "campi"; campi: CampiContatto }
  | { tipo: "salta"; motivo: string };

const salta = (motivo: string): CampiOSalta => ({ tipo: "salta", motivo });

/** Il link da mandare al cliente, ripulito: la stanza nostra (con dentro chi
 *  la riceve, se si sa l'id della scheda) oppure un indirizzo http(s) scritto
 *  in scheda. Stringa vuota se non c'è niente di usabile — un appunto come
 *  «chiamo io» NON è un link.
 *  shortcut: la regola del link esterno è copiata da `linkEsterno` di
 *  crm/whatsapp.ts (non esportata, e il file non è di questo compito); da
 *  togliere quando quella funzione verrà esportata. */
export function linkPerCliente(d: Partial<LeadData>, leadId?: string | null): string {
  const stanza = linkStanzaDi(d);
  const persona = leadId ? gettoneDi({ leadId, nome: d.nome || "" }) : "";
  const conChi = linkPerPersona(stanza, persona);
  if (conChi) return conChi;
  const grezzo = typeof d?.linkMeeting === "string" ? d.linkMeeting.trim() : "";
  return /^https?:\/\/\S+$/i.test(grezzo) ? grezzo : "";
}

/** Promemoria 25': `crm_nome`, `crm_ora_meet`, `crm_link_meet`, `crm_consulente`.
 *  `leadId` fa il link «per persona» (come la chat); senza, il link della
 *  stanza così com'è. Una variabile vuota → `salta`: Meta rifiuta i buchi. */
export function campiPromemoria(
  d: Partial<LeadData>,
  consulente: string | null | undefined,
  leadId?: string | null,
): CampiOSalta {
  const nome = nomePerModello(d.nome);
  if (!nome) return salta("manca il nome");
  const ora = oraNormale(d.oraMeeting);
  if (!ora) return salta("manca l'ora del meet");
  const link = linkPerCliente(d, leadId);
  if (!link) return salta("manca il link del meet");
  const chi = nomePerModello(consulente);
  if (!chi) return salta("manca il nome del consulente");
  return {
    tipo: "campi",
    campi: { crm_nome: nome, crm_ora_meet: ora, crm_link_meet: link, crm_consulente: chi },
  };
}

/** Ricontatto: `crm_nome`, `crm_consulente`. */
export function campiRicontatto(
  d: Partial<LeadData>,
  consulente: string | null | undefined,
): CampiOSalta {
  const nome = nomePerModello(d.nome);
  if (!nome) return salta("manca il nome");
  const chi = nomePerModello(consulente);
  if (!chi) return salta("manca il nome del consulente");
  return { tipo: "campi", campi: { crm_nome: nome, crm_consulente: chi } };
}

/** ── I QUATTRO MODELLI DELLE SEQUENZE (commessa 2026-10-25) ───────────────
 *  ⚠️ L'ORDINE DELLE CHIAVI È L'ORDINE DELLE VARIABILI DEL MODELLO: chi invia
 *  prende i valori nell'ordine in cui sono qui (`Object.values(campi)` →
 *  `crm_v1…crm_v4`). Le prove lo fissano. Mai il cognome. */

/** `hgl_primo_contatto`: v1 nome. */
export function campiPrimoContatto(d: Partial<LeadData>): CampiOSalta {
  const nome = nomePerModello(d.nome);
  if (!nome) return salta("manca il nome");
  return { tipo: "campi", campi: { crm_nome: nome } };
}

/** `hgl_richiamo_24h`: v1 nome. */
export function campiRichiamo(d: Partial<LeadData>): CampiOSalta {
  return campiPrimoContatto(d);
}

/** `hgl_meet_oggi` (la mattina del meet): v1 nome, v2 ora, v3 consulente.
 *  Non serve il link: il messaggio dice che arriva poco prima dell'inizio. */
export function campiMeetOggi(
  d: Partial<LeadData>,
  consulente: string | null | undefined,
): CampiOSalta {
  const nome = nomePerModello(d.nome);
  if (!nome) return salta("manca il nome");
  const ora = oraNormale(d.oraMeeting);
  if (!ora) return salta("manca l'ora del meet");
  const chi = nomePerModello(consulente);
  if (!chi) return salta("manca il nome del consulente");
  return { tipo: "campi", campi: { crm_nome: nome, crm_ora_meet: ora, crm_consulente: chi } };
}

/** `hgl_meet_adesso` (all'ora esatta): v1 nome, v2 consulente, v3 link. Senza
 *  link non parte: il messaggio serve proprio a farlo entrare. */
export function campiMeetAdesso(
  d: Partial<LeadData>,
  consulente: string | null | undefined,
  leadId?: string | null,
): CampiOSalta {
  const nome = nomePerModello(d.nome);
  if (!nome) return salta("manca il nome");
  const chi = nomePerModello(consulente);
  if (!chi) return salta("manca il nome del consulente");
  const link = linkPerCliente(d, leadId);
  if (!link) return salta("manca il link del meet");
  return { tipo: "campi", campi: { crm_nome: nome, crm_consulente: chi, crm_link_meet: link } };
}

/** ── I MESSAGGI PER STATO (commessa 2026-10-25, piano §5g) ─────────────────
 *  Le variabili nell'ordine di `MODELLI-MANYCHAT.md`, come per le sequenze:
 *   · nome + consulente: `hgl_ricontatto_consulenza` («Ricontatto fissato»,
 *     «In valutazione», «Attesa acconto», «Lead in chat»), `hgl_meet_da_fissare`,
 *     `hgl_da_riprogrammare`;
 *   · nome + ora della chiamata: `hgl_richiamo_concordato`;
 *   · nome: `hgl_non_risponde`, `hgl_cliente_assente`, `hgl_sede_disdetta`,
 *     `hgl_ultimo_tentativo`;
 *   · nome, giorno («giovedì 29 ottobre»), ora, indirizzo: `hgl_promemoria_sede`.
 *  Una variabile vuota → `salta`, mai un buco. Il consulente è quello della
 *  scheda; l'indirizzo viene dal riquadro (`indirizzoSede`). */
export function campiPerStato(
  stato: string,
  d: Partial<LeadData>,
  consulente: string | null | undefined,
  indirizzoSede?: string | null,
): CampiOSalta {
  switch (stato) {
    case "da_ricontattare":
    case "sta_valutando":
    case "fissa_meet_dopo":
    case "in_attesa_acconto":
    case "gestire_in_chat":
    case "da_spostare":
      return campiRicontatto(d, consulente);
    case "richiamo": {
      const nome = nomePerModello(d.nome);
      if (!nome) return salta("manca il nome");
      const ora = oraNormale(d.oraRicontatto);
      if (!ora) return salta("manca l'ora della chiamata");
      return { tipo: "campi", campi: { crm_nome: nome, crm_ora: ora } };
    }
    case "non_risponde":
    case "segreteria":
    case "no_show":
    case "non_fatto":
    case "sede_disdetta":
    case "irreperibile":
      return campiPrimoContatto(d);
    case "viene_in_sede": {
      const nome = nomePerModello(d.nome);
      if (!nome) return salta("manca il nome");
      const giorno = giornoParlato(String(d.dataVieneInSede ?? "").slice(0, 10));
      if (!giorno) return salta("manca la data dell'appuntamento in sede");
      const ora = oraNormale(d.oraVieneInSede);
      if (!ora) return salta("manca l'ora dell'appuntamento in sede");
      const indirizzo = String(indirizzoSede ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!indirizzo) return salta("manca l'indirizzo della sede");
      return {
        tipo: "campi",
        campi: { crm_nome: nome, crm_giorno: giorno, crm_ora: ora, crm_indirizzo: indirizzo },
      };
    }
    default:
      return salta("stato senza messaggio");
  }
}

/** I tre campi che servono a riconoscere la risposta: `crm_lead_id`,
 *  `crm_invio_id`, `crm_telefono` (solo cifre). Senza scheda (webinar, chat)
 *  `crm_lead_id` non si scrive: la risposta si abbina comunque da `crm_invio_id`,
 *  che si riscrive a ogni invio. */
export function campiDiRiconoscimento(i: {
  leadId?: string | null;
  invioId: string;
  telefono: string;
}): CampiContatto {
  const campi: CampiContatto = {};
  if (i.leadId) campi.crm_lead_id = i.leadId;
  campi.crm_invio_id = i.invioId;
  campi.crm_telefono = String(i.telefono ?? "").replace(/\D/g, "");
  return campi;
}

/** `crm_v1…crm_v4` = SOLO i parametri del modello, nell'ordine in cui il
 *  modello li vuole. Più di quattro → errore, mai un parametro tagliato. */
export function campiPorta(parametri: string[]): CampiContatto {
  if (parametri.length > 4) {
    throw new Error("manychat/testi: più di quattro parametri per il modello");
  }
  const campi: CampiContatto = {};
  parametri.forEach((v, i) => (campi[`crm_v${i + 1}`] = String(v ?? "")));
  return campi;
}

/** Il numero per il riquadro: «+39 333 ••• 4567». Mai nei log. Un numero
 *  troppo corto per essere nascosto bene non si mostra affatto. */
export function mascheraNumero(cifre: string): string {
  const n = String(cifre ?? "").replace(/\D/g, "");
  if (n.length < 8) return "•••";
  const italiano = numeroPerWhatsapp(n)?.startsWith("39") && n.startsWith("39");
  if (italiano) {
    const nazionale = n.slice(2);
    return `+39 ${nazionale.slice(0, 3)} ••• ${nazionale.slice(-4)}`;
  }
  return `+${n.slice(0, 2)} ••• ${n.slice(-4)}`;
}
