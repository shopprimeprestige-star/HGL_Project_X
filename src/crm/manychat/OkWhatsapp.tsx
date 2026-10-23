/** ── L'INTERRUTTORE «OK A WHATSAPP» ─────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 5. Il consenso a
 *  ricevere promemoria e ricontatti su WhatsApp, messo a mano sulla scheda DOPO
 *  averlo chiesto a voce, con il nome di chi l'ha chiesto e il giorno:
 *  «Chiesto a voce da Mario, 23/10».
 *
 *  ⚠️ NON SALVA DA SOLO. Chiama `onCambia` con il valore nuovo
 *   (`data.okWhatsapp = { si, il, da }`): chi monta il componente lo scrive con
 *   una patch della scheda, come per ogni altro campo. Se `onCambia` fallisce
 *   (rifiuta la promessa) l'interruttore torna com'era e la frase di errore
 *   resta sotto, in chiaro.
 *  ⚠️ SPENTO NON CANCELLA LA TRACCIA: si scrive `{ si: false }` con chi e quando
 *   l'ha tolto («Tolto da Anna, 24/10»).
 *  ⚠️ L'INTERRUTTORE PARLA SOLO DEL «SÌ» MESSO A MANO. Se il consenso arriva
 *   dal modulo (oggi nessun modulo lo salva) lo dice la riga sotto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ConsensoModulo, OkWhatsapp as ValoreOk } from "../types";
import { nuovoOkWhatsapp, vistaOkWhatsapp } from "./vista-pannello";

export function OkWhatsapp({
  valore,
  consensoModulo,
  chi,
  onCambia,
  disabilitato,
  className,
}: {
  /** `data.okWhatsapp` della scheda */
  valore?: ValoreOk | null;
  /** `data.consensoModulo` della scheda */
  consensoModulo?: ConsensoModulo | null;
  /** il nome di chi sta lavorando (il consulente collegato) */
  chi: string;
  /** scrive il valore nuovo sulla scheda; se rifiuta, l'interruttore non cambia */
  onCambia: (nuovo: ValoreOk) => Promise<unknown> | void;
  disabilitato?: boolean;
  className?: string;
}) {
  const id = useId();
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const vista = vistaOkWhatsapp(valore, consensoModulo);

  const cambia = async (si: boolean) => {
    setSalvando(true);
    setErrore(null);
    try {
      await onCambia(nuovoOkWhatsapp(si, chi, new Date()));
    } catch (e) {
      setErrore(e instanceof Error && e.message ? e.message : "Non salvato: riprova fra poco.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-start gap-3">
        <Switch
          id={id}
          checked={vista.acceso}
          disabled={disabilitato || salvando}
          onCheckedChange={(v) => void cambia(v)}
          aria-describedby={`${id}-riga`}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="block cursor-pointer text-[13px] font-medium text-slate-900"
          >
            Ok a WhatsApp
          </label>
          <p
            id={`${id}-riga`}
            className={cn(
              "text-[12px] leading-snug",
              vista.acceso ? "text-slate-600" : "text-slate-500",
            )}
          >
            {vista.riga}
          </p>
        </div>
      </div>
      {errore && (
        <p role="alert" className="mt-1.5 text-[12px] leading-snug text-rose-800">
          {errore}
        </p>
      )}
    </div>
  );
}
