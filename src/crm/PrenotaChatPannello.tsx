/** ── IL RIQUADRO «PRENOTAZIONE DELLA CONSULENZA IN CHAT» (Impostazioni → WhatsApp) ──
 *
 *  Commessa 2026-10-27. Spiegava la prenotazione dentro la chat e ne portava
 *  l'interruttore. Dal 31/10/2026 l'interruttore sta in «Messaggi automatici»
 *  (commessa interruttori-automatici): qui resta la spiegazione e il rimando.
 *
 *  ⚠️ Visibile solo a chi ha «impostazioni», come il riquadro dove si accende.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePuo } from "@/crm/AuthContext";
import { RimandoMessaggiAutomatici } from "@/crm/MessaggiAutomaticiPannello";

export function PrenotaChatPannello() {
  const puoCambiare = usePuo()("impostazioni");
  if (!puoCambiare) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prenotazione della consulenza in chat</CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Il lead risponde mattina/sera e sceglie l'orario con i pulsanti; il CRM fissa la
          consulenza e manda il link.
        </p>
      </CardHeader>
      <CardContent>
        <RimandoMessaggiAutomatici />
      </CardContent>
    </Card>
  );
}
