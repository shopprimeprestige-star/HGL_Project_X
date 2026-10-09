/** ── LA CORNETTA ───────────────────────────────────────────────────────────
 *
 *  Per un setter la telefonata non è un'azione fra le altre: è IL lavoro. Il
 *  tasto per chiamare non è un'iconcina, è il comando pieno e alto della scheda.
 *
 *  ⚠️ SUL COMPUTER UN COLLEGAMENTO tel: PUÒ NON FARE NULLA. Se non c'è un'app
 *  associata il clic non apre niente, il tasto sembra rotto, si preme tre volte
 *  e si perde la chiamata. Non c'è modo di saperlo DOPO, quindi si decide PRIMA
 *  guardando l'apparecchio: dove il dito è l'unico modo di puntare (telefono,
 *  tablet) il tasto è un collegamento tel: diretto; altrove apre un riquadro col
 *  numero grande, il tasto per copiarlo e — per chi il programma per chiamare ce
 *  l'ha davvero — il collegamento tel:. Meglio un riquadro in più che un tasto
 *  che non fa niente.
 *
 *  ── PERCHÉ STA IN UN FILE SUO ─────────────────────────────────────────────
 *  Stava dentro routes/CRM.importa.tsx, ed era giusto finché a chiamare era una
 *  scheda sola. Adesso la stessa pagina ha due punti da cui si alza la cornetta
 *  — la scheda del prossimo e le righe scadute della sotto-scheda «Oggi» — e
 *  quel riquadro col numero grande è l'unica cosa che rende il tasto onesto su
 *  un computer. Copiarlo nel secondo punto avrebbe voluto dire che un giorno
 *  uno dei due torna a essere un tel: cieco.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Pannello } from "@/crm/ui/Finestra";

/** Vero solo dove il dito è l'unico modo di puntare. Si calcola dopo il
 *  montaggio: nel render sul server `window` non esiste. */
export function useApparecchioCheChiama(): boolean {
  const [sì, setSì] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    setSì(window.matchMedia("(hover: none) and (pointer: coarse)").matches);
  }, []);
  return sì;
}

/** Il numero come lo vuole `tel:`. A schermo si legge come sta in archivio —
 *  spazi compresi, è così che il setter lo riconosce — ma dentro il
 *  collegamento no: uno spazio o una parentesi è un carattere che certi
 *  telefoni non compongono. Restano le cifre e il `+` iniziale, l'unico segno
 *  che cambia davvero la chiamata. */
export function numeroDaComporre(grezzo: string): string {
  const cifre = String(grezzo || "").replace(/[^\d]/g, "");
  if (!cifre) return "";
  return `${String(grezzo).trim().startsWith("+") ? "+" : ""}${cifre}`;
}

export async function copiaNegliAppunti(testo: string) {
  //  In HTTP semplice (rete locale, anteprime) `navigator.clipboard` non
  //  esiste: dirlo è meglio che fingere una copia mai avvenuta.
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.message("Copia il numero a mano", { description: testo });
    return;
  }
  try {
    await navigator.clipboard.writeText(testo);
    toast.success("Numero copiato");
  } catch {
    toast.message("Copia il numero a mano", { description: testo });
  }
}

export function TastoChiama({
  telefono,
  /** `compatto` è la cornetta di una RIGA di elenco, non il comando della
   *  scheda: stessa identica logica, misura da riga. Un secondo componente
   *  «piccolo» sarebbe la copia che fra un mese perde il riquadro del numero. */
  compatto,
}: {
  telefono: string;
  compatto?: boolean;
}) {
  //  Gli hook stanno tutti sopra qualunque uscita anticipata: senza numero si
  //  esce dopo, non prima (React 310 = schermata bianca in produzione).
  const daDito = useApparecchioCheChiama();
  const [aperto, setAperto] = useState(false);
  const componibile = numeroDaComporre(telefono);
  const misura = compatto ? "sm" : "lg";
  const classe = compatto
    ? "h-8 shrink-0 px-2.5 text-[12px] font-semibold"
    : "h-12 flex-1 min-w-[9rem] text-[15px] font-semibold";
  const icona = compatto ? "mr-1.5 h-3.5 w-3.5" : "mr-2 h-4 w-4";

  if (!componibile) {
    return (
      <Button size={misura} disabled className={classe} title="Questa scheda non ha un numero">
        <Phone className={icona} /> {compatto ? "Senza numero" : "Numero mancante"}
      </Button>
    );
  }

  if (daDito) {
    return (
      <Button asChild size={misura} className={classe}>
        <a href={`tel:${componibile}`} title={`Chiama ${telefono}`}>
          <Phone className={icona} /> Chiama
        </a>
      </Button>
    );
  }

  return (
    <Popover open={aperto} onOpenChange={setAperto}>
      <PopoverTrigger asChild>
        <Button size={misura} className={classe} title={`Chiama ${telefono}`}>
          <Phone className={icona} /> Chiama
        </Button>
      </PopoverTrigger>
      <Pannello align="start" className="w-72" titolo="Il numero" contesto={telefono}>
        <div className="space-y-2">
          <div className="select-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-[19px] font-semibold tabular-nums tracking-wide text-slate-900">
            {telefono}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => void copiaNegliAppunti(telefono)}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copia
            </Button>
            <Button asChild size="sm" className="flex-1">
              <a href={`tel:${componibile}`} onClick={() => setAperto(false)}>
                <Phone className="mr-1.5 h-3.5 w-3.5" /> Apri
              </a>
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-slate-500">
            «Apri» funziona solo se su questo computer c'è un programma per telefonare. Se non
            succede niente, copia il numero.
          </p>
        </div>
      </Pannello>
    </Popover>
  );
}
