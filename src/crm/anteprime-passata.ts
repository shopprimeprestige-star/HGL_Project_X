/** LA PASSATA DELLE ANTEPRIME — la rete sotto al tasto del biglietto
 *  ═══════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️ IL GUASTO CHE QUESTO FILE ESISTE PER CHIUDERE, misurato in produzione:
 *  tredici stanze Meetly nate (`meet:<leadId>`), UNA sola anteprima depositata
 *  (`anteprima:invito:<codice>`). Dodici clienti su tredici, aprendo WhatsApp,
 *  hanno visto la scheda generica del sito al posto del biglietto col loro
 *  nome. Non era cache e non era rete: quel biglietto non è mai stato disegnato.
 *
 *  PERCHÉ. Fino a ieri l'anteprima nasceva SOLO premendo il tasto calendario
 *  sulla riga del lead — il gesto che crea la pagina dell'appuntamento. Chi
 *  manda il link della stanza senza passare di lì (cioè quasi sempre: si avvia
 *  la consulenza, si copia il link, si incolla in chat) non produceva niente.
 *  Il committente ha chiesto che valga per OGNI lead, non per quelli che
 *  qualcuno si ricorda di preparare.
 *
 *  COSA FA QUESTA PASSATA. Quando i lead sono in memoria, guarda chi ha un
 *  appuntamento vero davanti a sé, chiede al server quali di quei link sono
 *  ancora senza immagine, e disegna solo quelli — uno alla volta, con una
 *  pausa in mezzo, senza dire niente a nessuno.
 *
 *  ⚠️ NON SOSTITUISCE IL TASTO. Il tasto calendario resta la strada di chi
 *  vuole ANCHE vedere il biglietto e copiare il link, con il suo avviso quando
 *  fallisce. Questa è la rete sotto: recupera l'arretrato e copre chi il tasto
 *  non lo preme mai.
 *
 *  ⚠️ NON CREA NIENTE. Non chiama /api/crm/invito e non chiama in POST
 *  /api/crm/meeting-session: preparare un'anteprima non è chiedere una
 *  videoconsulenza, e una passata che aprisse una stanza per ogni lead
 *  dell'archivio lascerebbe migliaia di codici veri in giro. Chi non ha né
 *  stanza né pagina invito non ha nessun indirizzo sotto cui depositare, e
 *  resta fuori: per quelli l'anteprima nasce insieme al link, dal punto che il
 *  link lo crea (vedi `depositaAnteprimaPerLead` in anteprima-link.ts).
 *
 *  ⚠️ GIRA SOLO NEL BROWSER. Il disegno vuole i caratteri del documento e il
 *  logo scaricato: da un servitore non si può fare (vedi api.anteprima).
 *
 *  ── CHE COSA QUESTA PASSATA NON COPRE ─────────────────────────────────────
 *  Scritto qui perché è già stato detto sei volte «adesso funziona», e ogni
 *  volta il pezzo scoperto era uno che nessuno aveva messo per iscritto.
 *
 *  1. NON GIRA SE NESSUNO LA MONTA. È un gancio: finché non lo si chiama nel
 *     guscio del CRM (src/routes/CRM.tsx) non succede assolutamente niente, e
 *     il difetto resta identico a prima. Va montato con i lead del contesto,
 *     non con quelli filtrati dalla ricerca.
 *  2. NON GIRA SE IL CRM È CHIUSO. La copertura si muove solo mentre qualcuno
 *     con il permesso «agenda» tiene aperta la scheda del CRM: un
 *     appuntamento fissato dal telefono di un collega alle 23 avrà il suo
 *     biglietto l'indomani, quando qualcuno apre. Prima del link, comunque,
 *     perché il link lo manda una persona che il CRM ce l'ha aperto davanti.
 *  3. NON RIFÀ UN BIGLIETTO GIÀ DEPOSITATO. Se l'appuntamento viene spostato,
 *     l'immagine depositata continua a mostrare la data vecchia: qui si sa
 *     solo SE un'anteprima c'è, non DA QUANDO. A riscriverla è, oggi, il
 *     salvataggio della scheda (LeadDialog deposita di nuovo a ogni
 *     salvataggio con consulente, data e ora) — ma non lo spostamento fatto
 *     da altre strade. Per chiuderlo davvero servirebbe che
 *     /api/crm/anteprime-stato restituisse anche il momento del deposito, da
 *     confrontare con `lead.updated_at`.
 *  4. NON INVENTA UN LINK A CHI NON CE L'HA. Chi non ha né stanza, né pagina
 *     invito, né un link nostro sulla scheda non ha nessun indirizzo sotto cui
 *     depositare: si conta (`senzaCodice` nel rapporto) e si lascia stare.
 *  5. NON PUÒ NIENTE SUI LINK CHE NON SONO NOSTRI. Se sulla scheda c'è un
 *     indirizzo di Google Meet, l'anteprima di quel messaggio la decide Google.
 */
import { useEffect, useRef } from "react";
import { intestazioniCRM, usePuo } from "./AuthContext";
import { depositaAnteprimaBiglietto, type EsitoAnteprima } from "./anteprima-link";
import type { DatiBiglietto } from "./biglietto";
//  Le stesse porte che usano la riga dell'agenda e la pagina pubblica per
//  leggere una data e un'ora dall'archivio. Volutamente LE STESSE: se la
//  passata giudicasse "leggibile" con regole sue, disegnerebbe biglietti dove
//  la pagina non sa cosa scrivere, o li salterebbe dove il tasto invece li fa.
import {
  DURATA_PREDEFINITA,
  dataPulita,
  durataPulita,
  giorniDaOggiInvito,
  istanteInvito,
  nomeDiBattesimo,
  oraPulita,
} from "./invito";
import type { Lead } from "./types";
//  ⚠️ È la STESSA funzione con cui la riga dell'agenda decide se mostrare il
//  tasto «invia il link della stanza» (`haStanzaNostra`), e quindi è la stessa
//  che sa QUALE indirizzo finisce davvero nel messaggio al cliente. Riconosce
//  solo /meetly/… e /videochiamata/…: da un link di Google Meet restituisce
//  stringa vuota, che è esattamente ciò che serve qui.
import { codiceStanzaDi } from "./whatsapp";
import { codicePulito, formattaCodice } from "@/media/galleria";
import { urlPubblico } from "@/lib/sito";

// ── LE MISURE, E PERCHÉ SONO QUESTE ─────────────────────────────────────────

/** Quante anteprime al massimo in una passata.
 *
 *  Sei, e il numero viene dal carico vero del centro: le soglie della
 *  dashboard (`ui.tsx`) dicono che sette consulenze sono una giornata piena e
 *  dodici sono uno sforamento. Una passata non deve poter fare, in un colpo,
 *  più lavoro di quanto ne produca una giornata intera di appuntamenti —
 *  altrimenti la prima apertura del CRM dopo il rilascio disegnerebbe
 *  l'arretrato di mesi tutto insieme, sulla stessa schermata che il consulente
 *  sta usando mentre è al telefono con un cliente.
 *  Il resto non si perde: se la passata si ferma al tetto, la successiva parte
 *  fra un minuto (`RIPRESA_CON_RESTO_MS`) e continua da dove aveva lasciato. */
const TETTO_PER_PASSATA = 6;

/** La pausa fra un biglietto e l'altro.
 *  ⚠️ Ogni biglietto è un disegno SINCRONO su una tela 1920×1080 con caratteri
 *  e logo: mentre gira, la schermata è ferma. Uno non si nota, sei di fila in
 *  un ciclo stretto si vedono come un singhiozzo lungo. Un secondo e due di
 *  quiete in mezzo restituisce il thread all'interfaccia fra un disegno e
 *  l'altro, e la passata resta invisibile — che è il requisito. */
const PAUSA_FRA_BIGLIETTI_MS = 1_200;

/** Quanto si aspetta prima della prima passata dopo il montaggio.
 *  All'apertura del CRM la schermata si sta ancora disegnando e le trattative
 *  stanno arrivando: mettersi a disegnare tele in quel momento è il modo più
 *  sicuro di far sembrare lento il CRM proprio nei cinque secondi in cui
 *  qualcuno lo giudica. */
const ATTESA_PRIMA_PASSATA_MS = 5_000;

/** Il battito che riprova. Non fa niente se non è il momento: è un confronto
 *  fra due numeri, nessuna query e nessun disegno. Serve perché i lead
 *  arrivano DOPO il montaggio (e a ogni realtime), e perché una passata
 *  fermata a metà (scheda in sottofondo, tetto raggiunto) deve poter ripartire
 *  senza che nessuno tocchi niente. */
const PASSO_MS = 30_000;

/** Quando ricominciare, nei tre casi che si presentano davvero. */
const RIPRESA_CON_RESTO_MS = 60_000; //  è rimasto lavoro: si torna subito
const RIPRESA_NORMALE_MS = 5 * 60_000; //  fatto quel che c'era da fare
const RIPRESA_A_VUOTO_MS = 30 * 60_000; //  non mancava niente: si respira

/** Quanti lead per chiamata. È il tetto del contratto della rotta
 *  (POST /api/crm/anteprime-stato): oltre, risponde di no. */
const MAX_PER_BLOCCO = 60;

/** Quanti candidati guardare al massimo in una passata. Quattro blocchi, cioè
 *  quattro chiamate nel caso peggiore — e il caso peggiore è "non manca
 *  niente", perché appena si trovano abbastanza buchi si smette di chiedere.
 *  Duecentoquaranta appuntamenti futuri sono molto più di quanti un centro da
 *  dieci consulenze al giorno ne abbia mai in calendario insieme. */
const MAX_CANDIDATI = MAX_PER_BLOCCO * 4;

/** ⚠️ Dopo due fallimenti di fila la passata si ferma.
 *  Un deposito non fallisce quasi mai "per quel lead": fallisce per la
 *  sessione scaduta o per il permesso mancante, e in quel caso i sei tentativi
 *  successivi sono sei rifiuti identici. Ci si ferma e si riprova al giro
 *  dopo, quando magari la sessione è di nuovo buona. */
const MAX_FALLIMENTI_DI_FILA = 2;

// ── IL RAPPORTO, PERCHÉ IL SILENZIO NON DIVENTI CECITÀ ──────────────────────
//  Questa passata è muta per scelta: nessun messaggio a comparsa, nessun
//  avviso. L'utente non ha chiesto niente in questo momento, e dodici avvisi
//  di fila renderebbero inutilizzabile la schermata (il tasto calendario, che
//  è un gesto voluto, continua invece ad avvisare — è giusto così).
//
//  ⚠️ Ma muta non vuol dire cieca: in questo progetto il silenzio totale ha già
//  fatto perdere sei giri di correzioni, perché "sembrava funzionare" e non
//  depositava niente. Quindi ogni giro lascia due tracce:
//   · una riga `console.debug` con il prefisso [anteprime] — si legge senza
//     preparare niente, basta aprire la console;
//   · lo stesso oggetto appeso a `window.__anteprime`, interrogabile a mano
//     mentre il CRM è aperto (`__anteprime.fallite`, `__anteprime.ultimoMotivo`).
//  Sta su `window` e non fra le esportazioni perché questo file espone una
//  funzione sola — il gancio — e uno stato importabile finirebbe copiato dentro
//  un componente e ridisegnato a ogni render.
interface RapportoPassata {
  /** quante passate sono girate in questa sessione del browser */
  giri: number;
  /** quando è finita l'ultima */
  ultimoGiro: string;
  /** lead con un appuntamento vero davanti */
  candidati: number;
  /** di quelli, quanti risultavano senza anteprima */
  mancanti: number;
  /** biglietti disegnati e depositati */
  depositate: number;
  /** depositi rifiutati o non riusciti */
  fallite: number;
  /** senza stanza e senza pagina invito: nessun indirizzo sotto cui depositare */
  senzaCodice: number;
  /** coperti partendo dal codice che sta nel link della SCHEDA, perché il
   *  server non conosceva nessuna stanza per quel lead (vedi `codiceDelLink`) */
  daLink: number;
  /** ⚠️ Lead che il server NON ha riconosciuto come propri (`sconosciuti` nella
   *  risposta). Deve restare a zero, e se sale non è un dettaglio: vuol dire che
   *  la sessione sta guardando uno studio diverso da quello dei lead che il CRM
   *  ha in memoria, e la rotta risponde `{ ok: true, voci: [] }` — una risposta
   *  perfettamente buona che significa «di questi non so niente».
   *  Senza questo numero il giro riferirebbe «nessun buco», che è esattamente la
   *  bugia costata settimane la prima volta: qualcosa che sembra fatto e non c'è.
   *  Vedi anche dove si sceglie quanto aspettare, più sotto. */
  sconosciuti: number;
  /** mancanti lasciati al giro successivo */
  rimaste: number;
  /** perché il giro è finito: "completo", "tetto", "sottofondo", "smontato",
   *  "errori", "stato-non-letto", "rete-a-risparmio", "studio-diverso" */
  ultimaUscita: string;
  /** l'ultimo motivo leggibile di un fallimento */
  ultimoMotivo: string;
}

const rapporto: RapportoPassata = {
  giri: 0,
  ultimoGiro: "",
  candidati: 0,
  mancanti: 0,
  depositate: 0,
  fallite: 0,
  senzaCodice: 0,
  daLink: 0,
  sconosciuti: 0,
  rimaste: 0,
  ultimaUscita: "",
  ultimoMotivo: "",
};

function pubblicaRapporto(): void {
  if (typeof window !== "undefined") {
    //  Sempre lo STESSO oggetto: chi se lo tiene da parte nella console
    //  continua a vedere i giri successivi invece di una fotografia morta.
    (window as unknown as Record<string, unknown>).__anteprime = rapporto;
  }
  console.debug("[anteprime] giro", { ...rapporto });
}

// ── STATO DELLA SESSIONE ────────────────────────────────────────────────────
//  Fuori dal componente, e non in un `useRef`, per una ragione precisa: il
//  guscio del CRM si rimonta uscendo e rientrando (e due volte di fila in
//  sviluppo, con StrictMode). Con lo stato dentro al componente, ogni rientro
//  sarebbe una passata nuova che ridisegna quello che ha appena disegnato.
//  Qui la passata è una per sessione del browser, e le successive le decide
//  l'orologio.
let inCorso = false;
let nonPrimaDi = 0;

// ── CHI HA DAVVERO UN APPUNTAMENTO ──────────────────────────────────────────

interface Candidato {
  lead: Lead;
  giorno: string;
  ora: string;
  quando: number;
}

/** Lo stesso criterio di `mostraInvito` (MeetGiornalieri): data leggibile, ora
 *  leggibile, giorno non passato. Nient'altro entra — e in particolare qui NON
 *  si guarda `linkMeeting` per sapere se c'è una stanza: quella la sa il
 *  server. Il link della scheda si legge dopo, e solo quando il server dice di
 *  non conoscere nessuna stanza (vedi `codiceDelLink`).
 *
 *  Due condizioni in più rispetto al tasto, e sono utili qui:
 *   · il nome deve esserci. `nomeDiBattesimo` restituisce stringa vuota quando
 *     la scheda non ha né nome né cognome (capita negli import): un biglietto
 *     che saluta nessuno è peggio della scheda generica, che almeno è pulita;
 *   · si ordina per imminenza. Il tetto per passata taglia la coda, e se
 *     qualcuno deve aspettare il giro dopo è giusto che sia l'appuntamento di
 *     fra tre settimane, non quello di stamattina. */
function candidatiDa(leads: Lead[]): Candidato[] {
  const out: Candidato[] = [];
  for (const lead of leads) {
    const giorno = dataPulita(lead?.data?.dataMeeting);
    if (!giorno) continue;
    const ora = oraPulita(lead?.data?.oraMeeting);
    if (!ora) continue;
    //  `giorniDaOggiInvito` è la porta condivisa: restituisce NaN quando la
    //  data non si legge, e NaN >= 0 è falso. Vale come il confronto
    //  `giorno >= oggiLocale()` della riga, senza riscrivere qui la
    //  costruzione di "oggi" — che è il punto in cui si sbaglia il fuso.
    if (!(giorniDaOggiInvito(giorno) >= 0)) continue;
    if (!nomeDiBattesimo(lead?.data?.nome, lead?.data?.cognome)) continue;
    //  ⚠️ `istanteInvito` può restituire NaN, e un NaN qui non si vede: non
    //  rompe niente, non compare nel rapporto, e siccome `NaN - x` è ancora NaN
    //  il confronto qui sotto smette di essere coerente. Con un confronto
    //  incoerente l'ordinamento non "sbaglia una riga": restituisce un ordine
    //  arbitrario per TUTTO l'elenco, e il tetto di sei taglierebbe a caso —
    //  l'appuntamento di stamattina lasciato indietro e quello di fra un mese
    //  fatto per primo, senza che nessuno riesca a spiegarsi il perché.
    //  In fondo alla fila, che è dove sta un appuntamento di cui non si sa il
    //  momento: entra solo se avanza posto.
    const quando = istanteInvito(giorno, ora);
    out.push({
      lead,
      giorno,
      ora,
      quando: Number.isFinite(quando) ? quando : Number.MAX_SAFE_INTEGER,
    });
  }
  out.sort((a, b) => a.quando - b.quando);
  return out.slice(0, MAX_CANDIDATI);
}

// ── COSA MANCA, CHIESTO IN BLOCCO ───────────────────────────────────────────

/** La risposta della rotta, come contratto. Si tipizza al minimo e si legge in
 *  difesa: questa rotta può essere più nuova o più vecchia del CRM che gira
 *  nella scheda aperta da stamattina. */
interface VoceStato {
  leadId?: string;
  /** il codice della stanza Meetly, stringa vuota se non c'è */
  stanza?: string;
  /** il codice della pagina invito, stringa vuota se non c'è */
  invito?: string;
  /** vero se un'anteprima esiste già sotto uno qualsiasi dei due codici */
  ha?: boolean;
  /** ⚠️ Quali dei due codici sono SCOPERTI, uno per uno. È il campo che conta,
   *  e `ha` da solo non basta: il cliente riceve DUE link diversi per lo stesso
   *  appuntamento — la pagina (/invito/…) e la stanza (/meetly/…) — e `ha` è
   *  vero anche quando uno solo dei due è coperto. Il caso vero è proprio
   *  questo: la stanza ha il biglietto (lo deposita chi la crea) e la pagina
   *  dell'invito, nata dopo, no. Con il solo `ha` quel lead risultava «a posto»
   *  e nessuno gli avrebbe più guardato l'altro link — cioè il difetto di
   *  partenza, mascherato meglio.
   *  Manca sulle rotte più vecchie di questo file: vedi `scopertiDi`. */
  mancanti?: unknown;
}

/** Chiede lo stato di un blocco di lead. `null` significa "non l'ho saputo" —
 *  che è diverso da "non manca niente" e diverso da "manca tutto".
 *  ⚠️ Su una risposta illeggibile NON si tira a indovinare: dire "presente"
 *  nasconderebbe per sempre i lead da sistemare, dire "mancante" scatenerebbe
 *  una tempesta di disegni. Si smette e si riprova al giro dopo. */
async function statoDi(ids: string[]): Promise<VoceStato[] | null> {
  try {
    const r = await fetch("/api/crm/anteprime-stato", {
      method: "POST",
      //  Senza intestazioni la rotta risponde 401 (chiede il permesso
      //  «agenda»), esattamente come le sorelle /api/crm/*.
      headers: await intestazioniCRM({ "Content-Type": "application/json" }),
      body: JSON.stringify({ leadIds: ids }),
    });
    //  ⚠️ `.json()` su una risposta che non è JSON lancia: capita con un 404
    //  (rotta non ancora pubblicata) o con una pagina di errore del proxy. Sta
    //  dentro il try apposta, e il giro finisce con un motivo leggibile invece
    //  che con un errore in console che nessuno collega a questa funzione.
    const dati = (await r.json()) as {
      ok?: boolean;
      reason?: string;
      voci?: VoceStato[];
      sconosciuti?: unknown;
    };
    if (!dati?.ok || !Array.isArray(dati.voci)) {
      rapporto.ultimoMotivo = String(dati?.reason || `risposta ${r.status}`);
      return null;
    }
    //  ⚠️ Un lead che il server non riconosce come proprio NON torna fra le
    //  `voci`: la risposta resta `ok`, semplicemente è più corta di quanto si è
    //  chiesto. Senza contarli qui, uno studio sbagliato — sessione di un'altra
    //  installazione, `adminUserId` che non combacia — si presenterebbe come
    //  «nessun buco da riempire», cioè come successo. È il travestimento
    //  esatto del guasto di partenza, e va misurato.
    if (Array.isArray(dati.sconosciuti)) rapporto.sconosciuti += dati.sconosciuti.length;
    return dati.voci;
  } catch (e) {
    rapporto.ultimoMotivo = e instanceof Error && e.message ? e.message : "stato non raggiungibile";
    return null;
  }
}

// ── L'INDIRIZZO SOTTO CUI DEPOSITARE ────────────────────────────────────────

/** ⚠️ LA TRAPPOLA PIÙ COSTOSA DI TUTTE, e vale la pena scriverla per esteso.
 *  L'anteprima si cerca sotto il codice COSÌ COM'È NELL'INDIRIZZO: le pagine
 *  mettono in `og:image` il parametro della rotta tale e quale, e nessuno lo
 *  normalizza da nessuna parte. Ma il codice dell'invito è salvato SENZA
 *  trattini (`ACDEF3HJKMN7`) mentre nel link viaggia a gruppi di quattro
 *  (`/invito/ACDE-F3HJ-KMN7`). Depositare sotto la forma salvata significa
 *  depositare un'immagine che nessuna pagina chiederà mai: si vedrebbe il
 *  logo, e il deposito risulterebbe fatto.
 *  Qui si riporta il codice alla forma dell'indirizzo, qualunque delle due
 *  forme arrivi dalla rotta — `codicePulito` accetta anche quella già a
 *  trattini, quindi il passaggio è idempotente. Se non è un codice nostro
 *  (lunghezza o alfabeto sbagliati) si usa quello che è arrivato, senza
 *  aggiustarlo: indovinare un codice vuol dire depositare l'immagine di un
 *  cliente sotto il link di un altro. */
function linkInvitoDa(codice: unknown): string {
  const grezzo = String(codice ?? "").trim();
  if (!grezzo) return urlPubblico("");
  const pulito = codicePulito(grezzo);
  return urlPubblico(`invito/${pulito ? formattaCodice(pulito) : grezzo}`);
}

/** ── QUALI DEI DUE LINK SONO DAVVERO SCOPERTI ──────────────────────────────
 *  Non è `!ha`, e la differenza è tutta la copertura.
 *
 *  Il cliente riceve DUE indirizzi per lo stesso appuntamento e ognuno cerca
 *  l'immagine sotto il proprio codice: la stanza `/meetly_/kfr-mbqd-tzp` e la
 *  pagina `/invito/ACDE-F3HJ-KMN7`. `ha` risponde «uno dei due ce l'ha», che
 *  come misura di copertura è a metà — e a metà, qui, vuol dire un cliente su
 *  due che vede la scheda generica.
 *
 *  ⚠️ MA I DUE CASI NON SONO SIMMETRICI, e vale la pena scriverlo perché è la
 *  ragione per cui questa funzione non restituisce semplicemente tutti i codici
 *  senza immagine:
 *   · stanza scoperta e invito coperto → il link della stanza è servito
 *     ugualmente: api.og.anteprima, quando sotto il codice della stanza non
 *     trova niente, risale stanza → lead → invito e consegna quel biglietto.
 *     Rifarlo qui sarebbe disegnare e spedire per qualcosa che si vede già.
 *   · invito scoperto e stanza coperta → NESSUNO lo salva. La risalita cerca
 *     un `meet:` che contenga il codice dell'invito e non lo trova mai (sono
 *     due codici di alfabeti diversi), quindi la pagina dell'appuntamento
 *     mostra il marchio dello studio. È il buco che `ha` nascondeva.
 *
 *  Se `mancanti` non c'è (rotta più vecchia di questo file) si ricade su `ha`,
 *  che è meno preciso ma non inventa niente. */
function scopertiDi(v: VoceStato): { stanza: string; invito: string } {
  const stanza = String(v?.stanza || "").trim();
  const invito = String(v?.invito || "").trim();
  const elenco = Array.isArray(v?.mancanti) ? v.mancanti.map((x) => String(x ?? "").trim()) : null;
  //  ⚠️ `mancanti` si consulta solo per i due codici che la rotta stessa ha
  //  dichiarato: un codice arrivato di lì che non è né la stanza né l'invito di
  //  questo lead non si deposita, perché depositare sotto un codice non nostro
  //  è mettere il biglietto di una persona sul link di un'altra.
  const manca = (c: string) => (elenco ? elenco.includes(c) : !v?.ha);
  const invitoScoperto = invito && manca(invito) ? invito : "";
  const invitoSalva = !!invito && !manca(invito);
  return { stanza: stanza && manca(stanza) && !invitoSalva ? stanza : "", invito: invitoScoperto };
}

/** ── LA STANZA CHE IL SERVER NON CONOSCE, MA IL CLIENTE SÌ ─────────────────
 *  ⚠️ Il tasto «invia il link della stanza» non manda il codice di `meet:<lead>`:
 *  manda quello scritto in `linkMeeting` sulla scheda (vedi `linkStanzaDi` in
 *  whatsapp.ts). Di norma sono lo stesso codice, perché chi crea la stanza
 *  riscrive anche il link sulla scheda. Non sempre: negli archivi importati e
 *  nei ripristini ci sono schede con un `/videochiamata/…` o un `/meetly/…`
 *  arrivato da prima, senza nessuna riga `meet:` che gli corrisponda. Per quei
 *  lead il server risponde «nessuna stanza», la risalita dell'anteprima non ha
 *  niente da risalire, e il link che il cliente riceve è scoperto per sempre.
 *
 *  Si guarda SOLO quando il server non conosce nessuna stanza: se una riga
 *  `meet:` c'è, comanda quella. `codiceStanzaDi` restituisce stringa vuota da
 *  un indirizzo di Google Meet, che è il motivo per cui `linkMeeting` non si
 *  legge mai a mano in questo file. */
function codiceDelLink(lead: Lead): string {
  return String(codiceStanzaDi(lead?.data || {}) || "").trim();
}

/** I codici presi dal link della scheda che risultano già coperti: si chiedono
 *  una volta per sessione del browser e poi si lasciano stare. */
const dalLinkGiaCoperti = new Set<string>();

/** C'è già un'anteprima sotto questo codice? `null` = non si è saputo.
 *  ⚠️ Questa domanda si fa SOLO per i codici che non passano da
 *  /api/crm/anteprime-stato (quelli letti dal link della scheda): una chiamata
 *  per lead è esattamente ciò che quella rotta esiste per evitare. */
async function anteprimaEsiste(codice: string): Promise<boolean | null> {
  try {
    const r = await fetch(`/api/anteprima?tipo=invito&codice=${encodeURIComponent(codice)}`);
    //  404 «assente» è una risposta, non un guasto: è il modo in cui questa
    //  rotta dice che sotto quel codice non c'è niente.
    if (r.status === 404) return false;
    const d = (await r.json()) as { ok?: boolean; url?: string };
    return d?.ok && d.url ? true : false;
  } catch {
    return null;
  }
}

/** ── LA CONNESSIONE DEL CONSULENTE NON È NOSTRA ────────────────────────────
 *  ⚠️ Ogni biglietto è un invio da circa duecento chilobyte, e sei per passata
 *  fanno più di un mega di dati che nessuno ha chiesto in quel momento. Su un
 *  telefono in giro — che è dove il CRM si apre per guardare l'agenda fra un
 *  cliente e l'altro — è roba che si paga.
 *  Se il browser dice che l'utente ha chiesto il risparmio dati, o che la rete
 *  è di seconda generazione, la passata non parte: nessuno sta aspettando
 *  questo lavoro, e la stessa passata girerà dal computer dello studio.
 *  `navigator.connection` non esiste su tutti i browser (su quelli Apple no):
 *  quando non c'è si procede, come si è sempre fatto. */
function retePovera(): boolean {
  const n = typeof navigator === "undefined" ? null : navigator;
  const rete = (n as unknown as { connection?: { saveData?: boolean; effectiveType?: string } })
    ?.connection;
  if (!rete) return false;
  if (rete.saveData === true) return true;
  return rete.effectiveType === "slow-2g" || rete.effectiveType === "2g";
}

// ── LA PASSATA ──────────────────────────────────────────────────────────────

const dormi = (ms: number) => new Promise<void>((ris) => setTimeout(ris, ms));

/** La scheda in sottofondo non è il posto in cui disegnare: il browser
 *  strozza i timer, le tele di una scheda nascosta possono non essere
 *  disegnate affatto, e soprattutto non c'è nessuna fretta — nessuno sta
 *  aspettando questo lavoro. Si smette e si riprende quando si torna. */
const inPrimoPiano = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

async function unaPassata(
  leggiLeads: () => Lead[],
  leggiNome: () => ((l: Lead) => string | undefined) | undefined,
  vivo: () => boolean,
): Promise<void> {
  const tutti = leggiLeads();
  //  Al montaggio le trattative non sono ancora arrivate: una passata adesso
  //  girerebbe su zero lead e brucerebbe la finestra di attesa senza fare
  //  niente. Non si segna nemmeno il giro — non è un giro, è un "non ancora".
  if (tutti.length === 0) return;

  //  Rete a risparmio: si rimanda, e lo si scrive. Non è un giro andato male,
  //  è un giro che non si è voluto fare — e senza questa riga nel rapporto
  //  sembrerebbe che la passata non parta mai per un guasto.
  if (retePovera()) {
    rapporto.ultimaUscita = "rete-a-risparmio";
    nonPrimaDi = Date.now() + RIPRESA_NORMALE_MS;
    pubblicaRapporto();
    return;
  }

  inCorso = true;
  rapporto.giri += 1;
  rapporto.candidati = 0;
  rapporto.mancanti = 0;
  rapporto.depositate = 0;
  rapporto.fallite = 0;
  rapporto.senzaCodice = 0;
  rapporto.daLink = 0;
  rapporto.sconosciuti = 0;
  rapporto.rimaste = 0;
  rapporto.ultimaUscita = "completo";

  try {
    const candidati = candidatiDa(tutti);
    rapporto.candidati = candidati.length;
    if (!candidati.length) {
      nonPrimaDi = Date.now() + RIPRESA_A_VUOTO_MS;
      return;
    }

    //  ── 1. CHI È SCOPERTO ────────────────────────────────────────────────
    //  A blocchi, perché la rotta ne accetta sessanta per volta, e ci si ferma
    //  appena si sono trovati abbastanza buchi da riempire il tetto: cercarne
    //  altri sarebbe chiedere al server un elenco che questa passata non
    //  guarderà comunque.
    const perId = new Map(candidati.map((c) => [c.lead.id, c]));
    //  Per ogni lead da sistemare si portano dietro SOLO i codici scoperti:
    //  `stanza` e `invito` sono quelli da coprire adesso, `dalLink` è il codice
    //  letto dalla scheda quando il server non conosce nessuna stanza (si
    //  verifica più giù, una chiamata sola e solo per quei pochi).
    const daFare: { c: Candidato; stanza: string; invito: string; dalLink: string }[] = [];
    let restanti = 0;
    //  ⚠️ Fermarsi al tetto lascia indietro anche i blocchi che non si sono
    //  nemmeno chiesti: senza questa bandiera la passata direbbe "completo" e
    //  aspetterebbe cinque minuti, quando invece sa benissimo di aver guardato
    //  solo i primi sessanta. Un arretrato di mesi si smaltirebbe al
    //  rallentatore, e la misura del rapporto direbbe la cosa sbagliata.
    let altroDaGuardare = false;

    for (let i = 0; i < candidati.length; i += MAX_PER_BLOCCO) {
      if (!vivo()) {
        rapporto.ultimaUscita = "smontato";
        return;
      }
      if (!inPrimoPiano()) {
        rapporto.ultimaUscita = "sottofondo";
        nonPrimaDi = Date.now() + RIPRESA_CON_RESTO_MS;
        return;
      }
      const blocco = candidati.slice(i, i + MAX_PER_BLOCCO);
      const voci = await statoDi(blocco.map((c) => c.lead.id));
      if (!voci) {
        //  Non si sa: non si disegna niente, non si segna niente come a posto.
        rapporto.ultimaUscita = "stato-non-letto";
        nonPrimaDi = Date.now() + RIPRESA_NORMALE_MS;
        return;
      }
      for (const v of voci) {
        const c = perId.get(String(v?.leadId || ""));
        if (!c) continue;
        const { stanza, invito } = scopertiDi(v);
        //  Il server non conosce nessuna stanza per questo lead: se sulla
        //  scheda c'è comunque un link nostro, quello è l'indirizzo che il
        //  cliente riceve, e per lui non c'è nessuna risalita che tenga.
        //  Vale anche a invito coperto: sono due link diversi.
        const suScheda = String(v?.stanza || "").trim() ? "" : codiceDelLink(c.lead);
        const dalLink = suScheda && !dalLinkGiaCoperti.has(suScheda) ? suScheda : "";

        //  Nessun indirizzo, da nessuna parte: non esiste niente sotto cui
        //  depositare, e questa passata non crea né stanze né inviti (vedi
        //  l'intestazione). Si conta, perché è la misura di quanti lead il
        //  biglietto non possono averlo finché nessuno crea il loro link.
        if (!String(v?.stanza || "").trim() && !String(v?.invito || "").trim() && !suScheda) {
          rapporto.mancanti += 1;
          rapporto.senzaCodice += 1;
          continue;
        }
        //  Tutti i link di questo lead sono coperti (o li copre la risalita):
        //  non è un buco e non si conta come tale.
        if (!stanza && !invito && !dalLink) continue;

        rapporto.mancanti += 1;
        if (daFare.length < TETTO_PER_PASSATA) daFare.push({ c, stanza, invito, dalLink });
        else restanti += 1;
      }
      if (daFare.length >= TETTO_PER_PASSATA) {
        altroDaGuardare = i + MAX_PER_BLOCCO < candidati.length;
        break;
      }
    }

    if (!daFare.length) {
      //  ⚠️ «Niente da fare» ha due cause diverse che si somigliano solo da
      //  fuori. Se il server non ha riconosciuto NESSUNO dei lead che gli
      //  abbiamo passato, non è che i biglietti ci sono: è che stiamo chiedendo
      //  di uno studio e guardando i lead di un altro. Dormirci sopra mezz'ora
      //  dicendo "completo" nasconderebbe una configurazione rotta dietro una
      //  riga di rapporto tranquilla — si dice com'è, e si riprova prima.
      if (rapporto.sconosciuti && !rapporto.mancanti) {
        rapporto.ultimaUscita = "studio-diverso";
        rapporto.ultimoMotivo = `${rapporto.sconosciuti} lead non risultano di questo studio`;
      }
      //  Nessun buco riempibile: il caso normale, dal secondo giorno in poi.
      const daRifare = rapporto.mancanti || rapporto.sconosciuti;
      nonPrimaDi = Date.now() + (daRifare ? RIPRESA_NORMALE_MS : RIPRESA_A_VUOTO_MS);
      return;
    }

    //  ── 2. UNO ALLA VOLTA ────────────────────────────────────────────────
    const nomeDi = leggiNome();
    let diFila = 0;

    for (const { c, stanza, invito, dalLink } of daFare) {
      if (!vivo()) {
        rapporto.ultimaUscita = "smontato";
        return;
      }
      //  ⚠️ Il controllo sta QUI, dentro il ciclo, e non solo all'inizio: fra
      //  un biglietto e l'altro passa più di un secondo, e in un secondo si
      //  cambia scheda. Disegnare su una tela di una scheda nascosta è lavoro
      //  buttato nel migliore dei casi.
      if (!inPrimoPiano()) {
        rapporto.ultimaUscita = "sottofondo";
        nonPrimaDi = Date.now() + RIPRESA_CON_RESTO_MS;
        return;
      }

      //  ⚠️ Il codice letto dalla scheda non è passato dalla rotta, quindi di
      //  lui non si sa se un'anteprima ci sia già: si chiede prima di
      //  disegnare. Se la risposta non arriva NON si indovina — depositare a
      //  vuoto ogni cinque minuti su una connessione di telefono è il modo di
      //  farsi togliere questa passata.
      let stanzaDaCoprire = stanza;
      if (!stanzaDaCoprire && dalLink) {
        const cè = await anteprimaEsiste(dalLink);
        if (cè === false) {
          stanzaDaCoprire = dalLink;
          rapporto.daLink += 1;
        } else if (cè === true) {
          //  C'era: non si tocca più per tutta la sessione.
          dalLinkGiaCoperti.add(dalLink);
        }
      }
      //  Può succedere: l'unico buco era il codice della scheda e si è
      //  scoperto che buco non era. Nessun disegno, nessuna pausa.
      if (!stanzaDaCoprire && !invito) continue;

      const l = c.lead;
      const dati: DatiBiglietto = {
        //  Solo il nome di battesimo, la stessa regola della pagina pubblica:
        //  un'immagine si inoltra, e il cognome di una persona che sta
        //  valutando un trapianto non deve viaggiare.
        nome: nomeDiBattesimo(l.data?.nome, l.data?.cognome),
        giorno: c.giorno,
        ora: c.ora,
        durataMinuti: durataPulita(l.data?.durataMeeting) || DURATA_PREDEFINITA,
        //  Il nome del consulente non sta sul lead ma nell'anagrafica: lo
        //  risolve chi ci passa i lead (in CRM.index.tsx è già una funzione
        //  sola). Se manca, il biglietto esce senza firma invece di sbagliarla.
        consulente: nomeDi?.(l),
        //  ⚠️ Qui vanno SOLO i codici scoperti, non tutti quelli che il lead
        //  possiede: `depositaAnteprimaBiglietto` fa un invio per ognuno di
        //  questi due, e rispedire un'immagine identica sopra una che c'è già
        //  è banda del consulente spesa per niente. Sotto quali codici
        //  depositare non si deduce: lo dicono la rotta (`mancanti`) e, quando
        //  la rotta non conosce nessuna stanza, il link della scheda.
        link: invito ? linkInvitoDa(invito) : urlPubblico(""),
        stanza: stanzaDaCoprire,
      };

      //  L'esito si raccoglie in un oggetto e non in due variabili sciolte:
      //  scritte da dentro la funzione di richiamo, il compilatore continuerebbe
      //  a crederle ferme al valore iniziale e il confronto qui sotto
      //  risulterebbe impossibile.
      const esito: { stato: EsitoAnteprima; motivo: string } = { stato: "", motivo: "" };
      await depositaAnteprimaBiglietto(dati, (s, m) => {
        esito.stato = s;
        if (m) esito.motivo = m;
      });

      if (esito.stato === "errore") {
        rapporto.fallite += 1;
        rapporto.ultimoMotivo = esito.motivo || "motivo sconosciuto";
        diFila += 1;
        if (diFila >= MAX_FALLIMENTI_DI_FILA) {
          rapporto.ultimaUscita = "errori";
          nonPrimaDi = Date.now() + RIPRESA_NORMALE_MS;
          return;
        }
      } else {
        //  "fatta" comprende anche il caso "già depositata in questa sessione"
        //  (anteprima-link tiene un elenco suo): è comunque un buco chiuso.
        rapporto.depositate += 1;
        diFila = 0;
        //  ⚠️ Il codice preso dalla scheda non passa dalla rotta: se non lo si
        //  segnasse qui, la passata successiva lo troverebbe di nuovo «da
        //  guardare» e brucerebbe uno dei sei posti solo per richiedere al
        //  server una cosa che ha appena fatto lei.
        if (dalLink && stanzaDaCoprire === dalLink) dalLinkGiaCoperti.add(dalLink);
      }

      await dormi(PAUSA_FRA_BIGLIETTI_MS);
    }

    //  `rimaste` conta i buchi già visti e non riempiti; `altroDaGuardare` dice
    //  che ce ne potrebbero essere altri fra i candidati mai chiesti. Bastano
    //  l'uno o l'altro per tornare fra un minuto invece che fra cinque.
    rapporto.rimaste = restanti;
    const resta = restanti > 0 || altroDaGuardare;
    if (resta) rapporto.ultimaUscita = "tetto";
    nonPrimaDi = Date.now() + (resta ? RIPRESA_CON_RESTO_MS : RIPRESA_NORMALE_MS);
  } finally {
    inCorso = false;
    rapporto.ultimoGiro = new Date().toISOString();
    pubblicaRapporto();
  }
}

// ── IL GANCIO ───────────────────────────────────────────────────────────────

/** ── LA PASSATA AUTOMATICA DELLE ANTEPRIME ─────────────────────────────────
 *  Si monta una volta sola, nel guscio del CRM: lì i lead sono TUTTI quelli
 *  del contesto (non quelli filtrati dalla ricerca, non quelli del giorno
 *  mostrato) e il componente sopravvive al cambio di pagina. Montarla dentro
 *  l'agenda vorrebbe dire che scrivere tre lettere nel campo di ricerca decide
 *  a quali clienti tocca il biglietto.
 *
 *  Non disegna niente e non dice niente: vedi il rapporto qui sopra per come
 *  si controlla che stia lavorando (`window.__anteprime`).
 *
 *  @param leads          le trattative del contesto, non filtrate
 *  @param nomeConsulente da lead a nome del consulente — il nome sta
 *                        nell'anagrafica, non sul lead
 *
 *  ⚠️ SI CHIAMA `usePassataAnteprime` QUI DENTRO, e si esporta col nome
 *  italiano qui sotto. Non è un vezzo: il controllo che verifica le regole
 *  degli hook (react-hooks/rules-of-hooks) riconosce un gancio dal nome, e su
 *  una funzione che non comincia per `use` smette di guardare — proprio dentro
 *  l'unica funzione di questo file in cui ci sono hook, cioè dove serve. Fra
 *  zittire il controllo e cambiare un nome, si cambia il nome. */
function usePassataAnteprime(
  leads: Lead[],
  nomeConsulente?: (l: Lead) => string | undefined,
): void {
  //  ⚠️ Gli hook stanno tutti qui sopra, prima di qualunque uscita: il
  //  permesso può cambiare mentre il CRM è aperto (rientro con un altro PIN) e
  //  un `return` anticipato prima di un hook cambierebbe il loro numero.
  const puo = usePuo();
  const puoAgenda = puo("agenda");

  //  ⚠️ I lead NON possono stare fra le dipendenze dell'effetto. Cambiano
  //  identità a ogni salvataggio e a ogni rilettura realtime (motore.ts tiene
  //  un canale aperto su crm_leads): con `leads` fra le dipendenze l'effetto si
  //  smonterebbe e rimonterebbe di continuo, il battito verrebbe azzerato ogni
  //  volta e non arriverebbe MAI a scattare. È lo stesso guasto già
  //  documentato in useNotificationTriggers.ts. Qui i dati stanno in un
  //  riferimento, e il timer resta uno solo per tutta la sessione.
  const leadsRef = useRef(leads);
  leadsRef.current = leads;
  const nomeRef = useRef(nomeConsulente);
  nomeRef.current = nomeConsulente;

  useEffect(() => {
    //  ⚠️ Il deposito (`POST /api/anteprima`, tipo «invito») chiede il permesso
    //  «agenda», lo stesso della rotta che elenca i buchi. Girare senza vuol
    //  dire produrre una fila di rifiuti identici: si sta fermi.
    if (!puoAgenda) return;

    let vivo = true;
    const chiVive = () => vivo;
    const leggiLeads = () => leadsRef.current;
    const leggiNome = () => nomeRef.current;

    /** Un tentativo: costa due confronti quando non è il momento. */
    const forse = () => {
      if (!vivo || inCorso) return;
      if (Date.now() < nonPrimaDi) return;
      if (!inPrimoPiano()) return;
      //  Se qualcosa qui dentro esplodesse, il guscio del CRM non deve cadere
      //  con lui: un'anteprima mancante è un fastidio, una schermata bianca è
      //  il lavoro fermo.
      void unaPassata(leggiLeads, leggiNome, chiVive).catch((e: unknown) => {
        inCorso = false;
        rapporto.ultimaUscita = "errore-inatteso";
        rapporto.ultimoMotivo = e instanceof Error && e.message ? e.message : String(e);
        nonPrimaDi = Date.now() + RIPRESA_NORMALE_MS;
        pubblicaRapporto();
      });
    };

    const primo = setTimeout(forse, ATTESA_PRIMA_PASSATA_MS);
    const battito = setInterval(forse, PASSO_MS);
    //  Chi torna sulla scheda dopo un'ora è, molto spesso, chi nel frattempo ha
    //  fissato appuntamenti da un'altra parte: è il momento buono per guardare,
    //  senza aspettare il battito successivo.
    const alRitorno = () => {
      if (inPrimoPiano()) forse();
    };
    document.addEventListener("visibilitychange", alRitorno);
    window.addEventListener("focus", alRitorno);

    return () => {
      //  ⚠️ `vivo` è la sola cosa che ferma una passata già partita: il ciclo
      //  lo controlla prima di ogni biglietto, così non si disegna né si
      //  deposita per conto di un componente che non c'è più.
      vivo = false;
      clearTimeout(primo);
      clearInterval(battito);
      document.removeEventListener("visibilitychange", alRitorno);
      window.removeEventListener("focus", alRitorno);
    };
  }, [puoAgenda]);
}

/** Il nome con cui la si monta nel guscio. È l'unica cosa che questo file
 *  esporta: tutto il resto (misure, rapporto, criterio dei candidati) è
 *  dettaglio interno, e un pezzo di stato importabile finirebbe copiato dentro
 *  un componente e ricalcolato a ogni render. */
export const usaPassataAnteprime = usePassataAnteprime;
