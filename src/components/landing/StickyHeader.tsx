import { useEffect, useState } from "react";
import logo from "@/assets/logo-hair-genius.png";
import { sound, haptic } from "@/hooks/use-haptic";

export function StickyHeader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.85);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBooking = () => {
    haptic("select");
    sound("success");
    const el = document.getElementById("prenota");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-blueprint border-b border-white/10 transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-3">
        <a href="#top" className="flex items-center shrink-0">
          <img
            src={logo}
            alt="Hair Genius Labs"
            className="h-8 sm:h-9 w-auto select-none"
            draggable={false}
          />
        </a>
        <button
          onClick={scrollToBooking}
          className="ng-header-cta inline-flex items-center gap-2 text-[0.7rem] sm:text-xs tracking-[0.2em] uppercase font-bold px-4 sm:px-5 py-2.5 rounded-md"
        >
          Prenota Analisi
        </button>
      </div>
    </header>
  );
}
