/** ── LA TESTATA DELLA SCHEDA (scheda/TestataScheda.tsx) ───────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E7 (SPEC §3.2). In alto: «← Prodotti», i tasti, il menu «…»; sotto, il titolo con il badge di stato e la riga
 *  «Salvato alle 14:32» (o «Ultima modifica di …»). I tasti di contorno (Anteprima, Salva) e il tasto pieno («Pubblica») li costruisce il guscio e
 *  li passa come `prima` e `principale`: le loro regole (spento finché mancano cose, salva prima di pubblicare) restano scritte là, con le loro prove.
 *  Il menu «…» chiama le funzioni che gli dà il guscio. Se la pagina non può scrivere negli appunti, `link` mostra il link da copiare a mano.
 *  ⚠️ Solo presentazione: nessuna rete, nessuna scrittura. */
import type { ReactNode } from "react";
import { ArrowLeft, Copy, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BadgeStato, CLASSI_CAMPO, CLASSI_TASTO } from "./polaris";

export interface AzioniMenu {
  copiaLink: () => void;
  duplica: () => void;
  archivia: () => void;
  rimettiInBozza: () => void;
  rendiMio: () => void;
}

const VOCE = "min-h-11 md:min-h-8";

/** Chi ha fatto l'ultima modifica, dallo storico che la scheda porta (il più recente sta per primo). */
function ultimoAutore(storico: readonly unknown[]): string | null {
  for (const r of storico) {
    const chi = (r as { chi?: unknown } | null)?.chi;
    if (typeof chi === "string" && chi.trim()) return chi.trim();
  }
  return null;
}

export function TestataScheda({
  titolo,
  stato,
  salvataggio,
  conflitto,
  storico,
  link,
  indietro,
  prima,
  principale,
  spento,
  vecchio,
  azioni,
}: {
  titolo: string;
  stato: "bozza" | "pubblicato" | "archiviato";
  /** Il testo del salvataggio automatico («Salvo…», «Salvato alle 14:32»); vuoto = ancora niente da dire, e si legge l'ultimo autore dallo storico. */
  salvataggio: string;
  conflitto: boolean;
  storico: readonly unknown[];
  link: string | null;
  indietro: () => void;
  /** I tasti di contorno a sinistra del menu. */
  prima: ReactNode;
  /** Il tasto pieno, dopo il menu (dal telefono sta nella barra, qui il guscio lo nasconde). */
  principale: ReactNode;
  spento: boolean;
  /** Dal vecchio catalogo: nel menu c'è anche «Rendi mio». */
  vecchio: boolean;
  azioni: AzioniMenu;
}) {
  const archiviato = stato === "archiviato";
  const autore = ultimoAutore(storico);
  const riga = conflitto
    ? "Non salvato: qualcun altro ha modificato il prodotto."
    : salvataggio || (autore ? `Ultima modifica di ${autore}` : "Si salva da solo.");
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          className={cn(CLASSI_TASTO, "-ml-3 px-3")}
          onClick={indietro}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Prodotti
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {prima}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 p-0 md:h-9 md:w-9"
                aria-label="Altre azioni"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="crm-theme bg-white text-foreground">
              <DropdownMenuItem
                className={VOCE}
                disabled={spento}
                onSelect={() => azioni.copiaLink()}
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copia il link per il telefono
              </DropdownMenuItem>
              <DropdownMenuItem
                className={VOCE}
                disabled={spento}
                onSelect={() => azioni.duplica()}
              >
                Duplica
              </DropdownMenuItem>
              <DropdownMenuItem
                className={VOCE}
                disabled={spento}
                onSelect={() => (archiviato ? azioni.rimettiInBozza() : azioni.archivia())}
              >
                {archiviato ? "Rimetti in bozza" : "Archivia"}
              </DropdownMenuItem>
              {vecchio && (
                <DropdownMenuItem
                  className={VOCE}
                  disabled={spento}
                  onSelect={() => azioni.rendiMio()}
                >
                  Rendi mio
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {principale}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-[20px] font-semibold leading-tight">{titolo}</h1>
          <BadgeStato stato={stato} />
        </div>
        <p className="text-[13px] text-muted-foreground" role="status" aria-live="polite">
          {riga}
        </p>
      </div>
      {link && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-[13px]">
          <label htmlFor="link-anteprima" className="font-medium">
            Copia questo link a mano (vale 24 ore)
          </label>
          <input
            id="link-anteprima"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className={CLASSI_CAMPO}
          />
        </div>
      )}
    </header>
  );
}
