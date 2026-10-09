/** ── PREFERENZE DELLE NOTIFICHE DEL BROWSER ────────────────────────────────
 *
 *  PERCHÉ SU QUESTO DISPOSITIVO E NON A DATABASE
 *  Il permesso di notificare non è dell'account: è di QUESTO browser su QUESTO
 *  computer. Chi lavora dal portatile in sede e dal fisso a casa concede il
 *  permesso due volte, e vuole due impostazioni diverse — sul fisso il suono
 *  alto, sul portatile in riunione tutto spento. Salvare le preferenze a
 *  database le renderebbe globali, cioè sbagliate su almeno una delle due
 *  macchine. Restano quindi in localStorage, accanto al permesso a cui si
 *  riferiscono.
 *
 *  (Le preferenze degli alert Ads — soglie, mute, email — restano a database in
 *  `usePrefs.ts`: quelle sì che valgono per l'account, non per il dispositivo.)
 *  ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { TIPI_EVENTO, type TipoEvento } from "./catalogo";

export interface PrefsBrowser {
  /** Interruttore generale: spento, il motore non notifica nulla. */
  attive: boolean;
  suono: boolean;
  /** 0..1 */
  volume: number;
  /** Un interruttore per tipo di avviso. */
  tipi: Record<TipoEvento, boolean>;
  /** E, per ogni tipo, se deve anche SUONARE. Due interruttori e non uno solo
   *  perché "voglio saperlo" e "voglio essere interrotto" sono due decisioni
   *  diverse: l'installazione di domani si legge quando capita, l'appuntamento
   *  che inizia adesso deve fare rumore. */
  suoni: Record<TipoEvento, boolean>;
  /** Più eventi dello stesso tipo nello stesso momento diventano una notifica
   *  sola ("3 appuntamenti fra poco"). Disattivabile da chi preferisce vederli
   *  uno per uno. */
  raggruppa: boolean;
  /** Scrive anche nella tabella `notifications`, così l'avviso resta nella
   *  campanella e sugli altri dispositivi. */
  salvaStorico: boolean;
}

const tuttiAttivi = () =>
  Object.fromEntries(TIPI_EVENTO.map((t) => [t, true])) as Record<TipoEvento, boolean>;

export const PREFS_DEFAULT: PrefsBrowser = {
  attive: true,
  suono: true,
  volume: 0.7,
  tipi: tuttiAttivi(),
  suoni: tuttiAttivi(),
  raggruppa: true,
  salvaStorico: true,
};

/** Una copia pulita dei valori di partenza: `PREFS_DEFAULT` contiene oggetti,
 *  e restituirlo per riferimento significherebbe che chi lo modifica cambia il
 *  default di tutti. */
function difetto(): PrefsBrowser {
  return { ...PREFS_DEFAULT, tipi: tuttiAttivi(), suoni: tuttiAttivi() };
}

const CHIAVE = "hg_crm_notif_prefs_v1";
/** Evento interno: `storage` avvisa solo le ALTRE schede, non quella che ha
 *  scritto. Senza questo, cambiare un interruttore nella pagina Notifiche non
 *  aggiornava il motore montato nello stesso momento nel guscio. */
const EVENTO_PREFS = "hg-crm-notif-prefs";

/** Legge una mappa "tipo → acceso/spento" tenendo solo le chiavi conosciute:
 *  un tipo aggiunto dopo nasce acceso, uno rimosso sparisce senza lasciare
 *  scorie nelle preferenze salvate. */
function mappaTipi(grezzo: unknown): Record<TipoEvento, boolean> {
  const mappa = tuttiAttivi();
  if (grezzo && typeof grezzo === "object") {
    for (const t of TIPI_EVENTO) {
      const v = (grezzo as Record<string, unknown>)[t];
      if (typeof v === "boolean") mappa[t] = v;
    }
  }
  return mappa;
}

function normalizza(grezzo: unknown): PrefsBrowser {
  if (!grezzo || typeof grezzo !== "object") return difetto();
  const p = grezzo as Partial<PrefsBrowser>;
  return {
    attive: typeof p.attive === "boolean" ? p.attive : PREFS_DEFAULT.attive,
    suono: typeof p.suono === "boolean" ? p.suono : PREFS_DEFAULT.suono,
    volume:
      typeof p.volume === "number" && Number.isFinite(p.volume)
        ? Math.max(0, Math.min(1, p.volume))
        : PREFS_DEFAULT.volume,
    tipi: mappaTipi(p.tipi),
    suoni: mappaTipi(p.suoni),
    raggruppa: typeof p.raggruppa === "boolean" ? p.raggruppa : PREFS_DEFAULT.raggruppa,
    salvaStorico: typeof p.salvaStorico === "boolean" ? p.salvaStorico : PREFS_DEFAULT.salvaStorico,
  };
}

/** Lettura sincrona, utilizzabile anche fuori da React (dal motore). */
export function leggiPrefs(): PrefsBrowser {
  if (typeof window === "undefined") return difetto();
  try {
    const grezzo = window.localStorage.getItem(CHIAVE);
    if (!grezzo) return difetto();
    return normalizza(JSON.parse(grezzo));
  } catch {
    return difetto();
  }
}

export function scriviPrefs(p: PrefsBrowser): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHIAVE, JSON.stringify(p));
  } catch {
    /* quota piena o storage negato: le preferenze restano quelle in memoria */
  }
  window.dispatchEvent(new CustomEvent(EVENTO_PREFS));
}

/** Le preferenze come stato React, sincronizzate fra schede e fra componenti. */
export function usePrefsBrowser() {
  const [prefs, setPrefs] = useState<PrefsBrowser>(() => leggiPrefs());

  // La prima lettura sul server non vede localStorage: si rilegge al mount, così
  // il primo render idratato combacia e il secondo mostra il valore vero.
  useEffect(() => {
    setPrefs(leggiPrefs());
    const aggiorna = () => setPrefs(leggiPrefs());
    window.addEventListener(EVENTO_PREFS, aggiorna);
    window.addEventListener("storage", aggiorna);
    return () => {
      window.removeEventListener(EVENTO_PREFS, aggiorna);
      window.removeEventListener("storage", aggiorna);
    };
  }, []);

  const salva = useCallback((patch: Partial<PrefsBrowser>) => {
    setPrefs((prima) => {
      const dopo = { ...prima, ...patch };
      scriviPrefs(dopo);
      return dopo;
    });
  }, []);

  const cambiaTipo = useCallback((tipo: TipoEvento, attivo: boolean) => {
    setPrefs((prima) => {
      // Spegnere l'avviso spegne anche il suo suono: un tipo muto ma acceso ha
      // senso, uno spento che continua a suonare no.
      const dopo = {
        ...prima,
        tipi: { ...prima.tipi, [tipo]: attivo },
        suoni: attivo ? prima.suoni : { ...prima.suoni, [tipo]: false },
      };
      scriviPrefs(dopo);
      return dopo;
    });
  }, []);

  const cambiaSuonoTipo = useCallback((tipo: TipoEvento, conSuono: boolean) => {
    setPrefs((prima) => {
      // Riaccendere il suono di un tipo spento riaccende anche l'avviso:
      // altrimenti si sceglie un suono per una notifica che non arriverà.
      const dopo = {
        ...prima,
        suoni: { ...prima.suoni, [tipo]: conSuono },
        tipi: conSuono ? { ...prima.tipi, [tipo]: true } : prima.tipi,
      };
      scriviPrefs(dopo);
      return dopo;
    });
  }, []);

  return { prefs, salva, cambiaTipo, cambiaSuonoTipo };
}
