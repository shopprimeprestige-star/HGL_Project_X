import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { oggiIso } from "@/crm/ui";
import type { Lead, LeadStatus } from "../types";
import { AZIONI_MEET, CHIUSURA_MS, fraseConferma, type AzioneMeet } from "./azioni-meet";
import type { ProssimoMeet } from "./prossimo-meet";
import type { ChatItem } from "./tipi";

/** ── «NO SHOW» E «DA SPOSTARE» SOTTO LA BARRA DEL MEET (31/10/2026) ──────────
 *  Richiesta del titolare: dal promemoria del primo meet, due pulsanti; cambiato lo stato il meet
 *  esce dalla barra e passa il successivo di oggi. La barra è BarraProssimoMeet, che non cambia:
 *  questa riga le sta sotto, nello stesso contenitore incollato in cima (ElencoChat), stessi toni
 *  viola; i due pulsanti sono "di contorno" perché l'unico tasto pieno della barra resta «Invia invito».
 *  Primo tocco: la riga diventa una conferma (la frase dipende dallo stato: azioni-meet.ts) con
 *  «Annulla» già selezionato, Esc che annulla e chiusura da sola dopo 8 secondi. «Conferma» chiama
 *  `onCambiaStato` (= `cambiaStatoLead`: stesse finestre, stesso toast «Annulla» del resto del CRM).
 *  Il meet esce da solo perché la barra si ricalcola sulla lista aggiornata (ElencoChat).
 *  Compare solo se la scheda c'è (il meet è già un appuntamento: lo garantisce `prossimoMeet`).
 *  ⚠️ NON si filtra con `statiSelezionabili`: «Da riprogrammare» è un ESITO, non una voce del menu
 *  stato (`STATI_TRATTATIVA` non lo contiene), e lo filtrerebbe sempre. È lo stesso gesto dei pulsanti
 *  d'esito dell'agenda e del riquadro «Adesso» (`ESITI`, crm/ui): senza permesso in più. */
const TASTO =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-50 disabled:cursor-wait disabled:opacity-70";
const TASTO_CONTORNO = `${TASTO} border border-violet-400 bg-white text-violet-900 hover:bg-violet-100 active:bg-violet-200`;
const TASTO_PIENO = `${TASTO} bg-violet-700 text-white hover:bg-violet-800 active:bg-violet-900`;

const ICONA: Record<AzioneMeet["stato"], typeof UserX> = {
  no_show: UserX,
  da_spostare: CalendarClock,
};

export function AzioniMeet({
  meet,
  onCambiaStato,
}: {
  meet: ProssimoMeet<ChatItem>;
  onCambiaStato: (lead: Lead, stato: LeadStatus) => Promise<void>;
}) {
  const lead = meet.chat.lead;
  const [scelta, setScelta] = useState<AzioneMeet | null>(null);
  const [inVolo, setInVolo] = useState(false);
  const idFrase = useId();
  const gruppoRef = useRef<HTMLDivElement>(null);
  const annullaRef = useRef<HTMLButtonElement>(null);
  const tastiRef = useRef<Partial<Record<AzioneMeet["stato"], HTMLButtonElement | null>>>({});
  //  Chi usa la tastiera ritrova il focus sul pulsante da cui era partito, non sul vuoto.
  const riprendiFocus = useRef<AzioneMeet["stato"] | null>(null);

  const chiudi = () => {
    if (scelta && gruppoRef.current?.contains(document.activeElement)) riprendiFocus.current = scelta.stato;
    setScelta(null);
  };

  //  Si richiude da sola; in volo no (il salvataggio decide).
  useEffect(() => {
    if (!scelta || inVolo) return;
    const t = setTimeout(chiudi, CHIUSURA_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chiudi` legge solo `scelta`, già nelle dipendenze
  }, [scelta, inVolo]);

  //  «Annulla» preselezionato: il tasto più sicuro è quello che si preme per sbaglio.
  useEffect(() => {
    if (scelta) annullaRef.current?.focus();
  }, [scelta]);

  useEffect(() => {
    if (scelta || !riprendiFocus.current) return;
    tastiRef.current[riprendiFocus.current]?.focus();
    riprendiFocus.current = null;
  }, [scelta]);

  if (!lead) return null;

  const conferma = async () => {
    if (!scelta || inVolo) return;
    setInVolo(true);
    try {
      await onCambiaStato(lead, scelta.stato);
    } catch (e) {
      //  `cambiaStatoLead` avvisa già da sé; qui solo il caso che lanci: il meet resta, si riprova.
      toast.error(e instanceof Error ? e.message : "Stato NON salvato");
    } finally {
      riprendiFocus.current = scelta.stato;
      setInVolo(false);
      setScelta(null);
    }
  };

  if (scelta) {
    return (
      <div
        ref={gruppoRef}
        role="group"
        aria-label={`Conferma: ${scelta.etichetta}`}
        aria-describedby={idFrase}
        aria-busy={inVolo}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !inVolo) {
            e.stopPropagation();
            chiudi();
          }
        }}
        className="border-b border-violet-300 bg-violet-50 px-3 py-2"
      >
        <p id={idFrase} className="pb-2 text-[13px] leading-[18px] text-violet-950 md:text-[12px]">
          {fraseConferma(scelta.stato, lead.data ?? {}, oggiIso(new Date()))}
        </p>
        <div className="flex gap-2">
          <button
            ref={annullaRef}
            type="button"
            disabled={inVolo}
            onClick={chiudi}
            className={TASTO_CONTORNO}
          >
            Annulla
          </button>
          <button type="button" disabled={inVolo} onClick={() => void conferma()} className={TASTO_PIENO}>
            {inVolo && <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />}
            {inVolo ? "Salvo…" : "Conferma"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Se il meet non si fa"
      className="flex gap-2 border-b border-violet-300 bg-violet-50 px-3 py-2"
    >
      {AZIONI_MEET.map((a) => {
        const Icona = ICONA[a.stato];
        return (
          <button
            key={a.stato}
            ref={(el) => {
              tastiRef.current[a.stato] = el;
            }}
            type="button"
            onClick={() => setScelta(a)}
            className={TASTO_CONTORNO}
          >
            <Icona aria-hidden="true" className="h-4 w-4 shrink-0" />
            {a.etichetta}
          </button>
        );
      })}
    </div>
  );
}
