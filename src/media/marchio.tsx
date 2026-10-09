// ── MARCHIO SUL MEDIA ───────────────────────────────────────────────────────
//  Un logo nudo su una foto è una scommessa: su una testa illuminata un logo
//  chiaro sparisce, su una foto scura sparisce uno scuro. Quello che lo rende
//  leggibile SEMPRE non è il logo, è il fondo che gli sta dietro: pastiglia
//  scura semitrasparente + sfocatura (stacca dalle foto chiare) + un filo di
//  bordo chiaro (stacca dalle foto scure).
//  Regole non negoziabili: `pointer-events-none` (non deve mai rubare un tocco
//  al cliente né una pennellata di zoom/pan al consulente) e posizione FUORI
//  dal livello che si trasforma con lo zoom, altrimenti ingrandendo il media si
//  ingrandirebbe anche il marchio e se ne andrebbe fuori dall'inquadratura.
//
//  Sta in un file suo — e non più dentro la pagina Media — perché adesso lo
//  usano in tre: la diretta col cliente, l'anteprima del consulente e il
//  carosello dei link statici. Le tre viste devono essere la stessa cosa: se
//  il marchio comparisse in un angolo diverso a seconda di dove si guarda, non
//  sarebbe più un marchio, sarebbe un dettaglio.
import { BrandLogo } from "@/shop/BrandLogo";

/** Dove sta la pastiglia.
 *  · `standard`  — in basso a destra, appoggiata all'angolo: è la posizione
 *    storica, quella che vedono la diretta e l'anteprima del consulente, e
 *    NON cambia (le tre viste devono restare la stessa cosa).
 *  · `sopraComandi` — alzata di un dito. Serve solo dove sotto il marchio c'è
 *    la barra dei comandi di un <video controls>: quella barra compare e
 *    scompare da sola durante la riproduzione, quindi il marchio non può
 *    "spostarsi quando serve" — si mette una volta sola sopra la fascia dove
 *    la barra può apparire, e lì resta. Sovrapporsi a "play" e alla linea del
 *    tempo significa far premere il cliente su un logo mentre cerca di
 *    guardare il video. */
type PosizioneMarchio = "standard" | "sopraComandi";

export function MarchioSuMedia({ posizione = "standard" }: { posizione?: PosizioneMarchio }) {
  //  Una sola classe di posizione alla volta: due utility che toccano la
  //  stessa proprietà (bottom-3 e bottom-12) nella stessa stringa non si
  //  "battono" nell'ordine in cui sono scritte, vince quella che il foglio di
  //  stile genera per ultima — cioè un risultato a caso.
  const ancoraggio =
    posizione === "sopraComandi" ? "bottom-12 right-3 sm:bottom-14" : "bottom-3 right-3";
  //  ── PERCHÉ NON È PIÙ UNA PASTIGLIA ────────────────────────────────────────
  //  Era `rounded-full`: su un fondo alto ~28px vuol dire 14px di raggio, cioè
  //  i lati diventano due semicerchi e la forma legge come un "bollino", da
  //  adesivo. Un marchio appoggiato su una foto deve sembrare una targhetta,
  //  non un adesivo. `rounded-lg` (8px) tiene l'angolo morbido — che serve
  //  davvero, perché un angolo vivo su una foto sembra un ritaglio sbagliato —
  //  ma la forma resta rettangolare e riconoscibile come contenitore.
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${ancoraggio} z-30 flex select-none items-center rounded-lg border border-white/25 bg-black/45 px-2.5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,.55)] backdrop-blur-md`}
    >
      <BrandLogo className="h-4 w-auto" />
    </div>
  );
}
