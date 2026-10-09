// Bus globale "auto-duck": quando il presentatore parla, i player video di
// QUALSIASI pagina (slide, sito, preventivo) abbassano leggermente il volume,
// e lo rialzano istantaneamente appena smette. Un solo stato condiviso.
import { useEffect, useState } from "react";

let speaking = false;
const listeners = new Set<(v: boolean) => void>();

export function setSpeaking(v: boolean) {
  if (v === speaking) return;
  speaking = v;
  listeners.forEach((cb) => cb(v));
}
export function isSpeaking() { return speaking; }

/** true quando il presentatore sta parlando (per abbassare il volume dei video). */
export function useSpeaking(): boolean {
  const [v, setV] = useState(speaking);
  useEffect(() => { setV(speaking); listeners.add(setV); return () => { listeners.delete(setV); }; }, []);
  return v;
}

/** Fattore di volume da applicare a un player: 1 normale, 0.18 in "ducking". */
export const DUCK_FACTOR = 0.18;
