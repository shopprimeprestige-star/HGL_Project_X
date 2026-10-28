/** Estratto da `src/routes/CRM.importa.tsx` (commessa 2026-10-28-lead-importati-semplice,
 *  compito T3): la ricerca in tutto l'archivio.
 *  Solo uno spostamento: nessuna riga di logica è cambiata. */
import { useMemo, useState, type RefObject } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Lead, type LeadData } from "@/crm/types";
import {
  CLASSE_BADGE_STATO,
  classiStato,
  etichettaStato,
  //  Le due funzioni con cui tutto il CRM confronta quello che si scrive in un
  //  campo di ricerca con quello che c'è in archivio: `normalizza` toglie
  //  accenti e maiuscole, `soloCifre` riduce un telefono alle sue cifre. Fanno
  //  lo stesso lavoro di `ultimeCifre` in crm/MeetGiornalieri — che però taglia
  //  alle ultime cinque, perché lì serve a MOSTRARE mezzo numero e qui a
  //  CERCARLO tutto — e stanno già in crm/ui, che questa pagina importa.
  normalizza,
  soloCifre,
  type Scorciatoia,
} from "@/crm/ui";
import { eSaltato } from "@/crm/importa/saltati";

/** Quanti risultati si mostrano. Chi cerca sa già chi vuole — sta guardando il
 *  nome sul display del telefono che ha appena squillato: sei righe sono più
 *  che sufficienti a riconoscerlo, e oltre questa misura la ricerca diventa
 *  l'elenco che sta in /CRM/avanzamento. */
const RISULTATI_VISIBILI = 6;

/** Sotto tre cifre non è una ricerca per numero: un «33» da solo tirerebbe su
 *  mezzo archivio mentre si sta ancora scrivendo. */
const CIFRE_MINIME = 3;

/** Sotto questa lunghezza un campo «telefono» non è un numero, è quello che
 *  resta di un'importazione storta — un prefisso rimasto solo, uno zero. Serve
 *  al confronto all'incontrario qui sotto: senza questa guardia quel residuo
 *  combacerebbe con qualunque numero lungo che se lo porta dentro. */
const TELEFONO_PLAUSIBILE = 7;

/** ── DUE NUMERI COMBACIANO SE UNO STA DENTRO L'ALTRO, NEI DUE VERSI ────────
 *  ⚠️ Il verso che mancava era proprio quello che serve. Chi richiama lo si
 *  cerca copiando quello che il display del telefono ha appena scritto, e in
 *  Italia il display scrive «+39 333 1234567»: cercare `393331234567` dentro un
 *  archivio dove quel contatto è salvato come `333 1234567` non trovava niente,
 *  cioè falliva nel caso esatto per cui la ricerca è stata chiesta — e falliva
 *  in silenzio, dicendo «nessuno» di una persona che in archivio c'è.
 *  L'altro verso (il prefisso ce l'ha l'archivio e non chi cerca) funzionava
 *  già. Due `includes` invece di uno, e i sei modi di scrivere un numero
 *  smettono di contare. */
function numeroCombacia(inArchivio: string | null | undefined, cercate: string): boolean {
  const suo = soloCifre(inArchivio);
  if (suo.length < CIFRE_MINIME || cercate.length < CIFRE_MINIME) return false;
  return suo.includes(cercate) || (suo.length >= TELEFONO_PLAUSIBILE && cercate.includes(suo));
}

/** ── LA RICERCA ────────────────────────────────────────────────────────────
 *  Serve a UN caso, frequente e sempre lo stesso: il cliente RICHIAMA. Il
 *  telefono squilla mentre si sta chiamando qualcun altro, e quella persona va
 *  trovata e messa davanti in due secondi.
 *
 *  ⚠️ CERCA IN TUTTO L'ARCHIVIO, NON NELLA CODA. È la cosa più importante di
 *  questo pezzo. Chi richiama quasi sempre NON è in coda: è quello a cui hai
 *  segnato «non risponde» venti minuti fa, o quello con l'appuntamento fissato
 *  che vuole spostarlo. Una ricerca che guarda solo la coda fallisce
 *  esattamente nel caso per cui è stata chiesta, e fallisce in silenzio — dice
 *  «nessun risultato» di una persona che in archivio c'è.
 *
 *  Il numero si confronta a cifre nude: in archivio i telefoni arrivano dagli
 *  import scritti in sei modi diversi (+39, 0039, spazi, punti), e chi legge il
 *  display ne copia un settimo. Tre cifre sono il minimo perché un «33» da solo
 *  restituirebbe mezzo archivio. */
export function RicercaContatto({
  leads,
  inCoda,
  campoRef,
  onScegli,
}: {
  leads: Lead[];
  /** gli id che stanno nella coda di oggi: il risultato lo dice, perché
   *  sceglierne uno che non c'è porta a una scheda diversa da quella attesa */
  inCoda: Set<string>;
  /** il campo lo mette a fuoco la scorciatoia «/» della pagina */
  campoRef: RefObject<HTMLInputElement | null>;
  onScegli: (l: Lead) => void;
}) {
  const [q, setQ] = useState("");

  /** ⚠️ La soglia («da qui in poi è una ricerca») e i risultati escono dallo
   *  STESSO calcolo. Tenerli separati — un `if` qui per filtrare e un altro giù
   *  per decidere se mostrare il riquadro — vuol dire che il giorno in cui una
   *  delle due cambia compare un riquadro vuoto, o peggio un riquadro che dice
   *  «nessuno» mentre i risultati ci sono. */
  const { attiva, righe } = useMemo(() => {
    const testo = normalizza(q).trim();
    const cifre = soloCifre(q);
    //  Sotto questa soglia non è una ricerca: è l'archivio intero che lampeggia
    //  sotto le dita mentre si scrive la prima lettera.
    if (testo.length < 2 && cifre.length < CIFRE_MINIME)
      return { attiva: false, righe: [] as Lead[] };
    const trovati = (leads ?? []).filter((l) => {
      const d = l?.data;
      if (!d) return false;
      if (numeroCombacia(d.telefono, cifre)) return true;
      return testo.length >= 2 && normalizza(`${d.nome || ""} ${d.cognome || ""}`).includes(testo);
    });
    //  Chi è già in coda viene prima: a parità di nome è quello che si sta
    //  lavorando oggi. Il resto dell'ordine resta quello dell'archivio.
    return {
      attiva: true,
      righe: trovati.sort((a, b) => Number(inCoda.has(b.id)) - Number(inCoda.has(a.id))),
    };
  }, [q, leads, inCoda]);

  /** Scelto: va davanti, il campo si svuota e si spegne. Il riquadro dei
   *  risultati non ha un suo «chiudi» perché non gli serve: esiste finché c'è
   *  qualcosa di scritto, e le tre strade per non avere più niente di scritto —
   *  sceglierne uno, la ✕, Esc — passano tutte da `setQ("")`, come il clic
   *  fuori (vedi l'`onBlur` del riquadro qui sotto). */
  const scegli = (l: Lead) => {
    onScegli(l);
    setQ("");
    campoRef.current?.blur();
  };

  return (
    <div
      className="w-full"
      //  ── IL CLIC FUORI CHIUDE ────────────────────────────────────────────
      //   ⚠️ I risultati galleggiano SOPRA la pagina (z-30) e vivevano finché
      //   c'era qualcosa di scritto: bastava scrivere due lettere e andare a
      //   premere «Chiama» perché restassero lì a coprire il nome e il tasto
      //   «Apri scheda» di chi si sta chiamando, senza un gesto ovvio per farli
      //   sparire (c'erano la ✕ e Esc, ma le dita provano prima il clic fuori).
      //   `onBlur` su un contenitore in React è `focusout`, che sale dai figli:
      //   se il fuoco è finito FUORI da questo riquadro la ricerca si svuota, e
      //   svuotandosi si chiude da sola. Un solo modo di sparire, quello di
      //   prima.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setQ("");
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={campoRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          //  Due tasti soli, e sono quelli che le dita premono da sole:
          //  Invio prende il primo risultato — il caso normale è che ce ne sia
          //  uno — ed Esc svuota. Esc arriva anche a `useScorciatoie`, che poi
          //  toglie il fuoco dal campo: le due cose insieme sono esattamente
          //  «lascia perdere, torna alla coda».
          onKeyDown={(e) => {
            if (e.key === "Enter" && righe[0]) {
              e.preventDefault();
              scegli(righe[0]);
            }
            if (e.key === "Escape") setQ("");
          }}
          //  Corto di proposito: con quello lungo il campo tagliava le ultime parole.
          placeholder="Ha richiamato? Nome o numero"
          title="Scorciatoia: premi / per scrivere qui"
          aria-label="Cerca un contatto in tutto l'archivio"
          className="h-11 pl-8 pr-11 text-[13px] md:h-9 md:pr-8"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Cancella la ricerca"
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:right-1.5 md:h-6 md:w-6"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {attiva && (
        <div className="relative">
          {/*  I risultati galleggiano sopra la pagina invece di spingerla in
              giù: se aprissero spazio, il tasto Chiama scenderebbe di mezzo
              schermo a ogni lettera scritta. */}
          <div
            //  ⚠️ Premendo qui dentro il fuoco NON si sposta: se si spostasse,
            //   l'`onBlur` del riquadro svuoterebbe la ricerca e smonterebbe
            //   questa riga PRIMA che il clic le arrivi sopra. Su Safari e
            //   Firefox un pulsante premuto col mouse non prende nemmeno il
            //   fuoco, quindi lì il risultato scelto si perderebbe sempre — il
            //   guasto classico di ogni elenco che si apre sotto un campo.
            //   Il fuoco resta nel campo, il clic arriva, e a chiudere ci pensa
            //   `scegli` come prima.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            {righe.length === 0 ? (
              //  Il silenzio non è una risposta: si dice che non c'è e si dice
              //  come si cerca, perché il dubbio vero è «l'avrò scritto giusto?».
              <p className="px-3 py-2.5 text-[12px] text-muted-foreground">
                Nessuno con «{q.trim()}». Prova col cognome, o con le ultime cifre del numero.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {righe.slice(0, RISULTATI_VISIBILI).map((l) => {
                  const d = l.data ?? ({} as LeadData);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => scegli(l)}
                        className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {`${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome"}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted-foreground">
                            {d.telefono || "senza telefono"}
                            {/*  Tre risposte e non due: «non è in coda» su una
                                scheda messa da parte è vero e inutile: non dice
                                che c'è un modo di rimetterla dentro, e chi
                                cerca resta a chiedersi perché non la trova. */}
                            {inCoda.has(l.id)
                              ? " · in coda"
                              : eSaltato(l)
                                ? " · messo da parte"
                                : " · non è in coda"}
                          </span>
                        </span>
                        <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
                          {etichettaStato(d.stato)}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
                {righe.length > RISULTATI_VISIBILI && (
                  <li className="px-3 py-1.5 text-[11.5px] text-muted-foreground">
                    … e altri {righe.length - RISULTATI_VISIBILI}. Scrivi qualche lettera in più.
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
