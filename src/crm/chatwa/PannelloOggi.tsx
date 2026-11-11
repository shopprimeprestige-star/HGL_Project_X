/** ── IL PANNELLO «OGGI» DENTRO LA CHAT WHATSAPP ────────────────────────────
 *  Richiesta del titolare (30/10/2026): al posto della colonna «Lead CRM» la
 *  chat mostra la giornata — le consulenze di oggi con il filtro consulente e
 *  «Avvia» (Meetly). Toccando una riga si apre la sua chat, se c'è.
 *  Dall'11/11/2026 (richiesta del titolare: «rimuovi tutti i promemoria, fanno solo caoticità,
 *  lascia solo gli appuntamenti») la scheda «Da fare» non c'è più: le cose da fare restano nella
 *  pagina «Da fare oggi», qui solo le consulenze (da fare, da recuperare, già fatte) e «Lead».
 *
 *  ⚠️ NIENTE LOGICA NUOVA. È la stessa giornata delle due pagine, guardata da
 *   una colonna stretta:
 *   · le consulenze sono `consulenzeDelGiorno` (la scelta dell'agenda di
 *     «Oggi») disegnate con `RigaLead`, che porta già esiti, invii e «Avvia»;
 *     chi non fa consulenze le vede in sola lettura, con `vistaOggi`, come in
 *     «Oggi»;
 *   · il vecchio elenco «Lead CRM» (`WhatsAppLeadsPanel`) non sparisce: è la
 *     seconda scheda, «Lead».
 *  Il pannello non scrive avvisi nella campanella (`useAvvisiTask`): lo fa la
 *  pagina «Da fare oggi», e due scrittori della stessa riga sono un doppione. */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Sun, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRM } from "@/crm/CRMContext";
import { useAuth, useConsulenteCollegato, usePuo } from "@/crm/AuthContext";
import { vistaOggi } from "@/crm/vista-oggi";
import { faConsulenze } from "@/crm/permessi";
import { chiVale, consulenteDelloSchermo } from "@/crm/consulente-dentro";
import { consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { consulenzeDelGiorno } from "@/crm/consulenze-del-giorno";
import { Elenco, RigaLead, attesaDi, esitoDi, iso, minutiDi } from "@/crm/MeetGiornalieri";
import { WhatsAppLeadsPanel } from "@/crm/WhatsAppLeadsPanel";
import { mappaMestieri } from "@/crm/dafare/di-chi";
import { Segmento, VuotoRiga } from "@/crm/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadStatus } from "@/crm/types";

type Scheda = "consulenze" | "lead";

/* ── I GRUPPI CHE SI APRONO E SI CHIUDONO (30/10/2026) ──────────────────────
 *  Richiesta del titolare: le consulenze già fatte in un gruppo richiudibile, e
 *  «Da fare» ordinato per essere gestibile da qui. Ogni gruppo ha il suo
 *  titolo-tasto col numero; cosa è aperto lo ricorda il dispositivo
 *  (localStorage, solo comodità: senza, valgono le aperture di partenza). */
const CHIAVE_GRUPPI = "hgl_oggi_gruppi_v1";
/** Chiusi di partenza: le consulenze già fatte. */
const CHIUSI_DI_PARTENZA = new Set(["fatte"]);

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
  //  Il consulente che è dentro vede solo il suo lavoro e il menu non c'è; l'admin col PIN parte su di sé (può scegliere)
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

  //  L'orologio: «tra 25 min» e le fasce della giornata avanzano da soli.
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAdesso(Date.now()), PASSO_OROLOGIO_MS);
    return () => window.clearInterval(id);
  }, []);
  const ora = new Date(adesso);
  const oggi = iso(ora);
  const minutiAdesso = ora.getHours() * 60 + ora.getMinutes();

  /* ── CHI ── */
  const { elenco: persone } = useMemo(
    () => consulentiPerConsulenza(consultants, { leads, anche: [chi] }),
    [consultants, leads, chi],
  );
  const mestieri = useMemo(() => mappaMestieri(consultants), [consultants]);
  const nomeDi = (id?: string | null) => (id ? (mestieri.get(id)?.nome ?? "") : "");
  const nomeConsulente = (l: Lead) => nomeDi(l.data.consulenteId) || undefined;

  /* ── LE CONSULENZE ── */
  const consulenze = useMemo(() => consulenzeDelGiorno(leads, oggi, chi), [leads, oggi, chi]);
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
