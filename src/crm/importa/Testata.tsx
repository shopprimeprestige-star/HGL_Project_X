/** ── LA TESTATA DI «LEAD IMPORTATI» ────────────────────────────────────────
 *
 *  Una fascia sola, tre cose:
 *   1. L'ALLARME, SOLO QUANDO C'È: «N richiami scaduti: sono in cima», in
 *      rosso, cliccabile (apre lo Stato «Promesse»). Senza ritardo al suo
 *      posto c'è il lavoro di adesso: «N da chiamare». ⚠️ È l'unico colore
 *      della testata: il rosso si vede perché è solo.
 *   2. IL GIRO: una barra e «X di Y fatti oggi».
 *   3. LA RICERCA.
 *  Più la riga dei «messi da parte da troppo», che compare solo quando serve.
 *
 *  ── COSA C'ERA PRIMA ─────────────────────────────────────────────────────
 *  Cinque numeri in fila (in coda · da provare · segnati · saltati) più «N di
 *  M provati in questo giro», e una frase grande sulle promesse anche quando
 *  non era scaduto niente: ripeteva le prime righe della lista. Tolti su
 *  richiesta del titolare (14/10: «poche funzioni ma buone»). I saltati restano
 *  in «Altro» e nella riga qui sotto; gli esiti segnati nei KPI.
 *
 *  ⚠️ Il numero dei richiami scaduti arriva da `contaPromesse`
 *   (crm/importa/chi-chiamare), lo stesso che conta le righe dello Stato
 *   «Promesse»: la prova incrocia i due moduli.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SALTATO_DA_TROPPO } from "@/crm/importa/saltati";

export function Testata({
  promesse,
  daProvare,
  inCoda,
  saltatiFermi,
  onVediPromesse,
  onVediSaltati,
  ricerca,
}: {
  /** Le promesse della lista «Da chiamare»: quante sono e quante già scadute.
   *  Arriva da `contaPromesse`: vedi l'intestazione. */
  promesse: { tutte: number; scadute: number };
  daProvare: number;
  inCoda: number;
  /** Restano nel contratto: la pagina li passa ancora, e il numero dei
   *  saltati vive nel menu «Altro» e nella riga dei dimenticati. */
  segnate?: number;
  saltati?: number;
  saltatiFermi: number;
  onVediPromesse: () => void;
  onVediSaltati: () => void;
  /** La ricerca resta un pezzo della pagina e non di questo file: è l'unico
   *  comando della testata che scrive nello stato del giro. */
  ricerca: ReactNode;
}) {
  /*  ── UN NUMERO SOLO, E L'ALLARME SOLO QUANDO C'È ────────────────────────
      Richiesta del titolare (14/10): «poche funzioni ma buone». Qui c'erano
      cinque numeri in fila (in coda · da provare · segnati · saltati) più
      «N di M provati in questo giro», e una frase grande sulle promesse anche
      quando non era scaduto niente — che ripeteva le prime righe della lista.
      Adesso: il rosso compare SOLO con richiami scaduti, e il giro è una barra
      con una frase. I saltati restano raggiungibili da «Altro» e dalla riga
      dei dimenticati qui sotto, che si accende quando qualcuno è fermo da
      troppo. */
  const inRitardo = promesse.scadute > 0;
  /** `inCoda` a zero non è «tutto fatto», è «non c'è niente»: la barra in quel
   *  caso non si disegna. */
  const fatti = Math.max(0, inCoda - daProvare);
  const percento = inCoda > 0 ? Math.round((fatti / inCoda) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {inRitardo ? (
          <button
            type="button"
            onClick={onVediPromesse}
            className="-mx-2 flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1 text-left transition-colors hover:bg-rose-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold leading-tight text-rose-700">
              {promesse.scadute === 1
                ? "1 richiamo scaduto: è in cima"
                : `${promesse.scadute} richiami scaduti: sono in cima`}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-rose-400" />
          </button>
        ) : (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[26px] font-semibold leading-none tabular-nums text-foreground">
              {daProvare}
            </span>
            <span className="truncate text-[15px] font-semibold text-foreground">da chiamare</span>
          </div>
        )}
        <div className="min-w-[14rem] flex-1 sm:max-w-sm">{ricerca}</div>
      </div>

      {inCoda > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percento}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avanzamento del giro di telefonate"
          >
            <div
              className="h-full rounded-full bg-foreground/70 transition-[width] duration-500"
              style={{ width: `${percento}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
            {fatti} di {inCoda} fatti oggi
          </span>
        </div>
      )}

      {/*  ── I DIMENTICATI, QUANDO CE NE SONO ─────────────────────────────
           Un saltato che nessuno rimette in coda esce dal lavoro in silenzio:
           non è in coda, non ha un esito, non scade niente. Il numero qui sopra
           lo conta sempre, ma un numero di contorno si legge di sfuggita;
           questa riga compare solo quando qualcuno è fermo da troppo e sparisce
           da sola appena la si sistema — così quando c'è vuol dire qualcosa.
           Sta DENTRO la testata e non sotto, come stava prima: era un riquadro
           in più fra il setter e la persona da chiamare, e diceva una cosa che
           appartiene al riepilogo della giornata. */}
      {saltatiFermi > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[12.5px] text-amber-900">
            <b>
              {saltatiFermi === 1
                ? "1 contatto messo da parte"
                : `${saltatiFermi} contatti messi da parte`}
            </b>{" "}
            da più di {SALTATO_DA_TROPPO} giorni: nessuno li sta chiamando e non compaiono in
            nessuna coda.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 bg-white text-[12px]"
            onClick={onVediSaltati}
          >
            <SkipForward className="mr-1 h-3.5 w-3.5" /> Guardali
          </Button>
        </div>
      )}
    </div>
  );
}
