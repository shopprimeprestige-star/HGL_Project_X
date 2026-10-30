/** ── IL RIQUADRO «MESSAGGIO AUTOMATICO» ────────────────────────────────────────
 *
 *  Commessa 2026-10-30-messaggio-per-stato. Sta nelle finestre in cui si sceglie lo stato con
 *  la data di ricontatto (QuickStatusDialog, la sua procedura guidata, la scheda LeadDialog),
 *  e SOLO per gli stati che hanno un messaggio automatico (`statoHaMessaggio`, cioè la tabella
 *  del giro). È facoltativo: vuoto e «modello dello stato» = tutto come prima.
 *
 *  Due domande, in parole semplici:
 *   · il tuo testo, che parte se il cliente ti ha scritto nelle ultime 24 ore;
 *   · cosa mandare se sono passate più di 24 ore: il modello dello stato (di serie) o il
 *     messaggio generico «come eravamo rimasti». Si vedono i due testi, come li leggerà il cliente.
 *
 *  Il riquadro tiene il testo che si sta scrivendo qui dentro e dice al padre cosa salvare
 *  (`onCambia` → `messaggioPerSalvare`, già pulito, oppure `undefined` = niente da salvare):
 *  il padre lo mette nella scheda (`data.messaggioStato`). Va montato con una `key` che cambia
 *  col lead e con lo stato, così riparte dal messaggio giusto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useId, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { corpoLeggibile } from "./testo-modello";
import { CLASSE_AREA } from "./ui/Finestra";
import type { LeadData } from "./types";
import {
  MAX_TESTO_MESSAGGIO,
  MODELLO_GENERICO,
  leggiMessaggioStato,
  messaggioPerSalvare,
  statoHaMessaggio,
  type FuoriFinestra,
  type MessaggioStato,
} from "./manychat/messaggio-stato";
import { TABELLA_STATI } from "./manychat/stati";
import type { LeadStatus } from "./types";

/** Il testo del modello come lo leggerà il cliente, con i dati della scheda. */
function anteprima(
  modello: string,
  scheda: Partial<LeadData>,
  consulente: string | null | undefined,
): string {
  return corpoLeggibile(`[template:${modello}]`, scheda, consulente ?? null).testo;
}

export function RiquadroMessaggioStato({
  stato,
  scheda,
  consulente,
  onCambia,
  className,
}: {
  stato: LeadStatus | string | null | undefined;
  /** la scheda (anche la bozza del modulo): dà il nome e i dati alle anteprime e il messaggio già scritto */
  scheda: Partial<LeadData>;
  /** il nome del consulente della scheda, per l'anteprima */
  consulente?: string | null;
  /** il messaggio da salvare, o `undefined` se non c'è niente da salvare */
  onCambia: (m: MessaggioStato | undefined) => void;
  className?: string;
}) {
  const id = useId();
  const salvato = leggiMessaggioStato(scheda, stato);
  const [testo, setTesto] = useState(salvato?.testo ?? "");
  const [fuori, setFuori] = useState<FuoriFinestra>(salvato?.fuoriFinestra ?? "stato");
  if (!statoHaMessaggio(stato)) return null;

  const modelloStato = TABELLA_STATI[stato as LeadStatus]?.modello ?? "";
  const cambia = (t: string, f: FuoriFinestra) => {
    setTesto(t);
    setFuori(f);
    onCambia(messaggioPerSalvare(stato, t, f, new Date()));
  };
  const scelte: { valore: FuoriFinestra; titolo: string; testo: string }[] = [
    {
      valore: "stato",
      titolo: "Il modello dello stato (di serie)",
      testo: anteprima(modelloStato, scheda, consulente),
    },
    {
      valore: "generico",
      titolo: "Il messaggio generico «Come eravamo rimasti»",
      testo: anteprima(MODELLO_GENERICO, scheda, consulente),
    },
  ];

  return (
    <section
      aria-labelledby={`${id}-titolo`}
      className={cn("space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3", className)}
    >
      <div>
        <p id={`${id}-titolo`} className="text-[13px] font-semibold text-slate-800">
          Messaggio automatico <span className="font-normal text-slate-500">· facoltativo</span>
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
          Parte da solo, nel giorno e all&apos;ora del promemoria. Se lo lasci vuoto va il messaggio
          di sempre.
        </p>
      </div>

      <div>
        <label htmlFor={`${id}-testo`} className="text-[12px] font-medium text-slate-700">
          Il tuo messaggio (parte se il cliente ti ha scritto nelle ultime 24 ore)
        </label>
        <Textarea
          id={`${id}-testo`}
          value={testo}
          onChange={(e) => cambia(e.target.value, fuori)}
          rows={3}
          maxLength={MAX_TESTO_MESSAGGIO}
          placeholder="Es. Ciao {nome}, ti scrivo per sapere come procediamo."
          className={cn(CLASSE_AREA, "mt-1.5")}
        />
        <p className="mt-1 text-[11.5px] leading-snug text-slate-500">
          Scrivendo {"{nome}"} compare il nome del cliente.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[12px] font-medium text-slate-700">
          Se sono passate più di 24 ore manda:
        </legend>
        {scelte.map((s) => (
          <label
            key={s.valore}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-white px-3 py-2.5",
              "transition-colors hover:bg-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-400",
              fuori === s.valore ? "border-slate-400" : "border-slate-200",
            )}
          >
            <input
              type="radio"
              name={`${id}-fuori`}
              value={s.valore}
              checked={fuori === s.valore}
              onChange={() => cambia(testo, s.valore)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-slate-800"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-slate-900">{s.titolo}</span>
              <span className="mt-1 block whitespace-pre-line text-[12px] leading-snug text-slate-500">
                {s.testo}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
