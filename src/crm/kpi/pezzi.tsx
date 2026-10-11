// ── I PEZZI CHE COMPAIONO IN PIÙ DI UNA SCHEDA ──────────────────────────────
//  Due soli: il numero grande e l'elenco che ci sta dietro.
//  ⚠️ Qui viveva anche il conto del netto (`SchedaConto`). Se n'è andato con il
//   rifacimento della scheda «Ritorno»: adesso quelle righe hanno una barra
//   proporzionale e stanno in crm/kpi/conto-pezzi, insieme alla fascia del
//   risultato e all'imbuto. Cercarlo qui non lo troverebbe.
//  Stavano scritti DUE VOLTE, identici, in KPI e in KPI manuale — e quando due
//  copie divergono di un dettaglio (un colore, una soglia, una riga di formula)
//  chi legge conclude che sono due calcoli diversi. Qui ce n'è una copia sola.

import type { ComponentType, ReactNode } from "react";
import { Divide, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lead } from "@/crm/types";
import { ChipStato, Scheda, VuotoRiga, eur } from "@/crm/ui";
import { ricavoLordo } from "@/crm/kpi-calcoli";
import { ALIQUOTA_IVA_PREDEFINITA, vociDelConto, type ContoNetto } from "@/crm/kpi-netto";
import { punteggio } from "@/crm/kpi/basi";
import { NOME_CANALE, canaleDi } from "@/crm/kpi/canale";

/* ═══════════════════════════════════════════════════════════════════════════
   IL NUMERO GRANDE
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ NON <Kpi/> ─────────────────────────────────────────────────────
 *  <Kpi/> è il riquadro da 19px della seconda fila e la sua nota sta su una
 *  riga sola: qui servono un numero due volte più grande, una seconda lettura
 *  sotto, la BASE su cui è calcolato e la formula, che può andare a capo.
 *  Bordi, raggi, tinte e spaziature restano quelli di ui.tsx: cambia la
 *  gerarchia, non il linguaggio.
 *
 *  ⚠️ LA BASE NON È FACOLTATIVA NEI FATTI, anche se il tipo la lascia
 *  omettere: l'archivio ha 843 schede importate, molte incomplete, e una
 *  percentuale senza il suo denominatore sposta budget veri. Si omette solo
 *  dove il numero è un totale certo (la spesa del periodo), non una media. */
export function NumeroChiave({
  etichetta,
  valore,
  base,
  secondario,
  formula,
  icona: Icona,
  allarme,
  principale,
  onClick,
  attivo,
  titoloAzione,
  className,
}: {
  etichetta: string;
  valore: ReactNode;
  /** Su quanti casi è calcolato: «5 su 12», «su 27 giorni di spesa». */
  base?: ReactNode;
  /** la seconda lettura dello stesso fatto */
  secondario?: ReactNode;
  /** come è calcolato, in una riga */
  formula?: string;
  icona?: ComponentType<{ className?: string }>;
  /** il numero racconta una perdita: è l'unico caso in cui si colora */
  allarme?: boolean;
  /** il numero principale della scheda: uno solo, e si vede da lontano */
  principale?: boolean;
  onClick?: () => void;
  attivo?: boolean;
  titoloAzione?: string;
  /** solo per la posizione nella griglia (quante colonne occupa) */
  className?: string;
}) {
  const Elemento = onClick ? "button" : "div";
  return (
    <Elemento
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={titoloAzione}
      //  Come i Segmento della barra: il riquadro acceso è uno stato, non un
      //  colore, e chi legge con un lettore di schermo deve sentirlo dire.
      aria-pressed={attivo === undefined ? undefined : attivo}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border bg-card px-3.5 py-3 text-left",
        allarme ? "border-amber-300 bg-amber-50/40" : "border-border",
        principale && !allarme && "border-foreground/25 bg-accent/30",
        onClick && "cursor-pointer transition-colors hover:bg-accent/50",
        attivo && "ring-2 ring-primary/40",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {Icona && <Icona className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{etichetta}</span>
      </span>
      <span
        className={cn(
          "font-semibold leading-tight tabular-nums",
          principale ? "text-[28px] sm:text-[34px]" : "text-[22px] sm:text-[26px]",
          allarme && "text-amber-700",
        )}
      >
        {valore}
      </span>
      {base && <span className="text-[12px] text-muted-foreground">{base}</span>}
      {secondario && <span className="text-[12px] text-muted-foreground">{secondario}</span>}
      {formula && (
        <span className="text-[11px] leading-snug text-muted-foreground/80">{formula}</span>
      )}
    </Elemento>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CONTO DEL NETTO
   ═════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   L'ELENCO DIETRO AL NUMERO
   ═════════════════════════════════════════════════════════════════════════ */

/** Un conteggio che non si può aprire è un conteggio che si prende per buono
 *  finché un giorno non torna, e da lì in poi non si crede più a nessuno degli
 *  altri. Qui si vedono le schede una per una e si apre il lead. */
export function ElencoDietro({
  titolo,
  righe,
  conImporto,
  conPunteggio,
  nomeConsulente,
  onApri,
  onChiudi,
}: {
  titolo: string;
  righe: Lead[];
  /** solo per i clienti: accanto al nome sta il prezzo finale di vendita */
  conImporto?: boolean;
  /** solo per la qualità: accanto al nome sta il disagio dichiarato */
  conPunteggio?: boolean;
  nomeConsulente: (id?: string | null) => string;
  onApri: (l: Lead) => void;
  onChiudi: () => void;
}) {
  //  Oltre il centinaio l'elenco serve a verificare, non a leggere: si mostra
  //  la parte alta e si dice quanto resta, invece di far scorrere per minuti.
  const MOSTRATE = 100;
  const visibili = righe.slice(0, MOSTRATE);

  return (
    <Scheda
      titolo={titolo}
      nota={`${righe.length} ${righe.length === 1 ? "scheda" : "schede"}`}
      azioni={
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onChiudi}>
          <X className="h-3.5 w-3.5" /> Chiudi
        </Button>
      }
      senzaPadding
    >
      {righe.length === 0 ? (
        <VuotoRiga testo="Nessuna scheda dietro a questo numero nel periodo scelto." />
      ) : (
        <>
          <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">
            {visibili.map((l) => {
              const consulente = nomeConsulente(l.data.consulenteId);
              const disagio = l.data.qualifica?.disagio;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onApri(l)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                      {[l.data.nome, l.data.cognome].filter(Boolean).join(" ") || "Senza nome"}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {NOME_CANALE[canaleDi(l)]}
                    </span>
                    {consulente && (
                      <span className="shrink-0 truncate text-[11px] text-muted-foreground">
                        {consulente}
                      </span>
                    )}
                    {conPunteggio && (
                      <span className="shrink-0 text-[11.5px] tabular-nums">
                        {typeof disagio === "number" ? punteggio(disagio) : "—"}
                      </span>
                    )}
                    {conImporto && (
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums">
                        {eur(ricavoLordo(l))}
                      </span>
                    )}
                    <ChipStato stato={l.data.stato} className="shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
          {righe.length > MOSTRATE && (
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              Mostrate le prime {MOSTRATE} di {righe.length}: restringi il periodo per vederle
              tutte.
            </p>
          )}
        </>
      )}
    </Scheda>
  );
}
