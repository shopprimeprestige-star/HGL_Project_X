/** ── IL MOTORE DELLA CONSULENZA, CARICATO A PARTE ──────────────────────────
 *
 *  Segnalazione del committente: «la dashboard del CRM è molto lenta… fai
 *  anche il resto, quello degli 849 kB».
 *
 *  Misurato: il pezzo d'avvio dell'applicazione pesa 849 kB e 400 sono il
 *  motore della consulenza (shop/call), che la radice importava per tutti. Su
 *  una pagina del CRM quel mezzo megabyte non disegna niente: si scarica, si
 *  interpreta e resta lì ad aspettare una consulenza che non c'è.
 *
 *  Questo file è il ponte: sta DENTRO il pezzo staccato, quindi può importare
 *  il motore, e restituisce alla radice le due cose che le servono — il
 *  montaggio del motore e lo stato del cancello dell'ospite.
 *
 *  ⚠️ IL CANCELLO NON PUÒ ASPETTARE IL PEZZO. Finché questo file non è
 *   arrivato, la radice tiene chiuso da sé sui link del cliente (vedi
 *   `motoreSubito` in shop/link-ospite e la classe `hg-guest-gated` messa
 *   dallo script prima del disegno): un cliente non deve MAI vedere lampeggiare
 *   il preventivo prima della sala d'attesa.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect } from "react";
import { CallMount, useGuestGate } from "@/shop/call";

export default function MotoreConCancello({ cancello }: { cancello: (chiuso: boolean) => void }) {
  const chiuso = useGuestGate();
  useEffect(() => { cancello(chiuso); }, [chiuso, cancello]);
  return <CallMount />;
}
