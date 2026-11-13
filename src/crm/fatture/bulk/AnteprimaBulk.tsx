/** ── FATTURE BULK · L'ANTEPRIMA (AnteprimaBulk.tsx) ───────────────────────
 *  Commessa 2026-11-12-fatture-bulk, T13. L'elenco di lavoro: una riga per
 *  cliente, NELL'ORDINE DI CARICAMENTO, con numero, stato e il perché in una
 *  frase. Qui non si decide niente: stato, motivi e totali arrivano già calcolati
 *  da `valutaLotto` (T10) e si mostrano. Nessun componente di questa cartella
 *  ricalcola IVA, stati o regole.
 *
 *  ⚠️ Le miniature sono SU RICHIESTA: ogni riga ne chiede gli indirizzi firmati
 *   (validi 60 secondi) solo quando la persona le apre. 25 righe per pagina,
 *   quindi mai 75 richieste insieme.
 *  ⚠️ Nessun dato personale va in console, nel titolo della pagina o in
 *   localStorage: i nomi stanno solo a schermo. */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Image as IconaImmagine,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchCRM } from "@/crm/AuthContext";
import { NotaFinestra, VuotoFinestra } from "@/crm/ui/Finestra";
import { leggiRotta, ErroreRotta } from "./usa-lotto";
import type {
  DecisioniRiga,
  FileLotto,
  Motivo,
  RigaValutata,
  RispostaMiniature,
  StatoVisibile,
} from "./tipi";

/* ══ 1. PEZZI COMUNI (li usano anche il pannello e il riepilogo) ═══════════ */

export const RIGHE_PER_PAGINA = 25;

/** Euro con i centesimi: su un documento fiscale non si arrotonda a vista. */
export const euroEsatti = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/** Da AAAA-MM-GG a GG/MM/AAAA; altro = «—». */
export const dataItaliana = (iso: string | undefined): string =>
  iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "—";

/** Gli indici dei file di una riga («0006-0007-0008» → [6, 7, 8]). */
export const indiciDiRiga = (idRiga: string): number[] =>
  idRiga
    .split("-")
    .map(Number)
    .filter((n) => Number.isInteger(n));

export const rigaAperta = (r: Pick<RigaValutata, "stato">): boolean =>
  r.stato !== "emessa" && r.stato !== "scartata";

export const nomeDellaRiga = (r: RigaValutata): string =>
  `${r.campi.nome} ${r.campi.cognome}`.trim() || "Nome da leggere";

/** `export` per la modalità «dalla chat» (commessa 2026-11-13, T0b): stesse etichette,
 *  stessi colori — mai una copia che domani diverge. */
export const ETICHETTA_STATO: Record<StatoVisibile, string> = {
  pronto: "Pronto",
  da_controllare: "Da controllare",
  errore: "Errore",
  confermata: "Confermata",
  emessa: "Emessa",
  scartata: "Scartata",
};

export const STILE_STATO: Record<StatoVisibile, { classe: string; icona: typeof CheckCircle2 }> = {
  pronto: { classe: "border-emerald-200 bg-emerald-50 text-emerald-800", icona: CheckCircle2 },
  da_controllare: { classe: "border-amber-200 bg-amber-50 text-amber-900", icona: AlertTriangle },
  errore: { classe: "border-rose-200 bg-rose-50 text-rose-800", icona: XCircle },
  confermata: { classe: "border-sky-200 bg-sky-50 text-sky-800", icona: CheckCheck },
  emessa: { classe: "border-emerald-300 bg-emerald-100 text-emerald-900", icona: FileCheck2 },
  scartata: { classe: "border-slate-200 bg-slate-100 text-slate-600", icona: Ban },
};

/** Colori e parole fisse (SPEC §3). Il colore non è mai l'unico segnale: c'è l'icona e c'è la parola. */
export function BadgeStato({ stato, testo }: { stato: StatoVisibile; testo?: string }) {
  const { classe, icona: Icona } = STILE_STATO[stato];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-semibold leading-none",
        classe,
      )}
    >
      <Icona className="h-3 w-3" aria-hidden />
      {testo ?? ETICHETTA_STATO[stato]}
    </span>
  );
}

/** Il motivo da mettere in elenco: prima ciò che blocca, poi ciò che aspetta una conferma, poi il resto. */
export function motivoPrincipale(r: RigaValutata, confermati: string[] = []): Motivo | undefined {
  return (
    r.motivi.find((m) => m.gravita === "blocca") ??
    r.motivi.find((m) => m.gravita === "conferma" && !confermati.includes(m.codice)) ??
    r.motivi.find((m) => m.gravita === "avviso")
  );
}

export type FiltroRighe = "tutte" | "pronto" | "da_controllare" | "errore" | "confermata";

export function filtraRighe(righe: RigaValutata[], filtro: FiltroRighe): RigaValutata[] {
  return filtro === "tutte" ? righe : righe.filter((r) => r.stato === filtro);
}

export function contaPerStato(righe: RigaValutata[]): Record<StatoVisibile | "tutte", number> {
  const c: Record<StatoVisibile | "tutte", number> = {
    tutte: righe.length,
    pronto: 0,
    da_controllare: 0,
    errore: 0,
    confermata: 0,
    emessa: 0,
    scartata: 0,
  };
  for (const r of righe) c[r.stato] += 1;
  return c;
}

/* ══ 2. LE MINIATURE (indirizzi firmati, su richiesta) ═════════════════════ */

const quattroCifre = (i: number) => String(i).padStart(4, "0");

/** Chiede gli indirizzi firmati dei file indicati (al massimo 6 per volta, 60 secondi di vita).
 *  Se un'immagine non si carica perché l'indirizzo è scaduto, `riprova` ne chiede di nuovi. */
export function useUrlFirmati(lotto: string | null, indici: number[], attivo: boolean) {
  const chiave = indici.join(",");
  const [esito, setEsito] = useState<{
    chiave: string;
    urls: RispostaMiniature;
    errore: string | null;
    caricando: boolean;
  }>({ chiave: "", urls: {}, errore: null, caricando: false });
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    if (!attivo || !lotto || !chiave) return;
    let vivo = true;
    setEsito((e) => ({ ...e, caricando: true, errore: null }));
    leggiRotta<RispostaMiniature>(
      fetchCRM,
      `?lotto=${encodeURIComponent(lotto)}&url=${chiave
        .split(",")
        .map((i) => quattroCifre(Number(i)))
        .join(",")}`,
    )
      .then((urls) => vivo && setEsito({ chiave, urls, errore: null, caricando: false }))
      .catch((e: unknown) => {
        if (!vivo) return;
        const messaggio =
          e instanceof ErroreRotta ? e.messaggio : "Non riesco a caricare gli screenshot.";
        setEsito({ chiave, urls: {}, errore: messaggio, caricando: false });
      });
    return () => {
      vivo = false;
    };
  }, [lotto, chiave, attivo, tentativo]);

  return {
    urls: esito.chiave === chiave ? esito.urls : ({} as RispostaMiniature),
    errore: esito.chiave === chiave ? esito.errore : null,
    caricando: esito.caricando,
    riprova: () => setTentativo((t) => t + 1),
  };
}

const NOME_TIPO: Record<string, string> = {
  indirizzo: "Indirizzo",
  tessera: "Tessera sanitaria",
  pagamento: "Pagamento",
  altro: "Altro",
};

/** Gli screenshot di una riga. `grande` = a schermo intero di colonna (pannello), altrimenti miniature. */
export function Screenshot({
  lotto,
  indici,
  file,
  grande,
}: {
  lotto: string;
  indici: number[];
  file: FileLotto[];
  grande?: boolean;
}) {
  const { urls, errore, caricando, riprova } = useUrlFirmati(lotto, indici, true);
  // L'indirizzo firmato dura 60 secondi: se il browser lo ha scartato si chiede una sola volta di nuovo.
  const [giaRiprovato, setGiaRiprovato] = useState(false);
  const [erroreIngrandimento, setErroreIngrandimento] = useState(false);

  /** L'ingrandimento chiede un indirizzo NUOVO: quello dell'immagine in pagina può essere scaduto (60 s) e chi guarda
   *  una riga per minuti troverebbe una pagina d'errore. La finestra si apre subito (il browser la permette solo dentro il
   *  clic) e poi riceve l'indirizzo; senza opener, perché l'indirizzo è un altro sito. */
  const ingrandisci = async (indice: number) => {
    setErroreIngrandimento(false);
    const finestra = window.open("", "_blank");
    if (finestra) finestra.opener = null;
    try {
      const nuovi = await leggiRotta<RispostaMiniature>(
        fetchCRM,
        `?lotto=${encodeURIComponent(lotto)}&url=${quattroCifre(indice)}`,
      );
      const url = nuovi[quattroCifre(indice)];
      if (!url) throw new Error("manca");
      if (finestra) finestra.location.href = url;
      else setErroreIngrandimento(true);
    } catch {
      finestra?.close();
      setErroreIngrandimento(true);
    }
  };
  return (
    <div
      className={cn(grande ? "flex flex-col gap-3" : "flex flex-wrap gap-2")}
      aria-busy={caricando}
    >
      {errore && (
        <p role="alert" className="text-[12px] text-rose-700">
          {errore}{" "}
          <button type="button" className="font-medium underline" onClick={riprova}>
            Riprova
          </button>
        </p>
      )}
      {erroreIngrandimento && (
        <p role="alert" className="w-full text-[12px] text-rose-700">
          Non riesco ad aprire lo screenshot a grandezza naturale: riprova.
        </p>
      )}
      {indici.map((i) => {
        const url = urls[quattroCifre(i)];
        const tipo = NOME_TIPO[file.find((f) => f.indice === i)?.tipo || "altro"] ?? "Altro";
        return (
          <figure key={i} className={cn("min-w-0", grande ? "w-full" : "w-24")}>
            {url ? (
              <button
                type="button"
                onClick={() => void ingrandisci(i)}
                title="Apri a grandezza naturale"
                aria-label={`Apri a grandezza naturale: ${tipo.toLowerCase()}`}
                className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <img
                  src={url}
                  alt={`Screenshot: ${tipo.toLowerCase()}`}
                  loading="lazy"
                  onError={() => {
                    if (giaRiprovato) return;
                    setGiaRiprovato(true);
                    riprova();
                  }}
                  className={cn(
                    "w-full bg-slate-100 object-contain object-top",
                    grande ? "max-h-72 lg:max-h-[26rem]" : "h-32",
                  )}
                />
              </button>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-slate-400">
                {caricando ? (
                  <span className="text-[11px]">Carico…</span>
                ) : (
                  <IconaImmagine className="h-4 w-4" aria-hidden />
                )}
              </div>
            )}
            <figcaption className="mt-1 truncate text-[11px] text-slate-500">{tipo}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* ══ 3. L'ANTEPRIMA ════════════════════════════════════════════════════════ */

function Contatore({
  etichetta,
  valore,
  punto,
  attivo,
  onClick,
}: {
  etichetta: string;
  valore: number;
  punto: string;
  attivo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attivo}
      className={cn(
        "flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-colors sm:flex-col sm:items-start sm:py-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        attivo ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-white hover:bg-slate-50",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", punto)} aria-hidden />
        <span className="truncate">{etichetta}</span>
      </span>
      <span className="text-[17px] font-semibold leading-tight tabular-nums text-slate-900 sm:text-[19px]">
        {valore}
      </span>
    </button>
  );
}

function RigaAnteprima({
  riga,
  lotto,
  file,
  confermati,
  numeroEmessa,
  nomeScheda,
  apriMiniature,
  onMiniature,
  onApri,
}: {
  riga: RigaValutata;
  lotto: string;
  file: FileLotto[];
  confermati: string[];
  numeroEmessa?: number;
  nomeScheda: string | null;
  apriMiniature: boolean;
  onMiniature: () => void;
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
    <div className="grid min-w-0 gap-x-3 gap-y-1 md:grid-cols-[2.25rem_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
      <span className="text-[12px] font-semibold tabular-nums text-slate-500 md:pt-0.5">
        <span className="sr-only">Caricamento n. </span>
        {riga.numero}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-slate-900">
          {nomeDellaRiga(riga)}
        </span>
        <span className="block truncate text-[11.5px] tabular-nums text-slate-500">
          {c.codiceFiscale || "Codice fiscale da leggere"}
        </span>
        <span className="block truncate text-[11.5px] text-slate-500">
          {nomeScheda ? `Scheda: ${nomeScheda}` : "Senza scheda"}
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
      <div className="flex items-start gap-1 px-2 py-2">
        {aperta ? (
          <button
            type="button"
            id={`riga-bulk-${riga.idRiga}`}
            onClick={onApri}
            aria-label={`Apri la riga ${riga.numero}: ${nomeDellaRiga(riga)}, ${ETICHETTA_STATO[riga.stato]}`}
            className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {contenuto}
          </button>
        ) : (
          <div className="min-w-0 flex-1 px-1.5 py-1 opacity-80">{contenuto}</div>
        )}
        {aperta && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-11 sm:h-9 w-11 sm:w-9 shrink-0 p-0"
            onClick={onMiniature}
            aria-pressed={apriMiniature}
            aria-label={`${apriMiniature ? "Nascondi" : "Mostra"} gli screenshot della riga ${riga.numero}`}
            title="Gli screenshot di questa riga"
          >
            <IconaImmagine className="h-4 w-4" />
          </Button>
        )}
      </div>
      {apriMiniature && (
        <div className="px-3 pb-3 md:pl-12">
          <Screenshot lotto={lotto} indici={indiciDiRiga(riga.idRiga)} file={file} />
        </div>
      )}
    </li>
  );
}

export function AnteprimaBulk({
  lotto,
  righe,
  file,
  decisioni,
  schede,
  filtro,
  onFiltro,
  pagina,
  onPagina,
  occupato,
  nPronte,
  daLeggere,
  avvisiPerTutte,
  onApri,
  onProssima,
  onConfermaTutte,
  onConfermaAvviso,
  onLeggi,
}: {
  lotto: string;
  righe: RigaValutata[];
  file: FileLotto[];
  decisioni: Record<string, Pick<DecisioniRiga, "confermeAvvisi" | "emessa">>;
  schede: Map<string, string>;
  filtro: FiltroRighe;
  onFiltro: (f: FiltroRighe) => void;
  pagina: number;
  onPagina: (p: number) => void;
  /** C'è già un lavoro in corso: i comandi che ne lanciano un altro restano spenti. */
  occupato: boolean;
  nPronte: number;
  daLeggere: number;
  avvisiPerTutte: { codice: string; testo: string; n: number }[];
  onApri: (idRiga: string) => void;
  onProssima: () => void;
  onConfermaTutte: () => void;
  onConfermaAvviso: (codice: string) => void;
  onLeggi: () => void;
}) {
  const conti = useMemo(() => contaPerStato(righe), [righe]);
  const visibili = useMemo(() => filtraRighe(righe, filtro), [righe, filtro]);
  const pagine = Math.max(1, Math.ceil(visibili.length / RIGHE_PER_PAGINA));
  const paginaOk = Math.min(pagina, pagine - 1);
  const dellaPagina = visibili.slice(
    paginaOk * RIGHE_PER_PAGINA,
    (paginaOk + 1) * RIGHE_PER_PAGINA,
  );
  const [conMiniature, setConMiniature] = useState<Set<string>>(new Set());
  const nOrdineDiverso = useMemo(
    () => righe.filter((r) => r.motivi.some((m) => m.codice === "ordine_diverso")).length,
    [righe],
  );

  const alternaMiniature = (id: string) =>
    setConMiniature((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 sm:pb-0">
        <Contatore
          etichetta="Tutte"
          valore={conti.tutte}
          punto="bg-slate-400"
          attivo={filtro === "tutte"}
          onClick={() => onFiltro("tutte")}
        />
        <Contatore
          etichetta="Pronte"
          valore={conti.pronto}
          punto="bg-emerald-500"
          attivo={filtro === "pronto"}
          onClick={() => onFiltro("pronto")}
        />
        <Contatore
          etichetta="Da controllare"
          valore={conti.da_controllare}
          punto="bg-amber-500"
          attivo={filtro === "da_controllare"}
          onClick={() => onFiltro("da_controllare")}
        />
        <Contatore
          etichetta="Errori"
          valore={conti.errore}
          punto="bg-rose-500"
          attivo={filtro === "errore"}
          onClick={() => onFiltro("errore")}
        />
        <Contatore
          etichetta="Confermate"
          valore={conti.confermata}
          punto="bg-sky-500"
          attivo={filtro === "confermata"}
          onClick={() => onFiltro("confermata")}
        />
      </div>
      {(conti.emessa > 0 || conti.scartata > 0) && (
        <p className="text-[11.5px] text-slate-500">
          {conti.emessa > 0 && `${conti.emessa} già emesse`}
          {conti.emessa > 0 && conti.scartata > 0 && " · "}
          {conti.scartata > 0 && `${conti.scartata} scartate`}
        </p>
      )}

      {daLeggere > 0 && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {daLeggere === 1
                ? "Un cliente non è ancora stato letto."
                : `${daLeggere} clienti non sono ancora stati letti.`}{" "}
              Quelli già letti non si pagano di nuovo.
            </span>
            <Button
              type="button"
              size="sm"
              className="h-11 sm:h-9"
              onClick={onLeggi}
              disabled={occupato}
            >
              Riprendi la lettura
            </Button>
          </span>
        </NotaFinestra>
      )}

      {nOrdineDiverso >= 3 && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          In {nOrdineDiverso} gruppi su {conti.tutte} l&apos;ordine degli screenshot è diverso dal
          solito (indirizzo, tessera, pagamento). Si leggono lo stesso, ma ogni riga va confermata:
          controlla che le tre immagini siano della stessa persona.
        </NotaFinestra>
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
              ? "Nessun cliente ancora: aspetta che finisca la lettura."
              : "Nessuna riga in questo gruppo."
          }
        />
      ) : (
        <section
          aria-label="Un cliente per riga, nell'ordine di caricamento"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div
            aria-hidden
            className="hidden border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[2.25rem_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)] md:gap-x-3 md:pr-14"
          >
            <span>N.</span>
            <span>Cliente</span>
            <span>Indirizzo</span>
            <span>Pagamento</span>
            <span>Stato</span>
          </div>
          <ul>
            {dellaPagina.map((r) => (
              <RigaAnteprima
                key={r.idRiga}
                riga={r}
                lotto={lotto}
                file={file}
                confermati={decisioni[r.idRiga]?.confermeAvvisi ?? []}
                numeroEmessa={decisioni[r.idRiga]?.emessa?.numero}
                nomeScheda={r.scheda ? (schede.get(r.scheda) ?? "scheda non trovata") : null}
                apriMiniature={conMiniature.has(r.idRiga)}
                onMiniature={() => alternaMiniature(r.idRiga)}
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
