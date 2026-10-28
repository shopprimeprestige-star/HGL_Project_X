/** ── PROPONI ORARI: LA FINESTRA A TUTTO SCHERMO ─────────────────────────────
 *
 *  Richiesta del titolare (28/10/2026): «proponi orari deve mostrare le vere
 *  disponibilità; cliccando si apre un popup a tutto schermo con le
 *  disponibilità di tutti i consulenti, design corretto e semplice: clicco
 *  prima il consulente, posso scegliere più orari e giorni, e col check crea il
 *  messaggio, che dice anche il nome del consulente; devo solo inviarlo».
 *
 *  Come funziona:
 *   1. in alto i consulenti, ciascuno con quante ore libere ha in 14 giorni;
 *   2. sotto, giorno per giorno, TUTTE le sue ore libere (si toccano più ore
 *      anche in giorni diversi);
 *   3. in fondo il conto delle ore scelte e la spunta: il messaggio va nel
 *      campo della chat, pronto da inviare.
 *  I posti sono quelli di Slot liberi (`useGiorniLiberi`), con chiusure e
 *  capienza caricate prima del calcolo. Il testo sta in crm/wa-orari.
 *  ⚠️ SUL TELEFONO È A TUTTO SCHERMO (non il foglio dal basso): con 14 giorni di
 *   ore il foglio all'88% lasciava la spunta sotto il pollice sbagliato.
 *  ⚠️ CAMBIANDO CONSULENTE LE ORE SCELTE SI AZZERANO: erano sue.
 *  ⚠️ GLI HOOK IN CIMA, nessun ritorno anticipato prima di loro.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState } from "react";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra } from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";
import { useGiorniLiberi } from "@/crm/useGiorniLiberi";
import { giornoParlato } from "@/crm/promemoria/formati";
import { giornoPerMessaggio, messaggioOrari, type OrarioScelto } from "@/crm/wa-orari";

const CHIP =
  "inline-flex shrink-0 items-center justify-center rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OrariRapidi(p: {
  /** il nome del cliente, per il saluto (solo la prima parola) */
  nome?: string | null;
  /** mette il testo nel campo di scrittura della chat */
  onInserisci: (testo: string) => void;
  onChiudi: () => void;
}) {
  const [chi, setChi] = useState<string>("");
  const [scelte, setScelte] = useState<OrarioScelto[]>([]);
  //  Un calcolo solo, di tutta la squadra: le ore di un consulente sono le
  //  fasce in cui LUI ha ancora posto (stesso risultato di `chi`, una lettura in meno).
  const tutti = useGiorniLiberi({ quanti: 14 });
  const oggi = tutti.giorni[0]?.data ?? "";

  /** Quante ore libere ha ciascuno nei 14 giorni (per scegliere a colpo d'occhio). */
  const consulenti = useMemo(() => {
    const ore = new Map<string, number>();
    for (const g of tutti.giorni)
      for (const f of g.fasce) for (const c of f.chi) ore.set(c.id, (ore.get(c.id) ?? 0) + 1);
    return tutti.squadra.map((c) => ({
      id: c.id,
      nome: String(c.data?.nome ?? "").trim() || "Senza nome",
      ore: ore.get(c.id) ?? 0,
    }));
  }, [tutti.giorni, tutti.squadra]);

  const scelto = consulenti.find((c) => c.id === chi) ?? null;
  const giorni = chi
    ? tutti.giorni
        .map((g) => ({
          data: g.data,
          fasce: g.fasce.filter((f) => f.chi.some((c) => c.id === chi)),
        }))
        .filter((g) => g.fasce.length > 0)
    : [];
  //  Solo le scelte ancora libere: un'ora presa intanto da un collega, o già
  //  passata, esce dal messaggio da sola (revisione del 28/10).
  const valide = scelte.filter((s) =>
    giorni.some((g) => g.data === s.data && g.fasce.some((f) => f.ora === s.ora)),
  );
  const testo = messaggioOrari(valide, oggi, p.nome, scelto?.nome);

  const eScelto = (data: string, ora: string) =>
    scelte.some((s) => s.data === data && s.ora === ora);
  const cambia = (data: string, ora: string) =>
    setScelte((s) =>
      s.some((x) => x.data === data && x.ora === ora)
        ? s.filter((x) => !(x.data === data && x.ora === ora))
        : [...s, { data, ora }],
    );
  const titoloGiorno = (data: string) => {
    const g = giornoPerMessaggio(data, oggi);
    const intero = giornoParlato(data) ?? data;
    return g === "oggi" || g === "domani"
      ? `${g[0].toUpperCase()}${g.slice(1)} · ${intero}`
      : intero;
  };

  return (
    <Finestra
      aperta
      onCambio={(v) => !v && p.onChiudi()}
      icona={CalendarClock}
      titolo="Proponi orari"
      contesto={scelto ? `Con ${scelto.nome}` : "Scegli il consulente"}
      larghezza="lg"
      //  Sul telefono a tutto schermo; dal tablet in su la finestra centrata.
      className="max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-0"
      classeCorpo="pb-2"
      azioni={
        <div className="flex w-full items-center gap-3">
          <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
            {valide.length === 0
              ? scelto
                ? "Tocca una o più ore"
                : "Prima il consulente"
              : `${valide.length} ${valide.length === 1 ? "orario scelto" : "orari scelti"}`}
            {valide.length > 0 && (
              <button
                type="button"
                onClick={() => setScelte([])}
                className="ml-2 text-[12px] underline underline-offset-2 hover:text-foreground"
              >
                Azzera
              </button>
            )}
          </p>
          <Button
            onClick={() => p.onInserisci(testo)}
            disabled={!testo}
            className="h-11 shrink-0 gap-1.5 rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
          >
            <Check className="h-5 w-5" /> Crea messaggio
          </Button>
        </div>
      }
    >
      {/* 1. IL CONSULENTE */}
      <section aria-labelledby="orari-chi">
        <h3
          id="orari-chi"
          className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Consulente
        </h3>
        {consulenti.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Nessun consulente con orari di lavoro.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Consulente">
            {consulenti.map((c) => {
              const attivo = c.id === chi;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={attivo}
                  onClick={() => {
                    setChi(c.id);
                    setScelte([]);
                  }}
                  className={cn(
                    CHIP,
                    "h-11 gap-2 px-4 text-[14px] md:h-9 md:text-[13px]",
                    attivo
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {c.nome}
                  <span
                    className={cn(
                      "text-[12px] tabular-nums",
                      attivo ? "text-emerald-50" : "text-muted-foreground",
                    )}
                  >
                    {c.ore === 0 ? "nessuna ora" : `${c.ore} ore`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. LE SUE ORE LIBERE, GIORNO PER GIORNO */}
      {scelto && (
        <section aria-labelledby="orari-quando" className="mt-5">
          <h3
            id="orari-quando"
            className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Ore libere nei prossimi 14 giorni
          </h3>
          {!tutti.pronto ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Leggo l'agenda…
            </p>
          ) : giorni.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {scelto.nome} non ha ore libere nei prossimi 14 giorni.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {giorni.map((g) => (
                <li key={g.data} className="px-3 py-3">
                  <p className="mb-2 text-[13.5px] font-semibold text-foreground first-letter:uppercase">
                    {titoloGiorno(g.data)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.fasce.map((f) => {
                      const si = eScelto(g.data, f.ora);
                      return (
                        <button
                          key={f.ora}
                          type="button"
                          aria-pressed={si}
                          onClick={() => cambia(g.data, f.ora)}
                          className={cn(
                            CHIP,
                            "h-11 min-w-[4.5rem] px-3 text-[14px] tabular-nums md:h-9 md:text-[13px]",
                            si
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-border bg-background text-foreground hover:bg-muted",
                          )}
                        >
                          {si && <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
                          {f.ora}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 3. COME ARRIVA AL CLIENTE */}
      {testo && (
        <section className="mt-5">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Il messaggio
          </h3>
          <p className="whitespace-pre-wrap rounded-lg bg-emerald-50/60 p-3 text-[13.5px] leading-relaxed text-foreground">
            {testo}
          </p>
        </section>
      )}
    </Finestra>
  );
}
