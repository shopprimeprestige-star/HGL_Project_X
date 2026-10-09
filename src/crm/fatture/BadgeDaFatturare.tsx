/** ── «QUESTO CLIENTE NON L'HAI ANCORA FATTURATO» ────────────────────────────
 *
 *  Un badge sulla riga della posa. Non è un promemoria generico: è l'unico
 *  punto in cui la mancanza si vede DOVE si guarda il lavoro. Prima bisognava
 *  aprire la scheda di ogni cliente per sapere se la fattura era stata fatta —
 *  cioè, in pratica, non lo sapeva nessuno finché non lo chiedeva il
 *  commercialista.
 *
 *  ── TRE STATI, NON DUE ────────────────────────────────────────────────────
 *  · emessa   → niente badge. Non si festeggia il lavoro fatto: si segnala
 *               solo quello che manca, o il colore smette di voler dire
 *               qualcosa.
 *  · bozza    → badge, ma con parole diverse: il documento c'è già, manca
 *               l'ultimo passo. Dirgli «fattura da fare» lo farebbe rifare
 *               da capo a chi l'aveva già preparata.
 *  · niente   → badge pieno.
 *
 *  ── E APRE LA FINESTRA CHE ESISTE GIÀ ─────────────────────────────────────
 *  Non c'è un secondo modulo per comporre la fattura: si apre
 *  `FinestraFattura`, la stessa che si apre dalla scheda del cliente, che i
 *  dati del cliente li prende già dal lead e chiede solo quello che manca.
 *  Un secondo modulo vorrebbe dire due posti dove sbagliare una partita IVA.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { eur } from "../ui";
import { giaIncassato, prezzoVendita } from "../InstallationScheduleDialog";
import type { Lead } from "../types";
import { leggiBozze, leggiEmesse } from "./archivio";
import { divarioFattura } from "./conto-lead";
import { FinestraFattura } from "./FinestraFattura";

/** ── L'ARCHIVIO SI LEGGE UNA VOLTA PER TUTTA LA PAGINA ─────────────────────
 *  Un badge sta su OGNI riga, e in un elenco di pose le righe sono decine. Se
 *  ognuna interrogasse l'archivio per conto suo sarebbero decine di letture
 *  identiche a ogni ridisegno — e l'elenco delle pose si ridisegna a ogni
 *  battuta della ricerca.
 *  Qui la lettura è una sola, condivisa, e si rifà solo quando qualcuno emette
 *  davvero qualcosa. */
/** ⚠️ `emesse` è un insieme di id per il badge (c'è / non c'è) e `importi`
 *  una mappa per il confronto fatturato/incassato: due domande diverse sulla
 *  stessa lettura, e farne due letture vorrebbe dire due risposte che a un
 *  certo punto si contraddicono. */
interface Stato {
  pronte: boolean;
  emesse: Set<string>;
  bozze: Set<string>;
  importi: Map<string, { totale: number; quante: number }>;
}
let cache: Promise<Stato> | null = null;
const ascoltatori = new Set<(s: Stato) => void>();
let ultimo: Stato = { pronte: false, emesse: new Set(), bozze: new Set(), importi: new Map() };

async function carica(): Promise<Stato> {
  const [e, b] = await Promise.all([leggiEmesse(), leggiBozze()]);
  //  ⚠️ Se la lettura FALLISCE non si finge che le fatture non ci siano: si
  //   resta «non pronte», e il badge non compare. Un archivio irraggiungibile
  //   farebbe altrimenti sbocciare l'avviso rosso su ogni riga della pagina,
  //   e chi lo vede rifà fatture che esistono già.
  if (!e.ok || !b.ok) {
    return { pronte: false, emesse: new Set(), bozze: new Set(), importi: new Map() };
  }
  const importi = new Map<string, { totale: number; quante: number }>();
  for (const f of e.lista) {
    const id = String(f.leadId || "");
    if (!id) continue;
    const prima = importi.get(id) ?? { totale: 0, quante: 0 };
    importi.set(id, {
      totale: Math.round((prima.totale + (Number(f.totale) || 0)) * 100) / 100,
      quante: prima.quante + 1,
    });
  }
  ultimo = {
    pronte: true,
    emesse: new Set(e.lista.map((f) => String(f.leadId || "")).filter(Boolean)),
    bozze: new Set(b.lista.map((f) => String(f.leadId || "")).filter(Boolean)),
    importi,
  };
  ascoltatori.forEach((f) => f(ultimo));
  return ultimo;
}

/** Rilegge l'archivio: si chiama dopo un'emissione, così il badge sparisce
 *  dalla riga senza dover ricaricare la pagina. */
export function ricaricaFatture(): void {
  cache = carica();
}

function useArchivioFatture(): Stato {
  const [s, setS] = useState<Stato>(ultimo);
  useEffect(() => {
    ascoltatori.add(setS);
    if (!cache) cache = carica();
    void cache.then(setS);
    return () => { ascoltatori.delete(setS); };
  }, []);
  return s;
}

export function BadgeDaFatturare({ lead, className }: { lead: Lead; className?: string }) {
  const archivio = useArchivioFatture();
  const [aperta, setAperta] = useState(false);

  //  ⚠️ Gli hook stanno TUTTI sopra le uscite anticipate: questo componente
  //   finisce su righe di elenchi che si ridisegnano di continuo, e un hook
  //   saltato fra due disegni della stessa riga è una schermata bianca.
  const daFatturare = prezzoVendita(lead) > 0 || giaIncassato(lead) > 0;
  const emessa = archivio.emesse.has(lead.id);
  const inBozza = archivio.bozze.has(lead.id);

  //  Niente badge se: l'archivio non si è ancora letto (o non si è potuto
  //  leggere), non c'è niente da fatturare, o la fattura c'è già.
  if (!archivio.pronte || !daFatturare || emessa) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAperta(true); }}
        title={inBozza
          ? "La fattura è già preparata come bozza: manca solo emetterla"
          : "Questo cliente ha incassato ma non è ancora stato fatturato"}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition",
          inBozza
            //  Bozza: ambra tenue. C'è del lavoro fatto, non è un allarme.
            ? "border-amber-400/50 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400"
            //  Niente: rosso. È soldi incassati senza un documento, e la
            //  differenza fra i due colori è la differenza fra «finisci» e
            //  «comincia».
            : "border-rose-400/50 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400",
          className,
        )}
      >
        {inBozza ? <FileWarning className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {inBozza ? "Bozza da emettere" : "Fattura da emettere"}
      </button>

      <FinestraFattura
        lead={lead}
        aperta={aperta}
        onCambio={setAperta}
        //  Emessa: si rilegge l'archivio e il badge sparisce da solo, da questa
        //  riga e da ogni altra che riguarda lo stesso cliente.
        onFatta={() => ricaricaFatture()}
      />
    </>
  );
}

/** ── FATTURATO CONTRO INCASSATO, SULLA SCHEDA ──────────────────────────────
 *
 *  Due numeri che vengono da due mondi: quello che il cliente ha pagato (la
 *  cassa) e quello che gli è stato fatturato (i documenti). Quando non
 *  coincidono, la differenza è un lavoro da fare — un acconto incassato e mai
 *  fatturato, un saldo arrivato dopo l'ultima fattura — e prima non la vedeva
 *  nessuno finché non la chiedeva il commercialista.
 *
 *  ⚠️ NON DICE COSA FARE, e non è timidezza: quanto vada fatturato lo decide
 *   chi fattura, documento per documento. Qui si mettono due cifre una accanto
 *   all'altra e si dice di quanto distano.
 *  ⚠️ E TACE FINCHÉ L'ARCHIVIO NON È LETTO: «fatturato € 0» su una lettura non
 *   ancora arrivata è una bugia che dura un secondo e fa rifare una fattura
 *   che esiste già.
 */
export function FatturatoIncassato({ lead, className }: { lead: Lead; className?: string }) {
  const archivio = useArchivioFatture();
  const incassato = giaIncassato(lead);
  const f = archivio.importi.get(lead.id) ?? { totale: 0, quante: 0 };
  const d = divarioFattura(incassato, f.totale);
  if (!archivio.pronte || d.stato === "niente") return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px]",
        className,
      )}
    >
      <span className="text-slate-600">
        Incassato <span className="font-semibold tabular-nums text-slate-900">{eur(incassato)}</span>
      </span>
      <span className="text-slate-600">
        Fatturato <span className="font-semibold tabular-nums text-slate-900">{eur(f.totale)}</span>
        {f.quante > 0 && (
          <span className="text-slate-400">
            {" "}
            · {f.quante} {f.quante === 1 ? "fattura" : "fatture"}
          </span>
        )}
      </span>
      {d.stato === "da_fatturare" && (
        <span className="font-medium text-amber-700">
          {eur(d.differenza)} incassati e non ancora fatturati
        </span>
      )}
      {/*  ⚠️ «Oltre» non è un allarme: si fattura anche prima di incassare —
          una fattura a saldo emessa il giorno prima del bonifico — e colorarla
          di rosso farebbe suonare un guaio su una cosa normale. */}
      {d.stato === "oltre" && (
        <span className="text-slate-500">{eur(d.differenza)} fatturati prima dell'incasso</span>
      )}
      {d.stato === "pari" && <span className="text-emerald-700">tutto fatturato</span>}
    </div>
  );
}
