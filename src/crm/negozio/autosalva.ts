/** ── IL SALVATAGGIO AUTOMATICO DELLA SCHEDA ─────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T13, Design §4.10.2). Modulo PURO: riceve `salva` e le porte del tempo.
 *
 *  La bozza si salva da sola 2 secondi dopo l'ultima modifica («Salvato alle 14:32»). Regole:
 *   · ogni modifica annulla il timer e ne riparte uno: tre modifiche in un secondo = UN salvataggio;
 *   · lo stesso contenuto già salvato non si salva di nuovo;
 *   · mai due salvataggi insieme: una modifica arrivata mentre si salva aspetta, poi riparte il suo timer;
 *   · se salvare fallisce lo si dice e NON si ritenta da soli: si riprova alla prossima modifica (o con `subito`);
 *   · nel testo di stato non entra mai il messaggio di un errore (può contenere dati). */
import { oraHHmm } from "../ecommerce/client";

export const RITARDO_AUTOSALVA_MS = 2000;

export type Fase = "fermo" | "in_attesa" | "salvando" | "salvato" | "errore";
export interface StatoAutosalva {
  fase: Fase;
  /** «Salvato alle 14:32», o la frase dell'errore, o vuoto. */
  testo: string;
  /** Quando (ms) è finito l'ultimo salvataggio riuscito. */
  salvatoAlle: number | null;
}
export interface PorteAutosalva {
  adesso(): number;
  imposta(fn: () => void, ms: number): unknown;
  annulla(h: unknown): void;
}

export function creaAutosalva<T>(opz: {
  /** `true` = salvato; `false` (o un'eccezione) = non salvato. */
  salva: (contenuto: T) => Promise<boolean>;
  porte: PorteAutosalva;
  ritardoMs?: number;
  /** Il contenuto che la scheda ha già quando si apre: riscriverlo uguale non salva niente. */
  contenutoIniziale?: T;
  /** shortcut: due contenuti sono «lo stesso» se hanno lo stesso JSON (stesso ordine delle chiavi). */
  chiave?: (c: T) => string;
}) {
  const { salva, porte, ritardoMs = RITARDO_AUTOSALVA_MS } = opz;
  const chiave = opz.chiave ?? ((c: T) => JSON.stringify(c));
  let salvata: string | null = opz.contenutoIniziale === undefined ? null : chiave(opz.contenutoIniziale);
  let attesa: { c: T; k: string } | null = null;
  let timer: unknown = null;
  let inCorso: Promise<void> | null = null;
  let fermato = false;
  let stato: StatoAutosalva = { fase: "fermo", testo: "", salvatoAlle: null };
  let ascoltatori: Array<() => void> = [];
  const imposta = (p: Partial<StatoAutosalva>) => {
    stato = { ...stato, ...p };
    ascoltatori.forEach((fn) => fn());
  };
  const spegni = () => {
    if (timer !== null) porte.annulla(timer);
    timer = null;
  };
  const arma = () => {
    spegni();
    timer = porte.imposta(alTimer, ritardoMs);
  };

  /** Salva ciò che attende, se serve. Mai due insieme. */
  const scrivi = (): Promise<void> => {
    if (inCorso) return inCorso;
    if (!attesa) return Promise.resolve();
    if (attesa.k === salvata) {
      attesa = null;
      if (stato.fase === "in_attesa") imposta({ fase: stato.salvatoAlle ? "salvato" : "fermo", testo: stato.salvatoAlle ? `Salvato alle ${oraHHmm(stato.salvatoAlle)}` : "" });
      return Promise.resolve();
    }
    const questa = attesa;
    attesa = null;
    imposta({ fase: "salvando", testo: "Salvo…" });
    inCorso = (async () => {
      let riuscito = false;
      try {
        riuscito = await salva(questa.c);
      } catch {
        // nessun log: il messaggio può contenere dati del prodotto o del titolare
      }
      inCorso = null;
      if (riuscito) {
        salvata = questa.k;
        const ora = porte.adesso();
        imposta({ fase: "salvato", testo: `Salvato alle ${oraHHmm(ora)}`, salvatoAlle: ora });
      } else {
        // la modifica che non si è salvata resta in coda solo se non ne è arrivata una più nuova
        attesa ??= null;
        imposta({ fase: "errore", testo: "Non sono riuscito a salvare: controlla la connessione, riproverò alla prossima modifica." });
      }
      if (attesa && !fermato) {
        imposta({ fase: "in_attesa", testo: "" });
        arma();
      }
    })();
    return inCorso;
  };
  function alTimer() {
    timer = null;
    if (!fermato) void scrivi();
  }

  return {
    stato: () => stato,
    iscrivi(fn: () => void) {
      ascoltatori = [...ascoltatori, fn];
      return () => {
        ascoltatori = ascoltatori.filter((x) => x !== fn);
      };
    },
    /** Il contenuto della scheda è cambiato. */
    modifica(c: T) {
      if (fermato) return;
      attesa = { c, k: chiave(c) };
      if (inCorso) return; // finito quello in corso, riparte da sé
      if (stato.fase !== "in_attesa") imposta({ fase: "in_attesa", testo: "" });
      arma();
    },
    /** Salva ora (il tasto «Salva», o la pagina che si lascia). Senza modifiche non fa niente. */
    async subito() {
      spegni();
      await scrivi();
    },
    /** La pagina è stata lasciata: nessun timer, nessun salvataggio. */
    ferma() {
      fermato = true;
      spegni();
      attesa = null;
    },
  };
}
