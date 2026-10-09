/** ─────────────────────────────────────────────────────────────────────────
 *  L'INDIRIZZO CHE NON C'È PIÙ
 *
 *  PERCHÉ SERVE
 *  Gli indirizzi del CRM sono stati riscritti in italiano ("/CRM/leads" è
 *  diventato "/CRM/trattative"), ma i vecchi non sono spariti dal mondo: sono
 *  scritti dentro le notifiche già salvate a database (la colonna `link` di
 *  `notifications`), nello storico avvisi tenuto nel browser, e nei segnalibri
 *  di chi lavora al CRM da mesi. Senza questa rotta ognuno di quei clic
 *  finirebbe in una pagina che non esiste — e chi la subisce non vedrebbe un
 *  indirizzo cambiato: vedrebbe il CRM rotto.
 *
 *  DUE COMPORTAMENTI, NON UNO
 *   · INDIRIZZO RINOMINATO (è in tabella) → si va dritti al nuovo, senza
 *     mostrare niente: un segnalibro che funziona non deve chiedere permesso.
 *     Il reindirizzamento sostituisce la voce nella cronologia (`replace`), così
 *     il tasto "indietro" riporta da dove si veniva e non al vecchio indirizzo
 *     che rimanderebbe subito avanti.
 *   · INDIRIZZO SCONOSCIUTO (errore di battitura, link vecchio di due riscritture
 *     fa, pagina rimossa) → prima si rimbalzava in silenzio alla pagina di
 *     apertura. Sembrava che il clic non avesse funzionato, e la seconda volta si
 *     riprovava lo stesso link. Adesso la pagina dice l'indirizzo che non esiste,
 *     spiega che i nomi sono cambiati, e mette in mano le destinazioni giuste.
 *
 *  QUANDO SI PUÒ SEMPLIFICARE QUESTO FILE
 *  La tabella dei vecchi nomi serve finché girano notifiche salvate con i vecchi
 *  link e segnalibri vecchi: diciamo qualche mese. Quando si toglie, la pagina
 *  qui sotto resta comunque — una destinazione per gli indirizzi sbagliati serve
 *  sempre.
 *  ───────────────────────────────────────────────────────────────────────── */

import { createFileRoute, Link, redirect, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Compass, Home } from "lucide-react";
import { Pagina, Scheda } from "@/crm/ui";

/** Vecchio nome → nuovo indirizzo. Solo le pagine che hanno cambiato nome:
 *  quelle rimaste uguali (agenda, sede, prezzi, sconti…) non passano di qui. */
const VECCHI_INDIRIZZI: Record<string, string> = {
  leads: "/CRM/trattative",
  nuovi: "/CRM/nuovi-contatti",
  pipeline: "/CRM/avanzamento",
  "perdi-analisi": "/CRM/trattative-perse",
  performance: "/CRM/landing-page",
  "ads-manager": "/CRM/campagne-meta",
  "tiktok-ads-manager": "/CRM/campagne-tiktok",
  attribution: "/CRM/attribuzione",
  disponibilita: "/CRM/orari-disponibili",
  "kpi-manuale": "/CRM/kpi/manuale",
  "installazioni-oggi": "/CRM/installazioni/oggi",
  //  ⚠️ "installazioni-agenda" PUNTA ALL'ELENCO, non più a una pagina sua: la
  //   pagina /CRM/installazioni/agenda è stata tolta, e questa riga la
  //   indicava ancora. Chi arrivava da un segnalibro vecchio veniva quindi
  //   rimbalzato con precisione su una rotta morta — cioè peggio che non avere
  //   la riga affatto, perché il reindirizzamento sembrava funzionare.
  //   La coda che quella pagina mostrava si guarda dall'elenco, con le sue
  //   lenti: è la destinazione giusta per chi cercava l'agenda della posa.
  "installazioni-agenda": "/CRM/installazioni",
};

/** ── TUTTI GLI INDIRIZZI CHE ESISTONO DAVVERO ─────────────────────────────
 *  Serve a una cosa sola: capire se chi è finito qui ha sbagliato a scrivere.
 *  Un segnalibro vecchio di due riscritture non sta nella tabella qui sopra,
 *  ma somiglia sempre a qualcosa — e "forse cercavi Trattative" risolve in un
 *  clic quello che altrimenti costa un giro nel menu. */
const INDIRIZZI_VERI: { via: string; nome: string }[] = [
  { via: "/CRM", nome: "Apertura" },
  { via: "/CRM/trattative", nome: "Trattative" },
  { via: "/CRM/trattative-perse", nome: "Trattative perse" },
  { via: "/CRM/nuovi-contatti", nome: "Nuovi contatti" },
  { via: "/CRM/agenda", nome: "Agenda" },
  //  ⚠️ QUI C'ERA «Avanzamento», che è un nome che a schermo non esiste più da
  //   nessuna parte: la pagina si intitola «Elenco completo dei lead importati»
  //   (routes/CRM.avanzamento.tsx), e con quel nome sta anche nel menu fra le
  //   voci nascoste (crm/CRMSidebar.tsx). Questo elenco serve a dire «forse
  //   cercavi…», cioè a rimandare la parola che la gente legge: un suggerimento
  //   che propone un nome scomparso manda a cercare nel menu una voce che non
  //   c'è, ed è peggio del silenzio — sembra funzionare.
  { via: "/CRM/avanzamento", nome: "Elenco completo dei lead importati" },
  { via: "/CRM/kpi", nome: "KPI" },
  { via: "/CRM/kpi/manuale", nome: "KPI manuale" },
  { via: "/CRM/installazioni", nome: "Installazioni" },
  { via: "/CRM/installazioni/oggi", nome: "Installazioni di oggi" },
  { via: "/CRM/orari-disponibili", nome: "Orari disponibili" },
  { via: "/CRM/attribuzione", nome: "Attribuzione" },
  { via: "/CRM/campagne-meta", nome: "Campagne Meta" },
  { via: "/CRM/campagne-tiktok", nome: "Campagne TikTok" },
  { via: "/CRM/landing-page", nome: "Landing page" },
  { via: "/CRM/whatsapp", nome: "WhatsApp" },
  { via: "/CRM/preventivi", nome: "Preventivi" },
  { via: "/CRM/sede", nome: "Sede" },
  { via: "/CRM/prezzi", nome: "Prezzi" },
  { via: "/CRM/sconti", nome: "Sconti" },
  //  Il percorso è ancora /CRM/consulenti (e resta così: ci sono link salvati
  //  in giro), ma il nome da proporre è quello che si legge nel menu — questo
  //  elenco serve a dire «forse cercavi…», e deve dirlo con la parola che poi
  //  si ritrova nella barra laterale.
  { via: "/CRM/consulenti", nome: "Collaboratori" },
  { via: "/CRM/impostazioni", nome: "Impostazioni" },
  { via: "/CRM/notifiche", nome: "Notifiche" },
  //  ⚠️ Queste due esistono da poco e MANCAVANO da questo elenco: chi sbagliava
  //   a scriverle si sentiva rispondere "non esiste" da una pagina che invece
  //   c'è. L'elenco serve a dire «forse cercavi…», e un indirizzo vero che non
  //   compare qui è un suggerimento che non arriverà mai.
  { via: "/CRM/dafare", nome: "Da fare oggi" },
  //  Il «, uno alla volta» è caduto insieme alla voce di menu omonima: adesso
  //  la schermata si chiama così e basta, e questo elenco deve dire il nome che
  //  la gente legge nel menu — è tutto il suo mestiere.
  { via: "/CRM/importa", nome: "Lead importati" },
];

/** Distanza fra due parole: quante lettere bisogna cambiare per passare
 *  dall'una all'altra. È la versione minima di Levenshtein — bastano venti
 *  indirizzi corti, non serve nient'altro e non vale la pena aggiungere una
 *  libreria per questo. */
function distanza(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prec = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prec[j] + 1,
        cur[j - 1] + 1,
        prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prec = cur;
  }
  return prec[n];
}

/** L'indirizzo esistente più somigliante, se somiglia abbastanza da valere la
 *  proposta: sotto questa soglia si suggerirebbe una pagina a caso, che è
 *  peggio di non suggerire niente. */
function forseCercavi(percorso: string): { via: string; nome: string } | null {
  const cercato = percorso.toLowerCase().replace(/^\/crm\/?/, "").replace(/\/+$/, "");
  if (!cercato) return null;
  let migliore: { via: string; nome: string } | null = null;
  let minimo = Infinity;
  for (const i of INDIRIZZI_VERI) {
    const nome = i.via.toLowerCase().replace(/^\/crm\/?/, "");
    if (!nome) continue;
    //  Chi scrive metà indirizzo ("/CRM/tratt") non ha sbagliato: ha
    //  abbreviato. Il contenuto vale quanto la somiglianza.
    const d = nome.startsWith(cercato) || cercato.startsWith(nome) ? 0 : distanza(cercato, nome);
    if (d < minimo) {
      minimo = d;
      migliore = i;
    }
  }
  //  Un terzo delle lettere sbagliate è ancora un errore di battitura; oltre,
  //  è un'altra parola.
  return migliore && minimo <= Math.max(2, Math.floor(cercato.length / 3)) ? migliore : null;
}

/** ── LE DESTINAZIONI, IN ORDINE DI URGENZA ────────────────────────────────
 *  Non è la copia del menu: chi finisce qui ha sbagliato indirizzo, non sta
 *  esplorando. Ci stanno le pagine da cui si passa ogni giorno, raggruppate per
 *  la domanda che risolvono, e nient'altro — un elenco di venti voci si legge
 *  come un menu e riporta al punto di partenza. Il menu completo resta nella
 *  barra laterale, che è sempre lì accanto. */
const DESTINAZIONI = [
  {
    gruppo: "Il lavoro di oggi",
    voci: [
      { a: "/CRM", titolo: "Apertura", nota: "Cosa scade oggi e cosa è in ritardo" },
      { a: "/CRM/agenda", titolo: "Agenda", nota: "Le consulenze del giorno" },
      { a: "/CRM/nuovi-contatti", titolo: "Nuovi contatti", nota: "Arrivati e da chiamare" },
      { a: "/CRM/trattative", titolo: "Trattative", nota: "L'elenco completo, con la ricerca" },
      //  ⚠️ Era «Avanzamento», ed era nel gruppo sbagliato: /CRM/avanzamento non
      //   è più nel menu (è l'elenco in tabella, si apre da qui dentro) e il
      //   lavoro sulle liste caricate si fa in /CRM/importa. Un elenco di
      //   destinazioni che manda a una pagina uscita dal menu fa fare due giri.
      {
        a: "/CRM/importa",
        titolo: "Lead importati",
        nota: "Le liste caricate: si chiama e si segna l'esito",
      },
      { a: "/CRM/whatsapp", titolo: "WhatsApp", nota: "Le conversazioni e i messaggi pronti" },
    ],
  },
  {
    gruppo: "Come sta andando",
    voci: [
      { a: "/CRM/kpi", titolo: "KPI", nota: "I numeri del periodo" },
      { a: "/CRM/trattative-perse", titolo: "Trattative perse", nota: "Perché si è perso, e chi riprendere" },
      { a: "/CRM/landing-page", titolo: "Landing page", nota: "Contenuti pubblici e rendimento" },
    ],
  },
  {
    gruppo: "Impostare",
    voci: [
      { a: "/CRM/orari-disponibili", titolo: "Orari disponibili", nota: "La settimana tipo e le ferie" },
      {
        a: "/CRM/consulenti",
        titolo: "Collaboratori",
        //  «Chi lavora i contatti» descriveva il solo consulente: qui si
        //  gestiscono anche driver, installatori e accompagnatori.
        nota: "Chi lavora con noi: mestieri, accessi e orari",
      },
      { a: "/CRM/prezzi", titolo: "Prezzi", nota: "Listino e pacchetti" },
      { a: "/CRM/impostazioni", titolo: "Impostazioni", nota: "Integrazioni, avvisi, utenti" },
    ],
  },
] as const;

export const Route = createFileRoute("/CRM/$")({
  beforeLoad: ({ location }) => {
    //  Si legge dal percorso invece che dal parametro della rotta: così la
    //  tabella qui sopra resta l'unica cosa da guardare per capire cosa succede.
    const resto = location.pathname.replace(/^\/CRM\/?/, "").replace(/\/+$/, "");
    const nuovo = VECCHI_INDIRIZZI[resto];
    //  Solo i nomi conosciuti vengono reindirizzati. Tutto il resto arriva alla
    //  pagina qui sotto: mandare in silenzio all'apertura un indirizzo che non
    //  esiste fa credere che sia stato il clic a non funzionare.
    if (nuovo) throw redirect({ to: nuovo, search: location.search, replace: true });
  },
  component: PaginaNonTrovata,
});

function PaginaNonTrovata() {
  const percorso = useRouterState({ select: (s) => s.location.pathname });
  const vicino = forseCercavi(percorso);

  return (
    <Pagina>
      {/*  Niente <Titolo/> con l'icona d'allarme: non è un guasto del CRM, è un
          indirizzo che non esiste più. Il tono lo dice prima delle parole. */}
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <Compass className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold leading-tight tracking-tight">
            Questa pagina non esiste
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            L'indirizzo{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px] text-foreground">
              {percorso}
            </code>{" "}
            non corrisponde a nessuna pagina del CRM.
          </p>
        </div>
      </div>

      {/*  Se l'indirizzo somiglia a uno vero è quasi sempre quello: sta sopra
          a tutto il resto, perché risolve senza far leggere niente. */}
      {vicino && (
        <Link
          to={vicino.via}
          className="group flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-3.5 py-2.5 transition-colors hover:bg-sky-500/10"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-sky-700">
              Forse cercavi
            </span>
            <span className="block truncate text-[14px] font-semibold leading-tight">
              {vicino.nome}
            </span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {vicino.via}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-sky-700 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/*  La spiegazione sta prima dei collegamenti: chi è arrivato da un
          segnalibro deve capire che il segnalibro è da rifare, altrimenti
          domani ripete lo stesso clic. */}
      <Scheda className="border-sky-500/25 bg-sky-500/[0.04]">
        <p className="text-[12.5px] leading-relaxed">
          <span className="font-semibold">Cosa è successo.</span> Le pagine del CRM sono state
          rinominate in italiano: <span className="font-medium">/CRM/leads</span> è diventato{" "}
          <span className="font-medium">/CRM/trattative</span>,{" "}
          <span className="font-medium">/CRM/disponibilita</span> è diventato{" "}
          <span className="font-medium">/CRM/orari-disponibili</span>, e così via. I vecchi
          indirizzi vengono ancora tradotti in automatico, ma questo non è fra quelli: è un nome
          che il CRM non ha mai avuto, oppure una pagina rimossa.
        </p>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Se ci sei arrivato da un segnalibro, aggiornalo con la pagina giusta qui sotto.
        </p>
      </Scheda>

      <Scheda titolo="Dove volevi andare" nota="Le pagine da cui si passa ogni giorno">
        <div className="grid gap-4 md:grid-cols-3">
          {DESTINAZIONI.map((g) => (
            <div key={g.gruppo} className="min-w-0">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {g.gruppo}
              </div>
              <div className="flex flex-col gap-1">
                {g.voci.map((v) => (
                  <Link
                    key={v.a}
                    to={v.a}
                    className="group flex min-w-0 items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-accent/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-tight">
                        {v.titolo}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {v.nota}
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Scheda>

      <div>
        <Link
          to="/CRM"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium hover:bg-accent"
        >
          <Home className="h-3.5 w-3.5" />
          Torna all'apertura
        </Link>
      </div>
    </Pagina>
  );
}
