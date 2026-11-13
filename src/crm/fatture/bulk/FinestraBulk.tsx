/** ── FATTURE BULK · «CARICA IN BLOCCO» (FinestraBulk.tsx) ──────────────────
 *  Commessa 2026-11-12-fatture-bulk, T13. Il pezzo che sta dentro CRM › Fatture:
 *  un riquadro in cima quando c'è un caricamento aperto, e la finestra grande dei
 *  sei passi (scegli i file → lettura → anteprima → correzione → emissione).
 *
 *  ⚠️ IL LAVORO VIVE QUI, NON NELLA FINESTRA. `useLotto` è chiamato da questo
 *   componente, che la pagina tiene montato sempre: chiudere la finestra a metà
 *   lettura non ferma niente, e il riquadro in cima dice a che punto è. Si ferma
 *   solo chiudendo la pagina (e il browser avvisa).
 *  ⚠️ «NON PARTITO» NON È «FINITO». Le azioni lunghe tornano 0 / null quando c'è
 *   già un lavoro in corso: si dice che non sono partite, mai «fatto, niente da
 *   fare».
 *  ⚠️ UN ELENCO NUOVO È UN LOTTO NUOVO. Rimandare file diversi su un lotto aperto
 *   salterebbe gli indici già salvati: per questo «Carica un altro elenco» chiede
 *   prima se il vecchio si tiene o si annulla (e lo annulla, se si vuole).
 *  ⚠️ Dopo un'azione che cambia lo stato non si legge lo stato nella stessa
 *   funzione (è quello di prima del disegno): si fa un passo (`passo`) e lo
 *   esegue un effetto, che vede lo stato nuovo.
 *  ⚠️ Nessun dato personale in console, in localStorage o nei titoli: i nomi
 *   stanno solo a schermo. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  FileStack,
  ImageUp,
  MessageCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { fetchCRM } from "@/crm/AuthContext";
import { useRicerca } from "@/crm/ui";
import {
  CLASSE_CAMPO,
  CampoFinestra,
  Finestra,
  NotaFinestra,
  Pillola,
  SezioneFinestra,
} from "@/crm/ui/Finestra";
import type { Lead } from "@/crm/types";
import { DESCRIZIONI } from "../descrizioni";
import type { DatiAzienda, Fattura } from "../tipi";
import { IN_PARALLELO, MAX_FILE } from "./chiavi";
import { controllaFile } from "./immagini";
import { contaGruppi, ordinaFile, type CriterioOrdine } from "./raggruppa";
import { schedaDaLead } from "./scheda-da-lead";
import { controllaLotto } from "./regole-lotto";
import { oggiItaliano } from "./regole-riga";
import { fattiSulleDate } from "./emissione-bulk";
import {
  AVVISI_PER_TUTTE,
  fraseDi,
  gruppiDaLeggere,
  useLotto,
  ErroreRotta,
  type RiepilogoEmissione,
} from "./usa-lotto";
import type { ContestoValutazione, RigaValutata, SchedaPerAbbinamento, SintesiLotto } from "./tipi";
import {
  AnteprimaBulk,
  contaPerStato,
  filtraRighe,
  nomeDellaRiga,
  rigaAperta,
  RIGHE_PER_PAGINA,
  type FiltroRighe,
} from "./AnteprimaBulk";
import { PannelloRigaBulk } from "./PannelloRigaBulk";
import { RiepilogoEmissioneBulk, type FaseEmissione } from "./RiepilogoEmissioneBulk";
import {
  AVVISI_PER_TUTTE as AVVISI_PER_TUTTE_CHAT,
  leggiRottaChat,
  useLottoChat,
} from "../dalla-chat/usa-lotto-chat";
import { schedeChatDaLeads } from "../dalla-chat/schede-chat-da-lead";
import { ListaClientiChat } from "../dalla-chat/ListaClientiChat";
import { AnteprimaChat } from "../dalla-chat/AnteprimaChat";
import { PannelloRigaChat } from "../dalla-chat/PannelloRigaChat";
import type { CandidatoChat, SintesiLottoChat } from "../dalla-chat/tipi";

/* ══ 1. SCEGLIERE I FILE ═══════════════════════════════════════════════════ */

const TIPI_IMMAGINE = "image/png,image/jpeg,image/webp";

/** Le prime tre miniature, fatte in locale (nessun upload). Si rilasciano quando cambiano. */
function useMiniatureLocali(file: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = file.filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [file]);
  return urls;
}

function SceltaFile({
  ripresa,
  scelti,
  ordinati,
  onScelti,
  criterio,
  onCriterio,
  dataRiserva,
  onDataRiserva,
  bloccanti,
  oggi,
}: {
  ripresa: boolean;
  scelti: File[];
  /** Gli stessi file nell'ordine scelto (li ordina il padre, una volta sola). */
  ordinati: File[];
  onScelti: (f: File[]) => void;
  criterio: CriterioOrdine;
  onCriterio: (c: CriterioOrdine) => void;
  dataRiserva: string;
  onDataRiserva: (d: string) => void;
  bloccanti: string[];
  oggi: string;
}) {
  const [trascina, setTrascina] = useState(false);
  const primi = useMemo(() => ordinati.slice(0, 3), [ordinati]);
  const miniature = useMiniatureLocali(primi);
  const conto = contaGruppi(ordinati.length);
  const nonValidi = useMemo(
    () =>
      ordinati.flatMap((f, i) => {
        const c = controllaFile(f);
        return c.ok ? [] : [{ nome: f.name, posizione: i + 1, motivo: c.motivo }];
      }),
    [ordinati],
  );

  const prendi = (lista: FileList | null) =>
    lista && lista.length > 0 && onScelti(Array.from(lista));

  return (
    <div className="space-y-4">
      {ripresa ? (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          Scegli di nuovo TUTTI gli stessi screenshot, con lo stesso ordine di prima: quelli già
          caricati vengono saltati e non si pagano di nuovo. Con file diversi la rotta rifiuta il
          caricamento.
        </NotaFinestra>
      ) : (
        <p className="max-w-[65ch] text-[13px] leading-relaxed text-slate-600">
          Scegli gli screenshot di tutti i clienti: per ognuno l&apos;indirizzo, la tessera
          sanitaria e il pagamento, uno dopo l&apos;altro. Prima di leggerli ti dico quanti sono e
          in che ordine li ho presi.
        </p>
      )}

      {bloccanti.length > 0 && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          <span role="alert" className="block">
            Prima di caricare, sistema i dati dell&apos;azienda:
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {bloccanti.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </span>
        </NotaFinestra>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setTrascina(true);
        }}
        onDragLeave={() => setTrascina(false)}
        onDrop={(e) => {
          e.preventDefault();
          setTrascina(false);
          prendi(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          "focus-within:ring-2 focus-within:ring-slate-400",
          trascina
            ? "border-slate-500 bg-slate-100"
            : "border-slate-300 bg-white hover:bg-slate-50",
        )}
      >
        <ImageUp className="h-5 w-5 text-slate-400" aria-hidden />
        <span className="text-[13px] font-medium text-slate-900">
          {scelti.length > 0
            ? "Scegli altri file (sostituiscono questi)"
            : "Trascina qui gli screenshot o tocca per sceglierli"}
        </span>
        <span className="text-[11.5px] text-slate-500">
          PNG, JPG o WebP · fino a {MAX_FILE} file
        </span>
        <input
          type="file"
          multiple
          accept={TIPI_IMMAGINE}
          className="sr-only"
          onChange={(e) => {
            prendi(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {scelti.length > 0 && (
        <SezioneFinestra titolo="Cosa ho preso" nota="Prima di spendere un centesimo di lettura">
          <div className="space-y-3">
            <p className="text-[15px] font-semibold tabular-nums text-slate-900" aria-live="polite">
              {conto.fileInPiu === 0
                ? `${conto.file} file → ${conto.clienti} ${conto.clienti === 1 ? "cliente" : "clienti"}`
                : `${conto.file} file: ${conto.gruppiCompleti} gruppi completi + ${conto.fileInPiu} ${conto.fileInPiu === 1 ? "file in più" : "file in più"}`}
            </p>
            {conto.fileInPiu > 0 && (
              <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                Il numero dei file non è un multiplo di 3. Non si blocca niente: dopo la lettura i
                file avanzati o i gruppi incompleti diventano righe in errore, e non si emette mai
                una riga incompleta.
              </NotaFinestra>
            )}
            {conto.oltreIlLimite && (
              <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                <span role="alert">Sono più di {MAX_FILE} file: spezza in due caricamenti.</span>
              </NotaFinestra>
            )}

            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Ordina per
                </span>
                <Pillola
                  className="min-h-11 sm:min-h-0"
                  attiva={criterio === "nome"}
                  onClick={() => onCriterio("nome")}
                >
                  Nome del file
                </Pillola>
                <Pillola
                  className="min-h-11 sm:min-h-0"
                  attiva={criterio === "data"}
                  onClick={() => onCriterio("data")}
                >
                  Data del file
                </Pillola>
              </div>
              <p className="mb-2 text-[11.5px] text-slate-500">
                Il browser non ricorda l&apos;ordine dei clic. Questi sono i primi tre file: se non
                sono l&apos;indirizzo, la tessera e il pagamento del primo cliente, cambia
                l&apos;ordine.
              </p>
              <ol className="flex flex-wrap gap-2" aria-label="I primi tre file nell'ordine scelto">
                {primi.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="w-24 min-w-0">
                    <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {miniature[i] ? (
                        <img
                          src={miniature[i]}
                          alt={`File ${i + 1}: ${f.name}`}
                          className="h-full w-full object-contain object-top"
                        />
                      ) : (
                        <ImageUp className="h-4 w-4 text-slate-400" aria-hidden />
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {i + 1}. {f.name}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {nonValidi.length > 0 && (
              <NotaFinestra tono="attenzione" icona={AlertTriangle}>
                <span role="alert" className="block">
                  {nonValidi.length === 1
                    ? "Un file non va bene"
                    : `${nonValidi.length} file non vanno bene`}
                  :
                  <ul className="mt-1 space-y-0.5">
                    {nonValidi.slice(0, 5).map((n) => (
                      <li key={n.posizione}>
                        <span className="font-medium">{n.nome}</span>: {n.motivo}
                      </li>
                    ))}
                    {nonValidi.length > 5 && <li>e altri {nonValidi.length - 5}.</li>}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-11 sm:h-9"
                    onClick={() => onScelti(scelti.filter((f) => controllaFile(f).ok))}
                  >
                    Togli i file che non vanno bene
                  </Button>
                </span>
              </NotaFinestra>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 sm:h-9 text-slate-600"
              onClick={() => onScelti([])}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Svuota la scelta
            </Button>
          </div>
        </SezioneFinestra>
      )}

      {!ripresa && (
        <SezioneFinestra
          titolo="Per tutto il caricamento"
          nota="Valgono per ogni fattura di questo elenco"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoFinestra etichetta="Descrizione in fattura">
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                {DESCRIZIONI[0]}
              </p>
            </CampoFinestra>
            <CampoFinestra
              etichetta="Se lo screenshot del pagamento non mostra la data, usa"
              nota="Facoltativo. Una riga che usa questa data resta da confermare: mai «oggi» di nascosto."
            >
              <Input
                type="date"
                value={dataRiserva}
                max={oggi}
                onChange={(e) => onDataRiserva(e.target.value)}
                className={cn(CLASSE_CAMPO, "h-11 w-full sm:h-9")}
              />
            </CampoFinestra>
          </div>
          <div className="mt-3 space-y-1 text-[12px] leading-snug text-slate-600">
            <p>Ogni pagamento è fatturato per intero.</p>
            <p>L&apos;indirizzo letto è trattato come residenza.</p>
          </div>
        </SezioneFinestra>
      )}
    </div>
  );
}

/* ══ 2. IL COMPONENTE DELLA PAGINA ═════════════════════════════════════════ */

export interface PropsCaricaInBlocco {
  aperta: boolean;
  onCambio: (v: boolean) => void;
  azienda: DatiAzienda;
  emesse: Fattura[];
  bozze: Fattura[];
  leads: Lead[];
  /** La pagina sta (ri)leggendo le fatture: si tiene il contesto di prima, niente righe che spariscono. */
  caricando: boolean;
  /** Una o più fatture sono nate: la pagina rilegge l'archivio. */
  onEmesso: () => void;
  /** Scarica gli XML (stessi controlli della pagina: quelle che verrebbero scartate restano indietro). */
  onScaricaXml: (fatture: Fattura[]) => void;
  /** ── IL LINK DALLA CHAT (T15 → T16, SPEC §9.3 passo 6, §9.6) ─────────────
   *  Già validati dalla rotta (`CRM.fatture.tsx`, `leggiRicercaFatture`): se presenti,
   *  «Dalla chat» si apre da sola su questo lotto, con questa riga scorsa in vista ed
   *  evidenziata (`CaricaDallaChat`, sotto). Un link vecchio (lotto annullato o concluso,
   *  riga già emessa o scartata) non è un errore: si apre comunque la lista, con un avviso
   *  onesto — vedi `rigaApribileDelLink`. */
  apriLotto?: string;
  apriRiga?: string;
}

type Passo = { cosa: "leggi" } | { cosa: "annulla"; lotto: string } | null;

/** Le due porte d'ingresso della stessa fattura (SPEC `2026-11-13-fatture-dalla-chat`
 *  §1, §3 passo 1): «Da screenshot» (questa, invariata) e «Dalla chat» (nuova). Un
 *  selettore solo, condiviso dalle due finestre — mai due selettori che potrebbero
 *  disallinearsi. */
type Modalita = "screenshot" | "chat";

/** Pillola «Da screenshot / Dalla chat», in cima alla finestra (SPEC §3 passo 1).
 *  Disattivata mentre è in corso un lavoro: cambiare modalità non lo interrompe (lo
 *  stato di entrambe le modalità resta in memoria, PIANO T8 — «CaricaDallaChat sempre
 *  montato»), ma nasconderne l'avanzamento a metà sarebbe confuso. */
function SelettoreModalita({
  modalita,
  onModalita,
  disabilitato,
}: {
  modalita: Modalita;
  onModalita: (m: Modalita) => void;
  disabilitato?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Come vuoi caricare i dati di questi clienti"
    >
      <Pillola
        attiva={modalita === "screenshot"}
        disabilitata={disabilitato}
        onClick={() => onModalita("screenshot")}
      >
        Da screenshot
      </Pillola>
      <Pillola
        attiva={modalita === "chat"}
        disabilitata={disabilitato}
        onClick={() => onModalita("chat")}
      >
        Dalla chat
      </Pillola>
    </div>
  );
}

function CaricaBulkDaScreenshot(
  p: PropsCaricaInBlocco & { modalita: Modalita; onModalita: (m: Modalita) => void },
) {
  const { onCambio, azienda, emesse, bozze, leads, caricando, modalita, onModalita } = p;
  // Una sola delle due finestre è visivamente aperta alla volta: l'altra resta montata
  // (il suo lavoro continua) ma la sua Finestra (Radix Dialog) è chiusa (PIANO T8).
  const aperta = p.aperta && modalita === "screenshot";
  const { apriLead } = useRicerca();

  /* ── il contesto delle regole ─────────────────────────────────────────── */
  const schede = useMemo<SchedaPerAbbinamento[]>(
    () =>
      // La stessa mappatura del server (`emetti-riga`): anteprima ed emissione abbinano le stesse schede.
      (Array.isArray(leads) ? leads : []).map((l) => schedaDaLead(l.id, l.data ?? {})),
    [leads],
  );
  const nomiSchede = useMemo(
    () => new Map(schede.map((s) => [s.id, `${s.nome} ${s.cognome}`.trim() || "senza nome"])),
    [schede],
  );
  const oggi = oggiItaliano();
  const costruito = useMemo<Omit<ContestoValutazione, "lotto">>(
    () => ({ azienda, oggi, emesse, bozze, schede, impronteAltriLotti: [] }),
    [azienda, oggi, emesse, bozze, schede],
  );
  // Finché la pagina non ha letto archivio e impostazioni nessuna riga si valuta; dopo, durante una rilettura
  // (dopo un'emissione) si tiene il contesto di prima, così le righe non spariscono per un istante.
  const ultimoContesto = useRef<Omit<ContestoValutazione, "lotto"> | null>(null);
  if (!caricando) ultimoContesto.current = costruito;
  const lotto = useLotto({ contesto: ultimoContesto.current });
  const ultimo = useRef(lotto);
  ultimo.current = lotto;
  const { stato, righe, fatti } = lotto;

  /* ── stato della finestra ─────────────────────────────────────────────── */
  const [scelti, setScelti] = useState<File[]>([]);
  const [criterio, setCriterio] = useState<CriterioOrdine>("nome");
  const [dataRiserva, setDataRiserva] = useState("");
  const [ripresa, setRipresa] = useState(false);
  const [avvio, setAvvio] = useState(false);
  const [passo, setPasso] = useState<Passo>(null);
  const [fermando, setFermando] = useState(false);
  const [rigaSel, setRigaSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroRighe>("tutte");
  const [pagina, setPagina] = useState(0);
  const [aperti, setAperti] = useState<SintesiLotto[]>([]);
  const [daAnnullare, setDaAnnullare] = useState<{ lotto: string; file: number } | null>(null);
  const [nuovoElenco, setNuovoElenco] = useState(false);
  const [faseEm, setFaseEm] = useState<FaseEmissione | null>(null);
  const [riepilogoFinale, setRiepilogoFinale] = useState<RiepilogoEmissione | null>(null);
  const [erroreChiuso, setErroreChiuso] = useState<unknown>(null);
  const ultimaRiga = useRef<string | null>(null);

  const ordinati = useMemo(
    () =>
      ordinaFile(
        scelti.map((f) => ({ nome: f.name, modificatoIl: f.lastModified, f })),
        criterio,
      ).map((x) => x.f),
    [scelti, criterio],
  );
  const bloccantiCentro = useMemo(
    () =>
      controllaLotto(azienda)
        .filter((m) => m.gravita === "blocca")
        .map((m) => m.testo),
    [azienda],
  );

  /* ── i lotti rimasti aperti (alla prima apertura della pagina) ────────── */
  const aggiornaAperti = useCallback(async () => {
    try {
      setAperti(await ultimo.current.lottiAperti());
    } catch {
      // Il riquadro semplicemente non compare: non è un errore da mostrare ogni volta che si apre la pagina.
    }
  }, []);
  const partito = useRef(false);
  useEffect(() => {
    if (caricando || partito.current) return;
    partito.current = true;
    void aggiornaAperti();
  }, [caricando, aggiornaAperti]);

  /* ── i passi che guardano lo stato DOPO un'azione ─────────────────────── */
  useEffect(() => {
    if (!passo) return;
    setPasso(null);
    const l = ultimo.current;
    const s = l.stato;
    if (passo.cosa === "leggi") {
      setAvvio(false);
      const fermo =
        !s.lotto ||
        s.errore ||
        s.fermata ||
        s.erroriCarico.length > 0 ||
        s.fileNonValidi.length > 0;
      if (!fermo) void l.leggi();
    } else if (s.lotto !== passo.lotto) {
      toast.error("Non riesco ad aprire questo caricamento, quindi non l'ho annullato.", {
        description: "Riprova fra poco; se resta così avvisa l'assistenza.",
      });
    } else {
      void l.annullaLotto().then((ok) => {
        if (ok) void aggiornaAperti();
      });
    }
  }, [passo, aggiornaAperti]);

  /* ── dati derivati ────────────────────────────────────────────────────── */
  const conti = useMemo(() => contaPerStato(righe), [righe]);
  const visibili = useMemo(() => filtraRighe(righe, filtro), [righe, filtro]);
  const apribili = useMemo(() => visibili.filter(rigaAperta), [visibili]);
  const daLeggere = useMemo(
    () => gruppiDaLeggere(stato.file, new Set(), stato.totaleFile).length,
    [stato.file, stato.totaleFile],
  );
  const nPronte = conti.pronto;
  const nEmettibili = useMemo(
    () => righe.filter((r) => r.emettibile && rigaAperta(r)).length,
    [righe],
  );
  const lavoro = stato.lavoro;
  const occupato = !!lavoro || avvio;
  const riga = rigaSel ? righe.find((r) => r.idRiga === rigaSel) : undefined;
  const inLettura = lavoro?.cosa === "carico" || lavoro?.cosa === "lettura" || avvio;

  // La riga aperta può sparire (rilettura che cambia i gruppi, scarto): si torna all'elenco.
  useEffect(() => {
    if (rigaSel && !riga && !occupato) setRigaSel(null);
  }, [rigaSel, riga, occupato]);
  // Tornando all'elenco, il fuoco va sulla riga che si stava guardando.
  useEffect(() => {
    if (rigaSel === null && ultimaRiga.current) {
      document.getElementById(`riga-bulk-${ultimaRiga.current}`)?.focus();
      ultimaRiga.current = null;
    }
  }, [rigaSel]);

  const nPerAvviso = useCallback(
    (codice: string) =>
      !AVVISI_PER_TUTTE.includes(codice)
        ? 0
        : righe.filter(
            (r) =>
              rigaAperta(r) &&
              r.motivi.some((m) => m.codice === codice && m.gravita === "conferma") &&
              !stato.decisioni[r.idRiga]?.confermeAvvisi?.includes(codice),
          ).length,
    [righe, stato.decisioni],
  );
  const avvisiPerTutte = useMemo(
    () =>
      [
        {
          codice: "data_anteriore",
          testo: (n: number) =>
            `${n} righe hanno una data di pagamento anteriore all'ultima fattura emessa: avranno un numero più alto della data. Apri una riga per leggere l'avviso per intero.`,
        },
        {
          codice: "ordine_diverso",
          testo: (n: number) =>
            `${n} righe hanno gli screenshot in un ordine diverso dal solito (indirizzo, tessera, pagamento). Aprine qualcuna e controlla che le tre immagini siano della stessa persona, poi confermale tutte insieme.`,
        },
        {
          codice: "oltre_12_giorni",
          testo: (n: number) =>
            `${n} righe hanno un pagamento di più di 12 giorni fa, cioè oltre il termine di invio allo SDI (stima). Apri una riga per leggere l'avviso per intero.`,
        },
      ]
        .map((a) => ({ codice: a.codice, n: nPerAvviso(a.codice), testo: a.testo }))
        .map((a) => ({ codice: a.codice, n: a.n, testo: a.testo(a.n) }))
        .filter((a) => a.n >= 2),
    [nPerAvviso],
  );

  /* ── azioni ───────────────────────────────────────────────────────────── */
  const avvia = async () => {
    setAvvio(true);
    await lotto.carica(
      ordinati,
      ripresa || stato.lotto ? {} : { descrizione: DESCRIZIONI[0], dataSeManca: dataRiserva },
    );
    setRipresa(false);
    setPasso({ cosa: "leggi" });
  };
  const riprendiDalBanner = async (id: string) => {
    onCambio(true);
    await lotto.apri(id);
  };
  const apriRiga = (id: string) => {
    ultimaRiga.current = id;
    setRigaSel(id);
  };
  const tornaAllElenco = () => {
    const i = visibili.findIndex((r) => r.idRiga === rigaSel);
    if (i >= 0) setPagina(Math.floor(i / RIGHE_PER_PAGINA));
    setRigaSel(null);
  };
  const vaiAllaProssima = (dopo?: string) => {
    const i = dopo ? righe.findIndex((r) => r.idRiga === dopo) : -1;
    const giro = [...righe.slice(i + 1), ...righe.slice(0, i + 1)];
    const t = giro.find((r) => r.stato === "da_controllare" && r.idRiga !== dopo);
    if (t) apriRiga(t.idRiga);
    else toast.info("Non ce ne sono altre da controllare.");
  };
  const confermaTutte = async () => {
    const attese = nPronte;
    const n = await lotto.confermaTutteLePronte();
    if (n === 0 && attese > 0)
      toast.info("Non è partito: c'è un altro lavoro in corso. Riprova fra poco.");
    else if (n < attese)
      toast.warning(`Confermate ${n} righe su ${attese}`, {
        description: "Le altre restano da confermare: riprova.",
      });
    else toast.success(`Confermate ${n} ${n === 1 ? "riga" : "righe"}`);
  };
  const confermaAvviso = async (codice: string) => {
    const attese = nPerAvviso(codice);
    const n = await lotto.confermaAvvisoPerTutte(codice);
    if (n === 0 && attese > 0)
      toast.info("Non è partito: c'è un altro lavoro in corso. Riprova fra poco.");
    else if (n < attese) toast.warning(`Confermato su ${n} righe di ${attese}`);
    else toast.success(`Avviso confermato su ${n} righe`);
  };
  const emettiOra = async () => {
    setFaseEm("corso");
    const r = await lotto.emettiConfermate();
    if (r === null) {
      // null = non è partito (c'era già un lavoro in corso), NON «finito».
      toast.info("Non è partito: c'è un altro lavoro in corso. Aspetta che finisca e riprova.");
      setFaseEm("conferma");
      return;
    }
    setRiepilogoFinale(r);
    setFaseEm("finale");
    p.onEmesso();
  };
  const nuovoCaricamento = async (annullaIlVecchio: boolean) => {
    if (annullaIlVecchio) {
      if (!(await lotto.annullaLotto())) return;
    } else lotto.nuovoLotto();
    setNuovoElenco(false);
    setScelti([]);
    setRipresa(false);
    setRigaSel(null);
    setFiltro("tutte");
    setPagina(0);
    void aggiornaAperti();
  };
  const annullaConfermato = async () => {
    if (!daAnnullare) return;
    const { lotto: id } = daAnnullare;
    setDaAnnullare(null);
    if (stato.lotto === id) {
      if (await lotto.annullaLotto()) {
        setScelti([]);
        void aggiornaAperti();
      }
      return;
    }
    // Un lotto che non è in memoria si apre, e poi si annulla guardando lo stato nuovo (vedi `passo`).
    await lotto.apri(id);
    setPasso({ cosa: "annulla", lotto: id });
  };

  /* ── il riquadro in cima alla pagina ──────────────────────────────────── */
  const inMemoria = stato.lotto !== null;
  const riquadro = (
    <>
      {inMemoria && !aperta && !stato.lottoChiuso && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
          role="status"
        >
          <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
            <FileStack className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              {lavoro?.cosa === "lettura"
                ? `Sto leggendo gli screenshot: ${lavoro.fatti} di ${lavoro.totale} clienti.`
                : lavoro?.cosa === "carico"
                  ? `Sto caricando gli screenshot: ${lavoro.fatti} di ${lavoro.totale} file.`
                  : lavoro?.cosa === "emissione"
                    ? `Sto emettendo le fatture: ${lavoro.fatti} di ${lavoro.totale}.`
                    : `Caricamento da screenshot in corso: ${conti.tutte} clienti, ${conti.pronto + conti.da_controllare + conti.errore + conti.confermata + conti.emessa} letti, ${conti.da_controllare} da controllare.`}
            </span>
          </span>
          <span className="flex gap-2">
            <Button size="sm" className="h-11 sm:h-8" onClick={() => onCambio(true)}>
              Apri
            </Button>
            {!occupato && (
              <Button
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                onClick={() => setDaAnnullare({ lotto: stato.lotto!, file: stato.file.length })}
              >
                Annulla
              </Button>
            )}
          </span>
        </div>
      )}
      {!inMemoria &&
        aperti.map((a) => (
          <div
            key={a.lotto}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
            role="status"
          >
            <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
              <FileStack className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                Caricamento da screenshot in corso: {a.file} file, {a.letti} letti, {a.righeAperte}{" "}
                da emettere
                {a.righeEmesse > 0 ? `, ${a.righeEmesse} già emesse` : ""}.
              </span>
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                className="h-11 sm:h-8"
                disabled={occupato}
                onClick={() => void riprendiDalBanner(a.lotto)}
              >
                Riprendi
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                disabled={occupato}
                onClick={() => setDaAnnullare({ lotto: a.lotto, file: a.file })}
              >
                Annulla
              </Button>
            </span>
          </div>
        ))}
    </>
  );

  /* ── il corpo della finestra ──────────────────────────────────────────── */
  const errore = stato.errore && stato.errore !== erroreChiuso ? stato.errore : null;
  const avvisi = (
    <div className="space-y-2">
      {errore && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          <span role="alert" className="flex items-start justify-between gap-2">
            <span>{fraseDi(errore.codice, errore.messaggio)}</span>
            <button
              type="button"
              className="shrink-0 font-medium underline"
              onClick={() => setErroreChiuso(stato.errore)}
            >
              Chiudi
            </button>
          </span>
        </NotaFinestra>
      )}
      {stato.fermata && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          {stato.fermata.per === "annullata"
            ? "Hai interrotto: quello che era già stato fatto resta."
            : `Mi sono fermato da solo dopo troppi errori di fila. ${stato.fermata.codice ? fraseDi(stato.fermata.codice) : ""}`}
        </NotaFinestra>
      )}
      {stato.erroriCarico.length > 0 && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {stato.erroriCarico.length === 1
                ? "Un file non è arrivato."
                : `${stato.erroriCarico.length} file non sono arrivati.`}{" "}
              {stato.erroriCarico[0]?.messaggio ?? fraseDi(stato.erroriCarico[0].codice)}
            </span>
            {ordinati.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 sm:h-9"
                disabled={occupato}
                onClick={() => void avvia()}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Riprova i file mancanti
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => setRipresa(true)}
              >
                Scegli di nuovo gli screenshot
              </Button>
            )}
          </span>
        </NotaFinestra>
      )}
    </div>
  );

  /** Solo sopra l'elenco (non dentro il pannello di una riga, dove la riga stessa dice già l'errore).
   *  Corto: su telefono la prima schermata deve far vedere le righe. */
  const riquadroGruppi =
    Object.keys(stato.erroriGruppo).length > 0 && !inLettura ? (
      <NotaFinestra tono="attenzione" icona={AlertTriangle}>
        Lettura non riuscita per{" "}
        {Object.keys(stato.erroriGruppo).length === 1
          ? "un cliente"
          : `${Object.keys(stato.erroriGruppo).length} clienti`}
        : sono righe in errore, con «Rileggi».
        <span className="hidden sm:inline"> {fraseDi(Object.values(stato.erroriGruppo)[0])}</span>
      </NotaFinestra>
    ) : null;

  let corpo: React.ReactNode;
  let piede: React.ReactNode = null;
  let titoloContesto = "";

  if (lavoro && lavoro.cosa !== "emissione") {
    const etichette: Record<string, string> = {
      apertura: "Apro il caricamento…",
      carico: `Caricati ${lavoro.fatti} di ${lavoro.totale} file`,
      lettura: `Letti ${lavoro.fatti} di ${lavoro.totale} clienti · ${IN_PARALLELO} alla volta`,
      rilettura: "Rileggo gli screenshot di questa riga…",
      conferme: `Confermate ${lavoro.fatti} di ${lavoro.totale} righe`,
    };
    const v = lavoro.totale > 0 ? Math.round((lavoro.fatti / lavoro.totale) * 100) : 0;
    const lungo = lavoro.cosa === "carico" || lavoro.cosa === "lettura";
    titoloContesto = etichette[lavoro.cosa];
    corpo = (
      <div className="mx-auto max-w-xl space-y-4 py-6" aria-live="polite">
        <p className="text-[15px] font-semibold tabular-nums text-slate-900">
          {etichette[lavoro.cosa]}
        </p>
        <Progress
          value={v}
          aria-label="Avanzamento"
          className="h-2 bg-slate-200 [&>div]:bg-slate-700"
        />
        {lungo && (
          <p className="text-[12.5px] leading-relaxed text-slate-600">
            Possono passare alcuni minuti. Puoi chiudere questa finestra e fare altro nel CRM, ma la
            pagina deve restare aperta: il riquadro in cima dice a che punto siamo. Se la chiudi, si
            riprende da dove eri arrivato senza ripagare quello che è già stato letto.
          </p>
        )}
        {avvisi}
      </div>
    );
    piede = lungo ? (
      <>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => onCambio(false)}
        >
          Chiudi e continua
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          disabled={fermando}
          onClick={() => {
            setFermando(true);
            lotto.interrompi();
          }}
        >
          {fermando ? "Mi fermo…" : "Interrompi"}
        </Button>
      </>
    ) : null;
  } else if (avvio) {
    titoloContesto = "Preparo il caricamento…";
    corpo = (
      <p className="py-10 text-center text-[13px] text-slate-600" aria-live="polite">
        Preparo la lettura…
      </p>
    );
  } else if (!stato.lotto || ripresa) {
    const senzaFile = ordinati.length === 0 || ordinati.length > MAX_FILE;
    const nonValido = ordinati.some((f) => !controllaFile(f).ok);
    titoloContesto = ripresa ? "Riprendi il caricamento dei file" : "Scegli gli screenshot";
    corpo = (
      <div className="space-y-3">
        {!ripresa && (
          <SelettoreModalita modalita={modalita} onModalita={onModalita} disabilitato={occupato} />
        )}
        {avvisi}
        <SceltaFile
          ripresa={ripresa}
          scelti={scelti}
          ordinati={ordinati}
          onScelti={setScelti}
          criterio={criterio}
          onCriterio={setCriterio}
          dataRiserva={dataRiserva}
          onDataRiserva={setDataRiserva}
          bloccanti={ripresa ? [] : bloccantiCentro}
          oggi={oggi}
        />
        {!ripresa && aperti.length > 0 && (
          <NotaFinestra icona={FileStack}>
            Hai già un caricamento aperto: lo trovi nel riquadro in cima alla pagina, con Riprendi e
            Annulla. Uno nuovo non lo sostituisce.
          </NotaFinestra>
        )}
      </div>
    );
    piede = (
      <>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => (ripresa ? setRipresa(false) : onCambio(false))}
        >
          {ripresa ? "Indietro" : "Chiudi"}
        </Button>
        <Button
          type="button"
          className="h-11 sm:h-9 sm:min-w-40"
          disabled={senzaFile || nonValido || (!ripresa && bloccantiCentro.length > 0)}
          onClick={() => void avvia()}
        >
          {ripresa ? "Riprendi il caricamento" : "Leggi"}
        </Button>
      </>
    );
  } else if (stato.lottoChiuso) {
    titoloContesto = "Caricamento concluso";
    corpo = (
      <div className="mx-auto max-w-md space-y-3 py-8 text-center">
        <p className="text-[15px] font-semibold text-slate-900">
          Tutte le righe sono emesse o scartate.
        </p>
        <p className="text-[12.5px] text-slate-600">
          Gli screenshot sono stati cancellati. Se ti serve un altro elenco, ricomincia da capo.
        </p>
        <Button type="button" className="h-11 sm:h-9" onClick={() => void nuovoCaricamento(false)}>
          Nuovo caricamento
        </Button>
      </div>
    );
  } else if (riga && rigaAperta(riga)) {
    const i = apribili.findIndex((r) => r.idRiga === riga.idRiga);
    titoloContesto = `Riga ${riga.numero}`;
    corpo = (
      <div className="space-y-3">
        {avvisi}
        <PannelloRigaBulk
          key={riga.idRiga}
          riga={riga}
          posizione={i + 1}
          totale={apribili.length}
          lotto={stato.lotto}
          file={stato.file}
          decisione={stato.decisioni[riga.idRiga]}
          schede={schede}
          occupato={occupato}
          nPerAvviso={nPerAvviso}
          onSalva={(c) => lotto.salvaRiga(riga.idRiga, c)}
          onRileggi={(indici) => void lotto.rileggi(indici)}
          onConfermaPerTutte={(c) => void confermaAvviso(c)}
          onApriScheda={(id) => {
            // La finestra si chiude ma il lavoro resta: lo si riapre dal riquadro in cima.
            onCambio(false);
            apriLead(id);
          }}
          onIndietro={tornaAllElenco}
          onPrecedente={i > 0 ? () => apriRiga(apribili[i - 1].idRiga) : null}
          onSuccessiva={
            i >= 0 && i < apribili.length - 1 ? () => apriRiga(apribili[i + 1].idRiga) : null
          }
          onProssima={conti.da_controllare > 0 ? () => vaiAllaProssima(riga.idRiga) : null}
        />
      </div>
    );
  } else {
    titoloContesto = `${conti.tutte} ${conti.tutte === 1 ? "cliente" : "clienti"} · ${conti.pronto} pronte · ${conti.da_controllare} da controllare · ${conti.errore} errori`;
    corpo = (
      <div className="space-y-3">
        <SelettoreModalita modalita={modalita} onModalita={onModalita} disabilitato={occupato} />
        {avvisi}
        {riquadroGruppi}
        {stato.testata && (
          <p className="text-[12px] text-slate-500">
            Descrizione in fattura:{" "}
            <span className="text-slate-700">{stato.testata.descrizione || DESCRIZIONI[0]}</span>
            {stato.testata.dataSeManca ? " · data di riserva impostata" : ""}
          </p>
        )}
        <AnteprimaBulk
          lotto={stato.lotto}
          righe={righe}
          file={stato.file}
          decisioni={stato.decisioni}
          schede={nomiSchede}
          filtro={filtro}
          onFiltro={(f) => {
            setFiltro(f);
            setPagina(0);
          }}
          pagina={pagina}
          onPagina={setPagina}
          occupato={occupato}
          nPronte={nPronte}
          daLeggere={daLeggere}
          avvisiPerTutte={avvisiPerTutte}
          onApri={apriRiga}
          onProssima={() => vaiAllaProssima()}
          onConfermaTutte={() => void confermaTutte()}
          onConfermaAvviso={(c) => void confermaAvviso(c)}
          onLeggi={() => void lotto.riprendi()}
        />
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-9 text-slate-600"
            disabled={occupato}
            onClick={() => setNuovoElenco(true)}
          >
            Carica un altro elenco
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-9 text-slate-600"
            disabled={occupato}
            onClick={() => setRipresa(true)}
          >
            Mancano degli screenshot? Scegli di nuovo i file
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-9 text-rose-700 hover:text-rose-800"
            disabled={occupato}
            onClick={() => setDaAnnullare({ lotto: stato.lotto!, file: stato.file.length })}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Annulla questo caricamento
          </Button>
        </div>
      </div>
    );
    piede = (
      <>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => onCambio(false)}
        >
          Chiudi
        </Button>
        <Button
          type="button"
          className="h-11 sm:h-9 sm:min-w-52"
          disabled={occupato || nEmettibili === 0}
          onClick={() => setFaseEm("conferma")}
        >
          Emetti le confermate ({nEmettibili})
        </Button>
      </>
    );
  }

  return (
    <>
      {riquadro}

      <Finestra
        aperta={aperta}
        onCambio={onCambio}
        larghezza="xl"
        icona={FileStack}
        titolo="Carica in blocco"
        contesto={titoloContesto || undefined}
        azioni={piede}
        classeCorpo="min-h-[50vh]"
      >
        {corpo}
      </Finestra>

      {faseEm && (
        <RiepilogoEmissioneBulk
          aperta
          onCambio={(v) => {
            if (!v && faseEm !== "corso") setFaseEm(null);
          }}
          fase={faseEm}
          righe={righe}
          fatti={fatti}
          emesse={emesse}
          azienda={azienda}
          avanzamento={
            lavoro?.cosa === "emissione" ? { fatti: lavoro.fatti, totale: lavoro.totale } : null
          }
          riepilogo={riepilogoFinale}
          lottoChiuso={stato.lottoChiuso}
          oggi={oggi}
          onEmetti={() => void emettiOra()}
          onInterrompi={() => lotto.interrompi()}
          onPrendiControllo={() => {
            void lotto
              .prendiIlControllo()
              .then((ok) => ok && toast.success("Hai il controllo: puoi emettere di nuovo"));
          }}
          onScaricaXml={p.onScaricaXml}
        />
      )}

      <Finestra
        aperta={!!daAnnullare}
        onCambio={(v) => !v && setDaAnnullare(null)}
        larghezza="sm"
        bloccante
        icona={Trash2}
        titolo="Annullo questo caricamento?"
        contesto={daAnnullare ? `${daAnnullare.file} file` : undefined}
        azioni={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => setDaAnnullare(null)}
            >
              Lascia stare
            </Button>
            <Button
              type="button"
              className="h-11 sm:h-9 bg-rose-600 hover:bg-rose-700"
              onClick={() => void annullaConfermato()}
            >
              Sì, annulla
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate-700">
          Le righe e gli screenshot di questo caricamento vengono cancellati. Le fatture già emesse
          restano dove sono. Per riprendere dovrai caricare di nuovo i file.
        </p>
      </Finestra>

      <Finestra
        aperta={nuovoElenco}
        onCambio={setNuovoElenco}
        larghezza="sm"
        icona={FileStack}
        titolo="Carico un altro elenco?"
        contesto="Quello di adesso è ancora aperto"
        azioni={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => setNuovoElenco(false)}
            >
              Lascia stare
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => void nuovoCaricamento(false)}
            >
              Tienilo aperto
            </Button>
            <Button
              type="button"
              className="h-11 sm:h-9"
              onClick={() => void nuovoCaricamento(true)}
            >
              Annullalo e ricomincia
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate-700">
          Un elenco nuovo è un caricamento nuovo. Quello attuale, se lo tieni aperto, lo ritrovi nel
          riquadro in cima alla pagina e i suoi screenshot restano fino a 30 giorni. Se lo annulli,
          righe e screenshot vengono cancellati subito.
        </p>
      </Finestra>
    </>
  );
}

/* ══ 3. «DALLA CHAT» (commessa 2026-11-13-fatture-dalla-chat, T8) ══════════
 *  Stesso schema di `CaricaBulkDaScreenshot`: il lavoro vive qui (`useLottoChat`,
 *  T7), non nella finestra — si chiude la finestra a metà ricerca/emissione e non
 *  si ferma niente, il riquadro in cima dice a che punto è (PIANO T8, come la
 *  bulk). Qui NON c'è «ricompone i file in gruppi»: ogni cliente arriva già con
 *  la sua scheda (SPEC §5, «l'abbinamento non si indovina, è già dato»), quindi
 *  non c'è una `SceltaFile`: il passo 1 è `ListaClientiChat` (candidati + ricerca
 *  manuale, SPEC §3 passo 1). */
/** Per T16 (SPEC §9.3 passo 6, §9.6): la riga del link che arriva dalla chat, se è ANCORA
 *  apribile — `undefined` se il link è vecchio (nessuna riga con quell'id in questo lotto, o
 *  una riga che c'è ma è già `emessa`/`scartata`): in quel caso chi chiama mostra l'avviso
 *  onesto («questa riga non c'è più…») invece di evidenziare niente. Pura: guarda solo
 *  l'elenco già valutato, non tocca lo stato né rifà i conti di `valutaLottoChat`. */
export function rigaApribileDelLink(
  righe: RigaValutata[],
  idRiga: string | undefined,
): RigaValutata | undefined {
  if (!idRiga) return undefined;
  return righe.find((r) => r.idRiga === idRiga && rigaAperta(r));
}

function CaricaDallaChat(
  p: PropsCaricaInBlocco & { modalita: Modalita; onModalita: (m: Modalita) => void },
) {
  const {
    onCambio,
    azienda,
    emesse,
    bozze,
    leads,
    caricando,
    modalita,
    onModalita,
    apriLotto,
    //  Rinominata: questo componente ha già una funzione locale `apriRiga` (apre il
    //  pannello di una riga, più sotto) — stesso nome, cosa diversa, nessuna relazione.
    apriRiga: apriRigaLink,
  } = p;
  const aperta = p.aperta && modalita === "chat";
  const { apriLead } = useRicerca();

  /* ── il contesto delle regole (stessa mappatura di CaricaBulkDaScreenshot: anteprima
   *   ed emissione devono abbinare le stesse schede, PIANO §0bis.2) ────────────────── */
  const schede = useMemo<SchedaPerAbbinamento[]>(
    () => (Array.isArray(leads) ? leads : []).map((l) => schedaDaLead(l.id, l.data ?? {})),
    [leads],
  );
  const schedeChat = useMemo(() => schedeChatDaLeads(Array.isArray(leads) ? leads : []), [leads]);
  const nomiSchede = useMemo(() => nomiSchedeDaLeads(leads), [leads]);
  const oggi = oggiItaliano();
  const costruito = useMemo<Omit<ContestoValutazione, "lotto">>(
    () => ({ azienda, oggi, emesse, bozze, schede, impronteAltriLotti: [] }),
    [azienda, oggi, emesse, bozze, schede],
  );
  const ultimoContesto = useRef<Omit<ContestoValutazione, "lotto"> | null>(null);
  if (!caricando) ultimoContesto.current = costruito;
  const lotto = useLottoChat({ contesto: ultimoContesto.current, schedeChat });
  const ultimo = useRef(lotto);
  ultimo.current = lotto;
  const { stato, righe } = lotto;

  /* ── stato della finestra ─────────────────────────────────────────────── */
  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [ricerca, setRicerca] = useState("");
  const [candidati, setCandidati] = useState<CandidatoChat[]>([]);
  const [caricandoCandidati, setCaricandoCandidati] = useState(false);
  const [erroreCandidati, setErroreCandidati] = useState<string | null>(null);
  // Vero finché non si è ancora premuto «Cerca nelle chat» almeno una volta su questo lotto
  // (o appena annullato/concluso): è il passo 1 della SPEC, prima dell'anteprima.
  const [mostraCandidati, setMostraCandidati] = useState(true);
  const [rigaSel, setRigaSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroRighe>("tutte");
  const [pagina, setPagina] = useState(0);
  const [aperti, setAperti] = useState<SintesiLottoChat[]>([]);
  const [daAnnullare, setDaAnnullare] = useState<{ lotto: string; clienti: number } | null>(null);
  const [faseEm, setFaseEm] = useState<FaseEmissione | null>(null);
  const [riepilogoFinale, setRiepilogoFinale] = useState<RiepilogoEmissione | null>(null);
  const [erroreChiuso, setErroreChiuso] = useState<unknown>(null);
  const ultimaRiga = useRef<string | null>(null);

  /* ── i candidati (passo 1): si leggono solo quando questa modalità è davvero
   *   aperta e non c'è ancora un lotto — niente richieste sprecate se non si
   *   apre mai «Dalla chat» (PIANO T8). Ricerca con un piccolo debounce. ───── */
  useEffect(() => {
    if (!aperta || stato.lotto) return;
    let vivo = true;
    setCaricandoCandidati(true);
    const attesa = ricerca.trim() ? 300 : 0;
    const t = setTimeout(() => {
      leggiRottaChat<CandidatoChat[]>(
        fetchCRM,
        `?candidati=1&q=${encodeURIComponent(ricerca.trim())}`,
      )
        .then((c) => {
          if (!vivo) return;
          setCandidati(c);
          setErroreCandidati(null);
        })
        .catch((e: unknown) => {
          if (!vivo) return;
          setCandidati([]);
          setErroreCandidati(
            e instanceof ErroreRotta ? e.messaggio : "Non riesco a leggere i clienti.",
          );
        })
        .finally(() => vivo && setCaricandoCandidati(false));
    }, attesa);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [aperta, ricerca, stato.lotto]);

  /* ── i lotti «dalla chat» rimasti aperti (alla prima apertura della pagina) ─ */
  const aggiornaAperti = useCallback(async () => {
    try {
      setAperti(await ultimo.current.lottiAperti());
    } catch {
      // Il riquadro semplicemente non compare: non è un errore da mostrare ogni volta.
    }
  }, []);
  const partito = useRef(false);
  useEffect(() => {
    if (caricando || partito.current) return;
    partito.current = true;
    void aggiornaAperti();
  }, [caricando, aggiornaAperti]);

  /* ── dati derivati ────────────────────────────────────────────────────── */
  const conti = useMemo(() => contaPerStato(righe), [righe]);
  const visibili = useMemo(() => filtraRighe(righe, filtro), [righe, filtro]);
  const apribili = useMemo(() => visibili.filter(rigaAperta), [visibili]);
  const nPronte = conti.pronto;
  const nEmettibili = useMemo(
    () => righe.filter((r) => r.emettibile && rigaAperta(r)).length,
    [righe],
  );
  const lavoro = stato.lavoro;
  const occupato = !!lavoro;
  const riga = rigaSel ? righe.find((r) => r.idRiga === rigaSel) : undefined;
  const rigaGrezza = rigaSel ? stato.righe.find((r) => r.idRiga === rigaSel) : undefined;
  const fatti = useMemo(
    () =>
      righe.length > 0
        ? fattiSulleDate(
            righe.map((r) => ({ idRiga: r.idRiga, data: r.campi.data })),
            emesse,
            azienda,
            oggi,
          )
        : null,
    [righe, emesse, azienda, oggi],
  );

  useEffect(() => {
    if (rigaSel && !riga && !occupato) setRigaSel(null);
  }, [rigaSel, riga, occupato]);
  useEffect(() => {
    if (rigaSel === null && ultimaRiga.current) {
      document.getElementById(`riga-chat-${ultimaRiga.current}`)?.focus();
      ultimaRiga.current = null;
    }
  }, [rigaSel]);

  const nPerAvviso = useCallback(
    (codice: string) =>
      !AVVISI_PER_TUTTE_CHAT.includes(codice)
        ? 0
        : righe.filter(
            (r) =>
              rigaAperta(r) &&
              r.motivi.some((m) => m.codice === codice && m.gravita === "conferma") &&
              !stato.righe.find((x) => x.idRiga === r.idRiga)?.confermeAvvisi?.includes(codice),
          ).length,
    [righe, stato.righe],
  );
  const avvisiPerTutte = useMemo(
    () =>
      [
        {
          codice: "data_anteriore",
          testo: (n: number) =>
            `${n} righe hanno una data di pagamento anteriore all'ultima fattura emessa: avranno un numero più alto della data. Apri una riga per leggere l'avviso per intero.`,
        },
        {
          codice: "oltre_12_giorni",
          testo: (n: number) =>
            `${n} righe hanno un pagamento di più di 12 giorni fa, cioè oltre il termine di invio allo SDI (stima). Apri una riga per leggere l'avviso per intero.`,
        },
      ]
        .map((a) => ({ codice: a.codice, n: nPerAvviso(a.codice), testo: a.testo }))
        .map((a) => ({ codice: a.codice, n: a.n, testo: a.testo(a.n) }))
        .filter((a) => a.n >= 2),
    [nPerAvviso],
  );
  const decisioni = useMemo(
    () =>
      Object.fromEntries(
        stato.righe.map((r) => [r.idRiga, { confermeAvvisi: r.confermeAvvisi, emessa: r.emessa }]),
      ),
    [stato.righe],
  );

  /* ── azioni ───────────────────────────────────────────────────────────── */
  const cercaNelleChatOra = async () => {
    const ids = [...scelti];
    if (ids.length === 0) return;
    let idLotto = stato.lotto;
    if (!idLotto) idLotto = await lotto.crea(DESCRIZIONI[0]);
    if (!idLotto) return;
    setScelti(new Set());
    setMostraCandidati(false);
    await lotto.cercaNelleChat(ids);
  };
  const riprendiDalBanner = async (id: string) => {
    onCambio(true);
    onModalita("chat");
    setMostraCandidati(false);
    await lotto.apri(id);
  };
  const apriRiga = (id: string) => {
    ultimaRiga.current = id;
    setRigaSel(id);
  };
  const tornaAllElenco = () => {
    const i = visibili.findIndex((r) => r.idRiga === rigaSel);
    if (i >= 0) setPagina(Math.floor(i / RIGHE_PER_PAGINA));
    setRigaSel(null);
  };
  const vaiAllaProssima = (dopo?: string) => {
    const i = dopo ? righe.findIndex((r) => r.idRiga === dopo) : -1;
    const giro = [...righe.slice(i + 1), ...righe.slice(0, i + 1)];
    const t = giro.find((r) => r.stato === "da_controllare" && r.idRiga !== dopo);
    if (t) apriRiga(t.idRiga);
    else toast.info("Non ce ne sono altre da controllare.");
  };
  const confermaTutte = async () => {
    const attese = nPronte;
    const n = await lotto.confermaTutteLePronte();
    if (n === 0 && attese > 0)
      toast.info("Non è partito: c'è un altro lavoro in corso. Riprova fra poco.");
    else if (n < attese)
      toast.warning(`Confermate ${n} righe su ${attese}`, {
        description: "Le altre restano da confermare: riprova.",
      });
    else toast.success(`Confermate ${n} ${n === 1 ? "riga" : "righe"}`);
  };
  const confermaAvviso = async (codice: string) => {
    const attese = nPerAvviso(codice);
    const n = await lotto.confermaAvvisoPerTutte(codice);
    if (n === 0 && attese > 0)
      toast.info("Non è partito: c'è un altro lavoro in corso. Riprova fra poco.");
    else if (n < attese) toast.warning(`Confermato su ${n} righe di ${attese}`);
    else toast.success(`Avviso confermato su ${n} righe`);
  };
  const emettiOra = async () => {
    setFaseEm("corso");
    const r = await lotto.emettiConfermate();
    if (r === null) {
      toast.info("Non è partito: c'è un altro lavoro in corso. Aspetta che finisca e riprova.");
      setFaseEm("conferma");
      return;
    }
    setRiepilogoFinale(r);
    setFaseEm("finale");
    p.onEmesso();
  };
  const nuovoCaricamento = () => {
    lotto.nuovoLotto();
    setScelti(new Set());
    setRicerca("");
    setMostraCandidati(true);
    setRigaSel(null);
    setFiltro("tutte");
    setPagina(0);
    void aggiornaAperti();
  };
  const annullaConfermato = async () => {
    if (!daAnnullare) return;
    const { lotto: id } = daAnnullare;
    setDaAnnullare(null);
    if (stato.lotto === id) {
      if (await lotto.annullaLotto()) {
        setScelti(new Set());
        setMostraCandidati(true);
        void aggiornaAperti();
      }
      return;
    }
    // Un lotto che non è in memoria si apre, e si annulla subito dopo: a differenza della
    // bulk (che aspetta un giro di render per leggere lo stato nuovo) l'orchestratore
    // aggiorna il suo specchio interno in modo sincrono dentro `apri`, quindi si può
    // incatenare `annullaLotto` senza un passo intermedio.
    await lotto.apri(id);
    await lotto.annullaLotto();
    void aggiornaAperti();
  };

  /* ── IL LINK DALLA CHAT (T15 → T16) ──────────────────────────────────────
   *  SPEC §9.3 passo 6, §9.6: con `apriLotto`/`apriRiga` (già validati dalla rotta) si apre
   *  da sola questa finestra, su quel lotto, con quella riga scorsa in vista. Un link
   *  vecchio (lotto annullato/concluso, riga già emessa/scartata) non è un errore bloccante:
   *  si apre comunque la lista, con l'avviso onesto (`rigaLinkMancante`).
   *  ⚠️ `tentatoApriLotto` fa partire `riprendiDalBanner` UNA sola volta per ogni valore di
   *   `apriLotto`: senza questa guardia, ogni nuovo render richiamerebbe `apri` da capo. */
  const tentatoApriLotto = useRef<string | null>(null);
  //  ⚠️ Catturato qui, non letto dal prop più avanti: `CRM.fatture.tsx` toglie `apriLotto`/
  //   `apriRiga` dall'URL appena li ha consumati (per non riaprire la finestra da sola a ogni
  //   remontaggio), quindi quando il secondo effetto gira il prop `apriRigaLink` può già
  //   essere `undefined` — il ref tiene il valore vero per tutta la durata di questo flusso.
  const rigaDelLinkRef = useRef<string | undefined>(undefined);
  const [apriLottoFinito, setApriLottoFinito] = useState(false);
  const [rigaLinkMancante, setRigaLinkMancante] = useState(false);
  const [rigaEvidenziata, setRigaEvidenziata] = useState<string | null>(null);

  useEffect(() => {
    if (!apriLotto || tentatoApriLotto.current === apriLotto) return;
    tentatoApriLotto.current = apriLotto;
    rigaDelLinkRef.current = apriRigaLink;
    void riprendiDalBanner(apriLotto).then(() => setApriLottoFinito(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apriLotto]);

  // Il lotto non si è aperto (link vecchio): niente errore bloccante, solo l'avviso onesto,
  // e si torna alla lista dei candidati (qui non c'è nessun lotto da mostrare in anteprima).
  useEffect(() => {
    if (!apriLottoFinito || tentatoApriLotto.current === null) return;
    if (stato.lotto !== tentatoApriLotto.current) {
      setRigaLinkMancante(true);
      setMostraCandidati(true);
      return;
    }
    const idRigaDelLink = rigaDelLinkRef.current;
    const trovata = rigaApribileDelLink(righe, idRigaDelLink);
    if (idRigaDelLink && !trovata) setRigaLinkMancante(true);
    else if (trovata) setRigaEvidenziata(trovata.idRiga);
  }, [apriLottoFinito, stato.lotto, righe]);

  // La riga da evidenziare può essere su una pagina diversa da quella corrente: si porta lì
  // PRIMA, così il bottone esiste davvero nel DOM quando il prossimo effetto lo cerca.
  useEffect(() => {
    if (!rigaEvidenziata) return;
    const i = visibili.findIndex((r) => r.idRiga === rigaEvidenziata);
    if (i >= 0) setPagina(Math.floor(i / RIGHE_PER_PAGINA));
  }, [rigaEvidenziata, visibili]);

  // Scroll ed evidenziazione (SPEC §9.6): stesso meccanismo già in uso per tornare sulla riga
  // dopo aver chiuso il pannello (`ultimaRiga`/`document.getElementById`), non uno nuovo — il
  // contorno visibile è lo stesso `focus-visible:ring-…` già sul bottone della riga.
  useEffect(() => {
    if (!rigaEvidenziata) return;
    const el = document.getElementById(`riga-chat-${rigaEvidenziata}`);
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
  }, [rigaEvidenziata, pagina]);

  /* ── il riquadro in cima alla pagina ──────────────────────────────────── */
  const inMemoria = stato.lotto !== null;
  const letti = (c: typeof conti) =>
    c.pronto + c.da_controllare + c.errore + c.confermata + c.emessa;
  const riquadro = (
    <>
      {inMemoria && !aperta && !stato.lottoChiuso && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
          role="status"
        >
          <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
            <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              {lavoro?.cosa === "ricerca"
                ? `Sto cercando nelle chat: letti ${lavoro.fatti} di ${lavoro.totale} clienti.`
                : lavoro?.cosa === "emissione"
                  ? `Sto emettendo le fatture: ${lavoro.fatti} di ${lavoro.totale}.`
                  : `Caricamento dalla chat in corso: ${conti.tutte} clienti, ${letti(conti)} letti, ${conti.da_controllare} da controllare.`}
            </span>
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              className="h-11 sm:h-8"
              onClick={() => {
                onCambio(true);
                onModalita("chat");
              }}
            >
              Apri
            </Button>
            {!occupato && (
              <Button
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                onClick={() => setDaAnnullare({ lotto: stato.lotto!, clienti: conti.tutte })}
              >
                Annulla
              </Button>
            )}
          </span>
        </div>
      )}
      {!inMemoria &&
        aperti.map((a) => (
          <div
            key={a.lotto}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
            role="status"
          >
            <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
              <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                Caricamento dalla chat in corso: {a.clienti} clienti, {a.letti} letti,{" "}
                {a.righeAperte} da emettere
                {a.righeEmesse > 0 ? `, ${a.righeEmesse} già emesse` : ""}.
              </span>
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                className="h-11 sm:h-8"
                disabled={occupato}
                onClick={() => void riprendiDalBanner(a.lotto)}
              >
                Riprendi
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 sm:h-8"
                disabled={occupato}
                onClick={() => setDaAnnullare({ lotto: a.lotto, clienti: a.clienti })}
              >
                Annulla
              </Button>
            </span>
          </div>
        ))}
    </>
  );

  /* ── il corpo della finestra ──────────────────────────────────────────── */
  const erroreMostrato = stato.errore && stato.errore !== erroreChiuso ? stato.errore : null;
  const avvisi = (
    <div className="space-y-2">
      {/*  ── IL LINK DALLA CHAT, VECCHIO (T16) ───────────────────────────────
          Non è un errore che blocca niente: la lista si apre comunque (qui, o nei
          candidati se il lotto stesso non c'è più) con un avviso onesto. */}
      {rigaLinkMancante && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          Questa riga non c&apos;è più: probabilmente è già stata emessa o scartata.
        </NotaFinestra>
      )}
      {erroreMostrato && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          <span role="alert" className="flex items-start justify-between gap-2">
            <span>{fraseDi(erroreMostrato.codice, erroreMostrato.messaggio)}</span>
            <button
              type="button"
              className="shrink-0 font-medium underline"
              onClick={() => setErroreChiuso(stato.errore)}
            >
              Chiudi
            </button>
          </span>
        </NotaFinestra>
      )}
      {stato.fermata && (
        <NotaFinestra tono="attenzione" icona={AlertTriangle}>
          {stato.fermata.per === "annullata"
            ? "Hai interrotto: quello che era già stato fatto resta."
            : `Mi sono fermato da solo dopo troppi errori di fila. ${stato.fermata.codice ? fraseDi(stato.fermata.codice) : ""}`}
        </NotaFinestra>
      )}
    </div>
  );

  let corpo: React.ReactNode;
  let piede: React.ReactNode = null;
  let titoloContesto = "";

  if (lavoro && lavoro.cosa !== "emissione" && lavoro.cosa !== "pagamento") {
    const etichette: Record<string, string> = {
      apertura: "Preparo il caricamento…",
      ricerca: `Letti ${lavoro.fatti} di ${lavoro.totale} clienti`,
      conferme: `Confermate ${lavoro.fatti} di ${lavoro.totale} righe`,
    };
    const v = lavoro.totale > 0 ? Math.round((lavoro.fatti / lavoro.totale) * 100) : 0;
    titoloContesto = etichette[lavoro.cosa] ?? "";
    corpo = (
      <div className="mx-auto max-w-xl space-y-4 py-6" aria-live="polite">
        <p className="text-[15px] font-semibold tabular-nums text-slate-900">
          {etichette[lavoro.cosa]}
        </p>
        <Progress
          value={v}
          aria-label="Avanzamento"
          className="h-2 bg-slate-200 [&>div]:bg-slate-700"
        />
        {lavoro.cosa === "ricerca" && (
          <p className="text-[12.5px] leading-relaxed text-slate-600">
            Possono passare alcuni minuti. Puoi chiudere questa finestra e fare altro nel CRM, ma la
            pagina deve restare aperta: il riquadro in cima dice a che punto siamo. Se la chiudi, si
            riprende da dove eri arrivato senza ripagare quello che è già stato letto.
          </p>
        )}
        {avvisi}
      </div>
    );
    piede =
      lavoro.cosa === "ricerca" ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => onCambio(false)}
          >
            Chiudi e continua
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-9"
            onClick={() => lotto.interrompi()}
          >
            Interrompi
          </Button>
        </>
      ) : null;
  } else if (mostraCandidati) {
    titoloContesto = "Scegli i clienti";
    corpo = (
      <div className="space-y-3">
        <SelettoreModalita modalita={modalita} onModalita={onModalita} disabilitato={occupato} />
        {avvisi}
        <ListaClientiChat
          candidati={candidati}
          caricando={caricandoCandidati}
          errore={erroreCandidati}
          ricerca={ricerca}
          onRicerca={setRicerca}
          scelti={scelti}
          onScelti={setScelti}
          occupato={occupato}
          onCerca={() => void cercaNelleChatOra()}
        />
        {righe.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-9 text-slate-600"
            onClick={() => setMostraCandidati(false)}
          >
            Torna all&apos;elenco di questo caricamento
          </Button>
        )}
      </div>
    );
    piede = (
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:h-9"
        onClick={() => onCambio(false)}
      >
        Chiudi
      </Button>
    );
  } else if (riga && rigaAperta(riga)) {
    const i = apribili.findIndex((r) => r.idRiga === riga.idRiga);
    titoloContesto = nomeDellaRiga(riga);
    corpo = (
      <div className="space-y-3">
        {avvisi}
        <PannelloRigaChat
          key={riga.idRiga}
          riga={riga}
          rigaChat={rigaGrezza}
          posizione={i + 1}
          totale={apribili.length}
          lotto={stato.lotto!}
          nomeScheda={nomiSchede.get(riga.scheda ?? "") ?? "Scheda non trovata"}
          occupato={occupato}
          nPerAvviso={nPerAvviso}
          onSalva={(c) => lotto.salvaRiga(riga.idRiga, c)}
          onCaricaPagamento={(file) => lotto.caricaPagamento(riga.idRiga, file)}
          onScriviPagamento={(corpo) => lotto.scriviPagamento(riga.idRiga, corpo)}
          onRileggiPagamento={() => void lotto.leggiPagamento(riga.idRiga)}
          onRileggiChat={() => void lotto.rileggiChat(riga.idRiga)}
          onConfermaPerTutte={(c) => void confermaAvviso(c)}
          onApriScheda={() => {
            onCambio(false);
            if (riga.scheda) apriLead(riga.scheda);
          }}
          onIndietro={tornaAllElenco}
          onPrecedente={i > 0 ? () => apriRiga(apribili[i - 1].idRiga) : null}
          onSuccessiva={
            i >= 0 && i < apribili.length - 1 ? () => apriRiga(apribili[i + 1].idRiga) : null
          }
          onProssima={conti.da_controllare > 0 ? () => vaiAllaProssima(riga.idRiga) : null}
        />
      </div>
    );
  } else if (stato.lottoChiuso) {
    titoloContesto = "Caricamento concluso";
    corpo = (
      <div className="mx-auto max-w-md space-y-3 py-8 text-center">
        <p className="text-[15px] font-semibold text-slate-900">
          Tutte le righe sono emesse o scartate.
        </p>
        <p className="text-[12.5px] text-slate-600">
          Lo screenshot del bonifico è stato cancellato. Se ti serve un altro caricamento,
          ricomincia da capo.
        </p>
        <Button type="button" className="h-11 sm:h-9" onClick={nuovoCaricamento}>
          Nuovo caricamento
        </Button>
      </div>
    );
  } else {
    titoloContesto = `${conti.tutte} ${conti.tutte === 1 ? "cliente" : "clienti"} · ${conti.pronto} pronte · ${conti.da_controllare} da controllare · ${conti.errore} errori`;
    corpo = (
      <div className="space-y-3">
        <SelettoreModalita modalita={modalita} onModalita={onModalita} disabilitato={occupato} />
        {avvisi}
        <AnteprimaChat
          righe={righe}
          decisioni={decisioni}
          filtro={filtro}
          onFiltro={(f) => {
            setFiltro(f);
            setPagina(0);
          }}
          pagina={pagina}
          onPagina={setPagina}
          occupato={occupato}
          nPronte={nPronte}
          avvisiPerTutte={avvisiPerTutte}
          onApri={apriRiga}
          onProssima={() => vaiAllaProssima()}
          onConfermaTutte={() => void confermaTutte()}
          onConfermaAvviso={(c) => void confermaAvviso(c)}
        />
        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-9 text-slate-600"
            disabled={occupato}
            onClick={() => setMostraCandidati(true)}
          >
            Aggiungi altri clienti
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 sm:h-9 text-rose-700 hover:text-rose-800"
            disabled={occupato}
            onClick={() => setDaAnnullare({ lotto: stato.lotto!, clienti: conti.tutte })}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Annulla questo caricamento
          </Button>
        </div>
      </div>
    );
    piede = (
      <>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => onCambio(false)}
        >
          Chiudi
        </Button>
        <Button
          type="button"
          className="h-11 sm:h-9 sm:min-w-52"
          disabled={occupato || nEmettibili === 0}
          onClick={() => setFaseEm("conferma")}
        >
          Emetti le confermate ({nEmettibili})
        </Button>
      </>
    );
  }

  return (
    <>
      {riquadro}

      <Finestra
        aperta={aperta}
        onCambio={onCambio}
        larghezza="xl"
        icona={MessageCircle}
        titolo="Carica in blocco"
        contesto={titoloContesto || undefined}
        azioni={piede}
        classeCorpo="min-h-[50vh]"
      >
        {corpo}
      </Finestra>

      {faseEm && (
        <RiepilogoEmissioneBulk
          aperta
          onCambio={(v) => {
            if (!v && faseEm !== "corso") setFaseEm(null);
          }}
          fase={faseEm}
          righe={righe}
          fatti={fatti}
          emesse={emesse}
          azienda={azienda}
          avanzamento={
            lavoro?.cosa === "emissione" ? { fatti: lavoro.fatti, totale: lavoro.totale } : null
          }
          riepilogo={riepilogoFinale}
          lottoChiuso={stato.lottoChiuso}
          oggi={oggi}
          onEmetti={() => void emettiOra()}
          onInterrompi={() => lotto.interrompi()}
          onPrendiControllo={() => {
            void lotto
              .prendiIlControllo()
              .then((ok) => ok && toast.success("Hai il controllo: puoi emettere di nuovo"));
          }}
          onScaricaXml={p.onScaricaXml}
        />
      )}

      <Finestra
        aperta={!!daAnnullare}
        onCambio={(v) => !v && setDaAnnullare(null)}
        larghezza="sm"
        bloccante
        icona={Trash2}
        titolo="Annullo questo caricamento?"
        contesto={daAnnullare ? `${daAnnullare.clienti} clienti` : undefined}
        azioni={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => setDaAnnullare(null)}
            >
              Lascia stare
            </Button>
            <Button
              type="button"
              className="h-11 sm:h-9 bg-rose-600 hover:bg-rose-700"
              onClick={() => void annullaConfermato()}
            >
              Sì, annulla
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate-700">
          Le righe e lo screenshot del bonifico di questo caricamento vengono cancellati. Le fatture
          già emesse restano dove sono. Per riprendere dovrai scegliere di nuovo i clienti.
        </p>
      </Finestra>
    </>
  );
}

/** `nome cognome` per ogni lead, per l'etichetta «Scheda cliente collegata» del pannello
 *  (SPEC §5): qui serve solo per mostrare un nome, non per abbinare — l'abbinamento vero
 *  (per CF diverso dalla scheda) resta quello di `bulk/valuta.ts`, non toccato. */
function nomiSchedeDaLeads(leads: Lead[]): Map<string, string> {
  return new Map(
    (Array.isArray(leads) ? leads : []).map((l) => [
      l.id,
      `${l.data?.nome ?? ""} ${l.data?.cognome ?? ""}`.trim() || "senza nome",
    ]),
  );
}

/* ══ 4. IL COMPONENTE DELLA PAGINA (le due porte d'ingresso, SPEC §1/§3) ═══
 *  `CaricaInBloccoFatture` non ha più corpo proprio: sceglie solo la modalità e
 *  monta SEMPRE entrambe le finestre (PIANO T8) — una visibile, l'altra con il
 *  lavoro che continua in background, come già faceva la bulk con la finestra
 *  chiusa. Firma identica a prima (`PropsCaricaInBlocco`): zero cambi per chi
 *  la chiama (`src/routes/CRM.fatture.tsx`). */
/** La modalità INIZIALE di «Carica in blocco» (T16, correzione del revisore su `523eb98`,
 *  punto 2): «chat» da subito se si arriva con un lotto dal link della chat, altrimenti «Da
 *  screenshot» come sempre. Pura e nominata apposta, si prova senza montare niente. */
export function modalitaAllArrivo(apriLotto: string | undefined): Modalita {
  return apriLotto ? "chat" : "screenshot";
}

export function CaricaInBloccoFatture(p: PropsCaricaInBlocco) {
  //  Il link dalla chat (T15 → T16, SPEC §9.3 passo 6): con `apriLotto` già nel primo render
  //  si parte direttamente su «Dalla chat», non su «Da screenshot» — altrimenti il titolare
  //  dovrebbe cambiare modalità a mano per vedere la riga che è venuto a controllare. Lazy
  //  init: valutata una volta sola, su `p.apriLotto` COM'ERA al montaggio (vedi `CaricaDallaChat`
  //  per il motivo per cui l'URL perde quel parametro poco dopo, e perché qui non serve
  //  rincorrerlo con un effetto).
  const [modalita, setModalita] = useState<Modalita>(() => modalitaAllArrivo(p.apriLotto));
  return (
    <>
      <CaricaBulkDaScreenshot {...p} modalita={modalita} onModalita={setModalita} />
      <CaricaDallaChat {...p} modalita={modalita} onModalita={setModalita} />
    </>
  );
}
