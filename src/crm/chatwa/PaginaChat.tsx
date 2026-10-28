import { useState } from "react";
import { AlertCircle, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppLeadsPanel } from "@/crm/WhatsAppLeadsPanel";
import { LeadDialog } from "@/crm/LeadDialog";
import { QuickStatusDialog } from "@/crm/QuickStatusDialog";
import { useChiusura } from "@/crm/ChiusuraDialog";
import { Segmento } from "@/crm/ui";
import type { Lead, LeadData, LeadStatus } from "@/crm/types";
//  ⚠️ L'editor dei testi sta in un file suo perché lo mostra anche la scheda
//   «Messaggi» delle Impostazioni: due schermate gemelle per la stessa
//   configurazione si scostano al primo ritocco.
import { EditorMessaggi } from "@/crm/EditorMessaggi";
import { Conversazione } from "./Conversazione";
import { ElencoChat } from "./ElencoChat";
import type { ChatItem } from "./tipi";
import { useChatWa } from "./useChatWa";

/** Le due viste della pagina: le conversazioni vere e i testi che le popolano. */
type Vista = "chat" | "modelli";

/** La pagina /CRM/whatsapp: compone intestazione, le due viste, i dialoghi.
 *  ⚠️ Larghezza e visibilità delle colonne le decide SOLO questo file (R12): i
 *  figli (`ElencoChat`, `Conversazione`) riempiono il loro contenitore. */
export function PaginaChat() {
  const [vista, setVista] = useState<Vista>("chat");
  const [leadsPanelOpen, setLeadsPanelOpen] = useState(true);

  // LeadDialog (modifica lead esistente o creazione nuovo lead da numero sconosciuto)
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadDialogLead, setLeadDialogLead] = useState<Lead | null>(null);
  const [leadDialogPrefill, setLeadDialogPrefill] = useState<Partial<LeadData> | undefined>(
    undefined,
  );

  // Quick status popup (stessi popup della pagina Lead)
  const [quickLead, setQuickLead] = useState<Lead | null>(null);
  const [quickStatus, setQuickStatus] = useState<LeadStatus | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  //  La finestra delle tre chiusure vinte: si porta dietro i suoi stati.
  const chiusura = useChiusura();

  const api = useChatWa({
    intercettaChiusura: (lead, stato) => chiusura.intercetta(lead, stato),
    apriStatoRapido: (lead, stato) => {
      setQuickLead(lead);
      setQuickStatus(stato);
      setQuickOpen(true);
    },
  });

  /** Numero sconosciuto → dialog nuovo lead con telefono prefillato (l'utente sceglie consulente, fascia oraria, ecc.). */
  const creaScheda = (chat: ChatItem) => {
    setLeadDialogLead(null);
    setLeadDialogPrefill({
      telefono: chat.phone,
      nome: chat.contact?.display_name || "",
    });
    setLeadDialogOpen(true);
  };

  // shortcut: «Abbina a una scheda» non esiste ancora, la scrivono T8/T11.
  const abbinaDaFare = () => {};

  const openHeaderEdit = () => {
    const chat = api.attiva;
    if (!chat) return;
    if (chat.lead) {
      setLeadDialogLead(chat.lead);
      setLeadDialogPrefill(undefined);
      setLeadDialogOpen(true);
    } else {
      creaScheda(chat);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {/* Header sezione — coerente col resto del CRM */}
      <div className="border-b border-border bg-card px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-emerald-50 grid place-items-center text-emerald-600 border border-emerald-100">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight text-foreground">
              WhatsApp Business
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {api.hasConfig === false
                ? "Credenziali non configurate"
                : vista === "chat"
                  ? "Conversazioni in tempo reale"
                  : "I testi che partono da tutto il CRM"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/*  Due viste, non due pagine: i messaggi si correggono mentre si
              scrive, non andando a cercare un pannello di impostazioni. */}
          <div className="flex items-center gap-1.5">
            <Segmento attivo={vista === "chat"} onClick={() => setVista("chat")}>
              Conversazioni
            </Segmento>
            <Segmento
              attivo={vista === "modelli"}
              onClick={() => setVista("modelli")}
              titolo="I messaggi preimpostati per ogni stato"
            >
              Messaggi preimpostati
            </Segmento>
          </div>
          {api.hasConfig === false && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 gap-1 font-medium"
            >
              <AlertCircle className="h-3 w-3" /> Configura in Impostazioni
            </Badge>
          )}
          {vista === "chat" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLeadsPanelOpen((v) => !v)}
              className="h-8 text-xs"
              title={leadsPanelOpen ? "Nascondi pannello lead" : "Mostra pannello lead"}
            >
              {leadsPanelOpen ? "Nascondi lead" : "Mostra lead"}
            </Button>
          )}
        </div>
      </div>

      {vista === "modelli" && <EditorMessaggi />}

      {/*  La chat resta montata mentre si guardano i modelli: tornando indietro
          si ritrova la conversazione aperta e lo scorrimento dov'era. */}
      <div className={vista === "chat" ? "flex flex-1 min-h-0" : "hidden"}>
        {/* Colonna elenco: larghezza qui, non nel figlio (R12) */}
        <div className="w-[340px] flex flex-col">
          <ElencoChat api={api} onCreaScheda={creaScheda} onAbbina={abbinaDaFare} />
        </div>

        {/* Colonna conversazione */}
        <div className="flex-1 min-w-0">
          <Conversazione
            api={api}
            // shortcut: oggi nessuna freccia ←, la scrive T11 (navigazione), poi questa riga cambia.
            onIndietro={() => {}}
            onApriLead={openHeaderEdit}
            onCreaScheda={creaScheda}
            onAbbina={abbinaDaFare}
          />
        </div>

        {/* Pannello lead a destra — collassabile */}
        {leadsPanelOpen && <WhatsAppLeadsPanel onClose={() => setLeadsPanelOpen(false)} />}
      </div>

      {/* Dialog: modifica lead esistente o crea nuovo da numero sconosciuto */}
      <LeadDialog
        open={leadDialogOpen}
        onOpenChange={(v) => {
          setLeadDialogOpen(v);
          if (!v) {
            setLeadDialogLead(null);
            setLeadDialogPrefill(undefined);
          }
        }}
        lead={leadDialogLead}
        prefill={leadDialogPrefill}
      />

      {/* Quick status popup — stessi popup della pagina Leads, sfondo bianco coerente CRM */}
      <QuickStatusDialog
        open={quickOpen}
        onOpenChange={(v) => {
          setQuickOpen(v);
          if (!v) {
            setQuickLead(null);
            setQuickStatus(null);
          }
        }}
        lead={quickLead}
        newStatus={quickStatus}
      />
      {chiusura.finestra}
    </div>
  );
}
