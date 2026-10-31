/** ── LA VISTA DEL PANNELLO «MESSAGGI AUTOMATICI» ────────────────────────────
 *
 *  Commessa 2026-10-31-interruttori-automatici, compito T7. Tutto quello che il
 *  pannello (`MessaggiAutomaticiPannello.tsx`) deve decidere senza disegnare:
 *   - i 25 messaggi divisi nei sei momenti, con nome, anteprima del testo, «quando
 *     parte» e lo stato dell'interruttore;
 *   - la frase di conferma prima di accendere (per famiglia: vedi sotto);
 *   - le frasi degli errori (il 409 «è cambiato nel frattempo» compreso), la fascia
 *     in sola lettura sopra l'elenco, le righe di «Ultime modifiche».
 *  Puro: nessuna rete, nessun orologio (le ore di Roma le dà `quandoBreve`).
 *
 *  ⚠️ LA FAMIGLIA «LEAD NUOVO» (nota N1 del revisore). I quattro messaggi dei lead
 *   nuovi dividono UNA data di partenza: quella dell'accensione più recente fra i
 *   quattro accesi. Accendere uno con altri già accesi sposta la data a adesso per
 *   tutti: chi è già in sequenza non riceve più il richiamo. ⚠️ NON è vero che «chi è
 *   entrato prima non riceve il primo contatto»: i lead «da contattare» (anche arrivati
 *   mentre era spento, anche i vecchi) e i ritorni senza risposta partono comunque come
 *   arretrati (`decidiImportatiERitorni` non guarda la data), a scaglioni entro i tetti
 *   (150 al giorno). Decisione del titolare del 31/10: «anche gli arretrati». La finestra lo dice.
 *  ⚠️ Spegnere è immediato (un clic sbagliato per spegnere non fa danni); accendere
 *   si conferma sempre.
 *  ───────────────────────────────────────────────────────────────────────── */

import { quandoBreve } from "../manychat/vista-pannello";
import { findMetaTemplate } from "../wa-meta-templates";
import {
  CATALOGO,
  FAMIGLIA_LEAD_NUOVO,
  GRUPPI,
  type ChiaveMessaggio,
  type GruppoMessaggio,
  type VoceCatalogo,
} from "./catalogo";
import type { FasciaMessaggi, ModificaRegistro, RispostaMessaggi, VoceMessaggio } from "./tipi";

// ── l'anteprima del testo ────────────────────────────────────────────────

/** Come si leggono i segnaposto dei modelli Meta, scritti per chi guarda: «[nome]». */
const SEGNAPOSTO: Record<string, string> = {
  lead_name: "[nome]",
  consultant_name: "[consulente]",
  appointment_date: "[data]",
  appointment_time: "[ora]",
  appointment_day: "[giorno]",
  visit_date: "[data]",
  visit_time: "[ora]",
  recontact_date: "[data]",
  recontact_time: "[ora]",
  meet_link: "[link]",
  address: "[indirizzo]",
};

/** Il titolo sopra le due anteprime delle voci che hanno una variante (modello, poi variante). */
const TITOLI_VARIANTE: Partial<Record<ChiaveMessaggio, [string, string]>> = {
  primo_contatto: [
    "Con due fasce (mattina o sera)",
    "Con tre fasce (se il suo flusso è collegato)",
  ],
  meet_domani: [
    "Gratis, come testo (finestra di 24 ore aperta)",
    "A pagamento, come modello (fissata da oltre 3 giorni)",
  ],
  meet_oggi: ["Senza link", "Con il link per entrare"],
};

export interface Anteprima {
  /** `null` = c'è un solo testo */
  titolo: string | null;
  testo: string;
}

/** Il testo di un modello Meta con i segnaposto leggibili; `null` se il modello non c'è. */
function testoDelModello(nome: string): string | null {
  const t = findMetaTemplate(nome);
  if (!t) return null;
  let corpo = t.body;
  for (const p of t.params) {
    corpo = corpo.split(`{{${p.index}}}`).join(SEGNAPOSTO[p.key] ?? "[…]");
  }
  //  Un segnaposto che non sapevamo leggere non deve arrivare grezzo sullo schermo.
  return corpo.replace(/\{\{\s*[^}]*\}\}/g, "[…]").trim();
}

function anteprimeDi(v: VoceCatalogo): Anteprima[] {
  if (v.testoFisso) return [{ titolo: null, testo: v.testoFisso }];
  const titoli = TITOLI_VARIANTE[v.chiave];
  const fuori: Anteprima[] = [];
  const nomi = [v.modello, v.variante];
  nomi.forEach((nome, i) => {
    if (!nome) return;
    const testo = testoDelModello(nome);
    if (testo) fuori.push({ titolo: titoli?.[i] ?? null, testo });
  });
  //  Un modello che il progetto non conosce: si dice, non si lascia il buco.
  return fuori.length > 0 ? fuori : [{ titolo: null, testo: "Testo non disponibile." }];
}

// ── le righe e i momenti ─────────────────────────────────────────────────

export type StatoRiga = "acceso" | "spento" | "bloccato" | "non_attivabile";

export interface RigaVista {
  chiave: ChiaveMessaggio;
  nome: string;
  quando: string;
  anteprime: Anteprima[];
  /** per i messaggi per stato: il consulente può sostituire il testo del modello */
  notaTesto: string | null;
  acceso: boolean;
  stato: StatoRiga;
  /** l'interruttore si può muovere (accendere se libero, spegnere se acceso) */
  modificabile: boolean;
  /** perché NON si accende (spento nel codice, impedimento, database); `null` = si può */
  motivo: string | null;
  /** «Spento da Filippo, 31/10 14:02»; `null` = il log non ha niente */
  ultima: string | null;
}

export interface GruppoVista {
  id: GruppoMessaggio;
  titolo: string;
  righe: RigaVista[];
  accesi: number;
}

const FRASE_CODICE = "Spento nel codice: da qui non si accende.";
const FRASE_DATABASE =
  "Manca l'aggiornamento del database: finché non c'è, nessun messaggio si accende.";
const NOTA_STATO =
  "Il consulente può scrivere il suo testo al posto di questo, per ogni cliente, dalla scheda.";

function frasePerChi(u: VoceMessaggio["ultima"]): string | null {
  if (!u) return null;
  const quando = quandoBreve(u.il);
  return `${u.dopo ? "Acceso" : "Spento"} da ${u.da}${quando ? `, ${quando}` : ""}`;
}

function rigaDi(v: VoceCatalogo, letta: VoceMessaggio | undefined, mancaDb: boolean): RigaVista {
  //  Una voce che la rotta non manda si legge come spenta e ferma: non si tocca ciò che non si vede.
  const acceso = !!letta?.acceso && !v.bloccataDalCodice;
  let motivo: string | null = null;
  let stato: StatoRiga = acceso ? "acceso" : "spento";
  let modificabile = true;
  if (v.bloccataDalCodice) {
    stato = "bloccato";
    modificabile = false;
    motivo = FRASE_CODICE;
  } else if (!letta) {
    modificabile = false;
    motivo = "Non riesco a leggere lo stato di questo messaggio: ricarica la pagina.";
  } else if (mancaDb) {
    modificabile = false;
    motivo = FRASE_DATABASE;
    if (!acceso) stato = "non_attivabile";
  } else if (letta.impedimento && !acceso) {
    modificabile = false;
    motivo = letta.impedimento;
    stato = "non_attivabile";
  }
  return {
    chiave: v.chiave,
    nome: v.nome,
    quando: v.quando,
    anteprime: anteprimeDi(v),
    notaTesto: v.chiave.startsWith("stato:") ? NOTA_STATO : null,
    acceso,
    stato,
    modificabile,
    motivo,
    ultima: frasePerChi(letta?.ultima ?? null),
  };
}

/** I 25 messaggi nei sei momenti, nell'ordine del catalogo. */
export function raggruppa(r: RispostaMessaggi): GruppoVista[] {
  const lette = new Map(r.voci.map((v) => [v.chiave, v]));
  return GRUPPI.map((g) => {
    const righe = CATALOGO.filter((v) => v.gruppo === g.id).map((v) =>
      rigaDi(v, lette.get(v.chiave), !!r.mancaMigrazione),
    );
    return { id: g.id, titolo: g.titolo, righe, accesi: righe.filter((x) => x.acceso).length };
  });
}

// ── la conferma prima di accendere ───────────────────────────────────────

export interface ConfermaAccensione {
  titolo: string;
  etichetta: string;
  paragrafi: string[];
  /** frasi da mostrare come avviso (ambra) sotto il testo */
  avvisi: string[];
}

const nomeDi = (k: string) => CATALOGO.find((v) => v.chiave === k)?.nome ?? "un messaggio";
const eDellaFamiglia = (k: ChiaveMessaggio) =>
  (FAMIGLIA_LEAD_NUOVO as readonly string[]).includes(k);

/** Cosa succede, in una frase, a chi è «in attesa» quando il messaggio si accende. */
function effetto(k: ChiaveMessaggio): string {
  if (k === "ricontatto_fissato")
    return "Nel giorno fissato, ai lead dei consulenti con «Ok a WhatsApp» parte un ricontatto: uno ogni 27-33 minuti, dalle 9 alle 20, da lunedì a sabato. Le date già passate non partono mai.";
  if (k === "promemoria_meet")
    return "Chi ha un meet oggi, con «Ok a WhatsApp» sulla scheda, riceve il promemoria 20 minuti prima: può partire subito per i meet di oggi.";
  if (k === "meet_oggi" || k === "meet_domani")
    return "Può partire subito per chi ha un meet in programma. Non è frenato da «mai due messaggi senza risposta», perché riguarda un appuntamento già preso; conta nei tetti e si ferma con STOP.";
  if (k === "conferma_consulenza")
    return "Chi ha già un appuntamento in agenda non riceve niente: conta solo chi prenota da adesso.";
  if (k === "dati_fattura")
    return "Chi ha già un acconto non riceve niente: vale solo per i nuovi acconti.";
  if (k === "prenota_chat") return "I lead possono prenotare in chat da subito.";
  if (k === "webinar_in_diretta")
    return "Parte alla prossima diretta, nell'istante in cui il conduttore va in onda. Una diretta già iniziata non si recupera.";
  if (k.startsWith("stato:"))
    return "Vale per le schede che entrano in questo stato da adesso: le schede già in questo stato non ricevono niente. Il messaggio ha il suo posto nei tetti e nel ritmo dei ricontatti, e si ferma con STOP.";
  return "Può partire subito per chi è in attesa.";
}

const REGOLE_LEAD_NUOVO =
  "Il primo messaggio dei moduli parte solo se compilati dopo la data della frase del consenso (i lead già importati «da contattare» partono comunque, scelta del titolare del 28/10), dalle 9 alle 20, da lunedì a sabato. Il richiamo è un secondo messaggio a chi non ha risposto: per questo caso la regola «mai due messaggi senza risposta» non vale. Chi ricompila il modulo con un numero già in archivio non riceve il primo messaggio.";

/** Che cosa parte, davvero, quando si accende UNO dei quattro messaggi dei lead nuovi (letto da `sequenze.ts`):
 *  primo contatto e ritorno recuperano gli arretrati (nessuna data li ferma: `decidiImportatiERitorni`);
 *  il richiamo guarda la data di partenza; i casi reali guardano il primo contatto già arrivato. */
const COSA_PARTE: Readonly<Record<string, string>> = {
  primo_contatto:
    "Riaccendendolo partono anche i lead arrivati mentre era spento: tutti quelli ancora «da contattare» a cui nessuno ha scritto, anche i più vecchi. Partono a scaglioni, al massimo 150 al giorno, dalle 9 alle 20, da lunedì a sabato.",
  ritorno:
    "Riaccendendolo partono anche i contatti tornati mentre era spento e a cui nessuno ha scritto dopo il ritorno. Partono a scaglioni, al massimo 150 al giorno, dalle 9 alle 20, da lunedì a sabato.",
  richiamo_24h:
    "Il richiamo parte solo per chi riceve il primo contatto da adesso in poi: chi l'ha già ricevuto prima non riceve il richiamo.",
  casi_reali:
    "Parte una volta sola a chi ha già ricevuto il primo contatto, non ha risposto e aspetta ancora la risposta.",
};
const FRASE_RICHIAMO_PERSO =
  "Con la nuova data, chi è già in sequenza non riceverà più il richiamo.";

/** La finestra che si apre prima di accendere. `accesi` = i messaggi già accesi (serve alla famiglia «lead nuovo»). */
export function confermaAccensione(
  chiave: ChiaveMessaggio,
  accesi: readonly ChiaveMessaggio[],
): ConfermaAccensione {
  const nome = nomeDi(chiave);
  const base = { titolo: `Accendere «${nome}»?`, etichetta: "Accendi" };
  if (eDellaFamiglia(chiave)) {
    const altri = FAMIGLIA_LEAD_NUOVO.filter((k) => k !== chiave && accesi.includes(k));
    //  Le regole del primo messaggio e del richiamo (dal vecchio riquadro «Lead nuovo»).
    const regole =
      chiave === "primo_contatto" || chiave === "richiamo_24h" ? [REGOLE_LEAD_NUOVO] : [];
    const cosa = COSA_PARTE[chiave];
    if (altri.length === 0)
      return {
        ...base,
        paragrafi: [
          `I quattro messaggi dei lead nuovi (${FAMIGLIA_LEAD_NUOVO.map(nomeDi).join(", ")}) condividono la data di partenza. Accendendo questo, la data è adesso.`,
          cosa,
          ...regole,
        ],
        avvisi: [],
      };
    //  La data spostata a adesso toglie il richiamo a chi è già in sequenza (solo se il richiamo resta acceso).
    const richiamoAcceso = chiave === "richiamo_24h" || altri.includes("richiamo_24h");
    return {
      ...base,
      paragrafi: [
        "I quattro messaggi dei lead nuovi condividono una sola data di partenza. Accendendo questo, la data di partenza di tutti e quattro diventa adesso.",
        cosa,
        ...(richiamoAcceso && chiave !== "richiamo_24h" ? [FRASE_RICHIAMO_PERSO] : []),
        ...regole,
      ],
      avvisi: [
        `Oggi sono già accesi: ${altri.map(nomeDi).join(", ")}. Per loro la data si sposta adesso.`,
      ],
    };
  }
  return { ...base, paragrafi: [effetto(chiave)], avvisi: [] };
}

// ── gli errori ───────────────────────────────────────────────────────────

/** Il 409 della rotta: la riga è cambiata mentre guardavi (o è spenta dal codice). */
export const eConflitto = (stato: number) => stato === 409;

/** Una frase per chi guarda. Il testo del server non si mostra mai com'è: può contenere dati. */
export function fraseErrore(stato: number, errore?: string): string {
  if (stato === 409)
    return /codice/i.test(errore ?? "")
      ? FRASE_CODICE
      : "È cambiato nel frattempo: ricarico l'elenco. Controlla com'è adesso e riprova.";
  if (stato === 403) return "Solo chi può cambiare le impostazioni accende o spegne i messaggi.";
  if (stato === 400) return "Non salvato: la richiesta non è valida. Ricarica la pagina.";
  if (stato === 0) return "Non salvato: il server non risponde.";
  return "Non salvato.";
}

// ── la fascia in sola lettura e le ultime modifiche ──────────────────────

export type TonoFascia = "verde" | "ambra" | "rosso" | "neutro";

/** Lo stato del sistema sopra l'elenco. Non comanda niente: dice perché un messaggio acceso potrebbe non partire. */
export function fraseFascia(
  f: FasciaMessaggi,
  mancaMigrazione: boolean,
): { tono: TonoFascia; frase: string } {
  if (mancaMigrazione)
    return {
      tono: "rosso",
      frase:
        "Manca l'aggiornamento del database: finché non c'è, nessun messaggio parte e gli interruttori restano fermi.",
    };
  if (f.fermatoMotivo)
    return {
      tono: "rosso",
      frase: `Il sistema ha fermato da solo i messaggi a sequenza: ${f.fermatoMotivo}.`,
    };
  if (!f.generale)
    return {
      tono: "ambra",
      frase:
        "L'interruttore generale «WhatsApp con ManyChat» è spento: i messaggi a sequenza (ricontatti, lead nuovi, promemoria, messaggi per stato) non partono, anche se qui sono accesi.",
    };
  if (f.canale === "cloud")
    return {
      tono: "neutro",
      frase:
        "Canale: Cloud API di Meta. In questo canale il giro dei messaggi a sequenza non scrive a nessuno.",
    };
  return {
    tono: "verde",
    frase: "WhatsApp con ManyChat è acceso: i messaggi accesi qui sotto partono.",
  };
}

/** «31/10 14:02 · Filippo ha spento «Sollecito dopo 24 ore»». */
export function fraseModifica(m: ModificaRegistro): string {
  const quando = quandoBreve(m.il);
  return `${quando ? `${quando} · ` : ""}${m.da} ha ${m.dopo ? "acceso" : "spento"} «${nomeDi(m.chiave)}»`;
}
