/** ── IMPOSTAZIONI · COME VIAGGIANO AUDIO E VIDEO ───────────────────────────
 *  L'interruttore del trasporto delle consulenze (commessa 2026-10-31-meetly-
 *  connessione, Parte B). Due strade:
 *   · «mesh» — audio e video vanno direttamente da un partecipante all'altro.
 *              È quella di sempre e quella di serie.
 *   · «sfu»  — passano dai server Cloudflare di Meetly. È in prova.
 *
 *  ⚠️ NIENTE SEGRETI QUI. Le chiavi dell'app Cloudflare di Meetly sono segreti
 *   del servizio: questo pannello non le vede, non le chiede e non le scrive.
 *   Chiede alla rotta soltanto «sono a posto?» (`pronto`, sì o no). Senza
 *   chiavi la scelta SFU è spenta e la ragione è scritta accanto, in chiaro:
 *   un titolare non deve scoprirla passando col mouse sopra un pulsante.
 *
 *  Il valore salvato vale per le NUOVE consulenze: quella in corso non lo
 *  rilegge. La rotta rifiuta comunque `sfu` senza chiavi (409): la guardia sul
 *  pulsante è cortesia, quella vera sta sul server.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Route, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fetchCRM } from "./AuthContext";

type Trasporto = "mesh" | "sfu";

const ROTTA = "/api/public/meetly-sfu";
//  La scelta in uso si riconosce a colpo d'occhio (non solo dal pallino).
const RIGA =
  "flex items-start gap-3 rounded-lg border p-3 transition has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5";

export function ImpostazioneTrasporto() {
  const [carico, setCarico] = useState(true);
  const [errore, setErrore] = useState(false);
  //  Quello che c'è sul server (riga assente o illeggibile = mesh) e quello che si è scelto.
  const [salvato, setSalvato] = useState<Trasporto>("mesh");
  const [scelto, setScelto] = useState<Trasporto>("mesh");
  const [pronto, setPronto] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const leggi = useCallback(async () => {
    setErrore(false);
    try {
      const r = await fetchCRM(`${ROTTA}?stato=1`);
      const j = await r.json();
      if (!r.ok || !j || j.error) throw new Error("lettura");
      const t: Trasporto = j.trasporto === "sfu" ? "sfu" : "mesh";
      setSalvato(t);
      setScelto(t);
      setPronto(j.pronto === true);
    } catch {
      setErrore(true);
    } finally {
      setCarico(false);
    }
  }, []);

  useEffect(() => {
    void leggi();
  }, [leggi]);

  //  Senza chiavi il nuovo sistema resta spento comunque (il client sceglie mesh):
  //  il pannello lo mostra com'è davvero, non come dice la riga salvata.
  const inUso: Trasporto = pronto ? salvato : "mesh";
  const selezionato: Trasporto = pronto ? scelto : "mesh";
  const sfuSpentoPerChiavi = !pronto && salvato === "sfu";

  const salva = async () => {
    if (selezionato === "sfu" && !pronto) return;
    setSalvo(true);
    try {
      const r = await fetchCRM(ROTTA, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: "config", trasporto: selezionato }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) {
        throw new Error(
          j?.error === "non-configurato"
            ? "Mancano le chiavi Cloudflare di Meetly: il nuovo sistema non si può accendere."
            : "Non sono riuscito a salvare. Riprova fra poco.",
        );
      }
      setSalvato(selezionato);
      toast.success(
        selezionato === "sfu"
          ? "Salvato: le nuove consulenze useranno i server Cloudflare"
          : "Salvato: le nuove consulenze useranno il collegamento diretto",
      );
    } catch (e) {
      toast.error(String((e as Error).message || e));
      void leggi(); // lo stato vero, se nel frattempo è cambiato qualcosa
    } finally {
      setSalvo(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Route className="h-4 w-4" /> Come viaggiano audio e video
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Cambia il percorso che fanno voce e immagini fra te e il cliente durante la consulenza. Se
        il nuovo sistema non risponde, la chiamata torna da sola al collegamento diretto.
      </p>

      {carico ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico…
        </p>
      ) : errore ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs leading-relaxed">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1">
            Non riesco a leggere come viaggiano audio e video adesso. Le consulenze vanno avanti
            come al solito.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCarico(true);
              void leggi();
            }}
          >
            Riprova
          </Button>
        </div>
      ) : (
        <>
          <RadioGroup
            value={selezionato}
            onValueChange={(v) => setScelto(v === "sfu" ? "sfu" : "mesh")}
            aria-label="Come viaggiano audio e video"
          >
            <label
              htmlFor="trasporto-mesh"
              className={`${RIGA} cursor-pointer hover:bg-muted/50`}
            >
              <RadioGroupItem value="mesh" id="trasporto-mesh" className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="t-riga block font-medium">
                  Diretto tra i partecipanti (come oggi)
                </span>
                <span className="t-nota block text-muted-foreground">
                  Voce e immagini passano da te al cliente senza intermediari. È il sistema di
                  sempre.
                </span>
              </span>
            </label>

            <label
              htmlFor="trasporto-sfu"
              className={`${RIGA} ${pronto ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed"}`}
            >
              <RadioGroupItem
                value="sfu"
                id="trasporto-sfu"
                disabled={!pronto}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`t-riga block font-medium ${pronto ? "" : "text-muted-foreground"}`}
                >
                  Tramite i server Cloudflare (in prova)
                </span>
                <span className="t-nota block text-muted-foreground">
                  Voce e immagini passano da un server intermedio. Può aiutare quando il cliente è
                  in 4G o dietro la rete di un ufficio.
                </span>
                {!pronto && (
                  <span className="t-nota mt-1.5 block text-amber-700 dark:text-amber-500">
                    <b>Chiavi mancanti: il nuovo sistema resta spento.</b> Mancano le chiavi
                    Cloudflare di Meetly: vanno inserite fra i segreti del servizio da chi gestisce
                    il sito. Finché non ci sono, resta il collegamento diretto.
                  </span>
                )}
              </span>
            </label>
          </RadioGroup>

          {sfuSpentoPerChiavi && (
            <p className="t-nota text-muted-foreground">
              In passato era stato scelto il nuovo sistema, ma senza le chiavi le consulenze usano
              il collegamento diretto.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void salva()} disabled={salvo || selezionato === inUso}>
              {salvo ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salva
            </Button>
            <p className="t-nota min-w-0 flex-1 text-muted-foreground">
              Vale per le nuove consulenze; quelle già avviate restano come sono.
            </p>
          </div>

          {pronto && (
            <p className="t-nota text-muted-foreground">
              Per provarlo senza cambiare niente aggiungi <code className="whitespace-nowrap">?trasporto=sfu</code> al link della
              tua stanza.
            </p>
          )}
        </>
      )}
    </div>
  );
}
