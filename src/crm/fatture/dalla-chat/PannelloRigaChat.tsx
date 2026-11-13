/** ── FATTURE DALLA CHAT · T8/T17 · LA RIGA APERTA (PannelloRigaChat.tsx) ────
 *  Commessa 2026-11-13-fatture-dalla-chat, T8 (SPEC §3 passo 3-4, §6.3-§6.5) +
 *  T17 (collaudo T9, SPEC §9.3 passo 7/§9.7 criterio 3). Mirror di
 *  `bulk/PannelloRigaBulk.tsx`, con quattro differenze reali:
 *   1. Le miniature di tessera/indirizzo vengono dalla chat (`?miniatura=
 *      tessera|indirizzo&idRiga=…`), e si vedono SOLO quando la riga porta
 *      davvero la provenienza (`tesseraImmagine`/`indirizzoImmagine`, PIANO
 *      §0bis.1/T11): finché T11 non è stato integrato, o quando il campo è
 *      stato letto da testo o scritto a mano, non c'è nessuna miniatura — non
 *      è un buco, è la verità (PIANO §4, T8).
 *   2. La scheda non si cambia mai (SPEC §5, «l'abbinamento non si indovina,
 *      è già dato»): qui c'è solo «Apri scheda», non «Cambia».
 *   3. Il bonifico è UN file solo, non tre: «Carica/Cambia screenshot» al
 *      posto dei tre screenshot della bulk.
 *   4. (T17) Lo screenshot è FACOLTATIVO qui: finché `pagamento.lettura` non
 *      c'è, un tasto «Salva pagamento» chiama `scrivi-pagamento` (T11.2) coi
 *      4 campi di correzione QUI SOTTO (importo/data/modo/riferimento) —
 *      GLI STESSI della bulk, non duplicati: sono «le modifiche» che già
 *      finiscono in `CampiRiga` (vedi `corpoPagamentoManuale`,
 *      `usa-lotto-chat.ts`); la decisione di riusarli, non duplicarli, è in
 *      LAVAGNA (T17). Il collaudo di T9 aveva trovato che scriverli da soli
 *      NON sblocca la riga (nessun componente chiamava `scrivi-pagamento`):
 *      questo è il punto che T17 chiude.
 *
 *  ⚠️ I SALVATAGGI SONO UNO ALLA VOLTA PER RIGA (lo garantisce `salvaRiga` di
 *   `usa-lotto-chat.ts`): qui si manda una cosa per richiesta, come nella
 *   bulk (`controllaCambio`, import — stesso file, stessa regola). */
import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Image as IconaImmagine,
  Info,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchCRM } from "@/crm/AuthContext";
import { CLASSE_CAMPO, CampoFinestra, NotaFinestra } from "@/crm/ui/Finestra";
import { SceltaModoIncasso } from "../SceltaModoIncasso";
import type { MetodoPagamento } from "../modi-di-incasso";
import { controllaFile } from "../bulk/immagini";
import { controllaCambio, type CambioRiga } from "../bulk/cambio-riga";
import { leggiImportoScritto } from "../bulk/PannelloRigaBulk";
import { BadgeStato, dataItaliana, euroEsatti, nomeDellaRiga } from "../bulk/AnteprimaBulk";
import { ErroreRotta } from "../bulk/usa-lotto";
import { corpoPagamentoManuale, leggiRottaChat } from "./usa-lotto-chat";
import type { CampiRiga, Motivo, RigaValutata } from "../bulk/tipi";
import type { LetturaChat, RigaChat } from "./tipi";

/* ══ 1. LA MINIATURA (chat: tessera/indirizzo/pagamento, su richiesta) ═════ */

/** `LetturaChat` è congelata da T0 (campi oltre a quelli già esistenti arrivano
 *  da T11, PIANO §0bis.1): questa estensione LOCALE non li aggiunge al tipo
 *  condiviso, legge solo in sola lettura, con `as` se T11 non è ancora atterrato
 *  — in quel caso le due proprietà sono `undefined` e nessuna miniatura si mostra
 *  (vedi l'intestazione del file). */
interface LetturaChatConProvenienza extends LetturaChat {
  tesseraImmagine?: number;
  indirizzoImmagine?: number;
}

type TipoMiniatura = "tessera" | "indirizzo" | "pagamento";

/** Stesso principio di `useUrlFirmati` nella bulk, contratto diverso (per
 *  `idRiga`+`tipo`, non per indice di file). */
function useMiniaturaChat(lotto: string, idRiga: string, tipo: TipoMiniatura, attivo: boolean) {
  const chiave = `${tipo}:${idRiga}`;
  const [esito, setEsito] = useState<{
    chiave: string;
    url: string | null;
    errore: string | null;
    caricando: boolean;
  }>({ chiave: "", url: null, errore: null, caricando: false });
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    if (!attivo || !lotto || !idRiga) return;
    let vivo = true;
    setEsito((e) => ({ ...e, caricando: true, errore: null }));
    leggiRottaChat<Record<string, string>>(
      fetchCRM,
      `?lotto=${encodeURIComponent(lotto)}&miniatura=${tipo}&idRiga=${encodeURIComponent(idRiga)}`,
    )
      .then(
        (urls) =>
          vivo && setEsito({ chiave, url: urls[idRiga] ?? null, errore: null, caricando: false }),
      )
      .catch((e: unknown) => {
        if (!vivo) return;
        const messaggio =
          e instanceof ErroreRotta ? e.messaggio : "Non riesco a caricare lo screenshot.";
        setEsito({ chiave, url: null, errore: messaggio, caricando: false });
      });
    return () => {
      vivo = false;
    };
  }, [lotto, idRiga, tipo, attivo, tentativo]);

  return {
    url: esito.chiave === chiave ? esito.url : null,
    errore: esito.chiave === chiave ? esito.errore : null,
    caricando: esito.caricando,
    riprova: () => setTentativo((t) => t + 1),
  };
}

const NOME_MINIATURA: Record<TipoMiniatura, string> = {
  tessera: "Tessera sanitaria",
  indirizzo: "Indirizzo",
  pagamento: "Pagamento",
};

function MiniaturaChat({
  lotto,
  idRiga,
  tipo,
}: {
  lotto: string;
  idRiga: string;
  tipo: TipoMiniatura;
}) {
  const { url, errore, caricando, riprova } = useMiniaturaChat(lotto, idRiga, tipo, true);
  const nome = NOME_MINIATURA[tipo];
  return (
    <figure className="w-full min-w-0">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Apri a grandezza naturale"
          aria-label={`Apri a grandezza naturale: ${nome.toLowerCase()}`}
          className="block overflow-hidden rounded-lg border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <img
            src={url}
            alt={`Screenshot: ${nome.toLowerCase()}`}
            loading="lazy"
            className="max-h-56 w-full bg-slate-100 object-contain object-top"
          />
        </a>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-slate-400">
          {caricando ? (
            <span className="text-[11px]">Carico…</span>
          ) : (
            <IconaImmagine className="h-4 w-4" aria-hidden />
          )}
        </div>
      )}
      {errore && (
        <p role="alert" className="mt-1 text-[11.5px] text-rose-700">
          {errore}{" "}
          <button type="button" className="font-medium underline" onClick={riprova}>
            Riprova
          </button>
        </p>
      )}
      <figcaption className="mt-1 truncate text-[11px] text-slate-500">{nome}</figcaption>
    </figure>
  );
}

/* ══ 2. L'IMPORTO SCRITTO A MANO (stessa stringa di PannelloRigaBulk) ══════ */

const importoScritto = (n: number | null): string =>
  n === null
    ? ""
    : n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ══ 3. UN CAMPO DI TESTO (stesso schema di PannelloRigaBulk, non esportato
 *  da lì: duplicazione minima di plumbing, stessa disciplina già scelta in
 *  questa commessa per `leggiRisposta`/`conRete`, T5/T7 — non vale la pena
 *  toccare un file della bulk per un componente di quattro righe). ═══════ */

function CampoTesto({
  etichetta,
  valore,
  onSalva,
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
  onSalva: (v: string) => void;
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
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={invalido || !!errore}
        aria-describedby={errore ? `${id}-e` : nota ? `${id}-n` : undefined}
        onChange={(e) => {
          const v = trasforma ? trasforma(e.target.value) : e.target.value;
          setBozza(v);
          if (tipo === "date" && (v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v))) conferma(v);
        }}
        onBlur={() => tipo !== "date" && conferma(bozza)}
        onKeyDown={(e) => e.key === "Enter" && tipo !== "date" && conferma(bozza)}
        className={cn(
          CLASSE_CAMPO,
          "mt-1.5 h-11 w-full sm:h-9",
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

/* ══ 4. IL PANNELLO ════════════════════════════════════════════════════════ */

const ICONA_GRAVITA = {
  blocca: { icona: XCircle, classe: "text-rose-600" },
  conferma: { icona: AlertTriangle, classe: "text-amber-600" },
  avviso: { icona: Info, classe: "text-slate-400" },
} as const;

export function PannelloRigaChat({
  riga,
  rigaChat,
  posizione,
  totale,
  lotto,
  nomeScheda,
  occupato,
  nPerAvviso,
  onSalva,
  onCaricaPagamento,
  onScriviPagamento,
  onRileggiPagamento,
  onRileggiChat,
  onConfermaPerTutte,
  onApriScheda,
  onIndietro,
  onPrecedente,
  onSuccessiva,
  onProssima,
}: {
  riga: RigaValutata;
  /** La parte «grezza» di questa riga (chat letta, pagamento): non c'è in
   *  `RigaValutata` (che porta solo i campi effettivi e lo stato). */
  rigaChat: RigaChat | undefined;
  posizione: number;
  totale: number;
  lotto: string;
  nomeScheda: string;
  occupato: boolean;
  nPerAvviso: (codice: string) => number;
  onSalva: (cambio: CambioRiga) => Promise<boolean>;
  onCaricaPagamento: (file: File) => Promise<boolean>;
  /** Via 2 (T17, SPEC §9.3 passo 7/§9.7 criterio 3): i 4 campi scritti a mano, screenshot
   *  facoltativo — vedi `corpoPagamentoManuale` sul perché sono gli stessi campi qui sotto. */
  onScriviPagamento: (corpo: {
    importo: number;
    data: string;
    modo: string;
    riferimento: string;
  }) => Promise<boolean>;
  onRileggiPagamento: () => void;
  onRileggiChat: () => void;
  onConfermaPerTutte: (codice: string) => void;
  onApriScheda: () => void;
  onIndietro: () => void;
  onPrecedente: (() => void) | null;
  onSuccessiva: (() => void) | null;
  onProssima: (() => void) | null;
}) {
  const titolo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titolo.current?.focus(), []);
  const [scarto, setScarto] = useState(false);
  const [lavorando, setLavorando] = useState(false);
  const c = riga.campi;
  const confermati = rigaChat?.confermeAvvisi ?? [];
  const fermo = occupato || lavorando;

  const chat = rigaChat?.chat as LetturaChatConProvenienza | undefined;
  const pagamento = rigaChat?.pagamento;

  const invalidi = new Set(
    riga.motivi.filter((m) => m.gravita === "blocca" && m.campo).map((m) => m.campo),
  );
  const bloccanti = riga.motivi.filter((m) => m.gravita === "blocca");
  const daConfermare = riga.motivi.filter(
    (m) => m.gravita === "conferma" && !confermati.includes(m.codice),
  );

  const salva = async (cambio: CambioRiga) => {
    const problema = controllaCambio(cambio);
    if (problema) throw new Error(problema);
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

  const inputFile = useRef<HTMLInputElement>(null);
  const [caricandoFile, setCaricandoFile] = useState(false);
  const sceltoFile = async (file: File | undefined) => {
    if (!file) return;
    const controllo = controllaFile(file);
    if (!controllo.ok) {
      setErroreFile(controllo.motivo);
      return;
    }
    setErroreFile(null);
    setCaricandoFile(true);
    try {
      await onCaricaPagamento(file);
    } finally {
      setCaricandoFile(false);
    }
  };
  const [erroreFile, setErroreFile] = useState<string | null>(null);

  /** Via 2 (T17): «Salva pagamento» riusa i 4 campi di correzione qui sotto (già scritti a
   *  mano, già salvati come `modifiche` dal loro stesso `onBlur`): niente campi nuovi da
   *  duplicare (vedi LAVAGNA). `corpoPagamentoManuale` è il solo cancello client (per non
   *  spendere una richiesta a vuoto): il controllo vero resta lato server. */
  const corpoPagamento = corpoPagamentoManuale(c);
  const [inviandoPagamento, setInviandoPagamento] = useState(false);
  const salvaPagamento = async () => {
    // Guardia sul tasto: niente doppio invio, né per un doppio clic né mentre un'altra
    // operazione sulla riga è già in corso.
    if (inviandoPagamento || fermo || !corpoPagamento) return;
    setInviandoPagamento(true);
    try {
      await onScriviPagamento(corpoPagamento);
    } finally {
      setInviandoPagamento(false);
    }
  };

  const azioneMotivo = (m: Motivo) => {
    if (m.gravita !== "conferma" || confermati.includes(m.codice)) return null;
    const n = nPerAvviso(m.codice);
    return (
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-11 sm:h-9"
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
            className="h-11 sm:h-9"
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
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onIndietro}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Torna all&apos;elenco
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9 w-11 sm:w-9 p-0"
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
            className="h-11 sm:h-9 w-11 sm:w-9 p-0"
            disabled={!onSuccessiva}
            onClick={() => onSuccessiva?.()}
            aria-label="Riga successiva"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {onProssima && (
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onProssima}>
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
          {nomeDellaRiga(riga)}
        </h3>
        <BadgeStato stato={riga.stato} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section aria-label="Quello che ho trovato in chat e il bonifico" className="space-y-3">
          {chat?.tesseraImmagine !== undefined && (
            <MiniaturaChat lotto={lotto} idRiga={riga.idRiga} tipo="tessera" />
          )}
          {chat?.indirizzoImmagine !== undefined && (
            <MiniaturaChat lotto={lotto} idRiga={riga.idRiga} tipo="indirizzo" />
          )}
          {chat?.segnaposto && (
            <NotaFinestra tono="attenzione" icona={AlertTriangle}>
              C&apos;è una foto in questa chat non ancora scaricata dal ponte: apri la chat, tocca
              «Mostra», poi premi «Rileggi la chat» qui sotto.
            </NotaFinestra>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:h-9 sm:w-auto"
            disabled={fermo}
            onClick={onRileggiChat}
            title="Richiama l'intelligenza artificiale sulla chat: si paga di nuovo"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> Rileggi la chat
          </Button>

          <div className="border-t border-slate-200 pt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Screenshot del bonifico
            </p>
            {pagamento?.percorso ? (
              <div className="space-y-2">
                <MiniaturaChat lotto={lotto} idRiga={riga.idRiga} tipo="pagamento" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-11 sm:h-9"
                    disabled={fermo || caricandoFile}
                    onClick={() => inputFile.current?.click()}
                  >
                    Cambia screenshot
                  </Button>
                  {(pagamento.errore || !pagamento.lettura) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-11 sm:h-9"
                      disabled={fermo}
                      onClick={onRileggiPagamento}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rileggi il bonifico
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                Manca lo screenshot del bonifico ricevuto: finché non lo carichi questa riga resta
                in errore e non si può emettere. Oppure scrivi il pagamento a mano qui a destra,
                senza bisogno dello screenshot.
              </NotaFinestra>
            )}
            <input
              ref={inputFile}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                void sceltoFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {!pagamento?.percorso && (
              <Button
                type="button"
                className="mt-2 h-11 w-full sm:h-9 sm:w-auto"
                disabled={fermo || caricandoFile}
                onClick={() => inputFile.current?.click()}
              >
                {caricandoFile ? "Carico…" : "Carica lo screenshot del bonifico"}
              </Button>
            )}
            {erroreFile && (
              <p role="alert" className="mt-1.5 text-[11.5px] text-rose-700">
                {erroreFile}
              </p>
            )}
          </div>
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
              invalido={invalidi.has("nome")}
            />
            <CampoTesto
              etichetta="Cognome"
              valore={c.cognome}
              onSalva={campo("cognome")}
              invalido={invalidi.has("cognome")}
            />
            <CampoTesto
              className="col-span-2"
              etichetta="Codice fiscale"
              valore={c.codiceFiscale}
              onSalva={campo("codiceFiscale")}
              invalido={invalidi.has("codiceFiscale")}
              maxLength={16}
              trasforma={(v) => v.toUpperCase().replace(/\s/g, "")}
            />
            <CampoTesto
              className="col-span-2"
              etichetta="Indirizzo (residenza)"
              valore={c.indirizzo}
              onSalva={campo("indirizzo")}
              invalido={invalidi.has("indirizzo")}
            />
            <CampoTesto
              etichetta="CAP"
              valore={c.cap}
              onSalva={campo("cap")}
              invalido={invalidi.has("cap")}
              maxLength={5}
              inputMode="numeric"
              trasforma={(v) => v.replace(/\D/g, "")}
            />
            <CampoTesto
              etichetta="Provincia"
              valore={c.provincia}
              onSalva={campo("provincia")}
              invalido={invalidi.has("provincia")}
              maxLength={2}
              trasforma={(v) => v.toUpperCase().replace(/[^A-Z]/g, "")}
            />
            <CampoTesto
              className="col-span-2"
              etichetta="Comune"
              valore={c.comune}
              onSalva={campo("comune")}
              invalido={invalidi.has("comune")}
            />
            <CampoTesto
              etichetta="Importo pagato (IVA compresa)"
              valore={importoScritto(c.importo)}
              inputMode="decimal"
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

          {!pagamento?.lettura && (
            <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5">
              <p className="text-[12.5px] leading-snug text-slate-700">
                <strong className="font-medium text-slate-900">Scrivi il pagamento a mano:</strong>{" "}
                compila importo, data e modo qui sopra (il riferimento/CRO è facoltativo), poi premi
                «Salva pagamento». Lo screenshot del bonifico resta facoltativo: non serve per
                sbloccare questa riga.
              </p>
              <Button
                type="button"
                size="sm"
                className="h-11 w-full sm:h-9 sm:w-auto"
                disabled={fermo || inviandoPagamento || !corpoPagamento}
                title={
                  corpoPagamento
                    ? undefined
                    : "Compila almeno importo, data e modo di pagamento qui sopra."
                }
                onClick={() => void salvaPagamento()}
              >
                {inviandoPagamento ? "Salvo…" : "Salva pagamento"}
              </Button>
            </div>
          )}

          <CampoFinestra etichetta="Scheda cliente collegata">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900">
                {nomeScheda}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                onClick={onApriScheda}
              >
                Apri scheda
              </Button>
            </div>
          </CampoFinestra>

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

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        {scarto ? (
          <div
            role="group"
            aria-label="Conferma lo scarto"
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-[12.5px] text-slate-700">
              Scarto questa riga? Lo screenshot del bonifico viene cancellato e non si torna
              indietro.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => setScarto(false)}
              >
                Lascia stare
              </Button>
              <Button
                type="button"
                className="h-11 sm:h-9 bg-rose-600 hover:bg-rose-700"
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
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9 sm:w-auto"
              disabled={fermo}
              onClick={() => setScarto(true)}
            >
              <Ban className="mr-1.5 h-4 w-4" /> Scarta
            </Button>
            {confermata ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                disabled={fermo}
                onClick={() => void salva({ confermaRiga: false })}
              >
                Togli la conferma
              </Button>
            ) : soloConferme ? (
              <Button
                type="button"
                className="h-11 sm:h-9"
                disabled={fermo}
                onClick={async () => {
                  if (await salva({ confermaAvvisi: daConfermare.map((m) => m.codice) }))
                    await salva({ confermaRiga: true });
                }}
              >
                <Check className="mr-1.5 h-4 w-4" /> Confermo così e conferma la riga
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 sm:h-9"
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
            Una riga in errore si può correggere a mano, rileggere oppure scartare.
          </p>
        )}
      </div>
    </div>
  );
}
