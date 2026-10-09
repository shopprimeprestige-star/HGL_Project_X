// Anteprima/ottimizzazione dispositivo per lo screen-share.
// Mobile/Tablet: carica la stessa route in un iframe delle dimensioni reali del
// dispositivo e lo scala per ADATTARLO all'altezza dello schermo (proporzioni
// corrette, come un telefono vero), con zoom regolabile.
// Desktop: zoom uniforme della pagina.
// Su dispositivi touch reali (telefoni/tablet) la barra non compare: il sito è già responsive.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConsultant } from "@/shop/consultant";
import { useViewMode } from "@/shop/viewmode";
//  Pigra: il pacchetto della barra non deve finire in quello della pagina,
//  che la apre anche il cliente (vedi shop/BarraPresentatore).
import { BarraPresentatore as PresenterBar } from "@/shop/BarraPresentatore";
import { useCall } from "@/shop/call";
import { inStanzaConsulenza } from "@/shop/live";

type Mode = "auto" | "mobile" | "tablet" | "desktop";
const DEVICE: Record<"mobile" | "tablet", { w: number; h: number }> = {
  mobile: { w: 390, h: 844 },
  tablet: { w: 834, h: 1112 },
};

export function DeviceFrame({ children }: { children: ReactNode }) {
  const { consultant } = useConsultant();
  const [mounted, setMounted] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const [touch, setTouch] = useState(false);
  const { mode, zoom } = useViewMode();   // controllato dai pulsanti nella barra in basso
  const guestVp = useCall().guestViewport; // dimensioni REALI del dispositivo del cliente
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const areaRef = useRef<HTMLDivElement | null>(null);
  // ⚠️ CAUSA DEL BUG "contenuto fuori dal telefono": lo spazio disponibile veniva
  // CALCOLATO (screenH - 52px di barra). La barra del presentatore è più alta di
  // 52px (e il <body> riceve un padding dalle barre della chiamata), quindi lo
  // spazio stimato era MAGGIORE di quello reale → `scale` troppo grande →
  // il telaio (dev.w × scale) usciva dall'area e veniva tagliato a destra.
  // Ora l'area si MISURA davvero, in larghezza E in altezza.
  const [area, setArea] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setMounted(true);
    setInIframe(window.self !== window.top);
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const onResize = () => setAvail({
      w: window.innerWidth || document.documentElement.clientWidth || 0,
      h: window.innerHeight || document.documentElement.clientHeight || 0,
    });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // misura lo spazio realmente disponibile (si restringe quando si apre il teleprompter)
  useEffect(() => {
    const el = areaRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => setArea({ w: es[0].contentRect.width, h: es[0].contentRect.height }));
    ro.observe(el); setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [mode, mounted]);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const paramEmbed = params?.get("embed") === "1";
  const paramPrint = params?.get("print") === "1";
  // spettatore diretta live → layout nativo del suo dispositivo (tutte le forme
  // dell'indirizzo: /meetly/CODICE, il vecchio /videochiamata/CODICE, ?watch=)
  const paramWatch = !!params?.get("watch")
    || (typeof window !== "undefined" && inStanzaConsulenza(window.location.pathname));
  const paramClient = params?.get("client") === "1"; // link cliente → layout nativo, niente barra anteprima

  // SSR / primo paint, dentro l'iframe, stampa PDF, spettatore live, link cliente, o dispositivo touch reale: layout nativo responsive
  if (!mounted) return <>{children}</>;
  if (!consultant) return <>{children}</>; // l'anteprima dispositivo è solo per il consulente
  if (inIframe || paramEmbed || paramPrint || paramWatch || paramClient) return <>{children}</>;
  if (touch || (avail.w > 0 && avail.w < 760)) return <>{children}</>;

  // ── DIMENSIONI DEL TELAIO ──────────────────────────────────────────────
  //  "auto" = ESATTAMENTE il viewport del cliente collegato (così ciò che vede il
  //  presentatore è ciò che vede l'ospite, ancore di scroll comprese). Senza
  //  ospite collegato "auto" equivale a "desktop" (layout nativo).
  /** ── ⚠️ TUTTE LE SCHERMATE INSIEME ────────────────────────────────────
   *  Chi condivide un contenuto deve poter vedere com'è su tutti gli schermi.
   *  Cambiando modalità tre volte si guarda un dispositivo per volta e si
   *  ricorda male: gli errori di impaginazione stanno proprio nel confronto —
   *  la riga che sul telefono va a capo, il tasto che sul tablet finisce
   *  sotto la piega. Qui i tre telai stanno affiancati, alla stessa scala,
   *  e ognuno mostra la pagina vera. */
  if (mode === "tutte") {
    const TUTTI = [
      { nome: "Computer", w: 1280, h: 800 },
      { nome: "Tablet", w: DEVICE.tablet.w, h: DEVICE.tablet.h },
      { nome: "Telefono", w: DEVICE.mobile.w, h: DEVICE.mobile.h },
    ];
    const schermoH = avail.h || 800;
    const areaH = area.h || Math.max(360, schermoH - 68);
    const areaW = area.w || avail.w || 1200;
    const larghezzaTotale = TUTTI.reduce((s, d) => s + d.w, 0) + 96;
    const altezzaMassima = Math.max(...TUTTI.map((d) => d.h));
    //  ⚠️ UNA SOLA scala per tutti e tre: scalarli separatamente per farli
    //   stare uguali sarebbe una bugia — il telefono sembrerebbe grande come
    //   il monitor, e il confronto non direbbe più niente.
    const scala = Math.max(0.12, Math.min((areaH - 56) / altezzaMassima, (areaW - 48) / larghezzaTotale) * zoom);
    const url = window.location.pathname + (window.location.search ? `${window.location.search}&embed=1` : "?embed=1");
    return (
      <div className="flex w-full flex-col bg-[#050f24]" style={{ height: schermoH }}>
        <PresenterBar />
        <div ref={areaRef} className="relative min-h-0 flex-1 overflow-auto">
          <div className="flex min-h-full w-max min-w-full items-start justify-center gap-6 px-6 py-3">
            {TUTTI.map((d) => (
              <div key={d.nome} style={{ flex: "0 0 auto" }}>
                <div className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  {d.nome} · {d.w}×{d.h}
                </div>
                <div
                  className="overflow-hidden rounded-[22px] border border-white/10 bg-[#081634] shadow-2xl"
                  style={{ width: Math.round(d.w * scala), height: Math.round(d.h * scala) }}
                >
                  <iframe
                    src={url}
                    title={`Anteprima ${d.nome}`}
                    style={{
                      width: d.w, height: d.h, border: 0, display: "block",
                      transform: `scale(${scala})`, transformOrigin: "top left",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const dev = mode === "auto"
    ? (guestVp ? { w: guestVp.w, h: guestVp.h } : null)
    : mode === "mobile" || mode === "tablet" ? DEVICE[mode] : null;
  if (!dev) return <>{children}</>;   // desktop, oppure auto senza ospite

  const screenH = avail.h || 800;
  // Fallback SOLO al primo paint (prima che il ResizeObserver abbia misurato).
  const areaH = area.h || Math.max(360, screenH - 68);
  const areaW = area.w || avail.w || dev.w;
  // margine interno dell'area (py-2 + px-3 = 8px verticali, 12px orizzontali per lato)
  const fitH = (areaH - 24) / dev.h;
  const fitW = (areaW - 48) / dev.w;
  const fit = Math.max(0.05, Math.min(fitH, fitW));
  const scale = Math.max(0.2, Math.min(3, fit * zoom));
  // Il telaio è ESATTAMENTE il contenuto scalato: nessun disallineamento
  // possibile tra wrapper e iframe → niente overflow orizzontale.
  const wrapperW = Math.round(dev.w * scale);
  const wrapperH = Math.round(dev.h * scale);
  const url = window.location.pathname + (window.location.search ? `${window.location.search}&embed=1` : "?embed=1");

  return (
    <div className="flex w-full flex-col bg-[#050f24]" style={{ height: screenH }}>
      {/* header e comandi del presentatore restano visibili anche in anteprima mobile/tablet */}
      <PresenterBar />
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-auto">
        {/* w-max + min-w-full: se lo zoom manuale rende il telaio più largo
            dell'area, la riga CRESCE e si scorre in orizzontale invece di
            tagliare il telefono (prima restava centrato e clippato). */}
        {/* respiro laterale: con px-3 il telaio quasi toccava il bordo dell'area
            e sembrava disallineato. Ora c'è margine su entrambi i lati. */}
        <div className="flex min-h-full w-max min-w-full items-start justify-center px-6 py-3 sm:px-10">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#081634] shadow-2xl"
            style={{ width: wrapperW, height: wrapperH, flex: "0 0 auto" }}>
            <iframe
              src={url}
              title="Anteprima dispositivo"
              style={{ width: dev.w, height: dev.h, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", display: "block" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
