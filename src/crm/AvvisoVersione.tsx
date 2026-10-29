/** ── «NUOVA VERSIONE DEL CRM · RICARICA» (29/10/2026) ─────────────────────────
 *
 *  Il guardiano della versione per tutto il CRM: sta nel guscio (routes/CRM.tsx)
 *  e in /chat, che il guscio non ce l'ha. Le regole sono in `crm/versione-crm`
 *  (pure, provate); qui solo la pagina, la rete e il browser.
 *   · ogni 60 s, a pagina visibile, e al ritorno sulla pagina (visibilitychange,
 *     pageshow, focus) rilegge l'indirizzo attuale senza cache, con un tetto di 10 s;
 *   · versione nuova e niente di scritto né finestre aperte → si ricarica da sola;
 *   · altrimenti la barra in alto, e decide chi lavora.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  avvioDaHtml,
  decidiVersione,
  deveControllare,
  leggiRicaricate,
  segnaRicaricata,
  SEGNO_RICARICATE,
} from "@/crm/versione-crm";

/** Qualcosa che una ricarica butterebbe via: una finestra aperta, un testo scritto. */
function paginaOccupata(): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  const campi = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="tel"], input[type="url"], input[type="number"]',
  );
  if (Array.from(campi).some((x) => x.value.trim() !== "")) return true;
  return Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"]')).some(
    (x) => (x.textContent ?? "").trim() !== "",
  );
}

export function AvvisoVersione() {
  const [nuova, setNuova] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const avvioQui = avvioDaHtml(document.documentElement.outerHTML);
    const viste = new Map<string, string>();
    let ultimo = 0;
    let inVolo = false;
    let finito = false;
    let vivo = true;

    const guarda = async (ritorno: boolean) => {
      const ora = Date.now();
      const visibile = document.visibilityState !== "hidden";
      if (finito || inVolo || !deveControllare({ ora, ultimo, visibile, ritorno })) return;
      inVolo = true;
      ultimo = ora;
      const dove = window.location.pathname;
      const ferma = new AbortController();
      const tetto = setTimeout(() => ferma.abort(), 10_000);
      try {
        const r = await fetch(dove, {
          cache: "no-store",
          credentials: "same-origin",
          signal: ferma.signal,
        });
        const html = r.ok ? await r.text() : "";
        if (!vivo) return;
        let gia: string[] = [];
        try {
          gia = leggiRicaricate(sessionStorage.getItem(SEGNO_RICARICATE));
        } catch {
          /* niente archiviazione: nessuna ricarica ricordata */
        }
        const esito = decidiVersione({
          html,
          avvioQui,
          vista: viste.get(dove) ?? "",
          giaRicaricate: gia,
          occupato: paginaOccupata(),
        });
        if (esito.cosa === "niente") {
          if (esito.vista) viste.set(dove, esito.vista);
          return;
        }
        finito = true;
        if (esito.cosa === "avvisa") {
          setNuova(true);
          return;
        }
        try {
          sessionStorage.setItem(
            SEGNO_RICARICATE,
            JSON.stringify(segnaRicaricata(gia, esito.impronta)),
          );
        } catch {
          //  Senza il segno non c'è freno alla ricarica a catena: meglio la barra.
          setNuova(true);
          return;
        }
        window.location.reload();
      } catch {
        /* rete assente o tetto scaduto: si riprova al prossimo giro */
      } finally {
        clearTimeout(tetto);
        inVolo = false;
      }
    };

    const giro = () => void guarda(false);
    const torna = () => void guarda(true);
    void guarda(true);
    const t = setInterval(giro, 60_000);
    document.addEventListener("visibilitychange", torna);
    window.addEventListener("pageshow", torna);
    window.addEventListener("focus", torna);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", torna);
      window.removeEventListener("pageshow", torna);
      window.removeEventListener("focus", torna);
    };
  }, []);

  if (!nuova) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3"
      style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-card py-1 pl-4 pr-1 text-[13px] text-foreground shadow-md">
        <span>Nuova versione del CRM</span>
        <Button
          size="sm"
          className="h-11 rounded-full px-4 md:h-8"
          onClick={() => window.location.reload()}
        >
          Ricarica
        </Button>
      </div>
    </div>
  );
}
