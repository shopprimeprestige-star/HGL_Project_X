/** ── IL CALENDARIO DEGLI ORARI, DENTRO LA CHAT ──────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026, seconda): «clicco, si apre un popup che
 *  mi mostra il calendario di ogni consulente con tutte le vere disponibilità
 *  che posso cliccare; posso cliccare anche più disponibilità insieme e quando
 *  ho finito clicco un pulsante per confermare e crea il messaggio».
 *  Una finestra (crm/ui/Finestra, col tema chiaro del CRM anche nel portale):
 *  sul telefono un foglio dal basso alto quanto lo schermo, sul computer
 *  larga, con la settimana in sette colonne. In alto «Tutti» e ogni consulente
 *  che fa consulenze; si parte da quello del lead.
 *  Le regole (scelta, gruppi per giorno, testo, ritaglio per consulente) stanno
 *  in crm/wa-orari, provate; i posti sono quelli di Slot liberi
 *  (`useGiorniLiberi`): niente ore passate, niente ore prese o tenute.
 *  ⚠️ UN CALCOLO SOLO PER TUTTA LA SQUADRA. Il calendario di un consulente si
 *   ritaglia da quello di tutti (`giornoDi`): così le scelte fatte su
 *   consulenti diversi si ricontrollano sugli stessi giorni prima di scrivere.
 *  ⚠️ IL NOME NEL MESSAGGIO SOLO COL CONSULENTE SCELTO (29/10/2026): con «Tutti»
 *   resta senza nomi, perché chi farà la consulenza si decide dopo.
 *  ⚠️ GLI HOOK IN CIMA, nessuna uscita anticipata (prova degli hook).
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { CalendarClock, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Finestra } from "@/crm/ui/Finestra";
import { useGiorniLiberi } from "@/crm/useGiorniLiberi";
import { giornoParlato } from "@/crm/promemoria/formati";
import {
  cambiaScelta,
  consulenteDiPartenza,
  eScelto,
  giornoDi,
  messaggioOrari,
  consulenteComune,
  scelteAncoraLibere,
  scelteDelGiorno,
  type OrarioScelto,
} from "@/crm/wa-orari";

/** Due settimane, come la pagina Slot liberi apre di solito. */
const SETTIMANE = 2;
const GIORNO_CORTO = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESE_CORTO = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

const piu = (data: string, n: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const giornoMese = (data: string) => {
  const d = new Date(`${data}T12:00:00Z`);
  return `${d.getUTCDate()} ${MESE_CORTO[d.getUTCMonth()]}`;
};
/** «Oggi», «Domani», «Ven 30». */
const corto = (data: string, oggi: string) => {
  if (data === oggi) return "Oggi";
  if (data === piu(oggi, 1)) return "Domani";
  const d = new Date(`${data}T12:00:00Z`);
  return `${GIORNO_CORTO[d.getUTCDay()]} ${d.getUTCDate()}`;
};

const PILLOLA =
  "inline-flex h-11 shrink-0 items-center rounded-full sm:h-9 border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

export function OrariRapidi(p: {
  /** il nome del cliente, per il saluto (solo la prima parola) */
  nome?: string | null;
  /** il consulente del lead: il calendario parte da lui */
  consulenteId?: string | null;
  /** mette il testo nel campo di scrittura della chat (non invia) */
  onInserisci: (testo: string) => void;
  onChiudi: () => void;
}) {
  const { squadra, giorni } = useGiorniLiberi({ quanti: SETTIMANE * 7 });
  const oggi = giorni[0]?.data ?? "";
  //  null = non ancora toccato: vale il consulente del lead (la squadra può arrivare dopo).
  const [scelta, setChi] = useState<string | null>(null);
  const chi =
    scelta ??
    consulenteDiPartenza(
      squadra.map((c) => c.id),
      p.consulenteId,
    );
  const [settimana, setSettimana] = useState(0);
  const [scelte, setScelte] = useState<OrarioScelto[]>([]);

  const visti = useMemo(
    () => giorni.slice(settimana * 7, settimana * 7 + 7).map((g) => giornoDi(g, chi)),
    [giorni, settimana, chi],
  );
  const riepilogo = useMemo(
    () => scelteDelGiorno(scelte).flatMap((g) => g.ore.map((ora) => ({ data: g.data, ora }))),
    [scelte],
  );
  const nessunPosto = visti.length > 0 && visti.every((g) => g.fasce.length === 0);

  const conferma = () => {
    //  La finestra può restare aperta a lungo: un'ora passata o un posto preso nel frattempo esce.
    const valide = scelteAncoraLibere(scelte, giorni, oggi);
    if (valide.length < scelte.length) {
      setScelte(valide);
      const n = scelte.length - valide.length;
      toast.warning(n === 1 ? "Un orario non è più libero" : `${n} orari non sono più liberi`, {
        description: `${n === 1 ? "L'ho tolto" : "Li ho tolti"} dalla scelta: ricontrolla e conferma.`,
      });
      return;
    }
    //  Il nome del consulente (29/10/2026) solo se TUTTE le ore scelte sono
    //  sue: con «Tutti» o con ore di più consulenti il messaggio resta senza
    //  nomi (chi farà la consulenza si decide dopo).
    const idComune = consulenteComune(valide);
    const nomeConsulente = idComune
      ? (squadra.find((c) => c.id === idComune)?.data?.nome ?? null)
      : null;
    const testo = messaggioOrari(valide, oggi, p.nome, nomeConsulente);
    if (testo) p.onInserisci(testo);
  };

  const quanti =
    riepilogo.length === 0
      ? "Nessun orario scelto"
      : riepilogo.length === 1
        ? "1 orario scelto"
        : `${riepilogo.length} orari scelti`;

  return (
    <Finestra
      aperta
      onCambio={(v) => !v && p.onChiudi()}
      titolo="Proponi orari"
      contesto="Tocca gli orari da proporre, anche di più giorni e consulenti"
      icona={CalendarClock}
      larghezza="xl"
      //  Sul telefono a tutto schermo (richiesta del titolare, 28/10/2026): è un
      //  calendario, non un avviso, e la spunta resta sempre in fondo.
      className="max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-0"
      azioni={
        <div className="flex min-w-0 flex-col gap-2.5 sm:flex-1">
          {riepilogo.length > 0 && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {riepilogo.map((s) => (
                <button
                  key={`${s.data} ${s.ora}`}
                  type="button"
                  onClick={() => setScelte((x) => cambiaScelta(x, s))}
                  aria-label={`Togli ${giornoParlato(s.data) ?? s.data} alle ${s.ora}`}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-emerald-600/40 bg-emerald-50 pl-3 pr-2 text-[12.5px] font-medium tabular-nums text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  {corto(s.data, oggi)} · {s.ora}
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-slate-600" aria-live="polite">
              {quanti}
            </span>
            {riepilogo.length > 0 && (
              <button
                type="button"
                className="text-[13px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                onClick={() => setScelte([])}
              >
                Azzera
              </button>
            )}
            <Button
              className="ml-auto h-11 bg-emerald-600 px-5 text-white hover:bg-emerald-700 sm:h-10"
              disabled={riepilogo.length === 0}
              onClick={conferma}
            >
              Crea messaggio
            </Button>
          </div>
        </div>
      }
    >
      {squadra.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-slate-500">
          Nessun consulente con gli orari di lavoro impostati: aggiungili in Consulenti.
        </p>
      ) : (
        <>
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:flex-wrap sm:px-0"
            role="group"
            aria-label="Consulente"
          >
            {[
              { id: "tutti", nome: "Tutti" },
              ...squadra.map((c) => ({ id: c.id, nome: c.data.nome || "Senza nome" })),
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={chi === c.id}
                onClick={() => setChi(c.id)}
                className={cn(
                  PILLOLA,
                  chi === c.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                {c.nome}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 border-slate-200 bg-white"
              disabled={settimana === 0}
              onClick={() => setSettimana((s) => s - 1)}
              aria-label="Settimana prima"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className="text-[13px] font-medium tabular-nums text-slate-800"
              aria-live="polite"
            >
              {visti.length > 0 &&
                `${giornoMese(visti[0].data)} – ${giornoMese(visti[visti.length - 1].data)}`}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 border-slate-200 bg-white"
              disabled={settimana >= SETTIMANE - 1}
              onClick={() => setSettimana((s) => s + 1)}
              aria-label="Settimana dopo"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {nessunPosto && (
            <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-[13px] text-slate-600">
              Nessun posto libero in questa settimana
              {chi === "tutti" ? "" : " per questo consulente"}.
            </p>
          )}

          {/*  Telefono: un giorno per riga, le ore vanno a capo. Computer: sette colonne. */}
          <div className="grid gap-2 md:grid-cols-7">
            {visti.map((g) => {
              const vuoto = g.fasce.length === 0;
              return (
                <section
                  key={g.data}
                  aria-label={giornoParlato(g.data) ?? g.data}
                  className={cn(
                    "flex gap-3 rounded-xl border p-2.5 md:flex-col md:gap-2",
                    vuoto ? "border-transparent bg-slate-100/80" : "border-slate-200 bg-white",
                  )}
                >
                  <div className="w-16 shrink-0 pt-1.5 md:w-auto md:pt-0 md:text-center">
                    <div
                      className={cn(
                        "text-[13px] font-semibold",
                        vuoto ? "text-slate-400" : "text-slate-900",
                      )}
                    >
                      {corto(g.data, oggi)}
                    </div>
                    <div className="text-[11.5px] text-slate-500">{giornoMese(g.data)}</div>
                  </div>
                  {vuoto ? (
                    <p className="self-center text-[12.5px] text-slate-500 md:text-center">
                      Nessun posto
                    </p>
                  ) : (
                    <div className="flex flex-1 flex-wrap gap-1.5 md:flex-col">
                      {g.fasce.map((f) => {
                        const si = eScelto(scelte, g.data, f.ora);
                        const posti = `${f.posti} ${f.posti === 1 ? "posto" : "posti"}`;
                        return (
                          <button
                            key={f.ora}
                            type="button"
                            aria-pressed={si}
                            aria-label={`${f.ora}, ${posti}`}
                            title={posti}
                            onClick={() =>
                              setScelte((s) => cambiaScelta(s, { data: g.data, ora: f.ora, chi }))
                            }
                            className={cn(
                              "inline-flex h-10 min-w-[4.25rem] items-center justify-center gap-1 rounded-lg border px-2 text-[14px] font-medium tabular-nums transition-colors md:h-9 md:w-full",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                              //  La scelta: spunta e fondo tenue (regola delle finestre del CRM).
                              si
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                                : "border-slate-200 bg-white text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50",
                            )}
                          >
                            {si && <Check className="h-3.5 w-3.5" aria-hidden />}
                            {f.ora}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </Finestra>
  );
}
