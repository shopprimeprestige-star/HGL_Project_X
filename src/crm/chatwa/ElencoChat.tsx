import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { CheckCheck, Filter, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_COLOR, LEAD_STATUS_LABEL } from "@/crm/types";
import { formatTimeIT, initials, previewText } from "./formati";
import type { ElencoChatProps } from "./tipi";

/** L'elenco delle chat. Riempie il contenitore che gli dà `PaginaChat`: larghezza
 *  e visibilità non sono affar suo (R12). */
export function ElencoChat({ api }: ElencoChatProps) {
  const { filtro, setFiltro, ricerca, setRicerca, visibili, caricamento, attiva, apri } = api;
  return (
    <aside className="w-full h-full border-r border-border flex flex-col bg-card">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">Chat</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
              <Filter className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Filtra</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFiltro("all")}>Tutte</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFiltro("unread")}>Non letti</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFiltro("with-lead")}>Con lead CRM</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFiltro("unknown")}>Sconosciuti</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca nome o numero…"
            className="pl-8 h-8 text-[13px] bg-background"
          />
        </div>
      </div>

      <div className="px-2 py-2 border-b border-border flex gap-1.5 overflow-x-auto">
        {[
          { v: "all" as const, l: "Tutte" },
          { v: "unread" as const, l: "Non letti" },
          { v: "with-lead" as const, l: "Con lead" },
          { v: "unknown" as const, l: "Sconosciuti" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltro(f.v)}
            className={cn(
              "text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border",
              filtro === f.v
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-background text-muted-foreground border-border hover:bg-muted",
            )}
          >
            {f.l}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        {caricamento ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento chat…
          </div>
        ) : visibili.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-xs">
            Nessuna chat in questa vista
          </div>
        ) : (
          visibili.map((c) => {
            const isActive = attiva?.phone === c.phone;
            const last = c.lastMessage;
            const fullName = c.lead
              ? `${c.lead.data.nome} ${c.lead.data.cognome}`.trim()
              : c.contact?.display_name || "Sconosciuto";
            return (
              <button
                key={c.phone}
                onClick={() => apri(c.phone)}
                className={cn(
                  "w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-border transition-colors",
                  isActive ? "bg-emerald-50/60" : "hover:bg-muted/50",
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    {c.lead ? initials(c.lead.data.nome, c.lead.data.cognome) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {c.lead && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] py-0 h-4 font-medium border shrink-0",
                            LEAD_STATUS_COLOR[c.lead.data.stato],
                          )}
                        >
                          {LEAD_STATUS_LABEL[c.lead.data.stato]}
                        </Badge>
                      )}
                      <span className="text-[13px] font-semibold text-foreground truncate">
                        {fullName}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTimeIT(last?.created_at ?? c.contact?.last_message_at ?? null)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate font-mono">
                    {c.phone}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[12px] text-muted-foreground truncate flex-1">
                      {last?.direction === "outbound" && (
                        <CheckCheck
                          className={cn(
                            "inline h-3 w-3 mr-1",
                            last?.status === "read" ? "text-sky-500" : "text-muted-foreground",
                          )}
                        />
                      )}
                      {previewText(last?.body ?? "")}
                    </p>
                    {c.unread > 0 && (
                      <span className="h-4.5 min-w-[18px] px-1.5 rounded-full bg-emerald-500 text-[10px] font-bold text-white grid place-items-center">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </ScrollArea>
    </aside>
  );
}
