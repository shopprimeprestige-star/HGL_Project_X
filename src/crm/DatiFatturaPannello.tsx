/** ── IL RIQUADRO «DATI PER LA FATTURA» (Impostazioni → WhatsApp) ────────────
 *  Dopo un acconto, il CRM chiede da solo al cliente i dati per la fattura e, quando
 *  arrivano (foto o testo), prepara una BOZZA: la conferma resta sempre a mano.
 *  Spento di base. Il modello Meta da far approvare è mostrato qui sotto.
 *  Dal 31/10/2026 la richiesta si accende e si spegne in «Messaggi automatici»: qui resta
 *  il rimando, e lo Switch «il modello è approvato» (non è un messaggio). */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { fetchCRM, usePuo } from "@/crm/AuthContext";
import { RimandoMessaggiAutomatici } from "@/crm/MessaggiAutomaticiPannello";

const ROTTA = "/api/crm/dati-fattura";
interface Config {
  acceso: boolean;
  modelloApprovato?: boolean;
}
interface Modello {
  nome: string;
  categoria?: string;
  testo?: string;
}

export function DatiFatturaPannello() {
  const puo = usePuo()("impostazioni");
  const [config, setConfig] = useState<Config | null>(null);
  const [modello, setModello] = useState<Modello | null>(null);
  const [salvo, setSalvo] = useState(false);

  const ricarica = useCallback(async () => {
    try {
      const res = await fetchCRM(ROTTA);
      if (res.ok) {
        const r = (await res.json()) as { config?: Config; modello?: Modello };
        setConfig(r.config ?? null);
        setModello(r.modello ?? null);
      }
    } catch {
      /* resta l'ultima lettura */
    }
  }, []);
  useEffect(() => {
    if (puo) void ricarica();
  }, [ricarica, puo]);
  if (!puo) return null;

  const cambia = async (corpo: Record<string, unknown>) => {
    setSalvo(true);
    try {
      const res = await fetchCRM(ROTTA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const r = (await res.json().catch(() => ({}))) as { config?: Config };
      if (!res.ok || !r.config) return toast.error("Non salvato.");
      setConfig(r.config);
      toast.success("Salvato");
    } catch {
      toast.error("Non salvato: il server non risponde.");
    } finally {
      setSalvo(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dati per la fattura dopo l&apos;acconto</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Quando su una scheda c&apos;è un acconto, il cliente riceve UNA volta un WhatsApp che
          chiede i dati per la fattura (anche con una foto della tessera sanitaria o del documento).
          Quando risponde, la foto va nella sua scheda (archivio privato) e in «Fatture» compare una
          BOZZA da controllare. Nessuna fattura viene confermata o inviata da sola.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <RimandoMessaggiAutomatici />
        <p className="text-[12px] text-muted-foreground">
          Accesa, la richiesta non parte per chi ha GIÀ un acconto: vale solo per i nuovi acconti.
          Dentro le 24 ore dall&apos;ultimo messaggio del cliente è un testo normale; fuori serve il
          modello Meta qui sotto. Finché non c&apos;è, la richiesta resta in «Da fare».
        </p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Il modello è approvato (solo se non usi ManyChat)</span>
          <Switch
            checked={!!config?.modelloApprovato}
            disabled={salvo || !config}
            onCheckedChange={(v) => void cambia({ modelloApprovato: v })}
          />
        </label>
        {modello?.testo && (
          <details className="rounded-md border p-2 text-[12px]">
            <summary className="cursor-pointer font-medium">
              Modello da far approvare: {modello.nome} ({modello.categoria})
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans">{modello.testo}</pre>
            <p className="mt-1 text-muted-foreground">
              Variabile {"{{1}}"} = nome del cliente. Con ManyChat va collegato a un flusso con lo
              stesso nome.
            </p>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
