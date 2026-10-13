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
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Copy, Sparkles, Users } from "lucide-react";
import { useCRM } from "@/crm/CRMContext";
import { intestazioniCRM } from "@/crm/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarraAzioni, Kpi, KpiRiga, Pagina, Scheda, Segmento, Titolo, Vuoto } from "@/crm/ui";
import { slotDelGiorno } from "@/crm/booking-utils";
import { consulentiPerConsulenza } from "@/crm/chi-fa-la-consulenza";
import { DURATA_PREDEFINITA } from "@/crm/invito";
import type { ModoFascia } from "@/crm/fascia-consulenza";
import {
  daRiempirePrima,
  etichettaGiorno,
  riassumiGiorno,
  testoDaCopiare,
  totali,
  type GiornoLibero,
} from "@/crm/slot-liberi";

export const Route = createFileRoute("/CRM/slot-liberi")({
  component: PaginaSlotLiberi,
});

const PERIODI = [
  { giorni: 1, nome: "Oggi" },
  { giorni: 7, nome: "7 giorni" },
  { giorni: 14, nome: "14 giorni" },
  { giorni: 30, nome: "30 giorni" },
] as const;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Le ore tenute per una persona sola, «AAAA-MM-GG HH:MM» in ora locale. */
function useOreTenute(): Record<string, "solo"> {
  const [ore, setOre] = useState<Record<string, "solo">>({});
  useEffect(() => {
    let vivo = true;
    void intestazioniCRM()
      .then((headers) => fetch("/api/crm/fascia-modo?tutte=1", { headers }))
      .then((r: Response) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; solo?: Record<string, string[]> } | null) => {
        if (!vivo || !j?.ok || !j.solo) return;
        const fuori: Record<string, "solo"> = {};
        for (const quandi of Object.values(j.solo)) {
          for (const q of quandi) {
            //  Le chiavi arrivano in UTC: qui diventano locali, come le ore disegnate.
            const d = new Date(`${q}Z`);
            if (Number.isNaN(d.getTime())) continue;
            const ora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            fuori[`${iso(d)} ${ora}`] = "solo";
          }
        }
        setOre(fuori);
      })
      .catch(() => {
        /* senza, si conta come se nessuna ora fosse tenuta */
      });
    return () => {
      vivo = false;
    };
  }, []);
  return ore;
}

function PaginaSlotLiberi() {
  const { leads, consultants } = useCRM();
  const oreTenute = useOreTenute();
  const [periodo, setPeriodo] = useState<number>(7);
  const [chi, setChi] = useState<string>("tutti");
  //  L'ora corrente, rinfrescata ogni minuto: le ore di oggi già passate escono.
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAdesso(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const squadra = useMemo(() => {
    const { elenco } = consulentiPerConsulenza(Array.isArray(consultants) ? consultants : []);
    return elenco.filter((c) => c?.data && c.data.attivo !== false && Array.isArray(c.data.giorniLavorativi));
  }, [consultants]);

  const scelti = useMemo(() => (chi === "tutti" ? squadra : squadra.filter((c) => c.id === chi)), [squadra, chi]);

  const giorni = useMemo<GiornoLibero[]>(() => {
    const elenco = Array.isArray(leads) ? leads.filter((l) => l && l.data) : [];
    const oggi = new Date(adesso);
    oggi.setHours(0, 0, 0, 0);
    const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
    const out: GiornoLibero[] = [];
    for (let i = 0; i < periodo; i++) {
      const d = new Date(oggi);
      d.setDate(oggi.getDate() + i);
      const data = iso(d);
      const modi = new Map<string, ModoFascia>();
      for (const [k, v] of Object.entries(oreTenute)) {
        const [g, ora] = k.split(" ");
        if (g === data && ora) modi.set(ora, v);
      }
      const persone = scelti.map((c) => {
        let slot: ReturnType<typeof slotDelGiorno> = [];
        try {
          slot = slotDelGiorno(c, data, DURATA_PREDEFINITA, elenco, undefined, undefined, modi);
        } catch {
          /* un consulente con orari illeggibili non ferma la pagina */
        }
        return { id: c.id, nome: c.data.nome || "Senza nome", slot };
      });
      out.push(riassumiGiorno({ data, persone, dopo: i === 0 ? minutiAdesso : undefined }));
    }
    return out;
  }, [leads, scelti, periodo, oreTenute, adesso]);

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
