/** HelpButton — icona ? in topbar CRM con guida testuale contestuale alla pagina corrente. */
import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra, NotaFinestra, SezioneFinestra } from "@/crm/ui/Finestra";

interface GuideEntry {
  title: string;
  intro: string;
  steps: { t: string; d: string }[];
}

const GUIDES: { match: (path: string) => boolean; guide: GuideEntry }[] = [
  {
    match: (p) => p === "/CRM" || p === "/CRM/",
    guide: {
      title: "Dashboard",
      intro: "Panoramica generale: lead recenti, KPI e alert.",
      steps: [
        { t: "Lead in arrivo", d: "I nuovi lead della landing arrivano qui in tempo reale." },
        { t: "Allerta rosse", d: "Cliccale per vedere lead urgenti o problemi sync." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/CRM/agenda"),
    guide: {
      title: "Agenda",
      intro: "Vedi il calendario per consulente e crea/modifica appuntamenti rapidamente.",
      steps: [
        { t: "Cambia consulente", d: "Filtro in alto: ogni consulente ha la sua agenda." },
        { t: "Clicca un giorno", d: "Si apre il pannello con prenotazioni e slot liberi reali." },
        { t: "Durata", d: "Cambia 15/30/45/60/90' per ricalcolare gli slot disponibili." },
        { t: "Crea lead in 1 click", d: "Scegli stato + slot → form rapido nella colonna destra." },
      ],
    },
  },
  {
    //  Confronto esatto sull'elenco: "/CRM/trattative" è prefisso anche di
    //  "/CRM/trattative-perse", che è un'altra pagina e ha un'altra guida.
    match: (p) => p === "/CRM/trattative" || p.startsWith("/CRM/nuovi-contatti"),
    guide: {
      title: "Trattative",
      intro: "Tutti i lead in un'unica tabella, filtrabili e ordinabili.",
      steps: [
        { t: "Apri scheda", d: "Click sulla riga: si apre il dialog con Booking · Vendita · Anagrafica." },
        { t: "WhatsApp", d: "Pulsante verde scuro in alto a destra — messaggio precompilato in base allo stato." },
        { t: "Salva acconto", d: "Sidebar sinistra → quick-action 'Imposta acconto' → stato passa ad 'Acconto Pagato'." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/CRM/kpi"),
    guide: {
      title: "KPI",
      intro: "Tutte le metriche di funnel, attribuzione e retargeting.",
      steps: [
        { t: "Range date", d: "In alto: cambia il periodo di analisi." },
        { t: "Retargeting & Attribution", d: "Toggle 'Solo cold / Solo retargeting' nelle tabelle segmentate per confrontare la qualità del traffico." },
        { t: "Badge delta", d: "Vedi 'retarget +X.Xpp vs cold' a colpo d'occhio." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/CRM/campagne-meta") || p.startsWith("/CRM/campagne-tiktok"),
    guide: {
      title: "Campagne",
      intro: "Performance per creativo e ad — Meta + TikTok.",
      steps: [
        { t: "Verdetto", d: "Badge automatico (Scale / Pause / Watch) in base a CPL e qualità." },
        { t: "Deep analysis", d: "Click sull'ad → analisi completa (LP funnel, video, scroll, fatigue)." },
      ],
    },
  },
  {
    match: (p) => p.startsWith("/CRM/impostazioni"),
    guide: {
      title: "Impostazioni",
      intro: "Tracking pixel, API Meta + TikTok, permessi utenti.",
      steps: [
        { t: "Meta", d: "Pixel ID + Access Token + Ad Account ID per CAPI e sync spesa." },
        { t: "TikTok", d: "Pixel ID + Advertiser ID + Access Token. Sync spesa giornaliera automatica." },
        { t: "Permessi", d: "Solo admin: assegna le schede del CRM ad ogni utente." },
      ],
    },
  },
];

const FALLBACK: GuideEntry = {
  title: "Guida",
  intro: "Naviga nel CRM dalla sidebar a sinistra. Per ogni sezione è disponibile una guida specifica.",
  steps: [
    { t: "Sidebar", d: "Tutte le sezioni del CRM sono lì." },
    { t: "Dashboard", d: "Panoramica veloce all'apertura." },
  ],
};

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const guide = GUIDES.find((g) => g.match(location.pathname))?.guide ?? FALLBACK;

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Guida pagina"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      <Finestra
        aperta={open}
        onCambio={setOpen}
        titolo="Come si usa questa pagina"
        contesto={guide.title}
        icona={HelpCircle}
        larghezza="sm"
        classeCorpo="space-y-3"
        azioni={<Button onClick={() => setOpen(false)}>Ho capito</Button>}
      >
        <NotaFinestra>{guide.intro}</NotaFinestra>

        <SezioneFinestra senzaPadding>
          <ol className="divide-y divide-slate-200">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-3 px-4 py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold tabular-nums text-slate-600">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate-900">{s.t}</div>
                  <div className="text-[12px] leading-snug text-slate-500">{s.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </SezioneFinestra>

        <p className="text-[11px] text-slate-400">
          La guida cambia automaticamente in base alla pagina in cui ti trovi.
        </p>
      </Finestra>
    </>
  );
}
