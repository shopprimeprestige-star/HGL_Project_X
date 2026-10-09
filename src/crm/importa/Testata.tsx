/** ── LA TESTATA DI «LEAD IMPORTATI» ────────────────────────────────────────
 *
 *  ── COS'ERA, E PERCHÉ NON FUNZIONAVA ──────────────────────────────────────
 *  Titolo, una riga di spiegazione, CINQUE NUMERI IN FILA tutti disegnati
 *  uguali (in coda · da provare · segnati · richiami scaduti · saltati) e la
 *  ricerca. Il difetto non era il gusto: era che i cinque numeri si leggevano
 *  con la stessa attenzione, e quindi con nessuna. «Richiami scaduti» era rosso,
 *  ma era rosso ACCANTO ad altri quattro numeri della stessa misura, nella
 *  stessa riga, con la stessa etichetta minuscola sotto — a mezzo metro di
 *  distanza, con il telefono all'orecchio, è un numero fra cinque. E i cinque
 *  numeri insieme non rispondevano alla sola domanda che si fa chi apre la
 *  pagina la mattina: SONO IN PARI O SONO IN RITARDO?
 *
 *  ── COM'È FATTA ADESSO, E PERCHÉ ──────────────────────────────────────────
 *  Una fascia sola, e dentro tre livelli di lettura ben diversi fra loro:
 *
 *   1. IL VERDETTO (il protagonista). Una frase grande che dice se si è in
 *      pari o in ritardo, e un numero solo. Il numero protagonista è quello
 *      delle PROMESSE SCADUTE — i richiami concordati con il cliente e non
 *      ancora fatti — perché è l'unico dei cinque che descriva un DEBITO: gli
 *      altri quattro descrivono una fotografia («ce ne sono 48 in coda» non è
 *      né buono né cattivo, dipende dall'ora del giorno). Un debito, sì: o è
 *      zero, e si è in pari, o non lo è, e c'è qualcuno che aspetta una
 *      telefonata promessa.
 *      Lo SLOT è fisso, il CONTENUTO cambia: a zero diventa verde e dice «Sei
 *      in pari», e il numero grande passa a «quanti ancora da provare in questo
 *      giro» — cioè al lavoro di adesso. Così la posizione più importante della
 *      pagina non è mai occupata da uno zero.
 *      ⚠️ È l'unica cosa colorata della testata. È tutto il meccanismo: il
 *       rosso non si vede perché è più rosso di prima, si vede perché è l'unico
 *       colore in una fascia grigia. Aggiungere qui un secondo colore vuol dire
 *       spegnere questo.
 *
 *   2. LA BARRA DEL GIRO. Quanti ne hai già provati sul totale della coda, come
 *      barra e non come numero: «sono in pari con la giornata?» si legge dalla
 *      lunghezza di una barra in un decimo di secondo, da una frazione no.
 *
 *   3. I NUMERI DI CONTORNO. Gli stessi di prima, ma piccoli, su una riga, in
 *      grigio, e con il nome accanto alla cifra invece che sotto: sono dati da
 *      consultare («quanti ne ho segnati oggi?»), non allarmi. Uno solo può
 *      diventare un pulsante — i saltati — perché è l'unico che nasconde delle
 *      persone; ed è l'unico che può accendersi, in ambra e non in rosso,
 *      quando qualcuno è lì da troppo.
 *
 *  ⚠️ IL NUMERO DELLE SCADUTE NON SI CALCOLA QUI. Arriva da
 *   crm/importa/scadenze, che è lo stesso conto della sotto-scheda «Oggi»:
 *   premere il verdetto porta là, e la fascia in cima e l'elenco che si apre
 *   devono dire lo stesso numero. Due conti separati per la stessa parola
 *   («scaduto») sono due conti che un giorno divergono, e quel giorno la
 *   testata comincia a mentire.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SALTATO_DA_TROPPO } from "@/crm/importa/saltati";

/** Un numero di contorno. Piccolo, tabellare, grigio, con l'etichetta ACCANTO:
 *  in colonna (numero sopra, etichetta sotto) occupava l'altezza di una riga
 *  intera a testa ed era esattamente ciò che rendeva i cinque numeri di prima
 *  tutti uguali fra loro. Qui sono un elenco di dati, e si leggono come tali. */
function Dato({
  valore,
  etichetta,
  titolo,
  acceso,
  onClick,
}: {
  valore: number;
  etichetta: string;
  titolo: string;
  /** L'unico contorno che può accendersi, e in ambra: vedi l'intestazione. */
  acceso?: boolean;
  onClick?: () => void;
}) {
  const Elemento = onClick ? "button" : "div";
  return (
    <Elemento
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={titolo}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] transition-colors",
        acceso ? "text-amber-700" : "text-muted-foreground",
        onClick && "hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "text-[15px] font-semibold tabular-nums",
          acceso ? "text-amber-700" : "text-foreground",
        )}
      >
        {valore}
      </span>
      <span className={cn(onClick && "underline decoration-dotted underline-offset-4")}>
        {etichetta}
      </span>
    </Elemento>
  );
}

export function Testata({
  scadute,
  daProvare,
  inCoda,
  segnate,
  saltati,
  saltatiFermi,
  onVediScadute,
  onVediSaltati,
  ricerca,
}: {
  /** Le promesse non mantenute. È il protagonista, e arriva da
   *  crm/importa/scadenze: vedi l'intestazione. */
  scadute: number;
  daProvare: number;
  inCoda: number;
  segnate: number;
  saltati: number;
  saltatiFermi: number;
  onVediScadute: () => void;
  onVediSaltati: () => void;
  /** La ricerca resta un pezzo della pagina e non di questo file: è l'unico
   *  comando della testata che scrive nello stato del giro (chi va in testa
   *  alla coda), e portarlo qui dentro vorrebbe dire far passare da questo
   *  componente metà della pagina. */
  ricerca: ReactNode;
}) {
  const inRitardo = scadute > 0;
  /** La frazione del giro. `inCoda` a zero non è «tutto fatto», è «non c'è
   *  niente»: la barra in quel caso non si disegna, perché una barra piena su
   *  una coda vuota si legge come una giornata finita che non è mai cominciata. */
  const provati = Math.max(0, inCoda - daProvare);
  const percento = inCoda > 0 ? Math.round((provati / inCoda) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        {/* ── 1. IL VERDETTO ──────────────────────────────────────────────
            Un blocco solo, cliccabile quando c'è del ritardo: il gesto più
            probabile dopo aver letto «3 richiami scaduti» è volerli vedere, e
            costringere a cercare la scheda giusta dopo aver dato l'allarme è
            il modo migliore per far ignorare l'allarme. */}
        <button
          type="button"
          onClick={inRitardo ? onVediScadute : undefined}
          disabled={!inRitardo}
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors",
            inRitardo && "-mx-2 hover:bg-rose-50",
          )}
        >
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              inRitardo ? "bg-rose-600 text-white" : "bg-emerald-50 text-emerald-600",
            )}
          >
            {inRitardo ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-[30px] font-semibold leading-none tabular-nums",
                  inRitardo ? "text-rose-600" : "text-foreground",
                )}
              >
                {inRitardo ? scadute : daProvare}
              </span>
              <span
                className={cn(
                  "truncate text-[15px] font-semibold",
                  inRitardo ? "text-rose-700" : "text-foreground",
                )}
              >
                {inRitardo
                  ? scadute === 1
                    ? "richiamo scaduto"
                    : "richiami scaduti"
                  : daProvare === 1
                    ? "da provare in questo giro"
                    : "ancora da provare in questo giro"}
              </span>
              {inRitardo && <ChevronRight className="h-4 w-4 shrink-0 text-rose-400" />}
            </span>
            <span className="mt-1 block text-[12px] text-muted-foreground">
              {inRitardo
                ? "Promesse fatte al cliente e non ancora mantenute: vengono prima di tutto il resto"
                : "Sei in pari: nessuna promessa scaduta"}
            </span>
          </span>
        </button>

        <div className="min-w-[14rem] flex-1 sm:max-w-sm">{ricerca}</div>
      </div>

      {/* ── 2. LA BARRA DEL GIRO ───────────────────────────────────────────
          Non è un doppione dei numeri qui sotto: quelli dicono QUANTI, questa
          dice A CHE PUNTO SEI — ed è la sola delle due letture che si fa senza
          leggere. Resta grigia anche quando c'è del ritardo: il colore in
          questa fascia appartiene al verdetto, e basta. */}
      {inCoda > 0 && (
        <div className="mt-4">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percento}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avanzamento del giro di telefonate"
          >
            <div
              className="h-full rounded-full bg-foreground/70 transition-[width] duration-500"
              style={{ width: `${percento}%` }}
            />
          </div>
        </div>
      )}

      {/* ── 3. I NUMERI DI CONTORNO ────────────────────────────────────── */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1">
        <Dato
          valore={inCoda}
          etichetta="in coda"
          titolo="I contatti arrivati da una lista con la prima chiamata ancora aperta, più quelli di ritorno del file appena letto. I saltati non ci sono: stanno nella scheda «Lead saltati»"
        />
        <Dato
          valore={daProvare}
          etichetta="da provare"
          titolo="Quanti non hai ancora toccato in QUESTO giro: chi non risponde resta in coda ma non si ripresenta finché non ricominci"
        />
        <Dato
          valore={segnate}
          etichetta="segnati"
          titolo="Gli esiti scritti da questa postazione da quando hai aperto la pagina"
        />
        {/*  Il quinto numero è un pulsante perché è l'unico che nasconde delle
            persone: chi è stato messo da parte non lo sta chiamando nessuno, e
            l'unico modo perché non venga dimenticato è che si arrivi al suo
            elenco da qui. Si accende solo quando qualcuno è lì da troppo: un
            salto di stamattina è un gesto normale, uno di quattro giorni fa è
            una persona persa. */}
        <Dato
          valore={saltati}
          etichetta="saltati"
          titolo={
            saltatiFermi > 0
              ? `Messi da parte e fuori dalla coda: ${saltatiFermi} sono fermi da più di ${SALTATO_DA_TROPPO} giorni. Premi per vederli e rimetterli in coda`
              : "Messi da parte e fuori dalla coda. Il salto resta anche domani e lo vedono anche gli altri: premi per vederli e rimetterli in coda"
          }
          acceso={saltatiFermi > 0}
          onClick={onVediSaltati}
        />
        {inCoda > 0 && (
          <span className="ml-auto text-[11.5px] text-muted-foreground">
            {provati} di {inCoda} provati in questo giro
          </span>
        )}
      </div>

      {/*  ── I DIMENTICATI, QUANDO CE NE SONO ─────────────────────────────
           Un saltato che nessuno rimette in coda esce dal lavoro in silenzio:
           non è in coda, non ha un esito, non scade niente. Il numero qui sopra
           lo conta sempre, ma un numero di contorno si legge di sfuggita;
           questa riga compare solo quando qualcuno è fermo da troppo e sparisce
           da sola appena la si sistema — così quando c'è vuol dire qualcosa.
           Sta DENTRO la testata e non sotto, come stava prima: era un riquadro
           in più fra il setter e la persona da chiamare, e diceva una cosa che
           appartiene al riepilogo della giornata. */}
      {saltatiFermi > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[12.5px] text-amber-900">
            <b>
              {saltatiFermi === 1
                ? "1 contatto messo da parte"
                : `${saltatiFermi} contatti messi da parte`}
            </b>{" "}
            da più di {SALTATO_DA_TROPPO} giorni: nessuno li sta chiamando e non compaiono in
            nessuna coda.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 bg-white text-[12px]"
            onClick={onVediSaltati}
          >
            <SkipForward className="mr-1 h-3.5 w-3.5" /> Guardali
          </Button>
        </div>
      )}
    </div>
  );
}
