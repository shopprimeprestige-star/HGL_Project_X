/** Orari realmente liberi di un consulente in una data, presi da
 *  /api/crm/disponibilita (orari di lavoro e appuntamenti già presi, tutto
 *  interno al CRM).
 *
 *  Nasce per sostituire il campo "ora" scritto a mano: digitare un orario non
 *  dice se il consulente è libero, e l'appuntamento sopra un altro impegno si
 *  scopriva solo il giorno stesso. Qui si sceglie fra ciò che è davvero
 *  disponibile.
 *
 *  ── DUE COSE CHE QUI ERANO SBAGLIATE ─────────────────────────────────────
 *  1. LA DOMANDA NON ERA QUELLA CHE IL SERVER SA LEGGERE. Si chiedeva
 *     `?from=…&to=…` e si leggeva una risposta con `liberi[]`: l'API risponde
 *     su `?giorno=…` e restituisce `slot[]` con la bandierina `libero`. Il
 *     risultato era un 400 travestito da "Disponibilità non recuperata", cioè
 *     un componente che non ha mai mostrato un orario in vita sua.
 *  2. I BLOCCHI NON SI VEDEVANO. Una chiusura del centro (crm/blocchi.ts) non
 *     passa dal server: qui si legge il registro dei blocchi e si tolgono gli
 *     orari che ci finiscono dentro, dicendo quanti ne sono stati tolti — un
 *     orario che sparisce senza spiegazione fa pensare a un guasto.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarOff, Clock, Loader2, RefreshCw, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { assicuraBlocchi, intervalliBloccati, minutiDaOra } from "@/crm/blocchi";
import { DURATA_PREDEFINITA } from "@/crm/invito";

interface SlotApi {
  ora: string;
  libero: boolean;
  /** Quante consulenze ci sono già in questa fascia, e quante ce ne stanno:
   *  è il contatore «2/3». Assenti su una risposta vecchia: lì si torna a
   *  «libero / non libero», che è come ha sempre funzionato. */
  presi?: number;
  capienza?: number;
}

/** Una prenotazione già presa: da quando a quando, e di chi. */
interface Occupato {
  ora: string;
  fine?: string;
  chi?: string;
}

/** Uno slot come lo disegna questa schermata: l'orario, se è libero, e — se
 *  non lo è — chi lo tiene occupato e fino a quando. */
interface SlotMostrato {
  ora: string;
  libero: boolean;
  chi?: string;
  fino?: string;
  /** Il «2» e il «3» di «2/3». */
  presi: number;
  capienza: number;
}

interface RispostaDisponibilita {
  ok: boolean;
  giorno?: string;
  durata?: number;
  slot?: SlotApi[];
  /** Quante persone ci stanno in una fascia (il «3» di «2/3»). */
  capienza?: number;
  occupati?: Occupato[];
  /** "giorno non lavorativo" e simili: è il motivo per cui non c'è niente. */
  motivo?: string;
  reason?: string;
}

// Data locale in formato YYYY-MM-DD: toISOString passa per UTC e la sera in
// Italia restituirebbe già il giorno dopo.
function isoLocale(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  /** Consulente di cui leggere l'agenda. Senza consulente non c'è disponibilità. */
  consultantId?: string | null;
  /** Giorno da interrogare, YYYY-MM-DD. */
  data?: string | null;
  /** Durata dell'appuntamento in minuti: decide l'ampiezza degli slot. */
  durata?: number;
  /** Orario già scelto: resta evidenziato anche se nel frattempo risulta occupato. */
  oraSelezionata?: string | null;
  onScegli: (ora: string) => void;
  className?: string;
}

export default function SlotDisponibili({
  consultantId,
  data,
  durata = DURATA_PREDEFINITA,
  oraSelezionata,
  onScegli,
  className,
}: Props) {
  const [orari, setOrari] = useState<SlotMostrato[]>([]);
  const [toltiDaBlocchi, setToltiDaBlocchi] = useState(0);
  const [motivo, setMotivo] = useState<string | undefined>();
  const [errore, setErrore] = useState<string | undefined>();
  const [caricamento, setCaricamento] = useState(false);
  // Cambiando valore si forza un nuovo caricamento senza toccare i filtri.
  const [ricarica, setRicarica] = useState(0);

  const pronto = !!consultantId && !!data;
  // Un giorno già trascorso non ha orari futuri: senza distinguerlo il messaggio
  // di "nessuno slot" farebbe pensare a un consulente sempre occupato.
  const giornoPassato = !!data && data < isoLocale(new Date());

  useEffect(() => {
    if (!pronto) {
      setOrari([]);
      setErrore(undefined);
      setMotivo(undefined);
      setToltiDaBlocchi(0);
      return;
    }
    // Cambiando data o consulente in fretta le risposte possono tornare fuori
    // ordine: senza l'abort si vedrebbero gli orari del giorno precedente.
    const ac = new AbortController();
    setCaricamento(true);
    setErrore(undefined);

    const params = new URLSearchParams({
      consultantId: consultantId as string,
      giorno: data as string,
      durata: String(durata),
    });

    //  I blocchi si leggono in parallelo alla disponibilità: sono in cache dopo
    //  la prima volta, e senza di loro si mostrerebbero orari dentro a una
    //  chiusura già decisa.
    Promise.all([
      fetch(`/api/crm/disponibilita?${params.toString()}`, { signal: ac.signal }).then(
        (r) => r.json() as Promise<RispostaDisponibilita>,
      ),
      assicuraBlocchi(),
    ])
      .then(([j, blocchi]) => {
        if (!j.ok) {
          setOrari([]);
          setErrore(j.reason || "Disponibilità non recuperata");
          return;
        }
        /*  ── ⚠️ GLI ORARI PRESI NON SI NASCONDONO PIÙ ──────────────────
            Richiesta del committente: «quando uno slot è prenotato deve essere
            contrassegnato in rosso, e deve restare selezionabile».
            Qui si tenevano SOLO i liberi: un orario preso spariva dall'elenco,
            e chi guardava non poteva distinguere «nessuno lavora a
            quell'ora» da «c'è già un cliente». Sono due cose diverse e si
            decide diversamente: sulla prima non si può fare niente, sulla
            seconda si può chiamare il collega, accorciare, o accavallare
            sapendo cosa si sta facendo.
            Adesso ci sono tutti; quelli presi sono rossi e dicono di chi sono
            e fino a quando — e restano premibili. */
        const tutti = j.slot ?? [];
        const presi = j.occupati ?? [];
        const chiusure = intervalliBloccati(blocchi, consultantId as string, data as string);
        //  Le chiusure del centro NON diventano rosse: lì non c'è nessun
        //  cliente da spostare, semplicemente il centro è chiuso. Restano
        //  tolte, con la riga che dice quante e perché.
        const dentroUnaChiusura = (ora: string) => {
          const inizio = minutiDaOra(ora);
          if (inizio === null) return true;
          const fine = inizio + durata;
          return chiusure.some((c) => inizio < c.fine && fine > c.inizio);
        };
        /*  ⚠️ IL ROSSO SEGUE LA DURATA DELLA PRENOTAZIONE, non il suo inizio.
            Una consulenza dalle 15:00 alle 16:30 tinge 15:00, 15:30 e 16:00 —
            e anche le 14:30, se quello che si sta fissando dura abbastanza da
            entrarci dentro. Alle 16:30 si torna liberi. */
        const chiTiene = (ora: string): { chi?: string; fine?: string } | undefined => {
          const inizio = minutiDaOra(ora);
          if (inizio === null) return undefined;
          const fine = inizio + durata;
          const dentro = presi.filter((o) => {
            const da = minutiDaOra(o.ora);
            const a = minutiDaOra(o.fine || "") ?? (da === null ? null : da + durata);
            return da !== null && a !== null && inizio < a && fine > da;
          });
          if (!dentro.length) return undefined;
          //  ⚠️ Il nome è di chi è arrivato prima, la fine è la PIÙ LONTANA:
          //   con tre persone dentro, «fino alle» deve dire quando la fascia
          //   torna davvero libera, non quando finisce la prima. È la stessa
          //   regola di `capienzaDellaFascia` in crm/booking-utils.
          const ordinati = [...dentro].sort(
            (a, b) => (minutiDaOra(a.ora) ?? 0) - (minutiDaOra(b.ora) ?? 0),
          );
          const finiMax = dentro.reduce((max, o) => {
            const da = minutiDaOra(o.ora) ?? 0;
            const a = minutiDaOra(o.fine || "") ?? da + durata;
            return a > max ? a : max;
          }, 0);
          const hh = `${String(Math.floor(finiMax / 60)).padStart(2, "0")}:${String(finiMax % 60).padStart(2, "0")}`;
          return { chi: ordinati[0]?.chi, fine: hh };
        };
        const capienza = Math.max(1, Number(j.capienza) || 3);
        const mostrati: SlotMostrato[] = tutti
          .filter((s) => !dentroUnaChiusura(s.ora))
          .map((s) => {
            //  Il nome di chi tiene la fascia serve sia quando è piena sia
            //  quando ha ancora posto: «2/3, c'è già Mario» è quello che fa
            //  decidere. Prima si cercava solo per gli slot non liberi.
            const suo = chiTiene(s.ora);
            return {
              ora: s.ora,
              libero: s.libero,
              chi: suo?.chi,
              fino: suo?.fine,
              presi: Number(s.presi) || 0,
              capienza: Number(s.capienza) || capienza,
            };
          });
        setOrari(mostrati);
        setToltiDaBlocchi(tutti.length - mostrati.length);
        setMotivo(j.motivo);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setOrari([]);
        setErrore("Disponibilità non recuperata");
      })
      .finally(() => {
        if (!ac.signal.aborted) setCaricamento(false);
      });

    return () => ac.abort();
  }, [consultantId, data, durata, pronto, ricarica]);

  const aggiorna = useCallback(() => setRicarica((n) => n + 1), []);

  if (!pronto) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Scegli consulente e data per vedere gli orari liberi.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Orari liberi ({durata} min)
          {!caricamento && orari.length > 0 && (
            <span className="font-normal normal-case tracking-normal">
              · {orari.filter((s) => s.libero).length} liberi su {orari.length}
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={aggiorna}
          disabled={caricamento}
          className="h-7 px-2 text-xs"
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", caricamento && "animate-spin")} />
          Aggiorna
        </Button>
      </div>

      {caricamento && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Controllo il calendario del consulente…
        </div>
      )}

      {!caricamento && errore && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {errore}. Riprova con "Aggiorna" oppure inserisci l'orario a mano.
        </div>
      )}

      {/* Un orario che sparisce senza spiegazione sembra un guasto: se è stato
          tolto da una chiusura, va detto. */}
      {!caricamento && !errore && toltiDaBlocchi > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
          <Ban className="h-3.5 w-3.5 mt-px shrink-0" />
          <span>
            {toltiDaBlocchi} {toltiDaBlocchi === 1 ? "orario tolto" : "orari tolti"} da un blocco
            impostato in «Disponibilità».
          </span>
        </div>
      )}

      {!caricamento && !errore && orari.length === 0 && (
        <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground flex items-start gap-2">
          <CalendarOff className="h-3.5 w-3.5 mt-px shrink-0" />
          <span>
            {giornoPassato
              ? "Data già passata: non ci sono orari da proporre. Scegli un giorno da oggi in avanti."
              : motivo === "giorno non lavorativo"
                ? "Il consulente non lavora in questa data. Prova un altro giorno o un altro consulente."
                : "Nessun orario in questa data: la giornata è fuori dalle fasce di lavoro o è bloccata. Prova un altro giorno o un altro consulente."}
          </span>
        </div>
      )}

      {/* Gli orari hanno lo stesso vestito di <TastoOra/> nella linea del giorno
          (src/crm/agenda/AgendaDaySheet.tsx): stesso gesto, stesso aspetto.
          Prima erano pastiglie verdi — ma "verde" nel CRM vuol dire trattativa
          vinta, e venti orari verdi in fila erano solo decorazione. Restano
          neutri: quello scelto è l'unico pieno, ed è l'unica cosa da vedere.
          Alti 40px perché si premono col pollice. */}
      {!caricamento && orari.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {orari.map((s) => {
              const scelto = oraSelezionata === s.ora;
              //  Chi lo tiene e fino a quando: è la frase che fa decidere se
              //  chiamare il collega o scegliere un altro orario.
              /*  ── ⚠️ IL CONTATORE, E QUANDO LA FASCIA SI CHIUDE ─────────
                  Richiesta del committente: «fino a 3 persone nella stessa ora
                  per consulente, con il contatore 1/3, 2/3, 3/3, e poi lo slot
                  non è più disponibile».
                  Quindi tre stati, non due: vuota (si sceglie e basta), con
                  qualcuno dentro ma con posto (si sceglie sapendo chi c'è
                  già), piena (non si sceglie più). */
              const pieno = s.presi >= s.capienza;
              const conta = s.presi > 0 ? `${s.presi}/${s.capienza}` : "";
              const perche = pieno
                ? `Fascia piena: ${s.presi} persone su ${s.capienza}${s.fino ? `, fino alle ${s.fino}` : ""}. Scegli un altro orario.`
                : s.presi > 0
                  ? `${s.presi} di ${s.capienza}${s.chi ? ` · c'è già ${s.chi}` : ""}${s.fino ? `, fino alle ${s.fino}` : ""}. C'è ancora posto.`
                  : undefined;
              return (
                <button
                  key={s.ora}
                  type="button"
                  onClick={() => !pieno && onScegli(s.ora)}
                  disabled={pieno && !scelto}
                  aria-pressed={scelto}
                  title={perche}
                  className={cn(
                    "flex h-10 flex-col items-center justify-center gap-0.5 rounded-lg border text-[12.5px] font-medium leading-none tabular-nums transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    scelto
                      ? "border-foreground bg-foreground text-background"
                      : pieno
                        ? /*  ⚠️ PIENA: qui il tasto si spegne davvero, ed è la
                              differenza con prima. Fino a due persone si poteva
                              premere perché il posto c'era; alla terza non c'è
                              più, e un tasto premibile prometterebbe un posto
                              che non esiste. */
                          "cursor-not-allowed border-destructive/40 bg-destructive/10 text-destructive opacity-70"
                        : s.presi > 0
                          ? //  C'è già qualcuno ma si può ancora entrare: ambra,
                            //  che non è né «libero» né «chiuso».
                            "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-border bg-card text-foreground hover:border-foreground/40 hover:bg-accent",
                  )}
                >
                  <span>{s.ora}</span>
                  {conta && (
                    <span className="text-[10px] font-semibold leading-none opacity-80">
                      {conta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/*  La legenda c'è solo quando serve davvero: se non c'è niente di
              rosso, spiegare il rosso è rumore. */}
          {orari.some((s) => s.presi > 0) && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-100" />
                Il contatore dice quante persone hai già in quella fascia: fino a{" "}
                {orari[0]?.capienza ?? 3} si può ancora fissare.
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm border border-destructive/40 bg-destructive/20" />
                Al numero pieno la fascia si chiude.
              </span>
            </p>
          )}
        </>
      )}

      {/* L'orario già fissato può non comparire più fra i liberi (per esempio se
          nel frattempo qualcun altro l'ha preso): va comunque mostrato,
          altrimenti sembra che la scheda abbia perso l'appuntamento. */}
      {!caricamento && oraSelezionata && !orari.some((s) => s.ora === oraSelezionata) && (
        <p className="text-[11px] text-muted-foreground">
          Orario attualmente impostato:{" "}
          <span className="font-semibold text-foreground">{oraSelezionata}</span> — non risulta fra
          quelli liberi.
        </p>
      )}
    </div>
  );
}
