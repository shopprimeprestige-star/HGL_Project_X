/** ── IMPOSTAZIONI · WEBINAR ─────────────────────────────────────────────────
 *
 *  Un interruttore e due caselle. L'interruttore è la cosa importante: dice
 *  quale tecnologia usa il pulsante «Avvia webinar», e si può rimettere su
 *  Meetly in qualsiasi momento senza pubblicare niente e senza toccare il
 *  codice.
 *
 *  ── IL SEGRETO NON TORNA MAI INDIETRO ─────────────────────────────────────
 *  Il campo del segreto Cloudflare parte SEMPRE vuoto, anche quando ce n'è uno
 *  salvato, perché il server non lo restituisce: chi ha quella chiave può
 *  aprire sessioni sul conto e consumare la banda. Vuoto quindi vuol dire «non
 *  l'ho toccato», e solo scrivendoci dentro lo si sostituisce. Sotto al campo
 *  c'è scritto, perché altrimenti sembra che non si sia salvato.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Radio, Server, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { intestazioniCRM, fetchCRM } from "./AuthContext";
import type { TrasportoWebinar } from "@/webinar/tipi";

export function ImpostazioniWebinar() {
  const [trasporto, setTrasporto] = useState<TrasportoWebinar>("meetly");
  const [simulcast, setSimulcast] = useState(true);
  const [appId, setAppId] = useState("");
  const [segreto, setSegreto] = useState("");
  const [pronto, setPronto] = useState(false);
  const [carico, setCarico] = useState(true);
  const [salvo, setSalvo] = useState(false);

  const leggi = useCallback(async () => {
    try {
      const r = await fetchCRM("/api/crm/webinar?azione=config");
      const j = await r.json();
      setTrasporto(j?.trasporto === "sfu" ? "sfu" : "meetly");
      setSimulcast(j?.simulcast !== false);
      setAppId(String(j?.appId || ""));
      setPronto(!!j?.pronto);
    } catch {
      toast.error("Non riesco a leggere la configurazione del webinar");
    } finally {
      setCarico(false);
    }
  }, []);

  useEffect(() => {
    void leggi();
  }, [leggi]);

  const salva = async () => {
    setSalvo(true);
    try {
      const r = await fetch("/api/crm/webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify({
          azione: "config",
          trasporto,
          simulcast,
          appId: appId.trim(),
          appSecret: segreto.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(String(j?.error || `errore ${r.status}`));
      setSegreto("");
      setPronto(!!j?.pronto);
      toast.success("Impostazioni del webinar salvate");
    } catch (e) {
      toast.error(String((e as Error).message || e));
    } finally {
      setSalvo(false);
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
    <div className="space-y-4">
      {/* ── QUALE TECNOLOGIA ──────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTrasporto("sfu")}
          className={`rounded-xl border p-4 text-left transition ${trasporto === "sfu" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
        >
          <p className="flex items-center gap-2 font-semibold">
            <Radio className="h-4 w-4" /> Cloudflare Realtime
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Carichi un flusso solo, il server lo replica a tutti. <b>Centinaia di spettatori</b>,
            meno di un secondo di ritardo, nessuna richiesta di camera a chi guarda.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Primi 1.000 GB al mese gratis: sono circa 11 dirette da 200 persone per un'ora.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTrasporto("meetly")}
          className={`rounded-xl border p-4 text-left transition ${trasporto === "meetly" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
        >
          <p className="flex items-center gap-2 font-semibold">
            <Video className="h-4 w-4" /> Meetly (come le consulenze)
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            La tecnologia di sempre: ognuno si collega a tutti gli altri. È quella collaudata, ma
            regge <b>sei o sette persone</b> — oltre, chi parla deve caricare un video per ciascuno.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Tienila se il nuovo trasporto dà problemi: si torna indietro da qui, senza altro.
          </p>
        </button>
      </div>

      {/* ── CREDENZIALI ───────────────────────────────────────────────── */}
      {trasporto === "sfu" && (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className={`h-4 w-4 ${pronto ? "text-emerald-600" : "text-amber-500"}`} />
            {pronto ? "Credenziali salvate" : "Credenziali da inserire"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Dashboard Cloudflare → <b>Realtime</b> → <b>SFU serverless</b>. Se il pulsante per
            creare un&apos;app non c&apos;è, prima serve un passaggio: la pagina Realtime mostra
            «Introduzione», che attiva il prodotto — l&apos;uso gratuito comprende 1.000 GB al mese.
            Poi crea l&apos;app e copia qui <b>App ID</b> e <b>App Secret</b>.
          </p>
          {/*  ⚠️ QUESTA RIGA VALE PIÙ DI TUTTE LE ALTRE, ed è verificata sul
              pannello vero: il segreto compare UNA VOLTA SOLA, alla creazione.
              Dopo, nel pannello resta solo l'App ID; il menu dell'app offre
              «Visualizza utilizzo» ed «Elimina», e basta. Nemmeno l'API lo
              restituisce: `GET /accounts/…/calls/apps/{id}` dà nome, uid e
              date, e un endpoint per rigenerarlo non esiste. Chi non lo copia
              in quel momento deve rifare l'app da capo. */}
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-500">
            <b>Copia il segreto subito:</b> Cloudflare lo mostra una volta sola, alla creazione.
            Dopo non è più recuperabile da nessuna parte — né dal pannello né dall&apos;API — e
            l&apos;unico rimedio è rifare l&apos;app.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sono cose diverse dalle chiavi TURN della videoconsulenza: quelle restano dove sono e
            non vanno toccate.
          </p>
          <input
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="App ID"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={segreto}
            onChange={(e) => setSegreto(e.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={pronto ? "App Secret — lascia vuoto per non cambiarlo" : "App Secret"}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="text-xs text-muted-foreground">
            Il segreto non viene mai rimandato al browser: se il campo è vuoto resta quello di
            prima.
          </p>

          <label className="flex cursor-pointer items-start gap-2 pt-1">
            <input
              type="checkbox"
              checked={simulcast}
              onChange={(e) => setSimulcast(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm">
              <b>Manda tre qualità insieme</b>
              <span className="block text-xs text-muted-foreground">
                Chi ha la linea scarsa scende da solo a una qualità più bassa invece di perdere la
                diretta. Costa un po' più di banda in salita a te (circa 2,2 Mbps invece di 1,5) e
                un po' di lavoro in più al tuo computer. Se il tuo portatile arranca mentre
                presenti, togli la spunta.
              </span>
            </span>
          </label>
        </div>
      )}

      <Button onClick={() => void salva()} disabled={salvo}>
        {salvo ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salva
      </Button>

      {/*  ⚠️ IL SERVER TURN NON STA PIÙ QUI. Ce l'avevo messo, e per un
          giorno e' stato il posto sbagliato: quella credenziale non e' del
          webinar, e' dell'IMPIANTO — la usano le consulenze e tutti e due i
          trasporti. Tenerla nella scheda del webinar faceva credere che
          cambiarla toccasse solo i webinar, che e' esattamente il malinteso
          capace di fermare le consulenze. Adesso sta nella scheda Meetly,
          insieme alla prova che dice se funziona. */}
      <div className="rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Server className="h-4 w-4 text-muted-foreground" /> Server TURN
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Serve a tutti e due i trasporti, e anche alle videoconsulenze: e' una credenziale
          d'impianto, non del webinar. La configuri (e la provi) nella scheda <b>Meetly</b>, qui
          accanto.
        </p>
      </div>
    </div>
  );
}
