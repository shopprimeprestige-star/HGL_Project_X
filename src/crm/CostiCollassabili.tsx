/** ── I COSTI, DENTRO LA FINESTRA DELL'INCASSO ──────────────────────────────
 *
 *  Richiesta del committente: mentre si registra quanto è entrato si deve poter
 *  correggere quanto è USCITO su quel cliente, senza cambiare schermata.
 *
 *  ── ⚠️ PERCHÉ PROPRIO LÌ ─────────────────────────────────────────────────
 *  È l'unico momento in cui i due numeri si guardano insieme. Chi registra il
 *  saldo ha in testa quanto ha preso, e quello è l'istante in cui si accorge
 *  che il parrucchiere costava 25 e non 15, o che il corriere ne ha chiesti
 *  12. Rimandare la correzione a «poi apro i costi» vuol dire non farla mai —
 *  e un margine calcolato su costi vecchi è un margine sbagliato per sempre,
 *  perché nessuno torna su una pratica chiusa.
 *
 *  ── ⚠️ CHIUSO DI PARTENZA, E NON È PIGRIZIA ──────────────────────────────
 *  Nove volte su dieci i costi sono giusti e non si tocca niente: aperto,
 *  questo blocco metterebbe quattro caselle fra il titolo e il pulsante che
 *  registra i soldi — cioè fra chi ha in mano il telefono e la cosa che è
 *  venuto a fare. Chiuso mostra il TOTALE, che è l'unica cosa che serve per
 *  decidere se aprirlo.
 *
 *  ── ⚠️ SI SALVA A PARTE, E PRIMA ─────────────────────────────────────────
 *  Il pulsante dei costi è suo e non è quello dell'incasso. Attaccarli
 *  vorrebbe dire che chi corregge un costo e poi cambia idea sull'incasso si
 *  porta via anche la correzione — o peggio, che registrare un incasso scrive
 *  di nascosto dei costi che qualcuno stava solo guardando.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCRM } from "./CRMContext";
import { altriCosti, totaleCostiPratica, vociFissePer } from "./costi-pratica";
import { leggiEuro, scriviEuro } from "./euro";
import { daSpedire } from "./spedizione";
import type { Lead } from "./types";
import { eur } from "./ui";

export function CostiCollassabili({ lead, className }: { lead: Lead; className?: string }) {
  const { updateLead } = useCRM();
  const [aperto, setAperto] = useState(false);
  const [fissi, setFissi] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const voci = vociFissePer(daSpedire(lead));
  const manuali = altriCosti(lead.data);
  const trasferta = Number(lead.data.payment?.costi?.costoTrasferta) || 0;

  /*  ⚠️ Si riparte da quello che c'è in archivio ogni volta che si apre: una
      cifra lasciata a metà nell'apertura di prima — magari su un altro
      cliente — è il modo più silenzioso di scrivere un costo sbagliato. */
  useEffect(() => {
    if (!aperto) return;
    const c = lead.data.payment?.costi;
    const p: Record<string, string> = {};
    for (const v of voci) {
      const n = Number(c?.[v.chiave]) || 0;
      p[v.chiave] = n > 0 ? scriviEuro(n) : "";
    }
    setFissi(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto, lead]);

  /*  Il totale mostrato chiuso è quello VERO della pratica — fisse, viaggio e
      voci scritte a mano — non la somma delle caselle qui dentro: aprendo si
      vedrebbe un numero più piccolo di quello di un attimo prima, e nessuno
      capirebbe dove sono finiti gli altri costi. */
  const totaleVero = totaleCostiPratica(lead.data);
  const totaleModificato =
    voci.reduce((s, v) => s + Math.max(0, leggiEuro(fissi[v.chiave] ?? "")), 0) +
    trasferta +
    manuali.reduce((s, r) => s + (Number(r.importo) || 0), 0);

  const salva = async () => {
    setSalvando(true);
    const c = { ...(lead.data.payment?.costi ?? {}) };
    for (const v of voci) c[v.chiave] = Math.max(0, leggiEuro(fissi[v.chiave] ?? ""));
    const ok = await updateLead(lead.id, {
      payment: { ...(lead.data.payment ?? {}), costi: c },
    });
    setSalvando(false);
    if (!ok) {
      toast.error("I costi non sono stati salvati: riprova.");
      return;
    }
    toast.success(`Costi aggiornati · ${eur(totaleModificato)}`);
    setAperto(false);
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}>
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600">
          <Wallet className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Cosa ci è costato</span>
          <span className="block text-[11.5px] leading-snug text-muted-foreground">
            {aperto ? "Correggi gli importi e salva" : "Impianto, chi ci lavora, le spese"}
          </span>
        </span>
        {/*  Il totale si vede da CHIUSO: è l'unica cosa che serve per decidere
            se aprire. Un blocco richiudibile che non dice niente finché non lo
            apri si apre tutte le volte, e allora tanto valeva lasciarlo aperto. */}
        <span className="shrink-0 text-[14px] font-semibold tabular-nums text-rose-700">
          {eur(aperto ? totaleModificato : totaleVero)}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aperto && "rotate-180",
          )}
        />
      </button>

      {aperto && (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2.5">
          {voci.map((v) => (
            <label key={v.chiave} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{v.titolo}</span>
              <Input
                inputMode="decimal"
                value={fissi[v.chiave] ?? ""}
                onChange={(e) => setFissi((f) => ({ ...f, [v.chiave]: e.target.value }))}
                placeholder="0,00"
                className="h-8 w-28 text-right text-[13px] tabular-nums"
              />
            </label>
          ))}

          {/*  ⚠️ Viaggio e voci scritte a mano si VEDONO ma non si toccano qui:
              il viaggio lo scrive la scheda «A domicilio» e le voci libere
              hanno un «+» e un cestino che qui non ci stanno. Nasconderle
              però farebbe sembrare il totale sbagliato — è la stessa ragione
              per cui il totale chiuso è quello vero. */}
          {trasferta > 0 && (
            <p className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>Viaggio della posa</span>
              <span className="tabular-nums">{eur(trasferta)}</span>
            </p>
          )}
          {manuali.map((r) => (
            <p
              key={r.id}
              className="flex items-center justify-between text-[12px] text-muted-foreground"
            >
              <span className="min-w-0 truncate">{r.titolo || "Voce senza nome"}</span>
              <span className="shrink-0 tabular-nums">{eur(r.importo)}</span>
            </p>
          ))}

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={salvando}
            onClick={() => void salva()}
          >
            {salvando ? "Salvo…" : "Salva i costi"}
          </Button>
        </div>
      )}
    </div>
  );
}
