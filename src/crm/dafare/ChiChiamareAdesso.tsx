/** ── «CHI CHIAMARE ADESSO», IN CIMA A «DA FARE OGGI» ────────────────────────
 *
 *  Commessa 2026-10-30 (idea 7). Le regole e l'ordine stanno in
 *  crm/chi-chiamare-adesso e si provano senza browser: qui si disegnano e
 *  basta.
 *  ⚠️ CINQUE RIGHE, NON CINQUANTA: la domanda è «chi chiamo adesso», e la
 *   risposta è la prima riga. Le altre si aprono con un tasto che dice quante
 *   sono: un elenco lungo in cima spingerebbe la giornata fuori dallo schermo.
 *  ⚠️ LA RIGA APRE LA SCHEDA, IL TELEFONO CHIAMA: due gesti, due tasti.
 *  ───────────────────────────────────────────────────────────────────────── */
import { BadgeChiamate, useSegnaChiamata } from "@/crm/ContaChiamate";
import { useState } from "react";
import { Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chiamabile } from "@/crm/chiamabile";
import { ChiamaEstero } from "@/crm/ChiamaEstero";
import { cn } from "@/lib/utils";
import { CLASSE_BADGE_STATO, Scheda } from "@/crm/ui";
import { TemperaturaRiga } from "@/crm/Temperatura";
import type { Lead } from "@/crm/types";
import { NOME_MOTIVO_ADESSO, type MotivoAdesso, type VoceAdesso } from "@/crm/chi-chiamare-adesso";

const PRIME = 5;

const COLORE: Record<MotivoAdesso, string> = {
  risposto: "border-emerald-300 bg-emerald-50 text-emerald-800",
  richiamo: "border-red-200 bg-red-50 text-red-800",
  caldo: "border-orange-200 bg-orange-50 text-orange-800",
  daChiamare: "border-slate-200 bg-slate-50 text-slate-700",
};

const nomeDi = (l: Lead) =>
  `${l.data?.nome ?? ""} ${l.data?.cognome ?? ""}`.trim() || l.data?.telefono || "Senza nome";

export function ChiChiamareAdesso({
  voci,
  nomeConsulente,
  mostraConsulente,
  onApri,
  nota,
}: {
  voci: VoceAdesso<Lead>[];
  nomeConsulente: (id?: string | null) => string;
  /** Con il filtro su una persona sola il nome sarebbe ripetuto su ogni riga. */
  mostraConsulente: boolean;
  onApri: (id: string) => void;
  /** Di chi è l'elenco: «i tuoi», «di tutti»… */
  nota: string;
}) {
  const segnaChiamata = useSegnaChiamata();
  const [tutte, setTutte] = useState(false);
  if (voci.length === 0) return null;
  const visibili = tutte ? voci : voci.slice(0, PRIME);
  return (
    <Scheda
      titolo="Chi chiamare adesso"
      nota={`${voci.length} ${voci.length === 1 ? "persona" : "persone"} · ${nota} · prima chi ha risposto, poi i richiami scaduti, i caldi e gli altri`}
      icona={PhoneCall}
      senzaPadding
    >
      <ol className="divide-y divide-border">
        {visibili.map((v, i) => {
          const d = v.lead.data;
          const tel = String(d?.telefono ?? "").replace(/[^\d+]/g, "");
          const chi = mostraConsulente ? nomeConsulente(d?.consulenteId) : "";
          return (
            <li key={v.lead.id} className="flex items-center gap-2 px-3 py-2 sm:px-4">
              <span className="w-5 shrink-0 text-right text-[11.5px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onApri(v.lead.id)}
                className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-semibold">{nomeDi(v.lead)}</span>
                  <span className={cn(CLASSE_BADGE_STATO, COLORE[v.motivo])}>
                    {NOME_MOTIVO_ADESSO[v.motivo]}
                  </span>
                  {d && v.motivo !== "caldo" && (
                    <TemperaturaRiga dati={d} soloPallino className="shrink-0" />
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                  {[v.testo, chi ? `di ${chi}` : ""].filter(Boolean).join(" · ")}
                </span>
              </button>
              {tel && !chiamabile(tel) && (
                <ChiamaEstero
                  telefono={tel}
                  etichetta={<span className="sr-only sm:not-sr-only">Chiama</span>}
                />
              )}
              {tel && chiamabile(tel) && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="relative h-8 shrink-0 px-2.5"
                  title={`Chiama ${nomeDi(v.lead)}`}
                >
                  <a href={`tel:${tel}`} onClick={() => segnaChiamata(v.lead)}>
                    <Phone className="h-3.5 w-3.5" />
                    <BadgeChiamate lead={v.lead} />
                    <span className="sr-only sm:not-sr-only sm:ml-1">Chiama</span>
                  </a>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {voci.length > PRIME && (
        <div className="border-t border-border px-3 py-2 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[12.5px]"
            onClick={() => setTutte((x) => !x)}
          >
            {tutte ? `Solo le prime ${PRIME}` : `Mostra tutte e ${voci.length}`}
          </Button>
        </div>
      )}
    </Scheda>
  );
}
