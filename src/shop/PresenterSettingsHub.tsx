// Hub Impostazioni del presentatore — modale a schermo intero (solo consulente).
//
// ── QUI DENTRO STA TUTTA LA CONFIGURAZIONE DELLA VENDITA ─────────────────────
//  Le impostazioni di Meetly stavano in due case: alcune qui, altre nelle pagine
//  del gestionale (/CRM/prezzi e /CRM/sconti). Il listino e gli sconti decidono
//  le cifre che il cliente vede DURANTE la consulenza: sono impostazioni del
//  software di vendita, non del gestionale, e adesso stanno tutte qui — senza
//  uscire dalla presentazione e senza dover entrare nel CRM.
//  · scheda "Listino"  → shop/SettingsListino.tsx  (era /CRM/prezzi)
//  · scheda "Sconti"   → shop/SettingsSconti.tsx   (era /CRM/sconti + i vecchi
//    riquadri Coupon e Sconti quantità di questo file)
//  Le due pagine del CRM restano come rimando: chi ha il vecchio indirizzo nei
//  preferiti trova scritto dove sono finite le impostazioni.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X, Ticket, Trash2, Plus, BarChart3, ImageIcon,
  Star, Tag, Images, Server, ExternalLink, RefreshCw, Users, LogOut, Film, Copy, Play,
  Gauge, ArrowUp, ArrowDown, Clock, Phone, AlertTriangle, Euro, Save,
 FileText,} from "lucide-react";
import { toast } from "sonner";
import { copyLink } from "@/shop/copied";
import { usePresenterLink } from "@/shop/consultant";
import { CasesManager, type Caso } from "@/shop/CasesManager";
import { usePresenter, clearPresenter, type Presenter } from "@/shop/presenter";
import { SettingsListino } from "@/shop/SettingsListino";
import { SettingsSconti } from "@/shop/SettingsSconti";

interface Registrazione {
  id: string; presenterId: string; presenterName: string;
  url: string; date: string; duration: number; guestName: string;
  size?: number; // byte del file, se tracciato dall'upload
  quoteRef?: string;   // preventivo aperto durante quella consulenza
}

// Consumo dati di una videochiamata (byte misurati via WebRTC getStats)
interface Consumo {
  id: string; presenterId: string; presenterName: string;
  date: string; sessionCode: string;
  bytesSent: number; bytesReceived: number; durationSec: number; guests: number;
}

/** Byte → MB con un decimale, GB oltre i 1024 MB. */
function fmtBytes(b: number): string {
  const mb = (Number(b) || 0) / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

//  Il listino e gli sconti non sono più due riquadri di questo file: sono due
//  schede intere, con bozza e conferma prima di scrivere. Vivono in
//  shop/SettingsListino.tsx e shop/SettingsSconti.tsx.
type Tab = "preventivi" | "listino" | "sconti" | "numeri" | "logo" | "casi" | "presentatori" | "registrazioni" | "consumo" | "errori" | "altro";

const input = "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none";
const label = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/45";

export function PresenterSettingsHub({ onClose, initialTab }: { onClose: () => void; initialTab?: Tab }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(initialTab ?? "sconti");

  // ---- Ricarica a comando ----
  //  Il pulsante in alto ricaricava i coupon. Ora listino e sconti sono due
  //  schede con vita propria: si dice loro di rileggere alzando questo numero,
  //  invece di tenere qui uno stato che non serve a nessun'altra scheda.
  const [ricarica, setRicarica] = useState(0);

  // ---- Numeri / statistiche ----
  const [stats, setStats] = useState<Record<string, string>>({});
  const [savingStats, setSavingStats] = useState(false);
  useEffect(() => { fetch("/api/presenter/stats").then((r) => r.json()).then((j) => setStats(j.stats ?? {})).catch(() => {}); }, []);
  const saveStats = async () => {
    setSavingStats(true);
    const j = await fetch("/api/presenter/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stats) }).then((r) => r.json());
    setSavingStats(false);
    toast[j.ok ? "success" : "error"](j.ok ? "Numeri salvati" : "Errore");
  };

  // ---- Logo brand ----
  const [logoUrl, setLogoUrl] = useState("");
  const [savingLogo, setSavingLogo] = useState(false);
  useEffect(() => { fetch("/api/presenter/brand").then((r) => r.json()).then((j) => setLogoUrl(j.logoUrl ?? "")).catch(() => {}); }, []);
  const saveLogo = async () => {
    setSavingLogo(true);
    const j = await fetch("/api/presenter/brand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl }) }).then((r) => r.json());
    setSavingLogo(false);
    toast[j.ok ? "success" : "error"](j.ok ? "Logo salvato" : "Errore");
  };

  // ---- Casi & Risultati (riusa CasesManager) ----
  const [cases, setCases] = useState<Caso[]>([]);
  const [casesOpen, setCasesOpen] = useState(false);
  useEffect(() => { fetch("/api/presenter/cases").then((r) => r.json()).then((j) => setCases(j.cases ?? [])).catch(() => {}); }, []);

  // ---- Presentatori (nome + PIN) ----
  const me = usePresenter();
  const [presenters, setPresenters] = useState<Presenter[]>([]);
  const [pName, setPName] = useState("");
  const [pPin, setPPin] = useState("");
  const loadPresenters = useCallback(async () => {
    try { const j = await fetch("/api/presenter/presenters").then((r) => r.json()); setPresenters((j.presenters as Presenter[]) ?? []); } catch { /* offline */ }
  }, []);
  useEffect(() => { loadPresenters(); }, [loadPresenters]);
  const postPresenter = async (payload: Record<string, unknown>) =>
    fetch("/api/presenter/presenters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json());
  const addPresenter = async () => {
    if (!pName.trim() || !/^\d{4}$/.test(pPin)) { toast.error("Serve un nome e un PIN di 4 cifre"); return; }
    const j = await postPresenter({ action: "create", name: pName, pin: pPin });
    if (!j.ok) { toast.error("Errore"); return; }
    setPresenters(j.presenters as Presenter[]); setPName(""); setPPin("");
    toast.success("Presentatore aggiunto");
  };
  const updPresenter = async (id: string, values: { name?: string; pin?: string }) => {
    const j = await postPresenter({ action: "update", id, ...values });
    if (j.ok) { setPresenters(j.presenters as Presenter[]); toast.success("Salvato"); } else toast.error("PIN non valido");
  };
  const delPresenter = async (id: string) => {
    const j = await postPresenter({ action: "delete", id });
    if (j.ok) setPresenters(j.presenters as Presenter[]);
  };
  const switchPresenter = () => { clearPresenter(); onClose(); };
  //  Consegnato dal server a chi ha una sessione valida: il codice consulente
  //  non viaggia più dentro il pacchetto inviato al browser.
  const presenterLink = usePresenterLink();

  // ---- Registrazioni del presentatore selezionato ----
  // ARCHIVIO: carico TUTTE le registrazioni e filtro/raggruppo per PRESENTATORE
  // lato client (così il menu a tendina mostra sempre chi ha registrato cosa).
  const [recs, setRecs] = useState<Registrazione[]>([]);
  const [recFilter, setRecFilter] = useState<string>("__me");   // "__me" | "__all" | presenterId
  const [playing, setPlaying] = useState<Registrazione | null>(null); // player inline aperto
  const loadRecs = useCallback(async () => {
    try {
      const j = await fetch("/api/presenter/recordings").then((r) => r.json());
      const list = (j.recordings as Registrazione[]) ?? [];
      list.sort((a, b) => (a.date < b.date ? 1 : -1)); // più recenti in cima
      setRecs(list);
    } catch { /* offline */ }
  }, []);
  useEffect(() => { loadRecs(); }, [loadRecs]);
  // dopo ogni registrazione caricata sul server l'elenco si aggiorna da solo
  useEffect(() => {
    window.addEventListener("hg-recordings-updated", loadRecs);
    return () => window.removeEventListener("hg-recordings-updated", loadRecs);
  }, [loadRecs]);
  const delRec = async (id: string) => {
    await fetch("/api/presenter/recordings?id=" + encodeURIComponent(id), { method: "DELETE" }).catch(() => {});
    setRecs((r) => r.filter((x) => x.id !== id));
    setPlaying((p) => (p && p.id === id ? null : p));
  };
  const fmtDur = (s: number) => (s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : "—");
  // elenco presentatori presenti nell'archivio (anche quelli cancellati dall'anagrafica)
  const recPresenters = Array.from(new Map(recs.map((r) => [r.presenterId || r.presenterName, { id: r.presenterId || "", name: r.presenterName || "Senza nome" }])).values());
  const shownRecs = recs.filter((r) =>
    recFilter === "__all" ? true : recFilter === "__me" ? (me?.id ? r.presenterId === me.id : true) : r.presenterId === recFilter);

  // ---- Consumo dati (MB/GB delle videochiamate) ----
  // Carico TUTTE le voci e filtro lato client per PRESENTATORE e per DATA.
  const [usage, setUsage] = useState<Consumo[]>([]);
  const [useFilter, setUseFilter] = useState<string>("__me");   // "__me" | "__all" | presenterId
  const [dFrom, setDFrom] = useState<string>("");               // YYYY-MM-DD (vuoto = senza limite)
  const [dTo, setDTo] = useState<string>("");
  const [preset, setPreset] = useState<"oggi" | "7" | "30" | "tutto">("tutto");
  const loadUsage = useCallback(async () => {
    try {
      const j = await fetch("/api/presenter/usage").then((r) => r.json());
      const list = (j.usage as Consumo[]) ?? [];
      list.sort((a, b) => (a.date < b.date ? 1 : -1));
      setUsage(list);
    } catch { /* offline */ }
  }, []);
  useEffect(() => { loadUsage(); }, [loadUsage]);
  useEffect(() => {
    window.addEventListener("hg-usage-updated", loadUsage);
    return () => window.removeEventListener("hg-usage-updated", loadUsage);
  }, [loadUsage]);
  const applyPreset = (p: "oggi" | "7" | "30" | "tutto") => {
    setPreset(p);
    const now = new Date();
    if (p === "tutto") { setDFrom(""); setDTo(""); return; }
    const days = p === "oggi" ? 0 : p === "7" ? 6 : 29;
    const from = new Date(now); from.setDate(now.getDate() - days);
    setDFrom(ymd(from)); setDTo(ymd(now));
  };
  const usePresenters = Array.from(new Map(usage.map((u) => [u.presenterId || u.presenterName, { id: u.presenterId || "", name: u.presenterName || "Senza nome" }])).values());
  const shownUsage = usage.filter((u) => {
    const okP = useFilter === "__all" ? true : useFilter === "__me" ? (me?.id ? u.presenterId === me.id : true) : u.presenterId === useFilter;
    if (!okP) return false;
    const d = (u.date || "").slice(0, 10);
    if (dFrom && d < dFrom) return false;
    if (dTo && d > dTo) return false;
    return true;
  });
  const totSent = shownUsage.reduce((n, u) => n + (Number(u.bytesSent) || 0), 0);
  const totRecv = shownUsage.reduce((n, u) => n + (Number(u.bytesReceived) || 0), 0);
  const totDur = shownUsage.reduce((n, u) => n + (Number(u.durationSec) || 0), 0);
  const fmtDurLong = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
  };
  // Registrazioni archiviate: lo spazio è noto solo se l'upload ha salvato la dimensione
  const recsInRange = recs.filter((r) => {
    const okP = useFilter === "__all" ? true : useFilter === "__me" ? (me?.id ? r.presenterId === me.id : true) : r.presenterId === useFilter;
    if (!okP) return false;
    const d = (r.date || "").slice(0, 10);
    if (dFrom && d < dFrom) return false;
    if (dTo && d > dTo) return false;
    return true;
  });
  const recsBytes = recsInRange.reduce((n, r) => n + (Number(r.size) || 0), 0);

  const goto = (href: string) => { onClose(); navigate({ to: href as never }); };

  // ── DIARIO DEGLI ERRORI ────────────────────────────────────────────────────
  //  L'avviso a schermo sparisce; qui i problemi rilevati sul dispositivo del
  //  cliente restano scritti, con pagina, orario e dettaglio tecnico.
  interface GuestErr { at: string; msg: string; stack: string; name: string; page: string; ua: string }
  const [errs, setErrs] = useState<GuestErr[]>([]);
  const [errOpen, setErrOpen] = useState<string | null>(null);
  const loadErrs = () => fetch("/api/presenter/errors").then((r) => r.json()).then((j) => setErrs(j.list ?? [])).catch(() => {});
  useEffect(() => { if (tab === "errori") loadErrs(); }, [tab]);

  // ── RICERCA PREVENTIVI ─────────────────────────────────────────────────
  //  Finora un preventivo si ritrovava solo avendo il numero sotto mano. Qui si
  //  cerca per nome, telefono, email o numero, e si riapre con un clic.
  interface QRow { quote_ref: string; nome: string; cognome: string; email: string; telefono: string; total: number; qty: number; created_at: string }
  const [qSearch, setQSearch] = useState("");
  const [qRows, setQRows] = useState<QRow[]>([]);
  const [qBusy, setQBusy] = useState(false);
  const loadQuotes = useCallback((term: string) => {
    setQBusy(true);
    fetch(`/api/presenter/quotes?q=${encodeURIComponent(term)}`)
      .then((r) => r.json()).then((j) => setQRows((j.list as QRow[]) ?? []))
      .catch(() => {}).finally(() => setQBusy(false));
  }, []);
  useEffect(() => {
    if (tab !== "preventivi") return;
    const t = setTimeout(() => loadQuotes(qSearch), qSearch ? 300 : 0);
    return () => clearTimeout(t);
  }, [tab, qSearch, loadQuotes]);

  const TABS: { key: Tab; label: string; icon: typeof Ticket }[] = [
    { key: "preventivi", label: "Preventivi", icon: FileText },
    { key: "listino", label: "Listino", icon: Euro },
    { key: "sconti", label: "Sconti e coupon", icon: Ticket },
    { key: "numeri", label: "Numeri", icon: BarChart3 },
    { key: "logo", label: "Logo", icon: ImageIcon },
    { key: "casi", label: "Casi & Risultati", icon: Star },
    { key: "presentatori", label: "Presentatori", icon: Users },
    { key: "registrazioni", label: "Registrazioni", icon: Film },
    { key: "consumo", label: "Consumo", icon: Gauge },
    { key: "errori", label: "Errori", icon: AlertTriangle },
    { key: "altro", label: "Altro", icon: Tag },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-[#050f24] text-white">
      {/* header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#081226] px-4 py-3">
        <Ticket className="h-5 w-5 text-brand" />
        <h2 className="text-sm font-semibold sm:text-base">Impostazioni presentazione</h2>
        <button onClick={() => setRicarica((n) => n + 1)} title="Ricarica listino e sconti" className="ml-auto rounded-lg border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10"><RefreshCw className="h-4 w-4" /></button>
        <button onClick={onClose} title="Chiudi" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>

      {/* tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-[#081226]/60 px-3 py-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === t.key ? "bg-brand text-white" : "text-white/65 hover:bg-white/10"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">

          {/* ── LISTINO ────────────────────────────────────────────────────
              Era /CRM/prezzi. Modifica sul posto, conferma prima di scrivere e
              verifica dopo: sta tutto in shop/SettingsListino.tsx. */}
          {tab === "listino" && (
            //  Dal riquadro della garanzia si arriva ai codici che ne
            //  sostituiscono lo sconto: sono due schede diverse, e senza questo
            //  salto bisogna sapere che esistono.
            <SettingsListino chiaveRicarica={ricarica} vaiAiCodici={() => setTab("sconti")} />
          )}

          {/* ── SCONTI E COUPON ────────────────────────────────────────────
              Erano due posti che scrivevano sulla stessa cosa (questo pannello
              e /CRM/sconti): adesso è una scheda sola, in shop/SettingsSconti.tsx,
              con la bozza e la conferma che aveva solo il gestionale. */}
          {tab === "sconti" && <SettingsSconti chiaveRicarica={ricarica} />}

          {tab === "numeri" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-brand" /> Numeri / social proof</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block"><span className={label}>Impianti realizzati</span><input value={stats.implants ?? ""} onChange={(e) => setStats({ ...stats, implants: e.target.value })} placeholder="1.200" className={input} /></label>
                <label className="block"><span className={label}>Anni esperienza</span><input value={stats.years ?? ""} onChange={(e) => setStats({ ...stats, years: e.target.value })} placeholder="8" className={input} /></label>
                <label className="block"><span className={label}>Posti rimasti</span><input value={stats.spotsLeft ?? ""} onChange={(e) => setStats({ ...stats, spotsLeft: e.target.value })} placeholder="9" className={input} /></label>
                <label className="block"><span className={label}>Posti totali</span><input value={stats.spotsTotal ?? ""} onChange={(e) => setStats({ ...stats, spotsTotal: e.target.value })} placeholder="12" className={input} /></label>
                <label className="block sm:col-span-2"><span className={label}>Testo garanzia</span><input value={stats.guarantee ?? ""} onChange={(e) => setStats({ ...stats, guarantee: e.target.value })} className={input} /></label>
              </div>
              <button onClick={saveStats} disabled={savingStats} className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60">
                <Save className="h-4 w-4" /> {savingStats ? "…" : "Salva numeri"}
              </button>
            </div>
          )}

          {tab === "logo" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><ImageIcon className="h-4 w-4 text-brand" /> Logo brand</h3>
              <p className="mb-3 mt-1 text-xs text-white/50">URL del logo (immagine su Storage o link diretto).</p>
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" className={input} />
              {logoUrl && <img src={logoUrl} alt="Anteprima logo" className="mt-3 h-10 w-auto rounded bg-white/5 p-1" />}
              <button onClick={saveLogo} disabled={savingLogo} className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60">
                <Save className="h-4 w-4" /> {savingLogo ? "…" : "Salva logo"}
              </button>
            </div>
          )}

          {tab === "casi" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Star className="h-4 w-4 text-brand" /> Casi & Risultati</h3>
              <p className="mb-3 mt-1 text-xs text-white/50">Prima/dopo e video testimonianza mostrati nelle slide.</p>
              <button onClick={() => setCasesOpen(true)} className="flex items-center gap-2 rounded-lg border border-brand bg-brand/10 px-4 py-2.5 text-sm font-medium hover:bg-brand/20">
                <Star className="h-4 w-4 text-brand" /> Gestisci Casi & Risultati {cases.length > 0 && `(${cases.length})`}
              </button>
            </div>
          )}

          {tab === "presentatori" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <Users className="h-5 w-5 text-brand" />
                <span className="text-sm">Presentatore attivo: <strong>{me?.name ?? "nessuno"}</strong></span>
                <button onClick={switchPresenter} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                  <LogOut className="h-4 w-4" /> Cambia presentatore
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4 text-brand" /> Nuovo presentatore</h3>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="block"><span className={label}>Nome</span>
                    <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Es. Marco Rossi" className={`${input} w-56`} /></label>
                  <label className="block"><span className={label}>PIN (4 cifre)</span>
                    <input value={pPin} inputMode="numeric" maxLength={4} onChange={(e) => setPPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" className={`${input} w-28 text-center tracking-[0.3em]`} /></label>
                  <button onClick={addPresenter} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110">+ Aggiungi</button>
                </div>
              </div>

              <div className="space-y-2">
                {presenters.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] py-10 text-center text-sm text-white/50">Nessun presentatore. Aggiungine uno sopra.</p>}
                {presenters.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <input defaultValue={p.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.name) updPresenter(p.id, { name: e.target.value }); }}
                      className={`${input} w-52 text-sm`} />
                    <input placeholder="nuovo PIN" inputMode="numeric" maxLength={4}
                      onKeyDown={(e) => { if (e.key === "Enter") { updPresenter(p.id, { pin: (e.target as HTMLInputElement).value }); (e.target as HTMLInputElement).value = ""; } }}
                      className={`${input} w-32 text-center text-sm tracking-[0.3em]`} />
                    {me?.id === p.id && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">attivo</span>}
                    <button onClick={() => delPresenter(p.id)} className="ml-auto rounded-md border border-white/15 p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <p className="text-[11px] text-white/40">Il PIN non viene mai mostrato: scrivine uno nuovo e premi Invio per sostituirlo.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold"><Copy className="h-4 w-4 text-brand" /> Link presentatore</h3>
                <p className="mb-3 mt-1 text-xs text-white/50">Da inviare a un altro consulente per sbloccare i controlli sul suo dispositivo.</p>
                <button onClick={() => { copyLink(presenterLink, "Link presentatore copiato"); }}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">Copia link presentatore</button>
              </div>
            </div>
          )}

          {tab === "registrazioni" && (
            <div className="space-y-2">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-white/55">
                <Film className="h-4 w-4 text-brand" />
                <span>Archivio registrazioni</span>
                {/* filtro/raggruppamento PER PRESENTATORE */}
                <select value={recFilter} onChange={(e) => setRecFilter(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#0b1730] px-2.5 py-1.5 text-xs text-white">
                  <option value="__me">Le mie ({me?.name ?? "nessun presentatore"})</option>
                  <option value="__all">Tutti i presentatori</option>
                  {recPresenters.filter((p) => p.id && p.id !== me?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <span className="text-xs text-white/35">{shownRecs.length} registrazioni</span>
                <button onClick={loadRecs} title="Aggiorna elenco" className="ml-auto rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" /></button>
              </div>
              {shownRecs.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-white/50">Nessuna registrazione archiviata. Registra una chiamata dai controlli della videochiamata.</p>
              ) : shownRecs.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="text-sm font-semibold">{new Date(r.date).toLocaleString("it-IT")}</span>
                  {recFilter !== "__me" && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">{r.presenterName || "—"}</span>}
                  {r.guestName && <span className="text-xs text-white/50">ospite: {r.guestName}</span>}
                  <span className="text-xs text-white/40">{fmtDur(r.duration)}</span>
                  {/* la consulenza e il suo preventivo sono la stessa cosa: da
                      qui ci si arriva senza doverlo ricercare per nome */}
                  {r.quoteRef && (
                    <button onClick={() => { onClose(); navigate({ to: "/preventivo", search: { id: r.quoteRef } as never }); window.dispatchEvent(new CustomEvent("hg:open-quote", { detail: r.quoteRef })); }}
                      title={`Apri il preventivo ${r.quoteRef}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-brand/20">
                      <FileText className="h-3.5 w-3.5" /> {r.quoteRef}
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => setPlaying(r)} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10"><Play className="h-3.5 w-3.5 text-brand" /> Guarda</button>
                    <a href={r.url} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10">Scarica</a>
                    <button onClick={() => delRec(r.id)} title="Elimina" className="rounded-md border border-white/15 p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {playing && <RecordingPlayer rec={playing} onClose={() => setPlaying(null)} onDelete={() => delRec(playing.id)} />}
            </div>
          )}

          {tab === "consumo" && (
            <div className="space-y-3">
              {/* filtri: presentatore + intervallo di date */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/55">
                <Gauge className="h-4 w-4 text-brand" />
                <span>Consumo dati videochiamate</span>
                <select value={useFilter} onChange={(e) => setUseFilter(e.target.value)}
                  className="rounded-lg border border-white/15 bg-[#0b1730] px-2.5 py-1.5 text-xs text-white">
                  <option value="__me">Le mie ({me?.name ?? "nessun presentatore"})</option>
                  <option value="__all">Tutti i presentatori</option>
                  {usePresenters.filter((p) => p.id && p.id !== me?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button onClick={loadUsage} title="Aggiorna" className="ml-auto rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" /></button>
              </div>

              <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap gap-1">
                  {([["oggi", "Oggi"], ["7", "Ultimi 7 giorni"], ["30", "Ultimi 30 giorni"], ["tutto", "Tutto"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => applyPreset(k)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${preset === k ? "bg-brand text-white" : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"}`}>{l}</button>
                  ))}
                </div>
                <label className="block"><span className={label}>Dal</span>
                  <input type="date" value={dFrom} onChange={(e) => { setDFrom(e.target.value); setPreset("tutto"); }} className={`${input} w-40 text-sm`} /></label>
                <label className="block"><span className={label}>Al</span>
                  <input type="date" value={dTo} onChange={(e) => { setDTo(e.target.value); setPreset("tutto"); }} className={`${input} w-40 text-sm`} /></label>
              </div>

              {/* totali */}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi icon={Gauge} label="Totale consumato" value={fmtBytes(totSent + totRecv)} accent />
                <Kpi icon={ArrowUp} label="Inviati" value={fmtBytes(totSent)} />
                <Kpi icon={ArrowDown} label="Ricevuti" value={fmtBytes(totRecv)} />
                <Kpi icon={Phone} label="Videochiamate" value={String(shownUsage.length)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Kpi icon={Clock} label="Durata totale" value={fmtDurLong(totDur)} />
                <Kpi icon={Film} label="Registrazioni archiviate"
                  value={recsBytes > 0 ? fmtBytes(recsBytes) : `${recsInRange.length} file · dimensione non tracciata`} />
              </div>

              {/* dettaglio per chiamata */}
              {shownUsage.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-white/50">Nessun consumo registrato nel periodo selezionato.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-white/45">
                      <tr className="border-b border-white/10">
                        <th className="px-3 py-2 font-medium">Data</th>
                        <th className="px-3 py-2 font-medium">Presentatore</th>
                        <th className="px-3 py-2 font-medium">Ospiti</th>
                        <th className="px-3 py-2 font-medium">Durata</th>
                        <th className="px-3 py-2 text-right font-medium">Inviati</th>
                        <th className="px-3 py-2 text-right font-medium">Ricevuti</th>
                        <th className="px-3 py-2 text-right font-medium">Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownUsage.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 last:border-0">
                          <td className="whitespace-nowrap px-3 py-2">{new Date(u.date).toLocaleString("it-IT")}</td>
                          <td className="px-3 py-2 text-white/70">{u.presenterName || "—"}</td>
                          <td className="px-3 py-2 text-white/70">{u.guests || 0}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-white/70">{fmtDurLong(Number(u.durationSec) || 0)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-white/70">{fmtBytes(u.bytesSent)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-white/70">{fmtBytes(u.bytesReceived)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{fmtBytes((Number(u.bytesSent) || 0) + (Number(u.bytesReceived) || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-white/40">Misurazione WebRTC (statistiche della connessione): include video, audio e overhead di rete di tutti i partecipanti. Aggiornata ogni 10 secondi durante la chiamata.</p>
            </div>
          )}

          {tab === "preventivi" && (
            <div className="space-y-3">
              <div className="relative">
                <input value={qSearch} onChange={(e) => setQSearch(e.target.value)}
                  placeholder="Cerca per nome, telefono, email o numero preventivo…"
                  className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 focus:border-brand focus:outline-none" />
              </div>
              {qBusy && <p className="text-xs text-white/45">Cerco…</p>}
              {!qBusy && qRows.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-6 text-center text-sm text-white/45">Nessun preventivo trovato.</p>}
              <div className="space-y-2">
                {qRows.map((q) => (
                  <button key={q.quote_ref} type="button"
                    onClick={() => { onClose(); navigate({ to: "/preventivo", search: { id: q.quote_ref } as never }); }}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-brand/50 hover:bg-brand/[0.07]">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand/15 text-[11px] font-bold text-brand">
                      {(q.nome?.[0] || "?").toUpperCase()}{(q.cognome?.[0] || "").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{q.nome} {q.cognome}</span>
                      <span className="block truncate text-[11px] text-white/45">
                        {q.quote_ref} · {new Date(q.created_at).toLocaleDateString("it-IT")}{q.telefono ? ` · ${q.telefono}` : ""}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-sm font-bold text-white">{Number(q.total || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "errori" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm text-white/60">Problemi rilevati sul dispositivo del cliente, dal più recente.</p>
                <button onClick={loadErrs} className="ml-auto rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium hover:bg-white/10">Aggiorna</button>
                <button onClick={() => fetch("/api/presenter/errors", { method: "DELETE" }).then(() => setErrs([]))}
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20">Svuota</button>
              </div>
              {errs.length === 0 ? (
                <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-6 text-center text-sm text-emerald-200">Nessun errore registrato.</p>
              ) : (
                <div className="space-y-2">
                  {errs.map((e, i) => (
                    <div key={`${e.at}-${i}`} className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                        <span className="font-semibold text-amber-200">{new Date(e.at).toLocaleString("it-IT")}</span>
                        {e.page && <span className="rounded bg-white/10 px-1.5 py-0.5">{e.page}</span>}
                        {e.name && <span>· {e.name}</span>}
                      </div>
                      <p className="mt-1 break-words text-sm text-white/90">{e.msg}</p>
                      {(e.stack || e.ua) && (
                        <>
                          <button onClick={() => setErrOpen(errOpen === e.at ? null : e.at)}
                            className="mt-1.5 text-[11px] font-medium text-brand hover:underline">
                            {errOpen === e.at ? "Nascondi dettaglio tecnico" : "Mostra dettaglio tecnico"}
                          </button>
                          {errOpen === e.at && (
                            <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 text-[10px] leading-relaxed text-white/60">{e.stack}{e.ua ? `\n\n${e.ua}` : ""}</pre>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "altro" && (
            <div className="space-y-2">
              {/*  Il listino e i codici sconto NON stanno più nel gestionale: sono
                   le schede "Listino" e "Sconti e coupon" qui sopra. Rimandarci da
                   qui significherebbe far uscire da Meetly per tornare al punto di
                   partenza. */}
              <p className="mb-2 text-sm text-white/55">Accesso rapido a quello che vive fuori da questo pannello.</p>
              <NavRow icon={Images} title="Media presentazione" desc="Gestisci foto e video (pagina Media)" onClick={() => goto("/presenta")} />
              <NavRow icon={Server} title="Server TURN" desc="Configurazione di Meetly (endpoint api/public/turn)" href="/api/public/turn" />
            </div>
          )}

        </div>
      </div>

      {casesOpen && (
        <CasesManager cases={cases} setCases={setCases} onClose={() => setCasesOpen(false)} onAdded={() => setCasesOpen(false)} />
      )}
    </div>
  );
}

// ── PLAYER inline dell'archivio: riproduce la registrazione salvata sul server,
//    con scelta della VELOCITÀ di riproduzione, download ed eliminazione.
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
function RecordingPlayer({ rec, onClose, onDelete }: { rec: Registrazione; onClose: () => void; onDelete: () => void }) {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const [speed, setSpeed] = useState(1);
  useEffect(() => { if (vidRef.current) vidRef.current.playbackRate = speed; }, [speed, rec.url]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/12 bg-[#0a1428] shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2.5 text-white">
          <Film className="h-4 w-4 text-brand" />
          <span className="text-sm font-semibold">{new Date(rec.date).toLocaleString("it-IT")}</span>
          <span className="text-xs text-white/45">{rec.presenterName}{rec.guestName ? ` · ospite: ${rec.guestName}` : ""}</span>
          <button onClick={onClose} className="ml-auto rounded-md border border-white/15 p-1.5 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <video ref={vidRef} src={rec.url} controls autoPlay playsInline className="max-h-[70vh] w-full bg-black" />
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-2.5 text-white">
          <span className="text-[11px] uppercase tracking-wide text-white/45">Velocità</span>
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`rounded-md border px-2 py-1 text-xs font-medium ${speed === s ? "border-brand bg-brand/25" : "border-white/15 bg-white/5 hover:bg-white/10"}`}>
              {s}x
            </button>
          ))}
          <a href={rec.url} download target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10">Scarica</a>
          <button onClick={() => { onDelete(); onClose(); }} className="rounded-md border border-white/15 p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

// riquadro sintetico dei totali di consumo
function Kpi({ icon: Icon, label: l, value, accent }: { icon: typeof Tag; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-brand/40 bg-brand/10" : "border-white/10 bg-white/[0.03]"}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45"><Icon className="h-3.5 w-3.5 text-brand" /> {l}</span>
      <span className="mt-1 block text-xl font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

function NavRow({ icon: Icon, title, desc, onClick, href }: { icon: typeof Tag; title: string; desc: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-brand" />
      <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="block text-[11px] text-white/50">{desc}</span></span>
      <ExternalLink className="ml-auto h-4 w-4 text-white/40" />
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06]";
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
    : <button onClick={onClick} className={cls}>{inner}</button>;
}
