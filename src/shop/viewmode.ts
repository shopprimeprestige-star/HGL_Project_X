// Stato condiviso dell'anteprima dispositivo (mobile/tablet/desktop + zoom).
// I pulsanti stanno nella barra sticky in basso (PresenterBar), ma pilotano
// il rendering in DeviceFrame. Persistito in localStorage.
import { useEffect, useState } from "react";
import { setViewZoom } from "@/shop/call";

// "auto" = anteprima alle dimensioni REALI del dispositivo del cliente collegato
// (se nessun ospite è connesso si comporta come "desktop": layout nativo).
/** ⚠️ `tutte` mostra i tre dispositivi affiancati: chi condivide un contenuto
 *  deve poter vedere com'è su tutti gli schermi senza cambiare modalità tre
 *  volte e senza fidarsi della memoria. */
export type ViewMode = "auto" | "mobile" | "tablet" | "desktop" | "tutte";
interface VM { mode: ViewMode; zoom: number }

let state: VM = { mode: "desktop", zoom: 1 };
let loaded = false;
const listeners = new Set<(v: VM) => void>();
const emit = () => listeners.forEach((cb) => cb(state));

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const m = localStorage.getItem("hg_viewmode") as ViewMode | null;
  const z = Number(localStorage.getItem("hg_viewzoom")) || 1;
  state = { mode: (["auto", "mobile", "tablet", "desktop", "tutte"].includes(m || "") ? (m as ViewMode) : "auto"), zoom: z >= 0.4 && z <= 4 ? z : 1 };
}

export function setMode(mode: ViewMode) {
  state = { ...state, mode };
  if (typeof window !== "undefined") localStorage.setItem("hg_viewmode", mode);
  setViewZoom(1); // il guest NON eredita lo zoom dell'anteprima: sempre adattato al suo schermo
  emit();
}
export function setZoom(z: number) {
  const c = Math.min(3, Math.max(0.5, Math.round(z * 20) / 20));
  state = { ...state, zoom: c };
  if (typeof window !== "undefined") localStorage.setItem("hg_viewzoom", String(c));
  setViewZoom(1); // lo zoom resta solo nell'anteprima del presentatore, mai sul guest
  emit();
}
export function useViewMode(): VM {
  load();
  const [v, setV] = useState<VM>(state);
  useEffect(() => { setV(state); listeners.add(setV); return () => { listeners.delete(setV); }; }, []);
  return v;
}
