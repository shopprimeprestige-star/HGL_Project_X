/** ── TRACCIAMENTO DELLE PAGINE NUOVE · PROVVISORIO ───────────────────────────
 *  Stessi nomi e stesse firme di `src/landing/sito/traccia.ts` (compito C4):
 *  `traccia`, `usaTracciamentoPagina`, `usaVariante`. C4 non è ancora arrivato
 *  quando D scrive le pagine, quindi la parte che serve a loro vive qui.
 *
 *  ⚠️ QUANDO C4 È DENTRO: questo file si cancella e le pagine importano da
 *  `./traccia` (cambia solo il percorso dell'import).
 *
 *  ⚠️ COSA NON SI PUÒ PERDERE (e perché sta qui, non solo nei componenti):
 *  la vecchia home fa partire `captureSourceData()` e il «PageView» di Meta
 *  dentro `BookingFunnel`, al montaggio. La home nuova NON monta il
 *  calendario, quindi senza questo file i dati della fonte (utm_*, fbclid)
 *  non verrebbero mai salvati: chi arriva da un annuncio sulla home e poi
 *  tocca «Prenota» arriverebbe al modulo di /protocol senza fonte, e il lead
 *  perderebbe l'attribuzione. `captureSourceData()` salva in sessionStorage,
 *  e la pagina dopo lo ritrova.
 *
 *  Come `traccia()` (decisione 9 del piano): ogni evento porta la pagina e,
 *  a test acceso, la variante, e porta SOLO i dettagli dell'elenco ammesso.
 *  Nome, telefono e testo libero non possono uscire nemmeno per sbaglio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import {
  captureSourceData,
  eventId,
  fireCapi,
  firePixel,
  initAdminCheck,
  initHeartbeat,
  initClickTracking,
  initHighQualityVisit,
  initLivePresence,
  initScrollTracking,
  subscribeAdminStatus,
  trackEvent,
} from "@/landing/booking/tracking";
import { INTERRUTTORI } from "./testi-pagine";

export type Variante = "A" | "B";

const DETTAGLI_AMMESSI = ["bottone", "sezione", "percorso", "campo", "voce", "motivo", "origine", "punto", "variante", "pagina"];
//  Lo stesso nome di `CUSTOM_EVENTS.pageView` in BookingFunnel: le statistiche di oggi contano questo.
const NOME_VISITA_LANDING = "Visita_Landing";
const CHIAVE_VARIANTE = "hgl_variante_bottone_v1";

let paginaCorrente = "";
let varianteCorrente: Variante | null = null;

function ripulisci(d: Record<string, unknown>): Record<string, unknown> {
  const fuori: Record<string, unknown> = {};
  for (const k of DETTAGLI_AMMESSI) {
    const v = d[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") fuori[k] = v;
  }
  return fuori;
}

/** Un evento, con pagina (e variante a test acceso) e solo i dettagli ammessi. */
export function traccia(nome: string, dettagli: Record<string, unknown> = {}): Promise<void> {
  const completi: Record<string, unknown> = { ...dettagli };
  if (paginaCorrente) completi.pagina = paginaCorrente;
  if (INTERRUTTORI.testBottone && varianteCorrente) completi.variante = varianteCorrente;
  return trackEvent(nome, null, ripulisci(completi));
}

/** `vista_pagina`, `scroll_50`, battito e presenza, come la home di oggi (non conta gli amministratori). */
export function usaTracciamentoPagina(pagina: string): void {
  useEffect(() => {
    paginaCorrente = pagina;
    //  I dati della fonte si salvano subito, anche se poi si scopre un amministratore:
    //  è la memoria che segue la persona fino al lead.
    captureSourceData();
    const pulizie: Array<() => void> = [];
    let scrollFatto = false;
    const svuota = () => {
      pulizie.splice(0).forEach((p) => p());
    };

    const avvia = () => {
      if (pulizie.length) return;
      // PageView di Meta e di lp_events: quello che prima faceva BookingFunnel al montaggio.
      const pvId = eventId();
      firePixel("PageView", {}, pvId, { dedupKey: "global" });
      void fireCapi("PageView", pvId, {}, {});
      void trackEvent("PageView", 0, { custom_event: NOME_VISITA_LANDING, pagina }, { dedupKey: "global" });
      void trackEvent("vista_pagina", null, { pagina }, { dedupKey: `vista:${pagina}` });

      const sulloScroll = () => {
        if (scrollFatto) return;
        const alto = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        if ((window.scrollY + window.innerHeight) / alto >= 0.5) {
          scrollFatto = true;
          void trackEvent("scroll_50", null, { pagina }, { dedupKey: `scroll50:${pagina}` });
        }
      };
      window.addEventListener("scroll", sulloScroll, { passive: true });
      pulizie.push(() => window.removeEventListener("scroll", sulloScroll));
      //  Gli eventi «Scroll» (25/50/75/100) e i clic su [data-track], come la home di oggi:
      //  il CRM legge `payload.scroll` per la profondità di scorrimento per annuncio.
      pulizie.push(initScrollTracking());
      pulizie.push(initClickTracking());
      pulizie.push(initHeartbeat());
      pulizie.push(initLivePresence());
      pulizie.push(initHighQualityVisit(40, 50));
    };

    initAdminCheck().then((admin) => {
      if (!admin) avvia();
    });
    const smetti = subscribeAdminStatus((admin) => {
      if (admin) svuota();
    });
    return () => {
      smetti();
      svuota();
    };
  }, [pagina]);
}

/** A di base. A test acceso: metà e metà, sempre la stessa per tutta la visita. */
export function usaVariante(): Variante {
  const [v, setV] = useState<Variante>("A");
  useEffect(() => {
    if (!INTERRUTTORI.testBottone) return;
    let scelta: Variante | null = null;
    try {
      const salvata = window.sessionStorage.getItem(CHIAVE_VARIANTE);
      if (salvata === "A" || salvata === "B") scelta = salvata;
    } catch {
      // memoria bloccata: la variante vale per questa pagina
    }
    if (!scelta) {
      scelta = Math.random() < 0.5 ? "A" : "B";
      try {
        window.sessionStorage.setItem(CHIAVE_VARIANTE, scelta);
      } catch {
        // idem
      }
    }
    varianteCorrente = scelta;
    setV(scelta);
  }, []);
  return v;
}
