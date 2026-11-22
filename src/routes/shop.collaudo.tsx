/** ── SHOP · LA PAGINA DEL COLLAUDO (T67, PIANO-R2 D57) ───────────────────────────────────────────────────────────
 *  `/shop/collaudo#k=<chiave>`: legge la chiave dal FRAMMENTO (il browser non lo manda al server), lo toglie subito dalla cronologia, lo
 *  manda con un POST a `/api/public/shop-collaudo` e, se la chiave vale, RICARICA il negozio (`/shop`) da zero: il server vede il cookie
 *  e la visita parte pulita (la modalità del catalogo si legge una volta per visita). Nessuno script di terzi: la pagina non è fra le
 *  ammesse ai pixel; non si indicizza e non si tiene in cache. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CACHE_COLLAUDO, chiaveDaFrammento } from "@/shop/cms/collaudo";

export const Route = createFileRoute("/shop/collaudo")({
  headers: () => ({ "Cache-Control": CACHE_COLLAUDO }),
  head: () => ({
    meta: [
      { title: "Collaudo del negozio — Hair Genius" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PaginaCollaudo,
});

type Stato = "apro" | "errore";

function PaginaCollaudo() {
  const [stato, setStato] = useState<Stato>("apro");
  // la chiave si legge UNA volta: dopo averla tolta dall'indirizzo, una seconda lettura (sviluppo) non la ritroverebbe
  const letta = useRef<{ k: string | null } | null>(null);
  useEffect(() => {
    if (!letta.current) {
      letta.current = { k: chiaveDaFrammento(window.location.hash) };
      window.history.replaceState(null, "", window.location.pathname);
    }
    const k = letta.current.k;
    if (!k) {
      setStato("errore");
      return;
    }
    let vivo = true;
    fetch("/api/public/shop-collaudo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      body: JSON.stringify({ k }),
    })
      .then((r) => {
        if (r.ok) window.location.assign("/shop");
        else if (vivo) setStato("errore");
      })
      .catch(() => vivo && setStato("errore"));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className="mx-auto max-w-md py-16 text-center" aria-live="polite">
      {stato === "apro" ? (
        <>
          <h1 className="text-xl font-semibold text-white">Apro il collaudo…</h1>
          <p className="mt-3 text-sm text-white/70">Ancora un istante: ti porto nel negozio.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-white">Il link non è più valido</h1>
          <p className="mt-3 text-sm text-white/70">
            Il link del collaudo dura due ore e vale una visita sola per telefono. Chiedine uno
            nuovo dal CRM, nella scheda Cassa.
          </p>
        </>
      )}
    </section>
  );
}
