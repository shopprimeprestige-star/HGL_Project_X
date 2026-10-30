/** ── RIQUADRO «ASSENZA ALLA CONSULENZA» (commessa 2026-10-30, p5) ───────────
 *  L'interruttore `assenza_auto` (rotta /api/crm/assenza-auto). Spento: chi non
 *  entra in stanza 15' dopo l'inizio viene solo segnalato in «Da fare». Acceso:
 *  passa da solo a «Da riprogrammare» e gli parte il messaggio dello stato.
 *  shortcut: copia di PrenotaChatPannello con altri testi; da unire in un
 *  riquadro unico se gli interruttori diventano tre o più. */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { fetchCRM, usePuo } from "@/crm/AuthContext";

const ROTTA = "/api/crm/assenza-auto";

export function AssenzaAutoPannello() {
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
      toast.success(
        r.acceso ? "Assenza automatica accesa" : "Assenza automatica spenta: solo segnalazione",
      );
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
        <CardTitle className="text-base">Cliente non entrato alla consulenza</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          15 minuti dopo l'inizio, se nessuno è entrato nella stanza Meetly, il CRM lo segnala in
          «Da fare». Acceso, sposta anche la scheda in «Da riprogrammare» e manda il messaggio di
          quello stato.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {acceso === null
              ? "Stato non disponibile"
              : acceso
                ? "Acceso: sposta in «Da riprogrammare» e scrive al cliente"
                : "Spento: lo segnala soltanto in «Da fare»"}
          </span>
          <Switch
            checked={acceso === true}
            disabled={!puoCambiare || acceso === null || salvo}
            onCheckedChange={(v) => void cambia(v)}
            aria-label="Accendi o spegni lo spostamento automatico di chi non entra alla consulenza"
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
