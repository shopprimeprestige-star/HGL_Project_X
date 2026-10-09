// Sessione "diretta live" condivisa tra le pagine (preventivo, presentazione video).
// Un solo id per sessione (in localStorage): il link inviato al cliente vale per
// qualsiasi pagina, e quando il presentatore cambia pagina il cliente la segue.
import { useEffect, useState } from "react";
//  Chi ha il proprio preventivo acceso non si porta in giro: vedi il cartello
//  in shop/mio-preventivo.
import { restaSulMioPreventivo } from "@/shop/mio-preventivo";
import { useNavigate } from "@tanstack/react-router";
import { indirizzoPerIlCliente, paginaMostrabile, pezziPagina, stessaSchermata } from "./pagina-condivisa";
import { supabase } from "@/integrations/supabase/client";
/*  ── ⚠️ QUI NON SI IMPORTA IL MOTORE DELLA CONSULENZA ─────────────────────
    Misurato: il CRM importa questo file (per fare il link di un preventivo), e
    finché questo file importava `shop/call` ogni apertura del CRM scaricava e
    interpretava 254 kB di videochiamata per niente. Le tre cose che servivano
    al motore ora arrivano da tre file piccoli, che il motore riempie quando
    c'è (vedi shop/link-ospite). */
import { miaPersonaDi } from "@/shop/gettone-cliente";
import { annunciaPaginaCambiata } from "@/shop/annuncio-pagina";
import { azzeraZoomDelCliente } from "@/shop/zoom-ospite";
import { ascoltaStatoStanza, statoStanzaOra } from "@/shop/stato-stanza";

export const LIVE_KEY = "hg_live_session";
const listeners = new Set<(id: string | null) => void>();
const emit = () => {
  const id = getLiveId(); listeners.forEach((cb) => cb(id));
  // avvisa subito il motore chiamata (CallMount) senza aspettare il polling
  if (typeof window !== "undefined") { try { window.dispatchEvent(new Event("hg-live-change")); } catch { /* */ } }
};

export function getLiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LIVE_KEY);
}
export function setPresenterPage(path: string) {
  /*  ── ⚠️ NON SI CONDIVIDE UNA SCHERMATA INTERNA ──────────────────────────
      Segnalazione del committente: il cliente vedeva l'elenco dei nomi e il
      campo del PIN. Questa funzione viene chiamata anche con l'indirizzo in
      cui il consulente si trova quando AVVIA la consulenza (vedi `startLive` e
      `newLiveId`): se in quel momento è sul cancello dei presentatori, quel
      cancello diventa la pagina che il cliente segue — e quelle schermate non
      hanno una modalità cliente, quindi si aprono come sono.
      Si scrive solo ciò che è fatto per essere guardato da un cliente. */
  if (!paginaMostrabile(path)) {
    console.warn(`[LIVE] pagina non condivisibile, non la registro: ${path}`);
    return;
  }
  //  Si toglie ciò che è del consulente e non del cliente: vedi
  //  `indirizzoPerIlCliente`, provata in prove/prove.mjs.
  const perIlCliente = indirizzoPerIlCliente(path);
  // registra la pagina mostrata al cliente
  try {
    //  ⚠️ Col CODICE della consulenza: senza, si scriverebbe nella riga
    //   condivisa e il cliente di un collega seguirebbe questa pagina. Vedi
    //   shop/chiave-sessione.
    fetch("/api/presenter/curpage", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: perIlCliente, sess: getLiveId() || "" }) });
  } catch { /* best-effort */ }
  //  ⚠️ E SI DICE ANCHE SUL CANALE: il cliente ci arriva all'istante invece di
  //   scoprirlo al prossimo giro. La riga sul server resta la verità (chi entra
  //   dopo la legge), questo è solo il modo veloce. Vedi `annunciaPagina`.
  annunciaPaginaCambiata(perIlCliente);
}
// ── IL CODICE DELLA CONSULENZA ──────────────────────────────────────────────
//  Ogni videoconsulenza ha il suo, e si legge: tre-quattro-tre lettere separate
//  da trattini, come gli indirizzi delle riunioni a cui il cliente è abituato
//  (hgl.it/meetly/kfr-mbqd-tzp). Serve a due cose molto pratiche:
//   · si può dettare al telefono senza sbagliare;
//   · si vede a colpo d'occhio se il cliente sta aprendo LA consulenza giusta.
//
//  L'alfabeto non ha vocali, né lettere che si confondono parlando o leggendo
//  (i/l/1, o/0). Niente vocali significa anche nessuna parola formata per caso:
//  un codice generato a caso può comporre parole che non vogliamo mandare a un
//  cliente.
const ALFABETO = "bcdfghjkmnpqrstvwxyz";
function gruppo(n: number): string {
  let s = "";
  const r = new Uint32Array(n);
  // numeri casuali di qualità crittografica quando ci sono: due consulenze
  // aperte nello stesso millesimo di secondo non devono poter collidere.
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(r);
  for (let i = 0; i < n; i++) {
    const v = r[i] || Math.floor(Math.random() * 0xffffffff);
    s += ALFABETO[v % ALFABETO.length];
  }
  return s;
}
/** Un codice nuovo, in stile riunione: `kfr-mbqd-tzp`. */
export function nuovoCodiceConsulenza(): string {
  return `${gruppo(3)}-${gruppo(4)}-${gruppo(3)}`;
}

export function startLive(): string {
  const id = getLiveId() || nuovoCodiceConsulenza();
  localStorage.setItem(LIVE_KEY, id); emit();
  if (typeof window !== "undefined") setPresenterPage(window.location.pathname);
  return id;
}
/** Nuovo codice sessione: usato all'avvio di OGNI videochiamata, così il link
 *  ospite è valido solo per quella chiamata (e scade alla chiusura). */
export function newLiveId(): string {
  const id = nuovoCodiceConsulenza();
  if (typeof window !== "undefined") localStorage.setItem(LIVE_KEY, id);
  emit();
  if (typeof window !== "undefined") setPresenterPage(window.location.pathname);
  return id;
}
/** Adotta un codice sessione esistente (ripresa da un ALTRO browser/dispositivo):
 *  la sessione vive sul server, quindi il presentatore la recupera e il link
 *  dell'ospite resta valido. */
export function adoptLiveId(id: string) {
  if (typeof window === "undefined" || !id || getLiveId() === id) return;
  localStorage.setItem(LIVE_KEY, id); emit();
}
/** ── L'INDIRIZZO SEGUE IL PREVENTIVO ──────────────────────────────────────
 *  Scrive nella barra degli indirizzi il numero del preventivo aperto
 *  (/preventivo?id=IDP1234): ricaricando si riapre quello, e l'indirizzo che
 *  copi dal browser è già quello giusto.
 *
 *  ⚠️ IL CODICE SESSIONE QUI NON ENTRA, ed è una decisione, non una svista.
 *  Averlo scritto nell'indirizzo ha rotto due cose insieme:
 *   · all'apertura la postazione ADOTTA il codice che trova nell'indirizzo, e
 *     quel codice resta lì per sempre — così ogni ricaricamento riportava la
 *     consulenza su una sessione vecchia e "il link era sempre lo stesso";
 *   · se nel frattempo la chiamata viva era un'altra, il cliente col link
 *     nuovo bussava a un canale dove non c'era nessuno e restava fermo su
 *     "la videoconsulenza si sta per avviare" a chiamata già avviata.
 *  La sessione vive nel browser e sul server, che sanno qual è quella VERA.
 *
 *  Non ricarica la pagina: sta già mostrando ciò che l'indirizzo descrive.
 *  `ref`: una stringa lo scrive, `null` lo toglie, non passarlo lo lascia com'è.
 */
export function indirizzoPreventivo(ref?: string | null) {
  if (typeof window === "undefined" || ref === undefined) return;
  try {
    const u = new URL(window.location.href);
    if (ref && u.pathname.startsWith("/preventivo")) { u.searchParams.set("id", ref); u.searchParams.delete("ref"); }
    else if (ref === null) { u.searchParams.delete("id"); u.searchParams.delete("ref"); }
    if (u.toString() !== window.location.href) window.history.replaceState({}, "", u.toString());
  } catch { /* l'indirizzo è una comodità: se non si può scrivere, pazienza */ }
}

/** Toglie `session` dall'indirizzo dopo averlo usato.
 *  Il codice serve UNA volta, per riprendere la consulenza da un altro browser.
 *  Lasciarlo scritto significa riapplicarlo a ogni ricaricamento, anche quando
 *  la consulenza vera è ormai un'altra. */
export function pulisciSessioneDallIndirizzo() {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has("session") && !u.searchParams.has("unlock")) return;
    u.searchParams.delete("session"); u.searchParams.delete("unlock");
    window.history.replaceState({}, "", u.toString());
  } catch { /* */ }
}

export function stopLive() {
  if (typeof window !== "undefined") localStorage.removeItem(LIVE_KEY);
  emit();
}
export function useLiveId(): string | null {
  const [id, setId] = useState<string | null>(getLiveId());
  useEffect(() => {
    // Il codice sessione può cambiare (newLiveId) in un ALTRO contesto JS:
    //  - altra scheda del consulente
    //  - la finestra ESTERNA quando la pagina gira nell'iframe dell'anteprima
    //    dispositivo (mobile/tablet): lì il modulo live.ts è un'istanza diversa,
    //    quindi i `listeners` in memoria non vengono mai chiamati.
    // Per questo ascoltiamo anche `storage` + `hg-live-change` e teniamo un
    // polling di sicurezza: senza, la pagina continuerebbe a trasmettere su un
    // canale morto e l'ospite non riceverebbe nulla.
    const sync = () => setId((prev) => { const now = getLiveId(); return prev === now ? prev : now; });
    sync();
    listeners.add(sync);
    if (typeof window !== "undefined") {
      window.addEventListener("storage", sync);
      window.addEventListener("hg-live-change", sync);
    }
    const iv = setInterval(sync, 1000);
    return () => {
      listeners.delete(sync);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", sync);
        window.removeEventListener("hg-live-change", sync);
      }
      clearInterval(iv);
    };
  }, []);
  return id;
}

/*  ── ⚠️ L'OSPITE RESTA SUL CODICE DEL SUO LINK ────────────────────────────
    Qui c'era `useGuestCode`: chiedeva al server «chi sta trasmettendo?» e
    adottava quel codice, per salvare i link leggermente vecchi. Con due
    consulenti in diretta nello stesso momento quella domanda ha una risposta
    sola, e sbagliata per uno dei due: il cliente veniva portato dentro la
    consulenza del collega — segnalazione del committente.
    Non serviva nemmeno: il codice del link non cambia durante una consulenza,
    si rigenera solo con «Nuovo cliente» / «Consulenza nuova», e lì il link
    vecchio DEVE smettere di funzionare. Chi arriva con un codice spento vede
    la schermata d'attesa, che è la cosa giusta. */

// ── DOVE STA IL CODICE DELLA CONSULENZA ─────────────────────────────────────
//  Tre forme, una sola verità:
//   · /meetly/kfr-mbqd-tzp          ← quella che si manda al cliente oggi
//   · /videochiamata/kfr-mbqd-tzp   ← prima che il software si chiamasse Meetly
//   · /videochiamata?watch=kfr-...  ← la più vecchia di tutte
//  Le due forme storiche devono continuare a funzionare: i link già mandati non
//  si possono richiamare indietro. Tutto il resto del programma chiede il codice
//  QUI, così le forme non possono divergere fra loro.

/** L'indirizzo di una stanza col codice dentro, vecchio nome compreso.
 *  Il vecchio percorso rimanda a quello nuovo, ma il riconoscimento accetta
 *  entrambi: il reindirizzamento è un istante in cui la pagina è ancora
 *  sull'indirizzo storico, e già in quell'istante il cliente deve risultare un
 *  ospite — altrimenti gli comparirebbe la barra del consulente. */
export const STANZA_RE = /^\/(?:meetly|videochiamata)\/([^/?#]+)/;
/** true se questo indirizzo è la stanza di una consulenza (codice compreso). */
export function inStanzaConsulenza(pathname: string): boolean {
  return STANZA_RE.test(pathname || "");
}
/** Il codice della consulenza aperta in questo momento, o null. */
export function watchId(): string | null {
  if (typeof window === "undefined") return null;
  return codiceDaIndirizzo(window.location.pathname, window.location.search);
}
export function codiceDaIndirizzo(pathname: string, search: string): string | null {
  const q = new URLSearchParams(search).get("watch");
  if (q) return q;
  const m = STANZA_RE.exec(pathname || "");
  return m ? decodeURIComponent(m[1]) : null;
}

/** Fa seguire al cliente la pagina mostrata dal presentatore.
 *  Nessuna auto-trasmissione per scheda: c'è UNA sola "pagina corrente" impostata solo
 *  quando il presentatore sceglie dal menu. Il cliente la segue via polling → niente rimbalzi. */
export function useLiveNav(_broadcasting: boolean, watch: string | null) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!watch) return;
    //  ── ⚠️ DENTRO LA CORNICE DI UN WEBINAR NON SI NAVIGA ──────────────────
    //   Questa funzione fa seguire al cliente la pagina che il consulente sta
    //   guardando, chiedendola a `/api/presenter/curpage`. In una sala da
    //   webinar quella risposta è la pagina del presentatore in MEETLY, che
    //   con la diretta non c'entra: la cornice verrebbe portata via da sola
    //   mentre la sala guarda tutt'altro.
    //   Nel webinar è lo stato della sala a dire cosa mostrare, e ci pensa la
    //   pagina che sta dentro la cornice.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("webinar")) return;
    let stop = false;
    let lastNav: { percorso: string; extra: Record<string, string> } | null = null;
    /*  ── ⚠️ NON SI CHIEDE PIÙ NIENTE DA QUI ────────────────────────────────
        Questo giro chiedeva al server «che pagina guardi?» ogni 1,2 secondi:
        misurato, era la voce più grossa delle 7.200 richieste l'ora di UNA
        scheda cliente — ed è il motivo per cui il sito si è fermato con
        «Error 1027, limiti del piano raggiunti». La domanda adesso la fa una
        volta sola il motore, per tutti (shop/call, `ascoltaStatoStanza`), e il
        cambio di schermata arriva anche sul canale, all'istante. Qui resta
        soltanto la parte che riguarda questa pagina: dove portare il cliente.
        ⚠️ Le regole di sicurezza restano TUTTE dove erano: quella che filtra
         le pagine mostrabili, quella del preventivo personale, e la guardia
         anti-rimbalzo. */
    const applica = (path: string) => {
      if (stop || !path) return;
      //  ⚠️ E QUI SI CONTROLLA DI NUOVO, dal lato del cliente. Non è una
      //   ripetizione inutile: il consulente può avere aperta una versione di
      //   ieri, che quella pagina la registra ancora. Chi deve essere protetto
      //   è il cliente, e l'unico controllo che lo protegge davvero è quello
      //   che gira sul suo telefono.
      if (!paginaMostrabile(path)) {
        console.warn(`[GUEST] pagina non condivisibile, resto dove sono: ${path}`);
        return;
      }
      const { percorso, extra } = pezziPagina(path);
      /*  ⚠️ …MA LA RISPOSTA «IL TUO PREVENTIVO» PASSA SEMPRE. Da quando la
          precedenza la calcola anche il server (`paginaDiQuestoCliente`),
          questa riga è la stessa cosa detta due volte: fermare TUTTO
          impediva anche di portarlo sul suo preventivo quando ci deve
          andare — ed è proprio il caso del cliente che il consulente ha
          appena acceso mentre stava sui media. */
      if (restaSulMioPreventivo() && !/^\/preventivo/.test(percorso)) return;
      // arrivato a destinazione → sblocco la guardia anti-loop
      if (lastNav && stessaSchermata({ percorso: lastNav.percorso, extra: lastNav.extra, quiPercorso: window.location.pathname, quiRicerca: window.location.search })) lastNav = null;
      //  Chi è già nella stanza della consulenza (/meetly/CODICE) non va
      //  rimandato sull'ingresso senza codice: sarebbe un rimbalzo per nulla,
      //  e perderebbe l'indirizzo bello. Vale anche per il nome storico,
      //  finché in giro ci sono link /videochiamata.
      const giaInStanza = (percorso === "/meetly" || percorso === "/videochiamata") && inStanzaConsulenza(window.location.pathname);
      //  ⚠️ NON SOLO IL PERCORSO: anche i parametri che contano (`persona`).
      //   Il perché per esteso sta in `stessaSchermata`, insieme alla
      //   segnalazione che l'ha fatto scoprire.
      const giaQui = stessaSchermata({ percorso, extra, quiPercorso: window.location.pathname, quiRicerca: window.location.search });
      const giaTentata = !!lastNav && lastNav.percorso === percorso && String(lastNav.extra.persona || "") === String(extra.persona || "");
      if (!percorso || giaInStanza || giaQui || giaTentata) return;
      lastNav = { percorso, extra }; // una sola navigazione per destinazione → niente loop
      azzeraZoomDelCliente(); // cambio pagina → azzera lo zoom del guest
      console.log("[GUEST] navigazione SPA:", window.location.pathname, "→", path);
      // SEMPRE navigazione SPA: un reload completo azzererebbe lo stato in
      // memoria della chiamata (joined/sessionLive) e rimanderebbe l'ospite in
      // attesa → era una delle cause del loop. Mai window.location.
      try {
        // si conserva anche ?debug=1, altrimenti il pannello di diagnostica si
        // chiude al primo cambio schermata proprio mentre serve
        const dbg = new URLSearchParams(window.location.search).get("debug");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = navigate({ to: percorso as any, search: { ...extra, watch, ...(dbg ? { debug: dbg } : {}) } as any }) as any;
        if (r && typeof r.catch === "function") r.catch((e: unknown) => console.warn("[GUEST] navigazione SPA fallita (resto qui, chiamata intatta)", e));
      } catch (e) {
        console.warn("[GUEST] navigazione SPA fallita (resto qui, chiamata intatta)", e);
      }
    };

    let ultimoSentito = 0;
    const smetti = ascoltaStatoStanza((st) => {
      if (st.code !== watch) return;
      ultimoSentito = Date.now();
      applica(st.path);
    });
    const ora = statoStanzaOra(watch);
    if (ora) applica(ora.path);
    /*  ── LA RETE DI SICUREZZA ───────────────────────────────────────────────
        Se il motore non sta guardando questa stanza (una pagina aperta fuori
        dalla consulenza, una cornice, un caso che non ho previsto) il cliente
        non deve restare fermo: si chiede da qui, ma piano — ogni otto secondi,
        e solo finché non arriva niente dal motore. */
    const rete = setInterval(() => {
      if (stop || Date.now() - ultimoSentito < 12_000) return;
      const chiSono = miaPersonaDi(watch);
      fetch(`/api/presenter/curpage?sess=${encodeURIComponent(watch)}${chiSono ? `&persona=${encodeURIComponent(chiSono)}` : ""}`)
        .then((r) => r.json())
        .then((j) => { if (!stop) applica(String(j?.path || "")); })
        .catch(() => {});
    }, 8000);
    return () => { stop = true; smetti(); clearInterval(rete); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);
}

/** ── ⚠️ QUESTA PAGINA LA STA GUARDANDO UNA SALA, NON UN CLIENTE ────────────
 *  Le pagine dei contenuti — slide, preventivo, media — servono a due cose
 *  diverse: la consulenza a due e il webinar. Sono la stessa pagina, ma il
 *  contorno no. Nella consulenza, mentre si aspetta lo stato del consulente,
 *  è giusto dire «la tua videoconsulenza sta per iniziare»; in un webinar
 *  quella frase è FALSA e per giunta col marchio di un'altra cosa: chi ha
 *  appena premuto «entra in diretta» si vede comparire l'attesa di una
 *  videochiamata che non ha prenotato, e pensa di aver sbagliato link.
 *  È la segnalazione «quando clicco su slide, mentre carica mostra meetly».
 *  Il segno è il parametro `?webinar=`, che la sala aggiunge sempre.
 */
export function guardataDaUnaSala(): boolean {
  if (typeof window === "undefined") return false;
  return !!new URLSearchParams(window.location.search).get("webinar");
}
