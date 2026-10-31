/** ── ACCONTI IN CIMA ALLA CHAT, E «ANTICIPA» CONDIVISO (30/10/2026) ───────────
 *
 *  Richiesta del titolare: «chi ha lasciato l'acconto e ancora non ha fatto l'installazione sia
 *  messo in alto, dal più vecchio al più giovane»; e: se una pratica è in priorità nel CRM lo deve
 *  essere anche su WhatsApp, e viceversa.
 *
 *  ⚠️ UNA SOLA PRIORITÀ: «ANTICIPA» DELLA SCHEDA (`installazione.priorita`, crm/priorita.ts). Qui non
 *  si inventa un secondo campo: la chat la legge dalla scheda e la scrive con le stesse azioni
 *  della pagina Installazioni, quindi le due viste non possono divergere. Le STELLE (28/10) sono
 *  un'altra cosa — «in osservazione», per numero, anche senza scheda — e restano com'erano.
 *
 *  CHI È «DA INSTALLARE»: la scheda ha versato un acconto (o è stata anticipata a mano) e la posa
 *  non è ancora fatta. Stesse domande del resto del CRM: `giaIncassato` per i soldi, `posaCompletata`
 *  per la posa, `daAnticipare` per la priorità. Una posa già fissata ma non ancora eseguita resta
 *  dentro: l'installazione non è avvenuta. Le pratiche perse o chiuse a mano ne escono.
 *
 *  L'ORDINE: prima chi ha Anticipa acceso (con l'ordine di Anticipa: `confrontaAnticipate`), poi
 *  l'acconto più vecchio, e a parità il nome (un elenco che si rimescola a ogni aggiornamento fa
 *  perdere il segno). Pura: niente React, niente Supabase. Provata in prove/idee/acconti-in-cima.mjs. */
import { eChiusuraVinta, fasePer, type Lead } from "../types";
import {
  aspettaUnaData,
  giaIncassato,
  nomeCompleto,
  posaCompletata,
  saldoAllaConsegna,
} from "../InstallationScheduleDialog";
import { confrontaAnticipate, daAnticipare } from "../priorita";
import { dataChiusura } from "../kpi-netto";

/** Una chat qualunque che ha (forse) una scheda: basta questo per ordinarla. */
interface ConScheda {
  lead: Lead | null;
}

/** La pratica è ancora un lavoro di posa aperto? (non persa, non chiusa a mano, posa non fatta) */
function posaAperta(l: Lead): boolean {
  const stato = l.data?.stato;
  if (!l.data || fasePer(stato) === "persa") return false;
  if (stato === "concluso" || stato === "perdi_tempo") return false;
  return !posaCompletata(l);
}

/** Acconto versato e installazione non ancora fatta; oppure Anticipa acceso a mano. */
export function daInstallare(l: Lead | null | undefined): boolean {
  if (!l || !posaAperta(l)) return false;
  return giaIncassato(l) > 0 || daAnticipare(l);
}

/** Si può mettere «Anticipa» a questa scheda? Solo se c'è una posa da portare avanti: acconto,
 *  chiusura vinta (anche «paga alla consegna») o un giorno già fissato. Una trattativa ancora aperta
 *  non ha niente da anticipare. */
export function puoAnticipare(l: Lead | null | undefined): boolean {
  if (!l || !posaAperta(l)) return false;
  return (
    giaIncassato(l) > 0 ||
    eChiusuraVinta(l.data.stato) ||
    aspettaUnaData(l) ||
    !!l.data.installazione?.dataInstallazione
  );
}

/** Il giorno dell'acconto (AAAA-MM-GG): la riga più vecchia del registro incassi; senza registro la
 *  data del pagamento; senza niente il giorno in cui è diventata vendita (la regola dell'attesa
 *  delle installazioni, `dataChiusura`). "" se non si sa. */
export function dataAcconto(l: Lead): string {
  const righe = l.data?.payment?.incassi ?? [];
  const giorni = righe
    .map((r) => String(r?.data ?? "").slice(0, 10))
    .filter((g) => /^\d{4}-\d{2}-\d{2}$/.test(g))
    .sort();
  if (giorni[0]) return giorni[0];
  const pagato = String(l.data?.payment?.dataPagamento ?? "").slice(0, 10);
  return pagato || dataChiusura(l);
}

/** Il giorno (e l'ora) già fissato per la posa, «AAAA-MM-GG HH:MM»; "" se non c'è. */
const giornoPosa = (l: Lead): string => {
  const i = l.data?.installazione;
  const g = String(i?.dataInstallazione ?? "").slice(0, 10);
  return g ? `${g} ${String(i?.orarioInstallazione || "99:99")}` : "";
};

/** Ordine del blocco (richiesta del titolare, 31/10/2026): PRIMA chi non ha ancora il giorno della
 *  posa (anticipate prima, poi l'acconto più vecchio), SOTTO chi ha già il giorno (dal più vicino). */
function confrontaDaInstallare(a: Lead, b: Lead): number {
  const ga = giornoPosa(a);
  const gb = giornoPosa(b);
  if (!ga !== !gb) return ga ? 1 : -1;
  if (ga && gb)
    return ga === gb ? nomeCompleto(a).localeCompare(nomeCompleto(b)) : ga.localeCompare(gb);
  const pa = daAnticipare(a);
  const pb = daAnticipare(b);
  if (pa !== pb) return pa ? -1 : 1;
  if (pa && pb) return confrontaAnticipate(a, b);
  const da = dataAcconto(a);
  const db = dataAcconto(b);
  //  Chi non ha una data va dopo chi ce l'ha: non si sa da quanto aspetta.
  if (!da !== !db) return da ? -1 : 1;
  if (da !== db) return da.localeCompare(db);
  return nomeCompleto(a).localeCompare(nomeCompleto(b));
}

/** Le chat «da installare», nell'ordine del blocco in cima. Le altre non ci sono. Non muta l'ingresso. */
export function chatDaInstallare<T extends ConScheda>(chat: readonly T[]): T[] {
  return chat
    .filter((c) => daInstallare(c.lead))
    .sort((a, b) => confrontaDaInstallare(a.lead as Lead, b.lead as Lead));
}

/** Per le code («Da rispondere», «Altre chat»): dentro la sezione gli acconti salgono, nell'ordine
 *  del blocco; tutte le altre restano nell'ordine di prima. Senza niente da spostare restituisce lo
 *  STESSO elenco. */
export function saliAcconti<T extends ConScheda>(chat: T[]): T[] {
  const sopra = chatDaInstallare(chat);
  if (sopra.length === 0) return chat;
  const su = new Set<T>(sopra);
  return [...sopra, ...chat.filter((c) => !su.has(c))];
}

/** Il tasto «Installazione» dell'intestazione serve solo a chi ha una posa in mano: da fare
 *  (`puoAnticipare`) oppure già eseguita con dei soldi ancora da incassare. Una trattativa aperta non
 *  ha niente da gestire lì, e il tasto in più affollerebbe l'intestazione. */
export function haUnaPosa(l: Lead | null | undefined): boolean {
  if (!l?.data) return false;
  if (puoAnticipare(l)) return true;
  return fasePer(l.data.stato) !== "persa" && posaCompletata(l) && saldoAllaConsegna(l) > 0;
}
