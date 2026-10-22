/** ── IL RIQUADRO «CONFERMA CONSULENZE» (Impostazioni → WhatsApp) ────────────
 *
 *  Commessa 2026-10-22. Tre cose e basta (taglio del revisore): l'interruttore,
 *  UNA frase di stato in chiaro, il tasto «Controlla ora». I singoli clienti
 *  la setter li vede già in «Oggi» → «Da sentire».
 *
 *  ⚠️ PARTE SPENTO. Accenderlo scrive `avvio: "da_fare"`: il primo giro del
 *   cron segna come «preesistenti» gli appuntamenti già in agenda, che così
 *   non ricevono niente (niente 40 messaggi tutti insieme).
 *  ⚠️ MAI IL TOKEN QUI: la frase la scrive il cron; «Controlla ora» chiede
 *   al server una prova a secco con la sessione di chi guarda.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { dbConfig } from "@/crm/blocchi";
import { fraseRiquadro, type StatoPerRiquadro } from "@/crm/promemoria/pronto";

const CHIAVE_CONFIG = "promemoria_whatsapp";
const CHIAVE_STATO = "promemoria_whatsapp_stato";

interface Config {
  acceso: boolean;
  attivoDal?: string | null;
  avvio?: "da_fare" | "fatto";
}

const leggi = async <T,>(chiave: string): Promise<T | null> => {
  const { data } = await dbConfig
    .from("app_config")
    .select("value")
    .eq("key", chiave)
    .maybeSingle();
  try {
    return data?.value ? (JSON.parse(data.value) as T) : null;
  } catch {
    return null;
  }
};

const TONI = {
  verde: "border-emerald-200 bg-emerald-50 text-emerald-900",
  ambra: "border-amber-200 bg-amber-50 text-amber-900",
  rosso: "border-rose-200 bg-rose-50 text-rose-900",
  neutro: "border-border bg-muted text-foreground",
} as const;

export function PromemoriaWhatsappPannello() {
  const [config, setConfig] = useState<Config | null>(null);
  const [stato, setStato] = useState<StatoPerRiquadro | null>(null);
  const [caricato, setCaricato] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [controllo, setControllo] = useState<{ frase: string; dettaglio?: string } | null>(null);
  const [controllando, setControllando] = useState(false);

  const ricarica = useCallback(async () => {
    const [c, s] = await Promise.all([
      leggi<Config>(CHIAVE_CONFIG),
      leggi<StatoPerRiquadro>(CHIAVE_STATO),
    ]);
    setConfig(c);
    setStato(s);
    setCaricato(true);
  }, []);
  useEffect(() => {
    void ricarica();
  }, [ricarica]);

  const cambia = async (acceso: boolean) => {
    setSalvo(true);
    const nuovo: Config = acceso
      ? {
          acceso: true,
          attivoDal: new Date().toISOString(),
          avvio: "da_fare",
        }
      : { ...(config ?? {}), acceso: false };
    const { error } = await dbConfig
      .from("app_config")
      .upsert(
        { key: CHIAVE_CONFIG, value: JSON.stringify(nuovo), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    setSalvo(false);
    if (error) {
      toast.error(`Non salvato: ${error.message}`);
      return;
    }
    setConfig(nuovo);
    toast.success(acceso ? "Conferma consulenze accesa" : "Conferma consulenze spenta");
  };

  const controllaOra = async () => {
    setControllando(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/hooks/promemoria-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ prova: true }),
      });
      if (res.status === 401) {
        setControllo({
          frase:
            "Il controllo lo può fare solo chi ha configurato WhatsApp in queste impostazioni.",
        });
        return;
      }
      const r = (await res.json()) as {
        pronto?: boolean;
        frase?: string;
        partirebbero?: number;
        saltati?: number;
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
            disabled={!caricato || salvo}
            onCheckedChange={(v) => void cambia(v)}
            aria-label="Accendi o spegni la conferma automatica delle consulenze"
          />
        </label>
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
            disabled={controllando}
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
