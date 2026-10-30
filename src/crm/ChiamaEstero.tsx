/** ── IL TASTO CHIAMA DI UN NUMERO ESTERO (30/10/2026) ──────────────────────
 *  Richiesta del titolare: se il prefisso non è +39 il tasto per chiamare è
 *  rosso, bloccato e non fa niente; il contatto si raggiunge solo su WhatsApp
 *  (l'app, non il CRM). Un solo componente per tutti i punti del CRM, così il
 *  rosso, il testo e il blocco non divergono fra venti copie.
 *
 *  Non è un `<button disabled>`: un controllo disabilitato non riceve il clic,
 *  ma in certi browser il clic arriva al genitore (la riga della lista apre la
 *  scheda). Un `<span aria-disabled>` che ferma il clic da sé non ha il problema.
 *  Regola in `chiamabile.ts`. Tocco da 44 px sul telefono. */
import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconaWhatsApp } from "@/crm/chatwa/IconaWhatsApp";
import { linkApriWhatsapp } from "@/crm/chatwa/apriWhatsapp";
import { TESTO_NUMERO_ESTERO } from "@/crm/chiamabile";

export function ChiamaEstero({
  telefono,
  etichetta,
  className,
  senzaWhatsapp,
}: {
  telefono: string;
  /** Il testo accanto alla cornetta («Chiama»); senza, è solo l'icona. */
  etichetta?: ReactNode;
  /** Sostituisce le misure/aspetto di base (es. per stare in una riga stretta). */
  className?: string;
  /** Vero dove accanto c'è già un tasto WhatsApp: non lo si duplica. */
  senzaWhatsapp?: boolean;
}) {
  const href = senzaWhatsapp
    ? ""
    : linkApriWhatsapp(telefono, typeof navigator === "undefined" ? "" : navigator.userAgent);
  return (
    <>
      <span
        role="button"
        aria-disabled="true"
        aria-label={TESTO_NUMERO_ESTERO}
        title={TESTO_NUMERO_ESTERO}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "inline-flex min-h-11 min-w-11 shrink-0 cursor-not-allowed select-none items-center justify-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2 text-[12px] font-semibold text-red-700 md:min-h-8 md:min-w-8",
          className,
        )}
      >
        <Phone aria-hidden="true" className="h-4 w-4" />
        {etichetta}
      </span>
      {href && (
        <a
          href={href}
          target={href.startsWith("https:") ? "_blank" : undefined}
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="Scrivi su WhatsApp"
          title="Scrivi su WhatsApp"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 md:min-h-8 md:min-w-8"
        >
          <IconaWhatsApp className="h-4 w-4" />
        </a>
      )}
    </>
  );
}
