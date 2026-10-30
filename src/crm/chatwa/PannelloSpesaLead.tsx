/** ── LEAD DI OGGI E SPESA, DAL TASTO WHATSAPP DELLA CHAT (30/10/2026) ───────
 *  Richiesta del titolare: cliccando l'icona WhatsApp in alto a sinistra si vede
 *  quanti lead sono arrivati oggi; si può segnare la spesa di un giorno (es. il
 *  24) e il pannello calcola il costo per lead, che resta memorizzato.
 *
 *  ⚠️ LA SPESA STA DOVE STA GIÀ: `crm_ad_spending`, il registro della pagina KPI.
 *   Nessuna tabella nuova. Si scrive con le stesse tre funzioni di quel registro
 *   (`kpi/spesa-scrittura`), e un giorno già registrato lì si vede qui e viceversa.
 *   Chi ha già più voci nello stesso giorno le corregge dal registro KPI.
 *  ⚠️ Soldi, quindi solo a chi ha le impostazioni: lo decide `PaginaChat`
 *   (stesso permesso di «Costi WhatsApp»).
 *  Il calcolo è in `spesa-lead.ts` (provato); qui c'è solo il disegno. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/crm/AuthContext";
import { useCRM } from "@/crm/CRMContext";
import { leggiEuro } from "@/crm/euro";
import { euroPreciso } from "@/crm/kpi/basi";
import { correggiSpesa, eliminaSpesa, registraSpesa } from "@/crm/kpi/spesa-scrittura";
import { aRoma, giornoParlato } from "@/crm/promemoria/formati";
import {
  GIORNI_ELENCO,
  PERIODI_TOTALE,
  giorniRecenti,
  righeGiorni,
  totale,
  type RigaGiorno,
} from "./spesa-lead";

type Periodo = (typeof PERIODI_TOTALE)[number];

const trattino = "—";
const nLead = (n: number) => (n === 1 ? "1 lead" : `${n} lead`);
/** «venerdì 23 ottobre» senza l'anno; se la data non esiste, com'è. */
const giornoLungo = (g: string) => giornoParlato(g) ?? g;

/** La spesa Meta sincronizzata, giorno per giorno (somma degli annunci).
 *  shortcut: legge al massimo 1000 righe (limite di Supabase), bastano per 30 giorni
 *  di pochi annunci; con molti annunci attivi va paginata. */
function useSpesaMeta(giorni: string[], attivo: boolean) {
  const { user } = useAuth();
  const [meta, setMeta] = useState<Map<string, number>>(new Map());
  const [letta, setLetta] = useState(false);
  const [guasta, setGuasta] = useState(false);
  const da = giorni[giorni.length - 1];
  const a = giorni[0];
  const carica = useCallback(async () => {
    if (!user || !attivo || !da || !a) return;
    const { data, error } = await supabase
      .from("meta_ad_spend")
      .select("spend, spend_date")
      .eq("user_id", user.id)
      .gte("spend_date", da)
      .lte("spend_date", a);
    if (error) {
      setGuasta(true);
      return;
    }
    const m = new Map<string, number>();
    for (const r of data ?? []) {
      const g = String(r.spend_date).slice(0, 10);
      m.set(g, (m.get(g) ?? 0) + (Number(r.spend) || 0));
    }
    setMeta(m);
    setGuasta(false);
    setLetta(true);
  }, [user, attivo, da, a]);
  useEffect(() => {
    void carica();
  }, [carica]);
  return { meta, letta, guasta, ricarica: carica };
}

/** Il tasto dell'intestazione: l'icona WhatsApp, con accanto i lead di oggi e il
 *  costo per lead di oggi (se c'è la spesa). Tocca = si apre il pannello. */
export function TastoSpesaLead() {
  const { leads, adSpending, reload } = useCRM();
  const { user } = useAuth();
  const [aperto, setAperto] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>(7);
  const oggi = aRoma(new Date()).giorno;
  const giorni = useMemo(() => giorniRecenti(new Date(`${oggi}T12:00:00Z`), GIORNI_ELENCO), [oggi]);
  const { meta, guasta, ricarica } = useSpesaMeta(giorni, true);

  const righe = useMemo(
    () => righeGiorni({ giorni, leads, aMano: adSpending, meta }),
    [giorni, leads, adSpending, meta],
  );
  const riga0 = righe[0];
  const periodoRighe = righe.slice(0, periodo);
  const tot = totale(periodoRighe);

  //  Il giorno aperto per scrivere la spesa (uno solo alla volta); all'apertura, oggi.
  const [inModifica, setInModifica] = useState<string | null>(null);
  const apri = () => {
    setAperto(true);
    setInModifica(oggi);
    void ricarica();
  };

  const salva = async (r: RigaGiorno, testo: string): Promise<boolean> => {
    if (!user) {
      toast.error("Spesa non salvata", {
        description: "Non risulti collegato: rientra nel CRM e riprova.",
      });
      return false;
    }
    const registrazioni = adSpending.filter(
      (s) => String(s.data?.data ?? "").slice(0, 10) === r.giorno,
    );
    const vuoto = testo.trim() === "";
    const valore = leggiEuro(testo);
    if (!vuoto && valore <= 0) {
      toast.error("Scrivi quanto hai speso", {
        description: "Un importo maggiore di zero, oppure lascia vuoto per toglierlo.",
      });
      return false;
    }
    if (vuoto && registrazioni.length === 0) {
      toast.error("Scrivi quanto hai speso");
      return false;
    }
    const esito = vuoto
      ? await eliminaSpesa(registrazioni[0].id)
      : registrazioni.length === 1
        ? await correggiSpesa(registrazioni[0].id, {
            ...registrazioni[0].data,
            importoSpeso: valore,
          })
        : await registraSpesa(user.id, {
            data: r.giorno,
            campagna: "Budget giornaliero",
            fonte: "ADV",
            importoSpeso: valore,
            leadGenerati: 0,
            meetFissati: 0,
            conversioni: 0,
          });
    if (!esito.ok) {
      //  Il numero resta scritto nel campo: si riprova col tasto.
      toast.error("Spesa non salvata", { description: esito.errore });
      return false;
    }
    await reload();
    toast.success(
      vuoto ? "Spesa tolta" : `Registrati ${euroPreciso(valore)} · ${giornoLungo(r.giorno)}`,
    );
    return true;
  };

  return (
    <>
      <button
        type="button"
        onClick={apri}
        aria-label="Lead di oggi e spesa pubblicitaria"
        title="Lead di oggi e spesa pubblicitaria"
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-md pr-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-600">
          <MessageCircle className="h-4 w-4" />
        </span>
        <span className="flex shrink-0 flex-col leading-tight tabular-nums">
          <span className="text-[12px] font-semibold text-foreground">{nLead(riga0.lead)}</span>
          {riga0.costoLead !== null && (
            <span className="text-[11px] text-muted-foreground">
              {euroPreciso(riga0.costoLead)} a lead
            </span>
          )}
        </span>
      </button>

      <Sheet open={aperto} onOpenChange={setAperto}>
        <SheetContent
          side="bottom"
          className="crm-theme mx-auto flex max-h-[90dvh] w-full flex-col gap-0 rounded-t-xl bg-white p-0 text-foreground sm:max-w-lg [&>button]:hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
            <SheetTitle className="text-[15px]">Lead e spesa</SheetTitle>
            <SheetClose asChild>
              <Button type="button" variant="ghost" className="min-h-11 text-[13px]">
                Chiudi
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">
            Lead arrivati ogni giorno, spesa pubblicitaria e costo per lead.
          </SheetDescription>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
            <div>
              <p className="text-[12px] text-muted-foreground">Oggi · {giornoLungo(oggi)}</p>
              <p className="text-[28px] font-semibold leading-tight tabular-nums">
                {nLead(riga0.lead)}
              </p>
              <p className="text-[13px] tabular-nums text-muted-foreground">
                Spesa {riga0.euro !== null ? euroPreciso(riga0.euro) : trattino} · costo per lead{" "}
                {riga0.costoLead !== null ? euroPreciso(riga0.costoLead) : trattino}
              </p>
            </div>

            {guasta && (
              <p role="alert" className="text-[12.5px] text-amber-800">
                Non riesco a leggere la spesa di Meta: si vedono solo gli importi scritti a mano.
              </p>
            )}

            <div role="group" aria-label="Periodo" className="flex flex-wrap gap-1.5">
              {PERIODI_TOTALE.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={periodo === p}
                  onClick={() => setPeriodo(p)}
                  className={cn(
                    "min-h-11 rounded-full border px-4 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    periodo === p
                      ? "border-foreground bg-foreground font-medium text-background"
                      : "border-border bg-background text-foreground hover:bg-accent",
                  )}
                >
                  {p} giorni
                </button>
              ))}
            </div>

            <div
              className="rounded-lg border border-border bg-muted/40 px-3 py-2.5"
              data-testid="spesa-totale"
            >
              <p className="text-[12px] text-muted-foreground">Totale {periodo} giorni</p>
              <p className="text-[15px] font-semibold tabular-nums">
                {nLead(tot.lead)} · {euroPreciso(tot.spesa)}
              </p>
              <p className="text-[13px] tabular-nums">
                Costo per lead {tot.costoLead !== null ? euroPreciso(tot.costoLead) : trattino}
              </p>
              {tot.giorniConSpesa < periodo && (
                <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                  {tot.giorniConSpesa === 0
                    ? "Nessuna spesa segnata in questi giorni."
                    : `Calcolato sui ${tot.giorniConSpesa} giorni con la spesa segnata.`}
                </p>
              )}
            </div>

            <ul className="divide-y divide-border">
              {periodoRighe.map((r) => (
                <RigaDelGiorno
                  key={r.giorno}
                  riga={r}
                  oggi={r.giorno === oggi}
                  aperta={inModifica === r.giorno}
                  onApri={() => setInModifica(inModifica === r.giorno ? null : r.giorno)}
                  onSalva={(t) => salva(r, t)}
                />
              ))}
            </ul>
            <p className="border-t border-border pt-3 text-[11.5px] leading-snug text-muted-foreground">
              I giorni sono quelli di Roma. La spesa segnata qui è la stessa del registro nella
              pagina KPI; se un giorno ha un importo scritto, vale quello al posto della spesa letta
              da Meta.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function RigaDelGiorno({
  riga,
  oggi,
  aperta,
  onApri,
  onSalva,
}: {
  riga: RigaGiorno;
  oggi: boolean;
  aperta: boolean;
  onApri: () => void;
  onSalva: (testo: string) => Promise<boolean>;
}) {
  const [testo, setTesto] = useState(
    riga.origine === "mano" && riga.euro !== null ? String(riga.euro).replace(".", ",") : "",
  );
  const [inCorso, setInCorso] = useState(false);
  //  Si riparte dal valore salvato ogni volta che la riga si apre.
  useEffect(() => {
    if (aperta)
      setTesto(
        riga.origine === "mano" && riga.euro !== null ? String(riga.euro).replace(".", ",") : "",
      );
  }, [aperta, riga.origine, riga.euro]);
  const piuVoci = riga.registrazioni > 1;

  return (
    <li>
      <button
        type="button"
        onClick={onApri}
        aria-expanded={aperta}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-[13px] text-foreground">
            {oggi ? "Oggi · " : ""}
            {giornoLungo(riga.giorno)}
          </span>
          <span className="block text-[11.5px] tabular-nums text-muted-foreground">
            {nLead(riga.lead)} · spesa {riga.euro !== null ? euroPreciso(riga.euro) : trattino}
            {riga.origine === "meta" ? " (Meta)" : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-medium tabular-nums text-foreground">
            {riga.costoLead !== null ? euroPreciso(riga.costoLead) : trattino}
          </span>
          <span className="block text-[11px] text-muted-foreground">a lead</span>
        </span>
      </button>
      {aperta && (
        <form
          className="space-y-1.5 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (inCorso || piuVoci) return;
            setInCorso(true);
            void onSalva(testo).finally(() => setInCorso(false));
          }}
        >
          <label
            htmlFor={`spesa-${riga.giorno}`}
            className="block text-[12px] text-muted-foreground"
          >
            Spesa del {giornoLungo(riga.giorno)} (€)
          </label>
          <div className="flex gap-2">
            <Input
              id={`spesa-${riga.giorno}`}
              inputMode="decimal"
              autoComplete="off"
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              disabled={piuVoci || inCorso}
              placeholder="es. 42,50"
              className="h-11 min-w-0 flex-1 text-base"
            />
            <Button type="submit" className="min-h-11 shrink-0 px-5" disabled={piuVoci || inCorso}>
              {inCorso ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
            </Button>
          </div>
          <p className="text-[11.5px] leading-snug text-muted-foreground">
            {piuVoci
              ? `Ci sono ${riga.registrazioni} voci in questo giorno: correggile dal registro nella pagina KPI.`
              : riga.origine === "meta"
                ? "Questo importo viene da Meta. Se ne scrivi uno, vale il tuo."
                : "Campo vuoto + Salva toglie la spesa."}
          </p>
        </form>
      )}
    </li>
  );
}
