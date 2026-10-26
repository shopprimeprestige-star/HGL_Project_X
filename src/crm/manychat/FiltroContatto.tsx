/** ── IL FILTRO «STATO DEL CONTATTO» (le liste) ──────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 6. Un menu solo per
 *  «Lead importati» e «Oggi» (in «Trattative» il filtro sta dentro il pannello
 *  dei filtri, con le sue voci). Il valore è quello di `filtraPerContatto`:
 *  «tutti», «nessuno» (scheda senza secondo stato) o uno dei sette stati. La
 *  lista che lo usa filtra con `filtraPerContatto`, la stessa funzione delle
 *  altre due: un elenco solo di regole.
 *  ⚠️ Colore e parola: il menu scrive sempre il nome dello stato.
 *  ───────────────────────────────────────────────────────────────────────── */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ETICHETTE_CONTATTO, STATI_CONTATTO } from "./contatto";

export function FiltroContatto({
  valore,
  onCambia,
  conteggi,
  className,
}: {
  valore: string;
  onCambia: (v: string) => void;
  /** quanti per stato (e «nessuno»): il numero dice quanti si trovano scegliendo la voce */
  conteggi?: Record<string, number>;
  className?: string;
}) {
  const voce = (v: string, testo: string) => (
    <SelectItem key={v} value={v}>
      {testo}
      {conteggi ? ` · ${conteggi[v] ?? 0}` : ""}
    </SelectItem>
  );
  return (
    <Select value={valore} onValueChange={onCambia}>
      <SelectTrigger
        aria-label="Filtra per stato del contatto WhatsApp"
        className={cn("h-8 w-auto min-w-[10.5rem] gap-2 text-[12px]", className)}
      >
        <span className="text-muted-foreground">Contatto:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="tutti">Tutti</SelectItem>
        {STATI_CONTATTO.map((s) => voce(s, ETICHETTE_CONTATTO[s]))}
        {voce("nessuno", "Non segnato")}
      </SelectContent>
    </Select>
  );
}
