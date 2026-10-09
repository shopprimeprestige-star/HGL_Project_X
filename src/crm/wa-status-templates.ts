/** ─────────────────────────────────────────────────────────────────────────
 *  STATO DELLA TRATTATIVA → TEMPLATE APPROVATO DA META
 *
 *  ATTENZIONE: QUESTI NON SONO I MESSAGGI DEL CRM
 *  I messaggi che si scrivono ai clienti stanno in `whatsapp.ts` e si
 *  modificano da /CRM/whatsapp: sono testo libero, valgono per tutti e venti
 *  gli stati e si mandano aprendo WhatsApp.
 *  Questa mappa serve a un'altra cosa: l'invio AUTOMATICO tramite l'API di
 *  Meta, che accetta soltanto template registrati e approvati da Meta stessa,
 *  uno per uno, con giorni di attesa. I testi pronti da incollare nel Business
 *  Manager stanno in `wa-meta-templates.ts`.
 *
 *  PERCHÉ NON CI SONO TUTTI E VENTI GLI STATI
 *  Ogni voce qui sotto presuppone un template DAVVERO approvato in Meta con
 *  quel nome: aggiungerne uno che non esiste non fa partire il messaggio, fa
 *  fallire l'invio. Gli stati mancanti (da contattare, non risponde,
 *  segreteria, richiamo, non interessato, consulenza svolta / non svolta, da
 *  riprogrammare) non sono una dimenticanza: finché il template non è
 *  approvato, il pannello lead apre WhatsApp col messaggio già scritto e lo si
 *  manda a mano. Meglio un gesto in più che un invio fallito in silenzio.
 *
 *  Le sostituzioni dell'utente stanno in whatsapp_settings.status_template_map.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadStatus } from "./types";

export interface StatusTemplate {
  /** Nome del template approvato in Meta WA Manager */
  name: string;
  /** Codice lingua del template (es. "it", "it_IT", "en_US"). Default "it". */
  lang: string;
}

export const DEFAULT_STATUS_TEMPLATE_MAP: Partial<Record<LeadStatus, StatusTemplate>> = {
  appuntamento_fissato: { name: "appuntamento_conferma", lang: "it" },
  //  Stesso template approvato dell'appuntamento normale: il testo che Meta ha
  //  approvato conferma un giorno e un'ora, e per il cliente di ritorno è
  //  esattamente la stessa conferma. Senza questa riga l'invio automatico non
  //  partiva affatto — in silenzio, che è il modo peggiore.
  appuntamento_rifissato: { name: "appuntamento_conferma", lang: "it" },
  venduto: { name: "ringraziamento_vendita", lang: "it" },
  //  ── LE TRE CHIUSURE VINTE ────────────────────────────────────────────────
  //   Puntano tutte e tre al template GIÀ APPROVATO della vendita, e non a tre
  //   nomi nuovi: qui dentro non si scrive testo, si nomina un modello che Meta
  //   deve avere approvato — un nome inventato non viene rifiutato con un
  //   errore, semplicemente l'invio non parte, in silenzio.
  //   Senza queste righe succedeva la stessa cosa per un'altra strada: dopo
  //   ogni vendita di oggi il messaggio automatico non partiva più affatto,
  //   perché lo stato "venduto" non lo assegna più nessuno.
  //   ⚠️ È un ripiego dichiarato: il testo approvato ringrazia e basta, quindi
  //    non dice al cliente COME gli arriva l'impianto. Il giorno in cui Meta
  //    approva tre modelli distinti (posa in centro / a domicilio / spedizione)
  //    si cambiano questi tre nomi e nient'altro. Il messaggio scritto a mano,
  //    quello sì, li distingue già (crm/whatsapp.ts).
  posa_in_sede: { name: "ringraziamento_vendita", lang: "it" },
  posa_a_domicilio: { name: "ringraziamento_vendita", lang: "it" },
  posa_da_spedire: { name: "ringraziamento_vendita", lang: "it" },
  //  «Irreperibile» resta SENZA template, ed è voluto: a chi non risponde da
  //  settimane non si manda un messaggio automatico in più. Il testo per
  //  riaprire la porta esiste (crm/whatsapp.ts) e lo si manda a mano, quando si
  //  decide di farlo.
  acconto: { name: "acconto_ricevuto", lang: "it" },
  in_attesa_acconto: { name: "promemoria_acconto", lang: "it" },
  viene_in_sede: { name: "conferma_sede", lang: "it" },
  gestire_in_chat: { name: "gestire_in_chat", lang: "it" },
  sta_valutando: { name: "follow_up_valutazione", lang: "it" },
  da_ricontattare: { name: "promemoria_ricontatto", lang: "it" },
  fissa_meet_dopo: { name: "fissa_meet", lang: "it" },
  no_show: { name: "no_show_recover", lang: "it" },
  perdi_tempo: { name: "ringraziamento_neutro", lang: "it" },
  concluso: { name: "ringraziamento_finale", lang: "it" },
};

export function resolveStatusTemplate(
  status: LeadStatus,
  override: Record<string, StatusTemplate> | null | undefined,
  disabled?: string[] | null,
): StatusTemplate | null {
  if (disabled && disabled.includes(status)) return null;
  const o = override?.[status];
  if (o && o.name) return o;
  return DEFAULT_STATUS_TEMPLATE_MAP[status] ?? null;
}
