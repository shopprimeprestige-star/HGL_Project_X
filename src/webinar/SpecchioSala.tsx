import { useState } from "react";
import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import { useMisura } from "./misura";

/** ── COME LA VEDONO DAVVERO, DAI TRE APPARECCHI ────────────────────────────
 *
 *  ⚠️ NON È UN'ANTEPRIMA DEL CONTENUTO: è la SALA. Quella che c'era mostrava
 *   solo la pagina mandata in onda, e la pagina non è mai stata il problema —
 *   il problema è come si incastrano insieme il palco, la fila degli ospiti,
 *   la chat e i comandi, che è una cosa diversa su un telefono, su un tablet e
 *   su un computer. Chi conduce lo scopriva da una segnalazione, ore dopo.
 *
 *  ⚠️ SI PARTE DAL COMPUTER perché è lo schermo da cui si conduce: la prima
 *   volta che si apre, quello che si vede deve somigliare a quello che si ha
 *   già davanti, altrimenti si crede che sia rotto qualcosa. Gli altri due
 *   sono a un tocco.
 *
 *  ⚠️ LA MISURA È VERA, NON FINTA. Il riquadro è largo esattamente quanto
 *   l'apparecchio — 390, 834, 1280 — e poi si RIMPICCIOLISCE tutto insieme per
 *   stare nel pannello. Se invece si stringesse il riquadro, la pagina dentro
 *   userebbe le regole del telefono su uno schermo da computer e si vedrebbe
 *   una cosa che non esiste su nessun apparecchio.
 *
 *  ⚠️ `?specchio=1` — chi guarda da qui NON conta come spettatore e non manda
 *   il battito: senza, ogni volta che chi conduce apre questo pannello la sala
 *   guadagnerebbe una persona che non c'è, e il numero mostrato al pubblico è
 *   una cosa su cui non si scherza.
 */
const APPARECCHI = [
  { id: "telefono", nome: "Telefono", icona: Smartphone, larghezza: 390, altezza: 844 },
  { id: "tablet", nome: "Tablet", icona: Tablet, larghezza: 834, altezza: 1112 },
  { id: "computer", nome: "Computer", icona: Monitor, larghezza: 1280, altezza: 800 },
] as const;

export function SpecchioSala({ codice, onChiudi }: { codice: string; onChiudi: () => void }) {
  const [quale, setQuale] = useState<(typeof APPARECCHI)[number]["id"]>("computer");
  const [rif, spazio] = useMisura<HTMLDivElement>();
  const app = APPARECCHI.find((a) => a.id === quale)!;

  //  Il fattore per far stare l'apparecchio nel pannello, senza mai ingrandire:
  //  una pagina da 390 punti stirata a 900 non è quello che vedrà nessuno.
  const scala =
    spazio.larghezza > 0 && spazio.altezza > 0
      ? Math.min(1, spazio.larghezza / app.larghezza, spazio.altezza / app.altezza)
      : 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#050f24]/95 backdrop-blur-sm">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[12px] font-semibold text-white/80">Come la vedono</span>
        <div className="ml-2 flex items-center gap-1">
          {APPARECCHI.map((a) => (
            <button
              key={a.id}
              onClick={() => setQuale(a.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                quale === a.id
                  ? "border-brand bg-brand/20 text-white"
                  : "border-white/15 text-white/70 hover:bg-white/10"
              }`}
            >
              <a.icona className="h-3.5 w-3.5" />
              {a.nome}
              {/*  La misura scritta accanto: «non si vede» su un telefono vuol
                  dire poco, «non si vede a 390» si può verificare. */}
              <span className="text-[10px] tabular-nums text-white/35">{a.larghezza}</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-white/35">
          {scala > 0 && scala < 1 ? `rimpicciolita al ${Math.round(scala * 100)}%` : "a misura vera"}
        </span>
        <button
          onClick={onChiudi}
          className="rounded-md p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={rif} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
        {/*  ⚠️ La chiave è l'apparecchio: cambiando misura l'iframe RIPARTE.
              Senza, la pagina resterebbe quella disegnata per la larghezza di
              prima — cioè si guarderebbe un telefono con il montaggio del
              computer, che è il contrario di quello che serve. */}
        <iframe
          key={app.id}
          title={`La sala vista da ${app.nome.toLowerCase()}`}
          src={`/webinar/${encodeURIComponent(codice)}?specchio=1`}
          style={{
            width: app.larghezza,
            height: app.altezza,
            transform: `scale(${scala || 0.2})`,
            transformOrigin: "center center",
            opacity: scala ? 1 : 0,
          }}
          className="shrink-0 rounded-xl border border-white/15 bg-black"
        />
      </div>
    </div>
  );
}
