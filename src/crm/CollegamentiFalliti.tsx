/** ── «COLLEGAMENTI FALLITI» · LA SCATOLA NERA DI MEETLY ────────────────────
 *
 *  Quando in una consulenza «ci si vede dentro ma non ci si vede» (camera e
 *  microfono spenti da entrambe le parti), il browser di chi era in stanza
 *  manda un rapporto tecnico dopo 15 secondi. Qui si leggono gli ultimi 50, con
 *  una frase in parole semplici su DOVE si è fermato il collegamento.
 *  Cosa raccoglie e cosa non esce mai: shop/scatola-nera.ts.
 *
 *  Ogni collegamento è UNA riga: il rapporto «blocco» e, se poi si è collegato,
 *  il suo «esito» (stesso `rid`) con il tempo impiegato.
 *  Se la tabella non c'è ancora (migrazione non applicata) lo dice, senza rompersi. */
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { diagnosi, pulisciRapporto, type Rapporto } from "@/shop/scatola-nera";
import { fetchCRM } from "./AuthContext";

type Riga = { creato_il: string; dati: unknown };
type Voce = { quando: string; blocco: Rapporto | null; esito: Rapporto | null };

/** Unisce blocco ed esito dello stesso collegamento; il più recente in cima. */
/** Il motivo del ripiego da SFU a collegamento diretto, in parole da leggere in una riga. */
const MOTIVO_RIPIEGO: Record<string, string> = {
  server: "errore del server",
  "timeout-pub": "invio dei media scaduto",
  "timeout-sub": "ricezione dei media scaduta",
  "ice-fallita": "rete non riuscita",
  "ospite-vecchio": "scheda non aggiornata",
  ospite: "un partecipante non si agganciava",
  "non-configurato": "SFU non configurato",
  "tr-mesh": "deciso dal consulente",
  "host-nuovo-senza-tr": "consulente ricaricato",
};

function raggruppa(righe: Riga[]): Voce[] {
  const per = new Map<string, Voce>();
  for (const r of righe) {
    const d = pulisciRapporto(r.dati);
    if (!d) continue;
    const v = per.get(d.rid) ?? { quando: r.creato_il, blocco: null, esito: null };
    if (d.tipo === "blocco") {
      v.blocco = d;
      v.quando = r.creato_il;
    } else v.esito = d;
    per.set(d.rid, v);
  }
  return [...per.values()].sort((a, b) => b.quando.localeCompare(a.quando));
}

const quandoStr = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function CollegamentiFalliti() {
  const [stato, setStato] = useState<"carico" | "ok" | "manca" | "errore">("carico");
  const [voci, setVoci] = useState<Voce[]>([]);

  const leggi = useCallback(async () => {
    setStato("carico");
    try {
      const r = await fetchCRM("/api/public/meetly-diagnosi");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(String(j?.error || r.status));
      if (j.mancaTabella) return setStato("manca");
      setVoci(raggruppa(Array.isArray(j.righe) ? j.righe : []));
      setStato("ok");
    } catch {
      setStato("errore");
    }
  }, []);

  useEffect(() => {
    void leggi();
  }, [leggi]);

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex flex-1 items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="h-4 w-4" /> Collegamenti falliti
        </p>
        <Button variant="outline" size="sm" onClick={() => void leggi()} disabled={stato === "carico"}>
          {stato === "carico" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Aggiorna
        </Button>
      </div>
      <p className="t-nota mt-1 text-muted-foreground">
        Quando due persone sono in stanza ma dopo 15 secondi non arriva né video né audio, il browser lo segnala qui
        (senza nomi, telefoni né indirizzi). Gli ultimi 50.
      </p>

      {stato === "manca" && (
        <p className="t-nota mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          La tabella dei rapporti non c&apos;è ancora: va applicata la migrazione <b>meetly_diagnosi</b>. Finché non c&apos;è,
          i rapporti non vengono salvati.
        </p>
      )}
      {stato === "errore" && (
        <p className="t-nota mt-3 text-destructive">Non riesco a leggere i rapporti. Riprova fra poco.</p>
      )}
      {stato === "ok" && voci.length === 0 && (
        <p className="t-nota mt-3 text-muted-foreground">Nessun collegamento fallito finora.</p>
      )}

      {stato === "ok" && voci.length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border">
          {voci.map((v) => {
            const r = (v.blocco ?? v.esito) as Rapporto;
            const d = v.blocco ? diagnosi(v.blocco) : null;
            const poi = v.esito && v.blocco ? diagnosi(v.esito).frase : "";
            const rete = [r.rete.tipo, r.rete.effettiva].filter(Boolean).join(" ");
            return (
              <li key={r.rid} className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-[8rem_1fr_auto]">
                <span className="t-etichetta text-muted-foreground">{quandoStr(v.quando)}</span>
                <span className="min-w-0">
                  <span className="t-riga block font-medium">{d ? d.frase : diagnosi(r).frase}</span>
                  <span className="t-nota block text-muted-foreground">
                    {r.ruolo === "consulente" ? "Lato consulente" : "Lato cliente"} · {r.browser} su {r.sistema}
                    {rete ? ` · ${rete}` : ""}
                    {r.hasTurn === false ? " · senza TURN" : ""}
                    {r.trasporto === "sfu" ? " · media via SFU" : ""}
                    {r.ripiego ? ` · tornato al collegamento diretto (${MOTIVO_RIPIEGO[r.ripiego] ?? "altro"})` : ""}
                  </span>
                </span>
                <span className="flex items-start gap-2 sm:justify-end">
                  {d && (
                    <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">{d.dove}</span>
                  )}
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${v.esito ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 bg-amber-500/5"}`}
                  >
                    {v.esito ? poi || "Collegato" : "Non collegato"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
