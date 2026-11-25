/** ── LE OPZIONI DELLE VARIANTI (scheda/OpzioniVarianti.tsx) ──────────────────────────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E8 (SPEC §3.3 riquadro 6). Per ogni opzione (Colore, Misura…) il nome e i suoi valori come
 *  etichette: si scrive il valore e si preme Invio (la virgola ne mette più d'uno insieme). Sotto, quante combinazioni nascono e il tasto che le crea.
 *  Solo presentazione: lo stato e le scritture sono di `EditorVarianti`. Un valore che ha già delle varianti non si toglie da qui (le varianti non si
 *  cancellano, si disattivano dalla tabella). I limiti (3 opzioni, 50 combinazioni) sono scritti, e il tasto resta spento con la frase del perché. */
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITI_VARIANTI } from "../scheda-pura";
import { CLASSI_CAMPO, CLASSI_TASTO } from "./polaris";
import { valoriCompleti, type OpzioneScritta } from "./varianti-puro";

const NOMI_OPZIONE = ["Colore", "Misura", "Lunghezza", "Base"] as const;

export type AnteprimaOpzioni =
  | { ok: true; totale: number; nuove: number; esistenti: number }
  | { ok: false; frase: string };

export function OpzioniVarianti({
  opzioni,
  cambia,
  togli,
  aggiungi,
  usato,
  anteprima,
  occupato,
  genera,
}: {
  opzioni: OpzioneScritta[];
  cambia: (k: number, p: Partial<OpzioneScritta>) => void;
  togli: (k: number) => void;
  aggiungi: () => void;
  /** Questo valore (o, con `valore` assente, questa opzione) ha già delle varianti? */
  usato: (nome: string, valore?: string) => boolean;
  anteprima: AnteprimaOpzioni;
  occupato: boolean;
  genera: () => void;
}) {
  const alMassimo = opzioni.length >= LIMITI_VARIANTI.opzioni;
  const aggiungiValori = (k: number) => {
    const o = opzioni[k];
    cambia(k, { valori: valoriCompleti(o), bozza: "" });
  };
  const conta = anteprima.ok
    ? `${anteprima.totale} combinazioni: ${anteprima.esistenti} ci sono già, ${anteprima.nuove} ${anteprima.nuove === 1 ? "nuova" : "nuove"}.`
    : anteprima.frase;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="sr-only">Opzioni</legend>
      <datalist id="nomi-opzione">
        {NOMI_OPZIONE.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {opzioni.map((o, k) => (
        <div key={k} className={cn("flex flex-col gap-2", k > 0 && "border-t border-border pt-4")}>
          <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor={`opz-nome-${k}`} className="text-[13px] font-medium">
                {`Opzione ${k + 1}`}
              </label>
              <input
                id={`opz-nome-${k}`}
                list="nomi-opzione"
                value={o.nome}
                maxLength={40}
                onChange={(e) => cambia(k, { nome: e.target.value })}
                placeholder="Colore, Misura…"
                className={CLASSI_CAMPO}
              />
            </div>
            <button
              type="button"
              aria-label={`Togli l'opzione ${o.nome || k + 1}`}
              title={
                usato(o.nome) ? "Ha già delle varianti: si disattivano dalla tabella" : undefined
              }
              disabled={opzioni.length === 1 || usato(o.nome)}
              onClick={() => togli(k)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-muted-foreground/70 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 md:h-9 md:w-9"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`opz-valori-${k}`} className="text-[13px] font-medium">
              {`Valori di ${o.nome.trim() || `opzione ${k + 1}`}`}
            </label>
            <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-muted-foreground/70 bg-card px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring md:min-h-9">
              {o.valori.map((val) => (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pl-2 pr-0.5 text-[13px]"
                >
                  {val}
                  <button
                    type="button"
                    aria-label={`Togli il valore ${val}`}
                    title={
                      usato(o.nome, val)
                        ? "Ha già delle varianti: si disattivano dalla tabella"
                        : undefined
                    }
                    disabled={usato(o.nome, val)}
                    onClick={() => cambia(k, { valori: o.valori.filter((x) => x !== val) })}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              <input
                id={`opz-valori-${k}`}
                value={o.bozza}
                onChange={(e) => cambia(k, { bozza: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault(); // Invio aggiunge il valore, non invia la scheda
                  aggiungiValori(k);
                }}
                aria-describedby={`opz-aiuto-${k}`}
                placeholder={o.valori.length ? "" : "Nero, Biondo, Castano"}
                className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 text-[16px] focus-visible:outline-none md:text-[13px]"
              />
            </div>
            <p id={`opz-aiuto-${k}`} className="text-[13px] text-muted-foreground">
              Scrivi un valore e premi Invio.
            </p>
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={CLASSI_TASTO}
            disabled={alMassimo}
            aria-describedby="opz-limiti"
            onClick={aggiungi}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Aggiungi un'opzione
          </Button>
          <Button
            type="button"
            variant="outline"
            className={CLASSI_TASTO}
            disabled={occupato || !anteprima.ok || anteprima.nuove === 0}
            aria-describedby="opz-conta"
            onClick={genera}
          >
            {anteprima.ok && anteprima.nuove > 0
              ? `Crea ${anteprima.nuove} ${anteprima.nuove === 1 ? "variante" : "varianti"}`
              : "Crea le varianti"}
          </Button>
        </div>
        <p id="opz-limiti" className="text-[13px] text-muted-foreground">
          {alMassimo ? `Hai già ${LIMITI_VARIANTI.opzioni} opzioni: è il massimo. ` : ""}
          Al massimo {LIMITI_VARIANTI.opzioni} opzioni e {LIMITI_VARIANTI.combinazioni}{" "}
          combinazioni.
        </p>
        <p
          id="opz-conta"
          aria-live="polite"
          className={cn(
            "text-[13px]",
            anteprima.ok ? "text-muted-foreground" : "font-medium text-amber-900",
          )}
        >
          {conta}
        </p>
      </div>
    </fieldset>
  );
}
