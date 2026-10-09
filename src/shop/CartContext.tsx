import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PRODUCTS, type Product } from "./catalog";

export interface CartLine {
  productId: string;
  qty: number;
  variant?: Record<string, string>; // es. { Colore: "1B", Lunghezza: '8"' }
  key: string; // productId + variant serializzato
}

interface CartContextValue {
  lines: CartLine[];
  add: (product: Product, qty: number, variant?: Record<string, string>) => void;
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

  const add: CartContextValue["add"] = (product, qty, variant) => {
    const key = makeKey(product.id, variant);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + qty) } : l));
      }
      return [...prev, { productId: product.id, qty, variant, key }];
    });
  };

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
  const subtotal = lines.reduce((s, l) => {
    const p = PRODUCTS.find((pr) => pr.id === l.productId);
    return s + (p ? p.price * l.qty : 0);
  }, 0);

  return (
    <CartContext.Provider value={{ lines, add, setQty, remove, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
