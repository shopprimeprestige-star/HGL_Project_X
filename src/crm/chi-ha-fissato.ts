/** ── CHI HA FISSATO QUESTA CONSULENZA ──────────────────────────────────────
 *
 *  Segnalazione del committente: «il setter, dopo che fissa le consulenze, non
 *  può più vedere la lista di quello che ha fissato: fai che ce l'abbia».
 *
 *  ── PERCHÉ SPARIVA, E SONO DUE MOTIVI DIVERSI ────────────────────────────
 *  La linguetta «Fissati da me» leggeva `statoDa`, che però NON vuol dire «chi
 *  ha preso l'appuntamento»: vuol dire «chi ha toccato lo stato per ultimo»
 *  (crm/CRMContext, updateLead). Due conseguenze, e tutte e due si vedono in
 *  archivio:
 *
 *   1. SI RISCRIVE. Il setter fissa, e `statoDa` è suo. Il giorno dopo il
 *      consulente segna «non si è presentato» e `statoDa` diventa DEL
 *      CONSULENTE: da quel momento quella consulenza non è più di nessuno —
 *      di sicuro non del setter che l'ha presa.
 *   2. L'ELENCO CHIEDEVA ANCHE CHE FOSSE ANCORA UN APPUNTAMENTO. Quindi
 *      bastava un esito — venduto, assente, annullato — e la riga usciva
 *      comunque dalla lista. Ma il lavoro del setter è AVER FISSATO: come sia
 *      finita è un'altra colonna, non un motivo per cancellargliela.
 *
 *  Misurato il 7/10/2026: 670 schede con un appuntamento, 137 con `statoDa`.
 *  Quattro consulenze su cinque non risultavano fissate da nessuno.
 *
 *  ── COM'È ADESSO ─────────────────────────────────────────────────────────
 *  Un campo suo, `fissatoDa`, che si scrive UNA VOLTA SOLA — il momento in cui
 *  la scheda entra in uno stato di appuntamento — e che nessun esito successivo
 *  tocca più. Accanto, `fissatoIl`: quando è stata presa, non quando è
 *  fissata la consulenza.
 *
 *  ⚠️ SI SCRIVE UNA VOLTA SOLA, ed è tutta la correzione. Un appuntamento
 *   spostato tre volte da tre persone resta di chi l'ha PRESO: è lui che ha
 *   fatto la telefonata. Se il campo c'è già, non si tocca.
 *  ⚠️ `statoDa` RESTA E NON CAMBIA MESTIERE: continua a dire chi ha toccato lo
 *   stato per ultimo, che serve ad altre schermate. Qui si legge solo come
 *   RIPIEGO per le schede di prima di questo campo — meglio «probabilmente
 *   lui» che «nessuno», ma lo si dice.
 *  ⚠️ `consulenteId` NON C'ENTRA: dice chi FARÀ la consulenza, che è quasi
 *   sempre un'altra persona. È l'errore che questa riga esiste per non rifare.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData, type LeadStatus } from "@/crm/types";

const testo = (v: unknown): string => String(v ?? "").trim();

/** Quanto è attendibile il nome di chi l'ha fissata. */
export type FontePrenotazione =
  /** scritto nel momento in cui è stata presa: è lui */
  | "certa"
  /** dedotto da `statoDa` su una scheda di prima del campo: probabilmente lui */
  | "dedotta"
  /** non si sa, e non si inventa */
  | "ignota";

export interface ChiHaFissato {
  /** L'identificativo del collaboratore. Vuoto = non si sa. */
  id: string;
  fonte: FontePrenotazione;
  /** ISO di quando è stata presa, se si sa. */
  quando: string;
}

/** Chi ha fissato questa consulenza, e quanto ci si può contare. */
export function chiHaFissato(d?: Partial<LeadData> | null): ChiHaFissato {
  const certo = testo(d?.fissatoDa);
  if (certo) return { id: certo, fonte: "certa", quando: testo(d?.fissatoIl) };
  /*  ⚠️ IL RIPIEGO VALE SOLO SE QUELLA SCHEDA UN APPUNTAMENTO CE L'HA, adesso
      o prima: `statoDa` su una scheda che non è mai stata un appuntamento dice
      solo che qualcuno ha cambiato uno stato qualunque, e spacciarlo per «ha
      fissato» riempirebbe l'elenco del setter di gente che non ha mai visto. */
  const vecchio = testo(d?.statoDa);
  if (vecchio && (eAppuntamento(d?.stato) || eAppuntamento(d?.statoPrecedente))) {
    return { id: vecchio, fonte: "dedotta", quando: testo(d?.statoPrecedenteIl) };
  }
  return { id: "", fonte: "ignota", quando: "" };
}

/** L'ha fissata questa persona? */
export function fissataDa(d: Partial<LeadData> | null | undefined, chi?: string | null): boolean {
  const io = testo(chi);
  return !!io && chiHaFissato(d).id === io;
}

/** ── LA MODIFICA DA SCRIVERE QUANDO SI PRENDE UN APPUNTAMENTO ─────────────
 *  Vuota quando non c'è niente da scrivere: non è un appuntamento, non si sa
 *  chi sta lavorando, oppure il campo c'è già (e allora NON si tocca).
 *  ⚠️ `primaEra` serve a riconoscere il momento in cui si PRENDE: una scheda
 *   che è già un appuntamento e a cui si cambia l'ora non sta nascendo adesso,
 *   e riscrivere il nome vorrebbe dire rubare la consulenza a chi l'ha presa.
 *   Fa eccezione la scheda che quel campo non ce l'ha proprio: lì scriverlo è
 *   l'unico modo di non lasciarla di nessuno per sempre. */
export function patchChiFissa(p: {
  prima?: Partial<LeadData> | null;
  statoNuovo?: LeadStatus | string | null;
  chi?: string | null;
  ora?: Date;
}): Partial<LeadData> {
  const io = testo(p.chi);
  if (!io || !eAppuntamento(p.statoNuovo)) return {};
  //  C'è già: è di chi l'ha preso, e non si discute.
  if (testo(p.prima?.fissatoDa)) return {};
  const primaEra = eAppuntamento(p.prima?.stato);
  //  Era già un appuntamento e il campo manca: è una scheda di prima: si
  //  completa, ma con la data che si conosce, non con oggi.
  const quando = (p.ora ?? new Date()).toISOString();
  return {
    fissatoDa: io,
    fissatoIl: primaEra ? testo(p.prima?.statoPrecedenteIl) || quando : quando,
  };
}

/** ── COM'È FINITA ─────────────────────────────────────────────────────────
 *  La lista del setter mostra TUTTO quello che ha fissato, anche quello che
 *  poi è andato male: è il suo lavoro, e com'è finito è una colonna, non un
 *  motivo per farlo sparire. Qui si risponde «in che fase è adesso», in tre
 *  gruppi che si leggono a colpo d'occhio. */
export type EsitoFissato = "in piedi" | "andata" | "da recuperare" | "persa";

const ANDATA: string[] = ["venduto", "acconto", "posa_in_sede", "in_attesa_acconto", "installato"];
const DA_RECUPERARE: string[] = ["no_show", "da_spostare", "fissa_meet_dopo", "da_ricontattare", "sta_valutando", "gestire_in_chat"];
const PERSA: string[] = ["annullato", "non_interessato", "perso", "perdi_tempo", "numero_errato"];

export function esitoFissato(d?: Partial<LeadData> | null): EsitoFissato {
  const s = testo(d?.stato);
  if (eAppuntamento(s)) return "in piedi";
  if (ANDATA.includes(s)) return "andata";
  if (PERSA.includes(s)) return "persa";
  if (DA_RECUPERARE.includes(s)) return "da recuperare";
  //  Uno stato che non conosciamo non è una perdita: si dice «in piedi» solo
  //  quando lo è davvero, e tutto il resto è roba da riprendere in mano.
  return "da recuperare";
}
