/** ── COME TI VEDE IL CLIENTE (lato consulente) ──────────────────────────────
 *
 *  Il cerchio che mostra al CONSULENTE la propria camera mentre la sta
 *  mandando a chi ha aperto il link — stessa camerina tonda che ha davanti il
 *  cliente, come lo specchio della PiP nella consulenza vera.
 *
 *  ⚠️ NON È UN VEZZO. Senza, l'unico modo di sapere se si sta trasmettendo è
 *   la spia accanto all'obiettivo: si finisce per stare mezz'ora inquadrati
 *   male, o — peggio — per credere di essere spenti mentre si è accesi.
 *
 *  Sulla targhetta c'è anche quanti stanno ricevendo: zero non è un guasto,
 *  vuol dire che il cliente il link non l'ha ancora aperto — ed è esattamente
 *  quello che serve sapere prima di iniziare a parlare alla telecamera.
 *  ───────────────────────────────────────────────────────────────────────── */
import { flussoCameraLink, useCameraLink } from "@/shop/camera-link";
import { CamerinaTonda } from "@/shop/CamerinaTonda";

/** ⚠️ Il dispositivo che ha in mano un cliente, quando non lo sappiamo ancora:
 *   un TELEFONO, perché è quello che ha in mano in nove casi su dieci.
 *   Sbagliando per difetto viene un cerchio piccolo, che è un fastidio;
 *   sbagliando per eccesso viene mezzo schermo coperto — ed è esattamente così
 *   che l'anteprima veniva fuori enorme: il metro era il monitor del
 *   consulente. Appena il cliente si annuncia, la misura si corregge da sola. */
const TELEFONO_TIPO = { w: 390, h: 844 };

export function AnteprimaCameraLink() {
  const { accesa, collegati, vista } = useCameraLink();
  if (!accesa) return null;
  return (
    <CamerinaTonda
      stream={flussoCameraLink()}
      specchio
      base={vista && vista.w > 0 ? vista : TELEFONO_TIPO}
      nota={collegati === 0 ? "nessuno collegato" : collegati === 1 ? "1 collegato" : `${collegati} collegati`}
    />
  );
}
