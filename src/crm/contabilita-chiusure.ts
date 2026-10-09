/** ── LE SCADENZE GIÀ FATTE ─────────────────────────────────────────────────
 *
 *  Un promemoria che continua a suonare dopo che la cosa è stata fatta smette
 *  di essere un promemoria: diventa rumore, e dopo due trimestri lo si guarda
 *  con la stessa attenzione con cui si guarda un adesivo sul muro. È il difetto
 *  che avevo appena costruito io — il conto alla rovescia nel menu e la
 *  striscia in «Da fare oggi» insistevano fino al giorno della scadenza anche
 *  se la contabilità era stata chiusa e mandata la settimana prima.
 *
 *  Qui si segna quello che è stato fatto: una riga per scadenza, con il giorno
 *  in cui è stata segnata. Da quel momento quella scadenza non chiede più
 *  niente, e la pagina la mostra come fatta invece che come imminente.
 *
 *  ── ⚠️ SEGNARE NON VUOL DIRE PAGARE ───────────────────────────────────────
 *  Questo dice «me ne sono occupato», non «lo Stato ha incassato». Il CRM non
 *  sa se l'F24 è andato a buon fine e non fa finta di saperlo: la spunta la
 *  mette una persona, e la si può togliere. Scriverlo diversamente vorrebbe
 *  dire dare a un promemoria l'aria di una quietanza.
 *
 *  ── DOVE VIVONO ───────────────────────────────────────────────────────────
 *  In `app_config`, chiave `contabilita_chiuse`, un oggetto `{ id: giorno }`.
 *  Una chiave sola e non una per scadenza: sono poche righe, si leggono tutte
 *  insieme all'apertura del CRM, e una lettura sola è quello che serve al
 *  badge del menu — che si disegna a ogni cambio di pagina.
 *  ⚠️ Chi salva per ultimo vince, come per le altre configurazioni di questa
 *   cartella. Qui il danno è piccolo e la finestra è di millisecondi: si
 *   rilegge dall'archivio prima di scrivere, invece di riscrivere quello che
 *   sta a schermo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { archivio } from "./fatture/archivio";

export const CHIAVE_CHIUSE = "contabilita_chiuse";

/** `{ "iva-2026-t2": "2026-08-12" }` */
export type Chiusure = Record<string, string>;

let valore: Chiusure = {};
let letta = false;
let inCorso: Promise<void> | null = null;
const ascoltatori = new Set<() => void>();

const avvisa = () => {
  for (const f of ascoltatori) f();
};

const leggiDaTesto = (grezzo: string | null): Chiusure => {
  if (!grezzo) return {};
  try {
    const g = JSON.parse(grezzo) as unknown;
    if (!g || typeof g !== "object") return {};
    const fuori: Chiusure = {};
    for (const [k, v] of Object.entries(g as Record<string, unknown>)) {
      if (typeof v === "string" && v) fuori[k] = v.slice(0, 10);
    }
    return fuori;
  } catch {
    //  Un valore illeggibile vale «niente di segnato»: il promemoria torna a
    //  suonare, che è il ripiego prudente — l'altro è tacere su una scadenza.
    return {};
  }
};

async function carica(): Promise<void> {
  if (letta) return;
  inCorso ??= archivio
    .leggi(CHIAVE_CHIUSE)
    .then((v) => {
      valore = leggiDaTesto(v);
    })
    .catch(() => {
      /*  Vedi sopra: senza dati il promemoria suona. */
    })
    .finally(() => {
      letta = true;
      inCorso = null;
      avvisa();
    });
  await inCorso;
}

export function useChiusure(): {
  chiuse: Chiusure;
  segna: (id: string, fatta: boolean) => Promise<string | null>;
} {
  const [chiuse, setChiuse] = useState<Chiusure>(valore);
  useEffect(() => {
    const suCambio = () => setChiuse(valore);
    ascoltatori.add(suCambio);
    void carica().then(suCambio);
    return () => {
      ascoltatori.delete(suCambio);
    };
  }, []);

  const segna = useCallback(async (id: string, fatta: boolean) => {
    //  ⚠️ SI RILEGGE PRIMA DI SCRIVERE. La lista è condivisa: riscrivere
    //   quella che sta a schermo cancellerebbe la spunta messa da un altro
    //   nello stesso minuto, senza nessun errore. È la stessa disciplina di
    //   `applicaGesto` in crm/dafare/task-manuali, e per lo stesso motivo.
    const fresche = leggiDaTesto(await archivio.leggi(CHIAVE_CHIUSE).catch(() => null));
    const nuove = { ...fresche };
    if (fatta) nuove[id] = new Date().toISOString().slice(0, 10);
    else delete nuove[id];
    valore = nuove;
    letta = true;
    avvisa();
    return archivio.scrivi(CHIAVE_CHIUSE, JSON.stringify(nuove));
  }, []);

  return { chiuse, segna };
}
