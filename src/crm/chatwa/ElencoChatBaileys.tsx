/** ── «WHATSAPP BAILEYS»: LA LISTA SEMPLICE (commessa 2026-11-13-chat-baileys, T8) ──
 *
 *  SPEC punto 1: solo le chat con almeno un messaggio del ponte, un campo di ricerca,
 *  ordine per data (come WhatsApp, `ordineWhatsapp.ts`). NIENTE filtri a gruppi, niente
 *  pastiglie di stato, niente stelle: non è `ElencoChat.tsx` spento a metà, è una lista
 *  nuova, piccola, che riusa solo le funzioni pure già scritte (vedi PIANO.md, «Decido
 *  io»). La ricerca è `useState` locale, non `useFiltriChat`: non deve sopravvivere al
 *  cambio pagina, nessuno l'ha chiesto.
 *
 *  `chatBaileys` è la logica pura (filtro + ordine): provata in
 *  prove/idee/elenco-chat-baileys.mjs, bundle a parte come per gli altri componenti
 *  React testati (vedi prove/idee/testi-wame.mjs). ───────────────────────────────── */
import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { combaciaRicerca } from "./cercaChat";
import { ordinaComeWhatsapp } from "./ordineWhatsapp";
import { haMessaggioPonte } from "./ponteChat";
import { anteprimaRiga } from "./anteprima-riga";
import { ultimoDellaChat } from "./stato";
import { formatTimeIT, initials, numeroLeggibile } from "./formati";
import { IconaMedia } from "./IconaMedia";
import { nomeChat } from "./RigaChat";
import type { ChatItem } from "./tipi";

/** Le chat da mostrare: solo quelle col ponte, che combaciano con la ricerca, dal
 *  messaggio più recente. Pura: niente React, niente Supabase. Non muta l'ingresso. */
export function chatBaileys(chats: readonly ChatItem[], ricerca: string): ChatItem[] {
  const conPonte = chats.filter((c) => haMessaggioPonte(c.contact) && combaciaRicerca(c, ricerca));
  return ordinaComeWhatsapp(conPonte);
}

export interface ElencoChatBaileysProps {
  /** Tutte le chat lette da `useChatWa` (non filtrate: le filtra questo componente). */
  chats: ChatItem[];
  /** Il `phone` della chat aperta, per evidenziare la riga; `null` = nessuna aperta. */
  attivo: string | null;
  onApri: (phone: string) => void;
  onCreaScheda: (chat: ChatItem) => void;
}

/** Una riga della lista: nome (o numero), ora dell'ultimo messaggio, anteprima corta. Un
 *  bottone solo; «Crea scheda» sta fuori (un bottone dentro un bottone non è valido e sul
 *  telefono prende il tocco sbagliato), stesso disegno di `RigaChat.tsx`. */
function RigaBaileys({
  chat: c,
  attiva,
  onApri,
  onCreaScheda,
}: {
  chat: ChatItem;
  attiva: boolean;
  onApri: () => void;
  onCreaScheda: () => void;
}) {
  const nome = nomeChat(c);
  const numero = numeroLeggibile(c.phone);
  const numeroSotto = nome.replace(/\D/g, "") !== numero.replace(/\D/g, "");
  const ultimo = ultimoDellaChat(c.lastMessage, c.contact);
  const a = anteprimaRiga({ ultimo, contatto: c.contact, inAttesa: false, adesso: Date.now() });
  const ora = formatTimeIT(ultimo?.created_at ?? c.contact?.last_message_at ?? null);
  const senzaScheda = !c.lead;

  return (
    <li className={cn("relative border-b border-border", attiva && "bg-emerald-50/60")}>
      <button
        type="button"
        onClick={onApri}
        aria-current={attiva ? "true" : undefined}
        className="flex w-full items-start gap-3 py-2.5 pl-3 pr-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Avatar className="h-11 w-11 shrink-0 md:h-10 md:w-10">
          <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700">
            {c.lead ? initials(c.lead.data.nome, c.lead.data.cognome) : "?"}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-[15px] font-semibold leading-5 text-foreground [overflow-wrap:anywhere] md:text-[13px] md:leading-[18px]">
              {nome}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground md:text-[11px]">
              {ora}
            </span>
          </span>
          {numeroSotto && (
            <span className="block text-[12px] tabular-nums text-muted-foreground md:text-[11px]">
              {numero}
            </span>
          )}
          <span className="mt-0.5 flex items-center gap-1 text-[13px] leading-[18px] text-muted-foreground md:text-[12px] md:leading-4">
            {a.mio && <span className="shrink-0 font-medium">Tu:</span>}
            {a.media && <IconaMedia tipo={a.media} className="shrink-0" />}
            <span className="min-w-0 truncate">
              {a.nessunMessaggio ? "Nessun messaggio" : a.testo}
            </span>
          </span>
        </span>
      </button>
      {senzaScheda && (
        <div className="flex items-center pb-1.5 pl-[68px] pr-3">
          <span className="text-[12px] text-muted-foreground">Numero senza scheda</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onCreaScheda();
            }}
            className="-my-2 ml-1 h-11 px-2 text-[13px] text-primary hover:text-primary md:h-8 md:text-xs"
          >
            Crea scheda
          </Button>
        </div>
      )}
    </li>
  );
}

/** La lista della sezione «WhatsApp Baileys»: campo di ricerca in cima, poi le chat dal
 *  più recente. Niente riquadri, niente filtri: una lista sola, come chiede la SPEC. */
export function ElencoChatBaileys({ chats, attivo, onApri, onCreaScheda }: ElencoChatBaileysProps) {
  const [ricerca, setRicerca] = useState("");
  const conPonte = chats.filter((c) => haMessaggioPonte(c.contact));
  const elenco = chatBaileys(chats, ricerca);
  const cercando = ricerca.trim() !== "";

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3 md:px-2 md:py-2.5">
        <p className="t-riga font-semibold text-foreground">
          WhatsApp Baileys
          <span className="tabular-nums text-muted-foreground"> · {conPonte.length}</span>
        </p>
      </div>
      <div className="px-3 pb-2 md:px-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground lg:pointer-fine:left-2.5 lg:pointer-fine:h-3.5 lg:pointer-fine:w-3.5"
          />
          <Input
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca nome o numero…"
            aria-label="Cerca nome o numero"
            className="h-11 bg-background pl-9 text-base focus-visible:ring-2 focus-visible:ring-primary md:text-base lg:pointer-fine:h-8 lg:pointer-fine:pl-8 lg:pointer-fine:text-[13px]"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border">
        {conPonte.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="t-nota text-muted-foreground">Nessuna chat dal telefono, per ora</p>
          </div>
        ) : elenco.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="t-nota text-muted-foreground">Nessuna chat trovata</p>
          </div>
        ) : (
          <ul aria-label="Chat del ponte WhatsApp, dall'ultimo messaggio">
            {elenco.map((c) => (
              <RigaBaileys
                key={c.phone}
                chat={c}
                attiva={attivo === c.phone}
                onApri={() => onApri(c.phone)}
                onCreaScheda={() => onCreaScheda(c)}
              />
            ))}
          </ul>
        )}
        {/*  Per chi usa lo screen reader: a ogni cambio, quante chat si vedono. */}
        <div role="status" aria-live="polite" className="sr-only">
          {cercando ? `${elenco.length} chat trovate` : `${conPonte.length} chat`}
        </div>
      </div>
    </aside>
  );
}
