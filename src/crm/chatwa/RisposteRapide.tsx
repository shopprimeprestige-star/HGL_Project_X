/** ── LE RISPOSTE RAPIDE NELLA CASELLA ──────────────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026). Tre pezzi, disegnati qui e montati da
 *  `Casella`; le regole (filtro, ordine, segnaposto) stanno in ./risposte-rapide.
 *   - `MenuRisposte`: l'elenco che si apre scrivendo «/», sopra la casella;
 *   - `FilaSuggerimenti`: una riga sola, scorrevole di lato, con le risposte
 *     più pertinenti. ⚠️ UNA RIGA: sul telefono con la tastiera aperta ogni
 *     riga in più è un messaggio in meno in vista;
 *   - `FinestraRisposte`: la matita. Aggiungi, modifica, elimina, ripristina.
 *  ⚠️ NESSUNO DI QUESTI INVIA: scegliere una risposta la mette nella casella.
 *  ⚠️ I tocchi su menu e fila non tolgono il fuoco alla casella
 *   (`onMouseDown` + `preventDefault`): sul telefono la tastiera resta su.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RispostaNumerata, RispostaRapida } from "./risposte-rapide";

const tieniIlFuoco = (e: { preventDefault(): void }) => e.preventDefault();

/** Una riga sola dell'anteprima del testo (gli a capo diventano spazi). */
const anteprima = (t: string) => t.replace(/\s+/g, " ").trim();

export const ID_MENU_RISPOSTE = "risposte-rapide-menu";
export const idVoce = (i: number) => `${ID_MENU_RISPOSTE}-${i}`;

/** L'elenco del «/»: numero, titolo, anteprima; la matita a destra. */
export function MenuRisposte(p: {
  voci: RispostaNumerata[];
  ricerca: string;
  evidenziata: number;
  onEvidenzia: (i: number) => void;
  onScegli: (r: RispostaRapida) => void;
  onModifica: (r: RispostaRapida | null) => void;
  /** il testo come arriverà, con {nome} e {consulente} di questa chat */
  riempi: (testo: string) => string;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
        <span className="text-[12px] font-semibold text-foreground">
          Risposte rapide
          <span className="hidden font-normal text-muted-foreground md:inline">
            {" "}
            · ↑ ↓ per scegliere, Invio per inserire, Esc per chiudere
          </span>
        </span>
        <button
          type="button"
          onMouseDown={tieniIlFuoco}
          onClick={() => p.onModifica(null)}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Modifica
        </button>
      </div>
      {p.voci.length === 0 ? (
        <p className="px-3 pb-3 text-[12.5px] text-muted-foreground">
          Nessuna risposta per «/{p.ricerca}». Scrivi un numero o una parola del titolo.
        </p>
      ) : (
        <ul
          id={ID_MENU_RISPOSTE}
          role="listbox"
          aria-label="Risposte rapide"
          className="max-h-40 overflow-y-auto overscroll-contain pb-1 md:max-h-64"
        >
          {p.voci.map(({ risposta: r, numero }, i) => {
            const attiva = i === p.evidenziata;
            return (
              <li
                key={r.id}
                id={idVoce(i)}
                role="option"
                aria-selected={attiva}
                ref={attiva ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                className={cn("flex items-stretch", attiva && "bg-emerald-50")}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={tieniIlFuoco}
                  onMouseEnter={() => p.onEvidenzia(i)}
                  onClick={() => p.onScegli(r)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left"
                >
                  <span
                    className={cn(
                      "grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 text-[11.5px] font-semibold tabular-nums",
                      attiva ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {numero}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {r.titolo}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {anteprima(p.riempi(r.testo))}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={tieniIlFuoco}
                  onClick={() => p.onModifica(r)}
                  aria-label={`Modifica «${r.titolo}»`}
                  title="Modifica"
                  className="grid w-11 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const CHIP =
  "inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-background px-3 text-[12.5px] font-medium text-foreground transition-colors hover:border-emerald-600/50 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** La fila dei suggerimenti: la matita, poi le risposte più pertinenti. */
export function FilaSuggerimenti(p: {
  risposte: RispostaRapida[];
  /** il testo come arriverà (anteprima al passaggio del mouse), con i dati di questa chat */
  riempi: (testo: string) => string;
  onScegli: (r: RispostaRapida) => void;
  onGestisci: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Risposte rapide suggerite"
      className="flex items-center gap-1.5 overflow-x-auto px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        onMouseDown={tieniIlFuoco}
        onClick={p.onGestisci}
        aria-label="Modifica le risposte rapide"
        title="Modifica le risposte rapide (o scrivi / nella casella)"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      {p.risposte.map((r) => (
        <button
          key={r.id}
          type="button"
          onMouseDown={tieniIlFuoco}
          onClick={() => p.onScegli(r)}
          title={p.riempi(r.testo)}
          className={CHIP}
        >
          {r.titolo}
        </button>
      ))}
    </div>
  );
}

type Modifica = { id: string | null; titolo: string; testo: string };

/** La matita: l'elenco delle risposte e il modulo per una sola. */
export function FinestraRisposte(p: {
  aperta: boolean;
  /** se c'è, la finestra si apre già sulla modifica di questa */
  daModificare: RispostaRapida | null;
  risposte: RispostaRapida[];
  onChiudi: () => void;
  onSalva: (r: { id: string | null; titolo: string; testo: string }) => void;
  onElimina: (id: string) => void;
  onRipristina: () => void;
}) {
  return (
    <Dialog open={p.aperta} onOpenChange={(v) => !v && p.onChiudi()}>
      <DialogContent className="crm-theme bg-white text-foreground flex max-h-[85dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-3 p-4 md:p-6">
        {p.aperta && <CorpoFinestra key={p.daModificare?.id ?? "elenco"} {...p} />}
      </DialogContent>
    </Dialog>
  );
}

function CorpoFinestra(p: Parameters<typeof FinestraRisposte>[0]) {
  const [modifica, setModifica] = useState<Modifica | null>(
    p.daModificare ? { ...p.daModificare } : null,
  );

  if (modifica) {
    const pronta = modifica.titolo.trim() !== "" && modifica.testo.trim() !== "";
    const salva = () => {
      if (!pronta) return;
      p.onSalva({ id: modifica.id, titolo: modifica.titolo.trim(), testo: modifica.testo.trim() });
      //  Aperta dalla matita di una risposta: finito qui. Dall'elenco: si torna all'elenco.
      if (p.daModificare) p.onChiudi();
      else setModifica(null);
    };
    return (
      <>
        <DialogHeader className="text-left">
          <DialogTitle>
            {modifica.id ? "Modifica risposta rapida" : "Nuova risposta rapida"}
          </DialogTitle>
          <DialogDescription>
            Vale per tutto lo studio. {"{nome}"}, {"{consulente}"}, {"{acconto}"}, {"{iban}"},{" "}
            {"{intestatario}"} e {"{causale}"} si riempiono da soli; un segnaposto come{" "}
            {"{indirizzo}"} la casella te lo segnala prima dell'invio.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-foreground">
            Titolo
            <Input
              value={modifica.titolo}
              maxLength={60}
              onChange={(e) => setModifica({ ...modifica, titolo: e.target.value })}
              placeholder="Es. Info prezzi"
              className="text-base md:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-foreground">
            Testo
            <Textarea
              value={modifica.testo}
              maxLength={2000}
              rows={6}
              onChange={(e) => setModifica({ ...modifica, testo: e.target.value })}
              placeholder="Il messaggio che finisce nella casella"
              className="font-normal"
            />
          </label>
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => (p.daModificare ? p.onChiudi() : setModifica(null))}
          >
            Annulla
          </Button>
          <Button
            onClick={salva}
            disabled={!pronta}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Salva
          </Button>
        </DialogFooter>
      </>
    );
  }

  const elimina = (r: RispostaRapida) => {
    if (confirm(`Eliminare la risposta rapida «${r.titolo}»? Vale per tutto lo studio.`))
      p.onElimina(r.id);
  };
  const ripristina = () => {
    if (
      confirm(
        "Rimettere le risposte rapide di partenza? Quelle aggiunte o modificate dallo studio si perdono.",
      )
    )
      p.onRipristina();
  };

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle>Risposte rapide</DialogTitle>
        <DialogDescription>
          Scrivi «/» nella casella per sceglierle, «/2» o «/prezzo» per trovarle. Inserirle non
          invia: il testo resta da controllare.
        </DialogDescription>
      </DialogHeader>
      {p.risposte.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
          Nessuna risposta rapida. Aggiungine una o rimetti quelle di partenza.
        </p>
      ) : (
        <ol className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {p.risposte.map((r, i) => (
            <li key={r.id} className="flex items-center gap-1 rounded-md px-1 hover:bg-muted/60">
              <span className="w-6 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 px-1.5 py-1.5">
                <p className="truncate text-[13px] font-medium text-foreground">{r.titolo}</p>
                <p className="line-clamp-2 text-[12px] text-muted-foreground">
                  {anteprima(r.testo)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 shrink-0 md:h-8 md:w-8"
                onClick={() => setModifica({ ...r })}
                aria-label={`Modifica «${r.titolo}»`}
                title="Modifica"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 shrink-0 text-muted-foreground hover:text-rose-600 md:h-8 md:w-8"
                onClick={() => elimina(r)}
                aria-label={`Elimina «${r.titolo}»`}
                title="Elimina"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <DialogFooter className="flex-row flex-wrap items-center gap-2 sm:justify-between">
        <Button variant="ghost" onClick={ripristina} className="text-muted-foreground">
          <RotateCcw className="h-4 w-4" /> Ripristina predefinite
        </Button>
        <Button
          onClick={() => setModifica({ id: null, titolo: "", testo: "" })}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Aggiungi
        </Button>
      </DialogFooter>
    </>
  );
}
