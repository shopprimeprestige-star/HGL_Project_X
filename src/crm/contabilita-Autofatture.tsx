/** ── LE AUTOFATTURE ESTERE, UNA PER UNA ────────────────────────────────────
 *
 *  Richiesta del committente: «fai che sia automatica, ma serve la conferma
 *  manuale dell'utente, che si accerta che sia corretta».
 *
 *  ── ⚠️ IL PROGRAMMA PREPARA, LA PERSONA TRASMETTE ────────────────────────
 *  Il CRM costruisce il file — TD17, TD18 o TD19 secondo il regime — e lo
 *  valida contro il tracciato ufficiale. Quello che NON può fare è mandarlo:
 *  non ha nessun canale verso lo SdI, e quello passa dal cassetto fiscale o
 *  dal gestionale dello studio.
 *  Quindi «trasmessa» non è una cosa che il programma può sapere: è una cosa
 *  che qualcuno dichiara. Segnarla da sé perché il file è stato costruito
 *  vorrebbe dire dichiarare fatto un adempimento che nessuno ha fatto — e la
 *  multa, su questo, arriva per OGNI documento non mandato.
 *
 *  ── ⚠️ E LE ROTTE SI VEDONO PRIMA DELLE BUONE ────────────────────────────
 *  Una che non si può costruire è l'unica riga su cui c'è da fare qualcosa
 *  adesso: manca un dato, e finché manca quel documento non parte. In fondo
 *  all'elenco la vedrebbe chi ha già finito.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { AlertTriangle, Check, Download, FileCode2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  costruisciAutofattura,
  nomeFileAutofattura,
  numeroAutofattura,
  problemiAutofattura,
} from "./contabilita-autofattura";
import { regimeDi } from "./contabilita-regimi";
import { salvaFornitore, type FatturaFornitore } from "./contabilita-fornitori";
import { scaricaXml } from "./fatture/scarica";
import type { DatiAzienda } from "./fatture/tipi";
import { dataBreve, eur } from "./ui";
import { Scheda } from "./ui";

const oggiISO = () => new Date().toISOString().slice(0, 10);

export function Autofatture({
  fornitori,
  azienda,
  onCambiate,
}: {
  /** Le fatture estere del periodo: il filtro lo fa chi monta. */
  fornitori: FatturaFornitore[];
  azienda: DatiAzienda;
  onCambiate: () => void;
}) {
  const [inCorso, setInCorso] = useState("");

  const righe = fornitori
    .filter((f) => regimeDi(f.regime ?? "italiana").tipoDocumento)
    .map((f) => ({ f, problemi: problemiAutofattura(f, azienda) }))
    //  ⚠️ Prima le rotte, poi le da fare, in fondo quelle già trasmesse: è
    //   l'ordine in cui servono, non quello in cui stanno in archivio.
    .sort((a, b) => {
      const peso = (x: typeof a) =>
        x.problemi.length > 0 ? 0 : x.f.autofatturaTrasmessaIl ? 2 : 1;
      return peso(a) - peso(b) || String(a.f.data).localeCompare(String(b.f.data));
    });

  if (righe.length === 0) return null;

  const daFare = righe.filter((x) => x.problemi.length === 0 && !x.f.autofatturaTrasmessaIl).length;

  const scarica = (x: (typeof righe)[number]) => {
    scaricaXml(nomeFileAutofattura(x.f, azienda), costruisciAutofattura(x.f, azienda));
  };

  const segna = async (f: FatturaFornitore, trasmessa: boolean) => {
    setInCorso(f.id);
    const e = await salvaFornitore({
      ...f,
      //  ⚠️ Si toglie davvero, non si mette a stringa vuota: un campo presente
      //   e vuoto è la stessa cosa scritta in un modo che nessuno ricontrolla.
      ...(trasmessa
        ? { autofatturaTrasmessaIl: oggiISO() }
        : { autofatturaTrasmessaIl: undefined }),
    });
    setInCorso("");
    if (e) {
      toast.error("Non è stato salvato", { description: e });
      return;
    }
    toast.success(
      trasmessa
        ? `${f.fornitore}: segnata trasmessa`
        : `${f.fornitore}: torna fra quelle da trasmettere`,
    );
    onCambiate();
  };

  return (
    <Scheda
      titolo="Autofatture da trasmettere"
      nota={
        daFare > 0
          ? `${daFare} ${daFare === 1 ? "documento" : "documenti"} da mandare allo SdI. Il file lo prepara il CRM; a trasmetterlo e a confermarlo sei tu.`
          : "Tutte confermate. Il CRM prepara il file, la trasmissione la dichiari tu."
      }
      icona={FileCode2}
      senzaPadding
    >
      <ul className="divide-y divide-border">
        {righe.map(({ f, problemi }) => {
          const rotta = problemi.length > 0;
          const fatta = !!f.autofatturaTrasmessaIl;
          return (
            <li
              key={f.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-[13px]",
                rotta && "bg-rose-50/60",
                fatta && "opacity-60",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {f.fornitore}
                  <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">
                    {dataBreve(f.data)}
                    {f.numero ? ` · n. ${f.numero}` : ""} · {eur(f.totale)}
                  </span>
                </span>
                {rotta ? (
                  <span className="mt-0.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-rose-800">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {/*  ⚠️ IL MOTIVO, NON «non si può fare»: manca un dato, e
                        finché non si sa quale non lo mette nessuno. */}
                    {problemi.join(" · ")}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    {regimeDi(f.regime ?? "italiana").tipoDocumento} · n. {numeroAutofattura(f)}
                    {fatta ? ` · trasmessa il ${dataBreve(f.autofatturaTrasmessaIl!)}` : ""}
                  </span>
                )}
              </span>

              {!rotta && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2 text-[11.5px]"
                    onClick={() => scarica({ f, problemi })}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> XML
                  </Button>
                  {fatta ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2 text-[11.5px] text-muted-foreground"
                      disabled={inCorso === f.id}
                      onClick={() => void segna(f, false)}
                    >
                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Non l&apos;ho mandata
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 shrink-0 bg-emerald-600 px-2 text-[11.5px] text-white hover:bg-emerald-700"
                      disabled={inCorso === f.id}
                      onClick={() => void segna(f, true)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> L&apos;ho trasmessa
                    </Button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Scheda>
  );
}
