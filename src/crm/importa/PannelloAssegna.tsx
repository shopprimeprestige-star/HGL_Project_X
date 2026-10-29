/** Estratto da `src/routes/CRM.importa.tsx` (commessa 2026-10-28-lead-importati-semplice,
 *  compito T3): la divisione delle schede fra i consulenti.
 *  Solo uno spostamento: nessuna riga di logica è cambiata. */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCRM } from "@/crm/CRMContext";
import { soloConsulenti } from "@/crm/chi-fa-la-consulenza";
import { Vuoto } from "@/crm/ui";
import { dividiLead } from "@/crm/import-backup";

/* ═══════════════════════════════════════════════════════════════════════════
   6. DIVIDERE LE SCHEDE FRA I CONSULENTI

   Le schede appena importate arrivano senza padrone. A ogni scheda tocca chi
   ha meno carico in questa spartizione, a pari carico chi ha priorità più
   alta, e chi ha esaurito il massimo giornaliero viene saltato.
   Il carico storico NON entra nel conto: il massimo è giornaliero, e
   confrontarlo con le schede accumulate in mesi escluderebbe subito tutti.
   ⚠️ Questo è l'UNICO punto del CRM che chiama `dividiLead`. Se un giorno
   questa scheda sparisce, la spartizione automatica sparisce con lei.
   ═════════════════════════════════════════════════════════════════════════ */

export function PannelloAssegna() {
  const { leads, consultants, reload, updateLead } = useCRM();
  const [lavoro, setLavoro] = useState<{ fatti: number; totale: number } | null>(null);

  const senzaConsulente = useMemo(() => leads.filter((l) => !l.data?.consulenteId), [leads]);
  const diLista = useMemo(
    () => senzaConsulente.filter((l) => l.data?.importato).length,
    [senzaConsulente],
  );
  /** ── SI SPARTISCE FRA CHI FA LE CONSULENZE ─────────────────────────────
   *  Questo pulsante scrive `consulenteId` su decine di schede in un colpo: è
   *  l'assegnazione più massiccia di tutto il CRM, e finché guardava l'anagrafica
   *  intera mandava schede da lavorare a driver e installatori — che per giunta,
   *  non avendo carico, il criterio «tocca a chi ha meno carico» sceglieva per
   *  primi. Il posto che dice chi fa consulenze è uno solo
   *  (crm/chi-fa-la-consulenza) ed è lo stesso di tutti gli elenchi; finché
   *  nessuno è segnato restituisce tutti, quindi il giorno del rilascio la
   *  spartizione è identica a quella di ieri.
   *  ⚠️ Qui NON si tiene dentro nessun «già assegnato»: si spartiscono per
   *  definizione le schede che un consulente non ce l'hanno. */
  const consulentiVeri = useMemo(() => soloConsulenti(consultants), [consultants]);
  const attivi = useMemo(
    () => consulentiVeri.filter((c) => c.data.attivo).length,
    [consulentiVeri],
  );

  const dividi = async () => {
    if (!senzaConsulente.length) {
      toast.message("Sono già tutte assegnate");
      return;
    }
    const quote = consulentiVeri.map((c) => ({
      id: c.id,
      nome: c.data.nome,
      attivo: !!c.data.attivo,
      max: c.data.maxCallGiorno ?? 10,
      priorita: c.data.priorita ?? 1,
    }));
    const { assegnazioni, nonAssegnati } = dividiLead(senzaConsulente, quote, {});
    if (!assegnazioni.length) {
      toast.error("Nessun consulente disponibile", {
        description:
          "Serve almeno un consulente attivo con un massimo giornaliero maggiore di zero.",
      });
      return;
    }
    setLavoro({ fatti: 0, totale: assegnazioni.length });
    let fatti = 0;
    for (const a of assegnazioni) {
      const l = senzaConsulente.find((x) => x.id === a.leadId);
      if (l) await updateLead(l.id, { consulenteId: a.consulenteId });
      fatti += 1;
      setLavoro({ fatti, totale: assegnazioni.length });
    }
    setLavoro(null);
    await reload();
    toast.success(`Assegnate ${assegnazioni.length} schede`, {
      description: nonAssegnati
        ? `${nonAssegnati} restano senza consulente: quote giornaliere esaurite.`
        : undefined,
    });
  };

  if (senzaConsulente.length === 0) {
    return (
      <Vuoto
        titolo="Tutte le schede hanno un consulente"
        testo="Non c'è niente da spartire: le schede senza padrone compaiono qui dopo un'importazione."
        icona={Users}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void dividi()} disabled={!!lavoro}>
        {lavoro ? `Assegnazione… ${lavoro.fatti}/${lavoro.totale}` : "Dividi ora"}
      </Button>
      <p className="text-[12px] text-muted-foreground">
        {senzaConsulente.length} schede senza consulente
        {diLista > 0 && `, di cui ${diLista} arrivate da una lista`} · {attivi} consulenti attivi. A
        ogni scheda tocca chi ha meno carico; a pari carico, chi ha priorità più alta. Chi ha
        esaurito il massimo giornaliero viene saltato.
      </p>
    </div>
  );
}
