/** ── GLI ORARI DA PROPORRE, DENTRO LA CHAT ──────────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026): in chat, senza cambiare pagina, si
 *  toccano un giorno e le sue ore libere e il messaggio si compone da solo,
 *  pronto da mettere nel campo di scrittura o da copiare.
 *  Le regole (il testo, «oggi»/«domani») stanno in crm/wa-orari; i posti sono
 *  quelli di Slot liberi (`useGiorniLiberi`).
 *  ⚠️ SUL TELEFONO SCORRE DI LATO, NON VA A CAPO: giorni e ore sono una riga
 *   sola ciascuno, con tasti da almeno 32 px.
 *  ⚠️ GLI HOOK IN CIMA, il ritorno anticipato (squadra vuota) dopo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { Copy, CornerDownLeft, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGiorniLiberi } from "@/crm/useGiorniLiberi";
import { giornoPerMessaggio, messaggioOrari, type OrarioScelto } from "@/crm/wa-orari";

const GIORNO_CORTO = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

const CHIP =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OrariRapidi(p: {
  /** il nome del cliente, per il saluto (solo la prima parola) */
  nome?: string | null;
  /** mette il testo nel campo di scrittura della chat */
  onInserisci: (testo: string) => void;
  onChiudi: () => void;
}) {
  const { squadra, giorni } = useGiorniLiberi({ quanti: 14 });
  const oggi = giorni[0]?.data ?? "";
  const conPosto = useMemo(() => giorni.filter((g) => g.fasce.length > 0).slice(0, 8), [giorni]);
  const [giorno, setGiorno] = useState<string | null>(null);
  const [scelte, setScelte] = useState<OrarioScelto[]>([]);
  const aperto = conPosto.find((g) => g.data === (giorno ?? conPosto[0]?.data)) ?? null;
  const testo = useMemo(() => messaggioOrari(scelte, oggi, p.nome), [scelte, oggi, p.nome]);

  const scelto = (data: string, ora: string) =>
    scelte.some((s) => s.data === data && s.ora === ora);
  const cambia = (data: string, ora: string) =>
    setScelte((s) =>
      scelto(data, ora)
        ? s.filter((x) => !(x.data === data && x.ora === ora))
        : [...s, { data, ora }],
    );
  const quanteNelGiorno = (data: string) => scelte.filter((s) => s.data === data).length;
  //  Sul tasto il giorno corto («Ven 30»): il messaggio lo scrive per intero.
  const etichetta = (data: string) => {
    const g = giornoPerMessaggio(data, oggi);
    if (g === "oggi" || g === "domani") return g.charAt(0).toUpperCase() + g.slice(1);
    const d = new Date(`${data}T12:00:00Z`);
    return `${GIORNO_CORTO[d.getUTCDay()]} ${d.getUTCDate()}`;
  };

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(testo);
      toast.success("Messaggio copiato");
    } catch {
      toast.error("Copia non riuscita", { description: "Usa «Metti nel messaggio»." });
    }
  };

  if (squadra.length === 0) return null;
  return (
    <div className="border-t border-border bg-card px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-foreground">
          Proponi orari{" "}
          <span className="font-normal text-muted-foreground">· tocca un giorno, poi le ore</span>
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={p.onChiudi}
          aria-label="Chiudi gli orari"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {conPosto.length === 0 ? (
        <p className="py-2 text-[12px] text-muted-foreground">
          Nessun posto libero nelle prossime due settimane.
        </p>
      ) : (
        <>
          {/*  I giorni: il numero è quante ore libere ha, il segno ✓ quante ne
              hai già scelte lì. */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1.5" role="tablist">
            {conPosto.map((g) => {
              const attivo = g.data === aperto?.data;
              const n = quanteNelGiorno(g.data);
              return (
                <button
                  key={g.data}
                  type="button"
                  role="tab"
                  aria-selected={attivo}
                  onClick={() => setGiorno(g.data)}
                  className={cn(
                    CHIP,
                    attivo
                      ? "border-2 border-emerald-600 bg-background font-semibold text-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {etichetta(g.data)}
                  <span
                    className={cn(
                      "text-[11px]",
                      n > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground",
                    )}
                  >
                    {n > 0 ? `✓${n}` : g.fasce.length}
                  </span>
                </button>
              );
            })}
          </div>
          {aperto && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1.5">
              {aperto.fasce.map((f) => {
                const si = scelto(aperto.data, f.ora);
                return (
                  <button
                    key={f.ora}
                    type="button"
                    aria-pressed={si}
                    onClick={() => cambia(aperto.data, f.ora)}
                    className={cn(
                      CHIP,
                      "tabular-nums",
                      si
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-border bg-background text-foreground hover:bg-muted",
                    )}
                  >
                    {f.ora}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {testo && (
        <div className="mt-1.5 rounded-md border border-border bg-muted/40 p-2">
          <p className="max-h-44 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
            {testo}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => p.onInserisci(testo)}
            >
              <CornerDownLeft className="mr-1.5 h-3.5 w-3.5" /> Metti nel messaggio
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => void copia()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copia
            </Button>
            <button
              type="button"
              className="ml-auto text-[11.5px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setScelte([])}
            >
              Azzera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
