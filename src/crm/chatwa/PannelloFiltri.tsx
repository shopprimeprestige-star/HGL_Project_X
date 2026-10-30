/** ── IL PANNELLO «FILTRI» (30/10/2026) ──────────────────────────────────────
 *  Sei gruppi, ogni voce con il nome, una riga che spiega cosa significa e il numero.
 *  Si applica subito (nessun «Applica»): «Mostra N chat» serve solo a chiudere.
 *  · Telefono (fino a 767 px): foglio dal basso, alto al massimo l'85% dello schermo, con
 *    intestazione e piede fissi e voci da 44 px.
 *  · Tablet e computer: riquadro ancorato al tasto «Filtri», 360 px (380 dal computer), alto al
 *    massimo il 70% dello schermo, con scorrimento interno.
 *  Le regole (gruppi, nomi, numeri) sono in filtri.ts; qui si disegna soltanto.
 *  ⚠️ Foglio e riquadro vivono in un portale FUORI dal guscio del CRM: `crm-theme bg-white
 *   text-foreground` sul contenuto, come fanno gli altri fogli della chat, o i token sono quelli
 *   della landing (fondo scuro). */
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  commuta,
  contaAccesi,
  eAcceso,
  FILTRI_VUOTI,
  GRUPPI_FILTRI,
  voceDelloStato,
  type CampoFiltro,
  type FiltriChat,
  type VoceFiltro,
} from "./filtri";
import type { LeadStatus } from "@/crm/types";

/** Il fuoco da tastiera: contorno pieno del colore primario (l'anello `ring` è al 40%, sotto i 3:1). */
export const FUOCO =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Il bordo di un controllo SPENTO: `muted-foreground` al 70% su bianco dà 3,3:1 (il bordo di
 *  `border-border` ne dà 1,35, sotto il minimo di 3:1 per riconoscere un tasto). */
export const BORDO_TASTO = "border-muted-foreground/70";

/** L'altezza di un bersaglio: 44 px col dito (telefono e tablet), 32 dal computer col mouse. */
export const ALTEZZA_TASTO = "min-h-11 lg:pointer-fine:min-h-8";

/** Il contatore: un solo badge per tutto. Neutro, ambra solo per l'urgenza; dentro un pulsante
 *  acceso diventa bianco semitrasparente. Zero: si scrive «0» grigio. */
export function Contatore({
  n,
  acceso = false,
  urgente = false,
}: {
  n: number;
  acceso?: boolean;
  urgente?: boolean;
}) {
  return (
    <span
      className={cn(
        "t-etichetta inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 font-semibold tabular-nums",
        acceso
          ? "bg-primary-foreground text-primary"
          : urgente && n > 0
            ? "bg-amber-100 text-amber-900"
            : "bg-muted text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

/** Telefono = meno di 768 px (stessa soglia di `md:` in tutta la pagina). */
function useSchermoPiccolo(): boolean {
  return useSyncExternalStore(
    (avvisa) => {
      const m = window.matchMedia("(max-width: 767px)");
      m.addEventListener("change", avvisa);
      return () => m.removeEventListener("change", avvisa);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

export interface PropsPannelloFiltri {
  filtri: FiltriChat;
  onCambia: (f: FiltriChat) => void;
  /** Quante chat vedresti accendendo questa voce, con gli altri gruppi come sono. */
  conta: (campo: CampoFiltro, valore: string | true) => number;
  /** «Altri stati»: gli stati con almeno una chat, più quello scelto. */
  altriStati: { stato: LeadStatus; nome: string; n: number }[];
  /** Consulenti con almeno una chat, più quello scelto. */
  consulenti: { id: string; nome: string; n: number }[];
  /** Quante chat mostra l'elenco ora (ricerca compresa): il numero di «Mostra N chat». */
  mostra: number;
  aperto: boolean;
  onApri: (aperto: boolean) => void;
}

/** Il tasto «Filtri» col pannello: foglio sul telefono, riquadro ancorato altrove. */
export function PannelloFiltri(p: PropsPannelloFiltri) {
  const piccolo = useSchermoPiccolo();
  const accesi = contaAccesi(p.filtri);
  //  Con un consulente scelto il tasto lo dice («Filtri · Giulia»): «Tutte» non deve sembrare tutte.
  const consulente = p.filtri.consulente
    ? (p.consulenti.find((x) => x.id === p.filtri.consulente)?.nome ?? "")
    : "";
  const tasto = (
    <button
      type="button"
      aria-label={
        accesi > 0
          ? `Filtri, ${accesi} accesi${consulente ? `, consulente ${consulente}` : ""}`
          : "Filtri"
      }
      className={cn(
        "t-corpo inline-flex w-auto shrink-0 items-center gap-1.5 rounded-md border px-3 font-medium transition-colors",
        "h-11 lg:pointer-fine:h-8",
        accesi > 0
          ? "border-primary bg-primary text-primary-foreground"
          : `${BORDO_TASTO} bg-background text-foreground hover:bg-muted`,
        FUOCO,
      )}
    >
      <SlidersHorizontal aria-hidden="true" className="h-4 w-4 shrink-0" />
      Filtri
      {consulente && (
        <span className="max-w-[7rem] truncate">
          {"· "}
          {consulente}
        </span>
      )}
      {accesi > 0 && <Contatore n={accesi} acceso />}
    </button>
  );
  const contenuto = <ContenutoPannello {...p} />;

  return piccolo ? (
    <Sheet open={p.aperto} onOpenChange={p.onApri}>
      <SheetTrigger asChild>{tasto}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="crm-theme flex max-h-[85dvh] flex-col gap-0 rounded-t-xl bg-white p-0 text-foreground"
      >
        {/*  Il titolo e la descrizione servono a chi usa lo screen reader; la ✕ del foglio sta
            a destra dell'intestazione (che le lascia lo spazio). */}
        <SheetDescription className="sr-only">
          Scegli quali chat mostrare. Gruppi diversi si sommano; in uno stesso gruppo si sceglie una
          voce sola.
        </SheetDescription>
        {contenuto}
      </SheetContent>
    </Sheet>
  ) : (
    <Popover modal open={p.aperto} onOpenChange={p.onApri}>
      <PopoverTrigger asChild>{tasto}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="crm-theme flex w-[360px] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden bg-white p-0 text-foreground max-h-[min(70dvh,var(--radix-popover-content-available-height))] lg:w-[380px]"
        aria-label="Filtri"
      >
        {contenuto}
      </PopoverContent>
    </Popover>
  );
}

/** Una voce: tutta la riga è il tasto (nome, spiegazione, numero). Acceso = pieno primario E
 *  `aria-pressed`. A zero resta visibile ma grigia (e cliccabile: un filtro acceso si deve poter
 *  togliere). */
function Voce({
  voce,
  acceso,
  n,
  onTocca,
}: {
  voce: VoceFiltro;
  acceso: boolean;
  n: number;
  onTocca: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={acceso}
      onClick={onTocca}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
        ALTEZZA_TASTO,
        acceso
          ? "border-primary bg-primary text-primary-foreground"
          : `${BORDO_TASTO} bg-background hover:bg-muted`,
        FUOCO,
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "t-corpo flex items-center gap-2 font-medium",
            !acceso && n === 0 && "text-muted-foreground",
          )}
        >
          {voce.segno && (
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                voce.segno === "rosso" ? "bg-red-600" : "bg-emerald-700",
                acceso && "ring-2 ring-primary-foreground",
              )}
            />
          )}
          {voce.nome}
        </span>
        {voce.spiega && (
          <span
            className={cn(
              "t-nota mt-0.5 block",
              acceso ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {voce.spiega}
          </span>
        )}
      </span>
      <Contatore
        n={n}
        acceso={acceso}
        urgente={voce.campo === "coda" && voce.valore === "da-rispondere"}
      />
    </button>
  );
}

function Gruppo({ id, titolo, children }: { id: string; titolo: string; children: ReactNode }) {
  return (
    <section role="group" aria-labelledby={`filtri-${id}`} className="flex flex-col gap-1.5">
      <h3
        id={`filtri-${id}`}
        className="t-etichetta font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {titolo}
      </h3>
      {children}
    </section>
  );
}

function ContenutoPannello({
  filtri,
  onCambia,
  conta,
  altriStati,
  consulenti,
  mostra,
  onApri,
}: PropsPannelloFiltri) {
  const accesi = contaAccesi(filtri);
  //  «Altri stati» si apre da solo se uno è scelto, e resta aperto finché il pannello è lì.
  const [altriAperti, setAltriAperti] = useState(false);
  const altroScelto = filtri.fase?.startsWith("stato:") === true;
  const apertoAltri = altriAperti || altroScelto;

  const voce = (v: VoceFiltro) => (
    <Voce
      key={`${v.campo}:${String(v.valore)}`}
      voce={v}
      acceso={eAcceso(filtri, v.campo, v.valore)}
      n={conta(v.campo, v.valore)}
      onTocca={() => onCambia(commuta(filtri, v.campo, v.valore))}
    />
  );

  return (
    <>
      {/*  Intestazione fissa. `pr-12` lascia posto alla ✕ del foglio sul telefono. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border py-2 pl-4 pr-12 lg:pr-4">
        <SheetTitleOrTesto />
        <button
          type="button"
          disabled={accesi === 0}
          onClick={() => onCambia(FILTRI_VUOTI)}
          className={cn(
            "t-corpo -mr-2 inline-flex items-center rounded-md px-2 font-medium text-primary hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-60",
            ALTEZZA_TASTO,
            FUOCO,
          )}
        >
          Azzera
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
        {GRUPPI_FILTRI.map((g) => (
          <Gruppo key={g.id} id={g.id} titolo={g.titolo}>
            {g.voci.map(voce)}
            {g.id === "fase" && (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  aria-expanded={apertoAltri}
                  aria-controls="filtri-altri-stati"
                  onClick={() => setAltriAperti((v) => !v)}
                  className={cn(
                    "t-corpo flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-left font-medium hover:bg-muted",
                    BORDO_TASTO,
                    ALTEZZA_TASTO,
                    FUOCO,
                  )}
                >
                  <span>
                    Altri stati{" "}
                    <span className="tabular-nums text-muted-foreground">
                      ({altriStati.length})
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      apertoAltri && "rotate-180",
                    )}
                  />
                </button>
                {apertoAltri && (
                  <div id="filtri-altri-stati" className="flex flex-col gap-1.5">
                    {altriStati.length === 0 && (
                      <p className="t-nota text-muted-foreground">Nessun altro stato ha chat.</p>
                    )}
                    {altriStati.map((s) => voce({ ...voceDelloStato(s.stato), nome: s.nome }))}
                  </div>
                )}
              </div>
            )}
          </Gruppo>
        ))}

        {consulenti.length > 0 && (
          <Gruppo id="consulente" titolo="Consulente">
            <label className="flex flex-col gap-1">
              <span className="sr-only">Consulente</span>
              {/*  Nativa: sul telefono apre la rotella di sistema, la più comoda col pollice.
                  16 px dove si tocca, altrimenti iOS ingrandisce la pagina. */}
              <select
                value={filtri.consulente}
                onChange={(e) => onCambia({ ...filtri, consulente: e.target.value })}
                className={cn(
                  "w-full rounded-md border bg-background px-2 text-base text-foreground lg:pointer-fine:text-[13px]",
                  "h-11 lg:pointer-fine:h-8",
                  filtri.consulente ? "border-primary" : BORDO_TASTO,
                  FUOCO,
                )}
              >
                <option value="">Tutti i consulenti</option>
                {consulenti.map((x) => (
                  <option key={x.id} value={x.id}>
                    {`${x.nome} (${x.n})`}
                  </option>
                ))}
              </select>
              <span className="t-nota text-muted-foreground">
                Mostra solo i clienti assegnati a quel consulente.
              </span>
            </label>
          </Gruppo>
        )}
      </div>

      {/*  Piede fisso. */}
      <div className="shrink-0 border-t border-border bg-white p-3">
        <button
          type="button"
          onClick={() => onApri(false)}
          className={cn(
            "t-corpo w-full rounded-md bg-primary px-3 font-semibold text-primary-foreground hover:brightness-95",
            "h-11 lg:pointer-fine:h-8",
            FUOCO,
          )}
        >
          {mostra === 1 ? "Mostra 1 chat" : `Mostra ${mostra} chat`}
        </button>
      </div>
    </>
  );
}

/** Il titolo del pannello. Nel foglio è il `SheetTitle` (obbligatorio per chi usa lo screen
 *  reader); nel riquadro un semplice titolo. */
function SheetTitleOrTesto() {
  const piccolo = useSchermoPiccolo();
  return piccolo ? (
    <SheetTitle className="t-riga font-semibold">Filtri</SheetTitle>
  ) : (
    <h2 className="t-riga font-semibold text-foreground">Filtri</h2>
  );
}
