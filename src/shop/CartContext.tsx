import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PRODUCTS, type Product } from "./catalog";
import { subtotaleRighe, type SnapRiga } from "./cms/carrello";

export interface CartLine {
  productId: string;
  qty: number;
  variant?: Record<string, string>; // es. { Colore: "1B", Lunghezza: '8"' }
  key: string; // productId + variant serializzato
  /** Solo con il catalogo CMS (T12): `productId` è lo SKU della variante e `snap` ciò che serve a disegnare la riga. Le righe vecchie non li hanno. */
  sku?: string;
  snap?: SnapRiga;
}

interface CartContextValue {
  lines: CartLine[];
  add: (product: Pick<Product, "id">, qty: number, variant?: Record<string, string>, cms?: { sku: string; snap: SnapRiga }) => void;
  /** Sostituisce le righe (dopo `ripulisciRighe`, quando il server dice che qualcosa non c'è più). */
  replaceLines: (lines: CartLine[]) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "hg_shop_cart_v1";

function makeKey(productId: string, variant?: Record<string, string>): string {
  if (!variant || Object.keys(variant).length === 0) return productId;
  const parts = Object.keys(variant)
    .sort()
    .map((k) => `${k}:${variant[k]}`);
  return `${productId}|${parts.join("|")}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* noop */
    }
  }, [lines, hydrated]);

  const add: CartContextValue["add"] = (product, qty, variant, cms) => {
    // catalogo CMS: la riga è la variante (`productId` = SKU); catalogo del codice: come sempre
    const key = cms ? cms.sku : makeKey(product.id, variant);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + qty), ...(cms ? { snap: cms.snap } : {}) } : l));
      }
      return [...prev, cms ? { productId: cms.sku, qty, variant, key, sku: cms.sku, snap: cms.snap } : { productId: product.id, qty, variant, key }];
    });
  };

  const replaceLines: CartContextValue["replaceLines"] = (next) => setLines(next);

  const setQty: CartContextValue["setQty"] = (key, qty) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, qty) } : l)),
    );
  };

  const remove: CartContextValue["remove"] = (key) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const clear = () => setLines([]);

  const count = lines.reduce((s, l) => s + l.qty, 0);
  // righe vecchie: prezzi di PRODUCTS come sempre; righe CMS (con `sku`): dai centesimi di `snap`
  const subtotal = subtotaleRighe(lines, (id) => PRODUCTS.find((pr) => pr.id === id)?.price);

  return (
    <CartContext.Provider value={{ lines, add, replaceLines, setQty, remove, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
