/** ── IL RIQUADRO «ANTEPRIMA DEI LINK» (Impostazioni → WhatsApp) ─────────────
 *
 *  Commessa 2026-10-31-anteprima-link. Un solo interruttore: i messaggi scritti a mano nella chat con
 *  un link partono dalla Cloud API di Meta (così su WhatsApp compare l'anteprima) invece che da
 *  ManyChat. Spento di serie; si accende solo con le chiavi Meta inserite in «WhatsApp Cloud API (Meta)».
 *
 *  ⚠️ IL BROWSER NON SCRIVE NIENTE DA SOLO: legge e comanda `/api/crm/anteprima-link`, che risponde 403 a
 *   chi non ha «impostazioni» (col PIN la sessione Supabase è del proprietario per tutti).
 *  ⚠️ Mai le chiavi qui: la rotta dice solo se ci sono. */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { fetchCRM, usePuo } from "@/crm/AuthContext";

const ROTTA = "/api/crm/anteprima-link";

interface Stato {
  acceso: boolean;
  chiavi: boolean;
}

export function AnteprimaLinkPannello() {
  const puoCambiare = usePuo()("impostazioni");
  const [stato, setStato] = useState<Stato | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);

  const ricarica = useCallback(async () => {
    try {
      const res = await fetchCRM(ROTTA);
      const r = (await res.json().catch(() => null)) as (Stato & { error?: string }) | null;
      if (res.ok && r && typeof r.acceso === "boolean") {
        setStato({ acceso: r.acceso, chiavi: !!r.chiavi });
        setErrore(null);
      } else setErrore(r?.error ?? "Non riesco a leggere l'impostazione: riprova fra poco.");
    } catch {
      setErrore("Il server non risponde: riprova fra poco.");
    }
  }, []);
  useEffect(() => {
    if (puoCambiare) void ricarica();
  }, [ricarica, puoCambiare]);

  const cambia = async (acceso: boolean) => {
    setOccupato(true);
    try {
      const res = await fetchCRM(ROTTA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceso }),
      });
      const r = (await res.json().catch(() => null)) as (Stato & { error?: string }) | null;
      if (!res.ok) toast.error(r?.error ?? "Non è stato salvato: riprova fra poco.");
      else toast.success(acceso ? "Anteprima dei link accesa" : "Anteprima dei link spenta");
    } catch {
      toast.error("Il server non risponde: riprova fra poco.");
    } finally {
      setOccupato(false);
      void ricarica();
    }
  };

  const acceso = !!stato?.acceso;
  const senzaChiavi = !!stato && !stato.chiavi;
  const etichetta = "Anteprima dei link nei messaggi manuali (invio diretto a Meta)";
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Anteprima dei link</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Un messaggio scritto a mano dalla chat che contiene un link parte direttamente da Meta,
          così chi lo riceve vede l'anteprima della pagina. Tutti gli altri messaggi, e quelli senza
          link, partono da ManyChat come sempre.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!puoCambiare && (
          <p className="text-[12px] text-muted-foreground">
            Solo chi può cambiare le impostazioni controlla questa funzione.
          </p>
        )}
        {errore && (
          <p role="alert" className="text-[13px] text-rose-700">
            {errore}
          </p>
        )}
        <label className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {etichetta}
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {stato ? (acceso ? "acceso" : "spento") : "…"}
              </span>
            </span>
            <span className="block text-[12px] leading-snug text-muted-foreground">
              {senzaChiavi
                ? "Per accenderlo servono le chiavi di Meta (token e Phone Number ID) in «WhatsApp Cloud API (Meta)»."
                : "Se Meta non accetta il messaggio, parte da ManyChat. Il messaggio può non comparire nell'inbox di ManyChat: resta nel CRM. L'anteprima la decide Meta e non è garantita."}
            </span>
          </span>
          <Switch
            checked={acceso}
            disabled={!puoCambiare || !stato || occupato || (senzaChiavi && !acceso)}
            onCheckedChange={(v) => void cambia(v)}
            aria-label={etichetta}
            className="mt-0.5"
          />
        </label>
      </CardContent>
    </Card>
  );
}
