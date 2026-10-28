/** ── IL CALENDARIO DEGLI ORARI, DENTRO LA CHAT ──────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026, seconda): «clicco, si apre un popup che
 *  mi mostra il calendario di ogni consulente con tutte le vere disponibilità
 *  che posso cliccare; posso cliccare anche più disponibilità insieme e quando
 *  ho finito clicco un pulsante per confermare e crea il messaggio».
 *  Una finestra: sul telefono tutto schermo (sale dal basso), sul computer
 *  larga, con la settimana in sette colonne. In alto «Tutti» e ogni consulente
 *  che fa consulenze; si parte da quello del lead.
 *  Le regole (scelta, gruppi per giorno, testo, ritaglio per consulente) stanno
 *  in crm/wa-orari, provate; i posti sono quelli di Slot liberi
 *  (`useGiorniLiberi`): niente ore passate, niente ore prese o tenute.
 *  ⚠️ UN CALCOLO SOLO PER TUTTA LA SQUADRA. Il calendario di un consulente si
 *   ritaglia da quello di tutti (`giornoDi`): così le scelte fatte su
 *   consulenti diversi si ricontrollano sugli stessi giorni prima di scrivere.
 *  ⚠️ IL MESSAGGIO NON DICE NOMI: il consulente serve a chi sceglie.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata (prova degli hook).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGiorniLiberi } from "@/crm/useGiorniLiberi";
import { giornoParlato } from "@/crm/promemoria/formati";
import {
  cambiaScelta,
  consulenteDiPartenza,
  eScelto,
  giornoDi,
  messaggioOrari,
  scelteAncoraLibere,
  scelteDelGiorno,
  type OrarioScelto,
} from "@/crm/wa-orari";

/** Due settimane, come la pagina Slot liberi apre di solito. */
const SETTIMANE = 2;
const GIORNO_CORTO = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESE_CORTO = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

const piu = (data: string, n: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const giornoMese = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  return `${d.getUTCDate()} ${MESE_CORTO[d.getUTCMonth()]}`;
};
/** «Oggi», «Domani», «Ven 30». */
const corto = (data: string, oggi: string) => {
  if (data === oggi) return "Oggi";
  if (data === piu(oggi, 1)) return "Domani";
  const d = new Date(`${data}T12:00:00Z`);
  return `${GIORNO_CORTO[d.getUTCDay()]} ${d.getUTCDate()}`;
};

const PILLOLA =
  "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OrariRapidi(p: {
  /** il nome del cliente, per il saluto (solo la prima parola) */
  nome?: string | null;
  /** il consulente del lead: il calendario parte da lui */
  consulenteId?: string | null;
  /** mette il testo nel campo di scrittura della chat (non invia) */
  onInserisci: (testo: string) => void;
  onChiudi: () => void;
}) {
  const { squadra, giorni } = useGiorniLiberi({ quanti: SETTIMANE * 7 });
  const oggi = giorni[0]?.data ?? "";
  //  null = non ancora toccato: vale il consulente del lead (la squadra può arrivare dopo).
  const [scelta, setChi] = useState<string | null>(null);
  const chi =
    scelta ??
    consulenteDiPartenza(
      squadra.map((c) => c.id),
      p.consulenteId,
    );
  const [settimana, setSettimana] = useState(0);
  const [scelte, setScelte] = useState<OrarioScelto[]>([]);

  const visti = useMemo(
    () => giorni.slice(settimana * 7, settimana * 7 + 7).map((g) => giornoDi(g, chi)),
    [giorni, settimana, chi],
  );
  const riepilogo = useMemo(
    () => scelteDelGiorno(scelte).flatMap((g) => g.ore.map((ora) => ({ data: g.data, ora }))),
    [scelte],
  );
  const nessunPosto = visti.length > 0 && visti.every((g) => g.fasce.length === 0);

  const conferma = () => {
    //  La finestra può restare aperta a lungo: un'ora passata o un posto preso nel frattempo esce.
    const valide = scelteAncoraLibere(scelte, giorni, oggi);
    if (valide.length < scelte.length) {
      setScelte(valide);
      const n = scelte.length - valide.length;
      toast.warning(n === 1 ? "Un orario non è più libero" : `${n} orari non sono più liberi`, {
        description: "L'ho tolto dalla scelta: ricontrolla e conferma.",
      });
      return;
    }
    const testo = messaggioOrari(valide, oggi, p.nome);
    if (testo) p.onInserisci(testo);
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(v) => !v && p.onChiudi()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            //  Telefono: tutto schermo, sale dal basso.
            "fixed inset-0 z-50 flex flex-col bg-background shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300",
            //  Computer: al centro, largo, alto quanto serve (margini automatici, niente translate
            //  che litighi con l'animazione).
            "md:m-auto md:h-fit md:max-h-[88dvh] md:w-[min(68rem,calc(100vw-3rem))] md:rounded-xl md:border",
            "md:data-[state=open]:slide-in-from-bottom-4 md:data-[state=open]:fade-in-0",
          )}
        >
          <div className="flex items-start gap-3 border-b border-border px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)] md:px-6 md:pt-5">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[17px] font-semibold text-foreground">
                Proponi orari
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-[13px] text-muted-foreground">
                Tocca gli orari liberi da proporre, anche di giorni e consulenti diversi.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0 -mr-2"
                aria-label="Chiudi"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 md:px-6 md:py-4">
            {squadra.length === 0 ? (
              <p className="py-10 text-center text-[14px] text-muted-foreground">
                Nessun consulente con gli orari di lavoro impostati: aggiungili in Consulenti.
              </p>
            ) : (
              <>
                <div
                  className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:flex-wrap md:px-0"
                  role="group"
                  aria-label="Consulente"
                >
                  {[
                    { id: "tutti", nome: "Tutti" },
                    ...squadra.map((c) => ({ id: c.id, nome: c.data.nome || "Senza nome" })),
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={chi === c.id}
                      onClick={() => setChi(c.id)}
                      className={cn(
                        PILLOLA,
                        chi === c.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>

                <div className="mb-3 flex items-center justify-between gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    disabled={settimana === 0}
                    onClick={() => setSettimana((s) => s - 1)}
                    aria-label="Settimana prima"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span
                    className="text-[13px] font-medium tabular-nums text-foreground"
                    aria-live="polite"
                  >
                    {visti.length > 0 &&
                      `${giornoMese(visti[0].data)} – ${giornoMese(visti[visti.length - 1].data)}`}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    disabled={settimana >= SETTIMANE - 1}
                    onClick={() => setSettimana((s) => s + 1)}
                    aria-label="Settimana dopo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {nessunPosto && (
                  <p className="mb-3 rounded-md bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
                    Nessun posto libero in questa settimana
                    {chi === "tutti" ? "" : " per questo consulente"}.
                  </p>
                )}

                {/*  Telefono: un giorno per riga, le ore vanno a capo. Computer: sette colonne. */}
                <div className="grid gap-2 md:grid-cols-7">
                  {visti.map((g) => {
                    const vuoto = g.fasce.length === 0;
                    return (
                      <section
                        key={g.data}
                        aria-label={giornoParlato(g.data) ?? g.data}
                        className={cn(
                          "flex gap-3 rounded-lg border p-2.5 md:flex-col md:gap-2",
                          vuoto ? "border-transparent bg-muted/50" : "border-border",
                        )}
                      >
                        <div className="w-16 shrink-0 pt-1.5 md:w-auto md:pt-0 md:text-center">
                          <div
                            className={cn(
                              "text-[13px] font-semibold",
                              vuoto ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {corto(g.data, oggi)}
                          </div>
                          <div className="text-[11.5px] text-muted-foreground">
                            {giornoMese(g.data)}
                          </div>
                        </div>
                        {vuoto ? (
                          <p className="self-center text-[12.5px] text-muted-foreground md:text-center">
                            Nessun posto
                          </p>
                        ) : (
                          <div className="flex flex-1 flex-wrap gap-1.5 md:flex-col">
                            {g.fasce.map((f) => {
                              const si = eScelto(scelte, g.data, f.ora);
                              const posti = `${f.posti} ${f.posti === 1 ? "posto" : "posti"}`;
                              return (
                                <button
                                  key={f.ora}
                                  type="button"
                                  aria-pressed={si}
                                  aria-label={`${f.ora}, ${posti}`}
                                  title={posti}
                                  onClick={() =>
                                    setScelte((s) =>
                                      cambiaScelta(s, { data: g.data, ora: f.ora, chi }),
                                    )
                                  }
                                  className={cn(
                                    "inline-flex h-10 min-w-[4.25rem] items-center justify-center gap-1 rounded-md border px-2 text-[14px] font-medium tabular-nums transition-colors md:h-9 md:w-full",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    si
                                      ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                                      : "border-border bg-background text-foreground hover:border-emerald-600/60 hover:bg-emerald-50",
                                  )}
                                >
                                  {si && <Check className="h-3.5 w-3.5" aria-hidden />}
                                  {f.ora}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-border bg-card px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 md:px-6 md:pb-4">
            {riepilogo.length > 0 && (
              <div className="-mx-4 mb-2.5 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
                {riepilogo.map((s) => (
                  <button
                    key={`${s.data} ${s.ora}`}
                    type="button"
                    onClick={() => setScelte((x) => cambiaScelta(x, s))}
                    aria-label={`Togli ${giornoParlato(s.data) ?? s.data} alle ${s.ora}`}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-50 pl-3 pr-2 text-[12.5px] font-medium tabular-nums text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {corto(s.data, oggi)} · {s.ora}
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground" aria-live="polite">
                {riepilogo.length === 0
                  ? "Nessun orario scelto"
                  : riepilogo.length === 1
                    ? "1 orario scelto"
                    : `${riepilogo.length} orari scelti`}
              </span>
              {riepilogo.length > 0 && (
                <button
                  type="button"
                  className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setScelte([])}
                >
                  Azzera
                </button>
              )}
              <Button
                className="ml-auto h-11 bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                disabled={riepilogo.length === 0}
                onClick={conferma}
              >
                Crea messaggio
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
