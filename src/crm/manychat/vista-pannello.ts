/** ── LE REGOLE DI VISTA DEI COMPONENTI MANYCHAT (puro) ─────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 5 (Dev D). Qui ci sono
 *  le frasi e le scelte dei componenti: tutto quello che si può provare senza
 *  disegnare. Il disegno è in PastigliaContatto, OkWhatsapp, RisposteOggi e
 *  ManychatPannello; le prove sono in `prove/manychat/pannello.mjs`.
 *
 *  Modulo PURO: niente rete, niente React, niente orologio (`adesso` arriva
 *  sempre da fuori). I tipi delle rotte stanno in client-crm.ts (solo `import
 *  type`, che non entra nel pacchetto delle prove).
 *
 *  ⚠️ IL COLORE NON BASTA MAI. Ogni tono ha accanto una parola (l'etichetta del
 *   secondo stato, «ok» / «problema» / «da verificare»).
 *  ⚠️ NIENTE NUMERI DI TELEFONO: né qui né nelle frasi. I nomi arrivano già
 *   abbreviati dal server.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ConsensoModulo, ContattoWa, LeadData, OkWhatsapp, StatoContattoWa } from "../types";
import type { Tono } from "../ui";
import type {
  CollegamentoManychat,
  ConfigManychat,
  GiroManychat,
  RigaCollegamento,
  StatoManychat,
} from "./client-crm";
import {
  DA_AUTOMATICO,
  ETICHETTE_CONTATTO,
  FRASE_STOP_RISERVATO,
  STATI_CONTATTO,
  TONI_CONTATTO,
  statoContattoEffettivo,
  type ToneContatto,
} from "./contatto";
import { TETTO_PRIMA_SETTIMANA, TETTO_RICONTATTI, TETTO_TOTALE } from "./quando";

/* ═══════════════════════════════════════════════════════════════════════════
   1. ORE E GIORNI (sempre ora di Roma, come nel resto del CRM)
   ═════════════════════════════════════════════════════════════════════════ */

const PEZZI = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pezziDi(iso: string | null | undefined) {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return null;
  const p = Object.fromEntries(PEZZI.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { g: p.day, m: p.month, h: p.hour, mi: p.minute };
}

/** «23/10 15:05»; vuoto se la data non si legge. */
export function quandoBreve(iso: string | null | undefined): string {
  const p = pezziDi(iso);
  return p ? `${p.g}/${p.m} ${p.h}:${p.mi}` : "";
}

/** «23/10». */
export function giornoBreve(iso: string | null | undefined): string {
  const p = pezziDi(iso);
  return p ? `${p.g}/${p.m}` : "";
}

/** «15:05». */
export function oraBreve(iso: string | null | undefined): string {
  const p = pezziDi(iso);
  return p ? `${p.h}:${p.mi}` : "";
}

const MIN = 60_000;
const ORA = 60 * MIN;
const GIORNO = 24 * ORA;

/* ═══════════════════════════════════════════════════════════════════════════
   2. ERRORI IN CHIARO (le chiamate del browser)
   ═════════════════════════════════════════════════════════════════════════ */

export const FRASE_RETE = "Il server non risponde: riprova fra poco.";

/** La frase da mostrare quando una rotta risponde male. Se il server ha già
 *  scritto un motivo (e non è un muro di testo) vale quello. */
export function fraseErrore(stato: number, dalServer?: string): string {
  const s = typeof dalServer === "string" ? dalServer.trim() : "";
  const server = s && s.length <= 200 ? s : "";
  if (stato === 0) return FRASE_RETE;
  if (stato === 401) return "Serve l'accesso al CRM: rientra e riprova.";
  if (stato === 403) return server || "Non hai il permesso per questa operazione.";
  if (stato === 404) return server || "Non trovato: ricarica la pagina.";
  if (stato === 409) return server || "La scheda è cambiata mentre salvavi: riprova.";
  if (stato === 429) return "Troppe richieste: aspetta un momento e riprova.";
  if (stato >= 500) return server || "Il server ha avuto un problema: riprova fra poco.";
  return server || "Non salvato.";
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA PASTIGLIA DEL SECONDO STATO
   ═════════════════════════════════════════════════════════════════════════ */

/** Il tono del secondo stato → il tono del CRM (stesse tinte delle altre
 *  pastiglie: nessuna tavolozza nuova da imparare). */
export const TONO_UI_CONTATTO: Record<ToneContatto, Tono> = {
  neutro: "neutro",
  info: "da_lavorare",
  ok: "vinta",
  attenzione: "in_sospeso",
  stop: "persa",
};

export const ETICHETTA_NON_SEGNATO = "Non segnato";

export interface VistaContatto {
  /** `null` = la scheda non ha un secondo stato */
  stato: StatoContattoWa | null;
  etichetta: string;
  tono: Tono;
  /** vero se «In attesa» è scaduta e si mostra «Non ha risposto» */
  scaduta: boolean;
}

/** Quello che la pastiglia mostra: lo stato EFFETTIVO (con la scadenza
 *  calcolata), mai quello grezzo. */
export function vistaContatto(
  d: Pick<Partial<LeadData>, "contattoWa"> | null | undefined,
  adesso: Date,
): VistaContatto {
  const stato = statoContattoEffettivo(d, adesso);
  if (!stato)
    return { stato: null, etichetta: ETICHETTA_NON_SEGNATO, tono: "neutro", scaduta: false };
  return {
    stato,
    etichetta: ETICHETTE_CONTATTO[stato],
    tono: TONO_UI_CONTATTO[TONI_CONTATTO[stato]],
    scaduta: stato !== d?.contattoWa?.stato,
  };
}

/** Che cosa significa ogni stato, in una riga (SPEC §4). */
export const NOTE_STATO_CONTATTO: Record<StatoContattoWa, string> = {
  contattato: "Gli abbiamo parlato o scritto",
  in_attesa: "Si aspetta una risposta",
  ha_risposto: "Ha scritto dopo il nostro messaggio",
  non_ha_risposto: "Il tempo per rispondere è scaduto",
  da_ricontattare: "Serve un'altra mossa di una persona",
  stop: "Non vuole messaggi",
  non_raggiungibile: "Numero non su WhatsApp o invio rifiutato",
};

export interface SceltaContatto {
  stato: StatoContattoWa;
  etichetta: string;
  nota: string;
  tono: Tono;
  /** è lo stato che si vede adesso */
  attuale: boolean;
  /** vero se si può premere */
  abilitata: boolean;
  /** perché non si può premere */
  perche?: string;
  /** vero se prima di salvare si chiede conferma (STOP: poi lo toglie solo il titolare) */
  chiedeConferma: boolean;
}

/** Le sette scelte della finestra. Se la scheda è in STOP e chi lavora non ha il
 *  permesso «impostazioni», tutte le altre sono chiuse (lo STOP lo toglie solo il
 *  titolare; la difesa vera è nella rotta). */
export function sceltePerContatto(
  d: Pick<Partial<LeadData>, "contattoWa"> | null | undefined,
  adesso: Date,
  puoTogliereStop: boolean,
): SceltaContatto[] {
  const attuale = statoContattoEffettivo(d, adesso);
  const inStop = attuale === "stop";
  return STATI_CONTATTO.map((stato) => {
    const chiusa = inStop && stato !== "stop" && !puoTogliereStop;
    return {
      stato,
      etichetta: ETICHETTE_CONTATTO[stato],
      nota:
        stato === "stop"
          ? `${NOTE_STATO_CONTATTO.stop} · lo toglie solo il titolare`
          : NOTE_STATO_CONTATTO[stato],
      tono: TONO_UI_CONTATTO[TONI_CONTATTO[stato]],
      attuale: stato === attuale,
      abilitata: !chiusa,
      ...(chiusa ? { perche: FRASE_STOP_RISERVATO } : {}),
      chiedeConferma: stato === "stop" && !inStop,
    };
  });
}

/** Frase della riga di storia: «In attesa · promemoria automatico, 23/10 15:05»,
 *  «Ha risposto · 23/10 15:09 · “ok ci sono”», «Contattato · a mano da Mario,
 *  23/10 15:05». */
export function fraseVoceStoria(v: ContattoWa["storia"][number]): string {
  const quando = quandoBreve(v.il);
  const automatico = v.da === DA_AUTOMATICO;
  let chi = "";
  if (automatico) {
    if (v.stato === "in_attesa" && v.motivo === "promemoria") chi = "promemoria automatico";
    else if (v.stato === "in_attesa" && v.motivo === "ricontatto") chi = "ricontatto automatico";
    else if (v.stato === "stop") chi = "ha scritto STOP";
    else if (v.stato === "non_raggiungibile") chi = v.motivo?.trim() || "invio rifiutato";
    else if (v.stato === "non_ha_risposto" && v.motivo === "promemoria")
      chi = "promemoria senza risposta";
    else if (v.stato === "non_ha_risposto" && v.motivo === "ricontatto")
      chi = "ricontatto senza risposta";
    else if (v.stato !== "ha_risposto") chi = "automatico";
  } else {
    chi = `a mano da ${v.da}`;
  }
  const mezzo = [chi, quando].filter(Boolean).join(chi && quando ? ", " : "");
  const testa = [ETICHETTE_CONTATTO[v.stato] ?? v.stato, mezzo].filter(Boolean).join(" · ");
  return v.anteprima ? `${testa} · “${v.anteprima}”` : testa;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. «OK A WHATSAPP»
   ═════════════════════════════════════════════════════════════════════════ */

/** Il valore che il browser scrive nella scheda. Chi lo mette è chi lavora;
 *  se il nome non c'è si scrive «sconosciuto», come per il secondo stato. */
export function nuovoOkWhatsapp(si: boolean, chi: string, adesso: Date): OkWhatsapp {
  return { si, il: adesso.toISOString(), da: chi.trim() || "sconosciuto" };
}

export interface VistaOk {
  acceso: boolean;
  /** la riga sotto l'interruttore */
  riga: string;
  /** vero se il cliente ha dato il consenso anche col modulo */
  dalModulo: boolean;
}

/** La riga sotto l'interruttore: «chiesto a voce da Mario, 23/10». */
export function vistaOkWhatsapp(
  ok: OkWhatsapp | null | undefined,
  modulo?: ConsensoModulo | null,
): VistaOk {
  const dalModulo = modulo?.whatsapp === true;
  const giorno = giornoBreve(ok?.il);
  const quando = giorno ? `, ${giorno}` : "";
  if (ok?.si)
    return {
      acceso: true,
      riga: `Chiesto a voce da ${ok.da || "sconosciuto"}${quando}`,
      dalModulo,
    };
  if (ok && ok.si === false && ok.il)
    return { acceso: false, riga: `Tolto da ${ok.da || "sconosciuto"}${quando}`, dalModulo };
  return {
    acceso: false,
    riga: dalModulo
      ? "Il cliente ha già dato il consenso nel modulo"
      : "Non ancora chiesto: senza, promemoria e ricontatti non partono",
    dalModulo,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. «OGGI»: CHI HA RISPOSTO E CHI NO AL RICONTATTO AUTOMATICO
   ═════════════════════════════════════════════════════════════════════════ */

/** Per quanti giorni una risposta (o un silenzio) resta in evidenza in «Oggi».
 *  shortcut: finestra fissa di 3 giorni; se serve diversa, si cambia qui.
 *  Chi cambia il secondo stato a mano esce prima dalla striscia. */
export const GIORNI_IN_EVIDENZA = 3;

export interface RigaRisposteOggi<T> {
  scheda: T;
  /** ISO: quando ha risposto, o quando è scaduta l'attesa */
  quando: string;
  /** l'inizio della risposta, se c'è */
  anteprima?: string;
}

/** Chi ha risposto e chi non ha risposto al RICONTATTO AUTOMATICO, dal più
 *  recente. Una risposta o un «Non ha risposto» messi a mano non contano: la
 *  striscia parla solo di quello che ha fatto il sistema. */
export function righeRisposteOggi<T extends { data?: Partial<LeadData> | null }>(
  schede: T[],
  adesso: Date,
): { risposto: RigaRisposteOggi<T>[]; nonRisposto: RigaRisposteOggi<T>[] } {
  const risposto: RigaRisposteOggi<T>[] = [];
  const nonRisposto: RigaRisposteOggi<T>[] = [];
  const dal = adesso.getTime() - GIORNI_IN_EVIDENZA * GIORNO;
  for (const scheda of schede) {
    const c = scheda.data?.contattoWa;
    const stato = statoContattoEffettivo(scheda.data, adesso);
    if (!c || !stato || c.da !== DA_AUTOMATICO) continue;
    if (stato === "ha_risposto") {
      //  Il ricontatto è l'invio subito prima: la voce di sotto è «In attesa» o,
      //  se la risposta è arrivata tardi, «Non ha risposto» (che ne conserva il motivo).
      const prima = c.storia?.[1];
      if (prima?.motivo !== "ricontatto") continue;
      const t = Date.parse(c.il);
      if (!Number.isFinite(t) || t < dal) continue;
      risposto.push({
        scheda,
        quando: c.il,
        ...(c.storia[0]?.anteprima ? { anteprima: c.storia[0].anteprima } : {}),
      });
    } else if (stato === "non_ha_risposto" && c.motivo === "ricontatto") {
      const quando = c.stato === "in_attesa" ? c.scadeRisposta : c.il;
      const t = Date.parse(String(quando ?? ""));
      if (!quando || !Number.isFinite(t) || t < dal) continue;
      nonRisposto.push({ scheda, quando });
    }
  }
  const perData = (a: { quando: string }, b: { quando: string }) =>
    Date.parse(b.quando) - Date.parse(a.quando);
  return { risposto: risposto.sort(perData), nonRisposto: nonRisposto.sort(perData) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. IL RIQUADRO DI IMPOSTAZIONI
   ═════════════════════════════════════════════════════════════════════════ */

export type TonoRiquadro = "verde" | "ambra" | "rosso" | "neutro";

/** I modelli che passano da un flusso ManyChat, con il nome che li riconosce la
 *  setter. Un flusso in più nella configurazione si mostra comunque. */
export const MODELLI_FLUSSO: { modello: string; etichetta: string }[] = [
  {
    modello: "consulenza_conferma_presenza",
    etichetta: "Conferma della consulenza («risponda SÌ»)",
  },
  { modello: "hgl_promemoria_meet", etichetta: "Promemoria 25 minuti prima del meet" },
  { modello: "hgl_ricontatto_consulenza", etichetta: "Ricontatto dei consulenti" },
];

/** Il giro è fermo? Il minuto in più del cron non conta: oltre 5 minuti è un
 *  allarme (PIANO §0, «giro che non parte mai, in silenzio»). */
export const ALLARME_GIRO_MS = 5 * MIN;

export interface AllarmeGiro {
  tono: "rosso" | "ambra";
  frase: string;
}

/** «Nessun giro da più di 5 minuti», in rosso. Se il giro non è mai partito:
 *  rosso se l'interruttore è acceso, ambra se è tutto spento (in quel caso è
 *  solo da sapere). */
export function allarmeGiro(
  giro: Pick<GiroManychat, "ultimoGiroIl">,
  acceso: boolean,
  adesso: Date,
): AllarmeGiro | null {
  const t = Date.parse(String(giro.ultimoGiroIl ?? ""));
  if (!Number.isFinite(t))
    return {
      tono: acceso ? "rosso" : "ambra",
      frase: acceso
        ? "Il giro non è ancora partito mai: i messaggi non possono uscire. Controlla che l'ultima migrazione del database sia applicata."
        : "Il giro a orario non è ancora partito mai. Parte con l'ultima migrazione del database; finché è tutto spento non serve.",
    };
  if (adesso.getTime() - t <= ALLARME_GIRO_MS) return null;
  return {
    tono: "rosso",
    frase: `Nessun giro da più di 5 minuti (l'ultimo: ${quandoBreve(giro.ultimoGiroIl)}). Finché non riparte, nessun messaggio automatico esce.`,
  };
}

/** I tetti che valgono davvero adesso: il minimo fra il riquadro e le costanti,
 *  con la prima settimana a 10 ricontatti. */
export function tettiEffettivi(
  tetti: ConfigManychat["tetti"] | null | undefined,
  primaAccensione: string | null | undefined,
  adesso: Date,
): { ricontatti: number; totale: number; primaSettimana: boolean } {
  const intero = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : max;
  const t0 = Date.parse(String(primaAccensione ?? ""));
  const primaSettimana = Number.isFinite(t0) && adesso.getTime() < t0 + 7 * GIORNO;
  const ricontatti = intero(tetti?.ricontatti, TETTO_RICONTATTI);
  return {
    ricontatti: primaSettimana ? Math.min(ricontatti, TETTO_PRIMA_SETTIMANA) : ricontatti,
    totale: intero(tetti?.totale, TETTO_TOTALE),
    primaSettimana,
  };
}

/** Il tetto scritto dal titolare: un numero intero da 1 al massimo consentito.
 *  Il massimo non si alza (il server lo riporta comunque alle costanti). */
export function leggiTetto(
  testo: string,
  massimo: number,
): { ok: true; valore: number } | { ok: false; errore: string } {
  const t = String(testo ?? "").trim();
  if (!/^\d{1,4}$/.test(t)) return { ok: false, errore: "Scrivi un numero intero." };
  const n = Number(t);
  if (n < 1) return { ok: false, errore: "Almeno 1: per fermare tutto spegni l'interruttore." };
  if (n > massimo) return { ok: false, errore: `Al massimo ${massimo}: puoi solo abbassarlo.` };
  return { ok: true, valore: n };
}

/** L'identificativo di un flusso (`ns`): lo si copia da ManyChat. Vuoto = toglie
 *  il flusso. Niente spazi, lunghezza ragionevole. */
export function leggiNs(
  testo: string,
): { ok: true; valore: string } | { ok: false; errore: string } {
  const t = String(testo ?? "").trim();
  if (t.length > 120)
    return { ok: false, errore: "Troppo lungo: controlla di aver copiato solo l'identificativo." };
  if (/\s/.test(t))
    return { ok: false, errore: "L'identificativo non ha spazi: ricopialo da ManyChat." };
  return { ok: true, valore: t };
}

const plurale = (n: number, uno: string, molti: string) => `${n} ${n === 1 ? uno : molti}`;

export interface RigaStatoRiquadro {
  tono: TonoRiquadro;
  /** la parola che accompagna il colore */
  parola: string;
  frase: string;
}

/** La riga di stato in chiaro (SPEC §3.2): il motivo in rosso o «Attivo · ultimo
 *  giro alle 14:32 · oggi 6 promemoria, 9 ricontatti, 5 risposte · prossimo
 *  ricontatto verso le 15:01». */
export function rigaStatoRiquadro(s: StatoManychat, adesso: Date): RigaStatoRiquadro {
  const { config, giro } = s;
  const rosso = (frase: string): RigaStatoRiquadro => ({ tono: "rosso", parola: "Fermo", frase });
  if (!s.migrazione) return rosso("Manca l'aggiornamento del database: il giro non manda niente.");
  if (!s.chiavePresente) return rosso("Manca la chiave di ManyChat.");
  if (config.fermatoMotivo) return rosso(`Fermato: ${config.fermatoMotivo}`);
  if (!config.acceso)
    return { tono: "neutro", parola: "Spento", frase: "Spento: nessun messaggio parte." };
  if (!config.promemoria && !config.ricontatti)
    return {
      tono: "ambra",
      parola: "In attesa",
      frase: "Acceso, ma promemoria e ricontatti sono spenti: non parte niente.",
    };
  const eff = tettiEffettivi(config.tetti, config.primaAccensione, adesso);
  const totaleOggi = giro.oggi.promemoria + giro.oggi.ricontatti;
  if (config.ricontatti && giro.oggi.ricontatti >= eff.ricontatti)
    return {
      tono: "ambra",
      parola: "Tetto",
      frase: `Tetto di oggi raggiunto: ${plurale(giro.oggi.ricontatti, "ricontatto", "ricontatti")} su ${eff.ricontatti}. Gli altri slittano a domani.`,
    };
  if (totaleOggi >= eff.totale)
    return {
      tono: "ambra",
      parola: "Tetto",
      frase: `Tetto di oggi raggiunto: ${totaleOggi} messaggi su ${eff.totale}.`,
    };
  if (nessunaRispostaDa48Ore(s, adesso))
    return {
      tono: "ambra",
      parola: "Controlla",
      frase: "Nessuna risposta da ManyChat da 48 ore: controlla il flusso delle risposte.",
    };
  const pezzi = ["Attivo"];
  if (giro.ultimoGiroIl) pezzi.push(`ultimo giro alle ${oraBreve(giro.ultimoGiroIl)}`);
  pezzi.push(
    `oggi ${plurale(giro.oggi.promemoria, "promemoria", "promemoria")}, ${plurale(giro.oggi.ricontatti, "ricontatto", "ricontatti")}, ${plurale(giro.oggi.risposte, "risposta", "risposte")}`,
  );
  const prossimo = Date.parse(String(giro.prossimoRicontattoDopo ?? ""));
  if (config.ricontatti && Number.isFinite(prossimo) && prossimo > adesso.getTime())
    pezzi.push(`prossimo ricontatto verso le ${oraBreve(giro.prossimoRicontattoDopo)}`);
  return { tono: "verde", parola: "Attivo", frase: pezzi.join(" · ") };
}

/** Si sono mandati messaggi e in 48 ore non ne è tornata nessuna risposta? Solo
 *  dopo 48 ore dalla prima accensione: prima non c'è niente da aspettarsi.
 *  shortcut: basta un invio nelle ultime 48 ore e nessuna risposta nelle ultime 48. */
export function nessunaRispostaDa48Ore(s: StatoManychat, adesso: Date): boolean {
  const { config, giro } = s;
  const limite = adesso.getTime() - 2 * GIORNO;
  const prima = Date.parse(String(config.primaAccensione ?? ""));
  const invio = Date.parse(String(giro.ultimoInvioIl ?? ""));
  const risposta = Date.parse(String(giro.ultimaRispostaIl ?? ""));
  if (!Number.isFinite(prima) || prima > limite) return false;
  if (!Number.isFinite(invio) || invio < limite) return false;
  return !Number.isFinite(risposta) || risposta < limite;
}

/** Le parole accanto al colore nelle righe del «Collegamento ok». */
export const PAROLA_ESITO: Record<RigaCollegamento["esito"], string> = {
  ok: "ok",
  errore: "problema",
  da_verificare: "da verificare",
};

export interface TitoloCollegamento {
  tono: TonoRiquadro;
  titolo: string;
}

/** «Collegamento ok» solo se OGNI riga è ok; altrimenti dice quanti problemi. */
export function titoloCollegamento(c: CollegamentoManychat | null | undefined): TitoloCollegamento {
  if (!c || c.righe.length === 0)
    return { tono: "neutro", titolo: "Collegamento non ancora controllato" };
  const errori = c.righe.filter((r) => r.esito === "errore").length;
  const dubbi = c.righe.filter((r) => r.esito === "da_verificare").length;
  if (errori > 0)
    return { tono: "rosso", titolo: `Collegamento: ${plurale(errori, "problema", "problemi")}` };
  if (dubbi > 0)
    return {
      tono: "ambra",
      titolo: `Collegamento: ${plurale(dubbi, "cosa da verificare", "cose da verificare")}`,
    };
  return { tono: "verde", titolo: "Collegamento ok" };
}

/** Le righe dei problemi del giro: nome abbreviato e motivo, mai il numero.
 *  Al massimo 20, dal più recente. */
export function righeProblemi(
  giro: Pick<GiroManychat, "problemi">,
): { quando: string; testo: string }[] {
  return [...(giro.problemi ?? [])]
    .sort((a, b) => Date.parse(b.il) - Date.parse(a.il))
    .slice(0, 20)
    .map((p) => ({ quando: quandoBreve(p.il), testo: `${p.nome} · ${p.tipo} · ${p.motivo}` }));
}
