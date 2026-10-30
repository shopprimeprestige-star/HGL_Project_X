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
 *  ⚠️ LA DURATA (commessa 2026-10-30): predefinita 45 minuti, scelte rapide
 *   30/45/60/90 e un valore libero; ogni orario mostrato è libero per TUTTA la
 *   durata, e ne parte uno ogni mezz'ora (crm/wa-orari, crm/giorni-liberi).
 *   L'ultima scelta resta nel browser; il messaggio dice la durata.
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
  CHIAVE_DURATA,
  DURATE_RAPIDE,
  DURATA_ORARI,
  DURATA_MASSIMA,
  DURATA_MINIMA,
  PASSO_ORARI,
  durataParlata,
  durataValida,
  leggiDurata,
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

/** «09:30» + minuti → «10:15». */
const finisce = (ora: string, min: number) => {
  const [h, m] = ora.split(":").map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** La durata salvata nel browser (niente browser = la predefinita). */
const durataSalvata = (): number => {
  try {
    return leggiDurata(window.localStorage.getItem(CHIAVE_DURATA));
  } catch {
    return DURATA_ORARI;
  }
};

const SEGMENTO =
  "inline-flex h-10 min-w-[2.75rem] items-center justify-center rounded-full px-2.5 text-[13px] font-medium tabular-nums transition-colors sm:h-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

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
  const [durata, setDurata] = useState<number>(durataSalvata);
  //  Il campo del valore libero: aperto/chiuso e quello che c'è scritto.
  const [libero, setLibero] = useState<string | null>(null);
  const { squadra, giorni } = useGiorniLiberi({
    quanti: SETTIMANE * 7,
    durata,
    passo: PASSO_ORARI,
  });
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

  const scegliDurata = (n: number) => {
    setDurata(n);
    setLibero(null);
    try {
      window.localStorage.setItem(CHIAVE_DURATA, String(n));
    } catch {
      /* senza memoria del browser vale per questa volta */
    }
  };
  const confermaLibero = () => {
    if (libero === null) return;
    const n = durataValida(libero);
    if (n !== null) scegliDurata(n);
    else if (!libero.trim()) setLibero(null);
  };
  const liberoStorto = libero !== null && libero.trim() !== "" && durataValida(libero) === null;
  const durataRapida = (DURATE_RAPIDE as readonly number[]).includes(durata);

  const conferma = () => {
    //  La finestra può restare aperta a lungo: un'ora passata o un posto preso nel frattempo esce.
    const valide = scelteAncoraLibere(scelte, giorni, oggi);
    if (valide.length < scelte.length) {
      setScelte(valide);
      const n = scelte.length - valide.length;
      toast.warning(n === 1 ? "Un orario non è più libero" : `${n} orari non sono più liberi`, {
        description: `${n === 1 ? "L'ho tolto" : "Li ho tolti"} dalla scelta (durata ${durataParlata(durata)}): ricontrolla e conferma.`,
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
    const testo = messaggioOrari(valide, oggi, p.nome, nomeConsulente, durata);
    if (testo) p.onInserisci(testo);
  };

  const quanti =
    riepilogo.length === 0
      ? "Nessun orario scelto"
      : `${riepilogo.length === 1 ? "1 orario scelto" : `${riepilogo.length} orari scelti`} · ${durata} min`;

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

          {/*  Durata a sinistra, settimana a destra; sul telefono una sopra l'altra. */}
          <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span id="durata-orari" className="text-[13px] font-medium text-slate-600">
                Durata
              </span>
              <div
                role="group"
                aria-labelledby="durata-orari"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5"
              >
                {DURATE_RAPIDE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={durata === n && libero === null}
                    aria-label={durataParlata(n)}
                    onClick={() => scegliDurata(n)}
                    className={cn(
                      SEGMENTO,
                      durata === n && libero === null
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={!durataRapida || libero !== null}
                  aria-label={
                    durataRapida ? "Altra durata" : `Altra durata, ora ${durataParlata(durata)}`
                  }
                  onClick={() => setLibero(durataRapida ? "" : String(durata))}
                  className={cn(
                    SEGMENTO,
                    !durataRapida || libero !== null
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {durataRapida ? "Altro" : durata}
                </button>
              </div>
              {libero !== null ? (
                <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
                  <input
                    autoFocus
                    inputMode="numeric"
                    maxLength={3}
                    value={libero}
                    onChange={(e) => setLibero(e.target.value.replace(/\D/g, ""))}
                    onBlur={confermaLibero}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confermaLibero();
                      }
                    }}
                    placeholder="50"
                    aria-label={`Minuti, da ${DURATA_MINIMA} a ${DURATA_MASSIMA}`}
                    aria-invalid={liberoStorto}
                    className={cn(
                      "h-10 w-16 rounded-lg border bg-white px-2 text-center text-[14px] tabular-nums text-slate-900 sm:h-8",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                      liberoStorto ? "border-red-500" : "border-slate-300",
                    )}
                  />
                  <span className={liberoStorto ? "text-red-600" : undefined}>
                    {liberoStorto ? `min, da ${DURATA_MINIMA} a ${DURATA_MASSIMA}` : "min"}
                  </span>
                </label>
              ) : (
                <span className="text-[13px] text-slate-500">min</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
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
                className="min-w-[8.5rem] text-center text-[13px] font-medium tabular-nums text-slate-800"
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
                    <div className="flex flex-1 flex-wrap content-start gap-1.5 md:grid md:grid-cols-1 xl:grid-cols-2">
                      {g.fasce.map((f) => {
                        const si = eScelto(scelte, g.data, f.ora);
                        const posti = `${f.posti} ${f.posti === 1 ? "posto" : "posti"}`;
                        const fascia = `${f.ora}–${finisce(f.ora, durata)}`;
                        return (
                          <button
                            key={f.ora}
                            type="button"
                            aria-pressed={si}
                            aria-label={`${fascia}, ${posti}`}
                            title={`${fascia} · ${posti}`}
                            onClick={() =>
                              setScelte((s) => cambiaScelta(s, { data: g.data, ora: f.ora, chi }))
                            }
                            className={cn(
                              "inline-flex h-10 min-w-[4.25rem] items-center justify-center gap-1 rounded-lg border px-2 text-[14px] font-medium tabular-nums transition-colors md:h-9 md:w-full md:min-w-0 md:gap-0.5 md:px-1 md:text-[13px]",
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
