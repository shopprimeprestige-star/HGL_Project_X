/** ── LA FILA DEI GIORNI, SOTTO OGNI FILTRO ACCESO (09/11/2026, rifatta il 16/11, il 17/11 e ancora
 *  il 17/11/2026) ──────────────────────────────────────────────────────────────────────────────
 *  Richiesta del titolare: dentro un filtro, vedere solo quelli di oggi, di domani, eccetera.
 *  Tutti · Scaduti · Ieri · Oggi · Domani · Prossimi giorni · Senza data.
 *  ⚠️ 17/11/2026 (seconda correzione, guardando il telefono): la fila scorreva di lato e a 375 px
 *  tagliava «Prossimi giorni»/«Senza data» fuori dalla vista, con poco a dirlo («Ricontatti» non si
 *  accorgeva che c'era un filtro per scadenza). Ora NON scorre più: i segmenti vanno a capo
 *  (`flex-wrap`), tutti sempre in vista, ognuno un tasto da 44 px di tocco col suo numero. Davanti,
 *  un'etichetta in parole («Scadenza:» per i filtri a richiamo, «Ultimo messaggio:» per quelli a
 *  messaggio) dice cosa guarda la fila — non più la sola icona del calendario.
 *  Uno acceso alla volta; ritoccare quello acceso torna a «Tutti». Il numero su ogni voce lo calcola
 *  la pagina (`conta`, la stessa funzione dell'elenco). Quale data guarda: giorno.ts. */
import { cn } from "@/lib/utils";
import { FUOCO } from "./PannelloFiltri";
import { SEGMENTI_GIORNO, type GiornoChat } from "./giorno";

interface Props {
  valore: GiornoChat;
  /** Quante chat entrerebbero toccando quel segmento. */
  conta: (giorno: GiornoChat) => number;
  onCambia: (giorno: GiornoChat) => void;
  /** A parole, quale data guarda il filtro («il giorno del ricontatto»): sta nel tooltip e per chi legge. */
  data: string;
  /** L'etichetta davanti alla fila («Scadenza:» o «Ultimo messaggio:», con i due punti): dice in
   *  parole quale «quando» guarda questo filtro — non più la sola icona (revisione 17/11/2026). */
  etichetta: string;
  /** I segmenti da mostrare: i sette di sempre, o solo Tutti/Oggi/Ieri/Più vecchi per i filtri «a
   *  messaggio» (Compito 3). Omesso = i sette di sempre. */
  segmenti?: readonly { v: GiornoChat; nome: string }[];
}

export function RigaGiorno({ valore, conta, onCambia, data, etichetta, segmenti = SEGMENTI_GIORNO }: Props) {
  return (
    <div
      role="group"
      aria-label="Giorno"
      aria-description={`Conta ${data}`}
      title={`Conta ${data}`}
      className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5 md:px-2"
    >
      <span className="t-nota shrink-0 whitespace-nowrap font-medium text-muted-foreground">
        {etichetta}
      </span>
      {segmenti.map((x) => {
        const acceso = valore === x.v;
        return (
          <button
            key={x.v || "tutti"}
            type="button"
            aria-pressed={acceso}
            onClick={() => onCambia(acceso ? "" : x.v)}
            className={cn(
              "t-nota flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 font-medium transition-colors lg:pointer-fine:h-8",
              acceso
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-background",
              FUOCO,
            )}
          >
            {x.nome}
            <span
              className={cn(
                "tabular-nums",
                acceso ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {conta(x.v)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
