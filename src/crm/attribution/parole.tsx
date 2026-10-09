/** ─────────────────────────────────────────────────────────────────────────
 *  parole.tsx — IL VOCABOLARIO DELL'ATTRIBUZIONE, IN ITALIANO
 *
 *  PERCHÉ ESISTE
 *  Chi usa questo CRM vende impianti di capelli, non fa analisi dei dati. La
 *  pagina però parlava un'altra lingua: «first-click», «assist», «touches»,
 *  «Direct», «CR». Ognuna di quelle parole compariva in tre o quattro punti
 *  (titolo del blocco, intestazione di colonna, nodo del diagramma, nota a
 *  piè di tabella) e ogni punto se la traduceva a modo suo — quando la
 *  traduceva.
 *
 *  Qui il vocabolario è UNO. La parola che si legge nella colonna è la stessa
 *  che si legge nel diagramma ed è la stessa che la legenda spiega: chi non
 *  capisce un termine lo ritrova identico nella legenda, senza doverlo
 *  indovinare.
 *
 *  LA REGOLA DI SCRITTURA
 *  Ogni voce dice COSA SUCCEDE alla persona, non che metrica è. «Ultimo
 *  annuncio» seguito da «quello visto subito prima di lasciare il numero» si
 *  capisce senza avere mai aperto un manuale di pubblicità; «last click» no.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** I tre momenti del percorso, più il caso «non è passato da un annuncio».
 *  Sono le uniche chiavi ammesse: il diagramma, la classifica e il pannello di
 *  dettaglio usano tutti queste. */
export type RuoloAnnuncio = "primo" | "mezzo" | "ultimo";

/** «tutti» non è un momento del percorso: è la domanda che si fa premendo il
 *  nome di un annuncio nella classifica — «chi l'ha visto, in qualunque
 *  momento». Serve una chiave sua perché il pannello di dettaglio deve poter
 *  scrivere un titolo onesto anche in quel caso. */
export type RuoloVista = RuoloAnnuncio | "tutti";

interface Voce {
  /** come si chiama sullo schermo: titoli, colonne, nodi del diagramma */
  titolo: string;
  /** versione corta per le intestazioni di tabella, dove lo spazio è poco */
  breve: string;
  /**  come si chiama quando è UNA tappa nel percorso di UNA persona: lì
   *   «Annunci di mezzo» al plurale suonerebbe sbagliato, ma la parola deve
   *   restare imparentata con quella della pagina di attribuzione. */
  tappa: string;
  /** la frase che lo spiega a chi non fa marketing */
  spiega: string;
}

export const PAROLE: Record<RuoloAnnuncio, Voce> = {
  primo: {
    titolo: "Primo annuncio",
    breve: "Ci ha fatto conoscere",
    tappa: "Il primo che ha visto",
    spiega:
      "L'annuncio con cui la persona ci ha scoperti: il primo che ha visto, spesso settimane prima di scriverci.",
  },
  mezzo: {
    titolo: "Annunci di mezzo",
    breve: "Ha aiutato",
    tappa: "Visto nel mezzo del percorso",
    spiega:
      "Visti dopo il primo e prima di lasciare il numero. Da soli non chiudono niente, ma tengono viva l'attenzione mentre la persona ci pensa.",
  },
  ultimo: {
    titolo: "Ultimo annuncio",
    breve: "Ha portato al contatto",
    tappa: "L'ultimo prima di lasciare il numero",
    spiega:
      "Quello visto subito prima di lasciare il numero: è l'annuncio dopo il quale la persona si è decisa a farsi sentire.",
  },
};

/** Il titolo da scrivere in cima al pannello «chi ha visto questo annuncio».
 *  Deriva da PAROLE per costruzione: se un giorno «Annunci di mezzo» diventa
 *  un'altra frase, il pannello non può restare indietro. */
export const TITOLO_RUOLO: Record<RuoloVista, string> = {
  primo: PAROLE.primo.titolo,
  mezzo: PAROLE.mezzo.titolo,
  ultimo: PAROLE.ultimo.titolo,
  tutti: "In qualunque momento del percorso",
};

/** I due raggruppamenti del diagramma. Stanno qui e non nel grafico perché la
 *  stessa etichetta compare anche nell'elenco e nel pannello di dettaglio: se
 *  vive in un posto solo non può succedere che il diagramma dica «Direct» e
 *  l'elenco «Diretto». */
export const NESSUN_ANNUNCIO = "Nessun annuncio";
export const ALTRI_ANNUNCI = "Altri annunci";

export const SPIEGA_NESSUN_ANNUNCIO =
  "Persone arrivate senza passare da una pubblicità: passaparola, ricerca su Google, un link ricevuto da un amico.";
export const SPIEGA_ALTRI_ANNUNCI =
  "Tutti gli annunci fuori dai primi in classifica, messi insieme per non riempire lo schermo di righe da una persona ciascuna.";

/** ── LA LEGENDA ───────────────────────────────────────────────────────────
 *  Sta in cima alla pagina, aperta la prima volta e richiudibile: chi la legge
 *  una volta non ha bisogno di rileggerla ogni giorno, ma chi apre la pagina
 *  una volta al mese sì. La scelta resta salvata nel browser, come la vista a
 *  colonne della pipeline. */
export function LegendaAttribuzione({ className }: { className?: string }) {
  const [aperta, setAperta] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("crm-attrib-legenda") !== "chiusa";
  });
  const cambia = () => {
    setAperta((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("crm-attrib-legenda", next ? "aperta" : "chiusa");
      }
      return next;
    });
  };

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <button
        type="button"
        onClick={cambia}
        aria-expanded={aperta}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-tight">
            Cosa vogliono dire queste parole
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Le cinque parole che tornano in tutta la pagina
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aperta && "rotate-180",
          )}
        />
      </button>
      {aperta && (
        <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
          <VoceLegenda titolo={PAROLE.primo.titolo} testo={PAROLE.primo.spiega} />
          <VoceLegenda titolo={PAROLE.mezzo.titolo} testo={PAROLE.mezzo.spiega} />
          <VoceLegenda titolo={PAROLE.ultimo.titolo} testo={PAROLE.ultimo.spiega} />
          <VoceLegenda titolo={NESSUN_ANNUNCIO} testo={SPIEGA_NESSUN_ANNUNCIO} />
          {/*  «Altri annunci» compare nel diagramma e nel pannello di
               dettaglio: se non è spiegato qui, resta l'unica parola della
               pagina che si può solo indovinare. */}
          <VoceLegenda titolo={ALTRI_ANNUNCI} testo={SPIEGA_ALTRI_ANNUNCI} />
        </div>
      )}
    </section>
  );
}

function VoceLegenda({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[12px] font-semibold">{titolo}</div>
      <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{testo}</p>
    </div>
  );
}
