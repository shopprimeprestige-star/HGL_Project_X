// ── I SUOI LEAD ─────────────────────────────────────────────────────────────
//  L'agenda risponde alla domanda "adesso cosa faccio"; questa pagina risponde
//  a quella successiva: "dov'è finito quel contatto di due settimane fa". Per
//  questo bastano due strumenti — una ricerca e un filtro per stato — e non una
//  tabella di dodici colonne: chi cerca una persona la cerca per nome o per
//  numero di telefono.
//
//  Sono solo i suoi: l'elenco viene chiesto già filtrato sul consulente, non
//  filtrato dopo averlo ricevuto tutto.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Phone, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useConsulente, azioneLead, mieiLead } from "@/crm/consulente-sessione";
import { Input } from "@/components/ui/input";
import {
  ALL_LEAD_STATUSES,
  LEAD_STATUS_COLOR,
  LEAD_STATUS_LABEL,
  statiPer,
  type Lead,
  type LeadData,
  type LeadStatus,
} from "@/crm/types";
import { buildWhatsAppLink, getWhatsAppMessageForStatus } from "@/crm/whatsapp";

export const Route = createFileRoute("/consulente/leads")({
  component: MieiLeadPage,
});

const fmtData = (d?: string) => {
  if (!d) return "";
  const p = d.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

function MieiLeadPage() {
  const io = useConsulente();
  const consulenteId = io?.id ?? "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [cerca, setCerca] = useState("");
  const [stato, setStato] = useState<"tutti" | LeadStatus>("tutti");

  const carica = useCallback(async () => {
    if (!consulenteId) return;
    setCaricando(true);
    const esito = await mieiLead();
    if (!esito.ok) {
      setErrore(esito.motivo ?? "Non è stato possibile caricare i lead.");
      setLeads([]);
    } else {
      setErrore(null);
      setLeads(esito.leads as Lead[]);
    }
    setCaricando(false);
  }, [consulenteId]);

  useEffect(() => {
    void carica();
  }, [carica]);

  //  Nel filtro compaiono soltanto gli stati che esistono davvero fra i suoi
  //  lead: un elenco di diciassette voci di cui quattordici vuote fa perdere
  //  tempo a ogni ricerca.
  const statiPresenti = useMemo(() => {
    const presenti = new Set(leads.map((l) => l.data.stato));
    return ALL_LEAD_STATUSES.filter((s) => presenti.has(s));
  }, [leads]);

  const risultati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    const soloCifre = q.replace(/\D/g, "");
    return leads.filter((l) => {
      if (stato !== "tutti" && l.data.stato !== stato) return false;
      if (!q) return true;
      const testo = [l.data.nome, l.data.cognome, l.data.email, l.data.citta]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (testo.includes(q)) return true;
      //  Il numero si cerca come lo si legge: con o senza prefisso, spazi e
      //  trattini, che nei contatti importati non sono mai scritti allo stesso
      //  modo.
      return (
        soloCifre.length >= 3 && (l.data.telefono || "").replace(/\D/g, "").includes(soloCifre)
      );
    });
  }, [leads, cerca, stato]);

  /** Come nell'agenda: la riga cambia subito e torna indietro se il server
   *  rifiuta. Permesso e assegnazione del lead li decide la rotta. */
  const cambiaStato = async (l: Lead, nuovoStato: LeadStatus) => {
    const precedente = l.data;
    setLeads((prev) =>
      prev.map((x) => (x.id === l.id ? { ...x, data: { ...precedente, stato: nuovoStato } } : x)),
    );
    const esito = await azioneLead(l.id, "stato", { stato: nuovoStato });
    if (!esito.ok) {
      setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, data: precedente } : x)));
      toast.error("Stato non salvato", { description: esito.motivo });
      return;
    }
    if (esito.lead) {
      const aggiornato = esito.lead.data as LeadData;
      setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, data: aggiornato } : x)));
    }
  };

  if (!io) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground">I miei lead</h1>
          <p className="text-[12px] text-muted-foreground">
            {risultati.length} {risultati.length === 1 ? "contatto" : "contatti"}
            {risultati.length !== leads.length ? ` su ${leads.length}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carica()}
          title="Ricarica l'elenco"
          className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${caricando ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca per nome, telefono, email o città"
            className="pl-8 pr-8"
          />
          {cerca && (
            <button
              type="button"
              onClick={() => setCerca("")}
              title="Cancella la ricerca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          value={stato}
          onChange={(e) => setStato(e.target.value as "tutti" | LeadStatus)}
          className="h-9 rounded-md border border-input bg-background px-2 text-[13px] text-foreground outline-none sm:w-52"
        >
          <option value="tutti">Tutti gli stati</option>
          {statiPresenti.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {errore && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
          {errore}
        </p>
      )}

      <section className="rounded-xl border border-border bg-card">
        {caricando && leads.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
            Caricamento dei contatti…
          </p>
        ) : risultati.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
            {leads.length === 0
              ? "Non ti è ancora stato assegnato nessun lead."
              : "Nessun contatto corrisponde alla ricerca."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {risultati.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-foreground">
                    {l.data.nome} {l.data.cognome}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <select
                      value={l.data.stato}
                      onChange={(e) => cambiaStato(l, e.target.value as LeadStatus)}
                      className={`cursor-pointer rounded border px-1.5 py-px text-[10.5px] font-semibold outline-none ${LEAD_STATUS_COLOR[l.data.stato]}`}
                    >
                      {l.data.stato === "acconto" && (
                        <option value="acconto">{LEAD_STATUS_LABEL.acconto} (automatico)</option>
                      )}
                      {statiPer(l.data).map((st) => (
                        <option key={st} value={st}>
                          {LEAD_STATUS_LABEL[st]}
                        </option>
                      ))}
                    </select>
                    {l.data.dataMeeting && (
                      <span>
                        Consulenza {fmtData(l.data.dataMeeting)}
                        {l.data.oraMeeting ? ` alle ${l.data.oraMeeting}` : ""}
                      </span>
                    )}
                    {l.data.citta && <span>{l.data.citta}</span>}
                  </div>
                </div>
                {l.data.telefono && (
                  <>
                    <a
                      href={`tel:${l.data.telefono.replace(/[^\d+]/g, "")}`}
                      title="Chiama"
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <a
                      href={buildWhatsAppLink(
                        l.data.telefono,
                        getWhatsAppMessageForStatus(l, io.nome),
                      )}
                      target="_blank"
                      rel="noopener"
                      title="Scrivi su WhatsApp"
                      className="shrink-0 rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-500/10"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
