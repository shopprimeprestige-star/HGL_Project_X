/** ── IL TASTO CHE SCRIVE SU WHATSAPP, E IL SUO INTERRUTTORE ────────────────
 *
 *  Un tocco scrive. TENENDOLO PREMUTO si accende — diventa verde chiaro — e da
 *  quel momento il messaggio si porta dietro il link ai nostri lavori;
 *  tenendolo premuto di nuovo si spegne e torna il messaggio senza link.
 *
 *  ── ⚠️ PERCHÉ NON UNA FINESTRA CHE CHIEDE ────────────────────────────────
 *  C'era, e chiedeva «allego i lavori?» a ogni messaggio. Ma la risposta non
 *  cambia messaggio per messaggio: cambia per GIRO di telefonate — stamattina
 *  si riprendono le vecchie consulenze e i lavori servono a tutte, stasera si
 *  confermano appuntamenti e non servono a nessuna. Una domanda che riceve
 *  venti volte la stessa risposta non è una domanda, è un passaggio in più.
 *  L'interruttore si tocca una volta e resta com'è.
 *
 *  ── ⚠️ È UN LINK, NON UN PULSANTE CHE APRE UNA FINESTRA ──────────────────
 *  Su «Da fare oggi» i messaggi si aprivano con `window.open` dentro un
 *  gestore di clic e il browser li bloccava — su telefono quasi sempre — e il
 *  tasto sembrava rotto. Resta un'ancora vera: cambia solo il testo che porta
 *  con sé.
 */
import { useCallback, useRef, useSyncExternalStore, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "./whatsapp";
import { conLinkLavori, consulenzaAlleSpalle, messaggioRipresa } from "./lavori";
import { ascoltaLavori, commutaLavori, lavoriAttiviPer } from "./lavori-attivi";

/** Quanto va tenuto premuto. ⚠️ Mezzo secondo scarso: sotto i 350 ms si
 *  accende da solo a chi tocca piano, sopra i 600 sembra che non funzioni e si
 *  lascia andare prima. */
const PRESSIONE_MS = 450;

export function TastoMessaggio({
  telefono,
  messaggio,
  nome,
  quandoConsulenza,
  stato,
  titolo,
  onInviato,
  className,
  children,
}: {
  telefono: string;
  /** Il testo dello stato del lead: è quello che parte quando la consulenza
   *  non c'è ancora stata. */
  messaggio: string;
  nome?: string;
  /** Il giorno della consulenza. ⚠️ È anche l'interruttore che decide QUALE
   *  messaggio si scrive: con una consulenza alle spalle si riprende il filo
   *  (giorno compreso), senza si manda il testo del suo stato — «abbiamo fatto
   *  la consulenza» a chi non l'ha mai fatta è la figura peggiore possibile. */
  quandoConsulenza?: string;
  /** Lo stato del lead. ⚠️ È il RAGGIO dell'interruttore: acceso qui, i lavori
   *  si allegano a tutte le righe dello stesso stato — che è come si lavora
   *  davvero, un giro alla volta. Vedi `lavori-attivi`. */
  stato?: string;
  titolo: string;
  /** Chiamata quando il messaggio parte DAVVERO — cioè su un tocco normale,
   *  non su una pressione lunga (che accende l'interruttore e basta). Serve a
   *  segnare la riga come già scritta. */
  onInviato?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  /** ⚠️ L'interruttore NON è di questo tasto: è dello stato del lead, e vive
   *  fuori dal componente. Acceso su una riga, si accende su tutte quelle dello
   *  stesso stato — anche sulle altre schermate, perché un giro di telefonate
   *  ne attraversa tre. */
  const chiave = String(stato ?? "");
  const conLink = useSyncExternalStore(
    ascoltaLavori,
    useCallback(() => lavoriAttiviPer(chiave), [chiave]),
    //  Sul server non c'è niente di acceso: il tasto si disegna spento e si
    //  accende, se serve, al primo disegno nel browser.
    useCallback(() => false, []),
  );
  const timer = useRef<number | null>(null);
  //  Segna che la pressione è diventata lunga: serve al clic che arriva subito
  //  dopo, che va fermato — se no, tenendo premuto, WhatsApp si aprirebbe lo
  //  stesso nell'istante in cui si alza il dito.
  const lunga = useRef(false);

  /* ── ⚠️ IL MESSAGGIO LO DECIDE LO STATO, NON LA DATA ──────────────────────
     Segnalazione del committente: «quando lo stato è appuntamento fissato, o
     altri stati, i pulsanti devono essere per quello stato con il messaggio
     corretto. Ora invece mostra sempre il messaggio del ricontatto».
     Qui c'era scritto: se la scheda ha una data di consulenza, manda il
     messaggio di ripresa. Ma quella data ce l'hanno ANCHE gli appuntamenti che
     devono ancora succedere — è il loro motivo di esistere — e a chi aveva un
     incontro fissato per domani partiva «abbiamo fatto la consulenza venerdì
     25 settembre». Il testo dello stato, quello scritto apposta, non usciva
     mai.
     Adesso: il messaggio dello stato è il predefinito, SEMPRE. Si scrive del
     passato solo quando la consulenza è davvero alle spalle — e a dirlo è lo
     stato insieme alla data, non la data da sola (vedi `consulenzaAlleSpalle`).
     ⚠️ E l'interruttore dei lavori non cambia più il messaggio: quando non c'è
      una consulenza da riprendere, ALLEGA il link al testo dello stato invece
      di sostituirlo. «Allego i nostri lavori» non ha mai voluto dire «manda
      un'altra cosa». */
  const daRiprendere = consulenzaAlleSpalle(stato, quandoConsulenza);
  const testo = daRiprendere
    ? messaggioRipresa(String(nome ?? ""), quandoConsulenza, conLink)
    : conLink
      ? conLinkLavori(messaggio)
      : messaggio;

  const ferma = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <a
      href={buildWhatsAppLink(telefono, testo)}
      target="_blank"
      rel="noreferrer"
      onPointerDown={() => {
        lunga.current = false;
        ferma();
        timer.current = window.setTimeout(() => {
          lunga.current = true;
          commutaLavori(chiave);
          //  Un colpetto di vibrazione dove c'è: è l'unico modo, su un
          //  telefono, di sapere che la pressione è stata registrata senza
          //  guardare il colore.
          try {
            navigator.vibrate?.(15);
          } catch {
            /* non tutti i telefoni ce l'hanno, e non è un guasto */
          }
        }, PRESSIONE_MS);
      }}
      onPointerUp={ferma}
      onPointerLeave={() => {
        ferma();
        lunga.current = false;
      }}
      //  ⚠️ Su telefono una pressione lunga su un link apre il menu del
      //   browser («apri in una scheda nuova», «copia»): senza questo, il
      //   nostro interruttore non si raggiunge mai.
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        if (lunga.current) {
          e.preventDefault();
          lunga.current = false;
          return;
        }
        //  ⚠️ Solo qui: dopo la pressione lunga il messaggio NON parte, e
        //   segnare la riga come scritta sarebbe una bugia — di quelle che si
        //   scoprono a fine giornata, quando quella persona non ha ricevuto
        //   niente e nessuno la richiama.
        onInviato?.();
      }}
      title={
        conLink
          ? `${titolo} — con il link ai nostri lavori su tutte le schede in questo stato. Tieni premuto per toglierlo`
          : `${titolo}. Tieni premuto per allegare i nostri lavori a tutte le schede in questo stato`
      }
      aria-label={titolo}
      aria-pressed={conLink}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
      className={cn(
        className,
        //  ⚠️ Verde chiaro e non pieno: questo tasto sta in mezzo a righe di
        //   elenco, e un blocco di colore pieno griderebbe più del nome del
        //   cliente accanto.
        conLink && "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      )}
    >
      {children ?? <MessageCircle className="h-3.5 w-3.5" />}
    </a>
  );
}
