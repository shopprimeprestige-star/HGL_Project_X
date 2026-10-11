// Presentatore selezionato (multi-presentatore con PIN).
// Il presentatore sceglie il proprio nome all'apertura e sblocca con un PIN a 4 cifre.
// Il risultato resta in localStorage: hg_presenter = {id,name}
import { useEffect, useState } from "react";

export const PRESENTER_KEY = "hg_presenter";
export interface Presenter { id: string; name: string }

const listeners = new Set<(p: Presenter | null) => void>();
const emit = () => { const p = getPresenter(); listeners.forEach((cb) => cb(p)); };

export function getPresenter(): Presenter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRESENTER_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Presenter;
    return o && o.id ? o : null;
  } catch { return null; }
}
export function setPresenter(p: Presenter) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESENTER_KEY, JSON.stringify({ id: p.id, name: p.name }));
  emit();
}
export function clearPresenter() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PRESENTER_KEY);
  emit();
}
export function usePresenter(): Presenter | null {
  const [p, setP] = useState<Presenter | null>(null);
  useEffect(() => { setP(getPresenter()); listeners.add(setP); return () => { listeners.delete(setP); }; }, []);
  return p;
}
