/** ── PRENOTA LA CONSULENZA IN CHAT: L'ORCHESTRATORE ────────────────────────
 *
 *  Commessa 2026-10-27 (PIANO.md, compito T7). Dal messaggio del lead («sera»)
 *  o dal tocco su «Opzione 2» alla risposta per ManyChat: propone tre orari,
 *  prenota, dice «preso» se un altro è arrivato prima. Stile di `risposta.ts`:
 *  `gestisciPrenota` ha la logica (porte finte nelle prove),
 *  `gestisciRichiestaPrenota` passa dalla richiesta HTTP alla risposta HTTP e
 *  legge il corpo SOLO dopo la chiave giusta. Prove in
 *  `prove/manychat/prenota.mjs` (mondo finto in `prenota-mondo.mjs`).
 *
 *  I pezzi veri stanno negli altri moduli `prenota-*` (parole, orari, testi,
 *  scheda, stanza): qui c'è solo l'ORDINE dei passi.
 *
 *  ⚠️ RISPONDE NELLA STESSA RICHIESTA E NON CHIAMA MAI NESSUNO (né ManyChat né
 *   altro fuori dal database): la «porta» che manda i messaggi automatici ha
 *   una pausa di 120 secondi per numero e bloccherebbe la conferma (SPEC 4).
 *  ⚠️ L'ORDINE È IL PIANO (T7): 1 chiave, 2 spenta, 3 si CAPISCE prima di
 *   leggere (un «ok» non costa una lettura), 4 utente e numero, 5 le schede del
 *   numero (STOP, appuntamento futuro, chi può prenotare), 6 il limite di 30
 *   chiamate l'ora (solo per i messaggi capiti), 7 l'azione. Prima del passo 6
 *   non si scrive niente.
 *  ⚠️ DUE LUCCHETTI, SEMPRE NELLO STESSO ORDINE: prima quello del lead, poi
 *   quello del consulente e del giorno (D3). Si rilasciano in ordine inverso,
 *   anche in errore. Dopo la scrittura si RILEGGE l'agenda: se lo slot non è
 *   più libero si disfa (la setter dal browser non prende lucchetti).
 *  ⚠️ MAI UNA PRENOTAZIONE A METÀ: ogni passo che fallisce o sfora il tempo
 *   rimette la scheda e la stanza com'erano (`daDisfare`, `annulla`). Se la
 *   scheda è stata cambiata da una persona nel frattempo NON si disfa alla
 *   cieca: errore e «Da ricontattare», perché la setter lo veda.
 *  ⚠️ Nei log e nelle risposte solo codici (`CodiceLog`): mai numero, nome,
 *   testo del cliente, uuid.
 *  ───────────────────────────────────────────────────────────────────────── */
import { aRoma, minutiAlla } from "../promemoria/formati";
import type { Consultant, Lead, LeadData } from "../types";
import { capisciRisposta } from "./prenota-parole";
import { ancoraLibero, proponi, scegliConsulente } from "./prenota-orari";
import {
  appuntamentoFuturo,
  cambioRicontatto,
  conNota,
  daDisfare,
  daPrenotare,
  presaDallaChat,
  puoPrenotare,
} from "./prenota-scheda";
import { assicuraStanza } from "./prenota-stanza";
import {
  testoAltriFiniti,
  testoConferma,
  testoErrore,
  testoGiaFissato,
  testoNessunOrario,
  testoOpzioneNonCe,
  testoPreso,
  testoProposte,
  testoVecchia,
} from "./prenota-testi";
import {
  chiaveLucchettoConsulente,
  chiaveLucchettoLead,
  improntaNumero,
  prefissoProposta,
  type CodiceLog,
  type ConfigPrenota,
  type CorpoPrenota,
  type EsitoPrenota,
  type EsitoStanza,
  type Fascia,
  type MotivoContatto,
  type OraProposta,
  type PortePrenota,
  type Proposta,
  type RichiestaPrenota,
  type RigaProposta,
  type RispostaPrenota,
} from "./prenota-tipi";
import { cifreTelefono, leggiCorpo, leggiCorpoLimitato, stessaChiave } from "./ritorno";

/** Lo stato HTTP della rotta: come `manychat-risposta`. */
export type StatoPrenota = 200 | 401 | 413 | 503;

const MAX_CHIAMATE_ORA = 30;
/** Una proposta vale 6 ore (SPEC 3.7). */
const VALIDITA_PROPOSTA_MS = 6 * 3600e3;
const LUCCHETTO_MS = 20_000;
const TENTATIVI_LUCCHETTO = 2;
const PAUSA_LUCCHETTO_MS = 300;
/** D9: il calcolo (letture e scelta) deve finire entro 4,5 secondi, la scrittura
 *  non deve cominciare dopo 8: ManyChat aspetta circa 10 secondi. */
const BUDGET_CALCOLO_MS = 4500;
const BUDGET_SCRITTURA_MS = 8000;
/** Quante volte si riprova la scrittura se la setter cambia la scheda sotto i piedi. */
const RIPROVE_SCHEDA = 3;

// ── Il corpo che arriva da ManyChat ───────────────────────────────────────

/** Dal JSON al corpo: `azione` fuori lista = illeggibile (`null`). Gli id e il
 *  testo si ripuliscono come per `manychat-risposta` (`leggiCorpo`). ⚠️ Il
 *  `subscriber_id` NON si legge: non serve, ManyChat può continuare a mandarlo. */
export function leggiCorpoPrenota(json: unknown): CorpoPrenota | null {
  const base = leggiCorpo(json);
  if (!base) return null;
  const o = json as Record<string, unknown>;
  if (o.azione !== "testo" && o.azione !== "scelta") return null;
  //  ManyChat manda anche i numeri come testo («3»).
  const grezza = typeof o.scelta === "string" ? o.scelta.trim() : o.scelta;
  const n = typeof grezza === "string" && /^\d{1,2}$/.test(grezza) ? Number(grezza) : grezza;
  return {
    azione: o.azione,
    crmLeadId: base.crmLeadId,
    telefono: base.telefono,
    testo: base.testo,
    scelta: typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 99 ? n : 0,
  };
}

// ── Le risposte ───────────────────────────────────────────────────────────

const nessuno = (codice: CodiceLog): RispostaPrenota => ({ esito: "nessuno", testo: "", codice });
const conTesto = (testo: string, codice: CodiceLog): RispostaPrenota => ({
  esito: "testo",
  testo,
  codice,
});
const conProposte = (testo: string, quante: number, codice: CodiceLog): RispostaPrenota => ({
  esito: `proposte${Math.min(Math.max(quante, 1), 3)}` as EsitoPrenota,
  testo,
  codice,
});

/** Cosa ha chiesto il lead. `tocco` = ha toccato un pulsante (azione `scelta`). */
type Intento =
  | { tipo: "fascia"; fascia: Fascia }
  | { tipo: "scelta"; n: number; tocco: boolean }
  | { tipo: "altri" };

/** Quello che si sa appena identificato il lead. */
interface Base {
  porte: PortePrenota;
  userId: string;
  cfg: ConfigPrenota;
  /** l'istante della richiesta (ora di Roma si ricava da qui) */
  adesso: Date;
  /** l'orologio delle porte all'inizio, per il budget di tempo */
  inizio: number;
  lead: Lead;
}

/** …e quello che serve ai passi dopo il limite delle chiamate. */
interface Ctx extends Base {
  /** la chiave della riga di proposta del numero */
  chiave: string;
  /** la proposta ricordata, com'era all'inizio */
  riga: RigaProposta | null;
}

/** Solo il codice di un errore: il messaggio può contenere dati del cliente. */
const codiceDi = (e: unknown): CodiceLog =>
  (e as { code?: unknown } | null)?.code === "tempo" ? "tempo" : "errore";

function controllaTempo(c: Ctx, limiteMs: number): void {
  if (c.porte.adesso().getTime() - c.inizio > limiteMs) throw { code: "tempo" };
}

const nomeDi = (c: Ctx) => c.lead.data.nome;
const due = (n: number) => String(n).padStart(2, "0");
const giornoPiu = (giorno: string, k: number): string => {
  const [a, m, g] = giorno.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, g + k));
  return `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`;
};

// ── Le letture dell'agenda ────────────────────────────────────────────────

interface Agenda {
  consulenti: Consultant[];
  schede: Lead[];
  blocchi: Awaited<ReturnType<PortePrenota["blocchi"]>>;
}

/** Consulenti, schede con un impegno nella finestra e blocchi, letti insieme.
 *  La finestra va da ieri a un giorno dopo l'ultimo giorno proponibile. */
async function leggiAgenda(c: Ctx): Promise<Agenda> {
  const oggi = aRoma(c.adesso).giorno;
  const [consulenti, schede, blocchi] = await Promise.all([
    c.porte.consulenti(c.userId),
    c.porte.schedeAgenda(c.userId, giornoPiu(oggi, -1), giornoPiu(oggi, c.cfg.giorniAvanti + 1)),
    c.porte.blocchi(),
  ]);
  return { consulenti, schede, blocchi };
}

const datiAgenda = (c: Ctx, a: Agenda) => ({
  schede: a.schede,
  blocchi: a.blocchi,
  adesso: c.adesso,
  preavvisoOre: c.cfg.preavvisoOre,
  durata: c.cfg.durataMin,
});

function proposteDa(c: Ctx, a: Agenda, fascia: Fascia, mostrati: OraProposta[]): Proposta {
  return proponi({
    ...datiAgenda(c, a),
    consulenti: a.consulenti,
    fascia,
    giorniAvanti: c.cfg.giorniAvanti,
    mostrati,
  });
}

// ── Le note e il secondo stato ────────────────────────────────────────────

/** Le righe di nota in chiaro per la setter (D12). Il motivo vero sta anche nel
 *  secondo stato. shortcut: le frasi stanno qui e non in `prenota-testi.ts`
 *  (non vanno al lead); da spostare lì se il titolare vuole cambiarle. */
const NOTA_RICONTATTO: Record<MotivoContatto, string> = {
  prenota_nessun_orario:
    "Il cliente ha chiesto un orario dalla chat WhatsApp ma non ci sono orari liberi online: da ricontattare",
  prenota_altri_finiti:
    "Il cliente ha visto tutti gli orari proposti dalla chat WhatsApp e nessuno va bene: da ricontattare",
  prenota_errore: "La prenotazione dalla chat WhatsApp non è andata a buon fine: da ricontattare",
};

/** Aggiunge una riga alla nota della scheda, con l'ora di Roma. Scrittura
 *  condizionata, fino a 3 tentativi: se una persona sta salvando, vince lei. */
async function aggiungiNota(c: Base, frase: string): Promise<void> {
  const r = aRoma(c.adesso);
  const [, mese, giorno] = r.giorno.split("-");
  const riga = `${giorno}/${mese} ${due(Math.floor(r.minuti / 60))}:${due(r.minuti % 60)} · ${frase}`;
  for (let t = 0; t < RIPROVE_SCHEDA; t++) {
    const s = await c.porte.scheda(c.userId, c.lead.id);
    if (!s) return;
    const esito = await c.porte.scriviScheda(c.userId, c.lead.id, s.updated_at, {
      ...s.data,
      note: conNota(s.data.note, riga),
    });
    if (esito === "ok") return;
  }
}

/** Il secondo stato «Da ricontattare» col motivo, e una riga di nota. Se è già
 *  lì con lo stesso motivo non si rifà (niente righe doppie). */
async function segnaRicontatto(c: Base, motivo: MotivoContatto): Promise<void> {
  const secondo = await c.porte.statoSecondo(c.userId, c.lead.id);
  if (secondo?.contattoWa?.stato === "da_ricontattare" && secondo.contattoWa.motivo === motivo)
    return;
  await c.porte.scriviContatto(c.userId, c.lead.id, cambioRicontatto(motivo, c.adesso));
  await aggiungiNota(c, NOTA_RICONTATTO[motivo]);
}

async function daRicontattare(
  c: Ctx,
  motivo: MotivoContatto,
  testo: string,
  codice: CodiceLog,
): Promise<RispostaPrenota> {
  await segnaRicontatto(c, motivo);
  return conTesto(testo, codice);
}

// ── Le proposte ───────────────────────────────────────────────────────────

type Tipo = "prime" | "altri" | "preso" | "vecchia";
const TESTI = {
  prime: testoProposte,
  altri: testoProposte,
  preso: testoPreso,
  vecchia: testoVecchia,
};
const CODICI: Record<Tipo, CodiceLog> = {
  prime: "proposte",
  altri: "altri",
  preso: "preso",
  vecchia: "vecchia",
};

/** Mostra le proposte e le ricorda (una riga per numero, sovrascritta). Senza
 *  nessun orario: «non ho orari liberi» e la scheda va in «Da ricontattare». */
async function mostra(
  c: Ctx,
  tipo: Tipo,
  p: Proposta,
  fasciaChiesta: Fascia,
  pagina: 1 | 2 | 3,
  mostratiPrima: OraProposta[],
): Promise<RispostaPrenota> {
  if (p.proposte.length === 0) {
    return daRicontattare(
      c,
      "prenota_nessun_orario",
      testoNessunOrario({ nome: nomeDi(c) }),
      "nessun_orario",
    );
  }
  await c.porte.scriviProposta(c.chiave, {
    v: 1,
    il: c.adesso.toISOString(),
    fascia: p.fasciaEffettiva,
    fasciaChiesta,
    pagina,
    proposte: p.proposte,
    mostrati: [...mostratiPrima, ...p.proposte],
  });
  const testo = TESTI[tipo]({
    nome: nomeDi(c),
    proposte: p.proposte,
    fasciaChiesta: tipo === "altri" ? p.fasciaEffettiva : fasciaChiesta,
    ripiego: tipo === "altri" ? false : p.ripiego,
  });
  return conProposte(testo, p.proposte.length, CODICI[tipo]);
}

/** «Preso» / «non più validi»: tre proposte nuove della stessa fascia, pagina 1.
 *  `rifiutato` = l'orario appena perso: non si riconsiglia (l'agenda letta prima
 *  può non vedere ancora chi lo sta prendendo) e va fra i «mostrati», così nemmeno
 *  «ALTRI» lo rimette. */
async function nuoveProposte(
  c: Ctx,
  tipo: "preso" | "vecchia",
  agenda?: Agenda,
  rifiutato?: OraProposta,
): Promise<RispostaPrenota> {
  const a = agenda ?? (await leggiAgenda(c));
  const fascia = c.riga?.fasciaChiesta ?? "sera";
  const esclusi = rifiutato ? [rifiutato] : [];
  return mostra(c, tipo, proposteDa(c, a, fascia, esclusi), fascia, 1, esclusi);
}

/** La proposta ricordata è ancora buona? (c'è, non è oltre le 6 ore) */
function propostaAperta(c: Ctx): RigaProposta | null {
  const r = c.riga;
  if (!r || r.proposte.length === 0) return null;
  const eta = c.adesso.getTime() - Date.parse(r.il);
  return eta <= VALIDITA_PROPOSTA_MS ? r : null;
}

async function altri(c: Ctx): Promise<RispostaPrenota> {
  const riga = propostaAperta(c);
  if (!riga) return nessuno("non_capito");
  const pagina = riga.pagina + 1;
  const agenda = await leggiAgenda(c);
  const p = pagina <= 3 ? proposteDa(c, agenda, riga.fascia, riga.mostrati) : null;
  if (!p || p.finiti) {
    //  Finiti: la proposta non è più aperta, un altro ALTRI non rifà niente.
    await c.porte.scriviProposta(c.chiave, { ...riga, proposte: [] });
    return daRicontattare(
      c,
      "prenota_altri_finiti",
      testoAltriFiniti({ nome: nomeDi(c) }),
      "altri_finiti",
    );
  }
  return mostra(c, "altri", p, riga.fasciaChiesta, pagina as 2 | 3, riga.mostrati);
}

// ── Chi ha già un appuntamento ────────────────────────────────────────────

/** Il lead ha già una consulenza (D14): riepilogo e basta. Al tocco, se è quella
 *  fissata dalla chat e ha il suo link, si ripete la conferma (con lo stesso
 *  link). ⚠️ Il nome del consulente è quello della scheda ADESSO. Mai una
 *  scrittura. */
async function giaFissata(c: Base, schede: Lead[], intento: Intento): Promise<RispostaPrenota> {
  //  La più vicina.
  const quando = (s: Lead) =>
    minutiAlla(String(s.data.dataMeeting), String(s.data.oraMeeting).padStart(5, "0"), c.adesso);
  const lei = [...schede].sort((a, b) => quando(a) - quando(b))[0].data;
  if (intento.tipo !== "fascia" && !(intento.tipo === "scelta" && intento.tocco))
    return nessuno("gia_fissato");
  const consulenti = await c.porte.consulenti(c.userId);
  const consulente = consulenti.find((x) => x.id === lei.consulenteId)?.data.nome;
  const dati = {
    nome: lei.nome,
    giorno: String(lei.dataMeeting),
    ora: String(lei.oraMeeting),
    consulente,
  };
  //  ⚠️ Una «conferma» senza link non si dà mai (D13): senza link è un riepilogo.
  const link = String(lei.linkMeeting ?? "").trim();
  if (intento.tipo === "scelta" && presaDallaChat(lei) && link)
    return conTesto(testoConferma({ ...dati, link }), "gia_fissato");
  return conTesto(testoGiaFissato(dati), "gia_fissato");
}

// ── I lucchetti ───────────────────────────────────────────────────────────

/** Prende un lucchetto. Se la porta lancia dopo aver scritto (risposta persa),
 *  lo rilascia: rimetterlo a posto è innocuo, solo il `di` giusto lo toglie. */
async function prendiLucchetto(porte: PortePrenota, chiave: string, di: string): Promise<boolean> {
  try {
    return await porte.lucchetto.prendi(chiave, di, LUCCHETTO_MS);
  } catch (e) {
    await rilascia(porte, chiave, di);
    throw e;
  }
}

/** Rilascia, con un secondo tentativo. Un lucchetto che resta scade da solo
 *  dopo 20 secondi: non si fa fallire una risposta per questo. */
async function rilascia(porte: PortePrenota, chiave: string, di: string): Promise<void> {
  for (let t = 0; t < 2; t++) {
    try {
      await porte.lucchetto.lascia(chiave, di);
      return;
    } catch {
      /* si riprova una volta */
    }
  }
  porte.avviso("errore");
}

// ── La prenotazione ───────────────────────────────────────────────────────

/** Il lead ha scelto un orario: lucchetto del lead, poi il resto. */
async function prenota(c: Ctx, scelto: OraProposta): Promise<RispostaPrenota> {
  const chiave = chiaveLucchettoLead(c.lead.id);
  const di = globalThis.crypto.randomUUID();
  //  Lucchetto del lead occupato: un altro giro dello stesso lead sta già
  //  lavorando (il flusso ManyChat ha messo «attesa»). Silenzio.
  if (!(await prendiLucchetto(c.porte, chiave, di))) return nessuno("occupato");
  try {
    return await dentroIlLead(c, scelto);
  } finally {
    await rilascia(c.porte, chiave, di);
  }
}

async function dentroIlLead(c: Ctx, scelto: OraProposta): Promise<RispostaPrenota> {
  //  Dentro il lucchetto si rilegge la scheda: forse il primo tocco ha già
  //  prenotato.
  const fresca = await c.porte.scheda(c.userId, c.lead.id);
  if (!fresca) return nessuno("senza_scheda");
  if (appuntamentoFuturo(fresca.data, c.adesso))
    return giaFissata(c, [fresca], { tipo: "scelta", n: 0, tocco: true });
  if (!puoPrenotare(fresca.data, c.adesso).ok) return nessuno("non_prenotabile");

  let agenda = await leggiAgenda(c);
  const scartati = new Set<string>();
  for (;;) {
    //  D6, sui dati freschi: Filippo, poi il primo libero. Quelli scartati dentro
    //  il lucchetto (pieni nel frattempo) non si riprovano.
    const consulente = scegliConsulente({
      ...datiAgenda(c, agenda),
      consulenti: agenda.consulenti.filter((x) => !scartati.has(x.id)),
      giorno: scelto.g,
      ora: scelto.o,
      preferito: c.cfg.consulenteId,
      escludiLeadId: c.lead.id,
    });
    if (!consulente) return nuoveProposte(c, "preso", agenda, scelto);

    const chiave = chiaveLucchettoConsulente(consulente.id, scelto.g);
    const di = globalThis.crypto.randomUUID();
    let preso = false;
    for (let t = 0; t < TENTATIVI_LUCCHETTO && !preso; t++) {
      if (t > 0) await c.porte.attesa(PAUSA_LUCCHETTO_MS);
      preso = await prendiLucchetto(c.porte, chiave, di);
    }
    //  Un altro lead sta prenotando quel consulente in quel giorno (forse un'altra
    //  ora): si prova il collega successivo, come per lo slot pieno.
    if (!preso) {
      scartati.add(consulente.id);
      continue;
    }
    try {
      //  Dentro il lucchetto: letture fresche e di nuovo la stessa domanda.
      agenda = await leggiAgenda(c);
      const ancora = ancoraLibero({
        ...datiAgenda(c, agenda),
        consulente: agenda.consulenti.find((x) => x.id === consulente.id) ?? consulente,
        giorno: scelto.g,
        ora: scelto.o,
        escludiLeadId: c.lead.id,
      });
      if (!ancora) {
        scartati.add(consulente.id);
        continue;
      }
      return await scrivi(c, consulente, scelto, fresca);
    } finally {
      await rilascia(c.porte, chiave, di);
    }
  }
}

/** Quello che la scrittura ha già fatto, per rimetterlo a posto. */
interface Fatto {
  stanza: EsitoStanza | null;
  /** la scheda come l'ho scritta e com'era prima (null = nessuna scrittura in corso) */
  scheda: { prima: LeadData; scritto: LeadData } | null;
}

/** Stanza → scheda → verifica. Qualunque errore (o tempo scaduto) disfa tutto
 *  quello che si è scritto e rilancia. */
async function scrivi(
  c: Ctx,
  consulente: Consultant,
  scelto: OraProposta,
  freschissima: Lead,
): Promise<RispostaPrenota> {
  controllaTempo(c, BUDGET_CALCOLO_MS);
  const fatto: Fatto = { stanza: null, scheda: null };
  let fresca = freschissima;
  try {
    fatto.stanza = await assicuraStanza(c.porte.stanza, {
      leadId: c.lead.id,
      nome: fresca.data.nome,
      cognome: fresca.data.cognome,
      consulenteId: consulente.id,
      giorno: scelto.g,
      ora: scelto.o,
      durata: c.cfg.durataMin,
      adesso: c.adesso,
    });
    const link = fatto.stanza.link;
    //  ⚠️ Mai una prenotazione senza link (D13): la conferma lo promette.
    if (!link) throw { code: "senza_link" };

    //  Scrittura condizionata: se la setter cambia la scheda mentre scriviamo,
    //  si rilegge e si riprova.
    for (let t = 0; ; t++) {
      controllaTempo(c, BUDGET_SCRITTURA_MS);
      const scritto = daPrenotare(fresca.data, {
        consulenteId: consulente.id,
        giorno: scelto.g,
        ora: scelto.o,
        durata: c.cfg.durataMin,
        link,
        adesso: c.adesso,
        nomeConsulente: String(consulente.data.nome ?? ""),
      });
      //  Si ricorda PRIMA di scrivere: una risposta persa dopo l'UPDATE lascia la
      //  scheda scritta, e va disfatta.
      fatto.scheda = { prima: fresca.data, scritto };
      const esito = await c.porte.scriviScheda(c.userId, c.lead.id, fresca.updated_at, scritto);
      if (esito === "ok") break;
      fatto.scheda = null;
      if (t + 1 >= RIPROVE_SCHEDA) throw { code: "cambiata" };
      const rifatta = await c.porte.scheda(c.userId, c.lead.id);
      if (!rifatta) throw { code: "senza_scheda" };
      fresca = rifatta;
      if (appuntamentoFuturo(fresca.data, c.adesso)) {
        await fatto.stanza.annulla();
        return giaFissata(c, [fresca], { tipo: "scelta", n: 0, tocco: true });
      }
      if (!puoPrenotare(fresca.data, c.adesso).ok) {
        await fatto.stanza.annulla();
        return nessuno("non_prenotabile");
      }
    }

    //  La verifica: la setter dal browser non prende i lucchetti. Si rilegge
    //  l'agenda (la nostra scheda esclusa) e, se lo slot non è più libero, si
    //  disfa. ⚠️ La verifica si fa sempre, anche se il tempo è scaduto: è ciò
    //  che evita due persone alla stessa ora.
    const agenda = await leggiAgenda(c);
    const libero = ancoraLibero({
      ...datiAgenda(c, agenda),
      consulente: agenda.consulenti.find((x) => x.id === consulente.id) ?? consulente,
      giorno: scelto.g,
      ora: scelto.o,
      escludiLeadId: c.lead.id,
    });
    if (!libero) {
      await disfa(c, fatto);
      return nuoveProposte(c, "preso", agenda, scelto);
    }
    return conTesto(
      testoConferma({
        nome: fresca.data.nome,
        giorno: scelto.g,
        ora: scelto.o,
        consulente: consulente.data.nome,
        link,
      }),
      "prenotato",
    );
  } catch (e) {
    //  Quello che si può disfare si disfa; se non ci si riesce (database
    //  guasto) resta la prenotazione intera, mai a metà.
    try {
      await disfa(c, fatto);
    } catch {
      c.porte.avviso("errore");
    }
    throw e;
  }
}

/** Rimette la scheda com'era e toglie la stanza. Idempotente. Se la scheda
 *  attuale non combacia più con quella scritta (una persona l'ha cambiata) NON
 *  si tocca e si lancia: errore e «Da ricontattare». */
async function disfa(c: Ctx, fatto: Fatto): Promise<void> {
  const w = fatto.scheda;
  if (w) {
    for (let t = 0; t < RIPROVE_SCHEDA; t++) {
      const attuale = await c.porte.scheda(c.userId, c.lead.id);
      if (!attuale) break;
      //  Ancora com'era prima: la scrittura non è arrivata, o è già disfatta.
      if (daDisfare(attuale.data, w.prima, w.prima) !== null) break;
      const indietro = daDisfare(attuale.data, w.scritto, w.prima);
      if (indietro === null) throw { code: "cambiata" };
      if ((await c.porte.scriviScheda(c.userId, c.lead.id, attuale.updated_at, indietro)) === "ok")
        break;
      if (t + 1 >= RIPROVE_SCHEDA) throw { code: "cambiata" };
    }
    fatto.scheda = null;
  }
  if (fatto.stanza) await fatto.stanza.annulla();
}

// ── Il percorso ───────────────────────────────────────────────────────────

/** Dopo l'identificazione del lead: cosa fare di quello che ha chiesto. */
async function agisci(c: Ctx, intento: Intento): Promise<RispostaPrenota> {
  if (intento.tipo === "fascia") {
    const agenda = await leggiAgenda(c);
    return mostra(c, "prime", proposteDa(c, agenda, intento.fascia, []), intento.fascia, 1, []);
  }
  if (intento.tipo === "altri") return altri(c);

  //  Scelta (tocco o numero scritto).
  const riga = propostaAperta(c);
  //  Un numero scritto a mano conta solo con una proposta aperta; un tocco no:
  //  senza proposta valida si rimandano gli orari aggiornati.
  if (!riga && !intento.tocco) return nessuno("non_capito");
  const scelto = riga?.proposte[intento.n - 1];
  if (riga && !scelto) {
    return conProposte(
      testoOpzioneNonCe({ nome: nomeDi(c), proposte: riga.proposte }),
      riga.proposte.length,
      "proposte",
    );
  }
  //  Orario ormai troppo vicino: la proposta non è più valida (non «preso»).
  if (!riga || !scelto || minutiAlla(scelto.g, scelto.o, c.adesso) < c.cfg.preavvisoOre * 60)
    return nuoveProposte(c, "vecchia");
  return prenota(c, scelto);
}

async function tratta(
  porte: PortePrenota,
  r: RichiestaPrenota,
  corpo: CorpoPrenota,
): Promise<RispostaPrenota> {
  const inizio = porte.adesso().getTime();

  //  2. Spenta: niente, e niente oltre la configurazione.
  const cfg = await porte.config();
  if (!cfg) return nessuno("spenta");

  //  3. Si CAPISCE prima di leggere. «Grazie», «ok», una domanda: silenzio, a
  //     costo zero (rev. 9). Se c'è davvero una proposta aperta si verifica dopo.
  let intento: Intento;
  if (corpo.azione === "scelta") {
    if (corpo.scelta < 1 || corpo.scelta > 3) return nessuno("non_capito");
    intento = { tipo: "scelta", n: corpo.scelta, tocco: true };
  } else {
    const capito = capisciRisposta(corpo.testo, { propostaAperta: true });
    if (capito.tipo === "niente") return nessuno("non_capito");
    intento =
      capito.tipo === "fascia"
        ? { tipo: "fascia", fascia: capito.fascia }
        : capito.tipo === "scelta"
          ? { tipo: "scelta", n: capito.n, tocco: false }
          : { tipo: "altri" };
  }

  //  4. L'installazione e il numero.
  const u = await porte.utente();
  if (u.userId === null) {
    porte.avviso("senza_configurazione");
    return nessuno("senza_configurazione");
  }
  const userId = u.userId;
  const tel = cifreTelefono(corpo.telefono);
  if (!tel) return nessuno("senza_scheda");

  //  5. Le schede con quel numero. ⚠️ Un lead prenota solo per sé: anche se la
  //     porta ha già controllato, il telefono deve combaciare qui.
  const trovate = await porte.schedeDelNumero(userId, tel, corpo.crmLeadId);
  const schede = trovate.filter((s) => cifreTelefono(s.data.telefono) === tel);
  if (schede.length === 0) return nessuno("senza_scheda");
  if (
    schede.some((s) => s.data.contattoWa?.stato === "stop") ||
    (await porte.nonScrivere(userId, tel))
  )
    return nessuno("stop");

  const adesso = r.adesso;
  //  D14: se QUALSIASI scheda con quel numero ha un appuntamento futuro, niente
  //  prenotazione e niente scritture.
  const conAppuntamento = schede.filter((s) => appuntamentoFuturo(s.data, adesso));
  //  Quella da usare: la modificata più di recente fra le prenotabili.
  const lead = schede
    .filter((s) => puoPrenotare(s.data, adesso).ok)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
  if (conAppuntamento.length === 0 && !lead) return nessuno("non_prenotabile");
  const base: Base = { porte, userId, cfg, adesso, inizio, lead: lead ?? conAppuntamento[0] };
  if (conAppuntamento.length > 0) return giaFissata(base, conAppuntamento, intento);

  try {
    //  6. Il limite: 30 chiamate l'ora per numero, contate solo qui (i messaggi
    //     non capiti non arrivano fin qui). Il contatore è una riga SUA, separata
    //     dalla proposta: scriverlo non può rimettere una proposta vecchia sopra
    //     una nuova. shortcut: lettura e scrittura del contatore non sono
    //     atomiche; due richieste insieme possono contarsi una sola volta.
    //     Basta per fermare i giri a vuoto; da cambiare se serve un limite esatto.
    const chiave = prefissoProposta + (await improntaNumero(tel, r.segreto));
    const chiaveContatore = `${chiave}:n`;
    const contatore = await porte.contatore(chiaveContatore);
    const ora = aRoma(adesso);
    const oraChiave = `${ora.giorno}T${due(Math.floor(ora.minuti / 60))}`;
    const n = contatore?.ora === oraChiave ? contatore.n : 0;
    if (n >= MAX_CHIAMATE_ORA) return nessuno("limite");
    await porte.scriviContatore(chiaveContatore, { ora: oraChiave, n: n + 1 });
    return await agisci({ ...base, chiave, riga: await porte.proposta(chiave) }, intento);
  } catch (e) {
    //  7. Un errore dopo un tocco: messaggio gentile e «Da ricontattare» perché
    //     la setter lo veda. Dopo un testo semplice: silenzio (mai a metà).
    const codice = codiceDi(e);
    porte.avviso(codice);
    if (intento.tipo !== "scelta" || !intento.tocco) return nessuno(codice);
    try {
      await segnaRicontatto(base, "prenota_errore");
    } catch {
      porte.avviso("errore");
    }
    return conTesto(testoErrore({ nome: lead?.data.nome }), codice);
  }
}

export async function gestisciPrenota(
  porte: PortePrenota,
  r: RichiestaPrenota,
): Promise<{ stato: StatoPrenota; risposta: RispostaPrenota }> {
  if (!r.segretoPresente) return { stato: 503, risposta: nessuno("segreto_assente") };
  if (!r.chiaveOk) return { stato: 401, risposta: nessuno("non_autorizzato") };
  if (r.troppoGrande) return { stato: 413, risposta: nessuno("troppo_grande") };
  if (!r.corpo) return { stato: 200, risposta: nessuno("illeggibile") };
  try {
    return { stato: 200, risposta: await tratta(porte, r, r.corpo) };
  } catch (e) {
    //  Prima di sapere chi è il lead: silenzio.
    const codice = codiceDi(e);
    porte.avviso(codice);
    return { stato: 200, risposta: nessuno(codice) };
  }
}

/** Dalla richiesta HTTP alla risposta HTTP. Il corpo si legge SOLO dopo la
 *  chiave giusta: chi non ce l'ha non fa leggere né elaborare niente. Una
 *  richiesta autorizzata ha sempre 200 con `{ ok, esito, testo }`. */
export async function gestisciRichiestaPrenota(
  porte: PortePrenota,
  i: { request: Request; segreto: string | undefined; adesso: Date },
): Promise<{ response: Response; esito?: string }> {
  const segretoPresente = !!i.segreto;
  const chiaveOk = segretoPresente && stessaChiave(i.request.headers.get("x-hgl-token"), i.segreto);
  let corpo: CorpoPrenota | null = null;
  let troppoGrande = false;
  if (chiaveOk) {
    const letto = await leggiCorpoLimitato(i.request.body);
    troppoGrande = letto.troppoGrande;
    if (!troppoGrande) {
      try {
        corpo = leggiCorpoPrenota(JSON.parse(letto.testo));
      } catch {
        corpo = null;
      }
    }
  }
  const { stato, risposta } = await gestisciPrenota(porte, {
    chiaveOk,
    segretoPresente,
    segreto: i.segreto ?? "",
    corpo,
    troppoGrande,
    adesso: i.adesso,
  });
  const json =
    stato === 200
      ? { ok: true, esito: risposta.esito, testo: risposta.testo }
      : {
          ok: false,
          errore: { 401: "non_autorizzato", 413: "troppo_grande", 503: "non_configurato" }[stato],
        };
  return {
    response: new Response(JSON.stringify(json), {
      status: stato,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
    esito: risposta.codice,
  };
}
