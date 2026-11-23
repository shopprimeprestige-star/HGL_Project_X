/** ── STRISCIA «SENZA CONNESSIONE» (V1 · T83, documento §4.7) ──────────────────
 *  Sotto l'header, chiara, calma (mai rossa): dice che il carrello è com'era e si toglie da sola al ritorno della rete. La regola è di
 *  `statoRete` (`vetrina-interazioni`); qui ci sono gli ascolti di `online` e `offline`. La regione `status` c'è SEMPRE, anche vuota:
 *  un lettore di schermo annuncia solo ciò che compare in una regione che esisteva già. Sul server e al primo disegno si parte da «online». */
import { useEffect, useState } from "react";
import { TESTI_SHOP } from "@/landing/testi-shop";
import { statoRete } from "@/shop/cms/vetrina-interazioni";

/** Solo il disegno: `online` = ciò che dice il browser (`null` = non si sa, come sul server). */
export function StrisciaRete({ online }: { online: boolean | null | undefined }) {
  return (
    <div role="status" data-banner-offline>
      {statoRete(online) === "offline" && (
        <p className="border-b border-ink/10 bg-[#EEF2FF] px-4 py-3 text-center text-sm text-ink">{TESTI_SHOP.microtesti.connessionePersa}</p>
      )}
    </div>
  );
}

export function BannerOffline() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const su = () => setOnline(true);
    const giu = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", su);
    window.addEventListener("offline", giu);
    return () => {
      window.removeEventListener("online", su);
      window.removeEventListener("offline", giu);
    };
  }, []);
  return <StrisciaRete online={online} />;
}
