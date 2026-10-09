/** ── IL TELEPROMPTER DELLO STUDIO ───────────────────────────────────────────
 *
 *  ⚠️ GLI STESSI COPIONI DI MEETLY, non un secondo archivio. Legge e scrive
 *   `hg_tp_scripts` — la stessa chiave del teleprompter della videoconsulenza —
 *   quindi quello scritto per le consulenze è già qui, e uno scritto qui si
 *   ritrova là. Due archivi separati avrebbero voluto dire riscrivere lo
 *   stesso discorso due volte e correggerlo in un posto solo.
 *
 *  ⚠️ E LO STESSO RICONOSCIMENTO VOCALE: `ensureRecognition` e `onSpoken`
 *   arrivano da `shop/call`, che sono già esportate. Aprirne un secondo
 *   vorrebbe dire due motori in ascolto sullo stesso microfono, che si rubano
 *   la voce a vicenda — e nessuno dei due seguirebbe più niente.
 *
 *  ⚠️ MA NON È IL SUO RIQUADRO. Quello di Meetly spinge tutto il gestionale
 *   nella metà opposta dello schermo: dentro lo studio a schermo intero
 *   spaccherebbe la regia in due. Qui sta sopra la chat e si tira per la
 *   misura.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { ensureRecognition, onSpoken } from "@/shop/call";
import { avanza, parole } from "./segui-parole";

interface Copione { id: string; name: string; body: string }

/** ⚠️ La stessa chiave del teleprompter di Meetly (`shop/call.tsx`). */
const CHIAVE = "hg_tp_scripts";
const CHIAVE_SCELTO = "hg_tp_current";
const CHIAVE_ALTEZZA = "hg_tp_altezza_webinar";

const nuovoId = () => "s" + Math.random().toString(36).slice(2, 8);

function leggiCopioni(): Copione[] {
  if (typeof window === "undefined") return [];
  try {
    const a = JSON.parse(localStorage.getItem(CHIAVE) || "[]");
    if (Array.isArray(a) && a.length) return a;
  } catch { /* archivio illeggibile: si riparte */ }
  return [{ id: nuovoId(), name: "Copione 1", body: "" }];
}

export function Teleprompter({ chiudi, nomePresentatore }: { chiudi: () => void; nomePresentatore: string }) {
  const [copioni, setCopioni] = useState<Copione[]>(leggiCopioni);
  const [sceltoId, setSceltoId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(CHIAVE_SCELTO) || "";
  });
  const [corpo, setCorpo] = useState(20);
  const [modifica, setModifica] = useState(false);
  const [rinomina, setRinomina] = useState(false);
  const [segno, setSegno] = useState(0);
  const [altezza, setAltezza] = useState(() => {
    if (typeof window === "undefined") return 260;
    const v = Number(localStorage.getItem(CHIAVE_ALTEZZA));
    return v >= 120 && v <= 800 ? v : 260;
  });
  const trascina = useRef<{ y: number; h: number } | null>(null);
  const qui = useRef<HTMLSpanElement | null>(null);

  const scelto = copioni.find((x) => x.id === sceltoId) ?? copioni[0];

  useEffect(() => { if (scelto && scelto.id !== sceltoId) setSceltoId(scelto.id); }, [scelto, sceltoId]);
  useEffect(() => { try { localStorage.setItem(CHIAVE, JSON.stringify(copioni)); } catch { /* */ } }, [copioni]);
  useEffect(() => { if (scelto) { try { localStorage.setItem(CHIAVE_SCELTO, scelto.id); } catch { /* */ } } }, [scelto]);
  useEffect(() => { try { localStorage.setItem(CHIAVE_ALTEZZA, String(altezza)); } catch { /* */ } }, [altezza]);

  //  Cambiando copione — o entrando in modifica — si riparte da capo: lasciare
  //  il segno dov'era su un testo diverso lo metterebbe a caso.
  useEffect(() => { setSegno(0); }, [sceltoId, modifica]);

  // ── IL TESTO, COI SEGNAPOSTO RIEMPITI ───────────────────────────────
  //  Un copione letto ad alta voce con dentro «{PRESENTATORE}» è la figuraccia
  //  classica.
  const testo = (scelto?.body || "").replace(/\{PRESENTATORE\}/g, nomePresentatore);
  //  I pezzi tengono anche gli spazi, per poter disegnare il testo com'è; i
  //  token sono solo le parole, ed è su quelli che si conta la posizione.
  const pezzi = useMemo(() => testo.split(/(\s+)/), [testo]);
  const token = useMemo(() => parole(testo), [testo]);

  // ── SEGUIRE CHI PARLA ───────────────────────────────────────────────
  useEffect(() => {
    if (modifica) return;
    //  ⚠️ Lo stesso motore di Meetly: `ensureRecognition` è idempotente, e se
    //   la consulenza lo sta già usando non ne parte un secondo.
    ensureRecognition();
    return onSpoken((detto) => setSegno((c) => avanza(c, token, detto)));
  }, [modifica, token]);

  //  Il punto in cui si è arrivati resta al centro: scorrere a mano mentre si
  //  parla non lo fa nessuno.
  useEffect(() => { qui.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [segno]);

  // ── LA MANIGLIA ─────────────────────────────────────────────────────
  //  Si segue su `window` e non sulla maniglia: uscendo dal riquadro col dito
  //  — cosa che succede sempre, perché si tira in fretta — gli eventi
  //  smetterebbero di arrivare e la misura resterebbe a metà.
  useEffect(() => {
    const muovi = (e: PointerEvent) => {
      const t = trascina.current;
      if (!t) return;
      setAltezza(Math.min(800, Math.max(120, t.h + (t.y - e.clientY))));
    };
    const molla = () => { trascina.current = null; };
    window.addEventListener("pointermove", muovi);
    window.addEventListener("pointerup", molla);
    window.addEventListener("pointercancel", molla);
    return () => {
      window.removeEventListener("pointermove", muovi);
      window.removeEventListener("pointerup", molla);
      window.removeEventListener("pointercancel", molla);
    };
  }, []);

  // ── I COPIONI ───────────────────────────────────────────────────────
  const aggiungi = () => {
    const s = { id: nuovoId(), name: `Copione ${copioni.length + 1}`, body: "" };
    setCopioni((a) => [...a, s]);
    setSceltoId(s.id);
    setModifica(true);
    setRinomina(true);
  };
  const elimina = () => {
    //  Mai zero copioni: l'elenco vuoto è uno stato in cui non si può più fare
    //  niente, e da cui si esce solo ricaricando.
    if (!scelto || copioni.length <= 1) return;
    const resto = copioni.filter((x) => x.id !== scelto.id);
    setCopioni(resto);
    setSceltoId(resto[0].id);
  };
  const scriviNome = (v: string) => setCopioni((a) => a.map((x) => (x.id === scelto?.id ? { ...x, name: v } : x)));
  const scriviCorpo = (v: string) => setCopioni((a) => a.map((x) => (x.id === scelto?.id ? { ...x, body: v } : x)));

  let contati = -1;

  return (
    <div className="flex shrink-0 flex-col border-b border-white/10 bg-black/40">
      <div
        onPointerDown={(e) => { trascina.current = { y: e.clientY, h: altezza }; }}
        title="Trascina per cambiare l'altezza"
        className="flex h-3 cursor-ns-resize items-center justify-center border-b border-white/10 bg-white/[0.04] hover:bg-white/10"
      >
        <span className="h-0.5 w-8 rounded bg-white/25" />
      </div>

      {/* ── LA BARRA DEI COPIONI ─────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {rinomina ? (
          <>
            <input
              value={scelto?.name ?? ""}
              onChange={(e) => scriviNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setRinomina(false)}
              autoFocus
              placeholder="Come si chiama"
              className="min-w-0 flex-1 rounded border border-brand bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white outline-none"
            />
            <button onClick={() => setRinomina(false)} className="rounded p-1 text-emerald-300 hover:bg-white/10" aria-label="Conferma il nome">
              <Check className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <select
              value={scelto?.id ?? ""}
              onChange={(e) => setSceltoId(e.target.value)}
              className="min-w-0 flex-1 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white outline-none"
            >
              {copioni.map((x) => (
                <option key={x.id} value={x.id} className="bg-[#0b1426]">{x.name || "senza nome"}</option>
              ))}
            </select>
            <button onClick={() => setRinomina(true)} title="Rinomina" className="rounded p-1 text-white/60 hover:bg-white/10">
              <Pencil className="h-3 w-3" />
            </button>
            <button onClick={aggiungi} title="Nuovo copione" className="rounded p-1 text-white/60 hover:bg-white/10">
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={elimina}
              disabled={copioni.length <= 1}
              title={copioni.length <= 1 ? "È l'unico copione" : "Elimina questo copione"}
              className="rounded p-1 text-white/60 hover:bg-white/10 disabled:opacity-25"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}

        <span className="mx-1 h-4 w-px bg-white/15" />
        <button onClick={() => setCorpo((v) => Math.max(12, v - 2))} className="rounded p-1 text-white/60 hover:bg-white/10" aria-label="Testo più piccolo">
          <Minus className="h-3 w-3" />
        </button>
        <button onClick={() => setCorpo((v) => Math.min(48, v + 2))} className="rounded p-1 text-white/60 hover:bg-white/10" aria-label="Testo più grande">
          <Plus className="h-3 w-3" />
        </button>
        <button
          onClick={() => setModifica((v) => !v)}
          title={modifica ? "Torna a leggere" : "Scrivi il copione"}
          className={`rounded p-1 hover:bg-white/10 ${modifica ? "text-brand" : "text-white/60"}`}
        >
          {modifica ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
        </button>
        <button onClick={chiudi} className="rounded p-1 text-white/60 hover:bg-white/10" aria-label="Chiudi il teleprompter">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {modifica ? (
        <textarea
          value={scelto?.body ?? ""}
          onChange={(e) => scriviCorpo(e.target.value)}
          style={{ height: altezza }}
          placeholder="Scrivi qui il copione. Puoi usare {PRESENTATORE}: si riempie da solo. Mentre parli, il testo già detto si spegne da sé."
          className="w-full resize-none bg-transparent px-3 py-2 text-[13px] leading-relaxed text-white/85 outline-none placeholder:text-white/25"
        />
      ) : (
        <div style={{ height: altezza, fontSize: corpo, lineHeight: 1.45 }} className="overflow-y-auto px-3 py-2">
          {testo ? (
            //  ⚠️ Il già detto SI SPEGNE, non sparisce: chi legge deve poter
            //   tornare indietro con l'occhio se perde il filo, e un testo che
            //   scompare glielo impedisce proprio nel momento in cui serve.
            pezzi.map((p, i) => {
              if (!/\S/.test(p)) return <span key={i}>{p}</span>;
              contati++;
              const mio = contati;
              const detto = mio < segno;
              const adesso = mio === segno;
              return (
                <span
                  key={i}
                  ref={adesso ? qui : undefined}
                  className={
                    detto
                      ? "text-white/25"
                      : adesso
                        ? "rounded bg-brand/30 text-white"
                        : "text-white/90"
                  }
                >
                  {p}
                </span>
              );
            })
          ) : (
            <span className="text-[13px] text-white/30">
              Copione vuoto. Tocca la matita per scriverlo — è lo stesso archivio del teleprompter
              delle consulenze.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
