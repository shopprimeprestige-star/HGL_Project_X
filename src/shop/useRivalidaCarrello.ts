/** ── IL CARRELLO CONTROLLATO DAL SERVER (T21) ──────────────────────────────
 *  Collega `rivalida` (src/shop/cms/cassa.ts: le decisioni, provate) al carrello e ai server. Una volta, appena il carrello
 *  ha delle righe, e di nuovo quando la cassa lo chiede (`controlla`, prima di ordinare).
 *  ⚠️ Se il server non è raggiungibile il carrello NON si tocca: lo stato è `non_verificabile` e la cassa aspetta. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/shop/CartContext";
import { righeCarrello, schedaProdotto } from "@/shop/cms/catalogo.functions";
import { modalitaCertaDelServer } from "@/shop/cms/modalita-certa.functions";
import { MSG_PREZZI, MSG_RIMOSSE, rivalida, type EsitoRivalida } from "@/shop/cms/cassa";
import type { CartLine } from "@/shop/CartContext";

export type StatoCarrello = "controllo" | "ok" | "non_verificabile";

export function useRivalidaCarrello(modo: "codice" | "cms") {
  const { lines, replaceLines } = useCart();
  const [stato, setStato] = useState<StatoCarrello>("controllo");
  const [avviso, setAvviso] = useState<string | null>(null);
  const ultime = useRef(lines);
  ultime.current = lines;
  const fatto = useRef(false);

  const controlla = useCallback(async (): Promise<EsitoRivalida<CartLine>> => {
    const esito = await rivalida<CartLine>(
      {
        modo,
        chiediRighe: (skus) => righeCarrello({ data: { skus } }),
        sonda: async (slug) => (await schedaProdotto({ data: { slug, chiave: "" } })).esito !== "guasto",
        modalitaCerta: () => modalitaCertaDelServer(),
      },
      ultime.current,
    );
    if (esito.stato === "non_verificabile") {
      setStato("non_verificabile");
      return esito;
    }
    if (esito.rimosse > 0 || esito.prezziCambiati) {
      replaceLines(esito.righe);
      setAvviso(esito.rimosse > 0 ? MSG_RIMOSSE : MSG_PREZZI);
    }
    setStato("ok");
    return esito;
  }, [modo, replaceLines]);

  // il carrello arriva dalla memoria del browser DOPO il primo disegno: si controlla alla prima volta che ha delle righe
  useEffect(() => {
    if (fatto.current || lines.length === 0) return;
    fatto.current = true;
    void controlla();
  }, [lines.length, controlla]);

  return { stato: lines.length === 0 ? ("ok" as const) : stato, avviso, controlla };
}
