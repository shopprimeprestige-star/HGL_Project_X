/** ── IL CONFINE D'ERRORE ATTORNO ALLA PAGINA, SENZA IL MOTORE ──────────────
 *
 *  Se la pagina esplode mentre la sta guardando un CLIENTE, lui non deve
 *  vedere la schermata tecnica del router: vede una schermata brandizzata e la
 *  pagina si ricostruisce da sola dopo un secondo. Al CONSULENTE invece
 *  l'errore deve arrivare intero, se no si nascondono i guasti a chi può
 *  segnalarli.
 *
 *  ⚠️ PERCHÉ NON È PIÙ QUELLO DEL MOTORE. Questo confine avvolge l'intera
 *   pagina, quindi vive nella radice dell'applicazione; e la radice non
 *   importa più il motore della consulenza (400 kB su 849 del pezzo d'avvio,
 *   caricati anche nel CRM dove non servono — vedi shop/link-ospite). Un
 *   confine che per esistere si tira dietro mezzo megabyte non è un confine,
 *   è un peso.
 *  ⚠️ LA SEGNALAZIONE AL CONSULENTE RESTA, e arriva per la strada lunga: il
 *   motore si chiede a parte, solo quando un errore c'è davvero. Se non è
 *   ancora caricato non succede niente di male — l'errore è comunque scritto
 *   nel registro del dispositivo, che è la prima cosa che si guarda.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Component, type ReactNode } from "react";
import { BrandLogo } from "@/shop/BrandLogo";
import { linkDaCliente } from "@/shop/link-ospite";

function daCliente(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return linkDaCliente({
      percorso: window.location.pathname,
      ricerca: window.location.search,
      inCornice: window.self !== window.top,
    });
  } catch { return false; }
}

/** La schermata che vede il cliente mentre la pagina si rimette in piedi.
 *  Volutamente scarna: è un attimo, e deve poter essere disegnata anche
 *  quando il resto dell'applicazione non c'è. */
export function SchermataUnAttimo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050f24] px-6 text-center text-white">
      <BrandLogo className="h-8 w-auto" />
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
      <p className="text-base font-semibold">Un attimo, sto preparando la tua consulenza…</p>
      <p className="text-sm text-white/50">Resta pure su questa pagina.</p>
    </div>
  );
}

export class ConfineOspite extends Component<
  { children: ReactNode; tag?: string },
  { caduto: Error | null; giro: number }
> {
  timer: ReturnType<typeof setTimeout> | null = null;
  constructor(p: { children: ReactNode; tag?: string }) {
    super(p);
    this.state = { caduto: null, giro: 0 };
  }
  static getDerivedStateFromError(err: Error) { return { caduto: err || new Error("render") }; }
  componentDidCatch(err: Error, info: { componentStack?: string | null }) {
    const dove = this.props.tag ? ` [${this.props.tag}]` : "";
    //  SEMPRE nel registro del dispositivo, con lo stack dei componenti: è
    //  l'unico modo per capire da un telefono quale pezzo è esploso.
    console.error(`[GUEST][ERR]${dove}`, err, "\n[GUEST][ERR] componentStack:", info?.componentStack || "(non disponibile)");
    if (!daCliente()) return;                 // consulente: l'errore risale come sempre
    //  Il motore si chiede solo adesso: serve a dirlo al consulente e a
    //  richiedere lo stato corrente, non a disegnare questa schermata.
    void import("@/shop/call")
      .then((m) => {
        m.reportGuestError?.(`${err?.name || "Error"}: ${err?.message || String(err)}${dove}`, info?.componentStack || "");
      })
      .catch(() => { /* senza motore resta il registro: meglio di niente */ });
    if (this.timer) clearTimeout(this.timer);
    //  AUTO-RIPRISTINO: dopo ~1s si ri-monta l'albero con una chiave nuova
    //  (stato dei componenti azzerato) e si ri-chiede lo stato al consulente.
    this.timer = setTimeout(() => {
      void import("@/shop/call").then((m) => { try { m.requestPresenterState?.(); } catch { /* */ } }).catch(() => { /* */ });
      this.setState((s) => ({ caduto: null, giro: s.giro + 1 }));
    }, 1000);
  }
  componentWillUnmount() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  render() {
    if (this.state.caduto) {
      //  Fuori dal link del cliente il confine è TRASPARENTE: l'errore torna a
      //  propagarsi, perché il consulente i propri guasti deve vederli.
      if (!daCliente()) throw this.state.caduto;
      return <SchermataUnAttimo />;
    }
    return <div key={this.state.giro} style={{ display: "contents" }}>{this.props.children}</div>;
  }
}
