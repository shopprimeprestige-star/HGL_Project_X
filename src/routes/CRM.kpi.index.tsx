/** ── KPI · LO SMISTAMENTO DELLE QUATTRO SCHEDE ─────────────────────────────
 *
 *  Questo file non disegna e non calcola niente: sceglie quale scheda montare
 *  in base a `?scheda=`. Tutte e quattro vivono su questo indirizzo perché
 *  l'albero delle rotte di TanStack è generato (src/routeTree.gen.ts, che non
 *  si tocca a mano) e aggiungere file di rotta senza rigenerarlo porterebbe
 *  quegli indirizzi alla pagina «non trovata». Il perché delle quattro schede
 *  sta in routes/CRM.kpi.tsx.
 *
 *  ⚠️ OGNI SCHEDA È UN COMPONENTE SUO, non un ramo dentro l'altra. Tre delle
 *  quattro leggono la spesa dal database (`useRegistroSpesa`) e hanno una
 *  ventina di hook a testa: messe dentro con un `if`, o quegli hook girerebbero
 *  anche per chi guarda le chiamate — interrogando il database per niente —
 *  oppure finirebbero sotto un return anticipato, che è il modo più rapido di
 *  rompere l'ordine degli hook. Qui sopra il return c'è UN hook solo, e ogni
 *  ramo è un componente intero.
 *
 *  ⚠️ Il periodo non si sceglie qui: arriva dall'indirizzo, lo mostra la barra
 *  di /CRM/kpi ed è lo stesso per tutte e quattro. Due schede sorelle che
 *  rispondono su finestre diverse si contraddicono in silenzio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { creaFiltroPeriodo } from "@/crm/kpi-calcoli";
import { periodoDi, schedaDi } from "@/crm/kpi/periodo";
import { RitornoScheda } from "@/crm/kpi/RitornoScheda";
import { FontiScheda } from "@/crm/kpi/FontiScheda";
import { TelefonoScheda } from "@/crm/kpi/TelefonoScheda";
import { ConsulentiScheda } from "@/crm/kpi/ConsulentiScheda";

export const Route = createFileRoute("/CRM/kpi/")({
  head: () => ({ meta: [{ title: "KPI — CRM" }] }),
  component: SchedaScelta,
});

function SchedaScelta() {
  const ricerca = Route.useSearch();
  const intervallo = periodoDi(ricerca);
  //  «Chiamate» è l'unica che vuole il filtro già fatto invece dell'intervallo:
  //  non legge nessuna spesa e non le serve sapere su quali date sta guardando.
  const dentro = useMemo(() => creaFiltroPeriodo(intervallo), [intervallo]);

  const scheda = schedaDi(ricerca);
  if (scheda === "fonti") return <FontiScheda intervallo={intervallo} />;
  if (scheda === "chiamate") return <TelefonoScheda dentro={dentro} />;
  if (scheda === "consulenti") return <ConsulentiScheda intervallo={intervallo} />;
  return <RitornoScheda intervallo={intervallo} />;
}
