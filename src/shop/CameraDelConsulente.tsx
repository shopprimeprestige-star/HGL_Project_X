/** ── LA CAMERA DEL CONSULENTE, SUI LINK «SOLO UNA COSA» ────────────────────
 *
 *  Richiesta del committente: «fai che posso attivare e disattivare anche la
 *  mia camera anche su questi link» — e poi, vedendola: «deve essere sempre
 *  rotonda come quando faccio Meetly, stesso design, stesse funzioni della
 *  camera nello stato contenuti».
 *
 *  Per questo qui non c'è nessun disegno: c'è solo il collegamento fra il
 *  flusso che arriva (shop/camera-link) e la camerina tonda, che è la stessa
 *  della consulenza vera (shop/CamerinaTonda) — si trascina, si ridimensiona
 *  dall'angolo, riempie il cerchio.
 *
 *  COMPARE SOLO QUANDO C'È QUALCOSA DA VEDERE: a camera spenta sparisce. Un
 *  cerchio nero in un angolo, per un cliente, è indistinguibile da un guasto.
 *
 *  ⚠️ NIENTE COMANDI DI CONSULENZA DENTRO: il cliente non accende, non spegne,
 *   non riaggancia. Questa pagina è «guarda quello che ti mostro», e ogni
 *   pulsante in più è un modo per farsi chiudere in faccia la consulenza per
 *   sbaglio. Le uniche due cose che può fare sono spostarla e rimpicciolirla —
 *   le stesse due di Meetly.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { seguiCameraLink } from "@/shop/camera-link";
import { CamerinaTonda } from "@/shop/CamerinaTonda";

export function CameraDelConsulente({ sess, nome }: { sess: string; nome?: string }) {
  const [flusso, setFlusso] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!sess) return;
    return seguiCameraLink(sess, setFlusso);
  }, [sess]);

  if (!flusso) return null;
  return <CamerinaTonda stream={flusso} titolo={nome ? `${nome} · trascinala dove vuoi` : undefined} />;
}
