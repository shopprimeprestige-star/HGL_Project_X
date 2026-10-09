/** ── IMPOSTAZIONI · INTELLIGENZA ARTIFICIALE ───────────────────────────────
 *
 *  Una chiave e un tasto per provarla. La chiave è quella di OpenRouter, che è
 *  il passaggio unico verso i modelli: si paga lì, e da lì si arriva a tutti.
 *
 *  ── ⚠️ IL CAMPO PARTE SEMPRE VUOTO ───────────────────────────────────────
 *  Anche quando una chiave c'è. Il server non la restituisce — chi ce l'ha può
 *  spendere — quindi qui si vedono solo le ultime quattro cifre, che bastano a
 *  riconoscerla. Vuoto vuol dire «non l'ho toccata»: sta scritto sotto al
 *  campo, perché altrimenti sembra che il salvataggio non abbia funzionato.
 *
 *  ── ⚠️ «SALVATO» NON VUOL DIRE «FUNZIONA» ────────────────────────────────
 *  Una chiave scaduta si salva benissimo, e poi non esce nessuna immagine —
 *  senza che niente lo dica. Per questo c'è «Prova adesso»: chiede davvero a
 *  OpenRouter chi è quella chiave e quanto credito resta, che è la prima cosa
 *  che finisce quando le immagini smettono di uscire.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Key, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { intestazioniCRM, fetchCRM } from "./AuthContext";

interface Modello {
  id: string;
  nome: string;
}

export function ImpostazioniAI() {
  const [pronto, setPronto] = useState(false);
  const [coda, setCoda] = useState("");
  const [modello, setModello] = useState("");
  const [nuova, setNuova] = useState("");
  const [modelli, setModelli] = useState<Modello[]>([]);
  const [carico, setCarico] = useState(true);
  const [salvo, setSalvo] = useState(false);
  const [provo, setProvo] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);

  const leggi = useCallback(async () => {
    try {
      const r = await fetchCRM("/api/crm/ai");
      const j = await r.json();
      setPronto(!!j?.pronto);
      setCoda(String(j?.coda || ""));
      setModello(String(j?.modello || ""));
    } catch {
      toast.error("Non riesco a leggere la configurazione");
    } finally {
      setCarico(false);
    }
  }, []);

  useEffect(() => {
    void leggi();
  }, [leggi]);

  //  L'elenco dei modelli si chiede una volta sola: cambia una volta al mese,
  //  e non è quello per cui si è aperta questa pagina.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetchCRM("/api/crm/ai?azione=modelli");
        const j = await r.json();
        if (j?.ok) setModelli(j.modelli || []);
      } catch {
        /* si resta sulla scelta automatica */
      }
    })();
  }, []);

  const salva = async (extra?: { cancella?: boolean; modello?: string }) => {
    setSalvo(true);
    setEsito(null);
    try {
      const r = await fetch("/api/crm/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify({
          ...(extra?.cancella ? { cancella: true } : { apiKey: nuova.trim() }),
          modello: extra?.modello !== undefined ? extra.modello : modello,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(String(j?.error || `errore ${r.status}`));
      setNuova("");
      setPronto(!!j?.pronto);
      setCoda(String(j?.coda || ""));
      setModello(String(j?.modello || ""));
      toast.success(extra?.cancella ? "Chiave rimossa" : "Chiave salvata");
    } catch (e) {
      toast.error(String((e as Error).message || e));
    } finally {
      setSalvo(false);
    }
  };

  const prova = async () => {
    setProvo(true);
    setEsito(null);
    try {
      const r = await fetchCRM("/api/crm/ai?azione=prova");
      const j = await r.json();
      if (!j?.ok) {
        setEsito({ ok: false, testo: String(j?.errore || "Non ha funzionato") });
        return;
      }
      const soldi =
        j.residuo === null
          ? "nessun tetto di spesa impostato"
          : `restano ${Number(j.residuo).toFixed(2)} $`;
      setEsito({
        ok: true,
        testo: `Chiave valida${j.etichetta ? ` (${j.etichetta})` : ""}: ${soldi}. Spesi finora ${Number(j.speso || 0).toFixed(2)} $.`,
      });
    } catch (e) {
      setEsito({ ok: false, testo: String((e as Error).message || e) });
    } finally {
      setProvo(false);
    }
  };

  if (carico) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carico…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── COM'È MESSA ADESSO ─────────────────────────────────────────── */}
      <div
        className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${
          pronto ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
        }`}
      >
        {pronto ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0 text-sm">
          {pronto ? (
            <>
              <p className="font-medium">Chiave configurata {coda}</p>
              <p className="text-muted-foreground">
                Le funzioni che usano l'intelligenza artificiale sono attive.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Nessuna chiave</p>
              <p className="text-muted-foreground">
                Senza chiave la prova capelli non genera niente: mostra il percorso e si ferma
                all'ultimo passo.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── LA CHIAVE ──────────────────────────────────────────────────── */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <Key className="h-3.5 w-3.5" /> Chiave OpenRouter
        </label>
        <input
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          //  ⚠️ `password` e non `text`: questa riga viene incollata mentre
          //   c'è qualcuno che guarda lo schermo, e resterebbe leggibile per
          //   tutto il tempo in cui la pagina è aperta.
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={pronto ? "Lascia vuoto per non cambiarla" : "sk-or-v1-…"}
          className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          La si prende da openrouter.ai → Keys. Non viene mai rimandata indietro: qui si vedono solo
          le ultime quattro cifre.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={salvo || (!nuova.trim() && !pronto)}
            onClick={() => void salva()}
          >
            {salvo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Salva
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!pronto || provo}
            onClick={() => void prova()}
          >
            {provo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Prova adesso
          </Button>
          {pronto && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={salvo}
              onClick={() => void salva({ cancella: true })}
            >
              Rimuovi
            </Button>
          )}
        </div>

        {!!esito && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              esito.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"
            }`}
          >
            {esito.testo}
          </p>
        )}
      </div>

      {/* ── QUALE MODELLO ──────────────────────────────────────────────── */}
      <div>
        <label className="text-sm font-medium">Modello per le immagini</label>
        <select
          value={modello}
          onChange={(e) => {
            setModello(e.target.value);
            void salva({ modello: e.target.value });
          }}
          className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-sm"
        >
          {/*  ⚠️ L'AUTOMATICO È IL PREDEFINITO, ed è quello giusto quasi sempre.
              Inchiodare uno slug vuol dire rompersi il giorno in cui viene
              ritirato — è già successo, con un modello sparito da un giorno
              all'altro. Qui si sceglie a mano solo per provarne uno diverso. */}
          <option value="">Automatico (il migliore disponibile)</option>
          {modelli.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {modelli.length
            ? `${modelli.length} modelli sanno restituire un'immagine. In automatico si sceglie fra questi.`
            : "L'elenco dei modelli non è raggiungibile adesso: resta la scelta automatica."}
        </p>
      </div>
    </div>
  );
}
