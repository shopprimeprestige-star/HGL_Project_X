/** ── DOPPIONI — LA STESSA PERSONA, DUE SCHEDE ──────────────────────────────
 *
 *  Misurato in archivio il 7/10/2026: ventinove numeri con due schede a testa,
 *  cinquantotto schede in tutto. *Cristiano Sibilia* stava sia in «da
 *  ricontattare» che in «acconto incassato». Due storie della stessa persona, e
 *  chi la chiama ne legge una a caso.
 *
 *  Le regole — chi resta, che cosa si copia, che cosa non si copia mai — stanno
 *  in `crm/doppioni` e si provano senza browser. Qui c'è solo il modo di
 *  guardarle una accanto all'altra e rispondere.
 *
 *  ⚠️ DUE RISPOSTE, NON UNA. «Unisci» e «Non è la stessa persona» valgono
 *   uguale: due fratelli con il numero di casa in comune non sono un errore da
 *   sistemare, e senza la seconda risposta quella coppia ricompare ogni volta
 *   che si apre la pagina finché nessuno la guarda più.
 *  ⚠️ NON SI CANCELLA NIENTE: la scheda assorbita resta in archivio, segnata e
 *   messa da parte. È reversibile, e questo è ciò che permette di unire senza
 *   dover essere sicuri al cento per cento.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Copy, Merge, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lead, LeadData } from "@/crm/types";
import {
  CLASSE_BADGE_STATO,
  Scheda,
  Vuoto,
  classiStato,
  dataBreve,
  etichettaStato,
} from "@/crm/ui";
import { patchUnione, type GruppoDoppio } from "@/crm/doppioni";

export function SchedaDoppioni({
  gruppi,
  onApri,
  onUnisci,
  onDiverse,
}: {
  gruppi: GruppoDoppio[];
  onApri: (l: Lead) => void;
  /** Unisce l'assorbita dentro la principale. L'ordine conta: il primo resta. */
  onUnisci: (principale: Lead, assorbita: Lead) => void;
  /** «Non è la stessa persona»: la coppia non si ripropone più. */
  onDiverse: (a: Lead, b: Lead) => void;
}) {
  if (gruppi.length === 0)
    return (
      <Vuoto
        titolo="Nessun doppione"
        icona={Copy}
        testo="Non ci sono due schede con lo stesso numero di telefono. Quando ne compare una, la trovi qui: l'avviso del campo rosso ferma i doppioni nuovi, questa scheda serve a quelli già dentro."
      />
    );

  const quante = gruppi.reduce((t, g) => t + g.schede.length, 0);

  return (
    <Scheda
      titolo="Doppioni"
      nota={`${gruppi.length === 1 ? "1 numero" : `${gruppi.length} numeri`} con più di una scheda · ${quante} schede in tutto · in cima i gruppi più affollati`}
      icona={Copy}
      senzaPadding
    >
      <ul className="divide-y divide-border">
        {gruppi.map((g) => {
          const [capo, ...altre] = g.schede;
          return (
            <li key={g.chiave} className="px-4 py-4">
              <p className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                …{g.chiave.slice(-6)} · {g.schede.length} schede
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <Colonna lead={capo} principale onApri={() => onApri(capo)} />
                {altre.map((a) => (
                  <div key={a.id} className="space-y-2">
                    <Colonna lead={a} onApri={() => onApri(a)} />
                    {/*  Che cosa si prenderebbe davvero: detto PRIMA di
                        premere, perché «unisci» da solo non dice niente su che
                        cosa succede ai dati. */}
                    <CosaSiPrende principale={capo} assorbita={a} />
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        onClick={() => onUnisci(capo, a)}
                        title="Copia sulla scheda che resta solo i campi che le mancano, mette in fila le note, e mette questa da parte segnando dov'è andata. Non si cancella niente."
                      >
                        <Merge className="mr-1 h-3.5 w-3.5" /> Unisci dentro{" "}
                        {capo.data?.nome || "l'altra"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => onDiverse(capo, a)}
                        title="Due persone che condividono un numero: madre e figlia, marito e moglie, il centralino di un'azienda. La coppia non ricomparirà più"
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Non è la stessa persona
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Scheda>
  );
}

function Colonna({
  lead,
  principale,
  onApri,
}: {
  lead: Lead;
  principale?: boolean;
  onApri: () => void;
}) {
  const d = lead.data ?? ({} as LeadData);
  const nome = `${d.nome || ""} ${d.cognome || ""}`.trim() || "Senza nome";
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        principale ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onApri}
          className="truncate text-[13.5px] font-semibold underline-offset-2 hover:underline"
        >
          {nome}
        </button>
        <span className={cn(CLASSE_BADGE_STATO, classiStato(d.stato))}>
          {etichettaStato(d.stato)}
        </span>
        {principale && (
          <span
            className={cn(CLASSE_BADGE_STATO, "border-primary/40 bg-primary/10 text-primary")}
            title="È quella con la storia più avanti: resta lei, e si prende quello che le manca"
          >
            resta questa
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
        {[
          d.telefono || "senza telefono",
          d.email || null,
          d.citta || null,
          d.dataMeeting ? `consulenza del ${dataBreve(d.dataMeeting)}` : null,
          `creata il ${dataBreve(lead.created_at)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {String(d.note || "").trim() && (
        <p className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground">
          {String(d.note).replace(/\s+/g, " ")}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-1 h-7 px-2 text-[12px]"
        onClick={onApri}
      >
        <User className="mr-1 h-3.5 w-3.5" /> Apri la scheda
      </Button>
    </div>
  );
}

/** ⚠️ CHE COSA SI PRENDE, DETTO PRIMA. «Unisci» da solo non dice niente su che
 *  cosa succede ai dati, e un pulsante che tocca due schede senza annunciare
 *  che cosa fa non lo preme nessuno — o lo premono tutti, che è peggio. */
function CosaSiPrende({ principale, assorbita }: { principale: Lead; assorbita: Lead }) {
  const patch = patchUnione(principale, assorbita);
  const campi = Object.keys(patch);
  if (campi.length === 0)
    return (
      <p className="text-[11.5px] text-muted-foreground">
        Non c'è niente da copiare: la scheda che resta ha già tutto.
      </p>
    );
  return (
    <p className="text-[11.5px] text-muted-foreground">
      Si copiano <span className="font-medium text-foreground">{campi.join(", ")}</span>
      {campi.includes("note") ? " (le note si mettono in fila, non si sostituiscono)" : ""}. Lo
      stato non si tocca.
    </p>
  );
}
