/** ── I PEZZI DELLA SCHEDA DEI SOLDI ────────────────────────────────────────
 *
 *  Disegno e basta: qui dentro non si calcola niente e non si legge nessun
 *  archivio. I numeri arrivano già fatti da kpi-calcoli e kpi-netto, che sono
 *  la trascrizione fedele del CRM aziendale e non si toccano.
 *
 *  ── ⚠️ PERCHÉ QUESTI PEZZI ESISTONO ───────────────────────────────────────
 *  La scheda «Ritorno» era una fila di riquadri tutti uguali: nove numeri in
 *  griglia, un elenco di voci, un altro elenco, un registro. Ogni blocco aveva
 *  lo stesso peso visivo di quello sopra, quindi per capire quale contasse
 *  bisognava leggerli tutti — e chi apre quella pagina per la prima volta non
 *  sa da dove cominciare.
 *  Qui si costruisce una gerarchia vera:
 *    · UNA fascia con la risposta (entrato, uscito, resta);
 *    · le uscite con una BARRA proporzionale, perché «quale mi mangia di più»
 *      è una domanda che si risponde con la lunghezza, non leggendo sei cifre;
 *    · l'imbuto come un imbuto, con i passaggi che si stringono davvero.
 *
 *  ── ⚠️ I COLORI HANNO UN SIGNIFICATO SOLO ─────────────────────────────────
 *  Verde = entrato. Rosso = uscito. Grigio = un numero di riferimento, né
 *  l'uno né l'altro. Ambra = qualcosa da guardare. È lo stesso vocabolario
 *  delle fasce dei soldi sulle pose (crm/InstallationScheduleDialog): due
 *  linguaggi di colore nello stesso CRM costringono a impararli tutti e due.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { eur } from "@/crm/ui";

/* ═══════════════════════════════════════════════════════════════════════════
   1. LA FASCIA DELLA RISPOSTA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ TRE NUMERI E UNA FRECCIA, NON TRE RIQUADRI ────────────────────────
 *  Entrato → Uscito → Resta è una SOTTRAZIONE, e va letta come tale: tre
 *  riquadri affiancati si leggono come tre fatti indipendenti, e chi non ha
 *  dimestichezza coi conti non sa che il terzo viene dai primi due. Le frecce
 *  fra le celle lo dicono senza scriverlo.
 *
 *  ⚠️ IL RISULTATO È PIÙ GRANDE DEGLI ALTRI DUE, sempre, anche quando è zero:
 *   è la domanda per cui si apre questa pagina. E quando è negativo diventa
 *   rosso e lo dice a parole — «in perdita» — perché un numero col meno
 *   davanti, in mezzo ad altri numeri, si legge distrattamente come tutti gli
 *   altri. */
export function FasciaRisultato({
  entrato,
  uscito,
  resta,
  margine,
  nota,
}: {
  entrato: number;
  uscito: number;
  resta: number;
  /** già formattata, o null quando non c'è una base per calcolarla */
  margine: string | null;
  nota: ReactNode;
}) {
  const perdita = resta < 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-card">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1.3fr]">
        <Fetta etichetta="È entrato" valore={eur(entrato)} colore="text-emerald-700" />
        <Segno>−</Segno>
        <Fetta etichetta="È uscito" valore={eur(uscito)} colore="text-rose-700" />
        <Segno>=</Segno>
        <div
          className={cn(
            "flex flex-col justify-center px-4 py-3",
            perdita ? "bg-rose-50" : "bg-emerald-50",
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {perdita ? "Sei in perdita di" : "Ti resta"}
          </span>
          <span
            className={cn(
              "text-[30px] font-bold leading-none tabular-nums sm:text-[34px]",
              perdita ? "text-rose-700" : "text-emerald-700",
            )}
          >
            {eur(resta)}
          </span>
          {margine && (
            <span className="mt-1 text-[11.5px] text-slate-600">
              su ogni 100 € incassati te ne restano{" "}
              <strong className="font-semibold tabular-nums">{margine}</strong>
            </span>
          )}
        </div>
      </div>
      <p className="border-t border-slate-200 bg-slate-50/60 px-4 py-2 text-[11.5px] leading-relaxed text-slate-600">
        {nota}
      </p>
    </section>
  );
}

function Fetta({
  etichetta,
  valore,
  colore,
}: {
  etichetta: string;
  valore: string;
  colore: string;
}) {
  return (
    <div className="flex flex-col justify-center px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {etichetta}
      </span>
      <span className={cn("text-[21px] font-bold leading-tight tabular-nums", colore)}>
        {valore}
      </span>
    </div>
  );
}

/** Il segno fra due celle. Su schermo stretto sparisce: in colonna una «−»
 *  fra due riquadri impilati non vuol più dire sottrazione, vuol dire un
 *  trattino in mezzo alla pagina. */
function Segno({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="hidden select-none items-center justify-center px-1 text-[18px] font-light text-slate-300 sm:flex"
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. UNA VOCE DEL CONTO, CON LA SUA BARRA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ LA BARRA È IL PUNTO ───────────────────────────────────────────────
 *  «Quale di queste uscite mi mangia di più» è la domanda vera, e su sei cifre
 *  incolonnate si risponde solo confrontandole a mente, una coppia per volta.
 *  Con una barra proporzionale si risponde guardando.
 *  ⚠️ La barra è in scala sulla voce PIÙ GRANDE, non sul totale: sul totale le
 *   voci piccole diventerebbero tutte un filo di due pixel, indistinguibili
 *   fra loro — e la differenza fra 200 € e 2.000 € è esattamente quello che si
 *   sta cercando di vedere. */
export function VoceConto({
  etichetta,
  nota,
  importo,
  quota,
  tipo,
}: {
  etichetta: string;
  nota?: string;
  importo: number;
  /** da 0 a 1: quanto è lunga la barra rispetto alla voce più grande */
  quota: number;
  tipo: "entrata" | "uscita" | "risultato";
}) {
  const colore =
    tipo === "entrata"
      ? "text-emerald-700"
      : tipo === "uscita"
        ? "text-rose-700"
        : importo < 0
          ? "text-rose-700"
          : "text-slate-900";
  const barra =
    tipo === "entrata"
      ? "bg-emerald-500/70"
      : tipo === "uscita"
        ? "bg-rose-400/70"
        : "bg-slate-400";
  return (
    <li
      className={cn(
        "px-3 py-2",
        tipo === "risultato" && "border-t-2 border-slate-200 bg-slate-50/70",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate text-[13px]",
              tipo === "risultato" ? "font-bold text-slate-900" : "text-slate-700",
            )}
          >
            {/*  Il segno davanti dice il verso senza bisogno di leggere il
                colore: chi non distingue bene i colori legge lo stesso. */}
            {tipo === "uscita" ? "− " : tipo === "risultato" ? "= " : ""}
            {etichetta}
          </span>
          {nota && <span className="block truncate text-[11px] text-slate-500">{nota}</span>}
        </span>
        <span
          className={cn(
            "shrink-0 tabular-nums",
            tipo === "risultato" ? "text-[17px] font-bold" : "text-[13.5px] font-semibold",
            colore,
          )}
        >
          {eur(importo)}
        </span>
      </div>
      {/*  La barra non si disegna sul risultato: quello non è una fetta di
          niente, è quello che avanza. */}
      {tipo !== "risultato" && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", barra)}
            style={{ width: `${Math.max(importo > 0 ? 2 : 0, Math.min(100, quota * 100))}%` }}
          />
        </div>
      )}
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. UN PASSO DELL'IMBUTO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ UN IMBUTO CHE SI STRINGE DAVVERO ──────────────────────────────────
 *  L'imbuto era cinque riquadri della stessa larghezza con dentro cinque
 *  numeri: la parola «imbuto» era l'unica cosa che si stringeva. Qui ogni
 *  passo è lungo quanto la sua quota del primo, quindi la perdita fra un
 *  passaggio e l'altro si vede come un gradino.
 *
 *  ⚠️ LA PERCENTUALE STA ACCANTO AL PASSO, non sotto: è la percentuale di
 *   quel passaggio — «di quelli di prima, quanti sono arrivati qui» — e messa
 *   sotto il numero si legge come una proprietà del numero. */
export function PassoImbuto({
  etichetta,
  valore,
  quota,
  conversione,
  tono = "neutro",
  onClick,
  attivo,
  icona: Icona,
}: {
  etichetta: string;
  valore: number;
  /** da 0 a 1 rispetto al primo passo */
  quota: number;
  /** «il 42% di quelli prima», oppure la ragione per cui non si può dire */
  conversione: string;
  tono?: "neutro" | "buono" | "male";
  onClick?: () => void;
  attivo?: boolean;
  icona?: ComponentType<{ className?: string }>;
}) {
  const colore =
    tono === "buono" ? "text-emerald-700" : tono === "male" ? "text-rose-700" : "text-slate-900";
  const barra =
    tono === "buono" ? "bg-emerald-500/70" : tono === "male" ? "bg-rose-400/70" : "bg-slate-300";
  const dentro = (
    <>
      <div className="flex items-center gap-2">
        {Icona && <Icona className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-600">{etichetta}</span>
        <span className={cn("shrink-0 text-[19px] font-bold leading-none tabular-nums", colore)}>
          {valore}
        </span>
        {onClick && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", barra)}
            style={{ width: `${Math.max(valore > 0 ? 3 : 0, Math.min(100, quota * 100))}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">{conversione}</span>
      </div>
    </>
  );
  if (!onClick) return <div className="px-3 py-2">{dentro}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attivo}
      className={cn(
        "w-full px-3 py-2 text-left transition-colors",
        attivo ? "bg-primary/[0.06]" : "hover:bg-slate-50",
      )}
    >
      {dentro}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. UN COSTO UNITARIO
   ═════════════════════════════════════════════════════════════════════════ */

/** Tre di questi in fila: costo per lead, costo per cliente, ritorno. Sono i
 *  numeri dell'efficienza, e stanno insieme perché si leggono insieme.
 *  ⚠️ La FORMULA è scritta sotto e non dentro un suggerimento: chi apre questa
 *   pagina la prima volta non sa che «costo per cliente» vuol dire la spesa
 *   pubblicitaria divisa i clienti, e un numero di cui non si sa la provenienza
 *   non si usa per decidere niente. */
export function CostoUnitario({
  etichetta,
  valore,
  base,
  formula,
  icona: Icona,
  principale,
  allarme,
  onClick,
  attivo,
}: {
  etichetta: string;
  valore: string;
  base: string;
  formula: string;
  icona?: ComponentType<{ className?: string }>;
  principale?: boolean;
  allarme?: boolean;
  onClick?: () => void;
  attivo?: boolean;
}) {
  const dentro = (
    <>
      <div className="flex items-center gap-1.5">
        {Icona && (
          <Icona
            className={cn("h-3.5 w-3.5 shrink-0", allarme ? "text-rose-500" : "text-slate-400")}
          />
        )}
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {etichetta}
        </span>
        {onClick && (
          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
        )}
      </div>
      <div
        className={cn(
          "mt-0.5 font-bold leading-tight tabular-nums",
          principale ? "text-[28px]" : "text-[20px]",
          allarme ? "text-rose-700" : "text-slate-900",
        )}
      >
        {valore}
      </div>
      <div className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{base}</div>
      <div className="mt-1 border-t border-slate-100 pt-1 text-[10.5px] leading-snug text-slate-400">
        {formula}
      </div>
    </>
  );
  const classi = cn(
    "rounded-xl border bg-card p-3 text-left",
    allarme ? "border-rose-200" : "border-slate-200",
    attivo && "ring-2 ring-primary/30",
  );
  if (!onClick) return <div className={classi}>{dentro}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(classi, "transition hover:bg-slate-50")}>
      {dentro}
    </button>
  );
}
