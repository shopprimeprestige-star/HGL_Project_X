/** ── I MENU DEI FILTRI DELLA LISTA «DA CHIAMARE» ───────────────────────────
 *
 *  Dal 28/10/2026 (commessa «Lead importati semplice») lo Stato non è più un
 *  menu né una fila di pulsanti qui: sono le otto pillole di `BarraPillole`
 *  (nomi e ordine in pillole-stato.ts). Restano i quattro menu — Annuncio,
 *  Risposta, Origine, Quando — che il pannello «Filtra» (PannelloFiltra) mette
 *  insieme, e «Tutta la lista» (SchedaTutti) usa ancora per conto suo.
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
import { NOME_VIA, type ViaOrigine } from "./origine";

/** Quanti filtri sono accesi: serve a «Azzera filtri» e al titolo dell'elenco. */
export function filtriAccesi(f: FiltriLista): number {
  return (
    (f.annuncio ? 1 : 0) +
    (f.risposte?.length ?? 0) +
    (f.stato && f.stato !== "tutti" ? 1 : 0) +
    (f.quando && f.quando !== "sempre" ? 1 : 0) +
    (f.origine ? 1 : 0)
  );
}

/** Lo stesso filtro, ripulito: niente chiavi vuote nell'indirizzo. */
export function pulito(f: FiltriLista): FiltriLista {
  const out: FiltriLista = {};
  if (f.annuncio) out.annuncio = f.annuncio;
  if (f.risposte?.length) out.risposte = f.risposte;
  if (f.stato && f.stato !== "tutti") out.stato = f.stato;
  if (f.quando && f.quando !== "sempre") out.quando = f.quando;
  if (f.origine) out.origine = f.origine;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL TASTO CHE APRE UN MENU
   ═════════════════════════════════════════════════════════════════════════ */

/*  ⚠️ `forwardRef`: Radix attacca il menu al tasto tramite il suo riferimento,
    e senza il menu si aprirebbe nell'angolo della pagina. */
const TastoMenu = forwardRef<
  HTMLButtonElement,
  { nome: string; valore: string; acceso: boolean; alto?: boolean } & ComponentProps<typeof Button>
>(({ nome, valore, acceso, alto, ...resto }, ref) => (
  <Button
    ref={ref}
    type="button"
    size="sm"
    variant="outline"
    className={cn(
      "h-9 max-w-[15rem] gap-1.5 text-[12px] font-normal sm:h-8",
      //  Dentro il pannello «Filtra» (compito T4 di 2026-10-28): largo quanto il
      //  pannello e alto almeno 44 px sul telefono.
      alto && "h-11 w-full max-w-none justify-start text-[13px] sm:h-9",
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
  titolo,
  onClick,
  children,
}: {
  scelta: boolean;
  n?: number;
  rientro?: boolean;
  /** La spiegazione al passaggio del dito, sul pulsante stesso: così arriva
   *  anche a chi usa la tastiera o un lettore di schermo. */
  titolo?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const vuota = n === 0 && !scelta;
  return (
    <button
      type="button"
      aria-pressed={scelta}
      title={titolo}
      disabled={vuota}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12.5px] outline-none transition-colors sm:min-h-0",
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
export function nomeAnnuncio(chiave: string, opzioni: OpzioniFiltri): string {
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
  alto,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  /** Dentro il pannello «Filtra»: tasto largo e alto 44 px sul telefono. */
  alto?: boolean;
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
          alto={alto}
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

export function etichettaRispostaScelta(chiave: string, opzioni: OpzioniFiltri): string {
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
  alto,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  /** Dentro il pannello «Filtra»: tasto largo e alto 44 px sul telefono. */
  alto?: boolean;
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
        <TastoMenu alto={alto} nome="Risposta" valore={valore} acceso={scelte.length > 0} />
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
   ORIGINE — dal foglio Google, da un file, a mano
   ═════════════════════════════════════════════════════════════════════════ */

const SPIEGA_ORIGINE: Record<ViaOrigine, string> = {
  google_sheets: "Arrivati dal foglio Google collegato alle inserzioni",
  file: "Caricati da un file",
  a_mano: "Scritti a mano nel CRM, senza foglio né file",
};

/*  Esportato per «Tutta la lista» (SchedaTutti): stessi menu, stesse regole.
    ⚠️ Una voce a zero resta, spenta (se sparisse la fila si accorcerebbe sotto il
    dito); una scelta si può sempre togliere con «Tutte». Il menu si apre con un
    clic e si chiude scegliendo: è una domanda sola, non un incrocio come Risposta. */
export function MenuOrigine({
  filtri,
  opzioni,
  onCambia,
  alto,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  /** Dentro il pannello «Filtra»: tasto largo e alto 44 px sul telefono. */
  alto?: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const totale = opzioni.origine.reduce((t, v) => t + v.n, 0);
  const scegli = (via?: ViaOrigine) => {
    onCambia(pulito({ ...filtri, origine: via }));
    setAperto(false);
  };
  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <TastoMenu
          alto={alto}
          nome="Origine"
          valore={filtri.origine ? NOME_VIA[filtri.origine] : "tutte"}
          acceso={!!filtri.origine}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <VoceScelta scelta={!filtri.origine} n={totale} onClick={() => scegli(undefined)}>
          Tutte le origini
        </VoceScelta>
        {opzioni.origine.map((v) => (
          <VoceScelta
            key={v.valore}
            scelta={filtri.origine === v.valore}
            n={v.n}
            titolo={SPIEGA_ORIGINE[v.valore]}
            onClick={() => scegli(v.valore)}
          >
            {NOME_VIA[v.valore]}
          </VoceScelta>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATO — perché è in lista, e da quando ha quello stato
   ═════════════════════════════════════════════════════════════════════════ */

/** «Quando ho messo lo stato»: le segreterie di ieri, i non risponde di oggi.
 *  Resta un menu: si usa meno, e accanto ai pulsanti dello stato si legge come
 *  la loro seconda metà. */
export function MenuQuando({
  filtri,
  opzioni,
  onCambia,
  alto,
}: {
  filtri: FiltriLista;
  opzioni: OpzioniFiltri;
  onCambia: (f: FiltriLista) => void;
  /** Dentro il pannello «Filtra»: tasto largo e alto 44 px sul telefono. */
  alto?: boolean;
}) {
  const quando = filtri.quando ?? "sempre";
  const nQuando = (v: FettaTempo) => opzioni.quando.find((x) => x.valore === v)?.n ?? 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TastoMenu
          alto={alto}
          nome="Quando"
          valore={NOME_FETTA_TEMPO[quando].toLowerCase()}
          acceso={quando !== "sempre"}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
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
              className="min-h-11 text-[12.5px] sm:min-h-0"
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

export function Etichetta({ testo, onToglie }: { testo: string; onToglie: () => void }) {
  return (
    <button
      type="button"
      onClick={onToglie}
      title="Togli questo filtro"
      className="inline-flex min-h-11 max-w-[18rem] items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-3 pr-2.5 md:min-h-0 md:pl-2.5 md:pr-1.5 text-[11.5px] font-medium text-foreground transition hover:border-foreground/30 hover:bg-muted"
    >
      <span className="truncate">{testo}</span>
      <X className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Togli" />
    </button>
  );
}
