/** ── I TRE FILTRI DELLA LISTA «DA CHIAMARE» ────────────────────────────────
 *
 *  Prima: sei pastiglie di stato, quattro di tempo, e filtri diversi da una
 *  scheda all'altra. Adesso: TRE menu (Annuncio, Risposta, Stato), sempre gli
 *  stessi, e sotto i filtri accesi come etichette che si spengono con un clic.
 *
 *  Le regole (quali righe passano, che numero sta accanto a ogni voce) sono di
 *  `filtri-lista.ts`, provate. Qui si disegna soltanto.
 *
 *  ⚠️ I MENU SONO DI RADIX (`Popover`, `DropdownMenu` di components/ui), e non
 *   per gusto. La pagina ha le scorciatoie da tastiera: «1» segna «Non risponde»
 *   al lead che hai davanti. `useScorciatoie` (crm/ui) tace quando nella pagina
 *   c'è un contenuto di Radix aperto (`data-radix-popper-content-wrapper`): un
 *   menu fatto a mano con un <div> non ha quell'attributo, e premere «1» per
 *   scegliere una voce avrebbe dato un esito a una persona vera. La prova legge
 *   questo file e pretende i componenti di Radix.
 *  ⚠️ UNA VOCE A ZERO RESTA, SPENTA: se sparisse, la fila si accorcerebbe sotto
 *   il dito. E una voce ACCESA a zero si vede sempre, per poterla spegnere.
 *  ⚠️ I NUMERI SONO QUELLI CHE ESCONO PREMENDO (vedi filtri-lista): ogni
 *   dimensione si conta con gli altri filtri già accesi, mai con il proprio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NOME_FETTA_TEMPO, SPIEGA_FETTA_TEMPO, type FettaTempo } from "@/crm/quando-stato";
import type { FiltriLista, OpzioniFiltri, StatoFiltro } from "./filtri-lista";
import { voceStatoAttiva } from "./reparti";

/** I nomi delle cinque voci di Stato, come nella spec. */
export const NOME_STATO_FILTRO: Record<StatoFiltro, string> = {
  tutti: "Tutti",
  mai: "Mai chiamati",
  ritentare: "Da ritentare",
  promesse: "Promesse",
  ritorno: "Di ritorno",
};

const SPIEGA_STATO_FILTRO: Record<StatoFiltro, string> = {
  tutti: "Tutta la lista",
  mai: "Da contattare: nessuno li ha ancora chiamati",
  ritentare: "Non risponde e segreteria: ritenti rapidi",
  promesse: "Richiamo concordato e «mi richiama lui», quando il giorno è arrivato",
  ritorno: "Contatti di ritorno: erano già in archivio e sono ricomparsi in una lista",
};

const STATI_DA_MOSTRARE: StatoFiltro[] = ["tutti", "mai", "ritentare", "promesse", "ritorno"];

/** Quanti filtri sono accesi: serve a «Azzera filtri» e al titolo dell'elenco. */
export function filtriAccesi(f: FiltriLista): number {
  return (
    (f.annuncio ? 1 : 0) +
    (f.risposte?.length ?? 0) +
    (f.stato && f.stato !== "tutti" ? 1 : 0) +
    (f.quando && f.quando !== "sempre" ? 1 : 0)
  );
}

/** Lo stesso filtro, ripulito: niente chiavi vuote nell'indirizzo. */
function pulito(f: FiltriLista): FiltriLista {
  const out: FiltriLista = {};
  if (f.annuncio) out.annuncio = f.annuncio;
  if (f.risposte?.length) out.risposte = f.risposte;
  if (f.stato && f.stato !== "tutti") out.stato = f.stato;
  if (f.quando && f.quando !== "sempre") out.quando = f.quando;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL TASTO CHE APRE UN MENU
   ═════════════════════════════════════════════════════════════════════════ */

/*  ⚠️ `forwardRef`: Radix attacca il menu al tasto tramite il suo riferimento,
    e senza il menu si aprirebbe nell'angolo della pagina. */
const TastoMenu = forwardRef<
  HTMLButtonElement,
  { nome: string; valore: string; acceso: boolean } & ComponentProps<typeof Button>
>(({ nome, valore, acceso, ...resto }, ref) => (
  <Button
    ref={ref}
    type="button"
    size="sm"
    variant="outline"
    className={cn(
      "h-9 max-w-[15rem] gap-1.5 text-[12px] font-normal sm:h-8",
      acceso && "border-foreground/40 bg-foreground/[0.05]",
    )}
    {...resto}
  >
    <span className="text-muted-foreground">{nome}:</span>
    <span className={cn("truncate", acceso ? "font-semibold" : "font-medium")}>{valore}</span>
    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Button>
));
TastoMenu.displayName = "TastoMenu";

/** Una riga di un menu a scelta: il segno di spunta, il nome, il numero.
 *  Spenta (a zero e non scelta) si legge ma non si preme. */
function VoceScelta({
  scelta,
  n,
  rientro,
  onClick,
  children,
}: {
  scelta: boolean;
  n?: number;
  rientro?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const vuota = n === 0 && !scelta;
  return (
    <button
      type="button"
      aria-pressed={scelta}
      disabled={vuota}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12.5px] outline-none transition-colors",
        "hover:bg-accent focus-visible:bg-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent",
        rientro && "pl-6",
        scelta && "font-semibold",
      )}
    >
      <Check
        className={cn("h-3.5 w-3.5 shrink-0", scelta ? "opacity-100" : "opacity-0")}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {n !== undefined && <span className="shrink-0 tabular-nums text-muted-foreground">{n}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANNUNCIO — i gruppi di inserzioni, e sotto i loro annunci
   ═════════════════════════════════════════════════════════════════════════ */

/** Come si chiama, a parole, la voce scelta. Una chiave che nessuno ha più
 *  (annuncio spento da Meta) esiste comunque in `opzioni`, a zero. */
function nomeAnnuncio(chiave: string, opzioni: OpzioniFiltri): string {
  for (const g of opzioni.annuncio) {
    if (g.chiave === chiave) return g.gruppo;
    const a = g.annunci.find((x) => x.chiave === chiave);
    if (a) return a.annuncio;
  }
  return chiave;
}

/*  Esportato per «Tutta la lista» (SchedaTutti): stessi menu, stesse regole. */
export function MenuAnnuncio({
  filtri,
  opzioni,
  onCambia,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const totale = opzioni.annuncio.reduce((t, g) => t + g.n, 0);
  const scegli = (chiave?: string) => {
    onCambia(pulito({ ...filtri, annuncio: chiave }));
    setAperto(false);
  };
  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <TastoMenu
          nome="Annuncio"
          valore={filtri.annuncio ? nomeAnnuncio(filtri.annuncio, opzioni) : "tutti"}
          acceso={!!filtri.annuncio}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[60vh] w-80 overflow-y-auto p-1">
        {opzioni.annuncio.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] text-muted-foreground">
            Nessun annuncio nelle liste caricate.
          </p>
        ) : (
          <>
            <VoceScelta scelta={!filtri.annuncio} n={totale} onClick={() => scegli(undefined)}>
              Tutti gli annunci
            </VoceScelta>
            {opzioni.annuncio.map((g) => (
              <div key={g.chiave} className="mt-1 border-t border-border/60 pt-1">
                <VoceScelta
                  scelta={filtri.annuncio === g.chiave}
                  n={g.n}
                  onClick={() => scegli(g.chiave)}
                >
                  {g.chiave === "senza" ? g.gruppo : `Gruppo ${g.gruppo}`}
                </VoceScelta>
                {g.annunci.map((a) => (
                  <VoceScelta
                    key={a.chiave}
                    rientro
                    scelta={filtri.annuncio === a.chiave}
                    n={a.n}
                    onClick={() => scegli(a.chiave)}
                  >
                    {a.annuncio}
                  </VoceScelta>
                ))}
              </div>
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RISPOSTA — le domande del modulo, una scelta per domanda
   ═════════════════════════════════════════════════════════════════════════ */

const campoDi = (chiave: string) => chiave.slice(0, chiave.indexOf("|"));

function etichettaRispostaScelta(chiave: string, opzioni: OpzioniFiltri): string {
  for (const r of opzioni.risposte) {
    const v = r.voci.find((x) => x.chiave === chiave);
    if (v) return `${r.titolo}: ${v.etichetta}`;
  }
  return chiave;
}

export function MenuRisposta({
  filtri,
  opzioni,
  onCambia,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
}) {
  const scelte = filtri.risposte ?? [];
  /*  Premendo una voce si accende; premendola di nuovo si spegne; premendone
      un'altra della STESSA domanda la sostituisce (una risposta per domanda:
      lo stesso lead non può averne due). Il menu resta aperto, perché si
      possono incrociare più domande. */
  const alterna = (chiave: string) => {
    const senzaQuesta = scelte.filter((k) => campoDi(k) !== campoDi(chiave));
    const eraAccesa = scelte.includes(chiave);
    onCambia(pulito({ ...filtri, risposte: eraAccesa ? senzaQuesta : [...senzaQuesta, chiave] }));
  };
  const valore =
    scelte.length === 0
      ? "tutte"
      : scelte.length === 1
        ? etichettaRispostaScelta(scelte[0], opzioni).split(": ")[1] || "1 scelta"
        : `${scelte.length} scelte`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <TastoMenu nome="Risposta" valore={valore} acceso={scelte.length > 0} />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[60vh] w-80 overflow-y-auto p-1">
        {opzioni.risposte.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] text-muted-foreground">
            Nessuna risposta del modulo nelle liste caricate.
          </p>
        ) : (
          opzioni.risposte.map((r, i) => (
            <div key={r.campo} className={cn(i > 0 && "mt-1 border-t border-border/60 pt-1")}>
              <div className="px-2 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {r.titolo}
              </div>
              {r.voci.map((v) => (
                <VoceScelta
                  key={v.chiave}
                  scelta={scelte.includes(v.chiave)}
                  n={v.n}
                  onClick={() => alterna(v.chiave)}
                >
                  {v.etichetta}
                </VoceScelta>
              ))}
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATO — perché è in lista, e da quando ha quello stato
   ═════════════════════════════════════════════════════════════════════════ */

function MenuStato({
  filtri,
  opzioni,
  onCambia,
  ritorni,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  ritorni: number;
}) {
  const stato = filtri.stato ?? "tutti";
  const quando = filtri.quando ?? "sempre";
  const nStato = (v: StatoFiltro) => opzioni.stato.find((x) => x.valore === v)?.n ?? 0;
  //  «Di ritorno» porta il numero della vecchia stanza (ritorni + «si fanno vivi
  //  loro»), che comprende anche chi è fuori dalla lista.
  const nVoce = (v: StatoFiltro) => (v === "ritorno" ? Math.max(nStato(v), ritorni) : nStato(v));
  const nQuando = (v: FettaTempo) => opzioni.quando.find((x) => x.valore === v)?.n ?? 0;
  const valore =
    quando !== "sempre"
      ? `${NOME_STATO_FILTRO[stato].toLowerCase()} · ${NOME_FETTA_TEMPO[quando].toLowerCase()}`
      : NOME_STATO_FILTRO[stato].toLowerCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TastoMenu nome="Stato" valore={valore} acceso={stato !== "tutti" || quando !== "sempre"} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup
          value={stato}
          onValueChange={(v) => onCambia(pulito({ ...filtri, stato: v as StatoFiltro }))}
        >
          {STATI_DA_MOSTRARE.map((v) => (
            <DropdownMenuRadioItem
              key={v}
              value={v}
              title={SPIEGA_STATO_FILTRO[v]}
              disabled={!voceStatoAttiva(v, nStato(v), stato, ritorni)}
              className="text-[12.5px]"
            >
              <span className="flex-1">{NOME_STATO_FILTRO[v]}</span>
              <span className="ml-3 tabular-nums text-muted-foreground">{nVoce(v)}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Quando ho messo lo stato
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={quando}
          onValueChange={(v) => onCambia(pulito({ ...filtri, quando: v as FettaTempo }))}
        >
          {(Object.keys(NOME_FETTA_TEMPO) as FettaTempo[]).map((v) => (
            <DropdownMenuRadioItem
              key={v}
              value={v}
              title={SPIEGA_FETTA_TEMPO[v]}
              disabled={nQuando(v) === 0 && quando !== v}
              className="text-[12.5px]"
            >
              <span className="flex-1">{NOME_FETTA_TEMPO[v]}</span>
              <span className="ml-3 tabular-nums text-muted-foreground">{nQuando(v)}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA BARRA: I TRE MENU, LE ETICHETTE ACCESE, «AZZERA FILTRI»
   ═════════════════════════════════════════════════════════════════════════ */

function Etichetta({ testo, onToglie }: { testo: string; onToglie: () => void }) {
  return (
    <button
      type="button"
      onClick={onToglie}
      title="Togli questo filtro"
      className="inline-flex max-w-[18rem] items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-1.5 text-[11.5px] font-medium text-foreground transition hover:border-foreground/30 hover:bg-muted"
    >
      <span className="truncate">{testo}</span>
      <X className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Togli" />
    </button>
  );
}

export function BarraFiltri({
  filtri,
  opzioni,
  onCambia,
  disabilitato,
  ritorni = 0,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  /** Quanti contatti di ritorno e «si fanno vivi loro» ci sono in tutto, anche
   *  fuori dalla lista: finché sono più di zero la voce Stato «Di ritorno» resta
   *  accesa (vedi `voceStatoAttiva`). */
  ritorni?: number;
  /** Mentre una scrittura di gruppo lavora, cambiare la fetta di elenco farebbe
   *  sparire la barra con il contatore: i menu si spengono. */
  disabilitato?: boolean;
}) {
  const accesi = filtriAccesi(filtri);
  return (
    <div className="space-y-2" aria-disabled={disabilitato || undefined}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          disabilitato && "pointer-events-none opacity-50",
        )}
      >
        <MenuAnnuncio filtri={filtri} opzioni={opzioni} onCambia={onCambia} />
        <MenuRisposta filtri={filtri} opzioni={opzioni} onCambia={onCambia} />
        <MenuStato filtri={filtri} opzioni={opzioni} onCambia={onCambia} ritorni={ritorni} />
        {accesi > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 text-[12px] text-muted-foreground hover:text-foreground sm:h-8"
            onClick={() => onCambia({})}
          >
            Azzera filtri
          </Button>
        )}
      </div>
      {accesi > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
            Accesi
          </span>
          {filtri.annuncio && (
            <Etichetta
              testo={nomeAnnuncio(filtri.annuncio, opzioni)}
              onToglie={() => onCambia(pulito({ ...filtri, annuncio: undefined }))}
            />
          )}
          {(filtri.risposte ?? []).map((k) => (
            <Etichetta
              key={k}
              testo={etichettaRispostaScelta(k, opzioni)}
              onToglie={() =>
                onCambia(
                  pulito({ ...filtri, risposte: (filtri.risposte ?? []).filter((x) => x !== k) }),
                )
              }
            />
          ))}
          {filtri.stato && filtri.stato !== "tutti" && (
            <Etichetta
              testo={`Stato: ${NOME_STATO_FILTRO[filtri.stato]}`}
              onToglie={() => onCambia(pulito({ ...filtri, stato: undefined }))}
            />
          )}
          {filtri.quando && filtri.quando !== "sempre" && (
            <Etichetta
              testo={`Stato messo: ${NOME_FETTA_TEMPO[filtri.quando].toLowerCase()}`}
              onToglie={() => onCambia(pulito({ ...filtri, quando: undefined }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
