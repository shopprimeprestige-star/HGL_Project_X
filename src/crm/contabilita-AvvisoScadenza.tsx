/** ── IL PROMEMORIA FISCALE DOVE SI GUARDA OGNI MATTINA ─────────────────────
 *
 *  Richiesta del committente: «notifiche ogni tot che ricorda di chiudere
 *  contabilità». Finora erano due cose, e nessuna delle due bastava:
 *   · il conto alla rovescia nel menu — sempre presente, ma è un numero, e un
 *     numero non dice cosa fare;
 *   · un avviso a comparsa una volta al giorno — che se non si è davanti allo
 *     schermo nel momento in cui appare, non è mai esistito.
 *  Questa striscia sta invece dentro «Da fare oggi», che è la pagina che si
 *  apre la mattina e si tiene aperta: resta lì finché la scadenza non è
 *  passata, dice cosa c'è da fare e porta dove si fa.
 *
 *  ── ⚠️ DUE FINESTRE DIVERSE, PERCHÉ SONO DUE COSE DIVERSE ─────────────────
 *   · la LIQUIDAZIONE IVA si annuncia con venticinque giorni: chiude un
 *     periodo, e per chiuderlo bisogna prima aver raccolto le fatture — che è
 *     un lavoro di giorni, non di un pomeriggio;
 *   · tutte le ALTRE con sette: l'invio delle fatture estere allo SDI torna il
 *     15 di ogni mese, e una striscia accesa metà mese si smette di vedere
 *     entro la seconda settimana. Sette giorni bastano a farla, e sono pochi
 *     abbastanza da non diventare arredamento.
 *
 *  ⚠️ NON SCRIVE NIENTE. Non crea cose da fare nella lista condivisa e non
 *   tocca l'archivio: legge una chiave e disegna. Una lista che si riempie da
 *   sola di righe che nessuno ha scritto è il modo più veloce per far smettere
 *   di fidarsi della lista.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChiusure } from "./contabilita-chiusure";
import { useLiquidazione } from "./contabilita-liquidazione";
import {
  PREAVVISO_AVVISO,
  prossimeScadenze,
  type RegimeLiquidazione,
  type Scadenza,
} from "./contabilita-scadenze";

/** Quanti giorni prima si comincia a dirlo, per le scadenze che non sono la
 *  liquidazione. Vedi la nota in testa al file. */
const PREAVVISO_ALTRE = 7;

/** ⚠️ PURA, e fuori dal disegno: la regola di «quando si avvisa» si può
 *  controllare senza aprire un browser, ed è l'unico modo perché resti giusta.
 *  Torna la scadenza da mostrare, o `null` se non c'è niente da dire. */
export function daAnnunciare(
  oggi: string,
  regime: RegimeLiquidazione,
  chiuse?: Record<string, string>,
): (Scadenza & { mancano: number }) | null {
  const prossime = prossimeScadenze(oggi, regime, 10, chiuse);
  const candidate = prossime.filter((s) =>
    s.tipo === "iva" ? s.mancano <= PREAVVISO_AVVISO : s.mancano <= PREAVVISO_ALTRE,
  );
  //  La più vicina fra quelle che hanno qualcosa da dire: due strisce una
  //  sopra l'altra sarebbero due cose da leggere in un posto in cui si è
  //  venuti a fare altro.
  return candidate.sort((a, b) => a.mancano - b.mancano)[0] ?? null;
}

const quanto = (g: number) => (g === 0 ? "è oggi" : g === 1 ? "è domani" : `mancano ${g} giorni`);

export function AvvisoScadenza() {
  //  Mensile o trimestrale cambia tutte le date, e la risposta sta in un posto
  //  solo: vedi `crm/contabilita-liquidazione`.
  const { regime } = useLiquidazione();
  const { chiuse } = useChiusure();

  const s = daAnnunciare(new Date().toISOString().slice(0, 10), regime, chiuse);
  if (!s) return null;
  const urgente = s.mancano <= 3;

  return (
    <Link
      to="/CRM/contabilita"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition",
        urgente
          ? "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
          : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
      )}
    >
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 text-[12.5px] leading-relaxed">
        <span className="font-semibold">
          {s.titolo}: {quanto(s.mancano)}
        </span>
        {" — "}
        {s.cosa}
        <span className="mt-0.5 block opacity-80">
          {s.tipo === "iva"
            ? `Chiudi la contabilità di ${s.periodo}: carica le fatture che mancano e controlla che ogni costo abbia il suo documento. `
            : ""}
          Apri Contabilità →
        </span>
      </span>
    </Link>
  );
}
