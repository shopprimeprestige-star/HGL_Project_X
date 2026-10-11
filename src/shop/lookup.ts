// ── "STO CERCANDO IL TUO PREVENTIVO" ───────────────────────────────────────
//  Quando il consulente apre l'elenco dei preventivi, dall'altra parte non
//  succede niente: il cliente resta davanti a una pagina ferma e non sa se lo
//  stai ascoltando, se è caduta la linea o se deve dire qualcosa.
//  Questo interruttore è il ponte fra le due cose: lo alza il pannello di
//  ricerca, lo legge la pagina del preventivo, che lo mette nel proprio stato e
//  lo fa arrivare al cliente insieme a tutto il resto.
//
//  Vive fuori da React perché chi lo alza (la barra del presentatore) e chi lo
//  legge (la pagina) non sono parenti: passarlo per props vorrebbe dire farlo
//  attraversare mezza applicazione.
import { useEffect, useState } from "react";

let attivo = false;
const ascoltatori = new Set<(v: boolean) => void>();

/** Alza o abbassa l'avviso mostrato al cliente. */
export function setLookup(v: boolean) {
  if (attivo === v) return;
  attivo = v;
  ascoltatori.forEach((f) => { try { f(v); } catch { /* */ } });
}
export function getLookup(): boolean { return attivo; }

export function useLookup(): boolean {
  const [v, setV] = useState(attivo);
  useEffect(() => {
    setV(attivo);
    ascoltatori.add(setV);
    return () => { ascoltatori.delete(setV); };
  }, []);
  return v;
}
