/** ── LA PAGINA DELLE NOTIFICHE ─────────────────────────────────────────────
 *
 *  Tre domande, in quest'ordine, perché è l'ordine in cui uno ci arriva:
 *   1. «mi arrivano?»      → il riquadro di attivazione, in cima, sempre;
 *   2. «cosa mi è arrivato?» → lo storico unico (motore del browser + alert
 *      campagne), con i numeri in alto che filtrano l'elenco sotto;
 *   3. «cosa voglio ricevere?» → un interruttore per tipo, più il suono.
 *
 *  Prima qui c'erano solo i quattro alert sulle campagne letti da database:
 *  nessun modo di concedere il permesso, nessun suono, nessuna traccia degli
 *  avvisi operativi. Il permesso non si poteva nemmeno chiedere, ed è la
 *  ragione per cui "le notifiche non funzionavano".
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCheck,
  Info,
  Inbox,
  RotateCcw,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import {
  BarraAzioni,
  Kpi,
  KpiRiga,
  Pagina,
  Scheda,
  Segmento,
  Titolo,
  Vuoto,
  oggiIso,
  useRicerca,
} from "@/crm/ui";
import { cn } from "@/lib/utils";
import { provaSuono } from "@/crm/suoni-crm";
import { AttivaNotifiche } from "@/crm/notifications/AttivaNotifiche";
import {
  CATALOGO,
  GRUPPI,
  tipiDelGruppo,
  type GruppoEvento,
  type TipoEvento,
} from "@/crm/notifications/catalogo";
import { richiediGiro } from "@/crm/notifications/motore";
import { usePrefsBrowser } from "@/crm/notifications/prefs-browser";
import { azzeraMemoria } from "@/crm/notifications/registro";
import { useAvvisi, type Avviso } from "@/crm/notifications/useAvvisi";

export const Route = createFileRoute("/CRM/notifiche")({
  component: PaginaNotifiche,
});

/** Gli avvisi che non nascono dal catalogo (gli alert sulle campagne) stanno
 *  tutti in un gruppo loro: mescolarli agli appuntamenti renderebbe i filtri
 *  una lotteria. */
const CAMPAGNE = "Campagne" as const;
type Filtro = GruppoEvento | typeof CAMPAGNE | "tutti";

function gruppoDi(tipo: string): GruppoEvento | typeof CAMPAGNE {
  return CATALOGO[tipo as TipoEvento]?.gruppo ?? CAMPAGNE;
}

const ICONA_GRAVITA: Record<string, typeof Info> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TESTO_GRAVITA: Record<string, string> = {
  critical: "text-rose-600",
  warning: "text-amber-600",
  info: "text-sky-600",
};

function quandoBreve(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "ora";
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h fa`;
  const g = Math.floor(h / 24);
  return `${g} g fa`;
}

function PaginaNotifiche() {
  const { user } = useAuth();
  const { avvisi, nonLette, caricamento, segnaLetta, segnaTutte, ricarica } = useAvvisi();
  const ricerca = useRicerca();
  const navigate = useNavigate();

  const [soloDaLeggere, setSoloDaLeggere] = useState(false);
  const [soloCritiche, setSoloCritiche] = useState(false);
  const [soloOggi, setSoloOggi] = useState(false);
  const [gruppo, setGruppo] = useState<Filtro>("tutti");

  const oggi = oggiIso();
  const diOggi = useMemo(
    () => avvisi.filter((a) => a.quando.slice(0, 10) === oggi).length,
    [avvisi, oggi],
  );
  const critiche = useMemo(
    () => avvisi.filter((a) => a.gravita === "critical" && !a.letta).length,
    [avvisi],
  );

  const elenco = useMemo(
    () =>
      avvisi.filter((a) => {
        if (soloDaLeggere && a.letta) return false;
        if (soloCritiche && a.gravita !== "critical") return false;
        if (soloOggi && a.quando.slice(0, 10) !== oggi) return false;
        if (gruppo !== "tutti" && gruppoDi(a.tipo) !== gruppo) return false;
        return true;
      }),
    [avvisi, soloDaLeggere, soloCritiche, soloOggi, gruppo, oggi],
  );

  const apri = useCallback(
    (a: Avviso) => {
      void segnaLetta(a);
      if (a.leadId) {
        ricerca.apriLead(a.leadId);
        return;
      }
      if (a.destinazione) void navigate({ to: a.destinazione });
    },
    [navigate, ricerca, segnaLetta],
  );

  /** ── ARCHIVIARE LE LETTE ────────────────────────────────────────────────
   *  Le righe già lette si tolgono dal database: restano nello storico locale,
   *  ma smettono di pesare sull'elenco.
   *
   *  ⚠️ IL «PIÙ DI SETTE GIORNI» NON C'È PIÙ, ed era una cautela sbagliata.
   *   Serviva a non far cancellare per sbaglio una notifica appena arrivata —
   *   ma una notifica LETTA non ha più niente da dire, e il limite lasciava
   *   sull'elenco proprio le righe che si erano appena finite di smaltire:
   *   chi archiviava dopo una mattina di lavoro non vedeva sparire niente e
   *   concludeva che il pulsante non funzionasse.
   *  Adesso archivia tutte le lette. Le NON lette non si toccano mai — è la
   *  differenza fra archiviare e buttare via — e il messaggio dice quante ne
   *  restano, così chi si aspettava l'elenco vuoto capisce perché non lo è. */
  const archiviaLette = useCallback(async () => {
    if (!user) return;
    const { error, count } = await supabase
      .from("notifications")
      .delete({ count: "exact" })
      .eq("user_id", user.id)
      .not("read_at", "is", null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Archiviate ${count ?? 0} notifiche lette`,
      nonLette > 0
        ? { description: `Le ${nonLette} da leggere restano: si archiviano dopo averle lette.` }
        : undefined,
    );
    void ricarica();
  }, [user, ricarica, nonLette]);

  return (
    <Pagina>
      <Titolo
        testo="Notifiche"
        icona={Bell}
        nota="Avvisi della giornata e alert sulle campagne, in un elenco solo."
        azioni={
          <>
            {nonLette > 0 && (
              <Button size="sm" variant="outline" onClick={() => void segnaTutte()}>
                <CheckCheck className="h-4 w-4" /> Segna tutte
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void archiviaLette()}>
              <Archive className="h-4 w-4" /> Archivia le lette
            </Button>
          </>
        }
      />

      <AttivaNotifiche />

      {/* I numeri sono filtri: cliccarne uno mostra le righe che lo compongono,
          ricliccarlo torna a tutte. */}
      <KpiRiga colonne={4}>
        <Kpi
          etichetta="Da leggere"
          valore={nonLette}
          icona={Inbox}
          tono={nonLette > 0 ? "in_sospeso" : "neutro"}
          attivo={soloDaLeggere}
          onClick={() => setSoloDaLeggere((v) => !v)}
        />
        <Kpi
          etichetta="Oggi"
          valore={diOggi}
          icona={CalendarClock}
          attivo={soloOggi}
          onClick={() => setSoloOggi((v) => !v)}
        />
        <Kpi
          etichetta="Critiche aperte"
          valore={critiche}
          icona={AlertCircle}
          tono={critiche > 0 ? "persa" : "neutro"}
          attivo={soloCritiche}
          onClick={() => setSoloCritiche((v) => !v)}
        />
        <Kpi etichetta="In archivio" valore={avvisi.length} icona={Archive} />
      </KpiRiga>

      <BarraAzioni>
        <Segmento attivo={gruppo === "tutti"} onClick={() => setGruppo("tutti")}>
          Tutti
        </Segmento>
        {GRUPPI.map((g) => (
          <Segmento
            key={g}
            attivo={gruppo === g}
            onClick={() => setGruppo(gruppo === g ? "tutti" : g)}
            conteggio={avvisi.filter((a) => gruppoDi(a.tipo) === g).length}
          >
            {g}
          </Segmento>
        ))}
        <Segmento
          attivo={gruppo === CAMPAGNE}
          onClick={() => setGruppo(gruppo === CAMPAGNE ? "tutti" : CAMPAGNE)}
          conteggio={avvisi.filter((a) => gruppoDi(a.tipo) === CAMPAGNE).length}
        >
          Campagne
        </Segmento>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {elenco.length} {elenco.length === 1 ? "avviso" : "avvisi"}
        </span>
      </BarraAzioni>

      <Scheda senzaPadding classeCorpo="divide-y divide-border">
        {caricamento && avvisi.length === 0 ? (
          <p className="p-6 text-center text-[12.5px] text-muted-foreground">Caricamento…</p>
        ) : elenco.length === 0 ? (
          <div className="p-4">
            <Vuoto
              icona={Bell}
              titolo={avvisi.length === 0 ? "Nessun avviso" : "Nessun avviso con questi filtri"}
              testo={
                avvisi.length === 0
                  ? "Gli avvisi compaiono qui appena succede qualcosa: un appuntamento fra un quarto d'ora, un'installazione di oggi, un saldo scoperto."
                  : "Togli un filtro per vedere il resto dello storico."
              }
            />
          </div>
        ) : (
          elenco.map((a) => <Riga key={a.id} avviso={a} onApri={() => apri(a)} />)
        )}
      </Scheda>

      <ScelteNotifiche />
    </Pagina>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Una riga dello storico
   ═════════════════════════════════════════════════════════════════════════ */

function Riga({ avviso, onApri }: { avviso: Avviso; onApri: () => void }) {
  const Icona = ICONA_GRAVITA[avviso.gravita] ?? Info;
  return (
    <button
      type="button"
      onClick={onApri}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
    >
      <Icona
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          avviso.letta ? "text-muted-foreground" : TESTO_GRAVITA[avviso.gravita],
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "text-[13.5px] leading-tight",
              avviso.letta ? "font-medium text-muted-foreground" : "font-semibold",
            )}
          >
            {avviso.titolo}
            {avviso.quantita > 1 && (
              <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                ×{avviso.quantita}
              </span>
            )}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
            {quandoBreve(avviso.quando)}
          </span>
        </span>
        {avviso.corpo && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
            {avviso.corpo}
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {avviso.etichetta}
          {(avviso.leadId || avviso.destinazione) && (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                {avviso.leadId ? "Apri la scheda" : "Vai"}
                <ArrowRight className="h-3 w-3" />
              </span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Cosa notificare, e con che suono
   ═════════════════════════════════════════════════════════════════════════ */

function ScelteNotifiche() {
  const { prefs, salva, cambiaTipo, cambiaSuonoTipo } = usePrefsBrowser();
  const [confermaAzzera, setConfermaAzzera] = useState(false);

  const suonaProva = async (livello: "discreto" | "urgente") => {
    const partito = await provaSuono(livello, prefs.volume);
    if (!partito) toast.error("Il browser non ha lasciato passare l'audio. Riprova con un clic.");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <Scheda
        titolo="Cosa ti avvisa"
        nota="La campanella e lo storico restano sempre attivi: qui si sceglie cosa arriva sulla scrivania e cosa suona."
        senzaPadding
        classeCorpo="divide-y divide-border"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Avvisi attivi</p>
            <p className="text-[11.5px] text-muted-foreground">
              Spegnendo questo non arriva più nulla, nemmeno nella campanella.
            </p>
          </div>
          <Switch
            checked={prefs.attive}
            onCheckedChange={(v) => {
              salva({ attive: v });
              if (v) richiediGiro();
            }}
          />
        </div>

        {GRUPPI.map((g) => (
          <div key={g} className="px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {g}
            </p>
            <div className="mt-2 flex flex-col gap-2.5">
              {tipiDelGruppo(g).map((t) => (
                <RigaTipo
                  key={t}
                  tipo={t}
                  acceso={prefs.tipi[t] !== false}
                  conSuono={prefs.suoni[t] !== false}
                  disabilitato={!prefs.attive}
                  onAcceso={(v) => cambiaTipo(t, v)}
                  onSuono={(v) => cambiaSuonoTipo(t, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </Scheda>

      <div className="flex flex-col gap-4">
        <Scheda titolo="Suono" icona={Volume2}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">Suono attivo</p>
              <p className="text-[11.5px] text-muted-foreground">
                Un suono per giro, quello dell'avviso più urgente.
              </p>
            </div>
            <Switch checked={prefs.suono} onCheckedChange={(v) => salva({ suono: v })} />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>Volume</span>
              <span className="tabular-nums">{Math.round(prefs.volume * 100)}%</span>
            </div>
            <Slider
              className="mt-2"
              value={[Math.round(prefs.volume * 100)]}
              min={0}
              max={100}
              step={5}
              disabled={!prefs.suono}
              onValueChange={([v]) => salva({ volume: (v ?? 0) / 100 })}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void suonaProva("discreto")}
              disabled={!prefs.suono}
            >
              <Volume2 className="h-4 w-4" /> Promemoria
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void suonaProva("urgente")}
              disabled={!prefs.suono}
            >
              <Volume2 className="h-4 w-4" /> Urgente
            </Button>
            {!prefs.suono && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <VolumeX className="h-3.5 w-3.5" /> disattivato
              </span>
            )}
          </div>
        </Scheda>

        <Scheda titolo="Comportamento">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">Raggruppa gli avvisi simili</p>
              <p className="text-[11.5px] text-muted-foreground">
                Tre appuntamenti insieme diventano un avviso solo.
              </p>
            </div>
            <Switch checked={prefs.raggruppa} onCheckedChange={(v) => salva({ raggruppa: v })} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">Conserva lo storico</p>
              <p className="text-[11.5px] text-muted-foreground">
                Salva gli avvisi anche sul server: li ritrovi dagli altri dispositivi.
              </p>
            </div>
            <Switch
              checked={prefs.salvaStorico}
              onCheckedChange={(v) => salva({ salvaStorico: v })}
            />
          </div>

          {/* Serve quando qualcosa si è incastrato: riparte il conteggio di
              "già detto" e la fotografia delle trattative. */}
          <div className="mt-3 border-t border-border pt-3">
            <Button
              size="sm"
              variant={confermaAzzera ? "destructive" : "outline"}
              className="w-full"
              onClick={() => {
                if (!confermaAzzera) {
                  setConfermaAzzera(true);
                  return;
                }
                azzeraMemoria();
                setConfermaAzzera(false);
                richiediGiro();
                toast.success("Memoria azzerata: gli avvisi ripartono da adesso");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              {confermaAzzera ? "Confermi? Azzera la memoria" : "Ricomincia da capo"}
            </Button>
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              Svuota lo storico locale e il registro di cosa è già stato notificato. Le preferenze
              restano.
            </p>
          </div>
        </Scheda>

        <SulTelefono />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sul telefono — e fin dove arrivano davvero
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ QUESTA SCHEDA ESISTE ───────────────────────────────────────────
 *  Un telefono mostra le notifiche di un sito solo a due condizioni: che ci sia
 *  un service worker (adesso c'è) e — su iPhone — che il sito sia stato aggiunto
 *  alla schermata Home. Senza questa spiegazione l'utente attiva le notifiche
 *  dal telefono, non riceve niente e conclude che il CRM è rotto.
 *
 *  La seconda metà è la parte scomoda, ed è per questo che è scritta: gli
 *  avvisi li calcola il CRM APERTO. A telefono bloccato o CRM chiuso non parte
 *  niente, e non è una cosa che si aggiusta con un'impostazione — serve un
 *  servizio di invio dal server che oggi non esiste. Dirlo qui costa quattro
 *  righe; non dirlo costa un consulente che si fida di una sveglia che non
 *  suonerà.
 *  ───────────────────────────────────────────────────────────────────────── */
function SulTelefono() {
  return (
    <Scheda titolo="Sul telefono" icona={Smartphone}>
      <p className="text-[12px] leading-snug text-muted-foreground">
        Perché gli avvisi arrivino sul telefono, il CRM va aggiunto alla schermata Home: su iPhone
        dal menù <span className="font-semibold text-foreground">Condividi → Aggiungi a Home</span>,
        su Android dal menù del browser →{" "}
        <span className="font-semibold text-foreground">Installa app</span>. Poi apri il CRM da
        quell&apos;icona e attiva le notifiche da lì: il permesso vale per l&apos;applicazione, non
        per la scheda del browser.
      </p>

      {/* Il colore è un segnale: ambra perché è un limite da conoscere, non un
          guasto da riparare. */}
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <p className="text-[12px] font-semibold leading-tight text-amber-900">
          Fin dove arrivano, oggi
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-amber-900/80">
          Gli avvisi li calcola il CRM mentre è aperto, anche in secondo piano. Con il CRM chiuso o
          il telefono bloccato da un po&apos;{" "}
          <span className="font-semibold">non arriva niente</span>: per quello servirebbe un invio
          dal server (web push con chiavi VAPID, iscrizione salvata a database e un processo che
          spedisce). Non è ancora stato fatto. Le notifiche del giorno le trovi comunque qui e nella
          campanella appena riapri.
        </p>
      </div>
    </Scheda>
  );
}

function RigaTipo({
  tipo,
  acceso,
  conSuono,
  disabilitato,
  onAcceso,
  onSuono,
}: {
  tipo: TipoEvento;
  acceso: boolean;
  conSuono: boolean;
  disabilitato: boolean;
  onAcceso: (v: boolean) => void;
  onSuono: (v: boolean) => void;
}) {
  const meta = CATALOGO[tipo];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p
          className={cn(
            "text-[13px] font-medium leading-tight",
            !acceso && "text-muted-foreground",
          )}
        >
          {meta.etichetta}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
          {meta.spiegazione}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Il secondo interruttore è il suono: si vede solo quando l'avviso è
            acceso, perché su un avviso spento non vuol dire niente. */}
        <button
          type="button"
          aria-label={conSuono ? "Suono attivo" : "Suono spento"}
          title={conSuono ? "Suona" : "Silenzioso"}
          disabled={disabilitato || !acceso}
          onClick={() => onSuono(!conSuono)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
            conSuono && acceso
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-border bg-card text-muted-foreground",
            (disabilitato || !acceso) && "opacity-40",
          )}
        >
          {conSuono && acceso ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
        </button>
        <Switch checked={acceso} disabled={disabilitato} onCheckedChange={onAcceso} />
      </div>
    </div>
  );
}
