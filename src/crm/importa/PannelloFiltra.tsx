/** ── IL TASTO «FILTRA» E IL SUO PANNELLO ───────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». Annuncio, Risposta, Origine e
 *  Quando stanno insieme in un solo pannello (dal basso sul telefono, accanto al
 *  tasto sul computer) invece che in quattro menu sempre in vista. Il tasto dice
 *  «Filtra · 2» quando ci sono filtri accesi, e i filtri accesi si vedono sotto
 *  come etichette con la × (`EtichetteAccese`), solo se accesi.
 *
 *  I quattro menu sono quelli di FiltriLista.tsx (provati, di Radix): non si
 *  riscrivono. Le regole e i numeri sono di filtri-lista.ts.
 *  ⚠️ Lo Stato (la pillola) non conta in «Filtra · N»: ha la sua riga.
 *  ───────────────────────────────────────────────────────────────────────── */
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOME_FETTA_TEMPO } from "@/crm/quando-stato";
import type { FiltriLista, OpzioniFiltri } from "./filtri-lista";
import {
  Etichetta,
  MenuAnnuncio,
  MenuOrigine,
  MenuQuando,
  MenuRisposta,
  etichettaRispostaScelta,
  filtriAccesi,
  nomeAnnuncio,
  pulito,
} from "./FiltriLista";
import { PannelloBasso } from "./PannelloBasso";
import { NOME_VIA } from "./origine";

/** Quanti filtri del pannello sono accesi (la pillola dello Stato no). */
export function filtriDelPannello(f: FiltriLista): number {
  return filtriAccesi(f) - (f.stato && f.stato !== "tutti" ? 1 : 0);
}

export function PannelloFiltra({
  filtri,
  opzioni,
  onCambia,
  aperto,
  onCambio,
  conOrigine,
  disabilitato,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  aperto: boolean;
  onCambio: (aperto: boolean) => void;
  /** C'è almeno un lead dal foglio Google: solo allora Origine ha qualcosa da scegliere. */
  conOrigine?: boolean;
  disabilitato?: boolean;
}) {
  const n = filtriDelPannello(filtri);
  return (
    <PannelloBasso
      aperto={aperto}
      onCambio={onCambio}
      titolo="Filtra"
      descrizione="Annuncio, risposta, origine e quando: restringono la lista da chiamare"
      trigger={
        <Button
          type="button"
          variant={n > 0 ? "default" : "outline"}
          size="sm"
          disabled={disabilitato}
          className="h-11 shrink-0 gap-1.5 text-[13px] md:h-8 md:text-[12.5px]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          {n > 0 ? `Filtra · ${n}` : "Filtra"}
        </Button>
      }
    >
      <div className="space-y-2.5">
        <MenuAnnuncio alto filtri={filtri} opzioni={opzioni} onCambia={onCambia} />
        <MenuRisposta alto filtri={filtri} opzioni={opzioni} onCambia={onCambia} />
        {(conOrigine || filtri.origine) && (
          <MenuOrigine alto filtri={filtri} opzioni={opzioni} onCambia={onCambia} />
        )}
        <MenuQuando alto filtri={filtri} opzioni={opzioni} onCambia={onCambia} />
        {n > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full text-[13px] text-muted-foreground hover:text-foreground md:h-9"
            //  Toglie i filtri del pannello e lascia la pillola com'è.
            onClick={() => onCambia(pulito({ stato: filtri.stato }))}
          >
            Azzera i filtri
          </Button>
        )}
      </div>
    </PannelloBasso>
  );
}

/** I filtri del pannello che sono accesi, come etichette da spegnere con un
 *  clic. Niente se non ce n'è nessuno. */
export function EtichetteAccese({
  filtri,
  opzioni,
  onCambia,
  disabilitato,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  disabilitato?: boolean;
}) {
  if (filtriDelPannello(filtri) === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-disabled={disabilitato || undefined}
    >
      {filtri.annuncio && (
        <Etichetta
          testo={nomeAnnuncio(filtri.annuncio, opzioni)}
          onToglie={() => onCambia(pulito({ ...filtri, annuncio: undefined }))}
        />
      )}
      {(filtri.risposte ?? []).map((k) => (
        <Etichetta
          key={k}
          testo={etichettaRispostaScelta(k, opzioni)}
          onToglie={() =>
            onCambia(pulito({ ...filtri, risposte: (filtri.risposte ?? []).filter((x) => x !== k) }))
          }
        />
      ))}
      {filtri.origine && (
        <Etichetta
          testo={`Origine: ${NOME_VIA[filtri.origine]}`}
          onToglie={() => onCambia(pulito({ ...filtri, origine: undefined }))}
        />
      )}
      {filtri.quando && filtri.quando !== "sempre" && (
        <Etichetta
          testo={`Stato messo: ${NOME_FETTA_TEMPO[filtri.quando].toLowerCase()}`}
          onToglie={() => onCambia(pulito({ ...filtri, quando: undefined }))}
        />
      )}
    </div>
  );
}
