/** ── IL SEGNO E IL COMANDO DELLA PRIORITÀ ──────────────────────────────────
 *
 *  DUE PEZZI, E STANNO TUTTI E DUE FUORI DALLA SCHEDA
 *  `SegnoPriorita` è quello che si LEGGE scorrendo — il cartellino «Da
 *  anticipare» e, accanto, il giorno che vorrebbe il cliente. `TastoPriorita` è
 *  quello che si PREME — un pulsante nel gruppo dei comandi della riga, che
 *  apre una finestrella con la data e con il modo di togliere tutto.
 *  Nessuno dei due sta dentro la scheda cliente: una posa da anticipare che si
 *  scopre solo aprendo la scheda non è una posa da anticipare, è una nota.
 *
 *  PERCHÉ VIOLA E NON AMBRA
 *  In questa pagina l'ambra ha già un significato preciso e ripetuto su ogni
 *  riga: «qui manca un dato» — l'orario, il tecnico, l'indirizzo, l'importo.
 *  L'azzurro è OGGI e il rosa è il ritardo. La priorità non è nessuna di queste
 *  tre cose: non è un buco da riempire, non è una data e non è un guasto, è una
 *  decisione presa da noi. Il viola in queste schermate non lo usa nient'altro,
 *  quindi non ruba il significato a nessuno.
 *
 *  L'ICONA: ArrowUpToLine
 *  Una freccia che si ferma contro una riga: è il gesto alla lettera — porta
 *  questa riga in cima all'elenco — e non è un allarme. Le icone che dicono
 *  urgenza (fiamma, triangolo, fulmine) avrebbero rimesso dentro il giudizio
 *  che «Anticipa» tiene fuori apposta, e su dieci righe accese la pagina
 *  sembrerebbe un incendio invece di una coda.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { ArrowUpToLine, CalendarClock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NotaFinestra, Pannello } from "./ui/Finestra";
import { dataBreve } from "./ui";
import { nomeCompleto, posaCompletata } from "./InstallationScheduleDialog";
import { daAnticipare, dataDesiderata, inPriorita, useAzioniPriorita } from "./priorita";
import type { Lead } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. IL SEGNO — si legge scorrendo, senza aprire niente
   ═════════════════════════════════════════════════════════════════════════ */

/** Il cartellino «Da anticipare» e, se il cliente l'ha detto, il giorno che
 *  vorrebbe. Sta accanto al nome, nella stessa fila degli altri segni della
 *  riga (note, driver, foto).
 *
 *  ⚠️ LA DATA SI SCRIVE CON IL VERBO — «vorrebbe il 20 gen» — e non è una
 *  gentilezza di stile: sulla stessa riga, due centimetri più sotto, c'è già la
 *  data della posa. Due date affiancate senza una parola che le distingua si
 *  leggono tutte e due come appuntamenti presi, e il modo in cui ce ne si
 *  accorge è un cliente che aspetta a casa un tecnico che non sa di doverci
 *  andare. Il titolo lo ripete per esteso a chi ci passa sopra.
 *
 *  Non rende niente su una posa già fatta né su una senza priorità: il perché
 *  sta su `daAnticipare` in crm/priorita.ts. */
export function SegnoPriorita({
  lead,
  chiusa,
  className,
}: {
  lead: Lead;
  /** ── LA DOMANDA CHE CHIUDE LA PRATICA NON È LA STESSA IN OGNI SCHEDA ─────
   *  `daAnticipare` sa spegnere il cartellino su una posa FATTA, che è la
   *  chiusura delle installazioni e del domicilio. Ma «Da spedire» chiude con
   *  un'altra domanda — "è partito?" — e un pacco già in viaggio NON è
   *  `posaCompletata`: senza questo interruttore si sarebbe letto «Da
   *  anticipare» sotto «Spedite», cioè su una riga per cui non esiste più
   *  niente da anticipare. Chi chiama passa qui la SUA definizione di finito;
   *  ⚠️ è un'aggiunta, non una sostituzione — a posa fatta il cartellino resta
   *  spento comunque, così nessuna scheda può riaccenderlo dimenticandosene. */
  chiusa?: boolean;
  className?: string;
}) {
  if (chiusa || !daAnticipare(lead)) return null;
  const chiesta = dataDesiderata(lead);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-300 bg-violet-50",
          "px-1.5 py-0.5 text-[11px] font-semibold leading-none text-violet-700",
        )}
        title="Messa in cima all'elenco a mano. Si toglie dallo stesso pulsante «Anticipa»"
      >
        <ArrowUpToLine className="h-3 w-3 shrink-0" />
        Da anticipare
      </span>
      {chiesta && (
        <span
          className="truncate text-[11px] leading-none text-violet-700"
          title="Il giorno che vorrebbe il cliente: è quello che ha chiesto, non un appuntamento. La data della posa si fissa da «Programma»"
        >
          vorrebbe il {dataBreve(chiesta)}
        </span>
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL COMANDO — mettere in cima, dire quando, togliere
   ═════════════════════════════════════════════════════════════════════════ */

/** Il pulsante della riga. Un solo bottone per tre cose, ed è voluto: metti,
 *  cambia la data, togli. Tre comandi separati avrebbero occupato metà riga per
 *  un gesto che si fa una volta ogni venti pratiche.
 *
 *  ⚠️ È UN INTERRUTTORE CHE SI SPEGNE. Quando la priorità è accesa la finestra
 *  apre con «Togli la priorità» dentro, alla stessa distanza del pulsante che
 *  l'ha accesa: se togliere costasse più che mettere, in un mese sarebbero
 *  anticipate tutte — cioè nessuna.
 *
 *  Su una posa già fatta il pulsante non c'è: non resta niente da portare
 *  avanti, e un comando che non cambia niente è rumore in un gruppo di comandi
 *  che questa riga tiene apposta a due. Lo stesso vale per un pacco già
 *  partito, e lì la chiusura la dichiara chi chiama — vedi `chiusa` su
 *  `SegnoPriorita`, qui sopra: il segno e il comando spariscono INSIEME,
 *  perché un cartellino senza il pulsante che lo toglie è una gabbia. */
export function TastoPriorita({
  lead,
  chiusa,
  esteso,
}: {
  lead: Lead;
  chiusa?: boolean;
  /** ── QUANDO IL PULSANTE PORTA ANCHE LA PAROLA ──────────────────────────
   *  ⚠️ ESISTE PERCHÉ IL COMANDO NON SI TROVAVA. Era — ed è ancora, dove lo
   *   spazio è poco — un quadratino da ventotto pixel con dentro una freccia e
   *   nient'altro: chi non l'aveva mai premuto non aveva modo di sapere che
   *   quella freccia anticipa una posa. Il committente l'ha richiesto una
   *   seconda volta descrivendolo da zero, che è la prova che di fatto non
   *   c'era.
   *  Con `esteso` il pulsante si porta dietro la sua parola — «Anticipa», o «In
   *  cima» quando è già acceso — e diventa leggibile senza doverci passare
   *  sopra col mouse (sul tablet, dove queste pagine si usano davvero, il
   *  suggerimento a comparsa non esiste proprio).
   *  ⚠️ NON è acceso ovunque: nelle schede dei pacchi la riga ha già due
   *   comandi larghi, e una terza parola manderebbe a capo l'intera fila. Lo
   *   accende chi ha lo spazio — l'elenco delle installazioni, che è la pagina
   *   in cui l'ordine si governa. */
  esteso?: boolean;
}) {
  const { metti, togli } = useAzioniPriorita();
  const attiva = inPriorita(lead);
  const chiesta = dataDesiderata(lead);
  const [aperto, setAperto] = useState(false);
  const [quando, setQuando] = useState(chiesta);

  //  ⚠️ TUTTI GLI HOOK SOPRA L'USCITA ANTICIPATA, sempre: questo componente sta
  //   su ogni riga di un elenco che si ridisegna in continuazione, e un hook
  //   sotto un `return null` cambierebbe il numero di hook fra due disegni
  //   della stessa riga — schermata bianca, non un errore leggibile.
  //  Se la data cambia da fuori (un collega, un altro pannello) il campo si
  //  riallinea: mostrare a video un giorno diverso da quello salvato è il modo
  //  più silenzioso di promettere al cliente la settimana sbagliata.
  useEffect(() => {
    setQuando(chiesta);
  }, [chiesta]);

  if (chiusa || posaCompletata(lead)) return null;

  const salva = () => {
    setAperto(false);
    void metti(lead, quando);
  };

  return (
    <Popover
      open={aperto}
      onOpenChange={(v) => {
        //  Riaprendo si riparte da quello che è SCRITTO, non da quello che era
        //  stato digitato e poi abbandonato chiudendo la finestra: un campo che
        //  si ricorda una modifica mai salvata la fa sembrare salvata.
        if (v) setQuando(chiesta);
        setAperto(v);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={attiva}
          aria-label={
            attiva
              ? `Togli la priorità a ${nomeCompleto(lead)}`
              : `Anticipa la posa di ${nomeCompleto(lead)}`
          }
          title={
            attiva
              ? "In cima all'elenco. Premi per cambiare il giorno chiesto dal cliente o per toglierla"
              : "Anticipa: porta questa posa in cima all'elenco"
          }
          className={cn(
            "h-7 shrink-0",
            esteso ? "px-2 text-[11.5px]" : "w-7 p-0",
            attiva
              ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
              : "text-muted-foreground",
          )}
        >
          <ArrowUpToLine className={cn("h-3.5 w-3.5", esteso && "mr-1")} />
          {esteso && (attiva ? "In cima" : "Anticipa")}
        </Button>
      </PopoverTrigger>

      <Pannello
        align="end"
        className="w-[20rem]"
        titolo={attiva ? "È in cima all'elenco" : "Anticipa questa posa"}
        contesto={nomeCompleto(lead)}
      >
        <div className="space-y-2.5">
          {/*  LA FRASE CHE TIENE SEPARATE LE DUE DATE. Sta qui sopra al campo e
              non sotto, perché va letta PRIMA di scrivere: dopo, chi ha già
              digitato una data ha già deciso cosa significa. */}
          <NotaFinestra icona={Info}>
            La porta in cima all&apos;elenco. <strong>Non fissa niente in agenda</strong>: il giorno
            della posa — con l&apos;installatore e l&apos;ora — si sceglie da «Programma».
          </NotaFinestra>

          <label className="block space-y-1">
            <span className="block text-[12px] font-medium text-slate-900">
              Il giorno che vorrebbe il cliente
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                type="date"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
                className="w-full bg-transparent text-[12px] tabular-nums text-slate-900 outline-none"
              />
            </span>
            {/*  Facoltativo, e lo si dice: «fatemela il prima possibile» è la
                risposta più comune al telefono, e un campo che sembra
                obbligatorio si riempie con una data inventata. */}
            <span className="block text-[11px] leading-snug text-slate-500">
              Facoltativo: è quello che ha chiesto lui, non un appuntamento preso. Si vede sulla
              riga, accanto al cartellino.
            </span>
          </label>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/*  IL GESTO CHE DISFA STA NELLA STESSA FINESTRA DI QUELLO CHE FA,
                e non dietro un menu: è l'unica cosa che impedisce a questo
                elenco di diventare una seconda coda che cresce e non cala. */}
            {attiva ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-[12px] text-slate-600"
                onClick={() => {
                  setAperto(false);
                  void togli(lead);
                }}
              >
                Togli la priorità
              </Button>
            ) : (
              <span />
            )}
            <Button size="sm" className="h-8 text-[12px]" onClick={salva}>
              <ArrowUpToLine className="mr-1 h-3.5 w-3.5" />
              {attiva ? "Salva la data" : "Metti in cima"}
            </Button>
          </div>
        </div>
      </Pannello>
    </Popover>
  );
}
