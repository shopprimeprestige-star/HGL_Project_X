/** ── CRUSCOTTO WHATSAPP · LA PAGINA (pacchetto p4-cruscotto-wa) ─────────────
 *  Legge un riepilogo dal server (`/api/crm/cruscotto-wa`): nessun dato di cliente.
 *  Sezioni: avviso saldo, totali, giorno per giorno, per modello, costo stimato,
 *  velocità di risposta per consulente. Le due impostazioni (tariffe e soglia) si
 *  cambiano da qui. */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { fetchCRM } from "@/crm/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagina, Titolo } from "@/crm/ui";
import { cn } from "@/lib/utils";
import { euro } from "@/crm/chatwa/costi-whatsapp";
import { PERIODI_CRUSCOTTO, type PeriodoCruscotto } from "./calcolo";
import type { Cruscotto } from "./leggi.server";

type Lettura =
  | { fase: "carico" }
  | { fase: "errore"; frase: string }
  | { fase: "ok"; c: Cruscotto };
const FRASE_RETE = "Non riesco a leggere il cruscotto: controlla la connessione e riprova.";
const pct = (n: number | null) => (n === null ? "—" : `${String(n).replace(".", ",")}%`);
const minuti = (n: number | null) => (n === null ? "—" : `${String(n).replace(".", ",")} min`);
const giornoBreve = (g: string) => `${g.slice(8, 10)}/${g.slice(5, 7)}`;

export function PaginaCruscotto() {
  const [periodo, setPeriodo] = useState<PeriodoCruscotto>("7");
  const [lettura, setLettura] = useState<Lettura>({ fase: "carico" });
  const [tentativo, setTentativo] = useState(0);

  useEffect(() => {
    let annullata = false;
    setLettura({ fase: "carico" });
    (async () => {
      try {
        const res = await fetchCRM(`/api/crm/cruscotto-wa?periodo=${periodo}`);
        const corpo = (await res.json().catch(() => null)) as {
          cruscotto?: Cruscotto;
          error?: unknown;
        } | null;
        if (annullata) return;
        if (res.ok && corpo?.cruscotto) setLettura({ fase: "ok", c: corpo.cruscotto });
        else
          setLettura({
            fase: "errore",
            frase:
              res.status === 403
                ? "Questa pagina è solo per chi gestisce le impostazioni."
                : typeof corpo?.error === "string"
                  ? corpo.error
                  : FRASE_RETE,
          });
      } catch {
        if (!annullata) setLettura({ fase: "errore", frase: FRASE_RETE });
      }
    })();
    return () => {
      annullata = true;
    };
  }, [periodo, tentativo]);

  return (
    <Pagina larga>
      <Titolo testo="Cruscotto WhatsApp" icona={MessageCircle} />
      <div role="group" aria-label="Periodo" className="mb-4 flex flex-wrap gap-1.5">
        {PERIODI_CRUSCOTTO.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={periodo === p.id}
            onClick={() => setPeriodo(p.id)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              periodo === p.id
                ? "border-foreground bg-foreground font-medium text-background"
                : "border-border bg-background hover:bg-accent",
            )}
          >
            {p.etichetta}
          </button>
        ))}
      </div>

      {lettura.fase === "carico" && (
        <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calcolo…
        </p>
      )}
      {lettura.fase === "errore" && (
        <div role="alert" className="flex flex-col items-start gap-2 py-4">
          <p className="text-[13px]">{lettura.frase}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setTentativo((n) => n + 1)}
          >
            Riprova
          </Button>
        </div>
      )}
      {lettura.fase === "ok" && (
        <Corpo c={lettura.c} onSalvato={() => setTentativo((n) => n + 1)} />
      )}
    </Pagina>
  );
}

function Corpo({ c, onSalvato }: { c: Cruscotto; onSalvato: () => void }) {
  const { totali } = c;
  return (
    <div className="space-y-6">
      <AvvisoSaldo saldo={c.saldo} />
      {c.troncato && (
        <p className="text-[12px] text-amber-700">
          Ci sono più righe di quelle che la pagina legge in una volta: i numeri sono per difetto.
        </p>
      )}
      <section aria-label="Totali" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Numero
          etichetta="Messaggi inviati"
          valore={totali.inviati}
          nota={totali.dalTelefono ? `+ ${totali.dalTelefono} dal telefono` : undefined}
        />
        <Numero etichetta="Risposte (persone)" valore={totali.risposte} />
        <Numero etichetta="Prenotazioni" valore={totali.prenotazioni} />
        <Numero
          etichetta="Costo stimato"
          valore={`≈ ${euro(c.costo.totale, 2)}`}
          nota={`${c.costo.messaggi} a pagamento`}
        />
      </section>

      <Sezione titolo="Giorno per giorno">
        <Tabella
          intest={["Giorno", "Inviati", "Risposte", "Prenotazioni"]}
          righe={[...c.giorni]
            .reverse()
            .map((g) => [giornoBreve(g.giorno), g.inviati, g.risposte, g.prenotazioni])}
        />
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Risposte = persone diverse che hanno scritto quel giorno (eco e doppioni esclusi).
          Prenotazioni = appuntamenti presi quel giorno da lead già toccati da WhatsApp.
        </p>
      </Sezione>

      <Sezione titolo="Per modello">
        {c.modelli.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Nessun modello inviato in questo periodo.
          </p>
        ) : (
          <Tabella
            intest={["Modello", "Inviati", "Risposta", "Prenotazione", "Costo"]}
            righe={c.modelli.map((m) => [
              m.modello.replace(/^hgl_/, ""),
              m.inviati,
              `${pct(m.tassoRisposta)} (${m.risposte})`,
              `${pct(m.tassoPrenotazione)} (${m.prenotazioni})`,
              euro(m.costo, 2),
            ])}
          />
        )}
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Risposta = il cliente ha scritto dopo il messaggio. Prenotazione = ha preso appuntamento
          entro 7 giorni (calcolata sugli invii collegati a una scheda).
        </p>
      </Sezione>

      <Sezione titolo="Costo dei messaggi a pagamento">
        <Tabella
          intest={["Categoria", "Messaggi", "Tariffa", "Costo"]}
          righe={c.costo.categorie.map((x) => [
            x.categoria === "marketing" ? "Marketing" : "Utility",
            x.messaggi,
            euro(x.tariffa, 4),
            euro(x.costo, 2),
          ])}
        />
        {c.costo.stimati > 0 && (
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {c.costo.stimati} messaggi di cui non si conosce il modello esatto: categoria stimata.
          </p>
        )}
        <Impostazioni c={c} onSalvato={onSalvato} />
      </Sezione>

      <Sezione titolo={`Velocità di risposta ai lead nuovi (soglia ${c.sogliaMinuti} min)`}>
        {c.consulenti.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nessun lead nuovo in questo periodo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {c.consulenti.map((r) => (
              <li
                key={r.consulenteId || "nessuno"}
                className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
              >
                <p className="flex items-center gap-1.5 text-[13px] font-medium">
                  {r.avviso && (
                    <AlertTriangle aria-label="Oltre la soglia" className="h-4 w-4 text-red-600" />
                  )}
                  {r.nome}
                </p>
                <p className="text-[12.5px] tabular-nums text-muted-foreground">
                  {r.lead} lead · mediana {minuti(r.medianaMinuti)} · entro soglia{" "}
                  {pct(r.entroSoglia)}
                  {r.inAttesa > 0 &&
                    ` · ${r.inAttesa} in attesa${r.inRitardoOra ? ` (${r.inRitardoOra} in ritardo)` : ""}`}
                  {r.senzaDato > 0 && ` · ${r.senzaDato} senza dato`}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Tempo fra l&apos;arrivo del lead e il primo contatto (stesso calcolo del «tempo di prima
          risposta» di AIOS). Rosso se la mediana supera la soglia o c&apos;è un lead ancora da
          contattare oltre la soglia.
        </p>
      </Sezione>
    </div>
  );
}

function AvvisoSaldo({ saldo }: { saldo: Cruscotto["saldo"] }) {
  const rosso = saldo.livello === "allarme";
  const giallo = saldo.livello === "attenzione";
  const Icona = rosso || giallo ? AlertTriangle : CheckCircle2;
  return (
    <section
      role={rosso ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px]",
        rosso && "border-red-300 bg-red-50 text-red-900",
        giallo && "border-amber-300 bg-amber-50 text-amber-900",
        !rosso && !giallo && "border-border bg-muted/40 text-foreground",
      )}
    >
      <Icona className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Saldo di invio (segnale indiretto)</p>
        <p>{saldo.frase}</p>
        {saldo.livello === "ok" && (
          <p className="text-[12px] text-muted-foreground">{saldo.fraseManuale}</p>
        )}
      </div>
    </section>
  );
}

function Numero({
  etichetta,
  valore,
  nota,
}: {
  etichetta: string;
  valore: string | number;
  nota?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[12px] text-muted-foreground">{etichetta}</p>
      <p className="text-[24px] font-semibold leading-tight tabular-nums">{valore}</p>
      {nota && <p className="text-[11.5px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[14px] font-semibold">{titolo}</h2>
      {children}
    </section>
  );
}

function Tabella({ intest, righe }: { intest: string[]; righe: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
            {intest.map((h, i) => (
              <th key={h} className={cn("py-1.5 pr-3 font-medium", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {righe.map((r, k) => (
            <tr key={k} className="border-b border-border/60">
              {r.map((v, i) => (
                <td key={i} className={cn("py-1.5 pr-3 tabular-nums", i > 0 && "text-right")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Impostazioni({ c, onSalvato }: { c: Cruscotto; onSalvato: () => void }) {
  const t = c.impostazioni.tariffe;
  const [mk, setMk] = useState(String(t.marketing).replace(".", ","));
  const [ut, setUt] = useState(String(t.utility).replace(".", ","));
  const [so, setSo] = useState(String(c.impostazioni.sogliaMinuti));
  const [esito, setEsito] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const salva = useCallback(async () => {
    setInvio(true);
    setEsito(null);
    try {
      const res = await fetchCRM("/api/crm/cruscotto-wa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariffe: { marketing: mk, utility: ut }, sogliaMinuti: so }),
      });
      const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setEsito("Salvato.");
        onSalvato();
      } else setEsito(corpo?.error ?? "Non riesco a salvare.");
    } catch {
      setEsito("Non riesco a salvare: controlla la connessione.");
    } finally {
      setInvio(false);
    }
  }, [mk, ut, so, onSalvato]);
  return (
    <details className="mt-3 rounded-lg border border-border px-3 py-2">
      <summary className="min-h-11 cursor-pointer py-2 text-[13px] font-medium">
        Tariffe e soglia
        {c.costo.tariffePersonalizzate ? " (personalizzate)" : " (listino Meta Italia)"}
      </summary>
      <div className="grid gap-2 py-2 sm:grid-cols-3">
        <label className="text-[12px]">
          Marketing, € a messaggio
          <Input inputMode="decimal" value={mk} onChange={(e) => setMk(e.target.value)} />
        </label>
        <label className="text-[12px]">
          Utility, € a messaggio
          <Input inputMode="decimal" value={ut} onChange={(e) => setUt(e.target.value)} />
        </label>
        <label className="text-[12px]">
          Soglia di risposta, minuti
          <Input inputMode="numeric" value={so} onChange={(e) => setSo(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" className="min-h-11" disabled={invio} onClick={salva}>
          Salva
        </Button>
        {esito && (
          <p role="status" className="text-[12.5px]">
            {esito}
          </p>
        )}
      </div>
      {!c.impostazioni.salvabili && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Per salvare serve l&apos;aggiornamento del database (non ancora applicato): per ora
          valgono i valori di serie.
        </p>
      )}
    </details>
  );
}
