/** ── LE NOTIFICHE ANCHE A CRM CHIUSO ────────────────────────────────────────
 *  Richiesta del titolare (28/10/2026): sapere quando un cliente scrive su
 *  WhatsApp anche con il telefono in tasca. Qui si iscrive QUESTO dispositivo
 *  (rotta /api/crm/push); a spedire ci pensa il server quando arriva un
 *  messaggio (crm/push/invio.server).
 *  ⚠️ Su iPhone funziona solo dall'icona sulla schermata Home (iOS 16.4+): dal
 *   browser normale Apple non lo permette, e qui lo si dice invece di mostrare
 *   un tasto che non può funzionare.
 *  ⚠️ Gli hook in cima, i ritorni dopo. */
import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  preparaCanaleSistema,
  serveInstallazione,
  supportaServiceWorker,
} from "@/crm/notifications/canale-sistema";
import { chiamaPush as chiama, iscriviQuesto, togliQuesto } from "./iscrizione";

type Stato =
  | "controllo"
  | "non_supportato"
  | "installa"
  | "non_configurato"
  | "negato"
  | "spento"
  | "acceso";

export function NotificheDalServer() {
  const [stato, setStato] = useState<Stato>("controllo");
  const [lavoro, setLavoro] = useState(false);
  const [chiave, setChiave] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const controlla = useCallback(async () => {
    if (!supportaServiceWorker())
      return setStato(serveInstallazione() ? "installa" : "non_supportato");
    if (serveInstallazione()) return setStato("installa");
    if (!("PushManager" in window) || !("Notification" in window))
      return setStato("non_supportato");
    const r = await chiama("GET").catch(() => null);
    if (!r?.chiave) return setStato("non_configurato");
    setChiave(r.chiave);
    if (Notification.permission === "denied") return setStato("negato");
    const reg = await preparaCanaleSistema();
    const iscr = await reg?.pushManager.getSubscription();
    setEndpoint(iscr?.endpoint ?? null);
    setStato(iscr ? "acceso" : "spento");
  }, []);

  useEffect(() => {
    void controlla();
  }, [controlla]);

  const attiva = async () => {
    if (!chiave) return;
    setLavoro(true);
    try {
      const iscr = await iscriviQuesto(chiave);
      if (!iscr) {
        setStato(Notification.permission === "denied" ? "negato" : "spento");
        return;
      }
      setEndpoint(iscr.endpoint);
      setStato("acceso");
      toast.success("Notifiche attive su questo dispositivo", {
        description: "Ti arriva un avviso quando un cliente scrive su WhatsApp.",
      });
    } catch {
      toast.error("Non sono riuscito ad attivarle", { description: "Riprova fra un istante." });
    } finally {
      setLavoro(false);
    }
  };

  const prova = async () => {
    if (!endpoint) return;
    setLavoro(true);
    const r = await chiama("POST", { azione: "prova", endpoint }).catch(() => null);
    setLavoro(false);
    if (r?.ok) toast.success("Prova inviata", { description: "Deve arrivare fra pochi secondi." });
    else
      toast.error("La prova non è partita", { description: r?.error || "Riprova fra un istante." });
  };

  const spegni = async () => {
    setLavoro(true);
    await togliQuesto();
    setEndpoint(null);
    setStato("spento");
    setLavoro(false);
  };

  const FRASE: Record<Stato, string> = {
    controllo: "Controllo questo dispositivo…",
    non_supportato: "Questo browser non riceve notifiche dal server.",
    installa:
      "Su iPhone serve prima l'icona sulla schermata Home: Condividi → Aggiungi a Home, poi apri il CRM da lì e torna in questa pagina.",
    non_configurato:
      "Le notifiche dal server non sono ancora configurate (mancano le chiavi sul server).",
    negato:
      "Le notifiche sono bloccate per il CRM: riattivale dalle impostazioni del telefono (Notifiche → Hair Genius) e ricarica.",
    spento: "Spente su questo dispositivo.",
    acceso: "Attive su questo dispositivo: arriva un avviso anche a CRM chiuso.",
  };

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold leading-tight text-emerald-900">
        <BellRing className="h-3.5 w-3.5" /> Messaggi WhatsApp, anche a CRM chiuso
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-emerald-900/80">
        {FRASE[stato]} Sullo schermo bloccato compare solo chi ti ha scritto, mai il testo.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {stato === "spento" && (
          <Button size="sm" className="h-9" disabled={lavoro} onClick={() => void attiva()}>
            {lavoro ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Attiva su
            questo dispositivo
          </Button>
        )}
        {stato === "acceso" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              disabled={lavoro}
              onClick={() => void prova()}
            >
              Manda una prova
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9"
              disabled={lavoro}
              onClick={() => void spegni()}
            >
              Disattiva
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
