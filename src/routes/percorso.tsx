import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, Download, ArrowRight } from "lucide-react";
import { PercorsoTimeline, fmtDate, type Steps } from "@/shop/percorso-timeline";
import { DeviceFrame } from "@/shop/DeviceFrame";
import { BrandLogo } from "@/shop/BrandLogo";

export const Route = createFileRoute("/percorso")({
  head: () => ({
    meta: [
      { title: "Il tuo percorso — Hair Genius Labs" },
      {
        name: "description",
        content: "Tutti i passaggi fino all'installazione del tuo impianto personalizzato.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <DeviceFrame>
      <PercorsoPage />
    </DeviceFrame>
  ),
});

const fmt = fmtDate;

function PercorsoPage() {
  const [ref, setRef] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [start, setStart] = useState<Date | null>(null);
  const [steps, setSteps] = useState<Steps>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    setLoading(true);
    //  ⚠️ `segui=1`: qui il rimando SI SEGUE. Questa pagina racconta la
    //   lavorazione in corso, e di un preventivo annullato non si produce
    //   niente — il percorso da mostrare è quello del documento valido.
    //   È il contrario di /preventivo, che dal vecchio numero mostra apposta il
    //   vecchio documento con sopra scritto che è annullato.
    fetch(`/api/public/quote?ref=${encodeURIComponent(id)}&segui=1`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;
        const q = j.quote;
        setRef(q.quote_ref);
        setNome(`${q.nome ?? ""} ${q.cognome ?? ""}`.trim());
        setStart(new Date(q.timeline_start || q.created_at));
        setSteps((q.timeline_steps ?? {}) as Steps);
      })
      .finally(() => {
        setLoading(false);
        // apertura da "Scarica PDF": stampa automatica appena pronto
        if (new URLSearchParams(window.location.search).get("print") === "1") {
          setTimeout(() => window.print(), 700);
        }
      });
  }, []);

  return (
    <div className="bg-blueprint min-h-screen text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#081634]/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center">
            <BrandLogo className="h-6 w-auto" />
          </a>
          {ref && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium transition hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* intestazione */}
        <section className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.25em] text-brand">Il tuo percorso</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Dal selfie alla tua installazione
          </h1>
          <p className="mx-auto mt-2 max-w-md text-white/60">
            Segui tutti i passaggi fino all'installazione.
          </p>
          {ref && (
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
              {nome && <span className="font-medium">{nome}</span>}
              <span className="font-mono text-brand">{ref}</span>
              {start && <span className="text-white/50">Inizio: {fmt(start)}</span>}
            </div>
          )}
          {loading && <p className="mt-4 text-sm text-white/40">Caricamento…</p>}
        </section>

        <PercorsoTimeline start={start} steps={steps} />

        {!ref && !loading && (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-sm text-white/55">
            Questa è la panoramica del percorso. Dopo aver confermato il preventivo riceverai la tua
            pagina personale con
            <span className="text-white"> le date indicative</span> di ogni fase.
          </p>
        )}

        <div className="mt-8 flex justify-center print:hidden">
          <a
            href="/preventivo"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium transition hover:bg-white/10"
          >
            <CalendarClock className="h-4 w-4" /> Vai al preventivo{" "}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </main>
    </div>
  );
}
