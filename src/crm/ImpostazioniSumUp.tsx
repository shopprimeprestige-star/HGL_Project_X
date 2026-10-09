/** ── LE CHIAVI DI SUMUP ────────────────────────────────────────────────────
 *
 *  ⚠️ IL CAMPO PARTE SEMPRE VUOTO, e vuoto vuol dire «non toccarla». La chiave
 *   non torna mai indietro dal server: chi ce l'ha incassa sul conto di chi
 *   l'ha messa, e rimandarla al browser a ogni apertura vorrebbe dire
 *   lasciarla in giro per niente — nessuno la deve rileggere, solo sostituire.
 *
 *  ⚠️ E «SALVATO» NON VUOL DIRE «FUNZIONA»: una chiave scaduta si salva
 *   benissimo, e ce ne si accorge quando un cliente non riesce a pagare. Il
 *   tasto «Prova adesso» chiede davvero a SumUp chi siamo, e controlla anche
 *   che il codice esercente sia quello di questo conto.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleCheck, CircleAlert, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intestazioniCRM, fetchCRM } from "@/crm/AuthContext";
import { inEuro, PACCHETTI, alPezzo } from "@/prova/pacchetti";

export function ImpostazioniSumUp() {
  const [pronto, setPronto] = useState<boolean | null>(null);
  const [ultime, setUltime] = useState("");
  const [merchant, setMerchant] = useState("");
  const [chiave, setChiave] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [provo, setProvo] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);

  const carica = async () => {
    try {
      const r = await fetchCRM("/api/crm/sumup");
      const j = await r.json();
      setPronto(!!j?.pronto);
      setUltime(String(j?.ultime || ""));
      setMerchant(String(j?.merchantCode || ""));
    } catch {
      setPronto(false);
    }
  };
  useEffect(() => {
    void carica();
  }, []);

  const salva = async () => {
    setSalvo(true);
    setEsito(null);
    try {
      const r = await fetch("/api/crm/sumup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify({ apiKey: chiave, merchantCode: merchant }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "non salvata");
      setChiave("");
      toast.success("Salvato");
      await carica();
    } catch (e) {
      toast.error(String((e as Error).message || e));
    } finally {
      setSalvo(false);
    }
  };

  const prova = async () => {
    setProvo(true);
    try {
      const r = await fetchCRM("/api/crm/sumup?azione=prova");
      const j = await r.json();
      setEsito({
        ok: !!j?.ok,
        testo: j?.ok ? `Collegato a ${j.chi}` : String(j?.errore || "non funziona"),
      });
    } catch (e) {
      setEsito({ ok: false, testo: String((e as Error).message || e) });
    } finally {
      setProvo(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Serve per far comprare altre prove a chi ha finito quelle comprese. Senza, la pagina
        continua a funzionare: semplicemente non si può comprare.
      </p>

      <div
        className={`flex items-start gap-2 rounded-lg border p-3 ${pronto ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
      >
        {pronto ? (
          <CircleCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
        ) : (
          <CircleAlert className="mt-0.5 h-4 w-4 text-amber-600" />
        )}
        <div className="min-w-0 text-sm">
          <p className="font-medium">
            {pronto === null
              ? "Controllo…"
              : pronto
                ? `Chiave configurata …${ultime}`
                : "Manca la chiave o il codice esercente"}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {pronto
              ? "I pagamenti possono partire."
              : "Finché manca, il tasto per comprare resta spento."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Chiave segreta SumUp</span>
          <Input
            value={chiave}
            onChange={(e) => setChiave(e.target.value)}
            placeholder="Lascia vuoto per non cambiarla"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Comincia per <code className="rounded bg-muted px-1">sup_sk_</code>. Si prende da SumUp
            → Sviluppatori → API keys.
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Codice esercente</span>
          <Input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="es. MC1A2B3C"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Sta nel profilo SumUp. Se è di un altro conto, i pagamenti falliscono alla cassa.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void salva()} disabled={salvo}>
          {salvo ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salva
        </Button>
        <Button variant="outline" onClick={() => void prova()} disabled={provo || !pronto}>
          {provo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}{" "}
          Prova adesso
        </Button>
        {!!esito && (
          <span className={`text-[12px] ${esito.ok ? "text-emerald-600" : "text-destructive"}`}>
            {esito.testo}
          </span>
        )}
      </div>

      {/*  ⚠️ Il listino si vede QUI e non si può cambiare da qui: i prezzi
          stanno nel codice perché ogni riga porta con sé un testo di vendita
          scritto apposta, e un prezzo cambiato senza il suo testo diventa un
          pacchetto che non convince più nessuno. */}
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          I pacchetti in vendita
        </p>
        <ul className="space-y-1.5">
          {PACCHETTI.map((p) => (
            <li key={p.chiave} className="flex items-center gap-2 text-sm">
              <span className="w-24 font-medium">{p.nome}</span>
              <span className="w-20 font-semibold tabular-nums">{inEuro(p.centesimi)}</span>
              <span className="text-[12px] text-muted-foreground">{alPezzo(p)}</span>
              {p.consigliato && (
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-600">
                  il più scelto
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
