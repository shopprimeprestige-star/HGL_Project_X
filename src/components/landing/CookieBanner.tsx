import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "hgl_cookie_consent_v1";

/** `completo` è il banner di sempre (home, shop, blog). `compatto` è quello di `/soluzioni`: una striscia in basso, bassa
 *  quanto la barra delle patch, senza blu pieno (la schermata ha già il suo) e con «Accetta» e «Rifiuta» dello stesso peso,
 *  in contorno. Non copre la tavola delle tre soluzioni. */
export function CookieBanner({ variante = "completo" }: { variante?: "completo" | "compatto" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (!v) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const close = (value: "accept" | "reject") => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  if (!visible) return null;

  if (variante === "compatto") {
    //  Alto 36 da vedere, 44 da toccare (::before): tutta la striscia sta nei ~50 px della barra delle patch.
    const tasto =
      "relative h-9 min-w-[64px] shrink-0 rounded-md border border-white/60 px-2.5 text-xs font-semibold uppercase tracking-wider text-white before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
    return (
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Preferenze cookie"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/20 bg-[#0A1430] px-3 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 text-white"
      >
        <div className="mx-auto flex max-w-[1200px] items-center gap-2.5">
          <p className="min-w-0 flex-1 text-[13px] leading-[1.25] text-white/85">
            Cookie tecnici; analytics solo se accetti.{" "}
            <a href="/cookie-policy" className="underline">
              Cookie Policy
            </a>
          </p>
          <button onClick={() => close("accept")} className={tasto}>
            Accetta
          </button>
          <button onClick={() => close("reject")} className={tasto}>
            Rifiuta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Preferenze cookie"
      className="fixed bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:bottom-4 sm:max-w-sm z-50"
    >
      <div className="relative bg-navy-deep/95 backdrop-blur-md border border-brand/30 rounded-md shadow-galleggiante px-4 py-3.5 text-white">
        <button
          aria-label="Chiudi"
          onClick={() => close("reject")}
          className="absolute top-2 right-2 text-white/50 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="text-etichetta tracking-[0.22em] uppercase text-brand font-semibold mb-1.5">
          Cookie
        </div>
        <p className="text-xs leading-relaxed text-white/75 pr-4">
          Usiamo cookie tecnici e, previo consenso, di analytics. Vedi la{" "}
          <a href="/cookie-policy" className="underline hover:text-brand">
            Cookie Policy
          </a>
          .
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => close("accept")}
            className="flex-1 bg-brand hover:bg-brand/90 text-brand-foreground text-[0.7rem] tracking-widest uppercase font-semibold py-2 rounded-md transition-colors"
          >
            Accetta
          </button>
          <button
            onClick={() => close("reject")}
            className="flex-1 border border-white/20 hover:border-white/40 text-white/80 hover:text-white text-[0.7rem] tracking-widest uppercase font-semibold py-2 rounded-md transition-colors"
          >
            Rifiuta
          </button>
        </div>
      </div>
    </div>
  );
}
