/** ── IL MOTORE DELLE NOTIFICHE ─────────────────────────────────────────────
 *
 *  Mette insieme i quattro pezzi che prima non si parlavano:
 *    eventi-crm  (cosa sta succedendo)  ·  registro   (cosa ho già detto)
 *    prefs       (cosa vuoi sapere)     ·  suoni-crm  (come te lo dico)
 *
 *  LE REGOLE CHE FANNO LA DIFFERENZA FRA "UTILE" E "MOLESTO"
 *   1. UN SUONO PER GIRO, non uno per notifica. Tre avvisi insieme fanno un
 *      suono solo, quello più urgente dei tre.
 *   2. RAGGRUPPAMENTO. Tre appuntamenti alle 15:00 diventano "3 appuntamenti
 *      fra poco", non tre riquadri sovrapposti.
 *   3. TETTO PER GIRO. Mai più di cinque riquadri in una volta: oltre quel
 *      numero non si leggono, si chiudono.
 *   4. `silent: true` sulla notifica di sistema. Il suono lo facciamo noi, con
 *      due livelli distinti; lasciando suonare anche il sistema operativo si
 *      sentirebbe un doppio "din" e i due livelli non si distinguerebbero più.
 *   5. NIENTE PERMESSO A SORPRESA. Qui non si chiama mai
 *      `requestPermission()`: se il permesso non c'è, il motore resta zitto e
 *      l'utente lo attiva dal pulsante che glielo spiega.
 *   6. NIENTE VA PERSO PRIMA DI ESSERE ARRIVATO. Ciò che è stato calcolato
 *      mentre il permesso non c'era finisce in coda (`registro.ts`, cassetto
 *      SOSPESI) e viene consegnato appena il permesso arriva. Senza questa
 *      regola, attivare le notifiche a metà mattina significava non ricevere
 *      più nulla fino al giorno dopo — ed era il guasto principale.
 *   7. UNA SCHEDA SOLA NOTIFICA. Con tre schede aperte il riquadro resta uno
 *      (stesso `tag`) ma i suoni erano tre: il turno in `registro.ts` decide
 *      chi parla.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { useRicerca } from "@/crm/ui";
import { installaSbloccoAudio, suona, type LivelloSuono } from "@/crm/suoni-crm";
import {
  ascoltaClicNotifica,
  mostraNotificaSistema,
  preparaCanaleSistema,
  type DatiNotifica,
} from "./canale-sistema";
import { CATALOGO, type TipoEvento } from "./catalogo";
import { calcolaEventi, type EventoCrm } from "./eventi-crm";
import { regimeLiquidazione } from "@/crm/contabilita-liquidazione";
import { leggiPrefs } from "./prefs-browser";
import {
  aggiungiSospesi,
  aggiungiStorico,
  giaNotificato,
  leggiIstantanea,
  leggiSospesi,
  liberaTurno,
  modificatoQui,
  prendiTurno,
  scriviIstantanea,
  segnaApertaStorico,
  segnaNotificati,
  togliSospesi,
  type AvvisoSospeso,
  type VoceStorico,
} from "./registro";
import { statoPermesso } from "./permesso";
import type { NotificationSeverity } from "./types";

/** Ogni mezzo minuto. È il passo più lento che coglie ancora "l'appuntamento
 *  inizia adesso" con la precisione che serve, e il calcolo è tutto in memoria:
 *  nessuna query, nessun costo di rete. */
const PASSO_MS = 30_000;
/** Oltre questo numero di riquadri in un colpo solo, nessuno legge più niente. */
const MAX_PER_GIRO = 5;

/** ── PERCHÉ GLI AVVISI SUI COLLEGHI NON POTEVANO ARRIVARE ──────────────────
 *  Le trattative si leggono una volta sola, all'apertura del CRM: non esiste
 *  nessun aggiornamento in tempo reale. Il motore confrontava quindi sempre la
 *  stessa fotografia con sé stessa, e "un collega ha cambiato stato" o "ti
 *  hanno assegnato un lead" erano avvisi che non potevano scattare per
 *  costruzione — si vedevano solo ricaricando la pagina a mano.
 *
 *  Qui si ascolta la tabella e si chiede una rilettura quando qualcosa cambia
 *  davvero. Con calma: salvare una scheda produce più scritture di fila, e una
 *  rilettura per ognuna sarebbe una tempesta di query. Si aspetta che la
 *  raffica finisca, e comunque mai più di una rilettura ogni venti secondi. */
const PAUSA_RILETTURA_MS = 4_000;
const MINIMO_FRA_RILETTURE_MS = 20_000;

/** Chi cambia qualcosa che riguarda le notifiche (permesso appena concesso,
 *  memoria azzerata) chiede un giro subito: aspettare mezzo minuto dopo aver
 *  premuto "Attiva" fa credere che il pulsante non abbia funzionato. */
export const EVENTO_RICALCOLA = "hg-crm-notif-ricalcola";

export function richiediGiro(): void {
  if (typeof window === "undefined") return;
  // La scheda in cui l'utente ha appena premuto un pulsante ha la precedenza:
  // il testimone si libera, così il giro parte QUI e l'effetto si vede subito
  // invece di comparire in un'altra finestra fra venti secondi.
  liberaTurno();
  window.dispatchEvent(new CustomEvent(EVENTO_RICALCOLA));
}

/** Un pacchetto pronto da mostrare: o un evento singolo, o N eventi dello
 *  stesso tipo fusi in uno. */
interface Avviso {
  chiavi: string[];
  tipo: TipoEvento;
  titolo: string;
  corpo: string;
  gravita: NotificationSeverity;
  suono: LivelloSuono;
  leadId?: string;
  destinazione: string;
  quantita: number;
}

/** La prima riga di ogni corpo raggruppato elenca i nomi: "3 appuntamenti fra
 *  poco" da solo non dice con chi, e costringerebbe ad aprire il CRM per
 *  scoprire una cosa che stava in venti caratteri. */
function corpoDiGruppo(eventi: EventoCrm[]): string {
  const primi = eventi.slice(0, 3).map((e) => e.corpo.split(" · ")[0]);
  const resto = eventi.length - primi.length;
  return resto > 0 ? `${primi.join(", ")} e altri ${resto}` : primi.join(", ");
}

function impacchetta(eventi: EventoCrm[], raggruppa: boolean): Avviso[] {
  const perTipo = new Map<TipoEvento, EventoCrm[]>();
  for (const e of eventi) {
    const lista = perTipo.get(e.tipo);
    if (lista) lista.push(e);
    else perTipo.set(e.tipo, [e]);
  }

  const avvisi: Avviso[] = [];
  for (const [tipo, lista] of perTipo) {
    const meta = CATALOGO[tipo];
    if (!raggruppa || lista.length === 1) {
      lista.forEach((e) =>
        avvisi.push({
          chiavi: [e.chiave],
          tipo,
          titolo: e.titolo,
          corpo: e.corpo,
          gravita: e.gravita ?? meta.gravita,
          suono: e.suono ?? meta.suono,
          leadId: e.leadId,
          destinazione: e.destinazione,
          quantita: 1,
        }),
      );
      continue;
    }
    // Se anche uno solo del gruppo è urgente, lo è il gruppo: meglio alzare la
    // testa per niente che perdere l'appuntamento che sta iniziando.
    const urgente = lista.some((e) => (e.suono ?? meta.suono) === "urgente");
    const critico = lista.some((e) => (e.gravita ?? meta.gravita) === "critical");
    avvisi.push({
      chiavi: lista.map((e) => e.chiave),
      tipo,
      titolo: meta.titoloGruppo(lista.length),
      corpo: corpoDiGruppo(lista),
      gravita: critico ? "critical" : meta.gravita,
      suono: urgente ? "urgente" : meta.suono,
      destinazione: meta.destinazione,
      quantita: lista.length,
    });
  }

  // Prima i critici: se il tetto per giro taglia qualcosa, deve tagliare le
  // cose che possono aspettare.
  const peso = (g: NotificationSeverity) => (g === "critical" ? 0 : g === "warning" ? 1 : 2);
  return avvisi.sort((a, b) => peso(a.gravita) - peso(b.gravita));
}

function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function gravitaValida(g: string): NotificationSeverity {
  return g === "critical" || g === "warning" ? g : "info";
}

/** Un avviso rimasto in coda torna ad essere un avviso normale: il clic deve
 *  aprire la stessa scheda e segnare letta la stessa riga di storico. */
function daSospeso(s: AvvisoSospeso): Avviso {
  return {
    chiavi: [s.chiave],
    tipo: s.tipo,
    titolo: s.titolo,
    corpo: s.corpo,
    gravita: gravitaValida(s.gravita),
    suono: s.suono === "urgente" ? "urgente" : "discreto",
    leadId: s.leadId,
    destinazione: s.destinazione,
    quantita: s.quantita || 1,
  };
}

/** Il più alto fra i suoni di un gruppo di avvisi: un giro fa un rumore solo. */
function livelloPiuAlto(avvisi: Avviso[], consentito: (a: Avviso) => boolean): LivelloSuono | null {
  let livello: LivelloSuono | null = null;
  for (const a of avvisi) {
    if (!consentito(a)) continue;
    if (a.suono === "urgente") return "urgente";
    livello = "discreto";
  }
  return livello;
}

export function useMotoreNotifiche() {
  const { user } = useAuth();
  const { leads, consultants, loading, reload } = useCRM();
  const ricerca = useRicerca();
  const navigate = useNavigate();

  // I dati cambiano di continuo, il timer no: tenerli in un riferimento evita
  // di smontare e rimontare l'intervallo a ogni carattere digitato altrove.
  const datiRef = useRef({ leads, consultants, loading, user });
  datiRef.current = { leads, consultants, loading, user };

  const ricercaRef = useRef(ricerca);
  ricercaRef.current = ricerca;

  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const ultimaRiletturaRef = useRef(0);

  const inCorsoRef = useRef(false);
  const ultimoGiroRef = useRef(0);

  /** ── COSA SUCCEDE AL CLIC ────────────────────────────────────────────────
   *  Prende DATI, non l'oggetto `Avviso`, e la ragione è il telefono: una
   *  notifica mostrata dal service worker può essere toccata quando la scheda
   *  che l'ha generata è chiusa da un pezzo. In quel momento l'unica cosa
   *  rimasta è ciò che viaggiava dentro la notifica, e deve bastare.
   *  ─────────────────────────────────────────────────────────────────────── */
  const apri = useCallback(
    (d: DatiNotifica) => {
      if (d.idStorico) segnaApertaStorico(d.idStorico);
      // Il clic su una notifica di sistema non porta in primo piano da solo su
      // tutti i browser: `focus()` fa la sua parte quando può.
      try {
        window.focus();
      } catch {
        /* alcuni browser lo vietano fuori da un gesto: pazienza */
      }
      if (d.leadId && (d.quantita ?? 1) === 1) {
        // La scheda si apre SOPRA la pagina in cui si è: chi stava guardando
        // l'agenda non la perde.
        ricercaRef.current.apriLead(d.leadId);
        return;
      }
      void navigate({ to: d.destinazione });
    },
    [navigate],
  );

  const mostra = useCallback((avviso: Avviso, idStorico: string): boolean => {
    if (statoPermesso() !== "concesso") return false;
    // Il canale sceglie da sé la strada: service worker (l'unica che funziona
    // sul telefono) e, se non c'è, `new Notification` sul computer. Se non
    // passa nessuna delle due torna `false` e l'avviso finisce in coda.
    return mostraNotificaSistema(avviso.titolo, {
      corpo: avviso.corpo,
      // `tag` = chiave dell'evento: se per qualunque motivo lo stesso avviso
      // venisse rimostrato, sostituisce il precedente invece di impilarsi.
      tag: avviso.chiavi[0],
      // Solo i critici restano finché non li si guarda: gli altri spariscono da
      // soli, come deve fare un promemoria che non è un allarme.
      insistente: avviso.gravita === "critical",
      dati: {
        idStorico,
        leadId: avviso.leadId,
        destinazione: avviso.destinazione,
        quantita: avviso.quantita,
        chiave: avviso.chiavi[0],
      },
    });
  }, []);

  /** Copia dell'avviso nella tabella `notifications`: così resta nella
   *  campanella in alto e lo si ritrova dagli altri dispositivi. L'indice unico
   *  su (user_id, dedupe_key) fa da guardia contro i doppioni. */
  const salvaADatabase = useCallback(async (userId: string, avviso: Avviso) => {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      kind: avviso.tipo,
      severity: avviso.gravita,
      title: avviso.titolo,
      body: avviso.corpo,
      link: avviso.destinazione,
      dedupe_key: avviso.chiavi[0],
    });
    // 23505 = doppione: è il comportamento previsto, non un guasto.
    if (error && error.code !== "23505") {
      console.warn("[notifiche] storico non salvato:", error.message);
    }
  }, []);

  /** Consegna gli avvisi rimasti in coda dal periodo senza permesso.
   *  Restituisce il livello di suono da emettere e quanti riquadri ha già
   *  occupato: il tetto per giro vale sul totale, non su ogni singola fonte. */
  const consegnaSospesi = useCallback(
    (prefs: ReturnType<typeof leggiPrefs>): { livello: LivelloSuono | null; quanti: number } => {
      const nulla = { livello: null, quanti: 0 };
      const sospesi = leggiSospesi();
      if (sospesi.length === 0) return nulla;
      if (statoPermesso() !== "concesso") return nulla;

      // Un tipo spento nel frattempo non si consegna: la coda non è una
      // scorciatoia per aggirare le preferenze. I critici per primi, perché il
      // tetto per giro vale anche qui.
      const peso = (g: string) => (g === "critical" ? 0 : g === "warning" ? 1 : 2);
      const daConsegnare = sospesi
        .filter((s) => prefs.tipi[s.tipo] !== false)
        .sort((a, b) => peso(a.gravita) - peso(b.gravita))
        .slice(0, MAX_PER_GIRO);

      const consegnati: Avviso[] = [];
      for (const s of daConsegnare) {
        const a = daSospeso(s);
        // L'id della voce di storico è quello di allora: il clic deve segnare
        // letta la riga che è già nella campanella, non crearne una nuova.
        if (mostra(a, s.id)) consegnati.push(a);
      }

      // La coda si svuota di TUTTO ciò che è stato guardato in questo giro —
      // consegnato, scartato per preferenza o tagliato dal tetto. Una coda che
      // non si svuota riproverebbe le stesse righe ogni mezzo minuto.
      togliSospesi(sospesi.map((s) => s.chiave));

      if (consegnati.length === 0) return nulla;
      return {
        livello: livelloPiuAlto(consegnati, (a) => prefs.suoni[a.tipo] !== false),
        quanti: consegnati.length,
      };
    },
    [mostra],
  );

  const giro = useCallback(async () => {
    if (inCorsoRef.current) return;
    const { leads: l, consultants: c, loading: caricando, user: u } = datiRef.current;
    if (!u || caricando) return;
    // Con l'elenco ancora vuoto la "fotografia" sarebbe vuota, e al giro dopo
    // l'intero archivio sembrerebbe appena arrivato.
    if (l.length === 0) return;

    const prefs = leggiPrefs();
    inCorsoRef.current = true;
    try {
      const istantaneaPrima = leggiIstantanea();
      const { eventi, istantanea } = calcolaEventi({
        leads: l,
        consulenti: c,
        ora: new Date(),
        istantanea: istantaneaPrima,
        //  ⚠️ Il regime vero e non più il ripiego: le scadenze IVA di chi
        //   liquida mensilmente cadono in giorni diversi, e un avviso col
        //   calendario sbagliato è peggio di nessun avviso — si impara a non
        //   fidarsi anche di quelli giusti.
        liquidazione: regimeLiquidazione(),
      });

      // A notifiche spente la fotografia si aggiorna lo stesso: se un giorno le
      // si riaccende, non deve arrivare il notiziario di ieri.
      if (!prefs.attive) {
        scriviIstantanea(istantanea);
        return;
      }

      // Il testimone si prende PRIMA di toccare la fotografia: chi non notifica
      // non deve nemmeno aggiornarla. Altrimenti la seconda scheda scriveva
      // "adesso il lead è venduto" un istante prima che la prima se ne
      // accorgesse, e il cambio di stato spariva senza che nessuno lo dicesse.
      if (!prendiTurno()) return;
      scriviIstantanea(istantanea);

      // Prima si salda il debito: ciò che era stato calcolato senza permesso e
      // non è mai arrivato sulla scrivania.
      const { livello: livelloArretrato, quanti: giaOccupati } = consegnaSospesi(prefs);
      /** Quanti riquadri restano in questo giro. Il tetto è sul TOTALE: appena
       *  concesso il permesso arrivano insieme la coda e gli eventi nuovi, e
       *  dieci riquadri in una volta si chiudono in blocco senza leggerli. */
      const spazio = Math.max(0, MAX_PER_GIRO - giaOccupati);

      const daMostrare = eventi.filter(
        (e) =>
          prefs.tipi[e.tipo] !== false &&
          !giaNotificato(e.chiave) &&
          // L'eco delle proprie modifiche non è una notizia: vedi registro.ts.
          !(e.tipo === "cambio_stato" && e.leadId && modificatoQui(e.leadId)),
      );

      if (daMostrare.length === 0) {
        if (prefs.suono && livelloArretrato) suona(livelloArretrato, prefs.volume);
        return;
      }

      const avvisi = impacchetta(daMostrare, prefs.raggruppa);
      // Le chiavi si segnano TUTTE: un evento visto in questo giro non deve
      // ripresentarsi fra trenta secondi.
      segnaNotificati(daMostrare.map((e) => e.chiave));

      const permesso = statoPermesso();
      /** ── QUANDO VALE LA PENA RIPROVARE ──────────────────────────────────────
       *  Un avviso che non è uscito si tiene da parte solo se una prossima volta
       *  può andare diversamente. I casi sono DUE, non uno:
       *   · il permesso non è ancora stato chiesto — può arrivare;
       *   · il permesso c'è GIÀ ma il service worker no. Sul telefono è il caso
       *     normale del primo minuto: registrare il worker costa un giro di rete
       *     e un'attivazione, e finché non è finita `showNotification` non esiste
       *     e `new Notification` lancia.
       *  Prima la coda guardava solo il permesso: con il permesso già concesso e
       *  il worker non ancora pronto, l'avviso non partiva, non finiva in coda e
       *  veniva comunque segnato «già detto». Spariva dalla scrivania per sempre
       *  — ed erano proprio gli avvisi dell'apertura, cioè quelli che contano.
       *
       *  Se invece il permesso è stato negato, o il browser non conosce le
       *  notifiche, non c'è nulla da aspettare: la campanella è la consegna
       *  definitiva e la coda resterebbe piena di roba che non uscirà mai.
       *  ───────────────────────────────────────────────────────────────────── */
      const recuperabile = permesso !== "negato" && permesso !== "non_supportato";

      const voci: VoceStorico[] = [];
      const sospesi: AvvisoSospeso[] = [];
      const mostrati: Avviso[] = [];
      const adesso = new Date().toISOString();

      avvisi.forEach((avviso, indice) => {
        const id = nuovoId();
        // OLTRE IL TETTO si scrive nella campanella ma non sulla scrivania:
        // dieci riquadri sovrapposti non si leggono, si chiudono in blocco. La
        // voce però si scrive SEMPRE — prima gli avvisi oltre il quinto
        // sparivano del tutto, campanella compresa.
        const inScrivania = indice < spazio;
        const arrivato = inScrivania ? mostra(avviso, id) : false;
        if (arrivato) mostrati.push(avviso);

        voci.push({
          id,
          tipo: avviso.tipo,
          titolo: avviso.titolo,
          corpo: avviso.corpo,
          inviataIl: adesso,
          quantita: avviso.quantita,
          leadId: avviso.quantita === 1 ? avviso.leadId : undefined,
          destinazione: avviso.destinazione,
          chiave: avviso.chiavi[0],
          gravita: avviso.gravita,
        });

        if (!arrivato && inScrivania && recuperabile) {
          sospesi.push({
            id,
            chiave: avviso.chiavi[0],
            tipo: avviso.tipo,
            titolo: avviso.titolo,
            corpo: avviso.corpo,
            gravita: avviso.gravita,
            suono: avviso.suono,
            destinazione: avviso.destinazione,
            leadId: avviso.quantita === 1 ? avviso.leadId : undefined,
            quantita: avviso.quantita,
            natoIl: Date.now(),
          });
        }

        if (prefs.salvaStorico && inScrivania) void salvaADatabase(u.id, avviso);
      });

      aggiungiStorico(voci);
      if (sospesi.length > 0) aggiungiSospesi(sospesi);

      // IL SUONO. Si suona per ciò che è ARRIVATO sulla scrivania; se la
      // scrivania non è disponibile e non lo sarà (permesso negato, browser
      // senza notifiche) si suona lo stesso, perché lì il suono più il numero
      // rosso sulla campanella sono l'unico segnale che esiste. Se invece il
      // permesso può ancora arrivare si tace: suonerà alla consegna.
      const definitivo = permesso === "negato" || permesso === "non_supportato";
      const livelloNuovi = livelloPiuAlto(
        definitivo ? avvisi.slice(0, MAX_PER_GIRO) : mostrati,
        (a) => prefs.suoni[a.tipo] !== false,
      );
      // Fra il suono della coda e quello dei nuovi vince il più urgente: è
      // sempre un suono solo per giro.
      const livello =
        livelloArretrato === "urgente" || livelloNuovi === "urgente"
          ? "urgente"
          : (livelloNuovi ?? livelloArretrato);
      // Un suono solo per giro, quello più alto: vedi regola 1 in testa.
      if (prefs.suono && livello) suona(livello, prefs.volume);
    } catch (e) {
      console.warn("[notifiche] giro fallito", e);
    } finally {
      inCorsoRef.current = false;
      ultimoGiroRef.current = Date.now();
    }
  }, [consegnaSospesi, mostra, salvaADatabase]);

  // Il primo gesto dell'utente sblocca l'audio. Va installato una volta sola e
  // il prima possibile: senza, la prima notifica della sessione sarebbe muta.
  useEffect(() => installaSbloccoAudio(), []);

  /** ── IL CANALE DI SISTEMA, ACCESO SUBITO ─────────────────────────────────
   *  Il service worker si registra all'apertura del CRM e non al primo avviso:
   *  la registrazione richiede un giro di rete e un'attivazione, e chiederla
   *  nell'istante in cui serve significa che la PRIMA notifica della giornata
   *  non trova nessuno pronto e non compare. Registrarlo qui, all'ingresso, fa
   *  sì che quando arriva il primo avviso la strada esista già.
   *
   *  Non chiede nessun permesso: registrare un worker è muto, il pop-up lo fa
   *  solo il pulsante "Attiva le notifiche".
   *  ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return;
    void preparaCanaleSistema().then((reg) => {
      // Appena la strada esiste si fa un giro: gli avvisi nati nei primi secondi
      // — quando il worker non era ancora attivo — sono in coda, e aspettare il
      // prossimo scatto del timer vorrebbe dire mezzo minuto di silenzio proprio
      // all'apertura, che è il momento in cui si guarda se funziona.
      if (reg) richiediGiro();
    });
  }, [user]);

  // Il clic su una notifica del service worker non esegue nessun `onclick`
  // della pagina: torna indietro come messaggio, e va tradotto in "apri questa
  // scheda". Senza questo ascolto, sul telefono toccare l'avviso non fa nulla.
  useEffect(() => ascoltaClicNotifica(apri), [apri]);

  /** ── IL CLIC A CRM CHIUSO ────────────────────────────────────────────────
   *  Sul telefono il caso normale è questo: nessuna finestra aperta, si tocca
   *  la notifica e il CRM parte da zero. Lì non c'è nessuno a cui mandare il
   *  messaggio, quindi il service worker mette il lead nell'indirizzo. Qui lo
   *  si raccoglie e si apre la scheda giusta.
   *
   *  Poi l'indirizzo si ripulisce: senza, un aggiornamento della pagina
   *  riaprirebbe la stessa scheda all'infinito, e il collegamento resterebbe
   *  negli appunti di chi lo condivide.
   *  ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!user || loading || leads.length === 0) return;
    const parametri = new URLSearchParams(window.location.search);
    const leadId = parametri.get("lead");
    if (!leadId) return;
    parametri.delete("lead");
    const resto = parametri.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (resto ? `?${resto}` : "") + window.location.hash,
    );
    ricercaRef.current.apriLead(leadId);
  }, [user, loading, leads.length]);

  useEffect(() => {
    if (!user) return;
    void giro();
    const id = setInterval(() => void giro(), PASSO_MS);
    // Tornando sulla scheda dopo ore, i timer sospesi hanno perso dei giri:
    // se ne fa subito uno, altrimenti l'appuntamento delle 15:00 si scopre
    // alle 15:04.
    const alRitorno = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimoGiroRef.current > 10_000) {
        void giro();
      }
    };
    // Il ricalcolo su richiesta salta il controllo dei dieci secondi: qui c'è
    // un utente che ha appena premuto un pulsante e aspetta di vedere l'effetto.
    const suRichiesta = () => void giro();
    document.addEventListener("visibilitychange", alRitorno);
    window.addEventListener("focus", alRitorno);
    window.addEventListener(EVENTO_RICALCOLA, suRichiesta);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alRitorno);
      window.removeEventListener("focus", alRitorno);
      window.removeEventListener(EVENTO_RICALCOLA, suRichiesta);
    };
  }, [user, giro]);

  // Un lead che cambia in questa scheda (stato salvato, acconto inserito) deve
  // produrre l'avviso subito, non al prossimo scatto del timer.
  useEffect(() => {
    if (!user || loading || leads.length === 0) return;
    const t = setTimeout(() => void giro(), 1_500);
    return () => clearTimeout(t);
  }, [leads, loading, user, giro]);

  // Le modifiche degli ALTRI. Senza questo ascolto il CRM resta fermo alla
  // fotografia dell'apertura, e metà degli avvisi richiesti (lead assegnato,
  // cambio di stato) non può esistere. Vedi la nota in testa al file.
  useEffect(() => {
    if (!user) return;
    let attesa: ReturnType<typeof setTimeout> | null = null;
    const chiediRilettura = () => {
      if (attesa) return;
      const ritardo = Math.max(
        PAUSA_RILETTURA_MS,
        MINIMO_FRA_RILETTURE_MS - (Date.now() - ultimaRiletturaRef.current),
      );
      attesa = setTimeout(() => {
        attesa = null;
        ultimaRiletturaRef.current = Date.now();
        // `loading` di CRMContext lo legge solo il motore: una rilettura in
        // sottofondo non fa lampeggiare nessuna pagina.
        void reloadRef.current();
      }, ritardo);
    };
    // Nome del canale casuale: due schede aperte sullo stesso account non
    // devono contendersi la stessa sottoscrizione.
    const canale = supabase
      .channel(`notif-lead-${Math.random().toString(36).slice(2, 8)}`)
      // Nessun filtro: a decidere cosa si può vedere ci pensano già le regole
      // di riga della tabella, e un filtro sbagliato qui vorrebbe dire zero
      // avvisi senza che nulla segnali il perché.
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, chiediRilettura)
      .subscribe();
    return () => {
      if (attesa) clearTimeout(attesa);
      void supabase.removeChannel(canale);
    };
  }, [user]);
}
