/** ── IL RIQUADRO «CONFERMA CONSULENZE» (Impostazioni → WhatsApp) ────────────
 *
 *  Commessa 2026-10-22. Tre cose e basta (taglio del revisore): l'interruttore,
 *  UNA frase di stato in chiaro, il tasto «Controlla ora». I singoli clienti
 *  la setter li vede già in «Oggi» → «Da sentire».
 *
 *  ⚠️ PARTE SPENTO. Accenderlo scrive `avvio: "da_fare"`: il primo giro del
 *   cron segna come «preesistenti» gli appuntamenti già in agenda, che così
 *   non ricevono niente (niente 40 messaggi tutti insieme).
 *  ⚠️ IL BROWSER NON SCRIVE NIENTE DA SOLO (controllo di sicurezza, MEDIUM):
 *   legge, accende/spegne e controlla passando da `/api/crm/promemoria-whatsapp`,
 *   che risponde 403 a chi non ha «impostazioni». Col PIN la sessione Supabase
 *   è del proprietario per tutti: una scrittura diretta su `app_config` la
 *   poteva fare anche la setter. Qui i comandi si vedono solo a chi può; la
 *   difesa vera è la guardia del server. Mai il token WhatsApp qui.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { fetchCRM, usePuo } from "@/crm/AuthContext";
import { fraseRiquadro, type StatoPerRiquadro } from "@/crm/promemoria/pronto";

const ROTTA = "/api/crm/promemoria-whatsapp";

interface Config {
  acceso: boolean;
  attivoDal?: string | null;
  avvio?: "da_fare" | "fatto";
}

const TONI = {
  verde: "border-emerald-200 bg-emerald-50 text-emerald-900",
  ambra: "border-amber-200 bg-amber-50 text-amber-900",
  rosso: "border-rose-200 bg-rose-50 text-rose-900",
  neutro: "border-border bg-muted text-foreground",
} as const;

export function PromemoriaWhatsappPannello() {
  const puoCambiare = usePuo()("impostazioni");
  const [config, setConfig] = useState<Config | null>(null);
  const [stato, setStato] = useState<StatoPerRiquadro | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [controllo, setControllo] = useState<{ frase: string; dettaglio?: string } | null>(null);
  const [controllando, setControllando] = useState(false);

  const ricarica = useCallback(async () => {
    try {
      const res = await fetchCRM(ROTTA);
      if (res.ok) {
        const r = (await res.json()) as { config?: Config | null; stato?: StatoPerRiquadro | null };
        setConfig(r.config ?? null);
        setStato(r.stato ?? null);
      }
    } catch {
      /* resta l'ultima lettura: la frase dice «spento» o lo stato di prima */
    } finally {
      setCaricato(true);
    }
  }, []);
  useEffect(() => {
    if (puoCambiare) void ricarica();
  }, [ricarica, puoCambiare]);

  const chiedi = (corpo: Record<string, unknown>) =>
    fetchCRM(ROTTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

  const cambia = async (acceso: boolean) => {
    setSalvo(true);
    try {
      const res = await chiedi({ acceso });
      const r = (await res.json().catch(() => ({}))) as { config?: Config; error?: string };
      if (!res.ok || !r.config) {
        toast.error(
          res.status === 403
            ? "Solo chi può cambiare le impostazioni accende o spegne questa funzione."
            : (r.error ?? "Non salvato."),
        );
        return;
      }
      setConfig(r.config);
      toast.success(acceso ? "Conferma consulenze accesa" : "Conferma consulenze spenta");
    } catch {
      toast.error("Non salvato: il server non risponde.");
    } finally {
      setSalvo(false);
    }
  };

  const controllaOra = async () => {
    setControllando(true);
    try {
      const res = await chiedi({ prova: true });
      if (res.status === 401 || res.status === 403) {
        setControllo({ frase: "Il controllo lo può fare solo chi cambia le impostazioni." });
        return;
      }
      const r = (await res.json()) as {
        pronto?: boolean;
        frase?: string;
        partirebbero?: number;
      };
      setControllo({
        frase: r.pronto ? "Tutto a posto." : (r.frase ?? "Il controllo non ha risposto."),
        dettaglio:
          typeof r.partirebbero === "number"
            ? `Adesso partirebbero ${r.partirebbero} ${r.partirebbero === 1 ? "messaggio" : "messaggi"}.`
            : undefined,
      });
    } catch {
      setControllo({ frase: "Il controllo non è riuscito: il server non risponde." });
    } finally {
      setControllando(false);
      void ricarica();
    }
  };

  const riga = fraseRiquadro(stato, config, new Date());
  const acceso = !!config?.acceso;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Conferma consulenze</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Subito dopo la prenotazione il cliente riceve un WhatsApp con giorno, ora e link, e la
          richiesta di rispondere SÌ. Chi non conferma compare alla setter in «Oggi» → «Da sentire».
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {acceso ? "Acceso: i messaggi partono" : "Spento: nessun messaggio parte"}
          </span>
          <Switch
            checked={acceso}
            disabled={!puoCambiare || !caricato || salvo}
            onCheckedChange={(v) => void cambia(v)}
            aria-label="Accendi o spegni la conferma automatica delle consulenze"
          />
        </label>
        {!puoCambiare && (
          <p className="text-[12px] text-muted-foreground">
            Solo chi può cambiare le impostazioni accende, spegne e controlla questa funzione.
          </p>
        )}
        {caricato && (
          <p
            role="status"
            className={cn("rounded-md border px-3 py-2 text-[13px] leading-snug", TONI[riga.tono])}
          >
            {riga.frase}
          </p>
        )}
        {!acceso && (
          <p className="text-[12px] text-muted-foreground">
            Prima di accendere: il modulo di prenotazione (e l'informativa privacy) deve dire che la
            conferma arriva su WhatsApp al numero indicato. È il consenso del cliente.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void controllaOra()}
            disabled={!puoCambiare || controllando}
          >
            {controllando ? "Controllo…" : "Controlla ora"}
          </Button>
          {controllo && (
            <span className="text-[13px]">
              {controllo.frase} {controllo.dettaglio}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
