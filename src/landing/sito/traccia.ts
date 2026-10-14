/** ── TRACCIAMENTO DEL SITO NUOVO ────────────────────────────────────────────
 *  Un solo involucro per tutti gli eventi della SPEC: aggiunge la pagina (e,
 *  a test acceso, la variante del bottone) e toglie ogni dettaglio che non sta
 *  nell'elenco ammesso. Così nome, telefono e testo libero non escono nemmeno
 *  per sbaglio. `trackEvent` non cambia: non conta gli amministratori e porta
 *  da sé UTM, fonte e dispositivo.
 *
 *  ⚠️ `trackEvent` scarta in silenzio ogni evento finché non sa se chi visita
 *  è un amministratore: qui si aspetta l'esito (`initAdminCheck`) prima di
 *  spedire, altrimenti un evento sparato al montaggio andrebbe perso.
 *  ───────────────────────────────────────────────────────────────────────── */
//  I ganci hanno nomi italiani fissati dal contratto («usa…», non «use…»): la regola non li riconosce, sono ganci veri.
/* eslint-disable react-hooks/rules-of-hooks */
import { useEffect, useState } from "react";
import * as TestiSito from "@/landing/testi-sito";
import {
  captureSourceData,
  eventId,
  fireCapi,
  firePixel,
  initAdminCheck,
  initClickTracking,
  initHeartbeat,
  initHighQualityVisit,
  initLivePresence,
  initScrollTracking,
  subscribeAdminStatus,
  trackEvent,
} from "@/landing/booking/tracking";
import { EVENTI_SITO, ripulisciDettagli, varianteBottone, type NomeEventoSito } from "./eventi";

const CHIAVE_VARIANTE = "hgl_variante_bottone_v1";
/** Lo stesso valore di `CUSTOM_EVENTS.pageView` in `BookingFunnel`: le statistiche di oggi contano questo. */
const NOME_VISITA_LANDING = "Visita_Landing";

function leggiVariante(): "A" | "B" | null {
  try {
    if (typeof window === "undefined") return null;
    const v = window.sessionStorage.getItem(CHIAVE_VARIANTE);
    return v === "A" || v === "B" ? v : null;
  } catch {
    return null;
  }
}

/** Spedisce un evento della lista. Fuori lista non parte: i nomi sono fissi. */
export function traccia(
  nome: NomeEventoSito,
  dettagli: Record<string, unknown> = {},
  opzioni: { dedupKey?: string } = {},
): void {
  if (!(EVENTI_SITO as readonly string[]).includes(nome)) return;
  //  Il tracciamento non rompe mai la pagina: `sessionStorage` bloccato (Safari privato) fa lanciare `initAdminCheck`.
  try {
    const pulito = ripulisciDettagli(dettagli);
    const pagina = typeof window !== "undefined" ? window.location.pathname : undefined;
    const variante = leggiVariante();
    const fuori: Record<string, string | number | boolean> = { ...pulito, ...(pagina ? { pagina } : {}), ...(variante ? { variante } : {}) };
    void initAdminCheck()
      .then(() => trackEvent(nome, null, ripulisciDettagli(fuori), opzioni))
      .catch(() => undefined);
  } catch {
    // un evento perso non vale una pagina rotta
  }
}

/** Tracciamento di una pagina intera. Fa quello che oggi fa la home vecchia
 *  insieme a `BookingFunnel`, perché le pagine nuove non montano il calendario:
 *  - SUBITO salva la fonte (`captureSourceData`: utm_*, fbclid, fbp/fbc) in
 *    sessionStorage, così segue la persona fino al lead anche se prima passa da
 *    un'altra pagina (home → /protocol). Senza questo i lead dagli annunci
 *    perdono l'attribuzione;
 *  - poi, se chi visita NON è un amministratore: «PageView» di Meta (Pixel e
 *    CAPI, stesso id) e di `lp_events`, `vista_pagina` e `scroll_50` una volta,
 *    scorrimento, clic, battito, presenza e visita di qualità come oggi. */
export function usaTracciamentoPagina(pagina: string): void {
  useEffect(() => {
    let pulizie: Array<() => void> = [];
    //  La pagina si smonta (cambio pagina, doppio montaggio in sviluppo) prima che il controllo
    //  amministratore risponda: allora non si attacca più niente.
    let chiuso = false;
    const spegni = () => {
      pulizie.forEach((p) => p());
      pulizie = [];
    };
    let smetti: () => void = () => undefined;
    //  Come in `traccia`: se la memoria del browser è bloccata il tracciamento si ferma, la pagina no.
    //  La pulizia sotto si restituisce comunque, qualunque cosa sia successa prima.
    try {
      captureSourceData();
      void initAdminCheck()
        .then((isAdmin) => {
          if (chiuso || isAdmin || pulizie.length) return;
          const pvId = eventId();
          firePixel("PageView", {}, pvId, { dedupKey: "global" });
          void fireCapi("PageView", pvId, {}, {});
          void trackEvent("PageView", 0, { custom_event: NOME_VISITA_LANDING, pagina }, { dedupKey: "global" });
          traccia("vista_pagina", { percorso: pagina }, { dedupKey: `vista:${pagina}` });
          const suScroll = () => {
            const alto = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            if (alto > 0 && (window.scrollY + window.innerHeight) / alto >= 0.5) {
              traccia("scroll_50", { percorso: pagina }, { dedupKey: `scroll50:${pagina}` });
              window.removeEventListener("scroll", suScroll);
            }
          };
          window.addEventListener("scroll", suScroll, { passive: true });
          pulizie.push(
            () => window.removeEventListener("scroll", suScroll),
            initScrollTracking(),
            initClickTracking(),
            initHeartbeat(),
            initLivePresence(),
            initHighQualityVisit(40, 50),
          );
        })
        .catch(() => undefined);
      smetti = subscribeAdminStatus((isAdmin) => {
        if (isAdmin) spegni();
      });
    } catch {
      // tracciamento fermo, pagina intatta
    }
    return () => {
      chiuso = true;
      smetti();
      spegni();
    };
  }, [pagina]);
}

/** La variante del bottone per questa visita. Test spento: sempre «A». Acceso:
 *  metà e metà, sempre la stessa per tutta la visita (e viaggia su ogni evento). */
export function usaVariante(): "A" | "B" {
  const [variante, setVariante] = useState<"A" | "B">("A");
  useEffect(() => {
    //  L'interruttore sta in `testi-sito.ts`: spento di base, acceso = una parola e pubblicare.
    const acceso: boolean = TestiSito.INTERRUTTORI.testBottone;
    const scelta = varianteBottone(acceso, leggiVariante(), Math.random);
    setVariante(scelta);
    if (acceso) {
      try {
        window.sessionStorage.setItem(CHIAVE_VARIANTE, scelta);
      } catch {
        // memoria bloccata: la variante vale per questa pagina e basta
      }
    }
  }, []);
  return variante;
}
