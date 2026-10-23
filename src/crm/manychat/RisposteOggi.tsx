/** ── «OGGI»: CHI HA RISPOSTO E CHI NO AL RICONTATTO AUTOMATICO ───────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 5. Una striscia sotto
 *  «Da sentire»: da una parte chi ha risposto al ricontatto che il sistema ha
 *  mandato, dall'altra chi non ha risposto entro il tempo. Le regole (chi c'è,
 *  per quanti giorni) sono in `righeRisposteOggi` (vista-pannello.ts), provate.
 *  Qui si disegnano. Chi lavora una riga cambia il secondo stato dalla
 *  pastiglia (compatta): la riga esce da sola, perché non è più «risposto» o
 *  «non risposto» del sistema.
 *
 *  ⚠️ NESSUNA SCATOLA VUOTA: senza nessuno nella striscia non c'è.
 *  ⚠️ COLORE E PAROLA INSIEME: i titoli dicono «Hanno risposto» e «Non hanno
 *   risposto»; il verde e l'ambra aiutano, non bastano.
 *  ⚠️ IL TESTO DEL CLIENTE È TESTO SEMPLICE (React lo protegge): mai HTML.
 *  ⚠️ È SOLO IL RICONTATTO AUTOMATICO. Le risposte al promemoria e i cambi a
 *   mano non entrano qui.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Phone } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { linkChiamata } from "@/crm/promemoria/conferma";
import type { ContattoWa, Lead } from "@/crm/types";
import { cn } from "@/lib/utils";
import { PastigliaContatto } from "./PastigliaContatto";
import { giornoBreve, righeRisposteOggi, type RigaRisposteOggi } from "./vista-pannello";

/** Quante righe per gruppo; le altre si trovano col filtro «Stato del contatto». */
const MAX_RIGHE = 8;

function Gruppo({
  titolo,
  nota,
  righe,
  dettaglio,
  tono,
  onApri,
  onCambiato,
  adesso,
}: {
  titolo: string;
  nota: string;
  righe: RigaRisposteOggi<Lead>[];
  dettaglio: (r: RigaRisposteOggi<Lead>) => string;
  tono: "ok" | "attenzione";
  onApri?: (l: Lead) => void;
  onCambiato?: (l: Lead, c: ContattoWa) => void;
  adesso: Date;
}) {
  const id = useId();
  if (righe.length === 0) return null;
  const viste = righe.slice(0, MAX_RIGHE);
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h3
          id={id}
          className={cn(
            "whitespace-nowrap text-[13px] font-semibold uppercase tracking-wide",
            tono === "ok" ? "text-emerald-900" : "text-amber-900",
          )}
        >
          {titolo} · {righe.length}
        </h3>
        <span className="text-[11.5px] text-muted-foreground">{nota}</span>
      </div>
      <ul
        className={cn(
          "mt-1 divide-y",
          tono === "ok" ? "divide-emerald-200/70" : "divide-amber-200/70",
        )}
      >
        {viste.map((r) => {
          const l = r.scheda;
          const nome = `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || "Senza nome";
          const tel = linkChiamata(l.data.telefono);
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{nome}</span>
                <span className="block break-words text-[12px] text-muted-foreground">
                  {dettaglio(r)}
                </span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <PastigliaContatto
                  compatta
                  dati={l.data}
                  leadId={l.id}
                  contesto={nome}
                  adesso={adesso}
                  onCambiato={(c) => onCambiato?.(l, c)}
                />
                {tel && (
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <a href={tel} aria-label={`Chiama ${nome}`}>
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      Chiama
                    </a>
                  </Button>
                )}
                {onApri && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    aria-label={`Apri la scheda di ${nome}`}
                    onClick={() => onApri(l)}
                  >
                    Apri
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {righe.length > viste.length && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          e altri {righe.length - viste.length}: li trovi col filtro «Stato del contatto».
        </p>
      )}
    </section>
  );
}

export function RisposteOggi({
  leads,
  onApri,
  onCambiato,
  adesso,
  className,
}: {
  leads: Lead[];
  /** apre la scheda; senza, il tasto non c'è */
  onApri?: (l: Lead) => void;
  /** il secondo stato è stato cambiato a mano da una riga */
  onCambiato?: (l: Lead, contattoWa: ContattoWa) => void;
  adesso?: Date;
  className?: string;
}) {
  const ora = adesso ?? new Date();
  const { risposto, nonRisposto } = righeRisposteOggi(leads, ora);
  if (risposto.length === 0 && nonRisposto.length === 0) return null;
  return (
    <div
      className={cn("space-y-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5", className)}
    >
      <Gruppo
        titolo="Hanno risposto"
        nota="al ricontatto automatico su WhatsApp"
        righe={risposto}
        tono="ok"
        dettaglio={(r) =>
          [giornoBreve(r.quando), r.anteprima ? `“${r.anteprima}”` : "ha risposto senza testo"]
            .filter(Boolean)
            .join(" · ")
        }
        onApri={onApri}
        onCambiato={onCambiato}
        adesso={ora}
      />
      <Gruppo
        titolo="Non hanno risposto"
        nota="al ricontatto automatico: tocca a una persona"
        righe={nonRisposto}
        tono="attenzione"
        dettaglio={(r) => `Nessuna risposta entro il ${giornoBreve(r.quando)}`}
        onApri={onApri}
        onCambiato={onCambiato}
        adesso={ora}
      />
    </div>
  );
}
