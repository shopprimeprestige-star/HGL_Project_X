import { useEffect, useState } from "react";
import { Ban, CalendarClock, Clock, Loader2, Send, TriangleAlert } from "lucide-react";
import { usePuo } from "@/crm/AuthContext";
import { OrariRapidi } from "@/crm/OrariRapidi";
import { Button } from "@/components/ui/button";
import { useCRM } from "@/crm/CRMContext";
import { modelliDaProvare } from "@/crm/prova-modelli";
import { cn } from "@/lib/utils";
import { ScegliModello } from "./ScegliModello";
import { finestra24, type ContattoStato } from "./stato";
import type { CasellaProps } from "./tipi";

/** La frase della finestra chiusa, quella di `stato.ts` (mai scritta due volte). */
const FRASE_CHIUSA = finestra24({ contatto: null, messaggi: [], adesso: 0 }).frase;

/** La casella in fondo alla chat, come nell'app WhatsApp: fissa in basso, campo a 16 px
 *  (iOS non ingrandisce la pagina), invio da 44 px. Cosa mostra lo decide `api.stato`:
 *  `libera` il testo, `solo_modelli` la scelta dei modelli, `stop` niente, `configura` il blocco. */
export function Casella({ api }: CasellaProps) {
  const { bozza, setBozza, residuiBozza, invia, inviando, stato, attiva, canale } = api;
  const { consultants } = useCRM();
  /*  ── PROPONI ORARI (28/10/2026) ────────────────────────────────────────
      Giorni e ore libere (crm/OrariRapidi) e il messaggio si scrive da solo.
      ⚠️ Solo a chi ha l'agenda: senza, le ore tenute per una persona sola non
       arrivano e si vedrebbero libere (un doppio appuntamento). Cambiando chat
       si chiude: gli orari erano scelti per un altro cliente. */
  const puoAgenda = usePuo()("agenda");
  const [orari, setOrari] = useState(false);
  useEffect(() => setOrari(false), [attiva?.phone]);

  const quadro = "shrink-0 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]";

  if (stato === "stop") {
    //  L'avviso intero lo mostra già la conversazione sotto la barra in alto: qui solo una riga discreta.
    return (
      <div className={quadro}>
        <p
          role="status"
          className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-muted-foreground"
        >
          <Ban className="h-3.5 w-3.5 shrink-0" />
          Invio disattivato
        </p>
      </div>
    );
  }

  if (stato === "solo_modelli") {
    const nomeLead = attiva?.lead?.data.nome?.trim() || attiva?.contact?.display_name?.trim() || "";
    const nomeConsulente =
      consultants.find((c) => c.id === attiva?.lead?.data.consulenteId)?.data.nome ?? "";
    return (
      <div className={quadro}>
        <p role="status" className="flex items-start gap-2 px-3 pt-2.5 text-[12px] text-amber-800">
          <Clock className="h-3.5 w-3.5 shrink-0 mt-px" />
          {FRASE_CHIUSA}
        </p>
        {bozza.trim() && (
          <p className="px-3 pt-1 text-[11.5px] text-muted-foreground">
            Il testo che hai scritto è conservato: tornerà nella casella quando il cliente riscrive.
          </p>
        )}
        {/* La chiave è il numero: cambiando chat si riparte da capo (niente valori dell'altro cliente). */}
        <ScegliModello
          key={attiva?.phone ?? ""}
          modelli={modelliDaProvare(canale)}
          canale={canale?.canale ?? null}
          dati={{ nomeLead, nomeConsulente }}
          inviando={inviando}
          onInvia={api.inviaModello}
        />
      </div>
    );
  }

  const configurata = stato !== "configura";
  const frase =
    configurata &&
    (attiva?.finestra?.frase ??
      //  shortcut: riga del contatto passata con un cast (un'interface non ha la firma d'indice di ContattoStato); T7 riempie `finestra` e il ripiego sparisce.
      finestra24({
        contatto: (attiva?.contact ?? null) as ContattoStato | null,
        messaggi: api.messaggi,
        adesso: Date.now(),
      }).frase);
  return (
    <div className={quadro}>
      {orari && puoAgenda && configurata && (
        <OrariRapidi
          nome={attiva?.lead?.data?.nome}
          onInserisci={(t) => {
            setBozza(bozza.trim() ? `${bozza.trimEnd()}\n\n${t}` : t);
            setOrari(false);
          }}
          onChiudi={() => setOrari(false)}
        />
      )}
      {residuiBozza.length > 0 && (
        <div className="px-3 pt-2">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              <span className="font-semibold">{residuiBozza.join("  ")}</span> non verrà sostituito:
              arriverebbe scritto così al cliente. Scrivi il dato al posto del segnaposto.
            </span>
          </div>
        </div>
      )}
      {frase && (
        <p className="flex items-center gap-1.5 px-3 pt-2 text-[11.5px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          {frase}
        </p>
      )}
      <div className="px-3 py-2 flex items-end gap-2">
        {puoAgenda && configurata && (
          <Button
            type="button"
            size="icon"
            variant={orari ? "default" : "outline"}
            onClick={() => setOrari((v) => !v)}
            aria-label="Proponi orari liberi"
            aria-expanded={orari}
            title="Proponi orari liberi"
            className="h-11 w-11 shrink-0 rounded-full"
          >
            <CalendarClock className="h-4 w-4" />
          </Button>
        )}
        <textarea
          value={bozza}
          onChange={(e) => setBozza(e.target.value)}
          //  iOS fa scorrere il documento quando compare la tastiera: si riporta in alto
          //  (la posizione della casella la tiene `visualViewport`, non lo scorrimento).
          onFocus={() => window.scrollTo(0, 0)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!inviando) void invia();
            }
          }}
          placeholder={
            configurata ? "Scrivi un messaggio…" : "Configura WhatsApp in Impostazioni per inviare"
          }
          disabled={!configurata}
          enterKeyHint="send"
          rows={Math.min(6, Math.max(1, bozza.split("\n").length))}
          aria-label="Messaggio"
          className={cn(
            "flex-1 min-w-0 min-h-11 bg-background border border-input text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring resize-none rounded-2xl px-4 py-2.5",
            //  16 px sul telefono: sotto, iOS ingrandisce la pagina al tocco.
            "text-base md:text-[13px] leading-relaxed md:rounded-md md:px-3 md:py-2",
          )}
        />
        <Button
          onClick={() => void invia()}
          size="icon"
          aria-label="Invia messaggio"
          disabled={!bozza.trim() || inviando || !configurata}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-11 w-11 shrink-0 disabled:opacity-50"
        >
          {inviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
