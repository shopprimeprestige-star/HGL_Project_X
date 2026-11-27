/** ── LE DUE FINESTRE DELLA SCHEDA (scheda/FinestreScheda.tsx) ─────────────────
 *  Commessa 2026-11-25-editor-prodotti, E7. «Anteprima della bozza» (un riquadro a 390 px o a 1440 px, dentro la finestra) e «Archiviare …?».
 *  Sono le finestre di prima, spostate qui dal guscio senza cambiarle: il tasto pieno di una finestra è l'unico della sua schermata.
 *  ⚠️ Solo presentazione: nessuna rete, nessuna scrittura. Il link dell'anteprima lo prepara il guscio. */
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLASSI_TASTO } from "./polaris";

export type VistaAnteprima = "telefono" | "computer";

export function FinestraAnteprima({
  anteprima,
  cambiaVista,
  chiudi,
}: {
  anteprima: { url: string; vista: VistaAnteprima } | null;
  cambiaVista: (v: VistaAnteprima) => void;
  chiudi: () => void;
}) {
  return (
    <Dialog open={anteprima !== null} onOpenChange={(v) => !v && chiudi()}>
      <DialogContent className="crm-theme max-h-[92vh] max-w-[96vw] overflow-auto bg-white text-foreground md:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Anteprima della bozza</DialogTitle>
          <DialogDescription>
            Mostra ciò che hai salvato, come lo vedrebbe un cliente. Non è ancora sul sito.
          </DialogDescription>
        </DialogHeader>
        {anteprima && (
          <AnteprimaVista url={anteprima.url} vista={anteprima.vista} cambia={cambiaVista} />
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={chiudi}>
            <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinestraArchivia({
  aperta,
  nome,
  occupato,
  chiudi,
  conferma,
}: {
  aperta: boolean;
  nome: string;
  occupato: boolean;
  chiudi: () => void;
  conferma: () => void;
}) {
  return (
    <Dialog open={aperta} onOpenChange={(v) => !v && !occupato && chiudi()}>
      <DialogContent className="crm-theme bg-white text-foreground">
        <DialogHeader>
          <DialogTitle>Archiviare «{nome}»?</DialogTitle>
          <DialogDescription>
            Sparisce dal sito e dall'elenco normale. Non si cancella niente: lo ritrovi nel Cestino e
            lo puoi rimettere in bozza.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className={CLASSI_TASTO}
            disabled={occupato}
            onClick={chiudi}
          >
            Annulla
          </Button>
          <Button type="button" className={CLASSI_TASTO} disabled={occupato} onClick={conferma}>
            Archivia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** L'anteprima: un riquadro a 390 px (telefono) o a 1440 px rimpicciolito per entrare nella finestra (computer). */
function AnteprimaVista({
  url,
  vista,
  cambia,
}: {
  url: string;
  vista: VistaAnteprima;
  cambia: (v: VistaAnteprima) => void;
}) {
  const larghezza = vista === "telefono" ? 390 : 1440;
  const altezza = vista === "telefono" ? 720 : 900;
  const disponibile = Math.min(typeof window === "undefined" ? 1000 : window.innerWidth, 920) - 64;
  const scala = Math.min(1, disponibile / larghezza);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Come guardarla">
        {(
          [
            ["telefono", "Telefono (390 px)"],
            ["computer", "Computer (1440 px)"],
          ] as const
        ).map(([v, nome]) => (
          <Button
            key={v}
            type="button"
            variant={vista === v ? "default" : "outline"}
            aria-pressed={vista === v}
            className={CLASSI_TASTO}
            onClick={() => cambia(v)}
          >
            {nome}
          </Button>
        ))}
      </div>
      <div
        className="mx-auto overflow-hidden rounded-lg border border-border"
        style={{ width: larghezza * scala, height: altezza * scala }}
      >
        <iframe
          key={vista}
          title={`Anteprima della bozza, vista ${vista}`}
          src={url}
          referrerPolicy="no-referrer"
          style={{
            width: larghezza,
            height: altezza,
            transform: `scale(${scala})`,
            transformOrigin: "0 0",
            border: 0,
          }}
        />
      </div>
    </div>
  );
}
