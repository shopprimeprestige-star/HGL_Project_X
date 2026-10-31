/** Banco di «Ricontatti» con esito + data + nascondi + priorità (31/10/2026): ElencoChat VERO con una lista in memoria; il
 *  salvataggio (updateLead) modifica la scheda finta. Dati inventati, nessuna rete.
 *  ?acceso=1 (parte già in Ricontatti) · ?fallisce=1 (il salvataggio non riesce) · ?largo=768 (larghezza, px)
 *  · ?molti=40 (altri 40 lead finti, per vedere la barra incollata scorrendo) · ?nascosti=1 (due già nascosti)
 *  · ?priorita=1 (due già in priorità: Sara e Elena). Ogni lead ha un arrivo diverso (`createdAt`, giorni fa):
 *  l'ordine dell'elenco è per ARRIVO, non per data di ricontatto.
 *  Uso: npx vite -c strumenti/banco-chat/vite.oggi.config.mjs  →  http://localhost:5198/risentire.html */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import { Toaster } from "../../src/components/ui/sonner";
import { ElencoChat } from "../../src/crm/chatwa/ElencoChat";
import { FILTRI_VUOTI, type FiltriChat } from "../../src/crm/chatwa/filtri";
import { patchNascondi } from "../../src/crm/chatwa/ricontatti";
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
  nascosto?: boolean;
  /** Quanti giorni fa è arrivato il lead (`createdAt`). */
  arrivo?: number;
  priorita?: boolean;
}
const CASI: Caso[] = [
  { nome: "Giulia", cognome: "Verdi", stato: "in_attesa_acconto", arrivo: 3, data: 2, esito: "non_ha_risposto" },
  { nome: "Marco", cognome: "Bianchi", stato: "in_attesa_acconto", arrivo: 1, esito: "piu_avanti" },
  { nome: "Sara", cognome: "Neri", stato: "per_ora_no", arrivo: 40, priorita: P.get("priorita") !== null, data: 30, esito: "piu_avanti" },
  { nome: "Elena", cognome: "Gialli", stato: "per_ora_no", arrivo: 90, priorita: P.get("priorita") !== null },
  { nome: "Charlotte", cognome: "Prova", stato: "da_ricontattare", arrivo: 12, data: -3, esito: "ci_sta_pensando" },
  { nome: "Alessandra Maria", cognome: "Rossi Montefiore", stato: "da_ricontattare", arrivo: 6, esito: "aspetta_i_soldi" },
  { nome: "Paolo", cognome: "Blu", stato: "sta_valutando", arrivo: 8, data: 5 },
  { nome: "Luca", cognome: "Rosa", stato: "da_contattare", arrivo: 0, data: 1 },
  { nome: "Altro", cognome: "Consulente", stato: "in_attesa_acconto", consulenteId: "f", arrivo: 2, data: 3 },
];
const ALTRI: Caso[] = Array.from({ length: Number(P.get("molti") ?? 0) }, (_, i) => ({
  nome: `Lead${i + 1}`,
  cognome: "Finto",
  stato: i % 2 ? "per_ora_no" : "sta_valutando",
  arrivo: 100 + i,
  data: i % 3 === 0 ? undefined : i - 10,
  esito: i % 4 === 0 ? "non_ha_risposto" : undefined,
}));
const PRENASCOSTI: Caso[] = P.get("nascosti")
  ? [
      { nome: "Roberta", cognome: "Nascosta", stato: "in_attesa_acconto", data: 9, esito: "piu_avanti", nascosto: true },
      { nome: "Tiziano", cognome: "Nascosto", stato: "per_ora_no", nascosto: true },
    ]
  : [];
const crea = (c: Caso, i: number): ChatItem => {
  const chat = creaBase(c, i);
  return c.nascosto
    ? ({ ...chat, lead: { ...chat.lead, data: { ...chat.lead!.data, ...patchNascondi(chat as never) } } } as ChatItem)
    : chat;
};
const creaBase = (c: Caso, i: number): ChatItem =>
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
        createdAt:
          c.arrivo === undefined ? undefined : new Date(Date.now() - c.arrivo * GIORNO).toISOString(),
        ricontattoPrioritaIl: c.priorita ? new Date().toISOString() : undefined,
      },
    },
  }) as unknown as ChatItem;

function Banco() {
  const [chats, setChats] = useState<ChatItem[]>([...CASI, ...ALTRI, ...PRENASCOSTI].map(crea));
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
