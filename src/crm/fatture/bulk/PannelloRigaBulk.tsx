/** ── FATTURE BULK · LA RIGA APERTA (PannelloRigaBulk.tsx) ─────────────────
 *  Commessa 2026-11-12-fatture-bulk, T13. A sinistra i tre screenshot, a destra
 *  i campi da correggere. Appena si cambia un campo la rotta salva e le regole
 *  (T10) ricalcolano lo stato: qui non si ricalcola niente.
 *
 *  ⚠️ I SALVATAGGI SONO UNO ALLA VOLTA PER RIGA (lo garantisce `salvaRiga` di
 *   usa-lotto.ts). Qui però si manda una cosa per richiesta: un campo, oppure la
 *   scheda, oppure una conferma. La rotta rifiuta (400) una correzione mandata
 *   insieme a una conferma, perché chi conferma non ha visto l'effetto della
 *   correzione.
 *  ⚠️ Un campo si salva quando si esce dal campo, non a ogni tasto: l'AI ha già
 *   fatto il grosso, qui si ritocca.
 *  ⚠️ Il codice fiscale letto con il carattere finale sbagliato NON entra nel
 *   campo (resta vuoto). Sotto si mostra com'è stato letto, per correggerlo
 *   guardando lo screenshot invece di ribattere 16 caratteri. */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  RefreshCw,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { leggiEuro } from "@/crm/euro";
import { CLASSE_CAMPO, CampoFinestra, NotaFinestra } from "@/crm/ui/Finestra";
import { SceltaModoIncasso } from "../SceltaModoIncasso";
import type { MetodoPagamento } from "../modi-di-incasso";
import {
  BadgeStato,
  Screenshot,
  indiciDiRiga,
  nomeDellaRiga,
  euroEsatti,
  dataItaliana,
} from "./AnteprimaBulk";
import type {
  CampiRiga,
  DecisioniRiga,
  FileLotto,
  LetturaTessera,
  Motivo,
  RigaValutata,
  SchedaPerAbbinamento,
} from "./tipi";

/** Una cosa sola per richiesta (vedi la nota in cima). */
export type CambioRiga = {
  modifiche?: Partial<CampiRiga>;
  scheda?: string | null;
  confermaRiga?: boolean;
  confermaAvvisi?: string[];
  scarta?: boolean;
};

/* ══ 1. L'IMPORTO SCRITTO A MANO ═══════════════════════════════════════════ */

/** «1.250,00», «1250», «12,5», «€ 99»: sì. «1e3», «12,345», lettere: no. È l'unico controllo sull'input libero:
 *  `leggiEuro("1e3")` darebbe 13 senza dire niente, e su un documento fiscale non si indovina. */
export function leggiImportoScritto(
  testo: string,
): { ok: true; valore: number | null } | { ok: false; messaggio: string } {
  const s = testo.replace(/€/g, "").replace(/\s/g, "");
  if (s === "") return { ok: true, valore: null };
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$|^\d+\.\d{1,2}$/.test(s))
    return { ok: false, messaggio: "Scrivi l'importo in euro, per esempio 1.250,00." };
  const valore = Math.round(leggiEuro(s) * 100) / 100;
  if (valore > 1_000_000)
    return { ok: false, messaggio: "L'importo è troppo grande: controlla le cifre." };
  return { ok: true, valore };
}

const importoScritto = (n: number | null): string =>
  n === null
    ? ""
    : n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ══ 2. I CAMPI ════════════════════════════════════════════════════════════ */

function CampoTesto({
  etichetta,
  valore,
  onSalva,
  disabilitato,
  invalido,
  trasforma,
  tipo = "text",
  maxLength,
  inputMode,
  nota,
  className,
  convalida,
}: {
  etichetta: string;
  valore: string;
  /** Riceve il testo già ripulito. Ritorna dopo il salvataggio. */
  onSalva: (v: string) => void;
  disabilitato?: boolean;
  invalido?: boolean;
  trasforma?: (v: string) => string;
  tipo?: "text" | "date";
  maxLength?: number;
  inputMode?: "numeric" | "decimal" | "text";
  nota?: React.ReactNode;
  className?: string;
  convalida?: (v: string) => string | null;
}) {
  const [bozza, setBozza] = useState(valore);
  const [errore, setErrore] = useState<string | null>(null);
  // Il valore che torna dal server (ripulito, o cambiato altrove) sostituisce la bozza.
  useEffect(() => {
    setBozza(valore);
    setErrore(null);
  }, [valore]);
  const id = useId();

  const conferma = (v: string) => {
    const pulito = v.trim();
    if (pulito === valore.trim()) return;
    const problema = convalida?.(pulito) ?? null;
    setErrore(problema);
    if (!problema) onSalva(pulito);
  };

  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wide text-slate-500"
      >
        {etichetta}
      </label>
      <Input
        id={id}
        type={tipo}
        value={bozza}
        disabled={disabilitato}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={invalido || !!errore}
        aria-describedby={errore ? `${id}-e` : nota ? `${id}-n` : undefined}
        onChange={(e) => {
          const v = trasforma ? trasforma(e.target.value) : e.target.value;
          setBozza(v);
          // La data si sceglie da un calendario: si salva appena è completa.
          if (tipo === "date" && (v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v))) conferma(v);
        }}
        onBlur={() => tipo !== "date" && conferma(bozza)}
        onKeyDown={(e) => e.key === "Enter" && tipo !== "date" && conferma(bozza)}
        className={cn(
          CLASSE_CAMPO,
          "mt-1.5 w-full",
          (invalido || errore) && "border-rose-400 focus-visible:ring-rose-300",
        )}
      />
      {errore ? (
        <p id={`${id}-e`} role="alert" className="mt-1 text-[11.5px] text-rose-700">
          {errore}
        </p>
      ) : nota ? (
        <p id={`${id}-n`} className="mt-1 text-[11.5px] leading-snug text-slate-500">
          {nota}
        </p>
      ) : null}
    </div>
  );
}

const normalizza = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function SceltaScheda({
  corrente,
  schede,
  disabilitato,
  onScegli,
  onApri,
}: {
  corrente: string | null;
  schede: SchedaPerAbbinamento[];
  disabilitato?: boolean;
  onScegli: (id: string | null) => void;
  onApri: (id: string) => void;
}) {
  const [cerca, setCerca] = useState(false);
  const [q, setQ] = useState("");
  const attuale = corrente ? schede.find((s) => s.id === corrente) : undefined;
  const trovate = useMemo(() => {
    const t = normalizza(q.trim());
    if (t.length < 2) return [];
    return schede
      .filter((s) => normalizza(`${s.nome} ${s.cognome} ${s.codiceFiscale}`).includes(t))
      .slice(0, 6);
  }, [q, schede]);

  return (
    <CampoFinestra etichetta="Scheda cliente collegata">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900">
          {corrente === null
            ? "Nessuna: la fattura esce senza scheda"
            : attuale
              ? `${attuale.nome} ${attuale.cognome}`.trim()
              : "Scheda non trovata"}
        </span>
        {corrente && attuale && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => onApri(corrente)}
          >
            Apri scheda
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={disabilitato}
          aria-expanded={cerca}
          onClick={() => setCerca((v) => !v)}
        >
          Cambia
        </Button>
      </div>
      {cerca && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca per nome, cognome o codice fiscale"
            aria-label="Cerca la scheda del cliente"
            className={cn(CLASSE_CAMPO, "w-full")}
          />
          <ul className="space-y-1">
            {trovate.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={disabilitato}
                  onClick={() => {
                    onScegli(s.id);
                    setCerca(false);
                    setQ("");
                  }}
                  className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-[13px] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <span className="truncate">{`${s.nome} ${s.cognome}`.trim()}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500">
                    {s.codiceFiscale}
                  </span>
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && trovate.length === 0 && (
              <li className="px-2 py-1.5 text-[12px] text-slate-500">Nessuna scheda trovata.</li>
            )}
          </ul>
          <button
            type="button"
            disabled={disabilitato || corrente === null}
            onClick={() => {
              onScegli(null);
              setCerca(false);
            }}
            className="min-h-10 w-full rounded-lg border border-dashed border-slate-300 px-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Nessuna scheda: fattura senza scheda
          </button>
        </div>
      )}
    </CampoFinestra>
  );
}

/* ══ 3. IL PANNELLO ════════════════════════════════════════════════════════ */

const ICONA_GRAVITA = {
  blocca: { icona: XCircle, classe: "text-rose-600" },
  conferma: { icona: AlertTriangle, classe: "text-amber-600" },
  avviso: { icona: Info, classe: "text-slate-400" },
} as const;

export function PannelloRigaBulk({
  riga,
  posizione,
  totale,
  lotto,
  file,
  decisione,
  schede,
  occupato,
  nPerAvviso,
  onSalva,
  onRileggi,
  onConfermaPerTutte,
  onApriScheda,
  onIndietro,
  onPrecedente,
  onSuccessiva,
  onProssima,
}: {
  riga: RigaValutata;
  /** 1-based, nell'elenco che si sta scorrendo. */
  posizione: number;
  totale: number;
  lotto: string;
  /** Tutti i file del lotto (il pannello prende i suoi). */
  file: FileLotto[];
  decisione: DecisioniRiga | undefined;
  schede: SchedaPerAbbinamento[];
  /** Un altro lavoro è in corso: si guarda, non si tocca. */
  occupato: boolean;
  /** Quante righe aperte hanno ancora da confermare questo codice (solo per i codici ammessi). */
  nPerAvviso: (codice: string) => number;
  onSalva: (cambio: CambioRiga) => Promise<boolean>;
  onRileggi: (indici: number[]) => void;
  onConfermaPerTutte: (codice: string) => void;
  onApriScheda: (id: string) => void;
  onIndietro: () => void;
  onPrecedente: (() => void) | null;
  onSuccessiva: (() => void) | null;
  onProssima: (() => void) | null;
}) {
  const titolo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titolo.current?.focus(), []);
  const [scarto, setScarto] = useState(false);
  const [lavorando, setLavorando] = useState(false);
  const indici = useMemo(() => indiciDiRiga(riga.idRiga), [riga.idRiga]);
  const suoi = file.filter((f) => indici.includes(f.indice));
  const c = riga.campi;
  const confermati = decisione?.confermeAvvisi ?? [];
  const fermo = occupato || lavorando;

  // Il codice fiscale com'è stato letto, se non è quello che c'è nel campo (di solito: il carattere finale non torna).
  const cfLetto = useMemo(() => {
    const t = suoi.map((f) => f.lettura).find((l): l is LetturaTessera => l?.tipo === "tessera");
    const letto = t?.cfLetto?.trim() ?? "";
    return letto && letto !== c.codiceFiscale ? letto : "";
  }, [suoi, c.codiceFiscale]);

  const invalidi = new Set(
    riga.motivi.filter((m) => m.gravita === "blocca" && m.campo).map((m) => m.campo),
  );
  const bloccanti = riga.motivi.filter((m) => m.gravita === "blocca");
  const daConfermare = riga.motivi.filter(
    (m) => m.gravita === "conferma" && !confermati.includes(m.codice),
  );

  const salva = async (cambio: CambioRiga) => {
    setLavorando(true);
    try {
      return await onSalva(cambio);
    } finally {
      setLavorando(false);
    }
  };
  const campo = (nome: keyof CampiRiga) => (v: string) => void salva({ modifiche: { [nome]: v } });

  const [rif, setRif] = useState(c.riferimento);
  useEffect(() => setRif(c.riferimento), [c.riferimento]);

  const azioneMotivo = (m: Motivo) => {
    if (m.gravita !== "conferma" || confermati.includes(m.codice)) return null;
    const n = nPerAvviso(m.codice);
    return (
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          disabled={fermo}
          onClick={() => void salva({ confermaAvvisi: [m.codice] })}
        >
          <Check className="mr-1 h-3.5 w-3.5" /> Confermo così
        </Button>
        {n >= 2 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            disabled={fermo}
            onClick={() => onConfermaPerTutte(m.codice)}
          >
            Conferma questo avviso per tutte ({n})
          </Button>
        )}
      </div>
    );
  };

  const confermata = riga.stato === "confermata";
  const soloConferme = bloccanti.length === 0 && daConfermare.length > 0 && riga.stato !== "errore";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={onIndietro}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Torna all&apos;elenco
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="h-9 w-9 p-0"
            disabled={!onPrecedente}
            onClick={() => onPrecedente?.()}
            aria-label="Riga precedente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-1 text-[12px] tabular-nums text-slate-500" aria-live="polite">
            {posizione} di {totale}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-9 p-0"
            disabled={!onSuccessiva}
            onClick={() => onSuccessiva?.()}
            aria-label="Riga successiva"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {onProssima && (
            <Button type="button" variant="outline" className="h-9" onClick={onProssima}>
              Prossima da controllare
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h3
          ref={titolo}
          tabIndex={-1}
          className="text-[15px] font-semibold text-slate-900 outline-none"
        >
          Riga {riga.numero} · {nomeDellaRiga(riga)}
        </h3>
        <BadgeStato stato={riga.stato} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section aria-label="Gli screenshot di questo cliente">
          <Screenshot lotto={lotto} indici={indici} file={file} grande />
          <p className="mt-2 text-[11.5px] text-slate-500">
            Tocca uno screenshot per vederlo a grandezza naturale.
          </p>
        </section>

        <section aria-label="I dati della riga" className="min-w-0 space-y-4">
          {riga.motivi.length > 0 ? (
            <ul className="space-y-2" aria-label="Cosa c'è da sapere su questa riga">
              {riga.motivi.map((m) => {
                const { icona: Icona, classe } = ICONA_GRAVITA[m.gravita];
                const fatto = m.gravita === "conferma" && confermati.includes(m.codice);
                return (
                  <li
                    key={m.codice}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      {fatto ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <Icona className={cn("mt-0.5 h-4 w-4 shrink-0", classe)} aria-hidden />
                      )}
                      <p className="text-[12.5px] leading-snug text-slate-800">
                        {m.testo}
                        {fatto && (
                          <span className="ml-1 font-medium text-emerald-700">Confermato.</span>
                        )}
                      </p>
                    </div>
                    {azioneMotivo(m)}
                  </li>
                );
              })}
            </ul>
          ) : (
            <NotaFinestra tono="conferma" icona={Check}>
              Tutti i dati ci sono e tornano fra loro.
            </NotaFinestra>
          )}

          <div className="grid grid-cols-2 gap-3">
            <CampoTesto
              etichetta="Nome"
              valore={c.nome}
              onSalva={campo("nome")}
              disabilitato={fermo}
              invalido={invalidi.has("nome")}
            />
            <CampoTesto
              etichetta="Cognome"
              valore={c.cognome}
              onSalva={campo("cognome")}
              disabilitato={fermo}
              invalido={invalidi.has("cognome")}
            />
            <CampoTesto
              className="col-span-2"
              etichetta="Codice fiscale"
              valore={c.codiceFiscale}
              onSalva={campo("codiceFiscale")}
              disabilitato={fermo}
              invalido={invalidi.has("codiceFiscale")}
              maxLength={16}
              trasforma={(v) => v.toUpperCase().replace(/\s/g, "")}
              nota={
                cfLetto ? (
                  <>
                    Letto dallo screenshot:{" "}
                    <span className="font-semibold tabular-nums text-slate-800">{cfLetto}</span>.
                    L&apos;ultimo carattere non torna, quindi non l&apos;ho messo in fattura: guarda
                    la tessera e correggi.
                  </>
                ) : undefined
              }
            />
            <CampoTesto
              className="col-span-2"
              etichetta="Indirizzo (residenza)"
              valore={c.indirizzo}
              onSalva={campo("indirizzo")}
              disabilitato={fermo}
              invalido={invalidi.has("indirizzo")}
            />
            <CampoTesto
              etichetta="CAP"
              valore={c.cap}
              onSalva={campo("cap")}
              disabilitato={fermo}
              invalido={invalidi.has("cap")}
              maxLength={5}
              inputMode="numeric"
              trasforma={(v) => v.replace(/\D/g, "")}
            />
            <CampoTesto
              etichetta="Provincia"
              valore={c.provincia}
              onSalva={campo("provincia")}
              disabilitato={fermo}
              invalido={invalidi.has("provincia")}
              maxLength={2}
              trasforma={(v) => v.toUpperCase().replace(/[^A-Z]/g, "")}
            />
            <CampoTesto
              className="col-span-2"
              etichetta="Comune"
              valore={c.comune}
              onSalva={campo("comune")}
              disabilitato={fermo}
              invalido={invalidi.has("comune")}
            />
            <CampoTesto
              etichetta="Importo pagato (IVA compresa)"
              valore={importoScritto(c.importo)}
              inputMode="decimal"
              disabilitato={fermo}
              invalido={invalidi.has("importo")}
              convalida={(v) => {
                const r = leggiImportoScritto(v);
                return r.ok ? null : r.messaggio;
              }}
              onSalva={(v) => {
                const r = leggiImportoScritto(v);
                if (r.ok) void salva({ modifiche: { importo: r.valore } });
              }}
            />
            <CampoTesto
              etichetta="Data del pagamento"
              tipo="date"
              valore={c.data}
              onSalva={campo("data")}
              disabilitato={fermo}
              invalido={invalidi.has("data")}
            />
          </div>

          <div
            onBlur={() =>
              rif.trim() !== c.riferimento.trim() &&
              void salva({ modifiche: { riferimento: rif.trim() } })
            }
          >
            <SceltaModoIncasso
              metodo={c.modo || null}
              onMetodo={(m: MetodoPagamento) =>
                m !== c.modo && void salva({ modifiche: { modo: m } })
              }
              riferimento={rif}
              onRiferimento={setRif}
            />
            {invalidi.has("modo") && (
              <p className="mt-1 text-[11.5px] text-rose-700">Scegli come ha pagato.</p>
            )}
          </div>

          <SceltaScheda
            corrente={riga.scheda}
            schede={schede}
            disabilitato={fermo}
            onScegli={(id) => void salva({ scheda: id })}
            onApri={onApriScheda}
          />

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px]">
            <dt className="text-slate-500">Importo pagato</dt>
            <dd className="text-right font-semibold tabular-nums text-slate-900">
              {euroEsatti(c.importo)}
            </dd>
            {riga.fattura && (
              <>
                <dt className="text-slate-500">Imponibile</dt>
                <dd className="text-right tabular-nums text-slate-700">
                  {euroEsatti(riga.fattura.imponibile)}
                </dd>
                <dt className="text-slate-500">IVA</dt>
                <dd className="text-right tabular-nums text-slate-700">
                  {euroEsatti(riga.fattura.imposta)}
                </dd>
                <dt className="text-slate-500">Totale in fattura</dt>
                <dd className="text-right tabular-nums text-slate-700">
                  {euroEsatti(riga.fattura.totale)}
                </dd>
              </>
            )}
            {riga.totaleNelFile !== undefined &&
              riga.fattura &&
              riga.totaleNelFile !== riga.fattura.totale && (
                <>
                  <dt className="text-slate-500">Totale nel file XML</dt>
                  <dd className="text-right tabular-nums text-amber-800">
                    {euroEsatti(riga.totaleNelFile)}
                  </dd>
                </>
              )}
            <dt className="text-slate-500">Data del documento</dt>
            <dd className="text-right tabular-nums text-slate-700">{dataItaliana(c.data)}</dd>
            {riga.ultimoGiornoUtile && (
              <>
                <dt className="text-slate-500">Ultimo giorno utile (stima)</dt>
                <dd className="text-right tabular-nums text-slate-700">
                  {dataItaliana(riga.ultimoGiornoUtile)}
                </dd>
              </>
            )}
          </dl>
          <p className="text-[11.5px] leading-snug text-slate-500">
            Ogni pagamento è fatturato per intero. L&apos;indirizzo letto è trattato come residenza.
          </p>
        </section>
      </div>

      {/* Le azioni stanno in fondo e restano a portata di pollice mentre si scorrono i campi. */}
      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        {scarto ? (
          <div
            role="group"
            aria-label="Conferma lo scarto"
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-[12.5px] text-slate-700">
              Scarto questa riga? Gli screenshot vengono cancellati e non si torna indietro.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                onClick={() => setScarto(false)}
              >
                Lascia stare
              </Button>
              <Button
                type="button"
                className="h-9 bg-rose-600 hover:bg-rose-700"
                disabled={fermo}
                onClick={async () => {
                  if (await salva({ scarta: true })) onIndietro();
                  else setScarto(false);
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Sì, scarta
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={fermo}
                onClick={() => onRileggi(indici)}
                title="Richiama l'intelligenza artificiale su questi screenshot: si paga di nuovo"
              >
                <RefreshCw className="mr-1.5 h-4 w-4" /> Rileggi
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={fermo}
                onClick={() => setScarto(true)}
              >
                <Ban className="mr-1.5 h-4 w-4" /> Scarta
              </Button>
            </div>
            {confermata ? (
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={fermo}
                onClick={() => void salva({ confermaRiga: false })}
              >
                Togli la conferma
              </Button>
            ) : soloConferme ? (
              <Button
                type="button"
                className="h-9"
                disabled={fermo}
                onClick={async () => {
                  // Due richieste, una dopo l'altra: gli avvisi, poi la riga.
                  if (await salva({ confermaAvvisi: daConfermare.map((m) => m.codice) }))
                    await salva({ confermaRiga: true });
                }}
              >
                <Check className="mr-1.5 h-4 w-4" /> Confermo così e conferma la riga
              </Button>
            ) : (
              <Button
                type="button"
                className="h-9"
                disabled={fermo || riga.stato !== "pronto"}
                title={
                  riga.stato === "pronto"
                    ? undefined
                    : "Prima sistema ciò che è segnalato qui sopra"
                }
                onClick={() => void salva({ confermaRiga: true })}
              >
                <Check className="mr-1.5 h-4 w-4" /> Conferma la riga
              </Button>
            )}
          </div>
        )}
        {riga.stato === "errore" && !scarto && (
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-slate-600">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Una riga in errore si può rileggere, correggere a mano oppure scartare.
          </p>
        )}
      </div>
    </div>
  );
}
