/** ── SLOT LIBERI ────────────────────────────────────────────────────────────
 *  Quanti posti restano per le consulenze, a che ora e con chi, su tutta la
 *  squadra e su più giorni. Le regole (che cosa è un posto, quali orari
 *  proporre per primi) stanno in crm/slot-liberi, provate senza browser; lo
 *  stato di ogni fascia lo calcola `slotDelGiorno` (crm/booking-utils), lo
 *  stesso motore dell'agenda.
 *
 *  ⚠️ LE ORE TENUTE PER UNA PERSONA SOLA si leggono dal server in una
 *   richiesta sola (api.crm.fascia-modo?tutte=1), come fa la finestra che
 *   fissa gli appuntamenti: senza, un'ora «solo» con il suo cliente dentro
 *   risulterebbe «1 di 3, c'è posto».
 *  ⚠️ IL CALCOLO DEI GIORNI STA IN crm/useGiorniLiberi (commessa 2026-10-14):
 *   lo usa anche la striscia dei posti della setter, e stesso aggancio vuol
 *   dire stesso numero per lo stesso giorno. Qui restano il periodo e «di chi».
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Copy, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarraAzioni, Kpi, KpiRiga, Pagina, Scheda, Segmento, Titolo, Vuoto } from "@/crm/ui";
import {
  daRiempirePrima,
  etichettaGiorno,
  testoDaCopiare,
  totali,
  type GiornoLibero,
} from "@/crm/slot-liberi";
import { useGiorniLiberi } from "@/crm/useGiorniLiberi";

export const Route = createFileRoute("/CRM/slot-liberi")({
  component: PaginaSlotLiberi,
});

const PERIODI = [
  { giorni: 1, nome: "Oggi" },
  { giorni: 7, nome: "7 giorni" },
  { giorni: 14, nome: "14 giorni" },
  { giorni: 30, nome: "30 giorni" },
] as const;

function PaginaSlotLiberi() {
  const [periodo, setPeriodo] = useState<number>(7);
  const [chi, setChi] = useState<string>("tutti");
  //  Il calcolo dei giorni (orari, ore tenute, orologio) sta nell'aggancio:
  //  lo usa anche la striscia dei posti, e così i numeri sono gli stessi.
  const { squadra, giorni } = useGiorniLiberi({ quanti: periodo, chi });

  const tot = useMemo(() => totali(giorni), [giorni]);
  const consigliati = useMemo(() => daRiempirePrima(giorni, 6), [giorni]);
  const primo = useMemo(() => {
    const g = giorni.find((x) => x.fasce.length > 0);
    return g ? { data: g.data, ora: g.fasce[0].ora } : null;
  }, [giorni]);

  const copia = async () => {
    const testo = testoDaCopiare(giorni);
    if (!testo) return;
    try {
      await navigator.clipboard.writeText(testo);
      toast.success("Orari copiati: incollali nel messaggio al cliente");
    } catch {
      toast.error("Non riesco a copiare: seleziona il testo a mano");
    }
  };

  const nomePeriodo = PERIODI.find((p) => p.giorni === periodo)?.nome.toLowerCase() ?? "";

  return (
    <Pagina>
      <Titolo
        testo="Slot liberi"
        nota={
          squadra.length === 0
            ? "Nessun consulente attivo con una settimana di lavoro"
            : `${tot.posti} ${tot.posti === 1 ? "posto libero" : "posti liberi"} per consulenze · ${nomePeriodo}`
        }
        icona={CalendarClock}
        azioni={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => void copia()} disabled={tot.fasce === 0}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copia orari
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
              <Link to="/CRM/orari-disponibili">Orari di lavoro</Link>
            </Button>
          </div>
        }
      />

      <KpiRiga colonne={4}>
        <Kpi etichetta="Posti liberi" valore={tot.posti} nota="Clienti che puoi ancora fissare" tono={tot.posti > 0 ? "vinta" : "persa"} />
        <Kpi etichetta="Orari con posto" valore={tot.fasce} nota={`In ${tot.giorniConPosto} ${tot.giorniConPosto === 1 ? "giorno" : "giorni"}`} />
        <Kpi
          etichetta="Primo libero"
          valore={primo ? primo.ora : "—"}
          nota={primo ? etichettaGiorno(primo.data) : "Nessun orario nel periodo"}
          tono={primo ? "da_lavorare" : "neutro"}
        />
        <Kpi etichetta="Giorni pieni" valore={tot.giorniPieni} nota="Lavorativi senza più posto" tono={tot.giorniPieni > 0 ? "in_sospeso" : "neutro"} />
      </KpiRiga>

      <BarraAzioni>
        {PERIODI.map((p) => (
          <Segmento key={p.giorni} attivo={periodo === p.giorni} onClick={() => setPeriodo(p.giorni)}>
            {p.nome}
          </Segmento>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <select
            value={chi}
            onChange={(e) => setChi(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-[12px]"
            aria-label="Di chi"
          >
            <option value="tutti">Tutta la squadra</option>
            {squadra.map((c) => (
              <option key={c.id} value={c.id}>
                {c.data.nome}
              </option>
            ))}
          </select>
        </div>
      </BarraAzioni>

      {consigliati.length > 0 && (
        <Scheda
          titolo="Da proporre per primi"
          icona={Sparkles}
          nota="Prima le ore dove c'è già qualcuno (non costano un'ora in più al consulente), poi le prime libere"
        >
          <div className="flex flex-wrap gap-2">
            {consigliati.map((c) => (
              <span
                key={`${c.data} ${c.ora} ${c.chi.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px]",
                  c.iniziata ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/40",
                )}
              >
                <b className="tabular-nums">{c.ora}</b>
                <span className="text-muted-foreground">{etichettaGiorno(c.data)}</span>
                <span>· {c.chi.nome}</span>
                {c.iniziata && <span className="text-emerald-700 dark:text-emerald-400">insieme</span>}
              </span>
            ))}
          </div>
        </Scheda>
      )}

      {squadra.length === 0 ? (
        <Vuoto
          titolo="Nessun consulente da contare"
          testo="Segna chi fa le consulenze in Collaboratori e compila la sua settimana in Orari di lavoro."
        />
      ) : tot.fasce === 0 ? (
        <Vuoto titolo="Nessun posto libero nel periodo" testo="Allarga il periodo o controlla gli orari di lavoro e i blocchi." />
      ) : (
        <div className="space-y-3">
          {giorni.map((g) => (
            <GiornoRiga key={g.data} g={g} tuttaSquadra={chi === "tutti"} />
          ))}
        </div>
      )}
    </Pagina>
  );
}

function GiornoRiga({ g, tuttaSquadra }: { g: GiornoLibero; tuttaSquadra: boolean }) {
  if (g.fasceTotali === 0) return null; // giorno di chiusura: non è un giorno pieno
  const riempimento = g.fasceTotali > 0 ? g.fascePiene / g.fasceTotali : 0;
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-[13px] font-semibold capitalize">{etichettaGiorno(g.data)}</span>
        <span className={cn("text-[12px]", g.posti > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600")}>
          {g.posti > 0 ? `${g.posti} ${g.posti === 1 ? "posto" : "posti"}` : "pieno"}
        </span>
        <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-muted" title={`${g.fascePiene} di ${g.fasceTotali} orari pieni`}>
          <div className="h-full bg-rose-500/70" style={{ width: `${Math.round(riempimento * 100)}%` }} />
        </div>
      </div>
      {g.fasce.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Tutti gli orari sono presi.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {g.fasce.map((f) => (
            <span
              key={f.ora}
              title={f.chi.map((c) => `${c.nome}: ${c.posti} ${c.posti === 1 ? "posto" : "posti"}${c.presi ? ` (già ${c.presi})` : ""}`).join("\n")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] tabular-nums",
                f.iniziata ? "border-emerald-500/40 bg-emerald-500/10" : "border-border",
              )}
            >
              <b>{f.ora}</b>
              <span className="text-muted-foreground">
                {f.posti} {f.posti === 1 ? "posto" : "posti"}
                {tuttaSquadra && f.chi.length > 0 ? ` · ${f.chi.map((c) => c.nome.split(" ")[0]).join(", ")}` : ""}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
