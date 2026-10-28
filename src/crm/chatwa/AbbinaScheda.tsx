import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCRM } from "@/crm/CRMContext";
import type { Lead } from "@/crm/types";
import type { ChatItem, ChatWaApi } from "./tipi";

/** Quante schede mostrare al massimo: sotto si scrive per restringere. */
const MAX_SCHEDE = 30;

const nomeScheda = (l: Lead) => `${l.data.nome} ${l.data.cognome}`.trim() || "Senza nome";
const cifre = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

interface Props {
  /** La chat da abbinare; `null` = finestra chiusa. */
  chat: ChatItem | null;
  api: Pick<ChatWaApi, "abbina">;
  onChiudi: () => void;
}

/** «Abbina a una scheda»: cerca fra le schede, conferma, scrive il legame (D18).
 *  ⚠️ `api.abbina` lavora sulla chat APERTA: chi apre questa finestra da una riga
 *  dell'elenco deve prima aprire quella chat (`api.apri(chat.phone)`). */
export function AbbinaScheda({ chat, api, onChiudi }: Props) {
  return (
    <Dialog open={chat !== null} onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-3 p-4 md:p-6">
        {chat && <Corpo key={chat.phone} chat={chat} api={api} onChiudi={onChiudi} />}
      </DialogContent>
    </Dialog>
  );
}

function Corpo({ chat, api, onChiudi }: Props & { chat: ChatItem }) {
  const { leads } = useCRM();
  const [ricerca, setRicerca] = useState("");
  const [scelta, setScelta] = useState<Lead | null>(null);
  const [invio, setInvio] = useState(false);

  const trovate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    const qc = cifre(q);
    const ok = q
      ? leads.filter(
          (l) =>
            nomeScheda(l).toLowerCase().includes(q) ||
            (qc.length >= 3 && cifre(l.data.telefono).includes(qc)),
        )
      : leads;
    return [...ok].sort((a, b) => nomeScheda(a).localeCompare(nomeScheda(b), "it"));
  }, [leads, ricerca]);

  const conferma = async () => {
    if (!scelta || invio) return;
    setInvio(true);
    try {
      //  Il numero mostrato va con la scelta: l'hook rifiuta se la chat aperta è un'altra.
      await api.abbina(scelta.id, chat.phone);
      onChiudi();
    } catch {
      //  Il toast l'ha già mostrato `api.abbina`: qui basta restare aperti per riprovare.
      setInvio(false);
    }
  };

  if (scelta) {
    return (
      <>
        <DialogHeader className="text-left">
          <DialogTitle>Abbinare questa chat?</DialogTitle>
          <DialogDescription>
            Il numero <span className="font-mono">{chat.phone}</span> sarà collegato alla scheda di{" "}
            <strong className="text-foreground">{nomeScheda(scelta)}</strong>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="h-11"
            disabled={invio}
            onClick={() => setScelta(null)}
          >
            Indietro
          </Button>
          <Button className="h-11" disabled={invio} onClick={conferma}>
            {invio && <Loader2 className="animate-spin" />} Abbina
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle>Abbina a una scheda</DialogTitle>
        <DialogDescription>
          Scegli la scheda del cliente che usa il numero{" "}
          <span className="font-mono">{chat.phone}</span>.
        </DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca per nome o numero…"
          aria-label="Cerca nelle schede"
          className="h-11 pl-9 text-base md:text-sm"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
        {trovate.slice(0, MAX_SCHEDE).map((l) => (
          <li key={l.id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setScelta(l)}
              className="flex min-h-12 w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="w-full truncate text-sm font-medium">{nomeScheda(l)}</span>
              {l.data.telefono && (
                <span className="font-mono text-xs text-muted-foreground">{l.data.telefono}</span>
              )}
            </button>
          </li>
        ))}
        {trovate.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nessuna scheda trovata
          </li>
        )}
        {trovate.length > MAX_SCHEDE && (
          <li className="px-3 py-2 text-center text-xs text-muted-foreground">
            Altre {trovate.length - MAX_SCHEDE} schede: scrivi per restringere
          </li>
        )}
      </ul>
    </>
  );
}
