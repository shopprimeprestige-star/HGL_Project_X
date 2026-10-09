// Schermata brandizzata "Seleziona presentatore" — mostrata al consulente
// PRIMA di ogni altra cosa, se sono stati configurati dei presentatori.
// Scelto il nome, viene chiesto il PIN a 4 cifre; il presentatore resta in localStorage.
import { useEffect, useState } from "react";
import { UserRound, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/shop/BrandLogo";
import { setPresenter, type Presenter } from "@/shop/presenter";

export function PresenterGate({ onDone }: { onDone?: () => void }) {
  const [list, setList] = useState<Presenter[] | null>(null);
  const [sel, setSel] = useState<Presenter | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/presenter/presenters")
      .then((r) => r.json())
      .then((j) => setList((j.presenters as Presenter[]) ?? []))
      .catch(() => setList([]));
  }, []);

  // nessun presentatore configurato → non bloccare l'utente, solo un suggerimento
  useEffect(() => {
    if (list && list.length === 0) {
      toast("Nessun presentatore configurato", { description: "Aggiungine uno da Impostazioni → Presentatori." });
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const login = async () => {
    if (!sel) return;
    setBusy(true); setErr("");
    try {
      const j = await fetch("/api/presenter/presenters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", id: sel.id, pin }),
      }).then((r) => r.json());
      if (!j.ok) { setErr("PIN errato"); setPin(""); setBusy(false); return; }
      setPresenter(j.presenter as Presenter);
      onDone?.();
    } catch { setErr("Errore di rete"); }
    setBusy(false);
  };

  if (list === null) return null;      // ancora in caricamento: nessun blocco visivo
  if (list.length === 0) return null;  // nessun presentatore configurato → si procede come prima

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-[#071228] via-[#050f24] to-[#03081a] px-6 py-10 text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandLogo className="h-9 w-auto" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Seleziona presentatore</h1>
          <p className="max-w-xs text-sm text-white/50">Scegli il tuo nome e inserisci il PIN per iniziare.</p>
        </div>

        {!sel ? (
          <div className="space-y-2">
            {list.map((p) => (
              <button key={p.id} type="button" onClick={() => { setSel(p); setPin(""); setErr(""); }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-brand/50 hover:bg-brand/10">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-sm font-semibold">{p.name}</span>
                <UserRound className="ml-auto h-4 w-4 text-white/30" />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <button type="button" onClick={() => { setSel(null); setErr(""); }} className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Cambia nome
            </button>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-brand" /> PIN di {sel.name}</div>
            <input autoFocus inputMode="numeric" maxLength={4} value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") login(); }}
              placeholder="••••"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-3 text-center text-2xl tracking-[0.6em] text-white placeholder:text-white/20 focus:border-brand focus:outline-none" />
            {err && <p className="mt-2 text-center text-[12px] text-red-400">{err}</p>}
            <button type="button" onClick={login} disabled={busy || pin.length < 4}
              className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {busy ? "Verifica…" : "Entra"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
