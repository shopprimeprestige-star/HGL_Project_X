import { useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { anteprimaTesto } from "@/crm/prova-modelli";
import type { MetaTemplate } from "@/crm/wa-meta-templates";
import { controllaModello, dividiModelli, valoriIniziali } from "./modelli-casella";
import {
  categoriaModello,
  ETICHETTA_CATEGORIA,
  euro,
  notaPrezzi,
  prezzoModello,
} from "./costi-whatsapp";

export interface ScegliModelloProps {
  /** Quelli che il canale permette (`modelliDaProvare`). */
  modelli: MetaTemplate[];
  canale: "manychat" | "cloud" | null;
  dati: { nomeLead: string; nomeConsulente: string };
  inviando: boolean;
  onInvia: (m: { nome: string; lingua: string; parametri: string[] }) => Promise<void>;
  /** Il modello adatto allo stato del lead (29/10/2026): si apre subito, coi valori. */
  consigliato?: { modello: MetaTemplate; valori: string[] } | null;
}

/** «hgl_primo_contatto» → «Primo contatto»: il nome tecnico non si mostra. */
function titolo(nome: string): string {
  const t = nome.replace(/^hgl_/, "").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** «Marketing · 0,0658 €»: la categoria vera e il prezzo di un modello. */
const costoDi = (t: MetaTemplate) =>
  `${ETICHETTA_CATEGORIA[categoriaModello(t.name, t.category)]} · ${euro(prezzoModello(t.name, t.category), 4)}`;

/** La scelta del modello fuori finestra: elenco, poi anteprima con i campi, poi invio.
 *  Un clic sul modello apre soltanto l'anteprima: il messaggio parte solo dal pulsante dell'anteprima. */
export function ScegliModello({
  modelli,
  canale,
  dati,
  inviando,
  onInvia,
  consigliato,
}: ScegliModelloProps) {
  const [scelto, setScelto] = useState<MetaTemplate | null>(consigliato?.modello ?? null);
  //  I valori restano per modello: se l'invio fallisce o si cambia idea, non si riscrive.
  const [valori, setValori] = useState<Record<string, string[]>>(
    consigliato ? { [consigliato.modello.name]: consigliato.valori } : {},
  );

  if (modelli.length === 0) {
    return (
      <p className="px-3 py-3 text-[12.5px] text-muted-foreground">
        Nessun modello è collegato a un flusso: non c&apos;è niente da mandare a questo numero. Il
        titolare li collega in Impostazioni → WhatsApp.
      </p>
    );
  }

  if (scelto) {
    const v = valori[scelto.name] ?? valoriIniziali(scelto, dati);
    const controllo = controllaModello(scelto, v, canale);
    const conferma = () => {
      if (!controllo.ok || inviando) return;
      onInvia({ nome: scelto.name, lingua: scelto.language, parametri: controllo.valori }).then(
        () => setScelto(null),
        //  L'errore lo mostra già l'hook (toast con la frase giusta): qui si resta sull'anteprima.
        () => {},
      );
    };
    return (
      <div className="px-3 py-2.5 flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 -ml-2 shrink-0"
            onClick={() => setScelto(null)}
            disabled={inviando}
            aria-label="Cambia modello"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground truncate">
              {titolo(scelto.name)}
            </div>
            {scelto.name === consigliato?.modello.name && (
              <div className="text-[11.5px] text-emerald-700">
                Consigliato per lo stato del lead · con ← ne scegli un altro
              </div>
            )}
          </div>
        </div>
        {scelto.params.length > 0 && (
          <div className="flex flex-col gap-2">
            {scelto.params.map((p, k) => (
              <label key={p.index} className="flex flex-col gap-1">
                <span className="text-[11.5px] text-muted-foreground">{p.description}</span>
                <input
                  type="text"
                  value={v[k] ?? ""}
                  onChange={(e) =>
                    setValori((prima) => {
                      const nuovi = [...(prima[scelto.name] ?? v)];
                      nuovi[k] = e.target.value;
                      return { ...prima, [scelto.name]: nuovi };
                    })
                  }
                  disabled={inviando}
                  autoComplete="off"
                  className="w-full min-h-11 bg-background border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-base md:text-[13px] rounded-md px-3 py-2"
                />
              </label>
            ))}
          </div>
        )}
        <div>
          <div className="text-[11.5px] text-muted-foreground mb-1">
            Anteprima: arriva così al cliente
          </div>
          <div className="rounded-lg bg-secondary px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {anteprimaTesto(scelto, v)}
          </div>
        </div>
        {!controllo.ok && <p className="text-[12px] text-amber-700">{controllo.motivo}</p>}
        <p className="text-[12px] text-muted-foreground">
          Questo messaggio si paga: {costoDi(scelto)} (tariffa Meta Italia).
        </p>
        <Button
          type="button"
          onClick={conferma}
          disabled={!controllo.ok || inviando}
          className="min-h-11 bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          {inviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Invia questo modello
        </Button>
      </div>
    );
  }

  const { inEvidenza, altri } = dividiModelli(modelli);
  const voce = (t: MetaTemplate) => (
    <li key={t.name}>
      <button
        type="button"
        onClick={() => setScelto(t)}
        className="w-full min-h-11 text-left rounded-md border border-border bg-background px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium text-foreground">{titolo(t.name)}</span>
          <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
            {costoDi(t)}
          </span>
        </span>
        <span className="block text-[11.5px] text-muted-foreground line-clamp-2">
          {anteprimaTesto(t, valoriIniziali(t, dati))}
        </span>
      </button>
    </li>
  );
  return (
    <div className="px-3 py-2.5 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
        {notaPrezzi()}
      </p>
      {inEvidenza.length > 0 && (
        <>
          <div className="text-[11.5px] font-medium text-muted-foreground">Pronti da mandare</div>
          <ul className="flex flex-col gap-1.5">{inEvidenza.map(voce)}</ul>
        </>
      )}
      {altri.length > 0 && (
        <details className="group" open={inEvidenza.length === 0}>
          <summary className="min-h-11 flex items-center cursor-pointer text-[12.5px] text-muted-foreground hover:text-foreground">
            Altri modelli (chiedono dati)
          </summary>
          <ul className="flex flex-col gap-1.5">{altri.map(voce)}</ul>
        </details>
      )}
    </div>
  );
}
