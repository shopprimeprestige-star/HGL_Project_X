import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, Menu } from "lucide-react";
import { CartProvider, useCart } from "@/shop/CartContext";
import { Toaster } from "@/components/ui/sonner";
import logo from "@/assets/logo-hair-genius.png";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Hair Genius Shop — Toupee e prodotti per la cura" },
      {
        name: "description",
        content:
          "Protesi lace e skin indistinguibili, shampoo, balsami, districanti, solventi e adesivi. Tutto per chi indossa un toupee.",
      },
    ],
  }),
  component: ShopLayout,
});

function CartButton() {
  const { count } = useCart();
  return (
    <Link
      to="/shop/carrello"
      className="relative flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-brand hover:bg-white/10"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Carrello</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

function Header() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const linkCls = (active: boolean) =>
    `text-sm transition ${active ? "text-white" : "text-white/60 hover:text-white"}`;
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/shop" className="flex items-center gap-2">
          <img src={logo} alt="Hair Genius" className="h-8 w-8 rounded-md object-contain" />
          <span className="text-sm font-semibold tracking-tight text-white">
            Hair Genius <span className="text-brand">Shop</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/shop" className={linkCls(path === "/shop")}>
            Catalogo
          </Link>
          <a href="/preventivo" className="text-sm text-white/60 transition hover:text-white">
            Preventivo su misura
          </a>
          <a href="/" className="text-sm text-white/60 transition hover:text-white">
            Analisi gratuita
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <CartButton />
        </div>
      </div>
    </header>
  );
}

function ShopFooter() {
  return (
    <footer className="bg-footer border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Hair Genius" className="h-9 w-9 rounded-md object-contain" />
          <p className="text-sm text-white/60">
            Hair Genius Labs · Protesi e cura di grado premium
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/45">
            <a href="/privacy-policy" className="hover:text-white/80">Privacy</a>
            <a href="/termini-e-condizioni" className="hover:text-white/80">Termini</a>
            <a href="/cookie-policy" className="hover:text-white/80">Cookie</a>
            <Link to="/shop" className="hover:text-white/80">Catalogo</Link>
          </div>
          <p className="mt-2 text-[11px] text-white/30">
            © {new Date().getFullYear()} Hair Genius Labs SRLS · Spedizione gratuita sopra €59
          </p>
        </div>
      </div>
    </footer>
  );
}

function ShopLayout() {
  return (
    <CartProvider>
      <div className="bg-blueprint min-h-screen text-white">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <Outlet />
        </main>
        <ShopFooter />
        <Toaster />
      </div>
    </CartProvider>
  );
}
