/** ── IL CALENDARIO CHE NON ARRIVA NON ROMPE LA PAGINA ───────────────────────
 *  Il calendario (`BookingFunnel`, modo «solo-calendario») si carica al tocco.
 *  Con la rete del telefono debole, o con la pagina aperta mentre si pubblica
 *  (il pezzo col vecchio nome non c'è più), il caricamento può fallire. Senza
 *  riparo l'errore sostituirebbe tutta la pagina e la conferma «Fatto. Ti
 *  richiamiamo noi.» sparirebbe, con il lead già salvato. Qui l'errore si ferma:
 *  il calendario si chiude e la conferma resta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Component, useEffect, type ComponentType, type ReactNode } from "react";

export interface PropsCalendario {
  variant?: "light" | "dark";
  modo: "solo-calendario";
  onOrarioScelto: (data: string, ora: string) => void;
  /** Il calendario non si è caricato o si è rotto: chi lo mostra lo chiude. */
  alErrore?: () => void;
}

/** Mostrato al posto del calendario che non si è caricato: lo chiude e non disegna nulla. */
export function CalendarioAssente({ alErrore }: PropsCalendario) {
  useEffect(() => {
    alErrore?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Per `React.lazy`: se il pezzo non arriva, la promessa NON fallisce, torna il componente di riserva. */
export function caricaCalendarioSicuro(
  importa: () => Promise<{ default: ComponentType<PropsCalendario> }>,
): Promise<{ default: ComponentType<PropsCalendario> }> {
  return importa().catch(() => ({ default: CalendarioAssente }));
}

interface PropsRiparo {
  alErrore: () => void;
  children?: ReactNode;
}

/** Se il calendario già caricato si rompe mentre si disegna, non porta giù la pagina. */
export class ProteggiCalendario extends Component<PropsRiparo, { errore: boolean }> {
  state = { errore: false };
  static getDerivedStateFromError() {
    return { errore: true };
  }
  componentDidCatch() {
    this.props.alErrore();
  }
  render() {
    return this.state.errore ? null : this.props.children;
  }
}
