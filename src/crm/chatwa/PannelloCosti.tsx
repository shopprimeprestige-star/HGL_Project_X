import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { fetchCRM } from "@/crm/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  PERIODI,
  PERIODO_INIZIALE,
  type Costi,
  type PeriodoCosti,
  type RigaTipo,
} from "./calcolo-costi";
import { euro, ETICHETTA_CATEGORIA, TARIFFE } from "./costi-whatsapp";

type Lettura =
  | { fase: "carico" }
  | { fase: "errore"; frase: string }
  | { fase: "ok"; costi: Costi };

const FRASE_RETE = "Non riesco a leggere i costi: controlla la connessione e riprova.";

const messaggi = (n: number) => (n === 1 ? "1 messaggio" : `${n} messaggi`);

/** «29/10»: il giorno di Roma da cui comincia il periodo. */
const giornoBreve = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
  });

/** Il pannello «Costi WhatsApp»: una stima dei messaggi a pagamento già partiti, per periodo.
 *  Foglio dal basso (sul computer una colonna centrata). Legge solo conteggi dal server. */
export function PannelloCosti({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  const [periodo, setPeriodo] = useState<PeriodoCosti>(PERIODO_INIZIALE);
  const [lettura, setLettura] = useState<Lettura>({ fase: "carico" });
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    if (!aperto) return;
    let annullata = false;
    setLettura({ fase: "carico" });
    (async () => {
      try {
        const res = await fetchCRM(`/api/crm/whatsapp-costi?periodo=${periodo}`);
        const corpo = (await res.json().catch(() => null)) as {
          costi?: Costi;
          error?: unknown;
        } | null;
        if (annullata) return;
        if (res.ok && corpo?.costi) setLettura({ fase: "ok", costi: corpo.costi });
        else
          setLettura({
            fase: "errore",
            frase:
              res.status === 403
                ? "Questa pagina è solo per chi gestisce le impostazioni."
                : typeof corpo?.error === "string"
                  ? corpo.error
                  : FRASE_RETE,
          });
      } catch {
        if (!annullata) setLettura({ fase: "errore", frase: FRASE_RETE });
      }
    })();
    return () => {
      annullata = true;
    };
  }, [aperto, periodo, tentativo]);

  return (
    <Sheet open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[90dvh] w-full flex-col gap-0 rounded-t-xl p-0 sm:max-w-lg [&>button]:hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <SheetTitle className="text-[15px]">Costi WhatsApp</SheetTitle>
          <SheetClose asChild>
            <Button type="button" variant="ghost" className="min-h-11 text-[13px]">
              Chiudi
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          Stima di quanto costano i messaggi WhatsApp a pagamento già inviati, nel periodo scelto.
        </SheetDescription>

        <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-3 py-3">
          {/* Periodo: chip da 44 px che vanno a capo, mai a scorrimento. */}
          <div role="group" aria-label="Periodo" className="flex flex-wrap gap-1.5">
            {PERIODI.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  periodo === p.id
                    ? "border-foreground bg-foreground font-medium text-background"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                {p.etichetta}
              </button>
            ))}
          </div>

          {lettura.fase === "carico" && (
            <p
              role="status"
              className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Calcolo i costi…
            </p>
          )}

          {lettura.fase === "errore" && (
            <div role="alert" className="flex flex-col items-start gap-2 py-4">
              <p className="text-[13px] text-foreground">{lettura.frase}</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setTentativo((n) => n + 1)}
              >
                Riprova
              </Button>
            </div>
          )}

          {lettura.fase === "ok" && <Riepilogo costi={lettura.costi} />}

          <div className="space-y-1.5 border-t border-border pt-3 text-[11.5px] leading-snug text-muted-foreground">
            <p>
              Stima calcolata sui messaggi inviati con le tariffe Meta (Italia: Marketing{" "}
              {euro(TARIFFE.marketing, 4)}, Utility {euro(TARIFFE.utility, 4)} a messaggio, dal 1
              ottobre 2026); il conto vero è nel Wallet di ManyChat.
            </p>
            <p>
              L&apos;abbonamento mensile a ManyChat Pro è un costo fisso a parte: non è compreso in
              queste cifre.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Riepilogo({ costi }: { costi: Costi }) {
  const automatici = costi.perTipo.filter((t) => t.gruppo === "automatico");
  const mano = costi.perTipo.filter((t) => t.gruppo === "mano");
  return (
    <>
      <div>
        <p className="text-[12px] text-muted-foreground">
          Totale stimato dal {giornoBreve(costi.dal)}
        </p>
        <p className="text-[28px] font-semibold leading-tight tabular-nums text-foreground">
          ≈ {euro(costi.totale, 2)}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {costi.messaggi === 0
            ? "Nessun messaggio a pagamento in questo periodo."
            : `${messaggi(costi.messaggi)} a pagamento`}
        </p>
      </div>

      {costi.risparmio.messaggi > 0 && (
        <div
          className="rounded-lg border border-border bg-muted/40 px-3 py-2.5"
          data-testid="costi-risparmio"
        >
          <p className="text-[15px] font-semibold leading-snug text-foreground">
            Risparmiati circa <span className="tabular-nums">{euro(costi.risparmio.euro, 2)}</span>
          </p>
          <p className="text-[12.5px] leading-snug text-foreground">
            {messaggi(costi.risparmio.messaggi)}{" "}
            {costi.risparmio.messaggi === 1 ? "partito" : "partiti"} come testo invece che come
            modello.
          </p>
          <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
            È una stima: il prezzo dei modelli che sarebbero partiti. Un testo dentro le 24 ore, per
            Meta, non si paga.
          </p>
        </div>
      )}

      <section aria-labelledby="costi-categorie">
        <h3 id="costi-categorie" className="mb-1 text-[12px] font-medium text-muted-foreground">
          Per categoria
        </h3>
        <ul className="divide-y divide-border">
          {costi.categorie.map((x) => (
            <Riga
              key={x.categoria}
              nome={ETICHETTA_CATEGORIA[x.categoria]}
              dettaglio={`${messaggi(x.messaggi)} × ${euro(TARIFFE[x.categoria], 4)}`}
              costo={x.costo}
            />
          ))}
        </ul>
      </section>

      <Gruppo titolo="Automatici del giro" totale={costi.automatici} righe={automatici} />
      <Gruppo titolo="A mano dalla chat" totale={costi.mano} righe={mano} />

      {(costi.stimati > 0 || costi.testiLiberi > 0) && (
        <div className="space-y-1 text-[11.5px] leading-snug text-muted-foreground">
          {costi.stimati > 0 && (
            <p>
              {messaggi(costi.stimati)} di cui non si conosce il modello esatto: costo stimato dal
              tipo di messaggio.
            </p>
          )}
          {costi.testiLiberi > 0 && (
            <p>
              {costi.testiLiberi === 1
                ? "1 testo libero scritto"
                : `${costi.testiLiberi} testi liberi scritti`}{" "}
              dalla chat nella finestra aperta: non sono nel totale (per Meta sono gratis fino a
              1.000 messaggi di servizio al mese per numero).
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Gruppo({
  titolo,
  totale,
  righe,
}: {
  titolo: string;
  totale: { messaggi: number; costo: number };
  righe: RigaTipo[];
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-medium text-muted-foreground">{titolo}</h3>
        <p className="text-[12px] tabular-nums text-muted-foreground">
          {messaggi(totale.messaggi)} · {euro(totale.costo, 2)}
        </p>
      </div>
      {righe.length === 0 ? (
        <p className="py-2 text-[13px] text-muted-foreground">Nessuno in questo periodo.</p>
      ) : (
        <ul className="divide-y divide-border">
          {righe.map((t) => (
            <Riga
              key={t.tipo}
              nome={t.etichetta}
              dettaglio={messaggi(t.messaggi)}
              costo={t.costo}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Riga({ nome, dettaglio, costo }: { nome: string; dettaglio: string; costo: number }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-[13px] text-foreground">{nome}</p>
        <p className="text-[11.5px] text-muted-foreground">{dettaglio}</p>
      </div>
      <p className="shrink-0 text-[13px] font-medium tabular-nums text-foreground">
        {euro(costo, 2)}
      </p>
    </li>
  );
}

/** Il tasto dell'intestazione: icona sola sul telefono (44 px), con la parola dal tablet in su. */
export function TastoCosti({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      aria-label="Costi WhatsApp"
      title="Costi WhatsApp"
      className="h-11 w-11 gap-1.5 px-0 text-xs md:h-8 md:w-auto md:px-3"
    >
      <Wallet className="h-4 w-4 md:h-3.5 md:w-3.5" />
      <span className="hidden md:inline">Costi</span>
    </Button>
  );
}
