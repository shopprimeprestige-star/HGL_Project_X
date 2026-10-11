/** ── COME RISPONDONO AL FORM ───────────────────────────────────────────────
 *
 *  A COSA SERVE
 *  Il resto della scheda «Fonti» conta le SCHEDE del CRM. Qui si contano le
 *  RISPOSTE lasciate sul modulo della landing (`public_leads`), e la domanda è
 *  una sola: quale risposta compra. Se «subito, voglio risolvere» chiude al
 *  doppio di «sto valutando», la domanda del modulo diventa il filtro con cui
 *  si decide chi richiamare per primo — che è l'unico modo in cui un numero di
 *  qualità cambia una giornata di lavoro.
 *
 *  I TOTALI NON COINCIDONO CON QUELLI IN CIMA, ED È GIUSTO COSÌ: sono due
 *  popolazioni diverse. Chi compila il modulo e non viene mai aperto come
 *  scheda esiste solo qui; chi arriva per telefono o dal passaparola esiste
 *  solo là. Va detto in pagina, altrimenti sembra che uno dei due conteggi sia
 *  sbagliato e si smette di credere a entrambi.
 *
 *  ── COSA È STATO TOLTO, E PERCHÉ ──────────────────────────────────────────
 *  Era la scheda «CVR Generale»: un pannello con periodo proprio (7/14/30/90),
 *  quattro riquadri verdi e quattro tabelle in fila.
 *   · IL PERIODO PROPRIO. Non c'è più: lo riceve dalla pagina, filtro compreso.
 *   · LE QUATTRO TABELLE sono una sola con il raggruppamento a interruttore.
 *   · IL CPL PER SEGMENTO. Valeva «spesa TOTALE del periodo ÷ lead di QUEL
 *     segmento»: ogni riga si prendeva addosso l'intero budget. Il costo per
 *     lead vero, uno solo, sta nella scheda «Ritorno».
 *   · L'ABBANDONO PER FASCIA ORARIA, con tutto il raggruppamento «ora del
 *     giorno». Erano l'unico blocco che leggeva `lp_events`, e nessuna delle
 *     due cose cambiava una decisione: l'ora in cui il modulo viene compilato
 *     non si sceglie, e l'abbandono ignorava il filtro per canale della sua
 *     stessa tabella — chi se ne va senza lasciare il modulo non lascia
 *     nemmeno da dove è arrivato, quindi quella colonna restava sul traffico
 *     intero mentre le altre erano filtrate. Due numeri accanto calcolati su
 *     popolazioni diverse, senza dirlo.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCRM } from "@/crm/CRMContext";
import { cn } from "@/lib/utils";
import { Scheda, Segmento, VuotoRiga } from "@/crm/ui";
import { leadIsConverted } from "@/crm/lead-analytics";
import type { FiltroPeriodo, Intervallo } from "@/crm/kpi-calcoli";
import { estremiPeriodo } from "@/crm/kpi/finestra";
import { VOLUME_MINIMO_LPS } from "./soglie";
import {
  aggregatePain,
  aggregatePortatore,
  aggregateUrgenza,
  buildCrmConvertedIndex,
  filterByChannel,
  isPublicLeadConverted,
  type Channel,
  type PublicLeadLite,
  type SegmentRow,
} from "./cvr-generale-utils";

/* ═══════════════════════════════════════════════════════════════════════════
   COME SI RAGGRUPPANO LE RISPOSTE
   ═════════════════════════════════════════════════════════════════════════ */

type Raggruppamento = "urgenza" | "dolore" | "portatore";

//  L'ordine è quello di quanto la risposta cambia una decisione: l'urgenza
//  dichiarata è la prima cosa che si guarda per decidere chi richiamare.
const RAGGRUPPAMENTI: { v: Raggruppamento; t: string; nota: string }[] = [
  {
    v: "urgenza",
    t: "Quando vuole partire",
    nota: "La risposta sui tempi: di solito «subito» ed «entro un mese» chiudono il doppio",
  },
  {
    v: "dolore",
    t: "Quanto gli pesa",
    nota: "Il punteggio da 1 a 10 dichiarato nel modulo, raccolto in tre fasce",
  },
  {
    v: "portatore",
    t: "Già portatore",
    nota: "Chi ha già un impianto sa cosa compra: si vede se converte diversamente",
  },
];

/** Percentuali a un decimale: sotto lo zero virgola la cifra in più è rumore,
 *  sopra si perde la differenza fra 12% e 12,4% su volumi piccoli. */
const pct = (n: number) => `${n.toFixed(1)}%`;

/* ═══════════════════════════════════════════════════════════════════════════
   LA SCHEDA
   ═════════════════════════════════════════════════════════════════════════ */

interface Props {
  /** ── PERCHÉ IL FILTRO E NON DUE DATE ────────────────────────────────────
   *  Le date per interrogare il database si ricavano qui dall'intervallo, con
   *  la stessa funzione che usa il resto della pagina; il taglio vero lo fa
   *  questo filtro, lo stesso oggetto che governa i numeri in cima. Senza,
   *  «ieri» qui mostrerebbe la giornata intera mentre là ne mostra solo la coda
   *  (è la regola del CRM aziendale, non un errore) e la stessa pagina direbbe
   *  due numeri diversi per la stessa parola. */
  dentro: FiltroPeriodo;
  /** Il periodo scelto in cima alla pagina: serve solo a ricavare gli estremi
   *  da chiedere al database. */
  intervallo: Intervallo;
  /** Il canale scelto nella tabella qui sopra: «all» non filtra niente. */
  canale: Channel;
}

export function RisposteFormScheda({ dentro, intervallo, canale }: Props) {
  const { leads: leadCrm } = useCRM();
  const [risposte, setRisposte] = useState<PublicLeadLite[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [gruppo, setGruppo] = useState<Raggruppamento>("urgenza");

  const estremi = useMemo(() => estremiPeriodo(intervallo), [intervallo]);

  /* ── LETTURA ─────────────────────────────────────────────────────────────
     Si scarica la finestra per estremi (è quello che il database sa fare) e la
     si rifinisce dopo con `dentro`. Le dipendenze sono le due DATE e non il
     filtro: il filtro è una funzione nuova a ogni cambio di periodo e metterlo
     qui significherebbe riscaricare tutto anche quando la finestra è la
     stessa. */
  useEffect(() => {
    let vivo = true;
    setCaricando(true);
    const daISO = new Date(`${estremi.da}T00:00:00`).toISOString();
    const aISO = new Date(`${estremi.a}T23:59:59`).toISOString();
    supabase
      .from("public_leads")
      .select(
        "id, created_at, status, email, telefono, portatore, disagio_score, urgenza, utm_source, fbclid, ttclid",
      )
      .gte("created_at", daISO)
      .lte("created_at", aISO)
      .limit(10000)
      //  Due funzioni e non un `.catch`: la richiesta di Supabase è un
      //  «thenable», non una Promise vera, e `.catch` su di lei non esiste.
      //  La seconda serve perché una lettura caduta (rete assente, sessione
      //  scaduta) non lasci la scheda a «Leggo le risposte del modulo…» per
      //  sempre: si smette di girare e si mostra il vuoto, che è una cosa
      //  diversa dall'attesa infinita.
      .then(
        (res) => {
          if (!vivo) return;
          setRisposte((res.data ?? []) as PublicLeadLite[]);
          setCaricando(false);
        },
        () => {
          if (!vivo) return;
          setRisposte([]);
          setCaricando(false);
        },
      );
    return () => {
      vivo = false;
    };
  }, [estremi]);

  const nelPeriodo = useMemo(
    () =>
      filterByChannel(
        risposte.filter((r) => dentro(r.created_at)),
        canale,
      ),
    [risposte, dentro, canale],
  );

  /** ── CHI HA COMPRATO ────────────────────────────────────────────────────
   *  Una risposta del modulo conta come cliente se lo dice il suo stato oppure
   *  se, per email o telefono, corrisponde a una scheda CRM chiusa. Il secondo
   *  caso è la maggioranza: il modulo non sa mai come è finita, lo sa la
   *  scheda. */
  const indiceClienti = useMemo(
    () =>
      buildCrmConvertedIndex(
        leadCrm.map((l) => ({
          email: l.data.email ?? null,
          telefono: l.data.telefono ?? null,
          converted: leadIsConverted(l),
        })),
      ),
    [leadCrm],
  );

  const clienti = useMemo(
    () => nelPeriodo.filter((r) => isPublicLeadConverted(r, indiceClienti)).length,
    [nelPeriodo, indiceClienti],
  );

  /** Le righe della tabella. `totalSpend: 0` perché il costo per lead per
   *  segmento non si mostra più: vedi l'intestazione del file. */
  const righe = useMemo<SegmentRow[]>(() => {
    const argomenti = { leads: nelPeriodo, crmIndex: indiceClienti, totalSpend: 0 };
    if (gruppo === "portatore") return aggregatePortatore(argomenti);
    if (gruppo === "dolore") return aggregatePain(argomenti);
    return aggregateUrgenza(argomenti);
  }, [gruppo, nelPeriodo, indiceClienti]);

  //  Una riga a zero risposte non dice niente e allunga la tabella.
  const visibili = useMemo(() => righe.filter((r) => r.leads > 0), [righe]);

  /** ── LA RIGA CHE CONVERTE DI PIÙ ────────────────────────────────────────
   *  Si segna con il grassetto, non con il verde: in una tabella di sette righe
   *  un colore acceso su una cella sposta l'occhio prima ancora che si sia
   *  letto cosa dice la colonna. Con una riga sola sopra la soglia non esiste
   *  un «migliore», esiste l'unica misurata. */
  const migliore = useMemo(() => {
    const misurabili = visibili.filter((r) => r.leads >= VOLUME_MINIMO_LPS);
    if (misurabili.length < 2) return null;
    return misurabili.reduce((m, r) => (r.cvrPct > m.cvrPct ? r : m)).key;
  }, [visibili]);

  const notaGruppo = RAGGRUPPAMENTI.find((r) => r.v === gruppo)?.nota;

  return (
    <Scheda
      titolo="Come rispondono al form"
      nota={
        caricando
          ? "Leggo le risposte del modulo…"
          : `${nelPeriodo.length} ${nelPeriodo.length === 1 ? "risposta" : "risposte"} nel periodo · ${clienti} ${clienti === 1 ? "diventata cliente" : "diventate clienti"}`
      }
      azioni={
        <div className="flex flex-wrap gap-1.5">
          {RAGGRUPPAMENTI.map(({ v, t }) => (
            <Segmento key={v} attivo={gruppo === v} onClick={() => setGruppo(v)}>
              {t}
            </Segmento>
          ))}
        </div>
      }
      senzaPadding
    >
      {caricando ? (
        <p className="flex items-center justify-center gap-2 px-3 py-8 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Leggo le risposte del modulo…
        </p>
      ) : visibili.length === 0 ? (
        <VuotoRiga testo="Nessuna risposta al modulo nel periodo scelto." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                {/*  L'intestazione è la domanda scelta: con «Risposta» fisso, la
                    colonna diceva «risposta sto valutando». */}
                <th className="px-3 py-2 font-medium">
                  {RAGGRUPPAMENTI.find((r) => r.v === gruppo)?.t}
                </th>
                <th className="px-3 py-2 text-right font-medium">Risposte</th>
                <th className="px-3 py-2 text-right font-medium">Clienti</th>
                <th className="px-3 py-2 text-right font-medium">Conversione</th>
              </tr>
            </thead>
            <tbody>
              {visibili.map((r) => {
                const misurabile = r.leads >= VOLUME_MINIMO_LPS;
                return (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    <td className="max-w-[280px] truncate px-3 py-2 font-medium" title={r.label}>
                      {r.label}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.leads}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.converted}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        r.key === migliore && "font-semibold",
                        !misurabile && "text-muted-foreground",
                      )}
                      title={
                        misurabile
                          ? `${r.converted} su ${r.leads} risposte${r.key === migliore ? " · è il gruppo che converte di più nel periodo" : ""}`
                          : `Meno di ${VOLUME_MINIMO_LPS} risposte: la percentuale non è misurata`
                      }
                    >
                      {misurabile ? `${pct(r.cvrPct)} · ${r.converted} su ${r.leads}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <p>{notaGruppo}</p>
        <p>
          Qui si contano le <strong>risposte al modulo</strong> della landing, non le schede del
          CRM: i totali non coincidono con «Lead entrati» qui sopra e non devono. Una risposta conta
          come cliente se lo dice il suo stato oppure se per email o telefono corrisponde a una
          scheda già chiusa. La percentuale compare da {VOLUME_MINIMO_LPS} risposte in su: sotto,
          una sola persona la sposta di venti punti.
        </p>
      </div>
    </Scheda>
  );
}
