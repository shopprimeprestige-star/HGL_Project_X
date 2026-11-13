/** ── EDITOR VISUALE DELLE IMMAGINI ─────────────────────────────────────────
 *  Si apre da /invisible-derm?modifica, solo per chi è entrato nel CRM.
 *  Ogni sezione mostra in alto a destra «Cambia immagini»: un clic apre il
 *  pannello con tutti i punti foto/video di QUELLA sezione (anche quelli
 *  ancora vuoti, che sulla pagina non si vedono), con anteprima, «Carica» e
 *  «Togli». Salvare pubblica subito, come l'editor del CRM: non c'è bozza.
 *  In modifica OGNI punto foto/video compare al suo posto anche se vuoto (un riquadro
 *  tratteggiato con il nome del punto), e toccare qualsiasi immagine apre il suo pannello.
 *  Il cliente non vede niente di tutto questo (senza accesso il componente
 *  non disegna nulla).
 *  ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { salvaCampoLanding } from "@/landing/landing-content";
import { SLOT_ID, liberatoriaOk } from "@/landing/testi-invisible-derm";

/** Vero solo con ?modifica nell'indirizzo E un accesso al CRM aperto. */
export function useModificaAttiva(): boolean {
  const [attiva, setAttiva] = useState(false);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("modifica")) return;
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setAttiva(!!data.session?.user);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return attiva;
}

async function caricaFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `invisible-derm/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("landing-media")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("landing-media").getPublicUrl(path).data.publicUrl;
}

/** Il riquadro che sta al posto di un punto vuoto, solo in modifica. */
export function segnaposto(chiave: string): string {
  const slot = SLOT_ID.find((x) => x.chiave === chiave);
  const nome = (slot?.label ?? chiave).split(",")[0];
  const righe: string[] = [];
  for (const parola of nome.split(" ")) {
    const ultima = righe[righe.length - 1];
    if (ultima && (ultima + " " + parola).length <= 26) righe[righe.length - 1] = ultima + " " + parola;
    else righe.push(parola);
  }
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const testo = [...righe, `Tocca per caricare ${slot?.tipo === "video" ? "il video" : "la foto"}`]
    .map((t, i, a) => `<text x="200" y="${150 - (a.length - 1) * 11 + i * 22}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="${i === a.length - 1 ? 13 : 17}" font-weight="${i === a.length - 1 ? 400 : 700}" fill="#0a1a3a">${esc(t)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect width="400" height="300" fill="#fde68a"/><rect x="8" y="8" width="384" height="284" fill="none" stroke="#b45309" stroke-width="3" stroke-dasharray="10 8"/>${testo}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Un'immagine toccata → le chiavi che le stanno insieme (la foto e la sua compagna, il video e la sua copertina). */
function chiaviVicine(chiave: string): string[] {
  const base = chiave.replace(/(Poster|\.patchClip|\.dermClip|\.patch|\.derm|\.prima|\.dopo)$/, "");
  return SLOT_ID.filter((x) => x.chiave === chiave || x.chiave.startsWith(base)).map((x) => x.chiave);
}

function liberatoriaDi(chiave: string): { chiave: string; testo: string } | undefined {
  const testo = "Ho la liberatoria scritta di chi è ritratto (senza, queste foto non compaiono sulla pagina)";
  if (chiave.startsWith("id.confronto")) return { chiave: "id.confronto.liberatoria", testo };
  if (chiave.startsWith("id.vita")) return { chiave: "id.vita.liberatoria", testo };
  if (chiave.startsWith("id.primaDopo")) return { chiave: "id.primaDopo.liberatoria", testo };
  return undefined;
}

/** La striscia in cima alla pagina, e il tocco su qualsiasi immagine che apre il suo pannello.
 *  `vista(k)` = quello che la pagina mostra per la chiave k (file vero o riquadro). */
export function BarraModifica({ vista, media, text }: { vista: (k: string) => string; media: (k: string) => string; text: (k: string) => string }) {
  const [scelta, setScelta] = useState<string | null>(null);
  useEffect(() => {
    const tocco = (e: MouseEvent) => {
      const bersaglio = e.target as HTMLElement | null;
      if (!bersaglio || bersaglio.closest("[data-pannello-modifica]")) return;
      let el: HTMLElement | null = bersaglio;
      for (let i = 0; el && i < 5; i++, el = el.parentElement) {
        const m = el.matches("img,video") ? el : el.querySelector("img,video");
        if (!m) continue;
        const indirizzi = [m.getAttribute("src"), m.getAttribute("poster")].filter(Boolean);
        const trovata = SLOT_ID.find((x) => indirizzi.includes(vista(x.chiave)));
        if (trovata) {
          e.preventDefault();
          e.stopPropagation();
          setScelta(trovata.chiave);
          return;
        }
      }
    };
    document.addEventListener("click", tocco, true);
    return () => document.removeEventListener("click", tocco, true);
  }, [vista]);
  return (
    <>
    {scelta && (
      <Pannello titolo="Questo punto" chiavi={chiaviVicine(scelta)} media={media} text={text} liberatoria={liberatoriaDi(scelta)} chiudi={() => setScelta(null)} />
    )}
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-black">
      <span>Modalità modifica · tocca un'immagine o un riquadro giallo per cambiarlo. Ogni modifica va online subito.</span>
      <a href="/invisible-derm" className="underline underline-offset-2">Esci</a>
    </div>
    </>
  );
}

function Punto({
  chiave,
  label,
  tipo,
  valore,
}: {
  chiave: string;
  label: string;
  tipo: "image" | "video";
  valore: string;
}) {
  const [stato, setStato] = useState<"" | "carico" | "salvato" | string>("");
  const salva = async (v: string) => {
    await salvaCampoLanding("media", chiave, v);
  };
  return (
    <li className="rounded-lg border border-black/10 bg-white p-3">
      <p className="text-sm font-medium text-black">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-neutral-100 text-[11px] text-neutral-500">
          {valore ? (
            tipo === "video" ? (
              <video src={valore} muted playsInline className="h-full w-full object-cover" />
            ) : (
              <img src={valore} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            "vuoto"
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black px-3 py-2 text-xs font-medium text-white ${stato === "carico" ? "pointer-events-none opacity-60" : ""}`}>
            {stato === "carico" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {valore ? "Cambia" : "Carica"}
            <input
              type="file"
              accept={tipo === "video" ? "video/*" : "image/*"}
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setStato("carico");
                try {
                  await salva(await caricaFile(f));
                  setStato("salvato");
                } catch (err: any) {
                  setStato(`Errore: ${err?.message || "caricamento non riuscito"}`);
                }
              }}
            />
          </label>
          {valore && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-black/15 px-3 py-2 text-xs text-red-700"
              onClick={async () => {
                if (!window.confirm("Togliere questa immagine dalla pagina? Il file resta salvato.")) return;
                setStato("carico");
                try {
                  await salva("");
                  setStato("salvato");
                } catch (err: any) {
                  setStato(`Errore: ${err?.message || "non salvato"}`);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Togli
            </button>
          )}
        </div>
      </div>
      {stato === "salvato" && <p className="mt-2 text-xs text-green-700">Salvato: è già online.</p>}
      {stato.startsWith("Errore") && <p className="mt-2 text-xs text-red-700">{stato}</p>}
    </li>
  );
}

function Liberatoria({ chiave, testo, valore }: { chiave: string; testo: string; valore: string }) {
  const [salvo, setSalvo] = useState(false);
  return (
    <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-black">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={liberatoriaOk(valore)}
        disabled={salvo}
        onChange={async (e) => {
          setSalvo(true);
          try {
            await salvaCampoLanding("texts", chiave, e.target.checked ? "sì" : "");
          } finally {
            setSalvo(false);
          }
        }}
      />
      <span>{testo}</span>
    </label>
  );
}

/** Il bottone «Cambia immagini» di una sezione e il suo pannello.
 *  `chiavi`: i punti foto/video della sezione (chiavi `id.*` dello schema). */
export function PuntoModifica({
  attiva,
  titolo,
  chiavi,
  media,
  text,
  liberatoria,
}: {
  attiva: boolean;
  titolo: string;
  chiavi: string[];
  media: (k: string) => string;
  text: (k: string) => string;
  liberatoria?: { chiave: string; testo: string };
}) {
  const [aperto, setAperto] = useState(false);
  if (!attiva) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="absolute right-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-xs font-semibold text-black shadow-lg ring-2 ring-white hover:bg-amber-300"
      >
        <ImagePlus className="h-4 w-4" /> Cambia immagini · {titolo}
      </button>
      {aperto && <Pannello titolo={titolo} chiavi={chiavi} media={media} text={text} liberatoria={liberatoria} chiudi={() => setAperto(false)} />}
    </>
  );
}

function Pannello({
  titolo,
  chiavi,
  media,
  text,
  liberatoria,
  chiudi,
}: {
  titolo: string;
  chiavi: string[];
  media: (k: string) => string;
  text: (k: string) => string;
  liberatoria?: { chiave: string; testo: string };
  chiudi: () => void;
}) {
  const punti = SLOT_ID.filter((s) => chiavi.includes(s.chiave));
  return (
    <div data-pannello-modifica className="fixed inset-0 z-[70] flex justify-end bg-black/40" onClick={chiudi}>
      <aside
        role="dialog"
        aria-label={`Immagini · ${titolo}`}
        className="h-full w-full max-w-md overflow-y-auto bg-neutral-50 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-black">Immagini · {titolo}</h2>
          <button type="button" onClick={chiudi} className="rounded-md p-2 text-black hover:bg-black/5" aria-label="Chiudi">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-xs text-neutral-600">I riquadri gialli sulla pagina li vedi solo tu: ai clienti compare solo quello che carichi.</p>
        {liberatoria && (
          <div className="mb-3">
            <Liberatoria chiave={liberatoria.chiave} testo={liberatoria.testo} valore={text(liberatoria.chiave)} />
          </div>
        )}
        <ul className="space-y-3">
          {punti.map((p) => (
            <Punto key={p.chiave} chiave={p.chiave} label={p.label} tipo={p.tipo} valore={media(p.chiave)} />
          ))}
        </ul>
      </aside>
    </div>
  );
}
