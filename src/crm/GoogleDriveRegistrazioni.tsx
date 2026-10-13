/** ── GOOGLE DRIVE PER LE REGISTRAZIONI (Impostazioni → Meetly) ─────────────
 *  Si incollano l'ID client e il Client secret dell'applicazione Google, si
 *  preme «Collega Google Drive», si dà il permesso a Google, e si torna qui.
 *  Da quel momento le consulenze si registrano in un file solo, e quelle che
 *  non stanno nel tetto di Supabase vanno nella cartella «Registrazioni
 *  Meetly» del Drive (vedi shop/drive-registrazioni).
 *
 *  ⚠️ Il segreto non torna mai indietro dal server: il campo vuoto vuol dire
 *   «lascia quello che c'è».
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchCRM, intestazioniCRM } from "./AuthContext";

type Stato = { clientId: string; chiavi: boolean; collegato: boolean; email: string; ritorno: string };

const ESITI: Record<string, [ok: boolean, testo: string]> = {
  collegato: [true, "Google Drive collegato"],
  annullato: [false, "Collegamento annullato su Google"],
  scaduto: [false, "Il collegamento è scaduto: riprova"],
  chiavi: [false, "Mancano le chiavi Google: incollale e riprova"],
  rifiutato: [false, "Google ha rifiutato le chiavi: controlla ID client, secret e indirizzo di ritorno"],
};

export function GoogleDriveRegistrazioni() {
  const [stato, setStato] = useState<Stato | null>(null);
  const [clientId, setClientId] = useState("");
  const [segreto, setSegreto] = useState("");
  const [lavoro, setLavoro] = useState(false);

  const leggi = useCallback(async () => {
    try {
      const j = (await fetchCRM("/api/crm/google-drive").then((r) => r.json())) as Stato & { ok?: boolean };
      if (j?.ok) {
        setStato(j);
        setClientId((v) => v || j.clientId || "");
      }
    } catch {
      /* il pannello resta vuoto: lo dice il bottone */
    }
  }, []);

  useEffect(() => {
    void leggi();
    //  Il ritorno da Google porta l'esito nell'indirizzo: lo si dice una volta
    //  e lo si toglie, così ricaricare la pagina non lo ripete.
    const u = new URL(window.location.href);
    const esito = u.searchParams.get("drive");
    if (esito) {
      const [ok, testo] = ESITI[esito] ?? [false, "Collegamento non riuscito"];
      if (ok) toast.success(testo);
      else toast.error(testo);
      u.searchParams.delete("drive");
      window.history.replaceState(null, "", u.toString());
    }
  }, [leggi]);

  const collega = async () => {
    setLavoro(true);
    try {
      const r = await fetch("/api/crm/google-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await intestazioniCRM()) },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: segreto.trim() }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; url?: string; reason?: string } | null;
      if (!r.ok || !j?.url) throw new Error(j?.reason || `errore ${r.status}`);
      window.location.href = j.url;
    } catch (e) {
      toast.error(String((e as Error).message || e));
      setLavoro(false);
    }
  };

  const scollega = async () => {
    setLavoro(true);
    try {
      await fetch("/api/crm/google-drive", { method: "DELETE", headers: await intestazioniCRM() });
      toast.success("Google Drive scollegato");
      await leggi();
    } finally {
      setLavoro(false);
    }
  };

  const copia = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Copiato");
    } catch {
      /* */
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <HardDrive className={`h-4 w-4 ${stato?.collegato ? "text-emerald-600" : "text-amber-500"}`} />
        Registrazioni su Google Drive {stato?.collegato ? "" : "— da collegare"}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Con Drive collegato ogni consulenza si registra in <b>un file solo</b>. Se sta nei 50 MB di
        Supabase resta lì; se è più grande va nella cartella «Registrazioni Meetly» del tuo Drive, privata.
      </p>

      {stato?.collegato ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Collegato{stato.email ? ` a ${stato.email}` : ""}
          </span>
          <Button variant="outline" size="sm" className="ml-auto" disabled={lavoro} onClick={() => void scollega()}>
            Scollega
          </Button>
        </div>
      ) : null}

      {stato?.ritorno && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">
            URI di reindirizzamento autorizzato (da incollare nel client OAuth su Google Cloud)
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 text-xs">{stato.ritorno}</code>
            <Button variant="outline" size="sm" onClick={() => void copia(stato.ritorno)} aria-label="Copia l'indirizzo">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <input
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        placeholder="ID client (…apps.googleusercontent.com)"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <input
        value={segreto}
        onChange={(e) => setSegreto(e.target.value)}
        type="password"
        autoComplete="new-password"
        placeholder={stato?.chiavi ? "Client secret — lascia vuoto per non cambiarlo" : "Client secret"}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <Button size="sm" disabled={lavoro || !clientId.trim() || (!segreto.trim() && !stato?.chiavi)} onClick={() => void collega()}>
        {lavoro ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {stato?.collegato ? "Ricollega Google Drive" : "Collega Google Drive"}
      </Button>
    </div>
  );
}
