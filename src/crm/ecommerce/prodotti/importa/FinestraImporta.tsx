/** ── LA FINESTRA DELL'IMPORT DEI PRODOTTI (FinestraImporta.tsx) ──────────────
 *  Commessa 2026-11-25-editor-prodotti, E10 (SPEC §2.3). Tre passi: scegli il file (`PassoScegli`), controllo (`PassoControllo`), importa
 *  (`PassoImporta`). Qui c'è solo il collegamento: lo stato dei passi, i due download e la rete. Le regole sono in `importa-flusso.ts`.
 *
 *  ── LE REGOLE CHE SI VEDONO ─────────────────────────────────────────────────
 *  · Il file vive solo in memoria: non va in nessun archivio del browser, non è mai spedito (al server va il prodotto già normalizzato, a gruppi).
 *  · Fino a «Importa» il server riceve solo la verifica (sola lettura): nessuna scrittura.
 *  · Mentre i gruppi partono la finestra non si chiude; «Interrompi» ferma dopo il gruppo in corso e «Riprendi» non rimanda ciò che è già entrato.
 *  · La rete passa SOLO da `negozio.esegui` (lo stesso di ogni altra azione del negozio): niente chiamate dirette da qui.
 *
 *  ── LE PROPS ────────────────────────────────────────────────────────────────
 *   · `aperta` / `chiudi`  la finestra si apre dal tasto «Importa» dell'elenco.
 *   · `negozio`            `Pick<Negozio, "esegui">`: quello di `useNegozio()`, passato dal guscio.
 *   · `apriProdotto`       apre la scheda di un prodotto già presente (facoltativo).
 *   · `vaiAiProdotti`      «Vai ai prodotti importati» (facoltativo: senza, chiude la finestra; l'elenco si rilegge da solo dopo ogni scrittura).
 *  ⚠️ Nessun log da qui, mai. */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { costruisciModello, NOME_FILE_MODELLO } from "@/crm/negozio/csv-modello";
import { cn } from "@/lib/utils";
import type { Negozio } from "../tipi";
import {
  AZIONE_IMPORTA,
  NOME_FILE_DA_CORREGGERE,
  analizzaFile,
  avviaImporta,
  csvDaCorreggere,
  eseguiGruppi,
  riepilogoFinale,
  riprendi,
  type Analisi,
  type StatoImporta,
} from "./importa-flusso";
import { PassoControllo } from "./PassoControllo";
import { PassoImporta } from "./PassoImporta";
import { PassoScegli } from "./PassoScegli";

type Fase =
  | { passo: "scegli"; leggo?: boolean; errore?: string }
  | { passo: "controllo"; analisi: Analisi }
  | { passo: "importa"; analisi: Analisi; stato: StatoImporta; inCorso: boolean };

const INIZIO: Fase = { passo: "scegli" };
const PASSI = [
  { id: "scegli", nome: "Scegli il file" },
  { id: "controllo", nome: "Controllo" },
  { id: "importa", nome: "Importa" },
] as const;

/** Fa scaricare un testo come file (CSV con il segno iniziale di Excel). Niente HTML: un collegamento nascosto, cliccato e tolto. */
function scaricaCsv(nome: string, testo: string) {
  const url = URL.createObjectURL(new Blob([testo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function FinestraImporta({
  aperta,
  chiudi,
  negozio,
  apriProdotto,
  vaiAiProdotti,
}: {
  aperta: boolean;
  chiudi: () => void;
  negozio: Pick<Negozio, "esegui">;
  apriProdotto?: (id: string) => void;
  vaiAiProdotti?: () => void;
}) {
  const [fase, setFase] = useState<Fase>(INIZIO);
  /** Cambia a ogni passo e a ogni chiusura: un risultato arrivato in ritardo da un giro vecchio si scarta. */
  const giro = useRef(0);
  const ferma = useRef(false);
  const titolo = useRef<HTMLHeadingElement>(null);
  const passoPrima = useRef<Fase["passo"]>("scegli");

  useEffect(() => {
    if (!aperta) {
      giro.current++;
      ferma.current = true;
      setFase(INIZIO);
    }
  }, [aperta]);
  useEffect(
    () => () => {
      giro.current++;
      ferma.current = true;
    },
    [],
  );
  // A ogni cambio di passo il focus va al titolo del passo (chi usa la tastiera o la sintesi vocale non resta su un tasto sparito).
  useEffect(() => {
    if (passoPrima.current !== fase.passo) titolo.current?.focus();
    passoPrima.current = fase.passo;
  }, [fase.passo]);

  const occupata = fase.passo === "importa" && fase.inCorso;

  const scegli = async (file: File) => {
    const mio = ++giro.current;
    setFase({ passo: "scegli", leggo: true });
    const r = await analizzaFile(file, negozio.esegui);
    if (mio !== giro.current) return;
    setFase(
      r.ok ? { passo: "controllo", analisi: r.analisi } : { passo: "scegli", errore: r.frase },
    );
  };

  const manda = async (analisi: Analisi, inizio: StatoImporta) => {
    const mio = ++giro.current;
    ferma.current = false;
    setFase({ passo: "importa", analisi, stato: inizio, inCorso: true });
    const fine = await eseguiGruppi(
      inizio,
      (prodotti) => negozio.esegui(AZIONE_IMPORTA, { prodotti }),
      {
        interrompi: () => ferma.current,
        aggiorna: (stato) => {
          if (mio === giro.current) setFase({ passo: "importa", analisi, stato, inCorso: true });
        },
      },
    );
    if (mio === giro.current) setFase({ passo: "importa", analisi, stato: fine, inCorso: false });
  };

  const scaricaErrori = () => {
    if (fase.passo === "controllo")
      scaricaCsv(
        NOME_FILE_DA_CORREGGERE,
        csvDaCorreggere(fase.analisi, { errori: fase.analisi.errori }),
      );
    if (fase.passo === "importa")
      scaricaCsv(
        NOME_FILE_DA_CORREGGERE,
        csvDaCorreggere(fase.analisi, riepilogoFinale(fase.analisi, fase.stato)),
      );
  };

  const indice = PASSI.findIndex((p) => p.id === fase.passo);
  return (
    <Dialog open={aperta} onOpenChange={(v) => !v && !occupata && chiudi()}>
      <DialogContent className="crm-theme max-h-[92vh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto bg-white p-4 text-foreground sm:p-6">
        <DialogHeader>
          <DialogTitle>Importa prodotti da un file</DialogTitle>
          <DialogDescription>
            Il file si legge nel tuo browser e non viene salvato. Tutto entra in bozza, senza foto:
            le foto si aggiungono dalla scheda.
          </DialogDescription>
        </DialogHeader>

        <ol
          aria-label="I tre passi dell'importazione"
          className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]"
        >
          {PASSI.map((p, i) => (
            <li
              key={p.id}
              aria-current={i === indice ? "step" : undefined}
              className={cn(
                "flex items-center gap-2",
                i === indice ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border text-[11px] tabular-nums",
                  i === indice
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border",
                )}
              >
                {i < indice ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
              </span>
              {p.nome}
              {i < indice && <span className="sr-only"> (fatto)</span>}
            </li>
          ))}
        </ol>

        <h3 ref={titolo} tabIndex={-1} className="text-[16px] font-semibold focus:outline-none">
          {fase.passo === "scegli"
            ? "Passo 1 · Scegli il file"
            : fase.passo === "controllo"
              ? "Passo 2 · Controllo"
              : "Passo 3 · Importa"}
        </h3>

        {fase.passo === "scegli" && (
          <PassoScegli
            leggo={!!fase.leggo}
            errore={fase.errore}
            scegli={scegli}
            scaricaModello={() => scaricaCsv(NOME_FILE_MODELLO, costruisciModello())}
          />
        )}
        {fase.passo === "controllo" && (
          <PassoControllo
            analisi={fase.analisi}
            apriProdotto={apriProdotto}
            cambiaFile={() => setFase(INIZIO)}
            scaricaErrori={scaricaErrori}
            importa={() => void manda(fase.analisi, avviaImporta(fase.analisi.nuovi))}
          />
        )}
        {fase.passo === "importa" && (
          <PassoImporta
            analisi={fase.analisi}
            stato={fase.stato}
            inCorso={fase.inCorso}
            interrompi={() => {
              ferma.current = true;
            }}
            riprendi={() => void manda(fase.analisi, riprendi(fase.stato))}
            scaricaErrori={scaricaErrori}
            vaiAiProdotti={vaiAiProdotti ?? chiudi}
            chiudi={chiudi}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
