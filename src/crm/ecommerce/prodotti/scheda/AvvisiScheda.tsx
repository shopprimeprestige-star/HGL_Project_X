/** ── GLI AVVISI IN CIMA ALLA SCHEDA (scheda/AvvisiScheda.tsx) ─────────────────
 *  Commessa 2026-11-25-editor-prodotti, E7. Il disegno mentre la scheda si legge, l'errore di lettura e i banner che stanno sotto la testata: il conflitto di versione («Qualcun altro ha modificato questo
 *  prodotto», con «Ricarica»), il prodotto del vecchio catalogo, la lettura fallita, l'errore di salvataggio e l'esito
 *  dell'ultima azione. Ogni avviso dice a parole cosa è successo e cosa si può fare. La striscia «Hai modifiche non pubblicate» è del guscio:
 *  ha il tasto «Pubblica le modifiche», che resta scritto dove stanno le sue regole.
 *  ⚠️ Solo presentazione: nessuna rete, nessuna scrittura. */
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner, CLASSI_TASTO } from "./polaris";

/** La scheda si sta leggendo: tre blocchi grigi (fermi se chi guarda ha scelto meno movimento). */
export function SchedaInCarico() {
  const blocco = "animate-pulse rounded-xl bg-muted motion-reduce:animate-none";
  return (
    <div role="status" aria-label="Carico la scheda" className="flex flex-col gap-3">
      <div className={`h-9 w-2/3 ${blocco}`} />
      <div className={`h-40 ${blocco}`} />
      <div className={`h-40 ${blocco}`} />
    </div>
  );
}

/** La lettura è fallita: la frase del server e un tasto (torna all'elenco se il prodotto non c'è, altrimenti riprova). */
export function ErroreLettura({
  errore,
  torna,
  riprova,
}: {
  errore: { tipo: string; messaggio: string };
  torna: () => void;
  riprova: () => void;
}) {
  const nonTrovato = errore.tipo === "non_trovato";
  return (
    <Banner
      tono="errore"
      azione={
        <Button
          type="button"
          variant="outline"
          className={CLASSI_TASTO}
          onClick={nonTrovato ? torna : riprova}
        >
          {nonTrovato ? "Torna ai prodotti" : "Riprova"}
        </Button>
      }
    >
      {errore.messaggio}
    </Banner>
  );
}

export type EsitoScheda = { tono: "ok" | "attenzione" | "errore"; testo: string } | null;
const TONO_BANNER = { ok: "info", attenzione: "attenzione", errore: "errore" } as const;

export function AvvisiScheda({
  conflitto,
  ricarica,
  vecchio,
  adotta,
  spento,
  letturaFallita,
  erroreSalva,
  esito,
}: {
  conflitto: boolean;
  ricarica: () => void;
  vecchio: boolean;
  adotta: () => void;
  spento: boolean;
  letturaFallita: boolean;
  erroreSalva: string | null;
  esito: EsitoScheda;
}) {
  return (
    <>
      {conflitto && (
        <Banner
          tono="errore"
          azione={
            <Button type="button" variant="outline" className={CLASSI_TASTO} onClick={ricarica}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Ricarica
            </Button>
          }
        >
          Qualcun altro ha modificato questo prodotto mentre lo guardavi. Ricarica per vedere la sua
          versione: le tue ultime modifiche non salvate andranno perse. Finché non ricarichi non
          salvo niente.
        </Banner>
      )}
      {vecchio && (
        <Banner
          tono="attenzione"
          azione={
            <Button
              type="button"
              variant="outline"
              className={CLASSI_TASTO}
              disabled={spento}
              onClick={adotta}
            >
              Usa questo prodotto
            </Button>
          }
        >
          Questo articolo viene dal vecchio catalogo: per pubblicarlo devi prima farne un tuo
          prodotto.
        </Banner>
      )}
      {letturaFallita && (
        <Banner tono="attenzione">
          Non riesco a rileggere la scheda: i numeri che vedi potrebbero essere indietro. Ricarica
          la pagina se qualcosa non torna.
        </Banner>
      )}
      {erroreSalva && <Banner tono="errore">{erroreSalva} Premi «Salva» per riprovare.</Banner>}
      {esito && <Banner tono={TONO_BANNER[esito.tono]}>{esito.testo}</Banner>}
    </>
  );
}
