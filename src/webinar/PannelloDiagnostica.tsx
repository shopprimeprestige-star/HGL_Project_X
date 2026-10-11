/** ── IL PANNELLO CHE DICE PERCHÉ ───────────────────────────────────────────
 *  Si apre dalla console e risponde a due domande che sono tornate tre volte:
 *  «perché non si vede la camera di chi ho fatto salire» e «perché la mia esce
 *  schiacciata». Non ipotizza: misura.
 *
 *  ⚠️ MISURA IL DOM VERO, non quello che il codice crede. È il punto: se la
 *   pagina sta girando con una versione vecchia rimasta in cache, le misure lo
 *   dicono subito — e si smette di correggere un difetto già corretto.
 */
import { useEffect, useState } from "react";
import { ClipboardCopy, X } from "lucide-react";
import { aPosto, diagnosi, misuraRiquadro, type FattiPersona } from "./diagnostica-palco";

export interface DatiDiagnostica {
  persone: FattiPersona[];
  /** la versione del programma che sta girando: se non è l'ultima, si vede */
  costruito: string;
}

export function PannelloDiagnostica({
  dati,
  onChiudi,
}: {
  dati: DatiDiagnostica;
  onChiudi: () => void;
}) {
  /** Le misure vere del riquadro del presentatore e della sua camera.
   *  ⚠️ Si rileggono a intervallo e non una volta sola: la fascia cambia
   *   altezza quando si passa ai contenuti o quando sale qualcuno, e una misura
   *   presa all'apertura racconterebbe un momento che non c'è più. */
  const [misure, setMisure] = useState<string[]>([]);
  useEffect(() => {
    const leggi = () => {
      const righe: string[] = [];
      document.querySelectorAll("video").forEach((v, i) => {
        const r = v.getBoundingClientRect();
        if (r.width < 40) return; // le anteprime minuscole non dicono niente
        const m = misuraRiquadro(
          { larghezza: r.width, altezza: r.height },
          { larghezza: v.videoWidth, altezza: v.videoHeight },
        );
        righe.push(
          `video ${i + 1}: riquadro ${Math.round(r.width)}×${Math.round(r.height)} · ` +
            `camera ${v.videoWidth}×${v.videoHeight} · ${m.descrizione}`,
        );
      });
      setMisure(righe.length ? righe : ["Nessun video a schermo in questo momento."]);
    };
    leggi();
    const t = setInterval(leggi, 1500);
    return () => clearInterval(t);
  }, []);

  const testo = [
    `versione: ${dati.costruito}`,
    "",
    "── RIQUADRI ──",
    ...misure,
    "",
    "── CHI È SUL PALCO ──",
    ...(dati.persone.length
      ? dati.persone.flatMap((p) => [
          `${p.nome} (${p.spettatore}) — concesso: ${p.stato}`,
          `   ${diagnosi(p)}`,
          `   sessione: ${p.sessionId || "—"} · audio: ${p.tracciaAudio || "—"} · video: ${p.tracciaVideo || "—"}`,
          `   agganciate: ${p.agganciate.join(", ") || "nessuna"}`,
          `   arrivate: ${p.arrivate.map((t) => `${t.kind}(${t.readyState}${t.enabled ? "" : ", spenta"}${t.muted ? ", senza fotogrammi" : ""})`).join(", ") || "nessuna"}`,
        ])
      : ["Nessuno sul palco."]),
  ].join("\n");

  return (
    <div className="fixed inset-x-3 bottom-3 z-[200] mx-auto max-h-[70%] max-w-2xl overflow-auto rounded-xl border border-white/15 bg-[#07142c]/97 p-3 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[13px] font-semibold">Perché non si vede</p>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">{dati.costruito}</span>
        <button
          onClick={() => void navigator.clipboard?.writeText(testo)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10"
        >
          <ClipboardCopy className="h-3 w-3" /> Copia tutto
        </button>
        <button onClick={onChiudi} className="rounded-lg border border-white/15 p-1 hover:bg-white/10">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── LE MISURE ────────────────────────────────────────────────────
            Prima le proporzioni, perché è la domanda che si vede a occhio e
            quindi quella che si fa per prima. */}
      <p className="t-etichetta mb-1 text-[10px] uppercase tracking-wide text-white/40">Riquadri</p>
      {misure.map((m) => (
        <p key={m} className="font-mono text-[11px] leading-relaxed text-white/70">{m}</p>
      ))}

      <p className="t-etichetta mb-1 mt-3 text-[10px] uppercase tracking-wide text-white/40">Chi è sul palco</p>
      {dati.persone.length === 0 && <p className="text-[11.5px] text-white/50">Nessuno sul palco adesso.</p>}
      {dati.persone.map((p) => (
        <div key={p.spettatore} className="mb-2 rounded-lg border border-white/10 p-2">
          <p className="flex items-center gap-1.5 text-[12px] font-medium">
            <span className={`h-1.5 w-1.5 rounded-full ${aPosto(p) ? "bg-emerald-400" : "bg-amber-400"}`} />
            {p.nome}
            <span className="text-white/40">· concesso: {p.stato}</span>
          </p>
          {/*  La diagnosi in una frase, e sotto i dati grezzi: chi conduce
                legge la frase, chi corregge legge il resto. */}
          <p className="mt-0.5 text-[11.5px] text-white/75">{diagnosi(p)}</p>
          <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-white/45">
            sessione {p.sessionId || "—"} · video {p.tracciaVideo || "—"} ·{" "}
            agganciate {p.agganciate.length} · arrivate{" "}
            {p.arrivate.map((t) => `${t.kind}(${t.readyState}${t.enabled ? "" : ",spenta"}${t.muted ? ",no frame" : ""})`).join(" ") || "nessuna"}
          </p>
        </div>
      ))}
    </div>
  );
}
