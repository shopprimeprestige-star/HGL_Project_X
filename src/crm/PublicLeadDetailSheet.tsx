/** ─────────────────────────────────────────────────────────────────────────
 *  PublicLeadDetailSheet — "Modifica il lead" arrivato dalla landing.
 *
 *  Veste rifatta sul linguaggio unico delle finestre (crm/ui/Finestra.tsx):
 *  un solo fondo, blocchi bianchi, etichette tutte uguali, azioni nel piede con
 *  una sola azione piena. I riquadri Disagio/Urgenza non sono più due rettangoli
 *  colorati: il calore resta, ma come pallino accanto al valore.
 *
 *  STESSE MANI, STESSI TASTI
 *  Questo foglio si apre venti volte di fila mentre si smaltisce la coda dei
 *  nuovi contatti: vale le stesse due scorciatoie di tutte le altre finestre
 *  del lead — Esc chiude, ⌘/Ctrl+↵ salva — e le tiene SCRITTE nel piede.
 *  I pulsanti non si ridipingono più a mano (`bg-white text-slate-700`): dentro
 *  il guscio i token sono già quelli chiari del CRM, e riscriverli significava
 *  avere due verità sullo stesso pulsante.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PublicLead } from "@/crm/types";
import { disagioHeat, urgenzaHeat, heatDotClass, HEAT_LABEL } from "@/crm/heat-utils";
import { DisagioBar } from "@/crm/DisagioBar";
import { Phone, MessageCircle, UserRound } from "lucide-react";
import { buildWhatsAppLink } from "@/crm/whatsapp";
import { formatDate } from "@/lib/date-format";
import {
  CampoFinestra,
  CLASSE_AREA,
  CLASSE_CAMPO,
  DatoFinestra,
  Foglio,
  Pillola,
  SezioneFinestra,
} from "@/crm/ui/Finestra";
//  Le due scorciatoie delle finestre (e il loro promemoria) sono definite una
//  volta sola in SchedaCliente: qui si importano.
import { ScorciatoieFinestra, useSalvaConTastiera } from "@/crm/SchedaCliente";
import { cn } from "@/lib/utils";

/** Due campi affiancati sul monitor, uno sotto l'altro sul telefono: metà
 *  larghezza di uno schermo da 375px è un bersaglio troppo stretto per il
 *  pollice, e un campo di testo lì dentro mostra tre lettere alla volta. */
const GRIGLIA_CAMPI = "grid grid-cols-1 gap-3 sm:grid-cols-2";

const URGENZA_OPTIONS = [
  { v: "subito", l: "Subito" },
  { v: "1mese", l: "Entro 1 mese" },
  { v: "convince", l: "Se convince → subito" },
  { v: "2_3mesi", l: "2–3 mesi" },
  { v: "valuto", l: "Sto valutando" },
];

interface Props {
  lead: PublicLead | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function PublicLeadDetailSheet({ lead, open, onOpenChange, onSaved }: Props) {
  const [draft, setDraft] = useState<PublicLead | null>(lead);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(lead);
  }, [lead]);

  /*  Il salvataggio sta PRIMA dell'uscita anticipata perché la scorciatoia da
      tastiera è un hook: gli hook non possono stare dopo un `return`, e la
      guardia su `draft` va quindi dentro la funzione, non attorno. */
  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("public_leads")
      .update({
        nome: draft.nome,
        cognome: draft.cognome,
        email: draft.email,
        telefono: draft.telefono,
        citta: draft.citta,
        data_slot: draft.data_slot,
        ora_slot: draft.ora_slot,
        disagio_score: draft.disagio_score,
        urgenza: draft.urgenza,
        notes: draft.notes,
        pain_points: draft.pain_points,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lead aggiornato");
    onSaved?.();
    onOpenChange(false);
  };

  //  ⌘/Ctrl+↵ salva da qualunque campo: la coda dei nuovi contatti si smaltisce
  //  senza staccare le mani dalla tastiera.
  useSalvaConTastiera(open && !!draft, () => void save());

  if (!draft) return null;

  const update = <K extends keyof PublicLead>(k: K, v: PublicLead[K]) =>
    setDraft({ ...draft, [k]: v });

  const dHeat = disagioHeat(draft.disagio_score);
  const uHeat = urgenzaHeat(draft.urgenza);
  const urgenzaLabel = draft.urgenza
    ? (URGENZA_OPTIONS.find((o) => o.v === draft.urgenza)?.l ?? draft.urgenza)
    : "—";

  return (
    <Foglio
      aperto={open}
      onCambio={onOpenChange}
      titolo="Modifica il lead"
      contesto={`${draft.nome} ${draft.cognome}`.trim() || "Lead dalla landing"}
      icona={UserRound}
      larghezza="md"
      classeCorpo="space-y-3"
      azioni={
        <>
          <ScorciatoieFinestra />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={() => void save()} disabled={saving} className="sm:min-w-28">
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </>
      }
    >
      {/* Il termometro del lead: due numeri, il colore solo nel pallino */}
      <SezioneFinestra titolo="Come arriva" classeCorpo="grid grid-cols-2 gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", heatDotClass(dHeat))} />
            Disagio
          </div>
          <div className="mt-0.5 text-[19px] font-semibold leading-tight tabular-nums text-slate-900">
            {draft.disagio_score ?? "—"}
            <span className="text-[12px] font-normal text-slate-400">/10</span>
          </div>
          <div className="mt-1.5">
            <DisagioBar score={draft.disagio_score} />
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{HEAT_LABEL[dHeat]}</div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", heatDotClass(uHeat))} />
            Urgenza
          </div>
          <div className="mt-0.5 truncate text-[15px] font-semibold leading-tight text-slate-900">
            {urgenzaLabel}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{HEAT_LABEL[uHeat]}</div>
        </div>
      </SezioneFinestra>

      <SezioneFinestra titolo="Anagrafica" classeCorpo="p-4 space-y-3">
        <div className={GRIGLIA_CAMPI}>
          <CampoFinestra etichetta="Nome">
            <Input
              value={draft.nome}
              onChange={(e) => update("nome", e.target.value)}
              className={CLASSE_CAMPO}
            />
          </CampoFinestra>
          <CampoFinestra etichetta="Cognome">
            <Input
              value={draft.cognome}
              onChange={(e) => update("cognome", e.target.value)}
              className={CLASSE_CAMPO}
            />
          </CampoFinestra>
        </div>
        <CampoFinestra etichetta="Email">
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => update("email", e.target.value)}
            className={CLASSE_CAMPO}
          />
        </CampoFinestra>
        <div className={GRIGLIA_CAMPI}>
          <CampoFinestra etichetta="Telefono">
            <Input
              value={draft.telefono}
              onChange={(e) => update("telefono", e.target.value)}
              className={CLASSE_CAMPO}
            />
          </CampoFinestra>
          <CampoFinestra etichetta="Città">
            <Input
              value={draft.citta}
              onChange={(e) => update("citta", e.target.value)}
              className={CLASSE_CAMPO}
            />
          </CampoFinestra>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${draft.telefono}`}>
              <Phone className="h-3.5 w-3.5" />
              Chiama
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={buildWhatsAppLink(
                draft.telefono,
                `Ciao ${draft.nome}, ho ricevuto la tua richiesta per Bio-Mimetic™. Ti contatto a breve!`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          </Button>
        </div>
      </SezioneFinestra>

      <SezioneFinestra titolo="Slot prenotato" classeCorpo="p-4">
        <div className={GRIGLIA_CAMPI}>
          <CampoFinestra etichetta="Data">
            <Input
              type="date"
              value={draft.data_slot ?? ""}
              onChange={(e) => update("data_slot", e.target.value || null)}
              className={CLASSE_CAMPO}
            />
          </CampoFinestra>
          <CampoFinestra etichetta="Orario">
            <Input
              type="time"
              value={draft.ora_slot ?? ""}
              onChange={(e) => update("ora_slot", e.target.value || null)}
              className={CLASSE_CAMPO}
            />
          </CampoFinestra>
        </div>
      </SezioneFinestra>

      <SezioneFinestra titolo="Qualifica" classeCorpo="p-4 space-y-3">
        <CampoFinestra etichetta={`Disagio · ${draft.disagio_score ?? 0}/10`}>
          <Slider
            value={[draft.disagio_score ?? 0]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => update("disagio_score", v[0])}
            className="mt-1"
          />
        </CampoFinestra>
        <CampoFinestra etichetta="Urgenza">
          <div className="flex flex-wrap gap-1.5">
            <Pillola
              attiva={!draft.urgenza}
              onClick={() => update("urgenza", null as PublicLead["urgenza"])}
            >
              Non dichiarata
            </Pillola>
            {URGENZA_OPTIONS.map((o) => (
              <Pillola
                key={o.v}
                attiva={draft.urgenza === o.v}
                onClick={() => update("urgenza", o.v as PublicLead["urgenza"])}
              >
                {o.l}
              </Pillola>
            ))}
          </div>
        </CampoFinestra>
        {draft.pain_points.length > 0 && (
          <CampoFinestra etichetta="Pain point dichiarati">
            <div className="flex flex-wrap gap-1.5">
              {draft.pain_points.map((p) => (
                <span
                  key={p}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  {p}
                </span>
              ))}
            </div>
          </CampoFinestra>
        )}
      </SezioneFinestra>

      <SezioneFinestra titolo="Note interne" classeCorpo="p-4">
        <Textarea
          rows={3}
          value={draft.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Aggiungi note interne…"
          className={CLASSE_AREA}
        />
      </SezioneFinestra>

      <SezioneFinestra titolo="Provenienza" classeCorpo="grid grid-cols-2 gap-3 p-4">
        <DatoFinestra etichetta="Sorgente">{draft.utm_source || "—"}</DatoFinestra>
        <DatoFinestra etichetta="Mezzo">{draft.utm_medium || "—"}</DatoFinestra>
        <DatoFinestra etichetta="Campagna">{draft.utm_campaign || "—"}</DatoFinestra>
        <DatoFinestra etichetta="Creato">{formatDate(draft.created_at)}</DatoFinestra>
      </SezioneFinestra>
    </Foglio>
  );
}
