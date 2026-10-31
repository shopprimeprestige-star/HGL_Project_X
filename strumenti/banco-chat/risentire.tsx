/** Banco di «Ricontatti» con stato + esito + data (31/10/2026): ElencoChat VERO con una lista in memoria; il
 *  salvataggio dell'esito (updateLead) modifica la scheda finta. Dati inventati, nessuna rete.
 *  ?fallisce=1 (il salvataggio non riesce) · ?largo=768 (larghezza del foglio, px).
 *  Uso: npx vite -c strumenti/banco-chat/vite.oggi.config.mjs  →  http://localhost:5198/risentire.html */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import { Toaster } from "../../src/components/ui/sonner";
import { ElencoChat } from "../../src/crm/chatwa/ElencoChat";
import { FILTRI_VUOTI, type FiltriChat } from "../../src/crm/chatwa/filtri";
import type { ChatItem, ChatWaApi } from "../../src/crm/chatwa/tipi";

const P = new URLSearchParams(location.search);
const GIORNO = 86_400_000;
const giorno = (n: number) => new Date(Date.now() + n * GIORNO).toISOString().slice(0, 10);
interface Caso {
  nome: string;
  cognome: string;
  stato: string;
  data?: number;
  esito?: string;
  consulenteId?: string;
}
const CASI: Caso[] = [
  { nome: "Giulia", cognome: "Verdi", stato: "in_attesa_acconto", data: 2, esito: "non_ha_risposto" },
  { nome: "Marco", cognome: "Bianchi", stato: "in_attesa_acconto", esito: "piu_avanti" },
  { nome: "Sara", cognome: "Neri", stato: "per_ora_no", data: 30, esito: "piu_avanti" },
  { nome: "Elena", cognome: "Gialli", stato: "per_ora_no" },
  { nome: "Charlotte", cognome: "Prova", stato: "da_ricontattare", data: -3, esito: "ci_sta_pensando" },
  { nome: "Alessandra Maria", cognome: "Rossi Montefiore", stato: "da_ricontattare", esito: "aspetta_i_soldi" },
  { nome: "Paolo", cognome: "Blu", stato: "sta_valutando", data: 5 },
  { nome: "Luca", cognome: "Rosa", stato: "da_contattare", data: 1 },
  { nome: "Altro", cognome: "Consulente", stato: "in_attesa_acconto", consulenteId: "f", data: 3 },
];
const crea = (c: Caso, i: number): ChatItem =>
  ({
    phone: `+39320000${String(i).padStart(4, "0")}`,
    leadId: String(i),
    contact: { id: `c${i}`, display_name: null, last_message_at: new Date().toISOString() },
    lastMessage: null,
    finestra: { aperta: false, frase: "" },
    daRispondere: { attesa: false, dal: null, anteprima: null },
    lead: {
      id: String(i),
      data: {
        nome: c.nome,
        cognome: c.cognome,
        telefono: `+39320000${String(i).padStart(4, "0")}`,
        stato: c.stato,
        consulenteId: c.consulenteId ?? "m",
        dataRicontatto: c.data === undefined ? undefined : giorno(c.data),
        esitoRicontatto: c.esito,
      },
    },
  }) as unknown as ChatItem;

function Banco() {
  const [chats, setChats] = useState<ChatItem[]>(CASI.map(crea));
  const [filtri, setFiltri] = useState<FiltriChat>(P.get("acceso") ? { ...FILTRI_VUOTI, ricontatti: true } : FILTRI_VUOTI);
  const [ricerca, setRicerca] = useState("");
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__updateLead = async (id: string, patch: Record<string, unknown>) => {
      await new Promise((r) => setTimeout(r, 200));
      if (P.get("fallisce")) return false;
      setChats((l) =>
        l.map((c) =>
          c.lead?.id === id ? ({ ...c, lead: { ...c.lead, data: { ...c.lead.data, ...patch } } } as ChatItem) : c,
        ),
      );
      return true;
    };
  }, []);
  const api = {
    chats,
    daRispondere: [],
    visibili: chats,
    filtri,
    setFiltri,
    ricerca,
    setRicerca,
    attiva: null,
    apri: () => {},
    caricamento: false,
    cambiaStatoLead: async () => {},
    creaSchedaConStato: async () => {},
  } as unknown as ChatWaApi;
  const largo = P.get("largo");
  return (
    <div style={{ height: "100dvh", width: largo ? `${largo}px` : "100%" }} className="flex bg-background">
      <ElencoChat api={api} onCreaScheda={() => {}} />
      <Toaster />
    </div>
  );
}
createRoot(document.getElementById("r")!).render(
  <StrictMode>
    <Banco />
  </StrictMode>,
);
