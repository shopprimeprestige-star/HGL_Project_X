/** ── IL PANNELLO «OGGI» DENTRO LA CHAT WHATSAPP ────────────────────────────
 *  Richiesta del titolare (30/10/2026): al posto della colonna «Lead CRM» la
 *  chat mostra la giornata — le consulenze di oggi con il filtro consulente e
 *  «Avvia» (Meetly), e tutto quello che c'è da fare. Toccando una riga si apre
 *  la sua chat, se c'è.
 *
 *  ⚠️ NIENTE LOGICA NUOVA. È la stessa giornata delle due pagine, guardata da
 *   una colonna stretta:
 *   · le consulenze sono `consulenzeDelGiorno` (la scelta dell'agenda di
 *     «Oggi») disegnate con `RigaLead`, che porta già esiti, invii e «Avvia»;
 *     chi non fa consulenze le vede in sola lettura, con `vistaOggi`, come in
 *     «Oggi»;
 *   · le cose da fare sono le righe di «Da fare oggi» (`costruisciRighe`, le
 *     cose scritte a mano lette e scritte con `caricaTask`/`applicaGesto`)
 *     disegnate con `VoceDaFare`;
 *   · il vecchio elenco «Lead CRM» (`WhatsAppLeadsPanel`) non sparisce: è la
 *     terza scheda, «Lead».
 *  Il pannello non scrive avvisi nella campanella (`useAvvisiTask`): lo fa la
 *  pagina «Da fare oggi», e due scrittori della stessa riga sono un doppione. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Sun, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRM } from "@/crm/CRMContext";
import { useAuth, useConsulenteCollegato, usePuo } from "@/crm/AuthContext";
import { vistaOggi } from "@/crm/vista-oggi";
import { faConsulenze } from "@/crm/permessi";
import { chiVale, consulenteDelloSchermo } from "@/crm/consulente-dentro";
import { PERIODO_DI_SERIE, leggiPeriodo, scriviPeriodo, type Periodo } from "@/crm/periodo-da-fare";
import { consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { consulenzeDelGiorno } from "@/crm/consulenze-del-giorno";
import { Elenco, RigaLead, attesaDi, esitoDi, iso, minutiDi } from "@/crm/MeetGiornalieri";
import { WhatsAppLeadsPanel } from "@/crm/WhatsAppLeadsPanel";
import { VoceDaFare } from "@/crm/dafare/VoceDaFare";
import { NOTA_FASCIA, TITOLO_FASCIA, costruisciRighe, type Fascia } from "@/crm/dafare/righe";
import { mappaMestieri } from "@/crm/dafare/di-chi";
import { ordinaArretrati, useVersoArretrati } from "@/crm/dafare/arretrati";
import { applicaGesto, caricaTask, type Gesto, type TaskManuale } from "@/crm/dafare/task-manuali";
import { liberaAgendaDi } from "@/crm/dafare/crea-cosa";
import { Segmento, VuotoRiga } from "@/crm/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadStatus } from "@/crm/types";
import { contaRighe, daFareDelPannello } from "./pannello-oggi";
import { BORDO_TASTO, FUOCO } from "./PannelloFiltri";

type Scheda = "consulenze" | "dafare" | "lead";

/* ── I GRUPPI CHE SI APRONO E SI CHIUDONO (30/10/2026) ──────────────────────
 *  Richiesta del titolare: le consulenze già fatte in un gruppo richiudibile, e
 *  «Da fare» ordinato per essere gestibile da qui. Ogni gruppo ha il suo
 *  titolo-tasto col numero; cosa è aperto lo ricorda il dispositivo
 *  (localStorage, solo comodità: senza, valgono le aperture di partenza). */
const CHIAVE_GRUPPI = "hgl_oggi_gruppi_v1";
/** Chiusi di partenza: le consulenze già fatte e le fasce che non premono. */
const CHIUSI_DI_PARTENZA = new Set(["fatte", "quandoCapita", "arretrato", "piuAvanti"]);

function useGruppiAperti() {
  const [scelti, setScelti] = useState<Record<string, boolean>>(() => {
    try {
      const v = JSON.parse(window.localStorage.getItem(CHIAVE_GRUPPI) ?? "{}");
      return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const aperto = (id: string) => scelti[id] ?? !CHIUSI_DI_PARTENZA.has(id);
  const cambia = (id: string) =>
    setScelti((prima) => {
      const dopo = { ...prima, [id]: !(prima[id] ?? !CHIUSI_DI_PARTENZA.has(id)) };
      try {
        window.localStorage.setItem(CHIAVE_GRUPPI, JSON.stringify(dopo));
      } catch {
        /* niente: resta aperto/chiuso solo finché la pagina è aperta */
      }
      return dopo;
    });
  return { aperto, cambia };
}

function Gruppo({
  id,
  titolo,
  conteggio,
  nota,
  tono = "neutro",
  aperto,
  onCambia,
  children,
}: {
  id: string;
  titolo: string;
  conteggio: number;
  nota?: string;
  tono?: "neutro" | "urgente" | "attenzione" | "spento";
  aperto: boolean;
  onCambia: () => void;
  children: React.ReactNode;
}) {
  if (conteggio === 0) return null;
  return (
    <section aria-labelledby={`gruppo-${id}`}>
      <h3 className="sticky top-0 z-[1] m-0">
        <button
          type="button"
          id={`gruppo-${id}`}
          aria-expanded={aperto}
          onClick={onCambia}
          title={nota}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 border-b border-border px-3 py-2 text-left lg:pointer-fine:min-h-9",
            "text-[12px] font-semibold uppercase tracking-wide",
            tono === "urgente" && "bg-rose-50 text-rose-800",
            tono === "attenzione" && "bg-amber-50 text-amber-900",
            tono === "neutro" && "bg-slate-50 text-slate-700",
            tono === "spento" && "bg-slate-50 text-slate-500",
          )}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", !aperto && "-rotate-90")}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{titolo}</span>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] tabular-nums text-slate-700 ring-1 ring-slate-200">
            {conteggio}
          </span>
        </button>
      </h3>
      {aperto && children}
    </section>
  );
}

/* ── LE DATE DI «DA FARE» (31/10/2026) ─────────────────────────────────────
 *  Richiesta del titolare: pastiglie come nelle chat, «Oggi», «Ieri», una data, da… a…. Le regole
 *  (cosa vale ogni scelta, cosa si ricorda) stanno in crm/periodo-da-fare.ts. Di serie «Oggi»,
 *  che è la giornata di sempre con il suo gruppo «Rimasto indietro»: le cose scadute prima di oggi
 *  e non spuntate NON spariscono. La scelta si ricorda sul dispositivo solo per quel giorno
 *  (localStorage: senza, vale finché la pagina è aperta). */
const CHIAVE_PERIODO = "hgl_oggi_periodo_v1";

function usePeriodo(oggi: string) {
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    try {
      return leggiPeriodo(window.localStorage.getItem(CHIAVE_PERIODO), oggi);
    } catch {
      return PERIODO_DI_SERIE;
    }
  });
  const cambia = (p: Periodo) => {
    setPeriodo(p);
    try {
      window.localStorage.setItem(CHIAVE_PERIODO, scriviPeriodo(p, oggi));
    } catch {
      /* niente: la scelta vale finché la pagina è aperta */
    }
  };
  return { periodo, cambia };
}

/** La riga che scorre di lato (stessa delle chat: ElencoChat). La barra non si vede. */
const RIGA_SCORREVOLE =
  "flex overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
/** Pastiglia a tutta altezza di dito (44 px); più bassa solo dal computer col mouse. */
const pastiglia = (acceso: boolean) =>
  cn(
    "t-corpo flex h-11 shrink-0 items-center whitespace-nowrap rounded-lg border px-3 font-medium transition-colors lg:pointer-fine:h-8",
    acceso
      ? "border-primary bg-primary text-primary-foreground"
      : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
    FUOCO,
  );
/** Il campo data: 16 px (sotto, iOS ingrandisce la pagina), alto come un tasto. */
const CAMPO_DATA =
  "h-11 min-w-0 flex-1 rounded-lg border border-muted-foreground/70 bg-background px-2 text-[16px] text-foreground lg:pointer-fine:h-8 lg:pointer-fine:text-[13px]";

function Pastiglie({ periodo, onCambia }: { periodo: Periodo; onCambia: (p: Periodo) => void }) {
  const { tipo } = periodo;
  //  Una casella ancora vuota non svuota l'elenco (vale oggi, o il solo giorno scritto): lo si dice.
  const manca =
    tipo === "giorno" ? !periodo.da : tipo === "intervallo" && (!periodo.da || !periodo.a);
  const nota = !manca
    ? null
    : tipo === "giorno" || (!periodo.da && !periodo.a)
      ? "Scegli la data: intanto vedi oggi."
      : "Manca una data: vedi solo il giorno scelto.";
  return (
    <div className="border-b border-border">
      <div role="group" aria-label="Quando" className={cn(RIGA_SCORREVOLE, "gap-2 px-3 py-2")}>
        <button
          type="button"
          aria-pressed={tipo === "oggi"}
          onClick={() => onCambia(PERIODO_DI_SERIE)}
          className={pastiglia(tipo === "oggi")}
        >
          Oggi
        </button>
        <button
          type="button"
          aria-pressed={tipo === "ieri"}
          onClick={() => onCambia({ tipo: "ieri", da: "", a: "" })}
          className={pastiglia(tipo === "ieri")}
        >
          Ieri
        </button>
        <button
          type="button"
          aria-pressed={tipo === "giorno"}
          onClick={() =>
            onCambia({ tipo: "giorno", da: tipo === "giorno" ? periodo.da : "", a: "" })
          }
          className={pastiglia(tipo === "giorno")}
        >
          Data
        </button>
        <button
          type="button"
          aria-pressed={tipo === "intervallo"}
          onClick={() =>
            onCambia({
              tipo: "intervallo",
              da: tipo === "intervallo" ? periodo.da : "",
              a: tipo === "intervallo" ? periodo.a : "",
            })
          }
          className={pastiglia(tipo === "intervallo")}
        >
          Da… a…
        </button>
      </div>
      {tipo === "giorno" && (
        <div className="px-3 pb-2">
          <input
            type="date"
            aria-label="Giorno"
            value={periodo.da}
            onChange={(e) => onCambia({ tipo: "giorno", da: e.target.value, a: "" })}
            className={cn(CAMPO_DATA, "w-full")}
          />
        </div>
      )}
      {tipo === "intervallo" && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <input
            type="date"
            aria-label="Data di inizio"
            value={periodo.da}
            max={periodo.a || undefined}
            onChange={(e) => onCambia({ ...periodo, da: e.target.value })}
            className={CAMPO_DATA}
          />
          <span aria-hidden="true" className="t-nota text-muted-foreground">
            –
          </span>
          <input
            type="date"
            aria-label="Data di fine"
            value={periodo.a}
            min={periodo.da || undefined}
            onChange={(e) => onCambia({ ...periodo, a: e.target.value })}
            className={CAMPO_DATA}
          />
        </div>
      )}
      {nota && <p className="t-nota px-3 pb-2 text-muted-foreground">{nota}</p>}
    </div>
  );
}

/** Il tono di una fascia di «Da fare»: chi preme in rosso/ambra, il resto neutro. */
const TONO_FASCIA: Record<string, "urgente" | "attenzione" | "neutro" | "spento"> = {
  daSentire: "urgente",
  adesso: "urgente",
  daIeri: "attenzione",
  mattina: "neutro",
  pomeriggio: "neutro",
  quandoCapita: "spento",
  arretrato: "attenzione",
  piuAvanti: "spento",
};
/** Il valore «tutti» del Select (Radix non accetta un valore vuoto). */
const TUTTI = "tutti";
/** Lo stesso passo dell'orologio di «Da fare oggi». */
const PASSO_OROLOGIO_MS = 15_000;

export function PannelloOggi({
  onApri,
  onStato,
  onClose,
}: {
  /** Tocco su una consulenza o una cosa da fare: la pagina apre la chat, o la scheda. */
  onApri: (l: Lead) => void;
  onStato: (l: Lead, s: LeadStatus) => void;
  /** Solo nella colonna del computer: nasconde il pannello. */
  onClose?: () => void;
}) {
  const { leads, consultants } = useCRM();
  const { user, accesso } = useAuth();
  const consulente = useConsulenteCollegato();
  const puo = usePuo();
  const vista = vistaOggi(puo);
  const [scheda, setScheda] = useState<Scheda>("consulenze");
  //  ── CHI SI GUARDA (31/10/2026) ──────────────────────────────────────────
  //  Il consulente che è dentro vede solo il suo lavoro e il menu non c'è; l'admin parte su tutti
  //  e può scegliere un altro o «Tutti»; il titolare senza consulente parte su «Tutti». `scelto`
  //  è quel che ha toccato nel menu (`null` = niente). Le regole: crm/consulente-dentro.ts.
  const dentro = useMemo(
    () =>
      consulenteDelloSchermo({
        collegatoId: consulente?.id,
        admin: accesso.ruolo === "admin",
        faConsulenze: faConsulenze(puo),
      }),
    [consulente?.id, accesso.ruolo, puo],
  );
  const [scelto, setScelto] = useState<string | null>(null);
  const chi = chiVale(dentro, scelto);
  const [verso] = useVersoArretrati();

  //  L'orologio: «tra 25 min» e le fasce della giornata avanzano da soli.
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAdesso(Date.now()), PASSO_OROLOGIO_MS);
    return () => window.clearInterval(id);
  }, []);
  const ora = new Date(adesso);
  const oggi = iso(ora);
  const { periodo, cambia: cambiaPeriodo } = usePeriodo(oggi);
  const minutiAdesso = ora.getHours() * 60 + ora.getMinutes();

  /* ── LE COSE SCRITTE A MANO: la stessa lista di «Da fare oggi» ── */
  const [task, setTask] = useState<TaskManuale[]>([]);
  const [statoTask, setStatoTask] = useState<"carico" | "pronto" | "errore">("carico");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    let vivo = true;
    void caricaTask().then((e) => {
      if (!vivo) return;
      //  Una lettura fallita NON diventa una lista vuota: lo si dice a schermo.
      if (e.ok) setTask(e.lista);
      setStatoTask(e.ok ? "pronto" : "errore");
    });
    return () => {
      vivo = false;
    };
  }, []);
  const gesto = useCallback(async (g: Gesto, successo?: string) => {
    setSalvando(true);
    const e = await applicaGesto(g);
    setSalvando(false);
    if (!e.ok) {
      toast.error("Non sono riuscito a salvare", { description: e.errore });
      return;
    }
    setTask(e.lista);
    if (successo) toast.success(successo);
  }, []);
  const elimina = (id: string) =>
    void (async () => {
      //  Come nella pagina: prima si libera l'agenda bloccata dalla riga, poi la riga.
      const guasto = await liberaAgendaDi(task.find((x) => x.id === id));
      if (guasto) {
        toast.error("Non sono riuscito a liberare l'agenda", { description: guasto });
        return;
      }
      await gesto({ tipo: "elimina", id }, "Riga eliminata");
    })();

  /* ── CHI ── */
  const { elenco: persone } = useMemo(
    () => consulentiPerConsulenza(consultants, { leads, anche: [chi] }),
    [consultants, leads, chi],
  );
  const mestieri = useMemo(() => mappaMestieri(consultants), [consultants]);
  const nomeDi = (id?: string | null) => (id ? (mestieri.get(id)?.nome ?? "") : "");
  const nomeConsulente = (l: Lead) => nomeDi(l.data.consulenteId) || undefined;

  /* ── LE DUE LISTE ── */
  const consulenze = useMemo(() => consulenzeDelGiorno(leads, oggi, chi), [leads, oggi, chi]);
  const gruppi = useMemo(
    () =>
      daFareDelPannello({
        righe: costruisciRighe({ leads, task, ora: new Date(adesso) }),
        adesso,
        oggi,
        chi,
        mestieri,
        ordinaArretrati: (r) => ordinaArretrati(r, verso),
        periodo,
      }),
    [leads, task, adesso, oggi, chi, mestieri, verso, periodo],
  );
  const quanteDaFare = contaRighe(gruppi);
  //  Le consulenze di oggi in tre gruppi: da fare, da recuperare (assente o da
  //  riprogrammare), già fatte (chiuse di partenza).
  const consulenzeDivise = useMemo(() => {
    const da: Lead[] = [];
    const recupero: Lead[] = [];
    const fatte: Lead[] = [];
    for (const l of consulenze) {
      const e = esitoDi(l);
      (e === "completato" ? fatte : e === "no_show" ? recupero : da).push(l);
    }
    return { da, recupero, fatte };
  }, [consulenze]);
  const gruppiAperti = useGruppiAperti();

  const apriPerId = (id: string) => {
    const l = leads.find((x) => x.id === id);
    if (l) onApri(l);
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-white text-foreground">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sun className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-[13px] font-semibold text-foreground">Oggi</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Nascondi il pannello Oggi"
            title="Nascondi il pannello Oggi"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
        <Segmento
          attivo={scheda === "consulenze"}
          onClick={() => setScheda("consulenze")}
          conteggio={consulenze.length}
          className="min-h-11 lg:pointer-fine:min-h-8"
        >
          Consulenze
        </Segmento>
        <Segmento
          attivo={scheda === "dafare"}
          onClick={() => setScheda("dafare")}
          conteggio={quanteDaFare}
          className="min-h-11 whitespace-nowrap lg:pointer-fine:min-h-8"
        >
          Da fare
        </Segmento>
        <Segmento
          attivo={scheda === "lead"}
          onClick={() => setScheda("lead")}
          titolo="Il vecchio elenco «Lead CRM»: cerca un lead e mandagli un messaggio"
          className="min-h-11 lg:pointer-fine:min-h-8"
        >
          Lead
        </Segmento>
      </div>

      {scheda !== "lead" &&
        (dentro.bloccato ? (
          //  Il consulente vede solo il suo: niente menu, e una riga che lo dice.
          <div className="border-b border-border px-3 py-2">
            <p className="t-nota flex min-h-11 items-center gap-2 rounded-md bg-slate-50 px-3 text-slate-700 lg:pointer-fine:min-h-8">
              <UserRound aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">
                Solo il tuo lavoro{nomeDi(dentro.id) ? ` · ${nomeDi(dentro.id)}` : ""}
              </span>
            </p>
          </div>
        ) : (
          <div className="border-b border-border px-3 py-2">
            <Select value={chi || TUTTI} onValueChange={(v) => setScelto(v === TUTTI ? "" : v)}>
              <SelectTrigger
                className="h-11 text-[12.5px] lg:pointer-fine:h-8"
                aria-label="Filtra per consulente"
              >
                <SelectValue placeholder="Tutti i consulenti" />
              </SelectTrigger>
              <SelectContent className="crm-theme bg-white text-foreground">
                <SelectItem value={TUTTI}>Tutti i consulenti</SelectItem>
                {persone.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.data.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

      {scheda === "dafare" && <Pastiglie periodo={periodo} onCambia={cambiaPeriodo} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {scheda === "consulenze" &&
          (consulenze.length === 0 ? (
            <VuotoRiga
              testo={
                chi ? "Nessuna consulenza oggi per questo consulente." : "Nessuna consulenza oggi."
              }
            />
          ) : (
            <>
              {(
                [
                  ["prossime", "Da fare", consulenzeDivise.da, "neutro"],
                  ["recupero", "Da recuperare", consulenzeDivise.recupero, "attenzione"],
                  ["fatte", "Già fatte", consulenzeDivise.fatte, "spento"],
                ] as const
              ).map(([id, titolo, elenco, tono]) => (
                <Gruppo
                  key={id}
                  id={id}
                  titolo={titolo}
                  conteggio={elenco.length}
                  tono={tono}
                  aperto={gruppiAperti.aperto(id)}
                  onCambia={() => gruppiAperti.cambia(id)}
                >
                  <Elenco>
                    {elenco.map((l) => {
                      const m = minutiDi(l.data.oraMeeting);
                      return (
                        <RigaLead
                          key={l.id}
                          lead={l}
                          onApri={onApri}
                          onStato={onStato}
                          nomeConsulente={nomeConsulente}
                          quando={l.data.oraMeeting || undefined}
                          attesa={
                            m !== null && esitoDi(l) === "programmato"
                              ? attesaDi(m, minutiAdesso)
                              : null
                          }
                          solaLettura={!vista.gesti}
                          fissatiDa={vista.fissatiDaMe ? consulente?.id : undefined}
                        />
                      );
                    })}
                  </Elenco>
                </Gruppo>
              ))}
            </>
          ))}

        {scheda === "dafare" &&
          (statoTask === "errore" ? (
            <p role="alert" className="px-3 py-3 text-[12.5px] text-amber-800">
              Non riesco a leggere le cose scritte a mano: qui sotto mancano. Ricarica la pagina.
            </p>
          ) : null)}
        {scheda === "dafare" &&
          (quanteDaFare === 0 ? (
            <VuotoRiga
              testo={
                statoTask === "carico"
                  ? "Carico le cose da fare…"
                  : periodo.tipo === "oggi"
                    ? "Niente da fare adesso."
                    : "Niente da fare in queste date."
              }
            />
          ) : (
            gruppi.map((g) => (
              <Gruppo
                key={g.fascia}
                id={g.fascia}
                titolo={g.titolo ?? TITOLO_FASCIA[g.fascia as Fascia]}
                nota={g.titolo ? undefined : NOTA_FASCIA[g.fascia as Fascia]}
                conteggio={g.righe.length}
                tono={TONO_FASCIA[g.fascia] ?? "neutro"}
                aperto={gruppiAperti.aperto(g.fascia)}
                onCambia={() => gruppiAperti.cambia(g.fascia)}
              >
                <ul className="divide-y divide-border">
                  {g.righe.map((r) => (
                    <VoceDaFare
                      key={r.id}
                      riga={r}
                      adesso={adesso}
                      nomeConsulente={nomeDi}
                      onApriLead={apriPerId}
                      onSpunta={(id, fatta) => void gesto({ tipo: "spunta", id, fatta })}
                      onElimina={elimina}
                      onSposta={(id, data, ora) => void gesto({ tipo: "sposta", id, data, ora })}
                      occupato={salvando}
                      compatta
                    />
                  ))}
                </ul>
              </Gruppo>
            ))
          ))}

        {/*  Il vecchio «Lead CRM», intero. La larghezza fissa (340 px) e il bordo
            sinistro li annulla il contenitore: qui riempie il pannello. */}
        {scheda === "lead" && (
          <div className="flex h-full min-h-0 flex-col [&>aside]:min-h-0 [&>aside]:w-full [&>aside]:flex-1 [&>aside]:border-l-0">
            <WhatsAppLeadsPanel />
          </div>
        )}
      </div>
    </aside>
  );
}
