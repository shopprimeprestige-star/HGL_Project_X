/** ── IL RIQUADRO «PRENOTAZIONE DELLA CONSULENZA IN CHAT» (Impostazioni → WhatsApp) ──
 *
 *  Commessa 2026-10-27. Un interruttore e basta: accende o spegne la
 *  prenotazione dentro la chat. Spenta di serie.
 *
 *  ⚠️ IL BROWSER NON SCRIVE `app_config` DA SOLO: legge e comanda da
 *   `/api/crm/prenota-chat`, che risponde 403 a chi non ha «impostazioni»
 *   (stessa regola di «Conferma consulenze»). Qui i comandi si vedono solo a
 *   chi può. Se la scrittura fallisce si dice, e si rilegge lo stato vero.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { fetchCRM, usePuo } from "@/crm/AuthContext";

const ROTTA = "/api/crm/prenota-chat";

export function PrenotaChatPannello() {
  const puoCambiare = usePuo()("impostazioni");
  const [acceso, setAcceso] = useState<boolean | null>(null);
  const [salvo, setSalvo] = useState(false);

  const ricarica = useCallback(async () => {
    try {
      const res = await fetchCRM(ROTTA);
      const r = (await res.json().catch(() => ({}))) as { acceso?: boolean };
      setAcceso(res.ok && typeof r.acceso === "boolean" ? r.acceso : null);
    } catch {
      setAcceso(null);
    }
  }, []);
  useEffect(() => {
    if (puoCambiare) void ricarica();
  }, [ricarica, puoCambiare]);

  const cambia = async (voglio: boolean) => {
    setSalvo(true);
    try {
      const res = await fetchCRM(ROTTA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceso: voglio }),
      });
      const r = (await res.json().catch(() => ({}))) as { acceso?: boolean; error?: string };
      if (!res.ok || typeof r.acceso !== "boolean") {
        toast.error(
          res.status === 403
            ? "Solo chi può cambiare le impostazioni accende o spegne questa funzione."
            : (r.error ?? "Non salvato."),
        );
        await ricarica();
        return;
      }
      setAcceso(r.acceso);
      toast.success(r.acceso ? "Prenotazione in chat accesa" : "Prenotazione in chat spenta");
    } catch {
      toast.error("Non salvato: il server non risponde.");
      await ricarica();
    } finally {
      setSalvo(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prenotazione della consulenza in chat</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Il lead risponde mattina/sera e sceglie l'orario con i pulsanti; il CRM fissa la
          consulenza e manda il link.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {acceso === null
              ? "Stato non disponibile"
              : acceso
                ? "Accesa: i lead possono prenotare in chat"
                : "Spenta: i lead non prenotano in chat"}
          </span>
          <Switch
            checked={acceso === true}
            disabled={!puoCambiare || acceso === null || salvo}
            onCheckedChange={(v) => void cambia(v)}
            aria-label="Accendi o spegni la prenotazione della consulenza in chat"
          />
        </label>
        {!puoCambiare && (
          <p className="text-[12px] text-muted-foreground">
            Solo chi può cambiare le impostazioni accende o spegne questa funzione.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
