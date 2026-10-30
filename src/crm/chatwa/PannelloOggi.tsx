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
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ExternalLink, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRM } from "@/crm/CRMContext";
import { useAuth, useConsulenteCollegato, usePuo } from "@/crm/AuthContext";
import { vistaOggi } from "@/crm/vista-oggi";
import { consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { consulenzeDelGiorno } from "@/crm/consulenze-del-giorno";
import { Elenco, RigaLead, attesaDi, esitoDi, iso, minutiDi } from "@/crm/MeetGiornalieri";
import { WhatsAppLeadsPanel } from "@/crm/WhatsAppLeadsPanel";
import { VoceDaFare } from "@/crm/dafare/VoceDaFare";
import { TITOLO_FASCIA, costruisciRighe } from "@/crm/dafare/righe";
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

type Scheda = "consulenze" | "dafare" | "lead";
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
  const { user } = useAuth();
  const consulente = useConsulenteCollegato();
  const vista = vistaOggi(usePuo());
  const [scheda, setScheda] = useState<Scheda>("consulenze");
  const [chi, setChi] = useState("");
  const [verso] = useVersoArretrati();

  //  L'orologio: «tra 25 min» e le fasce della giornata avanzano da soli.
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAdesso(Date.now()), PASSO_OROLOGIO_MS);
    return () => window.clearInterval(id);
  }, []);
  const ora = new Date(adesso);
  const oggi = iso(ora);
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
      }),
    [leads, task, adesso, oggi, chi, mestieri, verso],
  );
  const quanteDaFare = contaRighe(gruppi);

  const apriPerId = (id: string) => {
    const l = leads.find((x) => x.id === id);
    if (l) onApri(l);
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sun className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-[13px] font-semibold text-foreground">Oggi</span>
        <Link
          to="/CRM"
          className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Apri la pagina «Oggi» completa"
        >
          Pagina intera <ExternalLink className="h-3 w-3" />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
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
          className="min-h-11 md:min-h-0"
        >
          Consulenze
        </Segmento>
        <Segmento
          attivo={scheda === "dafare"}
          onClick={() => setScheda("dafare")}
          conteggio={quanteDaFare}
          className="min-h-11 whitespace-nowrap md:min-h-0"
        >
          Da fare
        </Segmento>
        <Segmento
          attivo={scheda === "lead"}
          onClick={() => setScheda("lead")}
          titolo="Il vecchio elenco «Lead CRM»: cerca un lead e mandagli un messaggio"
          className="min-h-11 md:min-h-0"
        >
          Lead
        </Segmento>
      </div>

      {scheda !== "lead" && (
        <div className="border-b border-border px-3 py-2">
          <Select value={chi || TUTTI} onValueChange={(v) => setChi(v === TUTTI ? "" : v)}>
            <SelectTrigger className="h-11 text-[12.5px] md:h-8" aria-label="Filtra per consulente">
              <SelectValue placeholder="Tutti i consulenti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TUTTI}>Tutti i consulenti</SelectItem>
              {persone.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.data.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {scheda === "consulenze" &&
          (consulenze.length === 0 ? (
            <VuotoRiga
              testo={
                chi ? "Nessuna consulenza oggi per questo consulente." : "Nessuna consulenza oggi."
              }
            />
          ) : (
            <Elenco>
              {consulenze.map((l) => {
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
                      m !== null && esitoDi(l) === "programmato" ? attesaDi(m, minutiAdesso) : null
                    }
                    solaLettura={!vista.gesti}
                    fissatiDa={vista.fissatiDaMe ? consulente?.id : undefined}
                  />
                );
              })}
            </Elenco>
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
              testo={statoTask === "carico" ? "Carico le cose da fare…" : "Niente da fare adesso."}
            />
          ) : (
            gruppi.map((g) => (
              <section key={g.fascia}>
                <h3 className="sticky top-0 z-[1] border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {TITOLO_FASCIA[g.fascia]} · {g.righe.length}
                </h3>
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
                    />
                  ))}
                </ul>
              </section>
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
