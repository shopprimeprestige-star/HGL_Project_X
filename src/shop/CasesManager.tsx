import { useEffect, useState } from "react";
import { Upload, Link2, Trash2, X, BarChart3, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export interface Caso {
  id: string; name: string; age: string; location: string;
  kind: "video" | "photos"; videoUrl?: string; beforeUrl?: string; afterUrl?: string;
}

export function CasesManager({ cases, setCases, onClose, onAdded }: { cases: Caso[]; setCases: (c: Caso[]) => void; onClose: () => void; onAdded?: (cases: Caso[]) => void }) {
  const [kind, setKind] = useState<"video" | "photos">("video");
  const [name, setName] = useState(""); const [age, setAge] = useState(""); const [loc, setLoc] = useState("");
  const [videoUrl, setVideoUrl] = useState(""); const [beforeUrl, setBeforeUrl] = useState(""); const [afterUrl, setAfterUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [savingStats, setSavingStats] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    fetch("/api/presenter/stats").then((r) => r.json()).then((j) => setStats(j.stats ?? {})).catch(() => {});
    fetch("/api/presenter/brand").then((r) => r.json()).then((j) => setLogoUrl(j.logoUrl || "")).catch(() => {});
  }, []);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return; setLogoBusy(true);
    const u = await upload(f);
    if (u) { await fetch("/api/presenter/brand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: u }) }); setLogoUrl(u); toast.success("Logo aggiornato — ricarica per vederlo ovunque"); }
    setLogoBusy(false); e.target.value = "";
  };

  const upload = async (f: File): Promise<string | null> => {
    const fd = new FormData(); fd.append("file", f);
    const j = await (await fetch("/api/presenter/upload", { method: "POST", body: fd })).json();
    if (!j.ok) { toast.error("Upload fallito: " + (j.reason || "")); return null; }
    return j.url as string;
  };
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>, set: (u: string) => void) => {
    const f = e.target.files?.[0]; if (!f) return; setBusy(true);
    const u = await upload(f); if (u) set(u); setBusy(false); e.target.value = "";
  };
  const add = async () => {
    const body = { name, age, location: loc, kind, videoUrl, beforeUrl, afterUrl };
    const j = await (await fetch("/api/presenter/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    if (!j.ok) { toast.error("Compila i media richiesti"); return; }
    setCases(j.cases); onAdded?.(j.cases); toast.success("Caso aggiunto");
    setName(""); setAge(""); setLoc(""); setVideoUrl(""); setBeforeUrl(""); setAfterUrl("");
  };
  const del = async (id: string) => { const j = await (await fetch(`/api/presenter/cases?id=${id}`, { method: "DELETE" })).json(); setCases(j.cases); };
  const saveStats = async () => {
    setSavingStats(true);
    const j = await (await fetch("/api/presenter/stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stats) })).json();
    setStats(j.stats ?? stats); setSavingStats(false); toast.success("Numeri salvati");
  };

  const inp = "w-full rounded-lg border border-white/20 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none";
  const upBtn = "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 bg-white/[0.03] px-3 py-3 text-xs text-white/70 hover:bg-white/5";
  const stat = (key: string, label: string) => (
    <label className="block"><span className="mb-1 block text-[11px] text-white/50">{label}</span>
      <input value={stats[key] ?? ""} onChange={(e) => setStats({ ...stats, [key]: e.target.value })} className={inp} /></label>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-6 w-full max-w-2xl rounded-3xl border border-white/10 bg-[#081634] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Casi & Risultati</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {/* logo del brand */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <span className="flex h-12 w-24 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {logoUrl ? <img src={logoUrl} alt="logo" className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-white/40" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Logo del brand</p>
            <p className="text-[11px] text-white/45">PNG/SVG con sfondo trasparente. Appare in tutte le intestazioni.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-brand bg-brand/10 px-3 py-2 text-sm font-medium text-white hover:bg-brand/20">
            <Upload className="h-4 w-4" /> {logoBusy ? "…" : (logoUrl ? "Cambia" : "Carica")}
            <input type="file" accept="image/*" className="hidden" onChange={onLogo} disabled={logoBusy} />
          </label>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 grid grid-cols-3 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className={inp} />
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Età" className={inp} />
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Città" className={inp} />
          </div>
          <div className="mb-3 flex gap-2">
            {(["video", "photos"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${kind === k ? "border-brand bg-brand/10" : "border-white/15 bg-white/5 text-white/70"}`}>
                {k === "video" ? "Video testimonianza" : "Prima / Dopo"}
              </button>
            ))}
          </div>
          {kind === "video" ? (
            <div className="space-y-2">
              <label className={upBtn}><Upload className="h-4 w-4" /> {videoUrl ? "Video caricato ✓" : (busy ? "Caricamento…" : "Carica video")}<input type="file" accept="video/*" className="hidden" onChange={(e) => onUpload(e, setVideoUrl)} /></label>
              <div className="relative"><Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" /><input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="…oppure incolla URL video" className={`${inp} pl-8`} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className={upBtn}><Upload className="h-4 w-4" /> {beforeUrl ? "Prima ✓" : "Carica PRIMA"}<input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e, setBeforeUrl)} /></label>
              <label className={upBtn}><Upload className="h-4 w-4" /> {afterUrl ? "Dopo ✓" : "Carica DOPO"}<input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e, setAfterUrl)} /></label>
            </div>
          )}
          <button onClick={add} disabled={busy} className="mt-3 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">Aggiungi caso alle slide</button>
        </div>

        {cases.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Casi ({cases.length}) — dopo "Il risultato parla da solo"</p>
            {cases.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${c.kind === "video" ? "bg-brand/20 text-brand" : "bg-emerald-500/20 text-emerald-300"}`}>{c.kind === "video" ? "VIDEO" : "PRIMA/DOPO"}</span>
                <span className="min-w-0 flex-1 truncate">{c.name || "Cliente"}{c.age && `, ${c.age}`}{c.location && ` · ${c.location}`}</span>
                <button onClick={() => del(c.id)} className="rounded-md border border-white/10 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        {/* numeri / social proof / posti */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-brand" /> Numeri della presentazione</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stat("implants", "Impianti realizzati")}
            {stat("years", "Anni di esperienza")}
            {stat("spotsLeft", "Posti rimasti")}
            {stat("spotsTotal", "Posti totali")}
          </div>
          <label className="mt-2 block"><span className="mb-1 block text-[11px] text-white/50">Testo garanzia</span>
            <input value={stats.guarantee ?? ""} onChange={(e) => setStats({ ...stats, guarantee: e.target.value })} className={inp} /></label>
          <button onClick={saveStats} disabled={savingStats} className="mt-3 rounded-lg border border-brand bg-brand/10 px-4 py-2 text-sm font-medium text-white hover:bg-brand/20 disabled:opacity-60">{savingStats ? "…" : "Salva numeri"}</button>
        </div>
      </div>
    </div>
  );
}
