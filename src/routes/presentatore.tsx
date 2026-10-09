// Pagina di accesso del PRESENTATORE: si arriva qui, si sceglie il proprio nome,
// si inserisce il PIN e si entra nel software pronti per fare consulenze.
// Sblocca anche l'accesso "consulente" (come il link magico ?unlock=) così non
// serve più ricordarsi la chiave: basta il PIN personale.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserRound, Lock, ArrowLeft, Presentation } from "lucide-react";
import { BrandLogo } from "@/shop/BrandLogo";
import { setPresenter, usePresenter, clearPresenter, type Presenter } from "@/shop/presenter";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/presentatore")({
  head: () => ({
    meta: [
      { title: "Accesso presentatore — Hair Genius Labs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PresentatorePage,
});

function PresentatorePage() {
  const navigate = useNavigate();
  const me = usePresenter();
  const [list, setList] = useState<Presenter[] | null>(null);
  const [sel, setSel] = useState<Presenter | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    /*  ⚠️ «Caricamento…» NON PUÒ DURARE PER SEMPRE. Con una richiesta che non
        torna né bene né male — rete mobile che sparisce, risposta persa per
        strada — questa schermata restava così a tempo indeterminato, e da
        fuori sembrava il programma bloccato. Dopo otto secondi si smette di
        aspettare e si mostra l'elenco vuoto, che almeno dice cosa fare. */
    let vivo = true;
    const taglia = setTimeout(() => { if (vivo) setList((l) => (l === null ? [] : l)); }, 8000);
    fetch("/api/presenter/presenters")
      .then((r) => r.json())
      .then((j) => { if (vivo) setList((j.presenters as Presenter[]) ?? []); })
      .catch(() => { if (vivo) setList([]); })
      .finally(() => clearTimeout(taglia));
    return () => { vivo = false; clearTimeout(taglia); };
  }, []);

  /** ── ENTRA NEL SOFTWARE, E APRE LA CONSULENZA ─────────────────────────
   *  ⚠️ QUI SI APRIVA IL PREVENTIVO, ed è la seconda metà del guasto segnalato
   *   dal committente: «Avvia consulenza» dal CRM manda a /presenta, ma chi non
   *   ha ancora fatto il PIN passa da questa pagina — che al termine del login
   *   apriva il modulo dei prezzi. Risultato identico a prima: la stanza è
   *   creata, il cliente aspetta, e il consulente si ritrova davanti un
   *   preventivo vuoto.
   *  Si apre la presentazione, che è il posto da cui si fa la consulenza e da
   *  cui si copia il link per il cliente. Il preventivo si raggiunge da lì
   *  dentro, con la barra del presentatore.
   *  ⚠️ Se una stanza è già stata creata (LIVE_KEY, scritta da «Avvia» nel
   *   CRM) si va comunque su /presenta: è proprio il caso in cui qualcuno sta
   *   aspettando dall'altra parte. */
  const enter = async () => {
    try {
      localStorage.setItem("hg_consultant", "1");
    } catch {
      /* */
    }
    /*  ── ⚠️ QUI SI CAMBIA PAGINA DAVVERO, NON «DA DENTRO» ───────────────
        Segnalazione del committente, due sere di fila: subito dopo aver fatto
        il PIN, «Importing a module script failed». Il sito stava bene (ho
        controllato i pezzi di /presenta uno per uno: c'erano tutti). Era
        questa riga: `navigate` resta nella pagina già aperta e chiede i pezzi
        di /presenta con i NOMI che conosceva quella pagina — e questa
        schermata di accesso è, per sua natura, quella che sta aperta più a
        lungo prima di muoversi, spesso a cavallo di una pubblicazione.
        Il soccorso automatico c'è (vedi `ricaricaPerPezzoMancante`) ma qui non
        serve neanche: dopo un accesso, caricare la pagina da capo costa un
        attimo e non c'è niente da conservare. Un ricaricamento pulito toglie
        il guasto invece di rimediarvi. */
    try {
      window.location.assign("/presenta");
      return;
    } catch {
      /* se non si può, si prova comunque a spostarsi dall'interno */
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigate({ to: "/presenta" as any });
  };

  const login = async () => {
    if (!sel || busy) return;
    setBusy(true);
    setErr("");
    try {
      const j = await fetch("/api/presenter/presenters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", id: sel.id, pin }),
      }).then((r) => r.json());
      if (!j.ok) {
        setErr("PIN errato");
        setPin("");
        setBusy(false);
        return;
      }
      setPresenter(j.presenter as Presenter);
      await enter();
    } catch {
      setErr("Errore di rete");
    }
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#071228] via-[#050f24] to-[#03081a] px-6 py-10 text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 right-6 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <BrandLogo className="h-9 w-auto" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Accesso presentatore</h1>
          <p className="max-w-xs text-sm text-white/50">
            {me
              ? "Sei già identificato: puoi iniziare la consulenza."
              : "Scegli il tuo nome e inserisci il PIN per iniziare."}
          </p>
        </div>

        {/* già identificato → entra subito o cambia utente */}
        {me ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/20 text-lg font-semibold text-brand">
              {me.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="mb-4 text-sm font-semibold">{me.name}</div>
            <button
              onClick={enter}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold shadow-lg shadow-brand/25 transition hover:brightness-110"
            >
              <Presentation className="h-4 w-4" /> Inizia consulenza
            </button>
            <button
              onClick={() => {
                clearPresenter();
                setSel(null);
                setPin("");
              }}
              className="w-full rounded-xl border border-white/12 bg-white/5 py-2.5 text-xs text-white/70 transition hover:bg-white/10"
            >
              Cambia presentatore
            </button>
          </div>
        ) : list === null ? (
          <div className="py-10 text-center text-sm text-white/40">Caricamento…</div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center text-sm text-white/60">
            Nessun presentatore configurato.
            <span className="mt-1 block text-xs text-white/40">
              Aggiungine uno da Impostazioni → Presentatori.
            </span>
            <button
              onClick={enter}
              className="mt-4 w-full rounded-xl border border-white/12 bg-white/5 py-2.5 text-xs text-white/70 transition hover:bg-white/10"
            >
              Entra comunque
            </button>
          </div>
        ) : !sel ? (
          <div className="space-y-2">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSel(p);
                  setPin("");
                  setErr("");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-brand/50 hover:bg-brand/10"
              >
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
            <button
              onClick={() => {
                setSel(null);
                setPin("");
                setErr("");
              }}
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50 transition hover:text-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Cambia nome
            </button>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand">
                {sel.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-semibold">{sel.name}</span>
            </div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
              <Lock className="h-3 w-3" /> PIN
            </label>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setErr("");
              }}
              onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && login()}
              placeholder="••••"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-brand"
            />
            {err && <div className="mt-2 text-center text-xs text-red-400">{err}</div>}
            <button
              onClick={login}
              disabled={pin.length !== 4 || busy}
              className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? "Verifica…" : "Entra"}
            </button>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}
