/** ── COSA C'È DA SAPERE, ADESSO ────────────────────────────────────────────
 *
 *  Questo file NON notifica niente: guarda le trattative e restituisce l'elenco
 *  dei fatti che meritano un avviso in questo istante. È volutamente una
 *  funzione pura — stessi lead, stessa ora, stessa istantanea ⇒ stesso
 *  risultato — perché così si può ragionare (e domani provare) sul "quando
 *  scatta" senza tirarsi dietro browser, suoni e permessi.
 *
 *  DUE FAMIGLIE DI EVENTI, CALCOLATE IN MODO DIVERSO
 *   · DI OROLOGIO — appuntamenti, installazioni, richiami, saldi. Si ricavano
 *     dalle date della scheda confrontate con l'ora attuale. Sono veri anche al
 *     primo avvio: se fra dieci minuti c'è una consulenza, va detto subito.
 *   · DI CAMBIAMENTO — lead nuovo assegnato, cambio di stato. Esistono solo
 *     rispetto a com'era il CRM al giro precedente (l'"istantanea"). Al primo
 *     avvio su un dispositivo l'istantanea non c'è, e in quel giro NON si
 *     emette nulla di questa famiglia: altrimenti l'intero archivio verrebbe
 *     annunciato tutto insieme.
 *
 *  LE FINESTRE TEMPORALI SONO STRETTE DI PROPOSITO
 *  "Appuntamento passato senza esito" guarda solo le ultime otto ore, non
 *  l'archivio: la prima volta che si accendono le notifiche ci sono quasi
 *  sempre decine di appuntamenti vecchi rimasti senza esito, e annunciarli
 *  tutti sarebbe esattamente la raffica che si vuole evitare.
 *  ───────────────────────────────────────────────────────────────────────── */

import type { Consultant, Lead, LeadStatus } from "@/crm/types";
import { LEAD_STATUS_LABEL, STATI_VINTI, eAppuntamento, eChiusuraVinta } from "@/crm/types";
import { eur, oggiIso, saldoDaIncassare, soloData } from "@/crm/ui";
import type { LivelloSuono } from "@/crm/suoni-crm";
import { CATALOGO, type TipoEvento } from "./catalogo";
//  «Da quanto aspetta una risposta» si calcola in un posto solo: è lo stesso
//  conto che colora la riga nel reparto «Scritti su WhatsApp».
import { ATTESA_ROSSA_GG, attesaWhatsApp } from "@/crm/importa/ricarico";
import {
  prossimeScadenze,
  toccaAvvisare,
  type RegimeLiquidazione,
} from "@/crm/contabilita-scadenze";
import type { NotificationSeverity } from "./types";
import type { Istantanea } from "./registro";

export interface EventoCrm {
  tipo: TipoEvento;
  /** Identità dell'evento: se è già in memoria, non si notifica di nuovo. */
  chiave: string;
  titolo: string;
  corpo: string;
  /** Presente quando l'avviso riguarda UNA trattativa: il clic apre la scheda. */
  leadId?: string;
  /** Pagina da aprire quando non c'è (o non basta) una scheda singola. */
  destinazione: string;
  /** Sovrascrivono il catalogo quando il singolo caso è più (o meno) grave. */
  gravita?: NotificationSeverity;
  suono?: LivelloSuono;
}

/* ── PICCOLI ATTREZZI ────────────────────────────────────────────────────── */

const MIN = 60_000;
const ORA = 60 * MIN;

/** Pratiche finite: si portano dietro date vecchie che non vanno più annunciate. */
const CHIUSI = new Set<LeadStatus>(["concluso", "annullato", "perdi_tempo", "ripensamento"]);
/** Per i promemoria di appuntamento anche "cliente assente" è una storia finita. */
const CHIUSI_O_ASSENTE = new Set<LeadStatus>([...CHIUSI, "no_show"]);
/** Chi ha già pagato non va richiamato per il ricontatto rimasto in scheda.
 *  ⚠️ L'elenco NON è più scritto a mano: `STATI_VINTI` (crm/types.ts) conosce
 *   anche le tre chiusure di oggi. Scritto a mano si fermava al vecchio
 *   "venduto", e il risultato era il peggiore possibile per un avviso: il
 *   cliente a cui si era appena venduto si portava dietro la data di ricontatto
 *   rimasta in scheda dai tempi della trattativa, e il CRM continuava a
 *   suonare per richiamarlo. Un avviso che arriva quando non serve è un avviso
 *   che si impara a spegnere, e con lui si spengono anche gli altri. */
const GIA_VINTI = new Set<LeadStatus>(STATI_VINTI);

/** Gli stati il cui ARRIVO merita un avviso. Non tutti i cambi di stato lo
 *  meritano: "non risponde" cambia venti volte al giorno ed è rumore. */
const STATI_DA_ANNUNCIARE: Partial<
  Record<LeadStatus, { verbo: string; gravita: NotificationSeverity; suono: LivelloSuono }>
> = {
  acconto: { verbo: "ha versato l'acconto", gravita: "info", suono: "discreto" },
  //  Stato storico: non si assegna più, ma una scheda d'archivio che ci torna
  //  deve continuare ad avere il suo verbo. Senza, l'avviso non partirebbe
  //  affatto (la tabella è consultata per chiave).
  venduto: { verbo: "è passata a venduto", gravita: "info", suono: "discreto" },
  //  ── LE TRE CHIUSURE VINTE ────────────────────────────────────────────────
  //   Sono il modo in cui oggi si vince un lead, cioè l'avviso che più di ogni
  //   altro cambia la giornata di qualcun altro: senza queste tre righe la
  //   vendita più importante della settimana passava MUTA — chi tiene l'agenda
  //   non sapeva di dover trovare un posto, chi tiene il magazzino non sapeva
  //   di dover preparare un pacco. Il verbo dice anche COME arriva l'impianto,
  //   perché è quello che decide chi deve muoversi.
  posa_in_sede: {
    verbo: "ha comprato, posa nel nostro centro",
    gravita: "info",
    suono: "discreto",
  },
  posa_a_domicilio: { verbo: "ha comprato, posa a domicilio", gravita: "info", suono: "discreto" },
  posa_da_spedire: {
    verbo: "ha comprato, impianto da spedire",
    gravita: "info",
    suono: "discreto",
  },
  //  «Irreperibile» è l'unico dei quattro che NON si annuncia, ed è una scelta:
  //  non è un fatto nuovo, è la constatazione di un silenzio che dura da un
  //  pezzo. Non cambia la giornata di nessuno e non richiede un gesto entro
  //  oggi; suonare per dirlo sarebbe rumore su una cosa già nota.
  no_show: { verbo: "non si è presentata", gravita: "critical", suono: "urgente" },
  //  I tre che seguono cambiano la giornata di qualcun altro: chi tiene
  //  l'agenda deve sapere che è comparso un appuntamento, chi tiene la cassa
  //  che c'è un acconto da rincorrere, e chi lavorava la trattativa che è
  //  stata chiusa da un collega mentre lui la stava ancora richiamando.
  appuntamento_fissato: { verbo: "ha un appuntamento fissato", gravita: "info", suono: "discreto" },
  //  Chi tiene l'agenda deve saperlo anche quando l'appuntamento nasce da un
  //  cliente di ritorno: è un posto occupato in calendario esattamente come
  //  l'altro, e senza questa riga l'avviso semplicemente non partiva.
  appuntamento_rifissato: {
    verbo: "ha un appuntamento rifissato",
    gravita: "info",
    suono: "discreto",
  },
  in_attesa_acconto: { verbo: "aspetta l'acconto", gravita: "warning", suono: "discreto" },
  annullato: { verbo: "è stata chiusa: non interessato", gravita: "info", suono: "discreto" },
  //  ⚠️ Gravità «warning», non «info» come le altre chiusure perse. Un
  //   ripensamento è l'unico no che arriva DOPO un sì: è il segnale che dice
  //   dove si sta perdendo fatturato già vinto, e annunciarlo con lo stesso
  //   tono di «non era interessato» lo farebbe scorrere via insieme al resto.
  ripensamento: { verbo: "ci ha ripensato", gravita: "warning", suono: "discreto" },
};

/** Data + ora in millisecondi, con l'orologio locale.
 *  Le date del CRM sono stringhe locali ("2026-08-13", "09:30"): passare da
 *  UTC farebbe slittare di due ore ogni promemoria d'estate. */
function istante(data?: string | null, ora?: string | null): number | null {
  const d = soloData(data);
  if (!d || d.length < 10) return null;
  const o = String(ora || "").trim();
  const hhmm = /^\d{1,2}:\d{2}/.test(o) ? o.slice(0, 5).padStart(5, "0") : null;
  const t = new Date(`${d}T${hhmm ?? "00:00"}:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Solo l'ora, per i testi: "09:30". */
function soloOra(ora?: string | null): string {
  const o = String(ora || "").trim();
  return /^\d{1,2}:\d{2}/.test(o) ? o.slice(0, 5).padStart(5, "0") : "";
}

function nomeLead(l: Lead): string {
  const n = `${l.data.nome || ""} ${l.data.cognome || ""}`.trim();
  return n || l.data.telefono || "Trattativa senza nome";
}

function minutiA(ms: number): number {
  return Math.max(0, Math.round(ms / MIN));
}

function giornoDopo(base: Date): string {
  const d = new Date(base);
  d.setDate(d.getDate() + 1);
  return oggiIso(d);
}

/* ── IL CALCOLO ──────────────────────────────────────────────────────────── */

export interface IngressoCalcolo {
  leads: Lead[];
  consulenti: Consultant[];
  ora: Date;
  istantanea: Istantanea;
  /** ── COME SI LIQUIDA L'IVA ───────────────────────────────────────────
   *  Serve alle scadenze fiscali, che cambiano data fra mensile e
   *  trimestrale. ⚠️ Facoltativa, e il ripiego è «trimestrale»: è il regime
   *  di quasi tutte le società piccole, ed è quello che sbaglia meno se
   *  arriva prima di quello vero — un avviso in anticipo si ignora, uno in
   *  ritardo costa il 30%. */
  liquidazione?: RegimeLiquidazione;
}

export interface EsitoCalcolo {
  eventi: EventoCrm[];
  /** L'istantanea aggiornata, da salvare DOPO aver notificato. */
  istantanea: Istantanea;
}

export function calcolaEventi({
  leads,
  consulenti,
  ora,
  istantanea,
  liquidazione = "trimestrale",
}: IngressoCalcolo): EsitoCalcolo {
  const adesso = ora.getTime();
  const oggi = oggiIso(ora);
  const domani = giornoDopo(ora);
  const oreDelGiorno = ora.getHours();
  const eventi: EventoCrm[] = [];

  const nomeConsulente = new Map(consulenti.map((c) => [c.id, c.data?.nome || "consulente"]));
  const righeNuove: Record<string, string> = {};

  for (const l of leads) {
    const d = l.data;
    if (!d) continue;
    const stato = d.stato;
    const nome = nomeLead(l);
    const consulente = d.consulenteId || "";

    // L'istantanea si ricostruisce SEMPRE, anche per i lead che non generano
    // eventi: è la fotografia del CRM, non l'elenco delle cose notificate.
    righeNuove[l.id] = `${stato}|${consulente}`;
    const prima = istantanea.righe[l.id];

    /* ── 1/2. APPUNTAMENTI: fra 15 minuti e adesso ───────────────────────── */
    const appuntamenti = [
      { cosa: "Consulenza", data: d.dataMeeting, ora: d.oraMeeting },
      { cosa: "Appuntamento in sede", data: d.dataVieneInSede, ora: d.oraVieneInSede },
    ].filter((a) => soloOra(a.ora)); // senza orario non esiste un promemoria

    if (!CHIUSI_O_ASSENTE.has(stato)) {
      for (const a of appuntamenti) {
        const t = istante(a.data, a.ora);
        if (t === null) continue;
        const mancano = t - adesso;

        if (mancano > 0 && mancano <= 15 * MIN) {
          eventi.push({
            tipo: "appuntamento_15min",
            chiave: `a15:${l.id}:${soloData(a.data)}:${soloOra(a.ora)}`,
            titolo: `${a.cosa} fra ${minutiA(mancano)} min`,
            corpo: `${nome} · ore ${soloOra(a.ora)}`,
            leadId: l.id,
            destinazione: CATALOGO.appuntamento_15min.destinazione,
          });
        }

        // Finestra di cinque minuti e non di uno: se la scheda era in secondo
        // piano il browser rallenta i timer, e con una finestra stretta
        // l'avviso più importante della giornata sarebbe quello che si perde.
        if (mancano <= 0 && mancano > -5 * MIN) {
          eventi.push({
            tipo: "appuntamento_ora",
            chiave: `aora:${l.id}:${soloData(a.data)}:${soloOra(a.ora)}`,
            titolo: `${a.cosa} in partenza`,
            corpo: `${nome} · era previsto per le ${soloOra(a.ora)}`,
            leadId: l.id,
            destinazione: CATALOGO.appuntamento_ora.destinazione,
          });
        }
      }
    }

    /* ── 3. APPUNTAMENTO PASSATO SENZA ESITO ─────────────────────────────── */
    //  "Appuntamento fissato" mezz'ora dopo l'orario significa una cosa sola:
    //  nessuno ha segnato com'è andata. Ed è il dato da cui dipendono tutte le
    //  statistiche di chiusura.
    if (eAppuntamento(stato)) {
      for (const a of appuntamenti) {
        const t = istante(a.data, a.ora);
        if (t === null) continue;
        const passati = adesso - t;
        if (passati >= 30 * MIN && passati <= 8 * ORA) {
          eventi.push({
            tipo: "appuntamento_senza_esito",
            chiave: `aesito:${l.id}:${soloData(a.data)}:${soloOra(a.ora)}`,
            titolo: "Esito da segnare",
            corpo: `${nome} · ${a.cosa.toLowerCase()} delle ${soloOra(a.ora)}, ancora senza esito`,
            leadId: l.id,
            destinazione: CATALOGO.appuntamento_senza_esito.destinazione,
          });
        }
      }
    }

    /* ── 4. LEAD NUOVO ASSEGNATO ─────────────────────────────────────────── */
    //  Due casi che per chi lavora sono lo stesso fatto ("è arrivato lavoro
    //  per Marco"): una trattativa nuova che nasce già assegnata, e una
    //  trattativa esistente che viene assegnata adesso.
    if (istantanea.inizializzata && consulente) {
      const consulenteDiPrima = prima === undefined ? null : prima.split("|")[1] || "";
      const nascitaMs = new Date(d.createdAt || l.created_at).getTime();
      const recente = Number.isFinite(nascitaMs) ? adesso - nascitaMs < 12 * ORA : false;
      const appenaNato = prima === undefined && recente;
      const appenaAssegnato = consulenteDiPrima === "" && prima !== undefined;
      if (appenaNato || appenaAssegnato) {
        eventi.push({
          tipo: "lead_nuovo",
          chiave: `nuovo:${l.id}:${consulente}`,
          titolo: "Nuovo lead assegnato",
          corpo: `${nome} → ${nomeConsulente.get(consulente) || "consulente"}`,
          leadId: l.id,
          destinazione: CATALOGO.lead_nuovo.destinazione,
        });
      }
    }

    /* ── 5. CAMBIO DI STATO IMPORTANTE ───────────────────────────────────── */
    if (istantanea.inizializzata && prima !== undefined) {
      const statoDiPrima = prima.split("|")[0];
      const annuncio = STATI_DA_ANNUNCIARE[stato];
      if (annuncio && statoDiPrima !== stato) {
        const importo = saldoDaIncassare(l);
        const dettaglio =
          stato === "acconto" && Number(d.payment?.accontoPagato) > 0
            ? ` · acconto ${eur(Number(d.payment?.accontoPagato))}`
            : //  Il saldo residuo si dice su OGNI chiusura vinta, non solo sul
              //  vecchio "venduto": è l'informazione che serve a chi consegna,
              //  ed è proprio sulle vendite di oggi che mancava.
              eChiusuraVinta(stato) && importo > 0
              ? ` · saldo ${eur(importo)}`
              : "";
        eventi.push({
          tipo: "cambio_stato",
          chiave: `stato:${l.id}:${stato}`,
          titolo: LEAD_STATUS_LABEL[stato] ?? "Stato aggiornato",
          corpo: `${nome} ${annuncio.verbo}${dettaglio}`,
          leadId: l.id,
          destinazione: CATALOGO.cambio_stato.destinazione,
          gravita: annuncio.gravita,
          suono: annuncio.suono,
        });
      }
    }

    /* ── 6/7. INSTALLAZIONI ──────────────────────────────────────────────── */
    const dataInst = soloData(d.installazione?.dataInstallazione);
    const oraInst = soloOra(d.installazione?.orarioInstallazione);
    if (dataInst && !CHIUSI.has(stato)) {
      if (dataInst === domani) {
        eventi.push({
          tipo: "installazione_domani",
          chiave: `instdom:${l.id}:${dataInst}`,
          titolo: "Installazione domani",
          corpo: `${nome}${oraInst ? ` · ore ${oraInst}` : ""}${
            d.installazione?.tecnicoAssegnato ? ` · ${d.installazione.tecnicoAssegnato}` : ""
          }`,
          leadId: l.id,
          destinazione: CATALOGO.installazione_domani.destinazione,
        });
      }
      // Dalle sei del mattino: chi lascia il CRM aperto la notte non deve
      // ricevere il programma della giornata alle 00:01.
      if (dataInst === oggi && oreDelGiorno >= 6) {
        eventi.push({
          tipo: "installazione_oggi",
          chiave: `instoggi:${l.id}:${dataInst}`,
          titolo: "Installazione oggi",
          corpo: `${nome}${oraInst ? ` · ore ${oraInst}` : ""}`,
          leadId: l.id,
          destinazione: CATALOGO.installazione_oggi.destinazione,
        });
      }
    }

    /* ── 8. RICHIAMO SCADUTO ─────────────────────────────────────────────── */
    if (!CHIUSI.has(stato) && !GIA_VINTI.has(stato)) {
      const tRichiamo =
        istante(d.dataRicontatto, d.oraRicontatto) ??
        (d.callbackAt ? new Date(d.callbackAt).getTime() : null);
      if (tRichiamo !== null && Number.isFinite(tRichiamo)) {
        const ritardo = adesso - tRichiamo;
        // Oltre una settimana non è più un promemoria, è un rimprovero
        // quotidiano: quelle trattative si recuperano dalle liste, non dai
        // popup.
        if (ritardo > 0 && ritardo <= 7 * 24 * ORA && oreDelGiorno >= 8) {
          const giorni = Math.floor(ritardo / (24 * ORA));
          eventi.push({
            tipo: "richiamo_scaduto",
            // Una volta al giorno per trattativa: il richiamo resta scaduto
            // finché non lo si fa, ma non deve suonare ogni mezz'ora.
            chiave: `rich:${l.id}:${oggi}`,
            titolo: "Richiamo scaduto",
            corpo: `${nome} · ${
              giorni === 0
                ? `era per le ${soloOra(d.oraRicontatto) || "oggi"}`
                : `in ritardo di ${giorni} g`
            }`,
            leadId: l.id,
            destinazione: CATALOGO.richiamo_scaduto.destinazione,
          });
        }
      }
    }

    /* ── 8-BIS. SCRITTO SU WHATSAPP E NESSUNA RISPOSTA ────────────────────
       ⚠️ Perché esiste: misurato in archivio il 7/10/2026 — sedici contatti di
        ritorno scritti il 28 settembre in cinquanta minuti, nessuno chiuso
        nove giorni dopo. Il reparto lo mostrava a chi apriva quella pagina, e
        in nove giorni non l'ha aperta nessuno. Undici tipi di avviso
        guardavano appuntamenti, installazioni e incassi: nessuno guardava le
        persone a cui avevamo scritto.
       ⚠️ Solo dalla soglia rossa in su (sei giorni, `ATTESA_ROSSA_GG`): prima
        non è dimenticanza, è attesa normale, e un avviso che parte il giorno
        dopo insegna a ignorarlo.
       ⚠️ E si tace su chi ha già deciso: `attesaWhatsApp` risponde solo per
        chi ha ancora la domanda aperta, perché la data del messaggio viene
        cancellata da entrambe le decisioni. */
    if (!CHIUSI.has(stato)) {
      const attesa = attesaWhatsApp(l, new Date(adesso));
      if (attesa && attesa.giorni >= ATTESA_ROSSA_GG && oreDelGiorno >= 8) {
        eventi.push({
          tipo: "whatsapp_senza_risposta",
          //  Una volta al giorno per persona: il silenzio dura, l'avviso no.
          chiave: `wa:${l.id}:${oggi}`,
          titolo: "Nessuna risposta su WhatsApp",
          corpo: `${nome} · ${attesa.giorni} giorni${attesa.confermato ? "" : " · mai confermato"}`,
          leadId: l.id,
          destinazione: CATALOGO.whatsapp_senza_risposta.destinazione,
        });
      }
    }

    /* ── 9. SALDO DA INCASSARE OGGI ──────────────────────────────────────── */
    if (!CHIUSI.has(stato) && oreDelGiorno >= 7) {
      const residuo = saldoDaIncassare(l);
      const scadenzaRata = soloData(d.payment?.prossimaScadenza);
      const rata = Number(d.payment?.importoRata) || 0;
      const rataOggi = scadenzaRata === oggi && (rata > 0 || residuo > 0);
      const consegnaOggi = dataInst === oggi && residuo > 0;
      if (rataOggi || consegnaOggi) {
        const importo = rataOggi && rata > 0 ? rata : residuo;
        eventi.push({
          tipo: "saldo_oggi",
          chiave: `saldo:${l.id}:${oggi}`,
          titolo: rataOggi ? "Rata in scadenza oggi" : "Saldo da incassare oggi",
          corpo: `${nome} · ${eur(importo)}${consegnaOggi ? " alla consegna" : ""}`,
          leadId: l.id,
          destinazione: CATALOGO.saldo_oggi.destinazione,
        });
      }

      /* ── 10. SALDO ANCORA APERTO DOPO L'INSTALLAZIONE ──────────────────── */
      //  Il lavoro è stato consegnato e i soldi no. Finché la posa è di oggi ci
      //  pensa l'avviso qui sopra; dal giorno dopo non lo copriva più nessuno e
      //  il residuo spariva dai radar. Si guardano solo le ultime otto
      //  settimane: più indietro è una pratica da recupero crediti, non un
      //  promemoria della giornata.
      if (dataInst && dataInst < oggi && residuo > 0) {
        const giorniDaPosa = Math.floor((adesso - (istante(dataInst) ?? adesso)) / (24 * ORA));
        if (giorniDaPosa >= 1 && giorniDaPosa <= 56) {
          eventi.push({
            tipo: "saldo_arretrato",
            // Una volta al giorno: resta aperto finché non lo si incassa, ma
            // non deve suonare a ogni giro.
            chiave: `saldoarr:${l.id}:${oggi}`,
            titolo: "Saldo aperto dopo l'installazione",
            corpo: `${nome} · ${eur(residuo)} · posa di ${giorniDaPosa} g fa`,
            leadId: l.id,
            destinazione: CATALOGO.saldo_arretrato.destinazione,
          });
        }
      }
    }
  }

  /* ── LE SCADENZE FISCALI ────────────────────────────────────────────────
     ⚠️ NON NASCONO DAI LEAD, e per questo stanno fuori dal giro qui sopra: le
     decide il CALENDARIO. È anche il motivo per cui servono — nessuno se le
     ricorda guardando le trattative, e una liquidazione IVA saltata costa il
     30% di sanzione sul versamento tardivo.

     ⚠️ QUANDO AVVISARE lo decide `toccaAvvisare`, che è la stessa funzione
      della striscia dentro la pagina della contabilità: ogni cinque giorni da
      lontano, tutti i giorni nell'ultima settimana, e poi finché resta
      scoperta. Un secondo calendario qui vorrebbe dire una notifica che
      arriva un giorno e una striscia che ne dice un altro.

     ⚠️ E LA CHIAVE PORTA IL GIORNO: senza, il registro riconoscerebbe la
      stessa scadenza già annunciata e non direbbe più niente fino alla
      successiva — cioè proprio il contrario di «ricorrenti», che è quello che
      il committente ha chiesto. Con il giorno dentro, ogni avviso è un fatto
      nuovo, e il registro non lo ripete due volte nello stesso giorno. */
  for (const sc of prossimeScadenze(oggi, liquidazione, 6)) {
    if (!toccaAvvisare(sc.mancano)) continue;
    eventi.push({
      tipo: "scadenza_fiscale",
      chiave: `fisco:${sc.id}:${oggi}`,
      titolo:
        sc.mancano < 0
          ? `${sc.titolo}: scaduta da ${-sc.mancano} ${-sc.mancano === 1 ? "giorno" : "giorni"}`
          : sc.mancano === 0
            ? `${sc.titolo}: è oggi`
            : `${sc.titolo}: fra ${sc.mancano} ${sc.mancano === 1 ? "giorno" : "giorni"}`,
      corpo: sc.cosa,
      destinazione: CATALOGO.scadenza_fiscale.destinazione,
    });
  }

  return {
    eventi,
    istantanea: {
      righe: righeNuove,
      inizializzata: true,
      aggiornataIl: adesso,
    },
  };
}
