/** ── CHIAMA, WHATSAPP E I QUATTRO ESITI ────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». È il gesto di tutta la
 *  giornata: tocco «Chiama», poi segno com'è andata. Sul telefono sta in una
 *  barra fissa in basso, sotto il pollice; sul computer è una riga della scheda.
 *
 *  ⚠️ UN SOLO ELEMENTO NEL DOM, non due copie (una per telefono e una per
 *   computer): `fixed inset-x-0 bottom-0` sul telefono, `md:static` sul computer.
 *   Due copie vorrebbero dire due serie di tasti con lo stesso numero 1…4.
 *  ⚠️ I tasti 1…4 sono i pulsanti che si vedono (`esiti` arriva dalla pagina,
 *   la stessa lista delle scorciatoie): il numero sta sul pulsante, sul computer.
 *  ⚠️ ALTEZZE: 48 px per Chiama e WhatsApp, 48 per gli esiti sul telefono. La
 *   barra alta quanto il suo contenuto: il Toaster ha un offset uguale
 *   (`--barra-esiti`, vedi CRM.tsx), così il messaggio «Annulla» non ci finisce
 *   sotto.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Lead } from "@/crm/types";
import { useEffect, useRef, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/crm/types";
import { ICONA_STATO } from "@/crm/SelettoreStatoDialog";
import { TastoChiama } from "@/crm/importa/chiamare";

export function BarraEsiti({
  telefono,
  linkWhatsApp,
  onWhatsAppInviato,
  esiti,
  onEsito,
  inCima,
  lead,
}: {
  telefono: string;
  /** La scheda: i tocchi sulla cornetta si contano lì. */
  lead?: Lead | null;
  /** Vuoto = nessun numero o nessun messaggio: il tasto resta spento. */
  linkWhatsApp: string;
  onWhatsAppInviato?: () => void;
  /** Gli esiti in vista (quattro), già filtrati per questo lead. */
  esiti: LeadStatus[];
  onEsito: (stato: LeadStatus) => void;
  /** Una riga sopra i tasti (qui: «Ultimo esito → Torna indietro»). Sta dentro la
   *  barra perché sul telefono sia leggibile SOPRA i pollici, non sotto la piega. */
  inCima?: ReactNode;
}) {
  //  L'altezza della barra, scritta dove il Toaster la può leggere. Sul
  //  computer la barra non è fissa e l'offset si azzera (vedi `md:` sotto).
  const rif = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = rif.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const scrivi = () => {
      const fissa = getComputedStyle(el).position === "fixed";
      document.documentElement.style.setProperty(
        "--barra-esiti",
        fissa ? `${Math.ceil(el.getBoundingClientRect().height) + 12}px` : "16px",
      );
    };
    scrivi();
    const ro = new ResizeObserver(scrivi);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--barra-esiti");
    };
  }, []);
  return (
    <div
      ref={rif}
      data-barra-esiti
      className="fixed inset-x-0 bottom-0 z-40 space-y-2 border-t border-border bg-background/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur md:static md:z-auto md:flex md:flex-wrap md:items-center md:gap-2 md:space-y-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
    >
      {inCima && <div className="md:w-full">{inCima}</div>}
      <div className="flex gap-2 md:contents">
        <div className="flex-1 md:w-44 md:flex-none [&>*]:w-full">
          <TastoChiama telefono={telefono} lead={lead} />
        </div>
        <div className="flex-1 md:w-44 md:flex-none [&>*]:w-full">
          {linkWhatsApp ? (
            <Button
              asChild
              size="lg"
              //  Verde e pieno (20/10/2026): è il secondo gesto della setter dopo
              //  la chiamata, e da contorno si confondeva con i tasti degli esiti.
              className="h-12 min-w-0 bg-emerald-600 text-[15px] text-white hover:bg-emerald-700"
            >
              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noreferrer"
                onClick={() => onWhatsAppInviato?.()}
              >
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              disabled
              className="h-12 min-w-0 text-[15px]"
              title="Serve un numero in scheda"
            >
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
            </Button>
          )}
        </div>
      </div>
      {/*  ── COM'È ANDATA ───────────────────────────────────────────────────
          Il numero sul pulsante è la scorciatoia da tastiera, e sta scritto SUL
          pulsante: una scorciatoia che non si vede non la usa nessuno. */}
      <div className="grid grid-cols-4 gap-1.5 md:contents" role="group" aria-label="Com'è andata">
        {esiti.map((s, i) => {
          const Icona = ICONA_STATO[s];
          return (
            <Button
              key={s}
              size="sm"
              variant="outline"
              className="h-12 min-w-0 flex-col gap-0.5 whitespace-normal px-1 text-[11.5px] leading-[1.15] tracking-tight md:h-10 md:flex-row md:gap-0 md:px-3 md:text-[13px]"
              onClick={() => onEsito(s)}
            >
              {Icona && <Icona className="mr-1.5 hidden h-3.5 w-3.5 md:inline-block" />}
              <span className="text-center md:text-left">{LEAD_STATUS_LABEL[s]}</span>
              {i < 9 && (
                <span className="ml-1.5 hidden rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground md:inline">
                  {i + 1}
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
