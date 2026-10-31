/** ── IL PANNELLO «FILTRI» (30/10/2026, SEMPLIFICATO IL 31/10/2026) ─────────
 *  Titolare: «ora mi ci perdo dentro». Adesso: Stato · Finestra 24h · Consulente, e in fondo «Altri
 *  filtri» chiuso (Con scheda e gli altri stati del CRM). Ogni voce ha il nome, una riga corta e il
 *  numero. Quello che la riga di scorciatoie ha già non si ripete qui (`voceInRiga`, filtri.ts); un
 *  solo «Azzera»; una riga dice cosa è acceso.
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
  etichetteAccese,
  FILTRI_VUOTI,
  GRUPPI_FILTRI,
  voceDelloStato,
  voceInRiga,
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
          Scegli quali chat mostrare, un filtro alla volta: toccarne un altro sostituisce il primo.
          Il consulente si somma, tranne in «Ricontatti».
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
  const nomeConsulente = (id: string) => consulenti.find((x) => x.id === id)?.nome ?? "";

  //  ── COSA SI VEDE (31/10/2026, «mi ci perdo dentro») ──────────────────────────────────────
  //  Tre sezioni di uso quotidiano (Stato · Finestra 24h · Consulente) e il resto chiuso in «Altri
  //  filtri». Quello che la riga di scorciatoie ha già (Da rispondere, Da chiamare, Con stelle,
  //  Sconosciuti, Ricontatti, Clienti, e le pastiglie che arriveranno) qui NON si ripete: sta a un
  //  tocco, sopra, e si accende da lì. Cosa sta in riga lo dice `voceInRiga`, non un secondo elenco.
  const fuoriRiga = (id: string) =>
    (GRUPPI_FILTRI.find((g) => g.id === id)?.voci ?? []).filter((v) => !voceInRiga(v));
  const sezioni = ["coda", "fase", "finestra"]
    .map((id) => ({ g: GRUPPI_FILTRI.find((x) => x.id === id), voci: fuoriRiga(id) }))
    .filter((x) => x.g && x.voci.length > 0);
  const vociAltre = fuoriRiga("tipo");
  const statiAltri = altriStati.filter((s) => !voceInRiga(voceDelloStato(s.stato)));
  const nelleAltre = vociAltre.length + statiAltri.length;

  //  «Altri filtri» si apre da solo se dentro c'è un filtro acceso, e resta aperto finché il pannello è lì.
  const [altriAperti, setAltriAperti] = useState(false);
  const altroScelto =
    vociAltre.some((v) => eAcceso(filtri, v.campo, v.valore)) ||
    statiAltri.some((s) => filtri.fase === `stato:${s.stato}`);
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

  //  Cosa è acceso adesso, in una riga: chi ha scelto dalla riga di sopra lo ritrova qui.
  const acceso = etichetteAccese(filtri, nomeConsulente)
    .map((e) => e.etichetta)
    .join(" · ");

  return (
    <>
      {/*  Intestazione fissa. `pr-12` lascia posto alla ✕ del foglio sul telefono. L'unico «Azzera». */}
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
        <p className="t-nota -mb-1 text-muted-foreground">
          {!acceso
            ? "Un filtro alla volta."
            : contaAccesi({ ...filtri, consulente: "" }) > 0
              ? `Acceso: ${acceso}. Un altro filtro lo sostituisce.`
              : `Acceso: ${acceso}.`}
        </p>

        {sezioni.map(({ g, voci }) => (
          <Gruppo key={g!.id} id={g!.id} titolo={g!.titolo}>
            {voci.map(voce)}
          </Gruppo>
        ))}

        {consulenti.length > 0 && (
          <Gruppo id="consulente" titolo="Consulente">
            {filtri.ricontatti ? (
              //  In «Ricontatti» vale solo chi è dentro: il menu non si somma, e lo si dice.
              <p className="t-nota text-muted-foreground">In «Ricontatti» vedi solo i tuoi lead.</p>
            ) : (
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
              </label>
            )}
          </Gruppo>
        )}

        {nelleAltre > 0 && (
          <section className="flex flex-col gap-1.5">
            <button
              type="button"
              aria-expanded={apertoAltri}
              aria-controls="filtri-altri"
              onClick={() => setAltriAperti((v) => !v)}
              className={cn(
                "t-corpo flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-left font-medium hover:bg-muted",
                BORDO_TASTO,
                ALTEZZA_TASTO,
                FUOCO,
              )}
            >
              <span>
                Altri filtri{" "}
                <span className="tabular-nums text-muted-foreground">({nelleAltre})</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0 transition-transform", apertoAltri && "rotate-180")}
              />
            </button>
            {apertoAltri && (
              <div id="filtri-altri" className="flex flex-col gap-1.5">
                {vociAltre.map(voce)}
                {statiAltri.map((s) => voce({ ...voceDelloStato(s.stato), nome: s.nome }))}
              </div>
            )}
          </section>
        )}
      </div>

      {/*  Piede fisso: chiude il pannello, dicendo cosa vedrai. */}
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
