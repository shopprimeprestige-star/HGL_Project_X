/** ── COSA FARE DI QUESTA PERSONA, SENZA USCIRE DALLA LISTA ─────────────────
 *
 *  «Da fare oggi» sapeva dire soltanto CHE COSA c'è da fare. Per agire —
 *  cambiare l'esito di una chiamata, spostare un richiamo a domani, scrivere
 *  due righe su com'è andata — bisognava aprire la scheda intera, fare il
 *  gesto, chiuderla e ritrovare il punto della lista. Trenta volte al giorno.
 *
 *  Questo riquadro tiene i tre gesti sulla riga. Non ne inventa nessuno:
 *   · lo STATO lo cambia la pastiglia condivisa (crm/SelettoreStatoDialog), la
 *     stessa di «Oggi», della scheda e dell'importazione. Chi la preme trova la
 *     griglia che conosce, e da lì il CRM prosegue come sempre — con le sue
 *     finestre per gli stati che chiedono una data o dei soldi;
 *   · il QUANDO scrive `dataRicontatto`, che è il campo da cui questa stessa
 *     pagina fa nascere la riga: spostare a domani vuol dire vedersela
 *     ricomparire domani, non farla sparire;
 *   · le NOTE si accodano a `notePostCall`, il campo di sempre — quello che
 *     legge chi riapre la scheda fra due settimane.
 *
 *  ⚠️ NIENTE SI SCRIVE QUI DENTRO. Questo file raccoglie il gesto e lo passa
 *   alla pagina: le tre scritture stanno in routes/CRM.dafare.tsx, che è anche
 *   l'unico posto in cui si sa se una scrittura è andata a buon fine. Un
 *   componente di disegno che scrive sul database è la strada più corta perché
 *   la stessa regola finisca in due versioni leggermente diverse.
 *
 *  ⚠️ E LE NOTE NON SI SOVRASCRIVONO MAI: il «+» AGGIUNGE. Chi scrive due
 *   parole dopo una telefonata non ha nessuna intenzione di cancellare quello
 *   che aveva scritto il collega il mese scorso, e un campo di testo già pieno
 *   che si presenta modificabile è il modo più naturale di farlo per sbaglio.
 *   Qui il riquadro parte vuoto e quello che c'è già si legge sopra, in grigio.
 */
import { useEffect, useState } from "react";
import { CalendarClock, Check, MessageSquarePlus, Plus, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PastigliaStato } from "@/crm/SelettoreStatoDialog";
import { oggiIso } from "@/crm/ui";
import type { Lead, LeadStatus } from "@/crm/types";
import type { RigaDaFare } from "./righe";
import { Pannello, Pillola } from "@/crm/ui/Finestra";

/** Le stesse distanze — e nello stesso ordine — delle scorciatoie con cui si
 *  sposta una cosa scritta a mano, due pulsanti più in là sulla stessa riga.
 *  Due tabelle diverse per lo stesso gesto si imparano due volte. */
const QUANDO: { g: number; l: string }[] = [
  { g: 0, l: "Oggi" },
  { g: 1, l: "Domani" },
  { g: 3, l: "Fra 3 giorni" },
  { g: 7, l: "Fra una settimana" },
];

const fraGiorni = (g: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + g);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function AzioniLead({
  riga,
  occupato,
  onStato,
  onQuando,
  onNota,
}: {
  riga: RigaDaFare;
  occupato?: boolean;
  /** L'esito scelto dalla griglia condivisa: da qui in poi decide la pagina. */
  onStato: (lead: Lead, stato: LeadStatus) => void;
  /** Il giorno del prossimo ricontatto, ISO. */
  onQuando: (lead: Lead, data: string) => void;
  /** Due righe da accodare alle note della scheda. */
  onNota: (lead: Lead, testo: string) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [data, setData] = useState(riga.giorno || oggiIso());
  const [nota, setNota] = useState("");
  const [scriveNota, setScriveNota] = useState(false);

  //  Riaprendo si riparte da quello che la riga dice ADESSO: se nel frattempo
  //  l'ha spostata un collega, i campi devono raccontare la sua versione e non
  //  quella rimasta in memoria da mezz'ora.
  useEffect(() => {
    if (!aperto) {
      setData(riga.giorno || oggiIso());
      setNota("");
      setScriveNota(false);
    }
  }, [aperto, riga.giorno]);

  const lead = riga.lead;
  if (!lead) return null;

  const giaScritte = String(lead.data?.notePostCall ?? "").trim();

  const chiudiCon = (fn: () => void) => {
    setAperto(false);
    fn();
  };

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={occupato}
          aria-label={`Cambia stato, data o note di ${riga.chi}`}
          title="Cambia lo stato, sposta il richiamo o aggiungi una nota"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <Pannello
        side="bottom"
        align="end"
        className="w-[21rem] max-w-[calc(100vw-2rem)]"
        titolo="Cosa fare adesso"
        contesto={riga.chi}
        classeCorpo="flex flex-col gap-3.5"
      >
        {/* ── 1 · L'ESITO ─────────────────────────────────────────────────
            La pastiglia è quella di tutto il CRM: apre la griglia degli stati
            possibili PER QUESTA scheda, e da lì il resto lo fa la pagina. */}
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Check className="h-3 w-3" /> Esito
          </span>
          <PastigliaStato
            dati={lead.data ?? {}}
            contesto={riga.chi}
            disabilitata={occupato}
            onScegli={(s) => chiudiCon(() => onStato(lead, s))}
          />
        </label>

        {/* ── 2 · QUANDO RICHIAMARLA ──────────────────────────────────────
            Le scorciatoie salvano subito: chiedere una conferma dopo aver
            premuto «Domani» raddoppierebbe il costo del gesto più frequente. */}
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarClock className="h-3 w-3" /> Quando richiamarla
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUANDO.map((q) => {
              const giorno = fraGiorni(q.g);
              return (
                <Pillola
                  key={q.g}
                  attiva={riga.giorno === giorno}
                  onClick={() => chiudiCon(() => onQuando(lead, giorno))}
                >
                  {q.l}
                </Pillola>
              );
            })}
          </div>
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-slate-500">
              Un altro giorno
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="h-9 text-[13px] tabular-nums"
              />
            </label>
            <button
              type="button"
              disabled={!data || occupato}
              onClick={() => chiudiCon(() => onQuando(lead, data))}
              className="h-9 shrink-0 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
            >
              Sposta
            </button>
          </div>
        </div>

        {/* ── 3 · LE NOTE ─────────────────────────────────────────────────
            Chiuse finché non servono: il riquadro deve poter essere aperto,
            guardato e chiuso senza scavalcare un campo di testo. */}
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <MessageSquarePlus className="h-3 w-3" /> Note
          </span>
          {giaScritte && (
            //  Quello che c'è già si LEGGE, non si modifica: vedi la nota in
            //  cima al file. Poche righe, perché qui serve a ricordare, non a
            //  rileggere tutto lo storico — quello sta nella scheda.
            <p className="max-h-20 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[12px] leading-snug text-muted-foreground">
              {giaScritte}
            </p>
          )}
          {!scriveNota ? (
            <button
              type="button"
              disabled={occupato}
              onClick={() => setScriveNota(true)}
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Aggiungi una nota
            </button>
          ) : (
            <>
              <Textarea
                autoFocus
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={3}
                placeholder="Com'è andata, cosa ha detto, cosa serve la prossima volta…"
                className="text-[13px]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!nota.trim() || occupato}
                  onClick={() => chiudiCon(() => onNota(lead, nota.trim()))}
                  className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  Aggiungi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScriveNota(false);
                    setNota("");
                  }}
                  className="rounded-md px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Annulla
                </button>
              </div>
            </>
          )}
        </div>
      </Pannello>
    </Popover>
  );
}
