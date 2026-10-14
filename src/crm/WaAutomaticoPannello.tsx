/** ─────────────────────────────────────────────────────────────────────────
 *  Pannello «Messaggi automatici» — solo per l'admin, dentro CRM › WhatsApp.
 *
 *  A COSA SERVE
 *  Il motore (`crm/wa-auto-invio.server.ts`) manda i promemoria ai lead che
 *  hanno dato il consenso. Qui il titolare lo accende, lo tiene in simulazione,
 *  ritocca le regole (quando parte ogni messaggio e in che fascia), guarda gli
 *  ultimi invii e riattiva a mano chi aveva risposto STOP.
 *
 *  LE REGOLE CHE SI VEDONO SONO QUELLE CHE IL MOTORE USA
 *  Con la tabella vuota il motore usa le 3 regole di serie (`regoleEffettive`):
 *  il pannello mostra le stesse, e salvando una modifica scrive la riga con un
 *  upsert su (user_id, codice). Spegnere una regola è una riga con `attiva = false`.
 *
 *  REGOLE CHE QUESTO FILE NON PUÒ ROMPERE
 *   · Legge e scrive SOLO `wa_auto_*` e `whatsapp_settings`. Di `whatsapp_settings`
 *     chiede soltanto le colonne `auto_*`: token e segreto dell'app non passano
 *     mai da qui. I lead e il loro consenso non si leggono dal browser.
 *   · Il passaggio dal simulato al reale chiede una conferma: da lì in poi i
 *     messaggi partono davvero e un numero bannato non si recupera.
 *   · «Riattiva» chiede una conferma: un numero che ha detto STOP e riceve
 *     ancora messaggi fa scendere la qualità del numero di WhatsApp.
 *   · Il vero muro è la RLS (`is_app_admin`); nascondere il pannello agli altri
 *     serve solo a non mostrare un comando che non funzionerebbe.
 *
 *  shortcut: le tabelle `wa_auto_*` non sono ancora in `integrations/supabase/
 *  types.ts` (si rigenera dopo la migrazione): le query passano da un cast. Da
 *  togliere quando i tipi ci sono.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, MessageSquareOff, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CLASSI_TONO, Vuoto, type Tono } from "@/crm/ui";
import { regoleEffettive, type RegolaWa } from "@/crm/wa-auto-regole";
import { cn } from "@/lib/utils";

/* ── Forma delle righe (le colonne della migrazione 20261014120000) ───────── */
interface Impostazioni {
  auto_attivo: boolean;
  auto_simulato: boolean;
  auto_tetto_giorno: number | null;
  auto_qualita: string | null;
  auto_sospeso_motivo: string | null;
  auto_sospeso_il: string | null;
}
interface Invio {
  id: string;
  lead_id: string;
  regola: string;
  telefono_e164: string;
  stato: string;
  motivo: string | null;
  simulato: boolean;
  prenotato_il: string;
}
interface Escluso {
  id: string;
  telefono_e164: string;
  motivo: string;
  testo: string | null;
  created_at: string;
}
interface Dati {
  settings: Impostazioni | null;
  regole: RegolaWa[];
  invii: Invio[];
  esclusi: Escluso[];
}

const COLONNE_SETTINGS =
  "auto_attivo,auto_simulato,auto_tetto_giorno,auto_qualita,auto_sospeso_motivo,auto_sospeso_il";
//  Tabella o colonna che il database non ha ancora: migrazione non applicata.
const MIGRAZIONE_MANCANTE = ["PGRST205", "PGRST204", "42P01", "42703"];

interface ErroreDb {
  code?: string;
  message: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as unknown as { from: (t: string) => any };

const fmtQuando = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});
const quando = (iso: string) => fmtQuando.format(new Date(iso));

const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = (s: string | null | undefined) => (s ?? "").slice(0, 5);

const ESITI: Record<string, { etichetta: string; tono: Tono }> = {
  inviato: { etichetta: "Inviato", tono: "vinta" },
  simulato: { etichetta: "Simulato", tono: "in_corso" },
  saltato: { etichetta: "Saltato", tono: "in_sospeso" },
  fallito: { etichetta: "Fallito", tono: "persa" },
  prenotato: { etichetta: "Prenotato", tono: "neutro" },
};

const STATO_TESTO = {
  spento: "Spento: non parte niente.",
  simulato: "Acceso in simulazione: scrive solo il registro, non manda niente a nessuno.",
  reale: "Acceso: invia davvero ai lead che hanno dato il consenso.",
} as const;

/** Il momento in cui parte la regola, a parole. */
function descriviMomento(r: RegolaWa): string {
  const cosa = r.riferimento === "consulenza" ? "consulenza" : "ricontatto";
  if (r.minuti_prima != null) return `${r.minuti_prima} minuti prima della ${cosa}`;
  const ora = hhmm(r.ora_fissa);
  if (r.giorni_prima === 0) return `Il giorno del ${cosa}, alle ${ora}`;
  if (r.giorni_prima === 1) return `Il giorno prima della ${cosa}, alle ${ora}`;
  return `${r.giorni_prima} giorni prima della ${cosa}, alle ${ora}`;
}

export function WaAutomaticoPannello() {
  const { user } = useAuth();
  const { leads } = useCRM();
  const [dati, setDati] = useState<Dati | null>(null);
  const [errore, setErrore] = useState<"migrazione" | string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [conferma, setConferma] = useState<Partial<Impostazioni> | null>(null);
  const [occupato, setOccupato] = useState(false);

  const carica = useCallback(async () => {
    if (!user) return;
    setErrore(null);
    const [s, r, i, e] = (await Promise.all([
      db().from("whatsapp_settings").select(COLONNE_SETTINGS).eq("user_id", user.id).maybeSingle(),
      db().from("wa_auto_regole").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      db().from("wa_auto_invii").select("*").eq("user_id", user.id).order("prenotato_il", { ascending: false }).limit(50),
      db().from("wa_auto_esclusi").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ])) as { data: unknown; error: ErroreDb | null }[];
    const guasto = [s, r, i, e].find((x) => x.error)?.error;
    if (guasto) {
      setErrore(MIGRAZIONE_MANCANTE.includes(guasto.code ?? "") ? "migrazione" : guasto.message);
      return;
    }
    setDati({
      settings: (s.data as Impostazioni | null) ?? null,
      //  Quelle che il motore userebbe davvero: di serie, con sopra le righe salvate.
      regole: regoleEffettive(r.data as Parameters<typeof regoleEffettive>[0]),
      invii: (i.data as Invio[]) ?? [],
      esclusi: (e.data as Escluso[]) ?? [],
    });
  }, [user]);

  useEffect(() => {
    void carica();
  }, [carica]);

  /** Il nome del lead per il registro: solo da quelli che il CRM ha già in memoria. */
  const nomi = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) {
      const n = `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim();
      if (n) m.set(l.id, n);
    }
    return m;
  }, [leads]);

  if (errore) {
    return (
      <Contenitore>
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="flex items-start gap-2 text-[13px] font-medium text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errore === "migrazione"
              ? "Mancano le tabelle dei messaggi automatici: la migrazione non è ancora stata applicata."
              : `Non riesco a leggere i messaggi automatici: ${errore}`}
          </p>
          {errore === "migrazione" && (
            <p className="text-[12.5px] text-amber-900/80">
              Il file è <span className="font-medium">20261014120000_wa_automatico.sql</span>: lo applichi tu dal database, poi premi Riprova.
            </p>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void carica()}>
            <RotateCcw className="mr-1.5 h-3 w-3" /> Riprova
          </Button>
        </div>
      </Contenitore>
    );
  }

  if (!dati) {
    return (
      <Contenitore>
        <div className="space-y-3" aria-busy="true" aria-label="Carico i messaggi automatici">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </Contenitore>
    );
  }

  const { settings } = dati;
  const stato = !settings?.auto_attivo ? "spento" : settings.auto_simulato ? "simulato" : "reale";

  /** Scrive le impostazioni; mostra l'esito e non lascia l'interruttore a metà. */
  async function scriviImpostazioni(patch: Partial<Impostazioni>) {
    if (!user || !settings) return;
    setOccupato(true);
    setAvviso(null);
    const { data, error } = (await db()
      .from("whatsapp_settings")
      .update(patch)
      .eq("user_id", user.id)
      .select("user_id")) as { data: unknown[] | null; error: ErroreDb | null };
    setOccupato(false);
    setConferma(null);
    if (error || !data?.length) {
      setAvviso(error ? `Non sono riuscito a salvare: ${error.message}` : "Non sono riuscito a salvare: prima inserisci le credenziali di WhatsApp in Impostazioni.");
      return;
    }
    setDati((d) => (d && d.settings ? { ...d, settings: { ...d.settings, ...patch } } : d));
  }

  /** Il reale è l'unico passo che non si disfa: chiede sempre conferma. */
  function cambia(patch: Partial<Impostazioni>) {
    if (!settings) return;
    const dopo = { ...settings, ...patch };
    const eraReale = settings.auto_attivo && !settings.auto_simulato;
    if (dopo.auto_attivo && !dopo.auto_simulato && !eraReale) {
      setConferma(patch);
      return;
    }
    void scriviImpostazioni(patch);
  }

  return (
    <Contenitore>
      <div className="space-y-7">
        {/* ── Stato e interruttori ── */}
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">Stato</h2>
          <p className="mt-1 text-[13px] text-foreground" aria-live="polite">
            {settings ? STATO_TESTO[stato] : "Mancano le impostazioni di WhatsApp: salva prima le credenziali in Impostazioni."}
          </p>

          {settings?.auto_sospeso_motivo && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Il motore si è fermato da solo: {settings.auto_sospeso_motivo}
                {settings.auto_sospeso_il ? ` (${quando(settings.auto_sospeso_il)})` : ""}. Rimettilo in funzione solo dopo aver controllato il numero.
              </span>
            </p>
          )}

          <div className="mt-2 divide-y divide-border">
            <RigaInterruttore
              nome="Invii automatici"
              nota="Acceso, il motore lavora ogni minuto, dentro le fasce delle regole."
              acceso={!!settings?.auto_attivo}
              disabilitato={!settings || occupato}
              onChange={(v) => cambia({ auto_attivo: v })}
            />
            <RigaInterruttore
              nome="Simulato"
              nota="Scrive il registro ma non manda niente. Spegnilo solo quando il numero ufficiale è collegato."
              acceso={!!settings?.auto_simulato}
              disabilitato={!settings || occupato}
              onChange={(v) => cambia({ auto_simulato: v })}
            />
          </div>

          {conferma && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-[12.5px] text-amber-900">
                Passando al reale i messaggi partono davvero verso i lead che hanno dato il consenso. Servono il segreto
                dell'app WhatsApp (per riconoscere gli STOP) e un numero con qualità verde: senza, il motore si rifiuta e lo scrive nel registro.
              </p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" className="h-8 text-xs" disabled={occupato} onClick={() => void scriviImpostazioni(conferma)}>
                  {occupato && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}Passa al reale
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setConferma(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}

          {avviso && (
            <p role="alert" className="mt-3 text-[12.5px] text-rose-700">
              {avviso}
            </p>
          )}
          {settings && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Tetto: {settings.auto_tetto_giorno ?? 40} messaggi al giorno
              {settings.auto_qualita ? ` · Qualità del numero: ${settings.auto_qualita}` : ""}
            </p>
          )}
        </div>

        {/* ── Regole ── */}
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">Regole</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Quando parte ogni messaggio e in quale fascia oraria è permesso (ora di Roma). Fuori fascia il messaggio si salta e lo vedi nel registro.
          </p>
          <ul className="mt-1 divide-y divide-border">
            {dati.regole.map((r) => (
              <RigaRegola
                key={r.codice}
                regola={r}
                userId={user?.id ?? ""}
                onSalvata={(nuova) => setDati((d) => (d ? { ...d, regole: d.regole.map((x) => (x.codice === nuova.codice ? nuova : x)) } : d))}
              />
            ))}
          </ul>
        </div>

        {/* ── Ultimi invii ── */}
        <div>
          <h2 id="wa-auto-invii" className="text-[13px] font-semibold text-foreground">
            Ultimi invii
          </h2>
          {dati.invii.length === 0 ? (
            <Vuoto
              className="mt-3"
              titolo="Nessun invio ancora"
              testo="Il registro si riempie al primo giro del motore, anche in simulazione."
            />
          ) : (
            <ul aria-labelledby="wa-auto-invii" className="mt-1 divide-y divide-border">
              {dati.invii.map((i) => {
                const esito = ESITI[i.stato] ?? { etichetta: i.stato, tono: "neutro" as Tono };
                return (
                  <li key={i.id} data-invio={i.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                        {nomi.get(i.lead_id) ?? i.telefono_e164}
                      </span>
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", CLASSI_TONO[esito.tono])}>
                        {esito.etichetta}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {quando(i.prenotato_il)} · {i.regola}
                      {nomi.has(i.lead_id) ? ` · ${i.telefono_e164}` : ""}
                    </p>
                    {i.motivo && <p className="mt-0.5 text-[12px] text-muted-foreground">{i.motivo}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Esclusi ── */}
        <div>
          <h2 id="wa-auto-esclusi" className="text-[13px] font-semibold text-foreground">
            Numeri esclusi
          </h2>
          {dati.esclusi.length === 0 ? (
            <Vuoto
              className="mt-3"
              icona={MessageSquareOff}
              titolo="Nessun numero escluso"
              testo="Chi risponde STOP compare qui e non riceve più messaggi automatici."
            />
          ) : (
            <ul aria-labelledby="wa-auto-esclusi" className="mt-1 divide-y divide-border">
              {dati.esclusi.map((x) => (
                <RigaEscluso
                  key={x.id}
                  escluso={x}
                  onRiattivato={() => setDati((d) => (d ? { ...d, esclusi: d.esclusi.filter((y) => y.id !== x.id) } : d))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Contenitore>
  );
}

function Contenitore({ children }: { children: React.ReactNode }) {
  return (
    <div role="region" aria-label="Messaggi automatici" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-5">{children}</div>
    </div>
  );
}

/** Interruttore con tutta la riga cliccabile: il tocco sul telefono non deve cercare i 36 px del comando. */
function RigaInterruttore({
  nome,
  nota,
  acceso,
  disabilitato,
  onChange,
}: {
  nome: string;
  nota: string;
  acceso: boolean;
  disabilitato?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={cn("flex min-h-11 items-center justify-between gap-4 py-2", disabilitato ? "opacity-60" : "cursor-pointer")}>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{nome}</span>
        <span className="block text-[12px] text-muted-foreground">{nota}</span>
      </span>
      <Switch aria-label={nome} checked={acceso} disabled={disabilitato} onCheckedChange={onChange} />
    </label>
  );
}

function Campo({ id, etichetta, children }: { id: string; etichetta: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-0.5 block text-[11px] text-muted-foreground">
        {etichetta}
      </label>
      {children}
    </div>
  );
}

/** Una regola: l'interruttore scrive subito, orari e fascia si salvano col pulsante. */
function RigaRegola({ regola, userId, onSalvata }: { regola: RegolaWa; userId: string; onSalvata: (r: RegolaWa) => void }) {
  const [attiva, setAttiva] = useState(regola.attiva);
  const [fissa, setFissa] = useState(hhmm(regola.ora_fissa));
  const [minuti, setMinuti] = useState(regola.minuti_prima != null ? String(regola.minuti_prima) : "");
  const [da, setDa] = useState(hhmm(regola.ora_da));
  const [a, setA] = useState(hhmm(regola.ora_a));
  const [errore, setErrore] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const usaOraFissa = regola.minuti_prima == null;

  const sporco =
    da !== hhmm(regola.ora_da) ||
    a !== hhmm(regola.ora_a) ||
    (usaOraFissa ? fissa !== hhmm(regola.ora_fissa) : minuti !== String(regola.minuti_prima));

  /** Upsert sulla riga intera: se la regola è ancora quella di serie la riga nasce adesso. */
  async function scrivi(patch: Partial<RegolaWa>) {
    setSalvo(true);
    setErrore(null);
    const nuova = { ...regola, ...patch };
    const { data, error } = (await db()
      .from("wa_auto_regole")
      .upsert({ user_id: userId, ...nuova, descrizione: nuova.descrizione ?? "" }, { onConflict: "user_id,codice" })
      .select("id")) as { data: unknown[] | null; error: ErroreDb | null };
    setSalvo(false);
    if (error || !data?.length) {
      setErrore(error ? `Non sono riuscito a salvare: ${error.message}` : "Non sono riuscito a salvare: ricarica la pagina e riprova.");
      return false;
    }
    onSalvata(nuova);
    return true;
  }

  async function cambiaAttiva(v: boolean) {
    setAttiva(v);
    if (!(await scrivi({ attiva: v }))) setAttiva(!v);
  }

  async function salva() {
    if (!ORA.test(da) || !ORA.test(a)) return setErrore("Scrivi la fascia con ore e minuti, per esempio 09:00.");
    if (da >= a) return setErrore("La fascia deve cominciare prima di finire.");
    const patch: Partial<RegolaWa> = { ora_da: da, ora_a: a };
    if (usaOraFissa) {
      if (!ORA.test(fissa)) return setErrore("Scrivi l'orario con ore e minuti, per esempio 18:00.");
      //  `ora_a` è escluso (come `inFascia`): alle 20:00 su 09:00-20:00 il messaggio verrebbe saltato.
      if (fissa < da || fissa >= a) return setErrore("L'orario è fuori dalla fascia: il messaggio verrebbe sempre saltato.");
      patch.ora_fissa = fissa;
    } else {
      const n = Number(minuti);
      if (!Number.isInteger(n) || n < 1 || n > 1440) return setErrore("I minuti devono essere un numero da 1 a 1440.");
      patch.minuti_prima = n;
    }
    await scrivi(patch);
  }

  const id = (s: string) => `wa-${regola.codice}-${s}`;
  return (
    <li data-regola={regola.codice} className="py-3">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-foreground">{regola.descrizione || regola.codice}</span>
          <span className="block text-[12px] text-muted-foreground">
            {descriviMomento(regola)} · {regola.template}
          </span>
        </span>
        <Switch aria-label={regola.descrizione || regola.codice} checked={attiva} onCheckedChange={(v) => void cambiaAttiva(v)} />
      </label>
      <div className="mt-1.5 flex flex-wrap items-end gap-3">
        {usaOraFissa ? (
          <Campo id={id("fissa")} etichetta="Parte alle">
            <Input id={id("fissa")} type="time" value={fissa} onChange={(e) => setFissa(e.target.value)} className="h-8 w-28 text-[12.5px]" />
          </Campo>
        ) : (
          <Campo id={id("minuti")} etichetta="Minuti prima">
            <Input id={id("minuti")} type="number" inputMode="numeric" min={1} max={1440} value={minuti} onChange={(e) => setMinuti(e.target.value)} className="h-8 w-24 text-[12.5px]" />
          </Campo>
        )}
        <Campo id={id("da")} etichetta="Dalle">
          <Input id={id("da")} type="time" value={da} onChange={(e) => setDa(e.target.value)} className="h-8 w-28 text-[12.5px]" />
        </Campo>
        <Campo id={id("a")} etichetta="Fino alle">
          <Input id={id("a")} type="time" value={a} onChange={(e) => setA(e.target.value)} className="h-8 w-28 text-[12.5px]" />
        </Campo>
        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!sporco || salvo} onClick={() => void salva()}>
          {salvo && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}Salva
        </Button>
      </div>
      {errore && (
        <p role="alert" className="mt-1.5 text-[12.5px] text-rose-700">
          {errore}
        </p>
      )}
    </li>
  );
}

/** Un numero escluso: «Riattiva» passa da una conferma, perché rimanda messaggi a chi aveva detto basta. */
function RigaEscluso({ escluso, onRiattivato }: { escluso: Escluso; onRiattivato: () => void }) {
  const [chiedo, setChiedo] = useState(false);
  const [occupato, setOccupato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function riattiva() {
    setOccupato(true);
    setErrore(null);
    const { data, error } = (await db().from("wa_auto_esclusi").delete().eq("id", escluso.id).select("id")) as {
      data: unknown[] | null;
      error: ErroreDb | null;
    };
    setOccupato(false);
    if (error || !data?.length) {
      setErrore(error ? `Non sono riuscito a riattivarlo: ${error.message}` : "Non sono riuscito a riattivarlo: ricarica la pagina.");
      return;
    }
    onRiattivato();
  }

  return (
    <li data-escluso={escluso.telefono_e164} className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-foreground">{escluso.telefono_e164}</span>
          <span className="block text-[12px] text-muted-foreground">
            {escluso.motivo === "stop" ? "Ha risposto STOP" : escluso.motivo}
            {escluso.testo ? ` («${escluso.testo}»)` : ""} · {quando(escluso.created_at)}
          </span>
        </span>
        {!chiedo && (
          <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={() => setChiedo(true)}>
            Riattiva
          </Button>
        )}
      </div>
      {chiedo && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[12.5px] text-amber-900">
            Riattivandolo, i messaggi automatici possono ripartire per questo numero. Fallo solo se è stato lui a chiederti di tornare.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="h-8 text-xs" disabled={occupato} onClick={() => void riattiva()}>
              {occupato && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}Conferma riattivazione
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setChiedo(false)}>
              Annulla
            </Button>
          </div>
        </div>
      )}
      {errore && (
        <p role="alert" className="mt-1.5 text-[12.5px] text-rose-700">
          {errore}
        </p>
      )}
    </li>
  );
}
