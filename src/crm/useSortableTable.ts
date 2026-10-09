import { useCallback, useMemo, useState } from "react";

// Hook tri-state per tabelle ordinabili (stile Meta Ads Manager).
// Click 1: desc (numero/data più grande in cima, alfabetico Z→A)
// Click 2: asc
// Click 3: reset (ordine originale)
// Cambiare colonna ricomincia da desc.

export type SortDir = "desc" | "asc" | null;

export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

export function useSortableTable<K extends string>() {
  const [sort, setSort] = useState<SortState<K>>({ key: null, dir: null });

  const onHeaderClick = useCallback((key: K) => {
    setSort((cur) => {
      if (cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      if (cur.dir === "asc") return { key: null, dir: null };
      return { key, dir: "desc" };
    });
  }, []);

  const reset = useCallback(() => setSort({ key: null, dir: null }), []);

  return { sort, onHeaderClick, reset, setSort };
}

// Helper: ordina un array in base allo stato sort + accessor.
// Se sort.key è null o dir è null, ritorna l'array originale (sort fallback applicato a monte dal chiamante).
export function applySort<T, K extends string>(
  items: T[],
  sort: SortState<K>,
  getValue: (item: T, key: K) => number | string | null | undefined,
): T[] {
  if (!sort.key || !sort.dir) return items;
  const k = sort.key;
  const dir = sort.dir;
  const arr = [...items];
  arr.sort((a, b) => {
    const va = getValue(a, k);
    const vb = getValue(b, k);
    // null/undefined sempre in fondo
    const aNull = va == null || (typeof va === "number" && !isFinite(va));
    const bNull = vb == null || (typeof vb === "number" && !isFinite(vb));
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    let cmp: number;
    if (typeof va === "number" && typeof vb === "number") {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), "it", { numeric: true, sensitivity: "base" });
    }
    return dir === "desc" ? -cmp : cmp;
  });
  return arr;
}
