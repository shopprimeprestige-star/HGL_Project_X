/** ── LE SPESE FISSE DEL MESE ───────────────────────────────────────────────
 *  Affitto, luce, acqua, gas, fibra, commercialista, abbonamenti,
 *  manutenzioni: quello che si paga per tenere aperto e che non appartiene a
 *  nessun cliente. Il perché di un elenco per MESE invece di importi
 *  ricorrenti è scritto in crm/costi-mese, e in due righe è questo: l'affitto
 *  aumenta a marzo e la bolletta di gennaio non è quella di maggio, e un
 *  importo ricorrente le riscriverebbe all'indietro su mesi già guardati.
 *
 *  ⚠️ SI SALVA A MANO, come i costi di una pratica. Un salvataggio a ogni
 *   tasto scriverebbe in archivio ogni cifra parziale — «9», «90», «900» — e
 *   un ripensamento lasciato a metà resterebbe dentro il conto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Receipt,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { leggiEuro, scriviEuro } from "@/crm/euro";
import { nuovoIdVoce } from "@/crm/costi-pratica";
import {
  leggiCostiMese,
  meseCorrente,
  meseLeggibile,
  mesePrecedente,
  propostaDa,
  salvaCostiMese,
  totaleVoci,
} from "@/crm/costi-mese";
import type { VoceMese } from "@/crm/costi-mese";
import { cn } from "@/lib/utils";
import { eur, Scheda } from "@/crm/ui";

/** Il mese dopo quello dato, mai oltre il mese corrente: le spese fisse di un
 *  mese che non è ancora cominciato non le conosce nessuno. */
function meseSuccessivo(mese: string): string | null {
  const [a, m] = mese.split("-").map(Number);
  if (!a || !m) return null;
  const prossimo = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return prossimo > meseCorrente() ? null : prossimo;
}

export function CostiMese({
  meseIniziale,
  mesiDelPeriodo,
  onSalvato,
}: {
  /** Il mese su cui aprirsi. Serve alla pagina della contabilità, che sta
   *  guardando un trimestre: aprirsi sul mese corrente mentre sopra si legge
   *  «2º trimestre» fa credere che le due cose non c'entrino niente fra loro. */
  meseIniziale?: string;
  /** I mesi che il periodo comprende, per dirlo: chi guarda un trimestre deve
   *  sapere che il conto sopra somma TRE mesi di affitto, non quello che vede
   *  qui sotto. */
  mesiDelPeriodo?: string[];
  /** ── ⚠️ IL CONTO SOPRA VA RILETTO ────────────────────────────────────
   *  Senza questo avviso la scheda salvava, diceva «salvate», e il conto in
   *  cima alla pagina restava quello di prima: l'affitto appena scritto non
   *  compariva da nessuna parte finché non si cambiava periodo. Chi lo prova la
   *  prima volta conclude che la funzione non funziona — ed è il modo più
   *  rapido di far smettere di compilare i costi, cioè di rendere sbagliato
   *  tutto il resto. */
  onSalvato?: () => void;
} = {}) {
  const [mese, setMese] = useState(meseIniziale || meseCorrente());

  /** ⚠️ CAMBIANDO PERIODO SOPRA, QUESTA SCHEDA SI SPOSTA. Senza, restava sul
   *  mese di prima: si passava al trimestre precedente per capire una cifra e
   *  qui sotto continuava a comparire settembre — cioè si sarebbe potuto
   *  correggere il mese sbagliato credendo di correggere quello guardato.
   *  Le frecce qui sotto restano libere di uscire dal periodo: a volte si
   *  compila un mese vecchio, ed è giusto poterlo fare. */
  useEffect(() => {
    if (meseIniziale) setMese(meseIniziale);
  }, [meseIniziale]);
  const [voci, setVoci] = useState<VoceMese[]>([]);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  /** Cosa c'era in archivio quando si è aperto il mese: serve a sapere se il
   *  «Salva» ha qualcosa da fare. */
  const [scritto, setScritto] = useState("");

  useEffect(() => {
    let vivo = true;
    setCaricando(true);
    void (async () => {
      try {
        const suoi = await leggiCostiMese(mese);
        if (!vivo) return;
        if (suoi.length > 0) {
          setVoci(suoi);
          setScritto(JSON.stringify(suoi));
        } else {
          //  ⚠️ Il mese nuovo NON nasce vuoto: si propongono i titoli e gli
          //   importi del mese prima — è quasi sempre la stessa cifra — ma da
          //   confermare. La proposta non è ancora scritta in archivio: il
          //   confronto con `scritto` resta vuoto, e «Salva» è acceso.
          const prima = await leggiCostiMese(mesePrecedente(mese));
          if (!vivo) return;
          setVoci(propostaDa(prima));
          setScritto("");
        }
        setCaricando(false);
      } catch (x) {
        //  ⚠️ Oggi `leggiCostiMese` non rilancia — l'archivio inghiotte
        //   l'errore e torna null — ma questa rete c'è lo stesso: senza, il
        //   giorno in cui quella lettura cambiasse comportamento la scheda
        //   resterebbe su «Leggo le spese del mese…» per sempre, e nessuno
        //   collegherebbe le due cose. Un elenco vuoto qui non fa danni:
        //   si vede subito che il mese è da compilare.
        if (!vivo) return;
        setVoci([]);
        setScritto("");
        setCaricando(false);
        toast.error("Non riesco a leggere le spese di questo mese", {
          description: x instanceof Error ? x.message : String(x),
        });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [mese]);

  const totale = totaleVoci(voci);
  const cambiato = JSON.stringify(voci) !== scritto;

  const salva = async () => {
    if (salvando) return;
    setSalvando(true);
    const errore = await salvaCostiMese(mese, voci);
    setSalvando(false);
    if (errore) {
      toast.error("Le spese del mese non sono state salvate", { description: errore });
      return;
    }
    setScritto(JSON.stringify(voci));
    toast.success(`Spese di ${meseLeggibile(mese)} salvate · ${eur(totale)}`);
    onSalvato?.();
  };

  const dopo = meseSuccessivo(mese);

  return (
    <Scheda
      titolo="Spese fisse del mese"
      nota="Quello che si paga per tenere aperto: non appartiene a nessun cliente, ma abbassa il margine di tutti"
      icona={Receipt}
    >
      {/* ── IL MESE ──────────────────────────────────────────────────────
          Frecce e non un menù a tendina: i mesi si guardano quasi sempre uno
          accanto all'altro — «quanto ho speso questo mese rispetto a prima» —
          e per quel gesto una tendina è due tocchi invece di uno. */}
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          onClick={() => setMese(mesePrecedente(mese))}
          title="Il mese prima"
          aria-label="Il mese prima"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-[14px] font-semibold capitalize">
            {meseLeggibile(mese)}
          </span>
        </span>
        <span className="shrink-0 text-[15px] font-bold tabular-nums">{eur(totale)}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          onClick={() => dopo && setMese(dopo)}
          disabled={!dopo}
          title={dopo ? "Il mese dopo" : "Il mese corrente è l'ultimo"}
          aria-label="Il mese dopo"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/*  ⚠️ QUALI MESI FINISCONO NEL CONTO. Su un trimestre il conto in cima
          somma tre mesi di affitto, mentre qui sotto se ne compila uno per
          volta: senza questa riga si scrive settembre, si guarda un totale che
          comprende anche luglio e agosto, e non torna niente. */}
      {mesiDelPeriodo && mesiDelPeriodo.length > 1 && (
        <p className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11.5px] leading-snug text-slate-600">
          Il conto del periodo somma le spese di {mesiDelPeriodo.length} mesi:{" "}
          {mesiDelPeriodo.map(meseLeggibile).join(", ")}. Qui se ne compila uno per volta.
        </p>
      )}
      {caricando ? (
        <p className="text-[12.5px] text-muted-foreground">Leggo le spese del mese…</p>
      ) : (
        <>
          {/*  ── ⚠️ DIRE SE QUESTO MESE È GIÀ STATO CONFERMATO ─────────────
              Senza, gli importi del mese prima riportati qui sembrano dati
              salvati, e chi apre la scheda esce senza premere Salva credendo
              di aver già fatto. Le fisse nel frattempo contano lo stesso — è
              il motivo per cui esistono — e va detto anche quello. */}
          {!scritto && (
            <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
              <strong>{meseLeggibile(mese)} non è ancora stato confermato.</strong> Gli importi qui
              sotto vengono da {meseLeggibile(mesePrecedente(mese))}: controllali e premi Salva.
              {voci.some((v) => v.fissa) && (
                <>
                  {" "}
                  Le voci segnate <strong>fissa</strong> contano già nel conto anche senza salvare —
                  è quello che vuol dire fissa.
                </>
              )}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {voci.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                {/*  ── ⚠️ FISSA VUOL DIRE «NON CHIEDERMELO PIÙ» ────────────
                    L'affitto e il commercialista non cambiano, e
                    riconfermarli dodici volte l'anno è un gesto che non
                    decide niente: segnati fissi, si ripresentano da soli nei
                    mesi non ancora compilati.
                    Le altre NO, ed è voluto: la bolletta della luce di
                    gennaio non è quella di maggio, e una che si conferma da
                    sola sarebbe un numero inventato dentro un conto vero. */}
                <button
                  type="button"
                  onClick={() =>
                    setVoci((r) => r.map((x) => (x.id === v.id ? { ...x, fissa: !x.fissa } : x)))
                  }
                  disabled={salvando}
                  title={
                    v.fissa
                      ? `«${v.titolo || "questa voce"}» torna da sola ogni mese con questo importo. Premi per non farlo più.`
                      : `Premi se «${v.titolo || "questa voce"}» è sempre uguale: te la rimetto io ogni mese, senza chiedertelo.`
                  }
                  aria-pressed={!!v.fissa}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition",
                    v.fissa
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  {v.fissa ? "fissa" : "no"}
                </button>
                <Input
                  value={v.titolo}
                  onChange={(e) =>
                    setVoci((r) =>
                      r.map((x) => (x.id === v.id ? { ...x, titolo: e.target.value } : x)),
                    )
                  }
                  placeholder="Affitto, luce, abbonamento…"
                  disabled={salvando}
                  className="h-9 min-w-0 flex-1 text-[13px]"
                />
                <Input
                  value={v.importo ? scriviEuro(v.importo) : ""}
                  onChange={(e) =>
                    setVoci((r) =>
                      r.map((x) =>
                        x.id === v.id
                          ? { ...x, importo: Math.max(0, leggiEuro(e.target.value)) }
                          : x,
                      ),
                    )
                  }
                  inputMode="decimal"
                  placeholder="€"
                  disabled={salvando}
                  className="h-9 w-24 shrink-0 text-right text-[13px] tabular-nums"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 shrink-0 px-2 text-muted-foreground hover:text-rose-600"
                  onClick={() => setVoci((r) => r.filter((x) => x.id !== v.id))}
                  disabled={salvando}
                  title={`Togli «${v.titolo || "questa voce"}»`}
                  aria-label="Togli questa voce"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-dashed"
              onClick={() => setVoci((r) => [...r, { id: nuovoIdVoce(), titolo: "", importo: 0 }])}
              disabled={salvando}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Aggiungi una spesa
            </Button>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => void salva()}
              disabled={salvando || !cambiato}
              title={cambiato ? "Salva le spese di questo mese" : "Non è cambiato niente"}
            >
              {salvando ? "Salvo…" : "Salva"}
            </Button>
          </div>
        </>
      )}
    </Scheda>
  );
}
