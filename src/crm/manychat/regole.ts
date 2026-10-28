/** ── CHI PUÒ RICEVERE UN MESSAGGIO AUTOMATICO ──────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 2 (Dev A). Le prove
 *  stanno in `prove/manychat/regole.mjs`.
 *
 *  Modulo PURO: niente rete, niente orologio, niente database.
 *
 *  ── LE REGOLE (PIANO §0, §2a) ─────────────────────────────────────────────
 *   - consenso: vale «Ok a WhatsApp» messo sulla scheda (`data.okWhatsapp`) e
 *     il modulo delle inserzioni (`data.consensoModulo`), ma il modulo solo se
 *     è DOPO la frase del consenso (commessa 2026-10-25, `moduloVale`).
 *   - «lead del consulente»: `consulenteId` di un consulente attivo con
 *     `faConsulente` vero (`mestieriDi`), NON in «Lead importati» (`eImportato`,
 *     spostata qui da CRM.trattative.tsx) e in stato `da_ricontattare`,
 *     `sta_valutando` o `fissa_meet_dopo`.
 *   - freno «mai due volte senza risposta»: PER TELEFONO. Si sblocca con una
 *     risposta, con un cambio a mano (`contattoWa.sbloccatoIl`) o col
 *     ripristino da STOP.
 *  ───────────────────────────────────────────────────────────────────────── */
import type {
  ConsensoModulo,
  Consultant,
  ContattoWa,
  LeadData,
  OkWhatsapp,
  TipoInvio,
} from "../types";
import { mestieriDi } from "../kpi-setter";
import { numeroPerWhatsapp } from "../promemoria/formati";
import { istanteDiRoma } from "./contatto";

/** ── L'INTERRUTTORE DI REGOLA: IL FRENO VALE ANCHE PER IL PROMEMORIA? ──────
 *  Risposta del titolare (SPEC 25/10, §3): il giorno del meet partono la
 *  mattina, i 25' e l'ora esatta, e NON li frena «mai due senza risposta»:
 *  sono messaggi di servizio di un appuntamento preso. Il freno resta per gli
 *  altri. La conferma scritta la chiede il capo progetto prima di accendere.
 *  Tornare indietro è QUESTA riga (`quando.ts` la legge, e le prove ci passano
 *  sopra in tutti e due i versi). */
export const FRENO_ANCHE_PER_PROMEMORIA = false;

/** ── CONSENSO DI TUTTI I LEAD (decisione del titolare, 28/10/2026) ─────────
 *  «Tutti i lead nel CRM hanno dato il consenso, anche quelli aggiunti prima»:
 *  una scheda senza «Ok a WhatsApp» e senza modulo valido vale come consenso
 *  dato (via «titolare»). La revoca (`okWhatsapp.si === false`) e lo STOP
 *  restano più forti. Tornare alla regola di prima è QUESTA riga. */
export const CONSENSO_DI_TUTTI = true;

/** Da dove viene il consenso. */
export type ViaConsenso = "scheda" | "modulo" | "titolare";

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

/** Il consenso del modulo vale? Solo se la scheda dice `whatsapp: true` e il
 *  modulo è stato compilato DOPO la frase del consenso (`fraseModuloDal`, la
 *  data che il titolare segna nel riquadro). Senza quella data non vale per
 *  nessuno; un `il` nullo o illeggibile non vale mai (il piano non indovina:
 *  una lista vecchia caricata dopo la frase non deve ricevere niente). */
export function moduloVale(
  d: Partial<LeadData> | null | undefined,
  fraseModuloDal: string | null,
): boolean {
  const modulo = d?.consensoModulo as Partial<ConsensoModulo> | undefined;
  if (!modulo || typeof modulo !== "object" || modulo.whatsapp !== true) return false;
  const il = typeof modulo.il === "string" ? Date.parse(modulo.il) : Number.NaN;
  const frase = typeof fraseModuloDal === "string" ? Date.parse(fraseModuloDal) : Number.NaN;
  return Number.isFinite(il) && Number.isFinite(frase) && il >= frase;
}

/** Il consenso WhatsApp di una scheda.
 *  - «Ok a WhatsApp» messo sulla scheda dopo averlo chiesto a voce;
 *  - oppure il modulo delle inserzioni, ma solo se compilato dopo la frase
 *    (`moduloVale`). ⚠️ `fraseModuloDal` è OBBLIGATORIO (`null` = nessuna data
 *    segnata): così `tsc` trova ogni chiamata che se ne dimentica.
 *  ⚠️ Vale solo `true` vero: "true" o 1 scritti da un'esportazione non danno
 *   il permesso di scrivere a una persona.
 *  ⚠️ Se il consulente ha SPENTO «Ok a WhatsApp» (`si: false`) quella è una
 *   revoca, e batte anche il modulo: chi ha detto «non scrivetemi» al telefono
 *   non deve ricevere niente perché un modulo, mesi fa, diceva sì. */
export function consensoWhatsapp(
  d: Partial<LeadData> | null | undefined,
  fraseModuloDal: string | null,
): Consenso {
  const ok = d?.okWhatsapp as Partial<OkWhatsapp> | undefined;
  const modulo = d?.consensoModulo as Partial<ConsensoModulo> | undefined;
  if (ok && typeof ok === "object") {
    if (ok.si === true) {
      return { si: true, via: "scheda", il: testoOnull(ok.il), da: testoOnull(ok.da) };
    }
    if (ok.si === false) return NESSUN_CONSENSO;
  }
  if (moduloVale(d, fraseModuloDal)) {
    return { si: true, via: "modulo", il: testoOnull(modulo?.il), da: null };
  }
  if (CONSENSO_DI_TUTTI) return { si: true, via: "titolare", il: null, da: null };
  return NESSUN_CONSENSO;
}

/** «Lead importati» = `importato` vero e non ancora con consulenza fissata
 *  (data del meet + consulente). Era in CRM.trattative.tsx; la regola è la
 *  stessa di `statiPer` in types.ts. */
export function eImportato(l: { data: Partial<LeadData> }): boolean {
  return !!l.data.importato && !(l.data.dataMeeting && l.data.consulenteId);
}

/** Gli stati dei messaggi «A DATA» (piano §5g): il giorno di `dataRicontatto` il
 *  consulente ricontatta. «Ricontatto fissato», «In valutazione», «Meet da
 *  fissare», «Attesa acconto», «Lead in chat» e «Da riprogrammare» (quest'ultimo
 *  solo se ha una data; senza, parte a evento dopo 30'). Esclusi `richiamo`
 *  (a orario) e `ci_ricontatta_lui` (aspettiamo noi). La prova confronta
 *  quest'elenco con la tabella di `stati.ts`. */
export const STATI_RICONTATTO_AUTOMATICO = [
  "da_ricontattare",
  "sta_valutando",
  "fissa_meet_dopo",
  "in_attesa_acconto",
  "gestire_in_chat",
  "da_spostare",
];

/** La scheda è di un consulente: `consulenteId` di un consulente attivo con
 *  `faConsulente`, e non in «Lead importati». Non guarda lo stato. `consulenti`
 *  = quelli dell'installazione. Il ruolo si legge da `mestieriDi` (ripiego di
 *  lettura «consulente sì» per chi non ha mai compilato i mestieri), non si
 *  indovina dal nome. */
export function eDelConsulente(
  l: { data: Partial<LeadData> },
  consulenti: Pick<Consultant, "id" | "data">[],
): boolean {
  if (eImportato(l)) return false;
  const id = l.data.consulenteId;
  if (!id) return false;
  const c = consulenti.find((x) => x.id === id);
  if (!c || c.data?.attivo !== true) return false;
  return mestieriDi(c.data).faConsulente === true;
}

/** La scheda è di un consulente e in uno stato «a data» (`STATI_RICONTATTO_AUTOMATICO`). */
export function eLeadDelConsulente(
  l: { data: Partial<LeadData> },
  consulenti: Pick<Consultant, "id" | "data">[],
): boolean {
  if (!STATI_RICONTATTO_AUTOMATICO.includes(String(l.data.stato ?? ""))) return false;
  return eDelConsulente(l, consulenti);
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
  tipo: TipoInvio;
  stato: "prenotato" | "inviato" | "fallito" | "saltato" | "incerto";
  /** ISO */
  prenotatoIl: string;
  rispostaIl?: string | null;
  sbloccatoIl?: string | null;
  /** la chiave unica (`p|tel9|…`, `r|tel9|…`, `n|tel9`…), se la riga ne ha una */
  chiave?: string | null;
}

/** Gli invii che il freno guarda: i messaggi AUTOMATICI al cliente. La chat è
 *  una persona che scrive, il webinar è un altro prodotto, la prova è del
 *  titolare. Con la commessa 2026-10-25 ci sono anche i sette tipi nuovi. */
export const TIPI_AUTOMATICI: InvioPerFreno["tipo"][] = [
  "promemoria",
  "ricontatto",
  "conferma",
  "primo_contatto",
  "richiamo_24h",
  "ritorno",
  "meet_oggi",
  "meet_domani",
  "meet_adesso",
  "promemoria_chiamata",
  "promemoria_sede",
];
/** Quelli che contano nei tetti: i dieci del giro (la conferma parte da un'altra
 *  strada, subito dopo la prenotazione, e non ha tetto). */
export const TIPI_NEI_TETTI: InvioPerFreno["tipo"][] = TIPI_AUTOMATICI.filter(
  (t) => t !== "conferma",
);
/** I messaggi di servizio di un appuntamento preso: NON li ferma «mai due senza
 *  risposta» (ma contano nei tetti e rispettano STOP). */
export const TIPI_SENZA_FRENO: InvioPerFreno["tipo"][] = [
  "promemoria",
  "meet_oggi",
  "meet_domani",
  "meet_adesso",
  "promemoria_chiamata",
  "promemoria_sede",
];
/** Quelli che si prendono e si aspettano il ritmo di 27-33': solo i ricontatti
 *  e i richiami, i meno attesi dal cliente (revisore, punto 1). Gli altri sette
 *  non lo toccano, o i messaggi a evento scadrebbero in coda. */
export const TIPI_COL_RITMO: InvioPerFreno["tipo"][] = ["ricontatto", "richiamo_24h"];
/** Gli stati di un invio che può essere arrivato (o sta arrivando): «fallito» e
 *  «saltato» non hanno raggiunto nessuno. Sono gli stessi che contano nei tetti
 *  e nella pausa per contatto dell'SQL. */
export const STATI_ARRIVATI: InvioPerFreno["stato"][] = ["prenotato", "inviato", "incerto"];

const istante = (iso?: string | null): number => {
  const t = iso ? Date.parse(iso) : Number.NaN;
  return t;
};

/** Dopo quanti giorni dall'invio un messaggio senza risposta smette di frenare
 *  (qualunque tipo). Decisione del capo progetto: senza un limite, chi si
 *  collega al meet senza scrivere su WhatsApp resterebbe bloccato per sempre. */
export const FRENO_SCADE_DOPO_GIORNI = 7;

/** Il prefisso della chiave di ogni messaggio legato a un appuntamento:
 *  `p|` promemoria 25', `o|` mattina del meet, `d|` 24 ore prima, `a|` ora
 *  esatta, `ch|` chiamata concordata, `sd|` appuntamento in sede. Tutte
 *  `prefisso|tel9|AAAA-MM-GGTHH:MM`. */
const PREFISSO_APPUNTAMENTO: Partial<Record<InvioPerFreno["tipo"], string>> = {
  promemoria: "p",
  meet_oggi: "o",
  meet_domani: "d",
  meet_adesso: "a",
  promemoria_chiamata: "ch",
  promemoria_sede: "sd",
};

/** L'inizio dell'appuntamento a cui si riferisce una riga di quei sei tipi,
 *  letto dalla sua chiave (ora di Roma). `null` se non si legge. */
function inizioAppuntamentoDi(i: InvioPerFreno): number | null {
  const prefisso = PREFISSO_APPUNTAMENTO[i.tipo];
  if (!prefisso) return null;
  const m = new RegExp(`^${prefisso}\\|\\d+\\|(\\d{4}-\\d{2}-\\d{2})T(\\d{2}:\\d{2})$`).exec(
    i.chiave ?? "",
  );
  const inizio = m ? istanteDiRoma(m[1], m[2]) : null;
  return inizio ? inizio.getTime() : null;
}

/** L'ultimo messaggio automatico ARRIVATO a quel telefono (per ora di
 *  prenotazione, non per posizione nell'elenco). `null` se non ce n'è. Una data
 *  illeggibile conta come la più vecchia. */
export function ultimoAutomatico(telefono: string, invii: InvioPerFreno[]): InvioPerFreno | null {
  const tel = ultimeNoveCifre(telefono);
  if (!tel) return null;
  const arrivati = invii.filter(
    (i) =>
      ultimeNoveCifre(i.telefono) === tel &&
      TIPI_AUTOMATICI.includes(i.tipo) &&
      STATI_ARRIVATI.includes(i.stato),
  );
  if (arrivati.length === 0) return null;
  return arrivati.reduce((a, b) =>
    (istante(b.prenotatoIl) || -Infinity) >= (istante(a.prenotatoIl) || -Infinity) ? b : a,
  );
}

/** Il freno «mai due volte senza risposta», per TELEFONO: `true` = l'ultimo
 *  messaggio automatico a quel numero non ha avuto risposta, il prossimo non
 *  parte.
 *  Si sblocca con: una risposta (sulla riga, o su una qualunque riga arrivata
 *  dopo l'ultimo invio), un cambio a mano (`sbloccatoIl`, sulla riga o sulla
 *  scheda, dopo l'ultimo invio), un «Ha risposto» sulla scheda dopo l'ultimo
 *  invio, il ripristino da STOP (scrive `sbloccatoIl`).
 *  Ed è un freno che SCADE (decisione del capo progetto):
 *   (a) un messaggio di appuntamento senza risposta (promemoria, mattina, ora
 *       esatta, chiamata, sede) non frena più quando il suo appuntamento è
 *       iniziato — chi si collega alla consulenza senza scrivere su WhatsApp è
 *       il caso normale, non un silenzio da rispettare. Se il meet viene
 *       spostato PRIMA dell'inizio, il vecchio messaggio frena ancora (il suo
 *       meet non è iniziato): va bene così;
 *   (b) qualunque messaggio senza risposta smette di frenare dopo
 *       `FRENO_SCADE_DOPO_GIORNI` giorni dall'invio. */
export function aspettaRisposta(
  telefono: string,
  invii: InvioPerFreno[],
  contattoWa: ContattoWa | undefined,
  adesso: Date,
): boolean {
  const tel = ultimeNoveCifre(telefono);
  if (!tel) return false;
  const suoi = invii.filter((i) => ultimeNoveCifre(i.telefono) === tel);
  //  L'ultimo per ora di prenotazione, non per posizione nell'elenco. Una data
  //  illeggibile conta come la più vecchia, e il suo sblocco non si legge mai:
  //  nel dubbio il freno resta.
  const ultimo = ultimoAutomatico(telefono, invii);
  if (!ultimo) return false;
  if (ultimo.rispostaIl || ultimo.sbloccatoIl) return false;
  const t = istante(ultimo.prenotatoIl);
  if (adesso.getTime() - t >= FRENO_SCADE_DOPO_GIORNI * 86_400_000) return false;
  const inizioMeet = inizioAppuntamentoDi(ultimo);
  if (inizioMeet !== null && inizioMeet <= adesso.getTime()) return false;
  if (suoi.some((i) => istante(i.rispostaIl) >= t)) return false;
  if (contattoWa) {
    if (istante(contattoWa.sbloccatoIl) >= t) return false;
    if (contattoWa.stato === "ha_risposto" && istante(contattoWa.il) >= t) return false;
  }
  return true;
}
