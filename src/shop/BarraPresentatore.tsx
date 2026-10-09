/** ── LA BARRA DEL CONSULENTE ARRIVA SOLO A CHI LA USA ──────────────────────
 *
 *  `PresenterBar` è il pannello di comando del consulente: 192 KB (48 KB
 *  compressi) di pulsanti, menu, elenco preventivi, impostazioni. Le pagine
 *  che la mostrano — preventivo, slide, media, sito — sono le STESSE che apre
 *  il cliente, e con un `import` normale quel pezzo finisce nel pacchetto
 *  della pagina: lo scaricava anche il cliente, che quella barra non la vede
 *  nemmeno. Su una pagina che pesa ~250 KB compressi in tutto, è un quinto del
 *  tempo di attesa speso per una cosa che non comparirà.
 *
 *  Qui la barra diventa un pezzo a parte, chiesto solo quando si disegna
 *  davvero. Per il consulente non cambia niente di percepibile — il pezzo
 *  arriva mentre la pagina si compone — e il cliente non lo chiede affatto.
 *
 *  ⚠️ NIENTE ATTESA A SCHERMO: `fallback={null}`. Una barra che compare mezzo
 *   secondo dopo è normale; un riquadro di caricamento al posto suo, davanti a
 *   un cliente, sembrerebbe un guasto.
 *  ⚠️ SI USA AL POSTO DELL'IMPORT DIRETTO: chi importa `PresenterBar` da
 *   `@/shop/PresenterBar` se lo ritrova di nuovo dentro il pacchetto della
 *   pagina, e il guadagno sparisce.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Suspense, lazy, type ComponentProps } from "react";
import type { PresenterBar as Barra } from "@/shop/PresenterBar";

const Pigra = lazy(() =>
  import("@/shop/PresenterBar").then((m) => ({ default: m.PresenterBar })),
);

export function BarraPresentatore(props: ComponentProps<typeof Barra>) {
  return (
    <Suspense fallback={null}>
      <Pigra {...props} />
    </Suspense>
  );
}
