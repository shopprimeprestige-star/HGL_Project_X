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
import { useEffect, useState } from "react";
import * as TestiSito from "@/landing/testi-sito";
import {
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
  const pulito = ripulisciDettagli(dettagli);
  const pagina = typeof window !== "undefined" ? window.location.pathname : undefined;
  const variante = leggiVariante();
  const fuori: Record<string, string | number | boolean> = { ...pulito, ...(pagina ? { pagina } : {}), ...(variante ? { variante } : {}) };
  void initAdminCheck().then(() => trackEvent(nome, null, ripulisciDettagli(fuori), opzioni));
}

/** Tracciamento di una pagina intera, come fa la home di oggi: se chi visita è
 *  un amministratore NON si traccia nulla. In più `vista_pagina` e `scroll_50`,
 *  una volta per visita. */
export function usaTracciamentoPagina(pagina: string): void {
  useEffect(() => {
    let pulizie: Array<() => void> = [];
    const spegni = () => {
      pulizie.forEach((p) => p());
      pulizie = [];
    };
    void initAdminCheck().then((isAdmin) => {
      if (isAdmin) return;
      traccia("vista_pagina", { percorso: pagina }, { dedupKey: `vista:${pagina}` });
      pulizie.push(initScrollTracking(), initClickTracking(), initHeartbeat(), initLivePresence(), initHighQualityVisit(40, 50));
      const suScroll = () => {
        const alto = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        if (alto > 0 && (window.scrollY + window.innerHeight) / alto >= 0.5) {
          traccia("scroll_50", { percorso: pagina }, { dedupKey: `scroll50:${pagina}` });
          window.removeEventListener("scroll", suScroll);
        }
      };
      window.addEventListener("scroll", suScroll, { passive: true });
      pulizie.push(() => window.removeEventListener("scroll", suScroll));
    });
    const smetti = subscribeAdminStatus((isAdmin) => {
      if (isAdmin) spegni();
    });
    return () => {
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
    //  L'interruttore sta in `testi-sito.ts` (con B8); finché non c'è vale spento.
    const acceso = (TestiSito.INTERRUTTORI as { testBottone?: boolean }).testBottone === true;
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
