/** ── IL PALLINO DELLA TEMPERATURA ──────────────────────────────────────────
 *
 *  Richiesta del titolare (14/10/2026): com'è messo il cliente si legge dalla
 *  riga, in «Oggi», in Lead importati e nella scheda. La regola è una sola
 *  (crm/temperatura-lead); qui c'è solo il disegno.
 *
 *  ⚠️ IL COLORE AIUTA, LA PAROLA RESTA. Chi non distingue i colori legge
 *   «Caldo»: il pallino è `aria-hidden`, la parola è sempre scritta. Quando lo
 *   spazio è una riga sola (la fascia POI) resta solo il pallino, e la parola
 *   va nel suggerimento e nel testo per il lettore di schermo.
 *  ⚠️ «NESSUNA» NON SI SCRIVE. Venti righe con «nessuna risposta» sono rumore:
 *   senza risposte di temperatura il componente non disegna niente.
 *  ⚠️ `moduloLetto` legge anche le note: in «Oggi» la riga si ridisegna a ogni
 *   scatto dell'orologio, quindi la temperatura si calcola in `useMemo` sui
 *   dati del lead, una volta per versione della scheda. L'hook sta in prima
 *   riga e il `return null` dopo (React #310, già successo in produzione).
 *
 *  ── TOCCANDO LA TEMPERATURA SI APRONO LE RISPOSTE (30/10/2026) ──────────
 *  Richiesta del titolare: in tutto il CRM, toccando «Caldo», «Gelido»… si
 *  apre un pop-up con tutte le risposte del modulo. Il tocco sta QUI, una
 *  volta: chi passa i dati del lead (`TemperaturaRiga` sempre, il pallino con
 *  `dati`) ha il tasto. Il pop-up è quello del tasto Info della chat
 *  (`FinestraRisposte`, usato anche da chatwa/InfoModulo): sta in questo file
 *  e non in InfoModulo perché InfoModulo importa già il pallino da qui, e al
 *  contrario si farebbe un giro di import.
 *  ⚠️ IL TOCCO NON APRE LA RIGA. Quasi sempre la temperatura sta dentro una
 *   riga che si apre al tocco (spesso un <button>): il tasto ferma clic e
 *   tastiera. E i clic DENTRO il pop-up risalgono lo stesso l'albero di React
 *   (il portale non li ferma): li ferma l'involucro `contents` intorno.
 *  ⚠️ <span role="button">, NON <button>: dentro un <button> un altro
 *   <button> non è HTML valido (il browser lo sposta fuori dalla riga).
 *  ⚠️ 44 PX SUL TELEFONO SENZA ALLARGARE LA RIGA: l'area di tocco è un
 *   `after:` assoluto alto 44 px, centrato sull'etichetta; dal computer in su
 *   (`md:`) si tocca l'etichetta com'è. Dove un antenato taglia (`truncate`)
 *   l'area resta tagliata alla sua scatola.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Finestra } from "@/crm/ui/Finestra";
import { moduloLetto, vociModulo } from "@/crm/modulo-lead";
import {
  mostraTemperatura,
  temperaturaDi,
  temperaturaLead,
  type LivelloTemperatura,
  type TemperaturaLead,
} from "@/crm/temperatura-lead";
import type { LeadData } from "@/crm/types";
import type { RitornoChat } from "@/crm/chatwa/ritorno";

/** Dal rosso al blu, in sei passi; i tre di sempre restano uguali.
 *  ⚠️ MEDIO NON È AMBRA (capo progetto, 14/10, nota del revisore): nel CRM
 *   l'ambra vuol dire «in sospeso» e il Chip di stato ha già un pallino ambra.
 *   Pallino arancio chiaro, parola in grigio scuro (lo dice anche DESIGN.md).
 *  Caldissimo, Fuochino e Freddissimo (modulo «589€», 20/10/2026) si
 *  aggiungono ai lati e in mezzo senza cambiare i tre di prima.
 *  I testi 700/600 stanno sopra 4,5:1 sul fondo chiaro del CRM. */
const STILE: Record<Exclude<LivelloTemperatura, "nessuna">, { pallino: string; testo: string }> = {
  //  Il modulo «22-ott» (22/10/2026): Bollente rosso pieno, Tiepido giallo
  //  scuro (non ambra: l'ambra è «in sospeso»), Gelido grigio chiaro.
  bollente: { pallino: "bg-red-600", testo: "text-red-700" },
  tiepido: { pallino: "bg-yellow-400", testo: "text-yellow-800" },
  gelido: { pallino: "bg-slate-300", testo: "text-slate-500" },
  trapianto: { pallino: "bg-violet-400", testo: "text-violet-700" },
  caldissimo: { pallino: "bg-red-600", testo: "text-red-700" },
  caldo: { pallino: "bg-orange-600", testo: "text-orange-700" },
  fuochino: { pallino: "bg-orange-400", testo: "text-orange-800" },
  medio: { pallino: "bg-orange-300", testo: "text-slate-700" },
  freddo: { pallino: "bg-slate-400", testo: "text-slate-600" },
  freddissimo: { pallino: "bg-sky-600", testo: "text-sky-800" },
};

/** Il contenuto del pop-up: temperatura, perché, e tutte le risposte del
 *  modulo (`vociModulo`, come la scheda). Solo testo React: le risposte
 *  vengono da un modulo, mai HTML. Esportato anche per le prove. */
export function RisposteDelModulo({
  dati,
  telefono,
  ritorno,
}: {
  dati: Partial<LeadData>;
  /** Il numero, ripetuto sopra le risposte (lo passa la chat). */
  telefono?: string;
  /** «Di ritorno», per intero (lo passa la chat). */
  ritorno?: RitornoChat | null;
}) {
  const modulo = moduloLetto(dati);
  const voci = vociModulo(modulo);
  const t = temperaturaLead(modulo, dati.qualifica);
  const conTemperatura = t.livello !== "nessuna" && mostraTemperatura(dati.stato);
  const d = t.termometro;
  return (
    <div className="space-y-3 p-4 text-[13px]">
      {telefono && <p className="font-mono text-[12.5px] text-muted-foreground">{telefono}</p>}
      {/*  Di ritorno: qui per intero, con la data (sul telefono il tooltip non c'è). */}
      {ritorno && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          <p className="font-medium">{ritorno.completa}</p>
          <p className="mt-0.5 text-[12px]">{ritorno.titolo}</p>
        </div>
      )}
      {conTemperatura && (
        <div className="space-y-1.5">
          <p className="text-slate-700">
            <PallinoTemperatura t={t} />
            {t.perche && <span className="text-muted-foreground"> — {t.perche}</span>}
          </p>
          {d && (
            <>
              <p className="text-[12.5px] text-slate-700">{d.motivazione}</p>
              <p className="text-[12.5px] font-medium text-foreground">
                Da fare: <span className="font-normal">{d.azione_consigliata}</span>
              </p>
            </>
          )}
        </div>
      )}
      {voci.length > 0 ? (
        <dl className="divide-y divide-border rounded-lg border border-border">
          {voci.map((v) => (
            <div key={v.campo} className="px-3 py-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {v.titolo}
              </dt>
              <dd className="mt-0.5 whitespace-normal text-foreground" title={v.testo}>
                {v.valore}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted-foreground">Nessuna risposta al modulo.</p>
      )}
    </div>
  );
}

/** Il pop-up delle risposte (Esc e tocco fuori lo chiudono: è la Finestra). */
export function FinestraRisposte({
  dati,
  nome,
  onChiudi,
  telefono,
  ritorno,
}: {
  dati: Partial<LeadData>;
  /** Di serie nome e cognome della scheda. */
  nome?: string;
  onChiudi: () => void;
  telefono?: string;
  ritorno?: RitornoChat | null;
}) {
  return (
    <Finestra
      aperta
      onCambio={(aperta) => !aperta && onChiudi()}
      icona={ClipboardList}
      titolo="Quello che ha detto nel modulo"
      contesto={nome ?? (`${dati.nome || ""} ${dati.cognome || ""}`.trim() || undefined)}
      larghezza="sm"
    >
      <RisposteDelModulo dati={dati} telefono={telefono} ritorno={ritorno} />
    </Finestra>
  );
}

const ferma = (e: SyntheticEvent) => e.stopPropagation();

/** Il tasto intorno all'etichetta: tocco, Invio o Spazio aprono il pop-up,
 *  senza aprire la riga che lo contiene (vedi il cartello in testa). */
function ApreRisposte({
  dati,
  t,
  title,
  className,
  children,
}: {
  dati: Partial<LeadData>;
  t: TemperaturaLead;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const [aperta, setAperta] = useState(false);
  const apri = (e: SyntheticEvent) => {
    e.stopPropagation();
    //  Dentro un <a> o un <button> di un modulo: niente navigazione né invio.
    e.preventDefault();
    setAperta(true);
  };
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`${t.parola}: risposte del modulo`}
        title={title}
        onClick={apri}
        onPointerDown={ferma}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") apri(e);
        }}
        className={cn(
          "relative cursor-pointer rounded-sm hover:underline hover:decoration-dotted hover:underline-offset-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          //  L'area di tocco da 44 px (vedi il cartello in testa).
          "after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-full after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] md:after:hidden",
          className,
        )}
      >
        {children}
      </span>
      {aperta && (
        <span className="contents" onClick={ferma} onKeyDown={ferma} onPointerDown={ferma}>
          <FinestraRisposte dati={dati} onChiudi={() => setAperta(false)} />
        </span>
      )}
    </>
  );
}

/** Solo disegno, nessun hook. `null` quando il livello è «nessuna».
 *  Con `dati` diventa il tasto che apre le risposte del modulo; senza (nel
 *  pop-up stesso) resta solo disegno. */
export function PallinoTemperatura(p: {
  t: TemperaturaLead;
  soloPallino?: boolean;
  className?: string;
  dati?: Partial<LeadData>;
}) {
  const { t } = p;
  if (t.livello === "nessuna") return null;
  if (p.dati)
    return (
      <ApreRisposte
        dati={p.dati}
        t={t}
        //  Col solo pallino il suggerimento ce l'ha già il pallino dentro.
        title={p.soloPallino ? undefined : t.perche ? `${t.parola} · ${t.perche}` : t.parola}
        className={p.className}
      >
        <PallinoTemperatura t={t} soloPallino={p.soloPallino} />
      </ApreRisposte>
    );
  const stile = STILE[t.livello];
  //  In linea col testo (non flex): così gli spazi e i « · » della riga restano
  //  testo vero, e la riga si taglia con i puntini come le altre.
  const pallino = (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 rounded-full align-middle", stile.pallino)}
    />
  );
  if (p.soloPallino)
    return (
      <span className={p.className} title={t.perche ? `${t.parola} · ${t.perche}` : t.parola}>
        {pallino}
        <span className="sr-only">{t.parola}</span>
      </span>
    );
  return (
    <span className={cn("font-medium", stile.testo, p.className)}>
      {pallino}
      <span className="ml-1">{t.parola}</span>
    </span>
  );
}

/** Per le righe: pallino + parola + al massimo `max` risposte brevi, separate
 *  da « · ». Niente quando il lead non ha detto niente sulla temperatura. */
export function TemperaturaRiga(p: {
  dati: Partial<LeadData>;
  max?: number;
  soloPallino?: boolean;
  className?: string;
}) {
  const max = p.max ?? 2;
  const { t, brevi } = useMemo(() => temperaturaDi(p.dati, max), [p.dati, max]);
  if (t.livello === "nessuna") return null;
  if (p.soloPallino)
    return <PallinoTemperatura t={t} soloPallino dati={p.dati} className={p.className} />;
  //  Il testo intero al passaggio del mouse: sul monitor la riga si accorcia
  //  e la seconda risposta breve resta tagliata (revisione finale).
  //  ⚠️ PALLINO E PAROLA NON SI TAGLIANO MAI. Sul monitor la riga di «Oggi»
  //   accorcia per prima la temperatura (`shrink-[100] truncate`), e con il
  //   testo tutto in una riga cadeva proprio la parola: restava «Cal…», e sul
  //   computer il livello non si leggeva (sul telefono andava a capo e si
  //   vedeva). Segnalazione del titolare, 20/10/2026. Adesso si accorciano
  //   solo le risposte brevi.
  return (
    <ApreRisposte
      dati={p.dati}
      t={t}
      title={[t.parola, ...brevi].join(" · ")}
      className={cn("inline-flex max-w-full items-baseline", p.className)}
    >
      {/*  ⚠️ NIENTE `min-w-0` SUL TASTO: il minimo del contenitore deve restare
          pallino + parola (le risposte brevi hanno `min-w-0` e possono sparire).
          Con `min-w-0` la riga di «Oggi» lo schiacciava a zero (revisione 20/10). */}
      <PallinoTemperatura t={t} className="shrink-0 whitespace-nowrap" />
      {brevi.length > 0 && <span className="min-w-0 truncate">{` · ${brevi.join(" · ")}`}</span>}
    </ApreRisposte>
  );
}
