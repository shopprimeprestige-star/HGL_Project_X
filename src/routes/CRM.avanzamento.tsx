/** ── /CRM/avanzamento — L'ELENCO COMPLETO DEI LEAD IMPORTATI ───────────────
 *
 *  ── NON È PIÙ UNA VOCE DI MENU, È UN ATTREZZO ────────────────────────────
 *  Nel menu c'erano due voci che cominciavano con le stesse due parole:
 *  «Lead importati» (questa) e «Lead importati · uno alla volta» (la coda di
 *  chiamata, /CRM/importa). Si apriva ogni volta quella sbagliata. Il
 *  committente ne ha chiesta una, e quella che è rimasta nel menu è la CODA,
 *  perché è il gesto che si ripete duecento volte al giorno.
 *  Questa pagina NON è stata cancellata e non va cancellata: è `nascosta: true`
 *  in crm/CRMSidebar.tsx — la rotta esiste, i preferiti funzionano, ⌘K continua
 *  a portarci — e ci si arriva dal pulsante «Elenco completo» nella testata di
 *  /CRM/importa. Qui vivono le tre cose che la coda non sa fare (i filtri, le
 *  azioni di gruppo su una selezione, l'esportazione in CSV) e la lente «Tutta
 *  la coda», che è l'unico posto del CRM in cui si vede cosa è in ritardo su
 *  TUTTO l'archivio e non solo sulle liste importate.
 *  ⚠️ IL TITOLO A SCHERMO NON PUÒ TORNARE «Lead importati» E BASTA: adesso è
 *   il nome della coda, e due schermate con lo stesso nome sono il difetto che
 *   questa separazione è servita a togliere.
 *
 *  ── PERCHÉ L'INDIRIZZO NON CAMBIA ────────────────────────────────────────
 *  La schermata ha cambiato nome tre volte (pipeline → Avanzamento → Da fare →
 *  Lead importati) e l'indirizzo mai: è nei preferiti di chi la apre ogni
 *  mattina, e ci puntano il menu (crm/CRMSidebar.tsx), la pagina iniziale del
 *  CRM (routes/CRM.index.tsx), la ricerca ⌘K — che pesca dalla stessa lista del
 *  menu, GRUPPI_MENU — e la tabella dei vecchi nomi (routes/CRM.$.tsx, dove
 *  «pipeline» reindirizza qui). Rinominare l'indirizzo avrebbe voluto dire
 *  rompere tutti e quattro insieme per guadagnare zero.
 *
 *  ── PERCHÉ SI CHIAMA COSÌ ────────────────────────────────────────────────
 *  «Da fare» non diceva cosa c'è dentro: qualunque schermata del CRM è roba da
 *  fare. Qui dentro c'è il lavoro del setter — si carica una lista di contatti
 *  e la si chiama — ed è adesso l'unico posto da cui quel lavoro si fa per
 *  intero: caricare il CSV, controllare come è stato letto, scrivere
 *  l'archivio, chiamare dalla riga, segnare l'esito.
 *  La coda completa (tutti i lead con la loro prossima scadenza) NON è sparita:
 *  è la seconda lente dentro la schermata, «Tutta la coda». Il perché per
 *  esteso sta in crm/kpi/DaFareScheda.tsx.
 *
 *  ── IL PERIODO È SUO, E PARTE DA «TUTTO» ─────────────────────────────────
 *  Il periodo non sta nell'indirizzo e non è condiviso con nessuno: è un
 *  comando facoltativo per restringere, non il patto della pagina. Si apre su
 *  tutto lo storico perché la domanda è «cosa è in ritardo», e una scadenza di
 *  aprile è in ritardo esattamente quanto una di ieri. Serve invece eccome a
 *  isolare la lista caricata stamattina, che è il caso d'uso di questa pagina.
 *  ───────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PhoneCall, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BarraAzioni, Pagina, Titolo } from "@/crm/ui";
import { creaFiltroPeriodo, type Intervallo } from "@/crm/kpi-calcoli";
import { INTERVALLI } from "@/crm/kpi/periodo";
import { DaFareScheda } from "@/crm/kpi/DaFareScheda";

export const Route = createFileRoute("/CRM/avanzamento")({
  head: () => ({ meta: [{ title: "Elenco completo dei lead importati — CRM" }] }),
  component: PaginaLeadImportati,
});

function PaginaLeadImportati() {
  /** Tutto lo storico: vedi l'intestazione. Chi vuole restringere lo fa con la
   *  barra qui sotto, e il valore resta finché non cambia pagina — non è un
   *  dato da condividere con un collega, è un modo di guardare. */
  const [intervallo, setIntervallo] = useState<Intervallo>("tutto");
  const dentro = useMemo(() => creaFiltroPeriodo(intervallo), [intervallo]);

  return (
    <Pagina larga>
      <Titolo
        testo="Elenco completo dei lead importati"
        nota="La tabella: filtri, azioni di gruppo, esportazione. Per chiamare uno alla volta c'è «Lead importati»"
        icona={Upload}
        //  ── LA VIA DEL RITORNO ────────────────────────────────────────────
        //   Questa pagina non ha più una riga nel menu, quindi chi ci arriva da
        //   un preferito vecchio non ha nessun modo OVVIO di tornare al lavoro
        //   di tutti i giorni: il menu, accanto, adesso mostra un nome solo e
        //   quel nome non è questo. Senza questo pulsante si esce di qui
        //   soltanto sapendo già dove andare.
        azioni={
          <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
            <Link to="/CRM/importa" title="La postazione: chiami, segni l'esito, passi al prossimo">
              <PhoneCall className="mr-1 h-3.5 w-3.5" /> Lead importati
            </Link>
          </Button>
        }
      />

      {/* ── IL PERIODO, COME COMANDO FACOLTATIVO ─────────────────────────────
          `fissa={false}`: la schermata qui sotto ha già la sua barra di lavoro
          (stato, assegnazione, ricerca) e due barre appiccicate in alto si
          coprono a vicenda. */}
      <BarraAzioni fissa={false}>
        <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Entrati
        </span>
        {INTERVALLI.map(({ v, t }) => (
          <button
            key={v}
            type="button"
            onClick={() => setIntervallo(v)}
            aria-pressed={intervallo === v}
            className={cn(
              "inline-flex items-center rounded-lg border px-2.5 py-1 text-[12px] font-medium transition",
              intervallo === v
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
        <span className="text-[11px] text-muted-foreground">
          Taglia sulla data di <strong>ingresso</strong> del lead, non sulla scadenza: serve a
          isolare una lista appena caricata, non a nascondere i ritardi vecchi
        </span>
      </BarraAzioni>

      <DaFareScheda
        dentro={dentro}
        intervallo={intervallo}
        onTuttoLoStorico={() => setIntervallo("tutto")}
      />
    </Pagina>
  );
}
