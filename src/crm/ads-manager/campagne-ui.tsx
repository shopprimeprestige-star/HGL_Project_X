/** ─────────────────────────────────────────────────────────────────────────
 *  campagne-ui.tsx — IL VESTITO CONDIVISO DELLE DUE PAGINE CAMPAGNE
 *
 *  PERCHÉ QUESTO FILE ESISTE
 *  Meta e TikTok raccontano la stessa storia — quanto ho speso, quanti contatti
 *  sono arrivati, quanti sono diventati clienti, quanto è costato ognuno — ma
 *  la raccontavano con due schermate che non si somigliavano in niente: due
 *  intestazioni, due barre di filtri, due tabelle, due vocabolari (una diceva
 *  "Lead", l'altra "Lead" ma poi "Conv.API"; una "CPL", l'altra "Costo per
 *  conversione"). Chi passava dall'una all'altra doveva reimparare tutto, e il
 *  confronto fra le due piattaforme — cioè il motivo per cui si aprono — non si
 *  poteva fare a occhio.
 *  Qui la disposizione, le colonne e i nomi sono definiti UNA volta. Le due
 *  pagine portano solo i dati: non possono più divergere.
 *
 *  LA DOMANDA A CUI RISPONDONO
 *  Una sola: QUALE CAMPAGNA STA PORTANDO CLIENTI E A CHE COSTO.
 *  Tutto ciò che non serve a rispondere non sta qui. Le metriche di mestiere
 *  (hook rate, frequenza, scroll medio, punteggi compositi) non sono sparite:
 *  sono scese di un piano, negli approfondimenti e nel dettaglio della singola
 *  inserzione, dove si va quando la risposta è "questa non funziona, perché?".
 *
 *  IL COLORE
 *  Stesso alfabeto del resto del CRM: emerald = va bene, ambra = manca un
 *  passaggio, rose = si sta perdendo, sky = da guardare adesso, slate = neutro.
 *  Le cifre restano nere: la gerarchia la fanno peso e dimensione. L'unico
 *  colore per riga è la pastiglia dell'esito, perché è l'unica informazione che
 *  serve leggere con la coda dell'occhio su venti righe.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarraAzioni, Kpi, KpiRiga, Scheda, Segmento, SepBarra, Vuoto, eur } from "@/crm/ui";
import { Input } from "@/components/ui/input";
import { SortableHeader } from "@/crm/SortableHeader";
import { useSortableTable, applySort } from "@/crm/useSortableTable";
import type { VerdictKind } from "./verdict";

/* ═══════════════════════════════════════════════════════════════════════════
   1. I TRE LIVELLI — la stessa scala su tutt'e due le piattaforme
   ═════════════════════════════════════════════════════════════════════════ */

/** Meta li chiama campagne/gruppi di inserzioni/inserzioni, TikTok
 *  campaign/adgroup/ad: sono la stessa scatola dentro la stessa scatola. Un
 *  nome solo, così il passaggio fra le due pagine non chiede traduzioni. */
export type Livello = "campagne" | "gruppi" | "inserzioni";

export const LIVELLI: { chiave: Livello; titolo: string; uno: string; molti: string }[] = [
  { chiave: "campagne", titolo: "Campagne", uno: "campagna", molti: "campagne" },
  { chiave: "gruppi", titolo: "Gruppi", uno: "gruppo", molti: "gruppi" },
  { chiave: "inserzioni", titolo: "Inserzioni", uno: "inserzione", molti: "inserzioni" },
];

export const nomeLivello = (l: Livello) => LIVELLI.find((x) => x.chiave === l)!;

/* ═══════════════════════════════════════════════════════════════════════════
   2. L'ESITO — cosa farne, in una parola
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ UNA PAROLA E NON UN PUNTEGGIO ─────────────────────────────────
 *  Il punteggio composito (0-100, cinque sotto-indici, z-score sul set) resta
 *  calcolato e resta visibile nel dettaglio, ma in elenco non faceva prendere
 *  nessuna decisione: davanti a "62/100" bisogna comunque chiedersi se si
 *  spegne o no. L'esito è già la risposta, e usa i toni del CRM invece di
 *  un semaforo a parte. */
export type Esito = "funziona" | "sistemare" | "spegnere" | "prova" | "ferma";

export const ESITI_CAMPAGNA: Record<Esito, { breve: string; spiega: string; classi: string }> = {
  funziona: {
    breve: "Funziona",
    spiega: "Porta contatti a un costo sostenibile: lasciala girare",
    classi: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  },
  sistemare: {
    breve: "Da sistemare",
    spiega: "Porta contatti ma costano troppo: cambia creativa o pubblico",
    classi: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  },
  spegnere: {
    breve: "Da spegnere",
    spiega: "Sta spendendo senza portare clienti",
    classi: "border-rose-500/25 bg-rose-500/10 text-rose-700",
  },
  prova: {
    breve: "In prova",
    spiega: "Troppo poca spesa o troppi pochi giorni per giudicare",
    classi: "border-sky-500/25 bg-sky-500/10 text-sky-700",
  },
  ferma: {
    breve: "Ferma",
    spiega: "Nessuna spesa nel periodo scelto",
    classi: "border-slate-500/25 bg-slate-500/10 text-slate-600",
  },
};

/** L'ordine in cui si guardano: prima quello su cui si deve decidere oggi. */
export const ORDINE_ESITI: Esito[] = ["spegnere", "sistemare", "funziona", "prova", "ferma"];

const PESO_ESITO: Record<Esito, number> = {
  spegnere: 0,
  sistemare: 1,
  funziona: 2,
  prova: 3,
  ferma: 4,
};

/** Il verdetto tecnico (verdict.ts) tradotto nelle cinque parole di sopra.
 *  Il calcolo resta uno solo: qui cambia solo come si chiama. */
export function esitoDaVerdetto(kind: VerdictKind | null | undefined, spesa: number): Esito {
  if (!spesa || spesa <= 0) return "ferma";
  if (kind === "kill") return "spegnere";
  if (kind === "optimize") return "sistemare";
  if (kind === "winner") return "funziona";
  return "prova";
}

/** Sotto questa spesa non si giudica: due giorni a dieci euro non dicono se una
 *  campagna funziona, dicono solo che è partita da poco. */
export const SPESA_MINIMA_PER_GIUDICARE = 20;

/** ── L'ESITO DI UN RAGGRUPPAMENTO ─────────────────────────────────────────
 *  Il verdetto tecnico (verdict.ts) esiste solo per la singola inserzione:
 *  usa qualità della creativa, affaticamento, punteggi. Campagne e gruppi non
 *  hanno una creativa, quindi si giudicano su ciò che hanno davvero — soldi
 *  usciti, contatti entrati, vendite chiuse — con la stessa scala di parole,
 *  così una campagna "Da spegnere" e un'inserzione "Da spegnere" significano
 *  la stessa cosa su tutt'e due le piattaforme.
 *
 *  Il riferimento è il costo contatto MEDIO del set che si sta guardando, non
 *  una soglia fissa: quale sia un buon costo per contatto lo decide il mercato
 *  del momento, non una costante scritta oggi in un file. */
export function esitoAggregato(
  r: { spesa: number; contatti: number; clienti: number; incasso: number },
  riferimento: { costoContattoMedio: number | null },
): { esito: Esito; motivo: string } {
  if (!r.spesa || r.spesa <= 0) {
    return { esito: "ferma", motivo: "Nessuna spesa nel periodo" };
  }
  if (r.spesa < SPESA_MINIMA_PER_GIUDICARE) {
    return { esito: "prova", motivo: `Solo ${eur(r.spesa)} spesi: troppo poco per giudicare` };
  }
  if (r.contatti <= 0) {
    return { esito: "spegnere", motivo: `${eur(r.spesa)} spesi, nessun contatto` };
  }

  const ritorno = r.incasso / r.spesa;
  if (ritorno >= 1) {
    return { esito: "funziona", motivo: `Rientra ${volte(ritorno)} di quanto spende` };
  }

  const costoContatto = r.spesa / r.contatti;
  const media = riferimento.costoContattoMedio;

  //  Nessun incasso attribuito è la norma quando la vendita si chiude in sede
  //  giorni dopo: in quel caso l'unico giudizio onesto è sul costo contatto.
  if (r.incasso <= 0 && media != null && costoContatto > media * 2) {
    return {
      esito: "spegnere",
      motivo: `${eur(costoContatto)} a contatto contro ${eur(media)} di media`,
    };
  }
  if (media != null && costoContatto <= media) {
    return {
      esito: "funziona",
      motivo: `${eur(costoContatto)} a contatto, sotto la media di ${eur(media)}`,
    };
  }
  return {
    esito: "sistemare",
    motivo: media != null
      ? `${eur(costoContatto)} a contatto contro ${eur(media)} di media`
      : `${eur(costoContatto)} a contatto, ${r.clienti} vendite`,
  };
}

export function ChipEsito({
  esito,
  motivo,
  className,
}: {
  esito: Esito;
  /** la frase che spiega PERCHÉ: senza, la pastiglia è un giudizio senza appello */
  motivo?: string;
  className?: string;
}) {
  const e = ESITI_CAMPAGNA[esito];
  return (
    <span
      title={motivo ? `${e.breve} — ${motivo}` : e.spiega}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-md border px-1.5",
        "text-[11px] font-medium leading-5 whitespace-nowrap",
        e.classi,
        className,
      )}
    >
      {e.breve}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA RIGA — una sola forma per campagne, gruppi e inserzioni
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ UNA FORMA SOLA PER TRE LIVELLI ────────────────────────────────
 *  Prima ogni livello aveva la sua tabella con le sue colonne: le campagne
 *  mostravano impression e CTR, le inserzioni ottanta metriche, i gruppi quasi
 *  niente. Ma la domanda è identica ai tre livelli, quindi le colonne sono
 *  identiche: si sale e si scende senza cambiare punto di riferimento. */
export interface RigaCampagna {
  id: string;
  nome: string;
  /** riga di servizio sotto il nome: a quale campagna appartiene, quante
   *  inserzioni contiene… Serve a non perdere il filo scendendo di livello. */
  sotto?: string;
  spesa: number;
  /** i contatti arrivati: il CRM li chiama così ovunque, non "lead" */
  contatti: number;
  /** i contatti che hanno comprato */
  clienti: number;
  incasso: number;
  esito: Esito;
  motivo?: string;
  /** true quando la riga è ancora attiva sulla piattaforma */
  attiva?: boolean;
  /** id da usare per scendere di livello (null = è già l'ultimo livello) */
  figliDi?: string;
}

export interface TotaliCampagne {
  spesa: number;
  contatti: number;
  clienti: number;
  incasso: number;
  costoContatto: number | null;
  costoCliente: number | null;
  margine: number;
  ritorno: number | null;
}

/** Il costo di una cosa che potrebbe non essere mai successa. Restituisce null
 *  invece di 0: "€ 0 per cliente" è una bugia che si legge come un successo. */
export function costoPer(spesa: number, quanti: number): number | null {
  if (!quanti || quanti <= 0) return null;
  return spesa / quanti;
}

export function totaliDi(righe: RigaCampagna[]): TotaliCampagne {
  let spesa = 0;
  let contatti = 0;
  let clienti = 0;
  let incasso = 0;
  for (const r of righe) {
    spesa += r.spesa || 0;
    contatti += r.contatti || 0;
    clienti += r.clienti || 0;
    incasso += r.incasso || 0;
  }
  return {
    spesa,
    contatti,
    clienti,
    incasso,
    costoContatto: costoPer(spesa, contatti),
    costoCliente: costoPer(spesa, clienti),
    margine: incasso - spesa,
    ritorno: spesa > 0 ? incasso / spesa : null,
  };
}

export function contaEsiti(righe: RigaCampagna[]): Record<Esito, number> {
  const c: Record<Esito, number> = { funziona: 0, sistemare: 0, spegnere: 0, prova: 0, ferma: 0 };
  for (const r of righe) c[r.esito] += 1;
  return c;
}

/** Il filtro per esito e la ricerca in un posto solo, così le due pagine non
 *  possono filtrare "quasi" allo stesso modo. La ricerca guarda anche la riga
 *  di servizio: cercare il nome di una campagna deve trovare le sue inserzioni
 *  anche quando si sta guardando il livello più basso. */
export function filtraRighe(
  righe: RigaCampagna[],
  { esito, testo }: { esito?: Esito | null; testo?: string },
): RigaCampagna[] {
  const q = (testo || "").trim().toLowerCase();
  return righe.filter((r) => {
    if (esito && r.esito !== esito) return false;
    if (q && !`${r.nome} ${r.sotto ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/* ── COME SI SCRIVONO I NUMERI ────────────────────────────────────────────
   Stessa forma nelle due pagine e nelle due viste (tabella e schede): un
   importo scritto "€1.234" in una e "€ 1.234,00" nell'altra si legge come due
   cifre diverse. `eur` arriva dai mattoni del CRM, gli altri stanno qui. */
export const interi = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("it-IT");

export const soldi = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : eur(n);

export const volte = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(2)}×`;

/* ═══════════════════════════════════════════════════════════════════════════
   4. I NUMERI IN CIMA — gli stessi sette, nello stesso ordine
   ═════════════════════════════════════════════════════════════════════════ */

/** Sette riquadri, e sono la risposta letta da lontano: quanto ho speso, cosa
 *  ne è uscito, quanto è costato ogni pezzo, cosa resta in tasca.
 *  Il costo per cliente è il numero che decide, ed è quello che nelle due
 *  pagine di prima non c'era in nessuna delle due. */
export function NumeriCampagne({ totali }: { totali: TotaliCampagne }) {
  const t = totali;
  return (
    <KpiRiga colonne={4}>
      <Kpi etichetta="Spesa" valore={soldi(t.spesa)} nota="Nel periodo scelto" />
      <Kpi
        etichetta="Contatti"
        valore={interi(t.contatti)}
        tono={t.contatti > 0 ? "da_lavorare" : "neutro"}
        nota="Arrivati dagli annunci"
      />
      <Kpi
        etichetta="Costo contatto"
        valore={soldi(t.costoContatto)}
        nota={t.contatti > 0 ? `${interi(t.contatti)} contatti` : "Nessun contatto"}
      />
      <Kpi
        etichetta="Clienti"
        valore={interi(t.clienti)}
        tono={t.clienti > 0 ? "vinta" : "neutro"}
        nota={
          t.contatti > 0
            ? `${((t.clienti / t.contatti) * 100).toFixed(1)}% dei contatti`
            : "Nessuna vendita"
        }
      />
      {/*  Il numero che decide il budget: quanto costa portare a casa UNA
          persona che paga. Il costo per contatto da solo fa spegnere campagne
          che costano care ma vendono, e tenere accese quelle che raccolgono
          contatti a due euro e non chiudono mai. */}
      <Kpi
        etichetta="Costo cliente"
        valore={soldi(t.costoCliente)}
        nota="Quanto costa una vendita"
      />
      <Kpi etichetta="Incasso" valore={soldi(t.incasso)} nota="Venduto attribuito" />
      <Kpi
        etichetta="Margine"
        valore={soldi(t.margine)}
        tono={t.margine > 0 ? "vinta" : t.margine < 0 ? "persa" : "neutro"}
        nota={t.ritorno != null ? `${volte(t.ritorno)} sulla spesa` : "Nessuna spesa"}
      />
    </KpiRiga>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. L'ELENCO — tabella su schermo largo, schede su telefono
   ═════════════════════════════════════════════════════════════════════════ */

type ChiaveOrdine = "nome" | "spesa" | "contatti" | "costoContatto" | "clienti" | "costoCliente" | "incasso" | "ritorno";

interface Colonna {
  chiave: ChiaveOrdine;
  titolo: string;
  spiega: string;
  /** larghezza fissa: senza, la colonna del nome si mangia tutto lo spazio */
  larghezza: string;
}

/** ── PERCHÉ QUESTE OTTO E NON ALTRE ───────────────────────────────────────
 *  Ognuna è un pezzo della catena "ho speso → è arrivato qualcuno → ha
 *  comprato → è rientrato". Tolta una, la catena si spezza; aggiunta una nona,
 *  si comincia a leggere la tabella invece di guardarla. */
const COLONNE: Colonna[] = [
  { chiave: "spesa", titolo: "Spesa", spiega: "Quanto è costato il periodo", larghezza: "w-[104px]" },
  { chiave: "contatti", titolo: "Contatti", spiega: "Persone arrivate dagli annunci", larghezza: "w-[92px]" },
  { chiave: "costoContatto", titolo: "Costo contatto", spiega: "Spesa divisa per i contatti", larghezza: "w-[124px]" },
  { chiave: "clienti", titolo: "Clienti", spiega: "Contatti che hanno comprato", larghezza: "w-[88px]" },
  { chiave: "costoCliente", titolo: "Costo cliente", spiega: "Spesa divisa per i clienti: il numero che decide", larghezza: "w-[120px]" },
  { chiave: "incasso", titolo: "Incasso", spiega: "Venduto attribuito a questa riga", larghezza: "w-[112px]" },
  { chiave: "ritorno", titolo: "Ritorno", spiega: "Incasso diviso spesa: sotto 1× si sta perdendo", larghezza: "w-[92px]" },
];

function valoreDi(r: RigaCampagna, k: ChiaveOrdine): number | string | null {
  switch (k) {
    case "nome":
      return r.nome;
    case "spesa":
      return r.spesa;
    case "contatti":
      return r.contatti;
    case "costoContatto":
      return costoPer(r.spesa, r.contatti);
    case "clienti":
      return r.clienti;
    case "costoCliente":
      return costoPer(r.spesa, r.clienti);
    case "incasso":
      return r.incasso;
    case "ritorno":
      return r.spesa > 0 ? r.incasso / r.spesa : null;
  }
}

function testoDi(r: RigaCampagna, k: ChiaveOrdine): string {
  const v = valoreDi(r, k);
  if (k === "contatti" || k === "clienti") return interi(v as number);
  if (k === "ritorno") return volte(v as number | null);
  if (k === "nome") return String(v);
  return soldi(v as number | null);
}

/** Il ritorno è l'unico numero che si colora: sotto 1× la riga sta bruciando
 *  soldi, ed è l'informazione che deve arrivare prima della lettura. */
function classiRitorno(r: RigaCampagna): string {
  if (r.spesa <= 0) return "text-muted-foreground";
  const x = r.incasso / r.spesa;
  if (x >= 2) return "text-emerald-700 font-semibold";
  if (x >= 1) return "text-foreground";
  if (r.incasso > 0) return "text-amber-700";
  return "text-rose-600";
}

/** Ordina per esito quando l'utente non ha scelto una colonna: in cima ciò su
 *  cui si deve decidere oggi, non ciò che ha speso di più. A parità di esito
 *  vince la spesa, perché è lì che il ritardo costa. */
function ordinePredefinito(righe: RigaCampagna[]): RigaCampagna[] {
  return [...righe].sort(
    (a, b) => PESO_ESITO[a.esito] - PESO_ESITO[b.esito] || (b.spesa || 0) - (a.spesa || 0),
  );
}

export function ElencoCampagne({
  righe,
  livello,
  onApri,
  caricamento,
  vuotoTitolo,
  vuotoTesto,
  vuotoIcona,
  vuotoAzione,
}: {
  righe: RigaCampagna[];
  livello: Livello;
  /** apre la riga: scende di livello, o apre il dettaglio se è l'ultimo */
  onApri?: (r: RigaCampagna) => void;
  caricamento?: boolean;
  vuotoTitolo: string;
  vuotoTesto?: ReactNode;
  vuotoIcona?: ComponentType<{ className?: string }>;
  vuotoAzione?: ReactNode;
}) {
  const { sort, onHeaderClick } = useSortableTable<ChiaveOrdine>();
  const ordinate = sort.key && sort.dir
    ? applySort(righe, sort, valoreDi)
    : ordinePredefinito(righe);

  if (caricamento && righe.length === 0) return <SchelettroElenco />;

  if (righe.length === 0) {
    return (
      <Vuoto
        titolo={vuotoTitolo}
        testo={vuotoTesto}
        icona={vuotoIcona}
        azione={vuotoAzione}
      />
    );
  }

  const etichettaRiga = nomeLivello(livello).uno;

  return (
    <>
      {/*  ── SCHERMO LARGO: la tabella ──────────────────────────────────────
          Otto colonne stanno in 1000px senza scorrimento orizzontale. La
          tabella di prima ne aveva ottanta e si scorreva di lato per trovare
          il costo per lead: la colonna che serviva era sempre fuori campo. */}
      <Scheda senzaPadding className="hidden md:block" classeCorpo="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                <SortableHeader
                  label={nomeLivello(livello).titolo}
                  align="left"
                  active={sort.key === "nome"}
                  dir={sort.key === "nome" ? sort.dir : null}
                  onClick={() => onHeaderClick("nome")}
                />
              </th>
              {COLONNE.map((c) => (
                <th key={c.chiave} className={cn("px-3 py-2 text-right font-medium", c.larghezza)}>
                  <SortableHeader
                    label={c.titolo}
                    labelNode={<span className="truncate" title={c.spiega}>{c.titolo}</span>}
                    active={sort.key === c.chiave}
                    dir={sort.key === c.chiave ? sort.dir : null}
                    onClick={() => onHeaderClick(c.chiave)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordinate.map((r) => (
              <tr
                key={r.id}
                onClick={onApri ? () => onApri(r) : undefined}
                className={cn(
                  "border-t border-border",
                  onApri && "cursor-pointer hover:bg-muted/40",
                )}
              >
                <td className="max-w-0 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ChipEsito esito={r.esito} motivo={r.motivo} />
                    <span className="truncate font-medium" title={r.nome}>{r.nome}</span>
                  </div>
                  {r.sotto && (
                    <div className="truncate text-[11.5px] text-muted-foreground" title={r.sotto}>
                      {r.sotto}
                    </div>
                  )}
                </td>
                {COLONNE.map((c) => (
                  <td
                    key={c.chiave}
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      c.chiave === "ritorno" && classiRitorno(r),
                      c.chiave === "costoCliente" && "font-medium",
                    )}
                  >
                    {testoDi(r, c.chiave)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Scheda>

      {/*  ── TELEFONO: la stessa riga, impilata ─────────────────────────────
          Non è una tabella ristretta: è la stessa riga in verticale. Le due
          pagine di prima su telefono sbordavano di lato, e una tabella che
          esce dallo schermo è una tabella che non si legge. */}
      <div className="flex flex-col gap-2 md:hidden">
        {ordinate.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={onApri ? () => onApri(r) : undefined}
            className={cn(
              "rounded-xl border border-border bg-card px-3 py-2.5 text-left",
              onApri && "transition-colors hover:bg-accent/50",
            )}
          >
            <div className="flex items-start gap-2">
              <ChipEsito esito={r.esito} motivo={r.motivo} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{r.nome}</div>
                {r.sotto && (
                  <div className="truncate text-[11.5px] text-muted-foreground">{r.sotto}</div>
                )}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
              {COLONNE.map((c) => (
                <div key={c.chiave} className="min-w-0">
                  <div className="truncate text-[11px] text-muted-foreground">{c.titolo}</div>
                  <div
                    className={cn(
                      "truncate text-[13px] tabular-nums",
                      c.chiave === "ritorno" ? classiRitorno(r) : "font-medium",
                    )}
                  >
                    {testoDi(r, c.chiave)}
                  </div>
                </div>
              ))}
            </div>
          </button>
        ))}
        <p className="px-1 text-[11px] text-muted-foreground">
          {ordinate.length} {ordinate.length === 1 ? etichettaRiga : nomeLivello(livello).molti}
          {onApri ? " · tocca una riga per scendere nel dettaglio" : ""}
        </p>
      </div>
    </>
  );
}

/** ── L'ESPORTAZIONE ───────────────────────────────────────────────────────
 *  Esce quello che si sta guardando, con le stesse colonne e gli stessi nomi
 *  della tabella. Prima le due pagine esportavano tracciati diversi (una
 *  diciannove colonne tecniche, l'altra niente), quindi i due file non si
 *  potevano incollare uno sotto l'altro per confrontare le piattaforme. */
export function esportaCsvCampagne(
  righe: RigaCampagna[],
  livello: Livello,
  piattaforma: string,
) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = (n: number | null, d = 2) => (n == null || !Number.isFinite(n) ? "" : n.toFixed(d));
  const intestazioni = [
    "piattaforma", "livello", "nome", "riferimento", "esito", "motivo",
    "spesa_eur", "contatti", "costo_contatto_eur", "clienti", "costo_cliente_eur",
    "incasso_eur", "margine_eur", "ritorno",
  ];
  const linee = righe.map((r) => [
    piattaforma,
    nomeLivello(livello).uno,
    r.nome,
    r.sotto ?? "",
    ESITI_CAMPAGNA[r.esito].breve,
    r.motivo ?? "",
    num(r.spesa),
    r.contatti,
    num(costoPer(r.spesa, r.contatti)),
    r.clienti,
    num(costoPer(r.spesa, r.clienti)),
    num(r.incasso),
    num(r.incasso - r.spesa),
    num(r.spesa > 0 ? r.incasso / r.spesa : null, 3),
  ].map(esc).join(","));

  //  Il BOM serve a Excel italiano: senza, le lettere accentate arrivano rotte.
  const blob = new Blob(["﻿" + [intestazioni.join(","), ...linee].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${piattaforma.toLowerCase()}-${nomeLivello(livello).molti}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. LA BARRA DEI COMANDI — periodo, livello, ricerca, esito
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ UNA BARRA SOLA ────────────────────────────────────────────────
 *  Meta aveva intestazione + tab + striscia KPI + riga filtri + toolbar
 *  tabella: cinque piani di comandi prima di vedere un numero, e la barra dei
 *  filtri di TikTok era in un'altra posizione con altri controlli. Qui i
 *  comandi sono quattro e stanno su una riga sola, nell'ordine in cui si
 *  pensa: QUANDO (periodo) → COSA guardo (livello) → QUALE (ricerca) → in
 *  CHE STATO (esito). */
export function BarraCampagne({
  periodo,
  livello,
  onLivello,
  conteggiLivello,
  ricerca,
  onRicerca,
  esito,
  onEsito,
  conteggiEsito,
  azioni,
}: {
  /** il selettore di date della pagina: resta esterno perché ogni piattaforma
   *  gli passa i propri confronti fra periodi */
  periodo?: ReactNode;
  livello: Livello;
  onLivello: (l: Livello) => void;
  conteggiLivello: Record<Livello, number>;
  ricerca: string;
  onRicerca: (v: string) => void;
  esito: Esito | null;
  onEsito: (e: Esito | null) => void;
  conteggiEsito: Record<Esito, number>;
  /** comandi propri della piattaforma (sync, esporta): in coda, mai in mezzo */
  azioni?: ReactNode;
}) {
  const totale = ORDINE_ESITI.reduce((s, e) => s + conteggiEsito[e], 0);
  return (
    <BarraAzioni>
      {periodo}
      {periodo && <SepBarra />}

      {LIVELLI.map((l) => (
        <Segmento
          key={l.chiave}
          attivo={livello === l.chiave}
          conteggio={conteggiLivello[l.chiave]}
          onClick={() => onLivello(l.chiave)}
          titolo={`Guarda i numeri raggruppati per ${l.uno}`}
        >
          {l.titolo}
        </Segmento>
      ))}

      <SepBarra />

      <div className="relative min-w-[150px] flex-1 sm:max-w-[240px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={ricerca}
          onChange={(e) => onRicerca(e.target.value)}
          placeholder={`Cerca ${nomeLivello(livello).molti}…`}
          className="h-8 pl-8 text-[12.5px]"
        />
      </div>

      {/*  ── L'ESITO COME FILTRO ────────────────────────────────────────────
          I conteggi non sono decorazione: sono il primo sguardo alla pagina
          ("tre da spegnere") e ognuno è cliccabile per vedere le righe che lo
          compongono, come ogni altro numero del CRM. */}
      <SepBarra />
      <Segmento
        attivo={esito === null}
        conteggio={totale}
        onClick={() => onEsito(null)}
        titolo="Tutte le righe, qualunque sia il loro esito"
      >
        Tutte
      </Segmento>
      {ORDINE_ESITI.filter((e) => conteggiEsito[e] > 0).map((e) => (
        <Segmento
          key={e}
          attivo={esito === e}
          conteggio={conteggiEsito[e]}
          onClick={() => onEsito(esito === e ? null : e)}
          titolo={ESITI_CAMPAGNA[e].spiega}
        >
          {ESITI_CAMPAGNA[e].breve}
        </Segmento>
      ))}

      {azioni && (
        <>
          <div className="flex-1" />
          {azioni}
        </>
      )}
    </BarraAzioni>
  );
}

/** ── DOVE SONO ────────────────────────────────────────────────────────────
 *  Scendendo di livello si filtra, e un filtro invisibile è il modo più rapido
 *  per far dire "i numeri non tornano". Le briciole dicono dentro cosa si sta
 *  guardando e permettono di risalire con un clic. */
export function PercorsoCampagne({
  tappe,
  onRisali,
}: {
  /** dalla più generale alla più specifica; l'ultima è quella corrente */
  tappe: { etichetta: string; livello: Livello }[];
  onRisali: (l: Livello) => void;
}) {
  if (tappe.length <= 1) return null;
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1 text-[12px]" aria-label="Percorso">
      {tappe.map((t, i) => {
        const ultima = i === tappe.length - 1;
        return (
          <span key={`${t.livello}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {ultima ? (
              <span className="truncate font-medium" title={t.etichetta}>{t.etichetta}</span>
            ) : (
              <button
                type="button"
                onClick={() => onRisali(t.livello)}
                className="truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                title={`Torna a ${t.etichetta}`}
              >
                {t.etichetta}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. GLI APPROFONDIMENTI — tutto ciò che non risponde alla domanda
   ═════════════════════════════════════════════════════════════════════════ */

/** ── PERCHÉ CHIUSI ────────────────────────────────────────────────────────
 *  Hook rate, hold rate, frequenza, punteggi compositi, previsione del costo
 *  contatto di domani, perdita fra clic e sessione: sono strumenti veri, ma
 *  servono DOPO — quando l'elenco ha già detto quale riga non va e ci si chiede
 *  perché. Aperti di default occupavano tutto lo schermo sopra la risposta.
 *  Restano a un clic di distanza, e il clic resta ricordato per la sessione. */
export function Approfondimenti({
  titolo = "Approfondimenti",
  nota,
  children,
  chiaveMemoria,
}: {
  titolo?: string;
  nota?: string;
  children: ReactNode;
  /** dove ricordare aperto/chiuso: senza, si riapre a ogni cambio di periodo */
  chiaveMemoria: string;
}) {
  const [aperto, setAperto] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(chiaveMemoria) === "1";
  });
  const cambia = () => {
    const v = !aperto;
    setAperto(v);
    try { window.localStorage.setItem(chiaveMemoria, v ? "1" : "0"); } catch { /* modalità privata */ }
  };
  return (
    <Scheda
      titolo={titolo}
      nota={nota}
      icona={SlidersHorizontal}
      senzaPadding={!aperto}
      classeCorpo="space-y-3"
      azioni={
        <Segmento attivo={aperto} onClick={cambia} titolo="Mostra o nascondi le metriche di dettaglio">
          {aperto ? "Nascondi" : "Mostra"}
        </Segmento>
      }
    >
      {aperto ? children : undefined}
    </Scheda>
  );
}

/** Lo scheletro mentre arrivano i dati. Serve a dire "sta arrivando" senza far
 *  saltare il layout quando arriva davvero: stessa altezza delle righe vere. */
function SchelettroElenco() {
  return (
    <Scheda senzaPadding classeCorpo="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-muted" />
          <div
            className="h-3 animate-pulse rounded bg-muted"
            style={{ width: `${30 + ((i * 9) % 30)}%` }}
          />
          <div className="ml-auto hidden h-3 w-40 animate-pulse rounded bg-muted/70 md:block" />
        </div>
      ))}
    </Scheda>
  );
}
