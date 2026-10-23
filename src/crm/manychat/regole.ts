/** ── CHI PUÒ RICEVERE UN MESSAGGIO AUTOMATICO ──────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 2 (Dev A). Le prove
 *  stanno in `prove/manychat/regole.mjs`.
 *
 *  Modulo PURO: niente rete, niente orologio, niente database.
 *
 *  ── LE REGOLE (PIANO §0, §2a) ─────────────────────────────────────────────
 *   - consenso: vale «Ok a WhatsApp» messo sulla scheda (`data.okWhatsapp`) e,
 *     un giorno, la casella di un modulo (`data.consensoModulo.whatsapp`).
 *     Oggi nessun modulo la salva: all'accensione non parte nessun promemoria
 *     finché i consulenti non spuntano le schede.
 *   - «lead del consulente»: `consulenteId` di un consulente attivo con
 *     `faConsulente` vero (`mestieriDi`), NON in «Lead importati» (`eImportato`,
 *     spostata qui da CRM.trattative.tsx) e in stato `da_ricontattare`,
 *     `sta_valutando` o `fissa_meet_dopo`.
 *   - freno «mai due volte senza risposta»: PER TELEFONO. Si sblocca con una
 *     risposta, con un cambio a mano (`contattoWa.sbloccatoIl`) o col
 *     ripristino da STOP.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ConsensoModulo, Consultant, ContattoWa, LeadData, OkWhatsapp } from "../types";
import { mestieriDi } from "../kpi-setter";
import { numeroPerWhatsapp } from "../promemoria/formati";

/** ── L'INTERRUTTORE DI REGOLA: IL FRENO VALE ANCHE PER IL PROMEMORIA? ──────
 *  Decisione APERTA del titolare. La SEGNALAZIONE prometteva «mai due messaggi
 *  senza risposta»: una conferma senza risposta seguita dal promemoria sono
 *  due messaggi senza risposta. Finché il titolare non risponde per iscritto
 *  il freno vale, e l'interruttore «Promemoria 25'» non si accende prima.
 *  Cambiare idea è QUESTA riga (`quando.ts` la legge, e le prove ci passano
 *  sopra in tutti e due i versi). */
export const FRENO_ANCHE_PER_PROMEMORIA = true;

/** Da dove viene il consenso. */
export type ViaConsenso = "scheda" | "modulo";

export interface Consenso {
  si: boolean;
  via: ViaConsenso | null;
  /** ISO di quando è stato dato, se si sa */
  il: string | null;
  /** chi l'ha messo sulla scheda (solo via «scheda») */
  da: string | null;
}

const NESSUN_CONSENSO: Consenso = { si: false, via: null, il: null, da: null };
const testoOnull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Il consenso WhatsApp di una scheda.
 *  - «Ok a WhatsApp» messo sulla scheda dopo averlo chiesto a voce;
 *  - oppure la casella di un modulo (oggi nessun modulo la salva: c'è perché
 *    un giorno qualcuno comincerà).
 *  ⚠️ Vale solo `true` vero: "true" o 1 scritti da un'esportazione non danno
 *   il permesso di scrivere a una persona.
 *  ⚠️ Se il consulente ha SPENTO «Ok a WhatsApp» (`si: false`) quella è una
 *   revoca, e batte anche la casella del modulo: chi ha detto «non scrivetemi»
 *   al telefono non deve ricevere niente perché un modulo, mesi fa, diceva sì. */
export function consensoWhatsapp(d: Partial<LeadData> | null | undefined): Consenso {
  const ok = d?.okWhatsapp as Partial<OkWhatsapp> | undefined;
  const modulo = d?.consensoModulo as Partial<ConsensoModulo> | undefined;
  if (ok && typeof ok === "object") {
    if (ok.si === true) {
      return { si: true, via: "scheda", il: testoOnull(ok.il), da: testoOnull(ok.da) };
    }
    if (ok.si === false) return NESSUN_CONSENSO;
  }
  if (modulo && typeof modulo === "object" && modulo.whatsapp === true) {
    return { si: true, via: "modulo", il: testoOnull(modulo.il), da: null };
  }
  return NESSUN_CONSENSO;
}

/** «Lead importati» = `importato` vero e non ancora con consulenza fissata
 *  (data del meet + consulente). Era in CRM.trattative.tsx; la regola è la
 *  stessa di `statiPer` in types.ts. */
export function eImportato(l: { data: Partial<LeadData> }): boolean {
  return !!l.data.importato && !(l.data.dataMeeting && l.data.consulenteId);
}

/** Gli stati in cui un consulente ha una trattativa da riprendere con un
 *  ricontatto: «Ricontatto fissato», «In valutazione», «Fissa meet dopo».
 *  Esclusi `richiamo` (lo fa il setter) e `ci_ricontatta_lui` (aspettiamo noi). */
export const STATI_RICONTATTO_AUTOMATICO = ["da_ricontattare", "sta_valutando", "fissa_meet_dopo"];

/** La scheda è di un consulente (non del setter, non importata) e in uno stato
 *  per cui si ricontatta. `consulenti` = quelli dell'installazione.
 *  Il ruolo si legge da `mestieriDi` (ripiego di lettura «consulente sì» per
 *  chi non ha mai compilato i mestieri), non si indovina dal nome. */
export function eLeadDelConsulente(
  l: { data: Partial<LeadData> },
  consulenti: Pick<Consultant, "id" | "data">[],
): boolean {
  if (eImportato(l)) return false;
  if (!STATI_RICONTATTO_AUTOMATICO.includes(String(l.data.stato ?? ""))) return false;
  const id = l.data.consulenteId;
  if (!id) return false;
  const c = consulenti.find((x) => x.id === id);
  if (!c || c.data?.attivo !== true) return false;
  return mestieriDi(c.data).faConsulente === true;
}

/** Il telefono come lo vuole il registro: solo cifre col prefisso (riusa
 *  `numeroPerWhatsapp`). `null` se non è un numero a cui scrivere. */
export function numeroWa(telefono?: string | null): string | null {
  return numeroPerWhatsapp(telefono);
}

/** Le ultime nove cifre: è il «telefono» delle chiavi (`p|tel9|…`, `r|tel9|…`)
 *  e il modo di dire che due numeri scritti in modo diverso sono lo stesso.
 *  Vuoto se le cifre sono meno di nove. */
export function ultimeNoveCifre(telefono?: string | null): string {
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  return cifre.length >= 9 ? cifre.slice(-9) : "";
}

/** Una riga del registro `manychat_invii`, quanto basta ai freni. */
export interface InvioPerFreno {
  /** solo cifre */
  telefono: string;
  tipo: "promemoria" | "ricontatto" | "conferma" | "chat" | "webinar" | "prova";
  stato: "prenotato" | "inviato" | "fallito" | "saltato" | "incerto";
  /** ISO */
  prenotatoIl: string;
  rispostaIl?: string | null;
  sbloccatoIl?: string | null;
  /** la chiave unica (`p|tel9|…`, `r|tel9|…`), se la riga ne ha una */
  chiave?: string | null;
}

/** Gli invii che il freno guarda: i messaggi AUTOMATICI al cliente. La chat è
 *  una persona che scrive, il webinar è un altro prodotto, la prova è del
 *  titolare. */
export const TIPI_AUTOMATICI: InvioPerFreno["tipo"][] = ["promemoria", "ricontatto", "conferma"];
/** Gli stati di un invio che può essere arrivato (o sta arrivando): «fallito» e
 *  «saltato» non hanno raggiunto nessuno. Sono gli stessi che contano nei tetti
 *  e nella pausa per contatto dell'SQL. */
export const STATI_ARRIVATI: InvioPerFreno["stato"][] = ["prenotato", "inviato", "incerto"];

const istante = (iso?: string | null): number => {
  const t = iso ? Date.parse(iso) : Number.NaN;
  return t;
};

/** Il freno «mai due volte senza risposta», per TELEFONO: `true` = l'ultimo
 *  messaggio automatico a quel numero non ha avuto risposta, il prossimo non
 *  parte.
 *  Si sblocca con: una risposta (sulla riga, o su una qualunque riga arrivata
 *  dopo l'ultimo invio), un cambio a mano (`sbloccatoIl`, sulla riga o sulla
 *  scheda, dopo l'ultimo invio), un «Ha risposto» sulla scheda dopo l'ultimo
 *  invio, il ripristino da STOP (scrive `sbloccatoIl`). */
export function aspettaRisposta(
  telefono: string,
  invii: InvioPerFreno[],
  contattoWa: ContattoWa | undefined,
): boolean {
  const tel = ultimeNoveCifre(telefono);
  if (!tel) return false;
  const suoi = invii.filter((i) => ultimeNoveCifre(i.telefono) === tel);
  const arrivati = suoi.filter(
    (i) => TIPI_AUTOMATICI.includes(i.tipo) && STATI_ARRIVATI.includes(i.stato),
  );
  if (arrivati.length === 0) return false;
  //  L'ultimo per ora di prenotazione, non per posizione nell'elenco. Una data
  //  illeggibile conta come la più vecchia, e il suo sblocco non si legge mai:
  //  nel dubbio il freno resta.
  const ultimo = arrivati.reduce((a, b) =>
    (istante(b.prenotatoIl) || -Infinity) >= (istante(a.prenotatoIl) || -Infinity) ? b : a,
  );
  if (ultimo.rispostaIl || ultimo.sbloccatoIl) return false;
  const t = istante(ultimo.prenotatoIl);
  if (suoi.some((i) => istante(i.rispostaIl) >= t)) return false;
  if (contattoWa) {
    if (istante(contattoWa.sbloccatoIl) >= t) return false;
    if (contattoWa.stato === "ha_risposto" && istante(contattoWa.il) >= t) return false;
  }
  return true;
}
