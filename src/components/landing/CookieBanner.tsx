import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "hgl_cookie_consent_v1";

export function CookieBanner() {
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

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Preferenze cookie"
      className="fixed bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:bottom-4 sm:max-w-sm z-50"
    >
      <div className="relative bg-navy-deep/95 backdrop-blur-md border border-brand/30 rounded-sm shadow-xl px-4 py-3.5 text-white">
        <button
          aria-label="Chiudi"
          onClick={() => close("reject")}
          className="absolute top-2 right-2 text-white/50 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="text-[0.6rem] tracking-[0.22em] uppercase text-brand font-semibold mb-1.5">
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
            className="flex-1 bg-brand hover:bg-brand/90 text-brand-foreground text-[0.7rem] tracking-widest uppercase font-semibold py-2 rounded-sm transition-colors"
          >
            Accetta
          </button>
          <button
            onClick={() => close("reject")}
            className="flex-1 border border-white/20 hover:border-white/40 text-white/80 hover:text-white text-[0.7rem] tracking-widest uppercase font-semibold py-2 rounded-sm transition-colors"
          >
            Rifiuta
          </button>
        </div>
      </div>
    </div>
  );
}
