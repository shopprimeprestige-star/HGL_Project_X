/** ── NOTE VOCALI · IL TASTO NELLA SCHEDA LEAD ───────────────────────────────
 *  Tocca «Detta una nota», parla, «Fatto»: il testo va in fondo alle note
 *  della scheda (lo decide chi lo usa, via `onTesto`) e resta lì da rileggere
 *  e correggere; si salva col solito «Salva». Il registratore è lo stesso della
 *  chat WhatsApp (chatwa/RegistratoreVoce).
 *  ⚠️ L'audio vive solo in memoria fino al testo; cambiando scheda o chiudendo,
 *   la registrazione si butta e il microfono si spegne.
 *  ⚠️ Solo appunti interni: da qui non parte niente verso nessuno. */
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvvisoDettatura, BarraDettatura, useDettatura } from "@/crm/chatwa/RegistratoreVoce";

export function NotaVocale({ onTesto }: { onTesto: (testo: string) => void }) {
  const d = useDettatura(onTesto);
  //  Nascosto se il browser non registra (la tastiera del telefono ha il suo microfono).
  if (!d.possibile) return null;
  const occupato = d.stato !== "ferma";
  return (
    <div className="mt-2">
      <AvvisoDettatura d={d} />
      {occupato ? (
        <BarraDettatura d={d} />
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={d.avvia}
          className="h-11 gap-2 md:h-9"
          title="Parla: il testo viene aggiunto in fondo alle note"
        >
          <Mic className="h-4 w-4" aria-hidden />
          Detta una nota
        </Button>
      )}
    </div>
  );
}
