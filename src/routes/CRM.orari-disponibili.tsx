/** ─────────────────────────────────────────────────────────────────────────
 *  GLI ORARI DA CUI NASCONO GLI APPUNTAMENTI
 *
 *  PRIMA DI TUTTO: DI CHI SONO QUESTI ORARI
 *  In cima c'è una sola domanda, e viene prima di ogni campo: si sta
 *  configurando UN consulente, oppure TUTTI. Cambiare fasce orarie senza sapere
 *  a chi appartengono è l'errore che si fa una volta e si paga per settimane —
 *  l'agenda smette di proporre la persona giusta e nessuno sa perché.
 *
 *  LE TRE COSE CHE SI FANNO QUI
 *   · LA SETTIMANA TIPO DI UN CONSULENTE — giorni lavorativi, fasce e pause.
 *     Si compila un giorno e lo si stende sugli altri con un tocco: scriverli
 *     sette volte a mano è il motivo per cui prima restavano quelli di default;
 *   · I BLOCCHI PER TUTTI — chiusure che valgono per l'intero centro: un
 *     giorno di festa, la riunione del lunedì mattina. Tolgono disponibilità a
 *     chiunque, quindi vanno scritti in un posto solo (crm/blocchi.ts) e letti
 *     dal calcolo degli orari liberi;
 *   · GLI ORARI DEL FUNNEL — quello che il cliente vede quando prenota da solo.
 *     È una cosa diversa dagli orari dei consulenti e resta separata a schermo.
 *
 *  LA SCADENZA DEI BLOCCHI
 *  Ogni blocco può avere un giorno oltre il quale non vale più. Serve perché i
 *  blocchi temporanei — un mese di lavori, una persona in malattia — altrimenti
 *  restano lì per sempre. Un blocco scaduto NON sparisce: si spegne, resta
 *  scritto con il suo motivo, e si riaccende spostando la data.
 *
 *  QUANTO SIAMO APERTI
 *  In cima c'è il conto delle ore prenotabili nella settimana. Chi imposta gli
 *  orari non sa mai se ha chiuso troppo, e se ne accorge quando l'agenda non
 *  propone più niente a nessuno.
 *
 *  Tutte le modifiche si salvano subito: qui non esiste una bozza da
 *  confermare, quello che si vede è quello che vedono i clienti.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
//  Quante persone stanno nella stessa fascia: il numero si cambia qui, e il
//  calcolo degli orari lo legge da un registro in memoria (vedi crm/capienza).
import { CAPIENZA_PREDEFINITA, capienzaConsulenza } from "@/crm/booking-utils";
import { assicuraCapienza, salvaCapienza } from "@/crm/capienza";
import {
  useFunnelSettings,
  slotsForDate,
  dayStatus,
  DEFAULT_SLOTS,
  type FunnelSettings,
  type SlotsMode,
} from "@/crm/useFunnelSettings";
import { pauseDelGiorno } from "@/crm/booking-utils";
import {
  assicuraBlocchi,
  descriviBlocco,
  intervalliBloccati,
  oreDelGiorno,
  oreLeggibili,
  salvaBlocchi,
  scriviPauseDelGiorno,
  statoBlocco,
  type BloccoDisponibilita,
  type StatoBlocco,
} from "@/crm/blocchi";
import type { Consultant, ConsultantData, FasciaOraria, Pausa } from "@/crm/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  X,
  ArrowLeft,
  Calendar as CalendarIcon,
  Copy as CopyIcon,
  CalendarOff,
  Ban,
  Users,
  User,
  Coffee,
  Power,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { formatDate } from "@/lib/date-format";

export const Route = createFileRoute("/CRM/orari-disponibili")({
  component: DisponibilitaPage,
});

const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const WEEKDAYS_LONG = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];
// Ordine settimanale ISO (Lun → Dom) per il template
const WEEK_ISO: { dow: number; label: string }[] = [
  { dow: 1, label: "Lunedì" },
  { dow: 2, label: "Martedì" },
  { dow: 3, label: "Mercoledì" },
  { dow: 4, label: "Giovedì" },
  { dow: 5, label: "Venerdì" },
  { dow: 6, label: "Sabato" },
  { dow: 0, label: "Domenica" },
];
const FERIALI = [1, 2, 3, 4, 5];

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** I sette giorni della settimana (lun → dom) che contengono la data data.
 *  Una data illeggibile non è "oggi": si torna alla settimana corrente, che è
 *  l'unica risposta onesta quando non si sa di che giorno si parla. */
function settimanaDi(isoDate: string): string[] {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? new Date(`${isoDate}T00:00:00`) : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;
  d.setHours(0, 0, 0, 0);
  const scarto = (d.getDay() + 6) % 7; // lunedì = 0
  const lunedi = new Date(d);
  lunedi.setDate(d.getDate() - scarto);
  return Array.from({ length: 7 }, (_, i) => {
    const g = new Date(lunedi);
    g.setDate(lunedi.getDate() + i);
    return isoOf(g);
  });
}

/** Le fasce che valgono davvero per un giorno.
 *  ⚠️ Deve restare identica a `getFasceForDay` di booking-utils: un elenco
 *  vuoto NON chiude il giorno, fa ricadere sulle fasce generali. Mostrarlo come
 *  "chiuso" qui e vederlo aperto in agenda è il tipo di bugia che fa fissare
 *  appuntamenti dentro a un giorno che si credeva spento. */
function fasceEffettive(
  d: ConsultantData,
  dow: number,
): { fasce: FasciaOraria[]; ereditate: boolean } {
  const proprie = d.fasceOrarieGiorno?.[dow];
  if (proprie && proprie.length > 0) return { fasce: proprie, ereditate: false };
  return { fasce: d.fasceOrarie || [], ereditate: true };
}

function nomeConsulente(c: Consultant): string {
  return c.data.nome?.trim() || "Senza nome";
}

// ── COLORE = SEGNALE ────────────────────────────────────────────────────────
//  Verde/ambra/rosso qui vogliono dire una cosa sola: quanto è aperto. Non si
//  usano per decorare i giorni della settimana.
const TONO_STATO_BLOCCO: Record<StatoBlocco, string> = {
  attivo: "border-destructive/40 bg-destructive/5",
  scaduto: "border-border bg-muted/40 opacity-80",
  spento: "border-border bg-muted/40 opacity-80",
  da_controllare: "border-amber-500/40 bg-amber-500/10",
};
const ETICHETTA_STATO_BLOCCO: Record<StatoBlocco, string> = {
  attivo: "Attivo",
  scaduto: "Scaduto",
  spento: "Spento",
  da_controllare: "Scadenza da controllare",
};

function DisponibilitaPage() {
  const { user } = useAuth();
  if (!user)
    return (
      <div className="p-6 text-sm text-muted-foreground">Accedi per gestire la disponibilità.</div>
    );
  return <DisponibilitaInner userId={user.id} />;
}

function DisponibilitaInner({ userId }: { userId: string }) {
  const { settings, loading, saving, update } = useFunnelSettings(userId);
  const { consultants, updateConsultant } = useCRM();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const oggi = useMemo(() => isoOf(today), [today]);

  // ── CHI SI STA CONFIGURANDO: la prima decisione, prima di ogni campo ──
  const [chi, setChi] = useState<string>("tutti");
  const [selectedDate, setSelectedDate] = useState<string>(isoOf(today));

  // ── I BLOCCHI (con scadenza), letti una volta e tenuti qui ──
  const [blocchi, setBlocchi] = useState<BloccoDisponibilita[]>([]);
  const [blocchiPronti, setBlocchiPronti] = useState(false);
  const [salvandoBlocchi, setSalvandoBlocchi] = useState(false);

  useEffect(() => {
    let vivo = true;
    assicuraBlocchi()
      .then((l) => {
        if (!vivo) return;
        setBlocchi(l);
        setBlocchiPronti(true);
      })
      .catch(() => {
        if (vivo) setBlocchiPronti(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const scriviBlocchi = useCallback(async (prossimi: BloccoDisponibilita[]) => {
    setSalvandoBlocchi(true);
    const esito = await salvaBlocchi(prossimi);
    setSalvandoBlocchi(false);
    if (!esito.ok) {
      toast.error(esito.errore || "Blocchi non salvati");
      return false;
    }
    setBlocchi(prossimi);
    return true;
  }, []);

  const consulentiOrdinati = useMemo(
    () =>
      [...consultants].sort((a, b) => {
        const attivoA = a.data.attivo === false ? 1 : 0;
        const attivoB = b.data.attivo === false ? 1 : 0;
        if (attivoA !== attivoB) return attivoA - attivoB;
        return nomeConsulente(a).localeCompare(nomeConsulente(b), "it");
      }),
    [consultants],
  );

  const consulenteScelto = useMemo(
    () => (chi === "tutti" ? null : (consulentiOrdinati.find((c) => c.id === chi) ?? null)),
    [chi, consulentiOrdinati],
  );

  const settimana = useMemo(() => settimanaDi(selectedDate), [selectedDate]);

  // ── QUANTO SI È APERTI, per la settimana mostrata ──
  const oreSettimana = useMemo(() => {
    const perConsulente = consulentiOrdinati.map((c) => {
      const giorni = settimana.map((dataIso) => {
        const dow = new Date(`${dataIso}T00:00:00`).getDay();
        const { fasce } = fasceEffettive(c.data, dow);
        return {
          dataIso,
          dow,
          ore: oreDelGiorno({
            lavorativo: (c.data.giorniLavorativi || []).includes(dow),
            fasce,
            pause: pauseDelGiorno(c, dow),
            blocchi: intervalliBloccati(blocchi, c.id, dataIso, oggi),
          }),
        };
      });
      return {
        consulente: c,
        //  Un consulente non attivo non riceve appuntamenti: le sue ore
        //  restano a schermo (servono a capire com'è configurato) ma NON
        //  entrano nel totale, altrimenti il centro sembra aperto il doppio di
        //  quanto è davvero.
        conta: c.data.attivo !== false,
        giorni,
        netti: giorni.reduce((n, g) => n + g.ore.netti, 0),
        tolti: giorni.reduce((n, g) => n + g.ore.tolti, 0),
      };
    });
    const contati = perConsulente.filter((r) => r.conta);
    return {
      perConsulente,
      netti: contati.reduce((n, r) => n + r.netti, 0),
      tolti: contati.reduce((n, r) => n + r.tolti, 0),
    };
  }, [consulentiOrdinati, settimana, blocchi, oggi]);

  const oreDelloScelto = useMemo(
    () =>
      consulenteScelto
        ? oreSettimana.perConsulente.find((r) => r.consulente.id === consulenteScelto.id)
        : undefined,
    [oreSettimana, consulenteScelto],
  );

  // Gli orari che il funnel propone nella settimana mostrata: è il numero che
  // dice se un cliente, da solo, trova qualcosa da prenotare.
  const slotFunnelSettimana = useMemo(
    () => settimana.reduce((n, d) => n + slotsForDate(settings, d).length, 0),
    [settings, settimana],
  );

  const blocchiPerTutti = useMemo(() => blocchi.filter((b) => !b.consulenteId), [blocchi]);
  const blocchiDelloScelto = useMemo(
    () => (consulenteScelto ? blocchi.filter((b) => b.consulenteId === consulenteScelto.id) : []),
    [blocchi, consulenteScelto],
  );

  const aggiornaConsulente = useCallback(
    async (id: string, patch: Partial<ConsultantData>) => {
      await updateConsultant(id, patch);
    },
    [updateConsultant],
  );

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Caricamento…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            to="/CRM/nuovi-contatti"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Torna ai nuovi contatti
          </Link>
        </div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          <CalendarIcon className="h-5 w-5" /> Disponibilità
        </h1>
        <p className="text-xs text-muted-foreground">
          Gli orari di ogni consulente, le chiusure che valgono per tutti e quello che i clienti
          possono prenotare dal funnel.
        </p>
      </div>

      {/* ── PRIMA DECISIONE: DI CHI SONO QUESTI ORARI ────────────────────────
          Sta sopra ogni campo, e resta visibile mentre si scorre: modificare
          fasce orarie senza sapere di chi sono è l'errore che non si vede. */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Stai configurando
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setChi("tutti")}
            aria-pressed={chi === "tutti"}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-[12.5px] font-semibold transition-colors ${
              chi === "tutti"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:border-foreground/40"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Tutti i consulenti
          </button>
          {consulentiOrdinati.map((c) => {
            const attivo = chi === c.id;
            const spento = c.data.attivo === false;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChi(c.id)}
                aria-pressed={attivo}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-[12.5px] font-semibold transition-colors ${
                  attivo
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:border-foreground/40"
                } ${spento && !attivo ? "opacity-60" : ""}`}
                title={spento ? "Consulente non attivo: non riceve appuntamenti" : undefined}
              >
                <User className="h-3.5 w-3.5" />
                {nomeConsulente(c)}
                {spento && <span className="text-[11px] font-normal">· non attivo</span>}
              </button>
            );
          })}
          {consulentiOrdinati.length === 0 && (
            <span className="text-xs text-muted-foreground py-2">
              Nessun consulente ancora inserito: si aggiungono da «Collaboratori».
            </span>
          )}
        </div>
      </div>

      {/* ── QUANTO SIAMO APERTI ─────────────────────────────────────────────── */}
      <ContatoreOre
        settimana={settimana}
        consulenteScelto={consulenteScelto}
        righe={
          consulenteScelto ? (oreDelloScelto ? [oreDelloScelto] : []) : oreSettimana.perConsulente
        }
        nettiTotali={consulenteScelto ? (oreDelloScelto?.netti ?? 0) : oreSettimana.netti}
        toltiTotali={consulenteScelto ? (oreDelloScelto?.tolti ?? 0) : oreSettimana.tolti}
        slotFunnel={consulenteScelto ? null : slotFunnelSettimana}
        onScegliGiorno={setSelectedDate}
        selectedDate={selectedDate}
      />

      {!blocchiPronti && (
        <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Carico i blocchi salvati…
        </div>
      )}

      {consulenteScelto ? (
        <PannelloConsulente
          key={consulenteScelto.id}
          consulente={consulenteScelto}
          blocchi={blocchi}
          blocchiSuoi={blocchiDelloScelto}
          blocchiPerTutti={blocchiPerTutti}
          settimana={settimana}
          oggi={oggi}
          salvando={salvandoBlocchi}
          onSalvaConsulente={aggiornaConsulente}
          onSalvaBlocchi={scriviBlocchi}
          onVaiATutti={() => setChi("tutti")}
        />
      ) : (
        <PannelloTutti
          blocchi={blocchi}
          blocchiPerTutti={blocchiPerTutti}
          consulenti={consulentiOrdinati}
          oggi={oggi}
          salvando={salvandoBlocchi}
          onSalvaBlocchi={scriviBlocchi}
          settings={settings}
          update={update}
          saving={saving}
          today={today}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUANTO SIAMO APERTI
   Un numero solo in grande, e sotto la settimana giorno per giorno. Serve a
   rispondere prima di sbagliare: ho chiuso troppo?
   ═════════════════════════════════════════════════════════════════════════ */

interface RigaOre {
  consulente: Consultant;
  /** false = consulente non attivo: si mostra ma non fa numero. */
  conta: boolean;
  giorni: {
    dataIso: string;
    dow: number;
    ore: { netti: number; tolti: number; lordi: number; conBlocchi: boolean };
  }[];
  netti: number;
  tolti: number;
}

function ContatoreOre({
  settimana,
  consulenteScelto,
  righe,
  nettiTotali,
  toltiTotali,
  slotFunnel,
  onScegliGiorno,
  selectedDate,
}: {
  settimana: string[];
  consulenteScelto: Consultant | null;
  righe: RigaOre[];
  nettiTotali: number;
  toltiTotali: number;
  slotFunnel: number | null;
  onScegliGiorno: (d: string) => void;
  selectedDate: string;
}) {
  const vuoto = nettiTotali === 0;
  //  Le barrette e il totale raccontano chi riceve davvero appuntamenti: un
  //  consulente non attivo resta nell'elenco sotto, ma non gonfia il conto.
  //  Quando però si sta guardando UNA persona, si guarda quella: nasconderle le
  //  ore perché è disattivata farebbe sembrare vuota una settimana piena.
  const contate = consulenteScelto ? righe : righe.filter((r) => r.conta);
  //  Il massimo giornaliero serve solo a dare una scala alle barrette: senza,
  //  un giorno da 8 ore e uno da 2 sembrano uguali.
  const maxGiorno = Math.max(60, ...contate.flatMap((r) => r.giorni.map((g) => g.ore.netti)));
  const sceltoSpento = consulenteScelto?.data.attivo === false;
  return (
    <Card className={vuoto ? "border-destructive/40" : undefined}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ore prenotabili · settimana del {formatDate(settimana[0], { short: true })}
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span
                className={`text-3xl font-semibold tabular-nums ${vuoto ? "text-destructive" : ""}`}
              >
                {oreLeggibili(nettiTotali)}
              </span>
              <span className="text-xs text-muted-foreground">
                {consulenteScelto
                  ? nomeConsulente(consulenteScelto)
                  : `${contate.length} consulenti attivi`}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
            {toltiTotali > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-800">
                <Ban className="h-3 w-3" />
                {oreLeggibili(toltiTotali)} tolte da pause e blocchi
              </span>
            )}
            {slotFunnel !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold">{slotFunnel}</span>
                <span className="text-muted-foreground">orari sul funnel</span>
              </span>
            )}
          </div>
        </div>

        {vuoto && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <TriangleAlert className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>
              Nessuna ora prenotabile in questa settimana: l'agenda non proporrà niente. Controlla
              giorni lavorativi, fasce orarie e blocchi attivi.
            </span>
          </div>
        )}

        {/* Configurare gli orari di chi è disattivato è tempo buttato, e non si
            capisce guardando le fasce: va detto qui. */}
        {sceltoSpento && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
            <TriangleAlert className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>
              Questo consulente non è attivo: qualunque orario qui non viene proposto a nessuno. Si
              riattiva dalla pagina «Collaboratori».
            </span>
          </div>
        )}

        {/* La settimana, giorno per giorno: si preme un giorno per portarci il
            resto della pagina (calendario ed eccezioni). */}
        <div className="grid grid-cols-7 gap-1">
          {settimana.map((dataIso, i) => {
            const minuti = contate.reduce(
              (n, r) => n + (r.giorni.find((g) => g.dataIso === dataIso)?.ore.netti ?? 0),
              0,
            );
            const bloccato = contate.some(
              (r) => r.giorni.find((g) => g.dataIso === dataIso)?.ore.conBlocchi,
            );
            const scelto = dataIso === selectedDate;
            const altezza = Math.round((Math.min(minuti, maxGiorno) / maxGiorno) * 26);
            return (
              <button
                key={dataIso}
                type="button"
                onClick={() => onScegliGiorno(dataIso)}
                className={`rounded-md border px-1 pt-1.5 pb-1 text-center transition-colors ${
                  scelto ? "border-foreground" : "border-border hover:border-foreground/40"
                }`}
                title={`${WEEKDAYS_LONG[(i + 1) % 7]} · ${oreLeggibili(minuti)}`}
              >
                <div className="text-[11px] font-semibold text-muted-foreground">
                  {WEEKDAYS_SHORT[new Date(`${dataIso}T00:00:00`).getDay()]}
                </div>
                <div className="flex items-end justify-center h-[28px]">
                  <div
                    className={`w-full rounded-sm ${
                      minuti === 0 ? "bg-muted" : bloccato ? "bg-amber-500/70" : "bg-emerald-500/70"
                    }`}
                    style={{ height: `${Math.max(3, altezza)}px` }}
                  />
                </div>
                <div className="text-[11px] tabular-nums">
                  {minuti === 0 ? "—" : oreLeggibili(minuti)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Con più consulenti il totale non basta: chi ha chiuso troppo si vede
            solo riga per riga. */}
        {!consulenteScelto && righe.length > 1 && (
          <div className="space-y-1 pt-1 border-t">
            {righe.map((r) => (
              <div key={r.consulente.id} className="flex items-center gap-3 text-xs">
                <span className="w-40 truncate font-medium">{nomeConsulente(r.consulente)}</span>
                <span
                  className={`tabular-nums font-semibold ${r.netti === 0 ? "text-destructive" : ""}`}
                >
                  {oreLeggibili(r.netti)}
                </span>
                {r.tolti > 0 && (
                  <span className="text-muted-foreground">− {oreLeggibili(r.tolti)} tolte</span>
                )}
                {r.consulente.data.attivo === false && (
                  <span className="text-muted-foreground">· non attivo</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   UN CONSULENTE: settimana tipo, pause, eccezioni e blocchi suoi
   ═════════════════════════════════════════════════════════════════════════ */

function PannelloConsulente({
  consulente,
  blocchi,
  blocchiSuoi,
  blocchiPerTutti,
  settimana,
  oggi,
  salvando,
  onSalvaConsulente,
  onSalvaBlocchi,
  onVaiATutti,
}: {
  consulente: Consultant;
  blocchi: BloccoDisponibilita[];
  blocchiSuoi: BloccoDisponibilita[];
  blocchiPerTutti: BloccoDisponibilita[];
  settimana: string[];
  oggi: string;
  salvando: boolean;
  onSalvaConsulente: (id: string, patch: Partial<ConsultantData>) => Promise<void>;
  onSalvaBlocchi: (prossimi: BloccoDisponibilita[]) => Promise<boolean>;
  onVaiATutti: () => void;
}) {
  const d = consulente.data;
  const lavorativi = d.giorniLavorativi || [];

  const patch = useCallback(
    (p: Partial<ConsultantData>) => onSalvaConsulente(consulente.id, p),
    [consulente.id, onSalvaConsulente],
  );

  // ── Giorni lavorativi ──
  const apriChiudiGiorno = async (dow: number) => {
    const aperto = lavorativi.includes(dow);
    if (aperto && !confirm(`Chiudere ${WEEKDAYS_LONG[dow]} per ${nomeConsulente(consulente)}?`))
      return;
    await patch({
      giorniLavorativi: aperto ? lavorativi.filter((x) => x !== dow) : [...lavorativi, dow].sort(),
    });
  };

  // ── Fasce del giorno ──
  const scriviFasce = async (dow: number, fasce: FasciaOraria[]) => {
    const per = { ...(d.fasceOrarieGiorno || {}) };
    if (fasce.length === 0) delete per[dow];
    else per[dow] = fasce;
    await patch({ fasceOrarieGiorno: per });
  };

  const aggiungiFascia = async (dow: number) => {
    const { fasce } = fasceEffettive(d, dow);
    await scriviFasce(dow, [...fasce, { inizio: "09:00", fine: "13:00" }]);
  };

  const cambiaFascia = async (
    dow: number,
    indice: number,
    campo: "inizio" | "fine",
    valore: string,
  ) => {
    if (!/^\d{2}:\d{2}$/.test(valore)) return;
    const { fasce } = fasceEffettive(d, dow);
    const next = fasce.map((f, i) => (i === indice ? { ...f, [campo]: valore } : f));
    await scriviFasce(dow, next);
  };

  const rimuoviFascia = async (dow: number, indice: number) => {
    const { fasce } = fasceEffettive(d, dow);
    await scriviFasce(
      dow,
      fasce.filter((_, i) => i !== indice),
    );
  };

  /** ── COPIARE UN GIORNO SUGLI ALTRI DEVE COSTARE UN TOCCO ────────────────
   *  Si compila il lunedì per bene e lo si stende. Due destinazioni, perché
   *  sono due intenzioni diverse: «lun–ven» APRE anche i giorni chiusi (è
   *  quello che si intende con "stesso orario tutti i feriali"), «giorni già
   *  aperti» non riapre niente per sbaglio. */
  const copiaGiorno = async (
    dow: number,
    destinazioni: number[],
    apri: boolean,
    descrizione: string,
  ) => {
    const { fasce } = fasceEffettive(d, dow);
    if (fasce.length === 0) {
      toast.error(`${WEEKDAYS_LONG[dow]} non ha fasce orarie: aggiungine una prima di copiarlo.`);
      return;
    }
    const target = destinazioni.filter((x) => x !== dow && (apri || lavorativi.includes(x)));
    if (target.length === 0) {
      toast.error("Nessun giorno da aggiornare: gli altri giorni sono chiusi.");
      return;
    }
    if (
      !confirm(
        `Copiare le ${fasce.length} fasce di ${WEEKDAYS_LONG[dow]} su ${descrizione}?\n\n` +
          `Le fasce già presenti su quei giorni verranno sostituite` +
          (apri ? " e i giorni chiusi verranno riaperti." : "."),
      )
    )
      return;
    const per = { ...(d.fasceOrarieGiorno || {}) };
    target.forEach((x) => {
      per[x] = fasce.map((f) => ({ ...f }));
    });
    const giorni = apri ? [...new Set([...lavorativi, ...target])].sort() : lavorativi;
    await patch({ fasceOrarieGiorno: per, giorniLavorativi: giorni });
    toast.success(`Orario di ${WEEKDAYS_LONG[dow]} copiato su ${target.length} giorni`);
  };

  // ── Pause ──
  const scriviPause = async (dow: number, pause: Pausa[]) => {
    await patch({ pause: scriviPauseDelGiorno(d, dow, pause) });
  };

  // ── Eccezioni su data singola (indisponibilità già lette da booking-utils) ──
  const indisponibilita = d.indisponibilita || [];
  const aggiungiIndisponibilita = async (
    data: string,
    inizio?: string,
    fine?: string,
    motivo?: string,
  ) => {
    await patch({ indisponibilita: [...indisponibilita, { data, inizio, fine, motivo }] });
  };
  const rimuoviIndisponibilita = async (indice: number) => {
    await patch({ indisponibilita: indisponibilita.filter((_, i) => i !== indice) });
  };

  return (
    <div className="space-y-4">
      {/* ── SETTIMANA TIPO ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Settimana tipo di {nomeConsulente(consulente)}
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            I giorni aperti e le fasce di lavoro. Un giorno senza fasce proprie usa l'orario
            generale qui sotto: per chiuderlo davvero va spento con «Chiudi».
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {WEEK_ISO.map(({ dow, label }) => {
            const aperto = lavorativi.includes(dow);
            const { fasce, ereditate } = fasceEffettive(d, dow);
            const pause = pauseDelGiorno(consulente, dow);
            const dataDelDow = settimana.find((x) => new Date(`${x}T00:00:00`).getDay() === dow);
            const intervalli = dataDelDow
              ? intervalliBloccati(blocchi, consulente.id, dataDelDow, oggi)
              : [];
            const ore = oreDelGiorno({ lavorativo: aperto, fasce, pause, blocchi: intervalli });
            return (
              <div
                key={dow}
                className={`rounded-lg border p-3 ${aperto ? "bg-card" : "bg-muted/40"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm w-24">{label}</span>
                  <Button
                    size="sm"
                    variant={aperto ? "outline" : "secondary"}
                    onClick={() => apriChiudiGiorno(dow)}
                    className="h-7 text-xs"
                  >
                    <Power className="h-3 w-3 mr-1" />
                    {aperto ? "Chiudi" : "Apri"}
                  </Button>
                  <span
                    className={`text-xs tabular-nums font-semibold ${
                      aperto && ore.netti === 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {aperto ? oreLeggibili(ore.netti) : "chiuso"}
                  </span>
                  {aperto && ore.tolti > 0 && (
                    <span className="text-[11px] text-amber-700">
                      − {oreLeggibili(ore.tolti)} fra pause e blocchi
                    </span>
                  )}
                  {aperto && ereditate && fasce.length > 0 && (
                    <span className="text-[11px] rounded-md border border-border bg-secondary px-1.5 py-0.5">
                      orario generale
                    </span>
                  )}
                  {aperto && (
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => copiaGiorno(dow, FERIALI, true, "lunedì → venerdì")}
                        title={`Copia le fasce di ${label} su tutti i feriali, riaprendo quelli chiusi`}
                      >
                        <CopyIcon className="h-3 w-3 mr-1" /> Copia su lun–ven
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() =>
                          copiaGiorno(
                            dow,
                            [0, 1, 2, 3, 4, 5, 6],
                            false,
                            "tutti i giorni già aperti",
                          )
                        }
                        title={`Copia le fasce di ${label} sui giorni già aperti, senza riaprire i chiusi`}
                      >
                        <CopyIcon className="h-3 w-3 mr-1" /> Copia sui giorni aperti
                      </Button>
                    </div>
                  )}
                </div>

                {aperto && (
                  <div className="mt-2 space-y-2">
                    {/* Fasce */}
                    <div className="flex flex-wrap items-center gap-2">
                      {fasce.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">
                          Nessuna fascia: questo giorno non produce orari.
                        </span>
                      )}
                      {fasce.map((f, i) => (
                        <div
                          key={`${dow}-${i}-${f.inizio}-${f.fine}`}
                          className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-1"
                        >
                          <Input
                            type="time"
                            defaultValue={f.inizio}
                            onBlur={(e) => cambiaFascia(dow, i, "inizio", e.target.value)}
                            className="h-7 w-[104px] text-xs"
                          />
                          <span className="text-xs text-muted-foreground">→</span>
                          <Input
                            type="time"
                            defaultValue={f.fine}
                            onBlur={(e) => cambiaFascia(dow, i, "fine", e.target.value)}
                            className="h-7 w-[104px] text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => rimuoviFascia(dow, i)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Togli questa fascia"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => aggiungiFascia(dow)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Fascia
                      </Button>
                      {!ereditate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => scriviFasce(dow, [])}
                          title="Rimuove l'orario dedicato: il giorno torna a usare l'orario generale"
                        >
                          Torna all'orario generale
                        </Button>
                      )}
                    </div>

                    {/* Pause del giorno */}
                    <PauseDelGiorno dow={dow} pause={pause} onSalva={(p) => scriviPause(dow, p)} />

                    {/* I blocchi che colpiscono questo giorno: si vedono qui,
                        dove si guardano gli orari, non solo in fondo. */}
                    {intervalli.length > 0 && (
                      <div className="text-[11px] text-amber-800 flex items-center gap-1.5">
                        <Ban className="h-3 w-3" />
                        {intervalli.length}{" "}
                        {intervalli.length === 1 ? "blocco attivo" : "blocchi attivi"} su questo
                        giorno della settimana mostrata
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── ORARIO GENERALE ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Orario generale
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Vale per i giorni aperti che non hanno un orario dedicato.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {(d.fasceOrarie || []).map((f, i) => (
              <div
                key={`gen-${i}-${f.inizio}-${f.fine}`}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-1"
              >
                <Input
                  type="time"
                  defaultValue={f.inizio}
                  onBlur={(e) =>
                    patch({
                      fasceOrarie: (d.fasceOrarie || []).map((x, j) =>
                        j === i ? { ...x, inizio: e.target.value } : x,
                      ),
                    })
                  }
                  className="h-7 w-[104px] text-xs"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <Input
                  type="time"
                  defaultValue={f.fine}
                  onBlur={(e) =>
                    patch({
                      fasceOrarie: (d.fasceOrarie || []).map((x, j) =>
                        j === i ? { ...x, fine: e.target.value } : x,
                      ),
                    })
                  }
                  className="h-7 w-[104px] text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({ fasceOrarie: (d.fasceOrarie || []).filter((_, j) => j !== i) })
                  }
                  className="text-muted-foreground hover:text-destructive"
                  title="Togli questa fascia"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                patch({
                  fasceOrarie: [...(d.fasceOrarie || []), { inizio: "09:00", fine: "18:00" }],
                })
              }
            >
              <Plus className="h-3 w-3 mr-1" /> Fascia
            </Button>
            {(d.fasceOrarie || []).length === 0 && (
              <span className="text-xs text-muted-foreground italic">
                Nessuna fascia generale: i giorni senza orario dedicato non produrranno orari.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── ECCEZIONI SU DATE SINGOLE ── */}
      <EccezioniConsulente
        indisponibilita={indisponibilita}
        oggi={oggi}
        onAggiungi={aggiungiIndisponibilita}
        onRimuovi={rimuoviIndisponibilita}
      />

      {/* ── BLOCCHI DI QUESTA PERSONA (con scadenza) ── */}
      <PannelloBlocchi
        titolo={`Blocchi temporanei di ${nomeConsulente(consulente)}`}
        descrizione="Una malattia, un corso, un periodo a orario ridotto: valgono solo per questa persona e si spengono da soli alla scadenza."
        blocchi={blocchiSuoi}
        tuttiBlocchi={blocchi}
        consulenteId={consulente.id}
        oggi={oggi}
        salvando={salvando}
        onSalva={onSalvaBlocchi}
      />

      {/* I blocchi del centro valgono anche qui: vanno visti, non modificati da
          questa schermata (sono di tutti, e si cambiano da «Tutti»). */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Chiusure che valgono anche per{" "}
            {nomeConsulente(consulente)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {blocchiPerTutti.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessuna chiusura del centro impostata.</p>
          ) : (
            blocchiPerTutti.map((b) => {
              const stato = statoBlocco(b, oggi);
              return (
                <div
                  key={b.id}
                  className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs ${TONO_STATO_BLOCCO[stato]}`}
                >
                  <span className="font-semibold">{descriviBlocco(b)}</span>
                  {b.motivo && <span className="text-muted-foreground">· {b.motivo}</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {ETICHETTA_STATO_BLOCCO[stato]}
                  </span>
                </div>
              );
            })
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onVaiATutti}>
            Gestisci le chiusure di tutti
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Le pause di un giorno. Stanno dentro il giorno perché è lì che si guardano:
 *  in una scheda separata si dimenticano, e la pausa pranzo dimenticata è un
 *  appuntamento fissato alle 13. */
function PauseDelGiorno({
  dow,
  pause,
  onSalva,
}: {
  dow: number;
  pause: Pausa[];
  onSalva: (p: Pausa[]) => void | Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
        <Coffee className="h-3 w-3" /> Pause
      </span>
      {pause.length === 0 && <span className="text-[11px] text-muted-foreground">nessuna</span>}
      {pause.map((p, i) => (
        <div
          key={`p-${dow}-${i}-${p.inizio}-${p.fine}`}
          className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-1"
        >
          <Input
            type="time"
            defaultValue={p.inizio}
            onBlur={(e) =>
              onSalva(
                pause.map((x, j) => (j === i ? { ...x, giorno: dow, inizio: e.target.value } : x)),
              )
            }
            className="h-7 w-[104px] text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="time"
            defaultValue={p.fine}
            onBlur={(e) =>
              onSalva(
                pause.map((x, j) => (j === i ? { ...x, giorno: dow, fine: e.target.value } : x)),
              )
            }
            className="h-7 w-[104px] text-xs"
          />
          <button
            type="button"
            onClick={() => onSalva(pause.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive"
            title="Togli questa pausa"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => onSalva([...pause, { giorno: dow, inizio: "13:00", fine: "14:00" }])}
      >
        <Plus className="h-3 w-3 mr-1" /> Pausa
      </Button>
    </div>
  );
}

/** Le indisponibilità su data singola: sono quelle che il calcolo degli orari
 *  liberi già conosce (booking-utils/isSlotBlocked). Una data passata non si
 *  cancella da sola: resta scritta, spenta, così si capisce perché quel giorno
 *  era chiuso. */
function EccezioniConsulente({
  indisponibilita,
  oggi,
  onAggiungi,
  onRimuovi,
}: {
  indisponibilita: NonNullable<ConsultantData["indisponibilita"]>;
  oggi: string;
  onAggiungi: (data: string, inizio?: string, fine?: string, motivo?: string) => Promise<void>;
  onRimuovi: (indice: number) => Promise<void>;
}) {
  const [data, setData] = useState("");
  const [tuttoIlGiorno, setTuttoIlGiorno] = useState(true);
  const [inizio, setInizio] = useState("09:00");
  const [fine, setFine] = useState("13:00");
  const [motivo, setMotivo] = useState("");

  const aggiungi = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      toast.error("Scegli una data valida");
      return;
    }
    await onAggiungi(
      data,
      tuttoIlGiorno ? undefined : inizio,
      tuttoIlGiorno ? undefined : fine,
      motivo.trim() || undefined,
    );
    setData("");
    setMotivo("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarOff className="h-4 w-4" /> Eccezioni su date singole
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          Un giorno di ferie, un pomeriggio fuori. Valgono per una data sola e non hanno bisogno di
          scadenza: passata la data, non tolgono più niente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Data</label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-8 text-xs w-[150px]"
            />
          </div>
          <Button
            size="sm"
            variant={tuttoIlGiorno ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setTuttoIlGiorno((v) => !v)}
          >
            {tuttoIlGiorno ? "Tutto il giorno" : "Solo una fascia"}
          </Button>
          {!tuttoIlGiorno && (
            <>
              <div>
                <label className="text-[11px] text-muted-foreground">Da</label>
                <Input
                  type="time"
                  value={inizio}
                  onChange={(e) => setInizio(e.target.value)}
                  className="h-8 text-xs w-[120px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">A</label>
                <Input
                  type="time"
                  value={fine}
                  onChange={(e) => setFine(e.target.value)}
                  className="h-8 text-xs w-[120px]"
                />
              </div>
            </>
          )}
          <div className="flex-1 min-w-[160px]">
            <label className="text-[11px] text-muted-foreground">Motivo (facoltativo)</label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ferie, visita, corso…"
              className="h-8 text-xs"
            />
          </div>
          <Button size="sm" onClick={aggiungi} disabled={!data}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi
          </Button>
        </div>

        <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
          {indisponibilita.length === 0 && (
            <p className="text-xs text-muted-foreground">Nessuna eccezione registrata.</p>
          )}
          {indisponibilita.map((ind, i) => {
            const leggibile = /^\d{4}-\d{2}-\d{2}$/.test(ind.data || "");
            const passata = leggibile && (ind.data as string) < oggi;
            return (
              <div
                key={`${ind.data}-${i}`}
                className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  passata ? "bg-muted/40 opacity-80" : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <span className="font-semibold">
                  {leggibile ? formatDate(ind.data, { short: true }) : "data da controllare"}
                </span>
                <span className="text-muted-foreground">
                  {ind.inizio && ind.fine ? `${ind.inizio}–${ind.fine}` : "giornata intera"}
                </span>
                {ind.motivo && <span className="text-muted-foreground">· {ind.motivo}</span>}
                {passata && <span className="text-[11px] text-muted-foreground">· passata</span>}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRimuovi(i)}
                  className="ml-auto h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                >
                  <X className="h-3 w-3 mr-1" /> Rimuovi
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   I BLOCCHI, CON LA LORO SCADENZA
   Stesso pannello per «tutti» e per il singolo consulente: cambia solo a chi
   vengono attaccati. Un blocco scaduto resta a schermo, spento, riaccendibile.
   ═════════════════════════════════════════════════════════════════════════ */

function PannelloBlocchi({
  titolo,
  descrizione,
  blocchi,
  tuttiBlocchi,
  consulenteId,
  oggi,
  salvando,
  onSalva,
}: {
  titolo: string;
  descrizione: string;
  blocchi: BloccoDisponibilita[];
  tuttiBlocchi: BloccoDisponibilita[];
  consulenteId?: string;
  oggi: string;
  salvando: boolean;
  onSalva: (prossimi: BloccoDisponibilita[]) => Promise<boolean>;
}) {
  const [quando, setQuando] = useState<"data" | "settimanale">("data");
  const [data, setData] = useState("");
  const [dow, setDow] = useState(1);
  const [tuttoIlGiorno, setTuttoIlGiorno] = useState(true);
  const [inizio, setInizio] = useState("09:00");
  const [fine, setFine] = useState("11:00");
  const [motivo, setMotivo] = useState("");
  const [scadenza, setScadenza] = useState("");

  const attivi = blocchi.filter((b) => statoBlocco(b, oggi) === "attivo").length;
  const spenti = blocchi.length - attivi;

  const aggiungi = async () => {
    if (quando === "data" && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      toast.error("Scegli la data del blocco");
      return;
    }
    if (!tuttoIlGiorno && fine <= inizio) {
      toast.error("La fascia finisce prima di iniziare");
      return;
    }
    if (scadenza && quando === "data" && scadenza < data) {
      toast.error("La scadenza è prima del giorno bloccato: il blocco non varrebbe mai");
      return;
    }
    const nuovo: BloccoDisponibilita = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `blk-${Date.now()}`,
      consulenteId,
      quando,
      data: quando === "data" ? data : undefined,
      dow: quando === "settimanale" ? dow : undefined,
      inizio: tuttoIlGiorno ? undefined : inizio,
      fine: tuttoIlGiorno ? undefined : fine,
      motivo: motivo.trim() || undefined,
      scadenza: scadenza || undefined,
      attivo: true,
      creato: new Date().toISOString(),
    };
    const ok = await onSalva([...tuttiBlocchi, nuovo]);
    if (ok) {
      setData("");
      setMotivo("");
      setScadenza("");
      toast.success("Blocco aggiunto");
    }
  };

  const cambia = async (id: string, patch: Partial<BloccoDisponibilita>) => {
    await onSalva(tuttiBlocchi.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const elimina = async (id: string) => {
    if (
      !confirm(
        "Eliminare il blocco? Sparisce anche dallo storico: se serve solo sospenderlo, usa «Spegni».",
      )
    )
      return;
    const ok = await onSalva(tuttiBlocchi.filter((b) => b.id !== id));
    if (ok) toast.success("Blocco eliminato");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ban className="h-4 w-4" /> {titolo}
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            {attivi} {attivi === 1 ? "attivo" : "attivi"}
            {spenti > 0 ? ` · ${spenti} spenti o scaduti` : ""}
          </span>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">{descrizione}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ── Il nuovo blocco ── */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <Tabs value={quando} onValueChange={(v) => setQuando(v as "data" | "settimanale")}>
              <TabsList className="h-8">
                <TabsTrigger value="data" className="text-xs">
                  Una data
                </TabsTrigger>
                <TabsTrigger value="settimanale" className="text-xs">
                  Ogni settimana
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {quando === "data" ? (
              <div>
                <label className="text-[11px] text-muted-foreground">Giorno</label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="h-8 text-xs w-[150px]"
                />
              </div>
            ) : (
              <div>
                <label className="text-[11px] text-muted-foreground">Giorno della settimana</label>
                <div className="flex flex-wrap gap-1">
                  {WEEK_ISO.map((g) => (
                    <button
                      key={g.dow}
                      type="button"
                      onClick={() => setDow(g.dow)}
                      className={`h-8 px-2 rounded-md border text-[11.5px] font-semibold transition-colors ${
                        dow === g.dow
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card hover:border-foreground/40"
                      }`}
                    >
                      {WEEKDAYS_SHORT[g.dow]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button
              size="sm"
              variant={tuttoIlGiorno ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setTuttoIlGiorno((v) => !v)}
            >
              {tuttoIlGiorno ? "Giornata intera" : "Solo una fascia"}
            </Button>
            {!tuttoIlGiorno && (
              <>
                <div>
                  <label className="text-[11px] text-muted-foreground">Da</label>
                  <Input
                    type="time"
                    value={inizio}
                    onChange={(e) => setInizio(e.target.value)}
                    className="h-8 text-xs w-[120px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">A</label>
                  <Input
                    type="time"
                    value={fine}
                    onChange={(e) => setFine(e.target.value)}
                    className="h-8 text-xs w-[120px]"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-[11px] text-muted-foreground">Motivo</label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Riunione, lavori, malattia…"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Timer className="h-3 w-3" /> Scade il (facoltativo)
              </label>
              <Input
                type="date"
                value={scadenza}
                onChange={(e) => setScadenza(e.target.value)}
                className="h-8 text-xs w-[150px]"
              />
            </div>
            <Button size="sm" onClick={aggiungi} disabled={salvando}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi blocco
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dopo la scadenza il blocco si spegne da solo e resta scritto: non sparisce, così fra sei
            mesi si capisce perché quel giorno era chiuso — e basta spostare la data per
            riaccenderlo.
          </p>
        </div>

        {/* ── L'elenco ── */}
        <div className="space-y-1.5">
          {blocchi.length === 0 && (
            <p className="text-xs text-muted-foreground">Nessun blocco impostato.</p>
          )}
          {[...blocchi]
            .sort((a, b) => (a.creato < b.creato ? 1 : -1))
            .map((b) => {
              const stato = statoBlocco(b, oggi);
              //  La chiave porta dentro la scadenza: il campo data è scritto
              //  con `defaultValue`, e senza rimontaggio dopo «Togli scadenza»
              //  resterebbe a schermo una data che nel database non c'è più.
              return (
                <div
                  key={`${b.id}-${b.scadenza ?? ""}`}
                  className={`rounded-md border px-3 py-2 ${TONO_STATO_BLOCCO[stato]}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{descriviBlocco(b)}</span>
                    {b.motivo && <span className="text-muted-foreground">· {b.motivo}</span>}
                    <span
                      className={`text-[11px] rounded-md border px-1.5 py-0.5 ${
                        stato === "attivo"
                          ? "border-destructive/40 text-destructive"
                          : stato === "da_controllare"
                            ? "border-amber-500/40 text-amber-800"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {ETICHETTA_STATO_BLOCCO[stato]}
                      {stato === "scaduto" && b.scadenza
                        ? ` il ${formatDate(b.scadenza, { short: true })}`
                        : ""}
                    </span>
                    {stato === "attivo" && b.scadenza && (
                      <span className="text-[11px] text-muted-foreground">
                        fino al {formatDate(b.scadenza, { short: true })}
                      </span>
                    )}
                    {stato === "attivo" && !b.scadenza && (
                      <span className="text-[11px] text-muted-foreground">senza scadenza</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <label className="text-[11px] text-muted-foreground">Scade il</label>
                    <Input
                      type="date"
                      defaultValue={b.scadenza ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if ((b.scadenza ?? "") === v) return;
                        void cambia(b.id, { scadenza: v || undefined });
                      }}
                      className="h-7 text-xs w-[150px]"
                    />
                    {b.scadenza && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={salvando}
                        onClick={() => cambia(b.id, { scadenza: undefined })}
                      >
                        Togli scadenza
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={salvando}
                      onClick={() => cambia(b.id, { attivo: !b.attivo })}
                    >
                      <Power className="h-3 w-3 mr-1" />
                      {b.attivo ? "Spegni" : "Riaccendi"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      disabled={salvando}
                      onClick={() => elimina(b.id)}
                    >
                      <X className="h-3 w-3 mr-1" /> Elimina
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TUTTI: le chiusure del centro + gli orari del funnel
   ═════════════════════════════════════════════════════════════════════════ */

function PannelloTutti({
  blocchi,
  blocchiPerTutti,
  consulenti,
  oggi,
  salvando,
  onSalvaBlocchi,
  settings,
  update,
  saving,
  today,
  selectedDate,
  setSelectedDate,
}: {
  blocchi: BloccoDisponibilita[];
  blocchiPerTutti: BloccoDisponibilita[];
  consulenti: Consultant[];
  oggi: string;
  salvando: boolean;
  onSalvaBlocchi: (prossimi: BloccoDisponibilita[]) => Promise<boolean>;
  settings: FunnelSettings;
  update: (patch: Partial<FunnelSettings>) => Promise<boolean>;
  saving: boolean;
  today: Date;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
}) {
  return (
    <div className="space-y-4">
      <PannelloCapienza />
      <PannelloBlocchi
        titolo="Blocchi per tutti i consulenti"
        descrizione={`Chiusure dell'intero centro: un giorno di festa, la riunione del lunedì mattina, un periodo di lavori. Tolgono disponibilità a tutti e ${consulenti.length} i consulenti.`}
        blocchi={blocchiPerTutti}
        tuttiBlocchi={blocchi}
        consulenteId={undefined}
        oggi={oggi}
        salvando={salvando}
        onSalva={onSalvaBlocchi}
      />
      <PannelloFunnel
        settings={settings}
        update={update}
        saving={saving}
        today={today}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />
    </div>
  );
}

/** ── QUANTE PERSONE NELLA STESSA FASCIA ───────────────────────────────────
 *  Richiesta del committente: prima «fino a 3 persone nella stessa ora di
 *  consulenza per singolo consulente», poi «fai che posso cambiare il numero
 *  dalle impostazioni».
 *
 *  Sta in questa scheda perché vale per TUTTI i consulenti, come i blocchi: è
 *  una regola del centro, non di una persona.
 *
 *  ⚠️ IL NUMERO NON SI SALVA COM'È DIGITATO: si salva ripulito (1…10). Uno
 *   zero — o un campo svuotato — chiuderebbe l'agenda di tutti senza che
 *   nessuno capisca perché, e un numero enorme è un errore di battitura.
 *  ⚠️ Vale per le CONSULENZE, non per tutto: pose, ritorni e appuntamenti in
 *   sede restano impegni esclusivi, e la riga sotto il campo lo dice — perché
 *   è la domanda che si fa chiunque legga questo campo. */
function PannelloCapienza() {
  const [valore, setValore] = useState<number>(capienzaConsulenza());
  const [testo, setTesto] = useState<string>(String(capienzaConsulenza()));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    assicuraCapienza()
      .then((n) => {
        if (!vivo) return;
        setValore(n);
        setTesto(String(n));
      })
      .catch(() => {
        /* vale il predefinito */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const scrivi = async (n: number) => {
    setSalvando(true);
    const esito = await salvaCapienza(n);
    setSalvando(false);
    //  Si mostra il valore RILETTO dal salvataggio, non quello digitato: è
    //  l'unico modo di non scrivere a schermo un numero che il database non ha.
    setValore(esito.valore);
    setTesto(String(esito.valore));
    if (esito.ok) toast.success(`Ogni fascia tiene ${esito.valore} consulenze`);
    else toast.error(`Non salvato: ${esito.errore ?? "errore del database"}`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> Persone nella stessa fascia
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            adesso {valore} {valore === 1 ? "per fascia" : "per fascia"}
          </span>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          Quante consulenze può tenere lo stesso orario di uno stesso consulente. Nell'agenda si
          vede come contatore — 1/{valore}, 2/{valore} — e al numero pieno la fascia non si può
          più scegliere.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Quante per fascia</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={testo}
              disabled={salvando}
              onChange={(e) => setTesto(e.target.value)}
              className="h-8 w-24 text-sm"
            />
          </div>
          <Button
            size="sm"
            className="h-8"
            disabled={salvando || testo.trim() === "" || Number(testo) === valore}
            onClick={() => void scrivi(Number(testo))}
          >
            {salvando ? "Salvo…" : "Salva"}
          </Button>
          {Number(testo) !== valore && testo.trim() !== "" && (
            <span className="text-[11px] text-amber-700">
              Da salvare: adesso vale {valore}.
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Vale solo per le consulenze. Le pose, i ritorni per la manutenzione e gli appuntamenti in
          sede continuano a occupare la fascia da soli: chi è in strada non può essere in due posti.
          Fuori da 1–10 si torna a {CAPIENZA_PREDEFINITA}.
        </p>
      </CardContent>
    </Card>
  );
}

/** GLI ORARI DEL FUNNEL — quello che il cliente può prenotare da solo.
 *  È una configurazione diversa da quella dei consulenti (non conosce le
 *  persone, solo gli orari proposti sul sito) e per questo vive in una scheda
 *  sua: mescolarle faceva credere che chiudere qui chiudesse anche l'agenda. */
function PannelloFunnel({
  settings,
  update,
  saving,
  today,
  selectedDate,
  setSelectedDate,
}: {
  settings: FunnelSettings;
  update: (patch: Partial<FunnelSettings>) => Promise<boolean>;
  saving: boolean;
  today: Date;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [newTemplateSlot, setNewTemplateSlot] = useState("");
  const [newDaySlot, setNewDaySlot] = useState("");
  const [vacFrom, setVacFrom] = useState("");
  const [vacTo, setVacTo] = useState("");

  // ─── Calendario ───
  const monthCells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: ({ date: Date; iso: string } | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      cells.push({ date, iso: isoOf(date) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const selectedSlots = useMemo(
    () => slotsForDate(settings, selectedDate),
    [settings, selectedDate],
  );
  const selectedDow = new Date(selectedDate + "T00:00:00").getDay();
  const isPastDay = new Date(selectedDate + "T00:00:00") < today;
  const isBlockedDay =
    settings.blocked_dates.includes(selectedDate) ||
    settings.blocked_weekdays.includes(selectedDow);
  const baseForDay =
    settings.slots_mode === "weekly"
      ? (settings.weekly_slots[String(selectedDow)] ?? [])
      : settings.time_slots;

  // ─── Actions template ───
  const addTemplateSlot = async () => {
    if (!/^\d{2}:\d{2}$/.test(newTemplateSlot)) return;
    if (settings.slots_mode === "daily") {
      if (settings.time_slots.includes(newTemplateSlot)) return;
      const ok = await update({ time_slots: [...settings.time_slots, newTemplateSlot].sort() });
      if (ok) setNewTemplateSlot("");
    } else {
      const cur = settings.weekly_slots[String(selectedDow)] ?? [];
      if (cur.includes(newTemplateSlot)) return;
      const ok = await update({
        weekly_slots: {
          ...settings.weekly_slots,
          [String(selectedDow)]: [...cur, newTemplateSlot].sort(),
        },
      });
      if (ok) setNewTemplateSlot("");
    }
  };
  const removeTemplateSlot = async (slot: string) => {
    if (settings.slots_mode === "daily") {
      await update({ time_slots: settings.time_slots.filter((s) => s !== slot) });
    } else {
      const cur = settings.weekly_slots[String(selectedDow)] ?? [];
      const next = { ...settings.weekly_slots };
      const filtered = cur.filter((s) => s !== slot);
      if (filtered.length === 0) delete next[String(selectedDow)];
      else next[String(selectedDow)] = filtered;
      await update({ weekly_slots: next });
    }
  };
  const resetTemplate = async () => {
    if (!confirm("Ripristinare gli orari di default (9:00 → 21:30, ogni 30 min)?")) return;
    await update({ time_slots: DEFAULT_SLOTS });
  };
  const copyDailyToAllWeek = async () => {
    if (!confirm("Copiare gli orari Giornalieri su tutti i giorni della settimana?")) return;
    const next: Record<string, string[]> = {};
    for (let i = 0; i < 7; i++) next[String(i)] = [...settings.time_slots];
    await update({ weekly_slots: next });
  };

  /** ── COPIA QUESTO GIORNO SUGLI ALTRI ──────────────────────────────────────
   *  È il gesto che rende la settimana tipo una cosa da un minuto: si compila
   *  il lunedì per bene e lo si stende sugli altri giorni. I giorni "chiusi a
   *  livello settimanale" restano fuori: se la domenica è chiusa, copiarci
   *  sopra degli orari non la riapre ma riempie la configurazione di orari che
   *  nessuno vedrà mai. */
  const copiaGiornoSu = async (target: number[], descrizione: string) => {
    const sorgente = settings.weekly_slots[String(selectedDow)] ?? [];
    if (sorgente.length === 0) {
      toast.error(
        `${WEEKDAYS_LONG[selectedDow]} non ha ancora orari: aggiungine almeno uno prima di copiarlo.`,
      );
      return;
    }
    const destinatari = target.filter(
      (d) => d !== selectedDow && !settings.blocked_weekdays.includes(d),
    );
    if (destinatari.length === 0) return;
    if (
      !confirm(
        `Copiare i ${sorgente.length} orari di ${WEEKDAYS_LONG[selectedDow]} su ${descrizione}?\n\n` +
          `Gli orari già presenti su quei giorni verranno sostituiti.`,
      )
    )
      return;
    const next = { ...settings.weekly_slots };
    destinatari.forEach((d) => {
      next[String(d)] = [...sorgente];
    });
    await update({ weekly_slots: next });
  };

  /** Chiudere un giorno della settimana tipo: senza, l'unico modo era togliere
   *  gli orari uno a uno. */
  const svuotaGiorno = async () => {
    const cur = settings.weekly_slots[String(selectedDow)] ?? [];
    if (cur.length === 0) return;
    if (!confirm(`Togliere tutti gli orari di ${WEEKDAYS_LONG[selectedDow]}?`)) return;
    const next = { ...settings.weekly_slots };
    delete next[String(selectedDow)];
    await update({ weekly_slots: next });
  };

  // ─── Actions giorno ───
  const toggleBlockDate = async () => {
    if (settings.blocked_dates.includes(selectedDate)) {
      await update({ blocked_dates: settings.blocked_dates.filter((d) => d !== selectedDate) });
    } else {
      await update({ blocked_dates: [...settings.blocked_dates, selectedDate].sort() });
    }
  };
  const toggleBlockSlotOnDay = async (slot: string) => {
    const cur = settings.blocked_slots[selectedDate] ?? [];
    const next = { ...settings.blocked_slots };
    if (cur.includes(slot)) {
      const filtered = cur.filter((s) => s !== slot);
      if (filtered.length === 0) delete next[selectedDate];
      else next[selectedDate] = filtered;
    } else {
      next[selectedDate] = [...cur, slot].sort();
    }
    await update({ blocked_slots: next });
  };
  const addExtraSlotOnDay = async () => {
    if (!/^\d{2}:\d{2}$/.test(newDaySlot)) return;
    // Aggiunge al template (giornaliero o settimanale del dow) così diventa disponibile
    if (settings.slots_mode === "daily") {
      if (!settings.time_slots.includes(newDaySlot)) {
        await update({ time_slots: [...settings.time_slots, newDaySlot].sort() });
      }
    } else {
      const cur = settings.weekly_slots[String(selectedDow)] ?? [];
      if (!cur.includes(newDaySlot)) {
        await update({
          weekly_slots: {
            ...settings.weekly_slots,
            [String(selectedDow)]: [...cur, newDaySlot].sort(),
          },
        });
      }
    }
    setNewDaySlot("");
  };

  // ─── Actions weekday blocks ───
  const toggleWeekdayBlock = async (dow: number) => {
    const next = settings.blocked_weekdays.includes(dow)
      ? settings.blocked_weekdays.filter((w) => w !== dow)
      : [...settings.blocked_weekdays, dow].sort();
    await update({ blocked_weekdays: next });
  };

  const setMode = async (m: SlotsMode) => update({ slots_mode: m });

  // ─── Ferie: blocca/sblocca un intervallo di date in un colpo solo ───
  const rangeDates = (from: string, to: string): string[] => {
    const out: string[] = [];
    const a = new Date(from + "T00:00:00");
    const b = new Date(to + "T00:00:00");
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return out;
    const cur = new Date(a);
    while (cur <= b) {
      out.push(isoOf(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };
  const blockVacationRange = async () => {
    const dates = rangeDates(vacFrom, vacTo);
    if (dates.length === 0) return;
    const set = new Set([...settings.blocked_dates, ...dates]);
    const ok = await update({ blocked_dates: [...set].sort() });
    if (ok) {
      setVacFrom("");
      setVacTo("");
    }
  };
  const unblockVacationRange = async () => {
    const dates = new Set(rangeDates(vacFrom, vacTo));
    if (dates.size === 0) return;
    const ok = await update({
      blocked_dates: settings.blocked_dates.filter((d) => !dates.has(d)),
    });
    if (ok) {
      setVacFrom("");
      setVacTo("");
    }
  };
  const vacRangeCount = useMemo(() => rangeDates(vacFrom, vacTo).length, [vacFrom, vacTo]);

  // Raggruppa blocked_dates in intervalli consecutivi (per UI Ferie programmate + badge)
  const vacationRanges = useMemo(() => {
    const sorted = [...settings.blocked_dates].sort();
    const ranges: { start: string; end: string; days: number }[] = [];
    if (sorted.length === 0) return ranges;
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const dPrev = new Date(prev + "T00:00:00");
      const dCur = new Date(cur + "T00:00:00");
      const diff = Math.round((dCur.getTime() - dPrev.getTime()) / 86400000);
      if (diff !== 1) {
        const days =
          Math.round(
            (new Date(prev + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) /
              86400000,
          ) + 1;
        ranges.push({ start, end: prev, days });
        start = cur;
      }
      prev = cur;
    }
    const lastDays =
      Math.round(
        (new Date(prev + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) /
          86400000,
      ) + 1;
    ranges.push({ start, end: prev, days: lastDays });
    return ranges;
  }, [settings.blocked_dates]);

  // Mappa: data ISO → giorni di ferie (solo se il periodo dura almeno 2 giorni)
  const vacationStartMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of vacationRanges) {
      if (r.days >= 2) m.set(r.start, r.days);
    }
    return m;
  }, [vacationRanges]);

  /** La prima ferie che deve ancora arrivare: è l'unica data del mucchio che
   *  cambia le decisioni di oggi (quanto in là si può fissare un appuntamento). */
  const prossimaFerie = useMemo(() => {
    const oggi = isoOf(today);
    return vacationRanges.map((r) => r.start).find((s) => s >= oggi) ?? null;
  }, [vacationRanges, today]);

  /** Quanti singoli orari sono stati tolti, in tutto: un numero solo, perché
   *  serve a sapere se ce ne sono, non quali. */
  const orariTolti = useMemo(
    () => Object.values(settings.blocked_slots).reduce((n, l) => n + l.length, 0),
    [settings.blocked_slots],
  );

  const removeVacationRange = async (start: string, end: string) => {
    const dates = new Set(rangeDates(start, end));
    await update({ blocked_dates: settings.blocked_dates.filter((d) => !dates.has(d)) });
  };

  const goPrevMonth = () => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Orari del funnel
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Gli orari che il cliente vede quando prenota da solo dal sito. Non sono l'agenda dei
              consulenti: qui si decide solo cosa proporre.
            </p>
          </div>
          <Tabs value={settings.slots_mode} onValueChange={(v) => setMode(v as SlotsMode)}>
            <TabsList>
              <TabsTrigger value="daily">Stessi orari ogni giorno</TabsTrigger>
              <TabsTrigger value="weekly">Orari per giorno</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── LE ECCEZIONI, PRIMA DEL CALENDARIO ──────────────────────────────
            Sono la parte che fa danno quando è nascosta: chiuso di domenica,
            ferie ad agosto, un orario tolto giovedì. Se non si vedono qui si
            scoprono dal cliente che si presenta a centro chiuso. */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Eccezioni attive
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11.5px]">
            <Ban className="h-3 w-3 text-muted-foreground" />
            {settings.blocked_weekdays.length === 0 ? (
              <span className="text-muted-foreground">Nessun giorno chiuso fisso</span>
            ) : (
              <>
                <span className="text-muted-foreground">Chiuso ogni</span>
                <span className="font-semibold">
                  {settings.blocked_weekdays
                    .slice()
                    .sort()
                    .map((d) => WEEKDAYS_SHORT[d])
                    .join(", ")}
                </span>
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11.5px]">
            <CalendarOff className="h-3 w-3 text-muted-foreground" />
            {settings.blocked_dates.length === 0 ? (
              <span className="text-muted-foreground">Nessuna ferie programmata</span>
            ) : (
              <>
                <span className="font-semibold">{settings.blocked_dates.length}</span>
                <span className="text-muted-foreground">
                  giorni chiusi in {vacationRanges.length}{" "}
                  {vacationRanges.length === 1 ? "periodo" : "periodi"}
                  {prossimaFerie
                    ? ` · il prossimo dal ${formatDate(prossimaFerie, { short: true })}`
                    : ""}
                </span>
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11.5px]">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {orariTolti === 0 ? (
              <span className="text-muted-foreground">Nessun orario tolto</span>
            ) : (
              <>
                <span className="font-semibold">{orariTolti}</span>
                <span className="text-muted-foreground">
                  orari tolti su {Object.keys(settings.blocked_slots).length}{" "}
                  {Object.keys(settings.blocked_slots).length === 1 ? "giorno" : "giorni"}
                </span>
              </>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
          {/* ─── Calendario ─── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button size="icon" variant="ghost" onClick={goPrevMonth} className="h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-sm capitalize">
                  {viewMonth.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
                </CardTitle>
                <Button size="icon" variant="ghost" onClick={goNextMonth} className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {WEEKDAYS_SHORT.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((c, i) => {
                  if (!c) return <div key={i} />;
                  const status = dayStatus(settings, c.iso);
                  const isToday = c.iso === isoOf(today);
                  const isSelected = c.iso === selectedDate;
                  const isPast = c.date < today;
                  const color =
                    status === "blocked"
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : status === "partial"
                        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                        : status === "full"
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-transparent";
                  const vacDays = vacationStartMap.get(c.iso);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(c.iso)}
                      className={`relative h-11 rounded-md border text-sm font-medium transition-all ${color} ${
                        isSelected
                          ? "ring-2 ring-primary ring-offset-1"
                          : "hover:border-foreground/30"
                      } ${isPast ? "opacity-50" : ""}`}
                      title={vacDays ? `Inizio ferie · ${vacDays} giorni` : undefined}
                    >
                      {c.date.getDate()}
                      {isToday && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                      )}
                      {vacDays && (
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1 py-px rounded-sm bg-amber-500 text-white text-[11px] font-bold leading-none whitespace-nowrap shadow-sm">
                          {vacDays}g
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-emerald-500/60" /> Disponibile
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-amber-500/60" /> Parziale
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-destructive/60" /> Bloccato
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-muted" /> Nessuno slot
                </span>
              </div>

              {/* Giorni settimana bloccati */}
              <div className="pt-3 border-t">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Giorni sempre bloccati
                </div>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS_SHORT.map((label, idx) => {
                    const blocked = settings.blocked_weekdays.includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleWeekdayBlock(idx)}
                        disabled={saving}
                        className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
                          blocked
                            ? "bg-destructive/15 text-destructive border-destructive/40 line-through"
                            : "bg-secondary text-secondary-foreground border-border hover:border-primary"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Editor giorno selezionato + Ferie ─── */}
          <div className="space-y-4">
            {/* Ferie / blocco intervallo */}
            <Card className="border-amber-300/50 bg-amber-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-amber-700" /> Ferie · blocca un intervallo
                  di date
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Esempio: dal 1 al 15 agosto. Tutte le date dell'intervallo verranno bloccate in un
                  colpo solo.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Da</label>
                    <Input
                      type="date"
                      value={vacFrom}
                      onChange={(e) => setVacFrom(e.target.value)}
                      className="h-8 text-xs w-[150px]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">A</label>
                    <Input
                      type="date"
                      value={vacTo}
                      onChange={(e) => setVacTo(e.target.value)}
                      className="h-8 text-xs w-[150px]"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px] text-[11px] text-muted-foreground">
                    {vacRangeCount > 0
                      ? `${vacRangeCount} ${vacRangeCount === 1 ? "giorno" : "giorni"} selezionati`
                      : "Seleziona un intervallo"}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={blockVacationRange}
                    disabled={saving || vacRangeCount === 0}
                  >
                    Blocca intervallo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={unblockVacationRange}
                    disabled={saving || vacRangeCount === 0}
                  >
                    Sblocca intervallo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Ferie programmate · lista intervalli */}
            {vacationRanges.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" /> Ferie programmate
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      {vacationRanges.length}{" "}
                      {vacationRanges.length === 1 ? "intervallo" : "intervalli"} ·{" "}
                      {settings.blocked_dates.length} giorni totali
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                    {vacationRanges.map((r) => (
                      <div
                        key={r.start}
                        className="flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-50/40 px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">
                            {r.days === 1
                              ? formatDate(r.start, { short: true })
                              : `${formatDate(r.start, { short: true })} → ${formatDate(r.end, { short: true })}`}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.days} {r.days === 1 ? "giorno" : "giorni"} bloccati
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeVacationRange(r.start, r.end)}
                          disabled={saving}
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 mr-1" /> Rimuovi
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Giorno selezionato
                    </div>
                    <CardTitle className="text-base capitalize mt-0.5">
                      {WEEKDAYS_LONG[selectedDow]} · {formatDate(selectedDate, { short: true })}
                    </CardTitle>
                    {isPastDay && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Giorno passato — modifiche future ancora possibili.
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={
                      settings.blocked_dates.includes(selectedDate) ? "default" : "destructive"
                    }
                    onClick={toggleBlockDate}
                    disabled={saving}
                  >
                    {settings.blocked_dates.includes(selectedDate)
                      ? "Sblocca giornata"
                      : "Blocca intera giornata"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isBlockedDay ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {settings.blocked_weekdays.includes(selectedDow)
                      ? `${WEEKDAYS_LONG[selectedDow]} è bloccato a livello settimanale. Sbloccalo dalla sezione "Giorni sempre bloccati".`
                      : "Questa giornata è bloccata. I clienti non la vedranno nel funnel."}
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Orari disponibili oggi ({selectedSlots.length})
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Clicca per bloccare/sbloccare solo oggi
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {baseForDay.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">
                            Nessuno slot configurato nel template — aggiungine sotto.
                          </p>
                        )}
                        {baseForDay.map((slot) => {
                          const blocked = (settings.blocked_slots[selectedDate] ?? []).includes(
                            slot,
                          );
                          return (
                            <button
                              key={slot}
                              onClick={() => toggleBlockSlotOnDay(slot)}
                              disabled={saving}
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold border transition-colors ${
                                blocked
                                  ? "bg-destructive/15 text-destructive border-destructive/40 line-through"
                                  : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {slot}
                              {blocked && <X className="h-3 w-3" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Aggiungi slot solo per oggi (estende il template) */}
                    <div className="flex items-end gap-2 pt-2 border-t">
                      <div className="flex-1 max-w-[160px]">
                        <label className="text-[11px] text-muted-foreground">Aggiungi orario</label>
                        <Input
                          type="time"
                          value={newDaySlot}
                          onChange={(e) => setNewDaySlot(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={addExtraSlotOnDay}
                        disabled={saving || !newDaySlot}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi al template
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Template orari */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {settings.slots_mode === "daily"
                      ? "Template orari (tutti i giorni)"
                      : `Template orari · ${WEEKDAYS_LONG[selectedDow]}`}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {settings.slots_mode === "weekly" && (
                      <>
                        {/*  Il gesto principale è questo: compilo un giorno e lo
                            stendo sugli altri. Sta per primo e con l'icona. */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiaGiornoSu(FERIALI, "lunedì → venerdì")}
                          disabled={saving}
                          className="h-7 text-xs"
                          title={`Copia gli orari di ${WEEKDAYS_LONG[selectedDow]} sui giorni feriali`}
                        >
                          <CopyIcon className="h-3 w-3 mr-1" /> Copia su lun–ven
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copiaGiornoSu([0, 1, 2, 3, 4, 5, 6], "tutti gli altri giorni")
                          }
                          disabled={saving}
                          className="h-7 text-xs"
                          title={`Copia gli orari di ${WEEKDAYS_LONG[selectedDow]} su tutta la settimana`}
                        >
                          <CopyIcon className="h-3 w-3 mr-1" /> Copia su tutti
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={svuotaGiorno}
                          disabled={
                            saving ||
                            (settings.weekly_slots[String(selectedDow)] ?? []).length === 0
                          }
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                          title={`Chiude ${WEEKDAYS_LONG[selectedDow]}: nessun orario proposto`}
                        >
                          Svuota il giorno
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={copyDailyToAllWeek}
                          disabled={saving}
                          className="h-7 text-xs text-muted-foreground"
                          title="Riparte dagli orari della modalità «stessi orari ogni giorno»"
                        >
                          Riparti dai giornalieri
                        </Button>
                      </>
                    )}
                    {settings.slots_mode === "daily" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={resetTemplate}
                        disabled={saving}
                        className="h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Reset default
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Questi orari vengono mostrati{" "}
                  {settings.slots_mode === "daily"
                    ? "tutti i giorni"
                    : `ogni ${WEEKDAYS_LONG[selectedDow]}`}
                  . Clicca un orario per rimuoverlo dal template.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(settings.slots_mode === "daily"
                    ? settings.time_slots
                    : (settings.weekly_slots[String(selectedDow)] ?? [])
                  ).map((t) => (
                    <button
                      key={t}
                      onClick={() => removeTemplateSlot(t)}
                      disabled={saving}
                      className="group inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/30 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                    >
                      {t}
                      <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                  {(settings.slots_mode === "daily"
                    ? settings.time_slots
                    : (settings.weekly_slots[String(selectedDow)] ?? [])
                  ).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Nessun orario — il funnel non mostrerà questo giorno.
                    </p>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <div className="max-w-[160px]">
                    <label className="text-[11px] text-muted-foreground">Aggiungi orario</label>
                    <Input
                      type="time"
                      value={newTemplateSlot}
                      onChange={(e) => setNewTemplateSlot(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button size="sm" onClick={addTemplateSlot} disabled={saving || !newTemplateSlot}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Riepilogo template settimanale */}
            {settings.slots_mode === "weekly" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Riepilogo settimanale</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {WEEK_ISO.map(({ dow, label }) => {
                      const list = settings.weekly_slots[String(dow)] ?? [];
                      return (
                        <div key={dow} className="flex items-center gap-3 text-xs">
                          <span className="w-20 font-semibold">{label}</span>
                          <span className="text-muted-foreground">
                            {list.length === 0
                              ? "—"
                              : `${list.length} orari (${list[0]}–${list[list.length - 1]})`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
