/** ── FATTURE DALLA CHAT · T8 · L'ANTEPRIMA (AnteprimaChat.tsx) ─────────────
 *  Commessa 2026-11-13-fatture-dalla-chat, T8 (SPEC §3 passo 3, §6.2-§6.4).
 *  Una riga per cliente, con stato e il perché in una frase — ESATTAMENTE gli
 *  stessi stati e colori della bulk da screenshot (SPEC §3): per questo si
 *  importano `BadgeStato`/`ETICHETTA_STATO`/`motivoPrincipale`/`contaPerStato`/
 *  `filtraRighe`/`nomeDellaRiga`/`euroEsatti`/`dataItaliana` da `AnteprimaBulk.tsx`
 *  (import, non copia: `RigaValutata`/`StatoVisibile`/`Motivo` sono gli STESSI
 *  tipi della bulk, PIANO §7 di SPEC — qui non c'è un secondo calcolo di stato).
 *
 *  ⚠️ Niente miniature qui: quelle (tessera/indirizzo/pagamento) si vedono solo
 *   aprendo la riga (`PannelloRigaChat`), stesso principio «su richiesta» della
 *   bulk ma con un contratto diverso (`?miniatura=…&idRiga=…`, non per indice
 *   di file): mescolare i due contratti nella stessa lista avrebbe richiesto
 *   due codici per la stessa cosa. */
import { useMemo } from "react";
import { AlertTriangle, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotaFinestra, VuotoFinestra } from "@/crm/ui/Finestra";
import {
  BadgeStato,
  contaPerStato,
  dataItaliana,
  euroEsatti,
  ETICHETTA_STATO,
  filtraRighe,
  motivoPrincipale,
  nomeDellaRiga,
  RIGHE_PER_PAGINA,
  rigaAperta,
  type FiltroRighe,
} from "../bulk/AnteprimaBulk";
import type { DecisioniRiga, RigaValutata } from "../bulk/tipi";

function RigaAnteprimaChat({
  riga,
  confermati,
  numeroEmessa,
  onApri,
}: {
  riga: RigaValutata;
  confermati: string[];
  numeroEmessa?: number;
  onApri: () => void;
}) {
  const motivo = motivoPrincipale(riga, confermati);
  const c = riga.campi;
  const aperta = rigaAperta(riga);
  const indirizzo = [
    c.indirizzo,
    [c.cap, c.comune].filter(Boolean).join(" "),
    c.provincia && `(${c.provincia})`,
  ]
    .filter(Boolean)
    .join(", ");
  const contenuto = (
    <div className="grid min-w-0 gap-x-3 gap-y-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-slate-900">
          {nomeDellaRiga(riga)}
        </span>
        <span className="block truncate text-[11.5px] tabular-nums text-slate-500">
          {c.codiceFiscale || "Codice fiscale da leggere"}
        </span>
      </span>
      <span className="min-w-0 truncate text-[12.5px] text-slate-700 md:whitespace-normal md:[display:-webkit-box] md:[-webkit-box-orient:vertical] md:[-webkit-line-clamp:2]">
        {indirizzo || <span className="text-slate-500">Indirizzo da leggere</span>}
      </span>
      <span className="min-w-0 text-[12.5px] text-slate-700">
        <span className="block font-semibold tabular-nums text-slate-900">
          {euroEsatti(c.importo)}
        </span>
        <span className="block truncate text-[11.5px] text-slate-500">
          {dataItaliana(c.data)}
          {c.modo ? ` · ${c.modo}` : ""}
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <BadgeStato
            stato={riga.stato}
            testo={numeroEmessa ? `Emessa n. ${numeroEmessa}` : undefined}
          />
        </span>
        {aperta && motivo && riga.stato !== "confermata" && (
          <span
            className={cn(
              "mt-1 block text-[12px] leading-snug",
              motivo.gravita === "blocca" ? "text-rose-800" : "text-slate-600",
            )}
          >
            {motivo.testo}
          </span>
        )}
      </span>
    </div>
  );

  return (
    <li className="border-b border-slate-100 last:border-b-0">
      {aperta ? (
        <button
          type="button"
          id={`riga-chat-${riga.idRiga}`}
          onClick={onApri}
          aria-label={`Apri la riga: ${nomeDellaRiga(riga)}, ${ETICHETTA_STATO[riga.stato]}`}
          className="block w-full rounded-lg px-3.5 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {contenuto}
        </button>
      ) : (
        <div className="px-3.5 py-2.5 opacity-80">{contenuto}</div>
      )}
    </li>
  );
}

export function AnteprimaChat({
  righe,
  decisioni,
  filtro,
  onFiltro,
  pagina,
  onPagina,
  occupato,
  nPronte,
  avvisiPerTutte,
  onApri,
  onProssima,
  onConfermaTutte,
  onConfermaAvviso,
}: {
  righe: RigaValutata[];
  decisioni: Record<string, Pick<DecisioniRiga, "confermeAvvisi" | "emessa">>;
  filtro: FiltroRighe;
  onFiltro: (f: FiltroRighe) => void;
  pagina: number;
  onPagina: (p: number) => void;
  occupato: boolean;
  nPronte: number;
  avvisiPerTutte: { codice: string; testo: string; n: number }[];
  onApri: (idRiga: string) => void;
  onProssima: () => void;
  onConfermaTutte: () => void;
  onConfermaAvviso: (codice: string) => void;
}) {
  const conti = useMemo(() => contaPerStato(righe), [righe]);
  const visibili = useMemo(() => filtraRighe(righe, filtro), [righe, filtro]);
  const pagine = Math.max(1, Math.ceil(visibili.length / RIGHE_PER_PAGINA));
  const paginaOk = Math.min(pagina, pagine - 1);
  const dellaPagina = visibili.slice(
    paginaOk * RIGHE_PER_PAGINA,
    (paginaOk + 1) * RIGHE_PER_PAGINA,
  );

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
        {(
          [
            ["tutte", "Tutte", conti.tutte, "bg-slate-400"],
            ["pronto", "Pronte", conti.pronto, "bg-emerald-500"],
            ["da_controllare", "Da controllare", conti.da_controllare, "bg-amber-500"],
            ["errore", "Errori", conti.errore, "bg-rose-500"],
          ] as const
        ).map(([valore, etichetta, n, punto]) => (
          <button
            key={valore}
            type="button"
            onClick={() => onFiltro(valore)}
            aria-pressed={filtro === valore}
            className={cn(
              "flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-colors sm:flex-col sm:items-start sm:py-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
              filtro === valore
                ? "border-slate-400 bg-slate-100"
                : "border-slate-200 bg-white hover:bg-slate-50",
            )}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", punto)} aria-hidden />
              <span className="truncate">{etichetta}</span>
            </span>
            <span className="text-[17px] font-semibold leading-tight tabular-nums text-slate-900 sm:text-[19px]">
              {n}
            </span>
          </button>
        ))}
      </div>

      {(conti.emessa > 0 || conti.scartata > 0) && (
        <p className="text-[11.5px] text-slate-500">
          {conti.emessa > 0 && `${conti.emessa} già emesse`}
          {conti.emessa > 0 && conti.scartata > 0 && " · "}
          {conti.scartata > 0 && `${conti.scartata} scartate`}
        </p>
      )}

      {avvisiPerTutte.map((a) => (
        <NotaFinestra key={a.codice} tono="attenzione" icona={AlertTriangle}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>{a.testo}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 sm:h-9"
              disabled={occupato}
              onClick={() => onConfermaAvviso(a.codice)}
            >
              Conferma questo avviso per tutte ({a.n})
            </Button>
          </span>
        </NotaFinestra>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-11 sm:h-9"
          disabled={occupato || nPronte === 0}
          onClick={onConfermaTutte}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          Conferma tutte le pronte ({nPronte})
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          disabled={conti.da_controllare === 0}
          onClick={onProssima}
        >
          Vai alla prossima da controllare
        </Button>
      </div>

      {visibili.length === 0 ? (
        <VuotoFinestra
          testo={
            righe.length === 0
              ? "Nessun cliente ancora: aspetta che finisca la ricerca."
              : "Nessuna riga in questo gruppo."
          }
        />
      ) : (
        <section
          aria-label="Un cliente per riga"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <ul>
            {dellaPagina.map((r) => (
              <RigaAnteprimaChat
                key={r.idRiga}
                riga={r}
                confermati={decisioni[r.idRiga]?.confermeAvvisi ?? []}
                numeroEmessa={decisioni[r.idRiga]?.emessa?.numero}
                onApri={() => onApri(r.idRiga)}
              />
            ))}
          </ul>
        </section>
      )}

      {pagine > 1 && (
        <nav aria-label="Pagine dell'elenco" className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            disabled={paginaOk === 0}
            onClick={() => onPagina(paginaOk - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Prima
          </Button>
          <span className="text-[12px] tabular-nums text-slate-500" aria-live="polite">
            Righe {paginaOk * RIGHE_PER_PAGINA + 1}–
            {Math.min(visibili.length, (paginaOk + 1) * RIGHE_PER_PAGINA)} di {visibili.length}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            disabled={paginaOk >= pagine - 1}
            onClick={() => onPagina(paginaOk + 1)}
          >
            Dopo <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
