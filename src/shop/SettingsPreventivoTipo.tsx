/** ─────────────────────────────────────────────────────────────────────────
 *  "COSÌ LO VEDE IL CLIENTE" — il preventivo tipo
 *
 *  Vive in fondo sia alla scheda Listino sia alla scheda Sconti ed è sempre lo
 *  stesso: il conto della configurazione di partenza, gli sconti che partono da
 *  soli e il totale. È il posto in cui un prezzo sbagliato si vede PRIMA di
 *  mostrarlo a qualcuno che sta per pagarlo.
 *
 *  Sta in un file suo perché le due schede devono guardare lo stesso conto: se
 *  ognuna avesse il proprio, alzare un prezzo di là e togliere uno sconto di
 *  qua darebbe due totali diversi, ed entrambi convincenti.
 *  ───────────────────────────────────────────────────────────────────────── */

import { type ReactNode } from "react";
import { Tag } from "lucide-react";
import { formatPrice } from "@/shop/catalog";
import { QUANTITA, percentuale, type PreventivoTipo } from "@/shop/listino-condiviso";
import { Riquadro, Segmento } from "@/shop/settings-ui";

export function SchedaPreventivoTipo({
  calcolo,
  basi,
  onBase,
  onQuantita,
  nota,
}: {
  calcolo: PreventivoTipo;
  basi: { id: string; name: string }[];
  onBase: (id: string) => void;
  onQuantita: (q: number) => void;
  nota?: ReactNode;
}) {
  return (
    <Riquadro
      icona={Tag}
      titolo="Il preventivo tipo, come lo vede il cliente"
      nota="Configurazione di partenza del configuratore: è la prima schermata che si apre al cliente"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-white/45">
            Soluzione
          </span>
          {basi.map((b) => (
            <Segmento key={b.id} attivo={b.id === calcolo.baseId} onClick={() => onBase(b.id)}>
              {b.name.split("—")[0].trim()}
            </Segmento>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-white/45">
            Impianti
          </span>
          {QUANTITA.map((q) => (
            <Segmento key={q} attivo={q === calcolo.quantita} onClick={() => onQuantita(q)}>
              {q}
            </Segmento>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <ul className="space-y-1">
            {calcolo.voci.map((v, i) => (
              <li key={`${v.nome}-${i}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[12.5px] text-white/55">{v.nome}</span>
                <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-white/85">
                  {v.eur === 0 ? "incluso" : formatPrice(v.eur)}
                </span>
              </li>
            ))}
          </ul>

          {calcolo.quantita > 1 && (
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-white/10 pt-2">
              <span className="text-[12.5px] text-white/55">
                {formatPrice(calcolo.perImpianto)} × {calcolo.quantita} impianti
              </span>
              <span className="text-[12.5px] font-medium tabular-nums text-white/85">
                {formatPrice(calcolo.perImpianto * calcolo.quantita)}
              </span>
            </div>
          )}
          {calcolo.analisi > 0 && (
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] text-white/55">
                Analisi del colore (una volta sola)
              </span>
              <span className="text-[12.5px] font-medium tabular-nums text-white/85">
                {formatPrice(calcolo.analisi)}
              </span>
            </div>
          )}

          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-white/10 pt-2">
            <span className="text-[12.5px] font-medium text-white/80">Totale di listino</span>
            <span
              className={`text-[13px] font-semibold tabular-nums ${
                calcolo.sconto > 0 ? "text-white/40 line-through" : "text-white"
              }`}
            >
              {formatPrice(calcolo.lordo)}
            </span>
          </div>

          {calcolo.sconti.map((s, i) => (
            <div key={`${s.nome}-${i}`} className="mt-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[12.5px] text-emerald-300">{s.nome}</span>
              <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-emerald-300">
                −{formatPrice(s.eur)} · {percentuale(s.eur, calcolo.lordo)}
              </span>
            </div>
          ))}

          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-white/10 pt-2">
            <span className="text-[12.5px] font-medium text-white/80">
              Totale che vede il cliente
            </span>
            <span className="text-[19px] font-semibold leading-tight tabular-nums text-white">
              {formatPrice(calcolo.totale)}
            </span>
          </div>
        </div>

        {nota}
      </div>
    </Riquadro>
  );
}
