/** Banco di «No show» e «Da spostare» sotto la barra del meet (31/10/2026): le componenti VERE (BarraProssimoMeet,
 *  AzioniMeet, prossimoMeet) nello stesso contenitore sticky di ElencoChat, con una lista in memoria dove il cambio
 *  di stato modifica la scheda: si vede il meet che esce e il successivo che entra. Dati finti, nessuna rete.
 *  ?lento=1 (salvataggio da 1,5 s) · ?fallisce=1 (il salvataggio non riesce) · ?senza=1 (consulente "senza link")
 *  ?uno=1 (un solo meet) · ?largo=768 (larghezza del foglio, in px).
 *  Uso: npx vite -c strumenti/banco-chat/vite.oggi.config.mjs  →  http://localhost:5198/azioni.html */
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import "../../src/styles.css";
import { Toaster } from "../../src/components/ui/sonner";
import { AzioniMeet } from "../../src/crm/chatwa/AzioniMeet";
import { BarraProssimoMeet } from "../../src/crm/chatwa/BarraProssimoMeet";
import { prossimoMeet } from "../../src/crm/chatwa/prossimo-meet";
import type { ChatItem } from "../../src/crm/chatwa/tipi";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "../../src/crm/types";

const P = new URLSearchParams(location.search);
const OGGI = "2026-10-31";
const ADESSO = Date.parse(`${OGGI}T10:00:00+01:00`);
const consulenti = [
  { id: "m", data: { nome: "Mirko Rossi" } },
  { id: "f", data: { nome: "Filippo" } },
];
const meet = (id: string, nome: string, cognome: string, ora: string, consulenteId = "m", extra = {}): ChatItem =>
  ({
    phone: `+39320000${id.padStart(4, "0")}`,
    leadId: id,
    finestra: { aperta: false },
    lead: {
      id,
      data: {
        nome, cognome, telefono: `+39320000${id.padStart(4, "0")}`, stato: "appuntamento_fissato", dataMeeting: OGGI, oraMeeting: ora,
        consulenteId, linkMeeting: "https://meet.example.test/stanza-prova", ...extra,
      },
    },
  }) as unknown as ChatItem;
const INIZIALI: ChatItem[] = [
  meet("1", "Giulia", "Verdi", "15:00"),
  meet("2", "Marco", "Bianchi", "17:00"),
  meet("3", "Sofia", "Neri", "18:30"),
  meet("4", "Luca", "Gialli", "16:00", "f", { dataRicontatto: "2026-11-05" }),
];
const RIGHE = Array.from({ length: 28 }, (_, i) => ({ id: `r${i}`, nome: `Cliente di prova ${i + 1}`, ultimo: `Messaggio di prova numero ${i + 1}` }));

function Banco() {
  const [chat, setChat] = useState<ChatItem[]>(P.get("uno") ? INIZIALI.slice(0, 1) : INIZIALI);
  const cambiaStatoLead = async (lead: Lead, stato: LeadStatus) => {
    await new Promise((r) => setTimeout(r, P.get("lento") ? 1500 : 250));
    if (P.get("fallisce")) {
      toast.error("Stato NON salvato", { description: "La scheda in archivio è rimasta com'era. Riprova." });
      return;
    }
    const prima = lead.data.stato;
    setChat((l) => l.map((c) => (c.lead?.id === lead.id ? ({ ...c, lead: { ...c.lead, data: { ...c.lead.data, stato } } } as ChatItem) : c)));
    toast.success(`${lead.data.nome} → ${LEAD_STATUS_LABEL[stato]}`, {
      action: { label: "Annulla", onClick: () => setChat((l) => l.map((c) => (c.lead?.id === lead.id ? ({ ...c, lead: { ...c.lead, data: { ...c.lead.data, stato: prima } } } as ChatItem) : c))) },
    });
  };
  const m = useMemo(() => prossimoMeet(chat, OGGI, ADESSO, consulenti as never), [chat]);
  const largo = P.get("largo");
  return (
    <div style={{ height: "100dvh", width: largo ? `${largo}px` : "100%" }} className="flex flex-col bg-white">
      <div className="border-b border-border p-3 text-sm font-semibold">Chat (banco)</div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border">
        {m && (
          <div className="sticky top-0 z-10">
            <BarraProssimoMeet meet={m} onApri={() => {}} />
            <AzioniMeet key={m.chat.phone} meet={m} onCambiaStato={cambiaStatoLead} />
          </div>
        )}
        <ul>
          {RIGHE.map((r) => (
            <li key={r.id} className="border-b border-border px-3 py-3">
              <div className="text-[14px] font-medium">{r.nome}</div>
              <div className="text-[13px] text-muted-foreground">{r.ultimo}</div>
            </li>
          ))}
        </ul>
      </div>
      <Toaster />
    </div>
  );
}
createRoot(document.getElementById("r")!).render(
  <StrictMode>
    <Banco />
  </StrictMode>,
);
