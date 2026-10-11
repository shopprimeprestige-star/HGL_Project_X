/** ── LE ANTEPRIME DI QUESTA PERSONA ────────────────────────────────────────
 *
 *  Un pulsante con il numero, e un riquadro che si apre sopra la scheda con
 *  tutte le prove che quella persona si è fatta.
 *
 *  ── ⚠️ PERCHÉ UN POPUP E NON UNA SEZIONE DELLA SCHEDA ────────────────────
 *  La scheda di un lead si apre col cliente al telefono: quello che ci sta
 *  dentro deve essere leggibile in due secondi — stato, numero, prossima cosa
 *  da fare. Dieci fotografie in mezzo spingerebbero tutto il resto sotto la
 *  piega, e le si guarda una volta su venti. Un pulsante che dice QUANTE ce ne
 *  sono occupa una riga e le rende raggiungibili in un tocco.
 *
 *  ── ⚠️ E SI APRONO GRANDI ────────────────────────────────────────────────
 *  Sono facce: un francobollo non serve a niente. Toccandone una si vede a
 *  schermo pieno, perché il gesto vero è mostrarla — al cliente accanto, o a
 *  sé stessi prima di richiamarlo.
 */
import { useState } from "react";
import { Images, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AnteprimaSalvata {
  immagine: string;
  taglio?: string;
  colore?: string;
  quando?: string;
  codice?: string;
}

const quando = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";

export function AnteprimeLead({ anteprime }: { anteprime: AnteprimaSalvata[] }) {
  const [aperto, setAperto] = useState(false);
  const [grande, setGrande] = useState("");

  //  ⚠️ Nessuna anteprima = nessun pulsante. Un pulsante che si preme e mostra
  //   il vuoto è peggio di non averlo: si impara che non serve, e poi non lo si
  //   preme nemmeno il giorno in cui dentro c'è qualcosa.
  if (!anteprime.length) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAperto(true)} className="gap-1.5">
        <Images className="h-3.5 w-3.5" />
        {anteprime.length} {anteprime.length === 1 ? "anteprima" : "anteprime"}
      </Button>

      {aperto && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => (grande ? setGrande("") : setAperto(false))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b1224] p-4 text-white shadow-2xl"
          >
            <div className="mb-3 flex items-center gap-2">
              <Images className="h-4 w-4 text-blue-300" />
              <p className="min-w-0 flex-1 font-semibold">Come si è visto</p>
              <button onClick={() => setAperto(false)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10" aria-label="Chiudi">
                <X className="h-4 w-4" />
              </button>
            </div>

            {grande ? (
              <button onClick={() => setGrande("")} className="block w-full">
                <img src={grande} alt="" className="mx-auto max-h-[70vh] rounded-xl border border-white/10" />
                <p className="mt-2 text-center text-[12px] text-white/40">Tocca per tornare a tutte</p>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {anteprime.map((a, i) => (
                  <button
                    key={`${a.immagine.slice(-20)}-${i}`}
                    onClick={() => setGrande(a.immagine)}
                    className="overflow-hidden rounded-xl border border-white/10 text-left transition hover:border-white/30"
                  >
                    <img src={a.immagine} alt={a.taglio || ""} loading="lazy" className="aspect-square w-full object-cover" />
                    <span className="block truncate px-2 pt-1.5 text-[12px] font-medium">
                      {a.taglio || "prova"}
                    </span>
                    <span className="block truncate px-2 pb-1.5 text-[11px] text-white/35">
                      {[a.colore, quando(a.quando)].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
